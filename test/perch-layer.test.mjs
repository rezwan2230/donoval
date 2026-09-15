// JORDAN-PERCH-A21 — the persistent overlay layer, asserted across the page set.
//
// WHAT THIS FILE IS FOR. The layer holds the orb and the live Retell call, and
// the single property everything else depends on is that it is NEVER inside
// `main#perch-main`. If it ever is, a content swap unmounts a call that is in
// progress — and nothing about that failure is visible until a real caller is
// mid-sentence, because the orb renders identically either way.
//
// So the assertions below are structural rather than visual:
//
//   1. The reference is injected on exactly the pages that get a container, and
//      on no others. A container without a layer means a call that dies on the
//      first navigation; a layer without a container means a second orb on the
//      shell, which is the one page that already has one.
//   2. `placeLayer()` — the REAL function the browser runs, not a re-statement
//      of it — puts the layer outside the container and beside it, on every one
//      of the 30 body shapes A0.1 produces.
//   3. Nothing is injected inline, so no CSP directive has to change.
//
// The rewriter is the real one (test/helpers/html-rewriter.mjs) and the DOM
// assertions parse the OUTPUT with jsdom, so they judge the document a browser
// would build rather than the string the rewriter emitted.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { HTMLRewriter } from './helpers/html-rewriter.mjs';
import { onRequest } from '../donovan-legal-site/functions/_middleware.js';
import { CONTAINER_ID as SERVER_CONTAINER_ID } from '../donovan-legal-site/functions/_lib/perch-main.js';
import { LAYER_STYLESHEET, LAYER_MODULE } from '../donovan-legal-site/functions/_lib/perch-layer-inject.js';
import {
  CONTAINER_ID, LAYER_ID, LAYER_SELECTOR, placeLayer, inspect, isPersistent,
} from '../donovan-legal-site/js/perch/placement.js';

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'donovan-legal-site');

/**
 * Pages with no swap container, and therefore no layer. Same list A0.1 asserts,
 * restated here because the PAIRING is this ticket's invariant: a change to the
 * skip set has to fail in both suites, not just one.
 */
const EXPECTED_SKIPS = {
  // 'perch.html' stood here — the concierge shell. Removed with the voice
  // concierge: it authored the orb and iframed the real site, and both of those
  // are gone. Its absence from this list is the point, not an oversight.
  'nav-block.html': 'nav-only fragment: no swappable content at all',
};

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

// ── One streaming pass over the tree ─────────────────────────────────────────
//
// Every page is served, parsed ONCE, measured, and released before the next is
// read. The obvious shape — keep a JSDOM per page in an array, then re-parse
// inside each test — OOMs the CI runner at ~2 GB: 143 live jsdom windows plus a
// fresh one per page per assertion. It passes locally, which is exactly how that
// kind of test reaches CI. So the loop collects PLAIN DATA and the tests assert
// over that; peak memory is one document.

/** Everything that needs the served markup, measured while its DOM is alive. */
function measure(rel, source, served) {
  const dom = new JSDOM(served);
  try {
    const doc = dom.window.document;
    const container = doc.getElementById(CONTAINER_ID);

    const links = [...doc.querySelectorAll(`link[href="${LAYER_STYLESHEET}"]`)];
    const scripts = [...doc.querySelectorAll(`script[src="${LAYER_MODULE}"]`)];
    const injection = {
      linkCount: links.length,
      scriptCount: scripts.length,
      linkInHead: links.length === 1 ? doc.head.contains(links[0]) : false,
      scriptInHead: scripts.length === 1 ? doc.head.contains(scripts[0]) : false,
      isModule: scripts.length === 1 ? scripts[0].getAttribute('type') === 'module' : false,
      inlineText: scripts.length === 1 ? (scripts[0].textContent || '').trim() : '',
      hasNonce: scripts.length === 1 ? scripts[0].hasAttribute('nonce') : false,
      mentionedAnywhere: served.includes(LAYER_MODULE) || served.includes(LAYER_STYLESHEET),
    };

    const out = {
      rel,
      hasContainer: !!container,
      authorsLayer: source.includes(`id="${LAYER_ID}"`),
      authorsOrb: !!doc.getElementById('concierge'),
      injection,
      placement: null,
    };
    if (!container) return out;

    // ── the real placeLayer(), on this page's real shape ──
    const layer = doc.createElement('div');
    layer.id = LAYER_ID;
    const chrome = {};
    for (const id of ['concierge', 'caption', 'qual']) {
      const el = doc.createElement('div');
      el.id = id;
      layer.appendChild(el);
      chrome[id] = el;
    }
    const placed = placeLayer(doc, layer);
    const before = inspect(doc);
    const immediatelyAfter = doc.getElementById(CONTAINER_ID).nextElementSibling === layer;
    const strayInContainer = [...doc.getElementById(CONTAINER_ID)
      .querySelectorAll(`#${LAYER_ID},#concierge,#caption,#qual`)].map((e) => e.id);

    // ── the swap: replace the container's contents wholesale, as Swup does ──
    doc.getElementById(CONTAINER_ID).innerHTML = '<h1>swapped</h1><p>new content</p>';
    const after = inspect(doc);
    const identity = {
      sameLayerNode: doc.getElementById(LAYER_ID) === layer,
      sameOrbNode: doc.getElementById('concierge') === chrome.concierge,
      layerConnected: layer.isConnected,
    };

    // ── the harsher variant: replace the container ELEMENT itself ──
    const fresh = doc.createElement('main');
    fresh.id = CONTAINER_ID;
    fresh.innerHTML = '<h1>element-level swap</h1>';
    doc.getElementById(CONTAINER_ID).replaceWith(fresh);
    const afterReplace = inspect(doc);
    const survivesReplace = doc.getElementById(LAYER_ID) === layer
      && doc.getElementById('concierge') === chrome.concierge;

    out.placement = {
      placed, before, immediatelyAfter, strayInContainer,
      after, identity, afterReplace, survivesReplace,
    };
    return out;
  } finally {
    dom.window.close(); // release the window before the next page is parsed
  }
}

const RESULTS = [];
for (const file of walk(SITE)) {
  const rel = path.relative(SITE, file).replace(/\\/g, '/');
  const source = fs.readFileSync(file, 'utf8');
  const served = await serve(source, `https://www.donovan.law/${rel}`);
  RESULTS.push(measure(rel, source, served));
}

const WITH_CONTAINER = RESULTS.filter((r) => r.hasContainer);
const WITHOUT_CONTAINER = RESULTS.filter((r) => !r.hasContainer);

describe('perch persistent layer — constants and assets', () => {
  test('the browser and the Workers runtime name the same container', () => {
    // Two modules, two runtimes, one id. They cannot import each other, so the
    // only thing stopping a rename on one side is this assertion.
    assert.equal(CONTAINER_ID, SERVER_CONTAINER_ID);
  });

  test('the injected assets exist on disk', () => {
    for (const asset of [LAYER_STYLESHEET, LAYER_MODULE]) {
      const p = path.join(SITE, asset.replace(/^\//, ''));
      assert.ok(fs.existsSync(p), `${asset} is referenced by the injector but missing`);
    }
  });

  test('every module the layer imports resolves to a real file', () => {
    // The layer is loaded as a native ES module: an unresolvable specifier is a
    // silent 404 in the network panel and a dead orb, not a build error.
    const seen = new Set();
    const queue = [LAYER_MODULE];
    while (queue.length) {
      const spec = queue.pop();
      if (seen.has(spec)) continue;
      seen.add(spec);
      const p = path.join(SITE, spec.replace(/^\//, ''));
      assert.ok(fs.existsSync(p), `${spec} is imported but does not exist`);
      const src = fs.readFileSync(p, 'utf8');
      for (const m of src.matchAll(/(?:^|\n)\s*(?:import|export)[^;\n]*?from\s+['"](\/[^'"]+)['"]/g)) {
        queue.push(m[1]);
      }
    }
    assert.ok(seen.size >= 4, `expected the layer's module graph, walked only ${seen.size}`);
  });

  test('no page authors the layer itself — it is created by JS only', () => {
    // If a page shipped its own #perch-persistent, the mount would adopt a node
    // whose position it never chose, and the invariant would depend on markup.
    assert.deepEqual(RESULTS.filter((r) => r.authorsLayer).map((r) => r.rel), []);
  });
});

describe('perch persistent layer — injection pairing', () => {
  test('the page set is the one we think it is', () => {
    assert.ok(RESULTS.length >= 140, `expected the whole site, got ${RESULTS.length} pages`);
    console.log(`      page set: ${RESULTS.length} html files, `
      + `${WITH_CONTAINER.length} with a container, ${WITHOUT_CONTAINER.length} without`);
  });

  test('every page with a container references the layer exactly once, in <head>', () => {
    const bad = [];
    for (const r of WITH_CONTAINER) {
      const i = r.injection;
      if (i.linkCount !== 1 || i.scriptCount !== 1) bad.push(`${r.rel}: ${i.linkCount} link(s), ${i.scriptCount} script(s)`);
      // In <body> the module would run before the container it looks for, and the
      // stylesheet would repaint after first paint.
      else if (!i.linkInHead || !i.scriptInHead) bad.push(`${r.rel}: layer tags are not in <head>`);
      else if (!i.isModule) bad.push(`${r.rel}: layer script is not type="module"`);
    }
    assert.deepEqual(bad, []);
  });

  test('every page WITHOUT a container references the layer zero times', () => {
    assert.deepEqual(WITHOUT_CONTAINER.filter((r) => r.injection.mentionedAnywhere).map((r) => r.rel), []);
  });

  test('the skip set is exactly the documented one', () => {
    // Both directions: a page that quietly stops being skipped fails here, and so
    // does one that quietly starts.
    assert.deepEqual(WITHOUT_CONTAINER.map((r) => r.rel).sort(), Object.keys(EXPECTED_SKIPS).sort());
  });

  // REMOVED with the voice concierge: the shell authored the second orb; both it and the orb are gone.

  test('nothing is injected inline, so no CSP directive changes', () => {
    // An inline tag would need the per-request nonce; an external same-origin one
    // is already admitted by script-src/style-src 'self'. This is what keeps the
    // "no CSP change" claim true as the injector evolves.
    const bad = WITH_CONTAINER
      .filter((r) => r.injection.inlineText !== '' || r.injection.hasNonce)
      .map((r) => r.rel);
    assert.deepEqual(bad, []);
  });
});

describe('perch persistent layer — placement on every real page shape', () => {
  // These ran the REAL placeLayer() over the REAL served markup of every page.
  // jsdom has no layout engine, so isViewportAnchored() returns true and this
  // exercises placement 1 (the direct sibling) on all 30 body shapes. The
  // containing-block fallback is a rendered-browser property and is measured on
  // Preview instead — see verify/verify-a21.mjs.

  test('the layer is never a descendant of the swap container', () => {
    const bad = [];
    for (const r of WITH_CONTAINER) {
      const p = r.placement;
      if (!p.placed.ok || p.before.layerInsideContainer || p.before.orbInsideContainer || !p.before.ok) {
        bad.push(`${r.rel}: ${JSON.stringify({ placed: p.placed, state: p.before })}`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test('the layer is a DIRECT SIBLING of the swap container, immediately after it', () => {
    // Following rather than preceding: the orb paints above page content without
    // relying on z-index alone, and a screen reader meets the page's main
    // landmark before the concierge chrome.
    const bad = [];
    for (const r of WITH_CONTAINER) {
      const p = r.placement;
      if (!p.before.isDirectSibling) bad.push(`${r.rel}: layer in ${p.before.layerParent}, container in ${p.before.containerParent}`);
      else if (!p.immediatelyAfter) bad.push(`${r.rel}: not the container's next element sibling`);
    }
    assert.deepEqual(bad, []);
  });

  test('no orb, caption or qualifier node is a descendant of the swap container', () => {
    const bad = WITH_CONTAINER
      .filter((r) => r.placement.strayInContainer.length > 0)
      .map((r) => `${r.rel}: ${r.placement.strayInContainer.join(',')}`);
    assert.deepEqual(bad, []);
  });

  test('a content swap leaves the SAME layer and orb nodes in place', () => {
    // Node identity, not presence: a rebuilt orb looks identical to a surviving
    // one, and only identity distinguishes them.
    const bad = [];
    for (const r of WITH_CONTAINER) {
      const p = r.placement;
      if (!p.after.ok || !p.identity.sameLayerNode || !p.identity.sameOrbNode
        || !p.identity.layerConnected || !p.after.orbInsideLayer) {
        bad.push(`${r.rel}: ${JSON.stringify({ after: p.after, identity: p.identity })}`);
      }
    }
    assert.deepEqual(bad, []);
  });

  test('replacing the container ELEMENT also leaves the layer intact', () => {
    // Swup replaces the container's contents; other routers swap the element
    // itself. A sibling survives both — a descendant survives neither.
    const bad = [];
    for (const r of WITH_CONTAINER) {
      const p = r.placement;
      if (!p.survivesReplace || !p.afterReplace.ok || !p.afterReplace.isDirectSibling) {
        bad.push(`${r.rel}: ${JSON.stringify({ survivesReplace: p.survivesReplace, after: p.afterReplace })}`);
      }
    }
    assert.deepEqual(bad, []);
  });
});

// ── REMOVED: describe('perch persistent layer — the concierge lands inside it') ──
//
// It EXECUTED js/donovan-widget.js in a jsdom window — deliberately, rather than
// grepping it — to prove the launcher mounted INTO the A2.1 persistent layer rather
// than loose in the body. The widget is deleted with the voice concierge, so there
// is no concierge to land anywhere.
//
// The layer itself is NOT gone and is still covered: the describe below holds its
// router boundary, and the no-voice qualifier card — which is what the layer hosts
// now — is driven end to end by test/perch-novoice-frontdoor.test.mjs.

describe('perch persistent layer — the router boundary', () => {
  test('isPersistent() identifies the layer subtree and nothing else', () => {
    const doc = new JSDOM(`<!doctype html><body>
      <main id="${CONTAINER_ID}"><p id="content">page</p></main>
      <div id="${LAYER_ID}"><div id="concierge"><span id="deep"></span></div></div>
    </body>`).window.document;

    assert.equal(isPersistent(doc.getElementById(LAYER_ID)), true);
    assert.equal(isPersistent(doc.getElementById('concierge')), true);
    assert.equal(isPersistent(doc.getElementById('deep')), true, 'must match at any depth');
    assert.equal(isPersistent(doc.getElementById('content')), false);
    assert.equal(isPersistent(doc.getElementById(CONTAINER_ID)), false);
    assert.equal(isPersistent(null), false);
  });

  test('placeLayer() reports rather than throws when there is no container', () => {
    // The shell and the nav fragment take this path. A throw here would break a
    // page that is working exactly as designed.
    const doc = new JSDOM('<!doctype html><body><p>no container</p></body>').window.document;
    const layer = doc.createElement('div');
    layer.id = LAYER_ID;
    const placed = placeLayer(doc, layer);
    assert.equal(placed.ok, false);
    assert.match(placed.reason, /no swap container/);
    assert.equal(doc.querySelector(LAYER_SELECTOR), null, 'nothing should be inserted');
  });

  test('inspect() reports the failure mode, not just a boolean', () => {
    const doc = new JSDOM(`<!doctype html><body>
      <main id="${CONTAINER_ID}"><div id="${LAYER_ID}"><div id="concierge"></div></div></main>
    </body>`).window.document;
    const state = inspect(doc);
    assert.equal(state.ok, false);
    assert.equal(state.layerInsideContainer, true, 'the layer is inside — that is the whole point of the check');
    assert.equal(state.orbInsideContainer, true);
  });
});
