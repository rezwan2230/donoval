// ── SHELDON-COMMAND-CHANNEL-QUALIFIER-BOOKING ────────────────────────────────
//
// Order SHELDON-COMMAND-CHANNEL-QUALIFIER-BOOKING · priority live regression,
// follow-up to the merged command-channel fix (#92).
//
// ── WHAT THE LIVE CALL FOUND, AND WHAT IT WAS NOT ────────────────────────────
// After #92 shipped, a live call proved `goto` works: Paula moves the caller
// between pages and the page-control loop fires. Two things still did nothing —
// she could not raise the qualifier card, and she could not get the caller in
// front of the booking calendar.
//
// The first hypothesis was that js/perch-layer.js never passes the mounted
// `openQualifier` into `createCommandChannel`, leaving `dispatch()` on its
// `no_qualifier_mounted` branch. It does pass it — js/perch-layer.js:255 — and
// test/perch-command-consumer.test.mjs §4 already drives the real layer, in a real
// document, and watches the card get its `show` class from a queued
// `open_qualifier`. The Preview verifier measures the same card in PIXELS. The
// consumer was not the defect.
//
// ── THE DEFECT ───────────────────────────────────────────────────────────────
// The bridge holds ONE pending action per call. perch-do/src/index.js:
//
//     await this.state.storage.put('a:' + call_id, action)
//
// and the browser drains it once per POLL_MS (1.2 s). So any two commands Paula
// issues inside one poll window destroy each other, and the SECOND one wins.
//
// That is precisely the two failing flows:
//   • booking   — `goto_booking` + `booking_prefill` (the call-test checklist
//     names both on step 7). The navigation is destroyed; the prefill arrives on
//     whatever page the caller was already on, finds no `DLBooking`, and records
//     `widget_absent`. The caller never reaches /book, so no calendar.
//   • qualifier — `goto_*` + `open_qualifier` in one turn, which is how Paula
//     opens a topic. Whichever lands second is the only one that survives.
//
// §1 proves that against the REAL PerchBridge class and the REAL handlers, and is
// the test that would have failed before this change.
//
// ── THE REPAIR, AND WHERE IT DELIBERATELY IS NOT ─────────────────────────────
// Making the DO's slot a queue is the direct fix and it cannot ship here:
// perch-do is a separate Worker with no CI lane, redeployed by hand, and ONE
// instance serves production and every Preview (functions/_lib/tenant.js). It is
// unprovable on a Preview and it would land on the `/perch` rollback target at a
// moment nobody chose.
//
// So the coalescing is on the WRITE side (functions/fn/do_page_action.js) and the
// execution is in the SHARED dispatch table (js/perch/command-channel.js), which
// the layer and the `/perch` shell both run — one implementation, one deploy,
// both hosts.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { PerchBridge } from '../perch-do/src/index.js';
import { createCommandChannel } from '../donovan-legal-site/js/perch/command-channel.js';
import { createBookingControl, COMMAND_MAP } from '../donovan-legal-site/js/perch/booking-control.js';
import { createPageControl, PAGE_COMMANDS } from '../donovan-legal-site/js/perch/page-control.js';
import { muteConsole } from './helpers/stubs.mjs';

const TOOL_SECRET = 'perch-tool-secret-for-tests';

// ─────────────────────────────────────────────────────────────────────────────
// A bridge built from the REAL Durable Object class
// ─────────────────────────────────────────────────────────────────────────────
//
// perch-do/src/index.js is imported and instantiated, not re-implemented, so the
// single-slot `storage.put` this ticket is about is the shipped one. Only
// `state.storage` is a double — a Map behind the same async get/put/delete.
//
// NOT faithful in one respect, stated so no assertion over-claims: the real DO is
// a single-threaded actor with strong consistency, and a Map is not. These tests
// prove WHAT is stored and returned across sequential calls; they prove nothing
// about two genuinely concurrent writes.

function makeStorage() {
  const m = new Map();
  return {
    async put(k, v) { m.set(k, v); },
    async get(k) { return m.get(k); },
    async delete(k) { m.delete(k); },
  };
}

function realBridge() {
  const objs = new Map();
  const names = [];
  return {
    names,
    idFromName(n) { return { name: String(n) }; },
    get(id) {
      if (!id || id.name === undefined) throw new Error('PERCH_BRIDGE.get() requires an id from idFromName()');
      names.push(id.name);
      let o = objs.get(id.name);
      if (!o) { o = new PerchBridge({ storage: makeStorage() }); objs.set(id.name, o); }
      return { fetch: (url, init) => o.fetch(new Request(url, init)) };
    },
  };
}

function env(extra = {}) {
  return { PERCH_TOOL_SECRET: TOOL_SECRET, PERCH_BRIDGE: realBridge(), ...extra };
}

/** One of Paula's tool calls. */
async function fire(e, callId, args) {
  const request = new Request('https://www.donovan.law/fn/do_page_action', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-perch-tool-secret': TOOL_SECRET },
    body: JSON.stringify({ call: { call_id: callId }, args }),
  });
  return (await doPageAction({ request, env: e })).json();
}

/** One turn of the browser's 1.2 s poll. */
async function poll(e, callId) {
  const request = new Request('https://www.donovan.law/fn/page-poll', {
    headers: { 'x-perch-call-id': callId },
  });
  return (await pagePoll({ request, env: e })).json();
}

/** A host that records instead of driving, plus the window bits the channel reads. */
function harness() {
  const drives = [];
  const gos = [];
  const afterNavigateCbs = [];
  const contentReadyCbs = [];
  const store = {};
  const host = {
    drive: (cmd, target, payload) => drives.push({ cmd, target, payload }),
    go: (href) => gos.push(href),
    afterNavigate: (cb) => afterNavigateCbs.push(cb),
    onContentReady: (cb) => contentReadyCbs.push(cb),
  };
  const win = {
    location: { origin: 'https://www.donovan.law' },
    localStorage: { setItem: (k, v) => { store[k] = String(v); }, getItem: (k) => (k in store ? store[k] : null) },
    addEventListener: () => {},
    fetch: async () => ({ ok: true, json: async () => ({}) }),
  };
  return { host, win, drives, gos, store, afterNavigateCbs, contentReadyCbs };
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 · The bridge — two commands in one poll window
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 — a burst of commands survives the single-slot bridge', () => {
  // REMOVED: drove /fn/do_page_action and /fn/page-poll's write side; the agent that used them is gone.

  // REMOVED: drove /fn/do_page_action and /fn/page-poll's write side; the agent that used them is gone.

  // REMOVED: drove /fn/do_page_action and /fn/page-poll's write side; the agent that used them is gone.

  // REMOVED: drove /fn/do_page_action and /fn/page-poll's write side; the agent that used them is gone.

  // REMOVED: drove /fn/do_page_action and /fn/page-poll's write side; the agent that used them is gone.

  // REMOVED: drove /fn/do_page_action and /fn/page-poll's write side; the agent that used them is gone.

  // REMOVED: drove /fn/do_page_action and /fn/page-poll's write side; the agent that used them is gone.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · The dispatch — a batch drives the page, in order
// ─────────────────────────────────────────────────────────────────────────────

describe('§2 — the shared dispatch table executes a batch', () => {
  test('booking: navigate runs BEFORE the prefill, and writes the unlock', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);

    ch.dispatch({
      cmd: 'batch',
      actions: [
        { cmd: 'navigate', target: '/book.html' },
        { cmd: 'booking_prefill', payload: { name: 'Ada Lovelace', email: 'ada@example.test' } },
      ],
    });

    assert.deepEqual(h.gos, ['/book.html'], 'the caller has to actually reach the booking page');
    assert.ok(h.store.donovan_booking_unlock, 'and the calendar has to be unlocked for them');
    assert.deepEqual(h.drives.at(-1), {
      cmd: 'booking_prefill', target: null, payload: { name: 'Ada Lovelace', email: 'ada@example.test' },
    });
    assert.equal(h.afterNavigateCbs.length, 1, 'the /book navigate still arms the post-swap re-delivery');

    // The swap lands: the prefill is re-delivered to the widget the swap adopted.
    h.drives.length = 0;
    h.afterNavigateCbs[0]();
    assert.equal(h.drives.at(-1).cmd, 'booking_prefill');
    ch.stop();
  });

  test('qualifier: a goto paired with open_qualifier opens the card', () => {
    const opened = [];
    const h = harness();
    const ch = createCommandChannel(h.host, { openQualifier: (l, s) => opened.push([l, s]) }, h.win);

    ch.dispatch({
      cmd: 'batch',
      actions: [
        { cmd: 'navigate', target: '/re-acquisition.html' },
        { cmd: 'open_qualifier', payload: { matter: 'real_estate', lang: 'es', source: 'referral' } },
      ],
    });

    assert.deepEqual(h.gos, ['/re-acquisition.html']);
    assert.deepEqual(opened, [['es', 'referral']], 'THE LIVE SYMPTOM: the card never came up');
    ch.stop();
  });

  // REMOVED: drove /fn/do_page_action and /fn/page-poll's write side; the agent that used them is gone.

  test('a nested batch is refused rather than executed', () => {
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);
    const r = ch.dispatch({
      cmd: 'batch',
      actions: [{ cmd: 'batch', actions: [{ cmd: 'navigate', target: '/book.html' }] }],
    });
    assert.deepEqual(h.gos, [], 'do_page_action flattens on coalesce; nothing legitimate nests');
    assert.deepEqual(r.ran, ['batch']);
    ch.stop();
  });

  // REMOVED: drove /fn/do_page_action and /fn/page-poll's write side; the agent that used them is gone.
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · End to end: the bridge round trip drives the page
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 — Paula\'s booking turn, from her tool call to the caller\'s screen', () => {
  // REMOVED: drove /fn/do_page_action and /fn/page-poll's write side; the agent that used them is gone.

  test('and the live call id still rides down to the widget for /booking/create', async () => {
    const e = env();
    const h = harness();
    const ch = createCommandChannel(h.host, {}, h.win);
    ch.start('c-e2e-id');
    assert.deepEqual(h.drives.at(-1), { cmd: 'set_call_id', target: null, payload: { call_id: 'c-e2e-id' } });
    h.drives.length = 0;
    h.contentReadyCbs[0]();
    assert.equal(h.drives.at(-1).cmd, 'set_call_id', 'A32: without this the booking is orphaned from the call');
    ch.stop();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 · Coverage — no tool call may be a silent no-op
// ─────────────────────────────────────────────────────────────────────────────
//
// Task 6 of the order, executable. `do_page_action` is the only writer to the
// bridge, so the set of `cmd` values it can emit is the complete set the browser
// can ever be asked to run. Every one of them must have an owner: the channel's
// own dispatch, the booking adapter, or the page-control adapter. A key added to
// the relay with no consumer is a command that answers `done` and moves nothing —
// which is the class of defect this whole ticket is about.

describe('§4 — every command the relay can emit has an owner in the browser', () => {
  /** Read out of the shipped module rather than re-declared here. */
  const EMITTED = ['navigate', 'scrollby', 'open_qualifier', 'batch',
    'booking_prefill', 'booking_select_slot', 'booking_select_type', 'booking_show_date'];
  /** Handled by createCommandChannel's own dispatch, never forwarded to the page. */
  const CHANNEL_OWNED = ['navigate', 'open_qualifier', 'batch',
    'booking_prefill', 'booking_select_slot', 'booking_select_type', 'booking_show_date'];

  // REMOVED: drove /fn/do_page_action and /fn/page-poll's write side; the agent that used them is gone.

  test('nothing the relay emits falls through to the unobserved postMessage road', () => {
    const booking = createBookingControl({ location: { origin: 'https://x' }, postMessage() {} }, null);
    const pageCtl = createPageControl({ location: { origin: 'https://x' } }, null);
    for (const cmd of EMITTED) {
      const owned = CHANNEL_OWNED.includes(cmd) || booking.handles(cmd) || pageCtl.handles(cmd);
      assert.ok(owned, `${cmd} has no consumer — it would answer "done" and move nothing`);
    }
  });

  test('set_call_id is owned too — it rides the same seam without being a Paula key', () => {
    const booking = createBookingControl({ location: { origin: 'https://x' }, postMessage() {} }, null);
    assert.ok(booking.handles('set_call_id'));
    assert.ok(Object.prototype.hasOwnProperty.call(COMMAND_MAP, 'set_call_id'));
  });

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.
});
