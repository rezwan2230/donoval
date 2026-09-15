#!/usr/bin/env node
/**
 * JORDAN-PAUL-CONTENT — evidence for the `REVIEWED_STRUCTURAL` entries this order
 * adds (#224, #225, #226).
 *
 * Same instrument as `scripts/a11y/waiver-evidence.mjs` (PR #221), with the same
 * five steps. For every file the waiver covers it:
 *   1. recovers the BEFORE from `origin/main` with `git show`,
 *   2. requires the file ON DISK to be byte-identical to the reviewed transforms
 *      applied to that before — so the register describes the diff that actually
 *      shipped and not a hypothetical one,
 *   3. runs the REAL `planFromHtml` from `functions/_lib/perch-main.js`,
 *   4. runs the guards `structuralWaiver` enforces — the nav's div-ancestor
 *      stack, the ordered body children, the size of the region the server would
 *      wrap, plus the nav and footer subtrees the waiver may never cover — and
 *   5. reports any file where any of them moved.
 *
 * ── WHERE THIS DIFFERS FROM PR #221, AND WHY IT HAS TO ───────────────────────
 *
 * #221 shipped ATTRIBUTE edits. Nothing it touched added an element, so the plan
 * was identical integer-for-integer and "0 moved" could be read straight off a
 * `JSON.stringify` comparison.
 *
 * This order ADDS elements — that is the whole request. A `wrap-div` plan is
 * written in `</div>` ordinals, so inserting nine divs inside the wrapper
 * necessarily advances `closeBeforeDivEnd` by nine. That is not the injector
 * moving; it is the ordinal SPACE moving underneath a close that still lands on
 * the same element. The register already carries this exact case in prose —
 * `tax-controversy.html`, "only the close moves (40→76) as the wrapper now holds
 * more content" — but prose is what this script exists to replace.
 *
 * So "did the injector move?" is measured on the ELEMENT and not on the integer:
 *
 *   • DERIVED, NOT ASSUMED — `closeBeforeDivEnd` must advance by exactly the
 *     number of `</div>` this diff adds, counted over the whole file. A div added
 *     AFTER the wrapper's end tag would not shift the close and so fails this
 *     line; so would a div that disappeared. Nothing is taken on faith about
 *     where the insertion landed.
 *   • THE ANCHOR ITSELF — the real `injectHandlers` is run over both versions and
 *     the injected container is located in the result. Its parent chain, the
 *     element before it, the element after it, and its own first and last child
 *     must all be unchanged: that is what "the container still opens and closes
 *     around the same elements" means once the page is allowed to hold more.
 *   • AND EVERYTHING LANDED INSIDE IT — the container's element count must move
 *     by exactly as much as the document's does, so a block that landed outside
 *     the swap region cannot pass by being small.
 *
 * That trio is what "0 moved" below counts. All three directions are controlled
 * for at the bottom: a corrupted after must be reported as not matching the
 * transform, an added `<main>` must move the plan, and a stray `<div>` slipped in
 * beside the anchor must be caught.
 *
 * This script CHANGES NOTHING ON DISK. It is evidence, not a migration.
 *
 * Usage:
 *   node scripts/content/waiver-evidence.mjs [--base origin/main]
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { planFromHtml, injectHandlers, CONTAINER_ID } from '../../donovan-legal-site/functions/_lib/perch-main.js';
import { HTMLRewriter } from '../../test/helpers/html-rewriter.mjs';
import { SCOPE, applyAll } from './paul-content-edits.mjs';

const SITE = 'donovan-legal-site';
const BASE = (process.argv.indexOf('--base') !== -1 && process.argv[process.argv.indexOf('--base') + 1]) || 'origin/main';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });

/** git stores these blobs with bare LF; `core.autocrlf` checks them out CRLF. */
const eol = (s) => s.replace(/\r\n?/g, '\n');

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
 * the plan pass 1 produced. This is the output the container question is really
 * about, so it is the output that gets compared.
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

/**
 * Where the injected container sits, as five facts that do not depend on how much
 * content the page holds.
 *
 * The point of comparing these rather than the raw ordinals is that the ordinals
 * are the one thing an insertion is GUARANTEED to move. `parent`, `prev` and
 * `next` say the container is still in the same slot of the same tree; `first`
 * and `last` say it still opens and closes around the same elements. Nothing here
 * changes when a block is added in the middle of the container, and every one of
 * them changes if the container's edges move.
 */
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

// ── The per-file measurement ─────────────────────────────────────────────────

/**
 * `actual` is passed in rather than read inside so CONTROL 2 can drive this exact
 * code path with a deliberately wrong "after". A check that is only ever called
 * on the happy path is not a check.
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
  //    adds — no more, and no fewer. DERIVED from the two documents rather than
  //    asserted: `</div>` is counted over the whole file, so a div added AFTER the
  //    wrapper's end tag (which would not shift the close) fails this line, and so
  //    does a div that vanished. The head CSS half of the diff adds no elements at
  //    all, which is why one count over the whole file is the right denominator.
  const addedDivs = countCloseDivs(after) - countCloseDivs(before);
  const shift = (pa.closeBeforeDivEnd ?? 0) - (pb.closeBeforeDivEnd ?? 0);
  notes.close = `${pb.closeBeforeDivEnd}→${pa.closeBeforeDivEnd}`;
  notes.addedDivs = addedDivs;
  if (shift !== addedDivs) bad.push(`close ordinal shifted ${shift}, the diff adds ${addedDivs} </div>`);

  // 3. THE CLAIM. Run the REAL injector over both and compare where the container
  //    landed: same parent chain, same element before it, same element after it,
  //    same first and last child. Those five are what "the injector did not move"
  //    means once the page is allowed to hold more content.
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

  return { bad, notes };
}

// ── Controls ─────────────────────────────────────────────────────────────────

/** CONTROL 1 — the harness can tell two plans apart at all (see the #220 trap:
 *  `planFromHtml(html)` without the rewriter compares two Promises and reports
 *  every file identical having compared nothing). */
{
  const probe = readFileSync(`${SITE}/practice.html`, 'utf8');
  const a = JSON.stringify(await planOf(probe));
  const b = JSON.stringify(await planOf(probe.replace(/<body([^>]*)>/i, '<body$1><main>x</main>')));
  if (!a || a === '{}' || a === b) {
    console.error(`CONTROL 1 FAILED — cannot distinguish two plans. before=${a} after=${b}`);
    process.exit(2);
  }
  console.log(`control 1 OK — a <main> moves the plan (${a.slice(0, 46)}… -> ${b.slice(0, 46)}…)`);
}

/** CONTROL 2 — `checkFile` bites on a corrupted after AND on a moved container. */
{
  const f = SCOPE.find((p) => p.includes('practice.html')) ?? SCOPE[0];
  const before = eol(git('show', `${BASE}:${f}`));
  const expected = eol(applyAll(f, before).after);

  const wrongBytes = await checkFile(f, `${expected}\n<!-- not what the transform produces -->`);
  const movedMain = await checkFile(f, expected.replace(/<body([^>]*)>/i, '<body$1><main>x</main>'));
  // A block that landed OUTSIDE the wrapper. This is the failure the ordinal line
  // exists for and the one a reader is most likely to doubt: the close does NOT
  // advance, because the added `</div>` comes after it. A stray div added INSIDE
  // the container is deliberately NOT used here — it shifts the close by exactly
  // one and moves nothing, which is the same true statement this whole report
  // makes about the real diff.
  const outside = await checkFile(f, expected.replace('</body>', '  <div class="stray"></div>\n</body>'));

  const ok = wrongBytes.bad.includes('disk≠transform')
    && movedMain.bad.some((b) => b.startsWith('plan kind'))
    && movedMain.bad.some((b) => b.startsWith('container '))
    && outside.bad.some((b) => b.startsWith('close ordinal shifted'));
  if (!ok) {
    console.error('CONTROL 2 FAILED — checkFile did not report one of the three broken afters.');
    console.error(`  wrong bytes    -> [${wrongBytes.bad.join(', ')}]`);
    console.error(`  added main     -> [${movedMain.bad.join(', ')}]`);
    console.error(`  div outside    -> [${outside.bad.join(', ')}]`);
    process.exit(2);
  }
  console.log(`control 2 OK — on ${f}:`);
  console.log(`  a corrupted after            -> [${wrongBytes.bad.join(', ')}]`);
  console.log(`  an added <main>              -> [${movedMain.bad.join(', ')}]`);
  console.log(`  a <div> outside the wrapper  -> [${outside.bad.join(', ')}]\n`);
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
console.log(`plan kind + open ordinal, nav stack, body children,`);
console.log(`nav/footer subtrees, swap region, container boundary`);
console.log(`ALL HOLD                                   : ${rows.filter((r) => !r.bad.length).length} / ${SCOPE.length}`);
console.log(`something moved (NOT waivable)             : ${moved}\n`);

console.log('per file — close ordinal, </div> the insertion adds, swap region:');
for (const r of rows) {
  const d = `+${r.notes.addedDivs}`;
  console.log(`  ${r.bad.length ? 'MOVED ' : 'ok    '} ${r.file.padEnd(58)} close ${String(r.notes.close).padEnd(10)} divs ${String(d).padEnd(16)} region ${r.notes.region}`);
}
for (const f of unregistered) console.log(`  UNREGISTERED  ${f}`);
for (const r of rows.filter((x) => x.bad.length)) console.log(`  MOVED  ${r.file}  [${r.bad.join(', ')}]`);

process.exitCode = (moved || unregistered.length) ? 1 : 0;
