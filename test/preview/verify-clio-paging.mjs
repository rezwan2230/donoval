// ── SHELDON-CLIO-PAGING-PROBE-R1 — is Clio's paging cursor actually there? ────
//
//   CLIO_CLIENT_ID=… CLIO_CLIENT_SECRET=… CLIO_REFRESH_TOKEN=… CLIO_CALENDAR_ID=… \
//     node test/preview/verify-clio-paging.mjs [--days=60] [--evidence=<path>]
//
// Exit code is 0 whether the answer is WOULD FIRE or WOULD NOT FIRE — a firing
// backstop is a RESULT, not a crash. Non-zero is reserved for the instrument
// failing (see EXIT_* below). Read the verdict block it prints.
//
// ── THE QUESTION, AND WHY IT DECIDES A MERGE ─────────────────────────────────
// Branch sheldon/booking-safety (84adc05) makes /booking/availability walk the
// calendar read and then REFUSE a final page that came back FULL:
//
//     if (!hasNext && page.length >= CALENDAR_PAGE_LIMIT) throw …truncated…
//
// That is the right shape IF Clio emits `meta.paging.next`. If it does not, the
// walk never gets a second page, every full first page is refused, and the throw
// reaches the route as a 503 — so the branch does not narrow a booking bug, it
// takes booking down for every client the moment the firm's 60-day window holds
// 200 entries. 200 in 60 days is ~3.3 a day. That is an ordinary working
// attorney, not an edge case.
//
// The design rests on a response property the vendored contract does not
// document. Read for yourself:
//
//     integrations/clio/openapi.v4.json
//       components.schemas.CalendarEntry_List
//         = { type:"object", required:["data"], properties:{ data:{…} } }
//
// `meta` is not there. It is not a response property on ANY of the spec's
// schemas. The only things behind the walk are a 2026-07-03 sandbox note and
// clio-custom-fields.js walking the same key on a DIFFERENT endpoint. Neither is
// this endpoint, on this grant, today. This file is that reading.
//
// ── NOTHING IS WRITTEN. AT ALL. ──────────────────────────────────────────────
// Every Clio call this file makes is a GET, with exactly one exception, and the
// run prints a request ledger so a reader does not have to take that sentence on
// trust. The exception is the token mint:
//
//   POST https://app.clio.com/oauth/token   grant_type=refresh_token
//
// which is a POST by transport and a mint by effect. It is NOT a
// re-authorisation: a re-authorisation issues a NEW refresh token and kills the
// live one, which takes production booking down. A plain refresh does not rotate
// (verified 2026-07-03, provider-clio.js header). This run checks anyway — if
// Clio hands back a refresh_token that differs from the one supplied, the run
// says so loudly and exits EXIT_ROTATED, because the operator's stored credential
// is now stale and booking is on borrowed time.
//
// WHAT THE LEDGER CAN AND CANNOT WITNESS. It records the URL this file
// CONSTRUCTED, not the URL fetch finally contacted, so on its own it cannot see
// a redirect — a followed 3xx would move the request to another origin while the
// ledger printed a clean app.clio.com line. That gap is closed at the transport
// rather than in the report: `redirect: 'error'` on every request (see send()),
// so there is no second hop for the ledger to miss. The ledger is honest about
// the requests it issues; the fetch option is what makes "issued" and "contacted"
// the same thing.
//
// No calendar entry, contact or note is created, modified or deleted. There is no
// POST, PATCH or DELETE to /api/v4/ anywhere in this file. An "error path" probe
// in this tree has already booked a real appointment on Paul's calendar once
// ([[feedback_negative_path_probe_can_write]]) — a probe near the booking
// integration gets exactly one benefit of the doubt, and this one spends it on
// being unable to write rather than on being careful.
//
// ── NO SECRET IS PRINTED, AND NO EVIDENCE FILE CARRIES ONE ───────────────────
// There are TWO redactors, and they do not hold the same thing. Saying so
// matters, because "a redactor" implies one instrument and the difference is the
// whole reason the second one is adequate.
//
//   The RUN's redactor — every emitted line. Built from the three credential
//     names in CREDENTIAL_VARS, and the minted access token is ADDED to it the
//     moment the mint returns, so the token cannot reach the stream either.
//   The CLI's redactor — the evidence file. A FRESH instance, built from
//     process.env, holding those same three credential names and NOT the access
//     token: it is constructed in the CLI block, which never sees the token.
//
// That is sound rather than an oversight, but only because of something proved
// separately: the returned object carries no access token to redact. readPage
// keeps counts, keys and `meta`; the token lives in a local and is never written
// into `out`. A control asserts it, so if that ever changes the second redactor's
// narrower reach becomes a test failure rather than a quiet leak into a file.
//
// The redactor firing is a DEFECT, not a save: this file is built from
// placeholders and should never construct such a line, so a hit is reported as a
// blocker with its own exit code.
//
// The evidence file is gitignored (.gitignore, `test/preview/clio-paging-evidence*.json`)
// because it holds a verbatim capture taken with a live token. The other
// *-evidence.json files in this directory ARE tracked; that is pre-existing and
// not touched here, but nothing this order produces joins them.
//
// ── WHAT IS RECORDED, AND HOW IT IS TRIMMED ──────────────────────────────────
// The observed `meta` object is recorded VERBATIM, which is the whole deliverable.
// Two renderings are produced:
//
//   metaVerbatim  — byte for byte, evidence file only.
//   metaForDoc    — identical except the `page_token` query value inside any URL
//                   is replaced with <PAGE_TOKEN:len=N>. That is the ONLY
//                   alteration, it is announced in the output, and it exists
//                   because docs/CLIO-PAGING-CONTRACT.md is committed and an
//                   opaque live cursor does not belong in the repository.
//
// CALENDAR CONTENT IS NEVER RECORDED. That is the guarantee, and it is the only
// one this file can make. readPage reads `body.data.length` and nothing else —
// no row, no field of a row, on any page, from any request. It holds whatever
// the response contains.
//
// The narrower claim about `fields` is NOT that guarantee and must not be read
// as one. `fields=start_at,end_at` — the same selection the adapter uses — is
// applied to the URLs THIS FILE CONSTRUCTS: P1, P2 and P4. The P3 walk does not
// construct a URL. It follows Clio's `meta.paging.next` verbatim, which is the
// point of the walk (it is the branch's own behaviour), and that cursor carries
// whatever query Clio chose to put in it. If Clio does not round-trip `fields`,
// page two onward come back as FULL entries — summary, description, attendees,
// client names, the firm's schedule in the clear.
//
// It cannot presently be said which of those Clio does, because no live reading
// has been taken; that is what the probe is for. So the selection is stated as
// what it is — a request the first page's URL makes, unverified past page one —
// and the thing standing between a full entry and the disk is that no row is
// ever read out of the body in the first place. Controls assert that: the stub
// serves rows with distinctive values, and they appear in no line and nowhere in
// the returned object.
//
// ── THE FOUR READS ───────────────────────────────────────────────────────────
//   P1  MECHANISM      limit=1  over the 60-day window. The cheapest decisive
//                      test: one entry is a FULL page, so `next` present or
//                      absent answers "does this endpoint page at all" without
//                      depending on how busy the firm is. Vacuous only if the
//                      window is empty, and it says so if it is.
//   P2  PRODUCTION     limit=200 over the same window — byte for byte the first
//                      request sheldon/booking-safety issues.
//   P3  WALK           follows P2's cursor, bounded at 10 pages, running the
//                      BRANCH'S OWN loop. Its terminal page is the observed
//                      no-more-pages shape (Task 3).
//   P4  EMPTY          limit=200 over a window in 2001, which holds nothing. The
//                      zero-row envelope, the limit case of "smaller than the
//                      limit".
//
// P3 re-implements the branch's rule rather than describing it, so the Task 4
// verdict is the branch's own arithmetic on today's real calendar and not a
// paraphrase of it.

import { writeFileSync, lstatSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// ── Constants ────────────────────────────────────────────────────────────────

// Origin AND pathname, everywhere. Clio's OAuth endpoint shares a host with the
// API, so "the mint is the only call to the oauth host" is unenforceable as
// written — the ledger anchors on pathname: exactly one request under /oauth/,
// everything else under /api/v4/, nothing at any other origin.
// See [[feedback_pathname_only_url_check_cannot_see_the_host]].
export const CLIO_ORIGIN    = 'https://app.clio.com';
export const CLIO_TOKEN_URL = `${CLIO_ORIGIN}/oauth/token`;
export const CLIO_BASE      = `${CLIO_ORIGIN}/api/v4`;
const OAUTH_PATH_PREFIX = '/oauth/';
const API_PATH_PREFIX   = '/api/v4/';

// THE TWO NUMBERS THE BRANCH USES. Not re-derived — copied, so this probe's
// verdict is about the code that would merge. provider-clio.js on
// sheldon/booking-safety: CALENDAR_PAGE_LIMIT = 200, CALENDAR_MAX_PAGES = 10.
export const CALENDAR_PAGE_LIMIT = 200;
export const CALENDAR_MAX_PAGES  = 10;

// The horizon /booking/availability caps at. availability.js parseDays: default
// 30, MAX 60. 60 is the window where the backstop is most likely to fire, so it
// is the window that decides the merge.
const DEFAULT_DAYS = 60;

// The same selection the adapter asks for. Deliberately not widened: a probe that
// pulls summaries to be helpful pulls the firm's schedule onto a disk.
const ENTRY_FIELDS = 'start_at,end_at';

const CREDENTIAL_VARS = ['CLIO_CLIENT_ID', 'CLIO_CLIENT_SECRET', 'CLIO_REFRESH_TOKEN'];

// Shorter than this and a "secret" appears inside ordinary words; a redactor that
// replaced it would corrupt every line it touched while proving nothing. Reported
// as unscrubbable instead of silently trusted.
const MIN_REDACTABLE_LEN = 8;

const REQUEST_TIMEOUT_MS = 20_000;

// WOULD_FIRE and WOULD_NOT_FIRE are both 0 — see the header. These are about the
// instrument, not the answer.
export const EXIT_OK              = 0;
export const EXIT_NO_CREDENTIALS  = 2;
export const EXIT_ROTATED         = 3;
export const EXIT_BACKSTOP_HIT    = 4;   // the redaction backstop, not the branch's
export const EXIT_NOT_READ_ONLY   = 5;

// ── URL containment ──────────────────────────────────────────────────────────

export function urlParts(u) {
  try {
    const parsed = new URL(String(u));
    return { origin: parsed.origin, pathname: parsed.pathname };
  } catch (_) {
    return { origin: '', pathname: '' };
  }
}

export function isClioApiUrl(u) {
  const { origin, pathname } = urlParts(u);
  return origin === CLIO_ORIGIN && pathname.startsWith(API_PATH_PREFIX);
}

export function isClioOauthUrl(u) {
  const { origin, pathname } = urlParts(u);
  return origin === CLIO_ORIGIN && pathname.startsWith(OAUTH_PATH_PREFIX);
}

// ── Redaction ────────────────────────────────────────────────────────────────

/**
 * Longest value first, so a credential containing another is replaced whole
 * rather than leaving a fragment behind.
 */
export function makeRedactor(secrets) {
  const entries = [];
  const unscrubbable = [];
  let hits = 0;
  const fired = new Set();

  const add = (name, raw) => {
    const value = String(raw ?? '');
    if (!value) return;
    if (value.length < MIN_REDACTABLE_LEN) {
      if (!unscrubbable.includes(name)) unscrubbable.push(name);
      return;
    }
    if (entries.some((e) => e.value === value)) return;
    entries.push({ name, value });
    entries.sort((a, b) => b.value.length - a.value.length);
  };

  for (const name of CREDENTIAL_VARS) add(name, secrets?.[name]);

  return {
    add,
    get unscrubbable() { return [...unscrubbable]; },
    get hits() { return hits; },
    get fired() { return [...fired]; },
    scrub(text) {
      let s = String(text);
      for (const e of entries) {
        if (!s.includes(e.value)) continue;
        fired.add(e.name);
        hits += 1;
        s = s.split(e.value).join(`[REDACTED:${e.name}]`);
      }
      return s;
    },
  };
}

/**
 * Replace the `page_token` query VALUE in a URL with its length only.
 *
 * The cursor is not a credential — it is useless without a bearer token — but it
 * is opaque, live, and this string is bound for a committed markdown file. The
 * length is kept because it is the one property a reader might want (it says the
 * cursor is a token, not an offset) and it discloses nothing.
 *
 * Returns the input unchanged if it is not a URL or carries no page_token, so a
 * relative-path cursor or a bare token is passed through for the caller to
 * classify rather than silently mangled.
 */
export function elidePageToken(raw) {
  const s = String(raw ?? '');
  if (!s) return s;
  return s.replace(/([?&]page_token=)([^&#]*)/g, (_m, prefix, value) =>
    `${prefix}<PAGE_TOKEN:len=${value.length}>`);
}

/** Deep-walk any JSON value applying elidePageToken to every string. */
export function elideDeep(value) {
  if (typeof value === 'string') return elidePageToken(value);
  if (Array.isArray(value)) return value.map(elideDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = elideDeep(v);
    return out;
  }
  return value;
}

// ── Cursor classification (Task 2) ───────────────────────────────────────────

/**
 * What KIND of thing is meta.paging.next, and where does it point?
 *
 * The three answers are not interchangeable. An ABSOLUTE url is followed whole
 * (which is what both this file and the branch do). A RELATIVE path would mean
 * the branch's `url = next` assignment feeds a non-URL to fetch and the walk dies
 * on the second page — a bug the branch cannot currently see because it has never
 * had a second page. An OPAQUE token would mean the caller has to rebuild the
 * query itself, which the branch does not do at all.
 *
 * `host` is reported separately and not folded into the class, because a cursor
 * that is a perfectly good absolute URL pointing at a host that is not
 * app.clio.com is the one shape that must never be followed —
 * [[feedback_pathname_only_url_check_cannot_see_the_host]].
 */
export function classifyCursor(next) {
  if (next === undefined) return { kind: 'ABSENT', detail: 'meta.paging.next is not present' };
  if (next === null)      return { kind: 'NULL',   detail: 'meta.paging.next is present and null' };
  if (typeof next !== 'string') {
    return { kind: 'NON_STRING', detail: `meta.paging.next is a ${Array.isArray(next) ? 'array' : typeof next}` };
  }
  if (next === '') return { kind: 'EMPTY_STRING', detail: 'meta.paging.next is the empty string' };

  const { origin, pathname } = urlParts(next);
  if (origin) {
    return {
      kind: 'ABSOLUTE_URL',
      host: new URL(next).host,
      origin,
      pathname,
      sameOriginAsApi: isClioApiUrl(next),
      detail: `absolute URL at ${origin}${pathname}`,
    };
  }
  if (next.startsWith('/')) {
    return { kind: 'RELATIVE_PATH', host: null, pathname: next.split('?')[0], detail: 'a root-relative path — names no host' };
  }
  return { kind: 'OPAQUE_TOKEN', host: null, detail: 'neither a URL nor a path — an opaque cursor value' };
}

// ── The branch's own rule, re-implemented ────────────────────────────────────

/**
 * Replays fetchBusyBlocks' stopping logic from sheldon/booking-safety over an
 * ALREADY-OBSERVED sequence of pages. Copied from the branch, not summarised —
 * this is what decides Task 4, so a paraphrase would be answering a different
 * question.
 *
 * @param {Array<{count:number, next:any}>} pages  observed, in order
 * @returns {{fires:boolean, reason:string, pagesWalked:number, entries:number}}
 */
export function replayBackstop(pages) {
  let entries = 0;
  let pagesWalked = 0;

  for (const page of pages) {
    pagesWalked += 1;
    entries += page.count;

    const next = page.next;
    const hasNext = typeof next === 'string' && next !== '';

    if (!hasNext) {
      if (page.count >= CALENDAR_PAGE_LIMIT) {
        return {
          fires: true,
          reason: `page ${pagesWalked} came back FULL (${page.count} of a ${CALENDAR_PAGE_LIMIT} limit) with no next cursor`
                + ' — the branch throws "returned a truncated entry list" and the route answers 503',
          pagesWalked, entries,
        };
      }
      return {
        fires: false,
        reason: `the walk ended on page ${pagesWalked} with ${page.count} entries, under the ${CALENDAR_PAGE_LIMIT} limit`
              + ' — a short final page is a complete answer and the backstop is not reached',
        pagesWalked, entries,
      };
    }

    if (pagesWalked >= CALENDAR_MAX_PAGES) {
      return {
        fires: true,
        reason: `the walk exhausted the ${CALENDAR_MAX_PAGES}-page bound with a next cursor still outstanding`
              + ' — the branch throws "did not finish paging"',
        pagesWalked, entries,
      };
    }
  }

  return {
    fires: false,
    reason: 'the observed page sequence ended before the branch\'s loop reached a stopping condition'
          + ' — INCONCLUSIVE, not a pass',
    pagesWalked, entries,
    inconclusive: true,
  };
}

// ── The run ──────────────────────────────────────────────────────────────────

const isoAt = (ms) => new Date(ms).toISOString();

/**
 * @param {object}   opts
 * @param {object}   opts.env       process.env, or a stub
 * @param {Function} opts.fetchImpl injected so the control suite can drive this
 *                                  offline without touching app.clio.com
 * @param {number}   opts.days
 * @param {number}   opts.nowMs
 */
export async function runPagingProbe({ env, fetchImpl = fetch, days = DEFAULT_DAYS, nowMs = Date.now(), log = console.log, logErr = console.error } = {}) {
  const redactor = makeRedactor(env);
  const emit    = (line = '') => log(redactor.scrub(String(line)));
  const emitErr = (line = '') => logErr(redactor.scrub(String(line)));

  const out = {
    order: 'SHELDON-CLIO-PAGING-PROBE-R1',
    startedAt: isoAt(nowMs),
    windowDays: days,
    pageLimit: CALENDAR_PAGE_LIMIT,
    maxPages: CALENDAR_MAX_PAGES,
    requests: [],
    steps: [],
    observations: {},
    blockers: [],
    notes: [],
    verdict: null,
    exitCode: EXIT_OK,
  };

  const step = (name, ok, detail = '') => {
    out.steps.push({ name, ok, detail });
    emit(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  };
  const blocker = (msg) => { out.blockers.push(msg); emit(`BLOCKER  ${msg}`); };

  emit('── SHELDON-CLIO-PAGING-PROBE-R1 ──────────────────────────────────────');
  emit(`window: ${days} days from ${isoAt(nowMs)}`);
  emit('');

  // ── credentials ────────────────────────────────────────────────────────────
  const missing = CREDENTIAL_VARS.filter((v) => !String(env?.[v] ?? '').trim());
  const calendarIdRaw = String(env?.CLIO_CALENDAR_ID ?? '').trim();
  if (!calendarIdRaw) missing.push('CLIO_CALENDAR_ID');

  if (missing.length) {
    step('credentials supplied', false, `missing: ${missing.join(', ')}`);
    blocker('the probe cannot read the live grant without the four environment values');
    emit('');
    emit('Run it as:');
    emit('  CLIO_CLIENT_ID=… CLIO_CLIENT_SECRET=… CLIO_REFRESH_TOKEN=… CLIO_CALENDAR_ID=… \\');
    emit('    node test/preview/verify-clio-paging.mjs');
    out.exitCode = EXIT_NO_CREDENTIALS;
    out.verdict = { state: 'NOT_RUN', backstopWouldFire: null };
    // Through finish(), not `return out`. EVERY exit prints the ledger, including
    // the ones that never reached the network: "no requests were issued" is a
    // claim that needs a positive arm, and an empty ledger printed by the same
    // code that would have printed a full one is that arm.
    // See [[feedback_zero_request_assertion_needs_a_positive_arm]].
    return finish();
  }
  step('credentials supplied', true, `${CREDENTIAL_VARS.length + 1} values present (no value read into any output)`);

  // The calendar id is the same coercion resolveConfig applies. A set-but-junk
  // value is NaN there and refuses the read; the same value must not silently
  // become the string "NaN" in a query here.
  const calendarId = Number(calendarIdRaw);
  if (!calendarId) {
    step('CLIO_CALENDAR_ID is usable', false, 'set, but coerces to a falsy number — resolveConfig would refuse this too');
    blocker('CLIO_CALENDAR_ID does not coerce to a usable calendar id');
    out.exitCode = EXIT_NO_CREDENTIALS;
    out.verdict = { state: 'NOT_RUN', backstopWouldFire: null };
    return finish();
  }
  step('CLIO_CALENDAR_ID is usable', true, `calendar ${calendarId}`);

  // ── the transport, and the ledger it writes ────────────────────────────────
  let seq = 0;
  const send = async (method, url, init = {}) => {
    seq += 1;
    const { origin, pathname } = urlParts(url);
    const record = { seq, method, url: elidePageToken(url), origin, pathname, status: null, error: null };
    out.requests.push(record);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      // `redirect: 'error'` is NOT decoration, and it sits after the spread so no
      // caller can talk it down. The platform default is `follow`, and a followed
      // redirect is not the same risk on every request here:
      //
      //   GET  /api/v4/…  the fetch spec strips `Authorization` on a cross-origin
      //                   redirect, so the bearer token does not travel. Those
      //                   twelve reads were never the exposure.
      //   POST /oauth/token  a 307 or 308 RE-ISSUES the request to the redirect
      //                   target WITH ITS BODY, and that body is
      //                   client_id + client_secret + refresh_token as form
      //                   fields. Header stripping does nothing for a body. Those
      //                   three values re-provision the firm's Clio grant.
      //
      // And the ledger could not have shown it: `record` is written from the URL
      // this file CONSTRUCTED, never from the URL fetch finally contacted, so the
      // printed proof that nothing left app.clio.com would read clean while the
      // credentials were already gone. Verified against this runtime — a 307 with
      // `follow` delivers the form body to the target origin; with `error` fetch
      // throws before anything is sent, and an ordinary 200 mint is unaffected.
      const res = await fetchImpl(url, { ...init, method, redirect: 'error', signal: controller.signal });
      record.status = res.status;
      return res;
    } catch (err) {
      record.error = err?.name === 'AbortError' ? 'timeout' : 'transport';
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  const apiGet = (url, accessToken) => send('GET', url, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
  });

  // ── the one non-GET: mint an access token ─────────────────────────────────
  // A refresh. NOT a re-authorisation — see the header.
  const mintBody = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: String(env.CLIO_CLIENT_ID),
    client_secret: String(env.CLIO_CLIENT_SECRET),
    refresh_token: String(env.CLIO_REFRESH_TOKEN),
  });

  const mintRes = await send('POST', CLIO_TOKEN_URL, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: mintBody.toString(),
  });

  if (!mintRes) {
    step('access token minted', false, 'the token endpoint did not answer (timeout or transport)');
    blocker('MINT UNAVAILABLE — this says nothing about the grant, and nothing about paging');
    out.verdict = { state: 'MINT_UNAVAILABLE', backstopWouldFire: null };
    return finish();
  }
  if (!mintRes.ok) {
    // 400/401 on a refresh_token grant is the invalid-grant class and means the
    // stored refresh token is dead. Everything else is Clio, not the credential.
    const dead = mintRes.status === 400 || mintRes.status === 401;
    step('access token minted', false, `HTTP ${mintRes.status}`);
    blocker(dead
      ? 'DEAD GRANT — the stored refresh token is not accepted. Booking is already down; this is the finding, not a probe failure.'
      : `MINT UNAVAILABLE — HTTP ${mintRes.status} from the token endpoint says Clio is unwell, not that the grant is`);
    out.verdict = { state: dead ? 'DEAD_GRANT' : 'MINT_UNAVAILABLE', backstopWouldFire: null };
    return finish();
  }

  let mintJson;
  try { mintJson = await mintRes.json(); } catch (_) { mintJson = null; }
  const accessToken = mintJson?.access_token;
  if (!accessToken) {
    step('access token minted', false, 'the mint returned 200 with no access_token');
    blocker('MINT UNAVAILABLE — a 200 with no token is not a token');
    out.verdict = { state: 'MINT_UNAVAILABLE', backstopWouldFire: null };
    return finish();
  }
  redactor.add('CLIO_ACCESS_TOKEN', accessToken);
  step('access token minted', true, 'one POST to /oauth/token — value never read into any output');

  // Rotation check. A refresh is documented not to rotate; if this one did, the
  // operator's stored credential is now stale and production booking will fail on
  // its next refresh.
  const returnedRefresh = mintJson?.refresh_token;
  if (typeof returnedRefresh === 'string' && returnedRefresh && returnedRefresh !== String(env.CLIO_REFRESH_TOKEN)) {
    redactor.add('CLIO_ROTATED_REFRESH_TOKEN', returnedRefresh);
    const bar = '!'.repeat(72);
    emitErr(bar);
    emitErr('!! THE REFRESH TOKEN ROTATED. The value in the environment is now STALE.');
    emitErr('!! Production booking refreshes against the stored value and will fail.');
    emitErr('!! Store the new one from Clio before anything else. This run exits 3.');
    emitErr(bar);
    blocker('the refresh token rotated — the stored credential must be replaced');
    out.refreshRotated = true;
    out.exitCode = EXIT_ROTATED;
  } else {
    out.refreshRotated = false;
    step('the refresh token did not rotate', true, 'the stored credential is still the live one');
  }

  // ── the reads ──────────────────────────────────────────────────────────────
  const fromISO = isoAt(nowMs);
  const toISO   = isoAt(nowMs + days * 86_400_000);

  const entriesUrl = (limit, from, to) => `${CLIO_BASE}/calendar_entries?` + new URLSearchParams({
    calendar_id: String(calendarId),
    from, to,
    fields: ENTRY_FIELDS,
    limit: String(limit),
  });

  /** One read, reduced to the only three things that matter: count, meta, shape. */
  const readPage = async (label, url) => {
    const res = await apiGet(url, accessToken);
    if (!res) return { label, ok: false, why: 'no answer (timeout or transport)' };
    if (!res.ok) return { label, ok: false, why: `HTTP ${res.status}`, status: res.status };

    let body;
    try { body = await res.json(); } catch (_) {
      return { label, ok: false, why: 'the body did not parse as JSON' };
    }

    const hasDataArray = Array.isArray(body?.data);
    const count = hasDataArray ? body.data.length : null;

    // THE RECORDED ANSWER. `meta` verbatim, and the top-level key list, because
    // "which keys came back" is the question and reading only the one we hoped
    // for cannot answer it. `data` itself is never recorded — only its length.
    const meta = Object.prototype.hasOwnProperty.call(body ?? {}, 'meta') ? body.meta : undefined;

    return {
      label, ok: true,
      status: res.status,
      topLevelKeys: body && typeof body === 'object' ? Object.keys(body) : [],
      hasDataArray,
      count,
      metaPresent: meta !== undefined,
      metaVerbatim: meta,
      metaForDoc: meta === undefined ? undefined : elideDeep(meta),
      pagingPresent: !!(meta && typeof meta === 'object' && Object.prototype.hasOwnProperty.call(meta, 'paging')),
      next: meta?.paging?.next,
      cursor: classifyCursor(meta?.paging?.next),
      requestForDoc: elidePageToken(url),
    };
  };

  // P1 — MECHANISM. limit=1 makes any non-empty calendar produce a FULL page.
  const p1 = await readPage('P1 MECHANISM (limit=1)', entriesUrl(1, fromISO, toISO));
  out.observations.p1 = p1;
  if (!p1.ok) {
    step('P1 the grant can read calendar_entries', false, p1.why);
    blocker(p1.status === 403
      ? 'CALENDAR SCOPE LOST — the grant cannot read calendar_entries. STOP: this is the order\'s stop condition, and it outranks every paging question.'
      : `the calendar read did not answer (${p1.why}) — no paging conclusion is available`);
    out.verdict = { state: p1.status === 403 ? 'CALENDAR_SCOPE_LOST' : 'READ_UNAVAILABLE', backstopWouldFire: null };
    return finish();
  }
  step('P1 the grant can read calendar_entries', true, `HTTP 200, ${p1.count} row(s), keys ${JSON.stringify(p1.topLevelKeys)}`);
  step('P1 the response carries meta', p1.metaPresent,
    p1.metaPresent ? `meta.paging present: ${p1.pagingPresent}` : 'no `meta` key at the top level');
  if (p1.count === 0) {
    out.notes.push('P1 returned zero rows, so the full-page arm of the mechanism test did not run — the window is empty.');
    emit('NOTE  P1 came back empty; a one-row limit could not produce a full page. Not a failure, but not the decisive reading either.');
  } else {
    step('P1 a FULL page carried a next cursor', p1.cursor.kind === 'ABSOLUTE_URL' || p1.cursor.kind === 'RELATIVE_PATH' || p1.cursor.kind === 'OPAQUE_TOKEN',
      `1 of 1 rows returned; cursor = ${p1.cursor.kind} (${p1.cursor.detail})`);
  }

  // P2 — the exact first request sheldon/booking-safety issues.
  const p2 = await readPage('P2 PRODUCTION (limit=200)', entriesUrl(CALENDAR_PAGE_LIMIT, fromISO, toISO));
  out.observations.p2 = p2;
  if (!p2.ok) {
    step('P2 the production-shaped read answered', false, p2.why);
    blocker(`the limit=${CALENDAR_PAGE_LIMIT} read did not answer (${p2.why}) — Task 4 cannot be settled`);
    out.verdict = { state: 'READ_UNAVAILABLE', backstopWouldFire: null };
    return finish();
  }
  step('P2 the production-shaped read answered', true,
    `HTTP 200, ${p2.count} of a ${CALENDAR_PAGE_LIMIT} limit, keys ${JSON.stringify(p2.topLevelKeys)}`);

  // P3 — the walk. The branch's loop, over real pages.
  const walkPages = [{ count: p2.count, next: p2.next, meta: p2.metaForDoc, cursor: p2.cursor }];
  let cursorUrl = typeof p2.next === 'string' && p2.next !== '' ? p2.next : null;
  let walkAborted = null;

  while (cursorUrl && walkPages.length < CALENDAR_MAX_PAGES) {
    // NEVER follow a cursor off Clio. An absolute URL is followed whole, which is
    // exactly what makes the host it names load-bearing.
    if (!isClioApiUrl(cursorUrl)) {
      walkAborted = `the cursor pointed outside ${CLIO_BASE} — refused rather than followed`;
      blocker(`meta.paging.next named a host this probe will not follow: ${urlParts(cursorUrl).origin || '(unparseable)'}`);
      break;
    }
    const pn = await readPage(`P3 WALK page ${walkPages.length + 1}`, cursorUrl);
    out.observations[`p3_page${walkPages.length + 1}`] = pn;
    if (!pn.ok) { walkAborted = `page ${walkPages.length + 1} did not answer: ${pn.why}`; break; }
    walkPages.push({ count: pn.count, next: pn.next, meta: pn.metaForDoc, cursor: pn.cursor });
    cursorUrl = typeof pn.next === 'string' && pn.next !== '' ? pn.next : null;
  }
  out.observations.walk = {
    pages: walkPages.map((p, i) => ({ page: i + 1, count: p.count, cursorKind: p.cursor.kind })),
    totalEntries: walkPages.reduce((n, p) => n + (p.count ?? 0), 0),
    aborted: walkAborted,
  };
  step('P3 the walk completed', walkAborted === null,
    walkAborted ?? `${walkPages.length} page(s), ${out.observations.walk.totalEntries} entries`);

  // The terminal page IS the answer to Task 3.
  const terminal = walkPages[walkPages.length - 1];
  out.observations.terminalPage = {
    count: terminal.count,
    underLimit: terminal.count < CALENDAR_PAGE_LIMIT,
    metaForDoc: terminal.meta,
    cursorKind: terminal.cursor.kind,
  };

  // P4 — a window that holds nothing. The zero-row envelope.
  const emptyFrom = '2001-01-01T00:00:00Z';
  const emptyTo   = '2001-01-02T00:00:00Z';
  const p4 = await readPage('P4 EMPTY (limit=200, a window in 2001)', entriesUrl(CALENDAR_PAGE_LIMIT, emptyFrom, emptyTo));
  out.observations.p4 = p4;
  if (p4.ok) {
    step('P4 the empty-window read answered', true,
      `HTTP 200, ${p4.count} row(s), keys ${JSON.stringify(p4.topLevelKeys)}, meta present: ${p4.metaPresent}`);
    if (p4.count !== 0) {
      out.notes.push('P4 was expected to be empty and was not — the 2001 window holds rows. The zero-row shape was NOT observed.');
    }
  } else {
    step('P4 the empty-window read answered', false, p4.why);
    out.notes.push('P4 did not answer; the zero-row envelope was not observed.');
  }

  // ── the verdict (Task 4) ──────────────────────────────────────────────────
  const replay = replayBackstop(walkPages);
  const cursorEverSeen = [p1, p2, ...walkPages.map((p) => ({ cursor: p.cursor }))]
    .some((p) => p.cursor && ['ABSOLUTE_URL', 'RELATIVE_PATH', 'OPAQUE_TOKEN'].includes(p.cursor.kind));

  out.verdict = {
    state: walkAborted ? 'INCONCLUSIVE' : (replay.inconclusive ? 'INCONCLUSIVE' : 'SETTLED'),
    backstopWouldFire: walkAborted || replay.inconclusive ? null : replay.fires,
    reason: walkAborted ?? replay.reason,
    entriesInWindow: replay.entries,
    pagesWalked: replay.pagesWalked,
    headroom: CALENDAR_PAGE_LIMIT - (walkPages[0]?.count ?? 0),
    cursorObserved: cursorEverSeen,
    cursorClass: p2.cursor.kind,
    cursorHost: p2.cursor.host ?? null,
  };

  emit('');
  emit('── verdict ───────────────────────────────────────────────────────────');
  emit(`meta present on GET /calendar_entries : ${p2.metaPresent}`);
  emit(`meta.paging.next class                : ${p2.cursor.kind}${p2.cursor.host ? ` @ ${p2.cursor.host}` : ''}`);
  emit(`entries in the ${days}-day window          : ${replay.entries} (first page ${walkPages[0]?.count} of ${CALENDAR_PAGE_LIMIT})`);
  emit(`terminal page                         : ${terminal.count} rows, cursor ${terminal.cursor.kind}`);
  emit(`BACKSTOP WOULD FIRE TODAY             : ${out.verdict.backstopWouldFire === null ? 'INCONCLUSIVE' : (out.verdict.backstopWouldFire ? 'YES' : 'NO')}`);
  emit(`  ${out.verdict.reason}`);
  if (out.verdict.backstopWouldFire === false) {
    emit(`  headroom: ${out.verdict.headroom} more entries in this window before the first page comes back full.`);
  }

  return finish();

  // ── the ledger, the redaction report, the evidence file ───────────────────
  function finish() {
    const nonGet   = out.requests.filter((r) => r.method !== 'GET');
    const oauth    = out.requests.filter((r) => isClioOauthUrl(r.url));
    const offClio  = out.requests.filter((r) => !isClioApiUrl(r.url) && !isClioOauthUrl(r.url));

    out.requestLedger = {
      total: out.requests.length,
      methods: out.requests.map((r) => r.method),
      origins: [...new Set(out.requests.map((r) => r.origin))],
      nonGet: nonGet.map((r) => `${r.method} ${r.origin}${r.pathname}`),
      oauthCalls: oauth.length,
      offClioCalls: offClio.map((r) => `${r.method} ${r.url}`),
    };

    emit('');
    emit('── request ledger ────────────────────────────────────────────────────');
    for (const r of out.requests) {
      const status = r.error ? r.error.toUpperCase() : (r.status === null ? '—' : String(r.status));
      emit(`  ${String(r.seq).padStart(2)}  ${r.method.padEnd(4)} ${status.padEnd(10)} ${r.origin || '(unparseable)'}${r.pathname}`);
    }
    emit(`  methods: ${JSON.stringify(out.requestLedger.methods)}`);
    emit(`  origins: ${JSON.stringify(out.requestLedger.origins)}`);

    // THE READ-ONLY ASSERTION. Stated by the run itself, so a live transcript
    // carries its own proof and a reader is not asked to trust the header.
    const readOnly = nonGet.length <= 1
                  && nonGet.every((r) => `${r.origin}${r.pathname}` === new URL(CLIO_TOKEN_URL).origin + new URL(CLIO_TOKEN_URL).pathname)
                  && oauth.length === nonGet.length
                  && offClio.length === 0;
    step('READ ONLY — every /api/v4 request is a GET, the only non-GET is the token mint, and nothing left app.clio.com', readOnly);
    if (!readOnly) {
      emit(`      ${JSON.stringify({ nonGet: out.requestLedger.nonGet, offClio: out.requestLedger.offClioCalls })}`);
      blocker('the run issued a request outside the read-only contract');
      out.exitCode = EXIT_NOT_READ_ONLY;
    }

    out.redaction = { backstopHits: redactor.hits, firedFor: redactor.fired, unscrubbable: redactor.unscrubbable };
    if (redactor.hits > 0) {
      const bar = '!'.repeat(72);
      emitErr(bar);
      emitErr(`!! REDACTION BACKSTOP FIRED ${redactor.hits}x for: ${redactor.fired.join(', ')}`);
      emitErr('!! A line was CONSTRUCTED containing a credential. It was replaced before');
      emitErr('!! it reached the stream, but this file is built from placeholders and');
      emitErr('!! should never build such a line — the scrub is evidence of a DEFECT.');
      emitErr('!! Treat every emitted line and the evidence file as suspect.');
      emitErr(bar);
      blocker(`the redaction backstop fired for: ${redactor.fired.join(', ')}`);
      out.exitCode = EXIT_BACKSTOP_HIT;
    }
    if (redactor.unscrubbable.length) {
      emit(`NOTE  the backstop is OFF for ${redactor.unscrubbable.join(', ')} — value shorter than ${MIN_REDACTABLE_LEN} chars.`);
    }

    out.finishedAt = isoAt(Date.now());
    return out;
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
//
// Extracted from the `if (direct invocation)` block below and exported, because
// an inline CLI is an untested CLI, and the flag handling is the part of this
// file that touches the operator's disk.

/**
 * `--name=value`, last occurrence wins.
 *
 * `--name` with no `=` is NOT this flag: it is returned as `undefined` (the
 * fallback) rather than as an empty string, so `--evidence` on its own falls
 * back to the default path instead of resolving to `''`. `--name=` with an
 * explicit empty value IS a value, and is refused downstream by name.
 */
export function parseCliArgs(argv = []) {
  const arg = (name) => {
    const prefix = `--${name}=`;
    let found;
    for (const a of argv) if (a.startsWith(prefix)) found = a.slice(prefix.length);
    return found;
  };

  const daysRaw = arg('days');
  const days = Number(daysRaw ?? DEFAULT_DAYS);

  return {
    daysRaw,
    // The same clamp the route applies: availability.js parseDays caps at 60.
    days: Number.isFinite(days) && days > 0 && days <= 60 ? days : DEFAULT_DAYS,
    daysAccepted: daysRaw === undefined || (Number.isFinite(days) && days > 0 && days <= 60),
    evidenceRaw: arg('evidence'),
  };
}

// The evidence file is only safe to write because git refuses to track it. That
// refusal is one line in .gitignore:
//
//     test/preview/clio-paging-evidence*.json
//
// `--evidence=<path>` was an unbounded write primitive pointed at whatever the
// operator typed, running in the one shell session that has the live Clio
// credentials exported. `--evidence=.dev.vars` would have overwritten the local
// credential file with the probe's output; `--evidence=donovan-legal-site/index.html`
// would have overwritten a page of the live site. Neither is a hypothetical
// misuse — both are a single tab-completion away.
//
// So the flag is now bounded to the exact set of paths that .gitignore line
// covers, and anything else is refused BY NAME before a byte is written.
export const EVIDENCE_DIR_SEGMENTS = ['test', 'preview'];
export const EVIDENCE_BASENAME_GLOB = 'clio-paging-evidence*.json';
export const DEFAULT_EVIDENCE_BASENAME = 'clio-paging-evidence.json';

// The glob, as a regex. Case SENSITIVE on purpose. git's own matching is
// case-insensitive when core.ignorecase is true (the Windows default), so this
// is the stricter of the two — and strict is the safe direction here. Refusing
// a name git would have ignored costs the operator a retype; accepting one git
// would TRACK puts a verbatim live capture into a commit.
const EVIDENCE_BASENAME_RE = /^clio-paging-evidence[^\\/]*\.json$/;

export const EVIDENCE_REFUSALS = {
  EMPTY:              'the --evidence value is empty',
  NOT_IN_PREVIEW_DIR: `the path does not resolve directly inside ${EVIDENCE_DIR_SEGMENTS.join('/')}/`,
  NOT_IGNORED_NAME:   `the filename does not match the gitignored ${EVIDENCE_BASENAME_GLOB}`,
  PROBE_DIR_MOVED:    `the probe is no longer in ${EVIDENCE_DIR_SEGMENTS.join('/')}/, so the .gitignore rule no longer covers it`,
  SYMLINK:            'the target is a symbolic link — writeFileSync follows one, so the name checked is not the file written',
};

/**
 * Decide where the evidence file may be written, or refuse with a NAMED reason.
 *
 * Three conditions, all of which must hold:
 *
 *   1. the probe itself still lives in test/preview — otherwise the anchored
 *      .gitignore rule does not cover this directory at all and the whole
 *      argument for writing a live capture to disk has quietly expired;
 *   2. the resolved path is a file sitting DIRECTLY in that directory — not a
 *      subdirectory, not `..` back out of it, not another drive;
 *   3. its basename matches the gitignored glob.
 *
 * A relative `--evidence=` resolves against the working directory, which is what
 * a shell user means by a relative path. `--evidence=test/preview/clio-paging-evidence-r2.json`
 * from the repo root is the intended spelling and is accepted.
 *
 * @returns {{ok:true, path:string}|{ok:false, reason:string, detail:string, resolved:string}}
 */
export function resolveEvidencePath(raw, {
  moduleDir = path.dirname(fileURLToPath(import.meta.url)),
  cwd = process.cwd(),
} = {}) {
  const dirTail = moduleDir.split(/[\\/]/).slice(-EVIDENCE_DIR_SEGMENTS.length).map((s) => s.toLowerCase());
  if (dirTail.join('/') !== EVIDENCE_DIR_SEGMENTS.join('/')) {
    return { ok: false, reason: 'PROBE_DIR_MOVED', detail: EVIDENCE_REFUSALS.PROBE_DIR_MOVED, resolved: moduleDir };
  }

  if (raw === undefined) return { ok: true, path: path.join(moduleDir, DEFAULT_EVIDENCE_BASENAME) };

  const wanted = String(raw).trim();
  if (!wanted) return { ok: false, reason: 'EMPTY', detail: EVIDENCE_REFUSALS.EMPTY, resolved: '' };

  const resolved = path.resolve(cwd, wanted);

  // `path.relative` is the containment test, not a string prefix compare: it
  // collapses `..`, is case-folding on win32, and answers with an absolute path
  // when the target is on another drive. A single path segment — no separator,
  // not empty, not starting with `..` — is the only accepted answer.
  const rel = path.relative(moduleDir, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || rel.split(/[\\/]/).length !== 1) {
    return { ok: false, reason: 'NOT_IN_PREVIEW_DIR', detail: EVIDENCE_REFUSALS.NOT_IN_PREVIEW_DIR, resolved };
  }

  if (!EVIDENCE_BASENAME_RE.test(rel)) {
    return { ok: false, reason: 'NOT_IGNORED_NAME', detail: EVIDENCE_REFUSALS.NOT_IGNORED_NAME, resolved };
  }

  // Every check above is on the NAME. `writeFileSync` follows a symbolic link,
  // so a link at an allowed name pointing at .dev.vars would satisfy all of them
  // and still overwrite the credential file — the name checked would not be the
  // file written. `lstat` does not follow, which is the point of using it.
  // Missing is fine and is the ordinary case; anything else is refused.
  try {
    if (lstatSync(resolved).isSymbolicLink()) {
      return { ok: false, reason: 'SYMLINK', detail: EVIDENCE_REFUSALS.SYMLINK, resolved };
    }
  } catch (_) { /* ENOENT — the file does not exist yet, which is expected */ }

  return { ok: true, path: resolved };
}

/**
 * Is this module being run as a script, rather than imported by the controls?
 *
 * Exported so the guard is a tested expression instead of a condition that only
 * ever evaluates in production. It is what keeps `import`ing this file from the
 * control suite launching a live run against app.clio.com.
 */
export function isDirectInvocation(argv1, moduleUrl = import.meta.url) {
  if (!argv1) return false;
  try { return path.resolve(fileURLToPath(moduleUrl)) === path.resolve(argv1); } catch (_) { return false; }
}

export const EXIT_BAD_EVIDENCE_PATH = 6;

if (isDirectInvocation(process.argv[1])) {
  const cli = parseCliArgs(process.argv.slice(2));

  // Refused BEFORE the network, not after. A run that has already minted a token
  // and read the firm's calendar and only then discovers it has nowhere legal to
  // put the answer has spent the credential for nothing.
  const evidence = resolveEvidencePath(cli.evidenceRaw);
  if (!evidence.ok) {
    console.error(`REFUSED  --evidence=${cli.evidenceRaw} — ${evidence.detail}`);
    console.error(`         resolved to: ${evidence.resolved}`);
    console.error(`         allowed:     ${EVIDENCE_DIR_SEGMENTS.join('/')}/${EVIDENCE_BASENAME_GLOB} (the gitignored set)`);
    console.error('         nothing was sent, and nothing was written.');
    process.exit(EXIT_BAD_EVIDENCE_PATH);
  }

  if (!cli.daysAccepted) {
    console.error(`NOTE  --days=${cli.daysRaw} is not a usable window; falling back to ${DEFAULT_DAYS}.`);
  }

  const out = await runPagingProbe({ env: process.env, days: cli.days });

  // The evidence file carries metaVerbatim and is GITIGNORED for that reason.
  // Everything in it still passes the redactor: verbatim means verbatim about
  // CLIO's response, never about our credentials.
  const redactor = makeRedactor(process.env);
  try {
    writeFileSync(evidence.path, redactor.scrub(JSON.stringify(out, null, 2)) + '\n', 'utf8');
    console.log(`\nevidence: ${evidence.path}  (gitignored — holds a verbatim live capture)`);
  } catch (err) {
    console.error(`\ncould not write the evidence file: ${err?.message ?? err}`);
  }

  process.exit(out.exitCode);
}
