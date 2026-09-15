// SHELDON-PERCH-A01 — the swap container, asserted across the whole page set.
//
// WHAT THIS FILE IS FOR. `functions/_lib/perch-main.js` injects `<main
// id="perch-main">` into every page as it is served. Two things can go wrong and
// neither shows up as an error at runtime:
//
//   1. The open and close tags land at DIFFERENT nesting depths. The browser then
//      closes `<main>` at the first enclosing `</div>` and the page still renders
//      perfectly — with an EMPTY container and all the content outside it. A
//      "does a main#perch-main exist" check passes happily on that.
//   2. Wrapping content in a new block element changes what a CSS selector
//      matches — `.border-grey > .container`, `:first-of-type`, `:nth-child` —
//      and the page renders differently with JS off.
//
// So the assertions below are: the container is unique, NON-EMPTY, holds the page
// content, excludes the nav and the persistent layers; the element sequence and
// text are byte-identical to the source; and no structure-sensitive selector in
// the site's own CSS changes its match set.
//
// The rewriter under test is the real one — see test/helpers/html-rewriter.mjs.
// The DOM assertions parse the OUTPUT with jsdom, so they judge the document a
// browser would build, not the string the rewriter emitted.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { HTMLRewriter } from './helpers/html-rewriter.mjs';
import { onRequest } from '../donovan-legal-site/functions/_middleware.js';
import { CONTAINER_ID } from '../donovan-legal-site/functions/_lib/perch-main.js';
import { LAYER_STYLESHEET, LAYER_MODULE } from '../donovan-legal-site/functions/_lib/perch-layer-inject.js';
import { BAR_STYLESHEET_TAG } from '../donovan-legal-site/functions/_lib/utility-bar-inject.js';
import { FLOAT_STYLESHEET_TAG } from '../donovan-legal-site/functions/_lib/book-float-inject.js';
import {
  FOOTER_ANCHOR,
  FOOTER_STYLESHEET_TAG,
  OFFICE_CITY_HTML,
} from '../donovan-legal-site/functions/_lib/footer-inject.js';
import {
  NAV_STYLESHEET_TAG,
  SERVED_MARKER_CLASS,
  SITE_NAV_SELECTOR as NAV_SELECTOR,
  idPrefix,
  navMarkup,
} from '../donovan-legal-site/functions/_lib/nav-inject.js';

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'donovan-legal-site');
const SELECTOR = `main#${CONTAINER_ID}`;

// JORDAN-HEADER-UTILITY-BAR is the second writer to <body> and the third to
// <head>. The three "JS-off render is unchanged" invariants below subtract it the
// same way they already subtract the persistent layer: BY ITS EXACT SHAPE, so a
// bar of a different shape, or a fourth writer, still fails them. Its own
// invariants (sitewide coverage, link targets, footer untouched) live in
// test/utility-bar.test.mjs.
const BAR_SELECTOR = '.dl-ubar';
const FLOAT_SELECTOR = '.dl-book-float';
// kicker + label, concatenated the way textContent concatenates inline spans
const FLOAT_TEXT = 'Book a Free Consultation';
/** Everything the bar contributes to `body.textContent`, in document order. */
const BAR_TEXT = 'Book a Free Consultation';

// ── Documented exceptions ────────────────────────────────────────────────────
//
// Every page that does NOT get a container is named here with its reason. The
// suite asserts this list is exactly right in both directions, so a page that
// silently stops being wrapped fails rather than joining an unread allow-list.

/** Pages the injector deliberately skips. */
const EXPECTED_SKIPS = {
  // 'perch.html' stood here — the concierge shell. Removed with the voice
  // concierge: it authored the orb and iframed the real site, and both of those
  // are gone. Its absence from this list is the point, not an oversight.
  'nav-block.html': 'nav-only template fragment: no swappable content at all (referenced by 0 pages)',
};

/**
 * Pages that ship a persistent layer authored INSIDE the content flow, so the
 * container legitimately encloses it. Fixing this means editing the page file,
 * which SHELDON-PERCH-A01 is explicitly scoped out of; `_redirects` 301s this URL
 * to /practice, so nothing serves it today.
 */
const EXPECTED_LAYER_INSIDE = {
  'the-cmm2.html': '.dl-callbar is authored two levels deep inside div.box-practice (301 → /practice)',
};

// ── Page set ─────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/** Sources 301'd away in `_redirects` — those URLs never serve their file. */
function redirectedPaths() {
  const raw = fs.readFileSync(path.join(SITE, '_redirects'), 'utf8');
  const out = new Set();
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const [from, , code] = t.split(/\s+/);
    if (code === '301' && from) out.add(from.replace(/^\//, ''));
  }
  return out;
}

const REDIRECTED = redirectedPaths();
const NOINDEX = /<meta[^>]+name=["']robots["'][^>]*noindex|<meta[^>]+noindex[^>]*name=["']robots["']/i;

/**
 * "Indexable" = a URL Google is invited to keep: not `noindex`, not 301'd to a
 * canonical elsewhere, and not the error page. This is derived from the files and
 * `_redirects` rather than read out of sitemap.xml, so a page missing from the
 * sitemap is still held to the invariant.
 */
function isIndexable(rel, html) {
  if (rel === '404.html' || rel === '404.shtml') return false;
  if (REDIRECTED.has(rel) || REDIRECTED.has(rel.replace(/\.html$/, ''))) return false;
  return !NOINDEX.test(html);
}

// ── Drive the real middleware ────────────────────────────────────────────────

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

/** Tag/id/class signature — enough to spot a moved, dropped or duplicated node. */
function signature(el) {
  return `${el.tagName.toLowerCase()}#${el.id || ''}.${(el.getAttribute('class') || '').trim()}`;
}

/**
 * The source document with the footer office-city line put where the injector
 * puts it (SHELDON-PAUL-CHROME, #223) and the site nav replaced with the one the
 * edge serves (SHELDON-PAUL-NAV, #227) — i.e. the JS-off render the two
 * "unchanged" invariants below are entitled to expect.
 *
 * Built by APPLYING the exact injected markup at the exact anchor rather than by
 * stripping it out of the served page, and that direction is the point: a line
 * with different text, a different class, or one that landed anywhere other than
 * immediately after `.dl-connect-direct`, produces a mismatch here. Deleting it
 * from `after` instead would have accepted all three.
 *
 * ── #227 AND WHY THE NAV IS APPLIED HERE RATHER THAN FILTERED OFF ────────────
 *
 * The nav injector replaces a whole subtree, so it moves both the rendered text
 * and the element sequence — on 113 of the 160 documents. Subtracting the served
 * nav from the `after` side would have turned three equalities into "everything
 * outside the nav is unchanged", and the nav is the region this ticket is most
 * able to break. Applying it to the `before` side instead keeps all three as
 * equalities: the served nav must be EXACTLY `navMarkup` for the page's own id
 * prefix, sitting exactly inside `nav.menubar`, with everything around it
 * untouched. A nav of a different shape, or one that landed anywhere else, fails.
 *
 * The 47 documents with no `nav.menubar` are returned structurally unchanged and
 * are the live control for that: on those, an injector that fired anyway would
 * show up as an added subtree with nothing on the before side to match it. The
 * footerless pages are the same control for the office-city line.
 */
function withServedChrome(source) {
  const doc = new JSDOM(source).window.document;
  const anchor = doc.querySelector(FOOTER_ANCHOR);
  if (anchor) anchor.insertAdjacentHTML('afterend', OFFICE_CITY_HTML);
  const nav = doc.querySelector(NAV_SELECTOR);
  if (nav && !doc.querySelector(`.${SERVED_MARKER_CLASS}`)) {
    // Same input the injector derives its prefix from: every id in the document,
    // read before the nav is replaced. `navScan` reads them off the byte stream
    // and this reads them off the parse of the same bytes.
    const ids = new Set([...doc.querySelectorAll('[id]')].map((el) => el.id).filter(Boolean));
    nav.innerHTML = navMarkup(idPrefix(ids));
  }
  return doc;
}

import { socialMetaTags } from '../donovan-legal-site/functions/_lib/social-meta-inject.js';

const PAGES = [];
for (const file of walk(SITE)) {
  const rel = path.relative(SITE, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  const served = await serve(source, `https://www.donovan.law/${rel}`);
  PAGES.push({
    rel,
    source,
    served,
    indexable: isIndexable(rel, source),
    before: new JSDOM(source).window.document,
    after: new JSDOM(served).window.document,
    // Kept alongside `before` rather than derived per-test: two invariants need
    // it and building it twice per page doubles a 141-page jsdom parse.
    beforeServed: withServedChrome(source),
  });
}

const INDEXABLE = PAGES.filter((p) => p.indexable);

// ── The invariants ───────────────────────────────────────────────────────────

describe('perch swap container — full page set', () => {
  test('the page set is the one we think it is', () => {
    assert.ok(PAGES.length >= 140, `expected the whole site, got ${PAGES.length} pages`);
    assert.ok(INDEXABLE.length >= 90, `expected the indexable set, got ${INDEXABLE.length}`);
    // Print once so a reviewer can see the split the rest of the file asserts on.
    console.log(`      page set: ${PAGES.length} html files, ${INDEXABLE.length} indexable, `
      + `${PAGES.length - INDEXABLE.length} noindex/redirected/error`);
  });

  test('every indexable page renders exactly one main#perch-main', () => {
    const missing = [];
    for (const p of INDEXABLE) {
      if (EXPECTED_SKIPS[p.rel]) continue;
      const n = p.after.querySelectorAll(SELECTOR).length;
      if (n !== 1) missing.push(`${p.rel}: ${n}`);
    }
    assert.deepEqual(missing, [], `pages without exactly one ${SELECTOR}`);
  });

  test('non-indexable pages get the container too — the router follows links there', () => {
    const missing = [];
    for (const p of PAGES) {
      if (p.indexable || EXPECTED_SKIPS[p.rel]) continue;
      const n = p.after.querySelectorAll(SELECTOR).length;
      if (n !== 1) missing.push(`${p.rel}: ${n}`);
    }
    assert.deepEqual(missing, [], `non-indexable pages without exactly one ${SELECTOR}`);
  });

  test('the skip list is exact in both directions', () => {
    const actual = PAGES.filter((p) => p.after.querySelectorAll(SELECTOR).length === 0).map((p) => p.rel).sort();
    assert.deepEqual(actual, Object.keys(EXPECTED_SKIPS).sort(),
      'a page started or stopped being skipped — update EXPECTED_SKIPS with the reason');
  });

  test('the container is never empty', () => {
    // The failure this catches: open and close tags emitted at mismatched depths.
    // The browser closes <main> early, the page looks fine, and the router gets a
    // container with nothing in it.
    const empty = [];
    for (const p of PAGES) {
      const c = p.after.querySelector(SELECTOR);
      if (!c) continue;
      if (c.children.length === 0) empty.push(p.rel);
    }
    assert.deepEqual(empty, [], 'empty swap containers (open/close depth mismatch)');
  });

  test('the container holds the page heading — it wraps content, not a gap', () => {
    // Non-empty is not enough: a container could hold only a footer. Wherever the
    // page has an <h1>, it has to be inside the swap region.
    //
    // Pages that ship their own <main> are exempt: the id is stamped onto that
    // element, and several of those templates put the <h1> in a `header.mast`
    // sibling. That is the page's own idea of its content region, and honouring it
    // is the point of the stamp case — see decidePlan().
    const outside = [];
    for (const p of PAGES) {
      const c = p.after.querySelector(SELECTOR);
      if (!c || p.before.querySelectorAll('main').length === 1) continue;
      const h1 = p.after.querySelector('h1');
      if (h1 && !c.contains(h1)) outside.push(p.rel);
    }
    assert.deepEqual(outside, [], 'pages whose <h1> fell outside the swap container');
  });

  test('the site nav resolves OUTSIDE the container', () => {
    const inside = [];
    for (const p of PAGES) {
      const c = p.after.querySelector(SELECTOR);
      if (!c) continue;
      if (c.querySelector('nav.menubar')) inside.push(p.rel);
    }
    assert.deepEqual(inside, [], 'pages with the site nav inside the swap container');
  });

  test('persistent layers resolve OUTSIDE the container', () => {
    const inside = [];
    for (const p of PAGES) {
      const c = p.after.querySelector(SELECTOR);
      if (!c) continue;
      if (c.querySelector('.dl-callbar, #dvn-perch-root, #concierge')) inside.push(p.rel);
    }
    assert.deepEqual(inside, Object.keys(EXPECTED_LAYER_INSIDE),
      'a persistent layer moved inside the swap container');
  });

  test('no <main> is nested inside the container', () => {
    // Two `main` landmarks is a conformance error and gives assistive tech an
    // ambiguous document. Pages that already ship a <main> are supposed to have
    // the id stamped onto it instead of being wrapped.
    const nested = [];
    for (const p of PAGES) {
      const c = p.after.querySelector(SELECTOR);
      if (c && c.querySelector('main')) nested.push(p.rel);
      if (p.after.querySelectorAll('main').length > 1) nested.push(`${p.rel} (multiple <main>)`);
    }
    assert.deepEqual(nested, [], 'nested <main> elements');
  });

  test('pages that already have a <main> get the id stamped, not a wrapper', () => {
    const stamped = [];
    for (const p of PAGES) {
      if (p.before.querySelectorAll('main').length !== 1) continue;
      const c = p.after.querySelector(SELECTOR);
      assert.ok(c, `${p.rel}: no container`);
      // Same element as the source <main>: same class, and no wrapper added.
      assert.equal(c.getAttribute('class'), p.before.querySelector('main').getAttribute('class'),
        `${p.rel}: expected the page's own <main> to carry the id`);
      stamped.push(p.rel);
    }
    // 15 until 2026-09-04; the four member tools published at the root each ship a <main>.
    assert.equal(stamped.length, 19, `expected the 19 pages that ship their own <main>, got ${stamped.length}`);
  });
});

describe('perch swap container — JS-off render is unchanged', () => {
  test('visible text is identical', () => {
    const changed = [];
    for (const p of PAGES) {
      // The utility bar prepends one string to <body>, so the expected text is an
      // EQUALITY against `BAR_TEXT + before`, not a strip. A bar that grew a
      // second label, or moved out of first position, fails this.
      //
      // #223 adds a SECOND writer to the rendered text, and it does not prepend —
      // the office-city line lands mid-document, inside the footer. So it is
      // accounted for by position rather than by concatenation: `beforeServed`
      // is the source with that exact line inserted at that exact anchor, which
      // keeps this an equality instead of degrading it to a "contains".
      const bar = p.after.querySelector(BAR_SELECTOR);
      // The floating book button appends one element to <body>. The parser
      // reparents the newline between </body> and </html> INTO body, so the
      // button's text lands before that final newline and a plain suffix
      // concatenation can never match. Subtracted instead by REMOVING the one
      // button from a clone: still an equality, so a button that grew text
      // fails, and a second copy (only the first is removed) fails too — the
      // double-injection guarantee survives.
      const floats = p.after.body.querySelectorAll(FLOAT_SELECTOR);
      if (floats.length > 1) { changed.push(p.rel); continue; }
      const clone = p.after.body.cloneNode(true);
      const f = clone.querySelector(FLOAT_SELECTOR);
      if (f) {
        assert.equal(f.textContent, FLOAT_TEXT,
          `the button's own text changed on ${p.rel}`);
        f.remove();
      }
      const expected = (bar ? BAR_TEXT : '') + p.beforeServed.body.textContent;
      if (expected !== clone.textContent) changed.push(p.rel);
    }
    assert.deepEqual(changed, [], 'pages whose rendered text changed');
  });

  test('element sequence is identical once the injected <main> is discounted', () => {
    const changed = [];
    for (const p of PAGES) {
      const injected = p.after.querySelector(SELECTOR);
      const wasWrapped = injected && !p.before.querySelector('main');
      // The utility bar and every node under it. Subtracted as a SUBTREE rather
      // than by class, so a bar that grew an extra element outside `.dl-ubar`
      // still shows up as a changed sequence.
      const bar = p.after.querySelector(BAR_SELECTOR);
      // #223's footer line is added to the BEFORE side at its anchor rather than
      // filtered off the after side, so its position in the sequence is asserted
      // and not merely its absence — see `withServedChrome`.
      // The floating book button, subtracted as a subtree exactly like the bar.
      const float = p.after.querySelector(FLOAT_SELECTOR);
      const before = [...p.beforeServed.body.querySelectorAll('*')].map(signature);
      const after = [...p.after.body.querySelectorAll('*')]
        .filter((el) => !(wasWrapped && el === injected))
        .filter((el) => !(bar && (el === bar || bar.contains(el))))
        .filter((el) => !(float && (el === float || float.contains(el))))
        .map(signature)
        // the stamp case adds an id to an existing <main>; normalise that one attr
        .map((s) => s.replace(`main#${CONTAINER_ID}.`, 'main#.'));
      if (before.join('\n') !== after.join('\n')) changed.push(p.rel);
    }
    assert.deepEqual(changed, [], 'pages whose element sequence changed');
  });

  test('head is untouched apart from the CSP nonce, the layer, the utility bar and the footer line', () => {
    // JORDAN-PERCH-A21 (#51) appends two tags to <head> on every page that gets a
    // container — the layer's stylesheet and its module — via
    // functions/_lib/perch-layer-inject.js. JORDAN-HEADER-UTILITY-BAR appends one
    // more — the bar's stylesheet, via the same head callback. SHELDON-PAUL-CHROME
    // (#223) appends a fourth, the footer office-city line's sheet, through that
    // same callback and gated on the page HAVING a `.dl-connect` footer rather
    // than on the plan. All are subtracted here BY THEIR EXACT TEXT rather than by
    // relaxing the assertion: any further change to <head>, or a tag of a
    // different shape, still fails. The pairings themselves (layer iff container,
    // bar iff container, footer sheet iff footer) are asserted in
    // test/perch-layer.test.mjs, test/utility-bar.test.mjs and
    // test/footer-office-city.test.mjs.
    //
    // Each `.replace()` is a FIRST-match replace, so a second copy of any of these
    // tags survives into the comparison and fails — a double-injection cannot hide
    // in this subtraction.
    //
    // JAY-SEO-E1 adds a sixth contributor — the twitter:/og: completions from
    // _lib/social-meta-inject.js. Unlike the five above its text is DERIVED per
    // page, so it cannot be subtracted as a fixed literal. It is subtracted as
    // the exact string the module says it emits for THAT page's source, which
    // keeps the assertion strictly stronger rather than weaker: the head must
    // have gained precisely what the module produces and nothing else. A tag the
    // module did not emit, or a second copy of one it did, still fails.
    //
    // Re-parsed through jsdom before subtracting so both sides are compared in
    // the same serialisation — jsdom does not escape `<` inside an attribute
    // value on the way out, and the module does on the way in.
    const socialFor = (source) => {
      const tags = socialMetaTags(source);
      if (!tags) return '';
      return new JSDOM(`<!doctype html><html><head>${tags}</head><body></body></html>`)
        .window.document.head.innerHTML;
    };
    const denonce = (s) => s.replace(/ nonce="[0-9a-f]{32}"/g, '');
    const delayer = (s, source) => s
      .replace(`<link rel="stylesheet" href="${LAYER_STYLESHEET}">`, '')
      .replace(`<script type="module" src="${LAYER_MODULE}"></script>`, '')
      .replace(BAR_STYLESHEET_TAG, '')
      .replace(FLOAT_STYLESHEET_TAG, '')
      .replace(FOOTER_STYLESHEET_TAG, '')
      .replace(socialFor(source), '')
      // #227's nav sheet, gated on the page HAVING a `nav.menubar` rather than on
      // the plan — so the 47 fragments are a live control that it is not emitted
      // unconditionally. Subtracted by exact text like the four above; a second
      // copy survives this first-match replace and fails.
      .replace(NAV_STYLESHEET_TAG, '');
    const changed = [];
    for (const p of PAGES) {
      if (denonce(p.before.head.innerHTML) !== delayer(denonce(p.after.head.innerHTML), p.source)) changed.push(p.rel);
    }
    assert.deepEqual(changed, [], 'pages whose <head> changed beyond the nonce and the layer reference');
  });

  // ── the selector differential ──────────────────────────────────────────────
  //
  // Adding a block element between a parent and its children can only change what
  // matches through a combinator or a structural pseudo-class. Type/class/id and
  // descendant selectors are blind to a new ancestor. So collect every selector in
  // the site's stylesheets that contains one of those, and assert each one matches
  // the SAME pre-existing elements before and after.
  test('no structure-sensitive CSS selector changes what it matches', () => {
    const STRUCTURAL = /[>+~]|:(?:first|last|only|nth)-(?:child|of-type)|:empty|:root/;
    const selectors = new Set();
    const sheets = fs.readdirSync(path.join(SITE, 'css'))
      .filter((f) => f.endsWith('.css'))
      .map((f) => fs.readFileSync(path.join(SITE, 'css', f), 'utf8'));
    // Page-level <style> blocks count too: 141 pages carry their own z-index
    // override keyed on `.box > .border-grey > .container:first-of-type`.
    for (const p of PAGES) {
      for (const m of p.source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)) sheets.push(m[1]);
    }
    for (const sheet of sheets) {
      // Comments MUST come out first. Left in, a rule preceded by a comment block
      // reads as one giant unparseable "selector" and gets skipped — which is how
      // `.box > .border-grey > .container`, the single most load-bearing child
      // combinator on this site, quietly escaped the differential on first run.
      const css = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
      for (const m of css.matchAll(/([^{}]+)\{/g)) {
        for (const sel of m[1].split(',')) {
          // `::before` etc. never match an element; drop the pseudo-element tail
          // and keep the subject the rule is anchored to. `@media`/`@supports`
          // preludes are not selectors.
          const s = sel.trim().replace(/::[a-z-]+(\(.*?\))?/g, '').trim();
          if (s && !s.startsWith('@') && STRUCTURAL.test(s)) selectors.add(s);
        }
      }
    }
    assert.ok(selectors.size > 400, `expected a real selector corpus, got ${selectors.size}`);
    for (const critical of ['.box > .border-grey > .container', '.box > .border-grey > .container:first-of-type']) {
      assert.ok(selectors.has(critical), `corpus is missing the load-bearing selector ${critical}`);
    }

    // Anything jsdom refuses to parse is a hole in this proof, so the holes are
    // counted and capped rather than swallowed. Legacy hacks such as `*+html`
    // are the only ones expected to land here.
    const usable = [];
    const unparseable = [];
    const probe = new JSDOM('<html><body></body></html>').window.document;
    for (const sel of selectors) {
      try { probe.querySelectorAll(sel); usable.push(sel); } catch { unparseable.push(sel); }
    }
    console.log(`      selector differential: ${usable.length} structure-sensitive selectors `
      + `× ${PAGES.length} pages; ${unparseable.length} unparseable by jsdom `
      + `(${unparseable.join(' | ') || 'none'})`);
    assert.ok(unparseable.length <= 3,
      `too many selectors excluded from the differential: ${unparseable.join(' | ')}`);

    // Compared against `beforeServed`, not the raw source, for the reason given on
    // `withServedChrome`: #227's nav replacement legitimately changes what a
    // selector INSIDE the nav matches (`.flyout-item > .dd-area` matched three
    // elements and now matches none), and holding the raw source as the expected
    // value would only assert that the ticket did what it says.
    //
    // What this still proves is the whole of what it proved before: that the
    // INJECTED `<main>` — a new block element between a parent and its children,
    // the one thing that can move a combinator's match set without moving any
    // markup — changes nothing. That the nav rewrite's own effect stays inside
    // `nav.menubar`, and in particular that `.box > .border-grey > .container`
    // still matches what it did, is asserted against the raw source in
    // test/nav-inject.test.mjs rather than dropped.
    const changed = [];
    for (const p of PAGES) {
      const injected = p.after.querySelector(SELECTOR);
      for (const sel of usable) {
        const b = [...p.beforeServed.querySelectorAll(sel)].map(signature).join('\n');
        const a = [...p.after.querySelectorAll(sel)].filter((el) => el !== injected).map(signature).join('\n');
        if (a !== b) changed.push(`${p.rel} :: ${sel}`);
      }
    }
    assert.deepEqual(changed.slice(0, 20), [], `selectors whose match set changed (${changed.length} total)`);
  });
});

describe('perch swap container — nesting rules', () => {
  const shell = (body) => `<!doctype html><html><head><title>t</title></head><body>${body}</body></html>`;

  test('a nav buried in a container is left outside, content is wrapped', async () => {
    const html = shell(`
      <div class="box"><div class="border-grey">
        <div class="container"><nav class="navbar menubar"><ul><li>a<li>b</ul></nav></div>
        <div class="content"><p>one<p>two</div>
      </div></div>`);
    const doc = new JSDOM(await serve(html, 'https://www.donovan.law/x.html')).window.document;
    const c = doc.querySelector(SELECTOR);
    assert.ok(c, 'no container');
    assert.equal(c.parentElement.className, 'border-grey', 'container is not a sibling of the nav block');
    assert.equal(c.querySelector('nav'), null, 'nav ended up inside');
    assert.ok(c.querySelector('.content'), 'content did not end up inside');
  });

  test('a body-level <header> nav splits at body level', async () => {
    const html = shell(`
      <header><div class="row"><div class="col"><nav class="navbar menubar">n</nav></div></div></header>
      <section class="a">body</section>
      <script>var x=1;</script>`);
    const doc = new JSDOM(await serve(html, 'https://www.donovan.law/x.html')).window.document;
    const c = doc.querySelector(SELECTOR);
    assert.ok(c, 'no container');
    assert.equal(c.parentElement.tagName, 'BODY');
    assert.equal(c.querySelector('nav'), null, 'nav ended up inside');
    assert.equal(c.querySelector('script'), null, 'trailing script ended up inside');
    assert.ok(c.querySelector('section.a'), 'content did not end up inside');
  });

  test('a page with no site nav wraps from the first body child', async () => {
    const html = shell('<div class="masthead">m</div><div class="article">a</div><script>var x=1;</script>');
    const doc = new JSDOM(await serve(html, 'https://www.donovan.law/x.html')).window.document;
    const c = doc.querySelector(SELECTOR);
    assert.ok(c, 'no container');
    assert.ok(c.querySelector('.masthead') && c.querySelector('.article'));
    assert.equal(c.querySelector('script'), null);
  });

  test('the shell is skipped — the orb layer must not be wrapped', async () => {
    const html = shell('<iframe id="site" src="/home.html"></iframe><div id="concierge">orb</div>');
    const doc = new JSDOM(await serve(html, 'https://www.donovan.law/')).window.document;
    assert.equal(doc.querySelector(SELECTOR), null, 'the shell was wrapped');
  });

  test('a fragment with nothing to swap is skipped rather than given an empty container', async () => {
    const doc = new JSDOM(await serve(shell('<nav class="navbar menubar">n</nav>'), 'https://www.donovan.law/x.html')).window.document;
    assert.equal(doc.querySelector(SELECTOR), null);
  });

  test('implied end tags do not desynchronise the anchors', async () => {
    // <p> and <li> are routinely left unclosed in this tree. A depth counter built
    // on '*' would drift on them; the anchors are counted on <div> for that reason.
    const html = shell(`
      <div class="box"><div class="border-grey">
        <div class="container"><nav class="navbar menubar"><ul><li>a<li>b</ul><p>unclosed</nav></div>
        <div class="content"><p>one<p>two<ul><li>x<li>y</ul></div>
        <div class="tail">end</div>
      </div></div>`);
    const doc = new JSDOM(await serve(html, 'https://www.donovan.law/x.html')).window.document;
    const c = doc.querySelector(SELECTOR);
    assert.ok(c && c.querySelector('.content') && c.querySelector('.tail'), 'anchors drifted');
    assert.equal(c.querySelector('nav'), null);
  });
});

describe('perch swap container — the rest of the middleware is unaffected', () => {
  test('the CSP nonce still matches the body it is served with', async () => {
    const saved = globalThis.HTMLRewriter;
    globalThis.HTMLRewriter = HTMLRewriter;
    try {
      const html = '<!doctype html><html><body><div class="a"><script>var x=1;</script></div></body></html>';
      const res = await onRequest({
        request: new Request('https://www.donovan.law/x.html', { headers: { 'sec-fetch-dest': 'document' } }),
        next: async () => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
      });
      const header = res.headers.get('Content-Security-Policy');
      const body = await res.text();
      const nonce = header.match(/'nonce-([0-9a-f]{32})'/)[1];
      assert.ok(body.includes(`nonce="${nonce}"`), 'stamped nonce does not match the header');
      assert.equal(res.headers.get('Cache-Control'), 'no-store');
    } finally {
      globalThis.HTMLRewriter = saved;
    }
  });

  test('non-HTML responses are not buffered or rewritten', async () => {
    const saved = globalThis.HTMLRewriter;
    globalThis.HTMLRewriter = HTMLRewriter;
    try {
      const res = await onRequest({
        request: new Request('https://www.donovan.law/js/main.js'),
        next: async () => new Response('var a=1;', {
          headers: { 'content-type': 'application/javascript', 'cache-control': 'public, max-age=31536000', etag: 'W/"x"' },
        }),
      });
      assert.equal(await res.text(), 'var a=1;');
      assert.equal(res.headers.get('Cache-Control'), 'public, max-age=31536000');
      assert.equal(res.headers.get('etag'), 'W/"x"', 'asset validators must survive');
    } finally {
      globalThis.HTMLRewriter = saved;
    }
  });

  test('a bodyless 304 is passed through untouched', async () => {
    const saved = globalThis.HTMLRewriter;
    globalThis.HTMLRewriter = HTMLRewriter;
    try {
      const res = await onRequest({
        request: new Request('https://www.donovan.law/x.html'),
        next: async () => new Response(null, { status: 304, headers: { 'content-type': 'text/html' } }),
      });
      assert.equal(res.status, 304);
      assert.equal(res.body, null);
    } finally {
      globalThis.HTMLRewriter = saved;
    }
  });
});
