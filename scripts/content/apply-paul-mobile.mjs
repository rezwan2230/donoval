#!/usr/bin/env node
/**
 * JORDAN-PAUL-MOBILE — write the #226 part A `<picture>` wrappers to disk.
 *
 * Every transform lives in `paul-mobile-edits.mjs`; this file only applies them
 * and REPORTS. It fails loud in the three directions a scope list can go wrong:
 *
 *   • a file in the scope whose edits produce no change (the arc `<img>` moved
 *     under the transform and the edit silently did nothing);
 *   • a file in the scope carrying no arc `<img>` at all; and
 *   • a `srcset` that points at a file which is not on disk — the failure a
 *     `<picture>` is uniquely good at hiding, because a 404 on the `<source>`
 *     falls back to the `<img>` and looks exactly like success.
 *
 * LINE ENDINGS. These blobs are stored with LF and checked out with CRLF
 * (`core.autocrlf=true`). The transforms are written against LF, so each file is
 * normalised before and re-CRLF'd after when that is what it had — otherwise the
 * applier would leave one file mixed and the next reader would be diffing
 * carriage returns.
 *
 * Usage: node scripts/content/apply-paul-mobile.mjs [--dry]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { SCOPE, applyAll, findArcImgs, mobileSrc, eolLf, mobileVariantCensus } from './paul-mobile-edits.mjs';

const DRY = process.argv.includes('--dry');
const SITE = 'donovan-legal-site';

let changed = 0;
const inert = [];
const noArc = [];
const dangling = [];
const skippedArcs = new Map();

for (const file of SCOPE) {
  const raw = readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  const before = eolLf(raw);

  if (findArcImgs(before).length === 0) noArc.push(file);

  const { after, applied, skipped } = applyAll(file, before);
  for (const name of skipped) {
    if (!skippedArcs.has(name)) skippedArcs.set(name, []);
    skippedArcs.get(name).push(file);
  }

  if (after === before) {
    // A page whose ONLY arc was skipped for want of a `-m` twin is correctly
    // unchanged; that is Task 4, not a stale anchor. Reported once, under
    // SKIPPED, rather than twice under two different names.
    if (skipped.length < findArcImgs(before).length) inert.push(file);
    continue;
  }

  // Every mobile `srcset` this file now carries must resolve to a real asset.
  // Resolved against the site root because the authored values are page-relative
  // and every one of these pages sits at the top level of the deployed app.
  for (const hit of findArcImgs(after)) {
    const target = mobileSrc(hit.src);
    if (after.includes(`srcset="${target}"`) && !existsSync(`${SITE}/${target}`)) {
      dangling.push(`${file} → ${target}`);
    }
  }

  changed++;
  console.log(`${file}  [${applied.join(', ')}]`);
  if (!DRY) writeFileSync(file, crlf ? after.replace(/\n/g, '\r\n') : after);
}

console.log(`\nfiles in scope   : ${SCOPE.length}`);
console.log(`files changed    : ${changed}${DRY ? ' (dry run — nothing written)' : ''}`);
console.log(`files unchanged  : ${inert.length}`);

console.log('\narc census — desktop arc referenced in scope → does a -m twin exist:');
for (const { name, hasMobile } of mobileVariantCensus()) {
  console.log(`  ${hasMobile ? 'wrapped' : 'SKIPPED'}  ${name}.svg  ${hasMobile ? `→ ${name}-m.svg` : '— no -m variant on disk'}`);
}

for (const f of inert) console.log(`  INERT     ${f} — the transform was a no-op, so the arc anchor has gone stale`);
for (const f of noArc) console.log(`  NO ARC    ${f} — a page in scope with no arc <img> at all`);
for (const [name, files] of skippedArcs) console.log(`  SKIPPED   ${name} has no -m variant — left unwrapped on ${files.length} page(s)`);
for (const d of dangling) console.log(`  DANGLING  ${d} — srcset points at a file that is not on disk`);

process.exitCode = inert.length || noArc.length || dangling.length ? 1 : 0;
