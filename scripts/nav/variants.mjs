// SHELDON-PAUL-NAV (#227) — the nav census.
//
// The claim this ticket rests on is "the nav has forked into three incompatible
// menus that all pass CI". This is where that number comes from, so it is a
// measurement anyone can re-run rather than a sentence in a pull request body.
//
// Pages are grouped by their DESKTOP TOP-LEVEL ITEM LIST, not by the bytes of the
// subtree. Grouping by bytes reports eight groups and hides the point: five of
// those eight differ only in whitespace or in one staff name, while the three
// that matter differ in what a visitor can reach. The div counts are printed
// beside each group because they are what the swap container's plan is measured
// in — see scripts/nav/plan-invariance.mjs.
//
// Run: node scripts/nav/variants.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'donovan-legal-site');

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    // Only directories that can hold pages; css/js/img/webfonts hold none.
    if (e.isDirectory()) {
      if (!['node_modules', 'img', 'webfonts', 'css', 'js'].includes(e.name)) walk(p, out);
    } else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/**
 * The `nav.menubar` subtree, by depth-counting `<nav>` tags.
 *
 * The site nav CONTAINS a second `<nav class="nav-mobile-overlay">`, so taking
 * the first `</nav>` after the opening tag closes the wrong element and returns a
 * subtree missing the entire mobile menu.
 */
export function extractNav(html) {
  const open = html.match(/<nav[^>]*class="[^"]*\bmenubar\b[^"]*"[^>]*>/);
  if (!open) return null;
  const re = /<\/?nav\b[^>]*>/g;
  re.lastIndex = open.index;
  let depth = 0;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === '/') {
      depth--;
      if (depth === 0) return html.slice(open.index, m.index + m[0].length);
    } else depth++;
  }
  return html.slice(open.index);
}

export function census() {
  const groups = new Map();
  const noNav = [];
  for (const file of walk(SITE)) {
    const rel = path.relative(SITE, file).replace(/\\/g, '/');
    const nav = extractNav(fs.readFileSync(file, 'utf8'));
    if (!nav) { noNav.push(rel); continue; }
    const ul = nav.match(/<ul[^>]*id="menu-desktop"[\s\S]*?<\/ul>/);
    const items = ul
      ? [...ul[0].matchAll(/<a class="nav-link"[^>]*>([^<]*)<\/a>/g)].map((x) => x[1].trim())
      : ['(no #menu-desktop)'];
    const key = items.join(' | ');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ rel, divs: (nav.match(/<div\b/g) || []).length });
  }
  return { groups, noNav };
}

const { groups, noNav } = census();
const sorted = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
console.log(`nav-bearing pages: ${[...groups.values()].reduce((n, g) => n + g.length, 0)}   fragments with no nav: ${noNav.length}`);
console.log(`distinct top-level menus: ${sorted.length}\n`);
for (const [items, list] of sorted) {
  const divs = [...new Set(list.map((x) => x.divs))].sort((a, b) => a - b).join(',');
  console.log(`n=${String(list.length).padStart(3)}  nav divs=${divs}`);
  console.log(`     ${items}`);
  console.log(`     e.g. ${list.slice(0, 3).map((x) => x.rel).join(', ')}${list.length > 3 ? ', …' : ''}\n`);
}
