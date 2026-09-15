// ── JORDAN-PERCH-A21 — the Preview verifier ──────────────────────────────────
//
// Order JORDAN-PERCH-A21-OVERLAY · ticket #51, task 4. Drives a real Chromium
// against the Preview deployment so the report cites measurements rather than
// reasoning.
//
//   npm i -D playwright && npx playwright install chromium   # not a repo dep:
//   node verify/verify-a21.mjs [baseUrl]                     # CI never runs this
//
// It lives at the REPO ROOT, not under donovan-legal-site/, on purpose: the
// Pages deploy root IS donovan-legal-site and `wrangler pages deploy` has no
// --exclude, so anything dropped in there is published.
//
// Exit code is 0 whether the run passes or fails — a FAIL is a RESULT, not a
// crash. Read the JSON verdict it prints (and verify/a21-evidence.json).
//
// ── ON THE LIVE-RESOURCE STAND-IN ────────────────────────────────────────────
// Task 4 asks for "a live audio or timer resource with its clock advancing
// across the swap". The production resource is a Retell WebRTC session, and it
// cannot be started here: /web-call is gated behind a Cloudflare Turnstile
// solve, which refuses automation BY DESIGN. So the harness registers a real
// WebAudio graph (oscillator → near-silent gain → destination) through the
// layer's own public `attachLiveResource()` API — the same entry point the call
// uses. `audioCtx.currentTime` advances only while the context lives, so
// comparing it across a swap measures continuity, not mere object survival.
//
// This is a STAND-IN and is labelled as one in the report. What it proves is the
// structural claim the ticket makes: a live, stateful, non-DOM resource held by
// the layer's closure is untouched by a swap of main#perch-main. Whether Retell
// specifically reconnects is a manual check (see the PR body).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const BASE = (process.argv[2] || 'https://jordan-perch-a21-overlay.donovan-site.pages.dev').replace(/\/$/, '');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'donovan-legal-site');

// ── The page set ─────────────────────────────────────────────────────────────
// "No orb or call node is a descendant of the swap container on ANY page" is a
// claim about the whole site, so the sweep walks the real tree rather than a
// hand-picked five. Tier directories are excluded: they answer 401 to an
// unauthenticated probe (Basic auth), and this ticket must not touch tier-auth.
const TIER_DIRS = ['gold/', 'platinum/', 'diamond/', 'reserve/'];

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '.git') continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, out);
    else if (entry.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const ALL_PAGES = walk(SITE)
  .map((f) => path.relative(SITE, f).replace(/\\/g, '/'))
  .filter((rel) => !TIER_DIRS.some((d) => rel.startsWith(d)))
  .filter((rel) => rel !== '404.html' && rel !== '404.shtml')
  .sort();

// The four shapes A0.1 resolves differently, plus the shell. These get the deep
// swap-continuity run; the rest get the structural sweep.
const DEEP = [
  { label: 'wrap-div (div.box nav)', path: '/contact' },
  { label: 'wrap-body (header nav)', path: '/blog-controversy-roadmap-0-overview' },
  { label: 'wrap-body (no site nav)', path: '/blog-bramblett-phelan-two-entity-structure' },
  { label: 'wrap-div (booking page)', path: '/book' },
  { label: 'wrap-div (tool page)', path: '/tool-capital-gains' },
];

const out = {
  base: BASE,
  startedAt: new Date().toISOString(),
  steps: [],
  sweep: { pages: 0, ok: 0, problems: [] },
  skips: [],
  fallbacks: [],
  noConcierge: [],
  deep: [],
  console: [],
  cspViolations: [],
  pageErrors: [],
  notFound: [],
  verdict: {},
};

function step(name, data) {
  out.steps.push({ name, ...data });
  const mark = data.ok === undefined ? ' ·  ' : data.ok ? 'PASS' : 'FAIL';
  console.log(`[${mark}] ${name} ${JSON.stringify(data.detail ?? {}).slice(0, 300)}`);
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await ctx.newPage();

page.on('console', (m) => {
  const t = m.text();
  out.console.push(`${m.type()}: ${t}`);
  // A CSP refusal is a console message, not an exception — the whole reason the
  // A0.2 defect was invisible. Catch it explicitly.
  if (/Refused to (load|execute|apply)/i.test(t)) out.cspViolations.push(t);
});
page.on('pageerror', (e) => out.pageErrors.push(String(e)));
// Record WHICH resources 404 rather than only that some did — an unresolvable
// module specifier for the layer would show up here as a silent dead orb.
page.on('response', (r) => { if (r.status() >= 400) out.notFound.push(`${r.status()} ${r.url()}`); });

/** Read the layer's own diagnostics out of the live page. */
const placement = () => page.evaluate(() => {
  const L = window.Perch && window.Perch.layer;
  const container = document.getElementById('perch-main');
  const layer = document.getElementById('perch-persistent');
  const orb = document.getElementById('concierge');
  return {
    hasLayerApi: !!L,
    // Read from the DOM directly as well as from the layer's own inspect(), so a
    // bug in inspect() cannot certify itself.
    dom: {
      hasContainer: !!container,
      hasLayer: !!layer,
      hasOrb: !!orb,
      layerInsideContainer: !!(container && layer && container.contains(layer)),
      orbInsideContainer: !!(container && orb && container.contains(orb)),
      isDirectSibling: !!(container && layer && layer.parentNode === container.parentNode),
      immediatelyAfter: !!(container && layer && container.nextElementSibling === layer),
      orbInsideLayer: !!(layer && orb && layer.contains(orb)),
      // Any concierge node anywhere inside the container is a hard failure.
      strayInContainer: container
        ? [...container.querySelectorAll('#perch-persistent,#concierge,#caption,#qual,#dvn-perch-launcher')].map((e) => e.id)
        : [],
    },
    // ── the concierge itself ──
    // Exactly ONE entry point, inside the layer, and actually clickable. The
    // first revision of this ticket shipped two — the shell orb and the widget
    // launcher, both fixed bottom-right at z-index 2147483000 — and the orb was
    // visible but not hit-testable. Presence checks alone did not catch it;
    // elementFromPoint at the control's own centre did.
    concierge: (() => {
      const widget = document.getElementById('dvn-perch-launcher');
      const shellOrb = document.getElementById('concierge');
      const present = [widget, shellOrb].filter(Boolean);
      const primary = widget || shellOrb;
      if (!primary) return { count: 0, kind: 'none' };
      const r = primary.getBoundingClientRect();
      const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return {
        count: present.length,
        kind: widget ? 'widget' : 'shell-orb',
        allInLayer: !!layer && present.every((e) => layer.contains(e)),
        inViewport: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight + 1 && r.right <= innerWidth + 1,
        // The control must be the topmost thing at its own centre.
        clickable: !!top && (top === primary || primary.contains(top)),
        topAtCentre: top ? top.tagName + (top.id ? '#' + top.id : '') : 'none',
      };
    })(),
    // The layer must never swallow a click meant for the page.
    pageClickable: (() => {
      const e = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return !(e && e.closest('#perch-persistent'));
    })(),
    reported: L ? L.inspect() : null,
    hostFallback: L ? L.hostFallback : null,
    orbVisible: orb ? (orb.getBoundingClientRect().width > 0 && getComputedStyle(orb).visibility !== 'hidden') : false,
  };
});

// ── 0. Preflight: is Preview actually serving THIS branch's code? ────────────
//
// A Pages alias points at the newest deployment for the branch, and it flips
// whenever a deploy lands. A sweep started mid-rollout reads the OLD bundle for
// its first pages and the new one afterwards — which is exactly what happened
// once here: the first 50 pages reported two concierges because they were still
// being served the previous perch-layer.js. The run looked like a code defect.
//
// So the served assets are compared byte-for-byte against the working tree
// BEFORE anything is measured. See [[feedback_ci_builds_a_different_tree]]: a
// green check against the wrong bundle proves nothing.
const preflight = [];
for (const asset of ['/js/perch-layer.js', '/js/donovan-widget.js', '/js/perch/placement.js', '/css/perch-layer.css']) {
  const local = fs.readFileSync(path.join(SITE, asset.replace(/^\//, '')), 'utf8');
  const res = await fetch(BASE + asset);
  const served = await res.text();
  // The tree is mixed CRLF/LF and Pages serves it verbatim; normalise so a line
  // ending is not mistaken for a stale deploy.
  const norm = (t) => t.split('\r\n').join('\n');
  preflight.push({ asset, status: res.status, matches: norm(local) === norm(served) });
}
step('Preview is serving this working tree', {
  ok: preflight.every((a) => a.status === 200 && a.matches),
  detail: preflight,
});
if (!preflight.every((a) => a.status === 200 && a.matches)) {
  console.error('\nABORT: Preview is serving different code than the working tree.');
  console.error('The deploy is probably still rolling out. Re-run when it settles.\n');
  out.verdict = { PASS: false, reason: 'preflight: served assets do not match the working tree', preflight };
  fs.writeFileSync(path.join(ROOT, 'verify', 'a21-evidence.json'), JSON.stringify(out, null, 2));
  await browser.close();
  process.exit(0);
}
out.preflight = preflight;

// ── 1. Structural sweep across the whole public tree ─────────────────────────
console.log(`\n── sweep: ${ALL_PAGES.length} public pages ──`);
for (const rel of ALL_PAGES) {
  const url = `${BASE}/${rel}`;
  let r;
  try {
    const resp = await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    if (!resp || resp.status() >= 400) {
      out.sweep.problems.push({ rel, error: `HTTP ${resp ? resp.status() : 'none'}` });
      continue;
    }
    // WAIT for the page to settle instead of sampling at an arbitrary moment.
    // Sampling on `domcontentloaded` reported a false failure on a 301-redirected
    // path (/about-membership.html -> /engagement): the layer mounts correctly
    // there, it just had not mounted YET. A page that genuinely never mounts
    // times out below and is still recorded as a problem — the assertion is
    // unchanged, only the moment it is read.
    try {
      await page.waitForFunction(
        () => document.readyState === 'complete'
          && (!document.getElementById('perch-main') || !!(window.Perch && window.Perch.layer)),
        { timeout: 8000 },
      );
    } catch (e) {
      out.sweep.problems.push({ rel, error: 'layer never mounted within 8s' });
      continue;
    }
    r = await placement();
  } catch (e) {
    out.sweep.problems.push({ rel, error: String(e).slice(0, 160) });
    continue;
  }
  out.sweep.pages++;

  // Classify by what was SERVED, not by the filename requested. `_redirects`
  // 301s several paths elsewhere — `/index.html` lands on `/`, which is the
  // concierge shell — so a filename-keyed expectation would flag a page that is
  // behaving exactly as designed. Same reasoning as A0.1 keying its skip on the
  // orb element rather than on the path.
  const landedOn = new URL(page.url()).pathname;
  if (!r.dom.hasContainer) {
    // A page with no swap container is a skip page: the shell (which authors its
    // own orb) or the nav fragment. Either way it must carry NO injected layer.
    out.skips.push({ rel, landedOn, hasOrb: r.dom.hasOrb, hasLayer: r.dom.hasLayer });
    if (r.dom.hasLayer) {
      out.sweep.problems.push({ rel, landedOn, note: 'skip page must not carry a layer', r: r.dom });
    } else { out.sweep.ok++; }
    continue;
  }

  const c = r.concierge;
  // NEVER more than one concierge — that is the defect this revision fixed.
  // ZERO is legitimate: /book and /engagement-scoping deliberately ship no
  // launcher, and this ticket does not add one. When there IS one it must be in
  // the layer, on screen, and topmost at its own centre.
  const conciergeBad = c.count > 1
    || (c.count === 1 && (!c.allInLayer || !c.inViewport || !c.clickable));
  const bad = !r.dom.hasLayer
    || r.dom.layerInsideContainer || r.dom.orbInsideContainer
    || r.dom.strayInContainer.length > 0
    || !r.dom.isDirectSibling || !r.dom.immediatelyAfter
    || conciergeBad
    || !r.pageClickable;
  if (c.count === 0) out.noConcierge.push({ rel, landedOn });

  if (bad) out.sweep.problems.push({ rel, landedOn, r: r.dom, concierge: c, pageClickable: r.pageClickable, hostFallback: r.hostFallback });
  else out.sweep.ok++;

  if (r.hostFallback) {
    out.fallbacks.push({ rel, landedOn });
  }
}

step('every public page: exactly one concierge, inside the layer, direct sibling of #perch-main, clickable', {
  ok: out.sweep.problems.length === 0,
  detail: { pages: out.sweep.pages, ok: out.sweep.ok, problems: out.sweep.problems.length,
    skipPages: out.skips.length, hostFallbacks: out.fallbacks.length,
    pagesWithNoConcierge: out.noConcierge.map((n) => n.landedOn) },
});
if (out.sweep.problems.length) console.log(JSON.stringify(out.sweep.problems.slice(0, 12), null, 2));

// ── 2. Swap continuity, per shape ────────────────────────────────────────────
//
// A2.2 does not exist yet, so the swap is performed BY HAND here — which is what
// the ticket asks for: "a manual DOM swap of main#perch-main". Two variants,
// because routers differ in which one they do:
//   innerHTML  — Swup's default content replacement
//   replaceWith — routers that swap the container element itself
// A sibling survives both; a descendant survives neither.

for (const target of DEEP) {
  const url = BASE + target.path;
  const rec = { ...target, url };
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // A TRUSTED user gesture. Chromium's autoplay policy only starts an
  // AudioContext after one, and a scripted el.click() is not trusted — without
  // this the "long-lived audio resource" never starts and there is nothing to
  // measure. A real caller clicks the orb; so does the verifier.
  await page.mouse.click(10, 10);

  // Arm the live resource through the layer's PUBLIC API (see the header note).
  rec.armed = await page.evaluate(() => {
    const L = window.Perch && window.Perch.layer;
    if (!L) return { ok: false, why: 'no layer api' };
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const audio = new Ctx();
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      gain.gain.value = 0.0001; // a real resource, an inaudible output
      osc.connect(gain).connect(audio.destination);
      osc.start();
      if (audio.state === 'suspended') audio.resume();
      window.__a21audio = audio;
      L.attachLiveResource('verifier-audio', { clock: () => audio.currentTime, state: () => audio.state });
      return { ok: true };
    } catch (e) { return { ok: false, why: String(e).slice(0, 120) }; }
  });

  await page.waitForTimeout(700); // let the clocks accumulate something to compare

  const before = await page.evaluate(() => {
    const L = window.Perch.layer;
    const p = L.probe();
    // Node identity, not just presence: a rebuilt launcher looks identical to a
    // surviving one. Stash the actual objects to compare after the swap. The
    // concierge here is the WIDGET's launcher — comparing L.call would be
    // vacuous, because the layer builds no shell orb on a content page and
    // null === null passes for the wrong reason.
    window.__a21 = {
      layer: L.root,
      concierge: document.getElementById('dvn-perch-launcher') || document.getElementById('concierge'),
      api: L,
    };
    return p;
  });
  rec.before = before;

  // ── the manual swap: innerHTML ──
  rec.innerHTMLSwap = await page.evaluate(() => {
    const main = document.getElementById('perch-main');
    main.innerHTML = '<h1>A21 swapped content</h1><p>the container was replaced by hand</p>';
    document.dispatchEvent(new CustomEvent('perch:content-swapped', { detail: { url: location.pathname } }));
    return { containerText: main.textContent.trim().slice(0, 40) };
  });

  await page.waitForTimeout(700);

  // ── the harsher variant: replace the container ELEMENT ──
  rec.replaceWithSwap = await page.evaluate(() => {
    const main = document.getElementById('perch-main');
    const fresh = document.createElement('main');
    fresh.id = 'perch-main';
    fresh.innerHTML = '<h1>A21 element-level swap</h1>';
    main.replaceWith(fresh);
    document.dispatchEvent(new CustomEvent('perch:content-swapped', { detail: { url: location.pathname } }));
    return { containerText: fresh.textContent.trim().slice(0, 40) };
  });

  await page.waitForTimeout(700);

  const after = await page.evaluate(() => {
    const L = window.Perch.layer;
    const p = L.probe();
    const s = window.__a21;
    return {
      probe: p,
      identity: {
        sameLayerNode: document.getElementById('perch-persistent') === s.layer,
        sameConciergeNode: !!s.concierge
          && (document.getElementById('dvn-perch-launcher') || document.getElementById('concierge')) === s.concierge,
        sameLayerApi: L === s.api,
        layerStillConnected: s.layer.isConnected,
        conciergeStillConnected: !!s.concierge && s.concierge.isConnected,
        conciergeStillInLayer: !!s.concierge && s.layer.contains(s.concierge),
      },
      // The container was replaced wholesale; the layer must still resolve it.
      containerReResolves: !!L.container(),
    };
  });
  rec.after = after;

  const b = rec.before; const a = after.probe;
  rec.checks = {
    // Continuity of the CLOSURE, not just the DOM.
    instanceIdUnchanged: b.instanceId === a.instanceId,
    sameLayerNode: after.identity.sameLayerNode,
    // /book ships no launcher; assert identity only when there is one to track.
    sameConciergeNode: before.concierge && before.concierge.count === 1
      ? after.identity.sameConciergeNode : true,
    sameLayerApi: after.identity.sameLayerApi,
    layerStillConnected: after.identity.layerStillConnected,
    conciergeStillConnected: before.concierge && before.concierge.count === 1
      ? after.identity.conciergeStillConnected : true,
    conciergeStillInLayer: before.concierge && before.concierge.count === 1
      ? after.identity.conciergeStillInLayer : true,
    // Clocks. `ticks` resets to 0 on a document reload, so a swap that silently
    // fell back to a hard navigation fails here even though the orb looks fine.
    ticksAdvanced: a.ticks > b.ticks,
    uptimeAdvanced: a.uptimeMs > b.uptimeMs,
    audioClockAdvanced: !!(b.resources['verifier-audio'] && a.resources['verifier-audio']
      && a.resources['verifier-audio'].clock > b.resources['verifier-audio'].clock),
    audioStillRunning: !!(a.resources['verifier-audio'] && a.resources['verifier-audio'].state === 'running'),
    // Placement is still correct AFTER both swaps.
    stillOutsideContainer: a.placement.ok && !a.placement.layerInsideContainer && !a.placement.orbInsideContainer,
    // The direct-sibling placement is the ticket's contract, but a layer that had
    // to re-home to <body> (hostFallback) is legitimately not a sibling. Requiring
    // it unconditionally would report a FAIL for a case the design handles — so
    // it is asserted only when the sibling placement was actually taken, and the
    // fallback is surfaced on its own line instead of hiding inside a pass.
    stillDirectSibling: a.hostFallback ? true : a.placement.isDirectSibling,
    noFallbackNeeded: !a.hostFallback,
    containerReResolves: after.containerReResolves,
  };
  rec.ok = Object.values(rec.checks).every(Boolean);

  out.deep.push(rec);
  step(`swap continuity — ${target.label} (${target.path})`, {
    ok: rec.ok,
    detail: {
      ...rec.checks,
      audio: `${b.resources['verifier-audio']?.clock?.toFixed(3)} → ${a.resources['verifier-audio']?.clock?.toFixed(3)}`,
      ticks: `${b.ticks} → ${a.ticks}`,
    },
  });
}

// ── 3. The shell must not gain a second orb ──────────────────────────────────
await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(1200);
const shell = await page.evaluate(() => ({
  orbCount: document.querySelectorAll('#concierge').length,
  hasLayer: !!document.getElementById('perch-persistent'),
  hasContainer: !!document.getElementById('perch-main'),
  // The iframed content page must NOT mount a layer of its own.
  iframeLayer: (() => {
    try {
      const f = document.getElementById('site');
      const d = f && f.contentDocument;
      return d ? { hasLayer: !!d.getElementById('perch-persistent'), orbCount: d.querySelectorAll('#concierge').length } : null;
    } catch (e) { return { error: String(e).slice(0, 80) }; }
  })(),
}));
step('/ (the shell) — exactly one orb, no layer, iframed page mounts none', {
  ok: shell.orbCount === 1 && !shell.hasLayer && !shell.hasContainer
    && !!shell.iframeLayer && shell.iframeLayer.hasLayer === false && shell.iframeLayer.orbCount === 0,
  detail: shell,
});
out.shell = shell;

// ── 4. No CSP violations, no page errors ─────────────────────────────────────
step('no CSP violations', { ok: out.cspViolations.length === 0, detail: out.cspViolations.slice(0, 5) });
step('no uncaught page errors', { ok: out.pageErrors.length === 0, detail: out.pageErrors.slice(0, 5) });
// 404s are reported but do NOT gate the verdict: this tree has pre-existing
// missing assets that predate the ticket. What matters is that none of them is a
// layer asset, which IS gated.
const layer404 = out.notFound.filter((u) => /perch-layer|\/js\/perch\//.test(u));
step('no layer asset 404s', { ok: layer404.length === 0, detail: { layer404, otherNotFound: out.notFound.length } });

// ── Verdict ──────────────────────────────────────────────────────────────────
out.verdict = {
  sweepClean: out.sweep.problems.length === 0,
  sweepPages: out.sweep.pages,
  deepAllOk: out.deep.every((d) => d.ok),
  shellUnchanged: shell.orbCount === 1 && !shell.hasLayer,
  cspClean: out.cspViolations.length === 0,
  pageErrorsClean: out.pageErrors.length === 0,
  layerAssetsResolve: layer404.length === 0,
};
out.verdict.PASS = Object.values(out.verdict).every((v) => v === true || typeof v === 'number');
out.finishedAt = new Date().toISOString();

fs.writeFileSync(path.join(ROOT, 'verify', 'a21-evidence.json'), JSON.stringify(out, null, 2));
console.log('\n── VERDICT ──');
console.log(JSON.stringify(out.verdict, null, 2));
console.log(`\nevidence → verify/a21-evidence.json  (${out.console.length} console lines captured)`);

await browser.close();
