#!/usr/bin/env node
/**
 * JORDAN-195-LEVELA-WAIVER-R1 — evidence for the `REVIEWED_STRUCTURAL` entries.
 *
 * ── WHAT A WAIVER ENTRY ACTUALLY CLAIMS ──────────────────────────────────────
 *
 * `test/chrome-diff.test.mjs` describes its register as "an assertion by a named
 * human that they ran the injector over that file's before and after and
 * compared the plans." A request that only *says* "these edits are safe" asks
 * Zane to take that on trust. This script produces the comparison instead.
 *
 * For every file the waiver covers it:
 *   1. recovers the BEFORE from `origin/main` with `git show`,
 *   2. requires the file ON DISK to be byte-identical to the reviewed transforms
 *      applied to that before — so the register describes the diff that actually
 *      shipped and not a hypothetical one,
 *   3. runs the REAL `planFromHtml` from `functions/_lib/perch-main.js` over the
 *      before and the after,
 *   4. runs the three guards `structuralWaiver` itself enforces — the nav's
 *      div-ancestor stack, the ordered body children, and the size of the region
 *      the server would wrap — and
 *   5. reports any file where any of them moved.
 *
 * It also requires that NO file outside the register changed, so "every entry is
 * backed by evidence" and "every changed page has an entry" are both proved
 * rather than only the first.
 *
 * ── WHY IT READS `git show` AND NOT A TRANSFORM OF THE WORKING TREE ──────────
 *
 * The version of this script in PR #220 sized the request before anything was
 * applied: it transformed the working tree in memory and compared that against
 * itself. That is the right instrument for a request and the WRONG one for a
 * shipped diff — once the edits are on disk the transforms are no-ops, every
 * file reports "no edit applies", and the run goes green having compared
 * nothing. Reading the before out of git is what keeps this measurement alive
 * after the edit lands.
 *
 * This script CHANGES NOTHING ON DISK. It is evidence, not a migration.
 *
 * Usage:
 *   node scripts/a11y/waiver-evidence.mjs [--base origin/main]
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { planFromHtml } from '../../donovan-legal-site/functions/_lib/perch-main.js';
// The same lol-html stand-in `test/chrome-diff.test.mjs` drives the injector
// with. `planFromHtml` takes the rewriter as an argument precisely so it can be
// run outside the Workers runtime; it is NOT a global, and it is NOT optional —
// see the control below, which proves this harness can tell two plans apart.
import { HTMLRewriter } from '../../test/helpers/html-rewriter.mjs';
import { SCOPE, applyAll } from './waiver-edits.mjs';

const SITE = 'donovan-legal-site';
const BASE = (process.argv.indexOf('--base') !== -1 && process.argv[process.argv.indexOf('--base') + 1]) || 'origin/main';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 28 });

/**
 * Line endings are normalised on both sides before anything is compared, for the
 * same reason `chrome-diff.test.mjs` does it: git stores these blobs with bare
 * LF and `core.autocrlf` checks them out with CRLF, so a byte comparison of the
 * recovered before against the file on disk fails on carriage returns alone.
 */
const eol = (s) => s.replace(/\r\n?/g, '\n');

// ── The three guards, mirrored from chrome-diff.test.mjs ─────────────────────

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

/**
 * The two subtrees chrome-diff compares byte for byte and NEVER waives.
 * `REVIEWED_STRUCTURAL` suppresses `page-structure` only, so an edit that
 * strayed into the shared nav or the footer would be unwaivable no matter what
 * the plan did. Measured here rather than left to the gate, because a reader of
 * this evidence has to be able to see that it was measured.
 */
const subtree = (doc, sel) => (doc.querySelector(sel)?.outerHTML ?? '');

// ── Controls ─────────────────────────────────────────────────────────────────

/**
 * CONTROL 1 — this harness can tell two plans apart.
 *
 * Without it the whole report is worthless in a way that LOOKS like success:
 * `planFromHtml` is async and takes the rewriter as its second argument, so
 * calling it as `planFromHtml(html)` and comparing the results returns a pair of
 * `{}` from `JSON.stringify(Promise)` — every file then reports "identical" and
 * the run goes green having compared nothing. That is exactly what the first
 * version of this script did. So before measuring anything, take a real page,
 * make a change the injector is known to notice, and require the plan to MOVE.
 */
const probe = readFileSync(`${SITE}/practice.html`, 'utf8');
const planOf = (html) => planFromHtml(eol(html), HTMLRewriter);
const controlBefore = JSON.stringify(await planOf(probe));
// Adding a <main> is the documented way to flip decidePlan onto another branch.
const controlAfter = JSON.stringify(await planOf(probe.replace(/<body([^>]*)>/i, '<body$1><main>x</main>')));
if (!controlBefore || controlBefore === '{}' || controlBefore === controlAfter) {
  console.error('CONTROL 1 FAILED — this harness cannot distinguish two plans, so every');
  console.error(`"identical" below would be meaningless. before=${controlBefore} after=${controlAfter}`);
  process.exit(2);
}
console.log(`control 1 OK — a <main> moves the plan (${controlBefore.slice(0, 48)}… -> ${controlAfter.slice(0, 48)}…)`);

/**
 * The whole per-file measurement, as one function.
 *
 * `actual` is passed in rather than read inside, so CONTROL 2 can drive this
 * exact code path with a deliberately wrong "after" and require it to complain.
 * A check that is only ever called on the happy path is not a check.
 */
async function checkFile(file, actual) {
  const before = eol(git('show', `${BASE}:${file}`));
  const expected = eol(applyAll(file, before).after);
  const bad = [];
  if (expected !== eol(actual)) bad.push('disk≠transform');

  const db = parse(before);
  const da = parse(actual);
  const checks = {
    plan: [JSON.stringify(await planOf(before)), JSON.stringify(await planOf(actual))],
    nav: [navAncestors(db), navAncestors(da)],
    body: [bodyChildren(db), bodyChildren(da)],
    region: [String(swapRegion(db)), String(swapRegion(da))],
    'nav subtree': [subtree(db, SITE_NAV), subtree(da, SITE_NAV)],
    'footer subtree': [subtree(db, '.copy-inside'), subtree(da, '.copy-inside')],
  };
  for (const [what, [x, y]] of Object.entries(checks)) if (x !== y) bad.push(what);
  return bad;
}

/**
 * CONTROL 2 — the per-file check bites, on both of the things it claims.
 *
 * Every "identical" printed below is `checkFile` returning an empty list. An
 * empty list is also what a broken `checkFile` returns, so before trusting 81 of
 * them, feed it two afters that are definitely wrong — one that is not what the
 * transform produces, and one whose PLAN moves — and require it to name each.
 */
{
  const f = SCOPE.find((p) => p.startsWith(`${SITE}/`) && !p.includes('/blog-')) ?? SCOPE[0];
  const before = eol(git('show', `${BASE}:${f}`));
  const expected = eol(applyAll(f, before).after);

  const wrongBytes = await checkFile(f, `${expected}\n<!-- not what the transform produces -->`);
  const movedPlan = await checkFile(f, expected.replace(/<body([^>]*)>/i, '<body$1><main>x</main>'));
  if (!wrongBytes.includes('disk≠transform') || !movedPlan.includes('plan')) {
    console.error('CONTROL 2 FAILED — checkFile did not report a corrupted after and/or a moved plan.');
    console.error(`  wrong bytes -> [${wrongBytes.join(', ')}]`);
    console.error(`  moved plan  -> [${movedPlan.join(', ')}]`);
    process.exit(2);
  }
  console.log(`control 2 OK — on ${f} a corrupted after reports [${wrongBytes.join(', ')}] and an added <main> reports [${movedPlan.join(', ')}]\n`);
}

// ── Run ──────────────────────────────────────────────────────────────────────

/**
 * Every page that differs from the base. The register has to cover all of them:
 * a waived entry with no diff is noise, and a diff with no entry is the thing
 * the gate exists to stop.
 */
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
  const bad = await checkFile(file, readFileSync(file, 'utf8'));
  if (bad.includes('disk≠transform')) mismatched++;
  if (bad.length) moved++;
  rows.push({ file, bad });
}

const clean = rows.filter((r) => !r.bad.length);
console.log(`base                                    : ${BASE}`);
console.log(`pages changed on this branch            : ${changed.length}`);
console.log(`pages in the waiver register            : ${SCOPE.length}`);
console.log(`changed pages with NO register entry    : ${unregistered.length}`);
console.log(`disk matches the reviewed transform     : ${SCOPE.length - mismatched} / ${SCOPE.length}`);
console.log(`plan + nav + body + region + nav/footer subtree IDENTICAL : ${clean.length}`);
console.log(`something moved (NOT waivable)          : ${moved}`);
for (const f of unregistered) console.log(`  UNREGISTERED  ${f}`);
for (const r of rows.filter((x) => x.bad.length)) console.log(`  MOVED  ${r.file}  [${r.bad.join(', ')}]`);

process.exitCode = (moved || unregistered.length) ? 1 : 0;
