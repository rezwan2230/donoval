#!/usr/bin/env node
/**
 * JORDAN-195-LEVELA-WAIVER-R1 — write the §4 edits to disk.
 *
 * Separate from `waiver-evidence.mjs` on purpose: one program changes files, the
 * other proves the change is safe, and neither should be able to do the other's
 * job by accident. The transforms themselves live in `waiver-edits.mjs` so both
 * read the same definition.
 *
 * ── THE TWO WAYS A CLOSED SCOPE LIST GOES WRONG, AND WHAT IS DONE ABOUT EACH ─
 *
 *   Stale in  — a file is listed and no longer carries the defect. Silent
 *               success would mean the waiver register names a page nobody
 *               edited. Reported as UNMATCHED and exits non-zero.
 *   Stale out — a file carries the defect and is not listed. Silent success
 *               would mean an accessibility defect this order measured is left
 *               open with no record. Reported as OUT-OF-SCOPE, by name, so the
 *               follow-up order can be written against a real list.
 *
 * The second is not a failure: PR #216's sweep only covers the pages in
 * `sitemap.xml`, and this order waives exactly the files that sweep measured.
 * Tier-duplicated pages under `diamond/`, `gold/`, `platinum/` and `reserve/`
 * carry the same markup and are deliberately left for a follow-up, because no
 * reviewed waiver entry describes them.
 *
 * Usage:
 *   node scripts/a11y/apply-waiver-edits.mjs --dry-run
 *   node scripts/a11y/apply-waiver-edits.mjs
 */

import { readFileSync, writeFileSync, globSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { EDITS, SCOPE, applyAll } from './waiver-edits.mjs';

const SITE = 'donovan-legal-site';
const DRY = process.argv.includes('--dry-run');
const BASE = (process.argv.indexOf('--base') !== -1 && process.argv[process.argv.indexOf('--base') + 1]) || 'origin/main';

/**
 * Does this rule's transform change this file at all?
 *
 * Asked by running the transform rather than by a second copy of its regex, so
 * "matches the rule" and "is edited by the rule" cannot drift apart.
 */
const matches = (edit, src) => edit.apply(src) !== src;

const allFiles = globSync(`${SITE}/**/*.html`).map((f) => f.replace(/\\/g, '/')).sort();

/**
 * The scope check runs against `origin/main`, NOT against the working tree.
 *
 * The defect list is a statement about the branch point. Checking the working
 * tree instead would make this program refuse to run a second time — every
 * transform is a no-op once it has been applied — and "the edit already
 * happened" would be indistinguishable from "the list has gone stale", which is
 * the one thing this check exists to tell apart.
 */
const baseOf = (file) => execFileSync('git', ['show', `${BASE}:${file}`], { encoding: 'utf8', maxBuffer: 1 << 28 });
const source = new Map(allFiles.map((f) => [f, baseOf(f)]));

let problems = 0;

// ── Scope integrity, before a single byte is written ─────────────────────────

for (const edit of EDITS) {
  const unmatched = edit.files.filter((f) => !source.has(f) || !matches(edit, source.get(f)));
  const outside = allFiles.filter((f) => !edit.files.includes(f) && matches(edit, source.get(f)));

  if (unmatched.length) {
    problems++;
    console.error(`UNMATCHED  ${edit.rule}: listed but the transform is a no-op on:`);
    for (const f of unmatched) console.error(`             ${f}`);
  }
  if (outside.length) {
    console.log(`OUT-OF-SCOPE  ${edit.rule}: ${outside.length} file(s) match this edit and are NOT waived by this order:`);
    for (const f of outside) console.log(`              ${f}`);
  }
}

if (problems) {
  console.error('\nRefusing to write: the scope lists no longer describe the tree.');
  process.exit(1);
}

// ── Apply ────────────────────────────────────────────────────────────────────

let changed = 0;
const perFile = [];
for (const file of SCOPE) {
  const before = readFileSync(file, 'utf8');
  const { after, applied } = applyAll(file, before);
  if (after === before) continue;
  changed++;
  perFile.push({ file, applied });
  if (!DRY) writeFileSync(file, after);
}

console.log(`\n${DRY ? '[dry run] ' : ''}${changed} of ${SCOPE.length} scoped file(s) rewritten`);
for (const r of perFile) console.log(`  ${r.file}  [${r.applied.join(', ')}]`);
