// ── SHELDON-PERCH-CLEANUP-ROUTING-KEYS — the Preview verifier ────────────────
//
// Order SHELDON-PERCH-CLEANUP-ROUTING-KEYS · post-cutover cleanup, live site.
//
//   node test/preview/verify-cleanup-routing.mjs [baseUrl]
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
//
//   REAL, against the live Preview deployment
//     • every status, Location and Cache-Control in §A. Those are the whole of
//       Task 1 and they are measured with `redirect: 'manual'` so a chain is read
//       hop by hop rather than collapsed by fetch;
//     • the shipped js/perch-layer.js, js/perch/command-channel.js and
//       js/perch/page-control.js, loaded by the edge injector on a real content
//       page with the router on, executing the REAL dispatch table;
//     • the scroll and the highlight, measured as PIXELS MOVED and as the
//       computed box-shadow on the real element — not as a log line saying
//       `handled: true`;
//     • the navigation (Swup's real content:replace + a live AudioContext clock),
//       the qualifier card's real viewport rect, and the real /book reveal with
//       the real widget booting behind it.
//
//   NOT REAL, and why
//     • the `/fn/page-poll` RESPONSE BODY for §B is served by the harness.
//       Queuing for real means POSTing /fn/do_page_action, which requires
//       PERCH_TOOL_SECRET, and this order forbids entering or reading a secret.
//       Everything downstream of `fetch()` is the shipped code path. The half
//       this harness stands in for — that the server queues exactly
//       `{cmd:'scroll'|'highlight', target}` for `scroll_to`/`highlight` — is
//       asserted in CI against the REAL handler, in test/page-action.test.mjs
//       ("THE SHAPE IS THE ONE THE CONSUMERS READ"). Neither half is a proof on
//       its own and both are named.
//     • the call id. A real one needs a Retell session, which needs a Turnstile
//       solve, which refuses automation by design
//       ([[feedback_turnstile_not_agent_verifiable]]). The harness calls the
//       SHIPPED `bindCall()` module export with a synthetic id — the same seam
//       js/donovan-widget.js calls from `call_started`.
//     • THE SWITCHED-OFF ANSWER AT `/`. This is the one claim a Preview
//       structurally cannot make, and it is the headline claim of Task 1, so it
//       is spelled out rather than fudged: `routerEnabled()` is true on every
//       `*.pages.dev` hostname, so a Preview is ALWAYS the switched-on
//       deployment and its `/` is always a 200. Production is switched on too
//       (#90), so the trap is not observable there either — it exists only
//       while the switch is OFF, which is a rollback window and nothing else.
//       It is proven in two other places instead:
//         (1) LOCAL workerd over the real `_redirects` —
//             `npx wrangler pages dev donovan-legal-site --binding PERCH_ROUTER=off`
//             answers `/` with `308 → /perch` on `main` and with
//             `307 → /perch` + `no-store` on this branch;
//         (2) CI: test/perch-shell-retire.test.mjs drives the REAL `onRequest`
//             with `env: {}` over an asset double pinned to the measured
//             production answers, and asserts 307 + no-store.
//       §A5 below measures production only to confirm which state it is in, so
//       "fixed" and "you cannot see it from here" are never confused.
//
// ── NOTHING IS WRITTEN ───────────────────────────────────────────────────────
// `/booking/create` is route-ABORTED, not merely observed, and `out.writes` must
// stay empty. A verifier that quietly files a real appointment is the mistake
// this codebase has already made once ([[feedback_negative_path_probe_can_write]]).

import { chromium } from 'playwright';
import { writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] && !process.argv[2].startsWith('--'))
  ? process.argv[2].replace(/\/$/, '')
  // The immutable per-deployment URL, not the branch alias: Pages truncates the
  // alias hostname to ~28 characters ([[feedback_pages_alias_slug_truncation]])
  // and an alias can serve a STALE asset ([[feedback_pages_alias_serves_stale_asset]]).
  : process.env.PREVIEW_URL || '';

const PRODUCTION = 'https://www.donovan.law';
const START = '/contact';                   // the div-box majority shape; carries shared chrome
const GOTO_TARGET = '/tax-controversy.html';
const BOOK_TARGET = '/book.html';
const PREFILL = { name: 'Verifier Probe', email: 'verifier@example.invalid', phone: '5555550123', notes: 'automated check — never submitted' };

const SHELL = readFileSync(fileURLToPath(new URL('../../donovan-legal-site/perch.html', import.meta.url)), 'utf8');

const out = {
  order: 'SHELDON-PERCH-CLEANUP-ROUTING-KEYS',
  base: BASE,
  startedAt: new Date().toISOString(),
  steps: [],
  routing: {},        // every measured status/header, for the PR body
  writes: [],         // any request to the booking write path. MUST stay empty.
  qualifierSubmits: [],
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
const POLL_WINDOW = 3000;  // the poll interval is 1200 ms; two turns plus slack

/** One hop, unfollowed. `redirect: 'manual'` is the whole point — see §A. */
async function hop(url) {
  const r = await fetch(url, { redirect: 'manual', headers: { 'user-agent': 'perch-cleanup-verifier' } });
  return {
    url,
    status: r.status,
    location: r.headers.get('location'),
    cacheControl: r.headers.get('cache-control'),
    contentType: r.headers.get('content-type'),
    body: r.headers.get('content-type') && /text\/html/.test(r.headers.get('content-type')) ? await r.text() : null,
  };
}

/** Follow a chain by hand so every hop's status is visible, not collapsed. */
async function chain(origin, path, max = 5) {
  const hops = [];
  let next = path;
  for (let i = 0; i < max && next; i++) {
    const h = await hop(new URL(next, origin).toString());
    hops.push({ path: new URL(h.url).pathname, status: h.status, location: h.location, cacheControl: h.cacheControl });
    if (h.status >= 300 && h.status < 400 && h.location) { next = h.location; } else { next = null; }
  }
  return hops;
}

/** Statuses a browser is entitled to cache against the URL forever. */
const PERMANENT = [301, 308];

async function main() {
  if (!BASE) {
    console.error('usage: node test/preview/verify-cleanup-routing.mjs <previewUrl>   (or set PREVIEW_URL)');
    out.steps.push({ name: 'a base URL was supplied', ok: false, detail: null });
    return;
  }

  // ═══ §A — ROUTING. No browser: these are HTTP facts. ═══════════════════════

  // A1. The homepage on the switched-ON deployment. Not a redirect at all, so
  // there is nothing for a browser to cache against `/` in the first place.
  const root = await hop(BASE + '/');
  out.routing.previewRoot = { status: root.status, location: root.location, cacheControl: root.cacheControl };
  step('§A1 the Preview homepage is a PAGE, not a redirect',
    root.status === 200 && !root.location, out.routing.previewRoot);
  step('§A1 …and it is the real indexable homepage, not the noindex shell',
    !!(root.body && !/<meta[^>]+name="robots"[^>]+noindex/i.test(root.body) && /Donovan Legal PLLC/.test(root.body)),
    { noindex: !!(root.body && /noindex/i.test(root.body)), bytes: root.body ? root.body.length : 0 });
  step('§A1 …and it is no-store, so no cache entry exists at `/` at all',
    root.cacheControl === 'no-store', { cacheControl: root.cacheControl });

  // A2. THE HEADLINE for Task 1, stated as the property rather than the number:
  // no hop reachable from `/` may be permanently cacheable.
  const rootChain = await chain(BASE, '/');
  out.routing.previewRootChain = rootChain;
  step('§A2 THE HEADLINE: no hop from `/` is a permanent redirect',
    rootChain.every((h) => !PERMANENT.includes(h.status)), rootChain);

  // A3. The rollback target, identical to the shipped file. This is the "do not
  // break /perch" half of the order, measured rather than asserted.
  //
  // Line endings are normalised on BOTH sides first, and that is not a
  // normaliser rescuing a failure — it is the difference between two checkouts.
  // The working tree here is a Windows checkout (CRLF); CI checks out on Linux
  // (LF) and uploads that. A raw comparison is off by exactly the line count and
  // says "the shell changed" when nothing changed
  // ([[feedback_windows_gcloud_curl_gotchas]] — CRLF fakes a diff). The claim
  // under test is "the shell's CONTENT is untouched", so content is what is
  // compared, and the byte counts are reported either way.
  const eol = (s) => (s == null ? s : s.replace(/\r\n/g, '\n'));
  const perch = await hop(BASE + '/perch');
  const shellSame = eol(perch.body) === eol(SHELL);
  out.routing.previewPerch = { status: perch.status, cacheControl: perch.cacheControl, identical: shellSame };
  step('§A3 /perch — the rollback target — still serves the shipped shell, content for content',
    perch.status === 200 && shellSame,
    { status: perch.status, identical: shellSame, shippedBytes: SHELL.length, servedBytes: perch.body ? perch.body.length : 0,
      note: 'compared after CRLF→LF on both sides: this worktree is a Windows checkout, CI uploads the LF one' });

  // A4. SCOPE. The fix is path-scoped to `/`, so every other redirect on the
  // site must be exactly what it was. `/index.html` and the SEO dedup 301s are
  // permanent ON PURPOSE (they consolidate link equity, #68) and a cleanup that
  // quietly turned them temporary would undo that work silently.
  const others = {};
  for (const p of ['/perch.html', '/index.html', '/taxation', '/the-cmm2']) {
    const h = await hop(BASE + p);
    others[p] = { status: h.status, location: h.location, cacheControl: h.cacheControl };
  }
  out.routing.previewOthers = others;
  step('§A4 nothing else was downgraded — the intentional 301s and the canonicaliser 308 are untouched',
    others['/index.html'].status === 301 && others['/taxation'].status === 301
      && others['/the-cmm2'].status === 301 && others['/perch.html'].status === 308,
    others);

  // A5. WHERE THE ROLLED-BACK ANSWER IS ACTUALLY PROVEN, AND WHY NOT HERE.
  //
  // Production is switched ON (SARAH-A42, #90), so its `/` is a 200 and the trap
  // is not observable there either — it only appears while the switch is OFF,
  // i.e. during a rollback, which is exactly what makes it easy to ship. And a
  // Preview is ALWAYS switched on: `routerEnabled()` is true on every
  // `*.pages.dev` hostname. So NO live deployment can show the rolled-back
  // answer, and this verifier does not pretend otherwise.
  //
  // It is proven in two other places, both named in the PR body:
  //   (1) LOCALLY, in the real workerd runtime over the real `_redirects`:
  //       `npx wrangler pages dev donovan-legal-site --binding PERCH_ROUTER=off`
  //       answers `/` with `308 → /perch` on `main` and `307 → /perch` +
  //       `no-store` on this branch. Same command, same tree, one commit apart.
  //   (2) CI: test/perch-shell-retire.test.mjs drives the REAL `onRequest` with
  //       `env: {}` over an asset double pinned to the measured production
  //       answers, and asserts 307 + no-store.
  //
  // What §A5 measures instead is that production is where we think it is —
  // because "the trap is gone" and "the switch is on so you cannot see it" look
  // identical from outside, and a verifier that conflated them would report a
  // fix that had not shipped. Read-only GETs; nothing is written.
  try {
    const prodChain = await chain(PRODUCTION, '/');
    out.routing.productionRootChain = prodChain;
    const prodOn = prodChain.length === 1 && prodChain[0].status === 200;
    step('§A5 CONTROL — production is the switched-ON deployment, so its `/` is a page, not a redirect',
      prodOn, { chain: prodChain, note: 'the rolled-back answer is not observable on ANY live deployment — see the note in this file' });
    out.notes.push(
      'The rolled-back answer cannot be measured on a Preview (routerEnabled() is true on every *.pages.dev host) '
      + 'nor on production (switched on since #90). Measured instead in local workerd with '
      + '--binding PERCH_ROUTER=off: main → 308 → /perch, this branch → 307 → /perch + no-store; and in CI '
      + 'against the real onRequest with env {}.',
    );
  } catch (e) {
    step('§A5 CONTROL — production was reachable', false, String(e));
  }

  // A6. The new keys did not open a door. `get_page_actions` must still have no
  // GET handler, and `do_page_action` must still refuse an unauthenticated
  // `scroll_to` — the new branch sits BEHIND the same shared-secret gate.
  //
  // MEASURED, not assumed: Cloudflare Pages answers a GET at a POST-only
  // Function with **404**, not 405 — a POST-only route is indistinguishable from
  // an absent one over GET ([[feedback_post_only_function_is_indistinguishable_from_404]]),
  // which is why the 404 alone proves nothing about the route and the 401 on the
  // POST is what proves it exists and is gated. The comment in
  // get_page_actions.js claiming 405 was wrong and is corrected in this PR.
  const disc = await fetch(BASE + '/fn/get_page_actions', { method: 'GET' });
  const discBody = (await disc.text()).slice(0, 200);
  const unauth = await fetch(BASE + '/fn/do_page_action', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ call_id: 'verifier-unauth', args: { action_key: 'scroll_to', target: '#x' } }),
  });
  out.routing.authGate = { discoveryGET: disc.status, unauthScrollTo: unauth.status };
  step('§A6 discovery answers no GET (404/405) and discloses no key list',
    (disc.status === 404 || disc.status === 405) && !/goto_home|scroll_to/.test(discBody),
    { ...out.routing.authGate, leaked: /goto_home|scroll_to/.test(discBody) });
  step('§A6 the NEW key is behind the same tool secret — an unauthenticated scroll_to is 401',
    unauth.status === 401, out.routing.authGate);

  // ═══ §B — THE KEYS REACH THEIR CONSUMERS, AND NOTHING ELSE BROKE ══════════

  const browser = await chromium.launch();
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  page.on('console', (m) => {
    out.console.push({ type: m.type(), text: m.text().slice(0, 300) });
    if (/Content Security Policy|Refused to/i.test(m.text())) out.cspViolations.push(m.text().slice(0, 300));
  });
  page.on('pageerror', (e) => out.pageErrors.push(String(e).slice(0, 300)));
  page.on('request', (r) => { if (/\/booking\/create/.test(r.url())) out.writes.push({ url: r.url(), method: r.method() }); });
  let documentLoads = 0;
  page.on('load', () => { documentLoads++; });

  let queued = null;
  let intercept = false;
  await page.route('**/fn/page-poll*', async (route) => {
    if (!intercept) return route.continue();
    const body = queued; queued = null;
    return route.fulfill({
      status: 200, contentType: 'application/json',
      headers: { 'cache-control': 'no-store' }, body: JSON.stringify(body || {}),
    });
  });
  // Captured then ABORTED — it forwards the caller's fields to Vantage /upsert-lead.
  await page.route('**/fn/qualifier_submit', async (route) => {
    let body = null;
    try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) { body = { unparseable: true }; }
    out.qualifierSubmits.push(body);
    return route.abort();
  });
  // Belt and braces on top of the observation above: the write path is severed
  // in the browser, so even a bug in this script cannot book an appointment.
  await page.route('**/booking/create', async (route) => {
    out.writes.push({ url: route.request().url(), method: route.request().method(), aborted: true });
    return route.abort();
  });

  const layerProbe = () => page.evaluate(() => (window.Perch && window.Perch.layer ? window.Perch.layer.probe() : null));
  const routerProbe = () => page.evaluate(() => (window.Perch && window.Perch.router ? window.Perch.router.probe() : null));

  try {
    await page.goto(BASE + START, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(600);

    const router = await routerProbe();
    step('§B0 the router is on and ready for this deployment', !!(router && router.ready),
      router && { ready: router.ready, container: router.container, errors: router.errors });

    let probe = await layerProbe();
    step('§B0 the command channel is mounted on a content page (#92)', !!(probe && probe.commandChannel),
      probe && { commandChannel: probe.commandChannel, qualifierMounted: probe.qualifierMounted });

    // A live, non-DOM resource: an AudioContext clock only advances while the
    // context lives, so it is positive proof a navigation tore nothing down.
    await page.evaluate(() => {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const c = new Ctx();
      const osc = c.createOscillator();
      const g = c.createGain();
      g.gain.value = 0.0001;
      osc.connect(g).connect(c.destination);
      osc.start();
      window.Perch.layer.attachLiveResource('cleanup-audio', { clock: () => c.currentTime, state: () => c.state });
    });

    const CALL_ID = 'verify-cleanup-' + Math.random().toString(36).slice(2, 10);
    const bound = await page.evaluate(async (callId) => {
      const m = await import('/js/perch-layer.js');
      return m.bindCall({ callId });
    }, CALL_ID);
    step('§B0 bindCall() accepted the call', !!(bound && bound.ok), bound);
    await sleep(POLL_WINDOW);
    probe = await layerProbe();
    step('§B0 the poll loop is running', !!(probe && probe.commandChannel && probe.commandChannel.polling),
      probe && probe.commandChannel);

    intercept = true;

    // ── B1. scroll_to ────────────────────────────────────────────────────────
    //
    // Choose the target from the LIVE page rather than hardcoding an id that a
    // content edit could remove — a verifier that silently targets nothing
    // reports `target_absent` as a pass.
    //
    // THE FIRST CUT OF THIS PICKED A TARGET THAT COULD NOT SCROLL, and reported
    // it as a broken feature. `/contact` carries a `.nav-mobile-overlay` — a
    // fixed, closed mobile menu — whose links have ids and sit at a large
    // `top`. They are "below the fold" by rect and not in the document's scroll
    // flow at all, so `scrollIntoView` is a legitimate no-op on them and
    // `window.scrollY` never moves. The executor was right; the harness was
    // wrong. So the target must additionally be:
    //   • rendered (`offsetParent` non-null — excludes display:none subtrees);
    //   • free of any fixed/sticky ancestor (excludes overlays and headers);
    //   • genuinely past the viewport once page offset is included.
    const target = await page.evaluate(() => {
      const vh = window.innerHeight;
      const flowed = (el) => {
        for (let n = el; n && n !== document.body; n = n.parentElement) {
          const pos = getComputedStyle(n).position;
          if (pos === 'fixed' || pos === 'sticky') return false;
        }
        return true;
      };
      const cand = [...document.querySelectorAll('[id]')].filter((el) => {
        if (!/^[A-Za-z0-9_-]+$/.test(el.id)) return false;
        if (el.closest('#perch-persistent')) return false;
        if (!el.offsetParent) return false;
        if (!flowed(el)) return false;
        const r = el.getBoundingClientRect();
        return r.height > 20 && r.width > 20 && r.top + window.scrollY > vh * 1.2;
      });
      const el = cand[0] || null;
      return el ? {
        id: el.id, tag: el.tagName,
        docTop: Math.round(el.getBoundingClientRect().top + window.scrollY),
        viewportHeight: vh, docHeight: document.documentElement.scrollHeight,
      } : null;
    });
    step('§B1 a scrollable, below-the-fold target with a plain id exists on this page (harness sanity)',
      !!(target && target.docTop > target.viewportHeight), target);

    const scrollBefore = await page.evaluate(() => window.scrollY);
    queued = { cmd: 'scroll', target: '#' + (target ? target.id : 'no-such-target') };
    await page.waitForFunction((y) => window.scrollY > y + 50, scrollBefore, { timeout: 12000 }).catch(() => {});
    await sleep(900);   // smooth scrolling
    const scrollAfter = await page.evaluate(() => window.scrollY);
    const scrolledIntoView = await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), inViewport: r.top >= -5 && r.top < window.innerHeight };
    }, target ? target.id : '');
    step('§B1 THE HEADLINE: `scroll` MOVES THE PAGE and brings the target into view',
      scrollAfter > scrollBefore + 50 && !!(scrolledIntoView && scrolledIntoView.inViewport),
      { target, scrollBefore: Math.round(scrollBefore), scrollAfter: Math.round(scrollAfter), scrolledIntoView });

    const pageLog1 = await page.evaluate(() => window.Perch.layer.probe().pageControl);
    const scrollEntry = ((pageLog1 && pageLog1.log) || []).filter((l) => l.cmd === 'scroll').at(-1) || null;
    step('§B1 …through the SHIPPED js/perch/page-control.js, not the unobserved postMessage road',
      !!(scrollEntry && scrollEntry.via === 'scrollIntoView' && !scrollEntry.reason), { scrollEntry, pageLog: pageLog1 });

    // ── B2. highlight ────────────────────────────────────────────────────────
    queued = { cmd: 'highlight', target: '#' + (target ? target.id : 'no-such-target') };
    await page.waitForFunction(
      (id) => { const el = document.getElementById(id); return !!el && /rgb/.test(el.style.boxShadow || ''); },
      target ? target.id : '', { timeout: 12000 },
    ).catch(() => {});
    const lit = await page.evaluate((id) => {
      const el = document.getElementById(id);
      if (!el) return null;
      return { inline: el.style.boxShadow, computed: getComputedStyle(el).boxShadow, transition: el.style.transition };
    }, target ? target.id : '');
    step('§B2 THE HEADLINE: `highlight` paints the ring on the real element',
      !!(lit && /rgb\(193,\s*162,\s*33\)|#c1a221/i.test(lit.computed + ' ' + lit.inline)), lit);

    // It must also GO AWAY — a highlight that never clears is a permanent gold
    // box on a live page, which is a defect of its own.
    await sleep(3000);
    const cleared = await page.evaluate((id) => {
      const el = document.getElementById(id);
      return el ? { inline: el.style.boxShadow, computed: getComputedStyle(el).boxShadow } : null;
    }, target ? target.id : '');
    step('§B2 …and it clears itself after the 2600 ms window (no permanent gold box)',
      !!(cleared && !/rgb\(193,\s*162,\s*33\)/i.test(cleared.computed)), cleared);

    const pageLog2 = await page.evaluate(() => window.Perch.layer.probe().pageControl);
    const hlEntry = ((pageLog2 && pageLog2.log) || []).filter((l) => l.cmd === 'highlight').at(-1) || null;
    step('§B2 …through the shipped executor', !!(hlEntry && hlEntry.via === 'boxShadow' && !hlEntry.reason), hlEntry);

    // ── B3. NAVIGATION still works (the "do not break what works" clause) ────
    const before = await layerProbe();
    const swapsBefore = (await routerProbe()).swaps;
    const loadsBefore = documentLoads;
    queued = { cmd: 'navigate', target: GOTO_TARGET };
    await page.waitForFunction(
      (t) => location.pathname.replace('.html', '') === t.replace('.html', ''),
      GOTO_TARGET, { timeout: 15000 },
    ).catch(() => {});
    await sleep(500);
    const after = await layerProbe();
    const routerAfter = await routerProbe();
    const a0 = before && before.resources['cleanup-audio'];
    const a1 = after && after.resources['cleanup-audio'];
    const navDetail = {
      url: page.url().replace(BASE, ''),
      swaps: routerAfter.swaps - swapsBefore,
      documentLoads: documentLoads - loadsBefore,
      instanceStable: !!(before && after && before.instanceId === after.instanceId),
      audioBefore: a0, audioAfter: a1,
    };
    step('§B3 navigation still swaps, with no document load and the same layer instance',
      new URL(page.url()).pathname.replace('.html', '') === GOTO_TARGET.replace('.html', '')
        && routerAfter.swaps > swapsBefore && documentLoads === loadsBefore && navDetail.instanceStable,
      navDetail);
    // A clock sitting at exactly 0 has NOT STARTED — a different fact from "did
    // not advance" ([[feedback_a22_audio_clock_false_red]]).
    step('§B3 …and the live call resource survived it', !!(a1 && a1.state === 'running' && a0 && a1.clock >= a0.clock && a1.clock > 0),
      { before: a0, after: a1 });

    // ── B4. THE QUALIFIER still opens ───────────────────────────────────────
    queued = { cmd: 'open_qualifier', payload: { matter: 'real_estate', lang: 'en', source: 'verifier' } };
    await page.waitForFunction(
      () => { const q = document.getElementById('qual'); return !!q && q.classList.contains('show'); },
      null, { timeout: 15000 },
    ).catch(() => {});
    await sleep(400);
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
        options: [...q.querySelectorAll('#qual-bd .opt')].map((b) => b.dataset.v || b.id),
        topOfCardIsInsideCard: !!(card && mid && card.contains(mid)),
        callId: window.__perch ? window.__perch.probe().callId : null,
      };
    });
    // Presence is not clickability ([[feedback_presence_is_not_clickability]]).
    step('§B4 the qualifier still renders a visible, tappable card',
      !!(modal.present && modal.display === 'flex' && modal.cardRect && modal.cardRect.w > 200
        && modal.cardRect.h > 100 && modal.topOfCardIsInsideCard && modal.options.length >= 4), modal);

    // Close it without submitting — this leg is about the qualifier still
    // working, and the submit path forwards to a live CRM.
    await page.evaluate(() => { const q = document.getElementById('qual'); if (q) q.classList.remove('show'); });
    await sleep(200);

    // ── B5. BOOKING still works, end to end, with nothing written ───────────
    const bookBefore = await layerProbe();
    const loadsBook = documentLoads;
    queued = { cmd: 'batch', actions: [{ cmd: 'navigate', target: BOOK_TARGET }, { cmd: 'booking_prefill', payload: PREFILL }] };
    await page.waitForFunction(() => /^\/book(\.html)?$/.test(location.pathname), null, { timeout: 20000 }).catch(() => {});
    await page.waitForFunction(() => !!window.DLBooking, null, { timeout: 20000 }).catch(() => {});
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
        liveRect: lr ? { w: Math.round(lr.width), h: Math.round(lr.height) } : null,
        dlBooking: typeof window.DLBooking,
        widgetChildren: host ? host.children.length : 0,
      };
    });
    step('§B5 booking still works: the caller is on /book with the calendar REVEALED',
      /^\/book(\.html)?$/.test(bookState.url) && bookState.gateDisplay === 'none'
        && bookState.liveDisplay === 'block' && !!bookState.liveRect && bookState.liveRect.h > 100
        && bookState.dlBooking === 'object' && bookState.widgetChildren > 0,
      bookState);
    step('§B5 …as a swap, with the layer instance and the live resource intact',
      documentLoads === loadsBook && !!(bookBefore && bookAfter && bookBefore.instanceId === bookAfter.instanceId),
      { documentLoads: documentLoads - loadsBook, instanceStable: bookBefore.instanceId === bookAfter.instanceId });

    const bp = await page.evaluate(() => window.Perch.layer.bookingProbe());
    const prefillEntry = ((bp && bp.log) || []).filter((l) => l.cmd === 'booking_prefill').at(-1) || null;
    step('§B5 …and the prefill reached DLBooking.prefill (the batch was not clobbered, #94)',
      !!(bp && bp.widgetPresent && prefillEntry && prefillEntry.via === 'DLBooking.prefill' && !prefillEntry.reason),
      { prefillEntry, widgetPresent: bp && bp.widgetPresent });

    // ── B6. Hygiene ─────────────────────────────────────────────────────────
    const finalProbe = await layerProbe();
    step('§B6 the channel is still polling after every command and swap',
      !!(finalProbe && finalProbe.commandChannel && finalProbe.commandChannel.polling),
      finalProbe && finalProbe.commandChannel);
    step('§B6 NOTHING reached the booking write path', out.writes.length === 0, out.writes);
    step('§B6 no CSP violation', out.cspViolations.length === 0, out.cspViolations);
    step('§B6 no uncaught page errors', out.pageErrors.length === 0, out.pageErrors);

    // ── B7. The rollback target still builds its own concierge ──────────────
    const shell = await ctx.newPage();
    const sres = await shell.goto(BASE + '/perch', { waitUntil: 'domcontentloaded' });
    await sleep(1500);
    const shellState = await shell.evaluate(() => ({
      orb: !!document.getElementById('concierge'),
      qual: !!document.getElementById('qual'),
      iframe: !!document.getElementById('site'),
      frameSrc: document.getElementById('site') ? document.getElementById('site').getAttribute('src') : null,
      layerInShell: !!document.getElementById('perch-persistent'),
    }));
    step('§B7 the SHELL at /perch still serves and still builds its own concierge',
      sres.status() === 200 && shellState.orb && shellState.qual && shellState.iframe && !shellState.layerInShell,
      { status: sres.status(), ...shellState });
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

const evidence = fileURLToPath(new URL('./cleanup-routing-evidence.json', import.meta.url));
writeFileSync(evidence, JSON.stringify(out, null, 2));
console.log('\n' + JSON.stringify({
  verdict: out.verdict, passed: out.passed, failed: out.failed,
  writes: out.writes.length, evidence,
}, null, 2));
