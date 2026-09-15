// JORDAN-195-A11Y-REMEDIATE — WCAG 2.x relative-luminance contrast maths.
//
// Used by the remediation tooling to CHOOSE replacement colours rather than guess
// them: every hex this order writes into the site is picked by asking this module
// for the ratio against the background axe actually measured, not by eye.
//
// Formulae are WCAG 2.1 §relative luminance and §contrast ratio verbatim.

export function parseHex(hex) {
  const h = String(hex).trim().replace(/^#/, '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) throw new Error(`not a hex colour: ${hex}`);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
}

/** WCAG relative luminance of an sRGB triple. */
export function luminance(rgb) {
  const [r, g, b] = rgb.map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two hex colours, 1..21. */
export function contrast(fg, bg) {
  const a = luminance(parseHex(fg));
  const b = luminance(parseHex(bg));
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

/** Does this pair clear the AA threshold for normal-size text? */
export function passesAA(fg, bg, large = false) {
  return contrast(fg, bg) >= (large ? 3 : 4.5);
}

/**
 * Darken (or lighten) `fg` along its own hue until it clears `target` against
 * `bg`, returning the FIRST colour that does.
 *
 * Walks in sRGB toward black or white in 1/255 steps rather than jumping to a
 * hand-picked value, so the result keeps as much of the brand hue as the
 * threshold allows instead of collapsing to near-black.
 */
export function nearestPassing(fg, bg, target = 4.5) {
  const rgb = parseHex(fg);
  const bgLum = luminance(parseHex(bg));
  // Darken when the background is light, lighten when it is dark.
  const toward = bgLum > 0.18 ? 0 : 255;
  let best = rgb;
  for (let step = 0; step <= 255; step++) {
    const cand = rgb.map((v) => Math.round(v + (toward - v) * (step / 255)));
    const hex = '#' + cand.map((v) => v.toString(16).padStart(2, '0')).join('');
    if (contrast(hex, bg) >= target) return hex;
    best = cand;
  }
  return '#' + best.map((v) => v.toString(16).padStart(2, '0')).join('');
}
