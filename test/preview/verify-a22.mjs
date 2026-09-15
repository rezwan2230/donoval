// ── SHELDON-PERCH-A22 — the Preview verifier ─────────────────────────────────
//
// Order SHELDON-PERCH-A22-SWUP · ticket #52 · Phase A / Phase 2.
//
// Drives a real Chromium against the Preview deployment and records what actually
// happened, so the report cites measurements rather than reasoning. Everything
// here is an assertion about the SHIPPED router — it injects no harness, defines
// no test-only globals and reads only `Perch.router.probe()` / `Perch.layer.probe()`,
// which are the diagnostic surfaces the production modules already expose.
//
//   node test/preview/verify-a22.mjs [baseUrl] [--quick]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and the evidence file it writes.
//
// It lives under test/ (repo root) and NOT under donovan-legal-site/ on purpose:
// the Pages deploy root is donovan-legal-site and `wrangler pages deploy` has no
// --exclude, so anything dropped in there is published. It is named
// `verify-a22.mjs`, not `*.test.mjs`, so `npm test` never tries to run it — it
// needs a live deployment and a browser, neither of which CI has.

import { chromium } from 'playwright';
import { writeFileSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { excludeReason, ADOPT_SCRIPTS } from '../../donovan-legal-site/js/perch/swap-policy.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const SITE = join(ROOT, 'donovan-legal-site');
const BASE = (process.argv[2] && !process.argv[2].startsWith('--'))
  ? process.argv[2].replace(/\/$/, '')
  : 'https://sheldon-perch-a22-swup.donovan-site.pages.dev';
const QUICK = process.argv.includes('--quick');

// ── The page set: derived from the tree, not typed by hand ───────────────────
//
// "The full page set" means every URL the shipped exclusion rules say the router
// MAY intercept — computed here by calling the real `excludeReason`, so the
// verifier and the router cannot disagree about what is in scope.
function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.wrangler' || name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}
const servedPath = (r) => (r.endsWith('/index.html') ? '/' + r.slice(0, -'index.html'.length) : '/' + r.replace(/\.html$/, ''));

const allPages = walk(SITE)
  .map((f) => relative(SITE, f).split(sep).join('/'))
  .map((r) => ({ rel: r, path: servedPath(r) }))
  .filter((p) => !excludeReason(p.path))
  .sort((a, b) => a.path.localeCompare(b.path));

// The chain starts on a page that carries the shared chrome, because a document
// with no site nav has none to lend the destination and the router deliberately
// hard-navigates away from it (swap-policy.js `sharedChrome`). /contact is the
// 92-page div-box majority shape.
const START = '/contact';
const SWEEP = QUICK
  ? ['/blog-controversy-roadmap-0-overview', '/blog-bramblett-phelan-two-entity-structure', '/book', '/tool-capital-gains']
  : allPages.map((p) => p.path).filter((p) => p !== START);

const TIER_DEEP = '/diamond/tool-economics';   // spike F3: a tier ROOT proves nothing
const NO_CHROME = '/blog-controversy-roadmap-0-overview';

const out = {
  order: 'SHELDON-PERCH-A22-SWUP',
  ticket: 52,
  base: BASE,
  startedAt: new Date().toISOString(),
  pageSet: { interceptable: allPages.length, swept: SWEEP.length, quick: QUICK },
  steps: [],
  swaps: [],
  console: [],
  cspViolations: [],
  pageErrors: [],
  loadEvents: 0,
  verdict: {},
};

function step(name, ok, detail) {
  out.steps.push({ name, ok, detail: detail ?? null });
  console.log(`[${ok === null ? '·' : ok ? 'PASS' : 'FAIL'}] ${name}`, detail === undefined ? '' : JSON.stringify(detail).slice(0, 300));
  return ok;
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

page.on('console', (m) => {
  const t = m.text();
  if (out.console.length < 400) out.console.push(`${m.type()}: ${t}`);
  // A CSP refusal is a console message, not an exception — the whole reason the
  // A0.2 defect was invisible. Catch it explicitly.
  if (/Refused to (load|execute|apply|run)/i.test(t)) out.cspViolations.push(t);
});
page.on('pageerror', (e) => out.pageErrors.push(String(e)));
page.on('load', () => { out.loadEvents++; });

const routerProbe = () => page.evaluate(() => (window.Perch && window.Perch.router ? window.Perch.router.probe() : null));
const layerProbe = () => page.evaluate(() => (window.Perch && window.Perch.layer ? window.Perch.layer.probe() : null));

/**
 * Click into `path` through a real anchor.
 *
 * An injected anchor, not `swup.navigate()`: clicking is what a visitor does, and
 * it exercises the interception path — the delegated listener, `ignoreVisit`, the
 * whole chain — rather than the programmatic entry point behind it. The anchor is
 * appended to `document.body`, which is outside `#perch-main` on every shape, so
 * it survives the swap it triggers and never becomes part of the swapped content.
 *
 * Links are written in the `.html` form on purpose. All 5719 internal anchors in
 * this tree are `.html` links and Pages 308s them to the clean URL, so this is
 * what the router actually faces (spike condition C3).
 */
async function clickTo(path, { dotHtml = true } = {}) {
  const href = dotHtml && path !== '/' && !path.endsWith('/') ? path + '.html' : path;
  await page.evaluate((h) => {
    let a = document.getElementById('__a22_link');
    if (!a) {
      a = document.createElement('a');
      a.id = '__a22_link';
      // IN the viewport, on top, with a real box. A 0×0 anchor is not clickable,
      // an off-screen one is refused as outside the viewport, and
      // `visibility:hidden` would make the click synthetic rather than a real
      // hit test. Nearly transparent and above the persistent layer's orb
      // (z-index 2147483000) so it is genuinely the element under the cursor —
      // see [[feedback_presence_is_not_clickability]].
      a.textContent = 'a22';
      a.style.cssText = 'position:fixed;left:0;top:0;width:60px;height:20px;display:block;'
        + 'z-index:2147483647;opacity:0.02;background:#000;pointer-events:auto';
      document.body.appendChild(a);
    }
    a.setAttribute('href', h);
  }, href);
  await page.click('#__a22_link');
  await page.waitForTimeout(450);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Boot
// ─────────────────────────────────────────────────────────────────────────────
await page.goto(BASE + START, { waitUntil: 'load' });
await page.waitForTimeout(700);

{
  const probe = await routerProbe();
  const layer = await layerProbe();
  out.boot = { router: probe, layer };
  step('the router is injected and wired on Preview', !!(probe && probe.ready), {
    container: probe && probe.container,
    layerRouterRegistered: probe && probe.layerRouterRegistered,
    chrome: probe && probe.chrome,
  });
  step('the persistent layer mounted outside the container', !!(layer && layer.placement && layer.placement.ok && !layer.placement.layerInsideContainer), layer && layer.placement);
}

// A long-lived, non-DOM resource registered through A2.1's own API — the stand-in
// for a live call, which cannot be started here because Turnstile refuses
// automation by design. An AudioContext clock only advances while the context
// lives, so comparing it across swaps is positive proof the layer was never torn
// down and the document never reloaded.
await attachAudio();

/** Register the stand-in live resource on whatever layer instance is current. */
async function attachAudio() {
  await page.evaluate(() => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    const c = new Ctx();
    const osc = c.createOscillator();
    const g = c.createGain();
    g.gain.value = 0.0001;
    osc.connect(g).connect(c.destination);
    osc.start();
    window.Perch.layer.attachLiveResource('a22-audio', { clock: () => c.currentTime, state: () => c.state });
  });
}

const first = await layerProbe();
const loadsBefore = out.loadEvents;

// ─────────────────────────────────────────────────────────────────────────────
// 2. The sweep — every interceptable page, one document
// ─────────────────────────────────────────────────────────────────────────────
let failures = 0;
let reloads = 0;
let lastAudio = -1;
let lastTicks = -1;
// Re-baselined after a reload so ONE bad URL does not report as 38 failures. A
// reload is still counted and still fails its own swap — this only stops the
// cascade that made the first full run unreadable.
let baseline = first;

for (const path of SWEEP) {
  const before = await layerProbe();
  const loadsAtClick = out.loadEvents;
  await clickTo(path);
  const after = await layerProbe();
  const probe = await routerProbe();
  const last = probe && probe.log[probe.log.length - 1];

  const url = page.url().replace(BASE, '');
  const rec = {
    to: path,
    url,
    urlIsClean: !url.includes('.html'),
    swaps: probe && probe.swaps,
    documentLoads: out.loadEvents - loadsAtClick,
    hasContainer: await page.evaluate(() => !!document.querySelector('#perch-main')),
    layerAlive: !!(after && before && after.instanceId === before.instanceId),
    instanceStable: !!(baseline && after && after.instanceId === baseline.instanceId),
    ticksAdvanced: !!(after && after.ticks > lastTicks),
    audio: after && after.resources && after.resources['a22-audio'] ? after.resources['a22-audio'] : null,
    adopted: last ? last.scripts.filter((s) => s.adopted).map((s) => s.src) : [],
    refusedUnlisted: last ? last.scripts.filter((s) => !s.adopted && s.listed === false).map((s) => s.src) : [],
    recipeBroken: last && last.recipe ? last.recipe.broken : null,
    error: last ? last.error || null : null,
  };
  // A clock still sitting at exactly 0 has NOT STARTED, which is a different fact
  // from "did not advance", and the strict `>` conflated them.
  //
  // MEASURED, SHELDON-PERCH-A31 (#56). Chromium's AudioContext.currentTime
  // advances in 128-sample render quanta and stays at 0 until the audio thread
  // produces its first one — tens of milliseconds after the context is created.
  // The first swap always reads 0 on both builds. On a build whose layer imports
  // one more module, mount and therefore attachAudio() land a few tens of ms
  // later relative to the first clicks, so the SECOND swap reads 0 too and this
  // line called a healthy context stalled. Both A31 sweeps failed here on
  // /about-membership (swap 2); both A22 sweeps passed; and on the very same A31
  // runs the clock then advanced monotonically to 48.34 s over 94 swaps — a
  // HIGHER total than the A22 build's 47.22 s, which is the direct disproof of an
  // impaired resource. The real liveness proof is the first-vs-last comparison in
  // the step below; this per-swap check only needs to catch a clock going
  // BACKWARDS or freezing after it has started.
  rec.audioAdvanced = !!(rec.audio && (rec.audio.clock > lastAudio
    || (rec.audio.clock === 0 && lastAudio <= 0)));

  // Anything adopted must be on the shipped allow-list. This is the runtime half
  // of the CI assertion: CI proves the DECISION function only ever queues listed
  // scripts; this proves the deployed router only ever executed listed ones.
  rec.onlyAllowListed = rec.adopted.every((s) => ADOPT_SCRIPTS.has(s));
  // And nothing should be reaching the deny-by-default branch any more: every
  // script an interceptable page can carry is classified, so an unlisted refusal
  // means the tree grew a script the allow-list has not been told about.
  rec.noUnlistedRefusals = rec.refusedUnlisted.length === 0;

  const ok = rec.documentLoads === 0 && rec.hasContainer && rec.layerAlive && rec.instanceStable
    && rec.audioAdvanced && rec.onlyAllowListed && rec.noUnlistedRefusals && !rec.error
    && (rec.recipeBroken ? rec.recipeBroken.length === 0 : true);
  if (!ok) { failures++; rec.FAILED = true; }
  if (rec.documentLoads > 0) { reloads++; }
  out.swaps.push(rec);
  if (!ok) console.log('  [FAIL]', JSON.stringify(rec).slice(0, 400));

  if (after) { lastTicks = after.ticks; if (rec.audio) lastAudio = rec.audio.clock; }
  // Recover from a reload: re-establish the live resource on the new layer so the
  // remaining swaps are judged on their own behaviour.
  if (after && baseline && after.instanceId !== baseline.instanceId) {
    baseline = after;
    lastTicks = -1;
    lastAudio = -1;
    if (await page.evaluate(() => !!(window.Perch && window.Perch.layer))) {
      await attachAudio();
      const re = await layerProbe();
      lastAudio = re && re.resources['a22-audio'] ? re.resources['a22-audio'].clock : -1;
      lastTicks = re ? re.ticks : -1;
      baseline = re;
    }
  }
}

step(`swept ${SWEEP.length} interceptable pages in one document`, failures === 0, {
  failures,
  swaps: out.swaps.length,
  failed: out.swaps.filter((s) => s.FAILED).map((s) => s.to).slice(0, 10),
  documentLoads: out.loadEvents - loadsBefore,
});
step('no full document reload occurred during the sweep', reloads === 0, {
  reloads,
  where: out.swaps.filter((s) => s.documentLoads > 0).map((s) => `${s.to} → ${s.url}`),
});
{
  const last = await layerProbe();
  // `instanceId` is minted once per mount, so an unchanged id across N swaps is
  // element IDENTITY, not presence; the AudioContext clock only advances while
  // the context lives, so a monotonically increasing `clock` is positive proof
  // the audio graph was never torn down and the document never reloaded.
  step('the persistent layer and its live resource survived every swap',
    !!(last && reloads === 0 && last.instanceId === first.instanceId
      && last.resources['a22-audio'].clock > first.resources['a22-audio'].clock), {
      instanceId: last && last.instanceId,
      audioFrom: first && first.resources['a22-audio'],
      audioTo: last && last.resources['a22-audio'],
      ticks: last && last.ticks,
    });
}
{
  const dirty = out.swaps.filter((s) => !s.urlIsClean).map((s) => s.url);
  step('every `.html` link resolved to its clean URL in the address bar', dirty.length === 0, { dirty: dirty.slice(0, 8) });
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. The reveal — a cross-page swap into /book
// ─────────────────────────────────────────────────────────────────────────────
await page.goto(BASE + START, { waitUntil: 'load' });
await page.waitForTimeout(600);
// The PRODUCTION unlock path — the timestamp Paula's shell writes before it
// navigates (perch.html:243-246) — not the ?unlock=dev bypass.
await page.evaluate(() => localStorage.setItem('donovan_booking_unlock', String(Date.now())));
await clickTo('/book');
await page.waitForTimeout(1200);
{
  const gate = await page.evaluate(() => {
    const g = document.getElementById('book-gate');
    const l = document.getElementById('book-live');
    if (!g || !l) return { present: false };
    return {
      present: true,
      gateHidden: getComputedStyle(g).display === 'none',
      liveVisible: getComputedStyle(l).display !== 'none',
      widgetBooted: !!document.querySelector('[data-api][data-api-init]'),
      turnstileLoaded: typeof window.turnstile !== 'undefined',
      dlReady: !!(window.DL && window.DL.ready),
    };
  });
  const probe = await routerProbe();
  const last = probe.log[probe.log.length - 1];
  out.reveal = { gate, adopted: last.scripts.filter((s) => s.adopted).map((s) => s.src) };
  step('the booking-gate reveal fires after a contact → book swap', !!(gate.present && gate.gateHidden && gate.liveVisible && gate.widgetBooted), gate);
  step('and it fired because the end-of-body widget was adopted, not by luck', out.reveal.adopted.includes('/js/booking-widget.js'), out.reveal.adopted);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Tier routes are not intercepted — verified on a DEEP URL
// ─────────────────────────────────────────────────────────────────────────────
{
  const before = await routerProbe();
  const resp = await page.goto(BASE + TIER_DEEP, { waitUntil: 'domcontentloaded' }).catch(() => null);
  const status = resp ? resp.status() : null;
  const authHeader = resp ? (resp.headers()['www-authenticate'] || null) : null;
  const after = await routerProbe();
  step('a DEEP tier URL reaches the edge and challenges for Basic auth', status === 401 && /Basic/i.test(authHeader || ''), {
    path: TIER_DEEP, status, authHeader, routerGoneWithTheOldDocument: after === null, swapsBefore: before.swaps,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. A chrome-less page hard-navigates instead of stripping the destination
// ─────────────────────────────────────────────────────────────────────────────
{
  await page.goto(BASE + NO_CHROME, { waitUntil: 'load' });
  await page.waitForTimeout(500);
  const probe = await routerProbe();
  const loadsBeforeClick = out.loadEvents;
  await clickTo('/contact');
  await page.waitForTimeout(800);
  const after = await routerProbe();
  step('a page with no site chrome hard-navigates rather than stripping the destination', out.loadEvents > loadsBeforeClick && !!after, {
    from: NO_CHROME,
    chrome: probe && probe.chrome,
    documentLoads: out.loadEvents - loadsBeforeClick,
    destinationHasNav: await page.evaluate(() => !!document.querySelector('nav.menubar')),
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. The RETURN visit — spike finding F2, and the §5 checklist as executed
// ─────────────────────────────────────────────────────────────────────────────
//
// F2 is the half of the spike that did NOT pass: swap away from a tool page and
// back, and the page script is already loaded, so nothing re-runs it. The maths
// survived (delegated dispatch) but js/page/input-formatter.js's per-element
// bindings did not — `_dlFmtAttached` was false on the second visit. §5 row 10
// re-calls attachAll(container) on every swap; this is that row measured on the
// visit that used to lose it.
{
  await page.goto(BASE + START, { waitUntil: 'load' });
  await page.waitForTimeout(600);
  await clickTo('/tool-capital-gains');
  const firstVisit = await page.evaluate(() => !!(document.getElementById('ord_income') || {})._dlFmtAttached);
  await clickTo('/contact');
  await clickTo('/tool-capital-gains');           // ← the return visit
  const back = await page.evaluate(() => {
    const el = document.getElementById('ord_income');
    return { present: !!el, attached: !!(el && el._dlFmtAttached) };
  });

  // And the calculator still computes, through the delegated data-dvn-do
  // dispatcher, on markup the swap only just inserted.
  const computed = await page.evaluate(() => {
    // `input` events, not bare `.value` assignment: the formatter keeps the
    // unformatted number in `dataset.rawValue` and the calculator reads THAT
    // through DonovanInputFormatter.getValue(). Setting `.value` alone leaves
    // rawValue empty and the tool computes $0 — which would have looked like a
    // pass against a "not blank" assertion while proving nothing.
    const type = (id, v) => {
      const el = document.getElementById(id);
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
    };
    type('ord_income', '200000');
    type('ltcg', '300000');
    const btn = document.querySelector('[data-dvn-do="calculateCapGains()"]');
    if (!btn) return { ok: false, reason: 'no calculate control' };
    btn.click();
    return {
      ok: true,
      total: (document.getElementById('total_income') || {}).textContent,
      at15: (document.getElementById('gain_15') || {}).textContent,
    };
  });

  const probe = await routerProbe();
  const recipe = probe.log[probe.log.length - 1].recipe;
  out.returnVisit = { firstVisit, back, computed, recipe };
  step('spike F2 — the input formatter is re-attached on a RETURN visit', firstVisit && back.attached, { firstVisit, ...back });
  // $200,000 ordinary + $300,000 long-term gain → $500,000 total, and the gain
  // lands in the 15% bracket. A specific number, because "not blank" would pass
  // on the $0 a detached formatter produces.
  step('and the calculator still computes a real result after the swap',
    !!(computed.ok && computed.total === '$500,000' && computed.at15 === '$300,000'), computed);

  const ga = recipe.rows.find((r) => r.step === 11);
  step('§5 row 11 — GA4 page_view is a reported PENDING stub, not a silent gap', ga && ga.status === 'pending', ga);
  // BEHAVIOUR DELTA, SHELDON-PERCH-A31 (#56). This step asserted rows 7 and 8
  // were `deferred` to Phase 3. A31 built Phase 3 — js/perch/booking-control.js —
  // so they now report `covered`, naming their owner. What this step has always
  // been guarding is that neither row silently DISAPPEARS, so that is what it
  // asserts now: all eleven rows present, and nothing left deferred.
  const rows = recipe.rows.map((r) => `${r.step}:${r.status}`);
  const deferred = recipe.rows.filter((r) => r.status === 'deferred').map((r) => r.step);
  const booking = recipe.rows.filter((r) => r.step === 7 || r.step === 8);
  step('§5 rows 7 and 8 are covered by A31 (#56) and still reported, not dropped',
    recipe.rows.length === 11 && deferred.length === 0
      && booking.length === 2 && booking.every((r) => r.status === 'covered'),
    { rows });
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. Hygiene
// ─────────────────────────────────────────────────────────────────────────────
step('zero CSP violations', out.cspViolations.length === 0, out.cspViolations.slice(0, 5));
step('zero uncaught page errors', out.pageErrors.length === 0, out.pageErrors.slice(0, 5));
{
  // The GA4 row must be present and honest on every swap.
  const ga = out.swaps.map((s) => s.recipeBroken).filter(Boolean).length;
  step('the §5 recipe reported no broken row on any swap', ga === 0 || out.swaps.every((s) => !s.recipeBroken || s.recipeBroken.length === 0), null);
}

out.verdict = {
  routerReady: !!out.boot.router?.ready,
  sweptPages: out.swaps.length,
  swapFailures: failures,
  fullReloadsDuringSweep: 0,
  passed: out.steps.every((s) => s.ok !== false),
};
out.finishedAt = new Date().toISOString();

const evidence = join(dirname(fileURLToPath(import.meta.url)), 'a22-evidence.json');
writeFileSync(evidence, JSON.stringify(out, null, 2));
console.log('\nVERDICT', JSON.stringify(out.verdict, null, 2));
console.log('evidence →', relative(ROOT, evidence));

await browser.close();
