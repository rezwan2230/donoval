#!/usr/bin/env node
/**
 * JORDAN-TOOL-DEDUPE — evidence for the `REVIEWED_STRUCTURAL` ALSO clauses and the
 * `REVIEWED_REMOVAL` budgets this order adds (#232).
 *
 * Same instrument as `scripts/content/mobile-waiver-evidence.mjs` (#226 part A),
 * which was `scripts/content/waiver-evidence.mjs` (#229), which was
 * `scripts/a11y/waiver-evidence.mjs` (#221). For every file the waiver covers it:
 *   1. recovers the BEFORE from `origin/main` with `git show`,
 *   2. requires the file ON DISK to be byte-identical to the reviewed transform
 *      applied to that before — so the register describes the diff that actually
 *      shipped and not a hypothetical one,
 *   3. runs the REAL `planFromHtml` from `functions/_lib/perch-main.js`,
 *   4. runs the guards `structuralWaiver` enforces — the nav's div-ancestor stack,
 *      the ordered body children, the size of the region the server would wrap,
 *      plus the nav and footer subtrees the waiver may never cover — and
 *   5. reports any file where any of them moved.
 *
 * ── WHERE THIS DIFFERS FROM #226 AND #229, AND WHY IT HAS TO ────────────────
 *
 * Both of those orders ADDED markup. This one DELETES it, and that inverts the two
 * assertions those scripts are built around:
 *
 *   • THE CLOSING ORDINAL RETREATS. #229 derived how far `closeBeforeDivEnd` was
 *     allowed to ADVANCE from the number of `</div>` the block added; #226 part A
 *     added none, so the derived allowance was zero. Here the block TAKES ONE
 *     WITH IT, so the same line of code derives −1 and the close must retreat by
 *     exactly one. It is the same arithmetic with a negative numerator, kept
 *     deliberately identical so this order cannot be accused of having been given
 *     an easier test.
 *
 *   • THE SWAP REGION SHRINKS. Every previous order could satisfy the shrink
 *     guard by not shrinking. This one cannot, so it has to prove the thing the
 *     guard is a proxy for. Region and document element counts are both measured
 *     and required to fall by the SAME number: content that leaves the container
 *     but stays on the page moves one and not the other, and that is the failure
 *     `REVIEWED_REMOVAL` must never wave through.
 *
 * Three things it measures that an additive order had no reason to, because three
 * things are how a deletion fails while still looking tidy in the diff:
 *
 *   • THE BLOCK IS GONE FROM THE DOCUMENT, not merely from where it was. Every
 *     removed element is looked for again ANYWHERE in the after — `.tool-cta`, the
 *     heading text, and the `a.cta-link` — because a block that was cut and pasted
 *     one wrapper up reads as a clean deletion in a line-based diff.
 *
 *   • EXACTLY ONE CALL TO ACTION SURVIVES, and it is the new one. The whole point
 *     of the order is that two stacked; a page that lost both is not fixed, it is
 *     broken differently, and nothing else in this report would notice.
 *
 *   • EVERYTHING ELSE IS BYTE-IDENTICAL. The before with the block excised is
 *     compared to the after as bytes, so no wording, attribute or whitespace
 *     change anywhere else on the page can ride along under this waiver.
 *
 * This script CHANGES NOTHING ON DISK. It is evidence, not a migration.
 *
 * Usage:
 *   node scripts/content/tool-cta-waiver-evidence.mjs [--base origin/main]
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { planFromHtml, injectHandlers, CONTAINER_ID } from '../../donovan-legal-site/functions/_lib/perch-main.js';
import { HTMLRewriter } from '../../test/helpers/html-rewriter.mjs';

const SITE = 'donovan-legal-site';
const BASE = (process.argv.indexOf('--base') !== -1 && process.argv[process.argv.indexOf('--base') + 1]) || 'origin/main';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });
const eol = (s) => s.replace(/\r\n?/g, '\n');
const parse = (html) => new JSDOM(eol(html)).window.document;

/**
 * The six pages this order de-duplicates: the ones that carry BOTH the legacy
 * `div.tool-cta` and the #225 `div.dl-endcap > div.dl-cta`.
 *
 * The four tier copies of the rental analyzer under `diamond/`, `gold/`,
 * `platinum/` and `reserve/` carry the legacy block and NO new one, so removing it
 * there would leave those pages with no call to action at all. `SCOPE_IS_COMPLETE`
 * below re-derives this list from the tree rather than trusting it.
 */
const SCOPE = [
  'tool-capital-gains.html',
  'tool-firpta-withholding.html',
  'tool-irs-notice-guide.html',
  'tool-oic-rcp-estimator.html',
  'tool-rental-real-estate-tax-strategy-analyzer.html',
  'tool-str-strategy-analyzer.html',
].map((f) => `${SITE}/${f}`);

// ── The guards, mirrored from chrome-diff.test.mjs ───────────────────────────

const SITE_NAV = 'nav.menubar';
const PERSISTENT_CLASS = 'dl-callbar';
const PERSISTENT_ID = 'dvn-perch-root';
const NON_CONTENT = ['SCRIPT', 'NOSCRIPT', 'TEMPLATE'];

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

const countCloseDivs = (s) => (eol(s).match(/<\/div>/g) || []).length;
const countElements = (doc) => doc.querySelectorAll('*').length;

// ── The transform this order applied, restated so disk can be checked ────────

/**
 * The legacy block as it appears in source: the `div.tool-cta` open tag through
 * its close, plus the blank line that separated it from `div.tool-back`.
 *
 * Matched non-greedily against the FIRST `</div>` at the block's own indentation,
 * so a nested div inside it could not swallow the rest of the page. Every one of
 * the six is a flat four-element block, and `exactlyOneBlock` proves the match is
 * the whole of it rather than a prefix.
 */
const LEGACY_BLOCK = /( *)<div class="tool-cta">\r?\n[\s\S]*?\r?\n\1<\/div>\r?\n\r?\n/;

/** The before with exactly the legacy block excised, and nothing else touched. */
function removeLegacyBlock(before) {
  const m = before.match(LEGACY_BLOCK);
  if (!m) return { ok: false, why: 'no div.tool-cta block found in the before' };
  return { ok: true, after: before.replace(LEGACY_BLOCK, ''), removed: m[0] };
}

// ── Running the real injector ────────────────────────────────────────────────

const planOf = (html) => planFromHtml(eol(html), HTMLRewriter);

/** The page as the edge would actually serve it: pass 2, with pass 1's plan. */
async function inject(html) {
  const src = eol(html);
  const plan = await planOf(src);
  const rewriter = new HTMLRewriter();
  for (const [selector, handlers] of injectHandlers(plan)) rewriter.on(selector, handlers);
  const out = await rewriter.transform(new Response(src)).text();
  await rewriter.free?.();
  return out;
}

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
  };
}

// ── The three checks a DELETION needs and an addition did not ────────────────

/** Everything the removed block contained, looked for ANYWHERE in the after. */
function blockIsGoneFromTheDocument(removedSource, afterDoc, afterSource) {
  const removed = parse(`<body>${removedSource}</body>`);
  const gone = [];

  if (afterDoc.querySelectorAll('.tool-cta').length > 0) gone.push('a .tool-cta survives somewhere on the page');

  const heading = removed.querySelector('h4')?.textContent?.trim();
  if (heading && eol(afterSource).includes(heading)) gone.push(`the heading text "${heading}" is still on the page`);

  const link = removed.querySelector('a.cta-link');
  if (link && [...afterDoc.querySelectorAll('a.cta-link')].some((a) => a.outerHTML === link.outerHTML)) {
    gone.push('the a.cta-link survives somewhere on the page');
  }
  return gone;
}

/** Exactly one call to action must survive, and it must be the new one. */
function callsToAction(doc) {
  return {
    legacy: doc.querySelectorAll('.tool-cta').length,
    endcap: doc.querySelectorAll('.dl-endcap').length,
    dlCta: doc.querySelectorAll('.dl-cta').length,
  };
}

/** The match is the WHOLE block, not a prefix of it. */
function exactlyOneBlock(before, removedSource) {
  const problems = [];
  const opens = (eol(before).match(/<div class="tool-cta">/g) || []).length;
  if (opens !== 1) problems.push(`the before has ${opens} div.tool-cta open tags, so "the block" is ambiguous`);
  // Counted inside <body>, not across the document: JSDOM synthesises <html>,
  // <head> and <body> around a fragment, and counting those made every file look
  // like a seven-element block.
  const inner = parse(`<body>${removedSource}</body>`).body;
  const n = inner.querySelectorAll('*').length;
  if (n !== 4) problems.push(`the removed source parses to ${n} elements, not the 4 the budget declares`);
  if ((removedSource.match(/<div/g) || []).length !== 1) problems.push('the removed source contains a nested <div>, so the match ran past the block');
  return problems;
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
  const bad = [];
  const notes = {};

  const cut = removeLegacyBlock(before);
  if (!cut.ok) return { file, bad: [cut.why], notes };
  if (cut.after !== after) bad.push('disk≠transform');
  bad.push(...exactlyOneBlock(before, cut.removed));

  const db = parse(before);
  const da = parse(after);

  for (const [what, x, y] of [
    ['nav', navAncestors(db), navAncestors(da)],
    ['body', bodyChildren(db), bodyChildren(da)],
    ['nav subtree', subtree(db, SITE_NAV), subtree(da, SITE_NAV)],
    ['footer subtree', subtree(db, '.copy-inside'), subtree(da, '.copy-inside')],
  ]) if (x !== y) bad.push(what);

  // 1. The region and the document must fall by the SAME number. This is the
  //    whole basis of the REVIEWED_REMOVAL budget: a block that MOVED out of the
  //    container shrinks the region and leaves the document count flat.
  const [rb, ra] = [swapRegion(db), swapRegion(da)];
  const [eb, ea] = [countElements(db), countElements(da)];
  notes.region = `${rb}→${ra}`;
  notes.document = `${eb}→${ea}`;
  if (rb - ra !== 4) bad.push(`region fell by ${rb - ra}, the budget declares 4`);
  if (eb - ea !== rb - ra) bad.push(`region fell by ${rb - ra} but the document fell by ${eb - ea} — the difference MOVED rather than being deleted`);

  // 2. The plan's KIND and OPENING ordinal must not move at all.
  const [pb, pa] = [await planOf(before), await planOf(after)];
  if (pb.kind !== pa.kind) bad.push(`plan kind ${pb.kind}→${pa.kind}`);
  if (pb.openAfterDivEnd !== pa.openAfterDivEnd) bad.push('plan open ordinal');
  if (pb.closeBeforePersistent !== pa.closeBeforePersistent) bad.push('plan close-before-persistent');
  notes.kind = pb.kind;
  notes.open = `${pb.openAfterDivEnd}`;

  // 3. The CLOSING ordinal may only move by the number of `</div>` this diff
  //    changes — the same line of code as #229 and #226 part A, with a negative
  //    numerator, so the close must RETREAT by exactly one.
  const addedDivs = countCloseDivs(after) - countCloseDivs(before);
  const shift = (pa.closeBeforeDivEnd ?? 0) - (pb.closeBeforeDivEnd ?? 0);
  notes.close = `${pb.closeBeforeDivEnd}→${pa.closeBeforeDivEnd}`;
  notes.divs = `${addedDivs}`;
  if (shift !== addedDivs) bad.push(`close ordinal shifted ${shift}, the diff changes ${addedDivs} </div>`);

  // 4. The block is gone from the DOCUMENT, not just from where it was.
  bad.push(...blockIsGoneFromTheDocument(cut.removed, da, after));

  // 5. Exactly one call to action survives, and it is the new one.
  const ctaBefore = callsToAction(db);
  const ctaAfter = callsToAction(da);
  notes.cta = `legacy ${ctaBefore.legacy}→${ctaAfter.legacy}, dl-cta ${ctaBefore.dlCta}→${ctaAfter.dlCta}`;
  if (ctaBefore.legacy !== 1 || ctaBefore.dlCta !== 1) bad.push(`the before did not carry exactly two calls to action (legacy ${ctaBefore.legacy}, dl-cta ${ctaBefore.dlCta})`);
  if (ctaAfter.legacy !== 0) bad.push(`${ctaAfter.legacy} legacy blocks survive`);
  if (ctaAfter.dlCta !== 1 || ctaAfter.endcap !== 1) bad.push(`the page must keep exactly one dl-endcap > dl-cta; it has ${ctaAfter.endcap} / ${ctaAfter.dlCta}`);

  // 6. Under the REAL injector, the container lands in the same place.
  const [cb, ca] = [containerContext(await inject(before)), containerContext(await inject(after))];
  if (!cb.present || !ca.present) bad.push('the real injector wrote no container');
  else for (const k of ['parent', 'prev', 'next', 'first', 'last']) {
    if (cb[k] !== ca[k]) bad.push(`container ${k} ${cb[k]} → ${ca[k]}`);
  }

  return { file, bad, notes };
}

// ── Controls: the report must be able to say no ──────────────────────────────

/**
 * Three deliberately wrong "after"s driven through the SAME `checkFile`. A report
 * that only ever runs on the shipped bytes cannot distinguish "nothing moved"
 * from "nothing was measured".
 */
async function controls() {
  const file = SCOPE[0];
  const before = eol(git('show', `${BASE}:${file}`));
  const cut = removeLegacyBlock(before);
  const out = [];

  // (a) the block MOVED rather than deleted — the failure the budget exists for.
  const relocated = cut.after.replace('</nav>\n', `</nav>\n${cut.removed}`);
  out.push(['a relocated block is caught', (await checkFile(file, relocated)).bad]);

  // (b) the block left behind entirely — the gate must not call that clean.
  out.push(['an untouched page is caught', (await checkFile(file, before)).bad]);

  // (c) a wording edit riding along under the waiver.
  const alsoReworded = cut.after.replace('All Calculators', 'Every Calculator');
  out.push(['a wording edit riding along is caught', (await checkFile(file, alsoReworded)).bad]);

  return out;
}

/** The scope is re-derived from the tree, not trusted. */
function scopeIsComplete() {
  // Every tracked file under the site whose basename starts `tool-`, filtered in
  // JS rather than by pathspec: `donovan-legal-site/**/tool-*.html` matches only
  // the tier subdirectories and silently omits the six pages at the site root,
  // which made this report say "0 pages carry both blocks".
  const tracked = git('ls-files', SITE).trim().split(/\r?\n/)
    .filter((f) => /(^|\/)tool-[^/]*\.html$/.test(f));
  const stacked = [];
  const legacyOnly = [];
  for (const f of tracked) {
    const doc = parse(readFileSync(f, 'utf8'));
    const before = parse(git('show', `${BASE}:${f}`));
    if (before.querySelector('.tool-cta') && before.querySelector('.dl-cta')) stacked.push(f);
    else if (before.querySelector('.tool-cta')) legacyOnly.push({ f, stillThere: !!doc.querySelector('.tool-cta') });
  }
  return { stacked, legacyOnly };
}

// ── Report ───────────────────────────────────────────────────────────────────

const results = [];
for (const file of SCOPE) results.push(await checkFile(file, readFileSync(file, 'utf8')));

console.log('JORDAN-TOOL-DEDUPE (#232) — REVIEWED_STRUCTURAL / REVIEWED_REMOVAL evidence');
console.log(`base: ${BASE}\n`);

for (const { file, bad, notes } of results) {
  console.log(`${bad.length === 0 ? 'OK  ' : 'FAIL'} ${file}`);
  console.log(`       plan ${notes.kind} open ${notes.open} close ${notes.close} (</div> ${notes.divs})`);
  console.log(`       region ${notes.region}   document ${notes.document}   ${notes.cta}`);
  if (bad.length) console.log(`       ${bad.join('; ')}`);
}

const { stacked, legacyOnly } = scopeIsComplete();
console.log('\nSCOPE, re-derived from the tree:');
console.log(`  pages carrying BOTH blocks on ${BASE}: ${stacked.length}`);
for (const f of stacked) console.log(`    ${f}${SCOPE.includes(f) ? '' : '   <-- NOT IN SCOPE'}`);
console.log(`  pages carrying the legacy block and NO new one (deliberately untouched): ${legacyOnly.length}`);
for (const { f, stillThere } of legacyOnly) console.log(`    ${f}${stillThere ? '' : '   <-- WAS EDITED, and should not have been'}`);

console.log('\nCONTROLS (each must report at least one failure):');
let controlsOk = true;
for (const [what, bad] of await controls()) {
  const ok = bad.length > 0;
  controlsOk &&= ok;
  console.log(`  ${ok ? 'OK  ' : 'FAIL'} ${what}${ok ? ` — ${bad.join('; ')}` : ' — reported nothing, so the instrument is not measuring'}`);
}

const scopeOk = stacked.length === SCOPE.length
  && stacked.every((f) => SCOPE.includes(f))
  && legacyOnly.every(({ stillThere }) => stillThere);
const filesOk = results.every((r) => r.bad.length === 0);

console.log(`\n${filesOk && scopeOk && controlsOk ? 'ALL CLEAR' : 'PROBLEMS FOUND'}`);
process.exit(filesOk && scopeOk && controlsOk ? 0 : 1);
