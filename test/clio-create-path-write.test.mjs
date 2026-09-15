// ── ORDER SHELDON-INTAKE-CREATE-PATH-422-FIX-R3 · issue #153 ─────────────────
//
// PR 167 made the enrichment PATCH write the intake answers IN PLACE instead of
// appending a second copy, and it worked — on the reuse path. A live booking onto a
// contact Clio already held (Bob Barker) sent rows shaped
// `{id, value, custom_field{id}}` and Clio answered 200.
//
// A live booking onto a contact that did NOT exist yet (Charlie Chaplin) sent rows
// shaped `{value, custom_field{id}}` — no value id — and Clio answered 422. Same
// deploy, same seven fields, same qualifier join (`qualifier_join=attached
// source=kv call_id_present=yes` on the tail). The enrichment was BUILT and SENT
// with the answers present and REJECTED, so this was never a missing-data bug.
//
// ── WHERE THE TWO BRANCHES DIVERGE, IN ONE LINE ──────────────────────────────
//
// findOrCreateContact's create branch built the enrichment's `found` shim from the
// create BODY, and the create body carries no custom fields by design (the optional
// half moved to the PATCH after R2). So the shim carried a literal:
//
//     [CLIO_FIELDS.CONTACT_BODY_CUSTOM_FIELDS]: [],
//
// An empty array is an empty `existingValueIndex`, and an empty index is create form
// for every row. The reuse branch hands `existingValueIndex` the record the SEARCH
// returned, which carries `custom_field_values{id,value,field_name}` — so it finds
// the value ids and writes update form. Nothing else about the two paths differs at
// the point of the write: both end in the same updateContact call.
//
// A contact is not born empty. Clio materialises a CustomFieldValue row for every
// CustomField displayed by default, so the record that exists one moment after
// POST /contacts already carries a row per Intake field, with its own composite id.
// The create path could not see them because it never asked. This file is about the
// ask.
//
// ── THE CONFOUND, AND WHY TASK 1 EXISTS ──────────────────────────────────────
//
// Elroy is right that the live evidence moved two variables at once — channel
// (web vs voice) AND contact reuse (found vs created) — so "create form" is the
// leading cause, not a proven one. The competing hypothesis is a voice-relayed
// VALUE Clio refuses. The discriminator is the failure body: a 422 naming
// `custom_field_values` is the form; a 422 naming `addresses` or `state` is a value,
// and a different fix. §4 below is that discriminator, and its hard constraint is
// that the body which answers the question is the same body that echoes the client's
// finances back — so the line it prints is names and messages, never values.
//
// ── WHAT MAKES THE CLIO IN THIS FILE ABLE TO SEE THE DEFECT ──────────────────
//
// The stub distinguishes the two Clio endpoints that the existing suites' stubs
// route into one branch:
//
//   GET /contacts?query=…   the SEARCH   → a list. Empty here: nobody is held.
//   GET /contacts/{id}      the RECORD   → one object, carrying the default rows.
//
// A stub that answered the second with the first's empty list would make this whole
// file vacuous — the fix would read no rows and its output would be indistinguishable
// from the defect. See [[feedback_a_stub_more_generous_than_the_vendor_hides_the_defect]]
// for the inverse mistake, and §0 for the by-hand firing that keeps this one honest.
//
// It also keeps the vendor's other two refusals from clio-intake-write.test.mjs: a
// `fields=` selection is projected at EVERY level, and a second-level selector is an
// unconditional 400.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import {
  INTAKE_CUSTOM_FIELDS,
  __resetIntakeFieldCache,
} from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import { describeClioFailure } from '../donovan-legal-site/functions/booking/_lib/provider-clio.js';
import { parseSelection, selectionDepth, project } from './clio-intake-write.test.mjs';
import { stubFetch, muteConsole, makeKV, makeDurableObject } from './helpers/stubs.mjs';

const SITEVERIFY    = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES  = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS  = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES    = 'https://app.clio.com/api/v4/notes';

const NEW_CONTACT_ID = 2413664312;    // the shape of the live one, not the value
const CALL_ID        = 'call_createpath0001';
const MEETING_LINK   = 'https://meet.donovan.law/consult';

const FIELD_ID = Object.fromEntries(INTAKE_CUSTOM_FIELDS.map((f, i) => [f.key, 8300 + i]));

/** The exact strings fn/qualifier_submit's LABELS table renders. */
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

const BAND_INCOME    = INTAKE.income_band;
const BAND_NET_WORTH = INTAKE.net_worth_band;
const SUMMARY = [
  '— Perch intake —',
  `Matter: ${INTAKE.matter_category} → ${INTAKE.matter_sub}`,
  `State: ${STATE}`,
  `For: ${INTAKE.for_whom}`,
  `Income: ${BAND_INCOME}`,
  `Net worth: ${BAND_NET_WORTH}`,
  `Language: ${INTAKE.language} · Source: ${INTAKE.source}`,
].join('\n');

/**
 * The rows Clio has already materialised on a contact one moment after it was
 * created: displayed-by-default fields, each with its own composite value id and an
 * EMPTY value. `materialised:false` is the other documented state — displayed but
 * never given a value, id NULL — which is the case that must still write create form.
 */
function defaultRows({ materialised = true } = {}) {
  return INTAKE_CUSTOM_FIELDS.map((f, i) => ({
    id: materialised ? `text_line-${i + 1}` : null,
    value: '',
    field_name: f.name,
    custom_field: {},
  }));
}

const CF_ROWS = INTAKE_CUSTOM_FIELDS.map((f) => ({
  id: FIELD_ID[f.key], name: f.name, field_type: f.type,
}));

/**
 * @param {object} o
 * @param {boolean} o.materialised    do the fresh contact's rows carry value ids?
 * @param {number}  o.recordStatus    the status GET /contacts/{id} answers with.
 * @param {string?} o.recordBody      exact bytes for GET /contacts/{id}, when the
 *                                    shape rather than the status is the point.
 * @param {number}  o.patchStatus     the status the enrichment PATCH answers with.
 * @param {string?} o.patchBody       exact bytes for a failed PATCH — §4's 422.
 */
function stubClio({
  materialised = true,
  recordStatus = 200,
  recordBody = null,
  patchStatus = 200,
  patchBody = null,
} = {}) {
  const seen = {
    calls: [], searches: [], records: [], contacts: [], patches: [], entries: [], notes: [],
    selections: [], refused: [],
  };

  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    let sel = '';
    let origin = '';
    try {
      const parsed = new URL(u);
      sel = parsed.searchParams.get('fields') ?? '';
      origin = parsed.origin;
    } catch (_) { /* not a URL we parse */ }
    if (sel) seen.selections.push(sel);

    // The vendor's refusal: Clio's selector grammar has ONE level. Unconditional and
    // ahead of everything, so no selection can smuggle a second level past it.
    if (sel && selectionDepth(sel) > 1) {
      seen.refused.push(sel);
      return new Response('{"error":{"type":"ArgumentError"}}', { status: 400 });
    }

    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
    if (u.startsWith('https://app.clio.com/oauth/token')) {
      return new Response(JSON.stringify({ access_token: 'at' }));
    }

    if (u.startsWith(CLIO_ENTRIES) && method === 'GET') return new Response('{"data":[]}');
    if (u.startsWith(CLIO_ENTRIES) && method === 'POST') {
      seen.calls.push('entry:create');
      seen.entries.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 4981729099 } }));
    }

    if (u.startsWith(CLIO_CFIELDS) && method === 'GET') {
      seen.calls.push('cf:list');
      return new Response(JSON.stringify({
        data: CF_ROWS.map((r) => project(r, parseSelection(sel || 'id,name,field_type'))),
        meta: {},
      }));
    }

    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      seen.calls.push('contact:patch');
      seen.patches.push({ url: u, body: JSON.parse(init.body) });
      if (patchStatus !== 200) {
        return new Response(patchBody ?? '{}', { status: patchStatus });
      }
      return new Response(JSON.stringify({ data: { id: NEW_CONTACT_ID } }));
    }

    // ── THE TWO READS, TOLD APART ────────────────────────────────────────────
    // A single-record read is `/contacts/{id}` and answers with an OBJECT; the
    // search is `/contacts?query=` and answers with a LIST. Routing both into one
    // branch is what would make this file vacuous.
    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'GET') {
      seen.calls.push('contact:record');
      seen.records.push(u);
      if (recordBody !== null) return new Response(recordBody, { status: recordStatus });
      if (recordStatus !== 200) return new Response('{}', { status: recordStatus });
      const row = {
        id: NEW_CONTACT_ID,
        first_name: 'Charlie',
        last_name: 'Chaplin',
        email_addresses: [{ address: 'client@example.com' }],
        phone_numbers: [{ number: '(561) 555-0142' }],
        addresses: [],
        custom_field_values: defaultRows({ materialised }),
      };
      return new Response(JSON.stringify({ data: project(row, parseSelection(sel)) }));
    }

    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      seen.calls.push('contact:search');
      seen.searches.push(u);
      return new Response('{"data":[]}');    // Clio answered: it holds nobody.
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      seen.calls.push('contact:create');
      seen.contacts.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: NEW_CONTACT_ID } }));
    }

    if (u.startsWith(CLIO_NOTES) && method === 'POST') {
      seen.calls.push('note');
      seen.notes.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 77 } }));
    }
    // MATCHED ON THE ORIGIN, NOT ON A PREFIX. `startsWith("https://grow.clio.com")`
    // also matches `https://grow.clio.com.example.invalid`, which is a real
    // sanitisation defect wherever it decides something — and a stub that admits a
    // look-alike host is one that would quietly answer 200 to an egress this suite
    // exists to notice. See [[feedback_host_assertion_by_substring_passes_for_the_lookalike]].
    if (origin === 'https://grow.clio.com' || origin === 'https://vantage.ticoai.net') {
      return new Response('{"ok":true}');
    }
    throw new Error(`unstubbed fetch: ${method} ${u}`);
  });

  return { seen, restore: () => handle.restore() };
}

// ── Driving one booking ──────────────────────────────────────────────────────

function envFor(over = {}) {
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
const nextIp = () => `198.51.100.${(_ipSeq += 1) % 250}`;

function bridgeWithQualifier() {
  const ns = makeDurableObject();
  ns.instance('donovan').state.set(`qual:${CALL_ID}`, { status: 'complete' });
  return ns;
}

function kvWithQualifier(over = {}) {
  return makeKV({
    [`qualbk:${CALL_ID}`]: JSON.stringify({
      summary: SUMMARY, intake: INTAKE, state: STATE, matter: 'real_estate', ...over,
    }),
  });
}

/** A booking by someone Clio has never heard of — the create path, every time. */
async function book(over = {}) {
  return onRequestPost({
    request: new Request('https://www.donovan.law/booking/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() },
      body: JSON.stringify({
        type: 'consult',
        slot: SLOT,
        name: 'Charlie Chaplin',
        email: 'client@example.com',
        phone: '(561) 555-0142',
        call_id: CALL_ID,
        turnstile_token: 'good-token',
        ...over,
      }),
    }),
    env: envFor({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: bridgeWithQualifier() }),
  });
}

function patchedValues(seen, i = 0) {
  assert.ok(seen.patches.length > i, `an enrichment PATCH was issued (#${i + 1})`);
  const rows = seen.patches[i].body.data.custom_field_values;
  assert.ok(Array.isArray(rows), 'the PATCH carries a custom_field_values array');
  return rows;
}
const rowFor = (rows, key) => rows.find((r) => r.custom_field?.id === FIELD_ID[key]);

let stub, mute;
beforeEach(() => { __resetIntakeFieldCache(); mute = muteConsole(); });
afterEach(() => { stub?.restore(); mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// 0. THE STUB TELLS THE TWO ENDPOINTS APART — fired by hand, so it cannot go inert
// ─────────────────────────────────────────────────────────────────────────────
describe('the vendor model', () => {
  test('the record read answers an OBJECT and the search answers a LIST', async () => {
    stub = stubClio();
    const sel = encodeURIComponent('id,custom_field_values{id,value,field_name}');

    const record = await (await fetch(`${CLIO_CONTACTS}/${NEW_CONTACT_ID}?fields=${sel}`)).json();
    assert.equal(Array.isArray(record.data), false, 'a single record is not a list');
    assert.equal(record.data.id, NEW_CONTACT_ID);

    const search = await (await fetch(`${CLIO_CONTACTS}?query=x&fields=${sel}`)).json();
    assert.ok(Array.isArray(search.data), 'the search is a list');
    assert.equal(search.data.length, 0, 'and it holds nobody — this is the create path');

    assert.deepEqual(stub.seen.calls, ['contact:record', 'contact:search']);
  });

  test('a freshly created contact already carries a row per Intake field, WITH an id', async () => {
    // The premise the whole fix rests on. If Clio genuinely returned nothing here,
    // the create path would be writing create form correctly and this file would be
    // asserting the wrong thing — so the premise is stated as an assertion.
    stub = stubClio({ materialised: true });
    const sel = encodeURIComponent('id,custom_field_values{id,value,field_name}');
    const { data } = await (await fetch(`${CLIO_CONTACTS}/${NEW_CONTACT_ID}?fields=${sel}`)).json();

    assert.equal(data.custom_field_values.length, INTAKE_CUSTOM_FIELDS.length);
    for (const r of data.custom_field_values) {
      assert.ok(r.id, 'a materialised row carries its composite value id');
      assert.ok(r.field_name, 'and names the field it belongs to');
    }
  });

  test('a second-level selector is still a 400 on this endpoint too', async () => {
    stub = stubClio();
    const res = await fetch(`${CLIO_CONTACTS}/${NEW_CONTACT_ID}?fields=`
      + encodeURIComponent('id,custom_field_values{id,value,custom_field{id}}'));
    assert.equal(res.status, 400);
    assert.equal(stub.seen.refused.length, 1, 'the refusal is recorded, not silently absorbed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE RED ONE — a create-path booking must write UPDATE form
// ─────────────────────────────────────────────────────────────────────────────
describe('a booking by someone Clio has never held', () => {
  test('the create path re-reads the contact it just made', async () => {
    stub = stubClio();
    assert.equal((await book()).status, 201);

    assert.equal(stub.seen.contacts.length, 1, 'exactly one contact created');
    assert.equal(stub.seen.records.length, 1, 'and it was read back exactly once');
    assert.match(stub.seen.records[0], new RegExp(`/contacts/${NEW_CONTACT_ID}\\?`),
      'the read addresses the contact we just minted, by id');
  });

  test('the re-read asks for the SAME selection the search asks for', async () => {
    // One spelling of one selection. Two spellings is how a read and its reader
    // drift apart, which is the defect PR 167 closed on the other path.
    stub = stubClio();
    assert.equal((await book()).status, 201);

    const fields = decodeURIComponent(new URL(stub.seen.records[0]).searchParams.get('fields'));
    assert.match(fields, /custom_field_values\{[^}]*\bid\b[^}]*\}/);
    assert.match(fields, /custom_field_values\{[^}]*field_name[^}]*\}/,
      'a read that does not ask for field_name cannot attribute a single row');
    assert.equal(selectionDepth(fields), 1, 'and it stays inside the one level Clio has');
    assert.equal(stub.seen.refused.length, 0, 'no request was refused for its selection');
  });

  test('THE FIX: every row carries the value id already on the new contact', async () => {
    // RED ON MAIN. The create branch handed the enrichment a shim with a literal
    // `custom_field_values: []`, so existingValueIndex was empty and all seven went
    // out in CREATE form — `custom_field{id}` with no `id` — onto a contact that
    // already carried a materialised row for each. That is the shape Clio answered
    // 422 to, live, on a fresh contact, while answering 200 to the update form on a
    // reused one.
    stub = stubClio({ materialised: true });
    assert.equal((await book()).status, 201);

    const rows = patchedValues(stub.seen);
    assert.equal(rows.length, 7, 'one value per intake field');

    const idByName = new Map(defaultRows().map((r) => [r.field_name, r.id]));
    for (const f of INTAKE_CUSTOM_FIELDS) {
      const row = rowFor(rows, f.key);
      assert.ok(row, `${f.name} is on the PATCH`);
      assert.equal(row.value, INTAKE[f.key], `${f.name} carries the answer the caller gave`);
      assert.equal(
        row.id, idByName.get(f.name),
        `${f.name} must UPDATE the row the new contact already carries, not create a second`,
      );
    }
    assert.equal(rows.filter((r) => r.id != null).length, 7,
      'seven rows, seven value ids — an empty index writes zero of these');
  });

  test('and the create POST still carries nothing optional', async () => {
    // The R2 split is not weakened by any of this: the id the confirmation email
    // hangs off is still earned by a body that cannot be refused for an optional
    // field. See [[project_sheldon_clio_confirm_email]].
    stub = stubClio();
    assert.equal((await book()).status, 201);

    const created = stub.seen.contacts[0].data;
    assert.equal('custom_field_values' in created, false);
    assert.equal('addresses' in created, false);
  });

  test('the booking still completes, with the attendee, the email and the note', async () => {
    stub = stubClio();
    assert.equal((await book()).status, 201);

    const entry = stub.seen.entries[0].data;
    assert.deepEqual(entry.attendees, [{ id: NEW_CONTACT_ID, type: 'Contact' }, { id: 9084638, type: 'Calendar' }]);
    assert.equal(entry.send_email_notification, true);
    assert.equal(stub.seen.notes.length, 1, 'and the intake note is still filed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE OTHER HALF OF CLIO'S RULE, AND THE DEGRADE
// ─────────────────────────────────────────────────────────────────────────────
describe('create form is still written where the contract says it belongs', () => {
  test('a row with a NULL id is created, not faked', async () => {
    // "The `id` may be NULL when the CustomField is displayed by default but has not
    // yet been given a value… If the `id` is NULL, you must provide `custom_field{id}`
    // to create the CustomFieldValue." A fix that invented an id here would be a new
    // defect wearing this one's clothes.
    stub = stubClio({ materialised: false });
    assert.equal((await book()).status, 201);

    const rows = patchedValues(stub.seen);
    assert.equal(rows.length, 7);
    for (const r of rows) assert.equal('id' in r, false, 'create form, exactly as documented');
  });

  for (const [label, opts, warn] of [
    ['the re-read 404s',            { recordStatus: 404 },              'HTTP 404'],
    ['the body is not JSON',        { recordBody: 'not json' },         'unreadable body'],
    ['the body carries no record',  { recordBody: '{"data":null}' },    'no record in the body'],
    ['the body is a LIST',          { recordBody: '{"data":[]}' },      'no record in the body'],
  ]) {
    test(`${label} — the booking survives and the rows fall back to create form`, async () => {
      // The degrade is exactly today's behaviour, and it SAYS SO. "The re-read did
      // not happen" and "the contact genuinely has no rows" produce identical PATCH
      // bodies, so they must not produce identical logs.
      // See [[feedback_the_read_after_the_write_must_not_fail_closed]].
      stub = stubClio(opts);
      assert.equal((await book()).status, 201, 'a failed re-read may not cost a booking');

      const rows = patchedValues(stub.seen);
      assert.equal(rows.length, 7, 'the seven still go');
      for (const r of rows) assert.equal('id' in r, false);

      assert.ok(mute.saw('created contact not re-read'), 'the degrade is named');
      assert.ok(mute.saw(warn), `and it names its own cause: ${warn}`);
      const entry = stub.seen.entries[0].data;
      assert.deepEqual(entry.attendees, [{ id: NEW_CONTACT_ID, type: 'Contact' }, { id: 9084638, type: 'Calendar' }]);
    });
  }

  test('a `{"data":[]}` list is REFUSED rather than read as an empty record', async () => {
    // A list is a different endpoint's answer. Reading one as a record indexes
    // nothing while looking like a success — the silent version of the 404 above.
    stub = stubClio({ recordBody: '{"data":[]}' });
    await book();
    assert.ok(mute.saw('no record in the body'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE LEAK INVARIANT, ON THE CREATE PATH, NON-VACUOUSLY
// ─────────────────────────────────────────────────────────────────────────────
describe('the bands reach the new contact and no client-facing surface', () => {
  test('both bands are on the PATCH and the note, and on none of the three surfaces', async () => {
    stub = stubClio();
    assert.equal((await book()).status, 201);

    // NON-VACUOUS ARM #1 — there is something to search for.
    assert.ok(BAND_INCOME.length > 3 && BAND_NET_WORTH.length > 3);
    assert.notEqual(BAND_INCOME, BAND_NET_WORTH);

    // NON-VACUOUS ARM #2 — the strings DID reach the two attorney-side surfaces.
    const rows = patchedValues(stub.seen);
    assert.equal(rowFor(rows, 'income_band').value, BAND_INCOME);
    assert.equal(rowFor(rows, 'net_worth_band').value, BAND_NET_WORTH);

    const noteText = JSON.stringify(stub.seen.notes[0].data);
    assert.ok(noteText.includes(BAND_INCOME), 'the income band is on the back-office note');
    assert.ok(noteText.includes(BAND_NET_WORTH), 'the net-worth band is on the back-office note');

    // THE INVARIANT — the three surfaces Clio renders into the client's email.
    const entry = stub.seen.entries[0].data;
    for (const surface of ['description', 'summary', 'location']) {
      const text = String(entry[surface] ?? '');
      for (const band of [BAND_INCOME, BAND_NET_WORTH, 'Income:', 'Net worth:', '— Perch intake —']) {
        assert.equal(text.includes(band), false,
          `the calendar entry ${surface} is emailed verbatim to the client — ${band} must not be in it`);
      }
    }
    const entryText = JSON.stringify(entry);
    assert.equal(entryText.includes(BAND_INCOME), false);
    assert.equal(entryText.includes(BAND_NET_WORTH), false);
  });

  test('and the re-read itself carried no client data into the request', async () => {
    // The one new outbound request this ticket adds. It is a GET addressed by id
    // with a `fields=` selection — there is no body and no query term, so there is
    // nothing on it to leak.
    stub = stubClio();
    await book();

    const url = stub.seen.records[0];
    for (const s of [BAND_INCOME, BAND_NET_WORTH, 'client@example.com', 'Chaplin', 'Real estate']) {
      assert.equal(decodeURIComponent(url).includes(s), false, `the re-read URL must not carry ${s}`);
    }
  });

  test('no band reaches a log line on any create-path failure', async () => {
    const FORBIDDEN = [BAND_INCOME, BAND_NET_WORTH, INTAKE.matter_category, 'client@example.com'];
    const cases = [
      [{ recordStatus: 500 }, 'created contact not re-read'],
      [{ patchStatus: 422, patchBody: JSON.stringify({
        error: { type: 'RecordNotSaved', message: 'is invalid' },
        data: { custom_field_values: [{ value: BAND_INCOME }] },
      }) }, 'contact enrichment not applied'],
    ];

    for (const [opts, expected] of cases) {
      __resetIntakeFieldCache();
      stub?.restore();
      mute.restore();
      mute = muteConsole();
      stub = stubClio(opts);
      await book();

      assert.ok(mute.saw(expected), `the failure actually happened — expected "${expected}"`);
      for (const s of FORBIDDEN) {
        assert.equal(mute.saw(s), false, `must not reach a log line: ${s}`);
      }
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. ELROY'S DISCRIMINATOR — the failure body names the field, never the value
// ─────────────────────────────────────────────────────────────────────────────
describe('a non-2xx write says which field Clio refused', () => {
  test('a 422 naming custom_field_values says so, on the wire, from a booking', async () => {
    // THIS IS THE LINE THAT ENDS THE INVESTIGATION. A 422 that names
    // `custom_field_values` is the FORM; a 422 that names `addresses` or `state` is a
    // VALUE, and a different fix. Before this, both printed `HTTP 422` and nothing.
    stub = stubClio({
      patchStatus: 422,
      patchBody: JSON.stringify({
        error: {
          type: 'RecordNotSaved',
          message: 'Contact failed to save',
          data: { custom_field_values: ['is invalid'] },
        },
      }),
    });
    assert.equal((await book()).status, 201, 'a rejected enrichment still books');

    const line = mute.lines.map(([, m]) => m).find((m) => m.includes('enrichment not applied'));
    assert.ok(line, 'the failure is logged');
    assert.match(line, /HTTP 422/);
    assert.match(line, /clio_fields=[^ ]*custom_field_values/,
      'the rejected field is named — this is the discriminator');
    assert.match(line, /clio_messages=.*is invalid/);
  });

  test('a 422 naming a VALUE field is told apart from one naming the form', async () => {
    // The STOP condition, made visible in a test rather than left to a live run: if
    // the next 422 names `addresses` or `province`, the create form was not the
    // cause and this ticket's fix is not the fix.
    const line = describeClioFailure(JSON.stringify({
      error: { type: 'ArgumentError', data: { addresses: { province: ['is not valid'] } } },
    }), { data: { addresses: [{ name: 'Home', province: 'FL' }] } });

    assert.match(line, /clio_fields=[^ ]*addresses/);
    assert.match(line, /clio_fields=[^ ]*province/);
    assert.equal(/custom_field_values/.test(line), false, 'and it does NOT name the form');
  });

  test('THE LEAK TEST: a 422 body carrying the values prints none of them', async () => {
    // Every way a value can arrive in an error body, in one payload: echoed as a
    // `value` leaf, echoed inside an error MESSAGE, and standing as a KEY.
    const sent = {
      data: {
        custom_field_values: [
          { id: 'text_line-4', value: BAND_INCOME,    custom_field: { id: 8303 } },
          { id: 'text_line-5', value: BAND_NET_WORTH, custom_field: { id: 8304 } },
          { id: 'text_line-1', value: INTAKE.matter_category, custom_field: { id: 8300 } },
        ],
        addresses: [{ name: 'Home', province: STATE }],
        phone_numbers: [{ number: '(561) 555-0142', name: 'Mobile' }],
      },
    };
    const body = JSON.stringify({
      error: {
        type: 'RecordNotSaved',
        message: `Value ${BAND_INCOME} is not acceptable for Intake Income Band`,
        data: {
          custom_field_values: [
            { value: BAND_INCOME, message: `${INTAKE.matter_category} is invalid` },
            { value: BAND_NET_WORTH },
          ],
          addresses: [{ province: STATE, base: 'is invalid' }],
          phone_numbers: [{ number: '(561) 555-0142' }],
        },
      },
      [BAND_NET_WORTH]: 'a value standing in a key position',
    });

    const line = describeClioFailure(body, sent);

    for (const s of [
      BAND_INCOME, BAND_NET_WORTH, INTAKE.matter_category, '(561) 555-0142', '561', '$',
    ]) {
      assert.equal(line.includes(s), false, `the diagnostic must not carry ${s}`);
    }
    // NON-VACUOUS: it did not go quiet, it went careful. The names are there, the
    // unprintable key is COUNTED, and the message that echoed a value is REDACTED
    // rather than dropped without trace.
    assert.match(line, /clio_fields=[^ ]*custom_field_values/);
    assert.match(line, /clio_fields=[^ ]*addresses/);
    assert.match(line, /clio_unnamed_keys=[1-9]/, 'the value-as-key was counted, not printed');
    assert.match(line, /clio_redacted=[1-9]/, 'the value-bearing message was refused, and said so');
    assert.match(line, /clio_messages=.*is invalid/, 'and the clean message still got through');
  });

  test('the redaction is not a blanket mute — a clean body prints its message', () => {
    // The narrowing test. A describer that refused everything would pass the leak
    // assertion above while answering none of Elroy's question.
    const line = describeClioFailure(
      '{"error":{"type":"RecordNotSaved","message":"Contact failed to save"}}',
      { data: { custom_field_values: [{ value: BAND_INCOME }] } },
    );
    assert.match(line, /clio_messages=.*Contact failed to save/);
    assert.match(line, /clio_fields=[^ ]*error/);
  });

  test('a value with no digit in it is caught by the sent-value filter', () => {
    // Filter 2 (shape) passes "Real estate is invalid" — there is no digit, no `$`
    // and no `@` in it. Filter 3 is what catches it. Both filters are load-bearing
    // and this is the test that proves the second one is.
    const line = describeClioFailure(
      '{"error":{"message":"Real estate is invalid"}}',
      { data: { custom_field_values: [{ value: 'Real estate' }] } },
    );
    assert.equal(line.includes('Real estate'), false);
    assert.match(line, /clio_redacted=1/);
  });

  test('an unparseable body is described, never printed', () => {
    const line = describeClioFailure(`<html>${BAND_INCOME}</html>`, {});
    assert.equal(line.includes(BAND_INCOME), false);
    assert.equal(line, 'clio_body=unparseable');
    assert.equal(describeClioFailure('', {}), 'clio_body=empty');
  });

  test('the intake note gets the same treatment — it carries the densest body of all', async () => {
    // The note detail is the whole qualifier block. Its failure used to be silent.
    stub = stubClio();
    const orig = globalThis.fetch;
    globalThis.fetch = async (u, i) => (
      String(u).startsWith(CLIO_NOTES) && i?.method === 'POST'
        ? new Response(JSON.stringify({ error: { message: 'is invalid', data: { detail: [BAND_INCOME] } } }),
                       { status: 422 })
        : orig(u, i)
    );
    try {
      assert.equal((await book()).status, 201, 'a rejected note still books');
    } finally {
      globalThis.fetch = orig;
    }

    const line = mute.lines.map(([, m]) => m).find((m) => m.includes('intake note not written'));
    assert.ok(line, 'the note failure is no longer silent');
    assert.match(line, /HTTP 422/);
    assert.match(line, /clio_fields=[^ ]*detail/, 'it names the field');
    assert.equal(line.includes(BAND_INCOME), false, 'and carries none of the detail');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE APPLIED-CHECK — the fix is in the SHIPPED source, not only in this file
// ─────────────────────────────────────────────────────────────────────────────
describe('the fix is applied to the shipping adapter', () => {
  // provider-clio.js as it stood at c7703c1 — the commit the 422 was observed on —
  // LF-normalised, because this worktree checks out CRLF and the blob is LF.
  // See [[feedback_git_show_lf_vs_worktree_crlf]].
  const PRE_FIX_SHA =
    '615ad600125d6a83cbeeb0083d269ca3d0e1254455814e574a3ac0d771adec3d';
  const PROVIDER = new URL(
    '../donovan-legal-site/functions/booking/_lib/provider-clio.js', import.meta.url,
  );
  const source = () => readFileSync(PROVIDER, 'utf8').replace(/\r\n/g, '\n');

  test('the adapter differs from the source that shipped the 422', () => {
    const sha = createHash('sha256').update(source(), 'utf8').digest('hex');
    assert.notEqual(sha, PRE_FIX_SHA,
      'the shipping adapter is byte-identical to c7703c1 — the fix was not applied');
  });

  test('the create branch no longer asserts an empty custom-field set', () => {
    const src = source();
    assert.match(src, /readContactAfterCreate/, 'the re-read exists');
    assert.match(src, /const created = await readContactAfterCreate\(cfg, env, newId\)/,
      'and the create branch calls it before the enrichment');
    assert.equal(
      /CONTACT_BODY_CUSTOM_FIELDS\]: \[\],\n {2}\}, contact, \{ addresses/.test(src), false,
      'the literal empty-array shim is gone from the create branch',
    );
  });

  test('the re-read is built from the search selection, not a second spelling', () => {
    assert.match(source(), /CALENDAR_ENTRIES_FIELDS_PARAM\]: CONTACT_SEARCH_FIELDS_ENRICHED/);
  });

  test('the reuse path is untouched — it still enriches from the search record', () => {
    const src = source();
    // The call now spans lines (it carries `webSitesReadable` — see
    // SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE), so the anchor tolerates the wrap.
    // What it still pins is the load-bearing half and the only half this test was
    // ever about: the found branch passes `found` — the record the SEARCH returned —
    // and not a shim built from anything we sent.
    assert.match(src, /if \(found\?\.id\) \{[\s\S]{0,400}?await enrich\(cfg, env, found, contact, \{/,
      'the found branch still hands updateContact the record the search returned');
  });

  test('both failed writes read their body through the describer', () => {
    const src = source();
    assert.match(src, /contact enrichment not applied: HTTP \$\{res\.status\} `\n\s*\+ `\$\{await failureDetail/);
    // THE NOTE ANCHOR MOVED, AND WHAT IT GUARDS GOT STRONGER, NOT WEAKER.
    // SHELDON-CONTACT-ROUTE-R1 (#214) extracted the note POST out of writeIntakeNote
    // into postContactNote, so the booking intake note and the website-inquiry note
    // share one sender. The literal that used to be here — `intake note not written`
    // — became `${label} not written`, where `label` is the caller's name for the
    // note. The invariant this test is about is unchanged: a rejected note body is
    // read by failureDetail and by nothing else. Since there is now exactly ONE
    // place a note is posted from, a second note path cannot acquire an
    // undescribed failure branch — which is more than the old anchor could say.
    assert.match(src, /\$\{label\} not written: HTTP \$\{res\.status\} `\n\s*\+ `\$\{await failureDetail/);
    // And that there is genuinely only one, so the anchor above is not guarding a
    // sender the inquiry path quietly stopped using.
    assert.equal((src.match(/`\$\{CLIO_BASE\}\/notes`/g) || []).length, 1,
      'exactly one POST /notes in the adapter — both note callers must share it');
  });

  test('buildClientDescription is not on this ticket', () => {
    const lines = source().split('\n');
    const start = lines.findIndex((l) => l.startsWith('export function buildClientDescription'));
    assert.ok(start >= 0);
    const end = lines.findIndex((l, i) => i > start && l === '}');
    const span = `${lines.slice(start, end + 1).join('\n').trim()}\n`;
    assert.equal(
      createHash('sha256').update(span).digest('hex'),
      'de5fcb4fff0ce318d15f50f6685acd7cbffb0db2ec3b5b30f28bb995433aef0b',
      'this ticket may not alter buildClientDescription',
    );
  });
});
