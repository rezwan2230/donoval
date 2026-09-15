// ── ORDER SHELDON-CLIO-CONTACT-MAPPING ───────────────────────────────────────
//
// The firm's requirement, in one sentence: everything intake collects should be on
// the Clio CONTACT, so the lawyer opens one record and sees the whole picture.
// Before this change the contact was created bare — a split name and an email —
// because its only job was to exist so the calendar entry had somebody to attach
// as an attendee. The booking form's phone reached it; the caller's state, and
// every one of the qualifier's answers, did not.
//
// TWO SURFACES THAT MUST NEVER BE CONFLATED, and the reason this suite exists at
// all rather than a handful of body assertions:
//
//   the CONTACT is lawyer-only. Clio does not email a contact's fields to the
//     contact. So it gets ALL of it, income_band and net_worth_band included.
//
//   the CALENDAR ENTRY's description is client-facing. Clio renders it verbatim
//     into the confirmation email and the .ics (SHELDON-CLIO-CONFIRM-EMAIL). It
//     stays exactly as it is: meeting link and reschedule line, nothing else.
//
// The whole risk of this ticket is that pushing the bands one step further into
// Clio pushes them one step too far. So the assertions below are deliberately
// two-sided: every test that proves a band landed on the contact ALSO proves the
// same string is absent from the calendar entry, in the same booking, from the
// same bodies.
//
// WHAT THIS FILE PROVES
//   • the contact CREATE body carries identity — first_name, last_name,
//     email_addresses, phone_numbers — and the enrichment PATCH that follows it
//     carries addresses (province from the qualifier's state) and
//     custom_field_values for all seven intake answers, so no optional field's
//     rejection can cost the client their confirmation email (R2);
//   • the contact UPDATE path exists at all, updates values in place rather than
//     appending duplicates, and does not clobber what a human corrected in Clio;
//   • custom-field ids are resolved by READING ONLY — seeded from
//     CLIO_INTAKE_FIELD_IDS or found by LISTING the account, admitted on
//     field_type, cached across bookings — and there is no code path from here to
//     POST /custom_fields at all. A name that neither source answers is SKIPPED,
//     including when the list failed (R2);
//   • an account that does not carry the Intake fields degrades to a booking with
//     no custom_field_values — not to a failed booking;
//   • a search that did not ANSWER never licenses a create, where "answered" means
//     a 200 whose body parses AND carries a `data` array — a transport failure, a
//     non-2xx, a non-JSON body and a body of the wrong shape are four ways of not
//     answering and every one of them fails closed (R2, R3);
//   • the calendar-entry description and therefore the client's confirmation email
//     remain band-free, and the intake Note still carries the human rollup.
//
// WHAT IT CANNOT PROVE — no assertion below claims it
//   • that the firm's Clio account actually carries the seven Intake CustomFields,
//     or what field_type David gave each one. That is the state of a live account;
//     only a live call answers it. Both outcomes are exercised here against stubs —
//     the fields present and typed as declared, and the fields absent or typed
//     wrong — which proves how we BEHAVE either way, not which way it is.
//   • what Clio renders. The description text is asserted; the rendering is Clio's.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import { buildClientDescription } from '../donovan-legal-site/functions/booking/_lib/provider-clio.js';
import {
  INTAKE_CUSTOM_FIELDS,
  CONTACT_CUSTOM_FIELDS,
  __resetIntakeFieldCache,
} from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import { onRequestPost as qualifierSubmit } from '../donovan-legal-site/functions/fn/qualifier_submit.js';
import { stubFetch, muteConsole, makeKV, makeDurableObject } from './helpers/stubs.mjs';

const SITEVERIFY     = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES   = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS  = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS   = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES     = 'https://app.clio.com/api/v4/notes';
const GROW_INBOX     = 'https://grow.clio.com/inbox_leads';
const VANTAGE_UPSERT = 'https://vantage.ticoai.net/upsert-lead';

const CONTACT_ID   = 4242;
const MEETING_LINK = 'https://meet.donovan.law/consult';
const CALL_ID      = 'call_contactmapping000001';

// The ids a cold account hands back, one per field, in CONTACT_CUSTOM_FIELDS order —
// the seven the client self-reports FIRST, so every id here is the one it always was,
// and the booking-level field appended after them.
//
// Keyed off the union rather than the seven so that `cfvByKey` can SEE a row it did
// not expect. A table built from the seven would resolve an eighth row's id to
// undefined and drop it on the floor, which is the one thing a measurement helper
// must never do: every assertion in this file of the form `deepEqual(cfv, INTAKE)`
// would then keep passing no matter what else landed on the client's contact.
const FIELD_ID = Object.fromEntries(CONTACT_CUSTOM_FIELDS.map((f, i) => [f.key, 8100 + i]));
const FIELD_NAME = Object.fromEntries(INTAKE_CUSTOM_FIELDS.map((f) => [f.key, f.name]));

// The exact strings fn/qualifier_submit's LABELS table renders. Asserting on these
// rather than on a paraphrase is the point: they are what the lawyer reads on the
// contact, and — for the two band fields — what must never reach the client.
const INTAKE = {
  matter_category: 'Real estate',
  matter_sub:      'Acquisition',
  for_whom:        'Yourself (personal)',
  income_band:     '$1.5M–$3M',
  net_worth_band:  '$5M–$15M',
  language:        'English',
  source:          'Referred by a client',
};
const STATE = 'FL';

// The seven the client answered, plus the one the BOOKING answered.
// SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE. `Intake Consult Type` is written from
// the booking's typeId (`type: 'consult'` below) resolved through the firm's
// configured appointment_types, whose one entry is named "Initial Consultation".
// It appears only where the field's id is actually resolvable — an account that does
// not carry the field skips it, which is most of this file.
const CONSULT_TYPE_NAME = 'Initial Consultation';
const INTAKE_PLUS_CONSULT = { ...INTAKE, consult_type: CONSULT_TYPE_NAME };

const BAND_INCOME    = `Income: ${INTAKE.income_band}`;
const BAND_NET_WORTH = `Net worth: ${INTAKE.net_worth_band}`;
const SUMMARY = [
  '— Perch intake —',
  `Matter: ${INTAKE.matter_category} → ${INTAKE.matter_sub}`,
  `State: ${STATE}`,
  `For: ${INTAKE.for_whom}`,
  BAND_INCOME,
  BAND_NET_WORTH,
  `Language: ${INTAKE.language} · Source: ${INTAKE.source}`,
].join('\n');

/**
 * Everything that must never reach the client-facing description.
 *
 * The two band VALUES are in here on their own, not only inside their labelled
 * lines: "$1.5M–$3M" appearing anywhere in the text Clio emails is the leak, and a
 * check that only looks for "Income: $1.5M–$3M" would miss a reworded one.
 */
const FORBIDDEN = [
  BAND_INCOME, BAND_NET_WORTH,
  INTAKE.income_band, INTAKE.net_worth_band,
  '— Perch intake —', 'income_band', 'net_worth_band',
];

function env(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    CLIO_CLIENT_ID: 'cid',
    CLIO_CLIENT_SECRET: 'csec',
    CLIO_REFRESH_TOKEN: 'rtok',
    CLIO_CALENDAR_ID: 9084638,
    CLIO_CREATE_CONTACT: '1',
    BOOKING_MEETING_LINK: MEETING_LINK,
    ...over,
  };
}

function futureMondaySlot() {
  const d = new Date(Date.now() + 7 * 86400_000);
  d.setUTCHours(14, 0, 0, 0);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
const SLOT = futureMondaySlot();

let _ipSeq = 0;
const nextIp = () => `203.0.113.${(_ipSeq += 1) % 250}`;

function post(b) {
  return new Request('https://www.donovan.law/booking/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() },
    body: JSON.stringify(b),
  });
}

function body(over = {}) {
  return {
    type: 'consult',
    slot: SLOT,
    name: 'Jane Q Caller',
    email: 'jane.caller@example.com',
    phone: '(561) 555-0142',
    call_id: CALL_ID,
    turnstile_token: 'good-token',
    ...over,
  };
}

function bridgeWithQualifier(callId = CALL_ID) {
  const ns = makeDurableObject();
  ns.instance('donovan').state.set(`qual:${callId}`, { status: 'complete' });
  return ns;
}

/** The KV record fn/qualifier_submit writes: prose AND structure on one record. */
function kvWithQualifier(over = {}) {
  return makeKV({
    [`qualbk:${CALL_ID}`]: JSON.stringify({
      summary: SUMMARY, intake: INTAKE, state: STATE, matter: 'real_estate', ...over,
    }),
  });
}

/**
 * Stub every edge the booking path touches.
 *
 * `cfList` is what GET /custom_fields returns per page — an array of pages, so a
 * test can make the account paginate or make the list fail outright. `seen.calls`
 * records the ORDER of Clio calls, which is what makes "the search happens before
 * anything is written" an assertion rather than an assumption. `seen.cfCreates` is
 * a TRIPWIRE on a path R2 deleted, not a record of expected traffic: every
 * assertion on it expects the empty array.
 */
function stubAll({
  contactFound = null,
  cfList = [[]],
  cfListStatus = 200,
  contactPatchStatus = 200,
  // Simulate a Clio that rejects the enriched `fields` selection, so the search
  // has to fall back to the selection this call has always used.
  rejectEnrichedSearch = false,
  // R2. A number applies to every search attempt; an array is consumed one entry
  // per attempt and runs out to 200, which is how "it retried and THEN succeeded"
  // is told apart from "it gave up".
  searchStatus = 200,
  // R2. Reject exactly the pre-fix create body: a POST /contacts carrying the
  // optional half. After the split the create carries identity only, so this stub
  // is a no-op against the fix and a 400 against the branch head.
  rejectCustomFieldsOnCreate = false,
  // R3. A search that answers 200 with a body that PARSES but carries no `data`
  // array — `{}`, `{"data":null}`, an error object. Given as a JSON string so the
  // test spells the exact bytes Clio would put on the wire; `null` (the default)
  // leaves the documented `{data:[…]}` shape alone. Applies to every attempt.
  searchBody = null,
} = {}) {
  const seen = {
    entries: [], notes: [], contacts: [], patches: [], cfCreates: [], cfLists: [],
    searches: [], calls: [],
    /** GET /contacts/{id} — the single-record read, which is NOT a search. */
    records: [],
    /** Every request body this booking serialised, for whole-diff string checks. */
    allBodies: [],
    /** …and just the Clio ones, which is what R2's name defect is scoped to. */
    clioBodies: [],
  };
  let cfPage = 0;
  let nextCreatedId = 9500;
  let searchAttempt = 0;
  const searchStatusFor = (n) => (Array.isArray(searchStatus) ? (searchStatus[n] ?? 200) : searchStatus);

  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (typeof init?.body === 'string' && !u.startsWith('https://app.clio.com/oauth/token')) {
      seen.allBodies.push(init.body);
      if (u.startsWith('https://app.clio.com/api/v4/')) seen.clioBodies.push(init.body);
    }
    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
    if (u.startsWith('https://app.clio.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));

    if (u.startsWith(CLIO_ENTRIES) && method === 'GET') return new Response(JSON.stringify({ data: [] }));
    if (u.startsWith(CLIO_ENTRIES) && method === 'POST') {
      seen.calls.push('entry:create');
      seen.entries.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 999999 } }));
    }

    if (u.startsWith(CLIO_CFIELDS) && method === 'GET') {
      seen.calls.push('cf:list');
      seen.cfLists.push(u);
      if (cfListStatus !== 200) return new Response('{}', { status: cfListStatus });
      const page = cfList[cfPage] ?? [];
      const hasNext = cfPage < cfList.length - 1;
      cfPage += 1;
      return new Response(JSON.stringify({
        data: page,
        meta: hasNext ? { paging: { next: `${CLIO_CFIELDS}?page_token=p${cfPage}` } } : {},
      }));
    }
    // A TRIPWIRE, not a feature. R2 deleted the definition-creation path, so this
    // branch should be unreachable forever. It answers plausibly rather than
    // throwing so that a regression shows up as a failed `cfCreates` assertion with
    // the offending body attached, instead of as an opaque harness error.
    if (u.startsWith(CLIO_CFIELDS) && method === 'POST') {
      seen.calls.push('cf:create');
      const b = JSON.parse(init.body);
      seen.cfCreates.push(b);
      const known = INTAKE_CUSTOM_FIELDS.find((f) => f.name === b?.data?.name);
      const id = known ? FIELD_ID[known.key] : (nextCreatedId += 1);
      return new Response(JSON.stringify({ data: { id } }));
    }

    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      seen.calls.push('contact:patch');
      seen.patches.push({ url: u, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ data: { id: CONTACT_ID } }), { status: contactPatchStatus });
    }
    // ── THE RECORD READ IS NOT THE SEARCH ────────────────────────────────────
    // SHELDON-INTAKE-CREATE-PATH-422-FIX-R3. GET /contacts/{id} and
    // GET /contacts?query= are two endpoints: one answers a single OBJECT, the other
    // a LIST. This stub routed both into the branch below, so the create path's
    // read-back landed in `seen.searches` and every count and every `query`
    // assertion in this file counted a request that is not a search. Told apart
    // here, ahead of the search, so the assertions below keep meaning what they say.
    // The behaviour under test is exercised in test/clio-create-path-write.test.mjs;
    // this stub only has to stop mislabelling it.
    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'GET') {
      seen.calls.push('contact:record');
      seen.records.push(u);
      return new Response(JSON.stringify({ data: { id: Number(u.split('/').pop().split('?')[0]) } }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      seen.calls.push('contact:search');
      seen.searches.push(u);
      const status = searchStatusFor(searchAttempt);
      searchAttempt += 1;
      if (status !== 200) return new Response('{}', { status });
      // R3. A 200 whose body is the wrong SHAPE. Deliberately ahead of the
      // enriched/minimal branch: the malformed body has to be what EVERY attempt
      // gets, or the fallback selection would quietly rescue the run and the
      // control would prove nothing.
      if (searchBody !== null) return new Response(searchBody);
      const enriched = u.includes('phone_numbers');
      if (rejectEnrichedSearch && enriched) return new Response('{}', { status: 400 });
      // The fallback selection returns id + email only — that is what asking for
      // fewer fields MEANS, and a stub that returned the rich record anyway would
      // make the degraded path look identical to the enriched one.
      const row = contactFound && !enriched
        ? { id: contactFound.id, email_addresses: contactFound.email_addresses }
        : contactFound;
      return new Response(JSON.stringify({ data: row ? [row] : [] }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      seen.calls.push('contact:create');
      const b = JSON.parse(init.body);
      seen.contacts.push(b);
      if (rejectCustomFieldsOnCreate && 'custom_field_values' in (b?.data ?? {})) {
        return new Response('{}', { status: 400 });
      }
      return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
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

/**
 * Every intake field already present in the firm's account, typed as its own entry
 * declares.
 *
 * The ONLY posture after R2: David builds the field set by hand in Clio settings and
 * this code finds it by name. There is no path from here to a definition write, so
 * an account without these rows is an account whose contacts carry no intake fields.
 */
const CF_ROWS = INTAKE_CUSTOM_FIELDS.map((f) => ({
  id: FIELD_ID[f.key], name: f.name, field_type: f.type,
}));

/** The single contact create body, with a count assertion so "no write" can't pass. */
function contactData(seen) {
  assert.equal(seen.contacts.length, 1, 'exactly one contact created');
  return seen.contacts[0].data;
}
/**
 * The enrichment PATCH — where `addresses` and `custom_field_values` now live.
 *
 * After the R2 split the contact CREATE carries identity only, so every assertion
 * about the optional half of the intake reads this body instead. Same data, one
 * request later, on a request whose failure cannot cost the confirmation email.
 */
function enrichData(seen, i = 0) {
  assert.ok(seen.patches.length > i, `an enrichment PATCH was issued (#${i + 1})`);
  return seen.patches[i].body.data;
}
function entryData(seen) {
  assert.equal(seen.entries.length, 1, 'exactly one calendar entry');
  return seen.entries[0].data;
}
/** custom_field_values as {key: value}, resolved through the id table. */
function cfvByKey(data) {
  const byId = new Map(CONTACT_CUSTOM_FIELDS.map((f) => [FIELD_ID[f.key], f.key]));
  const out = {};
  for (const row of data?.custom_field_values ?? []) {
    const key = byId.get(row?.custom_field?.id);
    // A row this table cannot name is REPORTED, not skipped. Silently dropping it is
    // how a helper turns every `deepEqual(cfvByKey(...), INTAKE)` in this file into a
    // statement about the seven rows it recognised rather than about what the client's
    // contact actually received.
    assert.ok(key, `an unrecognised custom_field id reached the contact: ${row?.custom_field?.id}`);
    out[key] = row.value;
  }
  return out;
}

async function book(overrides = {}, envOver = {}) {
  const kv = overrides.kv ?? kvWithQualifier();
  const res = await onRequestPost({
    request: post(body(overrides.body)),
    env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: bridgeWithQualifier(), ...envOver }),
  });
  return { res, kv };
}

/**
 * The searches, SPLIT BY WHICH QUESTION THEY ASKED.
 *
 * SHELDON-154-CLIO-DEDUP. There used to be exactly one contact search per booking, so
 * `seen.searches.length` named a single question and counting it was a precise
 * assertion about retry behaviour. There are now two legs — the email search, and a
 * PHONE search that runs only on the branch that would otherwise mint a duplicate —
 * so a bare total no longer distinguishes "the email search retried" from "a second,
 * different question was asked once".
 *
 * The invariants below are restated against these legs rather than relaxed to `>=`:
 * an `ok(>= n)` here would pass just as happily for a search that retried a perfectly
 * good answer, which is the exact defect two of them were written to pin.
 */
function searchLegs(seen, { email = 'jane.caller@example.com' } = {}) {
  const emailLeg = [], phoneLeg = [];
  for (const u of seen.searches) {
    const q = String(new URL(u).searchParams.get('query') ?? '');
    (q.toLowerCase() === email.toLowerCase() ? emailLeg : phoneLeg).push(u);
  }
  return { emailLeg, phoneLeg };
}

let stub, mute;
beforeEach(() => { __resetIntakeFieldCache(); mute = muteConsole(); });
afterEach(() => { stub?.restore(); mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// 1. TASK 1 — the contact is populated, not bare
// ─────────────────────────────────────────────────────────────────────────────
describe('the contact create body carries the booking form', () => {
  test('first_name and last_name are split from the single name field', async () => {
    stub = stubAll();
    const { res } = await book();
    assert.equal(res.status, 201);

    const d = contactData(stub.seen);
    assert.equal(d.first_name, 'Jane');
    assert.equal(d.last_name, 'Q Caller', 'everything after the first token is the surname');
    assert.equal(d.type, 'Person');
  });

  test('a single-token name becomes the surname, with NO placeholder anywhere', async () => {
    // The "(unknown)" fallback this replaces was not a note to the lawyer, it was
    // the client's NAME: Clio composes a Person's display name from these fields, so
    // it put a real client on the firm's books called "(unknown)". A lone token is
    // the last name — the field Clio sorts, searches and composes from — and there
    // is no first name to assert.
    stub = stubAll();
    const { res } = await book({ body: { name: 'Cher' } });
    assert.equal(res.status, 201);

    const d = contactData(stub.seen);
    assert.equal(d.last_name, 'Cher');
    assert.equal('first_name' in d, false, 'omitted, not sent as an empty string');
  });

  test('email and phone are both on the contact, as the default of each', async () => {
    stub = stubAll();
    await book();

    const d = contactData(stub.seen);
    assert.deepEqual(d.email_addresses, [
      { address: 'jane.caller@example.com', name: 'Work', default_email: true },
    ]);
    assert.deepEqual(d.phone_numbers, [
      { number: '(561) 555-0142', name: 'Mobile', default_number: true },
    ]);
  });

  test("the qualifier's state becomes the address province — Clio's name for it", async () => {
    stub = stubAll();
    await book();

    // On the ENRICHMENT PATCH, not the create. Identity only mints the contact.
    const d = enrichData(stub.seen);
    assert.deepEqual(d.addresses, [{ name: 'Home', province: 'FL' }]);
    // `state` is not a field on the Clio address; v4 discards unrecognised keys
    // silently, so spelling it that way would look like a clean 201 with no address.
    assert.equal(JSON.stringify(d.addresses).includes('"state"'), false);
    assert.equal('addresses' in contactData(stub.seen), false, 'never on the create');
  });

  test('outside_us is recorded as a country rather than dropped', async () => {
    stub = stubAll();
    await book({ kv: kvWithQualifier({ state: 'outside_us' }) });

    assert.deepEqual(enrichData(stub.seen).addresses, [{ name: 'Home', country: 'Outside the U.S.' }]);
  });

  test('no qualifier state ⇒ no addresses key at all, not an empty array', async () => {
    // Fields resolvable, so the enrichment PATCH is issued for the intake answers —
    // and still carries no `addresses` key, rather than an empty array Clio would
    // have to interpret.
    stub = stubAll({ cfList: [CF_ROWS] });
    await book({ kv: kvWithQualifier({ state: '' }) });

    assert.equal('addresses' in enrichData(stub.seen), false);
    assert.equal('addresses' in contactData(stub.seen), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TASK 2 — the seven intake answers as custom_field_values
// ─────────────────────────────────────────────────────────────────────────────
describe('the Perch qualifier lands on the contact as custom fields', () => {
  test('all seven answers ship, addressed by resolved custom field id', async () => {
    stub = stubAll({ cfList: [CF_ROWS] });
    const { res } = await book();
    assert.equal(res.status, 201);

    const d = enrichData(stub.seen);
    assert.equal(d.custom_field_values.length, 7, 'one value per intake field');
    assert.deepEqual(cfvByKey(d), INTAKE);

    for (const row of d.custom_field_values) {
      assert.ok(Number.isInteger(row.custom_field.id), 'every value addresses a real field id');
      assert.equal('id' in row, false, 'a fresh contact has no existing CustomFieldValue to update');
    }
    assert.equal('custom_field_values' in contactData(stub.seen), false, 'never on the create');
  });

  test('THE POINT OF THE TICKET: both bands are on the contact', async () => {
    stub = stubAll({ cfList: [CF_ROWS] });
    await book();

    const values = cfvByKey(enrichData(stub.seen));
    assert.equal(values.income_band, '$1.5M–$3M');
    assert.equal(values.net_worth_band, '$5M–$15M');
  });

  test('a booking with no qualifier still creates a populated contact, minus the intake', async () => {
    stub = stubAll();
    const { res } = await book({ body: { call_id: '' }, kv: makeKV() });
    assert.equal(res.status, 201);

    const d = contactData(stub.seen);
    assert.equal(d.first_name, 'Jane');
    assert.deepEqual(d.phone_numbers, [{ number: '(561) 555-0142', name: 'Mobile', default_number: true }]);
    assert.equal('custom_field_values' in d, false, 'nothing to say ⇒ the key is absent');
    // ── SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE ────────────────────────────
    // The two assertions that used to sit here — never list, never PATCH — were both
    // consequences of "no qualifier means nothing to write about this contact", and
    // that premise is what this order changed. Two things are now owed to a booking
    // whose client answered nothing: the consult type (off the booking's own typeId)
    // and the firm's website. So the id lookup runs and an enrichment PATCH is sent.
    //
    // What this test is FOR is unchanged and is asserted harder below: the client's
    // seven answers are absent, because there were none.
    assert.equal(stub.seen.cfLists.length, 1, 'the ids are resolved for the consult type');

    assert.equal(stub.seen.patches.length, 1, 'one enrichment PATCH — the booking-level half');
    const p = stub.seen.patches[0].body.data;
    // The account in this stub does not carry `Intake Consult Type` (CF_ROWS is built
    // from the seven), so it resolves to nothing and is SKIPPED rather than guessed —
    // which leaves the website as the whole of the diff. That is the honest shape of
    // this fixture, and it doubles as proof that an unresolvable field is dropped
    // rather than written with a null id.
    assert.deepEqual(Object.keys(p), ['web_sites'], 'the website, and nothing else');
    assert.deepEqual(cfvByKey(p), {}, 'not one of the client\'s answers — there were none');
  });

  test('an UNVERIFIED call_id attaches no intake — a forged id cannot stamp a contact', async () => {
    stub = stubAll();
    // The bridge and KV know nothing about this id, so the binding withholds.
    const res = await onRequestPost({
      request: post(body({ call_id: 'call_forged00000000000001' })),
      env: env({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: makeDurableObject() }),
    });
    assert.equal(res.status, 201);

    const d = contactData(stub.seen);
    assert.equal('custom_field_values' in d, false);
    assert.equal('addresses' in d, false);
    // A PATCH is sent now (see the no-qualifier case above), so "withheld" has to be
    // asserted on its CONTENTS rather than on the absence of the request. This is the
    // stronger statement anyway: the forged id buys the caller a contact carrying the
    // firm's own website and nothing whatsoever that came off a qualifier record.
    assert.equal(stub.seen.patches.length, 1);
    const p = stub.seen.patches[0].body.data;
    assert.deepEqual(cfvByKey(p), {}, 'a forged id stamps no answer onto the contact');
    assert.equal('addresses' in p, false, 'and no state either — the address is withheld too');
    assert.deepEqual(p.web_sites, [{
      address: 'https://www.donovan.law/', name: 'Other', default_web_site: true,
    }], 'only the firm-constant website, which carries nothing about anybody');
  });

  test('a record written before this change (summary, no intake) degrades cleanly', async () => {
    stub = stubAll();
    const legacy = makeKV({
      [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY, matter: 'real_estate' }),
    });
    const { res } = await book({ kv: legacy });
    assert.equal(res.status, 201);

    const d = contactData(stub.seen);
    assert.equal('custom_field_values' in d, false);
    // The prose half still reaches the note, which is the whole point of keeping both.
    assert.match(stub.seen.notes[0].data.detail, /— Perch intake —/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. TASK 2 — id resolution: seed, or list, then cache. Never write.
// ─────────────────────────────────────────────────────────────────────────────
describe('custom field ids are looked up, and cached — never created', () => {
  test('a cold account is LISTED, and nothing at all is written to it', async () => {
    stub = stubAll();
    const { res } = await book();

    assert.equal(res.status, 201);
    assert.ok(stub.seen.calls.includes('cf:list'), 'it looks');
    assert.deepEqual(stub.seen.cfCreates, [], 'and never writes a definition');
    // Nothing resolved ⇒ nothing bound ⇒ the intake simply is not on the contact.
    assert.equal('custom_field_values' in enrichData(stub.seen), false);
  });

  test('an unresolved name is SKIPPED and says so by name, never by value', async () => {
    // Six on the account, one absent. The six still ship; the seventh is skipped.
    stub = stubAll({ cfList: [CF_ROWS.filter((r) => r.name !== FIELD_NAME.source)] });
    await book();

    const values = cfvByKey(enrichData(stub.seen));
    assert.equal(Object.keys(values).length, 6);
    assert.equal('source' in values, false, 'skipped, not sent with a null id');
    assert.ok(mute.saw(FIELD_NAME.source), 'named in the warn');
    assert.equal(mute.saw('Referred by a client'), false, 'never the value');
  });

  test('the list query asks Clio for contact-parent fields only', async () => {
    stub = stubAll();
    await book();
    const u = stub.seen.cfLists[0];
    assert.match(u, /parent_type=contact/, 'lowercase — the GET enum');
    assert.match(u, /deleted=false/);
  });

  test('every field on the account is FOUND by name and bound to its id', async () => {
    stub = stubAll({ cfList: [CF_ROWS] });
    await book();

    assert.deepEqual(stub.seen.cfCreates, [], 'the definition-write tripwire stays empty');
    assert.deepEqual(cfvByKey(enrichData(stub.seen)), INTAKE);
  });

  test('a paginated account is walked to the last page, and both pages bind', async () => {
    stub = stubAll({
      cfList: [CF_ROWS.slice(0, 4), CF_ROWS.slice(4)],
    });
    await book();

    assert.equal(stub.seen.cfLists.length, 2, 'both pages fetched');
    assert.deepEqual(stub.seen.cfCreates, [], 'page 2 held the rest — nothing was missing');
    assert.deepEqual(cfvByKey(enrichData(stub.seen)), INTAKE, 'and both pages bound');
  });

  test('ids are CACHED: a second booking re-lists nothing', async () => {
    stub = stubAll({ cfList: [CF_ROWS] });
    await book();
    assert.equal(stub.seen.cfLists.length, 1);

    await book();
    assert.equal(stub.seen.cfLists.length, 1, 'no second list');
    // …and the second booking still writes every field, off the cache.
    assert.equal(stub.seen.contacts.length, 2);
    assert.deepEqual(cfvByKey(enrichData(stub.seen, 1)), INTAKE);
  });

  test('A FAILED LIST BINDS NOTHING — absent-from-a-failed-list is not absent', async () => {
    // The list is how a name becomes an id. When it fails, the names it would have
    // answered are unresolved rather than known-missing, so they are simply skipped:
    // the booking is unaffected, the contact carries no custom_field_values, and the
    // same answers are still legible on the intake Note. Nothing is written to the
    // account off a walk that did not finish — and after R2 there is nothing this
    // code COULD write, which the tripwire below re-states rather than discovers.
    stub = stubAll({ cfListStatus: 500 });
    const { res } = await book();

    assert.equal(res.status, 201, 'the booking is unaffected');
    assert.deepEqual(stub.seen.cfCreates, [], 'and the definition-write tripwire stays empty');
    assert.equal('custom_field_values' in contactData(stub.seen), false);
  });

  test('the retry is on the NEXT booking: a failed list is not cached as success', async () => {
    stub = stubAll({ cfListStatus: 500 });
    await book();
    stub.restore();

    stub = stubAll({ cfList: [CF_ROWS] });
    await book();
    assert.equal(stub.seen.cfLists.length, 1, 'it listed again');
    assert.deepEqual(cfvByKey(enrichData(stub.seen)), INTAKE);
  });

  test('ids handed over by the firm are used as-is — nothing is listed or written', async () => {
    // The SHIPPING path: David creates the field set in Clio settings and hands the
    // ids back through configuration, no code change and no definition minted.
    stub = stubAll();
    // The WHOLE resolvable set, not just the seven. A partial CLIO_INTAKE_FIELD_IDS is
    // legal and documented — unlisted keys fall through to the name lookup — so
    // handing over seven of eight would leave one to discover, and "nothing left to
    // discover" would then be false for a reason that has nothing to do with what
    // this test is about (SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE).
    const handed = Object.fromEntries(CONTACT_CUSTOM_FIELDS.map((f) => [f.key, FIELD_ID[f.key]]));
    await book({}, { CLIO_INTAKE_FIELD_IDS: JSON.stringify(handed) });

    assert.deepEqual(stub.seen.cfLists, [], 'nothing left to discover');
    assert.deepEqual(stub.seen.cfCreates, []);
    assert.deepEqual(cfvByKey(enrichData(stub.seen)), INTAKE_PLUS_CONSULT);
  });

  test('a malformed CLIO_INTAKE_FIELD_IDS is ignored, not thrown', async () => {
    stub = stubAll();
    const { res } = await book({}, { CLIO_INTAKE_FIELD_IDS: '{not json' });
    assert.equal(res.status, 201);
    assert.equal(stub.seen.cfLists.length, 1, 'it falls back to discovery');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. AN ACCOUNT WITHOUT THE FIELDS costs fields, not bookings
// ─────────────────────────────────────────────────────────────────────────────
describe('an account that does not have the fields yet still books normally', () => {
  test('no fields on the account ⇒ 201 booking, contact written, no custom_field_values', async () => {
    stub = stubAll();
    const { res } = await book();

    assert.equal(res.status, 201);
    assert.equal(contactData(stub.seen).first_name, 'Jane', 'the standard fields are unaffected');
    const d = enrichData(stub.seen);
    assert.deepEqual(d.addresses, [{ name: 'Home', province: 'FL' }], 'the address is unaffected');
    assert.equal('custom_field_values' in d, false);
  });

  test('the lookup is not re-run per booking once the account has answered', async () => {
    stub = stubAll();
    await book();
    assert.equal(stub.seen.cfLists.length, 1);

    await book();
    assert.equal(stub.seen.cfLists.length, 1, 'answered once, not re-asked per booking');
  });

  test('the intake is still legible — the Note carries the full rollup', async () => {
    stub = stubAll();
    await book();

    const detail = stub.seen.notes[0].data.detail;
    assert.match(detail, /Income: \$1\.5M–\$3M/);
    assert.match(detail, /Net worth: \$5M–\$15M/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. TASK 1 — the UPDATE path
// ─────────────────────────────────────────────────────────────────────────────
describe('a returning client updates the contact instead of leaving it stale', () => {
  /** A contact Clio already holds, matched on email. */
  function existing(over = {}) {
    return {
      id: CONTACT_ID,
      first_name: 'Jane',
      last_name: 'Caller',
      email_addresses: [{ address: 'jane.caller@example.com' }],
      phone_numbers: [],
      addresses: [],
      custom_field_values: [],
      ...over,
    };
  }

  test('the found branch PATCHes rather than writing nothing', async () => {
    stub = stubAll({ contactFound: existing(), cfList: [CF_ROWS] });
    const { res } = await book();
    assert.equal(res.status, 201);

    assert.equal(stub.seen.contacts.length, 0, 'no duplicate contact created');
    assert.equal(stub.seen.patches.length, 1);
    assert.equal(stub.seen.patches[0].url, `${CLIO_CONTACTS}/${CONTACT_ID}`);

    const d = stub.seen.patches[0].body.data;
    assert.deepEqual(cfvByKey(d), INTAKE);
    assert.deepEqual(d.addresses, [{ name: 'Home', province: 'FL' }]);
    assert.deepEqual(d.phone_numbers, [{ number: '(561) 555-0142', name: 'Mobile', default_number: true }]);
  });

  test('existing intake values are UPDATED IN PLACE, not appended alongside', async () => {
    // Clio needs the CustomFieldValue id to replace a value; without it a repeat
    // booking leaves the lawyer two "Intake Income Band" rows and no way to tell
    // which is current.
    stub = stubAll({
      contactFound: existing({
        custom_field_values: [
          { id: 'cfv-1', custom_field: { id: FIELD_ID.income_band } },
          { id: 'cfv-2', custom_field: { id: FIELD_ID.net_worth_band } },
        ],
      }),
      cfList: [CF_ROWS],
    });
    await book();

    const rows = stub.seen.patches[0].body.data.custom_field_values;
    const income = rows.find((r) => r.custom_field.id === FIELD_ID.income_band);
    const netWorth = rows.find((r) => r.custom_field.id === FIELD_ID.net_worth_band);
    assert.equal(income.id, 'cfv-1', 'replaces the value that is already there');
    assert.equal(netWorth.id, 'cfv-2');
    const language = rows.find((r) => r.custom_field.id === FIELD_ID.language);
    assert.equal('id' in language, false, 'a field with no value yet is added, not replaced');
  });

  test('a phone the contact already has is not appended a second time', async () => {
    // Digits only, so a re-formatted copy of the same number is recognised.
    stub = stubAll({ contactFound: existing({ phone_numbers: [{ id: 1, number: '561-555-0142' }] }) });
    await book();

    const d = stub.seen.patches[0].body.data;
    assert.equal('phone_numbers' in d, false);
  });

  test('a name corrected by hand in Clio is not overwritten by the booking form', async () => {
    stub = stubAll({ contactFound: existing({ first_name: 'Janet', last_name: 'Caller-Smith' }) });
    await book();

    const d = stub.seen.patches[0].body.data;
    assert.equal('first_name' in d, false);
    assert.equal('last_name' in d, false);
  });

  test('a missing name IS filled in', async () => {
    stub = stubAll({ contactFound: existing({ first_name: '', last_name: '' }) });
    await book();

    const d = stub.seen.patches[0].body.data;
    assert.equal(d.first_name, 'Jane');
    assert.equal(d.last_name, 'Q Caller');
  });

  test('nothing to change ⇒ no PATCH is issued at all', async () => {
    stub = stubAll({
      contactFound: existing({
        phone_numbers: [{ id: 1, number: '(561) 555-0142' }],
        addresses: [{ id: 2, province: 'FL' }],
        // …and a website of their own. SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE:
        // a BLANK Website is a change now — the firm's site is written onto it once —
        // so a contact that is genuinely up to date has to have one already. It also
        // makes this the case that proves the client's own URL survives: the diff is
        // empty, so nothing is sent, so nothing can overwrite it.
        web_sites: [{ id: 3, address: 'https://janeqcaller.example/' }],
      }),
      kv: undefined,
    });
    const { res } = await book({ body: { call_id: '' }, kv: makeKV() });

    assert.equal(res.status, 201);
    assert.deepEqual(stub.seen.patches, [], 'a no-op subrequest is latency on a client booking');
  });

  test('a rejected field selection falls back — it must NOT duplicate the contact', async () => {
    // Asking Clio for more fields than the 2026-07-03 probe verified is the one way
    // this ticket could make things worse: a 400 on the SEARCH does not degrade to
    // "no enrichment", it degrades to "no match", and no match creates a second
    // contact for a client Clio already holds.
    stub = stubAll({ contactFound: existing(), rejectEnrichedSearch: true, cfList: [CF_ROWS] });
    const { res } = await book();

    assert.equal(res.status, 201);
    assert.equal(stub.seen.searches.length, 2, 'enriched, then the verified minimal selection');
    assert.equal(stub.seen.contacts.length, 0, 'NO duplicate contact');
    assert.equal(stub.seen.patches.length, 1, 'the found contact is still enriched');
    // The intake still lands; it is appended rather than updated in place, because
    // the fallback record cannot say what values are already there.
    assert.deepEqual(cfvByKey(stub.seen.patches[0].body.data), INTAKE);
  });

  test('a failed PATCH costs the enrichment, never the booking or the email', async () => {
    stub = stubAll({ contactFound: existing(), contactPatchStatus: 500 });
    const { res } = await book();

    assert.equal(res.status, 201);
    const e = entryData(stub.seen);
    assert.deepEqual(e.attendees, [{ id: CONTACT_ID, type: 'Contact' }, { id: 9084638, type: 'Calendar' }], 'the attendee still attaches');
    assert.equal(e.send_email_notification, true);
    assert.equal(stub.seen.notes.length, 1, 'and the note is still filed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. TASK 3 — the Note stays the human-readable rollup
// ─────────────────────────────────────────────────────────────────────────────
describe('the intake note still carries the whole picture in prose', () => {
  test('structured on the contact AND readable on the note — both, not either', async () => {
    stub = stubAll({ cfList: [CF_ROWS] });
    await book();

    assert.deepEqual(cfvByKey(enrichData(stub.seen)), INTAKE);

    const note = stub.seen.notes[0].data;
    assert.equal(note.type, 'Contact');
    assert.deepEqual(note.contact, { id: CONTACT_ID });
    assert.match(note.detail, /— Perch intake —/);
    assert.match(note.detail, /Income: \$1\.5M–\$3M/);
    assert.match(note.detail, /Net worth: \$5M–\$15M/);
    assert.match(note.detail, /Phone: \(561\) 555-0142/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. TASK 4 — the separation, proved from one booking
// ─────────────────────────────────────────────────────────────────────────────
describe('the client-facing surfaces are untouched by any of this', () => {
  test('THE SEPARATION: bands on the contact, zero bands in the description', async () => {
    stub = stubAll({ cfList: [CF_ROWS] });
    const { res } = await book();
    assert.equal(res.status, 201);

    // Half one — the contact has everything.
    const values = cfvByKey(enrichData(stub.seen));
    assert.equal(values.income_band, '$1.5M–$3M');
    assert.equal(values.net_worth_band, '$5M–$15M');

    // Half two — the entry Clio emails has none of it. Asserted against the WHOLE
    // entry body, not just the description, because `summary` and `location` are
    // rendered to the client too.
    const e = entryData(stub.seen);
    const emailed = JSON.stringify(e);
    for (const s of FORBIDDEN) {
      assert.equal(emailed.includes(s), false, `client-facing entry must not contain: ${s}`);
    }

    // Stronger than matching a literal: the description is EXACTLY what the guarded
    // builder returns from firm configuration, so nothing was appended to it on the
    // way to the entry. A literal expectation here would only prove that today's
    // config renders today's string.
    assert.equal(e.description, buildClientDescription({
      typeName: 'Initial Consultation',
      meetingLink: MEETING_LINK,
      firmPhone: '(561) 666-6022',
      firmEmail: 'info@donovan.law',
    }));
  });

  test('hostile input: bands stuffed into every field a caller controls stay out', async () => {
    stub = stubAll();
    const nasty = `${BAND_INCOME} ${BAND_NET_WORTH}`;
    await book({
      body: { name: nasty, notes: nasty, email: 'nasty@example.com', phone: nasty },
      kv: kvWithQualifier(),
    });

    // Scoped to the DESCRIPTION, which is the surface this ticket could regress and
    // the one Clio renders into the email body. The entry `summary` is deliberately
    // out of scope: it is "<name> — <type>" by design, so a caller who types a band
    // into their own NAME field mails it to themselves. That is their string about
    // themselves, not the firm's qualification of them leaking outward.
    const desc = entryData(stub.seen).description;
    for (const s of FORBIDDEN) {
      assert.equal(desc.includes(s), false, `must not reach the description: ${s}`);
    }
    assert.equal(desc.includes(nasty), false, "nor the caller's own free text");
  });

  test('buildClientDescription has no parameter that could accept intake', async () => {
    // The signature IS the guard (SHELDON-CLIO-CONFIRM-EMAIL). This ticket adds a
    // third carrier of the bands — `intake` — and this asserts it did not become a
    // fourth argument here by way of an object spread.
    const out = buildClientDescription({
      typeName: 'Consultation',
      meetingLink: MEETING_LINK,
      firmPhone: '',
      firmEmail: '',
      // Everything below is ignored by construction: not in the destructured list.
      intake: INTAKE,
      intakeSummary: SUMMARY,
      notes: BAND_INCOME,
      contact: { name: BAND_NET_WORTH },
    });
    for (const s of FORBIDDEN) {
      assert.equal(out.includes(s), false, `must not contain: ${s}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. THE PRODUCER — fn/qualifier_submit writes the structure the booking reads
// ─────────────────────────────────────────────────────────────────────────────
describe('the qualifier record carries both halves of the same answers', () => {
  test('the KV copy holds the prose summary AND the structured intake and state', async () => {
    const kv = makeKV();
    const bridge = makeDurableObject();
    const m = muteConsole();
    try {
      const res = await qualifierSubmit({
        request: new Request('https://www.donovan.law/fn/qualifier_submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            call_id: CALL_ID,
            matter_category: 'real_estate',
            matter_sub: 'acquisition',
            for_whom: 'yourself',
            income_band: '1_5m_3m',
            net_worth_band: '5m_15m',
            language: 'en',
            source: 'Referred by a client',
            state: 'fl',
          }),
        }),
        env: { PERCH_ACTIONS: kv, PERCH_BRIDGE: bridge },
        waitUntil: () => {},
      });
      assert.equal(res.status, 200);
    } finally { m.restore(); }

    const rec = JSON.parse(await kv.get(`qualbk:${CALL_ID}`));
    // Structure — what becomes custom_field_values on the contact. Labels, not
    // enum keys: fn/qualifier_submit owns LABELS, so the booking side never
    // re-spells a value.
    assert.deepEqual(rec.intake, INTAKE);
    assert.equal(rec.state, 'FL', 'uppercased on the way in');
    // Prose — what becomes the contact Note. Both, from one record.
    assert.match(rec.summary, /— Perch intake —/);
    assert.match(rec.summary, /Income: \$1\.5M–\$3M/);
  });

  test('only the seven mapped answers become intake — the rest stay in the prose', async () => {
    const kv = makeKV();
    const m = muteConsole();
    try {
      await qualifierSubmit({
        request: new Request('https://www.donovan.law/fn/qualifier_submit', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            call_id: CALL_ID,
            matter_category: 'tax',
            citizenship: 'visa',
            immersion_track: 'first_investment',
          }),
        }),
        env: { PERCH_ACTIONS: kv, PERCH_BRIDGE: makeDurableObject() },
        waitUntil: () => {},
      });
    } finally { m.restore(); }

    const rec = JSON.parse(await kv.get(`qualbk:${CALL_ID}`));
    assert.deepEqual(Object.keys(rec.intake), ['matter_category']);
    assert.equal(rec.intake.matter_category, 'Tax');
    // Citizenship and tier are not on the contact's field set by decision — every
    // entry there is one more field on every contact — but they are still readable.
    assert.match(rec.summary, /Citizenship: Visa holder/);
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ORDER SHELDON-CLIO-CONTACT-MAPPING-R2
//
// Four defects, two of them live on main before this branch existed. Each block
// below carries its CONTROL — the assertion that fails when run against the branch
// head — because "no duplicate was created" and "no placeholder was written" are
// both things a test can claim while proving nothing.
// ═════════════════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────────────────
// R2.1 — DEFECT ONE, LIVE: an inconclusive search minted a duplicate Person
// ─────────────────────────────────────────────────────────────────────────────
describe('the search asks Clio the question it documents', () => {
  test('THE CONTROL: the search parameter is `query`, and `q` appears nowhere', async () => {
    // `q` is not in the documented parameter list for GET /contacts. An unrecognised
    // query parameter is IGNORED rather than rejected, so the wrong spelling does not
    // error — the filter silently stops applying and every returning client falls
    // through to the create branch as "not found". The branch head sends `q=`.
    stub = stubAll({ cfList: [CF_ROWS] });
    await book();

    for (const u of stub.seen.searches) {
      const params = new URL(u).searchParams;
      assert.ok(params.has('query'), `the documented name is sent: ${u}`);
      assert.equal(params.has('q'), false, `the undocumented alias is not: ${u}`);
    }

    // SHELDON-154-CLIO-DEDUP. This used to assert every search carried the EMAIL.
    // There are two legs now, and the spelling rule has to bind to both of them —
    // a phone search that reached for `q=` would slip straight past a check that
    // only ever looked at the email one. So: the parameter name is asserted above
    // across EVERY search, and each leg is then pinned to the value it must carry.
    const { emailLeg, phoneLeg } = searchLegs(stub.seen);
    assert.ok(emailLeg.length > 0, 'the email leg ran');
    for (const u of emailLeg) {
      assert.equal(new URL(u).searchParams.get('query'), 'jane.caller@example.com');
    }
    for (const u of phoneLeg) {
      const q = new URL(u).searchParams.get('query');
      assert.equal(q.replace(/\D/g, ''), '5615550142',
        `the phone leg asks about the booking's own number: ${q}`);
    }
  });

  test('THE STATIC CONTROL: no `q` parameter survives in the shipped adapter', async () => {
    const src = readFileSync(
      new URL('../donovan-legal-site/functions/booking/_lib/provider-clio.js', import.meta.url),
      'utf8',
    );
    assert.match(src, /CONTACT_QUERY_PARAM:\s*"query"/);
    assert.equal(/CONTACT_QUERY_PARAM:\s*"q"/.test(src), false);
  });

  test('the type filter still rides alongside it', async () => {
    stub = stubAll({ cfList: [CF_ROWS] });
    await book();
    assert.equal(new URL(stub.seen.searches[0]).searchParams.get('type'), 'Person');
  });
});

describe('a search that did not answer never licenses a second contact', () => {
  test('THE CONTROL, INVERTED: a search that 500s every attempt creates NOTHING', async () => {
    // On the branch head searchContactByEmail returns null on any non-ok response
    // and control falls straight through to POST /contacts. This assertion is
    // `contacts.length === 0`; the head produces 1. That is the control.
    stub = stubAll({ searchStatus: 500 });
    const { res } = await book();

    assert.equal(res.status, 201, 'the booking is still confirmed');
    assert.deepEqual(stub.seen.contacts, [], 'ZERO POST /contacts — no duplicate Person');
    assert.ok(stub.seen.searches.length >= 2, 'and it did retry before giving up');
  });

  test('the retry is real: 500, 500, then an answer — and the answer is used', async () => {
    // The mirror image, and the reason the test above cannot pass by simply never
    // creating. A search that recovers on the third attempt is CONCLUSIVE, so a
    // genuinely absent contact is still created.
    stub = stubAll({ searchStatus: [500, 500, 200] });
    const { res } = await book();

    assert.equal(res.status, 201);
    assert.equal(stub.seen.contacts.length, 1, 'it recovered and created the missing contact');
    // THE EMAIL LEG took exactly three attempts — two refusals and the answer. Counted
    // on its own leg since SHELDON-154-CLIO-DEDUP, because the phone searches that
    // follow a conclusive not-found are a different question and would inflate a bare
    // total into a number that no longer means "the retry stopped when it should".
    assert.equal(searchLegs(stub.seen).emailLeg.length, 3);
  });

  test('a recovered search that FINDS the client patches instead of duplicating', async () => {
    stub = stubAll({
      searchStatus: [500, 200],
      contactFound: {
        id: CONTACT_ID,
        first_name: 'Jane', last_name: 'Caller',
        email_addresses: [{ address: 'jane.caller@example.com' }],
        phone_numbers: [], addresses: [], custom_field_values: [],
      },
      cfList: [CF_ROWS],
    });
    await book();

    assert.deepEqual(stub.seen.contacts, [], 'no second Person');
    assert.equal(stub.seen.patches.length, 1, 'the record the attorney knows is the one enriched');
  });

  test('an inconclusive search takes the no-contact path — no attendee, no note', async () => {
    // The cost of failing closed, asserted rather than assumed. This booking loses
    // its confirmation email; the NEXT one links correctly. A duplicate Person would
    // have cost the firm a forked CRM record no code here can find again.
    stub = stubAll({ searchStatus: 503 });
    const { res } = await book();

    assert.equal(res.status, 201);
    const e = entryData(stub.seen);
    assert.equal('attendees' in e, false, 'no contact ⇒ no attendee');
    assert.equal('send_email_notification' in e, false);
    assert.deepEqual(stub.seen.notes, [], 'and no note, which needs a contact to hang off');
  });

  test('the outcome is alertable: its own warn, distinct from an enrichment failure', async () => {
    stub = stubAll({ searchStatus: 500 });
    await book();

    assert.ok(mute.saw('contact search inconclusive'), 'a distinct, greppable message');
    assert.ok(mute.saw('no duplicate created'));
    // …and it never prints the thing it searched on. That is the client's email.
    assert.equal(mute.saw('jane.caller@example.com'), false, 'status codes only, never the query');
  });

  test('an unreadable 200 is not an empty result set', async () => {
    // The subtler half of the same defect: a body we cannot parse is no answer, and
    // "no answer" must not be read as "Clio holds no such client".
    const handle = stubFetch(async (url, init) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
      if (u.startsWith('https://app.clio.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));
      if (u.startsWith(CLIO_ENTRIES) && method === 'GET') return new Response(JSON.stringify({ data: [] }));
      if (u.startsWith(CLIO_ENTRIES) && method === 'POST') return new Response(JSON.stringify({ data: { id: 1 } }));
      if (u.startsWith(CLIO_CONTACTS) && method === 'GET') return new Response('<html>not json</html>');
      if (u.startsWith(CLIO_CONTACTS) && method === 'POST') { created += 1; return new Response(JSON.stringify({ data: { id: CONTACT_ID } })); }
      if (u.startsWith(GROW_INBOX) || u.startsWith(VANTAGE_UPSERT)) return new Response(JSON.stringify({ ok: true }));
      return new Response(JSON.stringify({ data: [] }));
    });
    let created = 0;
    try {
      const res = await onRequestPost({
        request: post(body()),
        env: env({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: bridgeWithQualifier() }),
      });
      assert.equal(res.status, 201);
    } finally { handle.restore(); }

    assert.equal(created, 0, 'an unparseable search body created no contact');
  });

  // ── R3 — the same defect, one layer lower down ─────────────────────────────
  //
  // R2 taught this path that a non-2xx and an unreadable body are not answers. It
  // did not teach it that a body it CAN read may still not be one. `data` was shape-
  // tested inline — `Array.isArray(data) ? data : []` — so a 200 carrying `{}` fell
  // through to an empty candidate list and was then reported CONCLUSIVE, which
  // licenses the create and mints exactly the duplicate Person R2 exists to prevent.
  //
  // The pair below is the guard and its narrowing. The first proves a wrong-shaped
  // 200 creates NOTHING; the second proves a right-shaped empty result still DOES,
  // so the guard cannot pass by refusing everything it is shown.
  test('THE CONTROL: a 200 carrying `{}` on every attempt creates NOTHING', async () => {
    stub = stubAll({ searchBody: '{}' });
    const { res } = await book();

    assert.equal(res.status, 201, 'the booking is still confirmed');
    assert.deepEqual(stub.seen.contacts, [], 'ZERO POST /contacts — no duplicate Person');
    assert.equal(
      stub.seen.searches.length, 3,
      'and it exhausted the attempts rather than accepting the first malformed body',
    );
    // Failing closed here means failing closed all the way through: no contact id,
    // so no attendee, no confirmation email and no note — the same cost as any other
    // inconclusive search, which is the cost R2 chose over a forked CRM record.
    const e = entryData(stub.seen);
    assert.equal('attendees' in e, false);
    assert.deepEqual(stub.seen.notes, [], 'no note, which needs a contact to hang off');
  });

  test('THE NARROWING TEST: a well-formed EMPTY `data` array still creates', async () => {
    // The mirror image, and the only thing standing between the guard above and a
    // function that has simply stopped answering yes. `{"data":[]}` is Clio saying
    // "I looked, I hold nobody" — a real answer, and the one that licenses a create.
    // If the guard is ever widened to refuse this, no new client is ever linked
    // again and every booking silently loses its confirmation email.
    stub = stubAll({ searchBody: JSON.stringify({ data: [] }) });
    const { res } = await book();

    assert.equal(res.status, 201);
    assert.equal(stub.seen.contacts.length, 1, 'an empty result set is conclusive — it created');
    // ONE email search, still. The retry bound is what this line pins, and it is pinned
    // on the leg that owns it: an empty `data` array is a perfectly good answer to the
    // email question and asking it again would mean the guard had been widened into
    // refusing the one result that licenses a create.
    const { emailLeg, phoneLeg } = searchLegs(stub.seen);
    assert.equal(emailLeg.length, 1, 'and it did not retry a perfectly good answer');
    // SHELDON-154-CLIO-DEDUP. The phone leg then ran — that is the point of it — and it
    // found nobody, so this booking still created. Asserted so the create above cannot
    // be read as "the phone leg never happened".
    assert.ok(phoneLeg.length > 0, 'the phone leg was asked before a second record was minted');
    assert.ok('attendees' in entryData(stub.seen), 'the client still gets their email');
  });

  test('`data:null` and an error object are refused too, not read as "holds nobody"', async () => {
    // The three shapes a 200 actually arrives in when something is wrong upstream:
    // an empty object, an explicit null, and an error envelope carrying no `data` at
    // all. All three parse. None of them is an answer.
    for (const shaped of ['{}', '{"data":null}', '{"error":{"type":"InternalError"}}']) {
      stub?.restore();
      __resetIntakeFieldCache();
      stub = stubAll({ searchBody: shaped });
      const { res } = await book();

      assert.equal(res.status, 201, `booking survives: ${shaped}`);
      assert.deepEqual(stub.seen.contacts, [], `no contact created for: ${shaped}`);
    }
  });

  test('the shape refusal has its OWN warn, distinct from the unreadable-body one', async () => {
    // Two different operational facts — "Clio sent bytes that are not JSON" and
    // "Clio sent JSON that is not a result set" — and an operator who cannot tell
    // them apart in the logs cannot diagnose either. The inconclusive warn still
    // fires on top, because that is the alertable one.
    stub = stubAll({ searchBody: '{}' });
    await book();

    assert.ok(mute.saw('no result array'), 'its own greppable message');
    assert.equal(mute.saw('unreadable body'), false, 'not the unparseable-body message');
    assert.ok(mute.saw('contact search inconclusive'), 'and the alertable outcome still fires');
    // Status and shape only. The thing it searched on is the client's email.
    assert.equal(mute.saw('jane.caller@example.com'), false, 'never the query');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R2.2 — DEFECT TWO, LIVE: "(unknown)" was written as a client's name
// ─────────────────────────────────────────────────────────────────────────────
describe('no placeholder ever reaches a name field', () => {
  test('THE CONTROL: a single-token name puts "(unknown)" in ZERO Clio bodies', async () => {
    // Whole-body, every Clio request this booking made — not just the contact
    // create. On the branch head the create body carries last_name:"(unknown)" and
    // this count is 1.
    stub = stubAll();
    const { res } = await book({ body: { name: 'Cher' } });
    assert.equal(res.status, 201);

    const hits = stub.seen.clioBodies.filter((b) => b.includes('(unknown)'));
    assert.deepEqual(hits, [], 'the placeholder is gone from every Clio body');
  });

  test('the one survivor is the Grow lead, and it is a stated scope boundary', async () => {
    // booking/_lib/grow-lead.js pads from_first/from_last for Clio GROW's inbox_lead
    // — a different API, no vendored contract in this repo, and its own comment says
    // both parts are required. R2's defect is the CLIO contact, and the reasoning
    // that removes the padding there (the Clio Contacts documentation) does not
    // speak for Grow. This test exists so the remaining occurrence is a decision on
    // the record rather than an omission, and so it FAILS if it ever spreads back
    // into a Clio body.
    stub = stubAll();
    await book({ body: { name: 'Cher' } });

    const all = stub.seen.allBodies.filter((b) => b.includes('(unknown)'));
    const clio = stub.seen.clioBodies.filter((b) => b.includes('(unknown)'));
    assert.equal(clio.length, 0);
    for (const b of all) {
      assert.match(b, /inbox_lead/, 'the only producer left is the Grow lead');
    }
  });

  test('the token lands as the surname, which is what Clio sorts and composes on', async () => {
    stub = stubAll();
    await book({ body: { name: 'Cher' } });

    const d = contactData(stub.seen);
    assert.equal(d.last_name, 'Cher');
    assert.equal('first_name' in d, false);
  });

  test('a normal two-token name is unaffected', async () => {
    stub = stubAll();
    await book({ body: { name: 'Jane Caller' } });

    const d = contactData(stub.seen);
    assert.equal(d.first_name, 'Jane');
    assert.equal(d.last_name, 'Caller');
  });

  test('THE SECOND ROUTE: a guessed surname is never PATCHed onto an existing record', async () => {
    // PR 123 added this one. The contact exists with a blank surname, the caller
    // types one word, and updateContact fills the gap — writing a word we do not
    // know to be a surname onto a record the firm may have curated.
    stub = stubAll({
      contactFound: {
        id: CONTACT_ID,
        first_name: 'Cher', last_name: '',
        email_addresses: [{ address: 'jane.caller@example.com' }],
        phone_numbers: [{ id: 1, number: '(561) 555-0142' }],
        addresses: [{ id: 2, province: 'FL' }],
        custom_field_values: [],
      },
      cfList: [CF_ROWS],
    });
    await book({ body: { name: 'Cher' } });

    const d = enrichData(stub.seen);
    assert.equal('last_name' in d, false, 'a one-word name is not evidence of a surname');
    assert.deepEqual(
      stub.seen.clioBodies.filter((b) => b.includes("(unknown)")), [],
      'and no placeholder on the update path either',
    );
  });

  test('a MULTI-token name still fills a blank surname — the guard is narrow', async () => {
    // Without this, "never PATCH a surname" could pass by never patching one at all.
    stub = stubAll({
      contactFound: {
        id: CONTACT_ID,
        first_name: '', last_name: '',
        email_addresses: [{ address: 'jane.caller@example.com' }],
        phone_numbers: [{ id: 1, number: '(561) 555-0142' }],
        addresses: [{ id: 2, province: 'FL' }],
        custom_field_values: [],
      },
      cfList: [CF_ROWS],
    });
    await book();

    const d = enrichData(stub.seen);
    assert.equal(d.first_name, 'Jane');
    assert.equal(d.last_name, 'Q Caller');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R2.3 — DEFECT THREE: an optional field could cost the confirmation email
// ─────────────────────────────────────────────────────────────────────────────
describe('a rejected optional field cannot cost the client their email', () => {
  test('THE CONTROL: a Clio that 400s any create carrying custom_field_values', async () => {
    // This stub rejects EXACTLY the pre-fix body shape. Against the branch head the
    // create carries the seven values, gets a 400, findOrCreateContact returns null,
    // and the entry ships with no attendee and no send_email_notification while the
    // booking still answers 201 — the client silently loses their confirmation
    // email. After the split the create carries identity only, so the same stub
    // never fires and everything below holds.
    stub = stubAll({ rejectCustomFieldsOnCreate: true, cfList: [CF_ROWS] });
    const { res } = await book();
    assert.equal(res.status, 201);

    const e = entryData(stub.seen);
    assert.deepEqual(e.attendees, [{ id: CONTACT_ID, type: 'Contact' }, { id: 9084638, type: 'Calendar' }], 'the attendee still attaches');
    assert.equal(e.send_email_notification, true);
    assert.equal(stub.seen.notes.length, 1, 'exactly one intake note');
  });

  test('the create body is identity only — four keys, nothing optional', async () => {
    stub = stubAll({ cfList: [CF_ROWS] });
    await book();

    const d = contactData(stub.seen);
    assert.deepEqual(
      Object.keys(d).sort(),
      ['email_addresses', 'first_name', 'last_name', 'phone_numbers', 'type'].sort(),
    );
    assert.equal('addresses' in d, false);
    assert.equal('custom_field_values' in d, false);
  });

  test('a PATCH that fails outright still leaves the attendee, the email and the note', async () => {
    stub = stubAll({ contactPatchStatus: 500, cfList: [CF_ROWS] });
    const { res } = await book();

    assert.equal(res.status, 201);
    const e = entryData(stub.seen);
    assert.deepEqual(e.attendees, [{ id: CONTACT_ID, type: 'Contact' }, { id: 9084638, type: 'Calendar' }]);
    assert.equal(e.send_email_notification, true);
    assert.equal(stub.seen.notes.length, 1);
    // Status only — the PATCH body is the client's finances.
    assert.ok(mute.saw('contact enrichment not applied'));
    assert.equal(mute.saw('$1.5M–$3M'), false);
  });

  test('the optional half still ARRIVES — the split moved it, it did not drop it', async () => {
    stub = stubAll({ cfList: [CF_ROWS] });
    await book();

    const d = enrichData(stub.seen);
    assert.deepEqual(cfvByKey(d), INTAKE);
    assert.deepEqual(d.addresses, [{ name: 'Home', province: 'FL' }]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R2.4 — DEFECT FOUR: minting field DEFINITIONS into the firm's live account
// ─────────────────────────────────────────────────────────────────────────────
describe('field definitions are never minted into a live account', () => {
  test('THE CONTROL: no combination of stubs produces a POST /custom_fields', async () => {
    // The branch head issues seven creates against a cold account. There is no flag
    // to set here and no env that turns this back on — the code path is gone.
    for (const opts of [{}, { cfList: [[]] }, { cfList: [CF_ROWS.slice(0, 3)] }, { cfListStatus: 500 }]) {
      __resetIntakeFieldCache();
      stub?.restore();
      stub = stubAll(opts);
      const { res } = await book();
      assert.equal(res.status, 201);
      assert.deepEqual(stub.seen.cfCreates, [], `zero definitions written for ${JSON.stringify(opts)}`);
    }
  });

  test('THE STATIC CONTROL: the shipped source contains no create path at all', async () => {
    // A behavioural test can only prove the stubs it was given were not called. This
    // reads the module that ships. On the branch head both assertions fail.
    const src = readFileSync(
      new URL('../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js', import.meta.url),
      'utf8',
    );
    assert.equal(src.includes('createContactField'), false, 'the function is gone, not just unreferenced');
    assert.equal(/method:\s*["']POST["']/.test(src), false, 'and nothing here posts anything');

    // The transport it is handed cannot post either, which is the structural half.
    const provider = readFileSync(
      new URL('../donovan-legal-site/functions/booking/_lib/provider-clio.js', import.meta.url),
      'utf8',
    );
    const shim = provider.slice(provider.indexOf('async function intakeFieldIds'));
    assert.equal(shim.slice(0, shim.indexOf('}\n')).includes('post:'), false,
      'the api shim exposes get only');
  });

  test('ids handed over ⇒ the seven resolve with no lookup and no writes', async () => {
    // The shipping posture: David builds the fields by hand and hands back the ids.
    stub = stubAll();
    // The WHOLE resolvable set, not just the seven. A partial CLIO_INTAKE_FIELD_IDS is
    // legal and documented — unlisted keys fall through to the name lookup — so
    // handing over seven of eight would leave one to discover, and "nothing left to
    // discover" would then be false for a reason that has nothing to do with what
    // this test is about (SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE).
    const handed = Object.fromEntries(CONTACT_CUSTOM_FIELDS.map((f) => [f.key, FIELD_ID[f.key]]));
    await book({}, { CLIO_INTAKE_FIELD_IDS: JSON.stringify(handed) });

    assert.deepEqual(stub.seen.cfLists, [], 'nothing left to discover');
    assert.deepEqual(cfvByKey(enrichData(stub.seen)), INTAKE_PLUS_CONSULT,
      'all seven resolved with no writes, and the consult type beside them');
  });

  test('fields already in the account ⇒ found by name, still no writes', async () => {
    stub = stubAll({ cfList: [CF_ROWS] });
    await book();

    assert.deepEqual(stub.seen.cfCreates, []);
    assert.deepEqual(cfvByKey(enrichData(stub.seen)), INTAKE);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R2.5 — the two idempotency defects, and the field_type admission test
// ─────────────────────────────────────────────────────────────────────────────
describe('resolution refuses to conclude more than it actually observed', () => {
  test('THE CONTROL: a picklist row is REFUSED, not bound', async () => {
    // field_type is immutable in Clio, so binding to a picklist writes values it
    // rejects on every booking from here on. The branch head reads only id and name
    // and binds this row; the assertion that it is absent is the control.
    const rows = CF_ROWS.map((r) => (r.name === FIELD_NAME.income_band
      ? { ...r, field_type: 'picklist' }
      : r));
    stub = stubAll({ cfList: [rows] });
    await book();

    const values = cfvByKey(enrichData(stub.seen));
    assert.equal('income_band' in values, false, 'refused rather than bound to a picklist');
    assert.equal(values.net_worth_band, '$5M–$15M', 'the correctly-typed six are unaffected');
    assert.ok(mute.saw(FIELD_NAME.income_band), 'warned by field NAME');
    assert.equal(mute.saw('$1.5M–$3M'), false, 'and never by value');
  });

  test('every entry DECLARES its expected type, from the documented enum', async () => {
    // The enum at paths["/custom_fields.json"].post…field_type.enum. A typo here
    // would refuse a field that is in fact correct, silently and forever.
    const VALID = new Set(['checkbox', 'contact', 'currency', 'date', 'time', 'email',
      'matter', 'numeric', 'picklist', 'text_area', 'text_line', 'url']);
    for (const f of INTAKE_CUSTOM_FIELDS) {
      assert.ok(VALID.has(f.type), `${f.name} declares a real field_type: ${f.type}`);
    }
  });

  test('THE EXPECTATION IS PER FIELD: each of the seven is judged on its own', async () => {
    // Seven independent cases. In each, exactly ONE row is given a type its entry
    // does not declare, and exactly that one field must be missing from the body
    // while the other six ship. A single global expectation cannot distinguish these
    // seven outcomes; only reading each entry's own declaration can.
    for (const target of INTAKE_CUSTOM_FIELDS) {
      __resetIntakeFieldCache();
      stub?.restore();
      mute.restore();
      mute = muteConsole();

      const wrong = target.type === 'text_line' ? 'picklist' : 'text_line';
      const rows = CF_ROWS.map((r) => (r.name === target.name ? { ...r, field_type: wrong } : r));
      stub = stubAll({ cfList: [rows] });
      await book();

      const values = cfvByKey(enrichData(stub.seen));
      assert.equal(target.key in values, false, `${target.name} refused on type`);
      assert.equal(Object.keys(values).length, 6, `the other six still ship for ${target.name}`);
      assert.ok(mute.saw(target.name), 'warned by field NAME');
    }
  });

  test('a row reporting no type at all is refused too — absent is not text_line', async () => {
    const rows = CF_ROWS.map((r) => {
      const { field_type: _drop, ...rest } = r;
      return rest;
    });
    stub = stubAll({ cfList: [rows] });
    await book();

    // The address still applies — the enrichment PATCH is not all-or-nothing — but
    // not one intake value is bound.
    const d = enrichData(stub.seen);
    assert.equal('custom_field_values' in d, false, 'nothing bound off an untyped row');
    assert.deepEqual(d.addresses, [{ name: 'Home', province: 'FL' }]);
  });

  test('an operator-seeded id overrides the type check — a human said bind THIS', async () => {
    const rows = CF_ROWS.map((r) => ({ ...r, field_type: 'picklist' }));
    stub = stubAll({ cfList: [rows] });
    const handed = Object.fromEntries(INTAKE_CUSTOM_FIELDS.map((f) => [f.key, FIELD_ID[f.key]]));
    await book({}, { CLIO_INTAKE_FIELD_IDS: JSON.stringify(handed) });

    assert.deepEqual(cfvByKey(enrichData(stub.seen)), INTAKE);
  });

  test('THE CONTROL: a walk that hits MAX_PAGES reports a FAILED list', async () => {
    // Twelve pages, each pointing at a next one. The module bounds the walk at ten.
    // The branch head returns true from that loop — "I enumerated the account" — and
    // a caller is then entitled to conclude that anything it did not see is absent.
    // It stops at ten either way; the question is whether it LIES about why.
    const pages = Array.from({ length: 12 }, () => []);
    stub = stubAll({ cfList: pages });
    const { res } = await book();

    assert.equal(res.status, 201, 'the booking is unaffected');
    assert.equal(stub.seen.cfLists.length, 10, 'bounded at MAX_PAGES');
    assert.ok(mute.saw('truncated'), 'and says the walk was truncated');
    assert.ok(mute.saw('list failed'), 'which is reported as a FAILED list, not a complete one');
  });

  test('a truncated walk is not cached as success — the next booking re-lists', async () => {
    const pages = Array.from({ length: 12 }, () => []);
    stub = stubAll({ cfList: pages });
    await book();

    stub.restore();
    stub = stubAll({ cfList: [CF_ROWS] });
    await book();
    assert.equal(stub.seen.cfLists.length, 1, 'it enumerated again');
    assert.deepEqual(cfvByKey(enrichData(stub.seen)), INTAKE, 'and the complete walk bound everything');
  });

  test('a walk that ENDS on the last page is a success, and is cached', async () => {
    // The narrowing assertion: without it, "return false on truncation" could pass
    // by returning false always, which would re-list on every booking forever.
    stub = stubAll({ cfList: [CF_ROWS.slice(0, 4), CF_ROWS.slice(4)] });
    await book();
    assert.equal(stub.seen.cfLists.length, 2);

    await book();
    assert.equal(stub.seen.cfLists.length, 2, 'a complete walk is cached');
  });

  test('the CustomFieldValue id is opaque: a composite string is echoed untouched', async () => {
    // Documented shape — "text_line-1", a composite including the field type — and
    // it must survive as-is. A Number() anywhere on this path turns it into NaN and
    // Clio gets an update addressed to nothing.
    stub = stubAll({
      contactFound: {
        id: CONTACT_ID,
        first_name: 'Jane', last_name: 'Caller',
        email_addresses: [{ address: 'jane.caller@example.com' }],
        phone_numbers: [{ id: 1, number: '(561) 555-0142' }],
        addresses: [{ id: 2, province: 'FL' }],
        custom_field_values: [
          { id: 'text_line-1', custom_field: { id: FIELD_ID.income_band } },
          // Displayed by default, never given a value: the documented NULL case.
          { id: null, custom_field: { id: FIELD_ID.net_worth_band } },
        ],
      },
      cfList: [CF_ROWS],
    });
    await book();

    const rows = enrichData(stub.seen).custom_field_values;
    const income = rows.find((r) => r.custom_field.id === FIELD_ID.income_band);
    assert.equal(income.id, 'text_line-1', 'echoed verbatim, never parsed');
    const netWorth = rows.find((r) => r.custom_field.id === FIELD_ID.net_worth_band);
    assert.equal('id' in netWorth, false, 'a NULL id means create, so no id is sent');
    assert.equal(JSON.stringify(rows).includes('NaN'), false);
    assert.equal(JSON.stringify(rows).includes('null'), false, 'and no null id is sent either');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// R2.6 / R3 — the leak wall, re-proved across every new path
// ─────────────────────────────────────────────────────────────────────────────
describe('nothing R2 or R3 touches puts a band anywhere it was not already', () => {
  // EVERY ENTRY MUST BE A FAILURE THE STUB ACTUALLY MODELS. R3 removed a
  // `{ cfCreateStatus: 500 }` from this list: it is not a parameter of stubAll, so
  // the object destructure ignored it and that iteration silently ran the DEFAULT
  // HAPPY PATH — a clean booking asserted against the leak wall, which passes
  // trivially and covered none of the failure paths the test claims to sweep. A
  // dead option here is worse than a missing one, because the loop still reports
  // four iterations. The replacement is the failure that option was reaching for
  // — a custom-field resolution that did not complete — spelled the way the stub
  // models it now that the definition-write path is gone.
  test('no band string reaches a log line, on any of the new failure paths', async () => {
    // Each entry carries the warn its failure is SUPPOSED to produce, asserted
    // before the leak wall. That is what makes the sweep non-vacuous: a booking
    // that quietly succeeded emits none of these, so an option that stops taking
    // effect fails here loudly instead of passing as a clean run.
    const cases = [
      [{ searchStatus: 500 }, 'contact search inconclusive'],
      [{ contactPatchStatus: 400, cfList: [CF_ROWS] }, 'contact enrichment not applied'],
      [{ cfListStatus: 500 }, 'custom field list failed'],
      [{ cfList: [CF_ROWS.map((r) => ({ ...r, field_type: 'picklist' }))] }, 'wrong type'],
      [{ searchBody: '{}' }, 'no result array'],
    ];

    for (const [opts, expectedWarn] of cases) {
      __resetIntakeFieldCache();
      stub?.restore();
      mute.restore();
      mute = muteConsole();
      stub = stubAll(opts);
      await book();

      assert.ok(
        mute.saw(expectedWarn),
        `the failure actually happened — expected "${expectedWarn}" for ${JSON.stringify(opts)}`,
      );
      for (const s of FORBIDDEN) {
        assert.equal(mute.saw(s), false, `must not reach a log line: ${s}`);
      }
      assert.equal(mute.saw('jane.caller@example.com'), false, 'nor the client’s email');
    }
  });

  test('the calendar entry is still band-free when the intake rides a PATCH', async () => {
    stub = stubAll({ cfList: [CF_ROWS] });
    await book();

    // The bands are on the contact…
    assert.deepEqual(cfvByKey(enrichData(stub.seen)), INTAKE);
    // …and nowhere in the body Clio emails.
    const emailed = JSON.stringify(entryData(stub.seen));
    for (const s of FORBIDDEN) {
      assert.equal(emailed.includes(s), false, `client-facing entry must not contain: ${s}`);
    }
  });
});
