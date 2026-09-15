// ── SHELDON-PERCHDO-QUEUE ────────────────────────────────────────────────────
//
// Order SHELDON-PERCHDO-QUEUE · post-cutover hardening, defence in depth.
//
// ── WHAT IS ALREADY FIXED, AND WHAT IS NOT ───────────────────────────────────
// #94 stopped the live bug: functions/fn/do_page_action.js drains the bridge
// before it writes, and re-queues the pending command with the new one inside a
// single `batch`, so `goto_booking` + `booking_prefill` in one 1.2 s poll window
// both reach the caller. Nothing about that changes here and no assertion below
// relies on it changing.
//
// What #94 could not change is the storage underneath it. perch-do/src/index.js
// held ONE action per call_id:
//
//     await this.state.storage.put('a:' + call_id, action)
//
// so the coalesce was the only thing standing between a burst and data loss — and
// a coalesce is a read-modify-write across a network hop by a caller that may be
// retried, replaced, or rolled back. This suite is about the Durable Object
// itself: two writers, no coalescing anywhere, and the first one still survives.
//
// ── WHAT THESE TESTS RUN AGAINST ─────────────────────────────────────────────
// The REAL PerchBridge class, imported and instantiated — not a re-implementation.
// Only `state.storage` is a double, and it is a deliberately UNKIND one: every
// get/put/delete yields to the event loop before it takes effect, and values are
// structured-cloned in and out. So §5's two concurrent writers genuinely
// interleave, which is the only way a test can tell an append queue from a lucky
// ordering. §5 includes the pre-queue implementation as a control and shows the
// same harness losing a command through it — a concurrency test that cannot fail
// on the broken code proves nothing ([[feedback_prove_concurrency_with_real_race]]).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { PerchBridge } from '../perch-do/src/index.js';
import { onRequestPost as qualifierSubmit } from '../donovan-legal-site/functions/fn/qualifier_submit.js';
import { makeKV, stubFetch, muteConsole } from './helpers/stubs.mjs';

const TOOL_SECRET = 'perch-tool-secret-for-tests';

// ─────────────────────────────────────────────────────────────────────────────
// The harness
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A storage double that YIELDS on every operation.
 *
 * The real DO is a single-threaded actor whose input gate holds incoming events
 * while a storage operation is outstanding. This double models the opposite — the
 * hostile case — on purpose: if two overlapping requests can interleave here and
 * both still survive, the class does not depend on the gate for its correctness.
 *
 * Values are structured-cloned on the way in and out, like the real thing, so a
 * queue held by reference in the object cannot fake persistence.
 */
function makeStorage(initial = {}) {
  const m = new Map(Object.entries(initial));
  const tick = () => new Promise((r) => setTimeout(r, 0));
  return {
    _m: m,
    async get(k) { await tick(); const v = m.get(k); return v === undefined ? undefined : structuredClone(v); },
    async put(k, v) { await tick(); m.set(k, structuredClone(v)); },
    async delete(k) { await tick(); m.delete(k); },
  };
}

/** A bridge built from the REAL Durable Object class, one instance per name. */
function realBridge(seed = {}) {
  const objs = new Map();
  const stores = new Map();
  return {
    /** Raw storage for one DO name — used only to seed a pre-deploy value. */
    storage(name) { return stores.get(String(name)); },
    idFromName(n) { return { name: String(n) }; },
    get(id) {
      if (!id || id.name === undefined) throw new Error('PERCH_BRIDGE.get() requires an id from idFromName()');
      let o = objs.get(id.name);
      if (!o) {
        const st = makeStorage(seed);
        stores.set(id.name, st);
        o = new PerchBridge({ storage: st });
        objs.set(id.name, o);
      }
      return { fetch: (url, init) => o.fetch(new Request(url, init)) };
    },
  };
}

function env(extra = {}, seed = {}) {
  return { PERCH_TOOL_SECRET: TOOL_SECRET, PERCH_BRIDGE: realBridge(seed), ...extra };
}

/** Talk to the DO the way the Pages functions do. */
function bridge(e) {
  const stub = e.PERCH_BRIDGE.get(e.PERCH_BRIDGE.idFromName('donovan'));
  return {
    set: (callId, action) => stub.fetch('https://do/set', {
      method: 'POST', body: JSON.stringify({ call_id: callId, action }),
    }),
    get: async (callId) => (await stub.fetch('https://do/get?call_id=' + encodeURIComponent(callId))).json(),
    has: async (callId) => (await stub.fetch('https://do/has?call_id=' + encodeURIComponent(callId))).json(),
  };
}

const NAV = (target) => ({ cmd: 'navigate', target });

// ─────────────────────────────────────────────────────────────────────────────
// §1 · Two writers in one poll window — no coalescing involved
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 — a second write no longer destroys the first', () => {
  test('THE PROPERTY: two actions written back to back both come back', async () => {
    const b = bridge(env());
    await b.set('c1', NAV('/book.html'));
    await b.set('c1', { cmd: 'booking_prefill', payload: { name: 'Ada Lovelace' } });

    const d = await b.get('c1');
    // Before this change the DO returned ONLY the prefill: `storage.put` had
    // overwritten the navigation and the caller never left the page they were on.
    assert.equal(d.cmd, 'batch');
    assert.deepEqual(d.actions.map((a) => a.cmd), ['navigate', 'booking_prefill']);
    assert.equal(d.actions[0].target, '/book.html');
    assert.equal(d.actions[1].payload.name, 'Ada Lovelace');
  });

  test('ORDER: the queue drains oldest first, whatever the commands are', async () => {
    const b = bridge(env());
    await b.set('c2', NAV('/tax.html'));
    await b.set('c2', { cmd: 'scrollby', target: 'down' });
    await b.set('c2', { cmd: 'open_qualifier', payload: { matter: 'tax', lang: 'en', source: '' } });

    const d = await b.get('c2');
    assert.deepEqual(d.actions.map((a) => a.cmd), ['navigate', 'scrollby', 'open_qualifier'],
      'order is load-bearing — the navigate has to start before the prefill or the card');
  });

  // REMOVED: fn/page-poll was removed: nothing called channel.start(), so it had no caller and no writer.

  test('queues are per call_id — one call cannot drain or merge another', async () => {
    const b = bridge(env());
    await b.set('call-A', NAV('/tax.html'));
    await b.set('call-B', NAV('/blog.html'));
    await b.set('call-A', { cmd: 'scrollby', target: 'down' });

    const a = await b.get('call-A');
    assert.deepEqual(a.actions.map((x) => x.cmd), ['navigate', 'scrollby']);
    assert.deepEqual(await b.get('call-B'), NAV('/blog.html'),
      "another session's queue is untouched by the first session's drain");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · The bound
// ─────────────────────────────────────────────────────────────────────────────

describe('§2 — the queue is bounded, and keeps the newest', () => {
  test('a caller that never polls cannot grow the queue without limit', async () => {
    const b = bridge(env());
    for (let i = 0; i < 40; i++) await b.set('c-flood', NAV('/p' + i)); // eslint-disable-line no-await-in-loop
    const d = await b.get('c-flood');
    assert.equal(d.cmd, 'batch');
    assert.equal(d.actions.length, 8, 'MAX_QUEUE bounds what one call can accumulate');
    assert.deepEqual(d.actions.map((a) => a.target), ['/p32', '/p33', '/p34', '/p35', '/p36', '/p37', '/p38', '/p39'],
      'oldest-first drop: the command Paula just issued is never the casualty');
  });

  test('the bound counts ACTIONS, not batch wrappers', async () => {
    // Today's do_page_action writes a coalesced `batch`. If the DO stored that as
    // one opaque item, eight of them would be sixty-four pending actions.
    const b = bridge(env());
    for (let i = 0; i < 5; i++) { // eslint-disable-line no-plusplus
      // eslint-disable-next-line no-await-in-loop
      await b.set('c-nest', { cmd: 'batch', actions: [NAV('/a' + i), NAV('/b' + i)] });
    }
    const d = await b.get('c-nest');
    assert.equal(d.actions.length, 8);
    assert.ok(d.actions.every((a) => a.cmd === 'navigate'), 'the queue never nests a batch inside a batch');
    assert.equal(d.actions.at(-1).target, '/b4');
  });

  test('the storage key is released once the queue drains', async () => {
    const e = env();
    const b = bridge(e);
    await b.set('c-clean', NAV('/tax.html'));
    await b.get('c-clean');
    assert.deepEqual([...e.PERCH_BRIDGE.storage('donovan')._m.keys()], [],
      'a drained call leaves nothing behind in the instance every tenant shares');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · /has is unchanged
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 — /has: still a boolean, still non-destructive', () => {
  test('present after a write, and the record survives the probe', async () => {
    const b = bridge(env());
    await b.set('qual:c-has', { status: 'complete', matter: 'tax' });

    assert.deepEqual(await b.has('qual:c-has'), { present: true });
    assert.deepEqual(await b.has('qual:c-has'), { present: true }, 'probing twice is not consuming');
    assert.deepEqual(await b.get('qual:c-has'), { status: 'complete', matter: 'tax' },
      'A32: /has must never eat the record get_qualifier_result is waiting for');
  });

  test('absent, drained and empty call_id all read false — and no default bucket', async () => {
    const b = bridge(env());
    assert.deepEqual(await b.has('qual:nobody'), { present: false });

    await b.set('qual:c-drain', { status: 'complete' });
    await b.get('qual:c-drain');
    assert.deepEqual(await b.has('qual:c-drain'), { present: false }, 'a consumed record is not present');

    const stub = env().PERCH_BRIDGE.get({ name: 'donovan' });
    const r = await (await stub.fetch('https://do/has')).json();
    assert.deepEqual(r, { present: false }, "an absent call_id is false, never the 'default' bucket");
  });

  test('a queued burst is present exactly once, and the probe does not reorder it', async () => {
    const b = bridge(env());
    await b.set('c-hasq', NAV('/tax.html'));
    await b.set('c-hasq', { cmd: 'scrollby', target: 'down' });
    assert.deepEqual(await b.has('c-hasq'), { present: true });
    assert.deepEqual((await b.get('c-hasq')).actions.map((a) => a.cmd), ['navigate', 'scrollby']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 · Backward compatibility — old shapes and new shapes both work
// ─────────────────────────────────────────────────────────────────────────────

describe('§4 — every shape the live Pages build reads and writes', () => {
  test('one command round-trips VERBATIM — no batch wrapper appears', async () => {
    const b = bridge(env());
    await b.set('c-solo', NAV('/tax-controversy.html'));
    assert.deepEqual(await b.get('c-solo'), { cmd: 'navigate', target: '/tax-controversy.html' },
      "the wire shape Paula's tool configs and the /perch shell are written against");
  });

  test("a coalesced `batch` from today's do_page_action still drains as a batch", async () => {
    const b = bridge(env());
    await b.set('c-batch', { cmd: 'batch', actions: [NAV('/book.html'), { cmd: 'booking_prefill', payload: { name: 'Ada' } }] });
    const d = await b.get('c-batch');
    assert.equal(d.cmd, 'batch');
    assert.deepEqual(d.actions.map((a) => a.cmd), ['navigate', 'booking_prefill'],
      'the #94 write path and the queue produce the same thing on the wire');
  });

  test('a NON-command record is last-write-wins, exactly as before', async () => {
    // qual:/booked: hold a record, not a command. qualifier_result and
    // booking_result look for `.status`; wrapping two of them in a batch would read
    // as "pending"/"not_booked" and silently drop a real submission.
    const b = bridge(env());
    await b.set('qual:c-rec', { status: 'complete', matter: 'tax', ts: 'first' });
    await b.set('qual:c-rec', { status: 'complete', matter: 'real_estate', ts: 'second' });
    assert.deepEqual(await b.get('qual:c-rec'), { status: 'complete', matter: 'real_estate', ts: 'second' });
  });

  test('a record the PREVIOUS build stored under `a:<id>` is still served, first', async () => {
    // The instance is live and holds state across a hand deploy: whatever was
    // pending at the moment perch-do is redeployed must not vanish.
    const e = env({}, { 'a:c-legacy': { cmd: 'navigate', target: '/ourfirm.html' } });
    const b = bridge(e);
    assert.deepEqual(await b.has('c-legacy'), { present: true }, 'and it is visible to the probe');

    await b.set('c-legacy', { cmd: 'scrollby', target: 'down' });
    const d = await b.get('c-legacy');
    assert.deepEqual(d.actions.map((a) => a.cmd), ['navigate', 'scrollby'],
      'the pre-deploy action was queued first, so it runs first');
    assert.deepEqual(await b.get('c-legacy'), {}, 'and the legacy key is cleared, not left to re-serve');
  });

  test('a legacy record with no writer after it still drains on its own', async () => {
    const b = bridge(env({}, { 'a:c-legacy2': { status: 'booked', slotISO: null } }));
    assert.deepEqual(await b.get('c-legacy2'), { status: 'booked', slotISO: null });
    assert.deepEqual(await b.get('c-legacy2'), {});
  });

  test('the queue is written under a NEW key, so a rollback reads {} not garbage', async () => {
    // Rollback = redeploying the previous build, which reads `a:<id>` only. It must
    // find nothing rather than deserialise an array it has no code path for.
    const e = env();
    await bridge(e).set('c-roll', NAV('/tax.html'));
    const keys = [...e.PERCH_BRIDGE.storage('donovan')._m.keys()];
    assert.deepEqual(keys, ['q:c-roll']);
    assert.equal(keys.some((k) => k.startsWith('a:')), false);
  });

  // REMOVED: fn/page-poll was removed: nothing called channel.start(), so it had no caller and no writer.

  test('an unknown path is still the {} catch-all', async () => {
    const stub = env().PERCH_BRIDGE.get({ name: 'donovan' });
    const r = await stub.fetch('https://do/whatever');
    assert.deepEqual(await r.json(), {});
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 · Genuinely concurrent writers
// ─────────────────────────────────────────────────────────────────────────────
//
// §1 fires sequentially. This section overlaps the two requests against a storage
// double that yields on EVERY operation, so the read-modify-write of one /set is
// interleaved with the other's. The control below proves the harness can see the
// loss: the pre-queue implementation, run through the same double, drops a command.

describe('§5 — two overlapping writers', () => {
  /** The implementation this ticket replaces, quoted so the control is honest. */
  class LegacySlot {
    constructor(state) { this.state = state; }
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname === '/set') {
        const { call_id, action } = await req.json();
        await this.state.storage.put('a:' + call_id, action);
        return new Response('ok');
      }
      const callId = url.searchParams.get('call_id') || 'default';
      const a = await this.state.storage.get('a:' + callId);
      if (a !== undefined) await this.state.storage.delete('a:' + callId);
      return new Response(JSON.stringify(a || {}), { headers: { 'content-type': 'application/json' } });
    }
  }

  const send = (o, action) => o.fetch(new Request('https://do/set', {
    method: 'POST', body: JSON.stringify({ call_id: 'c-race', action }),
  }));
  const drain = async (o) => (await o.fetch(new Request('https://do/get?call_id=c-race'))).json();

  test('CONTROL: the pre-queue slot loses one of them under this harness', async () => {
    const o = new LegacySlot({ storage: makeStorage() });
    await Promise.all([send(o, NAV('/book.html')), send(o, { cmd: 'booking_prefill', payload: { name: 'Ada' } })]);
    const d = await drain(o);
    assert.notEqual(d.cmd, 'batch');
    assert.equal(typeof d.cmd, 'string');
    // Exactly one survived — which is the defect, reproduced.
    assert.ok(d.cmd === 'navigate' || d.cmd === 'booking_prefill');
  });

  test('the queue keeps BOTH, and keeps them in arrival order', async () => {
    const o = new PerchBridge({ storage: makeStorage() });
    await Promise.all([send(o, NAV('/book.html')), send(o, { cmd: 'booking_prefill', payload: { name: 'Ada' } })]);
    const d = await drain(o);
    assert.equal(d.cmd, 'batch');
    assert.deepEqual(d.actions.map((a) => a.cmd), ['navigate', 'booking_prefill']);
  });

  // REMOVED: fn/page-poll was removed: nothing called channel.start(), so it had no caller and no writer.

  test('a burst of six overlapping writers all survive, in order', async () => {
    const o = new PerchBridge({ storage: makeStorage() });
    await Promise.all([0, 1, 2, 3, 4, 5].map((i) => send(o, NAV('/p' + i))));
    const d = await drain(o);
    assert.deepEqual(d.actions.map((a) => a.target), ['/p0', '/p1', '/p2', '/p3', '/p4', '/p5']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 · The existing callers, unchanged, against the new queue
// ─────────────────────────────────────────────────────────────────────────────
//
// Every Pages function that touches the bridge, driven end to end with the REAL
// handler and the REAL DO class. None of these files changed in this ticket; the
// point is that none of them needed to.

describe('§6 — every existing caller still works', () => {
  const toolReq = (path, body) => new Request('https://www.donovan.law' + path, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-perch-tool-secret': TOOL_SECRET },
    body: JSON.stringify(body),
  });

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.
});
