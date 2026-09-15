// ── JORDAN-HEADER-UTILITY-BAR: a top utility bar on every page, from one file ──
//
// THE GAP. The site had no header call-to-action at all: the only route to Paul's
// calendar from a cold page was to scroll to the footer, and the only social links
// were down there too. Adding a bar the obvious way means editing the header of
// **143 hand-authored HTML files** — the exact per-page edit SHELDON-PERCH-A01
// spent a whole ticket avoiding, and a 144th page authored next month would miss
// it. So the bar is injected as the HTML streams out, from the SAME HTMLRewriter
// pass and the SAME `plan` that already injects the swap container, the persistent
// layer and the router. One handler, 141 pages, zero page edits.
//
// ── THE PAIRING RULE, EXTENDED ONE MORE TIME ─────────────────────────────────
// `wantsBar` is `plan.kind !== 'skip'`, identical to `wantsLayer` and
// `wantsRouter`, and deliberately NOT a path list. A 'skip' plan is exactly the
// two documents that must not get a bar:
//   • perch.html — the concierge SHELL. It iframes the real site, and the framed
//     page already carries a bar; injecting one here too would render two.
//   • nav-block.html — a nav-only fragment referenced by 0 pages.
// Deriving the gate from the same `plan` object as the other three injections
// means the rule cannot be broken by editing one file and forgetting another.
//
// ── WHERE IT LANDS, AND WHY OUTSIDE THE CONTAINER ────────────────────────────
// Prepended to <body>, so it sits above the site nav in document flow and OUTSIDE
// `main#perch-main`. That placement is load-bearing in two directions:
//   • a Swup swap replaces only the container's content, so a bar inside it would
//     be torn down and rebuilt on every soft navigation — flicker at best, and a
//     lost `:focus` at worst;
//   • it is static (not fixed), so it pushes the page down rather than covering
//     anything. `nav.navbar.menubar` is `position: relative; z-index: 100` and
//     `.dl-callbar` is fixed to the BOTTOM at z-index 100003 — the bar cannot
//     overlap either, which is why it needs no z-index of its own.
//
// ── THE TWO TARGETS ARE NOT STYLE, THEY ARE THE FIX ──────────────────────────
// Every page of this site renders inside the #site iframe on /perch, so an anchor
// with no target navigates the IFRAME:
//
//   • SOCIAL → target="_blank". Swup's own `triggerWillOpenNewWindow()` matches
//     `[download], [target="_blank"]` and nothing else, so _blank is the one
//     target value that provably takes a link out of the router's hands. Without
//     it an off-origin social link opens inside the frame (or is refused by the
//     shell's frame-src) instead of in a new tab. rel="noopener noreferrer"
//     matches the footer block exactly.
//
//   • CTA → target="_top", and nothing else. MEASURED on the Preview, three arms,
//     one attribute rewritten in-page each time, clicked inside the real shell
//     iframe:
//       as shipped        → the TOP window lands on /book, 1346 chars of page
//       target removed    → the top window stays on /perch (the 37-character
//                           concierge shell) and the booking page loads INSIDE
//                           the iframe, sized for an orb
//       so `_top` is the whole fix, and it is not decoration.
//
//     AND WHY THERE IS NO `data-no-swup` ON IT, which is the thing a reader will
//     reach for next. The first draft carried one, on the theory that Swup would
//     otherwise intercept the click (its `triggerWillOpenNewWindow()` matches
//     `[download], [target="_blank"]` and never _top) and swap /book into the
//     frame before the target was ever read. That theory is wrong, and the third
//     control arm proved it: removing `data-no-swup` changed NOTHING in the frame.
//     js/perch-swup-router.js:313 is why —
//
//         if (window.top !== window.self) return; // framed → the shell owns navigation
//
//     the router does not boot inside a frame at all, so there is nothing in the
//     framed context for an opt-out to opt out of. On the UNFRAMED site the
//     attribute does have an effect — it turns a Swup swap into a full page load —
//     but both paths were measured landing on /book with the booking gate present,
//     and a swap into /book is the exact case `js/perch/swap-policy.js` allow-lists
//     `js/page/booking-gate.js` for. So the attribute bought nothing and was
//     removed rather than kept as an unexplained charm. Outside a frame _top is
//     identical to _self, so the unframed site simply navigates.
//
// ── WHY NO INLINE <style> AND NO INLINE <script> ─────────────────────────────
// The middleware issues a per-request nonce CSP. An injected inline block would
// have to carry that request's nonce, which is a live hazard every time this file
// changes. It carries none: the presentation is a stylesheet reference and the
// behaviour is pure CSS (media queries), so `style-src 'self'` admits it as-is,
// no nonce is required and no CSP directive moves. Zero inline injection is a
// stronger property than a correctly-nonced one, so it is the one chosen here.
//
// ── WHY THE STYLESHEET IS ITS OWN FILE AND NOT css/main.css ──────────────────
// 26 of the 141 pages that receive the bar do NOT load css/main.css — the four
// tier areas (gold/platinum/diamond/reserve), the eight controversy-roadmap
// posts, engagement-scoping and 404 are standalone documents with their own
// <style> blocks and no site chrome. A rule placed in main.css would ship an
// UNSTYLED bar on all 26, and injecting main.css into them to compensate would
// repaint documents that deliberately carry their own styling. So the bar's rules
// live in one small dedicated sheet, which is the same shape as
// `perch-layer-inject.js` (LAYER_STYLESHEET) and works on every page regardless
// of what else it loads. css/main.css carries a pointer comment to it.

/** Kept in one place so the CI test can assert what gets injected. */
export const BAR_STYLESHEET = '/css/dl-utility-bar.css';

export const BAR_STYLESHEET_TAG = `<link rel="stylesheet" href="${BAR_STYLESHEET}">`;

/** Where the primary CTA goes. Extensionless — Pages serves book.html at /book. */
export const BOOKING_HREF = '/book';

// ── JORDAN-NOVOICE-FRONTDOOR: the CTA now opens intake before the calendar ───
//
// The bar's CTA was the site's only header route to Paul's calendar, and it went
// straight there — so a visitor arriving that way reached the booking form having
// answered nothing, while a visitor who talked to Paula arrived pre-qualified. Same
// calendar, two very different leads, and the difference was whether the visitor
// happened to want a voice call.
//
// `data-perch-book` marks the anchor as a BOOK INTENT: js/perch-layer.js's one
// delegated listener opens the qualifier card instead, and the completed card
// carries the visitor to the same /book calendar prefilled. The value is the
// trigger label and lands in the lead record's `source`.
//
// ── THE href AND target STAY EXACTLY AS THEY WERE ───────────────────────────
// `href` is the no-JS floor AND the failure floor — the listener calls
// `preventDefault()` only when the card actually opened, so a visitor with JS off,
// or on one of the two documents that get no layer, or hitting a handler that
// threw, still gets the plain link to /book. `target="_top"` is the #108 frame
// escape, measured and load-bearing inside the Perch shell iframe, where the layer
// deliberately does not mount and this attribute is the entire fix. Neither is
// touched, and neither is replaced by the attribute below.
//
// ── WHY THIS IS A LITERAL AND NOT AN IMPORT ─────────────────────────────────
// The obvious move is `import { BOOK_INTENT_ATTR } from '../../js/perch-layer.js'`
// so the producer and the consumer share one spelling. It cannot be done: this file
// is bundled into the Pages FUNCTIONS worker, and that module is a browser module —
// it imports `/js/perch/*.js` by absolute path (unresolvable in the Workers
// bundler) and it BOOTS on import (`if (typeof document !== 'undefined')`). Pulling
// it in would break the build, or ship the persistent layer into the edge runtime.
//
// So the string is written twice and test/perch-novoice-frontdoor.test.mjs reads
// BOTH — this constant and the layer's exported `BOOK_INTENT_ATTR` — and fails if
// they diverge. The drift is caught in CI rather than prevented by the module
// system, which is the same trade `command-channel.js`'s `BOOK_PATH` makes against
// the Function's `ACTION_MAP`.
export const BOOK_INTENT_ATTR = 'data-perch-book';

/** The trigger label this CTA reports as the lead's source. */
export const BOOK_INTENT_SOURCE = 'utility_bar';

const BOOK_INTENT = `${BOOK_INTENT_ATTR}="${BOOK_INTENT_SOURCE}"`;

/**
 * The four social destinations, copied out of the footer .dl-social block.
 *
 * NOT re-fetched or re-derived at runtime: the footer markup is what these mirror,
 * and test/utility-bar.test.mjs asserts every href and every path `d` here is
 * byte-identical to the footer block on index.html. That is what makes "reuse the
 * URLs and inline SVGs from dl-social" a checked claim rather than a comment.
 */
export const SOCIAL = [
  {
    href: 'https://www.facebook.com/people/Donovan-Legal-PLLC/61590654057720/',
    label: 'Donovan Legal PLLC on Facebook',
    title: 'Facebook',
    d: 'M9.101 23.691v-7.98H6.627v-3.667h2.474v-1.58c0-4.085 1.848-5.978 5.858-5.978.401 0 .955.042 1.324.103a8.16 8.16 0 0 1 1.021.215v3.324c-.153-.015-.33-.03-.582-.045a8.98 8.98 0 0 0-.594-.023c-.673 0-1.194.092-1.583.276a1.73 1.73 0 0 0-.786.732c-.179.303-.256.68-.256 1.155v1.821h3.86l-.334 1.847-.335 1.82h-3.191v8.245C19.396 23.238 24 18.179 24 12.044c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.628 3.874 10.35 9.101 11.647z',
  },
  {
    href: 'https://www.tiktok.com/@donovan.legal',
    label: 'Donovan Legal PLLC on TikTok',
    title: 'TikTok',
    d: 'M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z',
  },
  {
    href: 'https://www.instagram.com/donovan_legalpllc',
    label: 'Donovan Legal PLLC on Instagram',
    title: 'Instagram',
    d: 'M12 0C8.74 0 8.333.015 7.053.072 5.775.132 4.905.333 4.14.63c-.789.306-1.459.717-2.126 1.384S.935 3.35.63 4.14C.333 4.905.131 5.775.072 7.053.012 8.333 0 8.74 0 12s.015 3.667.072 4.947c.06 1.277.261 2.148.558 2.913.306.788.717 1.459 1.384 2.126.667.666 1.336 1.079 2.126 1.384.766.296 1.636.499 2.913.558C8.333 23.988 8.74 24 12 24s3.667-.015 4.947-.072c1.277-.06 2.148-.262 2.913-.558.788-.306 1.459-.718 2.126-1.384.666-.667 1.079-1.335 1.384-2.126.296-.765.499-1.636.558-2.913.06-1.28.072-1.687.072-4.947s-.015-3.667-.072-4.947c-.06-1.277-.262-2.149-.558-2.913-.306-.789-.718-1.459-1.384-2.126C21.319 1.347 20.651.935 19.86.63c-.765-.297-1.636-.499-2.913-.558C15.667.012 15.26 0 12 0zm0 2.16c3.203 0 3.585.016 4.85.071 1.17.055 1.805.249 2.227.415.562.217.96.477 1.382.896.419.42.679.819.896 1.381.164.422.36 1.057.413 2.227.057 1.266.07 1.646.07 4.85s-.015 3.585-.074 4.85c-.061 1.17-.256 1.805-.421 2.227a3.81 3.81 0 0 1-.899 1.382 3.744 3.744 0 0 1-1.38.896c-.42.164-1.065.36-2.235.413-1.274.057-1.649.07-4.859.07-3.211 0-3.586-.015-4.859-.074-1.171-.061-1.816-.256-2.236-.421a3.716 3.716 0 0 1-1.379-.899 3.644 3.644 0 0 1-.9-1.38c-.165-.42-.359-1.065-.42-2.235-.045-1.26-.061-1.649-.061-4.844 0-3.196.016-3.586.061-4.861.061-1.17.255-1.814.42-2.234.21-.57.479-.96.9-1.381.419-.419.81-.689 1.379-.898.42-.166 1.051-.361 2.221-.421 1.275-.045 1.65-.06 4.859-.06l.045.03zm0 3.678a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 1 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm7.846-10.405a1.441 1.441 0 0 1-2.881 0 1.441 1.441 0 0 1 2.881 0z',
  },
  {
    href: 'https://www.linkedin.com/company/donovan-legal-pllc/',
    label: 'Donovan Legal PLLC on LinkedIn',
    title: 'LinkedIn',
    d: 'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z',
  },
];

const socialItems = SOCIAL.map((s) => '<li>'
  + `<a class="dl-ubar-social" href="${s.href}" target="_blank" rel="noopener noreferrer"`
  + ` aria-label="${s.label}" title="${s.title}">`
  + '<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">'
  + `<path d="${s.d}"/>`
  + '</svg></a></li>').join('');

/**
 * The bar itself.
 *
 * `role="complementary"` + an accessible name rather than a bare <div>: it is
 * site-level chrome that is not the main nav, and a screen-reader user landing on
 * a page should be able to skip past it by landmark. The CTA carries an explicit
 * aria-label because the visible label shortens to "Book" under 480px (see the
 * `.dl-ubar-cta-full` rule) — the accessible name must not shrink with the
 * viewport.
 */
export const BAR_HTML = '<div class="dl-ubar" role="complementary" aria-label="Quick links">'
  + '<div class="dl-ubar-inner">'
  + `<ul class="dl-ubar-social-list">${socialItems}</ul>`
  + `<a class="dl-ubar-cta" href="${BOOKING_HREF}" target="_top" ${BOOK_INTENT}`
  + ' aria-label="Book a Free Consultation">Book<span class="dl-ubar-cta-full"> a Free Consultation</span></a>'
  + '</div></div>';

/**
 * Should this page get the bar?
 *
 * `plan` is the output of `decidePlan` in ./perch-main.js — see the PAIRING RULE
 * note above for why this is the same predicate as the layer's and the router's.
 */
export function wantsBar(plan) {
  return !!plan && plan.kind !== 'skip';
}

/**
 * The stylesheet tag to compose into `layerHandlers(plan, extraTags)`, or '' when
 * this page does not get a bar.
 *
 * It CANNOT be its own `['head', …]` handler. lol-html keeps only the LAST
 * `onEndTag` callback registered for an element, so a second head handler calling
 * `el.onEndTag()` silently DELETES the persistent layer's insertion — the layer
 * and the router would simply stop loading, with no error anywhere. Same reason
 * SHELDON-PERCH-A22 hands the router's tag through `extraTags` instead of
 * registering its own handler.
 */
export function barStylesheetTag(plan) {
  return wantsBar(plan) ? BAR_STYLESHEET_TAG : '';
}

/**
 * HTMLRewriter handlers that put the bar at the top of <body>.
 *
 * `element()` + `prepend()`, never `onEndTag` — see barStylesheetTag above for
 * what an `onEndTag` on a shared element costs. `perch-main.js` registers its own
 * `['body', …]` handler (with an onEndTag) for the wrap-body-to-`</body>` case;
 * element callbacks compose, so this one is additive and that one survives.
 *
 * The prepended content is emitted immediately after the <body> start tag, which
 * is BEFORE the `['body > *', …]` handler that writes `<main id="perch-main">`
 * before the first body child — so the bar lands outside the container even on the
 * pages whose container opens at body child 0. Injected content is not re-fed
 * through the handlers, so the div/body-child ORDINALS the plan is written in are
 * untouched by this: pass 1 measured the original bytes and pass 2 still lands on
 * the same elements.
 */
export function barHandlers(plan) {
  if (!wantsBar(plan)) return [];
  let done = false;
  return [['body', {
    element(el) {
      if (done) return; // one body per document; a malformed second one is ignored
      done = true;
      el.prepend(BAR_HTML, { html: true });
    },
  }]];
}
