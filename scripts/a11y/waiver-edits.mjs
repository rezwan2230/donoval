/**
 * JORDAN-195-LEVELA-WAIVER-R1 — the attribute and inline-colour edits this order
 * ships under a `REVIEWED_STRUCTURAL` waiver, as pure string transforms.
 *
 * ── WHY THIS IS A MODULE AND NOT A PATCH ─────────────────────────────────────
 *
 * The edits live here as transforms so that three things can be said about them
 * with one definition rather than three:
 *
 *   • `apply-waiver-edits.mjs` writes them to disk;
 *   • `waiver-evidence.mjs` re-derives the "after" from `origin/main`'s "before"
 *     and asserts it is BYTE-IDENTICAL to what is on disk — so the waiver request
 *     is about the diff that actually shipped, not about a hypothetical one; and
 *   • the same "before"/"after" pair is fed to the real `planFromHtml` and the
 *     three guards `structuralWaiver` enforces.
 *
 * They were extracted out of `waiver-evidence.mjs` (where JORDAN-195-A11Y-REMEDIATE
 * first wrote them) because that file now has to import them without also running
 * its top-level control and `process.exit`.
 *
 * ── WHAT CHANGED FROM THE §4 DRAFT, AND WHY ──────────────────────────────────
 *
 * The draft transforms in PR #220 were written to SIZE the request, not to ship
 * it. Applying them unchanged would have shipped four defects, each caught by
 * running the result through axe rather than by reading the regex:
 *
 *   1. `svg-img-alt` added `aria-labelledby="dlfig-N"` and never added the
 *      matching `id` to the `<figcaption>`. That is 28 DANGLING references — it
 *      trades one `serious` for one `critical` (`aria-valid-attr-value`) and
 *      leaves the diagram just as unnamed. The transform below writes BOTH
 *      attributes, which is what §4's prose always said it would do.
 *   2. `button-name` gave all three accordion toggles on a page the same generic
 *      label. The defect §4 states is "a screen reader announces 'button' three
 *      times with nothing to tell them apart"; three identical labels satisfies
 *      the axe rule and not the defect. Each label is now taken from the
 *      `.link-yellow` heading in the toggle's own `.card-header`.
 *   3. `color-contrast` DELETED the declaration and let the stylesheet win. On a
 *      light surface that is fine. On the three dark surfaces this site has, the
 *      stylesheet's value is chosen for light and the deletion (or the palette's
 *      darkening) INVERTS the pairing — measured, not feared: gold on the
 *      `#0a5a37` alert band goes 3.69 → 1.53. The transform recolours instead,
 *      through `rewriteDeclaration`, and carries three background-scoped
 *      overrides for the surfaces where the light-surface table does not apply.
 *   4. `aria-required-children` (blog.html, the one remaining critical) was in
 *      §4's tables and in no transform at all, and `nested-interactive` matched
 *      every `svg[width="100%"]` on the site — including eight roadmap diagrams
 *      that do not have the defect. Both are now scoped to the files §4 names.
 *
 * ── THE SCOPE LISTS ARE CLOSED, AND THEY FAIL LOUD ───────────────────────────
 *
 * Every rule below names the exact files it may touch, because the waiver
 * register in `test/chrome-diff.test.mjs` has to name the same set. A hard-coded
 * list can go quietly wrong in two directions, so neither is left to trust:
 * `apply-waiver-edits.mjs` requires every listed file to actually match its rule
 * (a list that has gone stale fails), and it REPORTS every file that matches a
 * rule and is not listed (a sibling page with the same defect is printed, not
 * silently swept in). Those siblings are out of this order's scope on purpose —
 * they are not in the sweep §4 measured, so no waiver entry describes them.
 */

import { rewriteDeclaration } from './palette-195.mjs';

const S = 'donovan-legal-site/';

// ── Scope ────────────────────────────────────────────────────────────────────

/** The eight practice pages whose accordion carries both accordion defects. */
const ACCORDION = [
  'contracts', 'development', 'eminent-domain', 'entity-formation',
  'leasing', 'litigation', 'property-acquisition', 're-financing',
].map((n) => `${S}${n}.html`);

/** The nine pages that ship `<html class="no-js" lang="">`. */
const LANG = [`${S}business-law.html`, ...ACCORDION];

/** The 26 posts carrying an unnamed `role="img"` diagram inside `figure.dlfig`. */
const SVG_FIGURES = [
  'augusta-rule-280a-g', 'character-amount-timing', 'civil-fraud-eggshell-audit',
  'conservation-easement-settlement', 'criminal-tax-overview',
  'currently-not-collectible-csed', 'fbar-foreign-account-penalties',
  'foreclose-federal-tax-lien-suit', 'irs-co-owned-marital-real-estate',
  'irs-levy', 'irs-summons', 'jeopardy-termination-assessments',
  'kwong-covid-deadlines', 'material-participation-seven-tests',
  'notice-of-federal-tax-lien', 'passport-revocation-tax-debt',
  'penalty-regime-6751b', 'per-se-passive-rule-exceptions',
  'real-estate-professional-status-reps', 'short-term-rental-play',
  'subdivision-basis-allocation', 'substitute-for-return', 'tax-opinions',
  'tenancy-by-entirety-federal-tax-lien', 'transferee-nominee-alter-ego',
  'trust-fund-recovery-penalty',
].map((n) => `${S}blog-${n}.html`);

/** The two state-map diagrams that hold real links inside a `role="img"`. */
const MAPS = [`${S}florida-sales-tax-audit.html`, `${S}massachusetts-tax-appeal.html`];

/**
 * The 43 pages carrying an old brand hex inside a `style=""` attribute.
 *
 * This is the §4 table verbatim. It is the one list that is not derived from a
 * defect the sweep saw node-by-node — an inline colour can only be found by
 * reading the source — so `apply-waiver-edits.mjs` re-derives it from the tree
 * and fails if the two disagree.
 */
const INLINE_COLOUR = [
  'book.html', 'contact.html', 'engagement.html', 'home.html', 'index.html',
  'leidy.html', 'membership-diamond.html', 'membership-gold.html',
  'membership-platinum.html', 'membership-reserve.html', 'ourfirm.html',
  'profile.html', 'tefera.html', 'testimonials.html', 'tool-1031-exchange.html',
  'tool-capital-gains.html', 'tool-cost-segregation.html', 'tool-economics.html',
  'tool-entity-formation.html', 'tool-firpta-withholding.html',
  'tool-irs-notice-guide.html', 'tool-oic-rcp-estimator.html',
  'tool-rental-real-estate-tax-strategy-analyzer.html',
  'tool-str-strategy-analyzer.html', 'tools.html', 'wendy.html',
  'diamond/SAMPLE_Multi_Tier_Deal_Package.html',
  'diamond/SAMPLE_Multi_Tier_NY_Publication.html',
  'diamond/SAMPLE_Small_JV_No_Reg_D.html',
  'diamond/tool-1031-exchange.html', 'diamond/tool-operating-agreement.html',
  'diamond/tool-rental-real-estate-tax-strategy-analyzer.html',
  'gold/tool-1031-exchange.html',
  'gold/tool-rental-real-estate-tax-strategy-analyzer.html',
  'members/about-membership.html',
  'platinum/tool-1031-exchange.html',
  'platinum/tool-rental-real-estate-tax-strategy-analyzer.html',
  'reserve/SAMPLE_Multi_Tier_Deal_Package.html',
  'reserve/SAMPLE_Multi_Tier_NY_Publication.html',
  'reserve/SAMPLE_Small_JV_No_Reg_D.html',
  'reserve/tool-1031-exchange.html', 'reserve/tool-operating-agreement.html',
  'reserve/tool-rental-real-estate-tax-strategy-analyzer.html',
].map((n) => `${S}${n}`);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** `REAL ESTATE` → `Real Estate`. The nav headings are set in caps by CSS, not by
 *  meaning, and a screen reader should not spell them out letter by letter. */
function titleCase(text) {
  return text.trim().toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

// ── The dark surfaces the light-surface palette does not describe ────────────
//
// `palette-195.mjs` darkens toward black because it assumes a light background,
// and honours an `a11y:dark-surface` marker to opt a declaration out. There is no
// stylesheet to carry that marker for an inline style, so the marker is written
// into the attribute itself — a CSS comment inside a declaration list, which is
// exactly where the rewriter already looks for it. Re-running the rewrite over an
// already-fixed page is therefore a no-op rather than a re-break.
//
// Each entry names the pairing it was measured on. The ratios come from
// `contrast.mjs`, not from judgement.

const DARK_SURFACE_OVERRIDES = [
  {
    // The "Client Alert" strip: gold "Read more →" on the deep-green band.
    // #C9A961 on #0a5a37 = 3.69 (already failing); the light-surface table would
    // take it to #806633 = 1.53. --dl-gold-on-deep clears it at 4.52.
    what: 'gold link text on the deep-green alert band',
    from: /(\bstyle="[^"]*?\bcolor\s*:\s*)#C9A961(\s*;\s*font-weight\s*:\s*700\s*;\s*font-size\s*:\s*0\.88rem)/gi,
    to: '$1#D5BD85 /* a11y:dark-surface — 4.52:1 on #0a5a37 */$2',
  },
  {
    // The same strip's badge: deep-green text ON the gold chip, 3.69. Gold as a
    // band is deliberately never darkened, so this one is fixed from the text
    // side with --dl-green-on-gold (#084B2E, 4.51).
    what: 'deep-green badge text on the gold chip',
    from: /(\bstyle="background\s*:\s*#C9A961\s*;\s*color\s*:\s*)#0a5a37(\s*;)/gi,
    to: '$1#084B2E /* a11y:dark-surface — 4.51:1 on #C9A961 */$2',
  },
  {
    // The RESERVE black card. #169B62 on #1a1a1a is 4.89 and ALREADY PASSES;
    // darkening it to #107A4D would take it to 3.24. Left at its measured value
    // and marked, so the next run of the palette leaves it alone too.
    what: 'brand-green eyebrow on the RESERVE black card',
    from: /(margin-bottom:\s*0\.6rem;\s*color:\s*)#169B62(;")/gi,
    to: '$1#169B62 /* a11y:dark-surface — 4.89:1 on #1a1a1a */$2',
  },
];

/**
 * Recolour one `style=""` attribute body.
 *
 * The overrides run FIRST and write an `a11y:dark-surface` marker; the palette
 * then skips any declaration carrying one. Order matters and is the whole
 * mechanism, so it is asserted by `waiver-edits` unit coverage rather than left
 * as a comment.
 */
function recolourStyleBody(body) {
  return body.replace(/(^|;)(\s*)([-a-zA-Z]+)(\s*:\s*)([^;]*)/g,
    (whole, lead, ws, prop, sep, value) => {
      if (!/#[0-9a-fA-F]{6}\b/.test(value)) return whole;
      return `${lead}${ws}${prop}${sep}${rewriteDeclaration(prop, value)}`;
    });
}

// ── The edits ────────────────────────────────────────────────────────────────

export const EDITS = [
  {
    rule: 'html-has-lang',
    files: LANG,
    // `<html class="no-js" lang="">` — present but EMPTY. One attribute value.
    apply: (s) => s.replace(/(<html\b[^>]*?)\slang=""/i, '$1 lang="en"'),
  },

  {
    rule: 'aria-valid-attr-value',
    files: ACCORDION,
    // Repoint each toggle at the panel it actually opens; the panel id is already
    // on the same tag in `data-target="#fl-insideN"`.
    apply: (s) => s.replace(
      /(<button\b[^>]*?data-target="#(fl-inside\d)"[^>]*?)aria-controls="collapseOne"/g,
      (m, head, id) => `${head}aria-controls="${id}"`,
    ),
  },

  {
    rule: 'button-name',
    files: ACCORDION,
    // Name each toggle after the section it opens. The name is not invented: it is
    // the `.link-yellow` heading sitting beside the toggle in the same
    // `.card-header`, so the label and the visible text cannot drift apart.
    apply: (s) => s.replace(
      /(<div class="card-header" id="headingOne">[\s\S]*?<\/div>)/g,
      (block) => {
        const heading = block.match(/class="link-yellow">([^<]*)</);
        if (!heading) return block;
        return block.replace(
          /(<button\b(?![^>]*aria-label)[^>]*?data-target="#fl-inside\d"[^>]*?)(>)/,
          (m, head, close) => `${head} aria-label="Show ${titleCase(heading[1])} practice areas"${close}`,
        );
      },
    ),
  },

  {
    rule: 'select-name',
    files: [`${S}tool-capital-gains.html`],
    // The visible `<label>` beside it carries no `for`, so nothing wires them
    // together. The accessible name is that label's own words.
    apply: (s) => s.replace(/<select id="niit">/,
      '<select id="niit" aria-label="Net Investment Income Tax (3.8%)">'),
  },

  {
    rule: 'nested-interactive',
    files: MAPS,
    // The state map holds eight real `<a href>` stations. `role="img"` asserts it
    // is one indivisible graphic, which is why axe reports "element has focusable
    // descendants". `role="group"` is the role that admits them, and the
    // `aria-labelledby` already on the tag keeps naming it.
    //
    // MEASURED, NOT ASSUMED — and not what §4 proposed. §4's draft edit was
    // `focusable="false"` on the `<svg>`. Run through the real axe on
    // `/florida-sales-tax-audit`, that leaves `nested-interactive` at 1 node:
    // the attribute is an IE-era hint and does nothing to a descendant `<a href>`.
    // `role="group"` takes the page to zero and introduces no `aria-allowed-role`.
    //
    // THE MATCH IS ON THE WHOLE ELEMENT, NOT THE OPEN TAG. Eight roadmap posts
    // also draw a `role="img"` diagram at `width="100%"`, and they do NOT have
    // this defect — nothing inside them is focusable. Requiring an `<a href>`
    // descendant is what keeps this edit off those pages instead of relying on
    // the scope list to catch it afterwards.
    apply: (s) => s.replace(
      /<svg\b[^>]*\bwidth="100%"[\s\S]*?<\/svg>/g,
      (svg) => (/<a\s[^>]*href=/.test(svg)
        ? svg.replace(/(<svg\b[^>]*?)role="img"/, '$1role="group"')
        : svg),
    ),
  },

  {
    rule: 'aria-required-children',
    files: [`${S}blog.html`],
    // `role="tablist"` requires `role="tab"` children and these are plain buttons
    // that filter a list in place — there are no tabpanels to switch between.
    // `role="group"` admits them and keeps the container's own aria-label.
    apply: (s) => s.replace(
      /(<div class="blog-filter" )role="tablist"/,
      '$1role="group"',
    ),
  },

  {
    rule: 'svg-img-alt',
    files: SVG_FIGURES,
    // Wire the diagram to the `<figcaption>` that already describes it: an `id` on
    // the caption, `aria-labelledby` on the `<svg>`. Two attributes; no element is
    // added, removed, re-nested or re-ordered. Both halves are written in the same
    // pass so a dangling reference is not representable.
    apply: (s) => {
      let n = 0;
      return s.replace(/<figure class="dlfig">([\s\S]*?)<\/figure>/g, (whole, body) => {
        if (!/<svg\b(?![^>]*aria-label)(?=[^>]*role="img")/.test(body)) return whole;
        if (!/<figcaption>/.test(body)) return whole;
        const id = `dlfig-${++n}`;
        const named = body
          .replace(/<svg\b(?![^>]*aria-label)(?=[^>]*role="img")([^>]*?)>/,
            (m, attrs) => `<svg${attrs} aria-labelledby="${id}">`)
          .replace(/<figcaption>/, `<figcaption id="${id}">`);
        return `<figure class="dlfig">${named}</figure>`;
      });
    },
  },

  {
    rule: 'color-contrast',
    files: INLINE_COLOUR,
    // Recolour, never delete. Deleting the declaration hands the element to
    // whatever the cascade offers next, which on the three dark surfaces below is
    // a colour chosen for a light one.
    apply: (s) => {
      let out = s;
      for (const o of DARK_SURFACE_OVERRIDES) out = out.replace(o.from, o.to);
      return out.replace(/\bstyle="([^"]*)"/g, (m, body) => {
        const next = recolourStyleBody(body);
        return next === body ? m : `style="${next}"`;
      });
    },
  },
];

/** Every file this order edits, in the order the register lists them. */
export const SCOPE = [...new Set(EDITS.flatMap((e) => e.files))].sort();

/** Apply every edit whose scope includes `file` to that file's source. */
export function applyAll(file, source) {
  const key = file.replace(/\\/g, '/');
  let out = source;
  const applied = [];
  for (const e of EDITS) {
    if (!e.files.includes(key)) continue;
    const next = e.apply(out);
    if (next !== out) applied.push(e.rule);
    out = next;
  }
  return { after: out, applied };
}

export { ACCORDION, LANG, SVG_FIGURES, MAPS, INLINE_COLOUR, DARK_SURFACE_OVERRIDES };
