// ── JORDAN-SITE-UX-FIXES-R1 · Tasks 2 & 3 — the calendar has two doors ────────
//
// ── THE TWO DEFECTS ──────────────────────────────────────────────────────────
//
// Both of them ended at the same place: an unqualified walk-up on Paul's calendar.
//
//   TASK 2. Tapping BOOK A CONSULTATION opened the intake card, and clicking the
//   dark area outside it dismissed the card AND navigated to /book AND wrote the
//   30-minute `donovan_booking_unlock`. Clicking outside a modal is the single most
//   common way anyone closes one they did not mean to open, and it was the whole
//   bypass — the qualifier the CTA exists to put in front of the calendar was
//   skipped by the gesture that means "not this".
//
//   TASK 3. `/book` answered a bare visit with a placeholder that told the visitor
//   to go and find Paula's launcher somewhere else on the page, and `?unlock=dev`
//   opened the calendar outright — on www.donovan.law, to anyone who typed it.
//
// ── THE CONTRACT THIS FILE HOLDS ─────────────────────────────────────────────
//
// There are exactly two ways to reach the booking calendar:
//
//   1. COMPLETE the qualifier.
//   2. DECLINE it explicitly — the labelled control inside the card.
//
// Everything else is a no-op close that leaves the visitor on the page they were
// reading, with nothing written to the tab. §1 drives the three "everything else"
// gestures the order names — overlay click, Esc, Back — through the REAL layer and
// the REAL card. §2 drives the REAL booking gate on a real /book document. §3 is
// the positive arm: a visitor who actually qualifies still gets the calendar, so
// none of the above passes by having simply broken booking
// ([[feedback_zero_request_assertion_needs_a_positive_arm]]).
//
// ── WHY A ROUTER IS REGISTERED ───────────────────────────────────────────────
//
// With no router `host.go` is a `location.assign`, which jsdom refuses and logs as
// "Not implemented" — unreadable, so a no-navigation claim would have to be argued
// from a side effect. Registering a router (exactly what js/perch-swup-router.js
// does at boot, minus Swup) makes every navigation the layer asks for an entry in
// an array, so "did not navigate to the calendar" is a direct reading rather than
// an inference. The unlock write is asserted alongside it, because a navigation
// that did not happen and a gate that was left open are two different failures.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

import { BOOK_INTENT_ATTR, BOOK_INTENT_SOURCE, BOOKING_HREF } from '../donovan-legal-site/functions/_lib/utility-bar-inject.js';
import { CONTAINER_ID, LAYER_ID } from '../donovan-legal-site/js/perch/placement.js';
import { BOOK_PATH, isBookTarget } from '../donovan-legal-site/js/perch/command-channel.js';
import * as surface from '../donovan-legal-site/js/perch/surface.js';
import { muteConsole } from './helpers/stubs.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..', 'donovan-legal-site');
const UNLOCK_KEY = 'donovan_booking_unlock';

/** Shipped source with CRLF normalised — see the note in perch-novoice-frontdoor. */
const read = (p) => fs.readFileSync(path.join(SITE, p), 'utf8').replace(/\r\n/g, '\n');

/** Run the REAL js/perch-layer.js. Same harness the other layer suites use. */
async function loadLayer(tag) {
  const src = read(path.join('js', 'perch-layer.js'))
    .replace(/(['"])\/js\//g, '$1../donovan-legal-site/js/');
  const file = path.join(HERE, `.guard-layer-harness-${process.pid}.mjs`);
  fs.writeFileSync(file, src);
  try {
    return await import('./' + path.basename(file) + '?guard=' + tag);
  } finally {
    fs.unlinkSync(file);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Harness — a content page carrying the booking CTA
// ─────────────────────────────────────────────────────────────────────────────

const navigated = [];
let env = null;
let layer = null;

function browserGlobals(url = 'https://www.donovan.law/contact') {
  const dom = new JSDOM(
    `<!doctype html><html lang="en"><body><main id="${CONTAINER_ID}">`
    + `<a id="cta" class="dl-ubar-cta" href="${BOOKING_HREF}" target="_top" `
    + `${BOOK_INTENT_ATTR}="${BOOK_INTENT_SOURCE}">Book a Consultation</a>`
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
  win.scrollTo = () => {};
  win.HTMLElement.prototype.scrollIntoView = () => {};

  const saved = {};
  const globals = {
    window: win, document: win.document, location: win.location,
    CustomEvent: win.CustomEvent, fetch: win.fetch,
    sessionStorage: win.sessionStorage, localStorage: win.localStorage,
    crypto: win.crypto || crypto,
    setInterval: win.setInterval.bind(win),
    clearInterval: win.clearInterval.bind(win),
  };
  for (const [k, v] of Object.entries(globals)) {
    saved[k] = Object.getOwnPropertyDescriptor(globalThis, k);
    Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
  }
  return {
    win, prefilled,
    restore() {
      for (const [k, d] of Object.entries(saved)) {
        if (d) Object.defineProperty(globalThis, k, d);
        else delete globalThis[k];
      }
      dom.window.close();
    },
  };
}

const clickCta = (win) => {
  const ev = new win.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  win.document.getElementById('cta').dispatchEvent(ev);
  return ev;
};

/** Tap every step through to the done state. Select step first — see the note in
 *  perch-novoice-frontdoor.test.mjs for why an option-first loop stalls. */
function tapThrough(win) {
  const qual = win.document.getElementById('qual');
  for (let guard = 0; guard < 20; guard++) {
    if (qual.classList.contains('done-state') || qual.classList.contains('handoff-state')) return true;
    const body = qual.querySelector('#qual-bd');
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

/** Open the card from the CTA and answer one question, so there is partial intake
 *  in the card to be lost or carried. Returns the card element. */
function openAndAnswerOne(win) {
  const ev = clickCta(win);
  assert.equal(ev.defaultPrevented, true,
    'the CTA opened the card instead of following its href — precondition of every test here');
  const qual = win.document.getElementById('qual');
  assert.equal(qual.classList.contains('show'), true, 'the card is open');
  const opt = qual.querySelector('#qual-bd button.opt[data-v]');
  if (opt) opt.click();
  return qual;
}

/** Clear everything a previous gesture may have written, so each test starts from
 *  a tab that has made no booking decision at all. */
function resetTab(win) {
  win.localStorage.clear();
  win.sessionStorage.clear();
  navigated.length = 0;
}

before(async () => {
  env = browserGlobals();
  const r = surface.registerRouter((href) => navigated.push(href));
  assert.equal(r.ok, true, 'precondition: this file must be the first registrant in its process');
  layer = await loadLayer('guard');
  layer.mount();
});

after(() => {
  if (layer) layer.releaseCall();
  if (env) env.restore();
});

// ─────────────────────────────────────────────────────────────────────────────
// §1 · Task 2 — the three gestures that are not a decision
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 — dismissing the intake card never reaches the calendar', () => {
  /**
   * The whole of Task 2's verification, applied to one gesture.
   *
   * Four readings, and they fail differently on purpose: the card must close (or
   * the gesture did nothing at all and the rest is vacuous), no navigation may name
   * the calendar, the unlock must stay unwritten (a navigation that did not happen
   * still leaves /book open for half an hour if the flag was set), and the qualifier
   * must still be there to be answered — a dismiss that broke the card would satisfy
   * the first three and be a worse defect than the one this replaces.
   */
  function assertDismissedInPlace(win, qual, gesture) {
    assert.equal(qual.classList.contains('show'), false, `${gesture}: the card did not close`);

    const toCalendar = navigated.filter((h) => isBookTarget(String(h)));
    assert.deepEqual(toCalendar, [],
      `${gesture}: the visitor was navigated to the booking calendar (${JSON.stringify(navigated)}). `
      + 'Closing a modal is not a request to go anywhere.');

    assert.equal(win.localStorage.getItem(UNLOCK_KEY), null,
      `${gesture}: the booking gate was unlocked, so /book would show the calendar to a `
      + 'visitor who answered nothing — the bypass, moved rather than closed.');

    const probe = win.Perch.layer.probe().noVoice;
    assert.equal(probe.declines, 0, `${gesture}: the host recorded this as an explicit decline`);

    // The qualifier is not bypassed: it is still the thing standing in front of the
    // calendar, and it re-opens.
    const ev = clickCta(win);
    assert.equal(ev.defaultPrevented, true, `${gesture}: the card no longer opens from the CTA`);
    assert.equal(win.document.getElementById('qual').classList.contains('show'), true,
      `${gesture}: dismissing the card left it unopenable — a one-way door`);
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  }

  test('neither an OVERLAY click nor a close button exists as a way out (2026-09-05); Esc does, in place', () => {
    // Was 'an OVERLAY click closes the card and goes nowhere', then briefly a
    // header ×. Both were ways to leave the booking protocol without answering,
    // and Paul removed them. The backdrop is inert, there is no close control,
    // and Esc remains the keyboard dismiss whose guarantees this suite asserts.
    const win = env.win;
    resetTab(win);
    const qual = openAndAnswerOne(win);
    // The dark area outside the card: the event target is the backdrop itself.
    qual.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    assert.equal(qual.classList.contains('show'), true,
      'a backdrop click closed the card -- the 2026-09-04 change regressed');
    assert.equal(qual.querySelector('.hd [data-close-x]'), null,
      'a close control is painted in the header -- the 2026-09-05 removal regressed');
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assertDismissedInPlace(win, qual, 'Esc');
  });

  test('a click INSIDE the card is not a dismiss (control)', () => {
    // Without this the overlay test would pass for a card that closes on any click
    // anywhere, which would be a different bug with the same symptom.
    const win = env.win;
    resetTab(win);
    const qual = openAndAnswerOne(win);
    const card = qual.querySelector('.card');
    assert.ok(card, 'the card body exists to be clicked');
    card.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    assert.equal(qual.classList.contains('show'), true,
      'clicking the card itself closed it — the backdrop test proves nothing');
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  test('ESC closes the card and goes nowhere', () => {
    const win = env.win;
    resetTab(win);
    const qual = openAndAnswerOne(win);
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    assertDismissedInPlace(win, qual, 'Esc');
  });

  test('another key is not a dismiss (control)', () => {
    const win = env.win;
    resetTab(win);
    const qual = openAndAnswerOne(win);
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'a', bubbles: true }));
    assert.equal(qual.classList.contains('show'), true,
      'any keypress closes the card — the Esc test proves nothing');
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  test('the BACK button closes the card and goes nowhere', () => {
    const win = env.win;
    resetTab(win);
    const qual = openAndAnswerOne(win);
    // The layer holds the card OUTSIDE the swap container so a navigation cannot
    // tear it down mid-answer, which is exactly why a soft Back has to be answered
    // here: nothing else would take it off the screen.
    win.dispatchEvent(new win.PopStateEvent('popstate', { state: null }));
    assertDismissedInPlace(win, qual, 'Back');
  });

  test('none of the three stashed a prefill for a later /book visit', () => {
    // The abandon path used to park the tapped answers in sessionStorage for the
    // document it was about to load. Nothing navigates now, so a stash left behind
    // would surface on some unrelated later visit to the calendar.
    const win = env.win;
    const keys = [];
    for (let i = 0; i < win.sessionStorage.length; i++) keys.push(win.sessionStorage.key(i));
    assert.deepEqual(keys.filter((k) => /prefill/i.test(String(k))), []);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · Task 3 — /book is not a public entry to the calendar
// ─────────────────────────────────────────────────────────────────────────────

describe('§2 — a direct /book visit does not reach the calendar', () => {
  const dlInitSrc = read(path.join('js', 'dl-init.js'));
  const gateSrc = read(path.join('js', 'page', 'booking-gate.js'));

  /** The two states of the real page, with the ids the gate drives. */
  const BOOK_BODY = '<div class="book-widget" id="book-gate">a quick step first</div>'
    + '<div class="book-widget" id="book-live" style="display:none;"><div id="dl-booking"></div></div>';

  /**
   * A real /book document running the REAL gate.
   *
   * `runScripts: 'outside-only'` + `eval` is how test/swap-container.test.mjs drives
   * this same file; the gate is the shipped source, not a re-statement of it.
   */
  function bookDocument(url, { unlock = null, layerPresent = false } = {}) {
    const dom = new JSDOM(
      `<!doctype html><html><head></head><body>${layerPresent ? `<div id="${LAYER_ID}"></div>` : ''}`
      + `${BOOK_BODY}</body></html>`,
      { url, runScripts: 'outside-only' },
    );
    dom.window.HTMLElement.prototype.scrollIntoView = () => {};
    if (unlock !== null) dom.window.localStorage.setItem(UNLOCK_KEY, String(unlock));
    dom.window.eval(dlInitSrc);
    dom.window.eval(gateSrc);
    return dom;
  }

  const ready = (dom) => new Promise((resolve) => {
    dom.window.document.addEventListener('DOMContentLoaded', () => setTimeout(resolve, 0));
    setTimeout(resolve, 30);
  });

  const shown = (dom, id) => dom.window.document.getElementById(id).style.display;

  test('a bare /book visit leaves the calendar hidden and the placeholder up', async () => {
    const dom = bookDocument('https://www.donovan.law/book');
    await ready(dom);
    assert.notEqual(shown(dom, 'book-live'), 'block',
      'the booking widget is visible to a visitor who has not qualified');
    assert.notEqual(shown(dom, 'book-gate'), 'none',
      'and the pre-qualification placeholder was hidden');
    dom.window.close();
  });

  test('?unlock=dev cannot open it on the production host', async () => {
    // The address was the whole exploit: no bug, just a query string anyone can
    // type on the live site.
    for (const host of ['https://www.donovan.law', 'https://donovan.law']) {
      const dom = bookDocument(`${host}/book?unlock=dev`);
      await ready(dom);
      assert.notEqual(shown(dom, 'book-live'), 'block', `${host}: the dev bypass still works in production`);
      dom.window.close();
    }
  });

  test('the dev bypass is kept where it is for — loopback and Preview', async () => {
    // A guard that simply deleted the affordance would also pass the test above and
    // would take the widget away from every Preview review of this page.
    for (const host of ['http://localhost:8788', 'http://127.0.0.1:8788', 'https://donovan-site.pages.dev']) {
      const dom = bookDocument(`${host}/book?unlock=dev`);
      await ready(dom);
      assert.equal(shown(dom, 'book-live'), 'block', `${host}: the dev affordance was lost`);
      dom.window.close();
    }
  });

  test('the host predicate answers the two populations directly', () => {
    const dom = bookDocument('https://www.donovan.law/book');
    const isDev = dom.window.DL.isBookingDevHost;
    assert.equal(typeof isDev, 'function');
    for (const h of ['localhost', '127.0.0.1', 'donovan-site.pages.dev', 'abc123.donovan-site.pages.dev']) {
      assert.equal(isDev(h), true, `${h} should be a dev host`);
    }
    for (const h of ['www.donovan.law', 'donovan.law', '', 'notpages.dev', 'pages.dev.evil.com']) {
      assert.equal(isDev(h), false, `${h} must not be a dev host`);
    }
    dom.window.close();
  });

  test('an expired unlock is not a qualification', async () => {
    const dom = bookDocument('https://www.donovan.law/book', { unlock: Date.now() - 31 * 60 * 1000 });
    await ready(dom);
    assert.notEqual(shown(dom, 'book-live'), 'block');
    dom.window.close();
  });

  // ── The other half of Task 3, and how it is made observable ────────────────
  //
  // The page used to answer an unqualified arrival with a paragraph telling the
  // visitor to go and find Paula's launcher somewhere else on the screen. It now
  // opens the intake card itself. The URL must NOT move while it does — a redirect
  // would take the widget host out from under the modal and voice flows that
  // soft-swap INTO this page and reveal it in place.
  //
  // The reach for the layer is a dynamic `import()`, which jsdom's `outside-only`
  // window cannot perform and which a caller could not observe even if it could. So
  // the wire is proved from BOTH ENDS rather than asserted in the middle: the gate's
  // own verdict says it decided to offer (and says why when it declines), and the
  // layer module it names really does export a function that raises the card. A
  // test that only watched for "nothing happened" would pass identically against a
  // guard that was never wired at all.

  test('a bare /book visit DECIDES to open the qualifier', async () => {
    const quiet = muteConsole();
    try {
      const dom = bookDocument('https://www.donovan.law/book', { layerPresent: true });
      await ready(dom);
      const verdict = dom.window.DL.revealBookingGate();
      assert.equal(verdict.revealed, false, 'the calendar stayed shut');
      // The first call — from DL.ready at load — is the one that offered; this
      // second reading is the once-per-document latch answering, which is itself
      // the proof that the first one fired.
      assert.equal(verdict.intake.reason, 'already_offered',
        'the gate never offered the qualifier on the load that preceded this call '
        + `(it said: ${JSON.stringify(verdict.intake)})`);
      assert.equal(dom.window.location.pathname, '/book',
        'the guard must not move the URL — the widget host has to stay under the modal '
        + 'and voice flows that swap into this page');
      dom.window.close();
    } finally {
      quiet.restore();
    }
  });

  test('and the module it reaches for really does raise the card', async () => {
    // The far end of the same wire, driven for effect on the layer this file
    // already mounted. `book_direct` is the source label the gate passes.
    const win = env.win;
    resetTab(win);
    assert.equal(typeof layer.openBookingQualifier, 'function',
      'js/perch-layer.js no longer exports the function the booking gate imports by name');
    assert.equal(layer.openBookingQualifier('book_direct'), true);
    const qual = win.document.getElementById('qual');
    assert.equal(qual.classList.contains('show'), true,
      'the export resolved but raised nothing — the gate would offer into a void');
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    resetTab(win);
  });

  test('it declines to offer when there is no layer to offer into', async () => {
    // Same check js/consent-gate.js makes first, for the same reason: evaluating the
    // layer module in a document that has none runs its boot for nothing.
    const dom = bookDocument('https://www.donovan.law/book');
    await ready(dom);
    const verdict = dom.window.DL.revealBookingGate();
    assert.equal(verdict.intake.reason, 'no_layer');
    dom.window.close();
  });

  test('the guard is scoped to the booking page and is silent everywhere else', async () => {
    // `DL.ready` re-runs the gate on every content swap, so it runs on pages that
    // have no #book-gate at all. That has to be a silent no-op, not a throw and not
    // an intake card raised over the contact page.
    const dom = new JSDOM(
      `<!doctype html><html><head></head><body><div id="${LAYER_ID}"></div><p>contact</p></body></html>`,
      { url: 'https://www.donovan.law/contact', runScripts: 'outside-only' },
    );
    dom.window.eval(dlInitSrc);
    assert.doesNotThrow(() => dom.window.eval(gateSrc));
    await ready(dom);
    const verdict = dom.window.DL.revealBookingGate();
    assert.equal(verdict.intake.reason, 'not_book_page',
      'the gate treated a page with no booking widget as a booking page');
    assert.equal(dom.window.document.getElementById('qual'), null,
      'the gate raised an intake card on a page that is not the booking page');
    dom.window.close();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · The positive arm — qualifying, and declining, still book
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 — the two real doors to the calendar still open', () => {
  test('a COMPLETED qualifier reaches the booking calendar', () => {
    const win = env.win;
    resetTab(win);
    clickCta(win);
    assert.equal(tapThrough(win), true, 'the card reached its done state');

    const toCalendar = navigated.filter((h) => isBookTarget(String(h)));
    assert.ok(toCalendar.length > 0,
      'a visitor who answered every question was not taken to the calendar — '
      + `the guard broke booking (navigations seen: ${JSON.stringify(navigated)})`);
    assert.equal(toCalendar[0], BOOK_PATH, 'and to the same path goto_booking uses');
    assert.ok(win.localStorage.getItem(UNLOCK_KEY),
      'and the gate is unlocked, so the calendar is revealed when they land');
  });

  test('the only alternative to the questions is the PHONE — never the calendar, and no longer the contact form', () => {
    // 2026-09-02 closed the decline route onto the calendar; 2026-09-04 (Paul)
    // closed the contact-form route too. The control is a tel: link. Pressing it records a decline and navigates nowhere; the card
    // stays open with the number in front of the visitor. No unlock is written;
    // a completed card is the only key to /book.
    const win = env.win;
    resetTab(win);
    const qual = openAndAnswerOne(win);

    const decline = qual.querySelector('#qual-bd [data-decline]');
    assert.ok(decline, 'the card paints an explicit control for leaving the questions');
    assert.ok(decline.textContent.trim().length > 0,
      'and it is labelled — a decline nobody can read is not an explicit one');
    assert.match(decline.textContent, /call/i, 'and the label says the alternative is to call');
    assert.match(decline.textContent, /666-6022/, 'with the number in the label');
    assert.equal(decline.tagName, 'A', 'the control is a link, not a button that navigates');
    assert.match(decline.getAttribute('href') || '', /^tel:\+15616666022$/, "to the firm's number");
    // (the tel: frame escape is js/main.js's capture-phase sweep, not an attribute here)
    decline.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));

    assert.equal(navigated.filter((h) => isBookTarget(String(h))).length, 0,
      `the decline reached the calendar (${JSON.stringify(navigated)}) — the protocol hole is open again`);
    assert.equal(navigated.filter((h) => /\/contact/.test(String(h))).length, 0,
      `the decline went to the contact page (${JSON.stringify(navigated)}) — the 2026-09-04 change regressed`);
    assert.equal(win.localStorage.getItem(UNLOCK_KEY), null, 'and no booking unlock was written');
    assert.equal(win.Perch.layer.probe().noVoice.declines > 0, true, 'the decline was counted');
    assert.equal(qual.classList.contains('show'), true, 'the card stays open with the number in view');
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  test('the decline control is on every step, not only the first', () => {
    // A visitor three questions in who decides they would rather just book must have
    // the same way out as one who never started, or the dismiss gesture becomes the
    // only exit again and the defect returns by the back door.
    const win = env.win;
    resetTab(win);
    const qual = openAndAnswerOne(win);
    for (let i = 0; i < 3; i++) {
      assert.ok(qual.querySelector('#qual-bd [data-decline]'),
        `step ${i + 1} of the card offers no explicit decline`);
      const body = qual.querySelector('#qual-bd');
      const sel = body.querySelector('#q-sel');
      if (sel) { sel.value = 'FL'; body.querySelector('#q-cont').click(); continue; }
      const opt = body.querySelector('button.opt[data-v]');
      if (!opt) break;
      opt.click();
    }
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  test('the decline does not answer the question it sits under', () => {
    // The control lives inside the card body, where `renderStep` binds `pick()` to
    // every `.opt`. If it ever acquires that class it becomes an answer — a silent
    // one, recorded against whichever step the visitor happened to be on.
    const win = env.win;
    resetTab(win);
    const qual = openAndAnswerOne(win);
    const decline = qual.querySelector('#qual-bd [data-decline]');
    assert.equal(decline.classList.contains('opt'), false);
    assert.equal(decline.hasAttribute('data-v'), false);
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §4 · The control is not offered where it cannot be honoured
// ─────────────────────────────────────────────────────────────────────────────

describe('§4 — a host that cannot honour a decline is not shown one', () => {
  test('mountQualifier paints no decline control without an onDeclined host', async () => {
    // js/page/perch-shell.js — the /perch rollback target — mounts the card with
    // `{ callId }` and nothing else. A decline control there would close the card
    // and go nowhere: a button reading "go straight to the calendar" that does not.
    // Better no way out painted than a painted way out that lies.
    const quiet = muteConsole();
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
      { url: 'https://www.donovan.law/perch' });
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'location');
    try {
      Object.defineProperty(globalThis, 'location', {
        value: dom.window.location, configurable: true, writable: true,
      });
      const { mountQualifier } = await import('../donovan-legal-site/js/perch/qualifier.js?shell=1');
      const q = mountQualifier(dom.window.document.body, { callId: () => null });
      q.openQualifier('en', 'shell');
      assert.equal(q.root.classList.contains('show'), true, 'the card opened');
      assert.equal(q.root.querySelector('#qual-bd [data-decline]'), null,
        'the shell was offered a decline its host cannot act on');
    } finally {
      if (saved) Object.defineProperty(globalThis, 'location', saved);
      dom.window.close();
      quiet.restore();
    }
  });

  test('and it IS painted for the layer, which can (control)', () => {
    // Without this pair the test above would pass against a card that never paints
    // the control at all, which is the defect it is supposed to be scoping.
    const win = env.win;
    resetTab(win);
    const qual = openAndAnswerOne(win);
    assert.ok(qual.querySelector('#qual-bd [data-decline]'),
      'the layer passes onDeclined and must be offered the control');
    win.document.dispatchEvent(new win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });

  /**
   * The render gate, at the level it lives.
   *
   * Driven on the qualifier module directly rather than through the layer, because
   * the second condition is about a card PAULA raised on a live call — and building
   * a WebRTC session in jsdom to observe a missing button would test the harness.
   * The layer's own answer to the same question is asserted for effect by §3 and by
   * the control above: it opens the card from the CTA, `bookIntentOpen` is true, and
   * the control is there.
   */
  async function cardWith(ctx) {
    const dom = new JSDOM('<!doctype html><html><body></body></html>',
      { url: 'https://www.donovan.law/contact' });
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'location');
    Object.defineProperty(globalThis, 'location', {
      value: dom.window.location, configurable: true, writable: true,
    });
    try {
      const mod = await import('../donovan-legal-site/js/perch/qualifier.js?gate=' + Math.random());
      const q = mod.mountQualifier(dom.window.document.body, { callId: () => null, ...ctx });
      q.openQualifier('en', 'probe');
      return { present: !!q.root.querySelector('#qual-bd [data-decline]'), dom, saved };
    } finally {
      if (saved) Object.defineProperty(globalThis, 'location', saved);
    }
  }

  test('a host that refuses to act right now is not offered the control either', async () => {
    const quiet = muteConsole();
    try {
      const off = await cardWith({ onDeclined: () => {}, canDecline: () => false });
      assert.equal(off.present, false,
        'the card offered a decline while the host was refusing to honour one — '
        + 'on a live call that is a button promising the calendar and delivering a close');
      off.dom.window.close();

      // CONTROL: the same card, same host, one boolean apart.
      const on = await cardWith({ onDeclined: () => {}, canDecline: () => true });
      assert.equal(on.present, true, 'the gate never paints the control at all');
      on.dom.window.close();
    } finally {
      quiet.restore();
    }
  });
});
