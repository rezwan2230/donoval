// SHELDON-PERCH-A31 (#56) — the direct-DOM booking control adapter.
//
// The site is one document under the A2.2 router, so the two postMessage hops
// that carried every booking command Paula issues — shell → iframe, then
// perch-inject → widget — have nothing left to cross. This suite drives the REAL
// modules over a real booting widget in jsdom and proves the direct path honours
// every command with the same semantics the message path had, that the message
// path is untouched, and that neither path can submit.
//
// The comparison is the point. Nearly every test below runs the same command
// twice — once through `perch-inject.js` + the widget's `{type:'dl-booking'}`
// bridge (production today), once through `js/perch/booking-control.js` (the
// router path) — and asserts the widget landed in the same state. "Identical
// semantics" is otherwise a claim about two files nobody diffed.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import {
  createBookingControl, COMMAND_MAP, BOOKING_COMMANDS, FORBIDDEN_METHODS,
} from '../donovan-legal-site/js/perch/booking-control.js';
import { createCommandChannel } from '../donovan-legal-site/js/perch/command-channel.js';

const SITE = new URL('../donovan-legal-site/', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, SITE)), 'utf8');

const widgetSrc = read('js/booking-widget.js');
// `injectSrc` (perch-inject.js) was read here — it ran inside the shell's iframe and
// translated {type:'perch', cmd} into the {type:'dl-booking', action} the widget
// listens for. Deleted with the shell; see the removed describe block below.
const dlInitSrc = read('js/dl-init.js');
const gateSrc = read('js/page/booking-gate.js');
const layerSrc = read('js/perch-layer.js');
// SHELDON-PERCH-COMMAND-CHANNEL: the poll loop and its dispatch table moved out
// of js/perch/call.js into js/perch/command-channel.js so the persistent layer
// can build the consumer WITHOUT building a second orb. The A31 assertions below
// are about that dispatch table, so they follow it — the shapes they pin are
// unchanged, only the file they live in is.
const channelSrc = read('js/perch/command-channel.js');

const ORIGIN = 'https://www.donovan.law';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// Slots a few days out — inside the widget's horizon and always in the future.
const DAY_MS = 24 * 60 * 60 * 1000;
function slotAt(daysOut, hourUTC) {
  const d = new Date(Date.now() + daysOut * DAY_MS);
  d.setUTCHours(hourUTC, 0, 0, 0);
  return d.toISOString();
}

const PREFILL = {
  name: 'Maria De La Cruz',
  email: 'maria@example.com',
  phone: '(561) 555-0142',
  notes: 'Real estate closing question',
};

// jsdom's same-window postMessage delivers origin "" instead of the sender's
// origin, which trips the product's same-origin gate in perch-inject.js and in
// the widget's bridge. Restore browser semantics for the test only — this changes
// no product behaviour; without it the messages are silently dropped and the
// comparison below would prove nothing. (Same shim as booking-prefill.test.mjs.)
function installPMShim(w) {
  w.postMessage = function (data) {
    w.dispatchEvent(new w.MessageEvent('message', { data, origin: w.location.origin, source: w }));
  };
}

const BOOK_MARKUP = ''
  + '<div id="book-gate" style="display:block">a quick step first</div>'
  + '<div id="book-live" style="display:none">'
  + '<div id="dl-booking" data-api="https://api.test" data-deployment="donovan-main" data-tz="UTC"></div>'
  + '</div>';

/**
 * A booted /book page: dl-init, the gate, the widget and (optionally) the
 * injector, with availability mocked so the widget reaches DATE_PICK.
 *
 * `withInject` exists so the two paths can be compared in identical documents:
 * the message run needs perch-inject.js, the direct run must work without it —
 * that file is never loaded outside the shell's iframe, which is the whole reason
 * this ticket exists.
 */
async function bootBookPage({ withInject = false, unlock = true, path = '/book.html' } = {}) {
  const dom = new JSDOM(`<!doctype html><body>${BOOK_MARKUP}</body>`, {
    url: ORIGIN + path,
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  installPMShim(w);
  w.HTMLElement.prototype.scrollIntoView = function () {};

  if (unlock) w.localStorage.setItem('donovan_booking_unlock', String(Date.now()));

  const types = [
    { id: 'consult-30', name: '30-minute consult', duration: 30 },
    { id: 'consult-60', name: '60-minute consult', duration: 60 },
  ];
  const slots = [
    { startISO: slotAt(5, 14) }, { startISO: slotAt(5, 16) },
    { startISO: slotAt(6, 15) },
  ];
  w.fetch = async (url) => ({
    ok: true,
    status: 200,
    json: async () => (String(url).includes('availability') ? { slots } : { types }),
  });

  // Load order matches production: dl-init from <head>, then the gate, then the
  // widget. The A2.2 adoption allow-list enforces exactly this order for exactly
  // the reason it matters here — the gate calls DL.ready and would throw without it.
  w.eval(dlInitSrc);
  w.eval(gateSrc);
  w.eval(widgetSrc);
  // `if (withInject) w.eval(injectSrc)` stood here. perch-inject.js ran inside the
  // shell's iframe; it is deleted and there is no frame boundary left to cross. The
  // `withInject` flag is now inert and kept only so the two entry points below still
  // read as a pair.

  await tick(30);
  return { dom, w, types, slots };
}

/**
 * Drive a command through the widget's postMessage listener.
 *
 * This used to post the SHELL's vocabulary — `{type:'perch', cmd}` — and rely on
 * perch-inject.js inside the iframe to translate it to `{type:'dl-booking', action}`.
 * The shell and the injector are both deleted, so it posts what the widget actually
 * listens for, which is what js/perch/booking-control.js sends it today.
 *
 * The pairing with `viaDirect` is still meaningful and is why this survives: the
 * widget can be driven by message OR by calling DLBooking directly, and the whole
 * point of these tests is that the two agree.
 */
function viaMessage(w, cmd, payload) {
  // `set_call_id` is COMMAND_MAP's one deliberate null: booking-control.js does not
  // dispatch it into DLBooking, because the widget handles `setCallId` itself by
  // writing window.__perchCallId. The injector translated the name and let the widget
  // do the rest, so the wire name is spelled here rather than looked up.
  const action = cmd === 'set_call_id' ? 'setCallId' : COMMAND_MAP[cmd];
  assert.ok(action, `no wire action for ${cmd}`);
  w.postMessage({ type: 'dl-booking', action, payload });
}

/** Drive a command the way the router does: the adapter, straight at DLBooking. */
function viaDirect(w, cmd, payload) {
  return createBookingControl(w, w.document).apply(cmd, payload);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Task 1 — the command inventory, held against the code that defines it
// ─────────────────────────────────────────────────────────────────────────────

describe('the command inventory matches the shipped surface', () => {
  // REMOVED: every booking cmd perch-inject.js forwards is in COMMAND_MAP, and no others
  // it read perch-inject.js and matched its forwarded cmd set against COMMAND_MAP. The injector is deleted; COMMAND_MAP is asserted directly by the sibling tests here.

  // REMOVED: every cmd /fn/do_page_action can emit is either mapped or deliberately not
  // /fn/do_page_action.js was Paula's page-control tool endpoint and is deleted with the voice concierge.

  test('each mapping names a method the widget actually publishes', async () => {
    const { w } = await bootBookPage();
    for (const cmd of BOOKING_COMMANDS) {
      const method = COMMAND_MAP[cmd];
      if (method === null) continue; // set_call_id sets a global, not an API call
      assert.equal(typeof w.DLBooking[method], 'function', `DLBooking.${method} must exist for ${cmd}`);
    }
  });

  test('the adapter claims booking commands and nothing else', () => {
    const c = createBookingControl(new JSDOM('', { url: ORIGIN }).window);
    for (const cmd of BOOKING_COMMANDS) assert.equal(c.handles(cmd), true, cmd);
    for (const cmd of ['navigate', 'scroll', 'highlight', 'scrollby', 'open_qualifier']) {
      assert.equal(c.handles(cmd), false, `${cmd} must fall through to the postMessage path`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Task 2 — identical semantics, asserted by running both paths
// ─────────────────────────────────────────────────────────────────────────────

describe('the direct path reaches the same widget state as the message path', () => {
  test('booking_prefill — all four fields land, both ways', async () => {
    const msg = await bootBookPage({ withInject: true });
    viaMessage(msg.w, 'booking_prefill', PREFILL);
    await tick(20);

    const dir = await bootBookPage();
    viaDirect(dir.w, 'booking_prefill', PREFILL);
    await tick(20);

    for (const { w, label } of [{ w: msg.w, label: 'message' }, { w: dir.w, label: 'direct' }]) {
      const s = w.DLBooking.getState();
      assert.deepEqual({ ...s.prefill }, { name: true, email: true, phone: true, notes: true }, label);
    }
  });

  test('booking_prefill reaches the real <input> values once FORM renders', async () => {
    const { w } = await bootBookPage();
    viaDirect(w, 'booking_prefill', PREFILL);
    viaDirect(w, 'booking_select_type', 'consult-30');
    await tick(30);
    viaDirect(w, 'booking_select_slot', slotAt(5, 14));
    await tick(30);

    assert.equal(w.DLBooking.getState().step, 'FORM');
    const val = (id) => w.document.querySelector(id).value;
    assert.equal(val('#dl-bk-name'), PREFILL.name);
    assert.equal(val('#dl-bk-email'), PREFILL.email);
    assert.equal(val('#dl-bk-phone'), PREFILL.phone);
    assert.equal(val('#dl-bk-notes'), PREFILL.notes);
    // One "Full name" field, not first/last — a full name must land intact.
    assert.ok(val('#dl-bk-name').includes('Maria') && val('#dl-bk-name').includes('Cruz'));
  });

  test('booking_prefill never overwrites a field the caller typed into', async () => {
    const { w } = await bootBookPage();
    viaDirect(w, 'booking_select_type', 'consult-30');
    await tick(30);
    viaDirect(w, 'booking_select_slot', slotAt(5, 14));
    await tick(30);

    const email = w.document.querySelector('#dl-bk-email');
    email.value = 'typed-by-the-caller@example.com';
    email.dispatchEvent(new w.Event('input', { bubbles: true }));

    viaDirect(w, 'booking_prefill', PREFILL);
    await tick(20);
    assert.equal(email.value, 'typed-by-the-caller@example.com', 'the caller wins');
    assert.equal(w.document.querySelector('#dl-bk-name').value, PREFILL.name, 'untouched fields still prefill');
  });

  test('booking_select_type — both paths load availability for the chosen type', async () => {
    const msg = await bootBookPage({ withInject: true });
    viaMessage(msg.w, 'booking_select_type', 'consult-60');
    await tick(40);

    const dir = await bootBookPage();
    viaDirect(dir.w, 'booking_select_type', 'consult-60');
    await tick(40);

    for (const { w, label } of [{ w: msg.w, label: 'message' }, { w: dir.w, label: 'direct' }]) {
      assert.equal(w.DLBooking.getState().step, 'DATE_PICK', label);
    }
  });

  test('booking_select_type is a no-op for an unknown id, both ways', async () => {
    const { w } = await bootBookPage();
    const before = w.DLBooking.getState().step;
    viaDirect(w, 'booking_select_type', 'no-such-type');
    await tick(20);
    assert.equal(w.DLBooking.getState().step, before);
  });

  test('booking_show_date OPENS a date and never advances to FORM, both ways', async () => {
    const day = new Date(Date.now() + 5 * DAY_MS).toISOString().slice(0, 10);

    const msg = await bootBookPage({ withInject: true });
    viaMessage(msg.w, 'booking_select_type', 'consult-30');
    await tick(40);
    viaMessage(msg.w, 'booking_show_date', { day });
    await tick(20);

    const dir = await bootBookPage();
    viaDirect(dir.w, 'booking_select_type', 'consult-30');
    await tick(40);
    const res = viaDirect(dir.w, 'booking_show_date', { day });
    await tick(20);

    assert.equal(res.result.ok, true, 'the direct call resolved the day');
    for (const { w, label } of [{ w: msg.w, label: 'message' }, { w: dir.w, label: 'direct' }]) {
      const s = w.DLBooking.getState();
      assert.equal(s.step, 'DATE_PICK', `${label}: showDate is browse, never commit`);
      assert.equal(s.selectedSlot, null, `${label}: showDate selects nothing`);
      assert.ok(s.selectedDay, `${label}: the day is open`);
    }
  });

  test('booking_show_date accepts the {day} object /fn/do_page_action emits', async () => {
    const { w } = await bootBookPage();
    viaDirect(w, 'booking_select_type', 'consult-30');
    await tick(40);
    // do_page_action.js builds `{cmd:'booking_show_date', payload:{day}}` — an
    // object, never a bare string. The adapter must pass it through unchanged.
    const res = viaDirect(w, 'booking_show_date', { day: new Date(Date.now() + 5 * DAY_MS).toISOString().slice(0, 10) });
    assert.equal(res.result.ok, true);
  });

  test('booking_select_slot — ISO form selects and advances, both ways', async () => {
    const iso = slotAt(5, 16);

    const msg = await bootBookPage({ withInject: true });
    viaMessage(msg.w, 'booking_select_type', 'consult-30');
    await tick(40);
    viaMessage(msg.w, 'booking_select_slot', iso);
    await tick(20);

    const dir = await bootBookPage();
    viaDirect(dir.w, 'booking_select_type', 'consult-30');
    await tick(40);
    const res = viaDirect(dir.w, 'booking_select_slot', iso);
    await tick(20);

    assert.equal(res.result.ok, true);
    for (const { w, label } of [{ w: msg.w, label: 'message' }, { w: dir.w, label: 'direct' }]) {
      const s = w.DLBooking.getState();
      assert.equal(s.step, 'FORM', label);
      assert.equal(s.selectedSlot.startISO, iso, label);
    }
  });

  test('booking_select_slot — {day,time} form matches in the display timezone', async () => {
    const { w } = await bootBookPage();
    viaDirect(w, 'booking_select_type', 'consult-30');
    await tick(40);
    // data-tz="UTC", so the 14:00Z slot renders as 2 PM.
    const res = viaDirect(w, 'booking_select_slot', {
      day: new Date(Date.now() + 5 * DAY_MS).toISOString().slice(0, 10),
      time: '2 PM',
    });
    assert.equal(res.result.ok, true, JSON.stringify(res.result));
    assert.equal(w.DLBooking.getState().selectedSlot.startISO, slotAt(5, 14));
  });

  test('booking_select_slot defers when availability has not loaded, both ways', async () => {
    const { w } = await bootBookPage();
    const iso = slotAt(5, 14);
    // No selectType yet → the widget has no slots. The API's contract is to hold
    // the target and apply it on load, not to fail.
    const res = viaDirect(w, 'booking_select_slot', iso);
    assert.deepEqual({ ...res.result }, { ok: true, deferred: true });
    viaDirect(w, 'booking_select_type', 'consult-30');
    await tick(40);
    assert.equal(w.DLBooking.getState().selectedSlot.startISO, iso, 'the deferred pick applied');
  });

  test('set_call_id sets window.__perchCallId, both ways', async () => {
    const msg = await bootBookPage({ withInject: true });
    viaMessage(msg.w, 'set_call_id', { call_id: 'call_abc123' });
    await tick(20);
    assert.equal(msg.w.__perchCallId, 'call_abc123');

    const dir = await bootBookPage();
    viaDirect(dir.w, 'set_call_id', { call_id: 'call_abc123' });
    assert.equal(dir.w.__perchCallId, 'call_abc123');
  });

  test('an absent widget is reported, not thrown — the message path loses it the same way', async () => {
    const dom = new JSDOM('<!doctype html><body></body>', { url: ORIGIN + '/contact.html' });
    installPMShim(dom.window);
    const c = createBookingControl(dom.window, dom.window.document);
    for (const cmd of ['booking_prefill', 'booking_select_type', 'booking_select_slot', 'booking_show_date']) {
      const r = c.apply(cmd, { day: 'x', time: 'y' });
      assert.equal(r.handled, true, cmd);
      assert.equal(r.reason, 'widget_absent', cmd);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. The prefill re-delivery loop still terminates
// ─────────────────────────────────────────────────────────────────────────────

describe('prefill re-delivery stops on the direct path too', () => {
  test('a direct prefill acks, so js/perch/call.js clears its retry interval', async () => {
    const { w } = await bootBookPage();
    const acks = [];
    w.addEventListener('message', (e) => {
      if (e.data && e.data.__perchBookingAck) acks.push(e.data);
    });
    const r = viaDirect(w, 'booking_prefill', PREFILL);
    await tick(20);
    assert.equal(r.acked, true);
    assert.deepEqual(acks.map((a) => ({ ...a })), [{ __perchBookingAck: true, action: 'prefill' }],
      'the exact shape js/perch/call.js:102 listens for');
  });

  test('no ack is forged when the widget script is not on the page', async () => {
    // The retry loop is the ONLY thing covering that window. Acking here would
    // silence it and the prefill would be lost — RE-INIT-INVENTORY §3.5.
    const dom = new JSDOM('<!doctype html><body></body>', { url: ORIGIN + '/contact.html' });
    installPMShim(dom.window);
    const acks = [];
    dom.window.addEventListener('message', (e) => { if (e.data && e.data.__perchBookingAck) acks.push(e.data); });
    const r = createBookingControl(dom.window, dom.window.document).apply('booking_prefill', PREFILL);
    assert.equal(r.reason, 'widget_absent');
    assert.equal(r.acked, undefined);
    assert.deepEqual(acks, []);
  });

  test('the message path still acks unchanged — the bridge listener is untouched', async () => {
    const { w } = await bootBookPage({ withInject: true });
    const acks = [];
    w.addEventListener('message', (e) => { if (e.data && e.data.__perchBookingAck) acks.push(e.data); });
    viaMessage(w, 'booking_prefill', PREFILL);
    await tick(20);
    assert.equal(acks.length, 1, 'the widget bridge posted its ack as it always has');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. Task 4 — the trust boundary
// ─────────────────────────────────────────────────────────────────────────────

describe('nothing auto-submits and the write path is not reachable', () => {
  test('the adapter names no submit-shaped method', () => {
    const src = read('js/perch/booking-control.js');
    for (const m of FORBIDDEN_METHODS) {
      assert.doesNotMatch(src, new RegExp(`DLBooking\\W+${m}\\s*\\(`, 'i'), `must never call ${m}()`);
      assert.doesNotMatch(src, new RegExp(`surface\\[['"]${m}['"]\\]`, 'i'));
    }
    assert.equal(Object.values(COMMAND_MAP).filter(Boolean).length, 4, 'four verbs, none of them submit');
  });

  test('DLBooking still publishes no submit for the adapter to find', async () => {
    const { w } = await bootBookPage();
    for (const m of FORBIDDEN_METHODS) {
      assert.equal(typeof w.DLBooking[m], 'undefined', `DLBooking.${m} must not exist`);
    }
  });

  test('driving every command to the FORM step issues no booking POST', async () => {
    const { w } = await bootBookPage();
    const posts = [];
    const inner = w.fetch;
    w.fetch = async (url, opts) => {
      if (opts && String(opts.method).toUpperCase() === 'POST') posts.push(String(url));
      return inner(url, opts);
    };

    viaDirect(w, 'set_call_id', { call_id: 'call_abc123' });
    viaDirect(w, 'booking_prefill', PREFILL);
    viaDirect(w, 'booking_select_type', 'consult-30');
    await tick(40);
    viaDirect(w, 'booking_show_date', { day: new Date(Date.now() + 5 * DAY_MS).toISOString().slice(0, 10) });
    viaDirect(w, 'booking_select_slot', slotAt(5, 14));
    await tick(60);

    assert.equal(w.DLBooking.getState().step, 'FORM', 'the caller is standing at the Confirm button');
    assert.deepEqual(posts, [], 'the agent filled everything in and submitted nothing');
    // The Confirm button is present and unpressed — that is the boundary.
    const submit = w.document.querySelector('#dl-booking form button[type="submit"], #dl-booking button[type="submit"]');
    assert.ok(submit, 'the caller still has a button to press');
  });

  test('the adapter cannot reach the booking write path', () => {
    // COMMENTS STRIPPED FIRST. This file explains itself by naming
    // /booking/create in prose, and a guard that greps its own commentary fails
    // on the sentence describing the thing it forbids — see
    // [[feedback_regression_guard_greps_own_comments]]. Only executable text is
    // asserted here.
    const code = read('js/perch/booking-control.js')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    assert.doesNotMatch(code, /booking\/create/, 'no reference to the write endpoint');
    assert.doesNotMatch(code, /\bfetch\s*\(/, 'the adapter performs no network I/O at all');
    assert.doesNotMatch(code, /XMLHttpRequest|sendBeacon|\.submit\s*\(/, 'and no other way to send one');
    // The one place a booking is created is the widget's own form submit, which
    // only a caller click reaches. Nothing this ticket added is in that path.
    assert.doesNotMatch(code, /requestSubmit|click\s*\(/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. Task 3 — the iframe postMessage path is unchanged
// ─────────────────────────────────────────────────────────────────────────────

// ── REMOVED: describe('the postMessage path the shell uses is untouched') ──────
//
// Four tests, all driving perch-inject.js: that it forwarded all five booking
// commands to `dl-booking`, that its command set matched COMMAND_MAP, that it
// origin-gated, and that a forged origin was rejected on both paths.
//
// The injector ran INSIDE the shell's iframe and existed to carry commands across
// the frame boundary. The shell is deleted, so there is no boundary and no second
// path — which this file's own header already anticipated: "perch-inject -> widget
// have nothing left to cross".
//
// The surviving path is booking-control.js reaching the widget from the same page,
// and every describe above drives exactly that. The widget's own origin gate is
// still asserted in 'nothing auto-submits and the write path is not reachable'.

// ─────────────────────────────────────────────────────────────────────────────
// 6. The layer host gate — direct only when a router is registered
// ─────────────────────────────────────────────────────────────────────────────

describe('the layer host takes the direct road only under the router', () => {
  test('drive() gates the direct path on router registration, not on a global', () => {
    // The gate has to be un-flippable from outside. A31 (#56) got that with a
    // closure variable set by `setRouter()` — but `setRouter` was published on
    // `window.Perch.layer`, so the thing that SET the un-flippable variable was
    // itself replaceable by any script on the page. DR-INSANE-A33 (#58) moved the
    // slot into js/perch/surface.js §2, reached here through `hasRouter()`, with
    // no setter anywhere on the window.
    //
    // The gate SEMANTICS are unchanged: `hasRouter()` returns the same
    // `router !== null` this line used to spell inline. It is asserted for effect
    // — false before registration, true after, and immune to a second registrant
    // — in test/perch-surface.test.mjs §4, against the real layer running in a
    // real document. This stays a source check only for what a source check is
    // good for: proving the gate is not read from anywhere the page can write.
    assert.match(layerSrc, /if \(hasRouter\(\) && control\.handles\(cmd\)\)/);
    assert.doesNotMatch(layerSrc, /window\.__perchRouterActive|globalThis\.\w*[Rr]outerActive/);
    // Code only. js/perch-layer.js documents the removed `setRouter` by name in
    // the note explaining why it is gone, and a guard that reads its own
    // documentation fails on a well-documented fix.
    // See [[feedback_regression_guard_greps_own_comments]].
    const layerCode = layerSrc.split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.doesNotMatch(layerCode, /\bsetRouter\b/, 'A33: no navigation-callback setter, under any owner');
  });

  test('the postMessage fallback is still there for every other case', () => {
    assert.match(layerSrc, /window\.postMessage\(\{ type: 'perch', cmd, target, payload/);
  });

  // REMOVED: the shell adapter is not the one that changed
  // js/page/perch-shell.js owned the iframe host and is deleted with the shell, so
  // there is no second adapter to hold still while this one changes.

  // REMOVED: js/perch/call.js is gone; there is no call engine left to keep the adapter out of.
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. The donovan_booking_unlock handshake
// ─────────────────────────────────────────────────────────────────────────────

describe('the unlock handshake reveals the form on the direct path', () => {
  test('the write half is unchanged and still precedes the navigate', () => {
    // Ordering, asserted by driving the real dispatch: the localStorage write has
    // to be observable by the time `host.go` is called, because js/perch/
    // booking-control.js's revealGate() reads it synchronously on a same-page visit.
    const order = [];
    const store = {};
    const win = {
      localStorage: {
        setItem: (k, v) => { order.push('write:' + k); store[k] = v; },
        getItem: (k) => store[k],
      },
      location: { origin: 'https://x.test' },
      addEventListener: () => {},
    };
    const host = {
      drive: () => {},
      go: () => order.push('go'),
      afterNavigate: () => {},
      onContentReady: () => {},
    };
    createCommandChannel(host, {}, win).dispatch({ cmd: 'navigate', target: '/book.html' });
    assert.deepEqual(order, ['write:donovan_booking_unlock', 'go'],
      'the unlock write must still happen BEFORE the navigation');
    // …and only for /book. A tour hop must not silently unlock the calendar.
    order.length = 0;
    createCommandChannel(host, {}, win).dispatch({ cmd: 'navigate', target: '/tax.html' });
    assert.deepEqual(order, ['go']);
  });

  test('a swap into /book reveals #book-live through DL.ready, no iframe involved', async () => {
    const { w } = await bootBookPage({ unlock: true });
    // The load-path reveal already fired; prove the SWAP path does too by
    // re-hiding and dispatching the event A2.2 dispatches.
    w.document.getElementById('book-gate').style.display = 'block';
    w.document.getElementById('book-live').style.display = 'none';
    w.document.dispatchEvent(new w.CustomEvent('dl:content-swapped', { detail: { url: '/book.html' } }));
    await tick(10);
    assert.equal(w.document.getElementById('book-gate').style.display, 'none');
    assert.equal(w.document.getElementById('book-live').style.display, 'block');
  });

  test('revealGate() opens the form for the same-URL navigate a swap never fires', async () => {
    const { w } = await bootBookPage({ unlock: false });
    const c = createBookingControl(w, w.document);
    assert.equal(w.document.getElementById('book-live').style.display, 'none', 'locked to start');

    // Paula unlocks a caller who is ALREADY on /book. No swap fires, so no
    // DL.ready callback re-runs — this call is the whole repair.
    w.localStorage.setItem('donovan_booking_unlock', String(Date.now()));
    const r = c.revealGate();
    assert.deepEqual({ ...r.result }, { revealed: true });
    assert.equal(w.document.getElementById('book-gate').style.display, 'none');
    assert.equal(w.document.getElementById('book-live').style.display, 'block');
  });

  test('revealGate() honours the 30-minute window — it opens nothing on its own', async () => {
    const { w } = await bootBookPage({ unlock: false });
    w.localStorage.setItem('donovan_booking_unlock', String(Date.now() - 31 * 60 * 1000));
    const r = createBookingControl(w, w.document).revealGate();
    // JORDAN-SITE-UX-FIXES-R1 added an additive `intake` field to the LOCKED
    // verdict — the /book guard's own decision, carried out so it can be read (see
    // test/booking-qualifier-guard.test.mjs §2). The two keys this test is about
    // are unchanged, so it asserts them by name rather than by the whole object;
    // pinning the shape would make every later field a failure of this test.
    assert.equal(r.result.revealed, false);
    assert.equal(r.result.reason, 'locked');
    assert.equal(w.document.getElementById('book-live').style.display, 'none', 'an expired unlock reveals nothing');
  });

  test('revealGate() is idempotent and quiet off /book', async () => {
    const { w } = await bootBookPage({ unlock: true });
    const c = createBookingControl(w, w.document);
    assert.deepEqual({ ...c.revealGate().result }, { revealed: true });
    assert.deepEqual({ ...c.revealGate().result }, { revealed: true }, 'running twice is safe');

    const other = new JSDOM('<!doctype html><body></body>', {
      url: ORIGIN + '/contact.html',
      runScripts: 'outside-only',
    });
    // Unlocked, so the gate gets past the localStorage check and has to decide on
    // the DOM — which is the branch under test: an unlocked caller on a page with
    // no #book-gate must be a quiet no-op, not a throw.
    other.window.localStorage.setItem('donovan_booking_unlock', String(Date.now()));
    other.window.eval(dlInitSrc);
    other.window.eval(gateSrc);
    const r = createBookingControl(other.window, other.window.document).revealGate();
    assert.equal(r.result.revealed, false);
    assert.equal(r.result.reason, 'not_book_page');
  });

  test('the gate is absent, not fatal, when js/page/booking-gate.js never loaded', () => {
    const dom = new JSDOM('<!doctype html><body></body>', { url: ORIGIN });
    const r = createBookingControl(dom.window, dom.window.document).revealGate();
    assert.equal(r.reason, 'gate_absent');
  });

  test('booking-gate.js still registers through DL.ready — A02 behaviour is intact', () => {
    assert.match(gateSrc, /DL\.ready\(revealBookingGate\)/);
    assert.match(gateSrc, /params\.get\('unlock'\) === 'dev'/, 'the documented dev bypass survives');
    assert.match(gateSrc, /30 \* 60 \* 1000/, 'the same 30-minute window');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. Diagnostics expose state, never control
// ─────────────────────────────────────────────────────────────────────────────

describe('probe() is read-only', () => {
  test('it reports the surface without offering a way to drive it', async () => {
    const { w } = await bootBookPage();
    const c = createBookingControl(w, w.document);
    c.apply('booking_prefill', PREFILL);
    const p = c.probe();
    assert.equal(p.widgetPresent, true);
    assert.equal(p.gatePublished, true);
    assert.deepEqual(p.methods.sort(), ['prefill', 'selectSlot', 'selectType', 'showDate']);
    assert.equal(p.log.at(-1).cmd, 'booking_prefill');
    for (const v of Object.values(p)) assert.notEqual(typeof v, 'function', 'probe returns data, not handles');
  });

  test('the log is bounded — a long call cannot grow it without limit', async () => {
    const { w } = await bootBookPage();
    const c = createBookingControl(w, w.document);
    for (let i = 0; i < 80; i++) c.apply('set_call_id', { call_id: 'c' + i });
    assert.ok(c.probe().log.length <= 10);
  });
});
