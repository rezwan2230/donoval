// ORDER SHELDON-QUALIFIER-BOOKING-JOIN-R1 · issue #153 — the qualifier answers
// must reach the Clio contact when the booking is completed AFTER the call ended.
//
// ── THE LIVE FAILURE THIS FILE IS WRITTEN AGAINST ────────────────────────────
// Call `call_2ba5efd435719148b0b7ab9f66d`, 2026-08-04. At 18:58:13
// `get_qualifier_result` returned `status: complete` carrying income_band
// 500k_1_5m, net_worth_band 2m_5m, for_whom business, matter_category tax,
// matter_sub planning, language en. `goto_booking` fired. The caller completed the
// booking on /book after the call ended.
//
// Clio received the contact, the calendar entry, the attendee, the Zoom link and
// sent the client their confirmation email — all correct. It received ZERO of the
// seven Intake custom fields.
//
// Nothing was broken about Clio, and nothing was broken about the qualifier
// record: `qualbk:<call_id>` was in KV with hours left on its 6h TTL, and
// `booking/_lib/qualifier-bind.js` confirms on that copy alone precisely so a
// finished call still joins. What was broken is that the booking could not NAME
// it. The form's only source of the key is `window.__perchCallId`, a JS global
// written by the live command channel and stored nowhere — so it dies with the
// document, while the unlock flag it travels with is persisted to localStorage.
// A caller can reach a fully unlocked /book page that has no idea which call
// unlocked it.
//
// ── WHAT EVERY TEST HERE HAS TO PROVE TWICE ──────────────────────────────────
// Every case asserts the intake outcome AND that the booking itself is unharmed.
// A file that only checked the custom fields would pass just as happily against a
// build that had started refusing bookings — and the appointment is the product.
//
// Sections map to the order's tasks:
//   §1  the join, including the after-the-call case that was losing everything
//   §2  the cookie carrier — armed, spent, and never believed on its own
//   §3  partial writes: every field we have, none we do not, no placeholder
//   §4  self-reported answers only — no post-call characterisation, ever
//   §5  the units underneath, driven directly

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import { onRequestPost as qualifierSubmit } from '../donovan-legal-site/functions/fn/qualifier_submit.js';
import {
  INTAKE_CUSTOM_FIELDS,
  __resetIntakeFieldCache,
} from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import {
  SELF_REPORTED_KEYS, DERIVED_REFUSED, US_STATE_CODES, OUTSIDE_US,
  isPlaceholder, selectIntakeFields, selectState,
} from '../donovan-legal-site/functions/booking/_lib/intake-policy.js';
import {
  QUALIFIER_COOKIE, QUALIFIER_COOKIE_MAX_AGE,
  setQualifierCookie, clearQualifierCookie, readQualifierCookie,
} from '../donovan-legal-site/functions/_lib/qualifier-cookie.js';
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

/** The live call from the ticket, spelled as Retell spells one. */
const CALL_ID = 'call_2ba5efd435719148b0b7ab9f66d';

const FIELD_ID = Object.fromEntries(INTAKE_CUSTOM_FIELDS.map((f, i) => [f.key, 8100 + i]));
const CF_ROWS  = INTAKE_CUSTOM_FIELDS.map((f) => ({ id: FIELD_ID[f.key], name: f.name, field_type: f.type }));

/**
 * The seven answers the live call actually carried, as fn/qualifier_submit's own
 * LABELS table renders them.
 *
 * `source` is present because the live record had one; the six above it are the
 * exact values `get_qualifier_result` returned at 18:58:13. Asserting on these
 * strings rather than on a paraphrase is what makes this a regression test for
 * that call rather than a test of the shape of a call.
 */
const INTAKE = {
  matter_category: 'Tax',
  matter_sub:      'Planning',
  for_whom:        'Business / company',
  income_band:     '$500K–$1.5M',
  net_worth_band:  '$2M–$5M',
  language:        'English',
  source:          'Google search',
};

const SUMMARY = [
  '— Perch intake —',
  `Matter: ${INTAKE.matter_category} → ${INTAKE.matter_sub}`,
  `For: ${INTAKE.for_whom}`,
  `Income: ${INTAKE.income_band}`,
  `Net worth: ${INTAKE.net_worth_band}`,
  `Language: ${INTAKE.language} · Source: ${INTAKE.source}`,
].join('\n');

/** The bands, which may never reach the client-facing calendar description. */
const BANDS = [INTAKE.income_band, INTAKE.net_worth_band, '— Perch intake —'];

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

// create.js keeps a MODULE-level rate-limit map (10/min/IP); give each request its
// own IP or later tests 429 for reasons unrelated to what they assert.
let _ipSeq = 0;
const nextIp = () => `198.51.100.${(_ipSeq += 1) % 250}`;

/**
 * A booking POST.
 *
 * `cookie` is the whole point of this file: it is what a browser sends when the
 * page's in-memory `call_id` is gone — after the call ended, after a reload, after
 * the tab was closed and reopened inside the window.
 */
function post(b, { cookie = '' } = {}) {
  const headers = { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() };
  if (cookie) headers.cookie = cookie;
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
    turnstile_token: 'good-token',
    ...over,
  };
}

/** The KV record fn/qualifier_submit writes. `over` replaces any half of it. */
function kvWithQualifier(over = {}, callId = CALL_ID) {
  return makeKV({
    [`qualbk:${callId}`]: JSON.stringify({
      summary: SUMMARY, intake: INTAKE, state: 'FL', matter: 'tax', ...over,
    }),
  });
}

/**
 * The bridge as it stands AFTER the call.
 *
 * Materialised but EMPTY, and that is the whole post-call posture rather than a
 * convenience: `get_qualifier_result` consumed `qual:<call_id>` at 18:58:13, so by
 * booking time the KV copy is the only surviving witness. A fixture that left the
 * DO slot populated would let the bridge probe carry the verification and the
 * cookie path would never be exercised.
 */
function emptyBridge() {
  const ns = makeDurableObject();
  ns.instance('donovan');
  return ns;
}

function stubAll({ cfList = [CF_ROWS], entryStatus = 200 } = {}) {
  const seen = { entries: [], notes: [], contacts: [], patches: [], searches: [], cfLists: [], vantage: [] };
  let cfPage = 0;

  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
    if (u.startsWith('https://app.clio.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));

    if (u.startsWith(CLIO_ENTRIES) && method === 'GET') return new Response(JSON.stringify({ data: [] }));
    if (u.startsWith(CLIO_ENTRIES) && method === 'POST') {
      seen.entries.push(JSON.parse(init.body));
      if (entryStatus !== 200) return new Response('{}', { status: entryStatus });
      return new Response(JSON.stringify({ data: { id: 999999 } }));
    }

    if (u.startsWith(CLIO_CFIELDS) && method === 'GET') {
      seen.cfLists.push(u);
      const page = cfList[cfPage] ?? [];
      const hasNext = cfPage < cfList.length - 1;
      cfPage += 1;
      return new Response(JSON.stringify({
        data: page,
        meta: hasNext ? { paging: { next: `${CLIO_CFIELDS}?page_token=p${cfPage}` } } : {},
      }));
    }
    // A TRIPWIRE: clio-custom-fields.js has no create path and must never grow one.
    if (u.startsWith(CLIO_CFIELDS) && method === 'POST') throw new Error('POST /custom_fields is forbidden');

    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      seen.patches.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      seen.searches.push(u);
      return new Response(JSON.stringify({ data: [] }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      seen.contacts.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
    }

    if (u.startsWith(CLIO_NOTES) && method === 'POST') {
      seen.notes.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 77 } }));
    }
    if (u.startsWith(GROW_INBOX)) return new Response(JSON.stringify({ ok: true }));
    if (u.startsWith(VANTAGE_UPSERT)) { seen.vantage.push(new URL(u)); return new Response(JSON.stringify({ ok: true })); }
    throw new Error(`unstubbed fetch: ${method} ${u}`);
  });
  return { seen, restore: () => handle.restore() };
}

/** The Vantage merge key this booking used — null when it opened a fresh lead. */
/**
 * The Vantage severance, asserted on every path that used to produce a merge key.
 *
 * `mergeKey(seen)` stood here and returned `seen.vantage[0]`'s `call_id` — the id
 * booking/create.js forwarded to `vantage.ticoai.net/upsert-lead` so the booking
 * merged into the lead the call had opened. That upsert is deleted with the
 * Vantage severance, so there is no merge key to read.
 *
 * The assertion is INVERTED rather than dropped, because "no lead data leaves the
 * firm's infrastructure" is worth a test in its own right — and because a silent
 * `0` would otherwise be indistinguishable from a stub that stopped recording.
 * Every former mergeKey() call site now asserts this instead; what each of those
 * tests was really proving — that the id verified and the answers reached Clio —
 * is asserted directly off the KV join record and the Clio writes, which is the
 * firm's own evidence rather than a third party's.
 */
function assertNoVantageCall(seen) {
  assert.deepEqual(seen.vantage, [],
    'no Vantage upsert-lead may be issued — the integration is severed');
}

/** The enrichment PATCH body — where addresses and custom_field_values live. */
function enrichData(seen, i = 0) {
  assert.ok(seen.patches.length > i, `an enrichment PATCH was issued (#${i + 1})`);
  return seen.patches[i].data;
}

/** custom_field_values as {key: value}. `{}` when the contact carries none. */
function cfvByKey(seen) {
  if (!seen.patches.length) return {};
  const byId = new Map(INTAKE_CUSTOM_FIELDS.map((f) => [FIELD_ID[f.key], f.key]));
  const out = {};
  for (const row of enrichData(seen)?.custom_field_values ?? []) {
    const key = byId.get(row?.custom_field?.id);
    if (key) out[key] = row.value;
  }
  return out;
}

/** The single calendar entry's description — the surface Clio emails the client. */
function description(seen) {
  assert.equal(seen.entries.length, 1, 'exactly one calendar entry');
  return seen.entries[0].data.description ?? '';
}

/**
 * The two things that must be true of EVERY booking in this file, whatever it did
 * or did not join. Called from every case, because a join fix that quietly cost
 * the client their confirmation email would be a worse outcome than the defect.
 */
function assertBookingIsIntact(res, seen) {
  assert.equal(res.status, 201, 'the appointment was confirmed');
  assert.equal(seen.entries.length, 1, 'exactly one Clio calendar entry');
  const entry = seen.entries[0].data;
  assert.ok(Array.isArray(entry.attendees) && entry.attendees.length, 'the client is an attendee, so Clio emails them');
  for (const band of BANDS) {
    assert.ok(!description(seen).includes(band), `the client-facing description must not carry "${band}"`);
  }
}

/** Every Set-Cookie on a response, as raw header strings. */
function setCookies(res) {
  const all = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (all.length) return all;
  const one = res.headers.get('set-cookie');
  return one ? [one] : [];
}

/** Run one booking. `cookie` is the browser's jar; `kv` the server's records. */
async function book({ b = {}, cookie = '', kv = kvWithQualifier(), bridge = emptyBridge(), envOver = {} } = {}) {
  const res = await onRequestPost({
    request: post(body(b), { cookie }),
    env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: bridge, ...envOver }),
  });
  return { res, kv };
}

/** The cookie header a browser would send after `fn/qualifier_submit` armed it. */
const jar = (id = CALL_ID) => `${QUALIFIER_COOKIE}=${id}`;

let stub, mute;
beforeEach(() => { __resetIntakeFieldCache(); mute = muteConsole(); });
afterEach(() => { stub?.restore(); stub = undefined; mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// §1 · THE JOIN — the case the live call lost
// ─────────────────────────────────────────────────────────────────────────────
describe('a booking completed after the call carries the qualifier answers', () => {
  test('THE DEFECT, INVERTED: no body call_id, call over — all seven fields still land', async () => {
    stub = stubAll();
    // Exactly the live shape: the widget submits no `call_id` because
    // window.__perchCallId died with the document, and the bridge slot was
    // consumed mid-call. The record is in KV and the browser still holds the key.
    const { res } = await book({ cookie: jar(), envOver: { VANTAGE_WRITE_SECRET: 'vantage-write-secret' } });

    assertBookingIsIntact(res, stub.seen);
    assert.deepEqual(cfvByKey(stub.seen), INTAKE, 'all seven Intake fields on the contact');
    assert.equal(Object.keys(cfvByKey(stub.seen)).length, 7);
    // This WAS the positive arm for the forgery case below: a server-issued,
    // server-confirmed cookie was allowed to become the Vantage merge key. With
    // Vantage severed there is no merge key on any path, so the pair collapses —
    // what remains provable here is that the confirmed id attached the answers,
    // which the seven custom fields and the Clio note above already assert. The
    // join outcome itself is asserted off the KV record in
    // qualifier-join-composition.test.mjs, which reads the firm's own audit trail.
    assertNoVantageCall(stub.seen);
    // And the answers still reach Paul as prose, on the attorney-side note.
    assert.equal(stub.seen.notes.length, 1);
    assert.match(stub.seen.notes[0].data.detail, /— Perch intake —/);
  });

  test('the same booking WITHOUT the cookie is the live failure — 201, contact, zero fields', async () => {
    stub = stubAll();
    // THE CONTROL. Identical KV record, identical form, no carrier. This is what
    // production did on 2026-08-04, and it must still be a clean booking — the
    // defect was never that bookings failed.
    const { res } = await book();

    assertBookingIsIntact(res, stub.seen);
    assert.deepEqual(cfvByKey(stub.seen), {}, 'nothing joined, which is the defect this file fixes');
    // /custom_fields IS read now, and reading it is not the same as joining anything.
    // SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE resolves ids on every booking because
    // `Intake Consult Type` comes off the booking's own typeId and is owed to a
    // booking with no qualifier exactly as much as to one with a qualifier. The
    // assertion that carries this test's meaning is the line above — ZERO of the
    // client's answers joined — and it is unchanged. The lookup firing is a
    // subrequest, not a join; conflating the two is what would let this control go
    // quietly inert the day the id resolution moved.
    // (That reading the list never WRITES one is enforced by the stub itself, which
    // throws on POST /custom_fields — not restated here as an assertion this file
    // does not have the recorder for.)
    assert.equal(stub.seen.cfLists.length, 1, 'ids are resolved for the booking-level field');
  });

  test('the body call_id still wins when it verifies — the live call is not displaced', async () => {
    // A browser holding a cookie from an EARLIER qualifier, on a page that is part
    // of a live call with its own record. The call in front of the caller wins.
    const LIVE = 'call_livesession0001';
    const kv = makeKV({
      [`qualbk:${LIVE}`]: JSON.stringify({ summary: SUMMARY, intake: INTAKE, state: 'FL' }),
      [`qualbk:${CALL_ID}`]: JSON.stringify({
        summary: 'stale', intake: { ...INTAKE, source: 'Stale referral' }, state: 'NY',
      }),
    });
    stub = stubAll();
    const { res } = await book({ b: { call_id: LIVE }, cookie: jar(), kv });

    assertBookingIsIntact(res, stub.seen);
    assert.equal(cfvByKey(stub.seen).source, INTAKE.source, 'the live record, not the cookie’s');
    assert.equal(await kv.get(`qualbk:${LIVE}`), null, 'the record that DID join is spent');
    // The stale record itself is left alone — it belongs to another call and this
    // booking never joined it, so deleting it would be reaching past what happened.
    // The CARRIER is disarmed instead, which is what stops the next person on this
    // browser inheriting it.
    assert.ok(await kv.get(`qualbk:${CALL_ID}`), 'a record this booking did not join is not deleted');
    assert.match(setCookies(res)[0] ?? '', /Max-Age=0/, 'but the stale cookie is disarmed');
  });

  test('a 409 does NOT spend the qualifier — the retry still attaches', async () => {
    // The slot went while the caller was typing. Before this ticket the record was
    // cleared at RESOLVE time, ahead of the availability re-check, so the booking
    // they went on to complete carried nothing. Same silent loss, one retry later.
    const kv = kvWithQualifier();
    const taken = stubFetch(async (url, init) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
      if (u.startsWith('https://app.clio.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));
      // The slot is busy ⇒ getAvailability returns it as taken ⇒ 409 SLOT_TAKEN.
      if (u.startsWith(CLIO_ENTRIES) && method === 'GET') {
        return new Response(JSON.stringify({
          data: [{ id: 1, start_at: SLOT, end_at: new Date(Date.parse(SLOT) + 3600_000).toISOString() }],
        }));
      }
      throw new Error(`unexpected write during a 409: ${method} ${u}`);
    });
    let first;
    try {
      first = await onRequestPost({
        request: post(body(), { cookie: jar() }),
        env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: emptyBridge() }),
      });
    } finally { taken.restore(); }

    assert.equal(first.status, 409);
    assert.equal(JSON.parse(await first.text()).code, 'SLOT_TAKEN');
    assert.ok(await kv.get(`qualbk:${CALL_ID}`), 'the record survives a booking that never happened');
    assert.deepEqual(setCookies(first), [], 'and so does the cookie — the caller is about to retry');

    // The retry, on a free slot, gets everything.
    stub = stubAll();
    const { res } = await book({ cookie: jar(), kv });
    assertBookingIsIntact(res, stub.seen);
    assert.deepEqual(cfvByKey(stub.seen), INTAKE, 'the retry carries the full intake');
  });

  test('one qualifier attaches to at most one booking — the second joins nothing', async () => {
    const kv = kvWithQualifier();
    stub = stubAll();
    const first = await book({ cookie: jar(), kv });
    assert.deepEqual(cfvByKey(stub.seen), INTAKE);
    stub.restore();

    stub = stubAll();
    const second = await book({ cookie: jar(), kv });
    assertBookingIsIntact(second.res, stub.seen);
    assert.deepEqual(cfvByKey(stub.seen), {}, 'the record was spent by the first confirmed booking');
    assert.equal(first.res.status, 201);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · THE CARRIER — armed by the server, spent on use, never believed alone
// ─────────────────────────────────────────────────────────────────────────────
describe('the qualifier cookie is armed, attributed and spent correctly', () => {
  async function submitQualifier(over = {}, kv = makeKV()) {
    const res = await qualifierSubmit({
      request: new Request('https://www.donovan.law/fn/qualifier_submit', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          call_id: CALL_ID,
          matter_category: 'tax', matter_sub: 'planning', for_whom: 'business',
          income_band: '500k_1_5m', net_worth_band: '2m_5m', language: 'en',
          source: 'Google search', state: 'fl',
          ...over,
        }),
      }),
      env: { PERCH_ACTIONS: kv, PERCH_BRIDGE: makeDurableObject() },
      waitUntil: () => {},
    });
    return { res, kv };
  }

  test('fn/qualifier_submit arms the browser with the join key', async () => {
    const { res, kv } = await submitQualifier();
    assert.equal(res.status, 200);
    assert.ok(await kv.get(`qualbk:${CALL_ID}`), 'the record it names actually exists');

    const cookies = setCookies(res);
    assert.equal(cookies.length, 1, 'exactly one Set-Cookie');
    const c = cookies[0];
    assert.match(c, new RegExp(`^${QUALIFIER_COOKIE}=${CALL_ID}(;|$)`), 'the value is the call id');
    assert.match(c, /;\s*HttpOnly/i, 'page script cannot read it — narrower than window.__perchCallId');
    assert.match(c, /;\s*Secure/i);
    assert.match(c, /;\s*SameSite=Lax/i, 'a cross-site POST cannot present it');
    assert.match(c, /;\s*Path=\//i);
    assert.match(c, new RegExp(`Max-Age=${QUALIFIER_COOKIE_MAX_AGE}(;|$)`), 'exactly the record’s own TTL');
  });

  test('the cookie Max-Age and the KV TTL are ONE number, not two that agree today', async () => {
    // A cookie outliving its record names nothing; a record outliving its cookie is
    // a join dropped inside its own lifetime. The source is read rather than the
    // behaviour inferred, because the failure mode is two literals drifting apart.
    const src = readFileSync(
      new URL('../donovan-legal-site/functions/fn/qualifier_submit.js', import.meta.url), 'utf8',
    );
    assert.match(src, /expirationTtl:\s*QUALIFIER_COOKIE_MAX_AGE/,
      'qualifier_submit must take its TTL from the cookie constant, not re-type 60*60*6');
    assert.equal(QUALIFIER_COOKIE_MAX_AGE, 60 * 60 * 6);
  });

  test('no record written ⇒ no cookie armed — we never hand out a key to nothing', async () => {
    // A submission with no admissible answers stores nothing, so there is nothing
    // for a later booking to join and arming the browser would only manufacture an
    // `unverified` refusal indistinguishable in the logs from a forged id.
    const { res, kv } = await submitQualifier({
      matter_category: 'not_a_real_category', matter_sub: '', for_whom: '',
      income_band: '', net_worth_band: '', language: '', source: '', state: '',
    });
    assert.equal(await kv.get(`qualbk:${CALL_ID}`), null, 'nothing stored');
    assert.deepEqual(setCookies(res), [], 'nothing armed');
  });

  test('a confirmed booking spends the cookie', async () => {
    stub = stubAll();
    const { res } = await book({ cookie: jar() });
    const cookies = setCookies(res);
    assert.equal(cookies.length, 1, 'the 201 carries the clear');
    assert.match(cookies[0], new RegExp(`^${QUALIFIER_COOKIE}=;`), 'emptied');
    assert.match(cookies[0], /Max-Age=0/, 'and expired');
    // Same attributes as the set, or the browser keeps the original alongside it.
    for (const attr of [/HttpOnly/i, /Secure/i, /SameSite=Lax/i, /Path=\//i]) {
      assert.match(cookies[0], attr, 'the clear must match the set on name, path and posture');
    }
  });

  test('a booking with no cookie sets none — an ordinary web booking is untouched', async () => {
    stub = stubAll();
    const { res } = await book();
    assert.deepEqual(setCookies(res), [], 'no Set-Cookie on a visitor who never qualified');
  });

  test('THE FORGERY: a fabricated cookie joins nothing and never becomes a merge key', async () => {
    let vantage = null;
    const handle = stubFetch(async (url, init) => {
      const u = String(url);
      const method = init?.method ?? 'GET';
      if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
      if (u.startsWith('https://app.clio.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));
      if (u.startsWith(CLIO_ENTRIES) && method === 'GET') return new Response(JSON.stringify({ data: [] }));
      if (u.startsWith(CLIO_ENTRIES) && method === 'POST') return new Response(JSON.stringify({ data: { id: 9 } }));
      if (u.startsWith(CLIO_CONTACTS) && method === 'GET') return new Response(JSON.stringify({ data: [] }));
      if (u.startsWith(CLIO_CONTACTS) && method === 'POST') return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
      if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') return new Response(JSON.stringify({ data: {} }));
      if (u.startsWith(CLIO_CFIELDS)) throw new Error('nothing to resolve — there is no intake');
      if (u.startsWith(CLIO_NOTES)) return new Response(JSON.stringify({ data: { id: 77 } }));
      if (u.startsWith(VANTAGE_UPSERT)) { vantage = new URL(u); return new Response(JSON.stringify({ ok: true })); }
      throw new Error(`unstubbed fetch: ${method} ${u}`);
    });
    try {
      const res = await onRequestPost({
        request: post(body(), { cookie: jar('call_forgedbyaclient01') }),
        // The KV holds a REAL record for a DIFFERENT call, so "nothing joined" is
        // a refusal of this id rather than an empty store. VANTAGE_WRITE_SECRET is
        // left set on purpose: it is the binding that used to make the upsert fire
        // at all, so a severance asserted with the secret PRESENT is the strong
        // form — nothing is sent even when everything that once enabled it is.
        env: env({
          PERCH_ACTIONS: kvWithQualifier(),
          PERCH_BRIDGE: emptyBridge(),
          VANTAGE_WRITE_SECRET: 'vantage-write-secret',
        }),
      });
      assert.equal(res.status, 201, 'a forged cookie never fails a booking');
      // This used to assert the shape of the Vantage call: it fired, but with no
      // `call_id`, so the forged id opened a FRESH lead instead of merging into a
      // stranger's. With the integration severed the stronger statement holds —
      // the forged id reaches no third party at all.
      assert.ok(!vantage, 'no Vantage upsert-lead — the integration is severed');
    } finally { handle.restore(); }
  });

  test('a look-alike cookie name cannot answer for the real one', () => {
    const req = (h) => new Request('https://www.donovan.law/booking/create', { headers: { cookie: h } });
    assert.equal(readQualifierCookie(req(`x_${QUALIFIER_COOKIE}=nope`)), '');
    assert.equal(readQualifierCookie(req(`${QUALIFIER_COOKIE}_backup=nope`)), '');
    assert.equal(readQualifierCookie(req(`other=${QUALIFIER_COOKIE}=nope`)), '');
    // …and the real one is still read out of a busy jar, in any position.
    assert.equal(readQualifierCookie(req(`a=1; ${QUALIFIER_COOKIE}=${CALL_ID}; b=2`)), CALL_ID);
    assert.equal(readQualifierCookie(req(`${QUALIFIER_COOKIE}=${CALL_ID}`)), CALL_ID);
    assert.equal(readQualifierCookie(req('')), '');
    assert.equal(readQualifierCookie(new Request('https://www.donovan.law/')), '');
  });

  test('the header value can never be split — a hostile id emits no cookie at all', () => {
    for (const bad of [
      'a; Domain=evil.example', 'a\r\nSet-Cookie: x=1', 'a b', '', '   ',
      'default\nX-Injected: 1', '<script>', 'a'.repeat(200),
    ]) {
      assert.equal(setQualifierCookie(bad), '', `refused: ${JSON.stringify(bad)}`);
    }
    assert.match(setQualifierCookie(CALL_ID), new RegExp(`^${QUALIFIER_COOKIE}=${CALL_ID};`));
    assert.match(clearQualifierCookie(), new RegExp(`^${QUALIFIER_COOKIE}=;`));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · PARTIAL WRITES — every field we have, none we do not, never a placeholder
// ─────────────────────────────────────────────────────────────────────────────
describe('the partial-write policy is explicit and is never a placeholder', () => {
  test('a partial qualifier writes exactly what exists and OMITS the rest', async () => {
    stub = stubAll();
    const partial = {
      matter_category: INTAKE.matter_category,
      for_whom:        INTAKE.for_whom,
      language:        INTAKE.language,
    };
    const { res } = await book({ cookie: jar(), kv: kvWithQualifier({ intake: partial }) });

    assertBookingIsIntact(res, stub.seen);
    const written = cfvByKey(stub.seen);
    assert.deepEqual(written, partial, 'the three answered fields, and only those');
    // ABSENT, not empty. A `""` on the body is us asserting the caller answered
    // "nothing"; an absent key is us not asserting anything.
    const sent = new Set(Object.keys(written));
    for (const key of ['matter_sub', 'income_band', 'net_worth_band', 'source']) {
      assert.equal(sent.has(key), false, `${key} was never asked — it must be absent, not blank`);
    }
    for (const row of enrichData(stub.seen).custom_field_values) {
      assert.notEqual(String(row.value).trim(), '', 'no empty value is ever sent');
    }
  });

  test('THE LIVE VALUE: state "address 1" reaches no address on the contact', async () => {
    stub = stubAll();
    // The 2026-08-04 record, verbatim: a form-field LABEL in a value slot, while
    // the dropdown had never been selected. A blank state is honest; "address 1" is
    // a false claim about where a client lives, on a law firm's record.
    //
    // HONEST ABOUT WHAT IS NEW HERE. `buildAddresses` in provider-clio.js ALREADY
    // refused this exact string — it is not two letters and it is not `outside_us`
    // — so this end-to-end assertion passes against the branch head too and is a
    // wall, not a regression. What changed is WHERE the refusal happens: the value
    // is now dropped at the read boundary, before it can be carried into the
    // summary, the Grow lead, the Vantage upsert or any writer added later, and
    // before it is reported as a placeholder rather than passed on silently. The
    // unit assertion below is the part that discriminates; the case above it that
    // does not (`XX`) is the one the old shape check would have written.
    const { res } = await book({ cookie: jar(), kv: kvWithQualifier({ state: 'address 1' }) });

    assertBookingIsIntact(res, stub.seen);
    const data = enrichData(stub.seen);
    assert.equal('addresses' in data, false, 'no address at all — not one saying "address 1"');
    assert.ok(!JSON.stringify(stub.seen).includes('address 1'), 'the string reaches no Clio request');
    assert.deepEqual(cfvByKey(stub.seen), INTAKE, 'and the seven real answers are unaffected');
    assert.equal(selectState('address 1'), '', 'refused at the boundary, not only at the address builder');
  });

  test('a real state still writes the province — the guard is narrow, not blanket', async () => {
    stub = stubAll();
    const { res } = await book({ cookie: jar(), kv: kvWithQualifier({ state: 'fl' }) });
    assertBookingIsIntact(res, stub.seen);
    assert.deepEqual(enrichData(stub.seen).addresses, [{ name: 'Home', province: 'FL' }]);
  });

  test('a two-letter string that is not a state is not a state', async () => {
    stub = stubAll();
    // `/^[A-Za-z]{2}$/` — the check this replaces — admits XX, ZZ and AB. They are
    // the same false claim as "address 1", one validation layer down.
    const { res } = await book({ cookie: jar(), kv: kvWithQualifier({ state: 'XX' }) });
    assertBookingIsIntact(res, stub.seen);
    assert.equal('addresses' in enrichData(stub.seen), false);
  });

  test('placeholder VALUES never reach a custom field', async () => {
    stub = stubAll();
    const { res } = await book({
      cookie: jar(),
      kv: kvWithQualifier({
        intake: {
          matter_category: INTAKE.matter_category,
          matter_sub:      'n/a',
          for_whom:        'unknown',
          income_band:     '—',
          net_worth_band:  'TBD',
          language:        'Select…',
          source:          'address 2',
        },
      }),
    });

    assertBookingIsIntact(res, stub.seen);
    assert.deepEqual(cfvByKey(stub.seen), { matter_category: INTAKE.matter_category },
      'the one real answer, and nothing standing in for the six that are not');
    const bodies = JSON.stringify(stub.seen);
    for (const junk of ['n/a', 'unknown', 'TBD', 'Select…', 'address 2']) {
      assert.ok(!bodies.includes(junk), `"${junk}" reaches no Clio request`);
    }
  });

  test('THE SHARP EDGE: "Declined to say" is an ANSWER and must be written', async () => {
    stub = stubAll();
    // A caller who declined to state their income band answered the question. That
    // answer is exactly what the firm needs on the record, and a placeholder filter
    // that reasons about how informative a value looks would eat it.
    const { res } = await book({
      cookie: jar(),
      kv: kvWithQualifier({ intake: { ...INTAKE, income_band: 'Declined to say', net_worth_band: 'Declined to say' } }),
    });
    assertBookingIsIntact(res, stub.seen);
    assert.equal(cfvByKey(stub.seen).income_band, 'Declined to say');
    assert.equal(cfvByKey(stub.seen).net_worth_band, 'Declined to say');
  });

  test('no qualifier at all writes none of the seven, and still books', async () => {
    stub = stubAll();
    const { res } = await book({ kv: makeKV() });
    assertBookingIsIntact(res, stub.seen);
    assert.deepEqual(cfvByKey(stub.seen), {});
    assert.equal(stub.seen.contacts.length, 1, 'the contact is still created from the form');
    assert.equal(stub.seen.notes.length, 1, 'and the intake note is still filed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 · SELF-REPORTED ONLY — no post-call characterisation, whatever Retell offers
// ─────────────────────────────────────────────────────────────────────────────
describe('only self-reported answers are persisted to the contact', () => {
  test('a record stuffed with post-call analysis writes NONE of it', async () => {
    stub = stubAll();
    const derived = Object.fromEntries(DERIVED_REFUSED.map((k) => [k, `DERIVED_${k}`]));
    const { res } = await book({
      cookie: jar(),
      kv: kvWithQualifier({ intake: { ...INTAKE, ...derived } }),
    });

    assertBookingIsIntact(res, stub.seen);
    assert.deepEqual(cfvByKey(stub.seen), INTAKE, 'the seven answers, and not one derived field');
    const bodies = JSON.stringify(stub.seen);
    for (const key of DERIVED_REFUSED) {
      assert.ok(!bodies.includes(`DERIVED_${key}`), `no value for "${key}" reaches Clio`);
    }
  });

  test('the gate is an ALLOW-LIST — a field invented tomorrow is refused by default', () => {
    const { fields, rejected } = selectIntakeFields({
      ...INTAKE,
      a_field_nobody_has_thought_of_yet: 'Very interested',
      user_sentiment: 'Positive',
    });
    assert.deepEqual(fields, INTAKE);
    assert.ok(rejected.includes('a_field_nobody_has_thought_of_yet'),
      'refused because it is not on the allow-list, not because it was foreseen');
    assert.ok(rejected.includes('user_sentiment'));
  });

  test('the allow-list is exactly the seven Clio Intake fields, and never a derived one', () => {
    assert.deepEqual([...SELF_REPORTED_KEYS], INTAKE_CUSTOM_FIELDS.map((f) => f.key));
    assert.equal(SELF_REPORTED_KEYS.length, 7);
    const overlap = DERIVED_REFUSED.filter((k) => SELF_REPORTED_KEYS.includes(k));
    assert.deepEqual(overlap, [], 'no key may be both self-reported and derived');
  });

  test('a refused key is reported by NAME — never by value', async () => {
    // The refusal has to be visible to whoever is asked "why is this contact
    // blank?", and the values are the client's finances.
    // Asserted on the policy's own report, which is exactly what create.js
    // interpolates into its warn line — so this proves the material the log is
    // BUILT from is name-only, rather than proving the log happened to be muted.
    const { placeholders, rejected } = selectIntakeFields({
      income_band: 'n/a', user_sentiment: 'Frustrated about the IRS notice',
    });
    const lines = [...placeholders, ...rejected];

    assert.ok(lines.includes('income_band'));
    assert.ok(lines.includes('user_sentiment'));
    for (const entry of lines) {
      assert.ok(!entry.includes('Frustrated'), 'a value never appears in a reportable name');
      assert.ok(!entry.includes('n/a'));
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 · THE UNITS
// ─────────────────────────────────────────────────────────────────────────────
describe('intake-policy, driven directly', () => {
  test('isPlaceholder refuses scaffolding and admits answers', () => {
    for (const junk of [
      '', '   ', '-', '—', '...', 'n/a', 'N / A', 'NA', 'none', 'null', 'undefined',
      'unknown', '(unknown)', 'TBD', 'Select…', 'Select one', 'placeholder', 'default',
      'address 1', 'Address 2', 'line 3', 'field_4', 'option #1', 'xx',
    ]) {
      assert.equal(isPlaceholder(junk), true, `placeholder: ${JSON.stringify(junk)}`);
    }
    for (const real of [
      'Tax', 'Planning', 'Business / company', '$500K–$1.5M', '$2M–$5M', 'English',
      'Google search', 'Declined to say', 'Undetermined (exam stage)', 'Not sure yet',
      'Referred by a client', 'Above $15M', 'Under $500K', 'Real estate',
    ]) {
      assert.equal(isPlaceholder(real), false, `answer: ${JSON.stringify(real)}`);
    }
  });

  test('a nested object is refused, not coerced to "[object Object]"', () => {
    const { fields, placeholders } = selectIntakeFields({ source: { utm: 'google' }, language: ['en'] });
    assert.deepEqual(fields, {});
    assert.ok(placeholders.includes('source'));
    assert.ok(placeholders.includes('language'));
  });

  test('omitted lists every unanswered field, not just the ones the record mentioned', () => {
    const { fields, omitted } = selectIntakeFields({ language: 'English' });
    assert.deepEqual(fields, { language: 'English' });
    assert.deepEqual(omitted.sort(), SELF_REPORTED_KEYS.filter((k) => k !== 'language').sort());
  });

  test('a missing, null or array intake degrades to nothing, never to a throw', () => {
    for (const raw of [undefined, null, '', 0, [], ['a'], 'string']) {
      const r = selectIntakeFields(raw);
      assert.deepEqual(r.fields, {});
      assert.deepEqual(r.rejected, []);
    }
  });

  test('selectState admits the 51 codes and outside_us, and nothing else', () => {
    assert.equal(selectState('fl'), 'FL');
    assert.equal(selectState(' NY '), 'NY');
    assert.equal(selectState('DC'), 'DC');
    assert.equal(selectState('OUTSIDE_US'), OUTSIDE_US);
    assert.equal(selectState(OUTSIDE_US), OUTSIDE_US);
    for (const bad of ['XX', 'ZZ', 'AB', 'address 1', 'Florida', '', null, undefined, 'F', 'FLA', 'n/a']) {
      assert.equal(selectState(bad), '', `refused: ${JSON.stringify(bad)}`);
    }
  });

  test('the state list is the SAME list the qualifier card offers', () => {
    // Read from the card's own constant rather than re-typed. The two lists sitting
    // in different trees is exactly how a state the caller can select becomes a
    // state the server drops — silently, for that one caller.
    const src = readFileSync(
      new URL('../donovan-legal-site/js/perch/qualifier.js', import.meta.url), 'utf8',
    );
    const m = src.match(/const US_STATES = '([^']+)'/);
    assert.ok(m, 'the qualifier still declares US_STATES as a single-quoted string');
    const offered = m[1].split('|').map((s) => s.slice(0, s.indexOf(' ')));
    assert.deepEqual([...US_STATE_CODES].sort(), offered.sort(),
      'every state the card offers is a state the contact accepts, and vice versa');
  });
});
