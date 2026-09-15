// JAY-TRACKING-C2 — server-side conversion reporting.
//
// This module is called from inside a confirmed booking against Paul's live Clio
// calendar, and it transmits client PII to a third party. The tests are grouped
// by the thing that would actually hurt: money (double-counted conversions
// inflating bids), privacy (raw PII leaving the edge), and availability (a Meta
// outage reaching a client who just booked).

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  capiEnabled,
  bookingEventId,
  buildUserData,
  readFbCookies,
  sendConversion,
} from '../donovan-legal-site/functions/_lib/meta-capi.js';
import {
  conversionValue,
  contextFromQualifier,
  TIER_VALUE,
  BASELINE_VALUE,
} from '../donovan-legal-site/functions/_lib/conversion-value.js';
import { bookingEventId as browserBookingEventId } from '../donovan-legal-site/js/analytics/tracker.js';
import { TIER_VALUE as BROWSER_TIER_VALUE } from '../donovan-legal-site/js/analytics/value.js';
import { resolveQualifierBinding } from '../donovan-legal-site/functions/booking/_lib/qualifier-bind.js';
import { muteConsole, makeKV } from './helpers/stubs.mjs';

const ON = {
  META_CAPI: 'on',
  META_CAPI_TOKEN: 'tok_test',
  META_DATASET_ID: '1769060274465061',
};

/** Capture what would have been POSTed to Meta without touching the network. */
function captureFetch(response = { ok: true, status: 200 }) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    return { ok: response.ok, status: response.status };
  };
  impl.calls = calls;
  return impl;
}

// ── The flag ────────────────────────────────────────────────────────────────
//
// Off is the default and must stay the default. This is what lets the whole PR
// merge and deploy without changing any live behaviour.

describe('capiEnabled — off unless deliberately turned on', () => {
  test('off with no config at all', () => {
    assert.equal(capiEnabled({}), false);
    assert.equal(capiEnabled(undefined), false);
  });

  test('off when the flag is set but the token is missing', () => {
    // Half-configured is the realistic accident: someone sets META_CAPI=on in
    // the dashboard and forgets the secret. That must be off, not a crash.
    assert.equal(capiEnabled({ META_CAPI: 'on', META_DATASET_ID: '1' }), false);
  });

  test('off when the token is present but the flag is not', () => {
    assert.equal(capiEnabled({ META_CAPI_TOKEN: 't', META_DATASET_ID: '1' }), false);
  });

  test("off for any value that is not exactly 'on'", () => {
    for (const v of ['ON ', 'true', '1', 'yes', 'off', '']) {
      assert.equal(capiEnabled({ ...ON, META_CAPI: v }), v.trim().toLowerCase() === 'on',
        `META_CAPI=${JSON.stringify(v)}`);
    }
  });

  test('on when fully configured', () => {
    assert.equal(capiEnabled(ON), true);
  });

  test('a disabled send reports why and never calls fetch', async () => {
    const f = captureFetch();
    const r = await sendConversion({}, { eventName: 'Schedule', eventId: 'x' }, f);
    assert.deepEqual(r, { sent: false, skipped: 'disabled' });
    assert.equal(f.calls.length, 0);
  });
});

// ── Money: deduplication ────────────────────────────────────────────────────

describe('deduplication — the contract that stops double-counting', () => {
  test('the server and browser derivations are byte-identical', () => {
    // THE test in this file. If these two ever diverge, every booking is counted
    // twice, the conversion volume looks great, and the bids rise to match a
    // number that is not real. Nothing else in the suite would notice.
    for (const id of ['abc123', 'call_9-x', 'A'.repeat(64), '0']) {
      assert.equal(bookingEventId(id), browserBookingEventId(id), `call_id=${id}`);
    }
  });

  test('both sides agree on the empty case', () => {
    for (const v of ['', '   ', null, undefined]) {
      assert.equal(bookingEventId(v), '');
      assert.equal(browserBookingEventId(v), '');
    }
  });

  test('the id is derived from the call_id, not random', () => {
    assert.equal(bookingEventId('abc'), 'dlbk_abc');
    assert.equal(bookingEventId('abc'), bookingEventId('abc'));
  });

  test('surrounding whitespace cannot fork the two halves', () => {
    assert.equal(bookingEventId(' abc '), 'dlbk_abc');
    assert.equal(browserBookingEventId(' abc '), 'dlbk_abc');
  });

  test('a send without an event_id is refused rather than double-counted', async () => {
    const f = captureFetch();
    const r = await sendConversion(ON, { eventName: 'Schedule', eventId: '' }, f);
    assert.deepEqual(r, { sent: false, skipped: 'no_event_id' });
    assert.equal(f.calls.length, 0, 'must not send an undeduplicatable conversion');
  });

  test('the event_id reaches Meta in the field it deduplicates on', async () => {
    const f = captureFetch();
    await sendConversion(ON, { eventName: 'Schedule', eventId: 'dlbk_abc' }, f);
    assert.equal(f.calls[0].body.data[0].event_id, 'dlbk_abc');
  });
});

// ── Privacy ─────────────────────────────────────────────────────────────────

describe('PII — nothing identifying leaves the edge unhashed', () => {
  const SECRETS = ['paul@donovan.law', '5616666022', 'Donovan'];

  test('email, phone and name are all SHA-256 hashed', async () => {
    const ud = await buildUserData({
      email: 'paul@donovan.law', phone: '(561) 666-6022', name: 'Paul Donovan',
    });
    for (const k of ['em', 'ph', 'fn', 'ln']) {
      assert.match(ud[k][0], /^[0-9a-f]{64}$/, `${k} must be a hex sha256`);
    }
  });

  test('no raw value survives anywhere in the serialized payload', async () => {
    const f = captureFetch();
    const userData = await buildUserData({
      email: 'paul@donovan.law', phone: '(561) 666-6022', name: 'Paul Donovan',
      ip: '203.0.113.7', userAgent: 'Mozilla/5.0',
    });
    await sendConversion(ON, { eventName: 'Schedule', eventId: 'e1', userData }, f);
    const wire = JSON.stringify(f.calls[0].body);
    for (const s of SECRETS) {
      assert.ok(!wire.toLowerCase().includes(s.toLowerCase()), `raw "${s}" must not be transmitted`);
    }
  });

  test('email is lower-cased before hashing, or the match rate is zero', async () => {
    // Silent-failure guard: unnormalised input still produces a valid-looking
    // hash, it just never matches anyone. Nothing errors.
    const a = await buildUserData({ email: 'Paul@Donovan.Law' });
    const b = await buildUserData({ email: 'paul@donovan.law' });
    assert.equal(a.em[0], b.em[0]);
  });

  test('phone formatting is normalised away before hashing', async () => {
    const forms = ['(561) 666-6022', '561-666-6022', '5616666022', '+1 561 666 6022', '15616666022'];
    const hashes = await Promise.all(forms.map((p) => buildUserData({ phone: p }).then((u) => u.ph[0])));
    assert.equal(new Set(hashes).size, 1, `all forms must hash alike, got ${new Set(hashes).size}`);
  });

  test('IP and user agent are sent raw — Meta requires it and they are not hashable matches', async () => {
    const ud = await buildUserData({ ip: '203.0.113.7', userAgent: 'Mozilla/5.0' });
    assert.equal(ud.client_ip_address, '203.0.113.7');
    assert.equal(ud.client_user_agent, 'Mozilla/5.0');
  });

  test('absent fields are omitted, never sent as empty hashes', async () => {
    // A hash of "" is a valid hash of a real value, and sending it would tell
    // Meta we know something we do not.
    const ud = await buildUserData({ email: '', phone: '', name: '' });
    assert.deepEqual(Object.keys(ud), []);
  });

  test('a malformed email is dropped rather than hashed as garbage', async () => {
    const ud = await buildUserData({ email: 'not-an-email' });
    assert.equal(ud.em, undefined);
  });

  test('a too-short phone is dropped', async () => {
    const ud = await buildUserData({ phone: '123' });
    assert.equal(ud.ph, undefined);
  });
});

describe('readFbCookies', () => {
  test('extracts the pixel cookies that carry the strongest match signal', () => {
    assert.deepEqual(
      readFbCookies('_fbp=fb.1.123.456; other=x; _fbc=fb.1.123.abc'),
      { fbp: 'fb.1.123.456', fbc: 'fb.1.123.abc' },
    );
  });

  test('a missing or malformed header yields nothing, never a throw', () => {
    for (const v of ['', null, undefined, 'garbage', '=;;=']) {
      assert.deepEqual(readFbCookies(v), {});
    }
  });

  test('unrelated cookies are not forwarded to Meta', () => {
    const out = readFbCookies('dl_qual=secret-token; session=abc');
    assert.deepEqual(out, {});
  });
});

// ── Availability ────────────────────────────────────────────────────────────

describe('failure is always absorbed — a booking is never harmed', () => {
  test('an HTTP error is reported, not thrown', async () => {
    const c = muteConsole();
    try {
      const f = captureFetch({ ok: false, status: 400 });
      const r = await sendConversion(ON, { eventName: 'Schedule', eventId: 'e1' }, f);
      assert.deepEqual(r, { sent: false, status: 400, error: 'http_error' });
    } finally { c.restore(); }
  });

  test('a network throw is absorbed', async () => {
    const c = muteConsole();
    try {
      const boom = async () => { throw new Error('ECONNRESET'); };
      const r = await sendConversion(ON, { eventName: 'Schedule', eventId: 'e1' }, boom);
      assert.deepEqual(r, { sent: false, error: 'network_error' });
    } finally { c.restore(); }
  });

  test('a rejection body is never logged — Meta echoes submitted fields back', async () => {
    const seen = [];
    const origWarn = console.warn;
    console.warn = (m) => seen.push(String(m));
    try {
      const f = async () => ({ ok: false, status: 400, text: async () => 'em: paul@donovan.law' });
      await sendConversion(ON, { eventName: 'Schedule', eventId: 'e1' }, f);
    } finally { console.warn = origWarn; }
    assert.ok(seen.length > 0, 'should log something');
    assert.ok(!seen.join(' ').includes('paul@donovan.law'), 'must not log the echoed payload');
  });

  test('a missing event name is refused', async () => {
    const r = await sendConversion(ON, { eventId: 'e1' }, captureFetch());
    assert.deepEqual(r, { sent: false, skipped: 'no_event_name' });
  });
});

// ── Payload shape ───────────────────────────────────────────────────────────

describe('the wire payload', () => {
  test('carries value and currency when a value is known', async () => {
    const f = captureFetch();
    await sendConversion(ON, { eventName: 'Schedule', eventId: 'e1', value: 100, currency: 'USD' }, f);
    const cd = f.calls[0].body.data[0].custom_data;
    assert.equal(cd.value, 100);
    assert.equal(cd.currency, 'USD');
  });

  test('omits value rather than sending zero', async () => {
    // A zero-valued conversion actively teaches the bidder that this conversion
    // was worthless. Omitting is neutral; zero is a negative signal.
    const f = captureFetch();
    await sendConversion(ON, { eventName: 'Schedule', eventId: 'e1', value: 0 }, f);
    const cd = f.calls[0].body.data[0].custom_data || {};
    assert.equal(cd.value, undefined);
  });

  test('marks the event as website-sourced', async () => {
    const f = captureFetch();
    await sendConversion(ON, { eventName: 'Schedule', eventId: 'e1' }, f);
    assert.equal(f.calls[0].body.data[0].action_source, 'website');
  });

  test('the access token goes in the query string, not the body', async () => {
    const f = captureFetch();
    await sendConversion(ON, { eventName: 'Schedule', eventId: 'e1' }, f);
    assert.ok(f.calls[0].url.includes('access_token=tok_test'));
    assert.ok(!JSON.stringify(f.calls[0].body).includes('tok_test'));
  });

  test('a test_event_code is forwarded only when configured', async () => {
    const f1 = captureFetch();
    await sendConversion(ON, { eventName: 'Schedule', eventId: 'e1' }, f1);
    assert.equal(f1.calls[0].body.test_event_code, undefined);

    const f2 = captureFetch();
    await sendConversion({ ...ON, META_TEST_EVENT_CODE: 'TEST123' }, { eventName: 'Schedule', eventId: 'e1' }, f2);
    assert.equal(f2.calls[0].body.test_event_code, 'TEST123');
  });

  test('a future or ancient timestamp is clamped to now', async () => {
    const f = captureFetch();
    const now = Math.floor(Date.now() / 1000);
    await sendConversion(ON, { eventName: 'Schedule', eventId: 'e1', eventTime: now + 99999 }, f);
    assert.ok(Math.abs(f.calls[0].body.data[0].event_time - now) < 5);

    const f2 = captureFetch();
    await sendConversion(ON, { eventName: 'Schedule', eventId: 'e2', eventTime: 1 }, f2);
    assert.ok(Math.abs(f2.calls[0].body.data[0].event_time - now) < 5);
  });
});

// ── The value map ───────────────────────────────────────────────────────────

describe('conversionValue — the number that sets the bid', () => {
  test('handles the capitalisation the qualifier actually writes', () => {
    // fn/qualifier_submit.js writes 'Gold'/'Platinum'/'Reserve' capitalised but
    // 'escape_hatch' lower. Untested, this is the bug where every booking scores
    // baseline and value-based bidding quietly does nothing.
    assert.equal(conversionValue({ tier: 'Gold' }), TIER_VALUE.gold);
    assert.equal(conversionValue({ tier: 'Platinum' }), TIER_VALUE.platinum);
    assert.equal(conversionValue({ tier: 'Reserve' }), TIER_VALUE.reserve);
    assert.equal(conversionValue({ tier: 'escape_hatch' }), TIER_VALUE.escape_hatch);
  });

  test('every tier the qualifier can produce is scored above baseline', () => {
    for (const t of ['Gold', 'Platinum', 'Reserve', 'escape_hatch']) {
      assert.ok(conversionValue({ tier: t }) > BASELINE_VALUE, `${t} must beat baseline`);
    }
  });

  test('the ordering matches the firm\'s own tier ladder', () => {
    assert.ok(TIER_VALUE.reserve > TIER_VALUE.diamond);
    assert.ok(TIER_VALUE.diamond > TIER_VALUE.platinum);
    assert.ok(TIER_VALUE.platinum > TIER_VALUE.gold);
    assert.ok(TIER_VALUE.gold > TIER_VALUE.escape_hatch);
  });

  test('falls back to matter, then baseline', () => {
    assert.equal(conversionValue({ matter: 'tax' }), 10);
    assert.equal(conversionValue({ tier: 'nonsense', matter: 'tax' }), 10);
    assert.equal(conversionValue({}), BASELINE_VALUE);
    assert.equal(conversionValue(), BASELINE_VALUE);
  });

  test('never returns zero or negative for any input', () => {
    const inputs = [
      {}, { tier: '' }, { tier: null }, { tier: 'toString' }, { tier: '__proto__' },
      { matter: 'constructor' }, { tier: 0 }, { tier: [] }, undefined,
    ];
    for (const i of inputs) {
      assert.ok(conversionValue(i) > 0, `${JSON.stringify(i)} produced a non-positive value`);
    }
  });

  test('prototype keys cannot be mistaken for tiers', () => {
    assert.equal(conversionValue({ tier: 'hasOwnProperty' }), BASELINE_VALUE);
  });

  test('the browser and server value maps agree', () => {
    // They are separate files by necessity — one ships to the browser, one runs
    // at the edge. A divergence means the two copies of the same conversion
    // report different values, which Meta and Google both treat as a conflict.
    assert.deepEqual({ ...BROWSER_TIER_VALUE }, { ...TIER_VALUE });
  });

  test('escape_hatch is present in both — it was missing and scored as baseline', () => {
    assert.ok('escape_hatch' in TIER_VALUE);
    assert.ok('escape_hatch' in BROWSER_TIER_VALUE);
  });
});

// ── The plumbing this PR exists to fix ──────────────────────────────────────
//
// The tier was derived in fn/qualifier_submit.js and then dropped on the floor:
// the `qualbk:` record never carried it, so booking/create.js — the one place
// that reports the conversion — could not see it. Every booking was worth the
// same to Google. These tests pin the hop shut.

describe('tier survives the KV → binding hop', () => {
  test('a record carrying a tier exposes it on the binding', async () => {
    const kv = makeKV({
      'qualbk:call-1': JSON.stringify({ summary: 'x', intake: {}, state: 'FL', tier: 'Reserve', matter: 'real_estate' }),
    });
    const b = await resolveQualifierBinding({ PERCH_ACTIONS: kv }, 'call-1');
    assert.equal(b.tier, 'reserve', 'normalised to lower case for the value map');
    assert.equal(b.matter, 'real_estate');
    assert.equal(conversionValue({ tier: b.tier }), TIER_VALUE.reserve);
  });

  test('an unverified binding still answers tier as a string, not undefined', async () => {
    // The WITHHELD literal exists precisely so a new field cannot be added to the
    // verified branch and left undefined on this one, on the path to a calendar write.
    const b = await resolveQualifierBinding({}, '');
    assert.equal(b.tier, '');
    assert.equal(b.matter, '');
    assert.ok(conversionValue({ tier: b.tier }) > 0);
  });

  test('a record predating this change degrades to baseline, not a throw', async () => {
    const kv = makeKV({ 'qualbk:call-2': JSON.stringify({ summary: 'x', intake: {}, state: 'FL' }) });
    const b = await resolveQualifierBinding({ PERCH_ACTIONS: kv }, 'call-2');
    assert.equal(b.tier, '');
    assert.equal(conversionValue({ tier: b.tier }), BASELINE_VALUE);
  });

  test('an unrecognised tier is rejected rather than forwarded to Meta', async () => {
    // KV is not a trusted input just because it is ours. This string would
    // otherwise land in an outbound analytics payload verbatim.
    const kv = makeKV({
      'qualbk:call-3': JSON.stringify({ summary: 'x', intake: {}, tier: '<script>alert(1)</script>', matter: 'junk' }),
    });
    const b = await resolveQualifierBinding({ PERCH_ACTIONS: kv }, 'call-3');
    assert.equal(b.tier, '');
    assert.equal(b.matter, '');
  });

  test('tier does NOT leak into intake — it must never become a Clio contact field', async () => {
    // The #153 write policy governs what a record may become on a client's Clio
    // record. Tier is a reporting band and was deliberately routed around it.
    const kv = makeKV({
      'qualbk:call-4': JSON.stringify({ summary: 'x', intake: {}, state: 'FL', tier: 'Gold' }),
    });
    const b = await resolveQualifierBinding({ PERCH_ACTIONS: kv }, 'call-4');
    assert.equal(b.tier, 'gold');
    assert.equal(JSON.stringify(b.intake).includes('gold'), false, 'tier must not reach the Clio contact');
    assert.equal(JSON.stringify(b.intake).toLowerCase().includes('tier'), false);
  });
});

describe('contextFromQualifier — degrades rather than throws', () => {
  test('a missing or junk record yields an empty context', () => {
    for (const v of [null, undefined, '', 42, []]) {
      const c = contextFromQualifier(v);
      assert.ok(conversionValue(c) > 0);
    }
  });

  test('a record written before tier existed still books', () => {
    // 6h TTL means old records are live across a deploy.
    const c = contextFromQualifier({ summary: 'x', matter: 'tax' });
    assert.equal(c.tier, undefined);
    assert.equal(conversionValue(c), 10);
  });

  test('non-string tier is ignored', () => {
    assert.equal(contextFromQualifier({ tier: { evil: 1 } }).tier, undefined);
  });
});
