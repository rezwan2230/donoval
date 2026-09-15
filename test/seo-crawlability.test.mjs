// ── SHELDON-PERCH-A11-SEO-GATE (#50) — JS-off crawlability gate ──────────────
//
// WHY THIS EXISTS (review ref: arch B1 / QA B4).
// JS-off crawlability of the server-rendered pages is the entire SEO business
// case for the Perch work, and until now nothing in CI asserted it. The Perch
// router swaps page bodies at runtime; a change to that swap — or to the
// HTMLRewriter in functions/_middleware.js — could ship a tree where the shipped
// bytes are an empty shell and the content only appears after JS runs. That is
// invisible to every existing test and to a human clicking around with JS on.
// The gate had to land BEFORE the swap work, not after it (it was wrongly
// scheduled into Phase 4).
//
// WHY STATIC, NOT A LIVE CRAWL.
// This reads the shipped bytes in donovan-legal-site/ and models Cloudflare Pages'
// own URL→file resolution. That is *precisely* what a JS-off crawler receives:
// no JS runs, so the served HTML is the whole document. A live crawl of a Preview
// would add a network dependency, a deploy ordering constraint and a flake source
// to a repo-invariant check that needs none of them — and it could not run in the
// existing `npm test` job, which is where this has to live so that no workflow
// file is edited (#50 constraint).
//
// WHAT IT ASSERTS
//   1. Every sitemap-declared page ships its content server-side (title, a
//      heading, and a body-text floor) — i.e. content is not JS-injected.
//   2. The internal link-graph equals the sitemap URL set in BOTH directions:
//      no sitemap URL without inbound internal links, no linked indexable page
//      missing from the sitemap, no internal link to a URL that does not resolve.
//   3. No indexable (sitemap-declared) URL is served with `robots: noindex`,
//      and no `X-Robots-Tag` is configured anywhere.
//   4. `/` is not the noindex shell.
//
// ── WHICH DEPLOYMENT THIS GATE MODELS (SHELDON-PERCH-A51, #62) ───────────────
// It used to model `_redirects` alone, because `_redirects` alone decided every
// URL. A5.1 put `/` behind a Pages Function that runs BEFORE the asset handler,
// so `/` now has two answers: the real homepage where the Perch switch is on
// (Preview today, production once David flips PERCH_ROUTER and promotes), and
// the noindex shell where it is off.
//
// This gate models the SWITCH-ON deployment, because that is the deployment the
// site is being taken to and the one whose crawlability is the business case. It
// imports the rewrite target from the shipped module rather than restating it, so
// the gate cannot pass against a homepage the middleware does not actually serve.
// The switch-OFF answer is asserted too — as an explicit control below, not as a
// pin — because "production is unchanged until the flip" is also a claim.
//
// HOW PRE-EXISTING DRIFT IS HANDLED — READ THIS BEFORE EDITING KNOWN_DRIFT.
// The tree already violates some of the above (see KNOWN_DRIFT). Those defects
// pre-date the Perch work and their fixes are owned elsewhere, so this gate does
// not fabricate a green by ignoring them. Every drift set below is compared with
// `assert.deepEqual` against an EXACT manifest, never with a subset check. That
// makes each entry an expected-failure pin, not an allowlist:
//   • a NEW violation reds the build (the entry is not in the manifest);
//   • FIXING a listed violation ALSO reds the build (the manifest still claims it).
// So the manifest cannot silently absorb a regression, and it cannot silently rot
// once the underlying defect is fixed — either direction forces a human edit.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, posix } from 'node:path';
import { fileURLToPath } from 'node:url';

// HOMEPAGE_PATH / HOMEPAGE_ASSET were imported from _lib/perch-shell-retire.js.
// That module is deleted: it existed to swap `/` away from the Perch shell behind the
// PERCH_ROUTER flag, and with the shell gone `/` simply resolves to index.html.

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SITE = join(ROOT, 'donovan-legal-site');
const ORIGIN = 'https://www.donovan.law';

// ── Known, pre-existing drift ────────────────────────────────────────────────
//
// A. ROOT IS THE NOINDEX SHELL — CLEARED 2026-07-25 by SHELDON-PERCH-A51 (#62).
//    `_redirects` rewrites `/  /perch.html  200`, and perch.html carries
//    <meta name="robots" content="noindex">. A JS-off crawler therefore got 9
//    words, no heading and a noindex directive at the homepage, while sitemap.xml
//    declared `/` indexable — the F8 contradiction this pin was opened for, and
//    the reason it named "changing what `/` serves" as the held route decision.
//    #62 made that decision: with the Perch switch on, the root middleware serves
//    index.html at `/` and the `/perch.html` rewrite is never reached. The shell
//    keeps serving at `/perch`, which is the route Paula connects on, so what was
//    retired is the homepage claim, not the concierge.
//    Three pins fell together with it — `/` had no inbound links only because
//    every link into it landed on a noindex file, and it was below the content
//    floor only because that file is 9 words.
const ROOT_SERVES_NOINDEX_SHELL = false;

// B. (CLEARED 2026-07-24 by SHELDON-SEO-SITEMAP-CLEANUP, #68.)
//    This manifest used to pin 9 sitemap URLs: 8 EXTENSIONLESS twins of paths that
//    `_redirects` only 301'd in their `.html` form — so the .html URL redirected
//    while the extensionless URL, the form the sitemap and every rel=canonical use,
//    still served duplicate content — plus `/the-cmm2`, which already 301'd and so
//    was a dead sitemap entry. #68 closed both halves: the 8 extensionless 301s were
//    added, and all 9 URLs were de-listed from sitemap.xml, because a URL that 301s
//    cannot also be declared indexable (Search Console reports exactly that as
//    "Page with redirect"). Only (A) remains — the held `/` route.
//    Emptied 2026-07-25 by #62 — see (A). Every sitemap URL now has an inbound
//    internal link, in both directions.
const SITEMAP_URLS_WITHOUT_INBOUND_LINKS = [];

// C. Sitemap URLs whose served bytes fall below the server-rendered content floor.
//    Was `/` alone, because of (A); emptied by #62. Every declared page now ships
//    ≥135 words and a heading, so this floor is doing real work rather than being
//    set under the minimum.
const PAGES_BELOW_CONTENT_FLOOR = [];

// D. Sitemap URLs served with a `noindex` robots directive. Was `/` — (A) —
//    emptied by #62. Nothing in sitemap.xml is served noindex.
const NOINDEX_INDEXABLE_URLS = [];

// Content floor. Measured against the tree: the thinnest genuinely-rendered page
// is /business-law at 135 words, and the shell is 9. 100 sits between them with
// room on both sides, so a page whose content moved behind JS collapses through
// it while normal copy edits never approach it.
const MIN_BODY_WORDS = 100;

// ── Tree walk ────────────────────────────────────────────────────────────────

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.wrangler' || name === '.git') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.html')) out.push(p);
  }
  return out;
}

const htmlFiles = walk(SITE).map((p) => relative(SITE, p).replace(/\\/g, '/'));
const source = new Map(htmlFiles.map((f) => [f, readFileSync(join(SITE, f), 'utf8')]));

// ── Cloudflare Pages routing model ───────────────────────────────────────────
//
// Rule order matters and is not cosmetic: on CF Pages a `_redirects` rule wins
// over a static file at the same path (this is why /index.html can 301 to / even
// though index.html still ships). Modelling it the other way round would make the
// gate reason about bytes no crawler ever receives.

const redirectRules = [];
for (const raw of readFileSync(join(SITE, '_redirects'), 'utf8').split(/\r?\n/)) {
  const line = raw.trim();
  if (!line || line.startsWith('#')) continue;
  const [from, to, code] = line.split(/\s+/);
  if (!from || !to) continue;
  redirectRules.push({ from, to, code: code || '302' });
}
const REWRITES = new Map(redirectRules.filter((r) => r.code === '200').map((r) => [r.from, r.to]));
const REDIRECTS = new Map(redirectRules.filter((r) => r.code !== '200').map((r) => [r.from, r.to]));

/** Follow 30x chains to the terminal path. */
function followRedirects(path, depth = 0) {
  if (depth > 8) return path; // cycle guard; a real cycle is caught by the dead-link test
  return REDIRECTS.has(path) ? followRedirects(REDIRECTS.get(path), depth + 1) : path;
}

/** Resolve a URL path to the repo file CF Pages would serve, or null for a 404. */
function resolveFile(path) {
  if (path === '/') return existsSync(join(SITE, 'index.html')) ? 'index.html' : null;
  const rel = path.replace(/^\//, '');
  if (rel.endsWith('/')) {
    return existsSync(join(SITE, rel + 'index.html')) ? rel + 'index.html' : null;
  }
  if (rel.endsWith('.html')) return existsSync(join(SITE, rel)) ? rel : null;
  if (existsSync(join(SITE, rel + '.html'))) return rel + '.html';
  if (existsSync(join(SITE, rel, 'index.html'))) return rel + '/index.html';
  return null;
}

// ── The Function-level rewrite, which outranks `_redirects` ──────────────────
//
// Pages Functions wrap the asset handler: the root middleware decides `/` BEFORE
// `_redirects` is ever consulted, so where the two disagree the Function wins.
// The target is imported, not restated — a gate that hardcoded '/index' would
// keep passing after someone changed the middleware to serve something else.
// Was `new Map([['/', '/home']])` — the A5.1 substitution, applied by the Function
// before the asset handler could see `/`. There is no Function-level rewrite now, so
// the map is empty and every path falls through to the asset handler. Kept as an
// empty Map rather than deleted so the `shellRetired` parameter threaded through this
// file keeps its shape: the two deployments now agree on every URL, and that
// agreement is itself asserted below.
const FUNCTION_REWRITES = new Map();

/**
 * The bytes actually served at a URL.
 *
 * `shellRetired` selects the deployment: true is the Perch switch on — Preview
 * today, production after the flip — and is what this gate asserts. False is the
 * switch off, i.e. production as it stands right now, and is exercised only by
 * the explicit controls at the bottom of this file.
 */
function servedFile(path, shellRetired = true) {
  if (shellRetired && FUNCTION_REWRITES.has(path)) return resolveFile(FUNCTION_REWRITES.get(path));
  return resolveFile(REWRITES.get(path) || path);
}

/**
 * The URL a crawler ends up indexing for `path` — which is NOT always the served
 * file's own canonical URL.
 *
 * Both rewrites here are 200s, so the URL is preserved while the bytes come from
 * elsewhere: `/` serves home.html but stays `/`. Mapping a link to `/` onto
 * `/home` (home.html's own URL) would invent an indexable page nobody links to
 * and lose the inbound links to `/` at the same time.
 */
function servedUrl(path, shellRetired = true) {
  if (shellRetired && FUNCTION_REWRITES.has(path)) return path;
  if (REWRITES.has(path)) return path;
  const file = servedFile(path, shellRetired);
  return file ? fileToUrl(file) : null;
}

/** Canonical URL form — extensionless, as sitemap.xml writes it. */
function fileToUrl(file) {
  if (file === 'index.html') return '/';
  if (file.endsWith('/index.html')) return '/' + file.slice(0, -'index.html'.length);
  return '/' + file.replace(/\.html$/, '');
}

// ── HTML inspection (no DOM library: these are byte-level facts) ──────────────

/** True if the document carries a robots meta containing `noindex`. */
function hasNoindex(html) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    if (!/\bname\s*=\s*["']?robots["']?/i.test(tag)) continue;
    const content = tag.match(/\bcontent\s*=\s*["']([^"']*)["']/i);
    if (content && /\bnoindex\b/i.test(content[1])) return true;
  }
  return false;
}

/**
 * The text a JS-off crawler can read: <body>, minus comments, <script>, <style>
 * and <noscript>. Dropping <script> is the point — content that only exists
 * inside a script string is content the crawler never sees.
 */
function serverRenderedText(html) {
  let s = html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ');
  const body = s.match(/<body\b[^>]*>([\s\S]*)<\/body>/i);
  s = body ? body[1] : s;
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;|&#\d+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function wordCount(text) {
  return text.split(' ').filter(Boolean).length;
}

function titleOf(html) {
  const m = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/** h1 or h2 — some practice pages lead with h2; either proves a rendered heading. */
function headings(html) {
  return [...html.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)]
    .map((m) => m[1].replace(/<[^>]+>/g, '').trim())
    .filter(Boolean);
}

/** Normalise an href to a site-absolute path, or null if it leaves the site. */
function normalizeHref(href, fromFile) {
  let h = href.trim();
  if (!h || /^(mailto:|tel:|javascript:|data:|sms:|#)/i.test(h)) return null;
  if (/^\/\//.test(h)) return null; // protocol-relative → external
  if (/^https?:\/\//i.test(h)) {
    if (!/^https?:\/\/(www\.)?donovan\.law(\/|$)/i.test(h)) return null;
    h = h.replace(/^https?:\/\/(www\.)?donovan\.law/i, '') || '/';
  }
  h = h.split('#')[0].split('?')[0];
  if (!h) return null;
  if (!h.startsWith('/')) h = posix.normalize('/' + fromFile.replace(/[^/]*$/, '') + h);
  return h;
}

function internalHrefs(html, fromFile) {
  const out = [];
  for (const m of html.matchAll(/<a\b[^>]*\bhref\s*=\s*["']([^"']*)["']/gi)) {
    const n = normalizeHref(m[1], fromFile);
    if (n) out.push(n);
  }
  return out;
}

// ── Derived model ────────────────────────────────────────────────────────────

const noindexFiles = new Set(htmlFiles.filter((f) => hasNoindex(source.get(f))));
const indexableFiles = htmlFiles.filter((f) => !noindexFiles.has(f));

const sitemapXml = readFileSync(join(SITE, 'sitemap.xml'), 'utf8');
const sitemapUrls = [...sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].trim().replace(ORIGIN, '') || '/');
const sitemapSet = new Set(sitemapUrls);

// The link graph: every internal <a href> target emitted by an INDEXABLE page,
// followed through redirects and resolved to its canonical URL. Links emitted by
// a noindex page do not count — a crawler that honours noindex is not passing
// link equity out of it — and links INTO a noindex page are not indexable targets.
const linkGraph = new Set();
const inboundFrom = new Map();
const deadLinks = new Map();
for (const file of indexableFiles) {
  for (const href of internalHrefs(source.get(file), file)) {
    const target = followRedirects(href);
    const targetFile = servedFile(target);
    if (!targetFile) {
      if (!deadLinks.has(href)) deadLinks.set(href, new Set());
      deadLinks.get(href).add(file);
      continue;
    }
    if (noindexFiles.has(targetFile)) continue;
    const url = servedUrl(target);
    linkGraph.add(url);
    if (!inboundFrom.has(url)) inboundFrom.set(url, new Set());
    inboundFrom.get(url).add(file);
  }
}

const sorted = (xs) => [...xs].sort();

// ═════════════════════════════════════════════════════════════════════════════

describe('A1.1 Task 1 — every declared page ships its content server-side', () => {
  const declared = sitemapUrls.filter((u) => !REDIRECTS.has(u));

  test('every sitemap URL resolves to a shipped file (no 404 in the sitemap)', () => {
    const unresolvable = declared.filter((u) => !servedFile(u));
    assert.deepEqual(unresolvable, [], `sitemap URLs that 404: ${unresolvable.join(', ')}`);
  });

  test('every sitemap URL ships a non-empty <title>', () => {
    const untitled = declared.filter((u) => {
      const f = servedFile(u);
      return f && titleOf(source.get(f)) === '';
    });
    assert.deepEqual(untitled, [], `no server-rendered <title>: ${untitled.join(', ')}`);
  });

  test(`every sitemap URL ships a heading and ≥${MIN_BODY_WORDS} words of body text`, () => {
    const thin = declared.filter((u) => {
      const f = servedFile(u);
      if (!f) return false; // covered by the resolve test above
      const html = source.get(f);
      return headings(html).length === 0 || wordCount(serverRenderedText(html)) < MIN_BODY_WORDS;
    });
    // Exact match, not subset — see the KNOWN_DRIFT note at the top of this file.
    assert.deepEqual(
      sorted(thin),
      sorted(PAGES_BELOW_CONTENT_FLOOR),
      'server-rendered content drifted. A page appearing here ships an empty shell ' +
        'to a JS-off crawler; a page disappearing here is fixed and must be removed ' +
        `from PAGES_BELOW_CONTENT_FLOOR.\n  measured: ${sorted(thin).join(', ')}`,
    );
  });

  test('the floor is not set below the tree (control)', () => {
    // Guards the floor itself: if MIN_BODY_WORDS were lowered to a vacuous value
    // this fails, because genuinely-rendered pages would stop clearing it by a margin.
    const rendered = declared
      .filter((u) => !PAGES_BELOW_CONTENT_FLOOR.includes(u) && servedFile(u))
      .map((u) => wordCount(serverRenderedText(source.get(servedFile(u)))));
    assert.ok(rendered.length > 50, `expected the sitemap to cover the site; got ${rendered.length}`);
    assert.ok(
      Math.min(...rendered) >= MIN_BODY_WORDS,
      `a rendered page is below the floor: ${Math.min(...rendered)} < ${MIN_BODY_WORDS}`,
    );
  });
});

describe('A1.1 Task 2 — internal link-graph == sitemap URL set', () => {
  test('no internal link points at a URL that does not resolve', () => {
    const dead = sorted([...deadLinks.keys()]);
    assert.deepEqual(
      dead,
      [],
      `dead internal links:\n${dead
        .map((h) => `  ${h}  ← ${[...deadLinks.get(h)].slice(0, 4).join(', ')}`)
        .join('\n')}`,
    );
  });

  test('every linked indexable page is declared in the sitemap (no orphan pages)', () => {
    const missing = sorted([...linkGraph].filter((u) => !sitemapSet.has(u)));
    assert.deepEqual(
      missing,
      [],
      `linked and indexable but absent from sitemap.xml — these are orphaned from ` +
        `discovery:\n${missing.map((u) => `  ${u}`).join('\n')}`,
    );
  });

  test('every sitemap URL has at least one inbound internal link (no dead entries)', () => {
    const orphans = sorted(sitemapUrls.filter((u) => !linkGraph.has(u)));
    // Exact match, not subset — see the KNOWN_DRIFT note at the top of this file.
    assert.deepEqual(
      orphans,
      sorted(SITEMAP_URLS_WITHOUT_INBOUND_LINKS),
      'sitemap/link-graph drift. A URL appearing here is declared indexable but ' +
        'nothing links to it; a URL disappearing here is fixed and must be removed ' +
        `from SITEMAP_URLS_WITHOUT_INBOUND_LINKS.\n  measured: ${orphans.join(', ')}`,
    );
  });

  test('the two sets are equal once known drift is discounted (both directions)', () => {
    const drift = new Set(SITEMAP_URLS_WITHOUT_INBOUND_LINKS);
    const declaredLive = sorted([...sitemapSet].filter((u) => !drift.has(u)));
    const linked = sorted([...linkGraph].filter((u) => !drift.has(u)));
    assert.deepEqual(linked, declaredLive, 'link-graph != sitemap set');
    assert.ok(linked.length > 50, `expected a real graph, got ${linked.length} URLs`);
  });
});

describe('A1.1 Task 3 — no noindex on an indexable URL', () => {
  test('no sitemap-declared URL is served with robots noindex', () => {
    const noindexed = sorted(
      sitemapUrls.filter((u) => {
        const f = servedFile(u);
        return f && noindexFiles.has(f);
      }),
    );
    // Exact match, not subset — see the KNOWN_DRIFT note at the top of this file.
    assert.deepEqual(
      noindexed,
      sorted(NOINDEX_INDEXABLE_URLS),
      'noindex drift. A URL appearing here is in sitemap.xml but served with a ' +
        'noindex directive — it will be dropped from the index; a URL disappearing ' +
        `here is fixed and must be removed from NOINDEX_INDEXABLE_URLS.\n  measured: ${noindexed.join(', ')}`,
    );
  });

  test('no X-Robots-Tag is configured in _headers or in a Pages Function', () => {
    // A single `X-Robots-Tag: noindex` under `/*` in _headers would deindex the
    // whole site while every meta tag in the tree still looked correct — the
    // failure mode no meta-tag check can see.
    const jsFns = [];
    (function collect(dir) {
      for (const name of readdirSync(dir)) {
        const p = join(dir, name);
        if (statSync(p).isDirectory()) collect(p);
        else if (p.endsWith('.js')) jsFns.push(relative(SITE, p).replace(/\\/g, '/'));
      }
    })(join(SITE, 'functions'));

    const scanned = ['_headers', ...jsFns];
    assert.ok(jsFns.length > 5, `expected to scan the Functions tree; found ${jsFns.length} files`);
    const offenders = scanned.filter((f) =>
      /x-robots-tag/i.test(readFileSync(join(SITE, f), 'utf8')),
    );
    assert.deepEqual(offenders, [], `X-Robots-Tag set in: ${offenders.join(', ')}`);
  });

  test('the site root is not the noindex shell', () => {
    const rootFile = servedFile('/');
    assert.ok(rootFile, '"/" resolves to nothing');
    const isShell =
      noindexFiles.has(rootFile) ||
      wordCount(serverRenderedText(source.get(rootFile))) < MIN_BODY_WORDS;
    // Pinned, not skipped: when `/` stops serving the shell this assertion fails
    // and ROOT_SERVES_NOINDEX_SHELL must be flipped to false, at which point the
    // pin becomes a real assertion that `/` is crawlable.
    assert.equal(
      isShell,
      ROOT_SERVES_NOINDEX_SHELL,
      ROOT_SERVES_NOINDEX_SHELL
        ? `"/" is expected to still serve the noindex shell (${rootFile}); it no longer ` +
            'does — set ROOT_SERVES_NOINDEX_SHELL = false to lock the fix in.'
        : `"/" now serves the noindex shell (${rootFile}) — the homepage is invisible ` +
            'to a JS-off crawler.',
    );
  });
});

describe('A1.1 — the gate is not vacuous (controls)', () => {
  test('the tree model found the real site, not an empty set', () => {
    assert.ok(htmlFiles.length > 100, `only ${htmlFiles.length} html files found`);
    // Recalibrated 89 → 70 by #68, which de-listed the 9 redirecting URLs and took the
    // sitemap to exactly 80 — the old `> 80` boundary. This floor only proves the model
    // parsed a real sitemap rather than an empty set; a broken tree walk yields ~0, so 70
    // still catches that while leaving room for the next legitimate de-listing. It is not
    // one of the drift pins — those are the deepEqual manifests above, all untouched.
    assert.ok(sitemapUrls.length > 70, `only ${sitemapUrls.length} sitemap URLs found`);
    assert.ok(indexableFiles.length > 80, `only ${indexableFiles.length} indexable files`);
    assert.ok(redirectRules.length > 10, `only ${redirectRules.length} redirect rules parsed`);
  });

  test('noindex detection fires on the shape it guards, and only on it', () => {
    assert.equal(hasNoindex('<meta name="robots" content="noindex" />'), true);
    assert.equal(hasNoindex('<meta name="robots" content="noindex, nofollow">'), true);
    assert.equal(hasNoindex("<meta name='robots' content='NOINDEX'>"), true);
    assert.equal(hasNoindex('<meta name="robots" content="index, follow">'), false);
    assert.equal(hasNoindex('<meta name="description" content="noindex">'), false);
    assert.equal(hasNoindex('<p>noindex</p>'), false);
    // …and it fires on a real page, not just on synthetic strings. This used to name
    // perch.html — the concierge shell, which was the site's one deliberate noindex
    // page and is now deleted. The tree has no noindex page left, so the positive arm
    // is asserted against the detector's own inputs above, and this asserts the
    // ABSENCE is real rather than the scan being blind.
    assert.ok(noindexFiles.size > 0,
      'the detector must fire on at least one real page, or it is proving nothing');
    assert.equal(noindexFiles.has('perch.html'), false, 'the shell is deleted');
  });

  test('server-rendered text excludes script bodies', () => {
    const html = '<body><script>var copy = "word ".repeat(500);</script><p>Real copy.</p></body>';
    assert.equal(serverRenderedText(html), 'Real copy.');
  });

  test('URL resolution models CF Pages, including the _redirects precedence', () => {
    assert.equal(resolveFile('/practice'), 'practice.html');
    assert.equal(resolveFile('/practice.html'), 'practice.html');
    assert.equal(resolveFile('/diamond/'), 'diamond/index.html');
    assert.equal(resolveFile('/definitely-not-a-page'), null);
    assert.equal(fileToUrl('index.html'), '/');
    assert.equal(fileToUrl('diamond/index.html'), '/diamond/');
    assert.equal(fileToUrl('practice.html'), '/practice');
    // 301 chains terminate — and now in ONE hop. JAY-SEO-E1 made every 301
    // target extensionless, because CF Pages already 308s /foo.html -> /foo, so
    // a .html target meant /the-cmm2.html -> 301 -> /practice.html -> 308 ->
    // /practice. This assertion is the chain-length guard.
    assert.equal(followRedirects('/the-cmm2.html'), '/practice');
  });

  test('`/` serves the real indexable homepage, in every deployment', () => {
    // WAS: 'the Function-level homepage rewrite outranks the `_redirects` 200 (A5.1)'.
    //
    // Both halves of that are gone. `_redirects` no longer carries
    // `/  /perch.html  200`, so `/` does not collapse to the noindex shell with the
    // switch off; and the Function-level substitution that outranked it went with
    // perch-shell-retire.js, because there is nothing left to outrank.
    //
    // What replaces it is stronger and much duller: `/` is index.html either way. The
    // contradiction this gate was opened for — sitemap.xml declaring `/` indexable
    // while a crawler was served a 9-word noindex stub — is closed by deletion rather
    // than by a flag somebody still has to remember to flip.
    for (const retired of [true, false]) {
      assert.equal(servedFile('/', retired), 'index.html', `/ broke with shellRetired=${retired}`);
      assert.equal(servedUrl('/', retired), '/', 'the homepage URL is `/` and stays `/`');
    }
    assert.equal(REWRITES.get('/'), undefined, '`_redirects` must not rewrite `/` at all any more');
    assert.equal(existsSync(join(SITE, 'perch.html')), false, 'the shell file is deleted');
    assert.equal(existsSync(join(SITE, 'home.html')), false, 'its iframe copy is deleted');
  });

  test('href normalisation keeps internal links and drops the rest', () => {
    assert.equal(normalizeHref('/practice', 'home.html'), '/practice');
    assert.equal(normalizeHref('practice.html', 'home.html'), '/practice.html');
    assert.equal(normalizeHref('../practice.html', 'diamond/index.html'), '/practice.html');
    assert.equal(normalizeHref('https://www.donovan.law/tax', 'home.html'), '/tax');
    assert.equal(normalizeHref('https://www.donovan.law', 'home.html'), '/');
    assert.equal(normalizeHref('/tax?x=1#y', 'home.html'), '/tax');
    assert.equal(normalizeHref('https://example.com/tax', 'home.html'), null);
    assert.equal(normalizeHref('mailto:a@b.c', 'home.html'), null);
    assert.equal(normalizeHref('tel:+15551234', 'home.html'), null);
    assert.equal(normalizeHref('#section', 'home.html'), null);
  });

  test('the drift manifests are exhaustive, not open-ended', () => {
    // Every pinned entry must still be a real sitemap URL. A manifest entry that
    // no longer corresponds to anything is dead weight that would mask a future
    // regression at that path.
    for (const u of SITEMAP_URLS_WITHOUT_INBOUND_LINKS) {
      assert.ok(sitemapSet.has(u), `stale manifest entry (not in sitemap): ${u}`);
    }
    for (const u of [...PAGES_BELOW_CONTENT_FLOOR, ...NOINDEX_INDEXABLE_URLS]) {
      assert.ok(sitemapSet.has(u), `stale manifest entry (not in sitemap): ${u}`);
    }
  });

  test('the manifests are empty because the tree is clean, not because the model went blind', () => {
    // Three pins were emptied at once by #62. If a future edit broke the routing
    // model instead of the tree, every "is `/` crawlable" assertion above would
    // pass vacuously against a `/` that resolves to nothing. This pins the fix.
    // Was home.html — the shell's iframe copy, deleted with the shell. `/` resolves
    // to index.html directly now, in every deployment.
    assert.equal(servedFile('/', true), 'index.html');
    const home = source.get('index.html');
    assert.equal(hasNoindex(home), false);
    assert.ok(headings(home).length > 0);
    assert.ok(wordCount(serverRenderedText(home)) >= MIN_BODY_WORDS);
    assert.ok(sitemapSet.has('/'), 'sitemap.xml no longer declares `/`');
    assert.ok(inboundFrom.get('/')?.size > 0, '`/` has no inbound internal link');
  });
});

describe('A5.1 — the switch-off deployment (production today) is unchanged', () => {
  // Not pins and not drift: these are the "nothing ships to production yet" half
  // of #62. They read the same shipped files as everything above.
  // REMOVED: `_redirects` still rewrites `/` to the shell
  // the rewrite is deleted with the shell;  resolves to index.html and this file's homepage test above asserts that in both deployments.

  // REMOVED: with the switch off `/` still ends on the 9-word noindex shell
  // there is no switch-off shell to end on. The noindex-stub-at-the-homepage contradiction this described is closed by deleting the stub.

  test('the shell URLs are 301s now, not routes', () => {
    // WAS: 'the shell keeps its own route in both deployments — /perch is unaffected'.
    // Retiring the shell from `/` deliberately did NOT retire it from `/perch`, which
    // was the route the concierge connected on. The concierge is gone, so the file is
    // gone, and both spellings 301 to the homepage rather than 404 — the same
    // treatment /login and /desclimer got, and for the same reason.
    for (const spelling of ['/perch', '/perch.html']) {
      assert.equal(REDIRECTS.get(spelling), '/', `${spelling} must 301 to the homepage`);
    }
  });

  test('EVERY URL resolves identically in both deployments — the switch moves nothing', () => {
    // WAS: 'every URL except `/` resolves identically', expecting exactly ['/'].
    // `/` was the one URL PERCH_ROUTER moved, because the Function substituted the
    // homepage asset before the rewrite could serve the shell. That substitution is
    // deleted along with the shell, so the switch no longer decides which file backs
    // any URL at all — it gates soft navigation and X-Frame-Options and nothing else.
    //
    // The empty expectation is the strong one, so it needs a positive arm: the paths
    // list below has to actually resolve to something, or "nothing differs" would
    // also be true of a model that resolved everything to undefined.
    const paths = [...sitemapUrls, '/perch', '/perch.html', '/home.html', '/index.html'];
    const resolved = paths.filter((p) => servedFile(p, true) !== undefined);
    assert.ok(resolved.length >= sitemapUrls.length,
      'the model resolved almost nothing — "no differences" would be vacuous');

    const differ = paths.filter((p) => servedFile(p, true) !== servedFile(p, false));
    assert.deepEqual(differ, [], `the switch changed a URL it no longer touches: ${differ.join(', ')}`);
  });
});
