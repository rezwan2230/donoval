// A frozen snapshot of the policy with analytics OFF (JAY-TRACKING-B3).
//
// WHY THIS EXISTS, WHEN test/analytics-inject.test.mjs ALREADY CHECKS THE FLAG
//
// Raised in review of #236, and the reviewer was right. The existing proof is
// STRUCTURAL: it asserts `buildCsp(n)` equals `buildCsp(n, {analytics:false})`,
// and that no vendor host appears in the off policy. Both hold — but both are
// relative. They compare the function to ITSELF.
//
// So they cannot see a change that moves both paths together. Widen the base
// `script-src`, or drop a directive entirely, and every assertion in that file
// still passes: the two paths still agree with each other, and the new hole is
// not a vendor host so the deny-list never fires. The claim everyone is relying
// on — "with the flag unset the policy is byte-identical to what production
// serves today" — is the one thing that was not actually pinned anywhere.
//
// This file pins it. The strings below were read out of `buildCsp` on
// 2026-08-10, on the commit that #231 merged, and they are the policy the live
// site is serving right now.
//
// ── WHEN THIS TEST FAILS ─────────────────────────────────────────────────────
//
// It is not noise and it is not a snapshot to bless away. It means the security
// policy of a live law firm's site changed. Read the diff it prints, decide
// whether the change is intended, and only then update the literal — in the same
// commit as the change, so review sees both together.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { buildCsp } from '../donovan-legal-site/functions/_middleware.js';

const NONCE = 'N';

/**
 * The policy as served after the voice concierge was removed AND Vantage severed
 * — RE-FROZEN a second time.
 *
 * The point of a literal snapshot is that a directive cannot move without somebody
 * editing this string, so the edit is the record. Everything that moved, moved by
 * SUBTRACTION. Nothing was added, and `repo-invariants` carries the inverted
 * assertion that keeps each removed origin out.
 *
 * Round one, the voice removal: `script-src` lost `esm.sh` (it served the
 * RetellWebClient module and nothing in the tree imports from it now) and
 * `connect-src` lost `esm.sh`, `*.retellai.com` and `*.livekit.cloud` (the browser
 * no longer opens a WebRTC session).
 *
 * Round two, the Vantage severance, which is this edit:
 *   script-src   − vantage.ticoai.net, cdn.theconnexus.ai, portal.theconnexus.ai
 *   connect-src  − vantage.ticoai.net, portal.theconnexus.ai
 *   frame-src    − vantage.ticoai.net, portal.theconnexus.ai
 *   form-action  − vantage.ticoai.net
 * The beacon `<script src="https://vantage.ticoai.net/perch.js">` was the only thing
 * on the site that ever loaded from any of those hosts, and it is gone from all 156
 * pages that carried it. The two theconnexus.ai hosts were never referenced by a
 * single file in the tree.
 */
const OFF =
  "default-src 'self'; " +
  "script-src 'self' 'nonce-N' https://code.jquery.com https://cdnjs.cloudflare.com https://challenges.cloudflare.com; " +
  "connect-src 'self' https://challenges.cloudflare.com; " +
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
  "font-src 'self' https://fonts.gstatic.com data:; " +
  "img-src 'self' data: https:; " +
  "frame-src 'self' https://challenges.cloudflare.com; " +
  "frame-ancestors 'self'; " +
  "base-uri 'self'; " +
  "form-action 'self'; " +
  "object-src 'none'";

/**
 * There is no longer a second shape.
 *
 * This file used to freeze TWO strings — OFF_FRAMES_UNLOCKED and OFF_FRAMES_LOCKED
 * — because `frame-ancestors` had two states and `lockFrameAncestors` chose between
 * them. The wide state existed so the Perch shell could frame the site cross-origin.
 * The shell is deleted and Vantage is severed, so nothing off-origin frames this site
 * in either state; the option is gone from buildCsp and the policy is one string.
 *
 * Kept as an alias rather than renamed away so the "locked" assertion below still
 * reads as a deliberate check that both former states now agree.
 */
const OFF_FRAMES_UNLOCKED = OFF;
const OFF_FRAMES_LOCKED = OFF;

/** Print the directive that moved, not a 4KB wall of two near-identical strings. */
function diff(expected, actual) {
  const e = new Map(expected.split('; ').map((d) => [d.split(' ')[0], d]));
  const a = new Map(actual.split('; ').map((d) => [d.split(' ')[0], d]));
  const lines = [];
  for (const [name, d] of e) {
    if (!a.has(name)) lines.push(`  REMOVED  ${d}`);
    else if (a.get(name) !== d) lines.push(`  CHANGED  ${name}\n    was: ${d}\n    now: ${a.get(name)}`);
  }
  for (const [name, d] of a) if (!e.has(name)) lines.push(`  ADDED    ${d}`);
  return lines.join('\n') || '  (ordering changed, no directive differs)';
}

describe('the analytics-OFF policy is frozen', () => {
  test('byte-identical to what production serves today — shell live', () => {
    const actual = buildCsp(NONCE);
    assert.equal(actual, OFF_FRAMES_UNLOCKED,
      `\nThe CSP of a live law firm's site changed.\n${diff(OFF_FRAMES_UNLOCKED, actual)}\n\n` +
      'If that was intended, update the literal in this file IN THE SAME COMMIT,\n' +
      'so review sees the policy change and the test change together.\n');
  });

  test('byte-identical after the shell is retired', () => {
    const actual = buildCsp(NONCE, { lockFrameAncestors: true });
    assert.equal(actual, OFF_FRAMES_LOCKED, `\n${diff(OFF_FRAMES_LOCKED, actual)}\n`);
  });

  test('the flag OFF path and the default path are the same string', () => {
    assert.equal(buildCsp(NONCE, { analytics: false }), OFF_FRAMES_UNLOCKED);
  });

  test('turning analytics ON is PURELY ADDITIVE to this exact baseline', () => {
    // The real claim behind "byte-identical when off": every directive of the
    // frozen policy survives verbatim, and the only difference is appended hosts.
    const on = buildCsp(NONCE, { analytics: true });
    const onDirectives = new Map(on.split('; ').map((d) => [d.split(' ')[0], d]));

    for (const d of OFF_FRAMES_UNLOCKED.split('; ')) {
      const name = d.split(' ')[0];
      assert.ok(onDirectives.has(name), `analytics ON dropped the ${name} directive entirely`);
      assert.ok(onDirectives.get(name).startsWith(d),
        `analytics ON did not merely APPEND to ${name} — it rewrote it:\n  off: ${d}\n  on:  ${onDirectives.get(name)}`);
    }
    assert.equal(onDirectives.size, OFF_FRAMES_UNLOCKED.split('; ').length,
      'analytics ON introduced a directive the frozen policy does not have');
  });

  test('the snapshot is not vacuous — it rejects a widened policy', () => {
    // Without this, a snapshot test that had silently stopped comparing anything
    // would pass forever. This is the control.
    const tampered = OFF_FRAMES_UNLOCKED.replace("script-src 'self'", "script-src 'self' 'unsafe-inline'");
    assert.notEqual(tampered, OFF_FRAMES_UNLOCKED);
    assert.ok(diff(OFF_FRAMES_UNLOCKED, tampered).includes('CHANGED  script-src'));
  });
});
