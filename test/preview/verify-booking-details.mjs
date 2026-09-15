// ── JORDAN-BOOKING-WIDGET-DETAILS-R1 — the details-step verifier ─────────────
//
// Order JORDAN-BOOKING-WIDGET-DETAILS-R1.
//
//   node test/preview/verify-booking-details.mjs [--label before|after] [baseUrl]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and the evidence file it writes.
//
// ── THE SYMPTOM THIS MEASURES ────────────────────────────────────────────────
// On a voice-assisted booking the caller could not reach the details or
// confirmation screen and had to re-select the time slot; the call was marked
// Unsuccessful. The claim under test is narrow and mechanical:
//
//   after ONE valid slot selection, is the details step rendered, and is it
//   actually ON SCREEN — without a re-pick?
//
// Both halves are measured, because they fail independently. "Rendered" is a DOM
// question (`#dl-bk-form` exists, `step === 'FORM'`). "On screen" is a geometry
// question, and it is the half a DOM-only assertion passes vacuously: a control
// that exists 900 px below the fold on a 667 px-tall phone is present, focusable,
// enumerable — and invisible to the person holding the phone. Every viewport
// below therefore reports BOTH.
//
// ── WHAT IS REAL HERE, AND WHAT IS NOT ───────────────────────────────────────
//   REAL
//     • the shipped donovan-legal-site/book.html, served from disk over http,
//       including its real #book-gate / #book-live markup and the real
//       js/booking-widget.js booted by its own <script defer>;
//     • the real state machine, the real renderers, the real click handlers —
//       nothing is stubbed inside the widget;
//     • a real Chromium at real phone and desktop viewports, with real layout,
//       real scrolling and real element geometry.
//
//   NOT REAL, and deliberately so
//     • /booking/types and /booking/availability are fulfilled locally with a
//       fixed two-day, three-slot fixture, so the run is deterministic and does
//       not depend on Paul's live calendar having openings;
//     • /booking/create is fulfilled locally with a 201. NO WRITE LEAVES THIS
//       PROCESS. The verifier asserts the request body it WOULD have sent, which
//       is how the "POST contract unchanged" claim is checked without booking a
//       real consultation on a live attorney's calendar.
//
// The gate is opened with the shipped `?unlock=dev` affordance
// (js/page/booking-gate.js:49), not by reaching past it.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { chromium } from 'playwright';

const SITE_DIR = fileURLToPath(new URL('../../donovan-legal-site/', import.meta.url));
const SHOT_DIR = fileURLToPath(new URL('./screenshots/', import.meta.url));
const EVIDENCE = fileURLToPath(new URL('./booking-details-evidence.json', import.meta.url));

const argv = process.argv.slice(2);
const labelIdx = argv.indexOf('--label');
const LABEL = labelIdx >= 0 ? argv[labelIdx + 1] : 'after';

if (!existsSync(SHOT_DIR)) mkdirSync(SHOT_DIR, { recursive: true });

// ── Availability fixture ─────────────────────────────────────────────────────
// Two days with three slots each — enough that the date strip and the slot grid
// both have real content, which is what pushes a bottom-anchored control down.
const DAY = 24 * 60 * 60 * 1000;
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
const SLOTS = buildSlots();
const TYPES = { types: [{ id: 'consult', name: 'Initial Consultation', duration_min: 30 }] };

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};

/** Serve the real site directory. Nothing is rewritten on the way out. */
function startServer() {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let rel = decodeURIComponent(url.pathname);
    if (rel === '/' || rel === '/book') rel = '/book.html';
    const file = path.join(SITE_DIR, rel.replace(/^\/+/, ''));
    if (!file.startsWith(SITE_DIR)) { res.writeHead(403).end(); return; }
    try {
      const buf = await readFile(file);
      res.writeHead(200, { 'content-type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(buf);
    } catch { res.writeHead(404, { 'content-type': 'text/plain' }).end('not found'); }
  });
  return new Promise((r) => server.listen(0, '127.0.0.1', () => r(server)));
}

const VIEWPORTS = [
  { name: 'desktop', width: 1280, height: 900, isMobile: false },
  { name: 'mobile-390', width: 390, height: 844, isMobile: true },  // iPhone 12/13/14
  { name: 'mobile-360', width: 360, height: 640, isMobile: true },  // common Android
  { name: 'mobile-320', width: 320, height: 568, isMobile: true },  // iPhone SE (1st gen)
];

/**
 * Geometry of an element relative to the visual viewport.
 *
 * A REAL function, not a string. Playwright hands a string to the page as an
 * expression; an arrow-function source text therefore evaluates to a Function,
 * which is not serialisable, and `page.evaluate` resolves to `undefined` for
 * EVERY call — element present or absent alike. That failure mode is the
 * dangerous kind: `undefined` is falsy, so an "is it on screen?" assertion built
 * on it reports FAIL for a widget that is perfectly visible, and would keep
 * reporting FAIL after a correct fix. The first draft of this file had exactly
 * that bug. Keep this a function.
 */
function geom(sel) {
  const el = document.querySelector(sel);
  if (!el) return { present: false };
  const r = el.getBoundingClientRect();
  const cs = getComputedStyle(el);

  // Walk the ANCESTOR chain, not just this element.
  //
  // book.html wraps the booking widget in
  // `div.animate__animated.animate__fadeIn.animate__delay-2s`, which sits at
  // `opacity: 0` for the first two seconds after load — the whole widget is
  // invisible to the caller during it. `opacity` does NOT inherit, so reading
  // only `getComputedStyle(el).opacity` returns "1" for an element nobody can
  // see, and an "is it on screen?" assertion built on that passes vacuously
  // against a blank screen. `display:none` and `visibility:hidden` on an
  // ancestor hide a descendant the same way. So the paint question is asked of
  // the whole chain and the culprit is named.
  let hiddenBy = null;
  for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
    const s = getComputedStyle(n);
    if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) {
      hiddenBy = {
        tag: n.tagName, id: n.id || null,
        cls: (n.className || '').toString().slice(0, 80),
        display: s.display, visibility: s.visibility, opacity: s.opacity,
      };
      break;
    }
  }

  return {
    present: true,
    top: Math.round(r.top), bottom: Math.round(r.bottom),
    height: Math.round(r.height), width: Math.round(r.width),
    display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
    hiddenBy,
    // "In the viewport" = the box intersects the visible area AND nothing in the
    // chain paints it away.
    inViewport: r.height > 0 && r.width > 0 && r.bottom > 0 && r.top < window.innerHeight
                && hiddenBy === null,
    viewportH: window.innerHeight,
    // How far the caller would have to scroll to bring it into view. 0 when visible.
    scrollNeededPx: r.top >= window.innerHeight ? Math.round(r.top - window.innerHeight + r.height) : 0,
  };
}

/**
 * Wait until the widget is genuinely painted — the `animate__delay-2s` fade-in
 * above has finished and no ancestor is still holding it at opacity 0.
 *
 * Without this the walkthrough races a reveal animation that belongs to the
 * page, and the run is timing-dependent: the same code screenshots a fully
 * rendered calendar or a blank cream rectangle depending on how long the
 * preceding assertions happened to take. That is page chrome, not the widget's
 * behaviour, and not something this order changes — so it is waited out, not
 * edited away.
 */
async function waitForWidgetPainted(page, timeoutMs = 12000) {
  const t0 = Date.now();
  await page.waitForFunction(() => {
    const el = document.querySelector('#dl-booking');
    if (!el) return false;
    for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.display === 'none' || s.visibility === 'hidden' || parseFloat(s.opacity) === 0) return false;
    }
    return el.getBoundingClientRect().height > 0;
  }, null, { timeout: timeoutMs });
  return Date.now() - t0;
}

async function runViewport(browser, base, vp) {
  const ctx = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    deviceScaleFactor: 1,
  });
  const page = await ctx.newPage();

  // Block every off-box request. Registered FIRST on purpose: Playwright gives
  // priority to the LAST matching route, so the specific handlers below win for
  // the URLs they name and this one catches the rest. (Registered last, this
  // pattern swallows the booking stubs and the widget never loads a slot.)
  //
  // book.html pulls Open Sans from fonts.googleapis.com. Letting that request
  // out makes the run depend on the network for its rendering, and a pending
  // webfont means Chromium paints no text at all for up to three seconds — the
  // screenshots come back blank for reasons that have nothing to do with the
  // widget. Blocked, the fallback stack renders immediately.
  await page.route('**/*', (route) => (
    route.request().url().startsWith(base) ? route.continue() : route.abort()
  ));

  // Booking API — fulfilled in-process. No request reaches any real harness.
  const createBodies = [];
  const createHeaders = [];
  await page.route('**/booking/**', async (route) => {
    const u = route.request().url();
    if (u.includes('/booking/types')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TYPES) });
    }
    if (u.includes('/booking/availability')) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ slots: SLOTS }) });
    }
    if (u.includes('/booking/create')) {
      createBodies.push(route.request().postDataJSON());
      createHeaders.push(route.request().headers());
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ ok: true, confirmed: true, appointment_id: 'verify-local-only' }),
      });
    }
    return route.continue();
  });
  // Turnstile's script is third-party; block it so the run is hermetic. The
  // widget's mountTurnstile then simply never finds window.turnstile, which is
  // the documented "token empty" path — it changes nothing about step advance.
  await page.route('**/challenges.cloudflare.com/**', (r) => r.abort());

  const steps = [];
  /**
   * Walkthrough capture, CLIPPED TO THE WIDGET (`#book-live`).
   *
   * Not a viewport screenshot. book.html carries a sticky "Click here to call"
   * bar and the gate's own smooth reveal-scroll, and a plain viewport shot
   * intermittently catches the page parked on the footer — an image that says
   * nothing about the widget's state and reads as if the widget had vanished.
   * Clipping to the element makes every frame legible and comparable across the
   * before/after runs and across four viewport widths.
   *
   * This is a DOCUMENTATION capture and is deliberately NOT the evidence for
   * "the details step is on screen". That claim is carried by geom()'s
   * `inViewport` / `scrollNeededPx`, measured against the real visual viewport
   * with no scrolling of our own — a clipped image could never establish it.
   * The scroll position at capture time is recorded alongside so the two can be
   * read together.
   */
  const shot = async (name) => {
    const f = path.join(SHOT_DIR, `bkdetails-${LABEL}-${vp.name}-${name}.png`);
    const el = await page.$('#book-live');
    if (el) await el.screenshot({ path: f });
    else await page.screenshot({ path: f });
    return path.basename(f);
  };
  const scrollNow = () => page.evaluate(() => Math.round(window.scrollY));

  await page.goto(`${base}/book.html?unlock=dev`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#dl-booking .dl-bk-date-btn', { timeout: 15000 });
  // The page's own 2 s fade-in must finish before anything is measured or shot.
  const paintWaitMs = await waitForWidgetPainted(page);
  // The gate's reveal scroll (js/page/booking-gate.js:67) is `behavior:'smooth'`
  // on a 300 ms timer; let it land, then pin the widget deterministically.
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    document.getElementById('book-live').scrollIntoView({ block: 'start', behavior: 'instant' });
  });
  await page.waitForTimeout(200);

  // ── 1. Open a day (the caller taps a date) ─────────────────────────────────
  await page.locator('#dl-booking .dl-bk-date-btn').first().click();
  await page.waitForSelector('#dl-booking .dl-bk-slot-btn');
  steps.push({ step: 'date-picked', shot: await shot('1-date-picked'), state: await page.evaluate(() => window.DLBooking.getState().step) });

  // ── 2. ONE valid slot selection. No re-pick, no scroll, no second click. ───
  const slotLabel = await page.locator('#dl-booking .dl-bk-slot-btn').nth(1).innerText();
  await page.locator('#dl-booking .dl-bk-slot-btn').nth(1).click();
  await page.waitForTimeout(400); // let any transition/scroll settle

  const afterSlot = {
    stepState: await page.evaluate(() => window.DLBooking.getState().step),
    slotSelected: await page.evaluate(() => !!window.DLBooking.getState().selectedSlot),
    detailsFormPresent: await page.evaluate(() => !!document.querySelector('#dl-bk-form')),
    stepLabelOnScreen: await page.evaluate(() => {
      const el = document.querySelector('#dl-booking .dl-bk-step-label');
      return el ? el.textContent.trim() : null;
    }),
    // The details step's own first field, and the legacy Next control.
    nameField: await page.evaluate(geom, '#dl-bk-name'),
    nextButton: await page.evaluate(geom, '#dl-bk-next'),
    submitButton: await page.evaluate(geom, '#dl-bk-submit'),
    // The details step's HEADER — the "Your details" label and the chosen-slot
    // read-back. Measured separately from the name field because they sit ABOVE
    // it: focusing an input scrolls the INPUT into view, which on a short
    // viewport can push the confirmation of what was booked off the top. A
    // caller who cannot see which slot they picked is being asked to confirm
    // something they cannot read.
    stepHeader: await page.evaluate(geom, '#dl-booking .dl-bk-step-label'),
    slotReadback: await page.evaluate(() => {
      const p = document.querySelector('#dl-bk-form');
      const el = p && p.previousElementSibling;
      if (!el || el.tagName !== 'P') return { present: false };
      const r = el.getBoundingClientRect();
      return {
        present: true, text: el.textContent.trim(), top: Math.round(r.top),
        inViewport: r.height > 0 && r.bottom > 0 && r.top < window.innerHeight,
      };
    }),
    focused: await page.evaluate(() => (document.activeElement && (document.activeElement.id || document.activeElement.className)) || null),
    scrollY: await scrollNow(),
    shot: await shot('2-after-one-slot-click'),
  };

  // The verdict for this viewport, stated as the two independent halves.
  afterSlot.detailsRendered = afterSlot.stepState === 'FORM' && afterSlot.detailsFormPresent;
  afterSlot.detailsOnScreen = !!(afterSlot.nameField && afterSlot.nameField.inViewport);
  afterSlot.rePickRequired = !afterSlot.detailsRendered;

  // ── 3. Mobile scrollability: can the caller reach Confirm by scrolling? ────
  let scrollPass = null;
  if (afterSlot.detailsRendered) {
    await page.evaluate(() => {
      const el = document.querySelector('#dl-bk-submit');
      if (el) el.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(250);
    scrollPass = {
      submitReachable: (await page.evaluate(geom, '#dl-bk-submit'))?.inViewport === true,
      notesReachable: (await page.evaluate(geom, '#dl-bk-notes'))?.inViewport === true,
      // A page that scrolls sideways on a phone is a layout bug in its own right.
      noHorizontalOverflow: await page.evaluate(() =>
        document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1),
      shot: await shot('3-details-scrolled-to-confirm'),
    };
  }

  // ── 4. Happy path: fill and submit, prove the POST body shape ─────────────
  let happy = null;
  if (afterSlot.detailsRendered) {
    await page.fill('#dl-bk-name', 'Jane Verify');
    await page.fill('#dl-bk-email', 'jane@example.com');
    await page.fill('#dl-bk-phone', '(561) 555-0100');
    await page.fill('#dl-bk-notes', 'Real estate closing question');
    await page.click('#dl-bk-submit');
    await page.waitForSelector('#dl-booking .dl-bk-confirm', { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => {
      const el = document.querySelector('.dl-bk-confirm');
      if (el) el.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(250);
    happy = {
      confirmRendered: await page.evaluate(() => !!document.querySelector('#dl-booking .dl-bk-confirm')),
      confirmOnScreen: (await page.evaluate(geom, '#dl-booking .dl-bk-confirm'))?.inViewport === true,
      confirmSlotText: await page.evaluate(() => {
        const el = document.querySelector('.dl-bk-confirm-slot');
        return el ? el.textContent.trim() : null;
      }),
      postCount: createBodies.length,
      postBody: createBodies[0] || null,
      postBodyKeys: createBodies[0] ? Object.keys(createBodies[0]).sort() : [],
      postBodySlot: createBodies[0] ? createBodies[0].slot : null,
      idempotencyKeySent: createHeaders[0] ? !!createHeaders[0]['idempotency-key'] : false,
      shot: await shot('4-confirmed'),
    };
  }

  await ctx.close();
  return { viewport: vp, paintWaitMs, slotLabel: slotLabel.trim(), steps, afterSlot, scrollPass, happy };
}

/**
 * The voice-assisted path, end to end — the scenario this order is about.
 *
 * Paula drives: she sets the live call id, opens a date with `showDate`, then
 * picks the time with `selectSlot({day,time})`. The CALLER fills the form and
 * presses Confirm; nothing here auto-submits, matching the widget's own trust
 * boundary. Two things are asserted that the human-click run cannot see:
 *
 *   • `showDate` is still BROWSE, not commit — it must leave the widget on
 *     DATE_PICK. If the details-step fix had been written into `showDate` or
 *     into `render()` instead of the click handler, this is where that would
 *     show up, and it would be a regression in Paula's ability to say "here's
 *     Thursday" without committing the caller to a time.
 *   • `call_id` and `qualifier_claim` ride on the POST when the page globals are
 *     set. They are absent from a plain web booking because the widget spells
 *     them `(window.__perchCallId || undefined)` and `JSON.stringify` drops an
 *     undefined value — so their absence there is correct, and only a run with
 *     the globals SET can tell "correctly absent" from "silently dropped".
 */
async function runVoicePath(browser, base) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  const createBodies = [];
  await page.route('**/*', (route) => (
    route.request().url().startsWith(base) ? route.continue() : route.abort()
  ));
  await page.route('**/booking/**', async (route) => {
    const u = route.request().url();
    if (u.includes('/booking/types')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TYPES) });
    if (u.includes('/booking/availability')) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ slots: SLOTS }) });
    if (u.includes('/booking/create')) {
      createBodies.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ ok: true, confirmed: true }) });
    }
    return route.continue();
  });
  await page.route('**/challenges.cloudflare.com/**', (r) => r.abort());

  // The shell hands the live call id down before Paula touches the calendar.
  await page.addInitScript(() => {
    window.__perchCallId = 'call_verify_voice_001';
    window.__perchQualifierClaim = 'none';
  });
  await page.goto(`${base}/book.html?unlock=dev`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#dl-booking .dl-bk-date-btn', { timeout: 15000 });
  await waitForWidgetPainted(page);

  // Paula opens a day. Browse only — the widget must NOT advance.
  const dayLabel = await page.evaluate(() => {
    const b = document.querySelector('#dl-booking .dl-bk-date-btn:not(.selected)') || document.querySelector('#dl-booking .dl-bk-date-btn');
    return b ? b.getAttribute('data-key') : null;
  });
  const showDateResult = await page.evaluate((d) => window.DLBooking.showDate(d), dayLabel);
  await page.waitForTimeout(200);
  const afterShowDate = await page.evaluate(() => window.DLBooking.getState().step);

  // Paula picks the time the caller said out loud.
  const spokenTime = await page.evaluate(() => {
    const b = document.querySelectorAll('#dl-booking .dl-bk-slot-btn')[1];
    return b ? b.textContent.trim() : null;
  });
  const selectResult = await page.evaluate(
    (a) => window.DLBooking.selectSlot({ day: a.day, time: a.time }),
    { day: dayLabel, time: spokenTime },
  );
  await page.waitForTimeout(300);
  const afterSelect = await page.evaluate(() => window.DLBooking.getState().step);

  // The caller fills and confirms.
  let confirmed = false;
  if (await page.$('#dl-bk-name')) {
    await page.fill('#dl-bk-name', 'Voice Caller');
    await page.fill('#dl-bk-email', 'voice@example.com');
    await page.fill('#dl-bk-phone', '(561) 555-0123');
    await page.click('#dl-bk-submit');
    await page.waitForSelector('#dl-booking .dl-bk-confirm', { timeout: 10000 }).catch(() => {});
    confirmed = await page.evaluate(() => !!document.querySelector('#dl-booking .dl-bk-confirm'));
  }

  await ctx.close();
  return {
    dayLabel, spokenTime, showDateResult, afterShowDate, selectResult, afterSelect,
    confirmed, body: createBodies[0] || null,
  };
}

// ── Run ──────────────────────────────────────────────────────────────────────
const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch();

const results = [];
for (const vp of VIEWPORTS) {
  try {
    results.push(await runViewport(browser, base, vp));
  } catch (e) {
    results.push({ viewport: vp, error: String(e && e.message || e) });
  }
}
let voice = null;
try { voice = await runVoicePath(browser, base); }
catch (e) { voice = { error: String(e && e.message || e) }; }

await browser.close();
server.close();

// ── Verdict ──────────────────────────────────────────────────────────────────
// The POST /booking/create contract, as the widget has always spelled it.
// Sheldon owns this shape; this order is forbidden to change it, so it is
// asserted in three parts rather than as one flat set:
//
//   REQUIRED — always on the wire, on every booking.
//   OPTIONAL — `(window.__perchCallId || undefined)` and its qualifier twin.
//     `JSON.stringify` DROPS an undefined value, so these are legitimately
//     ABSENT from a plain web booking and legitimately PRESENT on a voice one.
//     A flat "these ten keys" assertion would red a correct web booking; a
//     "required only" assertion would pass a voice booking that had silently
//     stopped sending the call id. Hence both arms, and the voice run below.
//   NOTHING ELSE — an ADDED key is exactly the change this order must not make.
const REQUIRED_KEYS = ['deployment', 'email', 'name', 'notes', 'phone', 'slot', 'turnstile_token', 'type'].sort();
const OPTIONAL_KEYS = ['call_id', 'qualifier_claim'].sort();

/** @returns {{ok: boolean, detail: string}} */
function checkContract(body) {
  if (!body) return { ok: false, detail: 'no POST body captured' };
  const keys = Object.keys(body).sort();
  const missing = REQUIRED_KEYS.filter((k) => !keys.includes(k));
  const extra = keys.filter((k) => !REQUIRED_KEYS.includes(k) && !OPTIONAL_KEYS.includes(k));
  return {
    ok: missing.length === 0 && extra.length === 0,
    detail: `sent=${JSON.stringify(keys)}`
      + (missing.length ? ` MISSING=${JSON.stringify(missing)}` : '')
      + (extra.length ? ` UNEXPECTED=${JSON.stringify(extra)}` : ''),
  };
}

const checks = [];
for (const r of results) {
  if (r.error) { checks.push({ name: `${r.viewport.name}: ran`, pass: false, detail: r.error }); continue; }
  const v = r.viewport.name;
  checks.push({
    name: `${v}: details step RENDERS on the first valid slot selection`,
    pass: r.afterSlot.detailsRendered,
    detail: `step=${r.afterSlot.stepState} form=${r.afterSlot.detailsFormPresent} label=${JSON.stringify(r.afterSlot.stepLabelOnScreen)}`,
  });
  checks.push({
    name: `${v}: details step is ON SCREEN without scrolling`,
    pass: r.afterSlot.detailsOnScreen,
    detail: r.afterSlot.nameField && r.afterSlot.nameField.present
      ? `#dl-bk-name top=${r.afterSlot.nameField.top} viewportH=${r.afterSlot.nameField.viewportH} scrollNeeded=${r.afterSlot.nameField.scrollNeededPx}px inViewport=${r.afterSlot.nameField.inViewport}`
      : '#dl-bk-name absent from the DOM (the details step never rendered)',
  });
  checks.push({
    name: `${v}: NO re-pick required`,
    pass: !r.afterSlot.rePickRequired,
    detail: r.afterSlot.rePickRequired
      ? `after one slot click the widget is still on ${r.afterSlot.stepState}; the only way forward is #dl-bk-next `
        + `(present=${!!(r.afterSlot.nextButton && r.afterSlot.nextButton.present)}, `
        + `inViewport=${r.afterSlot.nextButton && r.afterSlot.nextButton.inViewport}, `
        + `scrollNeeded=${r.afterSlot.nextButton && r.afterSlot.nextButton.scrollNeededPx}px)`
      : 'first selection advanced the widget',
  });
  if (r.scrollPass) {
    checks.push({
      name: `${v}: Confirm reachable by scrolling, no horizontal overflow`,
      pass: r.scrollPass.submitReachable && r.scrollPass.noHorizontalOverflow,
      detail: JSON.stringify(r.scrollPass),
    });
  }
  if (r.happy) {
    checks.push({
      name: `${v}: happy path books end to end`,
      pass: r.happy.confirmRendered && r.happy.postCount === 1,
      detail: `confirm=${r.happy.confirmRendered} onScreen=${r.happy.confirmOnScreen} posts=${r.happy.postCount}`,
    });
    const contract = checkContract(r.happy.postBody);
    checks.push({
      name: `${v}: POST /booking/create contract unchanged`,
      pass: contract.ok,
      detail: contract.detail,
    });
  }
  checks.push({
    name: `${v}: focus lands on the name field, NOT the bot honeypot`,
    pass: r.afterSlot.focused === 'dl-bk-name',
    detail: `activeElement=${JSON.stringify(r.afterSlot.focused)}`
      + (r.afterSlot.focused === 'dl-bk-hp-field'
        ? ' — the caller\'s first keystrokes would go into #dl-bk-hp-field and handleFormSubmit would silently abort the booking'
        : ''),
  });
  checks.push({
    name: `${v}: the chosen slot is readable on the details step`,
    pass: !!(r.afterSlot.slotReadback && r.afterSlot.slotReadback.present && r.afterSlot.slotReadback.inViewport),
    detail: r.afterSlot.slotReadback && r.afterSlot.slotReadback.present
      ? `${JSON.stringify(r.afterSlot.slotReadback.text)} top=${r.afterSlot.slotReadback.top} inViewport=${r.afterSlot.slotReadback.inViewport}`
      : 'no slot read-back rendered above the form',
  });
}

// ── Voice-assisted path ──────────────────────────────────────────────────────
if (voice && !voice.error) {
  checks.push({
    name: 'voice: showDate stays BROWSE (does not commit the caller to a time)',
    pass: voice.afterShowDate === 'DATE_PICK',
    detail: `showDate(${JSON.stringify(voice.dayLabel)}) → ${JSON.stringify(voice.showDateResult)}, step=${voice.afterShowDate}`,
  });
  checks.push({
    name: 'voice: Paula selectSlot({day,time}) reaches the details step',
    pass: voice.afterSelect === 'FORM',
    detail: `selectSlot({day,time:${JSON.stringify(voice.spokenTime)}}) → ${JSON.stringify(voice.selectResult)}, step=${voice.afterSelect}`,
  });
  checks.push({
    name: 'voice: booking confirms end to end',
    pass: voice.confirmed === true,
    detail: `confirm screen rendered=${voice.confirmed}`,
  });
  const vc = checkContract(voice.body);
  checks.push({ name: 'voice: POST contract unchanged', pass: vc.ok, detail: vc.detail });
  checks.push({
    name: 'voice: call_id and qualifier_claim ride on the POST',
    pass: !!(voice.body && voice.body.call_id === 'call_verify_voice_001' && voice.body.qualifier_claim === 'none'),
    detail: `call_id=${JSON.stringify(voice.body && voice.body.call_id)} qualifier_claim=${JSON.stringify(voice.body && voice.body.qualifier_claim)}`,
  });
} else {
  checks.push({ name: 'voice: ran', pass: false, detail: (voice && voice.error) || 'not run' });
}

const passed = checks.filter((c) => c.pass).length;
const verdict = {
  order: 'JORDAN-BOOKING-WIDGET-DETAILS-R1',
  label: LABEL,
  generatedAt: new Date().toISOString(),
  go: passed === checks.length,
  passed,
  total: checks.length,
  checks,
  results,
  voice,
};

await writeFile(EVIDENCE.replace('.json', `-${LABEL}.json`), JSON.stringify(verdict, null, 2));

console.log(`\n── JORDAN-BOOKING-WIDGET-DETAILS-R1 · ${LABEL} ──`);
for (const c of checks) console.log(`  ${c.pass ? 'PASS' : 'FAIL'}  ${c.name}\n        ${c.detail}`);
console.log(`\n  ${passed}/${checks.length} — ${verdict.go ? 'GO' : 'NO-GO'}`);
console.log(`  evidence: test/preview/booking-details-evidence-${LABEL}.json`);
console.log(`  screenshots: test/preview/screenshots/bkdetails-${LABEL}-*.png\n`);
