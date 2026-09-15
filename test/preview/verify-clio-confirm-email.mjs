// ── SHELDON-CLIO-CONFIRM-EMAIL — the Preview verifier ────────────────────────
//
//   node test/preview/verify-clio-confirm-email.mjs [previewBaseUrl]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and the evidence file it writes.
//
// ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
// The ticket asks for the EXACT calendar-entry and note request bodies in the PR
// so Zane can read the description with their own eyes before merge. A unit test
// asserts substrings; it does not show a human the sentence a client is about to
// receive. This prints it, verbatim, byte for byte as it would go on the wire.
//
// It also guards a failure mode the type system cannot see. `attendees` and
// `send_email_notification` are NOT in the Clio v4 reference — they were
// established by a live probe. Clio v4 silently DISCARDS unrecognised keys on a
// create body, which is exactly how the previous `contact_id` sat in this code
// looking correct while attaching nothing and sending nothing. If Clio renames or
// drops these keys, NOTHING WILL ERROR: bookings keep returning 201 and clients
// simply stop getting email. Re-run this against a live probe whenever the Clio
// integration is touched.
//
// ── NOTHING IS WRITTEN. AT ALL. ──────────────────────────────────────────────
// This verifier NEVER posts to /booking/create on a deployment. It runs the
// SHIPPED route handler and the SHIPPED Clio adapter in-process with `fetch`
// replaced, so every Clio, Grow and Vantage call is captured instead of sent. An
// "error path" probe in this codebase has already booked a real appointment on
// Paul's calendar once ([[feedback_negative_path_probe_can_write]]); the booking
// endpoint is the single most expensive thing in this tree to probe casually, and
// the confirmation-email path makes it worse — a stray probe now emails a real
// person a real invitation.
//
// The only live traffic, and only when a base URL is passed, is a GET of
// /booking/types — a read that proves the deployment is serving the booking API
// at all. Without a base URL the run is fully offline.
//
// ── WHAT IS REAL HERE, AND WHAT IS NOT ───────────────────────────────────────
//   REAL
//     • functions/booking/create.js, its Turnstile / allow-list / availability /
//       qualifier-binding guards, and functions/booking/_lib/provider-clio.js —
//       the code that ships;
//     • the request bodies below, which are what those modules actually serialise.
//   NOT REAL
//     • Clio. Its responses are stubbed, so this cannot prove Clio ACTS on
//       `attendees` + `send_email_notification`. Only a live probe can. This
//       proves we SEND the shape the probe established.
//     • the rendered email. Clio renders the description; we assert its text.

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { onRequestPost } from '../../donovan-legal-site/functions/booking/create.js';
import { carriesUrlOnce, linesCarryingUrl } from '../helpers/url-lines.mjs';

const BASE = process.argv[2] || '';

const SITEVERIFY     = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES   = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS  = 'https://app.clio.com/api/v4/contacts';
const CLIO_NOTES     = 'https://app.clio.com/api/v4/notes';
const GROW_INBOX     = 'https://grow.clio.com/inbox_leads';
const VANTAGE_UPSERT = 'https://vantage.ticoai.net/upsert-lead';

const CONTACT_ID   = 4242;
const MEETING_LINK = 'https://meet.donovan.law/consult';
const CALL_ID      = 'call_previewverify00000001';

// The exact strings fn/qualifier_submit renders from income_band / net_worth_band.
const BAND_INCOME    = 'Income: $1.5M–$3M';
const BAND_NET_WORTH = 'Net worth: $5M–$15M';
const SUMMARY = [
  '— Perch intake —',
  'Matter: Real estate → Acquisition',
  'Citizenship: U.S. citizen',
  BAND_INCOME,
  BAND_NET_WORTH,
].join('\n');
const TYPED_NOTES = 'I am closing on a property in Palm Beach County next month.';

const FORBIDDEN = [BAND_INCOME, BAND_NET_WORTH, '— Perch intake —', 'income_band', 'net_worth_band', TYPED_NOTES];

const out = {
  order: 'SHELDON-CLIO-CONFIRM-EMAIL',
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

const seen = { entries: [], notes: [], contacts: [], grow: 0, vantage: 0 };

const realFetch = globalThis.fetch;
const stubbedFetch = async (url, init) => {
  const u = String(url);
  const method = init?.method ?? 'GET';

  // Anything that is not an edge we deliberately model is a bug in this harness,
  // not something to pass through — passing through is how a probe writes.
  if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
  if (u.startsWith('https://app.clio.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));
  if (u.startsWith(CLIO_ENTRIES) && method === 'GET') return new Response(JSON.stringify({ data: [] }));
  if (u.startsWith(CLIO_ENTRIES) && method === 'POST') {
    seen.entries.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ data: { id: 999999 } }));
  }
  if (u.startsWith(CLIO_CONTACTS) && method === 'GET') return new Response(JSON.stringify({ data: [] }));
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

  out.writes.push(`${method} ${u}`);
  throw new Error(`harness refused an un-modelled request: ${method} ${u}`);
};
globalThis.fetch = stubbedFetch;

// ── Fixtures ─────────────────────────────────────────────────────────────────

function kv(initial = {}) {
  const store = new Map(Object.entries(initial));
  return {
    _store: store,
    async get(k) { const v = store.get(k); return v === undefined ? null : v; },
    async put(k, v) { store.set(k, String(v)); },
    async delete(k) { store.delete(k); },
  };
}

/** A bridge DO holding the server-written qualifier slot, so the call_id verifies. */
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

const env = {
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
  PERCH_ACTIONS: kv({ [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY, matter: 'real_estate' }) }),
  PERCH_BRIDGE: bridge(),
};

const request = new Request('https://www.donovan.law/booking/create', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '198.51.100.7' },
  body: JSON.stringify({
    type: 'consult',
    slot: futureMondaySlot(),
    name: 'Jane Q Caller',
    email: 'jane.caller@example.com',
    phone: '(561) 555-0142',
    notes: TYPED_NOTES,
    call_id: CALL_ID,
    turnstile_token: 'good-token',
  }),
});

// ── Run ──────────────────────────────────────────────────────────────────────

const savedLog = { log: console.log, warn: console.warn, error: console.error };
const logLines = [];
console.warn = (...a) => logLines.push(a.join(' '));
console.error = (...a) => logLines.push(a.join(' '));
console.log = (...a) => logLines.push(a.join(' '));

let status = 0;
try {
  const res = await onRequestPost({ request, env });
  status = res.status;
} catch (e) {
  out.notes.push(`the run threw: ${String(e?.message ?? e)}`);
} finally {
  Object.assign(console, savedLog);
  globalThis.fetch = realFetch;
}

const entry = seen.entries[0]?.data ?? null;
const note  = seen.notes[0]?.data ?? null;

out.bodies['POST https://app.clio.com/api/v4/calendar_entries'] = seen.entries[0] ?? null;
out.bodies['POST https://app.clio.com/api/v4/notes'] = seen.notes[0] ?? null;
out.bodies['POST https://app.clio.com/api/v4/contacts'] = seen.contacts[0] ?? null;
out.clientFacingDescription = entry?.description ?? null;

step('the booking confirms', status === 201, { status });
step('exactly one calendar entry was created', seen.entries.length === 1, { entries: seen.entries.length });

// 1. The attendee — the whole reason a confirmation email exists.
step('the entry attaches the client as an attendee',
  JSON.stringify(entry?.attendees) === JSON.stringify([{ id: CONTACT_ID, type: 'Contact' }]),
  entry?.attendees);
step('send_email_notification is true',
  entry?.send_email_notification === true, entry?.send_email_notification);
step('contact_id — the key Clio silently discarded — is GONE from the whole body',
  !JSON.stringify(seen.entries[0] ?? {}).includes('contact_id'));

// 2. The description — this is the text Clio emails, verbatim.
const desc = entry?.description ?? '';
const leaked = FORBIDDEN.filter((s) => desc.includes(s));
step('the description carries ZERO band strings and no caller free text',
  leaked.length === 0, { leaked });
step('the description says what the consultation is', desc.includes('Initial Consultation'));
step('the description carries the meeting link, as a whole token on one line',
  carriesUrlOnce(desc, MEETING_LINK), { joinLines: linesCarryingUrl(desc, MEETING_LINK) });
step('the description carries a reschedule line', /reschedule/i.test(desc));

// CONTROL. Without this, "no bands found" could mean the fixture had none.
const control = [`Phone: (561) 555-0142`, `Notes: ${[TYPED_NOTES, SUMMARY].join('\n\n')}`].join('\n');
step('CONTROL — the pre-fix description shape DOES trip the band check',
  FORBIDDEN.filter((s) => control.includes(s)).length >= 3,
  { wouldHaveLeaked: FORBIDDEN.filter((s) => control.includes(s)) });

// 3. The note — the firm's copy.
step('an intake note was filed', seen.notes.length === 1, { notes: seen.notes.length });
step('the note is associated to a Contact', note?.type === 'Contact', note?.type);
step('the note names the SAME contact as the attendee',
  note?.contact?.id === entry?.attendees?.[0]?.id, { note: note?.contact?.id, attendee: entry?.attendees?.[0]?.id });
step('the note carries the full qualification, bands included',
  !!note && [BAND_INCOME, BAND_NET_WORTH, TYPED_NOTES].every((s) => note.detail.includes(s)));

// 4. Location.
step('location carries the meeting link', entry?.location === MEETING_LINK, entry?.location);

// 5. Logs.
step('no band string reached a log line',
  ![BAND_INCOME, BAND_NET_WORTH].some((s) => logLines.join('\n').includes(s)));

// 5b. THE DEFAULT MODE — the meeting Clio mints (SHELDON-CLIO-DYNAMIC-ZOOM).
//
// Everything above ran with BOOKING_MEETING_LINK SET, which is now the FALLBACK
// posture — the firm's static room, for accounts on an ineligible Clio pricing
// tier or with no Zoom connected. The shipping DEFAULT is unset: the entry asks
// Clio to mint a unique Zoom meeting per booking and Clio fills `location` itself.
// That is the body a live probe has to be compared against, so it is printed here
// too. Same harness, fresh KV/bridge/IP so neither the qualifier one-shot nor the
// idempotency cache carries over from the run above.
const dynSeen = { entries: [], notes: [], contacts: [] };
{
  const outerEntries = seen.entries, outerNotes = seen.notes, outerContacts = seen.contacts;
  seen.entries = dynSeen.entries; seen.notes = dynSeen.notes; seen.contacts = dynSeen.contacts;
  globalThis.fetch = stubbedFetch;
  const dynSaved = { log: console.log, warn: console.warn, error: console.error };
  const dynLogLines = [];
  console.log = console.warn = console.error = (...a) => dynLogLines.push(a.join(' '));
  let dynStatus = 0;
  try {
    const r = await onRequestPost({
      request: new Request('https://www.donovan.law/booking/create', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'CF-Connecting-IP': '198.51.100.9' },
        body: JSON.stringify({
          type: 'consult', slot: futureMondaySlot(), name: 'Jane Q Caller',
          email: 'jane.caller@example.com', phone: '(561) 555-0142',
          notes: TYPED_NOTES, call_id: CALL_ID, turnstile_token: 'good-token',
        }),
      }),
      env: {
        ...env,
        BOOKING_MEETING_LINK: '',
        PERCH_ACTIONS: kv({ [`qualbk:${CALL_ID}`]: JSON.stringify({ summary: SUMMARY, matter: 'real_estate' }) }),
        PERCH_BRIDGE: bridge(),
      },
    });
    dynStatus = r.status;
  } catch (e) {
    out.notes.push(`the dynamic-mode run threw: ${String(e?.message ?? e)}`);
  } finally {
    Object.assign(console, dynSaved);
    globalThis.fetch = realFetch;
    seen.entries = outerEntries; seen.notes = outerNotes; seen.contacts = outerContacts;
  }

  const dynEntry = dynSeen.entries[0]?.data ?? null;
  out.bodies['DEFAULT MODE — POST https://app.clio.com/api/v4/calendar_entries'] = dynSeen.entries[0] ?? null;

  step('DEFAULT MODE: the booking confirms with no BOOKING_MEETING_LINK', dynStatus === 201, { status: dynStatus });
  step('DEFAULT MODE: the entry asks Clio to mint a meeting — conference_meeting type "zoom"',
    JSON.stringify(dynEntry?.conference_meeting) === JSON.stringify({ type: 'zoom' }),
    dynEntry?.conference_meeting);
  step('DEFAULT MODE: no static `location` is pre-filled — Clio writes its own',
    dynEntry?.location === undefined, dynEntry?.location);
  step('DEFAULT MODE: the attendee and send_email_notification are unchanged',
    JSON.stringify(dynEntry?.attendees) === JSON.stringify([{ id: CONTACT_ID, type: 'Contact' }])
      && dynEntry?.send_email_notification === true,
    { attendees: dynEntry?.attendees, send: dynEntry?.send_email_notification });
  step('DEFAULT MODE: the description is still band-free and carries no caller text',
    FORBIDDEN.every((s) => !(dynEntry?.description ?? '').includes(s)),
    { leaked: FORBIDDEN.filter((s) => (dynEntry?.description ?? '').includes(s)) });
  step('DEFAULT MODE: the intake note still carries the full qualification',
    dynSeen.notes.length === 1
      && [BAND_INCOME, BAND_NET_WORTH, TYPED_NOTES].every((s) => dynSeen.notes[0].data.detail.includes(s)),
    { notes: dynSeen.notes.length });
  out.dynamicClientFacingDescription = dynEntry?.description ?? null;
}

// 6. Optional read-only liveness probe.
if (BASE) {
  try {
    const r = await realFetch(`${BASE.replace(/\/$/, '')}/booking/types`, { headers: { accept: 'application/json' } });
    const j = await r.json().catch(() => null);
    step('the deployment serves GET /booking/types (read-only probe)',
      r.status === 200 && Array.isArray(j?.types ?? j),
      { status: r.status });
  } catch (e) {
    step('the deployment serves GET /booking/types (read-only probe)', false, String(e?.message ?? e));
  }
} else {
  out.notes.push('No base URL given — the run was fully offline. Pass a preview URL to add the read-only /booking/types probe.');
}

out.notes.push(
  'attendees and send_email_notification are UNDOCUMENTED. Clio discards unknown keys '
  + 'silently, so a Clio-side rename shows up as "clients stopped getting email", never as an error. '
  + 'Re-run a live probe whenever the Clio integration is touched.',
);
out.notes.push(
  'CLIO_CREATE_CONTACT gates the whole contact side: no contact means no attendee, no '
  + 'confirmation email and no intake note. David owns that value; this run assumes it is on.',
);

out.finishedAt = new Date().toISOString();
out.passed = out.steps.filter((s) => s.ok).length;
out.failed = out.steps.filter((s) => !s.ok).length;
out.verdict = out.failed === 0 && out.writes.length === 0 ? 'GO' : 'NO-GO';

const evidence = fileURLToPath(new URL('./clio-confirm-email-evidence.json', import.meta.url));
writeFileSync(evidence, JSON.stringify(out, null, 2));

console.log('\n── THE DESCRIPTION THE CLIENT RECEIVES ──────────────────────────');
console.log(desc);
console.log('─────────────────────────────────────────────────────────────────');
console.log('\nPOST /api/v4/calendar_entries\n' + JSON.stringify(seen.entries[0] ?? null, null, 2));
console.log('\nPOST /api/v4/notes\n' + JSON.stringify(seen.notes[0] ?? null, null, 2));
console.log('\n' + JSON.stringify({
  verdict: out.verdict, passed: out.passed, failed: out.failed,
  unmodelledRequests: out.writes, evidence,
}, null, 2));
