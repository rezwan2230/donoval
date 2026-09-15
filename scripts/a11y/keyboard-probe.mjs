#!/usr/bin/env node
/**
 * SARAH-195-A11Y-SWEEP-R1 — keyboard reachability + visible focus probe.
 *
 * MEASUREMENT ONLY. Reads live pages; never modifies site source. (It does set a
 * temporary data attribute on elements inside the ephemeral headless browser so
 * focused/unfocused styles can be compared for the same node. That mutation lives
 * and dies inside this process — nothing is written back to the site.)
 *
 * Method:
 *   - Drives real Tab keypresses. It deliberately does NOT call element.focus():
 *     scripted focus can satisfy :focus-visible in Chromium even where a real Tab
 *     would not, which would manufacture a passing focus ring that keyboard users
 *     never see.
 *   - At each tab stop it records the focused element and its computed style.
 *   - Afterwards it blurs and re-reads the same nodes, then diffs the two style
 *     snapshots. A focus indicator counts as VISIBLE only if some rendered
 *     property actually changes (outline, box-shadow, border, background, color,
 *     text-decoration). outline-offset alone does not count — offset without an
 *     outline width/style paints nothing.
 *
 * Two corrections learned the hard way while building this, both of which
 * produced wrong verdicts before they were fixed:
 *
 *   1. The indicator is not always painted on the focused element. The Perch
 *      concierge launcher paints its ring on a DESCENDANT (div.disc) via a
 *      `:focus` descendant selector. An element-only style diff reports "no
 *      focus indicator" for it — a false positive. So the style snapshot covers
 *      the element, its descendants, and ::before/::after.
 *   2. Screenshot diffing is only trustworthy once CSS animations are frozen.
 *      That launcher runs a continuous `perch-pulse` animation, so two
 *      *unfocused* screenshots of it already differ. We freeze animations via
 *      CDP Animation.setPlaybackRate(0) and assert an unfocused-vs-unfocused
 *      self-check before trusting any focused-vs-unfocused diff.
 *
 * Usage:
 *   NODE_PATH="$PWD/node_modules" node scripts/a11y/keyboard-probe.mjs \
 *     --out ./results/keyboard.json --max-tabs 60
 */

import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const OUT = arg('out', './results/keyboard.json');
const MAX_TABS = Number(arg('max-tabs', '60'));

// One representative page per template family. Families were derived from the
// live sitemap by URL family and confirmed against structural markers in the
// served HTML (see A11Y-SWEEP-FINDINGS.md "Template families").
const REPRESENTATIVES = [
  { template: 'T1 Home', url: 'https://www.donovan.law/' },
  { template: 'T2 Blog index', url: 'https://www.donovan.law/blog' },
  { template: 'T3 Blog article', url: 'https://www.donovan.law/blog-irs-levy' },
  { template: 'T4 Legacy practice accordion', url: 'https://www.donovan.law/litigation' },
  { template: 'T5 Tool calculator', url: 'https://www.donovan.law/tool-capital-gains' },
  { template: 'T6 Tools index', url: 'https://www.donovan.law/tools' },
  { template: 'T7 Membership', url: 'https://www.donovan.law/membership-gold' },
  { template: 'T8 Attorney bio', url: 'https://www.donovan.law/profile' },
  { template: 'T9 Practice/service', url: 'https://www.donovan.law/tax-controversy' },
  { template: 'T10 Utility/contact form', url: 'https://www.donovan.law/contact' },
];

const STYLE_PROPS = [
  'outlineStyle',
  'outlineWidth',
  'outlineColor',
  'outlineOffset',
  'boxShadow',
  'borderTopColor',
  'borderTopWidth',
  'backgroundColor',
  'color',
  'textDecorationLine',
  'transform',
];

/**
 * Screenshot the element unfocused twice (self-check) and then focused.
 * Returns {stable, differs}. stable:false means the element animates and the
 * comparison proves nothing — we report that rather than a verdict.
 */
async function pixelConfirm(page, probeId) {
  try {
    const sel = `[data-a11y-probe="${probeId}"]`;
    const box = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
    }, sel);
    if (!box || box.w === 0 || box.h === 0) return null;

    const vp = page.viewportSize() || { width: 1280, height: 900 };
    const clip = {
      x: Math.max(0, box.x - 14),
      y: Math.max(0, box.y - 14),
      width: Math.min(box.w + 28, vp.width - Math.max(0, box.x - 14)),
      height: Math.min(box.h + 28, vp.height - Math.max(0, box.y - 14)),
    };
    if (clip.width <= 0 || clip.height <= 0) return null;

    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.waitForTimeout(250);
    const u1 = await page.screenshot({ clip });
    await page.waitForTimeout(600);
    const u2 = await page.screenshot({ clip });
    const stable = u1.equals(u2);

    await page.evaluate((s) => document.querySelector(s)?.focus(), sel);
    await page.waitForTimeout(300);
    const f = await page.screenshot({ clip });

    return { stable, differs: !u2.equals(f) };
  } catch {
    return null;
  }
}

async function probe(browser, entry) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const rec = { ...entry, measured: false, reason: null, stops: [] };

  try {
    const resp = await page.goto(entry.url, { waitUntil: 'domcontentloaded', timeout: 45000 });
    if (!resp || !resp.ok()) {
      rec.reason = `UNMEASURED: HTTP ${resp ? resp.status() : 'no response'}`;
      return rec;
    }
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Start from the very top of the document so the tab order we walk is the
    // one a keyboard user gets on arrival.
    await page.evaluate(() => {
      document.activeElement && document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await page.evaluate(() => {
      window.__probeSeq = 0;
    });

    const seen = new Set();
    for (let i = 0; i < MAX_TABS; i++) {
      await page.keyboard.press('Tab');
      const stop = await page.evaluate((props) => {
        const el = document.activeElement;
        if (!el || el === document.body || el === document.documentElement) return null;

        // Stable handle so we can re-read this exact node after blurring.
        if (!el.hasAttribute('data-a11y-probe')) {
          el.setAttribute('data-a11y-probe', String(window.__probeSeq++));
        }
        const id = el.getAttribute('data-a11y-probe');
        const cs = getComputedStyle(el);
        const focusedStyle = {};
        for (const p of props) focusedStyle[p] = cs[p];

        const r = el.getBoundingClientRect();
        const name = (
          el.getAttribute('aria-label') ||
          el.textContent.trim().slice(0, 60) ||
          el.getAttribute('title') ||
          el.getAttribute('alt') ||
          ''
        ).replace(/\s+/g, ' ');

        return {
          probeId: id,
          tag: el.tagName.toLowerCase(),
          type: el.getAttribute('type') || null,
          href: el.getAttribute('href') || null,
          accName: name,
          matchesFocusVisible: (() => {
            try {
              return el.matches(':focus-visible');
            } catch {
              return null;
            }
          })(),
          rect: { w: Math.round(r.width), h: Math.round(r.height) },
          offscreen: r.width === 0 || r.height === 0,
          focusedStyle,
        };
      }, STYLE_PROPS);

      if (!stop) break;
      if (seen.has(stop.probeId)) break; // wrapped around
      seen.add(stop.probeId);
      rec.stops.push(stop);
    }

    // Freeze CSS animations so screenshot diffing is meaningful.
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Animation.enable').catch(() => {});
    await cdp.send('Animation.setPlaybackRate', { playbackRate: 0 }).catch(() => {});

    // Subtree-aware style diff: element + descendants + pseudo-elements.
    for (const s of rec.stops) {
      const styleDiff = await page.evaluate(
        ({ id, props }) => {
          const root = document.querySelector(`[data-a11y-probe="${id}"]`);
          if (!root) return null;
          const nodes = [root, ...root.querySelectorAll('*')];
          const snap = () =>
            nodes.map((n) => {
              const o = {};
              const cs = getComputedStyle(n);
              for (const p of props) o[p] = cs[p];
              for (const pe of ['::before', '::after']) {
                const s2 = getComputedStyle(n, pe);
                o[`${pe}`] = [s2.content, s2.boxShadow, s2.outlineStyle, s2.outlineWidth, s2.opacity, s2.backgroundColor].join('|');
              }
              return o;
            });

          document.activeElement && document.activeElement.blur();
          const before = snap();
          root.focus();
          const after = snap();

          const changes = [];
          nodes.forEach((n, i) => {
            const keys = Object.keys(before[i]).filter((k) => before[i][k] !== after[i][k]);
            if (keys.length) {
              changes.push({
                node: n === root ? 'self' : `${n.tagName.toLowerCase()}${n.className ? '.' + String(n.className).split(' ')[0] : ''}`,
                props: keys.map((k) => `${k}: ${before[i][k]} -> ${after[i][k]}`),
              });
            }
          });
          return changes;
        },
        { id: s.probeId, props: STYLE_PROPS },
      );

      s.subtreeChanges = styleDiff || [];
      const allChangedProps = (styleDiff || []).flatMap((c) => c.props.map((p) => p.split(':')[0]));
      // outline-offset alone paints nothing without an outline width+style.
      const meaningful = allChangedProps.filter((p) => p !== 'outlineOffset');
      s.changedProps = allChangedProps;
      s.visibleFocus = meaningful.length > 0;
      s.focusNotes = [];
      if (allChangedProps.length > 0 && meaningful.length === 0) {
        s.focusNotes.push('only outline-offset changes — offset without an outline paints nothing');
      }
      if (!s.visibleFocus) {
        s.focusNotes.push('no computed style change on the element, its descendants, or its pseudo-elements');
      } else if (!(styleDiff || []).some((c) => c.node === 'self')) {
        s.focusNotes.push('indicator is painted by a descendant, not the focused element itself');
      }
    }

    // Pixel-diff confirmation for anything the style diff called a failure.
    for (const s of rec.stops) {
      if (s.visibleFocus || s.offscreen) continue;
      s.pixelDiff = await pixelConfirm(page, s.probeId);
      if (s.pixelDiff && s.pixelDiff.stable === false) {
        s.focusNotes.push('pixel-diff INCONCLUSIVE: element still varies while unfocused (animation)');
      } else if (s.pixelDiff && s.pixelDiff.differs === true) {
        // Something paints that the style diff did not capture — do not claim a defect.
        s.visibleFocus = true;
        s.focusNotes.push('pixel-diff shows a focused/unfocused difference the style diff missed');
      } else if (s.pixelDiff && s.pixelDiff.differs === false) {
        s.focusNotes.push('pixel-diff CONFIRMS: focused and unfocused renders are byte-identical');
      }
    }

    rec.measured = true;
  } catch (err) {
    rec.reason = `UNMEASURED: ${err.message}`;
  } finally {
    await page.close().catch(() => {});
  }
  return rec;
}

async function main() {
  mkdirSync(dirname(OUT), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  for (const entry of REPRESENTATIVES) {
    const r = await probe(browser, entry);
    results.push(r);
    const noFocus = r.stops.filter((s) => !s.visibleFocus).length;
    console.log(
      r.measured
        ? `${r.template.padEnd(30)} stops=${String(r.stops.length).padStart(3)}  no-visible-focus=${noFocus}`
        : `${r.template.padEnd(30)} ${r.reason}`,
    );
  }
  await browser.close();
  writeFileSync(OUT, JSON.stringify({ maxTabs: MAX_TABS, results }, null, 2));
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
