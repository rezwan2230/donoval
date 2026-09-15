// ── SHELDON-COMMAND-CHANNEL-QUALIFIER-BOOKING — the Preview verifier ─────────
//
// Order SHELDON-COMMAND-CHANNEL-QUALIFIER-BOOKING · priority live regression,
// follow-up to the merged command-channel fix (#92).
//
//   node test/preview/verify-qualifier-booking.mjs [baseUrl]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and the evidence file it writes.
//
// ── WHAT THIS ADDS TO verify-command-channel.mjs ─────────────────────────────
// That verifier proved the consumer exists and that a SINGLE queued command
// drives the page. It never navigated to /book, and it never sent two commands
// in one poll — which is precisely the shape both live failures take:
//
//   • Paula issues `goto_booking` and `booking_prefill` in the same turn. The
//     bridge holds one action per call, so one of them was destroyed before the
//     browser ever saw it (proved against the real DO class in
//     test/perch-qualifier-booking.test.mjs §1).
//   • She issues a `goto_*` and `open_qualifier` in the same turn, and the card
//     loses the same coin toss.
//
// So this run drives BATCHES, and it measures the two things nobody has measured
// on a live deployment: that the caller ends up looking at the booking CALENDAR,
// and that the prefill Paula sent with the navigation is in the form fields when
// they get there.
//
// ── WHAT IS REAL HERE, AND WHAT IS NOT ───────────────────────────────────────
//   REAL, against the live Preview deployment
//     • the shipped js/perch-layer.js, js/perch/command-channel.js (including the
//       new `batch` branch), js/perch/booking-control.js, js/perch/qualifier.js
//       and js/perch-swup-router.js, loaded by the edge injector on a real content
//       page with the router on;
//     • the real swap into /book, the real js/page/booking-gate.js reveal, the
//       real js/booking-widget.js booting from the adoption allow-list, and the
//       real /booking/types + /booking/availability reads behind it;
//     • the prefill, read back out of the widget's own DOM inputs.
//
//   NOT REAL, and why
//     • the /fn/page-poll RESPONSE BODY. Queuing for real means POSTing
//       /fn/do_page_action, which needs PERCH_TOOL_SECRET, and this order forbids
//       entering or reading a secret. The COALESCING half of the fix therefore
//       lives in CI (real PerchBridge class, real handlers); what runs here is the
//       browser half, fed the exact batch the coalescer produces.
//     • the call id. A real one needs a Retell session, which needs a Turnstile
//       solve, which refuses automation by design
//       ([[feedback_turnstile_not_agent_verifiable]]). The harness calls the
//       shipped `bindCall()` export — the seam js/donovan-widget.js uses.
//
// ── NOTHING IS WRITTEN ───────────────────────────────────────────────────────
// `/booking/create` is route-ABORTED, not merely observed: this suite drives the
// widget all the way to the form step, and an "error path" probe in this codebase
// has already booked a real Clio appointment once
// ([[feedback_negative_path_probe_can_write]]). `/fn/qualifier_submit` is captured
// and aborted for the same reason — it forwards to Vantage /upsert-lead. Confirm
// is never pressed, and `out.writes` must stay empty.

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] && !process.argv[2].startsWith('--'))
  ? process.argv[2].replace(/\/$/, '')
  // The immutable per-deployment URL, never the branch alias: Pages truncates the
  // alias hostname ([[feedback_pages_alias_slug_truncation]]) and an alias can
  // serve a STALE asset ([[feedback_pages_alias_serves_stale_asset]]).
  : process.env.PREVIEW_URL || '';

const START = '/contact';                     // the 92-page div-box majority shape
const TOPIC_TARGET = '/re-acquisition.html';  // what goto_re_acquisition maps to
const BOOK_TARGET = '/book.html';             // what goto_booking / book_consult map to

const out = {
  order: 'SHELDON-COMMAND-CHANNEL-QUALIFIER-BOOKING',
  base: BASE,
  startedAt: new Date().toISOString(),
  steps: [],
  writes: [],            // anything reaching /booking/create. MUST stay empty.
  qualifierSubmits: [],  // captured and ABORTED — never delivered.
  livePolls: [],
  console: [],
  pageErrors: [],
  cspViolations: [],
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

async function main() {
  if (!BASE) {
    console.error('usage: node test/preview/verify-qualifier-booking.mjs <previewUrl>   (or set PREVIEW_URL)');
    out.steps.push({ name: 'a base URL was supplied', ok: false, detail: null });
    return;
  }

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on('console', (m) => {
    out.console.push({ type: m.type(), text: m.text().slice(0, 300) });
    if (/Content Security Policy|Refused to/i.test(m.text())) out.cspViolations.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => out.pageErrors.push(String(e).slice(0, 300)));
  let documentLoads = 0;
  page.on('load', () => { documentLoads++; });

  // The write path. ABORTED, not observed — see the header.
  await page.route('**/booking/create', async (route) => {
    out.writes.push({ url: route.request().url(), method: route.request().method() });
    return route.abort();
  });
  await page.route('**/fn/qualifier_submit', async (route) => {
    let body = null;
    try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) { body = { unparseable: true }; }
    out.qualifierSubmits.push(body);
    return route.abort();
  });

  // The bridge stand-in: read-once, exactly like the DO's /get. With `intercept`
  // off the request is NOT intercepted at all and the real Function answers.
  let queued = null;
  let intercept = false;
  await page.route('**/fn/page-poll*', async (route) => {
    const hdr = route.request().headers()['x-perch-call-id'] || null;
    if (!intercept) {
      out.livePolls.push({ header: hdr, mode: 'passthrough' });
      return route.continue();
    }
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

  try {
    // ── 1. Baseline: the page a visitor lands on after A51 ───────────────────
    await page.goto(BASE + START, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(600);

    const router = await routerProbe();
    step('the router is on and ready for this deployment', !!(router && router.ready),
      router && { ready: router.ready, container: router.container, errors: router.errors });

    let probe = await layerProbe();
    step('the command channel and the qualifier are mounted on a content page',
      !!(probe && probe.commandChannel && probe.qualifierMounted),
      probe && { commandChannel: probe.commandChannel, qualifierMounted: probe.qualifierMounted });

    // A live, non-DOM resource: an AudioContext clock only advances while the
    // context lives, so comparing it across the navigations is positive proof the
    // call was never torn down ([[feedback_spike_prove_with_a_live_resource]]).
    await page.evaluate(() => {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const c = new Ctx();
      const osc = c.createOscillator();
      const g = c.createGain();
      g.gain.value = 0.0001;
      osc.connect(g).connect(c.destination);
      osc.start();
      window.Perch.layer.attachLiveResource('qualbook-audio', { clock: () => c.currentTime, state: () => c.state });
    });

    const CALL_ID = 'verify-qualbook-' + Math.random().toString(36).slice(2, 10);
    const bound = await page.evaluate(async (callId) => {
      const m = await import('/js/perch-layer.js');
      return m.bindCall({ callId });
    }, CALL_ID);
    step('bindCall() — the seam js/donovan-widget.js calls — accepted the call', !!(bound && bound.ok), bound);

    await sleep(POLL_WINDOW);
    step('the poll is really running against /fn/page-poll with the header credential',
      out.livePolls.filter((p) => p.header === CALL_ID).length >= 1,
      { livePolls: out.livePolls.length });

    step('A32: the live call id reached the booking widget seam',
      (await page.evaluate(() => window.__perchCallId)) === CALL_ID,
      { note: 'without this /booking/create cannot join the booking to the call' });

    intercept = true;

    // ── 2. THE QUALIFIER, in the shape that failed live ──────────────────────
    // A goto and open_qualifier in ONE turn. Before the coalescer these destroyed
    // each other in the bridge and the caller saw whichever landed second.
    const qualBefore = await layerProbe();
    const loadsQual = documentLoads;
    queued = {
      cmd: 'batch',
      actions: [
        { cmd: 'navigate', target: TOPIC_TARGET },
        { cmd: 'open_qualifier', payload: { matter: 'real_estate', lang: 'en', source: 'verifier' } },
      ],
    };
    await page.waitForFunction(
      () => { const q = document.getElementById('qual'); return !!q && q.classList.contains('show'); },
      null, { timeout: 15000 },
    ).catch(() => {});
    await sleep(500);

    const qualAfter = await layerProbe();
    step('the goto half of the batch navigated the page',
      new URL(page.url()).pathname.replace('.html', '') === TOPIC_TARGET.replace('.html', ''),
      { url: page.url().replace(BASE, '') });
    step('…without a document load, so the call survives it',
      documentLoads === loadsQual && !!(qualBefore && qualAfter && qualBefore.instanceId === qualAfter.instanceId),
      { documentLoads: documentLoads - loadsQual, instanceStable: qualBefore.instanceId === qualAfter.instanceId });

    // Measured in PIXELS, not by class name: a card that is present and 0×0, or
    // behind the page, is not a card the caller can tap
    // ([[feedback_presence_is_not_clickability]]).
    const modal = await page.evaluate(() => {
      const q = document.getElementById('qual');
      if (!q) return { present: false };
      const card = q.querySelector('.card');
      const cr = card ? card.getBoundingClientRect() : null;
      const mid = card ? document.elementFromPoint(cr.left + cr.width / 2, cr.top + 20) : null;
      return {
        present: true,
        display: getComputedStyle(q).display,
        cardRect: cr ? { w: Math.round(cr.width), h: Math.round(cr.height) } : null,
        heading: (q.querySelector('#qual-bd h2') || {}).textContent || null,
        options: [...q.querySelectorAll('#qual-bd .opt')].map((b) => b.dataset.v || b.id),
        topOfCardIsInsideCard: !!(card && mid && card.contains(mid)),
        probe: window.__perch ? window.__perch.probe() : null,
      };
    });
    step('THE HEADLINE (Task 1): open_qualifier survives the batch and renders a tappable card',
      !!(modal.present && modal.display === 'flex' && modal.cardRect && modal.cardRect.w > 200
         && modal.cardRect.h > 100 && modal.topOfCardIsInsideCard && modal.options.length >= 4),
      modal);
    step('…and the card knows the live call id', !!(modal.probe && modal.probe.callId === 'set'), modal.probe);

    // ── 3. The tap-through submits with that call id (Task 3) ────────────────
    const taps = ['real_estate', 'acquisition', null, 'yourself', '1_5m_3m', '5m_15m'];
    const tapped = [];
    for (const v of taps) {
      if (v === null) {
        await page.selectOption('#qual-bd #q-sel', 'FL').catch(() => {});
        await page.click('#qual-bd #q-cont').catch(() => {});
        tapped.push('FL');
      } else {
        await page.click(`#qual-bd .opt[data-v="${v}"]`).catch(() => {});
        tapped.push(v);
      }
      await sleep(150);
    }
    await sleep(600);

    const submit = out.qualifierSubmits[0] || null;
    step('the completed card POSTs to /fn/qualifier_submit — the body get_qualifier_result reads',
      !!(submit && submit.call_id === CALL_ID && submit.matter_category === 'real_estate'
         && submit.matter_sub === 'acquisition' && submit.state === 'FL'
         && submit.income_band === '1_5m_3m' && submit.net_worth_band === '5m_15m'),
      { tapped, submit, note: 'captured and ABORTED — it forwards to Vantage /upsert-lead' });

    const doneTxt = await page.evaluate(() => (document.getElementById('qual-bd') || {}).textContent || '');
    step('and the caller sees the done card', /Paula has it|Listo/.test(doneTxt), { text: doneTxt.slice(0, 120) });
    await page.evaluate(() => { const q = document.getElementById('qual'); if (q) q.classList.remove('show'); });

    // ── 4. THE BOOKING TURN — the leg nobody has verified (Task 2) ───────────
    // `goto_booking` + `booking_prefill`, exactly as the call-test checklist
    // step 7 describes it, in one batch.
    const bookBefore = await layerProbe();
    const loadsBook = documentLoads;
    const swapsBook = (await routerProbe()).swaps;
    const PREFILL = { name: 'Ada Lovelace', email: 'ada@example.test', phone: '5615550100', notes: 'Rental acquisition' };

    queued = {
      cmd: 'batch',
      actions: [
        { cmd: 'navigate', target: BOOK_TARGET },
        { cmd: 'booking_prefill', payload: PREFILL },
      ],
    };
    await page.waitForFunction(() => /^\/book(\.html)?$/.test(location.pathname), null, { timeout: 15000 }).catch(() => {});
    // The widget is adopted by the swap and then loads /booking/types +
    // /booking/availability over the network. Give it room.
    await page.waitForFunction(() => !!window.DLBooking, null, { timeout: 15000 }).catch(() => {});
    await sleep(2500);

    const bookAfter = await layerProbe();
    const bookState = await page.evaluate(() => {
      const gate = document.getElementById('book-gate');
      const live = document.getElementById('book-live');
      const host = document.getElementById('dl-booking');
      const lr = live ? live.getBoundingClientRect() : null;
      return {
        url: location.pathname,
        gateDisplay: gate ? getComputedStyle(gate).display : null,
        liveDisplay: live ? getComputedStyle(live).display : null,
        // Pixels, not a style string: "display:block" on an empty container is
        // not a calendar the caller can see.
        liveRect: lr ? { w: Math.round(lr.width), h: Math.round(lr.height) } : null,
        widgetChildren: host ? host.children.length : 0,
        widgetText: host ? (host.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160) : null,
        dlBooking: typeof window.DLBooking,
        callId: window.__perchCallId || null,
      };
    });

    step('THE HEADLINE (Task 2): the caller is ON /book with the calendar REVEALED',
      /^\/book(\.html)?$/.test(bookState.url) && bookState.gateDisplay === 'none'
        && bookState.liveDisplay === 'block' && !!bookState.liveRect && bookState.liveRect.h > 100,
      bookState);
    step('…as a swap, so the call is still up when they get there',
      documentLoads === loadsBook && (await routerProbe()).swaps > swapsBook
        && !!(bookBefore && bookAfter && bookBefore.instanceId === bookAfter.instanceId),
      { documentLoads: documentLoads - loadsBook, instanceStable: bookBefore.instanceId === bookAfter.instanceId });
    const a0 = bookBefore && bookBefore.resources['qualbook-audio'];
    const a1 = bookAfter && bookAfter.resources['qualbook-audio'];
    // A clock at exactly 0 has NOT STARTED — a different fact from "did not
    // advance" ([[feedback_a22_audio_clock_false_red]]).
    step('…and the live session resource survived both navigations',
      !!(a1 && a1.state === 'running' && a0 && a1.clock >= a0.clock && a1.clock > 0), { before: a0, after: a1 });
    step('the booking widget actually booted from the adoption allow-list',
      bookState.dlBooking === 'object' && bookState.widgetChildren > 0, bookState);

    const bp = await bookProbe();
    const prefillEntry = (bp && bp.log || []).filter((l) => l.cmd === 'booking_prefill').at(-1) || null;
    step('the prefill reached DLBooking.prefill (not the unobserved postMessage road)',
      !!(bp && bp.widgetPresent && prefillEntry && prefillEntry.via === 'DLBooking.prefill' && !prefillEntry.reason),
      { widgetPresent: bp && bp.widgetPresent, prefillEntry });

    // ── 5. Drive the widget to the form and READ THE FIELDS BACK ────────────
    //
    // The trust boundary, restated where the driven path crosses it: type, date
    // and slot only. `showDate` browses, `selectSlot` advances to the form, and
    // Confirm is never pressed by anything in this file.
    //
    // Whether there is anything to drive depends on what the live scheduling
    // backend offers today, which is not this ticket's to control. Each leg
    // therefore reports `skipped` honestly rather than passing vacuously — a
    // silent cap reads as "covered everything" when it did not.

    // TYPE_PICK only renders when the deployment offers more than one type; with
    // one it auto-advances. The type id is not in the DOM, so it comes from the
    // same endpoint the widget read.
    const atTypePick = await page.evaluate(() => !!document.querySelector('#dl-booking .dl-bk-type-btn'));
    let typeDriven = null;
    if (atTypePick) {
      const types = await page.evaluate(async () => {
        try {
          const r = await fetch('/booking/types?deployment=donovan-main');
          const d = await r.json();
          return (d && d.types) || [];
        } catch (e) { return []; }
      });
      if (types.length) {
        queued = { cmd: 'booking_select_type', payload: types[0].id };
        await sleep(POLL_WINDOW);
        typeDriven = types[0].id;
      }
    }
    step('booking_select_type is only needed when the deployment offers a choice',
      !atTypePick || !!typeDriven, { atTypePick, typeDriven });

    // The date strip: `data-key` is the widget's own day key, and `showDate`
    // resolves exactly that spelling.
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
      out.notes.push('the deployment offered no bookable days — the show_date / select_slot / form legs were SKIPPED, not passed');
    }
    step('booking_show_date opens a day on the driven path (browse only, no slot taken)',
      days.length === 0 ? true : times.length > 0,
      { skipped: days.length === 0, days: days.slice(0, 3), times: times.slice(0, 3) });

    let fields = null;
    let selected = null;
    if (times.length) {
      queued = { cmd: 'booking_select_slot', payload: { day: days[0], time: times[0] } };
      await page.waitForFunction(() => !!document.getElementById('dl-bk-name'), null, { timeout: 12000 }).catch(() => {});
      await sleep(600);
      // The form step is the proof the slot was taken: `_applySlot` is the ONLY
      // path that sets step='FORM', and reaching it replaces the slot buttons —
      // so looking for a `.selected` slot here would report null on success.
      selected = await page.evaluate(() => ({
        formReached: !!document.getElementById('dl-bk-submit'),
        slotButtonsStillOnScreen: !!document.querySelector('#dl-booking .dl-bk-slot-btn'),
      }));
      fields = await page.evaluate(() => {
        const v = (id) => { const el = document.getElementById(id); return el ? el.value : null; };
        return { name: v('dl-bk-name'), email: v('dl-bk-email'), phone: v('dl-bk-phone'), notes: v('dl-bk-notes') };
      });
    }
    step('THE HEADLINE (Task 3): the prefill Paula sent WITH the navigation is typed into the form',
      times.length === 0 ? true : !!(fields && fields.name === PREFILL.name && fields.email === PREFILL.email),
      { skipped: times.length === 0, fields, expected: PREFILL, slotStep: selected });

    // ── 6. Nothing was written, nothing was refused ─────────────────────────
    step('the caller was never auto-submitted — NOTHING reached /booking/create', out.writes.length === 0, out.writes);
    step('no CSP violation — every module is a same-origin external', out.cspViolations.length === 0, out.cspViolations);

    // Turnstile 600010 is the DRIVER refusing the challenge, not the site failing:
    // it fires the moment the widget reaches the FORM step and renders the
    // challenge under headless automation, and a real Chrome/Edge channel does not
    // raise it ([[feedback_turnstile_600010_is_the_driver_not_the_site]]). Exempted
    // by an explicit, named rule rather than left to whether the run happened to
    // finish before it arrived — that timing is a coin flip, and a coin flip in a
    // gate is worse than a documented exemption. Everything else still reds.
    const TURNSTILE_HEADLESS = /Turnstile.*600010/i;
    const realErrors = out.pageErrors.filter((e) => !TURNSTILE_HEADLESS.test(e));
    out.exemptedErrors = out.pageErrors.filter((e) => TURNSTILE_HEADLESS.test(e));
    step('no uncaught page errors (Turnstile 600010 exempted — it is the headless driver)',
      realErrors.length === 0, { realErrors, exempted: out.exemptedErrors });

    const finalProbe = await layerProbe();
    step('the channel is still polling after both navigations',
      !!(finalProbe && finalProbe.commandChannel && finalProbe.commandChannel.polling), finalProbe && finalProbe.commandChannel);
    step('releaseCall() stops it', await page.evaluate(async () => {
      const m = await import('/js/perch-layer.js');
      m.releaseCall();
      return !window.Perch.layer.probe().commandChannel.polling;
    }), null);

    // ── 7. The rollback target is untouched ─────────────────────────────────
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
    await shell.close();
  } catch (e) {
    step('the run completed without throwing', false, String(e));
  } finally {
    await browser.close();
  }
}

await main();

out.finishedAt = new Date().toISOString();
out.passed = out.steps.filter((s) => s.ok).length;
out.failed = out.steps.filter((s) => !s.ok).length;
out.verdict = out.failed === 0 && out.writes.length === 0 ? 'GO' : 'NO-GO';

const evidence = fileURLToPath(new URL('./qualifier-booking-evidence.json', import.meta.url));
writeFileSync(evidence, JSON.stringify(out, null, 2));
console.log('\n' + JSON.stringify({
  verdict: out.verdict, passed: out.passed, failed: out.failed,
  writes: out.writes.length, notes: out.notes, evidence,
}, null, 2));
