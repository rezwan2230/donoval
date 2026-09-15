// ── jQuery CDN fallback ───────────────────────────────────────────────────────
//
// JORDAN-PERCH-A02 (#47). Externalised from the inline block that sat directly
// after the code.jquery.com tag on 93 pages:
//
//   <script>window.jQuery || document.write('<script src="js/vendor/jquery-3.3.1.min.js"><\/script>')</script>
//
// WHY IT MOVED. js/perch-router.js:30 swaps the page by assigning
// document.body.innerHTML, so the swap container is the whole <body> — this
// block included. Two things follow, and both are fatal:
//
//   1. Under the per-request nonce CSP an inline block that arrives in fetched
//      markup carries the wrong nonce and is refused.
//   2. document.write() AFTER parsing has finished does not append — it opens a
//      new document and blows the existing one away. A swapped-in copy of this
//      block that DID run would destroy the page and the live call with it.
//
// Externalising it removes both. It is also what lets the CI guard in
// test/swap-container.test.mjs be absolute — "no executable inline <script> in
// <body>, no exceptions" — instead of carrying a per-file allow-list, which is
// the kind of carve-out that quietly grows until it means nothing.
//
// WHY THIS FILE IS STILL LOADED FROM THE BODY, NOT THE HEAD. It must execute at
// the parser insertion point, immediately after the CDN tag, so the local copy
// is in place before js/vendor/bootstrap.min.js runs. A classic external script
// with neither `defer` nor `async` is parser-blocking, so document.write() from
// here still writes into the parser stream exactly as the inline version did.
// Adding `defer` here would move the write to after parsing and re-create
// failure mode 2 above. Do not add it.
//
// The router's SKIP list (js/perch-router.js:11) matches /jquery/, so this file
// is not re-executed on a swap — correct: jQuery is already resident by then.
//
// PATH. The old inline copies wrote a DOCUMENT-relative URL, which differed
// between root pages ("js/…") and tier pages ("../js/…") — 93 copies, two
// spellings, one more thing to get wrong at a new directory depth. The literal
// below is root-absolute, so it is correct from every depth with no computation,
// and it matches how the rest of this change references its assets
// (/js/dl-init.js, /js/page/*.js), plus the pre-existing /js/inline-actions.js
// and /js/donovan-widget.js.
//
// It is a hardcoded literal ON PURPOSE. Deriving it from document.currentScript.src
// worked, but it put a runtime-computed value into document.write() — a genuine
// script-injection sink, and one CodeQL rightly flags (js/xss-through-dom). There
// is no reason to compute a constant.

(function () {
  if (window.jQuery) return;

  // Same-origin, parser-time write — the local vendor copy lands ahead of
  // bootstrap.min.js just as it did inline. No interpolation: nothing here is
  // derived from the document, the URL or anything an attacker can reach.
  document.write('<script src="/js/vendor/jquery-3.3.1.min.js"><\/script>');
})();
