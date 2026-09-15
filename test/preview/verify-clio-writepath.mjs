// ── SHELDON-CLIO-WRITEPATH-VERIFY — did the booking actually WRITE? ──────────
//
//   CLIO_CLIENT_ID=… CLIO_CLIENT_SECRET=… CLIO_REFRESH_TOKEN=… \
//     node test/preview/verify-clio-writepath.mjs \
//       --contact=<contact id> [--entry=<calendar entry id>] [--evidence=<path>]
//
// THE ONE TO RUN — the 2026-08-04 booking, which is the subject of issue 153:
//
//   node test/preview/verify-clio-writepath.mjs --contact=2413234643 --entry=4981729058
//
// USE THOSE IDS AND NOT ANY OTHERS OFF AN OLDER RUNBOOK. The retired test client's
// id differs from the live contact's in the middle digits only, and the two are
// close enough to typo into each other. Pointing this run at the wrong contact does
// not write anything — nothing here can — but it reports the wrong client's intake
// answers, including their income and net-worth bands, into a printed transcript and
// an evidence file. Check the id against the Clio URL before running it.
//
// Read the verdict block it prints. Exit 0 means the INSTRUMENT was sound, not
// that the booking was — "the contact carries nothing" is a RESULT and exits 0.
// The non-zero codes are listed at EXIT_* below and each names one specific way
// this run, or the thing it found, is not the ordinary case.
//
// ── THE QUESTION, AND WHY IT IS OPEN ─────────────────────────────────────────
// Issue 153 is the acceptance test for "Clio integration is 100% correct". The
// custom-fields scope was reconnected and the grant verified from 403 to 200 on
// /custom_fields: all twelve Intake fields resolve and the seven this code writes
// are all `text_line`, matching the type-admission test in clio-custom-fields.js.
//
// THAT PROVES THE GRANT CAN READ. It does not prove a live booking WROTE.
// Nothing has yet looked at a post-reconnect contact and confirmed the seven
// Intake values are on it. This file is that look, and it is the automatable half
// of the issue: everything here is a GET. The half it cannot close is the client's
// inbox — whether the confirmation email arrived, and what it looked like — which
// needs a human with the mailbox open.
//
// ── NOTHING IS WRITTEN. AT ALL. ──────────────────────────────────────────────
// Every Clio call this file makes is a GET, with exactly one exception, and the
// run prints a request ledger on EVERY exit path so a reader does not have to
// take that sentence on trust. The exception is the token mint:
//
//   POST https://app.clio.com/oauth/token   grant_type=refresh_token
//
// which is a POST by transport and a mint by effect. It is NOT a
// re-authorisation: a re-authorisation issues a NEW refresh token and kills the
// live one, which takes production booking down until the grant is re-provisioned
// (issue 153, Constraints). A plain refresh does not rotate — but this run checks
// rather than assumes, and says so loudly and exits EXIT_ROTATED if it did,
// because at that point the operator's stored credential is stale and booking is
// on borrowed time.
//
// No contact, calendar entry, note or custom field is created, modified or
// deleted. There is no POST, PATCH or DELETE to /api/v4/ anywhere in this file.
// An "error path" probe in this tree has already booked a real appointment on
// Paul's calendar once ([[feedback_negative_path_probe_can_write]]) — a probe near
// the booking integration gets exactly one benefit of the doubt, and this one
// spends it on being unable to write rather than on being careful.
//
// CLIO_INTAKE_FIELD_IDS IS NOT READ HERE, AND THAT IS DELIBERATE. Seeded ids are
// the operator's override on the field_type admission test (clio-custom-fields.js
// seedFromEnv: "the listing rules do not second-guess it"). Pinning them would
// skip precisely the check this run exists to exercise, so resolution here is the
// name lookup and only the name lookup — the same GET /custom_fields walk, with
// the same per-field type expectation, that a live booking performs.
//
// ── NO SECRET IS PRINTED, AND NO EVIDENCE FILE CARRIES ONE ───────────────────
// Every line and the evidence file pass through a redactor holding the three
// credentials and the minted access token. The redactor FIRING is a DEFECT, not a
// save: this file is built from placeholders and should never construct such a
// line, so a hit is reported as a blocker with its own exit code.
//
// ── BUT THE OUTPUT DOES CARRY CLIENT DATA, ON PURPOSE ────────────────────────
// Task 1 is "report what value each field holds", so the seven intake answers —
// including income_band and net_worth_band, which are the client's finances — are
// printed and recorded. That is the deliverable, not an accident. Consequences:
//
//   · the evidence file is GITIGNORED (.gitignore, `test/preview/clio-writepath-evidence*.json`)
//     and `--evidence=` is bounded to exactly that set of paths;
//   · the run prints a HANDLING banner before the first value;
//   · a transcript of a live run does not belong in a pull request. The PR for
//     this order carries the OFFLINE control-suite results instead.
//
// TWO THINGS ARE NEVER RECORDED AND NEVER PRINTED, at any verbosity:
//
//   · the calendar entry's `location`. In dynamic mode Clio fills it with a
//     video_conferences wrapper URL carrying a per-meeting token. A join URL is a
//     BEARER CAPABILITY — anyone holding it is in the client's consultation.
//     Only its presence, host and length are reported.
//   · conference_meeting.join_url, for the same reason.
//
// They are still READ, into locals, because Task 3 has to search them. Searching a
// string is not disclosing it, and the leak report names the field that was found,
// not the surface it was found in.
//
// ── WHAT IT REPORTS ──────────────────────────────────────────────────────────
//   T1  CONTACT     for each of the seven Intake fields: is it populated on the
//                   given contact, and what value does it hold. Resolution is the
//                   live name lookup, so a name missing from the account and a
//                   name present but unset are DIFFERENT answers and are told
//                   apart.
//   T2  ENTRY       for the given calendar entry: is an attendee attached, and did
//                   Clio mint a meeting. `contact_id` is silently discarded by Clio
//                   as an unrecognised key — no error, no attendee, no email — which
//                   was the original root cause of confirmations never sending, so
//                   "an attendee is attached" is the observable that stands in for
//                   "Clio sent the email". THE MEETING SIGNAL IS
//                   `conference_meeting.join_url`, NOT `location`: Clio leaves
//                   `location` empty for a conference meeting and signs a
//                   per-recipient join URL at send time, so an empty location on a
//                   working booking is the expected shape and asserting it was a
//                   permanent false negative. Location is reported as information.
//   T3  LEAK        do the entry's description, summary or location contain any of
//                   the seven intake values. Clio renders the description verbatim
//                   into the attendee's confirmation email and .ics, so a band
//                   appearing there is the leak the description split exists to
//                   prevent.
//   T4  SHA         sha256 of buildClientDescription against the pinned value.
//                   The structural guard: that function has no parameter through
//                   which a band could arrive, and the sha is how "still has none"
//                   is checked without re-reading it.
//
// T3 and T4 answer the same question from two directions and neither replaces the
// other. T4 says the leak CANNOT happen by construction; T3 says it DID NOT happen
// on this entry. A T4 pass with a T3 hit would mean the value arrived by some path
// other than the description builder, which is a finding T4 alone cannot produce.
//
// ── VACUOUS IS NOT PASS ──────────────────────────────────────────────────────
// The three ways this run could look clean while having checked nothing are named
// and reported as such rather than folded into a pass:
//
//   · no contact id supplied      ⇒ T1 NOT_RUN, and T3 has no values to search for
//   · no entry id supplied        ⇒ T2/T3 NOT_RUN
//   · all seven values empty      ⇒ T3 VACUOUS. Searching for nothing finds
//                                   nothing. See
//                                   [[feedback_idle_with_zero_tasks_is_a_vacuous_pass]].
//   · nothing could be attributed ⇒ T1 INSTRUMENT_FAILED and exit
//                                   EXIT_NO_ATTRIBUTION. The contact read fine and
//                                   the run still cannot say anything about any
//                                   field. This is the R1 defect: it reported seven
//                                   UNDETERMINED — seven per-field judgements — for
//                                   a contact whose twelve rows it simply could not
//                                   read. A broken instrument is one finding about
//                                   the run, not seven about the client.
//
// A contact with no intake fields is therefore a COMPLETE and unambiguous report
// (seven NOT_POPULATED rows, each with its own reason) whose leak section says
// VACUOUS — not PASS.

import { writeFileSync, lstatSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { INTAKE_CUSTOM_FIELDS } from '../../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';

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

// The bounds clio-custom-fields.js walks /custom_fields with. Mirrored rather than
// imported because they are module-private there; a control asserts the mirror.
export const FIELD_PAGE_LIMIT = 200;
export const FIELD_MAX_PAGES  = 10;

const CREDENTIAL_VARS = ['CLIO_CLIENT_ID', 'CLIO_CLIENT_SECRET', 'CLIO_REFRESH_TOKEN'];

// Shorter than this and a "secret" appears inside ordinary words; a redactor that
// replaced it would corrupt every line it touched while proving nothing. Reported
// as unscrubbable instead of silently trusted.
const MIN_REDACTABLE_LEN = 8;

const REQUEST_TIMEOUT_MS = 20_000;

// ── The pinned structural guard (Task 4) ─────────────────────────────────────
//
// Issue 153: "buildClientDescription sha256 must remain … — it is the structural
// leak guard." The value is the issue's, reproduced here so the check runs without
// a network and without the issue open.
export const EXPECTED_DESCRIPTION_SHA =
  'de5fcb4fff0ce318d15f50f6685acd7cbffb0db2ec3b5b30f28bb995433aef0b';

export const PROVIDER_REL_PATH = '../../donovan-legal-site/functions/booking/_lib/provider-clio.js';
export const DESCRIPTION_FN_NAME = 'buildClientDescription';

// The seven, as issue 153 names them. INTAKE_CUSTOM_FIELDS is IMPORTED from the
// shipping module so this run reports on the list the code actually uses — and is
// then checked against this frozen expectation, so a list that drifts reds loudly
// instead of silently changing what "all seven are populated" means.
export const EXPECTED_FIELD_KEYS = [
  'matter_category', 'matter_sub', 'for_whom',
  'income_band', 'net_worth_band', 'language', 'source',
];
export const EXPECTED_FIELD_TYPE = 'text_line';

// The two the issue calls out by name. A band on a client-facing surface is the
// leak the description split exists to prevent; the other five are reportable but
// are not, on their own, the finance disclosure.
export const BAND_KEYS = ['income_band', 'net_worth_band'];

// ── The contact `fields=` ladder ─────────────────────────────────────────────
//
// ORDERED BY WHETHER A RUNG CAN ATTRIBUTE, NOT BY HOW MUCH IT ASKS FOR. R1 ordered
// it by richness, took a 400 on the top rung, and landed on
// `id,name,custom_field_values` — whose rows carry neither `custom_field.id` nor
// `field_name`. Twelve rows came back off a contact that had been read successfully
// and not one could be tied to a field, so the run reported seven UNDETERMINED for a
// contact it had in its hands. A rung that cannot attribute cannot answer T1 AT ALL,
// which makes richness the wrong sort key.
//
// What Clio actually accepts, established by direct probe against the live grant on
// 2026-08-04 — not from the documentation, which is what produced the 400:
//
//   id,custom_field_values{id,value,field_name,field_type}   200 · attributes · and the type
//   id,custom_field_values{id,value,field_name}              200 · attributes · twelve named rows
//   id,custom_field_values{id,value,custom_field}            200 · ATTRIBUTES NOTHING — the
//                                                            wrapper comes back with no usable id
//   id,custom_field_values{id,value,custom_field{ id }}      400 (spaced here so the
//                                                            string below is not in the source)
//
// CLIO REJECTS SECOND-LEVEL NESTING WITH A 400. Not a permissions problem and not
// intermittent: the selector grammar does not go two levels deep, so that arm can
// NEVER succeed and it is gone. DO NOT RE-ADD IT — a control asserts that no
// executable line spells `custom_field` immediately followed by `{`, and a second
// control asserts no request URL carries it. `custom_field.id` therefore cannot be
// obtained from a contact read at all, which is why BY_NAME is the route a live run
// takes; attributeRow still prefers BY_ID because a row carrying one is better
// evidence, not because Clio will ever hand one over.
//
// `name` is not requested. Nothing in this report uses the contact's name, and not
// asking keeps one more piece of the client out of the evidence file.
//
// The two non-attributing rungs are KEPT, and kept last, because "this contact has
// twelve custom-field rows on it" is worth knowing even when none can be tied to a
// field. But a verdict about a FIELD is never taken from one: if no attributing rung
// answers, T1 reports an INSTRUMENT failure. WHICH SELECTION ANSWERED IS PART OF THE
// REPORT.
export const CONTACT_FIELD_ATTEMPTS = [
  { fields: 'id,custom_field_values{id,value,field_name,field_type}', attributes: true },
  { fields: 'id,custom_field_values{id,value,field_name}',            attributes: true },
  { fields: 'id,custom_field_values{id,value,custom_field}',          attributes: false },
  { fields: 'id,custom_field_values',                                 attributes: false },
];

// ── Exit codes ───────────────────────────────────────────────────────────────
//
// A run can discover several of these, and the ORDER OF DISCOVERY MUST NOT DECIDE
// WHICH ONE IT REPORTS — the ledger check runs last and would otherwise overwrite
// a leak found in the middle. `raise()` keeps the most severe by the rank table
// below, so the exit code is a property of what was found, not of when.
// See [[feedback_assertion_order_decides_which_failure_the_mutation_names]].
export const EXIT_OK               = 0;
export const EXIT_NO_CREDENTIALS   = 2;
export const EXIT_ROTATED          = 3;
export const EXIT_BACKSTOP_HIT     = 4;   // the redaction backstop
export const EXIT_NOT_READ_ONLY    = 5;
export const EXIT_BAD_EVIDENCE_PATH = 6;
export const EXIT_SHA_MISMATCH     = 7;
export const EXIT_BAD_ARGS         = 8;
export const EXIT_LEAK             = 9;
export const EXIT_SCOPE_LOST       = 10;
export const EXIT_FIELD_SET_DRIFT  = 11;
export const EXIT_NO_ATTRIBUTION   = 12;

/**
 * Most severe first. The reasoning, because the order is a judgement and a reader
 * is entitled to disagree with it in writing rather than by guessing:
 *
 *   BACKSTOP_HIT   our own output may carry a credential. Nothing else in the
 *                  report can be acted on until that is resolved.
 *   ROTATED        this run replaced the live refresh token. Production booking
 *                  breaks on its next refresh. Time-critical.
 *   NOT_READ_ONLY  this run went outside its contract. What it did is now the
 *                  question, not what it found.
 *   LEAK           the client's finances reached a surface Clio emails them.
 *   SHA_MISMATCH   the structural guard moved. A leak may be possible again.
 *   FIELD_SET_DRIFT the seven are no longer the seven; the report is about a
 *                  different question than the one asked.
 *   SCOPE_LOST     the grant cannot read. The order's STOP condition.
 *   NO_ATTRIBUTION the grant read fine and T1 still has no answer: nothing this run
 *                  could obtain ties a value row to a field. Below SCOPE_LOST
 *                  because a refused grant is the larger fact, above the
 *                  never-started codes because this run DID spend the credential and
 *                  came back with an unanswerable question.
 *   NO_CREDENTIALS / BAD_ARGS  the run never started.
 */
export const EXIT_RANK = [
  EXIT_BACKSTOP_HIT,
  EXIT_ROTATED,
  EXIT_NOT_READ_ONLY,
  EXIT_LEAK,
  EXIT_SHA_MISMATCH,
  EXIT_FIELD_SET_DRIFT,
  EXIT_SCOPE_LOST,
  EXIT_NO_ATTRIBUTION,
  EXIT_NO_CREDENTIALS,
  EXIT_BAD_ARGS,
  EXIT_OK,
];

/** The more severe of two exit codes, by EXIT_RANK. Unknown codes rank first. */
export function moreSevere(a, b) {
  const rank = (c) => {
    const i = EXIT_RANK.indexOf(c);
    return i === -1 ? -1 : i;
  };
  return rank(a) <= rank(b) ? a : b;
}

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

// ── Ids ──────────────────────────────────────────────────────────────────────

/**
 * A Clio resource id, or a NAMED refusal.
 *
 * Refused before the network, not interpolated hopefully. Clio ids are positive
 * integers; anything else in a path segment is either a 404 that reads like a
 * missing record or, worse, a path that is not the one this file meant to request.
 * `Number` alone is not enough — it accepts "12e3", " 12 " and "0x1f", none of
 * which are what the operator typed off a Clio URL.
 */
export function parseResourceId(raw) {
  if (raw === undefined || raw === null) return { ok: false, reason: 'ABSENT' };
  const s = String(raw).trim();
  if (!s) return { ok: false, reason: 'EMPTY' };
  if (!/^[0-9]+$/.test(s)) return { ok: false, reason: 'NOT_DIGITS' };
  const n = Number(s);
  if (!Number.isSafeInteger(n) || n <= 0) return { ok: false, reason: 'OUT_OF_RANGE' };
  return { ok: true, id: n, text: String(n) };
}

// ── Task 4: the structural guard ─────────────────────────────────────────────

/**
 * Cut `export function <name>(…) { … }` out of a source file, verbatim.
 *
 * LINE ENDINGS ARE NORMALISED TO LF FIRST, and that is the whole reason this is a
 * function rather than two lines inline. `git show` hands out LF; a Windows
 * checkout with core.autocrlf writes CRLF into the working tree; the file on disk
 * therefore hashes differently from the file in the commit, and the pinned sha
 * would be unreachable on exactly one of the two — silently, and only on one
 * developer's machine. See [[feedback_git_show_lf_vs_worktree_crlf]].
 *
 * The end is the first line that is exactly `}` at column zero. That works because
 * this file is written that way throughout and is checked, not assumed: the
 * extracted text is compared against the LIVE function's own `toString()` in
 * hashDescriptionFn below, so an extraction that grabbed the wrong span, a stale
 * copy, or a commented-out twin cannot silently produce a hash.
 *
 * @returns {{ok:true, text:string, startLine:number, endLine:number}|{ok:false, reason:string}}
 */
export function extractExportedFunction(source, name) {
  const lf = String(source).replace(/\r\n/g, '\n');
  const lines = lf.split('\n');
  const head = `export function ${name}(`;

  const start = lines.findIndex((l) => l.startsWith(head));
  if (start === -1) return { ok: false, reason: `no line begins \`${head}\`` };
  if (lines.findIndex((l, i) => i > start && l.startsWith(head)) !== -1) {
    return { ok: false, reason: `more than one line begins \`${head}\`` };
  }

  let end = -1;
  for (let i = start + 1; i < lines.length; i += 1) {
    if (lines[i] === '}') { end = i; break; }
  }
  if (end === -1) return { ok: false, reason: 'no closing `}` at column zero after the declaration' };

  return {
    ok: true,
    text: lines.slice(start, end + 1).join('\n').trim() + '\n',
    startLine: start + 1,
    endLine: end + 1,
  };
}

export const sha256 = (s) => createHash('sha256').update(String(s), 'utf8').digest('hex');

/**
 * Hash buildClientDescription and say whether it still matches.
 *
 * THE CROSS-CHECK IS NOT OPTIONAL. Hashing a span of a text file proves something
 * about that file; it proves nothing about the function the booking path actually
 * calls, and the two come apart the moment the span is wrong or the module has a
 * second definition. So the extracted text is compared against the imported
 * function's own `toString()` (minus the `export ` keyword, which is not part of
 * the function object's source text, and with line endings normalised for the same
 * reason as above). A mismatch means the thing that was hashed is not the thing
 * that ships, and it is reported as its own failure rather than folded into the
 * sha comparison — a wrong span with a right hash is not a pass.
 *
 * `liveSource` is injected so the controls can drive both arms without a second
 * copy of provider-clio.js on disk; the CLI passes the real function's source.
 */
export function hashDescriptionFn({ source, liveSource, expected = EXPECTED_DESCRIPTION_SHA }) {
  const cut = extractExportedFunction(source, DESCRIPTION_FN_NAME);
  if (!cut.ok) {
    return {
      ok: false, state: 'NOT_EXTRACTED', reason: cut.reason,
      sha: null, expected, matches: false, crossChecked: false,
    };
  }

  const sha = sha256(cut.text);

  let crossChecked = null;
  if (liveSource !== undefined && liveSource !== null) {
    const normalisedLive = String(liveSource).replace(/\r\n/g, '\n').trim();
    const normalisedCut  = cut.text.trim().replace(/^export /, '');
    crossChecked = normalisedLive === normalisedCut;
  }

  return {
    ok: true,
    state: crossChecked === false ? 'SPAN_IS_NOT_THE_LIVE_FUNCTION'
         : sha === expected ? 'MATCHES' : 'DIFFERS',
    sha,
    expected,
    matches: sha === expected && crossChecked !== false,
    crossChecked,
    startLine: cut.startLine,
    endLine: cut.endLine,
    bytes: Buffer.byteLength(cut.text, 'utf8'),
  };
}

// ── Task 3: does a client-facing surface carry an intake value? ──────────────

/**
 * Fold a surface for comparison: lower case, all whitespace runs to one space.
 *
 * A description Clio re-wrapped, or one whose newlines became CRLF in transit,
 * still carries the band. Comparing the raw strings would answer "no" for a leak
 * that a human reading the email would see immediately, so the search runs on the
 * folded pair. The RAW pair is searched too and reported separately, because
 * "present verbatim" and "present modulo whitespace" are different facts and only
 * one of them is what a reader of the .ics sees.
 */
export function foldSurface(s) {
  return String(s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Search each named surface for each non-empty intake value.
 *
 * VACUOUS IS REPORTED, NOT PASSED. If no value is non-empty there is nothing to
 * search for and the answer is VACUOUS; if no surface was readable there is
 * nowhere to search and the answer is NOT_RUN. Neither is a clean bill of health,
 * and a "no hits" verdict that cannot tell them apart from a real clean run is the
 * failure mode this whole function exists inside of.
 *
 * @param {Record<string,string>} values   intake key → value, as read off the contact
 * @param {Record<string,string|null>} surfaces  surface name → text, null when unreadable
 */
export function findIntakeLeaks(values, surfaces) {
  const searchable = Object.entries(values ?? {})
    .filter(([, v]) => String(v ?? '').trim() !== '');
  const readable = Object.entries(surfaces ?? {})
    .filter(([, v]) => typeof v === 'string');

  const hits = [];
  for (const [name, text] of readable) {
    const rawLower = String(text).toLowerCase();
    const folded = foldSurface(text);
    for (const [key, value] of searchable) {
      const v = String(value);
      const verbatim = rawLower.includes(v.toLowerCase());
      const whitespaceInsensitive = folded.includes(foldSurface(v));
      if (!verbatim && !whitespaceInsensitive) continue;
      hits.push({
        field: key,
        surface: name,
        verbatim,
        whitespaceInsensitive,
        isBand: BAND_KEYS.includes(key),
        valueLength: v.length,
      });
    }
  }

  const state = readable.length === 0 ? 'NOT_RUN'
              : searchable.length === 0 ? 'VACUOUS'
              : hits.length ? 'LEAKED' : 'CLEAN';

  return {
    state,
    hits,
    bandHits: hits.filter((h) => h.isBand),
    valuesSearched: searchable.map(([k]) => k),
    surfacesSearched: readable.map(([k]) => k),
    detail: state === 'NOT_RUN'
        ? 'no client-facing surface was readable — nothing was searched, which is not the same as nothing being there'
      : state === 'VACUOUS'
        ? 'every intake value is empty, so there was nothing to search FOR — searching for nothing finds nothing and that is not a pass'
      : state === 'LEAKED'
        ? `${hits.length} intake value(s) appear on a surface Clio renders to the client`
        : `${searchable.length} value(s) searched across ${readable.length} surface(s); none appear`,
  };
}

// ── Task 1: reading the seven off a contact ──────────────────────────────────

/**
 * Attribute a CustomFieldValue row to one of the seven, or say why it could not be.
 *
 * TWO ROUTES, AND WHICH ONE WAS TAKEN IS PART OF THE ANSWER. Clio's `fields=`
 * selector decides what comes back:
 *
 *   BY_ID    row.custom_field.id === the id the name lookup resolved. Strongest:
 *            it is the same id the write path binds to. NOT REACHABLE FROM A LIVE
 *            READ — the only selection that would produce it needs second-level
 *            nesting (a `custom_field` sub-selection inside `custom_field_values`),
 *            which Clio answers with a 400 — see CONTACT_FIELD_ATTEMPTS. Kept
 *            because a row that carries one is better evidence and
 *            the shape may appear on a future API version; never relied on.
 *   BY_NAME  row.field_name === the Intake name. The route a live run takes — it is
 *            the same string the name lookup matches on.
 *   NONE     the row carries neither. It is NOT evidence of absence for any field.
 *            Counted, and it makes T1 an INSTRUMENT_FAILED report rather than a
 *            per-field verdict: the value belonging to one of the seven may be
 *            sitting in exactly that row.
 */
export function attributeRow(row, idByKey) {
  const cfId = row?.custom_field?.id;
  if (cfId != null) {
    for (const f of INTAKE_CUSTOM_FIELDS) {
      if (idByKey[f.key] != null && String(idByKey[f.key]) === String(cfId)) {
        return { key: f.key, by: 'BY_ID' };
      }
    }
  }
  const fieldName = String(row?.field_name ?? '').trim();
  if (fieldName) {
    const hit = INTAKE_CUSTOM_FIELDS.find((f) => f.name === fieldName);
    if (hit) return { key: hit.key, by: 'BY_NAME' };
    return { key: null, by: 'NOT_OURS' };
  }
  if (cfId != null) return { key: null, by: 'NOT_OURS' };
  return { key: null, by: 'NONE' };
}

/**
 * The per-field report: one row per Intake field, every row with a definite state.
 *
 * The seven states are not interchangeable and collapsing any two of them is how a
 * report becomes ambiguous:
 *
 *   POPULATED           the field is on the contact and holds a non-empty value
 *   PRESENT_BUT_EMPTY   the field is on the contact and holds ""  — Clio's shape
 *                       for a displayed-but-unset field; the booking did not write
 *   ABSENT              the name resolved on the account, but no value row for it
 *                       is on this contact. The booking did not write.
 *   UNRESOLVED          the name is not on the account at all. Nothing could have
 *                       been written, and this is a Clio-settings finding rather
 *                       than a booking one. ONLY CLAIMABLE AFTER A COMPLETE
 *                       ENUMERATION — see `fieldsListed` below.
 *   REFUSED_ON_TYPE     the name is on the account with the wrong field_type. The
 *                       write path REFUSES to bind it (clio-custom-fields.js), so
 *                       an empty value here is expected and is not a booking bug.
 *   UNDETERMINED        something this run needed to see, it did not see. Absence
 *                       cannot be concluded, and saying so is the whole point.
 *                       See [[feedback_refused_list_cannot_prove_absence]].
 *   INSTRUMENT_FAILED   THIS ROW IS NOT ABOUT THE FIELD. The run could not attribute
 *                       any value row to any field — either the only selection Clio
 *                       accepted returns nothing to attribute WITH, or rows came
 *                       back carrying neither key. Every one of the seven then reads
 *                       the same, because the finding is about the tool. R1 spelled
 *                       this UNDETERMINED, which is a per-field judgement and reads
 *                       as seven considered answers; it is one broken answer.
 *
 * `fieldsListed` IS LOAD-BEARING AND WAS THE FIRST DEFECT THE CONTROLS FOUND. A
 * 403 on /custom_fields skips the contact read, which is right — but without this
 * flag every field then fell through to UNRESOLVED, and the report said "these
 * seven names are not on the account" when what actually happened is that the
 * grant was refused and this run knows nothing. A refusal that renders as a
 * finding about the firm's Clio settings is worse than no report at all.
 */
export function buildFieldReport({ resolution, rowsByKey, unattributableRows, contactRead, fieldsListed, attribution }) {
  // Omitted by a direct caller: derive the same answer from the row count, so the
  // instrument state cannot be lost by forgetting to pass it.
  const attr = attribution ?? (unattributableRows > 0
    ? { ok: false, state: 'ROWS_NOT_ATTRIBUTABLE', why: `${unattributableRows} custom-field row(s) on the contact carried neither custom_field.id nor field_name` }
    : { ok: true, state: 'SOUND', why: null });


  return INTAKE_CUSTOM_FIELDS.map((f) => {
    const res = resolution?.[f.key] ?? { state: 'UNRESOLVED' };
    const row = rowsByKey?.[f.key];

    if (row) {
      const value = String(row.value ?? '');
      return {
        key: f.key, name: f.name, expectedType: f.type,
        fieldId: res.id ?? null,
        state: value.trim() === '' ? 'PRESENT_BUT_EMPTY' : 'POPULATED',
        value,
        valueId: row.valueId ?? null,
        observedType: row.fieldType ?? null,
        matchedBy: row.matchedBy,
      };
    }

    if (res.state === 'REFUSED_ON_TYPE') {
      return {
        key: f.key, name: f.name, expectedType: f.type, fieldId: res.id ?? null,
        state: 'REFUSED_ON_TYPE', value: null, observedType: res.observedType ?? null,
        matchedBy: null,
      };
    }
    if (res.state !== 'RESOLVED') {
      // "not on the account" is only sayable off a walk that reached the end of
      // the account. Anything less is "not seen", which is UNDETERMINED.
      if (!fieldsListed) {
        return {
          key: f.key, name: f.name, expectedType: f.type, fieldId: null,
          state: 'UNDETERMINED', value: null, observedType: null, matchedBy: null,
          why: 'the account\'s contact custom fields could not be fully enumerated — a name not seen is not a name absent',
        };
      }
      return {
        key: f.key, name: f.name, expectedType: f.type, fieldId: null,
        state: 'UNRESOLVED', value: null, observedType: null, matchedBy: null,
      };
    }
    if (!contactRead) {
      return {
        key: f.key, name: f.name, expectedType: f.type, fieldId: res.id,
        state: 'UNDETERMINED', value: null, observedType: null, matchedBy: null,
        why: 'the contact was not read',
      };
    }
    if (!attr.ok) {
      return {
        key: f.key, name: f.name, expectedType: f.type, fieldId: res.id,
        state: 'INSTRUMENT_FAILED', value: null, observedType: null, matchedBy: null,
        instrumentState: attr.state,
        why: attr.why,
      };
    }
    return {
      key: f.key, name: f.name, expectedType: f.type, fieldId: res.id,
      state: 'ABSENT', value: null, observedType: null, matchedBy: null,
    };
  });
}

// ── The run ──────────────────────────────────────────────────────────────────

const isoAt = (ms) => new Date(ms).toISOString();

/**
 * @param {object}   opts
 * @param {object}   opts.env          process.env, or a stub
 * @param {Function} opts.fetchImpl    injected so the control suite can drive this
 *                                     offline without touching app.clio.com
 * @param {string|number} opts.contactId
 * @param {string|number} opts.entryId
 * @param {string}   opts.expectedSha  overrides the pinned value; announced loudly
 * @param {string}   opts.providerSource  provider-clio.js text, injected by the controls
 * @param {string}   opts.liveDescriptionSource  buildClientDescription.toString()
 */
export async function runWritePathVerify({
  env,
  fetchImpl = fetch,
  contactId,
  entryId,
  expectedSha = EXPECTED_DESCRIPTION_SHA,
  shaOverridden = false,
  providerSource,
  liveDescriptionSource,
  nowMs = Date.now(),
  log = console.log,
  logErr = console.error,
} = {}) {
  const redactor = makeRedactor(env);
  const emit    = (line = '') => log(redactor.scrub(String(line)));
  const emitErr = (line = '') => logErr(redactor.scrub(String(line)));

  const out = {
    order: 'SHELDON-WRITEPATH-VERIFY-FIX-R1',
    issue: 153,
    startedAt: isoAt(nowMs),
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
  const raise = (code) => { out.exitCode = moreSevere(out.exitCode, code); };

  emit('── SHELDON-CLIO-WRITEPATH-VERIFY-R1 ─────────────────────────────────');
  emit(`issue 153 · ${isoAt(nowMs)}`);
  emit('READ ONLY. Every /api/v4 call is a GET; the only non-GET is the token mint.');
  emit('');
  emit('HANDLING: this report prints the client\'s intake answers, income and net');
  emit('worth bands included. That is the deliverable. Do not paste a live');
  emit('transcript into a pull request or an issue.');
  emit('');

  // ── T4 first, because it needs nothing ─────────────────────────────────────
  // The structural guard runs BEFORE the network and before the argument checks,
  // so it is answered on every invocation — including `--help`-shaped ones that
  // never reach Clio. It is the one task in this file that a reviewer can re-run
  // with no credentials at all.
  if (shaOverridden) {
    emit(`NOTE  --expect-sha was supplied. The PINNED value is NOT in use for this run.`);
    emit(`      pinned:   ${EXPECTED_DESCRIPTION_SHA}`);
    emit(`      supplied: ${expectedSha}`);
    out.notes.push('the sha comparison ran against an operator-supplied expectation, not the pinned one');
  }

  const shaResult = hashDescriptionFn({
    source: providerSource ?? '',
    liveSource: liveDescriptionSource,
    expected: expectedSha,
  });
  out.observations.descriptionSha = { ...shaResult, pinned: EXPECTED_DESCRIPTION_SHA, overridden: shaOverridden };

  if (!shaResult.ok) {
    step(`T4 ${DESCRIPTION_FN_NAME} was located`, false, shaResult.reason);
    blocker(`the structural leak guard could not be evaluated: ${shaResult.reason}`);
    raise(EXIT_SHA_MISMATCH);
  } else {
    step(`T4 ${DESCRIPTION_FN_NAME} was located`, true,
      `lines ${shaResult.startLine}–${shaResult.endLine}, ${shaResult.bytes} bytes (LF-normalised)`);
    if (shaResult.crossChecked === false) {
      step('T4 the hashed span IS the shipping function', false,
        'the extracted text does not match the live function\'s own source — the hash is about the wrong bytes');
      blocker('the sha was computed over a span that is not the function the booking path calls');
      raise(EXIT_SHA_MISMATCH);
    } else if (shaResult.crossChecked === true) {
      step('T4 the hashed span IS the shipping function', true,
        'the extracted text matches the imported function\'s own source text');
    } else {
      // NOT SILENCE. A cross-check that did not run must say so, or a degraded run
      // is indistinguishable from a full one: the sha still prints, the step is
      // simply missing, and nobody notices the strongest half of the guard was
      // skipped. See [[feedback_dead_stub_option_degrades_to_happy_path]].
      step('T4 the hashed span IS the shipping function', false,
        'NOT CHECKED — provider-clio.js could not be imported, so the sha covers the file span only');
      out.notes.push('the buildClientDescription cross-check did not run; the sha is over the file span alone');
    }

    if (shaResult.sha === expectedSha) {
      step('T4 sha256 matches the expected value', true, shaResult.sha);
    } else {
      const bar = '!'.repeat(72);
      emitErr(bar);
      emitErr(`!! ${DESCRIPTION_FN_NAME} HAS CHANGED.`);
      emitErr(`!!   expected  ${expectedSha}`);
      emitErr(`!!   computed  ${shaResult.sha}`);
      emitErr('!! This function is the structural leak guard: it takes NO caller-supplied');
      emitErr('!! text, which is what makes "no bands in the client email" provable rather');
      emitErr('!! than promised. Its description is rendered verbatim by Clio into the');
      emitErr('!! attendee\'s confirmation email and .ics. Re-read the parameter list');
      emitErr('!! before this ships.');
      emitErr(bar);
      step('T4 sha256 matches the expected value', false, `computed ${shaResult.sha}`);
      blocker(`${DESCRIPTION_FN_NAME} sha256 differs from the expected value`);
      raise(EXIT_SHA_MISMATCH);
    }
  }

  // ── The seven, as the shipping module declares them ────────────────────────
  const declaredKeys = INTAKE_CUSTOM_FIELDS.map((f) => f.key);
  const keysMatch = declaredKeys.length === EXPECTED_FIELD_KEYS.length
    && declaredKeys.every((k, i) => k === EXPECTED_FIELD_KEYS[i]);
  const typesMatch = INTAKE_CUSTOM_FIELDS.every((f) => f.type === EXPECTED_FIELD_TYPE);
  out.observations.fieldSet = {
    declared: INTAKE_CUSTOM_FIELDS.map((f) => ({ key: f.key, name: f.name, type: f.type })),
    keysMatch, typesMatch,
  };
  if (keysMatch && typesMatch) {
    step('the shipping field set is still the seven issue 153 names', true,
      `${declaredKeys.length} fields, all ${EXPECTED_FIELD_TYPE}`);
  } else {
    step('the shipping field set is still the seven issue 153 names', false,
      `declared: ${declaredKeys.join(', ')}`);
    blocker('INTAKE_CUSTOM_FIELDS has drifted from the seven this report is about');
    raise(EXIT_FIELD_SET_DRIFT);
  }

  // ── arguments ──────────────────────────────────────────────────────────────
  const contact = parseResourceId(contactId);
  const entry   = parseResourceId(entryId);

  if (!contact.ok && contact.reason !== 'ABSENT') {
    step('--contact is a usable Clio id', false, `${contact.reason} — refused before the network`);
    blocker('--contact was supplied but is not a positive integer');
    raise(EXIT_BAD_ARGS);
  }
  if (!entry.ok && entry.reason !== 'ABSENT') {
    step('--entry is a usable Clio id', false, `${entry.reason} — refused before the network`);
    blocker('--entry was supplied but is not a positive integer');
    raise(EXIT_BAD_ARGS);
  }
  if (out.exitCode === EXIT_BAD_ARGS) {
    out.verdict = { state: 'NOT_RUN', why: 'an id argument was refused' };
    return finish();
  }

  if (!contact.ok && !entry.ok) {
    step('an id to look at was supplied', false, 'neither --contact nor --entry');
    blocker('nothing to read. T1, T2 and T3 are NOT_RUN — only T4 was answered.');
    emit('');
    emit('Run it as:');
    emit('  CLIO_CLIENT_ID=… CLIO_CLIENT_SECRET=… CLIO_REFRESH_TOKEN=… \\');
    emit('    node test/preview/verify-clio-writepath.mjs --contact=<id> --entry=<id>');
    emit('  For the 2026-08-04 booking: --contact=2413234643 --entry=4981729058');
    out.verdict = { state: 'NOT_RUN', why: 'no contact id and no entry id' };
    return finish();
  }

  // ── credentials ────────────────────────────────────────────────────────────
  const missing = CREDENTIAL_VARS.filter((v) => !String(env?.[v] ?? '').trim());
  if (missing.length) {
    step('credentials supplied', false, `missing: ${missing.join(', ')}`);
    blocker('the verifier cannot read the live grant without the three environment values');
    raise(EXIT_NO_CREDENTIALS);
    out.verdict = { state: 'NOT_RUN', why: 'no credentials' };
    // Through finish(), not `return out`. EVERY exit prints the ledger, including
    // the ones that never reached the network: "no requests were issued" is a claim
    // that needs a positive arm, and an empty ledger printed by the same code that
    // would have printed a full one is that arm.
    // See [[feedback_zero_request_assertion_needs_a_positive_arm]].
    return finish();
  }
  step('credentials supplied', true, `${CREDENTIAL_VARS.length} values present (no value read into any output)`);

  // ── the transport, and the ledger it writes ────────────────────────────────
  let seq = 0;
  const send = async (method, url, init = {}) => {
    seq += 1;
    const { origin, pathname } = urlParts(url);
    const record = { seq, method, url: String(url), origin, pathname, status: null, error: null };
    out.requests.push(record);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      // `redirect: 'error'` is NOT decoration, and it sits AFTER the spread so no
      // caller can talk it down. The platform default is `follow`, and a followed
      // redirect is not the same risk on every request here:
      //
      //   GET  /api/v4/…    the fetch spec strips `Authorization` on a CROSS-ORIGIN
      //                     redirect — but a same-origin one keeps it, and a
      //                     redirect chain can leave the origin after a hop the
      //                     ledger cannot see.
      //   POST /oauth/token a 307 or 308 RE-ISSUES the request to the redirect
      //                     target WITH ITS BODY, and that body is
      //                     client_id + client_secret + refresh_token as form
      //                     fields. Header stripping does nothing for a body. Those
      //                     three values re-provision the firm's Clio grant.
      //
      // And the ledger could not have shown it: `record` is written from the URL
      // this file CONSTRUCTED, never from the URL fetch finally contacted, so the
      // printed proof that nothing left app.clio.com would read clean while the
      // credentials were already gone.
      // See [[feedback_stripped_auth_makes_the_egress_tripwire_blind_to_a_redirect]].
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

  /** One GET reduced to {ok, status, body} — every non-answer named. */
  const readJson = async (url, accessToken) => {
    const res = await apiGet(url, accessToken);
    if (!res) return { ok: false, why: 'no answer (timeout or transport)', status: null };
    if (!res.ok) return { ok: false, why: `HTTP ${res.status}`, status: res.status };
    try {
      return { ok: true, status: res.status, body: await res.json() };
    } catch (_) {
      return { ok: false, why: 'the body did not parse as JSON', status: res.status };
    }
  };

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
    blocker('MINT UNAVAILABLE — this says nothing about the grant and nothing about the write path');
    out.verdict = { state: 'MINT_UNAVAILABLE' };
    return finish();
  }
  if (!mintRes.ok) {
    const dead = mintRes.status === 400 || mintRes.status === 401;
    step('access token minted', false, `HTTP ${mintRes.status}`);
    blocker(dead
      ? 'DEAD GRANT — the stored refresh token is not accepted. Booking is already down; this is the finding, not a probe failure.'
      : `MINT UNAVAILABLE — HTTP ${mintRes.status} from the token endpoint says Clio is unwell, not that the grant is`);
    out.verdict = { state: dead ? 'DEAD_GRANT' : 'MINT_UNAVAILABLE' };
    return finish();
  }

  let mintJson;
  try { mintJson = await mintRes.json(); } catch (_) { mintJson = null; }
  const accessToken = mintJson?.access_token;
  if (!accessToken) {
    step('access token minted', false, 'the mint returned 200 with no access_token');
    blocker('MINT UNAVAILABLE — a 200 with no token is not a token');
    out.verdict = { state: 'MINT_UNAVAILABLE' };
    return finish();
  }
  redactor.add('CLIO_ACCESS_TOKEN', accessToken);
  step('access token minted', true, 'one POST to /oauth/token — value never read into any output');

  const returnedRefresh = mintJson?.refresh_token;
  if (typeof returnedRefresh === 'string' && returnedRefresh && returnedRefresh !== String(env.CLIO_REFRESH_TOKEN)) {
    redactor.add('CLIO_ROTATED_REFRESH_TOKEN', returnedRefresh);
    const bar = '!'.repeat(72);
    emitErr(bar);
    emitErr('!! THE REFRESH TOKEN ROTATED. The value in the environment is now STALE.');
    emitErr('!! Production booking refreshes against the stored value and will fail.');
    emitErr('!! Store the new one from Clio before anything else.');
    emitErr(bar);
    blocker('the refresh token rotated — the stored credential must be replaced');
    out.refreshRotated = true;
    raise(EXIT_ROTATED);
  } else {
    out.refreshRotated = false;
    step('the refresh token did not rotate', true, 'the stored credential is still the live one');
  }

  // ── T1a: resolve the seven by NAME, the way the write path does ────────────
  //
  // The same walk clio-custom-fields.js performs, with the same per-field type
  // expectation. CLIO_INTAKE_FIELD_IDS is deliberately not consulted — see header.
  const resolution = {};
  let fieldsListed = false;
  let listTruncated = false;
  const byName = new Map();

  if (contact.ok) {
    let url = `${CLIO_BASE}/custom_fields?parent_type=contact&deleted=false`
            + `&fields=id,name,field_type&limit=${FIELD_PAGE_LIMIT}`;
    let page = 0;
    let listFailed = null;

    for (; page < FIELD_MAX_PAGES && url; page += 1) {
      // NEVER FOLLOW A CURSOR OFF CLIO, and check BEFORE the request rather than
      // after. `meta.paging.next` is a value from the response body: an absolute
      // URL naming another host is a perfectly well-formed cursor and is the one
      // shape that must not be followed, because following it sends the bearer
      // token to whoever wrote it.
      // See [[feedback_pathname_only_url_check_cannot_see_the_host]].
      if (!isClioApiUrl(url)) {
        listFailed = `a paging cursor pointed outside ${CLIO_BASE} (${urlParts(url).origin || 'unparseable'}) — refused rather than followed`;
        blocker(`meta.paging.next named a host this verifier will not follow: ${urlParts(url).origin || '(unparseable)'}`);
        break;
      }

      const r = await readJson(url, accessToken);
      if (!r.ok) {
        listFailed = r.why;
        if (r.status === 403) {
          // THE ORDER'S STOP CONDITION.
          const bar = '!'.repeat(72);
          emitErr(bar);
          emitErr('!! THE GRANT CANNOT READ CONTACT CUSTOM FIELDS — HTTP 403 on /custom_fields.');
          emitErr('!! This is the STOP condition. The 403→200 reconnect has regressed, and no');
          emitErr('!! statement about what a booking wrote can be made from here. Nothing was');
          emitErr('!! written and nothing else was attempted.');
          emitErr(bar);
          blocker('CUSTOM FIELDS SCOPE LOST — the grant cannot read a contact custom field. STOP.');
          raise(EXIT_SCOPE_LOST);
        }
        break;
      }

      const rows = Array.isArray(r.body?.data) ? r.body.data : [];
      for (const row of rows) {
        const name = String(row?.name ?? '').trim();
        const id = Number(row?.id);
        if (!name || !Number.isFinite(id) || id <= 0) continue;
        const declared = INTAKE_CUSTOM_FIELDS.find((f) => f.name === name);
        if (!declared) continue;                 // the firm's other fields are none of our business
        if (byName.has(name)) continue;          // first match wins, exactly as the write path does
        byName.set(name, { id, fieldType: String(row?.field_type ?? '').trim() });
      }

      const next = r.body?.meta?.paging?.next;
      url = typeof next === 'string' && next ? next : '';
      if (url && page + 1 >= FIELD_MAX_PAGES) {
        listTruncated = true;
        break;
      }
    }

    fieldsListed = listFailed === null && !listTruncated;

    if (listTruncated) {
      // A TRUNCATED WALK IS A FAILED WALK — the module says so and so does this.
      // A name absent from the pages we managed to read is not absent from the
      // account. See [[feedback_truncated_page_is_a_wellformed_answer]].
      step('T1 the account\'s contact custom fields were enumerated', false,
        `the walk hit the ${FIELD_MAX_PAGES}-page bound with a cursor still outstanding — a name not seen is NOT a name absent`);
      out.notes.push('the custom-field enumeration was truncated, so every unmatched field below is UNDETERMINED — "not seen", never "not there"');
    } else if (listFailed) {
      step('T1 the account\'s contact custom fields were enumerated', false, listFailed);
    } else {
      step('T1 the account\'s contact custom fields were enumerated', true,
        `${page} page(s) read, ${byName.size} of ${INTAKE_CUSTOM_FIELDS.length} Intake names found`);
    }

    for (const f of INTAKE_CUSTOM_FIELDS) {
      const hit = byName.get(f.name);
      if (!hit) { resolution[f.key] = { state: 'UNRESOLVED' }; continue; }
      // THE SAME ADMISSION TEST THE WRITE PATH APPLIES. A name whose field_type is
      // not the type its entry declares is refused there and is refused here, so a
      // value missing from the contact for that reason reads as REFUSED_ON_TYPE
      // rather than as a booking that failed to write.
      if (hit.fieldType !== f.type) {
        resolution[f.key] = { state: 'REFUSED_ON_TYPE', id: hit.id, observedType: hit.fieldType || null };
      } else {
        resolution[f.key] = { state: 'RESOLVED', id: hit.id, observedType: hit.fieldType };
      }
    }

    const resolved = Object.values(resolution).filter((r) => r.state === 'RESOLVED').length;
    const refused  = Object.values(resolution).filter((r) => r.state === 'REFUSED_ON_TYPE').length;
    step('T1 the seven Intake names resolve, and all are the expected type', resolved === INTAKE_CUSTOM_FIELDS.length,
      `${resolved} resolved, ${refused} refused on type, ${INTAKE_CUSTOM_FIELDS.length - resolved - refused} not found`);
  }
  out.observations.resolution = resolution;
  out.observations.fieldListing = { listed: fieldsListed, truncated: listTruncated };

  // ── T1b: read the contact ─────────────────────────────────────────────────
  const idByKey = {};
  for (const [k, r] of Object.entries(resolution)) if (r.state === 'RESOLVED') idByKey[k] = r.id;

  let contactRead = null;
  let contactSelection = null;
  let contactSelectionAttributes = null;
  const contactAttempts = [];

  if (contact.ok && out.exitCode !== EXIT_SCOPE_LOST) {
    for (const { fields, attributes } of CONTACT_FIELD_ATTEMPTS) {
      const url = `${CLIO_BASE}/contacts/${contact.text}?`
        + new URLSearchParams({ fields }).toString();
      const r = await readJson(url, accessToken);
      contactAttempts.push({ fields, attributes, ok: r.ok, status: r.status ?? null, why: r.ok ? null : r.why });
      if (r.ok) {
        contactRead = r.body?.data ?? null;
        contactSelection = fields;
        contactSelectionAttributes = attributes;
        break;
      }
      if (r.status === 403) {
        const bar = '!'.repeat(72);
        emitErr(bar);
        emitErr('!! THE GRANT CANNOT READ THIS CONTACT — HTTP 403 on /contacts/{id}.');
        emitErr('!! This is the STOP condition: reporting the field values is not possible');
        emitErr('!! without a read this grant is refused. Nothing was written.');
        emitErr(bar);
        blocker('CONTACT READ REFUSED — the grant cannot read the contact. STOP.');
        raise(EXIT_SCOPE_LOST);
        break;
      }
      if (r.status === 404) {
        blocker(`no contact ${contact.text} on this account — check the id against the Clio URL`);
        break;
      }
    }
    out.observations.contactAttempts = contactAttempts;
    step('T1 the contact was read', contactRead !== null,
      contactRead !== null
        ? `selection: ${contactSelection} (${contactSelectionAttributes ? 'attributing' : 'CANNOT ATTRIBUTE'})`
        : contactAttempts.map((a) => a.why).filter(Boolean).join('; '));

    // A SEPARATE STEP FROM "the contact was read", because they are separate facts
    // and R1 collapsed them: the read succeeded, the step said PASS, and the report
    // then produced seven per-field verdicts out of rows nothing could be tied to.
    // Reading a contact through a rung that cannot attribute is a broken INSTRUMENT,
    // not a finding about the contact.
    if (contactRead !== null) {
      step('T1 the winning selection can attribute a value row to a field', Boolean(contactSelectionAttributes),
        contactSelectionAttributes
          ? `${contactSelection} returns field_name on every row`
          : `${contactSelection} returns rows with no field_name and no usable custom_field id — no per-field verdict can be taken from it`);
    }
  }

  // Attribute the rows.
  const rowsByKey = {};
  let unattributableRows = 0;
  let foreignRows = 0;
  if (contactRead) {
    const rows = Array.isArray(contactRead.custom_field_values) ? contactRead.custom_field_values : [];
    for (const row of rows) {
      const attribution = attributeRow(row, idByKey);
      if (attribution.key === null) {
        if (attribution.by === 'NONE') unattributableRows += 1;
        else foreignRows += 1;
        continue;
      }
      if (rowsByKey[attribution.key]) continue;  // first wins, as the write path does
      rowsByKey[attribution.key] = {
        value: row?.value,
        valueId: row?.id ?? null,
        fieldType: row?.field_type ?? null,
        matchedBy: attribution.by,
      };
    }
    out.observations.contactRows = {
      total: rows.length,
      ours: Object.keys(rowsByKey).length,
      foreign: foreignRows,
      unattributable: unattributableRows,
    };
    if (unattributableRows > 0) {
      // The row carries neither `custom_field.id` nor `field_name`, so it cannot be
      // ruled in OR out — and neither can any of the seven, because the value that
      // belongs to one of them may be sitting in exactly that row.
      step('T1 every custom-field row on the contact could be attributed', false,
        `${unattributableRows} row(s) carried neither custom_field.id nor field_name — no per-field verdict can be taken from this read`);
    }
  }

  // ── Is T1 answerable at all? ──────────────────────────────────────────────
  //
  // AN INSTRUMENT FAILURE IS NOT A FIELD FINDING. Two different things can leave the
  // seven unanswerable, and neither is a fact about the contact:
  //
  //   NON_ATTRIBUTING_SELECTION  every attributing rung failed and a plain one won.
  //   ROWS_NOT_ATTRIBUTABLE      an attributing rung won, but rows still came back
  //                              carrying neither key.
  //
  // R1 rendered both as seven UNDETERMINED rows — one per field, each looking like a
  // considered answer about that field, in a report whose headline read "0 of 7
  // populated, 7 UNDETERMINED". That is the same shape as
  // [[feedback_refusal_must_not_render_as_a_finding_about_the_subject]] one turn
  // further on: not a refusal dressed as a finding, but a BROKEN TOOL dressed as
  // seven findings. The fix is a state of its own, said once, about the run.
  const attribution = !contactRead
    ? { ok: false, state: 'CONTACT_NOT_READ', why: 'the contact was not read' }
    : contactSelectionAttributes === false
      ? {
          ok: false,
          state: 'NON_ATTRIBUTING_SELECTION',
          why: `the only \`fields\` selection Clio accepted (${contactSelection}) returns rows with no field_name and no usable custom_field id — this run cannot tie any value to any field, which is a failure of the INSTRUMENT and not a statement about the contact`,
        }
      : unattributableRows > 0
        ? {
            ok: false,
            state: 'ROWS_NOT_ATTRIBUTABLE',
            why: `${unattributableRows} custom-field row(s) on the contact carried neither custom_field.id nor field_name — the value belonging to one of the seven may be in exactly that row, so no per-field verdict is available from this read`,
          }
        : { ok: true, state: 'SOUND', why: null };

  if (contact.ok) {
    out.observations.attribution = {
      ...attribution,
      selection: contactSelection,
      selectionAttributes: contactSelectionAttributes,
      unattributableRows,
    };
  }

  // CONTACT_NOT_READ keeps its existing per-field UNDETERMINED — the read itself is
  // already reported as failed and each field genuinely was not looked at. The two
  // ATTRIBUTION states are the new ones, and they exit non-zero: this run did not
  // answer T1, and an exit 0 means the instrument was sound.
  if (attribution.state === 'NON_ATTRIBUTING_SELECTION' || attribution.state === 'ROWS_NOT_ATTRIBUTABLE') {
    blocker(`T1 COULD NOT BE ANSWERED — ${attribution.why}`);
    raise(EXIT_NO_ATTRIBUTION);
  }

  const fieldReport = contact.ok
    ? buildFieldReport({ resolution, rowsByKey, unattributableRows, contactRead, fieldsListed, attribution })
    : null;
  out.observations.fields = fieldReport;

  // The values, for T3. Held in a local and also recorded — the evidence file is
  // gitignored precisely so this is allowed to exist.
  const intakeValues = {};
  for (const row of fieldReport ?? []) {
    if (row.state === 'POPULATED') intakeValues[row.key] = row.value;
  }

  // ── T2: the calendar entry ────────────────────────────────────────────────
  const ENTRY_FIELD_ATTEMPTS = [
    'id,summary,description,location,start_at,end_at,attendees{id,type,name,email},conference_meeting{id,type,join_url}',
    'id,summary,description,location,start_at,end_at,attendees,conference_meeting',
    'id,summary,description,location,start_at,end_at,attendees',
    // THE FLOOR, and it drops `attendees` on purpose. T3 — is a band on a surface
    // Clio emails the client — needs only description, summary and location, and it
    // is the finding with the shortest fuse. Losing it because Clio would not accept
    // `attendees` in a field list would be trading the leak check for the attendee
    // check; this way the attendee question degrades to UNKNOWN (which the report
    // says, and does not round to "no attendee") and the leak question still runs.
    'id,summary,description,location,start_at,end_at',
  ];

  let entryRecord = null;
  let entrySelection = null;
  const entryAttempts = [];
  // Which keys the winning selection actually ASKED for. Absence is only
  // assertable for a key that was requested — a key that was never selected is
  // UNKNOWN, not absent. See [[feedback_refused_list_cannot_prove_absence]].
  let entryRequested = new Set();

  if (entry.ok && out.exitCode !== EXIT_SCOPE_LOST) {
    for (const fields of ENTRY_FIELD_ATTEMPTS) {
      const url = `${CLIO_BASE}/calendar_entries/${entry.text}?`
        + new URLSearchParams({ fields }).toString();
      const r = await readJson(url, accessToken);
      entryAttempts.push({ fields, ok: r.ok, status: r.status ?? null, why: r.ok ? null : r.why });
      if (r.ok) {
        entryRecord = r.body?.data ?? null;
        entrySelection = fields;
        entryRequested = new Set(fields.split(',').map((s) => s.split('{')[0].trim()));
        break;
      }
      if (r.status === 403) {
        blocker('CALENDAR READ REFUSED — the grant cannot read the calendar entry.');
        raise(EXIT_SCOPE_LOST);
        break;
      }
      if (r.status === 404) {
        blocker(`no calendar entry ${entry.text} on this account — check the id against the Clio URL`);
        break;
      }
    }
    out.observations.entryAttempts = entryAttempts;
    step('T2 the calendar entry was read', entryRecord !== null,
      entryRecord !== null ? `selection: ${entrySelection}` : entryAttempts.map((a) => a.why).filter(Boolean).join('; '));
  }

  // The three client-facing surfaces, held as locals. `location` is READ (T3 has to
  // search it) and NEVER recorded or printed — in dynamic mode it holds a Clio
  // video_conferences wrapper URL, and a join URL is a bearer capability: anyone
  // holding it is in the client's consultation.
  const rawDescription = typeof entryRecord?.description === 'string' ? entryRecord.description : null;
  const rawSummary     = typeof entryRecord?.summary === 'string' ? entryRecord.summary : null;
  const rawLocation    = typeof entryRecord?.location === 'string' ? entryRecord.location : null;

  if (entryRecord) {
    const attendeesSelected = entryRequested.has('attendees');
    const attendees = Array.isArray(entryRecord.attendees) ? entryRecord.attendees : null;
    const typesKnown = Array.isArray(attendees) && attendees.some((a) => a?.type !== undefined);
    const contactAttendees = Array.isArray(attendees)
      ? attendees.filter((a) => String(a?.type ?? '') === 'Contact')
      : [];
    const matchesContact = contact.ok && contactAttendees.some((a) => String(a?.id ?? '') === contact.text);

    out.observations.entry = {
      id: entryRecord.id ?? null,
      startAt: entryRecord.start_at ?? null,
      endAt: entryRecord.end_at ?? null,
      selection: entrySelection,

      // ATTENDEE. `contact_id` is silently discarded by Clio as an unrecognised
      // top-level key — no error, no attendee, no email — and that was the original
      // root cause of confirmations never sending. So the attendee is the
      // observable that stands in for "Clio sent the client their email".
      attendeeCount: attendees === null ? null : attendees.length,
      attendeeTypesKnown: typesKnown,
      contactAttendeeCount: typesKnown ? contactAttendees.length : null,
      attendeeMatchesGivenContact: contact.ok ? matchesContact : null,

      // LOCATION. Presence, host and length only — never the value.
      //
      // INFORMATION, NOT A VERDICT. R1 asserted a location and called an empty one
      // "no meeting was minted", which is a PERMANENT FALSE NEGATIVE on a working
      // booking: Clio does not populate `location` for a conference meeting. It
      // stores the conference association and signs a per-recipient join URL at send
      // time. Proven directly on a meeting created in the Clio user interface — the
      // API read `location` back EMPTY while the emailed calendar file carried a
      // populated LOCATION header. The R1 run reported location NO and conference
      // meeting YES with a join_url on the same entry and called both true; only one
      // of them was ever a signal, and it was not this one. What a populated
      // location DOES tell you is which shape the entry is in (dynamic wrapper,
      // typed-in address, or nothing), so it is still read and still reported — as a
      // fact, with no pass or fail attached.
      locationSelected: entryRequested.has('location'),
      locationPresent: rawLocation !== null && rawLocation !== '',
      locationHost: rawLocation ? (urlParts(rawLocation).origin || null) : null,
      locationLength: rawLocation ? rawLocation.length : 0,
      locationIsClioWrapper: rawLocation
        ? urlParts(rawLocation).origin === CLIO_ORIGIN && urlParts(rawLocation).pathname.includes('video_conferences')
        : false,

      // CONFERENCE MEETING. Same discipline: join_url presence, never its value.
      conferenceSelected: entryRequested.has('conference_meeting'),
      conferencePresent: entryRequested.has('conference_meeting')
        ? (entryRecord.conference_meeting != null)
        : null,
      joinUrlPresent: entryRequested.has('conference_meeting')
        ? Boolean(entryRecord?.conference_meeting?.join_url)
        : null,

      // DESCRIPTION / SUMMARY. Recorded, because they are the T3 subject and the
      // point of the report is to be able to read what the client got.
      description: rawDescription,
      summary: rawSummary,
    };

    const e = out.observations.entry;

    if (attendees === null) {
      step('T2 an attendee is attached', false,
        attendeesSelected
          ? 'the entry came back with no `attendees` array at all'
          : 'the winning selection did not request `attendees` — UNKNOWN, not absent');
    } else if (attendees.length === 0) {
      step('T2 an attendee is attached', false,
        'the entry has ZERO attendees — Clio sent no confirmation email for this booking');
    } else if (typesKnown && contactAttendees.length === 0) {
      step('T2 an attendee is attached', false,
        `${attendees.length} attendee(s), none of type Contact — a Calendar attendee is the attorney, not the client`);
    } else {
      step('T2 an attendee is attached', true,
        `${attendees.length} attendee(s)`
        + (typesKnown ? `, ${contactAttendees.length} of type Contact` : ', types not returned by this selection')
        + (contact.ok ? `; matches --contact: ${matchesContact}` : ''));
    }

    // THE MEETING SIGNAL IS THE JOIN URL, and it is the only one. `location` is
    // information (see the note on the observation above); a signed join_url on the
    // conference_meeting is the thing that exists if and only if Clio minted a
    // meeting for this entry.
    if (!e.conferenceSelected) {
      // NOT SILENCE, and not a claim either. R1 emitted no step at all here, and an
      // absent step reads exactly like a passing one.
      // See [[feedback_dead_stub_option_degrades_to_happy_path]].
      step('T2 a meeting was minted (conference_meeting.join_url)', false,
        'NOT CHECKED — the winning selection did not request `conference_meeting`. UNKNOWN, not absent.');
    } else if (!e.conferencePresent) {
      step('T2 a meeting was minted (conference_meeting.join_url)', false,
        'conference_meeting is null. The spec: null on an ineligible pricing tier or with no Zoom connected.');
    } else {
      step('T2 a meeting was minted (conference_meeting.join_url)', Boolean(e.joinUrlPresent),
        e.joinUrlPresent
          ? 'a conference meeting is attached and carries a join_url — value NOT printed: a join URL is a bearer capability'
          : 'a conference meeting is attached but carries NO join_url — nothing for Clio to sign into the invite');
    }

    // INFORMATION ONLY — deliberately not a step, so it can never be read as a
    // pass or a fail. An empty location on a working booking is the EXPECTED shape.
    emit(`INFO  T2 entry location   : ${
      !e.locationSelected ? 'NOT SELECTED — the winning selection did not request it'
      : !e.locationPresent ? 'empty — expected: Clio does not populate location for a conference meeting; the join URL is signed per recipient at send time'
      : `${e.locationLength} chars`
        + (e.locationHost ? ` at ${e.locationHost}` : ' (not a URL)')
        + (e.locationIsClioWrapper ? ' — a Clio video_conferences wrapper, the dynamic-meeting shape' : '')
        + ' — value NOT printed: a join URL is a bearer capability'
    }`);
  }

  // ── T3: does a client-facing surface carry an intake value? ───────────────
  const leak = findIntakeLeaks(intakeValues, {
    description: rawDescription,
    summary: rawSummary,
    location: rawLocation,
  });
  out.observations.leak = leak;

  if (leak.state === 'LEAKED') {
    const bar = '!'.repeat(72);
    emitErr(bar);
    emitErr('!! AN INTAKE VALUE IS ON A CLIENT-FACING SURFACE.');
    for (const h of leak.hits) {
      emitErr(`!!   ${h.field} appears in the entry ${h.surface}`
        + (h.isBand ? '   ← A BAND. This is the client\'s finances.' : ''));
    }
    emitErr('!! Clio renders the entry description verbatim into the attendee\'s');
    emitErr('!! confirmation email and into the .ics body. This is the leak the');
    emitErr('!! description split exists to prevent.');
    emitErr(bar);
    step('T3 no intake value appears on a client-facing surface', false,
      `${leak.hits.length} hit(s), ${leak.bandHits.length} of them bands`);
    blocker('an intake value reached a surface Clio emails to the client');
    raise(EXIT_LEAK);
  } else {
    // VACUOUS SAYS "every intake value is empty". THAT IS A CLAIM ABOUT THE CONTACT,
    // and it is not established when T1 could not attribute a row: the values may be
    // there and simply unreadable by this run. The leak search itself is untouched —
    // it correctly reports that it had nothing to search for — but the reason is
    // annotated here so the line cannot be read as "the contact holds nothing".
    // Same shape as [[feedback_refusal_must_not_render_as_a_finding_about_the_subject]].
    const blindT1 = Boolean(fieldReport) && !attribution.ok && attribution.state !== 'CONTACT_NOT_READ';
    const why = leak.state === 'VACUOUS' && blindT1
      ? ` · AND NOT BECAUSE THEY ARE EMPTY: T1 could not attribute a single row (${attribution.state}), so this run does not know what the values ARE. Nothing was searched for, and nothing follows about the entry.`
      : '';
    if (why) out.notes.push('T3 is VACUOUS because T1 could not be answered, not because the contact holds no intake values');
    step('T3 no intake value appears on a client-facing surface',
      leak.state === 'CLEAN', `${leak.state} — ${leak.detail}${why}`);
  }

  // ── the verdict ───────────────────────────────────────────────────────────
  const populated = (fieldReport ?? []).filter((r) => r.state === 'POPULATED');
  const undetermined = (fieldReport ?? []).filter((r) => r.state === 'UNDETERMINED');
  const instrumentFailed = (fieldReport ?? []).filter((r) => r.state === 'INSTRUMENT_FAILED');

  out.verdict = {
    state: 'REPORTED',
    contactChecked: contact.ok ? contact.text : null,
    entryChecked: entry.ok ? entry.text : null,
    // T1 IS ANSWERED OR IT IS NOT, and `0/7 populated` is an answer. When the
    // instrument could not attribute, the headline is the instrument state — not a
    // count, because a count invites the reader to act on it.
    t1Answerable: fieldReport ? instrumentFailed.length === 0 : null,
    t1InstrumentState: fieldReport ? (out.observations.attribution?.state ?? 'SOUND') : null,
    fieldsPopulated: fieldReport ? populated.length : null,
    fieldsTotal: fieldReport ? fieldReport.length : null,
    fieldsUndetermined: fieldReport ? undetermined.length : null,
    fieldsInstrumentFailed: fieldReport ? instrumentFailed.length : null,
    allSevenPopulated: fieldReport && instrumentFailed.length === 0
      ? populated.length === INTAKE_CUSTOM_FIELDS.length
      : null,
    attendeeAttached: out.observations.entry
      ? (out.observations.entry.attendeeCount ?? 0) > 0
      : null,
    // THE MEETING SIGNAL. `locationPresent` sits below it as information; it is not
    // the signal and an empty one is not a failure.
    meetingMinted: out.observations.entry ? out.observations.entry.joinUrlPresent : null,
    locationPresent: out.observations.entry ? out.observations.entry.locationPresent : null,
    leakState: leak.state,
    shaMatches: shaResult.ok ? shaResult.sha === expectedSha : false,
  };

  emit('');
  emit('── T1 the seven Intake fields on the contact ─────────────────────────');
  if (!fieldReport) {
    emit('  NOT RUN — no --contact was supplied.');
  } else if (instrumentFailed.length) {
    // ONE ANSWER, SAID ONCE. Seven rows each carrying the same instrument fault read
    // as seven findings about seven fields; they are one finding about this run.
    emit(`  T1 NOT ANSWERED — ${out.observations.attribution.state}`);
    emit(`  ${out.observations.attribution.why}`);
    emit('  No field below has a verdict, and none of them is "absent": the values may');
    emit('  be sitting on this contact exactly as the booking wrote them.');
    for (const r of fieldReport) {
      emit(`  ${r.key.padEnd(16)} ${r.state.padEnd(18)} —`);
    }
  } else {
    for (const r of fieldReport) {
      const shown = r.state === 'POPULATED' ? JSON.stringify(r.value)
                  : r.state === 'PRESENT_BUT_EMPTY' ? '"" (present, unset)'
                  : '—';
      emit(`  ${r.key.padEnd(16)} ${r.state.padEnd(18)} ${shown}`);
      if (r.why) emit(`  ${' '.repeat(16)} ${r.why}`);
    }
    emit(`  ${populated.length} of ${fieldReport.length} populated`
      + (undetermined.length ? `, ${undetermined.length} UNDETERMINED` : ''));
  }

  emit('');
  emit('── verdict ───────────────────────────────────────────────────────────');
  emit(`T1 intake on the contact   : ${
    !fieldReport ? 'NOT RUN'
    : instrumentFailed.length ? `NOT ANSWERED — ${out.observations.attribution.state}`
    : `${populated.length}/${fieldReport.length} populated`}`);
  emit(`T2 attendee attached       : ${out.verdict.attendeeAttached === null ? 'NOT RUN' : (out.verdict.attendeeAttached ? 'YES' : 'NO')}`);
  emit(`T2 meeting minted (join_url): ${out.verdict.meetingMinted === null ? 'NOT RUN / NOT SELECTED' : (out.verdict.meetingMinted ? 'YES' : 'NO')}`);
  emit(`   entry location (info)   : ${out.verdict.locationPresent === null ? 'NOT RUN' : (out.verdict.locationPresent ? 'present' : 'empty — expected for a conference meeting, not a failure')}`);
  emit(`T3 intake on a client surface: ${leak.state}`);
  emit(`T4 ${DESCRIPTION_FN_NAME} sha : ${out.verdict.shaMatches ? 'MATCHES' : 'DIFFERS'}`);

  return finish();

  // ── the ledger, the redaction report ──────────────────────────────────────
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
    if (out.requests.length === 0) {
      emit('  (empty — this run issued no requests at all)');
    }
    for (const r of out.requests) {
      const status = r.error ? r.error.toUpperCase() : (r.status === null ? '—' : String(r.status));
      emit(`  ${String(r.seq).padStart(2)}  ${r.method.padEnd(4)} ${status.padEnd(10)} ${r.origin || '(unparseable)'}${r.pathname}`);
    }
    emit(`  methods: ${JSON.stringify(out.requestLedger.methods)}`);
    emit(`  origins: ${JSON.stringify(out.requestLedger.origins)}`);

    // THE READ-ONLY ASSERTION. Stated by the run itself, so a live transcript
    // carries its own proof and a reader is not asked to trust the header.
    const tokenUrl = new URL(CLIO_TOKEN_URL);
    const readOnly = nonGet.length <= 1
                  && nonGet.every((r) => `${r.origin}${r.pathname}` === `${tokenUrl.origin}${tokenUrl.pathname}`)
                  && oauth.length === nonGet.length
                  && offClio.length === 0;
    step('READ ONLY — every /api/v4 request is a GET, the only non-GET is the token mint, and nothing left app.clio.com', readOnly);
    if (!readOnly) {
      emit(`      ${JSON.stringify({ nonGet: out.requestLedger.nonGet, offClio: out.requestLedger.offClioCalls })}`);
      blocker('the run issued a request outside the read-only contract');
      raise(EXIT_NOT_READ_ONLY);
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
      raise(EXIT_BACKSTOP_HIT);
    }
    if (redactor.unscrubbable.length) {
      emit(`NOTE  the backstop is OFF for ${redactor.unscrubbable.join(', ')} — value shorter than ${MIN_REDACTABLE_LEN} chars.`);
    }

    out.finishedAt = isoAt(nowMs);
    return out;
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
//
// Extracted and exported, because an inline CLI is an untested CLI and the flag
// handling is the part of this file that touches the operator's disk.

/**
 * `--name=value`, last occurrence wins.
 *
 * `--name` with no `=` is NOT this flag: it is returned as `undefined` (the
 * fallback) rather than as an empty string, so `--evidence` on its own falls back
 * to the default path instead of resolving to `''`. `--name=` with an explicit
 * empty value IS a value, and is refused downstream by name.
 */
export function parseCliArgs(argv = []) {
  const arg = (name) => {
    const prefix = `--${name}=`;
    let found;
    for (const a of argv) if (a.startsWith(prefix)) found = a.slice(prefix.length);
    return found;
  };

  const expectShaRaw = arg('expect-sha');

  return {
    contactRaw: arg('contact'),
    entryRaw: arg('entry'),
    evidenceRaw: arg('evidence'),
    expectShaRaw,
    expectedSha: expectShaRaw === undefined ? EXPECTED_DESCRIPTION_SHA : String(expectShaRaw).trim(),
    shaOverridden: expectShaRaw !== undefined,
  };
}

// The evidence file is only safe to write because git refuses to track it. That
// refusal is one line in .gitignore:
//
//     test/preview/clio-writepath-evidence*.json
//
// It matters more here than it did for the paging probe: that file held response
// SHAPES, this one holds the client's intake ANSWERS, their name and their email.
//
// `--evidence=<path>` would otherwise be an unbounded write primitive pointed at
// whatever the operator typed, running in the one shell session that has the live
// Clio credentials exported. `--evidence=.dev.vars` would overwrite the local
// credential file with this run's output; `--evidence=donovan-legal-site/index.html`
// would overwrite a page of the live site. Neither is hypothetical — both are a
// single tab-completion away.
export const EVIDENCE_DIR_SEGMENTS = ['test', 'preview'];
export const EVIDENCE_BASENAME_GLOB = 'clio-writepath-evidence*.json';
export const DEFAULT_EVIDENCE_BASENAME = 'clio-writepath-evidence.json';

// The glob, as a regex. Case SENSITIVE on purpose. git's own matching is
// case-insensitive when core.ignorecase is true (the Windows default), so this is
// the stricter of the two — and strict is the safe direction. Refusing a name git
// would have ignored costs the operator a retype; accepting one git would TRACK
// puts a client's finances into a commit.
const EVIDENCE_BASENAME_RE = /^clio-writepath-evidence[^\\/]*\.json$/;

export const EVIDENCE_REFUSALS = {
  EMPTY:              'the --evidence value is empty',
  NOT_IN_PREVIEW_DIR: `the path does not resolve directly inside ${EVIDENCE_DIR_SEGMENTS.join('/')}/`,
  NOT_IGNORED_NAME:   `the filename does not match the gitignored ${EVIDENCE_BASENAME_GLOB}`,
  PROBE_DIR_MOVED:    `the verifier is no longer in ${EVIDENCE_DIR_SEGMENTS.join('/')}/, so the .gitignore rule no longer covers it`,
  SYMLINK:            'the target is a symbolic link — writeFileSync follows one, so the name checked is not the file written',
};

/**
 * Decide where the evidence file may be written, or refuse with a NAMED reason.
 *
 * Three conditions, all of which must hold:
 *
 *   1. the verifier itself still lives in test/preview — otherwise the anchored
 *      .gitignore rule does not cover this directory at all and the whole argument
 *      for writing client data to disk has quietly expired;
 *   2. the resolved path is a file sitting DIRECTLY in that directory — not a
 *      subdirectory, not `..` back out of it, not another drive;
 *   3. its basename matches the gitignored glob.
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
  // when the target is on another drive. A single path segment — no separator, not
  // empty, not starting with `..` — is the only accepted answer.
  const rel = path.relative(moduleDir, resolved);
  if (!rel || rel.startsWith('..') || path.isAbsolute(rel) || rel.split(/[\\/]/).length !== 1) {
    return { ok: false, reason: 'NOT_IN_PREVIEW_DIR', detail: EVIDENCE_REFUSALS.NOT_IN_PREVIEW_DIR, resolved };
  }

  if (!EVIDENCE_BASENAME_RE.test(rel)) {
    return { ok: false, reason: 'NOT_IGNORED_NAME', detail: EVIDENCE_REFUSALS.NOT_IGNORED_NAME, resolved };
  }

  // Every check above is on the NAME. `writeFileSync` follows a symbolic link, so a
  // link at an allowed name pointing at .dev.vars would satisfy all of them and
  // still overwrite the credential file — the name checked would not be the file
  // written. `lstat` does not follow, which is the point of using it. Missing is
  // fine and is the ordinary case; anything else is refused.
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

if (isDirectInvocation(process.argv[1])) {
  const cli = parseCliArgs(process.argv.slice(2));

  // Refused BEFORE the network, not after. A run that has already minted a token
  // and read the firm's CRM and only then discovers it has nowhere legal to put the
  // answer has spent the credential for nothing.
  const evidence = resolveEvidencePath(cli.evidenceRaw);
  if (!evidence.ok) {
    console.error(`REFUSED  --evidence=${cli.evidenceRaw} — ${evidence.detail}`);
    console.error(`         resolved to: ${evidence.resolved}`);
    console.error(`         allowed:     ${EVIDENCE_DIR_SEGMENTS.join('/')}/${EVIDENCE_BASENAME_GLOB} (the gitignored set)`);
    console.error('         nothing was sent, and nothing was written.');
    process.exit(EXIT_BAD_EVIDENCE_PATH);
  }

  const moduleDir = path.dirname(fileURLToPath(import.meta.url));
  const providerPath = path.resolve(moduleDir, PROVIDER_REL_PATH);

  let providerSource = '';
  try {
    providerSource = readFileSync(providerPath, 'utf8');
  } catch (err) {
    console.error(`could not read ${providerPath}: ${err?.message ?? err}`);
  }

  // The live function's own source, for the cross-check. A failure to import is
  // reported and the cross-check is then simply not performed — it degrades to
  // "hash the file span", which is weaker and is said so rather than assumed.
  let liveDescriptionSource;
  try {
    // pathToFileURL, not the bare path. On win32 `import('C:\\…')` is rejected by
    // the ESM loader — it reads `c:` as an unsupported URL scheme — so the bare
    // form fails on exactly the platform this repo is developed on, and fails by
    // DEGRADING: the cross-check is skipped, the sha still prints, and the run
    // looks clean while the strongest half of the guard never executed.
    const mod = await import(pathToFileURL(providerPath).href);
    liveDescriptionSource = mod?.[DESCRIPTION_FN_NAME]?.toString();
  } catch (err) {
    console.error(`could not import ${providerPath} for the cross-check: ${err?.message ?? err}`);
    console.error('the sha below was computed over the FILE SPAN ONLY — the cross-check did not run.');
  }

  const out = await runWritePathVerify({
    env: process.env,
    contactId: cli.contactRaw,
    entryId: cli.entryRaw,
    expectedSha: cli.expectedSha,
    shaOverridden: cli.shaOverridden,
    providerSource,
    liveDescriptionSource,
  });

  // The evidence file carries the client's intake answers and is GITIGNORED for
  // that reason. Everything in it still passes the redactor: client data is the
  // subject, credentials are never it.
  const redactor = makeRedactor(process.env);
  try {
    writeFileSync(evidence.path, redactor.scrub(JSON.stringify(out, null, 2)) + '\n', 'utf8');
    console.log(`\nevidence: ${evidence.path}  (gitignored — holds the client's intake answers)`);
  } catch (err) {
    console.error(`\ncould not write the evidence file: ${err?.message ?? err}`);
  }

  process.exit(out.exitCode);
}
