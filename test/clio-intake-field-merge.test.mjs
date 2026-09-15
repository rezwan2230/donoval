// ── ORDER SHELDON-INTAKE-FIELD-MERGE-POLICY-R1 · issue #153 ──────────────────
//
// A returning contact whose SECOND booking supplied fewer intake answers than the
// first ended up displaying a blend of two sessions that no single booking ever
// produced. Proven on a live contact:
//
//   booking 1 — Matter Category: Real estate · Sub-Type: Ownership · Source: utility_bar
//   booking 2 — Matter Category: Other       · (no sub-type)       · (no source)
//   the contact now reads
//               Matter Category: Other       · Sub-Type: Ownership · Source: utility_bar
//
// `Other` HAS NO SUB-TYPES. The qualifier's own LABELS table (fn/qualifier_submit.js)
// lists matter_sub as the tax_* and re_* options only, so `Other` beside `Ownership`
// is not merely stale — it is a pair the product cannot produce, sitting on a client
// record as though a human had entered it.
//
// ── WHY IT HAPPENED ──────────────────────────────────────────────────────────
// `buildCustomFieldValues` skipped any field with no value (`if (!value) continue`).
// A skipped field is a field left out of the PATCH array, and contract note 1 in
// provider-clio.js is explicit that an existing member left out of the array is
// UNTOUCHED. So the write could set a field and could add one, and had no way at all
// to say "this answer is no longer true" — the first booking's sub-type outlived the
// matter it belonged to, permanently.
//
// ── WHY THE FIX IS NOT "CLEAR EVERYTHING UNSUPPLIED" ─────────────────────────
// That would be the opposite defect, and a worse one. `Intake Language` and
// `Intake Source` are facts about the CLIENT: a booking that does not re-ask what
// language someone speaks is not evidence that the answer changed, and wiping their
// standing answers because a later form was shorter deletes real data. The fields
// split into two classes that fail in opposite directions, the split is declared per
// field in clio-custom-fields.js, and this file is the proof that each class gets its
// own behaviour.
//
// ── WHAT THIS SUITE ASSERTS ON, AND WHY IT IS THE CONTACT ────────────────────
// The subject of the complaint is not a request body — it is WHAT THE LAWYER READS.
// So the Clio here holds a contact whose custom_field_values are MUTATED by each
// PATCH, both bookings are driven through `booking/create.js` for real, and the
// assertions read the contact afterwards. The vendor also REFUSES the way the live
// one does: a create-form row onto an already-materialised field is a 422 (the one
// PR #170 closed), so "every write, including a cleared field, stays in UPDATE form"
// is a claim this vendor can RED rather than one asserted about a body we also wrote.
// See test/helpers/clio-vendor.mjs.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import {
  INTAKE_CUSTOM_FIELDS,
  BOOKING_CUSTOM_FIELDS,
  POSTCALL_CUSTOM_FIELDS,
  MATTER_SCOPED_KEYS,
  PERSON_SCOPED_KEYS,
  MATTER_CONTEXT_KEY,
  FIELD_SCOPE,
  __resetIntakeFieldCache,
} from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import { writePostCallFields } from '../donovan-legal-site/functions/booking/_lib/provider-clio.js';
import { resolveConfig } from '../donovan-legal-site/functions/booking/_lib/config.js';
import {
  parseSelection, selectionDepth, project, applyCustomFieldValues,
} from './helpers/clio-vendor.mjs';
import { stubFetch, muteConsole, makeKV, makeDurableObject } from './helpers/stubs.mjs';

const SITEVERIFY    = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES  = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS  = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES    = 'https://app.clio.com/api/v4/notes';

const CONTACT_ID   = 2413234643;
const MEETING_LINK = 'https://meet.donovan.law/consult';

/** The eight the booking path writes: the seven self-reported plus the consult type. */
const BOOKING_PATH_FIELDS = [...INTAKE_CUSTOM_FIELDS, ...BOOKING_CUSTOM_FIELDS];
const ALL_FIELDS = [...BOOKING_PATH_FIELDS, ...POSTCALL_CUSTOM_FIELDS];

const FIELD_ID = Object.fromEntries(ALL_FIELDS.map((f, i) => [f.key, 8100 + i]));
const NAME_BY_FIELD_ID = new Map(ALL_FIELDS.map((f) => [FIELD_ID[f.key], f.name]));
const NAME_BY_KEY = new Map(ALL_FIELDS.map((f) => [f.key, f.name]));

// The appointment type `type: 'consult'` resolves to, from the firm's own config —
// read rather than spelled, so a config rename cannot make this suite assert a name
// the booking no longer writes.
const CONSULT_NAME = resolveConfig(envFor()).config.appointment_types
  .find((t) => t.id === 'consult').name;

// ── The two sessions from the report, in the qualifier's own label spelling ───
//
// Taken from fn/qualifier_submit.js LABELS, not invented: `real_estate` renders as
// "Real estate", `ownership` as "Ownership", `other` as "Other", `business` as
// "Business / company", `above_3m` as "Above $3M", `above_15m` as "Above $15M".
// `source` has no LABELS entry and rides verbatim, which is why it is a bare token.
const BOOKING_1 = {
  matter_category: 'Real estate',
  matter_sub:      'Ownership',
  source:          'utility_bar',
};

const BOOKING_2 = {
  matter_category: 'Other',
  for_whom:        'Business / company',
  income_band:     'Above $3M',
  net_worth_band:  'Above $15M',
  // no matter_sub — the whole point
  // no source     — the other whole point
};

// ── The contact, which this vendor actually holds ────────────────────────────

/**
 * A contact whose eight booking-path fields are DISPLAYED BY DEFAULT and unset:
 * a real CustomFieldValue id and an empty value on every row. That is the live shape
 * the contract notes describe ("the `id` may be NULL when the CustomField is
 * displayed by default but has not yet been given a value" is the OTHER shape, and
 * `materialised: false` produces it).
 */
function seedContact({ materialised = true } = {}) {
  return {
    id: CONTACT_ID,
    first_name: 'David',
    last_name: 'Pierce',
    email_addresses: [{ address: 'client@example.com' }],
    phone_numbers: [{ id: 1, number: '(561) 555-0142' }],
    addresses: [{ id: 2, province: 'FL' }],
    web_sites: [{ address: 'https://www.donovan.law/' }],
    custom_field_values: BOOKING_PATH_FIELDS.map((f, i) => ({
      id: materialised ? `text_line-${i + 1}` : null,
      value: '',
      field_name: f.name,
      custom_field: {},
    })),
  };
}

/** What the lawyer reads: field key → the value the contact currently holds. */
function contactReads(state) {
  const byName = new Map(state.custom_field_values.map((r) => [r.field_name, r.value]));
  return Object.fromEntries(
    BOOKING_PATH_FIELDS.map((f) => [f.key, byName.get(f.name) ?? undefined]),
  );
}

function stubClio({ contact, cfFields = BOOKING_PATH_FIELDS, contactFound = true } = {}) {
  const seen = {
    patches: [], searches: [], notes: [], selections: [], refused: [], rejected: [],
  };

  const cfRows = cfFields.map((f) => ({
    id: FIELD_ID[f.key], name: f.name, field_type: f.type,
  }));

  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    let sel = '';
    try { sel = new URL(u).searchParams.get('fields') ?? ''; } catch (_) { /* not a URL we parse */ }
    if (sel) seen.selections.push(sel);

    // Clio's selector grammar has ONE level. Unconditional and ahead of everything.
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
      return new Response(JSON.stringify({ data: { id: 4981729058 } }));
    }

    if (u.startsWith(CLIO_CFIELDS) && method === 'GET') {
      return new Response(JSON.stringify({
        data: cfRows.map((r) => project(r, parseSelection(sel || 'id,name,field_type'))),
        meta: {},
      }));
    }

    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      const body = JSON.parse(init.body);
      seen.patches.push({ url: u, body });
      // THE VENDOR DECIDES. A create-form row onto a materialised field is refused
      // here exactly as the live grant refuses it, so this suite cannot pass by
      // sending a body the real Clio would have thrown out.
      const applied = applyCustomFieldValues(
        contact, body?.data?.custom_field_values, NAME_BY_FIELD_ID,
      );
      if (!applied.ok) {
        seen.rejected.push(applied.field);
        return new Response(
          JSON.stringify({ error: { type: 'ArgumentError', message: applied.field } }),
          { status: 422 },
        );
      }
      return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
    }

    // The re-read the post-call writer does, and the create path's re-read.
    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'GET') {
      return new Response(JSON.stringify({ data: project(contact, parseSelection(sel)) }));
    }

    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      seen.searches.push(u);
      if (!contactFound) return new Response('{"data":[]}');
      return new Response(JSON.stringify({ data: [project(contact, parseSelection(sel))] }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
    }

    if (u.startsWith(CLIO_NOTES) && method === 'POST') {
      seen.notes.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 77 } }));
    }
    if (u.startsWith('https://grow.clio.com') || u.startsWith('https://vantage.ticoai.net')) {
      return new Response('{"ok":true}');
    }
    throw new Error(`unstubbed fetch: ${method} ${u}`);
  });

  return { seen, restore: () => handle.restore() };
}

// ── Driving a booking ────────────────────────────────────────────────────────

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

function futureMondaySlot(weeksOut) {
  const d = new Date(Date.now() + weeksOut * 7 * 86400_000);
  d.setUTCHours(14, 0, 0, 0);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

let _ipSeq = 0;
const nextIp = () => `198.51.100.${(_ipSeq += 1) % 250}`;

/**
 * The prose block fn/qualifier_submit.js renders onto the stored record, in the same
 * shape — the session's answers, spelled out, one session per note.
 *
 * It matters that this carries the SUB-TYPE and the SOURCE: the justification for
 * emptying a custom field is that nothing is lost, because the append-only note keeps
 * each session verbatim. A summary that never mentioned the cleared answer would make
 * that claim untestable, and the suite would be proving it against its own omission.
 */
function perchSummary(intake) {
  return [
    '— Perch intake —',
    `Matter: ${intake.matter_category ?? '(none)'}`
      + (intake.matter_sub ? ` → ${intake.matter_sub}` : ''),
    'State: FL',
    intake.for_whom ? `For: ${intake.for_whom}` : '',
    intake.income_band ? `Income: ${intake.income_band}` : '',
    intake.net_worth_band ? `Net worth: ${intake.net_worth_band}` : '',
    `Language: ${intake.language ?? '—'} · Source: ${intake.source ?? '—'}`,
  ].filter(Boolean).join('\n');
}

/**
 * One booking by a returning client, through the real handler.
 *
 * Each booking gets its own call id and its own stored qualifier record, which is
 * what a returning client actually produces — a second session, not an edit of the
 * first. The email is the same on both, so the contact is REUSED, which is the path
 * the defect lives on.
 */
async function book(intake, { weeksOut = 1, callId } = {}) {
  const id = callId ?? `call_merge${weeksOut}`;
  const ns = makeDurableObject();
  ns.instance('donovan').state.set(`qual:${id}`, { status: 'complete' });

  const kv = makeKV({
    [`qualbk:${id}`]: JSON.stringify({
      summary: perchSummary(intake),
      intake,
      state: 'FL',
      matter: 'real_estate',
    }),
  });

  return onRequestPost({
    request: new Request('https://www.donovan.law/booking/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() },
      body: JSON.stringify({
        type: 'consult',
        slot: futureMondaySlot(weeksOut),
        name: 'David Pierce',
        email: 'client@example.com',
        phone: '(561) 555-0142',
        call_id: id,
        turnstile_token: 'good-token',
      }),
    }),
    env: envFor({ PERCH_ACTIONS: kv, PERCH_BRIDGE: ns }),
  });
}

/** The custom_field_values off one enrichment PATCH, with a count so "no write" cannot pass. */
function patchedValues(seen, i) {
  assert.ok(seen.patches.length > i, `an enrichment PATCH was issued (#${i + 1})`);
  const rows = seen.patches[i].body.data.custom_field_values;
  assert.ok(Array.isArray(rows), `PATCH #${i + 1} carries a custom_field_values array`);
  return rows;
}
const rowFor = (rows, key) => rows.find((r) => r.custom_field?.id === FIELD_ID[key]);

let stub, mute;
beforeEach(() => { __resetIntakeFieldCache(); mute = muteConsole(); });
afterEach(() => { stub?.restore(); mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// 0. THE VENDOR MODEL — fired by hand, so no assertion below can be vacuous
// ─────────────────────────────────────────────────────────────────────────────
describe('the vendor model refuses what the live grant refuses', () => {
  test('a create-form row onto a materialised field is a 422 — the one PR #170 closed', () => {
    const contact = seedContact();
    contact.custom_field_values[0].value = 'Real estate';
    const got = applyCustomFieldValues(
      contact,
      [{ value: 'Other', custom_field: { id: FIELD_ID.matter_category } }],  // no id
      NAME_BY_FIELD_ID,
    );
    assert.equal(got.ok, false, 'the vendor refuses the create form onto a live row');
    assert.equal(got.field, 'custom_field_values');
    assert.equal(contact.custom_field_values[0].value, 'Real estate',
      'and a refused PATCH changes nothing — no half-applied state');
  });

  test('an update-form row carrying the held id is applied in place', () => {
    const contact = seedContact();
    const held = contact.custom_field_values[0].id;
    const got = applyCustomFieldValues(
      contact,
      [{ id: held, value: 'Other', custom_field: { id: FIELD_ID.matter_category } }],
      NAME_BY_FIELD_ID,
    );
    assert.equal(got.ok, true);
    assert.equal(contact.custom_field_values.length, BOOKING_PATH_FIELDS.length,
      'updated in place — not a second row beside the first');
    assert.equal(contact.custom_field_values[0].value, 'Other');
  });

  test('an id this contact does not hold is refused, so a carried-over id cannot pass', () => {
    const contact = seedContact();
    const got = applyCustomFieldValues(
      contact, [{ id: 'text_line-999', value: 'x', custom_field: { id: FIELD_ID.matter_sub } }],
      NAME_BY_FIELD_ID,
    );
    assert.equal(got.ok, false);
  });

  test('a plain custom_field_values selection names no field — the live stinginess', () => {
    const got = project(seedContact(), parseSelection('id,custom_field_values'));
    for (const r of got.custom_field_values) {
      assert.equal('field_name' in r, false);
      assert.equal('custom_field' in r, false);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE FIELD CLASSES — task 1
// ─────────────────────────────────────────────────────────────────────────────
describe('the intake fields are classified by what the answer is about', () => {
  test('the matter-scoped set is exactly the four that describe an engagement', () => {
    assert.deepEqual(
      [...MATTER_SCOPED_KEYS].sort(),
      ['consult_type', 'for_whom', 'matter_category', 'matter_sub'].sort(),
    );
  });

  test('the person-scoped set is exactly the four that describe the client', () => {
    assert.deepEqual(
      [...PERSON_SCOPED_KEYS].sort(),
      ['income_band', 'language', 'net_worth_band', 'source'].sort(),
    );
  });

  test('every booking-path field is classified — the classification is TOTAL', () => {
    // The guard against a field being added upstairs and silently landing in
    // neither class. Unclassified degrades to "never cleared", which is the safe
    // side, but it is still a decision nobody made.
    for (const f of BOOKING_PATH_FIELDS) {
      assert.ok(
        f.scope === FIELD_SCOPE.MATTER || f.scope === FIELD_SCOPE.PERSON,
        `${f.name} must declare a scope`,
      );
      assert.equal(
        MATTER_SCOPED_KEYS.has(f.key) !== PERSON_SCOPED_KEYS.has(f.key), true,
        `${f.name} belongs to exactly one class`,
      );
    }
    assert.equal(MATTER_SCOPED_KEYS.size + PERSON_SCOPED_KEYS.size, BOOKING_PATH_FIELDS.length);
  });

  test('the four post-call fields are in NEITHER class — this policy does not reach them', () => {
    for (const f of POSTCALL_CUSTOM_FIELDS) {
      assert.equal(MATTER_SCOPED_KEYS.has(f.key), false, `${f.name} is not matter-scoped`);
      assert.equal(PERSON_SCOPED_KEYS.has(f.key), false, `${f.name} is not person-scoped`);
    }
  });

  test('the matter context key is the parent of the matter set', () => {
    assert.equal(MATTER_SCOPED_KEYS.has(MATTER_CONTEXT_KEY), true);
    assert.equal(MATTER_CONTEXT_KEY, 'matter_category');
  });

  test('classifying a field did NOT make it admissible off a stored qualifier record', async () => {
    // The split BOOKING_CUSTOM_FIELDS exists to protect: `consult_type` is
    // matter-scoped, and it must still be impossible for a stored qualifier record
    // to supply one. Scope is a merge rule, never a capability grant.
    const { SELF_REPORTED_KEYS } = await import(
      '../donovan-legal-site/functions/booking/_lib/intake-policy.js'
    );
    assert.equal(SELF_REPORTED_KEYS.includes('consult_type'), false,
      'consult_type is matter-scoped AND still not self-reportable');
    assert.deepEqual([...SELF_REPORTED_KEYS].sort(), INTAKE_CUSTOM_FIELDS.map((f) => f.key).sort());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE REPORTED BLEND — task 5, the red one
// ─────────────────────────────────────────────────────────────────────────────
describe('the second booking of a returning contact', () => {
  test('THE BLEND: Other never inherits the first booking\'s Ownership', async () => {
    const contact = seedContact();
    stub = stubClio({ contact });

    assert.equal((await book(BOOKING_1, { weeksOut: 1 })).status, 201);

    // The seed is REAL — booking 1 actually put these on the contact. Asserted
    // before booking 2 so "the sub-type was cleared" cannot pass by never having
    // been set. See feedback_idle_with_zero_tasks_is_a_vacuous_pass.
    const afterFirst = contactReads(contact);
    assert.equal(afterFirst.matter_category, 'Real estate');
    assert.equal(afterFirst.matter_sub, 'Ownership');
    assert.equal(afterFirst.source, 'utility_bar');

    assert.equal((await book(BOOKING_2, { weeksOut: 2 })).status, 201);

    const reads = contactReads(contact);

    // ── THE IMPOSSIBLE PAIR, named exactly as reported ──
    assert.equal(
      reads.matter_category === 'Other' && reads.matter_sub === 'Ownership',
      false,
      'the contact must NEVER read Matter Category "Other" beside Sub-Type "Ownership" '
      + '— Other has no sub-types, so this pair is one no session could produce',
    );

    // ── and the whole state, so "not the blend" cannot pass by being empty ──
    assert.equal(reads.matter_category, 'Other',      'the new matter is written');
    assert.equal(reads.matter_sub, '',                'the old sub-type is CLEARED');
    assert.equal(reads.for_whom, 'Business / company', 'the new for-whom is written');
    assert.equal(reads.consult_type, CONSULT_NAME,     'the consultation is written');
    assert.equal(reads.income_band, 'Above $3M',       'a supplied person field is written');
    assert.equal(reads.net_worth_band, 'Above $15M',   'and so is the other');
    assert.equal(reads.source, 'utility_bar',          'an OMITTED person field is KEPT');
    assert.equal(reads.language, '',                   'never answered, still unanswered');

    assert.deepEqual(stub.seen.rejected, [], 'no PATCH was refused by the vendor');
  });

  test('the cleared field goes out in UPDATE form, carrying the id the contact held', async () => {
    // Task 4. The row must carry the CustomFieldValue id already on the contact —
    // a create-form clear is the 422, and the vendor above would have thrown it.
    const contact = seedContact();
    stub = stubClio({ contact });

    await book(BOOKING_1, { weeksOut: 1 });
    const heldSubTypeId = contact.custom_field_values
      .find((r) => r.field_name === NAME_BY_KEY.get('matter_sub')).id;
    assert.ok(heldSubTypeId, 'the contact holds a value id for the sub-type after booking 1');

    await book(BOOKING_2, { weeksOut: 2 });

    const rows = patchedValues(stub.seen, 1);
    const cleared = rowFor(rows, 'matter_sub');
    assert.ok(cleared, 'the sub-type is ON the second PATCH — a skipped field clears nothing');
    assert.equal(cleared.value, '', 'and it is sent as an explicit empty');
    assert.equal(cleared.id, heldSubTypeId,
      'carrying the value id the contact already holds — this is what makes it an UPDATE');
    assert.equal('_destroy' in cleared, false, 'never a destroy — the row stays, its value goes');
  });

  test('NOT ONE create-form row on either PATCH, cleared rows included', async () => {
    const contact = seedContact();
    stub = stubClio({ contact });
    await book(BOOKING_1, { weeksOut: 1 });
    await book(BOOKING_2, { weeksOut: 2 });

    assert.equal(stub.seen.patches.length, 2, 'both bookings enriched the contact');
    for (const [i, patch] of stub.seen.patches.entries()) {
      const rows = patch.body.data.custom_field_values ?? [];
      assert.ok(rows.length, `PATCH #${i + 1} wrote fields`);
      for (const r of rows) {
        assert.ok(
          r.id != null && r.id !== '',
          `PATCH #${i + 1} row for field ${r.custom_field?.id} must carry a value id — `
          + 'the create form onto a materialised row is the 422',
        );
      }
    }
    assert.deepEqual(stub.seen.rejected, [], 'and the vendor refused none of it');
  });

  test('an omitted PERSON field is not written at all, not written empty', async () => {
    const contact = seedContact();
    stub = stubClio({ contact });
    await book(BOOKING_1, { weeksOut: 1 });
    await book(BOOKING_2, { weeksOut: 2 });

    const rows = patchedValues(stub.seen, 1);
    assert.equal(rowFor(rows, 'source'), undefined,
      'Source is absent from the PATCH — an untouched member of the array is untouched');
    assert.equal(contactReads(contact).source, 'utility_bar');
  });

  test('a matter field that was never set is not cleared — no blank onto a blank', async () => {
    // `language` is person-scoped, but the same suppression covers a matter field
    // the contact has never held a value for: there is nothing to clear, and a row
    // that writes "" onto "" is latency on the client's booking for no change.
    const contact = seedContact();
    stub = stubClio({ contact });
    // A first booking that establishes the matter and sets NO for_whom.
    await book({ matter_category: 'Real estate' }, { weeksOut: 1 });

    const rows = patchedValues(stub.seen, 0);
    assert.equal(rowFor(rows, 'for_whom'), undefined,
      'for_whom is matter-scoped and unsupplied, but it holds nothing — no clear row');
    assert.equal(rowFor(rows, 'matter_sub'), undefined, 'same for the sub-type');
    assert.ok(rowFor(rows, 'matter_category'), 'while the supplied field IS written');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE GUARD — task 3: no matter context, no clearing
// ─────────────────────────────────────────────────────────────────────────────
describe('a booking that establishes no matter context', () => {
  test('leaves EVERY matter field at its prior value', async () => {
    const contact = seedContact();
    stub = stubClio({ contact });

    await book(BOOKING_1, { weeksOut: 1 });
    const before = contactReads(contact);
    assert.equal(before.matter_category, 'Real estate');
    assert.equal(before.matter_sub, 'Ownership');

    // A second session that answered only person-scoped questions — no category.
    await book({ language: 'Spanish', income_band: 'Above $3M' }, { weeksOut: 2 });

    const after = contactReads(contact);
    assert.equal(after.matter_category, 'Real estate', 'the matter is UNCHANGED');
    assert.equal(after.matter_sub, 'Ownership',        'and so is its sub-type');
    assert.equal(after.language, 'Spanish',            'while the person answers are written');
    assert.equal(after.income_band, 'Above $3M');
  });

  test('and sends no cleared row at all', async () => {
    const contact = seedContact();
    stub = stubClio({ contact });
    await book(BOOKING_1, { weeksOut: 1 });
    await book({ language: 'Spanish' }, { weeksOut: 2 });

    const rows = patchedValues(stub.seen, 1);
    const blanks = rows.filter((r) => r.value === '');
    assert.deepEqual(blanks, [], 'silence about a matter is not a statement about it');
  });

  test('the guard is the CATEGORY, not merely "some matter field was supplied"', async () => {
    // A booking carrying a sub-type but no category has not established a matter.
    // Clearing on it would let a stray answer wipe the engagement surface.
    const contact = seedContact();
    stub = stubClio({ contact });
    await book(BOOKING_1, { weeksOut: 1 });
    await book({ for_whom: 'Business / company' }, { weeksOut: 2 });

    const after = contactReads(contact);
    assert.equal(after.matter_category, 'Real estate');
    assert.equal(after.matter_sub, 'Ownership', 'no category ⇒ no clear, even of a sibling');
    assert.equal(after.for_whom, 'Business / company', 'the supplied one is still written');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. WHAT THIS ORDER MUST NOT HAVE CHANGED
// ─────────────────────────────────────────────────────────────────────────────
describe('the surfaces this order left alone', () => {
  test('the intake note is still append-only — one note per session, verbatim', async () => {
    const contact = seedContact();
    stub = stubClio({ contact });
    await book(BOOKING_1, { weeksOut: 1 });
    await book(BOOKING_2, { weeksOut: 2 });

    assert.equal(stub.seen.notes.length, 2, 'two sessions, two notes — nothing was overwritten');
    const bodies = stub.seen.notes.map((n) => JSON.stringify(n));
    assert.match(bodies[0], /Real estate/, 'the first session is recorded as it happened');
    assert.match(bodies[1], /Other/, 'and so is the second');
    assert.match(bodies[0], /Real estate/,
      'the cleared sub-type survives in the note even though the field was emptied');
    assert.ok(
      stub.seen.notes.every((n) => JSON.stringify(n).length > 0),
      'notes carry a body',
    );
  });

  test('a cleared custom field is still legible on the note that recorded it', async () => {
    const contact = seedContact();
    stub = stubClio({ contact });
    await book(BOOKING_1, { weeksOut: 1 });
    await book(BOOKING_2, { weeksOut: 2 });

    // The whole justification for clearing the current-state surface: nothing is
    // LOST, because the append-only note preserves each session verbatim.
    assert.equal(contactReads(contact).matter_sub, '', 'the field is empty');
    assert.match(JSON.stringify(stub.seen.notes[0]), /Ownership/,
      'and the answer is still readable on the session that gave it');
  });

  test('the post-call write does NOT clear — it has no matter context and no licence', async () => {
    const contact = seedContact();
    // The post-call fields exist on this account and on this contact.
    for (const f of POSTCALL_CUSTOM_FIELDS) {
      contact.custom_field_values.push({
        id: `text_line-p${f.key}`, value: '', field_name: f.name, custom_field: {},
      });
    }
    stub = stubClio({ contact, cfFields: ALL_FIELDS });

    const cfg = resolveConfig(envFor()).config;
    const byName = () => new Map(contact.custom_field_values.map((r) => [r.field_name, r.value]));

    // First call: all four analysed. Asserted, so the "kept" claim below is about a
    // value that was really there.
    await writePostCallFields(cfg, envFor(), CONTACT_ID, {
      urgency: 'High', interest: 'Strong', user_sentiment: 'Positive', call_summary: 'A call.',
    });
    assert.equal(byName().get('Intake Urgency'), 'High');
    assert.equal(byName().get('Intake Interest'), 'Strong');

    // Second call: the analysis produced no urgency. It must NOT be emptied.
    await writePostCallFields(cfg, envFor(), CONTACT_ID, { user_sentiment: 'Neutral' });

    assert.equal(byName().get('Intake Urgency'), 'High',
      'an unanalysed post-call field keeps its last known value — the blanket skip is intact here');
    assert.equal(byName().get('Intake Call Sentiment'), 'Neutral', 'and the supplied one is updated');
    assert.deepEqual(stub.seen.rejected, [], 'no create-form row reached the vendor');
  });

  test('a booking never writes a post-call field', async () => {
    const contact = seedContact();
    for (const f of POSTCALL_CUSTOM_FIELDS) {
      contact.custom_field_values.push({
        id: `text_line-p${f.key}`, value: 'set by retell', field_name: f.name, custom_field: {},
      });
    }
    stub = stubClio({ contact, cfFields: ALL_FIELDS });

    await book(BOOKING_1, { weeksOut: 1 });
    await book(BOOKING_2, { weeksOut: 2 });

    const byName = new Map(contact.custom_field_values.map((r) => [r.field_name, r.value]));
    for (const f of POSTCALL_CUSTOM_FIELDS) {
      assert.equal(byName.get(f.name), 'set by retell',
        `${f.name} is untouched by the booking path, cleared or otherwise`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE DEGRADED READ — a clear needs evidence, not an assumption
// ─────────────────────────────────────────────────────────────────────────────
describe('a contact whose values could not be attributed', () => {
  test('is never cleared — an unread field is not an empty one', async () => {
    // The rows are there and hold values, but they carry NO id: the shape Clio
    // returns for a displayed-by-default field that has never been set. Without a
    // value id the only available row is the create form, which is the 422 — so the
    // clear must decline rather than reach for it. Same fail-safe direction
    // `webSitesReadable` gives the website write.
    const contact = seedContact({ materialised: false });
    stub = stubClio({ contact });

    await book(BOOKING_2, { weeksOut: 1 });

    const rows = patchedValues(stub.seen, 0);
    const blanks = rows.filter((r) => r.value === '');
    assert.deepEqual(blanks, [],
      'no clear row was built from an index that could not address one');
    assert.deepEqual(stub.seen.rejected, [], 'and the vendor refused nothing');
  });
});
