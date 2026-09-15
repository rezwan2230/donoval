// ── SHELDON-PERCH-A22: the Swup router ───────────────────────────────────────
//
// Ticket #52 · Phase A / Phase 2 · Order SHELDON-PERCH-A22-SWUP.
// Depends on A0.1 (#66) the container, A0.2 (#65) the re-init bus, A0.3 (#63) the
// inventory, A2.1 (#74) the persistent layer, and the A2.5 spike verdict (#55).
//
// ── WHAT THIS IS FOR ─────────────────────────────────────────────────────────
// A live Perch call is a WebRTC session and an open microphone. It dies with the
// document that owns it, which is why the site puts all 143 content pages inside
// an <iframe> today and pays for it in URLs, crawlability and scroll position.
// This router replaces the document navigation with a content swap of
// `<main id="perch-main">`, so the call — parked in A2.1's persistent layer,
// outside that container — survives navigation in the same document.
//
// ── THE ONE THING THE SPIKE PROVED THAT THIS FILE EXISTS TO CARRY ────────────
// A0.2's `DL.ready` re-runs page behaviour on every `dl:content-swapped`. That
// works, and it is not enough: it presupposes the page's script is loaded in the
// live document, and across this tree it almost never is. js/dl-init.js is
// referenced by 2 of 143 pages; js/page/booking-gate.js — the reveal that decides
// whether a caller Paula has already qualified can see Paul's calendar — by
// exactly one; js/booking-widget.js by one, from the END OF BODY, which A0.1
// leaves outside the container.
//
// So a swap from /contact into /book replaces the markup and dispatches the
// re-init event into a document where none of that code has ever been loaded.
// Nothing is registered, so nothing re-runs, `#book-live` stays hidden behind a
// gate no code is present to open, and a CSP-clean console says nothing is wrong.
// The event fires into an empty room. (A2.5 spike, F1 / condition C1.)
//
// The answer is the document-level script sync in `adoptScripts()` below — and,
// unlike the spike's version, it adopts from a fixed shell-defined ALLOW-LIST
// (js/perch/swap-policy.js) rather than from whatever the response happens to
// carry. Deny by default.
//
// ── WHAT THIS FILE NEVER DOES ────────────────────────────────────────────────
//   • It never adopts, re-creates, re-nonces or evals an INLINE script. Only
//     `<script src>` on the allow-list, as a fresh element carrying `src` and
//     nothing else. No nonce is read, copied or forged: the CSP admits these by
//     host allow-list, never by nonce, so nothing here needs one.
//   • It never re-executes a script the live document already has.
//   • It never touches the booking WRITE path, the postMessage booking control
//     channel (Phase 3), tier auth or the CSP. No directive changes; no
//     'unsafe-inline'; no 'strict-dynamic'.
//   • It never re-loads the Vantage beacon. RE-INIT-INVENTORY §3.6: notify by
//     pushState, never re-load. Swup's pushState IS the notification.
//
// ── WHERE IT RUNS ────────────────────────────────────────────────────────────
// Injected into <head> by functions/_lib/perch-router-inject.js on the same pages
// A0.1 gives a container to, and only where that injector's environment gate says
// so — Preview by default, production only once PERCH_ROUTER=on is set. It mounts
// only in a top-level browsing context: inside the Perch shell's iframe the shell
// owns navigation, and mounting here too would give the page two routers.

import {
  CONTAINER_SELECTOR, EVENT_CONTENT_SWAPPED, EVENT_SWAPPED,
  excludeReason, scriptKey, planAdoption, sharedChrome,
} from '/js/perch/swap-policy.js';
import { syncHead, reinit } from '/js/perch/reinit.js';
// DR-INSANE-A33 (#58): `registerRouter` replaces `window.Perch.layer.setRouter`,
// and `claim`/`publish` replace `window.Perch = Object.assign(window.Perch || {},
// …)`. Both handshakes are now module-private; neither goes through a window
// property a page script can pre-seed, read or replace.
import { claim, publish, registerRouter } from '/js/perch/surface.js';

/** Vendored Swup 4.9.2, served from 'self'. See the provenance note in the CI test. */
const SWUP_URL = '/js/vendor/swup.umd.js';

/** Rolling telemetry. Read by test/preview/verify-a22.mjs and by anyone debugging. */
const state = {
  ready: false,
  container: CONTAINER_SELECTOR,
  swaps: 0,
  log: [],
  ignored: [],
  errors: [],
};

/**
 * Load an external script and resolve when it has executed.
 *
 * The one script-inserting primitive in this file, used both for Swup itself and
 * for adoption, so the rule is enforced in one place: a FRESH element carrying
 * `src` and nothing else. No nonce, no type, no inline body, no attribute copied
 * from the incoming document.
 *
 * `async = false` makes dynamically inserted scripts execute in insertion order
 * rather than completion order. The awaited chain below would enforce that on its
 * own; both are here because the ordering is load-bearing (js/dl-init.js must be
 * executing before js/page/booking-gate.js runs, or `DL` is undefined and the
 * gate throws on load) and one line of belt is cheaper than one silent race.
 */
function loadScript(doc, url) {
  return new Promise((resolve) => {
    const s = doc.createElement('script');
    s.src = url;
    s.async = false;
    s.onload = () => resolve({ url, ok: true });
    s.onerror = () => {
      // One dead script must not stall the swap — the page is already on screen.
      state.errors.push('script failed to load: ' + url);
      resolve({ url, ok: false });
    };
    doc.head.appendChild(s);
  });
}

/** Absolute hrefs of every external script the live document has already run. */
function loadedScriptHrefs(doc) {
  const have = new Set();
  for (const tag of doc.querySelectorAll('script[src]')) {
    const k = scriptKey(tag.getAttribute('src'), doc.baseURI, doc.location ? doc.location.origin : location.origin);
    if (k) have.add(k.href);
  }
  return have;
}

/**
 * Adopt the incoming page's required external scripts — the step A0.1 + A0.2 do
 * not cover.
 *
 * Head AND end-of-body: `incomingDoc.querySelectorAll('script[src]')` walks the
 * whole document, which is the point. Head-only adoption leaves
 * js/booking-widget.js behind and the reveal shows an empty shell.
 *
 * Every candidate is classified by swap-policy.js and the decision is RECORDED,
 * including the refusals. A swap that quietly drops a page's script is the exact
 * failure this ticket exists to stop, so "denied" has to be visible in the log
 * rather than inferred from a page that does not work.
 *
 * @param {Document} doc the live document
 * @param {Document} incomingDoc the parsed response
 * @param {string} incomingUrl the URL that document came from — relative `src`
 *        attributes resolve against it, NOT against the live location
 */
async function adoptScripts(doc, incomingDoc, incomingUrl) {
  const { queue, decisions } = planAdoption(incomingDoc, {
    incomingUrl: incomingUrl || location.href,
    origin: location.origin,
    loadedHrefs: loadedScriptHrefs(doc),
  });

  // Sequential, in document order. See loadScript() for why this is not merely
  // stylistic.
  for (const item of queue) {
    // eslint-disable-next-line no-await-in-loop
    const res = await loadScript(doc, item.href);
    if (!res.ok) {
      const d = decisions.find((x) => x.src === item.key);
      if (d) d.ok = false;
    }
  }
  return decisions;
}

/**
 * Announce the swap.
 *
 * TWO events, on purpose, because two different contracts are in play and
 * collapsing them would break one of them:
 *   • `dl:content-swapped` — A0.2's re-init bus (js/dl-init.js). Every DL.ready
 *     callback in the document re-runs. Dispatched FIRST so page behaviour is
 *     restored before the checklist inspects the result.
 *   • `perch:content-swapped` — A2.1's contract (js/perch/placement.js
 *     EVENT_SWAPPED). The persistent layer re-asserts its invariant on it, and
 *     the layer's host adapter uses it for afterNavigate/onContentReady.
 *     Dispatched LAST so it observes the finished DOM.
 *
 * ONE-TIME DOUBLE RUN, recorded rather than tolerated silently: on the first
 * arrival of a page type its adopted script executes immediately (readyState is
 * already `complete`) and its DL.ready callback runs once; the event below then
 * runs it a second time. A0.2 makes re-entrancy a hard requirement of every
 * callback and js/page/booking-gate.js is idempotent, so this is correct — but a
 * doubled log line is not a bug and this comment is where that is written down.
 */
function announce(doc, url, phase) {
  doc.dispatchEvent(new CustomEvent(phase === 'a02' ? EVENT_CONTENT_SWAPPED : EVENT_SWAPPED, {
    detail: { url, source: 'perch-swup-router' },
  }));
}

/**
 * May this visit be intercepted?
 *
 * Returning true means "hard-navigate", which is always the SAFE direction: it is
 * exactly the behaviour the site has today.
 */
function shouldIgnore(url, el) {
  // Swup's own default, which overriding this option would otherwise discard.
  if (el && el.closest && el.closest('[data-no-swup]')) {
    state.ignored.push({ url, reason: 'data-no-swup' });
    return true;
  }

  let path;
  try {
    path = new URL(url, location.href).pathname;
  } catch (e) {
    return true; // cannot reason about it → let the browser have it
  }

  const excluded = excludeReason(path);
  if (excluded) {
    state.ignored.push({ url, path, rule: excluded.id, reason: excluded.reason });
    return true;
  }

  // The shared-chrome gate. Evaluated against the LIVE document on every visit —
  // see swap-policy.js for why this bites only on a full load of a chrome-less
  // page, and why hard-navigating from one is a no-op against today's behaviour.
  const chrome = sharedChrome(document, window);
  if (!chrome.ok) {
    state.ignored.push({ url, path, rule: 'no-shared-chrome', reason: 'this document carries no site nav / jQuery to lend the destination', chrome });
    return true;
  }

  return false;
}

function boot() {
  const doc = document;

  // A page with no container has nothing to swap. On perch.html that is also the
  // page that already hosts an orb — A0.1 skips it and this check agrees by
  // construction rather than by a path list.
  if (!doc.querySelector(CONTAINER_SELECTOR)) return;

  const swup = new window.Swup({
    containers: [CONTAINER_SELECTOR],
    // The nav and the persistent layer are outside the container, so there is no
    // page-level transition to wait on and no animation classes to honour.
    animationSelector: false,
    ignoreVisit: (url, args) => shouldIgnore(url, args && args.el),
  });

  swup.hooks.on('content:replace', async (visit) => {
    state.swaps++;
    const entry = { n: state.swaps, to: visit.to && visit.to.url, scripts: [], recipe: null };
    try {
      const incomingDoc = visit.to && visit.to.document;
      // ABSOLUTE, always. `visit.to.url` is Swup's `pathname + search` form, and a
      // relative string cannot be a base URL — `new URL('js/main.js', '/contact')`
      // throws, which would take the whole adoption step down and leave the reveal
      // dead with a swap that otherwise looked fine.
      const incomingUrl = new URL((visit.to && visit.to.url) || location.href, location.href).href;

      // §5.1 first: the title and canonical must already be the new page's before
      // anything downstream reads them (the GA4 stub in particular).
      syncHead(doc, incomingDoc);

      entry.scripts = await adoptScripts(doc, incomingDoc, incomingUrl);
      announce(doc, location.pathname, 'a02');
      entry.recipe = reinit(doc, window, incomingDoc);
      announce(doc, location.pathname, 'a21');
    } catch (e) {
      state.errors.push('swap failed: ' + String(e));
      entry.error = String(e);
    }
    entry.url = location.pathname + location.search;
    state.log.push(entry);
    if (state.log.length > 50) state.log.shift();
  });

  // A2.1 hands agent-driven navigation to whatever router is registered. Until
  // one is, `Perch.layer`'s host adapter falls back to location.assign — correct,
  // but it ends the call, which is the thing this router exists to prevent.
  //
  // A33 (#58): this used to read `window.Perch.layer.setRouter` and call it. That
  // handshake WAS the finding — the same property this file used to register
  // through was writable by any script in the document, so anything could hand
  // the layer a different callback and own every agent-driven navigation. The
  // channel is now a module-private slot: no window property, one registration
  // for the life of the document, and the function is never handed back out.
  const registered = registerRouter((href) => {
    try {
      const path = new URL(href, location.href).pathname;
      if (excludeReason(path)) { location.assign(href); return; }
      swup.navigate(href);
    } catch (e) {
      location.assign(href);
    }
  });
  state.layerRouterRegistered = registered.ok;
  if (!registered.ok) state.errors.push('router not registered: ' + registered.reason);

  state.ready = true;

  // A read-only diagnostic surface, namespaced alongside Perch.layer. The control
  // functions — navigate, adopt, the recipe — stay in this closure; nothing here
  // lets a caller drive the router. Published through the A33 boundary, so the
  // slot is a getter with no setter on a namespace this code owns outright rather
  // than a writable key on whatever object `window.Perch` happened to be.
  const claimed = claim(window);
  if (claimed.ok) {
    const put = publish(window, 'router', {
      probe: () => ({
        ready: state.ready,
        container: state.container,
        swaps: state.swaps,
        layerRouterRegistered: !!state.layerRouterRegistered,
        chrome: sharedChrome(document, window),
        errors: state.errors.slice(),
        ignored: state.ignored.slice(-10),
        log: state.log.slice(-10),
      }),
    });
    if (!put.ok) console.error('[perch-router] router surface not published:', put.reason);
  } else {
    console.error('[perch-router] namespace not claimed:', claimed.reason);
  }
}

async function start() {
  try {
    if (window.top !== window.self) return; // framed → the shell owns navigation
  } catch (e) {
    return; // cross-origin ancestor → treat as framed
  }
  // Already booted. A33 (#58): read the module's own state rather than
  // `window.Perch.router` — a boot guard that depends on a window property is a
  // boot guard a page script can clear, and now that the namespace is
  // fail-closed, a failed claim would leave the old guard permanently false.
  if (state.ready) return;

  try {
    if (typeof window.Swup !== 'function') await loadScript(document, SWUP_URL);
    if (typeof window.Swup !== 'function') {
      state.errors.push('Swup failed to load — navigation stays a full page load');
      return;
    }
    boot();
  } catch (e) {
    // A router that fails to boot must leave a working site behind it: every link
    // on the page is still a link.
    console.error('[perch-router] boot failed', e);
  }
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
