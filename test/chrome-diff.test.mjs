// SARAH-CHROME-DIFF-R2 — the content lane's guard rail.
//
// WHAT THIS IS FOR, IN ONE PARAGRAPH. Paul comments `@claude` on a GitHub issue and
// Claude opens a pull request that edits a page. That is a good way to change
// WORDING. It is a dangerous way to change MARKUP, because five specific markup
// changes break the site without breaking anything a reader would notice in the
// diff, and without turning any existing test red. This file compares the BEFORE
// and AFTER of every page the pull request touches and fails the build when the
// change is not purely a change of wording.
//
// ── WHY MARKUP IS DANGEROUS HERE AND WORDING IS NOT ──────────────────────────
//
// `donovan-legal-site/functions/_middleware.js` does not serve these pages as
// authored. As each page streams out it injects four things a page file never
// mentions: the router's swap container `<main id="perch-main">`, the persistent
// layer that holds the live call, the Swup router itself, and the click-to-call
// booking bar. Where those go is decided by `_lib/perch-main.js`, which READS THE
// PAGE and works out the answer in ordinals — "open the container after the 1st
// `</div>`, close it before the 5th". It reads the page because the 143 pages here
// share no common region: 92 bury the site nav four levels deep, 3 use a
// body-level `<header>`, 47 have no site nav at all, 15 already ship a `<main>`.
//
// So the decision is a function of the page's shape. Change the shape and the
// answer changes — silently, because every one of these failures still produces a
// page that renders:
//
//   • Add a `<main>`      → the plan flips from "wrap the content" to "stamp the
//                           page's own main", and the region that gets swapped is
//                           now whatever that main happens to contain.
//   • Add `<div id="concierge">` → the page is mistaken for the concierge SHELL and
//                           skipped outright. No container, no layer, no router,
//                           no booking bar. The page still looks perfect.
//   • Move markup across `div.container` → the ordinals still resolve, so a
//                           `main#perch-main` still exists and an "is the container
//                           there" check still passes — but it now wraps the
//                           copyright line instead of the article. (The trap suite
//                           at the bottom of this file demonstrates exactly that,
//                           with the real rewriter: 266 characters of content
//                           inside the container before the move, 40 after.)
//   • Change a `<script src>` / `<link href>` → the booking bar and the voice
//                           concierge are loaded by those tags. Drop one and the
//                           feature is simply gone.
//   • Add an `onclick=`   → the CSP issued by the middleware admits inline script
//                           only by per-request nonce, and a nonce cannot apply to
//                           an attribute. The handler never runs. Dead button.
//
// None of that is visible in a pull-request diff that reads like an improvement to
// a paragraph. Hence this file.
//
// ── WHAT IT ACTUALLY CHECKS ──────────────────────────────────────────────────
//
// For each changed page it reconstructs the file as it was before the change
// (`git show`), parses both versions with jsdom, and requires:
//
//   1. the same `<script src>` / `<link href>` tags, same values, same order;
//   2. a byte-for-byte identical `nav.menubar` and `.copy-inside` subtree;
//   3. an identical element tree — every tag, every attribute, same nesting —
//      so that TEXT is the only thing a content edit is allowed to change;
//   4. no `<main>`, no `<div id="concierge">` and no `on…=` handler introduced.
//
// Failure messages are written for Paul, not for an engineer.
//
// ── TWO SCOPING CORRECTIONS (SARAH-CHROMEDIFF-SCOPE-R3) ──────────────────────
//
// Rule 3 is a PROXY. What actually breaks the site is the injector's plan
// changing; "the element tree moved" is a conservative stand-in for that, and a
// conservative stand-in over-reports by construction. Two over-reports were
// measured on #197 and are corrected here. Neither touches rules 1, 2 or 4.
//
//   • METADATA TEXT IS CONTENT, NOT STRUCTURE. CLAUDE.md §2 puts `<title>` and
//     `<meta name="description">` text INSIDE the content lane, but rule 3 reads
//     a description as an ATTRIBUTE and so failed the one edit the lane exists to
//     allow. `CONTENT_LANE_METADATA` below names the four text carriers whose
//     value is masked before the trees are compared. Only the VALUE, and only for
//     those four: `og:url`, `og:image`, `og:type`, `robots`, `viewport` and
//     `canonical` are still compared in full, because re-pointing one of those is
//     not a wording edit. Adding or removing any meta still fails, and so does
//     renaming `name="description"` to anything else — the masking is keyed on
//     the identity attribute, so a tag cannot rename its way into the exemption.
//
//   • ENGINEER-REVIEWED STRUCTURE. `REVIEWED_STRUCTURAL` is a closed, named list
//     of files whose structural change has been read by an engineer and shown not
//     to move the injector. It suppresses rule 3 and NOTHING else — and only
//     while five guards hold, each of which is an input `decidePlan` actually
//     reads. It is a per-file waiver with a written reason, not a switch.
//
// Both are proved to be narrow rather than asserted to be: the allowlist suite at
// the bottom drives a near-miss filename and an allowlisted file that also adds a
// `<main>`, and requires both to stay red.
//
// ── WHY THIS IS NOT A VACUOUS PASS ON A PULL REQUEST THAT CHANGES NO PAGES ───
//
// On `main`, and on any branch that touches no page, there are zero pages to
// compare and the per-page suite below is empty. An empty suite proves nothing, so
// two other things carry the weight: the plumbing suite proves the before state is
// really being reconstructed (it asserts the recovered bytes are non-empty and
// contain the nav — a `git show` that quietly returned nothing would otherwise
// read as a clean page), and the trap suite proves the comparison bites by running
// it over seven deliberately broken pages and requiring each to fail with its own
// message.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { HTMLRewriter } from './helpers/html-rewriter.mjs';
import { planFromHtml, injectHandlers, CONTAINER_ID } from '../donovan-legal-site/functions/_lib/perch-main.js';
import { onRequest } from '../donovan-legal-site/functions/_middleware.js';
import { TIER_LINKS, TOP_LEVEL, BOUND_IDS } from '../donovan-legal-site/functions/_lib/nav-inject.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * The pages this gate is responsible for.
 *
 * Scoped to the deployed Cloudflare Pages app on purpose: those are the files the
 * middleware rewrites and the only ones Paul's content lane opens pull requests
 * against. `test/fixtures/**` is HTML too, but it is never served, and gating it
 * would mean this file could not carry the deliberately broken pages it needs.
 */
const GATED_PREFIX = 'donovan-legal-site/';

/**
 * The two selectors `_lib/perch-main.js` keys its whole decision on, restated here
 * because this file has to look for the same things. `assertSelectorsHaveNotDrifted`
 * below proves these two literals still match the ones in that module, so a rename
 * over there turns this gate red instead of quietly making it look at nothing.
 */
const ORB_SELECTOR = 'div#concierge';
const SITE_NAV_SELECTOR = 'nav.menubar';

/** The footer copyright line. `.copy-inside` is how all 82 pages that have one spell it. */
const FOOTER_SELECTOR = '.copy-inside';

// ── Correction 1: the metadata whose TEXT belongs to the content lane ────────

/**
 * The four places on a page where human-readable text is carried by an ATTRIBUTE
 * rather than by a text node, and where changing that text is explicitly Paul's
 * to do (CLAUDE.md §2: "`<title>` and `<meta name="description">` content").
 *
 * `<title>` is in this list for completeness and carries nothing: its text is a
 * text node, so `elementTree` never saw it and a retitle already passed. The
 * three `<meta>` entries are the ones that were failing — a description is text
 * to a reader and an attribute to a parser, and rule 3 could only see the parser's
 * view of it.
 *
 * WHY THE LIST IS FOUR ENTRIES AND NOT "meta tags". A blanket rule would also
 * hand over `og:url` and `og:image` (which decide what a shared link points at
 * and shows), `robots` (which decides whether the page is indexed at all, and
 * §3.6 forbids adding `noindex`), `viewport` and `canonical`. None of those is
 * wording. Each entry below therefore names its own identity test, and `carries`
 * names the single attribute whose VALUE is masked — everything else on the tag,
 * including the identity attribute itself, is still compared byte for byte.
 */
const CONTENT_LANE_METADATA = [
  {
    what: 'the <title> text',
    carries: null,
    match: (el) => el.tagName === 'TITLE',
  },
  {
    what: '<meta name="description">',
    carries: 'content',
    match: (el) => el.tagName === 'META' && (el.getAttribute('name') || '').toLowerCase() === 'description',
  },
  {
    what: '<meta property="og:title">',
    carries: 'content',
    match: (el) => el.tagName === 'META' && (el.getAttribute('property') || '').toLowerCase() === 'og:title',
  },
  {
    what: '<meta property="og:description">',
    carries: 'content',
    match: (el) => el.tagName === 'META' && (el.getAttribute('property') || '').toLowerCase() === 'og:description',
  },
];

/** What a masked value is printed as. Visible in a failure report on purpose: if
 *  one of these tags fails for some OTHER reason, the reader must be able to see
 *  that its text was deliberately not part of the comparison. */
const MASKED = '‹text — content lane, not compared›';

// ── Correction 2: the engineer-reviewed structural allowlist ─────────────────

/**
 * Files whose structural change has been READ by an engineer, checked against the
 * real injector, and found not to move it — listed one per line with the reason.
 *
 * This is a waiver register, not a configuration switch. Adding a line to it is an
 * assertion by a named human that they ran the injector over that file's before
 * and after and compared the plans. The evidence for the entries below (ORDER
 * SARAH-CHROMEDIFF-SCOPE-R3, PR #197) is `planFromHtml` over both versions of each
 * file: nine of the ten produced a byte-identical plan, and `tax-controversy.html`
 * kept its kind and its opening ordinal and moved only its closing ordinal,
 * because the wrapper it closes at legitimately came to hold more content.
 *
 * It suppresses `page-structure` and nothing else. `new-main-element`,
 * `concierge-orb-id`, `inline-event-handler`, `site-navigation`,
 * `footer-copyright` and `scripts-and-stylesheets` all still fire on these files,
 * and the guards in `structuralWaiver` withdraw even the structure waiver the
 * moment the page stops looking like the page that was reviewed.
 *
 * Keys are exact repo-relative paths. Matching is by exact equality — never by
 * prefix, suffix or directory — so a new `tax-controversy-2.html` inherits
 * nothing. The `a near-miss filename inherits nothing` trap below proves it.
 *
 * ── JORDAN-PAUL-MOBILE (#226 part A) — 15 ALSO CLAUSES, NO NEW KEYS ─────────
 *
 * The arc `<img>` on each of the 15 tax-controversy pages is wrapped in a
 * `<picture>` carrying one `<source media="(max-width:700px)">` pointed at a
 * portrait variant. Every page it touches is ALREADY on this list from #195,
 * #197 or #229, so this order adds fifteen `ALSO` clauses and not one key — the
 * size assertion below stays at 112, and it staying there is part of the claim.
 *
 * This diff is the OPPOSITE shape to #229's and the register should be read that
 * way. #229 added `<div>`s, so its evidence had to DERIVE how far the closing
 * ordinal was allowed to advance. This one adds `<picture>` and `<source>` and
 * NO `</div>` at all, so the derived allowance is zero and the closing ordinal
 * must not move by one: `scripts/content/mobile-waiver-evidence.mjs` is the same
 * instrument with the same line of code, evaluating to a strictly stronger claim.
 *
 * Three things it measures that #229 had no reason to, because they are how a
 * `<picture>` fails while still rendering:
 *
 *   • the fallback `<img>` is compared BYTE FOR BYTE, not attribute by attribute,
 *     so `alt`, `loading` and any `width`/`height` are covered without an
 *     enumeration that could go stale;
 *   • the wrapper is required to carry NO attributes at all — PR #229's
 *     `.container` accident in this position would be a `.dl-arc > img` child
 *     combinator, and the site's own `.dl-arc img` descendant rule is measured
 *     still to match the fallback through the wrapper rather than assumed to; and
 *   • every mobile `srcset` is resolved against the FILESYSTEM, read off the
 *     shipped page rather than off the transform's own eligibility list, because
 *     a `<source>` whose image 404s falls back to the `<img>` and looks exactly
 *     like success.
 *
 * NOT waived, and not waivable by this list: `scripts-and-stylesheets` never sees
 * this diff at all (`assetManifest` reads `script[src]` and `link[href]`, not
 * `img` or `source`), and no nav or footer is touched — both subtrees are
 * compared byte for byte by the evidence script so that stays true.
 */
const REVIEWED_STRUCTURAL = new Map([
  // ── JAY-TRACKING-B2 (consent) ──────────────────────────────────────────────
  ['donovan-legal-site/disclaimer.html',
    'JAY-TRACKING-B2 — the policy page gains the disclosure the consent banner links to: one <h5> "ANALYTICS AND ADVERTISING MEASUREMENT", two <p>, two external <a> (Google and Meta privacy policies) and one <button id="dl-consent-reopen" hidden> — the opt-out control, which exists because withdrawal has to be as easy as consent and "clear your browser data" does not count. It ships HIDDEN and js/analytics/consent-banner.js reveals it, so with ANALYTICS off a visitor is never offered a setting that does not exist. Wired in JS, not markup: on*= is refused by the nonce CSP and by repo-invariants, and this page does not load js/inline-actions.js. Six elements added and NO <div> among them, so the plan is identical integer for integer (wrap-div, open 31, close 39) — the same reasoning JORDAN-PAUL-MOBILE rests on, and the opposite of the #226 library band whose four </div> moved the close by four. Nav div-ancestor stack, body children, and the nav and footer subtrees all identical; script[src] and link[href] manifests byte-identical, so scripts-and-stylesheets never sees this diff. Evidence: scripts/content/consent-waiver-evidence.mjs.'],
  ['donovan-legal-site/tax-controversy.html',
    'PR #197 hub rebuild — 405 added lines sit inside div.border-grey after the nav\'s container; plan stays wrap-div opening after div-end 31, only the close moves (40→76) as the wrapper now holds more content. ALSO JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-all-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-controversy-roadmap-0-overview.html',
    'PR #197 — one <p> cross-link added inside div.closing; no nav on this page, body children and the wrap-body plan (open 0, close 4) are identical before and after.'],
  ['donovan-legal-site/blog-controversy-roadmap-1-processing-assessment.html',
    'PR #197 — one <p> cross-link added inside div.closing; no nav on this page, body children and the wrap-body plan (open 0, close 4) are identical before and after.'],
  ['donovan-legal-site/blog-controversy-roadmap-2-exam.html',
    'PR #197 — one <p> cross-link added inside div.closing; no nav on this page, body children and the wrap-body plan (open 0, close 4) are identical before and after.'],
  ['donovan-legal-site/blog-controversy-roadmap-3-exam-alternatives.html',
    'PR #197 — one <p> cross-link added inside div.closing; no nav on this page, body children and the wrap-body plan (open 0, close 4) are identical before and after.'],
  ['donovan-legal-site/blog-controversy-roadmap-4-appeals.html',
    'PR #197 — one <p> cross-link added inside div.closing; no nav on this page, body children and the wrap-body plan (open 0, close 4) are identical before and after.'],
  ['donovan-legal-site/blog-controversy-roadmap-5-collection.html',
    'PR #197 — one <p> cross-link added inside div.closing; no nav on this page, body children and the wrap-body plan (open 0, close 4) are identical before and after.'],
  ['donovan-legal-site/blog-controversy-roadmap-6-collection-alternatives.html',
    'PR #197 — one <p> cross-link added inside div.closing; no nav on this page, body children and the wrap-body plan (open 0, close 4) are identical before and after.'],
  ['donovan-legal-site/blog-controversy-roadmap-7-litigation.html',
    'PR #197 — one <p> cross-link added inside div.closing; no nav on this page, body children and the wrap-body plan (open 0, close 4) are identical before and after.'],
  ['donovan-legal-site/contact.html',
    'SHELDON-CONTACT-ROUTE-R1 (#214) — the inquiry form stops posting to Formspree and posts to /fn/contact. Everything added is in <head> (three script tags, CSS for the status line) or INSIDE the existing form element (the Turnstile mount, the status paragraph). planFromHtml over both versions returns the same kind and the same opening and closing ordinals: the nav\'s div-ancestor stack, the body children and the swap region are all unchanged, which is why the Turnstile tag is in the head here and at the end of the body on book.html. ALSO JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: three brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs; attributes only, and the same before/after comparison holds — scripts/a11y/waiver-evidence.mjs.'],

  // ── JORDAN-195-LEVELA-WAIVER-R1 (#195) — the 81 accessibility pages ────────
  //
  // PR #220 shipped the WCAG contrast debt that CSS could reach and stopped at
  // this line: every remaining Level A and AA defect on the site is spelled as an
  // ATTRIBUTE — `lang`, `aria-label`, `aria-controls`, `aria-labelledby`, `role`,
  // and colour written into a `style=""`. Rule 3 compares every attribute, so no
  // amount of CSS reaches any of them and every one of these edits is structural
  // to this gate and to nothing else.
  //
  // The reason on each line names the rule and the edit. The claim they share —
  // that the injector does not move — is not asserted here, it is MEASURED, and
  // it is measured against the diff that actually shipped rather than a proposal:
  // `scripts/a11y/waiver-evidence.mjs` recovers each file from `origin/main`,
  // requires the working tree to be byte-identical to the reviewed transforms
  // applied to it, and then runs the real `planFromHtml` plus the three guards
  // `structuralWaiver` enforces over the pair. It carries two controls: one that
  // an added `<main>` moves the plan (the async/rewriter trap that made an
  // earlier version compare two Promises and report 83 identical files having
  // compared nothing), and one that its own per-file check reports a corrupted
  // after. On this branch: 81 changed pages, 81 register entries, 0 unregistered,
  // 81/81 byte-identical to the transform, 0 moved.
  //
  // NOT waived, and not waivable by this list: `site-navigation`,
  // `footer-copyright` and `scripts-and-stylesheets`. None of these 81 diffs
  // touches a nav, a footer or an asset tag, and the evidence script compares
  // both subtrees byte for byte so that stays true rather than being assumed.
  ['donovan-legal-site/blog-augusta-rule-280a-g.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-character-amount-timing.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-civil-fraud-eggshell-audit.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-conservation-easement-settlement.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-criminal-tax-overview.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-currently-not-collectible-csed.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-fbar-foreign-account-penalties.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-foreclose-federal-tax-lien-suit.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-irs-co-owned-marital-real-estate.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-irs-levy.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-irs-summons.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-jeopardy-termination-assessments.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-kwong-covid-deadlines.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-material-participation-seven-tests.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-notice-of-federal-tax-lien.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-passport-revocation-tax-debt.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-penalty-regime-6751b.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-per-se-passive-rule-exceptions.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-real-estate-professional-status-reps.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-short-term-rental-play.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-subdivision-basis-allocation.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-substitute-for-return.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-tax-opinions.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-tenancy-by-entirety-federal-tax-lien.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-transferee-nominee-alter-ego.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog-trust-fund-recovery-penalty.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — svg-img-alt: an id on the <figcaption> and aria-labelledby on the <svg> it already describes. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/blog.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — aria-required-children: .blog-filter goes role="tablist" -> role="group", which admits its plain <button> children. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/book.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/business-law.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — html-has-lang: lang="" -> lang="en" on <html>. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/contracts.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — html-has-lang + aria-valid-attr-value + button-name: lang="" -> lang="en" on <html>; the three accordion toggles point aria-controls at the panel they open instead of a non-existent #collapseOne; each accordion toggle gains an aria-label taken from the .link-yellow heading beside it. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/development.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — html-has-lang + aria-valid-attr-value + button-name: lang="" -> lang="en" on <html>; the three accordion toggles point aria-controls at the panel they open instead of a non-existent #collapseOne; each accordion toggle gains an aria-label taken from the .link-yellow heading beside it. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/diamond/SAMPLE_Multi_Tier_Deal_Package.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/diamond/SAMPLE_Multi_Tier_NY_Publication.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/diamond/SAMPLE_Small_JV_No_Reg_D.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/diamond/tool-1031-exchange.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (2 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/diamond/tool-operating-agreement.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (3 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/diamond/tool-rental-real-estate-tax-strategy-analyzer.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (10 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/eminent-domain.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — html-has-lang + aria-valid-attr-value + button-name: lang="" -> lang="en" on <html>; the three accordion toggles point aria-controls at the panel they open instead of a non-existent #collapseOne; each accordion toggle gains an aria-label taken from the .link-yellow heading beside it. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/engagement.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (4 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/entity-formation.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — html-has-lang + aria-valid-attr-value + button-name: lang="" -> lang="en" on <html>; the three accordion toggles point aria-controls at the panel they open instead of a non-existent #collapseOne; each accordion toggle gains an aria-label taken from the .link-yellow heading beside it. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/florida-sales-tax-audit.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — nested-interactive: the state map holding eight <a href> stations goes role="img" -> role="group". Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-exam-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/gold/tool-1031-exchange.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (2 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/gold/tool-rental-real-estate-tax-strategy-analyzer.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (10 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/home.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (11 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#224) — one <p> carrying the Bar 4-7.13 testimonial disclaimer added inside the existing div.col-lg-10, and the swapped testimonial\'s attribution gains a <br> and an <em>. No <div> is added, so the plan is identical integer for integer (close stays 71); nav stack, body children, nav and footer subtrees identical, swap region 145→148. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/index.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (11 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#224) — one <p> carrying the Bar 4-7.13 testimonial disclaimer added inside the existing div.col-lg-10, and the swapped testimonial\'s attribution gains a <br> and an <em>. No <div> is added, so the plan is identical integer for integer (close stays 71); nav stack, body children, nav and footer subtrees identical, swap region 145→148. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/leasing.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — html-has-lang + aria-valid-attr-value + button-name: lang="" -> lang="en" on <html>; the three accordion toggles point aria-controls at the panel they open instead of a non-existent #collapseOne; each accordion toggle gains an aria-label taken from the .link-yellow heading beside it. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/leidy.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/litigation.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — html-has-lang + aria-valid-attr-value + button-name: lang="" -> lang="en" on <html>; the three accordion toggles point aria-controls at the panel they open instead of a non-existent #collapseOne; each accordion toggle gains an aria-label taken from the .link-yellow heading beside it. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/massachusetts-tax-appeal.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — nested-interactive: the state map holding eight <a href> stations goes role="img" -> role="group". Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-appeal-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/members/about-membership.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (4 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/membership-diamond.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (3 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/membership-gold.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (3 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/membership-platinum.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (3 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/membership-reserve.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (4 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/ourfirm.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (4 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/platinum/tool-1031-exchange.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (2 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/platinum/tool-rental-real-estate-tax-strategy-analyzer.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (10 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/profile.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/property-acquisition.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — html-has-lang + aria-valid-attr-value + button-name: lang="" -> lang="en" on <html>; the three accordion toggles point aria-controls at the panel they open instead of a non-existent #collapseOne; each accordion toggle gains an aria-label taken from the .link-yellow heading beside it. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/re-financing.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — html-has-lang + aria-valid-attr-value + button-name: lang="" -> lang="en" on <html>; the three accordion toggles point aria-controls at the panel they open instead of a non-existent #collapseOne; each accordion toggle gains an aria-label taken from the .link-yellow heading beside it. Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/reserve/SAMPLE_Multi_Tier_Deal_Package.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/reserve/SAMPLE_Multi_Tier_NY_Publication.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/reserve/SAMPLE_Small_JV_No_Reg_D.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/reserve/tool-1031-exchange.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (2 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/reserve/tool-operating-agreement.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (3 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/reserve/tool-rental-real-estate-tax-strategy-analyzer.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (10 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/tefera.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/testimonials.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (8 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#224) — one <p> carrying the Bar 4-7.13 disclaimer added inside the existing intro div, before the first <h5>. No <div> is added, so the plan is identical integer for integer (close stays 44); nav stack, body children, nav and footer subtrees identical, swap region 96→98. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/tool-1031-exchange.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (2 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#225) — a div.container holding the results-context conversion panel (no credibility band on tool pages), inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 3 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/tool-capital-gains.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — select-name + color-contrast: #niit gains the aria-label its unwired <label> already reads; brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#225) — a div.container holding the results-context conversion panel (no credibility band on tool pages), inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 3 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-TOOL-DEDUPE (#232) — the legacy div.tool-cta block ("Need Help With Your Specific Matter?") is deleted whole, leaving the JORDAN-PAUL-CONTENT (#225) div.dl-endcap > div.dl-cta as the page\'s single call to action. Four elements leave: the wrapper, its <h4>, its <p> and its a.cta-link. Swap region 127 → 123 and the document 314 → 310 — the SAME 4, which is what proves the block was deleted rather than moved out of the swap container. Plan stays wrap-div with the same opening ordinal 31; the close retreats from 66 to 65, which is exactly the 1 </div> the block takes with it. Nav stack, body children, and the nav and footer subtrees are byte-identical; no <main>, no concierge orb, no inline handler, no asset touched. Evidence: scripts/content/tool-cta-waiver-evidence.mjs.'],
  ['donovan-legal-site/tool-cost-segregation.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (2 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#225) — a div.container holding the results-context conversion panel (no credibility band on tool pages), inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 3 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/tool-economics.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/tool-entity-formation.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (2 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/tool-firpta-withholding.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (2 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#225) — a div.container holding the results-context conversion panel (no credibility band on tool pages), inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 3 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-TOOL-DEDUPE (#232) — the legacy div.tool-cta block ("Need Help With Your Specific Matter?") is deleted whole, leaving the JORDAN-PAUL-CONTENT (#225) div.dl-endcap > div.dl-cta as the page\'s single call to action. Four elements leave: the wrapper, its <h4>, its <p> and its a.cta-link. Swap region 111 → 107 and the document 298 → 294 — the SAME 4, which is what proves the block was deleted rather than moved out of the swap container. Plan stays wrap-div with the same opening ordinal 31; the close retreats from 61 to 60, which is exactly the 1 </div> the block takes with it. Nav stack, body children, and the nav and footer subtrees are byte-identical; no <main>, no concierge orb, no inline handler, no asset touched. Evidence: scripts/content/tool-cta-waiver-evidence.mjs.'],
  ['donovan-legal-site/tool-irs-notice-guide.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#225) — a div.container holding the results-context conversion panel (no credibility band on tool pages), inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 3 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-TOOL-DEDUPE (#232) — the legacy div.tool-cta block (here worded "Received an IRS Notice and Need Help?" — the same container, page-specific copy) is deleted whole, leaving the JORDAN-PAUL-CONTENT (#225) div.dl-endcap > div.dl-cta as the page\'s single call to action. Four elements leave: the wrapper, its <h4>, its <p> and its a.cta-link. Swap region 96 → 92 and the document 281 → 277 — the SAME 4, which is what proves the block was deleted rather than moved out of the swap container. Plan stays wrap-div with the same opening ordinal 31; the close retreats from 60 to 59, which is exactly the 1 </div> the block takes with it. Nav stack, body children, and the nav and footer subtrees are byte-identical; no <main>, no concierge orb, no inline handler, no asset touched. Evidence: scripts/content/tool-cta-waiver-evidence.mjs.'],
  ['donovan-legal-site/tool-oic-rcp-estimator.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (4 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#225) — a div.container holding the results-context conversion panel (no credibility band on tool pages), inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 3 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-TOOL-DEDUPE (#232) — the legacy div.tool-cta block ("Need Help With Your Specific Matter?") is deleted whole, leaving the JORDAN-PAUL-CONTENT (#225) div.dl-endcap > div.dl-cta as the page\'s single call to action. Four elements leave: the wrapper, its <h4>, its <p> and its a.cta-link. Swap region 137 → 133 and the document 324 → 320 — the SAME 4, which is what proves the block was deleted rather than moved out of the swap container. Plan stays wrap-div with the same opening ordinal 31; the close retreats from 71 to 70, which is exactly the 1 </div> the block takes with it. Nav stack, body children, and the nav and footer subtrees are byte-identical; no <main>, no concierge orb, no inline handler, no asset touched. Evidence: scripts/content/tool-cta-waiver-evidence.mjs.'],
  ['donovan-legal-site/tool-rental-real-estate-tax-strategy-analyzer.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (10 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#225) — a div.container holding the results-context conversion panel (no credibility band on tool pages), inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 3 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-TOOL-DEDUPE (#232) — the legacy div.tool-cta block (here worded "Considering a Real Estate Investment?" — the same container, page-specific copy) is deleted whole, leaving the JORDAN-PAUL-CONTENT (#225) div.dl-endcap > div.dl-cta as the page\'s single call to action. Four elements leave: the wrapper, its <h4>, its <p> and its a.cta-link. Swap region 660 → 656 and the document 848 → 844 — the SAME 4, which is what proves the block was deleted rather than moved out of the swap container. Plan stays wrap-div with the same opening ordinal 31; the close retreats from 298 to 297, which is exactly the 1 </div> the block takes with it. Nav stack, body children, and the nav and footer subtrees are byte-identical; no <main>, no concierge orb, no inline handler, no asset touched. The four tier copies of this page under diamond/, gold/, platinum/ and reserve/ carry the legacy block and NO dl-cta, so they are not de-duplicated, are not edited, and are not on this list. Evidence: scripts/content/tool-cta-waiver-evidence.mjs.'],
  ['donovan-legal-site/tool-str-strategy-analyzer.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (9 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs. ALSO JORDAN-PAUL-CONTENT (#225) — a div.container holding the results-context conversion panel (no credibility band on tool pages), inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 3 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-TOOL-DEDUPE (#232) — the legacy div.tool-cta block (here worded "Considering an STR Investment?" — the same container, page-specific copy) is deleted whole, leaving the JORDAN-PAUL-CONTENT (#225) div.dl-endcap > div.dl-cta as the page\'s single call to action. Four elements leave: the wrapper, its <h4>, its <p> and its a.cta-link. Swap region 537 → 533 and the document 725 → 721 — the SAME 4, which is what proves the block was deleted rather than moved out of the swap container. Plan stays wrap-div with the same opening ordinal 31; the close retreats from 246 to 245, which is exactly the 1 </div> the block takes with it. Nav stack, body children, and the nav and footer subtrees are byte-identical; no <main>, no concierge orb, no inline handler, no asset touched. Evidence: scripts/content/tool-cta-waiver-evidence.mjs.'],
  ['donovan-legal-site/tools.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (33 attributes). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],
  ['donovan-legal-site/wendy.html',
    'JORDAN-195-LEVELA-WAIVER-R1 (#195) — color-contrast: brand hexes inside style="" attributes re-valued from scripts/a11y/palette-195.mjs (1 attribute). Attributes only; plan, nav stack, body children and swap region identical, nav and footer subtrees byte-identical — scripts/a11y/waiver-evidence.mjs.'],

  // ── JORDAN-PAUL-CONTENT (#224, #225, #226) — the Paul batch content blocks ──
  //
  // These 22 pages are new to the register; 17 more that this order also edits
  // were already on it and carry an "ALSO JORDAN-PAUL-CONTENT" clause on their
  // existing line instead of a second key.
  //
  // Unlike #195, this order ADDS elements — a conversion panel or a library band
  // at the end of the page content. A wrap-div plan is written in </div>
  // ordinals, so an insertion inside the wrapper necessarily advances
  // `closeBeforeDivEnd`; that is the ordinal space moving under a close that
  // still lands on the same element, exactly as the tax-controversy.html line
  // above already records for #197. So the claim is measured on the ELEMENT:
  // `scripts/content/waiver-evidence.mjs` recovers each file from `origin/main`,
  // requires the working tree to be byte-identical to the reviewed transforms in
  // `scripts/content/paul-content-edits.mjs`, runs the REAL injector over both
  // versions, and requires the container's parent chain, its previous and next
  // sibling and its own first and last child to be unchanged, the close ordinal
  // to advance by exactly the number of </div> the diff adds, and the container
  // to gain exactly as many elements as the page does. It carries three controls:
  // a corrupted after, an added <main>, and a <div> placed outside the wrapper.
  // On this branch: 39 changed pages, 39 register entries, 0 unregistered,
  // 39/39 byte-identical to the transform, 0 moved.
  //
  // NOT waived, and not waivable by this list: `site-navigation`,
  // `footer-copyright` and `scripts-and-stylesheets`. No block here touches a
  // nav, a footer or an asset tag — the CSS ports go into the page's existing
  // head <style> element, which adds no tag — and the evidence script compares
  // both subtrees byte for byte so that stays measured rather than assumed.
  ['donovan-legal-site/audit-reconsideration.html',
    'JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-exam-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/experience.html',
    'JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/irs-appeals.html',
    'JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-appeal-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/irs-audit-defense.html',
    'JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-exam-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/irs-liens-levies.html',
    'JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-coll-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/irs-notice.html',
    'JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-notice-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/partnership-audits.html',
    'JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-exam-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/practice.html',
    'JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/re-acquisition.html',
    'JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/re-disposition.html',
    'JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/re-ownership.html',
    'JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/real-estate.html',
    'JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/residency-audit.html',
    'JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-exam-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/special-counsel.html',
    'JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/tax-compliance.html',
    'JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/tax-court.html',
    'JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-court-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/tax-debt-resolution.html',
    'JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-coll-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/tax-penalties.html',
    'JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-exam-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/tax-planning.html',
    'JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/tax.html',
    'JORDAN-PAUL-CONTENT (#225) — a div.container holding the credibility band and the two-button conversion panel, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 9 </div> the block adds, so it still lands on the same wrapper. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs.'],
  ['donovan-legal-site/unfiled-returns.html',
    'JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-fwd-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],
  ['donovan-legal-site/voluntary-disclosure.html',
    'JORDAN-PAUL-CONTENT (#226) — a div.container holding the two-column dl-refs library band, inserted immediately before div.dl-connect. Plan stays wrap-div with the same opening ordinal; the close advances by exactly the 4 </div> the block adds. Container parent, previous and next sibling, first and last child all unchanged under the real injector; every added element landed inside it; nav and footer subtrees byte-identical. Evidence: scripts/content/waiver-evidence.mjs. ALSO JORDAN-PAUL-MOBILE (#226 part A) — the arc <img> gains a <picture> wrapper holding one <source media="(max-width:700px)" srcset="img/arc-fwd-m.svg"> and the original <img>, which is the fallback and is BYTE-IDENTICAL, so alt, loading and every other attribute survive by construction rather than by enumeration. The wrapper carries NO class — the PR #229 .container accident in this position would have been a .dl-arc > img child combinator, and the page\'s own rule is the descendant .dl-arc img, which is measured still to match the fallback through the wrapper. NO <div> is added, so unlike the #226 library band the closing ordinal does not move at all: plan kind and BOTH ordinals identical, nav stack, body children and the nav and footer subtrees unchanged, swap region +2 (the <picture> and the <source>), and under the real injector the container\'s parent, previous and next sibling, first and last child are unchanged with both added elements inside it. No <main>, no concierge orb, no inline handler; the mobile srcset is checked against the filesystem. Evidence: scripts/content/mobile-waiver-evidence.mjs.'],

  // -- OFFICE-PHONE: the tel: href reverts to the firm own line --------------
  ['donovan-legal-site/blog-461l-excess-business-loss-and-172-nol.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/blog-bramblett-phelan-two-entity-structure.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/blog-firpta-foreign-sellers.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/blog-irs-audit-notice-what-to-do.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/blog-partnership-agreement-tax-document.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/blog-short-term-rental-material-participation.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/business-formation.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/financing.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/formation.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/re-transaction.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/tax-controversies.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/taxation.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/the-cmm.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],
  ['donovan-legal-site/the-cmm2.html',
    "OFFICE-PHONE - the firm's published number reverts to its own line, (561) 666-6022, because the Retell-provisioned 529-5873 was bought inside Retell and does not survive the handover. The ONLY change on this page is the value of the tel: href and its matching visible text: tel:+15615295873 -> tel:+15616666022. No element is added, removed or moved and no other attribute changes; element counts are identical before and after (275/275 on blog-461l, 273/273 on blog-bramblett). planFromHtml was run over the before and the after of all fourteen files and every plan is byte-identical, so the swap container, the persistent layer, the router and the booking bar land in exactly the same place. Separately verified that, with line endings normalised, each file's entire diff against origin/main is the phone number and nothing else."],

]);

// ── Correction 2a-bis: the engineer-reviewed REMOVAL budgets ─────────────────

/**
 * Files whose reviewed structural change DELETES elements, and exactly how many.
 *
 * ── WHY THE SHRINK GUARD NEEDED A DOOR AT ALL ───────────────────────────────
 *
 * `structuralWaiver` refuses any shrinking swap region, and the sentence it
 * refuses with names the reason: "content has moved out of the swap container".
 * That is the failure. The guard does not measure it — it measures the region's
 * SIZE, which is a proxy, and the proxy cannot tell content that left the
 * container from content that left the page. Until JORDAN-TOOL-DEDUPE (#232)
 * nothing on this list deleted anything, so the two readings never came apart and
 * the strict refusal cost nothing.
 *
 * De-duplicating a call to action is a deletion. So the proxy is replaced, for
 * these files only, by a measurement of the thing the guard was actually written
 * about:
 *
 *   RELOCATION shrinks the region and leaves `elementCount` UNCHANGED.
 *   DELETION   shrinks the region and `elementCount` by the SAME number.
 *
 * Three conditions, all required, none of them a matter of opinion:
 *
 *   1. the file is on `REVIEWED_STRUCTURAL` (this register is never consulted
 *      first — an unreviewed file never reaches the shrink branch at all);
 *   2. the region lost EXACTLY the number of elements written here, so a review
 *      of a four-element block is not a licence to delete a fifth; and
 *   3. the document lost that same number, which is what rules out relocation.
 *
 * Condition 3 is the load-bearing one and it is not forgeable by the failure it
 * guards: moving markup out of the container keeps the document count flat, so
 * the trap suite's moved-markup page fails condition 3 on a budgeted file exactly
 * as it fails the plain shrink guard on every other file. Both refusals are
 * driven in `the reviewed-structural allowlist cannot go broad` below.
 *
 * This register suppresses NOTHING on its own. A file listed here and not on
 * `REVIEWED_STRUCTURAL` is waived for nothing, and the control below asserts that
 * cannot happen by accident.
 *
 * All six were ALREADY on `REVIEWED_STRUCTURAL` from #195 and #225, so #232 adds
 * six ALSO clauses and not one key — the size assertion stays at 112, and it
 * staying there is part of the claim. That assertion is what caught the first
 * draft of this order re-keying the six entries and silently discarding their
 * accessibility and conversion-panel reasons: a Map literal keeps the last value
 * for a duplicate key and grows by nothing, so the register would have looked
 * correct and quietly covered less than it said.
 */
const REVIEWED_REMOVAL = new Map([
  ['donovan-legal-site/tool-capital-gains.html', 4],
  ['donovan-legal-site/tool-firpta-withholding.html', 4],
  ['donovan-legal-site/tool-irs-notice-guide.html', 4],
  ['donovan-legal-site/tool-oic-rcp-estimator.html', 4],
  ['donovan-legal-site/tool-rental-real-estate-tax-strategy-analyzer.html', 4],
  ['donovan-legal-site/tool-str-strategy-analyzer.html', 4],
]);

// ── Correction 2b: the engineer-reviewed ASSET allowlist ─────────────────────

/**
 * Files whose SCRIPT/STYLESHEET change has been read by an engineer, listed one per
 * line with the reason. A second register rather than a second column on the one
 * above, because the two waivers answer different questions and a file may need one
 * without the other — and because a reader has to be able to see, at a glance, the
 * complete list of pages whose asset manifest somebody deliberately changed.
 *
 * NARROWER THAN THE STRUCTURAL WAIVER IN ONE DECISIVE WAY: it suppresses
 * `scripts-and-stylesheets` only when the change is PURELY ADDITIVE — every tag the
 * page loaded before is still loaded, in the same relative order. The rule's own
 * failure message names four things that break the page ("Adding, removing,
 * re-pointing or re-ordering"), and a review can only ever speak to the first. A
 * removed tag, a re-pointed src and a reordered pair each turn a live feature off,
 * and none of them is waivable by writing a filename on a list. See
 * `assetWaiver` — the subsequence test is what enforces it, and the trap suite
 * drives all three refusals.
 */
const REVIEWED_ASSETS = new Map([
  ['donovan-legal-site/contact.html',
    'SHELDON-CONTACT-ROUTE-R1 (#214) — three head tags ADDED and nothing else touched: /js/dl-init.js (the A0.2 re-init bus), /js/page/contact-form.js (the inquiry form, registered via DL.ready) and the Cloudflare Turnstile api.js already loaded by book.html and already on the CSP script-src allow-list. The concierge, the booking bar and every vendor tag load exactly as they did.'],
]);

/**
 * Whether `scripts-and-stylesheets` — and only that rule — is waived for this file.
 *
 * Returns the reason it was waived, or the reason it was not. Exported for the same
 * reason `structuralWaiver` is: the allowlist suite drives it directly, so its
 * narrowness is demonstrated rather than described.
 */
export function assetWaiver(file, beforeAssets, afterAssets) {
  const reviewed = REVIEWED_ASSETS.get(file);
  if (!reviewed) {
    return { applies: false, why: `${file} is not on the reviewed-asset list` };
  }

  // ADDITIVE ONLY. `beforeAssets` must survive as a subsequence of `afterAssets`:
  // every tag still loaded, still in the same relative order. That single test
  // refuses a removal, a re-point (the old src is simply gone) and a reorder, and
  // it does so structurally rather than by three separate checks that could each be
  // relaxed on their own.
  let i = 0;
  for (const tag of afterAssets) {
    if (i < beforeAssets.length && tag === beforeAssets[i]) i++;
  }
  if (i !== beforeAssets.length) {
    return {
      applies: false,
      why: `${file} is on the reviewed-asset list, but the change is not purely additive — `
        + `"${show(beforeAssets[i])}" is no longer loaded in its original position. A review `
        + 'licenses ADDED tags only; a removed, re-pointed or reordered tag turns a feature off '
        + 'and is never waivable.',
    };
  }

  return { applies: true, reason: reviewed };
}

// ── The rules, and the plain-English sentence each one fails with ─────────────
//
// One id per rule so the trap suite can prove each fires on its own account, and
// so a failure names the rule that broke rather than dumping two documents.

const RULES = {
  ASSETS: 'scripts-and-stylesheets',
  NAV: 'site-navigation',
  FOOTER: 'footer-copyright',
  TREE: 'page-structure',
  MAIN: 'new-main-element',
  ORB: 'concierge-orb-id',
  HANDLER: 'inline-event-handler',
};

// ── Reading the two versions of a page ───────────────────────────────────────

/**
 * Line endings are normalised on BOTH sides before anything is compared.
 *
 * This is not cosmetic tidying, it is a correctness requirement on Windows. Git
 * stores these blobs with bare LF, and `core.autocrlf` checks them out with CRLF —
 * measured on this repo, `practice.html` is 32,794 bytes in the object store and
 * 33,193 bytes on disk, a 399-byte difference that is entirely carriage returns.
 * Compare those two directly and every page fails, on a difference that has nothing
 * to do with the page's chrome.
 */
function normaliseEol(text) {
  return text.replace(/\r\n?/g, '\n');
}

/**
 * Parse one page into a document.
 *
 * ── WHY ONE WINDOW AND A `DOMParser`, NOT `new JSDOM()` PER PAGE ────────────
 *
 * `new JSDOM(html)` does not just parse markup, it builds a whole `Window`: every
 * DOM interface class, every prototype, every event-target table, installed fresh
 * on a new global. Measured on this repo, one of those costs about 2.5 MB and
 * jsdom never gives it back — a loop that parses the same page forty times and
 * calls `global.gc()` between rounds climbs 25 MB → 124 MB, and it climbs by the
 * same amount whether or not `window.close()` is called on the way out. It is not
 * this file holding a reference; it is jsdom.
 *
 * That is affordable for a handful of fixtures and it is not affordable here.
 * `comparePage` parses TWO documents per page and the pull-request suite runs it
 * over 156 pages, so the old spelling built ~470 windows and retained every one:
 * the heap climbed monotonically from 46 MB to 1,154 MB across the comparison
 * loop alone, and the run then aborted with `FATAL ERROR: Ineffective
 * mark-compacts near heap limit` part-way through the suites after it. That is
 * SIGABRT and an `ERR_TEST_FAILURE` on the required check, and it is invisible on
 * a developer machine because the default heap on these workstations is large
 * enough to absorb it — it only shows on the memory-constrained CI runner.
 * Reproduce it with `node --max-old-space-size=2048 --test test/chrome-diff.test.mjs`.
 *
 * So the window is built ONCE and only the documents are per page. A document from
 * `DOMParser.parseFromString(html, 'text/html')` is the same parse5 output the
 * `JSDOM` constructor produces — checked, not assumed: over all 158 pages in
 * `donovan-legal-site/` plus the trap fixture, `documentElement.outerHTML` is
 * identical between the two spellings, as are the element count, the head, and
 * whether there is a `<body>` at all; `<template>` content, `closest()` and
 * `cloneNode(true)` behave the same on both. With this spelling the same forty
 * rounds sit flat at 25.7 MB.
 *
 * Nothing downstream reads a document's browsing context. The base URL is the one
 * thing that would differ if anything did, and it does not differ — both spellings
 * give `about:blank` — but in any case every href in this file is read with
 * `getAttribute` and resolved explicitly against the page's own URL through
 * `new URL(raw, pageUrl)`, never through the `.href` property.
 */
const PARSER = new JSDOM('').window.DOMParser;
const DOM_PARSER = new PARSER();

function parse(html) {
  return DOM_PARSER.parseFromString(html, 'text/html');
}

// ── Extractors: the four things that must not move ───────────────────────────

/**
 * Every `<script src>` and `<link href>` on the page, in ONE list in document
 * order rather than two lists side by side.
 *
 * One list is deliberate. Two lists would compare scripts against scripts and
 * links against links, and would therefore not notice a script being moved from
 * above a stylesheet to below it — a reordering that changes what is loaded first
 * and is exactly the kind of "harmless tidy-up" that breaks a page.
 *
 * `getAttribute` and not `.src`/`.href`: the properties resolve to absolute URLs
 * against the document base, which would report `js/main.js` and `/js/main.js` as
 * the same thing. The authored value is what ships.
 */
function assetManifest(doc) {
  return [...doc.querySelectorAll('script[src], link[href]')].map((el) => {
    const attr = el.tagName === 'SCRIPT' ? 'src' : 'href';
    return `${el.tagName.toLowerCase()} ${attr}="${el.getAttribute(attr)}"`;
  });
}

/**
 * The serialised subtree of every element matching `selector`, in document order.
 *
 * Compared after parsing rather than by slicing the source text, because jsdom
 * gives no source offsets. That is the stronger comparison anyway: it sees the
 * subtree a browser builds, so it cannot be fooled by a change that looks
 * different in the file but parses to the same DOM, and every real change to the
 * markup or the wording inside the region still shows up.
 */
function subtree(doc, selector) {
  return [...doc.querySelectorAll(selector)].map((el) => el.outerHTML).join('\n<!--·-->\n');
}

/** Depth-first walk of elements only, descending into `<template>` content too.
 *  jsdom parks template children in a separate fragment, so a plain walk would
 *  miss an `onclick=` parked inside one. */
function walkElements(el, depth, visit) {
  visit(el, depth);
  for (const kid of el.children) walkElements(kid, depth + 1, visit);
  if (el.tagName === 'TEMPLATE' && el.content) {
    for (const kid of el.content.children) walkElements(kid, depth + 1, visit);
  }
}

/**
 * A signature of the element tree: every element, its nesting depth, its tag, and
 * all of its attributes.
 *
 * Text nodes and comments are deliberately absent — they are the surface a content
 * edit is allowed to change, and leaving them out is what makes "reword this
 * paragraph" pass while "wrap this paragraph in a div" fails.
 *
 * Attributes are sorted by name. Their names and values are all present, so nothing
 * is hidden; sorting only means that re-ordering two attributes on one tag is not
 * reported as a structural change, because it is not one.
 *
 * The nesting depth is written out as a NUMBER rather than as indentation. Moving a
 * tag one level in or out is the single most damaging edit on this site and it
 * changes nothing else about the tag, so a report that indented the two versions
 * would print two lines that look identical and tell Paul nothing.
 *
 * The ONE exception is `CONTENT_LANE_METADATA`: for those four tags the VALUE of
 * the single named text-carrying attribute is masked, because that value is
 * wording and this function's whole job is to leave wording out. The tag is still
 * there, at its depth, with all of its other attributes and with the identity
 * attribute that put it in the list — so removing it, adding one, moving it, or
 * renaming `name="description"` to `name="keywords"` all still register.
 */
function contentLaneCarrier(el) {
  return CONTENT_LANE_METADATA.find((m) => m.carries && m.match(el)) || null;
}

function elementTree(doc) {
  const lines = [];
  walkElements(doc.documentElement, 0, (el, depth) => {
    const carrier = contentLaneCarrier(el);
    const attrs = [...el.attributes]
      .map((a) => (carrier && a.name.toLowerCase() === carrier.carries
        ? `${a.name}="${MASKED}"`
        : `${a.name}="${a.value}"`))
      .sort()
      .join(' ');
    lines.push(`nesting level ${depth}: <${el.tagName.toLowerCase()}${attrs ? ' ' + attrs : ''}>`);
  });
  return lines;
}

/** Every `on…=` attribute on the page, keyed by where it sits, so "was one added"
 *  is answerable and not just "how many are there". */
function eventHandlers(doc) {
  const found = new Set();
  const trail = [];
  walkElements(doc.documentElement, 0, (el, depth) => {
    trail.length = depth;
    trail[depth] = el.tagName.toLowerCase();
    for (const a of el.attributes) {
      if (a.name.toLowerCase().startsWith('on')) {
        found.add(`${trail.slice(0, depth + 1).join('>')} ${a.name}="${a.value}"`);
      }
    }
  });
  return found;
}

function countMains(doc) {
  return doc.querySelectorAll('main').length;
}

function countOrbs(doc) {
  return doc.querySelectorAll(ORB_SELECTOR).length;
}

// ── The guards the reviewed-structural waiver stands on ──────────────────────
//
// These are not a second opinion about the element tree. Each one is an input
// `decidePlan` in `_lib/perch-main.js` genuinely reads, restated here, so that
// "the page still looks like the page that was reviewed" means something a
// reviewer could have checked rather than something this file asserts.

/** A tag as the injector would recognise it: name, id, and classes as a SET.
 *  Classes are sorted because `isNonContent` tests membership, not order. */
function elementSignature(el) {
  const id = el.getAttribute('id');
  const cls = (el.getAttribute('class') || '').trim().split(/\s+/).filter(Boolean).sort().join('.');
  return `${el.tagName.toLowerCase()}${id ? `#${id}` : ''}${cls ? `.${cls}` : ''}`;
}

/**
 * The site nav's div-ancestor stack, which is the ONLY thing `decidePlan` uses to
 * choose between wrapping at div level and wrapping at body level, and which
 * decides the two ordinals in the `wrap-div` case.
 *
 * A page with no `nav.menubar` gets an explicit "no site nav" reading rather than
 * an empty string. That distinction is the point: 47 pages here have no site nav,
 * and for those this guard is worth little on its own — which is exactly why the
 * body-children guard below is checked as well and not instead. A page that GAINS
 * or LOSES a nav still flips this value and still loses the waiver.
 */
function navAncestorSignature(doc) {
  const nav = doc.querySelector(SITE_NAV_SELECTOR);
  if (!nav) return '(no site nav on this page)';
  const chain = [];
  for (let el = nav; el && el.tagName !== 'BODY'; el = el.parentElement) chain.unshift(elementSignature(el));
  return chain.join(' > ');
}

/**
 * The ordered body children, which is what `decidePlan` counts in the `wrap-body`
 * case — `openBeforeBodyKid` is an index into this list and `closeBeforeBodyKid`
 * is found by walking it backwards through `isNonContent`.
 *
 * This is the guard that does the work on the eight nav-less roadmap posts. Their
 * nav signature is "no site nav" in both versions, so a nav-only guard would wave
 * them through without ever having looked at anything. Their body children are
 * what the injector reads, and this compares them.
 */
function bodyChildSignature(doc) {
  if (!doc.body) return '(no body)';
  return [...doc.body.children].map(elementSignature).join(' | ');
}

/**
 * How many elements would end up INSIDE `main#perch-main`.
 *
 * ── WHY THIS GUARD EXISTS AND THE OTHER TWO ARE NOT ENOUGH ──────────────────
 * The nav stack and the body children decide WHICH BRANCH `decidePlan` takes.
 * They do not decide what the container ends up holding. The single most damaging
 * edit on this site — moving the article inside `div.container`, the one the trap
 * suite demonstrates with the real rewriter — changes NEITHER of them: the nav
 * keeps its ancestors, the body keeps its children, and the container quietly
 * comes to hold the copyright line instead of the article. Without this guard the
 * waiver would wave that through on an allowlisted file.
 *
 * So this mirrors `decidePlan`'s two branches in jsdom and counts the region:
 *
 *   wrap-div  — everything between the nav's container end tag and its parent's,
 *               which is `contentElements` in that module, walked up the ancestor
 *               chain so it is right even when the container is not a direct child
 *               of the wrapper.
 *   wrap-body — the body children from just after the nav's own down to the
 *               trailing run of scripts and persistent layers, matching
 *               `isNonContent` there.
 *
 * A mirror can drift from what it mirrors, so it is not trusted on its word: the
 * `agrees with the real injector` control below runs lol-html over the same pages
 * and requires this count to move in the same direction as the real container's.
 */
const PERSISTENT_CLASS = 'dl-callbar';
const PERSISTENT_ID = 'dvn-perch-root';
const NON_CONTENT_TAGS = ['SCRIPT', 'NOSCRIPT', 'TEMPLATE'];

/**
 * Every element in the document, counted the same way `swapRegionElementCount`
 * counts the region.
 *
 * This is what separates a DELETION from a RELOCATION, and it is the whole basis
 * on which `REVIEWED_REMOVAL` is allowed to exist. Content that leaves the swap
 * container but stays on the page shrinks the region and leaves this number
 * untouched; content that is deleted shrinks both by the same amount. See the
 * register below.
 */
const elementCount = (doc) => doc.querySelectorAll('*').length;

function isNonContentKid(el) {
  if (NON_CONTENT_TAGS.includes(el.tagName)) return true;
  if (el.getAttribute('id') === PERSISTENT_ID) return true;
  return (el.getAttribute('class') || '').trim().split(/\s+/).includes(PERSISTENT_CLASS);
}

function swapRegionElementCount(doc) {
  const countTree = (el) => 1 + el.querySelectorAll('*').length;
  const nav = doc.querySelector(SITE_NAV_SELECTOR);

  if (nav) {
    const container = nav.closest('div');
    const wrapper = container?.parentElement?.closest('div');
    if (container && wrapper) {
      let n = 0;
      for (let node = container; node && node !== wrapper; node = node.parentElement) {
        for (let s = node.nextElementSibling; s; s = s.nextElementSibling) n += countTree(s);
      }
      // `contentElements > 0` is exactly the condition that keeps decidePlan on
      // the div branch; at zero it falls through to the body branch, so we do too.
      if (n > 0) return n;
    }
  }

  if (!doc.body) return 0;
  const kids = [...doc.body.children];
  let close = kids.length;
  while (close > 0 && isNonContentKid(kids[close - 1])) close--;
  const navKid = nav ? kids.findIndex((k) => k.contains(nav)) : -1;
  const open = navKid >= 0 ? navKid + 1 : 0;
  let n = 0;
  for (let i = open; i < close; i++) n += countTree(kids[i]);
  return n;
}

/**
 * Whether `page-structure` — and only `page-structure` — is waived for this file.
 *
 * Returns the reason it was waived, or the reason it was not. Exported so the
 * allowlist suite can drive it directly and so a future reader can see the answer
 * without reverse-engineering it out of a passing test.
 */
export function structuralWaiver(file, before, after) {
  const reviewed = REVIEWED_STRUCTURAL.get(file);
  if (!reviewed) {
    return { applies: false, why: `${file} is not on the reviewed-structural list` };
  }

  for (const [what, b, a] of [
    ['the site nav\'s div-ancestor stack', navAncestorSignature(before), navAncestorSignature(after)],
    ['the ordered body children', bodyChildSignature(before), bodyChildSignature(after)],
  ]) {
    if (b !== a) {
      return { applies: false, why: `${file} is on the reviewed-structural list, but ${what} changed (${b} → ${a}), so the review no longer describes this page` };
    }
  }

  // The swap region may GROW — that is what adding content to a reviewed page
  // looks like. It may shrink only under `REVIEWED_REMOVAL`, and only on the two
  // arithmetic conditions below; see that register for why a deletion is not the
  // failure this guard was written for, and why it still catches that failure.
  const regionBefore = swapRegionElementCount(before);
  const regionAfter = swapRegionElementCount(after);
  if (regionAfter < regionBefore) {
    const budget = REVIEWED_REMOVAL.get(file);
    const lost = regionBefore - regionAfter;
    const deleted = elementCount(before) - elementCount(after);

    if (budget === undefined) {
      return { applies: false, why: `${file} is on the reviewed-structural list, but the region the server would wrap in <main id="${CONTAINER_ID}"> SHRANK from ${regionBefore} elements to ${regionAfter} — content has moved out of the swap container, which is the failure this gate exists to catch` };
    }
    if (lost !== budget) {
      return { applies: false, why: `${file} is on the reviewed-removal list, but the region the server would wrap in <main id="${CONTAINER_ID}"> SHRANK by ${lost} elements (${regionBefore} → ${regionAfter}) and the reviewed removal deletes exactly ${budget} — the review describes a different edit to the one in front of it` };
    }
    if (deleted !== lost) {
      return { applies: false, why: `${file} is on the reviewed-removal list, but the region SHRANK by ${lost} elements while the page as a whole lost ${deleted} — the difference MOVED out of the swap container rather than being deleted, which is the failure this gate exists to catch` };
    }
  }

  // The three rules the waiver must never cover. Checked here as well as being
  // reported in their own right, so that a file which trips one of them loses the
  // structure waiver too and fails on BOTH counts rather than only the narrow one.
  if (countMains(after) > countMains(before)) {
    return { applies: false, why: `${file} is on the reviewed-structural list, but a <main> was added, which is never covered by a structural review` };
  }
  if (countOrbs(after) > countOrbs(before)) {
    return { applies: false, why: `${file} is on the reviewed-structural list, but a <div id="concierge"> was added, which is never covered by a structural review` };
  }
  const handlersBefore = eventHandlers(before);
  if ([...eventHandlers(after)].some((h) => !handlersBefore.has(h))) {
    return { applies: false, why: `${file} is on the reviewed-structural list, but an inline event handler was added, which is never covered by a structural review` };
  }

  return { applies: true, reason: reviewed };
}

// ── The comparison itself ────────────────────────────────────────────────────

/** Index of the first entry that differs between two lists, or -1. */
function firstDifference(before, after) {
  const n = Math.max(before.length, after.length);
  for (let i = 0; i < n; i++) if (before[i] !== after[i]) return i;
  return -1;
}

function show(value) {
  return value === undefined ? '(nothing)' : value;
}

/**
 * A readable excerpt of two long strings around the point where they first differ.
 *
 * Showing the first N characters instead would be worse than useless on the nav and
 * the footer: those subtrees open with a long identical tag, so the first 400
 * characters of the before and the after are usually the same 400 characters and
 * the reader is shown two blocks that look identical and told they differ.
 */
function excerptAround(before, after, span = 140) {
  if (!before.trim()) return ['(not present on this page)', after.trim().slice(0, span * 2)];
  if (!after.trim()) return [before.trim().slice(0, span * 2), '(no longer present on this page)'];

  let at = 0;
  while (at < before.length && at < after.length && before[at] === after[at]) at++;
  const from = Math.max(0, at - span);
  const cut = (s) => `${from > 0 ? '…' : ''}${s.slice(from, at + span).replace(/\s+/g, ' ')}${at + span < s.length ? '…' : ''}`;
  return [cut(before), cut(after)];
}

/**
 * Compare one page's before and after. Returns a list of `{ rule, message }`;
 * an empty list means the change was pure wording.
 *
 * The pull-request suite and the trap suite both go through this one function, so
 * the traps prove the behaviour of the code that actually gates the pull request
 * and not a parallel copy of it.
 */
export function comparePage(file, beforeSource, afterSource) {
  const before = parse(normaliseEol(beforeSource));
  const after = parse(normaliseEol(afterSource));
  const violations = [];
  const fail = (rule, message) => violations.push({ rule, message: `${file} — ${message}` });

  // 1. Scripts and stylesheets.
  const beforeAssets = assetManifest(before);
  const afterAssets = assetManifest(after);
  const assetAt = firstDifference(beforeAssets, afterAssets);
  // Consulted only AFTER a difference has been found, and it can suppress this one
  // rule and nothing else — the same shape the structural waiver has.
  const aWaiver = assetAt === -1
    ? { applies: false }
    : assetWaiver(file, beforeAssets, afterAssets);
  if (assetAt !== -1 && !aWaiver.applies) {
    fail(RULES.ASSETS, [
      'the scripts and stylesheets this page loads have changed, and a content edit must never change them.',
      `In position ${assetAt + 1} the page used to load:`,
      `    ${show(beforeAssets[assetAt])}`,
      'and now loads:',
      `    ${show(afterAssets[assetAt])}`,
      `(${beforeAssets.length} tags before, ${afterAssets.length} after.)`,
      'The click-to-call booking bar and the voice concierge are loaded by these tags. Adding, removing,',
      're-pointing or re-ordering any of them turns those features off without any other sign that it happened.',
      'Put the tags back exactly as they were, or ask an engineer to make this change.',
    ].join('\n'));
  }

  // 2. The piece of chrome that must survive a content edit untouched.
  //
  // ── WHY THE NAV IS NO LONGER COMPARED HERE (SHELDON-PAUL-NAV, #227) ────────
  //
  // `site-navigation` used to sit alongside the footer in this loop, comparing
  // each changed page's `nav.menubar` subtree against `origin/main`. It was the
  // right rule for as long as that subtree was what a visitor got. It is not any
  // more: `functions/_lib/nav-inject.js` replaces the whole subtree at the edge,
  // on all 113 nav-bearing pages, so the markup this loop was guarding is now
  // dead bytes that reach no browser and no crawler.
  //
  // A rule that guards markup nobody is served is worse than no rule. It reads
  // as coverage, it fails pull requests over text a visitor cannot see, and — the
  // reason it had to go rather than be relaxed — it says NOTHING about the nav
  // that actually ships, which is now the only nav there is. So the rule id moves
  // with the thing it names: `checkServedNav` below renders representative pages
  // through the real middleware and asserts the SERVED menu, and it fails under
  // the same `site-navigation` id with a sentence written for the same reader.
  //
  // What genuinely stopped being checked, stated plainly rather than left to be
  // discovered: a wording edit inside a page's own dead `nav.menubar` no longer
  // fails anything. `page-structure` still refuses to let that markup be
  // restructured, and `test/seo-crawlability.test.mjs` still resolves the hrefs
  // in it — but its words are now unguarded, because there is no longer anyone to
  // guard them for.
  for (const [rule, selector, english] of [
    [RULES.FOOTER, FOOTER_SELECTOR, 'the footer copyright line'],
  ]) {
    const b = subtree(before, selector);
    const a = subtree(after, selector);
    if (b !== a) {
      const [wasExcerpt, nowExcerpt] = excerptAround(b, a);
      fail(rule, [
        `${english} (\`${selector}\`) has changed, and a content edit must leave it exactly as it was.`,
        'Around the point where it changed, it was:',
        `    ${wasExcerpt}`,
        'and it is now:',
        `    ${nowExcerpt}`,
        'This region is shared with every other page. Changing it here makes this one page disagree with the',
        'rest of the site, and the wording in it is not this page\'s to change. Ask an engineer.',
      ].join('\n'));
    }
  }

  // 4. The element tree. Text is the only thing allowed to move.
  //
  // The waiver is consulted only AFTER a difference has been found, and it can
  // only ever suppress this one rule. Every other rule above and below runs
  // untouched on an allowlisted file — see `structuralWaiver`, which also
  // withdraws itself when one of those other rules would fire.
  const beforeTree = elementTree(before);
  const afterTree = elementTree(after);
  const treeAt = firstDifference(beforeTree, afterTree);
  const waiver = treeAt === -1 ? { applies: false } : structuralWaiver(file, before, after);
  if (treeAt !== -1 && !waiver.applies) {
    fail(RULES.TREE, [
      'the HTML structure of this page has changed. A content edit may change the WORDS on the page and',
      'nothing else — no new tags, no removed tags, no moved tags, no changed attributes.',
      `The first difference is at element ${treeAt + 1} of the page. It used to be:`,
      `    ${show(beforeTree[treeAt])}`,
      'and it is now:',
      `    ${show(afterTree[treeAt])}`,
      `(${beforeTree.length} elements before, ${afterTree.length} after. "Nesting level" is how deep inside`,
      'other tags this one sits — a tag that kept its name but changed level has been moved.)',
      'The server works out where to put the swap container, the persistent call layer, the page router and',
      'the booking bar by counting this page\'s own tags. Moving markup moves those to the wrong place, and',
      'the page still looks completely normal when it happens. Ask an engineer to make structural changes.',
    ].join('\n'));
  }

  // 5. The three specific additions that each break the injector in their own way.
  const mainsBefore = countMains(before);
  const mainsAfter = countMains(after);
  if (mainsAfter > mainsBefore) {
    fail(RULES.MAIN, [
      `a <main> element was added to this page (${mainsBefore} before, ${mainsAfter} after).`,
      'The server adds its own <main id="' + CONTAINER_ID + '"> to every page as it is served. When a page brings its',
      'own <main>, the server stops wrapping the page content and uses that one instead — so whatever your',
      '<main> happens to contain silently becomes "the page", and the rest of the page falls outside it.',
      'Remove the <main> element. If this page genuinely needs one, that is an engineering change.',
    ].join('\n'));
  }

  const orbsBefore = countOrbs(before);
  const orbsAfter = countOrbs(after);
  if (orbsAfter > orbsBefore) {
    fail(RULES.ORB, [
      `a <div id="concierge"> was added to this page (${orbsBefore} before, ${orbsAfter} after).`,
      'That id is how the server recognises the concierge SHELL page, which is the one page it must not touch.',
      'Adding it here makes the server skip this page completely: no swap container, no persistent call layer,',
      'no page router and no booking bar. The page will still look perfect and none of those will work.',
      'Use a different id.',
    ].join('\n'));
  }

  const handlersBefore = eventHandlers(before);
  const added = [...eventHandlers(after)].filter((h) => !handlersBefore.has(h));
  if (added.length) {
    fail(RULES.HANDLER, [
      `an inline event handler attribute was added to this page: ${added.length === 1 ? 'it is' : 'they are'}`,
      ...added.map((h) => `    ${h}`),
      'Handlers written directly on a tag (onclick, onchange, onload, …) do not run on this site. The security',
      'policy the server sends only permits script it has stamped, and a policy cannot stamp an attribute, so',
      'the browser refuses to run it. The element will look right and do nothing at all.',
      'Behaviour belongs in js/inline-actions.js. Ask an engineer.',
    ].join('\n'));
  }

  return violations;
}

/**
 * A page added by this pull request has no before state, so nothing can be
 * compared against it. Only the one rule that is wrong in isolation is applied:
 * an inline handler never works on this site regardless of what the page used to
 * look like. A brand-new page's structure is an engineering review, not a diff.
 */
export function auditNewPage(file, source) {
  const doc = parse(normaliseEol(source));
  const handlers = [...eventHandlers(doc)];
  if (!handlers.length) return [];
  return [{
    rule: RULES.HANDLER,
    message: [
      `${file} — this new page uses inline event handler attributes:`,
      ...handlers.map((h) => `    ${h}`),
      'Handlers written directly on a tag do not run on this site: the security policy the server sends only',
      'permits script it has stamped, and it cannot stamp an attribute. Behaviour belongs in js/inline-actions.js.',
    ].join('\n'),
  }];
}

// ── `site-navigation`, as the visitor gets it (SHELDON-PAUL-NAV, #227) ───────
//
// THE RULE THIS REPLACES compared a page's own `nav.menubar` bytes against
// `origin/main`. That question stopped being interesting the moment
// `functions/_lib/nav-inject.js` began replacing the whole subtree at the edge:
// the bytes it guarded are no longer served to anyone, and the menu that IS
// served came from a module the old rule never looked at.
//
// So the rule keeps its id and changes its subject. It renders a page through the
// REAL middleware — the same `onRequest` production runs, over the real lol-html
// build — and asserts the three things about the served menu that break silently:
//
//   1. THE ORDER. Nine items, in the order #227 fixes. A dropped or reordered
//      item is not a rendering fault; the page looks fine and a practice area is
//      simply unreachable. `practice.html` and the four tier roots have NO
//      inbound link anywhere on this site except this menu, so an item lost here
//      orphans a live page and nothing else reds.
//
//   2. THE MEMBERS DROPDOWN, resolved. Four tier links, each RESOLVED against the
//      page's own URL and required to land on a tier root, each still carrying its
//      `.brand-<tier>` span. Both halves are load-bearing and they are checked
//      separately because `js/members-gate.js` reads them separately: the resolved
//      pathname is its primary signal and the span is its documented fallback. The
//      resolution is what catches the trap this whole design turns on — `gold/`
//      served from `/members/about-membership.html` resolves to `/members/gold/`,
//      which is not a tier root, so the gate declines to intercept and the visitor
//      gets tier-auth's fail-closed 503 instead of the marketing card.
//
//   3. THE BINDING HOOKS. Every id and class `js/main.js` binds by name. jQuery
//      binding to nothing throws nothing — the hamburger simply stops opening the
//      menu, which is the exact failure CLAUDE.md §4 says nobody will notice.
//
//   4. THE TAX MENU, BOTH LEVELS (SHELDON-NAV-R2). Four first-level entries, and
//      the fifteen controversy pages nested under CONTROVERSY rather than spilled
//      flat beside them — in BOTH renderings, desktop and mobile, because the two
//      are built by different code paths and a group that nests on one and not the
//      other is a menu that reads correctly on a laptop and has nineteen items on
//      a phone. The three STATE pages are checked as an ordered triple of their
//      own: Florida, Massachusetts, Residency & Domicile. Order is the whole point
//      of R2's second change, and it is the one thing here that cannot fail
//      visibly — a menu with the states in the wrong order renders perfectly.
//
// It returns violations rather than asserting, so the trap suite can drive it with
// a deliberately broken served document and require it to bite —
// [[feedback_fixture_must_reproduce_the_defect]].

/** The nine labels, in order, taken from the module that emits them. */
const EXPECTED_TOP_LEVEL = TOP_LEVEL.map((i) => i.label);

// ── The TAX menu, derived from the same table the markup is built from ───────
//
// Derived, so this cannot drift from what ships; but the STATE order below is
// spelled out literally, because a check derived entirely from the table would
// pass on a table whose states had been reordered — which is exactly the defect
// R2's second change fixes. [[feedback_assessment_doc_is_not_code]]

const TAX_ITEM = TOP_LEVEL.find((i) => i.key === 'tax');
const CONTROVERSY_ITEM = TAX_ITEM.items.find((i) => i.key === 'controversy');

/** Labels are authored with HTML entities; the DOM hands back the character. */
const rendered = (label) => label.replace(/&amp;/g, '&');

const TAX_FIRST_LEVEL = TAX_ITEM.items.map((i) => rendered(i.label));
const CONTROVERSY_ITEMS = CONTROVERSY_ITEM.items.map((i) => rendered(i.label));

/** The three state pages, in R2's corrected order. Literal on purpose — see above. */
const STATE_ORDER = [
  'Florida Sales & Use Tax',
  'Massachusetts Tax Appeals',
  'Residency & Domicile',
];

/** Everything `js/main.js` looks up by name, as CSS selectors. */
const MAIN_JS_HOOKS = [
  '.hamburger', '.btn-close.menu', '.nav-mobile-overlay', '.dropdown', '.dropdown-menu',
  ...BOUND_IDS.map((id) => `#${id}`),
];

/**
 * Render one page the way production does.
 *
 * `globalThis.HTMLRewriter` is swapped for the wasm build and restored, because
 * `_middleware.js` reads it off the global exactly as the Workers runtime supplies
 * it — driving a copy of the middleware instead would prove only that the copy works.
 */
export async function serveThroughMiddleware(html, url) {
  const saved = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = HTMLRewriter;
  try {
    const res = await onRequest({
      request: new Request(url, { headers: { 'sec-fetch-dest': 'document' } }),
      env: {},
      next: async () => new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    });
    return await res.text();
  } finally {
    globalThis.HTMLRewriter = saved;
  }
}

/**
 * Check the served menu of one page. `pageUrl` is the URL it was served at, and it
 * is not decoration: every href is resolved against it.
 *
 * @returns {{rule: string, message: string}[]} empty when the menu is correct
 */
export function checkServedNav(file, servedHtml, pageUrl) {
  const doc = parse(normaliseEol(servedHtml));
  const violations = [];
  const fail = (message) => violations.push({ rule: RULES.NAV, message: `${file} — ${message}` });

  const nav = doc.querySelector(SITE_NAV_SELECTOR);
  if (!nav) {
    fail('this page is served with no site navigation menu at all. Every page that had one must keep one.');
    return violations;
  }

  const top = [...nav.querySelectorAll('#menu-desktop > li > a.nav-link')].map((a) => a.textContent.trim());
  if (top.join(' | ') !== EXPECTED_TOP_LEVEL.join(' | ')) {
    fail([
      'the top level of the served menu is not the agreed one.',
      `Expected, in order: ${EXPECTED_TOP_LEVEL.join(' · ')}`,
      `Served:             ${top.join(' · ') || '(nothing)'}`,
      'Practice Overview and the four member tiers are linked from nowhere else on the site, so an item lost',
      'here takes a live page off the map without anything else going red.',
    ].join('\n'));
  }

  // —— The CLIENT PORTAL item (2026-09-05: the four member tiers are retired) ————————————
  const portalItem = [...nav.querySelectorAll('#menu-desktop > li > a.nav-link')]
    .find((a) => a.textContent.trim() === 'CLIENT PORTAL');
  if (!portalItem) {
    fail('the CLIENT PORTAL item is missing from the served menu, so clients cannot find their way to Clio for Clients.');
  } else {
    // 2026-09-06: the item is Clio's own sign-in (their guidance to firms), opened in a
    // new tab so the visitor keeps the site. Absolute, so no page depth can bend it.
    const href = portalItem.getAttribute('href');
    if (href !== 'https://clients.clio.com/login') {
      fail(`the CLIENT PORTAL item is written "${href}"; it must be Clio's sign-in, https://clients.clio.com/login.`);
    }
    if (portalItem.getAttribute('target') !== '_blank' || !/noopener/.test(portalItem.getAttribute('rel') || '')) {
      fail('the CLIENT PORTAL item must open in a new tab with rel="noopener".');
    }
    if (portalItem.parentElement.querySelector('.dropdown-menu')) {
      fail('the CLIENT PORTAL item has a dropdown; it is a single link now that the member tiers are retired.');
    }
  }

  // ── The TAX menu, both levels (SHELDON-NAV-R2) ────────────────────────────
  //
  // Checked on BOTH renderings from one function, because the desktop panel and
  // the mobile accordion are emitted by different code paths in nav-inject.js and
  // the failure that matters — a group that nests in one and not the other — is
  // invisible unless both are asked the same question.
  const taxParent = [...nav.querySelectorAll('#menu-desktop > li > a.nav-link')]
    .find((a) => a.textContent.trim() === 'TAX');
  const mobileTax = [...nav.querySelectorAll('.nav-mobile-list > .mobile-parent')]
    .find((d) => d.querySelector('.mm-parent-label')?.textContent.trim() === 'TAX');

  for (const [where, panel] of [
    ['desktop', taxParent?.parentElement.querySelector('.dropdown-menu')],
    ['mobile', mobileTax?.querySelector('.collapse')],
  ]) {
    if (!panel) {
      fail(`the TAX menu has no ${where} panel at all, so the tax practice pages are unreachable there.`);
      continue;
    }

    // The first level is the panel's own children: three links and one group.
    // A group contributes its PARENT label, which is how a flattened menu — the
    // exact regression R2 reverses — shows up as fifteen extra entries here.
    const group = panel.querySelector(where === 'desktop' ? ':scope > .dl-subnav' : ':scope > .dl-subnav-mobile');
    const first = [...panel.children].map((el) => (el === group
      ? el.querySelector(where === 'desktop' ? '.dl-subnav-parent' : '.mm-parent-label')?.textContent.trim()
      : el.textContent.trim()));
    if (first.join(' | ') !== TAX_FIRST_LEVEL.join(' | ')) {
      fail([
        `the first level of the ${where} TAX menu is not the agreed one.`,
        `Expected, in order: ${TAX_FIRST_LEVEL.join(' · ')}`,
        `Served:             ${first.join(' · ') || '(nothing)'}`,
        'CONTROVERSY is a group, not a page list: the fifteen controversy pages belong behind it, not beside',
        'the three tax practice pages.',
      ].join('\n'));
    }

    if (!group) {
      fail(`the ${where} TAX menu has no nested CONTROVERSY group.`);
      continue;
    }

    // The group's own link. It is what keeps `/tax-controversy.html` inbound-linked
    // whether or not the group is ever opened.
    const parentLink = group.querySelector(where === 'desktop' ? '.dl-subnav-parent' : '.mm-parent-label');
    if (!parentLink || new URL(parentLink.getAttribute('href'), pageUrl).pathname !== '/tax-controversy.html') {
      fail(`the ${where} CONTROVERSY group does not itself link to /tax-controversy.html.`);
    }

    const sub = group.querySelector('.collapse');
    const nested = sub ? [...sub.querySelectorAll('a[href]')].map((a) => a.textContent.trim()) : [];
    if (nested.join(' | ') !== CONTROVERSY_ITEMS.join(' | ')) {
      fail([
        `the ${where} CONTROVERSY submenu is not the agreed one.`,
        `Expected ${CONTROVERSY_ITEMS.length}, in order: ${CONTROVERSY_ITEMS.join(' · ')}`,
        `Served ${nested.length}:${' '.repeat(Math.max(1, 12 - String(nested.length).length))}${nested.join(' · ') || '(nothing)'}`,
        'Every one of these pages is in sitemap.xml and this menu is the only place most of them are linked from.',
      ].join('\n'));
    }

    // The three state pages, as an ordered triple of their own. This is the check
    // that has to exist separately: a submenu with Residency ahead of the two
    // named states has the right pages, the right count, and renders perfectly.
    const states = nested.filter((label) => STATE_ORDER.includes(label));
    if (states.join(' | ') !== STATE_ORDER.join(' | ')) {
      fail([
        `the three state pages under ${where} CONTROVERSY are wrong.`,
        `Expected, in order: ${STATE_ORDER.join(' · ')}`,
        `Served:             ${states.join(' · ') || '(none of them)'}`,
        'Residency & Domicile is the general case of the two named-state pages and belongs after them.',
      ].join('\n'));
    }

    // The toggle. `aria-controls` pointing at a panel that is not there, or an
    // `aria-expanded` that was never emitted, is a control a screen reader
    // announces as inert — and neither shows on screen.
    const toggle = group.querySelector('[data-toggle="collapse"]');
    if (!toggle) {
      fail(`the ${where} CONTROVERSY group has no toggle, so the submenu cannot be opened.`);
    } else if (!sub || !sub.id || toggle.getAttribute('aria-controls') !== sub.id
      || toggle.getAttribute('data-target') !== `#${sub.id}`) {
      fail(`the ${where} CONTROVERSY toggle does not control its own submenu `
        + `(aria-controls="${toggle.getAttribute('aria-controls')}", panel id "${sub?.id || ''}").`);
    } else if (toggle.getAttribute('aria-expanded') !== 'false') {
      fail(`the ${where} CONTROVERSY toggle is served with aria-expanded="${toggle.getAttribute('aria-expanded')}"; `
        + 'a closed panel must say so.');
    }
  }

  // Every id the NAV emits, counted across the WHOLE document. Both halves are
  // deliberate. Scoped to the nav's own ids, because pages of this vintage carry
  // duplicate ids of their own — `business-formation.html` has two `#headingOne`
  // — and a nav ticket is not where those get fixed. Counted document-wide,
  // because that is where the collision would be: bootstrap's `data-target="#x"`
  // opens the FIRST `#x` in the document, so a generated id that happens to match
  // a page's own accordion toggles the article and leaves the menu shut. That is
  // the hazard `idPrefix` exists to dodge, and this is the assertion that it did.
  const navIdCounts = [...nav.querySelectorAll('[id]')].map((el) => el.id).filter(Boolean);
  const duplicated = [...new Set(navIdCounts)]
    .filter((id) => doc.querySelectorAll(`[id="${id}"]`).length > 1);
  if (duplicated.length) {
    fail(`these menu ids appear more than once on the served page: ${duplicated.join(', ')}. `
      + 'A duplicate id makes the menu toggle whichever element the parser saw first, which is not the menu.');
  }

  // ── The hooks js/main.js binds ────────────────────────────────────────────
  const missing = MAIN_JS_HOOKS.filter((sel) => !nav.querySelector(sel));
  if (missing.length) {
    fail([
      `the served menu is missing ${missing.join(', ')}.`,
      'js/main.js looks these up by name to open the mobile menu, close it, and drop the desktop panels down.',
      'jQuery finding nothing is silent — the menu simply stops responding, with no error anywhere.',
    ].join('\n'));
  }

  return violations;
}

// ── Reconstructing the before state ──────────────────────────────────────────

function git(args, cwd = ROOT) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
}

function gitOrNull(args, cwd = ROOT) {
  try {
    return git(args, cwd);
  } catch {
    return null;
  }
}

/**
 * ── WHY THIS IS A THREE-WAY VERDICT AND NOT A BOOLEAN (SARAH-CHROME-DIFF-REBASE-R1)
 *
 * R2 asked one question — "did a base resolve?" — and treated every no as a
 * failure. That is right for a pull request and wrong everywhere else, because it
 * folds two situations that are not the same thing:
 *
 *   CANNOT VERIFY   Something named a base to compare against — an operator set
 *                   CHROME_DIFF_BASE, or GitHub set GITHUB_BASE_REF, or the event
 *                   is a pull_request, or a base branch exists as a ref — but the
 *                   history needed to reconstruct the before state is not here.
 *                   A shallow checkout is exactly this. The gate MUST fail: there
 *                   is something to check and it cannot check it.
 *
 *   NOTHING TO GATE No base is named and none exists to discover. A push build is
 *                   exactly this: `deploy-pages.yml` runs the root suite on every
 *                   push with a bare checkout, and on a push there is no pull
 *                   request base, so there is no before state, no diff, and
 *                   nothing this gate has an opinion about. Failing there is not a
 *                   safety property — it is a false positive that would take the
 *                   production deploy down with it, since the production job needs
 *                   the test job.
 *
 * The distinction is load-bearing, so it is asserted rather than assumed: the
 * `base verdict` suite below drives this function over three real git repositories
 * built on disk — one with no base at all, one with a base named but unreachable,
 * one with a base that exists but shares no history — and requires a different
 * verdict for each. Collapse the two branches and those controls go red.
 *
 * `env` and `cwd` are parameters ONLY so those controls can drive it. Production
 * calls it with no arguments and gets the real process environment and repo.
 */
const BASE_STATUS = {
  GATED: 'gated',
  UNRESOLVED: 'unresolved',
  NOT_APPLICABLE: 'not-applicable',
};

function classifyBase({ cwd = ROOT, env = process.env } = {}) {
  // A base that was DECLARED. Someone or something asserted there is a before
  // state to compare against, so not finding it is a failure, never a pass.
  const declared = [
    env.CHROME_DIFF_BASE && { ref: env.CHROME_DIFF_BASE, why: 'CHROME_DIFF_BASE' },
    env.GITHUB_BASE_REF && { ref: `origin/${env.GITHUB_BASE_REF}`, why: 'GITHUB_BASE_REF' },
    env.GITHUB_BASE_REF && { ref: env.GITHUB_BASE_REF, why: 'GITHUB_BASE_REF' },
  ].filter(Boolean);

  // A base that was DISCOVERED. No one named it; it is simply the branch this
  // repo would be compared against if it were compared against anything.
  const discovered = [
    { ref: 'origin/main', why: 'origin/main exists' },
    { ref: 'main', why: 'main exists' },
  ];

  // A pull request always has a base by definition, whether or not the ref made
  // it into the checkout. Named separately so a PR whose GITHUB_BASE_REF is
  // missing still fails closed instead of degrading to "nothing to gate".
  const isPullRequest = /^pull_request/.test(env.GITHUB_EVENT_NAME || '');

  const reachable = [];
  for (const cand of [...declared, ...discovered]) {
    if (!gitOrNull(['rev-parse', '--verify', '--quiet', `${cand.ref}^{commit}`], cwd)) continue;
    reachable.push(cand);
    const merged = gitOrNull(['merge-base', cand.ref, 'HEAD'], cwd);
    if (merged && merged.trim()) {
      return { status: BASE_STATUS.GATED, ref: cand.ref, sha: merged.trim(), reason: `base ${cand.ref} (${cand.why})` };
    }
  }

  // Nothing resolved. Which of the two situations is it?
  if (declared.length) {
    return {
      status: BASE_STATUS.UNRESOLVED,
      ref: null,
      sha: null,
      reason: `a base was named (${declared[0].why}=${declared[0].ref}) but no commit could be reached from it`,
    };
  }
  if (isPullRequest) {
    return {
      status: BASE_STATUS.UNRESOLVED,
      ref: null,
      sha: null,
      reason: `this is a ${env.GITHUB_EVENT_NAME} event, which has a base by definition, but no base ref is present in this checkout`,
    };
  }
  if (reachable.length) {
    return {
      status: BASE_STATUS.UNRESOLVED,
      ref: null,
      sha: null,
      reason: `${reachable[0].ref} exists but shares no history with HEAD, so there is no commit to compare against`,
    };
  }
  return {
    status: BASE_STATUS.NOT_APPLICABLE,
    ref: null,
    sha: null,
    reason: 'no pull request base was named and no base branch exists in this checkout, so there is no before state and no change to compare',
  };
}

const BASE_HELP = [
  'The test could not work out which commit to compare this branch against, so it cannot tell what changed.',
  'It refuses to pass rather than report a clean result it has not actually checked.',
  '',
  'On a developer machine: run `git fetch origin main`, or set CHROME_DIFF_BASE to a commit.',
  'In GitHub Actions: the checkout step needs `fetch-depth: 0`. The default shallow checkout fetches a single',
  'commit, so there is no history to compare against and no `origin/main` to find.',
].join('\n');

/**
 * Every page in `donovan-legal-site/` that this branch touches, compared against
 * the base commit AND against the working tree, so uncommitted edits are gated too.
 *
 * Untracked files are listed separately because `git diff` cannot see them, and a
 * brand-new page that git has never heard of is precisely the kind of thing that
 * would otherwise slip past.
 */
function changedPages(baseSha) {
  const pages = new Map();
  const isGated = (p) => p.startsWith(GATED_PREFIX) && p.endsWith('.html');

  const diff = git(['diff', '--name-status', '--find-renames', baseSha, '--', GATED_PREFIX]);
  for (const line of diff.split('\n')) {
    if (!line.trim()) continue;
    const fields = line.split('\t');
    const status = fields[0][0];
    // A rename reports `R100 <old> <new>`: the old path is where the before state lives.
    const oldPath = fields[1];
    const newPath = fields[2] || fields[1];
    if (status === 'D') continue; // the page is gone; there is no "after" to check
    if (!isGated(newPath)) continue;
    pages.set(newPath, { path: newPath, beforePath: status === 'A' ? null : oldPath, status });
  }

  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', GATED_PREFIX]);
  for (const line of untracked.split('\n')) {
    const p = line.trim();
    if (!p || !isGated(p) || pages.has(p)) continue;
    pages.set(p, { path: p, beforePath: null, status: 'A' });
  }

  return [...pages.values()].sort((a, b) => a.path.localeCompare(b.path));
}

/** The file as it was at the base commit. Throws if git cannot produce it, which
 *  is a hard failure and never a skip. */
function readBefore(baseSha, repoPath) {
  return git(['show', `${baseSha}:${repoPath}`]);
}

function readWorking(repoPath) {
  return fs.readFileSync(path.join(ROOT, ...repoPath.split('/')), 'utf8');
}

const BASE_VERDICT = classifyBase();
const BASE = BASE_VERDICT.status === BASE_STATUS.GATED
  ? { ref: BASE_VERDICT.ref, sha: BASE_VERDICT.sha }
  : null;
const PAGES = BASE ? changedPages(BASE.sha) : [];

/**
 * The first line of every test that needs the before state.
 *
 * Returns true when the test should stop early because there is genuinely nothing
 * to gate — and ONLY then. When a base was expected and could not be reached this
 * fails, with the same message and the same fail-closed behaviour R2 shipped; the
 * `assert.ok(BASE, BASE_HELP)` that each caller already carries is left in place
 * behind it so neither path depends on this helper alone.
 */
function applyVerdict(verdict, t) {
  if (verdict.status === BASE_STATUS.GATED) return false;
  if (verdict.status === BASE_STATUS.UNRESOLVED) {
    assert.fail(`${BASE_HELP}\n\nWhat happened here: ${verdict.reason}`);
  }
  t?.diagnostic(`NOT APPLICABLE — ${verdict.reason}`);
  return true;
}

function notApplicable(t) {
  return applyVerdict(BASE_VERDICT, t);
}

// ── Suite 1: the gate can actually see the before state ──────────────────────

describe('SARAH-CHROME-DIFF — the before state can be reconstructed', () => {
  test('a base commit to compare against was found, or there is provably nothing to gate', (t) => {
    if (notApplicable(t)) return;
    assert.ok(BASE, BASE_HELP);
  });

  test('an unchanged page can be read back out of git, and comes back as real HTML', (t) => {
    if (notApplicable(t)) return;
    assert.ok(BASE, BASE_HELP);
    // A control, not a formality. `git show` on a missing path throws, but a
    // mis-resolved base or a bad path could return an empty string, and an empty
    // string parses into a valid empty document that agrees with everything. Every
    // page would then be reported clean. So the recovered bytes are checked for the
    // markers that make it this site's HTML before anything is trusted.
    const probe = 'donovan-legal-site/practice.html';
    const recovered = readBefore(BASE.sha, probe);
    assert.ok(recovered.length > 1000, `git show returned ${recovered.length} bytes for ${probe}; the before state was not recovered`);
    const doc = parse(normaliseEol(recovered));
    assert.ok(doc.querySelector(SITE_NAV_SELECTOR), `the page recovered for ${probe} has no ${SITE_NAV_SELECTOR}, so it is not the page that was asked for`);
    assert.ok(assetManifest(doc).length > 0, `the page recovered for ${probe} loads no scripts or stylesheets, so it is not a real page`);
  });

  test('comparing a page against itself reports nothing (control for the comparison)', (t) => {
    if (notApplicable(t)) return;
    assert.ok(BASE, BASE_HELP);
    const probe = 'donovan-legal-site/practice.html';
    const recovered = readBefore(BASE.sha, probe);
    assert.deepEqual(comparePage(probe, recovered, recovered), []);
  });

  test('line endings do not decide the answer', () => {
    // On Windows the working copy is CRLF and the git blob is LF. Without the
    // normalisation this is the difference that would fail every page.
    const lf = fs.readFileSync(path.join(ROOT, 'test/fixtures/chrome-diff/base-page.html'), 'utf8').replace(/\r\n?/g, '\n');
    const crlf = lf.replace(/\n/g, '\r\n');
    assert.notEqual(lf, crlf, 'control: the two spellings really are different bytes');
    assert.deepEqual(comparePage('base-page.html', lf, crlf), []);
  });

  test('the selectors this gate hardcodes are still the ones the server uses', () => {
    // If `_lib/perch-main.js` renames either selector, the checks above would go on
    // looking for something that is no longer there and would find nothing to
    // report. Anchored to that file's source so the rename lands here.
    const src = fs.readFileSync(path.join(ROOT, 'donovan-legal-site/functions/_lib/perch-main.js'), 'utf8');
    assert.ok(src.includes(`'${ORB_SELECTOR}'`), `_lib/perch-main.js no longer uses '${ORB_SELECTOR}'; this gate is looking for the wrong element`);
    assert.ok(src.includes(`'${SITE_NAV_SELECTOR}'`), `_lib/perch-main.js no longer uses '${SITE_NAV_SELECTOR}'; this gate is looking for the wrong element`);
  });
});

// ── Suite 1b: nothing to gate and cannot verify are different answers ────────
//
// The two-way split above decides whether a build goes red, so it is proved here
// rather than asserted by comment. These build REAL git repositories in a temp
// directory and run the real `classifyBase` over them — no stubbed git, no faked
// verdict object — because the whole failure this fixes was a wrong reading of
// what a git checkout actually contains.
//
// The pair that matters most is the shallow clone: ONE repository, in ONE state,
// read twice. Name a base and it must fail closed; name none and it must report
// not applicable. That is the difference under test, and holding the repository
// fixed is what stops it being a coincidence of two unrelated fixtures.

const GIT_ID = ['-c', 'user.name=Sarah QA', '-c', 'user.email=sarah@example.invalid', '-c', 'commit.gpgsign=false'];

function makeRepo(label, steps) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `chrome-diff-${label}-`));
  for (const args of steps) git([...GIT_ID, ...args], dir);
  return dir;
}

function writeAndCommit(dir, name, body, message) {
  fs.writeFileSync(path.join(dir, name), body);
  git([...GIT_ID, 'add', name], dir);
  git([...GIT_ID, 'commit', '-m', message], dir);
}

describe('SARAH-CHROME-DIFF — "nothing to gate" and "cannot verify" are told apart', () => {
  // A push build with a bare checkout, reproduced: a repository with no base
  // branch and nothing naming one.
  const noBase = makeRepo('nobase', [['init', '-b', 'work']]);
  writeAndCommit(noBase, 'page.html', '<p>hello</p>', 'initial');

  // A full repository with a real base branch, used as the source for the clone
  // below and as the control that this harness can produce a GATED verdict at all.
  const full = makeRepo('full', [['init', '-b', 'main']]);
  writeAndCommit(full, 'page.html', '<p>hello</p>', 'base commit');
  git([...GIT_ID, 'checkout', '-b', 'feature'], full);
  writeAndCommit(full, 'page.html', '<p>hello there</p>', 'feature commit');

  // The exact thing `actions/checkout@v4` leaves behind without `fetch-depth: 0`:
  // one commit of one branch, and no `origin/main` anywhere in it.
  const shallowParent = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-diff-shallow-'));
  const shallow = path.join(shallowParent, 'checkout');
  git([...GIT_ID, 'clone', '--depth', '1', '--branch', 'feature',
    `file://${full.replace(/\\/g, '/')}`, shallow], shallowParent);

  test('CONTROL: the harness can produce a gated verdict, so a non-gated one means something', () => {
    const verdict = classifyBase({ cwd: full, env: {} });
    assert.equal(verdict.status, BASE_STATUS.GATED, `expected the full repository to gate; got: ${verdict.reason}`);
    assert.match(verdict.sha, /^[0-9a-f]{40}$/, 'a gated verdict must carry a real commit to compare against');
    assert.equal(applyVerdict(verdict, null), false, 'a gated verdict must let the gate run');
  });

  test('CONTROL: the shallow clone really is shallow and really has no base ref', () => {
    // Without this the two verdicts below could both be right about the wrong
    // repository. `origin/main` must be absent for the pair to mean anything.
    assert.ok(fs.existsSync(path.join(shallow, '.git', 'shallow')), 'the clone is not shallow, so it does not reproduce the CI checkout');
    assert.equal(gitOrNull(['rev-parse', '--verify', '--quiet', 'origin/main^{commit}'], shallow), null,
      'origin/main resolved in the shallow clone, so this fixture is not the situation it claims to be');
    assert.ok(gitOrNull(['rev-parse', '--verify', '--quiet', 'HEAD^{commit}'], shallow), 'control: the clone does have a HEAD');
  });

  test('NOT APPLICABLE: a push build with no base named reports not applicable and PASSES', () => {
    const verdict = classifyBase({ cwd: shallow, env: { GITHUB_EVENT_NAME: 'push' } });
    assert.equal(verdict.status, BASE_STATUS.NOT_APPLICABLE, `expected not-applicable; got ${verdict.status}: ${verdict.reason}`);
    assert.equal(applyVerdict(verdict, null), true, 'a not-applicable verdict must pass the gate, not fail it');
  });

  test('FAIL CLOSED: the SAME shallow clone, with a base named, still fails', () => {
    // Same directory, same commits, same everything as the test above. The only
    // difference is that GITHUB_BASE_REF names a base — and that alone must flip
    // the answer from pass to fail.
    const verdict = classifyBase({ cwd: shallow, env: { GITHUB_EVENT_NAME: 'pull_request', GITHUB_BASE_REF: 'main' } });
    assert.equal(verdict.status, BASE_STATUS.UNRESOLVED, `expected fail-closed; got ${verdict.status}: ${verdict.reason}`);
    assert.throws(() => applyVerdict(verdict, null), assert.AssertionError, 'an unresolved verdict must fail the gate');
    assert.throws(() => applyVerdict(verdict, null), /fetch-depth: 0/, 'the failure must still tell the operator how to fix it');
  });

  test('FAIL CLOSED: an operator-pinned base that cannot be reached fails', () => {
    const verdict = classifyBase({ cwd: noBase, env: { CHROME_DIFF_BASE: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef' } });
    assert.equal(verdict.status, BASE_STATUS.UNRESOLVED, `expected fail-closed; got ${verdict.status}: ${verdict.reason}`);
    assert.throws(() => applyVerdict(verdict, null), assert.AssertionError);
  });

  test('FAIL CLOSED: a pull request event with no base ref at all still fails', () => {
    // The belt-and-braces case. If GITHUB_BASE_REF ever goes missing on a pull
    // request, the event name alone must keep the gate closed — a pull request has
    // a base by definition, so "no base named" is never the right reading of one.
    const verdict = classifyBase({ cwd: noBase, env: { GITHUB_EVENT_NAME: 'pull_request' } });
    assert.equal(verdict.status, BASE_STATUS.UNRESOLVED, `expected fail-closed; got ${verdict.status}: ${verdict.reason}`);
    assert.throws(() => applyVerdict(verdict, null), assert.AssertionError);
  });

  test('FAIL CLOSED: a base branch that exists but shares no history fails', () => {
    // Not a shallow checkout: `main` is right there and resolves. The history just
    // cannot be reconstructed from it. Discovery-availability has to fail closed
    // too, or the only protected case would be the one an env var announces.
    const orphan = makeRepo('orphan', [['init', '-b', 'main']]);
    writeAndCommit(orphan, 'page.html', '<p>hello</p>', 'main commit');
    git([...GIT_ID, 'checkout', '--orphan', 'feature'], orphan);
    fs.rmSync(path.join(orphan, 'page.html'));
    writeAndCommit(orphan, 'other.html', '<p>unrelated</p>', 'orphan commit');

    assert.ok(gitOrNull(['rev-parse', '--verify', '--quiet', 'main^{commit}'], orphan),
      'control: main really does exist here, so this is not the missing-ref case again');
    const verdict = classifyBase({ cwd: orphan, env: {} });
    assert.equal(verdict.status, BASE_STATUS.UNRESOLVED, `expected fail-closed; got ${verdict.status}: ${verdict.reason}`);
    assert.throws(() => applyVerdict(verdict, null), assert.AssertionError);
  });

  test('the three verdicts are three distinct answers, not one answer worded differently', () => {
    const statuses = [
      classifyBase({ cwd: full, env: {} }).status,
      classifyBase({ cwd: shallow, env: { GITHUB_EVENT_NAME: 'push' } }).status,
      classifyBase({ cwd: shallow, env: { GITHUB_EVENT_NAME: 'pull_request', GITHUB_BASE_REF: 'main' } }).status,
    ];
    assert.equal(new Set(statuses).size, 3, `the gate collapsed distinct situations into the same verdict: ${statuses.join(', ')}`);
  });
});

// ── Suite 2: the pages this pull request actually changes ────────────────────

describe('SARAH-CHROME-DIFF — every page changed in this pull request', () => {
  test(`scope: ${PAGES.length} changed page(s) under ${GATED_PREFIX}`, (t) => {
    // Reported rather than asserted. Zero is the right answer on `main` and on any
    // branch that changes no page; it is the trap suite below, not this number,
    // that proves the comparison works.
    if (notApplicable(t)) return;
    assert.ok(BASE, BASE_HELP);
    for (const p of PAGES) assert.ok(typeof p.path === 'string');
  });

  for (const page of PAGES) {
    const label = page.beforePath === null
      ? `${page.path} (new page — inline handlers only)`
      : `${page.path} — wording changed, chrome did not`;
    test(label, () => {
      const after = readWorking(page.path);
      const violations = page.beforePath === null
        ? auditNewPage(page.path, after)
        : comparePage(page.path, readBefore(BASE.sha, page.beforePath), after);
      assert.deepEqual(
        violations.map((v) => v.rule),
        [],
        `\n\n${violations.map((v) => v.message).join('\n\n')}\n`,
      );
    });
  }
});

// ── Suite 3: the traps — proof the gate bites ────────────────────────────────
//
// Each trap is one visible mutation of test/fixtures/chrome-diff/base-page.html,
// which is a miniature of the shape 92 of the site's pages use. Every trap must
// (a) be caught, (b) be caught by its OWN rule with its own sentence, and (c) be
// distinguishable from every other trap by which rules it trips.

const FIXTURE = fs.readFileSync(path.join(ROOT, 'test/fixtures/chrome-diff/base-page.html'), 'utf8').replace(/\r\n?/g, '\n');

/** The content block, lifted whole, so the "moved markup" trap moves real markup. */
const CONTENT_BLOCK = FIXTURE.match(/ {6}<div class="content-block">[\s\S]*?\n {6}<\/div>\n/)[0];

const TRAPS = [
  {
    name: 'a <script src> is dropped',
    rule: RULES.ASSETS,
    shows: '/js/donovan-widget.js',
    breaks: 'the booking widget stops being loaded at all',
    mutate: (html) => html.replace('  <script src="/js/donovan-widget.js" defer></script>\n', ''),
  },
  {
    name: 'the footer copyright is edited',
    rule: RULES.FOOTER,
    shows: '2027',
    breaks: 'this page\'s footer disagrees with the other 81',
    mutate: (html) => html.replace('Donovan Legal PLLC. 2026.', 'Donovan Legal PLLC. 2027.'),
  },
  {
    name: 'markup is moved inside div.container',
    rule: RULES.TREE,
    shows: 'nesting level 5: <div class="content-block">',
    breaks: 'the swap container still exists but wraps the copyright line instead of the article',
    mutate: (html) => html
      .replace(CONTENT_BLOCK, '')
      .replace('        </nav>\n      </div>\n', '        </nav>\n' + CONTENT_BLOCK.replace(/^ {6}/gm, '        ') + '      </div>\n'),
  },
  {
    name: 'a <main> element is added',
    rule: RULES.MAIN,
    shows: '(0 before, 1 after)',
    breaks: 'the server stops wrapping the content and stamps this element instead',
    mutate: (html) => html
      .replace('      <div class="content-block">', '      <main class="content-block">')
      .replace('      </div>\n      <div class="copy-inside', '      </main>\n      <div class="copy-inside'),
  },
  {
    name: 'a <div id="concierge"> is added',
    rule: RULES.ORB,
    shows: '(0 before, 1 after)',
    breaks: 'the page is mistaken for the concierge shell and skipped entirely',
    mutate: (html) => html.replace('  <div class="box">', '  <div id="concierge"></div>\n  <div class="box">'),
  },
  {
    name: 'an onclick= handler is added',
    rule: RULES.HANDLER,
    shows: 'onclick="alert(1)"',
    breaks: 'the security policy refuses to run it, so the element silently does nothing',
    // Deliberately on a paragraph in the page body rather than on the disclaimer
    // link in the footer: a handler added inside `.copy-inside` would also trip the
    // footer rule, and this trap has to be readable as its own failure.
    mutate: (html) => html.replace('<p class="lead">', '<p class="lead" onclick="alert(1)">'),
  },
];

describe('SARAH-CHROME-DIFF — the traps, and that the gate bites on each', () => {
  const firedByTrap = new Map();

  test('the fixture the traps mutate is itself clean', () => {
    assert.deepEqual(comparePage('base-page.html', FIXTURE, FIXTURE), []);
  });

  for (const trap of TRAPS) {
    test(`trap: ${trap.name} → ${trap.rule}`, () => {
      const mutated = trap.mutate(FIXTURE);
      assert.notEqual(mutated, FIXTURE, 'the mutation did not change the fixture, so this trap tests nothing');

      const violations = comparePage('base-page.html', FIXTURE, mutated);
      const fired = violations.map((v) => v.rule);
      firedByTrap.set(trap.name, fired.slice().sort().join('+'));

      assert.ok(
        fired.includes(trap.rule),
        `this trap should have been caught by the "${trap.rule}" rule; what fired was: ${fired.join(', ') || '(nothing at all)'}`,
      );

      // The message is the deliverable — Paul reads it, not the rule id. A message
      // that only NAMES the rule leaves a non-developer with nowhere to go, so it
      // must also name the file and quote the thing that actually changed. The
      // `shows` string is that quote, and asserting on it is what stops the
      // reporting from silently degrading into "something changed somewhere".
      const message = violations.find((v) => v.rule === trap.rule).message;
      assert.ok(message.startsWith('base-page.html — '), `the message must name the file it is about; it said: ${message}`);
      assert.ok(message.length > 200, 'the message must explain the rule in plain English, not just name it');
      assert.ok(
        message.includes(trap.shows),
        `the message must show what changed — it should quote ${JSON.stringify(trap.shows)}, but it said:\n${message}`,
      );
    });
  }

  test('each trap is distinguishable from every other trap', () => {
    // Several traps also trip the structure rule, because adding a tag IS a change
    // of structure. That overlap is defence in depth, not a bug — but each trap must
    // still produce a combination no other trap produces, or a failure could not be
    // read back to a cause.
    const signatures = [...firedByTrap.values()];
    assert.equal(signatures.length, TRAPS.length, 'a trap did not run, so its signature is missing');
    assert.equal(new Set(signatures).size, TRAPS.length, `two traps fire identically: ${signatures.join(' | ')}`);
  });
});

// ── Suite 4: the traps are real defects, not invented rules ──────────────────
//
// A gate is only worth its false positives if the thing it forbids actually
// breaks. These run the REAL injector — lol-html, the same parser Cloudflare runs
// — over the trapped pages and show the damage.

describe('SARAH-CHROME-DIFF — the three structural traps really do break the injector', () => {
  const trap = (name) => TRAPS.find((t) => t.name === name).mutate(FIXTURE);

  async function inject(html) {
    const plan = await planFromHtml(html, HTMLRewriter);
    let rewriter = new HTMLRewriter();
    for (const [selector, handler] of injectHandlers(plan)) rewriter = rewriter.on(selector, handler);
    return { plan, html: await rewriter.transform(new Response(html)).text() };
  }

  test('control: the untouched fixture gets a container that holds the article', async () => {
    const { plan, html } = await inject(FIXTURE);
    assert.equal(plan.kind, 'wrap-div');
    const container = parse(html).querySelector(`main#${CONTAINER_ID}`);
    assert.ok(container, 'the control page must get a container, or the trap comparisons below mean nothing');
    assert.ok(container.querySelector('h1'), 'the control container must hold the article');
  });

  test('adding a <main> flips the plan from wrapping the content to stamping that element', async () => {
    const { plan } = await inject(trap('a <main> element is added'));
    assert.equal(plan.kind, 'stamp', 'expected the injector to stop wrapping and stamp the page\'s own <main>');
  });

  test('adding <div id="concierge"> makes the injector skip the page entirely', async () => {
    const { plan } = await inject(trap('a <div id="concierge"> is added'));
    assert.deepEqual(plan, { kind: 'skip', reason: 'perch shell' });
  });

  test('moving markup inside div.container leaves a container that no longer holds the article', async () => {
    const control = await inject(FIXTURE);
    const moved = await inject(trap('markup is moved inside div.container'));

    const controlMain = parse(control.html).querySelector(`main#${CONTAINER_ID}`);
    const movedMain = parse(moved.html).querySelector(`main#${CONTAINER_ID}`);

    // This is the whole reason the structure rule exists. A "does the container
    // exist" check passes on BOTH of these. The difference is what is inside it.
    assert.ok(movedMain, 'the container still exists after the move — that is exactly what makes this failure silent');
    assert.ok(controlMain.querySelector('h1'), 'control: the article is inside the container before the move');
    assert.equal(movedMain.querySelector('h1'), null, 'after the move the article is OUTSIDE the swap container');
    assert.ok(
      movedMain.textContent.trim().length < controlMain.textContent.trim().length / 2,
      `the moved container should be a fraction of the real one; it held ${movedMain.textContent.trim().length} characters against ${controlMain.textContent.trim().length}`,
    );
  });
});

// ── Suite 5: the thing the content lane is FOR must still pass ───────────────

describe('SARAH-CHROME-DIFF — a pure wording edit passes clean', () => {
  test('rewriting a paragraph reports nothing', () => {
    const edited = FIXTURE.replace(
      'We represent taxpayers before the IRS at every stage of a controversy.',
      'We represent taxpayers before the IRS at every stage of a controversy, from the first notice through Tax Court.',
    );
    assert.notEqual(edited, FIXTURE, 'control: the edit really did change the page');
    assert.deepEqual(comparePage('base-page.html', FIXTURE, edited), []);
  });

  test('rewriting a heading reports nothing', () => {
    const edited = FIXTURE.replace('<h2>What we handle</h2>', '<h2>What we handle for you</h2>');
    assert.notEqual(edited, FIXTURE);
    assert.deepEqual(comparePage('base-page.html', FIXTURE, edited), []);
  });

  test('rewording a paragraph on a REAL site page reports nothing', (t) => {
    // The fixture is a miniature. This runs the same edit against a real 33 KB page
    // reconstructed out of git — 471 elements, 18 script and link tags, the four-deep
    // nav and the footer — because a gate that only ever passes on a toy page has not
    // been shown to leave the content lane usable.
    if (notApplicable(t)) return;
    assert.ok(BASE, BASE_HELP);
    const probe = 'donovan-legal-site/practice.html';
    const original = readBefore(BASE.sha, probe);
    const sentence = 'The same practitioner carries an engagement across all of it.';
    assert.ok(original.includes(sentence), `the sentence this test rewords is no longer in ${probe}; pick another`);
    const reworded = original.replace(sentence, 'One practitioner carries the engagement from start to finish, across every one of those areas.');
    assert.deepEqual(comparePage(probe, original, reworded), []);
  });

  // ── The metadata text carriers (SARAH-CHROMEDIFF-SCOPE-R3) ────────────────
  //
  // The fixture ships no description of either kind, and this order is scoped to
  // this file, so the BEFORE state is built here instead of by editing the
  // fixture. That is the honest construction anyway: the page that must survive a
  // reword is one that already has the tag, and the control below proves that
  // ADDING the tag in the first place is still a structural change.

  const WITH_DESCRIPTIONS = FIXTURE.replace(
    '  <title>',
    [
      '  <meta name="description" content="Tax controversy representation in Delray Beach, Florida.">',
      '  <meta property="og:title" content="Tax Controversy — Donovan Legal PLLC">',
      '  <meta property="og:description" content="Audit defense, Appeals and litigation.">',
      '  <meta property="og:url" content="https://www.donovan.law/tax-controversy">',
      '  <title>',
    ].join('\n'),
  );

  test('control: the descriptions really were added, and adding them IS structural', () => {
    assert.notEqual(WITH_DESCRIPTIONS, FIXTURE, 'the fixture variant was not built, so the tests below prove nothing');
    // Masking a value must never become "meta tags are invisible". A page that
    // gains one of these tags has changed shape and must still be caught.
    assert.deepEqual(
      comparePage('base-page.html', FIXTURE, WITH_DESCRIPTIONS).map((v) => v.rule),
      [RULES.TREE],
      'adding a <meta> must still fail the structure rule',
    );
  });

  test('rewriting the meta description reports nothing', () => {
    // CLAUDE.md §2 puts this inside the content lane. Before SCOPE-R3 it was read
    // as an attribute change and failed `page-structure` — the lane's own edit
    // failing the lane's own gate.
    const edited = WITH_DESCRIPTIONS.replace(
      'Tax controversy representation in Delray Beach, Florida.',
      'IRS and Florida tax controversy counsel: audits, Appeals, collection and Tax Court.',
    );
    assert.notEqual(edited, WITH_DESCRIPTIONS, 'control: the edit really did change the page');
    assert.deepEqual(comparePage('base-page.html', WITH_DESCRIPTIONS, edited), []);
  });

  test('rewriting the og:title and og:description reports nothing', () => {
    const edited = WITH_DESCRIPTIONS
      .replace('content="Tax Controversy — Donovan Legal PLLC"', 'content="Tax Controversy Representation — Donovan Legal PLLC"')
      .replace('Audit defense, Appeals and litigation.', 'Audit defense, Appeals, collection alternatives and litigation.');
    assert.notEqual(edited, WITH_DESCRIPTIONS);
    assert.deepEqual(comparePage('base-page.html', WITH_DESCRIPTIONS, edited), []);
  });

  test('rewriting the <title> reports nothing', () => {
    const edited = FIXTURE.replace(/(<title>)[^<]*(<\/title>)/, '$1Tax Controversy Representation | Donovan Legal PLLC$2');
    assert.notEqual(edited, FIXTURE, 'control: the fixture really does carry a title to rewrite');
    assert.deepEqual(comparePage('base-page.html', FIXTURE, edited), []);
  });

  test('the masking is keyed on identity, so a tag cannot rename its way in', () => {
    // `name="description"` is what puts the tag in the list. Change that and the
    // exemption must not follow the tag.
    const renamed = WITH_DESCRIPTIONS.replace('<meta name="description"', '<meta name="keywords"');
    assert.deepEqual(
      comparePage('base-page.html', WITH_DESCRIPTIONS, renamed).map((v) => v.rule),
      [RULES.TREE],
      'renaming the identity attribute must still fail the structure rule',
    );
  });

  test('the other head metadata is NOT waved through', () => {
    // The exemption covers wording. It must not cover where a shared link points,
    // what image it shows, or whether the page is indexed at all.
    for (const [what, from, to] of [
      ['og:url', 'content="https://www.donovan.law/tax-controversy"', 'content="https://example.invalid/elsewhere"'],
      ['the canonical link', 'rel="canonical"', 'rel="alternate"'],
      ['the viewport', 'width=device-width, initial-scale=1', 'width=900'],
    ]) {
      const edited = WITH_DESCRIPTIONS.replace(from, to);
      assert.notEqual(edited, WITH_DESCRIPTIONS, `control: the ${what} edit changed nothing`);
      assert.deepEqual(
        comparePage('base-page.html', WITH_DESCRIPTIONS, edited).map((v) => v.rule),
        [RULES.TREE],
        `changing ${what} must still fail the structure rule`,
      );
    }
  });

  test('changing wording in several paragraphs at once reports nothing', () => {
    const edited = FIXTURE
      .replace('Audit defense, Appeals, collection alternatives, and litigation.', 'Audit defense, Appeals, collection alternatives, litigation, and criminal referrals.')
      .replace('<h1>Tax Controversy</h1>', '<h1>Tax Controversy Representation</h1>');
    assert.notEqual(edited, FIXTURE);
    assert.deepEqual(comparePage('base-page.html', FIXTURE, edited), []);
  });
});

// ── Suite 6: the reviewed-structural allowlist cannot go broad ───────────────
//
// A per-file waiver is the most dangerous thing in this file, because it is the
// one mechanism whose PURPOSE is to let a structural change through. Everything
// else here fails closed; this fails open by design, on a named list. So it is
// held to the two properties that make it a waiver rather than a hole:
//
//   1. it reaches EXACTLY the files on the list and no others — not a near-miss
//      filename, not a sibling, not a page that merely looks similar;
//   2. it suppresses EXACTLY one rule — a listed file that adds a <main>, an orb
//      or an inline handler is still caught, and loses the structure waiver too.
//
// Both are driven through `comparePage`, the same function that gates the pull
// request, over the same fixture the seven traps mutate.

const ALLOWLISTED = 'donovan-legal-site/tax-controversy.html';
const NOT_ALLOWLISTED = 'donovan-legal-site/tax-controversy-2.html';

const mutation = (name) => TRAPS.find((t) => t.name === name).mutate;

/** The roadmap posts' edit, reproduced on the fixture: one paragraph carrying one
 *  cross-link, added to the page content. Nine of the ten pages on the list made
 *  exactly this change. */
const addParagraph = (html) => html.replace(
  '<h2>What we handle</h2>',
  '<h2>What we handle</h2>\n        <p>For how the firm handles each stage, see <a href="tax-controversy.html">Tax Controversy</a>.</p>',
);

// ── JORDAN-TOOL-DEDUPE (#232): the removal budget, on the fixture ────────────
//
// A miniature of the legacy block the six tool pages drop — four elements (the
// wrapper, an <h4>, a <p> and the link) sitting in the swap region as a later
// sibling of the content, which is where the real one sits. Four is the budget
// every one of those six files declares, so the fixture can drive the exact
// arithmetic `structuralWaiver` performs on them rather than an analogue of it.

const REMOVAL_ALLOWLISTED = 'donovan-legal-site/tool-capital-gains.html';

const LEGACY_CTA = [
  '      <div class="tool-cta">',
  '        <h4>Need Help With Your Specific Matter?</h4>',
  '        <p>To discuss your specific situation with the firm, contact us directly.</p>',
  '        <a href="contact.html" class="cta-link">Contact The Firm</a>',
  '      </div>',
  '',
].join('\n');

/** The fixture as it looks BEFORE the de-duplication: two calls to action. */
const WITH_LEGACY_CTA = FIXTURE.replace('      <div class="copy-inside', LEGACY_CTA + '      <div class="copy-inside');

/** The same block moved inside div.container — shrinks the region, deletes nothing. */
const LEGACY_CTA_RELOCATED = WITH_LEGACY_CTA
  .replace(LEGACY_CTA, '')
  .replace('        </nav>\n      </div>\n', '        </nav>\n' + LEGACY_CTA.replace(/^ {6}/gm, '        ') + '      </div>\n');

describe('SARAH-CHROME-DIFF — the reviewed-structural allowlist cannot go broad', () => {
  test('CONTROL: the list is a closed set of the files that were actually reviewed', () => {
    assert.ok(REVIEWED_STRUCTURAL.has(ALLOWLISTED), 'the fixture stands in for a file that is on the list');
    assert.ok(!REVIEWED_STRUCTURAL.has(NOT_ALLOWLISTED), 'the near-miss name must NOT be on the list');
    // 112 → 113: JAY-TRACKING-B2 added disclaimer.html for the analytics disclosure
    // and the consent opt-out control. Evidence: scripts/content/consent-waiver-evidence.mjs.
    // 113 → 127: OFFICE-PHONE added the fourteen pages whose `dl-connect-cta` tel:
    // href changes when the firm's published number reverts to (561) 666-6022. The
    // waived difference is an ATTRIBUTE VALUE on an existing <a> — no element added,
    // removed or moved — and `planFromHtml` over the before and after of all fourteen
    // produced byte-identical plans, so the injector places the container, the layer,
    // the router and the booking bar exactly where it did before.
    assert.equal(REVIEWED_STRUCTURAL.size, 127, 'the list grew or shrank without this test being revisited');
    for (const [file, reason] of REVIEWED_STRUCTURAL) {
      assert.ok(file.startsWith(GATED_PREFIX) && file.endsWith('.html'), `${file} is not a gated page path`);
      assert.ok(reason.length > 60, `${file} has no real written reason, and an unexplained waiver is not auditable`);
    }
  });

  test('CONTROL: the waived change really is one the gate would otherwise refuse', () => {
    const added = addParagraph(FIXTURE);
    assert.notEqual(added, FIXTURE, 'the control mutation changed nothing, so it proves nothing');
    assert.deepEqual(
      comparePage(NOT_ALLOWLISTED, FIXTURE, added).map((v) => v.rule),
      [RULES.TREE],
      'adding a paragraph must be a structural change for a file nobody reviewed',
    );
    // Same bytes, reviewed file: the waiver applies and the page comes back clean.
    assert.deepEqual(comparePage(ALLOWLISTED, FIXTURE, added), [],
      'the reviewed file must be allowed the change that was reviewed');
  });

  // ── TRAP 8 ──────────────────────────────────────────────────────────────────
  test('trap: a page that is NOT on the list still reds on page-structure', () => {
    const moved = mutation('markup is moved inside div.container')(FIXTURE);
    const violations = comparePage(NOT_ALLOWLISTED, FIXTURE, moved);
    const fired = violations.map((v) => v.rule);

    assert.ok(fired.includes(RULES.TREE),
      `an unreviewed file with moved markup must still fail page-structure; what fired was: ${fired.join(', ') || '(nothing at all)'}`);
    // The near-miss name is the point: `tax-controversy-2.html` shares a prefix
    // with a listed file. If matching ever became "starts with" or "contains",
    // this is the test that goes red.
    const waiver = structuralWaiver(NOT_ALLOWLISTED, parse(FIXTURE), parse(moved));
    assert.equal(waiver.applies, false);
    assert.match(waiver.why, /not on the reviewed-structural list/);
    assert.ok(violations.find((v) => v.rule === RULES.TREE).message.startsWith(`${NOT_ALLOWLISTED} — `),
      'the failure must still name the file it is about');
  });

  // ── TRAP 9 ──────────────────────────────────────────────────────────────────
  test('trap: an allowlisted file that ALSO adds a <main> still reds on the main rule', () => {
    const withMain = mutation('a <main> element is added')(FIXTURE);
    const fired = comparePage(ALLOWLISTED, FIXTURE, withMain).map((v) => v.rule);

    assert.ok(fired.includes(RULES.MAIN),
      `being on the reviewed-structural list must not suppress the main rule; what fired was: ${fired.join(', ') || '(nothing at all)'}`);
    // And the structure waiver withdraws itself as well, so the file fails on both
    // counts rather than only the narrow one.
    assert.ok(fired.includes(RULES.TREE), 'a listed file that adds a <main> must lose the structure waiver too');
    const waiver = structuralWaiver(ALLOWLISTED, parse(FIXTURE), parse(withMain));
    assert.equal(waiver.applies, false);
    assert.match(waiver.why, /<main> was added/);
  });

  test('the orb and the inline handler are not suppressed for a listed file either', () => {
    // The reason quoted back names whichever guard withdrew the waiver first, and
    // that is not always the rule-shaped one: an orb authored at body level trips
    // the body-children guard before the orb guard is reached. Both are correct
    // withdrawals, so the assertion is on the withdrawal and on the rule firing —
    // not on which guard got there first.
    for (const [trapName, rule, pattern] of [
      ['a <div id="concierge"> is added', RULES.ORB, /concierge/],
      ['an onclick= handler is added', RULES.HANDLER, /inline event handler was added/],
    ]) {
      const mutated = mutation(trapName)(FIXTURE);
      const fired = comparePage(ALLOWLISTED, FIXTURE, mutated).map((v) => v.rule);
      assert.ok(fired.includes(rule), `"${trapName}" must still fire ${rule} on a listed file; got: ${fired.join(', ') || '(nothing)'}`);
      const waiver = structuralWaiver(ALLOWLISTED, parse(FIXTURE), parse(mutated));
      assert.equal(waiver.applies, false, `the structure waiver must withdraw for "${trapName}"`);
      assert.match(waiver.why, pattern);
    }
  });

  test('the footer and the asset list are not suppressed for a listed file either', () => {
    for (const [trapName, rule] of [
      ['the footer copyright is edited', RULES.FOOTER],
      ['a <script src> is dropped', RULES.ASSETS],
    ]) {
      const fired = comparePage(ALLOWLISTED, FIXTURE, mutation(trapName)(FIXTURE)).map((v) => v.rule);
      assert.ok(fired.includes(rule), `"${trapName}" must still fire ${rule} on a listed file; got: ${fired.join(', ') || '(nothing)'}`);
    }
  });

  test('a listed file loses the waiver when the swap region SHRINKS', () => {
    // The nav keeps its ancestors and the body keeps its children, so the two
    // shape guards both hold. The article has still left the container. This is
    // the case the shrink guard exists for, and without it the waiver would pass.
    const moved = mutation('markup is moved inside div.container')(FIXTURE);
    const before = parse(FIXTURE);
    const after = parse(moved);

    assert.equal(navAncestorSignature(before), navAncestorSignature(after),
      'control: the nav guard does NOT catch this, which is why the shrink guard is needed');
    assert.equal(bodyChildSignature(before), bodyChildSignature(after),
      'control: the body-children guard does NOT catch this either');

    const waiver = structuralWaiver(ALLOWLISTED, before, after);
    assert.equal(waiver.applies, false, 'the waiver must withdraw when content leaves the swap container');
    assert.match(waiver.why, /SHRANK/);
    assert.ok(comparePage(ALLOWLISTED, FIXTURE, moved).map((v) => v.rule).includes(RULES.TREE));
  });

  test('a listed file loses the waiver when the nav moves, and when a body child is added', () => {
    // Two guards, driven one at a time so a failure names which one stopped working.
    const navMoved = FIXTURE.replace('<div class="container">', '<div class="container extra-wrapper">');
    assert.notEqual(navMoved, FIXTURE, 'control: the nav mutation changed nothing');
    const navWaiver = structuralWaiver(ALLOWLISTED, parse(FIXTURE), parse(navMoved));
    assert.equal(navWaiver.applies, false, 'a nav whose ancestor stack changed must lose the waiver');
    assert.match(navWaiver.why, /div-ancestor stack/);

    const bodyChanged = FIXTURE.replace('  <div class="box">', '  <div class="promo-banner"></div>\n  <div class="box">');
    assert.notEqual(bodyChanged, FIXTURE, 'control: the body mutation changed nothing');
    const bodyWaiver = structuralWaiver(ALLOWLISTED, parse(FIXTURE), parse(bodyChanged));
    assert.equal(bodyWaiver.applies, false, 'a new body child must lose the waiver');
    assert.match(bodyWaiver.why, /ordered body children/);
  });

  // ── JORDAN-TOOL-DEDUPE (#232): the removal budget is a door, not a hole ─────

  test('CONTROL: the removal register is a strict subset of the reviewed list, and every budget is a real count', () => {
    // A budget on a file nobody reviewed would waive nothing — `structuralWaiver`
    // looks the file up on REVIEWED_STRUCTURAL first and leaves before the shrink
    // branch. Asserting it anyway, because a register that silently does nothing is
    // how a reader comes to believe a file is covered when it is not.
    assert.equal(REVIEWED_REMOVAL.size, 6, 'the removal register grew or shrank without this test being revisited');
    for (const [file, budget] of REVIEWED_REMOVAL) {
      assert.ok(REVIEWED_STRUCTURAL.has(file), `${file} has a removal budget but is not on the reviewed-structural list, so it is waived for nothing`);
      assert.ok(Number.isInteger(budget) && budget > 0, `${file} has a budget of ${budget}, which is not a count of elements`);
    }
    assert.ok(REVIEWED_REMOVAL.has(REMOVAL_ALLOWLISTED), 'the fixture stands in for a file that has a budget');
    assert.ok(!REVIEWED_REMOVAL.has(ALLOWLISTED), 'the plain reviewed-structural file must NOT have one, or the shrink trap below proves nothing');
  });

  test('CONTROL: the fixture really does carry two calls to action, and the removal really is refused without a budget', () => {
    const before = parse(WITH_LEGACY_CTA);
    assert.notEqual(WITH_LEGACY_CTA, FIXTURE, 'control: the legacy block was not inserted, so nothing below proves anything');
    assert.equal(before.querySelectorAll('.tool-cta').length, 1, 'control: the miniature legacy block must be on the page');
    assert.equal(
      swapRegionElementCount(before) - swapRegionElementCount(parse(FIXTURE)), 4,
      'control: the miniature must sit INSIDE the swap region and be worth exactly the budget of 4',
    );

    // The same four-element deletion, on a file that was reviewed but declares no
    // budget: still refused, and with the original sentence.
    const noBudget = structuralWaiver(ALLOWLISTED, before, parse(FIXTURE));
    assert.equal(noBudget.applies, false, 'a reviewed file with no removal budget must not be allowed to shrink');
    assert.match(noBudget.why, /SHRANK from \d+ elements to \d+/);
  });

  test('a budgeted file is allowed the deletion that was reviewed, and page-structure comes back clean', () => {
    const waiver = structuralWaiver(REMOVAL_ALLOWLISTED, parse(WITH_LEGACY_CTA), parse(FIXTURE));
    assert.equal(waiver.applies, true, `the reviewed deletion must be allowed; it was refused with: ${waiver.why}`);
    assert.deepEqual(
      comparePage(REMOVAL_ALLOWLISTED, WITH_LEGACY_CTA, FIXTURE), [],
      'removing exactly the reviewed block must leave the page clean through the same function that gates the pull request',
    );
  });

  // ── TRAP 10 ────────────────────────────────────────────────────────────────
  test('trap: a budgeted file that MOVES the block out instead of deleting it still reds', () => {
    // The whole basis of the budget. The region shrinks by exactly 4 — the declared
    // number — so conditions 1 and 2 both hold and only the document-count check
    // stands between this and a silently broken page.
    const before = parse(WITH_LEGACY_CTA);
    const after = parse(LEGACY_CTA_RELOCATED);

    assert.notEqual(LEGACY_CTA_RELOCATED, WITH_LEGACY_CTA, 'control: the relocation changed nothing, so it proves nothing');
    assert.equal(navAncestorSignature(before), navAncestorSignature(after),
      'control: the nav guard does NOT catch this');
    assert.equal(bodyChildSignature(before), bodyChildSignature(after),
      'control: the body-children guard does NOT catch this either');
    assert.equal(swapRegionElementCount(before) - swapRegionElementCount(after), REVIEWED_REMOVAL.get(REMOVAL_ALLOWLISTED),
      'control: the region must shrink by EXACTLY the budget, or this trap is caught by the wrong check');
    assert.equal(elementCount(before), elementCount(after),
      'control: nothing was deleted — the block is still on the page, which is what makes this the dangerous case');

    const waiver = structuralWaiver(REMOVAL_ALLOWLISTED, before, after);
    assert.equal(waiver.applies, false, 'a budget must never wave through content that MOVED out of the swap container');
    assert.match(waiver.why, /MOVED out of the swap container/);
    assert.ok(comparePage(REMOVAL_ALLOWLISTED, WITH_LEGACY_CTA, LEGACY_CTA_RELOCATED).map((v) => v.rule).includes(RULES.TREE),
      'and the page must fail page-structure through the gating function, not only through the waiver');
  });

  // ── TRAP 11 ────────────────────────────────────────────────────────────────
  test('trap: a budgeted file that deletes MORE than the reviewed block still reds', () => {
    // A review of a four-element block is not a licence to delete a fifth. Here the
    // legacy block goes AND the article's panel goes with it, so the deletion is
    // honest — document and region fall together — and it is the budget alone that
    // refuses it.
    const overreach = WITH_LEGACY_CTA
      .replace(LEGACY_CTA, '')
      .replace(/ {8}<div class="panel">[\s\S]*?\n {8}<\/div>\n/, '');
    const before = parse(WITH_LEGACY_CTA);
    const after = parse(overreach);

    assert.notEqual(overreach, WITH_LEGACY_CTA, 'control: the over-deletion changed nothing');
    const lost = swapRegionElementCount(before) - swapRegionElementCount(after);
    assert.ok(lost > REVIEWED_REMOVAL.get(REMOVAL_ALLOWLISTED),
      `control: this must delete MORE than the budget of ${REVIEWED_REMOVAL.get(REMOVAL_ALLOWLISTED)}; it deleted ${lost}`);
    assert.equal(elementCount(before) - elementCount(after), lost,
      'control: this is a real deletion, so the relocation check is NOT what refuses it');

    const waiver = structuralWaiver(REMOVAL_ALLOWLISTED, before, after);
    assert.equal(waiver.applies, false, 'deleting more than the reviewed block must lose the waiver');
    assert.match(waiver.why, /the reviewed removal deletes exactly 4/);
    assert.ok(comparePage(REMOVAL_ALLOWLISTED, WITH_LEGACY_CTA, overreach).map((v) => v.rule).includes(RULES.TREE));
  });

  // ── TRAP 12 ────────────────────────────────────────────────────────────────
  test('trap: a budget suppresses the shrink guard and NOTHING else', () => {
    // The budget is not a second waiver. A budgeted file that deletes exactly its
    // block and ALSO adds a <main>, an orb or an inline handler is still caught by
    // each of those, and loses the structure waiver with it.
    for (const [trapName, rule, pattern] of [
      ['a <main> element is added', RULES.MAIN, /<main> was added/],
      ['a <div id="concierge"> is added', RULES.ORB, /concierge/],
      ['an onclick= handler is added', RULES.HANDLER, /inline event handler was added/],
    ]) {
      const mutated = mutation(trapName)(FIXTURE);
      assert.notEqual(mutated, FIXTURE, `control: "${trapName}" changed nothing`);
      const fired = comparePage(REMOVAL_ALLOWLISTED, WITH_LEGACY_CTA, mutated).map((v) => v.rule);
      assert.ok(fired.includes(rule), `"${trapName}" must still fire ${rule} on a budgeted file; got: ${fired.join(', ') || '(nothing)'}`);
      const waiver = structuralWaiver(REMOVAL_ALLOWLISTED, parse(WITH_LEGACY_CTA), parse(mutated));
      assert.equal(waiver.applies, false, `the structure waiver must withdraw for "${trapName}" on a budgeted file too`);
      assert.match(waiver.why, pattern);
    }

    // And the two rules that are never structural at all.
    for (const [trapName, rule] of [
      ['the footer copyright is edited', RULES.FOOTER],
      ['a <script src> is dropped', RULES.ASSETS],
    ]) {
      const fired = comparePage(REMOVAL_ALLOWLISTED, WITH_LEGACY_CTA, mutation(trapName)(FIXTURE)).map((v) => v.rule);
      assert.ok(fired.includes(rule), `"${trapName}" must still fire ${rule} on a budgeted file; got: ${fired.join(', ') || '(nothing)'}`);
    }
  });

  test('the swap-region mirror agrees with the REAL injector', async () => {
    // `swapRegionElementCount` restates decidePlan's arithmetic in jsdom, and a
    // restatement can drift from what it restates. So it is pinned to lol-html:
    // the real container must shrink on the moved-markup page, and the mirror must
    // say so too. Direction, not absolute count — the mirror counts the region the
    // plan describes, the injector counts what landed inside the tag it wrote.
    const moved = mutation('markup is moved inside div.container')(FIXTURE);

    const render = async (html) => {
      const plan = await planFromHtml(html, HTMLRewriter);
      let rewriter = new HTMLRewriter();
      for (const [selector, handler] of injectHandlers(plan)) rewriter = rewriter.on(selector, handler);
      const out = await rewriter.transform(new Response(html)).text();
      const container = parse(out).querySelector(`main#${CONTAINER_ID}`);
      return container ? container.querySelectorAll('*').length : 0;
    };

    const realBefore = await render(FIXTURE);
    const realAfter = await render(moved);
    assert.ok(realBefore > 0, 'control: the real injector wraps something on the clean fixture');
    assert.ok(realAfter < realBefore, `control: the real container must shrink on the moved page (${realBefore} → ${realAfter})`);

    const mirrorBefore = swapRegionElementCount(parse(FIXTURE));
    const mirrorAfter = swapRegionElementCount(parse(moved));
    assert.ok(mirrorBefore > 0, 'the mirror must find a region on the clean fixture');
    assert.ok(
      mirrorAfter < mirrorBefore,
      `the mirror must see the same shrink the injector does; it reported ${mirrorBefore} → ${mirrorAfter} while the injector went ${realBefore} → ${realAfter}`,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// The reviewed-ASSET allowlist cannot go broad either
//
// SHELDON-CONTACT-ROUTE-R1 (#214). The structural waiver already had a suite
// proving it is narrow. The asset waiver is newer and strictly more dangerous —
// `scripts-and-stylesheets` is the rule that guards the tags loading the concierge,
// the booking bar and the router — so it gets the same treatment: every refusal is
// driven, not described.
//
// The file standing in for a reviewed page here is contact.html, the only entry on
// the list. The fixture is the same base page every other trap uses, so what these
// tests exercise is the WAIVER, not contact.html's own markup (which the pull-request
// suite at the top of this file checks against its real predecessor).
// ─────────────────────────────────────────────────────────────────────────────

const ASSET_ALLOWLISTED = 'donovan-legal-site/contact.html';
const ASSET_NOT_ALLOWLISTED = 'donovan-legal-site/contact-2.html';

/** The change the waiver exists for: a head script ADDED, nothing else touched. */
const addHeadScript = (html) => html.replace(
  '</head>',
  '  <script src="/js/page/contact-form.js" defer></script>\n</head>',
);

describe('SARAH-CHROME-DIFF — the reviewed-asset allowlist cannot go broad', () => {
  test('CONTROL: the list is a closed set, and every entry carries a written reason', () => {
    assert.ok(REVIEWED_ASSETS.has(ASSET_ALLOWLISTED), 'the file the traps below use must be on the list');
    assert.ok(!REVIEWED_ASSETS.has(ASSET_NOT_ALLOWLISTED), 'the near-miss name must NOT be on the list');
    assert.equal(REVIEWED_ASSETS.size, 1, 'the list grew or shrank without this test being revisited');
    for (const [file, reason] of REVIEWED_ASSETS) {
      assert.ok(file.startsWith(GATED_PREFIX) && file.endsWith('.html'), `${file} is not a gated page path`);
      assert.ok(reason.length > 60, `${file} has no real written reason, and an unexplained waiver is not auditable`);
    }
  });

  test('CONTROL: the waived change really is one the gate would otherwise refuse', () => {
    const added = addHeadScript(FIXTURE);
    assert.notEqual(added, FIXTURE, 'the control mutation changed nothing, so it proves nothing');
    // An unreviewed file adding the SAME tag reds on assets (and on structure, since
    // a new head tag is a new element — that half is the structural waiver's job).
    const unreviewed = comparePage(ASSET_NOT_ALLOWLISTED, FIXTURE, added).map((v) => v.rule);
    assert.ok(unreviewed.includes(RULES.ASSETS),
      `adding a script must be an asset change for a file nobody reviewed; got: ${unreviewed.join(', ') || '(nothing)'}`);
    // Same bytes, reviewed file: the ASSET rule is suppressed and no other rule
    // starts firing in its place except the structural one, which is a separate
    // register and deliberately not waived by this one.
    const reviewed = comparePage(ASSET_ALLOWLISTED, FIXTURE, added).map((v) => v.rule);
    assert.ok(!reviewed.includes(RULES.ASSETS), `the reviewed file must be allowed the added tag; got: ${reviewed.join(', ')}`);
  });

  test('TRAP: a DROPPED script is never waived, listed or not', () => {
    // The rule's own message names four failures and a review can only speak to
    // "added". This is the one that turns the concierge off.
    const dropped = mutation('a <script src> is dropped')(FIXTURE);
    const fired = comparePage(ASSET_ALLOWLISTED, FIXTURE, dropped).map((v) => v.rule);
    assert.ok(fired.includes(RULES.ASSETS),
      `being on the reviewed-asset list must not suppress a dropped tag; what fired was: ${fired.join(', ') || '(nothing at all)'}`);

    const w = assetWaiver(ASSET_ALLOWLISTED, assetManifest(parse(FIXTURE)), assetManifest(parse(dropped)));
    assert.equal(w.applies, false);
    assert.match(w.why, /not purely additive/);
    assert.match(w.why, /donovan-widget\.js/, 'the refusal must name the tag that went missing');
  });

  test('TRAP: a RE-POINTED src is never waived', () => {
    // The quietest of the four: the tag is still there, still in position, and now
    // loads somebody else's file. A subsequence test catches it because the ORIGINAL
    // src is no longer present.
    const repointed = FIXTURE.replace('/js/donovan-widget.js', 'https://evil.example/widget.js');
    assert.notEqual(repointed, FIXTURE, 'the mutation changed nothing, so it proves nothing');
    const fired = comparePage(ASSET_ALLOWLISTED, FIXTURE, repointed).map((v) => v.rule);
    assert.ok(fired.includes(RULES.ASSETS),
      `a re-pointed src must never be waived; what fired was: ${fired.join(', ') || '(nothing at all)'}`);

    const w = assetWaiver(ASSET_ALLOWLISTED, assetManifest(parse(FIXTURE)), assetManifest(parse(repointed)));
    assert.equal(w.applies, false);
    assert.match(w.why, /not purely additive/);
  });

  test('TRAP: a REORDERED pair is never waived', () => {
    // Order is load-bearing on this site — js/dl-init.js must execute before any
    // page script that registers with it. Two tags swapped is not an addition.
    const assets = assetManifest(parse(FIXTURE));
    assert.ok(assets.length >= 2, 'control: the fixture must carry at least two asset tags');
    const swapped = [...assets];
    [swapped[0], swapped[1]] = [swapped[1], swapped[0]];

    const w = assetWaiver(ASSET_ALLOWLISTED, assets, swapped);
    assert.equal(w.applies, false, 'a reorder must never be waived');
    assert.match(w.why, /not purely additive/);
  });

  test('TRAP: a near-miss filename inherits nothing', () => {
    // `contact-2.html` shares a prefix with the listed file. If matching ever became
    // "starts with" or "contains", this is the test that goes red.
    const w = assetWaiver(ASSET_NOT_ALLOWLISTED, ['a'], ['a', 'b']);
    assert.equal(w.applies, false);
    assert.match(w.why, /not on the reviewed-asset list/);
  });

  test('the asset waiver suppresses ONE rule and never the others', () => {
    // A listed file that also edits the footer, adds a <main>, an orb or an inline
    // handler still fails on each of those in its own right.
    for (const [trapName, rule] of [
      ['the footer copyright is edited', RULES.FOOTER],
      ['a <main> element is added', RULES.MAIN],
      ['a <div id="concierge"> is added', RULES.ORB],
      ['an onclick= handler is added', RULES.HANDLER],
    ]) {
      const fired = comparePage(ASSET_ALLOWLISTED, FIXTURE, mutation(trapName)(FIXTURE)).map((v) => v.rule);
      assert.ok(fired.includes(rule), `"${trapName}" must still fire ${rule} on an asset-listed file; got: ${fired.join(', ') || '(nothing)'}`);
    }
  });

  test('an identical page is still clean — the waiver adds no noise', () => {
    assert.deepEqual(comparePage(ASSET_ALLOWLISTED, FIXTURE, FIXTURE), []);
  });
});

// ── Suite 6: `site-navigation`, asserted on the menu that is SERVED ──────────
//
// SHELDON-PAUL-NAV (#227). The rule this suite carries used to be a byte compare
// of each changed page's own `nav.menubar` against `origin/main`. That subtree is
// no longer served to anyone — see the long note on `checkServedNav` — so the id
// moved here, onto the menu a visitor actually receives.
//
// The sample is one real page from each of the three nav variants the site had
// forked into, one page a directory down, and one of the 47 fragments that has no
// nav at all. The variants matter because they are the pages most likely to be
// broken by a single shared definition, and the subdirectory page matters most of
// all: it is the only one on which a relative tier href silently resolves to the
// wrong place.

const SERVED_NAV_SAMPLE = [
  { rel: 'tax-controversy.html', why: 'variant A — the current chrome, 92 pages' },
  { rel: 'business-formation.html', why: 'variant B — the old THE FIRM / THE PRACTICE chrome, 18 pages' },
  { rel: 'tool-deal-builder.html', why: 'variant C — the tool chrome, no mobile overlay of its own, 2 pages' },
  { rel: 'members/about-membership.html', why: 'a directory down — every relative href resolves one level off here' },
];

/** The fragment with no `nav.menubar`. Not sampled for a menu: sampled to prove
 *  the injector leaves it alone rather than inventing chrome for it. */
const SERVED_NAV_FRAGMENT = 'blog-controversy-roadmap-2-exam.html';

describe('SHELDON-PAUL-NAV — site-navigation, on the served page', () => {
  for (const { rel, why } of SERVED_NAV_SAMPLE) {
    test(`${rel} (${why})`, async () => {
      const url = `https://www.donovan.law/${rel}`;
      const source = fs.readFileSync(path.join(ROOT, GATED_PREFIX, rel), 'utf8');
      const served = await serveThroughMiddleware(source, url);
      const violations = checkServedNav(rel, served, url);
      assert.deepEqual(violations.map((v) => v.message), [], `served menu is wrong on ${rel}`);
    });
  }

  test(`${SERVED_NAV_FRAGMENT} is served with no menu at all, and no nav stylesheet`, async () => {
    const url = `https://www.donovan.law/${SERVED_NAV_FRAGMENT}`;
    const source = fs.readFileSync(path.join(ROOT, GATED_PREFIX, SERVED_NAV_FRAGMENT), 'utf8');
    assert.ok(!source.includes('menubar'), 'control: this fragment must genuinely have no site nav in its source');
    const served = await serveThroughMiddleware(source, url);
    const doc = parse(served);
    assert.equal(doc.querySelectorAll(SITE_NAV_SELECTOR).length, 0,
      'the injector invented a menu on a page that never had one');
    assert.equal(doc.querySelectorAll('link[href="/css/dl-nav.css"]').length, 0,
      'the nav stylesheet shipped to a page with no nav — the gate is the nav, not the plan');
  });

  // ── The control ───────────────────────────────────────────────────────────
  //
  // Four ways the served menu breaks WITHOUT the page failing to render, each fed
  // to the same `checkServedNav` the sample above is judged by. A checker that
  // returned [] for everything would pass every test above and nothing else.
  test('the check bites: four silently-broken menus are each caught', async () => {
    const url = `https://www.donovan.law/members/about-membership.html`;
    const source = fs.readFileSync(path.join(ROOT, GATED_PREFIX, 'members/about-membership.html'), 'utf8');
    const served = await serveThroughMiddleware(source, url);
    assert.deepEqual(checkServedNav('control', served, url), [], 'control: the unbroken page must be clean first');

    for (const [what, mutate, shows] of [
      [
        'a top-level item is dropped',
        // 2026-09-05: BOOK left the bar; CONTACT is the item this control removes.
        (h) => h.replace('<li class="nav-item"><a class="nav-link" href="/contact.html">CONTACT</a></li>', ''),
        /top level of the served menu/,
      ],
      [
        // The exact failure root-absolute hrefs exist to prevent: this resolves to
        // /members/gold/ on this page, which no tier route matches.
        'the portal href is not Clio\'s sign-in',
        (h) => h.replace('href="https://clients.clio.com/login" target="_blank" rel="noopener">CLIENT PORTAL', 'href="/client-portal.html" target="_blank" rel="noopener">CLIENT PORTAL'),
        /must be Clio's sign-in/,
      ],
      [
        'the portal item is dropped',
        (h) => h.replace('<li class="nav-item"><a class="nav-link" href="https://clients.clio.com/login" target="_blank" rel="noopener">CLIENT PORTAL</a></li>', ''),
        /CLIENT PORTAL item is missing/,
      ],
      [
        'the hamburger loses its class',
        (h) => h.replace('<div class="hamburger">', '<div class="burger">'),
        /\.hamburger/,
      ],
      // ── SHELDON-NAV-R2 ────────────────────────────────────────────────────
      //
      // The two ways the nested TAX menu breaks with nothing on screen to show
      // for it. Both mutate BOTH renderings — `split/join`, not `replace` — so a
      // check that only ever looked at the desktop panel would still be caught.
      [
        'a state page is dropped from the CONTROVERSY submenu',
        (h) => h.split('<a class="dropdown-item dl-subnav-item" href="/massachusetts-tax-appeal.html">Massachusetts Tax Appeals</a>').join('')
          .split('<a class="dropdown-item dd-sub dl-subnav-item" href="/massachusetts-tax-appeal.html">Massachusetts Tax Appeals</a>').join(''),
        /CONTROVERSY submenu/,
      ],
      [
        // The regression R2 exists to fix, re-created: Massachusetts ahead of
        // Florida. Fifteen pages, all present, all linked, all rendering.
        'the state pages are put back in the wrong order',
        (h) => h.split('Florida Sales &amp; Use Tax').join('~~SWAP~~')
          .split('Massachusetts Tax Appeals').join('Florida Sales &amp; Use Tax')
          .split('~~SWAP~~').join('Massachusetts Tax Appeals'),
        /state pages under (desktop|mobile) CONTROVERSY are wrong/,
      ],
    ]) {
      const broken = mutate(served);
      assert.notEqual(broken, served, `the "${what}" mutation changed nothing, so it tests nothing`);
      const violations = checkServedNav('broken', broken, url);
      assert.ok(violations.length, `"${what}" was not caught at all`);
      assert.ok(violations.every((v) => v.rule === RULES.NAV), `"${what}" must fail under ${RULES.NAV}`);
      assert.ok(violations.some((v) => shows.test(v.message)),
        `"${what}" was caught, but the message does not say what broke:\n${violations.map((v) => v.message).join('\n')}`);
    }
  });
});
