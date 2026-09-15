// ORDER SHELDON-PERCH-A32-CALLID-BIND (#57) — the Perch qualifier may only join a
// booking when the SERVER can confirm the submitted call_id names a real call.
//
// Sarah's A4.1 cutover gate found /booking/create read `call_id` from the request
// body and trusted it: the Vantage merge key was the raw body value with no check
// at all, so a forged id folded a stranger's booking into another caller's lead.
// The thread worked end-to-end; it was simply only as trustworthy as the browser.
//
// Every test here asserts BOTH halves of the contract, because either alone is a
// false pass:
//   1. the qualifier context is attached ONLY when a server-written record exists
//      (the Clio calendar description AND the Vantage merge key), and
//   2. the booking itself NEVER fails on this path — a forged id, a missing id, a
//      dead KV and a dead bridge all still return 201 with the Clio write intact.
//
// The two server-side records are the ones fn/qualifier_submit writes: the
// PERCH_BRIDGE DO slot `qual:<callId>` (probed non-destructively via /has) and the
// durable KV copy `qualbk:<callId>` that carries the summary text.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import { QUALIFIER_JOIN } from '../donovan-legal-site/functions/booking/_lib/qualifier-bind.js';
import { stubFetch, muteConsole, makeKV, makeBrokenKV, makeDurableObject } from './helpers/stubs.mjs';
import { assertCarriesUrl } from './helpers/url-lines.mjs';

const SITEVERIFY     = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES   = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS  = 'https://app.clio.com/api/v4/contacts';
const CLIO_NOTES     = 'https://app.clio.com/api/v4/notes';
const GROW_INBOX     = 'https://grow.clio.com/inbox_leads';
const VANTAGE_UPSERT = 'https://vantage.ticoai.net/upsert-lead';
const CONTACT_ID     = 4242;
const MEETING_LINK   = 'https://meet.donovan.law/consult';

// The plain-English block fn/qualifier_submit stores under `qualbk:<callId>`.
// The Income/Net worth lines are the ones fn/qualifier_submit renders from
// income_band and net_worth_band. They are in this fixture on purpose: after
// SHELDON-CLIO-CONFIRM-EMAIL the calendar description is emailed to the CLIENT,
// so "the summary is not in the description" is only worth asserting if the
// fixture summary actually carries the material that must not be emailed.
const SUMMARY = [
  '— Perch intake —',
  'Matter: Real estate → Acquisition',
  'Citizenship: U.S. citizen',
  'Income: $1.5M–$3M',
  'Net worth: $5M–$15M',
].join('\n');

/** Substrings that must never appear in a client-facing calendar description. */
const BANDS = ['Income: $1.5M–$3M', 'Net worth: $5M–$15M', '— Perch intake —'];

const REAL_CALL = 'call_9f2c7a1b';
const FORGED    = 'call_deadbeefdeadbeef';

function env(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    CLIO_CLIENT_ID: 'cid',
    CLIO_CLIENT_SECRET: 'csec',
    CLIO_REFRESH_TOKEN: 'rtok',
    CLIO_CALENDAR_ID: 9084638,
    GROW_LEAD_TOKEN: 'grow-tok',
    VANTAGE_WRITE_SECRET: 'vantage-write-secret',
    // SHELDON-CLIO-CONFIRM-EMAIL: the Manage contact is what attaches the attendee
    // (⇒ Clio sends the confirmation email) AND what the intake note hangs off, so
    // this whole file now runs the live-posture path. David owns the real value.
    CLIO_CREATE_CONTACT: '1',
    BOOKING_MEETING_LINK: MEETING_LINK,
    ...over,
  };
}

/** KV pre-loaded with the back-office qualifier copy for `callId`. */
function kvWithQualifier(callId = REAL_CALL, summary = SUMMARY) {
  return makeKV({ [`qualbk:${callId}`]: JSON.stringify({ summary, matter: 'real_estate' }) });
}

/**
 * Bridge DO whose `qual:<callId>` slot is populated — i.e. the caller finished the
 * qualifier and Paula has NOT yet consumed the read-once slot.
 *
 * Seeded through the instance store directly rather than through /set so the test
 * does not depend on qualifier_submit's write path to prove create.js's read path.
 * 'donovan' is DEFAULT_TENANT_ID (functions/_lib/tenant.js).
 */
function bridgeWithQualifier(callId = REAL_CALL) {
  const ns = makeDurableObject();
  ns.instance('donovan').state.set(`qual:${callId}`, { status: 'complete' });
  return ns;
}

/** Bridge DO that is reachable but holds nothing — Paula already read the slot. */
function emptyBridge() {
  const ns = makeDurableObject();
  ns.instance('donovan'); // materialise the instance so probes hit a real store
  return ns;
}

function futureMondaySlot() {
  const d = new Date(Date.now() + 7 * 86400_000);
  d.setUTCHours(14, 0, 0, 0);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
const SLOT = futureMondaySlot();

const NAME  = 'Jane Q Caller';
const EMAIL = 'jane.caller@example.com';
const PHONE = '555-0142';

function body(over = {}) {
  return {
    type: 'consult',
    slot: SLOT,
    name: NAME,
    email: EMAIL,
    phone: PHONE,
    turnstile_token: 'good-token',
    ...over,
  };
}

// create.js keeps a MODULE-level rate-limit map (10/min/IP); give each request its
// own IP or later tests 429 for reasons unrelated to what they assert.
let _ipSeq = 0;
const nextIp = () => `203.0.113.${(_ipSeq += 1) % 250}`;

function post(b, { ip = nextIp() } = {}) {
  return new Request('https://www.donovan.law/booking/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip },
    body: JSON.stringify(b),
  });
}

function stubAll() {
  return stubFetch(async (url, init) => {
    const u = String(url);
    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
    if (u.startsWith('https://app.clio.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));
    if (u.startsWith(CLIO_ENTRIES) && (init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ data: [] }));
    if (u.startsWith(CLIO_ENTRIES) && init?.method === 'POST') return new Response(JSON.stringify({ data: { id: 999999 } }));
    // Contact search finds nobody, so the adapter creates one — the id below is
    // what must show up as the calendar-entry ATTENDEE and as the note's contact.
    if (u.startsWith(CLIO_CONTACTS) && (init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ data: [] }));
    if (u.startsWith(CLIO_CONTACTS) && init?.method === 'POST') return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
    if (u.startsWith(CLIO_NOTES) && init?.method === 'POST') return new Response(JSON.stringify({ data: { id: 77 } }));
    if (u.startsWith(GROW_INBOX)) return new Response(JSON.stringify({ ok: true }));
    if (u.startsWith(VANTAGE_UPSERT)) return new Response(JSON.stringify({ ok: true }));
    throw new Error(`unstubbed fetch: ${init?.method ?? 'GET'} ${u}`);
  });
}

const clioWrites = (f) => f.calls.filter(([u, i]) => String(u).startsWith(CLIO_ENTRIES) && i?.method === 'POST');
const growWrites = (f) => f.calls.filter(([u]) => String(u).startsWith(GROW_INBOX));
const vantageCalls = (f) => f.calls.filter(([u]) => String(u).startsWith(VANTAGE_UPSERT));

/** The `description` field of the single Clio calendar entry POST. */
function clioDescription(f) {
  const w = clioWrites(f);
  assert.equal(w.length, 1, 'exactly one Clio calendar entry');
  return JSON.parse(w[0][1].body).data.description ?? '';
}

/** The parsed `data` of the single Clio calendar entry POST. */
function clioEntry(f) {
  const w = clioWrites(f);
  assert.equal(w.length, 1, 'exactly one Clio calendar entry');
  return JSON.parse(w[0][1].body).data;
}

const noteWrites = (f) => f.calls.filter(([u, i]) => String(u).startsWith(CLIO_NOTES) && i?.method === 'POST');

/**
 * The parsed `data` of the single contact-note POST — the ATTORNEY-SIDE half of
 * the description split. `null` when no note was filed at all.
 */
function clioNote(f) {
  const n = noteWrites(f);
  if (!n.length) return null;
  assert.equal(n.length, 1, 'exactly one contact note');
  return JSON.parse(n[0][1].body).data;
}

/**
 * Assert the calendar-entry description is safe to email to the client.
 *
 * Called from every test that produces an entry, because "the bands are not in
 * the description" is a property of EVERY booking, not of one code path.
 */
function assertDescriptionIsClientSafe(desc) {
  for (const band of BANDS) {
    assert.ok(!desc.includes(band), `description must not carry "${band}" — Clio emails it to the client.\nGot:\n${desc}`);
  }
  assert.ok(desc.includes('Initial Consultation'), 'the description says what the consultation is');
  assertCarriesUrl(desc, MEETING_LINK, 'the description carries the meeting link');
  assert.ok(/reschedule/i.test(desc), 'the description carries a reschedule line');
}

/**
 * The Vantage severance, asserted where the merge key used to be read.
 *
 assertNoVantageCall(f);
 * returned its query params, so each test could ask whether `call_id` had become the
 * merge key. booking/create.js no longer issues that request at all.
 *
 * Inverted rather than deleted — "no lead data leaves the firm's infrastructure" is
 * worth its own guard, and a silent zero would look identical to a stub that had
 * quietly stopped recording. What these tests were really proving, that a verified id
 * joins and an unverified one does not, is asserted on `bookingRecord(kv)
 * .qualifier_join` — the firm's own audit row, which every one of them already
 * checked alongside the merge key.
 */
function assertNoVantageCall(f) {
  assert.deepEqual(vantageCalls(f), [],
    'no Vantage upsert-lead may be issued — the integration is severed');
}

/** The `booking:<id>` record create.js mirrored to KV — the back-office audit row. */
function bookingRecord(kv) {
  const key = [...kv._store.keys()].find((k) => k.startsWith('booking:'));
  assert.ok(key, 'a booking:<id> record was written');
  return JSON.parse(kv._store.get(key));
}

let mute;
beforeEach(() => { mute = muteConsole(); });
afterEach(() => { mute.restore(); });

// ── 1. VALID call_id ──────────────────────────────────────────────────────────
describe('a server-confirmed call_id attaches the qualifier to Clio and Vantage', () => {
  test('THE FEATURE: KV record present ⇒ summary on the Clio CONTACT NOTE, merge key to Vantage', async () => {
    const f = stubAll();
    const kv = kvWithQualifier();
    try {
      const res = await onRequestPost({
        request: post(body({ call_id: REAL_CALL, notes: 'Bringing my spouse.' })),
        env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: emptyBridge() }),
      });
      assert.equal(res.status, 201);

      // SHELDON-CLIO-CONFIRM-EMAIL inverted WHERE this lands. The description is now
      // emailed verbatim to the client, so the qualifier — bands and all — moved to a
      // note on the contact. Paul still reads every word of it; the client never does.
      const desc = clioDescription(f);
      assertDescriptionIsClientSafe(desc);
      assert.ok(!desc.includes('Bringing my spouse.'), 'not even the typed notes ride the client-facing description');

      const note = clioNote(f);
      assert.ok(note, 'an intake note was filed');
      assert.equal(note.type, 'Contact', 'the note is associated to a Contact');
      assert.equal(note.contact.id, CONTACT_ID, 'and to THIS caller\'s contact');
      assert.ok(note.detail.includes('Bringing my spouse.'), 'the typed notes are preserved — on the note');
      assert.ok(note.detail.includes('— Perch intake —'), 'the qualifier block reached Clio');
      assert.ok(note.detail.includes('Citizenship: U.S. citizen'), 'the qualifier answers reached Clio');
      for (const band of BANDS) assert.ok(note.detail.includes(band), `the note carries "${band}" — this is the attorney-side copy`);

      // Wendy's Grow lead gets the same enriched notes.
      assert.equal(growWrites(f).length, 1, 'exactly one Grow lead');
      assert.ok(String(growWrites(f)[0][1].body).includes('Perch intake'), 'the qualifier block reached Grow');

      // Vantage merges into the lead the call already opened.
      assertNoVantageCall(f);

      const rec = bookingRecord(kv);
      assert.equal(rec.qualifier_join, QUALIFIER_JOIN.ATTACHED);
      assert.equal(rec.qualifier_source, 'kv');
    } finally { f.restore(); }
  });

  // REMOVED: the bridge DO slot alone confirms the id (KV copy expired) — merge key yes, summary no
  // its premise was the DO confirming an id the KV copy had outlived. The DO is gone, so KV is the only witness and 'the other store alone' is not a reachable state.

  // REMOVED: the probe is NON-destructive — it must not consume Paula's read-once slot
  // the /has probe went with the bridge DO, and Paula's read-once slot with it.

  test('the join is one-shot — a second booking on the same call cannot re-append', async () => {
    const f = stubAll();
    const kv = kvWithQualifier();
    const e = env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: emptyBridge() });
    try {
      await onRequestPost({ request: post(body({ call_id: REAL_CALL })), env: e });
      assert.equal(kv._store.has(`qualbk:${REAL_CALL}`), false, 'the KV copy is cleared after the join');

      const beforeEntries = clioWrites(f).length;
      const beforeNotes = noteWrites(f).length;
      await onRequestPost({ request: post(body({ call_id: REAL_CALL, slot: SLOT })), env: e });
      const second = clioWrites(f)[beforeEntries];
      assert.ok(second, 'the second booking still wrote to Clio');
      // Assert on the note, which is where the summary now lives. Asserting on the
      // description would pass vacuously — nothing can put a summary there any more.
      const secondNote = noteWrites(f)[beforeNotes];
      assert.ok(secondNote, 'the second booking still filed a note');
      assert.ok(!JSON.parse(secondNote[1].body).data.detail.includes('Perch intake'),
        'the summary is not appended twice');
    } finally { f.restore(); }
  });
});

// ── 2. FORGED call_id ─────────────────────────────────────────────────────────
describe('a forged call_id completes the booking with NO qualifier context', () => {
  test('THE GUARD: no server record ⇒ nothing in Clio, no merge key, still 201', async () => {
    const f = stubAll();
    // A real qualifier exists for REAL_CALL; the attacker submits a different id.
    const kv = kvWithQualifier(REAL_CALL);
    try {
      const res = await onRequestPost({
        request: post(body({ call_id: FORGED, notes: 'my own notes' })),
        env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: emptyBridge() }),
      });
      assert.equal(res.status, 201, 'a forged id must not fail the booking');

      const desc = clioDescription(f);
      assertDescriptionIsClientSafe(desc);
      assert.ok(!desc.includes('my own notes'), 'the description is client-safe regardless of the join outcome');
      assert.ok(clioNote(f).detail.includes('my own notes'), 'the typed notes are kept — on the contact note');
      assert.ok(!clioNote(f).detail.includes('Perch intake'), 'no qualifier block is attached');

      assertNoVantageCall(f);

      assert.equal(bookingRecord(kv).qualifier_join, QUALIFIER_JOIN.UNVERIFIED);
      assert.equal(kv._store.has(`qualbk:${REAL_CALL}`), true,
        'the genuine caller\'s record is untouched by the forgery');
    } finally { f.restore(); }
  });

  test('a forged id cannot borrow the bridge either', async () => {
    const f = stubAll();
    const kv = makeKV();
    try {
      await onRequestPost({
        request: post(body({ call_id: FORGED })),
        env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: bridgeWithQualifier(REAL_CALL) }),
      });
      assertNoVantageCall(f);
      assert.equal(bookingRecord(kv).qualifier_join, QUALIFIER_JOIN.UNVERIFIED);
    } finally { f.restore(); }
  });

  test('the reserved `default` bucket can never be claimed', async () => {
    // B2 removed the shared 'default' bucket from qualifier_submit and
    // qualifier_result; a booking must not be the call site that reintroduces it.
    const f = stubAll();
    const kv = makeKV({ 'qualbk:default': JSON.stringify({ summary: SUMMARY }) });
    try {
      await onRequestPost({
        request: post(body({ call_id: 'default' })),
        env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: emptyBridge() }),
      });
      assert.ok(!clioDescription(f).includes('Perch intake'), 'the shared bucket is not readable');
      assertNoVantageCall(f);
      assert.equal(bookingRecord(kv).qualifier_join, QUALIFIER_JOIN.UNVERIFIED);
    } finally { f.restore(); }
  });

  test('a malformed call_id is rejected without ever reaching a store', async () => {
    const f = stubAll();
    const kv = makeKV();
    const bridge = emptyBridge();
    try {
      const res = await onRequestPost({
        request: post(body({ call_id: 'call/../../etc passwd?x=1' })),
        env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: bridge }),
      });
      assert.equal(res.status, 201, 'still not a reason to fail a booking');
      assert.deepEqual(bridge.probes, [], 'a malformed id is never echoed into a subrequest');
      assert.equal(kv.calls.get, 0, 'and never becomes a KV key');
      assertNoVantageCall(f);
    } finally { f.restore(); }
  });
});

// ── 3. MISSING call_id ────────────────────────────────────────────────────────
describe('a booking with no call_id is unaffected', () => {
  test('no call_id ⇒ fresh Vantage lead, plain notes, 201, recorded as "none"', async () => {
    const f = stubAll();
    const kv = makeKV();
    try {
      const res = await onRequestPost({
        request: post(body({ notes: 'no call, just booking' })),
        env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: emptyBridge() }),
      });
      assert.equal(res.status, 201);
      assert.equal(clioDescription(f).includes('Perch intake'), false);
      assertNoVantageCall(f);
      assert.equal(bookingRecord(kv).qualifier_join, QUALIFIER_JOIN.NONE);
    } finally { f.restore(); }
  });

  test('no call_id issues no lookup at all', async () => {
    const f = stubAll();
    const kv = makeKV();
    const bridge = emptyBridge();
    try {
      await onRequestPost({ request: post(body()), env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: bridge }) });
      assert.deepEqual(bridge.probes, [], 'no bridge probe');
      assert.equal(kv.calls.get, 0, 'no KV read for a qualifier that cannot exist');
    } finally { f.restore(); }
  });
});

// ── 4. The binding can never fail a booking ───────────────────────────────────
describe('the call_id path is fail-closed on attachment and fail-open on the booking', () => {
  test('a dead KV still books — and does not count as verification', async () => {
    const f = stubAll();
    try {
      const res = await onRequestPost({
        request: post(body({ call_id: REAL_CALL })),
        env: env({ PERCH_ACTIONS: makeBrokenKV(), PERCH_BRIDGE: emptyBridge() }),
      });
      // KV is also the booking mirror, so a total KV outage is the documented 207.
      assert.equal(res.status, 207, 'provider-confirmed, KV mirror failed');
      assert.equal(clioWrites(f).length, 1, 'the Clio write happened');
      assert.ok(!clioDescription(f).includes('Perch intake'), 'an unreachable store is not a confirmation');
      assertNoVantageCall(f);
    } finally { f.restore(); }
  });

  test('a throwing bridge still books, unverified', async () => {
    const f = stubAll();
    const kv = makeKV();
    const brokenBridge = {
      idFromName(n) { return { name: String(n) }; },
      get() { return { async fetch() { throw new Error('bridge down'); } }; },
    };
    try {
      const res = await onRequestPost({
        request: post(body({ call_id: REAL_CALL })),
        env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: brokenBridge }),
      });
      assert.equal(res.status, 201);
      assertNoVantageCall(f);
      assert.equal(bookingRecord(kv).qualifier_join, QUALIFIER_JOIN.UNVERIFIED);
    } finally { f.restore(); }
  });

  test('no bindings at all (local dev) still books, unverified — absent ≠ disabled', async () => {
    // The "unset means DISABLED" fail-open shape this codebase refuses everywhere:
    // with nothing to check against, the answer is "not verified", not "trust it".
    const f = stubAll();
    try {
      const res = await onRequestPost({
        request: post(body({ call_id: REAL_CALL })),
        env: env(), // no PERCH_ACTIONS, no PERCH_BRIDGE
      });
      assert.equal(res.status, 201);
      assert.equal(clioWrites(f).length, 1);
      assertNoVantageCall(f);
    } finally { f.restore(); }
  });

  test('a perch-do build without /has degrades to KV-only verification', async () => {
    // This Pages change can ship before the DO is redeployed. The old DO answers
    // any unknown path with `{}`, which must read as "unknown", never "present".
    const f = stubAll();
    const legacyBridge = {
      idFromName(n) { return { name: String(n) }; },
      get() { return { async fetch() { return new Response('{}', { headers: { 'content-type': 'application/json' } }); } }; },
    };
    try {
      const kv = kvWithQualifier();
      const res = await onRequestPost({
        request: post(body({ call_id: REAL_CALL })),
        env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: legacyBridge }),
      });
      assert.equal(res.status, 201);
      assert.ok(clioNote(f).detail.includes('Perch intake'), 'the KV copy still verifies on its own');
      assertDescriptionIsClientSafe(clioDescription(f));
      assert.equal(bookingRecord(kv).qualifier_source, 'kv');

      // …and a legacy bridge confirms nothing by itself.
      const kv2 = makeKV();
      await onRequestPost({
        request: post(body({ call_id: REAL_CALL })),
        env: env({ PERCH_ACTIONS: kv2, PERCH_BRIDGE: legacyBridge }),
      });
      assert.equal(bookingRecord(kv2).qualifier_join, QUALIFIER_JOIN.UNVERIFIED);
    } finally { f.restore(); }
  });
});

// ── 5. The outcome is recorded, and the id is not leaked ──────────────────────
describe('the join outcome is auditable without leaking the capability', () => {
  test('every outcome is logged as qualifier_join=<state>', async () => {
    const f = stubAll();
    try {
      await onRequestPost({
        request: post(body({ call_id: REAL_CALL })),
        env: env({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: emptyBridge() }),
      });
      assert.ok(mute.saw(`qualifier_join=${QUALIFIER_JOIN.ATTACHED}`), 'the attached outcome is logged');
      assert.ok(mute.saw('call_id_present=yes'));
    } finally { f.restore(); }
  });

  test('the raw call_id is never logged and never stored on the booking record', async () => {
    const f = stubAll();
    const kv = kvWithQualifier();
    try {
      await onRequestPost({
        request: post(body({ call_id: REAL_CALL, notes: 'private matter' })),
        env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: bridgeWithQualifier() }),
      });
      for (const [, line] of mute.lines) {
        assert.ok(!line.includes(REAL_CALL), `a log line leaked the call_id: ${line}`);
        for (const pii of [NAME, EMAIL, PHONE, 'private matter']) {
          assert.ok(!line.includes(pii), `a log line leaked PII (${pii}): ${line}`);
        }
      }
      const rec = bookingRecord(kv);
      assert.ok(!JSON.stringify(rec).includes(REAL_CALL), 'the bearer id is not parked in the audit record');
      assert.equal(rec.qualifier_join, QUALIFIER_JOIN.ATTACHED);
      // Was 'bridge+kv' — both stores agreeing. The bridge DO is gone, so KV is the
      // only witness and the only source it can report. The privacy assertions above,
      // which are what this test is actually for, are untouched.
      assert.equal(rec.qualifier_source, 'kv');
    } finally { f.restore(); }
  });

  test('the 201 response does not reveal whether the call_id was recognised', async () => {
    // Echoing the verification back would turn the endpoint into an oracle for
    // guessing live call ids. Verified and forged must be indistinguishable.
    const f = stubAll();
    try {
      const ok = await onRequestPost({
        request: post(body({ call_id: REAL_CALL })),
        env: env({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: emptyBridge() }),
      });
      const bad = await onRequestPost({
        request: post(body({ call_id: FORGED })),
        env: env({ PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: emptyBridge() }),
      });
      assert.equal(ok.status, bad.status, 'same status');
      assert.deepEqual(
        Object.keys(await ok.json()).sort(),
        Object.keys(await bad.json()).sort(),
        'same response shape — no verification oracle',
      );
    } finally { f.restore(); }
  });
});
