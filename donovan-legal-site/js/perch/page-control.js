// ── SHELDON-PERCH-COMMAND-CHANNEL: the non-booking page-control executor ─────
//
// The sibling of ./booking-control.js, and it exists for exactly the same reason,
// one command family over.
//
// ── THE GAP THIS CLOSES ──────────────────────────────────────────────────────
// `perch-inject.js` is the executor for `{type:'perch'}` commands, and it runs
// ONLY inside the shell's iframe — `js/page/perch-shell.js` appends it to the
// frame document on every load, and nothing else references the file. Under the
// router the site is one document, so js/perch-layer.js's host posts
// `{type:'perch'}` at its own window and nothing is listening.
//
// A31 (#56) closed that for the booking family via ./booking-control.js and said
// plainly that it was scoping itself there: "Non-booking commands (`scroll`,
// `highlight`, `scrollby`) still take the postMessage road unchanged. They were
// unobserved under the router before this ticket and they remain so."
//
// That was correct scoping for #56 and it is the wrong end state for A51. Paula's
// tool list (functions/fn/get_page_actions.js) publishes `scroll_down`,
// `scroll_up`, `scroll_to_top` and `scroll_to_bottom` as things she can do, and
// on a content page today all four return `{status:"done"}` and move nothing. So
// this module ports those three branches out of `perch-inject.js` to run against
// the LIVE document instead of the framed one.
//
// ── WHAT IT DOES NOT PORT ────────────────────────────────────────────────────
// `perch-inject.js`'s `navigate` branch is deliberately absent. Navigation under
// the router goes through `host.go()` → `navigateVia()` → Swup, because a
// `location.assign` is precisely the hard navigation that kills the call the
// layer exists to protect. Nothing here assigns to `location`.
//
// The booking_* branches are absent for the same reason they are in
// ./booking-control.js instead: one owner per command family.
//
// ── AND WHAT IT INHERITS ─────────────────────────────────────────────────────
// The scroll amounts, the smooth behaviour, the `#id`-vs-selector split and the
// 2600 ms highlight are `perch-inject.js`'s numbers, unchanged. A caller who is
// shown around by Paula on `/perch` and one shown around on `/contact` should not
// be able to tell which implementation moved the page.

/** Every command this adapter answers for. Anything else falls through. */
export const PAGE_COMMANDS = Object.freeze(['scroll', 'scrollby', 'highlight']);

/** Fraction of the viewport a relative scroll moves. perch-inject.js:61. */
export const SCROLL_FRACTION = 0.85;
/** How long the highlight ring stays on. perch-inject.js:56. */
export const HIGHLIGHT_MS = 2600;

/**
 * Build the adapter.
 *
 * Takes `win`/`doc` rather than reaching for the globals, so CI can drive the
 * REAL functions against a jsdom window — the same shape ./booking-control.js
 * uses, for the same reason.
 *
 * @param {Window} win
 * @param {Document} [doc] defaults to `win.document`
 */
export function createPageControl(win, doc) {
  const document_ = doc || (win && win.document) || null;

  const log = [];
  function record(entry) {
    log.push(entry);
    if (log.length > 50) log.shift();
    return entry;
  }

  function handles(cmd) {
    return PAGE_COMMANDS.indexOf(cmd) !== -1;
  }

  /**
   * Resolve a target the way `perch-inject.js` does: `#id` through
   * `getElementById`, anything else through `querySelector`.
   *
   * Wrapped because a malformed selector makes `querySelector` THROW, and this
   * runs inside the 1.2 s poll — one bad selector from the agent must not take
   * the loop, and every later command with it, down.
   */
  function resolve(target) {
    if (!document_ || !target) return null;
    try {
      return target[0] === '#'
        ? document_.getElementById(target.slice(1))
        : document_.querySelector(target);
    } catch (e) {
      return null;
    }
  }

  /**
   * Execute one page-control command against the live document.
   *
   * Never throws, for the reason above.
   *
   * @returns {{handled: boolean, cmd: string, reason?: string}}
   */
  function apply(cmd, target) {
    if (!handles(cmd)) return { handled: false, cmd, reason: 'not_a_page_command' };
    if (!win || !document_) return record({ handled: true, cmd, reason: 'no_document' });

    try {
      if (cmd === 'scroll') {
        const el = resolve(target);
        if (!el) return record({ handled: true, cmd, target, reason: 'target_absent' });
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return record({ handled: true, cmd, target, via: 'scrollIntoView' });
      }

      if (cmd === 'highlight') {
        const el = resolve(target);
        if (!el) return record({ handled: true, cmd, target, reason: 'target_absent' });
        el.style.transition = 'box-shadow .3s';
        el.style.boxShadow = '0 0 0 3px #c1a221';
        win.setTimeout(() => { el.style.boxShadow = ''; }, HIGHLIGHT_MS);
        return record({ handled: true, cmd, target, via: 'boxShadow' });
      }

      // scrollby
      const h = win.innerHeight || 600;
      if (target === 'top') {
        win.scrollTo({ top: 0, behavior: 'smooth' });
      } else if (target === 'bottom') {
        const height = (document_.documentElement && document_.documentElement.scrollHeight) || 0;
        win.scrollTo({ top: height, behavior: 'smooth' });
      } else {
        win.scrollBy({ top: (target === 'up' ? -1 : 1) * Math.round(h * SCROLL_FRACTION), behavior: 'smooth' });
      }
      return record({ handled: true, cmd, target, via: 'scroll' });
    } catch (e) {
      return record({ handled: true, cmd, target, reason: 'threw', error: String(e) });
    }
  }

  /** Read-only diagnostics. Exposes no way to drive the page. */
  function probe() {
    return { commands: PAGE_COMMANDS.slice(), log: log.slice(-10) };
  }

  return { handles, apply, probe };
}
