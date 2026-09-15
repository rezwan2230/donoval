// ── ORDER SARAH-BOOKING-WRITEPATH-REGRESSION-R1 · issue #153 ─────────────────
//
// SARAH · QA. This file is a DURABLE REGRESSION, not a new investigation. The
// booking write path is proven live: #167 made the enrichment PATCH address a
// contact's existing rows by `field_name`, #169 made the contact search actually
// match on email so the CRM stops forking, and #170 made the create path re-read
// the contact it just minted so its rows go out in UPDATE form. All three are
// merged. Nothing here changes any of them; this file exists so none of them can
// come back.
//
// ── WHY THIS FILE HAS TO EXIST AT ALL ────────────────────────────────────────
//
// Every defect in that list passed offline and failed live, and each time for the
// SAME reason: THE TEST STUB WAS MORE GENEROUS THAN THE VENDOR.
//
//   · A stub that hands back a whole contact regardless of `fields=` makes the
//     plain selection and the sub-selected one indistinguishable. That is #169 —
//     three Bobby Brown contacts on the live account, 1661 green tests.
//   · A stub that answers `GET /contacts/{id}` with the SEARCH's empty list makes
//     the re-read and the missing re-read indistinguishable. That is #170.
//   · A stub that accepts every `custom_field_values` row whatever form it is in
//     makes create form and update form indistinguishable. That is the live 422 on
//     Charlie Chaplin, which no offline test could see because no offline Clio had
//     ever refused anything.
//
// See [[feedback_a_stub_more_generous_than_the_vendor_hides_the_defect]]. The rule
// this file is built on is the inverse: THE STUB IS AT LEAST AS STINGY AS THE LIVE
// GRANT AND NEVER MORE GENEROUS. A stingier vendor can only ever red a test the
// real one would have let through — a false red costs an engineer an hour, a false
// green costs the firm a duplicate client record it cannot merge.
//
// ── PROVENANCE OF THE VENDOR MODEL, STATED RATHER THAN IMPLIED ───────────────
//
// Each refusal below is labelled with where it came from, because "modelled" and
// "probed" are different claims and a reader must be able to tell them apart:
//
//   1. PLAIN SUB-RESOURCE ⇒ {id, etag}.        LIVE-PROBED (Elroy, #169). Asking
//      for `id,email_addresses` returns rows carrying NO `address`. Modelled the
//      same way for `phone_numbers` (no `number`) and `addresses` (no `province`,
//      no `country`) — not probed, and stingy in the direction that cannot make an
//      assertion here pass falsely.
//   2. PLAIN custom_field_values ⇒ {id, value}. LIVE-PROBED (PR 163, #153). No
//      `field_name`, so nothing attributes a row.
//   3. A SECOND-LEVEL SELECTOR IS A 400.        LIVE-PROBED (PR 163, #153).
//      `custom_field_values{id,value,custom_field{id}}` — Clio's selector grammar
//      has one level, so that arm can never succeed on any endpoint.
//   4. A FRESH CONTACT IS NOT BORN EMPTY.       VENDOR-DOCUMENTED + live 422.
//      Clio materialises a CustomFieldValue row for every CustomField displayed by
//      default, each with its own composite id ("text_line-1").
//   5. A CREATE-FORM WRITE ONTO AN EXISTING ROW IS REFUSED 422. LIVE-OBSERVED —
//      this is the Charlie Chaplin 422 itself, and it is the one refusal no stub
//      in this repo had modelled. It is what makes §2 and §3 self-enforcing rather
//      than descriptive: revert the production line and the VENDOR reds the test,
//      not an assertion someone remembered to write.
//
// ── WHAT IS ASSERTED ─────────────────────────────────────────────────────────
//
//   §0  the vendor model itself, fired BY HAND so it cannot go inert
//   §1  the create path writes update form on a brand-new contact
//   §2  the update path writes update form, and dedupe REUSES on an email match
//   §3  the leak invariant, end to end — bands on the contact and the note, on no
//       client-facing surface
//   §4  names-only logging on a non-2xx, with a body that echoes the client
//
// TESTS ONLY. No production file is touched by this ticket.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import {
  INTAKE_CUSTOM_FIELDS,
  __resetIntakeFieldCache,
} from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import {
  describeClioFailure,
  buildClientDescription,
} from '../donovan-legal-site/functions/booking/_lib/provider-clio.js';
import { stubFetch, muteConsole, makeKV, makeDurableObject } from './helpers/stubs.mjs';

const SITEVERIFY    = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES  = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS  = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES    = 'https://app.clio.com/api/v4/notes';

const NEW_CONTACT_ID  = 2413664312;   // the shape of the live one, not the value
const HELD_CONTACT_ID = 2413664198;   // the contact Clio already holds
const ENTRY_ID        = 4981729099;
const CALL_ID         = 'call_wpregress000001';
const MEETING_LINK    = 'https://meet.donovan.law/consult';
const CLIENT_EMAIL    = 'client@example.com';
const CLIENT_NAME     = 'Charlie Chaplin';
const PHONE           = '(561) 555-0142';

/** CustomField id per intake key — per-firm and not knowable at build time. */
const FIELD_ID = Object.fromEntries(INTAKE_CUSTOM_FIELDS.map((f, i) => [f.key, 8300 + i]));
const NAME_BY_FIELD_ID = new Map(INTAKE_CUSTOM_FIELDS.map((f) => [String(FIELD_ID[f.key]), f.name]));

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
 * Strings that may reach the CONTACT and the NOTE and must reach nothing the
 * client can read. The bands are the payload; the block marker and the raw key
 * spellings are included because a leak that arrives as `income_band` instead of
 * `$1.5M–$3M` is the same leak wearing a different label.
 */
const FORBIDDEN = [
  BAND_INCOME, BAND_NET_WORTH, '— Perch intake —', 'income_band', 'net_worth_band',
];

// ─────────────────────────────────────────────────────────────────────────────
// The stingy Clio
// ─────────────────────────────────────────────────────────────────────────────

/** Parse `a,b{c,d},e` into a selection tree. `null` leaf = "asked for plainly". */
function parseSelection(sel) {
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
function selectionDepth(sel) {
  let d = 0, max = 0;
  for (const ch of String(sel)) {
    if (ch === '{') { d += 1; if (d > max) max = d; }
    if (ch === '}') d -= 1;
  }
  return max;
}

/**
 * WHAT A SUB-RESOURCE NAMED PLAINLY COMES BACK AS.
 *
 * Every sub-resource this integration reads is registered, and every one of them
 * is registered STINGILY — see the provenance table in the file header. There is
 * no permissive fallback on purpose: an unregistered sub-resource would inherit
 * "hand back everything", which is precisely the generosity that hid #169.
 */
const PLAIN_SUBSELECTION = {
  email_addresses:     { id: null, etag: null },   // live-probed: no `address`
  phone_numbers:       { id: null, etag: null },   // no `number`
  addresses:           { id: null, etag: null },   // no `province`, no `country`
  custom_field_values: { id: null, value: null },  // live-probed: no `field_name`
};

/**
 * Project a row through a selection tree — AT EVERY LEVEL, like the vendor.
 *
 * A key that was not asked for is not returned. That single sentence is the whole
 * difference between this file and the suites that went green while the live grant
 * was forking the firm's CRM.
 */
function project(row, selection) {
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
 * The seven rows Clio has ALREADY materialised on a contact, the way the live
 * grant serialises them: a composite string id, a value, the field's NAME, and a
 * `custom_field` wrapper that resolves to nothing.
 *
 * `materialised:false` is the other documented state — displayed by default but
 * never given a value, id NULL — and it is the one case where create form is the
 * CORRECT write. The stub must accept create form there or it would be stingier
 * than the vendor in a direction that makes a correct write look wrong.
 */
function heldRows({ materialised = true, prefix = 'text_line', value = '' } = {}) {
  return INTAKE_CUSTOM_FIELDS.map((f, i) => ({
    id: materialised ? `${prefix}-${i + 1}` : null,
    value,
    field_name: f.name,
    custom_field: {},
  }));
}

/** A contact Clio already holds — a returning client. */
function heldContact(over = {}) {
  return {
    id: HELD_CONTACT_ID,
    first_name: 'Charlie',
    last_name: 'Chaplin',
    email_addresses: [{ id: 11, etag: 'e1', address: CLIENT_EMAIL, name: 'Work' }],
    phone_numbers: [{ id: 21, etag: 'e2', number: PHONE, name: 'Mobile' }],
    addresses: [{ id: 31, etag: 'e3', province: 'FL', country: 'USA' }],
    custom_field_values: heldRows({ prefix: 'text_line', value: 'stale' }),
    ...over,
  };
}

const CF_ROWS = INTAKE_CUSTOM_FIELDS.map((f) => ({
  id: FIELD_ID[f.key], name: f.name, field_type: f.type,
}));

/**
 * A Clio validation refusal, in the shape that makes it dangerous: IT ECHOES THE
 * RECORD IT REFUSED. That is documented vendor behaviour and it is the whole
 * reason describeClioFailure exists — the body that answers "which field did Clio
 * refuse" is the same body that carries the client's finances back out.
 *
 * Four kinds of string are planted here, one per filter the emitter has to apply:
 *
 *   · under `value` / `detail`  — DATA BY POSITION. Never read at all.
 *   · under an unknown key      — DENY BY DEFAULT. Counted, never printed.
 *   · under a known key, but a string this booking SENT — filter 3.
 *   · under a known key, a real validation sentence — the one thing that survives.
 */
function refusalBody(field, echoed) {
  return JSON.stringify({
    error: {
      type: 'ArgumentError',
      message: `Invalid argument: ${field}`,
      data: {
        [field]: echoed,
        // A sent value with no digit and no symbol in it: shape filter alone would
        // pass this, so it is filter 3 or nothing.
        reason: INTAKE.matter_category,
        // A key this module has never seen, carrying a band. Nothing sent it, so
        // filter 3 cannot catch it — the closed vocabulary is what catches it.
        analysis_summary: `${BAND_NET_WORTH} net worth, high intent`,
        // The one string that is genuinely diagnosis rather than data.
        message: 'has already been taken',
      },
    },
  });
}

/**
 * @param {object} o
 * @param {object[]} o.hold          contacts Clio already holds, unprojected.
 * @param {boolean}  o.materialised  do a FRESH contact's default rows carry ids?
 * @param {number}   o.recordStatus  status for GET /contacts/{id} (the re-read).
 * @param {number}   o.noteStatus    status for POST /notes.
 */
function stubClio({
  hold = [],
  materialised = true,
  recordStatus = 200,
  noteStatus = 200,
} = {}) {
  const seen = {
    calls: [], searches: [], records: [], contacts: [], patches: [],
    entries: [], notes: [], selections: [], refused400: [], refused422: [],
  };
  // Clio's own state. A contact created during the run is HELD from then on, so
  // "the record we just minted" and "the record we read back" are one object
  // rather than two fixtures that could disagree.
  const store = new Map(hold.map((c) => [String(c.id), c]));

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

    // REFUSAL 3. Clio's selector grammar has ONE level. Unconditional and ahead of
    // every route, so no endpoint can be the one that quietly tolerates a second.
    if (sel && selectionDepth(sel) > 1) {
      seen.refused400.push(sel);
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
      return new Response(JSON.stringify({ data: { id: ENTRY_ID } }));
    }

    if (u.startsWith(CLIO_CFIELDS) && method === 'GET') {
      seen.calls.push('cf:list');
      return new Response(JSON.stringify({
        data: CF_ROWS.map((r) => project(r, parseSelection(sel || 'id,name,field_type'))),
        meta: {},
      }));
    }

    // ── The enrichment PATCH, and REFUSAL 5 ──────────────────────────────────
    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      seen.calls.push('contact:patch');
      const body = JSON.parse(init.body);
      seen.patches.push({ url: u, body });

      const id = u.split('/').pop().split('?')[0];
      const record = store.get(String(id));
      const rows = Array.isArray(body?.data?.custom_field_values)
        ? body.data.custom_field_values
        : [];
      const held = new Map(
        (record?.custom_field_values ?? [])
          .filter((r) => r.id != null && r.id !== '')
          .map((r) => [r.field_name, r.id]),
      );

      for (const row of rows) {
        const name = NAME_BY_FIELD_ID.get(String(row?.custom_field?.id));
        const heldId = name == null ? undefined : held.get(name);
        // CREATE FORM ONTO A ROW THAT ALREADY EXISTS. This is the live 422: the
        // documentation says `custom_field{id}` with no `id` means CREATE the
        // value, and a contact that already carries one cannot be given a second
        // under the same field.
        if (row?.id == null && heldId != null) {
          seen.refused422.push({ field: name, form: 'create' });
          return new Response(refusalBody('custom_field_values', rows), { status: 422 });
        }
        // An id the contact does not carry is not an update of anything. Refused
        // for the same reason and in the same words: it addresses a row that is
        // not there.
        if (row?.id != null && row.id !== heldId) {
          seen.refused422.push({ field: name, form: 'unknown_value_id' });
          return new Response(refusalBody('custom_field_values', rows), { status: 422 });
        }
      }

      // Accepted. Apply it, so a second booking against this contact reads what
      // the first one wrote rather than the fixture.
      if (record) {
        for (const row of rows) {
          const name = NAME_BY_FIELD_ID.get(String(row?.custom_field?.id));
          const target = (record.custom_field_values ?? []).find((r) => r.field_name === name);
          if (target) target.value = row.value;
        }
        if (Array.isArray(body?.data?.addresses)) {
          record.addresses = [...(record.addresses ?? []), ...body.data.addresses];
        }
        if (Array.isArray(body?.data?.phone_numbers)) {
          record.phone_numbers = [...(record.phone_numbers ?? []), ...body.data.phone_numbers];
        }
      }
      return new Response(JSON.stringify({ data: { id } }));
    }

    // ── The two reads, told apart ────────────────────────────────────────────
    // `/contacts/{id}` answers with an OBJECT; `/contacts?query=` answers with a
    // LIST. Routing both into one branch is what made #170 invisible offline.
    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'GET') {
      seen.calls.push('contact:record');
      seen.records.push(u);
      if (recordStatus !== 200) return new Response('{}', { status: recordStatus });
      const id = u.split('/').pop().split('?')[0];
      const record = store.get(String(id));
      if (!record) return new Response('{}', { status: 404 });
      return new Response(JSON.stringify({ data: project(record, parseSelection(sel)) }));
    }

    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      seen.calls.push('contact:search');
      seen.searches.push(u);
      // Every Person on the account, projected. Clio does NOT pre-filter to the
      // exact address for us — the matcher has to read `address` off the row, and
      // reading it is only possible if the selection asked for it. That is the
      // #169 defect in one line, and pre-filtering here would hide it.
      const tree = parseSelection(sel);
      return new Response(JSON.stringify({
        data: [...store.values()].map((c) => project(c, tree)),
      }));
    }

    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      seen.calls.push('contact:create');
      seen.contacts.push(JSON.parse(init.body));
      // REFUSAL 4. A CONTACT IS NOT BORN EMPTY: Clio materialises a row for every
      // CustomField displayed by default, each with its own composite value id.
      store.set(String(NEW_CONTACT_ID), {
        id: NEW_CONTACT_ID,
        first_name: 'Charlie',
        last_name: 'Chaplin',
        email_addresses: [{ id: 12, etag: 'e4', address: CLIENT_EMAIL, name: 'Work' }],
        phone_numbers: [{ id: 22, etag: 'e5', number: PHONE, name: 'Mobile' }],
        addresses: [],
        custom_field_values: heldRows({ materialised, prefix: 'text_line' }),
      });
      return new Response(JSON.stringify({ data: { id: NEW_CONTACT_ID } }));
    }

    if (u.startsWith(CLIO_NOTES) && method === 'POST') {
      seen.calls.push('note');
      const body = JSON.parse(init.body);
      seen.notes.push(body);
      if (noteStatus !== 200) {
        return new Response(refusalBody('detail', body.data.detail), { status: noteStatus });
      }
      return new Response(JSON.stringify({ data: { id: 77 } }));
    }

    // MATCHED ON THE ORIGIN, NOT ON A PREFIX — `startsWith("https://grow.clio.com")`
    // also matches `https://grow.clio.com.example.invalid`. See
    // [[feedback_host_assertion_by_substring_passes_for_the_lookalike]].
    if (origin === 'https://grow.clio.com' || origin === 'https://vantage.ticoai.net') {
      return new Response('{"ok":true}');
    }
    throw new Error(`unstubbed fetch: ${method} ${u}`);
  });

  return { seen, store, restore: () => handle.restore() };
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

function bridgeWithQualifier(callId = CALL_ID) {
  const ns = makeDurableObject();
  ns.instance('donovan').state.set(`qual:${callId}`, { status: 'complete' });
  return ns;
}

function kvWithQualifier(over = {}, callId = CALL_ID) {
  return makeKV({
    [`qualbk:${callId}`]: JSON.stringify({
      summary: SUMMARY, intake: INTAKE, state: STATE, matter: 'real_estate', ...over,
    }),
  });
}

async function book(over = {}, envOver = {}) {
  const callId = over.call_id ?? CALL_ID;
  return onRequestPost({
    request: new Request('https://www.donovan.law/booking/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() },
      body: JSON.stringify({
        type: 'consult',
        slot: SLOT,
        name: CLIENT_NAME,
        email: CLIENT_EMAIL,
        phone: PHONE,
        call_id: callId,
        turnstile_token: 'good-token',
        ...over,
      }),
    }),
    env: envFor({
      PERCH_ACTIONS: kvWithQualifier({}, callId),
      PERCH_BRIDGE: bridgeWithQualifier(callId),
      ...envOver,
    }),
  });
}

function patchRows(seen, i = 0) {
  assert.ok(seen.patches.length > i, `an enrichment PATCH was issued (#${i + 1})`);
  const rows = seen.patches[i].body.data.custom_field_values;
  assert.ok(Array.isArray(rows), 'the PATCH carries a custom_field_values array');
  return rows;
}
const rowFor = (rows, key) => rows.find((r) => r.custom_field?.id === FIELD_ID[key]);
const entryOf = (seen) => {
  assert.equal(seen.entries.length, 1, 'exactly one calendar entry was created');
  return seen.entries[0].data;
};

/**
 * EVERY CLIENT-FACING STRING ON THE CALENDAR ENTRY, as one blob.
 *
 * Clio renders the entry into the attendee's confirmation email and the .ics from
 * these fields, so "the confirmation email text" is not a fifth surface with its
 * own rules — it is `summary` + `description` + `location` and nothing else. They
 * are joined here rather than asserted one at a time so that a band moving from
 * one field to another cannot pass by moving.
 */
function confirmationEmailText(entry) {
  return [
    entry.summary ?? '',
    entry.description ?? '',
    entry.location ?? '',
  ].join('\n');
}

let stub, mute;
beforeEach(() => { __resetIntakeFieldCache(); mute = muteConsole(); });
afterEach(() => { stub?.restore(); mute?.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// §0. THE VENDOR MODEL — fired BY HAND, so it cannot go inert
//
// Every assertion in the four sections below is only worth what this section is
// worth. A stub that quietly stopped projecting, or quietly started accepting
// create form, would turn the whole file green and prove nothing. So the model is
// exercised directly, as data, and each claim is labelled with its provenance.
// ─────────────────────────────────────────────────────────────────────────────
describe('§0 the Clio in this file is as stingy as the live grant', () => {
  test('a PLAIN sub-resource selection returns id and etag — no address, no number', () => {
    // LIVE-PROBED (#169): `fields=id,email_addresses` answered with rows shaped
    // {id, etag}. The matcher reads `.address`, so on this shape it lower-cased
    // `undefined` on every row and the firm's CRM forked once per booking.
    const got = project(heldContact(), parseSelection('id,email_addresses,phone_numbers,addresses'));

    assert.deepEqual(Object.keys(got.email_addresses[0]).sort(), ['etag', 'id'],
      'id and etag, exactly what was read off the live grant');
    assert.equal(got.email_addresses[0].address, undefined, 'no `address` on a plain selection');
    assert.equal(got.phone_numbers[0].number, undefined, 'no `number` either');
    assert.equal(got.addresses[0].province, undefined, 'and no `province`');
    assert.equal(got.addresses[0].country, undefined, 'and no `country`');
  });

  test('a PLAIN custom_field_values selection cannot attribute a single row', () => {
    // LIVE-PROBED (PR 163): the rows carry `id` and `value` and nothing that ties
    // them to a field. That is why the existing-value index is built on
    // `field_name` and why the selection has to ask for it.
    const got = project(heldContact(), parseSelection('id,custom_field_values'));
    assert.deepEqual(Object.keys(got.custom_field_values[0]).sort(), ['id', 'value']);
    assert.equal(got.custom_field_values[0].field_name, undefined,
      'nothing here names the field — a reader on this shape indexes nothing');
  });

  test('SUB-SELECTED, the same rows carry the property their reader reads', () => {
    // The other half of the claim. A model that returned nothing on every
    // selection would red the suite for the wrong reason.
    const sel = 'id,email_addresses{address},phone_numbers{number},'
              + 'addresses{province,country},custom_field_values{id,value,field_name}';
    const got = project(heldContact(), parseSelection(sel));
    assert.equal(got.email_addresses[0].address, CLIENT_EMAIL);
    assert.equal(got.phone_numbers[0].number, PHONE);
    assert.equal(got.addresses[0].province, 'FL');
    assert.equal(got.addresses[0].country, 'USA');
    assert.equal(got.custom_field_values[0].field_name, INTAKE_CUSTOM_FIELDS[0].name);
  });

  test('NEVER MORE GENEROUS: no key comes back that the selection did not ask for', () => {
    // The invariant behind the whole file, stated once over a record carrying
    // every property. A future edit that adds a permissive fallback to `project`
    // reds here rather than silently re-arming the defect three suites away.
    const record = heldContact();
    const sel = 'id,email_addresses{address}';
    const got = project(record, parseSelection(sel));

    assert.deepEqual(Object.keys(got).sort(), ['email_addresses', 'id'],
      'first_name, phone_numbers, addresses and custom_field_values were not asked for');
    assert.deepEqual(Object.keys(got.email_addresses[0]), ['address'],
      'and inside the sub-resource, only the property named');
  });

  test('a second-level selector is an unconditional 400, on BOTH contact endpoints', async () => {
    // LIVE-PROBED (PR 163): Clio's selector grammar has one level, so
    // `custom_field{id}` can never succeed — which is why attribution is by name.
    stub = stubClio({ hold: [heldContact()] });
    const bad = encodeURIComponent('id,custom_field_values{id,value,custom_field{id}}');

    assert.equal((await fetch(`${CLIO_CONTACTS}?query=x&fields=${bad}`)).status, 400);
    assert.equal((await fetch(`${CLIO_CONTACTS}/${HELD_CONTACT_ID}?fields=${bad}`)).status, 400);
    assert.equal(stub.seen.refused400.length, 2, 'both refusals are recorded, not absorbed');
  });

  test('the record read answers an OBJECT and the search answers a LIST', async () => {
    stub = stubClio({ hold: [heldContact()] });
    const sel = encodeURIComponent('id,custom_field_values{id,value,field_name}');

    const record = await (await fetch(`${CLIO_CONTACTS}/${HELD_CONTACT_ID}?fields=${sel}`)).json();
    assert.equal(Array.isArray(record.data), false, 'a single record is not a list');
    assert.equal(record.data.id, HELD_CONTACT_ID);

    const search = await (await fetch(`${CLIO_CONTACTS}?query=x&fields=${sel}`)).json();
    assert.ok(Array.isArray(search.data), 'the search is a list');
  });

  test('a FRESH contact already carries a row per Intake field, each with its own id', async () => {
    // VENDOR-DOCUMENTED and the premise #170 rests on. If a new contact really
    // were empty, create form would be correct on that path and §1 would be
    // asserting the wrong thing — so the premise is an assertion, not a comment.
    stub = stubClio();
    await fetch(CLIO_CONTACTS, { method: 'POST', body: '{"data":{}}' });

    const sel = encodeURIComponent('id,custom_field_values{id,value,field_name}');
    const { data } = await (await fetch(`${CLIO_CONTACTS}/${NEW_CONTACT_ID}?fields=${sel}`)).json();

    assert.equal(data.custom_field_values.length, INTAKE_CUSTOM_FIELDS.length);
    for (const r of data.custom_field_values) {
      assert.ok(r.id, 'a materialised row carries its composite value id');
      assert.ok(r.field_name, 'and names the field it belongs to');
    }
  });

  test('THE REFUSAL THAT MAKES THIS FILE SELF-ENFORCING: create form onto an existing row is 422', async () => {
    // LIVE-OBSERVED. This is the Charlie Chaplin 422 itself. Fired by hand so the
    // guard cannot go inert: if this ever stops refusing, §1 and §2 stop proving
    // that the write is in update form and start proving nothing at all.
    stub = stubClio({ hold: [heldContact()] });

    const createForm = {
      data: {
        custom_field_values: [
          { value: BAND_INCOME, custom_field: { id: FIELD_ID.income_band } },
        ],
      },
    };
    const res = await fetch(`${CLIO_CONTACTS}/${HELD_CONTACT_ID}`, {
      method: 'PATCH', body: JSON.stringify(createForm),
    });

    assert.equal(res.status, 422, 'a create-form row for a value the contact already holds');
    assert.equal(stub.seen.refused422.length, 1);
    assert.equal(stub.seen.refused422[0].form, 'create');
  });

  test('and the SAME row in update form is accepted', async () => {
    // The control. A stub that refused everything would green §1 and §2 by
    // accident — this is what tells "refuses create form" apart from "refuses".
    stub = stubClio({ hold: [heldContact()] });
    const updateForm = {
      data: {
        custom_field_values: [
          { id: 'text_line-4', value: BAND_INCOME, custom_field: { id: FIELD_ID.income_band } },
        ],
      },
    };
    const res = await fetch(`${CLIO_CONTACTS}/${HELD_CONTACT_ID}`, {
      method: 'PATCH', body: JSON.stringify(updateForm),
    });
    assert.equal(res.status, 200);
    assert.equal(stub.seen.refused422.length, 0);
  });

  test('a NON-materialised row (id NULL) must still take create form — the vendor does', async () => {
    // The stub is stingy, not hostile. Clio documents `id: NULL` as "displayed by
    // default but never given a value", and instructs the create form for exactly
    // that case. Refusing it here would make a CORRECT write look like a defect.
    stub = stubClio({ hold: [heldContact({ custom_field_values: heldRows({ materialised: false }) })] });
    const res = await fetch(`${CLIO_CONTACTS}/${HELD_CONTACT_ID}`, {
      method: 'PATCH',
      body: JSON.stringify({
        data: {
          custom_field_values: [
            { value: BAND_INCOME, custom_field: { id: FIELD_ID.income_band } },
          ],
        },
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(stub.seen.refused422.length, 0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §1. THE CREATE PATH — a client Clio has never held
//
// Guards #170. The create branch used to build the enrichment's `found` shim from
// the create BODY, which carries no custom fields by design, so the existing-value
// index was empty and all seven rows went out in create form onto a contact that
// already carried a materialised row for each. Live: 422.
// ─────────────────────────────────────────────────────────────────────────────
describe('§1 the create path writes the seven self-reported fields in UPDATE form', () => {
  test('the contact it just minted is read back, by id, with the search selection', async () => {
    stub = stubClio();
    assert.equal((await book()).status, 201);

    assert.equal(stub.seen.contacts.length, 1, 'exactly one contact created');
    assert.equal(stub.seen.records.length, 1, 'and it was read back exactly once');
    assert.match(stub.seen.records[0], new RegExp(`/contacts/${NEW_CONTACT_ID}\\?`),
      'the read addresses the contact we just minted');

    const fields = decodeURIComponent(new URL(stub.seen.records[0]).searchParams.get('fields'));
    assert.match(fields, /custom_field_values\{[^}]*\bid\b[^}]*\}/,
      'the re-read asks for the value id — without it there is nothing to update in place');
    assert.match(fields, /custom_field_values\{[^}]*field_name[^}]*\}/,
      'a read that does not ask for field_name cannot attribute a single row');
    assert.equal(selectionDepth(fields), 1, 'and it stays inside the one level Clio has');
    assert.equal(stub.seen.refused400.length, 0, 'nothing was refused for its selection');
  });

  test('THE REGRESSION: all seven rows carry the value id the fresh contact already holds', async () => {
    stub = stubClio({ materialised: true });
    assert.equal((await book()).status, 201);

    const rows = patchRows(stub.seen);
    assert.equal(rows.length, 7, 'one value per self-reported intake field');

    const idByName = new Map(heldRows().map((r) => [r.field_name, r.id]));
    for (const f of INTAKE_CUSTOM_FIELDS) {
      const row = rowFor(rows, f.key);
      assert.ok(row, `${f.name} is on the PATCH`);
      assert.equal(row.value, INTAKE[f.key], `${f.name} carries the answer the caller gave`);
      assert.equal(row.id, idByName.get(f.name),
        `${f.name} must UPDATE the row the new contact already carries, not create a second`);
    }

    assert.equal(rows.filter((r) => r.id == null).length, 0,
      'ZERO create-form rows — an empty existing-value index writes seven of them');
  });

  test('and the vendor ACCEPTED it — no 422, and nothing warned about the enrichment', async () => {
    // The behavioural half. The assertion above reads the body we sent; this one
    // reads what Clio did with it, which is the fact that failed live.
    stub = stubClio({ materialised: true });
    assert.equal((await book()).status, 201);

    assert.deepEqual(stub.seen.refused422, [], 'the enrichment PATCH was not refused');
    assert.equal(mute.saw('contact enrichment not applied'), false,
      'and no failure line was emitted for it');
  });

  test('the values actually land on the contact Clio holds afterwards', async () => {
    // End of the write, not the middle of it. A PATCH that is well-formed and
    // discarded looks identical to a PATCH that worked, from the request side.
    stub = stubClio({ materialised: true });
    assert.equal((await book()).status, 201);

    const record = stub.store.get(String(NEW_CONTACT_ID));
    for (const f of INTAKE_CUSTOM_FIELDS) {
      const row = record.custom_field_values.find((r) => r.field_name === f.name);
      assert.equal(row.value, INTAKE[f.key], `${f.name} is on the contact afterwards`);
    }
  });

  test('CONTROL: when the re-read fails, the rows degrade to create form and the vendor 422s', async () => {
    // The proof that §1 is not vacuous. Production documents this degradation
    // explicitly — every re-read failure keeps the empty array and writes create
    // form, which is exactly the pre-#170 behaviour. So this is the old code path,
    // reachable without touching production, and the vendor refuses it.
    //
    // The booking still succeeds: the enrichment is best-effort by contract and a
    // rejected PATCH must never cost a client their confirmed appointment.
    stub = stubClio({ materialised: true, recordStatus: 500 });
    assert.equal((await book()).status, 201, 'the appointment survives a rejected enrichment');

    const rows = patchRows(stub.seen);
    assert.equal(rows.filter((r) => r.id == null).length, 7, 'all seven went out in create form');
    assert.equal(stub.seen.refused422.length, 1, 'and Clio refused them');
    assert.equal(stub.seen.refused422[0].form, 'create');
    assert.ok(mute.saw('created contact not re-read'),
      'the lost re-read says so in its own words rather than looking like an empty contact');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2. THE UPDATE PATH — a returning client
//
// Guards #169 (the search matches, so the CRM does not fork) and #167 (the rows
// the search returned are addressed by name, so the write is update form).
// ─────────────────────────────────────────────────────────────────────────────
describe('§2 the update path reuses the contact Clio already holds', () => {
  test('THE DEDUPE REGRESSION: zero contacts created, and the held one is reused', async () => {
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book()).status, 201);

    // ANCHORED ON THE CREATE COUNT FIRST. A dedupe assertion written the other way
    // round — "the PATCH addresses the held id" — passes vacuously if the lookup
    // creates and then patches what it created.
    // See [[feedback_a_dedupe_guard_test_passes_vacuously_when_the_lookup_creates]].
    assert.equal(stub.seen.contacts.length, 0, 'NO contact was created — the CRM did not fork');
    assert.equal(stub.seen.records.length, 0, 'and no re-read: that is the create path only');
    assert.equal(stub.seen.patches.length, 1, 'exactly one enrichment PATCH');
    assert.match(stub.seen.patches[0].url, new RegExp(`/contacts/${HELD_CONTACT_ID}(\\?|$)`),
      'and it addresses the contact Clio already held');

    const entry = entryOf(stub.seen);
    assert.equal(entry.attendees[0].id, HELD_CONTACT_ID,
      'the attendee is the reused contact — a fork would still have emailed the client');
  });

  test('the search sub-selects `address`, which is the only reason it can match', async () => {
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book()).status, 201);

    assert.equal(stub.seen.searches.length, 1, 'one search — it answered on the first attempt');
    const fields = decodeURIComponent(new URL(stub.seen.searches[0]).searchParams.get('fields'));
    assert.match(fields, /email_addresses\{[^}]*address[^}]*\}/,
      'a plain `email_addresses` returns {id, etag} and matches nobody');
    assert.equal(selectionDepth(fields), 1);
  });

  test('every row is written in UPDATE form, against the ids the search returned', async () => {
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book()).status, 201);

    const rows = patchRows(stub.seen);
    const idByName = new Map(heldRows().map((r) => [r.field_name, r.id]));
    for (const f of INTAKE_CUSTOM_FIELDS) {
      const row = rowFor(rows, f.key);
      assert.ok(row, `${f.name} is on the PATCH`);
      assert.equal(row.value, INTAKE[f.key]);
      assert.equal(row.id, idByName.get(f.name),
        `${f.name} updates the row in place — omitting the id appends a SECOND answer`);
    }
    assert.deepEqual(stub.seen.refused422, [], 'the vendor accepted the whole body');
  });

  test('the returning client keeps one row per field, carrying the CURRENT answer', async () => {
    // What a booking is FOR, read off the contact. Append-instead-of-update shows
    // up here as fourteen rows, and the lawyer cannot tell which band is current.
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book()).status, 201);

    const record = stub.store.get(String(HELD_CONTACT_ID));
    assert.equal(record.custom_field_values.length, INTAKE_CUSTOM_FIELDS.length,
      'seven rows, not fourteen');
    for (const f of INTAKE_CUSTOM_FIELDS) {
      const row = record.custom_field_values.find((r) => r.field_name === f.name);
      assert.equal(row.value, INTAKE[f.key], `${f.name} is the answer from THIS booking`);
    }
  });

  test('an existing phone and an existing address are not re-appended', async () => {
    // The other two sub-resources the plain-selection trap hit. Both guards read a
    // property that a plain selection does not return, so both answered "no"
    // unconditionally and re-appended on every booking.
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book()).status, 201);

    const body = stub.seen.patches[0].body.data;
    assert.equal(body.phone_numbers, undefined, 'the number Clio already holds is not appended');
    assert.equal(body.addresses, undefined, 'nor the province it already holds');

    const record = stub.store.get(String(HELD_CONTACT_ID));
    assert.equal(record.phone_numbers.length, 1);
    assert.equal(record.addresses.length, 1);
  });

  test('two bookings by the same client produce ONE contact', async () => {
    // The live symptom was three Bobby Browns, so the regression is stated the way
    // the firm saw it. The second booking must find what the first one wrote.
    stub = stubClio({ hold: [] });
    assert.equal((await book({ call_id: 'call_wpregress000001' })).status, 201);
    assert.equal((await book({ call_id: 'call_wpregress000002' })).status, 201);

    assert.equal(stub.seen.contacts.length, 1, 'one create across two bookings');
    assert.equal(stub.store.size, 1, 'and Clio holds exactly one Person for this email');
    assert.deepEqual(stub.seen.refused422, [], 'neither booking was refused');

    const second = patchRows(stub.seen, 1);
    assert.equal(second.filter((r) => r.id == null).length, 0,
      'the second booking updates in place — it does not append a second set of answers');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3. THE LEAK INVARIANT, END TO END
//
// The bands are the REQUIREMENT on the contact and the note, and a LEAK anywhere
// the client can read. Both halves are asserted together: a "no bands in the
// email" test that passes because nothing was written at all is worse than no
// test, because it reports the leak closed and the feature broken as a pass.
// ─────────────────────────────────────────────────────────────────────────────
describe('§3 the bands reach the contact and the note, and no client-facing surface', () => {
  test('POSITIVE HALF: the bands are on the contact PATCH and on the intake note', async () => {
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book()).status, 201);

    const rows = patchRows(stub.seen);
    assert.equal(rowFor(rows, 'income_band').value, BAND_INCOME,
      'the income band is written to the lawyer-only contact record');
    assert.equal(rowFor(rows, 'net_worth_band').value, BAND_NET_WORTH);

    assert.equal(stub.seen.notes.length, 1, 'the intake note was written');
    const detail = stub.seen.notes[0].data.detail;
    assert.ok(detail.includes(BAND_INCOME), 'and it carries the full qualifier block');
    assert.ok(detail.includes(BAND_NET_WORTH));
    assert.equal(stub.seen.notes[0].data.contact.id, HELD_CONTACT_ID,
      'attached to the contact — a Note on a contact is not emailed to it');
  });

  test('NEGATIVE HALF: description, summary, location and the email text carry no band', async () => {
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book()).status, 201);

    const entry = entryOf(stub.seen);

    // The email surface must EXIST, or the assertion below is about nothing.
    assert.equal(entry.send_email_notification, true, 'Clio is asked to email the attendee');
    assert.ok(entry.attendees?.length, 'and there is an attendee to email');

    const text = confirmationEmailText(entry);
    for (const s of FORBIDDEN) {
      assert.ok(!entry.description.includes(s), `"${s}" reached the description`);
      assert.ok(!entry.summary.includes(s), `"${s}" reached the summary`);
      assert.ok(!String(entry.location ?? '').includes(s), `"${s}" reached the location`);
      assert.ok(!text.includes(s), `"${s}" reached the client's confirmation email`);
    }

    assert.equal(entry.location, MEETING_LINK, 'the location is the firm-configured room');
    assert.ok(entry.summary.includes(CLIENT_NAME),
      'the summary carries the client\'s own name by design — it is theirs, not a band');
  });

  test('DYNAMIC MEETING: the same holds when Clio mints the room', async () => {
    // No BOOKING_MEETING_LINK ⇒ conference_meeting and NO location. A surface that
    // is only clean in one of two configurations is one deploy away from leaking.
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book({}, { BOOKING_MEETING_LINK: '' })).status, 201);

    const entry = entryOf(stub.seen);
    assert.equal(entry.location, undefined, 'no static location in dynamic mode');
    assert.deepEqual(entry.conference_meeting, { type: 'zoom' });
    for (const s of FORBIDDEN) {
      assert.ok(!confirmationEmailText(entry).includes(s), `"${s}" reached the client`);
    }
  });

  test('HOSTILE INPUT: bands typed into the caller-controlled fields stay out', async () => {
    // The "by any path" clause. `notes` is free text the caller controls and it
    // reaches Grow, Vantage and the KV record — none of them client-facing — so
    // the question is only ever whether it can reach the entry.
    //
    // `name` is deliberately NOT poisoned: the summary carries the caller's own
    // name by design, so poisoning it would assert that a client must not be shown
    // what they typed as their name, which is not the invariant.
    const poison = `${BAND_INCOME} / ${BAND_NET_WORTH} / income_band net_worth_band`;
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book({ notes: poison })).status, 201);

    const entry = entryOf(stub.seen);
    for (const s of FORBIDDEN) {
      assert.ok(!confirmationEmailText(entry).includes(s),
        `"${s}" reached the client through caller-controlled input`);
    }
  });

  test('CONTROL: the check is not vacuous — the pre-fix description shape trips it', async () => {
    // Without this, every "no bands" assertion above could be passing because the
    // check itself is broken. The old shape bundled the qualifier summary into the
    // description; run it through the same predicate.
    // See [[feedback_concurrency_test_needs_the_broken_control]].
    const safe = buildClientDescription({
      typeName: 'Initial Consultation',
      meetingLink: MEETING_LINK,
      firmPhone: '(561) 555-0100',
      firmEmail: 'info@donovan.law',
    });
    const oldShape = `${safe}\n\n${SUMMARY}`;

    const leaked = FORBIDDEN.filter((s) => oldShape.includes(s));
    assert.ok(leaked.length >= 3, 'the pre-fix description must trip this check');
    assert.deepEqual(FORBIDDEN.filter((s) => safe.includes(s)), [],
      'and the shipped builder must not');
  });

  test('the description builder has no parameter a band could arrive through', async () => {
    // The structural half of the guarantee. Extra properties are ignored rather
    // than appended, so the claim is about the signature and not about call sites.
    const desc = buildClientDescription({
      typeName: 'Initial Consultation',
      meetingLink: MEETING_LINK,
      firmPhone: '(561) 555-0100',
      firmEmail: 'info@donovan.law',
      notes: SUMMARY,
      intakeSummary: SUMMARY,
      income_band: BAND_INCOME,
      net_worth_band: BAND_NET_WORTH,
    });
    for (const s of FORBIDDEN) assert.ok(!desc.includes(s), `"${s}" was appended`);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4. NAMES-ONLY LOGGING ON A NON-2xx
//
// The body that answers "which field did Clio refuse" is the body that echoes the
// client's finances back. A diagnostic that prints it is a leak wearing a
// diagnostic's clothes — so the emitter allow-lists what it may name and COUNTS
// what it refuses. See [[feedback_a_failure_body_that_answers_the_question_also_echoes_the_client]].
// ─────────────────────────────────────────────────────────────────────────────
describe('§4 a value-bearing failure body logs names and messages, never a value', () => {
  test('a refused enrichment PATCH names the field and prints no answer', async () => {
    // Driven end to end: the re-read fails, the rows degrade to create form, and
    // the vendor answers 422 with the client's seven answers in the body.
    stub = stubClio({ materialised: true, recordStatus: 500 });
    assert.equal((await book()).status, 201);

    const line = mute.lines.map(([, m]) => m)
      .find((m) => m.includes('contact enrichment not applied: HTTP 422'));
    assert.ok(line, 'the refusal is reported at all');

    assert.match(line, /clio_fields=[^ ]*custom_field_values/,
      'it NAMES the field Clio refused — a bare "HTTP 422" cannot tell a rejected '
      + 'FORM from a rejected VALUE, which is the whole question');
    const messages = line.split('clio_messages=')[1].split(' clio_redacted=')[0];
    assert.ok(messages.includes('has already been taken'),
      'and carries the validation sentence, which is diagnosis rather than data');
    assert.match(line, /clio_redacted=[1-9]/,
      'what it refused to print is COUNTED — silence and refusal must not look alike');
    assert.match(line, /clio_unnamed_keys=[1-9]/,
      'and a key outside the closed vocabulary is counted, never printed');
  });

  test('NOT ONE VALUE reaches ANY line of the console on that booking', async () => {
    // Asserted over every captured line rather than the one we expect to find. A
    // leak that arrives through a different warn is the same leak.
    stub = stubClio({ materialised: true, recordStatus: 500 });
    assert.equal((await book()).status, 201);

    const all = mute.lines.map(([, m]) => m).join('\n');
    for (const s of [...FORBIDDEN, INTAKE.matter_category, INTAKE.for_whom, INTAKE.source]) {
      assert.ok(!all.includes(s), `"${s}" reached the log`);
    }
    assert.ok(!all.includes(CLIENT_EMAIL), 'nor the client\'s email address');
    assert.ok(!all.includes(PHONE), 'nor their phone number');
    assert.ok(!/\$\d/.test(all), 'nor any currency figure');
  });

  test('a refused NOTE write — the most value-dense body in the module — leaks nothing', async () => {
    // The note detail is the whole intake: the typed notes, the phone, the email
    // and the qualifier block with both bands. Its refusal body echoes it back.
    stub = stubClio({ hold: [heldContact()], noteStatus: 422 });
    assert.equal((await book()).status, 201, 'a rejected note never fails a confirmed booking');

    const all = mute.lines.map(([, m]) => m).join('\n');
    assert.ok(all.includes('intake note not written: HTTP 422'), 'the refusal is reported');
    for (const s of [...FORBIDDEN, INTAKE.for_whom, INTAKE.source]) {
      assert.ok(!all.includes(s), `"${s}" reached the log through the note refusal`);
    }
    assert.ok(!all.includes(stub.seen.notes[0].data.detail.slice(0, 40)),
      'no fragment of the detail was echoed');
  });

  test('the emitter is deny-by-default: shapes a booking cannot reach', () => {
    // Driving these through a booking is impossible — no Clio answers an empty
    // body and a non-JSON body on the same call — so they are asserted directly on
    // the exported function, which is why it is exported.
    assert.equal(describeClioFailure('', {}), 'clio_body=empty');
    assert.equal(describeClioFailure('<html>500</html>', {}), 'clio_body=unparseable',
      'the bytes are described, never printed');

    // A value under an UNKNOWN key: nothing sent it, so only the closed vocabulary
    // can catch it.
    const unknown = describeClioFailure(
      JSON.stringify({ retell_analysis: { sentiment: BAND_NET_WORTH } }), {},
    );
    assert.ok(!unknown.includes(BAND_NET_WORTH), 'an unrecognised key is never printed');
    assert.match(unknown, /clio_unnamed_keys=[1-9]/);

    // A value under a KNOWN key that we SENT: the shape filter alone would pass it.
    const sent = { data: { custom_field_values: [{ value: INTAKE.matter_category }] } };
    const echoed = describeClioFailure(
      JSON.stringify({ error: { reason: INTAKE.matter_category } }), sent,
    );
    assert.ok(!echoed.includes(INTAKE.matter_category),
      'a sent value coming back under a legal key is still refused');
    assert.match(echoed, /clio_redacted=[1-9]/, 'and counted');
  });
});
