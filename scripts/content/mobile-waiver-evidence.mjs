#!/usr/bin/env node
/**
 * JORDAN-PAUL-MOBILE — evidence for the `REVIEWED_STRUCTURAL` clauses this order
 * adds (#226 part A).
 *
 * Same instrument as `scripts/content/waiver-evidence.mjs` (PR #229), which was
 * itself `scripts/a11y/waiver-evidence.mjs` (PR #221). For every file the waiver
 * covers it:
 *   1. recovers the BEFORE from `origin/main` with `git show`,
 *   2. requires the file ON DISK to be byte-identical to the reviewed transform
 *      applied to that before — so the register describes the diff that actually
 *      shipped and not a hypothetical one,
 *   3. runs the REAL `planFromHtml` from `functions/_lib/perch-main.js`,
 *   4. runs the guards `structuralWaiver` enforces — the nav's div-ancestor
 *      stack, the ordered body children, the size of the region the server would
 *      wrap, plus the nav and footer subtrees the waiver may never cover — and
 *   5. reports any file where any of them moved.
 *
 * ── WHERE THIS DIFFERS FROM PR #229, AND WHY IT HAS TO ───────────────────────
 *
 * #229 added `<div>`s, so its central move was to DERIVE the expected shift in
 * `closeBeforeDivEnd` from the number of `</div>` the diff adds. This diff adds
 * `<picture>` and `<source>` and NO `</div>` at all, so that same derivation
 * evaluates to zero and the closing ordinal must not move by so much as one. That
 * is a strictly harder assertion than #229's, and it is the same line of code —
 * deliberately, so the two orders are read by one instrument and this one cannot
 * be accused of having been given an easier test.
 *
 * Four things are measured on top of the inherited five, because four things are
 * what this particular edit could plausibly get wrong:
 *
 *   • THE FALLBACK `<img>` IS BYTE-IDENTICAL. Not "has the same alt" — the same
 *     bytes. The before's arc `<img>` tags are extracted as raw source slices and
 *     the after's are too, and the two lists must be equal. `alt`, `loading`, and
 *     any `width`/`height` are covered by that one comparison without being
 *     enumerated, so the check cannot rot when an attribute is added.
 *
 *   • EXACTLY ONE `<picture>` PER WRAPPED ARC, and each one holds exactly its own
 *     arc `<img>` and one `<source>`. A double-wrap parses fine and renders fine.
 *
 *   • EVERY MOBILE `srcset` RESOLVES. A `<source>` whose image 404s falls back to
 *     the `<img>` silently, which is indistinguishable from working. Checked
 *     against the filesystem, not against the list the transform was given.
 *
 *   • THE WRAPPER IS SELECTED BY NOTHING NEW, and the rule that styles the arc
 *     still reaches it. PR #229's `.container` accident is the precedent: a class
 *     at a newly-injected level silently joined and left combinators. This
 *     wrapper carries no class at all, and both halves of that are measured — the
 *     `<picture>` has zero attributes, and `.dl-arc img`, the site's own rule,
 *     still matches the fallback `<img>` through the new wrapper (a `.dl-arc >
 *     img` child combinator would NOT, which is why the site's spelling is
 *     checked rather than assumed).
 *
 * This script CHANGES NOTHING ON DISK. It is evidence, not a migration.
 *
 * Usage:
 *   node scripts/content/mobile-waiver-evidence.mjs [--base origin/main]
 */

import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { planFromHtml, injectHandlers, CONTAINER_ID } from '../../donovan-legal-site/functions/_lib/perch-main.js';
import { HTMLRewriter } from '../../test/helpers/html-rewriter.mjs';
import { SCOPE, applyAll, findArcImgs, mobileSrc, hasMobileVariant, MOBILE_MEDIA, eolLf as eol } from './paul-mobile-edits.mjs';

const SITE = 'donovan-legal-site';
const BASE = (process.argv.indexOf('--base') !== -1 && process.argv[process.argv.indexOf('--base') + 1]) || 'origin/main';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });

// ── The guards, mirrored from chrome-diff.test.mjs ───────────────────────────

const SITE_NAV = 'nav.menubar';
const PERSISTENT_CLASS = 'dl-callbar';
const PERSISTENT_ID = 'dvn-perch-root';
const NON_CONTENT = ['SCRIPT', 'NOSCRIPT', 'TEMPLATE'];

const parse = (html) => new JSDOM(eol(html)).window.document;

function sig(el) {
  const id = el.getAttribute('id');
  const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).sort().join('.');
  return `${el.tagName.toLowerCase()}${id ? `#${id}` : ''}${cls ? `.${cls}` : ''}`;
}

function navAncestors(doc) {
  const nav = doc.querySelector(SITE_NAV);
  if (!nav) return '(no site nav)';
  const chain = [];
  for (let el = nav; el && el.tagName !== 'BODY'; el = el.parentElement) chain.unshift(sig(el));
  return chain.join(' > ');
}

const bodyChildren = (doc) => (doc.body ? [...doc.body.children].map(sig).join(' | ') : '(no body)');

function isNonContentKid(el) {
  if (NON_CONTENT.includes(el.tagName)) return true;
  if (el.getAttribute('id') === PERSISTENT_ID) return true;
  return (el.getAttribute('class') || '').trim().split(/\s+/).includes(PERSISTENT_CLASS);
}

function swapRegion(doc) {
  const countTree = (el) => 1 + el.querySelectorAll('*').length;
  const nav = doc.querySelector(SITE_NAV);
  if (nav) {
    const container = nav.closest('div');
    const wrapper = container?.parentElement?.closest('div');
    if (container && wrapper) {
      let n = 0;
      for (let node = container; node && node !== wrapper; node = node.parentElement) {
        for (let s = node.nextElementSibling; s; s = s.nextElementSibling) n += countTree(s);
      }
      if (n > 0) return n;
    }
  }
  if (!doc.body) return 0;
  const kids = [...doc.body.children];
  let close = kids.length;
  while (close > 0 && isNonContentKid(kids[close - 1])) close--;
  const navKid = nav ? kids.findIndex((k) => k.contains(nav)) : -1;
  let n = 0;
  for (let i = (navKid >= 0 ? navKid + 1 : 0); i < close; i++) n += countTree(kids[i]);
  return n;
}

/** The two subtrees chrome-diff compares byte for byte and NEVER waives. */
const subtree = (doc, sel) => (doc.querySelector(sel)?.outerHTML ?? '');

// ── Running the real injector ────────────────────────────────────────────────

const planOf = (html) => planFromHtml(eol(html), HTMLRewriter);

/**
 * The page as the edge would actually serve it: pass 2 of the middleware, with
 * the plan pass 1 produced.
 */
async function inject(html) {
  const src = eol(html);
  const plan = await planOf(src);
  const rewriter = new HTMLRewriter();
  for (const [selector, handlers] of injectHandlers(plan)) rewriter.on(selector, handlers);
  const out = await rewriter.transform(new Response(src)).text();
  await rewriter.free?.();
  return out;
}

const countCloseDivs = (s) => (s.match(/<\/div>/g) || []).length;
const countElements = (doc) => doc.querySelectorAll('*').length;

/** Where the injected container sits, as five facts independent of page volume. */
function containerContext(injectedHtml) {
  const doc = parse(injectedHtml);
  const main = doc.querySelector(`main#${CONTAINER_ID}`);
  if (!main) return { present: false };
  const chain = [];
  for (let el = main.parentElement; el && el.tagName !== 'BODY'; el = el.parentElement) chain.unshift(sig(el));
  return {
    present: true,
    parent: chain.join(' > ') || '(body)',
    prev: main.previousElementSibling ? sig(main.previousElementSibling) : '(none)',
    next: main.nextElementSibling ? sig(main.nextElementSibling) : '(none)',
    first: main.firstElementChild ? sig(main.firstElementChild) : '(none)',
    last: main.lastElementChild ? sig(main.lastElementChild) : '(none)',
    elements: 1 + main.querySelectorAll('*').length,
  };
}

// ── The four checks this order adds ──────────────────────────────────────────

/** The exact source bytes of every arc `<img>`, in document order. */
const arcImgTags = (html) => findArcImgs(eol(html)).map((h) => h.tag);

/**
 * The `<picture>` elements this diff introduced, described structurally.
 *
 * Read out of the DOM rather than off the source, because the questions here —
 * how many children, which ones, whose attributes — are questions about the tree
 * a browser builds, and a `<picture>` that was nested inside another one would
 * still look tidy in the file.
 */
function pictureFacts(doc) {
  return [...doc.querySelectorAll('picture')].map((p) => {
    const sources = [...p.querySelectorAll(':scope > source')];
    const imgs = [...p.querySelectorAll(':scope > img')];
    return {
      attrs: [...p.attributes].map((a) => `${a.name}="${a.value}"`).sort().join(' '),
      nestedPictures: p.querySelectorAll('picture').length,
      sources: sources.map((s) => `${s.getAttribute('media')} → ${s.getAttribute('srcset')}`),
      imgs: imgs.map((i) => i.getAttribute('src')),
      children: p.children.length,
    };
  });
}

/**
 * Does the site's own arc rule still reach the fallback `<img>` through the
 * wrapper?
 *
 * Asked of the page's real `<style>` text and answered with `matches()`, so this
 * is the actual selector the actual page ships and not a restatement of it. The
 * failure it exists for is a child combinator: `.dl-arc > img` matches before the
 * wrapper and not after, and nothing else in this report would notice.
 */
function arcRuleStillMatches(doc, html) {
  const selectors = [...eol(html).matchAll(/([^{}]*?)\{[^{}]*\}/g)]
    .map((m) => m[1].trim())
    .filter((s) => /(^|[\s,>])\.dl-arc\b/.test(s) && /\bimg\b/.test(s));
  const img = doc.querySelector('.dl-arc img');
  if (!img) return { selectors, matched: null };
  const matched = selectors.filter((sel) => sel.split(',').some((one) => {
    try { return img.matches(one.trim()); } catch { return false; }
  }));
  return { selectors, matched };
}

// ── The per-file measurement ─────────────────────────────────────────────────

/**
 * `actual` is passed in rather than read inside so the controls can drive this
 * exact code path with a deliberately wrong "after". A check that is only ever
 * called on the happy path is not a check.
 */
async function checkFile(file, actual) {
  const before = eol(git('show', `${BASE}:${file}`));
  const after = eol(actual);
  const expected = eol(applyAll(file, before).after);
  const bad = [];
  const notes = {};
  if (expected !== after) bad.push('disk≠transform');

  const db = parse(before);
  const da = parse(after);
  for (const [what, x, y] of [
    ['nav', navAncestors(db), navAncestors(da)],
    ['body', bodyChildren(db), bodyChildren(da)],
    ['nav subtree', subtree(db, SITE_NAV), subtree(da, SITE_NAV)],
    ['footer subtree', subtree(db, '.copy-inside'), subtree(da, '.copy-inside')],
  ]) if (x !== y) bad.push(what);

  const [rb, ra] = [swapRegion(db), swapRegion(da)];
  if (ra < rb) bad.push(`region shrank ${rb}→${ra}`);
  notes.region = `${rb}→${ra}`;

  // 1. The plan's KIND and OPENING ordinal must not move at all.
  const [pb, pa] = [await planOf(before), await planOf(after)];
  if (pb.kind !== pa.kind) bad.push(`plan kind ${pb.kind}→${pa.kind}`);
  if (pb.openAfterDivEnd !== pa.openAfterDivEnd) bad.push('plan open ordinal');
  if (pb.closeBeforePersistent !== pa.closeBeforePersistent) bad.push('plan close-before-persistent');

  // 2. The CLOSING ordinal may only advance by the number of `</div>` this diff
  //    adds. This diff adds none, so the derived allowance is zero and the close
  //    must not move at all — the same line of code as #229, evaluating to a
  //    strictly stronger claim because the numerator is zero.
  const addedDivs = countCloseDivs(after) - countCloseDivs(before);
  const shift = (pa.closeBeforeDivEnd ?? 0) - (pb.closeBeforeDivEnd ?? 0);
  notes.close = `${pb.closeBeforeDivEnd}→${pa.closeBeforeDivEnd}`;
  notes.addedDivs = addedDivs;
  if (shift !== addedDivs) bad.push(`close ordinal shifted ${shift}, the diff adds ${addedDivs} </div>`);

  // 3. THE CLAIM. Run the REAL injector over both and compare where the container
  //    landed: same parent chain, same element before and after it, same first and
  //    last child.
  const [cb, ca] = [containerContext(await inject(before)), containerContext(await inject(after))];
  if (!cb.present || !ca.present) bad.push('no container injected');
  else {
    for (const k of ['parent', 'prev', 'next', 'first', 'last']) {
      if (cb[k] !== ca[k]) bad.push(`container ${k} ${cb[k]} → ${ca[k]}`);
    }
    // 4. Every element this diff adds landed INSIDE the container, and none left
    //    it: the container's element count must move by exactly as much as the
    //    document's does.
    const grewInside = ca.elements - cb.elements;
    const grewOverall = countElements(da) - countElements(db);
    notes.grew = `${grewInside}/${grewOverall}`;
    if (grewInside !== grewOverall) {
      bad.push(`container gained ${grewInside} elements but the page gained ${grewOverall}`);
    }
  }

  // 5. THE FALLBACK `<img>` IS BYTE-IDENTICAL — every attribute, including alt,
  //    loading and any width/height, by construction rather than by enumeration.
  const [ib, ia] = [arcImgTags(before), arcImgTags(after)];
  notes.imgs = ib.length;
  if (ib.length !== ia.length) bad.push(`arc <img> count ${ib.length}→${ia.length}`);
  else for (let i = 0; i < ib.length; i++) {
    if (ib[i] !== ia[i]) bad.push(`arc <img> ${i} changed bytes: ${ib[i].slice(0, 60)}… → ${ia[i].slice(0, 60)}…`);
  }

  // 6. EXACTLY ONE `<picture>` PER WRAPPED ARC, each holding one `<source>` and
  //    one `<img>`, carrying no attributes, nesting nothing.
  const eligible = findArcImgs(before).filter((h) => hasMobileVariant(h.name));
  const pics = pictureFacts(da);
  notes.pictures = `${pictureFacts(db).length}→${pics.length}`;
  if (pics.length - pictureFacts(db).length !== eligible.length) {
    bad.push(`expected ${eligible.length} added <picture>, found ${pics.length - pictureFacts(db).length}`);
  }
  for (const [i, p] of pics.entries()) {
    if (p.attrs) bad.push(`<picture> ${i} carries attributes [${p.attrs}] — the wrapper must be classless`);
    if (p.nestedPictures) bad.push(`<picture> ${i} nests ${p.nestedPictures} more`);
    if (p.children !== 2 || p.sources.length !== 1 || p.imgs.length !== 1) {
      bad.push(`<picture> ${i} holds ${p.children} children (${p.sources.length} source, ${p.imgs.length} img)`);
    }
    const [src] = p.sources;
    if (src && !src.startsWith(`${MOBILE_MEDIA} → `)) bad.push(`<picture> ${i} source media is ${src}`);
  }

  // 7. EVERY MOBILE `srcset` RESOLVES ON DISK. A `<source>` whose image 404s
  //    falls back to the `<img>` and is indistinguishable from working.
  //
  //    Read off the SHIPPED PAGE and not off `eligible`. Eligibility is itself
  //    derived from `existsSync`, so asking "does every eligible arc's asset
  //    exist" is a tautology that can never fail — the dead-code shape this repo
  //    has been bitten by before. What the page CLAIMS is independent of what the
  //    transform was allowed to do, so that is what gets checked against the
  //    filesystem; control 3 drives exactly this line.
  const claimed = [...after.matchAll(/<source\b[^>]*\bsrcset="([^"]*)"/g)].map((m) => m[1]);
  notes.srcsets = claimed.length;
  for (const target of claimed) {
    if (!existsSync(`${SITE}/${target}`)) bad.push(`srcset ${target} is not on disk`);
  }
  for (const hit of eligible) {
    if (!claimed.includes(mobileSrc(hit.src))) bad.push(`srcset ${mobileSrc(hit.src)} is not in the page`);
  }

  // 8. ELEMENT BALANCE. Every tag name's open and close count, before and after,
  //    and the ONLY entry allowed to move is `picture` — by exactly one pair per
  //    arc wrapped.
  //
  //    Counted on the SOURCE and not on the DOM, because that is the only place
  //    the failure is visible: an unclosed `<picture>` is not a parse error, it is
  //    a tag the parser closes for you somewhere you did not choose, and jsdom
  //    hands back a tidy tree either way. `<source>` is void and correctly has no
  //    closing tag, so it is asserted to have none rather than being skipped.
  const tagCounts = (html) => {
    const open = new Map();
    const close = new Map();
    for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9-]*)\b[^>]*>/g)) {
      const bucket = m[1] ? close : open;
      bucket.set(m[2].toLowerCase(), (bucket.get(m[2].toLowerCase()) || 0) + 1);
    }
    return { open, close };
  };
  const [tb, ta] = [tagCounts(before), tagCounts(after)];
  const names = new Set([...tb.open.keys(), ...ta.open.keys(), ...tb.close.keys(), ...ta.close.keys()]);
  const wraps = eligible.length;
  const moved = [];
  for (const name of [...names].sort()) {
    const dOpen = (ta.open.get(name) || 0) - (tb.open.get(name) || 0);
    const dClose = (ta.close.get(name) || 0) - (tb.close.get(name) || 0);
    const want = name === 'picture' ? [wraps, wraps] : name === 'source' ? [wraps, 0] : [0, 0];
    if (dOpen !== want[0] || dClose !== want[1]) moved.push(`${name} ${dOpen >= 0 ? '+' : ''}${dOpen}/${dClose >= 0 ? '+' : ''}${dClose}`);
  }
  notes.balance = moved.length ? moved.join(' ') : `+${wraps} picture pair`;
  if (moved.length) bad.push(`element balance moved on ${moved.join(', ')} (open/close delta)`);
  if ((ta.open.get('picture') || 0) !== (ta.close.get('picture') || 0)) {
    bad.push(`<picture> is unbalanced after: ${ta.open.get('picture') || 0} open, ${ta.close.get('picture') || 0} close`);
  }
  if (ta.close.get('source')) bad.push(`<source> is void but the page carries ${ta.close.get('source')} </source>`);

  // 9. THE WRAPPER IS SELECTED BY NOTHING NEW, and `.dl-arc img` still reaches
  //    the fallback through it.
  const rule = arcRuleStillMatches(da, after);
  notes.arcRule = rule.matched === null ? '(no arc img)' : `${rule.matched.length}/${rule.selectors.length}`;
  if (rule.matched !== null && rule.selectors.length && !rule.matched.length) {
    bad.push(`the page's own arc rule(s) [${rule.selectors.join(' ; ')}] no longer match the fallback <img>`);
  }

  return { bad, notes };
}

// ── Controls ─────────────────────────────────────────────────────────────────

/** CONTROL 1 — the harness can tell two plans apart at all (the #220 trap:
 *  `planFromHtml(html)` without the rewriter compares two Promises and reports
 *  every file identical having compared nothing). */
{
  const probe = readFileSync(`${SITE}/tax-controversy.html`, 'utf8');
  const a = JSON.stringify(await planOf(probe));
  const b = JSON.stringify(await planOf(probe.replace(/<body([^>]*)>/i, '<body$1><main>x</main>')));
  if (!a || a === '{}' || a === b) {
    console.error(`CONTROL 1 FAILED — cannot distinguish two plans. before=${a} after=${b}`);
    process.exit(2);
  }
  console.log(`control 1 OK — a <main> moves the plan (${a.slice(0, 46)}… -> ${b.slice(0, 46)}…)`);
}

/** CONTROL 2 — `checkFile` bites on five broken afters, one per claim this
 *  report makes. The fifth is the one this order adds and the one a reader is
 *  most likely to doubt: a diff that adds a `</div>` MUST now be caught, because
 *  the derived allowance for this diff is zero. */
{
  const f = SCOPE.find((p) => p.includes('tax-controversy.html')) ?? SCOPE[0];
  const before = eol(git('show', `${BASE}:${f}`));
  const expected = eol(applyAll(f, before).after);

  const wrongBytes = await checkFile(f, `${expected}\n<!-- not what the transform produces -->`);
  const movedMain = await checkFile(f, expected.replace(/<body([^>]*)>/i, '<body$1><main>x</main>'));
  // A `</div>` added anywhere. On #229 this was allowed for and derived; here the
  // allowance is zero, so the close must move and be reported.
  const addedDiv = await checkFile(f, expected.replace('</body>', '  <div class="stray"></div>\n</body>'));
  // The fallback `<img>` re-emitted rather than sliced — `loading="lazy"` dropped.
  // This is the failure "preserve every attribute" exists to prevent and the one
  // that a `<picture>` renders around without complaint.
  const strippedAttr = await checkFile(f, expected.replace(' loading="lazy">', '>'));
  // A class on the wrapper — PR #229's `.container` accident, in this position.
  const classedWrapper = await checkFile(f, expected.replace('<picture>', '<picture class="container">'));
  // An unclosed `<picture>`. This is NOT a parse error and jsdom hands back a tidy
  // tree either way — the parser simply closes the element somewhere nobody chose.
  // It is the failure the source-level balance count exists for, and the one the
  // DOM-level checks above cannot see.
  const unclosed = await checkFile(f, expected.replace('</picture>', ''));

  const ok = wrongBytes.bad.includes('disk≠transform')
    && movedMain.bad.some((b) => b.startsWith('plan kind'))
    && movedMain.bad.some((b) => b.startsWith('container '))
    && addedDiv.bad.some((b) => b.startsWith('close ordinal shifted'))
    && strippedAttr.bad.some((b) => b.startsWith('arc <img> '))
    && classedWrapper.bad.some((b) => b.includes('must be classless'))
    && unclosed.bad.some((b) => b.includes('is unbalanced after'));
  if (!ok) {
    console.error('CONTROL 2 FAILED — checkFile did not report one of the six broken afters.');
    console.error(`  wrong bytes       -> [${wrongBytes.bad.join(', ')}]`);
    console.error(`  added main        -> [${movedMain.bad.join(', ')}]`);
    console.error(`  added </div>      -> [${addedDiv.bad.join(', ')}]`);
    console.error(`  stripped loading  -> [${strippedAttr.bad.join(', ')}]`);
    console.error(`  classed wrapper   -> [${classedWrapper.bad.join(', ')}]`);
    console.error(`  unclosed <picture>-> [${unclosed.bad.join(', ')}]`);
    process.exit(2);
  }
  console.log(`control 2 OK — on ${f}:`);
  console.log(`  a corrupted after           -> [${wrongBytes.bad.join(', ')}]`);
  console.log(`  an added <main>             -> [${movedMain.bad.join(', ')}]`);
  console.log(`  an added </div>             -> [${addedDiv.bad.join(', ')}]`);
  console.log(`  a dropped loading="lazy"    -> [${strippedAttr.bad.join(', ')}]`);
  console.log(`  a class on the wrapper      -> [${classedWrapper.bad.join(', ')}]`);
  console.log(`  an unclosed <picture>       -> [${unclosed.bad.join(', ')}]`);
}

/** CONTROL 3 — the srcset check is answered by the FILESYSTEM. Point one page's
 *  source at an asset that is not there and it must be reported; the same page
 *  with the real asset must not be. Without this, "every srcset resolves" would
 *  be a restatement of the list the transform was handed. */
{
  const f = SCOPE.find((p) => p.includes('irs-notice.html')) ?? SCOPE[0];
  const before = eol(git('show', `${BASE}:${f}`));
  const expected = eol(applyAll(f, before).after);
  const ghost = await checkFile(f, expected.replace(/srcset="img\/arc-([a-z0-9-]+)-m\.svg"/, 'srcset="img/arc-$1-m-does-not-exist.svg"'));
  const real = await checkFile(f, expected);
  const ok = ghost.bad.some((b) => b.startsWith('srcset ') && b.endsWith('is not on disk'))
    && ghost.bad.some((b) => b.startsWith('srcset ') && b.endsWith('is not in the page'))
    && !real.bad.length;
  if (!ok) {
    console.error('CONTROL 3 FAILED — the srcset check did not separate a real asset from a missing one.');
    console.error(`  missing asset -> [${ghost.bad.join(', ')}]`);
    console.error(`  real asset    -> [${real.bad.join(', ')}]`);
    process.exit(2);
  }
  console.log(`control 3 OK — on ${f}: a srcset pointing at nothing -> [${ghost.bad.join(', ')}]\n`);
}

// ── Run ──────────────────────────────────────────────────────────────────────

const listPages = (...args) => git(...args, '--', SITE)
  .split('\n').map((s) => s.trim()).filter((s) => s.endsWith('.html'));
const changed = [...new Set([
  ...listPages('diff', '--name-only', `${BASE}...HEAD`),
  ...listPages('diff', '--name-only', 'HEAD'),
])].sort();

const unregistered = changed.filter((f) => !SCOPE.includes(f));
const rows = [];
let mismatched = 0;
let moved = 0;

for (const file of SCOPE) {
  const { bad, notes } = await checkFile(file, readFileSync(file, 'utf8'));
  if (bad.includes('disk≠transform')) mismatched++;
  if (bad.length) moved++;
  rows.push({ file, bad, notes });
}

console.log(`base                                       : ${BASE}`);
console.log(`pages changed on this branch               : ${changed.length}`);
console.log(`pages in the waiver register               : ${SCOPE.length}`);
console.log(`changed pages with NO register entry       : ${unregistered.length}`);
console.log(`disk matches the reviewed transform        : ${SCOPE.length - mismatched} / ${SCOPE.length}`);
console.log(`plan kind + BOTH ordinals, nav stack, body children,`);
console.log(`nav/footer subtrees, swap region, container boundary,`);
console.log(`fallback <img> bytes, one classless <picture>, element balance, srcset on disk`);
console.log(`ALL HOLD                                   : ${rows.filter((r) => !r.bad.length).length} / ${SCOPE.length}`);
console.log(`something moved (NOT waivable)             : ${moved}\n`);

console.log('per file — close ordinal, </div> added, swap region, elements gained inside/overall,');
console.log('           <picture> before→after, tag balance delta, .dl-arc img rules still matching:');
for (const r of rows) {
  console.log(`  ${r.bad.length ? 'MOVED ' : 'ok    '} ${r.file.padEnd(52)} close ${String(r.notes.close).padEnd(10)} divs +${String(r.notes.addedDivs).padEnd(3)} region ${String(r.notes.region).padEnd(11)} grew ${String(r.notes.grew).padEnd(6)} pics ${String(r.notes.pictures).padEnd(5)} balance ${String(r.notes.balance).padEnd(18)} arcRule ${r.notes.arcRule}`);
}
for (const f of unregistered) console.log(`  UNREGISTERED  ${f}`);
for (const r of rows.filter((x) => x.bad.length)) console.log(`  MOVED  ${r.file}  [${r.bad.join(', ')}]`);

process.exitCode = (moved || unregistered.length) ? 1 : 0;
