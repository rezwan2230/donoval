// ── ORDER SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE-R1 · issue #153 follow-on ──
//
// Two fields, both built from data the booking ALREADY HAD, neither of which the
// contact carried after #170:
//
//   Intake Consult Type — which consultation was booked. Off the booking's own
//     `typeId`, on every booking, web and voice alike, on the create path and the
//     update path. `typeId` is a required parameter of createBooking, so there is no
//     booking on any channel that lacks one; it was simply never threaded as far as
//     the contact write.
//
//   Website — https://www.donovan.law/, because the booking came through the firm's
//     site. Set ONLY when the contact's Website is EMPTY, so a URL a client typed in,
//     or Paul entered by hand, is never displaced.
//
// ── WHAT MAKES THIS FILE ABLE TO SEE ITS OWN DEFECTS ─────────────────────────
//
// THE ACCOUNT ACTUALLY CARRIES THE FIELD. `CF_ROWS` is built from
// CONTACT_CUSTOM_FIELDS, not from the seven, so `Intake Consult Type` is a real row
// on the stubbed account and resolves BY NAME through exactly the walk the seven
// resolve through — no seeded id anywhere in this file (CLIO_INTAKE_FIELD_IDS is
// never set, by §1's own assertion). Every other Clio suite in this repo stubs an
// account built from the seven, where the field is absent and correctly skipped;
// that is a fine thing for those files to assert and it is not evidence that this
// one works. See [[feedback_a_stub_more_generous_than_the_vendor_hides_the_defect]]
// for the inverse error — the stub here is exactly as generous as an account David
// has added the field to, and no more.
//
// THE TWO READS ARE TOLD APART, inherited from clio-create-path-write.test.mjs:
// `GET /contacts?query=` is the SEARCH and answers a LIST; `GET /contacts/{id}` is
// the RECORD and answers an OBJECT. §0 fires both by hand so the distinction cannot
// rot. Routing them into one branch is what would make the create path vacuous.
//
// THE VENDOR'S SELECTION RULES ARE ENFORCED, also inherited: a `fields=` selection is
// PROJECTED at every level, and a second-level selector is an unconditional 400. Both
// matter here for one reason — the Website write is licensed by ABSENCE, and a stub
// that handed back `web_sites` without being asked for it would let a guard that
// never reads the field pass anyway. §5 is the case that pins that down.
//
// ── AND WHAT IT MAY NOT DO ───────────────────────────────────────────────────
//
// §6 is the leak invariant, re-asserted rather than assumed. Both new writes are
// firm-side by construction — one is the appointment name off the firm's own
// configured allow-list, the other is a single hard-coded firm URL — so neither can
// carry a band. That is an argument, and §6 is the evidence: the bands are checked
// against every client-facing surface this booking produces, and
// buildClientDescription's body is checked against the sha #170 froze.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import {
  INTAKE_CUSTOM_FIELDS,
  BOOKING_CUSTOM_FIELDS,
  POSTCALL_CUSTOM_FIELDS,
  CONTACT_CUSTOM_FIELDS,
  __resetIntakeFieldCache,
} from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import { parseSelection, selectionDepth, project } from './clio-intake-write.test.mjs';
import { stubFetch, muteConsole, makeKV, makeDurableObject } from './helpers/stubs.mjs';

const SITEVERIFY    = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES  = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS  = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES    = 'https://app.clio.com/api/v4/notes';

const NEW_CONTACT_ID  = 2413664401;   // minted on the create path
const HELD_CONTACT_ID = 2413664198;   // already on the account — the update path
const CALL_ID         = 'call_consulttype00001';
const MEETING_LINK    = 'https://meet.donovan.law/consult';

const CLIENT_EMAIL = 'client@example.com';
const CLIENT_PHONE = '(561) 555-0142';

/** The firm's site, spelled here so a drift in the source is a FAILURE not a silent pass. */
const FIRM_WEBSITE = 'https://www.donovan.law/';
/** booking/_lib/config.js: appointment_types = [{ id: 'consult', name: 'Initial Consultation' }] */
const TYPE_ID = 'consult';
const CONSULT_TYPE_NAME = 'Initial Consultation';

const FIELD_ID = Object.fromEntries(CONTACT_CUSTOM_FIELDS.map((f, i) => [f.key, 8400 + i]));

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
const BANDS = [INTAKE.income_band, INTAKE.net_worth_band];

const SUMMARY = [
  '— Perch intake —',
  `Matter: ${INTAKE.matter_category} → ${INTAKE.matter_sub}`,
  `State: ${STATE}`,
  `For: ${INTAKE.for_whom}`,
  `Income: ${BANDS[0]}`,
  `Net worth: ${BANDS[1]}`,
  `Language: ${INTAKE.language} · Source: ${INTAKE.source}`,
].join('\n');

/**
 * THE ACCOUNT — and it carries the eighth field.
 *
 * This is the single most load-bearing line in the file. Built from
 * CONTACT_CUSTOM_FIELDS, so `Intake Consult Type` is a `text_line` row on the account
 * under exactly that name and is found by the same by-name walk, subject to the same
 * field_type admission test, as the seven beside it.
 */
const CF_ROWS = CONTACT_CUSTOM_FIELDS.map((f) => ({
  id: FIELD_ID[f.key], name: f.name, field_type: f.type,
}));

/**
 * The rows Clio has already materialised on a contact: one per displayed-by-default
 * CustomField, each with its own composite value id and an empty value.
 */
function defaultRows() {
  return CONTACT_CUSTOM_FIELDS.map((f, i) => ({
    id: `text_line-${i + 1}`, value: '', field_name: f.name, custom_field: {},
  }));
}

/** A contact Clio ALREADY holds — the update path. */
function heldContact(over = {}) {
  return {
    id: HELD_CONTACT_ID,
    first_name: 'Bobby',
    last_name: 'Brown',
    email_addresses: [{ id: 11, address: CLIENT_EMAIL, name: 'Work' }],
    phone_numbers: [{ id: 21, number: CLIENT_PHONE, name: 'Mobile' }],
    addresses: [],
    web_sites: [],
    custom_field_values: defaultRows(),
    ...over,
  };
}

/**
 * @param {object} o
 * @param {object?} o.hold          the contact the SEARCH returns; null ⇒ create path.
 * @param {boolean} o.rejectEnriched  400 the enriched selection, forcing the minimal
 *                                    fallback — the rung that cannot see `web_sites`.
 * @param {number}  o.recordStatus  the status GET /contacts/{id} answers with.
 */
function stubClio({ hold = null, rejectEnriched = false, recordStatus = 200 } = {}) {
  const seen = {
    calls: [], searches: [], records: [], contacts: [], patches: [],
    entries: [], notes: [], cfLists: [], selections: [], refused: [],
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
      return new Response(JSON.stringify({ data: { id: 4981729401 } }));
    }

    // THE FIELD DEFINITIONS ARE READ AND NEVER WRITTEN. A POST here is the one thing
    // clio-custom-fields.js structurally cannot do (its transport has no `post`), so
    // a throw is the right shape: it would surface as a failed booking, loudly.
    if (u.startsWith(CLIO_CFIELDS) && method === 'POST') {
      throw new Error('POST /custom_fields is forbidden — this module reads, it does not create');
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
      return new Response(JSON.stringify({ data: { id: hold ? HELD_CONTACT_ID : NEW_CONTACT_ID } }));
    }

    // ── THE TWO READS, TOLD APART ────────────────────────────────────────────
    // `/contacts/{id}` answers an OBJECT; `/contacts?query=` answers a LIST.
    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'GET') {
      seen.calls.push('contact:record');
      seen.records.push(u);
      if (recordStatus !== 200) return new Response('{}', { status: recordStatus });
      const row = {
        id: NEW_CONTACT_ID,
        first_name: 'Charlie',
        last_name: 'Chaplin',
        email_addresses: [{ address: CLIENT_EMAIL }],
        phone_numbers: [{ number: CLIENT_PHONE }],
        addresses: [],
        // A CONTACT IS NOT BORN WITH A WEBSITE, and it is not born without the KEY
        // either: Clio answers a selected-but-empty sub-resource with an empty array.
        // Stubbing the key AWAY would make the create path's guard read `undefined`
        // and pass for the wrong reason.
        web_sites: [],
        custom_field_values: defaultRows(),
      };
      return new Response(JSON.stringify({ data: project(row, parseSelection(sel)) }));
    }

    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      // The rung that cannot see `web_sites`: refuse the enriched selection and the
      // search falls back to the verified minimal one.
      if (rejectEnriched && sel.includes('custom_field_values')) {
        seen.calls.push('contact:search:refused');
        return new Response('{"error":{"type":"ArgumentError"}}', { status: 400 });
      }
      seen.calls.push('contact:search');
      seen.searches.push(u);
      const rows = hold ? [project(hold, parseSelection(sel))] : [];
      return new Response(JSON.stringify({ data: rows }));
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
    // Matched on the ORIGIN, not on a prefix — `startsWith` also admits the
    // look-alike host. See [[feedback_host_assertion_by_substring_passes_for_the_lookalike]].
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
const nextIp = () => `203.0.113.${(_ipSeq += 1) % 250}`;

function bridgeWithQualifier() {
  const ns = makeDurableObject();
  ns.instance('donovan').state.set(`qual:${CALL_ID}`, { status: 'complete' });
  return ns;
}

function kvWithQualifier() {
  return makeKV({
    [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY, intake: INTAKE, state: STATE }),
  });
}

/**
 * One booking. `qualifier:false` is the no-Perch web booking — the case that proves
 * the consult type does not ride on the qualifier's coat-tails.
 */
async function book({ qualifier = true, body = {}, env = {} } = {}) {
  return onRequestPost({
    request: new Request('https://www.donovan.law/booking/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() },
      body: JSON.stringify({
        type: TYPE_ID,
        slot: SLOT,
        name: 'Charlie Chaplin',
        email: CLIENT_EMAIL,
        phone: CLIENT_PHONE,
        turnstile_token: 'good-token',
        ...(qualifier ? { call_id: CALL_ID } : {}),
        ...body,
      }),
    }),
    env: envFor({
      PERCH_ACTIONS: qualifier ? kvWithQualifier() : makeKV(),
      PERCH_BRIDGE: qualifier ? bridgeWithQualifier() : makeDurableObject(),
      ...env,
    }),
  });
}

/**
 * How many times `needle` occurs in `haystack`.
 *
 * NOT A URL CHECK, and it is written this way so that it cannot be read as one.
 * These assertions ask "does this serialised body / description / log stream carry
 * this string ANYWHERE" — a containment count over text we produced, not a decision
 * about whether some URL is trusted. Spelled with `includes` and a URL literal it is
 * indistinguishable, to a reader and to CodeQL alike, from the incomplete-substring
 * host check that is a genuine defect wherever it decides something
 * (see [[feedback_host_assertion_by_substring_passes_for_the_lookalike]]). A count is
 * also the stronger assertion: `0` says how many, where `false` only says "not one".
 */
function occurrences(haystack, needle) {
  return String(haystack).split(needle).length - 1;
}

/** The enrichment PATCH's `data`, with a count assertion so "no write" cannot pass. */
function patchData(seen, i = 0) {
  assert.ok(seen.patches.length > i, `an enrichment PATCH was issued (#${i + 1})`);
  return seen.patches[i].body.data;
}

/**
 * custom_field_values as {key: value}. A row this table cannot name is REPORTED —
 * dropping it would turn every assertion below into a claim about the rows we
 * happened to recognise.
 */
function cfvByKey(data) {
  const byId = new Map(CONTACT_CUSTOM_FIELDS.map((f) => [FIELD_ID[f.key], f.key]));
  const out = {};
  for (const row of data?.custom_field_values ?? []) {
    const key = byId.get(row?.custom_field?.id);
    assert.ok(key, `an unrecognised custom_field id reached the contact: ${row?.custom_field?.id}`);
    out[key] = row.value;
  }
  return out;
}

let stub, mute;
beforeEach(() => { __resetIntakeFieldCache(); mute = muteConsole(); });
afterEach(() => { stub?.restore(); mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// 0. THE MODEL — fired by hand, so the stub cannot go inert
// ─────────────────────────────────────────────────────────────────────────────
describe('the vendor model', () => {
  test('the record read answers an OBJECT and the search answers a LIST', async () => {
    stub = stubClio({ hold: heldContact() });
    const sel = encodeURIComponent('id,web_sites{address}');

    const record = await (await fetch(`${CLIO_CONTACTS}/${NEW_CONTACT_ID}?fields=${sel}`)).json();
    assert.equal(Array.isArray(record.data), false, 'a single record is not a list');

    const search = await (await fetch(`${CLIO_CONTACTS}?query=x&fields=${sel}`)).json();
    assert.ok(Array.isArray(search.data), 'the search is a list');
    assert.equal(search.data[0].id, HELD_CONTACT_ID);
  });

  test('a selection is PROJECTED — a field not asked for does not come back', async () => {
    stub = stubClio({ hold: heldContact({ web_sites: [{ address: 'https://held.example/' }] }) });

    const withSites = await (await fetch(
      `${CLIO_CONTACTS}?query=x&fields=${encodeURIComponent('id,web_sites{address}')}`)).json();
    assert.deepEqual(withSites.data[0].web_sites, [{ address: 'https://held.example/' }]);

    // THE CASE THE WEBSITE GUARD LIVES OR DIES ON. The minimal selection does not ask
    // for `web_sites`, so the key is simply not there — indistinguishable, to a reader
    // that does not know which selection it got, from a contact that has no website.
    const minimal = await (await fetch(
      `${CLIO_CONTACTS}?query=x&fields=${encodeURIComponent('id,email_addresses{address}')}`)).json();
    assert.equal('web_sites' in minimal.data[0], false,
      'an unread field is ABSENT, not empty — this is what §5 is about');
  });

  test('a second-level selector is a 400, so no selection here can be two deep', async () => {
    stub = stubClio({ hold: heldContact() });
    const res = await fetch(
      `${CLIO_CONTACTS}?query=x&fields=${encodeURIComponent('id,custom_field_values{custom_field{id}}')}`);
    assert.equal(res.status, 400);
    assert.equal(stub.seen.refused.length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE FIELD RESOLVES BY NAME — like the other seven, and by nothing else
// ─────────────────────────────────────────────────────────────────────────────
describe('Intake Consult Type resolves the way the seven do', () => {
  test('it is declared as its own list, NOT as an eighth self-reported answer', () => {
    // The separation is not cosmetic: intake-policy.js derives SELF_REPORTED_KEYS
    // from INTAKE_CUSTOM_FIELDS, so a key added there becomes a key the write policy
    // will admit off a stored qualifier record. A consult type is not something a
    // client self-reports, and a qualifier must never be able to supply one.
    assert.deepEqual(INTAKE_CUSTOM_FIELDS.map((f) => f.key), [
      'matter_category', 'matter_sub', 'for_whom',
      'income_band', 'net_worth_band', 'language', 'source',
    ], 'the seven are untouched');
    assert.deepEqual(BOOKING_CUSTOM_FIELDS.map((f) => f.key), ['consult_type']);
    // #174 added a THIRD list — the four post-call fields — on the same reasoning:
    // declared here, deliberately absent from the policy's derivation. The union is
    // still exactly its parts in declaration order; there are simply three of them.
    assert.deepEqual(
      CONTACT_CUSTOM_FIELDS.map((f) => f.key),
      [...INTAKE_CUSTOM_FIELDS, ...BOOKING_CUSTOM_FIELDS, ...POSTCALL_CUSTOM_FIELDS].map((f) => f.key),
      'and the union is exactly the three lists, in that order',
    );
    // The point of the split, restated where it can fail: widening the union must
    // not widen what a stored qualifier record may supply.
    assert.equal(CONTACT_CUSTOM_FIELDS.includes(BOOKING_CUSTOM_FIELDS[0]), true);
    for (const f of [...BOOKING_CUSTOM_FIELDS, ...POSTCALL_CUSTOM_FIELDS]) {
      assert.ok(!INTAKE_CUSTOM_FIELDS.some((s) => s.key === f.key),
        `${f.key} must not reach the seven the policy derives from`);
    }
  });

  test('it is named and typed like the seven', () => {
    const [consult] = BOOKING_CUSTOM_FIELDS;
    assert.equal(consult.name, 'Intake Consult Type');
    assert.equal(consult.type, 'text_line');
  });

  test('it binds off the ACCOUNT LISTING, with no seeded id anywhere', async () => {
    stub = stubClio({ hold: null });
    const res = await book();
    assert.equal(res.status, 201);

    // CLIO_INTAKE_FIELD_IDS is never set by envFor — asserted, not assumed, because a
    // seeded id would bypass the name lookup entirely and this whole section with it.
    assert.equal('CLIO_INTAKE_FIELD_IDS' in envFor(), false, 'nothing is seeded');
    assert.equal(stub.seen.cfLists.length, 1, 'the account was enumerated by name');
    assert.equal(cfvByKey(patchData(stub.seen)).consult_type, CONSULT_TYPE_NAME);

    // The STOP condition, made legible. A name the account does not carry is skipped
    // and SAID OUT LOUD — never invented, never created. Nothing is skipped here.
    assert.equal(mute.saw('Intake Consult Type'), false,
      'the field resolved, so it is not in the not-found warn');
  });

  test('an account WITHOUT the field skips it and says so — it is never created', async () => {
    // The account carries every declared field EXCEPT this one: David has not added
    // it yet. Named for what it is rather than for a count — CF_ROWS follows
    // CONTACT_CUSTOM_FIELDS, which #174 widened to three lists, so "the rest of the
    // account" is no longer seven rows.
    const withoutConsult = CF_ROWS.filter((r) => r.name !== 'Intake Consult Type');
    const handle = stubFetch(async (url, init) => {
      const u = String(url);
      if (u.startsWith(CLIO_CFIELDS) && (init?.method ?? 'GET') !== 'GET') {
        throw new Error('a missing field must never be CREATED');
      }
      if (u.startsWith(CLIO_CFIELDS)) {
        return new Response(JSON.stringify({ data: withoutConsult, meta: {} }));
      }
      throw new Error('unused');
    });
    try {
      const { resolveIntakeFieldIds, __resetIntakeFieldCache: reset } =
        await import('../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js');
      reset();
      const { ids } = await resolveIntakeFieldIds({ get: (p) => fetch(`${CLIO_CFIELDS}${p}`) }, {});
      assert.equal('consult_type' in ids, false, 'skipped, not guessed');
      assert.equal(Object.keys(ids).length, withoutConsult.length,
        'and every other declared field is unaffected by its absence');
      // The seven specifically, named rather than merely counted.
      for (const f of INTAKE_CUSTOM_FIELDS) {
        assert.ok(f.key in ids, `${f.name} still resolved`);
      }
      assert.ok(mute.saw('custom fields not found on the account — skipped: Intake Consult Type'),
        'David is told to add the field rather than the code masking its absence');
    } finally {
      handle.restore();
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE CREATE PATH — a client Clio has never heard of
// ─────────────────────────────────────────────────────────────────────────────
describe('the create path lands both new fields', () => {
  test('a booking by a brand-new client writes the consult type AND the website', async () => {
    stub = stubClio({ hold: null });
    const res = await book();
    assert.equal(res.status, 201);

    // This really is the create path: minted, then re-read, then enriched.
    assert.ok(stub.seen.contacts.length === 1, 'a contact was created');
    assert.ok(stub.seen.records.length === 1, 'and re-read before the enrichment');

    const d = patchData(stub.seen);
    assert.equal(cfvByKey(d).consult_type, CONSULT_TYPE_NAME, 'the consult type landed');
    assert.deepEqual(d.web_sites, [{
      address: FIRM_WEBSITE, name: 'Other', default_web_site: true,
    }], 'and the firm website, on a contact that had none');

    // The seven are still exactly the seven, unchanged by any of this.
    const cfv = cfvByKey(d);
    delete cfv.consult_type;
    assert.deepEqual(cfv, INTAKE, 'the #170 seven-field write is untouched');
  });

  test('the consult-type row goes out in UPDATE form, like the seven — #170 is not undone', async () => {
    stub = stubClio({ hold: null });
    await book();

    const rows = patchData(stub.seen).custom_field_values;
    for (const row of rows) {
      assert.ok(row.id, `every row carries the value id it was read with: ${row.custom_field?.id}`);
    }
    const consult = rows.find((r) => r.custom_field?.id === FIELD_ID.consult_type);
    assert.ok(consult?.id, 'the NEW row is update form too — not a create-form 422 waiting to happen');
  });

  test('it lands with NO qualifier at all — this is not a qualifier field', async () => {
    stub = stubClio({ hold: null });
    const res = await book({ qualifier: false });
    assert.equal(res.status, 201);

    const d = patchData(stub.seen);
    assert.equal(cfvByKey(d).consult_type, CONSULT_TYPE_NAME);
    assert.deepEqual(d.web_sites, [{
      address: FIRM_WEBSITE, name: 'Other', default_web_site: true,
    }]);
    // …and not one of the client's seven, because the client answered nothing.
    const cfv = cfvByKey(d);
    delete cfv.consult_type;
    assert.deepEqual(cfv, {}, 'no qualifier ⇒ no self-reported answers');
  });

  test('a re-read that FAILED declines the website rather than assuming it is empty', async () => {
    // The record could not be read, so we do not know what the contact carries. An
    // unread field is not an empty one. See [[feedback_a_confident_notfound_defeats_the_failclosed_guard]].
    stub = stubClio({ hold: null, recordStatus: 500 });
    const res = await book();
    assert.equal(res.status, 201, 'and the booking is still fine — this is best-effort');

    const d = patchData(stub.seen);
    assert.equal('web_sites' in d, false, 'nothing is written onto a contact we could not read');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE UPDATE PATH — a client Clio already holds
// ─────────────────────────────────────────────────────────────────────────────
describe('the update path lands both new fields', () => {
  test('a returning client gets the consult type AND the website', async () => {
    stub = stubClio({ hold: heldContact() });
    const res = await book();
    assert.equal(res.status, 201);

    assert.equal(stub.seen.contacts.length, 0, 'no duplicate Person — this is the reuse path');
    assert.equal(stub.seen.records.length, 0, 'and no create-path re-read');
    assert.match(stub.seen.patches[0].url, new RegExp(`/${HELD_CONTACT_ID}$`),
      'the PATCH went to the contact the SEARCH returned');

    const d = patchData(stub.seen);
    assert.equal(cfvByKey(d).consult_type, CONSULT_TYPE_NAME);
    assert.deepEqual(d.web_sites, [{
      address: FIRM_WEBSITE, name: 'Other', default_web_site: true,
    }]);
  });

  test('a second booking by the same client UPDATES the consult type, never appends', async () => {
    // The contact already carries a consult type from an earlier booking. The point
    // of the field is to be CURRENT, so it is written in place — the value id it was
    // read with rides on the row.
    const rows = defaultRows().map((r) =>
      r.field_name === 'Intake Consult Type' ? { ...r, value: 'Some earlier consultation' } : r);
    stub = stubClio({ hold: heldContact({ custom_field_values: rows }) });
    await book();

    const consult = patchData(stub.seen).custom_field_values
      .find((r) => r.custom_field?.id === FIELD_ID.consult_type);
    assert.equal(consult.value, CONSULT_TYPE_NAME, 'the current booking wins');
    assert.ok(consult.id, 'and it is an update in place, not a second row beside the old one');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE WEBSITE IS SET ONLY WHEN EMPTY — the half that can destroy data
// ─────────────────────────────────────────────────────────────────────────────
describe('a website the contact already has is never overwritten', () => {
  test("a client's own website survives the booking untouched", async () => {
    const OWN = 'https://bobbybrown.example/';
    stub = stubClio({ hold: heldContact({ web_sites: [{ id: 31, address: OWN }] }) });
    const res = await book();
    assert.equal(res.status, 201);

    const d = patchData(stub.seen);
    assert.equal('web_sites' in d, false,
      'the key is ABSENT from the body — nothing to overwrite and nothing appended beside it');

    // Belt and braces: the firm URL appears nowhere in the request at all, so it
    // cannot arrive through some other key.
    assert.equal(occurrences(JSON.stringify(d), FIRM_WEBSITE), 0);
    // …and the consult type still lands. Declining one write must not decline both.
    assert.equal(cfvByKey(d).consult_type, CONSULT_TYPE_NAME);
  });

  test('a BLANK website row is not a website — the firm site is still written', async () => {
    // Clio materialises empty rows. Counting rows instead of reading values would
    // make such a contact look permanently occupied and the field would never fill.
    stub = stubClio({ hold: heldContact({ web_sites: [{ id: 31, address: '   ' }] }) });
    await book();

    const d = patchData(stub.seen);
    assert.equal(d.web_sites[0].address, FIRM_WEBSITE);
    assert.equal('default_web_site' in d.web_sites[0], false,
      'and it does not claim the default slot, because there is a row to displace');
  });

  test('the label is "Other" — it never claims the URL is the client\'s own', async () => {
    stub = stubClio({ hold: heldContact() });
    await book();
    assert.equal(patchData(stub.seen).web_sites[0].name, 'Other');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE FAIL-CLOSED RUNG — a selection that never read web_sites licenses nothing
// ─────────────────────────────────────────────────────────────────────────────
describe('an unread website is not an empty one', () => {
  test('a search that fell back to the MINIMAL selection declines the write', async () => {
    // THE CONTROL FOR THE WHOLE OF §4. §4 proves the guard reads the field. This
    // proves the guard knows when it DID NOT — the minimal selection carries no
    // `web_sites` at all, so every contact on the account looks website-less through
    // it, and a guard that trusted the record would overwrite them all.
    const OWN = 'https://bobbybrown.example/';
    stub = stubClio({ hold: heldContact({ web_sites: [{ id: 31, address: OWN }] }), rejectEnriched: true });
    const res = await book();

    assert.equal(res.status, 201);
    assert.equal(stub.seen.contacts.length, 0, 'still no duplicate Person — the floor held');
    assert.ok(stub.seen.calls.includes('contact:search:refused'), 'the enriched selection WAS refused');

    const d = patchData(stub.seen);
    assert.equal('web_sites' in d, false,
      'the field was not read, so nothing is concluded from its absence');
  });

  test('THE CONTROL: the rung the booking actually fell back to is blind to web_sites', async () => {
    // The case above asserts a NEGATIVE — no `web_sites` key on the PATCH — and a
    // negative passes just as well when the booking never reached the branch at all.
    // This is the positive half, read off the SAME run: the selection the search
    // succeeded with does not mention `web_sites`, and a guard that read the record
    // it returned would therefore have concluded "no website" about a client who has
    // one, and overwritten it. The flag, not the record, is what declines.
    const OWN = 'https://bobbybrown.example/';
    stub = stubClio({ hold: heldContact({ web_sites: [{ id: 31, address: OWN }] }), rejectEnriched: true });
    await book();

    const answered = stub.seen.selections.filter((s) => s.includes('email_addresses')).pop();
    assert.ok(answered, 'a contact search ran');
    assert.equal(answered.includes('web_sites'), false,
      'the rung that answered never asked for web_sites');

    // The record that rung produced, projected exactly as Clio projects it, is what a
    // naive guard would have judged — and it reads as website-less.
    const record = project(heldContact({ web_sites: [{ id: 31, address: OWN }] }),
      parseSelection(answered));
    assert.equal('web_sites' in record, false, 'the key is absent from what came back');
    const naiveWouldOverwrite = !(Array.isArray(record.web_sites)
      && record.web_sites.some((w) => String(w?.address ?? '').trim() !== ''));
    assert.equal(naiveWouldOverwrite, true,
      'so a record-only guard WOULD have overwritten this client\'s own website');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. THE LEAK INVARIANT — re-asserted, not assumed
// ─────────────────────────────────────────────────────────────────────────────
describe('neither new write carries a financial value', () => {
  test('THE CONTROL: the containment counter can actually find what it looks for', () => {
    // Three assertions below are `occurrences(…) === 0`, and a counter that always
    // returned 0 would satisfy every one of them while proving nothing. Fired against
    // a string that DOES carry the needle, so the zeroes elsewhere are load-bearing.
    assert.equal(occurrences(`prefix ${FIRM_WEBSITE} suffix`, FIRM_WEBSITE), 1);
    assert.equal(occurrences(`${FIRM_WEBSITE}${FIRM_WEBSITE}`, FIRM_WEBSITE), 2);
    assert.equal(occurrences('nothing of the sort', FIRM_WEBSITE), 0);
    // And it sees through serialisation, which is how §4 reads a PATCH body.
    assert.equal(occurrences(JSON.stringify({ web_sites: [{ address: FIRM_WEBSITE }] }),
      FIRM_WEBSITE), 1);
  });

  test('no band reaches the calendar entry, on either path', async () => {
    for (const hold of [null, heldContact()]) {
      stub?.restore();
      __resetIntakeFieldCache();
      stub = stubClio({ hold });
      await book();

      const entry = JSON.stringify(stub.seen.entries[0]);
      for (const band of BANDS) {
        assert.equal(entry.includes(band), false, 'no band on the client-facing entry');
      }
      assert.equal(entry.includes(INTAKE.for_whom), false);
      assert.equal(entry.includes(SUMMARY), false);
      // The description is firm constants only — including the consult type's own
      // source, the configured appointment NAME, which is what it always carried.
      const desc = stub.seen.entries[0].data.description;
      assert.match(desc, new RegExp(CONSULT_TYPE_NAME));
      assert.equal(occurrences(desc, FIRM_WEBSITE), 0,
        'the CRM provenance marker is not a client-facing surface');
    }
  });

  test('the two new values are firm-side, and carry nothing about the client', async () => {
    stub = stubClio({ hold: heldContact() });
    await book();
    const d = patchData(stub.seen);

    // The consult type is the firm's configured appointment name; the website is one
    // hard-coded firm URL. Neither is any band, and neither is any client string.
    const consult = cfvByKey(d).consult_type;
    const site = d.web_sites[0].address;
    for (const value of [consult, site]) {
      for (const band of BANDS) assert.equal(value.includes(band), false);
      assert.equal(value.includes(CLIENT_EMAIL), false);
      assert.equal(value.includes(CLIENT_PHONE), false);
      assert.equal(value.includes('Chaplin'), false);
    }
    assert.equal(consult, CONSULT_TYPE_NAME);
    assert.equal(site, FIRM_WEBSITE);
  });

  test('no value of any kind is logged by either write', async () => {
    stub = stubClio({ hold: null });
    await book();

    const stream = mute.lines.map(([, m]) => m).join('\n');
    for (const band of BANDS) assert.equal(stream.includes(band), false);
    for (const v of Object.values(INTAKE)) assert.equal(stream.includes(v), false);
    assert.equal(stream.includes(CLIENT_EMAIL), false);
    assert.equal(stream.includes(CLIENT_PHONE), false);
    assert.equal(occurrences(stream, FIRM_WEBSITE), 0, 'not even the firm constant');
  });

  test('a qualifier record cannot supply a consult type — the policy refuses it', async () => {
    // The structural guarantee behind §1's list separation, fired end to end. A
    // record carrying `consult_type` is a post-call characterisation, and
    // intake-policy.js admits SELF_REPORTED_KEYS only. The value that lands is the
    // BOOKING's, never the record's.
    stub = stubClio({ hold: heldContact() });
    await book({
      env: {
        PERCH_ACTIONS: makeKV({
          [`qualbk:${CALL_ID}`]: JSON.stringify({
            summary: SUMMARY, state: STATE,
            intake: { ...INTAKE, consult_type: 'Injected by the call record' },
          }),
        }),
      },
    });

    assert.equal(cfvByKey(patchData(stub.seen)).consult_type, CONSULT_TYPE_NAME,
      'the booking\'s own typeId won — the record\'s string never reached the contact');
    const stream = mute.lines.map(([, m]) => m).join('\n');
    assert.equal(stream.includes('Injected by the call record'), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. THE VALUE COMES FROM typeId, AND IS NEVER INVENTED
// ─────────────────────────────────────────────────────────────────────────────
describe('the consult type is derived from the booking, never guessed', () => {
  test('it is the appointment NAME the firm configured, not the raw slug', async () => {
    stub = stubClio({ hold: heldContact() });
    await book();
    const v = cfvByKey(patchData(stub.seen)).consult_type;
    assert.equal(v, CONSULT_TYPE_NAME);
    assert.notEqual(v, TYPE_ID, 'a lawyer reads this field — not an internal id, when one resolves');
  });

  test('the entry summary and the contact field name the SAME appointment', async () => {
    // One lookup, two readers. If they ever diverge, the confirmation email and the
    // CRM record describe two different appointments for one booking.
    stub = stubClio({ hold: heldContact() });
    await book();
    assert.match(stub.seen.entries[0].data.description, new RegExp(CONSULT_TYPE_NAME));
    assert.equal(cfvByKey(patchData(stub.seen)).consult_type, CONSULT_TYPE_NAME);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. THE APPLIED CHECK — this file is about a change that is actually in the tree
// ─────────────────────────────────────────────────────────────────────────────
describe('the fix is in the shipped source', () => {
  const PROVIDER = new URL(
    '../donovan-legal-site/functions/booking/_lib/provider-clio.js', import.meta.url);
  const FIELDS = new URL(
    '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js', import.meta.url);
  // Normalised to LF before hashing: `git show` hands back LF and a Windows worktree
  // checks out CRLF, so an un-normalised hash compares line endings, not content.
  const read = (u) => readFileSync(u, 'utf8').replace(/\r\n/g, '\n');
  const sha = (s) => createHash('sha256').update(s, 'utf8').digest('hex');

  // The two files exactly as they stood at ff107d6 — main with #170 landed and this
  // order not yet applied. Content-addressed rather than read back out of git, so
  // the check needs no repository state to be meaningful.
  const PRE = {
    provider: 'dec170dec5ae4e6e577ff5e9cee8cdaa6227d697e0089a165468b5f1e09f0520',
    fields:   '62cba04e1c9f72433939f193ce9851a2064edf337a86cc209d9c60c3f17a8482',
  };

  test('provider-clio.js differs from the source that shipped without these fields', () => {
    assert.notEqual(sha(read(PROVIDER)), PRE.provider,
      'the shipping adapter is byte-identical to ff107d6 — the fix was not applied');
  });

  test('clio-custom-fields.js differs from the source that declared only the seven', () => {
    assert.notEqual(sha(read(FIELDS)), PRE.fields,
      'the shipping field list is byte-identical to ff107d6 — the fix was not applied');
  });

  test('buildClientDescription is NOT on this ticket — its body is byte-frozen', () => {
    // The same span and the same sha #170 froze. This order adds two fields to the
    // ATTORNEY-side record; the client-facing description is not permitted to move a
    // byte, and that is checked rather than promised.
    const lines = read(PROVIDER).split('\n');
    const start = lines.findIndex((l) => l.startsWith('export function buildClientDescription'));
    assert.ok(start >= 0);
    const end = lines.findIndex((l, i) => i > start && l === '}');
    const span = `${lines.slice(start, end + 1).join('\n').trim()}\n`;
    assert.equal(sha(span),
      'de5fcb4fff0ce318d15f50f6685acd7cbffb0db2ec3b5b30f28bb995433aef0b',
      'this ticket may not alter buildClientDescription');
  });

  test('the seven-field declaration is unchanged, and the policy still derives from it', async () => {
    const { SELF_REPORTED_KEYS } = await import(
      '../donovan-legal-site/functions/booking/_lib/intake-policy.js');
    assert.deepEqual([...SELF_REPORTED_KEYS], INTAKE_CUSTOM_FIELDS.map((f) => f.key),
      'the write policy still admits the seven and ONLY the seven');
    assert.equal(SELF_REPORTED_KEYS.includes('consult_type'), false,
      'and the booking-level field is not among them');
  });

  test('typeId reaches the contact write — it is threaded, not re-derived', () => {
    const src = read(PROVIDER);
    assert.match(src, /findOrCreateContact\(cfg, env, contact, intake, typeId\)/,
      'createBooking hands its own typeId to the contact write');
    assert.match(src, /async function findOrCreateContact\(cfg, env, contact, intake, typeId\)/);
  });
});
