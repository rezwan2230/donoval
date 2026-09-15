// JORDAN-BOOKING-WIDGET-DETAILS-R1 — the details step reached on ONE slot click.
//
// ── THE DEFECT THIS GUARDS ───────────────────────────────────────────────────
// On a voice-assisted booking the caller could not reach the details or
// confirmation screen and had to re-select the time slot; the call was marked
// Unsuccessful.
//
// The widget held TWO definitions of "a slot was selected":
//
//   Paula's path   DLBooking.selectSlot → _applySlot → step = 'FORM', details render
//   the caller's   .dl-bk-slot-btn click → state.selectedSlot = …; render()
//                                          step STAYS 'DATE_PICK'
//
// So the same act advanced the widget for one driver and not the other. The
// caller's screen still said "Select a date"; the tapped slot turned green and a
// NEXT button appeared at the bottom, and only pressing THAT reached the details.
// A caller who reads "nothing happened" re-taps the slot — and the re-tap was a
// no-op, because re-selecting the selected slot re-rendered the same screen.
//
// ── WHY THESE ASSERTIONS AND NOT "THE HANDLER CALLS _applySlot" ──────────────
// Every check below drives the REAL widget through a REAL click and reads the
// REAL published state, never the source text of the handler. A guard that
// grepped for `_applySlot` would pass a handler that called it on the wrong slot,
// or after the step had already moved, or not at all on a second click.
// See [[feedback_assert_behavior_not_source_spelling]].
//
// The negative controls matter as much as the positives. `noRePick` is only
// meaningful if a re-pick was ever the thing being avoided, so the suite also
// asserts that a SECOND click still lands on a coherent details step rather than
// bouncing the caller backwards — the failure a naive `if (step === 'FORM') return`
// guard would introduce.

import { test, describe, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const SITE = new URL('../donovan-legal-site/', import.meta.url);
const widgetSrc = readFileSync(fileURLToPath(new URL('js/booking-widget.js', SITE)), 'utf8');

const ORIGIN = 'https://www.donovan.law';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const DAY = 24 * 60 * 60 * 1000;

/**
 * Two days, three slots each. More than one of each on purpose: a single-slot,
 * single-day fixture cannot tell "advanced on the slot I clicked" from
 * "advanced on the only slot there was".
 */
function buildSlots() {
  const base = new Date(Date.now() + 5 * DAY);
  base.setUTCHours(14, 0, 0, 0); // 10:00 America/New_York
  const out = [];
  for (let d = 0; d < 2; d++) {
    for (let h = 0; h < 3; h++) {
      const start = new Date(base.getTime() + d * DAY + h * 3600 * 1000);
      out.push({ startISO: start.toISOString(), endISO: new Date(start.getTime() + 30 * 60000).toISOString() });
    }
  }
  return out;
}

/** Boot the real widget in a fresh jsdom, mocked to reach DATE_PICK. */
async function bootWidget() {
  const slots = buildSlots();
  const dom = new JSDOM(
    '<!doctype html><body>'
    + '<div id="dl-booking" data-api="https://api.test" data-deployment="donovan-main"'
    + ' data-type="consult" data-tz="America/New_York"></div>'
    + '</body>',
    { runScripts: 'outside-only', url: ORIGIN, pretendToBeVisual: true },
  );
  const { window } = dom;

  const posts = [];
  window.fetch = (url, init) => {
    const u = String(url);
    let body;
    if (u.includes('/booking/types')) {
      body = { types: [{ id: 'consult', name: 'Initial Consultation', duration_min: 30 }] };
    } else if (u.includes('/booking/availability')) {
      body = { slots };
    } else if (u.includes('/booking/create')) {
      posts.push({ body: JSON.parse(init.body), headers: init.headers });
      body = { ok: true, confirmed: true };
      return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve(body) });
    } else {
      body = { ok: true };
    }
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
  };
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};

  window.eval(widgetSrc);
  window.document.dispatchEvent(new window.Event('DOMContentLoaded'));
  await tick(60);

  const container = window.document.getElementById('dl-booking');
  return {
    window,
    container,
    slots,
    posts,
    state: () => window.DLBooking.getState(),
    q: (sel) => container.querySelector(sel),
    all: (sel) => [...container.querySelectorAll(sel)],
  };
}

describe('JORDAN-BOOKING-WIDGET-DETAILS-R1 — details on the first valid slot selection', () => {
  test('precondition: the widget reaches DATE_PICK with a strip and slots', async () => {
    const w = await bootWidget();
    assert.equal(w.state().step, 'DATE_PICK');
    assert.equal(w.all('.dl-bk-date-btn').length, 2, 'two days in the strip');
    assert.ok(w.all('.dl-bk-slot-btn').length >= 3, 'the auto-selected day shows its times');
  });

  test('ONE slot click renders the details step — no second control to find', async () => {
    const w = await bootWidget();
    w.all('.dl-bk-date-btn')[0].click();
    await tick(10);

    const slotBtns = w.all('.dl-bk-slot-btn');
    assert.ok(slotBtns.length >= 2, 'need more than one slot to prove the right one was taken');
    slotBtns[1].click();
    await tick(10);

    const st = w.state();
    assert.equal(st.step, 'FORM', 'the step advanced on the first click');
    assert.ok(w.q('#dl-bk-form'), 'the details form is in the DOM');
    assert.ok(w.q('#dl-bk-name'), 'the name field is in the DOM');
    assert.ok(w.q('#dl-bk-email'), 'the email field is in the DOM');
    assert.ok(w.q('#dl-bk-phone'), 'the phone field is in the DOM');
    assert.ok(w.q('#dl-bk-submit'), 'the Confirm button is in the DOM');
    // The heading the caller reads must have moved off "Select a date".
    assert.equal(w.q('.dl-bk-step-label').textContent, 'Your details');
  });

  test('the slot that advances is the slot that was CLICKED', async () => {
    const w = await bootWidget();
    w.all('.dl-bk-date-btn')[0].click();
    await tick(10);

    // Click the third time on the day, not the first — an implementation that
    // grabbed `daySlots[0]`, or that re-used the day's auto-selection, passes a
    // "did it advance?" assertion and fails this one.
    const label = w.all('.dl-bk-slot-btn')[2].textContent.trim();
    w.all('.dl-bk-slot-btn')[2].click();
    await tick(10);

    const st = w.state();
    assert.equal(st.step, 'FORM');
    assert.ok(st.selectedSlot, 'a slot is selected');
    const shown = w.q('#dl-bk-form').previousElementSibling.textContent;
    assert.ok(shown.includes(label), `the details step reads back "${label}", got "${shown}"`);
  });

  test('NO re-pick is required, and a re-pick is not what fixed it', async () => {
    const w = await bootWidget();
    w.all('.dl-bk-date-btn')[0].click();
    await tick(10);

    // Exactly ONE click. Nothing else is touched between here and the assertion.
    w.all('.dl-bk-slot-btn')[1].click();
    await tick(10);

    assert.equal(w.state().step, 'FORM', 'one click was enough');
    // And the control the caller used to have to hunt for is not on this screen
    // at all — so "reachable only via #dl-bk-next" cannot come back quietly.
    assert.equal(w.q('#dl-bk-next'), null, 'the details step carries no Next control');
  });

  test('a second day can still be opened, and picking there advances too', async () => {
    const w = await bootWidget();
    // Open day two, then pick on it — the path a caller takes when the first
    // day does not suit them. `_applySlot` re-derives selectedDay, so this
    // catches a fix that hard-coded the auto-selected day.
    w.all('.dl-bk-date-btn')[1].click();
    await tick(10);
    assert.equal(w.state().step, 'DATE_PICK', 'opening a date is browse, not commit');

    const dayTwoKey = w.state().selectedDay;
    w.all('.dl-bk-slot-btn')[0].click();
    await tick(10);

    assert.equal(w.state().step, 'FORM');
    assert.equal(w.state().selectedDay, dayTwoKey, 'stayed on the day the caller opened');
  });

  test('Back returns to the calendar, and re-picking from there advances again', async () => {
    const w = await bootWidget();
    w.all('.dl-bk-date-btn')[0].click();
    await tick(10);
    w.all('.dl-bk-slot-btn')[1].click();
    await tick(10);
    assert.equal(w.state().step, 'FORM');

    w.q('#dl-bk-back').click();
    await tick(10);
    assert.equal(w.state().step, 'DATE_PICK', 'Back reaches the calendar');
    assert.ok(w.all('.dl-bk-slot-btn').length >= 3, 'the times are on screen again');

    // Choosing a DIFFERENT time from here must advance, not sit there. A fix
    // written as "advance only if no slot is selected yet" would fail here,
    // because coming back from FORM leaves selectedSlot set.
    w.all('.dl-bk-slot-btn')[2].click();
    await tick(10);
    assert.equal(w.state().step, 'FORM', 'a changed choice advances too');
  });

  test('focus lands on the name field, never on the bot honeypot', async () => {
    const w = await bootWidget();
    w.all('.dl-bk-date-btn')[0].click();
    await tick(10);
    w.all('.dl-bk-slot-btn')[1].click();
    await tick(10);

    const active = w.window.document.activeElement;
    assert.equal(active.id, 'dl-bk-name', `focus went to #${active.id || active.tagName}`);
    // Stated as its own assertion because this is the one that bites: the
    // honeypot is the FIRST <input> in the form, and a caller who types into it
    // has their booking silently discarded by handleFormSubmit's bot check.
    assert.notEqual(active.id, 'dl-bk-hp-field',
      'focus on the honeypot silently discards the booking at submit');
  });

  test('the happy path still books, and the POST contract is unchanged', async () => {
    const w = await bootWidget();
    w.all('.dl-bk-date-btn')[0].click();
    await tick(10);
    w.all('.dl-bk-slot-btn')[1].click();
    await tick(10);

    w.q('#dl-bk-name').value = 'Jane Smith';
    w.q('#dl-bk-email').value = 'jane@example.com';
    w.q('#dl-bk-phone').value = '(561) 555-0100';
    w.q('#dl-bk-notes').value = 'Real estate closing question';
    w.q('#dl-bk-form').dispatchEvent(new w.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick(60);

    assert.equal(w.posts.length, 1, 'exactly one POST /booking/create');
    const body = w.posts[0].body;

    // The shape Sheldon owns. Asserted as required-plus-optional rather than a
    // flat key list: `call_id` and `qualifier_claim` are spelled
    // `(window.__perchCallId || undefined)`, and JSON.stringify DROPS an
    // undefined value, so they are correctly absent from a plain web booking.
    const REQUIRED = ['deployment', 'email', 'name', 'notes', 'phone', 'slot', 'turnstile_token', 'type'];
    const OPTIONAL = ['call_id', 'qualifier_claim'];
    for (const k of REQUIRED) assert.ok(k in body, `POST body is missing "${k}"`);
    for (const k of Object.keys(body)) {
      assert.ok(REQUIRED.includes(k) || OPTIONAL.includes(k), `POST body grew an unexpected field "${k}"`);
    }
    assert.equal(body.name, 'Jane Smith');
    assert.equal(body.email, 'jane@example.com');
    assert.equal(body.slot, w.state().selectedSlot.startISO, 'the slot posted is the slot chosen');
    assert.ok(w.posts[0].headers['Idempotency-Key'], 'the idempotency key still rides');

    // And the caller lands on a confirmation they can read.
    assert.ok(w.q('.dl-bk-confirm'), 'the confirmation screen rendered');
    assert.ok(w.q('.dl-bk-confirm-slot').textContent.length > 0, 'it names the appointment');
  });

  test('the caller\'s typing is never discarded as a bot submission', async () => {
    const w = await bootWidget();
    w.all('.dl-bk-date-btn')[0].click();
    await tick(10);
    w.all('.dl-bk-slot-btn')[1].click();
    await tick(10);

    // Type into whatever the widget actually focused — the way a caller who
    // starts typing the moment the form appears does, and the only thing a
    // keyboard or screen-reader user CAN do. Nothing here reaches for
    // #dl-bk-name by id; where the characters land is the whole question.
    w.window.document.activeElement.value = 'Jane Smith';
    w.q('#dl-bk-email').value = 'jane@example.com';
    w.q('#dl-bk-phone').value = '(561) 555-0100';

    // Read the honeypot BEFORE submitting: a successful submit re-renders to the
    // confirmation screen and the form — honeypot included — leaves the DOM, so
    // a post-submit read finds null and proves nothing either way.
    assert.equal(w.q('#dl-bk-hp-field').value, '', 'the caller\'s keystrokes did not land in the honeypot');
    assert.equal(w.q('#dl-bk-name').value, 'Jane Smith', 'they landed in the name field');

    w.q('#dl-bk-form').dispatchEvent(new w.window.Event('submit', { bubbles: true, cancelable: true }));
    await tick(60);

    // The control: before the focusFirst fix, the name field was still empty
    // here, validation failed, and posts stayed at 0 — a booking the caller
    // never learns was discarded.
    assert.equal(w.posts.length, 1, 'the booking was submitted, not silently dropped');
    assert.ok(w.q('.dl-bk-confirm'), 'and the caller reached the confirmation screen');
  });
});

describe('JORDAN-BOOKING-WIDGET-DETAILS-R1 — the agent path is unchanged', () => {
  test('showDate is still browse: it opens a day and does NOT advance', async () => {
    const w = await bootWidget();
    const dayTwo = w.all('.dl-bk-date-btn')[1].getAttribute('data-key');
    const res = w.window.DLBooking.showDate(dayTwo);
    await tick(10);

    // Read the field, not the object: `res` is constructed inside the jsdom
    // realm, so a deep-equal against a literal built in THIS realm fails on
    // prototype identity even when the value is right.
    assert.equal(res.ok, true, `showDate returned ${JSON.stringify(res)}`);
    assert.equal(w.state().step, 'DATE_PICK', 'showDate must never commit the caller to a time');
    assert.equal(w.state().selectedDay, dayTwo);
    assert.ok(!w.q('#dl-bk-form'), 'no details form from a browse');
  });

  test('selectSlot({day,time}) still reaches the details step', async () => {
    const w = await bootWidget();
    const dayKey = w.state().selectedDay;
    const spoken = w.all('.dl-bk-slot-btn')[1].textContent.trim();

    const res = w.window.DLBooking.selectSlot({ day: dayKey, time: spoken });
    await tick(10);

    assert.equal(res.ok, true, `selectSlot returned ${JSON.stringify(res)}`);
    assert.equal(w.state().step, 'FORM');
    assert.ok(w.q('#dl-bk-name'), 'Paula\'s pick lands on the same details step');
  });

  test('an agent prefill still reaches the fields the caller has not typed in', async () => {
    const w = await bootWidget();
    w.window.DLBooking.prefill({ name: 'Maria De La Cruz', email: 'maria@example.com' });
    w.all('.dl-bk-date-btn')[0].click();
    await tick(10);
    w.all('.dl-bk-slot-btn')[1].click();
    await tick(10);

    assert.equal(w.q('#dl-bk-name').value, 'Maria De La Cruz');
    assert.equal(w.q('#dl-bk-email').value, 'maria@example.com');
  });
});
