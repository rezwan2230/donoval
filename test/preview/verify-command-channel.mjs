// ── SHELDON-PERCH-COMMAND-CHANNEL — the Preview verifier ─────────────────────
//
// Order SHELDON-PERCH-COMMAND-CHANNEL · priority regression from the A51 cutover.
//
//   node test/preview/verify-command-channel.mjs [baseUrl]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and the evidence file it writes.
//
// Named `verify-*.mjs`, not `*.test.mjs`, so `npm test` never runs it: it needs a
// live deployment and a browser, neither of which CI has. It lives under test/ at
// the repo root and NOT under donovan-legal-site/, because the Pages deploy root
// is that directory and `wrangler pages deploy` has no --exclude.
//
// ── WHAT IS REAL HERE, AND WHAT IS NOT — STATED UP FRONT ─────────────────────
// The temptation with a bridge is to mock the whole thing and call it proven.
// This is the honest line:
//
//   REAL, against the live Preview deployment
//     • the shipped js/perch-layer.js, js/perch/command-channel.js,
//       js/perch/qualifier.js, js/perch/page-control.js and js/perch-swup-router.js,
//       loaded by the edge injector on a real content page with the router on;
//     • the poll loop's OWN outbound request to `/fn/page-poll`, unintercepted,
//       carrying `x-perch-call-id` — the real endpoint answers it (step 4);
//     • the navigation: Swup's real content:replace, a real URL change, the real
//       persistent layer surviving it, measured by instanceId + a live AudioContext;
//     • the qualifier: the shipped card, rendered, measured by its viewport RECT
//       rather than by class name — presence is not visibility;
//     • the submit: the real POST the card makes, with its real body, captured.
//
//   NOT REAL, and why
//     • the /fn/page-poll RESPONSE BODY for steps 5-8 is served by the harness.
//       Queuing a command for real means POSTing /fn/do_page_action, which
//       requires PERCH_TOOL_SECRET, and this order forbids entering or reading a
//       secret. Everything downstream of `fetch()` — the whole consumer this
//       ticket wrote — is the shipped code path; only the DO round trip is not
//       exercised, and step 4 proves that leg is wired to the real endpoint.
//     • the call id. A real one needs a Retell session, which needs a Turnstile
//       solve, which refuses automation by design
//       ([[feedback_turnstile_not_agent_verifiable]]). So the harness calls the
//       SHIPPED `bindCall()` module export — the same seam js/donovan-widget.js
//       calls from `call_started` — with a synthetic id. That is the one thing a
//       passive observer could not do, and it is named here rather than buried.
//     • `get_qualifier_result`. Reading it needs the same forbidden secret. The
//       submit→read round trip is held in CI instead, against the real handlers
//       and a DO double with real read-once semantics
//       (test/perch-command-channel.test.mjs §5), and the LIVE read is item 6 on
//       the manual-call checklist.
//
// ── NOTHING IS WRITTEN ───────────────────────────────────────────────────────
// `/booking/create` must never be touched, and `/fn/qualifier_submit` is ABORTED
// after its body is captured: it forwards the caller's fields to Vantage
// `/upsert-lead`, and a verifier that quietly files a synthetic lead into a live
// CRM is the mistake this codebase has already made once with a real Clio
// appointment ([[feedback_negative_path_probe_can_write]]). The request is proved
// by observation, not by delivery, and `out.writes` must stay empty.

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] && !process.argv[2].startsWith('--'))
  ? process.argv[2].replace(/\/$/, '')
  // The immutable per-deployment URL, not the branch alias: Pages truncates the
  // alias hostname to ~28 characters and this branch name is longer
  // ([[feedback_pages_alias_slug_truncation]]), and an alias can serve a STALE
  // asset ([[feedback_pages_alias_serves_stale_asset]]). Pinning the deployment
  // hash means the evidence names the exact build it was taken from.
  : process.env.PREVIEW_URL || '';

const START = '/contact';            // the 92-page div-box majority shape; carries shared chrome
const GOTO_TARGET = '/tax-controversy.html';   // what goto_tax_controversy maps to
const HOME_TARGET = '/index.html';   // what goto_home maps to — the excluded spelling

const out = {
  order: 'SHELDON-PERCH-COMMAND-CHANNEL',
  base: BASE,
  startedAt: new Date().toISOString(),
  steps: [],
  writes: [],        // any request to the booking write path. MUST stay empty.
  qualifierSubmits: [],  // captured and ABORTED — never delivered.
  livePolls: [],     // real, unintercepted /fn/page-poll requests
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
/** The poll interval is 1200 ms; give it two turns plus slack. */
const POLL_WINDOW = 3000;

async function main() {
  if (!BASE) {
    console.error('usage: node test/preview/verify-command-channel.mjs <previewUrl>   (or set PREVIEW_URL)');
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
  page.on('request', (r) => {
    const u = r.url();
    if (/\/booking\/create/.test(u)) out.writes.push({ url: u, method: r.method() });
  });
  let documentLoads = 0;
  page.on('load', () => { documentLoads++; });

  // ── The two route interceptions, and nothing else ─────────────────────────
  //
  // `queued` is the harness's stand-in for the Durable Object's queue: read-once,
  // exactly like `/do/get`. When it is null the route is NOT intercepted at all —
  // the request goes to the real Function and the real answer comes back, which
  // is what step 4 measures.
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
  // Captured, then ABORTED. See the header: this endpoint forwards to Vantage.
  await page.route('**/fn/qualifier_submit', async (route) => {
    let body = null;
    try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) { body = { unparseable: true }; }
    out.qualifierSubmits.push(body);
    return route.abort();
  });

  const layerProbe = () => page.evaluate(() => (window.Perch && window.Perch.layer ? window.Perch.layer.probe() : null));
  const routerProbe = () => page.evaluate(() => (window.Perch && window.Perch.router ? window.Perch.router.probe() : null));

  try {
    // ── 1. The page a visitor actually lands on after A51 ────────────────────
    await page.goto(BASE + START, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(600);

    const router = await routerProbe();
    step('the router is on and ready for this deployment', !!(router && router.ready), router && {
      ready: router.ready, container: router.container, errors: router.errors,
    });

    let probe = await layerProbe();
    step('the persistent layer mounted outside the swap container',
      !!(probe && probe.placement && probe.placement.ok && !probe.placement.layerInsideContainer),
      probe && probe.placement);

    // ── 2. THE REGRESSION, measured ─────────────────────────────────────────
    // Every one of these was the failing state Zane found on the live page.
    step('the command channel EXISTS on a content page (was: null)',
      !!(probe && probe.commandChannel),
      probe && { commandChannel: probe.commandChannel, qualifierMounted: probe.qualifierMounted });

    const qualBefore = await page.evaluate(() => {
      const q = document.getElementById('qual');
      const layer = document.getElementById('perch-persistent');
      return { present: !!q, inLayer: !!(q && layer && layer.contains(q)), perchGlobal: typeof window.__perch };
    });
    step('the qualifier element exists, inside the layer (was: absent)',
      qualBefore.present && qualBefore.inLayer, qualBefore);
    step('window.__perch is locked on (was: null)', qualBefore.perchGlobal === 'object', qualBefore);

    const concierges = await page.evaluate(() => ({
      launcher: !!document.getElementById('dvn-perch-launcher'),
      shellOrb: !!document.getElementById('concierge'),
    }));
    step('exactly one concierge — the launcher, not a second shell orb',
      concierges.launcher && !concierges.shellOrb, concierges);

    // ── 3. A live, non-DOM resource to prove survival ────────────────────────
    // The stand-in for a live call, registered through A2.1's published API. An
    // AudioContext clock only advances while the context lives, so comparing it
    // across the navigation is positive proof nothing was torn down.
    await page.evaluate(() => {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const c = new Ctx();
      const osc = c.createOscillator();
      const g = c.createGain();
      g.gain.value = 0.0001;
      osc.connect(g).connect(c.destination);
      osc.start();
      window.Perch.layer.attachLiveResource('cmdchan-audio', { clock: () => c.currentTime, state: () => c.state });
    });

    // ── 4. Bind the call, and watch the REAL poll leave ──────────────────────
    const CALL_ID = 'verify-cmdchan-' + Math.random().toString(36).slice(2, 10);
    const bound = await page.evaluate(async (callId) => {
      const m = await import('/js/perch-layer.js');
      return m.bindCall({ callId });
    }, CALL_ID);
    step('bindCall() — the seam js/donovan-widget.js calls — accepted the call', !!(bound && bound.ok), bound);

    await sleep(POLL_WINDOW);
    const live = out.livePolls.filter((p) => p.header === CALL_ID);
    step('the poll loop is REALLY running against /fn/page-poll, with the header credential',
      live.length >= 1, { livePolls: out.livePolls.length, withThisCallId: live.length });

    probe = await layerProbe();
    step('and the layer agrees it is polling', !!(probe && probe.commandChannel && probe.commandChannel.polling),
      probe && probe.commandChannel);

    const callIdLeak = JSON.stringify(probe).includes(CALL_ID);
    step('the probe does not print the bridge credential', !callIdLeak, { leaked: callIdLeak });

    // ── 5. A goto command NAVIGATES ─────────────────────────────────────────
    intercept = true;
    const before = await layerProbe();
    const swapsBefore = (await routerProbe()).swaps;
    const loadsBefore = documentLoads;

    queued = { cmd: 'navigate', target: GOTO_TARGET };
    await page.waitForFunction(
      (t) => location.pathname.replace('.html', '') === t.replace('.html', ''),
      GOTO_TARGET, { timeout: 12000 },
    ).catch(() => {});
    await sleep(400);

    const after = await layerProbe();
    const routerAfter = await routerProbe();
    const navDetail = {
      url: page.url().replace(BASE, ''),
      swapsBefore, swapsAfter: routerAfter.swaps,
      documentLoads: documentLoads - loadsBefore,
      instanceBefore: before && before.instanceId,
      instanceAfter: after && after.instanceId,
      audioBefore: before && before.resources['cmdchan-audio'],
      audioAfter: after && after.resources['cmdchan-audio'],
    };
    const navigated = new URL(page.url()).pathname.replace('.html', '') === GOTO_TARGET.replace('.html', '');
    step('THE HEADLINE: a goto command actually navigates the page', navigated, navDetail);
    step('…as a SWAP, not a document load', routerAfter.swaps > swapsBefore && documentLoads === loadsBefore, navDetail);
    step('…and the persistent layer is the same instance afterwards',
      !!(before && after && before.instanceId === after.instanceId), navDetail);
    // A clock sitting at exactly 0 has NOT STARTED, which is a different fact
    // from "did not advance" — see the note in verify-a22.mjs.
    const a0 = before && before.resources['cmdchan-audio'];
    const a1 = after && after.resources['cmdchan-audio'];
    step('…and the live call resource survived it (clock advanced, context running)',
      !!(a1 && a1.state === 'running' && a0 && a1.clock >= a0.clock && a1.clock > 0),
      { before: a0, after: a1 });

    // ── 6. goto_home reaches a page the router can swap to ──────────────────
    const homeBefore = await layerProbe();
    const homeSwaps = (await routerProbe()).swaps;
    const homeLoads = documentLoads;
    queued = { cmd: 'navigate', target: HOME_TARGET };
    await page.waitForFunction(() => /^\/(home|)$/.test(location.pathname), null, { timeout: 12000 }).catch(() => {});
    await sleep(400);
    const homeAfter = await layerProbe();
    const homeDetail = {
      url: page.url().replace(BASE, ''),
      swaps: (await routerProbe()).swaps - homeSwaps,
      documentLoads: documentLoads - homeLoads,
      instanceStable: !!(homeBefore && homeAfter && homeBefore.instanceId === homeAfter.instanceId),
    };
    step('goto_home lands on the homepage WITHOUT a document load (the call survives)',
      /^\/(home|)$/.test(new URL(page.url()).pathname) && documentLoads === homeLoads && homeDetail.instanceStable,
      homeDetail);

    // ── 7. open_qualifier SHOWS THE MODAL ───────────────────────────────────
    queued = { cmd: 'open_qualifier', payload: { matter: 'real_estate', lang: 'en', source: 'verifier' } };
    await page.waitForFunction(
      () => { const q = document.getElementById('qual'); return !!q && q.classList.contains('show'); },
      null, { timeout: 12000 },
    ).catch(() => {});
    await sleep(400);

    // Measured in PIXELS, not by class name. A card that is present and 0×0, or
    // trapped behind the page, is not a card the caller can tap
    // ([[feedback_presence_is_not_clickability]]).
    const modal = await page.evaluate(() => {
      const q = document.getElementById('qual');
      if (!q) return { present: false };
      const r = q.getBoundingClientRect();
      const card = q.querySelector('.card');
      const cr = card ? card.getBoundingClientRect() : null;
      const cs = getComputedStyle(q);
      const opts = [...q.querySelectorAll('#qual-bd .opt')].map((b) => b.dataset.v || b.id);
      const mid = card ? document.elementFromPoint(cr.left + cr.width / 2, cr.top + 20) : null;
      return {
        present: true,
        display: cs.display,
        rect: { w: Math.round(r.width), h: Math.round(r.height) },
        cardRect: cr ? { w: Math.round(cr.width), h: Math.round(cr.height) } : null,
        heading: (q.querySelector('#qual-bd h2') || {}).textContent || null,
        options: opts,
        topOfCardIsInsideCard: !!(card && mid && card.contains(mid)),
        probe: window.__perch ? window.__perch.probe() : null,
        // The orb must be UNDER the card while it is open. It carried an inline
        // z-index of 2147483000 that beat the stylesheet's 80, and inside the
        // layer's stacking context that put it over the qualifier's 120 — the
        // caller taps their income into a card with the orb sitting on it.
        // Measured by hit test, not by reading the rule.
        overLauncher: (() => {
          const l = document.getElementById('dvn-perch-launcher');
          if (!l) return null;
          const lr = l.getBoundingClientRect();
          const hit = document.elementFromPoint(lr.left + lr.width / 2, lr.top + lr.height / 2);
          return { zIndex: getComputedStyle(l).zIndex, hitIsModal: !!(hit && q.contains(hit)) };
        })(),
      };
    });
    step('THE HEADLINE: open_qualifier renders a visible, tappable card',
      !!(modal.present && modal.display === 'flex' && modal.cardRect && modal.cardRect.w > 200
         && modal.cardRect.h > 100 && modal.topOfCardIsInsideCard && modal.options.length >= 4),
      modal);
    step('…and the card knows the live call id', !!(modal.probe && modal.probe.callId === 'set'), modal.probe);
    step('…and the orb is UNDER the open card, not on top of it',
      !!(modal.overLauncher && modal.overLauncher.hitIsModal), modal.overLauncher);

    // ── 8. A completed tap-through submits with that call id ────────────────
    const taps = ['real_estate', 'acquisition', null, 'yourself', '1_5m_3m', '5m_15m'];
    const tapped = [];
    for (const v of taps) {
      if (v === null) {
        // the state step is a <select> + Continue
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
    step('the completed card POSTs to /fn/qualifier_submit with the live call id',
      !!(submit && submit.call_id && submit.matter_category === 'real_estate'
         && submit.income_band === '1_5m_3m' && submit.net_worth_band === '5m_15m' && submit.state === 'FL'),
      { tapped, submit, note: 'captured and ABORTED — it forwards to Vantage /upsert-lead' });
    step('the call id on the submit IS the one bound to the channel',
      !!(submit && submit.call_id === CALL_ID),
      { expected: CALL_ID, got: submit && submit.call_id });

    const done = await page.evaluate(() => (document.getElementById('qual-bd') || {}).textContent || '');
    step('and the caller sees the done card', /Paula has it|Listo/.test(done), { text: done.slice(0, 120) });

    // ── 9. The consumer survived every swap it just did ─────────────────────
    const finalProbe = await layerProbe();
    step('the channel is still polling after three navigations',
      !!(finalProbe && finalProbe.commandChannel && finalProbe.commandChannel.polling),
      finalProbe && finalProbe.commandChannel);
    step('releaseCall() stops it', await page.evaluate(async () => {
      const m = await import('/js/perch-layer.js');
      m.releaseCall();
      return !window.Perch.layer.probe().commandChannel.polling;
    }), null);

    // ── 10. Nothing was written, nothing was refused ────────────────────────
    step('NOTHING reached the booking write path', out.writes.length === 0, out.writes);
    step('no CSP violation — the modules are same-origin externals', out.cspViolations.length === 0, out.cspViolations);
    step('no uncaught page errors', out.pageErrors.length === 0, out.pageErrors);

    // ── 11. The rollback target still works ─────────────────────────────────
    const shell = await ctx.newPage();
    const shellWrites = [];
    shell.on('request', (r) => { if (/\/booking\/create/.test(r.url())) shellWrites.push(r.url()); });
    const sres = await shell.goto(BASE + '/perch', { waitUntil: 'domcontentloaded' });
    await sleep(1200);
    const shellState = await shell.evaluate(() => ({
      orb: !!document.getElementById('concierge'),
      qual: !!document.getElementById('qual'),
      iframe: !!document.getElementById('site'),
      frameSrc: (document.getElementById('site') || {}).getAttribute
        ? document.getElementById('site').getAttribute('src') : null,
      // The layer must NOT mount inside the shell's frame — the outer document
      // owns the orb, and two would start two calls.
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

const evidence = fileURLToPath(new URL('./command-channel-evidence.json', import.meta.url));
writeFileSync(evidence, JSON.stringify(out, null, 2));
console.log('\n' + JSON.stringify({
  verdict: out.verdict, passed: out.passed, failed: out.failed,
  writes: out.writes.length, evidence,
}, null, 2));
