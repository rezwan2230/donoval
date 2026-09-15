// SHELDON-PERCH-A22 (#52, parent #15) — the Swup router's script-adoption
// contract, and the booking-gate reveal after a cross-page swap.
//
// ── WHAT THIS FILE IS DEFENDING ──────────────────────────────────────────────
//
// A content swap replaces the markup inside `<main id="perch-main">` and leaves
// the document — and therefore every script the document has already run — in
// place. That is the whole point, and it creates exactly two ways to be wrong:
//
//   1. RUN TOO LITTLE. The incoming page's own behaviour never loads, so the
//      booking-gate reveal never fires and a caller Paula has already qualified
//      sits looking at "a quick step first" with Paul's calendar hidden behind a
//      gate no code is present to open. This is the A2.5 spike's finding F1, and
//      it is invisible: a CSP-clean console says nothing is wrong.
//
//   2. RUN TOO MUCH. The swap executes whatever the response happens to carry.
//      That is a remote-controlled script loader wearing a router's clothes, and
//      it is how the nonce CSP that JORDAN-PERCH-A02 (#47) installed would get
//      quietly handed back — by re-creating inline blocks, by re-stamping a
//      nonce, or by eval'ing fetched text.
//
// So the assertions below come in two halves that pull in opposite directions:
// the reveal MUST fire after a swap into /book, and NOTHING outside a fixed
// shell-defined allow-list may execute — measured against the real 143-document
// tree and the real functions, never against a copy of the list written next door.
// See [[feedback_assert_behavior_not_source_spelling]].

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import { HTMLRewriter } from './helpers/html-rewriter.mjs';
import { planFromHtml, injectHandlers, CONTAINER_ID } from '../donovan-legal-site/functions/_lib/perch-main.js';
import { layerHandlers, LAYER_MODULE, LAYER_STYLESHEET } from '../donovan-legal-site/functions/_lib/perch-layer-inject.js';
import { BAR_STYLESHEET, barStylesheetTag } from '../donovan-legal-site/functions/_lib/utility-bar-inject.js';
import { buildCsp } from '../donovan-legal-site/functions/_middleware.js';
import {
  ROUTER_MODULE, ROUTER_TAGS, routerEnabled, routerTags, wantsRouter,
} from '../donovan-legal-site/functions/_lib/perch-router-inject.js';
import {
  ADOPT_SCRIPTS, DENY_SCRIPTS, EXCLUDED_ROUTES, EVENT_CONTENT_SWAPPED, EVENT_SWAPPED,
  excludeReason, scriptKey, adoptDecision, planAdoption, sharedChrome,
} from '../donovan-legal-site/js/perch/swap-policy.js';
import {
  syncHead, checkNav, bootBookingWidget, reattachInputFormatter, checkBeacon, gaPageView, reinit,
  renderTurnstile, SHELL_STYLESHEETS,
} from '../donovan-legal-site/js/perch/reinit.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'donovan-legal-site');
const ORIGIN = 'https://preview.donovan-site.pages.dev';

const read = (p) => readFileSync(p, 'utf8');
const rel = (p) => relative(SITE, p).split(sep).join('/');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.wrangler' || name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

/** The URL Cloudflare Pages serves a given file at (clean URLs; foo.html → /foo). */
function servedPath(relPath) {
  if (relPath.endsWith('/index.html')) return '/' + relPath.slice(0, -'index.html'.length);
  return '/' + relPath.replace(/\.html$/, '');
}

const htmlFiles = walk(SITE);

// ── The tree, classified once ─────────────────────────────────────────────────
//
// Parsed ONCE into plain data, and the jsdom windows are dropped immediately.
// Retaining 143 windows in an array is how this suite would die at 2 GB on CI —
// see [[feedback_jsdom_per_page_array_ooms_ci]].
const pages = [];
before(() => {
  for (const file of htmlFiles) {
    const relPath = rel(file);
    const html = read(file);
    const { document: doc } = new JSDOM(html).window;
    // JORDAN-198: the page-authored head census, taken from the RAW file — i.e.
    // before the edge has touched it — which is what makes it a statement about
    // what the PAGE declares. Counted here rather than in its own pass because
    // this loop is already the one parse of the tree the suite can afford.
    const head = doc.head;
    const cssSeq = head ? [...head.children]
      .filter((e) => e.tagName === 'STYLE'
        || (e.tagName === 'LINK' && (e.getAttribute('rel') || '').toLowerCase().split(/\s+/).includes('stylesheet')))
      .map((e) => (e.tagName === 'STYLE' ? 'S' : 'L')).join('') : '';
    pages.push({
      relPath,
      path: servedPath(relPath),
      scripts: [...doc.querySelectorAll('script[src]')].map((s) => ({
        src: s.getAttribute('src'),
        head: !!(doc.head && doc.head.contains(s)),
      })),
      hasNav: !!doc.querySelector('nav.menubar'),
      headStyles: head ? head.querySelectorAll('style').length : 0,
      headSheets: (cssSeq.match(/L/g) || []).length,
      headDesc: head ? head.querySelectorAll('meta[name="description"]').length : 0,
      headOg: head ? [...head.querySelectorAll('meta[property]')]
        .filter((e) => /^og:/i.test(e.getAttribute('property') || '')).length : 0,
      headRobots: head
        ? [...head.querySelectorAll('meta[name="robots"]')].map((e) => e.getAttribute('content') || '')
        : [],
      cssSeq,
    });
  }
});

const interceptable = () => pages.filter((p) => !excludeReason(p.path));

// ─────────────────────────────────────────────────────────────────────────────
// 0. Non-vacuity, and the vendored router
// ─────────────────────────────────────────────────────────────────────────────

describe('the scan is real (non-vacuity)', () => {
  test('the tree is the shipped site', () => {
    assert.ok(htmlFiles.length > 100, `expected the site tree, walked ${htmlFiles.length} files`);
    // 'perch.html' was in this list — the concierge shell, deleted. index.html takes
    // its place as the fourth landmark: it is the page `/` now serves, so a walk that
    // misses it is a walk that is not looking at the shipped site.
    for (const must of ['book.html', 'contact.html', 'index.html', 'diamond/tool-economics.html']) {
      assert.ok(pages.some((p) => p.relPath === must), `${must} must be in scope`);
    }
  });

  test('a substantial page set is interceptable, and a substantial set is not', () => {
    const yes = interceptable().length;
    assert.ok(yes > 80, `only ${yes} interceptable pages — the exclusion rules have swallowed the site`);
    assert.ok(pages.length - yes > 30, 'the tier + no-container exclusions matched almost nothing');
  });
});

describe('Swup is vendored, self-hosted and pinned', () => {
  // PROVENANCE. These bytes are `npm pack swup@4.9.2` → package/dist/Swup.umd.js
  // with the single trailing `//# sourceMappingURL=` line removed (the .map is not
  // shipped, so the comment would only earn a 404 in devtools). They are BYTE-
  // IDENTICAL to the copy the A2.5 spike ran on Preview to earn the GO, which is
  // why this pin is worth having: it says the thing that was proven is the thing
  // that ships. A dependency swapped under the same filename reds this test.
  const SWUP_SHA256 = 'c39f739a4c127b05f385d19401dba81947ad66a8cd6be8bcea5f6d1d37e129a3';

  test('js/vendor/swup.umd.js matches the pinned hash', () => {
    const bytes = readFileSync(join(SITE, 'js', 'vendor', 'swup.umd.js'));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), SWUP_SHA256);
  });

  test('the router loads Swup from self, never from a CDN', () => {
    const src = read(join(SITE, 'js', 'perch-swup-router.js'));
    assert.match(src, /const SWUP_URL = '\/js\/vendor\/swup\.umd\.js'/);
    assert.doesNotMatch(src, /https?:\/\/(cdn|unpkg|esm)\./i, 'the router must not fetch a router from a CDN');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. The allow-list is complete against the tree, in both directions
// ─────────────────────────────────────────────────────────────────────────────

describe('every script an interceptable page references is classified', () => {
  const keysOf = (page) => page.scripts
    .map((s) => scriptKey(s.src, ORIGIN + page.path, ORIGIN))
    .filter(Boolean)
    .map((k) => k.key);

  test('no script is left unclassified (doc → code)', () => {
    // The failure this catches: someone adds js/page/tool-new-thing.js to a page,
    // the router denies it by default, and the page arrives after a swap with its
    // calculator inert. Deny-by-default is the right runtime behaviour AND the
    // wrong thing to discover in production, so an unlisted script reds CI.
    const unclassified = new Map();
    for (const page of interceptable()) {
      for (const key of keysOf(page)) {
        if (ADOPT_SCRIPTS.has(key) || DENY_SCRIPTS.has(key)) continue;
        if (!unclassified.has(key)) unclassified.set(key, []);
        unclassified.get(key).push(page.relPath);
      }
    }
    assert.deepEqual(
      [...unclassified.entries()].map(([k, v]) => `${k} (${v.slice(0, 3).join(', ')})`),
      [],
      'add each of these to ADOPT_SCRIPTS (with the reason it must run after a swap) '
      + 'or to DENY_SCRIPTS (with the reason it must not) in js/perch/swap-policy.js',
    );
  });

  test('no list entry is dead (code → doc)', () => {
    // The other direction, which is the one that rots silently: an allow-list
    // entry for a file no page loads any more is a standing permission for
    // nothing, and the next reader cannot tell it from a live one.
    //
    // Two entries are referenced by no .html file BY CONSTRUCTION: the layer and
    // the router are written into every container page by HTMLRewriter as the
    // response streams out, so they are in the incoming document of every swap
    // and in the source of none. They are exempted here and their real source is
    // asserted below, rather than being left to look like live tree references.
    const EDGE_INJECTED = new Set(['/js/perch-layer.js', ROUTER_MODULE]);
    const referenced = new Set();
    for (const page of interceptable()) for (const key of keysOf(page)) referenced.add(key);
    const dead = [...ADOPT_SCRIPTS.keys(), ...DENY_SCRIPTS.keys()]
      .filter((k) => !referenced.has(k) && !EDGE_INJECTED.has(k));
    assert.deepEqual(dead, [], 'these list entries are referenced by no interceptable page');
  });

  test('the edge-injected tags are classified, and their source is the injector', () => {
    // Deny-by-default already refused these; naming them turns an "unlisted
    // script" line in the swap log into a decision with a reason. Re-executing
    // either would be a genuine defect — a second layer mount (the layer holds
    // the live call) or a second Swup instance intercepting every link twice.
    for (const key of ['/js/perch-layer.js', ROUTER_MODULE]) {
      assert.equal(adoptDecision(key).adopt, false);
      assert.equal(adoptDecision(key).listed, true, `${key} must be a deliberate deny`);
    }
    assert.match(read(join(SITE, 'functions', '_lib', 'perch-layer-inject.js')), /LAYER_MODULE = '\/js\/perch-layer\.js'/);
    assert.equal(ROUTER_MODULE, '/js/perch-swup-router.js');
  });

  test('the classification covers both head and end-of-body tags', () => {
    // Head-only adoption is the specific way this ticket fails: js/booking-widget.js
    // is an END-OF-BODY tag that A0.1 leaves outside the container, and it is what
    // makes the widget boot after a swap into /book (spike F1, condition C1).
    const bodyAdopted = interceptable().flatMap((p) => p.scripts
      .filter((s) => !s.head)
      .map((s) => scriptKey(s.src, ORIGIN + p.path, ORIGIN))
      .filter((k) => k && ADOPT_SCRIPTS.has(k.key))
      .map((k) => k.key));
    assert.ok(bodyAdopted.includes('/js/booking-widget.js'), 'the end-of-body widget must be adoptable');
    assert.ok(ADOPT_SCRIPTS.has('/js/dl-init.js'), 'the head-loaded re-init bus must be adoptable');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE ADOPTION CONTRACT — only allow-listed EXTERNAL scripts, ever
// ─────────────────────────────────────────────────────────────────────────────

describe('a swap adopts only allow-listed external scripts', () => {
  const planFor = (relPath, loaded = []) => {
    const page = pages.find((p) => p.relPath === relPath);
    const { document: incoming } = new JSDOM(read(join(SITE, relPath))).window;
    return planAdoption(incoming, {
      incomingUrl: ORIGIN + page.path,
      origin: ORIGIN,
      loadedHrefs: new Set(loaded),
    });
  };

  test('/book yields exactly the four scripts the reveal needs, in document order', () => {
    const { queue } = planFor('book.html');
    assert.deepEqual(queue.map((q) => q.key), [
      '/js/dl-init.js',
      '/js/page/booking-gate.js',
      'https://challenges.cloudflare.com/turnstile/v0/api.js',
      '/js/booking-widget.js',
    ]);
    // Order is load-bearing, not incidental: js/page/booking-gate.js calls
    // DL.ready at top level, so js/dl-init.js must already be executing or the
    // gate throws on load and the reveal is dead for the whole session.
    assert.ok(
      queue.findIndex((q) => q.key === '/js/dl-init.js')
      < queue.findIndex((q) => q.key === '/js/page/booking-gate.js'),
    );
  });

  // REMOVED: the beacon and the concierge are refused with a reason, not silently dropped
  // both tags are deleted — the Vantage beacon from all 156 pages it was on, and js/donovan-widget.js with the voice concierge — so neither appears in any decision log to be refused. Their DENY_SCRIPTS entries went with them.

  test('an already-loaded script is never executed twice', () => {
    const { queue } = planFor('book.html', [ORIGIN + '/js/dl-init.js']);
    assert.ok(!queue.some((q) => q.key === '/js/dl-init.js'));
    assert.ok(queue.some((q) => q.key === '/js/booking-widget.js'), 'the rest must still be adopted');
  });

  test('MUTATION BITE — an unlisted external script is refused', () => {
    // The regression that matters: adoption driven by what the response carries
    // rather than by what the shell allows.
    const { document: doc } = new JSDOM(
      '<html><head><script src="/js/dl-init.js"></script>'
      + '<script src="/js/attacker-supplied.js"></script></head><body></body></html>',
    ).window;
    const { queue, decisions } = planAdoption(doc, { incomingUrl: ORIGIN + '/book', origin: ORIGIN, loadedHrefs: new Set() });
    assert.deepEqual(queue.map((q) => q.key), ['/js/dl-init.js']);
    const refused = decisions.find((d) => d.src === '/js/attacker-supplied.js');
    assert.equal(refused.adopted, false);
    assert.equal(refused.listed, false, 'it must be refused BY DEFAULT, not by a deny entry');
  });

  test('MUTATION BITE — a cache-busted allow-listed src fails CLOSED', () => {
    // `/js/dl-init.js?v=2` is a different key. Failing closed is the right
    // direction — the alternative is a prefix match that a query string can walk.
    const { document: doc } = new JSDOM('<html><head><script src="/js/dl-init.js?v=2"></script></head><body></body></html>').window;
    const { queue } = planAdoption(doc, { incomingUrl: ORIGIN + '/book', origin: ORIGIN, loadedHrefs: new Set() });
    assert.deepEqual(queue, []);
  });

  test('MUTATION BITE — an INLINE script is never even a candidate', () => {
    // Not "filtered out" — never selected. `script[src]` cannot match an inline
    // block, which is why re-nonce/re-execute/eval are unreachable rather than
    // merely unused. This is the A0.2 rule (js/dl-init.js) and the swap-container
    // guard, and the router does not carve an exception for the swap path.
    const { document: doc } = new JSDOM(
      '<html><head><script nonce="abc123">window.__pwned = 1;</script>'
      + '<script src="/js/dl-init.js"></script></head>'
      + '<body><script>window.__pwned2 = 1;</script></body></html>',
    ).window;
    const { queue, decisions } = planAdoption(doc, { incomingUrl: ORIGIN + '/book', origin: ORIGIN, loadedHrefs: new Set() });
    assert.deepEqual(queue.map((q) => q.key), ['/js/dl-init.js']);
    assert.equal(decisions.length, 1, 'an inline block must not appear in the decision log at all');
    assert.ok(!JSON.stringify(decisions).includes('__pwned'));
  });

  test('MUTATION BITE — a javascript: src is unusable, not adoptable', () => {
    const { document: doc } = new JSDOM('<html><head><script src="javascript:alert(1)"></script></head><body></body></html>').window;
    const { queue, decisions } = planAdoption(doc, { incomingUrl: ORIGIN + '/book', origin: ORIGIN, loadedHrefs: new Set() });
    assert.deepEqual(queue, []);
    assert.match(decisions[0].reason, /unusable or non-http/);
  });

  test('a relative src resolves against the INCOMING page, not the live one', () => {
    // 84 of the 96 interceptable pages write `src="js/main.js"` and the tier tree
    // writes `../js/main.js`. Resolving those against the live document's URL —
    // which has already moved by the time this runs — would key the wrong file.
    assert.equal(scriptKey('js/main.js', ORIGIN + '/contact', ORIGIN).key, '/js/main.js');
    assert.equal(scriptKey('js/main.js', ORIGIN + '/engagement-scoping/', ORIGIN).key, '/engagement-scoping/js/main.js');

    // And the base has to be ABSOLUTE. Swup hands over `pathname + search`, which
    // is not a usable base — this returns null rather than resolving, which is
    // precisely why the router converts it before calling in.
    assert.equal(scriptKey('js/main.js', '/contact', ORIGIN), null);
    const src = read(join(SITE, 'js', 'perch-swup-router.js'));
    assert.match(src, /const incomingUrl = new URL\(\(visit\.to && visit\.to\.url\) \|\| location\.href, location\.href\)\.href;/);
  });

  test('every interceptable page adopts only allow-listed keys (whole-tree sweep)', () => {
    // The tree-wide form of the rule. A page that could smuggle something past
    // the allow-list would show up here rather than in a spot check.
    for (const page of interceptable()) {
      const { document: incoming } = new JSDOM(read(join(SITE, page.relPath))).window;
      const { queue } = planAdoption(incoming, {
        incomingUrl: ORIGIN + page.path, origin: ORIGIN, loadedHrefs: new Set(),
      });
      for (const q of queue) {
        assert.ok(ADOPT_SCRIPTS.has(q.key), `${page.relPath} would have executed unlisted ${q.key}`);
      }
    }
  });
});

describe('the router never re-executes, re-nonces or evals a fetched script', () => {
  const src = read(join(SITE, 'js', 'perch-swup-router.js'));

  test('no dynamic-execution primitive appears in the router at all', () => {
    // An absence check, which is what a source scan is actually good for. The
    // positive behaviour — that only allow-listed `script[src]` is ever queued —
    // is asserted against the real function above, not against this regex.
    for (const forbidden of [/\beval\s*\(/, /new\s+Function\s*\(/, /\.innerHTML\s*=/, /document\.write/, /insertAdjacentHTML/]) {
      assert.doesNotMatch(src, forbidden, `the router must not contain ${forbidden}`);
    }
  });

  test('the router neither reads nor writes a nonce', () => {
    // The CSP admits every script this file inserts by host allow-list. If the
    // word `nonce` ever appears as anything but prose, the mechanism has changed.
    const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.doesNotMatch(code, /nonce/i, 'a router that touches a nonce is re-creating inline scripts');
  });

  test('exactly one place creates a script element, and it copies no attribute', () => {
    const creations = src.match(/createElement\(['"]script['"]\)/g) || [];
    assert.equal(creations.length, 1, 'script creation must stay in loadScript()');
    const fn = src.slice(src.indexOf('function loadScript'), src.indexOf('/** Absolute hrefs'));
    assert.match(fn, /s\.src = url;/);
    assert.match(fn, /s\.async = false;/);
    // Everything else assigned on the element must be a load/error handler.
    const assigned = [...fn.matchAll(/\bs\.([A-Za-z]+)\s*=/g)].map((m) => m[1]).sort();
    assert.deepEqual([...new Set(assigned)], ['async', 'onerror', 'onload', 'src']);
    assert.doesNotMatch(fn, /setAttribute|getAttribute|cloneNode|textContent|\.text\b/);
  });

  test('the router announces both re-init events', () => {
    assert.equal(EVENT_CONTENT_SWAPPED, 'dl:content-swapped');
    assert.equal(EVENT_SWAPPED, 'perch:content-swapped');
    assert.match(src, /EVENT_CONTENT_SWAPPED/, 'A0.2 re-init bus');
    assert.match(src, /EVENT_SWAPPED/, "A2.1's persistent-layer contract");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE REVEAL — cross-page swap into /book, executed for real
// ─────────────────────────────────────────────────────────────────────────────

describe('the booking-gate reveal fires after a cross-page swap into /book', () => {
  /** Run the real A0.1 pipeline and hand back the injected document. */
  async function inject(relPath) {
    const html = read(join(SITE, relPath));
    const plan = await planFromHtml(html, HTMLRewriter);
    let rw = new HTMLRewriter();
    for (const [sel, h] of injectHandlers(plan)) rw = rw.on(sel, h);
    return { plan, html: await rw.transform(new Response(html)).text() };
  }

  test('a swap from /contact into /book unhides #book-live', async () => {
    // The scenario, end to end, in one jsdom window:
    //   1. the visitor is on /contact — a document that has never loaded
    //      js/dl-init.js or js/page/booking-gate.js, because 141 of 143 pages
    //      never reference them;
    //   2. the router replaces #perch-main with /book's container markup;
    //   3. it adopts /book's allow-listed scripts;
    //   4. it dispatches dl:content-swapped.
    // Step 3 is the one A0.1 + A0.2 do not cover. Deleting it makes this test
    // fail, which is the whole reason the test exists.
    const contact = await inject('contact.html');
    const book = await inject('book.html');

    const dom = new JSDOM(contact.html, {
      url: ORIGIN + '/contact',
      runScripts: 'dangerously',
      pretendToBeVisual: true,
    });
    const { window } = dom;
    const doc = window.document;

    assert.ok(doc.getElementById(CONTAINER_ID), '/contact must have a container to swap');
    assert.equal(window.DL, undefined, 'the premise: /contact has no DL.ready');

    // The production unlock path — the timestamp Paula's shell writes before it
    // navigates (perch.html:243-246), NOT the ?unlock=dev bypass.
    window.localStorage.setItem('donovan_booking_unlock', String(Date.now()));

    // (2) swap the container.
    const incoming = new JSDOM(book.html).window.document;
    doc.getElementById(CONTAINER_ID).innerHTML = incoming.getElementById(CONTAINER_ID).innerHTML;
    assert.ok(doc.getElementById('book-gate'), 'the gate markup must have arrived');
    assert.equal(doc.getElementById('book-live').style.display, 'none', 'and it must arrive hidden');

    // (3) adopt — the real decision function, then execute what it queued.
    // jsdom does not fetch, so the queued files are read from disk and evaluated
    // in the queued order. Only same-origin entries are executable here; Turnstile
    // is asserted as queued (it provides window.turnstile for the widget's explicit
    // render) but is not reachable from a test runner.
    const { queue } = planAdoption(incoming, {
      incomingUrl: ORIGIN + '/book', origin: ORIGIN, loadedHrefs: new Set(),
    });
    assert.ok(queue.some((q) => q.key === 'https://challenges.cloudflare.com/turnstile/v0/api.js'));
    assert.ok(queue.some((q) => q.key === '/js/booking-widget.js'));

    for (const item of queue) {
      if (!item.key.startsWith('/js/')) continue;
      if (item.key === '/js/booking-widget.js') continue; // boots a live widget; covered by §5 row 5 below
      window.eval(read(join(SITE, item.key.slice(1))));
    }
    assert.equal(typeof window.DL.ready, 'function', 'adoption must have loaded the re-init bus');

    // (4) announce.
    doc.dispatchEvent(new window.CustomEvent(EVENT_CONTENT_SWAPPED, { detail: { url: '/book' } }));

    assert.equal(doc.getElementById('book-gate').style.display, 'none', 'the gate must be hidden');
    assert.equal(doc.getElementById('book-live').style.display, 'block', 'Paul’s calendar must be visible');

    window.close();
  });

  test('CONTROL — without adoption the reveal silently does not fire', async () => {
    // The same scenario with step 3 removed. If this ever passes, the test above
    // has stopped proving anything: it would mean the reveal came from somewhere
    // else and the adoption step could be deleted without CI noticing.
    const contact = await inject('contact.html');
    const book = await inject('book.html');
    const dom = new JSDOM(contact.html, { url: ORIGIN + '/contact', runScripts: 'dangerously' });
    const { window } = dom;
    const doc = window.document;
    window.localStorage.setItem('donovan_booking_unlock', String(Date.now()));
    const incoming = new JSDOM(book.html).window.document;
    doc.getElementById(CONTAINER_ID).innerHTML = incoming.getElementById(CONTAINER_ID).innerHTML;
    doc.dispatchEvent(new window.CustomEvent(EVENT_CONTENT_SWAPPED, { detail: { url: '/book' } }));
    assert.equal(doc.getElementById('book-live').style.display, 'none', 'the event fired into an empty room — as it must, without adoption');
    window.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Routes the router must not intercept
// ─────────────────────────────────────────────────────────────────────────────

describe('excluded routes', () => {
  test('a DEEP tier URL is excluded — the case a tier root cannot test', () => {
    // Spike F3: js/members-gate.js:587 swallows a tier ROOT in the capture phase
    // with stopPropagation, so Swup's delegated listener never sees the click and
    // `ignoreVisit` is never consulted. A tier root is therefore safe by accident
    // and proves nothing. `/diamond/tool-economics` is the URL that actually
    // tests the rule, and it is where the spike's first run reported a false
    // negative.
    const deep = excludeReason('/diamond/tool-economics');
    assert.ok(deep, 'a deep tier URL must be excluded');
    assert.equal(deep.id, 'tier-basic-auth');
    assert.ok(excludeReason('/diamond/'), 'and the root too, belt and braces');
    assert.ok(excludeReason('/reserve/tool-deal-builder'));
    assert.ok(excludeReason('/GOLD/index.html'), 'the match must be case-insensitive');
  });

  test('every tier page in the tree resolves to an excluded path', () => {
    const tier = pages.filter((p) => /^(gold|platinum|diamond|reserve)\//.test(p.relPath));
    assert.ok(tier.length >= 30, `expected the tier tree, found ${tier.length}`);
    const leaked = tier.filter((p) => !excludeReason(p.path)).map((p) => p.path);
    assert.deepEqual(leaked, [], 'these tier URLs would be intercepted and the member never prompted for a password');
  });

  test('every page A0.1 gives no container to is excluded', async () => {
    // Swup throws if the incoming document has no container, so "A0.1 skipped it"
    // and "the router ignores it" have to be the same set — derived here from the
    // real decidePlan rather than from a path list.
    // Was ['perch.html', 'nav-block.html']. The shell is deleted, so nav-block.html —
    // the nav-only fragment referenced by zero pages — is the only skip page left.
    for (const relPath of ['nav-block.html']) {
      const plan = await planFromHtml(read(join(SITE, relPath)), HTMLRewriter);
      assert.equal(plan.kind, 'skip', `${relPath} is expected to be a skip page`);
      assert.ok(excludeReason(servedPath(relPath)), `${relPath} must be excluded`);
      assert.equal(wantsRouter(plan), false, 'and must not get a router tag');
    }
    // Was `assert.ok(excludeReason('/'))` — `/` was a 200-rewrite to the shell, so it
    // had no container and had to be excluded. `/` is index.html now, an ordinary page
    // with an ordinary container, so the assertion INVERTS: the homepage must be
    // interceptable. Leaving the old form would have kept the most-linked page on the
    // site as the one page that hard-navigates.
    assert.equal(excludeReason('/'), null, '`/` is the real homepage and must be interceptable');
    assert.equal(excludeReason('/index.html'), null, 'and so is every spelling of it');
  });

  test('the load-time-bootstrap exclusions name a real defect each', () => {
    // These are the pages whose behaviour a swap cannot re-establish (spike F2).
    // Excluding them costs a full navigation — today's behaviour — and the
    // alternative is a calculator that looks fine and does nothing.
    const cases = [
      ['/tool-1031-exchange', 'js/tool-1031-exchange.js', /DOMContentLoaded/],
      ['/tool-rental-real-estate-tax-strategy-analyzer', 'js/tool-rental-real-estate-tax-strategy-analyzer.js', /readyState/],
      ['/tool-str-strategy-analyzer', 'js/tool-str-strategy-analyzer.js', /readyState/],
      ['/tool-entity-formation', 'js/tool-entity-formation.js', /addEventListener/],
      ['/tool-firpta-withholding', 'js/page/tool-firpta-withholding.js', /addEventListener/],
      // 2026-09-04 -- the four member tools published at the root.
      ['/tool-entity-formation-multi', 'js/tool-entity-formation-multi.js', /DOMContentLoaded/],
      ['/tool-operating-agreement', 'js/tool-operating-agreement.js', /DOMContentLoaded/],
      ['/tool-structuring', 'js/tool-structuring.js', /DOMContentLoaded/],
      ['/tool-material-participation-tracker', 'js/page/tool-material-participation-tracker.js', /addEventListener/],
      // 2026-09-05 -- divorce suite, tool 1.
      ['/tool-divorce-marital-balance-sheet', 'js/page/tool-divorce-marital-balance-sheet.js', /addEventListener/],
      ['/tool-divorce-business-valuation', 'js/page/tool-divorce-business-valuation.js', /addEventListener/],
      ['/tool-divorce-alimony', 'js/page/tool-divorce-alimony.js', /addEventListener/],
      ['/tool-divorce-child-support', 'js/page/tool-divorce-child-support.js', /addEventListener/],
      ['/tool-divorce-marital-home', 'js/page/tool-divorce-marital-home.js', /addEventListener/],
      ['/tool-divorce-retirement', 'js/page/tool-divorce-retirement.js', /addEventListener/],
      ['/tool-divorce-filing', 'js/page/tool-divorce-filing.js', /addEventListener/],
      ['/tool-divorce-carryforwards', 'js/page/tool-divorce-carryforwards.js', /addEventListener/],
      ['/tool-divorce-tax-rider', 'js/page/tool-divorce-tax-rider.js', /addEventListener/],
    ];
    for (const [path, file, signature] of cases) {
      assert.ok(excludeReason(path), `${path} must be excluded`);
      assert.ok(excludeReason(path + '.html'), 'both URL forms — Pages serves foo.html at /foo and 308s /foo.html');
      assert.match(read(join(SITE, file)), signature, `${file} no longer has the load-time bootstrap that justified excluding ${path}`);
    }
  });

  test('an exclusion covers BOTH spellings of its URL', () => {
    // THE DEFECT THIS CATCHES, found on the Preview sweep and not by any test
    // that existed at the time: `/index.html` was excluded and `/index` was not.
    // Pages serves `foo.html` at `/foo` AND answers `/foo.html` with a 308, so
    // every excluded page has two live URLs and an exclusion that names one of
    // them is not an exclusion. `/index` resolved to the shell, Swup found no
    // container, and the router fell back to a full document load.
    //
    // Derived from the tree rather than from a list, so a page added next month
    // is covered by the same rule.
    const asymmetric = [];
    for (const page of pages) {
      const clean = page.path;                    // /foo  or  /dir/
      const dotHtml = '/' + page.relPath;         // /foo.html
      if (!!excludeReason(clean) !== !!excludeReason(dotHtml)) {
        asymmetric.push(`${clean} → ${!!excludeReason(clean)} but ${dotHtml} → ${!!excludeReason(dotHtml)}`);
      }
    }
    assert.deepEqual(asymmetric, [], 'these URLs are excluded in one spelling and interceptable in the other');
  });

  test('a redirect into an excluded page is itself excluded', () => {
    // The other half of the same defect. `_redirects` sends `/index.html` to `/`,
    // which is the shell — so following it lands on a document with no container
    // no matter which URL was clicked. Any source whose TARGET is excluded has to
    // be excluded too, and both of its spellings with it.
    const redirects = read(join(SITE, '_redirects'))
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => l.split(/\s+/))
      .filter((parts) => parts.length >= 2 && parts[0].startsWith('/'));
    assert.ok(redirects.length > 10, `expected the redirect table, parsed ${redirects.length} rules`);

    const leaks = [];
    for (const [from, to] of redirects) {
      if (!excludeReason(to)) continue;           // the target is a normal page
      for (const form of [from, from.replace(/\.html$/, '')]) {
        if (!excludeReason(form)) leaks.push(`${form} → ${to} (excluded target, un-excluded source)`);
      }
    }
    assert.deepEqual(leaks, [], 'these URLs redirect into a page with no swap container');
  });

  test('the pages this ticket exists for are NOT excluded', () => {
    for (const path of ['/book', '/contact', '/tool-capital-gains', '/blog', '/engagement']) {
      assert.equal(excludeReason(path), null, `${path} must be interceptable`);
    }
  });

  test('every exclusion carries a reason a reader can act on', () => {
    for (const rule of EXCLUDED_ROUTES) {
      assert.ok(rule.id && rule.reason && rule.reason.length > 40, `${rule.id} needs a real reason`);
    }
  });
});

describe('the shared-chrome gate', () => {
  const dom = (html) => new JSDOM(html).window;

  test('a document with the site nav and jQuery may swap', () => {
    const w = dom('<body><nav class="menubar"></nav><main id="perch-main"></main></body>');
    w.jQuery = () => {};
    assert.equal(sharedChrome(w.document, w).ok, true);
  });

  test('a document with no site nav must hard-navigate', () => {
    // 13 of the 96 interceptable pages ship no chrome at all. Soft-navigating AWAY
    // from one would hand the destination a document with no nav to inherit — the
    // destination would render stripped of its navigation. Hard-navigating is
    // exactly what those pages do today.
    const w = dom('<body><main id="perch-main"></main></body>');
    w.jQuery = () => {};
    assert.equal(sharedChrome(w.document, w).ok, false);
  });

  test('the gate matches the tree it was derived from', () => {
    const chromeless = interceptable().filter((p) => !p.hasNav).map((p) => p.relPath);
    assert.ok(chromeless.length > 5 && chromeless.length < 25, `expected a small chrome-less set, got ${chromeless.length}`);
    assert.ok(chromeless.includes('404.html'));
    assert.ok(!chromeless.includes('book.html'), '/book must be soft-navigable — it is the reveal page');
    assert.ok(!chromeless.includes('contact.html'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. The §5 re-init recipe
// ─────────────────────────────────────────────────────────────────────────────

describe('RE-INIT-INVENTORY §5, as executed', () => {
  const liveDom = () => new JSDOM(
    '<html><head><title>old</title><link rel="canonical" href="https://www.donovan.law/old">'
    + '</head><body><nav class="menubar"><a id="btn-tf"></a></nav>'
    + '<main id="perch-main"><input class="dl-currency" id="x"></main></body></html>',
    { url: ORIGIN + '/new' },
  ).window;

  test('§5.1 — title and canonical follow the incoming page', () => {
    const w = liveDom();
    const incoming = new JSDOM('<html><head><title>new</title><link rel="canonical" href="https://www.donovan.law/new"></head><body></body></html>').window.document;
    const r = syncHead(w.document, incoming);
    assert.equal(r.status, 'ok');
    assert.equal(w.document.title, 'new');
    assert.equal(w.document.querySelector('link[rel="canonical"]').getAttribute('href'), 'https://www.donovan.law/new');
  });

  test('§5.1 — a page with no canonical does not inherit the previous one', () => {
    const w = liveDom();
    const incoming = new JSDOM('<html><head><title>t</title></head><body></body></html>').window.document;
    syncHead(w.document, incoming);
    assert.equal(w.document.querySelector('link[rel="canonical"]'), null);
  });

  test('§5.3 — the nav guard passes when the nav is outside the container', () => {
    const w = liveDom();
    const r = checkNav(w.document);
    assert.equal(r.status, 'ok');
    assert.ok(r.detail.targets > 0, 'a guard that finds no targets is vacuous');
  });

  test('§5.3 — and reds when a page shape puts the nav INSIDE it', () => {
    // The condition under which this row would need real work. Turning a silent
    // regression into a visible one is the entire value of keeping the row.
    const w = new JSDOM('<body><main id="perch-main"><nav class="menubar"></nav></main></body>').window;
    assert.equal(checkNav(w.document).status, 'broken');
  });

  test('§5.5 — booking widget boot() is called through the public seam', () => {
    const w = liveDom();
    let booted = 0;
    w.DLBooking = { boot: () => { booted++; } };
    assert.equal(bootBookingWidget(w).status, 'ok');
    assert.equal(booted, 1);
  });

  test('§5.5 — and reports `absent` on a page with no widget instead of throwing', () => {
    assert.equal(bootBookingWidget(liveDom()).status, 'absent');
  });

  test('§5.5 — js/booking-widget.js publishes that seam and keeps it', () => {
    // Two edits have to hold together: the boot IIFE publishes DLBooking.boot,
    // and the API IIFE below it must not clobber the namespace. A bare
    // `window.DLBooking = {…}` in the second block silently deletes the seam.
    const src = read(join(SITE, 'js', 'booking-widget.js'));
    assert.match(src, /window\.DLBooking = Object\.assign\(window\.DLBooking \|\| \{\}, \{ boot: boot \}\)/);
    assert.doesNotMatch(src, /window\.DLBooking = \{/, 'the DLBooking API object must merge, not replace');
  });

  test('§5.10 — the input formatter is re-attached, scoped to the container', () => {
    const w = liveDom();
    const roots = [];
    w.DonovanInputFormatter = { attachAll: (root) => roots.push(root) };
    const r = reattachInputFormatter(w.document, w);
    assert.equal(r.status, 'ok');
    assert.equal(roots.length, 1);
    assert.equal(roots[0].id, CONTAINER_ID, 'only the swapped region can hold new inputs');
    assert.equal(r.detail.currency, 1);
  });

  test('§5.10 — the formatter file still exposes the re-entry point this relies on', () => {
    assert.match(read(join(SITE, 'js', 'page', 'input-formatter.js')), /attachAll: attachAll/);
  });

  // REMOVED: §5.9 — the beacon is notified by pushState and never re-loaded
  // the beacon is gone; there is nothing to notify or re-load.

  test('§5.11 — GA4 page_view is a documented stub until the measurement id lands', () => {
    const w = liveDom();
    const pending = gaPageView(w.document, w);
    assert.equal(pending.status, 'pending');
    assert.match(pending.detail.reason, /external blocker/);

    // And it starts working the moment a tag exists, with no further edit.
    const sent = [];
    w.gtag = (...args) => sent.push(args);
    const ok = gaPageView(w.document, w);
    assert.equal(ok.status, 'ok');
    assert.deepEqual(sent[0][0], 'event');
    assert.deepEqual(sent[0][1], 'page_view');
    assert.equal(sent[0][2].page_location, ORIGIN + '/new');
  });

  test('§5.11 — no GA4 tag is on the adoption list (re-running analytics is the §3.6 defect)', () => {
    for (const key of ADOPT_SCRIPTS.keys()) {
      assert.doesNotMatch(key, /googletagmanager|gtag|analytics/i);
    }
  });

  test('the recipe reports every row, and defers none now that A31 has landed', () => {
    const w = liveDom();
    const report = reinit(w.document, w, null);
    const steps = report.rows.map((r) => r.step);
    // TWELVE, not eleven, since JORDAN-PERCH-A23 (#53). A0.3 inventoried the
    // eleven bindings the swap DESTROYS; row 12 is the one it STRANDS — the
    // Turnstile challenge, whose widget id lives in the booking widget's closure
    // and cannot be observed from the checklist. Growing this list is a decision
    // and has to be made here; SHRINKING it is the drift #48 was opened to stop,
    // and an exact deepEqual is what refuses both silently.
    assert.deepEqual(steps, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], 'all twelve §5 rows must be accounted for');
    // BEHAVIOUR DELTA, SHELDON-PERCH-A31 (#56). Under #52 rows 7 and 8 were
    // `deferred` because the booking control channel had no executor outside the
    // iframe. A31 built it (js/perch/booking-control.js), so both are `covered`
    // and nothing in the recipe is deferred any more. The row COUNT is the part
    // that must never change — a row that vanishes is the drift #48 was opened
    // to stop — so it is asserted above independently of any status.
    const deferred = report.rows.filter((r) => r.status === 'deferred').map((r) => r.step);
    assert.deepEqual(deferred, [], 'A31 (#56) closed the last two deferred rows');
    const covered = report.rows.filter((r) => r.status === 'covered').map((r) => r.step);
    assert.deepEqual(covered, [6, 7, 8], 'the gate reveal and the two booking-channel rows');
    for (const step of [7, 8]) {
      const r = report.rows.find((x) => x.step === step);
      assert.match(r.detail.by, /booking-control\.js/, `row ${step} must name its new owner`);
    }
    // This dom carries no booking container, so row 12 is the no-op branch —
    // which is the branch 95 of the 96 interceptable pages take on every swap.
    assert.equal(report.rows.find((r) => r.step === 12).status, 'absent');
    assert.deepEqual(report.broken, []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. Injection: the router reaches the page, and the layer still does
// ─────────────────────────────────────────────────────────────────────────────

describe('the router tag is injected without displacing the layer', () => {
  async function rewrite(relPath, env, url) {
    const html = read(join(SITE, relPath));
    const plan = await planFromHtml(html, HTMLRewriter);
    let rw = new HTMLRewriter();
    for (const [sel, h] of layerHandlers(plan, routerTags(plan, env, url))) rw = rw.on(sel, h);
    return { plan, out: await rw.transform(new Response(html)).text() };
  }

  test('BOTH tags survive one rewrite, in the order the router depends on', async () => {
    // THE REGRESSION THIS CATCHES, and it is not hypothetical — it is why
    // routerTags() returns a string instead of its own handler. lol-html keeps
    // only the LAST onEndTag callback registered for an element, so a second
    // `['head', …]` handler that calls el.onEndTag() DELETES the layer's tags
    // outright: no error, no console message, just a site with no orb.
    const { out } = await rewrite('contact.html', {}, 'https://sheldon-x.donovan-site.pages.dev/contact');
    assert.ok(out.includes(LAYER_MODULE), 'the persistent layer must still be referenced');
    assert.ok(out.includes(ROUTER_MODULE), 'the router must be referenced');
    assert.ok(out.indexOf(LAYER_MODULE) < out.indexOf(ROUTER_MODULE), 'the router reads Perch.layer, so the layer tag must come first');
    assert.equal((out.match(/perch-swup-router\.js/g) || []).length, 1, 'exactly one router tag');
  });

  test('the injected tag is external and same-origin — no CSP change, no nonce', () => {
    assert.match(ROUTER_TAGS, /^<script type="module" src="\/js\/perch-swup-router\.js"><\/script>$/);
    assert.doesNotMatch(ROUTER_TAGS, /nonce/);

    // And the policy it runs under is untouched by this ticket — asserted against
    // the REAL policy string buildCsp() emits, not against the file's prose, which
    // discusses 'unsafe-inline' at length precisely because it removed it.
    const scriptSrc = buildCsp('NONCE')
      .split('; ')
      .find((d) => d.startsWith('script-src '));
    assert.equal(
      scriptSrc,
      "script-src 'self' 'nonce-NONCE' https://code.jquery.com https://cdnjs.cloudflare.com "
      + 'https://challenges.cloudflare.com',
      'script-src must be byte-identical to what A02 left MINUS the four removed hosts: '
      + 'no unsafe-inline, no strict-dynamic, and above all no NEW host',
    );
    // Every script the router can insert must already be admitted by that policy.
    for (const key of ADOPT_SCRIPTS.keys()) {
      const host = key.startsWith('/') ? "'self'" : new URL(key).origin;
      assert.ok(scriptSrc.includes(host), `${key} would need a CSP change — it must not be adoptable`);
    }
  });

  test('a skip page gets neither tag', async () => {
    // Was driven on perch.html, the shell. nav-block.html is the skip page that
    // remains — same decision from the same planner, on a page that still exists.
    const { plan, out } = await rewrite('nav-block.html', {}, 'https://x.pages.dev/');
    assert.equal(plan.kind, 'skip');
    assert.ok(!out.includes(ROUTER_MODULE));
    assert.ok(!out.includes(LAYER_MODULE));
  });

  test('the environment gate is Preview-first and fails safe', () => {
    const prod = 'https://www.donovan.law/contact';
    const preview = 'https://sheldon-perch-a22-swup.donovan-site.pages.dev/contact';
    assert.equal(routerEnabled({}, preview), true, 'Preview: on by default');
    assert.equal(routerEnabled({}, 'http://localhost:8788/contact'), true);
    assert.equal(routerEnabled({}, prod), false, 'production: OFF until someone decides otherwise');
    assert.equal(routerEnabled({ PERCH_ROUTER: 'on' }, prod), true, 'explicit opt-in');
    assert.equal(routerEnabled({ PERCH_ROUTER: 'OFF' }, preview), false, 'kill switch beats the default, case-insensitively');
    assert.equal(routerEnabled(undefined, 'not a url'), false, 'unparseable → behave like production');
    // A hostname that merely CONTAINS pages.dev is not a Pages preview.
    assert.equal(routerEnabled({}, 'https://pages.dev.evil.example/contact'), false);
  });

  test('the middleware wires the gate to the real request, not to a constant', () => {
    const mw = read(join(SITE, 'functions', '_middleware.js'));
    assert.match(mw, /routerTags\(plan, context\.env, request\.url\)/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. The other half of the architecture is still intact
// ─────────────────────────────────────────────────────────────────────────────

describe('the router does not undo A0.1 / A0.2 / A2.1', () => {
  test('the container selector is derived, never re-declared', () => {
    const policy = read(join(SITE, 'js', 'perch', 'swap-policy.js'));
    assert.match(policy, /from '\.\/placement\.js'/, 'CONTAINER_ID must come from the A2.1 module');
    assert.doesNotMatch(policy, /['"]perch-main['"]/, 'a second copy of the id is a second thing to drift');
  });

  test('the superseded body-swap router is loaded by no page', () => {
    // js/perch-router.js is the pre-Phase-A reference implementation: it replaces
    // document.body.innerHTML and re-executes page scripts, both of which this
    // router deliberately does not do. It is kept as documentation (A0.3 cites it
    // throughout) and it must stay unreferenced — two routers on one page would
    // fight over every click. Retiring the file is a follow-up, not this ticket.
    const referenced = pages.filter((p) => p.scripts.some((s) => /perch-router\.js$/.test(s.src)));
    assert.deepEqual(referenced.map((p) => p.relPath), []);
  });

  test('the swap container still carries no inline script (A0.2 rule holds)', () => {
    // Belt for the swap-container guard: if adoption ever tempted someone to put
    // an inline block back in the container, this reds here too.
    const offenders = [];
    for (const page of interceptable()) {
      const { document: doc } = new JSDOM(read(join(SITE, page.relPath))).window;
      for (const s of doc.body.querySelectorAll('script')) {
        if (!s.hasAttribute('src') && s.textContent.trim()) offenders.push(page.relPath);
      }
    }
    assert.deepEqual(offenders, []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. JORDAN-PERCH-A23 (#53) — the Turnstile widget survives a swap
// ─────────────────────────────────────────────────────────────────────────────
//
// WHAT IS BEING DEFENDED. `#dl-bk-turnstile` is minted by the booking widget's
// FORM step, so every swap hands the widget a mount point the previous
// generation's Turnstile registry has never seen. The widget's own
// `mountTurnstile` retries only while `window.turnstile` is ABSENT — if
// `render()` THROWS, the catch swallows it, the widget id stays null and nothing
// tries again. The form still submits; `turnstile_token` goes out empty;
// /booking/create answers 403 and the caller sees a generic error. Nothing in
// the console says so, which is why it needs a test rather than a look.
//
// These run the REAL js/booking-widget.js against a recording Turnstile double,
// because the assertion that matters — "a widget id the write path can read was
// captured" — lives in that file's closure and cannot be observed from outside
// it. Cloudflare's own api.js is not reachable from a test runner and a real
// token solve refuses automation by design; that half is a manual check and is
// recorded as one in the PR. See [[feedback_turnstile_not_agent_verifiable]].

describe('the Turnstile widget is freshly rendered after a content swap', () => {
  const BOOKING_MARKUP = '<div id="dl-booking" data-api="/booking"></div>';
  const SLOT = '2026-08-03T14:00:00Z';

  /**
   * Boot the real widget in a container-shaped document, with a Turnstile double
   * that records every call and behaves like the real one on the two points that
   * matter: `render()` returns an opaque id, and `getResponse()` answers only for
   * an id that is still live.
   */
  function harness() {
    const dom = new JSDOM(
      '<!doctype html><html><head><title>book</title></head><body>'
      + '<main id="' + CONTAINER_ID + '">' + BOOKING_MARKUP + '</main></body></html>',
      { url: ORIGIN + '/book', runScripts: 'dangerously', pretendToBeVisual: true },
    );
    const { window } = dom;
    const calls = [];
    const liveIds = new Set();
    let next = 0;
    const ts = {
      mode: 'ok', // flip to 'throw' to stage the fresh-node failure
      render(el) {
        calls.push('render');
        if (ts.mode === 'throw') throw new Error('Turnstile Widget already rendered');
        const id = String(next++);
        liveIds.add(id);
        el.innerHTML = '<iframe title="challenge"></iframe>';
        return id;
      },
      getResponse(id) { return liveIds.has(String(id)) ? 'TOKEN-' + id : undefined; },
      reset(id) { calls.push('reset'); liveIds.add(String(id)); },
      remove(id) { calls.push('remove'); liveIds.delete(String(id)); },
    };
    window.turnstile = ts;

    const TYPES = { types: [{ id: 'c', name: 'Consult', duration_minutes: 30 }] };
    const SLOTS = { slots: [{ startISO: SLOT, endISO: '2026-08-03T14:30:00Z' }] };
    window.fetch = async (u) => ({
      ok: true,
      status: 200,
      json: async () => (String(u).includes('/types') ? TYPES : SLOTS),
    });
    window.eval(read(join(SITE, 'js/booking-widget.js')));
    return { window, doc: window.document, ts, calls };
  }

  const tick = () => new Promise((r) => setTimeout(r, 40));

  /** Drive the widget to the FORM step, which is what paints #dl-bk-turnstile. */
  async function toForm(window) {
    for (let i = 0; i < 5; i++) await tick();
    window.DLBooking.selectType('c');
    for (let i = 0; i < 5; i++) await tick();
    window.DLBooking.selectSlot(SLOT);
    for (let i = 0; i < 6; i++) await tick();
  }

  /** Replace the container's markup — what Swup's content:replace does. */
  function swap(doc, window, markup) {
    doc.getElementById(CONTAINER_ID).innerHTML = markup;
    window.DLBooking.boot(); // §5 row 5, unchanged by this ticket
  }

  const challenge = (doc) => {
    const m = doc.querySelector('#dl-bk-turnstile');
    return { mount: !!m, rendered: !!(m && m.querySelector('iframe')) };
  };

  test('CONTROL — the defect is real: a fresh node whose render throws is never repaired', async () => {
    // If this ever stops failing-before-repair, row 12 has nothing to defend and
    // the rest of this block proves nothing.
    const { window, doc, ts } = harness();
    await toForm(window);
    assert.deepEqual(challenge(doc), { mount: true, rendered: true }, 'premise: it works on a full load');

    ts.mode = 'throw';
    swap(doc, window, BOOKING_MARKUP);
    await toForm(window);
    assert.deepEqual(challenge(doc), { mount: true, rendered: false },
      'the swapped-in mount carries no challenge — the silent-403 state');

    // The API comes good again; the widget still never retries on its own.
    ts.mode = 'ok';
    for (let i = 0; i < 10; i++) await tick();
    assert.equal(challenge(doc).rendered, false, 'and nothing in the widget ever tries again');
    window.close();
  });

  test('row 12 repairs the fresh node, and the id reaches the write path', async () => {
    const { window, doc, ts } = harness();
    await toForm(window);
    ts.mode = 'throw';
    swap(doc, window, BOOKING_MARKUP);
    await toForm(window);
    ts.mode = 'ok';

    const r = renderTurnstile(doc, window);
    assert.equal(r.status, 'ok');
    assert.equal(r.detail.action, 'render', 'a mount with no live widget is RENDERED');
    assert.ok(r.detail.widgetId != null, 'and the widget id was captured');
    assert.deepEqual(challenge(doc), { mount: true, rendered: true });

    // The assertion that actually matters: the id row 12 captured is one the
    // write path's `getResponse(_tsWidgetId)` can still resolve to a token.
    assert.equal(window.turnstile.getResponse(r.detail.widgetId), 'TOKEN-' + r.detail.widgetId);
    window.close();
  });

  test('after N swaps the challenge is freshly rendered on the booking form', async () => {
    const { window, doc } = harness();
    const seen = [];
    for (let n = 1; n <= 5; n++) {
      swap(doc, window, BOOKING_MARKUP);
      await toForm(window);
      const r = renderTurnstile(doc, window);
      seen.push({ n, status: r.status, action: r.detail.action, ...challenge(doc) });
    }
    for (const s of seen) {
      assert.equal(s.status, 'ok', 'swap ' + s.n + ': row 12 must succeed');
      assert.equal(s.mount, true, 'swap ' + s.n + ': the mount point must be present');
      assert.equal(s.rendered, true, 'swap ' + s.n + ': a challenge must be rendered on it');
    }
    window.close();
  });

  test('DOUBLE-RENDER GUARD — a live widget is re-executed, never rendered twice', async () => {
    const { window, doc, calls } = harness();
    swap(doc, window, BOOKING_MARKUP);
    await toForm(window);
    calls.length = 0;

    for (let i = 0; i < 4; i++) {
      const r = renderTurnstile(doc, window);
      assert.equal(r.status, 'ok');
      assert.equal(r.detail.action, 'reset', 'a mount that already carries a live widget is reset');
    }
    assert.deepEqual(calls, ['reset', 'reset', 'reset', 'reset'],
      'four re-init passes over a live widget issue zero renders');
    assert.equal(doc.querySelectorAll('#dl-bk-turnstile iframe').length, 1,
      'and exactly one challenge exists on the node');
    window.close();
  });

  test('NO-OP — a page with no protected form touches neither the DOM nor Turnstile', async () => {
    const { window, doc, calls } = harness();
    swap(doc, window, BOOKING_MARKUP);
    await toForm(window);
    calls.length = 0;

    // Swap to something formless — the shape of 95 of the 96 interceptable pages.
    doc.getElementById(CONTAINER_ID).innerHTML = '<article><h1>About</h1><p>Copy.</p></article>';
    const before = doc.getElementById(CONTAINER_ID).innerHTML;

    const r = renderTurnstile(doc, window);
    assert.equal(r.status, 'absent');
    assert.match(r.detail.reason, /no Turnstile-protected form/);
    assert.deepEqual(calls, [], 'window.turnstile was never reached');
    assert.equal(doc.getElementById(CONTAINER_ID).innerHTML, before, 'the container is byte-identical');
    window.close();
  });

  test('a booking page whose widget is still at TYPE_PICK defers rather than failing', async () => {
    // The ordinary case at swap time: the widget has just booted, there is no
    // mount point yet, and its own render will run when the form paints. That is
    // not a broken row and must not be reported as one.
    const { window, doc, calls } = harness();
    swap(doc, window, BOOKING_MARKUP);
    for (let i = 0; i < 5; i++) await tick();
    calls.length = 0;

    const r = renderTurnstile(doc, window);
    assert.equal(r.status, 'deferred');
    assert.deepEqual(calls, [], 'nothing is rendered into a form that has not painted');
    window.close();
  });

  test('the step is wired into the recipe the router actually runs', () => {
    // Behaviour, not spelling: run the real reinit() and look for the row.
    const dom = new JSDOM(
      '<!doctype html><html><head><title>t</title></head><body>'
      + '<main id="' + CONTAINER_ID + '"><article>no form</article></main></body></html>',
      { url: ORIGIN + '/about' },
    );
    const { rows, broken } = reinit(dom.window.document, dom.window, null);
    const r12 = rows.find((x) => x.step === 12);
    assert.ok(r12, 'the recipe must carry row 12');
    assert.equal(r12.name, 'turnstile re-render');
    assert.equal(r12.status, 'absent', 'and it is a clean no-op on a formless page');
    assert.equal(broken.includes('turnstile re-render'), false, 'an absent row is not a broken one');
    // Row order is load-bearing: the seam it drives is on the widget row 5 boots.
    assert.ok(rows.findIndex((x) => x.step === 12) > rows.findIndex((x) => x.step === 5));
    dom.window.close();
  });

  test('the router file itself renders no Turnstile widget of its own', () => {
    // The token is read as getResponse(_tsWidgetId) inside the widget's closure.
    // A render issued from the router or the recipe would paint a real challenge
    // whose id nobody holds — the token would still be empty and the booking
    // would still 403. So neither file may call turnstile.render() directly.
    for (const f of ['js/perch-swup-router.js', 'js/perch/reinit.js']) {
      const src = read(join(SITE, f));
      const code = src.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
      assert.equal(/turnstile\s*\.\s*render\s*\(/.test(code), false,
        f + ' must reach the widget seam, not Turnstile directly');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. §5.1 WIDENED — the incoming head, reconciled (JORDAN-198, #198)
// ─────────────────────────────────────────────────────────────────────────────
//
// The defect: the swap is scoped to `main#perch-main`, so the head is never
// swapped, and syncHead reconciled only title + canonical out of it. Everything
// else in the incoming head was discarded and the previous page's kept — page
// styles dropped, description and og stale, robots frozen, stylesheet links
// gone. Invisible on a direct load, which is why testing never saw it, and
// visible to anyone browsing.
//
// These tests are the reconcile's contract. Reverting reconcileHead() in
// js/perch/reinit.js reds every one of them.

/** The five managed classes of a head, in document order, as comparable strings. */
function headPrint(head) {
  const out = [];
  for (const el of head.children) {
    const t = el.tagName.toLowerCase();
    const a = (n) => el.getAttribute(n) || '';
    if (t === 'style') out.push('style::' + (el.textContent || ''));
    else if (t === 'link' && a('rel').toLowerCase().split(/\s+/).includes('stylesheet')) {
      out.push('sheet::' + a('href') + '::' + a('media'));
    } else if (t === 'meta' && a('name').toLowerCase() === 'description') out.push('desc::' + a('content'));
    else if (t === 'meta' && a('name').toLowerCase() === 'robots') out.push('robots::' + a('content'));
    else if (t === 'meta' && a('property').toLowerCase().startsWith('og:')) out.push('og::' + a('property') + '=' + a('content'));
  }
  return out;
}

/** Every script in the document, head and body, by src (or a marker for inline). */
const scriptPrint = (doc) => [...doc.querySelectorAll('script')]
  .map((s) => (s.getAttribute('src') || 'INLINE:' + (s.textContent || '').length));

describe('JORDAN-198 §5.1 — the tree this reconcile exists for (non-vacuity)', () => {
  // Every claim the reconcile is justified by, measured from the shipped tree
  // rather than quoted from the ticket. A page shape that drifts out from under
  // these numbers reds here instead of silently making the reconcile pointless.
  test('page-authored head rows exist in quantity, on the pages a swap can reach', () => {
    const int = interceptable();
    const withStyle = int.filter((p) => p.headStyles > 0);
    const withSheet = int.filter((p) => p.headSheets > 0);
    const styleOnly = int.filter((p) => p.headStyles > 0 && p.headSheets === 0);
    assert.ok(withStyle.length > 80, `only ${withStyle.length} interceptable pages author a head <style>`);
    assert.ok(withSheet.length > 80, `only ${withSheet.length} interceptable pages author a stylesheet link`);
    assert.ok(int.filter((p) => p.headDesc > 0).length > 80, 'meta description census collapsed');
    assert.ok(int.filter((p) => p.headOg > 0).length > 80, 'og census collapsed');

    // THE SHARPEST ROW. These pages have no stylesheet at all — the head <style>
    // block IS their styling — so before this fix a soft navigation into one
    // painted it with the PREVIOUS page's CSS. Unstyled, in production.
    assert.ok(styleOnly.length >= 5, `expected the style-only page set, got ${styleOnly.length}`);
    assert.ok(styleOnly.some((p) => p.relPath === '404.html'));
    assert.ok(styleOnly.some((p) => /controversy-roadmap/.test(p.relPath)));
  });

  test('meta robots is authored on both sides of the index boundary', () => {
    // Both faces of the robots defect need a real page to be provable: a page
    // that must STAY noindex after a swap onto it, and a page that must not
    // INHERIT noindex from the page a visitor arrived from.
    const int = interceptable();
    const noindex = int.filter((p) => p.headRobots.some((c) => /noindex/i.test(c)));
    const indexable = int.filter((p) => p.headRobots.some((c) => /^\s*index/i.test(c)));
    assert.ok(noindex.length >= 5, `expected gated noindex pages, got ${noindex.length}`);
    assert.ok(noindex.some((p) => p.relPath === 'book.html'));
    // Was `login.html` until JORDAN-196-LOGIN-SIGNOUT-R1 (#196) deleted that page.
    // The named second witness has to be an interceptable page that is noindex in
    // its own right, not merely one that happens to be in the set today —
    // tool-structuring.html was the witness until 2026-09-04, when the Structuring
    // Tool was opened to the public; tool-economics.html is the paused Deal
    // Economics page and carries `noindex,nofollow` in its own right.
    assert.ok(noindex.some((p) => p.relPath === 'tool-economics.html'));
    assert.ok(indexable.some((p) => p.relPath === 'disclaimer.html'), 'need an explicit index,follow page');
    // And the great majority of the tree declares no robots meta at all, which is
    // the case where a stranded `noindex` would be worst: those pages are in
    // sitemap.xml (CLAUDE.md §3 rule 6).
    assert.ok(int.filter((p) => p.headRobots.length === 0).length > 80);
  });

  test('no shipped head interleaves <style> before a stylesheet link', () => {
    // Why the cascade survives: in the raw files every head <style> follows every
    // stylesheet link. The edge then appends its two sheets AFTER those style
    // blocks on purpose (perch-layer-inject.js:63-69), so the layer wins at equal
    // specificity. Reconciling the classes as one ordered group preserves both
    // facts; a page that interleaved them would need this re-measured.
    const bad = interceptable().filter((p) => /SL/.test(p.cssSeq)).map((p) => p.relPath);
    assert.deepEqual(bad, [], 'a head that interleaves <style> and <link rel=stylesheet>');
  });
});

describe('JORDAN-198 §5.1 — the safety premise: these head rows are PAGE-authored', () => {
  /** The full edge composition, exactly as functions/_middleware.js:314-315 builds it. */
  async function injectFull(relPath) {
    const html = read(join(SITE, relPath));
    const plan = await planFromHtml(html, HTMLRewriter);
    let rw = new HTMLRewriter();
    for (const [sel, h] of injectHandlers(plan)) rw = rw.on(sel, h);
    const headTags = routerTags(plan, { PERCH_ROUTER: 'on' }, ORIGIN + servedPath(relPath))
      + barStylesheetTag(plan);
    for (const [sel, h] of layerHandlers(plan, headTags)) rw = rw.on(sel, h);
    return rw.transform(new Response(html)).text();
  }

  // A representative slice rather than all 147: a chrome page, the reveal page,
  // both style-only shapes, the two-<style> page and a gated noindex page.
  const SAMPLE = [
    'contact.html', 'book.html', '404.html', 'tools.html', 'disclaimer.html',
    'blog-controversy-roadmap-4-appeals.html', 'tool-economics.html',
  ];

  test('the edge adds TWO stylesheet links to <head> and nothing else this ticket touches', async () => {
    // THE WHOLE SAFETY ARGUMENT. Swapping a head element is only defensible if the
    // element belongs to the page. So: diff the head of the real edge output
    // against the head of the raw file. Whatever the edge added is shell; the rest
    // is page-authored and may be reconciled.
    const addedSheets = new Map();
    const addedOther = [];
    for (const relPath of SAMPLE) {
      const rawWin = new JSDOM(read(join(SITE, relPath))).window;
      const injWin = new JSDOM(await injectFull(relPath)).window;
      const raw = headPrint(rawWin.document.head);
      const inj = headPrint(injWin.document.head);
      const pool = [...raw];
      for (const row of inj) {
        const i = pool.indexOf(row);
        if (i >= 0) { pool.splice(i, 1); continue; }
        if (row.startsWith('sheet::')) addedSheets.set(row.split('::')[1], relPath);
        else addedOther.push(`${relPath} ${row}`);
      }
      rawWin.close();
      injWin.close();
    }
    assert.deepEqual(
      [...addedSheets.keys()].sort(), [...SHELL_STYLESHEETS].sort(),
      'the edge injects exactly the shell stylesheets into <head>',
    );
    assert.deepEqual(addedOther, [],
      'the edge must inject NO <style> block and NO description/og/robots meta — '
      + 'if it ever does, that row stops being page-authored and must not be swapped');
  });

  test('SHELL_STYLESHEETS cannot drift from the assets the edge actually injects', () => {
    // reinit.js ships to the browser and cannot import functions/_lib/*, so it
    // spells the two shell hrefs as literals. This is the guard that keeps the
    // literal honest: rename either asset and the build reds here rather than
    // silently un-protecting it.
    assert.deepEqual([...SHELL_STYLESHEETS].sort(), [LAYER_STYLESHEET, BAR_STYLESHEET].sort());
  });
});

describe('JORDAN-198 §5.1 — one case per element class', () => {
  const HEAD_A = '<title>A</title><link rel="canonical" href="https://www.donovan.law/a">'
    + '<meta name="description" content="A describes A">'
    + '<meta property="og:title" content="A"><meta property="og:image" content="/img/a.png">'
    + '<meta name="robots" content="noindex">'
    + '<link rel="stylesheet" href="/css/a-only.css"><link rel="stylesheet" href="/css/shared.css">'
    + '<style>.a{color:red}</style>'
    + '<link rel="stylesheet" href="/css/perch-layer.css"><link rel="stylesheet" href="/css/dl-utility-bar.css">';
  const HEAD_B = '<title>B</title><link rel="canonical" href="https://www.donovan.law/b">'
    + '<meta name="description" content="B describes B">'
    + '<meta property="og:title" content="B"><meta property="og:type" content="article">'
    + '<link rel="stylesheet" href="/css/shared.css"><link rel="stylesheet" href="/css/b-only.css">'
    + '<style>.b{color:blue}</style>'
    + '<link rel="stylesheet" href="/css/perch-layer.css"><link rel="stylesheet" href="/css/dl-utility-bar.css">';

  const live = (head) => new JSDOM(
    `<!doctype html><html><head>${head}</head><body><nav class="menubar"></nav>`
    + `<main id="${CONTAINER_ID}"></main><script src="/js/booking-widget.js"></script></body></html>`,
    { url: ORIGIN + '/a' },
  ).window;
  const incomingOf = (head) => new JSDOM(
    `<!doctype html><html><head>${head}<script src="/js/should-never-be-adopted.js"></script></head>`
    + `<body><main id="${CONTAINER_ID}"></main></body></html>`,
  ).window;

  const sheets = (d) => [...d.head.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'));
  const styles = (d) => [...d.head.querySelectorAll('style')].map((s) => s.textContent);
  const metaOf = (d, sel) => [...d.head.querySelectorAll(sel)].map((m) => m.getAttribute('content'));

  test('CLASS 1 — style blocks: B\'s block arrives and A\'s does not persist', () => {
    // The row that leaves 9 pages rendering unstyled. Both halves matter: the new
    // block has to arrive, AND the old one has to go — a reconcile that only
    // appended would leave A's rules cascading over B's markup.
    const w = live(HEAD_A);
    const inc = incomingOf(HEAD_B);
    assert.deepEqual(styles(w.document), ['.a{color:red}'], 'premise: A\'s block is live');

    syncHead(w.document, inc.document);
    assert.deepEqual(styles(w.document), ['.b{color:blue}']);
    w.close(); inc.close();
  });

  test('CLASS 2 — meta description: the incoming page wins', () => {
    const w = live(HEAD_A);
    const inc = incomingOf(HEAD_B);
    syncHead(w.document, inc.document);
    assert.deepEqual(metaOf(w.document, 'meta[name="description"]'), ['B describes B']);
    w.close(); inc.close();
  });

  test('CLASS 3 — og: every property is reconciled, including the ones B drops', () => {
    const w = live(HEAD_A);
    const inc = incomingOf(HEAD_B);
    syncHead(w.document, inc.document);
    const og = [...w.document.head.querySelectorAll('meta[property]')]
      .map((m) => `${m.getAttribute('property')}=${m.getAttribute('content')}`);
    assert.deepEqual(og, ['og:title=B', 'og:type=article'],
      'og:image was A\'s and B does not declare it — a stale image is a wrong share preview');
    w.close(); inc.close();
  });

  test('CLASS 4 — meta robots: added, updated and REMOVED', () => {
    // Three transitions, because the row is wrong in three different ways.
    // (a) indexable page → gated page: noindex must arrive.
    const w1 = live(HEAD_B.replace('<style>.b{color:blue}</style>', ''));
    const inc1 = incomingOf(HEAD_A);
    syncHead(w1.document, inc1.document);
    assert.deepEqual(metaOf(w1.document, 'meta[name="robots"]'), ['noindex']);

    // (b) gated → gated with a different directive: the value must update.
    const inc1b = incomingOf(HEAD_A.replace('content="noindex"', 'content="noindex,nofollow"'));
    syncHead(w1.document, inc1b.document);
    assert.deepEqual(metaOf(w1.document, 'meta[name="robots"]'), ['noindex,nofollow']);

    // (c) gated → ordinary page: noindex must NOT be stranded. This is the face of
    // the defect that hurts the firm — every ordinary page is in sitemap.xml, and
    // CLAUDE.md §3 rule 6 forbids noindex on one.
    const inc2 = incomingOf(HEAD_B);
    syncHead(w1.document, inc2.document);
    assert.deepEqual(metaOf(w1.document, 'meta[name="robots"]'), [],
      'the previous page\'s noindex must not survive onto an indexable page');
    w1.close(); inc1.close(); inc1b.close(); inc2.close();
  });

  test('CLASS 5 — stylesheet links: added, removed, and in the incoming ORDER', () => {
    const w = live(HEAD_A);
    const inc = incomingOf(HEAD_B);
    assert.deepEqual(sheets(w.document),
      ['/css/a-only.css', '/css/shared.css', '/css/perch-layer.css', '/css/dl-utility-bar.css']);

    syncHead(w.document, inc.document);
    assert.deepEqual(sheets(w.document),
      ['/css/shared.css', '/css/b-only.css', '/css/perch-layer.css', '/css/dl-utility-bar.css'],
      'a-only.css dropped, b-only.css added, and the shell sheets still LAST — '
      + 'hoisting them above the page CSS would flip the cascade the layer relies on');
    w.close(); inc.close();
  });

  test('the whole managed head equals a DIRECT load of B, in order', () => {
    // The five classes above, asserted as one property: after the swap, the head
    // rows this ticket manages are indistinguishable from those of a document
    // that was loaded directly.
    const w = live(HEAD_A);
    const inc = incomingOf(HEAD_B);
    const direct = live(HEAD_B);
    syncHead(w.document, inc.document);
    assert.deepEqual(headPrint(w.document.head), headPrint(direct.document.head));
    w.close(); inc.close(); direct.close();
  });

  test('title and canonical are still handled, and still first', () => {
    const w = live(HEAD_A);
    const inc = incomingOf(HEAD_B);
    const r = syncHead(w.document, inc.document);
    assert.equal(r.status, 'ok');
    assert.equal(w.document.title, 'B');
    assert.equal(w.document.querySelector('link[rel="canonical"]').getAttribute('href'), 'https://www.donovan.law/b');
    assert.equal(w.document.querySelectorAll('link[rel="canonical"]').length, 1);
    w.close(); inc.close();
  });

  test('SCRIPTS ARE UNTOUCHED — none adopted, none moved, none re-created', () => {
    // The hard do-not. Script adoption is swap-policy.js's allow-list, and
    // re-executing a tag per swap is the beacon/GA defect (§5.9). syncHead must
    // not be a second, unlisted adoption path — the incoming head here carries a
    // script that is on NEITHER list, and it must simply never be looked at.
    const w = live(HEAD_A);
    const inc = incomingOf(HEAD_B);
    const before = scriptPrint(w.document);
    const beforeNodes = [...w.document.querySelectorAll('script')];

    syncHead(w.document, inc.document);

    assert.deepEqual(scriptPrint(w.document), before, 'the script list must be identical');
    assert.equal(w.document.querySelector('script[src="/js/should-never-be-adopted.js"]'), null,
      'syncHead must not adopt a script from the incoming document');
    // Node IDENTITY, not just the src list: a re-created <script> element is a
    // re-executed script even when the list looks unchanged.
    assert.deepEqual([...w.document.querySelectorAll('script')], beforeNodes);
    w.close(); inc.close();
  });

  test('IDEMPOTENT — ten repeated swaps accumulate nothing and move nothing', () => {
    // Not a nicety: the router calls syncHead() at perch-swup-router.js:248 and
    // again inside reinit() at :252, so every single swap already runs it twice.
    const w = live(HEAD_A);
    const inc = incomingOf(HEAD_B);
    syncHead(w.document, inc.document);
    const settled = headPrint(w.document.head);
    const settledNodes = [...w.document.head.children];

    for (let i = 0; i < 10; i++) {
      const again = incomingOf(HEAD_B);
      const r = syncHead(w.document, again.document);
      assert.equal(r.detail.head.total, settled.length);
      assert.equal(r.detail.head.moved, 0, 'a settled head must not be re-ordered on a repeat swap');
      for (const cls of ['css', 'description', 'og', 'robots']) {
        assert.equal(r.detail.head[cls].added, 0, `${cls} added a node on a repeat swap`);
        assert.equal(r.detail.head[cls].removed, 0, `${cls} removed a node on a repeat swap`);
      }
      again.close();
    }
    assert.deepEqual(headPrint(w.document.head), settled, 'ten swaps must change nothing');
    // Node identity too: a re-created <link> makes the browser drop and re-apply
    // the sheet, which is a visible flash on every navigation.
    assert.deepEqual([...w.document.head.children], settledNodes);
    w.close(); inc.close();
  });

  test('a swap BACK to a prior page restores that page\'s head exactly', () => {
    const w = live(HEAD_A);
    const a0 = headPrint(w.document.head);
    for (let i = 0; i < 5; i++) {
      const toB = incomingOf(HEAD_B);
      syncHead(w.document, toB.document);
      const toA = incomingOf(HEAD_A);
      syncHead(w.document, toA.document);
      toB.close(); toA.close();
    }
    assert.deepEqual(headPrint(w.document.head), a0, 'five round trips must land back on A exactly');
    w.close();
  });

  test('a shell stylesheet is never dropped, even if the incoming document lacks it', () => {
    // The premise is that Swup's fetch streams through the same middleware, so the
    // incoming document always carries both shell sheets. This is what happens if
    // that premise ever fails: the layer and the utility bar keep their styling
    // rather than the visitor watching the orb go unstyled.
    const w = live(HEAD_A);
    const inc = incomingOf(HEAD_B
      .replace('<link rel="stylesheet" href="/css/perch-layer.css">', '')
      .replace('<link rel="stylesheet" href="/css/dl-utility-bar.css">', ''));
    syncHead(w.document, inc.document);
    const s = sheets(w.document);
    for (const shell of SHELL_STYLESHEETS) assert.ok(s.includes(shell), `${shell} was dropped`);
    assert.equal(s.filter((h) => h === '/css/perch-layer.css').length, 1, 'and not duplicated');
    w.close(); inc.close();
  });

  test('an incoming page declaring the same stylesheet twice does not duplicate it', () => {
    const w = live(HEAD_A);
    const inc = incomingOf(HEAD_B.replace(
      '<link rel="stylesheet" href="/css/b-only.css">',
      '<link rel="stylesheet" href="/css/b-only.css"><link rel="stylesheet" href="/css/b-only.css">',
    ));
    syncHead(w.document, inc.document);
    assert.equal(sheets(w.document).filter((h) => h === '/css/b-only.css').length, 1);
    w.close(); inc.close();
  });

  test('one dead element cannot take the head — or the recipe — down', () => {
    // Every DOM call in the reconcile is individually try/caught and attributed.
    // Here removal throws for one node; the other classes must still land and the
    // row must report `error` rather than throwing into the router's swap handler.
    const w = live(HEAD_A);
    const inc = incomingOf(HEAD_B);
    const victim = w.document.head.querySelector('link[href="/css/a-only.css"]');
    victim.remove = () => { throw new Error('boom'); };

    const r = syncHead(w.document, inc.document);
    assert.equal(r.status, 'error');
    assert.ok(r.detail.errors.some((e) => /boom/.test(e)));
    assert.equal(w.document.title, 'B', 'title still synced');
    assert.deepEqual(metaOf(w.document, 'meta[name="description"]'), ['B describes B'], 'description still synced');
    assert.deepEqual(styles(w.document), ['.b{color:blue}'], 'the style block still landed');
    w.close(); inc.close();
  });

  test('a document with no head, and a swap with no incoming document, are survivable', () => {
    const w = live(HEAD_A);
    assert.equal(syncHead(w.document, null).status, 'skipped');
    const bare = new JSDOM('<!doctype html><html><body></body></html>').window;
    assert.equal(syncHead(w.document, bare.document).status, 'ok');
    w.close(); bare.close();
  });
});

describe('JORDAN-198 §5.1 — executed against real shipped pages', () => {
  async function injectFull(relPath) {
    const html = read(join(SITE, relPath));
    const plan = await planFromHtml(html, HTMLRewriter);
    let rw = new HTMLRewriter();
    for (const [sel, h] of injectHandlers(plan)) rw = rw.on(sel, h);
    const headTags = routerTags(plan, { PERCH_ROUTER: 'on' }, ORIGIN + servedPath(relPath))
      + barStylesheetTag(plan);
    for (const [sel, h] of layerHandlers(plan, headTags)) rw = rw.on(sel, h);
    return rw.transform(new Response(html)).text();
  }

  /** Soft-navigate A → B for real, and hand back what to compare it against. */
  async function softNav(aRel, bRel) {
    const aHtml = await injectFull(aRel);
    const bHtml = await injectFull(bRel);
    const liveWin = new JSDOM(aHtml, { url: ORIGIN + servedPath(aRel) }).window;
    const before = headPrint(liveWin.document.head);
    const beforeScripts = scriptPrint(liveWin.document);
    const incWin = new JSDOM(bHtml).window;
    const directWin = new JSDOM(bHtml).window;
    const direct = headPrint(directWin.document.head);
    directWin.close();
    const r = syncHead(liveWin.document, incWin.document);
    return {
      r, before, beforeScripts, direct, liveWin, incWin, bHtml,
      after: headPrint(liveWin.document.head),
      afterScripts: scriptPrint(liveWin.document),
    };
  }

  // The pairs, each chosen for the row it proves.
  const PAIRS = [
    ['contact.html', '404.html', 'into a page whose ONLY styling is a head <style>'],
    ['blog-controversy-roadmap-2-exam.html', 'contact.html', 'out of a style-only page into a chrome page'],
    ['contact.html', 'tools.html', 'into the one page that ships TWO head <style> blocks'],
    ['contact.html', 'book.html', 'into the gated reveal page — noindex must arrive'],
    ['book.html', 'contact.html', 'off a noindex page — noindex must not be stranded'],
    ['book.html', 'disclaimer.html', 'noindex → an explicit index,follow page'],
  ];

  for (const [aRel, bRel, why] of PAIRS) {
    test(`${aRel} → ${bRel} — ${why}`, async () => {
      const s = await softNav(aRel, bRel);
      assert.deepEqual(s.after, s.direct,
        'the managed head after a soft navigation must equal a DIRECT load of the destination');
      assert.notDeepEqual(s.after, s.before, 'a swap that changed nothing would prove nothing');

      // A's page-authored styles are gone — the defect, stated directly.
      const aStyles = s.before.filter((x) => x.startsWith('style::'));
      assert.ok(aStyles.length > 0, `premise: ${aRel} authors a head <style>`);
      for (const st of aStyles) {
        if (s.direct.includes(st)) continue; // both pages ship it — not stale
        assert.equal(s.after.includes(st), false, `${aRel}'s style block persisted onto ${bRel}`);
      }

      assert.deepEqual(s.afterScripts, s.beforeScripts, 'no script was adopted, removed or re-created');

      // Ten repeats of the same swap accumulate nothing.
      for (let i = 0; i < 10; i++) {
        const again = new JSDOM(s.bHtml).window;
        syncHead(s.liveWin.document, again.document);
        again.close();
      }
      assert.deepEqual(headPrint(s.liveWin.document.head), s.direct, 'ten repeated swaps changed the head');
      s.liveWin.close(); s.incWin.close();
    });
  }

  test('robots survives onto a REAL gated page and is not stranded coming off it', async () => {
    // Task 4, on shipped documents rather than fixtures. /book is the gated reveal
    // page and ships `noindex`; /contact ships no robots meta at all and is in
    // sitemap.xml, so inheriting `noindex` would breach CLAUDE.md §3 rule 6.
    const robotsOf = (d) => [...d.head.querySelectorAll('meta[name="robots"]')]
      .map((m) => m.getAttribute('content'));

    const onto = await softNav('contact.html', 'book.html');
    assert.deepEqual(robotsOf(onto.liveWin.document), ['noindex'],
      'a soft navigation onto the gated page must leave it noindex');
    onto.liveWin.close(); onto.incWin.close();

    const off = await softNav('book.html', 'contact.html');
    assert.deepEqual(robotsOf(off.liveWin.document), [],
      'and navigating off it must not strand noindex on an indexable, sitemapped page');
    off.liveWin.close(); off.incWin.close();
  });

  test('the tier trees stay OUT of this — they are never soft-navigated at all', () => {
    // The tier-index documents (gold/platinum/diamond/reserve) also ship
    // `noindex, nofollow`, and they are the one gated family this reconcile does
    // NOT have to protect: every tier route is excluded from interception by
    // swap-policy.js (HTTP Basic auth at the edge), so they are only ever reached
    // by a full document load. Stated as a test so the claim is not folklore — if
    // a tier route ever becomes interceptable, its robots row becomes this
    // function's problem and this reds.
    for (const p of ['/gold', '/platinum/', '/diamond/tool-economics', '/reserve/index']) {
      const why = excludeReason(p);
      assert.ok(why, `${p} must not be interceptable`);
      assert.equal(why.id, 'tier-basic-auth');
    }
    const tierNoindex = pages.filter((p) => /^(gold|platinum|diamond|reserve)\//.test(p.relPath)
      && p.headRobots.some((c) => /noindex/i.test(c)));
    assert.ok(tierNoindex.length >= 4, 'premise: the tier tree ships noindex');
    for (const p of tierNoindex) assert.ok(excludeReason(p.path), `${p.path} leaked into the interceptable set`);
  });

  test('the recipe the router runs reports the head rows', async () => {
    // Behaviour, not spelling: run the real reinit() and read row 1.
    const aHtml = await injectFull('contact.html');
    const bHtml = await injectFull('404.html');
    const w = new JSDOM(aHtml, { url: ORIGIN + '/contact' }).window;
    const inc = new JSDOM(bHtml).window;

    const { rows, broken } = reinit(w.document, w, inc.document);
    const r1 = rows.find((x) => x.step === 1);
    assert.equal(r1.name, 'head sync');
    assert.equal(r1.status, 'ok');
    assert.equal(broken.includes('head sync'), false);
    assert.ok(r1.detail.head, 'row 1 must carry the head reconcile telemetry');
    assert.ok(r1.detail.head.css.added > 0, '404 ships a head <style> that had to be added');
    assert.ok(r1.detail.head.css.removed > 0, 'and contact ships stylesheet links 404 does not');
    assert.ok(r1.detail.head.css.kept >= SHELL_STYLESHEETS.length, 'the shell sheets are kept, not re-created');
    w.close(); inc.close();
  });
});
