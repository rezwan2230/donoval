// ── SHELDON-PERCH-A31 — the Preview verifier ─────────────────────────────────
//
// Order SHELDON-PERCH-A31-BOOKING-DOM · ticket #56 · Phase A / Phase 3.
//
// Drives a real Chromium against the Preview deployment and records what actually
// happened, so the report cites measurements rather than reasoning.
//
//   node test/preview/verify-a31.mjs [baseUrl]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and the evidence file it writes.
//
// Named `verify-a31.mjs`, not `*.test.mjs`, so `npm test` never runs it: it needs
// a live deployment and a browser, neither of which CI has. It lives under test/
// at the repo root and NOT under donovan-legal-site/, because the Pages deploy
// root is that directory and `wrangler pages deploy` has no --exclude.
//
// ── WHAT IT INJECTS, STATED UP FRONT ─────────────────────────────────────────
// It defines no test-only product globals and patches no shipped module. It does
// three things a passive observer could not:
//
//   1. `await import('/js/perch/booking-control.js')` and calls the SHIPPED
//      adapter. The alternative is a live Retell call, and Turnstile refuses
//      automation by design — see [[feedback_turnstile_not_agent_verifiable]].
//      What this cannot prove is the `router && control.handles(cmd)` branch in
//      js/perch-layer.js that chooses the adapter; that is covered by
//      test/perch-booking-control.test.mjs §6 and by `routerActive` in step 3,
//      which reads the gate's own value out of the live layer.
//   2. Appends one `<a href="/book">` to click, when the start page has no link
//      to /book. Clicking a link is the router's real entry point — Swup's own
//      click delegation — not a harness.
//   3. Writes `localStorage['donovan_booking_unlock']`. That is exactly what
//      js/perch/call.js:151 writes when Paula navigates a qualified caller to
//      /book, and it is the only half of the handshake a call would contribute.
//
// ── NOTHING IS BOOKED ────────────────────────────────────────────────────────
// The verifier never presses Confirm, and every request the page makes is
// recorded: `writes` below must be empty. A negative-path probe that quietly
// booked a real appointment is a mistake this codebase has already made once —
// [[feedback_negative_path_probe_can_write]] — so the assertion is on observed
// network traffic, not on intent.

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] && !process.argv[2].startsWith('--'))
  ? process.argv[2].replace(/\/$/, '')
  // The immutable per-deployment URL, not the branch alias: Pages truncates the
  // alias hostname to 28 characters and this branch name is longer, so
  // `sheldon-perch-a31-booking-do.…` is what it mints. Pinning the deployment
  // hash means the evidence names the exact build it was taken from.
  : 'https://fd6f9f05.donovan-site.pages.dev';

const START = '/contact';   // the 92-page div-box majority shape; carries shared chrome
const BOOK = '/book';

const out = {
  order: 'SHELDON-PERCH-A31-BOOKING-DOM',
  ticket: 56,
  base: BASE,
  startedAt: new Date().toISOString(),
  steps: [],
  writes: [],       // any request to the booking write path. MUST stay empty.
  console: [],
  pageErrors: [],
  cspViolations: [],
};

function step(name, ok, detail) {
  out.steps.push({ name, ok: !!ok, detail: detail === undefined ? null : detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
  if (!ok) console.log('      ' + JSON.stringify(detail));
  return ok;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  page.on('console', (m) => {
    out.console.push({ type: m.type(), text: m.text().slice(0, 300) });
    if (/Content Security Policy|Refused to/i.test(m.text())) {
      out.cspViolations.push(m.text().slice(0, 400));
    }
  });
  page.on('pageerror', (e) => out.pageErrors.push(String(e).slice(0, 300)));
  page.on('request', (r) => {
    const u = r.url();
    if (/\/booking\/create/.test(u)) out.writes.push({ url: u, method: r.method() });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // ROUTER ON — the direct-DOM path
  // ───────────────────────────────────────────────────────────────────────────

  await page.goto(BASE + START, { waitUntil: 'networkidle' });

  const router = await page.evaluate(() => (window.Perch && window.Perch.router
    ? window.Perch.router.probe() : null));
  step('1. the router is injected and ready on Preview',
    !!router && router.ready === true && router.layerRouterRegistered === true,
    router && { ready: router.ready, container: router.container, layerRouterRegistered: router.layerRouterRegistered, errors: router.errors });

  // The whole point: one document, no frame. perch-inject.js is the iframe-only
  // executor, so its single-session guard being absent is the observable proof it
  // never ran here.
  const frameState = await page.evaluate(() => ({
    topLevel: window.top === window.self,
    iframes: document.querySelectorAll('iframe').length,
    perchInjected: !!window.__perchInjected,
  }));
  step('2. no iframe and no perch-inject.js in this document',
    frameState.topLevel && frameState.iframes === 0 && frameState.perchInjected === false,
    frameState);

  const probe0 = await page.evaluate(() => (window.Perch && window.Perch.layer
    ? window.Perch.layer.bookingProbe() : null));
  step('3. the layer reports the direct path armed (routerActive is the gate itself)',
    !!probe0 && probe0.routerActive === true,
    probe0 && { routerActive: probe0.routerActive, widgetPresent: probe0.widgetPresent, gatePublished: probe0.gatePublished });

  // The unlock write half — what js/perch/call.js:151 does before host.go().
  await page.evaluate(() => localStorage.setItem('donovan_booking_unlock', String(Date.now())));

  const layerBefore = await page.evaluate(() => window.Perch.layer.probe().instanceId);

  // Soft-navigate to /book by clicking a link: Swup's own entry point.
  const linked = await page.evaluate((book) => {
    const a = [...document.querySelectorAll('a[href]')]
      .find((x) => new URL(x.getAttribute('href'), location.href).pathname.replace(/\.html$/, '') === book);
    if (a) { a.click(); return 'existing-link'; }
    const made = document.createElement('a');
    made.href = book; made.textContent = 'book';
    document.querySelector('main#perch-main').appendChild(made);
    made.click();
    return 'appended-link';
  }, BOOK);
  await page.waitForFunction((b) => location.pathname.replace(/\.html$/, '') === b, BOOK, { timeout: 15000 })
    .catch(() => {});
  await sleep(2500);

  const afterNav = await page.evaluate(() => ({
    path: location.pathname,
    instanceId: window.Perch.layer.probe().instanceId,
    swaps: window.Perch.router.probe().swaps,
    iframes: document.querySelectorAll('iframe').length,
    perchInjected: !!window.__perchInjected,
  }));
  step('4. /book arrived by content swap, in the same document, still no iframe',
    afterNav.path.replace(/\.html$/, '') === BOOK
      && afterNav.swaps >= 1
      && afterNav.instanceId === layerBefore
      && afterNav.iframes === 0
      && afterNav.perchInjected === false,
    { via: linked, ...afterNav, layerBefore });

  // §3.3 — the reveal, through DL.ready on the swap. No inline script ran.
  const gate = await page.evaluate(() => {
    const g = document.getElementById('book-gate');
    const l = document.getElementById('book-live');
    return {
      gate: g ? getComputedStyle(g).display : null,
      live: l ? getComputedStyle(l).display : null,
      widgetBooted: !!document.querySelector('#dl-booking[data-api-init]'),
    };
  });
  step('5. the unlock gate revealed the form (§3.3, through DL.ready on the swap)',
    gate.gate === 'none' && gate.live !== 'none' && gate.widgetBooted === true, gate);

  // Wait for the widget to finish loading real appointment types.
  await page.waitForFunction(() => window.DLBooking
    && window.DLBooking.getState()
    && window.DLBooking.getState().step !== 'LOADING', { timeout: 20000 }).catch(() => {});

  const probe1 = await page.evaluate(() => window.Perch.layer.bookingProbe());
  step('6. the widget API and the published gate are both reachable in this document',
    probe1.widgetPresent === true && probe1.gatePublished === true
      && ['prefill', 'selectType', 'selectSlot', 'showDate'].every((m) => probe1.methods.includes(m)),
    { widgetPresent: probe1.widgetPresent, gatePublished: probe1.gatePublished, methods: probe1.methods });

  // ── Every Task 1 command, through the SHIPPED adapter, by direct DOM ───────
  const drive = await page.evaluate(async () => {
    const { createBookingControl } = await import('/js/perch/booking-control.js');
    const c = createBookingControl(window, document);
    const res = { steps: [] };
    const snap = (label) => {
      const s = window.DLBooking.getState();
      res.steps.push({
        label,
        step: s.step,
        selectedDay: s.selectedDay,
        selectedSlot: s.selectedSlot ? s.selectedSlot.startISO : null,
        prefill: { ...s.prefill },
      });
    };

    // set_call_id — the join that carries the live call into the Clio description.
    res.setCallId = c.apply('set_call_id', { call_id: 'a31-preview-probe' });
    res.perchCallId = window.__perchCallId;

    // booking_prefill
    res.prefill = c.apply('booking_prefill', {
      name: 'A31 Preview Probe',
      email: 'a31-probe@example.invalid',
      phone: '(561) 555-0142',
      notes: 'SHELDON-PERCH-A31 verification — not a real enquiry',
    });
    res.acked = res.prefill.acked;
    snap('after prefill');

    // booking_select_type — the id has to come from the same list the widget
    // loaded (the buttons carry only `data-idx`), so read it from the same public
    // GET /booking/types the widget itself made. A guessed id would prove nothing.
    const box = document.getElementById('dl-booking');
    const apiBase = (box.getAttribute('data-api') || '').replace(/\/$/, '');
    const deployment = box.getAttribute('data-deployment') || 'donovan-main';
    const typesResp = await fetch(apiBase + '/booking/types?deployment=' + encodeURIComponent(deployment))
      .then((r) => r.json()).catch(() => ({}));
    res.types = (typesResp.types || []).map((t) => t.id);
    res.typeId = res.types[0] || null;
    if (res.typeId) {
      res.selectType = c.apply('booking_select_type', res.typeId);
      for (let i = 0; i < 60 && window.DLBooking.getState().step === 'LOADING'; i++) {
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    snap('after selectType');

    // booking_show_date — use a day the live calendar actually offers, read off
    // the rendered date strip so this is not a guess about Paul's availability.
    const dayEl = document.querySelector('#dl-booking .dl-bk-date-btn');
    res.day = dayEl ? dayEl.getAttribute('data-key') : null;
    res.daysOffered = document.querySelectorAll('#dl-booking .dl-bk-date-btn').length;
    if (res.day) res.showDate = c.apply('booking_show_date', { day: res.day });
    await new Promise((r) => setTimeout(r, 400));
    snap('after showDate');
    res.timeButtonsVisible = document.querySelectorAll('#dl-booking .dl-bk-slot-btn').length;

    // booking_select_slot — the {day, time} form, which is what Paula actually
    // sends (do_page_action.js sanitises to {day,time} for every natural call).
    // The time string is the button's own label, so the match runs against a slot
    // really on screen, in the widget's display timezone.
    const slotEl = document.querySelector('#dl-booking .dl-bk-slot-btn');
    res.slotTime = slotEl ? slotEl.textContent.trim() : null;
    if (res.slotTime) res.selectSlot = c.apply('booking_select_slot', { day: res.day, time: res.slotTime });
    await new Promise((r) => setTimeout(r, 500));
    snap('after selectSlot');

    // The form fields, as the caller would see them.
    const val = (id) => { const e = document.querySelector(id); return e ? e.value : null; };
    res.formValues = {
      name: val('#dl-bk-name'), email: val('#dl-bk-email'),
      phone: val('#dl-bk-phone'), notes: val('#dl-bk-notes'),
    };
    res.log = c.probe().log;
    return res;
  });

  step('7a. set_call_id landed on window.__perchCallId by direct DOM',
    drive.perchCallId === 'a31-preview-probe', { perchCallId: drive.perchCallId });

  const afterPrefill = drive.steps.find((s) => s.label === 'after prefill');
  step('7b. booking_prefill was accepted and acked (so call.js stops re-delivering)',
    !!afterPrefill && Object.values(afterPrefill.prefill).every(Boolean) && drive.acked === true,
    { prefill: afterPrefill && afterPrefill.prefill, acked: drive.acked });

  const afterType = drive.steps.find((s) => s.label === 'after selectType');
  step('7c. booking_select_type loaded availability for a real appointment type',
    !!drive.typeId && !!afterType && afterType.step === 'DATE_PICK',
    { typeId: drive.typeId, step: afterType && afterType.step, result: drive.selectType });

  const afterShow = drive.steps.find((s) => s.label === 'after showDate');
  step('7d. booking_show_date OPENED a real date and did NOT advance to FORM',
    !!drive.day && !!afterShow && afterShow.step === 'DATE_PICK'
      && afterShow.selectedSlot === null && !!afterShow.selectedDay
      && drive.timeButtonsVisible > 0,
    { day: drive.day, step: afterShow && afterShow.step, selectedDay: afterShow && afterShow.selectedDay,
      selectedSlot: afterShow && afterShow.selectedSlot, timeButtons: drive.timeButtonsVisible, result: drive.showDate });

  const afterSlot = drive.steps.find((s) => s.label === 'after selectSlot');
  step('7e. booking_select_slot selected a real slot and advanced to FORM',
    !!drive.slotTime && !!afterSlot && afterSlot.step === 'FORM' && !!afterSlot.selectedSlot,
    { day: drive.day, time: drive.slotTime, step: afterSlot && afterSlot.step,
      selected: afterSlot && afterSlot.selectedSlot, result: drive.selectSlot });

  step('7f. the prefilled values reached the real form inputs',
    drive.formValues.name === 'A31 Preview Probe'
      && drive.formValues.email === 'a31-probe@example.invalid'
      && drive.formValues.phone === '(561) 555-0142'
      && !!drive.formValues.notes,
    drive.formValues);

  // ── The same-URL reveal: the one case DL.ready cannot see ─────────────────
  const sameUrl = await page.evaluate(() => {
    const g = document.getElementById('book-gate');
    const l = document.getElementById('book-live');
    g.style.display = 'block'; l.style.display = 'none';   // re-lock the view
    const before = { gate: getComputedStyle(g).display, live: getComputedStyle(l).display };
    const r = window.DL.revealBookingGate();               // the published gate, called directly
    return { before, result: r, after: { gate: getComputedStyle(g).display, live: getComputedStyle(l).display } };
  });
  step('8. DL.revealBookingGate() re-opens the form for a same-URL navigate',
    sameUrl.before.live === 'none' && sameUrl.result.revealed === true && sameUrl.after.live !== 'none',
    sameUrl);

  // ── Nothing auto-submitted ────────────────────────────────────────────────
  const confirmState = await page.evaluate(() => {
    const b = document.querySelector('#dl-booking button[type="submit"]');
    return { confirmPresent: !!b, confirmLabel: b ? b.textContent.trim().slice(0, 40) : null, step: window.DLBooking.getState().step };
  });
  step('9. the caller is standing at an unpressed Confirm button and nothing was written',
    out.writes.length === 0 && confirmState.confirmPresent === true && confirmState.step === 'FORM',
    { writes: out.writes, ...confirmState });

  // ───────────────────────────────────────────────────────────────────────────
  // ROUTER OFF — the iframe postMessage path, unchanged
  // ───────────────────────────────────────────────────────────────────────────
  //
  // perch.html is the shell. A0.1 gives it no swap container, so neither the
  // router nor the layer mounts there — it is the router-off case by
  // construction, not by a flag this verifier flipped. The commands below are the
  // exact envelope js/page/perch-shell.js `drive()` posts into `site.contentWindow`.

  const shell = await ctx.newPage();
  shell.on('request', (r) => { if (/\/booking\/create/.test(r.url())) out.writes.push({ url: r.url(), method: r.method(), where: 'shell' }); });
  await shell.goto(BASE + '/perch.html', { waitUntil: 'networkidle' });

  const shellState = await shell.evaluate(() => ({
    hasRouter: !!(window.Perch && window.Perch.router),
    hasLayer: !!(window.Perch && window.Perch.layer),
    hasContainer: !!document.getElementById('perch-main'),
    iframes: document.querySelectorAll('iframe').length,
  }));
  step('10. the shell runs with no router and no layer — the production path',
    shellState.hasRouter === false && shellState.hasLayer === false && shellState.iframes >= 1,
    shellState);

  const pm = await shell.evaluate(async () => {
    const site = document.getElementById('site') || document.querySelector('iframe');
    const post = (cmd, target, payload) =>
      site.contentWindow.postMessage({ type: 'perch', cmd, target, payload }, location.origin);

    // The unlock write half — perch.html does this itself on a polled navigate.
    try { localStorage.setItem('donovan_booking_unlock', String(Date.now())); } catch (e) {}
    try { site.contentWindow.localStorage.setItem('donovan_booking_unlock', String(Date.now())); } catch (e) {}

    post('navigate', '/book.html');

    // js/page/perch-shell.js appends /perch-inject.js on the iframe's `load`
    // event, so each navigation leaves a window where the executor is not yet
    // running and a single postMessage is lost. That race is real — it is why
    // js/perch/call.js re-delivers prefill for ~4.2 s — so wait for the executor
    // rather than racing it, and report how long it took.
    const t0 = Date.now();
    let injected = false;
    for (let i = 0; i < 120; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try { if (site.contentWindow.__perchInjected) { injected = true; break; } } catch (e) { /* mid-load */ }
    }
    const injectDelayMs = Date.now() - t0;
    for (let i = 0; i < 80; i++) {
      await new Promise((r) => setTimeout(r, 250));
      try { if (site.contentWindow.DLBooking && site.contentWindow.DLBooking.getState()) break; } catch (e) {}
    }
    const w = site.contentWindow;

    post('set_call_id', null, { call_id: 'a31-preview-shell' });
    post('booking_prefill', null, { name: 'A31 Shell Probe', email: 'a31-shell@example.invalid', phone: '(561) 555-0143' });
    await new Promise((r) => setTimeout(r, 1200));

    const s = w.DLBooking ? w.DLBooking.getState() : null;
    return {
      path: w.location.pathname,
      perchInjected: injected,
      injectDelayMs,
      callId: w.__perchCallId,
      prefill: s ? { ...s.prefill } : null,
      liveDisplay: (() => { const l = w.document.getElementById('book-live'); return l ? w.getComputedStyle(l).display : null; })(),
    };
  });
  step('11. the iframe postMessage path still works unchanged with the router off',
    pm.perchInjected === true
      && /book/.test(pm.path)
      && pm.callId === 'a31-preview-shell'
      && !!pm.prefill && pm.prefill.name && pm.prefill.email && pm.prefill.phone,
    pm);

  step('12. nothing anywhere in this run wrote to the booking path',
    out.writes.length === 0, { writes: out.writes });

  await browser.close();

  out.finishedAt = new Date().toISOString();
  out.pass = out.steps.every((s) => s.ok);
  out.failed = out.steps.filter((s) => !s.ok).map((s) => s.name);

  const evidence = fileURLToPath(new URL('./a31-evidence.json', import.meta.url));
  writeFileSync(evidence, JSON.stringify(out, null, 2));
  console.log('\n' + JSON.stringify({
    verdict: out.pass ? 'PASS' : 'FAIL',
    base: BASE,
    steps: out.steps.length,
    failed: out.failed,
    writes: out.writes.length,
    cspViolations: out.cspViolations.length,
    pageErrors: out.pageErrors.length,
    evidence,
  }, null, 2));
}

main().catch((e) => {
  out.fatal = String(e && e.stack ? e.stack : e);
  console.error('verifier crashed:', out.fatal);
  const evidence = fileURLToPath(new URL('./a31-evidence.json', import.meta.url));
  writeFileSync(evidence, JSON.stringify(out, null, 2));
});
