// ── ORDER SHELDON-DEDUPE-SELECTION-FIX-AND-INTAKE-DIAG-R2 · issues #154, #153 ──
//
// THE FIRM'S CRM FORKED ON EVERY BOOKING. Three Bobby Brown contacts, one per
// booking, each with the same email address. Nothing errored, nothing alerted, and
// the client got their confirmation email every time — because the duplicate
// carries the attendee, so from the outside a duplicate looks exactly like success.
//
// ── THE MECHANISM, AND WHY IT IS A ONE-WORD BUG ──────────────────────────────
//
// `searchContactByEmail` asked Clio for `fields=id,…,email_addresses` — the
// sub-resource named PLAINLY. Elroy probed the live grant read-only:
//
//   id,email_addresses            rows shaped {id, etag} · NO `address` anywhere
//   id,email_addresses{address}   the real address · matches contact 2413664198
//
// The matcher lower-cases `row.address` and compares it to the target email. On the
// plain selection that property does not exist, so it lower-cased `undefined` on
// every candidate row, matched nothing, and returned `{conclusive:true, contact:null}`.
//
// That is the worst possible failure shape. It is not an error and it is not the
// inconclusive state PR 138 built to fail closed — it is a CONFIDENT NOT-FOUND. A
// 200 carrying a well-formed array of rows is precisely what "Clio answered, and it
// holds nobody" looks like, so `findOrCreateContact` took the create branch it is
// supposed to take, with no warning, forever.
//
// The same plain-selection trap hit the other two sub-resources the update path
// reads: `phone_numbers` (read for `.number`) and `addresses` (read for `.province`
// and `.country`). Both existence guards therefore answered "no" unconditionally,
// and a phone and an address were re-appended on every booking.
//
// `custom_field_values` was the ONE selection already sub-selected — and it is the
// one thing that worked. That is the whole shape of the bug in a sentence.
//
// ── WHY 1661 GREEN TESTS DID NOT SEE ANY OF IT ───────────────────────────────
//
// Because every contact stub in this suite is MORE GENEROUS THAN THE VENDOR. They
// hand back a whole contact object regardless of what `fields=` asked for, so the
// production selection and the fixed one are indistinguishable to them — the defect
// and its fix both pass. `clio-intake-write.test.mjs` closed exactly this hole for
// `custom_field_values` and deliberately declined to model the other three, on the
// stated ground that "inventing a default for a sub-resource nobody has read back is
// the same over-claiming that produced the defect". That was the right call then and
// it is what Elroy's probe has now answered.
// See [[feedback_a_stub_more_generous_than_the_vendor_hides_the_defect]].
//
// SO THE CLIO IN THIS FILE IS AS STINGY AS THE REAL ONE, and the stinginess is
// FIRED BY HAND below so it cannot go inert. A stub that quietly stopped projecting
// would make every assertion in this file vacuous.
//
// ── PROVENANCE OF THE VENDOR MODEL, STATED RATHER THAN IMPLIED ───────────────
//   · email_addresses plain ⇒ {id, etag}   — LIVE-PROBED by Elroy on this grant.
//   · phone_numbers / addresses plain      — NOT probed. Modelled by the same rule,
//     which is the direction that cannot make an assertion here pass falsely: a
//     stingier vendor can only ever red a test the real one would let through.
//   · custom_field_values plain ⇒ {id,value} — probed in PR 163 (issue #153).

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import { __resetIntakeFieldCache } from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import { SELF_REPORTED_KEYS } from '../donovan-legal-site/functions/booking/_lib/intake-policy.js';
import { stubFetch, muteConsole, makeKV, makeDurableObject } from './helpers/stubs.mjs';

const SITEVERIFY    = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES  = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS  = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES    = 'https://app.clio.com/api/v4/notes';

const PROVIDER = 'donovan-legal-site/functions/booking/_lib/provider-clio.js';

// The live contact Elroy matched, and the shape of the live duplicates.
const HELD_CONTACT_ID = 2413664198;
const CLIENT_EMAIL    = 'bobby.brown@example.com';
const PHONE_FIRST     = '(561) 555-0142';
const PHONE_SECOND    = '(561) 555-0199';

// ── The stingy Clio ──────────────────────────────────────────────────────────

/** `id,email_addresses{address}` → {id:null, email_addresses:{address:null}} */
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
 * What each sub-resource comes back as when it is named PLAINLY.
 *
 * This table IS the bug. Every entry is identity-and-bookkeeping only: not one of
 * them carries the property its reader in provider-clio.js goes on to read.
 */
const PLAIN_SUBSELECTION = {
  email_addresses:     { id: null, etag: null },   // live-probed: no `address`
  phone_numbers:       { id: null, etag: null },   // no `number`
  addresses:           { id: null, etag: null },   // no `province`, no `country`
  custom_field_values: { id: null, value: null },  // no `field_name`
};

/** Project a row through a selection tree — at EVERY level, like the vendor. */
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
 * A Clio that HOLDS CONTACTS, so a duplicate is a thing that happens rather than a
 * thing asserted about a request count.
 *
 * The search returns every held Person whose email CONTAINS the query, plus — via
 * the decoy below — at least one whose email merely looks similar. The vendor
 * deliberately does NOT do the exact match: narrowing the candidate list to the one
 * right answer is the job of the code under test, and a stub that did it would pass
 * on `main` for the wrong reason.
 */
/**
 * @param {object}  [o]
 * @param {object[]} [o.hold]      the Persons this Clio already holds
 * @param {boolean} [o.refuseEnriched]
 *        Answer 400 to the RICH selection, so the fallback rung is the one that runs.
 *        SHELDON-154-CLIO-DEDUP: the floor is the whole reason the phone leg needs a
 *        selection of its own, and a floor nothing ever drives onto is a claim.
 * @param {number}  [o.phoneSearchStatus]
 *        The status every PHONE search answers with. The email leg is untouched, so
 *        the fail-closed test below exercises the second search failing AFTER the
 *        first one succeeded — which is the only way it happens live.
 */
function stubClio({ hold = [], refuseEnriched = false, phoneSearchStatus = 200 } = {}) {
  const contacts = hold.map((c) => JSON.parse(JSON.stringify(c)));
  let nextId = 9000001;

  const seen = {
    searches: [], creates: [], patches: [], entries: [], notes: [],
    /** Every `fields=` selection that reached the vendor, in order. */
    selections: [],
    /** The response bodies the vendor actually SERVED — the wire, not a guess. */
    served: [],
    /** Requests the vendor REFUSED, so a 400 cannot pass for an answer. */
    refused: [],
  };

  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    let sel = '';
    try { sel = new URL(u).searchParams.get('fields') ?? ''; } catch (_) { /* not a URL we parse */ }
    if (sel) seen.selections.push(sel);

    // THE VENDOR'S REFUSAL. Clio's selector grammar has one level. Unconditional and
    // ahead of every other branch, so no future selection can smuggle a second level
    // past it and read as a pass.
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
      seen.entries.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 4981729058 } }));
    }

    if (u.startsWith(CLIO_CFIELDS) && method === 'GET') {
      return new Response(JSON.stringify({ data: [], meta: {} }));
    }

    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      const id = Number(new URL(u).pathname.split('/').pop());
      const body = JSON.parse(init.body);
      seen.patches.push({ id, body });
      // Apply it, the way a PATCH array of operations does: a member with no `id`
      // APPENDS. That is what makes a re-appended phone visible as a second row
      // rather than as an assertion about request counts.
      const rec = contacts.find((c) => c.id === id);
      if (rec) {
        for (const k of ['phone_numbers', 'addresses', 'custom_field_values']) {
          if (Array.isArray(body.data[k])) rec[k] = [...(rec[k] ?? []), ...body.data[k]];
        }
        for (const k of ['first_name', 'last_name']) {
          if (body.data[k]) rec[k] = body.data[k];
        }
      }
      return new Response(JSON.stringify({ data: { id } }));
    }

    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      const q = String(new URL(u).searchParams.get('query') ?? '').toLowerCase();
      seen.searches.push({ url: u, fields: sel, query: q });

      // The rich selection is the only one that asks for `web_sites`, so it is what
      // identifies it — no second copy of the selection string to drift.
      if (refuseEnriched && sel.includes('web_sites')) {
        seen.refused.push(sel);
        return new Response('{"error":{"type":"ArgumentError"}}', { status: 400 });
      }
      // A search whose query carries no `@` is the phone leg asking.
      if (phoneSearchStatus !== 200 && !q.includes('@')) {
        return new Response('{"error":{"type":"InternalError"}}', { status: phoneSearchStatus });
      }
      // `query` is a WILDCARD OVER THE STORED STRING, across several fields. The
      // vendored contract (integrations/clio/openapi.v4.json, GET /contacts.json)
      // spells the parameter out: "Wildcard search for name, title, email address,
      // address, phone number, web site, instant messenger address, custom fields,
      // related matter name, or company name".
      //
      // SHELDON-154-CLIO-DEDUP models the PHONE arm of that, and models it as the
      // substring search it actually is — NOT as a normalised comparison. A stub that
      // matched `5615550142` against a stored `(561) 555-0142` would be inventing a
      // lookup Clio does not offer, and every phone-dedupe assertion below would then
      // be proving a capability the live grant does not have. Stingy, like the rest of
      // this file: the vendor here can only ever fail to find what the real one finds.
      const rows = contacts.filter((c) =>
        (c.email_addresses ?? []).some(
          (e) => String(e.address ?? '').toLowerCase().includes(q),
        ) ||
        (c.phone_numbers ?? []).some(
          (p) => String(p.number ?? '').toLowerCase().includes(q),
        ));
      const body = { data: rows.map((r) => project(r, parseSelection(sel))) };
      seen.served.push(body);
      return new Response(JSON.stringify(body));
    }

    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      const body = JSON.parse(init.body);
      const rec = { id: (nextId += 1), ...body.data };
      contacts.push(rec);
      seen.creates.push({ id: rec.id, body });
      return new Response(JSON.stringify({ data: { id: rec.id } }));
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

  return { seen, contacts, restore: () => handle.restore() };
}

/** The contact Clio already holds, as the live grant stores it. */
function heldContact(over = {}) {
  return {
    id: HELD_CONTACT_ID,
    first_name: 'Bobby',
    last_name: 'Brown',
    email_addresses: [{ id: 11, etag: 'e1', address: CLIENT_EMAIL, name: 'Work' }],
    phone_numbers: [{ id: 21, etag: 'e2', number: PHONE_FIRST, name: 'Mobile' }],
    addresses: [],
    custom_field_values: [],
    ...over,
  };
}

/**
 * A second Person whose email merely CONTAINS the query.
 *
 * Clio's `query` is a substring search, so this row comes back on the same page as
 * the real one. It exists so that "the code found the contact" cannot be satisfied
 * by taking `data[0]` — the matcher has to actually compare addresses.
 */
function decoyContact() {
  return {
    id: 7000007,
    first_name: 'Roberta',
    last_name: 'Brownstein',
    email_addresses: [{ id: 12, etag: 'e3', address: `not-${CLIENT_EMAIL}`, name: 'Work' }],
    phone_numbers: [],
    addresses: [],
    custom_field_values: [],
  };
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
    BOOKING_MEETING_LINK: 'https://meet.donovan.law/consult',
    ...over,
  };
}

function futureMondaySlot(weeksOut = 1) {
  const d = new Date(Date.now() + weeksOut * 7 * 86400_000);
  d.setUTCHours(14, 0, 0, 0);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

let _ipSeq = 0;
const nextIp = () => `198.51.100.${(_ipSeq += 1) % 250}`;

async function book({ phone = PHONE_FIRST, weeksOut = 1, env = {}, ...over } = {}) {
  // `env` is layered UNDER the defaults by assignment rather than by spread, so a
  // caller can hand in a binding whose getter throws (see path 3) without this
  // helper being the thing that trips it.
  const resolvedEnv = Object.create(
    Object.getPrototypeOf(env),
    Object.getOwnPropertyDescriptors(env),
  );
  for (const [k, v] of Object.entries(envFor())) {
    if (!Object.prototype.hasOwnProperty.call(resolvedEnv, k)) resolvedEnv[k] = v;
  }
  return onRequestPost({
    request: new Request('https://www.donovan.law/booking/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() },
      body: JSON.stringify({
        type: 'consult',
        slot: futureMondaySlot(weeksOut),
        name: 'Bobby Brown',
        email: CLIENT_EMAIL,
        phone,
        turnstile_token: 'good-token',
        ...over,
      }),
    }),
    env: resolvedEnv,
  });
}

let stub, mute;
beforeEach(() => { __resetIntakeFieldCache(); mute = muteConsole(); });
afterEach(() => { stub?.restore(); mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// 0. THE VENDOR MODEL IS AS STINGY AS THE GRANT — fired by hand, never inert
// ─────────────────────────────────────────────────────────────────────────────
describe('the vendor model', () => {
  test('a PLAIN email_addresses selection returns rows with NO address — the live shape', () => {
    const got = project(heldContact(), parseSelection('id,email_addresses'));
    assert.equal(got.email_addresses.length, 1, 'a row still comes back — this is a 200, not an error');
    assert.equal('address' in got.email_addresses[0], false,
      'and it carries no address, which is the entire defect');
    assert.deepEqual(Object.keys(got.email_addresses[0]).sort(), ['etag', 'id'],
      'id and etag, exactly what Elroy read off the live grant');
  });

  test('the SUB-SELECTED email_addresses selection returns the real address', () => {
    const got = project(heldContact(), parseSelection('id,email_addresses{address}'));
    assert.equal(got.email_addresses[0].address, CLIENT_EMAIL);
  });

  test('plain phone_numbers and addresses are just as empty', () => {
    const got = project(
      heldContact({ addresses: [{ id: 31, etag: 'e4', province: 'FL', country: 'USA' }] }),
      parseSelection('id,phone_numbers,addresses'),
    );
    assert.equal('number' in got.phone_numbers[0], false, 'the existing-phone guard reads .number');
    assert.equal('province' in got.addresses[0], false, 'the existing-address guard reads .province');
    assert.equal('country' in got.addresses[0], false, 'and .country for the outside-the-U.S. case');
  });

  test('a second-level selector is a 400 — the arm that can never succeed', async () => {
    assert.equal(selectionDepth('id,email_addresses{address{value}}'), 2);
    stub = stubClio();
    const res = await fetch(`${CLIO_CONTACTS}?fields=`
      + encodeURIComponent('id,email_addresses{address{value}}'));
    assert.equal(res.status, 400);
    assert.equal(stub.seen.refused.length, 1, 'the refusal is recorded, not silently absorbed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE DEFECT — two bookings, one email, and how many Bobby Browns result
// ─────────────────────────────────────────────────────────────────────────────
describe('a returning client is matched, not duplicated', () => {
  test('the search asks for the sub-selection that carries an ADDRESS', async () => {
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book()).status, 201);

    const fields = decodeURIComponent(stub.seen.searches[0].fields);
    assert.match(fields, /email_addresses\{[^}]*\baddress\b[^}]*\}/,
      'a contact read that does not sub-select `address` cannot match a single row');
    assert.equal(selectionDepth(fields), 1, 'and it stays inside the one level Clio has');
    assert.equal(stub.seen.refused.length, 0, 'no request was refused for its selection');
  });

  test('THE MATCHER READS A REAL ADDRESS ON THE WIRE', async () => {
    // The load-bearing assertion. Not "the selection string looks right" — what the
    // vendor actually SERVED, which is the only thing the matcher ever sees.
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book()).status, 201);

    const rows = stub.seen.served[0].data;
    assert.ok(rows.length > 0, 'the search returned candidates at all');
    const addresses = rows.flatMap((r) => (r.email_addresses ?? []).map((e) => e.address));
    assert.ok(addresses.includes(CLIENT_EMAIL),
      'the client\'s own address came back on the wire — on `main` every one of these is undefined');
    for (const a of addresses) {
      assert.equal(typeof a, 'string', 'no candidate row carries an undefined address');
    }
  });

  test('two bookings, same email, different phone ⇒ ONE contact, not two', async () => {
    stub = stubClio({ hold: [heldContact()] });

    assert.equal((await book({ phone: PHONE_FIRST })).status, 201);
    assert.equal((await book({ phone: PHONE_SECOND, weeksOut: 2 })).status, 201);

    assert.equal(stub.seen.creates.length, 0,
      'a contact Clio already holds is never re-created — this is 2 on `main`');
    assert.equal(stub.contacts.length, 1, 'the firm still has exactly one Bobby Brown');

    // And the booking is actually ATTACHED to the held contact, not merely "not created".
    for (const entry of stub.seen.entries) {
      assert.deepEqual(entry.data.attendees, [{ id: HELD_CONTACT_ID, type: 'Contact' }, { id: 9084638, type: 'Calendar' }],
        'the calendar entry names the contact Clio already had');
    }
  });

  test('the match is by ADDRESS, not by position — a decoy shares the page', async () => {
    stub = stubClio({ hold: [decoyContact(), heldContact()] });
    assert.equal((await book()).status, 201);

    assert.equal(stub.seen.served[0].data.length, 2, 'the vendor returned both candidates');
    assert.equal(stub.seen.creates.length, 0);
    assert.equal(stub.seen.entries[0].data.attendees[0].id, HELD_CONTACT_ID,
      'the SECOND row is the right one — taking data[0] would have booked Roberta');
  });

  test('the existing-phone guard sees the number, so a repeat phone is not re-appended', async () => {
    stub = stubClio({ hold: [heldContact()] });

    assert.equal((await book({ phone: PHONE_FIRST })).status, 201);

    // THE ANCHOR FIRST. Without it this passes on `main` for the wrong reason: the
    // plain selection finds nothing, so a NEW contact is created and enriched from
    // the shim built out of the create body — which already carries the phone, so no
    // phone_numbers PATCH is sent and "not re-appended" holds vacuously. Asserting we
    // matched the held contact is what makes the rest of this test about the guard.
    // See [[feedback_idle_with_zero_tasks_is_a_vacuous_pass]].
    assert.equal(stub.seen.creates.length, 0, 'the held contact was MATCHED, not re-created');
    assert.equal(stub.seen.entries[0].data.attendees[0].id, HELD_CONTACT_ID);

    assert.equal(
      stub.seen.patches.some((p) => 'phone_numbers' in p.body.data), false,
      'the number Clio already holds is not sent again — on `main` .number is undefined and it always is',
    );
    assert.equal(stub.contacts[0].phone_numbers.length, 1, 'still one phone on the record');
  });

  test('a genuinely new phone IS appended — the guard is not simply off', async () => {
    stub = stubClio({ hold: [heldContact()] });

    assert.equal((await book({ phone: PHONE_SECOND })).status, 201);
    const patch = stub.seen.patches.find((p) => 'phone_numbers' in p.body.data);
    assert.ok(patch, 'a number the contact does not have is still written');
    assert.equal(patch.body.data.phone_numbers[0].number, PHONE_SECOND);
    assert.equal(stub.contacts[0].phone_numbers.length, 2);
  });

  test('the existing-address guard sees province, so a repeat state is not re-appended', async () => {
    const CALL_ID = 'call_dedupe_state_0001';
    const ns = makeDurableObject();
    ns.instance('donovan').state.set(`qual:${CALL_ID}`, { status: 'complete' });
    const kv = makeKV({
      [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: 'x', intake: {}, state: 'FL' }),
    });

    stub = stubClio({
      hold: [heldContact({ addresses: [{ id: 31, etag: 'e4', province: 'FL' }] })],
    });
    assert.equal(
      (await book({ call_id: CALL_ID, env: { PERCH_ACTIONS: kv, PERCH_BRIDGE: ns } })).status,
      201,
    );

    assert.equal(
      stub.seen.patches.some((p) => 'addresses' in p.body.data), false,
      'FL is already on the record — on `main` .province is undefined and it is appended every booking',
    );
    assert.equal(stub.contacts[0].addresses.length, 1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE APPLIED-CHECK — the shipped source is not the source that had the bug
// ─────────────────────────────────────────────────────────────────────────────
describe('the fix is in the shipped source', () => {
  const SOURCE = readFileSync(new URL(`../${PROVIDER}`, import.meta.url), 'utf8')
    .replace(/\r\n/g, '\n');

  // The two selection lines EXACTLY as they stood on `main`. If a future edit puts
  // either of them back, these reds — and so does everything above it.
  const BROKEN_MINIMAL  = 'const CONTACT_SEARCH_FIELDS_MINIMAL = ["id", CLIO_FIELDS.CONTACT_EMAIL_FIELD].join(",");';
  const BROKEN_ENRICHED = '  CLIO_FIELDS.CONTACT_EMAIL_FIELD,\n'
    + '  CLIO_FIELDS.CONTACT_BODY_PHONE,\n'
    + '  CLIO_FIELDS.CONTACT_BODY_ADDRESSES,\n';

  test('neither plain-selection line survives anywhere in the file', () => {
    assert.notEqual(SOURCE.indexOf(BROKEN_MINIMAL), 0);
    assert.equal(SOURCE.includes(BROKEN_MINIMAL), false,
      'the minimal selection still asks for email_addresses plainly — the FLOOR has the same hole');
    assert.equal(SOURCE.includes(BROKEN_ENRICHED), false,
      'the enriched selection still names three sub-resources plainly');
  });

  test('the sub-selection is spelled with the SAME constants the readers use', () => {
    // Not a substring hunt for the literal words: the point of the fix is that the
    // selection and its reader cannot drift, and they cannot only if both go through
    // CLIO_FIELDS. See [[feedback_assert_behavior_not_source_spelling]] — the
    // behaviour is asserted above; this is the structural half that keeps it true.
    for (const c of ['CONTACT_EMAIL_ADDRESS_FIELD', 'CONTACT_PHONE_NUMBER_FIELD', 'CONTACT_ADDRESS_PROVINCE', 'CONTACT_ADDRESS_COUNTRY']) {
      assert.ok(SOURCE.includes(`CLIO_FIELDS.${c}`), `${c} is used, not a bare literal`);
    }
  });

  test('the guard is not inert — restoring the plain selection is detected', () => {
    // The mutation the reviewer actually fears, applied to a copy. It must be
    // detectable, or the two tests above are decoration.
    // See [[feedback_mutation_that_fails_to_apply_reports_pass]].
    const mutated = SOURCE.replace(
      /const CONTACT_SEARCH_FIELDS_MINIMAL = \[\n[\s\S]*?\n\]\.join\(","\);/,
      BROKEN_MINIMAL,
    );
    assert.notEqual(mutated, SOURCE, 'the mutation must actually apply, or this reports a vacuous pass');
    assert.equal(mutated.includes(BROKEN_MINIMAL), true, 'and the broken line is now present, so the check has something to catch');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE FOUR DIAGNOSTICS — instrumentation only, no write behaviour changes
// ─────────────────────────────────────────────────────────────────────────────
//
// Four different silent paths reach "zero custom fields on the contact" before any
// PATCH exists, and they all used to arrive at the same log line or at none. These
// warns tell them apart. Each is fired here, so none is dead code.
//
// FIELD NAMES AND COUNTS ONLY. Every assertion below also proves the answer VALUES
// stayed out of the log — a diagnostic that prints the client's income band is a
// leak wearing a diagnostic's clothes.
describe('the zero-custom-fields paths are told apart in the log', () => {
  const BANDS = ['$1.5M–$3M', '$5M–$15M'];

  /** No captured line may contain an intake VALUE. Asserted on every warn test. */
  function assertNoValuesLogged() {
    for (const [, line] of mute.lines) {
      for (const v of BANDS) {
        assert.equal(line.includes(v), false, `a diagnostic printed the value "${v}"`);
      }
    }
  }

  test('path 1 — create.js: the record was read and every answer was empty', async () => {
    const CALL_ID = 'call_dedupe_totalloss_01';
    const ns = makeDurableObject();
    ns.instance('donovan').state.set(`qual:${CALL_ID}`, { status: 'complete' });
    // A record that EXISTS and carries nothing usable — the total-loss case. Today
    // this is indistinguishable from an ordinary partial, which is why it is silent.
    const kv = makeKV({
      [`qualbk:${CALL_ID}`]: JSON.stringify({
        summary: 'call happened', intake: Object.fromEntries(SELF_REPORTED_KEYS.map((k) => [k, ''])), state: '',
      }),
    });

    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book({ call_id: CALL_ID, env: { PERCH_ACTIONS: kv, PERCH_BRIDGE: ns } })).status, 201);

    assert.ok(mute.saw('[booking/create] intake empty — zero custom fields will be written'),
      'total loss says so');
    // Every allow-listed key is named, so the loss is legible rather than a count.
    for (const k of SELF_REPORTED_KEYS) {
      assert.ok(mute.saw(k), `${k} is named as absent`);
    }
    assertNoValuesLogged();
  });

  test('path 1 does NOT fire for an ordinary partial, or it is noise', async () => {
    const CALL_ID = 'call_dedupe_partial_01';
    const ns = makeDurableObject();
    ns.instance('donovan').state.set(`qual:${CALL_ID}`, { status: 'complete' });
    const kv = makeKV({
      [`qualbk:${CALL_ID}`]: JSON.stringify({
        summary: 's', intake: { matter_category: 'Real estate' }, state: 'FL',
      }),
    });

    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book({ call_id: CALL_ID, env: { PERCH_ACTIONS: kv, PERCH_BRIDGE: ns } })).status, 201);

    assert.equal(mute.saw('[booking/create] intake empty'), false,
      'one answer present is a partial, not a total loss');
  });

  test('path 1 does NOT fire when there was no qualifier at all — that is a fifth path', async () => {
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book()).status, 201);
    assert.equal(mute.saw('[booking/create] intake empty'), false,
      'a withheld binding gives omitted:[] and must not be reported as total loss');
  });

  test('path 2 — provider-clio: there were no answers to resolve ids for', async () => {
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book()).status, 201);

    assert.ok(mute.saw('[clio] intake field ids not resolved: no intake answers to resolve'),
      '"no answers" is stated rather than inferred from an absence of other lines');
    assertNoValuesLogged();
  });

  test('path 3 — provider-clio: the resolver threw and the catch swallowed it', async () => {
    const CALL_ID = 'call_dedupe_resolver_01';
    const ns = makeDurableObject();
    ns.instance('donovan').state.set(`qual:${CALL_ID}`, { status: 'complete' });
    const kv = makeKV({
      [`qualbk:${CALL_ID}`]: JSON.stringify({
        summary: 's', intake: { income_band: BANDS[0], net_worth_band: BANDS[1] }, state: 'FL',
      }),
    });

    stub = stubClio({ hold: [heldContact()] });

    // WHAT THIS CATCH CAN STILL SEE, stated exactly, because it is narrower than its
    // own docblock claims. That comment says the catch is there for "a transport-level
    // throw — an unrefreshable token, a DNS failure". It is not, any more:
    // clio-custom-fields.js wraps its own `api.get` and its own `res.json()` and
    // RETURNS FALSE on either, so a dead network never reaches here. What is left is
    // an unexpected throw on the way INTO the walk — and `seedFromEnv` reads
    // `env.CLIO_INTAKE_FIELD_IDS` outside its try, so a binding that throws on read is
    // a real one. That is what is fired here.
    //
    // The gap this exposes is reported with the PR, not fixed here: a resolver that
    // fails INTERNALLY hands back empty-or-partial ids with no throw and no warn, so
    // "zero custom fields" has a fifth silent path this order does not cover.
    // Defined AFTER the spread, or `envFor` trips the getter itself and the throw
    // never reaches the code under test.
    const hostileEnv = { PERCH_ACTIONS: kv, PERCH_BRIDGE: ns };
    Object.defineProperty(hostileEnv, 'CLIO_INTAKE_FIELD_IDS', {
      enumerable: false,
      get() { throw new TypeError('binding unavailable'); },
    });

    assert.equal((await book({ call_id: CALL_ID, env: hostileEnv })).status, 201,
      'the booking still succeeds — the catch is not being turned into a failure');

    assert.ok(mute.saw('[clio] intake field ids not resolved: error'),
      'the swallowed throw is now named');
    assert.ok(mute.saw('wanted=income_band,net_worth_band'),
      'and the fields we wanted are named, so the loss is legible');
    assertNoValuesLogged();
  });

  test('path 4 — provider-clio: the diff was empty, so no PATCH was sent at all', async () => {
    // Same phone, same name, no intake: nothing to write. Correct behaviour, and
    // until now completely invisible.
    //
    // AND NOW ALSO THE SAME WEBSITE (SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE).
    // A contact with a BLANK Website is no longer an empty diff — the firm's site is
    // written onto it exactly once — so leaving this fixture website-less would have
    // made this case test the new write rather than the no_change path it is named
    // for. A returning client Clio already holds, who already has a website, is the
    // record that genuinely produces nothing to say.
    stub = stubClio({ hold: [heldContact({
      web_sites: [{ id: 31, address: 'https://bobbybrown.example/' }],
    })] });
    assert.equal((await book({ phone: PHONE_FIRST })).status, 201);

    assert.equal(stub.seen.patches.length, 0, 'no PATCH — this is the no_change path');
    assert.ok(mute.saw('[clio] contact enrichment skipped: no_change custom_field_values_built=0'),
      'the built count is what separates an up-to-date contact from a total loss');
    assertNoValuesLogged();
  });

  test('the four lines are four DIFFERENT strings — one message could not tell them apart', () => {
    const lines = [
      '[booking/create] intake empty — zero custom fields will be written',
      '[clio] intake field ids not resolved: no intake answers to resolve',
      '[clio] intake field ids not resolved: error',
      '[clio] contact enrichment skipped: no_change custom_field_values_built=',
    ];
    assert.equal(new Set(lines).size, 4);
    // And none of them is the pre-existing message they were confused with.
    for (const l of lines) {
      assert.equal(l.includes('enrichment not applied'), false,
        'a new diagnostic that reuses the old ambiguous string fixes nothing');
    }
  });
});

// ═════════════════════════════════════════════════════════════════════════════
// ORDER SHELDON-154-CLIO-DEDUP-R1 · issue #154, second round
//
// #169 FIXED THE EMAIL MATCHER AND THE CRM KEPT FORKING. Three David Pierce records,
// plus the test bookings from today, all after that fix shipped.
//
// The email was never the whole key. The matcher answers "does Clio hold a Person at
// THIS ADDRESS", and for a client who booked once from a personal address and once
// from work, that question's honest answer — no — is the wrong basis for a create.
// Driven against the real write path on `main`, an empty Clio, three bookings:
//
//   1  david@ticoai.net     (561) 555-0142   search miss  → CREATE
//   2  david@ticoai.net     (561) 555-0142   search hit   → reuse ✓
//   3  dpierce@donovan.law  (561) 555-0142   search miss  → CREATE   ← the fork
//
// So the phone — the other identifier every booking on every channel collects, and
// one Clio's own `query` already searches — is asked about before a second record is
// minted, ON THE CREATE BRANCH ONLY.
//
// THE THREE THINGS THIS DELIBERATELY DOES NOT DO, pinned as tests rather than left
// as prose, because each of them would otherwise read as a promise:
//   · §4 a number several Persons answer is NOT treated as an identity
//   · §5 a number stored in a spelling neither query reaches is NOT found — Clio has
//        no normalised phone lookup, and this widens reuse without guaranteeing it
//   · §5 nor is a stored country code, which `phoneKey` counts as different digits
// ═════════════════════════════════════════════════════════════════════════════

const DP_EMAIL_HOME = 'david@ticoai.net';
const DP_EMAIL_WORK = 'dpierce@donovan.law';

/** Book as David Pierce — the live duplicate this order names. */
async function bookAsDavid({ email = DP_EMAIL_HOME, phone = PHONE_FIRST, weeksOut = 1 } = {}) {
  return book({ name: 'David Pierce', email, phone, weeksOut });
}

/**
 * The CONTACT id every calendar entry was attached to, in order.
 *
 * Filtered on type, not merely flattened. Every entry now carries a second
 * attendee — the firm calendar, type "Calendar" — so that the firm is invited to
 * its own consultations rather than merely owning the surface the row is written
 * to. That id is a constant of the deployment and says nothing about dedupe,
 * which is the only question this file asks; leaving it in the list would make
 * every expectation here alternate contact and calendar ids for no gain.
 *
 * The firm attendee is asserted where it belongs — clio-confirm-email.test.mjs,
 * on the full array shape.
 */
function attendeeIds(seen) {
  return seen.entries.flatMap((e) => (e.data.attendees ?? [])
    .filter((a) => a.type === 'Contact')
    .map((a) => a.id));
}

/** The searches that were NOT the email leg — i.e. the phone leg. */
function phoneSearches(seen) {
  return seen.searches.filter((s) => !s.query.includes('@'));
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 — THE ORDER'S OWN CASE: a second booking on the same email reuses
// ─────────────────────────────────────────────────────────────────────────────
describe('a second booking on the same email reuses the contact', () => {
  test('THE ANCHOR: an EMPTY Clio, two bookings, ONE contact', async () => {
    // Anchored on the CREATE COUNT, and starting from a Clio that holds nobody,
    // because that is the shape the firm actually books in: nothing is pre-seeded, so
    // "it was reused" cannot be satisfied here by a fixture the code never had to find.
    stub = stubClio({ hold: [] });

    assert.equal((await bookAsDavid({ weeksOut: 1 })).status, 201);
    assert.equal(stub.seen.creates.length, 1, 'booking one had nobody to reuse — it created');

    assert.equal((await bookAsDavid({ weeksOut: 2 })).status, 201);
    assert.equal(stub.seen.creates.length, 1, 'AND BOOKING TWO CREATED NOTHING');
    assert.equal(stub.contacts.length, 1, 'the firm has exactly one David Pierce');
  });

  test('and booking two is ATTACHED to the record booking one made', async () => {
    // "No second contact" is not the same fact as "the second booking reached the
    // first contact". A booking that silently linked nothing satisfies the count.
    stub = stubClio({ hold: [] });
    await bookAsDavid({ weeksOut: 1 });
    await bookAsDavid({ weeksOut: 2 });

    const createdId = stub.seen.creates[0].id;
    assert.deepEqual(attendeeIds(stub.seen), [createdId, createdId],
      'both calendar entries name the same Person');
  });

  test('the returning client pays NO phone search for it', async () => {
    // The phone leg lives on the create branch. A client whose address is already on
    // the record must not buy a subrequest with it — this sits in front of a calendar
    // write with somebody waiting on the confirmation.
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await book()).status, 201);

    assert.equal(stub.seen.creates.length, 0, 'reused, as §1 establishes');
    assert.deepEqual(phoneSearches(stub.seen), [], 'exactly zero phone searches');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 — THE DEFECT THIS ROUND EXISTS FOR: same person, second email address
// ─────────────────────────────────────────────────────────────────────────────
describe('a booking on a phone Clio already holds is not a second Person', () => {
  test('THE CONTROL: two emails, one phone ⇒ ONE contact — this is 2 on `main`', async () => {
    // The load-bearing assertion of the order, and the one that reds the moment the
    // phone leg is removed: on `main` the second booking's email matches nobody, the
    // create branch is licensed, and the firm gets its second David Pierce.
    stub = stubClio({ hold: [] });

    assert.equal((await bookAsDavid({ email: DP_EMAIL_HOME, weeksOut: 1 })).status, 201);
    assert.equal((await bookAsDavid({ email: DP_EMAIL_WORK, weeksOut: 2 })).status, 201);

    assert.equal(stub.seen.creates.length, 1,
      'the work address reached the record the home address made');
    assert.equal(stub.contacts.length, 1, 'ONE David Pierce, not two');

    const createdId = stub.seen.creates[0].id;
    assert.deepEqual(attendeeIds(stub.seen), [createdId, createdId]);
  });

  test('the reuse is a real PATCH onto the held record, not a silent skip', async () => {
    // A booking that found the contact and then wrote nothing to it would pass the
    // create count while losing the intake. The enrichment has to land on the id the
    // phone matched.
    stub = stubClio({ hold: [heldContact()] });
    assert.equal((await bookAsDavid({
      email: 'someone.else@example.com', phone: PHONE_FIRST,
    })).status, 201);

    assert.equal(stub.seen.creates.length, 0);
    assert.ok(stub.seen.patches.length > 0, 'the held record was updated');
    for (const p of stub.seen.patches) {
      assert.equal(p.id, HELD_CONTACT_ID, 'and every PATCH went to the matched contact');
    }
    assert.deepEqual(attendeeIds(stub.seen), [HELD_CONTACT_ID]);
  });

  test('the digits spelling earns its request: a bare stored number is still found', async () => {
    // `(561) 555-0142` is not a substring of a stored `5615550142`, so the raw query
    // misses and the SECOND spelling is the only reason this contact is found at all.
    // Delete the digits spelling and this test reds.
    stub = stubClio({ hold: [heldContact({
      phone_numbers: [{ id: 21, etag: 'e2', number: '5615550142', name: 'Mobile' }],
    })] });

    assert.equal((await bookAsDavid({
      email: 'brand.new@example.com', phone: '(561) 555-0142',
    })).status, 201);

    assert.equal(stub.seen.creates.length, 0, 'matched through the digits query');
    assert.ok(phoneSearches(stub.seen).some((s) => s.query === '5615550142'),
      'and the digits spelling really was asked');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 — THE FLOOR, AND #154 NOT RE-ENTERING THROUGH A NEW FIELD
// ─────────────────────────────────────────────────────────────────────────────
describe('the phone leg reads only what its own selection asked for', () => {
  test('its selection SUB-SELECTS `number` — a plain one would match nobody', async () => {
    stub = stubClio({ hold: [] });
    await bookAsDavid();

    const asked = phoneSearches(stub.seen);
    assert.ok(asked.length > 0, 'the phone leg ran at all');
    for (const s of asked) {
      const fields = decodeURIComponent(s.fields);
      assert.match(fields, /phone_numbers\{[^}]*\bnumber\b[^}]*\}/,
        'a phone read that does not sub-select `number` is #154 with a new field name');
      assert.equal(selectionDepth(fields), 1, 'and it stays inside the one level Clio has');
    }
    assert.equal(stub.seen.refused.length, 0, 'nothing was refused for its selection');
  });

  test('THE FLOOR HOLDS: the rich selection refused, the phone still matches', async () => {
    // The email floor sub-selects `email_addresses{address}` and NOTHING else, so a
    // phone leg falling back onto it would read `undefined` on every row and report a
    // confident not-found — #154 exactly, one field over. The phone leg has a floor of
    // its own, and this drives the vendor into refusing the rich selection so that
    // floor is exercised rather than merely declared.
    stub = stubClio({ hold: [heldContact()], refuseEnriched: true });

    assert.equal((await bookAsDavid({
      email: 'brand.new@example.com', phone: PHONE_FIRST,
    })).status, 201);

    assert.ok(stub.seen.refused.length > 0, 'the rich selection really was refused');
    assert.equal(stub.seen.creates.length, 0, 'and the contact was STILL found');
    assert.deepEqual(attendeeIds(stub.seen), [HELD_CONTACT_ID]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 — A NUMBER SEVERAL PEOPLE ANSWER IS NOT AN IDENTITY
// ─────────────────────────────────────────────────────────────────────────────
describe('an ambiguous phone is discarded as a key, not guessed at', () => {
  test('two Persons on one line ⇒ a new contact, and neither is written to', async () => {
    // A household line, or an office switchboard. Attaching this booking to whichever
    // row came back first would file one client's intake answers onto another client's
    // contact record, at a law firm — worse than the duplicate this order removes.
    stub = stubClio({ hold: [
      heldContact(),
      heldContact({
        id: 7100001, first_name: 'Paula', last_name: 'Brown',
        email_addresses: [{ id: 13, etag: 'e5', address: 'paula.brown@example.com' }],
      }),
    ] });

    assert.equal((await bookAsDavid({
      email: 'third.person@example.com', phone: PHONE_FIRST,
    })).status, 201);

    assert.equal(stub.seen.creates.length, 1, 'a new Person, which may be exactly right');
    for (const p of stub.seen.patches) {
      assert.equal([HELD_CONTACT_ID, 7100001].includes(p.id), false,
        'and NOTHING was written onto either existing client');
    }
    assert.ok(mute.saw('[clio] phone matches 2 contacts — ambiguous, not used as an identity'),
      'the ambiguity is stated, not silently absorbed');
    // The count is the whole message. The number itself is the client's.
    assert.equal(mute.saw('555-0142'), false, 'no telephone number reaches the log');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 — WHAT THIS CANNOT DO, PINNED SO IT CANNOT BE MISREAD AS A GUARANTEE
// ─────────────────────────────────────────────────────────────────────────────
describe('the limits of a vendor wildcard, stated as tests', () => {
  test('a third spelling is NOT found — Clio has no normalised phone lookup', async () => {
    // Stored `561-555-0142`; the client types `(561) 555-0142`. Neither the raw query
    // nor the digits query is a substring of the stored string, so Clio returns nobody
    // and this booking creates. That is a limit of the VENDOR'S SEARCH, written down
    // here so a future reader does not mistake this feature for a promise it never
    // made — and so that a later fix for it has a test to turn green.
    stub = stubClio({ hold: [heldContact({
      phone_numbers: [{ id: 21, etag: 'e2', number: '561-555-0142', name: 'Mobile' }],
    })] });

    assert.equal((await bookAsDavid({
      email: 'brand.new@example.com', phone: '(561) 555-0142',
    })).status, 201);

    assert.equal(stub.seen.creates.length, 1,
      'not found, and honestly so — this widens reuse, it does not guarantee it');
  });

  test('a stored country code is different DIGITS, so it is a different key', async () => {
    // `+1 (561) 555-0142` comes back on the raw query — it contains that substring —
    // and is then REFUSED by the matcher, because `phoneKey` is digits-only and
    // `15615550142` is not `5615550142`.
    //
    // Deliberately not special-cased. `phoneKey` is also what updateContact's
    // existing-phone guard compares, so a matcher that were cleverer than it would
    // reuse the contact and then append the client's number to it a second time as
    // "new". One normalisation rule in this file, or the two disagree.
    stub = stubClio({ hold: [heldContact({
      phone_numbers: [{ id: 21, etag: 'e2', number: '+1 (561) 555-0142', name: 'Mobile' }],
    })] });

    assert.equal((await bookAsDavid({
      email: 'brand.new@example.com', phone: '(561) 555-0142',
    })).status, 201);

    assert.ok(phoneSearches(stub.seen).length > 0, 'the search ran and Clio answered with the row');
    assert.equal(stub.seen.creates.length, 1, 'and the matcher declined it');
  });

  test('a phone-less booking never reaches the phone leg — the form refuses it first', async () => {
    // MEASURED, NOT ASSUMED. This was written expecting a 201 and a skipped search;
    // create.js answers 400. The booking form requires a phone, so `searchContactByPhone`
    // can never be handed an empty one THROUGH THIS ENTRY POINT — its no-digits guard is
    // defensive depth, not a live branch, and saying so here is what stops the next
    // reader from proving a path the request validator already closed.
    stub = stubClio({ hold: [] });
    assert.equal((await bookAsDavid({ phone: '' })).status, 400);

    assert.deepEqual(stub.seen.searches, [], 'no booking, so no search of either kind');
    assert.equal(stub.seen.creates.length, 0, 'and nothing was written to the CRM');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6 — THE PHONE LEG FAILS CLOSED, AND ITS NARROWING CONTROL
// ─────────────────────────────────────────────────────────────────────────────
describe('a phone search that did not answer never licenses a second contact', () => {
  test('every phone attempt 500s ⇒ NOTHING is created', async () => {
    // Note which search fails here: the EMAIL leg answered perfectly well and found
    // nobody. It is the second question that went unanswered, which is the only way
    // this happens live, and the fail-closed rule has to hold for it too.
    stub = stubClio({ hold: [], phoneSearchStatus: 500 });
    const res = await bookAsDavid();

    assert.equal(res.status, 201, 'the booking is still confirmed');
    assert.equal(stub.seen.creates.length, 0,
      'Clio never said whether it holds this client, so we do not decide that it does not');
    assert.ok(mute.saw('[clio] contact phone search inconclusive'),
      'and the log says which of the two searches failed');
  });

  test('THE NARROWING CONTROL: a phone search that answers EMPTY still creates', async () => {
    // Without this, the guard above passes just as well for a leg that has simply
    // stopped saying yes — and then no new client is ever linked again.
    stub = stubClio({ hold: [] });
    assert.equal((await bookAsDavid()).status, 201);
    assert.equal(stub.seen.creates.length, 1, 'an empty result set is a real answer');
    assert.ok('attendees' in stub.seen.entries[0].data, 'the client still gets their email');
  });

  test('the two inconclusive warns are DIFFERENT strings', () => {
    const lines = [
      '[clio] contact search inconclusive — no contact linked this booking, no duplicate created',
      '[clio] contact phone search inconclusive — no contact linked this booking, no duplicate created',
    ];
    assert.equal(new Set(lines).size, 2,
      'an operator reading one line has to know which request could not reach Clio');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §7 — WHILE THE DUPLICATES ARE STILL THERE, BOOKINGS CONVERGE ON THE OLDEST
// ─────────────────────────────────────────────────────────────────────────────
describe('the oldest matching record wins, so the fork stops widening', () => {
  test('three David Pierces on one email ⇒ the LOWEST id is the one reused', async () => {
    // The live state this order was raised against, before the paralegal merges them.
    // `.find()` took whatever the page listed first; if that order ever varied, two
    // bookings by one client would land on two different records and the fork would
    // keep growing from both ends. The oldest is also the record the runbook merges
    // the others INTO, so a booking taken mid-merge lands on the survivor.
    stub = stubClio({ hold: [
      heldContact({ id: 5100003, email_addresses: [{ id: 1, address: DP_EMAIL_HOME }] }),
      heldContact({ id: 5100001, email_addresses: [{ id: 2, address: DP_EMAIL_HOME }] }),
      heldContact({ id: 5100002, email_addresses: [{ id: 3, address: DP_EMAIL_HOME }] }),
    ] });

    assert.equal((await bookAsDavid({ email: DP_EMAIL_HOME })).status, 201);

    assert.equal(stub.seen.creates.length, 0, 'no fourth David Pierce');
    assert.deepEqual(attendeeIds(stub.seen), [5100001],
      'the oldest record, decided here rather than by the vendor sort order');
  });
});
