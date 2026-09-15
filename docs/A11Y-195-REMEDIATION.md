# JORDAN — A11Y REMEDIATION (ORDER JORDAN-195-A11Y-REMEDIATE, #195)

Remediation pass against the defect list SARAH-195-PROD-SWEEP-R1 recorded in
PR #216 (`docs/A11Y-PROD-SWEEP-FINDINGS.md`): **1,130 failing nodes on 80 of the
98 sitemap pages**, after #213 had already re-valued the shared palette.

**Headline.** The colour debt is fixed everywhere a stylesheet can reach it.
Locally measured over the same 80 pages, axe-core goes **389 -> 109** failing
nodes (**-280**, 72%), `color-contrast` **292 -> 20** (-93%) and
`link-in-text-block` **8 -> 0**, with **zero new failures introduced**. 35 of the
80 pages are now completely clean.

**What is not fixed, and why it is not a judgement call.** Every remaining defect
needs an HTML **attribute** changed, and `test/chrome-diff.test.mjs` rule 3
(`page-structure`) fails any pull request that changes one. The gate's only
escape hatch is the `REVIEWED_STRUCTURAL` register, which is by its own
documentation "an assertion by a named human". This order forbids me from
editing it. So §4 is a waiver request for Zane rather than a diff: **89 Level A/AA
nodes across 39 files**, plus **219 hard-coded colour values in `style=""` across
43 files** — **81 distinct files** in all, each with the exact edit written out.

> **Update — ORDER JORDAN-195-LEVELA-WAIVER-R1.** That request was authorised. §1–§7
> below are PR #220's record and are left exactly as they were written; **§8 is
> what actually shipped under the waiver**, including four things §4's draft
> transforms got wrong. Read §4 as the request and §8 as the result.

---

## 0. What changed in this PR

| | |
| --- | --- |
| Site files changed | **134** HTML pages |
| Bytes changed outside a `<style>` block | **0** (enforced per file by the rewriter, see §6) |
| `css/main.css` changed | **no** — #213 already made it compliant; the debt was entirely per-page |
| Colour values re-valued | 1,459 declarations |
| Tests | **2,472 pass, 0 fail, 1 skipped** |
| chrome-diff | **green, and gated** — 134 pages compared against `origin/main`, none waived |


---

## 1. Task 1 — the per-page work list

Every defect PR #216 recorded, by page, with the source file it lives in and
which lane it falls in. "Lane" is not a priority — it is whether the fix is
reachable without changing an HTML attribute (see §4 for why that is the line).

| Page | Source file | Rule | Impact | Nodes | Lane |
| --- | --- | --- | --- | ---: | --- |
| `/` | `home.html` | `color-contrast` | serious | 9 | **attribute - needs waiver** |
| `/audit-reconsideration` | `audit-reconsideration.html` | `color-contrast` | serious | 14 | CSS - fixed in this PR |
| `/blog` | `blog.html` | `aria-required-children` | critical | 1 | **attribute - needs waiver** |
| `/blog` | `blog.html` | `color-contrast` | serious | 86 | CSS - fixed in this PR |
| `/blog-461l-excess-business-loss-and-172-nol` | `blog-461l-excess-business-loss-and-172-nol.html` | `color-contrast` | serious | 12 | CSS - fixed in this PR |
| `/blog-augusta-rule-280a-g` | `blog-augusta-rule-280a-g.html` | `color-contrast` | serious | 10 | CSS - fixed in this PR |
| `/blog-augusta-rule-280a-g` | `blog-augusta-rule-280a-g.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-bramblett-phelan-two-entity-structure` | `blog-bramblett-phelan-two-entity-structure.html` | `color-contrast` | serious | 1 | CSS - fixed in this PR |
| `/blog-character-amount-timing` | `blog-character-amount-timing.html` | `color-contrast` | serious | 10 | CSS - fixed in this PR |
| `/blog-character-amount-timing` | `blog-character-amount-timing.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-civil-fraud-eggshell-audit` | `blog-civil-fraud-eggshell-audit.html` | `color-contrast` | serious | 15 | CSS - fixed in this PR |
| `/blog-civil-fraud-eggshell-audit` | `blog-civil-fraud-eggshell-audit.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-conservation-easement-settlement` | `blog-conservation-easement-settlement.html` | `color-contrast` | serious | 14 | CSS - fixed in this PR |
| `/blog-conservation-easement-settlement` | `blog-conservation-easement-settlement.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-controversy-roadmap-0-overview` | `blog-controversy-roadmap-0-overview.html` | `color-contrast` | serious | 3 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-0-overview` | `blog-controversy-roadmap-0-overview.html` | `link-in-text-block` | serious | 1 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-1-processing-assessment` | `blog-controversy-roadmap-1-processing-assessment.html` | `color-contrast` | serious | 9 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-1-processing-assessment` | `blog-controversy-roadmap-1-processing-assessment.html` | `link-in-text-block` | serious | 1 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-2-exam` | `blog-controversy-roadmap-2-exam.html` | `color-contrast` | serious | 7 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-2-exam` | `blog-controversy-roadmap-2-exam.html` | `link-in-text-block` | serious | 1 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-3-exam-alternatives` | `blog-controversy-roadmap-3-exam-alternatives.html` | `color-contrast` | serious | 11 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-3-exam-alternatives` | `blog-controversy-roadmap-3-exam-alternatives.html` | `link-in-text-block` | serious | 1 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-4-appeals` | `blog-controversy-roadmap-4-appeals.html` | `color-contrast` | serious | 13 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-4-appeals` | `blog-controversy-roadmap-4-appeals.html` | `link-in-text-block` | serious | 1 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-5-collection` | `blog-controversy-roadmap-5-collection.html` | `color-contrast` | serious | 4 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-5-collection` | `blog-controversy-roadmap-5-collection.html` | `link-in-text-block` | serious | 1 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-6-collection-alternatives` | `blog-controversy-roadmap-6-collection-alternatives.html` | `color-contrast` | serious | 6 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-6-collection-alternatives` | `blog-controversy-roadmap-6-collection-alternatives.html` | `link-in-text-block` | serious | 1 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-7-litigation` | `blog-controversy-roadmap-7-litigation.html` | `color-contrast` | serious | 3 | CSS - fixed in this PR |
| `/blog-controversy-roadmap-7-litigation` | `blog-controversy-roadmap-7-litigation.html` | `link-in-text-block` | serious | 1 | CSS - fixed in this PR |
| `/blog-criminal-tax-overview` | `blog-criminal-tax-overview.html` | `color-contrast` | serious | 21 | CSS - fixed in this PR |
| `/blog-criminal-tax-overview` | `blog-criminal-tax-overview.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-currently-not-collectible-csed` | `blog-currently-not-collectible-csed.html` | `color-contrast` | serious | 15 | CSS - fixed in this PR |
| `/blog-currently-not-collectible-csed` | `blog-currently-not-collectible-csed.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-fbar-foreign-account-penalties` | `blog-fbar-foreign-account-penalties.html` | `color-contrast` | serious | 19 | CSS - fixed in this PR |
| `/blog-fbar-foreign-account-penalties` | `blog-fbar-foreign-account-penalties.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-firpta-foreign-sellers` | `blog-firpta-foreign-sellers.html` | `color-contrast` | serious | 11 | CSS - fixed in this PR |
| `/blog-foreclose-federal-tax-lien-suit` | `blog-foreclose-federal-tax-lien-suit.html` | `color-contrast` | serious | 17 | CSS - fixed in this PR |
| `/blog-foreclose-federal-tax-lien-suit` | `blog-foreclose-federal-tax-lien-suit.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-irs-audit-notice-what-to-do` | `blog-irs-audit-notice-what-to-do.html` | `color-contrast` | serious | 10 | CSS - fixed in this PR |
| `/blog-irs-co-owned-marital-real-estate` | `blog-irs-co-owned-marital-real-estate.html` | `color-contrast` | serious | 17 | CSS - fixed in this PR |
| `/blog-irs-co-owned-marital-real-estate` | `blog-irs-co-owned-marital-real-estate.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-irs-levy` | `blog-irs-levy.html` | `color-contrast` | serious | 19 | CSS - fixed in this PR |
| `/blog-irs-levy` | `blog-irs-levy.html` | `svg-img-alt` | serious | 2 | **attribute - needs waiver** |
| `/blog-irs-summons` | `blog-irs-summons.html` | `color-contrast` | serious | 16 | CSS - fixed in this PR |
| `/blog-irs-summons` | `blog-irs-summons.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-jeopardy-termination-assessments` | `blog-jeopardy-termination-assessments.html` | `color-contrast` | serious | 14 | CSS - fixed in this PR |
| `/blog-jeopardy-termination-assessments` | `blog-jeopardy-termination-assessments.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-kwong-covid-deadlines` | `blog-kwong-covid-deadlines.html` | `color-contrast` | serious | 15 | CSS - fixed in this PR |
| `/blog-kwong-covid-deadlines` | `blog-kwong-covid-deadlines.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-material-participation-seven-tests` | `blog-material-participation-seven-tests.html` | `color-contrast` | serious | 9 | CSS - fixed in this PR |
| `/blog-material-participation-seven-tests` | `blog-material-participation-seven-tests.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-notice-of-federal-tax-lien` | `blog-notice-of-federal-tax-lien.html` | `color-contrast` | serious | 22 | CSS - fixed in this PR |
| `/blog-notice-of-federal-tax-lien` | `blog-notice-of-federal-tax-lien.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-partnership-agreement-tax-document` | `blog-partnership-agreement-tax-document.html` | `color-contrast` | serious | 11 | CSS - fixed in this PR |
| `/blog-passport-revocation-tax-debt` | `blog-passport-revocation-tax-debt.html` | `color-contrast` | serious | 15 | CSS - fixed in this PR |
| `/blog-passport-revocation-tax-debt` | `blog-passport-revocation-tax-debt.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-penalty-regime-6751b` | `blog-penalty-regime-6751b.html` | `color-contrast` | serious | 15 | CSS - fixed in this PR |
| `/blog-penalty-regime-6751b` | `blog-penalty-regime-6751b.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-per-se-passive-rule-exceptions` | `blog-per-se-passive-rule-exceptions.html` | `color-contrast` | serious | 8 | CSS - fixed in this PR |
| `/blog-per-se-passive-rule-exceptions` | `blog-per-se-passive-rule-exceptions.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-real-estate-professional-status-reps` | `blog-real-estate-professional-status-reps.html` | `color-contrast` | serious | 9 | CSS - fixed in this PR |
| `/blog-real-estate-professional-status-reps` | `blog-real-estate-professional-status-reps.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-short-term-rental-material-participation` | `blog-short-term-rental-material-participation.html` | `color-contrast` | serious | 13 | CSS - fixed in this PR |
| `/blog-short-term-rental-play` | `blog-short-term-rental-play.html` | `color-contrast` | serious | 10 | CSS - fixed in this PR |
| `/blog-short-term-rental-play` | `blog-short-term-rental-play.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-subdivision-basis-allocation` | `blog-subdivision-basis-allocation.html` | `color-contrast` | serious | 9 | CSS - fixed in this PR |
| `/blog-subdivision-basis-allocation` | `blog-subdivision-basis-allocation.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-substitute-for-return` | `blog-substitute-for-return.html` | `color-contrast` | serious | 15 | CSS - fixed in this PR |
| `/blog-substitute-for-return` | `blog-substitute-for-return.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-tax-opinions` | `blog-tax-opinions.html` | `color-contrast` | serious | 19 | CSS - fixed in this PR |
| `/blog-tax-opinions` | `blog-tax-opinions.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `blog-tenancy-by-entirety-federal-tax-lien.html` | `color-contrast` | serious | 19 | CSS - fixed in this PR |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `blog-tenancy-by-entirety-federal-tax-lien.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-transferee-nominee-alter-ego` | `blog-transferee-nominee-alter-ego.html` | `color-contrast` | serious | 17 | CSS - fixed in this PR |
| `/blog-transferee-nominee-alter-ego` | `blog-transferee-nominee-alter-ego.html` | `svg-img-alt` | serious | 1 | **attribute - needs waiver** |
| `/blog-trust-fund-recovery-penalty` | `blog-trust-fund-recovery-penalty.html` | `color-contrast` | serious | 18 | CSS - fixed in this PR |
| `/blog-trust-fund-recovery-penalty` | `blog-trust-fund-recovery-penalty.html` | `svg-img-alt` | serious | 2 | **attribute - needs waiver** |
| `/business-law` | `business-law.html` | `html-has-lang` | serious | 1 | **attribute - needs waiver** |
| `/contact` | `contact.html` | `color-contrast` | serious | 11 | **attribute - needs waiver** |
| `/contracts` | `contracts.html` | `aria-valid-attr-value` | critical | 3 | **attribute - needs waiver** |
| `/contracts` | `contracts.html` | `button-name` | critical | 3 | **attribute - needs waiver** |
| `/contracts` | `contracts.html` | `html-has-lang` | serious | 1 | **attribute - needs waiver** |
| `/development` | `development.html` | `aria-valid-attr-value` | critical | 3 | **attribute - needs waiver** |
| `/development` | `development.html` | `button-name` | critical | 3 | **attribute - needs waiver** |
| `/development` | `development.html` | `html-has-lang` | serious | 1 | **attribute - needs waiver** |
| `/eminent-domain` | `eminent-domain.html` | `aria-valid-attr-value` | critical | 3 | **attribute - needs waiver** |
| `/eminent-domain` | `eminent-domain.html` | `button-name` | critical | 3 | **attribute - needs waiver** |
| `/eminent-domain` | `eminent-domain.html` | `html-has-lang` | serious | 1 | **attribute - needs waiver** |
| `/entity-formation` | `entity-formation.html` | `aria-valid-attr-value` | critical | 3 | **attribute - needs waiver** |
| `/entity-formation` | `entity-formation.html` | `button-name` | critical | 3 | **attribute - needs waiver** |
| `/entity-formation` | `entity-formation.html` | `html-has-lang` | serious | 1 | **attribute - needs waiver** |
| `/florida-sales-tax-audit` | `florida-sales-tax-audit.html` | `color-contrast` | serious | 17 | CSS - fixed in this PR |
| `/florida-sales-tax-audit` | `florida-sales-tax-audit.html` | `nested-interactive` | serious | 1 | **attribute - needs waiver** |
| `/irs-appeals` | `irs-appeals.html` | `color-contrast` | serious | 14 | CSS - fixed in this PR |
| `/irs-audit-defense` | `irs-audit-defense.html` | `color-contrast` | serious | 14 | CSS - fixed in this PR |
| `/irs-liens-levies` | `irs-liens-levies.html` | `color-contrast` | serious | 17 | CSS - fixed in this PR |
| `/irs-notice` | `irs-notice.html` | `color-contrast` | serious | 19 | CSS - fixed in this PR |
| `/leasing` | `leasing.html` | `aria-valid-attr-value` | critical | 3 | **attribute - needs waiver** |
| `/leasing` | `leasing.html` | `button-name` | critical | 3 | **attribute - needs waiver** |
| `/leasing` | `leasing.html` | `html-has-lang` | serious | 1 | **attribute - needs waiver** |
| `/litigation` | `litigation.html` | `aria-valid-attr-value` | critical | 3 | **attribute - needs waiver** |
| `/litigation` | `litigation.html` | `button-name` | critical | 3 | **attribute - needs waiver** |
| `/litigation` | `litigation.html` | `html-has-lang` | serious | 1 | **attribute - needs waiver** |
| `/massachusetts-tax-appeal` | `massachusetts-tax-appeal.html` | `color-contrast` | serious | 17 | CSS - fixed in this PR |
| `/massachusetts-tax-appeal` | `massachusetts-tax-appeal.html` | `nested-interactive` | serious | 1 | **attribute - needs waiver** |
| `/ourfirm` | `ourfirm.html` | `color-contrast` | serious | 4 | **attribute - needs waiver** |
| `/partnership-audits` | `partnership-audits.html` | `color-contrast` | serious | 14 | CSS - fixed in this PR |
| `/practice` | `practice.html` | `color-contrast` | serious | 20 | CSS - fixed in this PR |
| `/property-acquisition` | `property-acquisition.html` | `aria-valid-attr-value` | critical | 3 | **attribute - needs waiver** |
| `/property-acquisition` | `property-acquisition.html` | `button-name` | critical | 3 | **attribute - needs waiver** |
| `/property-acquisition` | `property-acquisition.html` | `html-has-lang` | serious | 1 | **attribute - needs waiver** |
| `/re-financing` | `re-financing.html` | `aria-valid-attr-value` | critical | 3 | **attribute - needs waiver** |
| `/re-financing` | `re-financing.html` | `button-name` | critical | 3 | **attribute - needs waiver** |
| `/re-financing` | `re-financing.html` | `html-has-lang` | serious | 1 | **attribute - needs waiver** |
| `/real-estate` | `real-estate.html` | `color-contrast` | serious | 6 | CSS - fixed in this PR |
| `/residency-audit` | `residency-audit.html` | `color-contrast` | serious | 14 | CSS - fixed in this PR |
| `/tax` | `tax.html` | `color-contrast` | serious | 6 | CSS - fixed in this PR |
| `/tax-controversy` | `tax-controversy.html` | `color-contrast` | serious | 24 | CSS - fixed in this PR |
| `/tax-court` | `tax-court.html` | `color-contrast` | serious | 28 | CSS - fixed in this PR |
| `/tax-debt-resolution` | `tax-debt-resolution.html` | `color-contrast` | serious | 14 | CSS - fixed in this PR |
| `/tax-penalties` | `tax-penalties.html` | `color-contrast` | serious | 17 | CSS - fixed in this PR |
| `/tool-1031-exchange` | `tool-1031-exchange.html` | `color-contrast` | serious | 30 | **attribute - needs waiver** |
| `/tool-capital-gains` | `tool-capital-gains.html` | `select-name` | critical | 1 | **attribute - needs waiver** |
| `/tool-capital-gains` | `tool-capital-gains.html` | `color-contrast` | serious | 6 | **attribute - needs waiver** |
| `/tool-cost-segregation` | `tool-cost-segregation.html` | `color-contrast` | serious | 12 | **attribute - needs waiver** |
| `/tool-deal-builder-preview` | `tool-deal-builder-preview.html` | `color-contrast` | serious | 6 | CSS - fixed in this PR |
| `/tool-firpta-withholding` | `tool-firpta-withholding.html` | `color-contrast` | serious | 7 | **attribute - needs waiver** |
| `/tool-irs-notice-guide` | `tool-irs-notice-guide.html` | `color-contrast` | serious | 17 | **attribute - needs waiver** |
| `/tool-oic-rcp-estimator` | `tool-oic-rcp-estimator.html` | `color-contrast` | serious | 9 | **attribute - needs waiver** |
| `/tool-rental-real-estate-tax-strategy-analyzer` | `tool-rental-real-estate-tax-strategy-analyzer.html` | `color-contrast` | serious | 4 | **attribute - needs waiver** |
| `/tools` | `tools.html` | `color-contrast` | serious | 48 | **attribute - needs waiver** |
| `/unfiled-returns` | `unfiled-returns.html` | `color-contrast` | serious | 14 | CSS - fixed in this PR |
| `/voluntary-disclosure` | `voluntary-disclosure.html` | `color-contrast` | serious | 14 | CSS - fixed in this PR |

---

## 2. Task 2 — the colour fix

### Why #213 could not finish the job

PR #216 proved this by reading the winning rule out of Chrome, not by grepping
`css/`: `main.css` correctly offers the new `#107a4d` and **loses**, because the
old hex is written into the delivered HTML. 1,443 copies of the old green and
427 of the old gold sit in per-page `<style>` blocks and element `style=""`
attributes across 134 files, and 8 roadmap posts never load `main.css` at all.

So this is a content change across the pages, not another stylesheet edit — which
is exactly what #216 concluded.

### The palette, and how each value was chosen

Not by eye. `scripts/a11y/contrast.mjs` implements the WCAG relative-luminance
formula; `nearestPassing` walks a colour toward black (on a light background) or
white (on a dark one) in 1/255 steps and stops at the FIRST value clearing
4.5:1, so each replacement keeps as much of the brand hue as the threshold
allows. The table lives in `scripts/a11y/palette-195.mjs`.

| Old | New | Role | Worst measured pair after |
| --- | --- | --- | --- |
| `#169B62` | `#107A4D` | brand green — text on light AND band under white text | 4.60:1 on `#eaefe8` |
| `#C9A961` | `#806633` | brand gold **as text only** | 4.98:1 on `#f6f5f1` |
| `#C9A961` | *unchanged* | brand gold **as a band / border** | — (a border is not text) |
| `#8A8A8A`, `#8A8B8D`, `#9A9A9A` | `#6E6E6E` | muted body text | 4.60:1 on `#f3f3f4` |
| `#8A6F1F` | `#806633` | dark gold text | 5.04:1 on `#f5f7f4` |
| `#5E7686` | `#5A7181` | roadmap `--mute` caption | 4.53:1 on `#eef2f4` |
| `#019A48` | `#01873F` | roadmap `--emer` link on the light page | 4.51:1 on `#fcfcfb` |
| `#9FBCA9` | `#A1BDAA` | sage on the deep-green band | 4.51:1 on `#0c5334` |
| `#416B41` | `#2C482C` | forest text on a gold band | 4.51:1 on `#c9a961` |
| `#D35400` | `#BC4B00` | rust accent text | 4.52:1 on `#fdf0e3` |
| `#C06A3E`, `#3C8DA3`, `#5E8B9E` | `#AE6038`, `#357E91`, `#537A8B` | accent bands, both roles | 4.62–4.64:1 under white |

Verified before a single page was touched: applying this table to all 32
foreground/background pairs PR #216 measured clears **1,029 of 1,033** by
calculation. The 4 it does not reach are gold-on-deep-green badges written in
`style=""` attributes on the home page — §4.

### The gold split, which is the one rule that is not mechanical

`#C9A961` is used both as text on a light background (162 failing nodes, needs
darkening) and as a band or `border-left` behind dark text (187 declarations,
plus the `--gold` token). Darkening it everywhere would wreck the bands for no
accessibility gain, because `color-contrast` never looks at a border. So gold is
rewritten only in `color:` declarations. `rewriteDeclaration` is the single place
that decision is made.

### `link-in-text-block` — 8 nodes, 8 pages, cleared

The roadmap posts set `a{text-decoration:none}` site-wide, so the eight body
cross-links #197 added were distinguishable by hue alone (2.33:1 against the
surrounding text, against a 3:1 floor). Adding `p a{text-decoration:underline}`
satisfies WCAG 1.4.1 unconditionally. Scoped to links inside a paragraph so the
station cards and masthead links — which carry their own inline
`text-decoration:none` and win over this rule anyway — are untouched.

### Two dark surfaces where the palette had to be overridden

The whole table assumes a light background. On a dark one that assumption
inverts. The first run introduced **13 new failures** of exactly this shape, and
they were caught only because the before/after sweep diffs node by node:

| Rule | Before | After the naive substitution |
| --- | --- | --- |
| `.phase-card .phase-label` on `#232323` | `#C9A961` — **6.98 PASS** | `#806633` — 2.89 FAIL |
| `.closing a` on `#0E1B26` (x8 pages) | `#019A48` — **4.75 PASS** | `#01873F` — 3.77 FAIL |

Light and dark cannot share one value here: clearing 4.5:1 against `#FCFCFB`
caps a colour's luminance at 0.178, and clearing it against `#0E1B26` demands at
least 0.2245. Both rules are therefore excluded from the table and given a value
chosen for their own background, marked in the stylesheet with an
`a11y:dark-surface` comment that the rewriter honours — so a future re-run cannot
re-break them. A third failure on the same pages, `.eyebrow` (gold text at
2.19:1 on the light page), was pre-existing and is fixed at the same time.

The same trap was caught once more before it shipped: `#6b6b6b` is the
figure-caption grey, passing at 5.33:1 on white nearly everywhere and failing
only on one near-black footer band. Putting it in the table would have taken
~30 pages of captions from 5.33 down to 3.84. It is a one-page scoped rule
instead, with a comment saying why.


---

## 3. Task 3 — image alt text

**There is no missing alt text in this repo to add.** The sweep measured
308 of 308 `<img>` elements carrying an `alt` attribute and **0 missing** (§5 of
the findings). Re-checked independently here across every page in
`donovan-legal-site/**`: 149 `<img>` in page source, all with a non-empty `alt`,
none missing.

The 98 "decorative-vs-informative ambiguities" the sweep flagged for human
adjudication resolve to **one image, injected once per page**: the concierge
launcher orb. `donovan-legal-site/js/perch/brand.js` already states the decision
and its reason — the orb is a control, its parent `<button>` carries the
accessible name ("Talk to Donovan Legal — click to chat"), and so the `<img>`
inside it is correctly `alt=""`. Naming it again would make screen readers
announce the control twice. **Adjudicated: correct as authored, no change.**

The genuine image-accessibility defect the sweep recorded is **`svg-img-alt` —
28 inline diagrams on 26 blog pages**, which carry `role="img"` with no
accessible name while a perfectly good `<figcaption>` sits beside them unwired.
That is the "especially blog images" part of this task, it is real, and it needs
an attribute — so it is in §4.

---

## 4. Waiver request for Zane — everything this order could not ship

### The finding, stated plainly

`test/chrome-diff.test.mjs` rule 3 (`page-structure`) compares every element, its
nesting depth and **all of its attributes**, and fails when any of them differs.
Text nodes are deliberately excluded, because text is the surface a content edit
is allowed to change.

That line runs straight through accessibility work. Both halves were verified
against the real gate before any page was edited, not assumed:

| Probe | Result |
| --- | --- |
| Change a hex **inside a `<style>` block** (a text node) | chrome-diff **55/55 green** |
| Change a hex **inside a `style=""` attribute** | **`page-structure` fires** |

Everything in §2 is on the green side of that line, which is why this PR is
green. Every remaining defect is on the other side: `lang`, `aria-label`,
`aria-controls`, `alt`, an SVG `<title>`, a `role` — all attributes or elements.
**No amount of CSS reaches any of them.**

The gate's only accommodation is `REVIEWED_STRUCTURAL`, which its own
documentation calls "a waiver register, not a configuration switch… an assertion
by a named human that they ran the injector over that file's before and after
and compared the plans." This order forbids me from editing it, so this section
is the request rather than the diff.

### Why these edits are safe to waive — measured, not asserted

The register's own words are that an entry is "an assertion by a named human that
they ran the injector over that file's before and after and compared the plans."
`scripts/a11y/waiver-evidence.mjs` runs that comparison so Zane does not have to
take it on trust. For every file one of the proposed edits applies to, it builds
the edited version in memory and runs **the real `planFromHtml`** from
`functions/_lib/perch-main.js`, plus the three guards `structuralWaiver` itself
enforces — the nav's div-ancestor stack, the ordered body children, and the size
of the region the server would wrap.

```
control OK - a <main> moves the plan ({"kind":"wrap-div","openAfterDivEnd":31,...}
                                   -> {"kind":"stamp"})

files an attribute edit applies to : 83
plan + all three guards IDENTICAL  : 83
something moved (NOT waivable)     : 0
```

**The control is the load-bearing line.** `planFromHtml` is async and takes the
rewriter as its second argument. The first version of this script called it as
`planFromHtml(html)` and compared `JSON.stringify` of two *Promises* — `{}`
against `{}` — so all 83 files reported "identical" having compared nothing at
all. The control now takes a real page, adds a `<main>` (the documented way to
flip `decidePlan` onto another branch) and **requires the plan to move**; if it
does not, the script exits 2 and reports nothing.

The result is what the shape of these edits predicts: none of them adds, removes,
moves or re-nests an element. They set or clear attributes, except the SVG
naming, which adds `aria-labelledby` to a tag that already exists.

*On the counts: 83 is the number of files at least one proposed edit matches,
which is slightly broader than the 81 derived from PR #216's defect list, because
the same accordion and inline-colour markup also appears on tier-duplicated pages
(`diamond/`, `gold/`, `platinum/`, `index.html`) that the sweep did not list
separately. Waiving the listed files alone is fine; the extra ones simply show
the edit is uniform.*

### The register entries requested

**81 distinct files**, listed per rule below with the exact edit.

### `color-contrast` - 219 colour values in `style=""` across 43 files

**What is wrong.** The colour is written in an element `style=""` attribute. An
inline style outranks every stylesheet, so neither #213's re-value nor this PR's
per-page rewrite can reach it. PR #216 proved exactly this with CDP on the home
page: `main.css` offers `#107a4d` and loses to `style="color: #169B62"`.

**The edit.** Delete the colour declaration from the attribute and let the
stylesheet win - it is already compliant. No element is added, removed or moved.

**Scope below is repo-derived and exact** (every old brand hex still appearing
inside a `style=""`), not an estimate from the sweep. Locally this is what keeps
20 nodes on 6 pages failing after this PR; in production it will be more, because
production renders more.

| Source file | colour values in `style=""` |
| --- | ---: |
| `donovan-legal-site/tools.html` | 45 |
| `donovan-legal-site/home.html` | 14 |
| `donovan-legal-site/index.html` | 14 |
| `donovan-legal-site/diamond/tool-rental-real-estate-tax-strategy-analyzer.html` | 10 |
| `donovan-legal-site/gold/tool-rental-real-estate-tax-strategy-analyzer.html` | 10 |
| `donovan-legal-site/platinum/tool-rental-real-estate-tax-strategy-analyzer.html` | 10 |
| `donovan-legal-site/reserve/tool-rental-real-estate-tax-strategy-analyzer.html` | 10 |
| `donovan-legal-site/tool-rental-real-estate-tax-strategy-analyzer.html` | 10 |
| `donovan-legal-site/tool-str-strategy-analyzer.html` | 9 |
| `donovan-legal-site/testimonials.html` | 8 |
| `donovan-legal-site/engagement.html` | 6 |
| `donovan-legal-site/members/about-membership.html` | 6 |
| `donovan-legal-site/membership-reserve.html` | 6 |
| `donovan-legal-site/diamond/tool-operating-agreement.html` | 4 |
| `donovan-legal-site/membership-diamond.html` | 4 |
| `donovan-legal-site/membership-gold.html` | 4 |
| `donovan-legal-site/membership-platinum.html` | 4 |
| `donovan-legal-site/ourfirm.html` | 4 |
| `donovan-legal-site/reserve/tool-operating-agreement.html` | 4 |
| `donovan-legal-site/tool-oic-rcp-estimator.html` | 4 |
| `donovan-legal-site/contact.html` | 3 |
| `donovan-legal-site/diamond/tool-1031-exchange.html` | 2 |
| `donovan-legal-site/gold/tool-1031-exchange.html` | 2 |
| `donovan-legal-site/platinum/tool-1031-exchange.html` | 2 |
| `donovan-legal-site/reserve/tool-1031-exchange.html` | 2 |
| `donovan-legal-site/tool-1031-exchange.html` | 2 |
| `donovan-legal-site/tool-cost-segregation.html` | 2 |
| `donovan-legal-site/tool-entity-formation.html` | 2 |
| `donovan-legal-site/tool-firpta-withholding.html` | 2 |
| `donovan-legal-site/book.html` | 1 |
| `donovan-legal-site/diamond/SAMPLE_Multi_Tier_Deal_Package.html` | 1 |
| `donovan-legal-site/diamond/SAMPLE_Multi_Tier_NY_Publication.html` | 1 |
| `donovan-legal-site/diamond/SAMPLE_Small_JV_No_Reg_D.html` | 1 |
| `donovan-legal-site/leidy.html` | 1 |
| `donovan-legal-site/profile.html` | 1 |
| `donovan-legal-site/reserve/SAMPLE_Multi_Tier_Deal_Package.html` | 1 |
| `donovan-legal-site/reserve/SAMPLE_Multi_Tier_NY_Publication.html` | 1 |
| `donovan-legal-site/reserve/SAMPLE_Small_JV_No_Reg_D.html` | 1 |
| `donovan-legal-site/tefera.html` | 1 |
| `donovan-legal-site/tool-capital-gains.html` | 1 |
| `donovan-legal-site/tool-economics.html` | 1 |
| `donovan-legal-site/tool-irs-notice-guide.html` | 1 |
| `donovan-legal-site/wendy.html` | 1 |

### `svg-img-alt` - serious - 28 node(s) on 26 page(s)

**What is wrong.** The inline diagram carries `role="img"` with no accessible name, while a `<figcaption>` describing it sits beside it unwired.

**The edit.** Give the figcaption an `id` and point the `<svg>` at it with `aria-labelledby` (or add a `<title>` child). Needs one written description per diagram - 28 of them - so this is the only item here that is not purely mechanical.

| Source file | Nodes |
| --- | ---: |
| `donovan-legal-site/blog-augusta-rule-280a-g.html` | 1 |
| `donovan-legal-site/blog-character-amount-timing.html` | 1 |
| `donovan-legal-site/blog-civil-fraud-eggshell-audit.html` | 1 |
| `donovan-legal-site/blog-conservation-easement-settlement.html` | 1 |
| `donovan-legal-site/blog-criminal-tax-overview.html` | 1 |
| `donovan-legal-site/blog-currently-not-collectible-csed.html` | 1 |
| `donovan-legal-site/blog-fbar-foreign-account-penalties.html` | 1 |
| `donovan-legal-site/blog-foreclose-federal-tax-lien-suit.html` | 1 |
| `donovan-legal-site/blog-irs-co-owned-marital-real-estate.html` | 1 |
| `donovan-legal-site/blog-irs-levy.html` | 2 |
| `donovan-legal-site/blog-irs-summons.html` | 1 |
| `donovan-legal-site/blog-jeopardy-termination-assessments.html` | 1 |
| `donovan-legal-site/blog-kwong-covid-deadlines.html` | 1 |
| `donovan-legal-site/blog-material-participation-seven-tests.html` | 1 |
| `donovan-legal-site/blog-notice-of-federal-tax-lien.html` | 1 |
| `donovan-legal-site/blog-passport-revocation-tax-debt.html` | 1 |
| `donovan-legal-site/blog-penalty-regime-6751b.html` | 1 |
| `donovan-legal-site/blog-per-se-passive-rule-exceptions.html` | 1 |
| `donovan-legal-site/blog-real-estate-professional-status-reps.html` | 1 |
| `donovan-legal-site/blog-short-term-rental-play.html` | 1 |
| `donovan-legal-site/blog-subdivision-basis-allocation.html` | 1 |
| `donovan-legal-site/blog-substitute-for-return.html` | 1 |
| `donovan-legal-site/blog-tax-opinions.html` | 1 |
| `donovan-legal-site/blog-tenancy-by-entirety-federal-tax-lien.html` | 1 |
| `donovan-legal-site/blog-transferee-nominee-alter-ego.html` | 1 |
| `donovan-legal-site/blog-trust-fund-recovery-penalty.html` | 2 |

### `aria-valid-attr-value` - critical - 24 node(s) on 8 page(s)

**What is wrong.** All three accordion toggles per page point `aria-controls="collapseOne"` at an id that does not exist on the page; the panels they actually open are `#fl-inside2`, `#fl-inside3` and `#fl-inside4`.

**The edit.** Repoint each `aria-controls` at the panel that button opens. One attribute value each.

| Source file | Nodes |
| --- | ---: |
| `donovan-legal-site/contracts.html` | 3 |
| `donovan-legal-site/development.html` | 3 |
| `donovan-legal-site/eminent-domain.html` | 3 |
| `donovan-legal-site/entity-formation.html` | 3 |
| `donovan-legal-site/leasing.html` | 3 |
| `donovan-legal-site/litigation.html` | 3 |
| `donovan-legal-site/property-acquisition.html` | 3 |
| `donovan-legal-site/re-financing.html` | 3 |

### `button-name` - critical - 24 node(s) on 8 page(s)

**What is wrong.** The same three icon-only toggles have no inner text, no `aria-label` and no `aria-labelledby`, so a screen reader announces "button" three times with nothing to tell them apart.

**The edit.** Add `aria-label` naming the section each one opens.

| Source file | Nodes |
| --- | ---: |
| `donovan-legal-site/contracts.html` | 3 |
| `donovan-legal-site/development.html` | 3 |
| `donovan-legal-site/eminent-domain.html` | 3 |
| `donovan-legal-site/entity-formation.html` | 3 |
| `donovan-legal-site/leasing.html` | 3 |
| `donovan-legal-site/litigation.html` | 3 |
| `donovan-legal-site/property-acquisition.html` | 3 |
| `donovan-legal-site/re-financing.html` | 3 |

### `html-has-lang` - serious - 9 node(s) on 9 page(s)

**What is wrong.** `<html class="no-js" lang="">` - the attribute is present but EMPTY, which is why this reads as a defect rather than an omission.

**The edit.** Set `lang="en"`. One attribute value.

| Source file | Nodes |
| --- | ---: |
| `donovan-legal-site/business-law.html` | 1 |
| `donovan-legal-site/contracts.html` | 1 |
| `donovan-legal-site/development.html` | 1 |
| `donovan-legal-site/eminent-domain.html` | 1 |
| `donovan-legal-site/entity-formation.html` | 1 |
| `donovan-legal-site/leasing.html` | 1 |
| `donovan-legal-site/litigation.html` | 1 |
| `donovan-legal-site/property-acquisition.html` | 1 |
| `donovan-legal-site/re-financing.html` | 1 |

### `nested-interactive` - serious - 2 node(s) on 2 page(s)

**What is wrong.** An `<svg>` contains focusable descendants, so keyboard focus lands inside a graphic.

**The edit.** Add `focusable="false"` to the `<svg>` / drop the descendant `tabindex`.

| Source file | Nodes |
| --- | ---: |
| `donovan-legal-site/florida-sales-tax-audit.html` | 1 |
| `donovan-legal-site/massachusetts-tax-appeal.html` | 1 |

### `aria-required-children` - critical - 1 node(s) on 1 page(s)

**What is wrong.** `.blog-filter` declares an ARIA role whose children may not be `button`.

**The edit.** Correct the role on the container to one that admits buttons.

| Source file | Nodes |
| --- | ---: |
| `donovan-legal-site/blog.html` | 1 |

### `select-name` - critical - 1 node(s) on 1 page(s)

**What is wrong.** `#niit` has no implicit or explicit `<label>` and no `aria-label`.

**The edit.** Add `aria-label` naming the field.

| Source file | Nodes |
| --- | ---: |
| `donovan-legal-site/tool-capital-gains.html` | 1 |

---

## 5. Task 5 - before / after axe-core, per changed page

Same 80 pages, same harness, `origin/main` versus this branch. "Rules still
open" is what remains after this PR; every one of them is a section 4 waiver item.

| Page | axe before | axe after | change | rules still open |
| --- | ---: | ---: | ---: | --- |
| `/tool-1031-exchange.html` | 30 | 1 | **-29** | `color-contrast`x1 |
| `/tool-irs-notice-guide.html` | 16 | 0 | **-16** | **none** |
| `/blog-controversy-roadmap-4-appeals.html` | 14 | 0 | **-14** | **none** |
| `/blog-controversy-roadmap-3-exam-alternatives.html` | 12 | 0 | **-12** | **none** |
| `/tool-cost-segregation.html` | 12 | 1 | **-11** | `color-contrast`x1 |
| `/blog-controversy-roadmap-1-processing-assessment.html` | 10 | 0 | **-10** | **none** |
| `/blog-controversy-roadmap-2-exam.html` | 8 | 0 | **-8** | **none** |
| `/contact.html` | 11 | 3 | **-8** | `color-contrast`x3 |
| `/blog-controversy-roadmap-6-collection-alternatives.html` | 7 | 0 | **-7** | **none** |
| `/tool-firpta-withholding.html` | 7 | 0 | **-7** | **none** |
| `/tool-capital-gains.html` | 7 | 1 | **-6** | `select-name`x1 |
| `/tool-deal-builder-preview.html` | 6 | 0 | **-6** | **none** |
| `/tool-oic-rcp-estimator.html` | 9 | 3 | **-6** | `color-contrast`x3 |
| `/blog-civil-fraud-eggshell-audit.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-controversy-roadmap-5-collection.html` | 5 | 0 | **-5** | **none** |
| `/blog-criminal-tax-overview.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-currently-not-collectible-csed.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-fbar-foreign-account-penalties.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-foreclose-federal-tax-lien-suit.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-irs-co-owned-marital-real-estate.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-irs-levy.html` | 7 | 2 | **-5** | `svg-img-alt`x2 |
| `/blog-irs-summons.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-jeopardy-termination-assessments.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-passport-revocation-tax-debt.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-penalty-regime-6751b.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-substitute-for-return.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-tenancy-by-entirety-federal-tax-lien.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-transferee-nominee-alter-ego.html` | 6 | 1 | **-5** | `svg-img-alt`x1 |
| `/blog-trust-fund-recovery-penalty.html` | 7 | 2 | **-5** | `svg-img-alt`x2 |
| `/blog-conservation-easement-settlement.html` | 5 | 1 | **-4** | `svg-img-alt`x1 |
| `/blog-controversy-roadmap-0-overview.html` | 4 | 0 | **-4** | **none** |
| `/blog-controversy-roadmap-7-litigation.html` | 4 | 0 | **-4** | **none** |
| `/blog-kwong-covid-deadlines.html` | 5 | 1 | **-4** | `svg-img-alt`x1 |
| `/blog-notice-of-federal-tax-lien.html` | 5 | 1 | **-4** | `svg-img-alt`x1 |
| `/blog-tax-opinions.html` | 5 | 1 | **-4** | `svg-img-alt`x1 |
| `/blog-461l-excess-business-loss-and-172-nol.html` | 3 | 0 | **-3** | **none** |
| `/blog-augusta-rule-280a-g.html` | 4 | 1 | **-3** | `svg-img-alt`x1 |
| `/blog-character-amount-timing.html` | 4 | 1 | **-3** | `svg-img-alt`x1 |
| `/blog-firpta-foreign-sellers.html` | 3 | 0 | **-3** | **none** |
| `/blog-material-participation-seven-tests.html` | 4 | 1 | **-3** | `svg-img-alt`x1 |
| `/blog-partnership-agreement-tax-document.html` | 3 | 0 | **-3** | **none** |
| `/blog-per-se-passive-rule-exceptions.html` | 4 | 1 | **-3** | `svg-img-alt`x1 |
| `/blog-real-estate-professional-status-reps.html` | 4 | 1 | **-3** | `svg-img-alt`x1 |
| `/blog-short-term-rental-material-participation.html` | 3 | 0 | **-3** | **none** |
| `/blog-short-term-rental-play.html` | 4 | 1 | **-3** | `svg-img-alt`x1 |
| `/blog-subdivision-basis-allocation.html` | 4 | 1 | **-3** | `svg-img-alt`x1 |
| `/blog-irs-audit-notice-what-to-do.html` | 2 | 0 | **-2** | **none** |
| `/blog-bramblett-phelan-two-entity-structure.html` | 1 | 0 | **-1** | **none** |
| `/audit-reconsideration.html` | 0 | 0 | 0 | **none** |
| `/blog.html` | 1 | 1 | 0 | `aria-required-children`x1 |
| `/business-law.html` | 1 | 1 | 0 | `html-has-lang`x1 |
| `/contracts.html` | 7 | 7 | 0 | `aria-valid-attr-value`x3<br>`button-name`x3<br>`html-has-lang`x1 |
| `/development.html` | 7 | 7 | 0 | `aria-valid-attr-value`x3<br>`button-name`x3<br>`html-has-lang`x1 |
| `/eminent-domain.html` | 7 | 7 | 0 | `aria-valid-attr-value`x3<br>`button-name`x3<br>`html-has-lang`x1 |
| `/entity-formation.html` | 7 | 7 | 0 | `aria-valid-attr-value`x3<br>`button-name`x3<br>`html-has-lang`x1 |
| `/florida-sales-tax-audit.html` | 1 | 1 | 0 | `nested-interactive`x1 |
| `/home.html` | 9 | 9 | 0 | `color-contrast`x9 |
| `/irs-appeals.html` | 0 | 0 | 0 | **none** |
| `/irs-audit-defense.html` | 0 | 0 | 0 | **none** |
| `/irs-liens-levies.html` | 0 | 0 | 0 | **none** |
| `/irs-notice.html` | 0 | 0 | 0 | **none** |
| `/leasing.html` | 7 | 7 | 0 | `aria-valid-attr-value`x3<br>`button-name`x3<br>`html-has-lang`x1 |
| `/litigation.html` | 7 | 7 | 0 | `aria-valid-attr-value`x3<br>`button-name`x3<br>`html-has-lang`x1 |
| `/massachusetts-tax-appeal.html` | 1 | 1 | 0 | `nested-interactive`x1 |
| `/ourfirm.html` | 0 | 0 | 0 | **none** |
| `/partnership-audits.html` | 0 | 0 | 0 | **none** |
| `/practice.html` | 0 | 0 | 0 | **none** |
| `/property-acquisition.html` | 7 | 7 | 0 | `aria-valid-attr-value`x3<br>`button-name`x3<br>`html-has-lang`x1 |
| `/re-financing.html` | 7 | 7 | 0 | `aria-valid-attr-value`x3<br>`button-name`x3<br>`html-has-lang`x1 |
| `/real-estate.html` | 0 | 0 | 0 | **none** |
| `/residency-audit.html` | 0 | 0 | 0 | **none** |
| `/tax-controversy.html` | 0 | 0 | 0 | **none** |
| `/tax-court.html` | 0 | 0 | 0 | **none** |
| `/tax-debt-resolution.html` | 0 | 0 | 0 | **none** |
| `/tax-penalties.html` | 0 | 0 | 0 | **none** |
| `/tax.html` | 0 | 0 | 0 | **none** |
| `/tool-rental-real-estate-tax-strategy-analyzer.html` | 3 | 3 | 0 | `color-contrast`x3 |
| `/tools.html` | 0 | 0 | 0 | **none** |
| `/unfiled-returns.html` | 0 | 0 | 0 | **none** |
| `/voluntary-disclosure.html` | 0 | 0 | 0 | **none** |
| **TOTAL - 80 pages** | **389** | **109** | **-280** | |

---

## 6. Method, and what this evidence does and does not prove

### The rewrite

`scripts/a11y/rewrite-contrast.mjs` rewrites text inside `<style>` elements and
nothing else. That is not a stylistic preference — it is what keeps the change on
the green side of the gate. The invariant is enforced per file, not spot-checked:
before writing, the script re-derives everything *outside* the style blocks in
both versions and refuses the file if a single byte differs.

### The measurement

`scripts/a11y/local-sweep.mjs` serves `donovan-legal-site/` over HTTP and
measures the same 80 pages twice — once from a `git archive` of `origin/main`,
once from the working tree — with the same axe version, tag set, viewport and
two-pass settle. It follows the discipline PR #216 established: serial
(concurrency 1), full-page reveal scroll, axe run twice 1,200 ms apart with only
nodes reproducing in **both** passes reported, and injected via `page.evaluate`
rather than `bypassCSP` so the measured DOM is the real one.

### Three honest limits on this evidence

1. **It is not production.** This harness serves static files; the Cloudflare
   middleware is not in the loop, so the injected `main#perch-main`, persistent
   call layer, router and booking bar are absent. That is why the local before
   count is **389** where the live sweep counted **1,130** — production renders
   more. Every defect in §4 is anchored to the page's own markup and every colour
   pair comes from the page's own `<style>` block or `main.css`, both of which
   load here exactly as in production; but **a rule that fires only on injected
   chrome would be invisible here.** A live sweep after deploy is still owed.

2. **`contact.html` needed a weaker wait.** It loads the Turnstile widget, which
   an offline server cannot answer, so `networkidle` never fires. The harness
   falls back to `load` + 2 s and **says so in its output** rather than dropping
   the page. On that page the three residual nodes were measured mid
   `animate__fadeIn`, which is why axe reports a composited `#7bc4a3` rather than
   a literal hex — the underlying cause is still a plain
   `style="color: #169B62"`, read directly out of the markup at line 599.

3. **The 20 residual contrast nodes are not a proportional estimate of
   production.** They are what remains locally. Production will show more,
   because production renders more.

### The sweep server itself

CodeQL flagged the harness's static server as `js/path-injection` (high), twice.
The second round is the one worth recording: the containment check was correct
but lived in a helper that RETURNED the resolved path, so the barrier was not on
the path to the sink and the sinks were flagged again. The request path is now
never used to build a path at all — every file under the root is indexed once at
startup and a request can only select an entry from that map, so what reaches
`readFileSync` is a value this process derived from the filesystem. Driven
against the real exported `serve`, `/../package.json`, `/..%2f..%2fpackage.json`,
`/%2e%2e/package.json` and `/....//package.json` all 404 while `/`,
`/home.html` and `/css/main.css` serve normally.

### The raw results are committed

`docs/a11y-195-axe-before.json` and `docs/a11y-195-axe-after.json` are the two
runs behind every number in this document — every rule, every node, every target
selector, for all 80 pages. The tables above are derived from them, so a reader
can check the derivation rather than trust it.

### Reproducing it

```
node scripts/a11y/rewrite-contrast.mjs --dry-run     # 0 files — the rewrite is idempotent
npm test                                             # 2472 pass / 0 fail
node scripts/a11y/local-sweep.mjs \
  --pages <80-page list> --base origin/main --out ./a11y-local
```

---

## 7. What is still open against #195

| Rule | Impact | Nodes open | Blocked on |
| --- | --- | ---: | --- |
| `color-contrast` | serious | 20 measured locally; 219 colour values in `style=""` across 43 files | Zane waiver |
| `svg-img-alt` | serious | 28 | Zane waiver + 28 written descriptions |
| `aria-valid-attr-value` | critical | 24 | Zane waiver |
| `button-name` | critical | 24 | Zane waiver |
| `html-has-lang` | serious | 9 | Zane waiver |
| `nested-interactive` | serious | 2 | Zane waiver |
| `aria-required-children` | critical | 1 | Zane waiver |
| `select-name` | critical | 1 | Zane waiver |

**All eight rows above were CLEARED by ORDER JORDAN-195-LEVELA-WAIVER-R1 — see §8.**
That order authorised the `REVIEWED_STRUCTURAL` waiver; the 89 attribute nodes and 187 of
the 219 inline colour values were applied across the same 81 files, and the
remaining 32 colour values are the gold-as-a-band split §2 describes, held on
purpose. What is still owed is the **live production sweep after deploy** (§8.7).

**#195 stays open until that sweep runs.** Agents do not merge — Zane gates, David merges.
---

## 8. JORDAN-195-LEVELA-WAIVER-R1 — the waiver granted, and the edits applied

§4 above is the *request*. This section is the *record*: ORDER
JORDAN-195-LEVELA-WAIVER-R1 authorised the `REVIEWED_STRUCTURAL` waiver and
applied it. Zane still gates the pull request; nothing here is self-approval.

**81 files changed. 89 Level A/AA attribute nodes fixed. 187 of the 219 inline
colour values re-valued.** Nothing else in the site changed: no element was
added, removed, re-nested or re-ordered, `css/main.css` is untouched, and the
injector's plan is byte-identical on every one of the 81 pages.

### 8.1 What was applied, per rule

| Rule | Impact | Nodes | The edit that shipped |
| --- | --- | ---: | --- |
| `color-contrast` | serious | 187 values / 43 files | brand hexes inside `style=""` re-valued from `scripts/a11y/palette-195.mjs`, with three background-scoped overrides (§8.3) |
| `svg-img-alt` | serious | 28 / 26 | an `id` on the `<figcaption>` and `aria-labelledby` on the `<svg>` it already describes |
| `aria-valid-attr-value` | critical | 24 / 8 | each accordion toggle's `aria-controls` repointed at the panel it opens (`#fl-inside2/3/4`) instead of a non-existent `#collapseOne` |
| `button-name` | critical | 24 / 8 | each toggle gains an `aria-label` taken from the `.link-yellow` heading beside it — *"Show Business Law practice areas"*, not one generic string three times |
| `html-has-lang` | serious | 9 / 9 | `lang=""` → `lang="en"` |
| `nested-interactive` | serious | 2 / 2 | the state map holding eight `<a href>` stations goes `role="img"` → `role="group"` |
| `aria-required-children` | critical | 1 / 1 | `.blog-filter` goes `role="tablist"` → `role="group"`, which admits its plain `<button>` children |
| `select-name` | critical | 1 / 1 | `#niit` gains the `aria-label` its unwired `<label>` already reads |
| **Total** | | **89 attribute nodes + 187 colour values** | |

### 8.2 Four things §4's draft transforms got wrong

§4's transforms were written to **size** the request, not to ship it. Applying
them unchanged would have shipped four defects. Each was found by running the
result through the real axe or the real gate, not by re-reading the regex.

| # | §4's draft | What it actually does | What shipped instead |
| --- | --- | --- | --- |
| 1 | `svg-img-alt`: add `aria-labelledby="dlfig-N"` | never adds the matching `id` — **28 dangling references**, which trades one `serious` for one `critical` and leaves the diagram just as unnamed | both attributes written in the same pass, so a dangling reference is not representable |
| 2 | `button-name`: one generic `aria-label` | satisfies the axe rule and **not the defect** — three toggles still announce identically | the label is the `.link-yellow` heading in the toggle's own `.card-header`, so it cannot drift from the visible text |
| 3 | `color-contrast`: **delete** the declaration | fine on a light surface; on a dark one the cascade's next value was chosen for light. Gold on the `#0a5a37` alert band: **3.69 → 1.53** | recolour through `rewriteDeclaration`, with three background-scoped overrides (§8.3) |
| 4 | `nested-interactive`: `focusable="false"` | measured on `/florida-sales-tax-audit`: **leaves the node failing**. It is an IE-era hint and does nothing to a descendant `<a href>`. The same regex also matched eight roadmap diagrams that do not have the defect | `role="group"`, which takes the page to zero and raises no `aria-allowed-role`; and the match now requires an `<a href>` descendant |

### 8.3 The three dark surfaces, and why 32 colour values were left alone

The palette darkens toward black because it assumes a light background. §2 already
records two dark surfaces in the stylesheet. Three more live in `style=""`
attributes, where there is no stylesheet to carry an `a11y:dark-surface` comment —
so the marker is written **into the attribute**, which is exactly where
`rewriteDeclaration` already looks for it. A re-run of the palette is therefore a
no-op on these rather than a re-break.

| Where | Pairing | Naive substitution | What shipped |
| --- | --- | --- | --- |
| `home.html`, `index.html` — gold "Read more →" on the deep-green alert band | `#C9A961` on `#0a5a37` = **3.69 FAIL** | `#806633` = **1.53** | `#D5BD85` (`--dl-gold-on-deep`) = **4.52 PASS** |
| `home.html`, `index.html` — deep-green badge text on the gold chip | `#0a5a37` on `#C9A961` = **3.69 FAIL** | (untouched — gold as a band is never darkened) | text side moved to `#084B2E` (`--dl-green-on-gold`) = **4.51 PASS** |
| `engagement.html`, `members/about-membership.html`, `membership-reserve.html` — brand-green eyebrow on the RESERVE black card | `#169B62` on `#1a1a1a` = **4.89 PASS** | `#107A4D` = **3.24 FAIL** | left at `#169B62` and **marked** `a11y:dark-surface` |

Chromium parses a CSS comment inside a `style=""` declaration list and keeps every
declaration after it — verified with `getComputedStyle`, not assumed:
`color` resolves to `rgb(8, 75, 46)` / `rgb(213, 189, 133)` / `rgb(22, 155, 98)`
and `white-space:nowrap` after the comment still applies.

**32 of the 219 values were deliberately NOT re-valued**, and the split is the
gold rule from §2 applied to the attributes: 18 × `#C9A961` used as a band or
`border-left` (a border is not text and `color-contrast` never looks at one),
11 × `#0a5a37` used as a fill or border, and the 3 dark-surface eyebrows above.
219 = 187 re-valued + 32 held.

### 8.4 Before and after — axe-core, the 81 changed pages

`scripts/a11y/local-sweep.mjs`, `origin/main` versus this branch, the **81 changed
pages**, same axe version, same tag set, same viewport, serial, two passes 1200ms
apart with only nodes reproducing in both reported. 0 pages fell back to the
weaker `load` wait; 0 UNMEASURED.

| Rule | Impact | before | after | change |
| --- | --- | ---: | ---: | ---: |
| `color-contrast` | serious | 85 | 27 | **−58** |
| `svg-img-alt` | serious | 28 | **0** | **−28** |
| `aria-valid-attr-value` | **critical** | 24 | **0** | **−24** |
| `button-name` | **critical** | 24 | **0** | **−24** |
| `html-has-lang` | serious | 9 | **0** | **−9** |
| `select-name` | **critical** | 7 | 6 | −1 |
| `nested-interactive` | serious | 2 | **0** | **−2** |
| `aria-required-children` | **critical** | 1 | **0** | **−1** |
| `label` | **critical** | 2 | 2 | ±0 |
| **Total (serious + critical)** | | **182** | **35** | **−147 (−81%)** |

**New failures introduced: 0.** Compared node by node — page × rule × target —
not by comparing the two totals, because a total can fall while a dark surface
inverts underneath it. That is exactly what §2 records happening on the first run
of the stylesheet rewrite, and it is why §8.3 exists.

**Every node in §4's defect list is now zero.** All 89 attribute nodes cleared,
and the 4 critical rules §4 listed — `aria-valid-attr-value`, `button-name`,
`aria-required-children`, `select-name` — are zero on every page §4 named.

### The residual, and why it is a floor rather than an omission

**8 of the 35 remaining nodes are criticals on two pages §4 never listed.**
`diamond/tool-operating-agreement.html` and `reserve/tool-operating-agreement.html`
carry 6 × `select-name` and 2 × `label` between them. They are in this order's
*colour* scope, which is why the harness measured them at all; their form defects
were never in PR #216's sweep because neither page is in `sitemap.xml`. Both
counts are **unchanged** by this PR — nothing here caused them and nothing here
was licensed to fix them.

**The other 27 are `color-contrast`, and not one of them comes from a
`style=""` attribute.** Read out of Chrome, the winning declarations are
`#169b62` and `#c9a961` served from **nine per-tool stylesheets** that no pass has
ever touched: #213 re-valued `css/main.css`, #220 rewrote the per-page `<style>`
blocks, this order rewrote the `style=""` attributes — and `css/tool-*.css` is a
fourth surface nobody has been ordered onto.

| Stylesheet | old brand hexes |
| --- | ---: |
| `css/tool-deal-builder.css` | 107 |
| `css/tool-str-strategy-analyzer.css` | 63 |
| `css/tool-structuring.css` | 30 |
| `css/tool-economics.css` | 27 |
| `css/tool-entity-formation-multi.css` | 27 |
| `css/tool-operating-agreement.css` | 21 |
| `css/tool-entity-formation.css` | 19 |
| `css/consent-gate.css` | 6 |
| `css/members-signout.css` | 4 |
| **Total** | **304** |

(`css/main.css` still holds 7, all of them gold used as a `border-top-color` or a
badge border, plus two in comments — the gold split of §2, correct as they are.)

One of the 27 is worth naming because it is the §8.3 shape again, one surface
over: `.tool-header-brand .re` renders `#107a4d` on `#1a1a1a` at **3.24**. That
value came from #213's stylesheet re-value, it is failing on `origin/main` too,
and it wants the same treatment — a value chosen for its own background and an
`a11y:dark-surface` marker. A stylesheet edit is a text-node change and would sail
through chrome-diff; it is simply not in this order.

**So the floor is: 27 `color-contrast` from `css/tool-*.css`, and 8 form
criticals on two non-sitemap tier pages. Both are one scoped follow-up order.**

### 8.5 The evidence, and how it can no longer go vacuous

`scripts/a11y/waiver-evidence.mjs` was rewritten for this order. §4's version
transformed the working tree in memory and compared it against itself — the right
instrument for a request, and the wrong one once the edits are on disk, where
every transform is a no-op and the run would report *"no edit applies"* and go
green having compared nothing.

It now recovers each file's **before** from `origin/main` with `git show`,
requires the working tree to be **byte-identical** to the reviewed transforms
applied to that before, and only then runs the real `planFromHtml` plus the
guards. It carries two controls:

- **Control 1** — an added `<main>` must MOVE the plan. `planFromHtml` is async
  and takes the rewriter as its second argument; the first version of this script
  called it as `planFromHtml(html)` and compared two `JSON.stringify(Promise)`
  results, so all 83 files reported "identical" having compared nothing.
- **Control 2** — the per-file check itself must bite. It is handed an after that
  is not what the transform produces, and an after whose plan moves, and required
  to name each.

It also compares the **nav** and **footer** subtrees byte for byte. Those are
`site-navigation` and `footer-copyright`, which `REVIEWED_STRUCTURAL` does **not**
waive and could not waive — so the fact that no edit strayed into them is
measured here rather than assumed.

```
control 1 OK — a <main> moves the plan ({"kind":"wrap-div","openAfterDivEnd":31,"closeBe… -> {"kind":"stamp"}…)
control 2 OK — on donovan-legal-site/blog.html a corrupted after reports [disk≠transform] and an added <main> reports [disk≠transform, plan, body]

base                                    : origin/main
pages changed on this branch            : 81
pages in the waiver register            : 81
changed pages with NO register entry    : 0
disk matches the reviewed transform     : 81 / 81
plan + nav + body + region + nav/footer subtree IDENTICAL : 81
something moved (NOT waivable)          : 0
```

### 8.6 The waiver is load-bearing, and it is narrow

Run `comparePage` over the same before/after under a filename that is **not** on
the register, and the gate reds — on `page-structure` and on nothing else:

| Page | as listed | under a name not on the list |
| --- | --- | --- |
| `contracts.html` | clean | `page-structure` |
| `tools.html` | clean | `page-structure` |
| `blog-irs-levy.html` | clean | `page-structure` |
| `blog.html` | clean | `page-structure` |
| `florida-sales-tax-audit.html` | clean | `page-structure` |
| `home.html` | clean | `page-structure` |

`contact.html` was already on the register from SHELDON-CONTACT-ROUTE-R1 (#214).
Its entry was **extended**, not replaced — a duplicate key in the `Map` literal
would have silently overwritten Sheldon's reason, which is the opposite of what a
waiver register is for. The register is therefore **90** entries, not 91.

### 8.7 What is still owed

1. **The live production sweep.** Everything above is measured against the repo
   served as static files. The Cloudflare middleware is not in the loop, so
   `main#perch-main`, the persistent call layer, the Swup router and the booking
   bar are absent, and production renders more than this harness does. A live
   sweep of all 98 sitemap URLs after deploy is **still owed** and is the only
   thing that closes #195. It cannot be run from a branch.
2. **The sibling pages this order's scope does not cover.** The waiver names
   exactly the 81 files PR #216's sweep measured. `apply-waiver-edits.mjs` reports,
   by name, every page carrying the same defect that is **not** waived — it is not
   an error, it is the follow-up order's work list:

   | Rule | Pages outside this waiver |
   | --- | --- |
   | `html-has-lang` | `business-formation`, `desclimer`, `financing`, `formation`, `re-transaction`, `tax-controversies`, `taxation`, `the-cmm`, `the-cmm2` |
   | `aria-valid-attr-value` | `business-formation`, `financing`, `formation`, `re-transaction`, `tax-controversies`, `the-cmm`, `the-cmm2` |
   | `button-name` | `business-formation`, `financing`, `formation`, `re-transaction`, `tax-controversies`, `the-cmm`, `the-cmm2` |

   These are not in `sitemap.xml`, which is why the sweep never saw them and why
   no reviewed waiver entry describes them. Waiving them would mean writing a
   register line nobody measured.

### 8.8 Per-file map — every change to the entry that covers it

| Page | Nodes fixed | REVIEWED_STRUCTURAL entry |
| --- | --- | --- |
| `blog-augusta-rule-280a-g.html` | `svg-img-alt`×1 | yes |
| `blog-character-amount-timing.html` | `svg-img-alt`×1 | yes |
| `blog-civil-fraud-eggshell-audit.html` | `svg-img-alt`×1 | yes |
| `blog-conservation-easement-settlement.html` | `svg-img-alt`×1 | yes |
| `blog-criminal-tax-overview.html` | `svg-img-alt`×1 | yes |
| `blog-currently-not-collectible-csed.html` | `svg-img-alt`×1 | yes |
| `blog-fbar-foreign-account-penalties.html` | `svg-img-alt`×1 | yes |
| `blog-foreclose-federal-tax-lien-suit.html` | `svg-img-alt`×1 | yes |
| `blog-irs-co-owned-marital-real-estate.html` | `svg-img-alt`×1 | yes |
| `blog-irs-levy.html` | `svg-img-alt`×2 | yes |
| `blog-irs-summons.html` | `svg-img-alt`×1 | yes |
| `blog-jeopardy-termination-assessments.html` | `svg-img-alt`×1 | yes |
| `blog-kwong-covid-deadlines.html` | `svg-img-alt`×1 | yes |
| `blog-material-participation-seven-tests.html` | `svg-img-alt`×1 | yes |
| `blog-notice-of-federal-tax-lien.html` | `svg-img-alt`×1 | yes |
| `blog-passport-revocation-tax-debt.html` | `svg-img-alt`×1 | yes |
| `blog-penalty-regime-6751b.html` | `svg-img-alt`×1 | yes |
| `blog-per-se-passive-rule-exceptions.html` | `svg-img-alt`×1 | yes |
| `blog-real-estate-professional-status-reps.html` | `svg-img-alt`×1 | yes |
| `blog-short-term-rental-play.html` | `svg-img-alt`×1 | yes |
| `blog-subdivision-basis-allocation.html` | `svg-img-alt`×1 | yes |
| `blog-substitute-for-return.html` | `svg-img-alt`×1 | yes |
| `blog-tax-opinions.html` | `svg-img-alt`×1 | yes |
| `blog-tenancy-by-entirety-federal-tax-lien.html` | `svg-img-alt`×1 | yes |
| `blog-transferee-nominee-alter-ego.html` | `svg-img-alt`×1 | yes |
| `blog-trust-fund-recovery-penalty.html` | `svg-img-alt`×2 | yes |
| `blog.html` | `aria-required-children`×1 | yes |
| `book.html` | `color-contrast`×1 | yes |
| `business-law.html` | `html-has-lang`×1 | yes |
| `contact.html` | `color-contrast`×3 | yes |
| `contracts.html` | `html-has-lang`×1, `aria-valid-attr-value`×3, `button-name`×3 | yes |
| `development.html` | `html-has-lang`×1, `aria-valid-attr-value`×3, `button-name`×3 | yes |
| `diamond/SAMPLE_Multi_Tier_Deal_Package.html` | `color-contrast`×1 | yes |
| `diamond/SAMPLE_Multi_Tier_NY_Publication.html` | `color-contrast`×1 | yes |
| `diamond/SAMPLE_Small_JV_No_Reg_D.html` | `color-contrast`×1 | yes |
| `diamond/tool-1031-exchange.html` | `color-contrast`×2 | yes |
| `diamond/tool-operating-agreement.html` | `color-contrast`×3 | yes |
| `diamond/tool-rental-real-estate-tax-strategy-analyzer.html` | `color-contrast`×10 | yes |
| `eminent-domain.html` | `html-has-lang`×1, `aria-valid-attr-value`×3, `button-name`×3 | yes |
| `engagement.html` | `color-contrast`×3 | yes |
| `entity-formation.html` | `html-has-lang`×1, `aria-valid-attr-value`×3, `button-name`×3 | yes |
| `florida-sales-tax-audit.html` | `nested-interactive`×1 | yes |
| `gold/tool-1031-exchange.html` | `color-contrast`×2 | yes |
| `gold/tool-rental-real-estate-tax-strategy-analyzer.html` | `color-contrast`×10 | yes |
| `home.html` | `color-contrast`×11 | yes |
| `index.html` | `color-contrast`×11 | yes |
| `leasing.html` | `html-has-lang`×1, `aria-valid-attr-value`×3, `button-name`×3 | yes |
| `leidy.html` | `color-contrast`×1 | yes |
| `litigation.html` | `html-has-lang`×1, `aria-valid-attr-value`×3, `button-name`×3 | yes |
| `massachusetts-tax-appeal.html` | `nested-interactive`×1 | yes |
| `members/about-membership.html` | `color-contrast`×3 | yes |
| `membership-diamond.html` | `color-contrast`×3 | yes |
| `membership-gold.html` | `color-contrast`×3 | yes |
| `membership-platinum.html` | `color-contrast`×3 | yes |
| `membership-reserve.html` | `color-contrast`×3 | yes |
| `ourfirm.html` | `color-contrast`×4 | yes |
| `platinum/tool-1031-exchange.html` | `color-contrast`×2 | yes |
| `platinum/tool-rental-real-estate-tax-strategy-analyzer.html` | `color-contrast`×10 | yes |
| `profile.html` | `color-contrast`×1 | yes |
| `property-acquisition.html` | `html-has-lang`×1, `aria-valid-attr-value`×3, `button-name`×3 | yes |
| `re-financing.html` | `html-has-lang`×1, `aria-valid-attr-value`×3, `button-name`×3 | yes |
| `reserve/SAMPLE_Multi_Tier_Deal_Package.html` | `color-contrast`×1 | yes |
| `reserve/SAMPLE_Multi_Tier_NY_Publication.html` | `color-contrast`×1 | yes |
| `reserve/SAMPLE_Small_JV_No_Reg_D.html` | `color-contrast`×1 | yes |
| `reserve/tool-1031-exchange.html` | `color-contrast`×2 | yes |
| `reserve/tool-operating-agreement.html` | `color-contrast`×3 | yes |
| `reserve/tool-rental-real-estate-tax-strategy-analyzer.html` | `color-contrast`×10 | yes |
| `tefera.html` | `color-contrast`×1 | yes |
| `testimonials.html` | `color-contrast`×8 | yes |
| `tool-1031-exchange.html` | `color-contrast`×2 | yes |
| `tool-capital-gains.html` | `select-name`×1, `color-contrast`×1 | yes |
| `tool-cost-segregation.html` | `color-contrast`×2 | yes |
| `tool-economics.html` | `color-contrast`×1 | yes |
| `tool-entity-formation.html` | `color-contrast`×2 | yes |
| `tool-firpta-withholding.html` | `color-contrast`×2 | yes |
| `tool-irs-notice-guide.html` | `color-contrast`×1 | yes |
| `tool-oic-rcp-estimator.html` | `color-contrast`×4 | yes |
| `tool-rental-real-estate-tax-strategy-analyzer.html` | `color-contrast`×10 | yes |
| `tool-str-strategy-analyzer.html` | `color-contrast`×9 | yes |
| `tools.html` | `color-contrast`×33 | yes |
| `wendy.html` | `color-contrast`×1 | yes |

