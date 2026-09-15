// ORDER SHELDON-BOOKING-HARDEN — pre-write guards on POST /booking/create.
//
// This endpoint writes to Paul Donovan's REAL Clio calendar. Sarah's preview gate
// reproduced two ways to make it write something it should have refused (D3: any
// `type` string books; D4: no availability re-check, so the same slot double-books)
// and the Turnstile guard in front of it read a secret name no other file used,
// behind an `if (secret)` that fell OPEN when unset.
//
// Every test here therefore asserts TWO things: the status code, and that NO write
// reached the provider. A 400 that still POSTed a calendar entry is the actual
// defect — the status alone would not catch it. See
// test/helpers/stubs.mjs for the fetch stub; no test in this file talks to Clio.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import { onRequestGet } from '../donovan-legal-site/functions/booking/types.js';
import { stubFetch, muteConsole } from './helpers/stubs.mjs';

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES = 'https://app.clio.com/api/v4/calendar_entries';

/** Env with Clio wired to the stubbed fetch. Turnstile configured unless overridden. */
function env(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    CLIO_CLIENT_ID: 'cid',
    CLIO_CLIENT_SECRET: 'csec',
    CLIO_REFRESH_TOKEN: 'rtok',
    // resolveConfig now FAILS CLOSED without a calendar id (SHELDON-BOOKING-FAILCLOSE-V2):
    // an unset CLIO_CALENDAR_ID throws MISSING_CALENDAR_CONFIG → 503, short-circuiting
    // every guard these tests assert. Wire the firm calendar so tests reach that logic.
    CLIO_CALENDAR_ID: 9084638,
    ...over,
  };
}

/**
 * The next Monday at least 7 days out, 14:00:00Z.
 *
 * 14:00Z is 10:00 ET under EDT and 09:00 ET under EST — on the 09:00-start,
 * 30-minute grid either way, so this fixture does not break twice a year.
 */
function futureMondaySlot() {
  const d = new Date(Date.now() + 7 * 86400_000);
  d.setUTCHours(14, 0, 0, 0);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

const SLOT = futureMondaySlot();

function body(over = {}) {
  return {
    type: 'consult',
    slot: SLOT,
    name: 'Test Caller',
    email: 'test@example.com',
    phone: '555-0100',
    turnstile_token: 'good-token',
    ...over,
  };
}

// create.js keeps a MODULE-level rate-limit map (10/min/IP) that outlives each
// test, so every request gets its own IP. Sharing one would make later tests fail
// with 429 for reasons that have nothing to do with what they assert.
let _ipSeq = 0;
function nextIp() {
  _ipSeq += 1;
  return `203.0.113.${_ipSeq % 250}`;
}

function post(b, { ip = nextIp() } = {}) {
  return new Request('https://www.donovan.law/booking/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(b),
  });
}

/**
 * Stub the Clio + Turnstile edges.
 *
 * `busy` is a list of {start_at,end_at} the fake calendar reports back, which is
 * how a "slot already taken" is expressed without a live calendar.
 */
function stubClio({ busy = [], turnstileOk = true } = {}) {
  return stubFetch(async (url, init) => {
    const u = String(url);
    if (u === SITEVERIFY) {
      return new Response(JSON.stringify({ success: turnstileOk, 'error-codes': turnstileOk ? [] : ['invalid-input-response'] }));
    }
    if (u.startsWith('https://app.clio.com/oauth/token')) {
      return new Response(JSON.stringify({ access_token: 'at' }));
    }
    if (u.startsWith(CLIO_ENTRIES) && (init?.method ?? 'GET') === 'GET') {
      return new Response(JSON.stringify({ data: busy }));
    }
    if (u.startsWith(CLIO_ENTRIES) && init?.method === 'POST') {
      return new Response(JSON.stringify({ data: { id: 999999 } }));
    }
    throw new Error(`unstubbed fetch: ${init?.method ?? 'GET'} ${u}`);
  });
}

/** Every POST to Clio's calendar_entries — i.e. every real appointment created. */
function clioWrites(fetchStub) {
  return fetchStub.calls.filter(
    ([url, init]) => String(url).startsWith(CLIO_ENTRIES) && init?.method === 'POST',
  );
}

let mute;
beforeEach(() => { mute = muteConsole(); });
afterEach(() => { mute.restore(); });

// ── Item 3 / Sarah D3 ────────────────────────────────────────────────────────
describe('appointment type is checked against an allow-list', () => {
  test('THE DEFECT: an unknown type is 400 and books NOTHING', async () => {
    const f = stubClio();
    try {
      const res = await onRequestPost({ request: post(body({ type: 'no-such-type' })), env: env() });
      assert.equal(res.status, 400);
      assert.equal((await res.json()).code, 'VALIDATION_ERROR');
      assert.deepEqual(clioWrites(f), [], 'an unknown type must never reach the calendar');
    } finally { f.restore(); }
  });

  test('bookable set == the set /booking/types advertises, under both providers', async () => {
    // The contract stated as an equivalence rather than a literal: a caller can
    // book every type the site offers, and nothing else. Asserting against
    // /booking/types (not a hardcoded ['consult']) is what makes this survive the
    // firm adding a second appointment type — a copy of the list inside create.js
    // would silently start refusing it, and this test would say so.
    for (const [label, extraEnv] of [['clio', {}], ['mock', { BOOKING_PROVIDER: 'mock' }]]) {
      const f = stubClio();
      try {
        const advertised = (await (await onRequestGet({ env: env(extraEnv) })).json()).types;
        assert.ok(advertised.length > 0, `${label}: nothing advertised`);

        for (const t of advertised) {
          const res = await onRequestPost({ request: post(body({ type: t.id })), env: env(extraEnv) });
          assert.equal(res.status, 201, `${label}: advertised type ${t.id} must be bookable`);
        }

        const ids = new Set(advertised.map((t) => t.id));
        for (const bad of ['no-such-type', 'followup', 'Consultation']) {
          if (ids.has(bad)) continue;
          const res = await onRequestPost({ request: post(body({ type: bad })), env: env(extraEnv) });
          assert.equal(res.status, 400, `${label}: unadvertised type ${bad} must be refused`);
        }
      } finally { f.restore(); }
    }
  });

  test('the match is exact — no case-folding, no prefix, no path tricks', async () => {
    const f = stubClio();
    try {
      // NOT included: 'consult ' with a trailing space. create.js trims `type`
      // alongside every other field, so by match time that IS 'consult'.
      // Normalizing whitespace is intended; asserting otherwise would be
      // testing a behaviour we do not want.
      for (const bad of ['', ' ', 'CONSULT', 'Consult', 'consul', 'consultx', 'consult; DROP', '../consult']) {
        const res = await onRequestPost({ request: post(body({ type: bad })), env: env() });
        assert.equal(res.status, 400, `type=${JSON.stringify(bad)} must be refused`);
      }
      assert.deepEqual(clioWrites(f), []);
    } finally { f.restore(); }
  });
});

// ── Items 1 + 2 ──────────────────────────────────────────────────────────────
describe('Turnstile fails closed on the booking write', () => {
  test('THE DEFECT: an unset TURNSTILE_SECRET_KEY is 503, not a pass-through', async () => {
    const f = stubClio();
    try {
      const res = await onRequestPost({
        request: post(body()),
        env: env({ TURNSTILE_SECRET_KEY: undefined }),
      });
      assert.equal(res.status, 503);
      assert.equal((await res.json()).code, 'TURNSTILE_NOT_CONFIGURED');
      assert.deepEqual(clioWrites(f), [], 'an unverified request must never reach the calendar');
      assert.ok(mute.saw('MISCONFIGURED'), 'a misconfigured deployment must be loud in the logs');
    } finally { f.restore(); }
  });

  test('the OLD secret name no longer enables anything', async () => {
    // Before this change create.js read TURNSTILE_SECRET. If any code still honours
    // that name, setting it alone would be enough to book — it must not be.
    const f = stubClio();
    try {
      const res = await onRequestPost({
        request: post(body()),
        env: env({ TURNSTILE_SECRET_KEY: undefined, TURNSTILE_SECRET: 'test-secret' }),
      });
      assert.equal(res.status, 503, 'TURNSTILE_SECRET must be a dead name');
      assert.deepEqual(clioWrites(f), []);
    } finally { f.restore(); }
  });

  test('a missing token is 403 and books nothing', async () => {
    const f = stubClio();
    try {
      const res = await onRequestPost({ request: post(body({ turnstile_token: '' })), env: env() });
      assert.equal(res.status, 403);
      assert.equal((await res.json()).code, 'TURNSTILE_REQUIRED');
      assert.deepEqual(clioWrites(f), []);
    } finally { f.restore(); }
  });

  test('a token siteverify rejects is 403 and books nothing', async () => {
    const f = stubClio({ turnstileOk: false });
    try {
      const res = await onRequestPost({ request: post(body({ turnstile_token: 'forged' })), env: env() });
      assert.equal(res.status, 403);
      assert.equal((await res.json()).code, 'TURNSTILE_FAILED');
      assert.deepEqual(clioWrites(f), []);
    } finally { f.restore(); }
  });
});

// ── Item 4 / Sarah D4 ────────────────────────────────────────────────────────
describe('availability is re-checked immediately before the write', () => {
  test('THE DEFECT: a slot that went busy after selection is 409, and books NOTHING', async () => {
    // The calendar now reports an entry covering the requested slot — exactly the
    // state Sarah produced by booking the same slot twice.
    const f = stubClio({
      busy: [{ start_at: SLOT, end_at: new Date(Date.parse(SLOT) + 30 * 60_000).toISOString() }],
    });
    try {
      const res = await onRequestPost({ request: post(body()), env: env() });
      assert.equal(res.status, 409);
      assert.equal((await res.json()).code, 'SLOT_TAKEN');
      assert.deepEqual(clioWrites(f), [], 'the double-booking write must not happen');
    } finally { f.restore(); }
  });

  test('CONTROL: the same request against a free calendar is 201', async () => {
    // Without this, every assertion above would also pass if the endpoint had been
    // broken into refusing everything.
    const f = stubClio({ busy: [] });
    try {
      const res = await onRequestPost({ request: post(body()), env: env() });
      assert.equal(res.status, 201);
      const j = await res.json();
      assert.equal(j.ok, true);
      assert.equal(j.provider_ref, '999999');
      assert.equal(clioWrites(f).length, 1, 'exactly one calendar entry');
    } finally { f.restore(); }
  });

  test('a partially-overlapping entry still blocks the slot', async () => {
    // Busy 14:15–14:45 leaves no clean 14:00–14:30; a naive exact-start comparison
    // against busy blocks would miss this.
    const f = stubClio({
      busy: [{
        start_at: new Date(Date.parse(SLOT) + 15 * 60_000).toISOString(),
        end_at:   new Date(Date.parse(SLOT) + 45 * 60_000).toISOString(),
      }],
    });
    try {
      const res = await onRequestPost({ request: post(body()), env: env() });
      assert.equal(res.status, 409);
      assert.deepEqual(clioWrites(f), []);
    } finally { f.restore(); }
  });

  test('an off-grid slot inside business hours is refused', async () => {
    // 14:07Z is not on the 30-minute grid, so it was never an offerable slot even
    // though it passes the ISO-8601 + in-the-future validation.
    const f = stubClio();
    try {
      const offGrid = new Date(Date.parse(SLOT) + 7 * 60_000).toISOString();
      const res = await onRequestPost({ request: post(body({ slot: offGrid })), env: env() });
      assert.equal(res.status, 409);
      assert.deepEqual(clioWrites(f), []);
    } finally { f.restore(); }
  });

  test('a slot outside the business window is refused', async () => {
    const f = stubClio();
    try {
      const midnight = new Date(Date.parse(SLOT) + 12 * 3600_000).toISOString(); // 02:00Z next day
      const res = await onRequestPost({ request: post(body({ slot: midnight })), env: env() });
      assert.equal(res.status, 409);
      assert.deepEqual(clioWrites(f), []);
    } finally { f.restore(); }
  });

  test('a calendar we cannot read is 502, not an optimistic write', async () => {
    // Fail-closed: if the availability read fails we do not know the slot is free,
    // so we must not create the appointment.
    const f = stubFetch(async (url, init) => {
      const u = String(url);
      if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
      if (u.startsWith('https://app.clio.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));
      if (u.startsWith(CLIO_ENTRIES) && (init?.method ?? 'GET') === 'GET') {
        return new Response('upstream boom', { status: 500 });
      }
      if (u.startsWith(CLIO_ENTRIES) && init?.method === 'POST') {
        return new Response(JSON.stringify({ data: { id: 1 } }));
      }
      throw new Error(`unstubbed fetch: ${u}`);
    });
    try {
      const res = await onRequestPost({ request: post(body()), env: env() });
      assert.equal(res.status, 502);
      assert.equal((await res.json()).code, 'PROVIDER_ERROR');
      assert.deepEqual(clioWrites(f), []);
    } finally { f.restore(); }
  });
});

// ── Ordering ─────────────────────────────────────────────────────────────────
describe('the guards run before anything with a side effect', () => {
  test('an unknown type is refused without even calling siteverify', async () => {
    // Cheap-and-local validation first: a junk request must not cost an outbound
    // call, and the 400 must not depend on Turnstile being configured.
    const f = stubClio();
    try {
      const res = await onRequestPost({
        request: post(body({ type: 'no-such-type' })),
        env: env({ TURNSTILE_SECRET_KEY: undefined }),
      });
      assert.equal(res.status, 400, 'type validation precedes the Turnstile gate');
      assert.deepEqual(f.calls, [], 'no outbound call at all');
    } finally { f.restore(); }
  });

  test('a rejected booking never reaches the availability read either', async () => {
    const f = stubClio();
    try {
      await onRequestPost({ request: post(body({ turnstile_token: '' })), env: env() });
      const reads = f.calls.filter(([u, i]) => String(u).startsWith(CLIO_ENTRIES) && (i?.method ?? 'GET') === 'GET');
      assert.deepEqual(reads, [], 'no Clio traffic on a request we already refused');
    } finally { f.restore(); }
  });
});
