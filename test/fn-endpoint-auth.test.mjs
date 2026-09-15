// ── /fn/* INBOUND AUTH — the tree guard that replaced the per-endpoint suites ──
//
// WHY THIS FILE EXISTS AND WHAT IT REPLACED
//
// `tool-endpoint-auth.test.mjs` and `tool-endpoint-auth-d1.test.mjs` proved that
// each of seven named endpoints called `verifyToolSecret`. Every one of those seven
// was a Retell function-tool endpoint, and all seven went with the voice concierge.
// Deleting those suites without replacing them would have removed the only thing
// standing between `functions/fn/` and a new endpoint shipping unauthenticated —
// which is precisely the defect SHELDON-PERCH-TOOL-AUTH was raised to fix, and the
// reason its header called `take_message` "the sharpest gap in the set: an
// unauthenticated POST that writes straight into Paul's REAL intake queue".
//
// So the guard is rewritten rather than retired, and it is rewritten in the shape
// the old one should arguably have had: it walks the DIRECTORY instead of naming
// files. A per-endpoint suite only ever covers the endpoints somebody remembered to
// add to it. A tree walk covers the one nobody remembered — which is the only kind
// that ever ships unauthenticated.
//
// ── WHAT COUNTS AS A GATE ────────────────────────────────────────────────────
//
// `/fn/*` is no longer one surface with one answer. It was the Retell tool surface,
// authenticated by a shared secret the agent sent. What remains is browser-facing,
// and a browser cannot hold a shared secret — so the correct gate differs per
// endpoint and the guard has to know the difference rather than demand one header.
//
// ── THE KNOWN GAP IS LISTED, NOT HIDDEN ──────────────────────────────────────
//
// `qualifier_submit.js` has no inbound gate. That is recorded here as a named
// exception with its reason, so the suite passes honestly and the gap stays visible
// to the next reader instead of being absorbed into a green tick. It pre-dates the
// voice removal. Closing it means giving the card the same Turnstile treatment
// `contact.js` has, and that is a change with its own review, not a line here.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FN_DIR = path.join(ROOT, 'donovan-legal-site', 'functions', 'fn');

/**
 * The gates an endpoint may legitimately stand behind, and what each one is for.
 * A file matching none of these is unauthenticated, and the sweep below fails.
 */
const GATES = [
  ['verifyToolSecret', 'the shared x-perch-tool-secret — a Retell function-tool endpoint'],
  ['verifyTurnstile', 'a Cloudflare Turnstile token — a human-facing form'],
  ['checkOrigin', 'same-site only — refuses cross-origin callers'],
  ['verifyRetellSignature', 'the Retell webhook HMAC'],
  ['x-perch-call-id', 'scoped to a live call id; a request without one touches nothing'],
];

/**
 * Endpoints with NO inbound gate, and why that is currently accepted. Every entry
 * is a debt, not a decision — the reason has to say what closing it would take.
 */
const UNGATED = new Map([
  ['qualifier_submit.js',
    'Pre-dates the voice removal. Posted by the qualifier card from the visitor\'s '
    + 'browser, so it cannot carry a shared secret; it sets the server-side qualifier '
    + 'cookie that booking/create.js later joins on. Closing it means the Turnstile + '
    + 'origin + rate-limit treatment contact.js already has.'],
]);

const endpoints = fs.readdirSync(FN_DIR).filter((f) => f.endsWith('.js')).sort();

describe('/fn/* inbound auth — every endpoint is gated, or listed as a known gap', () => {
  test('the directory is not empty — the sweep has something to sweep', () => {
    // Vacuity guard. If the voice teardown ever removes the last endpoint, this
    // suite would otherwise pass by checking nothing at all.
    assert.ok(endpoints.length > 0, 'functions/fn/ has no endpoints — is the sweep pointed at the right place?');
  });

  for (const file of endpoints) {
    test(`${file} stands behind a gate`, () => {
      const src = fs.readFileSync(path.join(FN_DIR, file), 'utf8');
      // Comments stripped: a file that only NAMES a gate while explaining something
      // else is not gated by it. qualifier_submit.js is exactly that case — it
      // mentions requireWriteSecret while describing its OUTBOUND call to Vantage.
      const code = src
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/^[ \t]*\/\/.*$/gm, ' ');

      const found = GATES.filter(([needle]) => code.includes(needle)).map(([needle]) => needle);
      const excused = UNGATED.get(file);

      if (found.length === 0) {
        assert.ok(excused,
          `${file} has no inbound gate and is not on the known-gap list. Add a gate, or `
          + 'add it to UNGATED with a reason that says what closing it would take.');
        return;
      }
      assert.equal(excused, undefined,
        `${file} is on the known-gap list but now has a gate (${found.join(', ')}) — remove the entry.`);
    });
  }

  test('the known-gap list names only files that exist', () => {
    // A stale exemption is worse than none: it silently excuses a filename that may
    // one day be reused by something else entirely.
    for (const file of UNGATED.keys()) {
      assert.ok(endpoints.includes(file), `${file} is excused but no longer exists — drop the entry`);
    }
  });

  test('the known-gap list has not grown quietly', () => {
    // One entry today. This is the number a reviewer should have to change on
    // purpose, in a diff somebody reads, rather than a list that drifts upward.
    assert.equal(UNGATED.size, 1, 'the ungated set changed — that is a decision, not a detail');
  });
});
