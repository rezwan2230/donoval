#!/usr/bin/env node
// ── JAY-TRACKING-B2 — evidence for the disclaimer.html structural waiver ─────
//
// `test/chrome-diff.test.mjs` refuses any change to a page's tag structure,
// because the middleware works out where to put the swap container, the
// persistent call layer, the router and the booking bar by COUNTING this page's
// own tags. The register it checks against is a waiver list with written
// reasons, not a switch — so a reason has to be earned, and this script is how.
//
// WHAT IS BEING WAIVED
//
// disclaimer.html gains one policy section: an <h5>, two <p>, two external <a>
// and one <button> — the "ANALYTICS AND ADVERTISING MEASUREMENT" disclosure the
// consent banner links to, plus the opt-out control that makes withdrawal as
// easy as consent.
//
// WHY IT IS SAFE, AND WHAT THAT CLAIM ACTUALLY RESTS ON
//
// **No <div> is added.** The injector's plan is expressed in div ordinals, so a
// block that adds none cannot move it — the same reasoning the JORDAN-PAUL-MOBILE
// waiver rests on, and the opposite of the #226 library band, which added four
// </div> and moved the closing ordinal by exactly four.
//
// That is the claim. This script does not assert it — it MEASURES it, against
// the real `planFromHtml` and the real injector, and prints both sides so a
// reviewer can read the comparison rather than trust the summary.
//
//   node scripts/content/consent-waiver-evidence.mjs [--base origin/main]
//
// Exit 0 = every invariant held. Exit 1 = something moved; the waiver is void.

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { JSDOM } from 'jsdom';
import { planFromHtml } from '../../donovan-legal-site/functions/_lib/perch-main.js';
import { HTMLRewriter } from '../../test/helpers/html-rewriter.mjs';

const FILE = 'donovan-legal-site/disclaimer.html';
const BASE = (process.argv.indexOf('--base') !== -1 && process.argv[process.argv.indexOf('--base') + 1]) || 'origin/main';

const eol = (s) => s.replace(/\r\n/g, '\n');
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const parse = (html) => new JSDOM(eol(html)).window.document;

const sig = (el) => {
  const id = el.id ? `#${el.id}` : '';
  const cls = el.getAttribute('class') ? `.${el.getAttribute('class').trim().split(/\s+/).join('.')}` : '';
  return `${el.tagName.toLowerCase()}${id}${cls}`;
};

/** The div-ancestor stack of the site nav — what the plan's ordinals are counted through. */
function navStack(doc) {
  const nav = doc.querySelector('nav.menubar');
  if (!nav) return '(no nav)';
  const out = [];
  for (let el = nav.parentElement; el && el.tagName !== 'BODY'; el = el.parentElement) out.unshift(sig(el));
  return out.join(' > ');
}

const bodyChildren = (doc) => (doc.body ? [...doc.body.children].map(sig).join(' | ') : '(no body)');
const subtree = (doc, sel) => (doc.querySelector(sel)?.outerHTML ?? '');
const countDivs = (html) => (eol(html).match(/<div\b/gi) || []).length;
const countCloseDivs = (html) => (eol(html).match(/<\/div>/gi) || []).length;
const countEls = (doc) => doc.querySelectorAll('*').length;

const before = git('show', `${BASE}:${FILE}`);
const after = readFileSync(FILE, 'utf8');

const db = parse(before);
const da = parse(after);

const planB = await planFromHtml(eol(before), HTMLRewriter);
const planA = await planFromHtml(eol(after), HTMLRewriter);

const checks = [];
const check = (name, a, b, note = '') => {
  const ok = JSON.stringify(a) === JSON.stringify(b);
  checks.push({ name, ok, a, b, note });
};

// ── The load-bearing one ─────────────────────────────────────────────────────
check('injector plan (kind + both ordinals)', planB, planA,
  'if this moves, the swap container, the persistent layer, the router and the booking bar all land in the wrong place');

// ── Why the plan could not have moved ────────────────────────────────────────
check('<div> count', countDivs(before), countDivs(after), 'the plan is expressed in div ordinals');
check('</div> count', countCloseDivs(before), countCloseDivs(after));

// ── Everything the injector reads around the change ──────────────────────────
check('nav div-ancestor stack', navStack(db), navStack(da));
check('body children', bodyChildren(db), bodyChildren(da));
check('nav subtree (byte for byte)', subtree(db, 'nav.menubar'), subtree(da, 'nav.menubar'));
check('footer subtree (byte for byte)', subtree(db, 'footer'), subtree(da, 'footer'));

// ── The traps chrome-diff names explicitly ───────────────────────────────────
check('no <main> added', db.querySelectorAll('main').length, da.querySelectorAll('main').length);
check('no #concierge added', !!db.querySelector('#concierge'), !!da.querySelector('#concierge'));
check('script[src] manifest', [...db.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')),
  [...da.querySelectorAll('script[src]')].map((s) => s.getAttribute('src')));
check('link[href] manifest', [...db.querySelectorAll('link[href]')].map((l) => l.getAttribute('href')),
  [...da.querySelectorAll('link[href]')].map((l) => l.getAttribute('href')));

const inlineHandlers = [...da.querySelectorAll('*')]
  .filter((el) => el.getAttributeNames().some((n) => /^on/i.test(n))).map(sig);
check('no inline event handlers', [], inlineHandlers,
  'refused by the nonce CSP and by test/repo-invariants.test.mjs');

// ── What DID change, stated rather than glossed ──────────────────────────────
const added = countEls(da) - countEls(db);
const beforeIds = new Set([...db.querySelectorAll('[id]')].map((e) => e.id));
const newIds = [...da.querySelectorAll('[id]')].map((e) => e.id).filter((id) => !beforeIds.has(id));

console.log(`\nJAY-TRACKING-B2 — ${FILE} vs ${BASE}\n${'─'.repeat(72)}`);
for (const c of checks) {
  console.log(`${c.ok ? '  ok  ' : ' FAIL '} ${c.name}`);
  if (!c.ok) {
    console.log(`        before: ${JSON.stringify(c.a)}`);
    console.log(`        after:  ${JSON.stringify(c.b)}`);
    if (c.note) console.log(`        why it matters: ${c.note}`);
  }
}
console.log(`${'─'.repeat(72)}`);
console.log(`  elements added: ${added}  (expected 6 — h5, 2×p, 2×a, button)`);
console.log(`  new ids:        ${newIds.join(', ') || '(none)'}`);
console.log(`  plan:           ${JSON.stringify(planA)}`);

const failed = checks.filter((c) => !c.ok);
if (failed.length) {
  console.error(`\n${failed.length} invariant(s) broken — the waiver does not hold.\n`);
  process.exit(1);
}
console.log('\nEvery invariant held. No <div> added, plan identical, chrome untouched.\n');
