// ── ORDER SHELDON-CLIO-CONFIRM-EMAIL ─────────────────────────────────────────
//
// Two defects that only make sense together.
//
// 1. NOBODY EVER GOT A CONFIRMATION EMAIL. The Clio calendar-entry create body
//    carried `contact_id`. That is NOT a field on POST /api/v4/calendar_entries.
//    Clio v4 silently DISCARDS unrecognised keys on a create body, so the call
//    returned 201 with a real entry, no attendee ever attached, and no email was
//    ever sent. Nothing errored — the failure was a 201 that did less than it
//    looked like. A live probe against the firm's Clio established the shape that
//    actually dispatches: `attendees:[{id,type:"Contact"}]` plus
//    `send_email_notification:true`.
//
// 2. FIXING (1) ALONE WOULD HAVE LEAKED. Clio renders the entry `description`
//    verbatim into the attendee's email and the .ics. The description carried
//    `enrichedNotes` — the caller's typed text PLUS the Perch qualifier block,
//    which spells out income_band and net_worth_band in words ("Income:
//    $1.5M–$3M"). Attaching an attendee turns that internal field into an
//    outbound message to the client whose finances it describes. Attendee-attach
//    and the description split are therefore ONE commit and must never be
//    separated; this suite fails loudly if a later change lands one without the
//    other.
//
// WHAT THIS FILE PROVES, and what it cannot:
//
//   PROVEN HERE (against the shipped adapter, through the real route handler)
//     • the entry body carries the attendee and send_email_notification, and
//       carries NO contact_id anywhere;
//     • the description carries client-safe text and ZERO band strings, under
//       hostile input — bands stuffed into every free-text field a caller can
//       reach, and into the qualifier record itself;
//     • the intake summary lands on a Note associated to the CONTACT;
//     • `location` carries the meeting link.
//
//   NOT PROVEN HERE, and no assertion below claims it
//     • that Clio actually SENDS on these keys. They are undocumented and were
//       established by a live probe; only a live probe can re-establish them. See
//       test/preview/verify-clio-confirm-email.mjs, which prints the exact bodies
//       for a human to compare against the probe.
//     • what the rendered email looks like. The description text is asserted; the
//       rendering is Clio's.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import { buildClientDescription } from '../donovan-legal-site/functions/booking/_lib/provider-clio.js';
import { stubFetch, muteConsole, makeKV, makeDurableObject } from './helpers/stubs.mjs';
import { assertCarriesUrl } from './helpers/url-lines.mjs';

const SITEVERIFY     = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES   = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS  = 'https://app.clio.com/api/v4/contacts';
const CLIO_NOTES     = 'https://app.clio.com/api/v4/notes';
const GROW_INBOX     = 'https://grow.clio.com/inbox_leads';
const VANTAGE_UPSERT = 'https://vantage.ticoai.net/upsert-lead';

const CONTACT_ID   = 4242;
const MEETING_LINK = 'https://meet.donovan.law/consult';
const CALL_ID      = 'call_confirmemail0000000001';

// The exact strings fn/qualifier_submit renders from income_band and
// net_worth_band (see its LABELS table). These are the payload: every "must not
// appear" assertion in this file is about THESE, not about a paraphrase of them.
const BAND_INCOME    = 'Income: $1.5M–$3M';
const BAND_NET_WORTH = 'Net worth: $5M–$15M';
const SUMMARY = [
  '— Perch intake —',
  'Matter: Real estate → Acquisition',
  BAND_INCOME,
  BAND_NET_WORTH,
].join('\n');

/** Everything that must never reach a client-facing surface. */
const FORBIDDEN = [BAND_INCOME, BAND_NET_WORTH, '— Perch intake —', 'income_band', 'net_worth_band'];

function env(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    CLIO_CLIENT_ID: 'cid',
    CLIO_CLIENT_SECRET: 'csec',
    CLIO_REFRESH_TOKEN: 'rtok',
    CLIO_CALENDAR_ID: 9084638,
    GROW_LEAD_TOKEN: 'grow-tok',
    VANTAGE_WRITE_SECRET: 'vantage-write-secret',
    CLIO_CREATE_CONTACT: '1',
    BOOKING_MEETING_LINK: MEETING_LINK,
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
const nextIp = () => `198.51.100.${(_ipSeq += 1) % 250}`;

function post(b) {
  return new Request('https://www.donovan.law/booking/create', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() },
    body: JSON.stringify(b),
  });
}

function body(over = {}) {
  return {
    type: 'consult',
    slot: SLOT,
    name: 'Jane Q Caller',
    email: 'jane.caller@example.com',
    phone: '(561) 555-0142',
    turnstile_token: 'good-token',
    ...over,
  };
}

/** Bridge holding the server-written qualifier slot, so the call_id verifies. */
function bridgeWithQualifier(callId = CALL_ID) {
  const ns = makeDurableObject();
  ns.instance('donovan').state.set(`qual:${callId}`, { status: 'complete' });
  return ns;
}

function kvWithQualifier(callId = CALL_ID, summary = SUMMARY) {
  return makeKV({ [`qualbk:${callId}`]: JSON.stringify({ summary, matter: 'real_estate' }) });
}

/**
 * Stub every edge the booking path touches. `contactFound` lets a test choose
 * between the search hit and the create branch; `noteStatus` lets a test make the
 * note write fail without failing anything else.
 */
function stubAll({ contactFound = false, noteStatus = 200, contactCreateStatus = 200, entryData = { id: 999999 } } = {}) {
  const seen = { entries: [], notes: [], contacts: [] };
  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
    if (u.startsWith('https://app.clio.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));
    if (u.startsWith(CLIO_ENTRIES) && method === 'GET') return new Response(JSON.stringify({ data: [] }));
    if (u.startsWith(CLIO_ENTRIES) && method === 'POST') {
      seen.entries.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: entryData }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      return new Response(JSON.stringify({
        data: contactFound
          ? [{ id: CONTACT_ID, email_addresses: [{ address: 'jane.caller@example.com' }] }]
          : [],
      }));
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      seen.contacts.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: CONTACT_ID } }), { status: contactCreateStatus });
    }
    if (u.startsWith(CLIO_NOTES) && method === 'POST') {
      seen.notes.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 77 } }), { status: noteStatus });
    }
    if (u.startsWith(GROW_INBOX)) return new Response(JSON.stringify({ ok: true }));
    if (u.startsWith(VANTAGE_UPSERT)) return new Response(JSON.stringify({ ok: true }));
    throw new Error(`unstubbed fetch: ${method} ${u}`);
  });
  return { seen, restore: () => handle.restore() };
}

/** The single calendar entry's `data`, with a count assertion so "no write" can't pass silently. */
function entry(seen) {
  assert.equal(seen.entries.length, 1, 'exactly one calendar entry');
  return seen.entries[0].data;
}

let stub, mute;
beforeEach(() => { stub = stubAll(); mute = muteConsole(); });
afterEach(() => { stub.restore(); mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// 1. THE DEFECT — the entry now attaches an attendee and asks Clio to send
// ─────────────────────────────────────────────────────────────────────────────
describe('the calendar entry attaches the client as an attendee and asks Clio to email', () => {
  test('THE FIX: attendees + send_email_notification present, contact_id GONE', async () => {
    const res = await onRequestPost({
      request: post(body()),
      env: env({ PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: bridgeWithQualifier() }),
    });
    assert.equal(res.status, 201);

    const e = entry(stub.seen);
    assert.deepEqual(e.attendees, [{ id: CONTACT_ID, type: 'Contact' }, { id: 9084638, type: 'Calendar' }],
      'the attendee is the resolved Clio contact — this is what Clio emails');
    assert.equal(e.send_email_notification, true, 'and Clio is told to send');
  });

  test('THE DEFECT: `contact_id` appears NOWHERE in the create body', async () => {
    // Asserted over the serialised body, not over one key, because the defect was
    // never "the wrong value" — it was a key Clio does not recognise, which it
    // discards without complaint. A key it discards can be re-added anywhere in
    // the object and nothing would fail except this.
    await onRequestPost({
      request: post(body()),
      env: env({ PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: bridgeWithQualifier() }),
    });
    const raw = JSON.stringify(stub.seen.entries[0]);
    assert.ok(!raw.includes('contact_id'),
      `the discarded field is back — that is the "201 that sends nothing" bug.\nGot:\n${raw}`);
  });

  test('an existing contact is reused as the attendee — no duplicate person in Manage', async () => {
    stub.restore();
    stub = stubAll({ contactFound: true });
    await onRequestPost({
      request: post(body()),
      env: env({ PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: bridgeWithQualifier() }),
    });
    assert.equal(stub.seen.contacts.length, 0, 'the search hit, so nothing was created');
    assert.deepEqual(entry(stub.seen).attendees, [{ id: CONTACT_ID, type: 'Contact' }, { id: 9084638, type: 'Calendar' }]);
  });

  test('no contact ⇒ no attendee AND no send flag — never a send with nobody to send to', async () => {
    // The flag is David's switch. Off is today's behaviour: an entry on Paul's
    // calendar and no email. What must NOT happen is send_email_notification:true
    // riding out with an empty attendee list.
    await onRequestPost({
      request: post(body()),
      env: env({ CLIO_CREATE_CONTACT: '', PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: bridgeWithQualifier() }),
    });
    const e = entry(stub.seen);
    assert.equal(e.attendees, undefined);
    assert.equal(e.send_email_notification, undefined);
    assert.equal(stub.seen.notes.length, 0, 'and no note, because there is no contact to hang one off');
  });

  test('the flag accepts the spellings an operator actually types', async () => {
    // A dashboard value of `true` used to be a silent no-op against `=== "1"`,
    // which is indistinguishable from the bug this ticket fixes: a booking that
    // confirms and emails nobody.
    for (const spelling of ['1', 'true', 'TRUE', 'yes', 'on']) {
      stub.restore(); stub = stubAll();
      await onRequestPost({
        request: post(body()),
        env: env({ CLIO_CREATE_CONTACT: spelling, PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: bridgeWithQualifier() }),
      });
      assert.equal(entry(stub.seen).send_email_notification, true, `"${spelling}" must enable the email path`);
    }
    for (const spelling of ['', '0', 'false', 'no', 'off']) {
      stub.restore(); stub = stubAll();
      await onRequestPost({
        request: post(body()),
        env: env({ CLIO_CREATE_CONTACT: spelling, PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: bridgeWithQualifier() }),
      });
      assert.equal(entry(stub.seen).send_email_notification, undefined, `"${spelling}" must NOT enable it`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. THE LEAK — the description is now an outbound message
// ─────────────────────────────────────────────────────────────────────────────
describe('the entry description is client-safe, and carries no qualification bands', () => {
  test('THE GUARD: a verified qualifier full of bands reaches the note, never the description', async () => {
    const res = await onRequestPost({
      request: post(body({ call_id: CALL_ID, notes: 'Bringing my spouse.' })),
      env: env({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: bridgeWithQualifier() }),
    });
    assert.equal(res.status, 201);

    const desc = entry(stub.seen).description;
    for (const s of FORBIDDEN) {
      assert.ok(!desc.includes(s), `"${s}" must never reach the client's email.\nDescription was:\n${desc}`);
    }
    assert.ok(!desc.includes('Bringing my spouse.'), 'nor the caller\'s own free text');

    // …and it did not simply vanish.
    assert.equal(stub.seen.notes.length, 1, 'exactly one contact note');
    const note = stub.seen.notes[0].data;
    assert.ok(note.detail.includes(BAND_INCOME) && note.detail.includes(BAND_NET_WORTH),
      'the firm still gets the full qualification — attorney-side');
  });

  test('the description says what the consultation is, links the meeting, and offers a reschedule', async () => {
    await onRequestPost({
      request: post(body()),
      env: env({ PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: bridgeWithQualifier() }),
    });
    const desc = entry(stub.seen).description;
    assert.ok(desc.includes('Initial Consultation'), 'what it is — the configured type NAME, not the id');
    assertCarriesUrl(desc, MEETING_LINK, 'the meeting link — on its own line, not buried in a longer URL');
    assert.ok(/reschedule/i.test(desc), 'a reschedule line');
    assert.ok(desc.includes('(561) 666-6022') || desc.includes('info@donovan.law'),
      'and a way to act on it — both are already public on the site');
  });

  test('HOSTILE INPUT: bands stuffed into every field a caller controls stay out', async () => {
    // The caller controls name, phone, notes and the type id. None of them may be
    // a route into the description. This is the "by any path" clause of the order,
    // exercised rather than asserted about.
    const poison = `${BAND_INCOME} / ${BAND_NET_WORTH} / income_band net_worth_band`;
    await onRequestPost({
      request: post(body({
        name:  `Jane ${poison}`,
        phone: `555-0142 ${poison}`,
        notes: poison,
        call_id: CALL_ID,
      })),
      env: env({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: bridgeWithQualifier() }),
    });

    const desc = entry(stub.seen).description;
    for (const s of FORBIDDEN) {
      assert.ok(!desc.includes(s), `"${s}" reached the description through caller-controlled input.\nGot:\n${desc}`);
    }
  });

  test('EVERY join outcome produces the same client-safe description', async () => {
    // none / unverified / verified-no-summary / attached. The description must not
    // be conditional on the qualifier at all — a description that is safe only on
    // some branches is the shape that leaks the first time a branch is added.
    const cases = [
      { name: 'none',                callId: undefined, kv: makeKV(),            bridge: bridgeWithQualifier() },
      { name: 'unverified',          callId: CALL_ID,   kv: makeKV(),            bridge: makeDurableObject() },
      { name: 'verified_no_summary', callId: CALL_ID,   kv: makeKV(),            bridge: bridgeWithQualifier() },
      { name: 'attached',            callId: CALL_ID,   kv: kvWithQualifier(),   bridge: bridgeWithQualifier() },
    ];
    const seenDescriptions = new Set();
    for (const c of cases) {
      stub.restore(); stub = stubAll();
      await onRequestPost({
        request: post(body({ call_id: c.callId, notes: 'some typed text' })),
        env: env({ PERCH_ACTIONS: c.kv, PERCH_BRIDGE: c.bridge }),
      });
      const desc = entry(stub.seen).description;
      for (const s of FORBIDDEN) assert.ok(!desc.includes(s), `${c.name}: "${s}" leaked`);
      seenDescriptions.add(desc);
    }
    assert.equal(seenDescriptions.size, 1,
      'the description is identical across all four join outcomes — it depends on config only');
  });

  test('CONTROL: the assertion is not vacuous — the OLD description shape fails it', async () => {
    // [[feedback_fixture_must_reproduce_the_defect]]. Rebuild the pre-fix
    // description from the same inputs and run it through the same check. If this
    // passes, every "no bands" assertion above proves nothing.
    const enrichedNotes = ['I have a closing.', SUMMARY].join('\n\n');
    const oldShape = [
      'Phone: (561) 555-0142',
      'Email: jane.caller@example.com',
      `Notes: ${enrichedNotes}`,
    ].join('\n');

    const leaked = FORBIDDEN.filter((s) => oldShape.includes(s));
    assert.ok(leaked.length >= 2,
      'the pre-fix description must trip this check, or the check tests nothing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. THE STRUCTURAL GUARANTEE — the description builder has no way in
// ─────────────────────────────────────────────────────────────────────────────
describe('buildClientDescription cannot be handed caller text', () => {
  test('extra properties — including bands — are ignored, not appended', async () => {
    // The claim is about the FUNCTION, not about its call sites: even a future
    // caller that passes the qualifier in cannot get it out. Asserted on
    // behaviour rather than on the source spelling
    // ([[feedback_assert_behavior_not_source_spelling]]).
    const desc = buildClientDescription({
      typeName: 'Initial Consultation',
      meetingLink: MEETING_LINK,
      firmPhone: '(561) 666-6022',
      firmEmail: 'info@donovan.law',
      // everything a careless caller might add:
      notes: 'I have a closing.',
      intakeSummary: SUMMARY,
      enrichedNotes: SUMMARY,
      income_band: '1_5m_3m',
      net_worth_band: '5m_15m',
      contact: { email: 'jane.caller@example.com', phone: '555-0142' },
    });
    for (const s of [...FORBIDDEN, 'I have a closing.', 'jane.caller@example.com', '555-0142']) {
      assert.ok(!desc.includes(s), `"${s}" came back out of buildClientDescription`);
    }
    assert.ok(desc.includes('Initial Consultation'), 'what it IS still comes back out');
    assertCarriesUrl(desc, MEETING_LINK, 'and so does the join link');
  });

  test('CONTROL: the check would fire — the same strings pass through a naive builder', () => {
    const naive = (p) => `${p.typeName}\nNotes: ${p.notes}\n${p.intakeSummary}`;
    const bad = naive({ typeName: 'Initial Consultation', notes: 'I have a closing.', intakeSummary: SUMMARY });
    assert.ok(FORBIDDEN.some((s) => bad.includes(s)), 'the control must leak, or the test above is vacuous');
  });

  test('an unmatched type id never becomes description text', () => {
    // typeId is allow-listed at the route, but the description resolves the type
    // NAME from config and falls back to a fixed string, so even a bypass of that
    // allow-list cannot echo an attacker-chosen id into an outbound email.
    const desc = buildClientDescription({ typeName: '', meetingLink: '', firmPhone: '', firmEmail: '' });
    assert.ok(desc.includes('Consultation'), 'a fixed fallback, not an echo');
    assert.ok(!desc.includes('undefined') && !desc.includes('null'));
  });

  test('the route never hands the adapter the bundled enrichedNotes', () => {
    // The route is the only caller. A source guard here because the behavioural
    // tests above would still pass if a future edit re-bundled the arguments and
    // the adapter happened to ignore them today — this is the shape that must not
    // come back, since it is one line away from the leak.
    const src = readFileSync(
      fileURLToPath(new URL('../donovan-legal-site/functions/booking/create.js', import.meta.url)),
      'utf8',
    );
    const call = src.slice(src.indexOf('adapter.createBooking('));
    const args = call.slice(0, call.indexOf('}, env)'));
    assert.ok(!/notes:\s*enrichedNotes/.test(args),
      'the adapter must receive `notes` and `intakeSummary` separately, never the bundle');
    assert.ok(/intakeSummary:/.test(args), 'and the summary must still be passed, or the note goes empty');
  });

  test('CONTROL: that source guard would fire', () => {
    assert.ok(/notes:\s*enrichedNotes/.test('      notes: enrichedNotes,\n'));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. THE NOTE — the firm's copy, on the contact
// ─────────────────────────────────────────────────────────────────────────────
describe('the intake summary is filed as a Note on the contact', () => {
  test('the note is associated to the contact, by type and by id', async () => {
    await onRequestPost({
      request: post(body({ call_id: CALL_ID, notes: 'I have a closing.' })),
      env: env({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: bridgeWithQualifier() }),
    });
    assert.equal(stub.seen.notes.length, 1);
    const n = stub.seen.notes[0].data;
    assert.equal(n.type, 'Contact');
    assert.deepEqual(n.contact, { id: CONTACT_ID });
    assert.equal(n.contact.id, entry(stub.seen).attendees[0].id,
      'the note and the attendee name the SAME contact — otherwise Paul reads a stranger\'s intake');
    assert.ok(n.subject, 'the note has a subject, so it is findable in Manage');
  });

  test('the note carries everything the description gave up', async () => {
    await onRequestPost({
      request: post(body({ call_id: CALL_ID, notes: 'I have a closing.' })),
      env: env({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: bridgeWithQualifier() }),
    });
    const detail = stub.seen.notes[0].data.detail;
    for (const s of ['I have a closing.', BAND_INCOME, BAND_NET_WORTH, '— Perch intake —',
      '(561) 555-0142', 'jane.caller@example.com', 'Initial Consultation']) {
      assert.ok(detail.includes(s), `the note must carry "${s}"\nGot:\n${detail}`);
    }
  });

  test('a note that fails to file never costs the caller their appointment', async () => {
    // The entry is already created by the time the note is attempted. A 500 from
    // /notes must not turn a confirmed consultation into a 502.
    stub.restore();
    stub = stubAll({ noteStatus: 500 });
    const res = await onRequestPost({
      request: post(body({ call_id: CALL_ID })),
      env: env({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: bridgeWithQualifier() }),
    });
    assert.equal(res.status, 201, 'the booking stands');
    assert.equal(entry(stub.seen).send_email_notification, true, 'and the client is still emailed');
    assert.ok(mute.saw('intake note not filed'), 'but the operator is told');
  });

  test('the note body is never logged — it is the one string that must not leak to a log', async () => {
    stub.restore();
    stub = stubAll({ noteStatus: 500 });
    await onRequestPost({
      request: post(body({ call_id: CALL_ID })),
      env: env({ PERCH_ACTIONS: kvWithQualifier(), PERCH_BRIDGE: bridgeWithQualifier() }),
    });
    for (const s of [BAND_INCOME, BAND_NET_WORTH]) {
      assert.ok(!mute.saw(s), `"${s}" reached a log line`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. THE MEETING — dynamic per booking by default, a static room as the fallback
//
// SHELDON-CLIO-DYNAMIC-ZOOM. `data.conference_meeting` is SPEC-BACKED, unlike the
// attendee keys above: integrations/clio/openapi.v4.json documents it on POST
// /calendar_entries.json as an object whose only property is `type`, enum exactly
// ["zoom"]. Sent, Clio mints a unique Zoom meeting for that entry and fills
// `location` itself. It resolves to null on an ineligible pricing tier or with no
// Zoom connected — which is what BOOKING_MEETING_LINK is now the fallback for.
//
// The invariant these tests exist for is EXACTLY ONE meeting source per body.
// Both would mean pre-filling the field Clio needs in order to hand the client
// the meeting it just minted.
// ─────────────────────────────────────────────────────────────────────────────

/** Env with no BOOKING_MEETING_LINK at all — the shipping default. */
const dynamicEnv = (over = {}) =>
  env({ BOOKING_MEETING_LINK: '', PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: bridgeWithQualifier(), ...over });
/** Env with the firm's permanent room configured — the escape hatch. */
const staticEnv = (over = {}) =>
  env({ PERCH_ACTIONS: makeKV(), PERCH_BRIDGE: bridgeWithQualifier(), ...over });

describe('DEFAULT — an unset BOOKING_MEETING_LINK asks Clio to mint a meeting', () => {
  test('the create body carries conference_meeting type "zoom" and NO static location', async () => {
    const res = await onRequestPost({ request: post(body()), env: dynamicEnv() });
    assert.equal(res.status, 201);

    const e = entry(stub.seen);
    assert.deepEqual(e.conference_meeting, { type: 'zoom' },
      'the spec enum is exactly ["zoom"]; nothing else is a valid value');
    assert.equal(typeof e.conference_meeting.type, 'string', 'the literal string, not a symbol or a flag');
    assert.equal(e.location, undefined,
      'Clio writes `location` itself here — pre-filling it would overwrite the wrapper URL');
  });

  test('the description stays band-free, and claims no join link it cannot have yet', async () => {
    await onRequestPost({
      request: post(body({ call_id: CALL_ID, notes: 'Bringing my spouse.' })),
      env: dynamicEnv({ PERCH_ACTIONS: kvWithQualifier() }),
    });
    const desc = entry(stub.seen).description;
    for (const s of FORBIDDEN) {
      assert.ok(!desc.includes(s), `"${s}" reached the client's email in DYNAMIC mode.\nGot:\n${desc}`);
    }
    assert.ok(!desc.includes('Bringing my spouse.'), 'nor the caller\'s own free text');
    assert.ok(!/Join the meeting/i.test(desc),
      'the URL does not exist until Clio answers this POST; Clio\'s own invite and .ics carry it');
    assert.ok(/reschedule/i.test(desc), 'the rest of the description is unaffected');
  });
});

describe('FALLBACK — a configured BOOKING_MEETING_LINK is an explicit static room', () => {
  test('the create body carries the static location and NO conference_meeting', async () => {
    const res = await onRequestPost({ request: post(body()), env: staticEnv() });
    assert.equal(res.status, 201);

    const e = entry(stub.seen);
    assert.equal(e.location, MEETING_LINK, '`location` is the .ics LOCATION line');
    assert.equal(e.conference_meeting, undefined,
      'no meeting is minted for a room the firm already owns — and nothing is left to resolve to null');
  });

  test('the description stays band-free and links the configured room', async () => {
    await onRequestPost({
      request: post(body({ call_id: CALL_ID, notes: 'Bringing my spouse.' })),
      env: staticEnv({ PERCH_ACTIONS: kvWithQualifier() }),
    });
    const desc = entry(stub.seen).description;
    for (const s of FORBIDDEN) {
      assert.ok(!desc.includes(s), `"${s}" reached the client's email in STATIC mode.\nGot:\n${desc}`);
    }
    assert.ok(!desc.includes('Bringing my spouse.'), 'nor the caller\'s own free text');
    assertCarriesUrl(desc, MEETING_LINK, 'the configured room is what the description offers to join');
  });

  test('the link is an environment override, so onboarding is a dashboard change', async () => {
    const other = 'https://us02web.zoom.us/j/1234567890';
    await onRequestPost({ request: post(body()), env: staticEnv({ BOOKING_MEETING_LINK: other }) });
    const e = entry(stub.seen);
    assert.equal(e.location, other);
    assert.equal(e.conference_meeting, undefined, 'still a static room, whichever room it is');
    assertCarriesUrl(e.description, other, 'the overridden link is the one the description offers to join');
  });
});

describe('BOTH MODES — exactly one meeting source, and Phase 1 survives either', () => {
  const MODES = [
    { name: 'dynamic (default)', makeEnv: dynamicEnv },
    { name: 'static (fallback)', makeEnv: staticEnv },
  ];

  test('never both a static location and a minted meeting on the same body', async () => {
    // The failure this guards is silent: a body carrying both still 201s, and the
    // client is handed whichever URL Clio did not overwrite.
    for (const m of MODES) {
      stub.restore(); stub = stubAll();
      await onRequestPost({ request: post(body()), env: m.makeEnv() });
      const e = entry(stub.seen);
      const sources = [e.location, e.conference_meeting].filter((v) => v !== undefined);
      assert.equal(sources.length, 1, `${m.name}: expected exactly one meeting source, got ${sources.length}`);
    }
  });

  test('attendee, send_email_notification and the contact note are intact in both', async () => {
    // The Phase-1 guarantees are not conditional on how the meeting is made.
    for (const m of MODES) {
      stub.restore(); stub = stubAll();
      const res = await onRequestPost({
        request: post(body({ call_id: CALL_ID })),
        env: m.makeEnv({ PERCH_ACTIONS: kvWithQualifier() }),
      });
      assert.equal(res.status, 201, `${m.name}: the booking confirms`);

      const e = entry(stub.seen);
      assert.deepEqual(e.attendees, [{ id: CONTACT_ID, type: 'Contact' }, { id: 9084638, type: 'Calendar' }], `${m.name}: the attendee is attached`);
      assert.equal(e.send_email_notification, true, `${m.name}: Clio is told to send`);
      assert.equal(e.contact_id, undefined, `${m.name}: the key Clio silently discards stays gone`);

      assert.equal(stub.seen.notes.length, 1, `${m.name}: exactly one contact note`);
      const note = stub.seen.notes[0].data;
      assert.equal(note.type, 'Contact', `${m.name}: associated to a Contact`);
      assert.equal(note.contact.id, CONTACT_ID, `${m.name}: and to THIS caller`);
      assert.ok(note.detail.includes(BAND_INCOME) && note.detail.includes(BAND_NET_WORTH),
        `${m.name}: the firm still gets the full qualification, attorney-side`);
    }
  });
});

describe('the dynamic read-back tolerates Clio\'s wrapper, and logs none of it', () => {
  // What a live dynamic 201 answers with. `location` is no longer a URL we chose:
  // Clio replaces it with its own video_conferences wrapper, and conference_meeting
  // comes back populated per ConferenceMeeting_base in the vendored spec —
  // join_url, conference_id, conference_password.
  const WRAPPER_TOKEN = 'wrapPathTokenAbc123Def456';
  const JOIN_TOKEN    = 'joinUrlTokenXyz789';
  const PASSWORD      = 'pwdTokenQrs456';
  const DYNAMIC_201 = {
    id: 999999,
    location: `https://app.clio.com/video_conferences/${WRAPPER_TOKEN}`,
    conference_meeting: {
      id: 55,
      type: 'zoom',
      join_url: `https://us02web.zoom.us/j/98765432100?pwd=${JOIN_TOKEN}`,
      conference_id: 98765432100,
      conference_password: PASSWORD,
    },
  };

  test('a wrapper URL in the response does not disturb the booking', async () => {
    stub.restore(); stub = stubAll({ entryData: DYNAMIC_201 });
    const res = await onRequestPost({ request: post(body()), env: dynamicEnv() });

    assert.equal(res.status, 201, 'a location we did not choose is not an error');
    const payload = await res.json();
    assert.equal(payload.provider_ref, '999999',
      'the read-back takes the entry id and nothing else, so the wrapper shape cannot break it');
  });

  test('no wrapper token, join token or meeting password reaches a log line', async () => {
    // Asserted on the opaque TOKENS rather than the URLs: the token is the bearer
    // capability — anyone holding it is in the client's consultation.
    stub.restore(); stub = stubAll({ entryData: DYNAMIC_201 });
    await onRequestPost({ request: post(body()), env: dynamicEnv() });

    for (const secret of [WRAPPER_TOKEN, JOIN_TOKEN, PASSWORD]) {
      assert.ok(!mute.saw(secret), `"${secret}" reached a log line`);
    }
  });

  test('CONTROL: the log check would fire — muteConsole does see what is printed', () => {
    // [[feedback_idle_with_zero_tasks_is_a_vacuous_pass]]. Without this, "no token
    // in the logs" could just mean nothing was logged at all.
    console.warn(`[test] ${WRAPPER_TOKEN}`);
    assert.ok(mute.saw(WRAPPER_TOKEN), 'the harness must be able to see a token, or the test above proves nothing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. THE WIDGET PROMISE — accurate now that the email path is real
// ─────────────────────────────────────────────────────────────────────────────
describe('the widget no longer promises an email nothing sends', () => {
  test('the confirmation string still promises an email, and now mentions the invite', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../donovan-legal-site/js/booking-widget.js', import.meta.url)),
      'utf8',
    );
    const line = src.split('\n').find((l) => l.trim().startsWith('confirmEmail:'));
    assert.ok(line, 'the string is still in the catalogue');
    assert.ok(/calendar invitation|invite/i.test(line),
      'the entry now carries an attendee, so the .ics is part of what arrives');
    assert.ok(/confirmation email/i.test(line));
  });
});
