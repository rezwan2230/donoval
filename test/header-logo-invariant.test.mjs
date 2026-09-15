// ── JORDAN-SITE-UX-FIXES-R1 · Task 1 — one logo, one size, every page type ────
//
// ── THE DEFECT ───────────────────────────────────────────────────────────────
//
// The firm's mark rendered at 150 CSS pixels across the ~100 site pages and at 34
// on all four member portals — a fifth of the size, on the four pages a paying
// member spends their time on. Nothing was broken and nothing was reported,
// because the two headers are two different pieces of markup with two different
// stylesheets and neither one is wrong on its own:
//
//     site pages   <div class="logo"><a><img class="logo" src="img/base-hover.png">
//                  css/main.css:  .logo { max-width: 150px }   img { height: auto }
//
//     portals      <a class="phead-logo"><img src="../img/base-hover.png">
//                  inline <style>: .phead-logo img { height: 34px; width: auto }
//
// The portals load no `main.css` at all, so there was never a shared declaration
// for the two to disagree about. The divergence could only be seen by rendering
// both and looking, which is exactly the class of defect that survives a green
// build. This file is the shared declaration the stylesheets do not have.
//
// ── WHAT IT ASSERTS, AND WHY IT IS NOT A COPY OF THE CSS ─────────────────────
//
// Nothing here names 150px. It reads every page's OWN stylesheets, resolves the
// cascade onto that page's own header logo element, and requires the answer to be
// the same object for every page type. A future change that moves the site logo to
// 120px and the portals with it passes; a change that moves one of them reds. The
// test knows what "the same" means, not what the value is —
// [[feedback_assert_behavior_not_source_spelling]].
//
// Three properties of the logo are held equal across the sample:
//
//   1. SIZE     — the resolved width/height/max-*/min-* declarations. jsdom has no
//                 layout engine (`offsetWidth` is 0 for everything), so the
//                 comparable is the declared box, which is what the divergence
//                 actually was.
//   2. SRC      — resolved against each page's own URL, because the three spellings
//                 in the tree (`img/…`, `/img/…`, `../img/…`) are the same asset
//                 only if the page's depth agrees with the prefix. A portal page
//                 that moved down a directory and kept `../` would silently point
//                 at a 404, and the alt text would be the only thing left.
//   3. POSITION — the logo leads its header. Asserted as "every step from the
//                 header region down to the <img> is a first child", not as a fixed
//                 depth: the membership marketing page nests its header seven
//                 levels deep and the portals three, and the invariant David asked
//                 for is that the mark sits at the head of the bar, not that the
//                 markup around it is identical.
//
// ── THE CONTROL ──────────────────────────────────────────────────────────────
//
// §3 feeds the resolver the portal rule as it shipped BEFORE this ticket and
// requires it to come out different. Without it the whole file could be passing
// because the resolver returns `{}` for everything —
// [[feedback_fixture_must_reproduce_the_defect]].

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SITE = path.join(HERE, '..', 'donovan-legal-site');
const ORIGIN = 'https://www.donovan.law';

/**
 * A sample of each page type the order names, plus the booking page.
 *
 * One home page, three content pages of different shapes (a blog post, the contact
 * page, a practice page), the membership marketing pages in both of their two
 * layouts, and all FOUR member portals — the four are listed individually rather
 * than sampled, because they are the four that were wrong and a sample of one
 * would let the other three drift back.
 */
const SAMPLE = [
  { type: 'home', page: 'index.html' },
  { type: 'content', page: 'blog-irs-levy.html' },
  { type: 'content', page: 'contact.html' },
  { type: 'content', page: 'practice.html' },
  { type: 'booking', page: 'book.html' },
  { type: 'membership marketing', page: 'about-membership.html' },
  { type: 'membership marketing', page: 'membership-gold.html' },
  { type: 'membership marketing', page: 'membership-diamond.html' },
  { type: 'membership marketing', page: 'membership-platinum.html' },
  { type: 'membership marketing', page: 'membership-reserve.html' },
  { type: 'membership marketing', page: 'members/about-membership.html' },
  { type: 'member portal', page: 'diamond/index.html' },
  { type: 'member portal', page: 'gold/index.html' },
  { type: 'member portal', page: 'platinum/index.html' },
  { type: 'member portal', page: 'reserve/index.html' },
];

/** The declarations that decide how big the mark is drawn. */
const SIZE_PROPS = ['width', 'height', 'max-width', 'max-height', 'min-width', 'min-height'];

// ── A very small CSS cascade, over the properties above ──────────────────────

/**
 * Strip comments, then drop every at-rule together with its block.
 *
 * Comments go FIRST and unconditionally: a commented-out rule that still contains
 * a `{` splits the remaining text at the wrong brace and the harvest silently
 * reads selectors that are not selectors —
 * [[feedback_css_comments_break_selector_harvest]].
 *
 * At-rules are dropped rather than resolved because every one of them in this tree
 * is either conditional (`@media`) or not a rule at all (`@font-face`,
 * `@keyframes`). The comparison is therefore over the BASE cascade — the box the
 * logo has at a desktop width, which is the one the defect was visible at. The
 * responsive step is real (`main.css` narrows `.logo` to 140px under 576px) and it
 * is deliberately out of scope: the portals have no equivalent breakpoint for the
 * mark, so folding it in would compare a rule against its own absence.
 */
function baseRules(css) {
  const text = String(css).replace(/\/\*[\s\S]*?\*\//g, '');
  const rules = [];
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (ch === '@') {
      // Skip to this at-rule's terminator: a balanced block, or a bare `;`.
      let j = i;
      while (j < text.length && text[j] !== '{' && text[j] !== ';') j++;
      if (text[j] === ';' || j >= text.length) { i = j + 1; continue; }
      let depth = 0;
      for (; j < text.length; j++) {
        if (text[j] === '{') depth++;
        else if (text[j] === '}') { depth--; if (depth === 0) { j++; break; } }
      }
      i = j;
      continue;
    }
    if (/\s/.test(ch)) { i++; continue; }
    const open = text.indexOf('{', i);
    if (open === -1) break;
    const close = text.indexOf('}', open);
    if (close === -1) break;
    rules.push({ selectors: text.slice(i, open).trim(), body: text.slice(open + 1, close) });
    i = close + 1;
  }
  return rules;
}

/** (#id, .class/[attr]/:pseudo-class, element/::pseudo-element) for one selector. */
function specificity(sel) {
  const s = sel.replace(/\[[^\]]*\]/g, '[]');
  const ids = (s.match(/#[\w-]+/g) || []).length;
  const classes = (s.match(/\.[\w-]+/g) || []).length
    + (s.match(/\[\]/g) || []).length
    + (s.match(/(^|[^:]):[\w-]+/g) || []).length;
  const types = (s.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length
    + (s.match(/::[\w-]+/g) || []).length;
  return ids * 10000 + classes * 100 + types;
}

/** Declarations in one rule body, as `{prop: {value, important}}`. */
function declarations(body) {
  const out = {};
  for (const chunk of body.split(';')) {
    const at = chunk.indexOf(':');
    if (at === -1) continue;
    const prop = chunk.slice(0, at).trim().toLowerCase();
    if (!SIZE_PROPS.includes(prop)) continue;
    let value = chunk.slice(at + 1).trim();
    const important = /!\s*important$/i.test(value);
    if (important) value = value.replace(/!\s*important$/i, '').trim();
    out[prop] = { value: value.toLowerCase(), important };
  }
  return out;
}

/**
 * Resolve the size declarations that apply to `el`, given the page's stylesheets
 * in document order.
 *
 * `!important` beats everything, then specificity, then source order — the real
 * cascade, restricted to the six properties above. Selector lists are split on the
 * comma and each part matched on its own, which is how `img, svg, video, iframe,
 * table { max-width: 100% }` in main.css is allowed to reach an <img> at all.
 */
function resolveBox(el, sheets) {
  const won = {};
  let order = 0;
  for (const css of sheets) {
    for (const rule of baseRules(css)) {
      const decls = declarations(rule.body);
      if (!Object.keys(decls).length) { order++; continue; }
      let best = -1;
      for (const part of rule.selectors.split(',')) {
        const sel = part.trim();
        if (!sel) continue;
        let hit = false;
        try { hit = el.matches(sel); } catch (e) { hit = false; }
        if (hit) best = Math.max(best, specificity(sel));
      }
      order++;
      if (best < 0) continue;
      for (const [prop, d] of Object.entries(decls)) {
        const prev = won[prop];
        const beats = !prev
          || (d.important && !prev.important)
          || (d.important === prev.important && (best > prev.spec || (best === prev.spec && order > prev.order)));
        if (beats) won[prop] = { value: d.value, important: d.important, spec: best, order };
      }
    }
  }
  const box = {};
  for (const prop of SIZE_PROPS) if (won[prop]) box[prop] = won[prop].value;
  return box;
}

/**
 * Every stylesheet a page applies, in document order.
 *
 * Same-origin files only. The Google Fonts <link> on most of these pages is not
 * fetched — a test that reached the network would be a different kind of test, and
 * a font sheet declares no box.
 */
function sheetsFor(page, doc) {
  const dir = path.dirname(path.join(SITE, page));
  const out = [];
  for (const node of doc.querySelectorAll('link[rel~="stylesheet"], style')) {
    if (node.tagName === 'STYLE') { out.push(node.textContent || ''); continue; }
    const href = node.getAttribute('href') || '';
    if (/^(https?:)?\/\//.test(href)) continue;
    const clean = href.split('?')[0].split('#')[0];
    const file = clean.startsWith('/') ? path.join(SITE, clean.slice(1)) : path.join(dir, clean);
    if (!fs.existsSync(file)) continue;
    out.push(fs.readFileSync(file, 'utf8'));
  }
  return out;
}

/**
 * The header logo of one page: the first <img> inside the page's header landmark.
 *
 * Deliberately NOT located by class or by src. `img.logo` would miss the portals
 * (whose image carries no class) and `src*="base-hover"` would presuppose the very
 * asset §2 is checking. "The first image in the header" is the reader's definition
 * of the header logo and it is the one that works on every shape in this tree.
 */
function headerLogo(page) {
  const html = fs.readFileSync(path.join(SITE, page), 'utf8');
  const url = `${ORIGIN}/${page.replace(/index\.html$/, '')}`;
  const dom = new JSDOM(html, { url });
  const doc = dom.window.document;
  const region = doc.querySelector('header, nav');
  assert.ok(region, `${page}: no <header> or <nav> — the page has no header to hold a logo`);
  const img = region.querySelector('img');
  assert.ok(img, `${page}: the header contains no <img>`);

  const chain = [];
  for (let n = img; n && n !== region; n = n.parentElement) {
    chain.push([...n.parentElement.children].indexOf(n));
  }

  return {
    page,
    box: resolveBox(img, sheetsFor(page, doc)),
    src: new dom.window.URL(img.getAttribute('src'), url).pathname,
    leadsHeader: chain.every((i) => i === 0),
    chain: chain.reverse(),
  };
}

const LOGOS = SAMPLE.map((s) => ({ ...s, ...headerLogo(s.page) }));
const HOME = LOGOS[0];

// ─────────────────────────────────────────────────────────────────────────────
// §1 · The invariant
// ─────────────────────────────────────────────────────────────────────────────

describe('§1 — the header logo is the same logo on every page type', () => {
  test('the sample covers every page type the order names', () => {
    const types = new Set(LOGOS.map((l) => l.type));
    for (const want of ['home', 'content', 'booking', 'membership marketing', 'member portal']) {
      assert.ok(types.has(want), `no ${want} page in the sample`);
    }
    assert.equal(LOGOS.filter((l) => l.type === 'member portal').length, 4,
      'all four member portals are sampled individually — a sample of one lets three drift');
  });

  test('the home page resolves a real box, so the comparison has something to compare', () => {
    // A resolver that silently returned {} would make every equality below hold.
    assert.ok(Object.keys(HOME.box).length > 0,
      'no size declaration resolved onto the home page logo at all');
  });

  for (const logo of LOGOS.slice(1)) {
    test(`${logo.page} (${logo.type}) — same declared box as the home page`, () => {
      assert.deepEqual(logo.box, HOME.box,
        `the header logo on ${logo.page} is drawn to a different box than ${HOME.page}.\n`
        + `  ${HOME.page}: ${JSON.stringify(HOME.box)}\n`
        + `  ${logo.page}: ${JSON.stringify(logo.box)}`);
    });
  }

  for (const logo of LOGOS.slice(1)) {
    test(`${logo.page} (${logo.type}) — same resolved src as the home page`, () => {
      assert.equal(logo.src, HOME.src,
        `${logo.page} points its header logo at ${logo.src}, not ${HOME.src}. `
        + 'The three relative spellings in this tree resolve to one asset only while '
        + 'each page\'s prefix agrees with its own depth.');
    });
  }

  for (const logo of LOGOS) {
    test(`${logo.page} (${logo.type}) — the logo leads the header`, () => {
      assert.equal(logo.leadsHeader, true,
        `the header logo on ${logo.page} is not the first thing in its header `
        + `(child indices from the header down to the image: ${JSON.stringify(logo.chain)})`);
    });
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// §2 · The portals specifically
// ─────────────────────────────────────────────────────────────────────────────

describe('§2 — the four portals no longer disagree with the site', () => {
  test('every portal declares the same box as every other portal', () => {
    const portals = LOGOS.filter((l) => l.type === 'member portal');
    for (const p of portals.slice(1)) {
      assert.deepEqual(p.box, portals[0].box, `${p.page} disagrees with ${portals[0].page}`);
    }
  });

  test('and it is the site box, not a portal-only one', () => {
    const portal = LOGOS.find((l) => l.type === 'member portal');
    assert.deepEqual(portal.box, HOME.box);
    // The specific reversal: a fixed pixel HEIGHT is what made the mark small, and
    // no page type may reintroduce one on its own.
    assert.equal(/^\d/.test(portal.box.height || ''), false,
      'a fixed pixel height on the header logo is what this ticket removed');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §3 · The control — the resolver can tell the defect apart from the fix
// ─────────────────────────────────────────────────────────────────────────────

describe('§3 — the comparison bites', () => {
  // The portal rule EXACTLY as it shipped before this ticket. If the resolver
  // cannot tell this apart from the fixed one, §1 proves nothing at all.
  const SHIPPED_DEFECT = '.phead-logo img{height:34px;width:auto;display:block}';

  function boxFromRule(rule) {
    const dom = new JSDOM(
      '<!doctype html><html><body><header class="phead"><div class="wrap">'
      + '<a class="phead-logo" href="index.html"><img src="../img/base-hover.png" alt="logo"></a>'
      + '</div></header></body></html>',
      { url: `${ORIGIN}/diamond/` },
    );
    const img = dom.window.document.querySelector('.phead-logo img');
    return resolveBox(img, [rule]);
  }

  test('the pre-fix portal rule resolves to a DIFFERENT box than the site', () => {
    const before = boxFromRule(SHIPPED_DEFECT);
    assert.deepEqual(before, { width: 'auto', height: '34px' },
      'the resolver did not read the shipped defect as written');
    assert.notDeepEqual(before, HOME.box,
      'the resolver reports the 34px portal logo and the 150px site logo as the same box — '
      + '§1 would pass whatever the stylesheets said');
  });

  test('a rule that matches nothing contributes nothing', () => {
    // Guards the other direction: a resolver that ignored selectors would report
    // every declaration it read, and §1 would fail for the wrong reason forever.
    assert.deepEqual(boxFromRule('.no-such-thing img{height:99px}'), {});
  });
});
