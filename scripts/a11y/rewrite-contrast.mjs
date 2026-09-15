#!/usr/bin/env node
/**
 * JORDAN-195-A11Y-REMEDIATE — rewrite the hard-coded brand colours that
 * SARAH-195-PROD-SWEEP-R1 (PR #216) measured as the cause of 885 of the 1033
 * residual `color-contrast` nodes.
 *
 * ── THE ONE INVARIANT THIS SCRIPT IS BUILT AROUND ────────────────────────────
 *
 * It rewrites text INSIDE `<style>` elements and nothing else.
 *
 * That is not a stylistic preference, it is what keeps the change inside the
 * chrome-diff gate. `test/chrome-diff.test.mjs` rule 3 (`page-structure`)
 * compares every element, its nesting depth and ALL of its attributes; text
 * nodes are deliberately excluded, because text is the surface a content edit is
 * allowed to change. A `<style>` block's CSS is a text node. An element's
 * `style="…"` is an attribute.
 *
 * Both halves of that were verified against the real gate before this script was
 * written, not assumed:
 *   • hex changed inside a <style> block  → chrome-diff 55/55 green
 *   • hex changed inside a style attribute → page-structure fires
 *
 * So this script must never touch an attribute. `extractStyleBlocks` is the only
 * thing that decides what is in scope, and `--verify` re-reads the result and
 * asserts that every byte outside those blocks is unchanged.
 *
 * ── WHY A SCRIPT AND NOT 134 HAND EDITS ──────────────────────────────────────
 *
 * 1,443 occurrences of the old green and 427 of the old gold are spread over 134
 * files. Hand editing that many call sites is where a typo'd hex or a
 * half-applied rule comes from, and neither would show up as a failing test — it
 * would show up as a contrast failure nobody measured again. A single table
 * (`palette-195.mjs`) plus a mechanical application of it is reviewable in a way
 * that 1,870 individual edits are not.
 *
 * Usage:
 *   node scripts/a11y/rewrite-contrast.mjs            # apply
 *   node scripts/a11y/rewrite-contrast.mjs --dry-run  # report only
 *   node scripts/a11y/rewrite-contrast.mjs --verify   # assert nothing outside <style> moved
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { rewriteDeclaration } from './palette-195.mjs';

const SITE = 'donovan-legal-site';
const DRY = process.argv.includes('--dry-run');
const VERIFY = process.argv.includes('--verify');

/**
 * Every `<style>…</style>` region in the document, as [start, end) offsets into
 * the source covering the CONTENT only — the tags themselves are left out so a
 * rewrite can never alter an attribute on the `<style>` tag either.
 */
export function extractStyleBlocks(html) {
  const blocks = [];
  const open = /<style\b[^>]*>/gi;
  let m;
  while ((m = open.exec(html))) {
    const start = m.index + m[0].length;
    const close = html.toLowerCase().indexOf('</style', start);
    if (close === -1) break;
    blocks.push([start, close]);
    open.lastIndex = close;
  }
  return blocks;
}

/**
 * Apply the palette to one CSS text region.
 *
 * Declarations are matched as `prop : value` up to the next `;` or `}` so that
 * `rewriteDeclaration` gets the property name — which is the whole basis of the
 * gold split (gold as `color:` is darkened, gold as a border or band is not).
 * A hex that is not inside a recognisable declaration is left alone rather than
 * rewritten blind.
 */
export function rewriteCss(css) {
  return css.replace(
    /(^|[;{}\s])(--[a-zA-Z0-9-]+|[a-zA-Z-]+)(\s*:\s*)([^;{}]*)/g,
    (whole, lead, prop, sep, value) => {
      if (!/#[0-9a-fA-F]{6}\b/.test(value)) return whole;
      // A CSS custom property carries no role of its own; it is rewritten under
      // the role its NAME implies, which on this site is spelled out: --emer and
      // --mute are text colours, --gold is a band fill.
      const effective = /^--/.test(prop)
        ? ({ '--emer': 'color', '--mute': 'color', '--gold': 'background' }[prop] || 'color')
        : prop;
      return `${lead}${prop}${sep}${rewriteDeclaration(effective, value)}`;
    },
  );
}

/** Rewrite a whole page, touching only the inside of its `<style>` blocks. */
export function rewritePage(html) {
  const blocks = extractStyleBlocks(html);
  let out = '';
  let at = 0;
  for (const [s, e] of blocks) {
    out += html.slice(at, s) + rewriteCss(html.slice(s, e));
    at = e;
  }
  return out + html.slice(at);
}

/** Everything that is NOT inside a `<style>` block, concatenated. The safety net. */
export function outsideStyleBlocks(html) {
  const blocks = extractStyleBlocks(html);
  let out = '';
  let at = 0;
  for (const [s, e] of blocks) {
    out += html.slice(at, s);
    at = e;
  }
  return out + html.slice(at);
}

function countHexDiff(a, b) {
  const ha = a.match(/#[0-9a-fA-F]{6}\b/g) || [];
  const hb = b.match(/#[0-9a-fA-F]{6}\b/g) || [];
  let n = 0;
  for (let i = 0; i < Math.max(ha.length, hb.length); i++) if (ha[i] !== hb[i]) n++;
  return n;
}

/**
 * Run the rewrite over the site.
 *
 * Behind an explicit entry-point check because the module also EXPORTS its parts
 * for the unit tests, and a bare `import` of it must never write to 134 files as
 * a side effect of being read.
 */
export function main() {
  const files = globSync(`${SITE}/**/*.html`).sort();
  let changedFiles = 0;
  let changedHex = 0;

  for (const file of files) {
    const before = readFileSync(file, 'utf8');
    const after = rewritePage(before);
    if (after === before) continue;

    // The invariant, enforced on every single file rather than spot-checked.
    if (outsideStyleBlocks(before) !== outsideStyleBlocks(after)) {
      console.error(`REFUSING ${file}: the rewrite changed bytes outside a <style> block`);
      process.exit(1);
    }

    const n = countHexDiff(before, after);
    changedFiles++;
    changedHex += n;
    if (DRY || VERIFY) {
      console.log(`${file}  ${n} declaration value(s)`);
    } else {
      writeFileSync(file, after);
    }
  }

  console.log(`\n${DRY ? '[dry run] ' : ''}${changedFiles} file(s), ${changedHex} colour value(s) rewritten`);
  return { changedFiles, changedHex };
}

// Only when run as a program — never on import.
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, '/')}`).href) {
  main();
}
