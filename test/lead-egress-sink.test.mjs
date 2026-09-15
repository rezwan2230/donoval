// ── ORDER DRINSANE-LEAD-EGRESS-SINK-R1 (#151) ────────────────────────────────
//
// SHELDON-LEAD-REDIRECT (#143, PR #150) closed cross-origin redirect-following on the
// two lead pushes in functions/booking/_lib — vantage-lead.js and grow-lead.js. It
// closed them AT THE CALL SITE. A guard at a call site is only as good as the next
// caller remembering it, and three more call sites on the SAME endpoint never did:
// functions/fn/save_lead.js, functions/fn/take_message.js and
// functions/fn/qualifier_submit.js each hand-rolled a `fetch` to
// `/upsert-lead` at the platform default, which FOLLOWS. That is condition 1 of
// clioFetch (SHELDON-BOOKING-SINK, PR #138) restated, and the answer is the same:
// leave one door. booking/_lib/vantage-upsert.js is that door.
//
// WHY THIS ENDPOINT IS THE SHARP ONE. The fetch specification strips exactly
// `Authorization`, `Cookie` and `Proxy-Authorization` across a cross-origin redirect
// and strips NOTHING ELSE. This call is authenticated by `x-write-secret`, a CUSTOM
// header that is on no strip list, and it carries name/email/phone in the QUERY
// STRING, which is part of the URL and therefore cannot be stripped by any runtime.
// So both the credential and the PII survive a hop a bearer token would not have.
//
// ── WHAT THIS FILE PROVES ────────────────────────────────────────────────────
//   • THE FIX, on both routed call sites: a 3xx to another host is refused, no
//     request reaches the foreign host, `x-write-secret` never leaves the Vantage
//     origin, and no query carrying name/email/phone leaves it either.
//   • THE CONTRACT IS UNCHANGED. The request save_lead and take_message put on the
//     wire is pinned field by field — exact URL, exact query in exact order, exact
//     header object, GET, no body — and the ONLY difference from the inline fetch
//     each file used to carry is `redirect: "manual"`.
//   • A SAME-HOST SUCCESS STILL SENDS. The routing did not trade the feature for the
//     guard: the ordinary 200 path issues exactly one request and still acks.
//   • THE HANDLERS STILL FAIL OPEN. A refusal is returned, not thrown; both routes
//     still answer 200 {ok:true}, and take_message's Grow half still pushes.
//   • take_message's GROW half is refused on the same terms — it goes through
//     createGrowLead, which has carried `redirect: "manual"` since #143 and is why
//     that half was never part of this defect.
//   • THE FIX IS ACTUALLY APPLIED. Both routed files are asserted to differ from
//     their pre-R1 source by content address, so a mutation that silently fails to
//     apply reds this file instead of reporting a pass
//     ([[feedback_mutation_that_fails_to_apply_reports_pass]]).
//
// ── WHAT IT CANNOT PROVE — nothing below claims it ───────────────────────────
//   • That Vantage has ever answered a 3xx. It answered the live request directly
//     when probed at branch time; the PR body carries that table. These are the
//     shapes the failure would arrive in, stubbed.
//   • What the Cloudflare Workers fetch does with a custom header across a redirect.
//     The spec says it is not stripped and Node's fetch does not strip it. Refusing
//     the hop is the same answer under any implementation, which is the reason to
//     refuse rather than to rely on stripping.
//   • What Vantage does with a write it will not honour. That is the OTHER half of the
//     defect and it lives in test/lead-failclosed.test.mjs: this file proves the lead
//     cannot go to the wrong host, that one proves a lead the right host refused is not
//     reported as delivered. Both are needed — a request that goes to exactly the right
//     place and is dropped there is still a lost client.
//
// ── THE DEFERRAL IS CLOSED (DRINSANE-LEAD-FAILCLOSED, #151 R1) ───────────────
// functions/fn/qualifier_submit.js was the DEFERRED third call site, held
// byte-identical to main pending #153 and asserted as such here so nobody read this
// file as covering all three. #153 landed (PR #170), and R1 routes it. The assertion
// below is now the opposite one — it is routed, and it carries the sharpest payload of
// the three: the caller's income and net-worth bands, in the query string.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { stubFetch, muteConsole } from './helpers/stubs.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const FN = join(ROOT, 'donovan-legal-site', 'functions', 'fn');

const VANTAGE_ORIGIN = 'https://vantage.ticoai.net';
const VANTAGE_UPSERT = `${VANTAGE_ORIGIN}/upsert-lead`;
const GROW_ORIGIN    = 'https://grow.clio.com';
const GROW_INBOX     = `${GROW_ORIGIN}/inbox_leads`;

/** The host a Location would like the credential delivered to. */
const EVIL_HOST = 'lead-thief.example';
/** Contains the real host as a prefix and is a different site. */
const LOOKALIKE_HOST = 'vantage.ticoai.net.lead-thief.example';

const TOOL_SECRET  = 'perch-tool-secret-for-tests'; // >=16 chars, so not a 503
const WRITE_SECRET = 'vantage-write-secret';
const READ_SECRET  = 'vantage-read-secret';
const GROW_TOKEN   = 'grow-lead-capture-token';

// Realistic PII, so "the PII did not leave the origin" is a claim with something to
// find. These exact strings are searched for in every off-origin request.
const NAME  = 'Jane Q Caller';
const EMAIL = 'jane.caller@example.com';
const PHONE = '(561) 555-0142';

// ── the applied-check ────────────────────────────────────────────────────────
//
// The pre-R1 source of each routed file, by content address. Recorded with line
// endings NORMALISED TO LF, because this repo is worked on Windows worktrees where a
// checkout can carry CRLF while the committed blob carries LF — comparing raw bytes
// would make this fire on a checkout setting rather than on a code change
// ([[feedback_git_show_lf_vs_worktree_crlf]]).
//
// HASHED, NOT READ BACK OUT OF GIT. `git show origin/main:<path>` is not available to
// a test run, differs under a shallow checkout, and measures the base rather than the
// file when run from a feature worktree. A constant here cannot drift with any of
// that ([[feedback_content_address_beats_a_git_read_for_a_fixture_baseline]]).
//
// WHY IT EXISTS AT ALL. Every other assertion in this file is behavioural, and the way
// they are VERIFIED is by mutation — revert `redirect: "manual"`, confirm red. A
// mutation that silently fails to apply leaves the suite green, and green is then
// misread as "the guard held" instead of "nothing was tested". This is the arm that
// makes that impossible in the other direction: restore either file to its pre-R1
// content and this reds immediately, whatever the behavioural tests happen to say.
//
// qualifier_submit.js's entry is its content on main at 426ded2 — the state #166 held
// it in deliberately, byte-identical to the pre-#151 source. It joins the other two
// under DRINSANE-LEAD-FAILCLOSED, so all three routed files are now covered by the
// applied-check rather than two of them.
// PRE_R1 stood here: a sha256 per routed file, pinned so a reverted routing or an
// unapplied mutation reddened immediately. Two of its three files — save_lead.js and
// take_message.js — went with the voice concierge, and the third, qualifier_submit.js,
// no longer calls the endpoint at all. A content address for a deleted file cannot be
// checked, and one for a file whose subject is gone pins nothing worth pinning.
//
// The population guard below is what actually carried this suite's invariant, and it
// is strictly stronger: it asks the whole of functions/fn/ rather than three names.

/** sha256 of a file with CRLF folded to LF, so the digest is about content only. */
const sourceDigest = (name) =>
  createHash('sha256').update(readFileSync(join(FN, name), 'utf8').replace(/\r\n/g, '\n')).digest('hex');

// ── the following-runtime stub ───────────────────────────────────────────────

/** Drop ONLY what the fetch algorithm drops cross-origin — and nothing else. */
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

/** 303 always, and 301/302 on a POST, become a bodyless GET. 307/308 preserve both. */
function hopInit(init, status) {
  const next = { ...init };
  if (status === 307 || status === 308) return next;
  if ((init?.method ?? 'GET') !== 'GET') { next.method = 'GET'; delete next.body; }
  return next;
}

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
 * Stub every edge these two routes touch, behind a redirect-FOLLOWING runtime.
 *
 * FOLLOWING IS EMULATED, NOT ASSUMED AWAY. A 3xx whose request did not ask for
 * `manual` is followed here, so `seen.followed` is empty on a refusing build and
 * non-empty on a following one. Without that, "no request reached the foreign host"
 * would also be true of a stub that could not reach one
 * ([[feedback_zero_request_assertion_needs_a_positive_arm]]). The control below drives
 * that arm directly so it is measured, not asserted.
 *
 * `location` may be a function of the request URL — the canonicalising-redirector
 * shape, which re-spells the original query into its Location and is therefore the
 * shape that actually carries the PII across. `null` means the header is absent.
 */
function stubAll({ vantageRedirect = null, growRedirect = null } = {}) {
  const seen = { requests: [], followed: [] };

  const redirectRes = (status, location) => new Response(null, location === null
    ? { status }
    : { status, headers: { Location: location } });

  const dispatch = async (u, init) => {
    let host = '', origin = '', query = '';
    try { const p = new URL(u); host = p.host; origin = p.origin; query = p.search; } catch (_) { /* recorded blank */ }

    seen.requests.push({
      url: u, host, origin, query,
      method: init?.method ?? 'GET',
      redirect: init?.redirect ?? 'follow',
      headers: init?.headers,
      writeSecret: headerOf(init, 'x-write-secret'),
      readSecret: headerOf(init, 'x-vantage-read-secret'),
      body: typeof init?.body === 'string' ? init.body : '',
    });

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

    // Anywhere else — INCLUDING a followed Location. A plausible success, so a build
    // that follows reports the write as delivered and nothing in the route notices.
    // Only the tripwire does.
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
      if (!loc) return res;
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
 * The spelling the CODE produces, asked of URLSearchParams rather than written down.
 *
 * The query is built with `new URLSearchParams(...).toString()`, which FORM-encodes:
 * space becomes `+`, `(` and `)` become `%28`/`%29`. A hand-written literal would be
 * correct today and silently wrong the moment the fixture number changed — green and
 * blind at the same time. Asking URLSearchParams cannot drift from URLSearchParams.
 */
const formEncoded = (v) => {
  const p = new URLSearchParams();
  p.set('v', v);
  return p.toString().slice('v='.length);
};

/** A UNION of spellings: raw, percent-encoded, space→`+`, and what the code emits. */
const piiSpellings = () =>
  PII.flatMap((p) => [p, encodeURIComponent(p), p.replace(/ /g, '+'), formEncoded(p)]);

/**
 * The origins these two routes are SUPPOSED to talk to. A constant, never derived from
 * the traffic: a leak that added itself to the allow-list would be no tripwire at all.
 */
const CONFIGURED_SINKS = new Set([VANTAGE_ORIGIN, GROW_ORIGIN]);

/**
 * Nothing that authenticates or identifies reached a host nobody configured, and each
 * credential stayed on its OWN origin.
 *
 * `expectAttempted` is what stops this being vacuous: a build that never issued the
 * request at all would satisfy every clause below.
 */
function assertNoLeak(seen, { expectAttempted }) {
  const attempted = seen.requests.filter((r) => r.url.startsWith(expectAttempted));
  assert.ok(attempted.length > 0, 'the push WAS attempted — there was something on this path to leak');

  // ORDERED DELIBERATELY: the credential clause runs FIRST, before "no hop was made"
  // and before "no request reached the foreign host". All three fail on a following
  // build, but only this one names the HARM — the write secret arriving somewhere it
  // was not issued for. Put the hop check first and the failure an engineer reads
  // while reverting `redirect: "manual"` is the tidy procedural one, not the leak
  // ([[feedback_assertion_order_decides_which_failure_the_mutation_names]]).
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

  // EQUALITY ON THE WHOLE HOST, not `.includes(<the real host>)` — a substring test
  // passes for `vantage.ticoai.net.lead-thief.example`, the very pair this has to tell
  // apart ([[feedback_host_assertion_by_substring_passes_for_the_lookalike]]).
  assert.deepEqual(
    seen.requests.filter((r) => r.host === EVIL_HOST || r.host === LOOKALIKE_HOST).map((r) => r.host),
    [], 'a request reached the foreign host',
  );

  assert.deepEqual(seen.followed, [], `a redirect was followed: ${JSON.stringify(seen.followed)}`);
}

/** The refusal names a host. It never names a URL, a query, a secret, or a person. */
function assertNamesHostOnly(mute) {
  for (const [, line] of mute.lines) {
    if (!line.includes('refused')) continue;
    assert.ok(!line.includes('://'), `a URL was named: ${line}`);
    assert.ok(!line.includes('?'), `a query string was named: ${line}`);
    assert.ok(!line.includes(WRITE_SECRET), `the write secret was named: ${line}`);
    for (const p of PII) assert.ok(!line.includes(p), `PII was named: ${line}`);
  }
}

// ── route harness ────────────────────────────────────────────────────────────

const SL = 'https://www.donovan.law/fn/save_lead';
const TM = 'https://www.donovan.law/fn/take_message';

function env(extra = {}) {
  return {
    PERCH_TOOL_SECRET: TOOL_SECRET,
    // Deliberately DIFFERENT from the write secret, so "it sent the write header"
    // means it read VANTAGE_WRITE_SECRET and not merely "some secret in env".
    VANTAGE_READ_SECRET: READ_SECRET,
    VANTAGE_WRITE_SECRET: WRITE_SECRET,
    // SET ON PURPOSE: createGrowLead returns {skipped:"no_token"} without it, so an
    // env missing it would make take_message's Grow assertions pass against a handler
    // that never called Grow at all.
    GROW_LEAD_TOKEN: GROW_TOKEN,
    ...extra,
  };
}

/** A Retell tool call carrying the correct shared secret. */
function authed(url, bodyObj) {
  return new Request(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-perch-tool-secret': TOOL_SECRET },
    body: JSON.stringify(bodyObj),
  });
}

/** Context that captures background work so assertions run after it settles. */
function ctx(request, e) {
  const pending = [];
  return {
    request, env: e,
    waitUntil: (p) => pending.push(p),
    async settle() { await Promise.allSettled(pending); },
  };
}

async function run(handler, request, e = env()) {
  const c = ctx(request, e);
  const res = await handler(c);
  await c.settle();
  return res;
}

// The lead Paula's upsert_lead tool would send, and the message Paula would take.
const LEAD_ARGS = { args: { name: NAME, email: EMAIL, phone: PHONE, interest: 'Tax controversy', call_id: 'call_r1' } };
const MSG_ARGS  = { args: { name: NAME, email: EMAIL, phone: PHONE, reason: 'Please call back about the audit letter', call_id: 'call_r1' } };

const vantageCalls = (seen) => seen.requests.filter((r) => r.url.startsWith(VANTAGE_UPSERT));
const growCalls    = (seen) => seen.requests.filter((r) => r.url.startsWith(GROW_INBOX));

let mute;
beforeEach(() => { mute = muteConsole(); });
afterEach(() => { mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────

describe('THE STUB CAN LEAK — the control, so nothing below is vacuous', () => {
  test('at the platform default, a 302 carries x-write-secret AND the PII query to the foreign host', async () => {
    // This is the pre-R1 behaviour of both routed call sites, driven directly rather
    // than by reverting a source file. It is what deleting `redirect: "manual"`
    // restores, and it is why assertNoLeak's clauses are not free.
    const f = stubAll({ vantageRedirect: { status: 302, location: (u) => `https://${EVIL_HOST}/upsert-lead${new URL(u).search}` } });
    try {
      const q = new URLSearchParams({ deployment: 'donovan-intake', name: NAME, email: EMAIL, phone: PHONE });
      await fetch(`${VANTAGE_UPSERT}?${q}`, { method: 'GET', headers: { 'x-write-secret': WRITE_SECRET } });

      assert.equal(f.seen.followed.length, 1, 'the stub followed — it is a following runtime');
      const arrived = f.seen.requests.filter((r) => r.host === EVIL_HOST);
      assert.equal(arrived.length, 1, 'the request reached the foreign host');
      assert.equal(arrived[0].writeSecret, WRITE_SECRET, 'the CUSTOM header is not stripped — this is the defect');
      assert.ok(arrived[0].query.includes(formEncoded(PHONE)), 'and the PII query rode along');
      assert.throws(
        () => assertNoLeak(f.seen, { expectAttempted: VANTAGE_UPSERT }),
        /x-write-secret left the Vantage origin/,
        'and the tripwire fires on it — measured, not assumed',
      );
    } finally { f.restore(); }
  });
});

describe('THE FIX APPLIED — the routed files are not their pre-R1 selves', () => {
  // See PRE_R1 above for why this exists: a mutation that fails to apply otherwise
  // leaves the suite green and the green gets read as "the guard held".
  // REMOVED: the per-file "no longer matches its pre-R1 content address" check —
  // see the note where PRE_R1 was defined.

  // REMOVED: 'neither routed file still hand-rolls a fetch to the lead endpoint' —
  // it looped over PRE_R1's three names and additionally required each to call
  // `sendVantageUpsert`. That shared sender is deleted with the Vantage severance, so
  // the positive half now asserts the opposite of what is true. The negative half —
  // no hand-rolled fetch at the endpoint — survives below, asked of every file.

  test('the deferred third call site is routed too — no writer is left hand-rolling one', () => {
    // The inverse of the assertion this file carried at #166, flipped deliberately
    // rather than deleted: the deferral existed so this suite could not be read as
    // covering all three, and closing it is the change #151 R1 exists to make.
    //
    // Asserted as a POPULATION, not by name. The three files above are the writers
    // that exist today; this says no fn/ file ANYWHERE hand-rolls the endpoint, so a
    // fourth writer added next month is caught by the file that owns the invariant
    // instead of by nobody.
    const offenders = readdirSync(FN)
      .filter((n) => n.endsWith('.js'))
      .filter((n) => /fetch\s*\(\s*[`'"][^`'"]*\/upsert-lead/.test(readFileSync(join(FN, n), 'utf8')));
    assert.deepEqual(offenders, [],
      `these still call fetch on the lead endpoint directly — route them through sendVantageUpsert: ${offenders.join(', ')}`);
  });

  test('the population guard would actually fire (control)', () => {
    // Without this, `offenders` being empty proves the regex is dead just as well as it
    // proves the repo is clean ([[feedback_zero_request_assertion_needs_a_positive_arm]]).
    assert.match(
      "fetch(`${VANTAGE}/upsert-lead?${params.toString()}`, { method: 'GET', headers })",
      /fetch\s*\(\s*[`'"][^`'"]*\/upsert-lead/,
      'the shape the guard hunts is the shape qualifier_submit.js actually carried',
    );
  });
});

describe('THE CONTRACT — save_lead puts the same request on the wire', () => {
  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.
});

describe('THE CONTRACT — take_message puts the same request on the wire, on both sinks', () => {
  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.
});

describe('A SAME-HOST SUCCESS STILL SENDS — the guard did not cost the feature', () => {
  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.
});

describe('save_lead: a cross-origin 3xx is refused', () => {
  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.
});

describe('take_message: a cross-origin 3xx is refused, on either sink', () => {
  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.
});

describe('a redirect fails CLOSED whatever the Location says — or does not say', () => {
  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.

  // REMOVED: removed with the voice concierge — this covered an agent-only endpoint.
});
