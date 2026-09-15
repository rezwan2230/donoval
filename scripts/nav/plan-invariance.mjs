// SHELDON-PAUL-NAV (#227) — TASK 1 PRECONDITION.
//
// THE QUESTION THIS ANSWERS, AND WHY IT IS THE GATE.
//
// `functions/_lib/perch-main.js` injects `<main id="perch-main">` using a plan
// written in `</div>` ORDINALS — "open after the 31st `</div>`, close before the
// 40th". Those ordinals are measured in pass 1 over the buffered response and
// applied in pass 2 as the same bytes stream past a second time. The site nav
// sits INSIDE the div whose end tag is the opening ordinal, so on the face of it
// a nav that gains or loses a `<div>` moves every ordinal after it — and a plan
// applied one `</div>` late puts `<main>` around the wrong region while the page
// still renders perfectly. That is the failure this file exists to refuse.
//
// ── THE TWO READINGS, AND WHY ONLY ONE OF THEM IS THE REAL QUANTITY ──────────
//
// READING A — "substitute the nav in the SOURCE, then re-plan". Take the page
// off disk, replace the `nav.menubar` subtree, and run `planFromHtml` over the
// result. This is what would happen if the nav were rewritten in a pass of its
// own, BEFORE the plan is computed. Under this reading the plan necessarily
// moves by (new nav div count − old nav div count) on every page, because the
// nav's divs close before its container's does. It is reported below, in full,
// and it is NOT the gate — see the next paragraph for why.
//
// READING B — "the plan `_middleware.js` actually computes". The middleware
// buffers the response, calls `planFromHtml(html)` on the ORIGINAL bytes, and
// composes every injector — the container, the layer, the router, the bar, the
// footer line, and now the nav — into ONE second pass over those same original
// bytes. Pass 1 never sees a rewritten nav, so the plan cannot move; and the
// question that actually decides whether the container lands correctly is
// whether pass 2's `</div>` counter still visits the same end tags in the same
// order once a nav rewrite is registered alongside it.
//
// Reading B is the gate because reading B is what ships. Two things could break
// it, and neither is obvious from the source of either module:
//
//   B1. lol-html could stop dispatching handlers for content it has been told to
//       replace. `setInnerContent` removes everything between the nav's start and
//       end tags; if the divs inside the nav no longer fire their `onEndTag`,
//       pass 2's counter runs 31 ahead of the plan pass 1 wrote.
//   B2. lol-html could re-feed INJECTED content through the registered handlers.
//       The replacement nav contains its own `<div>`s; if those were counted,
//       the counter runs behind instead.
//
// Both are measured here against the real engine, on a real page from each nav
// variant and on a real no-nav fragment, and both are measured with a CONTROL
// that proves this harness can SEE a shift — a harness that reports "identical"
// because it is comparing two copies of the same number would pass on a broken
// build, which is the exact shape of vacuous evidence this repo has been bitten
// by before.
//
// Run: node scripts/nav/plan-invariance.mjs
// Exit 0 = reading B holds on every probe and both controls fired. Exit 1 = STOP.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { HTMLRewriter } from '../../test/helpers/html-rewriter.mjs';
import { planFromHtml, injectHandlers } from '../../donovan-legal-site/functions/_lib/perch-main.js';

const SITE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'donovan-legal-site');

/**
 * One real page from each of the three forked nav variants, plus one real no-nav
 * fragment. Chosen from the census in `scripts/nav/variants.mjs`; the variant
 * label records what makes each one different, so a page that stops being
 * representative is visible rather than silently still on the list.
 */
export const PROBES = [
  { file: 'tax-controversy.html', variant: 'A — current chrome, 31 nav divs, full mobile overlay (92 pages)' },
  { file: 'business-formation.html', variant: 'B — old chrome, 25 nav divs, THE FIRM / THE PRACTICE (18 pages)' },
  { file: 'tool-deal-builder.html', variant: 'C — tool chrome, 5 nav divs, no mobile overlay (2 pages)' },
  { file: 'blog-controversy-roadmap-2-exam.html', variant: 'none — no nav.menubar at all (47 fragments)' },
];

/**
 * Two stand-in replacements, deliberately at the extremes of what a real nav
 * could be. The gate is about DIV COUNT, so probing with one replacement that
 * adds many divs and one that removes them all is what makes "the counter did not
 * move" mean something: a rewriter that re-fed injected content would fail the
 * first, and one that skipped replaced content would fail the second.
 */
export const STANDINS = {
  'div-heavy (+40 divs)': `<ul id="menu-desktop">${'<li class="nav-item dropdown"><div class="dropdown-menu"><div class="flyout-item"><div class="flyout-sub"></div></div></div></li>'.repeat(10)}</ul>`,
  'div-free (0 divs)': '<ul id="menu-desktop"><li class="nav-item"><a class="nav-link" href="index.html">HOME</a></li></ul>',
};

/** Replace the inner content of `nav.menubar`, exactly as the injector will. */
function navReplacementHandlers(replacement) {
  let done = false;
  return [['nav.menubar', {
    element(el) {
      if (done) return; // first site nav wins — the mobile overlay nests inside it
      done = true;
      el.setInnerContent(replacement, { html: true });
    },
  }]];
}

/** Run pass 2 exactly as `_middleware.js` does, optionally with the nav rewrite. */
async function runPass2(html, plan, replacement) {
  let rewriter = new HTMLRewriter();
  for (const [selector, handler] of injectHandlers(plan)) rewriter = rewriter.on(selector, handler);
  if (replacement !== null) {
    for (const [selector, handler] of navReplacementHandlers(replacement)) rewriter = rewriter.on(selector, handler);
  }
  return rewriter.transform(new Response(html)).text();
}

/**
 * Where `<main id="perch-main">` opened and closed, expressed in a way that does
 * NOT change when the nav's own bytes change: the count of `</div>` end tags that
 * precede each tag, taken over the region OUTSIDE the nav.
 *
 * Comparing the injected tags' byte offsets directly would be useless — a
 * replacement nav of a different length moves every offset after it by a constant
 * and says nothing about nesting. Counting the `</div>` that precede each tag is
 * the same quantity the plan is written in, so "the tags landed on the same
 * elements" is answered in the plan's own units.
 */
function landingSite(out) {
  const openAt = out.indexOf('<main id="perch-main">');
  const closeAt = out.lastIndexOf('</main>');
  if (openAt === -1 || closeAt === -1) return { present: false };
  const navStart = out.search(/<nav[^>]*class="[^"]*\bmenubar\b/);
  const navEnd = navStart === -1 ? -1 : out.indexOf('</nav>', navStart);
  /** `</div>` before `at`, ignoring any that fall inside the nav's own subtree. */
  const divEndsBefore = (at) => {
    let n = 0;
    const re = /<\/div>/g;
    let m;
    while ((m = re.exec(out)) && m.index < at) {
      if (navStart !== -1 && m.index > navStart && m.index < navEnd) continue;
      n++;
    }
    return n;
  };
  return { present: true, openAfter: divEndsBefore(openAt), closeAfter: divEndsBefore(closeAt) };
}

/** Everything on the page that is NOT the nav subtree, so two runs are comparable. */
function outsideNav(out) {
  const navStart = out.search(/<nav[^>]*class="[^"]*\bmenubar\b/);
  if (navStart === -1) return out;
  // The site nav closes at the LAST </nav> of the run that opened it; the mobile
  // overlay is a nested <nav>, so depth-count rather than take the first match.
  const re = /<\/?nav\b[^>]*>/g;
  re.lastIndex = navStart;
  let depth = 0;
  let m;
  let navEnd = out.length;
  while ((m = re.exec(out))) {
    if (m[0][1] === '/') { depth--; if (depth === 0) { navEnd = m.index + m[0].length; break; } } else depth++;
  }
  return out.slice(0, navStart) + ' NAV ' + out.slice(navEnd);
}

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export async function probe(file, replacement) {
  const html = fs.readFileSync(path.join(SITE, file), 'utf8');

  // READING B — the plan the middleware computes. Same input both times by
  // construction; asserted anyway, because "by construction" is a claim about
  // code that could change under this file without any test noticing.
  const planPlain = await planFromHtml(html, HTMLRewriter);
  const planWithNav = await planFromHtml(html, HTMLRewriter);

  const outPlain = await runPass2(html, planPlain, null);
  const outWithNav = await runPass2(html, planPlain, replacement);

  // READING A — reported, not gated. Re-plan over a source in which the nav has
  // already been substituted, which is what a separate earlier pass would do.
  const substituted = await new HTMLRewriter()
    .on('nav.menubar', navReplacementHandlers(replacement)[0][1])
    .transform(new Response(html)).text();
  const planSubstituted = await planFromHtml(substituted, HTMLRewriter);

  return {
    file,
    planPlain,
    planStable: eq(planPlain, planWithNav),
    planSubstituted,
    substitutedSame: eq(planPlain, planSubstituted),
    landingPlain: landingSite(outPlain),
    landingWithNav: landingSite(outWithNav),
    outsideSame: outsideNav(outPlain) === outsideNav(outWithNav),
    navReplaced: outPlain !== outWithNav,
  };
}

// ── Controls ────────────────────────────────────────────────────────────────
//
// Two, because the two things this harness claims are different claims.
//
// CONTROL 1 proves `landingSite`/`outsideNav` can SEE a misplaced container: the
// plan is deliberately shifted by one `</div>` and the comparison must fail.
// CONTROL 2 proves the run is reaching the nav at all — a probe whose nav was
// never replaced would report "outside identical" for the most boring reason
// there is.

async function controls(file, replacement) {
  const html = fs.readFileSync(path.join(SITE, file), 'utf8');
  const plan = await planFromHtml(html, HTMLRewriter);
  if (plan.kind !== 'wrap-div') return { skipped: `plan is ${plan.kind}, not wrap-div` };

  const shifted = { ...plan, openAfterDivEnd: plan.openAfterDivEnd + 1 };
  const outTrue = await runPass2(html, plan, replacement);
  const outShifted = await runPass2(html, shifted, replacement);
  const sees = !eq(landingSite(outTrue), landingSite(outShifted));

  const outNoNav = await runPass2(html, plan, null);
  const replaced = outNoNav !== outTrue;

  return { sees, replaced };
}

async function main() {
  let bad = 0;
  console.log('SHELDON-PAUL-NAV #227 — TASK 1 PRECONDITION: div-ordinal plan invariance\n');

  for (const [label, replacement] of Object.entries(STANDINS)) {
    console.log(`\n════ stand-in nav: ${label} ════`);
    for (const { file, variant } of PROBES) {
      const r = await probe(file, replacement);
      const p = r.planPlain;
      const ordinals = p.kind === 'wrap-div'
        ? `open@${p.openAfterDivEnd} close@${p.closeBeforeDivEnd}`
        : p.kind === 'wrap-body'
          ? `openKid@${p.openBeforeBodyKid} closeKid@${p.closeBeforeBodyKid}`
          : p.reason || '';
      const okB = r.planStable && r.outsideSame
        && eq(r.landingPlain, r.landingWithNav) && r.landingPlain.present === (p.kind !== 'skip');
      if (!okB) bad++;
      console.log(`  ${okB ? 'PASS' : 'FAIL'}  ${file}`);
      console.log(`        variant   ${variant}`);
      console.log(`        plan      ${p.kind}  ${ordinals}`);
      console.log(`        reading B plan stable ${r.planStable} · landing ${JSON.stringify(r.landingPlain)} → ${JSON.stringify(r.landingWithNav)} · outside-nav bytes identical ${r.outsideSame}`);
      console.log(`        reading A re-planned over substituted source: ${r.substitutedSame ? 'same' : `MOVED → ${JSON.stringify(r.planSubstituted)}`}`);
      console.log(`        nav was actually rewritten: ${r.navReplaced}`);
    }
  }

  console.log('\n════ controls ════');
  for (const [label, replacement] of Object.entries(STANDINS)) {
    const c = await controls('tax-controversy.html', replacement);
    const ok = c.sees && c.replaced;
    if (!ok) bad++;
    console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: harness detects a one-ordinal shift: ${c.sees} · nav genuinely replaced: ${c.replaced}`);
  }

  console.log(`\n${bad === 0 ? 'PRECONDITION HOLDS (reading B).' : `PRECONDITION FAILED on ${bad} probe(s) — STOP.`}`);
  process.exit(bad === 0 ? 0 : 1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) await main();
