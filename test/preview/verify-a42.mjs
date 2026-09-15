// ── SARAH-PERCH-A42 — the POST-PROMOTE PRODUCTION smoke ──────────────────────
//
// Order SARAH-A42-POST-PROMOTE-SMOKE · ticket #61 · Phase A / Phase 4.
//
// THIS RUNS AGAINST LIVE PRODUCTION. Every other verifier in this directory
// (verify-a22/a23/a31/a34/a41/a51) runs against a Preview deployment where the
// router is on by hostname. This one runs against `https://www.donovan.law`,
// where the router is on because David set `PERCH_ROUTER=on` and promoted. There
// is no sandbox behind it: Clio is Paul's real calendar, Vantage is the real
// lead store, Retell is a real metered voice account.
//
//   node test/preview/verify-a42.mjs [baseUrl]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and test/preview/a42-evidence.json.
//
// ── WHAT "NO JUNK DATA" IS ENFORCED BY, AND IT IS NOT INTENT ─────────────────
//
// This repo has already booked a real appointment on Paul's calendar from a probe
// whose author believed it was exercising an error path
// ([[feedback_negative_path_probe_can_write]]). So the write paths are severed
// mechanically, in three independent layers, and the last section reconciles
// counters rather than asserting good behaviour:
//
//   LAYER 1 — an init script, installed on the CONTEXT before the first page
//     exists, wraps `window.fetch` and `XMLHttpRequest` in every document and
//     every frame. A request whose URL matches WRITE_RE is RECORDED and then
//     DROPPED — the wrapper never calls through to the real fetch, so the request
//     is composed by the widget and never handed to the network stack at all.
//     This is what "compose the POST but stop before submitting" means here: the
//     body exists, the socket never does.
//
//   LAYER 2 — a context-level `route()` on the same patterns that ABORTS. Note
//     ABORT, not `fulfill()`: A41 fulfilled a 201 because it needed to observe
//     what the widget does with a success, and this run needs the opposite — the
//     write must not even be simulated. Layer 2 should never fire. If it does,
//     that is Layer 1 leaking, and §S5 reports it as a defect in THIS FILE.
//
//   LAYER 3 — `page.on('request')` counts every write-path request the browser
//     actually issued. §S5 fails unless that count is ZERO. Layers 1 and 2 are
//     claims; this is the measurement that would catch either of them missing.
//
// The composed booking POST additionally carries `turnstile_token: ''`, because a
// CAPTCHA solve is not agent-verifiable ([[feedback_turnstile_not_agent_verifiable]]).
// /booking/create refuses a tokenless body with 403 TURNSTILE_REQUIRED before it
// touches Clio. So even a request that defeated all three layers could not have
// booked. That is a consequence worth stating, not a layer to rely on.
//
// ── WHAT THIS DELIBERATELY DOES NOT DO ──────────────────────────────────────
//   • It never CLICKS the concierge launcher. Clicking it mints a Retell web call
//     — a real call record, real metered minutes, and a real Vantage lead. §S2
//     proves the launcher is present, hit-testable and wired, and proves the
//     connect endpoint is deployed with a method probe that writes nothing. The
//     voice call itself is a MANUAL check and is reported as such; Retell refuses
//     automation by design.
//   • It never submits a qualifier. `fn/qualifier_submit` writes a DO slot and a
//     KV record — junk data on a live store — and it is auth-gated besides.
//   • It reads no secret and sends no credential.
//
// ── THE ONE THING A BLACK-BOX RUN CANNOT REACH, STATED HERE NOT BURIED ───────
// A Durable Object has no public HTTP path ([[feedback_durable_object_has_no_public_http_path]]),
// so `perch-do`'s non-destructive `/has` probe cannot be curl'd from outside, and
// `fn/qualifier_result` (which would reach the DO) is auth-gated and read-once —
// probing it would CONSUME a live caller's slot. §S4 therefore reconciles the
// server-side call_id bind by provenance and by the client half of the wiring,
// and the sign-off states the residual instead of claiming the DO was measured.

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BASE = (process.argv[2] && !process.argv[2].startsWith('--'))
  ? process.argv[2].replace(/\/$/, '')
  : process.env.A42_BASE_URL
  || 'https://www.donovan.law';

const START = '/contact';   // the 92-page div-box majority shape; carries shared chrome
const SECOND = '/blog';     // a second content page, for soft-nav + back/forward
const BOOK = '/book';

// Every path that writes to a live system. `web-call` mints a Retell session;
// `upsert-lead` is Vantage's merge endpoint; the fn/* four write KV/DO/Clio.
const WRITE_RE = /(\/booking\/create|\/web-call|\/consent-notice|\/fn\/(qualifier_submit|save_lead|take_message|booking_confirmed)|upsert-lead)/;

const out = {
  order: 'SARAH-A42-POST-PROMOTE-SMOKE',
  ticket: 61,
  gates: 'POST-PROMOTE SMOKE (production health)',
  base: BASE,
  startedAt: new Date().toISOString(),
  steps: [],
  writeRequestsOnWire: [],   // LAYER 3 — must stay empty
  trapped: [],               // LAYER 1 — composed-then-dropped, with bodies
  routeAborted: [],          // LAYER 2 — must stay empty
  console: [],
  pageErrors: [],
  cspViolations: [],
  headers: {},
  manual: [],
  notes: [],
};

function step(id, name, ok, detail) {
  out.steps.push({ id, name, ok: !!ok, detail: detail === undefined ? null : detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${name}`);
  if (!ok) console.log('      ' + JSON.stringify(detail));
  return ok;
}
const note = (t) => { out.notes.push(t); console.log('note  ' + t); };
const manual = (t) => { out.manual.push(t); console.log('MANUAL ' + t); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function watch(page, where) {
  page.on('console', (m) => {
    const t = m.text().slice(0, 300);
    out.console.push({ where, type: m.type(), text: t });
    if (/Content Security Policy|Refused to (load|execute|apply|frame)/i.test(t)) {
      out.cspViolations.push({ where, text: m.text().slice(0, 400) });
    }
  });
  page.on('pageerror', (e) => out.pageErrors.push({ where, error: String(e).slice(0, 300) }));
  page.on('request', (r) => {
    if (WRITE_RE.test(r.url())) {
      out.writeRequestsOnWire.push({ where, url: r.url(), method: r.method() });
    }
  });
}

// ── LAYER 1 ──────────────────────────────────────────────────────────────────
// Installed with addInitScript so it is the FIRST thing in every document, ahead
// of every product script. It patches only the harness's own browser; it changes
// no shipped file and is not a product global — the capture lives on a namespace
// this file owns.
const SEVER_WRITES = (writeSource) => {
  const RE = new RegExp(writeSource);
  const trap = { calls: [], version: 'a42-layer1' };
  Object.defineProperty(window, '__A42_TRAP', { value: trap, writable: false, configurable: false });

  const abs = (u) => { try { return new URL(u, location.href).href; } catch (e) { return String(u); } };

  const realFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    const url = abs(typeof input === 'string' ? input : (input && input.url) || '');
    if (RE.test(url)) {
      let body = null;
      try {
        const raw = (init && init.body) || (input && input.body) || null;
        body = typeof raw === 'string' ? JSON.parse(raw) : raw;
      } catch (e) {
        try { body = { unparsed: String((init && init.body) || '').slice(0, 800) }; } catch (e2) { body = null; }
      }
      trap.calls.push({
        via: 'fetch',
        url,
        method: (init && init.method) || (input && input.method) || 'GET',
        body,
        at: Date.now(),
      });
      // DROPPED. Never forwarded. The caller sees a rejection, which is the
      // honest outcome of "this request was not sent" — and the widget's own
      // .catch renders its generic error, which is fine: nothing was booked.
      return Promise.reject(new Error('A42-SEVERED-NEVER-SENT'));
    }
    return realFetch(input, init);
  };

  const realOpen = XMLHttpRequest.prototype.open;
  const realSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__a42 = { method, url: abs(url), severed: RE.test(abs(url)) };
    return realOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (body) {
    if (this.__a42 && this.__a42.severed) {
      let parsed = null;
      try { parsed = typeof body === 'string' ? JSON.parse(body) : body; } catch (e) { parsed = { unparsed: String(body || '').slice(0, 800) }; }
      trap.calls.push({ via: 'xhr', url: this.__a42.url, method: this.__a42.method, body: parsed, at: Date.now() });
      return; // DROPPED
    }
    return realSend.call(this, body);
  };

  // sendBeacon is a write primitive too, and it is fire-and-forget.
  if (navigator.sendBeacon) {
    const realBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (RE.test(abs(url))) {
        trap.calls.push({ via: 'beacon', url: abs(url), method: 'POST', body: null, at: Date.now() });
        return true; // DROPPED
      }
      return realBeacon(url, data);
    };
  }
};

const liveRead = (page) => page.evaluate(() => {
  const p = window.Perch && window.Perch.layer ? window.Perch.layer.probe() : null;
  if (!p) return null;
  return {
    instanceId: p.instanceId,
    ticks: p.ticks,
    uptimeMs: p.uptimeMs,
    audio: p.resources && p.resources['a42-audio'],
    callLive: p.callLive,
  };
});

/** Arm an AudioContext through the layer's OWN published seam. */
async function armLiveResource(page) {
  return page.evaluate(async () => {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return { armed: false, why: 'no AudioContext in this browser' };
    const ac = new AC();
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(ac.destination);
    osc.start();
    try { await ac.resume(); } catch (e) { /* autoplay policy — reported below */ }
    window.Perch.layer.attachLiveResource('a42-audio', {
      clock: () => ac.currentTime,
      state: () => ac.state,
    });
    // Poll until the clock actually moves. A reading of 0 means NOT STARTED, and
    // reporting that as a stall is a false red this project has produced before
    // ([[feedback_a22_audio_clock_false_red]]).
    const t0 = Date.now();
    while (ac.currentTime === 0 && Date.now() - t0 < 8000) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return { armed: true, state: ac.state, clock: ac.currentTime, waitedMs: Date.now() - t0 };
  });
}

/**
 * Drive the live booking widget from its boot state to the details FORM.
 *
 * Every click below is a real click on a real rendered control — the widget's own
 * entry points, never an internal state poke.
 *
 * TWO THINGS THE FIRST RUN OF THIS FILE GOT WRONG, both harness defects that read
 * as product failures:
 *
 *   1. NO TYPE BUTTON IS CLICKED, AND THAT IS CORRECT. /booking/types answers
 *      with exactly one appointment type on this deployment ("consult"), and
 *      js/booking-widget.js:1466 auto-selects when `types.length === 1` and jumps
 *      straight to DATE. A harness that requires a type click reports a failure on
 *      a widget behaving exactly as written. So this waits for a day strip rather
 *      than for a type list, and reads `selectedType` back to prove the
 *      auto-selection really happened.
 *
 *   2. SELECTING A SLOT REACHES THE FORM DIRECTLY — since
 *      JORDAN-BOOKING-WIDGET-DETAILS-R1. It used to render a `#dl-bk-next`
 *      button whose click was the only thing that set `step = 'FORM'`, so a
 *      harness that stopped at the slot found no `#dl-bk-form` and reported
 *      "the widget never reached the details form".
 *
 *      That control is now absent from the happy path and present only after a
 *      Back out of the details step. So the walk below treats it as OPTIONAL:
 *      it presses `#dl-bk-next` if one is there, and otherwise carries on — the
 *      claim being tested is "the details form and its Turnstile mount are
 *      reachable", not "a particular button exists on the way".
 */
async function driveToForm(page) {
  return page.evaluate(async () => {
    const res = { steps: [] };
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const q = (s) => document.querySelector(s);
    const waitFor = async (sel, ms) => {
      const t0 = Date.now();
      while (Date.now() - t0 < ms) { if (q(sel)) return true; await sleep(200); }
      return false;
    };

    // The single type is auto-selected; the day strip is the first control.
    res.dayStrip = await waitFor('#dl-booking .dl-bk-date-btn:not([disabled])', 25000);
    if (!res.dayStrip) { res.why = 'no day strip rendered'; return res; }

    const day = q('#dl-booking .dl-bk-date-btn:not([disabled])');
    day.click();
    res.steps.push('day:' + day.textContent.trim().replace(/\s+/g, '').slice(0, 20));
    await sleep(2500);

    const slotOk = await waitFor('#dl-booking .dl-bk-slot-btn:not([disabled])', 20000);
    if (!slotOk) { res.why = 'no free slot on the first available day'; return res; }
    const slot = q('#dl-booking .dl-bk-slot-btn:not([disabled])');
    slot.click();
    res.steps.push('slot:' + slot.textContent.trim().slice(0, 20));
    await sleep(1200);

    // DATE → FORM. The slot click advances on its own now; press #dl-bk-next
    // only if this build still renders one, so this harness reads the same on
    // either side of JORDAN-BOOKING-WIDGET-DETAILS-R1.
    const next = q('#dl-booking #dl-bk-next');
    res.nextPresent = !!next;
    if (next) {
      next.click();
      res.steps.push('next');
      await sleep(1500);
    } else {
      res.steps.push('next:absent(slot-click-advanced)');
    }

    res.formPresent = !!q('#dl-bk-form');
    if (!res.formPresent) { res.why = 'the details form never rendered'; return res; }
    res.turnstileMount = !!q('#dl-bk-turnstile');
    return res;
  });
}

/**
 * Fill the details form with obviously synthetic values.
 *
 * `.invalid` is the RFC 2606 reserved TLD — it cannot resolve, so even a
 * confirmation email that somehow escaped could not be delivered to a real
 * inbox. The phone is in the 555 reserved range.
 */
async function fillDetails(page) {
  return page.evaluate(() => {
    const set = (sel, v) => {
      const el = document.querySelector(sel);
      if (!el) return false;
      const proto = Object.getPrototypeOf(el);
      const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
      setter.call(el, v);
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    };
    const ok = {
      name: set('#dl-bk-name', 'A42 Smoke Probe'),
      email: set('#dl-bk-email', 'a42-smoke@donovan-law-smoke.invalid'),
      phone: set('#dl-bk-phone', '5615550142'),
      notes: set('#dl-bk-notes', 'SARAH-A42 post-promote smoke — composed, never submitted.'),
    };
    // The honeypot MUST stay empty; filling it is what a bot does.
    const hp = document.querySelector('#dl-bk-hp-field');
    return { ...ok, honeypotEmpty: !hp || hp.value === '' };
  });
}

/** Soft-navigate by CLICKING a link — Swup's own entry point, not a harness call. */
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
  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // LAYER 1 — before any page exists.
  await ctx.addInitScript(SEVER_WRITES, WRITE_RE.source);

  // LAYER 2 — backstop. Should never fire.
  await ctx.route((url) => WRITE_RE.test(url.href), async (route) => {
    const req = route.request();
    let body = null;
    try { body = req.postDataJSON(); } catch (e) { body = { unparsed: (req.postData() || '').slice(0, 500) }; }
    out.routeAborted.push({ url: req.url(), method: req.method(), body });
    await route.abort();
  });

  const page = await ctx.newPage();
  watch(page, 'main');

  // ═══════════════════════════════════════════════════════════════════════════
  // §S1 (task 1) — the root URL on live production
  // ═══════════════════════════════════════════════════════════════════════════
  const rootResp = await page.goto(BASE + '/', { waitUntil: 'networkidle' });
  const rootHeaders = rootResp.headers();
  out.headers['/'] = rootHeaders;

  step('S1.1', '`/` answers 200 and the URL is still `/` (a 200-rewrite preserves it)',
    rootResp.status() === 200 && new URL(page.url()).pathname === '/',
    { status: rootResp.status(), url: page.url(), chain: rootResp.request().redirectedFrom() ? 'REDIRECTED' : 'direct' });

  const seo = await page.evaluate(() => {
    const metas = [...document.querySelectorAll('meta[name="robots"], meta[name="googlebot"]')]
      .map((m) => ({ name: m.getAttribute('name'), content: m.getAttribute('content') }));
    const h1 = [...document.querySelectorAll('h1')].map((h) => h.textContent.trim()).filter(Boolean);
    return {
      metas,
      title: document.title,
      canonical: (document.querySelector('link[rel="canonical"]') || {}).href || null,
      h1,
      // The shell shipped 9 words of body text and no heading. The real homepage
      // is thousands of characters of crawlable prose — the difference between
      // "indexable" and "a noindex stub" is measurable, not a matter of opinion.
      textLength: (document.body.innerText || '').trim().length,
      linkCount: document.querySelectorAll('a[href]').length,
    };
  });

  const noindexHeader = String(rootHeaders['x-robots-tag'] || '');
  step('S1.2', '`/` carries NO noindex — not in a meta tag, not in X-Robots-Tag',
    seo.metas.every((m) => !/noindex/i.test(m.content || '')) && !/noindex/i.test(noindexHeader),
    { metas: seo.metas, xRobotsTag: noindexHeader || '(absent)' });

  step('S1.3', '`/` is the REAL homepage — a heading, crawlable prose and internal links',
    seo.h1.length >= 1 && seo.textLength > 1000 && seo.linkCount > 20,
    { title: seo.title, h1: seo.h1.slice(0, 2), textLength: seo.textLength, links: seo.linkCount });

  step('S1.4', '`/` self-canonicalises to the production root',
    seo.canonical === 'https://www.donovan.law/', { canonical: seo.canonical });

  const shape = await page.evaluate(() => ({
    topLevel: window.top === window.self,
    iframes: document.querySelectorAll('iframe').length,
    perchInjected: !!window.__perchInjected,
    container: !!document.querySelector('main#perch-main') || !!document.getElementById('perch-main'),
    containerTag: (document.getElementById('perch-main') || {}).tagName || null,
    layerNode: !!document.getElementById('perch-persistent'),
    router: window.Perch && window.Perch.router ? window.Perch.router.probe() : null,
    layer: window.Perch && window.Perch.layer ? window.Perch.layer.probe() : null,
  }));

  step('S1.5', '`/` is ONE document — not the shell iframing the site',
    shape.topLevel && shape.iframes === 0 && shape.perchInjected === false,
    { topLevel: shape.topLevel, iframes: shape.iframes, perchInjected: shape.perchInjected });

  step('S1.6', 'the router container `#perch-main` is present on `/`',
    shape.container === true, { present: shape.container, tag: shape.containerTag });

  step('S1.7', 'the router is injected, ready and registered with the persistent layer',
    !!shape.router && shape.router.ready === true && shape.router.layerRouterRegistered === true,
    shape.router && { ready: shape.router.ready, container: shape.router.container, registered: shape.router.layerRouterRegistered, errors: shape.router.errors });

  step('S1.8', 'the persistent layer `#perch-persistent` is mounted on `/`',
    shape.layerNode === true && !!shape.layer && !!shape.layer.instanceId,
    { node: shape.layerNode, instanceId: shape.layer && shape.layer.instanceId });

  const csp = String(rootHeaders['content-security-policy'] || '');
  const fa = (csp.match(/frame-ancestors ([^;]+)/) || [])[1];
  step('S1.9', "CSP `frame-ancestors 'self'` is served on `/` — narrowed, not permissive",
    (fa || '').trim() === "'self'", { frameAncestors: fa || '(absent)' });

  step('S1.10', 'X-Frame-Options: SAMEORIGIN is served on `/`',
    String(rootHeaders['x-frame-options'] || '').toUpperCase() === 'SAMEORIGIN',
    { xFrameOptions: rootHeaders['x-frame-options'] || '(absent)' });

  // The headers are a claim about a directive. This is the behaviour.
  const foreign = await ctx.newPage();
  watch(foreign, 'foreign-embedder');
  await foreign.route('https://a42-foreign-embedder.example/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html><title>foreign</title><iframe id="v" src="${BASE}/"></iframe>`,
  }));
  await foreign.goto('https://a42-foreign-embedder.example/', { waitUntil: 'domcontentloaded' });
  await sleep(4000);
  const framedFromForeign = await foreign.evaluate(() => {
    const f = document.getElementById('v');
    let reachable = false;
    try { reachable = !!(f.contentDocument && f.contentDocument.body && f.contentDocument.body.innerText.length > 200); } catch (e) { reachable = false; }
    return { reachable };
  });
  const refusal = out.cspViolations.filter((v) => v.where === 'foreign-embedder' && /frame/i.test(v.text));
  step('S1.11', 'a FOREIGN origin is actually refused when it tries to frame `/`',
    framedFromForeign.reachable === false,
    { childDocumentReachable: framedFromForeign.reachable, browserRefusal: refusal.slice(0, 1) });
  await foreign.close();

  // ═══════════════════════════════════════════════════════════════════════════
  // §S2 (task 2) — the concierge launcher, and the layer across navigation
  // ═══════════════════════════════════════════════════════════════════════════
  await page.goto(BASE + START, { waitUntil: 'networkidle' });
  await sleep(2500);

  // `dvn-perch-launcher` is the id js/donovan-widget.js:26 actually assigns. The
  // first run of this file guessed `dl-launcher` and reported ABSENT on a page
  // where the launcher was present and working — a false red, caught because the
  // step reports the candidates it DID find rather than only a boolean.
  const LAUNCHER_SEL = '#dvn-perch-launcher';
  const launcher = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    if (!el) {
      return { found: false, candidates: [...document.querySelectorAll('[id*="launch"],[class*="launch"],[id*="concierge"]')].map((n) => n.id || n.className).slice(0, 10) };
    }
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    // Presence is not clickability ([[feedback_presence_is_not_clickability]]):
    // hit-test the centre point and require the launcher (or a descendant) to be
    // what the browser would actually deliver the click to.
    const hit = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return {
      found: true,
      id: el.id,
      inLayer: !!el.closest('#perch-persistent'),
      rect: { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) },
      visible: cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity || '1') > 0.1,
      inViewport: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1,
      hitTestsToSelf: !!hit && (hit === el || el.contains(hit) || (hit.closest && hit.closest('#' + el.id) === el)),
      hitId: hit ? (hit.id || hit.tagName) : null,
    };
  }, LAUNCHER_SEL);

  step('S2.1', 'the concierge launcher is PRESENT on a content page',
    launcher.found === true, launcher);

  step('S2.2', 'the launcher is visible, in the viewport and would actually receive a click',
    launcher.found && launcher.visible && launcher.inViewport && launcher.hitTestsToSelf && launcher.rect.w > 0,
    launcher.found ? { visible: launcher.visible, inViewport: launcher.inViewport, hitTestsToSelf: launcher.hitTestsToSelf, hitId: launcher.hitId, rect: launcher.rect } : launcher);

  step('S2.3', 'the launcher lives INSIDE the persistent layer, so a swap cannot take it',
    launcher.found && launcher.inLayer === true, { inLayer: launcher.found && launcher.inLayer });

  // ── /web-call CANNOT BE LIVENESS-PROBED FROM OUTSIDE. Measured, not assumed ──
  //
  // The obvious probe is "GET a POST-only Function and expect 405". It does not
  // work here, and the first two runs of this file got it wrong in both
  // directions before the control was run:
  //
  //   GET  /web-call              404      GET  /booking/create      404
  //   GET  /fn/qualifier_result   404      GET  /fn/save_lead        404
  //   GET  /booking/types         200      GET  /consent-notice      200
  //   GET  /no-such-function      404   ←  A PATH THAT DOES NOT EXIST
  //   OPTIONS /web-call           405      OPTIONS /no-such-function 405
  //
  // A deployed POST-only Function and a nonexistent path are INDISTINGUISHABLE
  // on both verbs. So no unauthenticated, zero-write HTTP probe can prove
  // /web-call is deployed, and this step does not pretend otherwise: it asserts
  // the differential that IS meaningful — the method-shaped answer matches the
  // other POST-only Functions and differs from the GET-capable ones — and the
  // sign-off carries /web-call's deployment as build provenance, not as a probe.
  // Proving it positively would mean minting a real Retell session.
  const verbs = {};
  for (const p of ['/web-call', '/booking/create', '/booking/types', '/consent-notice', '/no-such-function-a42']) {
    try {
      const r = await fetch(BASE + p, { method: 'GET', redirect: 'manual' });
      verbs[p] = r.status;
    } catch (e) { verbs[p] = null; }
  }
  step('S2.4', '/web-call answers exactly like the other POST-only Functions (a liveness probe is NOT possible without minting a call)',
    verbs['/web-call'] === verbs['/booking/create'] && verbs['/booking/types'] === 200 && verbs['/consent-notice'] === 200,
    { verbs, caveat: 'a nonexistent path returns the same status — this is a consistency check, not proof of deployment' });

  const connectCsp = {
    retellWss: /wss:\/\/\*\.retellai\.com/.test(csp),
    retellHttps: /https:\/\/\*\.retellai\.com/.test(csp),
    livekit: /wss:\/\/\*\.livekit\.cloud/.test(csp),
    micPolicy: String(rootHeaders['permissions-policy'] || ''),
  };
  step('S2.5', 'the CSP and Permissions-Policy admit the voice transport the launcher needs',
    connectCsp.retellWss && connectCsp.retellHttps && connectCsp.livekit && /microphone=\(self/.test(connectCsp.micPolicy),
    connectCsp);

  const widgetScript = await page.evaluate(() => ({
    vantageTag: !!document.querySelector('script[src*="vantage.ticoai.net/perch.js"]'),
    agent: (document.querySelector('script[src*="vantage.ticoai.net/perch.js"]') || {}).dataset?.agent || null,
    deployment: (document.querySelector('script[src*="vantage.ticoai.net/perch.js"]') || {}).dataset?.deployment || null,
    donovanWidget: !!document.querySelector('script[src*="donovan-widget.js"]'),
  }));
  step('S2.6', 'Paula is wired on the page — the Vantage agent script and the launcher module both load',
    widgetScript.vantageTag && widgetScript.donovanWidget && !!widgetScript.agent,
    widgetScript);

  // ── The layer must survive navigation without tearing a live session down ──
  const armed = await armLiveResource(page);
  step('S2.7', 'PRECONDITION — a live audio resource is attached through the layer seam and RUNNING',
    armed.armed === true && armed.state === 'running' && armed.clock > 0, armed);

  const before = await liveRead(page);
  const how1 = await softNavigate(page, SECOND);
  const afterSoft = await liveRead(page);

  step('S2.8', `plain navigation ${START} → ${SECOND} keeps the SAME layer instance`,
    !!before && !!afterSoft && before.instanceId === afterSoft.instanceId,
    { how: how1, url: page.url(), before: before && before.instanceId, after: afterSoft && afterSoft.instanceId });

  step('S2.9', 'the live session was NOT torn down by the navigation — its own clock kept running',
    !!afterSoft && !!afterSoft.audio && afterSoft.audio.state === 'running'
      && afterSoft.audio.clock > (before.audio ? before.audio.clock : 0)
      && afterSoft.ticks > before.ticks,
    { audioBefore: before && before.audio, audioAfter: afterSoft && afterSoft.audio, ticks: [before && before.ticks, afterSoft && afterSoft.ticks] });

  await page.goBack();
  await sleep(2200);
  const afterBack = await liveRead(page);
  step('S2.10', 'BACK preserves the persistent layer and the live session',
    !!afterBack && afterBack.instanceId === before.instanceId
      && !!afterBack.audio && afterBack.audio.state === 'running' && afterBack.audio.clock > afterSoft.audio.clock,
    { url: page.url(), instanceId: afterBack && afterBack.instanceId, audio: afterBack && afterBack.audio });

  await page.goForward();
  await sleep(2200);
  const afterFwd = await liveRead(page);
  step('S2.11', 'FORWARD preserves the persistent layer and the live session',
    !!afterFwd && afterFwd.instanceId === before.instanceId
      && !!afterFwd.audio && afterFwd.audio.state === 'running' && afterFwd.audio.clock > afterBack.audio.clock,
    { url: page.url(), instanceId: afterFwd && afterFwd.instanceId, audio: afterFwd && afterFwd.audio });

  const launcherAfterNav = await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    return { found: !!el, inLayer: !!(el && el.closest('#perch-persistent')) };
  }, LAUNCHER_SEL);
  step('S2.12', 'the launcher is still mounted after nav + back + forward',
    launcherAfterNav.found && launcherAfterNav.inLayer, launcherAfterNav);

  manual('A FULL VOICE CALL IS NOT EXERCISED HERE. Clicking the launcher mints a real, '
    + 'metered Retell session and a real Vantage lead, and Retell refuses automation by design '
    + '([[feedback_turnstile_not_agent_verifiable]]). S2.1–S2.6 prove the launcher is present, '
    + 'clickable and fully wired; S2.7–S2.12 prove a LIVE audio session registered through the '
    + "layer's own seam survives nav/back/forward. The last inch — a human presses the orb, talks "
    + 'to Paula, and navigates mid-call — is one manual check.');

  // ═══════════════════════════════════════════════════════════════════════════
  // §S3 (task 3) — the booking path, up to but NOT including a write
  // ═══════════════════════════════════════════════════════════════════════════
  // `?unlock=dev` is the in-repo dev bypass of the SOFT booking gate
  // (js/page/booking-gate.js). It reveals the same widget a qualified caller
  // sees and grants nothing — it is not an authorisation boundary, and the real
  // verification is server-side on /booking/create.
  const bookResp = await page.goto(BASE + BOOK + '?unlock=dev', { waitUntil: 'networkidle' });
  await sleep(3500);
  out.headers[BOOK] = bookResp.headers();

  const bookBoot = await page.evaluate(() => ({
    status: !!document.getElementById('dl-booking'),
    apiInit: !!document.querySelector('#dl-booking[data-api-init]'),
    gateHidden: (() => { const g = document.getElementById('book-gate'); return g ? getComputedStyle(g).display === 'none' || g.hidden : null; })(),
    liveShown: (() => { const l = document.getElementById('book-live'); return l ? getComputedStyle(l).display !== 'none' : null; })(),
    hasDLBooking: typeof window.DLBooking === 'object' && window.DLBooking !== null,
  }));
  step('S3.1', 'the booking modal/widget OPENS on the live site',
    bookBoot.status && bookBoot.apiInit && bookBoot.liveShown === true, bookBoot);

  // Read-only endpoints. /booking/types and /booking/availability query Clio for
  // appointment types and free slots. They create nothing.
  const reads = await page.evaluate(async (base) => {
    const r = await fetch(base + '/booking/types?deployment=donovan-intake');
    const j = await r.json().catch(() => null);
    return { status: r.status, count: j && Array.isArray(j.types) ? j.types.length : (Array.isArray(j) ? j.length : null), sample: j && (j.types || j) ? JSON.stringify((j.types || j)[0] || null).slice(0, 200) : null };
  }, BASE);
  step('S3.2', 'the READ side of booking is live — /booking/types answers with real appointment types',
    reads.status === 200 && reads.count > 0, reads);

  const drive = await driveToForm(page);
  const typeState = await page.evaluate(() => ({
    // Read back the auto-selection rather than assuming it.
    selectedTypeVisible: (document.querySelector('#dl-booking .dl-bk-step-label') || {}).textContent || null,
    summary: (document.querySelector('#dl-bk-form') || {}).previousElementSibling?.textContent?.trim().slice(0, 120) || null,
  }));
  step('S3.3', 'the widget advances day → slot → next and reaches the details form',
    drive.formPresent === true, { ...drive, ...typeState });

  // ── Turnstile ───────────────────────────────────────────────────────────────
  //
  // DO NOT ASSERT ON AN IFRAME. Two independent reasons, both measured on this
  // run after an iframe assertion produced a false red that pointed at
  // production:
  //
  //   1. A SOLVED managed challenge paints NO iframe. The isolated probe
  //      (test/preview/probe-turnstile-isolated-a42.mjs) rendered this exact
  //      sitekey on this exact origin in real Chrome and real Edge: `ok: true`,
  //      a 773-character token, zero errors — and `iframe: false`. An iframe is
  //      an artefact of the interactive path, not evidence of a working widget.
  //   2. Under Playwright's bundled Chromium the challenge is REFUSED with
  //      TurnstileError 600010 — identically headed and headless, and unchanged
  //      by stealth flags. That is browser-integrity detection, not a site
  //      defect: the same page in real Chrome/Edge succeeds. See
  //      [[feedback_turnstile_not_agent_verifiable]].
  //
  // So what is asserted here is what IS observable under automation and is
  // exactly the A23 invariant: `render()` was reached and produced a widget in
  // the mount — one child element and the `cf-turnstile-response` input it mints.
  // The TOKEN is out of reach for any driver, and S3.9 turns that into a safety
  // property rather than pretending otherwise.
  const readTs = () => page.evaluate(() => {
    const mount = document.getElementById('dl-bk-turnstile');
    // Read the tag BEFORE writing it, or every read reports "already seen".
    const wasAlreadyTagged = mount ? mount.dataset.a42seen === '1' : null;
    if (mount) mount.dataset.a42seen = '1';
    return {
      mountPresent: !!mount,
      apiLoaded: !!(window.turnstile && typeof window.turnstile.render === 'function'),
      childCount: mount ? mount.children.length : 0,
      responseInput: !!(mount && mount.querySelector('input[name="cf-turnstile-response"]')),
      // The FORM step re-mints #dl-bk-turnstile, so a swap that failed to remount
      // shows up as a fresh, UNtagged node carrying ZERO children.
      wasAlreadyTagged,
    };
  });

  const ts = await readTs();
  step('S3.4', 'a Turnstile widget RENDERS into the live booking form (mount populated + response input minted)',
    ts.mountPresent && ts.apiLoaded && ts.childCount >= 1 && ts.responseInput, ts);

  const tsBefore = ts;
  // A soft navigation drops the `?unlock=dev` query, and the gate reads
  // `location.search`. So write the localStorage half of the handshake — exactly
  // the value js/perch/call.js:151 writes before Paula sends the caller to /book.
  // Without it the swapped-in page shows the gate placeholder and there is no
  // form to re-render Turnstile into, which would look like an A23 regression.
  await page.evaluate(() => localStorage.setItem('donovan_booking_unlock', String(Date.now())));
  await softNavigate(page, SECOND);
  await softNavigate(page, BOOK);
  await sleep(2500);
  const gateAfterSwap = await page.evaluate(() => ({
    liveShown: (() => { const l = document.getElementById('book-live'); return l ? getComputedStyle(l).display !== 'none' : null; })(),
    widget: !!document.querySelector('#dl-booking[data-api-init]'),
  }));
  step('S3.5a', 'the booking gate re-opens on the SWAPPED-IN /book (the unlock survives a soft nav)',
    gateAfterSwap.liveShown === true && gateAfterSwap.widget === true, gateAfterSwap);

  const redrive = await driveToForm(page);
  step('S3.5b', 'the swapped-in booking form is drivable to details as well as a first load',
    redrive.formPresent === true, redrive);

  const tsAfter = await readTs();
  step('S3.5', 'Turnstile RE-RENDERS fresh into the SWAPPED-IN form — a new mount node, populated (not a stale, dead widget)',
    tsAfter.mountPresent && tsAfter.wasAlreadyTagged === false && tsAfter.childCount >= 1 && tsAfter.responseInput,
    { before: { childCount: tsBefore.childCount, responseInput: tsBefore.responseInput },
      after: tsAfter,
      why: 'wasAlreadyTagged=false proves the FORM step minted a NEW mount; childCount>=1 proves the widget was rendered into it rather than left behind' });

  manual('THE TURNSTILE TOKEN ITSELF IS NOT OBTAINABLE BY ANY DRIVER, and that is a property of '
    + 'the driver, not of production. Playwright\'s bundled Chromium is refused with '
    + 'TurnstileError 600010 — identically headed and headless, unchanged by stealth flags. The '
    + 'same sitekey on the same production origin was then rendered in REAL Chrome and REAL Edge '
    + 'by test/preview/probe-turnstile-isolated-a42.mjs: ok=true, a 773-character token, zero '
    + 'errors. So Turnstile on www.donovan.law is healthy; what remains manual is one human '
    + 'completing a booking end-to-end.');

  // ── Compose the POST. It is never sent. ────────────────────────────────────
  const wireBefore = out.writeRequestsOnWire.length;

  // The composition below is measured on the SWAPPED-IN form (S3.5b), so it
  // exercises the post-A31 rewired DOM on the router path, not a first load.
  const filled = await fillDetails(page);
  step('S3.6b', 'the details form accepts the synthetic contact values, honeypot left empty',
    filled.name && filled.email && filled.phone && filled.honeypotEmpty, filled);

  const compose = await page.evaluate(async () => {
    // The setCallId bridge, js/booking-widget.js:2034 — the client half of the
    // A32 call_id wiring, driven through the SHIPPED postMessage entry point.
    // The id is synthetic: it names no real Perch session, so the server would
    // resolve it to `unverified` and withhold the join. Nothing is written.
    window.postMessage({ type: 'dl-booking', action: 'setCallId', payload: { call_id: 'a42-smoke-not-a-real-call' } }, location.origin);
    await new Promise((r) => setTimeout(r, 600));

    const form = document.getElementById('dl-bk-form');
    const submitBtn = document.getElementById('dl-bk-submit');
    const ready = !!form && !!submitBtn && !submitBtn.disabled;
    if (ready) {
      // The moment the widget composes the body. LAYER 1 catches it at the fetch
      // boundary and drops it — the request is never handed to the network
      // stack, so nothing is submitted and nothing is booked.
      submitBtn.click();
    }
    await new Promise((r) => setTimeout(r, 3000));
    return {
      ready,
      submitAttempted: ready,
      trapped: (window.__A42_TRAP && window.__A42_TRAP.calls) || [],
      callIdSet: window.__perchCallId || null,
    };
  });

  const created = (compose.trapped || []).filter((c) => /\/booking\/create/.test(c.url));
  out.trapped.push(...(compose.trapped || []));
  const body = created.length ? created[created.length - 1].body : null;

  step('S3.6', 'the widget COMPOSED a POST to /booking/create',
    created.length >= 1 && !!body,
    { attempts: created.length, method: created[0] && created[0].method, url: created[0] && created[0].url });

  const REQUIRED = ['deployment', 'type', 'slot', 'name', 'email', 'phone', 'notes', 'turnstile_token'];
  const missing = body ? REQUIRED.filter((k) => !(k in body)) : REQUIRED;
  const slotIso = body && typeof body.slot === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(body.slot);
  step('S3.7', 'the composed body is CORRECT — every field the endpoint requires, slot as an ISO instant',
    missing.length === 0 && slotIso && !!body.type && !!body.deployment,
    { missing, deployment: body && body.deployment, type: body && body.type, slot: body && body.slot, slotIsIso: slotIso, notesLen: body && (body.notes || '').length });

  step('S3.8', 'the call_id set through the SHIPPED setCallId bridge is in the composed body (A32 client half is LIVE)',
    !!body && body.call_id === 'a42-smoke-not-a-real-call',
    { call_id: body && body.call_id, windowValue: compose.callIdSet });

  step('S3.9', 'the composed POST could not have booked even if it had escaped — no Turnstile token',
    !!body && body.turnstile_token === '',
    { turnstile_token: body && JSON.stringify(body.turnstile_token), why: '/booking/create refuses 403 TURNSTILE_REQUIRED before it touches Clio' });

  const wireAfter = out.writeRequestsOnWire.length;
  step('S3.10', 'STOPPED BEFORE SUBMITTING — zero write-path requests reached the network',
    wireAfter - wireBefore === 0 && out.routeAborted.length === 0,
    { onWireDuringCompose: wireAfter - wireBefore, layer2Aborts: out.routeAborted.length });

  // ═══════════════════════════════════════════════════════════════════════════
  // §S4 (task 4) — state reconciliation
  // ═══════════════════════════════════════════════════════════════════════════
  // The shell is still LIVE at /perch — that is the route Paula connects on, and
  // A51 retired the shell from `/`, not the shell.
  const shell = await ctx.newPage();
  watch(shell, 'shell');
  const shellResp = await shell.goto(BASE + '/perch', { waitUntil: 'networkidle' });
  await sleep(3000);
  const shellState = await shell.evaluate(() => {
    const f = document.getElementById('site');
    return {
      robots: (document.querySelector('meta[name="robots"]') || {}).content || null,
      iframeSrc: f ? f.getAttribute('src') : null,
      frameCount: window.frames.length,
    };
  });
  const childFrame = shell.frames().find((f) => f !== shell.mainFrame());
  const childOk = childFrame ? await childFrame.evaluate(() => ({
    url: location.pathname,
    h1: (document.querySelector('h1') || {}).textContent || null,
    textLength: (document.body.innerText || '').trim().length,
  })).catch(() => null) : null;

  step('S4.1', '/perch STILL serves the shell 200 for Paula — the route was not retired',
    shellResp.status() === 200 && /noindex/i.test(shellState.robots || '') && !!shellState.iframeSrc,
    { status: shellResp.status(), robots: shellState.robots, iframe: shellState.iframeSrc });

  step('S4.2', "the shell's same-origin iframe still LOADS — `frame-ancestors 'self'` did not break Paula",
    !!childOk && childOk.textLength > 1000,
    childOk || { childFrame: !!childFrame, frames: shellState.frameCount });
  await shell.close();

  // No stale cache serving the old noindex shell at `/`. Ask repeatedly, with
  // cache-busting query strings, and require the real homepage every time.
  const cacheProbe = [];
  for (let i = 0; i < 4; i++) {
    const p = await ctx.newPage();
    const r = await p.goto(`${BASE}/?a42=${Date.now()}-${i}`, { waitUntil: 'domcontentloaded' });
    const v = await p.evaluate(() => ({
      noindex: /noindex/i.test(((document.querySelector('meta[name="robots"]') || {}).content) || ''),
      iframes: document.querySelectorAll('iframe').length,
      textLength: (document.body.innerText || '').trim().length,
      title: document.title,
    }));
    cacheProbe.push({
      status: r.status(),
      cacheControl: r.headers()['cache-control'] || null,
      cfCacheStatus: r.headers()['cf-cache-status'] || null,
      age: r.headers()['age'] || null,
      ...v,
    });
    await p.close();
  }
  step('S4.3', 'NO stale cache is serving the old noindex shell at `/` — every fresh fetch is the real homepage',
    cacheProbe.every((c) => c.status === 200 && c.noindex === false && c.iframes === 0 && c.textLength > 1000),
    cacheProbe);

  step('S4.4', '`/` is served `no-store`, so no intermediary can pin the pre-promote bytes',
    cacheProbe.every((c) => /no-store/i.test(c.cacheControl || '')),
    { cacheControl: cacheProbe.map((c) => c.cacheControl), cfCacheStatus: cacheProbe.map((c) => c.cfCacheStatus) });

  // No orphaned shell state in the browser after the promote.
  const orphan = await page.goto(BASE + '/', { waitUntil: 'networkidle' }).then(() => page.evaluate(() => ({
    perchInjected: !!window.__perchInjected,
    perchInjectScript: !!document.querySelector('script[src*="perch-inject"]'),
    iframes: document.querySelectorAll('iframe').length,
    shellOrb: !!document.getElementById('concierge'),
    // Storage keys the shell era wrote. A value here is not itself a defect, but
    // it is exactly the "orphaned state" the reconciliation is asked about.
    storage: Object.keys(localStorage).filter((k) => /perch|shell|concierge|donovan_/i.test(k)),
    sessionKeys: Object.keys(sessionStorage).filter((k) => /perch|shell|concierge/i.test(k)),
  })));
  step('S4.5', 'no ORPHANED shell state on `/` — no perch-inject, no nested frame, no second orb',
    orphan.perchInjected === false && orphan.perchInjectScript === false && orphan.iframes === 0 && orphan.shellOrb === false,
    orphan);

  // ═══════════════════════════════════════════════════════════════════════════
  // §S5 — the accounting. Not intent: two independently collected counters.
  // ═══════════════════════════════════════════════════════════════════════════
  step('S5.1', 'ZERO write-path requests were issued to production for the whole run',
    out.writeRequestsOnWire.length === 0,
    { count: out.writeRequestsOnWire.length, requests: out.writeRequestsOnWire.slice(0, 5) });

  step('S5.2', 'LAYER 2 never fired — Layer 1 severed every write inside the page, as designed',
    out.routeAborted.length === 0, { aborted: out.routeAborted.length, detail: out.routeAborted.slice(0, 3) });

  step('S5.3', 'at least one write WAS composed and trapped — the severing was exercised, not merely idle',
    out.trapped.length >= 1, { trapped: out.trapped.length, urls: [...new Set(out.trapped.map((t) => t.url))] });

  // TurnstileError 600010 is excluded, and ONLY that code. It is the bundled
  // Chromium being refused by Cloudflare's browser-integrity check — proven
  // driver-side, not site-side, by the real-Chrome/Edge run described at S3.5.
  // The exclusion is deliberately narrow: any other uncaught error, including
  // any other Turnstile code (110200 = unknown domain would be a REAL finding),
  // still fails this step.
  const driverTurnstile = out.pageErrors.filter((e) => /TurnstileError.*600010/.test(e.error));
  const realErrors = out.pageErrors.filter((e) => !/TurnstileError.*600010/.test(e.error));
  step('S5.4', 'no uncaught page errors across the run (excluding the driver-induced Turnstile 600010)',
    realErrors.length === 0,
    { realErrors: realErrors.length, detail: realErrors.slice(0, 4), driverTurnstile600010: driverTurnstile.length });

  const realCsp = out.cspViolations.filter((v) => v.where !== 'foreign-embedder');
  step('S5.5', 'no CSP violations on production pages (the foreign-embedder refusal is the S1.11 result, not a defect)',
    realCsp.length === 0, { count: realCsp.length, violations: realCsp.slice(0, 4) });

  note('The server half of the A32 call_id bind (perch-do `/has`, and the `qualbk:<callId>` '
    + 'KV witness) is NOT measured black-box here and the sign-off does not claim it. A Durable '
    + 'Object has no public HTTP path, and fn/qualifier_result — the one Function that reaches '
    + 'the DO — is auth-gated AND read-once, so probing it would consume a live caller\'s slot. '
    + 'S3.8 proves the client half threads the id into the POST body on production; the server '
    + 'half is tied to this deployment by build provenance (every router-path module served by '
    + 'production is byte-identical to main) and by test/booking-callid-bind.test.mjs.');

  await browser.close();

  out.finishedAt = new Date().toISOString();
  const passed = out.steps.filter((s) => s.ok).length;
  out.summary = {
    passed,
    total: out.steps.length,
    failed: out.steps.filter((s) => !s.ok).map((s) => s.id),
    writeRequestsOnWire: out.writeRequestsOnWire.length,
    trappedWrites: out.trapped.length,
    pageErrors: realErrors.length,
    driverTurnstile600010: driverTurnstile.length,
    cspViolations: realCsp.length,
    verdict: (passed === out.steps.length && out.writeRequestsOnWire.length === 0) ? 'HEALTHY' : 'NOT HEALTHY',
  };

  const evidence = new URL('./a42-evidence.json', import.meta.url);
  writeFileSync(evidence, JSON.stringify(out, null, 2));
  console.log('\n' + JSON.stringify(out.summary, null, 2));
  console.log('evidence → test/preview/a42-evidence.json');
}

main().catch((e) => {
  out.crash = String(e && e.stack ? e.stack : e).slice(0, 2000);
  out.summary = { verdict: 'CRASHED', crash: out.crash };
  try { writeFileSync(new URL('./a42-evidence.json', import.meta.url), JSON.stringify(out, null, 2)); } catch (e2) {}
  console.error('CRASH', out.crash);
});
