// ── ORDER SHELDON-BOOKING-SAFETY ─────────────────────────────────────────────
//
// Two live paths survived SHELDON-CLIO-BUSYBLOCKS (129). Both end in the same place
// 129 exists to prevent — two people arriving for the same consultation on a live
// legal calendar — and neither is visible to the guard 129 added, because neither
// produces a wrong-shaped response. They produce perfectly well-formed ones.
//
// 134 — THE RETRY IS THE SECOND WRITER. clioFetch retried on 429/5xx branching on
// the STATUS and never on the METHOD. So: the calendar POST reaches Clio, Clio
// writes the entry, the 2xx is lost coming back (a gateway, an origin hiccup — a
// 502/503/504 for a request that already committed). clioFetch waited two seconds
// and sent THE SAME CREATE BODY AGAIN. /calendar_entries has no idempotency key, so
// the second body is a second appointment, and the read-back then recorded the
// SECOND entry's id — so provider_ref pointed at the duplicate and the original was
// invisible to KV, to Grow, to Vantage and to every operator log. Nothing errored.
// 129 cannot see this: the re-check ran once, correctly, before the first POST.
//
// 133 — A TRUNCATED PAGE IS A WELL-FORMED ANSWER. fetchBusyBlocks sent no `limit`
// and never followed a page. Clio caps a list at 200 (openapi.v4.json: "Limit can
// range between 1 and 200. Default: `200`") and /booking/availability accepts a
// horizon of up to 60 days. An attorney with more than 200 entries in the window got
// the first 200 back as `{ data:[…200…] }` — a shape that passes every assertion 129
// added — and EVERY ENTRY PAST THE CAP READ AS FREE TIME. The overflow is one
// contiguous end of the window, not a scatter, so a busy attorney's later weeks went
// wholly bookable.
//
// WHAT THIS FILE PROVES
//   • THE 134 CONTROL — a calendar create that records the write and THEN answers
//     500 produces EXACTLY ONE POST /calendar_entries. Restore the unconditional
//     retry and it is two, which is the duplicate appointment. Same for 429.
//   • the same for every other write on the path — contact create, contact PATCH,
//     intake note — so the rule is the method, not a special case for one URL.
//   • THE NARROWINGS, which are what stop "stop retrying" from having been done with
//     an axe: a GET that 5xxs once still retries and still books, and the token
//     refresh (a POST by transport, a mint by effect) still retries too. Delete the
//     retry outright and these fail.
//   • THE 401 IS STILL RETRIED ON A WRITE, deliberately, and asserted so the bend in
//     the rule is a decision on the record rather than an oversight.
//   • THE 133 CONTROL — a FULL page with no next page is refused, not read as the
//     whole calendar: zero writes, 502.
//   • THE 133 PROOF OF WALK — a busy block that sits on PAGE TWO still takes the
//     slot (409 SLOT_TAKEN). This is the assertion that cannot be satisfied by
//     refusing everything: the overflow has to actually be READ.
//   • THE NARROWING — a genuine single-page calendar still books, and a genuinely
//     clear one still renders a full grid.
//
// WHAT IT CANNOT PROVE — no assertion below claims it
//   • that Clio ever actually answers 5xx after committing a calendar entry, or that
//     any real firm has passed 200 entries in a window. These are the shapes the
//     failure arrives in, stubbed. This proves how we behave when one arrives, not
//     how often one does.
//   • that a 401 never follows a committed write. Nothing here can show that; it is
//     an argument from where OAuth sits relative to the resource handler, recorded
//     in provider-clio.js and asserted here only as the behaviour we chose.
//   • that `meta.paging.next` is contractual. It is not in the vendored spec — the
//     walk reads it because the sandbox probe saw it and clio-custom-fields.js has
//     walked it since, and the full-page backstop exists precisely because its
//     absence proves nothing.

import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { onRequestPost as bookingCreate } from '../donovan-legal-site/functions/booking/create.js';
import { onRequestGet as bookingAvailability } from '../donovan-legal-site/functions/booking/availability.js';
import { __resetIntakeFieldCache } from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import { stubFetch, muteConsole, makeKV, makeDurableObject } from './helpers/stubs.mjs';

const SITEVERIFY    = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_TOKEN    = 'https://app.clio.com/oauth/token';
const CLIO_ENTRIES  = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS  = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES    = 'https://app.clio.com/api/v4/notes';
const GROW_INBOX    = 'https://grow.clio.com/inbox_leads';
const VANTAGE_UPSERT = 'https://vantage.ticoai.net/upsert-lead';

/** The page size provider-clio.js asks for — the contract's documented maximum. */
const PAGE_LIMIT = 200;

/**
 * A distinct client id per call, for the tests that need a token MINT to happen.
 *
 * getAccessToken caches per client_id for 50 minutes in a module-level Map that
 * outlives a test. Every test sharing 'cid' therefore mints once, in whichever test
 * runs first, and sees zero token traffic afterwards — so a token-retry assertion
 * written against the shared id would be vacuous, passing because nothing was
 * requested at all rather than because the retry worked.
 */
let _cidSeq = 0;
const freshClientId = () => `cid-${(_cidSeq += 1)}`;

function env(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    CLIO_CLIENT_ID: 'cid',
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

/** One calendar entry, in the shape `fields=start_at,end_at` selects. */
const entryAt = (startMs, mins = 30) => ({
  start_at: new Date(startMs).toISOString(),
  end_at:   new Date(startMs + mins * 60_000).toISOString(),
});

/** The entry Clio returns when the attorney really is booked at SLOT. */
const BUSY_AT_SLOT = entryAt(SLOT_MS);

/**
 * `n` entries that are NOT at SLOT — the bulk a real firm's window is full of.
 *
 * They sit an hour apart starting a fortnight BEFORE the slot, so nothing here can
 * take the slot by accident: if a test sees SLOT refused, it is because something
 * from a later page took it, which is the whole point of the walk proof.
 */
const filler = (n) => Array.from({ length: n }, (_, i) => entryAt(SLOT_MS - 14 * 86400_000 + i * 3600_000));

const nextUrl = (n) => `${CLIO_ENTRIES}?page_token=p${n}`;

/**
 * A contact Clio already holds for this email, carrying a gap the booking fills.
 *
 * No `first_name` and no `phone_numbers`, so updateContact has a real diff to send
 * and the enrichment PATCH is genuinely issued. With the default empty result set
 * the booking mints the contact and the follow-on PATCH is skipped as a no-op.
 */
const FOUND_CONTACT = JSON.stringify({
  data: [{
    id: 4242,
    first_name: '',
    last_name: 'Caller',
    email_addresses: [{ address: 'jane.caller@example.com', name: 'Work', default_email: true }],
    phone_numbers: [],
    addresses: [],
    custom_field_values: [],
  }],
});

/**
 * One page of a calendar list, spelled as the bytes it puts on the wire.
 *
 * `next` is the INDEX of the following page in the `pages` array; omit it for a last
 * page. `meta.paging.next` is Clio's absolute next-page URL — the same shape
 * clio-custom-fields.js walks.
 */
function pageBody(entries, next) {
  const body = { data: entries };
  if (next != null) body.meta = { paging: { next: nextUrl(next) } };
  return JSON.stringify(body);
}

/** Read a value that may be a single setting or a per-call sequence. */
const at = (v, i) => (Array.isArray(v) ? (v[Math.min(i, v.length - 1)]) : v);

/**
 * Stub every edge a booking touches, with BOTH paths under test.
 *
 * `pages` is the calendar list, page by page, as raw bytes. The stub dispatches on
 * the `page_token` query parameter, not on a call counter, so each fetchBusyBlocks
 * walk starts from page 0 exactly as a real one does — a counter would let one
 * walk's progress leak into the next and quietly turn a two-page test into a
 * one-page one.
 *
 * `entryCreateStatus`, `contactPostStatus`, `notePostStatus`, `patchStatus` and
 * `tokenStatus` accept a number or an array. An array is a SEQUENCE, one entry per
 * request of that kind — `[500, 201]` is "the first attempt fails, a retry would
 * succeed", which is exactly the shape that tells a retry apart from its absence.
 *
 * `seen.entryPosts` is what the 134 control hangs on, and it counts REQUESTS ISSUED,
 * not entries Clio committed. That is the honest unit: for a 5xx we cannot know
 * whether the write landed, so every request has to be treated as a possible entry,
 * and "exactly one request" is the only assertion available that means "at most one
 * appointment". Recording the request BEFORE answering 500 is deliberate — it models
 * Clio having written the entry and then failing to say so.
 */
function stubAll({
  pages = [pageBody([])],
  entriesStatus = 200,
  entryCreateStatus = 201,
  entryCreateBody = JSON.stringify({ data: { id: 999999 } }),
  contactPostStatus = 200,
  notePostStatus = 200,
  patchStatus = 200,
  tokenStatus = 200,
  // The documented empty result set by default — the booking mints a contact. A
  // test that needs the PATCH to actually be ISSUED supplies a found contact
  // instead: the enrichment PATCH is skipped entirely when the diff is empty, so a
  // "the PATCH is not repeated" assertion against the create path would be vacuous,
  // passing because nothing was sent at all.
  contactSearchBody = '{"data":[]}',
} = {}) {
  const seen = {
    entryPosts: [], reads: [], readUrls: [],
    contactPosts: [], patches: [], notes: [], tokens: [],
  };

  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';

    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));

    if (u.startsWith(CLIO_TOKEN)) {
      const s = at(tokenStatus, seen.tokens.length);
      seen.tokens.push(u);
      return s === 200
        ? new Response(JSON.stringify({ access_token: `at-${seen.tokens.length}` }))
        : new Response('upstream', { status: s });
    }

    if (u.startsWith(CLIO_ENTRIES) && method === 'GET') {
      const s = at(entriesStatus, seen.reads.length);
      const token = new URL(u).searchParams.get('page_token');
      const idx = token ? Number(token.slice(1)) : 0;
      seen.reads.push(idx);
      seen.readUrls.push(u);
      if (s !== 200) return new Response('upstream boom', { status: s });
      return new Response(pages[idx] ?? pageBody([]), { status: 200 });
    }

    if (u.startsWith(CLIO_ENTRIES) && method === 'POST') {
      // RECORDED FIRST, THEN THE FAILURE. The entry exists on the attorney's
      // calendar at this point; only the answer is lost.
      const s = at(entryCreateStatus, seen.entryPosts.length);
      seen.entryPosts.push(JSON.parse(init.body));
      return s >= 200 && s < 300
        ? new Response(entryCreateBody, { status: s })
        : new Response('upstream', { status: s });
    }

    if (u.startsWith(CLIO_CFIELDS) && method === 'GET') {
      return new Response(JSON.stringify({ data: [] }));
    }
    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      const s = at(patchStatus, seen.patches.length);
      seen.patches.push(JSON.parse(init.body));
      return s === 200
        ? new Response(JSON.stringify({ data: { id: 4242 } }))
        : new Response('upstream', { status: s });
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'GET') {
      return new Response(contactSearchBody);
    }
    if (u.startsWith(CLIO_CONTACTS) && method === 'POST') {
      const s = at(contactPostStatus, seen.contactPosts.length);
      seen.contactPosts.push(JSON.parse(init.body));
      return s === 200
        ? new Response(JSON.stringify({ data: { id: 4242 } }))
        : new Response('upstream', { status: s });
    }
    if (u.startsWith(CLIO_NOTES) && method === 'POST') {
      const s = at(notePostStatus, seen.notes.length);
      seen.notes.push(JSON.parse(init.body));
      return s === 200
        ? new Response(JSON.stringify({ data: { id: 77 } }))
        : new Response('upstream', { status: s });
    }

    if (u.startsWith(GROW_INBOX)) return new Response(JSON.stringify({ ok: true }));
    if (u.startsWith(VANTAGE_UPSERT)) return new Response(JSON.stringify({ ok: true }));
    throw new Error(`unstubbed fetch: ${method} ${u}`);
  });

  return { seen, restore: () => handle.restore() };
}

let _ipSeq = 0;
const nextIp = () => `198.51.100.${(_ipSeq += 1) % 250}`;

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

async function readAvailability(envOver = {}) {
  return bookingAvailability({
    request: new Request('https://www.donovan.law/booking/availability?type=consult&days=60'),
    env: env(envOver),
  });
}

let stub, mute;
beforeEach(() => { __resetIntakeFieldCache(); mute = muteConsole(); });
afterEach(() => { stub?.restore(); mute.restore(); });

// ─────────────────────────────────────────────────────────────────────────────
// TASK 2 — 134: our own retry may not be the second writer
// ─────────────────────────────────────────────────────────────────────────────
describe('a calendar create that fails AFTER committing is never sent twice', () => {
  test('THE CONTROL: a 500 on the calendar create produces EXACTLY ONE request', async () => {
    // The stub records the write and THEN answers 500 — Clio wrote the entry and
    // lost the answer. Restore the unconditional status-only retry in clioFetch and
    // `entryPosts` is 2: two identical create bodies, two appointments, one slot.
    //
    // The assertion is the REQUEST COUNT, not the response code. The 502 below is
    // what the client is told and it is the same on main; the count is the thing
    // that changed, and the thing that is the harm.
    stub = stubAll({ entryCreateStatus: 500 });
    const res = await book();

    assert.equal(stub.seen.entryPosts.length, 1, 'EXACTLY ONE create — a repeat is a second appointment');
    assert.equal(res.status, 502, 'the client is told it failed, for an entry that may in fact exist');
    assert.equal((await res.json()).code, 'PROVIDER_ERROR');
  });

  test('…and a 429 on the calendar create is not repeated either', async () => {
    // 429 is the other half of the old condition and it is retried on the same line.
    // A throttle emitted by anything in front of the origin can arrive after the
    // origin already handled the request.
    stub = stubAll({ entryCreateStatus: 429 });
    const res = await book();

    assert.equal(stub.seen.entryPosts.length, 1, 'a rate-limited create is not re-sent');
    assert.equal(res.status, 502);
  });

  test('every 5xx spelling is treated the same way', async () => {
    for (const status of [500, 502, 503, 504]) {
      stub?.restore();
      __resetIntakeFieldCache();
      stub = stubAll({ entryCreateStatus: status });
      await book();

      assert.equal(stub.seen.entryPosts.length, 1, `one create only, for HTTP ${status}`);
    }
  });

  test('the rule is the METHOD, not one URL: no write on this path is repeated', async () => {
    // Contact create, contact PATCH and the intake note are the other three writes a
    // booking issues. A duplicate contact is the defect R3 spent a ticket closing;
    // a duplicate note is noise on the record the attorney reads. None may repeat.
    stub = stubAll({ contactPostStatus: 500 });
    await book();
    assert.equal(stub.seen.contactPosts.length, 1, 'contact create is not repeated');

    stub.restore();
    __resetIntakeFieldCache();
    // A contact Clio already holds, with a gap this booking fills — otherwise the
    // enrichment diff is empty and no PATCH is issued at all.
    stub = stubAll({ patchStatus: 500, contactSearchBody: FOUND_CONTACT });
    await book();
    assert.equal(stub.seen.patches.length, 1, 'contact PATCH is not repeated');

    stub.restore();
    __resetIntakeFieldCache();
    stub = stubAll({ notePostStatus: 500 });
    await book();
    assert.equal(stub.seen.notes.length, 1, 'the intake note is not repeated');
  });

  test('a create that SUCCEEDS is still exactly one request, and still books', async () => {
    // The floor. Without it, "one create" would also be satisfied by a build that
    // stopped creating entries at all.
    stub = stubAll();
    const res = await book();

    assert.equal(res.status, 201);
    assert.equal(stub.seen.entryPosts.length, 1);
    assert.equal(stub.seen.entryPosts[0].data.start_at, new Date(SLOT_MS).toISOString());
    assert.equal((await res.json()).provider_ref, '999999');
  });
});

describe('the retry survives where repeating a request cannot mint anything', () => {
  test('THE NARROWING: a GET calendar read that 5xxs once still retries, and books', async () => {
    // This is what stops 134 from having been closed by deleting the retry. The
    // availability read fails CLOSED (129), so without its retry a single transient
    // 5xx on the re-check costs a client their consultation — and every assertion in
    // the block above would still pass.
    stub = stubAll({ entriesStatus: [500, 200] });
    const res = await book();

    assert.equal(stub.seen.reads.length, 2, 'the read was retried');
    assert.equal(res.status, 201, 'and the transient failure cost nothing');
    assert.equal(stub.seen.entryPosts.length, 1);
  });

  test('THE NARROWING: the token refresh still retries — a mint is not a write', async () => {
    // POST by transport, mint by effect. VERIFIED at the top of provider-clio.js:
    // refreshing does not rotate the refresh token, so a second refresh costs at
    // most a discarded access token. It also sits upstream of every other call, so
    // refusing to retry it would fail bookings for a hiccup on the one request in
    // the file with nothing to lose.
    //
    // A FRESH CLIENT ID IS LOAD-BEARING: the token cache is module-level and lives
    // 50 minutes, so on the shared id no token request happens at all and this test
    // would pass while proving nothing.
    stub = stubAll({ tokenStatus: [500, 200] });
    const res = await book({ CLIO_CLIENT_ID: freshClientId() });

    assert.equal(stub.seen.tokens.length, 2, 'the mint was retried');
    assert.equal(res.status, 201, 'and the booking survived it');
    assert.equal(stub.seen.entryPosts.length, 1);
  });

  test('a token refresh that fails BOTH times fails the booking closed, with no write', async () => {
    stub = stubAll({ tokenStatus: 500 });
    const res = await book({ CLIO_CLIENT_ID: freshClientId() });

    assert.equal(res.status, 502);
    assert.deepEqual(stub.seen.entryPosts, [], 'no calendar entry without a token');
  });

  test('THE BEND, ON THE RECORD: a 401 on the calendar create IS retried', async () => {
    // Asserted so it is a decision rather than an oversight. A 401 is not "the
    // request went wrong", it is "the request was never authorised" — Clio's OAuth
    // layer refuses in front of the resource handler, so there is no committed write
    // behind it. The mechanism is specific to this integration: Clio invalidates a
    // prior access token when the refresh token is used elsewhere, so a cached token
    // goes stale mid-life and without this self-heal the next calendar POST after
    // any token churn fails a booking outright.
    //
    // WHAT THIS CANNOT SHOW, and does not assert: that a 401 never follows a
    // committed write. `entryPosts` counts REQUESTS. For a 5xx a request has to be
    // treated as a possible entry, which is why the control above demands one; for a
    // 401 it is a refusal, and two requests are one appointment.
    stub = stubAll({ entryCreateStatus: [401, 201] });
    const res = await book({ CLIO_CLIENT_ID: freshClientId() });

    assert.equal(stub.seen.entryPosts.length, 2, 'the stale-token self-heal still fires on a write');
    assert.equal(res.status, 201, 'and the booking completes rather than failing on token churn');
    assert.equal(stub.seen.tokens.length >= 2, true, 'a fresh token was minted for the second attempt');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// TASK 4 — 133: past 200 entries, a page is not a calendar
// ─────────────────────────────────────────────────────────────────────────────
describe('a truncated calendar page is refused, not read as the whole calendar', () => {
  test('THE CONTROL: a FULL page with no next page is not an answer', async () => {
    // The exact shape the defect arrives in, and the reason 129's guard cannot see
    // it: `{ data:[…200 entries…] }` is well-formed, `Array.isArray` passes, and on
    // main every entry past the cap simply did not exist as far as availability was
    // concerned. Zero writes and a 502 is the fail-closed direction 129 established.
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT))] });
    const res = await book();

    assert.deepEqual(stub.seen.entryPosts, [], 'nothing is booked onto a calendar we only half read');
    assert.equal(res.status, 502);
    assert.equal((await res.json()).code, 'PROVIDER_ERROR');
  });

  test('…and it says so in its own words, not as a shape failure', async () => {
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT))] });
    await book();

    assert.ok(mute.saw('full page with no next page'), 'greppable, and distinct');
    assert.equal(mute.saw('no entry array'), false, 'the body was perfectly well shaped');
    assert.equal(mute.saw('unreadable body'), false);
    assert.equal(
      mute.saw('calendar entries read:'), false,
      'and NOT the line that means the calendar answered — that is the whole confusion',
    );
  });

  test('THE PROOF OF WALK: a busy block on PAGE TWO still takes the slot', async () => {
    // The assertion the refusals above cannot satisfy. If the walk were fake — if
    // this were closed by refusing anything full — page two would never be read and
    // the slot would look free. 409 SLOT_TAKEN means the overflow was genuinely
    // fetched and genuinely fed to computeAvailability.
    stub = stubAll({
      pages: [
        pageBody(filler(PAGE_LIMIT), 1),   // full, and says there is more
        pageBody([BUSY_AT_SLOT]),          // the entry Paul is actually sitting in
      ],
    });
    const res = await book();

    assert.equal(res.status, 409);
    assert.equal((await res.json()).code, 'SLOT_TAKEN');
    assert.deepEqual(stub.seen.entryPosts, [], 'the slot Paul is sitting in is not written over');
    assert.deepEqual(stub.seen.reads, [0, 1], 'both pages were read, in order');
  });

  test('…and a walk whose later pages are clear still books', async () => {
    // The mirror of the test above: paging is not a way of refusing more often.
    stub = stubAll({
      pages: [
        pageBody(filler(PAGE_LIMIT), 1),
        pageBody(filler(3)),               // short ⇒ genuinely the last page
      ],
    });
    const res = await book();

    assert.equal(res.status, 201, 'a fully-read busy calendar with a free slot still books');
    assert.equal(stub.seen.entryPosts.length, 1);
    assert.deepEqual(stub.seen.reads, [0, 1]);
  });

  test('a walk that runs out of pages is refused, not truncated silently', async () => {
    // MAX_PAGES is a bound on subrequests, not a licence to conclude anything about
    // what lies past it. Ten full pages each pointing at another one.
    const pages = Array.from({ length: 14 }, (_, i) => pageBody(filler(PAGE_LIMIT), i + 1));
    stub = stubAll({ pages });
    const res = await book();

    assert.deepEqual(stub.seen.entryPosts, []);
    assert.equal(res.status, 502);
    assert.ok(mute.saw('truncated at'), 'the bound is reported, not treated as the end');
    assert.equal(stub.seen.reads.length, 10, 'and it stopped at the bound rather than walking forever');
  });

  test('a wrong-shaped SECOND page is refused just like a wrong-shaped first one', async () => {
    // 129's guard now has to hold on every page, not only the one that happens to be
    // first. A walk that checked the shape once and trusted the rest would reopen the
    // whole defect one page in.
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT), 1), '{"data":null}'] });
    const res = await book();

    assert.deepEqual(stub.seen.entryPosts, []);
    assert.equal(res.status, 502);
    assert.ok(mute.saw('no entry array'));
  });

  test('a non-2xx on the SECOND page is refused too', async () => {
    stub = stubAll({
      pages: [pageBody(filler(PAGE_LIMIT), 1), pageBody([])],
      entriesStatus: [200, 403],
    });
    const res = await book();

    assert.deepEqual(stub.seen.entryPosts, []);
    assert.equal(res.status, 502);
  });
});

describe('paging did not make an ordinary calendar unbookable', () => {
  test('THE NARROWING: a genuine single short page still books, in ONE request', async () => {
    // The whole reason the backstop tests LENGTH AGAINST THE LIMIT rather than
    // "did Clio send a next page". A firm under 200 entries in the window — which is
    // every firm today — must see exactly the behaviour it saw before this ticket.
    stub = stubAll({ pages: [pageBody(filler(5))] });
    const res = await book();

    assert.equal(res.status, 201);
    assert.equal(stub.seen.entryPosts.length, 1);
    assert.equal(stub.seen.reads.length, 1, 'no extra round trip on the common path');
  });

  test('a genuinely EMPTY calendar still books — the shape is the answer, not the length', async () => {
    // 129's narrowing test, restated against the walk. An attorney with a clear
    // Tuesday must stay bookable, and `{"data":[]}` is a real answer.
    stub = stubAll({ pages: [pageBody([])] });
    const res = await book();

    assert.equal(res.status, 201);
    assert.equal(stub.seen.entryPosts.length, 1);
    assert.ok(mute.saw('calendar entries read: 0'), 'the positive line still fires');
  });

  test('the 60-day grid still renders when the calendar answers completely', async () => {
    stub = stubAll({ pages: [pageBody(filler(5))] });
    const res = await readAvailability();

    assert.equal(res.status, 200);
    assert.ok((await res.json()).slots.length > 0, 'a readable fortnight still has slots');
  });

  test('…and the 60-day grid refuses outright when the calendar is truncated', async () => {
    // The surface where truncation actually bites: a 60-day horizon is where an
    // attorney passes 200 entries, and on main it rendered the overflow as open time
    // to the client. A 500 with no slot list is the only honest answer.
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT))] });
    const res = await readAvailability();

    assert.equal(res.status, 500);
    const body = await res.json();
    assert.equal(body.code, 'PROVIDER_ERROR');
    assert.equal('slots' in body, false, 'no slot list at all, empty or otherwise');
  });

  test('the read asks for a page size instead of inheriting one', async () => {
    // The backstop compares a page length against a number this file STATES. Left to
    // the documented default the comparison would be against a value we assumed, and
    // a change to Clio's default would silently turn the guard off.
    stub = stubAll({ pages: [pageBody(filler(5))] });
    await book();

    const url = new URL(stub.seen.readUrls[0]);
    assert.equal(url.searchParams.get('limit'), String(PAGE_LIMIT));
    assert.equal(url.searchParams.get('calendar_id'), '9084638');
    assert.equal(url.searchParams.get('fields'), 'start_at,end_at');
  });

  test('the count line reports what was actually walked', async () => {
    stub = stubAll({ pages: [pageBody(filler(PAGE_LIMIT), 1), pageBody(filler(4))] });
    await book();

    // 204 entries across two pages — the number that was invisible before, and the
    // count an operator reads to see a firm outgrowing one page.
    assert.ok(mute.saw('calendar entries read: 204 (pages: 2)'));
  });

  test('no client PII reaches any line on either path', async () => {
    for (const opts of [
      { pages: [pageBody(filler(PAGE_LIMIT))] },
      { entryCreateStatus: 500 },
      { pages: [pageBody(filler(PAGE_LIMIT), 1), '{"data":null}'] },
    ]) {
      stub?.restore();
      mute.restore();
      mute = muteConsole();
      __resetIntakeFieldCache();
      stub = stubAll(opts);
      await book();

      assert.equal(mute.saw('jane.caller@example.com'), false, 'email leaked');
      assert.equal(mute.saw('Jane Q Caller'), false, 'name leaked');
      assert.equal(mute.saw('555-0142'), false, 'phone leaked');
    }
  });
});
