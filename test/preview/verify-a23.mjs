// ── JORDAN-PERCH-A23 — the Preview verifier ──────────────────────────────────
//
// Order JORDAN-PERCH-A23-TURNSTILE · ticket #53 · Phase A / Phase 2.
//
// Drives a real Chromium against the Preview deployment, with the router ON, and
// records what actually happened to the Turnstile challenge across a chain of
// soft navigations.
//
//   node test/preview/verify-a23.mjs [baseUrl] [--swaps=N]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and the evidence file it writes.
//
// ── WHAT IS AND IS NOT AGENT-VERIFIABLE HERE ─────────────────────────────────
// Turnstile refuses automation by design, so NO agent can solve a challenge and
// watch a real token clear /booking/create. That half is a MANUAL check and is
// reported as one — never as a pass. See [[feedback_turnstile_not_agent_verifiable]].
//
// What IS measurable, and what this file measures:
//   • the challenge is FRESHLY RENDERED on the swapped-in node — a Turnstile
//     iframe exists inside `#dl-bk-turnstile` after the swap, and its widget id
//     is one the shipped recipe reported capturing on THAT swap;
//   • the widget id was captured by the BOOKING WIDGET's closure, which is the
//     only id the write path can read — read back through the widget's own
//     `getResponse` path rather than inferred from the DOM;
//   • exactly ONE challenge exists on the node after repeated re-init passes
//     (the double-render guard);
//   • a formless page issues ZERO Turnstile calls and leaves the container
//     untouched.
//
// ── THE ONE SHIM, AND WHY IT IS NOT A HARNESS ────────────────────────────────
// `window.turnstile.render/reset/remove` are wrapped with counters that DELEGATE
// to the originals. It changes no behaviour and defines no test-only path in the
// shipped code — it is the only way to prove a NEGATIVE ("a formless page never
// reaches Turnstile"), which absence-of-DOM-change cannot establish on its own.
// Every positive assertion below is read from `Perch.router.probe()`, the
// diagnostic surface the shipped router already exposes.

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { routerEnabled } from '../../donovan-legal-site/functions/_lib/perch-router-inject.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const BASE = (process.argv[2] && !process.argv[2].startsWith('--'))
  ? process.argv[2].replace(/\/$/, '')
  : 'https://jordan-perch-a23-turnstile.donovan-site.pages.dev';
const SWAPS = Number((process.argv.find((a) => a.startsWith('--swaps=')) || '--swaps=6').split('=')[1]);

// ── --fixture-booking ────────────────────────────────────────────────────────
// Serve /booking/types and /booking/availability from fixtures so the widget can
// reach its FORM step, which is what paints `#dl-bk-turnstile`.
//
// WHAT THIS DOES AND DOES NOT SUBSTITUTE. It substitutes the CLIO CALENDAR READ —
// two GETs whose only role here is to get the widget past the type picker. It
// substitutes NOTHING about Turnstile: api.js is still fetched from
// challenges.cloudflare.com, `turnstile.render()` is still Cloudflare's, and the
// challenge that appears is a real one. It also substitutes nothing about the
// write path, which this run never reaches.
//
// It exists because a deployment without Clio credentials answers those two GETs
// with an error and the form never paints — so without it the ONE assertion this
// ticket is about is unreachable, and an unreachable assertion reported as a pass
// is how a gate goes hollow. Every run records `fixtureBooking` in the evidence.
const FIXTURE_BOOKING = process.argv.includes('--fixture-booking');

// /contact is the 92-page div-box majority shape and carries the shared chrome,
// without which the router deliberately hard-navigates (swap-policy sharedChrome).
const START = '/contact';
// The chain: formless pages interleaved with /book, so every /book arrival is a
// swap into a container that has been replaced several times already.
const CHAIN = ['/about', '/book', '/practice-areas', '/book', '/contact', '/book'];

const out = {
  order: 'JORDAN-PERCH-A23-TURNSTILE',
  ticket: 53,
  base: BASE,
  startedAt: new Date().toISOString(),
  steps: [],
  swaps: [],
  bookVisits: [],
  console: [],
  cspViolations: [],
  pageErrors: [],
  loadEvents: 0,
  manual: [],
  verdict: {},
};

function step(name, ok, detail) {
  out.steps.push({ name, ok, detail: detail ?? null });
  const tag = ok === null ? 'MANUAL' : ok ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}`, detail === undefined ? '' : JSON.stringify(detail).slice(0, 400));
  return ok;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

// Half-hour slots from a fixed instant so the run is reproducible. Only the
// shape matters — the widget groups by local day and matches by instant.
const FIXTURE_T0 = Date.parse('2026-09-14T13:00:00Z');
const FIXTURE_SLOTS = Array.from({ length: 8 }, (_, i) => ({
  startISO: new Date(FIXTURE_T0 + i * 30 * 60000).toISOString(),
  endISO: new Date(FIXTURE_T0 + (i + 1) * 30 * 60000).toISOString(),
}));
const FIXTURE_SLOT_ISOS = FIXTURE_SLOTS.map((s) => s.startISO);

if (FIXTURE_BOOKING) {
  const slots = FIXTURE_SLOTS;
  const json = (body) => ({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  await ctx.route('**/booking/types*', (r) => r.fulfill(json({
    types: [{ id: 'initial-consult', name: 'Initial Consultation', duration_minutes: 30 }],
  })));
  await ctx.route('**/booking/availability*', (r) => r.fulfill(json({ slots })));
  out.fixtureBooking = { enabled: true, routes: ['/booking/types', '/booking/availability'], slots: slots.length };
} else {
  out.fixtureBooking = { enabled: false };
}

page.on('console', (m) => {
  const t = m.text();
  if (out.console.length < 400) out.console.push(`${m.type()}: ${t}`);
  if (/Refused to (load|execute|apply|run)/i.test(t)) out.cspViolations.push(t);
});
// Turnstile reports a REFUSAL as an uncaught TurnstileError, so it has to be
// separated from a genuine page error before either can be judged. 110200 is
// "unknown domain": the sitekey's allow-list does not admit this host. That is a
// property of where the run happens, not of the code under test — and it is the
// one thing that stops this run from closing the challenge assertion, so it is
// recorded loudly rather than folded into the error count.
const TURNSTILE_ERR = /TurnstileError.*?Error:\s*(\d+)/i;
out.turnstileErrors = [];
page.on('pageerror', (e) => {
  const s = String(e);
  const m = s.match(TURNSTILE_ERR);
  if (m) { out.turnstileErrors.push(m[1]); return; }
  out.pageErrors.push(s);
});
page.on('load', () => { out.loadEvents++; });

const routerProbe = () => page.evaluate(() => (window.Perch && window.Perch.router ? window.Perch.router.probe() : null));

/** The §5 row 12 the shipped recipe recorded for the most recent swap. */
const lastRow12 = async () => page.evaluate(() => {
  const p = window.Perch && window.Perch.router && window.Perch.router.probe();
  const last = p && p.log && p.log[p.log.length - 1];
  const rows = last && last.recipe && last.recipe.rows;
  return {
    to: last && last.url,
    row: (rows || []).find((r) => r.step === 12) || null,
    broken: (last && last.recipe && last.recipe.broken) || [],
  };
});

/** Install the delegating counters. Idempotent; re-applied after any reload. */
async function armCounters() {
  await page.evaluate(() => {
    if (window.__a23 && window.__a23.armed) return;
    window.__a23 = { render: 0, reset: 0, remove: 0, armed: false };
    const arm = () => {
      const ts = window.turnstile;
      if (!ts || ts.__a23wrapped) return false;
      for (const fn of ['render', 'reset', 'remove']) {
        if (typeof ts[fn] !== 'function') continue;
        const orig = ts[fn].bind(ts);
        ts[fn] = function (...a) { window.__a23[fn]++; return orig(...a); };
      }
      ts.__a23wrapped = true;
      window.__a23.armed = true;
      return true;
    };
    if (!arm()) {
      // api.js is adopted mid-swap; poll briefly until it lands.
      let n = 0;
      const t = setInterval(() => { if (arm() || ++n > 60) clearInterval(t); }, 100);
    }
  });
}

const counters = () => page.evaluate(() => (window.__a23 ? { ...window.__a23 } : null));

/**
 * Click into `path` through a real anchor — the visitor's path, not
 * `swup.navigate()`. Links are written `.html` because all internal anchors in
 * this tree are, and Pages 308s them to the clean URL.
 * See [[feedback_presence_is_not_clickability]] for the box/z-index choices.
 */
async function clickTo(path) {
  const href = path === '/' ? path : path + '.html';
  await page.evaluate((h) => {
    let a = document.getElementById('__a23_link');
    if (!a) {
      a = document.createElement('a');
      a.id = '__a23_link';
      a.textContent = 'a23';
      a.style.cssText = 'position:fixed;left:0;top:0;width:60px;height:20px;display:block;'
        + 'z-index:2147483647;opacity:0.02;background:#000;pointer-events:auto';
      document.body.appendChild(a); // outside #perch-main → survives the swap
    }
    a.setAttribute('href', h);
  }, href);
  await page.click('#__a23_link');
  await page.waitForTimeout(600);
}

/** Read the live challenge state out of the swapped-in container. */
const challengeState = () => page.evaluate(() => {
  const main = document.getElementById('perch-main');
  const mount = main && main.querySelector('#dl-bk-turnstile');
  const iframes = mount ? mount.querySelectorAll('iframe') : [];
  return {
    hasBookingHost: !!(main && main.querySelector('[data-api], #dl-booking')),
    mountPresent: !!mount,
    challenges: iframes.length,
    // Turnstile's own wrapper element. It exists as soon as render() has taken
    // the node, whether or not the challenge iframe then loads — so this is what
    // separates "the widget was rendered onto this node" from "the challenge
    // itself was served", which a domain-gated sitekey refuses.
    widgetNodes: mount ? mount.children.length : 0,
    iframeSrc: iframes.length ? String(iframes[0].getAttribute('src') || '').slice(0, 120) : null,
    seamPublished: !!(window.DLBooking && typeof window.DLBooking.remountTurnstile === 'function'),
    turnstileApi: !!(window.turnstile && typeof window.turnstile.render === 'function'),
    widgetStep: (window.DLBooking && window.DLBooking.getState && window.DLBooking.getState())
      ? window.DLBooking.getState().step : null,
  };
});

/**
 * Try to reach the FORM step, which is what paints `#dl-bk-turnstile`.
 * Depends on the live /booking/types + /booking/availability functions; if the
 * Preview deployment has no Clio credentials those 5xx and the form cannot be
 * reached. That is RECORDED, never silently passed.
 */
async function reachForm() {
  return page.evaluate(async (isos) => {
    const api = window.DLBooking;
    if (!api || typeof api.selectSlot !== 'function') return { ok: false, reason: 'no_widget' };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    // The widget loads types itself on boot, and auto-selects when there is only
    // one — so it walks to DATE_PICK without help. Wait for it to settle rather
    // than re-fetching the API behind its back.
    for (let i = 0; i < 60; i++) {
      const s = api.getState();
      if (s && (s.step === 'DATE_PICK' || s.step === 'FORM' || s.step === 'TYPE_PICK')) break;
      await wait(150);
    }
    let st = api.getState();
    if (!st) return { ok: false, reason: 'no_state' };
    if (st.step === 'TYPE_PICK') {
      // More than one type: click the first real option the widget painted.
      const btn = document.querySelector('#perch-main [data-dl-type], #perch-main .dl-bk-type');
      if (!btn) return { ok: false, reason: 'type_picker_has_no_option', state: st };
      btn.click();
      for (let i = 0; i < 60 && api.getState().step === 'LOADING'; i++) await wait(150);
      st = api.getState();
    }
    if (st.step !== 'DATE_PICK' && st.step !== 'FORM') {
      return { ok: false, reason: 'never_reached_date_pick', state: st };
    }

    // Hand it a slot. `selectSlot` matches by INSTANT against the slots the
    // widget itself loaded, so a slot the fixture served is one it holds.
    let picked = null;
    for (const iso of isos) {
      const r = api.selectSlot(iso);
      if (r && r.ok) { picked = iso; break; }
    }
    if (!picked) return { ok: false, reason: 'no_slot_matched', state: api.getState() };
    for (let i = 0; i < 60 && api.getState().step !== 'FORM'; i++) await wait(150);
    // The widget's own mountTurnstile retries for up to 6s; give it room so the
    // "repaired by row 12" and "worked on its own" cases are distinguishable.
    await wait(1200);
    return { ok: api.getState().step === 'FORM', step: api.getState().step, picked };
  }, FIXTURE_SLOT_ISOS);
}

// ─────────────────────────────────────────────────────────────────────────────
// 0. Production is not in scope — proved from the shipped gate, not asserted
// ─────────────────────────────────────────────────────────────────────────────
{
  const prod = routerEnabled({}, 'https://www.donovan.law/book');
  const preview = routerEnabled({}, BASE + '/book');
  step('the router — and therefore this recipe — is OFF on production by default',
    prod === false && preview === true, { 'www.donovan.law': prod, preview });
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Boot
// ─────────────────────────────────────────────────────────────────────────────
await page.goto(BASE + START, { waitUntil: 'load' });
// The production unlock path — the timestamp Paula's shell writes before it
// navigates, NOT the ?unlock=dev bypass.
await page.evaluate(() => localStorage.setItem('donovan_booking_unlock', String(Date.now())));
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(800);
await armCounters();

{
  const probe = await routerProbe();
  out.boot = probe;
  step('the router is injected and ready on Preview', !!(probe && probe.ready), {
    container: probe && probe.container, chrome: probe && probe.chrome,
  });
}

const loadsAfterBoot = out.loadEvents;

// ─────────────────────────────────────────────────────────────────────────────
// 2. The chain — N soft swaps, with /book arriving on an already-swapped DOM
// ─────────────────────────────────────────────────────────────────────────────
const chain = [];
for (let i = 0; i < SWAPS; i++) chain.push(CHAIN[i % CHAIN.length]);

let n = 0;
for (const path of chain) {
  n++;
  const before = await counters();
  await clickTo(path);
  await armCounters(); // api.js may have only just been adopted
  const r12 = await lastRow12();
  const state = await challengeState();
  const after = await counters();
  const delta = {
    render: (after?.render ?? 0) - (before?.render ?? 0),
    reset: (after?.reset ?? 0) - (before?.reset ?? 0),
    remove: (after?.remove ?? 0) - (before?.remove ?? 0),
  };
  const rec = { n, path, url: r12.to, row12: r12.row, broken: r12.broken, state, delta };
  out.swaps.push(rec);

  if (path === '/book') {
    // Reach the form, then run one more re-init pass so row 12 sees a painted
    // mount — this is the Paula-driven ordering (A31) rather than a new path.
    const reached = await reachForm();
    const armed = await challengeState();
    const seam = await page.evaluate(() => (window.DLBooking && window.DLBooking.remountTurnstile
      ? window.DLBooking.remountTurnstile() : { ok: false, reason: 'no_seam' }));
    const afterSeam = await challengeState();
    // The id the widget captured must resolve to a live challenge through the
    // SAME getResponse the write path calls. An unsolved challenge yields '',
    // not undefined — undefined means the id is orphaned, which is the 403.
    const tokenChannel = await page.evaluate((id) => {
      if (!window.turnstile || id == null) return { resolvable: false, reason: 'no id' };
      const v = window.turnstile.getResponse(id);
      return { resolvable: v !== undefined, valueType: typeof v, solved: !!v };
    }, seam && seam.id != null ? seam.id : null);
    const guard = await page.evaluate(() => {
      const r = [];
      for (let i = 0; i < 3; i++) r.push(window.DLBooking.remountTurnstile());
      const m = document.querySelector('#perch-main #dl-bk-turnstile');
      return {
        results: r,
        challenges: m ? m.querySelectorAll('iframe').length : 0,
        widgetNodes: m ? m.children.length : 0,
      };
    });
    out.bookVisits.push({ n, reached, armed, seam, afterSeam, tokenChannel, guard });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. The verdict
// ─────────────────────────────────────────────────────────────────────────────
const reloads = out.loadEvents - loadsAfterBoot;
step(`${chain.length} navigations were SWAPS, not reloads`, reloads === 0,
  { navigations: chain.length, loadEvents: reloads });

const formless = out.swaps.filter((s) => s.path !== '/book');
step('every formless swap reports row 12 `absent`',
  formless.length > 0 && formless.every((s) => s.row12 && s.row12.status === 'absent'),
  formless.map((s) => ({ n: s.n, path: s.path, status: s.row12 && s.row12.status })));

step('a formless swap issues ZERO Turnstile calls',
  formless.every((s) => s.delta.render === 0 && s.delta.reset === 0 && s.delta.remove === 0),
  formless.map((s) => ({ n: s.n, path: s.path, ...s.delta })));

const books = out.swaps.filter((s) => s.path === '/book');
step('every swap into /book adopts api.js and finds the seam published',
  books.length > 0 && books.every((s) => s.state.turnstileApi && s.state.seamPublished),
  books.map((s) => ({ n: s.n, api: s.state.turnstileApi, seam: s.state.seamPublished })));

step('no swap left a broken recipe row', out.swaps.every((s) => (s.broken || []).length === 0),
  out.swaps.filter((s) => (s.broken || []).length).map((s) => ({ n: s.n, broken: s.broken })));

const reachedForm = out.bookVisits.filter((v) => v.reached && v.reached.ok);
// "Unknown domain": the sitekey's allow-list does not admit this host, so
// Cloudflare serves no challenge no matter what the page does.
const domainGated = out.turnstileErrors.includes('110200');

if (reachedForm.length) {
  // PROVABLE ANYWHERE. `render()` took the node and the widget's closure holds
  // the resulting id — which is the whole defect: before this change the fresh
  // post-swap node could end up with no widget and a null id, and nothing ever
  // retried.
  step('after N swaps the swapped-in mount carries a freshly rendered Turnstile widget',
    reachedForm.every((v) => v.afterSeam.mountPresent && v.afterSeam.widgetNodes >= 1
      && v.seam && v.seam.ok && v.seam.id != null),
    reachedForm.map((v) => ({
      n: v.n, mount: v.afterSeam.mountPresent, widgetNodes: v.afterSeam.widgetNodes,
      action: v.seam && v.seam.action, id: v.seam && v.seam.id,
    })));

  // FRESHNESS, stated as a fact about identity rather than about presence.
  // Cloudflare mints a new `cf-chl-widget-…` id per render, so a repeat visit
  // that reused the previous generation's widget would repeat its id. Distinct
  // ids across visits is what "freshly rendered on the new DOM" means.
  {
    const ids = reachedForm.map((v) => v.seam && v.seam.id).filter(Boolean);
    step('each /book arrival carries a DISTINCT widget id — not the previous DOM\'s',
      ids.length === reachedForm.length && new Set(ids).size === ids.length, ids);
  }

  step('DOUBLE-RENDER GUARD — three extra passes render nothing and leave one widget',
    reachedForm.every((v) => v.guard.widgetNodes === 1
      && v.guard.results.every((r) => r.ok && r.action === 'reset')),
    reachedForm.map((v) => ({ n: v.n, widgetNodes: v.guard.widgetNodes, actions: v.guard.results.map((r) => r.action) })));

  // BLOCKED BY THE HOST, NOT BY THE CODE. A challenge iframe only appears once
  // Cloudflare agrees to serve one, and `getResponse` only resolves for a widget
  // that got that far.
  if (domainGated) {
    step('the challenge itself is served and can mint a token', null, {
      turnstileError: '110200 (unknown domain)',
      host: BASE,
      meaning: 'the sitekey 0x4AAAAAAD3X3AEk_IbefC4I does not allow-list this host, '
        + 'so Cloudflare served no challenge — unrelated to the swap path',
      observed: reachedForm.map((v) => ({ n: v.n, challenges: v.afterSeam.challenges })),
    });
    out.manual.push('BLOCKED HERE: Turnstile answered 110200 (unknown domain) for ' + BASE + '. '
      + 'The re-render, the captured id and the double-render guard are all proved above; what this '
      + 'host cannot show is Cloudflare actually SERVING the challenge. Re-run against a '
      + '*.donovan-site.pages.dev Preview, whose host the sitekey admits.');
  } else {
    step('the challenge itself is served on the swapped-in node',
      reachedForm.every((v) => v.afterSeam.challenges === 1),
      reachedForm.map((v) => ({ n: v.n, challenges: v.afterSeam.challenges })));
    step('the captured id is one the write path can read (getResponse resolves)',
      reachedForm.every((v) => v.tokenChannel.resolvable),
      reachedForm.map((v) => ({ n: v.n, ...v.tokenChannel })));
  }
} else {
  step('the FORM step could not be reached on this deployment', null,
    out.bookVisits.map((v) => ({ n: v.n, reason: v.reached && v.reached.reason })));
  out.manual.push('The booking FORM step was unreachable here (see bookVisits[].reached). '
    + 'Re-run with --fixture-booking, or against a deployment whose /booking/types and '
    + '/booking/availability functions have Clio credentials.');
}

out.manual.push('A REAL end-to-end token SOLVE is a MANUAL check in every environment: Turnstile '
  + 'refuses automation by design, so no agent can solve the challenge and watch /booking/create '
  + 'accept the token. To confirm by hand: open the deployment, soft-navigate several times, reach '
  + '/book, solve the challenge and submit — the booking must be created rather than 403 '
  + 'TURNSTILE_REQUIRED.');

step('no CSP violation was logged', out.cspViolations.length === 0, out.cspViolations.slice(0, 5));
step('no uncaught page error (Turnstile refusals counted separately)',
  out.pageErrors.length === 0, { pageErrors: out.pageErrors.slice(0, 5), turnstileErrors: out.turnstileErrors });

const graded = out.steps.filter((s) => s.ok !== null);
out.verdict = {
  pass: graded.filter((s) => s.ok).length,
  fail: graded.filter((s) => !s.ok).length,
  manual: out.steps.filter((s) => s.ok === null).length,
  swaps: out.swaps.length,
  reloads,
  result: graded.every((s) => s.ok) ? 'PASS' : 'FAIL',
};
out.finishedAt = new Date().toISOString();

mkdirSync(HERE, { recursive: true });
writeFileSync(join(HERE, 'a23-evidence.json'), JSON.stringify(out, null, 2));
console.log('\n' + JSON.stringify(out.verdict, null, 2));
console.log('evidence → test/preview/a23-evidence.json');

await browser.close();
