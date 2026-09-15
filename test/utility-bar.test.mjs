// JORDAN-HEADER-UTILITY-BAR — the top utility bar, proved from the served bytes.
//
// The whole claim of this ticket is "sitewide from one middleware change", so
// every assertion below drives the REAL middleware over the REAL page tree and
// reads the bytes it emits. Nothing here inspects the injector's source strings
// for a spelling; the one place a constant is imported (BAR_STYLESHEET) it is used
// to look up a parsed DOM node, not to grep for text — an escaped or mangled
// attribute would still spell the payload in the raw HTML while parsing to
// something else entirely.
//
// FIVE THINGS ARE UNDER GUARD, and each one is a defect that would otherwise ship
// looking fine:
//
//   1. COVERAGE. The bar must reach every page from one handler. A gate that
//      quietly matched 90 pages instead of 141 would look identical on the home
//      page, which is the only page anyone screenshots.
//   2. THE TWO TARGETS. Elroy proved a link in the Perch iframe with no explicit
//      target is swallowed. Measured on the Preview: strip target="_top" off the
//      CTA and the booking page loads INSIDE the orb-sized iframe while the top
//      window stays on the 37-character shell. The tests below pin the two facts
//      that make _top sufficient on its own — Swup's opt-out predicate, and the
//      router's framed early-return — so either one moving re-opens the question.
//   3. THE FOOTER IS UNTOUCHED BY THE BAR. Top and bottom must BOTH be present.
//      The sticky .dl-callbar is compared byte-for-byte between the source page
//      and the served page, and so is the .dl-connect block — except that since
//      #223 a SECOND injector writes the Florida Bar office-city line into
//      .dl-connect, so the comparison there is against source-plus-that-exact-
//      line rather than against source. Still byte-for-byte, still fails if the
//      bar disturbs the footer; see the long note above that test.
//   4. NOTHING INLINE IS INJECTED. The middleware issues a per-request nonce CSP.
//      The bar's answer to that is to inject no inline style and no inline script
//      at all, which is a stronger property than a correctly-nonced one — so the
//      test asserts the absence, not the nonce.
//   5. THE STYLESHEET ACTUALLY REACHES THE PAGE. 26 pages do not load
//      css/main.css; if the bar's rules had gone in there, those 26 would have
//      shipped an unstyled bar. The sheet is injected next to the markup instead,
//      and every page carrying a bar is checked for the reference.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { HTMLRewriter } from './helpers/html-rewriter.mjs';
import { onRequest } from '../donovan-legal-site/functions/_middleware.js';
import { CONTAINER_ID } from '../donovan-legal-site/functions/_lib/perch-main.js';
import {
  BAR_STYLESHEET,
  BOOKING_HREF,
  SOCIAL,
  wantsBar,
} from '../donovan-legal-site/functions/_lib/utility-bar-inject.js';
import { OFFICE_CITY_HTML } from '../donovan-legal-site/functions/_lib/footer-inject.js';

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'donovan-legal-site');
const CONTAINER_SELECTOR = `main#${CONTAINER_ID}`;
const BAR = '.dl-ubar';

/**
 * The two documents that must NOT get a bar, and why. Same set as
 * EXPECTED_SKIPS in test/perch-main.test.mjs, because the gate is the same
 * `plan.kind !== 'skip'` predicate — that identity is the point.
 */
const EXPECTED_SKIPS = {
  // 'perch.html' stood here — the concierge shell. Removed with the voice
  // concierge: it authored the orb and iframed the real site, and both of those
  // are gone. Its absence from this list is the point, not an oversight.
  'nav-block.html': 'a nav-only fragment with no swappable content (referenced by 0 pages)',
};

// ── Page set, served through the real middleware ──────────────────────────────

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

async function serve(html, url) {
  const saved = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = HTMLRewriter;
  try {
    const request = new Request(url, { headers: { 'sec-fetch-dest': 'document' } });
    const res = await onRequest({
      request,
      next: async () => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    });
    return await res.text();
  } finally {
    globalThis.HTMLRewriter = saved;
  }
}

const PAGES = [];
for (const file of walk(SITE)) {
  const rel = path.relative(SITE, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  const served = await serve(source, `https://www.donovan.law/${rel}`);
  PAGES.push({
    rel,
    source,
    served,
    before: new JSDOM(source).window.document,
    after: new JSDOM(served).window.document,
  });
}

const WITH_BAR = PAGES.filter((p) => !EXPECTED_SKIPS[p.rel]);

/** The three pages the order names explicitly: home, a tool page, and contact. */
const NAMED = ['index.html', 'tool-firpta-withholding.html', 'contact.html'];

// ── 1. Coverage ───────────────────────────────────────────────────────────────

describe('utility bar — sitewide from one middleware change', () => {
  test('the page set is the one we think it is (control)', () => {
    assert.ok(PAGES.length >= 140, `expected the whole site, got ${PAGES.length} pages`);
    console.log(`      page set: ${PAGES.length} html files, ${WITH_BAR.length} expected to carry the bar`);
  });

  test('every page renders exactly one utility bar', () => {
    const wrong = [];
    for (const p of WITH_BAR) {
      const n = p.after.querySelectorAll(BAR).length;
      if (n !== 1) wrong.push(`${p.rel}: ${n}`);
    }
    assert.deepEqual(wrong, [], `pages without exactly one ${BAR}`);
  });

  test('the skip set is exact in both directions', () => {
    const actual = PAGES.filter((p) => p.after.querySelectorAll(BAR).length === 0).map((p) => p.rel).sort();
    assert.deepEqual(actual, Object.keys(EXPECTED_SKIPS).sort(),
      'a page started or stopped getting the bar — update EXPECTED_SKIPS with the reason');
  });

  test('no source file was edited to get it', () => {
    // The entire premise: 143 hand-authored pages, zero page edits. If the bar
    // ever appears in a page's own bytes, this ticket's mechanism has been
    // abandoned and the 144th page will not get one.
    const authored = PAGES.filter((p) => /dl-ubar/.test(p.source)).map((p) => p.rel);
    assert.deepEqual(authored, [], 'pages that author the bar themselves instead of receiving it');
  });

  test('home, a tool page and contact all carry it (the pages the order names)', () => {
    for (const rel of NAMED) {
      const p = PAGES.find((q) => q.rel === rel);
      assert.ok(p, `${rel} is missing from the tree`);
      assert.equal(p.after.querySelectorAll(BAR).length, 1, `${rel} has no bar`);
    }
  });

  test('the gate is the same predicate as the layer and the router (control)', () => {
    assert.equal(wantsBar({ kind: 'skip', reason: 'perch shell' }), false);
    assert.equal(wantsBar({ kind: 'wrap-div' }), true);
    assert.equal(wantsBar({ kind: 'wrap-body' }), true);
    assert.equal(wantsBar({ kind: 'stamp' }), true);
    assert.equal(wantsBar(null), false);
  });
});

// ── 2. Placement ──────────────────────────────────────────────────────────────

describe('utility bar — placement', () => {
  test('the bar resolves OUTSIDE the swap container', () => {
    // Inside it, a Swup soft navigation would tear the bar down and rebuild it on
    // every visit — flicker, and a lost :focus for a keyboard user.
    const inside = [];
    for (const p of WITH_BAR) {
      const container = p.after.querySelector(CONTAINER_SELECTOR);
      const bar = p.after.querySelector(BAR);
      if (container && container.contains(bar)) inside.push(p.rel);
    }
    assert.deepEqual(inside, [], 'pages where the bar is inside the swap container');
  });

  test('the bar is the first element in <body>', () => {
    const wrong = [];
    for (const p of WITH_BAR) {
      const first = p.after.body.firstElementChild;
      if (!first || !first.classList.contains('dl-ubar')) wrong.push(`${p.rel}: ${first && first.tagName}`);
    }
    assert.deepEqual(wrong, [], 'pages where the bar is not the first body child');
  });

  test('the bar precedes the site nav where there is one', () => {
    const wrong = [];
    for (const p of WITH_BAR) {
      const nav = p.after.querySelector('nav.menubar');
      if (!nav) continue;
      const bar = p.after.querySelector(BAR);
      // DOCUMENT_POSITION_FOLLOWING (4) — the nav comes after the bar.
      if (!(bar.compareDocumentPosition(nav) & 4)) wrong.push(p.rel);
    }
    assert.deepEqual(wrong, [], 'pages where the nav is not after the bar');
  });

  test('the bar declares no fixed/sticky position, so it cannot cover the navbar or the call bar', () => {
    // `.dl-callbar` is fixed to the bottom at z-index 100003 and
    // `nav.navbar.menubar` is position: relative; z-index: 100. A bar that took
    // itself out of flow would overlap one of them on some viewport.
    const css = fs.readFileSync(path.join(SITE, 'css', 'dl-utility-bar.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    assert.ok(!/position\s*:\s*(fixed|sticky|absolute)/i.test(css),
      'the utility-bar sheet takes the bar out of normal flow');
    assert.ok(!/z-index/i.test(css), 'the utility-bar sheet fights for stacking order');
  });
});

// ── 3. The two link targets ───────────────────────────────────────────────────

describe('utility bar — links navigate instead of blanking the page', () => {
  const home = () => PAGES.find((p) => p.rel === 'index.html').after.querySelector(BAR);

  test('all four social links open in a new tab', () => {
    const links = [...home().querySelectorAll('a')].filter((a) => /^https?:/.test(a.getAttribute('href')));
    assert.equal(links.length, 4, 'expected exactly four external social links');
    for (const a of links) {
      assert.equal(a.getAttribute('target'), '_blank', `${a.getAttribute('href')} has no target=_blank`);
      assert.equal(a.getAttribute('rel'), 'noopener noreferrer', `${a.getAttribute('href')} rel is wrong`);
    }
  });

  test('the CTA points at booking with target=_top', () => {
    const cta = home().querySelector('.dl-ubar-cta');
    assert.ok(cta, 'no CTA in the bar');
    assert.equal(cta.getAttribute('href'), BOOKING_HREF);
    assert.equal(cta.getAttribute('target'), '_top');
  });

  test('target=_top is enough because the router never boots framed (control)', () => {
    // WHY THIS TEST EXISTS AT ALL. The first draft of the CTA also carried
    // `data-no-swup`, reasoning that Swup would otherwise intercept the click
    // before the target was read — its `triggerWillOpenNewWindow()` matches
    // `[download], [target="_blank"]` and never _top. A three-arm control on the
    // Preview disproved it: removing `data-no-swup` changed nothing inside the
    // frame, because the router returns early when it is framed. This test pins
    // the two facts that make _top sufficient, so if EITHER moves, the CTA gets
    // re-examined rather than silently regressing to a frame-trapped booking page.
    const router = fs.readFileSync(path.join(SITE, 'js', 'perch-swup-router.js'), 'utf8');
    assert.match(router, /if\s*\(\s*window\.top\s*!==\s*window\.self\s*\)\s*return/,
      'the router no longer bails out when framed — a _top CTA may now be intercepted, '
      + 'and the frame escape needs re-proving');

    const swup = fs.readFileSync(path.join(SITE, 'js', 'vendor', 'swup.umd.js'), 'utf8');
    assert.ok(swup.includes('[download], [target="_blank"]'),
      'the vendored Swup no longer spells its new-window predicate this way — recheck '
      + 'what a target attribute does to an intercepted link');

    // And the CTA carries no opt-out charm: it navigates like every other internal
    // link, which on the unframed site means a Swup swap into /book — the exact
    // case swap-policy.js allow-lists js/page/booking-gate.js to support.
    const cta = home().querySelector('.dl-ubar-cta');
    assert.equal(cta.hasAttribute('data-no-swup'), false,
      'data-no-swup is inert in the frame and unnecessary outside it — see the note in utility-bar-inject.js');
    const policy = fs.readFileSync(path.join(SITE, 'js', 'perch', 'swap-policy.js'), 'utf8');
    assert.ok(policy.includes('/js/page/booking-gate.js'),
      'the booking gate left the swap allow-list, so a soft navigation into /book may no longer reveal it');
  });

  test('the CTA target resolves to a real, shipped page', () => {
    const file = path.join(SITE, `${BOOKING_HREF.replace(/^\//, '')}.html`);
    assert.ok(fs.existsSync(file), `${BOOKING_HREF} does not resolve to a shipped file`);
  });

  test('the accessible name does not shrink with the viewport', () => {
    // The visible label collapses to "Book" under 480px via `.dl-ubar-cta-full`.
    // An explicit aria-label is what keeps the announced name whole.
    const cta = home().querySelector('.dl-ubar-cta');
    assert.equal(cta.getAttribute('aria-label'), 'Book a Free Consultation');
    assert.equal(cta.textContent, 'Book a Free Consultation');
    const css = fs.readFileSync(path.join(SITE, 'css', 'dl-utility-bar.css'), 'utf8');
    assert.match(css, /max-width:\s*479px[\s\S]*?\.dl-ubar-cta-full[\s\S]*?display:\s*none/,
      'the short-label rule is gone, so the aria-label may no longer be needed');
  });

  test('the pre-existing tel:/mailto: links still resolve an escape', () => {
    // Not the bar's own links — the bar carries none — but the ones it now shares
    // a page with. js/main.js sweeps them to target="_top"; a page that stopped
    // loading it would have dead click-to-call in the frame, and adding chrome
    // above them is exactly the kind of change that could have dropped the script.
    const offenders = [];
    for (const p of WITH_BAR) {
      const links = [...p.after.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]')];
      if (!links.length) continue;
      const loadsMain = [...p.after.querySelectorAll('script[src]')]
        .some((s) => /\/?js\/main\.js$/.test(s.getAttribute('src')));
      const allMarkupEscaped = links.every((a) => a.getAttribute('target') === '_top');
      if (!loadsMain && !allMarkupEscaped) offenders.push(`${p.rel} (${links.length})`);
    }
    assert.deepEqual(offenders, [], 'pages whose tel:/mailto: links would navigate the iframe');
  });
});

// ── 4. Social links mirror the footer exactly ─────────────────────────────────

describe('utility bar — the four social links are the footer\'s, not a copy that can drift', () => {
  const footerSocial = () => {
    const doc = PAGES.find((p) => p.rel === 'index.html').before;
    return [...doc.querySelectorAll('.dl-social a')];
  };

  test('the footer block is where we think it is (control)', () => {
    assert.equal(footerSocial().length, 4, 'the footer .dl-social block is not four links');
  });

  test('every href and every SVG path is byte-identical to the footer block', () => {
    const footer = footerSocial();
    assert.equal(SOCIAL.length, footer.length);
    for (let i = 0; i < footer.length; i++) {
      const a = footer[i];
      assert.equal(SOCIAL[i].href, a.getAttribute('href'), `social #${i} href drifted from the footer`);
      assert.equal(SOCIAL[i].label, a.getAttribute('aria-label'), `social #${i} aria-label drifted`);
      assert.equal(SOCIAL[i].title, a.getAttribute('title'), `social #${i} title drifted`);
      assert.equal(SOCIAL[i].d, a.querySelector('svg path').getAttribute('d'),
        `social #${i} SVG path drifted from the footer — the two rows would render different logos`);
    }
  });

  test('the bar renders those same four, in the same order, on the served page', () => {
    const bar = PAGES.find((p) => p.rel === 'index.html').after.querySelector(BAR);
    const rendered = [...bar.querySelectorAll('.dl-ubar-social')];
    assert.equal(rendered.length, 4);
    for (let i = 0; i < 4; i++) {
      assert.equal(rendered[i].getAttribute('href'), SOCIAL[i].href);
      assert.equal(rendered[i].querySelector('svg path').getAttribute('d'), SOCIAL[i].d);
    }
  });
});

// ── 5. The footer is untouched — top and bottom both present ──────────────────

describe('utility bar — the existing footer connect block and call bar are unchanged', () => {
  // ── WHAT CHANGED HERE, AND WHY IT IS STILL THE SAME GUARD (#223) ────────────
  //
  // This test used to require `.dl-connect` to be byte-identical before and after.
  // SHELDON-PAUL-CHROME deliberately writes into that block — the Florida Bar
  // 4-7.12(a)(2) office-city line — so a byte-identity assertion would now be
  // asserting that a required compliance disclosure is absent.
  //
  // It is NOT relaxed to compensate. The expectation is rebuilt by applying the
  // footer injector's exact markup at the footer injector's exact anchor and
  // demanding byte-identity against THAT. So the block is still pinned to the
  // byte: the utility bar still may not disturb it, and #223 may change it in
  // exactly one way. A second line, different wording, a different class, or the
  // line landing after `.dl-social` instead of before it, all fail — which a
  // "footer contains the line" check would have waved through.
  test('.dl-connect changes by exactly the injected office-city line and nothing else', () => {
    const changed = [];
    let checked = 0;
    for (const p of PAGES) {
      const before = p.before.querySelector('.dl-connect');
      if (!before) continue;
      checked++;
      // Rebuild the expectation on a CLONE — `p.before` is shared with every other
      // test in this file and must not be mutated out from under them.
      const expected = before.cloneNode(true);
      const anchor = expected.querySelector('.dl-connect-direct');
      assert.ok(anchor, `${p.rel}: footer has no .dl-connect-direct to anchor the line to`);
      anchor.insertAdjacentHTML('afterend', OFFICE_CITY_HTML);

      const after = p.after.querySelector('.dl-connect');
      if (!after || after.outerHTML !== expected.outerHTML) changed.push(p.rel);
    }
    assert.ok(checked > 50, `only ${checked} pages carry a footer connect block (control)`);
    assert.deepEqual(changed, [], 'pages whose footer connect block changed beyond the office-city line');
  });

  test('the office-city line is the ONLY thing the footer gained (control)', () => {
    // The companion to the test above, in the direction it cannot see: that one
    // proves the served footer equals source+line, this one proves the SOURCE
    // still has no line of its own. Without it, a future page authored with the
    // line already in it would make both the expectation and the served page
    // carry it — and the injector could stop working entirely, on every page,
    // while this suite stayed green.
    const authored = PAGES.filter((p) => p.before.querySelector('.dl-connect-loc'));
    assert.deepEqual(authored.map((p) => p.rel), [],
      'pages that hand-author the office-city line — the injector no longer owns it');
  });

  test('.dl-callbar is byte-identical before and after on every page that has one', () => {
    const changed = [];
    let checked = 0;
    for (const p of PAGES) {
      const before = p.before.querySelector('.dl-callbar');
      if (!before) continue;
      checked++;
      const after = p.after.querySelector('.dl-callbar');
      if (!after || after.outerHTML !== before.outerHTML) changed.push(p.rel);
    }
    assert.ok(checked > 50, `only ${checked} pages carry a sticky call bar (control)`);
    assert.deepEqual(changed, [], 'pages whose sticky call bar changed');
  });

  test('top and bottom are BOTH present, and the bottom still has its click-to-call', () => {
    const doc = PAGES.find((p) => p.rel === 'index.html').after;
    assert.equal(doc.querySelectorAll(BAR).length, 1, 'no top bar');
    assert.equal(doc.querySelectorAll('.dl-connect .dl-social a').length, 4, 'footer social row changed');
    assert.equal(doc.querySelector('.dl-connect-cta').getAttribute('href'), 'tel:+15616666022');
    assert.equal(doc.querySelectorAll('.dl-callbar a[href^="tel:"]').length, 1, 'sticky click-to-call changed');
  });

  test('the footer CSS block is unchanged (only a pointer comment was added)', () => {
    const css = fs.readFileSync(path.join(SITE, 'css', 'main.css'), 'utf8');
    // The rules the order says must stay exactly as they are.
    for (const sel of ['.dl-connect {', '.dl-connect-cta {', '.dl-social {', '.dl-callbar {']) {
      assert.ok(css.includes(sel), `${sel} is gone from css/main.css`);
    }
    assert.ok(!/\.dl-ubar[^-\w]/.test(css.replace(/\/\*[\s\S]*?\*\//g, '')),
      'utility-bar rules leaked into css/main.css — 26 pages do not load it, see the note there');
  });
});

// ── 6. Zero inline injection, so zero CSP exposure ────────────────────────────

describe('utility bar — nothing inline is injected, so the nonce CSP is untouched', () => {
  test('the bar subtree carries no style attribute, no <style>, no <script>, no on* handler', () => {
    const offenders = [];
    for (const p of WITH_BAR) {
      const bar = p.after.querySelector(BAR);
      for (const el of [bar, ...bar.querySelectorAll('*')]) {
        if (el.hasAttribute('style')) offenders.push(`${p.rel}: style attr on ${el.tagName}`);
        for (const attr of el.attributes) {
          if (/^on/i.test(attr.name)) offenders.push(`${p.rel}: ${attr.name} on ${el.tagName}`);
        }
      }
      if (bar.querySelector('style, script')) offenders.push(`${p.rel}: inline style/script inside the bar`);
    }
    assert.deepEqual(offenders.slice(0, 10), [], 'the bar injects inline style or behaviour');
  });

  test('the injection adds no <style> element and no inline <script> anywhere', () => {
    // Counted across the WHOLE document, not just the bar: an injected inline
    // block placed elsewhere would be just as much of a nonce hazard.
    const changed = [];
    for (const p of PAGES) {
      const count = (doc) => ({
        styles: doc.querySelectorAll('style').length,
        inline: [...doc.querySelectorAll('script')].filter((s) => !s.hasAttribute('src')).length,
      });
      const b = count(p.before);
      const a = count(p.after);
      if (a.styles !== b.styles || a.inline !== b.inline) {
        changed.push(`${p.rel}: style ${b.styles}→${a.styles}, inline script ${b.inline}→${a.inline}`);
      }
    }
    assert.deepEqual(changed, [], 'the injection added an inline block');
  });

  test('every inline <script> the page already had still carries this request nonce', () => {
    // The bar shares the rewriter pass with NonceStamper. A handler that consumed
    // or reordered the stream could leave a block unstamped, which is a silent
    // CSP refusal — a console message, nothing goes red.
    const bad = [];
    for (const p of PAGES) {
      const nonces = new Set();
      for (const s of p.after.querySelectorAll('script')) {
        if (s.hasAttribute('src')) continue;
        const n = s.getAttribute('nonce');
        if (!n || !/^[0-9a-f]{32}$/.test(n)) bad.push(`${p.rel}: unstamped inline script`);
        else nonces.add(n);
      }
      if (nonces.size > 1) bad.push(`${p.rel}: ${nonces.size} distinct nonces on one page`);
    }
    assert.deepEqual(bad.slice(0, 10), []);
  });

  test('the CSP directives are unchanged — the bar needed no widening', () => {
    // Both injected things are same-origin external references: `style-src 'self'`
    // admits the stylesheet, and there is no script at all. If a future change
    // needs a directive moved, this test is where that shows up.
    const src = fs.readFileSync(path.join(SITE, 'functions', '_middleware.js'), 'utf8');
    assert.ok(src.includes("\"style-src 'self' 'unsafe-inline' https://fonts.googleapis.com\""),
      'style-src changed');
    assert.ok(!/dl-ubar|utility-bar/.test(src.match(/export function buildCsp[\s\S]*?\n}/)[0]),
      'the utility bar leaked a directive into buildCsp');
  });
});

// ── 7. The stylesheet actually reaches every page ─────────────────────────────

describe('utility bar — the stylesheet reaches every page that gets a bar', () => {
  test('the sheet exists and defines the bar', () => {
    const file = path.join(SITE, 'css', 'dl-utility-bar.css');
    assert.ok(fs.existsSync(file), `${BAR_STYLESHEET} is referenced but does not exist`);
    const css = fs.readFileSync(file, 'utf8');
    for (const sel of ['.dl-ubar', '.dl-ubar-inner', '.dl-ubar-social', '.dl-ubar-cta', '.dl-ubar-cta-full']) {
      assert.ok(css.includes(sel), `${sel} has no rule`);
    }
  });

  test('it is referenced exactly once, in <head>, on every page with a bar', () => {
    const wrong = [];
    for (const p of WITH_BAR) {
      const links = [...p.after.querySelectorAll(`link[href="${BAR_STYLESHEET}"]`)];
      if (links.length !== 1) { wrong.push(`${p.rel}: ${links.length} references`); continue; }
      if (links[0].closest('head') === null) wrong.push(`${p.rel}: reference is not in <head>`);
      if (links[0].getAttribute('rel') !== 'stylesheet') wrong.push(`${p.rel}: not rel=stylesheet`);
    }
    assert.deepEqual(wrong, [], 'pages missing the bar stylesheet');
  });

  test('the 26 pages that do not load css/main.css still get it (the reason it is its own sheet)', () => {
    // This is the check that would have caught putting the rules in main.css: the
    // bar would have rendered unstyled on every page in this list.
    // The `(\?|$)` is load-bearing: every page spells it `css/main.css?v=20260721a`,
    // so an anchored match on `.css` finds NOTHING and this test would have
    // reported all 141 pages as chrome-less — a vacuous pass dressed up as a
    // thorough one.
    const chromeless = WITH_BAR.filter((p) =>
      ![...p.after.querySelectorAll('link[href]')].some((l) => /css\/main\.css(\?|$)/.test(l.getAttribute('href'))));
    assert.ok(chromeless.length >= 20 && chromeless.length <= 40,
      `expected the standalone-document set (~26), got ${chromeless.length} — recheck the premise`);
    console.log(`      ${chromeless.length} pages carry the bar without loading css/main.css`);
    const missing = chromeless
      .filter((p) => !p.after.querySelector(`link[href="${BAR_STYLESHEET}"]`))
      .map((p) => p.rel);
    assert.deepEqual(missing, [], 'chrome-less pages that would render an unstyled bar');
  });

  test('the skipped pages get neither the bar nor its stylesheet', () => {
    for (const rel of Object.keys(EXPECTED_SKIPS)) {
      const p = PAGES.find((q) => q.rel === rel);
      assert.equal(p.after.querySelectorAll(BAR).length, 0, `${rel} got a bar`);
      assert.equal(p.after.querySelectorAll(`link[href="${BAR_STYLESHEET}"]`).length, 0,
        `${rel} got the bar stylesheet without a bar`);
    }
  });

  test('the layer and router head tags survived the third writer (control)', () => {
    // lol-html keeps only the LAST onEndTag callback per element. If the bar had
    // registered its own ['head', …] handler instead of composing, THIS is what
    // would have gone silently missing.
    const doc = PAGES.find((p) => p.rel === 'index.html').after;
    assert.ok(doc.querySelector('link[href="/css/perch-layer.css"]'), 'the layer stylesheet was deleted');
    assert.ok(doc.querySelector('script[src="/js/perch-layer.js"]'), 'the layer module was deleted');
  });
});

// ── 8. Responsive collapse ────────────────────────────────────────────────────

describe('utility bar — responsive collapse', () => {
  const css = fs.readFileSync(path.join(SITE, 'css', 'dl-utility-bar.css'), 'utf8');

  test('there are two collapse steps, at the site\'s existing breakpoints', () => {
    // 767px is the breakpoint `.dl-callbar` already uses in css/main.css; using a
    // third value would make the bar and the call bar flip at different widths.
    assert.match(css, /@media\s*\(max-width:\s*767px\)/, 'no tablet/mobile step');
    assert.match(css, /@media\s*\(max-width:\s*479px\)/, 'no small-phone step');
    const callbar = fs.readFileSync(path.join(SITE, 'css', 'main.css'), 'utf8');
    assert.match(callbar, /@media\s*\(max-width:\s*767px\)/,
      'the call bar breakpoint moved — the bar should follow it');
  });

  test('the desktop row spreads and the mobile row centres', () => {
    assert.match(css, /\.dl-ubar-inner\s*\{[^}]*justify-content:\s*space-between/);
    assert.match(css, /@media\s*\(max-width:\s*767px\)\s*\{[\s\S]*?\.dl-ubar-inner\s*\{[^}]*justify-content:\s*center/);
  });

  test('nothing the bar offers is dropped entirely on mobile', () => {
    // Only the CTA's trailing words are hidden. If a future change hid the social
    // row or the CTA itself, the bar would silently stop being a CTA on phones —
    // which is the viewport where it matters most.
    //
    // `[^{}@]` in the prelude group is what keeps an `@media` wrapper out of the
    // answer: the declaration block sits INSIDE the media block, so a naive
    // `([^{}]+)\{` grabs `@media (max-width: 479px)` as the "selector" and the
    // assertion reports the wrong thing.
    const hidden = [...css.replace(/\/\*[\s\S]*?\*\//g, '')
      .matchAll(/(?:^|[{}])\s*([^{}@]+?)\s*\{([^{}]*)\}/g)]
      .filter((m) => /display:\s*none/.test(m[2]))
      .map((m) => m[1].trim());
    assert.deepEqual(hidden, ['.dl-ubar-cta-full'],
      'something other than the CTA\'s long-label span is hidden');
  });

  test('a keyboard focus ring is declared with a real outline, not just an offset', () => {
    // `outline-offset` on its own paints nothing.
    const focus = css.match(/:focus-visible[\s\S]*?\{([^}]*)\}/);
    assert.ok(focus, 'no :focus-visible rule');
    assert.match(focus[1], /outline:\s*\d/, 'outline-offset without an outline paints nothing');
  });
});
