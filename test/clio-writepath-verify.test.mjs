// ── SHELDON-CLIO-WRITEPATH-VERIFY-R1 — controls for the verifier ─────────────
//
// The verifier's whole value is that its answer is empirical. That makes the
// INSTRUMENT the thing that has to be proved here, offline, before it is pointed
// at a law firm's live CRM:
//
//   1. it issues GETs and one token mint, and nothing else, on every path
//      INCLUDING the failure paths — the read-only claim must hold when things go
//      wrong, which is when a probe normally starts improvising;
//   2. a contact with none of the seven and a contact with all seven both produce
//      a correct, unambiguous report, and "absent" is never confused with
//      "unreadable";
//   3. the sha comparison FAILS when handed a wrong expectation — a guard that
//      cannot fail is not a guard;
//   4. it refuses a paging cursor by ORIGIN before following it;
//   5. it prints a request ledger on every exit path, including the ones that
//      never reach the network;
//   6. it never records or prints the join URL or the entry location.
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
  runWritePathVerify,
  hashDescriptionFn,
  extractExportedFunction,
  findIntakeLeaks,
  foldSurface,
  attributeRow,
  buildFieldReport,
  parseResourceId,
  moreSevere,
  makeRedactor,
  urlParts,
  isClioApiUrl,
  parseCliArgs,
  resolveEvidencePath,
  isDirectInvocation,
  sha256,
  CLIO_ORIGIN,
  CLIO_BASE,
  CLIO_TOKEN_URL,
  FIELD_PAGE_LIMIT,
  FIELD_MAX_PAGES,
  EXPECTED_DESCRIPTION_SHA,
  EXPECTED_FIELD_KEYS,
  EXPECTED_FIELD_TYPE,
  CONTACT_FIELD_ATTEMPTS,
  PROVIDER_REL_PATH,
  DESCRIPTION_FN_NAME,
  EVIDENCE_BASENAME_GLOB,
  DEFAULT_EVIDENCE_BASENAME,
  EXIT_OK,
  EXIT_NO_CREDENTIALS,
  EXIT_ROTATED,
  EXIT_BACKSTOP_HIT,
  EXIT_NOT_READ_ONLY,
  EXIT_BAD_EVIDENCE_PATH,
  EXIT_SHA_MISMATCH,
  EXIT_BAD_ARGS,
  EXIT_LEAK,
  EXIT_SCOPE_LOST,
  EXIT_NO_ATTRIBUTION,
} from './preview/verify-clio-writepath.mjs';

import { INTAKE_CUSTOM_FIELDS } from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import * as provider from '../donovan-legal-site/functions/booking/_lib/provider-clio.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const PREVIEW_DIR = path.join(HERE, 'preview');
const PROVIDER_PATH = path.resolve(PREVIEW_DIR, PROVIDER_REL_PATH);

const PROVIDER_SOURCE = readFileSync(PROVIDER_PATH, 'utf8');
const LIVE_DESCRIPTION_SOURCE = provider[DESCRIPTION_FN_NAME].toString();

// ── the stub ─────────────────────────────────────────────────────────────────

const ENV = {
  CLIO_CLIENT_ID:     'client-id-0123456789',
  CLIO_CLIENT_SECRET: 'client-secret-0123456789',
  CLIO_REFRESH_TOKEN: 'refresh-token-0123456789',
};

const ACCESS_TOKEN = 'access-token-abcdefghijklmnop';

const CONTACT_ID = 884411;
const ENTRY_ID   = 5566778;

// The ids the account hands back for the seven Intake names. Distinctive and
// nothing like the contact or entry id, so a report that mixed them up is visible.
const FIELD_IDS = {
  matter_category: 9001,
  matter_sub:      9002,
  for_whom:        9003,
  income_band:     9004,
  net_worth_band:  9005,
  language:        9006,
  source:          9007,
};

// The values a real booking would have written. The two bands are the strings the
// leak tests search for, and they are deliberately unlike anything the client-safe
// description contains.
const VALUES = {
  matter_category: 'Estate Planning',
  matter_sub:      'Revocable Trust',
  for_whom:        'Myself and my spouse',
  income_band:     '$250K-$500K',
  net_worth_band:  '$1.5M-$3M',
  language:        'English',
  source:          'Google Search',
};

// A join URL shaped like the one Clio mints. Never expected in any output.
const LOCATION_URL = `${CLIO_ORIGIN}/video_conferences/join/QQQ-secret-join-token-7788`;
const JOIN_URL     = 'https://us02web.zoom.us/j/88899900011?pwd=SECRETPWD9911';

// What buildClientDescription actually produces for a firm-configured meeting.
const CLIENT_DESCRIPTION = provider.buildClientDescription({
  typeName: 'Initial Consultation',
  meetingLink: '',
  firmPhone: '(555) 010-2030',
  firmEmail: 'info@donovan.law',
});

const json = (status, body) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

/**
 * What Clio does with `fields=`: return the named top-level keys and nothing else.
 *
 * The stub HAS to do this or the "requested vs absent" tests are meaningless — a
 * stub that hands back every key regardless of the selection makes a floor
 * selection indistinguishable from the rich one, and the verifier's UNKNOWN branch
 * would be unreachable while still looking tested.
 */
const project = (record, fields) => {
  const wanted = new Set(String(fields).split(',').map((s) => s.split('{')[0].trim()).filter(Boolean));
  if (!wanted.size) return record;
  return Object.fromEntries(Object.entries(record).filter(([k]) => wanted.has(k)));
};

/**
 * What Clio does INSIDE `custom_field_values{…}` — and the stub has to do it, or
 * the whole ladder is untestable.
 *
 * R1's stub handed back every sub-key regardless of the sub-selection. That made the
 * plain rung indistinguishable from the attributing one, so the suite was green on a
 * verifier that could not attribute a single row against the live API. A stub that
 * is more generous than the vendor turns the defect into the thing it cannot see.
 *
 *   no sub-selection            → id and value only. This is what came back on
 *                                 2026-08-04: twelve rows, nothing to attribute with.
 *   {…field_name…}              → the name, which is the live attribution route.
 *   {…custom_field…}            → ACCEPTED, and useless: the wrapper arrives with no
 *                                 usable id. Modelled as `{}` rather than assumed away.
 */
const projectRows = (rows, fields) => {
  const m = /custom_field_values\{([^}]*)\}/.exec(String(fields));
  if (!m) return rows.map((r) => ({ id: r.id, value: r.value }));
  const wanted = m[1].split(',').map((s) => s.trim()).filter(Boolean);
  return rows.map((r) => {
    const o = {};
    for (const k of wanted) {
      if (k === 'custom_field') { if (r.custom_field) o.custom_field = {}; continue; }
      if (k in r) o[k] = r[k];
    }
    return o;
  });
};

/** A CustomFieldValue row as Clio returns one on a contact. */
const valueRow = (key, value, { withCustomField = true, withFieldName = true } = {}) => {
  const decl = INTAKE_CUSTOM_FIELDS.find((f) => f.key === key);
  return {
    id: `text_line-${FIELD_IDS[key]}`,
    value,
    ...(withFieldName ? { field_name: decl.name, field_type: decl.type } : {}),
    ...(withCustomField ? { custom_field: { id: FIELD_IDS[key], name: decl.name } } : {}),
  };
};

/**
 * @param {object} plan
 * @param {string[]|undefined} plan.presentKeys  which of the seven the ACCOUNT has
 * @param {object|undefined}   plan.wrongTypes   key → field_type to return instead
 * @param {Array|undefined}    plan.contactRows  rows on the contact (default: none)
 * @param {number|undefined}   plan.fieldsStatus non-200 for GET /custom_fields
 * @param {number|undefined}   plan.contactStatus non-200 for GET /contacts/{id}
 * @param {number|undefined}   plan.entryStatus  non-200 for GET /calendar_entries/{id}
 * @param {boolean|undefined}  plan.rejectNested 400 the nested `fields` selections
 * @param {boolean|undefined}  plan.rejectAttributing 400 every rung that asks for
 *                                                    field_name — drives the run
 *                                                    onto a rung that cannot attribute
 * @param {object|undefined}   plan.entry        overrides merged into the entry record
 * @param {string|undefined}   plan.fieldsNext   a cursor to serve on page 1
 */
function makeStub(plan = {}) {
  const calls = [];
  let fieldPages = 0;

  const fetchImpl = async (url, init) => {
    const u = String(url);
    // `redirect` is recorded because the controls assert on the OPTION the
    // transport set, not only on the outcome. A stub cannot honour
    // `redirect: 'error'` — there is no redirect to refuse — so the option's
    // presence has to be witnessed directly or the fix could be deleted with the
    // suite still green.
    calls.push({ method: init?.method, url: u, redirect: init?.redirect, body: init?.body ?? null });

    if (u === CLIO_TOKEN_URL) {
      if (plan.mintStatus && plan.mintStatus !== 200) return json(plan.mintStatus, {});
      return json(200, {
        access_token: ACCESS_TOKEN,
        refresh_token: plan.rotateTo ?? ENV.CLIO_REFRESH_TOKEN,
      });
    }

    if (u.startsWith(`${CLIO_BASE}/custom_fields`)) {
      if (plan.fieldsStatus) return json(plan.fieldsStatus, {});
      fieldPages += 1;
      const present = plan.presentKeys ?? Object.keys(FIELD_IDS);
      const data = present.map((key) => {
        const decl = INTAKE_CUSTOM_FIELDS.find((f) => f.key === key);
        return {
          id: FIELD_IDS[key],
          name: decl.name,
          field_type: plan.wrongTypes?.[key] ?? decl.type,
        };
      });
      // A cursor is served on page one only, so a walk terminates.
      const next = fieldPages === 1 ? plan.fieldsNext : undefined;
      return json(200, { data, ...(next ? { meta: { paging: { next } } } : {}) });
    }

    if (u.startsWith(`${CLIO_BASE}/contacts/`)) {
      if (plan.contactStatus) return json(plan.contactStatus, {});
      const fields = new URL(u).searchParams.get('fields') ?? '';
      // SECOND-LEVEL NESTING IS A 400, ALWAYS. Clio's selector grammar does not go
      // two levels deep, so a `custom_field{…}` inside `custom_field_values{…}` can
      // never succeed. The stub refuses it unconditionally: re-adding that arm to
      // the ladder reds this suite instead of costing another live run.
      if (/custom_field\{/.test(fields.split('custom_field_values').join(''))) return json(400, {});
      if (plan.rejectNested && fields.includes('{')) return json(400, {});
      if (plan.rejectAttributing && /field_name/.test(fields)) return json(400, {});
      return json(200, {
        data: project({
          id: CONTACT_ID,
          name: 'Casey Rivera',
          custom_field_values: projectRows(plan.contactRows ?? [], fields),
        }, fields),
      });
    }

    if (u.startsWith(`${CLIO_BASE}/calendar_entries/`)) {
      if (plan.entryStatus) return json(plan.entryStatus, {});
      const fields = new URL(u).searchParams.get('fields') ?? '';
      if (plan.rejectNested && fields.includes('{')) return json(400, {});
      // Drives the run down to a selection that does not name the key at all, so
      // the "requested vs absent" distinction can be exercised.
      if (plan.rejectConference && fields.includes('conference_meeting')) return json(400, {});
      if (plan.rejectAttendees && fields.includes('attendees')) return json(400, {});
      return json(200, {
        data: project({
          id: ENTRY_ID,
          summary: 'Casey Rivera — consult',
          description: CLIENT_DESCRIPTION,
          location: LOCATION_URL,
          start_at: '2026-08-06T14:00:00-04:00',
          end_at:   '2026-08-06T15:00:00-04:00',
          attendees: [{ id: CONTACT_ID, type: 'Contact', name: 'Casey Rivera', email: 'casey@example.test' }],
          conference_meeting: { id: 771, type: 'zoom', join_url: JOIN_URL },
          ...(plan.entry ?? {}),
        }, fields),
      });
    }

    // FAIL CLOSED. Anything unrecognised is a defect, not a pass-through.
    throw new Error(`clio-writepath stub: unmodelled request ${init?.method} ${u}`);
  };

  return { fetchImpl, calls };
}

const silent = () => {};

const run = (plan = {}, over = {}) => {
  const stub = makeStub(plan);
  const lines = [];
  const errLines = [];
  return runWritePathVerify({
    env: ENV,
    fetchImpl: stub.fetchImpl,
    contactId: CONTACT_ID,
    entryId: ENTRY_ID,
    providerSource: PROVIDER_SOURCE,
    liveDescriptionSource: LIVE_DESCRIPTION_SOURCE,
    nowMs: Date.parse('2026-08-04T12:00:00Z'),
    log: (l) => lines.push(String(l)),
    logErr: (l) => errLines.push(String(l)),
    ...over,
  }).then((out) => ({ out, calls: stub.calls, lines, errLines, all: [...lines, ...errLines].join('\n') }));
};

const ALL_SEVEN_ROWS = Object.keys(VALUES).map((k) => valueRow(k, VALUES[k]));
const fieldRow = (out, key) => out.observations.fields.find((f) => f.key === key);

// ── 1. READ ONLY, on every path ──────────────────────────────────────────────

test('a clean run issues exactly one non-GET and it is the token mint', async () => {
  const { out, calls } = await run({ contactRows: ALL_SEVEN_ROWS });

  const nonGet = calls.filter((c) => c.method !== 'GET');
  assert.equal(nonGet.length, 1);
  assert.equal(nonGet[0].method, 'POST');
  assert.equal(nonGet[0].url, CLIO_TOKEN_URL);
  assert.equal(out.requestLedger.oauthCalls, 1);
  assert.deepEqual(out.requestLedger.offClioCalls, []);
});

test('no request is a POST, PATCH, PUT or DELETE against /api/v4', async () => {
  const { calls } = await run({ contactRows: ALL_SEVEN_ROWS });
  const apiWrites = calls.filter((c) => isClioApiUrl(c.url) && c.method !== 'GET');
  assert.deepEqual(apiWrites, []);
});

test('the READ ONLY step is asserted by the run itself and passes', async () => {
  const { out } = await run({ contactRows: ALL_SEVEN_ROWS });
  const s = out.steps.find((x) => x.name.startsWith('READ ONLY'));
  assert.ok(s, 'the run must state the read-only claim');
  assert.equal(s.ok, true);
});

test('the failure paths are read-only too', async () => {
  for (const plan of [
    { fieldsStatus: 500 },
    { fieldsStatus: 403 },
    { contactStatus: 404 },
    { contactStatus: 403 },
    { entryStatus: 404 },
    { mintStatus: 400 },
    { rejectNested: true, contactRows: ALL_SEVEN_ROWS },
  ]) {
    const { out, calls } = await run(plan);
    const apiWrites = calls.filter((c) => isClioApiUrl(c.url) && c.method !== 'GET');
    assert.deepEqual(apiWrites, [], `plan ${JSON.stringify(plan)} issued an /api/v4 write`);
    assert.ok(out.requestLedger, 'every path must produce a ledger');
    assert.deepEqual(out.requestLedger.offClioCalls, []);
  }
});

test('every request carries redirect:error, and it sits after the caller spread', async () => {
  const { calls } = await run({ contactRows: ALL_SEVEN_ROWS });
  assert.ok(calls.length >= 4, 'the clean run should reach the network');
  for (const c of calls) {
    assert.equal(c.redirect, 'error', `${c.method} ${c.url} did not set redirect:error`);
  }
});

test('the token mint is a refresh, never an authorisation-code exchange', async () => {
  const { calls } = await run({ contactRows: ALL_SEVEN_ROWS });
  const mint = calls.find((c) => c.url === CLIO_TOKEN_URL);
  const body = new URLSearchParams(String(mint.body));
  assert.equal(body.get('grant_type'), 'refresh_token');
  assert.equal(body.get('code'), null, 'an authorisation code would mint a NEW refresh token and kill the live one');
});

// ── 2. THE LEDGER IS PRINTED ON EVERY EXIT PATH ──────────────────────────────

test('a run with no credentials prints an EMPTY ledger rather than no ledger', async () => {
  const { out, calls, all } = await run({}, { env: {} });
  assert.equal(out.exitCode, EXIT_NO_CREDENTIALS);
  assert.deepEqual(calls, [], 'no credentials must mean no network');
  // The positive arm: the claim "no requests were issued" is made by the same code
  // that would have printed a full ledger.
  // See [[feedback_zero_request_assertion_needs_a_positive_arm]].
  assert.ok(out.requestLedger, 'the ledger object must exist');
  assert.equal(out.requestLedger.total, 0);
  assert.match(all, /request ledger/);
  assert.match(all, /\(empty — this run issued no requests at all\)/);
});

test('a run with no ids at all still prints a ledger and still answers T4', async () => {
  const { out, all } = await run({}, { contactId: undefined, entryId: undefined });
  assert.ok(out.requestLedger);
  assert.equal(out.requestLedger.total, 0);
  assert.match(all, /request ledger/);
  assert.equal(out.observations.descriptionSha.sha, EXPECTED_DESCRIPTION_SHA);
});

test('a refused id argument never reaches the network and still prints a ledger', async () => {
  const { out, calls, all } = await run({}, { contactId: '12; DROP', entryId: undefined });
  assert.equal(out.exitCode, EXIT_BAD_ARGS);
  assert.deepEqual(calls, []);
  assert.match(all, /request ledger/);
});

// ── 3. TASK 1 — the contact report, both ends of the range ───────────────────

test('a contact with all seven populated reports all seven, with their values', async () => {
  const { out } = await run({ contactRows: ALL_SEVEN_ROWS });

  assert.equal(out.observations.fields.length, 7);
  for (const key of EXPECTED_FIELD_KEYS) {
    const row = fieldRow(out, key);
    assert.equal(row.state, 'POPULATED', `${key} should be POPULATED`);
    assert.equal(row.value, VALUES[key], `${key} value`);
    // BY_NAME, not BY_ID — and that is the live shape, not a weakening. The only
    // selection that would yield `custom_field.id` needs second-level nesting, which
    // Clio 400s, so `field_name` is the route a real run takes.
    assert.equal(row.matchedBy, 'BY_NAME');
    assert.equal(row.fieldId, FIELD_IDS[key]);
  }
  assert.equal(out.verdict.fieldsPopulated, 7);
  assert.equal(out.verdict.allSevenPopulated, true);
  assert.equal(out.verdict.fieldsUndetermined, 0);
  assert.equal(out.verdict.fieldsInstrumentFailed, 0);
  assert.equal(out.verdict.t1Answerable, true);
  assert.equal(out.exitCode, EXIT_OK);
});

test('a contact with NO intake fields reports seven ABSENT — not empty, not unknown', async () => {
  const { out, all } = await run({ contactRows: [] });

  assert.equal(out.observations.fields.length, 7);
  for (const key of EXPECTED_FIELD_KEYS) {
    const row = fieldRow(out, key);
    assert.equal(row.state, 'ABSENT', `${key} should be ABSENT`);
    assert.equal(row.value, null);
  }
  assert.equal(out.verdict.fieldsPopulated, 0);
  assert.equal(out.verdict.allSevenPopulated, false);
  assert.equal(out.verdict.fieldsUndetermined, 0);
  // Unambiguous: every field is named with a definite state, and the report says
  // so in a line a human reads.
  assert.match(all, /0 of 7 populated/);
});

test('ABSENT and UNRESOLVED are different answers and are not conflated', async () => {
  // The account only holds four of the seven names.
  const { out } = await run({
    presentKeys: ['matter_category', 'matter_sub', 'for_whom', 'language'],
    contactRows: [valueRow('matter_category', VALUES.matter_category)],
  });

  assert.equal(fieldRow(out, 'matter_category').state, 'POPULATED');
  assert.equal(fieldRow(out, 'matter_sub').state, 'ABSENT');       // on the account, not on the contact
  assert.equal(fieldRow(out, 'income_band').state, 'UNRESOLVED');  // not on the account at all
  assert.equal(fieldRow(out, 'net_worth_band').state, 'UNRESOLVED');
});

test('a present-but-empty value is not reported as populated', async () => {
  const { out } = await run({ contactRows: [valueRow('income_band', '')] });
  assert.equal(fieldRow(out, 'income_band').state, 'PRESENT_BUT_EMPTY');
  assert.equal(out.verdict.fieldsPopulated, 0);
});

test('a field whose account type is wrong is REFUSED_ON_TYPE, matching the write path', async () => {
  // clio-custom-fields.js refuses to bind a name whose field_type is not the type
  // its entry declares, so an empty value here is expected, not a booking bug.
  const { out } = await run({ wrongTypes: { net_worth_band: 'currency' }, contactRows: [] });
  const row = fieldRow(out, 'net_worth_band');
  assert.equal(row.state, 'REFUSED_ON_TYPE');
  assert.equal(row.observedType, 'currency');
  assert.equal(fieldRow(out, 'income_band').state, 'ABSENT');
});

test('a row that cannot be attributed is an INSTRUMENT failure, not seven field findings', async () => {
  // THE R1 DEFECT, in its second form. A row carrying neither custom_field.id nor
  // field_name rules nothing in and nothing OUT — including for the six fields it is
  // not. R1 rendered that as seven UNDETERMINED rows, which reads as seven
  // considered per-field answers; it is one answer, and it is about this run.
  const { out, all } = await run({
    contactRows: [{ id: 'text_line-1', value: 'something' }],
  });
  for (const key of EXPECTED_FIELD_KEYS) {
    const row = fieldRow(out, key);
    assert.equal(row.state, 'INSTRUMENT_FAILED', `${key}`);
    assert.equal(row.instrumentState, 'ROWS_NOT_ATTRIBUTABLE');
    assert.equal(row.value, null);
  }
  assert.equal(out.verdict.fieldsInstrumentFailed, 7);
  assert.equal(out.verdict.fieldsUndetermined, 0, 'not UNDETERMINED — that is a per-field judgement');
  assert.equal(out.verdict.t1Answerable, false);
  assert.equal(out.verdict.allSevenPopulated, null, 'no populated claim may be made from an unattributable read');
  assert.equal(out.observations.contactRows.unattributable, 1);
  assert.equal(out.observations.attribution.state, 'ROWS_NOT_ATTRIBUTABLE');
  assert.equal(out.exitCode, EXIT_NO_ATTRIBUTION, 'exit 0 means the instrument was sound, and it was not');
  // …and it is said once, in words, rather than seven times as a field state.
  assert.match(all, /T1 NOT ANSWERED — ROWS_NOT_ATTRIBUTABLE/);
  assert.ok(!/ABSENT/.test(all), 'nothing may be reported absent off a read that could attribute nothing');
});

test('a row matched by field_name alone still reports the value, and says how it matched', async () => {
  const { out } = await run({
    contactRows: [valueRow('language', VALUES.language, { withCustomField: false })],
  });
  const row = fieldRow(out, 'language');
  assert.equal(row.state, 'POPULATED');
  assert.equal(row.value, VALUES.language);
  assert.equal(row.matchedBy, 'BY_NAME');
});

test('another firm custom field on the contact is counted as foreign, not as ours', async () => {
  const { out } = await run({
    contactRows: [
      { id: 'text_line-42', value: 'not ours', field_name: 'Referral Bonus', custom_field: { id: 4242 } },
      valueRow('source', VALUES.source),
    ],
  });
  assert.equal(out.observations.contactRows.foreign, 1);
  assert.equal(out.observations.contactRows.unattributable, 0);
  assert.equal(fieldRow(out, 'source').state, 'POPULATED');
});

// ── 3b. THE `fields=` LADDER — attribution first, and no arm that cannot work ──

test('an ATTRIBUTING selection is tried first, and it is the one that answers', async () => {
  // The R1 order was by richness, which put a selection Clio 400s at the top and a
  // selection that attributes nothing right behind it. The sort key is attribution.
  assert.equal(CONTACT_FIELD_ATTEMPTS[0].attributes, true);
  assert.equal(CONTACT_FIELD_ATTEMPTS[1].attributes, true);
  assert.ok(CONTACT_FIELD_ATTEMPTS.some((a) => a.attributes === false),
    'the non-attributing rungs are kept, so "tried first" is a real ordering claim');
  const firstNonAttributing = CONTACT_FIELD_ATTEMPTS.findIndex((a) => !a.attributes);
  const lastAttributing = CONTACT_FIELD_ATTEMPTS.map((a) => a.attributes).lastIndexOf(true);
  assert.ok(lastAttributing < firstNonAttributing,
    'every attributing rung must sit above every non-attributing one');
  for (const a of CONTACT_FIELD_ATTEMPTS) {
    assert.equal(a.attributes, /field_name/.test(a.fields),
      `${a.fields}: a rung attributes if and only if it asks for field_name`);
  }

  // …and on the wire: the first contact request is the attributing one, it wins, and
  // nothing plainer is ever sent.
  const { out, calls } = await run({ contactRows: ALL_SEVEN_ROWS });
  const contactCalls = calls.filter((c) => c.url.includes('/contacts/'));
  assert.equal(contactCalls.length, 1, 'the first rung answered, so no fallback should have been sent');
  assert.ok(decodeURIComponent(contactCalls[0].url).includes('field_name'),
    'the first attempt must ask for field_name');
  assert.equal(out.observations.contactAttempts[0].attributes, true);
  assert.equal(out.observations.contactAttempts[0].ok, true);
  assert.equal(out.observations.attribution.state, 'SOUND');
  assert.equal(out.steps.find((s) => s.name.startsWith('T1 the winning selection can attribute')).ok, true);
});

test('the second-level nesting arm is gone from the ladder and from the wire', async () => {
  // `custom_field_values{…custom_field{id}}` is a 400 on the live API — the grammar
  // does not go two levels deep, so that arm can never succeed. It cost a live run.
  for (const a of CONTACT_FIELD_ATTEMPTS) {
    assert.ok(!/custom_field\{/.test(a.fields.split('custom_field_values').join('')),
      `${a.fields} spells a second-level custom_field selection`);
  }
  const { calls } = await run({ contactRows: ALL_SEVEN_ROWS, rejectNested: true });
  for (const c of calls) {
    const decoded = decodeURIComponent(c.url).split('custom_field_values').join('');
    assert.ok(!/custom_field\{/.test(decoded), `a request carried second-level nesting: ${c.url}`);
  }
});

test('no executable line of the verifier spells the nesting Clio rejects', () => {
  // Source, not behaviour, on purpose: the arm has to be un-re-addable, and the
  // prose that explains WHY it is gone must not be what keeps this green. Comment
  // lines are stripped first, and the one in the ladder note is spaced so it cannot
  // pass for the real thing.
  const src = readFileSync(path.join(PREVIEW_DIR, 'verify-clio-writepath.mjs'), 'utf8');
  const code = src.split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n')
    .split('custom_field_values').join('');
  assert.ok(!/custom_field\{/.test(code),
    'an executable line spells custom_field{ — Clio 400s that selection, always');
});

test('when every attributing rung 400s, the plain rung answers and T1 does NOT', async () => {
  // The exact live shape: a 400 on the richer selection, a 200 on the plain one, and
  // twelve rows nothing can be tied to. R1 called this seven UNDETERMINED fields.
  const { out, all, calls } = await run({ rejectAttributing: true, contactRows: ALL_SEVEN_ROWS });

  const contactCalls = calls.filter((c) => c.url.includes('/contacts/'));
  assert.ok(contactCalls.length >= 3, 'both attributing rungs must be attempted before a plainer one');
  assert.equal(out.observations.contactAttempts[0].ok, false);
  assert.equal(out.observations.contactAttempts[0].status, 400);

  const winner = out.observations.contactAttempts.find((a) => a.ok);
  assert.ok(winner, 'a fallback must have answered');
  assert.equal(winner.attributes, false, 'this test is only meaningful if a non-attributing rung won');

  // The read SUCCEEDED and the rows are there…
  assert.ok(out.observations.contactRows.total > 0, 'the contact came back with rows');
  // …and not one field gets a verdict off them.
  for (const key of EXPECTED_FIELD_KEYS) {
    const row = fieldRow(out, key);
    assert.equal(row.state, 'INSTRUMENT_FAILED', key);
    assert.equal(row.instrumentState, 'NON_ATTRIBUTING_SELECTION');
  }
  assert.equal(out.verdict.t1Answerable, false);
  assert.equal(out.verdict.fieldsUndetermined, 0);
  assert.equal(out.verdict.fieldsPopulated, 0);
  assert.equal(out.exitCode, EXIT_NO_ATTRIBUTION);
  assert.equal(out.steps.find((s) => s.name.startsWith('T1 the winning selection can attribute')).ok, false);
  assert.match(all, /T1 NOT ANSWERED — NON_ATTRIBUTING_SELECTION/);
  assert.ok(!/ABSENT/.test(all), 'a rung that attributes nothing must not produce an absence');
  assert.ok(out.blockers.some((b) => b.includes('T1 COULD NOT BE ANSWERED')));
});

test('no rung asks for the client\'s name — the evidence file holds enough already', () => {
  // Nothing in the report uses it. `field_name` is a SUB-key and is required; the
  // top-level `name` is the client's, and asking for it puts one more piece of them
  // into a file that already carries their finances.
  const topLevel = (fields) => fields.replace(/\{[^}]*\}/g, '').split(',').map((s) => s.trim());
  for (const a of CONTACT_FIELD_ATTEMPTS) {
    assert.ok(!topLevel(a.fields).includes('name'), `${a.fields} asks for the contact's name`);
  }
});

// ── 4. TASK 2 — attendee and location ────────────────────────────────────────

test('an entry with a Contact attendee reports the attendee, and matches it to --contact', async () => {
  const { out } = await run({ contactRows: ALL_SEVEN_ROWS });
  assert.equal(out.observations.entry.attendeeCount, 1);
  assert.equal(out.observations.entry.contactAttendeeCount, 1);
  assert.equal(out.observations.entry.attendeeMatchesGivenContact, true);
  assert.equal(out.verdict.attendeeAttached, true);
  assert.equal(out.steps.find((s) => s.name.startsWith('T2 an attendee is attached')).ok, true);
});

test('an entry with ZERO attendees fails the attendee step — that is the original root cause', async () => {
  // `contact_id` is silently discarded by Clio as an unrecognised key: no error,
  // no attendee, no confirmation email. A 200 proves nothing; the attendee does.
  const { out } = await run({ entry: { attendees: [] } });
  assert.equal(out.observations.entry.attendeeCount, 0);
  assert.equal(out.verdict.attendeeAttached, false);
  const s = out.steps.find((x) => x.name.startsWith('T2 an attendee is attached'));
  assert.equal(s.ok, false);
  assert.match(s.detail, /ZERO attendees/);
});

test('a Calendar-only attendee is not a client attendee', async () => {
  const { out } = await run({ entry: { attendees: [{ id: 5, type: 'Calendar', name: 'Paul Donovan' }] } });
  const s = out.steps.find((x) => x.name.startsWith('T2 an attendee is attached'));
  assert.equal(s.ok, false);
  assert.match(s.detail, /none of type Contact/);
});

test('an entry with a location reports its presence and shape, never its value', async () => {
  const { out } = await run({});
  const e = out.observations.entry;
  assert.equal(e.locationPresent, true);
  assert.equal(e.locationIsClioWrapper, true);
  assert.equal(e.locationHost, CLIO_ORIGIN);
  assert.equal(e.locationLength, LOCATION_URL.length);
  assert.equal(out.verdict.locationPresent, true);
});

test('AN EMPTY LOCATION WITH A JOIN URL IS A WORKING BOOKING, and passes', async () => {
  // THE R1 DEFECT. It asserted a location and called an empty one "no meeting was
  // minted" — while, on the same entry, reporting a conference meeting WITH a
  // join_url. Both cannot be true. Clio does not populate `location` for a
  // conference meeting; it stores the association and signs a per-recipient URL at
  // send time (proven on a UI-created meeting: the API read location back empty
  // while the emailed .ics carried a populated LOCATION header). The location
  // assertion was a permanent false negative on every working booking.
  const { out, all } = await run({ entry: { location: '' } });

  const e = out.observations.entry;
  assert.equal(e.locationSelected, true);
  assert.equal(e.locationPresent, false);
  assert.equal(e.joinUrlPresent, true);

  const meeting = out.steps.find((x) => x.name.startsWith('T2 a meeting was minted'));
  assert.equal(meeting.ok, true, 'a join_url is a minted meeting, whatever location says');
  assert.equal(out.verdict.meetingMinted, true);

  // Location is information. It is neither a passing nor a failing step.
  assert.ok(!out.steps.some((s) => /location/i.test(s.name)),
    'location must not be a step — a step is a verdict, and this one was wrong');
  assert.match(all, /INFO {2}T2 entry location/);
  assert.match(all, /expected: Clio does not populate location/);
  // …and no step anywhere failed on account of it.
  assert.ok(!out.steps.some((s) => !s.ok && /location/i.test(s.detail ?? '')));
});

test('no join_url is a FAILED meeting signal, so the signal is not inert', async () => {
  const { out } = await run({ entry: { conference_meeting: null, location: '' } });
  const meeting = out.steps.find((x) => x.name.startsWith('T2 a meeting was minted'));
  assert.equal(meeting.ok, false);
  assert.match(meeting.detail, /conference_meeting is null/);
  assert.equal(out.verdict.meetingMinted, false);
});

test('a conference meeting with no join_url in it is also a failed signal', async () => {
  const { out } = await run({ entry: { conference_meeting: { id: 771, type: 'zoom' } } });
  const meeting = out.steps.find((x) => x.name.startsWith('T2 a meeting was minted'));
  assert.equal(meeting.ok, false);
  assert.match(meeting.detail, /NO join_url/);
  assert.equal(out.verdict.meetingMinted, false);
});

test('a selection that never asked for conference_meeting reports NOT CHECKED, not absent', async () => {
  // Drive the run down to the FLOOR selection, which does not name
  // conference_meeting at all. A key that was never requested cannot be reported
  // absent — that is a refused-list-proves-absence error, and it would read here as
  // "Clio minted no meeting" for an entry that has one.
  // See [[feedback_refused_list_cannot_prove_absence]].
  const { out } = await run({ rejectConference: true });
  const e = out.observations.entry;
  assert.equal(e.conferenceSelected, false, 'the floor selection must be the winner for this test to mean anything');
  assert.equal(e.conferencePresent, null, 'UNKNOWN, not false');
  assert.equal(e.joinUrlPresent, null);
  // The step EXISTS and says it did not run. An absent step reads exactly like a
  // passing one. See [[feedback_dead_stub_option_degrades_to_happy_path]].
  const meeting = out.steps.find((s) => s.name.startsWith('T2 a meeting was minted'));
  assert.ok(meeting, 'the meeting question must be visible even when it could not be asked');
  assert.equal(meeting.ok, false);
  assert.match(meeting.detail, /NOT CHECKED/);
  assert.match(meeting.detail, /UNKNOWN, not absent/);
  assert.equal(out.verdict.meetingMinted, null, 'never rounded to NO');
  // …and location, which IS in every selection, is still reported as information.
  assert.equal(e.locationSelected, true);
  assert.equal(e.locationPresent, true);
});

test('an attendees selection that never ran reports UNKNOWN rather than "no attendee"', async () => {
  const { out } = await run({ rejectAttendees: true });
  const s = out.steps.find((x) => x.name.startsWith('T2 an attendee is attached'));
  assert.equal(s.ok, false);
  assert.match(s.detail, /UNKNOWN, not absent/);
  assert.equal(out.observations.entry.attendeeCount, null);
});

test('a cross-check that could not run is reported as NOT CHECKED, not skipped silently', async () => {
  // The degraded mode: the sha still prints and looks clean while the strongest
  // half of the guard never executed.
  // See [[feedback_dead_stub_option_degrades_to_happy_path]].
  const { out } = await run({ contactRows: ALL_SEVEN_ROWS }, { liveDescriptionSource: undefined });
  const s = out.steps.find((x) => x.name === 'T4 the hashed span IS the shipping function');
  assert.ok(s, 'the step must exist even when it could not be performed');
  assert.equal(s.ok, false);
  assert.match(s.detail, /NOT CHECKED/);
  assert.ok(out.notes.some((n) => n.includes('cross-check did not run')));
});

// ── 5. THE JOIN URL AND THE LOCATION NEVER LEAVE THE PROCESS ────────────────

test('the location and join_url appear in no printed line and in no recorded value', async () => {
  const { out, all } = await run({ contactRows: ALL_SEVEN_ROWS });

  // A join URL is a bearer capability: anyone holding it is in the client's
  // consultation. Presence, host and length are reported; the value never is.
  assert.ok(!all.includes(LOCATION_URL), 'the entry location reached a printed line');
  assert.ok(!all.includes(JOIN_URL), 'the join URL reached a printed line');

  const serialised = JSON.stringify(out);
  assert.ok(!serialised.includes(LOCATION_URL), 'the entry location was recorded');
  assert.ok(!serialised.includes(JOIN_URL), 'the join URL was recorded');
  assert.ok(!serialised.includes('secret-join-token'), 'part of the location token was recorded');
  assert.ok(!serialised.includes('SECRETPWD'), 'part of the join URL was recorded');

  // …and the run still ANSWERED the question, so this is not a pass by silence.
  assert.equal(out.observations.entry.locationPresent, true);
  assert.equal(out.observations.entry.joinUrlPresent, true);
});

test('the minted access token is never written into the returned object', async () => {
  const { out, all } = await run({ contactRows: ALL_SEVEN_ROWS });
  assert.ok(!JSON.stringify(out).includes(ACCESS_TOKEN));
  assert.ok(!all.includes(ACCESS_TOKEN));
  assert.equal(out.redaction.backstopHits, 0, 'the backstop firing at all is a defect, not a save');
});

test('no credential value appears in any line or in the returned object', async () => {
  const { out, all } = await run({ contactRows: ALL_SEVEN_ROWS });
  const serialised = JSON.stringify(out);
  for (const v of Object.values(ENV)) {
    assert.ok(!all.includes(v), `a credential reached a printed line`);
    assert.ok(!serialised.includes(v), `a credential was recorded`);
  }
});

// ── 6. TASK 3 — the leak search ──────────────────────────────────────────────

test('a clean entry with all seven values searched reports CLEAN, not VACUOUS', async () => {
  const { out } = await run({ contactRows: ALL_SEVEN_ROWS });
  assert.equal(out.observations.leak.state, 'CLEAN');
  assert.equal(out.observations.leak.valuesSearched.length, 7);
  assert.equal(out.observations.leak.surfacesSearched.length, 3);
  assert.equal(out.exitCode, EXIT_OK);
});

test('a band in the description is LEAKED, exits EXIT_LEAK, and names the band', async () => {
  const { out, errLines } = await run({
    contactRows: ALL_SEVEN_ROWS,
    entry: { description: `${CLIENT_DESCRIPTION}\nNet worth: ${VALUES.net_worth_band}` },
  });
  assert.equal(out.observations.leak.state, 'LEAKED');
  assert.equal(out.exitCode, EXIT_LEAK);
  const hit = out.observations.leak.hits.find((h) => h.field === 'net_worth_band');
  assert.ok(hit, 'the band must be named');
  assert.equal(hit.surface, 'description');
  assert.equal(hit.isBand, true);
  assert.equal(hit.verbatim, true);
  assert.equal(out.observations.leak.bandHits.length, 1);
  assert.match(errLines.join('\n'), /AN INTAKE VALUE IS ON A CLIENT-FACING SURFACE/);
});

test('a value in the summary or the location is found too', async () => {
  const inSummary = await run({
    contactRows: ALL_SEVEN_ROWS,
    entry: { summary: `Casey Rivera — ${VALUES.matter_category}` },
  });
  assert.equal(inSummary.out.observations.leak.hits[0].surface, 'summary');

  const inLocation = await run({
    contactRows: ALL_SEVEN_ROWS,
    entry: { location: `${LOCATION_URL}?note=${VALUES.income_band}` },
  });
  const hit = inLocation.out.observations.leak.hits.find((h) => h.surface === 'location');
  assert.ok(hit, 'a value in the location must be found');
  assert.equal(hit.field, 'income_band');
  // …and the location value is still not disclosed by the finding.
  assert.ok(!JSON.stringify(inLocation.out).includes('secret-join-token'));
});

test('a re-wrapped description is still caught — whitespace does not launder a band', async () => {
  const { out } = await run({
    contactRows: ALL_SEVEN_ROWS,
    entry: { description: `Net worth:\r\n  ${VALUES.net_worth_band.replace('-', '-')}   ` },
  });
  assert.equal(out.observations.leak.state, 'LEAKED');
});

test('a contact with no values makes the leak search VACUOUS, and VACUOUS is not CLEAN', async () => {
  // Searching for nothing finds nothing. That is not a pass.
  // See [[feedback_idle_with_zero_tasks_is_a_vacuous_pass]].
  const { out } = await run({ contactRows: [] });
  assert.equal(out.observations.leak.state, 'VACUOUS');
  assert.notEqual(out.observations.leak.state, 'CLEAN');
  assert.equal(out.exitCode, EXIT_OK, 'vacuous is a reportable result, not an instrument failure');
  const s = out.steps.find((x) => x.name.startsWith('T3'));
  assert.equal(s.ok, false, 'a vacuous search must not report as a passing step');
});

test('VACUOUS off an unattributable read says WHY, and does not claim the values are empty', async () => {
  // "every intake value is empty" is a claim about the CONTACT. When T1 could not
  // attribute a row, this run does not know the values — the leak search is right
  // that it had nothing to search for, and wrong-sounding about why.
  const { out } = await run({ rejectAttributing: true, contactRows: ALL_SEVEN_ROWS });
  const s = out.steps.find((x) => x.name.startsWith('T3 no intake value'));
  assert.equal(out.observations.leak.state, 'VACUOUS');
  assert.match(s.detail, /NOT BECAUSE THEY ARE EMPTY/);
  assert.match(s.detail, /NON_ATTRIBUTING_SELECTION/);
  assert.ok(out.notes.some((n) => n.includes('T3 is VACUOUS because T1 could not be answered')));

  // …and the annotation is NOT bolted onto a genuinely empty contact, or it would
  // just be noise that always fires.
  const empty = await run({ contactRows: [] });
  const es = empty.out.steps.find((x) => x.name.startsWith('T3 no intake value'));
  assert.equal(empty.out.observations.leak.state, 'VACUOUS');
  assert.ok(!/NOT BECAUSE THEY ARE EMPTY/.test(es.detail));
});

test('an unreadable entry makes the leak search NOT_RUN, and NOT_RUN is not CLEAN', async () => {
  const { out } = await run({ contactRows: ALL_SEVEN_ROWS, entryStatus: 404 });
  assert.equal(out.observations.leak.state, 'NOT_RUN');
  assert.notEqual(out.observations.leak.state, 'CLEAN');
});

test('findIntakeLeaks tells its four states apart in isolation', () => {
  assert.equal(findIntakeLeaks({}, {}).state, 'NOT_RUN');
  assert.equal(findIntakeLeaks({}, { description: 'x' }).state, 'VACUOUS');
  assert.equal(findIntakeLeaks({ a: '' }, { description: 'x' }).state, 'VACUOUS');
  assert.equal(findIntakeLeaks({ a: 'zz' }, { description: 'x' }).state, 'CLEAN');
  assert.equal(findIntakeLeaks({ a: 'zz' }, { description: 'a zz b' }).state, 'LEAKED');
});

test('foldSurface collapses whitespace and case without joining separate words', () => {
  assert.equal(foldSurface('  A\r\n  B  '), 'a b');
  assert.equal(foldSurface('$1.5M-$3M'), '$1.5m-$3m');
});

// ── 7. TASK 4 — the structural guard, and it must be able to FAIL ───────────

test('the live provider-clio.js hashes to the pinned value', () => {
  const r = hashDescriptionFn({
    source: PROVIDER_SOURCE,
    liveSource: LIVE_DESCRIPTION_SOURCE,
  });
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.crossChecked, true, 'the hashed span must be the shipping function');
  assert.equal(r.sha, EXPECTED_DESCRIPTION_SHA);
  assert.equal(r.state, 'MATCHES');
  assert.equal(r.matches, true);
});

test('the sha survives a CRLF checkout — line endings are normalised first', () => {
  // A Windows checkout with core.autocrlf writes CRLF into the working tree while
  // `git show` hands out LF. Without normalisation the pinned sha is unreachable on
  // exactly one of the two, silently, on one developer's machine.
  // See [[feedback_git_show_lf_vs_worktree_crlf]].
  const lf   = PROVIDER_SOURCE.replace(/\r\n/g, '\n');
  const crlf = lf.replace(/\n/g, '\r\n');
  assert.notEqual(lf, crlf, 'the two renderings must actually differ, or this proves nothing');
  assert.equal(hashDescriptionFn({ source: lf }).sha, EXPECTED_DESCRIPTION_SHA);
  assert.equal(hashDescriptionFn({ source: crlf }).sha, EXPECTED_DESCRIPTION_SHA);
});

test('THE GUARD FAILS when handed a wrong expected value', () => {
  const wrong = '0'.repeat(64);
  const r = hashDescriptionFn({
    source: PROVIDER_SOURCE,
    liveSource: LIVE_DESCRIPTION_SOURCE,
    expected: wrong,
  });
  assert.equal(r.matches, false);
  assert.equal(r.state, 'DIFFERS');
  assert.equal(r.sha, EXPECTED_DESCRIPTION_SHA, 'the computed value is still the real one');
  assert.equal(r.expected, wrong);
});

test('a wrong --expect-sha makes the RUN fail loudly, with its own exit code', async () => {
  const wrong = 'f'.repeat(64);
  const { out, errLines } = await run({ contactRows: ALL_SEVEN_ROWS }, {
    expectedSha: wrong, shaOverridden: true,
  });
  assert.equal(out.exitCode, EXIT_SHA_MISMATCH);
  assert.equal(out.verdict.shaMatches, false);
  assert.match(errLines.join('\n'), new RegExp(`${DESCRIPTION_FN_NAME} HAS CHANGED`));
  assert.ok(out.blockers.some((b) => b.includes('sha256 differs')));
  // The override is announced, so a reader cannot mistake the run for a pinned one.
  assert.ok(out.notes.some((n) => n.includes('operator-supplied expectation')));
  assert.equal(out.observations.descriptionSha.overridden, true);
  assert.equal(out.observations.descriptionSha.pinned, EXPECTED_DESCRIPTION_SHA);
});

test('a MUTATED buildClientDescription is caught — the guard is not inert', () => {
  // The mutation a reviewer actually fears: a parameter through which caller text
  // could arrive. It must change the hash.
  const mutated = PROVIDER_SOURCE.replace(
    `export function ${DESCRIPTION_FN_NAME}({ typeName, meetingLink, firmPhone, firmEmail }) {`,
    `export function ${DESCRIPTION_FN_NAME}({ typeName, meetingLink, firmPhone, firmEmail, intakeSummary }) {`,
  );
  assert.notEqual(mutated, PROVIDER_SOURCE, 'the mutation must actually apply, or this test reports a vacuous pass');
  const r = hashDescriptionFn({ source: mutated });
  assert.notEqual(r.sha, EXPECTED_DESCRIPTION_SHA);
  assert.equal(r.matches, false);
});

test('a whitespace-only change to the function is still caught', () => {
  const mutated = PROVIDER_SOURCE.replace(
    '  const what = `${typeName || "Consultation"} with Donovan Legal PLLC.`;',
    '  const what  = `${typeName || "Consultation"} with Donovan Legal PLLC.`;',
  );
  assert.notEqual(mutated, PROVIDER_SOURCE, 'the mutation must actually apply');
  assert.notEqual(hashDescriptionFn({ source: mutated }).sha, EXPECTED_DESCRIPTION_SHA);
});

test('hashing a span that is not the live function is its own failure, not a sha pass', () => {
  // A hash over the wrong bytes that happens to match is the failure mode the
  // cross-check exists for: right hash, wrong subject.
  const r = hashDescriptionFn({
    source: PROVIDER_SOURCE,
    liveSource: 'function buildClientDescription() { return "something else"; }',
  });
  assert.equal(r.sha, EXPECTED_DESCRIPTION_SHA, 'the file span still hashes correctly');
  assert.equal(r.crossChecked, false);
  assert.equal(r.state, 'SPAN_IS_NOT_THE_LIVE_FUNCTION');
  assert.equal(r.matches, false, 'a right hash over the wrong subject is not a pass');
});

test('a missing function is NOT_EXTRACTED, never a silent pass', () => {
  const r = hashDescriptionFn({ source: 'const x = 1;\n' });
  assert.equal(r.ok, false);
  assert.equal(r.state, 'NOT_EXTRACTED');
  assert.equal(r.sha, null);
  assert.equal(r.matches, false);
});

test('a second declaration of the same name is refused rather than guessed at', () => {
  const doubled = PROVIDER_SOURCE + `\nexport function ${DESCRIPTION_FN_NAME}() {\n  return "";\n}\n`;
  const r = extractExportedFunction(doubled, DESCRIPTION_FN_NAME);
  assert.equal(r.ok, false);
  assert.match(r.reason, /more than one/);
});

test('T4 is answered even when nothing else can be', async () => {
  const { out } = await run({}, { env: {}, contactId: undefined, entryId: undefined });
  assert.equal(out.observations.descriptionSha.sha, EXPECTED_DESCRIPTION_SHA);
  assert.equal(out.steps.some((s) => s.name.startsWith('T4 sha256 matches') && s.ok), true);
});

// ── 8. ORIGIN — a cursor is checked BEFORE it is followed ────────────────────

test('a paging cursor at another host is refused, and never fetched', async () => {
  const evil = 'https://clio.evil.test/api/v4/custom_fields?page_token=zz';
  const { out, calls } = await run({ fieldsNext: evil, contactRows: ALL_SEVEN_ROWS });

  assert.ok(!calls.some((c) => c.url === evil), 'the off-Clio cursor was FOLLOWED');
  assert.deepEqual(out.requestLedger.offClioCalls, []);
  assert.ok(out.blockers.some((b) => b.includes('will not follow')),
    'the refusal must be reported, not silent');
  // A well-formed URL at the wrong host is exactly the shape a pathname-only check
  // cannot see. See [[feedback_pathname_only_url_check_cannot_see_the_host]].
  assert.equal(urlParts(evil).pathname.startsWith('/api/v4/'), true);
  assert.equal(isClioApiUrl(evil), false);
});

test('a same-origin cursor IS followed, so the refusal above is not vacuous', async () => {
  const good = `${CLIO_BASE}/custom_fields?page_token=zz&limit=${FIELD_PAGE_LIMIT}`;
  const { calls } = await run({ fieldsNext: good, contactRows: ALL_SEVEN_ROWS });
  assert.ok(calls.some((c) => c.url === good), 'a legitimate cursor must be walked');
});

// ── 9. THE STOP CONDITION ────────────────────────────────────────────────────

test('a 403 on /custom_fields is the STOP condition, said loudly', async () => {
  const { out, errLines } = await run({ fieldsStatus: 403 });
  assert.equal(out.exitCode, EXIT_SCOPE_LOST);
  assert.ok(out.blockers.some((b) => b.includes('CUSTOM FIELDS SCOPE LOST')));
  assert.match(errLines.join('\n'), /STOP condition/);
});

test('a 403 on /custom_fields stops the contact read rather than reporting absence', async () => {
  const { out, calls } = await run({ fieldsStatus: 403 });
  assert.ok(!calls.some((c) => c.url.includes('/contacts/')),
    'a grant that cannot read fields must not go on to claim the contact is empty');

  // THE DEFECT THIS TEST FOUND. Every field used to fall through to UNRESOLVED,
  // which reads as "these seven names are not on the firm's account" — a finding
  // about David's Clio settings, produced by a run that was simply refused and
  // knows nothing. A refusal must render as UNDETERMINED, with the reason.
  for (const key of EXPECTED_FIELD_KEYS) {
    const row = fieldRow(out, key);
    assert.equal(row.state, 'UNDETERMINED', `${key}`);
    assert.match(row.why, /not seen is not a name absent/);
  }
  assert.equal(out.verdict.fieldsUndetermined, 7);
  assert.equal(out.verdict.allSevenPopulated, false);
});

test('a truncated field walk also yields UNDETERMINED, never UNRESOLVED', async () => {
  const cursor = `${CLIO_BASE}/custom_fields?page_token=loop`;
  const stub = makeStub({ contactRows: [] });
  const looping = async (url, init) => {
    const u = String(url);
    if (u.startsWith(`${CLIO_BASE}/custom_fields`)) {
      return json(200, { data: [], meta: { paging: { next: cursor } } });
    }
    return stub.fetchImpl(url, init);
  };
  const out = await runWritePathVerify({
    env: ENV, fetchImpl: looping, contactId: CONTACT_ID, entryId: undefined,
    providerSource: PROVIDER_SOURCE, liveDescriptionSource: LIVE_DESCRIPTION_SOURCE,
    nowMs: Date.parse('2026-08-04T12:00:00Z'), log: silent, logErr: silent,
  });
  for (const key of EXPECTED_FIELD_KEYS) {
    assert.equal(out.observations.fields.find((f) => f.key === key).state, 'UNDETERMINED', key);
  }
});

test('UNRESOLVED is still reachable, so the fix above is not a blanket UNDETERMINED', async () => {
  // The complementary arm: a walk that DID reach the end of the account may say a
  // name is genuinely not there. Without this, the fix could have been "call
  // everything UNDETERMINED" and every control would still pass.
  const { out } = await run({ presentKeys: ['language'], contactRows: [] });
  assert.equal(out.observations.fieldListing.listed, true);
  assert.equal(fieldRow(out, 'income_band').state, 'UNRESOLVED');
  assert.equal(fieldRow(out, 'language').state, 'ABSENT');
});

test('a 403 on the contact read is the STOP condition too', async () => {
  const { out, errLines } = await run({ contactStatus: 403 });
  assert.equal(out.exitCode, EXIT_SCOPE_LOST);
  assert.ok(out.blockers.some((b) => b.includes('CONTACT READ REFUSED')));
  assert.match(errLines.join('\n'), /STOP condition/);
});

test('a truncated field walk is a FAILED walk, and UNRESOLVED then means "not seen"', async () => {
  // A name absent from the pages we managed to read is not absent from the account.
  // See [[feedback_truncated_page_is_a_wellformed_answer]].
  const cursor = `${CLIO_BASE}/custom_fields?page_token=loop`;
  const stub = makeStub({ presentKeys: [], contactRows: [] });
  const alwaysNext = async (url, init) => {
    const u = String(url);
    if (u.startsWith(`${CLIO_BASE}/custom_fields`)) {
      return json(200, { data: [], meta: { paging: { next: cursor } } });
    }
    return stub.fetchImpl(url, init);
  };
  const out = await runWritePathVerify({
    env: ENV, fetchImpl: alwaysNext, contactId: CONTACT_ID, entryId: undefined,
    providerSource: PROVIDER_SOURCE, liveDescriptionSource: LIVE_DESCRIPTION_SOURCE,
    nowMs: Date.parse('2026-08-04T12:00:00Z'), log: silent, logErr: silent,
  });
  assert.equal(out.observations.fieldListing.truncated, true);
  assert.equal(out.observations.fieldListing.listed, false);
  const s = out.steps.find((x) => x.name.startsWith('T1 the account'));
  assert.equal(s.ok, false);
  assert.match(s.detail, /NOT a name absent/);
  assert.ok(out.notes.some((n) => n.includes('not seen')));
});

test('the field walk is bounded — a cursor loop cannot run forever', async () => {
  const cursor = `${CLIO_BASE}/custom_fields?page_token=loop`;
  let fieldCalls = 0;
  const stub = makeStub({ contactRows: [] });
  const looping = async (url, init) => {
    const u = String(url);
    if (u.startsWith(`${CLIO_BASE}/custom_fields`)) {
      fieldCalls += 1;
      return json(200, { data: [], meta: { paging: { next: cursor } } });
    }
    return stub.fetchImpl(url, init);
  };
  await runWritePathVerify({
    env: ENV, fetchImpl: looping, contactId: CONTACT_ID, entryId: undefined,
    providerSource: PROVIDER_SOURCE, liveDescriptionSource: LIVE_DESCRIPTION_SOURCE,
    nowMs: Date.parse('2026-08-04T12:00:00Z'), log: silent, logErr: silent,
  });
  assert.ok(fieldCalls <= FIELD_MAX_PAGES, `walked ${fieldCalls} pages, bound is ${FIELD_MAX_PAGES}`);
});

// ── 10. THE GRANT — rotation, dead grant, mint failure ──────────────────────

test('a rotated refresh token is reported loudly and exits EXIT_ROTATED', async () => {
  const rotated = 'refresh-token-NEW-9999999999';
  const { out, errLines } = await run({ rotateTo: rotated, contactRows: ALL_SEVEN_ROWS });
  assert.equal(out.refreshRotated, true);
  assert.equal(out.exitCode, EXIT_ROTATED);
  assert.match(errLines.join('\n'), /THE REFRESH TOKEN ROTATED/);
  assert.ok(!JSON.stringify(out).includes(rotated), 'the rotated value must not be recorded');
});

test('an unrotated refresh is stated positively, so the rotation test is not vacuous', async () => {
  const { out } = await run({ contactRows: ALL_SEVEN_ROWS });
  assert.equal(out.refreshRotated, false);
  assert.equal(out.steps.some((s) => s.name.includes('did not rotate') && s.ok), true);
});

test('a 400 on the mint is a DEAD GRANT, distinct from Clio being unwell', async () => {
  const dead = await run({ mintStatus: 400 });
  assert.equal(dead.out.verdict.state, 'DEAD_GRANT');
  const unwell = await run({ mintStatus: 503 });
  assert.equal(unwell.out.verdict.state, 'MINT_UNAVAILABLE');
});

// ── 11. EXIT-CODE PRECEDENCE — discovery order must not decide the verdict ──

test('a leak found mid-run is not overwritten by later steps', async () => {
  // The ledger check runs last. Without a rank table it would clobber the leak.
  // See [[feedback_assertion_order_decides_which_failure_the_mutation_names]].
  const { out } = await run({
    contactRows: ALL_SEVEN_ROWS,
    entry: { description: `x ${VALUES.income_band} y` },
  });
  assert.equal(out.exitCode, EXIT_LEAK);
});

test('a rotated token outranks a leak, and a redaction hit outranks both', () => {
  assert.equal(moreSevere(EXIT_LEAK, EXIT_ROTATED), EXIT_ROTATED);
  assert.equal(moreSevere(EXIT_ROTATED, EXIT_BACKSTOP_HIT), EXIT_BACKSTOP_HIT);
  assert.equal(moreSevere(EXIT_OK, EXIT_LEAK), EXIT_LEAK);
  assert.equal(moreSevere(EXIT_SHA_MISMATCH, EXIT_NO_CREDENTIALS), EXIT_SHA_MISMATCH);
  assert.equal(moreSevere(EXIT_OK, EXIT_OK), EXIT_OK);
});

test('a sha mismatch is not masked by a missing credential', async () => {
  const { out } = await run({}, { env: {}, expectedSha: '1'.repeat(64), shaOverridden: true });
  assert.equal(out.exitCode, EXIT_SHA_MISMATCH);
});

// ── 12. IDS ──────────────────────────────────────────────────────────────────

test('parseResourceId accepts a Clio id and refuses everything else by name', () => {
  assert.deepEqual(parseResourceId('884411'), { ok: true, id: 884411, text: '884411' });
  assert.deepEqual(parseResourceId(' 884411 '), { ok: true, id: 884411, text: '884411' });
  assert.equal(parseResourceId(undefined).reason, 'ABSENT');
  assert.equal(parseResourceId('').reason, 'EMPTY');
  assert.equal(parseResourceId('12e3').reason, 'NOT_DIGITS');
  assert.equal(parseResourceId('0x1f').reason, 'NOT_DIGITS');
  assert.equal(parseResourceId('../../secrets').reason, 'NOT_DIGITS');
  assert.equal(parseResourceId('0').reason, 'OUT_OF_RANGE');
  assert.equal(parseResourceId('9'.repeat(20)).reason, 'OUT_OF_RANGE');
});

test('a path-traversal id never reaches a URL', async () => {
  const { calls, out } = await run({}, { contactId: '../../oauth/token', entryId: undefined });
  assert.deepEqual(calls, []);
  assert.equal(out.exitCode, EXIT_BAD_ARGS);
});

// ── 13. THE FIELD SET THIS REPORT IS ABOUT ──────────────────────────────────

test('the shipping INTAKE_CUSTOM_FIELDS is still the seven issue 153 names', () => {
  assert.deepEqual(INTAKE_CUSTOM_FIELDS.map((f) => f.key), EXPECTED_FIELD_KEYS);
  for (const f of INTAKE_CUSTOM_FIELDS) assert.equal(f.type, EXPECTED_FIELD_TYPE);
});

test('a drifted field set is reported rather than silently changing the question', async () => {
  const { out } = await run({ contactRows: ALL_SEVEN_ROWS });
  const s = out.steps.find((x) => x.name.startsWith('the shipping field set'));
  assert.ok(s);
  assert.equal(s.ok, true);
  assert.equal(out.observations.fieldSet.keysMatch, true);
  assert.equal(out.observations.fieldSet.typesMatch, true);
});

test('the paging bounds mirror the ones clio-custom-fields.js walks with', () => {
  const src = readFileSync(
    path.join(REPO_ROOT, 'donovan-legal-site/functions/booking/_lib/clio-custom-fields.js'), 'utf8');
  assert.match(src, new RegExp(`const MAX_PAGES = ${FIELD_MAX_PAGES};`));
  assert.match(src, new RegExp(`const PAGE_LIMIT = ${FIELD_PAGE_LIMIT};`));
});

test('CLIO_INTAKE_FIELD_IDS is not read anywhere in the verifier', () => {
  // Pinning ids skips the field_type admission check, which is precisely what this
  // run exists to exercise (issue 153, Constraints).
  const src = readFileSync(path.join(PREVIEW_DIR, 'verify-clio-writepath.mjs'), 'utf8');
  const uses = src.split('\n').filter((l) => l.includes('CLIO_INTAKE_FIELD_IDS') && !l.trim().startsWith('//'));
  assert.deepEqual(uses, [], 'the verifier must not consult seeded ids');
});

// ── 14. NO WRITE VERB ANYWHERE IN THE SOURCE ────────────────────────────────

test('the verifier source contains no write verb aimed at /api/v4', () => {
  const src = readFileSync(path.join(PREVIEW_DIR, 'verify-clio-writepath.mjs'), 'utf8');
  const code = src.split('\n')
    .filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'))
    .join('\n');
  for (const verb of ['PATCH', 'DELETE', "'PUT'", '"PUT"']) {
    assert.ok(!code.includes(verb), `the verifier source names ${verb}`);
  }
  // POST appears exactly once, and it is the mint.
  const posts = code.split('\n').filter((l) => l.includes("'POST'"));
  assert.equal(posts.length, 1, `expected one POST call site, found ${posts.length}`);
  assert.ok(posts[0].includes('CLIO_TOKEN_URL'), 'the only POST must be the token mint');
});

// ── 15. TASK 6 — the evidence file is bounded and gitignored ────────────────

test('.gitignore still carries the pattern the verifier is bounded to', () => {
  const ignore = readFileSync(path.join(REPO_ROOT, '.gitignore'), 'utf8');
  assert.ok(ignore.split(/\r?\n/).includes(`test/preview/${EVIDENCE_BASENAME_GLOB}`),
    'the bound and the ignore rule must move together');
});

test('git itself ignores the default evidence path', () => {
  // Not "the pattern is in the file" — git's own answer, from git.
  const target = `test/preview/${DEFAULT_EVIDENCE_BASENAME}`;
  const code = (() => {
    try {
      execFileSync('git', ['check-ignore', '-q', '--', target], { cwd: REPO_ROOT, stdio: 'ignore' });
      return 0;
    } catch (err) { return err.status ?? 1; }
  })();
  assert.equal(code, 0, `git does not ignore ${target}`);
});

test('the default evidence path is the gitignored name in test/preview', () => {
  const r = resolveEvidencePath(undefined, { moduleDir: PREVIEW_DIR, cwd: REPO_ROOT });
  assert.equal(r.ok, true);
  assert.equal(path.basename(r.path), DEFAULT_EVIDENCE_BASENAME);
  assert.equal(path.dirname(r.path), PREVIEW_DIR);
});

test('an --evidence outside the ignored set is refused BY NAME', () => {
  const cases = [
    ['.dev.vars',                          'NOT_IN_PREVIEW_DIR'],
    ['donovan-legal-site/index.html',      'NOT_IN_PREVIEW_DIR'],
    ['test/preview/sub/clio-writepath-evidence.json', 'NOT_IN_PREVIEW_DIR'],
    ['test/preview/notes.json',            'NOT_IGNORED_NAME'],
    ['test/preview/clio-paging-evidence.json', 'NOT_IGNORED_NAME'],
    ['',                                   'EMPTY'],
  ];
  for (const [raw, reason] of cases) {
    const r = resolveEvidencePath(raw, { moduleDir: PREVIEW_DIR, cwd: REPO_ROOT });
    assert.equal(r.ok, false, `${raw} was accepted`);
    assert.equal(r.reason, reason, `${raw}`);
  }
});

test('an accepted --evidence name is one git actually ignores', () => {
  const raw = 'test/preview/clio-writepath-evidence-r2.json';
  const r = resolveEvidencePath(raw, { moduleDir: PREVIEW_DIR, cwd: REPO_ROOT });
  assert.equal(r.ok, true);
  const code = (() => {
    try {
      execFileSync('git', ['check-ignore', '-q', '--', raw], { cwd: REPO_ROOT, stdio: 'ignore' });
      return 0;
    } catch (err) { return err.status ?? 1; }
  })();
  assert.equal(code, 0, `the verifier would accept ${raw} but git would TRACK it`);
});

test('a symlink at an allowed name is refused — the name checked must be the file written', (t) => {
  const linkPath = path.join(PREVIEW_DIR, 'clio-writepath-evidence-symlink-control.json');
  const targetPath = path.join(os.tmpdir(), `writepath-symlink-target-${process.pid}.json`);
  writeFileSync(targetPath, '{}\n', 'utf8');
  try {
    symlinkSync(targetPath, linkPath, 'file');
  } catch (_) {
    t.skip('this platform/user cannot create a symlink');
    rmSync(targetPath, { force: true });
    return;
  }
  try {
    const r = resolveEvidencePath(linkPath, { moduleDir: PREVIEW_DIR, cwd: REPO_ROOT });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'SYMLINK');
  } finally {
    rmSync(linkPath, { force: true });
    rmSync(targetPath, { force: true });
  }
});

test('if an evidence file exists on this machine, git ignores it', () => {
  // Phrased as an invariant rather than as "the file is absent". An operator who
  // has legitimately run the verifier leaves one behind, and a control that reds
  // for that is a false positive that teaches people to ignore the suite. What
  // must never be true is that the file exists AND git would track it.
  const target = path.join(PREVIEW_DIR, DEFAULT_EVIDENCE_BASENAME);
  if (!existsSync(target)) return;
  const code = (() => {
    try {
      execFileSync('git', ['check-ignore', '-q', '--', `test/preview/${DEFAULT_EVIDENCE_BASENAME}`],
        { cwd: REPO_ROOT, stdio: 'ignore' });
      return 0;
    } catch (err) { return err.status ?? 1; }
  })();
  assert.equal(code, 0, 'an evidence file holding client intake data is TRACKABLE');
});

test('the controls never invoke the CLI block, so they never write client data', () => {
  // The one path in this file that touches the disk is the direct-invocation block.
  // Importing the module must not take it.
  assert.equal(isDirectInvocation(process.argv[1],
    new URL('./preview/verify-clio-writepath.mjs', import.meta.url).href), false);
});

// ── 16. THE CLI ──────────────────────────────────────────────────────────────

test('parseCliArgs reads the flags, last occurrence wins, and a bare flag is not a value', () => {
  const a = parseCliArgs(['--contact=1', '--entry=2', '--contact=3']);
  assert.equal(a.contactRaw, '3');
  assert.equal(a.entryRaw, '2');
  assert.equal(a.evidenceRaw, undefined);
  assert.equal(a.shaOverridden, false);
  assert.equal(a.expectedSha, EXPECTED_DESCRIPTION_SHA);

  const bare = parseCliArgs(['--evidence']);
  assert.equal(bare.evidenceRaw, undefined, 'a bare --evidence must fall back, not resolve to ""');

  const empty = parseCliArgs(['--evidence=']);
  assert.equal(empty.evidenceRaw, '', 'an explicit empty value IS a value, refused downstream by name');

  const over = parseCliArgs(['--expect-sha=abc']);
  assert.equal(over.shaOverridden, true);
  assert.equal(over.expectedSha, 'abc');
});

test('importing this module does not launch a live run', () => {
  // The guard that keeps this suite from contacting app.clio.com on import.
  assert.equal(isDirectInvocation(undefined), false);
  assert.equal(isDirectInvocation('/some/other/file.mjs'), false);
  assert.equal(
    isDirectInvocation(path.join(PREVIEW_DIR, 'verify-clio-writepath.mjs'),
      new URL('./preview/verify-clio-writepath.mjs', import.meta.url).href),
    true);
});

// ── 17. THE REPORT A HUMAN READS ─────────────────────────────────────────────

test('the printed report names every field with a state, on both ends of the range', async () => {
  const full = await run({ contactRows: ALL_SEVEN_ROWS });
  for (const key of EXPECTED_FIELD_KEYS) {
    assert.match(full.all, new RegExp(`${key}\\s+POPULATED`), `${key} missing from the printed report`);
  }
  assert.match(full.all, /7 of 7 populated/);

  const empty = await run({ contactRows: [] });
  for (const key of EXPECTED_FIELD_KEYS) {
    assert.match(empty.all, new RegExp(`${key}\\s+ABSENT`), `${key} missing from the printed report`);
  }
  assert.match(empty.all, /0 of 7 populated/);
});

test('the report warns that it holds client data before it prints any', async () => {
  const { lines } = await run({ contactRows: ALL_SEVEN_ROWS });
  const bannerAt = lines.findIndex((l) => l.includes('HANDLING'));
  const firstValueAt = lines.findIndex((l) => l.includes(VALUES.net_worth_band));
  assert.ok(bannerAt >= 0, 'the handling banner must be printed');
  assert.ok(firstValueAt > bannerAt, 'a band was printed before the handling banner');
});

test('the verdict block states all four tasks, and the meeting signal is the join_url', async () => {
  const { all } = await run({ contactRows: ALL_SEVEN_ROWS });
  assert.match(all, /T1 intake on the contact/);
  assert.match(all, /T2 attendee attached/);
  assert.match(all, /T2 meeting minted \(join_url\)/);
  assert.match(all, /entry location \(info\)/);
  assert.match(all, /T3 intake on a client surface/);
  assert.match(all, new RegExp(`T4 ${DESCRIPTION_FN_NAME} sha`));
  // The retired verdict line, which asserted the wrong observable.
  assert.ok(!/T2 entry has a location/.test(all));
});

// ── 18. HELPERS IN ISOLATION ────────────────────────────────────────────────

test('attributeRow prefers the id, falls back to the name, and admits when it cannot', () => {
  const ids = { income_band: FIELD_IDS.income_band };
  assert.deepEqual(
    attributeRow({ custom_field: { id: FIELD_IDS.income_band } }, ids),
    { key: 'income_band', by: 'BY_ID' });
  assert.deepEqual(
    attributeRow({ field_name: 'Intake Income Band' }, {}),
    { key: 'income_band', by: 'BY_NAME' });
  assert.deepEqual(attributeRow({ field_name: 'Referral Bonus' }, ids), { key: null, by: 'NOT_OURS' });
  assert.deepEqual(attributeRow({ custom_field: { id: 4242 } }, ids), { key: null, by: 'NOT_OURS' });
  assert.deepEqual(attributeRow({ id: 'text_line-1', value: 'x' }, ids), { key: null, by: 'NONE' });
});

test('buildFieldReport gives every one of the seven a definite state, always', () => {
  const cases = [
    { resolution: {}, rowsByKey: {}, unattributableRows: 0, contactRead: null },
    { resolution: {}, rowsByKey: {}, unattributableRows: 0, contactRead: {} },
    {
      resolution: Object.fromEntries(EXPECTED_FIELD_KEYS.map((k) => [k, { state: 'RESOLVED', id: FIELD_IDS[k] }])),
      rowsByKey: {}, unattributableRows: 0, contactRead: {},
    },
  ];
  for (const c of cases) {
    const report = buildFieldReport(c);
    assert.equal(report.length, 7);
    for (const r of report) {
      assert.ok(['POPULATED', 'PRESENT_BUT_EMPTY', 'ABSENT', 'UNRESOLVED', 'REFUSED_ON_TYPE',
        'UNDETERMINED', 'INSTRUMENT_FAILED'].includes(r.state), `${r.key} got ${r.state}`);
    }
  }
});

test('buildFieldReport derives the instrument state when a caller forgets to pass it', () => {
  // The attribution object is computed by the run. A direct caller that omits it
  // must not get seven ABSENT rows out of unattributable input.
  const report = buildFieldReport({
    resolution: Object.fromEntries(EXPECTED_FIELD_KEYS.map((k) => [k, { state: 'RESOLVED', id: FIELD_IDS[k] }])),
    rowsByKey: {}, unattributableRows: 3, contactRead: {}, fieldsListed: true,
  });
  for (const r of report) assert.equal(r.state, 'INSTRUMENT_FAILED', r.key);
});

test('sha256 is the plain utf8 digest, so the pinned value can be reproduced by hand', () => {
  assert.equal(sha256(''), 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
