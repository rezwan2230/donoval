// ── JORDAN-PERCH-LAUNCHER-PARITY — the Preview verifier ──────────────────────
//
// Order JORDAN-PERCH-LAUNCHER-PARITY · Phase A post-promote · concierge presentation.
//
//   npm i playwright --no-save
//   node test/preview/verify-launcher-parity.mjs [previewUrl] [productionUrl]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the printed verdict and test/preview/launcher-parity-evidence.json.
//
// Named `verify-*.mjs`, not `*.test.mjs`, so `npm test` never runs it: it needs a
// live deployment. Same directory and same shape as verify-a22/a31/a41/a51.
//
// ── WHAT IT ASKS ─────────────────────────────────────────────────────────────
// The unit suite (test/perch-launcher-parity.test.mjs) proves the widget BUILDS
// the concierge and that the stylesheet NAMES it. Neither of those is proof that
// a visitor sees it: the launcher is a <button> being painted by rules authored
// for a <div>, inside a document carrying Bootstrap, main.css and Animate.css —
// a cascade the unit suite has no model of. jsdom also computes no layout and
// loads no images, so "the avatar is there" and "the avatar RENDERED" are two
// different claims and only a browser can answer the second.
//
// So this file measures, on the live deployment:
//
//   §1  the router is on and the shell is retired — the state the ticket targets
//   §2  `/` and `/testimonials` render the Paula concierge, with the image
//       DECODED (naturalWidth > 0), which is also the img-src proof
//   §3  the computed paint matches `/perch`'s `#concierge`, read off the shell
//       itself rather than off a copy of its values
//   §4  the concierge survives four soft navigations as the SAME NODE, still
//       dressed, still hit-testable at its own centre
//   §5  zero CSP violations and zero page errors across the whole run
//   §6  before/after screenshots for the reviewer
//
// ── NOTHING IS WRITTEN, AND NO CALL IS PLACED ────────────────────────────────
// Every request is a GET of a document or an asset. The launcher is measured and
// hit-tested but never clicked: a click mints a /web-call token and opens a mic.
// [[feedback_negative_path_probe_can_write]].
//
// ── "BEFORE" IS PRODUCTION, NOT A MOCK ───────────────────────────────────────
// The persistent layer is injected by functions/_lib/perch-layer-inject.js on
// every page that gets a swap container, and that injection is NOT router-gated —
// so production content pages already host this launcher, undressed. Production
// is therefore the honest before-image, and §6 shoots the same element on the
// same page at both origins.

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const arg = (i) => (process.argv[i] && !process.argv[i].startsWith('--') ? process.argv[i].replace(/\/$/, '') : null);

// The branch alias: `jordan/perch-launcher-parity` → `jordan-perch-launcher-parity`,
// 28 characters — exactly the hostname truncation Cloudflare Pages applies, so pass
// the immutable per-deployment URL as argv[2] rather than trusting the alias.
// [[feedback_pages_alias_slug_truncation]]
const BASE = arg(2) || process.env.PARITY_BASE_URL || 'https://jordan-perch-launcher-parity.donovan-site.pages.dev';
const BEFORE = arg(3) || process.env.PARITY_BEFORE_URL || 'https://www.donovan.law';

const HOME = '/';
const CONTENT = '/testimonials';
const SHELL = '/perch';
const SWAP_TARGETS = ['/contact', '/blog', '/testimonials', '/contact'];

const shotDir = fileURLToPath(new URL('./screenshots/', import.meta.url));
const evidence = fileURLToPath(new URL('./launcher-parity-evidence.json', import.meta.url));
mkdirSync(shotDir, { recursive: true });

const out = {
  order: 'JORDAN-PERCH-LAUNCHER-PARITY',
  gates: 'PROMOTE',
  base: BASE,
  before: BEFORE,
  startedAt: new Date().toISOString(),
  steps: [],
  screenshots: [],
  console: [],
  pageErrors: [],
  cspViolations: [],
  notes: [],
};

function step(id, name, ok, detail) {
  out.steps.push({ id, name, ok: !!ok, detail: detail === undefined ? null : detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${name}`);
  if (!ok) console.log('      ↳ ' + JSON.stringify(detail));
  return ok;
}
const note = (t) => { out.notes.push(t); console.log('note  ' + t); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Console/error observers every page in this run shares. */
function watch(page, where) {
  page.on('console', (m) => {
    const t = m.text().slice(0, 300);
    out.console.push({ where, type: m.type(), text: t });
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(t)) {
      out.cspViolations.push({ where, text: m.text().slice(0, 400) });
    }
  });
  // The DOM event, not just the console line. Chromium reports a blocked
  // resource on both channels, but a violation raised before the console
  // listener attaches would only ever be visible here.
  page.on('pageerror', (e) => out.pageErrors.push({ where, error: String(e).slice(0, 300) }));
}

const CSP_HOOK = () => {
  window.__cspHits = [];
  document.addEventListener('securitypolicyviolation', (e) => {
    window.__cspHits.push({ directive: e.effectiveDirective, blocked: String(e.blockedURI).slice(0, 200) });
  });
};

/**
 * Everything about the concierge on the page currently loaded.
 *
 * Reads the LIVE element and its computed style — not the stylesheet, and not
 * the markup. `naturalWidth > 0` is the load proof: an `<img>` blocked by
 * `img-src` still has a `src`, still has a `complete` of true, and still answers
 * `getAttribute` exactly as a loaded one does. Only the decoded dimensions
 * distinguish "the browser fetched and drew this" from "the policy refused it".
 */
const READ = () => {
  const el = document.getElementById('dvn-perch-launcher') || document.getElementById('concierge');
  if (!el) return { found: false };
  const face = el.querySelector('.disc .face');
  const disc = el.querySelector('.disc');
  const cta = el.querySelector('.cta');
  const ring = el.querySelector('.ring');
  const cs = (n) => (n ? getComputedStyle(n) : null);
  const box = (n) => { const r = n.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), right: Math.round(r.right) }; };
  const s = cs(el); const ds = cs(disc); const ts = cs(cta); const rs = cs(ring);
  const layer = document.getElementById('perch-persistent');
  const container = document.getElementById('perch-main');
  const hit = (() => {
    if (!disc) return null;
    const r = disc.getBoundingClientRect();
    const h = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
    return { hitIsSelfOrChild: !!h && (h === el || el.contains(h)), tag: h ? h.tagName + (h.id ? '#' + h.id : '') : null };
  })();
  return {
    found: true,
    id: el.id,
    dressed: el.classList.contains('perch-concierge'),
    inLayer: !!layer && layer.contains(el),
    insideContainer: !!container && container.contains(el),
    avatar: face ? {
      src: new URL(face.getAttribute('src'), location.href).pathname,
      sameOrigin: new URL(face.src, location.href).origin === location.origin,
      naturalWidth: face.naturalWidth,
      complete: face.complete,
      objectFit: cs(face).objectFit,
    } : null,
    ctaText: cta ? cta.textContent : null,
    rings: el.querySelectorAll('.ring').length,
    // The paint signature both concierges must agree on.
    paint: {
      box: box(el),
      position: s.position,
      disc: disc ? { box: box(disc), borderRadius: ds.borderRadius, borderTopColor: ds.borderTopColor, borderTopWidth: ds.borderTopWidth, overflow: ds.overflow } : null,
      cta: cta ? { fontSize: ts.fontSize, fontWeight: ts.fontWeight, borderRadius: ts.borderRadius, backgroundColor: ts.backgroundColor, color: ts.color, opacity: ts.opacity, visible: box(cta).w > 0 } : null,
      ring: ring ? { borderTopColor: rs.borderTopColor, borderTopWidth: rs.borderTopWidth, borderRadius: rs.borderRadius } : null,
    },
    hit,
    cspHits: window.__cspHits || [],
  };
};

/** Tag the concierge node so a swap that re-created it is detectable. */
const BRAND = () => {
  const el = document.getElementById('dvn-perch-launcher');
  if (el) el.dataset.parityBrand = 'jordan-' + Math.random().toString(36).slice(2, 10);
  return el ? el.dataset.parityBrand : null;
};
const READ_BRAND = () => {
  const el = document.getElementById('dvn-perch-launcher');
  return el ? el.dataset.parityBrand || null : null;
};

/** Soft-navigate by CLICKING a link — the router's own entry point, not a harness. */
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
  await sleep(1200);
  return how;
}

/** A screenshot of the concierge corner, at a fixed clip so before/after align. */
async function shootConcierge(page, name, label) {
  const clip = { x: 1280 - 340, y: 900 - 300, width: 340, height: 300 };
  const file = shotDir + name;
  await page.screenshot({ path: file, clip });
  out.screenshots.push({ name, label, file, clip });
  console.log(`shot  ${name}  ${label}`);
  return file;
}

/**
 * A page that is genuinely ready to be photographed.
 *
 * A Pages deployment that is still propagating answers 200 with a
 * "Deployment Not Found" document, and grading that produces a sheet of false
 * fails. [[feedback_preview_not_found_is_a_200_page]] — so readiness is asserted,
 * not assumed, before anything is measured.
 */
async function open(ctx, where, url) {
  const page = await ctx.newPage();
  watch(page, where);
  await page.addInitScript(CSP_HOOK);
  const res = await page.goto(url, { waitUntil: 'networkidle', timeout: 45000 });
  const title = await page.title();
  const notFound = /deployment not found/i.test(await page.content());
  if (notFound) throw new Error(`${url} answered ${res && res.status()} with a Pages "Deployment Not Found" page — the build is not live yet`);
  await sleep(900);   // the widget is a deferred script; give it its tick
  return { page, status: res && res.status(), title };
}

/** Compare two paint signatures on the fields a visitor can see. */
function paintDiff(a, b) {
  const diffs = [];
  const walk = (pa, pb, trail) => {
    for (const k of Object.keys(pa || {})) {
      const va = pa[k]; const vb = (pb || {})[k];
      if (va && typeof va === 'object') walk(va, vb, trail + '.' + k);
      else if (va !== vb) diffs.push({ field: (trail + '.' + k).slice(1), shell: vb, content: va });
    }
  };
  walk(a, b, '');
  return diffs;
}

async function main() {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });

  // ═══ §1 the deployment under test ═══════════════════════════════════════
  const home = await open(ctx, 'home', BASE + HOME);
  const boot = await home.page.evaluate(() => ({
    routerReady: !!(window.Perch && window.Perch.router) && window.Perch.router.probe().ready,
    routerActive: !!(window.Perch && window.Perch.layer) && window.Perch.layer.bookingProbe().routerActive,
    layer: window.Perch && window.Perch.layer ? window.Perch.layer.probe() : null,
    iframes: document.querySelectorAll('iframe').length,
    noindex: !!document.querySelector('meta[name=robots][content*=noindex]'),
    h1: (document.querySelector('main#perch-main h1') || {}).textContent || null,
  }));
  step('P1.1', '`/` is the retired-shell homepage on a router-ON deployment',
    boot.routerReady === true && boot.routerActive === true && boot.noindex === false && boot.iframes === 0,
    { status: home.status, title: home.title, ...boot, layer: undefined });
  step('P1.2', 'the persistent layer is mounted and holds exactly ONE concierge',
    !!boot.layer && boot.layer.concierge.count === 1 && boot.layer.concierge.allInLayer === true
      && boot.layer.concierge.insideContainer === false,
    boot.layer && { concierge: boot.layer.concierge, hostFallback: boot.layer.hostFallback });

  // ═══ §2 the concierge on the shell, which is the reference ══════════════
  const shell = await open(ctx, 'shell', BASE + SHELL);
  const shellOrb = await shell.page.evaluate(READ);
  step('P2.1', '`/perch` still renders the shell concierge, unchanged by this ticket',
    shellOrb.found === true && shellOrb.id === 'concierge' && shellOrb.rings === 2
      && shellOrb.avatar && shellOrb.avatar.naturalWidth > 0
      && shellOrb.ctaText === 'Click here to speak withPaula',
    { id: shellOrb.id, avatar: shellOrb.avatar, cta: shellOrb.ctaText, rings: shellOrb.rings });
  await shootConcierge(shell.page, 'reference-perch-shell.png', '/perch — the shell concierge (the reference)');

  // ═══ §3 the content pages ═══════════════════════════════════════════════
  const homeOrb = await home.page.evaluate(READ);
  const content = await open(ctx, 'content', BASE + CONTENT);
  const contentOrb = await content.page.evaluate(READ);

  for (const [id, where, orb] of [['P3.1', HOME, homeOrb], ['P3.2', CONTENT, contentOrb]]) {
    step(id, `${where} shows the Paula avatar and the "Click here to speak with Paula" concierge`,
      orb.found === true && orb.id === 'dvn-perch-launcher' && orb.dressed === true
        && orb.inLayer === true && orb.insideContainer === false
        && orb.rings === 2
        && !!orb.avatar && orb.avatar.src === '/img/Paula.jpg' && orb.avatar.sameOrigin === true
        && orb.avatar.naturalWidth > 0
        && orb.ctaText === 'Click here to speak withPaula'
        && orb.paint.cta.visible === true && orb.paint.cta.opacity === '1',
      { id: orb.id, dressed: orb.dressed, inLayer: orb.inLayer, avatar: orb.avatar, cta: orb.ctaText, ctaPaint: orb.paint.cta });
  }

  step('P3.3', 'the avatar DECODED under `img-src \'self\'` — same-origin, no CSP refusal',
    homeOrb.avatar && contentOrb.avatar
      && homeOrb.avatar.naturalWidth > 0 && contentOrb.avatar.naturalWidth > 0
      && homeOrb.avatar.sameOrigin && contentOrb.avatar.sameOrigin
      && homeOrb.cspHits.length === 0 && contentOrb.cspHits.length === 0,
    { home: homeOrb.avatar, content: contentOrb.avatar, cspHits: [...homeOrb.cspHits, ...contentOrb.cspHits] });

  // The parity claim, measured rather than asserted: the two concierges are
  // painted by ONE grouped rule set, so a computed-style diff is the check.
  const diffHome = paintDiff(homeOrb.paint, shellOrb.paint);
  const diffContent = paintDiff(contentOrb.paint, shellOrb.paint);
  step('P3.4', 'the content-page concierge is painted IDENTICALLY to `/perch`\'s',
    diffHome.length === 0 && diffContent.length === 0,
    { home: diffHome, content: diffContent, shell: shellOrb.paint });

  step('P3.5', 'and it is HIT-TESTABLE at the centre of its own disc',
    homeOrb.hit && homeOrb.hit.hitIsSelfOrChild === true
      && contentOrb.hit && contentOrb.hit.hitIsSelfOrChild === true,
    { home: homeOrb.hit, content: contentOrb.hit });

  await shootConcierge(content.page, 'after-testimonials.png', `AFTER — ${BASE}${CONTENT}`);
  await shootConcierge(home.page, 'after-home.png', `AFTER — ${BASE}${HOME}`);

  // ═══ §4 swap survival ═══════════════════════════════════════════════════
  const brand = await content.page.evaluate(BRAND);
  const before = await content.page.evaluate(() => window.Perch.layer.probe());
  const hops = [];
  for (const to of SWAP_TARGETS) {
    const how = await softNavigate(content.page, to);
    const after = await content.page.evaluate(READ);
    const probe = await content.page.evaluate(() => window.Perch.layer.probe());
    hops.push({
      to, how, path: await content.page.evaluate(() => location.pathname),
      brand: await content.page.evaluate(READ_BRAND),
      instanceId: probe.instanceId, ticks: probe.ticks,
      dressed: after.dressed, avatarWidth: after.avatar && after.avatar.naturalWidth,
      cta: after.ctaText, inLayer: after.inLayer, insideContainer: after.insideContainer,
    });
  }
  const survived = hops.every((h) => h.brand === brand && h.instanceId === before.instanceId
    && h.dressed === true && h.avatarWidth > 0 && h.cta === 'Click here to speak withPaula'
    && h.inLayer === true && h.insideContainer === false);
  step('P4.1', `the concierge survives ${SWAP_TARGETS.length} soft navigations as the SAME NODE, still dressed`,
    survived && hops[hops.length - 1].ticks > before.ticks,
    { brandAtStart: brand, instanceIdAtStart: before.instanceId, ticks: { before: before.ticks, after: hops[hops.length - 1].ticks }, hops });
  await shootConcierge(content.page, 'after-4-swaps.png', `AFTER — ${SWAP_TARGETS.length} swaps, still dressed`);

  // ═══ §5 the policy ══════════════════════════════════════════════════════
  const domHits = [];
  for (const [where, p] of [['home', home.page], ['content', content.page], ['shell', shell.page]]) {
    domHits.push({ where, hits: await p.evaluate(() => window.__cspHits || []) });
  }
  const totalDom = domHits.reduce((n, d) => n + d.hits.length, 0);
  step('P5.1', 'ZERO CSP violations across the run — console channel and DOM event channel',
    out.cspViolations.length === 0 && totalDom === 0,
    { console: out.cspViolations, dom: domHits });
  step('P5.2', 'and zero uncaught page errors',
    out.pageErrors.length === 0, out.pageErrors);
  note('This ticket changed no CSP directive. `img-src \'self\'` already admitted /img/Paula.jpg; '
    + 'P3.3 measures that it decoded rather than assuming the directive covers it.');

  // ═══ §6 the BEFORE image, from production ═══════════════════════════════
  //
  // Production is the honest before: the layer injection is not router-gated, so
  // www.donovan.law/testimonials hosts this same launcher, undressed.
  try {
    const prod = await open(ctx, 'before-prod', BEFORE + CONTENT);
    const prodOrb = await prod.page.evaluate(READ);
    await shootConcierge(prod.page, 'before-testimonials.png', `BEFORE — ${BEFORE}${CONTENT}`);
    step('P6.1', 'the BEFORE image is the real production launcher: present, in the layer, and UNDRESSED',
      prodOrb.found === true && prodOrb.id === 'dvn-perch-launcher'
        && prodOrb.dressed === false && prodOrb.avatar === null,
      { id: prodOrb.id, dressed: prodOrb.dressed, avatar: prodOrb.avatar, box: prodOrb.paint.box, inLayer: prodOrb.inLayer });
    await prod.page.close();
  } catch (e) {
    step('P6.1', 'the BEFORE image was captured from production', false, { error: String(e).slice(0, 300) });
  }

  const passed = out.steps.filter((s) => s.ok).length;
  out.verdict = out.steps.every((s) => s.ok) ? 'GO' : 'NO-GO';
  out.summary = `${passed}/${out.steps.length}`;
  out.finishedAt = new Date().toISOString();
  writeFileSync(evidence, JSON.stringify(out, null, 2));
  console.log(`\n${out.verdict}  ${out.summary}  → ${evidence}`);
  console.log(`screenshots → ${shotDir}`);

  await browser.close();
}

main().catch((e) => {
  out.verdict = 'ERROR';
  out.error = String(e && e.stack ? e.stack : e).slice(0, 2000);
  out.finishedAt = new Date().toISOString();
  writeFileSync(evidence, JSON.stringify(out, null, 2));
  console.error('ERROR ' + out.error);
});
