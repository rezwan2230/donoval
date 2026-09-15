// ── SHELDON-PERCH-A22: the post-swap re-init recipe ──────────────────────────
//
// Ticket #52 · Phase A / Phase 2. This is RE-INIT-INVENTORY.md §5 — the ordered
// checklist A0.3 (#63) derived from the source — executed for real, one function
// per row, in the same order.
//
// It is a separate module from the router for the reason §5 exists at all: the
// checklist is the artifact, and CI has to be able to run THESE steps against a
// jsdom document without loading Swup, the Retell SDK or the orb.
//
// ── WHAT CHANGED BETWEEN A0.3 AND HERE, AND WHY ──────────────────────────────
// A0.3 was written against the Option-B swap model of the day: `js/perch-router.js`
// replacing `document.body.innerHTML`. A0.1 (#66) then narrowed the swap region to
// `<main id="perch-main">`, which moves three of the eleven rows from RE-INIT to
// SURVIVES. Those rows are not skipped here on a reading of the prose — they were
// re-measured by running the real A0.1 pipeline over all 143 documents and asking
// jsdom which side of the container each binding target landed on:
//
//   §5.3  site nav (.hamburger, .dropdown, .btn-close.menu, #theFirm,
//         #thePractice, #btn-tf, #btn-tp, nav.menubar, .nav-mobile-overlay)
//         → 0 inside the container, 1094 outside, across 96 interceptable pages.
//         The swap cannot destroy them, so re-running js/main.js would not be a
//         re-init: it would be a second binding of a document-level listener and
//         a second members-gate loader. Step 3 is therefore a GUARD, not a
//         re-bind — if a future page shape ever puts the nav inside the
//         container, it says so out loud instead of silently going dead.
//
//   §3.1  .img-hover / .mobile-hover / .cmm-logo-hover / a.marker / .pin-popup
//         → those selectors match ZERO elements in the shipped tree. js/main.js
//         still binds them; nothing has carried those classes for as long as this
//         repo has existed. Reported here rather than re-run.
//
// ── §5.7 / §5.8, AND WHY THEY ARE NOT THIS FILE'S WORK ───────────────────────
// Re-handing the call id and re-delivering prefill are the booking control
// channel. #52 reported them `deferred` to Phase 3; A31 (#56) built that phase,
// and they are now marked `covered` — but the code that covers them is
// js/perch/call.js driving js/perch/booking-control.js, not anything here. The
// router's contribution to both is the EVENT_SWAPPED dispatch it already made.
// The rows stay in the checklist, with their new owner named, because a checklist
// that omits a row it did not do itself is how the A0.3 prose drifted from the
// code in the first place.
//
// ── §5.12, ADDED AFTER A0.3 (JORDAN-PERCH-A23, #53) ──────────────────────────
// A0.3 inventoried what the swap DESTROYS. Turnstile is the one binding it also
// STRANDS: the challenge is minted into a node the swap replaces, and the widget
// id that the booking write reads lives in a closure that has no way to know the
// render failed. Row 12 is that repair. It is a new row rather than a change to
// row 5 because row 5 is container discovery — it says nothing about whether the
// challenge inside the container is alive.
//
// ── §5.1 WIDENED FROM TWO ROWS TO SIX (JORDAN-198-SYNCHEAD-HEADSYNC-R1, #198) ─
// The swap is scoped to `main#perch-main`, so the HEAD is not swapped at all —
// and until #198 this step reconciled exactly two things out of it, `document.
// title` and `link[rel=canonical]`. Everything else in the incoming head was
// simply discarded, which means that after a soft navigation the visitor was
// looking at page B's body under page A's head. Measured over the shipped tree
// (99 interceptable pages, `scan-head-provenance.mjs`, reproduced by the tests
// below):
//
//   • 96 pages author a head `<style>` block and 9 of them have NO stylesheet
//     link at all — 404, and the eight controversy-roadmap posts, are styled by
//     that block and nothing else. Soft-navigate into one and it painted with
//     the PREVIOUS page's CSS: unstyled, in production, for anyone browsing.
//   • 90 pages author `link[rel=stylesheet]` (531 links) — dropped the same way.
//   • 98 pages author `meta[name=description]` and 95 author `og:` properties:
//     both persisted STALE, so a share or a crawl of B described A.
//   • 10 interceptable pages author `meta[name=robots]`, 9 of them `noindex`
//     (/book, /about-membership, the gated tool pages — the census was taken
//     when /login was one of them; JORDAN-196-LOGIN-SIGNOUT-R1 retired it). The value did
//     not update in either direction, which is a defect with TWO faces: arrive
//     on a gated page and it was indexable, leave it and `noindex` was stranded
//     on a page that is in sitemap.xml (CLAUDE.md §3 rule 6).
//
// ── THE SAFETY PREMISE, MEASURED RATHER THAN ASSUMED ─────────────────────────
// Swapping a head element is only safe if the element belongs to the PAGE. Run
// the real edge pipeline (`planFromHtml` + `injectHandlers` + `layerHandlers`
// carrying the router/bar `extraTags`, exactly as functions/_middleware.js:314
// composes it) over all 147 shipped documents and diff the head against the raw
// file, and the edge's entire head contribution is:
//
//     /css/perch-layer.css      145 pages   (perch-layer-inject.js)
//     /css/dl-utility-bar.css   145 pages   (utility-bar-inject.js, via extraTags)
//     <style> blocks              0 pages
//     meta description/og/robots  0 pages
//
// So every head `<style>`, every OTHER stylesheet link and every one of those
// metas is page-authored, and the two shell sheets are the only shared rows.
// They need no special case in the ordinary path — Swup fetches the incoming
// document over HTTP, so it streams through the SAME middleware and carries
// both — but they are protected explicitly below anyway, because "the incoming
// document always has them" is a premise about a network response and this
// function must not strip the layer's styling if it is ever wrong.
//
// ── WHY <style> AND <link rel=stylesheet> ARE ONE ORDERED GROUP ──────────────
// Cascade order is behaviour, not cosmetics. In the RAW files every head
// `<style>` follows every stylesheet link (0 of 99 pages interleave them), but
// the edge appends its two sheets at the END of head — after those style blocks
// — precisely so the layer's rules win at equal specificity
// (perch-layer-inject.js:63-69). Reconciling the two classes independently and
// re-grouping them would hoist the shell sheets above the page's `<style>`, and
// a page rule would start beating the layer. So they are reconciled as ONE
// ordered group in the incoming document's own order, which is what makes the
// result byte-for-byte the cascade of a DIRECT load of B.
//
// ── WHY NOTHING HERE TOUCHES A SCRIPT ────────────────────────────────────────
// Script adoption is swap-policy.js's allow-list and re-executing a tag per swap
// is the beacon/GA defect this repo forbids (§5.9, swap-policy.js DENY_SCRIPTS).
// This step never selects a `<script>`: `headClass()` below returns null for
// every tag that is not `style`, `link[rel~=stylesheet]` or one of the three
// metas, so a script is not read, not cloned and not moved. That is enforced by
// construction rather than by filtering, and asserted in CI.
//
// ── AND WHY IT NEEDS NO CSP HANDLING ─────────────────────────────────────────
// The per-request nonce (functions/_middleware.js) is stamped onto INLINE SCRIPTS
// and nothing else, and `style-src 'self' 'unsafe-inline'` (:135) carries no
// nonce source at all — so a page-authored `<style>` is admitted on its own terms
// and a cloned one survives this trip unchanged. No shipped head element carries
// such an attribute (one prose mention in book.html, zero real ones), so there is
// nothing here to read, strip, copy or forge, and §T4.1 in
// test/perch-cutover-security.test.mjs holds this whole path to that. If
// `style-src` is ever tightened to a nonce source, THIS is the function that
// stops working and this paragraph is the reason why.

import { CONTAINER_ID } from './placement.js';

/** One row of the §5 checklist, as executed. */
function row(step, name, status, detail) {
  return { step, name, status, detail: detail || null };
}

/**
 * The stylesheet links the EDGE writes into every container page's head, which
 * are therefore the only head rows below that are NOT page-authored.
 *
 * Spelled as literals rather than imported: `functions/_lib/*` is Pages Function
 * code that is never served to a browser, and importing it from a module the
 * document loads would be a broken import in production. Drift is prevented in
 * CI instead — test/perch-swup-router.test.mjs asserts this array equals
 * `[LAYER_STYLESHEET, BAR_STYLESHEET]` read from the real edge modules, so
 * renaming either asset reds the build rather than silently un-protecting it.
 */
export const SHELL_STYLESHEETS = Object.freeze(['/css/perch-layer.css', '/css/dl-utility-bar.css']);

/** The five reconciled classes. `css` is `<style>` + `link[rel=stylesheet]` — see the header. */
const HEAD_CLASSES = ['css', 'description', 'og', 'robots'];

/**
 * Which reconciled class this head element belongs to, or null for everything
 * else — which is every `<script>`, the canonical link, `<title>`, charset,
 * viewport, preloads, icons and any meta this ticket does not name.
 *
 * Attribute values are lower-cased here rather than matched with a `[rel~="x" i]`
 * selector: the case-insensitive attribute flag is a selector-engine feature and
 * this has to behave identically in jsdom and in every browser.
 */
function headClass(el) {
  const tag = el && el.tagName ? el.tagName.toLowerCase() : '';
  if (tag === 'style') return 'css';
  if (tag === 'link') {
    const rel = (el.getAttribute('rel') || '').toLowerCase().split(/\s+/);
    return rel.indexOf('stylesheet') !== -1 ? 'css' : null;
  }
  if (tag === 'meta') {
    const name = (el.getAttribute('name') || '').toLowerCase();
    if (name === 'description') return 'description';
    if (name === 'robots') return 'robots';
    const prop = (el.getAttribute('property') || '').toLowerCase();
    if (prop.indexOf('og:') === 0) return 'og';
  }
  return null;
}

/**
 * Identity WITHIN a class. Two elements with the same signature are the same row,
 * so the live one is kept rather than replaced — which is what stops a swap from
 * re-fetching a stylesheet the document already has, and what makes a repeated
 * swap a no-op instead of a re-paint.
 */
function headSig(el) {
  const tag = el.tagName.toLowerCase();
  const a = (n) => el.getAttribute(n) || '';
  if (tag === 'style') return 'style ' + a('media') + ' ' + (el.textContent || '');
  if (tag === 'link') return 'link ' + a('href') + ' ' + a('media');
  return 'meta ' + a('name') + ' ' + a('property') + ' ' + a('content');
}

/** Is this live node one of the edge-injected shell sheets? */
function isShellSheet(el) {
  if (!el.tagName || el.tagName.toLowerCase() !== 'link') return false;
  const href = el.getAttribute('href') || '';
  // Compared on PATH, so an absolute, origin-relative or `?v=`-busted spelling of
  // the same shell asset is still recognised as the shell asset.
  let path = href;
  try { path = new URL(href, 'https://donovan.law.invalid/').pathname; } catch (e) { /* an unparseable href is compared raw */ }
  return SHELL_STYLESHEETS.indexOf(path) !== -1;
}

/**
 * Every managed element in a head, in document order.
 *
 * `head.children` rather than a querySelectorAll: head elements are always direct
 * children of `<head>`, and walking the children means the selector engine is
 * never asked a question whose answer could differ between jsdom and a browser.
 */
function managed(head) {
  const out = [];
  const kids = head.children;
  for (let i = 0; i < kids.length; i++) if (headClass(kids[i]) && !isRuntimeOwned(kids[i])) out.push(kids[i]);
  return out;
}

/**
 * A head element some SCRIPT in the live document created, as opposed to one
 * the page authored or the edge injected. Never reconciled: the incoming
 * document cannot declare it, so treating it as managed removes it on every
 * swap while the element it styles -- appended to <body> OUTSIDE the container
 * -- survives. That is exactly what happened in production: the consent banner
 * (js/analytics/consent-banner.js, `<style id="dl-consent-style">`) and the
 * floating booking widget both painted unstyled after the first soft navigation.
 *
 * Two signals, either one suffices:
 *   • a `<style>` that carries an id. No shipped page authors one (0 of 147,
 *     and the CI census in perch-swup-router.test.mjs would say if one did);
 *     a runtime-created block is given one so it can find itself again.
 *   • the explicit opt-out `data-dl-persist`, for any <link>/<style> a module
 *     inserts and wants left alone.
 */
function isRuntimeOwned(el) {
  if (el.hasAttribute('data-dl-persist')) return true;
  return el.tagName.toLowerCase() === 'style' && !!(el.getAttribute('id') || '').trim();
}

/** A fresh per-class tally. */
function tally() {
  const out = {};
  for (const cls of HEAD_CLASSES) out[cls] = { added: 0, removed: 0, kept: 0, errors: [] };
  return out;
}

/**
 * Reconcile the five managed classes of the live head against the incoming head:
 * add what the incoming page declares and this document lacks, keep what both
 * declare, remove what the incoming page does not declare. The same reconcile
 * shape canonical already used, generalised from one element to an ordered list.
 *
 * ── WHY ALL FIVE ARE ONE ORDERED GROUP AND NOT FIVE INDEPENDENT ONES ─────────
 * Reconciling each class in its own slot leaves every class individually correct
 * and the classes interleaved differently from a direct load — the description
 * ends up after the stylesheets, the og block ahead of them, and so on. Nothing
 * reads those by position, so it is not a live defect; but it means "the head
 * after a swap equals the head of a direct load" is NOT a property that can be
 * asserted, and an approximate invariant is one no future change can be measured
 * against. Managing the five as a single ordered group makes the relative order
 * of every managed element identical to a direct load of B, which is exactly the
 * assertion the tests make. It also happens to be the simpler code.
 *
 * Four properties, each of which is a test below:
 *   • IDEMPOTENT. Reuse is by signature, so running this twice over the same pair
 *     of documents matches every row to a live node the second time: nothing is
 *     created, nothing is removed and — because placement only moves a node that
 *     is out of position — nothing is even moved. That is not a nicety: the
 *     router calls syncHead() directly at perch-swup-router.js:248 and then again
 *     inside reinit() at :252, so EVERY swap already runs this function twice.
 *   • ORDER-FAITHFUL, per the paragraph above.
 *   • SHELL-SAFE. A live shell stylesheet is never removed, even if the incoming
 *     document somehow does not declare it.
 *   • GRANULAR. Every DOM operation is individually try/caught and attributed to
 *     its class, so one dead element cannot cost the other four classes — or the
 *     page. On the 9 pages whose ONLY styling is a head `<style>`, the row this
 *     repairs is the row that would take the page down with it.
 */
function reconcileHead(doc, liveHead, incomingHead) {
  const stats = tally();
  const have = managed(liveHead);
  const incoming = managed(incomingHead);

  // A page that declares the same STYLESHEET twice gets it once — a duplicate
  // link is a page bug, and importing it would make it this function's bug. A
  // `<style>` block is never collapsed: two identical blocks are still two
  // authored blocks, and tools.html is the page that ships two of them.
  const seen = Object.create(null);
  const wanted = [];
  for (const el of incoming) {
    if (el.tagName.toLowerCase() === 'link') {
      const s = headSig(el);
      if (seen[s]) continue;
      seen[s] = true;
    }
    wanted.push(el);
  }

  // Live nodes, bucketed by signature, so an incoming row can claim one.
  const pool = new Map();
  for (const el of have) {
    const s = headSig(el);
    if (!pool.has(s)) pool.set(s, []);
    pool.get(s).push(el);
  }

  const kept = new Set();
  const want = [];
  for (const el of wanted) {
    const cls = headClass(el);
    try {
      const bucket = pool.get(headSig(el));
      if (bucket && bucket.length) {
        const node = bucket.shift();
        kept.add(node);
        want.push(node);
        stats[cls].kept++;
        continue;
      }
      // importNode carries the whole element — a <style>'s CSS text, a <link>'s
      // href/media/crossorigin/integrity — rather than a hand-copied subset that
      // would silently drop the attribute nobody thought of.
      const node = doc.importNode(el, true);
      want.push(node);
      stats[cls].added++;
    } catch (e) {
      stats[cls].errors.push(String(e));
    }
  }

  // SHELL-SAFE: keep an edge-injected sheet the incoming document did not declare,
  // at the tail, which is where the edge puts it. In the ordinary swap this loop
  // does nothing — the incoming document carries both sheets and they were reused
  // above — and that is the point: it only fires if the premise fails.
  for (const el of have) {
    if (kept.has(el) || !isShellSheet(el)) continue;
    kept.add(el);
    want.push(el);
    stats.css.kept++;
  }

  for (const el of have) {
    if (kept.has(el)) continue;
    const cls = headClass(el);
    try {
      el.remove();
      stats[cls].removed++;
    } catch (e) {
      stats[cls].errors.push(String(e));
    }
  }

  // Placement. Everything is inserted before a marker, and the marker goes just
  // AFTER the managed group's last surviving member — not before its first. That
  // is the difference between an idempotent reconcile and one that re-inserts
  // every node on every swap: the walk below steps backwards from the marker, so
  // a group that is already in the right order is already sitting immediately
  // before it and nothing moves. Anchoring at the head of the group instead makes
  // `nextSibling === ref` false for every node, and a settled head gets rebuilt —
  // eight DOM moves, and eight stylesheet re-applications, per navigation.
  let moved = 0;
  if (want.length) {
    const survivors = managed(liveHead);
    const last = survivors.length ? survivors[survivors.length - 1] : null;
    const marker = doc.createComment('');
    liveHead.insertBefore(marker, last ? last.nextSibling : null);
    // Walked BACKWARDS with a trailing reference: a node already sitting where it
    // belongs is stepped over rather than re-inserted. Re-inserting a <link> makes
    // the browser drop and re-apply the sheet, so an unconditional rebuild would
    // flash the page on every swap — including the swaps that change nothing.
    let ref = marker;
    for (let i = want.length - 1; i >= 0; i--) {
      const node = want[i];
      try {
        if (node.parentNode === liveHead && node.nextSibling === ref) { ref = node; continue; }
        liveHead.insertBefore(node, ref);
        ref = node;
        moved++;
      } catch (e) {
        stats[headClass(node) || 'css'].errors.push(String(e));
      }
    }
    marker.remove();
  }

  stats.moved = moved;
  stats.total = want.length;
  return stats;
}

/**
 * §5.1 — the incoming page's head, reconciled into the live one.
 *
 * `document.title` and `link[rel=canonical]` first and unchanged: they are done
 * BEFORE the GA4 page_view stub (§5.11) so that, when the measurement id lands,
 * the event carries the new page's identity rather than the previous one's.
 *
 * Then the five classes #198 adds — style blocks, `meta[name=description]`,
 * every `meta[property^=og:]`, `meta[name=robots]` and `link[rel=stylesheet]`.
 * Every one of them is INDEPENDENTLY try/caught, and so are the two original
 * rows: a head is the one place where a single bad element could otherwise take
 * the whole recipe — and with it the page — down, and the row this function
 * exists to repair is the row on the pages with no other styling at all.
 */
export function syncHead(doc, incomingDoc) {
  const detail = { title: null, canonical: null, head: null };
  if (!incomingDoc) return row(1, 'head sync', 'skipped', detail);
  const errors = [];

  try {
    const incomingTitle = incomingDoc.title;
    if (incomingTitle && doc.title !== incomingTitle) {
      doc.title = incomingTitle;
      detail.title = incomingTitle;
    }
  } catch (e) { errors.push('title: ' + String(e)); }

  try {
    const from = incomingDoc.querySelector('link[rel="canonical"]');
    const to = doc.querySelector('link[rel="canonical"]');
    const href = from && from.getAttribute('href');
    if (href) {
      if (to) {
        if (to.getAttribute('href') !== href) { to.setAttribute('href', href); detail.canonical = href; }
      } else {
        const link = doc.createElement('link');
        link.setAttribute('rel', 'canonical');
        link.setAttribute('href', href);
        doc.head.appendChild(link);
        detail.canonical = href;
      }
    } else if (to) {
      // The incoming page declares no canonical; leaving the previous page's would
      // be worse than having none.
      to.remove();
      detail.canonical = null;
    }
  } catch (e) { errors.push('canonical: ' + String(e)); }

  const liveHead = doc && doc.head;
  const incomingHead = incomingDoc.head;
  if (liveHead && incomingHead) {
    try {
      const stats = reconcileHead(doc, liveHead, incomingHead);
      detail.head = stats;
      for (const cls of HEAD_CLASSES) {
        for (const e of stats[cls].errors) errors.push(cls + ': ' + e);
      }
    } catch (e) {
      // The outer net. Nothing above should reach it — every DOM call inside
      // reconcileHead is already caught and attributed — but a head sync that
      // threw here would take the rest of the §5 recipe down with it, and the
      // pages this row repairs are the ones with no other styling to fall back on.
      errors.push('head: ' + String(e));
    }
  }

  if (errors.length) detail.errors = errors;
  return row(1, 'head sync', errors.length ? 'error' : 'ok', detail);
}

/**
 * §5.3 / §5.4 — the site nav.
 *
 * A guard, not a re-bind. See the header. Returns `ok` when the nav is where A0.1
 * puts it and `broken` when a page shape has moved it inside the swap region,
 * which is the only condition under which this row would need real work.
 */
export function checkNav(doc) {
  const container = doc.getElementById(CONTAINER_ID);
  const NAV_TARGETS = [
    'nav.menubar', '.hamburger', '.btn-close.menu', '.dropdown',
    '#theFirm', '#thePractice', '#btn-tf', '#btn-tp', '.nav-mobile-overlay',
  ];
  const inside = [];
  let total = 0;
  for (const sel of NAV_TARGETS) {
    for (const el of doc.querySelectorAll(sel)) {
      total++;
      if (container && container.contains(el)) inside.push(sel);
    }
  }
  return row(3, 'site nav outside the container', inside.length ? 'broken' : 'ok', {
    targets: total,
    inside: [...new Set(inside)],
  });
}

/**
 * §5.5 — re-run the booking widget's boot().
 *
 * Idempotent by construction: boot() skips any container already carrying
 * [data-api-init] and injectStyles() guards on #dl-booking-styles
 * (js/booking-widget.js:1740-1751, :239-243), so calling it on every swap —
 * including swaps to pages with no widget — is safe and is exactly what
 * RE-INIT-INVENTORY §3.2 prescribes.
 *
 * The seam is DLBooking.boot(), published on the widget's existing public control
 * surface. The router does not reach into the widget's closure and does not
 * create a global of its own.
 */
export function bootBookingWidget(win) {
  const api = win && win.DLBooking;
  if (!api || typeof api.boot !== 'function') {
    return row(5, 'booking widget boot()', 'absent', { reason: 'js/booking-widget.js not loaded on this page' });
  }
  try {
    api.boot();
    return row(5, 'booking widget boot()', 'ok', null);
  } catch (e) {
    return row(5, 'booking widget boot()', 'error', { error: String(e) });
  }
}

/**
 * §5.12 — the Turnstile widget on the booking form (JORDAN-PERCH-A23, #53).
 *
 * ── THE DEFECT ───────────────────────────────────────────────────────────────
 * `#dl-bk-turnstile` is minted by the booking widget's FORM step, so after a
 * swap it is always a DOM node the previous generation's Turnstile registry has
 * never seen. The widget's own `mountTurnstile` (js/booking-widget.js:1228-1237)
 * retries only while `window.turnstile` is ABSENT — if `render()` THROWS, the
 * catch swallows it, `_tsWidgetId` stays null and NOTHING tries again. The form
 * still submits; `turnstile_token` goes out empty; /booking/create answers 403
 * TURNSTILE_REQUIRED and the caller sees a generic error. Silent, and invisible
 * to a clean console. Reproduced in test/perch-swup-router.test.mjs.
 *
 * ── WHY THIS CALLS IN INSTEAD OF RENDERING ───────────────────────────────────
 * The write path reads the token as `getResponse(_tsWidgetId)` and `_tsWidgetId`
 * lives in the widget's closure. A widget rendered from HERE would paint a real
 * challenge whose id nobody holds — the token would still be empty and the
 * booking would still 403. So this step drives `DLBooking.remountTurnstile()`,
 * the widget's published seam, which captures the id. The write path itself is
 * untouched by this ticket.
 *
 * ── THE TWO NO-OPS, WHICH ARE THE POINT ──────────────────────────────────────
 *   • A page with no Turnstile-protected form never reaches `window.turnstile`
 *     at all: the gate below is a container query, evaluated before anything
 *     else is read. On 95 of the 96 interceptable pages this step is a pure
 *     `absent` row that touches no DOM.
 *   • A mount that already carries a LIVE widget is `reset()`, not rendered a
 *     second time — the double-render guard, enforced inside the seam where
 *     `_tsWidgetId` can actually be consulted.
 *
 * `no_mount` is the ordinary case at swap time and is reported as `deferred`,
 * not as a failure: a freshly-booted widget sits at TYPE_PICK, so there is no
 * mount point yet and the widget's own render will run when the caller reaches
 * the form. This step covers the swaps where a form IS already on screen —
 * Paula driving selectType/selectSlot into the swapped-in widget (A31, #56) —
 * and repairs the render-threw state the widget cannot recover from itself.
 */
export function renderTurnstile(doc, win) {
  const container = doc.getElementById(CONTAINER_ID) || doc;

  // The gate. A "Turnstile-protected form" on this site means the booking
  // widget's host container, or an already-painted mount point. Queried against
  // the SWAPPED-IN container only — a booking form outside it is not something
  // this swap can have replaced.
  const host = container.querySelector('[data-api], #dl-booking');
  const mount = container.querySelector('#dl-bk-turnstile');
  if (!host && !mount) {
    return row(12, 'turnstile re-render', 'absent', {
      reason: 'no Turnstile-protected form in the swapped-in container',
    });
  }

  const api = win && win.DLBooking;
  if (!api || typeof api.remountTurnstile !== 'function') {
    return row(12, 'turnstile re-render', 'absent', {
      reason: 'js/booking-widget.js not loaded on this page — no seam to call',
    });
  }

  // Reported, never repaired here: adoption is awaited before this recipe runs,
  // so a missing window.turnstile means the api.js fetch failed. Re-inserting
  // the tag is the router's job (swap-policy ADOPT), not this step's.
  const ts = win.turnstile;
  if (!ts || typeof ts.render !== 'function') {
    return row(12, 'turnstile re-render', 'pending', {
      reason: 'window.turnstile absent — challenges.cloudflare.com/turnstile/v0/api.js has not executed on this document',
      mountPresent: !!mount,
    });
  }

  try {
    const res = api.remountTurnstile() || { ok: false, reason: 'no_result' };
    if (res.ok) {
      return row(12, 'turnstile re-render', 'ok', {
        action: res.action, // 'render' on a fresh node, 'reset' on a live one
        widgetId: res.id == null ? null : String(res.id),
      });
    }
    // The widget is booted but sits before the FORM step. Expected on most
    // swaps into /book; the widget renders for itself when the form paints.
    if (res.reason === 'no_mount') {
      return row(12, 'turnstile re-render', 'deferred', {
        reason: 'widget is not at the FORM step yet — its own mount runs when the form paints',
      });
    }
    return row(12, 'turnstile re-render', 'broken', res);
  } catch (e) {
    return row(12, 'turnstile re-render', 'error', { error: String(e) });
  }
}

/**
 * §5.10 — tool calculators.
 *
 * Two mechanisms, and only one of them needs anything done:
 *
 *   • Dispatch — `data-dvn-do` / `data-dvn-on` are delegated on `document`
 *     (js/inline-actions.js:167-170), so the calculators keep working on markup
 *     the swap has only just inserted. The A2.5 spike measured this directly: on
 *     a RETURN visit to /tool-capital-gains the calculator still produced a real
 *     result.
 *
 *   • Per-element input formatting — js/page/input-formatter.js binds focus/blur/
 *     input listeners per element at load and nothing re-runs it. That is spike
 *     finding F2: the same return visit that still computed correctly had lost
 *     comma formatting on #ord_income and #ltcg. `attachAll(root)` is the file's
 *     own public re-entry point (js/page/input-formatter.js:145) and is guarded
 *     per element by `_dlFmtAttached`, so re-calling it costs nothing on inputs
 *     that are already attached.
 *
 * Scoped to the container: the only inputs a swap can have replaced are the ones
 * inside it.
 */
export function reattachInputFormatter(doc, win) {
  const fmt = win && win.DonovanInputFormatter;
  if (!fmt || typeof fmt.attachAll !== 'function') {
    return row(10, 'input formatter re-attach', 'absent', { reason: 'js/page/input-formatter.js not loaded on this page' });
  }
  const root = doc.getElementById(CONTAINER_ID) || doc;
  try {
    fmt.attachAll(root);
    return row(10, 'input formatter re-attach', 'ok', {
      currency: root.querySelectorAll('input.dl-currency').length,
      percent: root.querySelectorAll('input.dl-percent').length,
    });
  } catch (e) {
    return row(10, 'input formatter re-attach', 'error', { error: String(e) });
  }
}

/**
 * §5.9 — the Vantage beacon: notify, never re-load.
 *
 * The beacon (`https://vantage.ticoai.net/perch.js`, on 140 pages) hooks
 * `history.pushState` on load and reports each push to `/visit`. Swup pushes
 * state for every soft navigation, so the beacon is notified for free — and the
 * router's job is the negative one: never re-execute the tag. That is enforced in
 * swap-policy.js (DENY_SCRIPTS) and asserted in CI.
 *
 * This step therefore verifies rather than acts. `history.pushState` being a
 * non-native function is the observable signature of the beacon's hook being
 * installed; on a page where the beacon 503'd or was blocked it is native, which
 * is reported, not repaired.
 */
export function checkBeacon(win) {
  let hooked = null;
  try {
    hooked = !/\{\s*\[native code\]\s*\}/.test(String(win.history.pushState));
  } catch (e) {
    hooked = null;
  }
  return row(9, 'vantage beacon: pushState only', 'ok', {
    pushStateHooked: hooked,
    reloaded: false, // structurally impossible: the tag is on the deny list
  });
}

/**
 * §5.11 — manual GA4 `page_view`. **STUB, PENDING AN EXTERNAL MEASUREMENT ID.**
 *
 * There is no GA4 tag on this site. A0.3 §3.8 established that from the code — a
 * repo-wide grep for `gtag(`, `googletagmanager`, `dataLayer`, `G-…` and `AW-`
 * returns zero hits in any shipped page or script — and HANDOFF.md:120 lists the
 * `G-` measurement id as an outstanding EXTERNAL blocker: it has to be created
 * under a firm Google account. Ticket #52 asks for the manual page_view per swap;
 * this order scopes it to a documented stub for exactly that reason.
 *
 * What this function does today: nothing, and it says so in its return value.
 * What the person wiring the tag has to do, so the requirement is not re-derived
 * from scratch six months from now:
 *
 *   1. Install GA4 with AUTOMATIC page-view measurement DISABLED
 *      (`gtag('config', 'G-…', { send_page_view: false })`). A client-side swap
 *      fires no page_view of its own, and leaving automatic measurement on gives
 *      one page_view per document LOAD — i.e. one per session under this router.
 *   2. Call this function after syncHead() — the event must carry the NEW page's
 *      title and location, which is why §5.1 is step 1 and this is step 11.
 *   3. Send exactly:
 *        gtag('event', 'page_view', {
 *          page_location: win.location.href,
 *          page_title: doc.title,
 *        });
 *   4. The tag itself must go in the shell/head as an external script. It must
 *      NOT be added to swap-policy.js's ADOPT list: re-executing an analytics tag
 *      per swap is the same defect as re-executing the Vantage beacon (§5.9).
 *
 * The `gtag` lookup is deliberate — when the tag lands, this stub starts working
 * with no further edit, and until then it reports `pending` on every swap.
 */
export function gaPageView(doc, win) {
  const gtag = win && win.gtag;
  if (typeof gtag !== 'function') {
    return row(11, 'GA4 manual page_view', 'pending', {
      reason: 'no GA4 tag on this site — the G- measurement id is an external blocker (HANDOFF.md:120, A0.3 §3.8)',
    });
  }
  try {
    gtag('event', 'page_view', { page_location: win.location.href, page_title: doc.title });
    return row(11, 'GA4 manual page_view', 'ok', { page_location: win.location.href });
  } catch (e) {
    return row(11, 'GA4 manual page_view', 'error', { error: String(e) });
  }
}

/**
 * Rows this router deliberately does not execute, carried so the checklist is
 * complete rather than convenient.
 */
export function deferredRows() {
  return [
    row(2, 're-execute page scripts', 'replaced', {
      by: 'the swap-policy.js adoption allow-list — an allow-list of external files, never a re-execution of the incoming markup',
    }),
    row(4, 'delegated handlers (bootstrap data-api, inline-actions, members-gate, tel/mailto escape)', 'survives', {
      why: 'all bound on `document`',
    }),
    row(6, '/book unlock gate', 'covered', {
      by: 'js/page/booking-gate.js registered through DL.ready; it re-runs on the dl:content-swapped event this router dispatches',
    }),
    // A31 (#56) closed these two. They were `deferred` under #52 because the
    // booking control channel had no executor in a top-level document; it has one
    // now. Both are still driven from js/perch/call.js — `set_call_id` from its
    // host.onContentReady handler (:123), prefill from deliverPrefill (:83) — and
    // the router's contribution is unchanged: dispatch EVENT_SWAPPED, which is
    // what both of those hang off. What changed is the far end of host.drive(),
    // which now reaches the widget's published API instead of an unobserved
    // postMessage. Reported here rather than removed, because the checklist is
    // the artifact and a row that quietly disappears is how prose drifts.
    row(7, 're-hand the call id (set_call_id)', 'covered', {
      by: 'js/perch/call.js re-hands it on the EVENT_SWAPPED this router dispatches; js/perch/booking-control.js applies it directly to window.__perchCallId (A31, #56)',
    }),
    row(8, 're-deliver prefill', 'covered', {
      by: 'js/perch/call.js deliverPrefill() re-fires on the same event; js/perch/booking-control.js calls DLBooking.prefill and acks so the retry loop still terminates (A31, #56)',
    }),
  ];
}

/**
 * Run the whole §5 recipe. Returns the checklist as executed, which is what the
 * Preview verifier asserts against and what the router keeps for telemetry.
 *
 * Every step is independently try/caught by construction: one dead row must not
 * take the rest of the recipe — or the page — down with it.
 */
export function reinit(doc, win, incomingDoc) {
  const rows = [
    syncHead(doc, incomingDoc),
    ...deferredRows().filter((r) => r.step === 2 || r.step === 4),
    checkNav(doc),
    bootBookingWidget(win),
    ...deferredRows().filter((r) => r.step === 6 || r.step === 7 || r.step === 8),
    checkBeacon(win),
    reattachInputFormatter(doc, win),
    gaPageView(doc, win),
    // Step 12 last in execution as well as in the sort: it drives a seam on the
    // widget that step 5 is what boots.
    renderTurnstile(doc, win),
  ].sort((a, b) => a.step - b.step);

  return {
    rows,
    broken: rows.filter((r) => r.status === 'broken' || r.status === 'error').map((r) => r.name),
  };
}
