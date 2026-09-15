// ── JORDAN-PERCH-NATIVE-BOOK — a completed qualifier opens the calendar ──────
//
// Order JORDAN-PERCH-NATIVE-BOOK · the last leg of the qualifier→booking flow.
//
// ── THE SYMPTOM, AND WHY IT WAS INVISIBLE ────────────────────────────────────
// `mountQualifier`'s done state has always said "Paula has it. She'll pull up the
// calendar so you can pick a time." Nothing pulled it up. The lead POSTed, the
// card auto-closed after 6.5 s, and the caller was left on whatever content page
// they happened to be on — the calendar appeared only if Paula separately issued
// `goto_booking`, which on a live call she often did not. Every log line read
// clean: the POST succeeded, the done state rendered, no error anywhere. The
// defect was a MISSING call, and a missing call leaves no trace.
//
// The route itself was already complete and is not re-built here: the navigate
// branch of js/perch/command-channel.js writes `donovan_booking_unlock` and soft-
// swaps through `host.go`, js/page/booking-gate.js reveals `#book-live`, and
// js/perch/booking-control.js drives `window.DLBooking` on the page. What this
// ticket adds is the trigger, and what these tests hold is the trigger's three
// obligations: it fires once, it converges with Paula rather than racing her, and
// it does not widen a single boundary on the way.
//
// §1  the trigger      — onQualified fires once, normalized, with the card intact
// §2  the mapping      — answers → the four fields DLBooking already accepts
// §3  the convergence  — one navigate and one prefill, whoever arrives second
// §4  the real layer   — the shipped js/perch-layer.js, tapped through end to end
// §5  the boundaries   — no writable global, no _top, no submit, no hard nav
//
// Every section drives the SHIPPED functions. Nothing here re-declares a mapping
// or a policy the product owns; see [[feedback_assert_behavior_not_source_spelling]].

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import {
  mountQualifier, bookingPrefillFrom, NOTE_ANSWER_KEYS, NOTE_MAX, SOURCE_MAX,
} from '../donovan-legal-site/js/perch/qualifier.js';
import {
  createCommandChannel, BOOK_PATH, BOOK_COALESCE_MS, isBookTarget, mergePrefill, PREFILL_TRIES,
} from '../donovan-legal-site/js/perch/command-channel.js';
import { FORBIDDEN_METHODS, COMMAND_MAP } from '../donovan-legal-site/js/perch/booking-control.js';
import { CONTAINER_ID, LAYER_ID } from '../donovan-legal-site/js/perch/placement.js';
import { registerRouter } from '../donovan-legal-site/js/perch/surface.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE_DIR = path.join(HERE, '..', 'donovan-legal-site');
const SITE = new URL('../donovan-legal-site/', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, SITE)), 'utf8');

/** Source with comments stripped — a guard must not be satisfied by prose. */
const code = (p) => read(p).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

/** The three files this ticket touches. */
const TOUCHED = ['js/perch/qualifier.js', 'js/perch/command-channel.js', 'js/perch-layer.js'];

// ─────────────────────────────────────────────────────────────────────────────
// Harnesses
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A host that records instead of driving. Same shape as the one
 * test/perch-command-channel.test.mjs uses — `win` is the channel's own third
 * parameter, not a test-only fork.
 */
function harness() {
  const drives = [];
  const gos = [];
  const afterNavigateCbs = [];
  const store = {};

  const host = {
    drive: (cmd, target, payload) => drives.push({ cmd, target, payload }),
    go: (href) => gos.push(href),
    afterNavigate: (cb) => afterNavigateCbs.push(cb),
    onContentReady: () => {},
  };
  const win = {
    location: { origin: 'https://www.donovan.law', href: 'https://www.donovan.law/contact' },
    localStorage: { setItem: (k, v) => { store[k] = String(v); }, getItem: (k) => (k in store ? store[k] : null) },
    addEventListener: () => {},
    fetch: async () => ({ ok: true, json: async () => ({}) }),
  };
  return { host, win, drives, gos, store, afterNavigateCbs };
}

/** The real qualifier card, mounted into a real document. */
function qualPage({ callId = 'call_nb', onQualified } = {}) {
  const dom = new JSDOM('<!doctype html><body><div id="host"></div></body>', {
    url: 'https://www.donovan.law/contact.html',
  });
  const win = dom.window;
  const posts = [];
  win.fetch = async (url, init) => { posts.push({ url, init }); return { ok: true, json: async () => ({ ok: true }) }; };
  const savedFetch = globalThis.fetch;
  globalThis.fetch = win.fetch;
  const savedLoc = Object.getOwnPropertyDescriptor(globalThis, 'location');
  Object.defineProperty(globalThis, 'location', { value: win.location, configurable: true });
  const ctx = { callId: () => callId };
  if (onQualified) ctx.onQualified = onQualified;
  const q = mountQualifier(win.document.getElementById('host'), ctx);
  return {
    win, q, posts,
    /** Tap one option on the step currently rendered. */
    tap(v) {
      const doc = win.document;
      const b = [...doc.querySelectorAll('#qual-bd .opt')].find((x) => x.dataset && x.dataset.v === v);
      assert.ok(b, `no option "${v}" on step "${doc.querySelector('#qual-bd h2').textContent}"`);
      b.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    },
    /** The `select` step is a <select> plus a Continue button. */
    selectState(v) {
      const doc = win.document;
      doc.querySelector('#q-sel').value = v;
      doc.querySelector('#q-cont').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    },
    close() {
      globalThis.fetch = savedFetch;
      if (savedLoc) Object.defineProperty(globalThis, 'location', savedLoc);
      else delete globalThis.location;
      dom.window.close();
    },
  };
}

/** The full domestic real-estate tap-through, in the order the card asks. */
function tapThroughRE(p) {
  p.q.openQualifier('en', 'google');
  p.tap('real_estate');
  p.tap('acquisition');
  p.tap('party');            // 2026-09-06: "Who are you in this matter?" sits after the matter
  p.selectState('FL');
  p.tap('yourself');
  p.tap('1_5m_3m');
  p.tap('5m_15m');
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 · The trigger
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 — a completed card hands its answers to the host, exactly once', () => {
  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  test('with onQualified, it fires once — after the lead POST, with the card already done', () => {
    const seen = [];
    let doneTextAtCallback = null;
    const p = qualPage({
      callId: 'call_nb1',
      onQualified: (a) => {
        seen.push(a);
        doneTextAtCallback = p.win.document.getElementById('qual-bd').textContent;
      },
    });
    try {
      tapThroughRE(p);

      assert.equal(seen.length, 1, 'one completed card is one trigger — a second navigate is a second swap');
      assert.equal(p.posts.length, 1, 'and the lead POST still happens exactly once');
      assert.equal(p.posts[0].url, '/fn/qualifier_submit');
      // Ordering, measured rather than asserted from the source: the done state is
      // on screen BEFORE the host is asked to navigate, so nothing the host does
      // can affect what the caller reads.
      assert.match(doneTextAtCallback, /Got it\./,
        'the trigger must fire after the done state is painted, not instead of it');
    } finally { p.close(); }
  });

  test('the payload is the answers, normalized — same field set the lead POST carries', () => {
    const seen = [];
    const p = qualPage({ callId: 'call_nb2', onQualified: (a) => seen.push(a) });
    try {
      tapThroughRE(p);
      const a = seen[0];
      const body = JSON.parse(p.posts[0].init.body);

      assert.equal(a.matter_category, 'real_estate');
      assert.equal(a.matter_sub, 'acquisition');
      assert.equal(a.matter, 'real_estate');
      assert.equal(a.state, 'FL');
      assert.equal(a.for_whom, 'yourself');
      assert.equal(a.income_band, '1_5m_3m');
      assert.equal(a.net_worth_band, '5m_15m');
      assert.equal(a.language, 'en');
      assert.equal(a.source, 'google');
      assert.equal(a.call_id, 'call_nb2');
      assert.equal(a.kind, 'done', 'a real-estate matter goes straight to a time slot');

      // The two shapes must not drift: every answer the backend receives is also
      // in the callback, spelled the same way.
      assert.equal(a.role, 'party', '2026-09-06: the role step rides in the callback too');
      for (const k of ['matter_category', 'matter_sub', 'role', 'state', 'for_whom', 'income_band',
        'net_worth_band', 'language', 'source', 'call_id']) {
        assert.equal(a[k], body[k], `${k} differs between the lead POST and the callback`);
      }
      // Absent answers are null, not missing — the host reads keys, not `in`.
      assert.equal(Object.prototype.hasOwnProperty.call(a, 'matter_sub'), true);
    } finally { p.close(); }
  });

  test('a tax matter reports the tax done-state, and its own sub-answer', () => {
    const seen = [];
    const p = qualPage({ callId: 'call_nb3', onQualified: (a) => seen.push(a) });
    try {
      p.q.openQualifier('es', 'referral');
      p.tap('tax');
      p.tap('controversy');
      p.tap('notice');         // the role step, in Spanish
      p.selectState('outside_us');
      p.tap('business');
      p.tap('above_3m');
      p.tap('above_15m');

      assert.equal(seen.length, 1);
      assert.equal(seen[0].kind, 'tax', 'tax routes to an orientation call — a different done message');
      assert.equal(seen[0].matter_sub, 'controversy');
      assert.equal(seen[0].language, 'es');
      assert.match(p.win.document.getElementById('qual-bd').textContent, /Listo/,
        'and the Spanish done copy is unchanged');
    } finally { p.close(); }
  });

  test('a host callback that throws cannot break the card or the lead POST', () => {
    const p = qualPage({ onQualified: () => { throw new Error('host exploded'); } });
    const savedErr = console.error;
    console.error = () => {};
    try {
      tapThroughRE(p);
      assert.equal(p.posts.length, 1, 'the lead is already sent by then and must stay sent');
      assert.match(p.win.document.getElementById('qual-bd').textContent, /Got it\./,
        'the caller must not be shown a broken card because the swap failed');
    } finally { console.error = savedErr; p.close(); }
  });

  test('with no live call the payload still arrives, call_id null', () => {
    // Not hypothetical: this is the `?qualifier=1` route the Preview verifier
    // drives, and it is also a caller who completes the card after Paula has hung
    // up. The auto-advance must still take them to the calendar.
    const seen = [];
    const p = qualPage({ callId: null, onQualified: (a) => seen.push(a) });
    try {
      tapThroughRE(p);
      assert.equal(seen.length, 1);
      assert.equal(seen[0].call_id, null);
      assert.equal(seen[0].matter_category, 'real_estate', 'and every other answer is intact');
    } finally { p.close(); }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · The mapping — Task 4
// ─────────────────────────────────────────────────────────────────────────────

describe('§2 — answers map onto the fields DLBooking already accepts, and no others', () => {
  const FULL = {
    kind: 'done',
    matter: 'real_estate',
    matter_category: 'real_estate',
    matter_sub: 'acquisition',
    state: 'FL',
    for_whom: 'yourself',
    income_band: '1_5m_3m',
    net_worth_band: '5m_15m',
    language: 'en',
    source: 'a referral from my CPA',
    call_id: 'call_secret_credential',
  };

  test('the only key produced is `notes` — the widget accepts four and the card collects one', () => {
    const out = bookingPrefillFrom(FULL);
    assert.deepEqual(Object.keys(out), ['notes'],
      'name/email/phone are typed by the CALLER; inventing a field for the rest is what this must not do');
    // The four the widget will apply, read from the widget itself.
    const widget = read('js/booking-widget.js');
    for (const f of ['name', 'email', 'phone', 'notes']) {
      assert.match(widget, new RegExp('fields\\.' + f + '\\s*!==\\s*undefined'),
        `precondition: DLBooking.prefill still accepts ${f}`);
    }
    assert.ok(['name', 'email', 'phone', 'notes'].includes(Object.keys(out)[0]));
  });

  test('the note reads as words the caller tapped, matter first', () => {
    const { notes } = bookingPrefillFrom(FULL);
    assert.match(notes, /^Matter: Real estate — Acquisition \(buying\)/,
      'matter leads, because it is the segment that must survive a clamp');
    assert.match(notes, /For: Yourself \(personal\)/);
    assert.match(notes, /State: Florida/);
    assert.match(notes, /Heard via: a referral from my CPA/);
  });

  test('THE ALLOW-LIST: the money bands never reach the note, and neither does the call id', () => {
    const { notes } = bookingPrefillFrom(FULL);
    // The bands by VALUE and by LABEL — a leak renamed on the way through is still
    // a leak ([[project_donovan_pii_minimize]] value-scan).
    for (const needle of ['1_5m_3m', '5m_15m', '$1.5M', '$3M', '$2M', '$5M', '$15M', 'income', 'net worth']) {
      assert.equal(notes.toLowerCase().includes(needle.toLowerCase()), false,
        `"${needle}" reached a caller-visible textarea that rides into the Clio calendar description`);
    }
    assert.equal(notes.includes('call_secret_credential'), false,
      'the call id is the bridge bearer credential — it must never land in a form field');
    assert.equal(NOTE_ANSWER_KEYS.includes('income_band'), false);
    assert.equal(NOTE_ANSWER_KEYS.includes('net_worth_band'), false);
    assert.equal(NOTE_ANSWER_KEYS.includes('call_id'), false);
  });

  test('the allow-list is the actual filter, not a comment — a key off it has no path in', () => {
    // The non-vacuity control: drop `state` from the list and the state segment
    // must disappear. If the composition read `answers` directly this passes
    // anyway and the list would be decorative.
    const withState = bookingPrefillFrom(FULL).notes;
    assert.match(withState, /State: Florida/);

    const src = code('js/perch/qualifier.js');
    assert.match(src, /for \(const k of NOTE_ANSWER_KEYS\)/,
      'the composition must copy through the list before it reads anything');
    assert.doesNotMatch(src.split('export function bookingPrefillFrom')[1].split('\n}')[0],
      /answers\.(income_band|net_worth_band|call_id)/,
      'and must never read an off-list key by name');
  });

  test('Spanish answers produce a Spanish note', () => {
    const { notes } = bookingPrefillFrom({ ...FULL, language: 'es', matter_category: 'tax', matter_sub: 'controversy' });
    assert.match(notes, /^Asunto: Impuestos — Controversia/);
    assert.match(notes, /Para: Usted \(personal\)/);
    assert.match(notes, /Estado: Florida/);
    assert.match(notes, /Nos conoció por:/);
  });

  test('unrecognised values are dropped, not printed', () => {
    const out = bookingPrefillFrom({
      language: 'en', matter_category: 'not_a_category', matter_sub: 'nope',
      for_whom: '<script>x</script>', state: 'ZZ', source: '',
    });
    assert.equal(out, null, 'nothing recognisable → nothing to prefill, and no half-sentence');
  });

  test('a state outside the U.S. is a real answer and reads as one', () => {
    const { notes } = bookingPrefillFrom({ language: 'en', matter_category: 'other', state: 'outside_us' });
    assert.match(notes, /State: Outside the U\.S\./);
  });

  test('free text is bounded exactly as sanitizeBookingArgs bounds it', () => {
    // This path never crosses /fn/do_page_action, so the server-side sanitiser
    // never runs on it. The bound is applied here or nowhere.
    const { notes } = bookingPrefillFrom({
      language: 'en', matter_category: 'tax', matter_sub: 'planning',
      source: 'x'.repeat(500) + ' drop',
    });
    assert.ok(notes.length <= NOTE_MAX, `note length ${notes.length} exceeds the ${NOTE_MAX} the wire accepts`);
    assert.doesNotMatch(notes, /[\x00-\x1F\x7F]/, 'control characters are stripped, as they are server-side');
    assert.match(notes, /^Asunto|^Matter: Tax — Planning/, 'and the matter still survives at the front');
    assert.ok(notes.indexOf('Heard via: ' + 'x'.repeat(SOURCE_MAX)) > 0);
    assert.equal(notes.includes('x'.repeat(SOURCE_MAX + 1)), false, 'source is clamped on its own first');
  });

  test('garbage in, null out — never a thrown host callback', () => {
    for (const bad of [null, undefined, '', 0, [], 'string']) {
      assert.equal(bookingPrefillFrom(bad), null, `bookingPrefillFrom(${JSON.stringify(bad)}) must be null`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · The convergence — Task 3
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 — the qualifier and Paula converge on one navigate and one prefill', () => {
  test('the auto-advance IS Paula\'s road: same target, same unlock, same batch shape', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);

    ch.advanceToBooking({ notes: 'Matter: Tax — Planning' });

    assert.deepEqual(h.gos, [BOOK_PATH], 'one soft navigation, through host.go');
    assert.ok(h.store.donovan_booking_unlock, 'the unlock flag booking-gate.js reads');
    assert.deepEqual(h.drives, [{ cmd: 'booking_prefill', target: null, payload: { notes: 'Matter: Tax — Planning' } }]);
    assert.equal(h.afterNavigateCbs.length, 1, 'and the prefill re-delivery hook the /book navigate always registers');

    const p = ch.probe();
    assert.equal(p.bookNavs, 1);
    assert.equal(p.autoAdvanced, true);
    ch.stop();
  });

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  test('a second auto-advance is refused, and says so in the log', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);

    ch.advanceToBooking({ notes: 'first' });
    ch.advanceToBooking({ notes: 'second' });
    ch.advanceToBooking(null);

    assert.deepEqual(h.gos, [BOOK_PATH], 'a re-opened card must not swap the page again');
    assert.equal(h.drives.filter((d) => d.cmd === 'booking_prefill').length, 1);
    const refusals = ch.probe().log.filter((e) => e.coalesced === 'already_advanced');
    assert.equal(refusals.length, 2, 'refusals are recorded, never silent');
    ch.stop();
  });

  test('PAULA FIRST: her goto_booking runs, the auto-advance adds only what she lacks', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);

    // Exactly the batch functions/fn/do_page_action.js coalesces her pair into.
    ch.dispatch({
      cmd: 'batch',
      actions: [
        { cmd: 'navigate', target: BOOK_PATH },
        { cmd: 'booking_prefill', payload: { name: 'Ada Lovelace', email: 'ada@example.test', notes: 'her note' } },
      ],
    });
    h.drives.length = 0;

    ch.advanceToBooking({ notes: 'the qualifier note' });

    assert.deepEqual(h.gos, [BOOK_PATH], 'ONE navigate: the second was coalesced away');
    assert.equal(ch.probe().bookNavs, 1);
    assert.deepEqual(h.drives, [], 'and nothing was re-driven, because she already holds every field');
    assert.deepEqual(ch.probe().prefillFields.sort(), ['email', 'name', 'notes'],
      'Paula is canonical — her notes survive the auto-advance');
    const coalesced = ch.probe().log.filter((e) => e.coalesced === 'book_nav_already_run');
    assert.equal(coalesced.length, 1);
    ch.stop();
  });

  test('QUALIFIER FIRST: Paula\'s later pair costs no second navigate and loses no field', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);

    ch.advanceToBooking({ notes: 'Matter: Real estate — Acquisition (buying)' });
    h.drives.length = 0;

    ch.dispatch({
      cmd: 'batch',
      actions: [
        { cmd: 'navigate', target: BOOK_PATH },
        { cmd: 'booking_prefill', payload: { name: 'Ada Lovelace', phone: '5615550100' } },
      ],
    });

    assert.deepEqual(h.gos, [BOOK_PATH], 'ONE navigate across both drivers');
    assert.equal(ch.probe().bookNavs, 1);
    // ONE prefill batch: the payload the widget is handed carries BOTH halves.
    const last = h.drives.filter((d) => d.cmd === 'booking_prefill').at(-1);
    assert.deepEqual(last.payload, {
      notes: 'Matter: Real estate — Acquisition (buying)',
      name: 'Ada Lovelace',
      phone: '5615550100',
    }, 'a replacing prefill would have dropped the qualifier note on the floor');
    ch.stop();
  });

  test('mergePrefill keeps what is pending and takes what is offered', () => {
    assert.deepEqual(mergePrefill({ name: 'Ada' }, { notes: 'n' }), { name: 'Ada', notes: 'n' });
    assert.deepEqual(mergePrefill({ name: 'Ada' }, { name: 'Grace' }), { name: 'Grace' },
      'a later non-empty value wins — that is what a correction is');
    assert.deepEqual(mergePrefill({ name: 'Ada' }, { name: '' }), { name: 'Ada' },
      'and an empty one is not a correction; the widget would ignore it anyway');
    assert.deepEqual(mergePrefill(null, { notes: 'n' }), { notes: 'n' });
    assert.deepEqual(mergePrefill({ notes: 'n' }, null), { notes: 'n' });
  });

  test('the widget ack clears the pending payload, so a later prefill starts clean', () => {
    // Regression guard on the merge: merging onto a payload the widget has already
    // taken would re-send fields the caller may have since edited.
    const listeners = [];
    const h = harness();
    h.win.addEventListener = (type, fn) => { if (type === 'message') listeners.push(fn); };
    const ch = createCommandChannel(h.host, {}, h.win);

    ch.dispatch({ cmd: 'booking_prefill', payload: { name: 'Ada' } });
    for (const fn of listeners) fn({ origin: h.win.location.origin, data: { __perchBookingAck: true, action: 'prefill' } });
    assert.equal(ch.probe().prefillPending, false);

    h.drives.length = 0;
    ch.dispatch({ cmd: 'booking_prefill', payload: { notes: 'later' } });
    assert.deepEqual(h.drives.at(-1).payload, { notes: 'later' }, 'no stale merge after an ack');
    ch.stop();
  });

  test('the coalescer is BOOK-SCOPED — an ordinary tour hop is never suppressed', () => {
    // The positive control. A blanket "one navigate per channel" latch would pass
    // every assertion above and break Paula's site tour.
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);

    ch.dispatch({ cmd: 'navigate', target: '/tax.html' });
    ch.dispatch({ cmd: 'navigate', target: '/tax.html' });
    ch.dispatch({ cmd: 'navigate', target: '/real-estate.html' });
    assert.deepEqual(h.gos, ['/tax.html', '/tax.html', '/real-estate.html']);
    assert.equal(ch.probe().bookNavs, 0, 'and none of them unlocked the calendar');
    assert.equal(h.store.donovan_booking_unlock, undefined);
    ch.stop();
  });

  test('the suppression is a WINDOW: a caller sent back to /book later still gets there', async (t) => {
    // The other half of the control. Without an expiry, a caller who wandered off
    // the calendar and asked to go back would be answered with nothing at all.
    t.mock.timers.enable({ apis: ['Date'], now: 1_000_000 });
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);
    try {
      ch.advanceToBooking({ notes: 'n' });
      ch.dispatch({ cmd: 'navigate', target: BOOK_PATH });
      assert.deepEqual(h.gos, [BOOK_PATH], 'inside the window: coalesced');

      t.mock.timers.tick(BOOK_COALESCE_MS + 1);
      ch.dispatch({ cmd: 'navigate', target: BOOK_PATH });
      assert.deepEqual(h.gos, [BOOK_PATH, BOOK_PATH], 'outside the window: a real navigation again');
      assert.equal(ch.probe().bookNavs, 2);
    } finally {
      ch.stop();
      t.mock.timers.reset();
    }
  });

  test('a coalesced navigate still lets its batch partner run', () => {
    // The failure this avoids: refusing the whole batch because its first member
    // was a duplicate would strand the prefill that came with it.
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);
    ch.advanceToBooking(null);
    h.drives.length = 0;

    ch.dispatch({
      cmd: 'batch',
      actions: [
        { cmd: 'navigate', target: BOOK_PATH },
        { cmd: 'booking_select_type', payload: 'consult-30' },
      ],
    });
    assert.deepEqual(h.drives, [{ cmd: 'booking_select_type', target: null, payload: 'consult-30' }]);
    ch.stop();
  });

  test('a tier page is still refused before anything else, auto-advance or not', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);
    ch.dispatch({ cmd: 'navigate', target: '/gold/' });
    assert.deepEqual(h.gos, [], 'SHELDON-PERCH-TIER-KEY-HANDOFF still holds');
    ch.advanceToBooking({ notes: 'n' });
    assert.deepEqual(h.gos, [BOOK_PATH]);
    ch.stop();
  });

  test('an auto-advance with nothing to prefill still opens the calendar', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);
    ch.advanceToBooking(null);
    assert.deepEqual(h.gos, [BOOK_PATH], 'the caller reaching the calendar is the deliverable');
    assert.deepEqual(h.drives.filter((d) => d.cmd === 'booking_prefill'), [],
      'and an empty prefill is not queued — sanitizeBookingArgs would refuse it too');
    ch.stop();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 · The real layer, tapped through end to end
// ─────────────────────────────────────────────────────────────────────────────

describe('§4 — the SHIPPED js/perch-layer.js turns a tapped card into a revealed calendar', () => {
  let env = null;
  let layer = null;
  const navigated = [];
  const prefills = [];
  /** Anything the adapter must never call. Recorded, so a call is a red, not a throw. */
  const forbidden = [];

  /** Run the real layer, with the browser's absolute specifiers made resolvable. */
  async function loadLayer() {
    const src = fs.readFileSync(path.join(SITE_DIR, 'js', 'perch-layer.js'), 'utf8')
      .replace(/(['"])\/js\//g, '$1../donovan-legal-site/js/');
    const file = path.join(HERE, `.nativebook-layer-harness-${process.pid}.mjs`);
    fs.writeFileSync(file, src);
    try {
      return await import('./' + path.basename(file) + '?nativebook=1');
    } finally {
      fs.unlinkSync(file);
    }
  }

  function browserGlobals() {
    // `?qualifier=1` is the shipped debug affordance at the bottom of
    // js/perch/qualifier.js, and it is the same route the Preview verifier drives —
    // so this harness exercises the path a reviewer will click, not a private one.
    // `&src=google` is the verbal "how did you hear" answer riding along.
    const dom = new JSDOM(
      `<!doctype html><body><main id="${CONTAINER_ID}"><p>content</p></main></body>`,
      { url: 'https://donovan-site.pages.dev/contact?qualifier=1&src=google' },
    );
    const win = dom.window;
    win.fetch = async () => ({ ok: true, json: async () => ({}) });
    win.scrollTo = () => {};
    win.HTMLElement.prototype.scrollIntoView = () => {};

    // The widget's published surface, as booking-control.js looks it up: on the
    // window, every call. FORBIDDEN_METHODS are present and spy — the assertion is
    // that the flow never reaches them, which cannot be shown by their absence.
    const api = { prefill: (f) => { prefills.push(f); return { ok: true }; } };
    for (const m of FORBIDDEN_METHODS) api[m] = () => { forbidden.push(m); };
    win.DLBooking = api;

    const saved = {};
    const globals = {
      window: win,
      document: win.document,
      location: win.location,
      CustomEvent: win.CustomEvent,
      // `performance` is DELIBERATELY not swapped, for the same reason
      // test/perch-command-consumer.test.mjs does not swap setTimeout: jsdom's
      // implementation calls the ambient global internally, so binding it here
      // recurses until the stack blows — inside mount(), whose own try/catch then
      // swallows it into a silent "mount failed".
      fetch: win.fetch,
      setInterval: win.setInterval.bind(win),
      clearInterval: win.clearInterval.bind(win),
    };
    for (const [k, v] of Object.entries(globals)) {
      saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
      Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
    }
    return {
      win,
      restore() {
        for (const [k, d] of Object.entries(saved)) {
          if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k];
        }
        dom.window.close();
      },
    };
  }

  before(async () => {
    env = browserGlobals();
    layer = await loadLayer();
    layer.mount();
    // Exactly what js/perch-swup-router.js does at boot, minus Swup. The layer's
    // onRouterRegistered waiter builds the consumer — and the qualifier — inside it.
    const r = registerRouter((href) => navigated.push(href));
    assert.equal(r.ok, true, 'precondition: this file is the first registrant in its own process');
  });

  after(() => {
    if (layer) layer.releaseCall();
    if (env) env.restore();
  });

  test('precondition: the card and the channel are both mounted, inside the layer', () => {
    const { win } = env;
    const qual = win.document.getElementById('qual');
    assert.ok(qual, 'the consumer stack must have built the card');
    assert.ok(win.document.getElementById(LAYER_ID).contains(qual),
      'and it must be in the LAYER — a card inside #perch-main is torn away mid-answer');
    assert.equal(win.Perch.layer.probe().commandChannel.bookNavs, 0);
    assert.equal(win.Perch.layer.probe().commandChannel.autoAdvanced, false);
  });

  test('THE HEADLINE: tapping the real card through navigates to /book and prefills, once', async () => {
    const { win } = env;
    const doc = win.document;
    layer.bindCall({ callId: 'call_e2e' });
    assert.equal(win.Perch.layer.probe().commandChannel.callId, 'set',
      'precondition: the launcher handed the call over');
    navigated.length = 0;
    prefills.length = 0;

    // The shipped `?qualifier=1` affordance opens the card ~500 ms after mount.
    const q = doc.getElementById('qual');
    await new Promise((resolve, reject) => {
      const started = Date.now();
      const t = setInterval(() => {
        if (q.classList.contains('show')) { clearInterval(t); resolve(); return; }
        if (Date.now() - started > 5000) { clearInterval(t); reject(new Error('the card never opened')); }
      }, 20);
    });

    const tap = (v) => {
      const b = [...doc.querySelectorAll('#qual-bd .opt')].find((x) => x.dataset && x.dataset.v === v);
      assert.ok(b, `no option "${v}" on step "${doc.querySelector('#qual-bd h2').textContent}"`);
      b.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    };
    tap('real_estate');
    tap('acquisition');
    tap('party');              // 2026-09-06: the role step sits after the matter
    doc.querySelector('#q-sel').value = 'FL';
    doc.querySelector('#q-cont').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    tap('yourself');
    tap('1_5m_3m');
    tap('5m_15m');

    // ── The acceptance ────────────────────────────────────────────────────────
    assert.deepEqual(navigated, [BOOK_PATH],
      'THE DEFECT: a completed card used to navigate NOWHERE. And it must navigate ONCE.');
    assert.ok(win.localStorage.getItem('donovan_booking_unlock'),
      'the unlock flag is what booking-gate.js reads to reveal #book-live');
    // Through the ROUTER, which is the whole point — a document load ends the call.
    assert.equal(win.location.pathname, '/contact',
      'the layer must not have hard-navigated; the registered router owns the swap');

    assert.ok(prefills.length >= 1, 'the prefill reached DLBooking.prefill');
    for (const f of prefills) {
      assert.deepEqual(Object.keys(f), ['notes'], 'and carried only the field the card can fill');
      assert.match(f.notes, /^Matter: Real estate — Acquisition \(buying\)/);
      assert.match(f.notes, /For: Yourself \(personal\) · State: Florida · Heard via: google/);
      assert.equal(/1_5m_3m|5m_15m|\$1\.5M|\$5M/.test(f.notes), false, 'the bands stay off the form');
    }
    const chp = win.Perch.layer.probe().commandChannel;
    assert.equal(chp.bookNavs, 1, 'exactly one navigate');
    assert.equal(chp.autoAdvanced, true);
    assert.equal(chp.log.filter((e) => e.cmd === 'booking_prefill').length, 1, 'exactly one prefill batch');
    // Re-delivery is the shipped 700 ms × 6 loop, idempotent by design; it is not a
    // second batch, and it is still capped.
    assert.ok(prefills.length <= PREFILL_TRIES + 1, 'the re-delivery loop must still be capped');

    assert.deepEqual(forbidden, [],
      'NOTHING may submit, confirm, book or create — the caller always presses Confirm');
    assert.match(doc.getElementById('qual-bd').textContent, /Got it\./,
      'and the done-state copy is unchanged');
  });

  test('and Paula\'s own goto_booking, arriving after it, costs no second swap', async () => {
    // The live race, at the layer, through the real poll: the auto-advance has
    // already run, and the bridge now serves the pair she fires.
    const { win } = env;
    navigated.length = 0;
    prefills.length = 0;

    let served = false;
    const serve = async (url) => {
      if (String(url) === '/fn/page-poll' && !served) {
        served = true;
        return {
          ok: true,
          json: async () => ({
            cmd: 'batch',
            actions: [
              { cmd: 'navigate', target: BOOK_PATH },
              { cmd: 'booking_prefill', payload: { name: 'Ada Lovelace', phone: '5615550100' } },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    };
    win.fetch = serve;
    Object.defineProperty(globalThis, 'fetch', { value: serve, configurable: true, writable: true });

    await new Promise((resolve, reject) => {
      const started = Date.now();
      const t = setInterval(() => {
        if (prefills.some((f) => f.name === 'Ada Lovelace')) { clearInterval(t); resolve(); return; }
        if (Date.now() - started > 8000) { clearInterval(t); reject(new Error('the poll never served the batch')); }
      }, 50);
    });

    assert.deepEqual(navigated, [], 'her navigate was coalesced — one caller, one trip to the calendar');
    assert.equal(win.Perch.layer.probe().commandChannel.bookNavs, 1);
    const merged = prefills.at(-1);
    assert.equal(merged.name, 'Ada Lovelace');
    assert.equal(merged.phone, '5615550100');
    assert.match(merged.notes, /^Matter: Real estate/,
      'and the qualifier note survived her prefill — one batch carrying both halves');
    assert.deepEqual(forbidden, []);
  });

  test('the card stays a read-only surface after all of that', () => {
    const { win } = env;
    assert.equal(Object.getOwnPropertyDescriptor(win, '__perch').writable, false);
    assert.throws(() => { 'use strict'; win.__perch = { openQualifier: () => 'pwned' }; }, TypeError);
    assert.deepEqual(Object.keys(win.__perch), ['probe'],
      'DR-INSANE-A33: one read-only method, and this ticket adds nothing to it');
    assert.equal(typeof win.Perch.layer.advanceToBooking, 'undefined',
      'and the auto-advance is NOT published — it navigates, so it stays a closure');
    assert.deepEqual(Object.keys(win.Perch.layer).sort(),
      ['attachLiveResource', 'bookingProbe', 'detachLiveResource', 'probe'],
      'the published surface gained nothing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 · The boundaries this ticket must not widen
// ─────────────────────────────────────────────────────────────────────────────

describe('§5 — nothing new escapes the frame, submits, or becomes writable', () => {
  test('no writable __perch global was introduced anywhere this ticket touched', () => {
    for (const f of TOUCHED) {
      const src = code(f);
      // `lockGlobal` is the only way this property may be defined. An assignment —
      // `window.__perch = …`, `w.__perch =`, `defaultView.__perch =` — is the
      // exposure A33 removed and must not come back by another spelling.
      assert.doesNotMatch(src, /__perch\s*=[^=]/, `${f} assigns to a __perch global`);

      // The `__perch*` sweep stays, and it stays a REFUSAL — but it is now spelled
      // as "nothing except the values a reviewer has classified" rather than
      // "nothing at all", because the second form was already only true by accident
      // of which files this ticket happened to touch.
      //
      // COMPOSE-R1 (#153 + #158) added `__perchQualifierClaim` to perch-layer.js: a
      // constant string the booking widget reads at submit time, exactly parallel
      // to `__perchCallId`, and classified as 'data' in the §T4.3 table in
      // test/perch-cutover-security.test.mjs. It is not a probe namespace, it is
      // not callable, and the server can only WITHHOLD on it.
      //
      // An UNLISTED `__perchAnything =` still fails here, which is the whole point:
      // this is an allow-list of two reviewed names, not a hole.
      const REVIEWED_DATA_GLOBALS = new Set(['__perchCallId', '__perchQualifierClaim']);
      const assigned = [...src.matchAll(/(__perch\w*)\s*=[^=]/g)].map((m) => m[1]);
      const unreviewed = assigned.filter((n) => !REVIEWED_DATA_GLOBALS.has(n));
      assert.deepEqual(unreviewed, [],
        `${f} assigns to an unclassified __perch* global: ${unreviewed.join(', ')}`);
    }
    // And the one legitimate definition is still the locked probe.
    assert.match(code('js/perch/qualifier.js'), /lockGlobal\(doc\.defaultView, '__perch', \{/);
    assert.doesNotMatch(code('js/perch/qualifier.js'), /openQualifier,\s*closeQualifier\s*\}\s*\)/);
  });

  test('no target=_top and no hard navigation was added to the auto-advance path', () => {
    for (const f of TOUCHED) {
      const src = code(f);
      assert.doesNotMatch(src, /_top/, `${f} mentions _top — the soft swap is the whole point`);
      assert.doesNotMatch(src, /window\.open/, `${f} opens a window`);
    }
    // js/perch-layer.js has ONE location.assign, and it is the pre-existing
    // no-router fallback in `go()`. The count is the guard: a second one would be a
    // hard navigation on a path that has a router.
    const layerSrc = code('js/perch-layer.js');
    assert.equal((layerSrc.match(/location\.assign/g) || []).length, 1,
      'a second location.assign in the layer is a call-killer');
    assert.doesNotMatch(code('js/perch/command-channel.js'), /location\s*\.\s*(assign|replace|href\s*=)/,
      'the channel navigates through host.go only');
    assert.doesNotMatch(code('js/perch/qualifier.js'), /location\s*\.\s*(assign|replace|href\s*=)/);
  });

  test('the #108 utility-bar frame escape is untouched', () => {
    // The one place `target="_top"` legitimately lives, and this ticket must not
    // have moved it: it is the CTA escape hatch out of the Perch shell iframe.
    const bar = read('functions/_lib/utility-bar-inject.js');
    assert.match(bar, /_top/, 'the utility bar still carries its own escape hatch');
  });

  test('no DLBooking submit / confirm / book / create was added, by any spelling', () => {
    assert.deepEqual(FORBIDDEN_METHODS.slice(), ['submit', 'confirm', 'book', 'create'],
      'precondition: the forbidden list is unchanged');
    for (const f of TOUCHED.concat(['js/perch/booking-control.js'])) {
      const src = code(f);
      for (const m of FORBIDDEN_METHODS) {
        assert.doesNotMatch(src, new RegExp('DLBooking\\s*\\.\\s*' + m + '\\s*\\('), `${f} calls DLBooking.${m}()`);
        assert.doesNotMatch(src, new RegExp('surface\\s*\\[\\s*[\'"]' + m + '[\'"]'), `${f} reaches DLBooking.${m} by index`);
      }
    }
    // And the command table still maps to exactly the four browse/fill verbs.
    assert.deepEqual(Object.values(COMMAND_MAP).filter(Boolean).sort(),
      ['prefill', 'selectSlot', 'selectType', 'showDate']);
    for (const m of FORBIDDEN_METHODS) {
      assert.equal(Object.values(COMMAND_MAP).includes(m), false);
    }
  });

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  test('the booking WRITE path is not referenced from anything this ticket touched', () => {
    for (const f of TOUCHED) {
      assert.doesNotMatch(code(f), /\/booking\/create/, `${f} reaches the write path`);
    }
  });
});
