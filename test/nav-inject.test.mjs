// ── SHELDON-PAUL-NAV (#227) — the served navigation, and what it must not move ─
//
// `functions/_lib/nav-inject.js` replaces the `nav.menubar` subtree of 113 pages
// as they are served. That is the largest single piece of markup this middleware
// has ever rewritten, and it sits INSIDE the div whose end tag is the swap
// container's opening ordinal — so almost everything that can go wrong here goes
// wrong silently, on a page that still renders perfectly.
//
// This file is the four ways it can go wrong, each measured rather than argued:
//
//   §1 THE DIV-ORDINAL PLAN. The Task 1 precondition, re-run in CI over the real
//      lol-html build, with the control that proves the harness can see a shift.
//      Without §1 every other assertion here could be passing on a page whose
//      `<main>` is around the wrong half of the document.
//
//   §2 THE CHROME THE NAV SITS NEXT TO. The container, the persistent layer, the
//      orb and the "Book a Consultation" bar, on a page from each nav variant —
//      including that none of them has fallen INSIDE the container, which is the
//      failure mode that renders correctly and kills the call on first navigation.
//
//   §3 THE MENU AFTER A SOFT NAVIGATION. Driven for real: jQuery and the actual
//      `js/main.js` are executed in a jsdom window over the actual served page,
//      the hamburger is clicked, the router's swap is performed and
//      `dl:content-swapped` dispatched, and the hamburger is clicked again.
//      `js/main.js` binds `.hamburger` DIRECTLY, not by delegation, so a nav that
//      ended up inside the swapped region passes every structural check and stops
//      opening on the second click.
//
//   §4 THE ASSISTANT'S NAVIGATION TARGETS. Every `goto_*` in
//      `functions/fn/do_page_action.js` resolved against the filesystem. Paula
//      navigating a visitor to a 404 is not something the nav change causes, but
//      it is something a nav change is expected to have checked.
//
// And §5, which is not in the order but is the coverage `test/perch-main.test.mjs`
// gave up when its selector differential moved onto the served nav: that the nav
// rewrite's effect on structure-sensitive CSS stops at the nav's own boundary.

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
import { placeLayer, inspect, LAYER_ID } from '../donovan-legal-site/js/perch/placement.js';
import {
  SITE_NAV_SELECTOR, BOUND_IDS, TOP_LEVEL, navIds, idPrefix,
} from '../donovan-legal-site/functions/_lib/nav-inject.js';
import { PROBES, STANDINS, probe as planProbe } from '../scripts/nav/plan-invariance.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const SITE = path.join(ROOT, 'donovan-legal-site');
const CONTAINER_SELECTOR = `main#${CONTAINER_ID}`;

/** One real page per nav variant, plus the directory-down page and a fragment. */
const VARIANTS = [
  { rel: 'tax-controversy.html', variant: 'A — current chrome (92 pages)' },
  { rel: 'business-formation.html', variant: 'B — old THE FIRM / THE PRACTICE chrome (18 pages)' },
  { rel: 'tool-deal-builder.html', variant: 'C — tool chrome, no mobile overlay of its own (2 pages)' },
  { rel: 'members/about-membership.html', variant: 'A, one directory down' },
];

async function serve(rel) {
  const html = fs.readFileSync(path.join(SITE, rel), 'utf8');
  const saved = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = HTMLRewriter;
  try {
    const res = await onRequest({
      request: new Request(`https://www.donovan.law/${rel}`, { headers: { 'sec-fetch-dest': 'document' } }),
      env: {},
      next: async () => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    });
    return await res.text();
  } finally {
    globalThis.HTMLRewriter = saved;
  }
}

const SERVED = new Map();
for (const { rel } of VARIANTS) SERVED.set(rel, await serve(rel));

// ── §1 The div-ordinal plan ──────────────────────────────────────────────────

describe('SHELDON-PAUL-NAV §1 — the swap container\'s plan does not move', () => {
  // Driven from `scripts/nav/plan-invariance.mjs` rather than re-implemented, so
  // the evidence quoted in the pull request and the gate in CI are the same code.
  // The stand-ins are the extremes: one nav that adds thirty divs and one that
  // adds none. A rewriter that re-fed injected content fails the first; one that
  // suppressed handlers for replaced content fails the second.
  for (const [label, replacement] of Object.entries(STANDINS)) {
    for (const { file, variant } of PROBES) {
      test(`${file} — ${variant} — stand-in ${label}`, async () => {
        const r = await planProbe(file, replacement);
        assert.equal(r.planStable, true,
          'the plan the middleware computes must not depend on the nav rewrite');
        assert.deepEqual(r.landingWithNav, r.landingPlain,
          '<main id="perch-main"> landed on a different element once the nav was rewritten');
        assert.equal(r.outsideSame, true,
          'the served bytes OUTSIDE the nav subtree changed when only the nav was rewritten');
      });
    }
  }

  test('control: the harness detects a one-ordinal shift, and the nav really is rewritten', async () => {
    // Without this, every test above could be comparing two copies of an
    // unrewritten page — [[feedback_fixture_must_reproduce_the_defect]].
    const r = await planProbe('tax-controversy.html', STANDINS['div-free (0 divs)']);
    assert.equal(r.navReplaced, true, 'the nav was never actually replaced, so §1 proves nothing');
    // Reading A, reported not gated: re-planning over a source whose nav has
    // ALREADY been substituted DOES move the ordinals, by exactly the difference
    // in div count. That it moves is what makes reading B's stability a fact
    // about where this injector runs rather than an accident.
    assert.equal(r.substitutedSame, false,
      'control: re-planning over a nav-substituted SOURCE must move the plan — if it does not, '
      + 'the ordinals are not sensitive to the nav at all and §1 is vacuous');
  });
});

// ── §2 The chrome around the nav ─────────────────────────────────────────────

describe('SHELDON-PAUL-NAV §2 — container, layer, orb and booking bar survive', () => {
  for (const { rel, variant } of VARIANTS) {
    test(`${rel} (${variant})`, () => {
      const doc = new JSDOM(SERVED.get(rel)).window.document;

      const container = doc.querySelector(CONTAINER_SELECTOR);
      assert.ok(container, 'no swap container');
      assert.ok(container.querySelectorAll('*').length > 10,
        'the container is present but nearly empty — the open and close tags landed at different depths');

      const nav = doc.querySelector(SITE_NAV_SELECTOR);
      assert.ok(nav, 'no site nav');
      assert.equal(container.contains(nav), false,
        'the nav is INSIDE the swap container — it will be destroyed by the first soft navigation');

      // The layer, by its two injected tags, in <head> and outside the container.
      for (const sel of [`link[href="${LAYER_STYLESHEET}"]`, `script[src="${LAYER_MODULE}"]`]) {
        const el = doc.querySelector(sel);
        assert.ok(el, `the persistent layer reference ${sel} is missing`);
        assert.equal(container.contains(el), false, `${sel} ended up inside the swap container`);
      }

      // The bar. Asserted by its rendered call to action, not by its class alone:
      // an empty `.dl-ubar` is exactly what a broken bar looks like.
      const bar = doc.querySelector('.dl-ubar');
      assert.ok(bar, 'the Book a Consultation bar is missing');
      assert.match(bar.textContent, /Book a Free Consultation/);
      assert.equal(container.contains(bar), false, 'the booking bar ended up inside the swap container');
    });
  }

  // The orb itself is mounted by js/perch-layer.js at runtime, so it is placed
  // with the REAL placement module over the REAL served markup rather than looked
  // for in the HTML — the same instrument test/perch-layer.test.mjs uses.
  for (const { rel, variant } of VARIANTS) {
    test(`${rel} (${variant}) — the layer and orb mount outside the container`, () => {
      const dom = new JSDOM(SERVED.get(rel), { url: `https://www.donovan.law/${rel}` });
      const doc = dom.window.document;
      // The layer the browser builds, built the same way test/perch-layer.test.mjs
      // builds it: `placeLayer` places a layer, it does not author one.
      const layer = doc.createElement('div');
      layer.id = LAYER_ID;
      for (const id of ['concierge', 'caption', 'qual']) {
        const el = doc.createElement('div');
        el.id = id;
        layer.appendChild(el);
      }
      assert.equal(placeLayer(doc, layer).ok, true, 'placeLayer refused this page');
      const state = inspect(doc);
      assert.equal(state.ok, true, `the layer did not mount: ${JSON.stringify(state)}`);
      assert.equal(state.layerInsideContainer, false, 'the layer mounted inside the swap container');
      assert.equal(state.orbInsideContainer, false, 'the orb mounted inside the swap container');
      assert.equal(state.orbInsideLayer, true, 'the orb is not inside the layer');
    });
  }
});

// ── §3 The menu after a soft navigation ──────────────────────────────────────

const JQUERY = fs.readFileSync(path.join(SITE, 'js/vendor/jquery-3.3.1.min.js'), 'utf8');
const MAIN_JS = fs.readFileSync(path.join(SITE, 'js/main.js'), 'utf8');
const BOOTSTRAP_JS = fs.readFileSync(path.join(SITE, 'js/vendor/bootstrap.min.js'), 'utf8');

/**
 * A jsdom window running the page's real jQuery and real `js/main.js`.
 *
 * Executed rather than inspected on purpose. Every structural assertion in §2
 * would still pass on a nav that `js/main.js` cannot drive — the classes would
 * all be present and none of them bound — and the failure is silent by
 * construction: jQuery selecting nothing throws nothing.
 * [[feedback_assert_behavior_not_source_spelling]]
 */
async function boot(rel, mutate, { bootstrap = false } = {}) {
  const dom = new JSDOM(SERVED.get(rel), {
    url: `https://www.donovan.law/${rel}`,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const { window } = dom;
  // WAIT FOR `load` BEFORE EVALUATING ANYTHING. jsdom parses asynchronously, so
  // `document.readyState` is still 'loading' when the constructor returns — and
  // `js/main.js` puts `.hamburger` and `.btn-close.menu` inside
  // `$(document).ready`. Evaluating jQuery while the document is still loading
  // defers those bindings to a DOMContentLoaded this test would have to race.
  // Waiting first makes jQuery take the readyState === 'complete' path, which
  // fires on the next tick and is drained deterministically below.
  if (window.document.readyState !== 'complete') {
    await new Promise((resolve) => window.addEventListener('load', resolve, { once: true }));
  }
  // The mutation, if any, is applied BEFORE the scripts run — a defect that moves
  // markup does so before the page's own JS binds to it.
  if (mutate) mutate(window.document);
  window.eval(JQUERY);
  // Bootstrap 4.3.1, the build every one of the 113 nav-bearing pages loads. Only
  // its collapse plugin is exercised, which is also all the site uses it for —
  // the pages ship no Popper, so its dropdown plugin has never been able to run
  // here. Evaluated BEFORE main.js so the data-api delegate is bound first, as it
  // is in the pages' own script order.
  if (bootstrap) window.eval(BOOTSTRAP_JS);
  window.eval(MAIN_JS);
  // Wait on jQuery's OWN ready queue, not on a timer. jQuery schedules ready
  // through `window.setTimeout`, and jsdom's window timers are not the same queue
  // as Node's — a bare `setTimeout(0)` here returned before `.hamburger` had been
  // bound, which reads exactly like the defect this suite is looking for.
  // Registering a callback behind main.js's own means "main.js's ready handlers
  // have run" is what is being waited for, rather than a duration.
  await new Promise((resolve) => window.$(resolve));
  return { window, doc: window.document };
}

function click(window, el) {
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

describe('SHELDON-PAUL-NAV §3 — the menu still works after a soft navigation', () => {
  for (const { rel, variant } of VARIANTS) {
    test(`${rel} (${variant})`, async () => {
      const { window, doc } = await boot(rel);

      const overlay = doc.querySelector('.nav-mobile-overlay');
      const hamburger = doc.querySelector('.hamburger');
      assert.ok(overlay && hamburger, 'the served page is missing the mobile menu');

      // Baseline: it works at all. If this fails everything below is meaningless.
      click(window, hamburger);
      assert.ok(overlay.classList.contains('open'),
        'the hamburger did not open the menu even before a navigation — js/main.js never bound to it');
      click(window, doc.querySelector('.btn-close.menu'));
      assert.equal(overlay.classList.contains('open'), false, 'the close button did not close the menu');

      // The soft navigation: swup replaces the CONTENTS of the container, then
      // js/perch-router dispatches dl:content-swapped. Both halves, in that order.
      const container = doc.querySelector(CONTAINER_SELECTOR);
      assert.ok(container, 'no swap container to swap');
      container.innerHTML = '<div class="swapped"><h1>Another page</h1></div>';
      doc.dispatchEvent(new window.Event('dl:content-swapped', { bubbles: true }));

      // Node identity, not presence. A nav rebuilt by the swap would look
      // identical and be unbound — the same distinction test/perch-layer.test.mjs
      // draws for the orb.
      assert.equal(doc.querySelector('.nav-mobile-overlay'), overlay,
        'the mobile overlay is a DIFFERENT node after the swap, so its handlers are gone');
      assert.equal(doc.querySelector('.hamburger'), hamburger,
        'the hamburger is a DIFFERENT node after the swap, so its click handler is gone');

      click(window, hamburger);
      assert.ok(overlay.classList.contains('open'),
        'the hamburger stopped opening the menu after a soft navigation');

      // Following a link inside the overlay closes it — delegated in main.js, so
      // this is the half that must keep working for markup rendered after a swap.
      const link = overlay.querySelector('a[href]');
      assert.ok(link, 'the mobile overlay has no links');
      // Cancelled in the CAPTURE phase so jsdom does not try to follow it (it has
      // no navigation), while main.js's own handler — which is delegated on
      // `document` and therefore runs in the bubble phase — still fires. Cancelling
      // in the bubble phase would have raced the handler under test.
      window.document.addEventListener('click', (e) => e.preventDefault(), true);
      click(window, link);
      assert.equal(overlay.classList.contains('open'), false,
        'following a nav link left the full-screen overlay sitting on top of the new page');
    });
  }

  test('control: a nav moved INSIDE the swap container fails this test', async () => {
    // The defect §3 exists to catch, reproduced by hand. Without it this suite
    // could be passing because every page happens to render, rather than because
    // the nav is genuinely outside the swapped region.
    const { rel } = VARIANTS[0];
    const { window, doc } = await boot(rel, (d) => {
      // the "nav pulled inside the container" failure, made by hand
      d.querySelector(CONTAINER_SELECTOR).prepend(d.querySelector(SITE_NAV_SELECTOR));
    });
    const container = doc.querySelector(CONTAINER_SELECTOR);

    const overlay = doc.querySelector('.nav-mobile-overlay');
    click(window, doc.querySelector('.hamburger'));
    assert.ok(overlay.classList.contains('open'), 'control setup: it must work before the swap');

    container.innerHTML = '<div class="swapped"></div>';
    doc.dispatchEvent(new window.Event('dl:content-swapped', { bubbles: true }));
    assert.equal(doc.querySelector('.hamburger'), null,
      'control: a nav inside the container must be destroyed by the swap — if it survives, '
      + 'this control is not reproducing the defect and §3 proves nothing');
  });
});

// ── §4 The assistant's navigation targets ────────────────────────────────────

// REMOVED with the voice concierge: ACTION_MAP was Paula's navigation table; with no agent there are no goto targets to resolve.

// ── §5 The nav rewrite does not leak past the nav ────────────────────────────

describe('SHELDON-PAUL-NAV §5 — structure-sensitive CSS changes only inside the nav', () => {
  // test/perch-main.test.mjs compares its selector differential against a before
  // side that already has the served nav applied, which is right for what that
  // file asserts and leaves this question unasked. It is asked here, against the
  // RAW source: every element whose match-set membership changed must be inside
  // `nav.menubar`. `.box > .border-grey > .container` — the child combinator that
  // creates the nav's stacking context — is required to be in the corpus, so a
  // regex that stopped harvesting selectors reds instead of passing empty.
  const STRUCTURAL = /[>+~]|:(?:first|last|only|nth)-(?:child|of-type)|:empty|:root/;

  const selectors = new Set();
  for (const f of fs.readdirSync(path.join(SITE, 'css')).filter((n) => n.endsWith('.css'))) {
    const css = fs.readFileSync(path.join(SITE, 'css', f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    for (const m of css.matchAll(/([^{}]+)\{/g)) {
      for (const sel of m[1].split(',')) {
        const s = sel.trim().replace(/::[a-z-]+(\(.*?\))?/g, '').trim();
        if (s && !s.startsWith('@') && STRUCTURAL.test(s)) selectors.add(s);
      }
    }
  }

  test('the selector corpus is real', () => {
    assert.ok(selectors.size > 200, `expected a real selector corpus, got ${selectors.size}`);
    assert.ok(selectors.has('.box > .border-grey > .container'),
      'the corpus is missing the load-bearing selector the nav\'s stacking context depends on');
  });

  for (const { rel, variant } of VARIANTS) {
    test(`${rel} (${variant})`, () => {
      const source = new JSDOM(fs.readFileSync(path.join(SITE, rel), 'utf8')).window.document;
      const served = new JSDOM(SERVED.get(rel)).window.document;
      const servedNav = served.querySelector(SITE_NAV_SELECTOR);
      const sourceNav = source.querySelector(SITE_NAV_SELECTOR);
      const container = served.querySelector(CONTAINER_SELECTOR);
      const bar = served.querySelector('.dl-ubar');
      const sig = (el) => `${el.tagName.toLowerCase()}#${el.id || ''}.${(el.getAttribute('class') || '').trim()}`;

      const probeDoc = new JSDOM('<html><body></body></html>').window.document;
      const leaked = [];
      for (const sel of selectors) {
        try { probeDoc.querySelectorAll(sel); } catch { continue; }
        // Everything this ticket and its predecessors legitimately add or remove
        // is subtracted BY NODE, not by relaxing the selector: the nav subtree on
        // both sides, the injected container, the injected bar.
        const outside = (root, navEl) => [...root.querySelectorAll(sel)]
          .filter((el) => !(navEl && (el === navEl || navEl.contains(el))))
          .filter((el) => el !== container && !(bar && (el === bar || bar.contains(el))))
          .map(sig).join('\n');
        const b = outside(source, sourceNav);
        const a = outside(served, servedNav);
        if (a !== b) leaked.push(sel);
      }
      assert.deepEqual(leaked, [],
        'these selectors changed what they match OUTSIDE the nav — the nav rewrite has moved '
        + 'markup a page stylesheet keys off');
    });
  }
});

// ── §6 The nested TAX menu (SHELDON-NAV-R2) ──────────────────────────────────
//
// Paul looked at the served menu and asked for two things: TAX opens on FOUR
// entries, and the fifteen controversy pages sit behind CONTROVERSY with the three
// state pages in the order Florida · Massachusetts · Residency & Domicile.
//
// Neither can fail visibly. A flattened menu renders perfectly and is merely
// wrong; a misordered state list renders perfectly and is merely wrong. So the
// shape is asserted structurally on a page from every nav variant (§6a), the
// toggles are DRIVEN with the real bootstrap build the pages load rather than
// read off the markup (§6b), and both are given a control that reproduces the
// defect and requires the check to bite (§6c).

const TAX_ITEM = TOP_LEVEL.find((i) => i.key === 'tax');
const CONTROVERSY_ITEM = TAX_ITEM.items.find((i) => i.key === 'controversy');
const rendered = (label) => label.replace(/&amp;/g, '&');
const TAX_FIRST_LEVEL = TAX_ITEM.items.map((i) => rendered(i.label));
const CONTROVERSY_ITEMS = CONTROVERSY_ITEM.items.map((i) => rendered(i.label));

/** Literal, not sliced from the table: a check derived entirely from the module
 *  would pass on a module whose states had been reordered, which is the defect. */
const STATE_ORDER = ['Florida Sales & Use Tax', 'Massachusetts Tax Appeals', 'Residency & Domicile'];

/**
 * Everything wrong with the TAX menu of one served document, as a list.
 *
 * A LIST rather than assertions, so §6c can hand it a deliberately broken
 * document and require it to be non-empty — a checker that returned nothing for
 * everything would pass §6a on every page and mean nothing.
 * [[feedback_fixture_must_reproduce_the_defect]]
 *
 * Both renderings are asked the same questions from one place. The desktop panel
 * and the mobile accordion come out of different functions in nav-inject.js, and
 * a group that nests in one and not the other is a menu that is correct on a
 * laptop and nineteen items long on a phone.
 */
function taxMenuProblems(doc) {
  const problems = [];
  const nav = doc.querySelector(SITE_NAV_SELECTOR);
  if (!nav) return ['no site nav at all'];

  const taxParent = [...nav.querySelectorAll('#menu-desktop > li > a.nav-link')]
    .find((a) => a.textContent.trim() === 'TAX');
  const mobileTax = [...nav.querySelectorAll('.nav-mobile-list > .mobile-parent')]
    .find((d) => d.querySelector('.mm-parent-label')?.textContent.trim() === 'TAX');

  for (const [where, panel, groupSel, labelSel] of [
    ['desktop', taxParent?.parentElement.querySelector('.dropdown-menu'), ':scope > .dl-subnav', '.dl-subnav-parent'],
    ['mobile', mobileTax?.querySelector('.collapse'), ':scope > .dl-subnav-mobile', '.mm-parent-label'],
  ]) {
    if (!panel) { problems.push(`${where}: no TAX panel`); continue; }

    const group = panel.querySelector(groupSel);
    const first = [...panel.children]
      .map((el) => (el === group ? el.querySelector(labelSel)?.textContent.trim() : el.textContent.trim()));
    if (first.join(' | ') !== TAX_FIRST_LEVEL.join(' | ')) {
      problems.push(`${where}: first level is ${first.join(' · ') || '(nothing)'}, expected ${TAX_FIRST_LEVEL.join(' · ')}`);
    }
    if (!group) { problems.push(`${where}: no nested CONTROVERSY group`); continue; }

    const parentLink = group.querySelector(labelSel);
    if (parentLink?.getAttribute('href') !== '/tax-controversy.html') {
      problems.push(`${where}: the CONTROVERSY group does not link to /tax-controversy.html`);
    }

    const sub = group.querySelector('.collapse');
    const nested = sub ? [...sub.querySelectorAll('a[href]')].map((a) => a.textContent.trim()) : [];
    if (nested.join(' | ') !== CONTROVERSY_ITEMS.join(' | ')) {
      problems.push(`${where}: the CONTROVERSY submenu is ${nested.length} items — ${nested.join(' · ') || '(nothing)'}`);
    }
    const states = nested.filter((l) => STATE_ORDER.includes(l));
    if (states.join(' | ') !== STATE_ORDER.join(' | ')) {
      problems.push(`${where}: the state pages are ${states.join(' · ') || '(none)'}, expected ${STATE_ORDER.join(' · ')}`);
    }

    const toggle = group.querySelector('[data-toggle="collapse"]');
    if (!toggle) { problems.push(`${where}: the CONTROVERSY group has no toggle`); continue; }
    if (toggle.tagName !== 'BUTTON') problems.push(`${where}: the CONTROVERSY toggle is a <${toggle.tagName.toLowerCase()}>, not a button`);
    if (!sub?.id || toggle.getAttribute('aria-controls') !== sub.id || toggle.getAttribute('data-target') !== `#${sub.id}`) {
      problems.push(`${where}: the CONTROVERSY toggle does not control its own submenu`);
    }
    if (toggle.getAttribute('aria-expanded') !== 'false') {
      problems.push(`${where}: the CONTROVERSY toggle is served aria-expanded="${toggle.getAttribute('aria-expanded')}"`);
    }
  }
  return problems;
}

describe('SHELDON-NAV-R2 §6a — TAX opens on four entries with CONTROVERSY nested', () => {
  for (const { rel, variant } of VARIANTS) {
    test(`${rel} (${variant})`, () => {
      const doc = new JSDOM(SERVED.get(rel)).window.document;
      assert.deepEqual(taxMenuProblems(doc), []);
    });
  }

  // The corpus is not vacuous: the counts are stated here so a table that lost
  // its nesting cannot make every list above trivially equal.
  test('the IA really is four entries and fifteen nested pages', () => {
    assert.equal(TAX_FIRST_LEVEL.length, 4);
    assert.equal(CONTROVERSY_ITEMS.length, 15);
    assert.deepEqual(CONTROVERSY_ITEMS.slice(-3), STATE_ORDER);
  });

  test('every id the nested group emits is unique on every variant', () => {
    // The whole reason the ids are generated rather than written down. Asked of
    // the DOCUMENT, because bootstrap's `data-target="#x"` opens the first `#x`
    // anywhere on the page — a generated id that lands on a page's own accordion
    // toggles the article and leaves the menu shut, silently.
    for (const { rel } of VARIANTS) {
      const doc = new JSDOM(SERVED.get(rel)).window.document;
      const ids = new Set([...new JSDOM(fs.readFileSync(path.join(SITE, rel), 'utf8'))
        .window.document.querySelectorAll('[id]')].map((el) => el.id).filter(Boolean));
      const emitted = navIds(idPrefix(ids));
      const inNav = [...doc.querySelector(SITE_NAV_SELECTOR).querySelectorAll('[id]')].map((el) => el.id);
      // Every nested id the markup actually emitted resolves to exactly one node.
      const nested = inNav.filter((id) => id.includes('-tax-controversy'));
      assert.ok(nested.length >= 6, `${rel}: expected the six second-level ids, found ${nested.length}`);
      for (const id of nested) {
        assert.ok(emitted.includes(id),
          `${rel}: the markup emits #${id} but idPrefix's scan does not know about it, so nothing kept it unique`);
        assert.equal(doc.querySelectorAll(`[id="${id}"]`).length, 1, `${rel}: #${id} is not unique on the page`);
      }
    }
  });
});

// ── §6b The toggles, driven ──────────────────────────────────────────────────

describe('SHELDON-NAV-R2 §6b — both nested toggles open, close and announce', () => {
  for (const [where, groupSel] of [['desktop', '.dl-subnav'], ['mobile', '.dl-subnav-mobile']]) {
    test(`${where}: aria-expanded flips, the panel opens, and focus stays put`, async () => {
      const { rel } = VARIANTS[0];
      const { window, doc } = await boot(rel, null, { bootstrap: true });
      const group = doc.querySelector(groupSel);
      const toggle = group.querySelector('[data-toggle="collapse"]');
      const panel = group.querySelector('.collapse');

      // Baseline. `.show` is bootstrap's own "this panel is open" class; without
      // it `.collapse:not(.show)` in bootstrap.min.css keeps the panel hidden.
      assert.equal(toggle.getAttribute('aria-expanded'), 'false');
      assert.equal(panel.classList.contains('show'), false, 'the submenu is open before anything was clicked');

      // Focus first, then click: this is the keyboard path, and it is the one that
      // can regress invisibly. A toggle that opens the panel but throws focus back
      // to the document leaves a keyboard user nowhere.
      toggle.focus();
      assert.equal(doc.activeElement, toggle, 'the toggle cannot take focus at all — it is not keyboard reachable');
      click(window, toggle);
      assert.equal(toggle.getAttribute('aria-expanded'), 'true',
        'the toggle did not announce the open panel — bootstrap never bound to it');
      assert.equal(doc.activeElement, toggle, 'opening the submenu moved focus off the control that opened it');

      // The `show` class lands after the transition, which bootstrap emulates on a
      // timer when the computed duration is 0 — as it is under jsdom. Waited for
      // rather than assumed, on the window's OWN queue.
      await new Promise((resolve) => window.setTimeout(resolve, 0));
      assert.equal(panel.classList.contains('show'), true,
        'aria-expanded says open but the panel never got bootstrap\'s show class');

      click(window, toggle);
      assert.equal(toggle.getAttribute('aria-expanded'), 'false', 'the toggle does not close again');
      assert.equal(doc.activeElement, toggle, 'closing the submenu moved focus');
    });
  }

  test('the first-level TAX toggle still works, and the two do not drive each other', async () => {
    // The nested collapse is INSIDE the first-level one. Bootstrap couples nested
    // collapses only through `data-parent`, which neither of these carries — but
    // "neither carries it" is a claim about markup and this is the measurement.
    const { rel } = VARIANTS[0];
    const { window, doc } = await boot(rel, null, { bootstrap: true });
    const outer = doc.querySelector('#btn-tp');
    const outerPanel = doc.querySelector(outer.getAttribute('data-target'));
    const inner = doc.querySelector('.dl-subnav-mobile [data-toggle="collapse"]');
    const innerPanel = doc.querySelector(inner.getAttribute('data-target'));

    click(window, outer);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(outer.getAttribute('aria-expanded'), 'true', 'the TAX group stopped opening');
    assert.equal(inner.getAttribute('aria-expanded'), 'false',
      'opening TAX also expanded CONTROVERSY — the two collapses are coupled');
    assert.equal(innerPanel.classList.contains('show'), false);

    click(window, inner);
    await new Promise((resolve) => window.setTimeout(resolve, 0));
    assert.equal(inner.getAttribute('aria-expanded'), 'true');
    assert.equal(outer.getAttribute('aria-expanded'), 'true',
      'opening CONTROVERSY collapsed the TAX group it lives inside');
    assert.equal(outerPanel.classList.contains('show'), true);
  });

  test('control: the drive is real — an unbound toggle fails §6b', async () => {
    // Without bootstrap evaluated, nothing maintains aria-expanded. If this passed
    // it would mean §6b is reading a static attribute rather than a behaviour.
    const { rel } = VARIANTS[0];
    const { window, doc } = await boot(rel);
    const toggle = doc.querySelector('.dl-subnav [data-toggle="collapse"]');
    click(window, toggle);
    assert.equal(toggle.getAttribute('aria-expanded'), 'false',
      'control: with no collapse plugin loaded, aria-expanded must NOT change — if it does, '
      + 'something other than bootstrap is writing it and §6b is not measuring what it claims');
  });
});

// ── §6c The controls ─────────────────────────────────────────────────────────

// The mutations below break the CONTROVERSY menu specifically. They used to find
// it with a page-wide `.dl-subnav` sweep, which was unambiguous while CONTROVERSY
// was the only second-level group on the bar. It is not any more — SPECIAL
// COUNSEL nests HIGH NET WORTH DIVORCE and ADDITIONAL PRACTICE AREAS — so the
// sweep reached groups with no Florida link in them and threw on null before the
// assertion it exists to drive was ever reached.
//
// Identified by the link the group is built around rather than by position, so
// adding, removing or reordering groups anywhere on the bar leaves these traps
// pointed at the same menu.

/**
 * Every second-level group that actually contains the state pages.
 *
 * Found by walking OUT from a link that only exists in the CONTROVERSY submenu,
 * rather than by filtering groups and hoping the panel underneath holds what the
 * mutation needs. A filter on the group can still hand back a group whose
 * `.collapse` does not contain the link — the desktop panel and the mobile
 * accordion nest differently — and the mutation then dereferences null before
 * the assertion it exists to drive is ever reached.
 *
 * Starting from the link cannot do that: if there is no Florida link there is no
 * submenu in the list, and the loop simply does not run.
 */
function controversySubmenus(doc) {
  const seen = new Set();
  for (const fl of doc.querySelectorAll('a[href="/florida-sales-tax-audit.html"]')) {
    const panel = fl.closest('.collapse');
    if (panel && panel.closest('.dl-subnav, .dl-subnav-mobile')) seen.add(panel);
  }
  return [...seen];
}

/** The groups those submenus belong to. */
function controversyGroups(doc) {
  return controversySubmenus(doc)
    .map((sub) => sub.closest('.dl-subnav, .dl-subnav-mobile'))
    .filter(Boolean);
}

describe('SHELDON-NAV-R2 §6c — a broken TAX menu reds this suite', () => {
  // Each mutation is applied to the SERVED document and handed to the same
  // `taxMenuProblems` §6a is judged by. All of them leave a menu that renders.
  const MUTATIONS = [
    ['a state page is dropped', (doc) => {
      for (const a of doc.querySelectorAll('a[href="/massachusetts-tax-appeal.html"]')) a.remove();
    }, /submenu is 14 items|state pages are/],
    ['the state pages are put back in the wrong order', (doc) => {
      // Massachusetts ahead of Florida — the #227 spelling R2 corrects.
      // Scoped to the CONTROVERSY groups by their own content, not to every
      // `.dl-subnav` on the page: SPECIAL COUNSEL now nests two groups of its
      // own, and a page-wide sweep found a group with no state pages in it and
      // dereferenced null. The mutation is about the state order inside
      // CONTROVERSY, so it addresses the CONTROVERSY submenus and no others.
      for (const sub of controversySubmenus(doc)) {
        const fl = sub.querySelector('a[href="/florida-sales-tax-audit.html"]');
        const ma = sub.querySelector('a[href="/massachusetts-tax-appeal.html"]');
        if (!fl || !ma) continue;
        fl.parentNode.insertBefore(ma, fl);
      }
    }, /state pages are/],
    ['the submenu is flattened back into the panel', (doc) => {
      for (const group of controversyGroups(doc)) {
        const sub = group.querySelector('.collapse');
        if (!sub) continue;
        for (const a of [...sub.children]) group.parentNode.insertBefore(a, group);
        group.remove();
      }
    }, /first level is/],
    ['the nested toggle loses its aria-expanded', (doc) => {
      for (const group of controversyGroups(doc)) {
        for (const t of group.querySelectorAll('[data-toggle="collapse"]')) {
          t.removeAttribute('aria-expanded');
        }
      }
    }, /aria-expanded/],
  ];

  for (const [what, mutate, shows] of MUTATIONS) {
    test(`${what} — caught`, () => {
      const doc = new JSDOM(SERVED.get(VARIANTS[0].rel)).window.document;
      assert.deepEqual(taxMenuProblems(doc), [], 'control setup: the unbroken page must be clean first');
      const before = doc.querySelector(SITE_NAV_SELECTOR).innerHTML;
      mutate(doc);
      assert.notEqual(doc.querySelector(SITE_NAV_SELECTOR).innerHTML, before,
        `the "${what}" mutation changed nothing, so it tests nothing`);
      const problems = taxMenuProblems(doc);
      assert.ok(problems.length, `"${what}" was not caught at all`);
      assert.ok(problems.some((p) => shows.test(p)),
        `"${what}" was caught, but not for the right reason:\n${problems.join('\n')}`);
    });
  }
});
