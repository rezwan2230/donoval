// ORDER ZANE-BOOKING-CAL-GUARD — which Clio calendar a booking writes to.
//
// ── WHY THIS FILE EXISTS (read before editing) ────────────────────────────────
// The original premise ("bookings are landing in Elroy's SANDBOX calendar, so
// Wendy can't see them") was DISPROVEN. In production CLIO_CALENDAR_ID is set to
// the firm calendar 9084638; resolveConfig() honors it; bookings DO land in the
// firm's Clio. The reason Wendy couldn't see them was an Outlook VIEW FILTER, not
// a code path. There is no live calendar-target defect to reproduce.
//
// So this is NOT a bug-reproduction. It is a CONFIG-REGRESSION / DEPLOY GUARD:
// it pins the contract that (1) when CLIO_CALENDAR_ID is set the write targets
// exactly that calendar, (2) it steers independently of any other value, (3) the
// unset case now FAILS CLOSED — resolveConfig throws MISSING_CALENDAR_CONFIG and
// the route returns 503, never the sandbox (SHELDON-BOOKING-FAILCLOSE-V2, merged),
// and (4) a live deploy is not shipping the sandbox id.
//
// Harness: matches test/booking-create.test.mjs exactly — same env(), body(),
// futureMondaySlot(), stubClio(), per-request IP. A booking only reaches Clio
// after passing Turnstile + slot-grid + availability guards, so every e2e case
// here uses a good token, a real future Monday slot, and a free calendar; the
// ONLY variable under test is which calendar_owner.id the write carries.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import { resolveConfig } from '../donovan-legal-site/functions/booking/_lib/config.js';
import { stubFetch, muteConsole } from './helpers/stubs.mjs';

// Real values, not placeholders:
//   9151718 = Elroy's sandbox UserCalendar (the code default in config.js)
//   9084638 = Donovan Legal firm calendar (the production CLIO_CALENDAR_ID)
const SANDBOX_CALENDAR_ID = 9151718;
const FIRM_CALENDAR_ID = 9084638;

const SITEVERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES = 'https://app.clio.com/api/v4/calendar_entries';

/** Env with Clio wired to the stubbed fetch. Extra keys (e.g. CLIO_CALENDAR_ID) via `over`. */
function env(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    CLIO_CLIENT_ID: 'cid',
    CLIO_CLIENT_SECRET: 'csec',
    CLIO_REFRESH_TOKEN: 'rtok',
    ...over,
  };
}

/** Next Monday ≥7 days out at 14:00Z — on the 09:00-start 30-min grid under EDT and EST. */
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

// create.js keeps a module-level 10/min/IP rate-limit map that outlives each test,
// so every request gets a fresh IP.
let _ipSeq = 0;
function nextIp() { _ipSeq += 1; return `203.0.113.${_ipSeq % 250}`; }

function post(b, { ip = nextIp() } = {}) {
  return new Request('https://www.donovan.law/booking/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(b),
  });
}

/** Stub the Clio + Turnstile edges. Free calendar + valid Turnstile by default. */
function stubClio({ busy = [], turnstileOk = true } = {}) {
  return stubFetch(async (url, init) => {
    const u = String(url);
    if (u === SITEVERIFY) {
      return new Response(JSON.stringify({ success: turnstileOk, 'error-codes': [] }));
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

/** The parsed body of the single POST that created a calendar entry (or null). */
function writtenEntry(fetchStub) {
  const write = fetchStub.calls.find(
    ([url, init]) => String(url).startsWith(CLIO_ENTRIES) && init?.method === 'POST',
  );
  return write ? JSON.parse(write[1].body) : null;
}

/** The calendar the write actually targeted: data.calendar_owner.id. */
function writtenCalendarId(fetchStub) {
  return writtenEntry(fetchStub)?.data?.calendar_owner?.id;
}

let mute;
beforeEach(() => { mute = muteConsole(); });
afterEach(() => { mute.restore(); });

// ── Unit: resolveConfig steering (no network) ─────────────────────────────────
describe('resolveConfig picks the calendar from CLIO_CALENDAR_ID', () => {
  test('set → the config carries exactly that calendar, as a Number', () => {
    const { config } = resolveConfig(env({ CLIO_CALENDAR_ID: String(FIRM_CALENDAR_ID) }));
    assert.equal(config.calendar_id, FIRM_CALENDAR_ID);
    assert.equal(typeof config.calendar_id, 'number', 'must be coerced to Number for the Clio body');
  });

  test('two different ids steer independently — no hardcoded firm id in the path', () => {
    // If create.js/config.js ever hardcoded a calendar, one of these would be wrong.
    assert.equal(resolveConfig(env({ CLIO_CALENDAR_ID: '111' })).config.calendar_id, 111);
    assert.equal(resolveConfig(env({ CLIO_CALENDAR_ID: '222' })).config.calendar_id, 222);
  });

  test('FAIL-CLOSED: unset CLIO_CALENDAR_ID throws MISSING_CALENDAR_CONFIG', () => {
    // Post SHELDON-BOOKING-FAILCLOSE-V2 there is no safe default calendar: an unset
    // id must throw rather than fall back to Elroy's sandbox (9151718).
    assert.throws(
      () => resolveConfig(env()),
      (e) => e?.code === 'MISSING_CALENDAR_CONFIG',
      'unset calendar config must throw MISSING_CALENDAR_CONFIG',
    );
  });

  test('blank / whitespace CLIO_CALENDAR_ID is treated as unset → throws', () => {
    assert.throws(() => resolveConfig(env({ CLIO_CALENDAR_ID: '' })),    (e) => e?.code === 'MISSING_CALENDAR_CONFIG');
    assert.throws(() => resolveConfig(env({ CLIO_CALENDAR_ID: '   ' })), (e) => e?.code === 'MISSING_CALENDAR_CONFIG');
  });
});

// ── E2E: the id actually reaches the wire as calendar_owner.id ────────────────
describe('a real booking targets the configured calendar', () => {
  test('CLIO_CALENDAR_ID set → the created entry targets the firm calendar', async () => {
    const f = stubClio({ busy: [] });
    try {
      const res = await onRequestPost({
        request: post(body()),
        env: env({ CLIO_CALENDAR_ID: String(FIRM_CALENDAR_ID) }),
      });
      assert.equal(res.status, 201, 'happy-path booking must succeed');
      const entry = writtenEntry(f);
      assert.ok(entry, 'exactly one calendar entry was written');
      assert.equal(entry.data.calendar_owner.id, FIRM_CALENDAR_ID, 'wrong calendar targeted');
      assert.equal(entry.data.calendar_id, undefined, 'must use calendar_owner, never top-level calendar_id');
    } finally { f.restore(); }
  });

  test('the write NEVER silently targets the sandbox when a firm id is configured', async () => {
    const f = stubClio({ busy: [] });
    try {
      await onRequestPost({
        request: post(body()),
        env: env({ CLIO_CALENDAR_ID: String(FIRM_CALENDAR_ID) }),
      });
      assert.notEqual(writtenCalendarId(f), SANDBOX_CALENDAR_ID, 'sandbox leak into a configured deploy');
    } finally { f.restore(); }
  });

  test('CONTROL: with no CLIO_CALENDAR_ID the booking is refused 503, never the sandbox', async () => {
    // Post fail-close, an unconfigured deploy must REFUSE — not silently write to
    // the sandbox. resolveConfig throws before any outbound call, so the endpoint
    // returns 503 MISSING_CALENDAR_CONFIG and never reaches Clio. Proves the e2e
    // path honors resolveConfig and is not pinned to one id.
    const f = stubClio({ busy: [] });
    try {
      const res = await onRequestPost({ request: post(body()), env: env() });
      assert.equal(res.status, 503);
      assert.equal((await res.json()).code, 'MISSING_CALENDAR_CONFIG');
      assert.deepEqual(f.calls, [], 'a misconfigured deploy must never reach Clio');
    } finally { f.restore(); }
  });
});

// ── DEPLOY GUARD: the real environment is not shipping the sandbox ────────────
// Not a unit test. Run it where the real CLIO_CALENDAR_ID is injected (a deploy
// preflight step), gated so it never fails CI where the secret is absent:
//   CHECK_DEPLOY_CONFIG=1 node --test test/booking-calendar-target.test.mjs
describe('deploy guard: production is pointed at the firm calendar', () => {
  const gate = process.env.CHECK_DEPLOY_CONFIG
    ? false
    : 'skipped: set CHECK_DEPLOY_CONFIG=1 with the real CLIO_CALENDAR_ID in env to run';

  test('CLIO_CALENDAR_ID is set, numeric, and not the sandbox', { skip: gate }, () => {
    const raw = process.env.CLIO_CALENDAR_ID;
    assert.ok(raw && raw.trim() !== '', 'CLIO_CALENDAR_ID must be set for production');
    const id = Number(raw);
    assert.ok(Number.isInteger(id) && id > 0, `CLIO_CALENDAR_ID must be a positive integer, got ${JSON.stringify(raw)}`);
    assert.notEqual(id, SANDBOX_CALENDAR_ID, 'production must not point at Elroy\'s sandbox calendar');
  });
});

// ── STATUS: fail-closed is LIVE ───────────────────────────────────────────────
// resolveConfig previously failed OPEN (unset CLIO_CALENDAR_ID → sandbox default,
// silently). As of SHELDON-BOOKING-FAILCLOSE-V2 (merged) it FAILS CLOSED: unset
// throws MISSING_CALENDAR_CONFIG, and create.js + the read handlers return 503.
// The unit and CONTROL assertions above encode that contract — if anyone reverts
// the throw or restores the sandbox fallback, this guard goes red.
