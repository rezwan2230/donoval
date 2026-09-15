// ── SARAH-PERCH-A41 · Task 4 — the security invariants on the REWIRED path ────
//
// Order SARAH-PERCH-A41-CUTOVER-QA · ticket #60 · Phase A / Phase 4.
// Folds in the acceptance of A3.3 (#58): "control functions closure-scoped, not
// `window` globals" + "a CI assertion proves no code path re-executes, re-nonces
// or evals fetched-HTML scripts".
//
// ── WHY THIS FILE EXISTS WHEN #75 ALREADY SHIPPED AN ASSERTION ────────────────
// test/perch-swup-router.test.mjs §"the router never re-executes, re-nonces or
// evals a fetched script" reads ONE file: js/perch-swup-router.js. That was the
// whole router path when it was written. A31 (#77) then added
// js/perch/booking-control.js — a module the router path executes on every
// booking command Paula issues — and the existing assertion cannot see it. An
// invariant that names three files by hand cannot fail open the day a fourth
// arrives; see [[feedback_hardcoded_list_cannot_fail_open]].
//
// So the file list here is DERIVED FROM THE TREE, not typed: every module under
// js/perch/ plus the two top-level entry points, discovered by reading the
// directory. A module added next month is covered the day it lands, and §0 fails
// if the discovery ever returns a suspiciously small set.
//
// ── COMMENTS ARE STRIPPED BEFORE EVERY SCAN ──────────────────────────────────
// These files explain themselves by naming the things they forbid — swap-policy.js
// line 22 contains the words "re-nonced or eval'd" in prose. A guard that greps
// its own commentary reds on the sentence describing the rule
// ([[feedback_regression_guard_greps_own_comments]]). `code()` below removes
// block and line comments first, and §0 proves the stripper actually strips.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import { createBookingControl } from '../donovan-legal-site/js/perch/booking-control.js';

const SITE = fileURLToPath(new URL('../donovan-legal-site/', import.meta.url));
const read = (p) => readFileSync(join(SITE, p), 'utf8');

/** Executable text only: block comments and line comments removed. */
const code = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');

/**
 * Executable text with quoted STRING LITERALS blanked too.
 *
 * js/perch/swap-policy.js documents each allow/deny entry in a `why:` string, and
 * two of those sentences contain the exact tokens the scans below forbid
 * ('document.write() fallback', '/booking/create would reject every booking').
 * A guard that reds on the explanation of a rule is the same defect as one that
 * reds on its own comments — the prose just moved into a string. Quoted literals
 * are therefore blanked for the "does this code DO x" scans.
 *
 * Single- and double-quoted only; template literals are left intact so a
 * `${…}` expression can never hide an `eval(` from the scan. Which scan uses
 * which form is chosen per test, and the stripper is proved in §0.
 */
const codeNoStrings = (src) => code(src)
  .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
  .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');

// ── The modules the ROUTER PATH executes, discovered from the tree ────────────
//
// Two top-level entry points (the edge injects exactly these two tags — see
// functions/_lib/perch-router-inject.js and _lib/perch-layer-inject.js) plus
// everything js/perch/ holds, because the layer and the router import from it.
const PERCH_DIR = join(SITE, 'js', 'perch');
const ROUTER_PATH_MODULES = [
  'js/perch-swup-router.js',
  'js/perch-layer.js',
  ...readdirSync(PERCH_DIR).filter((f) => f.endsWith('.js')).sort().map((f) => `js/perch/${f}`),
];

/** The new module this ticket's coverage gap was about. */
const ADAPTER = 'js/perch/booking-control.js';

/**
 * The modules that actually HANDLE FETCHED HTML — the ones A3.3's second clause
 * is about ("no code path re-executes, re-nonces or evals fetched-HTML scripts").
 *
 * Derived, not typed: a module qualifies if its executable text touches the
 * incoming document (`incomingDoc` / `visit.to`). That is the only place a script
 * from another page can enter this document, so scoping the HTML-injection ban to
 * this set is scoping it to the risk. §0 asserts the derivation is non-vacuous and
 * a proper subset — a bug that widened it to everything would show up there.
 *
 * The wider ban (eval, new Function, string-bodied timers) stays on ALL modules
 * below, because those execute arbitrary text regardless of where it came from.
 *
 * NOT in this set, and deliberately so: js/perch/qualifier.js assigns innerHTML
 * from module-constant bilingual templates with esc() on every interpolation, and
 * never from a fetched document. That is an XSS question about its own strings,
 * not a re-execution question about someone else's page.
 */
const FETCHED_HTML_HANDLERS = ROUTER_PATH_MODULES
  .filter((m) => /incomingDoc|visit\.to/.test(code(read(m))));

// ─────────────────────────────────────────────────────────────────────────────
// 0. Non-vacuity — the scan is real, and the comment stripper works
// ─────────────────────────────────────────────────────────────────────────────
describe('§0 — the scan covers a real, non-empty module set', () => {
  test('discovery finds the whole router path, including the A31 adapter', () => {
    assert.ok(ROUTER_PATH_MODULES.length >= 9,
      `expected the router path to be ~9 modules, found ${ROUTER_PATH_MODULES.length}: ${ROUTER_PATH_MODULES}`);
    assert.ok(ROUTER_PATH_MODULES.includes(ADAPTER),
      'THE POINT OF THIS FILE: the A31 adapter must be inside the swept set');
    for (const m of ROUTER_PATH_MODULES) {
      assert.ok(read(m).length > 200, `${m} is empty or unreadable — the sweep would be vacuous`);
    }
  });

  test('the comment stripper removes prose that would otherwise trip every guard', () => {
    const raw = read('js/perch/swap-policy.js');
    assert.match(raw, /eval'd|re-nonced/i, 'precondition: this file DOES discuss the forbidden words in prose');
    assert.doesNotMatch(code(raw), /re-nonced/i, 'and the stripper must remove that prose');
    // A control on the stripper itself: it must not eat executable text.
    assert.match(code(raw), /export function adoptDecision/);
  });

  test('the string stripper removes documentation prose that moved into a `why:` literal', () => {
    const raw = read('js/perch/swap-policy.js');
    assert.match(code(raw), /document\.write\(\) fallback/,
      'precondition: after comments, a `why:` STRING still contains a forbidden token');
    assert.doesNotMatch(codeNoStrings(raw), /document\.write/, 'and the string stripper must remove it');
    assert.doesNotMatch(codeNoStrings(raw), /booking\/create/, 'same for the write-path sentence');
    // Controls: it must not eat executable text, and must not blank a template
    // literal — a `${eval(x)}` has to stay visible to the scans.
    assert.match(codeNoStrings(raw), /export function adoptDecision/);
    assert.match(codeNoStrings('const a = `x${eval(y)}`;'), /eval\(/);
  });

  test('the fetched-HTML handlers are discovered from code, not listed by hand', () => {
    assert.ok(FETCHED_HTML_HANDLERS.includes('js/perch-swup-router.js'),
      'the router receives visit.to.document and must be in the set');
    assert.ok(FETCHED_HTML_HANDLERS.length >= 2 && FETCHED_HTML_HANDLERS.length < ROUTER_PATH_MODULES.length,
      `expected a proper subset of the path, got ${FETCHED_HTML_HANDLERS.length}/${ROUTER_PATH_MODULES.length}`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. A3.3 — no re-exec, no re-nonce, no eval, ACROSS THE WHOLE REWIRED PATH
// ─────────────────────────────────────────────────────────────────────────────
describe('§T4.1 — no module on the router path re-executes, re-nonces or evals fetched script', () => {
  // Executes arbitrary text whatever its provenance — banned on the whole path.
  const NEVER_ANYWHERE = [
    [/\beval\s*\(/, 'eval()'],
    [/new\s+Function\s*\(/, 'new Function()'],
    [/\bsetTimeout\s*\(\s*['"`]/, 'setTimeout with a string body'],
    [/\bsetInterval\s*\(\s*['"`]/, 'setInterval with a string body'],
    [/\.setAttribute\(\s*['"]on/i, 'an inline event-handler attribute'],
  ];

  // Can carry a script element out of a FETCHED document into this one — banned
  // on the modules that hold a fetched document.
  const NEVER_ON_FETCHED_HTML = [
    [/\.innerHTML\s*=/, 'innerHTML assignment'],
    [/insertAdjacentHTML/, 'insertAdjacentHTML'],
    [/document\.write/, 'document.write'],
    [/\.outerHTML\s*=/, 'outerHTML assignment'],
    [/createContextualFragment/, 'createContextualFragment'],
  ];

  for (const mod of ROUTER_PATH_MODULES) {
    test(`${mod} contains no dynamic-execution primitive`, () => {
      const src = code(read(mod));
      for (const [re, label] of NEVER_ANYWHERE) {
        assert.doesNotMatch(src, re, `${mod} must not use ${label}`);
      }
    });
  }

  for (const mod of FETCHED_HTML_HANDLERS) {
    test(`${mod} handles a fetched document and injects no HTML from it`, () => {
      const src = codeNoStrings(read(mod));
      for (const [re, label] of NEVER_ON_FETCHED_HTML) {
        assert.doesNotMatch(src, re, `${mod} holds a fetched document and must not use ${label}`);
      }
    });
  }

  test('and no module reads, writes or forges a nonce', () => {
    // The CSP admits every script the router inserts by HOST allow-list. The word
    // `nonce` appearing in executable text anywhere on this path means the
    // mechanism changed and the A0.2 inline-externalization argument no longer
    // holds. (Prose about nonces is fine and is stripped above.)
    for (const mod of ROUTER_PATH_MODULES) {
      assert.doesNotMatch(code(read(mod)), /nonce/i, `${mod} touches a nonce`);
    }
  });

  test('the A31 adapter creates no script element and executes no fetched text', () => {
    const src = code(read(ADAPTER));
    assert.doesNotMatch(src, /createElement\(\s*['"]script['"]\s*\)/, 'the adapter must never mint a script');
    assert.doesNotMatch(src, /\.textContent\s*=|\.text\s*=|appendChild/, 'nor inject any node');
    assert.doesNotMatch(src, /\bimport\s*\(/, 'nor dynamically import at runtime');
    // It reaches the widget through the published API and nothing else.
    assert.match(src, /surface\[method\]\(payload\)/, 'the one call site is the widget\'s own method');
  });

  test('exactly one place on the whole path creates a script element (the router\'s loadScript)', () => {
    const creators = ROUTER_PATH_MODULES.filter((m) => /createElement\(\s*['"]script['"]\s*\)/.test(code(read(m))));
    assert.deepEqual(creators, ['js/perch-swup-router.js'],
      'script creation must stay in the router\'s single audited helper');
  });

  test('MUTATION BITE — an eval added to the adapter reds this suite', () => {
    const mutated = code(read(ADAPTER)) + '\nfunction _m(){ return eval("1+1"); }\n';
    assert.match(mutated, /\beval\s*\(/, 'the guard must bite on the mutant it is written to catch');
  });

  test('MUTATION BITE — a nonce read added to the adapter reds this suite', () => {
    const mutated = code(read(ADAPTER)) + '\nconst n = doc.querySelector("script[nonce]").nonce;\n';
    assert.match(mutated, /nonce/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. A3.3 — control functions stay in a closure. Runtime proof for the adapter.
// ─────────────────────────────────────────────────────────────────────────────
describe('§T4.2 — the A31 adapter publishes NOTHING on window (runtime)', () => {
  /** A bare window with a stub DLBooking, so `apply` takes its real path. */
  function freshWindow() {
    const dom = new JSDOM('<!doctype html><body><div id="dl-booking"></div></body>', {
      url: 'https://preview.donovan-site.pages.dev/book',
    });
    const w = dom.window;
    const calls = [];
    w.DLBooking = {
      prefill: (p) => { calls.push(['prefill', p]); return true; },
      selectType: (p) => { calls.push(['selectType', p]); return true; },
      selectSlot: (p) => { calls.push(['selectSlot', p]); return true; },
      showDate: (p) => { calls.push(['showDate', p]); return true; },
    };
    return { w, calls };
  }

  test('building the adapter adds no key to window at all', () => {
    const { w } = freshWindow();
    const before = new Set(Object.keys(w));
    createBookingControl(w, w.document);
    const added = Object.keys(w).filter((k) => !before.has(k));
    assert.deepEqual(added, [], `createBookingControl leaked ${JSON.stringify(added)} onto window`);
  });

  test('driving every command adds exactly ONE window key, and it is a DATA value', () => {
    const { w, calls } = freshWindow();
    const before = new Set(Object.keys(w));
    const c = createBookingControl(w, w.document);

    c.apply('set_call_id', { call_id: 'call_probe' });
    c.apply('booking_prefill', { name: 'A', email: 'b@c.invalid', phone: '1', notes: 'n' });
    c.apply('booking_select_type', 'consult-30');
    c.apply('booking_show_date', { day: '2026-08-03' });
    c.apply('booking_select_slot', { day: '2026-08-03', time: '10:00 AM' });

    assert.equal(calls.length, 4, 'precondition: the commands really did reach the widget');

    const added = Object.keys(w).filter((k) => !before.has(k));
    assert.deepEqual(added, ['__perchCallId'],
      `only the call-id data value may appear on window; got ${JSON.stringify(added)}`);
    assert.equal(typeof w.__perchCallId, 'string',
      'and it must be a STRING — a function here would be a control surface');
  });

  test('the adapter\'s control surface is reachable ONLY through the returned object', () => {
    const { w } = freshWindow();
    const c = createBookingControl(w, w.document);
    assert.deepEqual(Object.keys(c).sort(), ['apply', 'handles', 'probe', 'revealGate']);
    // None of them is findable from the window a hostile script would hold.
    for (const name of ['apply', 'handles', 'revealGate', 'createBookingControl', 'bookingControl']) {
      assert.equal(w[name], undefined, `window.${name} must not exist`);
    }
  });

  test('probe() is read-only — it hands back no way to drive the widget', () => {
    const { w } = freshWindow();
    const p = createBookingControl(w, w.document).probe();
    for (const [k, v] of Object.entries(p)) {
      assert.notEqual(typeof v, 'function', `probe().${k} is a function — that is a control surface`);
    }
  });

  test('MUTATION BITE — a control function put on window is caught', () => {
    const { w } = freshWindow();
    const before = new Set(Object.keys(w));
    const c = createBookingControl(w, w.document);
    w.__perchApply = c.apply;                        // the regression this guards
    const added = Object.keys(w).filter((k) => !before.has(k));
    assert.ok(added.includes('__perchApply'), 'the enumeration must see a leaked function');
    assert.equal(typeof w.__perchApply, 'function');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. A3.3 — the WHOLE window surface the router path publishes, enumerated
// ─────────────────────────────────────────────────────────────────────────────
//
// The runtime check above covers the one module CI can import cleanly; the layer
// and the router are browser ESM with absolute `/js/...` specifiers that no jsdom
// eval can resolve. So the rest of the path is enumerated from source — every
// `window.X =` / `globalThis.X =` assignment on the discovered module set — and
// held against a REVIEWED table. test/preview/verify-a41.mjs §T4 then reads the
// live window on Preview and asserts the same table, which is the half a source
// scan cannot give.
//
// ── WHAT THE RE-RUN CHANGES (A4.1-RERUN, #58 now merged as 645e37e) ───────────
// The A4.1 gate on PR #80 pinned this section to the OPEN state: two namespaces
// carrying six control functions, with the assertions written so that closing #58
// would turn them red. #58 closed. Every one of those pins is now inverted to the
// CLOSED state, and the inversion is not cosmetic — the pins asserted the presence
// of `setRouter` et al, so a re-run that merely deleted them would prove nothing.
// Each is replaced by the negative it was standing in for, plus the property-
// descriptor checks that are the actual acceptance ("not exposed" AND "not
// replaceable" are different claims, and only the second needs a descriptor).
//
// ── AND §T4.3b IS NEW, BECAUSE A SOURCE SCAN CANNOT REACH THE CLAIM ───────────
// #58's guarantee is about property DESCRIPTORS and a module-private slot. No
// grep proves `window.Perch = x` throws, and no grep proves the second router
// registration keeps the first one running. js/perch/surface.js has ZERO imports
// — unlike the layer and the router it is plain, resolvable ESM — so §T4.3b drives
// the real module against a real JSDOM window and asserts the behaviour itself.
// That is the difference between reading the fix and exercising it; see
// [[feedback_assert_behavior_not_source_spelling]].
describe('§T4.3 — every window global the router path publishes is named and classified', () => {
  /**
   * Every `window.FOO =` / `globalThis.FOO =` / `win.FOO =` target in executable
   * text.
   *
   * `win` is in the alias list because js/perch/booking-control.js takes the live
   * window as a PARAMETER named `win` — that is how it stays drivable from a
   * jsdom test — and `win.__perchCallId = …` at :175 is a genuine global
   * assignment that a `window\.`-only regex cannot see. Missing it would let the
   * one data global the adapter writes go unreviewed, which is exactly the class
   * of blindness this table exists to prevent.
   */
  function globalsIn(mod) {
    const src = code(read(mod));
    const names = new Set();
    for (const m of src.matchAll(/\b(?:window|globalThis|win)\.([A-Za-z_$][\w$]*)\s*=(?!=)/g)) names.add(m[1]);
    return [...names].sort();
  }

  /**
   * The reviewed table. `kind` is the claim being made about each entry:
   *   'diagnostic' — a namespace holding read-only probes; no way to drive anything
   *   'data'       — a value, not a function
   *   'control'    — a function that DRIVES something. Under #58 this column must
   *                  be empty. It is not. See the A3.3 GAP test below.
   */
  const REVIEWED = {
    // A4.1 gate → A4.1 re-run. This row used to read 'control', because
    // perch-layer.js published the layer INSTANCE whole and that instance carried
    // setRouter. #58 replaced the publication with a four-key frozen literal and
    // moved the property itself behind defineProperty, so the row is now
    // 'diagnostic' — and unlike the old one, that claim is CHECKED rather than
    // asserted: §T4.3b drives surface.js and proves the descriptor.
    Perch: { kind: 'diagnostic', why: 'defineProperty slot; Perch.router = {probe}, Perch.layer = {probe,bookingProbe,attach/detachLiveResource} (perch-layer.js:319)' },
    __perchCallId: { kind: 'data', why: 'the live call id the widget reads at submit (booking-control.js:175)' },
    // SHELDON-QUALIFIER-JOIN-COMPOSE-R1. A constant string — the four characters
    // `none` — set by perch-layer.js when the visitor abandoned the qualifier card,
    // and read by booking-widget.js beside __perchCallId at submit time. 'data' is
    // the honest classification and it is a WEAKER exposure than the row above it:
    // that one is a bearer capability for the bridge, this one names no record,
    // carries no answer and authenticates nothing. Its only effect on the server is
    // to make booking/create.js withhold enrichment, so a page script that reads or
    // forges it gains nothing it could not get by clearing its own cookies.
    __perchQualifierClaim: { kind: 'data', why: 'the claims-nothing marker the widget reads at submit (perch-layer.js applyQualifierClaim)' },
    __perch: { kind: 'diagnostic', why: 'reduced to {probe} by #58; openQualifier/closeQualifier withdrawn (qualifier.js:242)' },
  };

  /**
   * The layer-instance members #58 withdrew from the published surface.
   *
   * `attachLiveResource` / `detachLiveResource` are deliberately NOT here: they
   * survive on the public surface by design, because test/preview/verify-a22.mjs
   * parks a live AudioContext clock through them and that IS the A22 acceptance
   * proof. They mutate a diagnostics Map nothing but probe() reads. The four below
   * are the ones that drove navigation, handed out live nodes, or built a second
   * orb.
   */
  const WITHDRAWN_MUTATORS = ['setRouter', 'mountShellConcierge', 'root', 'container'];

  /** What `Perch.layer` is allowed to carry after #58. */
  const ALLOWED_LAYER_KEYS = ['attachLiveResource', 'bookingProbe', 'detachLiveResource', 'probe'];

  test('the sweep finds globals at all (non-vacuity)', () => {
    // After #58 there is exactly ONE bare `window.X =` left on the whole router
    // path — the call-id data value. `Perch` and `__perch` are no longer ASSIGNED
    // at all; they are installed with defineProperty from surface.js, which is the
    // fix. So this sweep is now near-empty by design, and the non-vacuity it has
    // to prove moved: the scan still resolves a real module set (§0) and the
    // descriptor behaviour is proved live in §T4.3b.
    //
    // COMPOSE-R1 added the second entry: the claims-nothing marker, which has to be
    // on the window because that is where js/booking-widget.js composes its POST
    // from. Both are data values read at submit time and neither drives anything.
    // The list stays EXHAUSTIVE and sorted rather than becoming a floor — the point
    // of this assertion is that a third one cannot appear unnoticed.
    const all = ROUTER_PATH_MODULES.flatMap(globalsIn).sort();
    assert.deepEqual(all, ['__perchCallId', '__perchQualifierClaim'],
      `the only direct window assignments on the path are the two submit-time data values; got ${JSON.stringify(all)}`);
  });

  test('NO UNREVIEWED GLOBAL: every window.* the path assigns is in the table', () => {
    const unreviewed = [];
    for (const mod of ROUTER_PATH_MODULES) {
      for (const name of globalsIn(mod)) {
        if (!REVIEWED[name]) unreviewed.push(`${mod} → window.${name}`);
      }
    }
    assert.deepEqual(unreviewed, [],
      'a new window global appeared on the router path and nobody classified it:\n' + unreviewed.join('\n'));
  });

  test('the table names no global the code does not actually install (no dead entries)', () => {
    // "Install", not "assign": after #58 `Perch` and `__perch` arrive through
    // surface.js's defineProperty rather than an assignment, so the old
    // assignment-only derivation would call both rows dead and pass vacuously.
    // The surface module names them, so that is what this reads.
    const assigned = new Set(ROUTER_PATH_MODULES.flatMap(globalsIn));
    const surfaceSrc = code(read('js/perch/surface.js'));
    const qualSrc = code(read('js/perch/qualifier.js'));
    const installed = new Set([
      ...assigned,
      ...(/NAMESPACE = 'Perch'/.test(surfaceSrc) ? ['Perch'] : []),
      ...(/lockGlobal\(\s*[\w.]+,\s*'__perch'/.test(qualSrc) ? ['__perch'] : []),
    ]);
    const dead = Object.keys(REVIEWED).filter((k) => !installed.has(k));
    assert.deepEqual(dead, [], `the table describes globals that no longer exist: ${dead}`);
  });

  test('Perch.router really does publish a probe and nothing else', () => {
    // The router's own header says "the control functions — navigate, adopt, the
    // recipe — stay in this closure". Held across #58, which changed HOW the
    // router publishes (publish(win,'router',…)) but not WHAT.
    const routerSrc = code(read('js/perch-swup-router.js'));
    const at = routerSrc.search(/publish\(\s*window\s*,\s*'router'/);
    assert.ok(at > -1, 'precondition: the router publishes through the surface module');
    const published = routerSrc.slice(at, at + 400);
    assert.match(published, /\{\s*probe:/, 'Perch.router publishes probe');
    for (const forbidden of ['navigate', 'adopt', 'reinit', 'swap']) {
      assert.doesNotMatch(published, new RegExp(`\\b${forbidden}\\s*:`),
        `Perch.router must not publish ${forbidden}`);
    }
  });

  test('the host driver drive() is NOT published — that part of the seam is closured', () => {
    const layerSrc = code(read('js/perch-layer.js'));
    assert.match(layerSrc, /publish\(window, 'layer', publicSurface\)/,
      'the layer publishes a named surface, not the instance');
    assert.doesNotMatch(layerSrc, /publicSurface = \{[\s\S]{0,400}?drive\s*:/, 'drive() must not be published');
  });

  test('CLOSED (#58) — the layer publishes a four-key surface, NOT the instance', () => {
    // The inversion of the old "THE A3.3 GAP" pin. That test asserted the four
    // mutators were PRESENT on the published object; this asserts the publication
    // is a distinct literal that carries none of them.
    const layerSrc = code(read('js/perch-layer.js'));
    const at = layerSrc.indexOf('publicSurface = {');
    assert.ok(at > -1, 'precondition: the published surface literal was located');
    const literal = layerSrc.slice(at, layerSrc.indexOf('};', at));

    assert.doesNotMatch(layerSrc, /window\.Perch = Object\.assign/,
      'the instance-publishing assignment that WAS the finding must be gone entirely');

    const keys = [...literal.matchAll(/^\s{4}(\w+):/gm)].map((m) => m[1]).sort();
    assert.deepEqual(keys, ALLOWED_LAYER_KEYS,
      `Perch.layer must carry exactly the four reviewed keys; got ${JSON.stringify(keys)}`);

    for (const m of WITHDRAWN_MUTATORS) {
      assert.doesNotMatch(literal, new RegExp(`\\b${m}\\b`),
        `${m} is still on the published layer surface — #58 withdrew it`);
    }
  });

  test('CLOSED (#58) — setRouter is gone from the tree, not merely unpublished', () => {
    // The acceptance line is "setRouter is gone". Unpublishing it would leave the
    // handle one dynamic import() away, so this is checked across the WHOLE router
    // path rather than at the publication site — and against executable text, since
    // several of these files discuss the removal in prose.
    for (const mod of ROUTER_PATH_MODULES) {
      assert.doesNotMatch(code(read(mod)), /\bsetRouter\b/,
        `${mod} still defines or calls setRouter`);
    }
  });

  test('CLOSED (#58) — __perch is reduced to a probe; openQualifier/closeQualifier withdrawn', () => {
    const qual = code(read('js/perch/qualifier.js'));
    assert.doesNotMatch(qual, /window\.__perch = Object\.assign/,
      'the Object.assign publication that WAS the finding must be gone');
    assert.match(qual, /lockGlobal\(\s*[\w.]+,\s*'__perch',\s*\{\s*probe/,
      '__perch must now be locked with defineProperty and carry probe only');
    assert.doesNotMatch(qual, /\{[^{}]*\bopenQualifier\b[^{}]*\}\s*\)/,
      'openQualifier must not appear in any published object literal');
  });

  test('THE HEADLINE COUNT — zero namespaces on the router path carry a control function', () => {
    // PR #80 reported TWO. This is the same computation, re-run, and it is the
    // number the re-run sign-off quotes. If it moves off zero the sign-off is stale.
    const controls = Object.entries(REVIEWED).filter(([, v]) => v.kind === 'control').map(([k]) => k).sort();
    assert.deepEqual(controls, [],
      'every namespace the router path publishes must now be diagnostic or data');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3b. #58 EXERCISED — descriptors and the private navigation slot, at runtime
// ─────────────────────────────────────────────────────────────────────────────
//
// Everything above reads source. "Not replaceable" is a claim about property
// descriptors and "the first router keeps running" is a claim about a module
// -private variable; neither is visible to a grep, and both are the actual
// acceptance. js/perch/surface.js imports nothing, so it loads in plain Node and
// can be driven against a JSDOM window — which is what this section does.
//
// FRESH MODULE PER TEST. `router` and `refusedRegistrations` are module-level, so
// one registration would leak into every later test and the second-registration
// case would pass for the wrong reason. Each test imports its own instance with a
// cache-busting query, which is the only way to get a clean slot per case.
describe('§T4.3b — the exposure boundary, exercised (not grepped)', () => {
  const SURFACE_URL = new URL('../donovan-legal-site/js/perch/surface.js', import.meta.url);
  let freshCount = 0;
  /** A module instance nobody else has registered against. */
  const freshSurface = () => import(`${SURFACE_URL.href}?a41rerun=${++freshCount}`);
  const freshWin = () => new JSDOM('<!doctype html><body></body>').window;

  test('claim() installs Perch non-writable and non-configurable', async () => {
    const S = await freshSurface();
    const w = freshWin();
    assert.equal(S.claim(w).ok, true);

    const d = Object.getOwnPropertyDescriptor(w, 'Perch');
    assert.equal(d.writable, false, 'window.Perch must not be writable');
    assert.equal(d.configurable, false, 'window.Perch must not be configurable');
  });

  test('window.Perch cannot be REASSIGNED or deleted', async () => {
    const S = await freshSurface();
    const w = freshWin();
    S.claim(w);
    const original = w.Perch;

    assert.throws(() => { w.Perch = { layer: 'hijacked' }; }, TypeError,
      'reassigning the namespace must throw, not silently no-op');
    assert.throws(() => { delete w.Perch; }, TypeError, 'deleting the namespace must throw');
    assert.throws(() => Object.defineProperty(w, 'Perch', { value: {} }), TypeError,
      'redefining the namespace must throw');
    assert.equal(w.Perch, original, 'and the original namespace object still stands');
  });

  test('a published SLOT cannot be swapped, redefined, or added to', async () => {
    const S = await freshSurface();
    const w = freshWin();
    S.claim(w);
    const surface = { probe: () => 'real' };
    assert.equal(S.publish(w, 'layer', surface).ok, true);

    assert.throws(() => { w.Perch.layer = { probe: () => 'hijacked' }; }, TypeError,
      'the slot is a getter with no setter — assignment must throw');
    assert.throws(() => Object.defineProperty(w.Perch, 'layer', { value: 'x' }), TypeError,
      'the slot is non-configurable — redefinition must throw');
    assert.throws(() => { w.Perch.evil = () => {}; }, TypeError,
      'the namespace is preventExtensions\'d — a new slot must throw');

    assert.equal(w.Perch.layer.probe(), 'real', 'the genuine surface is still the one that answers');
  });

  test('the published surface is frozen — its methods cannot be swapped either', async () => {
    const S = await freshSurface();
    const w = freshWin();
    S.claim(w);
    S.publish(w, 'layer', { probe: () => 'real' });

    assert.equal(Object.isFrozen(w.Perch.layer), true);
    assert.throws(() => { w.Perch.layer.probe = () => 'hijacked'; }, TypeError,
      'freezing the slot value is the second half of the fix — see '
      + '[[feedback_freezing_the_value_is_not_owning_the_property]]');
  });

  test('publish() is one-writer-once, and deny-by-default on slot names', async () => {
    const S = await freshSurface();
    const w = freshWin();
    S.claim(w);
    assert.equal(S.publish(w, 'layer', { probe: () => 'first' }).ok, true);

    const second = S.publish(w, 'layer', { probe: () => 'second' });
    assert.equal(second.ok, false, 're-publication is how a replacement would get in');
    assert.match(second.reason, /already published/);
    assert.equal(w.Perch.layer.probe(), 'first', 'the first surface is still the live one');

    assert.equal(S.publish(w, 'evil', { probe() {} }).ok, false, 'unknown slots are refused');
  });

  test('claim() is FAIL-CLOSED against a namespace someone else seeded', async () => {
    const S = await freshSurface();
    const w = freshWin();
    // The capture attack the module header describes: seed Perch with a setter and
    // wait for the layer to publish into it.
    let captured = null;
    Object.defineProperty(w, 'Perch', {
      configurable: true,
      get: () => ({}),
      set: (v) => { captured = v; },
    });

    const res = S.claim(w);
    assert.equal(res.ok, false, 'we must NOT adopt a namespace we did not author');
    assert.match(res.reason, /already exists/);
    assert.equal(S.publish(w, 'layer', { probe() {} }).ok, false, 'and nothing is published into it');
    assert.equal(captured, null, 'the attacker\'s setter never receives our surface');
  });

  test('lockGlobal() refuses to adopt an existing __perch', async () => {
    const S = await freshSurface();
    const w = freshWin();
    w.__perch = { openQualifier: () => 'attacker' };
    assert.equal(S.lockGlobal(w, '__perch', { probe: () => 'ours' }).ok, false);
  });

  test('THE NAVIGATION SLOT: a second registration is REFUSED and the first keeps running',
    async () => {
      const S = await freshSurface();
      const nav = [];
      const original = (href) => nav.push(['original', href]);
      const hostile = (href) => nav.push(['hostile', href]);

      assert.equal(S.registerRouter(original).ok, true, 'A2.2 registers first at boot');
      assert.equal(S.hasRouter(), true);

      const second = S.registerRouter(hostile);
      assert.equal(second.ok, false, 'the second registration must be refused');
      assert.match(second.reason, /already registered/);

      // The claim is not "the second call returned an error" — it is "the ORIGINAL
      // is still the function navigation runs through". Only a real navigation
      // proves that.
      assert.equal(S.navigateVia('/services'), true);
      assert.deepEqual(nav, [['original', '/services']],
        'the original router handled it and the hostile one was never called');

      assert.equal(S.routerLock().refused, 1,
        'and the attempt is COUNTED — bookingProbe() surfaces this on a live page');
    });

  test('the registered router is never handed back out', async () => {
    const S = await freshSurface();
    const fn = () => {};
    S.registerRouter(fn);
    // Nothing exported returns it: routerLock reports booleans and counts only.
    const lock = S.routerLock();
    for (const [k, v] of Object.entries(lock)) {
      assert.notEqual(typeof v, 'function', `routerLock().${k} hands back a function`);
    }
    assert.deepEqual(Object.keys(lock).sort(), ['refused', 'registered', 'waiting']);
    for (const [name, exported] of Object.entries(S)) {
      if (typeof exported !== 'function') continue;
      assert.notEqual(exported, fn, `export ${name} IS the registered router`);
    }
  });

  test('a non-function registration is refused and counted, leaving the slot open', async () => {
    const S = await freshSurface();
    assert.equal(S.registerRouter('/not-a-function').ok, false);
    assert.equal(S.hasRouter(), false, 'a refused garbage registration must not occupy the slot');
    assert.equal(S.routerLock().refused, 1);
    assert.equal(S.navigateVia('/x'), false, 'and navigateVia reports "fall back to a hard nav"');
  });

  test('SLOTS is deny-by-default and frozen', async () => {
    const S = await freshSurface();
    assert.deepEqual([...S.SLOTS], ['layer', 'router']);
    assert.equal(Object.isFrozen(S.SLOTS), true,
      'a new surface must be added in a diff a reviewer reads, not at runtime');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. The blast radius the rewire must not widen
// ─────────────────────────────────────────────────────────────────────────────
describe('§T4.4 — the rewire widens nothing it was told not to touch', () => {
  test('no module on the path references the CSP, tier auth or the write endpoint', () => {
    // Strings blanked: swap-policy.js EXPLAINS in a `why:` literal that denying
    // Turnstile would make /booking/create reject every booking. Reasoning about
    // the write path is not touching it.
    for (const mod of ROUTER_PATH_MODULES) {
      const src = codeNoStrings(read(mod));
      assert.doesNotMatch(src, /Content-Security-Policy/i, `${mod} touches the CSP`);
      assert.doesNotMatch(src, /booking\/create/, `${mod} references the booking WRITE path`);
      assert.doesNotMatch(src, /tier-auth|Authorization/i, `${mod} touches tier auth`);
    }
  });

  test('the adapter still names no submit-shaped method (A31 §4, re-held on the cutover)', () => {
    const src = code(read(ADAPTER));
    for (const m of ['submit', 'confirm', 'book', 'create']) {
      assert.doesNotMatch(src, new RegExp(`surface\\.${m}\\b|DLBooking\\.${m}\\b`),
        `the adapter must never call DLBooking.${m}`);
    }
  });

  test('the origin gate on the prefill ack is still the page\'s own origin', () => {
    const src = code(read(ADAPTER));
    assert.match(src, /win\.postMessage\(\s*\{ __perchBookingAck: true, action: 'prefill' \}, win\.location\.origin\)/,
      'the ack must be posted to this origin only — a "*" target would broadcast to any embedder');
    assert.doesNotMatch(src, /postMessage\([^)]*,\s*['"]\*['"]\)/, 'no wildcard postMessage target anywhere');
  });
});
