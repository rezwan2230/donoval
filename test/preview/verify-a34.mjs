// ── DR-INSANE-A34 — the Preview verifier for the frame headers ───────────────
//
// Order DR-INSANE-A34-FRAME-HEADERS · ticket #59 · Phase A / Phase 3.
//
//   node test/preview/verify-a34.mjs [previewBaseUrl] [productionBaseUrl]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and test/preview/a34-evidence.json.
//
// Named `verify-a34.mjs`, not `*.test.mjs`, so `npm test` never runs it: it needs a
// live deployment and a real browser, neither of which CI has. Same directory and
// same shape as verify-a22 / verify-a31 / verify-a41.
//
// ── THE THREE CLAIMS, AND WHERE EACH IS MEASURED ─────────────────────────────
//
//   §A  ROUTER ON — the Preview is `*.pages.dev`, which functions/_lib/
//       perch-router-inject.js enables the router for by hostname, so this is the
//       post-cutover path without this file setting anything. Both frame headers
//       must be present on a real content response.
//
//   §B  THE NONCE CSP STILL WORKS — a header assertion cannot tell a live policy
//       from a broken one. So a real Chromium loads the page and this counts CSP
//       violations, and separately proves inline <script> ACTUALLY EXECUTED. A
//       page whose every inline block was refused would still return two correct
//       frame headers, and §A alone would call that a pass.
//
//   §C  ROUTER OFF IS UNCHANGED — measured against LIVE PRODUCTION, which is
//       running origin/main with PERCH_ROUTER unset. That is "today" in the most
//       literal available sense. This file then runs THIS BRANCH's middleware
//       in-process on the router-off path and compares the headers it produces to
//       the ones production actually served. The unit differential in
//       test/perch-frame-headers.test.mjs proves branch-off === main-off against
//       `git show origin/main`; this proves that main-off is what the world is
//       being served right now, which is the half a unit test cannot reach.
//
// ── WHAT IS COMPARED IN §C, AND WHY NOT EVERY HEADER ─────────────────────────
// Only the headers this middleware OWNS or deliberately strips. `date`, `cf-ray`,
// `server`, `content-encoding` and friends are added by the edge below the Worker
// and vary per request by design; asserting on them would produce a red that says
// nothing about this change. The owned set is enumerated explicitly below rather
// than filtered by a pattern, so a header this change accidentally started setting
// could not slip through as "not in the pattern".
//
// ── NOTHING IS WRITTEN ───────────────────────────────────────────────────────
// This is a read-only probe: GETs for headers and one page load per URL. It never
// touches /booking/create, so the live-Clio hazard that shaped verify-a41 does not
// arise here. The write path is blocked at the context anyway, as a belt.

import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { onRequest } from '../../donovan-legal-site/functions/_middleware.js';

const arg = (i) => (process.argv[i + 2] && !process.argv[i + 2].startsWith('--') ? process.argv[i + 2].replace(/\/$/, '') : null);
// The alias, not the branch name: Cloudflare truncates the branch slug (here at 28
// chars, `…-frame-hea`), so the obvious URL 404s on the Pages wildcard and reads as
// "the middleware is not running" when the deployment is perfectly healthy.
const BASE = arg(0) || 'https://drinsane-perch-a34-frame-hea.donovan-site.pages.dev';
const PROD = arg(1) || 'https://www.donovan.law';

// Content pages, plus the shell. The shell matters on its own: it is the one page
// with a 'skip' plan, so a frame gate wired to the per-page plan instead of the
// deployment would leave exactly this URL permissive after the cutover.
const PAGES = ['/', '/home', '/contact.html', '/perch.html'];
const ASSET = '/css/main.css';
/** A path that exists in production, for the §C "what is served today" capture. */
const PROD_DOC = '/home';

/** The headers this middleware owns. `null` means "must be absent". */
const OWNED = ['content-security-policy', 'x-frame-options', 'cache-control', 'etag', 'last-modified'];

const out = {
  order: 'DR-INSANE-A34-FRAME-HEADERS',
  ticket: 59,
  base: BASE,
  prod: PROD,
  startedAt: new Date().toISOString(),
  steps: [],
  headers: { preview: {}, production: {}, branchRouterOff: {} },
  cspViolations: [],
  pageErrors: [],
  console: [],
  notes: [],
};

function step(id, name, ok, detail) {
  out.steps.push({ id, name, ok: !!ok, detail: detail === undefined ? null : detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${name}`);
  if (!ok) console.log('      ' + JSON.stringify(detail));
  return ok;
}
const note = (t) => { out.notes.push(t); console.log('note  ' + t); };

/** `a; b` → { a: 'a …', b: 'b …' }, keyed by directive name. */
function directives(csp) {
  const map = {};
  for (const part of (csp || '').split(';')) {
    const t = part.trim();
    if (t) map[t.split(/\s+/)[0]] = t;
  }
  return map;
}

/**
 * The nonce is per-request, so two responses never agree byte for byte and a raw
 * comparison would fail for the one reason that is not a defect. Blanking it is the
 * ONLY normalisation applied anywhere in this file.
 */
const denonce = (v) => (typeof v === 'string' ? v.replace(/'nonce-[a-f0-9]{32}'/g, "'nonce-X'") : v);

/** Pick the owned headers off a live response, absent ones included as null. */
function owned(headers) {
  const o = {};
  for (const k of OWNED) o[k] = denonce(headers[k] ?? null);
  return o;
}

async function liveHeaders(url) {
  // GET, not HEAD: the middleware's HTML branch early-returns on a bodyless
  // response, so a HEAD would measure a path production never serves to a browser.
  const res = await fetch(url, { redirect: 'follow', headers: { accept: 'text/html,*/*' } });
  const h = {};
  for (const [k, v] of res.headers) h[k.toLowerCase()] = v;
  return { status: res.status, url: res.url, headers: h };
}

/** Run THIS BRANCH's middleware in Node on the router-off path. */
async function branchHeaders({ env, ctype }) {
  class PassThrough { on() { return this; } transform(r) { return r; } }
  const saved = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = PassThrough;
  try {
    const res = await onRequest({
      request: new Request(`${PROD}${PROD_DOC}`),
      env,
      next: async () => new Response('<html><head></head><body><main>x</main></body></html>', {
        status: 200,
        // Mirror what the Pages asset handler attaches, validators included — the
        // ETag/Last-Modified strip is part of the byte-identity claim.
        headers: { 'content-type': ctype, etag: 'W/"a34"', 'last-modified': 'Sat, 25 Jul 2026 00:00:00 GMT' },
      }),
    });
    const h = {};
    for (const [k, v] of res.headers) h[k.toLowerCase()] = v;
    return h;
  } finally {
    globalThis.HTMLRewriter = saved;
  }
}

async function main() {
  // ═══════════════════════════════════════════════════════════════════════════
  // §A — Preview, router ON: both frame headers on a real content response
  // ═══════════════════════════════════════════════════════════════════════════
  for (const path of PAGES) {
    const r = await liveHeaders(BASE + path);
    out.headers.preview[path] = { status: r.status, ...owned(r.headers) };
    const fa = directives(r.headers['content-security-policy'])['frame-ancestors'];

    step(`A1${path}`, `frame-ancestors is exactly 'self' on ${path}`,
      r.status === 200 && fa === "frame-ancestors 'self'",
      { status: r.status, frameAncestors: fa || null });

    step(`A2${path}`, `X-Frame-Options is SAMEORIGIN on ${path}`,
      r.headers['x-frame-options'] === 'SAMEORIGIN',
      { xfo: r.headers['x-frame-options'] || null });
  }

  const asset = await liveHeaders(BASE + ASSET);
  out.headers.preview[ASSET] = { status: asset.status, ...owned(asset.headers) };
  step('A3', 'the frame headers also cover a non-HTML response',
    asset.headers['x-frame-options'] === 'SAMEORIGIN'
      && directives(asset.headers['content-security-policy'])['frame-ancestors'] === "frame-ancestors 'self'",
    out.headers.preview[ASSET]);

  // ═══════════════════════════════════════════════════════════════════════════
  // §B — the nonce CSP is intact and LIVE, not merely present
  // ═══════════════════════════════════════════════════════════════════════════
  const doc = await liveHeaders(BASE + PROD_DOC);
  const d = directives(doc.headers['content-security-policy']);
  const scriptSrc = d['script-src'] || '';

  step('B1', 'script-src still carries a 32-hex per-request nonce',
    /'nonce-[a-f0-9]{32}'/.test(scriptSrc), { scriptSrc: denonce(scriptSrc) });

  step('B2', "script-src gained no 'unsafe-inline', 'unsafe-eval' or 'strict-dynamic'",
    !/unsafe-inline|unsafe-eval/.test(scriptSrc) && !/strict-dynamic/.test(doc.headers['content-security-policy'] || ''),
    { scriptSrc: denonce(scriptSrc) });

  const second = await liveHeaders(BASE + PROD_DOC);
  const n1 = /'nonce-([a-f0-9]{32})'/.exec(doc.headers['content-security-policy'] || '');
  const n2 = /'nonce-([a-f0-9]{32})'/.exec(second.headers['content-security-policy'] || '');
  step('B3', 'the nonce is still regenerated per request, not frozen by this change',
    !!(n1 && n2) && n1[1] !== n2[1], { first: n1 && n1[1], second: n2 && n2[1] });

  const browser = await chromium.launch();
  const context = await browser.newContext();
  // Belt: this probe has no reason to reach the write path, and a probe that
  // believed it was on a read-only path has booked a real Clio appointment in this
  // repo before ([[feedback_negative_path_probe_can_write]]).
  await context.route('**/booking/create*', (route) => route.abort());

  for (const path of PAGES) {
    const page = await context.newPage();
    page.on('console', (m) => {
      const t = m.text().slice(0, 400);
      out.console.push({ where: path, type: m.type(), text: t.slice(0, 200) });
      if (/Content Security Policy|Refused to (load|execute|apply|frame|connect)/i.test(t)) {
        out.cspViolations.push({ where: path, text: t });
      }
    });
    page.on('pageerror', (e) => out.pageErrors.push({ where: path, error: String(e).slice(0, 300) }));

    // The browser's own violation event, not just the console text. A headless
    // console format change would silently zero the regex above; this would not.
    await page.addInitScript(() => {
      window.__a34 = [];
      document.addEventListener('securitypolicyviolation', (e) => {
        window.__a34.push({ directive: e.effectiveDirective, blocked: String(e.blockedURI).slice(0, 200) });
      });
    });

    await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 45000 });
    const events = await page.evaluate(() => window.__a34 || []);
    for (const e of events) out.cspViolations.push({ where: path, ...e, source: 'securitypolicyviolation' });

    // ── The stamping contract is measured on the SERVED HTML, not on the DOM ──
    //
    // NOT `document.querySelectorAll('script:not([src])')` + `getAttribute('nonce')`.
    // Chromium implements nonce hiding: once the document is parsed the `nonce`
    // CONTENT attribute is emptied and the value moves to an internal slot exposed
    // only as the `.nonce` IDL property. A DOM read therefore reports 0 stamped
    // scripts on a perfectly stamped page — which is a false red about the exact
    // thing this step exists to confirm.
    //
    // The bytes Cloudflare sent are the source of truth, and they are fetched with
    // their OWN response's CSP so header and body are compared as an actual PAIR.
    // Fetching them separately from the browser load is fine: `no-store` means each
    // request gets a fresh nonce anyway, and any of them proves the contract.
    const served = await fetch(BASE + path);
    const servedCsp = served.headers.get('content-security-policy') || '';
    const servedNonce = (/'nonce-([a-f0-9]{32})'/.exec(servedCsp) || [])[1] || null;
    const servedHtml = await served.text();
    const tags = servedHtml.match(/<script\b[^>]*>/gi) || [];
    const inlineTags = tags.filter((t) => !/\bsrc=/i.test(t));
    const stamped = inlineTags.filter((t) => servedNonce && t.includes(`nonce="${servedNonce}"`));

    const live = await page.evaluate(() => ({
      // `.nonce`, the IDL property, is what survives nonce hiding.
      idlNonced: [...document.querySelectorAll('script:not([src])')].filter((s) => s.nonce).length,
      inlineInDom: document.querySelectorAll('script:not([src])').length,
      // External modules whose execution proves script-src is admitting the site's
      // own JS at all — a policy refusing everything would leave all of these unset.
      alive: { perch: !!window.Perch, dataLayer: !!window.dataLayer, booking: !!window.DLBooking },
    }));

    const detail = { servedNonce, inlineInServedHtml: inlineTags.length, stamped: stamped.length, externalScripts: tags.length - inlineTags.length, ...live };
    out.headers.preview[`${path}#body`] = detail;
    step(`B4${path}`, `every inline <script> in the served HTML carries THIS response's nonce (${path})`,
      !!servedNonce && stamped.length === inlineTags.length, detail);
    await page.close();
  }

  // CONTROL for B4: if no page in the set had an inline <script>, every B4 above
  // passed by having nothing to measure. Say so rather than let a vacuous green
  // stand in for the stamping contract.
  const bodies = PAGES.map((p) => out.headers.preview[`${p}#body`]).filter(Boolean);
  const totalInline = bodies.reduce((n, b) => n + b.inlineInServedHtml, 0);
  step('B4-control', 'the stamping check was not vacuous — inline <script> blocks exist in the set',
    totalInline > 0, { totalInline, perPage: Object.fromEntries(PAGES.map((p, i) => [p, bodies[i] && bodies[i].inlineInServedHtml])) });

  step('B4-alive', "the site's own JS executed under the policy — script-src is admitting it",
    bodies.some((b) => b.alive && (b.alive.perch || b.alive.dataLayer || b.alive.booking)),
    { alive: bodies.map((b) => b.alive) });

  step('B5', 'ZERO CSP violations across every page loaded',
    out.cspViolations.length === 0, { count: out.cspViolations.length, violations: out.cspViolations.slice(0, 10) });

  step('B6', 'no page threw an uncaught error',
    out.pageErrors.length === 0, { pageErrors: out.pageErrors.slice(0, 8) });

  // ── B7/B8: what the two headers actually DO, from both sides ────────────────
  //
  // A header assertion is a claim about a string. These two are claims about the
  // browser, and they are the pair that matters: the same-origin embed must still
  // work (or the cutover breaks the shell) and the foreign embed must not (or this
  // change bought nothing). Their console output goes to its own bucket — a refusal
  // here is the EXPECTED result, and folding it into `cspViolations` would make the
  // headline violation count read as a failure of §B.
  const frameProbe = [];
  const watchFrames = (p, where) => p.on('console', (m) => {
    const t = m.text().slice(0, 400);
    if (/Refused to display|frame-ancestors|Content Security Policy/i.test(t)) frameProbe.push({ where, text: t });
  });

  const samePage = await context.newPage();
  watchFrames(samePage, 'same-origin');
  await samePage.goto(BASE + '/perch.html', { waitUntil: 'networkidle', timeout: 45000 });
  const framed = await samePage.evaluate(async (base) => {
    const f = document.createElement('iframe');
    f.src = base + '/home';
    document.body.appendChild(f);
    await new Promise((r) => { f.onload = r; f.onerror = r; setTimeout(r, 8000); });
    try {
      // Same-origin, so the document IS reachable — which is exactly why this is a
      // usable signal here and NOT in B8 below, where SOP hides it either way.
      return { loaded: !!(f.contentDocument && f.contentDocument.body), title: f.contentDocument ? f.contentDocument.title : null };
    } catch (e) {
      return { loaded: false, error: String(e).slice(0, 200) };
    }
  }, BASE);
  step('B7', "a SAME-ORIGIN frame still loads under frame-ancestors 'self' — the shell path survives cutover",
    framed.loaded === true && frameProbe.filter((f) => f.where === 'same-origin').length === 0,
    { framed, refusals: frameProbe.filter((f) => f.where === 'same-origin') });
  await samePage.close();

  // The security claim itself. A FOREIGN top-level origin is synthesised by
  // fulfilling a request inside the browser — no third-party host is contacted and
  // nothing is published anywhere. Cross-origin SOP hides `contentDocument` whether
  // the frame loaded or was refused, so the signal is Chromium's refusal message in
  // the PARENT console plus the absence of a committed frame URL, not the DOM.
  const foreignPage = await context.newPage();
  watchFrames(foreignPage, 'foreign');
  await foreignPage.route('https://a34-foreign-embedder.invalid/**', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html',
    body: `<!doctype html><title>foreign</title><iframe id="f" src="${BASE}/home"></iframe>`,
  }));
  await foreignPage.goto('https://a34-foreign-embedder.invalid/', { waitUntil: 'domcontentloaded', timeout: 45000 });
  await foreignPage.waitForTimeout(6000);
  const foreignFrames = foreignPage.frames().filter((f) => f !== foreignPage.mainFrame()).map((f) => f.url());
  const refused = frameProbe.filter((f) => f.where === 'foreign');
  step('B8', 'a FOREIGN origin is REFUSED the frame — the point of the change',
    refused.length > 0 && !foreignFrames.some((u) => u.startsWith(BASE)),
    { refusals: refused.slice(0, 3), childFrameUrls: foreignFrames });
  await foreignPage.close();

  out.frameProbe = frameProbe;
  await browser.close();

  // ═══════════════════════════════════════════════════════════════════════════
  // §C — router OFF is byte-unchanged from what production serves today
  // ═══════════════════════════════════════════════════════════════════════════
  const prodDoc = await liveHeaders(PROD + PROD_DOC);
  const prodAsset = await liveHeaders(PROD + ASSET);
  out.headers.production[PROD_DOC] = { status: prodDoc.status, ...owned(prodDoc.headers) };
  out.headers.production[ASSET] = { status: prodAsset.status, ...owned(prodAsset.headers) };

  step('C1', 'production is on the router-off path today — no X-Frame-Options, permissive frame-ancestors',
    prodDoc.headers['x-frame-options'] === undefined
      && directives(prodDoc.headers['content-security-policy'])['frame-ancestors'] === "frame-ancestors 'self' https://vantage.ticoai.net https://*.ticoai.net",
    out.headers.production[PROD_DOC]);

  for (const [label, ctype, live] of [
    ['html', 'text/html; charset=utf-8', prodDoc],
    ['css', 'text/css', prodAsset],
  ]) {
    const branch = await branchHeaders({ env: { PERCH_ROUTER: 'off' }, ctype });
    out.headers.branchRouterOff[label] = owned(branch);
    const mine = owned(branch);
    const theirs = owned(live.headers);
    // `cache-control` on the asset comes from _headers, which this Node run has no
    // access to, so it is compared only where the middleware sets it (HTML).
    const keys = label === 'html' ? OWNED : ['content-security-policy', 'x-frame-options'];
    const diff = keys.filter((k) => mine[k] !== theirs[k]);
    step(`C2-${label}`, `router OFF: the ${label} headers this branch emits match live production byte for byte`,
      diff.length === 0, { differing: diff, branch: mine, production: theirs });
  }

  const branchOn = owned(await branchHeaders({ env: { PERCH_ROUTER: 'on' }, ctype: 'text/html; charset=utf-8' }));
  step('C3', 'CONTROL: the same comparison DOES separate router-on from production',
    branchOn['x-frame-options'] === 'SAMEORIGIN'
      && branchOn['content-security-policy'] !== owned(prodDoc.headers)['content-security-policy'],
    { branchRouterOn: branchOn['x-frame-options'] });

  note('production is untouched by this change until PERCH_ROUTER=on is set and a build is promoted — C1 records the state at run time.');

  out.finishedAt = new Date().toISOString();
  out.pass = out.steps.every((s) => s.ok);
  out.failed = out.steps.filter((s) => !s.ok).map((s) => `${s.id} ${s.name}`);

  const evidence = fileURLToPath(new URL('./a34-evidence.json', import.meta.url));
  writeFileSync(evidence, JSON.stringify(out, null, 2));
  console.log('\n' + JSON.stringify({
    verdict: out.pass ? 'PASS' : 'FAIL',
    base: BASE,
    prod: PROD,
    steps: out.steps.length,
    passed: out.steps.filter((s) => s.ok).length,
    failed: out.failed,
    cspViolations: out.cspViolations.length,
    pageErrors: out.pageErrors.length,
    evidence,
  }, null, 2));
}

main().catch((e) => {
  out.fatal = String(e && e.stack ? e.stack : e);
  out.pass = false;
  console.error('verifier crashed:', out.fatal);
  writeFileSync(fileURLToPath(new URL('./a34-evidence.json', import.meta.url)), JSON.stringify(out, null, 2));
});
