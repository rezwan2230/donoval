// ── SHELDON-CLIO-PAGING-PROBE-R1 — controls for the probe ────────────────────
//
// The probe's whole value is that its answer is empirical. That makes the
// INSTRUMENT the thing that has to be proved here, offline, before it is pointed
// at a live grant:
//
//   1. it issues GETs and one token mint, and nothing else, on every path
//      including the failure paths — the read-only claim must hold when things go
//      wrong, which is when a probe normally starts improvising;
//   2. its Task-4 verdict is the BRANCH'S rule, so a full page with no cursor
//      fires and a short page does not;
//   3. it does not print or persist a credential;
//   4. it classifies a cursor by ORIGIN as well as path, so a well-formed URL at
//      a host that is not app.clio.com is not followed.
//
// Every request is served by a stub. app.clio.com is never contacted — the stub
// FAILS CLOSED on any URL it does not recognise, so a request this suite did not
// anticipate surfaces as a test failure rather than as live traffic.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync, rmSync, symlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import {
  runPagingProbe,
  replayBackstop,
  classifyCursor,
  elidePageToken,
  elideDeep,
  makeRedactor,
  urlParts,
  isClioApiUrl,
  parseCliArgs,
  resolveEvidencePath,
  isDirectInvocation,
  CLIO_ORIGIN,
  CLIO_BASE,
  CLIO_TOKEN_URL,
  CALENDAR_PAGE_LIMIT,
  CALENDAR_MAX_PAGES,
  EVIDENCE_BASENAME_GLOB,
  DEFAULT_EVIDENCE_BASENAME,
  EXIT_OK,
  EXIT_NO_CREDENTIALS,
  EXIT_ROTATED,
  EXIT_BAD_EVIDENCE_PATH,
} from './preview/verify-clio-paging.mjs';

// ── the stub ─────────────────────────────────────────────────────────────────

const ENV = {
  CLIO_CLIENT_ID:     'client-id-0123456789',
  CLIO_CLIENT_SECRET: 'client-secret-0123456789',
  CLIO_REFRESH_TOKEN: 'refresh-token-0123456789',
  CLIO_CALENDAR_ID:   '9084638',
};

const ACCESS_TOKEN = 'access-token-abcdefghijklmnop';

// The values the stub puts INSIDE each entry. Distinctive on purpose: the
// content test below asserts these never reach the output, and it has to be able
// to tell an entry's value from the `fields=start_at,end_at` in the request URL,
// which is a query and is recorded deliberately.
const ENTRY_START = '2026-08-05T09:00:00-04:00';
const ENTRY_END   = '2026-08-05T10:00:00-04:00';
const ENTRY = { start_at: ENTRY_START, end_at: ENTRY_END };

const json = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

/**
 * @param {object} plan
 * @param {Array<{count:number,next:string|undefined,meta?:any}>} plan.pages
 *        pages served in order to any calendar_entries GET whose limit is 200
 * @param {number|undefined} plan.oneRow   rows returned to the limit=1 read
 * @param {number|undefined} plan.calStatus non-200 for the calendar reads
 */
function makeStub(plan = {}) {
  const calls = [];
  let bigReads = 0;

  const fetchImpl = async (url, init) => {
    const u = String(url);
    // `redirect` and `body` are recorded because §7 asserts on the OPTION the
    // transport set, not only on the outcome. A stub cannot honour
    // `redirect: 'error'` — there is no redirect to refuse — so the option's
    // presence has to be witnessed directly or the fix could be deleted with the
    // suite still green.
    calls.push({ method: init?.method, url: u, redirect: init?.redirect, body: init?.body ?? null });

    if (u === CLIO_TOKEN_URL) {
      if (plan.mintStatus && plan.mintStatus !== 200) return json(plan.mintStatus, {});
      return json(200, {
        access_token: ACCESS_TOKEN,
        // Documented NOT to rotate. The stub returns the same one unless a test
        // is specifically about rotation.
        refresh_token: plan.rotateTo ?? ENV.CLIO_REFRESH_TOKEN,
      });
    }

    if (u.startsWith(`${CLIO_BASE}/calendar_entries`)) {
      if (plan.calStatus) return json(plan.calStatus, {});
      const parsed = new URL(u);
      const limit = parsed.searchParams.get('limit');
      const from  = parsed.searchParams.get('from');

      if (limit === '1') {
        const rows = plan.oneRow ?? 1;
        return json(200, {
          data: Array.from({ length: rows }, () => ({ ...ENTRY })),
          ...(plan.oneRowMeta === undefined ? {} : { meta: plan.oneRowMeta }),
        });
      }

      // The 2001 window is P4 and always answers empty unless a test says so.
      if (from && from.startsWith('2001-')) {
        return json(200, { data: [], ...(plan.emptyMeta === undefined ? {} : { meta: plan.emptyMeta }) });
      }

      const page = (plan.pages ?? [{ count: 3, next: undefined }])[bigReads] ?? { count: 0, next: undefined };
      bigReads += 1;
      const meta = page.meta !== undefined ? page.meta
                 : (page.next === undefined ? undefined : { paging: { next: page.next } });
      return json(200, {
        data: Array.from({ length: page.count }, () => ({ ...ENTRY })),
        ...(meta === undefined ? {} : { meta }),
      });
    }

    // FAIL CLOSED. Anything unrecognised is a defect, not a pass-through.
    throw new Error(`clio-paging stub: unmodelled request ${init?.method} ${u}`);
  };

  return { fetchImpl, calls };
}

const silent = () => {};
const capture = () => { const lines = []; return { sink: (l) => lines.push(String(l)), lines }; };

const run = (plan, over = {}) => {
  const stub = makeStub(plan);
  return runPagingProbe({
    env: ENV, fetchImpl: stub.fetchImpl, log: silent, logErr: silent, nowMs: Date.parse('2026-08-04T12:00:00Z'), ...over,
  }).then((out) => ({ out, calls: stub.calls }));
};

// ── 1. READ ONLY, on every path ──────────────────────────────────────────────

test('a clean run issues exactly one non-GET and it is the token mint', async () => {
  const { out, calls } = await run({ pages: [{ count: 12, next: undefined }] });

  const nonGet = calls.filter((c) => c.method !== 'GET');
  assert.equal(nonGet.length, 1);
  assert.equal(nonGet[0].method, 'POST');
  assert.equal(nonGet[0].url, CLIO_TOKEN_URL);
  assert.equal(out.requestLedger.oauthCalls, 1);
  assert.deepEqual(out.requestLedger.offClioCalls, []);
});

test('no request is a POST, PATCH, PUT or DELETE against /api/v4', async () => {
  const { calls } = await run({ pages: [{ count: 12, next: undefined }] });
  const apiWrites = calls.filter((c) => isClioApiUrl(c.url) && c.method !== 'GET');
  assert.deepEqual(apiWrites, []);
});

test('the READ ONLY step is asserted by the run itself and passes', async () => {
  const { out } = await run({ pages: [{ count: 12, next: undefined }] });
  const s = out.steps.find((x) => x.name.startsWith('READ ONLY'));
  assert.ok(s, 'the run must state the read-only claim');
  assert.equal(s.ok, true);
});

test('a walk over several pages is still GET-only', async () => {
  const next1 = `${CLIO_BASE}/calendar_entries?page_token=AAAA1111`;
  const next2 = `${CLIO_BASE}/calendar_entries?page_token=BBBB2222`;
  const { out, calls } = await run({
    pages: [
      { count: CALENDAR_PAGE_LIMIT, next: next1 },
      { count: CALENDAR_PAGE_LIMIT, next: next2 },
      { count: 7, next: undefined },
    ],
  });
  assert.equal(calls.filter((c) => c.method !== 'GET').length, 1);
  assert.equal(out.observations.walk.pages.length, 3);
  assert.equal(out.observations.walk.totalEntries, CALENDAR_PAGE_LIMIT * 2 + 7);
});

test('a 403 on the calendar read stops the run without any further request', async () => {
  const { out, calls } = await run({ calStatus: 403 });
  assert.equal(out.verdict.state, 'CALENDAR_SCOPE_LOST');
  assert.equal(calls.filter((c) => c.method !== 'GET').length, 1);
  // mint + exactly one calendar attempt, then stop.
  assert.equal(calls.filter((c) => isClioApiUrl(c.url)).length, 1);
  assert.ok(out.blockers.some((b) => b.includes('STOP')));
});

test('a dead grant is reported as the finding, and no calendar read is attempted', async () => {
  const { out, calls } = await run({ mintStatus: 400 });
  assert.equal(out.verdict.state, 'DEAD_GRANT');
  assert.equal(calls.filter((c) => isClioApiUrl(c.url)).length, 0);
});

test('a 500 from the token endpoint is MINT UNAVAILABLE, not a dead grant', async () => {
  const { out } = await run({ mintStatus: 500 });
  assert.equal(out.verdict.state, 'MINT_UNAVAILABLE');
});

test('missing credentials refuse to run and reach no host at all', async () => {
  const stub = makeStub({});
  const out = await runPagingProbe({
    env: { CLIO_CLIENT_ID: 'x'.repeat(20) }, fetchImpl: stub.fetchImpl, log: silent, logErr: silent,
  });
  assert.equal(out.exitCode, EXIT_NO_CREDENTIALS);
  assert.equal(out.verdict.state, 'NOT_RUN');
  assert.deepEqual(stub.calls, []);
  // THE POSITIVE ARM. "It made no requests" is only evidence if the ledger that
  // would have shown them ran and came back empty — an absent ledger and an empty
  // one look identical in a transcript.
  assert.deepEqual(out.requestLedger, {
    total: 0, methods: [], origins: [], nonGet: [], oauthCalls: 0, offClioCalls: [],
  });
  assert.ok(out.steps.some((s) => s.name.startsWith('READ ONLY') && s.ok));
});

test('a calendar id that coerces to a falsy number is refused, as resolveConfig refuses it', async () => {
  const stub = makeStub({});
  const out = await runPagingProbe({
    env: { ...ENV, CLIO_CALENDAR_ID: 'paul' }, fetchImpl: stub.fetchImpl, log: silent, logErr: silent,
  });
  assert.equal(out.exitCode, EXIT_NO_CREDENTIALS);
  assert.deepEqual(stub.calls, []);
});

// ── 2. the verdict is the BRANCH'S rule ──────────────────────────────────────

test('THE SUBJECT — a full final page with no cursor fires the backstop', () => {
  const r = replayBackstop([{ count: CALENDAR_PAGE_LIMIT, next: undefined }]);
  assert.equal(r.fires, true);
  assert.match(r.reason, /FULL/);
});

test('a short final page does not fire it', () => {
  const r = replayBackstop([{ count: CALENDAR_PAGE_LIMIT - 1, next: undefined }]);
  assert.equal(r.fires, false);
});

test('a full page followed to a short one does not fire it', () => {
  const r = replayBackstop([
    { count: CALENDAR_PAGE_LIMIT, next: `${CLIO_BASE}/calendar_entries?page_token=A` },
    { count: 4, next: undefined },
  ]);
  assert.equal(r.fires, false);
  assert.equal(r.entries, CALENDAR_PAGE_LIMIT + 4);
});

test('an empty page terminates cleanly — zero is under the limit', () => {
  assert.equal(replayBackstop([{ count: 0, next: undefined }]).fires, false);
});

test('exhausting the page bound with a cursor still outstanding fires it', () => {
  const pages = Array.from({ length: CALENDAR_MAX_PAGES }, () => ({
    count: CALENDAR_PAGE_LIMIT, next: `${CLIO_BASE}/calendar_entries?page_token=A`,
  }));
  const r = replayBackstop(pages);
  assert.equal(r.fires, true);
  assert.match(r.reason, /did not finish paging/);
});

test('an empty-string cursor is not a cursor — it is the last page', () => {
  assert.equal(replayBackstop([{ count: 3, next: '' }]).fires, false);
  assert.equal(replayBackstop([{ count: CALENDAR_PAGE_LIMIT, next: '' }]).fires, true);
});

test('a null cursor on a full page fires it — the branch tests typeof, not truthiness', () => {
  assert.equal(replayBackstop([{ count: CALENDAR_PAGE_LIMIT, next: null }]).fires, true);
});

test('a page sequence that never reaches a stop is INCONCLUSIVE, not a pass', () => {
  const r = replayBackstop([{ count: 5, next: `${CLIO_BASE}/calendar_entries?page_token=A` }]);
  assert.equal(r.fires, false);
  assert.equal(r.inconclusive, true);
});

test('end to end — no cursor and a full page reports WOULD FIRE', async () => {
  const { out } = await run({ pages: [{ count: CALENDAR_PAGE_LIMIT, next: undefined }] });
  assert.equal(out.verdict.state, 'SETTLED');
  assert.equal(out.verdict.backstopWouldFire, true);
  assert.equal(out.exitCode, EXIT_OK, 'a firing backstop is a result, not a crash');
});

test('end to end — a cursor and a short last page reports WOULD NOT FIRE, with headroom', async () => {
  const { out } = await run({
    pages: [
      { count: CALENDAR_PAGE_LIMIT, next: `${CLIO_BASE}/calendar_entries?page_token=AAAA1111` },
      { count: 11, next: undefined },
    ],
  });
  assert.equal(out.verdict.backstopWouldFire, false);
  assert.equal(out.verdict.entriesInWindow, CALENDAR_PAGE_LIMIT + 11);
});

test('headroom is measured against the FIRST page, which is the one that can come back full', async () => {
  const { out } = await run({ pages: [{ count: 137, next: undefined }] });
  assert.equal(out.verdict.backstopWouldFire, false);
  assert.equal(out.verdict.headroom, CALENDAR_PAGE_LIMIT - 137);
});

// ── 3. cursor classification, by origin as well as path ──────────────────────

test('an absolute Clio URL is ABSOLUTE_URL and names its host', () => {
  const c = classifyCursor(`${CLIO_BASE}/calendar_entries?page_token=AAAA`);
  assert.equal(c.kind, 'ABSOLUTE_URL');
  assert.equal(c.host, 'app.clio.com');
  assert.equal(c.sameOriginAsApi, true);
});

test('a well-formed URL at another host is ABSOLUTE_URL but NOT same-origin', () => {
  const c = classifyCursor('https://evil.example/api/v4/calendar_entries?page_token=AAAA');
  assert.equal(c.kind, 'ABSOLUTE_URL');
  assert.equal(c.host, 'evil.example');
  assert.equal(c.sameOriginAsApi, false, 'pathname alone cannot tell app.clio.com from any host');
});

test('the walk REFUSES a cursor that points off Clio rather than following it', async () => {
  const { out, calls } = await run({
    pages: [{ count: CALENDAR_PAGE_LIMIT, next: 'https://evil.example/api/v4/calendar_entries?page_token=AAAA' }],
  });
  assert.ok(!calls.some((c) => c.url.includes('evil.example')), 'the off-Clio cursor must never be fetched');
  assert.deepEqual(out.requestLedger.offClioCalls, []);
  assert.equal(out.verdict.state, 'INCONCLUSIVE');
});

test('a relative path is classified apart from a URL — the branch would feed it to fetch verbatim', () => {
  const c = classifyCursor('/api/v4/calendar_entries?page_token=AAAA');
  assert.equal(c.kind, 'RELATIVE_PATH');
  assert.equal(c.host, null);
});

test('absent, null, empty and non-string cursors are four distinct answers', () => {
  assert.equal(classifyCursor(undefined).kind, 'ABSENT');
  assert.equal(classifyCursor(null).kind, 'NULL');
  assert.equal(classifyCursor('').kind, 'EMPTY_STRING');
  assert.equal(classifyCursor(42).kind, 'NON_STRING');
});

test('a bare opaque cursor is neither a URL nor a path', () => {
  assert.equal(classifyCursor('eyJvIjoxMDB9').kind, 'OPAQUE_TOKEN');
});

// ── 4. what is recorded, and what is not ─────────────────────────────────────

test('meta is recorded verbatim, and the doc rendering elides only the cursor value', async () => {
  const meta = { paging: { next: `${CLIO_BASE}/calendar_entries?limit=200&page_token=SECRETCURSOR9` }, records: 412 };
  const { out } = await run({ pages: [{ count: CALENDAR_PAGE_LIMIT, next: meta.paging.next, meta }] });

  assert.deepEqual(out.observations.p2.metaVerbatim, meta, 'verbatim means verbatim');
  assert.equal(out.observations.p2.metaForDoc.records, 412, 'everything but the cursor survives');
  assert.ok(!JSON.stringify(out.observations.p2.metaForDoc).includes('SECRETCURSOR9'));
  assert.match(out.observations.p2.metaForDoc.paging.next, /<PAGE_TOKEN:len=13>/);
});

test('the absence of meta is recorded as an observation, not as an empty object', async () => {
  const { out } = await run({ pages: [{ count: 9, next: undefined }] });
  assert.equal(out.observations.p2.metaPresent, false);
  assert.equal(out.observations.p2.metaVerbatim, undefined);
  assert.deepEqual(out.observations.p2.topLevelKeys, ['data']);
});

test('the top-level key list is recorded, so "which keys came back" is answerable', async () => {
  const { out } = await run({ pages: [{ count: 9, next: undefined, meta: { records: 9 } }] });
  assert.deepEqual(out.observations.p2.topLevelKeys.sort(), ['data', 'meta']);
});

test('calendar CONTENT is never recorded — only counts', async () => {
  const { sink, lines } = capture();
  const stub = makeStub({ pages: [{ count: 5, next: undefined }] });
  const out = await runPagingProbe({ env: ENV, fetchImpl: stub.fetchImpl, log: sink, logErr: sink });

  // The VALUES inside the entries, not the field NAMES. `start_at` appears in the
  // recorded request URL as `fields=start_at,end_at`, which is the query the probe
  // is supposed to state out loud — asserting on the name would fail on the
  // evidence rather than on a leak. What must never appear is a row's contents:
  // those are the firm's schedule.
  const haystack = lines.join('\n') + JSON.stringify(out);
  assert.ok(!haystack.includes(ENTRY_START), 'an entry start time reached the output');
  assert.ok(!haystack.includes(ENTRY_END), 'an entry end time reached the output');
  assert.equal(out.observations.p2.count, 5, 'the count is what is kept');
});

test('the request the probe issues asks only for start_at and end_at', async () => {
  const { calls } = await run({ pages: [{ count: 5, next: undefined }] });
  const cal = calls.filter((c) => c.url.includes('/calendar_entries'));
  assert.ok(cal.length > 0);
  for (const c of cal) {
    if (!c.url.includes('fields=')) continue;
    assert.equal(new URL(c.url).searchParams.get('fields'), 'start_at,end_at');
  }
});

test('the production read sends limit=200 explicitly, as the branch does', async () => {
  const { calls } = await run({ pages: [{ count: 5, next: undefined }] });
  const withLimit = calls
    .filter((c) => c.url.includes('/calendar_entries'))
    .map((c) => new URL(c.url).searchParams.get('limit'));
  assert.ok(withLimit.includes('200'), 'the production-shaped read must state the limit');
  assert.ok(withLimit.includes('1'), 'the mechanism read must use limit=1');
});

test('the zero-row envelope is captured from a window that holds nothing', async () => {
  const { out } = await run({ pages: [{ count: 5, next: undefined }], emptyMeta: { records: 0 } });
  assert.equal(out.observations.p4.count, 0);
  assert.deepEqual(out.observations.p4.metaVerbatim, { records: 0 });
});

test('an empty mechanism read is reported as vacuous rather than as a missing cursor', async () => {
  const { out } = await run({ oneRow: 0, pages: [{ count: 5, next: undefined }] });
  assert.ok(out.notes.some((n) => n.includes('zero rows')));
  const s = out.steps.find((x) => x.name.startsWith('P1 a FULL page'));
  assert.equal(s, undefined, 'the full-page arm must not report a verdict it did not run');
});

// ── 5. secrets ───────────────────────────────────────────────────────────────

test('no credential appears in any emitted line or in the returned object', async () => {
  const { sink, lines } = capture();
  const stub = makeStub({ pages: [{ count: 5, next: undefined }] });
  const out = await runPagingProbe({ env: ENV, fetchImpl: stub.fetchImpl, log: sink, logErr: sink });

  const haystack = lines.join('\n') + JSON.stringify(out);
  for (const v of [ENV.CLIO_CLIENT_SECRET, ENV.CLIO_REFRESH_TOKEN, ACCESS_TOKEN]) {
    assert.ok(!haystack.includes(v), `a credential reached the output: ${v.slice(0, 6)}…`);
  }
  assert.equal(out.redaction.backstopHits, 0, 'the backstop firing at all is a defect');
});

test('the redactor replaces the longest value first', () => {
  const r = makeRedactor({ CLIO_CLIENT_ID: 'abcdefgh', CLIO_CLIENT_SECRET: 'abcdefghijkl' });
  assert.equal(r.scrub('abcdefghijkl'), '[REDACTED:CLIO_CLIENT_SECRET]');
});

test('a value too short to scrub is reported rather than silently trusted', () => {
  const r = makeRedactor({ CLIO_CLIENT_ID: 'ab' });
  assert.deepEqual(r.unscrubbable, ['CLIO_CLIENT_ID']);
});

test('a rotated refresh token is a loud blocker with its own exit code', async () => {
  const { out } = await run({ pages: [{ count: 5, next: undefined }], rotateTo: 'a-brand-new-refresh-token-1234' });
  assert.equal(out.refreshRotated, true);
  assert.equal(out.exitCode, EXIT_ROTATED);
  assert.ok(out.blockers.some((b) => b.includes('rotated')));
});

test('an unrotated refresh token is stated positively, not left silent', async () => {
  const { out } = await run({ pages: [{ count: 5, next: undefined }] });
  assert.equal(out.refreshRotated, false);
  assert.ok(out.steps.some((s) => s.name.includes('did not rotate') && s.ok));
});

// ── 6. the elider ────────────────────────────────────────────────────────────

test('elidePageToken keeps every other query parameter', () => {
  const e = elidePageToken(`${CLIO_BASE}/calendar_entries?limit=200&page_token=ABCDEFG&fields=start_at`);
  assert.match(e, /limit=200/);
  assert.match(e, /fields=start_at/);
  assert.match(e, /page_token=<PAGE_TOKEN:len=7>/);
});

test('elidePageToken leaves a string with no cursor alone', () => {
  assert.equal(elidePageToken('https://app.clio.com/api/v4/calendar_entries?limit=200'),
                              'https://app.clio.com/api/v4/calendar_entries?limit=200');
});

test('elideDeep reaches a cursor nested anywhere in the meta object', () => {
  const out = elideDeep({ paging: { next: `${CLIO_BASE}/x?page_token=ZZZZ`, prev: null }, records: 3 });
  assert.match(out.paging.next, /<PAGE_TOKEN:len=4>/);
  assert.equal(out.paging.prev, null);
  assert.equal(out.records, 3);
});

test('urlParts does not throw on a value that is not a URL', () => {
  assert.deepEqual(urlParts('not a url'), { origin: '', pathname: '' });
});

// ── 7. redirects — the mint is a POST, and a POST body survives a 3xx ─────────
//
// The GETs were never the exposure: the fetch specification strips
// `Authorization` on a cross-origin redirect, so the bearer token does not
// travel. The mint is different in kind. `POST /oauth/token` carries client_id,
// client_secret and refresh_token as FORM FIELDS in the body, and a 307 or 308
// re-issues the request to the redirect target with method and body preserved.
// Header stripping does nothing for a body. Those three values re-provision the
// firm's Clio grant.
//
// The request ledger cannot witness this. It records the URL the probe
// CONSTRUCTED, never the URL fetch finally contacted — so a followed redirect
// prints a clean `app.clio.com` line while the credentials are already gone. The
// printed read-only proof would be green and wrong.
//
// So this section asserts BOTH halves, because either alone is weak:
//   the OPTION — `redirect: 'error'` is on every request. A stub cannot honour
//     it (there is no real redirect to refuse), so if only behaviour were tested
//     the fix could be deleted and the suite would stay green.
//   the BEHAVIOUR — a stub that models a platform fetch's redirect handling,
//     driven through the real probe, delivers nothing to the other origin. And a
//     BROKEN CONTROL proves that stub can leak, so the passing arm means
//     something. See [[feedback_concurrency_test_needs_the_broken_control]].

const EVIL_ORIGIN = 'https://evil.example';
const EVIL_TOKEN_URL = `${EVIL_ORIGIN}/oauth/token`;

/**
 * A stub that models a PLATFORM fetch's `init.redirect` handling on the mint.
 *
 * Everything else is delegated to the ordinary stub. `arrivals` is what actually
 * reached a server — which, on the follow path, includes the redirect target.
 */
function makeRedirectingStub({ redirectTo = EVIL_TOKEN_URL, plan = {} } = {}) {
  const base = makeStub(plan);
  const arrivals = [];

  const fetchImpl = async (url, init) => {
    const u = String(url);
    arrivals.push({
      method: init?.method, url: u, origin: urlParts(u).origin,
      body: init?.body ?? null, redirect: init?.redirect,
    });

    if (u === redirectTo) {
      // The attacker's endpoint. It answers a well-formed mint, so under `follow`
      // the probe carries on happily with a token from the wrong origin — the
      // failure is silent, which is the point.
      return json(200, { access_token: 'token-from-the-wrong-origin', refresh_token: ENV.CLIO_REFRESH_TOKEN });
    }

    if (u === CLIO_TOKEN_URL) {
      // What a real fetch does with a 307, by `init.redirect`:
      if (init?.redirect === 'error') throw new TypeError('fetch failed');   // undici, verified on Node 22
      if (init?.redirect === 'manual') return json(307, {});
      return fetchImpl(redirectTo, init);   // 'follow' — the DEFAULT. Method and body preserved.
    }

    return base.fetchImpl(url, init);
  };

  return { fetchImpl, arrivals, calls: base.calls };
}

test('THE SUBJECT — a 3xx on the token mint is refused, not followed', async () => {
  const stub = makeRedirectingStub();
  const out = await runPagingProbe({ env: ENV, fetchImpl: stub.fetchImpl, log: silent, logErr: silent });

  const offClio = stub.arrivals.filter((a) => a.origin !== CLIO_ORIGIN);
  assert.deepEqual(offClio.map((a) => `${a.method} ${a.url}`), [],
    'a request reached an origin that is not app.clio.com');

  // And the run says so rather than reporting a token it never legitimately got.
  assert.equal(out.verdict.state, 'MINT_UNAVAILABLE');
  assert.ok(out.blockers.some((b) => b.includes('MINT UNAVAILABLE')));
});

test('THE SUBJECT — no request BODY reaches another origin when the mint 3xxs away', async () => {
  const stub = makeRedirectingStub();
  await runPagingProbe({ env: ENV, fetchImpl: stub.fetchImpl, log: silent, logErr: silent });

  for (const a of stub.arrivals) {
    if (a.origin === CLIO_ORIGIN) continue;
    assert.fail(`a request reached ${a.origin} carrying ${a.body === null ? 'no body' : `${String(a.body).length} bytes of body`}`);
  }

  // Named, so a future refactor that keeps the origin check but drops the option
  // fails on the value that actually matters rather than on a generic count.
  const leaked = stub.arrivals.filter((a) => a.origin !== CLIO_ORIGIN
    && [ENV.CLIO_CLIENT_SECRET, ENV.CLIO_REFRESH_TOKEN, ENV.CLIO_CLIENT_ID].some((v) => String(a.body ?? '').includes(v)));
  assert.deepEqual(leaked, [], 'a credential form field left app.clio.com');
});

test('THE BROKEN CONTROL — the same stub DOES leak the body under the platform default', async () => {
  // Without this, the two tests above prove nothing: a stub that could never
  // deliver anywhere would pass them while the probe followed redirects freely.
  // Here the stub is driven the way send() drove it BEFORE the fix — no
  // `redirect` option, so the platform default `follow` applies.
  const stub = makeRedirectingStub();
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: ENV.CLIO_CLIENT_ID,
    client_secret: ENV.CLIO_CLIENT_SECRET,
    refresh_token: ENV.CLIO_REFRESH_TOKEN,
  }).toString();

  const res = await stub.fetchImpl(CLIO_TOKEN_URL, { method: 'POST', body });

  assert.equal(res.status, 200, 'the follow path answers 200 — the failure is SILENT');
  assert.equal((await res.json()).access_token, 'token-from-the-wrong-origin');

  const atEvil = stub.arrivals.filter((a) => a.origin === EVIL_ORIGIN);
  assert.equal(atEvil.length, 1, 'the stub must be able to demonstrate the leak, or the passing arm is vacuous');
  assert.equal(atEvil[0].method, 'POST', 'a 307 preserves the method');
  for (const v of [ENV.CLIO_CLIENT_ID, ENV.CLIO_CLIENT_SECRET, ENV.CLIO_REFRESH_TOKEN]) {
    assert.ok(atEvil[0].body.includes(v), 'a 307 re-issues the request WITH ITS BODY — that is the whole exposure');
  }
});

test('the ledger reads clean either way — which is why the fix is at the transport', async () => {
  // Not a nice-to-have observation: it is the reason the option is load-bearing.
  // The ledger records the CONSTRUCTED url, so it prints the same app.clio.com
  // line whether or not the request was redirected elsewhere. It can never be
  // the control for this.
  const stub = makeRedirectingStub();
  const out = await runPagingProbe({ env: ENV, fetchImpl: stub.fetchImpl, log: silent, logErr: silent });

  assert.deepEqual(out.requestLedger.origins, [CLIO_ORIGIN]);
  assert.deepEqual(out.requestLedger.offClioCalls, [],
    'the ledger cannot see a followed redirect — the transport has to refuse it');
});

test('every request carries redirect:error — the OPTION, not just the outcome', async () => {
  const { calls } = await run({
    pages: [
      { count: CALENDAR_PAGE_LIMIT, next: `${CLIO_BASE}/calendar_entries?page_token=AAAA1111` },
      { count: 6, next: undefined },
    ],
  });
  assert.ok(calls.length >= 5, 'the mint, P1, P2, the walk page and P4');
  for (const c of calls) {
    assert.equal(c.redirect, 'error', `${c.method} ${c.url} was issued without redirect:error`);
  }
});

test('the mint still works against the stub with redirect:error set', async () => {
  // The stop condition on the order: the fix must not break the happy path.
  const { out, calls } = await run({ pages: [{ count: 12, next: undefined }] });
  const mint = calls.find((c) => c.url === CLIO_TOKEN_URL);
  assert.equal(mint.method, 'POST');
  assert.equal(mint.redirect, 'error');
  assert.ok(out.steps.some((s) => s.name === 'access token minted' && s.ok));
  assert.equal(out.verdict.state, 'SETTLED');
});

test('a 3xx on a calendar read is refused too, and the walk does not follow it', async () => {
  const stub = makeStub({ pages: [{ count: 5, next: undefined }] });
  const arrivals = [];
  const fetchImpl = async (url, init) => {
    arrivals.push({ url: String(url), origin: urlParts(url).origin });
    if (String(url).startsWith(`${CLIO_BASE}/calendar_entries`)) {
      if (init?.redirect === 'error') throw new TypeError('fetch failed');
      return fetchImpl(`${EVIL_ORIGIN}/api/v4/calendar_entries`, init);
    }
    return stub.fetchImpl(url, init);
  };

  const out = await runPagingProbe({ env: ENV, fetchImpl, log: silent, logErr: silent });
  assert.deepEqual(arrivals.filter((a) => a.origin !== CLIO_ORIGIN), []);
  assert.equal(out.verdict.state, 'READ_UNAVAILABLE');
});

// ── 8. the CLI — the untested block the disclosed issue lived in ──────────────
//
// This block parses operator input and then writes a file, in the one shell
// session that has the live Clio credentials exported. It had no controls at all.

const PROBE_URL = new URL('./preview/verify-clio-paging.mjs', import.meta.url);
const PREVIEW_DIR = path.dirname(fileURLToPath(PROBE_URL));
const REPO_ROOT = path.resolve(PREVIEW_DIR, '..', '..');
const inPreview = (raw) => resolveEvidencePath(raw, { moduleDir: PREVIEW_DIR, cwd: PREVIEW_DIR });
const fromRepoRoot = (raw) => resolveEvidencePath(raw, { moduleDir: PREVIEW_DIR, cwd: REPO_ROOT });

// ── 8a. the argument parser ──────────────────────────────────────────────────

test('the parser reads --days and --evidence, and defaults both', () => {
  assert.deepEqual(parseCliArgs([]), { daysRaw: undefined, days: 60, daysAccepted: true, evidenceRaw: undefined });
  const a = parseCliArgs(['--days=30', '--evidence=clio-paging-evidence-r2.json']);
  assert.equal(a.days, 30);
  assert.equal(a.evidenceRaw, 'clio-paging-evidence-r2.json');
});

test('--days outside 1..60 falls back to 60 AND says it did', () => {
  for (const bad of ['0', '-5', '999', 'sixty', '', 'NaN', 'Infinity']) {
    const a = parseCliArgs([`--days=${bad}`]);
    assert.equal(a.days, 60, `--days=${bad} must clamp`);
    assert.equal(a.daysAccepted, false, `--days=${bad} must be reported, not silently swallowed`);
  }
  assert.equal(parseCliArgs(['--days=60']).daysAccepted, true);
  assert.equal(parseCliArgs(['--days=1']).days, 1);
});

test('--evidence with no "=" is not a value — it falls back rather than resolving to ""', () => {
  assert.equal(parseCliArgs(['--evidence']).evidenceRaw, undefined);
  assert.equal(parseCliArgs(['--evidence=']).evidenceRaw, '', 'an explicit empty value IS a value, and is refused by name');
});

test('the last occurrence wins, and an unrelated argument is ignored', () => {
  assert.equal(parseCliArgs(['--days=10', '--days=20']).days, 20);
  assert.equal(parseCliArgs(['--verbose', 'x', '--days=10']).days, 10);
  assert.equal(parseCliArgs(['not--days=10']).days, 60, 'a flag must START the argument');
});

// ── 8b. the evidence path — the file-overwrite primitive ─────────────────────

test('the default evidence path is the gitignored file in test/preview', () => {
  const r = inPreview(undefined);
  assert.equal(r.ok, true);
  assert.equal(path.basename(r.path), DEFAULT_EVIDENCE_BASENAME);
  assert.equal(path.dirname(r.path), PREVIEW_DIR);
});

test('a matching name in test/preview is accepted, typed either way', () => {
  assert.equal(inPreview('clio-paging-evidence.json').ok, true);
  assert.equal(inPreview('clio-paging-evidence-r2.json').ok, true);
  assert.equal(fromRepoRoot('test/preview/clio-paging-evidence.json').ok, true);
  assert.equal(fromRepoRoot('test/preview/../preview/clio-paging-evidence-x.json').ok, true,
    'a path that normalises back into the directory is fine — containment, not string prefix');
});

test('THE DISCLOSED ISSUE — --evidence=.dev.vars is refused by name, before anything is sent', () => {
  const r = fromRepoRoot('.dev.vars');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'NOT_IN_PREVIEW_DIR');
  assert.match(r.detail, /test\/preview/);
  assert.ok(r.resolved.endsWith('.dev.vars'), 'the refusal names the path it resolved to');
  assert.equal(EXIT_BAD_EVIDENCE_PATH, 6);
});

test('escaping test/preview is refused however it is spelled', () => {
  const escapes = [
    '../../.dev.vars',
    '../../donovan-legal-site/index.html',
    '../booking-evidence.json',
    'clio-paging-evidence.json/../../../.dev.vars',
    path.join(REPO_ROOT, '.dev.vars'),
    process.platform === 'win32' ? 'D:\\clio-paging-evidence.json' : '/etc/clio-paging-evidence.json',
  ];
  for (const e of escapes) {
    const r = inPreview(e);
    assert.equal(r.ok, false, `${e} was ACCEPTED`);
    assert.equal(r.reason, 'NOT_IN_PREVIEW_DIR', `${e} refused for the wrong reason`);
  }
});

test('a subdirectory of test/preview is refused — the ignore glob does not cross a separator', () => {
  const r = inPreview('sub/clio-paging-evidence.json');
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'NOT_IN_PREVIEW_DIR');
});

test('a non-matching name INSIDE test/preview is refused, including the TRACKED evidence files', () => {
  // These are the ones the order left alone deliberately. They are committed, so
  // overwriting one with a live capture puts that capture into a diff.
  for (const name of ['booking-evidence.json', 'notes.json', 'clio-paging-evidence.json.bak',
                      'clio-paging-evidence', 'x-clio-paging-evidence.json']) {
    const r = inPreview(name);
    assert.equal(r.ok, false, `${name} was ACCEPTED`);
    assert.equal(r.reason, 'NOT_IGNORED_NAME', `${name} refused for the wrong reason`);
    assert.match(r.detail, /clio-paging-evidence\*\.json/);
  }
});

test('a symlink at an ALLOWED name is refused — the name checked must be the file written', (t) => {
  // Every other check is on the name. writeFileSync follows a symlink, so a link
  // called clio-paging-evidence.json pointing at .dev.vars passes the containment
  // check AND the glob check and still destroys the credential file.
  const link = path.join(PREVIEW_DIR, 'clio-paging-evidence-linktest.json');
  const target = path.join(os.tmpdir(), 'clio-paging-linktest-target');

  rmSync(link, { force: true });
  try {
    writeFileSync(target, 'sentinel', 'utf8');
    symlinkSync(target, link);
  } catch (err) {
    // Windows needs Developer Mode or elevation for symlinkSync. Skipping is
    // honest; silently passing would report coverage that never ran.
    rmSync(link, { force: true });
    return t.skip(`this environment cannot create a symlink (${err.code}) — the arm did not run`);
  }

  try {
    const r = inPreview('clio-paging-evidence-linktest.json');
    assert.equal(r.ok, false, 'a symlink at an allowed name was ACCEPTED');
    assert.equal(r.reason, 'SYMLINK');
    assert.equal(readFileSync(target, 'utf8'), 'sentinel', 'the link target was modified');
  } finally {
    rmSync(link, { force: true });
    rmSync(target, { force: true });
  }
});

test('a REGULAR file at an allowed name is still accepted — the symlink check is not a blanket refusal', () => {
  const existing = path.join(PREVIEW_DIR, 'clio-paging-evidence-overwrite.json');
  try {
    writeFileSync(existing, '{}', 'utf8');
    const r = inPreview('clio-paging-evidence-overwrite.json');
    assert.equal(r.ok, true, 'overwriting a previous evidence file is the ordinary case and must work');
  } finally {
    rmSync(existing, { force: true });
  }
});

test('an empty --evidence value is refused by its own name, not treated as the default', () => {
  for (const v of ['', '   ']) {
    const r = resolveEvidencePath(v, { moduleDir: PREVIEW_DIR, cwd: PREVIEW_DIR });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'EMPTY');
  }
});

test('if the probe is ever moved out of test/preview the flag refuses everything', () => {
  // The .gitignore rule is ANCHORED at test/preview/. Move the file and the rule
  // stops covering its directory, so the argument for writing a live capture to
  // disk has expired — it must not keep writing on the old reasoning.
  const moved = resolveEvidencePath('clio-paging-evidence.json', {
    moduleDir: path.join(REPO_ROOT, 'scripts'), cwd: REPO_ROOT,
  });
  assert.equal(moved.ok, false);
  assert.equal(moved.reason, 'PROBE_DIR_MOVED');
});

// ── 8c. the validation is bound to the real .gitignore, not to a copy of it ──

const GITIGNORE = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
const IGNORE_LINE = `test/preview/${EVIDENCE_BASENAME_GLOB}`;

test('the .gitignore rule the validation is bound to is still present', () => {
  const lines = GITIGNORE.split(/\r?\n/).map((s) => s.trim());
  assert.ok(lines.includes(IGNORE_LINE),
    `.gitignore must still carry "${IGNORE_LINE}" — the evidence path validation is bound to it, `
    + 'and widening or moving it silently unbounds a write that runs with the live credentials');
});

test('every path the validator ACCEPTS is covered by that .gitignore glob', () => {
  // Derived from the file, so an edit to .gitignore reds here rather than
  // drifting apart from the code that trusts it.
  const globBase = IGNORE_LINE.split('/').pop();
  const re = new RegExp('^' + globBase.split('*')
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[^/\\\\]*') + '$');

  for (const name of [DEFAULT_EVIDENCE_BASENAME, 'clio-paging-evidence.json',
                      'clio-paging-evidence-r2.json', 'clio-paging-evidence-2026-08-04.json']) {
    const r = inPreview(name);
    assert.equal(r.ok, true, `${name} should be accepted`);
    assert.match(path.basename(r.path), re, `${name} is accepted but the ignore rule does not cover it`);
  }
});

// ── 8c-ii. the CLI must actually CALL the validator ──────────────────────────
//
// Everything above tests resolveEvidencePath as a function. None of it proves
// the CLI block invokes it — a block can spell the guard perfectly and still
// pass straight through ([[feedback_middleware_can_spell_the_guard_and_still_pass_through]]).
// Verified: deleting the `if (!evidence.ok)` arm leaves every unit test above
// green, and reds only the three below.
//
// These run the file as a script, which is the only way to reach that block. All
// three targets are harmless if the refusal EVER regresses — a probe that writes
// to `.dev.vars` to prove it must not write to `.dev.vars` has already destroyed
// the thing it was protecting ([[feedback_negative_path_probe_can_write]]). No
// credentials are supplied, so no request is made either way.

/** Run the probe as a script with the Clio credentials explicitly absent. */
function runCli(args) {
  const env = { ...process.env };
  for (const k of ['CLIO_CLIENT_ID', 'CLIO_CLIENT_SECRET', 'CLIO_REFRESH_TOKEN', 'CLIO_CALENDAR_ID']) delete env[k];
  try {
    const stdout = execFileSync(process.execPath, [fileURLToPath(PROBE_URL), ...args],
      { cwd: REPO_ROOT, env, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { code: 0, stdout, stderr: '' };
  } catch (err) {
    return { code: err.status, stdout: String(err.stdout ?? ''), stderr: String(err.stderr ?? '') };
  }
}

test('END TO END — the CLI refuses a path outside test/preview and writes nothing', () => {
  // Outside the directory, so harmless if the refusal regressed, and named
  // to match the glob so ONLY the containment arm can be what refuses it.
  const target = path.join(os.tmpdir(), 'clio-paging-evidence-CONTROL.json');
  rmSync(target, { force: true });

  const r = runCli([`--evidence=${target}`]);

  assert.equal(r.code, EXIT_BAD_EVIDENCE_PATH,
    `expected exit ${EXIT_BAD_EVIDENCE_PATH}; got ${r.code}. Exit 2 means the CLI ran the probe and never consulted the validator.`);
  assert.match(r.stderr, /REFUSED/);
  assert.match(r.stderr, /test\/preview/);
  assert.match(r.stderr, /nothing was sent, and nothing was written/);
  assert.equal(existsSync(target), false, 'the refused path was WRITTEN — the flag is still a write primitive');
});

test('END TO END — the CLI refuses a non-ignored name inside test/preview', () => {
  const target = path.join(PREVIEW_DIR, 'not-an-ignored-name.json');
  rmSync(target, { force: true });

  const r = runCli(['--evidence=test/preview/not-an-ignored-name.json']);

  assert.equal(r.code, EXIT_BAD_EVIDENCE_PATH);
  assert.match(r.stderr, /clio-paging-evidence\*\.json/);
  assert.equal(existsSync(target), false, 'an untracked-but-not-ignored name was written');
});

test('END TO END — the refusal is not blanket: an allowed path runs and reaches the credential check', () => {
  // THE POSITIVE ARM. Without it, a validator that refused everything would pass
  // both tests above. Exit 2 is EXIT_NO_CREDENTIALS — the run started, found no
  // credentials, sent nothing, and still wrote its (empty) evidence file, which
  // is what proves the accepted path is genuinely writable.
  const target = path.join(PREVIEW_DIR, 'clio-paging-evidence-selftest.json');
  rmSync(target, { force: true });
  try {
    const r = runCli(['--evidence=test/preview/clio-paging-evidence-selftest.json']);

    assert.equal(r.code, EXIT_NO_CREDENTIALS, 'an allowed path must get past validation, not be refused');
    assert.ok(!r.stderr.includes('REFUSED'), 'an allowed path must not be refused');
    assert.equal(existsSync(target), true, 'the accepted path was not actually written');

    const written = JSON.parse(readFileSync(target, 'utf8'));
    assert.equal(written.verdict.state, 'NOT_RUN');
    assert.deepEqual(written.requests, [], 'no request was issued without credentials');
  } finally {
    rmSync(target, { force: true });
  }
});

// ── 8d. the guard ────────────────────────────────────────────────────────────

test('the guard is false when the module is imported rather than run', () => {
  assert.equal(isDirectInvocation(undefined), false);
  assert.equal(isDirectInvocation(''), false);
  assert.equal(isDirectInvocation(path.join(REPO_ROOT, 'test', 'some-other.test.mjs')), false);
});

test('the guard is true when the probe itself is argv[1], however the path is spelled', () => {
  const direct = fileURLToPath(PROBE_URL);
  assert.equal(isDirectInvocation(direct, PROBE_URL.href), true);
  assert.equal(isDirectInvocation(path.join(PREVIEW_DIR, '.', 'verify-clio-paging.mjs'), PROBE_URL.href), true);
  assert.equal(isDirectInvocation(direct.split(path.sep).join('/'), PROBE_URL.href), true);
});

test('the guard does not throw on an argv[1] that is not a usable path', () => {
  for (const junk of ['\0', 'https://example.com/x.mjs', '   ']) {
    assert.doesNotThrow(() => isDirectInvocation(junk));
  }
});

test('THE POSITIVE ARM — importing the probe into this suite launched no run', () => {
  // The guard's whole job. If it were inverted, importing this module at the top
  // of this file would have minted a token against the live app.clio.com before
  // a single test ran. Asserting the boolean is not the same as asserting that
  // the import was inert, so both are stated.
  assert.equal(isDirectInvocation(process.argv[1], PROBE_URL.href), false,
    'the test runner must never be mistaken for a direct invocation of the probe');
  assert.notEqual(path.resolve(process.argv[1] ?? ''), fileURLToPath(PROBE_URL));
});
