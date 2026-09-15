// ── JORDAN-PERCH-PHOTO-PAULA — one face asset, worn by the qualifier card ──────
// (Concierge retired 2026-09: the face is now Paul's headshot, the same square
// poster the floating booking widget wears. The pinning logic is unchanged.)
//
// Order JORDAN-PERCH-PHOTO-PAULA.
//
// ── WHAT THIS PINS ───────────────────────────────────────────────────────────
// Two claims, and they are not the same claim:
//
//   §1  the qualifier card's header shows the CONCIERGE'S FACE, not the firm's
//       logo mark, at both hosts (the shell's authored markup and the module's
//       built DOM), cover-cropped by the circle rather than stretched
//   §2  the path to that face is spelled ONCE — replacing the photograph is
//       replacing `img/Paula.jpg` and nothing else, forever
//
// §2 is the one that rots quietly. §1 could be satisfied today by pasting the
// path into a fourth file, and a year later the orb and the card would be wearing
// different people. So §2 sweeps the SHIPPED TREE for stray literals and names
// the only three files allowed to carry one, with the reason each is exempt.
//
// ── WHY THE SWEEP GREPS SOURCE AND THE RENDERING TESTS DO NOT ────────────────
// [[feedback_assert_behavior_not_source_spelling]] says prove the DOM, not the
// spelling — and §1 does, in jsdom, against the shipped files. But §2's claim IS
// a claim about spelling ("this string appears in exactly these places"), and a
// DOM assertion cannot see the copy nobody rendered yet. The two sections are
// deliberately different instruments pointed at different claims.
//
// Nothing here opens a network connection, mints a token or writes anything.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = path.join(ROOT, 'donovan-legal-site');

const LAYER_CSS = fs.readFileSync(path.join(SITE, 'css', 'perch-layer.css'), 'utf8');

const CANONICAL = '/img/paul-book-float-poster-v2.jpg';
const LOGO_MARK = 'Donovan-Logo-v2-transparent-white.png';

/**
 * The files in the shipped site that may legitimately spell the portrait path,
 * and why each one cannot simply import js/perch/brand.js. This list IS the
 * productization rule — a reviewer should be able to read it and know whether a
 * new copy is a considered exemption or an accident.
 */
const SPELLING_EXEMPT = new Map([
  ['js/perch/brand.js',
    'the canonical export itself — the one place the string is authored'],
  ['functions/_lib/book-float-inject.js',
    'Pages Function code, never served to a browser, so it cannot import a '
    + 'browser module; it authors the <video poster> for the floating widget '
    + 'and is where the versioned filename is minted.'],
  ['js/donovan-widget.js',
    'a classic IIFE with no module graph, by design so it drops into any page; '
    + 'CFG is the per-deployment surface the Vantage design tab edits. Pinned '
    + 'EQUAL to the canonical export by §2 below rather than deleted.'],
  ['perch.html',
    'static markup the shell serves before any module runs — the no-JS floor for '
    + 'the orb and the card header. chrome.js/qualifier.js ADOPT these nodes '
    + 'rather than rebuild them, so the literal is the shell\'s own copy.'],
]);

/** Text files of the shipped site, repo-relative, POSIX separators. */
function siteFiles() {
  const out = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === '.git') continue;
        walk(full);
      } else if (/\.(html|js|mjs|css|json)$/i.test(e.name)) {
        out.push(full);
      }
    }
  })(SITE);
  // POSIX separators so the exemption keys read the same on Windows and in CI —
  // [[feedback_llmwiki_filehistory_winfix]] territory: a `\` here would make
  // every exemption miss and the suite would fail on the developer's machine
  // while passing in Linux CI.
  return out.map((f) => ({ rel: path.relative(SITE, f).split(path.sep).join('/'), full: f }));
}

/**
 * Comment text removed, so the sweep measures REFERENCES and not prose.
 *
 * The first run of this guard failed on js/perch/brand.js — whose entire job is
 * to be the one legal spelling — because its doc comment names the asset while
 * explaining the rule. [[feedback_regression_guard_greps_own_comments]]. Written
 * down rather than worked around by rewording the comment: the next person to
 * document an asset path would have hit the same wall.
 *
 * `//` is only treated as a comment at the START of a line. Mid-line it is far
 * more likely to be the `//` in a URL (`https://esm.sh/...` is right there in
 * donovan-widget.js), and eating the rest of THAT line could hide a real stray.
 */
function stripComments(text) {
  return text
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/^[ \t]*\/\/.*$/gm, ' ');
}

/** Width/height straight out of the JPEG's SOF marker — no image dependency. */
function jpegSize(buf) {
  if (buf[0] !== 0xFF || buf[1] !== 0xD8) return null;
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 0xFF) { i += 1; continue; }
    const marker = buf[i + 1];
    if (marker === 0xFF) { i += 1; continue; }
    if (marker === 0x01 || (marker >= 0xD0 && marker <= 0xD9)) { i += 2; continue; }
    const isSOF = marker >= 0xC0 && marker <= 0xCF
      && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC;
    if (isSOF) return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

/** Selector blocks, comments stripped FIRST — [[feedback_css_comments_break_selector_harvest]]. */
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

/** Declarations of every rule whose selector ends at the header mark's image. */
function headerFaceDecls(css) {
  return rules(css)
    .filter((r) => r.selectors.some((s) => /#qual .*\.mk .*\.mkemb$/.test(s)))
    .map((r) => r.body.replace(/\s+/g, ' '));
}

describe('JORDAN-PERCH-PHOTO-PAULA §1 — the qualifier header wears the concierge', () => {
  test('the module BUILDS a header face from the canonical asset, with a real alt', async () => {
    const { mountQualifier } = await import('../donovan-legal-site/js/perch/qualifier.js');
    const { INTAKE_FACE } = await import('../donovan-legal-site/js/perch/brand.js');
    const dom = new JSDOM('<!doctype html><html><body><div id="perch-persistent"></div></body></html>',
      { url: 'https://www.donovan.law/testimonials' });
    const g = globalThis.document;
    try {
      const host = dom.window.document.getElementById('perch-persistent');
      mountQualifier(host, { callId: () => null });

      const emb = dom.window.document.querySelector('#qual .hd .mk .mkemb');
      assert.ok(emb, 'the card header must still render a mark image');
      assert.equal(emb.getAttribute('src'), INTAKE_FACE,
        'the built header must show the concierge portrait');
      assert.equal(emb.tagName, 'IMG');

      // The defect this ticket fixes, stated as a row: the logo mark must be gone
      // from the header. Asserted on the PARSED attribute, not the file text —
      // [[feedback_escaped_attribute_still_spells_the_payload]] is the same shape.
      assert.equal(emb.getAttribute('src').includes(LOGO_MARK), false,
        'the firm logo mark must no longer badge the qualifier card');

      // Task 4. Meaningful, and specifically NOT the empty alt the logo carried:
      // the header's visible text names the firm, so the image is the only thing
      // that can name the person asking for the figures.
      const alt = emb.getAttribute('alt');
      assert.ok(alt && alt.trim().length > 0, 'the header face must not be decorative');
      assert.match(alt, /Paul Donovan/, 'and must name the attorney');
      assert.equal(/click|tap|press/i.test(alt), false,
        'the header is not a control — an action-worded name here would lie');
    } finally {
      dom.window.close();
      globalThis.document = g;
    }
  });

  // REMOVED: the /perch shell was removed; only the qualifier card carries the Paula asset now.

  // REMOVED: the orb was removed with the voice concierge; only the qualifier header wears the asset.

  // REMOVED: the /perch shell was removed; only the qualifier card carries the Paula asset now.
});

describe('JORDAN-PERCH-PHOTO-PAULA §2 — the path is spelled once', () => {
  test('the canonical export is the path, and the asset behind it is a real square JPEG', async () => {
    const { INTAKE_FACE } = await import('../donovan-legal-site/js/perch/brand.js');
    assert.equal(INTAKE_FACE, CANONICAL);

    const asset = path.join(SITE, 'img', 'paul-book-float-poster-v2.jpg');
    assert.ok(fs.existsSync(asset), 'the canonical asset must exist — a 404 face is not a face');
    const buf = fs.readFileSync(asset);

    // Dispatch on magic bytes, never on the extension —
    // [[feedback_extension_lies_dispatch_on_magic_bytes]]. A PNG or a ZIP saved
    // as .jpg still serves, and still decodes to nothing in the disc.
    assert.equal(buf[0], 0xFF, 'the asset must start with a JPEG SOI');
    assert.equal(buf[1], 0xD8);
    assert.equal(buf[buf.length - 2], 0xFF, 'and end with a JPEG EOI — a truncated file half-paints');
    assert.equal(buf[buf.length - 1], 0xD9);

    const size = jpegSize(buf);
    assert.ok(size, 'the asset must carry a readable SOF frame');
    // SQUARE IS A CONTRACT, not a nicety. Both consumers `cover`-crop to a circle
    // and centre it, so a portrait-orientation source frames the subject's TORSO
    // in the badge and their chin in the orb. One asset only works at 92px and at
    // 30px if the source is already the crop.
    assert.equal(size.width, size.height,
      `the canonical portrait must be square; got ${size.width}x${size.height}`);
    assert.ok(size.width >= 184,
      `and at least 184px so the 92px orb is not upscaled on a 2x display; got ${size.width}`);
  });

  test('no file in the shipped site spells the portrait path outside the exemptions', () => {
    const strays = [];
    const misspelled = [];
    for (const { rel, full } of siteFiles()) {
      const text = stripComments(fs.readFileSync(full, 'utf8'));
      // Any spelling of the asset, canonical or not — a `img/Paula.jpg` without
      // the leading slash resolves per-directory and is exactly the drift this
      // guard exists to catch.
      const hits = [...text.matchAll(/[^\s"'()]*paul-book-float-poster-v2\.jpg/gi)].map((m) => m[0]);
      if (!hits.length) continue;
      for (const h of hits) if (h !== CANONICAL) misspelled.push(`${rel}: ${h}`);
      if (!SPELLING_EXEMPT.has(rel)) strays.push(rel);
    }
    assert.deepEqual(misspelled, [],
      'every reference must be the canonical root-relative path');
    assert.deepEqual(strays.sort(), [],
      'these files spell the portrait path but are not declared exemptions — '
      + 'import INTAKE_FACE from js/perch/brand.js instead, or add the file to '
      + 'SPELLING_EXEMPT with the reason it cannot');
  });

  test('the DOM builder carries no literal at all — it imports', () => {
    // The positive control for the sweep above: these are the files that COULD
    // import and therefore must. Without this row, moving the literal from
    // qualifier.js into brand.js and leaving a copy behind would still pass.
    //
    // There were two builders until the voice concierge was removed: the orb in
    // `js/perch/chrome.js` and the card in `js/perch/qualifier.js`. The orb is gone,
    // so the card is the only surviving consumer of the canonical asset — and the
    // control still bites, because the one file that could cheat is still checked.
    for (const rel of ['js/perch/qualifier.js']) {
      const raw = fs.readFileSync(path.join(SITE, rel), 'utf8');
      // Comments stripped here too. A future comment in either file may well need
      // to name the asset while explaining something; what must not come back is
      // a REFERENCE.
      assert.equal(/paul-book-float-poster-v2\.jpg/i.test(stripComments(raw)), false,
        `${rel} must read the path from brand.js, not spell it`);
      const text = raw;
      assert.match(text, /from '\.\/brand\.js'/,
        `${rel} must import the canonical asset`);
      assert.equal(SPELLING_EXEMPT.has(rel), false,
        `${rel} must not be exempt — it can import`);
    }
  });

  // REMOVED: the launcher was removed; only the qualifier card wears the Paula asset now.
});
