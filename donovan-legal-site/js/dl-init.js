// ── DL.ready — run page behaviour at load AND after every content swap ────────
//
// JORDAN-PERCH-A02 (#47, Phase A / Phase 0). Review blockers frontend B1 /
// security B1.
//
// THE DEFECT THIS EXISTS FOR. functions/_middleware.js issues a per-request CSP
// nonce and HTMLRewriter stamps that request's nonce onto every inline <script>
// as the HTML streams past. That is airtight for a full page load and fatal for
// a client-side content swap: when Option B's layer fetches /book and drops the
// fetched markup into the swap container, any inline <script> in that markup
// carries the nonce of the FETCH's response, not the nonce of the CSP the live
// document is running under. The browser refuses it. Silently — a CSP violation
// is a console message, not an exception.
//
// So the booking-gate reveal, which is what decides whether a qualified caller
// can see Paul's calendar at all, would simply never run after a swap. The
// caller would sit looking at "a quick step first" having already done the quick
// step. That is the failure this file is here to make impossible.
//
// (Inserting a <script> via innerHTML never executes it either, nonce or no
// nonce — so this is not a problem a nonce fix could solve. The script has to
// stop living in the swapped markup. That is the whole change.)
//
// THE CONTRACT. Page behaviour is externalised to a .js referenced from <head>,
// loaded once per document, and registered here:
//
//     DL.ready(function () { ... });
//
// The callback runs once when the DOM is ready, and again on every
// `dl:content-swapped` event dispatched on `document`. The swap layer (Option B
// step B.2) dispatches that event after it replaces the container; until it
// exists, only the load path fires and behaviour is exactly what it was inline.
//
// CALLBACKS MUST BE RE-ENTRANT. After a swap the container holds NEW element
// objects, so listeners bound to the old nodes are gone with them — re-binding
// is correct, not a double-bind. A callback that mutates shared state (a global,
// localStorage, a timer) has to tolerate running twice; one that only reads the
// DOM and binds to it does not need to do anything special. A callback whose
// anchor element is absent must return quietly: after a swap to a different page
// every OTHER page's callback still fires, and finding nothing is the normal
// case, not an error.
//
// This file is loaded from <head> WITHOUT defer, so window.DL exists before any
// deferred page script runs. It is deliberately tiny and dependency-free.

(function () {
  'use strict';

  var callbacks = [];

  function run(fn) {
    try {
      fn();
    } catch (e) {
      // One page's broken init must not take the rest of the page down with it —
      // and must not be swallowed either, or a dead reveal looks like a design.
      console.error('[dl-init] callback failed:', e);
    }
  }

  /**
   * Register page behaviour. Runs now (or at DOMContentLoaded if the document is
   * still parsing) and again after every content swap.
   */
  function ready(fn) {
    if (typeof fn !== 'function') return;
    callbacks.push(fn);
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { run(fn); });
    } else {
      run(fn);
    }
  }

  // Fired by the Option B swap layer once the new content is in the container.
  // Everything registered re-runs, in registration order.
  document.addEventListener('dl:content-swapped', function () {
    for (var i = 0; i < callbacks.length; i++) run(callbacks[i]);
  });

  window.DL = window.DL || {};
  window.DL.ready = ready;
})();
