#!/usr/bin/env node
// SHELDON-SEO-SITEMAP — deterministic sitemap generator.
//
// Emits sitemap.xml covering every INDEXABLE page in the site root. A page is
// indexable iff it is self-canonical (its <link rel="canonical"> resolves to
// its own URL) AND is not marked robots noindex. This rule is authoritative and
// self-documenting: it automatically excludes
//   - fragments/shells with no canonical    (nav-block.html, 404.html, perch.html)
//   - duplicate URLs                          (home.html -> canonical "/" == index.html)
//   - every noindex page                      (book, disclaimer, login, tool-economics,
//                                              tool-entity-formation[-multi], tool-structuring)
// Enumerating the site ROOT only (no recursion) also excludes the member-gated
// tier directories (gold/ platinum/ diamond/ reserve/), members/, and
// engagement-scoping/, none of which are public indexable pages.
//
// lastmod is derived from each file's last git commit date (committer date, YYYY-MM-DD).
// Output is stable-sorted so re-runs produce byte-identical diffs.

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ORIGIN = 'https://www.donovan.law';
const SITE_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// filename -> canonical path. index.html represents the site root "/".
function canonicalUrl(file) {
  if (file === 'index.html') return `${ORIGIN}/`;
  return `${ORIGIN}/${file.replace(/\.html$/, '')}`;
}

function readCanonicalHref(html) {
  const m = html.match(/<link\b[^>]*\brel=["']canonical["'][^>]*>/i);
  if (!m) return null;
  const href = m[0].match(/\bhref=["']([^"']*)["']/i);
  return href ? href[1].trim() : null;
}

function isNoindex(html) {
  const m = html.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/i);
  return !!m && /noindex/i.test(m[0]);
}

function gitLastmod(file) {
  const out = execFileSync('git', ['log', '-1', '--format=%cs', '--', file], {
    cwd: SITE_DIR,
    encoding: 'utf8',
  }).trim();
  if (!out) throw new Error(`no git history for ${file} — cannot derive lastmod`);
  return out;
}

const rootHtml = readdirSync(SITE_DIR, { withFileTypes: true })
  .filter((d) => d.isFile() && d.name.endsWith('.html'))
  .map((d) => d.name);

const entries = [];
const excluded = [];
for (const file of rootHtml) {
  const html = readFileSync(join(SITE_DIR, file), 'utf8');
  const canonical = readCanonicalHref(html);
  const expected = canonicalUrl(file);
  const noindex = isNoindex(html);
  const selfCanonical = canonical !== null && canonical === expected;

  if (!selfCanonical || noindex) {
    const why = noindex ? 'noindex' : canonical === null ? 'no-canonical' : `canonical->${canonical}`;
    excluded.push(`${file} (${why})`);
    continue;
  }
  entries.push({ loc: expected, lastmod: gitLastmod(file) });
}

// index "/" first, then alphabetical by loc — stable, human-scannable.
entries.sort((a, b) => {
  if (a.loc === `${ORIGIN}/`) return -1;
  if (b.loc === `${ORIGIN}/`) return 1;
  return a.loc < b.loc ? -1 : a.loc > b.loc ? 1 : 0;
});

const xml =
  '<?xml version="1.0" encoding="UTF-8"?>\n' +
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
  entries
    .map((e) => `  <url><loc>${e.loc}</loc><lastmod>${e.lastmod}</lastmod></url>`)
    .join('\n') +
  '\n</urlset>\n';

writeFileSync(join(SITE_DIR, 'sitemap.xml'), xml);

console.error(`sitemap.xml: ${entries.length} indexable URLs, ${excluded.length} root pages excluded`);
console.error('excluded:\n  ' + excluded.sort().join('\n  '));
