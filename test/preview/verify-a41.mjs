// ── SARAH-PERCH-A41 — the broadened CUTOVER verifier ─────────────────────────
//
// Order SARAH-PERCH-A41-CUTOVER-QA · ticket #60 · Phase A / Phase 4.
// THIS SUITE GATES THE PROMOTE. It does not gate a build.
//
// ── A4.1 RE-RUN (order SARAH-PERCH-A41-RERUN) ────────────────────────────────
// The first run, on PR #80, returned NO-GO against Preview 4030e743 @ 3e46c9b.
// Neither blocker was a defect in the A3.1 rewire; both were unshipped
// dependencies of #60, and both are now merged to main:
//
//   #57 → dffcd5c (PR #82)  call_id bound to a server-written qualifier record
//   #58 → 645e37e (PR #83)  the layer control surface de-exposed from window
//
// §T4 is rewritten from "FINDING" steps that recorded the open state to CLOSED
// steps that assert it shut, and T4.3b/T4.3c are NEW: they attack the live page
// rather than enumerating it, because "cannot be reassigned" is a claim about
// property descriptors and "the original router still runs" is a claim about a
// module-private slot — an enumeration can see neither.
//
//   node test/preview/verify-a41.mjs [baseUrl]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and test/preview/a41-evidence.json.
//
// Named `verify-a41.mjs`, not `*.test.mjs`, so `npm test` never runs it: it needs
// a live deployment and a real browser, neither of which CI has. Same reasoning,
// same directory and same shape as SHELDON's verify-a22.mjs / verify-a31.mjs.
//
// ── THE ROUTER IS ON HERE BY CONSTRUCTION, NOT BY A FLAG THIS FILE SET ────────
// functions/_lib/perch-router-inject.js:85 enables the router for any
// `*.pages.dev` hostname. A Preview deployment IS that hostname, so every page
// below is the router-on path. Step 1 reads the gate's own value out of the live
// layer rather than assuming it.
//
// ── NOTHING IS BOOKED. THE ACCOUNTING, NOT THE INTENT ────────────────────────
// POST /booking/create writes a real entry to Paul Donovan's live Clio calendar
// and a real lead into Vantage. There is no sandbox behind Preview. This repo has
// already booked a real appointment once from a probe that believed it was on an
// error path — [[feedback_negative_path_probe_can_write]].
//
// So §T2 and §T3, which DO press Confirm because that is the only way to observe
// a double-book, are protected by a context-level route registered BEFORE the
// first page exists. Every request to the write path is answered inside the
// browser by `route.fulfill()`, which never opens a socket to the origin. The
// final step does not assert intent: it reconciles two independently collected
// counters — every /booking/create request the page made, and every one this file
// intercepted — and fails unless they are equal. A request that escaped the route
// would be visible as a difference.
//
// ── WHAT THIS INJECTS, STATED UP FRONT ───────────────────────────────────────
// It defines no test-only product globals and patches no shipped module.
//   1. `Perch.layer.attachLiveResource()` — the layer's OWN published seam for
//      "a live resource that must survive a swap" (js/perch-layer.js:212), which
//      has no in-tree caller yet. A real Retell call cannot be driven from
//      automation — Turnstile refuses it by design,
//      [[feedback_turnstile_not_agent_verifiable]] — so an AudioContext is
//      registered through that seam instead. It is a WebRTC-grade proxy: same
//      audio pipeline, same realm, its own monotonic clock. A document teardown
//      takes it with it exactly as it would take a call.
//   2. `import('/js/perch-layer.js').mountShellConcierge()` — the shipped seam for
//      the state where `/` stops iframing the site. The qualifier modal lives only
//      on the shell today, so this is how the cross-page qualifier flow is
//      reachable on the router path before A5 flips `/`.
//      #58 moved this from `Perch.layer.mountShellConcierge()` to a MODULE export;
//      its header keeps it importable expressly so this path stays testable. The
//      concierge it returns is stashed on the harness's own `window.__A41` — never
//      on `window.Perch`, which is non-extensible now and would throw.
//   3. `await import('/js/perch/booking-control.js')` and calls the SHIPPED
//      adapter — same as verify-a31.mjs step 7, for the same reason.
//   4. `localStorage['donovan_booking_unlock']` — exactly what js/perch/call.js:151
//      writes before host.go('/book.html'). The only half of the handshake a call
//      would contribute.
//
// ── WHAT IT CANNOT PROVE, SO THE SIGN-OFF DOES NOT CLAIM IT ──────────────────
//   • That a REAL Retell call survives. See (1): the proxy is a live audio clock
//     and the un-re-executed concierge holder, not a call.
//   • That Clio's UI renders the description Paul reads. §T3 proves the id is in
//     the POST body; test/perch-cutover-callid.test.mjs proves every server hop
//     after that. The last inch is one human-executed booked call.

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] && !process.argv[2].startsWith('--'))
  ? process.argv[2].replace(/\/$/, '')
  : process.env.A41_BASE_URL
  // The branch alias. `sarah/perch-a41-cutover-qa` → `sarah-perch-a41-cutover-qa`,
  // 26 characters — inside the 28-character hostname truncation Pages applies, so
  // unlike A31's branch this one does not need a pinned deployment hash to be
  // reachable. Pass the immutable per-deployment URL as argv[2] to pin evidence
  // to one exact build.
  || 'https://sarah-perch-a41-cutover-qa.donovan-site.pages.dev';

const START = '/contact';   // the 92-page div-box majority shape; carries shared chrome
const SECOND = '/blog';     // a second interceptable page, for back/forward
const BOOK = '/book';

const out = {
  order: 'SARAH-PERCH-A41-CUTOVER-QA',
  ticket: 60,
  gates: 'PROMOTE',
  base: BASE,
  startedAt: new Date().toISOString(),
  steps: [],
  bookingRequests: [],   // every /booking/create request the browser made
  intercepted: [],       // every one this file answered inside the browser
  console: [],
  pageErrors: [],
  cspViolations: [],
  notes: [],
};

function step(id, name, ok, detail) {
  out.steps.push({ id, name, ok: !!ok, detail: detail === undefined ? null : detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${name}`);
  if (!ok) console.log('      ' + JSON.stringify(detail));
  return ok;
}
const note = (t) => { out.notes.push(t); console.log('note  ' + t); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isWrite = (u) => /\/booking\/create/.test(u);

/** Wire the observers every page in this run shares. */
function watch(page, where) {
  page.on('console', (m) => {
    const t = m.text().slice(0, 300);
    out.console.push({ where, type: m.type(), text: t });
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(t)) {
      out.cspViolations.push({ where, text: m.text().slice(0, 400) });
    }
  });
  page.on('pageerror', (e) => out.pageErrors.push({ where, error: String(e).slice(0, 300) }));
  page.on('request', (r) => { if (isWrite(r.url())) out.bookingRequests.push({ where, url: r.url(), method: r.method() }); });
}

/**
 * Register the AudioContext as a live resource through the layer's own seam, and
 * make sure it is genuinely RUNNING before anything is measured.
 *
 * A clock reading 0 means NOT STARTED, not stalled — reporting that as a stall is
 * a false red this project has already produced once
 * ([[feedback_a22_audio_clock_false_red]]). So this returns the state as well as
 * the reading, and the caller asserts `state === 'running' && clock > 0` as a
 * PRECONDITION before the swap, never as the result.
 */
async function armLiveResource(page) {
  return page.evaluate(async () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return { armed: false, why: 'no AudioContext in this browser' };
    const ac = new AC();
    // Keep it doing real work: a silent oscillator through a zeroed gain node, so
    // the graph is live rather than merely constructed.
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(ac.destination);
    osc.start();
    try { await ac.resume(); } catch (e) { /* autoplay policy — reported below */ }
    window.Perch.layer.attachLiveResource('a41-audio', {
      clock: () => ac.currentTime,
      state: () => ac.state,
    });
    // POLL until the clock has actually moved off zero. A fixed sleep is what
    // produced the first false red on this run: `state` was already 'running'
    // while `currentTime` was still 0, because Chromium advances the audio clock
    // on the audio thread's first render quantum, not on resume(). Waiting for the
    // reading itself is the only honest precondition.
    const t0 = Date.now();
    while (ac.currentTime === 0 && Date.now() - t0 < 8000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return { armed: true, state: ac.state, clock: ac.currentTime, waitedMs: Date.now() - t0 };
  });
}

/**
 * Count the script elements a re-execution defect would create.
 *
 * Passed to page.evaluate() as a function value — it is never assigned to
 * `window`, so this file still defines no product globals.
 *
 * `application/ld+json` is EXCLUDED, and that exclusion is the second false red
 * this run produced: /contact carries one nonced JSON-LD block (the A0.2-era
 * LegalService schema, nonced because the middleware nonces every inline block).
 * It is structured data, not code — the browser never executes it — so counting it
 * as "a nonced script" made a shipped, correct page look like a re-nonce.
 *
 * The invariant is a DELTA, not an absolute: the original document is allowed to
 * carry whatever inline blocks it shipped with. What must never happen is a SWAP
 * ADDING one, because that is the shape of "the router re-created an inline script
 * from fetched HTML and gave it a nonce".
 */
const SCRIPT_CENSUS = () => {
  const executable = (s) => {
    const t = (s.getAttribute('type') || '').toLowerCase();
    return t === '' || t === 'module' || /javascript|ecmascript/.test(t);
  };
  const all = [...document.querySelectorAll('script')];
  const inline = all.filter((s) => !s.hasAttribute('src') && executable(s));
  return {
    inlineExecutable: inline.length,
    inlineNonced: inline.filter((s) => s.hasAttribute('nonce')).length,
    dataBlocks: all.filter((s) => !executable(s)).length,
    // A src-bearing element that also carries a body is the signature of an
    // adopted tag that had its inline content copied along with it.
    hybridScripts: all.filter((s) => s.hasAttribute('src') && (s.textContent || '').trim().length > 0).length,
    externalCount: all.filter((s) => s.hasAttribute('src')).length,
  };
};

const liveRead = (page) => page.evaluate(() => {
  const p = window.Perch.layer.probe();
  return {
    instanceId: p.instanceId,
    ticks: p.ticks,
    uptimeMs: p.uptimeMs,
    audio: p.resources && p.resources['a41-audio'],
    concierge: p.concierge,
    callLive: p.callLive,
  };
});

/** Soft-navigate by CLICKING a link — Swup's own entry point, not a harness. */
async function softNavigate(page, to) {
  const how = await page.evaluate((dest) => {
    const match = (el) => {
      try { return new URL(el.getAttribute('href'), location.href).pathname.replace(/\.html$/, '') === dest; }
      catch (e) { return false; }
    };
    const a = [...document.querySelectorAll('a[href]')].find(match);
    if (a) { a.click(); return 'existing-link'; }
    const made = document.createElement('a');
    made.href = dest; made.textContent = dest;
    document.querySelector('main#perch-main').appendChild(made);
    made.click();
    return 'appended-link';
  }, to);
  await page.waitForFunction((d) => location.pathname.replace(/\.html$/, '') === d, to, { timeout: 20000 })
    .catch(() => {});
  await sleep(1800);
  return how;
}

async function main() {
  const browser = await chromium.launch({
    args: ['--autoplay-policy=no-user-gesture-required'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // ── THE WRITE-PATH INTERCEPT, BEFORE ANY PAGE EXISTS ──────────────────────
  // Context level, so every page and popup in this run is covered by
  // construction rather than by remembering to register it. `route.fulfill()`
  // answers inside the browser; no socket is opened to the origin.
  let holdWrite = null;                 // set to a Promise to keep a POST in flight
  await ctx.route('**/booking/create*', async (route) => {
    const req = route.request();
    let body = null;
    try { body = req.postDataJSON(); } catch (e) { body = { unparsed: (req.postData() || '').slice(0, 500) }; }
    out.intercepted.push({ url: req.url(), method: req.method(), body });
    if (holdWrite) await holdWrite;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, confirmed: true, booking_id: 'A41-INTERCEPTED-NEVER-SENT' }),
    });
  });

  const page = await ctx.newPage();
  watch(page, 'main');

  // ═════════════════════════════════════════════════════════════════════════
  // §T0 — the deployment under test really is the router-on cutover build
  // ═════════════════════════════════════════════════════════════════════════
  await page.goto(BASE + START, { waitUntil: 'networkidle' });

  const boot = await page.evaluate(() => ({
    router: window.Perch && window.Perch.router ? window.Perch.router.probe() : null,
    layer: window.Perch && window.Perch.layer ? window.Perch.layer.probe() : null,
    booking: window.Perch && window.Perch.layer ? window.Perch.layer.bookingProbe() : null,
    iframes: document.querySelectorAll('iframe').length,
    perchInjected: !!window.__perchInjected,
    topLevel: window.top === window.self,
  }));
  step('T0.1', 'the router is injected, ready and registered with the layer',
    !!boot.router && boot.router.ready === true && boot.router.layerRouterRegistered === true,
    boot.router && { ready: boot.router.ready, container: boot.router.container, registered: boot.router.layerRouterRegistered, errors: boot.router.errors });

  step('T0.2', 'the direct-DOM booking path is ARMED (routerActive is the gate itself)',
    !!boot.booking && boot.booking.routerActive === true,
    boot.booking && { routerActive: boot.booking.routerActive, gatePublished: boot.booking.gatePublished });

  step('T0.3', 'one document, no iframe, no perch-inject.js',
    boot.topLevel && boot.iframes === 0 && boot.perchInjected === false,
    { iframes: boot.iframes, perchInjected: boot.perchInjected, topLevel: boot.topLevel });

  // The baseline the §T4.4 delta is measured against — taken on the FIRST load,
  // before any swap has happened.
  const censusAtBoot = await page.evaluate(SCRIPT_CENSUS);

  step('T0.4', 'the persistent layer holds exactly one concierge',
    !!boot.layer && boot.layer.concierge.count === 1 && boot.layer.concierge.allInLayer === true
      && boot.layer.concierge.insideContainer === false,
    boot.layer && boot.layer.concierge);

  // ═════════════════════════════════════════════════════════════════════════
  // §T1 — the live call survives
  // ═════════════════════════════════════════════════════════════════════════
  const armed = await armLiveResource(page);
  step('T1.0', 'PRECONDITION — a live audio resource is running and its clock is advancing',
    armed.armed === true && armed.state === 'running' && armed.clock > 0,
    armed);
  note('T1 proxies a Retell call with a live AudioContext registered through '
    + 'Perch.layer.attachLiveResource(). A clock of 0 would mean NOT STARTED, so it is '
    + 'asserted > 0 as a precondition before every swap, never afterwards as the result.');

  const before1 = await liveRead(page);
  const nav1 = await softNavigate(page, SECOND);
  const after1 = await liveRead(page);
  step('T1.1', 'the call survives PLAIN NAVIGATION (same layer closure, clock still advancing)',
    after1.instanceId === before1.instanceId
      && after1.audio && after1.audio.state === 'running'
      && after1.audio.clock > before1.audio.clock
      && after1.concierge.count === 1 && after1.concierge.allInLayer === true,
    { via: nav1, path: await page.evaluate(() => location.pathname),
      instanceId: { before: before1.instanceId, after: after1.instanceId },
      clock: { before: before1.audio && before1.audio.clock, after: after1.audio && after1.audio.clock },
      concierge: after1.concierge });

  // Mid-call: navigate to /book and open the booking form.
  await page.evaluate(() => localStorage.setItem('donovan_booking_unlock', String(Date.now())));
  const before2 = await liveRead(page);
  const nav2 = await softNavigate(page, BOOK);
  await page.waitForFunction(() => window.DLBooking && window.DLBooking.getState()
    && window.DLBooking.getState().step !== 'LOADING', { timeout: 25000 }).catch(() => {});
  const after2 = await liveRead(page);
  const modal = await page.evaluate(() => {
    const g = document.getElementById('book-gate');
    const l = document.getElementById('book-live');
    return {
      gate: g ? getComputedStyle(g).display : null,
      live: l ? getComputedStyle(l).display : null,
      widgetBooted: !!document.querySelector('#dl-booking[data-api-init]'),
      step: window.DLBooking ? window.DLBooking.getState().step : null,
    };
  });
  step('T1.2', 'the call survives OPENING THE BOOKING MODAL mid-call, and the form really opened',
    after2.instanceId === before2.instanceId
      && after2.audio && after2.audio.state === 'running' && after2.audio.clock > before2.audio.clock
      && modal.gate === 'none' && modal.live !== 'none' && modal.widgetBooted === true,
    { via: nav2, ...modal, clock: { before: before2.audio && before2.audio.clock, after: after2.audio && after2.audio.clock },
      instanceId: after2.instanceId });

  // Cross-page qualifier: the modal lives in the shell concierge, which the layer
  // publishes a seam to mount. Open it, answer a step, swap pages, keep answering.
  //
  // ── REWIRED FOR #58 ────────────────────────────────────────────────────────
  // This block used to reach `window.Perch.layer.mountShellConcierge()` and read
  // `.concierge` / `.qualifier` / `.root` off the published instance. #58 withdrew
  // all four — they are exactly the control handles it removed — so the old harness
  // crashed here with `l.mountShellConcierge is not a function`. That is the fix
  // working, not a regression: the first re-run attempt failed on this line and the
  // sign-off records it.
  //
  // The replacement uses the seams #58 deliberately LEFT open:
  //   • `import('/js/perch-layer.js').mountShellConcierge()` — a module export, not
  //     a window property. Its header states it stays importable precisely so this
  //     path "stays live and testable rather than rotting behind a comment".
  //   • the real DOM — `#perch-persistent` (LAYER_ID) and `#perch-main`
  //     (CONTAINER_ID) from js/perch/placement.js — instead of `layer.root`, which
  //     was a live node the layer no longer hands out.
  //
  // The returned concierge is stashed on the harness's own `window.__A41`, never on
  // a product namespace: `window.Perch` is non-extensible now, so a harness that
  // tried would throw — correctly.
  const qual = await page.evaluate(async () => {
    const mod = await import('/js/perch-layer.js');
    if (typeof mod.mountShellConcierge !== 'function') return { mounted: false, why: 'module export missing' };
    const concierge = mod.mountShellConcierge();
    if (!concierge || !concierge.qualifier) return { mounted: false, why: 'no qualifier' };
    (window.__A41 = window.__A41 || {}).qualifier = concierge.qualifier;

    concierge.qualifier.openQualifier('en', 'a41-preview');
    await new Promise((r) => setTimeout(r, 400));
    const root = concierge.qualifier.root;
    const layerRoot = document.getElementById('perch-persistent');
    const container = document.getElementById('perch-main');
    const firstOpt = root.querySelector('.opt[data-v]');
    return {
      mounted: true,
      open: root.classList.contains('show'),
      // Asserted against the DOM, which is stronger than asking the layer where it
      // put its own node.
      inLayer: !!(layerRoot && layerRoot.contains(root)),
      insideContainer: !!(container && container.contains(root)),
      rootId: root.id,
      firstOption: firstOpt ? firstOpt.getAttribute('data-v') : null,
    };
  });
  step('T1.3a', 'the qualifier opens on the router path and lives OUTSIDE the swap container',
    qual.mounted === true && qual.open === true && qual.inLayer === true && qual.insideContainer === false,
    qual);

  const beforeQ = await liveRead(page);
  // Answer the first step, then swap to another page mid-flow.
  //
  // Reads go through the harness's own reference (stashed above) and the DOM, not
  // through `Perch.layer.qualifier` — #58 withdrew that getter.
  await page.evaluate(() => {
    const b = window.__A41.qualifier.root.querySelector('.opt[data-v]');
    if (b) b.click();
  });
  await sleep(400);
  const midQ = await page.evaluate(() => {
    const r = window.__A41.qualifier.root;
    return { open: r.classList.contains('show'), stepText: (r.querySelector('.step') || {}).textContent || null };
  });
  const nav3 = await softNavigate(page, START);
  const afterQ = await page.evaluate(() => {
    // The node is re-found by ID from the LIVE document rather than trusted from
    // the stashed handle: a handle to a detached node would still answer, and
    // "the node survived the swap" is the whole claim. `document.contains` is
    // then a real check rather than a tautology.
    const r = document.getElementById('qual');
    const stashed = window.__A41.qualifier.root;
    const p = window.Perch.layer.probe();
    return {
      stillMounted: !!r && document.contains(r),
      sameNode: r === stashed,           // not re-created by the swap
      open: !!r && r.classList.contains('show'),
      stepText: r ? ((r.querySelector('.step') || {}).textContent || null) : null,
      inLayer: !!(document.getElementById('perch-persistent') || { contains: () => false }).contains(r),
      instanceId: p.instanceId,
      audio: p.resources['a41-audio'],
    };
  });
  step('T1.3b', 'a CROSS-PAGE qualifier flow keeps its place, its DOM and the live call across the swap',
    afterQ.stillMounted === true && afterQ.open === true
      && afterQ.sameNode === true && afterQ.inLayer === true
      && afterQ.stepText === midQ.stepText
      && afterQ.instanceId === beforeQ.instanceId
      && afterQ.audio && afterQ.audio.clock > beforeQ.audio.clock,
    { via: nav3, mid: midQ, after: afterQ, clockBefore: beforeQ.audio && beforeQ.audio.clock });

  // ═════════════════════════════════════════════════════════════════════════
  // §T2 — swap during an in-flight POST, back/forward, mobile, first-load parity
  // ═════════════════════════════════════════════════════════════════════════
  await page.evaluate(() => localStorage.setItem('donovan_booking_unlock', String(Date.now())));
  await softNavigate(page, BOOK);
  await page.waitForFunction(() => window.DLBooking && window.DLBooking.getState()
    && window.DLBooking.getState().step !== 'LOADING', { timeout: 25000 }).catch(() => {});

  // Walk to the FORM step through the SHIPPED adapter, with real availability.
  const walked = await page.evaluate(async () => {
    const { createBookingControl } = await import('/js/perch/booking-control.js');
    const c = createBookingControl(window, document);
    const res = {};
    res.callId = c.apply('set_call_id', { call_id: 'a41-cutover-probe' });
    c.apply('booking_prefill', {
      name: 'A41 Cutover Probe',
      email: 'a41-probe@example.invalid',
      phone: '(561) 555-0144',
      notes: 'SARAH-PERCH-A41 cutover verification — not a real enquiry',
    });
    const box = document.getElementById('dl-booking');
    const apiBase = (box.getAttribute('data-api') || '').replace(/\/$/, '');
    const deployment = box.getAttribute('data-deployment') || 'donovan-main';
    const types = await fetch(`${apiBase}/booking/types?deployment=${encodeURIComponent(deployment)}`)
      .then((r) => r.json()).catch(() => ({}));
    res.typeId = (types.types || [])[0] ? types.types[0].id : null;
    if (res.typeId) {
      c.apply('booking_select_type', res.typeId);
      for (let i = 0; i < 80 && window.DLBooking.getState().step === 'LOADING'; i++) await new Promise((r) => setTimeout(r, 250));
    }
    const dayEl = document.querySelector('#dl-booking .dl-bk-date-btn');
    res.day = dayEl ? dayEl.getAttribute('data-key') : null;
    if (res.day) c.apply('booking_show_date', { day: res.day });
    await new Promise((r) => setTimeout(r, 500));
    const slotEl = document.querySelector('#dl-booking .dl-bk-slot-btn');
    res.time = slotEl ? slotEl.textContent.trim() : null;
    if (res.time) c.apply('booking_select_slot', { day: res.day, time: res.time });
    await new Promise((r) => setTimeout(r, 600));
    res.step = window.DLBooking.getState().step;
    res.perchCallId = window.__perchCallId;
    return res;
  });
  step('T2.0', 'PRECONDITION — the adapter walked a real slot to the FORM step',
    walked.step === 'FORM' && !!walked.typeId && !!walked.day && !!walked.time,
    walked);

  // ── T2.1 the double-book test ──────────────────────────────────────────────
  let releaseWrite;
  holdWrite = new Promise((r) => { releaseWrite = r; });
  const interceptedBefore = out.intercepted.length;

  await page.evaluate(() => {
    const f = document.getElementById('dl-bk-form') || document.querySelector('#dl-booking form');
    if (f) f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
  await sleep(1200);

  const inFlight = await page.evaluate(() => ({
    step: window.DLBooking.getState().step,
    submitDisabled: (() => { const b = document.querySelector('#dl-booking button[type="submit"]'); return b ? b.disabled : null; })(),
  }));
  const oneInFlight = out.intercepted.length - interceptedBefore === 1;
  step('T2.1a', 'PRECONDITION — exactly one POST is in flight and held open',
    oneInFlight && inFlight.step === 'SUBMITTING',
    { attempts: out.intercepted.length - interceptedBefore, ...inFlight });

  // The swap, mid-submit. Clicking a link is the router's real entry point.
  const nav4 = await softNavigate(page, START);
  await sleep(800);
  const afterSwapWhileInFlight = out.intercepted.length - interceptedBefore;
  releaseWrite();
  holdWrite = null;
  await sleep(1500);
  const afterRelease = out.intercepted.length - interceptedBefore;

  step('T2.1b', 'A SWAP DURING AN IN-FLIGHT BOOKING POST DOES NOT DOUBLE-BOOK',
    afterSwapWhileInFlight === 1 && afterRelease === 1,
    { via: nav4, attemptsAfterSwap: afterSwapWhileInFlight, attemptsAfterResponse: afterRelease,
      bodies: out.intercepted.slice(interceptedBefore).map((i) => ({ call_id: i.body && i.body.call_id, slot: i.body && i.body.slot })) });

  // ── T2.2 back / forward ───────────────────────────────────────────────────
  const swapsBeforeBack = await page.evaluate(() => window.Perch.router.probe().swaps);
  const layerBeforeBack = await liveRead(page);
  await page.goBack({ waitUntil: 'load' }).catch(() => {});
  await sleep(1800);
  const backState = await page.evaluate(() => ({
    path: location.pathname,
    swaps: window.Perch.router.probe().swaps,
    instanceId: window.Perch.layer.probe().instanceId,
    audio: window.Perch.layer.probe().resources['a41-audio'],
    iframes: document.querySelectorAll('iframe').length,
    title: document.title,
    container: !!document.getElementById('perch-main'),
  }));
  await page.goForward({ waitUntil: 'load' }).catch(() => {});
  await sleep(1800);
  const fwdState = await page.evaluate(() => ({
    path: location.pathname,
    swaps: window.Perch.router.probe().swaps,
    instanceId: window.Perch.layer.probe().instanceId,
    audio: window.Perch.layer.probe().resources['a41-audio'],
    iframes: document.querySelectorAll('iframe').length,
    title: document.title,
    container: !!document.getElementById('perch-main'),
  }));
  step('T2.2', 'BACK and FORWARD both soft-navigate: right page, container intact, no iframe',
    backState.container && fwdState.container
      && backState.iframes === 0 && fwdState.iframes === 0
      && backState.path !== fwdState.path
      && backState.title !== fwdState.title
      && fwdState.swaps >= backState.swaps && backState.swaps >= swapsBeforeBack,
    { before: { swaps: swapsBeforeBack, instanceId: layerBeforeBack.instanceId }, back: backState, forward: fwdState });
  step('T2.2b', 'and the live call survives BOTH history moves',
    backState.instanceId === layerBeforeBack.instanceId
      && fwdState.instanceId === layerBeforeBack.instanceId
      && backState.audio && fwdState.audio && fwdState.audio.clock > backState.audio.clock,
    { instanceId: { before: layerBeforeBack.instanceId, back: backState.instanceId, forward: fwdState.instanceId },
      clock: { back: backState.audio && backState.audio.clock, forward: fwdState.audio && fwdState.audio.clock } });

  // ── T2.3 mobile ───────────────────────────────────────────────────────────
  const mob = await ctx.newPage();
  watch(mob, 'mobile');
  await mob.setViewportSize({ width: 390, height: 844 });   // iPhone 14-class
  await mob.goto(BASE + START, { waitUntil: 'networkidle' });
  const mobBoot = await mob.evaluate(() => ({
    routerReady: !!(window.Perch && window.Perch.router) && window.Perch.router.probe().ready,
    routerActive: window.Perch.layer.bookingProbe().routerActive,
    concierge: window.Perch.layer.probe().concierge,
    instanceId: window.Perch.layer.probe().instanceId,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  // Presence is not clickability — assert the orb answers a hit-test at its own
  // centre, so a full-width overlay covering it would fail here.
  // [[feedback_presence_is_not_clickability]]
  const mobHit = await mob.evaluate(() => {
    const el = document.getElementById('dvn-perch-launcher') || document.getElementById('concierge');
    if (!el) return { found: false };
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return {
      found: true,
      rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
      onScreen: r.width > 0 && r.height > 0 && r.top >= 0 && r.bottom <= window.innerHeight && r.right <= window.innerWidth,
      hitIsSelfOrChild: !!hit && (hit === el || el.contains(hit)),
      hitTag: hit ? hit.tagName + (hit.id ? '#' + hit.id : '') : null,
    };
  });
  const mobNav = await softNavigate(mob, SECOND);
  const mobAfter = await mob.evaluate(() => ({
    path: location.pathname,
    swaps: window.Perch.router.probe().swaps,
    instanceId: window.Perch.layer.probe().instanceId,
    concierge: window.Perch.layer.probe().concierge,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  step('T2.3', 'MOBILE (390×844): the router swaps, the layer persists, the orb is HIT-TESTABLE',
    mobBoot.routerReady === true && mobBoot.routerActive === true
      && mobHit.found === true && mobHit.onScreen === true && mobHit.hitIsSelfOrChild === true
      && mobAfter.swaps >= 1 && mobAfter.instanceId === mobBoot.instanceId
      && mobAfter.concierge.count === 1
      && mobBoot.overflowX === false && mobAfter.overflowX === false,
    { via: mobNav, boot: mobBoot, orb: mobHit, after: mobAfter });

  // ── T2.4 first-load parity ────────────────────────────────────────────────
  //
  // The same URL, reached two ways, must leave the same document. Compared on a
  // signature that a swap could plausibly get wrong: title, canonical, the
  // container's own element shape, the loaded script set, and whether the widget
  // booted. Cheap string compares would hide a missing script; the script set is
  // the row that catches a swap which forgot to adopt.
  const signature = (p) => p.evaluate(() => {
    const main = document.getElementById('perch-main');
    const shape = main ? [...main.children].map((e) => e.tagName + (e.id ? '#' + e.id : '') + (e.className ? '.' + String(e.className).trim().split(/\s+/)[0] : '')).join('|') : null;
    return {
      path: location.pathname.replace(/\.html$/, ''),
      title: document.title,
      canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
      h1: (document.querySelector('main#perch-main h1') || {}).textContent?.trim().slice(0, 120) || null,
      containerShape: shape,
      childCount: main ? main.children.length : null,
      scripts: [...document.querySelectorAll('script[src]')].map((s) => new URL(s.src, location.href).pathname).sort(),
      inlineScripts: document.querySelectorAll('script:not([src])').length,
      widgetBooted: !!document.querySelector('#dl-booking[data-api-init]'),
      iframes: document.querySelectorAll('iframe').length,
    };
  });

  const hard = await ctx.newPage();
  watch(hard, 'first-load');
  await hard.evaluate(() => {}).catch(() => {});
  await hard.goto(BASE + BOOK, { waitUntil: 'networkidle' });
  await hard.evaluate(() => localStorage.setItem('donovan_booking_unlock', String(Date.now())));
  await hard.reload({ waitUntil: 'networkidle' });
  await hard.waitForFunction(() => window.DLBooking && window.DLBooking.getState()
    && window.DLBooking.getState().step !== 'LOADING', { timeout: 25000 }).catch(() => {});
  const hardSig = await signature(hard);

  const soft = await ctx.newPage();
  watch(soft, 'swap-arrived');
  await soft.goto(BASE + START, { waitUntil: 'networkidle' });
  await soft.evaluate(() => localStorage.setItem('donovan_booking_unlock', String(Date.now())));
  await softNavigate(soft, BOOK);
  await soft.waitForFunction(() => window.DLBooking && window.DLBooking.getState()
    && window.DLBooking.getState().step !== 'LOADING', { timeout: 25000 }).catch(() => {});
  const softSig = await signature(soft);

  const parityRows = ['path', 'title', 'canonical', 'h1', 'containerShape', 'childCount', 'widgetBooted', 'iframes'];
  const parityDiff = parityRows.filter((k) => JSON.stringify(hardSig[k]) !== JSON.stringify(softSig[k]));
  const missingScripts = hardSig.scripts.filter((s) => !softSig.scripts.includes(s));
  step('T2.4', 'FIRST-LOAD PARITY: /book reached by swap matches /book loaded cold',
    parityDiff.length === 0 && missingScripts.length === 0,
    { differingRows: parityDiff, missingScripts,
      extraScripts: softSig.scripts.filter((s) => !hardSig.scripts.includes(s)),
      hard: { title: hardSig.title, childCount: hardSig.childCount, scripts: hardSig.scripts.length, inline: hardSig.inlineScripts },
      soft: { title: softSig.title, childCount: softSig.childCount, scripts: softSig.scripts.length, inline: softSig.inlineScripts } });

  // ── T2.5 head-metadata parity ─────────────────────────────────────────────
  //
  // RE-INIT-INVENTORY §5.1 syncs the TITLE and the CANONICAL. Nothing else in
  // <head> follows a swap, and T2.4's evidence showed it: the swap-arrived /book
  // carried one more inline block than the cold /book, which turned out to be
  // /contact's LegalService JSON-LD riding along. This step measures the drift
  // deliberately instead of leaving it as a footnote, and separates the rows that
  // matter (crawler-visible) from the rows that do not.
  const headOf = (p) => p.evaluate(() => ({
    title: document.title,
    canonical: (document.querySelector('link[rel=canonical]') || {}).href || null,
    description: (document.querySelector('meta[name=description]') || {}).content || null,
    ogTitle: (document.querySelector('meta[property="og:title"]') || {}).content || null,
    ogUrl: (document.querySelector('meta[property="og:url"]') || {}).content || null,
    robots: (document.querySelector('meta[name=robots]') || {}).content || null,
    jsonLdTypes: [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => { try { return JSON.parse(s.textContent)['@type']; } catch (e) { return '<unparsed>'; } }),
  }));
  const hardHead = await headOf(hard);
  const softHead = await headOf(soft);
  const headRows = Object.keys(hardHead);
  const followed = headRows.filter((k) => JSON.stringify(hardHead[k]) === JSON.stringify(softHead[k]));
  const drifted = headRows.filter((k) => !followed.includes(k));

  step('T2.5a', 'the §5.1 contract holds: TITLE and CANONICAL follow the swap',
    followed.includes('title') && followed.includes('canonical'),
    { title: { hard: hardHead.title, soft: softHead.title }, canonical: { hard: hardHead.canonical, soft: softHead.canonical } });

  step('T2.5b', 'MINOR FINDING — every OTHER head row keeps the PREVIOUS page\'s value',
    drifted.length === 0,
    { drifted, followed, hard: hardHead, soft: softHead,
      severity: 'MINOR — not a promote blocker',
      why: 'RE-INIT-INVENTORY §5.1 syncs title + canonical only, so description, og:title, '
        + 'og:url, robots and JSON-LD are still /contact\'s after a swap into /book. '
        + 'CRAWLER IMPACT IS NIL: a crawler fetches each URL cold and never soft-navigates, '
        + 'so /book\'s `noindex` is still served and honoured — the A1.1 JS-off gate covers '
        + 'that ground. The live exposure is in-session: a share sheet or an extension reading '
        + '<head> on a swap-arrived page gets the previous page\'s card. Named so the promote '
        + 'decision is made with it rather than around it.' });

  // ═════════════════════════════════════════════════════════════════════════
  // §T3 — call_id threads through the rewired path, into the POST body
  // ═════════════════════════════════════════════════════════════════════════
  const idBodies = out.intercepted.filter((i) => i.body && typeof i.body === 'object');
  step('T3.1', 'the id set through the SHIPPED adapter is in the body of the POST the widget composed',
    idBodies.length >= 1 && idBodies[0].body.call_id === 'a41-cutover-probe',
    { call_id: idBodies[0] && idBodies[0].body.call_id, keys: idBodies[0] && Object.keys(idBodies[0].body) });

  // It has to survive the swaps in between — that is the hop the rewire changed.
  const idAfterSwaps = await page.evaluate(() => window.__perchCallId);
  step('T3.2', 'and it survived every content swap in this run without being re-sent',
    idAfterSwaps === 'a41-cutover-probe', { perchCallId: idAfterSwaps });

  const threadShape = await page.evaluate(() => {
    const b = (window.__A41 = {});
    b.widgetReadsGlobal = /window\.__perchCallId/.test(String(window.DLBooking ? '' : '')) || null;
    return { perchCallId: window.__perchCallId };
  });
  note('T3 proves the id reaches the POST body. Every server hop after that — the '
    + 'qualbk:<callId> lookup, the /has bridge probe, the Clio description, the Vantage '
    + 'merge key — is proved in test/perch-cutover-callid.test.mjs against the real '
    + 'create.js handler. Neither run books anything: this one intercepts, that one stubs. '
    + 'NOTE for the re-run: `a41-cutover-probe` is deliberately an id no server record '
    + 'backs, so under #57 it is UNVERIFIED by construction. That is the correct outcome '
    + 'and not a gap in this step — what T3 gates is the CLIENT hop (does the rewired DOM '
    + 'still thread the id into the body across swaps), which is unchanged by #57. The '
    + 'server-side decision cannot be observed here precisely because this run never lets '
    + 'a write reach the origin.');
  void threadShape;

  // ═════════════════════════════════════════════════════════════════════════
  // §T4 — the security invariants, read off the LIVE window
  // ═════════════════════════════════════════════════════════════════════════
  const surface = await page.evaluate(() => {
    const describe = (obj, path, depth = 0) => {
      const rows = [];
      if (!obj || depth > 1) return rows;
      for (const k of Object.keys(obj)) {
        let v;
        try { v = obj[k]; } catch (e) { v = '<throws>'; }
        rows.push({ path: path + '.' + k, type: typeof v });
        if (v && typeof v === 'object' && depth < 1) rows.push(...describe(v, path + '.' + k, depth + 1));
      }
      return rows;
    };
    return {
      perch: describe(window.Perch, 'Perch'),
      dunderPerch: window.__perch ? describe(window.__perch, '__perch') : [],
      callIdType: typeof window.__perchCallId,
      dlKeys: window.DL ? Object.keys(window.DL) : null,
    };
  });
  const censusAfter = await page.evaluate(SCRIPT_CENSUS);

  const perchFns = surface.perch.filter((r) => r.type === 'function').map((r) => r.path);

  // The router's own header claims "the control functions — navigate, adopt, the
  // recipe — stay in this closure". Held to it, exactly.
  const routerFns = perchFns.filter((p) => p.startsWith('Perch.router.'));
  step('T4.1a', 'Perch.router publishes a probe and NOTHING else',
    routerFns.length === 1 && routerFns[0] === 'Perch.router.probe',
    { functions: routerFns });

  // ── A4.1 RE-RUN: #58 is merged, so these read the CLOSED state ──────────────
  //
  // The four keys #58 leaves on Perch.layer. attach/detachLiveResource are on the
  // ALLOWED side deliberately: verify-a22.mjs parks a live AudioContext clock
  // through them and that is the A22 acceptance proof. They mutate a diagnostics
  // Map that nothing but probe() reads.
  const ALLOWED_LAYER = ['probe', 'bookingProbe', 'attachLiveResource', 'detachLiveResource'];
  // Everything the pre-#58 instance carried that is a genuine control handle.
  const WITHDRAWN = ['setRouter', 'mountShellConcierge', 'root', 'container', 'concierge',
    'call', 'qualifier', 'inspect', 'isPersistent', 'instanceId', 'hostFallback'];
  const layerKeys = surface.perch.filter((r) => r.path.startsWith('Perch.layer.'))
    .map((r) => r.path.slice('Perch.layer.'.length));
  const layerFns = perchFns.filter((p) => p.startsWith('Perch.layer.')).map((p) => p.slice('Perch.layer.'.length));
  const unclassified = layerFns.filter((f) => !ALLOWED_LAYER.includes(f));
  const stillExposed = layerKeys.filter((f) => WITHDRAWN.includes(f));

  step('T4.1b', 'Perch.layer carries ONLY the four reviewed keys — no unreviewed surface',
    unclassified.length === 0, { keys: layerKeys, unclassified });

  step('T4.1c', 'A3.3 (#58) CLOSED — setRouter and every other control handle is GONE from window',
    stillExposed.length === 0 && !layerKeys.includes('setRouter'),
    { stillExposed, checkedFor: WITHDRAWN,
      ticket: 58, wasBlockingOn: 'PR #80',
      note: 'PR #80 measured four exposed mutators here, setRouter among them. '
        + 'Read off the live window on this deployment, not from source.' });

  step('T4.2', 'the call id on window is a DATA value, not a control surface',
    surface.callIdType === 'string', { type: surface.callIdType });

  const dunderFns = surface.dunderPerch.filter((r) => r.type === 'function').map((r) => r.path);
  const dunderKeys = surface.dunderPerch.map((r) => r.path.slice('__perch.'.length));
  step('T4.3', 'A3.3 (#58) CLOSED — window.__perch is a probe; openQualifier/closeQualifier gone',
    dunderFns.length === 1 && dunderFns[0] === '__perch.probe'
      && !dunderKeys.includes('openQualifier') && !dunderKeys.includes('closeQualifier'),
    { exposed: dunderFns, keys: dunderKeys, ticket: 58, wasBlockingOn: 'PR #80' });

  // ── T4.3b — THE INVARIANTS, ATTACKED ON THE LIVE PAGE ──────────────────────
  //
  // Enumerating keys proves "not exposed". It does not prove "not REPLACEABLE",
  // which is a claim about property descriptors, nor "the first router keeps
  // running", which is a claim about a module-private slot. Both are #58's actual
  // acceptance, and neither is visible to an enumeration — so this runs the
  // attacks in the page and records what happened.
  //
  // Everything below is a read or a THROWN write. Nothing here books, navigates or
  // mutates state that outlives the page: the registration attempt is refused by
  // the code under test, which is the point.
  // ── WHY THIS RUNS THE ATTACKS TWICE, IN BOTH MODES ─────────────────────────
  //
  // The first formulation of this step asserted only "every write throws
  // TypeError" and FAILED on a deployment where the invariant actually holds:
  // `page.evaluate` runs its function in SLOPPY mode, and a write to a
  // non-writable property is a silent no-op there — it throws only under 'use
  // strict'. The unit half (test/perch-cutover-security.test.mjs §T4.3b) threw
  // because ESM module code is always strict, so the two halves disagreed about a
  // surface that was never in fact replaceable.
  //
  // Throwing is the SYMPTOM. The invariant is "the write does not take effect",
  // and that holds in both modes — which is what matters, because a hostile
  // classic <script> is sloppy and a hostile module is strict. So both are run:
  // sloppy must silently fail to change anything, strict must additionally throw,
  // and identity is re-checked after each. Asserting the symptom alone would have
  // produced a false NO-GO here.
  // See [[feedback_assert_behavior_not_source_spelling]].
  const attackSloppy = await page.evaluate(async () => {
    const original = window.Perch;
    const originalLayer = window.Perch?.layer;
    const originalProbe = window.Perch?.layer?.probe;
    const originalDunder = window.__perch;
    const quiet = (fn) => { try { fn(); return 'no-throw'; } catch (e) { return e.constructor.name; } };

    const outcomes = {
      reassignNamespace: quiet(() => { window.Perch = { layer: 'hijacked' }; }),
      deleteNamespace:   quiet(() => { delete window.Perch; }),
      redefineNamespace: quiet(() => Object.defineProperty(window, 'Perch', { value: {} })),
      swapSlot:          quiet(() => { window.Perch.layer = { probe: () => 'hijacked' }; }),
      redefineSlot:      quiet(() => Object.defineProperty(window.Perch, 'layer', { value: 'x' })),
      addSlot:           quiet(() => { window.Perch.evil = () => {}; }),
      swapMethod:        quiet(() => { window.Perch.layer.probe = () => 'hijacked'; }),
      reassignDunder:    quiet(() => { window.__perch = { probe: () => 'hijacked' }; }),
    };
    return {
      outcomes,
      // THE INVARIANT: nothing moved, whatever the mode did about it.
      nothingChanged: window.Perch === original
        && window.Perch?.layer === originalLayer
        && window.Perch?.layer?.probe === originalProbe
        && window.__perch === originalDunder
        && !('evil' in window.Perch),
      probeStillReal: typeof window.Perch?.layer?.probe === 'function'
        && window.Perch.layer.probe() !== 'hijacked',
    };
  });

  const attack = await page.evaluate(async () => {
    'use strict';   // ← the directive the first formulation was missing
    const threw = (fn) => { try { fn(); return false; } catch (e) { return e instanceof TypeError; } };
    const original = window.Perch;
    const originalLayer = window.Perch?.layer;

    const r = {
      reassignNamespace: threw(() => { window.Perch = { layer: 'hijacked' }; }),
      deleteNamespace:   threw(() => { delete window.Perch; }),
      redefineNamespace: threw(() => Object.defineProperty(window, 'Perch', { value: {} })),
      swapSlot:          threw(() => { window.Perch.layer = { probe: () => 'hijacked' }; }),
      redefineSlot:      threw(() => Object.defineProperty(window.Perch, 'layer', { value: 'x' })),
      addSlot:           threw(() => { window.Perch.evil = () => {}; }),
      swapMethod:        threw(() => { window.Perch.layer.probe = () => 'hijacked'; }),
      reassignDunder:    threw(() => { window.__perch = { probe: () => 'hijacked' }; }),
      layerFrozen:       Object.isFrozen(window.Perch?.layer),
      identityHeld:      window.Perch === original && window.Perch?.layer === originalLayer,
      descriptor:        (() => {
        const d = Object.getOwnPropertyDescriptor(window, 'Perch');
        return d ? { writable: d.writable, configurable: d.configurable } : null;
      })(),
    };

    // The residual #58 documents: a same-origin module CAN import the surface. It
    // must still fail to take the navigation slot, because A2.2 registered at boot.
    const before = window.Perch?.layer?.bookingProbe?.() ?? {};
    try {
      const mod = await import('/js/perch/surface.js');
      r.moduleImportable = true;
      r.setRouterExport = typeof mod.setRouter;                 // must be 'undefined'
      const res = mod.registerRouter(() => { r.hostileRan = true; });
      r.secondRegistrationOk = res?.ok;                          // must be false
      r.refusalReason = res?.reason ?? null;
      r.lockAfter = mod.routerLock?.();
    } catch (e) {
      r.moduleImportError = String(e);
    }
    const after = window.Perch?.layer?.bookingProbe?.() ?? {};
    r.routerActiveBefore = before.routerActive;
    r.routerActiveAfter = after.routerActive;
    r.refusedBefore = before.routerRefused;
    r.refusedAfter = after.routerRefused;
    return r;
  });

  const descriptorHolds = attack.descriptor
    && attack.descriptor.writable === false && attack.descriptor.configurable === false;

  step('T4.3b', 'window.Perch and window.__perch cannot be REASSIGNED and their slots cannot be SWAPPED',
    // The invariant, in the mode a classic <script> would use…
    attackSloppy.nothingChanged && attackSloppy.probeStillReal
    // …and the same eight writes rejected outright in the mode a module would use.
      && descriptorHolds && attack.reassignNamespace && attack.deleteNamespace
      && attack.redefineNamespace && attack.swapSlot && attack.redefineSlot
      && attack.addSlot && attack.swapMethod && attack.reassignDunder
      && attack.layerFrozen && attack.identityHeld,
    { descriptor: attack.descriptor,
      sloppyMode: {
        note: 'a hostile classic <script>: the writes are silent no-ops, and the '
          + 'invariant is that NOTHING MOVED — not that anything threw',
        nothingChanged: attackSloppy.nothingChanged,
        probeStillReal: attackSloppy.probeStillReal,
        outcomes: attackSloppy.outcomes },
      strictMode: {
        note: 'a hostile module: every write is rejected with a TypeError',
        reassignNamespace: attack.reassignNamespace, deleteNamespace: attack.deleteNamespace,
        redefineNamespace: attack.redefineNamespace, swapSlot: attack.swapSlot,
        redefineSlot: attack.redefineSlot, addSlot: attack.addSlot,
        swapMethod: attack.swapMethod, reassignDunder: attack.reassignDunder },
      layerFrozen: attack.layerFrozen, identityHeld: attack.identityHeld });

  step('T4.3c', 'a SECOND router registration is REFUSED and the original router is still the live one',
    attack.setRouterExport === 'undefined'
      && attack.secondRegistrationOk === false
      && attack.hostileRan !== true
      && attack.routerActiveBefore === true && attack.routerActiveAfter === true
      && attack.refusedAfter === attack.refusedBefore + 1,
    { setRouterExport: attack.setRouterExport,
      secondRegistrationOk: attack.secondRegistrationOk,
      refusalReason: attack.refusalReason,
      hostileRouterEverRan: attack.hostileRan === true,
      routerActive: { before: attack.routerActiveBefore, after: attack.routerActiveAfter },
      routerRefused: { before: attack.refusedBefore, after: attack.refusedAfter },
      residual: 'The module IS importable same-origin — #58 documents this. What closes it '
        + 'is that A2.2 registers at boot, so the slot is taken before any page script runs. '
        + 'This step is the proof of that, measured on the deployment.' });

  const grew = {
    inlineExecutable: censusAfter.inlineExecutable - censusAtBoot.inlineExecutable,
    inlineNonced: censusAfter.inlineNonced - censusAtBoot.inlineNonced,
    hybridScripts: censusAfter.hybridScripts - censusAtBoot.hybridScripts,
  };
  step('T4.4', 'no swap re-executed, re-nonced or eval\'d a fetched script',
    grew.inlineExecutable === 0 && grew.inlineNonced === 0 && grew.hybridScripts === 0
      && censusAfter.hybridScripts === 0 && out.cspViolations.length === 0,
    { atBoot: censusAtBoot, afterSwaps: censusAfter, delta: grew,
      swapsRun: await page.evaluate(() => window.Perch.router.probe().swaps),
      cspViolations: out.cspViolations });

  step('T4.5', 'no page in this run threw an uncaught error',
    out.pageErrors.length === 0, { pageErrors: out.pageErrors.slice(0, 8) });

  // ═════════════════════════════════════════════════════════════════════════
  // §T5 — GA4 page_view per swap, and the booking guards through the rewired DOM
  // ═════════════════════════════════════════════════════════════════════════
  const swapLog = await page.evaluate(() => window.Perch.router.probe().log.map((e) => ({
    n: e.n,
    url: e.url,
    error: e.error || null,
    adopted: (e.scripts || []).filter((s) => s.adopted).map((s) => s.src),
    ga: e.recipe && e.recipe.rows ? (e.recipe.rows.find((r) => /GA4/.test(r.name)) || null) : null,
    broken: e.recipe ? e.recipe.broken : null,
  })));
  const gaRows = swapLog.map((e) => e.ga).filter(Boolean);
  step('T5.1', 'every swap emitted exactly one GA4 page_view row',
    swapLog.length > 0 && gaRows.length === swapLog.length,
    { swaps: swapLog.length, gaRows: gaRows.length, urls: swapLog.map((e) => e.url) });

  const allPending = gaRows.every((r) => r.status === 'pending' && /measurement id/i.test(JSON.stringify(r.detail || {})));
  step('T5.2', 'GA4 is a DOCUMENTED STUB — every row says `pending` and names the external blocker',
    allPending, { statuses: [...new Set(gaRows.map((r) => r.status))], sample: gaRows[0] });
  note('There is no G- measurement id on this site (RE-INIT-INVENTORY §3.8, HANDOFF.md:120). '
    + 'The per-swap page_view is therefore a stub, and §T5.2 holds it to being a REPORTED '
    + 'stub rather than silence. test/perch-cutover-booking-guards.test.mjs §T5.3 installs a '
    + 'gtag and proves the code behind the stub fires one correct page_view per swap.');

  step('T5.3', 'no swap in this run reported a broken re-init row',
    swapLog.every((e) => !e.error && Array.isArray(e.broken) && e.broken.length === 0),
    swapLog.map((e) => ({ url: e.url, error: e.error, broken: e.broken })));

  // The booking guards, on the live Preview DOM: prefill reaches the real inputs.
  await page.evaluate(() => localStorage.setItem('donovan_booking_unlock', String(Date.now())));
  await softNavigate(page, BOOK);
  await page.waitForFunction(() => window.DLBooking && window.DLBooking.getState()
    && window.DLBooking.getState().step !== 'LOADING', { timeout: 25000 }).catch(() => {});
  const guards = await page.evaluate(async () => {
    const { createBookingControl } = await import('/js/perch/booking-control.js');
    const c = createBookingControl(window, document);
    const P = { name: 'Maria De La Cruz', email: 'maria@example.com', phone: '(561) 555-0142', notes: 'Real estate closing question' };
    const pre = c.apply('booking_prefill', P);

    const box = document.getElementById('dl-booking');
    const apiBase = (box.getAttribute('data-api') || '').replace(/\/$/, '');
    const deployment = box.getAttribute('data-deployment') || 'donovan-main';
    const types = await fetch(`${apiBase}/booking/types?deployment=${encodeURIComponent(deployment)}`).then((r) => r.json()).catch(() => ({}));
    const typeId = (types.types || [])[0] ? types.types[0].id : null;
    if (typeId) {
      c.apply('booking_select_type', typeId);
      for (let i = 0; i < 80 && window.DLBooking.getState().step === 'LOADING'; i++) await new Promise((r) => setTimeout(r, 250));
    }
    const day = (document.querySelector('#dl-booking .dl-bk-date-btn') || {}).getAttribute
      ? document.querySelector('#dl-booking .dl-bk-date-btn').getAttribute('data-key') : null;
    if (day) c.apply('booking_show_date', { day });
    await new Promise((r) => setTimeout(r, 500));
    const slotEl = document.querySelector('#dl-booking .dl-bk-slot-btn');
    if (slotEl) c.apply('booking_select_slot', { day, time: slotEl.textContent.trim() });
    await new Promise((r) => setTimeout(r, 600));

    const val = (id) => { const e = document.querySelector(id); return e ? e.value : null; };
    const before = val('#dl-bk-email');
    // The other half of #34: a caller-typed field must outrank a later prefill.
    const email = document.querySelector('#dl-bk-email');
    if (email) {
      email.value = 'iTypedThisMyself@example.com';
      email.dispatchEvent(new Event('input', { bubbles: true }));
    }
    c.apply('booking_prefill', P);
    await new Promise((r) => setTimeout(r, 400));

    return {
      acked: pre.acked,
      step: window.DLBooking.getState().step,
      firstEmail: before,
      form: { name: val('#dl-bk-name'), email: val('#dl-bk-email'), phone: val('#dl-bk-phone'), notes: val('#dl-bk-notes') },
    };
  });
  step('T5.4', 'the #34 prefill guards hold through the REWIRED DOM on Preview',
    guards.step === 'FORM'
      && guards.acked === true
      && guards.firstEmail === 'maria@example.com'
      && guards.form.name === 'Maria De La Cruz'
      && guards.form.phone === '(561) 555-0142'
      && !!guards.form.notes
      && guards.form.email === 'iTypedThisMyself@example.com',
    guards);

  // ═════════════════════════════════════════════════════════════════════════
  // §T6 — the accounting: nothing left this browser for the write path
  // ═════════════════════════════════════════════════════════════════════════
  const escaped = out.bookingRequests.length - out.intercepted.length;
  step('T6.1', 'EVERY booking write request was answered inside the browser — none reached Clio',
    out.bookingRequests.length === out.intercepted.length && out.intercepted.length > 0,
    { requested: out.bookingRequests.length, intercepted: out.intercepted.length, escaped });

  step('T6.2', 'and the only writes attempted were the one deliberate submit in T2.1',
    out.intercepted.length === 1,
    { attempts: out.intercepted.length, urls: out.intercepted.map((i) => i.url) });

  await browser.close();

  out.finishedAt = new Date().toISOString();
  out.pass = out.steps.every((s) => s.ok);
  out.failed = out.steps.filter((s) => !s.ok).map((s) => `${s.id} ${s.name}`);

  const evidence = fileURLToPath(new URL('./a41-evidence.json', import.meta.url));
  writeFileSync(evidence, JSON.stringify(out, null, 2));
  console.log('\n' + JSON.stringify({
    verdict: out.pass ? 'PASS' : 'FAIL',
    base: BASE,
    steps: out.steps.length,
    passed: out.steps.filter((s) => s.ok).length,
    failed: out.failed,
    bookingRequests: out.bookingRequests.length,
    intercepted: out.intercepted.length,
    cspViolations: out.cspViolations.length,
    pageErrors: out.pageErrors.length,
    evidence,
  }, null, 2));
}

main().catch((e) => {
  out.fatal = String(e && e.stack ? e.stack : e);
  console.error('verifier crashed:', out.fatal);
  const evidence = fileURLToPath(new URL('./a41-evidence.json', import.meta.url));
  out.pass = false;
  writeFileSync(evidence, JSON.stringify(out, null, 2));
});
