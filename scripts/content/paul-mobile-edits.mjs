/**
 * JORDAN-PAUL-MOBILE — the #226 part A mobile-diagram deltas, as pure string
 * transforms over the CURRENT `main` copies.
 *
 * ── WHY THIS IS A MODULE AND NOT A PATCH ─────────────────────────────────────
 *
 * Same reason `paul-content-edits.mjs` is one. Three statements have to be made
 * about the same edits and they must come from a single definition:
 *
 *   • `apply-paul-mobile.mjs` writes them to disk;
 *   • `mobile-waiver-evidence.mjs` re-derives the "after" from `origin/main`'s
 *     "before" and requires it to be BYTE-IDENTICAL to what is on disk — so the
 *     `REVIEWED_STRUCTURAL` register describes the diff that actually shipped and
 *     not a proposal; and
 *   • that same before/after pair is fed to the real `planFromHtml` and to the
 *     guards `structuralWaiver` enforces.
 *
 * ── THE EDIT, AND THE TWO THINGS IT IS NOT ALLOWED TO DO ─────────────────────
 *
 * Issue #226 asks for one thing on each of the 15 tax-controversy pages: the arc
 * `<img>` gains a phone-portrait alternative. The shape is dictated by the issue:
 *
 *   <picture><source media="(max-width:700px)" srcset="img/arc-NAME-m.svg"><img …></picture>
 *
 * Two constraints on how that is spelled, both from the order and both load
 * bearing:
 *
 *   1. THE ORIGINAL `<img>` STAYS BYTE-IDENTICAL. It is the fallback, and it is
 *      also the thing every reviewer will diff. The transform below does not
 *      re-emit the tag from parsed parts — it captures the tag's exact bytes and
 *      re-inserts that same slice between the `<source>` and `</picture>`. `alt`,
 *      `loading`, and any `width`/`height` a page ever grows therefore survive by
 *      construction rather than by an enumeration that could go stale. (No arc
 *      `<img>` on `main` carries `width` or `height` today; the capture does not
 *      care either way.)
 *
 *   2. THE WRAPPER CARRIES NO CLASS AT ALL. PR #229 is the reason this is stated
 *      rather than assumed: a `class="container"` dropped at the `.dl-connect`
 *      anchor changed 35 selector match sets, because `.box > .border-grey >
 *      .container{z-index:100}` stopped matching once the injected
 *      `main#perch-main` came between them. A `<picture>` here sits INSIDE
 *      `div.dl-arc`, so the same class of accident is available — `.dl-arc > img`
 *      would be a direct-child combinator this edit silently breaks. The site's
 *      own rule is `.dl-arc img{display:block;width:100%;height:auto}`, a
 *      DESCENDANT combinator, which still matches through the wrapper. Giving the
 *      wrapper no class means there is no selector anywhere it can newly match,
 *      and `scripts/content/mobile-waiver-evidence.mjs` proves the descendant rule
 *      still reaches the img rather than asserting it.
 *
 * ── WHY THE BREAKPOINT IS 700px AND NOT 768px ────────────────────────────────
 *
 * `(max-width:700px)` is the value #226 writes out, and it is also the site's own
 * value for these figures: all 15 pages carry
 * `@media (max-width:700px){.dl-arc,.dl-fig{display:none}}` in their head style
 * block. 768px is more common sitewide but governs the Bootstrap grid, not this
 * block. Using the block's own breakpoint is what makes the `<source>` and the
 * rule that hides the block agree about where "phone" starts.
 *
 * NOTE FOR THE READER, recorded here because it is the first thing anyone will
 * ask: that `display:none` rule means the `<picture>` cannot PAINT at ≤700px
 * today. Wiring the source and un-hiding the block are two separate decisions;
 * this order is the first, and the PR body carries the one-line second for David.
 */

import { existsSync, readFileSync } from 'node:fs';

const S = 'donovan-legal-site/';

/** git stores these blobs with bare LF; `core.autocrlf` checks them out CRLF. */
export const eolLf = (s) => s.replace(/\r\n?/g, '\n');

/** The site's existing mobile breakpoint for the `.dl-arc` / `.dl-fig` figures. */
export const MOBILE_MEDIA = '(max-width:700px)';

/**
 * Which arcs have a portrait variant — READ OFF THE DISK, never hard-coded.
 *
 * Task 4 of the order is "skip any arc with no `-m` variant". A literal list of
 * seven names could satisfy that sentence and still be wrong in the only way that
 * matters: if an asset failed to land, a hard-coded list would happily wrap the
 * page and point `srcset` at a 404, and nothing downstream would notice, because
 * a missing `<source>` image falls back to the `<img>` silently. So eligibility is
 * a question asked of the filesystem, once, at module load.
 *
 * `existsSync` on an explicit path rather than a directory listing: the question
 * is "is `img/arc-coll-m.svg` there", and asking it that way means a page that
 * ever references an arc from a different directory is answered about THAT file.
 */
export const IMG_DIR = `${S}img`;

export const hasMobileVariant = (name) => existsSync(`${IMG_DIR}/${name}-m.svg`);

/** The desktop arcs referenced anywhere in scope, and whether each has a twin. */
export function mobileVariantCensus(read = (f) => readFileSync(f, 'utf8')) {
  const names = new Set();
  for (const file of ARC_PAGES) {
    for (const hit of findArcImgs(eolLf(read(file)))) names.add(hit.name);
  }
  return [...names].sort().map((name) => ({ name, hasMobile: hasMobileVariant(name) }));
}

/** Every page that shows an arc. Order fixed so reports are stable. */
export const ARC_PAGES = [
  'audit-reconsideration.html',
  'florida-sales-tax-audit.html',
  'irs-appeals.html',
  'irs-audit-defense.html',
  'irs-liens-levies.html',
  'irs-notice.html',
  'massachusetts-tax-appeal.html',
  'partnership-audits.html',
  'residency-audit.html',
  'tax-controversy.html',
  'tax-court.html',
  'tax-debt-resolution.html',
  'tax-penalties.html',
  'unfiled-returns.html',
  'voluntary-disclosure.html',
].map((p) => S + p);

/**
 * Every `<img>` on the page whose `src` is one of the seven desktop arcs, as
 * `{ tag, name, index }` with `tag` the tag's EXACT bytes.
 *
 * Matched on the source text and not through jsdom on purpose: the whole promise
 * of this edit is that the fallback `<img>` ships unchanged to the byte, and a
 * parse/serialise round trip would quietly re-order attributes and re-quote
 * values. A regex is the wrong tool for reading HTML in general (that is the
 * measurement bug this repo has been bitten by before) but it is the right tool
 * for "hand me back this exact substring": the pattern is anchored on `<img`, is
 * forbidden from crossing a `>`, and every hit is verified to be a self-contained
 * tag before it is used.
 */
export function findArcImgs(source) {
  const out = [];
  const re = /<img\b[^>]*>/g;
  for (let m = re.exec(source); m; m = re.exec(source)) {
    const tag = m[0];
    const src = /\ssrc\s*=\s*"([^"]*)"/.exec(tag);
    if (!src) continue;
    const hit = /(?:^|\/)(arc-[a-z0-9-]+)\.svg$/.exec(src[1]);
    if (!hit) continue;
    out.push({ tag, name: hit[1], index: m.index, src: src[1] });
  }
  return out;
}

/** `img/arc-notice.svg` → `img/arc-notice-m.svg`, keeping whatever path was authored. */
export const mobileSrc = (src) => src.replace(/\.svg$/, '-m.svg');

/**
 * Wrap one arc `<img>`.
 *
 * The `<picture>` opens exactly where the `<img>` opened, so the page's own
 * indentation is preserved and the diff is one line per page. The `<img>` slice is
 * re-inserted verbatim.
 */
export function wrapArcImg(source, hit) {
  const wrapped = `<picture><source media="${MOBILE_MEDIA}" srcset="${mobileSrc(hit.src)}">${hit.tag}</picture>`;
  return source.slice(0, hit.index) + wrapped + source.slice(hit.index + hit.tag.length);
}

/**
 * Apply the wrap to every eligible arc on one page, right to left.
 *
 * Right to left because each replacement lengthens the string: rewriting the last
 * hit first leaves every earlier hit's captured `index` still valid. Today every
 * page has exactly one arc, so this is invisible — which is precisely why it is
 * written correctly now rather than discovered later.
 *
 * Idempotent: an `<img>` already inside a `<picture>` this transform produced is
 * skipped, so re-running the applier is a no-op instead of a nest.
 */
export function applyAll(file, source) {
  const key = file.replace(/\\/g, '/');
  if (!ARC_PAGES.includes(key)) return { after: source, applied: [], skipped: [] };

  const hits = findArcImgs(source);
  const eligible = [];
  const skipped = [];
  for (const hit of hits) {
    if (!hasMobileVariant(hit.name)) {
      skipped.push(hit.name);
      continue;
    }
    // Already wrapped — the `<source>` for this arc sits immediately before it.
    const before = source.slice(0, hit.index);
    if (before.endsWith(`srcset="${mobileSrc(hit.src)}">`)) continue;
    eligible.push(hit);
  }

  let out = source;
  for (const hit of [...eligible].sort((a, b) => b.index - a.index)) out = wrapArcImg(out, hit);
  return {
    after: out,
    applied: eligible.map((h) => `#226A picture wrapper for ${h.name}`),
    skipped,
  };
}

/** Every file this order edits. */
export const SCOPE = [...ARC_PAGES].sort();
