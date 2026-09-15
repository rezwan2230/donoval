// ── DR-INSANE-PERCH-A33 (#58): the exposure boundary, proved ─────────────────
//
// The A4.1 QA gate failed A2.1/A2.2/A31 on one acceptance line — "no control
// function exposed on window" — because `js/perch-layer.js` published its whole
// instance, `setRouter` included, and `js/perch/qualifier.js` published
// `openQualifier` / `closeQualifier` on `window.__perch`.
//
// ── WHAT THIS FILE REFUSES TO DO ─────────────────────────────────────────────
// It does not assert the fix by grepping for the removed lines. "`setRouter` is
// not in the source" and "`setRouter` cannot be replaced on window" are different
// claims, and only the second one is the acceptance criterion — a future revision
// could publish an equivalent handle under another name and a source scan would
// stay green. See [[feedback_assert_behavior_not_source_spelling]].
//
// So §1–§3 EXECUTE the real modules against real jsdom windows and attempt the
// real attacks: assign the namespace, assign a slot, redefine it, delete it, add
// a key, register a second router, replace the qualifier's controls. §4 is the
// one place a source scan belongs — proving an ABSENCE across files, which is
// what a scan is actually good for.
//
// §5 keeps A2.2's no-re-exec / no-re-nonce / no-eval assertions honest across the
// files A33 touched, so the de-exposure cannot have smuggled a dynamic-execution
// primitive in behind a security ticket.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import {
  NAMESPACE, SLOTS, claim, publish, lockGlobal, readOnly,
} from '../donovan-legal-site/js/perch/surface.js';
import { mountQualifier } from '../donovan-legal-site/js/perch/qualifier.js';
import { CONTAINER_ID, LAYER_ID } from '../donovan-legal-site/js/perch/placement.js';
import { LAYER_MODULE } from '../donovan-legal-site/functions/_lib/perch-layer-inject.js';
import { ROUTER_MODULE } from '../donovan-legal-site/functions/_lib/perch-router-inject.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..', 'donovan-legal-site');
const read = (rel) => fs.readFileSync(path.join(SITE, rel), 'utf8');

/**
 * §2 keeps module-level state for the life of the document it models, which is
 * exactly right in a browser and wrong in a test process. A query string gives
 * Node a distinct module URL and therefore a genuinely fresh channel per test —
 * no reset export, because a reset export would itself be a way to unlock a
 * registered router.
 */
let freshN = 0;
const freshSurface = () => import(
  '../donovan-legal-site/js/perch/surface.js?a33=' + (++freshN)
);

/** A window that is only a window — no site code has run in it. */
const blankWindow = () => new JSDOM('<!doctype html><body></body>').window;

// ─────────────────────────────────────────────────────────────────────────────
// §1 · The namespace cannot be replaced, and neither can anything in it
// ─────────────────────────────────────────────────────────────────────────────

describe('A33 §1 — window.Perch is owned, not assigned', () => {
  test('claim() takes the property itself: non-writable, non-configurable', () => {
    const win = blankWindow();
    assert.equal(claim(win).ok, true);

    const d = Object.getOwnPropertyDescriptor(win, NAMESPACE);
    assert.equal(d.writable, false, 'a writable namespace is a swappable namespace');
    assert.equal(d.configurable, false, 'a configurable namespace can be redefined away');
    assert.equal(typeof d.value, 'object');
    win.close();
  });

  test('the whole namespace cannot be reassigned or deleted', () => {
    const win = blankWindow();
    claim(win);
    const before = win.Perch;

    // Module code is strict, so the real attacker path throws rather than
    // silently no-opping. Both are asserted: the throw, and that nothing moved.
    assert.throws(() => { 'use strict'; win.Perch = { layer: 'pwned' }; }, TypeError);
    assert.throws(() => { 'use strict'; delete win.Perch; }, TypeError);
    assert.throws(() => Object.defineProperty(win, NAMESPACE, { value: 'pwned' }), TypeError);
    assert.equal(win.Perch, before, 'the namespace object must be the one we defined');
    win.close();
  });

  test('a published slot is a getter with no setter, and cannot be redefined', () => {
    const win = blankWindow();
    claim(win);
    const surface = { probe: () => ({ ok: true }) };
    assert.equal(publish(win, 'layer', surface).ok, true);

    assert.equal(win.Perch.layer.probe().ok, true, 'the surface must still be readable');

    assert.throws(() => { 'use strict'; win.Perch.layer = { probe: () => ({ ok: false }) }; }, TypeError);
    assert.throws(() => Object.defineProperty(win.Perch, 'layer', { value: 'pwned' }), TypeError);
    assert.throws(() => { 'use strict'; delete win.Perch.layer; }, TypeError);
    assert.equal(win.Perch.layer.probe().ok, true);
    win.close();
  });

  test('a published surface is frozen — its methods cannot be swapped either', () => {
    const win = blankWindow();
    claim(win);
    publish(win, 'layer', { probe: () => 'real' });

    assert.equal(Object.isFrozen(win.Perch.layer), true);
    assert.throws(() => { 'use strict'; win.Perch.layer.probe = () => 'pwned'; }, TypeError);
    assert.equal(win.Perch.layer.probe(), 'real');
    win.close();
  });

  test('no new key can be added to the namespace', () => {
    const win = blankWindow();
    claim(win);
    assert.equal(Object.isExtensible(win.Perch), false);
    assert.throws(() => { 'use strict'; win.Perch.evil = 1; }, TypeError);
    assert.equal(win.Perch.evil, undefined);
    win.close();
  });

  test('publish() is one writer, once — a slot cannot be re-published over', () => {
    const win = blankWindow();
    claim(win);
    assert.equal(publish(win, 'layer', { probe: () => 'first' }).ok, true);

    const second = publish(win, 'layer', { probe: () => 'second' });
    assert.equal(second.ok, false);
    assert.match(second.reason, /already published/);
    assert.equal(win.Perch.layer.probe(), 'first');
    win.close();
  });

  test('publish() denies by default — an unlisted slot name is refused', () => {
    const win = blankWindow();
    claim(win);
    const res = publish(win, 'booking', { submit: () => 'pwned' });
    assert.equal(res.ok, false);
    assert.match(res.reason, /unknown slot/);
    assert.deepEqual(Object.keys(win.Perch).sort(), [...SLOTS].sort());
    win.close();
  });

  test('THE CAPTURE ATTACK: a pre-seeded window.Perch never receives the surface', () => {
    // This is what `window.Perch = Object.assign(window.Perch || {}, {layer})`
    // could not defend against, and why hardening the VALUE alone was never
    // enough. A script that runs before the layer seeds the namespace with a
    // `layer` SETTER; the old code's assignment would have handed it the live
    // instance. See [[feedback_published_instance_is_not_a_probe_namespace]].
    const win = blankWindow();
    let stolen = null;
    Object.defineProperty(win, 'Perch', {
      configurable: true,
      enumerable: true,
      get() { return this._p || (this._p = {}); },
      set(v) { stolen = v; },
    });

    const claimed = claim(win);
    assert.equal(claimed.ok, false, 'a namespace we do not own must not be adopted');
    assert.match(claimed.reason, /already exists and is not ours/);

    const put = publish(win, 'layer', { probe: () => 'secret' });
    assert.equal(put.ok, false);
    assert.match(put.reason, /not claimed/);
    assert.equal(stolen, null, 'nothing may be handed to a namespace someone else authored');
    win.close();
  });

  test('claim() is idempotent for us — the layer and the router may both call it', () => {
    const win = blankWindow();
    const first = claim(win);
    const second = claim(win);
    assert.equal(second.ok, true);
    assert.equal(second.ns, first.ns, 'the second caller must get the same namespace');

    publish(win, 'layer', { probe: () => 'L' });
    publish(win, 'router', { probe: () => 'R' });
    assert.equal(win.Perch.layer.probe(), 'L');
    assert.equal(win.Perch.router.probe(), 'R');
    win.close();
  });

  test('lockGlobal() defines rather than assigns, and refuses to adopt', () => {
    const win = blankWindow();
    assert.equal(lockGlobal(win, '__perch', { probe: () => 'p' }).ok, true);

    const d = Object.getOwnPropertyDescriptor(win, '__perch');
    assert.equal(d.writable, false);
    assert.equal(d.configurable, false);
    assert.throws(() => { 'use strict'; win.__perch = { openQualifier: () => 'pwned' }; }, TypeError);
    assert.throws(() => { 'use strict'; win.__perch.probe = () => 'pwned'; }, TypeError);
    assert.equal(win.__perch.probe(), 'p');

    // Second definition refused rather than clobbering.
    assert.equal(lockGlobal(win, '__perch', { probe: () => 'q' }).ok, false);
    assert.equal(win.__perch.probe(), 'p');
    win.close();
  });

  test('readOnly() freezes what it is given', () => {
    const o = readOnly({ a: 1 });
    assert.equal(Object.isFrozen(o), true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · The navigation channel: one registration, and no way to read it back
// ─────────────────────────────────────────────────────────────────────────────

describe('A33 §2 — the router slot cannot be replaced from a page script', () => {
  test('unregistered: no router, and navigateVia() reports the fallback', async () => {
    const s = await freshSurface();
    assert.equal(s.hasRouter(), false);
    assert.equal(s.navigateVia('/contact'), false, 'the caller must fall back to a hard navigation');
    assert.deepEqual(s.routerLock(), { registered: false, refused: 0, waiting: 0 });
  });

  test('the first registration wins and actually routes', async () => {
    const s = await freshSurface();
    const seen = [];
    assert.equal(s.registerRouter((href) => seen.push(href)).ok, true);
    assert.equal(s.hasRouter(), true);
    assert.equal(s.navigateVia('/book'), true);
    assert.deepEqual(seen, ['/book']);
  });

  test('a SECOND registration is refused, counted, and does not take over', async () => {
    const s = await freshSurface();
    const real = [];
    const hijacked = [];
    s.registerRouter((href) => real.push(href));

    const attack = s.registerRouter((href) => hijacked.push(href));
    assert.equal(attack.ok, false);
    assert.match(attack.reason, /already registered/);

    s.navigateVia('/book');
    assert.deepEqual(real, ['/book'], 'the original router must still be the one that runs');
    assert.deepEqual(hijacked, [], 'the replacement must never run');
    assert.deepEqual(s.routerLock(), { registered: true, refused: 1, waiting: 0 });
  });

  test('a non-function registration is refused and counted', async () => {
    const s = await freshSurface();
    const res = s.registerRouter({ toString: () => 'not a function' });
    assert.equal(res.ok, false);
    assert.equal(s.hasRouter(), false);
    assert.equal(s.routerLock().refused, 1);
  });

  test('the registered function is never handed back out by any export', async () => {
    // The threat is a wrapper: read the router, register your own that calls it,
    // and you are in the middle of every agent-driven navigation with nothing
    // visibly broken. No export returns it — asserted by enumerating the module's
    // whole export surface, not by reading the ones I remembered to check.
    const s = await freshSurface();
    const secret = () => 'the real router';
    s.registerRouter(secret);

    for (const [name, value] of Object.entries(s)) {
      if (typeof value !== 'function') continue;
      let out;
      try { out = value(); } catch (e) { continue; }
      assert.notEqual(out, secret, `${name}() must not return the registered router`);
      if (out && typeof out === 'object') {
        for (const v of Object.values(out)) {
          assert.notEqual(v, secret, `${name}() must not leak the registered router`);
        }
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · The qualifier: de-exposed on window, unchanged in the closure
// ─────────────────────────────────────────────────────────────────────────────

describe('A33 §3 — the qualifier still works, and no longer hands out its controls', () => {
  /** Mount the REAL qualifier into a real document. */
  function mount() {
    const dom = new JSDOM('<!doctype html><body></body>', { url: 'https://www.donovan.law/contact' });
    const win = dom.window;
    const q = mountQualifier(win.document.body, { callId: () => 'call_abc' });
    return { dom, win, q };
  }

  test('window.__perch carries a probe and NOTHING that opens the card', () => {
    const { dom, win } = mount();
    try {
      assert.deepEqual(Object.keys(win.__perch), ['probe']);
      assert.equal(win.__perch.openQualifier, undefined, 'the finding: this was callable');
      assert.equal(win.__perch.closeQualifier, undefined);
      assert.equal(typeof win.__perch.probe, 'function');
    } finally { dom.window.close(); }
  });

  test('the surface cannot be replaced, rebuilt or extended from a page script', () => {
    const { dom, win } = mount();
    try {
      assert.throws(() => { 'use strict'; win.__perch = { openQualifier: () => 'pwned' }; }, TypeError);
      assert.throws(() => { 'use strict'; win.__perch.probe = () => 'pwned'; }, TypeError);
      assert.throws(() => { 'use strict'; win.__perch.openQualifier = () => 'pwned'; }, TypeError);
      assert.throws(() => Object.defineProperty(win, '__perch', { value: { openQualifier() {} } }), TypeError);
      assert.throws(() => { 'use strict'; delete win.__perch; }, TypeError);
      assert.deepEqual(Object.keys(win.__perch), ['probe']);
    } finally { dom.window.close(); }
  });

  test('THE BEHAVIOUR IS UNCHANGED: the closure still opens and closes the card', () => {
    // De-exposure that broke the qualifier would be a worse outcome than the
    // finding. This drives the real returned closure — the same object
    // js/perch-layer.js and js/page/perch-shell.js hand to createCall.
    const { dom, win, q } = mount();
    try {
      const card = win.document.getElementById('qual');
      assert.ok(card, 'the card must be built');
      assert.equal(card.classList.contains('show'), false);

      q.openQualifier('es', 'google');
      assert.equal(card.classList.contains('show'), true, 'openQualifier must raise the card');
      assert.equal(win.__perch.probe().open, true);
      assert.equal(win.__perch.probe().lang, 'es', 'the Spanish render must still be selectable');
      assert.equal(win.__perch.probe().step, 0);

      q.closeQualifier();
      assert.equal(card.classList.contains('show'), false, 'closeQualifier must dismiss it');
      assert.equal(win.__perch.probe().open, false);
    } finally { dom.window.close(); }
  });

  test('the probe reports state and never the call id itself', () => {
    // Diagnostics on a page that hosts a recorded legal call: the probe answers
    // "is a call attached", not "which call". [[project_donovan_pii_minimize]]
    const { dom, win } = mount();
    try {
      const p = win.__perch.probe();
      assert.equal(p.callId, 'set');
      assert.equal(p.mounted, true);
      assert.equal(p.answered, 0);
      assert.equal(JSON.stringify(p).includes('call_abc'), false, 'the call id must not appear');
    } finally { dom.window.close(); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 · The layer, executed: the published surface is read-only and minimal
// ─────────────────────────────────────────────────────────────────────────────

describe('A33 §4 — js/perch-layer.js publishes a read-only surface and nothing else', () => {
  /**
   * Run the REAL js/perch-layer.js.
   *
   * The browser loads it with absolute specifiers (`/js/perch/chrome.js`), which
   * Node resolves against the filesystem root. The harness rewrites ONLY the
   * specifier prefix, writes the result inside test/ (never inside the deployed
   * site tree) and imports that. Every module it pulls in — chrome, call,
   * qualifier, placement, booking-control, surface — is the real file, and
   * `../donovan-legal-site/js/perch/surface.js` resolves to the SAME module
   * instance this test file imported, which is what makes the router handshake
   * below a real handshake rather than a mock.
   */
  async function loadLayer() {
    const src = read(path.join('js', 'perch-layer.js'))
      .replace(/(['"])\/js\//g, '$1../donovan-legal-site/js/');
    const file = path.join(HERE, `.a33-layer-harness-${process.pid}.mjs`);
    fs.writeFileSync(file, src);
    try {
      return await import('./' + path.basename(file) + '?a33=1');
    } finally {
      fs.unlinkSync(file);
    }
  }

  /** A document shaped like a real content page, with the globals mount() reads. */
  function browserGlobals() {
    const dom = new JSDOM(
      `<!doctype html><body><main id="${CONTAINER_ID}"><p>content</p></main></body>`,
      { url: 'https://www.donovan.law/contact' },
    );
    const win = dom.window;
    const saved = {};
    const globals = {
      window: win,
      document: win.document,
      location: win.location,
      CustomEvent: win.CustomEvent,
      // jsdom's timer, so window.close() clears it — Node's global setInterval
      // would keep the test process alive forever on the layer's tick counter.
      setInterval: win.setInterval.bind(win),
    };
    for (const [k, v] of Object.entries(globals)) {
      saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
      Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
    }
    return {
      win,
      restore() {
        for (const [k, d] of Object.entries(saved)) {
          if (d) Object.defineProperty(globalThis, k, d);
          else delete globalThis[k];
        }
        dom.window.close();
      },
    };
  }

  test('mount() publishes exactly four read-only keys, and no control handle', async () => {
    const env = browserGlobals();
    try {
      const layerModule = await loadLayer();
      const surface = layerModule.mount();
      const { win } = env;

      assert.ok(win.document.getElementById(LAYER_ID), 'the layer must actually mount');
      assert.ok(win.Perch && win.Perch.layer, 'the layer surface must be published');

      // The whole acceptance line, as a set comparison rather than a spot check:
      // anything added to the surface later fails here until it is reviewed.
      assert.deepEqual(
        Object.keys(win.Perch.layer).sort(),
        ['attachLiveResource', 'bookingProbe', 'detachLiveResource', 'probe'],
      );

      // Every control handle the QA gate named, gone from the window.
      for (const gone of [
        'setRouter', 'root', 'container', 'concierge', 'call', 'qualifier',
        'mountShellConcierge', 'inspect', 'isPersistent',
      ]) {
        assert.equal(win.Perch.layer[gone], undefined, `Perch.layer.${gone} must not be exposed`);
      }

      // ...and mount() itself must not hand the instance to a dynamic importer,
      // or de-exposure would only have moved the control surface.
      assert.equal(surface, win.Perch.layer, 'mount() must return the published surface');
      assert.equal(surface.root, undefined);

      // Read-only, for real.
      assert.throws(() => { 'use strict'; win.Perch.layer = { probe: () => 'pwned' }; }, TypeError);
      assert.throws(() => { 'use strict'; win.Perch.layer.probe = () => 'pwned'; }, TypeError);
      assert.throws(() => { 'use strict'; win.Perch = {}; }, TypeError);
      assert.throws(() => { 'use strict'; win.Perch.layer.setRouter = () => 'pwned'; }, TypeError);
      assert.equal(win.Perch.layer.setRouter, undefined, 'the assignment must not have created it');

      // The diagnostics still work — de-exposure must not blind the verifiers.
      const probe = win.Perch.layer.probe();
      assert.match(probe.instanceId, /^perch-/);
      assert.equal(probe.placement.ok, true, 'the layer invariant must still hold');
      win.Perch.layer.attachLiveResource('a33-clock', { clock: () => 42, state: () => 'running' });
      assert.deepEqual(win.Perch.layer.probe().resources['a33-clock'], { clock: 42, state: 'running' });
      win.Perch.layer.detachLiveResource('a33-clock');
      assert.equal(win.Perch.layer.probe().resources['a33-clock'], undefined);

      // A second mount() is still idempotent and still returns the surface.
      assert.equal(layerModule.mount(), surface);

      // ── The router handshake, end to end ──────────────────────────────────
      // `routerActive` is the gate A31 (#56) scoped the direct booking path to,
      // and it is now fed by the module-private slot. It must be false until a
      // router registers, true immediately after, and immune to a second caller.
      const s = await import('../donovan-legal-site/js/perch/surface.js');
      assert.equal(win.Perch.layer.bookingProbe().routerActive, false, 'no router yet');

      const routed = [];
      assert.equal(s.registerRouter((href) => routed.push(href)).ok, true);
      assert.equal(win.Perch.layer.bookingProbe().routerActive, true, 'the gate must arm');
      assert.equal(win.Perch.layer.bookingProbe().routerRefused, 0);

      const hijack = [];
      assert.equal(s.registerRouter((href) => hijack.push(href)).ok, false);
      assert.equal(win.Perch.layer.bookingProbe().routerRefused, 1, 'the attempt must be visible');
      s.navigateVia('/book');
      assert.deepEqual(routed, ['/book']);
      assert.deepEqual(hijack, [], 'a page script must not become the navigation callback');
    } finally {
      env.restore();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 · Absence checks — the one job a source scan is right for
// ─────────────────────────────────────────────────────────────────────────────

describe('A33 §5 — no control function is writable on window, anywhere in the layer stack', () => {
  /**
   * The file set is DERIVED, not typed out.
   *
   * A guard that enumerates "the four files I changed" while claiming "anywhere
   * in the layer stack" cannot fail open on a file added tomorrow — it simply
   * would not look at it. See [[feedback_hardcoded_list_cannot_fail_open]]. So
   * the roots are the two module paths the INJECTORS actually emit, and the set
   * is their transitive import closure, walked from the real source.
   */
  const FILES = importClosure([
    LAYER_MODULE.replace(/^\//, ''),
    ROUTER_MODULE.replace(/^\//, ''),
  ]);

  test('the derived set is the whole injected stack, and it found the new module', () => {
    // If the walk silently found nothing, every assertion below would vacuously
    // pass. Assert the shape of the set before trusting the set.
    assert.ok(FILES.length >= 8, 'the closure looks too small: ' + FILES.join(', '));
    for (const expected of [
      'js/perch-layer.js', 'js/perch-swup-router.js',
      'js/perch/surface.js', 'js/perch/qualifier.js',
      'js/perch/placement.js', 'js/perch/booking-control.js',
      // 'js/perch/call.js' and 'js/perch/chrome.js' stood here. call.js was the Retell
      // WebRTC engine and chrome.js dressed the shell's frame; both went with the
      // voice concierge, so neither is reachable from the injected stack any more.
      'js/perch/swap-policy.js', 'js/perch/reinit.js',
    ]) {
      assert.ok(FILES.includes(expected), `${expected} must be in the walked closure`);
    }
    for (const rel of FILES) {
      assert.ok(fs.existsSync(path.join(SITE, rel)), `${rel} must resolve to a real file`);
    }
  });

  test('SCOPE: the superseded js/perch-router.js is out of the closure and off every page', () => {
    // It publishes `window.__perchNav` — a navigation mutator on window, and the
    // one thing in this tree that would fail the assertion below. It is NOT
    // fixed by this ticket and it is not quietly excluded either: it is the
    // pre-Phase-A reference implementation, loaded by zero pages (asserted in
    // test/perch-swup-router.test.mjs, 'the superseded body-swap router is loaded
    // by no page'), and retiring it is a follow-up A22 already booked as O6.
    // Recording the carve-out here is the difference between a scoped guard and
    // a guard with a hole in it.
    assert.equal(FILES.includes('js/perch-router.js'), false, 'it must stay out of the injected stack');
    assert.match(read('js/perch-router.js'), /window\.__perchNav\s*=/, 'if this stops being true, re-scope this test');
  });

  test('THE ACCEPTANCE LINE: no FUNCTION is ever assigned to a window property', () => {
    // The criterion is "no control function exposed on window", and the precise
    // shape of every one of the three findings was a FUNCTION reachable through a
    // writable window property: `Perch.layer.setRouter`, `__perch.openQualifier`,
    // `__perch.closeQualifier`. So the rule is about what gets assigned, not about
    // whether the window is touched at all.
    //
    // Data still crosses the boundary, and must: js/perch/booking-control.js
    // writes `win.__perchCallId`, the live call id the booking widget reads at
    // js/booking-widget.js:1319 to stamp the appointment. That is a string on the
    // booking WRITE path, which this ticket is explicitly forbidden to change,
    // and a string is not a control function — it cannot be called and replacing
    // it cannot redirect a navigation. It is reported, not silently tolerated.
    const dataWrites = [];
    for (const rel of FILES) {
      const code = strip(read(rel));
      for (const m of code.matchAll(/\b(?:window|win|globalThis)\.([A-Za-z_$][\w$]*)\s*=(?!=)([^\n;]*)/g)) {
        const [, name, rhs] = m;
        assert.doesNotMatch(rhs, /=>|\bfunction\b|\.bind\(/,
          `${rel} assigns a FUNCTION to window.${name} — that is the finding`);
        dataWrites.push(`${rel} → window.${name}`);
      }
    }
    // COMPOSE-R1 (#153 + #158) adds the second row. `js/perch-layer.js` writes
    // `window.__perchQualifierClaim` — the constant string `none`, set only when the
    // visitor abandoned the qualifier card, read by js/booking-widget.js beside the
    // call id above. It clears the bar this test actually sets: it is not a function,
    // cannot be called, and replacing it cannot redirect a navigation. It is also
    // strictly less than the row above it — the call id is a bearer capability for
    // the bridge, while this names no record and grants nothing. Its only server-side
    // effect is to make booking/create.js WITHHOLD the qualifier join, so forging it
    // costs the forger their own enrichment and nobody else anything.
    //
    // Listed, not tolerated: a third write still fails this assertion.
    assert.deepEqual(dataWrites, [
      'js/perch-layer.js → window.__perchQualifierClaim',
      'js/perch/booking-control.js → window.__perchCallId',
    ], 'every value written to the window must be one a reviewer has seen');
  });

  test('neither owned namespace is ever ASSIGNED — both are defined', () => {
    // `window.Perch = Object.assign(window.Perch || {}, …)` is a function-free
    // right-hand side, so the rule above would not catch its return. This is the
    // rule that does: the two namespaces this architecture owns are reachable by
    // Object.defineProperty and by nothing else, anywhere in the stack.
    for (const rel of FILES) {
      const code = strip(read(rel));
      assert.doesNotMatch(code, /\b(?:window|win|globalThis)\.(?:Perch|__perch)\s*=(?!=)/,
        `${rel} assigns a namespace instead of defining it`);
    }
  });

  test('surface.js reaches the globals only through defineProperty', () => {
    const code = strip(read('js/perch/surface.js'));
    assert.match(code, /Object\.defineProperty\(win, NAMESPACE/);
    assert.match(code, /Object\.defineProperty\(win, name/);
    // Non-writable and non-configurable on every window-level definition.
    const defs = [...code.matchAll(/Object\.defineProperty\(win,[\s\S]{0,220}?\}\);/g)].map((m) => m[0]);
    assert.equal(defs.length, 2, 'exactly two window-level definitions: Perch and __perch');
    for (const d of defs) {
      assert.match(d, /writable:\s*false/, 'a writable global is a replaceable global');
      assert.match(d, /configurable:\s*false/, 'a configurable global can be redefined away');
    }
  });

  test('setRouter is gone from the codebase, under that name or any other', () => {
    // Not just the spelling: nothing in the layer stack may publish a function
    // that ACCEPTS a navigation callback. The behavioural proof is §4; this
    // catches a reintroduction under a new name in review.
    for (const rel of FILES) {
      const code = strip(read(rel));
      assert.doesNotMatch(code, /\bsetRouter\b/, `${rel} still names setRouter`);
    }
    // The only place a router may be installed, and it is not a window property.
    const surface = strip(read('js/perch/surface.js'));
    assert.match(surface, /export function registerRouter/);
    const router = strip(read('js/perch-swup-router.js'));
    assert.equal((router.match(/registerRouter\(/g) || []).length, 1,
      'the router must register exactly once');
  });

  test('the qualifier publishes no callable control', () => {
    const code = strip(read('js/perch/qualifier.js'));
    assert.doesNotMatch(code, /__perch\s*=/, 'window.__perch must be defined, never assigned');

    // Exactly one `lockGlobal(` call, and the object literal it publishes must
    // name neither control function. Sliced to the call's own parentheses rather
    // than to a landmark further down the file, so the assertion cannot quietly
    // widen if the code below it moves.
    const at = code.indexOf('lockGlobal(');
    assert.ok(at > -1, 'the qualifier must publish through lockGlobal');
    assert.equal((code.match(/lockGlobal\(/g) || []).length, 1);
    const locked = code.slice(at, code.indexOf('});', at) + 3);
    assert.match(locked, /probe:/);
    assert.doesNotMatch(locked, /openQualifier|closeQualifier/,
      'the locked surface must not carry the control functions');
  });

  test('A2.2 still never re-executes, re-nonces or evals — and neither does A33', () => {
    // Carried forward from test/perch-swup-router.test.mjs so the ticket that
    // touched these files re-proves it on the files as they now stand, including
    // the new module. A security fix that introduced eval would be a bad trade.
    const FORBIDDEN = [
      /\beval\s*\(/, /new\s+Function\s*\(/, /\.innerHTML\s*=/,
      /document\.write/, /insertAdjacentHTML/, /nonce/i,
    ];
    for (const rel of ['js/perch-layer.js', 'js/perch-swup-router.js', 'js/perch/surface.js']) {
      const code = strip(read(rel));
      for (const forbidden of FORBIDDEN) {
        assert.doesNotMatch(code, forbidden, `${rel} must not contain ${forbidden}`);
      }
    }

    // js/perch/qualifier.js is exempt from the innerHTML rule ALONE, and named
    // here rather than dropped from the list so the exemption is a decision a
    // reviewer sees. It renders its own bilingual card from authored template
    // literals in this file (A21, #51); it fetches no markup and adopts no
    // script, so the re-execution risk the router rule exists for does not
    // apply. Every other primitive is still forbidden here.
    const qual = strip(read('js/perch/qualifier.js'));
    for (const forbidden of FORBIDDEN.filter((r) => String(r) !== String(/\.innerHTML\s*=/))) {
      assert.doesNotMatch(qual, forbidden, `js/perch/qualifier.js must not contain ${forbidden}`);
    }
  });
});

/**
 * Walk the ES-module import graph from a set of site-relative roots.
 *
 * Handles both specifier spellings in this tree: absolute (`/js/perch/call.js`,
 * what the browser needs from a module served at `/js/perch-layer.js`) and
 * sibling-relative (`./surface.js`, which resolves identically in the browser and
 * lets the Node test runner import the same file).
 */
function importClosure(roots) {
  const seen = new Set();
  const queue = [...roots];
  while (queue.length) {
    const rel = queue.shift().replace(/\\/g, '/');
    if (seen.has(rel)) continue;
    if (!fs.existsSync(path.join(SITE, rel))) continue;
    seen.add(rel);
    const src = read(rel);
    for (const m of src.matchAll(/\bfrom\s+['"]([^'"]+)['"]/g)) {
      const spec = m[1];
      if (spec.startsWith('/')) queue.push(spec.slice(1));
      else if (spec.startsWith('.')) queue.push(path.posix.normalize(path.posix.join(path.posix.dirname(rel), spec)));
    }
  }
  return [...seen].sort();
}

/**
 * Drop comments before scanning.
 *
 * These files carry long prose headers that quote the very lines being removed —
 * `window.__perch = Object.assign(…)` appears verbatim in the note explaining why
 * it is gone. A scan that reads its own documentation is a scan that fails on a
 * well-documented fix, or worse, passes on an undocumented regression.
 * See [[feedback_regression_guard_greps_own_comments]].
 */
function strip(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');
}
