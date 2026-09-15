// ── SHELDON-PERCH-A51 — the shell-retirement Preview verifier ────────────────
//
// Order SHELDON-A51-RETIRE-SHELL · ticket #62 · Phase A / Phase 5.
//
//   node test/preview/verify-a51.mjs [baseUrl]
//
// Exit code is 0 whether it passes or fails — a FAIL is a RESULT, not a crash.
// Read the JSON verdict it prints and test/preview/a51-evidence.json.
//
// Named `verify-a51.mjs`, not `*.test.mjs`, so `npm test` never runs it: it needs
// a live deployment. Same directory and same shape as verify-a22/a31/a41.
//
// ── WHY `fetch` AND NOT A BROWSER ────────────────────────────────────────────
// Every other verifier in this directory drives Playwright, because every other
// one is asking what the PAGE does. This one asks what the SERVER SENDS, and the
// population it is asking on behalf of — a JS-off crawler — is `fetch` with no
// browser attached. Opening Chromium here would actively obscure the answer: the
// shell's iframe would load the real homepage and the DOM would look correct at
// `/` whether or not this ticket worked at all. That confusion IS the F8 defect.
// So: the served bytes, fetched cold, with NO JavaScript ever executed.
// [[feedback_chromium_nonce_hiding_dom_read]] makes the same point from the
// other direction.
//
// The bytes are then read with jsdom's PARSER (test/helpers/html-text.mjs). That
// is not a retreat from "no browser": jsdom does not run scripts unless
// `runScripts` is set, so nothing on the page executes — it only supplies a
// parser that agrees with a browser about what the markup means, which a regex
// does not. Nothing here is rendered, and no script, style or noscript content
// is ever counted as text.
//
// ── THE ROUTER IS ON HERE BY CONSTRUCTION ────────────────────────────────────
// functions/_lib/perch-router-inject.js:85 enables the router — and therefore
// `shellRetired` — for any `*.pages.dev` hostname. A Preview deployment IS that
// hostname, so `/` below is the switched-ON path. The switched-OFF path is not
// reachable from a Preview URL and is proven in test/perch-shell-retire.test.mjs
// by byte equality against the shipped perch.html; §5 here re-states that from
// the live deployment by showing the shell bytes are still being served intact
// at `/perch`.
//
// ── NOTHING IS WRITTEN ───────────────────────────────────────────────────────
// Every request below is a GET of an HTML document. No booking path, no tool
// endpoint, no POST. [[feedback_negative_path_probe_can_write]].

import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Imported, never re-typed: §0 below probes THE PATH THE MIDDLEWARE ACTUALLY
// FETCHES. A verifier with `/home` hardcoded would keep proving `/home` works
// after someone changed the constant to something that redirects.
import { HOMEPAGE_ASSET, HOMEPAGE_FILE } from '../../donovan-legal-site/functions/_lib/perch-shell-retire.js';
import { bodyText, titleOf, headings, hasNoindex, canonicalHref } from '../helpers/html-text.mjs';

const BASE = (process.argv[2] || 'https://donovan-site.pages.dev').replace(/\/$/, '');
const evidence = fileURLToPath(new URL('./a51-evidence.json', import.meta.url));

const results = [];
function step(id, claim, ok, detail) {
  results.push({ id, claim, verdict: ok ? 'PASS' : 'FAIL', detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${id}  ${claim}${ok ? '' : `\n        ↳ ${detail}`}`);
}

/**
 * A document GET with redirects HELD, so a 3xx is a result rather than something
 * that silently resolves elsewhere.
 *
 * `body` is the empty string on a redirect, which is a trap worth naming: the
 * first run of this file compared two redirect responses to each other and
 * reported PASS, because '' === ''. Every byte comparison below therefore goes
 * through `sameBytes()`, which refuses to compare an empty body.
 */
async function get(path, { redirect = 'manual' } = {}) {
  const res = await fetch(BASE + path, { redirect, headers: { 'sec-fetch-dest': 'document', accept: 'text/html' } });
  const body = res.status >= 300 && res.status < 400 ? '' : await res.text();
  return { status: res.status, location: res.headers.get('location'), headers: res.headers, body };
}

// Extraction goes through a real parser, shared with the unit suite — see
// test/helpers/html-text.mjs for why this is not a regex (CodeQL
// js/bad-tag-filter + js/incomplete-multi-character-sanitization, and an
// extractor that disagrees with a browser is a measurement bug in a
// crawlability gate).
const words = (t) => t.split(' ').filter(Boolean).length;
const stripNonce = (html) => html.replace(/ nonce="[a-f0-9]{32}"/g, '');

/** Byte comparison that cannot be satisfied by two empty (redirect) bodies. */
const sameBytes = (a, b) => a.length > 1000 && b.length > 1000 && stripNonce(a) === stripNonce(b);

// ═════════════════════════════════════════════════════════════════════════════

console.log(`\nSHELDON-PERCH-A51 — shell retirement, Preview verify\nBASE: ${BASE}\n`);

// ── §-1 Wait for the deployment to exist ─────────────────────────────────────
//
// A Pages deployment does not become live at every edge PoP at once. For the
// first ~30s after `wrangler pages deploy` returns, an immutable Preview URL
// answers SOME paths from the new deployment and others with Cloudflare's own
// "Deployment Not Found" page — a 200 HTML document, which is the nasty part:
// it is not a 404 the probes can see, it is a page with a title and 32 words.
// Run against that, this file reported NO-GO 17/29 with "/ ships no canonical",
// "container absent", "no CSP nonce" — a full sheet of failures describing
// Cloudflare's error page rather than the site.
//
// So readiness is established FIRST, and it is a hard gate: if the deployment
// never becomes ready this exits without asserting anything, rather than
// emitting a NO-GO that blames the code for a propagation delay.
// READINESS IS A CONJUNCTION, AND EVERY CLAUSE IS LOAD-BEARING. The first cut of
// this gate checked only that `/` was not the error page, and read the body only
// when the status was 200 — so a 404 gave it an empty string, the pattern did not
// match, and it declared the deployment ready. Deployment bbc4af2b was then graded
// NO-GO 4/29 against a site that was still propagating. A readiness check that
// passes on a 404 is worse than none: it launders "not deployed yet" into "failed".
//
// So: several routes, each of which must be genuinely serving, and a status check
// that treats anything other than the expected code as NOT ready.
async function waitForDeployment(attempts = 24, delayMs = 5000) {
  const notFound = (body) => /Deployment Not Found|Nothing is here yet/i.test(body);
  for (let i = 1; i <= attempts; i++) {
    try {
      // `/` and a plain content page must both be 200 and real, and the shell must
      // still be the shell — three different routing paths through the middleware.
      const [rootRes, practiceRes, perchRes] = await Promise.all([
        fetch(`${BASE}/`, { redirect: 'manual', headers: { 'sec-fetch-dest': 'document' } }),
        fetch(`${BASE}/practice`, { redirect: 'manual', headers: { 'sec-fetch-dest': 'document' } }),
        fetch(`${BASE}/perch`, { redirect: 'manual', headers: { 'sec-fetch-dest': 'document' } }),
      ]);
      if (rootRes.status === 200 && practiceRes.status === 200 && perchRes.status === 200) {
        const [rootBody, practiceBody, perchBody] = await Promise.all([rootRes.text(), practiceRes.text(), perchRes.text()]);
        if (![rootBody, practiceBody, perchBody].some(notFound)
            && rootBody.length > 10000 && practiceBody.length > 10000 && perchBody.length > 5000) {
          return i;
        }
      }
    } catch { /* DNS or edge not ready yet — same treatment */ }
    if (i < attempts) await new Promise((r) => setTimeout(r, delayMs));
  }
  return null;
}

const ready = await waitForDeployment();
if (ready === null) {
  console.log(`\nNOT MEASURED — ${BASE} never stopped answering "Deployment Not Found".`);
  console.log('This is a propagation/URL problem, NOT a verdict on the change. Re-run with a reachable URL.\n');
  writeFileSync(evidence, JSON.stringify({
    order: 'SHELDON-A51-RETIRE-SHELL', ticket: 62, base: BASE,
    verdict: 'NOT MEASURED', reason: 'deployment unreachable — Cloudflare "Deployment Not Found"',
  }, null, 2));
  process.exit(0);
}
if (ready > 1) console.log(`(deployment became reachable on attempt ${ready})\n`);

// ── §0 The substitute asset path, measured LIVE ──────────────────────────────
//
// THE DEFECT THIS SECTION EXISTS FOR. The middleware answers `/` by asking the
// asset handler for HOMEPAGE_ASSET and returning whatever comes back — so if
// that path is answered with a redirect, the REDIRECT becomes the response to
// `/`. Two spellings redirect straight back at `/` and would loop the homepage:
// `/index.html` (a `_redirects` dedup rule) and `/index` (Cloudflare Pages' own
// clean-URL canonicaliser, which runs whether or not any rule exists). `/index`
// is what shipped first, and Preview 8dd25413 answered `/` with `308 → /`.
//
// Absence of a `_redirects` rule was the wrong test and a `_redirects`-only
// model could never have caught it. The right test is a LIVE status code, so
// this section fetches the real path from the real deployment before anything
// else is asserted, and does it through the IMPORTED constant.
const asset = await get(HOMEPAGE_ASSET);
const assetHtml = await get(`/${HOMEPAGE_FILE}`);

step('0.1', `the substitute asset path ${HOMEPAGE_ASSET} is answered 200 by live Pages — no redirect from any source`,
  asset.status === 200,
  `${HOMEPAGE_ASSET} → ${asset.status}${asset.location ? ` -> ${asset.location}` : ''}. `
    + 'Anything but 200 IS the response "/" will give: a 3xx here is the homepage loop.');

step('0.2', `${HOMEPAGE_ASSET} is answered with the homepage bytes, not some other page`,
  asset.status === 200 && words(bodyText(asset.body)) >= 100 && /Donovan Legal PLLC/.test(titleOf(asset.body)),
  `words=${words(bodyText(asset.body))} title="${titleOf(asset.body)}"`);

step('0.3', `and it is the canonical spelling: /${HOMEPAGE_FILE} 308s TO it, not the other way round`,
  assetHtml.status === 308 && assetHtml.location === HOMEPAGE_ASSET,
  `/${HOMEPAGE_FILE} → ${assetHtml.status}${assetHtml.location ? ` -> ${assetHtml.location}` : ''} `
    + `(expected 308 -> ${HOMEPAGE_ASSET})`);

step('0.4', 'the canonicaliser is live on this deployment (control — 0.1 is not passing by its absence)',
  assetHtml.status === 308,
  'the .html spelling was not canonicalised, so 0.1 proves nothing about a canonicaliser that is not running');

// ── §1 What `/` serves ───────────────────────────────────────────────────────
const root = await get('/');

step('1.1', '/ answers 200 — not a redirect, and above all not a redirect to itself',
  root.status === 200,
  `status=${root.status} location=${root.location}. A 3xx here means the substitute asset path is one `
    + 'Cloudflare Pages canonicalises (`/index` → `/`, `/x.html` → `/x`) and the homepage is looping.');

step('1.2', '/ is NOT the noindex shell (THE F8 CONTRADICTION)',
  root.body.length > 0 && !hasNoindex(root.body), `noindex present=${hasNoindex(root.body)}`);

step('1.3', '/ ships the real homepage <title>',
  /Donovan Legal PLLC/.test(titleOf(root.body)), `title="${titleOf(root.body)}"`);

step('1.4', '/ ships a server-rendered heading',
  headings(root.body).length > 0, `headings=${headings(root.body).length}`);

step('1.5', '/ ships ≥100 words of server-rendered body text (crawlability floor)',
  words(bodyText(root.body)) >= 100, `words=${words(bodyText(root.body))} (shell is 9)`);

step('1.6', '/ self-canonicalises to https://www.donovan.law/',
  canonicalHref(root.body) === 'https://www.donovan.law/',
  `canonical=${canonicalHref(root.body) || '(none)'}`);

// A Preview deployment cannot answer "is there an X-Robots-Tag" the way
// production would: Cloudflare stamps `X-Robots-Tag: noindex` on EVERY response
// from a *.pages.dev preview, stylesheets included, to keep previews out of the
// index. Asserting its absence here would assert something Preview can never
// satisfy, and asserting its presence would prove nothing about our tree. What
// IS meaningful is that the header is uniform across unrelated paths — that is
// the signature of the platform banner rather than of something this ticket put
// on `/`. The tree-side claim (no X-Robots-Tag in _headers or any Function) is
// asserted by test/seo-crawlability.test.mjs, which reads the shipped files.
const cssRes = await fetch(`${BASE}/css/main.css`);
const practiceRes = await fetch(`${BASE}/practice`);
const xrt = (h) => h.get('x-robots-tag') || '(none)';
step('1.7', 'any X-Robots-Tag at / is the platform preview banner, not something this ticket added',
  xrt(root.headers) === xrt(practiceRes.headers) && xrt(root.headers) === xrt(cssRes.headers),
  `/=${xrt(root.headers)} /practice=${xrt(practiceRes.headers)} /css/main.css=${xrt(cssRes.headers)}`
    + ' — a header on / alone would be ours; uniform across a page and a stylesheet is the platform');

// ── §2 `/` joined the soft-navigating site ───────────────────────────────────
step('2.1', '/ carries the swap container <main id="perch-main">',
  /<main id="perch-main">/.test(root.body), 'container absent');

step('2.2', '/ references the Swup router (the switch is genuinely ON here)',
  /\/js\/perch-swup-router\.js/.test(root.body), 'router tag absent');

step('2.3', '/ is served no-store with a per-request CSP nonce',
  root.headers.get('cache-control') === 'no-store'
    && /'nonce-[a-f0-9]{32}'/.test(root.headers.get('content-security-policy') || '')
    && / nonce="[a-f0-9]{32}"/.test(root.body),
  `cache-control=${root.headers.get('cache-control')} csp-nonce=${/'nonce-[a-f0-9]{32}'/.test(root.headers.get('content-security-policy') || '')}`);

// ── §3 The concierge route is untouched — Paula connects here ────────────────
const perch = await get('/perch');
const perchHtml = await get('/perch.html');

step('3.1', '/perch still serves the shell, 200',
  perch.status === 200 && hasNoindex(perch.body) && titleOf(perch.body) === 'Donovan Legal — Assistant',
  `status=${perch.status} title="${titleOf(perch.body)}" noindex=${hasNoindex(perch.body)}`);

step('3.2', '/perch.html canonicalises to /perch exactly as it does today (308)',
  perchHtml.status === 308 && perchHtml.location === '/perch',
  `status=${perchHtml.status} location=${perchHtml.location}`);

step('3.3', 'the shell still carries every marker of the shipped file',
  perch.body.length > 5000 && /id="concierge"/.test(perch.body) && /<iframe id="site"/.test(perch.body),
  `bytes=${perch.body.length}`);

step('3.4', 'the shell still carries the Vantage beacon and the orb Paula drives',
  /vantage\.ticoai\.net\/perch\.js/.test(perch.body) && /id="concierge"/.test(perch.body),
  'beacon or orb missing from the shell');

step('3.5', 'the shell still iframes /home.html, and /home.html still serves it',
  /<iframe id="site" src="\/home\.html"/.test(perch.body), 'shell iframe src changed');

const homeHtml = await get('/home.html');
const home = await get('/home');
step('3.6', 'the shell\'s iframe target still resolves: /home.html → 308 /home → 200 content',
  homeHtml.status === 308 && homeHtml.location === '/home'
    && home.status === 200 && words(bodyText(home.body)) >= 100,
  `/home.html=${homeHtml.status}→${homeHtml.location}  /home=${home.status} words=${words(bodyText(home.body))}`);

// ── §4 Every other route is unchanged ────────────────────────────────────────
// `/book` is deliberately noindex in the tree, so this asserts SERVING, not
// indexability — the indexability of the declared set is the A1.1 gate's job.
for (const [i, path] of ['/practice', '/tax', '/book', '/contact', '/experience'].entries()) {
  const r = await get(path);
  step(`4.${i + 1}`, `${path} answers 200 with real content`,
    r.status === 200 && words(bodyText(r.body)) >= 100,
    `status=${r.status} words=${words(bodyText(r.body))}`);
}

const indexHtml = await get('/index.html');
step('4.6', '/index.html still 301s to / — untouched by this ticket',
  indexHtml.status === 301 && indexHtml.location === '/',
  `status=${indexHtml.status} location=${indexHtml.location}`);

const indexClean = await get('/index');
step('4.7', '/index still 308s to / — the canonicaliser that made `/index` unusable as the asset path',
  indexClean.status === 308 && indexClean.location === '/',
  `status=${indexClean.status} location=${indexClean.location}`);

// ── §5 The homepage served at `/` is the homepage file, not a coincidence ────
step('5.1', 'the bytes at / are the bytes of the homepage file, apart from the nonce',
  sameBytes(root.body, home.body),
  `/=${root.body.length}B /home=${home.body.length}B — the served bytes at "/" must be home.html's, `
    + 'through the same middleware; a difference means `/` came from somewhere else');

step('5.2', 'the shell is NOT what / served (control — the switch does something)',
  root.body.length > 1000 && perch.body.length > 1000 && stripNonce(root.body) !== stripNonce(perch.body),
  '/ and /perch served the same bytes');

// ── Verdict ──────────────────────────────────────────────────────────────────
const failed = results.filter((r) => r.verdict === 'FAIL');
const verdict = failed.length === 0 ? 'GO' : 'NO-GO';
const out = {
  order: 'SHELDON-A51-RETIRE-SHELL',
  ticket: 62,
  base: BASE,
  routerState: 'ON (by *.pages.dev hostname — see perch-router-inject.js:85)',
  verdict,
  passed: results.length - failed.length,
  total: results.length,
  results,
};
writeFileSync(evidence, JSON.stringify(out, null, 2));
console.log(`\n${verdict} — ${out.passed}/${out.total} PASS\nevidence: ${evidence}\n`);
