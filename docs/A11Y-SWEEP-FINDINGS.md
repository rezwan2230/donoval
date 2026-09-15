# SARAH — A11Y Sweep Findings (ORDER SARAH-195-A11Y-SWEEP-R1)

**Agent:** Sarah (QA) · **Issue:** #195 · **Scan date:** 2026-08-07
**Scope:** all 84 URLs in the live sitemap at https://www.donovan.law/sitemap.xml
**Tooling:** axe-core 4.13.0 via Playwright/Chromium headless, WCAG 2 AA tag set `wcag2a, wcag2aa, wcag21a, wcag21aa`
**Method:** serial (concurrency 1), full-page reveal scroll, then axe run **twice** per page 1200ms apart — only nodes reproducing in both passes are reported
**Reproduce:** `scripts/a11y/a11y-sweep.mjs` (axe + alt inventory), `scripts/a11y/keyboard-probe.mjs` (keyboard + focus), `scripts/a11y/gen-report.mjs` (this document)

> This is a **measurement** order. No site source was modified. Findings are split into
> **CONFIRMED** (machine-verified, reproducible from the committed scripts) and **MANUAL**
> (observed by a human-directed probe). Anything not established by measurement is marked
> **UNVERIFIED** and is not presented as a defect.

## 1. Sitemap reconciliation

| Check | Result |
| --- | --- |
| Live sitemap URL count | **84** |
| Expected per order | 84 |
| Delta | **0 — matches exactly** |
| Sitemap form | flat `<urlset>` (no nested `<sitemapindex>`, so no URLs hidden behind a child sitemap) |
| Pages measured | **84 / 84** |
| Pages UNMEASURED | **0** |

The full pinned URL list is in [Appendix A](#appendix-a--pinned-url-list-84).

## 2. Rollup — ranked by impact

CONFIRMED machine findings (axe-core). Impact is axe's own severity.

| # | Rule ID | Impact | WCAG | Pages affected | Failing nodes | What it means |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `aria-valid-attr-value` | **critical** | wcag2a, wcag412 | 8 / 84 | 24 | ARIA attributes must conform to valid values |
| 2 | `button-name` | **critical** | wcag2a, wcag412 | 8 / 84 | 24 | Buttons must have discernible text |
| 3 | `aria-required-children` | **critical** | wcag2a, wcag131 | 1 / 84 | 1 | Certain ARIA roles must contain particular children |
| 4 | `select-name` | **critical** | wcag2a, wcag412 | 1 / 84 | 1 | Select element must have an accessible name |
| 5 | `color-contrast` | **serious** | wcag2aa, wcag143 | 84 / 84 | 1537 | Elements must meet minimum color contrast ratio thresholds |
| 6 | `svg-img-alt` | **serious** | wcag2a, wcag111 | 26 / 84 | 28 | <svg> elements with an img or image role must have alternative text |
| 7 | `html-has-lang` | **serious** | wcag2a, wcag311 | 9 / 84 | 9 | <html> element must have a lang attribute |

**Total failing nodes across the site: 1624.**

### Keyboard / focus findings (MANUAL — axe has no rule for these)

| # | Finding | Impact | Pages affected | Evidence |
| --- | --- | --- | --- | --- |
| K1 | No visible focus indicator on 7 form control(s): `<input type=text>`, `<input type=email>`, `<input type=tel>`, `<select>`, `<textarea>` | **serious** (WCAG 2.4.7 Focus Visible, AA) | /contact (T10 Utility/contact form) | computed style unchanged on element, descendants and pseudo-elements; screenshot byte-identical focused vs unfocused with animations frozen |

## 3. Per-page defect table

`alt` column is **present / total** `<img>` elements, where "present" means an `alt`
attribute exists at all (an intentional `alt=""` counts as present — it is a valid
decorative declaration). `amb` = decorative-vs-informative ambiguities flagged for human
adjudication, **not** counted as defects.

| Page | Template | Status | axe rules (impact × nodes) | alt | amb |
| --- | --- | --- | --- | --- | --- |
| [/](https://www.donovan.law/) | T1 Home | MEASURED | `color-contrast` (serious×21) | 4/4 | 1 |
| [/blog](https://www.donovan.law/blog) | T2 Blog index | MEASURED | `aria-required-children` (critical×1)<br>`color-contrast` (serious×91) | 3/3 | 1 |
| [/blog-461l-excess-business-loss-and-172-nol](https://www.donovan.law/blog-461l-excess-business-loss-and-172-nol) | T3 Blog article | MEASURED | `color-contrast` (serious×17) | 3/3 | 1 |
| [/blog-augusta-rule-280a-g](https://www.donovan.law/blog-augusta-rule-280a-g) | T3 Blog article | MEASURED | `color-contrast` (serious×16)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-bramblett-phelan-two-entity-structure](https://www.donovan.law/blog-bramblett-phelan-two-entity-structure) | T3 Blog article | MEASURED | `color-contrast` (serious×4) | 2/2 | 1 |
| [/blog-character-amount-timing](https://www.donovan.law/blog-character-amount-timing) | T3 Blog article | MEASURED | `color-contrast` (serious×16)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-civil-fraud-eggshell-audit](https://www.donovan.law/blog-civil-fraud-eggshell-audit) | T3 Blog article | MEASURED | `color-contrast` (serious×21)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-conservation-easement-settlement](https://www.donovan.law/blog-conservation-easement-settlement) | T3 Blog article | MEASURED | `color-contrast` (serious×19)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-controversy-roadmap-0-overview](https://www.donovan.law/blog-controversy-roadmap-0-overview) | T3 Blog article | MEASURED | `color-contrast` (serious×5) | 2/2 | 1 |
| [/blog-controversy-roadmap-1-processing-assessment](https://www.donovan.law/blog-controversy-roadmap-1-processing-assessment) | T3 Blog article | MEASURED | `color-contrast` (serious×11) | 2/2 | 1 |
| [/blog-controversy-roadmap-2-exam](https://www.donovan.law/blog-controversy-roadmap-2-exam) | T3 Blog article | MEASURED | `color-contrast` (serious×9) | 2/2 | 1 |
| [/blog-controversy-roadmap-3-exam-alternatives](https://www.donovan.law/blog-controversy-roadmap-3-exam-alternatives) | T3 Blog article | MEASURED | `color-contrast` (serious×13) | 2/2 | 1 |
| [/blog-controversy-roadmap-4-appeals](https://www.donovan.law/blog-controversy-roadmap-4-appeals) | T3 Blog article | MEASURED | `color-contrast` (serious×15) | 2/2 | 1 |
| [/blog-controversy-roadmap-5-collection](https://www.donovan.law/blog-controversy-roadmap-5-collection) | T3 Blog article | MEASURED | `color-contrast` (serious×6) | 2/2 | 1 |
| [/blog-controversy-roadmap-6-collection-alternatives](https://www.donovan.law/blog-controversy-roadmap-6-collection-alternatives) | T3 Blog article | MEASURED | `color-contrast` (serious×8) | 2/2 | 1 |
| [/blog-controversy-roadmap-7-litigation](https://www.donovan.law/blog-controversy-roadmap-7-litigation) | T3 Blog article | MEASURED | `color-contrast` (serious×5) | 2/2 | 1 |
| [/blog-criminal-tax-overview](https://www.donovan.law/blog-criminal-tax-overview) | T3 Blog article | MEASURED | `color-contrast` (serious×28)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-currently-not-collectible-csed](https://www.donovan.law/blog-currently-not-collectible-csed) | T3 Blog article | MEASURED | `color-contrast` (serious×20)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-fbar-foreign-account-penalties](https://www.donovan.law/blog-fbar-foreign-account-penalties) | T3 Blog article | MEASURED | `color-contrast` (serious×24)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-firpta-foreign-sellers](https://www.donovan.law/blog-firpta-foreign-sellers) | T3 Blog article | MEASURED | `color-contrast` (serious×16) | 3/3 | 1 |
| [/blog-foreclose-federal-tax-lien-suit](https://www.donovan.law/blog-foreclose-federal-tax-lien-suit) | T3 Blog article | MEASURED | `color-contrast` (serious×22)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-irs-audit-notice-what-to-do](https://www.donovan.law/blog-irs-audit-notice-what-to-do) | T3 Blog article | MEASURED | `color-contrast` (serious×15) | 3/3 | 1 |
| [/blog-irs-co-owned-marital-real-estate](https://www.donovan.law/blog-irs-co-owned-marital-real-estate) | T3 Blog article | MEASURED | `color-contrast` (serious×25)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-irs-levy](https://www.donovan.law/blog-irs-levy) | T3 Blog article | MEASURED | `color-contrast` (serious×24)<br>`svg-img-alt` (serious×2) | 3/3 | 1 |
| [/blog-irs-summons](https://www.donovan.law/blog-irs-summons) | T3 Blog article | MEASURED | `color-contrast` (serious×21)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-jeopardy-termination-assessments](https://www.donovan.law/blog-jeopardy-termination-assessments) | T3 Blog article | MEASURED | `color-contrast` (serious×19)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-kwong-covid-deadlines](https://www.donovan.law/blog-kwong-covid-deadlines) | T3 Blog article | MEASURED | `color-contrast` (serious×20)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-material-participation-seven-tests](https://www.donovan.law/blog-material-participation-seven-tests) | T3 Blog article | MEASURED | `color-contrast` (serious×15)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-notice-of-federal-tax-lien](https://www.donovan.law/blog-notice-of-federal-tax-lien) | T3 Blog article | MEASURED | `color-contrast` (serious×27)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-partnership-agreement-tax-document](https://www.donovan.law/blog-partnership-agreement-tax-document) | T3 Blog article | MEASURED | `color-contrast` (serious×16) | 3/3 | 1 |
| [/blog-passport-revocation-tax-debt](https://www.donovan.law/blog-passport-revocation-tax-debt) | T3 Blog article | MEASURED | `color-contrast` (serious×20)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-penalty-regime-6751b](https://www.donovan.law/blog-penalty-regime-6751b) | T3 Blog article | MEASURED | `color-contrast` (serious×20)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-per-se-passive-rule-exceptions](https://www.donovan.law/blog-per-se-passive-rule-exceptions) | T3 Blog article | MEASURED | `color-contrast` (serious×14)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-real-estate-professional-status-reps](https://www.donovan.law/blog-real-estate-professional-status-reps) | T3 Blog article | MEASURED | `color-contrast` (serious×15)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-short-term-rental-material-participation](https://www.donovan.law/blog-short-term-rental-material-participation) | T3 Blog article | MEASURED | `color-contrast` (serious×18) | 3/3 | 1 |
| [/blog-short-term-rental-play](https://www.donovan.law/blog-short-term-rental-play) | T3 Blog article | MEASURED | `color-contrast` (serious×17)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-subdivision-basis-allocation](https://www.donovan.law/blog-subdivision-basis-allocation) | T3 Blog article | MEASURED | `color-contrast` (serious×15)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-substitute-for-return](https://www.donovan.law/blog-substitute-for-return) | T3 Blog article | MEASURED | `color-contrast` (serious×20)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-tax-opinions](https://www.donovan.law/blog-tax-opinions) | T3 Blog article | MEASURED | `color-contrast` (serious×24)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-tenancy-by-entirety-federal-tax-lien](https://www.donovan.law/blog-tenancy-by-entirety-federal-tax-lien) | T3 Blog article | MEASURED | `color-contrast` (serious×25)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-transferee-nominee-alter-ego](https://www.donovan.law/blog-transferee-nominee-alter-ego) | T3 Blog article | MEASURED | `color-contrast` (serious×22)<br>`svg-img-alt` (serious×1) | 3/3 | 1 |
| [/blog-trust-fund-recovery-penalty](https://www.donovan.law/blog-trust-fund-recovery-penalty) | T3 Blog article | MEASURED | `color-contrast` (serious×23)<br>`svg-img-alt` (serious×2) | 3/3 | 1 |
| [/business-law](https://www.donovan.law/business-law) | T4 Legacy practice accordion | MEASURED | `color-contrast` (serious×5)<br>`html-has-lang` (serious×1) | 3/3 | 1 |
| [/contact](https://www.donovan.law/contact) | T10 Utility | MEASURED | `color-contrast` (serious×18) | 3/3 | 1 |
| [/contracts](https://www.donovan.law/contracts) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`color-contrast` (serious×8)<br>`html-has-lang` (serious×1) | 3/3 | 1 |
| [/development](https://www.donovan.law/development) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`color-contrast` (serious×8)<br>`html-has-lang` (serious×1) | 3/3 | 1 |
| [/disclaimer](https://www.donovan.law/disclaimer) | T10 Utility | MEASURED | `color-contrast` (serious×15) | 3/3 | 1 |
| [/eminent-domain](https://www.donovan.law/eminent-domain) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`color-contrast` (serious×8)<br>`html-has-lang` (serious×1) | 3/3 | 1 |
| [/engagement](https://www.donovan.law/engagement) | T10 Utility | MEASURED | `color-contrast` (serious×24) | 3/3 | 1 |
| [/entity-formation](https://www.donovan.law/entity-formation) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`color-contrast` (serious×8)<br>`html-has-lang` (serious×1) | 3/3 | 1 |
| [/experience](https://www.donovan.law/experience) | T10 Utility | MEASURED | `color-contrast` (serious×11) | 3/3 | 1 |
| [/leasing](https://www.donovan.law/leasing) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`color-contrast` (serious×8)<br>`html-has-lang` (serious×1) | 3/3 | 1 |
| [/leidy](https://www.donovan.law/leidy) | T8 Attorney bio | MEASURED | `color-contrast` (serious×12) | 4/4 | 1 |
| [/litigation](https://www.donovan.law/litigation) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`color-contrast` (serious×8)<br>`html-has-lang` (serious×1) | 3/3 | 1 |
| [/membership-diamond](https://www.donovan.law/membership-diamond) | T7 Membership | MEASURED | `color-contrast` (serious×21) | 3/3 | 1 |
| [/membership-gold](https://www.donovan.law/membership-gold) | T7 Membership | MEASURED | `color-contrast` (serious×22) | 3/3 | 1 |
| [/membership-platinum](https://www.donovan.law/membership-platinum) | T7 Membership | MEASURED | `color-contrast` (serious×22) | 3/3 | 1 |
| [/membership-reserve](https://www.donovan.law/membership-reserve) | T7 Membership | MEASURED | `color-contrast` (serious×21) | 3/3 | 1 |
| [/ourfirm](https://www.donovan.law/ourfirm) | T10 Utility | MEASURED | `color-contrast` (serious×14) | 3/3 | 1 |
| [/practice](https://www.donovan.law/practice) | T9 Practice/service | MEASURED | `color-contrast` (serious×30) | 3/3 | 1 |
| [/profile](https://www.donovan.law/profile) | T8 Attorney bio | MEASURED | `color-contrast` (serious×17) | 4/4 | 1 |
| [/property-acquisition](https://www.donovan.law/property-acquisition) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`color-contrast` (serious×8)<br>`html-has-lang` (serious×1) | 3/3 | 1 |
| [/re-acquisition](https://www.donovan.law/re-acquisition) | T9 Practice/service | MEASURED | `color-contrast` (serious×19) | 3/3 | 1 |
| [/re-disposition](https://www.donovan.law/re-disposition) | T9 Practice/service | MEASURED | `color-contrast` (serious×20) | 3/3 | 1 |
| [/re-financing](https://www.donovan.law/re-financing) | T4 Legacy practice accordion | MEASURED | `aria-valid-attr-value` (critical×3)<br>`button-name` (critical×3)<br>`color-contrast` (serious×8)<br>`html-has-lang` (serious×1) | 3/3 | 1 |
| [/re-ownership](https://www.donovan.law/re-ownership) | T9 Practice/service | MEASURED | `color-contrast` (serious×22) | 3/3 | 1 |
| [/real-estate](https://www.donovan.law/real-estate) | T9 Practice/service | MEASURED | `color-contrast` (serious×14) | 3/3 | 1 |
| [/special-counsel](https://www.donovan.law/special-counsel) | T9 Practice/service | MEASURED | `color-contrast` (serious×12) | 3/3 | 1 |
| [/tax](https://www.donovan.law/tax) | T9 Practice/service | MEASURED | `color-contrast` (serious×14) | 3/3 | 1 |
| [/tax-compliance](https://www.donovan.law/tax-compliance) | T9 Practice/service | MEASURED | `color-contrast` (serious×14) | 3/3 | 1 |
| [/tax-controversy](https://www.donovan.law/tax-controversy) | T9 Practice/service | MEASURED | `color-contrast` (serious×11) | 3/3 | 1 |
| [/tax-planning](https://www.donovan.law/tax-planning) | T9 Practice/service | MEASURED | `color-contrast` (serious×16) | 3/3 | 1 |
| [/tefera](https://www.donovan.law/tefera) | T8 Attorney bio | MEASURED | `color-contrast` (serious×12) | 4/4 | 1 |
| [/testimonials](https://www.donovan.law/testimonials) | T10 Utility | MEASURED | `color-contrast` (serious×12) | 3/3 | 1 |
| [/tool-1031-exchange](https://www.donovan.law/tool-1031-exchange) | T5 Tool calculator | MEASURED | `color-contrast` (serious×35) | 3/3 | 1 |
| [/tool-capital-gains](https://www.donovan.law/tool-capital-gains) | T5 Tool calculator | MEASURED | `select-name` (critical×1)<br>`color-contrast` (serious×11) | 3/3 | 1 |
| [/tool-cost-segregation](https://www.donovan.law/tool-cost-segregation) | T5 Tool calculator | MEASURED | `color-contrast` (serious×17) | 3/3 | 1 |
| [/tool-deal-builder-preview](https://www.donovan.law/tool-deal-builder-preview) | T5 Tool calculator | MEASURED | `color-contrast` (serious×14) | 3/3 | 1 |
| [/tool-firpta-withholding](https://www.donovan.law/tool-firpta-withholding) | T5 Tool calculator | MEASURED | `color-contrast` (serious×12) | 3/3 | 1 |
| [/tool-irs-notice-guide](https://www.donovan.law/tool-irs-notice-guide) | T5 Tool calculator | MEASURED | `color-contrast` (serious×22) | 3/3 | 1 |
| [/tool-oic-rcp-estimator](https://www.donovan.law/tool-oic-rcp-estimator) | T5 Tool calculator | MEASURED | `color-contrast` (serious×14) | 3/3 | 1 |
| [/tool-rental-real-estate-tax-strategy-analyzer](https://www.donovan.law/tool-rental-real-estate-tax-strategy-analyzer) | T5 Tool calculator | MEASURED | `color-contrast` (serious×27) | 3/3 | 1 |
| [/tools](https://www.donovan.law/tools) | T6 Tools index | MEASURED | `color-contrast` (serious×109) | 3/3 | 1 |
| [/wendy](https://www.donovan.law/wendy) | T8 Attorney bio | MEASURED | `color-contrast` (serious×12) | 4/4 | 1 |

## 4. Image alt-text coverage (Task 3)

| Metric | Count |
| --- | --- |
| `<img>` elements across all 84 pages | 248 |
| With an `alt` attribute present | **248 / 248** |
| — non-empty `alt` (informative) | 164 |
| — empty `alt=""` (declared decorative) | 84 |
| **Missing `alt` attribute entirely** | **0** |
| Decorative-vs-informative ambiguities flagged | 84 |

### Ambiguities flagged (not guessed)

- **84 page(s)** — `Paula.jpg` declared decorative (`alt=""`), but: sole content of its container at 86x86 with no adjacent text — nothing else conveys what it shows.
  - **Not adjudicated here.** Whether this is a defect depends on editorial intent, which markup alone cannot settle. If the image is meant to convey who the person is, it needs a descriptive `alt`; if it is pure ornament beside text that already names them, `alt=""` is correct. Flagged for a human decision.

### Blog image alt text (called out in the order as unverified)

- Across the 41 blog pages, **114 `<img>` elements, 0 missing an `alt` attribute** — raster blog images are covered.
- **However**, the substantive blog figures are not `<img>` at all — they are **inline `<svg role="img">` diagrams**, and **26 blog pages** carry one with **no accessible name** (`svg-img-alt`, serious, WCAG 1.1.1). An `<img>`-only alt audit reports these pages as clean; they are not. This is the answer to "blog image alt text is unverified": the raster alt text is fine, the diagram alt text is missing.

## 5. Keyboard reachability & visible focus (Task 4)

Real `Tab` keypresses (never scripted `.focus()`, which can satisfy `:focus-visible` where a
real Tab would not). One representative page per template family; tab order walked to
natural wrap-around (cap 150, not reached on any page).

| Template | Representative | Tab stops | Controls without visible focus | Verdict |
| --- | --- | --- | --- | --- |
| T1 Home | [/](https://www.donovan.law/) | 34 | 0 | pass |
| T2 Blog index | [/blog](https://www.donovan.law/blog) | 107 | 0 | pass |
| T3 Blog article | [/blog-irs-levy](https://www.donovan.law/blog-irs-levy) | 30 | 0 | pass |
| T4 Legacy practice accordion | [/litigation](https://www.donovan.law/litigation) | 28 | 0 | pass |
| T5 Tool calculator | [/tool-capital-gains](https://www.donovan.law/tool-capital-gains) | 20 | 0 | pass |
| T6 Tools index | [/tools](https://www.donovan.law/tools) | 114 | 0 | pass |
| T7 Membership | [/membership-gold](https://www.donovan.law/membership-gold) | 30 | 0 | pass |
| T8 Attorney bio | [/profile](https://www.donovan.law/profile) | 27 | 0 | pass |
| T9 Practice/service | [/tax-controversy](https://www.donovan.law/tax-controversy) | 25 | 0 | pass |
| T10 Utility/contact form | [/contact](https://www.donovan.law/contact) | 38 | 7 | **FAIL** — WCAG 2.4.7 |

All 453 tab stops across the 10 representatives were reachable — **no keyboard traps and no unreachable primary control was observed.**

## 6. Reconciliation with Elroy's homepage finding

The order requires that Elroy's machine-verified homepage colour-contrast failure either
appears in these results, or is explained precisely.

**It appears, and it reproduces.** On `/`, `color-contrast` (**serious**, WCAG 1.4.3 AA) fails on **21 nodes**.

Sample failing nodes on the homepage:

| Target selector | Failure |
| --- | --- |
| `.dl-ubar-cta` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 8.6pt (11.52px), font weight: normal). Expecte |
| `.dl-ubar-cta-full` | Element has insufficient color contrast of 3.55 (foreground color: #ffffff, background color: #169b62, font size: 8.6pt (11.52px), font weight: normal). Expecte |
| `.container > a:nth-child(1) > span:nth-child(1)` | Element has insufficient color contrast of 3.68 (foreground color: #0a5a37, background color: #c9a961, font size: 8.2pt (10.88px), font weight: bold). Expected  |
| `a:nth-child(1) > span:nth-child(3)` | Element has insufficient color contrast of 3.68 (foreground color: #c9a961, background color: #0a5a37, font size: 10.6pt (14.08px), font weight: bold). Expected |
| `.container > a:nth-child(3) > span:nth-child(1)` | Element has insufficient color contrast of 3.68 (foreground color: #0a5a37, background color: #c9a961, font size: 8.2pt (10.88px), font weight: bold). Expected  |

**The material correction to Elroy's report is scope, not existence.** Elroy measured the
homepage only and reported "one" colour-contrast failure. Measured across the full sitemap,
`color-contrast` fails on **84 of 84 pages (1537 nodes)** — it is
not a homepage defect, it is a site-wide theme defect that happens to be visible on the
homepage. Fixing the homepage alone would leave the other
83 pages failing.

## 7. Method, corrections, and limits of this measurement

### Measurement bugs found and corrected mid-sweep

Recording these because each produced *wrong* results before it was caught, and each
would otherwise have shipped as a confident finding:

1. **CSP blocked script injection.** The live site sends a strict `script-src` with a
   per-response nonce, so Playwright's `addScriptTag()` (a real inline `<script>`) is
   refused and every page came back UNMEASURED. Fixed by injecting axe through
   `page.evaluate()` (CDP `Runtime.evaluate`), which is not subject to page CSP. **CSP was
   deliberately left enforced** — `bypassCSP` would let otherwise-blocked scripts run and
   change the very DOM being measured.
2. **A false "no focus indicator" on 6 templates.** The Perch concierge launcher
   (`#dvn-perch-launcher`) paints its focus ring on a *descendant* (`div.disc`), so an
   element-only style diff called it a defect. It also runs a continuous `perch-pulse`
   animation, so two *unfocused* screenshots of it already differ — pixel-diffing it
   "proved" a change that was just the animation. Fixed by diffing the whole subtree plus
   pseudo-elements, freezing animations via CDP `Animation.setPlaybackRate(0)`, and
   asserting an unfocused-vs-unfocused self-check before trusting any pixel comparison.
   **The launcher is not a defect** and is not reported as one.
3. **Scanning pages 4-up made colour-contrast nondeterministic.** Run concurrently, axe
   reported 8 nav-link contrast failures per page at ratio 1.07 (`#edede8` on `#f5f5f0`).
   Run serially, those nodes vanish, and every `.nav-link` computes to solid black and
   stays black for the life of the page. They were a transient mid-load paint that axe
   happened to sample under CPU contention. The sweep is now **serial by default** and
   runs axe **twice per page**, reporting only nodes that reproduce in both passes.
4. **Scroll-gated content was being missed entirely.** Card grids on `/blog` and `/tools`
   only render as they enter the viewport, so measuring straight after load skipped them —
   `/blog` reported 5 contrast nodes when the settled page has 92. The sweep now walks the
   full page height to trigger reveal, returns to the top, and settles before measuring.
   **Bugs 3 and 4 pushed the count in opposite directions**, which is precisely why the
   two-pass agreement check is in the harness rather than a single trusted run.

In the reported run, **0 node(s)** failed the two-pass agreement check and were
quarantined as UNSTABLE rather than counted. They are retained in `results.json` under
`unstable` for inspection.

### Observation — transient low-contrast nav on first paint (MANUAL, not counted)

Worth a look independently of this sweep: the nav-link nodes above were real *readings*,
just not steady-state ones. Something paints the primary nav at `#edede8` on `#f5f5f0`
(ratio **1.07**, effectively invisible) before it settles to black. On a fast connection
nobody sees it; on a slow one it may be visible long enough to matter. **Not counted as a
defect** — it did not reproduce in the settled state — but flagged so it is not lost.

### UNVERIFIED — explicitly not claimed

| Item | Why it is unverified |
| --- | --- |
| Keyboard/focus on the 74 pages outside the 10 representatives | Task 4 scope was one representative per template family. Templates are shared, so the result is *indicative* for the family, not measured per page. |
| Whether the `alt=""` concierge headshot is a real defect | Depends on editorial intent, which markup cannot settle. Flagged, not adjudicated. |
| Screen-reader announcement quality | No AT was driven. axe checks name *presence*, not whether the name is *useful*. |
| Contrast of text over background images / gradients | axe samples a computed background colour and reports `incomplete` where it cannot resolve one; those are not counted as violations here. |
| CSS `background-image` content | The alt inventory covers `<img>` and inline `<svg role="img">` only. Informative CSS backgrounds, if any, were not audited. |
| Zoom / reflow / orientation (WCAG 1.4.10) | Single 1280×900 viewport. Not measured. |

## Appendix A — pinned URL list (84)

Fetched live from the sitemap at scan time; this is the exact list scanned.

| # | URL | Template |
| --- | --- | --- |
| 1 | https://www.donovan.law/ | T1 Home |
| 2 | https://www.donovan.law/blog | T2 Blog index |
| 3 | https://www.donovan.law/blog-461l-excess-business-loss-and-172-nol | T3 Blog article |
| 4 | https://www.donovan.law/blog-augusta-rule-280a-g | T3 Blog article |
| 5 | https://www.donovan.law/blog-bramblett-phelan-two-entity-structure | T3 Blog article |
| 6 | https://www.donovan.law/blog-character-amount-timing | T3 Blog article |
| 7 | https://www.donovan.law/blog-civil-fraud-eggshell-audit | T3 Blog article |
| 8 | https://www.donovan.law/blog-conservation-easement-settlement | T3 Blog article |
| 9 | https://www.donovan.law/blog-controversy-roadmap-0-overview | T3 Blog article |
| 10 | https://www.donovan.law/blog-controversy-roadmap-1-processing-assessment | T3 Blog article |
| 11 | https://www.donovan.law/blog-controversy-roadmap-2-exam | T3 Blog article |
| 12 | https://www.donovan.law/blog-controversy-roadmap-3-exam-alternatives | T3 Blog article |
| 13 | https://www.donovan.law/blog-controversy-roadmap-4-appeals | T3 Blog article |
| 14 | https://www.donovan.law/blog-controversy-roadmap-5-collection | T3 Blog article |
| 15 | https://www.donovan.law/blog-controversy-roadmap-6-collection-alternatives | T3 Blog article |
| 16 | https://www.donovan.law/blog-controversy-roadmap-7-litigation | T3 Blog article |
| 17 | https://www.donovan.law/blog-criminal-tax-overview | T3 Blog article |
| 18 | https://www.donovan.law/blog-currently-not-collectible-csed | T3 Blog article |
| 19 | https://www.donovan.law/blog-fbar-foreign-account-penalties | T3 Blog article |
| 20 | https://www.donovan.law/blog-firpta-foreign-sellers | T3 Blog article |
| 21 | https://www.donovan.law/blog-foreclose-federal-tax-lien-suit | T3 Blog article |
| 22 | https://www.donovan.law/blog-irs-audit-notice-what-to-do | T3 Blog article |
| 23 | https://www.donovan.law/blog-irs-co-owned-marital-real-estate | T3 Blog article |
| 24 | https://www.donovan.law/blog-irs-levy | T3 Blog article |
| 25 | https://www.donovan.law/blog-irs-summons | T3 Blog article |
| 26 | https://www.donovan.law/blog-jeopardy-termination-assessments | T3 Blog article |
| 27 | https://www.donovan.law/blog-kwong-covid-deadlines | T3 Blog article |
| 28 | https://www.donovan.law/blog-material-participation-seven-tests | T3 Blog article |
| 29 | https://www.donovan.law/blog-notice-of-federal-tax-lien | T3 Blog article |
| 30 | https://www.donovan.law/blog-partnership-agreement-tax-document | T3 Blog article |
| 31 | https://www.donovan.law/blog-passport-revocation-tax-debt | T3 Blog article |
| 32 | https://www.donovan.law/blog-penalty-regime-6751b | T3 Blog article |
| 33 | https://www.donovan.law/blog-per-se-passive-rule-exceptions | T3 Blog article |
| 34 | https://www.donovan.law/blog-real-estate-professional-status-reps | T3 Blog article |
| 35 | https://www.donovan.law/blog-short-term-rental-material-participation | T3 Blog article |
| 36 | https://www.donovan.law/blog-short-term-rental-play | T3 Blog article |
| 37 | https://www.donovan.law/blog-subdivision-basis-allocation | T3 Blog article |
| 38 | https://www.donovan.law/blog-substitute-for-return | T3 Blog article |
| 39 | https://www.donovan.law/blog-tax-opinions | T3 Blog article |
| 40 | https://www.donovan.law/blog-tenancy-by-entirety-federal-tax-lien | T3 Blog article |
| 41 | https://www.donovan.law/blog-transferee-nominee-alter-ego | T3 Blog article |
| 42 | https://www.donovan.law/blog-trust-fund-recovery-penalty | T3 Blog article |
| 43 | https://www.donovan.law/business-law | T4 Legacy practice accordion |
| 44 | https://www.donovan.law/contact | T10 Utility |
| 45 | https://www.donovan.law/contracts | T4 Legacy practice accordion |
| 46 | https://www.donovan.law/development | T4 Legacy practice accordion |
| 47 | https://www.donovan.law/disclaimer | T10 Utility |
| 48 | https://www.donovan.law/eminent-domain | T4 Legacy practice accordion |
| 49 | https://www.donovan.law/engagement | T10 Utility |
| 50 | https://www.donovan.law/entity-formation | T4 Legacy practice accordion |
| 51 | https://www.donovan.law/experience | T10 Utility |
| 52 | https://www.donovan.law/leasing | T4 Legacy practice accordion |
| 53 | https://www.donovan.law/leidy | T8 Attorney bio |
| 54 | https://www.donovan.law/litigation | T4 Legacy practice accordion |
| 55 | https://www.donovan.law/membership-diamond | T7 Membership |
| 56 | https://www.donovan.law/membership-gold | T7 Membership |
| 57 | https://www.donovan.law/membership-platinum | T7 Membership |
| 58 | https://www.donovan.law/membership-reserve | T7 Membership |
| 59 | https://www.donovan.law/ourfirm | T10 Utility |
| 60 | https://www.donovan.law/practice | T9 Practice/service |
| 61 | https://www.donovan.law/profile | T8 Attorney bio |
| 62 | https://www.donovan.law/property-acquisition | T4 Legacy practice accordion |
| 63 | https://www.donovan.law/re-acquisition | T9 Practice/service |
| 64 | https://www.donovan.law/re-disposition | T9 Practice/service |
| 65 | https://www.donovan.law/re-financing | T4 Legacy practice accordion |
| 66 | https://www.donovan.law/re-ownership | T9 Practice/service |
| 67 | https://www.donovan.law/real-estate | T9 Practice/service |
| 68 | https://www.donovan.law/special-counsel | T9 Practice/service |
| 69 | https://www.donovan.law/tax | T9 Practice/service |
| 70 | https://www.donovan.law/tax-compliance | T9 Practice/service |
| 71 | https://www.donovan.law/tax-controversy | T9 Practice/service |
| 72 | https://www.donovan.law/tax-planning | T9 Practice/service |
| 73 | https://www.donovan.law/tefera | T8 Attorney bio |
| 74 | https://www.donovan.law/testimonials | T10 Utility |
| 75 | https://www.donovan.law/tool-1031-exchange | T5 Tool calculator |
| 76 | https://www.donovan.law/tool-capital-gains | T5 Tool calculator |
| 77 | https://www.donovan.law/tool-cost-segregation | T5 Tool calculator |
| 78 | https://www.donovan.law/tool-deal-builder-preview | T5 Tool calculator |
| 79 | https://www.donovan.law/tool-firpta-withholding | T5 Tool calculator |
| 80 | https://www.donovan.law/tool-irs-notice-guide | T5 Tool calculator |
| 81 | https://www.donovan.law/tool-oic-rcp-estimator | T5 Tool calculator |
| 82 | https://www.donovan.law/tool-rental-real-estate-tax-strategy-analyzer | T5 Tool calculator |
| 83 | https://www.donovan.law/tools | T6 Tools index |
| 84 | https://www.donovan.law/wendy | T8 Attorney bio |

---

**Agents do not merge.** Zane gates, David merges.
