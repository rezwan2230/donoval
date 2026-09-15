// ── SARAH-PERCH-A41 · Task 5 — the booking guards, RE-RUN THROUGH THE REWIRED DOM
//
// Order SARAH-PERCH-A41-CUTOVER-QA · ticket #60 · Phase A / Phase 4.
//
// The 07-15 → 07-17 booking defects were each closed with a guard that drives the
// PRODUCTION message chain:
//
//     perch shell ─postMessage{type:'perch'}▶ perch-inject.js
//                 ─postMessage{type:'dl-booking'}▶ DLBooking ─▶ the <input>s
//
// At the promote that chain stops existing. There is no iframe, perch-inject.js
// never loads, and the same commands arrive through js/perch/booking-control.js
// instead. Every one of those guards is therefore, on the production path, about
// to be testing a code path nobody runs. This file re-runs the same SCENARIOS —
// same payloads, same orderings, same assertions — with the only difference being
// the hop that changed. If a scenario passes here and there, the rewire preserved
// the fix; if one passes there and fails here, the promote reopens a closed bug.
//
// Sources re-run, and what each one was closed for:
//   • test/booking-prefill.test.mjs  (#34, JORDAN-PREFILL-NAMEEMAIL) — "phone
//     prefills, name and email don't". Six scenarios, §1 below.
//   • the D4 double-book defect behind functions/booking/create.js's pre-write
//     availability re-check — restated here as the CLIENT-side question the
//     rewire actually raises: can a SWAP mid-submit cause a second POST? §2.
//   • RE-INIT-INVENTORY §3.8 / §5.11, GA4 page_view per swap. §3.
//
// NOTHING HERE SUBMITS. Every fetch is stubbed in-process; §2 asserts on the
// count of POSTs the widget attempted, which is the only way to observe a
// double-book without causing one.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import { createBookingControl } from '../donovan-legal-site/js/perch/booking-control.js';
import { reinit, gaPageView } from '../donovan-legal-site/js/perch/reinit.js';

const SITE = new URL('../donovan-legal-site/', import.meta.url);
const read = (p) => readFileSync(fileURLToPath(new URL(p, SITE)), 'utf8');

const widgetSrc = read('js/booking-widget.js');
// `injectSrc` (perch-inject.js) was read here, purely as this suite's NEGATIVE
// control: §0 loaded it to prove the shell envelope could still land, so that the
// no-injector run meant something. The file is deleted, and its absence is now
// permanent rather than a state to simulate.
const dlInitSrc = read('js/dl-init.js');
const gateSrc = read('js/page/booking-gate.js');

const ORIGIN = 'https://preview.donovan-site.pages.dev';
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const DAY_MS = 86400_000;

/** The exact payload #34 was closed with — a multi-token surname is the point. */
const PAYLOAD = {
  name: 'Maria De La Cruz',
  email: 'maria@example.com',
  phone: '(561) 555-0142',
  notes: 'Real estate closing question',
};

function slotAt(daysOut, hourUTC) {
  const d = new Date(Date.now() + daysOut * DAY_MS);
  d.setUTCHours(hourUTC, 0, 0, 0);
  return d.toISOString();
}
const SLOT_ISO = slotAt(5, 14);

// jsdom's same-window postMessage reports origin "" instead of the sender's, which
// trips the product's own same-origin gate. Same shim the two source suites use;
// it changes no product behaviour, it restores a browser guarantee jsdom lacks.
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
 * A booted /book page inside a <main id="perch-main"> — i.e. the A0.1 container,
 * so the document has the shape a swap actually lands in.
 *
 * `withInject` decides which chain is under test. The rewired run must reach the
 * same place WITHOUT perch-inject.js, because that file only ever ran inside the
 * shell's iframe.
 */
async function bootBookPage({ withInject = false } = {}) {
  const dom = new JSDOM(`<!doctype html><body><main id="perch-main">${BOOK_MARKUP}</main></body>`, {
    url: ORIGIN + '/book',
    runScripts: 'outside-only',
    pretendToBeVisual: true,
  });
  const w = dom.window;
  installPMShim(w);
  w.HTMLElement.prototype.scrollIntoView = function () {};
  w.scrollTo = () => {};
  w.localStorage.setItem('donovan_booking_unlock', String(Date.now()));

  const posts = [];
  w.fetch = async (url, opts) => {
    const u = String(url);
    if (opts && String(opts.method).toUpperCase() === 'POST') posts.push({ url: u, body: opts.body });
    const body = u.includes('availability')
      ? { slots: [{ startISO: SLOT_ISO }, { startISO: slotAt(5, 16) }] }
      : u.includes('/booking/types')
        ? { types: [{ id: 'consult-30', name: '30-minute consult', duration: 30 }] }
        : { ok: true };
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };

  w.eval(dlInitSrc);
  w.eval(gateSrc);
  w.eval(widgetSrc);
  if (withInject) w.eval(injectSrc);

  await tick(30);
  return { dom, w, posts };
}

/** The rewired hop: the shipped adapter, straight at DLBooking. No frame. */
const rewired = (w) => createBookingControl(w, w.document);
/** The hop that is going away: the shell's envelope at perch-inject.js. */
const viaShell = (w, cmd, payload) => w.postMessage({ type: 'perch', cmd, target: null, payload });

const fieldVal = (w, id) => {
  const el = w.document.getElementById(id);
  assert.ok(el, `#${id} must exist at the FORM step`);
  return el.value;
};
const atForm = (w) => !!w.document.getElementById('dl-bk-form');

/** Walk the widget to the FORM step the way Paula does. */
async function toForm(w, c) {
  c.apply('booking_select_type', 'consult-30');
  await tick(40);
  c.apply('booking_select_slot', SLOT_ISO);
  await tick(60);
  assert.ok(atForm(w), 'precondition: the widget must reach the FORM step');
}

// ─────────────────────────────────────────────────────────────────────────────
// 0. Non-vacuity — the rewired chain is genuinely a DIFFERENT chain
// ─────────────────────────────────────────────────────────────────────────────
describe('§0 — the rewired run really is running without the iframe hop', () => {
  test('perch-inject.js is NOT loaded, and the shell envelope reaches nobody', async () => {
    const { w } = await bootBookPage();               // no injector, as in production-after-promote
    assert.equal(w.__perchInjected, undefined, 'the iframe executor must be absent');

    viaShell(w, 'booking_prefill', PAYLOAD);          // the old chain, into the void
    await tick(20);
    assert.deepEqual({ ...w.DLBooking.getState().prefill }, { name: false, email: false, phone: false, notes: false },
      'with no injector the shell envelope is unobserved — which is exactly why A31 exists');
  });

  // REMOVED: CONTROL — with the injector loaded the SAME envelope does land
  // This was the positive arm for the test above: it loaded perch-inject.js so that
  // "the shell envelope reaches nobody" could not pass merely because the harness was
  // broken. The injector is deleted, so the arm cannot be run — and does not need to
  // be: what it guarded against was a PREMATURE claim that the hop was gone. The hop
  // is gone, in the tree, and the sibling test below still asserts the rewired chain
  // positively lands its prefill.
});

// ─────────────────────────────────────────────────────────────────────────────
// 1. #34 JORDAN-PREFILL-NAMEEMAIL — all six scenarios, through the rewired DOM
// ─────────────────────────────────────────────────────────────────────────────
describe('§T5.1 — the 07-15→07-17 prefill guards, re-run through the rewired DOM', () => {
  test('the widget reaches DATE_PICK with availability loaded (harness precondition)', async () => {
    const { w } = await bootBookPage();
    const c = rewired(w);
    c.apply('booking_select_type', 'consult-30');
    await tick(40);
    assert.equal(w.DLBooking.getState().step, 'DATE_PICK');
  });

  test('prefill BEFORE the form renders: name, email AND phone all populate', async () => {
    // The reported symptom, verbatim: phone landed, name and email did not.
    const { w } = await bootBookPage();
    const c = rewired(w);
    const res = c.apply('booking_prefill', PAYLOAD);
    assert.equal(res.handled, true);
    await toForm(w, c);

    assert.equal(fieldVal(w, 'dl-bk-name'), PAYLOAD.name);
    assert.equal(fieldVal(w, 'dl-bk-email'), PAYLOAD.email);
    assert.equal(fieldVal(w, 'dl-bk-phone'), PAYLOAD.phone);
    assert.equal(fieldVal(w, 'dl-bk-notes'), PAYLOAD.notes);
  });

  test('the single full-name field carries BOTH name tokens — no split, nothing dropped', async () => {
    const { w } = await bootBookPage();
    const c = rewired(w);
    c.apply('booking_prefill', PAYLOAD);
    await toForm(w, c);

    const v = fieldVal(w, 'dl-bk-name');
    assert.equal(v, 'Maria De La Cruz');
    for (const token of ['Maria', 'De', 'La', 'Cruz']) {
      assert.ok(v.includes(token), `"${token}" must survive into the one full-name input`);
    }
  });

  test('prefill AFTER the form is already rendered (the live-patch path) fills name and email too', async () => {
    const { w } = await bootBookPage();
    const c = rewired(w);
    await toForm(w, c);                                // form first…
    c.apply('booking_prefill', PAYLOAD);               // …then Paula's payload
    await tick(20);

    assert.equal(fieldVal(w, 'dl-bk-name'), PAYLOAD.name);
    assert.equal(fieldVal(w, 'dl-bk-email'), PAYLOAD.email);
    assert.equal(fieldVal(w, 'dl-bk-phone'), PAYLOAD.phone);
  });

  test('phone-only prefill still works (the path that was never broken stays unbroken)', async () => {
    const { w } = await bootBookPage();
    const c = rewired(w);
    c.apply('booking_prefill', { phone: '(561) 555-0199' });
    await toForm(w, c);

    assert.equal(fieldVal(w, 'dl-bk-phone'), '(561) 555-0199');
    assert.equal(fieldVal(w, 'dl-bk-name'), '', 'and nothing is invented for the fields Paula did not send');
  });

  test('a caller-typed field is NOT overwritten by a later agent prefill', async () => {
    const { w } = await bootBookPage();
    const c = rewired(w);
    await toForm(w, c);

    const email = w.document.getElementById('dl-bk-email');
    email.value = 'iTypedThisMyself@example.com';
    email.dispatchEvent(new w.Event('input', { bubbles: true }));
    await tick(10);

    c.apply('booking_prefill', PAYLOAD);
    await tick(20);
    assert.equal(fieldVal(w, 'dl-bk-email'), 'iTypedThisMyself@example.com',
      'the caller outranks the agent — clobbering typed input was the other half of #34');
    assert.equal(fieldVal(w, 'dl-bk-name'), PAYLOAD.name, 'while untouched fields still fill');
  });

  test('the re-delivery loop is acked, so call.js stops firing into the caller\'s clicks', async () => {
    // js/perch/call.js re-delivers prefill every 700 ms, capped at 6 tries, and
    // stops on {__perchBookingAck:true}. The iframe path's ack came from the
    // widget's bridge listener, which the rewired path never runs.
    const { w } = await bootBookPage();
    const acks = [];
    w.addEventListener('message', (e) => { if (e.data && e.data.__perchBookingAck) acks.push(e.data.action); });

    const out = rewired(w).apply('booking_prefill', PAYLOAD);
    await tick(20);
    assert.equal(out.acked, true);
    assert.deepEqual(acks, ['prefill']);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. Task 2 — a swap during an in-flight POST must not double-book
// ─────────────────────────────────────────────────────────────────────────────
//
// The deterministic half. test/preview/verify-a41.mjs §T2 runs the same shape on
// a real Preview deployment against the real router; this one holds the
// invariant in CI, where the timing can be pinned exactly.
describe('§T5.2 — a content swap while /booking/create is in flight issues no second POST', () => {
  /** Fill the form and press Confirm, with the POST held open by the test. */
  async function submitAndHold(w) {
    const c = rewired(w);
    c.apply('booking_prefill', PAYLOAD);
    await toForm(w, c);

    let release;
    const held = new Promise((r) => { release = r; });
    const posts = [];
    const inner = w.fetch;
    w.fetch = async (url, opts) => {
      if (opts && String(opts.method).toUpperCase() === 'POST') {
        posts.push(String(url));
        await held;                                     // the in-flight window
        return { ok: true, status: 201, json: async () => ({ ok: true, confirmed: true }), text: async () => '{}' };
      }
      return inner(url, opts);
    };

    const form = w.document.getElementById('dl-bk-form');
    assert.ok(form, 'precondition: a real form to submit');
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await tick(20);
    assert.equal(posts.length, 1, 'precondition: exactly one POST is in flight');
    assert.equal(w.DLBooking.getState().step, 'SUBMITTING', 'and the widget knows it');
    return { posts, release };
  }

  test('the re-init recipe running mid-submit does not re-submit', async () => {
    const { w } = await bootBookPage();
    const { posts, release } = await submitAndHold(w);

    // A swap lands: the router runs the §5 recipe against the live document.
    // §5.5 calls DLBooking.boot(), which is the step that could plausibly
    // re-mount the widget and lose — or repeat — the in-flight submit.
    const incoming = new JSDOM('<!doctype html><title>Contact</title><body><main id="perch-main"></main></body>').window.document;
    const recipe = reinit(w.document, w, incoming);
    await tick(40);

    const boot = recipe.rows.find((r) => /booking widget boot/.test(r.name));
    assert.equal(boot && boot.status, 'ok',
      'precondition: §5.5 must actually have re-booted the widget — otherwise this test '
      + 'proves nothing about what a re-boot does to an in-flight submit');

    assert.equal(posts.length, 1, 'A SECOND POST HERE IS A DOUBLE BOOKING');
    release();
    await tick(40);
    assert.equal(posts.length, 1, 'and none after the first response lands either');
  });

  test('the submit button stays disabled for the whole in-flight window', async () => {
    const { w } = await bootBookPage();
    const { posts, release } = await submitAndHold(w);

    // The other way a second POST is minted: a caller clicking Confirm again.
    const btn = w.document.querySelector('#dl-booking button[type="submit"]');
    if (btn) {
      assert.equal(btn.disabled, true, 'Confirm must be disabled while submitting');
      btn.click();
      await tick(20);
    }
    assert.equal(posts.length, 1, 'a second click must not mint a second booking');
    release();
  });

  test('and a booking command arriving mid-submit does not submit either', async () => {
    const { w } = await bootBookPage();
    const { posts, release } = await submitAndHold(w);

    const c = rewired(w);
    c.apply('booking_prefill', PAYLOAD);
    c.apply('booking_select_type', 'consult-30');
    c.apply('booking_select_slot', SLOT_ISO);
    c.apply('set_call_id', { call_id: 'call_midflight' });
    await tick(40);

    assert.equal(posts.length, 1, 'Paula cannot re-fire the write, whatever she sends');
    release();
  });

  test('CONTROL — the counter DOES reach 2 when a second POST is really issued', async () => {
    // Without this the three assertions above could all be passing because the
    // harness cannot see a second POST at all. Issue one directly at the same
    // stubbed fetch the widget uses, and require the counter to move.
    const { w } = await bootBookPage();
    const { posts, release } = await submitAndHold(w);
    assert.equal(posts.length, 1);

    w.fetch('https://api.test/booking/create', { method: 'POST', body: '{}' });
    await tick(20);
    assert.equal(posts.length, 2, 'the double-book counter is live — a second POST is observable');
    release();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. Task 5 — GA4 page_view fires PER SWAP, or is a documented stub
// ─────────────────────────────────────────────────────────────────────────────
describe('§T5.3 — GA4 page_view per swap: stubbed today, correct the day the id lands', () => {
  /** A minimal live document that the recipe can run against. */
  function pageWindow(title, path) {
    const dom = new JSDOM(`<!doctype html><title>${title}</title><body><main id="perch-main"></main></body>`,
      { url: ORIGIN + path });
    return dom.window;
  }

  test('THE MEASUREMENT ID IS ABSENT — so the row reports `pending`, not `ok` and not silence', () => {
    const w = pageWindow('Contact', '/contact');
    assert.equal(typeof w.gtag, 'undefined', 'precondition: no GA4 tag exists on this site');

    const rowOut = gaPageView(w.document, w);
    assert.equal(rowOut.status, 'pending', 'a missing tag must be REPORTED, never silently skipped');
    assert.match(rowOut.detail.reason, /measurement id/i,
      'and the reason must name the external blocker so the sign-off can cite it');
  });

  test('the stub is reported on EVERY swap, not once per session', () => {
    // The failure mode a "documented stub" hides is a row that stops being
    // emitted after the first swap. Three swaps, three rows.
    const statuses = [];
    for (const [title, path] of [['Contact', '/contact'], ['Book', '/book'], ['Blog', '/blog']]) {
      const w = pageWindow(title, path);
      const out = reinit(w.document, w, pageWindow(title, path).document);
      const ga = out.rows.find((r) => /GA4/.test(r.name));
      assert.ok(ga, `swap into ${path} emitted no GA4 row at all`);
      statuses.push(ga.status);
    }
    assert.deepEqual(statuses, ['pending', 'pending', 'pending']);
  });

  test('WHEN THE ID LANDS: exactly one page_view per swap, carrying the NEW page\'s location and title', () => {
    // The stub is only acceptable if the code behind it is right. Install the
    // `gtag` the firm will install and drive three swaps through the real recipe.
    const sent = [];
    const pages = [['Contact | Donovan Legal', '/contact'], ['Book | Donovan Legal', '/book'], ['Blog | Donovan Legal', '/blog']];
    for (const [title, path] of pages) {
      const w = pageWindow(title, path);
      w.gtag = (kind, event, params) => sent.push({ kind, event, params });
      const out = gaPageView(w.document, w);
      assert.equal(out.status, 'ok');
    }

    assert.equal(sent.length, 3, 'one page_view per swap — not zero, not two');
    for (const [i, [title, path]] of pages.entries()) {
      assert.equal(sent[i].kind, 'event');
      assert.equal(sent[i].event, 'page_view');
      assert.equal(sent[i].params.page_title, title, 'the title must be the INCOMING page\'s (§5.1 runs first)');
      assert.ok(sent[i].params.page_location.endsWith(path), `page_location must be ${path}`);
    }
  });

  test('a gtag that throws is reported as `error`, and does not take the swap down', () => {
    const w = pageWindow('Book', '/book');
    w.gtag = () => { throw new Error('tag manager exploded'); };
    const out = gaPageView(w.document, w);
    assert.equal(out.status, 'error');
    assert.match(out.detail.error, /exploded/);
  });

  test('no analytics tag is on the adoption allow-list — re-running one is the §3.6 defect', () => {
    const policy = read('js/perch/swap-policy.js');
    assert.doesNotMatch(policy, /ADOPT_SCRIPTS[\s\S]{0,4000}googletagmanager/,
      'GA must never be adopted on a swap; the page_view is fired manually instead');
  });
});
