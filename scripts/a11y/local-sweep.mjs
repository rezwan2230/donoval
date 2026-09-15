#!/usr/bin/env node
/**
 * JORDAN-195-A11Y-REMEDIATE — before/after axe-core evidence for the pages this
 * order changed.
 *
 * ── WHY A SECOND HARNESS AND NOT `a11y-sweep.mjs` ────────────────────────────
 *
 * `scripts/a11y/a11y-sweep.mjs` measures the LIVE site from its sitemap. That is
 * the right instrument for "what are users getting", and it is what PR #216 ran.
 * It cannot answer "did my working tree fix it", because the working tree is not
 * deployed — and this order stops at opening a PR, so it never will be before the
 * evidence is due.
 *
 * So this serves the repo's own `donovan-legal-site/` over HTTP and measures the
 * SAME pages twice: once from a checkout of the base commit, once from the
 * working tree. Same axe version, same tag set, same viewport, same two-pass
 * settle — so the two columns are comparable to each other, which is what a
 * before/after claim actually needs.
 *
 * ── WHAT THIS HARNESS CAN AND CANNOT SEE ─────────────────────────────────────
 *
 * It serves static files. The Cloudflare middleware is not in the loop, so the
 * injected `main#perch-main`, the persistent call layer, the Swup router and the
 * booking bar are absent. That is stated rather than hidden because it bounds the
 * claim: every violation in PR #216's §4 is anchored to a selector inside the
 * page's own markup, and every colour pair it measured comes from the page's own
 * `<style>` block or `css/main.css`, both of which load here exactly as they do
 * in production. Chrome that this harness does not render also cannot be
 * regressed by a change that only edits CSS text — but a rule that fires only on
 * injected chrome would be invisible here, so this is evidence about the page's
 * own content, not a substitute for a live sweep after deploy.
 *
 * Usage:
 *   node scripts/a11y/local-sweep.mjs --pages <file-with-one-page-per-line> \
 *        --base <git-ref> --out <dir>
 */

import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, globSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, extname, resolve, sep } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = readFileSync(require.resolve('axe-core'), 'utf8');

const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const VIEWPORT = { width: 1280, height: 900 };
const SETTLE_MS = 1200;

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const OUT = arg('out', './a11y-local');
const BASE = arg('base', 'origin/main');
const PAGES_FILE = arg('pages', null);
const ROOT = process.cwd();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.gif': 'image/gif', '.ico': 'image/x-icon',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
  '.json': 'application/json; charset=utf-8', '.xml': 'application/xml',
};

/**
 * Every file under `root`, indexed by the URL path that should serve it.
 *
 * Built once, from the filesystem, before the server accepts anything.
 */
export function indexFiles(root) {
  const index = new Map();
  for (const abs of globSync(`${root.replace(/\\/g, '/')}/**/*`, { nodir: true })) {
    const full = resolve(abs);
    if (full !== root && !full.startsWith(root + sep)) continue; // belt and braces
    index.set('/' + full.slice(root.length + 1).split(sep).join('/'), full);
  }
  return index;
}

/**
 * A static file server rooted at `dir`. Returns { url, close }.
 *
 * ── THE REQUEST PATH NEVER REACHES THE FILESYSTEM ────────────────────────────
 *
 * Two earlier versions of this were wrong, and the second is the instructive one.
 *
 *   v1  `join(dir, path)` then `existsSync(file) || !file.startsWith(dir)` —
 *       flagged high by CodeQL, and rightly: the filesystem was touched with the
 *       request path BEFORE the path was allowed, and `startsWith` on a raw join
 *       is a string prefix test that a sibling directory ("…/site-backup" beside
 *       "…/site") walks straight through.
 *
 *   v2  the same containment test, correct this time, but factored into a
 *       `safeResolve()` helper that RETURNED the resolved path. CodeQL marked the
 *       original alert fixed and immediately raised two new ones on the
 *       `existsSync`/`readFileSync` below — because a barrier only counts when it
 *       sits on the path to the sink, and a helper that hands the value back does
 *       not. The tool was right again: the guard was real but the sink still
 *       consumed a value derived from the request.
 *
 * So the request path is no longer used to BUILD a path at all. Every file under
 * the root is indexed once at startup, and a request can only ever select an
 * entry from that map. What reaches `readFileSync` comes from the index — a value
 * this process derived from the filesystem — and no string the client sends can
 * become part of it. Traversal, encoding tricks and symlink games all reduce to
 * "that key is not in the map".
 */
export function serve(dir) {
  const root = resolve(dir);
  const index = indexFiles(root);

  const server = createServer((req, res) => {
    let requestPath;
    try {
      requestPath = decodeURIComponent(req.url.split('?')[0]);
    } catch {
      // A malformed %-escape is not a path we should guess at.
      res.writeHead(400, { 'content-type': 'text/plain' });
      return res.end('bad request');
    }

    const file = index.get(requestPath === '/' ? '/home.html' : requestPath);
    if (file === undefined) {
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('not found');
    }
    try {
      const body = readFileSync(file);
      res.writeHead(200, { 'content-type': MIME[extname(file).toLowerCase()] || 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(500).end('error');
    }
  });
  // Named `done` and not `resolve`: `resolve` is `node:path`'s, used above, and
  // shadowing it here is how a path check quietly stops being one.
  return new Promise((done) => {
    server.listen(0, '127.0.0.1', () => {
      done({ url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() });
    });
  });
}

/**
 * Run axe twice, 1200ms apart, and report only nodes that reproduce in BOTH
 * passes — the same discipline PR #216 used, because a single pass on this site
 * was measured to manufacture contrast nodes that are not really there.
 */
async function scan(page, url) {
  // `networkidle` is the right wait — it is what lets scroll-gated and
  // late-painted content settle before axe looks. But it never fires on a page
  // that holds a connection open, and `contact.html` does exactly that: it loads
  // the Cloudflare Turnstile widget, which this offline static server cannot
  // answer, so the request stays in flight until the navigation times out and the
  // page is recorded UNMEASURED. Falling back to `load` measures that page rather
  // than dropping it — and the fallback is reported, never silent, because a page
  // measured under a weaker wait is a weaker measurement.
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 20000 });
  } catch {
    await page.goto(url, { waitUntil: 'load', timeout: 25000 });
    await page.waitForTimeout(2000);
    process.stdout.write('    (settled on `load` — a request stayed open under networkidle)\n');
  }
  // Reveal scroll: several grids only paint once scrolled into view, and an
  // unpainted node is silently not measured.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 40));
    }
    window.scrollTo(0, 0);
  });
  // Injected via page.evaluate, never bypassCSP, so the measured DOM is the real one.
  await page.evaluate(axeSource);

  const run = () => page.evaluate((tags) => window.axe.run(document, {
    runOnly: { type: 'tag', values: tags },
    resultTypes: ['violations'],
  }).then((r) => r.violations.map((v) => ({
    id: v.id, impact: v.impact,
    nodes: v.nodes.map((n) => ({ target: n.target.join(' '), summary: n.failureSummary || '' })),
  }))), AXE_TAGS);

  const first = await run();
  await page.waitForTimeout(SETTLE_MS);
  const second = await run();

  const key = (r, n) => `${r.id}::${n.target}`;
  const seen = new Set();
  for (const r of second) for (const n of r.nodes) seen.add(key(r, n));

  const stable = [];
  for (const r of first) {
    const nodes = r.nodes.filter((n) => seen.has(key(r, n)));
    if (nodes.length) stable.push({ id: r.id, impact: r.impact, nodes });
  }
  return stable;
}

async function sweep(dir, pages, label) {
  const { url, close } = await serve(dir);
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEWPORT });
  const out = {};
  for (const p of pages) {
    try {
      out[p] = await scan(page, url + p);
    } catch (e) {
      out[p] = [{ id: 'UNMEASURED', impact: 'critical', nodes: [{ target: '-', summary: String(e.message || e) }] }];
    }
    const n = out[p].reduce((a, r) => a + r.nodes.length, 0);
    process.stdout.write(`  ${label} ${p} — ${n}\n`);
  }
  await browser.close();
  close();
  return out;
}

// ── Entry point ─────────────────────────────────────────────────────────────
//
// Behind an explicit check because this module also EXPORTS `serve` and
// `indexFiles` so they can be exercised directly. A bare `import` of it must not
// launch a browser and start rewriting an output directory as a side effect of
// being read - the same mistake `rewrite-contrast.mjs` made, where importing it
// to unit-test one function rewrote 134 files.
const RUN_AS_PROGRAM = process.argv[1]
  && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href;
if (RUN_AS_PROGRAM) {
  const pages = readFileSync(PAGES_FILE, 'utf8').split('\n').map((s) => s.trim()).filter(Boolean);
  mkdirSync(OUT, { recursive: true });

  // The BEFORE tree: the base commit's `donovan-legal-site/`, materialised into a
  // temp directory with `git archive` so the working tree is never disturbed.
  const beforeDir = join(OUT, '_before');
  mkdirSync(beforeDir, { recursive: true });
  execFileSync('bash', ['-c', `git archive ${BASE} donovan-legal-site | tar -x -C "${beforeDir.replace(/\\/g, '/')}" --strip-components=1`], { cwd: ROOT });

  console.log(`\nBEFORE (${BASE}):`);
  const before = await sweep(beforeDir, pages, 'before');
  console.log('\nAFTER (working tree):');
  const after = await sweep(join(ROOT, 'donovan-legal-site'), pages, 'after ');

  writeFileSync(join(OUT, 'before.json'), JSON.stringify(before, null, 2));
  writeFileSync(join(OUT, 'after.json'), JSON.stringify(after, null, 2));

  const SEVERE = new Set(['serious', 'critical']);
  const count = (set, filter) => Object.values(set).flat()
    .filter((r) => (filter ? SEVERE.has(r.impact) : true))
    .reduce((a, r) => a + r.nodes.length, 0);

  console.log('\n──── SUMMARY ────');
  console.log(`pages measured        ${pages.length}`);
  console.log(`before  all impacts   ${count(before, false)}   serious+critical ${count(before, true)}`);
  console.log(`after   all impacts   ${count(after, false)}   serious+critical ${count(after, true)}`);
}
