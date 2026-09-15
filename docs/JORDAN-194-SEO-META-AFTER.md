# JORDAN — SEO metadata length audit (AFTER)

Order JORDAN-194-SEO-META-R1 · issue #194 · generated from `donovan-legal-site/sitemap.xml`

Lengths are **characters, not bytes**, and each field is measured twice:

- **rendered** — after HTML entity decoding, i.e. what a SERP actually displays.
- **source** — as spelled in the file, where `&amp;` costs 5. This is the stricter count and the
  one Elroy reported; it is what makes the title census come out at 59 rather than 57.

The **len** column is `max(rendered, source)`, so a page passes only under both readings.
Extraction uses parse5, a real HTML parser — a regex sweep over HTML would be a measurement bug.

| pages | titles > 60 | descriptions > 160 | missing title | missing description |
| --- | --- | --- | --- | --- |
| 84 | 0 | 0 | 0 | 0 |

Longest title: 60 · longest description: 158

Bold = over the limit.

| # | URL | file | title len | desc len |
| ---: | --- | --- | ---: | ---: |
| 1 | `/` | `home.html` | 51 | 147 |
| 2 | `/blog` | `blog.html` | 47 | 131 |
| 3 | `/blog-461l-excess-business-loss-and-172-nol` | `blog-461l-excess-business-loss-and-172-nol.html` | 57 | 129 |
| 4 | `/blog-augusta-rule-280a-g` | `blog-augusta-rule-280a-g.html` | 57 | 141 |
| 5 | `/blog-bramblett-phelan-two-entity-structure` | `blog-bramblett-phelan-two-entity-structure.html` | 57 | 144 |
| 6 | `/blog-character-amount-timing` | `blog-character-amount-timing.html` | 49 | 143 |
| 7 | `/blog-civil-fraud-eggshell-audit` | `blog-civil-fraud-eggshell-audit.html` | 59 | 146 |
| 8 | `/blog-conservation-easement-settlement` | `blog-conservation-easement-settlement.html` | 59 | 140 |
| 9 | `/blog-controversy-roadmap-0-overview` | `blog-controversy-roadmap-0-overview.html` | 54 | 144 |
| 10 | `/blog-controversy-roadmap-1-processing-assessment` | `blog-controversy-roadmap-1-processing-assessment.html` | 58 | 142 |
| 11 | `/blog-controversy-roadmap-2-exam` | `blog-controversy-roadmap-2-exam.html` | 49 | 144 |
| 12 | `/blog-controversy-roadmap-3-exam-alternatives` | `blog-controversy-roadmap-3-exam-alternatives.html` | 50 | 151 |
| 13 | `/blog-controversy-roadmap-4-appeals` | `blog-controversy-roadmap-4-appeals.html` | 51 | 148 |
| 14 | `/blog-controversy-roadmap-5-collection` | `blog-controversy-roadmap-5-collection.html` | 55 | 149 |
| 15 | `/blog-controversy-roadmap-6-collection-alternatives` | `blog-controversy-roadmap-6-collection-alternatives.html` | 56 | 146 |
| 16 | `/blog-controversy-roadmap-7-litigation` | `blog-controversy-roadmap-7-litigation.html` | 55 | 142 |
| 17 | `/blog-criminal-tax-overview` | `blog-criminal-tax-overview.html` | 56 | 156 |
| 18 | `/blog-currently-not-collectible-csed` | `blog-currently-not-collectible-csed.html` | 60 | 146 |
| 19 | `/blog-fbar-foreign-account-penalties` | `blog-fbar-foreign-account-penalties.html` | 58 | 152 |
| 20 | `/blog-firpta-foreign-sellers` | `blog-firpta-foreign-sellers.html` | 59 | 149 |
| 21 | `/blog-foreclose-federal-tax-lien-suit` | `blog-foreclose-federal-tax-lien-suit.html` | 56 | 153 |
| 22 | `/blog-irs-audit-notice-what-to-do` | `blog-irs-audit-notice-what-to-do.html` | 55 | 145 |
| 23 | `/blog-irs-co-owned-marital-real-estate` | `blog-irs-co-owned-marital-real-estate.html` | 58 | 148 |
| 24 | `/blog-irs-levy` | `blog-irs-levy.html` | 59 | 146 |
| 25 | `/blog-irs-summons` | `blog-irs-summons.html` | 56 | 146 |
| 26 | `/blog-jeopardy-termination-assessments` | `blog-jeopardy-termination-assessments.html` | 57 | 142 |
| 27 | `/blog-kwong-covid-deadlines` | `blog-kwong-covid-deadlines.html` | 54 | 146 |
| 28 | `/blog-material-participation-seven-tests` | `blog-material-participation-seven-tests.html` | 55 | 147 |
| 29 | `/blog-notice-of-federal-tax-lien` | `blog-notice-of-federal-tax-lien.html` | 56 | 136 |
| 30 | `/blog-partnership-agreement-tax-document` | `blog-partnership-agreement-tax-document.html` | 59 | 144 |
| 31 | `/blog-passport-revocation-tax-debt` | `blog-passport-revocation-tax-debt.html` | 55 | 143 |
| 32 | `/blog-penalty-regime-6751b` | `blog-penalty-regime-6751b.html` | 56 | 138 |
| 33 | `/blog-per-se-passive-rule-exceptions` | `blog-per-se-passive-rule-exceptions.html` | 57 | 143 |
| 34 | `/blog-real-estate-professional-status-reps` | `blog-real-estate-professional-status-reps.html` | 59 | 151 |
| 35 | `/blog-short-term-rental-material-participation` | `blog-short-term-rental-material-participation.html` | 56 | 144 |
| 36 | `/blog-short-term-rental-play` | `blog-short-term-rental-play.html` | 57 | 139 |
| 37 | `/blog-subdivision-basis-allocation` | `blog-subdivision-basis-allocation.html` | 55 | 143 |
| 38 | `/blog-substitute-for-return` | `blog-substitute-for-return.html` | 57 | 141 |
| 39 | `/blog-tax-opinions` | `blog-tax-opinions.html` | 59 | 149 |
| 40 | `/blog-tenancy-by-entirety-federal-tax-lien` | `blog-tenancy-by-entirety-federal-tax-lien.html` | 56 | 147 |
| 41 | `/blog-transferee-nominee-alter-ego` | `blog-transferee-nominee-alter-ego.html` | 59 | 138 |
| 42 | `/blog-trust-fund-recovery-penalty` | `blog-trust-fund-recovery-penalty.html` | 55 | 148 |
| 43 | `/business-law` | `business-law.html` | 33 | 139 |
| 44 | `/contact` | `contact.html` | 58 | 133 |
| 45 | `/contracts` | `contracts.html` | 39 | 142 |
| 46 | `/development` | `development.html` | 44 | 152 |
| 47 | `/disclaimer` | `disclaimer.html` | 31 | 139 |
| 48 | `/eminent-domain` | `eminent-domain.html` | 35 | 143 |
| 49 | `/engagement` | `engagement.html` | 37 | 158 |
| 50 | `/entity-formation` | `entity-formation.html` | 51 | 148 |
| 51 | `/experience` | `experience.html` | 47 | 148 |
| 52 | `/leasing` | `leasing.html` | 39 | 146 |
| 53 | `/leidy` | `leidy.html` | 58 | 146 |
| 54 | `/litigation` | `litigation.html` | 43 | 148 |
| 55 | `/membership-diamond` | `membership-diamond.html` | 39 | 147 |
| 56 | `/membership-gold` | `membership-gold.html` | 36 | 146 |
| 57 | `/membership-platinum` | `membership-platinum.html` | 40 | 146 |
| 58 | `/membership-reserve` | `membership-reserve.html` | 39 | 144 |
| 59 | `/ourfirm` | `ourfirm.html` | 57 | 148 |
| 60 | `/practice` | `practice.html` | 57 | 147 |
| 61 | `/profile` | `profile.html` | 58 | 146 |
| 62 | `/property-acquisition` | `property-acquisition.html` | 59 | 149 |
| 63 | `/re-acquisition` | `re-acquisition.html` | 52 | 134 |
| 64 | `/re-disposition` | `re-disposition.html` | 52 | 136 |
| 65 | `/re-financing` | `re-financing.html` | 42 | 134 |
| 66 | `/re-ownership` | `re-ownership.html` | 50 | 144 |
| 67 | `/real-estate` | `real-estate.html` | 56 | 149 |
| 68 | `/special-counsel` | `special-counsel.html` | 53 | 147 |
| 69 | `/tax` | `tax.html` | 56 | 149 |
| 70 | `/tax-compliance` | `tax-compliance.html` | 58 | 138 |
| 71 | `/tax-controversy` | `tax-controversy.html` | 59 | 144 |
| 72 | `/tax-planning` | `tax-planning.html` | 59 | 146 |
| 73 | `/tefera` | `tefera.html` | 56 | 145 |
| 74 | `/testimonials` | `testimonials.html` | 40 | 131 |
| 75 | `/tool-1031-exchange` | `tool-1031-exchange.html` | 57 | 150 |
| 76 | `/tool-capital-gains` | `tool-capital-gains.html` | 56 | 146 |
| 77 | `/tool-cost-segregation` | `tool-cost-segregation.html` | 55 | 147 |
| 78 | `/tool-deal-builder-preview` | `tool-deal-builder-preview.html` | 59 | 145 |
| 79 | `/tool-firpta-withholding` | `tool-firpta-withholding.html` | 50 | 151 |
| 80 | `/tool-irs-notice-guide` | `tool-irs-notice-guide.html` | 58 | 138 |
| 81 | `/tool-oic-rcp-estimator` | `tool-oic-rcp-estimator.html` | 59 | 146 |
| 82 | `/tool-rental-real-estate-tax-strategy-analyzer` | `tool-rental-real-estate-tax-strategy-analyzer.html` | 56 | 153 |
| 83 | `/tools` | `tools.html` | 54 | 144 |
| 84 | `/wendy` | `wendy.html` | 58 | 147 |

## Change census

| outcome | pages |
| --- | ---: |
| title and description both rewritten | 58 |
| description rewritten only (title was already compliant) | 21 |
| title rewritten only (description was already compliant) | 1 — `contact.html` |
| left untouched — already compliant on both fields | 4 |
| **total** | **84** |

The four already-compliant pages, left byte-for-byte unchanged:

| file | title len | desc len |
| --- | ---: | ---: |
| `business-law.html` | 33 | 139 |
| `engagement.html` | 37 | 158 |
| `re-financing.html` | 42 | 134 |
| `tool-capital-gains.html` | 56 | 146 |

## Which file is `/`

`/` is served by **`home.html`**, not `index.html`. The edge middleware rewrites it as a
200, so the URL is preserved while the bytes come from elsewhere;
`test/seo-crawlability.test.mjs` pins this as `servedFile('/', shellRetired = true) ===
'home.html'`. `index.html` is not served at all — `_redirects` 301s `/index.html` to `/`.

The two files carried a byte-identical title and description, so the census is 59/79 under
either mapping, but the tables above name `home.html` because that is the file a crawler
actually reads at `/`.

`index.html` still ships, and still had the same 86-character title. It was given the
identical rewrite — the 81st and last HTML file in the diff, and the only one that is not itself a
sitemap page. Leaving it would have parked a stale 86-character title one 301 away from the
homepage.

`perch.html`, the concierge shell that `_redirects` still rewrites `/` onto when the Perch
switch is off, carries `<meta name="robots" content="noindex">` and **no** description
element at all. None was invented for it: authoring markup that does not exist is outside
this order, and the page is noindex, so its metadata is not a SERP surface. Flagged for
whoever owns the shell.

## The homepage title

Before, at 86 characters, the title ran three claims in series and Google would have cut
the third:

    Donovan Legal PLLC | Tax-First Practice Focused on Real Estate | Delray Beach, Florida

After, at 51:

    Tax-First Real Estate Practice | Donovan Legal PLLC

The competition was firm name vs. practice focus vs. location, and location lost. A brand
search for "Donovan Legal" wins on the firm name whatever the title says; the segment that
has to earn a click from a stranger is the one that says what the firm *does*. Location is
the weakest of the three here because the firm's own description says clients are served
nationwide — Delray Beach is a fact about the office, not about the market. It is kept in
the homepage description, and `contact.html` and `ourfirm.html` still carry it, so nothing
local is lost from the page set.

Practice focus was moved ahead of the firm name for the same reason: it is the part a
scanning searcher needs first.

## `&amp;` was removed from every rewritten title

No rewritten title spells `&`. That keeps the rendered and source counts identical, so a
title cannot pass one reading of the limit and fail the other. Two already-compliant pages
still spell `&amp;` — `property-acquisition.html` (59) and `tool-irs-notice-guide.html`
(58) — and were left alone under Task 4, being inside the limit under both counts.

## How the diff was constrained

Edits were applied by splicing the exact source-offset ranges parse5 reports for the
`<title>` text node and for the value inside `content="..."` on `<meta name="description">`.
No other byte in any file could move.

This was then verified independently rather than asserted: for all 81 changed HTML files,
blanking those two ranges out leaves a document byte-identical to `origin/main` (line
endings normalised first, so CRLF is not misread as a change). The check was controlled by
injecting `<p>CONTROL</p>` before `</body>` in `tools.html` — it reddened, and named the
offset — so the pass is not vacuous.
