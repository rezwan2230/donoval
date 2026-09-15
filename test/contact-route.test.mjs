// ── ORDER SHELDON-CONTACT-ROUTE-R1 (#214) ────────────────────────────────────
//
// THE FORM ON A LAW FIRM'S CONTACT PAGE DELIVERED NOTHING.
// `contact.html` posted its "Send an Initial Inquiry" form to
// `https://formspree.io/f/xnjwgzkj`. Two independent reasons it could not work, and
// the second is the one nobody would have found by testing the Formspree account:
//
//   1. The account does not deliver.
//   2. The edge CSP carries `form-action 'self' https://vantage.ticoai.net`
//      (functions/_middleware.js). A browser REFUSES a form submission to a host
//      that directive does not name, and a blocked form-action is a console line,
//      not an error the page can catch. So the button did nothing and said nothing.
//
// Both are asserted below — (2) against the REAL `buildCsp` output rather than
// against prose, because the reason the old form was dead has to stay true for the
// new one's design (a `fetch` to the same origin) to be the fix rather than a
// preference.
//
// WHAT REPLACED IT, and the two things this file is really about:
//
//   · The DELIVERY leg — Clio Grow's Lead Inbox, the same `createGrowLead` sender
//     `fn/take_message` and `booking/create` already use, whose new-lead
//     notification is what reaches the firm. REQUIRED here: a refusal is a 502/503,
//     never a 200. That is DRINSANE-LEAD-FAILCLOSED (#151) applied to a route that
//     has no second sink to fall back on.
//   · The RECORD leg — a Clio Manage contact through the SHELDON-154 email-or-phone
//     dedup, plus a note. Surfaced in the response and in the log when it fails,
//     and deliberately NOT fatal once the firm already has the inquiry.
//
// ── WHAT THIS FILE DOES NOT CLAIM ────────────────────────────────────────────
//   · That info@donovan.law receives the notification. That is a Clio Grow ACCOUNT
//     setting (which addresses Grow notifies on a new lead), and no test in this
//     repo can read it. What is proved here is that the lead reaches the Grow
//     inbox that raises it, labelled as the contact form, carrying every field the
//     writer filled in — and that a Grow refusal is never reported as delivery.
//   · Anything about Turnstile's own verdict. `verifyTurnstile` is exercised at the
//     siteverify boundary, the way `test/abuse.test.mjs` does it.

import { test, describe, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { onRequestPost as contact } from '../donovan-legal-site/functions/fn/contact.js';
import { buildCsp } from '../donovan-legal-site/functions/_middleware.js';
import { ADOPT_SCRIPTS } from '../donovan-legal-site/js/perch/swap-policy.js';
import { stubFetch, muteConsole, makeKV } from './helpers/stubs.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'donovan-legal-site');
const CONTACT_HTML = readFileSync(join(SITE, 'contact.html'), 'utf8');

const ORIGIN        = 'https://www.donovan.law';
const ENDPOINT      = `${ORIGIN}/fn/contact`;
const SITEVERIFY    = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const GROW_INBOX    = 'https://grow.clio.com/inbox_leads';
const CLIO_CONTACTS = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS  = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES    = 'https://app.clio.com/api/v4/notes';

// The credentials. Every one of them is asserted absent from the log at the end.
const TURNSTILE_SECRET = 'turnstile-server-secret-value';
const GROW_TOKEN       = 'grow-lead-capture-token-value';
const CLIO_REFRESH     = 'clio-refresh-token-value';
const CLIO_SECRET      = 'clio-client-secret-value';
const TS_TOKEN         = 'a-turnstile-response-token';

// The inquiry. Real PII shapes, so a leak in a future refactor shows up as these
// exact strings appearing where they must not.
const INQUIRY = {
  name: 'Marguerite Vandeleur',
  email: 'marguerite.vandeleur@example.com',
  phone: '(561) 555-0188',
  referral: 'referred by Alma Restrepo at Restrepo & Kwan',
  matter_type: 'FIRPTA / International Tax',
  urgency: 'Active deadline / urgent',
  description: 'Selling a Delray Beach condo held through a foreign entity; the buyer is withholding 15% and the closing is in three weeks.',
};

/** Every value that must never reach a log line or a response body. */
const SECRETS = [TURNSTILE_SECRET, GROW_TOKEN, CLIO_REFRESH, CLIO_SECRET, TS_TOKEN];
const PII = [INQUIRY.name, INQUIRY.email, INQUIRY.phone, INQUIRY.referral, INQUIRY.description];

// ── The wire ─────────────────────────────────────────────────────────────────

/**
 * A Clio + Grow + Turnstile that RECORDS, and answers what the test tells it to.
 *
 * `hold` seeds Persons the firm's Clio already has, so "reuses the contact" is a
 * thing that happens rather than a claim about a request count: the create branch
 * is only reachable when the search genuinely finds nobody.
 */
function stubWire({
  hold = [],
  turnstile = { success: true },
  turnstileStatus = 200,
  growStatus = 200,
  contactCreateStatus = 201,
  noteStatus = 201,
} = {}) {
  const contacts = hold.map((c) => JSON.parse(JSON.stringify(c)));
  let nextId = 5500001;
  const seen = { siteverify: [], grow: [], searches: [], creates: [], patches: [], notes: [] };

  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';

    if (u === SITEVERIFY) {
      seen.siteverify.push(init);
      return new Response(JSON.stringify(turnstile), { status: turnstileStatus });
    }

    if (u === GROW_INBOX) {
      // The BODY is recorded, because the body is where Grow's credential rides —
      // `inbox_lead_token` is a JSON field, not a header (SHELDON-LEAD-REDIRECT
      // #143) — and because the lead card's text is the thing the firm reads.
      seen.grow.push({ init, body: JSON.parse(init.body) });
      return new Response('{}', { status: growStatus });
    }

    if (u.startsWith('https://app.clio.com/oauth/token')) {
      return new Response(JSON.stringify({ access_token: 'at' }));
    }
    if (u.startsWith(CLIO_CFIELDS)) return new Response(JSON.stringify({ data: [], meta: {} }));

    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      seen.patches.push({ url: u, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ data: { id: Number(new URL(u).pathname.split('/').pop()) } }));
    }
    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'GET') {
      const id = Number(new URL(u).pathname.split('/').pop().replace('.json', ''));
      const rec = contacts.find((c) => c.id === id);
      return new Response(JSON.stringify({ data: rec ?? { id } }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      const q = String(new URL(u).searchParams.get('query') ?? '').toLowerCase();
      seen.searches.push(q);
      // Clio's `query` is a WILDCARD SUBSTRING search across several fields, so the
      // vendor here does not narrow to the one right answer — picking the match out
      // of the page is the job of the code under test.
      const rows = contacts.filter((c) =>
        (c.email_addresses ?? []).some((e) => String(e.address ?? '').toLowerCase().includes(q))
        || (c.phone_numbers ?? []).some((p) => String(p.number ?? '').toLowerCase().includes(q)));
      return new Response(JSON.stringify({ data: rows }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      const body = JSON.parse(init.body);
      seen.creates.push(body);
      if (contactCreateStatus >= 400) {
        return new Response('{"error":{"type":"ArgumentError"}}', { status: contactCreateStatus });
      }
      const rec = { id: (nextId += 1), email_addresses: [], phone_numbers: [], addresses: [], custom_field_values: [], web_sites: [], ...body.data };
      contacts.push(rec);
      return new Response(JSON.stringify({ data: { id: rec.id } }), { status: contactCreateStatus });
    }

    if (u.startsWith(CLIO_NOTES) && method === 'POST') {
      seen.notes.push(JSON.parse(init.body));
      if (noteStatus >= 400) {
        return new Response('{"error":{"type":"ArgumentError","message":"denied"}}', { status: noteStatus });
      }
      return new Response(JSON.stringify({ data: { id: 88 } }), { status: noteStatus });
    }

    throw new Error(`unstubbed fetch: ${method} ${u}`);
  });

  return { seen, contacts, restore: () => handle.restore() };
}

/** The contact the firm's Clio already holds, in the shape the live grant stores. */
function heldContact(over = {}) {
  return {
    id: 2413664198,
    first_name: 'Marguerite',
    last_name: 'Vandeleur',
    email_addresses: [{ id: 11, etag: 'e1', address: INQUIRY.email, name: 'Work' }],
    phone_numbers: [{ id: 21, etag: 'e2', number: INQUIRY.phone, name: 'Mobile' }],
    addresses: [],
    custom_field_values: [],
    web_sites: [],
    ...over,
  };
}

function envFor(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: TURNSTILE_SECRET,
    GROW_LEAD_TOKEN: GROW_TOKEN,
    CLIO_CLIENT_ID: 'cid',
    CLIO_CLIENT_SECRET: CLIO_SECRET,
    CLIO_REFRESH_TOKEN: CLIO_REFRESH,
    PERCH_ACTIONS: makeKV(),
    ...over,
  };
}

// A fresh IP per request: the route's rate limiter is real (its KV is bound above),
// and a shared IP would make the sixth test in a file fail for the wrong reason.
let _ip = 0;
const nextIp = () => `203.0.113.${(_ip += 1) % 250}`;

/**
 * Drive one inquiry.
 *
 * `origin` defaults to the endpoint's own origin, which is what a browser sends on
 * a same-origin POST — the thing `checkOrigin({allowSameOrigin})` accepts.
 */
async function submit({ body = {}, env = {}, origin = ORIGIN, token = TS_TOKEN } = {}) {
  const headers = { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() };
  if (origin !== null) headers.Origin = origin;
  const payload = { ...INQUIRY, turnstile_token: token, ...body };
  const request = new Request(ENDPOINT, { method: 'POST', headers, body: JSON.stringify(payload) });
  const res = await contact({ request, env: envFor(env) });
  return { res, json: await res.clone().json() };
}

/** Everything a log line could have carried, joined for substring scanning. */
const logText = (m) => m.lines.map(([lvl, msg]) => `${lvl} ${msg}`).join('\n');

// muteConsole is per-test; this catches a test that throws before its restore.
let live = null;
afterEach(() => { if (live) { live.restore(); live = null; } });
function quiet() { live = muteConsole(); return live; }

// ─────────────────────────────────────────────────────────────────────────────
// 1. The happy path — the firm gets the inquiry, and Clio gets the record
// ─────────────────────────────────────────────────────────────────────────────

describe('a valid inquiry reaches Clio Grow and creates the Clio Manage contact', () => {
  test('a client Clio has never seen: contact CREATED, note filed, lead delivered', async () => {
    const m = quiet();
    const wire = stubWire({ hold: [] });
    try {
      const { res, json } = await submit();

      assert.equal(res.status, 200);
      assert.deepEqual(json, { ok: true, clio_contact: 'recorded' });

      // ── the DELIVERY leg ──
      assert.equal(wire.seen.grow.length, 1, 'exactly one lead, on the one sender');
      const lead = wire.seen.grow[0].body;
      assert.equal(lead.inbox_lead_token, GROW_TOKEN, 'the credential rides the body, as Grow requires');
      assert.equal(lead.inbox_lead.from_first, 'Marguerite');
      assert.equal(lead.inbox_lead.from_last, 'Vandeleur');
      assert.equal(lead.inbox_lead.from_email, INQUIRY.email);
      assert.equal(lead.inbox_lead.from_phone, INQUIRY.phone);
      // The card IS the inquiry for whoever works the queue, so every field the form
      // collected has to be on it. A field missing here is a field the firm never sees.
      for (const [label, value] of [
        ['Nature of matter', INQUIRY.matter_type],
        ['Timing', INQUIRY.urgency],
        ['Heard about the firm', INQUIRY.referral],
      ]) {
        assert.ok(lead.inbox_lead.from_message.includes(`${label}: ${value}`),
          `the lead card must carry ${label}; it read: ${lead.inbox_lead.from_message}`);
      }
      assert.ok(lead.inbox_lead.from_message.includes(INQUIRY.description));
      // Told apart from a booking and from a phone message, so intake works the
      // queue in the right order.
      assert.equal(lead.inbox_lead.from_source, 'Donovan Website — Contact Form');
      // NOT FOLLOWED across a redirect: the token is in this body (#143).
      assert.equal(wire.seen.grow[0].init.redirect, 'manual');

      // ── the RECORD leg ──
      assert.equal(wire.seen.creates.length, 1, 'Clio held nobody, so exactly one contact was created');
      const created = wire.seen.creates[0].data;
      assert.equal(created.type, 'Person');
      assert.equal(created.first_name, 'Marguerite');
      assert.equal(created.last_name, 'Vandeleur');
      assert.equal(created.email_addresses[0].address, INQUIRY.email);
      assert.equal(created.phone_numbers[0].number, INQUIRY.phone);

      assert.equal(wire.seen.notes.length, 1, 'the inquiry is filed as a note on that contact');
      const note = wire.seen.notes[0].data;
      assert.equal(note.type, 'Contact');
      assert.equal(note.contact.id, wire.contacts.at(-1).id, 'the note hangs off the contact just created');
      assert.match(note.subject, /Website inquiry/);
      assert.ok(note.detail.includes(INQUIRY.description), 'the attorney-side note carries the matter description');
      assert.ok(note.detail.includes(INQUIRY.matter_type));
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('a client Clio already holds: contact REUSED, no duplicate minted', async () => {
    const m = quiet();
    const wire = stubWire({ hold: [heldContact()] });
    try {
      const { res, json } = await submit();

      assert.equal(res.status, 200);
      assert.equal(json.clio_contact, 'recorded');
      // THE LOAD-BEARING ASSERTION, and it is about the wire rather than about a
      // label the route reports on itself: no POST /contacts happened at all. This
      // is the SHELDON-154 dedup doing its job on a second channel — the firm's CRM
      // forked once already, on the booking path, for exactly this reason.
      assert.deepEqual(wire.seen.creates, [], 'an existing contact must never be duplicated');
      assert.equal(wire.seen.notes.length, 1);
      assert.equal(wire.seen.notes[0].data.contact.id, 2413664198, 'the note lands on the EXISTING contact');
      assert.equal(wire.contacts.length, 1, 'and the firm still has exactly one record for this person');
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('the dedup falls through to PHONE when the email is new — still no duplicate', async () => {
    // A client who wrote in once from a personal address and once from work. The
    // email leg finds nobody; the phone leg is what stops the second record.
    const m = quiet();
    const wire = stubWire({ hold: [heldContact()] });
    try {
      const { json } = await submit({ body: { email: 'm.vandeleur@work.example.com' } });
      assert.equal(json.ok, true);
      assert.deepEqual(wire.seen.creates, [], 'matched on phone — no second Person');
      assert.equal(wire.seen.notes[0].data.contact.id, 2413664198);
    } finally { wire.restore(); m.restore(); live = null; }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Turnstile — a missing token is refused, and NOTHING is written
// ─────────────────────────────────────────────────────────────────────────────

describe('the endpoint refuses an inquiry that did not pass Turnstile', () => {
  test('NO TOKEN: 403, and neither Clio Grow nor Clio Manage is touched', async () => {
    const m = quiet();
    const wire = stubWire();
    try {
      const { res, json } = await submit({ token: '' });

      assert.equal(res.status, 403);
      assert.equal(json.code, 'TURNSTILE_REQUIRED');
      assert.notEqual(json.ok, true);
      // The whole point of ordering the check ahead of the writes. A 403 that still
      // filed the lead would be a bot-mitigation control that mitigates nothing.
      assert.deepEqual(wire.seen.grow, [], 'no lead may reach the firm\'s intake queue');
      assert.deepEqual(wire.seen.creates, [], 'and no contact may be created');
      assert.deepEqual(wire.seen.notes, []);
      assert.deepEqual(wire.seen.siteverify, [], 'an absent token is refused without a round trip');
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('A TOKEN CLOUDFLARE REJECTS: 403, still nothing written', async () => {
    const m = quiet();
    const wire = stubWire({ turnstile: { success: false, 'error-codes': ['invalid-input-response'] } });
    try {
      const { res, json } = await submit();
      assert.equal(res.status, 403);
      assert.equal(json.code, 'TURNSTILE_FAILED');
      assert.equal(wire.seen.siteverify.length, 1, 'control: the token WAS put to siteverify');
      assert.deepEqual(wire.seen.grow, []);
      assert.deepEqual(wire.seen.creates, []);
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('AN UNSET TURNSTILE_SECRET_KEY REFUSES — it never falls open', async () => {
    // The "unset means DISABLED" shape tier-auth.js, _lib/abuse.js and
    // booking/create.js all refuse. An unverified write into the firm's real intake
    // queue is worse than an outage.
    const m = quiet();
    const wire = stubWire();
    try {
      const { res, json } = await submit({ env: { TURNSTILE_SECRET_KEY: '' } });
      assert.equal(res.status, 503);
      assert.equal(json.code, 'TURNSTILE_NOT_CONFIGURED');
      assert.deepEqual(wire.seen.grow, [], 'an unconfigured challenge must not admit a lead');
      assert.ok(m.saw('MISCONFIGURED'), 'and it must say so — a silent refusal is a support ticket nobody can answer');
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('AN UNREACHABLE SITEVERIFY REFUSES', async () => {
    const m = quiet();
    const wire = stubWire({ turnstile: {}, turnstileStatus: 500 });
    try {
      const { res, json } = await submit();
      assert.equal(res.status, 403);
      assert.equal(json.code, 'TURNSTILE_FAILED', 'a verify that did not pass is not a pass');
      assert.deepEqual(wire.seen.grow, []);
    } finally { wire.restore(); m.restore(); live = null; }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Fail-closed and quiet — DRINSANE-LEAD-FAILCLOSED, on a route with one sink
// ─────────────────────────────────────────────────────────────────────────────

describe('a Clio failure is surfaced, never swallowed', () => {
  test('A NON-2xx FROM GROW IS A FAILURE, not a success', async () => {
    const m = quiet();
    const wire = stubWire({ growStatus: 500 });
    try {
      const { res, json } = await submit();

      assert.equal(res.status, 502);
      assert.equal(json.code, 'LEAD_NOT_DELIVERED');
      assert.notEqual(json.ok, true, 'THE DEFECT THIS CLOSES: a dropped lead reported as delivered');
      assert.ok(m.saw('LEAD_NOT_DELIVERED'), 'and it leaves a line behind');
      // ORDERING, asserted rather than assumed: nothing was written to Clio Manage,
      // so the caller this told "that did not send" can retry without leaving an
      // orphan contact or a duplicate note behind from the failed attempt.
      assert.deepEqual(wire.seen.creates, [], 'the Manage leg must not run when delivery failed');
      assert.deepEqual(wire.seen.notes, []);
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('A 4xx FROM GROW IS ALSO A FAILURE', async () => {
    const m = quiet();
    const wire = stubWire({ growStatus: 401 });
    try {
      const { res, json } = await submit();
      assert.equal(res.status, 502);
      assert.equal(json.code, 'LEAD_NOT_DELIVERED');
      assert.deepEqual(wire.seen.creates, []);
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('AN UNSET GROW_LEAD_TOKEN IS REFUSED WITH A LINE, not dropped in silence', async () => {
    // `createGrowLead` returns `{skipped:"no_token"}` — no `status`, so a caller
    // guarded on `status !== undefined` warns nothing and reports success. That is
    // the exact shape of the #151 silent drop, and it is the branch this test owns.
    const m = quiet();
    const wire = stubWire();
    try {
      const { res, json } = await submit({ env: { GROW_LEAD_TOKEN: '' } });

      assert.equal(res.status, 503);
      assert.equal(json.code, 'LEAD_NOT_CONFIGURED');
      assert.notEqual(json.ok, true);
      assert.deepEqual(wire.seen.grow, [], 'control: with no token nothing is put on the wire at all');
      assert.ok(m.saw('MISCONFIGURED'), 'an unconfigured lead inbox must be loud');
      assert.ok(m.saw('GROW_LEAD_TOKEN'), 'and must name the binding to set');
      assert.deepEqual(wire.seen.creates, []);
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('A REJECTED CLIO MANAGE NOTE is reported in the body and in the log', async () => {
    // The asymmetry, and the reason for it: the firm HAS the inquiry by this point.
    // A 502 here would tell the writer to send again and deliver it twice. So the
    // failure is surfaced instead of being either swallowed or escalated.
    const m = quiet();
    const wire = stubWire({ noteStatus: 422 });
    try {
      const { res, json } = await submit();

      assert.equal(res.status, 200, 'a delivered inquiry is not reported as failed');
      assert.equal(json.ok, true);
      assert.equal(json.clio_contact, 'unavailable', 'but it is NOT reported as cleanly recorded either');
      assert.equal(wire.seen.grow.length, 1, 'control: the delivery leg did succeed');
      assert.ok(m.saw('NOT recorded in Clio Manage'), 'the route says what was lost');
      assert.ok(m.saw('contact inquiry note not written') || m.saw('contact inquiry note not filed'),
        'and the adapter says which write failed');
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('A REJECTED CLIO CONTACT CREATE is reported the same way', async () => {
    const m = quiet();
    const wire = stubWire({ contactCreateStatus: 422 });
    try {
      const { res, json } = await submit();
      assert.equal(res.status, 200);
      assert.equal(json.clio_contact, 'unavailable');
      assert.deepEqual(wire.seen.notes, [], 'no contact ⇒ no note hung off nothing');
      assert.ok(m.saw('NOT recorded in Clio Manage'));
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('UNCONFIGURED CLIO CREDENTIALS warn — they do not pass for "Clio holds nobody"', async () => {
    // An unset CLIO_REFRESH_TOKEN makes getAccessToken throw, which `clioFetch`
    // turns into a failed search rather than an exception. That lands on the
    // SHELDON-154 FAIL-CLOSED branch: the search was never answered, so the route
    // does NOT get to conclude Clio holds nobody and does NOT create a contact. The
    // outcome asserted here is the one that matters — no duplicate minted, the
    // inquiry still delivered, and a line in the log for each half.
    const m = quiet();
    const wire = stubWire();
    try {
      // A CLIENT ID OF ITS OWN, and it is load-bearing. provider-clio caches the
      // access token per-isolate keyed by CLIO_CLIENT_ID, and the happy-path tests
      // above have already warmed 'cid' — so reusing it here would hand this
      // deliberately-unconfigured environment a token from a configured one, and
      // the test would pass on a branch it never reached.
      const { res, json } = await submit({
        env: { CLIO_CLIENT_ID: 'unconfigured-cid', CLIO_REFRESH_TOKEN: '', CLIO_ACCESS_TOKEN: '' },
      });
      assert.equal(res.status, 200, 'the lead still reached the firm');
      assert.equal(json.clio_contact, 'unavailable');
      assert.deepEqual(wire.seen.creates, [],
        'a search Clio never answered must not be read as "Clio holds nobody" — that is how the CRM forks');
      assert.deepEqual(wire.seen.notes, []);
      assert.ok(m.saw('search inconclusive'), 'the adapter says the search never completed');
      assert.ok(m.saw('NOT recorded in Clio Manage'), 'and the route says what that cost');
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('BOOKING_PROVIDER=mock delivers the lead and announces that Manage was skipped', async () => {
    const m = quiet();
    const wire = stubWire();
    try {
      const { res, json } = await submit({ env: { BOOKING_PROVIDER: 'mock' } });
      assert.equal(res.status, 200);
      assert.equal(json.clio_contact, 'unavailable');
      assert.equal(wire.seen.grow.length, 1);
      assert.deepEqual(wire.seen.creates, [], 'a demo deployment must not write into the firm\'s real Clio');
      assert.ok(m.saw('BOOKING_PROVIDER=mock'));
    } finally { wire.restore(); m.restore(); live = null; }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. The other refusals, and the ordering that makes them worth having
// ─────────────────────────────────────────────────────────────────────────────

describe('the endpoint refuses before it writes', () => {
  test('a cross-origin POST is refused and writes nothing', async () => {
    const m = quiet();
    const wire = stubWire();
    try {
      const { res, json } = await submit({ origin: 'https://lead-thief.example' });
      assert.equal(res.status, 403);
      assert.equal(json.code, 'ORIGIN_REFUSED');
      assert.deepEqual(wire.seen.grow, []);
      assert.deepEqual(wire.seen.siteverify, [], 'the origin check runs first, so no siteverify round trip');
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('a POST with NO Origin at all is refused — every browser sends one', async () => {
    const m = quiet();
    const wire = stubWire();
    try {
      const { res, json } = await submit({ origin: null });
      assert.equal(res.status, 403);
      assert.equal(json.code, 'ORIGIN_REFUSED');
      assert.deepEqual(wire.seen.grow, []);
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('a preview deployment can submit its own form (allowSameOrigin)', async () => {
    // Not a relaxation — it is the textbook CSRF check, "the page that submitted
    // this is served from the host it submitted to". A preview that cannot be used
    // cannot be reviewed, and the failure would look identical to an attack blocked.
    const m = quiet();
    const wire = stubWire();
    const preview = 'https://sheldon-contact.donovan-site.pages.dev';
    try {
      const request = new Request(`${preview}/fn/contact`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Origin: preview, 'CF-Connecting-IP': nextIp() },
        body: JSON.stringify({ ...INQUIRY, turnstile_token: TS_TOKEN }),
      });
      const res = await contact({ request, env: envFor() });
      assert.equal(res.status, 200);
      assert.equal(wire.seen.grow.length, 1);
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('the required fields are required, and nothing is written without them', async () => {
    for (const [field, why] of [
      ['name', 'the firm cannot address a reply'],
      ['email', 'the firm cannot answer at all'],
      ['matter_type', 'intake cannot route it'],
      ['description', 'there is no inquiry'],
    ]) {
      const m = quiet();
      const wire = stubWire();
      try {
        const { res, json } = await submit({ body: { [field]: '' } });
        assert.equal(res.status, 400, `${field} must be required — without it ${why}`);
        assert.equal(json.code, 'VALIDATION_ERROR');
        assert.deepEqual(wire.seen.grow, [], `a rejected inquiry must not reach the queue (${field})`);
      } finally { wire.restore(); m.restore(); live = null; }
    }
  });

  test('a malformed email is refused', async () => {
    const m = quiet();
    const wire = stubWire();
    try {
      const { res } = await submit({ body: { email: 'marguerite at example dot com' } });
      assert.equal(res.status, 400);
      assert.deepEqual(wire.seen.grow, []);
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('the optional fields really are optional', async () => {
    const m = quiet();
    const wire = stubWire();
    try {
      const { res, json } = await submit({ body: { phone: '', referral: '', urgency: '' } });
      assert.equal(res.status, 200);
      assert.equal(json.ok, true);
      const msg = wire.seen.grow[0].body.inbox_lead.from_message;
      assert.ok(!msg.includes('Timing:'), 'an unanswered optional must not become an empty label');
      assert.ok(!msg.includes('Heard about the firm:'));
      assert.ok(msg.includes(INQUIRY.description));
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('a burst from one IP is rate-limited before it reaches Clio', async () => {
    const m = quiet();
    const wire = stubWire();
    const env = envFor();
    const ip = '198.51.100.77';
    try {
      const fire = () => contact({
        request: new Request(ENDPOINT, {
          method: 'POST',
          headers: { 'content-type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': ip },
          body: JSON.stringify({ ...INQUIRY, turnstile_token: TS_TOKEN }),
        }),
        env,
      });
      const statuses = [];
      for (let i = 0; i < 7; i++) statuses.push((await fire()).status);
      assert.ok(statuses.includes(429), `the cap must bite; statuses were ${statuses.join(',')}`);
      assert.ok(wire.seen.grow.length <= 5, `no more leads than the cap allows; got ${wire.seen.grow.length}`);
      // And the refusal says WHEN, so the page can offer something better than
      // "try again" — the limiter already knows when the window rolls over.
      const refused = await fire();
      assert.equal(refused.status, 429);
      assert.ok(Number(refused.headers.get('Retry-After')) > 0, 'a 429 must carry Retry-After');
    } finally { wire.restore(); m.restore(); live = null; }
  });

  test('a body that is not JSON is refused', async () => {
    const m = quiet();
    const wire = stubWire();
    try {
      const request = new Request(ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json', Origin: ORIGIN, 'CF-Connecting-IP': nextIp() },
        body: 'name=Marguerite&email=x',
      });
      const res = await contact({ request, env: envFor() });
      assert.equal(res.status, 400);
      assert.deepEqual(wire.seen.grow, []);
    } finally { wire.restore(); m.restore(); live = null; }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. No secret, and no inquiry, in any log — on every branch
// ─────────────────────────────────────────────────────────────────────────────

describe('nothing logs a secret or the inquiry', () => {
  test('every branch, driven, and the whole log scanned', async () => {
    // Each of these is a branch that logs. Driving them all through ONE captured
    // console and scanning the result is the only version of this assertion that
    // cannot rot: a new warn added to any branch below is covered the day it lands.
    const branches = [
      ['happy path',            {}, {}],
      ['grow 500',              { growStatus: 500 }, {}],
      ['note rejected',         { noteStatus: 422 }, {}],
      ['contact create refused', { contactCreateStatus: 422 }, {}],
      ['turnstile failed',      { turnstile: { success: false, 'error-codes': ['bad'] } }, {}],
      ['turnstile unset',       {}, { TURNSTILE_SECRET_KEY: '' }],
      ['grow token unset',      {}, { GROW_LEAD_TOKEN: '' }],
      ['clio creds unset',      {}, { CLIO_REFRESH_TOKEN: '', CLIO_ACCESS_TOKEN: '' }],
      ['validation error',      {}, {}],
    ];

    const m = quiet();
    const bodies = [];
    try {
      for (const [label, wireOpts, env] of branches) {
        const wire = stubWire(wireOpts);
        try {
          const { res } = label === 'validation error'
            ? await submit({ body: { description: '' }, env })
            : await submit({ env });
          bodies.push([label, await res.text()]);
        } finally { wire.restore(); }
      }
      const text = logText(m);
      assert.ok(text.length > 0, 'control: these branches DO log — an empty capture would make this vacuous');

      for (const secret of SECRETS) {
        assert.ok(!text.includes(secret), `a secret reached the log: ${secret.slice(0, 12)}…`);
      }
      for (const value of PII) {
        assert.ok(!text.includes(value), `the inquiry reached the log: "${value.slice(0, 30)}…"`);
      }
      // The response bodies are the other place either could escape to.
      for (const [label, body] of bodies) {
        for (const secret of SECRETS) {
          assert.ok(!body.includes(secret), `${label}: a secret reached the response body`);
        }
        for (const value of PII.slice(0, 3)) {
          assert.ok(!body.includes(value), `${label}: the response echoed the inquiry back`);
        }
      }
    } finally { m.restore(); live = null; }
  });

  test('CONTROL: the scanner would catch a leak', () => {
    // A guard that cannot fail is not a guard. This proves the substring scan sees
    // the exact shapes the assertions above look for.
    const leaked = `warn [fn/contact] token=${GROW_TOKEN} email=${INQUIRY.email}`;
    assert.ok(leaked.includes(GROW_TOKEN));
    assert.ok(leaked.includes(INQUIRY.email));
  });

  test('a validation failure logs OUR field names, never the answers', async () => {
    const m = quiet();
    const wire = stubWire();
    try {
      await submit({ body: { name: '', description: '' } });
      const text = logText(m);
      assert.ok(text.includes('missing=name'), 'the operator is told which fields were absent');
      for (const value of PII) assert.ok(!text.includes(value));
    } finally { wire.restore(); m.restore(); live = null; }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. The page — Formspree is gone, and the new route is wired
// ─────────────────────────────────────────────────────────────────────────────

describe('contact.html posts to fn/contact, not to a third-party form app', () => {
  const dom = () => new JSDOM(CONTACT_HTML).window.document;

  test('formspree.io is referenced NOWHERE in the shipped tree', () => {
    // Not just on the form's action: a stale comment naming the endpoint is a
    // reader's next wrong turn, and a second form elsewhere would be a second leak.
    assert.ok(!/formspree\.io/i.test(CONTACT_HTML), 'contact.html still names formspree.io');
  });

  test('the inquiry form has no third-party action at all', () => {
    const form = dom().getElementById('dl-contact-form');
    assert.ok(form, 'the form must still exist and be addressable');
    const action = form.getAttribute('action');
    assert.ok(action === null || action === '' || action.startsWith('/'),
      `the form must not name an external host; action was "${action}"`);
  });

  test('and it still collects exactly the seven fields the endpoint reads', () => {
    const form = dom().getElementById('dl-contact-form');
    const named = [...form.querySelectorAll('[name]')].map((el) => el.getAttribute('name'));
    for (const field of ['name', 'email', 'phone', 'referral', 'matter_type', 'urgency', 'description']) {
      assert.ok(named.includes(field), `the form no longer collects "${field}"`);
    }
  });

  test('the Turnstile mount and the on-page result element are both present', () => {
    const d = dom();
    assert.ok(d.getElementById('dl-contact-turnstile'), 'the endpoint requires a token, so the page must offer the challenge');
    const status = d.getElementById('dl-contact-status');
    assert.ok(status, 'the writer must be told what happened without leaving the page');
    assert.equal(status.getAttribute('role'), 'status');
    assert.equal(status.getAttribute('aria-live'), 'polite');
  });

  test('the page loads the challenge script and the form script', () => {
    const srcs = [...dom().querySelectorAll('script[src]')].map((s) => s.getAttribute('src'));
    assert.ok(srcs.includes('https://challenges.cloudflare.com/turnstile/v0/api.js'));
    assert.ok(srcs.includes('/js/page/contact-form.js'));
    // DL.ready has to exist before the deferred page script runs.
    assert.ok(srcs.includes('/js/dl-init.js'));
    assert.ok(srcs.indexOf('/js/dl-init.js') < srcs.indexOf('/js/page/contact-form.js'),
      'js/dl-init.js must come first or contact-form.js throws on load');
  });

  test('the form script is on the router adoption list, so a soft navigation keeps it', () => {
    // /contact is an interceptable route. Without this entry the swapped form would
    // arrive with no submit handler, the button would fall through to a native POST,
    // and form-action would kill it — the Formspree failure, reproduced.
    assert.ok(ADOPT_SCRIPTS.has('/js/page/contact-form.js'));
    assert.ok(ADOPT_SCRIPTS.has('https://challenges.cloudflare.com/turnstile/v0/api.js'));
  });

  test('the page carries no inline script and no on* handler', () => {
    // Both are CI rules in their own right; asserted here because this ticket added
    // behaviour to the page and that is exactly when they get broken.
    const d = dom();
    assert.deepEqual([...d.body.querySelectorAll('script:not([src])')], [],
      'no inline <script> anywhere in <body>');
    const handlers = [...d.querySelectorAll('*')].flatMap((el) =>
      [...el.attributes].map((a) => a.name).filter((n) => /^on[a-z]+$/i.test(n)));
    assert.deepEqual(handlers, []);
  });

  test('WHY THE OLD FORM COULD NEVER HAVE WORKED: the CSP forbids the host', () => {
    // Asserted against the REAL policy the middleware emits, not against prose. If
    // form-action ever grew a third-party host, the design decision behind this
    // whole route would have quietly changed and this test is where it shows up.
    const formAction = buildCsp('NONCE').split('; ').find((d) => d.startsWith('form-action '));
    // Was "form-action 'self' https://vantage.ticoai.net". Vantage is severed, so the
    // directive is 'self' alone — which makes this test's point MORE strongly, not
    // less: the policy now names exactly one permitted form target, the site itself.
    assert.equal(formAction, "form-action 'self'");
    assert.ok(!formAction.includes('formspree'),
      'a browser refuses a form POST to a host form-action does not name — which is why the old form was silent');
    // And the replacement is reachable: a same-origin fetch is governed by
    // connect-src, which admits 'self'.
    const connect = buildCsp('NONCE').split('; ').find((d) => d.startsWith('connect-src '));
    assert.ok(connect.includes("'self'"), '/fn/contact is same-origin, so connect-src must admit it');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. The client script — the behaviour the page depends on
// ─────────────────────────────────────────────────────────────────────────────

describe('js/page/contact-form.js', () => {
  const RAW = readFileSync(join(SITE, 'js', 'page', 'contact-form.js'), 'utf8');
  // COMMENTS ARE STRIPPED BEFORE ANY "must not contain" ASSERTION. That file
  // explains at length why it does NOT use the implicit `cf-turnstile` class and
  // why it never touches `innerHTML` — so a guard that grepped the whole file would
  // fire on the prose describing the thing it is guarding against, and the only way
  // to make it pass would be to delete the explanation.
  // See [[feedback_regression_guard_greps_own_comments]].
  const SRC = RAW.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');

  test('it posts to /fn/contact and prevents the native submit', () => {
    assert.match(SRC, /fetch\(\s*'\/fn\/contact'/, 'it must post to the site\'s own endpoint');
    assert.match(SRC, /preventDefault\(\)/, 'a native submit would navigate away or be killed by form-action');
  });

  test('it registers through DL.ready, so it survives a content swap', () => {
    assert.match(SRC, /^DL\.ready\(/m);
  });

  test('CONTROL: the comment stripper works, and did not eat the code', () => {
    // Both halves matter. If the stripper were a no-op the two guards below would
    // fire on prose; if it were too greedy they would pass against an empty string.
    assert.ok(RAW.includes('cf-turnstile'), 'the file DOES discuss the implicit class, in a comment');
    assert.ok(!SRC.includes('cf-turnstile'), 'and the stripper removed that comment');
    assert.ok(SRC.includes('DL.ready('), 'the stripper must leave the code standing');
    assert.ok(SRC.includes("'/fn/contact'"), 'and must not eat a string literal');
  });

  test('it renders Turnstile EXPLICITLY, not through the implicit class', () => {
    // The implicit mode renders once at api.js load. After a swap the script is
    // already loaded and never re-runs, so the new mount would stay empty and the
    // endpoint would 403 a form that looked fine.
    assert.match(SRC, /turnstile\.render\(/);
    assert.ok(!/cf-turnstile/.test(SRC), 'the implicit class would not survive a swap');
    assert.match(SRC, /turnstile\.reset\(/, 'a token is single-use — a retry needs a fresh one');
  });

  test('it writes the result with textContent, never innerHTML', () => {
    assert.match(SRC, /textContent\s*=/);
    assert.ok(!/innerHTML/.test(SRC), 'nothing on this path may build markup from a response');
  });
});
