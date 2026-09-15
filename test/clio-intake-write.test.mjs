// ── ORDER SHELDON-INTAKE-WRITE-FIX-R1 · issue #153 ───────────────────────────
//
// A live booking through BOTH doors — the no-voice BOOK A CONSULTATION card and
// the Paula voice card — created the contact, attached the attendee, minted the
// Zoom join_url and sent the confirmation email, and wrote NONE of the seven
// Intake custom fields onto the contact. Confirmed on two contacts.
//
// ── WHAT THIS FILE FOUND, AND WHY NOTHING ELSE COULD ─────────────────────────
//
// `test/clio-contact-mapping.test.mjs` already asserts that a booking with a
// complete qualifier record produces a PATCH carrying seven custom_field_values,
// and it is GREEN — on `main`, today, against the shipping code. It is green
// because its Clio hands back a contact whose custom_field_values rows carry
// `custom_field: { id }`:
//
//     contactFound: existing({ custom_field_values: [
//       { id: 'cfv-1', custom_field: { id: FIELD_ID.income_band } }, … ] })
//
// THE LIVE GRANT NEVER RETURNS THAT SHAPE. It was probed directly (PR 163,
// issue 153), and the answer is a table:
//
//   id,custom_field_values{id,value,field_name}          200 · twelve NAMED rows
//   id,custom_field_values{id,value,field_name,field_type} 200 · attributes + type
//   id,custom_field_values{id,value,custom_field}        200 · ATTRIBUTES NOTHING
//   id,custom_field_values{id,value,custom_field{ id }}  400 · Clio's selector
//                                                        grammar has no second
//                                                        level. That arm can
//                                                        never succeed.
//
// So `custom_field.id` is UNREACHABLE from a contact read on this grant, and the
// production search asked for a PLAIN `custom_field_values` — the rung whose rows
// carry `id` and `value` and nothing that names their field.
//
// `existingValueIndex` read exactly one key, `row.custom_field.id`. On every live
// booking it therefore skipped every row and returned an EMPTY map, and
// `buildCustomFieldValues` wrote all seven answers in CREATE form — `custom_field
// {id}` with no `id` — onto a contact that already carried a CustomFieldValue row
// for each of them. Clio's own documentation is explicit about which form belongs
// to which case: "If the `id` is NULL, you must provide `custom_field{id}` to
// create the CustomFieldValue and assign a value." A row that HAS an id is the
// other case, and it was being written as though it were the first.
//
// The suite could not see any of it because the stub was MORE GENEROUS THAN THE
// VENDOR: it projected `fields=` at the top level only, so asking for
// `custom_field_values` returned every sub-key on every row. Every branch that
// depends on what a degraded selection OMITS was unreachable while still looking
// tested. See [[feedback_a_stub_more_generous_than_the_vendor_hides_the_defect]].
//
// ── SO THE CLIO IN THIS FILE IS AS STINGY AS THE REAL ONE ────────────────────
//   · `fields=` is projected at EVERY level, sub-selections included;
//   · a second-level selector is an unconditional 400, so re-adding that arm reds
//     this suite instead of costing another live run;
//   · a contact's custom_field_values rows carry `id`, `value` and `field_name`,
//     and a `custom_field` wrapper with NOTHING usable in it.
//
// Both stingy behaviours are FIRED BY HAND below, so neither is inert: a stub that
// silently stopped projecting would make every assertion here vacuous.
//
// ── AND THE LEAK INVARIANT IS ASSERTED IN THE SAME BOOKING ───────────────────
// Every test that proves a band reached the contact also proves the same string is
// absent from the calendar entry's description, summary and location — the three
// surfaces Clio renders verbatim into the client's confirmation email and .ics.
// The band strings are asserted non-empty and asserted PRESENT on the back-office
// note first, so "not found on the client-facing surface" cannot pass by searching
// for nothing. See [[feedback_idle_with_zero_tasks_is_a_vacuous_pass]].

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import {
  INTAKE_CUSTOM_FIELDS,
  __resetIntakeFieldCache,
} from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import { stubFetch, muteConsole, makeKV, makeDurableObject } from './helpers/stubs.mjs';

const SITEVERIFY    = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES  = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS  = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES    = 'https://app.clio.com/api/v4/notes';

const CONTACT_ID   = 2413234643;      // the shape of the live one, not the value
const CALL_ID      = 'call_intakewrite00001';
const MEETING_LINK = 'https://meet.donovan.law/consult';

const FIELD_ID = Object.fromEntries(INTAKE_CUSTOM_FIELDS.map((f, i) => [f.key, 8100 + i]));

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

// ── The stingy Clio ──────────────────────────────────────────────────────────

/**
 * Parse a Clio `fields=` selection into a projection tree.
 * `id,custom_field_values{id,value,field_name}` → {id:null, custom_field_values:{…}}
 */
export function parseSelection(sel) {
  const out = {};
  let depth = 0, buf = '', key = '';
  for (const ch of String(sel)) {
    if (ch === '{') { depth += 1; if (depth === 1) { key = buf.trim(); buf = ''; continue; } }
    if (ch === '}') { depth -= 1; if (depth === 0) { out[key] = parseSelection(buf); buf = ''; key = ''; continue; } }
    if (ch === ',' && depth === 0) { if (buf.trim()) out[buf.trim()] = null; buf = ''; continue; }
    buf += ch;
  }
  if (buf.trim()) out[buf.trim()] = null;
  return out;
}

/** How many levels deep a selection nests. Clio answers >1 with a 400. */
export function selectionDepth(sel) {
  let d = 0, max = 0;
  for (const ch of String(sel)) {
    if (ch === '{') { d += 1; if (d > max) max = d; }
    if (ch === '}') d -= 1;
  }
  return max;
}

/**
 * What a sub-resource named PLAINLY comes back as.
 *
 * A plain `custom_field_values` is not "every sub-key": the R1 verifier run asked
 * for `id,name,custom_field_values` against the live grant, got twelve rows, and
 * could tie NONE of them to a field — the rows carried `id` and `value` and nothing
 * else. That is the whole reason the production selection was useless, so it is the
 * one default this model states.
 *
 * Nothing is registered for `phone_numbers` or `addresses`: the probe says nothing
 * about them, and inventing a default for a sub-resource nobody has read back is the
 * same over-claiming that produced the defect. They keep the permissive shape, which
 * is the direction that cannot make an assertion here pass falsely.
 */
const PLAIN_SUBSELECTION = {
  custom_field_values: { id: null, value: null },
};

/** Project a row through a selection tree — at EVERY level, like the vendor. */
export function project(row, selection) {
  const out = {};
  for (const [k, sub] of Object.entries(selection)) {
    if (!(k in row)) continue;
    const v = row[k];
    const tree = sub ?? PLAIN_SUBSELECTION[k] ?? null;
    if (tree && Array.isArray(v)) out[k] = v.map((r) => project(r, tree));
    else if (tree && v && typeof v === 'object') out[k] = project(v, tree);
    else if (tree) continue;     // asked for sub-keys of a scalar — nothing to give
    else out[k] = v;
  }
  return out;
}

/**
 * The seven rows a contact already carries, the way the live grant serialises them:
 * a composite string id, an empty value, the field's NAME, and a `custom_field`
 * wrapper that resolves to nothing.
 */
function heldRows({ materialised = true } = {}) {
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

function stubClio({ contactFound = null, materialised = true } = {}) {
  const seen = {
    calls: [], searches: [], cfLists: [], contacts: [], patches: [], entries: [], notes: [],
    /** Every `fields=` selection that reached the vendor, in order. */
    selections: [],
    /** Requests the vendor REFUSED, so a 400 cannot pass for an answer. */
    refused: [],
  };

  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    let sel = '';
    try { sel = new URL(u).searchParams.get('fields') ?? ''; } catch (_) { /* not a URL we parse */ }
    if (sel) seen.selections.push(sel);

    // THE VENDOR'S REFUSAL. Clio's selector grammar has one level. Unconditional,
    // and ahead of every other branch, so no future selection can smuggle a second
    // level past it and read as a pass.
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
      return new Response(JSON.stringify({ data: { id: 4981729058 } }));
    }

    if (u.startsWith(CLIO_CFIELDS) && method === 'GET') {
      seen.calls.push('cf:list');
      seen.cfLists.push(u);
      return new Response(JSON.stringify({
        data: CF_ROWS.map((r) => project(r, parseSelection(sel || 'id,name,field_type'))),
        meta: {},
      }));
    }

    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      seen.calls.push('contact:patch');
      seen.patches.push({ url: u, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      seen.calls.push('contact:search');
      seen.searches.push(u);
      if (!contactFound) return new Response('{"data":[]}');
      const row = { ...contactFound, custom_field_values: heldRows({ materialised }) };
      return new Response(JSON.stringify({ data: [project(row, parseSelection(sel))] }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      seen.calls.push('contact:create');
      seen.contacts.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
    }

    if (u.startsWith(CLIO_NOTES) && method === 'POST') {
      seen.calls.push('note');
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

/** A contact Clio already holds, in the enriched shape minus the custom fields. */
function existingContact(over = {}) {
  return {
    id: CONTACT_ID,
    first_name: 'David',
    last_name: 'Pierce',
    email_addresses: [{ address: 'client@example.com' }],
    phone_numbers: [{ id: 1, number: '(561) 555-0142' }],
    addresses: [{ id: 2, province: STATE }],
    ...over,
  };
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

/** The KV record fn/qualifier_submit writes: prose AND structure on one record. */
function kvWithQualifier(over = {}) {
  return makeKV({
    [`qualbk:${CALL_ID}`]: JSON.stringify({
      summary: SUMMARY, intake: INTAKE, state: STATE, matter: 'real_estate', ...over,
    }),
  });
}

async function book(over = {}) {
  const res = await onRequestPost({
    request: new Request('https://www.donovan.law/booking/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() },
      body: JSON.stringify({
        type: 'consult',
        slot: SLOT,
        name: 'David Pierce',
        email: 'client@example.com',
        phone: '(561) 555-0142',
        call_id: CALL_ID,
        turnstile_token: 'good-token',
        ...over,
      }),
    }),
    env: envFor({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: bridgeWithQualifier() }),
  });
  return res;
}

/** custom_field_values off the enrichment PATCH, with a count so "no write" cannot pass. */
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
// 0. THE STUB IS AS STINGY AS THE VENDOR — fired by hand, so it cannot go inert
// ─────────────────────────────────────────────────────────────────────────────
describe('the vendor model', () => {
  test('a PLAIN custom_field_values selection returns rows that name no field', () => {
    const row = { id: CONTACT_ID, custom_field_values: heldRows() };
    const got = project(row, parseSelection('id,custom_field_values'));
    assert.equal(got.custom_field_values.length, INTAKE_CUSTOM_FIELDS.length);
    for (const r of got.custom_field_values) {
      assert.equal('field_name' in r, false, 'plain gives no field_name — this is the live shape');
      assert.equal('custom_field' in r, false, 'and nothing that resolves to a CustomField id');
    }
  });

  test('the attributing selection returns field_name on every row', () => {
    const row = { id: CONTACT_ID, custom_field_values: heldRows() };
    const got = project(row, parseSelection('id,custom_field_values{id,value,field_name}'));
    assert.deepEqual(
      got.custom_field_values.map((r) => r.field_name),
      INTAKE_CUSTOM_FIELDS.map((f) => f.name),
    );
  });

  test('a custom_field sub-selection attributes NOTHING, exactly as the grant answered', () => {
    const row = { id: CONTACT_ID, custom_field_values: heldRows() };
    const got = project(row, parseSelection('id,custom_field_values{id,value,custom_field}'));
    for (const r of got.custom_field_values) {
      assert.equal(r.custom_field?.id, undefined, 'a wrapper with no usable id');
    }
  });

  test('a second-level selector is a 400 — the arm that can never succeed', async () => {
    assert.equal(selectionDepth('id,custom_field_values{id,value,custom_field{id}}'), 2);
    stub = stubClio();
    const res = await fetch(`${CLIO_CONTACTS}/1?fields=`
      + encodeURIComponent('id,custom_field_values{id,value,custom_field{id}}'));
    assert.equal(res.status, 400);
    assert.equal(stub.seen.refused.length, 1, 'the refusal is recorded, not silently absorbed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE DEFECT — a booking onto a contact Clio already holds
// ─────────────────────────────────────────────────────────────────────────────
describe('the seven Intake answers reach the contact Clio already holds', () => {
  test('the search asks for the selection that ATTRIBUTES a row', async () => {
    stub = stubClio({ contactFound: existingContact() });
    assert.equal((await book()).status, 201);

    const search = stub.seen.searches[0];
    const fields = decodeURIComponent(new URL(search).searchParams.get('fields'));
    assert.match(fields, /custom_field_values\{[^}]*field_name[^}]*\}/,
      'a contact read that does not ask for field_name cannot attribute a single row');
    assert.equal(selectionDepth(fields), 1, 'and it stays inside the one level Clio has');
    assert.equal(stub.seen.refused.length, 0, 'no request was refused for its selection');
  });

  test('all seven land on the wire, each addressing its own field', async () => {
    stub = stubClio({ contactFound: existingContact() });
    assert.equal((await book()).status, 201);

    const rows = patchedValues(stub.seen);
    assert.equal(rows.length, 7, 'one value per intake field');
    for (const f of INTAKE_CUSTOM_FIELDS) {
      const row = rowFor(rows, f.key);
      assert.ok(row, `${f.name} is on the PATCH`);
      assert.equal(row.value, INTAKE[f.key], `${f.name} carries the answer the caller gave`);
      assert.ok(Number.isInteger(row.custom_field.id), 'addressed by a real CustomField id');
    }
  });

  test('THE FIX: every one updates the value already on the record, in place', async () => {
    // THIS IS THE RED ONE. Before the fix `existingValueIndex` read only
    // `row.custom_field.id` — a key the live grant does not return at any selection
    // — so the map was empty and all seven went out in CREATE form onto rows that
    // already existed. Clio's contract: the create form is for a NULL id only.
    stub = stubClio({ contactFound: existingContact(), materialised: true });
    assert.equal((await book()).status, 201);

    const rows = patchedValues(stub.seen);
    const held = heldRows();
    const idByName = new Map(held.map((r) => [r.field_name, r.id]));

    for (const f of INTAKE_CUSTOM_FIELDS) {
      const row = rowFor(rows, f.key);
      assert.equal(
        row.id, idByName.get(f.name),
        `${f.name} must replace the CustomFieldValue already on the contact, not add a second one`,
      );
    }
    assert.equal(rows.filter((r) => r.id != null).length, 7,
      'seven rows, seven value ids — an empty index writes zero of these');
  });

  test('a row the contact has NOT been given a value for is still created, not faked', async () => {
    // The other half of Clio's rule: a NULL id means "displayed but unset", and the
    // documented instruction there is custom_field{id} with no id. A fix that
    // invented an id for those would be a different defect.
    stub = stubClio({ contactFound: existingContact(), materialised: false });
    assert.equal((await book()).status, 201);

    const rows = patchedValues(stub.seen);
    assert.equal(rows.length, 7);
    for (const r of rows) assert.equal('id' in r, false, 'create form, exactly as documented');
  });

  test('a brand-new contact gets the seven in create form, on the PATCH not the POST', async () => {
    stub = stubClio({ contactFound: null });
    assert.equal((await book()).status, 201);

    assert.equal(stub.seen.contacts.length, 1, 'exactly one contact created');
    assert.equal(
      'custom_field_values' in stub.seen.contacts[0].data, false,
      'nothing optional rides on the POST that mints the id the email hangs off',
    );
    const rows = patchedValues(stub.seen);
    assert.equal(rows.length, 7);
    for (const r of rows) assert.equal('id' in r, false);
  });

  test('the booking still completes and the attendee is still attached', async () => {
    // The seven are enrichment. Nothing here may cost the client the email.
    stub = stubClio({ contactFound: existingContact() });
    assert.equal((await book()).status, 201);

    const entry = stub.seen.entries[0].data;
    assert.deepEqual(entry.attendees, [{ id: CONTACT_ID, type: 'Contact' }, { id: 9084638, type: 'Calendar' }]);
    assert.equal(entry.send_email_notification, true);
    assert.equal(stub.seen.notes.length, 1, 'and the intake note is still filed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE LEAK INVARIANT — same booking, both directions, non-vacuously
// ─────────────────────────────────────────────────────────────────────────────
describe('the bands land on the back office and on no client-facing surface', () => {
  test('both bands are on the contact AND on the note, and on neither the description, summary nor location', async () => {
    stub = stubClio({ contactFound: existingContact() });
    assert.equal((await book()).status, 201);

    // NON-VACUOUS ARM #1 — there is something to search for.
    assert.ok(BAND_INCOME.length > 3 && BAND_NET_WORTH.length > 3);
    assert.notEqual(BAND_INCOME, BAND_NET_WORTH);

    // NON-VACUOUS ARM #2 — the strings DID reach the two attorney-side surfaces.
    const rows = patchedValues(stub.seen);
    assert.equal(rowFor(rows, 'income_band').value, BAND_INCOME);
    assert.equal(rowFor(rows, 'net_worth_band').value, BAND_NET_WORTH);

    const note = stub.seen.notes[0].data;
    const noteText = JSON.stringify(note);
    assert.ok(noteText.includes(BAND_INCOME), 'the income band is on the back-office note');
    assert.ok(noteText.includes(BAND_NET_WORTH), 'the net-worth band is on the back-office note');

    // THE INVARIANT — the three surfaces Clio renders into the client's email.
    const entry = stub.seen.entries[0].data;
    for (const surface of ['description', 'summary', 'location']) {
      const text = String(entry[surface] ?? '');
      for (const band of [BAND_INCOME, BAND_NET_WORTH, 'Income:', 'Net worth:', '— Perch intake —']) {
        assert.equal(
          text.includes(band), false,
          `the calendar entry ${surface} is emailed verbatim to the client — ${band} must not be in it`,
        );
      }
    }
    // And the entry body as a whole, so a band cannot arrive through a fourth key.
    const entryText = JSON.stringify(entry);
    assert.equal(entryText.includes(BAND_INCOME), false);
    assert.equal(entryText.includes(BAND_NET_WORTH), false);
  });

  test('the guard is not inert: the same search finds a planted band', () => {
    // A search that cannot find a band it was handed proves nothing about one it
    // did not find. This is that check, run against the same predicate.
    const planted = { description: `Consultation. Income: ${BAND_INCOME}`, summary: '', location: '' };
    assert.equal(String(planted.description).includes(BAND_INCOME), true);
    assert.equal(JSON.stringify(planted).includes(BAND_NET_WORTH), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE APPLIED-CHECK — the fix is in the SHIPPED source, not only in this file
// ─────────────────────────────────────────────────────────────────────────────
describe('the fix is applied to the shipping adapter', () => {
  // provider-clio.js as it stood at 2f580a2 — the production commit the symptom was
  // observed on — LF-normalised, because this worktree checks out CRLF and the blob
  // is LF. See [[feedback_git_show_lf_vs_worktree_crlf]].
  const PRE_FIX_SHA =
    '469f53ac29a528ed40a4002d1903641afaa444716ef9087cfb204ecc9f8eea18';
  const PROVIDER = new URL(
    '../donovan-legal-site/functions/booking/_lib/provider-clio.js', import.meta.url,
  );

  const source = () => readFileSync(PROVIDER, 'utf8').replace(/\r\n/g, '\n');

  test('the adapter differs from the source that shipped the defect', () => {
    const sha = createHash('sha256').update(source(), 'utf8').digest('hex');
    assert.notEqual(
      sha, PRE_FIX_SHA,
      'the shipping adapter is byte-identical to 2f580a2 — the fix was not applied',
    );
  });

  test('the contact read asks for field_name in the shipped source', () => {
    assert.match(source(), /CONTACT_CUSTOM_FIELD_NAME:\s*"field_name"/);
    assert.match(source(), /CONTACT_CUSTOM_FIELD_NAME\}\}/,
      'the enriched search selection is built from it, not from a re-spelling');
  });

  test('the existing-value index reads the key the vendor actually returns', () => {
    assert.match(source(), /byName\.set\(name, valueId\)/,
      'existingValueIndex indexes by field name — the id route alone is empty live');
  });
});
