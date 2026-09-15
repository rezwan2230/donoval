// ── ORDER SHELDON-CLIO-BUSYBLOCKS ────────────────────────────────────────────
//
// R3 closed a defect in searchContactByEmail: a parseable but wrong-shaped HTTP 200
// was read as a conclusive answer, which licensed a create and minted a duplicate
// Person. The identical defect survived one function away in fetchBusyBlocks —
//
//     const entries = Array.isArray(data?.data) ? data.data : [];
//
// — and there it is worse. A 200 carrying `{}`, a null `data` key, or an error
// envelope reads as NO CALENDAR ENTRIES, which reads as nothing is booked, which
// makes every slot in the window free. That read runs on the availability re-check
// create.js performs in the instant before the calendar write, so the consequence is
// not an untidy CRM: it is a client booked into a slot the attorney is already
// sitting in, and two people arriving for the same consultation on a live legal
// calendar.
//
// The asymmetry that made it invisible: an UNPARSEABLE body already failed closed,
// because res.json() threw and the throw became a 502 at the route. Only the
// wrong-shaped 200 failed open — the one case that produces no error anywhere.
//
// WHAT THIS FILE PROVES
//   • THE CONTROL — a 200 carrying `{}` on the re-check produces ZERO
//     POST /calendar_entries. Remove the Array.isArray guard and this test fails,
//     because the booking sails through and writes.
//   • THE NARROWING TEST — a well-formed `{"data":[]}` still books. An attorney with
//     a genuinely clear Tuesday must stay bookable, so the guard tests the SHAPE and
//     never the length. Tighten it into "refuse anything empty" and this fails.
//   • a calendar that IS busy still refuses the slot with 409 SLOT_TAKEN, so the two
//     tests above cannot both pass by way of a function that stopped reading entries.
//   • every read surface fails in the same direction: booking/create → 502,
//     booking/availability → 500, fn/get_availability → status:"error". None of them
//     presents an unanswerable calendar as an open one.
//   • the two failure directions are DISTINGUISHABLE IN THE LOGS — an empty calendar
//     and an unanswerable one produce different lines, not the same absence of one.
//   • THE ONE READ THAT MUST NOT FAIL CLOSED goes the other way and says so. The
//     entry read-back runs AFTER the write, so it is best-effort — but a 2xx with no
//     readable id now WARNS, whether the body was unparseable or merely id-less. The
//     silent case was the defect, so the read-back tests assert the LINE, not just
//     the 201 and the "unknown" ref, which main produces too.
//   • the mock provider, which the preview environment runs on, is untouched: it has
//     its own getAvailability and never calls fetchBusyBlocks at all.
//
// WHAT IT CANNOT PROVE — no assertion below claims it
//   • that Clio ever actually sends a wrong-shaped 200. The shapes exercised here
//     ({}, data:null, an error envelope, a non-array data) are the ones a 200 arrives
//     in when something is wrong upstream — a gateway, a partial outage, an error
//     serialised into a success. This proves how we BEHAVE when one arrives, not
//     how often one does.
//   • anything about the race between the re-check and the POST. That window is
//     measured and reported in the PR body; it is a property of sequential Clio
//     round trips, and no stub can time it.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as bookingCreate } from '../donovan-legal-site/functions/booking/create.js';
import { onRequestGet as bookingAvailability } from '../donovan-legal-site/functions/booking/availability.js';
import { __resetIntakeFieldCache } from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import { stubFetch, muteConsole, makeKV, makeDurableObject } from './helpers/stubs.mjs';

const SITEVERIFY    = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES  = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS  = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES    = 'https://app.clio.com/api/v4/notes';
const GROW_INBOX    = 'https://grow.clio.com/inbox_leads';
const VANTAGE_UPSERT = 'https://vantage.ticoai.net/upsert-lead';

const TOOL_SECRET = 'perch-tool-secret-value-long-enough';

/**
 * The four shapes a 200 arrives in when it is not an answer.
 *
 * All four PARSE — that is the entire point, and the reason the unparseable case
 * was never the vulnerable one. `{"data":{}}` is here because `data` being PRESENT
 * is not the test: an object is not a list of entries, and a guard written as
 * `data?.data ?? []` would let it through.
 */
const NOT_AN_ANSWER = [
  '{}',
  '{"data":null}',
  '{"error":{"type":"InternalError","message":"upstream"}}',
  '{"data":{}}',
];

function env(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    CLIO_CLIENT_ID: 'cid',
    CLIO_CLIENT_SECRET: 'csec',
    CLIO_REFRESH_TOKEN: 'rtok',
    CLIO_CALENDAR_ID: 9084638,
    CLIO_CREATE_CONTACT: '1',
    PERCH_TOOL_SECRET: TOOL_SECRET,
    ...over,
  };
}

/** A weekday slot inside the firm's 9–17 ET window, a week out. */
function futureMondaySlot() {
  const d = new Date(Date.now() + 7 * 86400_000);
  d.setUTCHours(14, 0, 0, 0);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
const SLOT = futureMondaySlot();
const SLOT_MS = Date.parse(SLOT);

/** The entry Clio returns when the attorney really is booked at SLOT. */
const BUSY_AT_SLOT = JSON.stringify({
  data: [{
    start_at: new Date(SLOT_MS).toISOString(),
    end_at:   new Date(SLOT_MS + 30 * 60_000).toISOString(),
  }],
});

let _ipSeq = 0;
const nextIp = () => `203.0.113.${(_ipSeq += 1) % 250}`;

function post(over = {}) {
  return new Request('https://www.donovan.law/booking/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() },
    body: JSON.stringify({
      type: 'consult',
      slot: SLOT,
      name: 'Jane Q Caller',
      email: 'jane.caller@example.com',
      phone: '(561) 555-0142',
      turnstile_token: 'good-token',
      ...over,
    }),
  });
}

/**
 * Stub every edge a booking touches, with the calendar READ under test.
 *
 * `entriesBody` is the exact bytes GET /calendar_entries puts on the wire, given as
 * a string so a test spells the shape rather than describing it. `entriesStatus`
 * covers the non-2xx path that already failed closed, kept here so the new guard can
 * be told apart from the old one in the logs.
 *
 * `seen.writes` is the assertion the control hangs on: every POST /calendar_entries
 * this booking issued. The control expects it EMPTY, and it is empty for exactly one
 * reason — the read refused to answer, so the write was never reached.
 */
function stubAll({
  entriesBody = '{"data":[]}',
  entriesStatus = 200,
  // Task 4. The bytes the calendar-entry CREATE answers with. The entry is already
  // written by the time this is read, which is what makes it the one read in the
  // file that must NOT fail closed.
  entryCreateBody = JSON.stringify({ data: { id: 999999 } }),
} = {}) {
  const seen = { writes: [], reads: [], searches: [], contacts: [], notes: [], clioCalls: [] };

  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (u.startsWith('https://app.clio.com/api/v4/')) seen.clioCalls.push(`${method} ${u.split('?')[0]}`);

    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
    if (u.startsWith('https://app.clio.com/oauth/token')) {
      return new Response(JSON.stringify({ access_token: 'at' }));
    }

    if (u.startsWith(CLIO_ENTRIES) && method === 'GET') {
      seen.reads.push(u);
      return new Response(entriesBody, { status: entriesStatus });
    }
    if (u.startsWith(CLIO_ENTRIES) && method === 'POST') {
      seen.writes.push(JSON.parse(init.body));
      return new Response(entryCreateBody, { status: 201 });
    }

    if (u.startsWith(CLIO_CFIELDS) && method === 'GET') {
      return new Response(JSON.stringify({ data: [], meta: {} }));
    }
    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      return new Response(JSON.stringify({ data: { id: 4242 } }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      seen.searches.push(u);
      // The documented empty result set. No test in this file varies it: the contact
      // search is not what this ticket changes.
      return new Response('{"data":[]}');
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      seen.contacts.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 4242 } }));
    }
    if (u.startsWith(CLIO_NOTES) && method === 'POST') {
      seen.notes.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 77 } }));
    }
    if (u.startsWith(GROW_INBOX)) return new Response(JSON.stringify({ ok: true }));
    if (u.startsWith(VANTAGE_UPSERT)) return new Response(JSON.stringify({ ok: true }));
    throw new Error(`unstubbed fetch: ${method} ${u}`);
  });

  return { seen, restore: () => handle.restore() };
}

async function book(envOver = {}, bodyOver = {}) {
  return bookingCreate({
    request: post(bodyOver),
    env: env({ PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: makeDurableObject(), ...envOver }),
  });
}

async function readAvailability(envOver = {}) {
  return bookingAvailability({
    request: new Request('https://www.donovan.law/booking/availability?type=consult&days=14'),
    env: env(envOver),
  });
}

// `voiceAvailability` stood here — it POSTed to /fn/get_availability with the tool
// secret, which was how Paula asked for open times mid-call. The endpoint went with
// the voice concierge and this was its only caller.

let stub, mute;
beforeEach(() => { __resetIntakeFieldCache(); mute = muteConsole(); });
afterEach(() => { stub?.restore(); mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// TASK 3 — the control and its narrowing
// ─────────────────────────────────────────────────────────────────────────────
describe('a wrong-shaped 200 on the calendar read never becomes a booking', () => {
  test('THE CONTROL: a 200 carrying `{}` produces NO calendar entry write', async () => {
    // Delete the Array.isArray guard in fetchBusyBlocks and this test fails: the
    // empty coalesce makes the re-check see a free slot, `stillFree` is true, and
    // the POST goes out. The assertion is on the WRITE, not on the status code,
    // because the status is the symptom and the write is the harm.
    stub = stubAll({ entriesBody: '{}' });
    const res = await book();

    assert.deepEqual(stub.seen.writes, [], 'ZERO POST /calendar_entries — no double booking');
    assert.equal(res.status, 502, 'the caller is told the booking failed, not that it worked');
    assert.equal((await res.json()).code, 'PROVIDER_ERROR');
    // Nothing downstream of the re-check ran either — the refusal is at the gate,
    // not a write that was rolled back.
    assert.deepEqual(stub.seen.contacts, [], 'no contact minted for a booking that never happened');
    assert.deepEqual(stub.seen.notes, []);
  });

  test('THE NARROWING TEST: a well-formed EMPTY `data` array still books', async () => {
    // The mirror image, and the only thing standing between the guard above and a
    // fetchBusyBlocks that has simply stopped answering. `{"data":[]}` is Clio
    // saying "I looked, the attorney has nothing booked in this window" — a real
    // answer, and the one every first booking of the day depends on. If the guard is
    // ever widened to refuse an empty list, no slot is ever bookable again.
    stub = stubAll({ entriesBody: '{"data":[]}' });
    const res = await book();

    assert.equal(res.status, 201, 'a genuinely clear calendar is still bookable');
    assert.equal(stub.seen.writes.length, 1, 'exactly one calendar entry written');
    assert.equal(
      stub.seen.writes[0].data.start_at, new Date(SLOT_MS).toISOString(),
      'and it is the slot the client asked for',
    );
  });

  test('THE OTHER NARROWING: a calendar that IS busy still refuses with 409', async () => {
    // Without this, the pair above could both pass against a function that returned
    // a constant. A real entry covering the slot must still take it off the grid.
    stub = stubAll({ entriesBody: BUSY_AT_SLOT });
    const res = await book();

    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'SLOT_TAKEN');
    assert.deepEqual(stub.seen.writes, [], 'the slot Paul is sitting in is not written over');
  });

  test('every non-answering shape is refused, not just the empty object', async () => {
    for (const shaped of NOT_AN_ANSWER) {
      stub?.restore();
      __resetIntakeFieldCache();
      stub = stubAll({ entriesBody: shaped });
      const res = await book();

      assert.deepEqual(stub.seen.writes, [], `no write for: ${shaped}`);
      assert.equal(res.status, 502, `refused for: ${shaped}`);
    }
  });

  test('a body that is not JSON at all is refused too — and always was', async () => {
    // This one already failed closed before the ticket, because res.json() threw.
    // Asserted so the behaviour is pinned rather than incidental: a future refactor
    // that wraps the parse in a try/catch returning [] would reopen it silently.
    stub = stubAll({ entriesBody: '<html>502 Bad Gateway</html>' });
    const res = await book();

    assert.deepEqual(stub.seen.writes, []);
    assert.equal(res.status, 502);
  });

  test('a non-2xx calendar read is refused (unchanged, pinned)', async () => {
    stub = stubAll({ entriesStatus: 403, entriesBody: '{}' });
    const res = await book();

    assert.deepEqual(stub.seen.writes, []);
    assert.equal(res.status, 502);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK 2 — the throw surfaces as a failure on EVERY read surface
// ─────────────────────────────────────────────────────────────────────────────
describe('an unanswerable calendar never presents as a free one', () => {
  test('GET /booking/availability answers 500 PROVIDER_ERROR, not 200 with a full grid', async () => {
    // The route that renders the client's grid. Before the fix a wrong-shaped 200
    // produced a 200 here carrying EVERY business-hour slot for fourteen days —
    // the most convincing possible presentation of a calendar nobody could read.
    stub = stubAll({ entriesBody: '{}' });
    const res = await readAvailability();

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.code, 'PROVIDER_ERROR');
    assert.equal('slots' in body, false, 'no slot list at all, empty or otherwise');
  });

  test('…and still answers 200 with real slots when the calendar answers', async () => {
    stub = stubAll({ entriesBody: '{"data":[]}' });
    const res = await readAvailability();

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.ok(Array.isArray(body.slots) && body.slots.length > 0, 'a clear fortnight still renders');
  });

  // REMOVED with the voice concierge: the agent wrapper is gone; the browser calls booking/availability, still covered above.

  // REMOVED: …and a genuinely clear calendar still offers times
  // it drove /fn/get_availability, Paula's voice availability tool, which went with the concierge. The booking form's own availability path is covered by the sibling test above.
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK 1 (second half) — an unusable calendar_id is not an empty calendar
// ─────────────────────────────────────────────────────────────────────────────
describe('a calendar we cannot address is not a calendar with nothing on it', () => {
  // resolveConfig refuses to build a Clio config without CLIO_CALENDAR_ID, but it
  // coerces with Number(), so a value that is SET and non-numeric survives that
  // check as NaN and arrived in fetchBusyBlocks as a falsy calendar id. The old
  // `if (!calendarId) return []` then declared the unknown calendar wholly free.
  // This is a dashboard typo away, not a theoretical shape.
  test('a non-numeric CLIO_CALENDAR_ID refuses the write instead of freeing the grid', async () => {
    stub = stubAll({ entriesBody: '{"data":[]}' });
    const res = await book({ CLIO_CALENDAR_ID: 'paul' });

    assert.deepEqual(stub.seen.writes, [], 'no booking onto a calendar we cannot name');
    assert.equal(res.status, 502);
    assert.deepEqual(stub.seen.reads, [], 'and it never even asked — there was nothing to ask about');
  });

  test('…and the availability grid refuses too', async () => {
    stub = stubAll({ entriesBody: '{"data":[]}' });
    const res = await readAvailability({ CLIO_CALENDAR_ID: 'paul' });

    assert.equal(res.status, 500);
    assert.equal((await res.json()).code, 'PROVIDER_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK 5 — the two failure directions are distinguishable in the logs
// ─────────────────────────────────────────────────────────────────────────────
describe('an operator can tell an empty calendar from an unanswerable one', () => {
  test('a genuinely empty calendar says so, with a count', async () => {
    stub = stubAll({ entriesBody: '{"data":[]}' });
    await book();

    assert.ok(mute.saw('calendar entries read: 0'), 'the positive line, so silence is not the signal');
    assert.equal(mute.saw('no entry array'), false);
    assert.equal(mute.saw('unreadable body'), false);
  });

  test('a busy calendar reports the count it actually read', async () => {
    stub = stubAll({ entriesBody: BUSY_AT_SLOT });
    await book();

    assert.ok(mute.saw('calendar entries read: 1'));
  });

  test('a wrong-shaped body has its OWN message, and no success line', async () => {
    stub = stubAll({ entriesBody: '{}' });
    await book();

    assert.ok(mute.saw('calendar read returned a body with no entry array'), 'greppable, and its own words');
    assert.equal(mute.saw('unreadable body'), false, 'not the unparseable-body message');
    assert.equal(
      mute.saw('calendar entries read:'), false,
      'and NOT the line that means the calendar answered — that is the whole confusion',
    );
    assert.ok(mute.saw('AVAILABILITY_RECHECK_FAIL'), 'the alertable route-level outcome still fires');
  });

  test('an unparseable body is told apart from a wrong-shaped one', async () => {
    // Two different operational facts — "Clio sent bytes that are not JSON" and
    // "Clio sent JSON that is not a list of entries" — and the same fix applies to
    // neither. R3 drew this distinction on the contact search; it holds here.
    stub = stubAll({ entriesBody: '<html>502 Bad Gateway</html>' });
    await book();

    assert.ok(mute.saw('calendar read returned an unreadable body'));
    assert.equal(mute.saw('no entry array'), false);
    assert.equal(mute.saw('calendar entries read:'), false);
  });

  test('an unusable calendar id says THAT, not either of the read failures', async () => {
    stub = stubAll();
    await book({ CLIO_CALENDAR_ID: 'paul' });

    assert.ok(mute.saw('calendar read refused: no usable calendar_id'));
    assert.equal(mute.saw('no entry array'), false);
    assert.equal(mute.saw('calendar entries read:'), false);
  });

  test('no client PII reaches any of these lines', async () => {
    for (const shaped of ['{}', '<html>nope</html>', '{"data":[]}']) {
      stub?.restore();
      mute.restore();
      mute = muteConsole();
      __resetIntakeFieldCache();
      stub = stubAll({ entriesBody: shaped });
      await book();

      assert.equal(mute.saw('jane.caller@example.com'), false, `email leaked for: ${shaped}`);
      assert.equal(mute.saw('Jane Q Caller'), false, `name leaked for: ${shaped}`);
      assert.equal(mute.saw('555-0142'), false, `phone leaked for: ${shaped}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK 4 — the one read in the file whose safe direction is the opposite one
// ─────────────────────────────────────────────────────────────────────────────
describe('the read AFTER the write is the one that must not fail closed', () => {
  test('an unreadable 201 body keeps the booking confirmed', async () => {
    // Every other read in the file refuses when it cannot see, because it runs
    // before a write. This one runs after: the entry is already on the attorney's
    // calendar and the invite is already going out. Throwing here answered 502, the
    // widget told the client their booking failed, the client rebooked — and the
    // firm got the double booking this whole ticket exists to prevent, produced by
    // strictness in the one place strictness has no undo.
    stub = stubAll({ entryCreateBody: '<html>201 but a proxy ate the body</html>' });
    const res = await book();

    assert.equal(res.status, 201, 'the client is told the truth: it is booked');
    assert.equal(stub.seen.writes.length, 1, 'exactly one entry, and it stays');
    assert.equal((await res.json()).provider_ref, 'unknown', 'the ref is what is lost, not the appointment');
    // BOTH lines: the cause and the consequence. The cause line is what tells an
    // operator to go looking at a proxy rather than at the Clio contract.
    assert.ok(mute.saw('the response body was not JSON'), 'the cause, in its own words');
    assert.ok(mute.saw('provider_ref lost'), 'and the loss is greppable rather than silent');
  });

  test('a 201 whose PARSED body carries no id still says the ref was lost', async () => {
    // THIS TEST EXISTS TO KILL A SPECIFIC BUILD. Asserting only 201 + `unknown` is
    // vacuous: that pair passes byte-identically against main, where the read-back
    // is an unguarded `await res.json()` and a parseable `{"data":{}}` has always
    // yielded `provider_ref: "unknown"` in silence. The whole defect was the SILENCE
    // — the warn sat inside the catch, so the one case that actually reaches an
    // operator (a clean 201, a parsed body, no entry id) emitted nothing at all and
    // reported confirmed to the client with no trace of the lost reference.
    //
    // So the assertion is the LINE, and the line is what main does not emit. Put the
    // warn back inside the catch and this fails, which is the point.
    stub = stubAll({ entryCreateBody: '{"data":{}}' });
    const res = await book();

    assert.equal(res.status, 201, 'still best-effort — the entry is written and it stays');
    assert.equal(stub.seen.writes.length, 1);
    assert.equal((await res.json()).provider_ref, 'unknown');
    assert.ok(mute.saw('provider_ref lost'), 'the outcome warns even though the body parsed fine');
    assert.equal(
      mute.saw('the response body was not JSON'), false,
      'and NOT the cause line — the body parsed; it just had no id in it',
    );
  });

  test('a 201 that DOES carry an id is silent, and keeps the ref', async () => {
    // The narrowing. Without it, "warn whenever the id is null" could be widened to
    // "warn on every booking" and every test above would still pass.
    stub = stubAll({ entryCreateBody: JSON.stringify({ data: { id: 999999 } }) });
    const res = await book();

    assert.equal((await res.json()).provider_ref, '999999', 'the ref survives the happy path');
    assert.equal(mute.saw('provider_ref lost'), false, 'and a good read says nothing');
    assert.equal(mute.saw('the response body was not JSON'), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// STOP CONDITION — the preview environment's mock provider is untouched
// ─────────────────────────────────────────────────────────────────────────────
describe('failing closed on the Clio calendar does not reach the mock provider', () => {
  // The order asks explicitly whether this change breaks the mock booking provider
  // the preview environment runs on. It cannot: provider-mock.js exports its own
  // getAvailability, which passes a literal [] to computeAvailability and never
  // calls fetchBusyBlocks — there is no code path from BOOKING_PROVIDER=mock into
  // the function this ticket changed. Asserted rather than argued, because "it is a
  // different module" is exactly the kind of claim that stops being true quietly.
  test('BOOKING_PROVIDER=mock books with ZERO Clio calls', async () => {
    stub = stubAll({ entriesBody: '{}' }); // the shape that now refuses on the Clio path
    const res = await book({ BOOKING_PROVIDER: 'mock' });

    assert.equal(res.status, 201, 'preview still books');
    assert.deepEqual(stub.seen.clioCalls, [], 'the mock never touches app.clio.com');
    assert.equal(mute.saw('no entry array'), false, 'and never reaches the new guard');
  });

  test('the mock availability grid is unaffected by a hostile Clio', async () => {
    stub = stubAll({ entriesBody: '{}' });
    const res = await readAvailability({ BOOKING_PROVIDER: 'mock' });

    assert.equal(res.status, 200);
    assert.ok((await res.json()).slots.length > 0);
  });
});
