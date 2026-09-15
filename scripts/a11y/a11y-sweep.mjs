#!/usr/bin/env node
/**
 * SARAH-195-A11Y-SWEEP-R1 — accessibility measurement harness.
 *
 * MEASUREMENT ONLY. This script reads the live site and writes JSON to an output
 * directory. It never modifies site source.
 *
 * What it does, per URL from the live sitemap:
 *   1. Loads the page headless (Chromium).
 *   2. Runs axe-core against the WCAG 2 AA tag set (pinned in AXE_TAGS below).
 *   3. Records every violation with rule id, impact, target selector, and page.
 *   4. Inventories every <img> for alt-text coverage and decorative/informative
 *      ambiguity — it FLAGS ambiguity, it does not guess intent.
 *   5. Records a page as UNMEASURED (with the reason) if it cannot be loaded or
 *      axe cannot run. It never invents a pass.
 *
 * Install (deps are intentionally NOT added to the repo package.json — this is a
 * measurement tool, not a site dependency):
 *
 *   mkdir a11y-harness && cd a11y-harness
 *   npm init -y && npm i playwright axe-core
 *   npx playwright install chromium
 *   NODE_PATH="$PWD/node_modules" node ../scripts/a11y/a11y-sweep.mjs --out ./results
 *
 * Flags:
 *   --out <dir>      output directory (default ./a11y-results)
 *   --sitemap <url>  sitemap URL (default https://www.donovan.law/sitemap.xml)
 *   --expect <n>     expected URL count; exits non-zero on mismatch (default 84)
 *   --concurrency <n> parallel pages (default 1 — SERIAL on purpose; see scanPage)
 *   --limit <n>      scan only the first n URLs (debugging)
 */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const axeSource = readFileSync(require.resolve('axe-core'), 'utf8');

// ---- pinned configuration ---------------------------------------------------

// "WCAG 2 AA" == level A + level AA success criteria, WCAG 2.0 and 2.1.
// Pinned here so the report can state exactly what was measured.
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

const DEFAULT_SITEMAP = 'https://www.donovan.law/sitemap.xml';
const NAV_TIMEOUT_MS = 45000;
const VIEWPORT = { width: 1280, height: 900 };
// Pause between the two axe passes so a transient mid-load paint has settled.
const SETTLE_MS = 1200;

// ---- args -------------------------------------------------------------------

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const OUT_DIR = arg('out', './a11y-results');
const SITEMAP_URL = arg('sitemap', DEFAULT_SITEMAP);
const EXPECT = Number(arg('expect', '84'));
// Default to SERIAL. Concurrency was proven to make colour-contrast results
// nondeterministic on this site (see the two-pass note in scanPage).
const CONCURRENCY = Number(arg('concurrency', '1'));
const LIMIT = Number(arg('limit', '0'));

// ---- sitemap ----------------------------------------------------------------

async function fetchSitemapUrls(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`sitemap fetch failed: HTTP ${res.status}`);
  const xml = await res.text();
  if (/<sitemapindex/i.test(xml)) {
    throw new Error('sitemap is an index (nested sitemaps) — harness expects a flat <urlset>');
  }
  const urls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
  return { urls, raw: xml };
}

// ---- in-page image inventory ------------------------------------------------
//
// Runs in the browser. Returns raw facts only. Intent classification (decorative
// vs informative) is deliberately NOT decided here — we emit signals and let a
// human adjudicate. Guessing intent is how alt-text audits go wrong.
function imageInventoryFn() {
  const imgs = [...document.querySelectorAll('img')];
  const items = imgs.map((img) => {
    const hasAltAttr = img.hasAttribute('alt');
    const alt = img.getAttribute('alt');
    const role = (img.getAttribute('role') || '').toLowerCase();
    const ariaHidden = img.getAttribute('aria-hidden') === 'true';
    const ariaLabel = img.getAttribute('aria-label') || '';
    const ariaLabelledBy = img.getAttribute('aria-labelledby') || '';
    const rect = img.getBoundingClientRect();

    const inLink = !!img.closest('a[href]');
    const linkEl = img.closest('a[href]');
    // Does the containing link carry any other accessible text besides this img?
    let linkHasOtherText = false;
    if (linkEl) {
      const clone = linkEl.cloneNode(true);
      clone.querySelectorAll('img').forEach((n) => n.remove());
      linkHasOtherText =
        clone.textContent.trim().length > 0 ||
        !!linkEl.getAttribute('aria-label') ||
        !!linkEl.getAttribute('title');
    }
    // Is this image the ONLY content of its immediate container? An empty-alt
    // image alone in a container has no neighbouring text to carry its meaning,
    // so "decorative" cannot be inferred from context.
    const parent = img.parentElement;
    const soleContentOfContainer =
      !!parent && parent.children.length === 1 && parent.textContent.trim() === '';

    const inFigure = !!img.closest('figure');
    const hasFigcaption = !!(img.closest('figure') && img.closest('figure').querySelector('figcaption'));

    const src = img.currentSrc || img.getAttribute('src') || '';
    const file = src.split('/').pop() || '';
    // alt that just restates the filename is a common false-positive "present" alt
    const altLooksLikeFilename =
      !!alt &&
      (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(alt.trim()) ||
        (file && alt.trim().toLowerCase() === file.toLowerCase().replace(/\.[a-z0-9]+$/i, '')));

    return {
      src,
      hasAltAttr,
      alt: alt === null ? null : alt,
      altEmpty: hasAltAttr && (alt || '').trim() === '',
      altNonEmpty: hasAltAttr && (alt || '').trim() !== '',
      role,
      ariaHidden,
      ariaLabel,
      ariaLabelledBy,
      width: Math.round(rect.width),
      height: Math.round(rect.height),
      inLink,
      linkHasOtherText,
      inFigure,
      hasFigcaption,
      altLooksLikeFilename,
      soleContentOfContainer,
      rendered: rect.width > 0 && rect.height > 0,
    };
  });

  return items;
}

// Classification happens in Node so the rules are reviewable in one place.
function classifyImages(items) {
  const total = items.length;
  let missingAlt = 0;
  let nonEmptyAlt = 0;
  let emptyAlt = 0;
  const ambiguous = [];
  const defects = [];

  for (const it of items) {
    const declaredDecorative =
      it.altEmpty || it.role === 'presentation' || it.role === 'none' || it.ariaHidden;

    if (!it.hasAltAttr) {
      missingAlt++;
      // No alt attribute at all and not otherwise labelled => a real defect.
      if (!it.ariaHidden && it.role !== 'presentation' && it.role !== 'none' && !it.ariaLabel && !it.ariaLabelledBy) {
        defects.push({ src: it.src, reason: 'no alt attribute and no alternative labelling' });
      }
    } else if (it.altNonEmpty) {
      nonEmptyAlt++;
      if (it.altLooksLikeFilename) {
        ambiguous.push({
          src: it.src,
          signal: 'alt restates the image filename — likely not a meaningful description',
          alt: it.alt,
        });
      }
    } else {
      emptyAlt++;
    }

    // Decorative-vs-informative ambiguity: declared decorative but carrying
    // signals that it may be informative. We flag; we do not decide.
    if (declaredDecorative) {
      const signals = [];
      if (it.inLink && !it.linkHasOtherText) {
        signals.push('sole content of a link — link would have no accessible name');
      }
      if (it.hasFigcaption) signals.push('inside a <figure> with a <figcaption>');
      if (it.width >= 300 && it.height >= 200) {
        signals.push(`large rendered size (${it.width}x${it.height}) — unusual for decoration`);
      }
      // A visibly-rendered image that is the only thing in its container has no
      // neighbouring text to carry its meaning. At 64px+ it is above icon/spacer
      // scale, so "decorative" is an assertion we cannot verify from markup.
      if (it.rendered && it.soleContentOfContainer && it.width >= 64 && it.height >= 64) {
        signals.push(
          `sole content of its container at ${it.width}x${it.height} with no adjacent text — ` +
            `nothing else conveys what it shows`,
        );
      }
      if (signals.length) {
        ambiguous.push({ src: it.src, signal: signals.join('; '), alt: it.alt, declaredDecorative: true });
      }
    }
  }

  return {
    total,
    // "present" = an alt attribute is present at all (empty alt is a valid,
    // intentional decorative declaration). Reported as present/total.
    present: total - missingAlt,
    nonEmptyAlt,
    emptyAlt,
    missingAlt,
    ambiguous,
    defects,
  };
}

// ---- per-page scan ----------------------------------------------------------

async function scanPage(context, url) {
  const page = await context.newPage();
  const record = { url, status: null, measured: false, violations: [], images: null, reason: null };

  try {
    const resp = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    record.status = resp ? resp.status() : null;

    if (!resp || !resp.ok()) {
      record.reason = `UNMEASURED: navigation returned HTTP ${record.status ?? 'no response'}`;
      return record;
    }

    // Let late/deferred content settle; don't hard-fail if the network never idles.
    await page.waitForLoadState('load', { timeout: 30000 }).catch(() => {});
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // CRITICAL: colour-contrast must not be measured on a partially-styled page.
    // Under concurrency the networkidle wait above can quietly time out, and axe
    // then scores an unstyled/half-styled DOM — which manufactures contrast
    // "failures" (e.g. default light nav text over a light fallback background)
    // that no real user ever sees. Gate explicitly on every stylesheet having
    // applied and webfonts having settled, and record UNMEASURED if they don't.
    const styled = await page
      .waitForFunction(
        () => {
          if (document.readyState !== 'complete') return false;
          const links = [...document.querySelectorAll('link[rel~="stylesheet"]')];
          // A stylesheet that has loaded exposes a non-null .sheet. Cross-origin
          // sheets also expose .sheet, so this does not depend on CORS.
          const allApplied = links.every((l) => l.sheet !== null || l.disabled);
          return allApplied && (!document.fonts || document.fonts.status === 'loaded');
        },
        null,
        { timeout: 20000 },
      )
      .then(() => true)
      .catch(() => false);

    if (!styled) {
      record.reason =
        'UNMEASURED: stylesheets/fonts did not finish applying within 20s — ' +
        'contrast results would reflect an unstyled render, not the live page';
      return record;
    }

    // NOTE: the live site sends a strict script-src CSP with a per-response
    // nonce, so addScriptTag() (a real inline <script>) is blocked. page.evaluate
    // goes through CDP Runtime.evaluate, which is not subject to page CSP — so we
    // get axe in WITHOUT disabling CSP. Deliberately not using bypassCSP: turning
    // CSP off would let otherwise-blocked scripts run and change the very DOM we
    // are measuring.
    await page.evaluate(axeSource);
    const axeReady = await page.evaluate(() => typeof window.axe);
    if (axeReady !== 'object') {
      record.reason = `UNMEASURED: axe-core failed to initialise (typeof window.axe === ${axeReady})`;
      return record;
    }

    // Run axe TWICE and keep only what reproduces in both passes.
    //
    // Why: an earlier revision of this sweep ran pages 4-up and produced
    // colour-contrast hits on nav links (fg #edede8 on #f5f5f0, ratio 1.07) that
    // do NOT exist in the steady state — every .nav-link computes to solid black
    // and stays black. Those nodes appeared only under concurrency and vanished
    // on a serial re-run, i.e. axe was sampling a transient mid-load paint. A
    // single pass cannot tell a real defect from a transient one, so we
    // intersect two passes: stable findings are reported, flapping findings are
    // quarantined as UNSTABLE rather than silently inflating the counts.
    // Reveal scroll-gated content before measuring. Card grids on /blog and
    // /tools only render as they enter the viewport, so measuring straight after
    // load silently skips them — an early revision under-counted one page by 172
    // nodes for exactly this reason. Walk the full page, return to the top, and
    // let it settle so axe sees what a user who scrolls the page would see.
    await page.evaluate(async () => {
      const step = Math.max(200, Math.floor(window.innerHeight * 0.8));
      const height = () => document.body.scrollHeight;
      for (let y = 0; y < height(); y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, height());
      await new Promise((r) => setTimeout(r, 400));
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 300));
    });
    await page.waitForTimeout(SETTLE_MS);

    const runAxe = () =>
      page.evaluate(
        async (tags) => await window.axe.run(document, { runOnly: { type: 'tag', values: tags } }),
        AXE_TAGS,
      );

    const passA = await runAxe();
    await page.waitForTimeout(SETTLE_MS);
    const passB = await runAxe();

    const keyOf = (ruleId, node) => `${ruleId}||${node.target.join(' ')}`;
    const bKeys = new Set();
    for (const v of passB.violations) for (const n of v.nodes) bKeys.add(keyOf(v.id, n));

    const unstable = [];
    record.violations = passA.violations
      .map((v) => {
        const stableNodes = [];
        for (const n of v.nodes) {
          const entry = {
            target: n.target.join(' '),
            failureSummary: n.failureSummary,
            html: (n.html || '').slice(0, 300),
          };
          if (bKeys.has(keyOf(v.id, n))) stableNodes.push(entry);
          else unstable.push({ id: v.id, impact: v.impact, ...entry });
        }
        return { id: v.id, impact: v.impact, help: v.help, tags: v.tags, nodes: stableNodes };
      })
      .filter((v) => v.nodes.length > 0);

    // Anything present in pass B but absent from pass A is equally unstable.
    const aKeys = new Set();
    for (const v of passA.violations) for (const n of v.nodes) aKeys.add(keyOf(v.id, n));
    for (const v of passB.violations) {
      for (const n of v.nodes) {
        if (!aKeys.has(keyOf(v.id, n))) {
          unstable.push({
            id: v.id,
            impact: v.impact,
            target: n.target.join(' '),
            failureSummary: n.failureSummary,
            html: (n.html || '').slice(0, 300),
            onlyInSecondPass: true,
          });
        }
      }
    }
    record.unstable = unstable;

    const rawImgs = await page.evaluate(imageInventoryFn);
    record.images = classifyImages(rawImgs);
    record.imagesRaw = rawImgs;
    record.measured = true;
  } catch (err) {
    record.reason = `UNMEASURED: ${err.message}`;
  } finally {
    await page.close().catch(() => {});
  }

  return record;
}

// ---- main -------------------------------------------------------------------

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const { urls, raw } = await fetchSitemapUrls(SITEMAP_URL);
  writeFileSync(join(OUT_DIR, 'sitemap.xml'), raw);
  writeFileSync(join(OUT_DIR, 'urls.txt'), urls.join('\n') + '\n');

  console.log(`sitemap: ${SITEMAP_URL}`);
  console.log(`urls: ${urls.length} (expected ${EXPECT})`);

  if (EXPECT && urls.length !== EXPECT) {
    console.error(
      `STOP: sitemap count ${urls.length} != expected ${EXPECT}. ` +
        `Delta must be reported before scanning.`,
    );
    writeFileSync(
      join(OUT_DIR, 'STOP.json'),
      JSON.stringify({ expected: EXPECT, actual: urls.length, urls }, null, 2),
    );
    process.exit(2);
  }

  const targets = LIMIT ? urls.slice(0, LIMIT) : urls;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: VIEWPORT });

  const results = new Array(targets.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (true) {
      const i = next++;
      if (i >= targets.length) return;
      results[i] = await scanPage(context, targets[i]);
      done++;
      const r = results[i];
      const tag = r.measured ? `${r.violations.length} violation-rules` : r.reason;
      console.log(`[${done}/${targets.length}] ${targets[i]} — ${tag}`);
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  await browser.close();

  const payload = {
    order: 'SARAH-195-A11Y-SWEEP-R1',
    sitemap: SITEMAP_URL,
    axeTags: AXE_TAGS,
    urlCount: urls.length,
    scanned: targets.length,
    measured: results.filter((r) => r.measured).length,
    unmeasured: results.filter((r) => !r.measured).length,
    settleMs: SETTLE_MS,
    concurrency: CONCURRENCY,
    unstableNodeCount: results.reduce((a, r) => a + (r.unstable?.length || 0), 0),
    results,
  };

  writeFileSync(join(OUT_DIR, 'results.json'), JSON.stringify(payload, null, 2));
  console.log(`\nmeasured: ${payload.measured}  unmeasured: ${payload.unmeasured}`);
  console.log(`wrote ${join(OUT_DIR, 'results.json')}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
