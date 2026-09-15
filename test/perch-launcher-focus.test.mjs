// ── JORDAN-LAUNCHER-FOCUS-OUTLINE — the launcher's focus indicator ───────────
//
// Order JORDAN-LAUNCHER-FOCUS-OUTLINE. Cosmetic, with one hard accessibility
// floor underneath it.
//
// ── WHAT THIS PINS, AND WHAT IT DELIBERATELY DOES NOT ────────────────────────
// The defect was a UA default, not a rule in this repo: Chrome paints
// `outline: rgb(16,16,16) auto 5px` on a focused <button>, and the launcher is
// the only concierge that IS one — `#concierge` in perch.html is a <div>, which
// is why `/perch` never showed the black rectangle. Measured on
// https://www.donovan.law/testimonials before the fix; re-measured on Preview
// after it. Those measurements are the behavioural proof and they live in the
// PR, because "does Chrome paint a ring" is a question only a browser answers —
// jsdom implements neither `:focus-visible` matching nor outline painting, so a
// row here that claimed to test the paint would be testing nothing.
//
// What this file IS for is the floor: the reset must never outlive the
// replacement. `:focus { outline: none }` on its own is a WCAG 2.4.7 failure,
// and the cheapest way for a later edit to reintroduce it is to delete the
// `:focus-visible` block as dead weight. §2 fails if that happens. That is a
// structural claim about the shipped stylesheet, which is the right shape for it
// — see [[feedback_assert_behavior_not_source_spelling]] for when it is not.
//
// Nothing here opens a network connection or writes anything.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CSS = fs.readFileSync(
  path.join(ROOT, 'donovan-legal-site', 'css', 'perch-layer.css'), 'utf8');

const LAUNCHER = '#dvn-perch-launcher';
const DRESSED = `${LAUNCHER}.perch-concierge`;

/**
 * Selector blocks, comments stripped FIRST — a comment can sit inside a selector
 * list and mangle the one it lands in ([[feedback_css_comments_break_selector_harvest]]).
 * Same harvester as test/perch-launcher-parity.test.mjs, on purpose: the two
 * files reason about the same stylesheet and should not disagree about what a
 * rule is. `@media` preludes fall out on their own — `[^{}]+` cannot span the
 * brace, so the engine skips the prelude and matches the nested rules directly.
 */
function rules(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const m of clean.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim();
    if (!selector || selector.startsWith('@')) continue;
    out.push({
      selectors: selector.split(',').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean),
      body: m[2].trim(),
    });
  }
  return out;
}

const launcherRules = () => rules(CSS).filter((r) => r.selectors.some((s) => s.includes(LAUNCHER)));

describe('JORDAN-LAUNCHER-FOCUS-OUTLINE — the orb no longer wears a black box', () => {
  // ── §1 the reset ───────────────────────────────────────────────────────────

  test('the dressed launcher resets the UA ring on plain :focus', () => {
    // `:focus`, not only `:focus-visible`. Both dismissal paths out of the
    // consent modal were measured on production and BOTH painted the ring —
    // js/consent-gate.js restores focus to the launcher with a script call when
    // the modal closes, and the UA ring did not wait for `:focus-visible` to
    // match before painting. Resetting only the narrow pseudo-class would have
    // left the defect exactly where David photographed it: mid-call.
    const reset = launcherRules().find((r) =>
      r.selectors.some((s) => s.includes(`${DRESSED}:focus`) && !s.includes(':focus-visible'))
      && /outline:\s*none/.test(r.body));
    assert.ok(reset, 'no rule clears the UA focus ring from the dressed launcher');
  });

  test('the stray outline-offset that made the black box look deliberate is gone', () => {
    // The button-neutralisation block declared `outline-offset: 3px` and no
    // `outline`. An offset with no ring of its own does nothing except stand the
    // UA's ring 3px further off the orb, which is the gap in David's screenshot.
    const neutralise = launcherRules().find((r) =>
      r.selectors.length === 1 && r.selectors[0] === `#perch-persistent ${DRESSED}`
      && r.body.includes('overflow'));
    assert.ok(neutralise, 'the launcher-only neutralisation block must still exist');
    assert.doesNotMatch(neutralise.body, /outline/,
      'this block must not carry an outline property it never pairs with a ring');
  });

  // ── §2 the accessibility floor ─────────────────────────────────────────────

  test('a keyboard focus ring is still declared — the reset never ships alone', () => {
    // THE ROW THAT MATTERS. `outline: none` with nothing behind it is a WCAG
    // 2.4.7 failure, and the cheapest way to get there from here is for someone
    // to delete the `:focus-visible` block as redundant. If that happens this
    // fails, and the reset above cannot reach production on its own.
    const ring = launcherRules().filter((r) =>
      r.selectors.some((s) => s.includes(`${DRESSED}:focus-visible`)));
    assert.ok(ring.length > 0, 'the dressed launcher declares no :focus-visible indicator');

    const paints = ring.some((r) => /outline:\s*\d/.test(r.body) || /box-shadow:\s*0 0 0/.test(r.body));
    assert.ok(paints,
      ':focus-visible is declared but paints nothing a keyboard user could see');
  });

  test('the ring is two-tone, so it clears contrast on cream, on white and on gold', () => {
    // `--perch-gold-bright` (#ffca18) is ~1.6:1 against the white and cream page
    // backgrounds these 139 content pages use, which is below WCAG 2.2 SC 2.4.11.
    // The ink hairline underneath it is what gives the indicator an edge on every
    // background the orb floats over, so it is part of the requirement rather
    // than decoration and is pinned as such.
    const ring = launcherRules().find((r) =>
      r.selectors.some((s) => s.includes(`${DRESSED}:focus-visible`)) && /outline:\s*\d/.test(r.body));
    assert.ok(ring, 'expected a :focus-visible rule that draws the outline');
    assert.match(ring.body, /outline:\s*3px solid var\(--perch-gold-bright\)/);
    assert.match(ring.body, /box-shadow:[^;]*var\(--perch-ink\)/,
      'the gold ring must sit on the ink hairline, not on the page background alone');
  });

  test('the connected state keeps its own drop shadow when focused', () => {
    // `.live .disc` and the idle focus rule have IDENTICAL specificity, so the
    // idle rule would silently repaint a live call's green glow gold. The `.live`
    // focus rule outranks both and is the only reason that does not happen — it
    // is load-bearing, not a copy-paste.
    const live = launcherRules().find((r) =>
      r.selectors.some((s) => s.includes(`${DRESSED}.live:focus-visible`)));
    assert.ok(live, 'no .live focus rule — a focused live call would lose its green shadow');
    assert.match(live.body, /rgba\(7, 76, 35, \.55\)/, 'the green drop shadow must survive');
    assert.match(live.body, /var\(--perch-ink\)/, 'and the ring must still be drawn');
  });

  // ── §3 reach ───────────────────────────────────────────────────────────────

  test('every new focus rule is class-gated, so a bare launcher matches none', () => {
    // Same invariant test/perch-launcher-parity.test.mjs pins for the rest of the
    // file: a page with no persistent layer keeps the 66px inline launcher and
    // must not be repainted by rules written for the dressed one. Restated here
    // because these selectors are new and the parity suite harvests a different
    // set.
    const leaks = launcherRules()
      .flatMap((r) => r.selectors)
      .filter((s) => /:focus/.test(s) && !s.includes('.perch-concierge'));
    assert.deepEqual(leaks, []);
  });

  test('the shell orb is untouched — it cannot take focus in the first place', () => {
    // perch.html renders `#concierge` as a <div> with no tabindex, so it has no
    // focus state to dress and `/perch` never showed the defect. Adding a rule
    // for it would be dead CSS pretending to be parity. The parity suite's own
    // §3 only requires shell rules to name the launcher, never the reverse.
    const shellFocus = rules(CSS)
      .flatMap((r) => r.selectors)
      .filter((s) => s.includes('#concierge') && /:focus/.test(s));
    assert.deepEqual(shellFocus, []);
  });
});
