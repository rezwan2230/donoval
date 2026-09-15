// ── ORDER SHELDON-QUALIFIER-JOIN-COMPOSE-R1 — the defect that needs both PRs ──
//
// PR #157 (issue #153) and PR #158 each gate PASS on their own. Composed, they
// write one visitor's confidential financial answers onto another visitor's client
// record at a law firm. Neither branch's suite can see it, and the merge that
// composes them has ZERO conflicting hunks — so a file-level composition gate is
// inert here by construction. This file is the gate that is not.
//
// ── THE TWO TRUE STATEMENTS THAT ARE FALSE TOGETHER ──────────────────────────
// #158, js/perch-layer.js `abandonAfterQualifier`, states its contract in prose:
//
//     "This path is also the one that must not claim a qualifier record — nothing
//      was POSTed, so `markQualified` is not called, no `set_call_id` is issued,
//      and the booking travels the ordinary no-`call_id` route (`join: 'none'`)."
//
// Every word of that is true about the BROWSER, and #158's §4 proves it the only
// way a browser-side test can: `assert.ok(!e2.win.__perchCallId)`. The body really
// does carry no key.
//
// #157 then makes the conclusion false on the SERVER. `booking/create.js` no longer
// needs a body key to join — when the body produces no verified join it falls back
// to the `dl_qual` cookie. That fallback is the whole of #153 and must not be
// removed: the post-call booking case depends on it entirely.
//
// The two stores disagree about who they belong to:
//
//     sessionStorage (#158's claim decision)   →  PER TAB
//     dl_qual cookie (#157's carrier)          →  PER BROWSER, 6 hours
//
// ── THE CONCRETE FAILURE ─────────────────────────────────────────────────────
// Visitor A completes the qualifier and never books. Their `dl_qual` cookie is
// armed for six hours and their `qualbk:<A>` record sits in KV with hours left.
//
// Visitor B uses the same browser in a NEW TAB. Fresh sessionStorage, so nothing
// of A's claim is visible. B opens the qualifier card from the site-wide utility
// bar, abandons it, and books. B's body carries no `call_id` — exactly as #158
// promises. `create.js` then reads A's cookie, resolves A's record, and writes:
//
//     A's income band, net worth band, for whom, matter category, matter sub,
//     language and source  → B's Clio contact as Intake custom fields
//     A's state            → B's contact address
//     A's summary          → the Clio note and the Grow lead
//     A's id               → the Vantage merge key, folding B into A's lead
//
// The join records `attached`. Nothing anywhere signals that the answers and the
// client are two different people.
//
// ── SECTIONS ────────────────────────────────────────────────────────────────
//   §1  THE REPRODUCTION — cross-visitor attachment, browser half + server half
//   §2  the claims-nothing marker, and that removing it re-opens §1
//   §3  the one shot, held across BOTH stores (sessionStorage + cookie)
//   §4  the four composition controls
//   §5  THE CORRECT CASE — the cookie exists for exactly this and still works

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import { onRequestPost } from '../donovan-legal-site/functions/booking/create.js';
import { onRequestPost as qualifierSubmit } from '../donovan-legal-site/functions/fn/qualifier_submit.js';
import {
  INTAKE_CUSTOM_FIELDS, __resetIntakeFieldCache,
} from '../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js';
import {
  QUALIFIER_COOKIE, QUALIFIER_COOKIE_MAX_AGE, QUALIFIER_CLAIM_NONE,
  setQualifierCookie, clearQualifierCookie, readQualifierCookie, claimsNothing,
} from '../donovan-legal-site/functions/_lib/qualifier-cookie.js';
import { QUALIFIER_JOIN } from '../donovan-legal-site/functions/booking/_lib/qualifier-bind.js';
import {
  BOOK_INTENT_ATTR as EDGE_ATTR, BOOK_INTENT_SOURCE, BOOKING_HREF,
} from '../donovan-legal-site/functions/_lib/utility-bar-inject.js';
import { CONTAINER_ID } from '../donovan-legal-site/js/perch/placement.js';
import { makeKV, makeDurableObject, stubFetch, muteConsole } from './helpers/stubs.mjs';

// The SAME module instance the layer harness imports — the specifier resolves to
// one URL, so `__reset()` here clears the in-memory fallback the layer is using.
// That matters in §1: without it `memo` would carry the marker across the document
// boundary and the test would pass while sessionStorage did nothing.
import * as ws from '../donovan-legal-site/js/perch/web-session.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..', 'donovan-legal-site');
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8').replace(/\r\n/g, '\n');

// ─────────────────────────────────────────────────────────────────────────────
// The two visitors
// ─────────────────────────────────────────────────────────────────────────────

/** Visitor A: completed the qualifier on a voice call, never booked. */
const A_CALL_ID = 'call_2ba5efd435719148b0b7ab9f66d';

/**
 * A's answers — the live 2026-08-04 record from #153, spelled as
 * `fn/qualifier_submit`'s LABELS table renders them.
 *
 * These are the strings the assertions hunt for on B's record. Naming them
 * literally is the point: "zero custom fields" is a weaker claim than "none of
 * THESE SEVEN VALUES reached the other client".
 */
const A_INTAKE = {
  matter_category: 'Tax',
  matter_sub:      'Planning',
  for_whom:        'Business / company',
  income_band:     '$500K–$1.5M',
  net_worth_band:  '$2M–$5M',
  language:        'English',
  source:          'Google search',
};

const A_SUMMARY = [
  '— Perch intake —',
  `Matter: ${A_INTAKE.matter_category} → ${A_INTAKE.matter_sub}`,
  `For: ${A_INTAKE.for_whom}`,
  `Income: ${A_INTAKE.income_band}`,
  `Net worth: ${A_INTAKE.net_worth_band}`,
  `Language: ${A_INTAKE.language} · Source: ${A_INTAKE.source}`,
].join('\n');

const A_STATE = 'FL';

/** Every one of A's values, as a flat list, for "did ANY of this leak" sweeps. */
const A_VALUES = [...Object.values(A_INTAKE), A_SUMMARY, A_STATE, A_CALL_ID];

/** Visitor B: a different person, on the same browser, in a new tab. */
const B = {
  type: 'consult',
  name: 'Bernard Q Second',
  email: 'bernard.second@example.com',
  phone: '(561) 555-0199',
  notes: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// Server half — the real /booking/create, with Clio, Grow and Vantage stubbed
// ─────────────────────────────────────────────────────────────────────────────

const SITEVERIFY     = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const CLIO_ENTRIES   = 'https://app.clio.com/api/v4/calendar_entries';
const CLIO_CONTACTS  = 'https://app.clio.com/api/v4/contacts';
const CLIO_CFIELDS   = 'https://app.clio.com/api/v4/custom_fields';
const CLIO_NOTES     = 'https://app.clio.com/api/v4/notes';
const GROW_INBOX     = 'https://grow.clio.com/inbox_leads';
const VANTAGE_UPSERT = 'https://vantage.ticoai.net/upsert-lead';

const CONTACT_ID = 4242;
const FIELD_ID = Object.fromEntries(INTAKE_CUSTOM_FIELDS.map((f, i) => [f.key, 8100 + i]));
const CF_ROWS  = INTAKE_CUSTOM_FIELDS.map((f) => ({ id: FIELD_ID[f.key], name: f.name, field_type: f.type }));

function futureMondaySlot() {
  const d = new Date(Date.now() + 7 * 86400_000);
  d.setUTCHours(14, 0, 0, 0);
  while (d.getUTCDay() !== 1) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}
const SLOT = futureMondaySlot();

// create.js holds a MODULE-level rate-limit map (10/min/IP). One IP per request or
// later cases 429 for a reason none of them is about.
let _ipSeq = 0;
const nextIp = () => `203.0.113.${(_ipSeq += 1) % 250}`;

function env(over = {}) {
  return {
    TURNSTILE_SECRET_KEY: 'test-secret',
    CLIO_CLIENT_ID: 'cid', CLIO_CLIENT_SECRET: 'csec', CLIO_REFRESH_TOKEN: 'rtok',
    CLIO_CALENDAR_ID: 9084638, CLIO_CREATE_CONTACT: '1',
    BOOKING_MEETING_LINK: 'https://meet.donovan.law/consult',
    // BOTH downstream writers are ARMED on purpose. Without these the Grow post and
    // the Vantage upsert are skipped for want of a secret, and a leak test would be
    // asserting that A's answers did not reach two systems the test never called —
    // a green that means "not configured" rather than "not written".
    GROW_LEAD_TOKEN: 'grow-token',
    VANTAGE_WRITE_SECRET: 'vantage-secret',
    ...over,
  };
}

/** A's qualifier record, as `fn/qualifier_submit` wrote it, still live in KV. */
function kvWithA(callId = A_CALL_ID) {
  return makeKV({
    [`qualbk:${callId}`]: JSON.stringify({
      summary: A_SUMMARY, intake: A_INTAKE, state: A_STATE, matter: 'tax',
    }),
  });
}

/**
 * The bridge AFTER the call: materialised but EMPTY.
 *
 * `get_qualifier_result` consumed `qual:<id>` mid-call, so KV is the only surviving
 * witness — which is what forces the cookie path to be the thing under test rather
 * than the DO probe.
 */
function emptyBridge() {
  const ns = makeDurableObject();
  ns.instance('donovan');
  return ns;
}

function stubAll() {
  const seen = { entries: [], notes: [], contacts: [], patches: [], grow: [], vantage: [] };
  let cfServed = false;
  const handle = stubFetch(async (url, init) => {
    const u = String(url);
    const method = init?.method ?? 'GET';
    if (u === SITEVERIFY) return new Response(JSON.stringify({ success: true }));
    if (u.startsWith('https://app.clio.com/oauth/token')) return new Response(JSON.stringify({ access_token: 'at' }));
    if (u.startsWith(CLIO_ENTRIES) && method === 'GET') return new Response(JSON.stringify({ data: [] }));
    if (u.startsWith(CLIO_ENTRIES) && method === 'POST') {
      seen.entries.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: 999999 } }));
    }
    if (u.startsWith(CLIO_CFIELDS) && method === 'GET') {
      const rows = cfServed ? [] : CF_ROWS; cfServed = true;
      return new Response(JSON.stringify({ data: rows, meta: {} }));
    }
    if (u.startsWith(CLIO_CFIELDS) && method === 'POST') throw new Error('POST /custom_fields is forbidden');
    if (u.startsWith(`${CLIO_CONTACTS}/`) && method === 'PATCH') {
      seen.patches.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ data: { id: CONTACT_ID } }));
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
    if (u.startsWith(GROW_INBOX)) { seen.grow.push(JSON.parse(init.body ?? '{}')); return new Response(JSON.stringify({ ok: true })); }
    if (u.startsWith(VANTAGE_UPSERT)) { seen.vantage.push(new URL(u)); return new Response(JSON.stringify({ ok: true })); }
    throw new Error(`unstubbed fetch: ${method} ${u}`);
  });
  return { seen, restore: () => handle.restore() };
}

/**
 * POST a booking exactly as `js/booking-widget.js` composes it.
 *
 * `globals` is what the widget reads off `window` at submit time — the SAME object
 * the browser half below actually produced. Nothing here invents a body shape: the
 * two fields it can carry are the two globals the widget reads, and §4's control
 * pins that against the shipped file.
 */
function widgetBody(globals = {}, over = {}) {
  return {
    ...B,
    slot: SLOT,
    turnstile_token: 'good-token',
    call_id: globals.__perchCallId || undefined,
    qualifier_claim: globals.__perchQualifierClaim || undefined,
    ...over,
  };
}

async function book({ globals = {}, cookie = '', kv = kvWithA(), bodyOver = {}, envOver = {} } = {}) {
  const headers = { 'content-type': 'application/json', 'CF-Connecting-IP': nextIp() };
  if (cookie) headers.cookie = cookie;
  const request = new Request('https://www.donovan.law/booking/create', {
    method: 'POST', headers, body: JSON.stringify(widgetBody(globals, bodyOver)),
  });
  const res = await onRequestPost({ request, env: env({ PERCH_ACTIONS: kv, PERCH_BRIDGE: emptyBridge(), ...envOver }) });
  return { res, kv };
}

/** The cookie header the browser sends once `fn/qualifier_submit` armed A's join. */
const jarOf = (id) => `${QUALIFIER_COOKIE}=${id}`;

/** custom_field_values on the enrichment PATCH, as {key: value}. `{}` when none. */
function cfvByKey(seen) {
  if (!seen.patches.length) return {};
  const byId = new Map(INTAKE_CUSTOM_FIELDS.map((f) => [FIELD_ID[f.key], f.key]));
  const out = {};
  for (const row of seen.patches[0]?.data?.custom_field_values ?? []) {
    const key = byId.get(row?.custom_field?.id);
    if (key) out[key] = row.value;
  }
  return out;
}

/** The Vantage merge key this booking used — null when it opened a FRESH lead. */
/**
 * The Vantage severance, asserted on every path that used to produce a merge key.
 *
 * `mergeKey(seen)` stood here and returned `seen.vantage[0]`'s `call_id` — the id
 * booking/create.js forwarded to `vantage.ticoai.net/upsert-lead` so the booking
 * merged into the lead the call had opened. That upsert is deleted with the
 * Vantage severance, so there is no merge key to read.
 *
 * The assertion is INVERTED rather than dropped, because "no lead data leaves the
 * firm's infrastructure" is worth a test in its own right — and because a silent
 * `0` would otherwise be indistinguishable from a stub that stopped recording.
 * Every former mergeKey() call site now asserts this instead; what each of those
 * tests was really proving — that the id verified and the answers reached Clio —
 * is asserted directly off the KV join record and the Clio writes, which is the
 * firm's own evidence rather than a third party's.
 */
function assertNoVantageCall(seen) {
  assert.deepEqual(seen.vantage, [],
    'no Vantage upsert-lead may be issued — the integration is severed');
}

/**
 * The `qualifier_join` / `qualifier_key_source` create.js recorded in KV.
 *
 * Read off the stub's own map rather than a `list()` the real binding has and this
 * one does not — the record is the audit trail Paul reads to answer "is the Clio
 * join working", so the join outcome is asserted from what was actually WRITTEN,
 * not re-derived from what the test expected to happen.
 */
async function joinRecord(kv) {
  const keys = [...kv._store.keys()].filter((k) => k.startsWith('booking:') && !k.startsWith('booking-idemp:'));
  assert.equal(keys.length, 1, 'exactly one booking record was written');
  return JSON.parse(await kv.get(keys[0]));
}

/**
 * Every free-text surface this booking wrote, as one string.
 *
 * Swept rather than spot-checked: A's summary can reach B through the calendar
 * description, the Clio note, the Grow lead or the Vantage query string, and a test
 * that watched only the custom fields would call three of those four a pass.
 */
function allWrittenText(seen) {
  return JSON.stringify({
    entries: seen.entries, notes: seen.notes, contacts: seen.contacts,
    patches: seen.patches, grow: seen.grow,
    vantage: seen.vantage.map((u) => u.toString()),
  });
}

/** The booking is the product. Asserted on every case, whatever it did or did not join. */
function assertBookingIsIntact(res, seen) {
  assert.equal(res.status, 201, 'the appointment was confirmed');
  assert.equal(seen.entries.length, 1, 'exactly one Clio calendar entry');
  const entry = seen.entries[0].data;
  assert.ok(Array.isArray(entry.attendees) && entry.attendees.length, 'the client is an attendee, so Clio emails them');
}

/** Set-Cookie headers on a response, as raw strings. */
function setCookies(res) {
  const all = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
  if (all.length) return all;
  const one = res.headers.get('set-cookie');
  return one ? [one] : [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Browser half — the real js/perch-layer.js, in jsdom, driven by real clicks
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A fresh instance of the shipped layer.
 *
 * The counter is load-bearing rather than tidy: `import()` caches on the resolved
 * URL, so two loads sharing a tag would hand the SECOND document the module that
 * already mounted into the first — and every assertion after it would read an empty
 * page. A monotonic tag makes each mount a real mount.
 */
let _layerSeq = 0;
async function loadLayer(tag) {
  const uniq = `${tag}-${(_layerSeq += 1)}`;
  const src = read(path.join('js', 'perch-layer.js')).replace(/(['"])\/js\//g, '$1../donovan-legal-site/js/');
  const file = path.join(HERE, `.compose-layer-harness-${process.pid}-${uniq}.mjs`);
  fs.writeFileSync(file, src);
  try {
    return await import('./' + path.basename(file) + '?compose=' + uniq);
  } finally {
    fs.unlinkSync(file);
  }
}

/**
 * One tab, one document.
 *
 * `sessionStorage` is jsdom's own so `web-session.js` runs against the real storage
 * API, which is what makes "per tab" mean anything here.
 */
function newDocument(url) {
  const dom = new JSDOM(
    `<!doctype html><html lang="en"><body><main id="${CONTAINER_ID}">`
    + `<a id="cta" class="dl-ubar-cta" href="${BOOKING_HREF}" target="_top" ${EDGE_ATTR}="${BOOK_INTENT_SOURCE}">Book</a>`
    + `</main></body></html>`,
    { url, pretendToBeVisual: true },
  );
  const win = dom.window;
  const prefilled = [];
  win.DLBooking = {
    prefill: (p) => { prefilled.push(p); return true; },
    selectType: () => true, selectSlot: () => true, showDate: () => true,
  };
  win.DL = { revealBookingGate: () => true };
  win.fetch = async () => ({ ok: true, json: async () => ({ ok: true }) });
  win.scrollTo = () => {}; win.scrollBy = () => {};
  win.HTMLElement.prototype.scrollIntoView = () => {};

  const saved = {};
  const globals = {
    window: win, document: win.document, location: win.location,
    CustomEvent: win.CustomEvent, fetch: win.fetch,
    sessionStorage: win.sessionStorage, localStorage: win.localStorage,
    crypto: win.crypto || crypto,
    setInterval: win.setInterval.bind(win), clearInterval: win.clearInterval.bind(win),
  };
  for (const [k, v] of Object.entries(globals)) {
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  }
  return {
    win, prefilled,
    restore() {
      for (const [k, d] of Object.entries(saved)) {
        if (d) Object.defineProperty(globalThis, k, d); else delete globalThis[k];
      }
      dom.window.close();
    },
  };
}

/**
 * Deliver the widget's confirmation exactly as a browser delivers it.
 *
 * NOT `win.postMessage(...)`: jsdom dispatches that with `event.origin === ""`
 * while `location.origin` is the real origin, so the same-origin guard in the
 * shipped listener — `if (ev.origin !== window.location.origin) return` — drops it
 * and the test would prove nothing about the handler while looking like it did.
 * A browser sets `origin` to the sender's origin, which for `js/booking-widget.js`
 * (`window.parent.postMessage(msg, location.origin)`) is this document's own.
 *
 * Constructing the event is only safe because §3 also asserts the guard REJECTS a
 * foreign origin — otherwise this helper could be hiding the absence of the check
 * it is working around.
 */
function deliverConfirmation(win, { origin = win.location.origin, slotISO = null } = {}) {
  win.dispatchEvent(new win.MessageEvent('message', {
    data: { __perchBooking: 'confirmed', slotISO }, origin,
  }));
}

const click = (win, id) => {
  const ev = new win.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  win.document.getElementById(id).dispatchEvent(ev);
  return ev;
};

/** Tap the card to its done state. Select step first — see #158's own driver note. */
function tapThrough(win) {
  const qual = win.document.getElementById('qual');
  for (let guard = 0; guard < 20; guard++) {
    if (qual.classList.contains('done-state') || qual.classList.contains('handoff-state')) return true;
    const body = qual.querySelector('#qual-bd') || qual.querySelector('.bd');
    const sel = body.querySelector('#q-sel');
    if (sel) {
      sel.value = 'FL';
      const cont = body.querySelector('#q-cont');
      if (!cont) return false;
      cont.click();
      continue;
    }
    const opt = body.querySelector('button.opt[data-v]');
    if (!opt) return false;
    opt.click();
  }
  return false;
}

/** What `js/booking-widget.js` would read off `window` at submit time. */
const widgetGlobals = (win) => ({
  __perchCallId: win.__perchCallId,
  __perchQualifierClaim: win.__perchQualifierClaim,
});

/**
 * Visitor B's whole session, on A's browser, ending at the booking form.
 *
 * TWO DOCUMENTS, and the second one is not decoration. With no router the abandon
 * path is a `location.assign` — a full document load — so anything the layer wrote
 * to `window` on /contact is gone by the time the widget reads it on /book. The
 * tab's `sessionStorage` is carried across exactly as a browser carries it, and
 * `ws.__reset()` clears web-session's in-memory fallback first so the crossing has
 * to happen through storage rather than through a module-scope variable that a real
 * document load would have discarded.
 *
 * @param {'abandon'|'complete'} how  what the visitor did with the card
 * @param {(ctx: {win: Window, globals: object}) => any} [inspect]
 *        runs on /book with the document still LIVE — the only way to drive
 *        something that happens after the booking, such as the widget's
 *        confirmation postMessage, and then read the window again.
 * @returns the globals the widget sees on /book
 */
async function visitorBSession(how, inspect) {
  const quiet = muteConsole();
  ws.__reset();

  // ── Document 1: /contact. B taps BOOK A CONSULTATION and the card opens. ──
  const d1 = newDocument('https://www.donovan.law/contact');
  let carried = null;
  let layer1 = null;
  try {
    layer1 = await loadLayer('compose-d1-' + how);
    layer1.mount();
    click(d1.win, 'cta');
    const qual = d1.win.document.getElementById('qual');
    assert.ok(qual && qual.classList.contains('show'), 'the qualifier card opened on the book intent');

    if (how === 'complete') {
      assert.ok(tapThrough(d1.win), 'the card reached its done state');
    } else {
      // One tap, then skip the rest.
      //
      // ── JORDAN-SITE-UX-FIXES-R1: this used to be the BACKDROP dismiss ────────
      // Everything this suite is about — a visitor who reaches the booking form
      // having submitted no qualifier, and what their tab may therefore claim — is
      // unchanged. What changed is which gesture produces that visitor. A backdrop
      // click no longer leaves the page at all (it is a no-op close, and #158's §4
      // holds it to that), so the ONLY way to arrive at /book without a submitted
      // card is now the explicit decline control. Driving that control is what
      // keeps this suite pointed at a visitor who exists.
      const opt = qual.querySelector('#qual-bd button.opt');
      if (opt) opt.click();
      const decline = qual.querySelector('#qual-bd [data-decline]');
      assert.ok(decline, 'the card paints an explicit way to skip the questions');
      // 2026-09-04: the decline control is a tel: link that keeps the card open
      // (the phone is the only alternative to answering). The visitor this suite
      // is about — arriving at /book with nothing submitted — now leaves the card
      // with Esc, which is the remaining in-page dismiss.
      decline.dispatchEvent(new d1.win.MouseEvent('click', { bubbles: true, cancelable: true }));
      d1.win.document.dispatchEvent(new d1.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      assert.equal(qual.classList.contains('show'), false, 'the card closed on Esc after the decline');
    }
    // The tab's storage, as a browser carries it across a document load.
    carried = d1.win.sessionStorage.getItem(ws.SESSION_KEY);
  } finally {
    if (layer1) layer1.releaseCall();
    d1.restore();
  }

  // ── The document load. Nothing in memory survives it. ──
  ws.__reset();

  // ── Document 2: /book. The widget is here; the layer restates what it may. ──
  const d2 = newDocument('https://www.donovan.law/book.html');
  let layer2 = null;
  try {
    if (carried != null) d2.win.sessionStorage.setItem(ws.SESSION_KEY, carried);
    layer2 = await loadLayer('compose-d2-' + how);
    layer2.mount();
    const globals = widgetGlobals(d2.win);
    const extra = inspect ? await inspect({ win: d2.win, globals }) : undefined;

    // ── Document 3: the SAME tab, reloading /book after all that ──
    // The state the tab is left in only becomes observable on the next document,
    // because `resumeNoVoiceBooking` is what re-presents the join key and it runs
    // at mount. A test that read the window it just finished driving would be
    // reading `set_call_id`'s effect, not the store's — and those two are cleared
    // on different paths, so it would pass with the store's half missing.
    const afterStorage = d2.win.sessionStorage.getItem(ws.SESSION_KEY);
    ws.__reset();
    const d3 = newDocument('https://www.donovan.law/book.html');
    let layer3 = null;
    let reloaded;
    try {
      if (afterStorage != null) d3.win.sessionStorage.setItem(ws.SESSION_KEY, afterStorage);
      layer3 = await loadLayer('compose-d3-' + how);
      layer3.mount();
      reloaded = widgetGlobals(d3.win);
    } finally {
      if (layer3) layer3.releaseCall();
      d3.restore();
    }

    return {
      globals, carried, extra, reloaded,
      // Re-read AFTER `inspect`, so a test that drove the confirmation sees the
      // state the confirmation left rather than the state it started from.
      after: widgetGlobals(d2.win),
      stored: d2.win.sessionStorage.getItem(ws.SESSION_KEY),
      qualifiedAfter: ws.isQualified(d2.win),
      claimsAfter: ws.claimsNothing(d2.win),
      prefilled: d2.prefilled,
    };
  } finally {
    if (layer2) layer2.releaseCall();
    d2.restore();
    quiet.restore();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// §1 · THE REPRODUCTION
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 — visitor A\'s confidential answers must not reach visitor B\'s record', () => {
  let stub = null;
  before(() => { __resetIntakeFieldCache(); });
  after(() => { if (stub) stub.restore(); });

  test('B abandons the card and books on A\'s browser — nothing of A\'s attaches', async () => {
    // The browser half: B's session, driven through the shipped layer, ending with
    // whatever the booking widget can actually see on /book.
    const b = await visitorBSession('abandon');

    // #158's own promise, restated here so a regression in it is legible as one:
    // the body genuinely carries no key. This is the assertion that stays TRUE
    // while the booking is wrong, which is why it cannot be the only one.
    assert.ok(!b.globals.__perchCallId,
      'the abandon path claims no join key — #158\'s contract, unchanged');

    // The server half: A's cookie is in the jar and A's record is live in KV.
    stub = stubAll();
    const { res, kv } = await book({ globals: b.globals, cookie: jarOf(A_CALL_ID) });
    const { seen } = stub;

    assertBookingIsIntact(res, seen);

    // ── THE FINDING ──
    const rec = await joinRecord(kv);
    assert.equal(rec.qualifier_join, QUALIFIER_JOIN.NONE,
      'a booking that deliberately presented no key must join NOTHING — `attached` here is '
      + 'A\'s qualifier on B\'s booking, and the join reporting success is why nothing signals it');
    assert.equal(rec.qualifier_key_source, undefined,
      'and no carrier was used — a `cookie` key_source here is the cross-visitor join by name');

    assert.deepEqual(cfvByKey(seen), {},
      'ZERO Intake custom fields on B\'s Clio contact — every one of them would be A\'s finances');
    assertNoVantageCall(seen);

    // The sweep: no surface at all, not just the custom fields.
    const written = allWrittenText(seen);
    for (const v of A_VALUES) {
      assert.equal(written.includes(v), false,
        `A's "${v}" reached one of B's Clio / Grow / Vantage writes`);
    }

    // B's own contact address must not be A's state.
    const province = seen.patches[0]?.data?.addresses?.[0]?.province
      ?? seen.contacts[0]?.data?.addresses?.[0]?.province;
    assert.notEqual(province, A_STATE, 'A\'s state must not become B\'s contact address');
  });

  test('CONTROL — the same browser half with NO cookie in the jar is identical', async () => {
    // Proves the §1 case is about the cookie and not about the abandon path having
    // broken the booking: same session, same body, empty jar, same outcome.
    const b = await visitorBSession('abandon');
    if (stub) stub.restore();
    stub = stubAll();
    const { res, kv } = await book({ globals: b.globals, cookie: '' });
    assertBookingIsIntact(res, stub.seen);
    const rec = await joinRecord(kv);
    assert.equal(rec.qualifier_join, QUALIFIER_JOIN.NONE);
    assert.deepEqual(cfvByKey(stub.seen), {});
  });

  test('the refusal is auditable — a declined cookie is not the same as no cookie', async () => {
    // Without this the fix and the absence of the bug read identically in
    // production: both log `qualifier_join=none`. Paul's answer to "how often is
    // this happening" has to come from somewhere.
    const b = await visitorBSession('abandon');
    if (stub) stub.restore();
    stub = stubAll();
    const { kv } = await book({ globals: b.globals, cookie: jarOf(A_CALL_ID) });
    const rec = await joinRecord(kv);
    assert.equal(rec.qualifier_claim_refused, true,
      'a cookie WAS presented and declined — recorded, or the refusal is invisible');

    // And the negative arm: an ordinary booking with no cookie must NOT claim to
    // have refused one, or the field counts nothing.
    if (stub) stub.restore();
    stub = stubAll();
    const plain = await book({ globals: b.globals, cookie: '' });
    assert.equal((await joinRecord(plain.kv)).qualifier_claim_refused, undefined,
      'no cookie ⇒ nothing was refused');
  });

  test('the stale cookie is still SPENT, so the next booking cannot inherit it either', async () => {
    // #157 spends ANY cookie the browser presented, joined or not, precisely so a
    // shared machine does not carry one visitor's record into the next person's
    // session. Refusing the join must not quietly opt out of that — the refusal
    // should DISARM the cookie, not preserve it for whoever books next.
    const b = await visitorBSession('abandon');
    if (stub) stub.restore();
    stub = stubAll();
    const { res } = await book({ globals: b.globals, cookie: jarOf(A_CALL_ID) });
    const cookies = setCookies(res);
    assert.equal(cookies.length, 1, 'the response clears the qualifier cookie');
    assert.equal(cookies[0], clearQualifierCookie(),
      'and clears it with the SAME attributes it was set with, or the jar keeps it');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · The marker is what makes §1 pass — remove it and the leak returns
// ─────────────────────────────────────────────────────────────────────────────

describe('§2 — the claims-nothing marker is load-bearing', () => {
  let stub = null;
  after(() => { if (stub) stub.restore(); });

  test('the abandon path actually sets it, and it survives the document load', async () => {
    const b = await visitorBSession('abandon');
    assert.equal(b.globals.__perchQualifierClaim, QUALIFIER_CLAIM_NONE,
      'the marker reaches the window the booking widget reads, on the SECOND document');
    assert.ok(String(b.carried).includes(QUALIFIER_CLAIM_NONE),
      'and it crossed in sessionStorage — the only store that survives a location.assign');
  });

  test('MUTATION — drop the marker from the body and §1 fails again', async () => {
    const b = await visitorBSession('abandon');
    // Proof the mutation APPLIED before its result is read: the browser really did
    // set the marker, and the body we are about to send really does lack it.
    assert.equal(b.globals.__perchQualifierClaim, QUALIFIER_CLAIM_NONE, 'the marker was set');
    const mutated = widgetBody(b.globals, { qualifier_claim: undefined });
    assert.equal('qualifier_claim' in mutated && mutated.qualifier_claim !== undefined, false,
      'the mutated body genuinely carries no marker');

    if (stub) stub.restore();
    stub = stubAll();
    const { kv } = await book({
      globals: b.globals, cookie: jarOf(A_CALL_ID), bodyOver: { qualifier_claim: undefined },
    });
    const rec = await joinRecord(kv);
    assert.equal(rec.qualifier_join, QUALIFIER_JOIN.ATTACHED,
      'without the marker the cookie fallback fires — this is the defect, on demand');
    assert.equal(rec.qualifier_key_source, 'cookie');
    assert.equal(Object.keys(cfvByKey(stub.seen)).length, INTAKE_CUSTOM_FIELDS.length,
      'and all seven of A\'s Intake fields land on B\'s contact');
  });

  test('MUTATION — a marker the server does not recognise fails OPEN, which is why CI pins the spelling', async () => {
    const b = await visitorBSession('abandon');
    if (stub) stub.restore();
    stub = stubAll();
    const { kv } = await book({
      globals: b.globals, cookie: jarOf(A_CALL_ID), bodyOver: { qualifier_claim: 'nonce' },
    });
    assert.equal((await joinRecord(kv)).qualifier_join, QUALIFIER_JOIN.ATTACHED,
      'a one-character drift re-opens the leak silently — hence the equality test below');
  });

  test('the browser and the server spell the marker identically', () => {
    assert.equal(ws.CLAIM_NONE, QUALIFIER_CLAIM_NONE,
      'js/perch/web-session.js CLAIM_NONE must equal functions/_lib/qualifier-cookie.js '
      + 'QUALIFIER_CLAIM_NONE — a marker the browser sends and the server does not know is a fail-OPEN');
  });

  test('the marker only ever WITHHOLDS — no value of it attaches anything', async () => {
    // The security argument for reading it straight off a client-controlled body.
    // A forged marker cannot join a record; the worst it does is under-enrich the
    // booking that sent it.
    for (const v of [QUALIFIER_CLAIM_NONE, 'NONE', ' none ', 'yes', 'true', '../none', '']) {
      assert.equal(typeof claimsNothing(v), 'boolean', `claimsNothing(${JSON.stringify(v)}) is a decision, not a value`);
    }
    assert.equal(claimsNothing(QUALIFIER_CLAIM_NONE), true);
    assert.equal(claimsNothing('NONE'), true, 'case-folded — strictness here fails OPEN');
    assert.equal(claimsNothing(undefined), false, 'ABSENCE IS NOT A CLAIM — #153 depends on this');
    assert.equal(claimsNothing(''), false);
    assert.equal(claimsNothing('none-ish'), false);
  });

  test('the shipped widget actually sends it — the seam is not a comment', () => {
    // The body helper above models `js/booking-widget.js`. This pins the model to
    // the file, on the payload literal rather than on a loose grep, and with
    // comments stripped so the guard cannot match its own prose.
    const src = read(path.join('js', 'booking-widget.js'))
      .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    const at = src.indexOf('turnstile_token:');
    assert.ok(at > 0, 'the submit payload literal is still where this guard reads it');
    const payload = src.slice(src.lastIndexOf('var payload', at), at);
    assert.ok(payload.includes('qualifier_claim'),
      'the /booking/create payload must carry qualifier_claim');
    assert.ok(payload.includes('__perchQualifierClaim'),
      'sourced from the global js/perch-layer.js writes, beside __perchCallId');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · The one shot, held across BOTH stores
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 — a confirmed booking spends the claim in the tab, not only in the jar', () => {
  let stub = null;
  after(() => { if (stub) stub.restore(); });

  test('a completed card claims its key, and the confirmation spends it', async () => {
    const b = await visitorBSession('complete', async ({ win }) => {
      // Stand in for js/booking-widget.js's 201 path, through the real listener.
      deliverConfirmation(win, { slotISO: SLOT });
      await new Promise((r) => setTimeout(r, 0));
    });

    assert.ok(b.globals.__perchCallId, 'the completed card presented its id at booking time');
    assert.equal(b.globals.__perchQualifierClaim, undefined,
      'and claimed nothing-nothing — a completed card is not an abandoned one');

    assert.equal(b.qualifiedAfter, false,
      'the tab\'s claim is SPENT — or resumeNoVoiceBooking re-presents a key whose '
      + 'record create.js already consumed, and the firm\'s returning visitor logs as a forged id');

    // And the observable that proves it, on the next document rather than this one.
    assert.ok(!b.reloaded.__perchCallId,
      'reloading /book in the same tab must NOT re-present the spent key');
  });

  test('a second booking in the same tab emits NO unverified warning', async () => {
    // The composition control the order names. Before the fix the cookie was spent
    // server-side while sessionStorage still said `qualified`, so booking twice in
    // one tab produced a forged-id refusal against the server's own key.
    const b = await visitorBSession('complete', async ({ win }) => {
      deliverConfirmation(win, { slotISO: SLOT });
      await new Promise((r) => setTimeout(r, 0));
    });

    const quiet = muteConsole();
    if (stub) stub.restore();
    stub = stubAll();
    // The second booking, composed from what the widget sees AFTER A RELOAD — the
    // document `resumeNoVoiceBooking` actually runs on. Reading the first document's
    // window instead would test `set_call_id`'s clear, which happens on a different
    // path from the store's, and the store's half could be missing entirely.
    //
    // The key was spent, so KV no longer holds the record, and the cookie was
    // cleared by the first booking's response.
    const { kv } = await book({ globals: b.reloaded, cookie: '', kv: makeKV({}) });
    const rec = await joinRecord(kv);
    quiet.restore();

    assert.equal(rec.qualifier_join, QUALIFIER_JOIN.NONE,
      'the second booking joins nothing and says so as `none`, not as `unverified`');
    assert.notEqual(rec.qualifier_join, QUALIFIER_JOIN.UNVERIFIED);
    assert.equal(quiet.saw('unverified'), false,
      'and nothing warned about a forged id — it was the server\'s own key, spent');
    assert.equal(quiet.saw('recovered the join from the qualifier cookie'), false);
  });

  test('CONTROL — a confirmation from a FOREIGN origin is ignored', async () => {
    // `deliverConfirmation` constructs the MessageEvent because jsdom's own
    // postMessage leaves `origin` empty. That workaround is only legitimate if the
    // guard it routes around is really there — otherwise the three tests above
    // would pass against a listener that trusts any window on the page.
    const b = await visitorBSession('complete', async ({ win }) => {
      deliverConfirmation(win, { origin: 'https://evil.example', slotISO: SLOT });
      await new Promise((r) => setTimeout(r, 0));
    });
    assert.equal(b.qualifiedAfter, true,
      'a cross-origin frame must not be able to spend this tab\'s qualifier claim');
    assert.ok(b.after.__perchCallId, 'nor clear the join key out from under the booking');
  });

  test('a claims-nothing tab STAYS claims-nothing after it books', async () => {
    // Asymmetric with the key on purpose: the key is spent because it named a
    // record that has now been consumed. "Nothing was ever submitted in this tab"
    // is not consumed by anything — and a second silent booking is exactly the
    // request the cookie fallback answers.
    const b = await visitorBSession('abandon', async ({ win }) => {
      deliverConfirmation(win, { slotISO: SLOT });
      await new Promise((r) => setTimeout(r, 0));
    });
    assert.equal(b.claimsAfter, true, 'the marker survives the confirmation');
    assert.equal(b.reloaded.__perchQualifierClaim, QUALIFIER_CLAIM_NONE,
      'and survives the reload after it, so a second booking from this tab is still refused the cookie');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 · The composition controls that exist in neither parent suite
// ─────────────────────────────────────────────────────────────────────────────

describe('§4 — the composed contract', () => {
  let stub = null;
  after(() => { if (stub) stub.restore(); });

  test('CONTROL b — a completed no-voice card carries ONE id, in body and cookie, key_source=body', async () => {
    const b = await visitorBSession('complete');
    const webId = b.globals.__perchCallId;
    assert.ok(webId && webId.startsWith(ws.ID_PREFIX), 'the card minted a web- id');

    // Arm the cookie the way the site does: through the REAL fn/qualifier_submit,
    // so the cookie under test is the one the server would actually set.
    const kv = makeKV({});
    const bridge = makeDurableObject(); bridge.instance('donovan');
    const quiet = muteConsole();
    const submitRes = await qualifierSubmit({
      request: new Request('https://www.donovan.law/fn/qualifier_submit', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        // The FLAT answer keys the endpoint actually reads — it builds the summary
        // and the intake object itself, and arms the cookie only once the KV record
        // is stored. Handing it a pre-built `intake` would arm nothing and this
        // control would be asserting against a cookie the site never sets.
        body: JSON.stringify({
          call_id: webId,
          matter_category: 'tax', matter_sub: 'planning', for_whom: 'business',
          income_band: '500k_1_5m', net_worth_band: '2m_5m', language: 'en',
          source: 'Google search', state: 'fl',
        }),
      }),
      env: { PERCH_ACTIONS: kv, PERCH_BRIDGE: bridge },
      // The endpoint forwards to Vantage through `waitUntil`. No secret is set, so
      // nothing authenticates and nothing is asserted about it — but the call site
      // runs, and an absent `waitUntil` would throw before the cookie is returned.
      waitUntil: (p) => { if (p && typeof p.catch === 'function') p.catch(() => {}); },
    });
    quiet.restore();

    const armed = setCookies(submitRes).find((c) => c.startsWith(`${QUALIFIER_COOKIE}=`));
    assert.ok(armed, 'the qualifier response armed the join cookie');
    assert.equal(readQualifierCookie(new Request('https://x/', { headers: { cookie: armed } })), webId,
      'THE SAME id in the body and in the cookie — one record, one key, two carriers');

    if (stub) stub.restore();
    stub = stubAll();
    const booked = await book({ globals: b.globals, cookie: jarOf(webId), kv });
    assertBookingIsIntact(booked.res, stub.seen);
    const rec = await joinRecord(booked.kv);
    assert.equal(rec.qualifier_key_source, 'body',
      'the BODY wins when it verifies — the cookie is the fallback, never the preference');
    assert.equal(rec.qualifier_join, QUALIFIER_JOIN.ATTACHED);
    assertNoVantageCall(stub.seen);
  });

  test('CONTROL d — a web id round-trips through set, read and the server\'s call-id gate', async () => {
    // The three hops the no-voice key makes. A minted id that the cookie helper
    // silently refuses would produce a record that exists and never attaches.
    const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://www.donovan.law/' });
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: dom.window.crypto || crypto, configurable: true, writable: true });
    ws.__reset();
    let webId;
    try {
      webId = ws.sessionId(dom.window);
    } finally {
      if (saved) Object.defineProperty(globalThis, 'crypto', saved); else delete globalThis.crypto;
      dom.window.close();
    }

    assert.match(webId, /^web-[0-9a-f]{32}$/, 'the shape the layer mints');

    const setHeader = setQualifierCookie(webId);
    assert.notEqual(setHeader, '', 'setQualifierCookie accepts a web id — "" here means the join is never armed');
    assert.ok(setHeader.includes('HttpOnly') && setHeader.includes('Secure') && setHeader.includes('SameSite=Lax'),
      'and arms it with the posture the module argues for');
    assert.ok(setHeader.includes(`Max-Age=${QUALIFIER_COOKIE_MAX_AGE}`), 'for exactly the record\'s own TTL');

    const jarValue = setHeader.split(';')[0];
    assert.equal(readQualifierCookie(new Request('https://x/', { headers: { cookie: jarValue } })), webId,
      'and reads back byte-identical');

    // The server's own gate, read from the shipped source rather than restated —
    // a copy of the regex here would pass while the real one rejected.
    const bindSrc = fs.readFileSync(path.join(SITE, 'functions/booking/_lib/qualifier-bind.js'), 'utf8');
    const m = bindSrc.match(/const CALL_ID_RE = (\/.*\/);/);
    assert.ok(m, 'CALL_ID_RE is still declared where this control reads it');
    // eslint-disable-next-line no-eval
    const CALL_ID_RE = (0, eval)(m[1]);
    assert.equal(CALL_ID_RE.test(webId), true,
      'and the id passes the gate that decides whether the booking may join at all');

    // A look-alike cookie must not answer for it — the token/substring distinction.
    const decoy = `x_${QUALIFIER_COOKIE}=decoy; ${QUALIFIER_COOKIE}_backup=decoy2`;
    assert.equal(readQualifierCookie(new Request('https://x/', { headers: { cookie: decoy } })), '',
      'a cookie whose NAME merely contains dl_qual answers for nothing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §5 · THE CORRECT CASE — the reason the cookie exists, still working
// ─────────────────────────────────────────────────────────────────────────────

describe('§5 — a visitor who qualified and books in a LATER TAB still gets all seven fields', () => {
  let stub = null;
  after(() => { if (stub) stub.restore(); });

  /**
   * The #153 case, unchanged and unweakened.
   *
   * This is the control that stops the fix above from being "remove the cookie
   * fallback" wearing a marker. The caller finished the qualifier on a voice call,
   * the call ended, `window.__perchCallId` died with the document, and they book
   * from a page that has never heard of the call. Nothing about that booking claims
   * anything — so nothing suppresses the cookie, and the cookie does its whole job.
   */
  test('the post-call booking joins on the cookie alone and writes every Intake field', async () => {
    if (stub) stub.restore();
    stub = stubAll();
    const { res, kv } = await book({ globals: {}, cookie: jarOf(A_CALL_ID) });
    const { seen } = stub;

    assertBookingIsIntact(res, seen);
    const rec = await joinRecord(kv);
    assert.equal(rec.qualifier_join, QUALIFIER_JOIN.ATTACHED, '#153 still fixed');
    assert.equal(rec.qualifier_key_source, 'cookie', 'and joined on the carrier built for it');
    assert.equal(rec.qualifier_claim_refused, undefined, 'nothing was refused — nothing claimed nothing');

    const cfv = cfvByKey(seen);
    assert.equal(Object.keys(cfv).length, INTAKE_CUSTOM_FIELDS.length,
      `all ${INTAKE_CUSTOM_FIELDS.length} Intake custom fields reached the Clio contact`);
    for (const [k, v] of Object.entries(A_INTAKE)) {
      assert.equal(cfv[k], v, `${k} is on the contact, with the caller's own answer`);
    }

    const province = seen.patches[0]?.data?.addresses?.[0]?.province
      ?? seen.contacts[0]?.data?.addresses?.[0]?.province;
    assert.equal(province, A_STATE, 'and their state is their contact address');
    assertNoVantageCall(seen);
    assert.ok(JSON.stringify(seen.notes).includes('Perch intake'), 'the summary reaches the Clio note');
  });

  test('CONTROL — the SAME booking with a claims-nothing marker joins nothing', async () => {
    // The two cases differ by the marker and by nothing else: same cookie, same KV,
    // same body. If this passed while the one above failed, the fix would be
    // suppressing #153 rather than the composition defect.
    if (stub) stub.restore();
    stub = stubAll();
    const { res, kv } = await book({
      globals: { __perchQualifierClaim: QUALIFIER_CLAIM_NONE }, cookie: jarOf(A_CALL_ID),
    });
    assertBookingIsIntact(res, stub.seen);
    assert.equal((await joinRecord(kv)).qualifier_join, QUALIFIER_JOIN.NONE);
    assert.deepEqual(cfvByKey(stub.seen), {});
  });

  test('a LIVE-CALL decline does not mark the tab — #153\'s own path is untouched', async () => {
    // `declineAfterQualifier` excludes the live-call branch. A caller who skips the
    // card mid-call may still have a record written for that call, and marking the
    // tab would suppress the post-call join this whole ticket restored.
    //
    // JORDAN-SITE-UX-FIXES-R1 renamed the function this reads and nothing inside
    // it: the branch order below is #158's, byte for byte. What moved is the
    // gesture that reaches it — see the note in `visitorBSession`.
    const src = read(path.join('js', 'perch-layer.js'));
    const fn = src.slice(src.indexOf('function declineAfterQualifier'));
    const end = fn.indexOf('\n  }\n');
    assert.ok(end > 0, 'the function boundary was found — a -1 would slice past it and read the next function');
    const body = fn.slice(0, end);
    const live = body.indexOf('if (liveCall)');
    const mark = body.indexOf('markClaimsNothing');
    assert.ok(live > 0 && mark > 0, 'both branches are present');
    assert.ok(mark > live, 'the marker sits AFTER the live-call early return, so a live call never reaches it');
    assert.ok(body.slice(live, mark).includes('return'),
      'and that branch genuinely returns rather than falling through to it');
  });
});
