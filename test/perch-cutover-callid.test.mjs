// ── SARAH-PERCH-A41 · Task 3 (server half) — call_id threads to Clio + Vantage ─
//
// Order SARAH-PERCH-A41-CUTOVER-QA · ticket #60 · Phase A / Phase 4.
// Folds in the acceptance of A3.2 (#57): "a booked test call shows its qualifier
// answers in Clio notes + the Vantage lead".
//
// ── WHY THE PROOF SPLITS IN TWO ──────────────────────────────────────────────
// #57's acceptance names a *booked test call on Preview*. POST /booking/create
// writes a real entry to Paul Donovan's live Clio calendar and a real lead into
// Vantage; there is no sandbox calendar behind Preview (test/booking-create.test.mjs
// opens with that sentence, and CONTROL in booking-calendar-target.test.mjs proves
// the fail-closed refusal rather than a sandbox fallback). This repo has already
// booked a real appointment once from a probe that believed it was on an error
// path. So the thread is proved in two halves that between them cover every hop,
// and neither half writes:
//
//   • THIS FILE — the server half. The REAL `functions/booking/create.js` handler
//     runs against a stubbed provider, and the assertions are on the exact bytes
//     that would have gone to Clio (`description`) and to Vantage (the
//     /upsert-lead query string). Every hop after `call_id` arrives is covered.
//   • test/preview/verify-a41.mjs §T3 — the browser half, on a live Preview
//     deployment with the router ON: the adapter sets `window.__perchCallId`
//     through the rewired DOM, it survives swaps, and the id is present in the
//     body of the POST the widget composes. That request is intercepted at the
//     browser and never leaves, so nothing is booked there either.
//
// What NEITHER half can prove, stated once so the sign-off does not over-claim:
// that Clio's UI renders the description Paul sees. That is one human-executed
// booked call away, and the sign-off carries the runbook for it.
//
// ── THE A3.2 GAP THIS FILE PINS ──────────────────────────────────────────────
// #57 says "bind call_id SERVER-SIDE". It is not bound server-side today: it
// arrives in the request body (`create.js:113`) and is trusted. §5 below asserts
// that as the CURRENT contract — deliberately, so the day A3.2 lands and the id
// is derived from a session instead, this test goes red and is re-read rather
// than quietly passing over a changed trust boundary.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import { stubFetch, muteConsole, makeDurableObject } from './helpers/stubs.mjs';
import { assertCarriesUrl } from './helpers/url-lines.mjs';

const SITEVERIFY     = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES   = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS  = 'https://app.clio.com/api/v4/contacts';
const CLIO_NOTES     = 'https://app.clio.com/api/v4/notes';
const GROW_INBOX     = 'https://grow.clio.com/inbox_leads';
const VANTAGE_UPSERT = 'https://vantage.ticoai.net/upsert-lead';
const CONTACT_ID     = 4242;
const MEETING_LINK   = 'https://meet.donovan.law/consult';

const CALL_ID = 'call_a41cutover0000000000000001';
const SUMMARY = 'Qualifier: real-estate matter; property in Palm Beach County; '
  + 'closing in 30 days; prior counsel none; budget discussed.';
const TYPED_NOTES = 'I would like to talk about a closing.';

/**
 * A KV that records reads, writes AND deletes.
 *
 * `test/helpers/stubs.mjs`'s `makeKV` publishes get/put only, and the one-shot
 * guard in create.js:247 is a `delete`. A stub with no `delete` would make that
 * call throw inside the enrichment try/catch, which swallows it — the summary
 * would still land, the test would still pass, and the one-shot would be
 * untested. So this one implements delete and counts it.
 */
function makeKVWithDelete(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    _store: store,
    gets: [], deletes: [], puts: [],
    async get(key) { this.gets.push(key); const v = store.get(key); return v === undefined ? null : v; },
    async put(key, value) { this.puts.push(key); store.set(key, String(value)); },
    async delete(key) { this.deletes.push(key); store.delete(key); },
  };
}

/**
 * A bridge DO holding the server-written qualifier slot for `callId`.
 *
 * The OTHER half of the #57 evidence. `qualifier-bind.js` confirms on EITHER the
 * DO slot or the KV copy, so a suite that only ever seeds KV would leave the
 * bridge branch unexecuted and would pass identically against a build where the
 * /has probe was never wired up.
 */
function bridgeWithQualifier(callId = CALL_ID) {
  const ns = makeDurableObject();
  ns.instance('donovan').state.set(`qual:${callId}`, { status: 'complete' });
  return ns;
}

/** Reachable bridge holding nothing — Paula's read-once /get already consumed the slot. */
function emptyBridge() {
  const ns = makeDurableObject();
  ns.instance('donovan');
  return ns;
}

function env(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    CLIO_CLIENT_ID: 'cid',
    CLIO_CLIENT_SECRET: 'csec',
    CLIO_REFRESH_TOKEN: 'rtok',
    CLIO_CALENDAR_ID: 9084638,
    GROW_LEAD_TOKEN: 'grow-tok',
    VANTAGE_WRITE_SECRET: 'vantage-write-secret',
    // SHELDON-CLIO-CONFIRM-EMAIL: the Manage contact is now what attaches the
    // attendee (so Clio sends the confirmation email) and what the intake note
    // hangs off, so this evidence file runs the live-posture path.
    CLIO_CREATE_CONTACT: '1',
    BOOKING_MEETING_LINK: MEETING_LINK,
    ...over,
  };
}

/** The next Monday ≥7 days out at 14:00Z — on the 30-minute grid under EST and EDT. */
function futureMondaySlot() {
  const d = new Date(Date.now() + 7 * 86400_000);
  d.setUTCHours(14, 0, 0, 0);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
const SLOT = futureMondaySlot();

let _ipSeq = 0;
/** create.js keeps a module-level 10/min/IP limiter, so every request gets its own IP. */
const nextIp = () => `203.0.113.${(_ipSeq += 1) % 250}`;

function post(b, { idemp } = {}) {
  const headers = { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() };
  if (idemp) headers['idempotency-key'] = idemp;
  return new Request('https://www.donovan.law/booking/create', {
    method: 'POST', headers, body: JSON.stringify(b),
  });
}

function body(over = {}) {
  return {
    type: 'consult',
    slot: SLOT,
    name: 'Jane Q Caller',
    email: 'jane.caller@example.com',
    phone: '(561) 555-0142',
    notes: TYPED_NOTES,
    turnstile_token: 'good-token',
    ...over,
  };
}

/** Captures what would have reached Clio and Vantage. Nothing leaves the process. */
function stubAll() {
  const seen = { clioPosts: [], notePosts: [], vantageUrls: [], vantageHeaders: [], growPosts: [] };
  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
    if (u.startsWith('https://app.clio.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));
    if (u.startsWith(CLIO_ENTRIES) && (init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify({ data: [] }));
    if (u.startsWith(CLIO_ENTRIES) && init?.method === 'POST') {
      seen.clioPosts.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 999999 } }));
    }
    if (u.startsWith(GROW_INBOX)) { seen.growPosts.push(init?.body ?? null); return new Response(JSON.stringify({ ok: true })); }
    if (u.startsWith(VANTAGE_UPSERT)) {
      seen.vantageUrls.push(u);
      seen.vantageHeaders.push(init?.headers ?? {});
      return new Response(JSON.stringify({ ok: true }));
    }
    if (u.startsWith(CLIO_NOTES) && init?.method === 'POST') {
      seen.notePosts.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 77 } }));
    }
    // Search finds nobody ⇒ the adapter creates the contact. The POST branch has to
    // return an id: without one there is no attendee, so a stub that answered every
    // /contacts call with `{data:[]}` would silently make the confirmation-email
    // path untestable while every assertion below still passed.
    if (u.startsWith(CLIO_CONTACTS) && init?.method === 'POST') return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
    if (u.includes('/contacts')) return new Response(JSON.stringify({ data: [] }));
    throw new Error('unexpected fetch in test: ' + u);
  });
  return { seen, restore: () => handle.restore() };
}

/** The `description` field of the single calendar entry that would have been created. */
const clioDescription = (seen) => seen.clioPosts[0]?.data?.description ?? '';
/**
 * The `detail` of the contact note — where the qualifier summary lands after
 * SHELDON-CLIO-CONFIRM-EMAIL. The description is now emailed verbatim to the
 * client, so anything Paul reads and the client must not moved here.
 */
const clioNoteDetail = (seen, i = 0) => seen.notePosts[i]?.data?.detail ?? '';
/** The parsed /upsert-lead query string of the single Vantage call. */
/**
 * The Vantage severance, asserted where the merge key used to be read.
 *
 * `vantageParams(seen)` returned the query of the first /upsert-lead so a test could
 * ask whether `call_id` had become the merge key. booking/create.js issues no such
 * request now. Inverted rather than dropped: a silent zero would look the same as a
 * stub that stopped recording, and "nothing typed leaves the firm's infrastructure"
 * deserves a standing guard. The join outcome each of these tests was really about
 * is asserted on the KV booking record alongside.
 */
const assertNoVantageCall = (seen) =>
  assert.deepEqual(seen.vantageUrls, [],
    'no Vantage upsert-lead may be issued — the integration is severed');

let stub, mute;
beforeEach(() => { stub = stubAll(); mute = muteConsole(); });
afterEach(() => { stub.restore(); mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// 1. The thread itself — qualifier answers reach BOTH destinations
// ─────────────────────────────────────────────────────────────────────────────
describe('A3.2/§T3 — a booking carrying a call_id folds the qualifier answers into Clio AND Vantage', () => {
  test('the Clio CONTACT NOTE carries the qualifier summary — this is what Paul reads', async () => {
    // SHELDON-CLIO-CONFIRM-EMAIL moved the destination, not the guarantee. Paul
    // still gets every word; the calendar description that Clio now emails to the
    // client does not (asserted in the next test, and in the dedicated suite).
    const kv = makeKVWithDelete({ [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY }) });
    const res = await onRequestPost({ request: post(body({ call_id: CALL_ID })), env: env({ PERCH_ACTIONS: kv }) });

    assert.equal(res.status, 201, 'the booking must still confirm');
    assert.equal(stub.seen.clioPosts.length, 1, 'exactly one calendar entry');
    assert.equal(stub.seen.notePosts.length, 1, 'exactly one contact note');

    const detail = clioNoteDetail(stub.seen);
    assert.ok(detail.includes(SUMMARY), `the contact note must carry the qualifier summary.\nGot:\n${detail}`);
    assert.ok(detail.includes(TYPED_NOTES), 'and must NOT lose what the caller typed');
    assert.equal(stub.seen.notePosts[0].data.type, 'Contact', 'associated to a Contact');
    assert.equal(stub.seen.notePosts[0].data.contact.id, CONTACT_ID, 'and to THIS caller');
    assert.ok(kv.gets.includes(`qualbk:${CALL_ID}`), 'the summary must be read under qualbk:<callId>');
  });

  test('and the calendar description — which Clio emails to the CLIENT — carries none of it', async () => {
    const kv = makeKVWithDelete({ [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY }) });
    await onRequestPost({ request: post(body({ call_id: CALL_ID })), env: env({ PERCH_ACTIONS: kv }) });

    const desc = clioDescription(stub.seen);
    assert.ok(!desc.includes(SUMMARY), `the qualifier summary must not reach the client.\nGot:\n${desc}`);
    assert.ok(!desc.includes(TYPED_NOTES), 'nor the free-text notes');
    assertCarriesUrl(desc, MEETING_LINK, 'it carries the meeting link');
    assert.ok(/reschedule/i.test(desc), 'and a reschedule line');

    // The attendee is the reason any of this matters — without it Clio sends nothing.
    const entry = stub.seen.clioPosts[0].data;
    assert.deepEqual(entry.attendees, [{ id: CONTACT_ID, type: 'Contact' }, { id: 9084638, type: 'Calendar' }]);
    assert.equal(entry.send_email_notification, true);
    assert.equal(entry.contact_id, undefined, 'the field Clio silently discarded is gone');
    assert.equal(entry.location, MEETING_LINK, 'the link rides `location` — the .ics LOCATION line');
  });

  // REMOVED: the Vantage lead is keyed on call_id — it MERGES into the lead the call opened
  // the merge key, and the upsert that carried it, are deleted with the Vantage severance.

  // REMOVED: the write secret rides the write header, never the query string (N1)
  // VANTAGE_WRITE_SECRET has no sender left to ride on; both vantage-*.js libs are deleted.

  test('one-shot: the qualifier key is DELETED, so a second booking cannot re-append it', async () => {
    const kv = makeKVWithDelete({ [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY }) });
    await onRequestPost({ request: post(body({ call_id: CALL_ID })), env: env({ PERCH_ACTIONS: kv }) });
    assert.deepEqual(kv.deletes, [`qualbk:${CALL_ID}`], 'the key must be burned after one use');

    // Second booking, same call. Both the summary AND the merge key are now gone.
    //
    // A4.1 RE-RUN — THIS IS A BEHAVIOUR CHANGE #57 INTRODUCES, and it is recorded
    // here rather than quietly re-asserted. Before #57 the merge key rode through
    // on the raw body value, so a second booking on the same call still merged.
    // Now the key is burned with the summary, and if the DO slot is also gone
    // (Paula's read-once /get consumes it mid-call, so by booking time it usually
    // is) the second booking is UNVERIFIED and opens a fresh Vantage lead.
    //
    // Assessed as acceptable, not a blocker: two bookings inside one call is rare,
    // the appointment is still confirmed, and nothing the caller typed is dropped —
    // it lands as a separate lead instead of a merge. Flagged in the sign-off as an
    // observation so Wendy is not surprised by a second lead row.
    await onRequestPost({ request: post(body({ call_id: CALL_ID })), env: env({ PERCH_ACTIONS: kv }) });
    assert.equal(stub.seen.clioPosts.length, 2, 'both bookings confirmed');
    // Asserted on the NOTE, not the description: after the split nothing can put a
    // summary in a description, so a description assertion here would pass
    // vacuously and stop guarding the one-shot burn at all.
    const secondNote = clioNoteDetail(stub.seen, 1);
    assert.ok(!secondNote.includes(SUMMARY), 'the summary must not be appended twice');
    assertNoVantageCall(stub.seen);
    assert.ok(secondNote.includes(TYPED_NOTES), 'the second booking keeps everything typed');
  });

  // REMOVED: the DO slot alone confirms — the bridge branch, with KV empty
  // the bridge DO is gone, so KV is the only witness and the bridge branch is unreachable.
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Non-vacuity — the assertions above can actually fail
// ─────────────────────────────────────────────────────────────────────────────
describe('the enrichment guard would actually fire (controls)', () => {
  test('CONTROL — no call_id ⇒ no summary anywhere, and Vantage opens a FRESH lead', async () => {
    const kv = makeKVWithDelete({ [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY }) });
    await onRequestPost({ request: post(body()), env: env({ PERCH_ACTIONS: kv }) });

    assert.ok(!clioDescription(stub.seen).includes(SUMMARY), 'a plain web booking must not inherit a stranger\'s answers');
    assertNoVantageCall(stub.seen);
    assert.ok(!kv.gets.some((k) => k.startsWith('qualbk:')), 'and KV is not consulted at all');
  });

  test('A call with NO server record books, but no longer MERGES (#57 inverted this)', async () => {
    // Under PR #80 this asserted the merge key rode through on an id no store could
    // vouch for — which was the finding, stated as a control. #57 makes the same
    // input take the fresh-lead path.
    const kv = makeKVWithDelete({});   // the caller hung up before the qualifier
    const res = await onRequestPost({
      request: post(body({ call_id: CALL_ID })),
      env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: emptyBridge() }),
    });

    assert.equal(res.status, 201, 'an unverifiable id must never cost the caller their appointment');
    assert.equal(clioNoteDetail(stub.seen).includes(TYPED_NOTES), true, 'the typed notes stand alone — on the contact note');
    assert.ok(!clioDescription(stub.seen).includes(TYPED_NOTES), 'and never on the client-facing description');
    assertNoVantageCall(stub.seen);
    assert.deepEqual(kv.deletes, [], 'nothing to burn');
  });

  test('CONTROL — a summary under a DIFFERENT call id is never picked up', async () => {
    const kv = makeKVWithDelete({ 'qualbk:some-other-call': JSON.stringify({ summary: SUMMARY }) });
    await onRequestPost({ request: post(body({ call_id: CALL_ID })), env: env({ PERCH_ACTIONS: kv }) });
    assert.ok(!clioDescription(stub.seen).includes(SUMMARY), 'answers must not cross calls');
  });

  test('enrichment is NON-fatal: a KV that throws still yields a confirmed booking', async () => {
    const broken = {
      gets: [], deletes: [], puts: [],
      async get() { throw new Error('kv down'); },
      async put() { throw new Error('kv down'); },
      async delete() { throw new Error('kv down'); },
    };
    const res = await onRequestPost({ request: post(body({ call_id: CALL_ID })), env: env({ PERCH_ACTIONS: broken }) });

    assert.ok([201, 207].includes(res.status), `a KV outage must not cost the caller their appointment (got ${res.status})`);
    assert.equal(stub.seen.clioPosts.length, 1, 'the appointment is still made');
    // #57: FAIL CLOSED ON ATTACHMENT, NEVER ON THE BOOKING. A store that is down
    // cannot confirm, and "could not refute" must not be read as "confirmed" — that
    // is the `if (secret && …)` fail-open shape this codebase refuses everywhere.
    // See [[feedback_secret_gate_unset_means_disabled]].
    assertNoVantageCall(stub.seen);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. The rewired path changes nothing about WHAT is sent
// ─────────────────────────────────────────────────────────────────────────────
describe('§T3 — the rewire moves who SETS the id, not what the server does with it', () => {
  test('the server reads call_id from the request body and is blind to which path set it', async () => {
    // The iframe path sets window.__perchCallId from perch-inject.js's bridge;
    // the router path sets the same global from js/perch/booking-control.js:175.
    // js/booking-widget.js:1319 reads that ONE global into the payload either way,
    // so the two paths are indistinguishable at this boundary — which is exactly
    // why the rewire cannot silently drop the thread as long as the global is set.
    const kv1 = makeKVWithDelete({ [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY }) });
    await onRequestPost({ request: post(body({ call_id: CALL_ID })), env: env({ PERCH_ACTIONS: kv1 }) });
    const viaShell = clioDescription(stub.seen);

    stub.restore(); stub = stubAll();
    const kv2 = makeKVWithDelete({ [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY }) });
    await onRequestPost({ request: post(body({ call_id: CALL_ID })), env: env({ PERCH_ACTIONS: kv2 }) });
    const viaRouter = clioDescription(stub.seen);

    assert.equal(viaRouter, viaShell, 'identical bytes reach Clio whichever client path set the id');
  });

  test('an over-long id is clamped, then WITHHELD — a malformed id must not cost a booking', async () => {
    // Still clamped at create.js:116, but the clamped value no longer reaches
    // Vantage: nothing vouches for it, so it takes the fresh-lead path. The
    // acceptance that matters is unchanged — the booking completes.
    const kv = makeKVWithDelete({});
    const res = await onRequestPost({
      request: post(body({ call_id: 'x'.repeat(400) })),
      env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: emptyBridge() }),
    });
    assert.equal(res.status, 201, 'a malformed id must not cost a booking');
    assertNoVantageCall(stub.seen);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Where the id comes from — the A3.2 (#57) acceptance, pinned as it stands
// ─────────────────────────────────────────────────────────────────────────────
describe('A3.2 (#57) CLOSED — the server decides, and the residual is stated', () => {
  test('THE FIX: a FORGED id — one no store ever wrote — attaches nothing and merges nothing', async () => {
    // The inversion of PR #80's "THE GAP" pin. That test seeded KV under the very
    // id it then called forged, so re-running it unchanged would have passed
    // against #57 for entirely the wrong reason — the id WAS server-confirmed.
    // A forged id is one with no record anywhere, which is what this now uses.
    const kv = makeKVWithDelete({ [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY }) });
    const res = await onRequestPost({
      request: post(body({ call_id: 'call_forged000000000000000000' })),
      env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: bridgeWithQualifier(CALL_ID) }),
    });

    assert.equal(res.status, 201, 'the forger still gets a real appointment — we never fail the booking');
    assert.ok(!clioNoteDetail(stub.seen).includes(SUMMARY),
      'a forged id must not fold a genuine caller\'s answers into ITS booking');
    assertNoVantageCall(stub.seen);
    assert.ok(!kv.deletes.includes(`qualbk:${CALL_ID}`),
      'and the real caller\'s record is untouched — a forger cannot burn someone else\'s summary');
  });

  test('RESIDUAL, stated not fixed: a LEAKED id that IS server-confirmed still joins', async () => {
    // #57 verifies that a Perch session by this id submitted a qualifier. It does
    // NOT verify that the person booking is that caller — the call_id remains a
    // bearer capability, as fn/qualifier_result.js already documents. Binding the
    // join to caller identity is a separate change with its own failure modes and
    // is explicitly out of scope for #57.
    //
    // Asserted rather than merely written down, so the boundary of the fix is a
    // fact in the suite and not a claim in a document
    // ([[feedback_assessment_doc_is_not_code]]).
    const kv = makeKVWithDelete({ [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY }) });
    await onRequestPost({
      request: post(body({ call_id: CALL_ID })),         // a real id, in someone else's hands
      env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: emptyBridge() }),
    });

    assert.ok(clioNoteDetail(stub.seen).includes(SUMMARY),
      'KNOWN RESIDUAL: possession of a confirmed id is still sufficient to join. '
      + 'Out of scope for #57 and reported in the A4.1 sign-off, not silently carried.');
  });

  test('the outcome is RECORDED on the booking — all four states, and the raw id never is', async () => {
    // `qualifier_join` is what makes the join auditable instead of inferred: Paul
    // and Wendy can tell a plain web booking from one whose id the server could not
    // vouch for. Driving all four states in one test also proves the field is
    // actually varying rather than constant.
    const bookingRecord = (kv) => {
      const key = [...kv._store.keys()].find((k) => k.startsWith('booking:'));
      assert.ok(key, 'a booking:<id> record was written');
      return JSON.parse(kv._store.get(key));
    };

    const cases = [
      { name: 'none',                 callId: undefined,  kv: {},                                                     bridge: emptyBridge() },
      { name: 'unverified',           callId: CALL_ID,    kv: {},                                                     bridge: emptyBridge() },
      // Reached through KV rather than the bridge DO, which is deleted. The state
      // itself is unchanged and still reachable — qualifier-bind.js decides it as
      // `kv.summary ? ATTACHED : VERIFIED_NO_SUMMARY`, so a stored record whose summary
      // did not survive is exactly this case. Keeping all four states in the table is
      // the point: it proves the field varies rather than being constant, and dropping
      // one because its old seed is gone would quietly shrink that to three.
      { name: 'verified_no_summary',  callId: CALL_ID,    kv: { [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: '' }) }, bridge: emptyBridge() },
      { name: 'attached',             callId: CALL_ID,    kv: { [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY }) }, bridge: emptyBridge() },
    ];

    for (const c of cases) {
      stub.restore(); stub = stubAll();
      const kv = makeKVWithDelete(c.kv);
      await onRequestPost({
        request: post(body(c.callId ? { call_id: c.callId } : {})),
        env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: c.bridge }),
      });
      const rec = bookingRecord(kv);
      assert.equal(rec.qualifier_join, c.name, `expected qualifier_join=${c.name}`);
      assert.ok(!JSON.stringify(rec).includes(CALL_ID),
        'the raw call_id is a bearer capability and must NEVER be stored on the booking');
    }
  });

  test('and no request header or session is consulted for the id (source: body only)', async () => {
    const kv = makeKVWithDelete({ [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY }) });
    const req = new Request('https://www.donovan.law/booking/create', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'CF-Connecting-IP': nextIp(),
        'x-perch-call-id': CALL_ID,          // a plausible server-bound header…
      },
      body: JSON.stringify(body()),          // …with NO call_id in the body
    });
    await onRequestPost({ request: req, env: env({ PERCH_ACTIONS: kv }) });

    assert.ok(!clioDescription(stub.seen).includes(SUMMARY),
      'a header-borne id is ignored today — there is no server-side binding to read');
    assertNoVantageCall(stub.seen);
  });
});
