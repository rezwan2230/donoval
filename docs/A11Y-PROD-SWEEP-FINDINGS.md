# SARAH — A11Y PRODUCTION Sweep Findings (ORDER SARAH-195-PROD-SWEEP-R1)

**Agent:** Sarah (QA) · **Issue:** #195 · **Scan date:** 2026-08-08
**Target:** the LIVE production site — every URL in https://www.donovan.law/sitemap.xml
**Tooling:** axe-core via Playwright/Chromium headless, WCAG 2 AA tag set `wcag2a, wcag2aa, wcag21a, wcag21aa`
**Method:** serial (concurrency 1), full-page reveal scroll, then axe run **twice** per page 1200ms apart — only nodes reproducing in **both** passes are reported
**Harness:** the committed `scripts/a11y/a11y-sweep.mjs`, run unmodified against production

> **Measurement only.** No site source was modified by this order — the diff on this
> branch is this document alone. Nothing under `donovan-legal-site/` was touched.
>
> Production was scanned because local `wrangler`/`miniflare` crashed mid-sweep; the live
> site is the stable target and is also the surface users actually get.

## 0. Headline — the #213 contrast fix, measured live

| | Pre-fix (2026-08-07, 84 pages) | Live now (post-#213) | Change |
| --- | --- | --- | --- |
| `color-contrast` failing nodes | **1537** | **1033** across all 98 live pages | **−504 (32.8%)** |
| — on the same 84 pages, like-for-like | **1537** | **806** | **−731 (47.6%)** |
| — on the 14 pages added since the baseline | n/a (did not exist) | 227 | new scope |
| Pages with ≥1 contrast failure | 84 / 84 | 71 / 98 | — |

**The live `color-contrast` total is 1033, against the pre-fix 1537.**

> **Read the like-for-like row, not the headline row.** The live sitemap has grown from
> 84 to 98 URLs since the baseline (§1), so the all-pages column is not a
> like-for-like comparison. On the 84 pages that existed both times — the only honest
> measure of what #213 changed — contrast went **1537 → 806**.

Deployment of #213 was confirmed before scanning, not assumed: the live
`/css/main.css?v=20260721a` byte-matches the post-#213 file on `main`
(60 occurrences of `#107a4d`, 22 of `#0a5a37`).

## 1. Sitemap reconciliation (Task 1)

| Check | Result |
| --- | --- |
| Live sitemap URL count | **98** |
| Distinct URLs | **98** — no duplicates |
| Host | all 98 on `https://www.donovan.law` |
| Sitemap form | flat `<urlset>` (no nested `<sitemapindex>`, so no URLs hidden behind a child sitemap) |
| Count at pre-fix baseline | 84 |
| **Delta vs baseline** | **+14** (0 removed) |
| Pages measured | **98 / 98** |
| Pages UNMEASURED | **0** |

The harness ships with `--expect 84`, the pre-fix count. That default is now stale, so the
run was invoked with `--expect 98` and the delta is reported here rather than being
silently absorbed. The 14 added URLs are a clean superset — every baseline URL is still live:

- `/audit-reconsideration`
- `/florida-sales-tax-audit`
- `/irs-appeals`
- `/irs-audit-defense`
- `/irs-liens-levies`
- `/irs-notice`
- `/massachusetts-tax-appeal`
- `/partnership-audits`
- `/residency-audit`
- `/tax-court`
- `/tax-debt-resolution`
- `/tax-penalties`
- `/unfiled-returns`
- `/voluntary-disclosure`

## 2. Rollup — ranked by impact (Task 3)

CONFIRMED machine findings from the live site. Impact is axe-core's own severity.

| # | Rule ID | Impact | WCAG | Pages affected | Failing nodes | Pre-fix nodes (84pp) | What it means |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `aria-valid-attr-value` | **critical** | wcag2a, wcag412 | 8 / 98 | 24 | 24 | ARIA attributes must conform to valid values |
| 2 | `button-name` | **critical** | wcag2a, wcag412 | 8 / 98 | 24 | 24 | Buttons must have discernible text |
| 3 | `aria-required-children` | **critical** | wcag2a, wcag131 | 1 / 98 | 1 | 1 | Certain ARIA roles must contain particular children |
| 4 | `select-name` | **critical** | wcag2a, wcag412 | 1 / 98 | 1 | 1 | Select element must have an accessible name |
| 5 | `color-contrast` | **serious** | wcag2aa, wcag143 | 71 / 98 | 1033 | 1537 | Elements must meet minimum color contrast ratio thresholds |
| 6 | `svg-img-alt` | **serious** | wcag2a, wcag111 | 26 / 98 | 28 | 28 | <svg> elements with an img or image role must have alternative text |
| 7 | `html-has-lang` | **serious** | wcag2a, wcag311 | 9 / 98 | 9 | 9 | <html> element must have a lang attribute |
| 8 | `link-in-text-block` | **serious** | wcag2a, wcag141 | 8 / 98 | 8 | 0 | Links must be distinguishable without relying on color |
| 9 | `nested-interactive` | **serious** | wcag2a, wcag412 | 2 / 98 | 2 | 0 | Interactive controls must not be nested |

**Total failing nodes across the live site: 1130.**

### Every rule, live vs pre-fix

| Rule ID | Impact | Live nodes (98pp) | Live nodes (84pp common) | Pre-fix nodes (84pp) | Change on common pages |
| --- | --- | --- | --- | --- | --- |
| `aria-valid-attr-value` | critical | 24 | 24 | 24 | **±0** |
| `button-name` | critical | 24 | 24 | 24 | **±0** |
| `aria-required-children` | critical | 1 | 1 | 1 | **±0** |
| `select-name` | critical | 1 | 1 | 1 | **±0** |
| `color-contrast` | serious | 1033 | 806 | 1537 | **−731** |
| `svg-img-alt` | serious | 28 | 28 | 28 | **±0** |
| `html-has-lang` | serious | 9 | 9 | 9 | **±0** |
| `link-in-text-block` | serious | 8 | 8 | 0 | **+8** |
| `nested-interactive` | serious | 2 | 0 | 0 | **±0** |

## 3. Per-page defect table (Task 3)

Every measured page, with every axe rule that fired on it and the failing-node count.
`Δ contrast` compares this page's `color-contrast` nodes to the same page pre-fix
(`new` = the page did not exist at baseline). `alt` is **present / total** `<img>`,
where "present" means an `alt` attribute exists at all (an intentional `alt=""` is a
valid decorative declaration). `amb` = decorative-vs-informative ambiguities flagged
for human adjudication, **not** counted as defects.

| Page | Template | Status | axe rules (impact × nodes) | Δ contrast | alt | amb |
| --- | --- | --- | --- | --- | --- | --- |
| [/](https://www.donovan.law/) | T1 Home | MEASURED | `color-contrast` (serious×9) | **−12** (21→9) | 4/4 | 1 |
| [/audit-reconsideration](https://www.donovan.law/audit-reconsideration) | T11 Tax controversy | MEASURED | `color-contrast` (serious×14) | new (14) | 4/4 | 1 |
| [/blog](https://www.donovan.law/blog) | T2 Blog index | MEASURED | `aria-required-children` (critical×1)<br>`color-contrast` (serious×86) | **−5** (91→86) | 3/3 | 1 |
| [/blog-461l-excess-business-loss-and-172-nol](https://www.donovan.law/blog-461l-excess-business-loss-and-172-nol) | T3 Blog article | MEASURED | `color-contrast` (serious×12) | **−5** (17→12) | 3/3 | 1 |
| [/blog-augusta-rule-280a-g](https://www.donovan.law/blog-augusta-rule-280a-g) | T3 Blog article | MEASURED | `color-contrast` (serious×10)<br>`svg-img-alt` (serious×1) | **−6** (16→10) | 3/3 | 1 |
| [/blog-bramblett-phelan-two-entity-structure](https://www.donovan.law/blog-bramblett-phelan-two-entity-structure) | T3 Blog article | MEASURED | `color-contrast` (serious×1) | **−3** (4→1) | 2/2 | 1 |
| [/blog-character-amount-timing](https://www.donovan.law/blog-character-amount-timing) | T3 Blog article | MEASURED | `color-contrast` (serious×10)<br>`svg-img-alt` (serious×1) | **−6** (16→10) | 3/3 | 1 |
| [/blog-civil-fraud-eggshell-audit](https://www.donovan.law/blog-civil-fraud-eggshell-audit) | T3 Blog article | MEASURED | `color-contrast` (serious×15)<br>`svg-img-alt` (serious×1) | **−6** (21→15) | 3/3 | 1 |
| [/blog-conservation-easement-settlement](https://www.donovan.law/blog-conservation-easement-settlement) | T3 Blog article | MEASURED | `color-contrast` (serious×14)<br>`svg-img-alt` (serious×1) | **−5** (19→14) | 3/3 | 1 |
| [/blog-controversy-roadmap-0-overview](https://www.donovan.law/blog-controversy-roadmap-0-overview) | T3 Blog article | MEASURED | `color-contrast` (serious×3)<br>`link-in-text-block` (serious×1) | **−2** (5→3) | 2/2 | 1 |
| [/blog-controversy-roadmap-1-processing-assessment](https://www.donovan.law/blog-controversy-roadmap-1-processing-assessment) | T3 Blog article | MEASURED | `color-contrast` (serious×9)<br>`link-in-text-block` (serious×1) | **−2** (11→9) | 2/2 | 1 |
| [/blog-controversy-roadmap-2-exam](https://www.donovan.law/blog-controversy-roadmap-2-exam) | T3 Blog article | MEASURED | `color-contrast` (serious×7)<br>`link-in-text-block` (serious×1) | **−2** (9→7) | 2/2 | 1 |
| [/blog-controversy-roadmap-3-exam-alternatives](https://www.donovan.law/blog-controversy-roadmap-3-exam-alternatives) | T3 Blog article | MEASURED | `color-contrast` (serious×11)<br>`link-in-text-block` (serious×1) | **−2** (13→11) | 2/2 | 1 |
| [/blog-controversy-roadmap-4-appeals](https://www.donovan.law/blog-controversy-roadmap-4-appeals) | T3 Blog article | MEASURED | `color-contrast` (serious×13)<br>`link-in-text-block` (serious×1) | **−2** (15→13) | 2/2 | 1 |
| [/blog-controversy-roadmap-5-collection](https://www.donovan.law/blog-controversy-roadmap-5-collection) | T3 Blog article | MEASURED | `color-contrast` (serious×4)<br>`link-in-text-block` (serious×1) | **−2** (6→4) | 2/2 | 1 |
| [/blog-controversy-roadmap-6-collection-alternatives](https://www.donovan.law/blog-controversy-roadmap-6-collection-alternatives) | T3 Blog article | MEASURED | `color-contrast` (serious×6)<br>`link-in-text-block` (serious×1) | **−2** (8→6) | 2/2 | 1 |
| [/blog-controversy-roadmap-7-litigation](https://www.donovan.law/blog-controversy-roadmap-7-litigation) | T3 Blog article | MEASURED | `color-contrast` (serious×3)<br>`link-in-text-block` (serious×1) | **−2** (5→3) | 2/2 | 1 |
| [/blog-criminal-tax-overview](https://www.donovan.law/blog-criminal-tax-overview) | T3 Blog article | MEASURED | `color-contrast` (serious×21)<br>`svg-img-alt` (serious×1) | **−7** (28→21) | 3/3 | 1 |
| [/blog-currently-not-collectible-csed](https://www.donovan.law/blog-currently-not-collectible-csed) | T3 Blog article | MEASURED | `color-contrast` (serious×15)<br>`svg-img-alt` (serious×1) | **−5** (20→15) | 3/3 | 1 |
| [/blog-fbar-foreign-account-penalties](https://www.donovan.law/blog-fbar-foreign-account-penalties) | T3 Blog article | MEASURED | `color-contrast` (serious×19)<br>`svg-img-alt` (serious×1) | **−5** (24→19) | 3/3 | 1 |
| [/blog-firpta-foreign-sellers](https://www.donovan.law/blog-firpta-foreign-sellers) | T3 Blog article | MEASURED | `color-contrast` (serious×11) | **−5** (16→11) | 3/3 | 1 |
| [/blog-foreclose-federal-tax-lien-suit](https://www.donovan.law/blog-foreclose-federal-tax-lien-suit) | T3 Blog article | MEASURED | `color-contrast` (serious×17)<br>`svg-img-alt` (serious×1) | **−5** (22→17) | 3/3 | 1 |
| [/blog-irs-audit-notice-what-to-do](https://www.donovan.law/blog-irs-audit-notice-what-to-do) | T3 Blog article | MEASURED | `color-contrast` (serious×10) | **−5** (15→10) | 3/3 | 1 |
| [/blog-irs-co-owned-marital-real-estate](https://www.donovan.law/blog-irs-co-owned-marital-real-estate) | T3 Blog article | MEASURED | `color-contrast` (serious×17)<br>`svg-img-alt` (serious×1) | **−8** (25→17) | 3/3 | 1 |
| [/blog-irs-levy](https://www.donovan.law/blog-irs-levy) | T3 Blog article | MEASURED | `color-contrast` (serious×19)<br>`svg-img-alt` (serious×2) | **−5** (24→19) | 3/3 | 1 |
| [/blog-irs-summons](https://www.donovan.law/blog-irs-summons) | T3 Blog article | MEASURED | `color-contrast` (serious×16)<br>`svg-img-alt` (serious×1) | **−5** (21→16) | 3/3 | 1 |
| [/blog-jeopardy-termination-assessments](https://www.donovan.law/blog-jeopardy-termination-assessments) | T3 Blog article | MEASURED | `color-contrast` (serious×14)<br>`svg-img-alt` (serious×1) | **−5** (19→14) | 3/3 | 1 |
| [/blog-kwong-covid-deadlines](https://www.donovan.law/blog-kwong-covid-deadlines) | T3 Blog article | MEASURED | `color-contrast` (serious×15)<br>`svg-img-alt` (serious×1) | **−5** (20→15) | 3/3 | 1 |
| [/blog-material-participation-seven-tests](https://www.donovan.law/blog-material-participation-seven-tests) | T3 Blog article | MEASURED | `color-contrast` (serious×9)<br>`svg-img-alt` (serious×1) | **−6** (15→9) | 3/3 | 1 |
| [/blog-notice-of-federal-tax-lien](https://www.donovan.law/blog-notice-of-federal-tax-lien) | T3 Blog article | MEASURED | `color-contrast` (serious×22)<br>`svg-img-alt` (serious×1) | **−5** (27→22) | 3/3 | 1 |
| [/blog-partnership-agreement-tax-document](https://www.donovan.law/blog-partnership-agreement-tax-document) | T3 Blog article | MEASURED | `color-contrast` (serious×11) | **−5** (16→11) | 3/3 | 1 |
| [/blog-passport-revocation-tax-debt](https://www.donovan.law/blog-passport-revocation-tax-debt) | T3 Blog article | MEASURED | `color-contrast` (serious×15)<br>`svg-img-alt` (serious×1) | **−5** (20→15) | 3/3 | 1 |
| [/blog-penalty-regime-6751b](https://www.donovan.law/blog-penalty-regime-6751b) | T3 Blog article | MEASURED | `color-contrast` (serious×15)<br>`svg-img-alt` (serious×1) | **−5** (20→15) | 3/3 | 1 |
| [/blog-per-se-passive-rule-exceptions](https://www.donovan.law/blog-per-se-passive-rule-exceptions) | T3 Blog article | MEASURED | `color-contrast` (serious×8)<br>`svg-img-alt` (serious×1) | **−6** (14→8) | 3/3 | 1 |
| [/blog-real-estate-professional-status-reps](https://www.donovan.law/blog-real-estate-professional-status-reps) | T3 Blog article | MEASURED | `color-contrast` (serious×9)<br>`svg-img-alt` (serious×1) | **−6** (15→9) | 3/3 | 1 |
| [/blog-short-term-rental-material-participation](https://www.donovan.law/blog-short-term-rental-material-participation) | T3 Blog article | MEASURED | `color-contrast` (serious×13) | **−5** (18→13) | 3/3 | 1 |
| [/blog-short-term-rental-play](https://www.donovan.law/blog-short-term-rental-play) | T3 Blog article | MEASURED | `color-contrast` (serious×10)<br>`svg-img-alt` (serious×1) | **−7** (17→10) | 3/3 | 1 |
| [/blog-subdivision-basis-allocation](https://www.donovan.law/blog-subdivision-basis-allocation) | T3 Blog article | MEASURED | `color-contrast` (serious×9)<br>`svg-img-alt` (serious×1) | **−6** (15→9) | 3/3 | 1 |
| [/blog-substitute-for-return](https://www.donovan.law/blog-substitute-for-return) | T3 Blog article | MEASURED | `color-contrast` (serious×15)<br>`svg-img-alt` (serious×1) | **−5** (20→15) | 3/3 | 1 |
| [/blog-tax-opinions](https://www.donovan.law/blog-tax-opinions) | T3 Blog article | MEASURED | `color-contrast` (serious×19)<br>`svg-img-alt` (serious×1) | **−5** (24→19) | 3/3 | 1 |
| [/blog-tenancy-by-entirety-federal-tax-lien](https://www.donovan.law/blog-tenancy-by-entirety-federal-tax-lien) | T3 Blog article | MEASURED | `color-contrast` (serious×19)<br>`svg-img-alt` (serious×1) | **−6** (25→19) | 3/3 | 1 |
| [/blog-transferee-nominee-alter-ego](https://www.donovan.law/blog-transferee-nominee-alter-ego) | T3 Blog article | MEASURED | `color-contrast` (serious×17)<br>`svg-img-alt` (serious×1) | **−5** (22→17) | 3/3 | 1 |
| [/blog-trust-fund-recovery-penalty](https://www.donovan.law/blog-trust-fund-recovery-penalty) | T3 Blog article | MEASURED | `color-contrast` (serious×18)<br>`svg-img-alt` (serious×2) | **−5** (23→18) | 3/3 | 1 |
| [/business-law](https://www.donovan.law/business-law) | T4 Legacy practice accordion | MEASURED | `html-has-lang` (serious×1) | **−5** (5→0) | 3/3 | 1 |
| [/contact](https://www.donovan.law/contact) | T10 Utility | MEASURED | `color-contrast` (serious×11) | **−7** (18→11) | 3/3 | 1 |
| [/contracts](https://www.donovan.law/contracts) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`html-has-lang` (serious×1) | **−8** (8→0) | 3/3 | 1 |
| [/development](https://www.donovan.law/development) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`html-has-lang` (serious×1) | **−8** (8→0) | 3/3 | 1 |
| [/disclaimer](https://www.donovan.law/disclaimer) | T10 Utility | MEASURED | **none** | **−15** (15→0) | 3/3 | 1 |
| [/eminent-domain](https://www.donovan.law/eminent-domain) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`html-has-lang` (serious×1) | **−8** (8→0) | 3/3 | 1 |
| [/engagement](https://www.donovan.law/engagement) | T10 Utility | MEASURED | **none** | **−24** (24→0) | 3/3 | 1 |
| [/entity-formation](https://www.donovan.law/entity-formation) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`html-has-lang` (serious×1) | **−8** (8→0) | 3/3 | 1 |
| [/experience](https://www.donovan.law/experience) | T10 Utility | MEASURED | **none** | **−11** (11→0) | 3/3 | 1 |
| [/florida-sales-tax-audit](https://www.donovan.law/florida-sales-tax-audit) | T11 Tax controversy | MEASURED | `color-contrast` (serious×17)<br>`nested-interactive` (serious×1) | new (17) | 4/4 | 1 |
| [/irs-appeals](https://www.donovan.law/irs-appeals) | T11 Tax controversy | MEASURED | `color-contrast` (serious×14) | new (14) | 4/4 | 1 |
| [/irs-audit-defense](https://www.donovan.law/irs-audit-defense) | T11 Tax controversy | MEASURED | `color-contrast` (serious×14) | new (14) | 4/4 | 1 |
| [/irs-liens-levies](https://www.donovan.law/irs-liens-levies) | T11 Tax controversy | MEASURED | `color-contrast` (serious×17) | new (17) | 5/5 | 1 |
| [/irs-notice](https://www.donovan.law/irs-notice) | T11 Tax controversy | MEASURED | `color-contrast` (serious×19) | new (19) | 4/4 | 1 |
| [/leasing](https://www.donovan.law/leasing) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`html-has-lang` (serious×1) | **−8** (8→0) | 3/3 | 1 |
| [/leidy](https://www.donovan.law/leidy) | T8 Attorney bio | MEASURED | **none** | **−12** (12→0) | 4/4 | 1 |
| [/litigation](https://www.donovan.law/litigation) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`html-has-lang` (serious×1) | **−8** (8→0) | 3/3 | 1 |
| [/massachusetts-tax-appeal](https://www.donovan.law/massachusetts-tax-appeal) | T11 Tax controversy | MEASURED | `color-contrast` (serious×17)<br>`nested-interactive` (serious×1) | new (17) | 4/4 | 1 |
| [/membership-diamond](https://www.donovan.law/membership-diamond) | T7 Membership | MEASURED | **none** | **−21** (21→0) | 3/3 | 1 |
| [/membership-gold](https://www.donovan.law/membership-gold) | T7 Membership | MEASURED | **none** | **−22** (22→0) | 3/3 | 1 |
| [/membership-platinum](https://www.donovan.law/membership-platinum) | T7 Membership | MEASURED | **none** | **−22** (22→0) | 3/3 | 1 |
| [/membership-reserve](https://www.donovan.law/membership-reserve) | T7 Membership | MEASURED | **none** | **−21** (21→0) | 3/3 | 1 |
| [/ourfirm](https://www.donovan.law/ourfirm) | T10 Utility | MEASURED | `color-contrast` (serious×4) | **−10** (14→4) | 3/3 | 1 |
| [/partnership-audits](https://www.donovan.law/partnership-audits) | T11 Tax controversy | MEASURED | `color-contrast` (serious×14) | new (14) | 4/4 | 1 |
| [/practice](https://www.donovan.law/practice) | T9 Practice/service | MEASURED | `color-contrast` (serious×20) | **−10** (30→20) | 3/3 | 1 |
| [/profile](https://www.donovan.law/profile) | T8 Attorney bio | MEASURED | **none** | **−17** (17→0) | 4/4 | 1 |
| [/property-acquisition](https://www.donovan.law/property-acquisition) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`html-has-lang` (serious×1) | **−8** (8→0) | 3/3 | 1 |
| [/re-acquisition](https://www.donovan.law/re-acquisition) | T9 Practice/service | MEASURED | **none** | **−19** (19→0) | 3/3 | 1 |
| [/re-disposition](https://www.donovan.law/re-disposition) | T9 Practice/service | MEASURED | **none** | **−20** (20→0) | 3/3 | 1 |
| [/re-financing](https://www.donovan.law/re-financing) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`html-has-lang` (serious×1) | **−8** (8→0) | 3/3 | 1 |
| [/re-ownership](https://www.donovan.law/re-ownership) | T9 Practice/service | MEASURED | **none** | **−22** (22→0) | 3/3 | 1 |
| [/real-estate](https://www.donovan.law/real-estate) | T9 Practice/service | MEASURED | `color-contrast` (serious×6) | **−8** (14→6) | 3/3 | 1 |
| [/residency-audit](https://www.donovan.law/residency-audit) | T11 Tax controversy | MEASURED | `color-contrast` (serious×14) | new (14) | 4/4 | 1 |
| [/special-counsel](https://www.donovan.law/special-counsel) | T9 Practice/service | MEASURED | **none** | **−12** (12→0) | 3/3 | 1 |
| [/tax](https://www.donovan.law/tax) | T9 Practice/service | MEASURED | `color-contrast` (serious×6) | **−8** (14→6) | 3/3 | 1 |
| [/tax-compliance](https://www.donovan.law/tax-compliance) | T9 Practice/service | MEASURED | **none** | **−14** (14→0) | 3/3 | 1 |
| [/tax-controversy](https://www.donovan.law/tax-controversy) | T9 Practice/service | MEASURED | `color-contrast` (serious×24) | **+13** (11→24) | 4/4 | 1 |
| [/tax-court](https://www.donovan.law/tax-court) | T11 Tax controversy | MEASURED | `color-contrast` (serious×28) | new (28) | 5/5 | 1 |
| [/tax-debt-resolution](https://www.donovan.law/tax-debt-resolution) | T11 Tax controversy | MEASURED | `color-contrast` (serious×14) | new (14) | 4/4 | 1 |
| [/tax-penalties](https://www.donovan.law/tax-penalties) | T11 Tax controversy | MEASURED | `color-contrast` (serious×17) | new (17) | 4/4 | 1 |
| [/tax-planning](https://www.donovan.law/tax-planning) | T9 Practice/service | MEASURED | **none** | **−16** (16→0) | 3/3 | 1 |
| [/tefera](https://www.donovan.law/tefera) | T8 Attorney bio | MEASURED | **none** | **−12** (12→0) | 4/4 | 1 |
| [/testimonials](https://www.donovan.law/testimonials) | T10 Utility | MEASURED | **none** | **−12** (12→0) | 3/3 | 1 |
| [/tool-1031-exchange](https://www.donovan.law/tool-1031-exchange) | T5 Tool calculator | MEASURED | `color-contrast` (serious×30) | **−5** (35→30) | 3/3 | 1 |
| [/tool-capital-gains](https://www.donovan.law/tool-capital-gains) | T5 Tool calculator | MEASURED | `select-name` (critical×1)<br>`color-contrast` (serious×6) | **−5** (11→6) | 3/3 | 1 |
| [/tool-cost-segregation](https://www.donovan.law/tool-cost-segregation) | T5 Tool calculator | MEASURED | `color-contrast` (serious×12) | **−5** (17→12) | 3/3 | 1 |
| [/tool-deal-builder-preview](https://www.donovan.law/tool-deal-builder-preview) | T5 Tool calculator | MEASURED | `color-contrast` (serious×6) | **−8** (14→6) | 3/3 | 1 |
| [/tool-firpta-withholding](https://www.donovan.law/tool-firpta-withholding) | T5 Tool calculator | MEASURED | `color-contrast` (serious×7) | **−5** (12→7) | 3/3 | 1 |
| [/tool-irs-notice-guide](https://www.donovan.law/tool-irs-notice-guide) | T5 Tool calculator | MEASURED | `color-contrast` (serious×17) | **−5** (22→17) | 3/3 | 1 |
| [/tool-oic-rcp-estimator](https://www.donovan.law/tool-oic-rcp-estimator) | T5 Tool calculator | MEASURED | `color-contrast` (serious×9) | **−5** (14→9) | 3/3 | 1 |
| [/tool-rental-real-estate-tax-strategy-analyzer](https://www.donovan.law/tool-rental-real-estate-tax-strategy-analyzer) | T5 Tool calculator | MEASURED | `color-contrast` (serious×4) | **−23** (27→4) | 3/3 | 1 |
| [/tools](https://www.donovan.law/tools) | T6 Tools index | MEASURED | `color-contrast` (serious×48) | **−61** (109→48) | 3/3 | 1 |
| [/unfiled-returns](https://www.donovan.law/unfiled-returns) | T11 Tax controversy | MEASURED | `color-contrast` (serious×14) | new (14) | 5/5 | 1 |
| [/voluntary-disclosure](https://www.donovan.law/voluntary-disclosure) | T11 Tax controversy | MEASURED | `color-contrast` (serious×14) | new (14) | 4/4 | 1 |
| [/wendy](https://www.donovan.law/wendy) | T8 Attorney bio | MEASURED | **none** | **−12** (12→0) | 4/4 | 1 |

**All 98 pages loaded and were measured — 0 UNMEASURED.**

## 4. Node-level violation detail

Every failing node, grouped by rule then page. This is the full evidence set —
rule id, impact, page and the node target selector for each one.

### `aria-valid-attr-value` — critical · 24 node(s) on 8 page(s)

ARIA attributes must conform to valid values (wcag2a, wcag412)

| Page | Node target | Failure |
| --- | --- | --- |
| `/contracts` | `button[data-target="#fl-inside3"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/contracts` | `button[data-target="#fl-inside2"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/contracts` | `button[data-target="#fl-inside4"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/development` | `button[data-target="#fl-inside3"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/development` | `button[data-target="#fl-inside2"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/development` | `button[data-target="#fl-inside4"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/eminent-domain` | `button[data-target="#fl-inside3"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/eminent-domain` | `button[data-target="#fl-inside2"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/eminent-domain` | `button[data-target="#fl-inside4"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/entity-formation` | `button[data-target="#fl-inside3"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/entity-formation` | `button[data-target="#fl-inside2"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/entity-formation` | `button[data-target="#fl-inside4"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/leasing` | `button[data-target="#fl-inside3"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/leasing` | `button[data-target="#fl-inside2"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/leasing` | `button[data-target="#fl-inside4"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/litigation` | `button[data-target="#fl-inside3"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/litigation` | `button[data-target="#fl-inside2"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/litigation` | `button[data-target="#fl-inside4"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/property-acquisition` | `button[data-target="#fl-inside3"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/property-acquisition` | `button[data-target="#fl-inside2"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/property-acquisition` | `button[data-target="#fl-inside4"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/re-financing` | `button[data-target="#fl-inside3"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/re-financing` | `button[data-target="#fl-inside2"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |
| `/re-financing` | `button[data-target="#fl-inside4"]` | Invalid ARIA attribute value: aria-controls="collapseOne" |

### `button-name` — critical · 24 node(s) on 8 page(s)

Buttons must have discernible text (wcag2a, wcag412)

| Page | Node target | Failure |
| --- | --- | --- |
| `/contracts` | `button[data-target="#fl-inside3"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/contracts` | `button[data-target="#fl-inside2"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/contracts` | `button[data-target="#fl-inside4"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/development` | `button[data-target="#fl-inside3"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/development` | `button[data-target="#fl-inside2"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/development` | `button[data-target="#fl-inside4"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/eminent-domain` | `button[data-target="#fl-inside3"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/eminent-domain` | `button[data-target="#fl-inside2"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/eminent-domain` | `button[data-target="#fl-inside4"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/entity-formation` | `button[data-target="#fl-inside3"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/entity-formation` | `button[data-target="#fl-inside2"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/entity-formation` | `button[data-target="#fl-inside4"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/leasing` | `button[data-target="#fl-inside3"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/leasing` | `button[data-target="#fl-inside2"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/leasing` | `button[data-target="#fl-inside4"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/litigation` | `button[data-target="#fl-inside3"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/litigation` | `button[data-target="#fl-inside2"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/litigation` | `button[data-target="#fl-inside4"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/property-acquisition` | `button[data-target="#fl-inside3"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/property-acquisition` | `button[data-target="#fl-inside2"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/property-acquisition` | `button[data-target="#fl-inside4"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/re-financing` | `button[data-target="#fl-inside3"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/re-financing` | `button[data-target="#fl-inside2"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |
| `/re-financing` | `button[data-target="#fl-inside4"]` | Element does not have inner text that is visible to screen readers aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element |

### `aria-required-children` — critical · 1 node(s) on 1 page(s)

Certain ARIA roles must contain particular children (wcag2a, wcag131)

| Page | Node target | Failure |
| --- | --- | --- |
| `/blog` | `.blog-filter` | Element has children which are not allowed: button |

### `select-name` — critical · 1 node(s) on 1 page(s)

Select element must have an accessible name (wcag2a, wcag412)

| Page | Node target | Failure |
| --- | --- | --- |
| `/tool-capital-gains` | `#niit` | Element does not have an implicit (wrapped) <label> Element does not have an explicit <label> aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elem |

### `color-contrast` — serious · 1033 node(s) on 71 page(s)

Elements must meet minimum color contrast ratio thresholds (wcag2aa, wcag143)

| Page | Node target | Failure |
| --- | --- | --- |
| `/` | `.container > a:nth-child(1) > span:nth-child(1)` | Element has insufficient color contrast of 3.68 (foreground color: #0a5a37, background color: #c9a961, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/` | `a:nth-child(1) > span:nth-child(3)` | Element has insufficient color contrast of 3.68 (foreground color: #c9a961, background color: #0a5a37, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/` | `.container > a:nth-child(3) > span:nth-child(1)` | Element has insufficient color contrast of 3.68 (foreground color: #0a5a37, background color: #c9a961, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/` | `a:nth-child(3) > span:nth-child(3)` | Element has insufficient color contrast of 3.68 (foreground color: #c9a961, background color: #0a5a37, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/` | `a[href$="tax.html"] > .practice-card-v2 > p:nth-child(3)` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 9.6pt (12.8px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/` | `a[href$="real-estate.html"] > .practice-card-v2 > p:nth-child(3)` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 9.6pt (12.8px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/` | `a[href$="special-counsel.html"] > .practice-card-v2 > p:nth-child(3)` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 9.6pt (12.8px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/` | `a[rel="noopener"][target="_blank"]` | Element has insufficient color contrast of 3.05 (foreground color: #169b62, background color: #eaefe8, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/` | `p > a[href$="testimonials.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-steps.dl-steps-3:nth-child(15) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-steps.dl-steps-3:nth-child(15) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-steps.dl-steps-3:nth-child(15) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-steps.dl-steps-3:nth-child(17) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-steps.dl-steps-3:nth-child(17) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/audit-reconsideration` | `.dl-steps.dl-steps-3:nth-child(17) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.pin-cta` | Element has insufficient color contrast of 3.36 (foreground color: #169b62, background color: #f4faf6, font size: 10.2pt (13.6px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.is-active` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 8.9pt (11.84px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-section-title` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.8pt (13.12px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(2) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(2) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(5) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(5) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(6) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(6) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(7) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(7) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(8) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(8) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(9) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(9) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(10) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(10) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(11) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(11) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(12) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="controversy"] > .blog-post-card:nth-child(12) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.series-divider` | Element has insufficient color contrast of 2.57 (foreground color: #9a9a9a, background color: #f5f5f0, font size: 8.6pt (11.52px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(14) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(14) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(15) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.post-readmore[href$="blog-irs-levy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(16) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(16) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(17) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(17) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(18) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.post-readmore[href$="blog-irs-summons.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(19) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(19) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(20) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(20) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(21) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(21) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(22) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(22) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(23) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(23) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(24) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(24) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(25) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(25) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(26) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(26) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(27) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(27) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(28) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.post-readmore[href="blog-penalty-regime-6751b.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(29) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(29) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(30) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(30) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-section-title` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.8pt (13.12px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(2) > .post-meta > .post-category:nth-child(1)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(2) > .post-meta > .post-category:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(2) > .post-readmore[href$="blog-tax-opinions.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(3) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(3) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(4) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.blog-post-card:nth-child(4) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(5) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(5) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(6) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(6) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(7) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(7) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(8) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `.post-readmore[href="blog-augusta-rule-280a-g.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(9) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(9) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(10) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(10) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(11) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(11) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(12) > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="planning"] > .blog-post-card:nth-child(12) > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="realestate"] > .blog-section-title` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.8pt (13.12px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="realestate"] > .blog-post-card > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="realestate"] > .blog-post-card > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="compliance"] > .blog-section-title` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.8pt (13.12px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="compliance"] > .blog-post-card > .post-meta > .post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog` | `section[data-topic="compliance"] > .blog-post-card > .post-readmore` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-461l-excess-business-loss-and-172-nol` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-461l-excess-business-loss-and-172-nol` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-461l-excess-business-loss-and-172-nol` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-461l-excess-business-loss-and-172-nol` | `h4:nth-child(5)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-461l-excess-business-loss-and-172-nol` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-461l-excess-business-loss-and-172-nol` | `h4:nth-child(15)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-461l-excess-business-loss-and-172-nol` | `h4:nth-child(19)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-461l-excess-business-loss-and-172-nol` | `h4:nth-child(22)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-461l-excess-business-loss-and-172-nol` | `h4:nth-child(25)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-461l-excess-business-loss-and-172-nol` | `p > a[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-461l-excess-business-loss-and-172-nol` | `p > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-461l-excess-business-loss-and-172-nol` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-augusta-rule-280a-g` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-augusta-rule-280a-g` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-augusta-rule-280a-g` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-augusta-rule-280a-g` | `h4:nth-child(5)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-augusta-rule-280a-g` | `.cat-c` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 8.2pt (10.88px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-augusta-rule-280a-g` | `.cat-t` | Element has insufficient color contrast of 3.7 (foreground color: #ffffff, background color: #5e8b9e, font size: 8.2pt (10.88px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-augusta-rule-280a-g` | `h4:nth-child(7)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-augusta-rule-280a-g` | `p > a[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-augusta-rule-280a-g` | `p > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-augusta-rule-280a-g` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-bramblett-phelan-two-entity-structure` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-character-amount-timing` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-character-amount-timing` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-character-amount-timing` | `.lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-character-amount-timing` | `h4:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-character-amount-timing` | `h4:nth-child(6)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-character-amount-timing` | `h4:nth-child(8)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-character-amount-timing` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-character-amount-timing` | `p > a[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-character-amount-timing` | `p > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-character-amount-timing` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `h4:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `.dlcallout:nth-child(7) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `h4:nth-child(8)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `h4:nth-child(11)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `.dlcallout:nth-child(13) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `h4:nth-child(14)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `h4:nth-child(16)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `a[href="blog-penalty-regime-6751b.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `.article-related > p > a[href$="blog-irs-summons.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-civil-fraud-eggshell-audit` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `h4:nth-child(5)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `h4:nth-child(8)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `h4:nth-child(12)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `h4:nth-child(15)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `h4:nth-child(17)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `.lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `h4:nth-child(20)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `p > a:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-conservation-easement-settlement` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-0-overview` | `.re` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-0-overview` | `.eyebrow` | Element has insufficient color contrast of 2.19 (foreground color: #c9a961, background color: #fcfcfb, font size: 9.4pt (12.5px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-0-overview` | `.kicker` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 9.0pt (12px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-1-processing-assessment` | `.re` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-1-processing-assessment` | `.eyebrow` | Element has insufficient color contrast of 2.19 (foreground color: #c9a961, background color: #fcfcfb, font size: 9.4pt (12.5px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-1-processing-assessment` | `.gold > p > code:nth-child(2)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-1-processing-assessment` | `p > code:nth-child(3)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-1-processing-assessment` | `.exam > p > code` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-1-processing-assessment` | `.closed > p > code` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-1-processing-assessment` | `.pt.t` | Element has insufficient color contrast of 3.79 (foreground color: #ffffff, background color: #3c8da3, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-1-processing-assessment` | `.s` | Element has insufficient color contrast of 3.9 (foreground color: #ffffff, background color: #c06a3e, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-1-processing-assessment` | `span:nth-child(2) > .t` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 13.5pt (18px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-2-exam` | `.re` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-2-exam` | `.eyebrow` | Element has insufficient color contrast of 2.19 (foreground color: #c9a961, background color: #fcfcfb, font size: 9.4pt (12.5px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-2-exam` | `.teal > p > code:nth-child(1)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-2-exam` | `.teal > p > code:nth-child(2)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-2-exam` | `.indigo > p > code:nth-child(1)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-2-exam` | `.indigo > p > code:nth-child(2)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-2-exam` | `.t` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 13.5pt (18px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-3-exam-alternatives` | `.re` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-3-exam-alternatives` | `.eyebrow` | Element has insufficient color contrast of 2.19 (foreground color: #c9a961, background color: #fcfcfb, font size: 9.4pt (12.5px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-3-exam-alternatives` | `.teal:nth-child(1) > p > code:nth-child(1)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-3-exam-alternatives` | `.teal:nth-child(1) > p > code:nth-child(3)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-3-exam-alternatives` | `.teal:nth-child(2) > p > code:nth-child(1)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-3-exam-alternatives` | `.teal:nth-child(2) > p > code:nth-child(2)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-3-exam-alternatives` | `.roads:nth-child(9) > .indigo > p > code:nth-child(1)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-3-exam-alternatives` | `.indigo > p > code:nth-child(2)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-3-exam-alternatives` | `.indigo > p > code:nth-child(3)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-3-exam-alternatives` | `.roads:nth-child(12) > .indigo > p > code` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-3-exam-alternatives` | `.t` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 13.5pt (18px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `.re` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `.eyebrow` | Element has insufficient color contrast of 2.19 (foreground color: #c9a961, background color: #fcfcfb, font size: 9.4pt (12.5px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `.t.pt` | Element has insufficient color contrast of 3.79 (foreground color: #ffffff, background color: #3c8da3, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `.teal > p > code` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `.sienna:nth-child(2) > h3 > .s.pt` | Element has insufficient color contrast of 3.9 (foreground color: #ffffff, background color: #c06a3e, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `.sienna:nth-child(2) > p > code:nth-child(1)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `.sienna:nth-child(2) > p > code:nth-child(2)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `.sienna:nth-child(3) > h3 > .s.pt` | Element has insufficient color contrast of 3.9 (foreground color: #ffffff, background color: #c06a3e, font size: 8.3pt (11px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `.sienna:nth-child(3) > p > code` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `.emer > p > code:nth-child(1)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `.emer > p > code:nth-child(2)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `.indigo:nth-child(3) > p > code` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-4-appeals` | `span:nth-child(2) > .t` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 13.5pt (18px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-5-collection` | `.re` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-5-collection` | `.eyebrow` | Element has insufficient color contrast of 2.19 (foreground color: #c9a961, background color: #fcfcfb, font size: 9.4pt (12.5px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-5-collection` | `.sienna:nth-child(1) > p > code` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-5-collection` | `.t` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 13.5pt (18px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-6-collection-alternatives` | `.re` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-6-collection-alternatives` | `.eyebrow` | Element has insufficient color contrast of 2.19 (foreground color: #c9a961, background color: #fcfcfb, font size: 9.4pt (12.5px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-6-collection-alternatives` | `.gold > p > code` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-6-collection-alternatives` | `.indigo > p > code:nth-child(1)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-6-collection-alternatives` | `p > code:nth-child(2)` | Element has insufficient color contrast of 4.22 (foreground color: #5e7686, background color: #eef2f4, font size: 11.0pt (14.72px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-6-collection-alternatives` | `.t` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 13.5pt (18px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-7-litigation` | `.re` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 9.8pt (13px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-7-litigation` | `.eyebrow` | Element has insufficient color contrast of 2.19 (foreground color: #c9a961, background color: #fcfcfb, font size: 9.4pt (12.5px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-controversy-roadmap-7-litigation` | `.t` | Element has insufficient color contrast of 3.57 (foreground color: #019a48, background color: #fcfcfb, font size: 13.5pt (18px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `h4:nth-child(5)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `h4:nth-child(7)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `.dlcallout:nth-child(9) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `h4:nth-child(12)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `h4:nth-child(12) > em` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `h4:nth-child(14)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `.dlcallout:nth-child(16) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `h4:nth-child(17)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `h4:nth-child(20)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `h4:nth-child(22)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `.dlcallout:nth-child(24) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `h4:nth-child(25)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `p > a:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `.article-related > p > a[href$="blog-irs-summons.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-criminal-tax-overview` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `h4:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `h4:nth-child(8)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `.dlcallout:nth-child(12) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `h4:nth-child(13)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `.dlcallout:nth-child(15) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `h4:nth-child(16)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `a[href$="blog-irs-levy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-currently-not-collectible-csed` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `h4:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `h4:nth-child(7)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `h4:nth-child(7) > em` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `.dlcallout:nth-child(9) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `h4:nth-child(13)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `h4:nth-child(13) > em:nth-child(1)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `h4:nth-child(13) > em:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `h4:nth-child(15)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `.dlcallout:nth-child(17) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `h4:nth-child(18)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `p > a[href$="tax-compliance.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `a[href$="blog-irs-summons.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-fbar-foreign-account-penalties` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-firpta-foreign-sellers` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-firpta-foreign-sellers` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-firpta-foreign-sellers` | `h4:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-firpta-foreign-sellers` | `h4:nth-child(6)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-firpta-foreign-sellers` | `h4:nth-child(9)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-firpta-foreign-sellers` | `h4:nth-child(13)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-firpta-foreign-sellers` | `h4:nth-child(15)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-firpta-foreign-sellers` | `h4:nth-child(22)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-firpta-foreign-sellers` | `p > a[href$="tax-compliance.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-firpta-foreign-sellers` | `p > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-firpta-foreign-sellers` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `h4:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `h4:nth-child(6)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `h4:nth-child(9)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `h4:nth-child(9) > em` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `.dlcallout:nth-child(11) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `h4:nth-child(12)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `.dlcallout:nth-child(14) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `h4:nth-child(15)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `h4:nth-child(17)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `p > a:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-foreclose-federal-tax-lien-suit` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-audit-notice-what-to-do` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-irs-audit-notice-what-to-do` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-audit-notice-what-to-do` | `h4:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-audit-notice-what-to-do` | `h4:nth-child(6)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-audit-notice-what-to-do` | `h4:nth-child(9)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-audit-notice-what-to-do` | `h4:nth-child(12)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-audit-notice-what-to-do` | `h4:nth-child(23)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-audit-notice-what-to-do` | `h4:nth-child(26)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-audit-notice-what-to-do` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-audit-notice-what-to-do` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `h4:nth-child(5)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `h4:nth-child(7)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `h4:nth-child(9)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `.dlcallout:nth-child(11) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `h4:nth-child(12)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `h4:nth-child(15)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `.dlcallout:nth-child(17) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `h4:nth-child(18)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `h4:nth-child(20)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `.article-related > p > a:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-co-owned-marital-real-estate` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `h4:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `.dlcallout:nth-child(8) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `h4:nth-child(9)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `h4:nth-child(13)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `h4:nth-child(16)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `h4:nth-child(18)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `.dlcallout:nth-child(21) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `h4:nth-child(22)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `h4:nth-child(24)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `h4:nth-child(26)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `h4:nth-child(28)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `p > a:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-levy` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `h4:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `h4:nth-child(7)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `.dlcallout:nth-child(9) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `h4:nth-child(12)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `h4:nth-child(16)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `.dlcallout:nth-child(18) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `h4:nth-child(19)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `p > a:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-irs-summons` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `h4:nth-child(5)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `.dlcallout:nth-child(7) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `h4:nth-child(8)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `h4:nth-child(11)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `.dlcallout:nth-child(13) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `h4:nth-child(14)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `a[href$="blog-irs-levy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-jeopardy-termination-assessments` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `h4:nth-child(5)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `h4:nth-child(9)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `h4:nth-child(12)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `.dlcallout:nth-child(15) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `h4:nth-child(16)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `.dlcallout:nth-child(18) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `h4:nth-child(19)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `h4:nth-child(22)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `a[href="blog-penalty-regime-6751b.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-kwong-covid-deadlines` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-material-participation-seven-tests` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-material-participation-seven-tests` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-material-participation-seven-tests` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-material-participation-seven-tests` | `h4:nth-child(6)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-material-participation-seven-tests` | `.lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-material-participation-seven-tests` | `h4:nth-child(9)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-material-participation-seven-tests` | `p > a[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-material-participation-seven-tests` | `p > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-material-participation-seven-tests` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `.dlcallout:nth-child(6) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(7)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(13)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(19)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(21)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(24)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(26)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(30)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(32)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `.dlcallout:nth-child(34) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(35)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(37)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(39)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `h4:nth-child(42)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `p > a:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-notice-of-federal-tax-lien` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-partnership-agreement-tax-document` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-partnership-agreement-tax-document` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-partnership-agreement-tax-document` | `h4:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-partnership-agreement-tax-document` | `h4:nth-child(7)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-partnership-agreement-tax-document` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-partnership-agreement-tax-document` | `h4:nth-child(13)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-partnership-agreement-tax-document` | `h4:nth-child(16)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-partnership-agreement-tax-document` | `h4:nth-child(18)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-partnership-agreement-tax-document` | `p > a[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-partnership-agreement-tax-document` | `p > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-partnership-agreement-tax-document` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `.dlcallout:nth-child(5) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `h4:nth-child(6)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `h4:nth-child(8)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `h4:nth-child(11)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `h4:nth-child(13)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `.dlcallout:nth-child(15) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `h4:nth-child(16)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `a[href$="blog-irs-levy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-passport-revocation-tax-debt` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `h4:nth-child(5)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `h4:nth-child(7)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `.dlcallout:nth-child(12) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `h4:nth-child(13)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `.dlcallout:nth-child(15) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `h4:nth-child(16)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `p > a:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-penalty-regime-6751b` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-per-se-passive-rule-exceptions` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-per-se-passive-rule-exceptions` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-per-se-passive-rule-exceptions` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-per-se-passive-rule-exceptions` | `h4:nth-child(6)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-per-se-passive-rule-exceptions` | `h4:nth-child(8)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-per-se-passive-rule-exceptions` | `p > a[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-per-se-passive-rule-exceptions` | `p > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-per-se-passive-rule-exceptions` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-real-estate-professional-status-reps` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-real-estate-professional-status-reps` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-real-estate-professional-status-reps` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-real-estate-professional-status-reps` | `h4:nth-child(5)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-real-estate-professional-status-reps` | `h4:nth-child(7)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-real-estate-professional-status-reps` | `h4:nth-child(9)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-real-estate-professional-status-reps` | `p > a[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-real-estate-professional-status-reps` | `p > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-real-estate-professional-status-reps` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `h4:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `h4:nth-child(6)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `h4:nth-child(13)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `h4:nth-child(19)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `h4:nth-child(22)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `h4:nth-child(26)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `h4:nth-child(31)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `p > a[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `p > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-material-participation` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-play` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-play` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-play` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-play` | `h4:nth-child(5)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-play` | `.lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-play` | `h4:nth-child(8)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-play` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-play` | `p > a[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-play` | `p > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-short-term-rental-play` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-subdivision-basis-allocation` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-subdivision-basis-allocation` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-subdivision-basis-allocation` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-subdivision-basis-allocation` | `h4:nth-child(5)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-subdivision-basis-allocation` | `h4:nth-child(7)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-subdivision-basis-allocation` | `.lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-subdivision-basis-allocation` | `p > a[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-subdivision-basis-allocation` | `p > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-subdivision-basis-allocation` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `h4:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `.dlcallout:nth-child(6) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `h4:nth-child(8)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `h4:nth-child(12)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `.dlcallout:nth-child(14) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `h4:nth-child(15)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `p > a[href$="tax-compliance.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-substitute-for-return` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `.post-category:nth-child(1)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `.post-category:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `h4:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `h4:nth-child(9)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `h4:nth-child(11)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `.dlcallout:nth-child(16) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `h4:nth-child(17)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `.dlcallout:nth-child(19) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `h4:nth-child(20)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `.dlcallout:nth-child(24) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `h4:nth-child(25)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `h4:nth-child(31)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `h4:nth-child(33)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `p > a[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `a[href="blog-penalty-regime-6751b.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tax-opinions` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `h4:nth-child(2) > em` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `h4:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `h4:nth-child(7)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `.dlcallout:nth-child(9) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `h4:nth-child(10)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `h4:nth-child(12)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `h4:nth-child(14)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `h4:nth-child(17)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `h4:nth-child(17) > em` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `.dlcallout:nth-child(19) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `h4:nth-child(20)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `.article-related > p > a:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `h4:nth-child(5)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `h4:nth-child(7)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `h4:nth-child(9)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `.dlcallout:nth-child(11) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `h4:nth-child(12)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `.dlcallout:nth-child(14) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `h4:nth-child(15)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `h4:nth-child(18)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `h4:nth-child(20)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `p > a:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `p > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-transferee-nominee-alter-ego` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `.post-category` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `.article-byline > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `h4:nth-child(2)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `h4:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `h4:nth-child(8)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `h4:nth-child(11)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `.dlcallout:nth-child(13) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `h4:nth-child(14)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `.dlcallout:nth-child(16) > .lbl` | Element has insufficient color contrast of 4.45 (foreground color: #8a6f1f, background color: #f5f7f4, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `h4:nth-child(17)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `h4:nth-child(19)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `h4:nth-child(22)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `h4:nth-child(24)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 15.6pt (20.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `p > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `a[href$="blog-irs-levy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `.article-related > p > a:nth-child(3)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `p > a:nth-child(4)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/blog-trust-fund-recovery-penalty` | `.article-back > a[href$="blog.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/contact` | `.contact-info-row:nth-child(1) > .contact-info-label` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/contact` | `.contact-info-row:nth-child(2) > .contact-info-label` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/contact` | `.contact-info-row:nth-child(3) > .contact-info-label` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/contact` | `.contact-info-row:nth-child(4) > .contact-info-label` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/contact` | `.contact-info-row:nth-child(5) > .contact-info-label` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/contact` | `.contact-info-row:nth-child(6) > .contact-info-label` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/contact` | `.contact-info-row:nth-child(7) > .contact-info-label` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/contact` | `.submit-btn` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/contact` | `a[data-perch-book="contact_page"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/contact` | `p:nth-child(8) > a[href$="mailto:info@donovan.law"][target="_top"][rel="noopener"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/contact` | `p:nth-child(8) > a[href="tel:+15615295873"][target="_top"][rel="noopener"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 11.4pt (15.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-stat:nth-child(1) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-stat:nth-child(2) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-stat:nth-child(3) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-steps.dl-steps-3:nth-child(25) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-steps.dl-steps-3:nth-child(25) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-steps.dl-steps-3:nth-child(25) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-steps.dl-steps-3:nth-child(27) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-steps.dl-steps-3:nth-child(27) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/florida-sales-tax-audit` | `.dl-steps.dl-steps-3:nth-child(27) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-appeals` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-steps.dl-steps-3:nth-child(15) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-steps.dl-steps-3:nth-child(15) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-steps.dl-steps-3:nth-child(15) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-steps.dl-steps-3:nth-child(17) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-steps.dl-steps-3:nth-child(17) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-audit-defense` | `.dl-steps.dl-steps-3:nth-child(17) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-stat:nth-child(1) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-stat:nth-child(2) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-stat:nth-child(3) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-steps.dl-steps-3:nth-child(20) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-steps.dl-steps-3:nth-child(20) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-steps.dl-steps-3:nth-child(20) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-steps.dl-steps-3:nth-child(22) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-steps.dl-steps-3:nth-child(22) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-liens-levies` | `.dl-steps.dl-steps-3:nth-child(22) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-stat:nth-child(1) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-stat:nth-child(2) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-stat:nth-child(3) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-two-item:nth-child(1) > .dl-two-l` | Element has insufficient color contrast of 2.06 (foreground color: #c9a961, background color: #f6f5f1, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-two-item:nth-child(2) > .dl-two-l` | Element has insufficient color contrast of 2.06 (foreground color: #c9a961, background color: #f6f5f1, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-steps.dl-steps-3:nth-child(14) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-steps.dl-steps-3:nth-child(14) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-steps.dl-steps-3:nth-child(14) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/irs-notice` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-stat:nth-child(1) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-stat:nth-child(2) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-stat:nth-child(3) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-steps.dl-steps-3:nth-child(24) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-steps.dl-steps-3:nth-child(24) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-steps.dl-steps-3:nth-child(24) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-steps.dl-steps-3:nth-child(26) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-steps.dl-steps-3:nth-child(26) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/massachusetts-tax-appeal` | `.dl-steps.dl-steps-3:nth-child(26) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/ourfirm` | `p > a[href$="profile.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/ourfirm` | `p > a[href$="experience.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/ourfirm` | `p > a[href$="testimonials.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/ourfirm` | `p > a[href$="contact.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/partnership-audits` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-row:nth-child(3) > .lifecycle-card:nth-child(1) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lc-link[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-row:nth-child(3) > .lifecycle-card:nth-child(2) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lc-link[href$="tax-compliance.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-row:nth-child(3) > .lifecycle-card:nth-child(3) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lc-link[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-row:nth-child(5) > .lifecycle-card:nth-child(1) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lc-link[href$="re-acquisition.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-row:nth-child(5) > .lifecycle-card:nth-child(2) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lc-link[href$="re-ownership.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-row:nth-child(5) > .lifecycle-card:nth-child(3) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lc-link[href$="re-disposition.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-row:nth-child(7) > .lifecycle-card:nth-child(1) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lc-link[href="special-counsel.html#divorce"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-row:nth-child(7) > .lifecycle-card:nth-child(2) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-row:nth-child(7) > .lifecycle-card:nth-child(2) > .lc-link` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-row:nth-child(7) > .lifecycle-card:nth-child(3) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-row:nth-child(7) > .lifecycle-card:nth-child(3) > .lc-link` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-card:nth-child(4) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/practice` | `.lifecycle-card:nth-child(4) > .lc-link` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/real-estate` | `.lifecycle-card:nth-child(1) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/real-estate` | `.lc-link[href$="re-acquisition.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/real-estate` | `.lifecycle-card:nth-child(2) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/real-estate` | `.lc-link[href$="re-ownership.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/real-estate` | `.lifecycle-card:nth-child(3) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/real-estate` | `.lc-link[href$="re-disposition.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-steps.dl-steps-3:nth-child(21) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-steps.dl-steps-3:nth-child(21) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-steps.dl-steps-3:nth-child(21) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-steps.dl-steps-3:nth-child(23) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-steps.dl-steps-3:nth-child(23) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/residency-audit` | `.dl-steps.dl-steps-3:nth-child(23) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax` | `.lifecycle-card:nth-child(1) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax` | `.lc-link[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax` | `.lifecycle-card:nth-child(2) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax` | `.lc-link[href$="tax-compliance.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax` | `.lifecycle-card:nth-child(3) > .lc-kicker` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax` | `.lc-link[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `a[href$="irs-notice.html"] > .dl-nav-n` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 14.9pt (19.84px), font weight: bold). Expected contrast ratio of 3:1 |
| `/tax-controversy` | `a[href$="irs-audit-defense.html"] > .dl-nav-n` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 14.9pt (19.84px), font weight: bold). Expected contrast ratio of 3:1 |
| `/tax-controversy` | `a[href="audit-reconsideration.html"] > .dl-nav-n` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 14.9pt (19.84px), font weight: bold). Expected contrast ratio of 3:1 |
| `/tax-controversy` | `a[href$="irs-appeals.html"] > .dl-nav-n` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 14.9pt (19.84px), font weight: bold). Expected contrast ratio of 3:1 |
| `/tax-controversy` | `a[href$="tax-court.html"] > .dl-nav-n` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 14.9pt (19.84px), font weight: bold). Expected contrast ratio of 3:1 |
| `/tax-controversy` | `a[href$="irs-liens-levies.html"] > .dl-nav-n` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 14.9pt (19.84px), font weight: bold). Expected contrast ratio of 3:1 |
| `/tax-controversy` | `a[href$="tax-debt-resolution.html"] > .dl-nav-n` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 14.9pt (19.84px), font weight: bold). Expected contrast ratio of 3:1 |
| `/tax-controversy` | `a[href="florida-sales-tax-audit.html"] > .dl-nav-n` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 14.9pt (19.84px), font weight: bold). Expected contrast ratio of 3:1 |
| `/tax-controversy` | `a[href="massachusetts-tax-appeal.html"] > .dl-nav-n` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 14.9pt (19.84px), font weight: bold). Expected contrast ratio of 3:1 |
| `/tax-controversy` | `.dl-two-item:nth-child(1) > .dl-two-l` | Element has insufficient color contrast of 2.06 (foreground color: #c9a961, background color: #f6f5f1, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-two-item:nth-child(2) > .dl-two-l` | Element has insufficient color contrast of 2.06 (foreground color: #c9a961, background color: #f6f5f1, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-steps.dl-steps-3:nth-child(27) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-steps.dl-steps-3:nth-child(27) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-steps.dl-steps-3:nth-child(27) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-steps.dl-steps-3:nth-child(29) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-steps.dl-steps-3:nth-child(29) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-controversy` | `.dl-steps.dl-steps-3:nth-child(29) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-stat:nth-child(1) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-stat:nth-child(2) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-stat:nth-child(3) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-card:nth-child(1) > .dl-card-l` | Element has insufficient color contrast of 2.06 (foreground color: #c9a961, background color: #f6f5f1, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-card:nth-child(2) > .dl-card-l` | Element has insufficient color contrast of 2.06 (foreground color: #c9a961, background color: #f6f5f1, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-card:nth-child(3) > .dl-card-l` | Element has insufficient color contrast of 2.06 (foreground color: #c9a961, background color: #f6f5f1, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-card:nth-child(4) > .dl-card-l` | Element has insufficient color contrast of 2.06 (foreground color: #c9a961, background color: #f6f5f1, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-card:nth-child(5) > .dl-card-l` | Element has insufficient color contrast of 2.06 (foreground color: #c9a961, background color: #f6f5f1, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-card:nth-child(6) > .dl-card-l` | Element has insufficient color contrast of 2.06 (foreground color: #c9a961, background color: #f6f5f1, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-two-item:nth-child(1) > .dl-two-l` | Element has insufficient color contrast of 2.06 (foreground color: #c9a961, background color: #f6f5f1, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-two-item:nth-child(2) > .dl-two-l` | Element has insufficient color contrast of 2.06 (foreground color: #c9a961, background color: #f6f5f1, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-steps.dl-steps-3:nth-child(28) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-steps.dl-steps-3:nth-child(28) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-steps.dl-steps-3:nth-child(28) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-steps.dl-steps-3:nth-child(30) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-steps.dl-steps-3:nth-child(30) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-court` | `.dl-steps.dl-steps-3:nth-child(30) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-debt-resolution` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-stat:nth-child(1) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-stat:nth-child(2) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-stat:nth-child(3) > .dl-stat-l` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.9pt (11.84px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tax-penalties` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.tier-banner-cta` | Element has insufficient color contrast of 3.35 (foreground color: #169b62, background color: #fff8e1, font size: 9.0pt (12px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.mode-selector-label` | Element has insufficient color contrast of 3.4 (foreground color: #169b62, background color: #fafaf5, font size: 9.4pt (12.48px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.active[data-mode="forward"][type="button"]` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 10.6pt (14.08px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `button[data-mode="reverse"][type="button"] > .mode-tier-tag` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 7.4pt (9.92px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `button[data-mode="drop-swap"][type="button"] > .mode-tier-tag` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 7.4pt (9.92px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `button[data-mode="multi"][type="button"] > .mode-tier-tag` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 7.4pt (9.92px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-section:nth-child(1) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-section:nth-child(2) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-section:nth-child(3) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.active[data-rule="three"][type="button"]` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 9.8pt (13.12px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.id-rule-card.active[data-rule="three"] > .id-rule-card-num` | Element has insufficient color contrast of 3.36 (foreground color: #169b62, background color: #f3faf7, font size: 9.4pt (12.48px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.id-rule-card[data-rule="200"] > .id-rule-card-num` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.id-rule-card[data-rule="95"] > .id-rule-card-num` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-section:nth-child(4) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-section:nth-child(5) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-section:nth-child(6) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-section:nth-child(7) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-section:nth-child(8) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.member-only-note` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.8pt (13.12px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-btn` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-btn-secondary` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-section:nth-child(11) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-section:nth-child(11) > .info-card > strong:nth-child(1)` | Element has insufficient color contrast of 3.4 (foreground color: #169b62, background color: #fafaf5, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.info-card > strong:nth-child(2)` | Element has insufficient color contrast of 3.4 (foreground color: #169b62, background color: #fafaf5, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `strong:nth-child(3)` | Element has insufficient color contrast of 3.4 (foreground color: #169b62, background color: #fafaf5, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `strong:nth-child(4)` | Element has insufficient color contrast of 3.4 (foreground color: #169b62, background color: #fafaf5, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `strong:nth-child(5)` | Element has insufficient color contrast of 3.4 (foreground color: #169b62, background color: #fafaf5, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.calc-section:nth-child(12) > h3:nth-child(1)` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.col-lg-12 > .info-card > strong` | Element has insufficient color contrast of 3.4 (foreground color: #169b62, background color: #fafaf5, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-1031-exchange` | `.info-card > a[href$="contact.html"]` | Element has insufficient color contrast of 3.4 (foreground color: #169b62, background color: #fafaf5, font size: 10.6pt (14.08px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-capital-gains` | `.calc-btn` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-capital-gains` | `.calc-btn-secondary` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-capital-gains` | `h5` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 15.0pt (20px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-capital-gains` | `.cta-link` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-capital-gains` | `.tool-back > a[href$="tools.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-capital-gains` | `.tool-back > a[href$="tax-planning.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-cost-segregation` | `.calc-section:nth-child(3) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-cost-segregation` | `.calc-section:nth-child(4) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-cost-segregation` | `.calc-section:nth-child(5) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-cost-segregation` | `#state_conform_note > strong` | Element has insufficient color contrast of 3.4 (foreground color: #169b62, background color: #fafaf5, font size: 10.2pt (13.6px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-cost-segregation` | `.calc-section:nth-child(6) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-cost-segregation` | `.calc-section:nth-child(7) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-cost-segregation` | `.calc-btn` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-cost-segregation` | `.calc-btn-secondary` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-cost-segregation` | `.calc-section:nth-child(10) > h3:nth-child(1)` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-cost-segregation` | `.calc-section:nth-child(11) > h3` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.6pt (16.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-cost-segregation` | `.col-lg-12 > .info-card > strong` | Element has insufficient color contrast of 3.4 (foreground color: #169b62, background color: #fafaf5, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-cost-segregation` | `.info-card > a[href$="contact.html"]` | Element has insufficient color contrast of 3.4 (foreground color: #169b62, background color: #fafaf5, font size: 10.6pt (14.08px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-deal-builder-preview` | `.preview-eyebrow` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-deal-builder-preview` | `.preview-eyebrow > .brand-reserve` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-deal-builder-preview` | `.gate-icon > .brand-reserve` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 24.0pt (32px), font weight: normal). Expected contrast ratio of 3:1 |
| `/tool-deal-builder-preview` | `.gate-label` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 8.6pt (11.52px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-deal-builder-preview` | `.preview-footer-meta` | Element has insufficient color contrast of 3.26 (foreground color: #6b6b6b, background color: #1a1a1a, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-deal-builder-preview` | `.preview-footer-meta > .brand-reserve` | Element has insufficient color contrast of 3.26 (foreground color: #6b6b6b, background color: #1a1a1a, font size: 8.4pt (11.2px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-firpta-withholding` | `.calc-btn` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-firpta-withholding` | `.calc-btn-secondary` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-firpta-withholding` | `h5` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 15.0pt (20px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-firpta-withholding` | `.cta-link` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-firpta-withholding` | `.tool-back > a[href$="tools.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-firpta-withholding` | `.tool-back > a[href$="real-estate.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-firpta-withholding` | `.tool-back > a[href$="tax-compliance.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `.active` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 9.4pt (12.48px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('Letter 525')"] > .urgency-badge` | Element has insufficient color contrast of 3.72 (foreground color: #d35400, background color: #fdf0e3, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('CP2000')"] > .urgency-badge` | Element has insufficient color contrast of 3.72 (foreground color: #d35400, background color: #fdf0e3, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('CP2501')"] > .urgency-badge` | Element has insufficient color contrast of 3.72 (foreground color: #d35400, background color: #fdf0e3, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('CP14')"] > .urgency-badge` | Element has insufficient color contrast of 3.72 (foreground color: #d35400, background color: #fdf0e3, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('CP504')"] > .urgency-badge` | Element has insufficient color contrast of 3.72 (foreground color: #d35400, background color: #fdf0e3, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('Letter 1153')"] > .urgency-badge` | Element has insufficient color contrast of 3.72 (foreground color: #d35400, background color: #fdf0e3, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('Letter 226-J')"] > .urgency-badge` | Element has insufficient color contrast of 3.72 (foreground color: #d35400, background color: #fdf0e3, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('CP59')"] > .urgency-badge` | Element has insufficient color contrast of 3.72 (foreground color: #d35400, background color: #fdf0e3, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('CP523')"] > .urgency-badge` | Element has insufficient color contrast of 3.72 (foreground color: #d35400, background color: #fdf0e3, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('CP501')"] > .urgency-badge` | Element has insufficient color contrast of 3.17 (foreground color: #169b62, background color: #e8f5ee, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('CP503')"] > .urgency-badge` | Element has insufficient color contrast of 3.17 (foreground color: #169b62, background color: #e8f5ee, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('CP05')"] > .urgency-badge` | Element has insufficient color contrast of 3.17 (foreground color: #169b62, background color: #e8f5ee, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `div[data-dvn-do="showDetail('5071C')"] > .urgency-badge` | Element has insufficient color contrast of 3.17 (foreground color: #169b62, background color: #e8f5ee, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `.cta-link` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `.tool-back > a[href$="tools.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-irs-notice-guide` | `.tool-back > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-oic-rcp-estimator` | `.tool-form > h5:nth-child(1)` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 15.0pt (20px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-oic-rcp-estimator` | `h5:nth-child(4)` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 15.0pt (20px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-oic-rcp-estimator` | `h5:nth-child(7)` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 15.0pt (20px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-oic-rcp-estimator` | `.calc-btn` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-oic-rcp-estimator` | `.calc-btn-secondary` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-oic-rcp-estimator` | `.methodology > h5` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 15.0pt (20px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-oic-rcp-estimator` | `.cta-link` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 10.8pt (14.4px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-oic-rcp-estimator` | `.tool-back > a[href$="tools.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-oic-rcp-estimator` | `.tool-back > a[href$="tax-controversy.html"]` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.2pt (13.6px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-rental-real-estate-tax-strategy-analyzer` | `a[href="tool-deal-builder-preview.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 12.0pt (16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-rental-real-estate-tax-strategy-analyzer` | `div:nth-child(8) > strong:nth-child(1)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tool-rental-real-estate-tax-strategy-analyzer` | `.rate-estimator-box > div:nth-child(1)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tool-rental-real-estate-tax-strategy-analyzer` | `#step_5 > div:nth-child(6) > strong:nth-child(1)` | Element has insufficient color contrast of 3.25 (foreground color: #169b62, background color: #f5f5f0, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(1) > .tool-category` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(1) > .tool-category > .brand-reserve` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(1) > .tool-description:nth-child(4) > a[href$="engagement.html"]` | Element has insufficient color contrast of 2.12 (foreground color: #c9a961, background color: #fbf8f2, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(1) > .analyzer-preset-grid-heading` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(2) > .tool-category` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(2) > .tool-category > .brand-reserve` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(2) > .tool-description:nth-child(4) > a[href$="engagement.html"]` | Element has insufficient color contrast of 2.12 (foreground color: #c9a961, background color: #fbf8f2, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(2) > .analyzer-preset-grid-heading` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `a[href$="tool-structuring.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(3) > .tool-category` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-link[href="tool-irs-notice-guide.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(4) > .tool-category` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(4) > .analyzer-preset-grid-heading` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-description:nth-child(6) > a[href="tool-deal-builder-preview.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 10.6pt (14.08px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-description:nth-child(7) > a[href$="engagement.html"]` | Element has insufficient color contrast of 3.24 (foreground color: #169b62, background color: #ecf7f2, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(4) > .tool-link` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(5) > .tool-category` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(5) > .tool-category > .brand-reserve` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(5) > .tool-description:nth-child(4) > a[href$="engagement.html"]` | Element has insufficient color contrast of 3.24 (foreground color: #169b62, background color: #ecf7f2, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-link[href$="tool-1031-exchange.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(6) > .tool-category` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-link[href="tool-firpta-withholding.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(7) > .tool-category` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-link[href$="tool-capital-gains.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(8) > .tool-category` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-link[href="tool-cost-segregation.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(9) > .tool-category` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-link[href="tool-oic-rcp-estimator.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(10) > .tool-category` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(10) > .tool-category > .brand-reserve` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(10) > .tool-description:nth-child(4) > a[href$="engagement.html"]` | Element has insufficient color contrast of 2.12 (foreground color: #c9a961, background color: #fbf8f2, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(10) > .tool-link[href$="engagement.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(11) > .tool-category` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(11) > .tool-category > .brand-reserve` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(11) > .tool-description:nth-child(4) > a[href$="engagement.html"]` | Element has insufficient color contrast of 2.12 (foreground color: #c9a961, background color: #fbf8f2, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(11) > .tool-link[href$="engagement.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(12) > .tool-category` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(12) > .tool-category > .brand-reserve` | Element has insufficient color contrast of 3.41 (foreground color: #8a8b8d, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(12) > .tool-description:nth-child(4) > a[href$="engagement.html"]` | Element has insufficient color contrast of 3.07 (foreground color: #8a8b8d, background color: #f3f3f4, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(12) > .tool-link[href$="engagement.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(13) > .tool-category` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(13) > .tool-category > .brand-reserve` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(13) > .tool-description:nth-child(4) > a[href$="engagement.html"]` | Element has insufficient color contrast of 2.12 (foreground color: #c9a961, background color: #fbf8f2, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(13) > .tool-link[href$="engagement.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(14) > .tool-category` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(14) > .tool-category > .brand-reserve` | Element has insufficient color contrast of 2.25 (foreground color: #c9a961, background color: #ffffff, font size: 9.4pt (12.48px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(14) > .tool-description:nth-child(4) > a[href$="engagement.html"]` | Element has insufficient color contrast of 2.12 (foreground color: #c9a961, background color: #fbf8f2, font size: 10.6pt (14.08px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/tools` | `.tool-card:nth-child(14) > .tool-link[href$="engagement.html"]` | Element has insufficient color contrast of 3.55 (foreground color: #169b62, background color: #ffffff, font size: 9.6pt (12.8px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-steps.dl-steps-3:nth-child(16) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/unfiled-returns` | `.dl-steps.dl-steps-3:nth-child(18) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-cred:nth-child(1) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-cred:nth-child(2) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-cred:nth-child(3) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-cred:nth-child(4) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-cred:nth-child(5) > .dl-cred-l` | Element has insufficient color contrast of 3.45 (foreground color: #8a8a8a, background color: #ffffff, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-cta-btn-1 > .l` | Element has insufficient color contrast of 2.74 (foreground color: #416b41, background color: #c9a961, font size: 8.6pt (11.52px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-cta-note` | Element has insufficient color contrast of 4.44 (foreground color: #9fbca9, background color: #0c5334, font size: 9.1pt (12.16px), font weight: normal). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-chips-l` | Element has insufficient color contrast of 3.15 (foreground color: #8a8a8a, background color: #f5f5f0, font size: 8.4pt (11.2px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-steps.dl-steps-3:nth-child(15) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-steps.dl-steps-3:nth-child(15) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-steps.dl-steps-3:nth-child(15) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-steps.dl-steps-3:nth-child(17) > .dl-step:nth-child(1) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-steps.dl-steps-3:nth-child(17) > .dl-step:nth-child(2) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |
| `/voluntary-disclosure` | `.dl-steps.dl-steps-3:nth-child(17) > .dl-step:nth-child(3) > .dl-step-k` | Element has insufficient color contrast of 2.05 (foreground color: #c9a961, background color: #f5f5f0, font size: 8.2pt (10.88px), font weight: bold). Expected contrast ratio of 4.5:1 |

### `svg-img-alt` — serious · 28 node(s) on 26 page(s)

<svg> elements with an img or image role must have alternative text (wcag2a, wcag111)

| Page | Node target | Failure |
| --- | --- | --- |
| `/blog-augusta-rule-280a-g` | `svg[viewBox="0 0 760 340"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-character-amount-timing` | `svg[viewBox="0 0 760 430"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-civil-fraud-eggshell-audit` | `svg[viewBox="0 0 760 324"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-conservation-easement-settlement` | `svg[viewBox="0 0 760 196"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-criminal-tax-overview` | `svg[viewBox="0 0 760 248"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-currently-not-collectible-csed` | `svg[viewBox="0 0 760 286"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-fbar-foreign-account-penalties` | `svg[viewBox="0 0 760 264"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-foreclose-federal-tax-lien-suit` | `svg[viewBox="0 0 760 246"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-irs-co-owned-marital-real-estate` | `svg[viewBox="0 0 760 220"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-irs-levy` | `svg[viewBox="0 0 760 326"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-irs-levy` | `svg[viewBox="0 0 760 378"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-irs-summons` | `svg[viewBox="0 0 760 300"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-jeopardy-termination-assessments` | `svg[viewBox="0 0 760 312"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-kwong-covid-deadlines` | `svg[viewBox="0 0 760 250"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-material-participation-seven-tests` | `svg[viewBox="0 0 760 415"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-notice-of-federal-tax-lien` | `svg[viewBox="0 0 760 452"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-passport-revocation-tax-debt` | `svg[viewBox="0 0 760 286"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-penalty-regime-6751b` | `svg[viewBox="0 0 760 246"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-per-se-passive-rule-exceptions` | `svg[viewBox="0 0 760 420"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-real-estate-professional-status-reps` | `svg[viewBox="0 0 760 410"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-short-term-rental-play` | `svg[viewBox="0 0 760 430"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-subdivision-basis-allocation` | `svg[viewBox="0 0 760 300"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-substitute-for-return` | `svg[viewBox="0 0 760 214"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-tax-opinions` | `svg[viewBox="0 0 760 432"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-tenancy-by-entirety-federal-tax-lien` | `svg[viewBox="0 0 760 360"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-transferee-nominee-alter-ego` | `svg[viewBox="0 0 760 322"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-trust-fund-recovery-penalty` | `svg[viewBox="0 0 760 392"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |
| `/blog-trust-fund-recovery-penalty` | `svg[viewBox="0 0 760 246"]` | Element has no child that is a title aria-label attribute does not exist or is empty aria-labelledby attribute does not exist, references elements that do not exist or references elements that are empty Element has no title attribute |

### `html-has-lang` — serious · 9 node(s) on 9 page(s)

<html> element must have a lang attribute (wcag2a, wcag311)

| Page | Node target | Failure |
| --- | --- | --- |
| `/business-law` | `html` | The <html> element does not have a lang attribute |
| `/contracts` | `html` | The <html> element does not have a lang attribute |
| `/development` | `html` | The <html> element does not have a lang attribute |
| `/eminent-domain` | `html` | The <html> element does not have a lang attribute |
| `/entity-formation` | `html` | The <html> element does not have a lang attribute |
| `/leasing` | `html` | The <html> element does not have a lang attribute |
| `/litigation` | `html` | The <html> element does not have a lang attribute |
| `/property-acquisition` | `html` | The <html> element does not have a lang attribute |
| `/re-financing` | `html` | The <html> element does not have a lang attribute |

### `link-in-text-block` — serious · 8 node(s) on 8 page(s)

Links must be distinguishable without relying on color (wcag2a, wcag141)

| Page | Node target | Failure |
| --- | --- | --- |
| `/blog-controversy-roadmap-0-overview` | `a[href$="tax-controversy.html"]` | The link has insufficient color contrast of 2.33:1 with the surrounding text. (Minimum contrast is 3:1, link text: #019a48, surrounding text: #c5d0d6) The link has no styling (such as underline) to distinguish it from the surrounding text |
| `/blog-controversy-roadmap-1-processing-assessment` | `a[href$="irs-notice.html"]` | The link has insufficient color contrast of 2.33:1 with the surrounding text. (Minimum contrast is 3:1, link text: #019a48, surrounding text: #c5d0d6) The link has no styling (such as underline) to distinguish it from the surrounding text |
| `/blog-controversy-roadmap-2-exam` | `a[href$="irs-audit-defense.html"]` | The link has insufficient color contrast of 2.33:1 with the surrounding text. (Minimum contrast is 3:1, link text: #019a48, surrounding text: #c5d0d6) The link has no styling (such as underline) to distinguish it from the surrounding text |
| `/blog-controversy-roadmap-3-exam-alternatives` | `a[href="audit-reconsideration.html"]` | The link has insufficient color contrast of 2.33:1 with the surrounding text. (Minimum contrast is 3:1, link text: #019a48, surrounding text: #c5d0d6) The link has no styling (such as underline) to distinguish it from the surrounding text |
| `/blog-controversy-roadmap-4-appeals` | `a[href$="irs-appeals.html"]` | The link has insufficient color contrast of 2.33:1 with the surrounding text. (Minimum contrast is 3:1, link text: #019a48, surrounding text: #c5d0d6) The link has no styling (such as underline) to distinguish it from the surrounding text |
| `/blog-controversy-roadmap-5-collection` | `a[href$="irs-liens-levies.html"]` | The link has insufficient color contrast of 2.33:1 with the surrounding text. (Minimum contrast is 3:1, link text: #019a48, surrounding text: #c5d0d6) The link has no styling (such as underline) to distinguish it from the surrounding text |
| `/blog-controversy-roadmap-6-collection-alternatives` | `a[href$="tax-debt-resolution.html"]` | The link has insufficient color contrast of 2.33:1 with the surrounding text. (Minimum contrast is 3:1, link text: #019a48, surrounding text: #c5d0d6) The link has no styling (such as underline) to distinguish it from the surrounding text |
| `/blog-controversy-roadmap-7-litigation` | `a[href$="tax-court.html"]` | The link has insufficient color contrast of 2.33:1 with the surrounding text. (Minimum contrast is 3:1, link text: #019a48, surrounding text: #c5d0d6) The link has no styling (such as underline) to distinguish it from the surrounding text |

### `nested-interactive` — serious · 2 node(s) on 2 page(s)

Interactive controls must not be nested (wcag2a, wcag412)

| Page | Node target | Failure |
| --- | --- | --- |
| `/florida-sales-tax-audit` | `svg[width="100%"]` | Element has focusable descendants |
| `/massachusetts-tax-appeal` | `svg[width="100%"]` | Element has focusable descendants |

## 5. Image alt-text coverage

| Metric | Count |
| --- | --- |
| `<img>` elements across all 98 pages | 308 |
| With an `alt` attribute present | **308 / 308** |
| — non-empty `alt` (informative) | 210 |
| — empty `alt=""` (declared decorative) | 98 |
| **Missing `alt` attribute entirely** | **0** |
| Decorative-vs-informative ambiguities flagged | 98 |

## 6. Measurement integrity

| Check | Result |
| --- | --- |
| Concurrency | 1 (serial — concurrency was previously proven to manufacture phantom contrast nodes) |
| Passes per page | 2, 1200ms apart; only nodes reproducing in both are reported |
| Nodes quarantined as UNSTABLE (flapped between passes, **excluded** from all counts above) | 0 |
| Full-page reveal scroll before measuring | yes — scroll-gated card grids are counted |
| Stylesheet/font gate before measuring | yes — a page whose CSS had not applied is recorded UNMEASURED, never scored |
| CSP handling | axe injected via CDP `page.evaluate`, **not** `bypassCSP` — the measured DOM is the real one |

## 7. Why 1033 contrast failures survived a fix that re-valued the palette

#213 re-valued the brand colours in the shared stylesheets and, by calculation, all 29
changed pairs clear 4.5:1. Yet **622** live failing nodes are still painted in the *old*
green `#169b62` and **181** in the old gold `#c9a961` — together **803 of 1033**
residual nodes (78%) are the exact colours the fix re-valued.

The fix is correct; it simply **cannot reach these elements**. The old hex is written into
the delivered HTML, which outranks or bypasses any stylesheet re-value:

### Residual contrast failures by measured colour pair

| Foreground | Background | Nodes | Note |
| --- | --- | --- | --- |
| `#169b62` | `#f5f5f0` | 502 | **pre-#213 brand green** |
| `#c9a961` | `#f5f5f0` | 113 | **pre-#213 brand gold** |
| `#169b62` | `#ffffff` | 81 | **pre-#213 brand green** |
| `#8a8a8a` | `#ffffff` | 75 | greys/other — never in #213 scope |
| `#8a6f1f` | `#f5f7f4` | 43 | greys/other — never in #213 scope |
| `#5e7686` | `#eef2f4` | 27 | greys/other — never in #213 scope |
| `#c9a961` | `#ffffff` | 23 | **pre-#213 brand gold** |
| `#8a8b8d` | `#ffffff` | 21 | greys/other — never in #213 scope |
| `#ffffff` | `#169b62` | 18 | **pre-#213 brand green** |
| `#019a48` | `#fcfcfb` | 16 | self-styled page palette (`--emer`) |
| `#416b41` | `#c9a961` | 15 | **pre-#213 brand gold** |
| `#9fbca9` | `#0c5334` | 15 | greys/other — never in #213 scope |

| Where the old green still lives in live HTML | Occurrences | Pages |
| --- | --- | --- |
| Per-page `<style>` blocks | 876 | 90 |
| Element `style="…"` attributes | 73 | 21 |
| Pages that never load `css/main.css` at all | — | 8 |

### Proof: the winning rule, not just a grep

Grepping `css/` only shows a hex exists somewhere. To establish what actually paints the
element, the winner was read out of Chrome via CDP `CSS.getMatchedStylesForNode` plus the
element's own inline style:

```
page      https://www.donovan.law/
selector  a[rel="noopener"][target="_blank"]
computed  color: rgb(22, 155, 98)   ← #169b62, the PRE-fix green
main.css  offered #107a4d via .home-section a:not(.btn):not(.dropdown-item):not(.nav-link):not(.mobile-menu-item)
winner    element style="color: #169B62; font-weight: 600;" attribute
```

`main.css` correctly serves the new `#107a4d`, and it loses — the element carries its own
`style="color: #169B62"`, which no stylesheet re-value can override. The same mechanism,
at scale, is the 876 copies sitting in per-page `<style>` blocks.

**Consequence for #195:** the remaining contrast debt is *not* fixable in the theme layer.
It needs the hard-coded colours removed from the HTML — a content change across
90 pages, not another stylesheet edit. Reporting only "1537 → 1033" would imply the
theme approach can finish the job; measured, it cannot.

### The 8 pages with no site stylesheet

These load only `perch-layer.css` and `dl-utility-bar.css` and define their own palette
inline (`--emer:#019A48`). No edit to `main.css` can ever affect them:

- `/blog-controversy-roadmap-0-overview`
- `/blog-controversy-roadmap-1-processing-assessment`
- `/blog-controversy-roadmap-2-exam`
- `/blog-controversy-roadmap-3-exam-alternatives`
- `/blog-controversy-roadmap-4-appeals`
- `/blog-controversy-roadmap-5-collection`
- `/blog-controversy-roadmap-6-collection-alternatives`
- `/blog-controversy-roadmap-7-litigation`

## 8. What still fails — open against #195

| # | Rule | Impact | Nodes | Pages | Status vs pre-fix |
| --- | --- | --- | --- | --- | --- |
| 1 | `aria-valid-attr-value` | critical | 24 | 8 | unchanged |
| 2 | `button-name` | critical | 24 | 8 | unchanged |
| 3 | `aria-required-children` | critical | 1 | 1 | unchanged |
| 4 | `select-name` | critical | 1 | 1 | unchanged |
| 5 | `color-contrast` | serious | 1033 | 71 | improved (1537 → 806 on common pages) |
| 6 | `svg-img-alt` | serious | 28 | 26 | unchanged |
| 7 | `html-has-lang` | serious | 9 | 9 | unchanged |
| 8 | `link-in-text-block` | serious | 8 | 8 | **new since baseline** |
| 9 | `nested-interactive` | serious | 2 | 2 | **new since baseline** |

### The two rules that are new since the baseline

Both were checked against #213 before being reported, because a rule appearing after a
fix looks like a regression caused by it. Neither is:

- **`link-in-text-block`** (8 nodes, 8 pages) — all 8 are on `/blog-controversy-roadmap-*`,
  linking to pages added by #197. Those 8 pages do not load `main.css`; their link colour
  `#019a48` comes from their own inline `--emer` token, which #213 never touched. The two
  stylesheets they *do* load were changed by #213 only under `#perch-persistent` and
  utility-bar selectors, which cannot match a content link. **Cause: the #197 content
  deploy, which reached production between the two scans — not #213.**
- **`nested-interactive`** (2 nodes, 2 pages) — 0 nodes on the 84 baseline pages; both sit
  on pages that did not exist at baseline. **Cause: new content, not a regression.**

axe-core was pinned to **4.13.0** for this run — the same version as the pre-fix sweep — so
neither new rule is an artefact of a tool upgrade.

These are reported as measured, not triaged. Assigning owners and fixes is a
separate order — this one changes no site source.

## Appendix A — pinned URL list (98)

The exact list scanned, in sitemap order. `NEW` marks a URL absent from the pre-fix sitemap.

1. `/`
2. `/audit-reconsideration` — **NEW**
3. `/blog`
4. `/blog-461l-excess-business-loss-and-172-nol`
5. `/blog-augusta-rule-280a-g`
6. `/blog-bramblett-phelan-two-entity-structure`
7. `/blog-character-amount-timing`
8. `/blog-civil-fraud-eggshell-audit`
9. `/blog-conservation-easement-settlement`
10. `/blog-controversy-roadmap-0-overview`
11. `/blog-controversy-roadmap-1-processing-assessment`
12. `/blog-controversy-roadmap-2-exam`
13. `/blog-controversy-roadmap-3-exam-alternatives`
14. `/blog-controversy-roadmap-4-appeals`
15. `/blog-controversy-roadmap-5-collection`
16. `/blog-controversy-roadmap-6-collection-alternatives`
17. `/blog-controversy-roadmap-7-litigation`
18. `/blog-criminal-tax-overview`
19. `/blog-currently-not-collectible-csed`
20. `/blog-fbar-foreign-account-penalties`
21. `/blog-firpta-foreign-sellers`
22. `/blog-foreclose-federal-tax-lien-suit`
23. `/blog-irs-audit-notice-what-to-do`
24. `/blog-irs-co-owned-marital-real-estate`
25. `/blog-irs-levy`
26. `/blog-irs-summons`
27. `/blog-jeopardy-termination-assessments`
28. `/blog-kwong-covid-deadlines`
29. `/blog-material-participation-seven-tests`
30. `/blog-notice-of-federal-tax-lien`
31. `/blog-partnership-agreement-tax-document`
32. `/blog-passport-revocation-tax-debt`
33. `/blog-penalty-regime-6751b`
34. `/blog-per-se-passive-rule-exceptions`
35. `/blog-real-estate-professional-status-reps`
36. `/blog-short-term-rental-material-participation`
37. `/blog-short-term-rental-play`
38. `/blog-subdivision-basis-allocation`
39. `/blog-substitute-for-return`
40. `/blog-tax-opinions`
41. `/blog-tenancy-by-entirety-federal-tax-lien`
42. `/blog-transferee-nominee-alter-ego`
43. `/blog-trust-fund-recovery-penalty`
44. `/business-law`
45. `/contact`
46. `/contracts`
47. `/development`
48. `/disclaimer`
49. `/eminent-domain`
50. `/engagement`
51. `/entity-formation`
52. `/experience`
53. `/florida-sales-tax-audit` — **NEW**
54. `/irs-appeals` — **NEW**
55. `/irs-audit-defense` — **NEW**
56. `/irs-liens-levies` — **NEW**
57. `/irs-notice` — **NEW**
58. `/leasing`
59. `/leidy`
60. `/litigation`
61. `/massachusetts-tax-appeal` — **NEW**
62. `/membership-diamond`
63. `/membership-gold`
64. `/membership-platinum`
65. `/membership-reserve`
66. `/ourfirm`
67. `/partnership-audits` — **NEW**
68. `/practice`
69. `/profile`
70. `/property-acquisition`
71. `/re-acquisition`
72. `/re-disposition`
73. `/re-financing`
74. `/re-ownership`
75. `/real-estate`
76. `/residency-audit` — **NEW**
77. `/special-counsel`
78. `/tax`
79. `/tax-compliance`
80. `/tax-controversy`
81. `/tax-court` — **NEW**
82. `/tax-debt-resolution` — **NEW**
83. `/tax-penalties` — **NEW**
84. `/tax-planning`
85. `/tefera`
86. `/testimonials`
87. `/tool-1031-exchange`
88. `/tool-capital-gains`
89. `/tool-cost-segregation`
90. `/tool-deal-builder-preview`
91. `/tool-firpta-withholding`
92. `/tool-irs-notice-guide`
93. `/tool-oic-rcp-estimator`
94. `/tool-rental-real-estate-tax-strategy-analyzer`
95. `/tools`
96. `/unfiled-returns` — **NEW**
97. `/voluntary-disclosure` — **NEW**
98. `/wendy`

---

*Generated from `results.json` (98 measured / 0 unmeasured) by ORDER SARAH-195-PROD-SWEEP-R1. Agents do not merge — Zane gates, David merges.*
