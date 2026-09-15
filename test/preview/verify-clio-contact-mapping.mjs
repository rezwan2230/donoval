// ── SHELDON-CLIO-CONTACT-MAPPING-R2 — the Preview verifier ───────────────────
//
//   node test/preview/verify-clio-contact-mapping.mjs [previewBaseUrl]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and the evidence file it writes.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
// Modelled on verify-clio-confirm-email.mjs, which prints the calendar-entry body
// so a human can read the sentence a client is about to receive. This one prints
// the CONTACT bodies, because R2 fixed five defects that are all invisible from the
// outside — every one of them leaves the booking returning 201:
//
//   1. the search asked with `q`, which GET /contacts does not document. An
//      unrecognised query parameter is IGNORED, not rejected, so the filter silently
//      stops applying and every returning client looks new.
//   2. an inconclusive search (429/5xx) fell through to create, minting a DUPLICATE
//      Person. The duplicate carries the attendee, so the client still gets their
//      email while the note and the custom fields file on an empty second record.
//   3. a single-token name was padded to the literal surname "(unknown)", which is
//      what the attorney then sees in the contact list.
//   4. the optional half of the intake rode on the POST that mints the contact, so
//      one rejected field cost the attendee, the confirmation email and the note.
//   5. field DEFINITIONS were POSTed into the firm's live Clio, with an immutable
//      field_type and three routes to duplicates.
//
// None of those five throws. Four of them look exactly like success. So the point of
// this file is to put the actual request bodies in front of a reviewer.
//
// ── NOTHING IS WRITTEN. AT ALL. ──────────────────────────────────────────────
// This verifier NEVER posts to /booking/create on a deployment. It runs the SHIPPED
// route handler and the SHIPPED Clio adapter in-process with `fetch` replaced, so
// every Clio, Grow and Vantage call is captured instead of sent. An "error path"
// probe in this codebase has already booked a real appointment on Paul's calendar
// once; the booking endpoint is the single most expensive thing in this tree to
// probe casually, and the confirmation-email path makes it worse — a stray probe now
// emails a real person a real invitation.
//
// The only live traffic, and only when a base URL is passed, is a GET of
// /booking/types — a read that proves the deployment is serving the booking API at
// all. Without a base URL the run is fully offline.
//
// ── WHAT IS REAL HERE, AND WHAT IS NOT ───────────────────────────────────────
//   REAL
//     • functions/booking/create.js, its Turnstile / allow-list / availability /
//       qualifier-binding guards, functions/booking/_lib/provider-clio.js and
//       functions/booking/_lib/clio-custom-fields.js — the code that ships;
//     • the request bodies below, which are what those modules actually serialise.
//   NOT REAL
//     • Clio. Its responses are stubbed. This proves what we SEND. It cannot prove
//       that Clio's `query` parameter returns what we expect, that a PATCH appends
//       rather than replaces, or that the firm's account holds the seven fields.
//       Those are live-probe questions and are called out in `notes` below.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { onRequestPost } from '../../donovan-legal-site/functions/booking/create.js';
import {
  INTAKE_CUSTOM_FIELDS,
  __resetIntakeFieldCache,
} from '../../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';

const BASE = process.argv[2] || '';

const SITEVERIFY     = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES   = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS  = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS   = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES     = 'https://app.clio.com/api/v4/notes';
const GROW_INBOX     = 'https://grow.clio.com/inbox_leads';
const VANTAGE_UPSERT = 'https://vantage.ticoai.net/upsert-lead';

const CONTACT_ID   = 4242;
const MEETING_LINK = 'https://meet.donovan.law/consult';
const CALL_ID      = 'call_r2previewverify000001';
const CLIENT_EMAIL = 'jane.caller@example.com';

const FIELD_ID = Object.fromEntries(INTAKE_CUSTOM_FIELDS.map((f, i) => [f.key, 8100 + i]));
/** The account as David will have built it by hand, typed as each entry declares. */
const CF_ROWS = INTAKE_CUSTOM_FIELDS.map((f) => ({
  id: FIELD_ID[f.key], name: f.name, field_type: f.type,
}));

// The exact strings fn/qualifier_submit's LABELS table renders.
const INTAKE = {
  matter_category: 'Real estate',
  matter_sub:      'Acquisition',
  for_whom:        'Yourself (personal)',
  income_band:     '$1.5M–$3M',
  net_worth_band:  '$5M–$15M',
  language:        'English',
  source:          'Referred by a client',
};
const STATE = 'FL';
const BAND_INCOME    = `Income: ${INTAKE.income_band}`;
const BAND_NET_WORTH = `Net worth: ${INTAKE.net_worth_band}`;
const SUMMARY = [
  '— Perch intake —',
  `Matter: ${INTAKE.matter_category} → ${INTAKE.matter_sub}`,
  `State: ${STATE}`,
  BAND_INCOME,
  BAND_NET_WORTH,
].join('\n');
const TYPED_NOTES = 'I am closing on a property in Palm Beach County next month.';

const FORBIDDEN = [
  BAND_INCOME, BAND_NET_WORTH,
  INTAKE.income_band, INTAKE.net_worth_band,
  '— Perch intake —', 'income_band', 'net_worth_band', TYPED_NOTES,
];

const out = {
  order: 'SHELDON-CLIO-CONTACT-MAPPING-R2',
  startedAt: new Date().toISOString(),
  base: BASE || '(offline — no deployment probed)',
  steps: [],
  bodies: {},
  writes: [],
  notes: [],
};

function step(name, ok, detail) {
  out.steps.push({ name, ok: !!ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok && detail !== undefined) console.log(`      ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`);
}

// ── The captured Clio ────────────────────────────────────────────────────────

const realFetch = globalThis.fetch;

/**
 * One scenario's capture. `searchStatus` is consumed one entry per search attempt,
 * running out to 200, which is how "it retried and then answered" is told apart
 * from "it never answered".
 */
function makeHarness({ contactFound = null, cfList = [CF_ROWS], searchStatus = 200 } = {}) {
  const seen = {
    searches: [], contacts: [], patches: [], entries: [], notes: [],
    cfLists: [], cfCreates: [], grow: 0, vantage: 0, allBodies: [], clioBodies: [],
  };
  let cfPage = 0;
  let attempt = 0;
  // Indexed per HTTP REQUEST, not per logical attempt: clioFetch retries a 429/5xx
  // once internally, so one search attempt can be two requests. A number applies to
  // all of them, which is how "Clio never answered" is expressed.
  const statusFor = (n) => (Array.isArray(searchStatus) ? (searchStatus[n] ?? 200) : searchStatus);

  const fetchImpl = async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (typeof init?.body === 'string' && !u.startsWith('https://app.clio.com/oauth/token')) {
      seen.allBodies.push(init.body);
      if (u.startsWith('https://app.clio.com/api/v4/')) seen.clioBodies.push(init.body);
    }

    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
    if (u.startsWith('https://app.clio.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));

    if (u.startsWith(CLIO_ENTRIES) && method === 'GET') return new Response(JSON.stringify({ data: [] }));
    if (u.startsWith(CLIO_ENTRIES) && method === 'POST') {
      seen.entries.push(JSON.parse(init.body));
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
    // A TRIPWIRE. R2 deleted this path; if anything reaches it the run is NO-GO.
    if (u.startsWith(CLIO_CFIELDS) && method === 'POST') {
      seen.cfCreates.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 1 } }));
    }

    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      seen.patches.push({ url: u, body: JSON.parse(init.body) });
      return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      seen.searches.push(u);
      const status = statusFor(attempt);
      attempt += 1;
      if (status !== 200) return new Response('{}', { status });
      return new Response(JSON.stringify({ data: contactFound ? [contactFound] : [] }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      seen.contacts.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
    }

    if (u.startsWith(CLIO_NOTES) && method === 'POST') {
      seen.notes.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 77 } }));
    }
    if (u.startsWith(GROW_INBOX)) { seen.grow += 1; return new Response(JSON.stringify({ ok: true })); }
    if (u.startsWith(VANTAGE_UPSERT)) { seen.vantage += 1; return new Response(JSON.stringify({ ok: true })); }

    // Anything not deliberately modelled is a bug in this harness, not something to
    // pass through — passing through is how a probe writes.
    out.writes.push(`${method} ${u}`);
    throw new Error(`harness refused an un-modelled request: ${method} ${u}`);
  };

  return { seen, fetchImpl };
}

function kv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    async get(k) { const v = store.get(k); return v === undefined ? null : v; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
  };
}

function bridge() {
  return {
    idFromName(n) { return { name: String(n) }; },
    get() {
      return {
        async fetch(url) {
          const p = new URL(url);
          if (p.pathname === '/has') return new Response(JSON.stringify({ present: true }));
          return new Response('{}');
        },
      };
    },
  };
}

function futureMondaySlot() {
  const d = new Date(Date.now() + 7 * 86400_000);
  d.setUTCHours(14, 0, 0, 0);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

function baseEnv() {
  return {
    TURNSTILE_SECRET_KEY: 'preview-verify',
    CLIO_CLIENT_ID: 'cid',
    CLIO_CLIENT_SECRET: 'csec',
    CLIO_REFRESH_TOKEN: 'rtok',
    CLIO_CALENDAR_ID: 9084638,
    GROW_LEAD_TOKEN: 'grow-tok',
    VANTAGE_WRITE_SECRET: 'vantage-write-secret',
    // The live posture David configures: the contact is what attaches the attendee.
    CLIO_CREATE_CONTACT: '1',
    BOOKING_MEETING_LINK: MEETING_LINK,
    PERCH_ACTIONS: kv({
      [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY, intake: INTAKE, state: STATE, matter: 'real_estate' }),
    }),
    PERCH_BRIDGE: bridge(),
  };
}

let ipSeq = 0;
function request(over = {}) {
  ipSeq += 1;
  return new Request('https://www.donovan.law/booking/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': `198.51.100.${ipSeq}` },
    body: JSON.stringify({
      type: 'consult',
      slot: futureMondaySlot(),
      name: 'Jane Q Caller',
      email: CLIENT_EMAIL,
      phone: '(561) 555-0142',
      notes: TYPED_NOTES,
      call_id: CALL_ID,
      turnstile_token: 'good-token',
      ...over,
    }),
  });
}

/** Run one booking with fetch captured and the console silenced. Never throws. */
async function scenario(name, { harness = {}, body = {}, env = {} } = {}) {
  __resetIntakeFieldCache();
  const { seen, fetchImpl } = makeHarness(harness);
  const saved = { log: console.log, warn: console.warn, error: console.error };
  const logLines = [];
  globalThis.fetch = fetchImpl;
  console.log = console.warn = console.error = (...a) => logLines.push(a.join(' '));

  let status = 0;
  try {
    const res = await onRequestPost({ request: request(body), env: { ...baseEnv(), ...env } });
    status = res.status;
  } catch (e) {
    Object.assign(console, saved);
    out.notes.push(`scenario "${name}" threw: ${String(e?.message ?? e)}`);
  } finally {
    Object.assign(console, saved);
    globalThis.fetch = realFetch;
  }
  return { seen, status, logLines };
}

// ═════════════════════════════════════════════════════════════════════════════
// A. THE HAPPY PATH — a new client, the account already holding the seven fields
// ═════════════════════════════════════════════════════════════════════════════
const A = await scenario('new client');

out.bodies['A · GET  /api/v4/contacts (search)'] = A.seen.searches[0] ?? null;
out.bodies['A · POST /api/v4/contacts'] = A.seen.contacts[0] ?? null;
out.bodies['A · PATCH /api/v4/contacts/{id}'] = A.seen.patches[0]?.body ?? null;
out.bodies['A · POST /api/v4/calendar_entries'] = A.seen.entries[0] ?? null;
out.bodies['A · POST /api/v4/notes'] = A.seen.notes[0] ?? null;

const aCreate = A.seen.contacts[0]?.data ?? null;
const aPatch  = A.seen.patches[0]?.body?.data ?? null;
const aEntry  = A.seen.entries[0]?.data ?? null;

step('A: the booking confirms', A.status === 201, { status: A.status });

// DEFECT 1 — the documented search parameter.
{
  const params = A.seen.searches[0] ? new URL(A.seen.searches[0]).searchParams : null;
  step('A: the search asks with the documented `query`, never `q`',
    !!params && params.get('query') === CLIENT_EMAIL && !params.has('q'),
    { query: params?.get('query') ?? null, hasQ: params?.has('q') ?? null });
}

// DEFECT 4 — identity only on the create.
step('A: POST /contacts carries IDENTITY ONLY — no addresses, no custom fields',
  !!aCreate && !('addresses' in aCreate) && !('custom_field_values' in aCreate),
  aCreate ? Object.keys(aCreate) : null);
step('A: the optional half arrives on the PATCH instead',
  !!aPatch && Array.isArray(aPatch.custom_field_values) && aPatch.custom_field_values.length === 7
    && Array.isArray(aPatch.addresses),
  { customFields: aPatch?.custom_field_values?.length ?? 0, addresses: aPatch?.addresses ?? null });
step('A: the PATCH sends no _destroy — nothing here can delete a client\'s data',
  !JSON.stringify(A.seen.patches[0]?.body ?? {}).includes('_destroy'));

// The attendee and the email — unchanged by any of this.
step('A: the entry attaches the client as an attendee',
  JSON.stringify(aEntry?.attendees) === JSON.stringify([{ id: CONTACT_ID, type: 'Contact' }]),
  aEntry?.attendees);
step('A: send_email_notification is true', aEntry?.send_email_notification === true);
step('A: exactly one intake note, on the same contact',
  A.seen.notes.length === 1 && A.seen.notes[0]?.data?.contact?.id === CONTACT_ID,
  { notes: A.seen.notes.length });

// DEFECT 5 — no definition writes, ever.
step('A: ZERO POST /custom_fields — definitions are never minted',
  A.seen.cfCreates.length === 0, { creates: A.seen.cfCreates.length });

// The leak wall.
{
  const emailed = JSON.stringify(A.seen.entries[0] ?? {});
  const leaked = FORBIDDEN.filter((s) => emailed.includes(s));
  step('A: the calendar entry carries ZERO band strings and no caller free text',
    leaked.length === 0, { leaked });
  const logged = FORBIDDEN.filter((s) => A.logLines.join('\n').includes(s));
  step('A: no band string, and no client email address, reached a log line',
    logged.length === 0 && !A.logLines.join('\n').includes(CLIENT_EMAIL), { logged });
}
out.clientFacingDescription = aEntry?.description ?? null;

// ═════════════════════════════════════════════════════════════════════════════
// B. DEFECT 2 — a search that never answered must not mint a duplicate Person
// ═════════════════════════════════════════════════════════════════════════════
const B = await scenario('inconclusive search', { harness: { searchStatus: 500 } });

out.bodies['B · POST /api/v4/contacts (must be null)'] = B.seen.contacts[0] ?? null;

step('B: the booking still confirms', B.status === 201, { status: B.status });
step('B: ZERO POST /contacts — no duplicate Person for a client Clio may already hold',
  B.seen.contacts.length === 0, { created: B.seen.contacts.length });
step('B: it retried before giving up', B.seen.searches.length >= 2, { attempts: B.seen.searches.length });
step('B: it takes the no-contact path — no attendee, no email, no note',
  !('attendees' in (B.seen.entries[0]?.data ?? {}))
    && !('send_email_notification' in (B.seen.entries[0]?.data ?? {}))
    && B.seen.notes.length === 0,
  { attendees: B.seen.entries[0]?.data?.attendees ?? null, notes: B.seen.notes.length });
step('B: the outcome is alertable — a distinct warn, with no PII in it',
  B.logLines.some((l) => l.includes('contact search inconclusive'))
    && !B.logLines.join('\n').includes(CLIENT_EMAIL));

// CONTROL. Without this, "zero creates" could mean the harness never let it create.
const BC = await scenario('search recovers', { harness: { searchStatus: [500, 500] } });
step('B CONTROL: a search that RECOVERS does create the genuinely-absent contact',
  BC.seen.contacts.length === 1 && BC.status === 201,
  { created: BC.seen.contacts.length, attempts: BC.seen.searches.length });

// ═════════════════════════════════════════════════════════════════════════════
// C. DEFECT 3 — no placeholder surname, on either the create or the update
// ═════════════════════════════════════════════════════════════════════════════
const C = await scenario('single-token name', { body: { name: 'Cher' } });

out.bodies['C · POST /api/v4/contacts (single-token name)'] = C.seen.contacts[0] ?? null;

step('C: "(unknown)" appears in ZERO Clio request bodies',
  C.seen.clioBodies.every((b) => !b.includes('(unknown)')),
  { offending: C.seen.clioBodies.filter((b) => b.includes('(unknown)')).length });

// SCOPE, STATED RATHER THAN HIDDEN. One producer of this string survives and it is
// NOT Clio: booking/_lib/grow-lead.js pads `from_first`/`from_last` for Clio GROW's
// inbox_lead, a different API whose contract is not vendored in this repo and whose
// own comment says both parts are required. R2's defect is the CLIO contact — the
// record the attorney opens — and the justification for removing the padding there
// is the Clio Contacts documentation, which does not speak for Grow. Changing Grow
// on the same reasoning would be guessing at a second API's requiredness, which this
// order forbids. Recorded here so the remaining occurrence is a decision on the
// record rather than something this verifier quietly scoped around.
{
  const growLeaks = C.seen.allBodies.filter((b) => b.includes('(unknown)') && !b.includes('custom_field'));
  step('C: the only surviving "(unknown)" is the Grow lead, and it is out of scope',
    growLeaks.length === C.seen.allBodies.filter((b) => b.includes('(unknown)')).length,
    { growBodies: growLeaks.length });
  out.notes.push(
    'OUT OF SCOPE, FLAGGED: booking/_lib/grow-lead.js still pads a one-word name to '
    + '"(unknown)" for BOTH from_first and from_last on the Clio Grow inbox_lead. That is a '
    + 'different API with no vendored contract here and a source comment saying both parts are '
    + 'required. Worth a follow-up order with Grow\'s contract in hand; not changed on the '
    + 'strength of the Clio Contacts documentation.',
  );
}
step('C: the lone token becomes last_name, with first_name omitted entirely',
  C.seen.contacts[0]?.data?.last_name === 'Cher' && !('first_name' in (C.seen.contacts[0]?.data ?? {})),
  C.seen.contacts[0]?.data ?? null);

// The update route PR 123 added: a blank surname on an existing record.
const CU = await scenario('single-token name, existing contact', {
  body: { name: 'Cher' },
  harness: {
    contactFound: {
      id: CONTACT_ID,
      first_name: 'Cher', last_name: '',
      email_addresses: [{ address: CLIENT_EMAIL }],
      phone_numbers: [{ id: 1, number: '(561) 555-0142' }],
      addresses: [{ id: 2, province: 'FL' }],
      custom_field_values: [],
    },
  },
});
out.bodies['C · PATCH /api/v4/contacts/{id} (blank surname, one-word name)'] = CU.seen.patches[0]?.body ?? null;
step('C: a guessed surname is never PATCHed onto an existing record',
  !('last_name' in (CU.seen.patches[0]?.body?.data ?? {}))
    && CU.seen.clioBodies.every((b) => !b.includes('(unknown)')),
  CU.seen.patches[0]?.body?.data ?? null);

// ═════════════════════════════════════════════════════════════════════════════
// D. DEFECT 5 — an account WITHOUT the fields is read, never written to
// ═════════════════════════════════════════════════════════════════════════════
const D = await scenario('cold account', { harness: { cfList: [[]] } });

step('D: a cold account is LISTED', D.seen.cfLists.length >= 1, { lists: D.seen.cfLists.length });
step('D: and still receives ZERO definition writes',
  D.seen.cfCreates.length === 0, { creates: D.seen.cfCreates.length });
step('D: unresolved names are SKIPPED — no null ids on the wire',
  !('custom_field_values' in (D.seen.patches[0]?.body?.data ?? {}))
    && !D.seen.allBodies.some((b) => b.includes('"custom_field":{"id":null}')),
  D.seen.patches[0]?.body?.data ?? null);
step('D: the booking, the attendee and the note are all unaffected',
  D.status === 201
    && JSON.stringify(D.seen.entries[0]?.data?.attendees) === JSON.stringify([{ id: CONTACT_ID, type: 'Contact' }])
    && D.seen.notes.length === 1);

// A field on the account with the WRONG type is refused, not bound.
const DT = await scenario('wrong field_type', {
  harness: { cfList: [CF_ROWS.map((r) => (r.name === 'Intake Income Band' ? { ...r, field_type: 'picklist' } : r))] },
});
{
  const rows = DT.seen.patches[0]?.body?.data?.custom_field_values ?? [];
  const bound = rows.some((r) => r?.custom_field?.id === FIELD_ID.income_band);
  step('D: a field whose type does not match its declaration is REFUSED, not bound',
    !bound && rows.length === 6, { bound, rows: rows.length });
  step('D: the refusal is warned by field NAME and never by value',
    DT.logLines.some((l) => l.includes('Intake Income Band'))
      && !DT.logLines.join('\n').includes(INTAKE.income_band));
}

// ═════════════════════════════════════════════════════════════════════════════
// E. THE RETURNING CLIENT — the PATCH updates in place and appends, never replaces
// ═════════════════════════════════════════════════════════════════════════════
const E = await scenario('returning client', {
  harness: {
    contactFound: {
      id: CONTACT_ID,
      first_name: 'Jane', last_name: 'Caller',
      email_addresses: [{ address: CLIENT_EMAIL }],
      phone_numbers: [{ id: 1, number: '561-555-0142' }],
      addresses: [{ id: 2, province: 'FL' }],
      custom_field_values: [
        // The documented composite id, and the documented NULL case.
        { id: 'text_line-1', custom_field: { id: FIELD_ID.income_band } },
        { id: null, custom_field: { id: FIELD_ID.net_worth_band } },
      ],
    },
  },
});

out.bodies['E · PATCH /api/v4/contacts/{id} (returning client)'] = E.seen.patches[0]?.body ?? null;

step('E: no second contact is created', E.seen.contacts.length === 0, { created: E.seen.contacts.length });
{
  const rows = E.seen.patches[0]?.body?.data?.custom_field_values ?? [];
  const income = rows.find((r) => r?.custom_field?.id === FIELD_ID.income_band);
  const netWorth = rows.find((r) => r?.custom_field?.id === FIELD_ID.net_worth_band);
  step('E: an existing value is UPDATED IN PLACE via its opaque composite id',
    income?.id === 'text_line-1', income ?? null);
  step('E: a NULL value id sends no id at all — the documented create form',
    !!netWorth && !('id' in netWorth), netWorth ?? null);
  step('E: no NaN and no null id anywhere in the body',
    !JSON.stringify(rows).includes('NaN') && !JSON.stringify(rows).includes('"id":null'));
}
step('E: a phone the contact already has is not appended again',
  !('phone_numbers' in (E.seen.patches[0]?.body?.data ?? {})));
step('E: an address it already has is not appended again',
  !('addresses' in (E.seen.patches[0]?.body?.data ?? {})));

// ═════════════════════════════════════════════════════════════════════════════
// F. Optional read-only liveness probe.
// ═════════════════════════════════════════════════════════════════════════════
if (BASE) {
  try {
    const r = await realFetch(`${BASE.replace(/\/$/, '')}/booking/types`, { headers: { accept: 'application/json' } });
    const j = await r.json().catch(() => null);
    step('the deployment serves GET /booking/types (read-only probe)',
      r.status === 200 && Array.isArray(j?.types ?? j), { status: r.status });
  } catch (e) {
    step('the deployment serves GET /booking/types (read-only probe)', false, String(e?.message ?? e));
  }
} else {
  out.notes.push('No base URL given — the run was fully offline. Pass a preview URL to add the read-only /booking/types probe.');
}

out.notes.push(
  'STILL A LIVE-PROBE QUESTION: that Clio\'s documented `query` parameter returns the '
  + 'same or better results than the `q` this replaces. The spec does not list `q` at all, '
  + 'and an unrecognised parameter is ignored rather than rejected, so `q` cannot have been '
  + 'filtering. Confirm against the firm\'s account before trusting the search to dedupe.',
);
out.notes.push(
  'STILL A LIVE-PROBE QUESTION: that PATCH /contacts appends rather than replaces. The '
  + 'contract says it appends — a member with no id is created, deletion needs an explicit '
  + '_destroy with an id — and this harness proves we never send _destroy. It cannot prove '
  + 'what Clio does with the body.',
);
out.notes.push(
  'The seven Intake CustomFields must exist in the firm\'s Clio, parent_type Contact, '
  + 'field_type text_line. This code never creates them; scenario D shows what a booking '
  + 'looks like when they are absent (it succeeds, without the structured fields).',
);

out.finishedAt = new Date().toISOString();
out.passed = out.steps.filter((s) => s.ok).length;
out.failed = out.steps.filter((s) => !s.ok).length;
out.verdict = out.failed === 0 && out.writes.length === 0 ? 'GO' : 'NO-GO';

const evidence = fileURLToPath(new URL('./clio-contact-mapping-evidence.json', import.meta.url));
writeFileSync(evidence, JSON.stringify(out, null, 2));

console.log('\n── POST /api/v4/contacts — IDENTITY ONLY ────────────────────────');
console.log(JSON.stringify(A.seen.contacts[0] ?? null, null, 2));
console.log('\n── PATCH /api/v4/contacts/{id} — THE OPTIONAL HALF ──────────────');
console.log(JSON.stringify(A.seen.patches[0]?.body ?? null, null, 2));
console.log('\n── POST /api/v4/custom_fields — MUST BE EMPTY ───────────────────');
console.log(JSON.stringify(A.seen.cfCreates, null, 2));
console.log('\n── THE DESCRIPTION THE CLIENT RECEIVES (unchanged by R2) ────────');
console.log(aEntry?.description ?? '(none)');
console.log('─────────────────────────────────────────────────────────────────');
console.log('\n' + JSON.stringify({
  verdict: out.verdict, passed: out.passed, failed: out.failed,
  unmodelledRequests: out.writes, evidence,
}, null, 2));
