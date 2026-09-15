// JORDAN-PREFILL-NAMEEMAIL — booking-form prefill, driven end-to-end under jsdom.
//
// Guards the agent → form prefill path Paula uses when she opens the calendar for
// a caller. The reported symptom was "phone prefills, name and email don't". This
// suite drives the REAL production message chain and proves the widget/perch layer
// maps ALL of name, email and phone (and notes) — so a regression that silently
// drops name/email here (the riskiest, least-observable kind — a caller just sees
// blank fields) turns this suite red.
//
// Chain under test (identical hops to production):
//   perch shell  ── postMessage {type:'perch', cmd:'booking_prefill', payload} ─▶
//   perch-inject ── postMessage {type:'dl-booking', action:'prefill', payload} ─▶
//   booking-widget (DLBooking.prefill) ─▶ form <input> values
//
// The booking form has a SINGLE "Full name" field (#dl-bk-name), not separate
// first/last inputs — so a full name like "Maria De La Cruz" must land intact in
// that one field (no split). If the form is ever changed to first/last inputs,
// the "both name tokens present" assertion is where that contract is re-examined.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const SITE = new URL('../donovan-legal-site/', import.meta.url);
const widgetSrc = readFileSync(fileURLToPath(new URL('js/booking-widget.js', SITE)), 'utf8');

const ORIGIN = 'https://www.donovan.law';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

// A slot a few days out, inside the widget's loaded horizon and always in the future.
const SLOT_ISO = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();

const PAYLOAD = {
  name: 'Maria De La Cruz',
  email: 'maria@example.com',
  phone: '(561) 555-0142',
  notes: 'Real estate closing question',
};

// A real browser sets MessageEvent.origin to the SENDER'S origin; jsdom's
// same-window postMessage delivers origin "" instead, which trips the product's
// same-origin gate (perch-inject.js and booking-widget.js both reject
// e.origin !== location.origin). Restore browser semantics for the test only —
// this shim changes NO product behaviour, it makes jsdom honour the same contract
// a browser does. Without it the messages would be silently dropped and the test
// would prove nothing.
function installPMShim(w) {
  w.postMessage = function (data) {
    w.dispatchEvent(new w.MessageEvent('message', { data, origin: w.location.origin, source: w }));
  };
}

/** Boot a booking widget + perch injector in a fresh jsdom, mocked to reach DATE_PICK. */
async function bootWidget() {
  const dom = new JSDOM(
    '<!doctype html><body>'
      + '<div id="dl-booking" data-api="https://api.test" data-deployment="donovan-main"'
      + ' data-type="consult" data-tz="America/New_York"></div>'
      + '</body>',
    { runScripts: 'outside-only', url: ORIGIN, pretendToBeVisual: true },
  );
  const { window } = dom;

  // Mock the harness: one appointment type, one availability slot. /booking/create
  // is never called here (no submit) — the widget only reaches the FORM step.
  window.fetch = (url) => {
    const u = String(url);
    let body;
    if (u.includes('/booking/types')) body = { types: [{ id: 'consult', name: 'Initial Consultation', durationMin: 30 }] };
    else if (u.includes('/booking/availability')) body = { slots: [{ startISO: SLOT_ISO }] };
    else body = { ok: true };
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)) });
  };
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  installPMShim(window);

  window.eval(widgetSrc);
  // perch-inject.js was eval'd here as the second half of the chain. It lived INSIDE
  // the shell's iframe and translated the shell's {type:'perch', cmd} messages into
  // the {type:'dl-booking', action} the widget listens for. The shell is deleted, so
  // there is no frame boundary left to cross and no injector to load — see the note
  // at the top of js/perch/booking-control.js, which reaches the widget the same way
  // from the same page.

  // boot() runs on eval (readyState is already 'complete'); let types → availability resolve.
  await tick(0); await tick(0); await tick(20);
  return window;
}

/**
 * Drive a booking command into the widget, exactly as js/perch/booking-control.js
 * does today.
 *
 * This used to post `{type:'perch', cmd}` — the SHELL's vocabulary — and rely on
 * perch-inject.js inside the iframe to translate it to `{type:'dl-booking', action}`.
 * Both the shell and the injector are deleted. booking-control.js speaks the widget's
 * vocabulary directly from the same page (`booking_prefill` -> `'prefill'`, its
 * COMMANDS map), so the test drives the hop that actually exists.
 *
 * The thing this suite exists to catch is unchanged and is downstream of here: that
 * the widget maps ALL of name, email and phone rather than silently dropping name and
 * email, which a caller only ever sees as blank fields.
 */
const COMMANDS = { booking_prefill: 'prefill', booking_select_type: 'selectType',
  booking_select_slot: 'selectSlot', booking_show_date: 'showDate', booking_set_call_id: 'setCallId' };

function drive(window, cmd, payload) {
  const action = COMMANDS[cmd];
  assert.ok(action, `unknown booking command: ${cmd}`);
  window.postMessage({ type: 'dl-booking', action, payload });
}
const fieldVal = (window, id) => {
  const el = window.document.getElementById(id);
  assert.ok(el, `#${id} must exist at the FORM step`);
  return el.value;
};
const atForm = (window) => !!window.document.getElementById('dl-bk-form');

describe('JORDAN-PREFILL-NAMEEMAIL — booking form prefill (full agent→form chain)', () => {
  let window;
  beforeEach(async () => { window = await bootWidget(); });

  test('widget reaches DATE_PICK with availability loaded', () => {
    const st = window.DLBooking.getState();
    assert.equal(st.step, 'DATE_PICK');
    assert.ok(st.typesLoaded, 'types loaded');
  });

  test('prefill BEFORE the form renders: name, email AND phone all populate', async () => {
    drive(window, 'booking_prefill', PAYLOAD);
    await tick(10);
    // Stored for every field, not just phone. (Assert fields individually: getState's
    // object is created in the jsdom realm, so a deep-equal against a test-realm literal
    // trips on prototype identity — the values are what matter here.)
    const flags = window.DLBooking.getState().prefill;
    assert.equal(flags.name, true, 'name stored');
    assert.equal(flags.email, true, 'email stored');
    assert.equal(flags.phone, true, 'phone stored');
    assert.equal(flags.notes, true, 'notes stored');

    drive(window, 'booking_select_slot', SLOT_ISO); // advance to FORM
    await tick(20);
    assert.ok(atForm(window), 'widget advanced to FORM');

    // THE REGRESSION GUARD: name and email must populate, not only phone.
    assert.equal(fieldVal(window, 'dl-bk-name'), PAYLOAD.name);
    assert.equal(fieldVal(window, 'dl-bk-email'), PAYLOAD.email);
    assert.equal(fieldVal(window, 'dl-bk-phone'), PAYLOAD.phone);
    assert.equal(fieldVal(window, 'dl-bk-notes'), PAYLOAD.notes);
  });

  test('single full-name field carries BOTH first and last name (no split, nothing dropped)', async () => {
    drive(window, 'booking_prefill', PAYLOAD);
    await tick(10);
    drive(window, 'booking_select_slot', SLOT_ISO);
    await tick(20);
    const nameVal = fieldVal(window, 'dl-bk-name');
    assert.match(nameVal, /Maria/, 'first name present');
    assert.match(nameVal, /De La Cruz/, 'last name present');
  });

  test('prefill AFTER the form is already rendered (live-patch path) fills name and email too', async () => {
    drive(window, 'booking_select_slot', SLOT_ISO); // reach FORM first
    await tick(20);
    assert.ok(atForm(window), 'widget at FORM before prefill');

    drive(window, 'booking_prefill', PAYLOAD);
    await tick(10);
    assert.equal(fieldVal(window, 'dl-bk-name'), PAYLOAD.name);
    assert.equal(fieldVal(window, 'dl-bk-email'), PAYLOAD.email);
    assert.equal(fieldVal(window, 'dl-bk-phone'), PAYLOAD.phone);
  });

  test('phone mapping still works when it is the ONLY field supplied (working path unchanged)', async () => {
    drive(window, 'booking_prefill', { phone: PAYLOAD.phone });
    await tick(10);
    drive(window, 'booking_select_slot', SLOT_ISO);
    await tick(20);
    assert.equal(fieldVal(window, 'dl-bk-phone'), PAYLOAD.phone);
    assert.equal(fieldVal(window, 'dl-bk-name'), '', 'no name supplied → name stays empty');
    assert.equal(fieldVal(window, 'dl-bk-email'), '', 'no email supplied → email stays empty');
  });

  test('a caller-typed field is NOT overwritten by a later agent prefill', async () => {
    drive(window, 'booking_select_slot', SLOT_ISO); // reach FORM
    await tick(20);
    const nameEl = window.document.getElementById('dl-bk-name');
    nameEl.value = 'Typed By Caller';
    nameEl.dispatchEvent(new window.Event('input', { bubbles: true })); // marks the field dirty

    drive(window, 'booking_prefill', PAYLOAD);
    await tick(10);
    assert.equal(fieldVal(window, 'dl-bk-name'), 'Typed By Caller', 'caller value preserved');
    // Email was untouched by the caller, so the agent value still lands there.
    assert.equal(fieldVal(window, 'dl-bk-email'), PAYLOAD.email);
  });
});
