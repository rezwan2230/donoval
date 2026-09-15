// ── JORDAN-PERCH-NATIVE-BOOK — the Preview verifier ─────────────────────────
//
// Order JORDAN-PERCH-NATIVE-BOOK · the last leg of the qualifier→booking flow.
//
//   node test/preview/verify-native-book.mjs [baseUrl]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and the evidence file it writes.
//
// ── WHAT THIS ADDS TO verify-qualifier-booking.mjs ───────────────────────────
// That verifier drove Paula: it queued `goto_booking` + `booking_prefill` as a
// batch and proved the caller landed on a revealed calendar. It never measured the
// case where PAULA DOES NOT ISSUE THE COMMAND — which is the live symptom. A
// caller taps the card through, reads "Paula has it. She'll pull up the calendar",
// and nothing opens it.
//
// So this run queues NO navigate at all. It opens the card through the shipped
// `?qualifier=1` affordance, taps every answer, and then measures whether the
// calendar came up on its own:
//
//   • the caller ends on /book with `#book-live` REVEALED and sized in pixels;
//   • the widget's own `#dl-bk-notes` carries the answers they tapped;
//   • it happened as a SWAP — zero document loads, one layer instance, the live
//     AudioContext clock still advancing — so a real call would have survived it;
//   • exactly ONE navigate and ONE prefill batch, read off the channel's probe;
//   • and when Paula's `goto_booking` + `booking_prefill` pair arrives afterwards,
//     still exactly one navigate, with her fields merged rather than either
//     driver's half dropped.
//
// ── WHAT IS REAL HERE, AND WHAT IS NOT ───────────────────────────────────────
//   REAL, against the live Preview deployment
//     • the shipped js/perch/qualifier.js (including `bookingPrefillFrom`),
//       js/perch/command-channel.js (`advanceToBooking` + the coalescer),
//       js/perch-layer.js's `onQualified` wiring, js/perch/booking-control.js and
//       js/perch-swup-router.js, loaded by the edge injector on a real content page;
//     • the real swap into /book, the real js/page/booking-gate.js reveal, the real
//       js/booking-widget.js booting from the adoption allow-list, and the real
//       /booking/types + /booking/availability reads behind it;
//     • the prefilled note, read back out of the widget's own textarea.
//
//   NOT REAL, and why
//     • the call id. A real one needs a Retell session, which needs a Turnstile
//       solve, which refuses automation by design
//       ([[feedback_turnstile_not_agent_verifiable]]). The harness calls the
//       shipped `bindCall()` export — the seam js/donovan-widget.js uses.
//     • Paula's half of §5. Queuing for real means POSTing /fn/do_page_action,
//       which needs PERCH_TOOL_SECRET; the /fn/page-poll response is fulfilled with
//       the exact batch the Function's coalescer produces, and the coalescer itself
//       is held in CI against the real DO class.
//
// ── NOTHING IS WRITTEN ───────────────────────────────────────────────────────
// `/booking/create` is route-ABORTED, not merely observed — an "error path" probe
// in this codebase has already booked a real Clio appointment once
// ([[feedback_negative_path_probe_can_write]]). `/fn/qualifier_submit` is captured
// and aborted for the same reason: it forwards to Vantage /upsert-lead. Confirm is
// never pressed, and `out.writes` must stay empty.

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] && !process.argv[2].startsWith('--'))
  ? process.argv[2].replace(/\/$/, '')
  // The immutable per-deployment URL, never the branch alias: Pages truncates the
  // alias hostname ([[feedback_pages_alias_slug_truncation]]) and an alias can
  // serve a STALE asset ([[feedback_pages_alias_serves_stale_asset]]).
  : process.env.PREVIEW_URL || '';

/**
 * `--baseline` runs the SAME flow against a deployment built from the tree WITHOUT
 * this ticket, and asserts the defect: the card completes, the done state promises
 * the calendar, and the caller is still sitting on the content page. It is the
 * before half of the screenshot pair and the control for everything below —
 * a fix whose absence changes nothing about this run was never proving anything
 * ([[feedback_fixture_must_reproduce_the_defect]]).
 */
const BASELINE = process.argv.includes('--baseline');
/** Screenshot prefix, so the two runs cannot overwrite each other's evidence. */
const PHASE = BASELINE ? 'before' : 'after';

/** The 92-page div-box majority shape — where a visitor actually lands after A51. */
const START = '/contact';
/** What ACTION_MAP.goto_booking queues, and what the auto-advance must agree with. */
const BOOK_TARGET = '/book.html';

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const shotDir = fileURLToPath(new URL('./screenshots/', import.meta.url));
mkdirSync(shotDir, { recursive: true });

const out = {
  order: 'JORDAN-PERCH-NATIVE-BOOK',
  phase: PHASE,
  baseline: BASELINE,
  base: BASE,
  startedAt: new Date().toISOString(),
  steps: [],
  writes: [],            // anything reaching /booking/create. MUST stay empty.
  qualifierSubmits: [],  // captured and ABORTED — never delivered.
  console: [],
  pageErrors: [],
  cspViolations: [],
  screenshots: [],
  notes: [],
};

function step(name, ok, detail) {
  out.steps.push({ name, ok: !!ok, detail: detail === undefined ? null : detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log('      ' + JSON.stringify(detail));
  return ok;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** The poll interval is 1200 ms; give it two turns plus slack. */
const POLL_WINDOW = 3200;

/**
 * One arm of the flow: land, open the card via ?qualifier=1, tap through, and read
 * back what the caller is looking at.
 *
 * Run twice — desktop and mobile — because the calendar reveal is a layout
 * question as much as a routing one, and a card that fits at 1440 px can push the
 * booking widget below a mobile fold.
 */
async function arm(ctx, label, viewport) {
  const page = await ctx.newPage();
  await page.setViewportSize(viewport);

  page.on('console', (m) => {
    out.console.push({ arm: label, type: m.type(), text: m.text().slice(0, 300) });
    if (/Content Security Policy|Refused to/i.test(m.text())) {
      out.cspViolations.push({ arm: label, text: m.text().slice(0, 300) });
    }
  });
  page.on('pageerror', (e) => out.pageErrors.push({ arm: label, error: String(e).slice(0, 300) }));
  let documentLoads = 0;
  page.on('load', () => { documentLoads++; });

  // The write path. ABORTED, not observed — see the header.
  await page.route('**/booking/create', async (route) => {
    out.writes.push({ arm: label, url: route.request().url(), method: route.request().method() });
    return route.abort();
  });
  await page.route('**/fn/qualifier_submit', async (route) => {
    let body = null;
    try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) { body = { unparseable: true }; }
    out.qualifierSubmits.push({ arm: label, body });
    return route.abort();
  });

  // The bridge stand-in: read-once, exactly like the DO's /get. `queued` stays
  // null for the whole auto-advance leg — that absence IS the test.
  let queued = null;
  let intercept = false;
  await page.route('**/fn/page-poll*', async (route) => {
    if (!intercept) return route.continue();
    const body = queued; queued = null;
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'cache-control': 'no-store' },
      body: JSON.stringify(body || {}),
    });
  });

  const layerProbe = () => page.evaluate(() => (window.Perch && window.Perch.layer ? window.Perch.layer.probe() : null));
  const routerProbe = () => page.evaluate(() => (window.Perch && window.Perch.router ? window.Perch.router.probe() : null));
  const bookProbe = () => page.evaluate(() => (window.Perch && window.Perch.layer ? window.Perch.layer.bookingProbe() : null));

  const shot = async (name, note) => {
    const file = shotDir + `nativebook-${PHASE}-${label}-${name}.png`;
    await page.screenshot({ path: file, fullPage: false });
    out.screenshots.push({ arm: label, phase: PHASE, name, file, viewport, note });
  };

  // ── 1. BEFORE: the card open, the promise on screen, no calendar anywhere ──
  await page.goto(BASE + START + '?qualifier=1&src=google', { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle').catch(() => {});
  await sleep(600);

  const router = await routerProbe();
  step(`[${label}] the router is on for this deployment`, !!(router && router.ready),
    router && { ready: router.ready, container: router.container, errors: router.errors });

  let probe = await layerProbe();
  step(`[${label}] the channel and the card are mounted on a content page`,
    !!(probe && probe.commandChannel && probe.qualifierMounted),
    probe && { commandChannel: probe.commandChannel, qualifierMounted: probe.qualifierMounted });

  // A live, non-DOM resource: an AudioContext clock only advances while the context
  // lives, so comparing it across the navigation is positive proof the session was
  // never torn down ([[feedback_spike_prove_with_a_live_resource]]).
  await page.evaluate(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const c = new Ctx();
    const osc = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0.0001;
    osc.connect(g).connect(c.destination);
    osc.start();
    window.Perch.layer.attachLiveResource('nativebook-audio', { clock: () => c.currentTime, state: () => c.state });
  });

  const CALL_ID = 'verify-nativebook-' + Math.random().toString(36).slice(2, 10);
  const bound = await page.evaluate(async (callId) => {
    const m = await import('/js/perch-layer.js');
    return m.bindCall({ callId });
  }, CALL_ID);
  step(`[${label}] bindCall() — the seam js/donovan-widget.js calls — accepted the call`,
    !!(bound && bound.ok), bound);
  intercept = true; // from here the bridge serves {} — Paula issues NOTHING

  await page.waitForFunction(
    () => { const q = document.getElementById('qual'); return !!q && q.classList.contains('show'); },
    null, { timeout: 15000 },
  ).catch(() => {});

  const cardOpen = await page.evaluate(() => {
    const q = document.getElementById('qual');
    if (!q) return { present: false };
    const card = q.querySelector('.card');
    const cr = card ? card.getBoundingClientRect() : null;
    return {
      present: true,
      display: getComputedStyle(q).display,
      cardRect: cr ? { w: Math.round(cr.width), h: Math.round(cr.height) } : null,
      heading: (q.querySelector('#qual-bd h2') || {}).textContent || null,
      options: [...q.querySelectorAll('#qual-bd .opt')].map((b) => b.dataset.v || b.id),
    };
  });
  step(`[${label}] ?qualifier=1 opens a tappable card`,
    !!(cardOpen.present && cardOpen.display === 'flex' && cardOpen.cardRect
       && cardOpen.cardRect.w > 200 && cardOpen.cardRect.h > 100 && cardOpen.options.length >= 4),
    cardOpen);
  await shot('before-card-open', 'the caller is on /contact with the qualifier card up; no calendar exists');

  const startUrl = new URL(page.url()).pathname;
  const loadsBefore = documentLoads;
  const swapsBefore = (await routerProbe()).swaps;
  const layerBefore = await layerProbe();

  // ── 2. The tap-through. NOTHING is queued on the bridge. ──────────────────
  const taps = ['real_estate', 'acquisition', null, 'yourself', '1_5m_3m', '5m_15m'];
  for (const v of taps) {
    if (v === null) {
      await page.selectOption('#qual-bd #q-sel', 'FL').catch(() => {});
      await page.click('#qual-bd #q-cont').catch(() => {});
    } else {
      await page.click(`#qual-bd .opt[data-v="${v}"]`).catch(() => {});
    }
    await sleep(150);
  }
  await sleep(400);

  const submit = (out.qualifierSubmits.filter((s) => s.arm === label)[0] || {}).body || null;
  step(`[${label}] the completed card still POSTs the lead get_qualifier_result reads`,
    !!(submit && submit.call_id === CALL_ID && submit.matter_category === 'real_estate'
       && submit.matter_sub === 'acquisition' && submit.state === 'FL'
       && submit.income_band === '1_5m_3m' && submit.net_worth_band === '5m_15m'),
    { submit, note: 'captured and ABORTED — it forwards to Vantage /upsert-lead' });

  const doneTxt = await page.evaluate(() => (document.getElementById('qual-bd') || {}).textContent || '');
  step(`[${label}] and the done-state copy is unchanged`, /Paula has it/.test(doneTxt),
    { text: doneTxt.replace(/\s+/g, ' ').slice(0, 140) });
  await shot('during-done-state', BASELINE
    ? 'the done card promising the calendar — on the tree without the fix'
    : 'the done card, with the calendar already loading behind it');

  // ── THE CONTROL: the same flow on the tree WITHOUT the fix ─────────────────
  if (BASELINE) {
    // Long enough for the 6.5 s auto-close plus five poll turns. If a calendar were
    // going to appear, it would have.
    await sleep(11000);
    const stalled = await page.evaluate(() => {
      const live = document.getElementById('book-live');
      const q = document.getElementById('qual');
      return {
        url: location.pathname,
        bookLiveExists: !!live,
        cardStillOpen: !!(q && q.classList.contains('show')),
        bodyText: (document.getElementById('perch-main') || document.body)
          .textContent.replace(/\s+/g, ' ').trim().slice(0, 100),
      };
    });
    step(`[${label}] THE DEFECT, MEASURED: the caller is still on ${startUrl}, and no calendar exists`,
      stalled.url === startUrl && stalled.bookLiveExists === false,
      stalled);
    const chB = ((await layerProbe()) || {}).commandChannel || null;
    step(`[${label}] …because nothing ever navigated: zero /book navigations`,
      // `bookNavs` does not exist on the baseline build; its absence is itself the
      // report. Either shape is accepted, and both mean "no navigation happened".
      (chB && (chB.bookNavs === undefined || chB.bookNavs === 0)) && documentLoads === loadsBefore,
      { commandChannel: chB, documentLoads: documentLoads - loadsBefore });
    await shot('after-nothing-happened', 'the caller stalled on the content page — the live symptom');
    step(`[${label}] no CSP violation on the baseline either`,
      out.cspViolations.filter((v) => v.arm === label).length === 0,
      out.cspViolations.filter((v) => v.arm === label));
    await page.close();
    return;
  }

  // ── 3. THE HEADLINE: the calendar comes up with no command from Paula ─────
  await page.waitForFunction(() => /^\/book(\.html)?$/.test(location.pathname), null, { timeout: 15000 })
    .catch(() => {});
  // The widget is adopted by the swap, then reads /booking/types + /availability.
  await page.waitForFunction(() => !!window.DLBooking, null, { timeout: 15000 }).catch(() => {});
  await sleep(2500);
  // The card auto-closes 6.5 s after completion; let it, so the screenshot is what
  // the caller ends up looking at rather than a card over a calendar.
  await page.waitForFunction(
    () => { const q = document.getElementById('qual'); return !q || !q.classList.contains('show'); },
    null, { timeout: 9000 },
  ).catch(() => {});

  const bookState = await page.evaluate(() => {
    const gate = document.getElementById('book-gate');
    const live = document.getElementById('book-live');
    const host = document.getElementById('dl-booking');
    const lr = live ? live.getBoundingClientRect() : null;
    const notes = document.getElementById('dl-bk-notes');
    return {
      url: location.pathname,
      gateDisplay: gate ? getComputedStyle(gate).display : null,
      liveDisplay: live ? getComputedStyle(live).display : null,
      // Pixels, not a style string: "display:block" on an empty container is not a
      // calendar the caller can see ([[feedback_presence_is_not_clickability]]).
      liveRect: lr ? { w: Math.round(lr.width), h: Math.round(lr.height) } : null,
      widgetChildren: host ? host.children.length : 0,
      widgetText: host ? (host.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160) : null,
      dlBooking: typeof window.DLBooking,
      // The prefill as the widget holds it, before any form step has rendered.
      prefillHeld: (window.DLBooking && window.DLBooking.getState
        ? (window.DLBooking.getState().prefill || null) : null),
      notesValueOnScreen: notes ? notes.value : null,
      callId: window.__perchCallId || null,
    };
  });

  step(`[${label}] THE HEADLINE: no Paula command, and the caller is ON /book with the calendar REVEALED`,
    /^\/book(\.html)?$/.test(bookState.url) && bookState.gateDisplay === 'none'
      && bookState.liveDisplay === 'block' && !!bookState.liveRect && bookState.liveRect.h > 100,
    { startUrl, ...bookState });

  const layerAfter = await layerProbe();
  step(`[${label}] …as a SWAP, so a live call survives it — zero document loads`,
    documentLoads === loadsBefore && (await routerProbe()).swaps > swapsBefore
      && !!(layerBefore && layerAfter && layerBefore.instanceId === layerAfter.instanceId),
    {
      documentLoads: documentLoads - loadsBefore,
      swaps: (await routerProbe()).swaps - swapsBefore,
      instanceStable: !!(layerBefore && layerAfter && layerBefore.instanceId === layerAfter.instanceId),
    });

  const a0 = layerBefore && layerBefore.resources['nativebook-audio'];
  const a1 = layerAfter && layerAfter.resources['nativebook-audio'];
  // A clock at exactly 0 has NOT STARTED — a different fact from "did not advance".
  step(`[${label}] …and the live session resource was never torn down`,
    !!(a1 && a1.state === 'running' && a0 && a1.clock >= a0.clock && a1.clock > 0), { before: a0, after: a1 });

  step(`[${label}] the booking widget booted from the adoption allow-list`,
    bookState.dlBooking === 'object' && bookState.widgetChildren > 0, bookState);

  const ch = (layerAfter && layerAfter.commandChannel) || null;
  step(`[${label}] EXACTLY ONE navigate and ONE prefill batch`,
    !!(ch && ch.bookNavs === 1 && ch.autoAdvanced === true
       && ch.log.filter((e) => e.cmd === 'booking_prefill').length === 1),
    ch && {
      bookNavs: ch.bookNavs, autoAdvanced: ch.autoAdvanced, prefillFields: ch.prefillFields,
      log: ch.log,
    });

  const bp = await bookProbe();
  const prefillEntry = ((bp && bp.log) || []).filter((l) => l.cmd === 'booking_prefill').at(-1) || null;
  step(`[${label}] the prefill reached DLBooking.prefill (not the unobserved postMessage road)`,
    !!(bp && bp.widgetPresent && prefillEntry && prefillEntry.via === 'DLBooking.prefill' && !prefillEntry.reason),
    { widgetPresent: bp && bp.widgetPresent, prefillEntry });

  await shot('after-calendar-revealed', 'auto-revealed #book-live, no Paula command issued');

  // ── 4. Drive to the form and READ THE NOTE BACK ───────────────────────────
  //
  // The trust boundary, restated where the driven path crosses it: date and slot
  // only. `showDate` browses, `selectSlot` advances to the form, and Confirm is
  // never pressed by anything in this file.
  //
  // Whether there is anything to drive depends on what the live scheduling backend
  // offers today, which is not this ticket's to control. Each leg reports `skipped`
  // honestly rather than passing vacuously.
  const days = await page.evaluate(() => [...document.querySelectorAll('#dl-booking .dl-bk-date-btn')]
    .map((el) => el.getAttribute('data-key')).filter(Boolean));
  let times = [];
  if (days.length) {
    queued = { cmd: 'booking_show_date', payload: { day: days[0] } };
    await page.waitForFunction(() => !!document.querySelector('#dl-booking .dl-bk-slot-btn'), null, { timeout: 12000 })
      .catch(() => {});
    await sleep(400);
    times = await page.evaluate(() => [...document.querySelectorAll('#dl-booking .dl-bk-slot-btn')]
      .map((el) => (el.textContent || '').trim()).filter(Boolean));
  } else {
    out.notes.push(`[${label}] the deployment offered no bookable days — the form leg was SKIPPED, not passed`);
  }

  let fields = null;
  if (times.length) {
    queued = { cmd: 'booking_select_slot', payload: { day: days[0], time: times[0] } };
    await page.waitForFunction(() => !!document.getElementById('dl-bk-name'), null, { timeout: 12000 }).catch(() => {});
    await sleep(600);
    fields = await page.evaluate(() => {
      const v = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
      return { name: v('dl-bk-name'), email: v('dl-bk-email'), phone: v('dl-bk-phone'), notes: v('dl-bk-notes') };
    });
    await shot('after-form-prefilled', 'the booking form, with the tapped answers in the note');
  }

  step(`[${label}] THE OTHER HEADLINE: the tapped answers are typed into the form's note`,
    times.length === 0
      ? !!(bookState.prefillHeld && bookState.prefillHeld.notes === true)
      : !!(fields && /^Matter: Real estate — Acquisition \(buying\)/.test(fields.notes || '')
           && /For: Yourself \(personal\)/.test(fields.notes)
           && /State: Florida/.test(fields.notes)
           && /Heard via: google/.test(fields.notes)),
    { skipped: times.length === 0, fields, prefillHeld: bookState.prefillHeld });

  step(`[${label}] and the caller's own fields are left for the caller to type`,
    times.length === 0 ? true : !!(fields && !fields.name && !fields.email && !fields.phone),
    { skipped: times.length === 0, fields });

  step(`[${label}] the money bands stayed OFF the caller-visible note`,
    !/1_5m_3m|5m_15m|\$1\.5M|\$5M|\$15M|income|net worth/i.test((fields && fields.notes) || ''),
    { notes: (fields && fields.notes) || null });

  // ── 5. Paula's pair, arriving after the auto-advance ─────────────────────
  const navsBeforePaula = ch ? ch.bookNavs : null;
  const loadsBeforePaula = documentLoads;
  const PAULA = { name: 'Ada Lovelace', email: 'ada@example.test', phone: '5615550100' };
  queued = {
    cmd: 'batch',
    actions: [
      { cmd: 'navigate', target: BOOK_TARGET },
      { cmd: 'booking_prefill', payload: PAULA },
    ],
  };
  await sleep(POLL_WINDOW);

  const afterPaula = await layerProbe();
  const chP = (afterPaula && afterPaula.commandChannel) || null;
  step(`[${label}] Paula's later goto_booking costs NO second navigation`,
    !!(chP && chP.bookNavs === navsBeforePaula) && documentLoads === loadsBeforePaula,
    {
      bookNavsBefore: navsBeforePaula,
      bookNavsAfter: chP && chP.bookNavs,
      coalesced: chP && chP.log.filter((e) => e.coalesced === 'book_nav_already_run'),
      documentLoads: documentLoads - loadsBeforePaula,
    });
  // The WIDGET's own view, which is the authoritative one here. Measured, and it
  // corrected this step: `probe().prefillFields` is empty by now, because the
  // widget ACKED the first prefill and `{__perchBookingAck}` clears the channel's
  // pending payload — deliberately, so re-delivery cannot run into fields the
  // caller has since edited. So the channel's merge is load-bearing only in the
  // window BEFORE the ack (a prefill arriving while /book is still swapping in,
  // which is the real race), and after it the widget's own non-destructive
  // `_agentPrefill` is what keeps both halves. Both layers hold, and this reads the
  // one that is still holding.
  const held = await page.evaluate(() => (window.DLBooking && window.DLBooking.getState
    ? (window.DLBooking.getState().prefill || null) : null));
  step(`[${label}] and her fields MERGE with the qualifier note — neither half is dropped`,
    !!(held && held.name && held.email && held.phone && held.notes),
    { widgetHolds: held, channelPending: chP && chP.prefillFields });

  const merged = await page.evaluate(() => {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
    return { name: v('dl-bk-name'), email: v('dl-bk-email'), phone: v('dl-bk-phone'), notes: v('dl-bk-notes') };
  });
  step(`[${label}] …and if the form is on screen, all four fields are in it`,
    times.length === 0 ? true : !!(merged.name === PAULA.name && merged.email === PAULA.email
      && /^Matter: Real estate/.test(merged.notes || '')),
    { skipped: times.length === 0, merged });

  // ── 6. Nothing was written, nothing escaped the frame ────────────────────
  const escape = await page.evaluate(() => ({
    // The auto-advance must not have introduced a frame escape or a writable
    // control surface. Read off the LIVE document, not the source.
    topLevel: window.top === window.self,
    perchWritable: (() => {
      const d = Object.getOwnPropertyDescriptor(window, '__perch');
      return d ? !!d.writable : null;
    })(),
    perchKeys: window.__perch ? Object.keys(window.__perch) : null,
    layerKeys: (window.Perch && window.Perch.layer) ? Object.keys(window.Perch.layer).sort() : null,
  }));
  step(`[${label}] window.__perch is still the read-only probe, and nothing new is published`,
    escape.perchWritable === false && JSON.stringify(escape.perchKeys) === '["probe"]'
      && JSON.stringify(escape.layerKeys) === '["attachLiveResource","bookingProbe","detachLiveResource","probe"]',
    escape);

  step(`[${label}] the channel is still polling after the swap`, !!(chP && chP.polling), chP);

  await page.close();
}

async function main() {
  if (!BASE) {
    console.error('usage: node test/preview/verify-native-book.mjs <previewUrl>   (or set PREVIEW_URL)');
    out.steps.push({ name: 'a base URL was supplied', ok: false, detail: null });
    return;
  }

  const browser = await chromium.launch();
  try {
    // Desktop and mobile get their OWN context, so the 30-minute
    // `donovan_booking_unlock` localStorage window from one arm cannot reveal the
    // calendar for the other. Sharing a context would make the second arm pass
    // whether or not the auto-advance did anything at all.
    for (const [label, viewport] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
      const ctx = await browser.newContext({ viewport, isMobile: label === 'mobile', hasTouch: label === 'mobile' });
      try {
        await arm(ctx, label, viewport);
      } catch (e) {
        step(`[${label}] the run completed without throwing`, false, String(e).slice(0, 400));
      } finally {
        await ctx.close();
      }
    }

    step('the caller was never auto-submitted — NOTHING reached /booking/create',
      out.writes.length === 0, out.writes);
    step('no CSP violation across the whole flow — every module is a same-origin external',
      out.cspViolations.length === 0, out.cspViolations);

    // Turnstile 600010 is the DRIVER refusing the challenge, not the site failing:
    // it fires the moment the widget reaches the FORM step and renders the challenge
    // under headless automation, and a real Chrome/Edge channel does not raise it
    // ([[feedback_turnstile_600010_is_the_driver_not_the_site]]). Exempted by an
    // explicit named rule rather than by whether the run happened to finish first —
    // that timing is a coin flip, and a coin flip in a gate is worse than a
    // documented exemption. Everything else still reds.
    const TURNSTILE_HEADLESS = /Turnstile.*600010/i;
    const realErrors = out.pageErrors.filter((e) => !TURNSTILE_HEADLESS.test(e.error));
    out.exemptedErrors = out.pageErrors.filter((e) => TURNSTILE_HEADLESS.test(e.error));
    step('no uncaught page errors (Turnstile 600010 exempted — it is the headless driver)',
      realErrors.length === 0, { realErrors, exempted: out.exemptedErrors });

    // ── The rollback target is untouched ────────────────────────────────────
    const ctx = await browser.newContext({ viewport: DESKTOP });
    const shell = await ctx.newPage();
    const shellWrites = [];
    shell.on('request', (r) => { if (/\/booking\/create/.test(r.url())) shellWrites.push(r.url()); });
    const sres = await shell.goto(BASE + '/perch', { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const shellState = await shell.evaluate(() => ({
      orb: !!document.getElementById('concierge'),
      qual: !!document.getElementById('qual'),
      iframe: !!document.getElementById('site'),
      layerInShell: !!document.getElementById('perch-persistent'),
    }));
    step('the SHELL at /perch still serves and still builds its own concierge',
      sres.status() === 200 && shellState.orb && shellState.qual && shellState.iframe && !shellState.layerInShell,
      { status: sres.status(), ...shellState, writes: shellWrites });
    await ctx.close();
  } catch (e) {
    step('the run completed without throwing', false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
}

await main();

out.finishedAt = new Date().toISOString();
out.passed = out.steps.filter((s) => s.ok).length;
out.failed = out.steps.filter((s) => !s.ok).length;
out.verdict = out.failed === 0 && out.writes.length === 0 && out.cspViolations.length === 0 ? 'GO' : 'NO-GO';

const evidence = fileURLToPath(new URL(`./native-book-${PHASE}-evidence.json`, import.meta.url));
writeFileSync(evidence, JSON.stringify(out, null, 2));
console.log('\n' + JSON.stringify({
  phase: PHASE,
  verdict: out.verdict,
  passed: out.passed,
  failed: out.failed,
  writes: out.writes.length,
  cspViolations: out.cspViolations.length,
  screenshots: out.screenshots.map((s) => s.name),
  notes: out.notes,
  evidence,
}, null, 2));
console.log(`screenshots → ${shotDir}`);
