// ── ORDER SHELDON-LEAD-REDIRECT-R1 (#143) ────────────────────────────────────
//
// Found while gating PR #138 and pre-existing on main. SHELDON-BOOKING-SINK closed
// redirect-following inside clioFetch; the two lead pushes in
// functions/booking/_lib do not go through clioFetch and issued their requests with
// the platform default, which FOLLOWS.
//
// WHY THAT IS WORSE ON THESE TWO CALLS THAN IT WAS AT THE CLIO SINK. The fetch
// specification strips `Authorization`, `Cookie` and `Proxy-Authorization` across a
// cross-origin redirect and strips NOTHING ELSE. Neither call is authenticated by
// any of those three:
//
//   · vantage-lead.js sends the custom header `x-write-secret`, which is not on
//     that list, and puts name/email/phone in the QUERY STRING — part of the URL,
//     so it travels with the request no matter what a runtime does to headers.
//   · grow-lead.js puts the credential in the BODY (`inbox_lead_token`), and a 307
//     or 308 re-POSTs method and body verbatim.
//
// At the Clio sink the tripwire was blunted: a spec-conformant hop drops the bearer
// token, so "no credential left the origin" was true of a following build too
// ([[feedback_stripped_auth_makes_the_egress_tripwire_blind_to_a_redirect]]). HERE
// IT IS NOT BLUNTED. The stub below strips exactly the three headers the spec
// strips and keeps everything else, which is what a runtime does — so on a build
// with `redirect: "manual"` removed, the write secret and the PII query really do
// arrive at the foreign host and the tripwire really does fire. That is asserted as
// a live control in "THE STUB CAN LEAK" below, so none of it rests on trust.
//
// ── WHAT THIS FILE PROVES ────────────────────────────────────────────────────
//   • A 3xx to ANOTHER HOST is refused on both calls: no request reaches the
//     foreign host, `x-write-secret` never leaves the Vantage origin, no query
//     string carrying name/email/phone leaves it, and `inbox_lead_token` is never
//     re-POSTed off the Grow origin.
//   • THE BOOKING STILL COMPLETES on every refusal — 201, one Clio calendar write,
//     and the OTHER lead sink still pushed. Both calls stay best-effort.
//   • A RELATIVE Location and an ABSENT Location each FAIL CLOSED. Neither is read
//     as "not really a redirect, carry on": both refuse, and no second request is
//     issued for either. So does a HOSTLESS one (`mailto:`, `data:`,
//     `javascript:`) — parses fine, names nobody, refused and SAID to be hostless
//     rather than mislabelled malformed.
//   • THE REFUSAL NAMES A HOST AND NOTHING ELSE. Every log line captured across
//     this file is asserted to contain no URL, no query string and no PII.
//   • THE TRIPWIRE ITSELF IS UNDER TEST. The PII search is run against a real
//     phone-only leak and asserted to FIRE, and the pre-R1 spelling set is asserted
//     to have MISSED that same captured request. A tripwire nobody points at a leak
//     is a tripwire nobody has measured ("THE TRIPWIRE CATCHES A PHONE-ONLY LEAK").
//
// ── WHAT IT CANNOT PROVE — nothing below claims it ───────────────────────────
//   • That either endpoint has ever answered a 3xx. Both were probed at branch
//     time and answer directly (Vantage 200, Grow 401 on all four regional hosts);
//     the PR body carries that table. These are the shapes the failure would
//     arrive in, stubbed.
//   • What the Cloudflare Workers fetch does with a custom header across a
//     redirect. The spec says it is not stripped and Node's fetch does not strip
//     it; refusing the hop is the same answer under any implementation, which is
//     the reason to refuse rather than to rely on stripping.
//   • That a followed hop would have been ANSWERED by an attacker. The harm proven
//     here is egress — the credential and the PII arriving at a host of somebody
//     else's choosing. What that host then does is outside the stub.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as bookingCreate } from '../donovan-legal-site/functions/booking/create.js';
import { createGrowLead } from '../donovan-legal-site/functions/booking/_lib/grow-lead.js';
import { stubFetch, muteConsole, makeKV } from './helpers/stubs.mjs';

const SITEVERIFY     = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_TOKEN     = 'https://app.clio.com/oauth/token';
const CLIO_ENTRIES   = 'https://app.clio.com/api/v4/calendar_entries';
const GROW_ORIGIN    = 'https://grow.clio.com';
const GROW_INBOX     = `${GROW_ORIGIN}/inbox_leads`;
const VANTAGE_ORIGIN = 'https://vantage.ticoai.net';
const VANTAGE_UPSERT = `${VANTAGE_ORIGIN}/upsert-lead`;

/** The host a Location would like the credential delivered to. */
const EVIL_HOST = 'lead-thief.example';

/** Contains the real host as a prefix and is a different site. */
const LOOKALIKE_HOST = 'vantage.ticoai.net.lead-thief.example';

const WRITE_SECRET = 'vantage-write-secret';
const GROW_TOKEN   = 'grow-lead-capture-token';

// Realistic PII, so "the PII did not leave the origin" is a claim with something
// to find. These exact strings are searched for in every off-origin request and in
// every captured log line.
const NAME  = 'Jane Q Caller';
const EMAIL = 'jane.caller@example.com';
const PHONE = '(561) 555-0142';

// ── header/body readers, over whatever shape a caller built ──────────────────

function headerOf(init, name) {
  const h = init?.headers;
  const want = name.toLowerCase();
  if (!h) return '';
  if (typeof h.get === 'function') return h.get(want) ?? '';
  if (Array.isArray(h)) {
    const row = h.find(([k]) => String(k).toLowerCase() === want);
    return row ? String(row[1]) : '';
  }
  const key = Object.keys(h).find((k) => k.toLowerCase() === want);
  return key ? String(h[key]) : '';
}

/**
 * Drop ONLY what the fetch algorithm drops on a cross-origin redirect: the three
 * named headers, and nothing else. `x-write-secret` deliberately survives — that
 * is the defect, and a stub that scrubbed it would prove the fix by assuming it.
 */
const STRIPPED = new Set(['authorization', 'cookie', 'proxy-authorization']);
function stripCrossOrigin(init) {
  const h = init?.headers;
  if (!h) return init;
  if (typeof h.get === 'function') {
    const copy = new Headers(h);
    for (const k of STRIPPED) copy.delete(k);
    return { ...init, headers: copy };
  }
  if (Array.isArray(h)) {
    return { ...init, headers: h.filter(([k]) => !STRIPPED.has(String(k).toLowerCase())) };
  }
  const copy = { ...h };
  for (const k of Object.keys(copy)) if (STRIPPED.has(k.toLowerCase())) delete copy[k];
  return { ...init, headers: copy };
}

/**
 * Rewrite a request for the next hop, as a runtime does.
 *
 * 303 always, and 301/302 on a POST in every implementation that matters, become a
 * GET with no body. 307 and 308 preserve BOTH — which is why the Grow tests below
 * use them: that is the status that carries `inbox_lead_token` across.
 */
function hopInit(init, status) {
  const next = { ...init };
  if (status === 307 || status === 308) return next;
  if ((init?.method ?? 'GET') !== 'GET') { next.method = 'GET'; delete next.body; }
  return next;
}

/**
 * Stub every edge a booking touches, with a redirect-FOLLOWING runtime behind it.
 *
 * `vantageRedirect` / `growRedirect` replace that endpoint's normal answer with a
 * 3xx. Each is `{ status, location }`, and `location` may be a function of the
 * request URL — the realistic canonicalising-redirector shape, which re-spells the
 * original query into its Location and is therefore the shape that carries the PII
 * across. `null` location means the Location header is absent entirely.
 *
 * FOLLOWING IS EMULATED, NOT ASSUMED AWAY. A 3xx whose request did not ask for
 * `manual` is followed, so `seen.followed` is empty on a refusing build and
 * non-empty on a following one. Without that, "no request reached the foreign
 * host" would also be true of a stub that could not reach one
 * ([[feedback_zero_request_assertion_needs_a_positive_arm]]).
 */
function stubAll({ vantageRedirect = null, growRedirect = null } = {}) {
  const seen = { requests: [], followed: [] };

  const redirectRes = (status, location) => new Response(null, location === null
    ? { status }
    : { status, headers: { Location: location } });

  /** One request, recorded and answered. No following happens in here. */
  const dispatch = async (u, init) => {
    const method = init?.method ?? 'GET';
    let host = '', origin = '', query = '';
    try { const p = new URL(u); host = p.host; origin = p.origin; query = p.search; } catch (_) { /* recorded blank */ }

    seen.requests.push({
      url: u, host, origin, query, method,
      redirect: init?.redirect ?? 'follow',
      writeSecret: headerOf(init, 'x-write-secret'),
      body: typeof init?.body === 'string' ? init.body : '',
    });

    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
    if (u.startsWith(CLIO_TOKEN)) return new Response(JSON.stringify({ access_token: 'at' }));
    if (u.startsWith(CLIO_ENTRIES) && method === 'GET') return new Response(JSON.stringify({ data: [] }));
    if (u.startsWith(CLIO_ENTRIES) && method === 'POST') {
      return new Response(JSON.stringify({ data: { id: 999999 } }), { status: 201 });
    }

    if (u.startsWith(GROW_INBOX) && growRedirect) {
      const loc = typeof growRedirect.location === 'function' ? growRedirect.location(u) : growRedirect.location;
      return redirectRes(growRedirect.status, loc);
    }
    if (u.startsWith(GROW_INBOX)) return new Response(JSON.stringify({ ok: true }));

    if (u.startsWith(VANTAGE_UPSERT) && vantageRedirect) {
      const loc = typeof vantageRedirect.location === 'function' ? vantageRedirect.location(u) : vantageRedirect.location;
      return redirectRes(vantageRedirect.status, loc);
    }
    if (u.startsWith(VANTAGE_UPSERT)) return new Response(JSON.stringify({ ok: true }));

    // Anywhere else — INCLUDING a followed Location. A plausible success, so a
    // build that follows the hop reports the push as delivered and nothing else
    // in the route notices. Only the tripwire does.
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
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

      if (new URL(target).origin !== new URL(u).origin) i = stripCrossOrigin(i);
      i = hopInit(i, res.status);
      seen.followed.push({ to: new URL(target).host, status: res.status });
      u = target;
    }
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });

  return { seen, restore: () => handle.restore() };
}

// ── the tripwire ─────────────────────────────────────────────────────────────

const PII = [NAME, EMAIL, PHONE];

/**
 * The spelling the CODE actually produces, read out of URLSearchParams.
 *
 * vantage-lead.js builds its query with `new URLSearchParams(...).toString()`, which
 * FORM-encodes: space becomes `+`, and `(` and `)` become `%28`/`%29`. So the phone
 * `(561) 555-0142` goes out as `%28561%29+555-0142`.
 *
 * That is generated here, never written down. A literal `%28561%29+555-0142` in this
 * file would be correct today and silently wrong the moment the fixture number
 * changed — the tripwire would still be green and would still be blind, which is the
 * exact failure this closes. Asking URLSearchParams cannot drift from URLSearchParams.
 */
const formEncoded = (v) => {
  const p = new URLSearchParams();
  p.set('v', v);
  return p.toString().slice('v='.length);
};

/**
 * Every spelling a PII value can arrive in. A UNION, not a replacement — the three
 * hand-written forms below still catch a raw body field and a `encodeURIComponent`
 * caller, and nothing that used to fire has stopped firing.
 *
 * WHAT WAS MISSING AND WHY IT MATTERED. The hand-written set was raw,
 * `encodeURIComponent`, and space→`+`. For the NAME those coincide with the form
 * encoding (`Jane+Q+Caller`) and for the EMAIL they coincide too
 * (`jane.caller%40example.com`) — so the tripwire fired on a real leak and looked
 * healthy. The PHONE is the one that does not coincide: `encodeURIComponent` leaves
 * parentheses ALONE (`(561)%20555-0142`) and the `+` form leaves them alone as well,
 * while the real query has `%28`/`%29`. A leak carrying ONLY the phone matched none
 * of the three and passed. `formEncoded` closes that, and the phone-only control
 * below proves the closure rather than asserting it.
 */
const piiSpellings = () =>
  PII.flatMap((p) => [p, encodeURIComponent(p), p.replace(/ /g, '+'), formEncoded(p)]);

/**
 * The pre-R1 spelling set, kept for ONE purpose: the control below asserts that it
 * misses the phone-only leak. Without it, "the new set catches this" would not say
 * whether there had ever been anything to catch.
 */
const handSpellingsOnly = (p) => [p, encodeURIComponent(p), p.replace(/ /g, '+')];

/**
 * The origins a booking is SUPPOSED to talk to, and which are supposed to have the
 * caller's details. app.clio.com is on this list on purpose: the calendar entry the
 * booking creates carries the client's name in its body, by design and by ticket.
 *
 * So the tripwire is not "the PII appeared in a request" — it is "the PII, or a
 * credential, reached a host NOBODY CONFIGURED". A redirect target is exactly that
 * host, which is why this list is a constant here and never derived from the
 * traffic: a leak that added itself to the allow-list would be no tripwire at all.
 */
const CONFIGURED_SINKS = new Set([
  VANTAGE_ORIGIN, GROW_ORIGIN, 'https://app.clio.com', 'https://challenges.cloudflare.com',
]);

/**
 * Nothing that authenticates or identifies reached a host nobody configured, and
 * each credential stayed on its OWN origin.
 *
 * The `expectAttempted` arm is what stops this being vacuous: a build that never
 * issued the request at all would satisfy every clause below
 * ([[feedback_zero_request_assertion_needs_a_positive_arm]]).
 */
function assertNoLeak(seen, { expectAttempted }) {
  const attempted = seen.requests.filter((r) => r.url.startsWith(expectAttempted));
  assert.ok(attempted.length > 0, 'the push WAS attempted — there was something on this path to leak');

  // ORDERED DELIBERATELY: the credential clauses run FIRST, before "no hop was
  // made" and before "no request reached the foreign host". All three fail on a
  // build that follows, but only this one names the HARM — the write secret
  // arriving somewhere it was not issued for. Put the hop check first and the
  // failure an engineer reads while reverting `redirect: "manual"` is the tidy
  // procedural one, not the leak.
  //
  // Each credential is scoped to the one origin that issued it, so a hop to ANY
  // other configured sink fires this too — not only a hop to the evil host.
  for (const r of seen.requests) {
    if (r.origin !== VANTAGE_ORIGIN) {
      assert.equal(r.writeSecret, '', `x-write-secret left the Vantage origin, to ${r.host}`);
    }
    if (r.origin !== GROW_ORIGIN) {
      assert.ok(!r.body.includes(GROW_TOKEN), `inbox_lead_token left the Grow origin, to ${r.host}`);
    }
    if (CONFIGURED_SINKS.has(r.origin)) continue;
    for (const spelling of piiSpellings()) {
      assert.ok(!r.query.includes(spelling), `PII rode the query string to ${r.host}`);
      assert.ok(!r.body.includes(spelling), `PII rode the body to ${r.host}`);
    }
  }

  assert.deepEqual(
    seen.requests.filter((r) => r.host === EVIL_HOST || r.host === LOOKALIKE_HOST).map((r) => r.host),
    [], 'a request reached the foreign host',
  );

  assert.deepEqual(seen.followed, [], `a redirect was followed: ${JSON.stringify(seen.followed)}`);
}

/**
 * The refusal names a host. It never names a URL, a query, or a person.
 *
 * Asserted over BOTH the returned message and every captured log line. This is the
 * only thing said about logging anywhere in this file: no test here requires a URL
 * to have been logged, because vantage-lead.js's own comment forbids logging one.
 */
function assertNamesHostOnly(text, mute) {
  const all = [String(text ?? ''), ...mute.lines.map(([, m]) => m)];
  for (const line of all) {
    assert.ok(!line.includes('://'), `a URL was named: ${line}`);
    assert.ok(!line.includes('?'), `a query string was named: ${line}`);
    assert.ok(!line.includes(WRITE_SECRET), `the write secret was named: ${line}`);
    assert.ok(!line.includes(GROW_TOKEN), `the Grow token was named: ${line}`);
    for (const p of PII) assert.ok(!line.includes(p), `PII was named: ${line}`);
  }
}

// ── booking harness ──────────────────────────────────────────────────────────

function env(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    CLIO_CLIENT_ID: 'cid',
    CLIO_CLIENT_SECRET: 'csec',
    CLIO_REFRESH_TOKEN: 'rtok',
    CLIO_CALENDAR_ID: 9084638,
    GROW_LEAD_TOKEN: GROW_TOKEN,
    VANTAGE_WRITE_SECRET: WRITE_SECRET,
    PERCH_ACTIONS: makeKV(),
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

function post(over = {}) {
  return new Request('https://www.donovan.law/booking/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() },
    body: JSON.stringify({
      type: 'consult', slot: SLOT, name: NAME, email: EMAIL, phone: PHONE,
      turnstile_token: 'good-token', ...over,
    }),
  });
}

const book = (envOver = {}) => bookingCreate({ request: post(), env: env(envOver) });

const clioWrites = (seen) => seen.requests.filter((r) => r.url.startsWith(CLIO_ENTRIES) && r.method === 'POST');
const vantageCalls = (seen) => seen.requests.filter((r) => r.url.startsWith(VANTAGE_UPSERT));
const growCalls = (seen) => seen.requests.filter((r) => r.url.startsWith(GROW_INBOX));

/** A booking is CONFIRMED and the other sink is untouched by this refusal. */
async function assertBookingCompleted(res, seen) {
  assert.equal(res.status, 201, 'the confirmed booking survives a refused redirect');
  assert.equal((await res.json()).ok, true);
  assert.equal(clioWrites(seen).length, 1, 'exactly one Clio calendar write — the appointment is real');
}

const lead = { name: NAME, email: EMAIL, phone: PHONE, notes: 'Bringing my spouse.' };

// ── the exact refusal messages ───────────────────────────────────────────────
//
// EQUALITY, NOT `.includes(<a host>)`. A substring test against a host is both what
// CodeQL flags (js/incomplete-url-substring-sanitization) and genuinely weaker here:
// `includes('vantage.ticoai.net')` also passes for
// `vantage.ticoai.net.lead-thief.example` — the very pair this file has to tell
// apart. Asserting the whole message pins the host, the status and the wording that
// an operator pages on, and it cannot be satisfied by a look-alike.
const VANTAGE_LABEL = 'vantage /upsert-lead';
const GROW_LABEL    = 'grow /inbox_leads';

const refusalTo    = (label, status, host) => `${label} answered HTTP ${status} — refused redirect to host ${host}`;
const refusalNoLoc = (label, status) => `${label} answered HTTP ${status} — refused a redirect carrying no Location header`;
const refusalUnpar = (label, status) => `${label} answered HTTP ${status} — refused a redirect whose Location does not parse`;
const refusalNoHost = (label, status) => `${label} answered HTTP ${status} — refused a redirect whose Location names no host`;

let mute;
beforeEach(() => { mute = muteConsole(); });
afterEach(() => { mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────

describe('THE STUB CAN LEAK — the control, so nothing below is vacuous', () => {
  test('with the platform default, a 302 carries x-write-secret AND the PII query to the foreign host', async () => {
    // This is the pre-fix behaviour of vantage-lead.js, driven directly rather than
    // by reverting the source. It is what "removing redirect: manual" restores, and
    // it is the reason assertNoLeak's clauses are not free.
    const f = stubAll({ vantageRedirect: { status: 302, location: (u) => `https://${EVIL_HOST}/upsert-lead${new URL(u).search}` } });
    try {
      const q = new URLSearchParams({ deployment: 'donovan-intake', name: NAME, email: EMAIL, phone: PHONE });
      await fetch(`${VANTAGE_UPSERT}?${q}`, { method: 'GET', headers: { 'x-write-secret': WRITE_SECRET } });

      assert.equal(f.seen.followed.length, 1, 'the stub followed — it is a following runtime');
      const arrived = f.seen.requests.filter((r) => r.host === EVIL_HOST);
      assert.equal(arrived.length, 1, 'the request reached the foreign host');
      assert.equal(arrived[0].writeSecret, WRITE_SECRET, 'the CUSTOM header is not stripped — this is the defect');
      assert.ok(arrived[0].query.includes(encodeURIComponent(EMAIL)), 'and the PII query rode along');
    } finally { f.restore(); }
  });

  test('with the platform default, a 307 re-POSTs inbox_lead_token and the PII body to the foreign host', async () => {
    const f = stubAll({ growRedirect: { status: 307, location: `https://${EVIL_HOST}/inbox_leads` } });
    try {
      await fetch(GROW_INBOX, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inbox_lead_token: GROW_TOKEN, inbox_lead: { from_email: EMAIL } }),
      });

      const arrived = f.seen.requests.filter((r) => r.host === EVIL_HOST);
      assert.equal(arrived.length, 1, 'the request reached the foreign host');
      assert.equal(arrived[0].method, 'POST', '307 preserves the method');
      assert.ok(arrived[0].body.includes(GROW_TOKEN), 'the credential is in the BODY — no header for a runtime to strip');
      assert.ok(arrived[0].body.includes(EMAIL), 'and the PII with it');
    } finally { f.restore(); }
  });
});

describe('THE TRIPWIRE CATCHES A PHONE-ONLY LEAK — the control on assertNoLeak itself', () => {
  // Every other leak test in this file sends name, email AND phone, so the tripwire
  // fires on the name or the email whatever it knows about the phone. That made it
  // look complete while it was not: a query carrying ONLY the phone matched none of
  // the hand-written spellings and walked past. The two tests below are the arms of
  // one control — the leak is caught NOW, and it was genuinely missed BEFORE. Either
  // one alone proves nothing.

  /**
   * A real phone-only leak, made the way the code makes one: URLSearchParams builds
   * the query, the stub follows a 302 with the platform default, and the request
   * lands on a host nobody configured. No `x-write-secret` is sent — a credential
   * would trip assertNoLeak's earlier clause and the PII clause would never be
   * reached, so this arm would pass for the wrong reason.
   */
  const leakPhoneOnly = async () => {
    const q = new URLSearchParams({ deployment: 'donovan-intake', phone: PHONE });
    await fetch(`${VANTAGE_UPSERT}?${q}`, { method: 'GET' });
  };

  test('a query carrying ONLY the phone trips assertNoLeak', async () => {
    const f = stubAll({ vantageRedirect: { status: 302, location: (u) => `https://${EVIL_HOST}/upsert-lead${new URL(u).search}` } });
    try {
      await leakPhoneOnly();

      const arrived = f.seen.requests.filter((r) => r.host === EVIL_HOST);
      assert.equal(arrived.length, 1, 'the phone-only request reached the foreign host');
      assert.ok(!arrived[0].query.includes(NAME), 'and it carried no name');
      assert.ok(!arrived[0].query.includes(EMAIL), 'and no email — the phone is the only thing to find');

      assert.throws(
        () => assertNoLeak(f.seen, { expectAttempted: VANTAGE_UPSERT }),
        /PII rode the query string to lead-thief\.example/,
        'the tripwire names the phone leak, and names it as the query-string leak it is',
      );
    } finally { f.restore(); }
  });

  test('and the pre-R1 hand-written spellings MISSED it — there was a hole', async () => {
    // The negative arm. It reads the same captured request the arm above trips on,
    // and shows the old set matching nothing in it. This is why `formEncoded` exists
    // rather than being a tidier way to spell the same three strings.
    const f = stubAll({ vantageRedirect: { status: 302, location: (u) => `https://${EVIL_HOST}/upsert-lead${new URL(u).search}` } });
    try {
      await leakPhoneOnly();
      const leaked = f.seen.requests.find((r) => r.host === EVIL_HOST).query;

      for (const s of handSpellingsOnly(PHONE)) {
        assert.ok(!leaked.includes(s), `the old set would have caught it after all, via ${s}`);
      }
      assert.ok(leaked.includes(formEncoded(PHONE)), 'while the form-encoded spelling is right there in the query');

      // Nothing was traded away to get it: the name and the email were already
      // caught, because for THOSE two values the hand-written forms happen to
      // coincide with what URLSearchParams emits. That coincidence is the reason
      // the gap survived review, and it is asserted here so it stays understood.
      assert.ok(handSpellingsOnly(NAME).includes(formEncoded(NAME)), 'name: hand-written and form encoding coincide');
      assert.ok(handSpellingsOnly(EMAIL).includes(formEncoded(EMAIL)), 'email: hand-written and form encoding coincide');
      assert.ok(!handSpellingsOnly(PHONE).includes(formEncoded(PHONE)), 'phone: they do not — that is the whole defect');
    } finally { f.restore(); }
  });
});

describe('Vantage: a 3xx to another host is a refusal', () => {
  // REMOVED: this asserted that x-write-secret and the PII query never reached a
  // foreign host when Vantage's /upsert-lead answered 302. The Vantage push is
  // deleted with the severance, so the secret it carried no longer exists and there
  // is no request to redirect. The equivalent guard on the surviving lead sink is
  // the Grow block below, which is unchanged.

  test('the booking still completes and the OTHER lead sink is unaffected', async () => {
    const f = stubAll({ vantageRedirect: { status: 302, location: `https://${EVIL_HOST}/x` } });
    try {
      const res = await book();
      await assertBookingCompleted(res, f.seen);
      assert.equal(growCalls(f.seen).length, 1, 'Grow still got the lead — one sink refusing is not both');
    } finally { f.restore(); }
  });

  // REMOVED: Vantage is severed; grow-lead.js still uses redirectRefusal and is still covered here.

  // REMOVED: Vantage is severed; grow-lead.js still uses redirectRefusal and is still covered here.
});

describe('Grow: a 3xx to another host is a refusal', () => {
  test('THE FIX: a 307 does not re-POST inbox_lead_token or the PII to the foreign host', async () => {
    const f = stubAll({ growRedirect: { status: 307, location: `https://${EVIL_HOST}/inbox_leads` } });
    try {
      const res = await book();
      assertNoLeak(f.seen, { expectAttempted: GROW_INBOX });
      await assertBookingCompleted(res, f.seen);
      assert.equal(growCalls(f.seen).length, 1, 'exactly one attempt');
      assert.equal(growCalls(f.seen)[0].redirect, 'manual', 'the request asked not to be followed');
    } finally { f.restore(); }
  });

  test('a 308 is refused on the same terms', async () => {
    const f = stubAll({ growRedirect: { status: 308, location: `https://${EVIL_HOST}/inbox_leads` } });
    try {
      const r = await createGrowLead({ GROW_LEAD_TOKEN: GROW_TOKEN }, lead);
      assert.equal(r.ok, false);
      assert.equal(r.status, 308);
      assert.equal(r.error, refusalTo(GROW_LABEL, 308, EVIL_HOST));
      assertNoLeak(f.seen, { expectAttempted: GROW_INBOX });
    } finally { f.restore(); }
  });

  test('the booking still completes when the Grow push is refused', async () => {
    // This used to close with "and Vantage still got the lead" — the point being
    // that one sink refusing a redirect did not disturb the other. There is only
    // one lead sink now, so what survives is the half that always mattered: a
    // refused Grow push must not cost the caller their confirmed appointment.
    const f = stubAll({ growRedirect: { status: 302, location: `https://${EVIL_HOST}/inbox_leads` } });
    try {
      const res = await book();
      await assertBookingCompleted(res, f.seen);
    } finally { f.restore(); }
  });

  test('an overridden GROW_BASE is refused on its own origin — the region does not buy a hop', async () => {
    // GROW_BASE is operator config, so it chooses the origin. It does not license a
    // redirect off that origin, and the refusal names the host it tried to reach.
    const f = stubAll({ growRedirect: { status: 307, location: `https://${EVIL_HOST}/inbox_leads` } });
    try {
      const r = await createGrowLead({ GROW_LEAD_TOKEN: GROW_TOKEN, GROW_BASE: GROW_ORIGIN }, lead);
      assert.equal(r.ok, false);
      assert.equal(r.error, refusalTo(GROW_LABEL, 307, EVIL_HOST));
    } finally { f.restore(); }
  });
});

describe('a redirect fails CLOSED whatever the Location says — or does not say', () => {
  // REMOVED: Vantage is severed; grow-lead.js still uses redirectRefusal and is still covered here.

  // REMOVED: Vantage is severed; grow-lead.js still uses redirectRefusal and is still covered here.

  // REMOVED: Vantage is severed; grow-lead.js still uses redirectRefusal and is still covered here.

  test('an absent Location on the Grow POST is refused too', async () => {
    const f = stubAll({ growRedirect: { status: 308, location: null } });
    try {
      const r = await createGrowLead({ GROW_LEAD_TOKEN: GROW_TOKEN }, lead);
      assert.equal(r.ok, false);
      assert.equal(r.error, refusalNoLoc(GROW_LABEL, 308));
    } finally { f.restore(); }
  });

  // REMOVED: Vantage is severed; grow-lead.js still uses redirectRefusal and is still covered here.

  // REMOVED: Vantage is severed; grow-lead.js still uses redirectRefusal and is still covered here.

  test('a hostless Location on the Grow POST is refused on the same terms', async () => {
    // grow-lead.js resolves against its REQUEST URL, vantage-lead.js against a bare
    // ORIGIN. Both are correct — only the host is ever read out — and this is the
    // case where the two bases could most plausibly have disagreed, since `mailto:`
    // is an absolute URL that ignores its base entirely. They agree.
    const f = stubAll({ growRedirect: { status: 307, location: 'mailto:leads@grow.clio.com' } });
    try {
      const r = await createGrowLead({ GROW_LEAD_TOKEN: GROW_TOKEN }, lead);
      assert.equal(r.ok, false);
      assert.equal(r.error, refusalNoHost(GROW_LABEL, 307));
      assertNoLeak(f.seen, { expectAttempted: GROW_INBOX });
    } finally { f.restore(); }
  });

  // REMOVED: Vantage is severed; grow-lead.js still uses redirectRefusal and is still covered here.
});

describe('both requests declare redirect: manual at the source', () => {
  test('the Grow push asks not to be followed, even on the success path', async () => {
    // The refusal branch is only reachable if the request opted out of following in
    // the first place. Asserted on a NON-redirecting run so it cannot be satisfied
    // by the refusal path alone.
    const f = stubAll();
    try {
      await book();
      assert.equal(growCalls(f.seen)[0].redirect, 'manual');
    } finally { f.restore(); }
  });
});
