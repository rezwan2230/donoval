#!/usr/bin/env node
/**
 * JORDAN-PAUL-CONTENT — write the #224/#225/#226 content deltas to disk.
 *
 * Every transform lives in `paul-content-edits.mjs`; this file only applies them
 * and REPORTS. It fails loud in the two directions a hard-coded scope list can go
 * wrong:
 *
 *   • a file in the scope whose edits produce no change (a stale anchor — the
 *     page moved under the transform and the edit silently did nothing), and
 *   • a file in the scope missing the `.dl-connect` anchor, or carrying it twice.
 *
 * LINE ENDINGS. These blobs are stored with LF and checked out with CRLF
 * (`core.autocrlf=true`). The transforms are written against LF, so each file is
 * normalised before and re-CRLF'd after when that is what it had — otherwise the
 * applier would leave one file mixed and the next reader would be diffing
 * carriage returns.
 *
 * Usage: node scripts/content/apply-paul-content.mjs [--dry]
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { SCOPE, applyAll, CONNECT_ANCHOR } from './paul-content-edits.mjs';

const DRY = process.argv.includes('--dry');
const eol = (s) => s.replace(/\r\n?/g, '\n');

let changed = 0;
const inert = [];
const badAnchor = [];

for (const file of SCOPE) {
  const raw = readFileSync(file, 'utf8');
  const crlf = raw.includes('\r\n');
  const before = eol(raw);

  const hits = before.split(CONNECT_ANCHOR).length - 1;
  if (hits !== 1) badAnchor.push(`${file} (${hits} matches)`);

  const { after, applied } = applyAll(file, before);
  if (after === before) {
    inert.push(file);
    continue;
  }

  changed++;
  console.log(`${file}  [${applied.join(', ')}]`);
  if (!DRY) writeFileSync(file, crlf ? after.replace(/\n/g, '\r\n') : after);
}

console.log(`\nfiles in scope   : ${SCOPE.length}`);
console.log(`files changed    : ${changed}${DRY ? ' (dry run — nothing written)' : ''}`);
console.log(`files unchanged  : ${inert.length}`);
for (const f of inert) console.log(`  INERT      ${f} — every transform was a no-op, so an anchor has gone stale`);
for (const f of badAnchor) console.log(`  BAD ANCHOR ${f} — the .dl-connect anchor must appear exactly once`);

process.exitCode = inert.length || badAnchor.length ? 1 : 0;
