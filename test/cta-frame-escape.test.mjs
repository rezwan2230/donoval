// JORDAN — CTA frame escape (ORDER JORDAN-CTA-FRAME-ESCAPE).
//
// The whole site renders inside the #site iframe on /perch. A tel: or mailto:
// anchor with no target navigates the IFRAME, the shell's frame-src CSP forbids
// those schemes, and Cloudflare answers with the blocked-content page — so
// click-to-call, the phone number and the email were all dead in the frame.
//
// The fix is one sweep in the shared self-hosted script (js/main.js). These
// tests guard it from two directions, because either one alone is vacuous:
//
//   1. TREE  — every page carrying a tel:/mailto: anchor must actually load the
//              shared script (or carry target="_top" in its own markup). A new
//              page that forgets the script is the regression this catches.
//   2. BEHAVIOUR — the shared script must really set target="_top", and must
//              leave the dl-social external links and the in-frame page-nav
//              links alone.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'donovan-legal-site');
const MAIN_JS = join(SITE, 'js', 'main.js');

function walk(dir, filter, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.wrangler' || name === '.git') continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, filter, out);
    else if (filter(p)) out.push(p);
  }
  return out;
}

const rel = (p) => relative(ROOT, p).split(sep).join('/');

// Every document the shell can load into the iframe — .html and .shtml alike.
const pages = walk(SITE, (p) => p.endsWith('.html') || p.endsWith('.shtml'));

// Non-global on purpose: a /g regex carries lastIndex between .test() calls and
// would start skipping files halfway through the walk.
const ANCHOR_SRC = '<a\\b[^>]*\\bhref\\s*=\\s*"\\s*(?:tel|mailto):[^"]*"[^>]*>';
const ANCHOR = new RegExp(ANCHOR_SRC, 'i');
const allAnchors = (src) => src.match(new RegExp(ANCHOR_SRC, 'gi')) || [];
const LOADS_MAIN = /<script[^>]*\bsrc\s*=\s*"[^"]*\/?js\/main\.js"/i;
const HAS_TOP = /\btarget\s*=\s*"\s*_top\s*"/i;

/** Anchors on this page that would navigate the iframe rather than the top frame. */
function unescapedAnchors(src) {
  if (LOADS_MAIN.test(src)) return []; // the shared sweep covers the whole page
  return allAnchors(src).filter((tag) => !HAS_TOP.test(tag));
}

describe('tree invariant — no tel:/mailto: anchor renders without a top-context escape', () => {
  test('the corpus under guard is non-empty (control)', () => {
    // If a refactor ever empties this list, the invariant below silently stops
    // asserting anything. Fail loudly instead.
    const withAnchors = pages.filter((p) => ANCHOR.test(readFileSync(p, 'utf8')));
    assert.ok(pages.length > 50, `only ${pages.length} pages walked`);
    assert.ok(withAnchors.length > 50, `only ${withAnchors.length} pages carry tel:/mailto:`);
  });

  test('every page with a tel:/mailto: anchor resolves target=_top', () => {
    const offenders = [];
    for (const p of pages) {
      const bad = unescapedAnchors(readFileSync(p, 'utf8'));
      if (bad.length) offenders.push(`${rel(p)} (${bad.length})`);
    }
    assert.deepEqual(
      offenders,
      [],
      'these pages would navigate the iframe to tel:/mailto: and hit the ' +
        `blocked-content page — load js/main.js or add target="_top": ${offenders.join(', ')}`,
    );
  });

  test('the guard would actually fire (control)', () => {
    // A new page with the CTA but no shared script is the exact regression.
    const newPage =
      '<!doctype html><body><a class="dl-connect-cta" href="tel:+15616666022">Call</a></body>';
    assert.equal(unescapedAnchors(newPage).length, 1);

    // …and markup-level escape is accepted as an alternative.
    const markupEscape =
      '<!doctype html><body><a href="mailto:info@donovan.law" target="_top" rel="noopener">Mail</a></body>';
    assert.equal(unescapedAnchors(markupEscape).length, 0);
  });
});

describe('behaviour — the shared script performs the escape', () => {
  const mainSrc = readFileSync(MAIN_JS, 'utf8');
  let doc;

  before(() => {
    const dom = new JSDOM(
      `<!doctype html><body>
         <a class="dl-connect-cta" id="cta" href="tel:+15616666022">Call the firm</a>
         <a id="phone" href="tel:+15616666022">(561) 666-6022</a>
         <a id="mail" href="mailto:info@donovan.law">info@donovan.law</a>
         <a id="mail-subject" href="mailto:info@donovan.law?subject=Hello">Mail</a>
         <a id="social" class="dl-social-link" href="https://www.facebook.com/x" target="_blank" rel="noopener noreferrer">Facebook</a>
         <a id="nav" href="contact.html">Contact</a>
       </body>`,
      { runScripts: 'outside-only' },
    );
    // main.js is a jQuery file; the escape is deliberately vanilla and FIRST, so
    // it still runs when jQuery is absent. Swallowing the later ReferenceError
    // is the point of the assertion, not a workaround for it.
    try {
      dom.window.eval(mainSrc);
    } catch (e) {
      assert.match(String(e), /\$ is not defined|jQuery is not defined/);
    }
    doc = dom.window.document;
  });

  test('the escape is declared before the first jQuery call', () => {
    const escapeAt = mainSrc.indexOf('tel:/mailto: frame escape');
    const jqAt = mainSrc.search(/^\s*(?:\$|jQuery)\s*\(/m);
    assert.ok(escapeAt >= 0, 'the frame-escape block is gone from js/main.js');
    assert.ok(jqAt >= 0 && escapeAt < jqAt, 'the escape must run before jQuery can throw');
  });

  for (const id of ['cta', 'phone', 'mail', 'mail-subject']) {
    test(`#${id} opens in the top browsing context`, () => {
      const a = doc.getElementById(id);
      assert.equal(a.getAttribute('target'), '_top');
      assert.match(a.getAttribute('rel'), /noopener/);
    });
  }

  test('the href, phone number and address are untouched', () => {
    assert.equal(doc.getElementById('phone').getAttribute('href'), 'tel:+15616666022');
    assert.equal(doc.getElementById('mail').getAttribute('href'), 'mailto:info@donovan.law');
  });

  test('dl-social external links keep target=_blank', () => {
    const a = doc.getElementById('social');
    assert.equal(a.getAttribute('target'), '_blank');
    assert.equal(a.getAttribute('rel'), 'noopener noreferrer');
  });

  test('in-frame page navigation stays in the frame', () => {
    assert.equal(doc.getElementById('nav').getAttribute('target'), null);
  });
});
