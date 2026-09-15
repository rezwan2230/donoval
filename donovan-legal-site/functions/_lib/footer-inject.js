// ── SHELDON-PAUL-CHROME: the office-city line in the footer, sitewide ─────────
//
// ── WHY THIS FILE EXISTS AT ALL: IT IS A COMPLIANCE LINE, NOT A DESIGN ONE ───
// Florida Bar Rule 4-7.12(a)(2) requires lawyer advertising to disclose the city
// of a bona fide office, reasonably prominently. The shared `.dl-connect` footer
// carries a phone number, an email address and four social links — and no
// location at all. Paul flagged it across the site (#223); on `main` every page
// goes straight from `.dl-connect-direct` to `.dl-social` with nothing between.
//
// So the missing line is not decoration and it is not optional: a page that
// renders without it is a page that is out of compliance, which is why the gate
// below is presence-driven rather than a path list — see WHERE IT LANDS.
//
// ── WHY AN INJECTOR AND NOT 100 PAGE EDITS ───────────────────────────────────
// The `.dl-connect` block is hand-authored, byte-duplicated across 100 of the
// site's HTML files. Adding a paragraph the obvious way is a 100-file edit that
//   • collides with every other content PR in flight, and
//   • trips `test/chrome-diff.test.mjs` rule 3 on all 100 — that rule compares
//     the element TREE of every changed page and fails when anything but text
//     moved, which is exactly what adding a `<p>` is.
// The site already has an answer to "one change, every page, zero page edits":
// the middleware's HTMLRewriter pass. `utility-bar-inject.js` is the model this
// file is built on, down to the two-halves-in-two-places shape below, and the
// result is one file, 100 pages, and a chrome-diff page register that does not
// move because no page file is touched.
//
// ── WHERE IT LANDS, AND WHY THE GATE IS PRESENCE AND NOT A PLAN ──────────────
// Anchored to `.dl-connect .dl-connect-direct` and emitted with `after()`, so it
// lands immediately after the phone/email paragraph and immediately before
// `<ul class="dl-social">` — the placement Paul's markup in #223 specifies.
//
// This is the ONE injector on this page that does NOT derive its gate from
// `plan.kind !== 'skip'`, and the difference is deliberate. The bar, the layer
// and the router are all site CHROME: they belong on every page that is a page,
// so the plan is the right predicate and the pairing rule keeps them together.
// This line belongs to a specific BLOCK that only some documents carry — 100 of
// the ~141 pages have a `.dl-connect` footer; `nav-block.html` and the tier and
// roadmap standalones do not. Gating it on the plan would inject a footer line
// into documents that have no footer to put it in.
//
// So the gate is the anchor's own existence, which makes "no footer → no line"
// a structural property rather than a rule someone has to maintain: an element
// callback for a selector the document does not contain simply never fires.
// `footerScan` reports that same presence up-front for the stylesheet half.
//
// ── WHY THE STYLESHEET NEEDS A LOOK-AHEAD AND THE MARKUP DOES NOT ────────────
// `<head>` closes before `.dl-connect` is ever parsed, so at the moment the head
// tag must be emitted the streaming pass cannot yet know whether this document
// has a footer. `footerScan` answers that the same way `planFromHtml` answers
// the container question — one extra pass over the ALREADY-BUFFERED body, which
// `_middleware.js` has in hand (`await out.text()`) before it builds the
// rewriter. No second fetch, no streaming penalty.
//
// ── WHY NO INLINE <style> ────────────────────────────────────────────────────
// The middleware issues a per-request nonce CSP. An injected inline block would
// have to carry that request's nonce — a live hazard every time this file
// changes. This carries none: the presentation is a same-origin stylesheet
// reference, which `style-src 'self'` admits as-is. Same choice, and the same
// reasoning, as `utility-bar-inject.js` and `perch-layer-inject.js`.
//
// ── WHY ITS OWN SHEET AND NOT css/main.css ───────────────────────────────────
// Same argument the utility bar makes, and it is load-bearing here for a second
// reason. Not every page carrying a `.dl-connect` block loads `css/main.css`, so
// a rule placed there would ship an UNSTYLED compliance line on the pages that
// do not — and unlike a bar, an unstyled line is the one that still has to be
// legible. A small dedicated sheet, injected next to the markup, is styled
// wherever the markup lands regardless of what else the document loads.

/** Kept in one place so the CI test can assert what gets injected. */
export const FOOTER_STYLESHEET = '/css/dl-footer-loc.css';

export const FOOTER_STYLESHEET_TAG = `<link rel="stylesheet" href="${FOOTER_STYLESHEET}">`;

/**
 * The anchor the line is placed after. Also the presence gate — see the note
 * above for why this injector keys off the block instead of the plan.
 *
 * Descendant-scoped rather than a bare `.dl-connect-direct` so a stray element
 * of that class outside the footer cannot pick up a footer line.
 */
export const FOOTER_ANCHOR = '.dl-connect .dl-connect-direct';

/** The class the line carries, and the marker that says a page already has one. */
export const OFFICE_CITY_CLASS = 'dl-connect-loc';

/**
 * The line itself — Paul's markup from #223, verbatim.
 *
 * `&middot;` and not a literal '·': the 100 footers this lands in are authored
 * in a mix of encodings and this string is emitted raw into all of them, so the
 * entity is the spelling that renders identically everywhere.
 */
export const OFFICE_CITY_HTML =
  `<p class="${OFFICE_CITY_CLASS}">Donovan Legal PLLC &middot; Delray Beach, Florida</p>`;

/**
 * Does this document have a footer to put the line in, and not already have one?
 *
 * Modelled on `planFromHtml` in ./perch-main.js — one pass over the buffered
 * body, discarding the output and keeping only what the handlers observed.
 *
 * The `hasLine` half is not hypothetical bookkeeping: if a page is ever authored
 * with the line already in it, or this injector is ever run twice over the same
 * body, the anchor is still there and `after()` would emit a SECOND line. A
 * duplicated office-city disclosure is a worse compliance artefact than a
 * missing one, so the scan refuses rather than trusting call-site discipline.
 *
 * @param {string} html the buffered response body
 * @param {typeof HTMLRewriter} Rewriter injected so the CI suite can drive the
 *   real lol-html build under Node — same contract as `planFromHtml`.
 * @returns {Promise<boolean>} true when the line should be injected
 */
export async function footerScan(html, Rewriter) {
  const seen = { anchor: false, line: false };
  let rewriter = new Rewriter()
    .on(FOOTER_ANCHOR, { element() { seen.anchor = true; } })
    .on(`.${OFFICE_CITY_CLASS}`, { element() { seen.line = true; } });
  await rewriter.transform(new Response(html)).arrayBuffer();
  return seen.anchor && !seen.line;
}

/**
 * The stylesheet tag to compose into `layerHandlers(plan, extraTags)`, or '' when
 * this document gets no line.
 *
 * It CANNOT be its own `['head', …]` handler. lol-html keeps only the LAST
 * `onEndTag` callback registered for an element, so a second head handler calling
 * `el.onEndTag()` silently DELETES the persistent layer's insertion — the layer
 * and the router would simply stop loading, with no error anywhere. That is the
 * same edge `barStylesheetTag` and the router's tags compose around, and it is
 * why this returns a string rather than a handler.
 *
 * @param {boolean} wanted the result of `footerScan`
 */
export function footerStylesheetTag(wanted) {
  return wanted ? FOOTER_STYLESHEET_TAG : '';
}

/**
 * HTMLRewriter handlers that place the office-city line in the footer.
 *
 * `element()` + `after()`, never `onEndTag` — see footerStylesheetTag above for
 * what an `onEndTag` on a shared element costs. `after()` on the element rather
 * than `append()` into `.dl-connect` because the line has a specified position
 * (between the direct-contact paragraph and the social row), not merely a
 * specified parent; appending would put it below the social links.
 *
 * Injected content is not re-fed through the handlers, so this cannot re-trigger
 * itself, and the div/body-child ORDINALS `plan` is written in are untouched by
 * it — the container and the bar land exactly where they landed before.
 *
 * @param {boolean} wanted the result of `footerScan`
 */
export function footerHandlers(wanted) {
  if (!wanted) return [];
  let done = false;
  return [[FOOTER_ANCHOR, {
    element(el) {
      // One footer per document. A page with a second `.dl-connect` block gets
      // one line, in the first one — the same "first wins" rule the bar applies
      // to a malformed second <body>.
      if (done) return;
      done = true;
      el.after(OFFICE_CITY_HTML, { html: true });
    },
  }]];
}
