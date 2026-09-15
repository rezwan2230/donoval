// JORDAN-195-A11Y-REMEDIATE — the accessible palette, and the substitution map.
//
// ── WHY THIS FILE EXISTS ─────────────────────────────────────────────────────
//
// #213 re-valued the brand colours in `css/main.css` and, measured live by
// SARAH-195-PROD-SWEEP-R1 (PR #216), could not reach 803 of the 1033 residual
// `color-contrast` nodes: the old hex is written into the delivered HTML, in
// per-page `<style>` blocks (1,443 occurrences) that outrank the shared
// stylesheet, and on 8 roadmap posts that never load it at all.
//
// So the remediation has to rewrite those per-page blocks. This module is the
// single place that says WHAT each old colour becomes, so the rewrite is one
// reviewable table rather than 134 independent judgement calls — and so the
// verifier below can prove the table clears 4.5:1 against every background the
// sweep actually measured, rather than against the one background someone
// happened to think of.
//
// ── HOW EACH REPLACEMENT WAS CHOSEN ──────────────────────────────────────────
//
// Not by eye. `nearestPassing` in `contrast.mjs` walks the original colour
// toward black (on a light background) or white (on a dark one) in 1/255 steps
// and stops at the FIRST value clearing the threshold, so each replacement keeps
// as much of the original hue as WCAG allows. Where one old colour appears over
// several backgrounds, the replacement is checked against the worst of them.
//
// ── THE ONE COLOUR THAT IS NOT SUBSTITUTED WHOLESALE ─────────────────────────
//
// `#c9a961` — the brand gold — is used BOTH as text on a light background (162
// failing nodes, needs darkening to `#806633`) and as a BACKGROUND behind dark
// text (`border-left: 4px solid #C9A961`, 187 declarations, and the gold callout
// bands). Darkening it everywhere would wreck the bands and change the brand's
// look for no accessibility gain, because a border is not text and
// `color-contrast` never looks at one. So gold is rewritten only in `color:`
// declarations, and the two pairs where dark text sits ON gold are fixed from
// the TEXT side instead. `rewriteDeclaration` below is what enforces that split.

/**
 * Design tokens. These are also emitted into `css/main.css` as custom properties
 * so the shared layer and the per-page blocks name the same colours; the per-page
 * rewrite writes the literal value with the token named in a trailing comment,
 * because the 8 roadmap posts never load `main.css` and a bare `var()` would
 * resolve to nothing there.
 */
export const TOKENS = {
  '--dl-green': '#107A4D',        // brand green: text on light, and background under white text
  '--dl-green-deep': '#0A5A37',   // deep green, unchanged by this order
  '--dl-green-on-gold': '#084B2E',// green text that sits on a gold band
  '--dl-gold': '#C9A961',         // brand gold as a BAND/BORDER fill — deliberately unchanged
  '--dl-gold-text': '#806633',    // brand gold used as TEXT on a light background
  '--dl-gold-on-deep': '#D5BD85', // gold text on the deep-green band
  '--dl-ink-muted': '#6E6E6E',    // muted grey body text
  '--dl-slate': '#5A7181',        // slate captions on the roadmap posts
  '--dl-emerald': '#01873F',      // the roadmap posts' own --emer link colour
  '--dl-sage-on-deep': '#A1BDAA', // sage text on the deep-green band
  '--dl-forest-on-gold': '#2C482C',// forest text on a gold band
  '--dl-rust': '#BC4B00',         // rust accent text
  // The three accent bands. Each is used BOTH as a band under white text and (at
  // least once, `color:var(--teal)`) as text on the roadmap posts' `#fcfcfb`
  // page background. Both roles want the same thing — a darker colour — so each
  // value below is the one that clears 4.5:1 in the HARDER of the two directions
  // (as text on `#fcfcfb`), which leaves the white-on-band case at 4.62–4.64.
  // That is why they are not split into foreground and background entries.
  '--dl-rust-bg': '#AE6038',      // rust band / rust text
  '--dl-teal-bg': '#357E91',      // teal band / teal text
  '--dl-steel-bg': '#537A8B',     // steel band / steel text
  '--dl-ink-on-dark': '#828282',  // muted text on the near-black band
};

/**
 * old hex → new hex, for colours that are only ever FOREGROUND text (or, for
 * `#169b62`, are safe in both roles — see the note on that entry).
 *
 * Keys are lower-case; the rewriter matches case-insensitively and preserves the
 * casing style of whatever it replaced.
 */
export const FOREGROUND = {
  // Safe in BOTH roles, and so the only entry applied to every declaration.
  // As text it clears 4.5:1 on all nine light backgrounds the sweep measured
  // (4.60–5.37); as a background it carries white at 5.37:1, which is what fixes
  // the 18 `#ffffff on #169b62` nodes. Darkening it can only ever help a lighter
  // foreground, so the border and background declarations come along safely.
  '#169b62': TOKENS['--dl-green'],

  // Foreground-only. Gold as a band is left alone — see the header note.
  '#c9a961': TOKENS['--dl-gold-text'],

  // Greys. One value for all three, chosen to clear 4.5:1 on the DARKEST light
  // background any of them was measured over (`#f5f5f0`), not just on white.
  '#8a8a8a': TOKENS['--dl-ink-muted'],
  '#8a8b8d': TOKENS['--dl-ink-muted'],
  '#9a9a9a': TOKENS['--dl-ink-muted'],

  '#8a6f1f': TOKENS['--dl-gold-text'],
  '#5e7686': TOKENS['--dl-slate'],
  '#019a48': TOKENS['--dl-emerald'],
  '#9fbca9': TOKENS['--dl-sage-on-deep'],
  '#416b41': TOKENS['--dl-forest-on-gold'],
  '#d35400': TOKENS['--dl-rust'],

  // NOT `#6b6b6b`. It is the figure-caption grey and sits on a LIGHT background
  // almost everywhere, where it already clears 4.5:1 (5.33 on white). It fails in
  // exactly one place — `.preview-footer-meta` on `/tool-deal-builder-preview`,
  // 2 nodes, over the near-black `#1a1a1a` footer band — and the fix there is to
  // go LIGHTER (`--dl-ink-on-dark`). Putting that in this table would have
  // lightened every caption on the site from 5.33 to 3.84 and turned a passing
  // colour into a failing one on ~30 pages. Applying it globally was tried,
  // measured, and reverted; it is now a one-page scoped rule instead. This
  // comment is the guard rail against someone "completing" the table later.

  // The accent bands, safe in both roles — see the TOKENS note above.
  '#c06a3e': TOKENS['--dl-rust-bg'],
  '#3c8da3': TOKENS['--dl-teal-bg'],
  '#5e8b9e': TOKENS['--dl-steel-bg'],
};

/**
 * Retained for the verifier, which asks "what would a background-only rewrite
 * do?" separately from the foreground one. Empty by design: every band colour
 * above turned out to be safe in both roles, so nothing needs a background-only
 * rule. Kept rather than deleted so a future colour that DOES need one has a
 * place to go and a reader can see the distinction was considered.
 */
export const BACKGROUND = {};

/**
 * Colours that must ONLY be rewritten in a `color:` declaration, never in a
 * `background`, `border*`, `fill` or `stroke`.
 */
export const FOREGROUND_ONLY = new Set([
  '#c9a961', '#8a6f1f', '#416b41', '#9fbca9', '#6b6b6b', '#d35400',
]);

/** CSS properties that paint TEXT. */
const TEXT_PROPS = /^(color|-webkit-text-fill-color)$/i;

/**
 * Rewrite one CSS declaration's value. `prop` is the declaration's property name.
 *
 * Returns the new value, or the original when nothing applies. This is the single
 * decision point: everything about "gold as text vs gold as a band" lives here so
 * that the rule is testable in isolation.
 */
/**
 * The opt-out marker, written into the CSS itself.
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────────
 *
 * Every entry in `FOREGROUND` assumes the text sits on a LIGHT background, so it
 * makes the colour darker. On a dark surface that assumption inverts and the
 * substitution makes contrast WORSE. This is not hypothetical — the first run of
 * this rewrite introduced 13 new failures, all of exactly this shape, and they
 * were caught only because the before/after axe sweep diffed node by node:
 *
 *   .phase-label  #C9A961 on #232323  6.98 PASS  →  #806633  2.89 FAIL
 *   .closing a    #019A48 on #0E1B26  4.75 PASS  →  #01873F  3.77 FAIL
 *
 * Light and dark cannot share one value: clearing 4.5:1 against `#FCFCFB` caps a
 * colour's luminance at 0.178, and clearing it against `#0E1B26` demands at least
 * 0.2245. So a colour on a dark surface has to be excluded from the table and
 * chosen for its own background — which is what this marker declares.
 *
 * It is a comment in the stylesheet rather than a list of selectors in this file
 * on purpose: the fact that a rule paints onto a dark surface is a property of
 * that rule, it is visible to whoever next edits it, and it travels with the
 * declaration if the selector is renamed.
 *
 *   color: #C9A961; /* a11y:dark-surface — on #232323, 6.98:1 *\/
 */
const DARK_SURFACE = /a11y:dark-surface/i;

export function rewriteDeclaration(prop, value) {
  if (DARK_SURFACE.test(value)) return value;
  const isText = TEXT_PROPS.test(prop.trim());
  return value.replace(/#[0-9a-fA-F]{6}\b/g, (hex) => {
    const key = hex.toLowerCase();
    if (FOREGROUND[key] && (!FOREGROUND_ONLY.has(key) || isText)) {
      return matchCase(hex, FOREGROUND[key]);
    }
    if (BACKGROUND[key] && !isText) return matchCase(hex, BACKGROUND[key]);
    return hex;
  });
}

/** Keep the file's own casing convention: `#169B62` → `#107A4D`, `#8a6f1f` → `#806633`. */
function matchCase(oldHex, newHex) {
  const body = oldHex.slice(1);
  const upper = body === body.toUpperCase() && /[A-F]/.test(body);
  return upper ? newHex.toUpperCase() : newHex.toLowerCase();
}
