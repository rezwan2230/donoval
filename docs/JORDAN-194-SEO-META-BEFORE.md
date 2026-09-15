# JORDAN — SEO metadata length audit (BEFORE)

Order JORDAN-194-SEO-META-R1 · issue #194 · generated from `donovan-legal-site/sitemap.xml`

Lengths are **characters, not bytes**, and each field is measured twice:

- **rendered** — after HTML entity decoding, i.e. what a SERP actually displays.
- **source** — as spelled in the file, where `&amp;` costs 5. This is the stricter count and the
  one Elroy reported; it is what makes the title census come out at 59 rather than 57.

The **len** column is `max(rendered, source)`, so a page passes only under both readings.
Extraction uses parse5, a real HTML parser — a regex sweep over HTML would be a measurement bug.

| pages | titles > 60 | descriptions > 160 | missing title | missing description |
| --- | --- | --- | --- | --- |
| 84 | 59 | 79 | 0 | 0 |

Longest title: 139 · longest description: 570

Bold = over the limit.

| # | URL | file | title len | desc len |
| ---: | --- | --- | ---: | ---: |
| 1 | `/` | `home.html` | **86** | **273** |
| 2 | `/blog` | `blog.html` | 47 | **207** |
| 3 | `/blog-461l-excess-business-loss-and-172-nol` | `blog-461l-excess-business-loss-and-172-nol.html` | **117** | **338** |
| 4 | `/blog-augusta-rule-280a-g` | `blog-augusta-rule-280a-g.html` | **87** | **253** |
| 5 | `/blog-bramblett-phelan-two-entity-structure` | `blog-bramblett-phelan-two-entity-structure.html` | **80** | **249** |
| 6 | `/blog-character-amount-timing` | `blog-character-amount-timing.html` | **91** | **201** |
| 7 | `/blog-civil-fraud-eggshell-audit` | `blog-civil-fraud-eggshell-audit.html` | **95** | **290** |
| 8 | `/blog-conservation-easement-settlement` | `blog-conservation-easement-settlement.html` | **131** | **443** |
| 9 | `/blog-controversy-roadmap-0-overview` | `blog-controversy-roadmap-0-overview.html` | 54 | **197** |
| 10 | `/blog-controversy-roadmap-1-processing-assessment` | `blog-controversy-roadmap-1-processing-assessment.html` | **84** | **221** |
| 11 | `/blog-controversy-roadmap-2-exam` | `blog-controversy-roadmap-2-exam.html` | **65** | **258** |
| 12 | `/blog-controversy-roadmap-3-exam-alternatives` | `blog-controversy-roadmap-3-exam-alternatives.html` | **66** | **283** |
| 13 | `/blog-controversy-roadmap-4-appeals` | `blog-controversy-roadmap-4-appeals.html` | **67** | **252** |
| 14 | `/blog-controversy-roadmap-5-collection` | `blog-controversy-roadmap-5-collection.html` | **71** | **249** |
| 15 | `/blog-controversy-roadmap-6-collection-alternatives` | `blog-controversy-roadmap-6-collection-alternatives.html` | **72** | **275** |
| 16 | `/blog-controversy-roadmap-7-litigation` | `blog-controversy-roadmap-7-litigation.html` | **71** | **319** |
| 17 | `/blog-criminal-tax-overview` | `blog-criminal-tax-overview.html` | **107** | **311** |
| 18 | `/blog-currently-not-collectible-csed` | `blog-currently-not-collectible-csed.html` | **115** | **300** |
| 19 | `/blog-fbar-foreign-account-penalties` | `blog-fbar-foreign-account-penalties.html` | **127** | **328** |
| 20 | `/blog-firpta-foreign-sellers` | `blog-firpta-foreign-sellers.html` | **94** | **249** |
| 21 | `/blog-foreclose-federal-tax-lien-suit` | `blog-foreclose-federal-tax-lien-suit.html` | **102** | **287** |
| 22 | `/blog-irs-audit-notice-what-to-do` | `blog-irs-audit-notice-what-to-do.html` | **67** | **238** |
| 23 | `/blog-irs-co-owned-marital-real-estate` | `blog-irs-co-owned-marital-real-estate.html` | **91** | **307** |
| 24 | `/blog-irs-levy` | `blog-irs-levy.html` | **92** | **371** |
| 25 | `/blog-irs-summons` | `blog-irs-summons.html` | **104** | **315** |
| 26 | `/blog-jeopardy-termination-assessments` | `blog-jeopardy-termination-assessments.html` | **86** | **315** |
| 27 | `/blog-kwong-covid-deadlines` | `blog-kwong-covid-deadlines.html` | **125** | **410** |
| 28 | `/blog-material-participation-seven-tests` | `blog-material-participation-seven-tests.html` | **115** | **231** |
| 29 | `/blog-notice-of-federal-tax-lien` | `blog-notice-of-federal-tax-lien.html` | **114** | **294** |
| 30 | `/blog-partnership-agreement-tax-document` | `blog-partnership-agreement-tax-document.html` | **69** | **299** |
| 31 | `/blog-passport-revocation-tax-debt` | `blog-passport-revocation-tax-debt.html` | **125** | **287** |
| 32 | `/blog-penalty-regime-6751b` | `blog-penalty-regime-6751b.html` | **86** | **324** |
| 33 | `/blog-per-se-passive-rule-exceptions` | `blog-per-se-passive-rule-exceptions.html` | **96** | **243** |
| 34 | `/blog-real-estate-professional-status-reps` | `blog-real-estate-professional-status-reps.html` | **114** | **235** |
| 35 | `/blog-short-term-rental-material-participation` | `blog-short-term-rental-material-participation.html` | **139** | **282** |
| 36 | `/blog-short-term-rental-play` | `blog-short-term-rental-play.html` | **128** | **239** |
| 37 | `/blog-subdivision-basis-allocation` | `blog-subdivision-basis-allocation.html` | **103** | **273** |
| 38 | `/blog-substitute-for-return` | `blog-substitute-for-return.html` | **87** | **329** |
| 39 | `/blog-tax-opinions` | `blog-tax-opinions.html` | **106** | **445** |
| 40 | `/blog-tenancy-by-entirety-federal-tax-lien` | `blog-tenancy-by-entirety-federal-tax-lien.html` | **123** | **348** |
| 41 | `/blog-transferee-nominee-alter-ego` | `blog-transferee-nominee-alter-ego.html` | **103** | **296** |
| 42 | `/blog-trust-fund-recovery-penalty` | `blog-trust-fund-recovery-penalty.html` | **108** | **346** |
| 43 | `/business-law` | `business-law.html` | 33 | 139 |
| 44 | `/contact` | `contact.html` | **72** | 133 |
| 45 | `/contracts` | `contracts.html` | 39 | **194** |
| 46 | `/development` | `development.html` | 44 | **215** |
| 47 | `/disclaimer` | `disclaimer.html` | 31 | **191** |
| 48 | `/eminent-domain` | `eminent-domain.html` | 35 | **215** |
| 49 | `/engagement` | `engagement.html` | 37 | 158 |
| 50 | `/entity-formation` | `entity-formation.html` | **64** | **228** |
| 51 | `/experience` | `experience.html` | 47 | **285** |
| 52 | `/leasing` | `leasing.html` | 39 | **229** |
| 53 | `/leidy` | `leidy.html` | **94** | **276** |
| 54 | `/litigation` | `litigation.html` | 43 | **209** |
| 55 | `/membership-diamond` | `membership-diamond.html` | 39 | **209** |
| 56 | `/membership-gold` | `membership-gold.html` | 36 | **225** |
| 57 | `/membership-platinum` | `membership-platinum.html` | 40 | **198** |
| 58 | `/membership-reserve` | `membership-reserve.html` | 39 | **203** |
| 59 | `/ourfirm` | `ourfirm.html` | **73** | **257** |
| 60 | `/practice` | `practice.html` | **70** | **266** |
| 61 | `/profile` | `profile.html` | **61** | **281** |
| 62 | `/property-acquisition` | `property-acquisition.html` | 59 | **220** |
| 63 | `/re-acquisition` | `re-acquisition.html` | **109** | **268** |
| 64 | `/re-disposition` | `re-disposition.html` | **116** | **255** |
| 65 | `/re-financing` | `re-financing.html` | 42 | 134 |
| 66 | `/re-ownership` | `re-ownership.html` | **116** | **266** |
| 67 | `/real-estate` | `real-estate.html` | **75** | **274** |
| 68 | `/special-counsel` | `special-counsel.html` | **98** | **275** |
| 69 | `/tax` | `tax.html` | **65** | **265** |
| 70 | `/tax-compliance` | `tax-compliance.html` | **87** | **361** |
| 71 | `/tax-controversy` | `tax-controversy.html` | **66** | **274** |
| 72 | `/tax-planning` | `tax-planning.html` | **84** | **304** |
| 73 | `/tefera` | `tefera.html` | **81** | **202** |
| 74 | `/testimonials` | `testimonials.html` | 40 | **219** |
| 75 | `/tool-1031-exchange` | `tool-1031-exchange.html` | 57 | **490** |
| 76 | `/tool-capital-gains` | `tool-capital-gains.html` | 56 | 146 |
| 77 | `/tool-cost-segregation` | `tool-cost-segregation.html` | 55 | **544** |
| 78 | `/tool-deal-builder-preview` | `tool-deal-builder-preview.html` | **80** | **286** |
| 79 | `/tool-firpta-withholding` | `tool-firpta-withholding.html` | 50 | **232** |
| 80 | `/tool-irs-notice-guide` | `tool-irs-notice-guide.html` | 58 | **319** |
| 81 | `/tool-oic-rcp-estimator` | `tool-oic-rcp-estimator.html` | 59 | **314** |
| 82 | `/tool-rental-real-estate-tax-strategy-analyzer` | `tool-rental-real-estate-tax-strategy-analyzer.html` | **61** | **570** |
| 83 | `/tools` | `tools.html` | 54 | **266** |
| 84 | `/wendy` | `wendy.html` | **72** | **218** |
