// ── SHELDON-PAUL-NAV (#227): the site navigation, injected at the edge ────────
//
// ── WHY THE NAV CANNOT BE CHANGED IN THE PAGES ───────────────────────────────
//
// `nav.menubar` is hand-authored and byte-duplicated across 113 HTML files, and
// it has already FORKED into three incompatible designs that all pass CI:
//
//   A  92 pages   HOME · ABOUT · PRACTICE · EXPERIENCE · TESTIMONIALS ·
//                 RESOURCES · MEMBERS · CONTACT          (31 divs)
//   B  18 pages   Home · THE FIRM · THE PRACTICE · Clients · Contact   (25 divs)
//                 — and its "Clients" item points at `login.html`, which has not
//                 existed in this repo for as long as git remembers.
//   C   2 pages   HOME · ABOUT · PRACTICE · EXPERIENCE · TESTIMONIALS ·
//                 TOOLS · CONTACT, no mobile overlay at all          (5 divs)
//
// Editing them in place is refused by `test/chrome-diff.test.mjs` rule
// `site-navigation`, which compares the `nav.menubar` subtree of every changed
// page against `origin/main` and has NO waiver — `REVIEWED_STRUCTURAL` covers
// `page-structure` only, and the rule is named in that list's own "not waivable"
// note. Jordan established that on #227 before this order was written. There is
// no version of a per-page nav edit that reaches `main`.
//
// So the nav moves to where the layer, the router, the utility bar and the
// footer compliance line already live: one HTMLRewriter handler in the edge
// middleware, zero page edits. The fork collapses as a side effect — one
// definition is served to all three variants, so B's dead `login.html` link and
// C's missing mobile menu stop existing without either page being touched.
//
// ── THE ORDINAL HAZARD, AND WHY THIS IS SAFE (TASK 1 PRECONDITION) ───────────
//
// `_lib/perch-main.js` places `<main id="perch-main">` using a plan written in
// `</div>` ORDINALS — on a variant A page, "open after the 31st `</div>`, close
// before the 80th". The site nav sits INSIDE the div whose end tag is that
// opening ordinal, and this module replaces the nav's entire subtree. Naively
// that moves every ordinal after it, and a plan applied one `</div>` late puts
// `<main>` around the wrong region while the page still renders perfectly. That
// is precisely the silent failure CLAUDE.md §4 warns about.
//
// It is safe here because of WHERE this runs, and only because of that:
//
//   • `_middleware.js` buffers the body and computes the plan in pass 1 over the
//     ORIGINAL bytes. Pass 1 never sees a rewritten nav, so the plan cannot move.
//   • This module composes into the SAME pass 2 as the container, and lol-html
//     neither suppresses handlers for content replaced by `setInnerContent` nor
//     re-feeds injected content through them. So pass 2's `</div>` counter visits
//     exactly the end tags pass 1 numbered — the 31 divs inside the old nav still
//     fire their `onEndTag` even though their bytes are discarded, and the divs
//     in the replacement never fire one.
//
// Both halves are measured against the real engine on a page from each variant
// and on a no-nav fragment, with a control that proves the harness can see a
// one-ordinal shift, by `scripts/nav/plan-invariance.mjs` — and again as a test
// in `test/nav-inject.test.mjs`. If this module is ever moved into a pass of its
// own, ahead of `planFromHtml`, that safety evaporates: the same harness reports
// the plan moving by (new nav divs − old nav divs) on every variant A and B page.
//
// ── WHY ROOT-ABSOLUTE HREFS ──────────────────────────────────────────────────
//
// Nine of the 113 nav-bearing pages live one directory down (`members/`,
// `gold/`, `platinum/`, `diamond/`, `reserve/`) and author their nav with `../`.
// One shared definition cannot carry two relative spellings, so every href here
// is root-absolute. That is also the only spelling that satisfies the order's
// "hrefs resolve to tier roots": `gold/` served from `/members/about-membership.html`
// resolves to `/members/gold/`, which is not a tier root and which
// `js/members-gate.js` — which resolves rather than string-matches, deliberately —
// would correctly decline to intercept.
//
// ── WHY THE IDS ARE SCANNED AND NOT HARDCODED ────────────────────────────────
//
// The mobile groups need `id`s for `data-target`/`aria-controls` to point at.
// The old markup used `#menu1`…`#menu4` and `#m2-tax`, which is a name any page
// author could reasonably use for their own accordion — and a duplicate id makes
// Bootstrap's collapse toggle the wrong panel, silently. `navScan` reads the ids
// the document already carries and `idPrefix` picks a prefix that collides with
// none of them, so the collapse ids are unique per page by construction rather
// than by hoping.
//
// The five ids `js/main.js` binds BY NAME — `theFirm`, `btn-tf`, `fa-tf`,
// `btn-tp`, `fa-tp` — are exempt from that and emitted verbatim, because a
// prefixed `#dlnav-btn-tf` is an id no handler is listening for. They are the
// contract, not a naming choice. `#thePractice` is deliberately NOT emitted; see
// the note on MOBILE below.

/** Kept in one place so the CI suite can assert on what actually gets injected. */
export const NAV_STYLESHEET = '/css/dl-nav.css';
export const NAV_STYLESHEET_TAG = `<link rel="stylesheet" href="${NAV_STYLESHEET}">`;

/** The element whose subtree is replaced. Same selector `_lib/perch-main.js`
 *  keys the plan off, and for the same reason: the tool pages carry in-content
 *  sidebar navs (`.oa-nav`, `.struct-nav`) which are page content, not chrome. */
export const SITE_NAV_SELECTOR = 'nav.menubar';

/** Marks a served nav. Present only in the injected markup, so it doubles as the
 *  "this document has already been rewritten" guard and as the handle the
 *  served-nav assertion in test/chrome-diff.test.mjs looks the nav up by. */
export const SERVED_MARKER_CLASS = 'dl-nav-served';

/** Ids `js/main.js` binds by name. Emitted verbatim; never prefixed. */
export const BOUND_IDS = ['theFirm', 'btn-tf', 'fa-tf', 'btn-tp', 'fa-tp'];

/** Classes `js/main.js` and `css/main.css` bind. Asserted present by the suite. */
export const BOUND_CLASSES = [
  'hamburger', 'btn-close', 'menu', 'nav-mobile-overlay', 'dropdown', 'dropdown-menu',
];

// ── THE INFORMATION ARCHITECTURE ─────────────────────────────────────────────
//
// Nine top-level items, in this order. Expressed as data rather than as one
// string so the served-nav assertion can be driven from the same table the
// markup is — while still asserting against the RENDERED document, never against
// this file's spelling.

/** The four tier links, verbatim from the shipped MEMBERS dropdown.
 *  `js/members-gate.js` finds a tier two ways and BOTH are preserved here: the
 *  href resolved to a tier root (primary) and the `.brand-<tier>` span inside the
 *  anchor (its documented fallback). RESERVE keeps its nested `<span class="re">`,
 *  which is what the brand lettering is drawn from. */
export const TIER_LINKS = [
  { href: '/gold/', html: '<span class="brand-gold">GOLD</span>' },
  { href: '/platinum/', html: '<span class="brand-platinum">PLATINUM</span>' },
  { href: '/diamond/', html: '<span class="brand-diamond">DIAMOND</span>' },
  { href: '/reserve/', html: '<span class="brand-reserve"><span class="re">RE</span>SERVE</span>' },
];

/**
 * The nine top-level items.
 *
 * `key` is the id stem for the dropdown and its mobile collapse panel. `href` is
 * the item's own destination — every dropdown parent is itself a link, which is
 * how `practice.html` and the four tier roots keep an inbound link in the served
 * page (they have none anywhere else on the site; dropping either from here
 * orphans a live page without reding anything).
 */
export const TOP_LEVEL = [
  { key: 'home', label: 'HOME', href: '/index.html' },
  {
    key: 'about',
    label: 'ABOUT',
    href: '/ourfirm.html',
    boundLabelId: 'theFirm',
    boundToggleId: 'btn-tf',
    boundIconId: 'fa-tf',
    items: [
      { href: '/ourfirm.html', label: 'THE FIRM' },
      // The order's "Practice Overview under ABOUT". `practice.html` is in the
      // sitemap and `nav.menubar` is its ONLY inbound link anywhere on the site.
      { href: '/practice.html', label: 'PRACTICE OVERVIEW' },
      { href: '/profile.html', label: 'PAUL DONOVAN, JD, CPA, CCM' },
      { href: '/wendy.html', label: 'WENDY CARDENAS' },
      { href: '/leidy.html', label: 'LEIDY MEZA' },
      { href: '/experience.html', label: 'EXPERIENCE' },
      { href: '/testimonials.html', label: 'TESTIMONIALS' },
      { href: '/engagement.html', label: 'HOW WE ENGAGE' },
      {
        key: 'advisors',
        href: '/tefera.html',
        label: 'STRATEGIC ADVISORS',
        items: [
          { href: '/tefera.html', label: 'DR. TEFERA BEYENE, PhD, CPA' },
          { href: '/liana.html', label: 'LIANA CAJADO' },
        ],
      },
    ],
  },
  {
    key: 'tax',
    label: 'TAX',
    href: '/tax.html',
    boundToggleId: 'btn-tp',
    boundIconId: 'fa-tp',
    // ── SHELDON-NAV-R2: FOUR first-level entries, not nineteen ────────────────
    //
    // #227 shipped the tax-controversy pages FLAT beside the three tax practice
    // pages, on the reading that Paul's prose described a flat list and only his
    // unshipped `navfix.py` described a flyout. Paul has now looked at the served
    // menu and asked for the flyout: TAX opens on four entries, and the fifteen
    // controversy pages sit behind CONTROVERSY.
    //
    // A nested `items` array is what makes an entry a group. Nothing else about
    // the item changes — CONTROVERSY is still a LINK to `/tax-controversy.html`,
    // exactly as every dropdown parent on this bar is, so the overview page keeps
    // an inbound link in the served markup whether or not the group is ever
    // opened.
    items: [
      { href: '/tax.html', label: 'Tax Overview' },
      { href: '/tax-planning.html', label: 'Planning' },
      { href: '/tax-compliance.html', label: 'Compliance' },
      {
        key: 'controversy',
        href: '/tax-controversy.html',
        label: 'CONTROVERSY',
        // The three STATE pages close the list, in the order R2 corrects them to:
        // Florida, then Massachusetts, then Residency & Domicile. #227 shipped
        // Residency first, which put the domicile page above the two named-state
        // pages it is the general case of.
        items: [
          { href: '/tax-controversy.html', label: 'Controversy Overview' },
          { href: '/irs-notice.html', label: 'IRS Notices &amp; Assessments' },
          { href: '/irs-audit-defense.html', label: 'IRS Audit Defense' },
          { href: '/audit-reconsideration.html', label: 'Audit Reconsideration' },
          { href: '/irs-appeals.html', label: 'IRS Appeals' },
          { href: '/tax-court.html', label: 'U.S. Tax Court' },
          { href: '/irs-liens-levies.html', label: 'Liens &amp; Levies' },
          { href: '/tax-debt-resolution.html', label: 'Tax Debt Resolution' },
          { href: '/tax-penalties.html', label: 'Penalties &amp; Abatement' },
          { href: '/unfiled-returns.html', label: 'Unfiled Returns &amp; Non-Filers' },
          { href: '/voluntary-disclosure.html', label: 'Foreign Accounts &amp; Voluntary Disclosure' },
          { href: '/partnership-audits.html', label: 'Partnership Audits (BBA)' },
          { href: '/florida-sales-tax-audit.html', label: 'Florida Sales &amp; Use Tax' },
          { href: '/massachusetts-tax-appeal.html', label: 'Massachusetts Tax Appeals' },
          { href: '/residency-audit.html', label: 'Residency &amp; Domicile' },
        ],
      },
    ],
  },
  {
    key: 'realestate',
    label: 'REAL ESTATE',
    href: '/real-estate.html',
    items: [
      { href: '/real-estate.html', label: 'Real Estate Overview' },
      { href: '/re-acquisition.html', label: 'Acquisition' },
      { href: '/re-ownership.html', label: 'Ownership' },
      { href: '/re-disposition.html', label: 'Disposition' },
    ],
  },
  {
    key: 'specialcounsel',
    label: 'SPECIAL COUNSEL',
    href: '/special-counsel.html',
    // ── Two second-level groups, same shape as TAX > CONTROVERSY ──────────────
    //
    // The divorce practice now has nine pages of its own and is the firm's lead
    // Special Counsel offering, so it gets a named group rather than a single
    // anchor into `special-counsel.html`. The other three engagement types keep
    // their anchors on that page and sit behind ADDITIONAL PRACTICE AREAS.
    //
    // Both group heads are LINKS as well as toggles, exactly as CONTROVERSY is,
    // so `divorce-special-counsel.html` and `special-counsel.html` each keep an
    // inbound link in the served markup whether or not the group is opened. That
    // matters: `special-counsel.html` is in the sitemap and the served nav is one
    // of its inbound links.
    items: [
      { href: '/special-counsel.html', label: 'Special Counsel Overview' },
      {
        key: 'hnwdivorce',
        href: '/divorce-special-counsel.html',
        label: 'HIGH NET WORTH DIVORCE',
        items: [
          { href: '/divorce-special-counsel.html', label: 'Divorce Special Counsel Overview' },
          { href: '/divorce-tax-counsel.html', label: 'For Divorcing Spouses: Your Lawyer Said Consult Tax Counsel' },
          { href: '/divorce-tax-gap.html', label: 'The Tax Gap in Divorce' },
          { href: '/divorce-legal-fee-basis.html', label: 'Legal Fees &amp; Asset Basis' },
          { href: '/divorce-tax-claims.html', label: 'Testing Tax Claims Across the Table' },
          { href: '/divorce-asset-tax-values.html', label: 'After-Tax Value of Marital Assets' },
          { href: '/divorce-international-assets.html', label: 'International Assets' },
          { href: '/divorce-business-interests.html', label: 'Business &amp; Entity Interests' },
          { href: '/divorce-retirement-assets.html', label: 'Retirement &amp; Deferred Compensation' },
          { href: '/divorce-joint-return-liability.html', label: 'Joint Returns &amp; Innocent Spouse' },
          { href: '/divorce-for-family-lawyers.html', label: 'For Family Law Attorneys' },
        ],
      },
      {
        key: 'additional',
        href: '/special-counsel.html',
        label: 'ADDITIONAL PRACTICE AREAS',
        items: [
          { href: '/special-counsel.html#estate-trust', label: 'Estate, Trust &amp; Probate Disputes' },
          { href: '/special-counsel.html#business-divorce', label: 'Business Divorce' },
          { href: '/special-counsel.html#litigation-damages', label: 'Litigation Damages &amp; Settlement Tax' },
        ],
      },
    ],
  },
  {
    // 2026-09-05 (Paul): sixteen tools is too many for one list. A top-level
    // TOOLS menu names every tool so a visitor lands on it directly, grouped the
    // way /tools is grouped. Same nested-group machinery SPECIAL COUNSEL uses.
    key: 'tools',
    label: 'TOOLS',
    href: '/tools.html',
    items: [
      { href: '/tools.html', label: 'All Tools' },
      {
        key: 'divorcetools',
        href: '/tools.html#divorce',
        label: 'DIVORCE',
        items: [
          { href: '/divorce-tax-counsel.html', label: 'Start Here: Divorce &amp; Tax' },
          { href: '/tool-divorce-marital-balance-sheet.html', label: 'Tax-Effected Marital Balance Sheet' },
          { href: '/tool-divorce-business-valuation.html', label: 'Business Valuation &mdash; Calculation of Value' },
          { href: '/tool-divorce-marital-home.html', label: 'The Marital Home: Keep, Sell or Buy Out' },
          { href: '/tool-divorce-retirement.html', label: 'Dividing Retirement Accounts' },
          { href: '/tool-divorce-carryforwards.html', label: 'Carryforwards After Divorce' },
          { href: '/tool-divorce-tax-rider.html', label: 'Tax Rider to the Settlement Agreement' },
          { href: '/tool-divorce-filing.html', label: 'Year-of-Divorce Filing Planner' },
          { href: '/tool-divorce-alimony.html', label: 'Alimony Estimator &amp; Property Trade-Off' },
          { href: '/tool-divorce-child-support.html', label: 'Child Support Estimator by State' },
        ],
      },
      {
        key: 'retools',
        href: '/tools.html#real-estate',
        label: 'REAL ESTATE &amp; TAX PLANNING',
        items: [
          { href: '/tool-rental-real-estate-tax-strategy-analyzer.html', label: 'Rental Real Estate Tax Strategy Analyzer' },
          { href: '/tool-1031-exchange.html', label: '&sect; 1031 Like-Kind Exchange Calculator' },
          { href: '/tool-cost-segregation.html', label: 'Cost Segregation Benefit Estimator' },
          { href: '/tool-firpta-withholding.html', label: 'FIRPTA Withholding Calculator' },
          { href: '/tool-capital-gains.html', label: 'Federal Capital Gains Tax Estimator' },
          { href: '/tool-material-participation-tracker.html', label: 'Material Participation &amp; REPS Tracker' },
        ],
      },
      {
        key: 'controversytools',
        href: '/tools.html#controversy',
        label: 'TAX CONTROVERSY',
        items: [
          { href: '/tool-irs-notice-guide.html', label: 'IRS Notice &amp; Correspondence Guide' },
          { href: '/tool-oic-rcp-estimator.html', label: 'Offer in Compromise: RCP Estimator' },
        ],
      },
      {
        key: 'entitytools',
        href: '/tools.html#entity',
        label: 'ENTITY &amp; STRUCTURING',
        items: [
          { href: '/tool-structuring.html', label: 'Structuring Tool &mdash; Investor Routing' },
          { href: '/tool-entity-formation.html', label: 'Entity Formation &mdash; Single-Member LLC' },
          { href: '/tool-entity-formation-multi.html', label: 'Multi-Member LLC &mdash; Eight-Step' },
          { href: '/tool-operating-agreement.html', label: 'Multi-Member LLC &mdash; 12-Step' },
        ],
      },
    ],
  },
  // 2026-09-05 (Paul): RESOURCES retired. The library stands on the bar under its
  // own name; Experience and Testimonials live under ABOUT with the people.
  {
    // 2026-09-05 (Paul): the library grouped the way the tools are, every post
    // named so a reader lands on it from the bar.
    key: 'library',
    label: 'LIBRARY',
    href: '/blog.html',
    items: [
      { href: '/blog.html', label: 'Full Library' },
      {
        key: 'libdivorce',
        href: '/blog.html#divorce',
        label: 'DIVORCE',
        items: [
          { href: '/blog-divorce-1041-dividing-real-estate.html', label: 'Dividing Real Estate Under &sect; 1041' },
          { href: '/blog-divorce-5050-split-after-tax.html', label: 'Equal on Paper, Unequal After Tax' },
          { href: '/blog-divorce-business-buyout-taxes.html', label: 'Keeping the Business: The Tax Bill Inside the Buyout' },
          { href: '/blog-divorce-retirement-qdro-taxes.html', label: 'The QDRO Isn&rsquo;t the Finish Line' },
          { href: '/blog-divorce-signing-joint-return.html', label: 'Signing a Joint Return During Divorce' },
          { href: '/blog-divorce-tax-refunds-audits.html', label: 'Who Gets the Refund &mdash; and the Audit' },
          { href: '/blog-divorce-legal-fees-deductible.html', label: 'Which Divorce Professional Fees Are Deductible' },
          { href: '/blog-divorce-foreign-accounts-fbar.html', label: 'Divorcing with Foreign Accounts or Property' },
          { href: '/blog-divorce-advisor-gap.html', label: 'The Advisor Gap in Divorce' },
          { href: '/blog-divorce-questions-family-lawyers-ask.html', label: 'What Family Lawyers Ask Us Most' },
        ],
      },
      {
        key: 'libroadmap',
        href: '/blog-controversy-roadmap-0-overview.html',
        label: 'THE CONTROVERSY ROADMAP',
        items: [
          { href: '/blog-controversy-roadmap-0-overview.html', label: 'Overview' },
          { href: '/blog-controversy-roadmap-1-processing-assessment.html', label: '1 &middot; Processing and Assessment' },
          { href: '/blog-controversy-roadmap-2-exam.html', label: '2 &middot; The Exam Station' },
          { href: '/blog-controversy-roadmap-3-exam-alternatives.html', label: '3 &middot; Exam Alternatives' },
          { href: '/blog-controversy-roadmap-4-appeals.html', label: '4 &middot; The Appeal Station' },
          { href: '/blog-controversy-roadmap-5-collection.html', label: '5 &middot; The Collection Station' },
          { href: '/blog-controversy-roadmap-6-collection-alternatives.html', label: '6 &middot; Collection Alternatives' },
          { href: '/blog-controversy-roadmap-7-litigation.html', label: '7 &middot; The Litigation Station' },
        ],
      },
      {
        key: 'libcollection',
        href: '/blog.html#controversy',
        label: 'IRS COLLECTION &amp; LIENS',
        items: [
          { href: '/blog-irs-levy.html', label: 'IRS Levies: How to Stop or Release One' },
          { href: '/blog-notice-of-federal-tax-lien.html', label: 'The Notice of Federal Tax Lien' },
          { href: '/blog-currently-not-collectible-csed.html', label: 'Currently Not Collectible and the CSED' },
          { href: '/blog-passport-revocation-tax-debt.html', label: 'Passport Revocation: &sect; 7345' },
          { href: '/blog-tenancy-by-entirety-federal-tax-lien.html', label: 'Tenancy by the Entirety and the Tax Lien' },
          { href: '/blog-irs-co-owned-marital-real-estate.html', label: 'When One Spouse Owes: Co-Owned Real Estate' },
          { href: '/blog-foreclose-federal-tax-lien-suit.html', label: 'Tax Judgments and Lien Foreclosure Suits' },
          { href: '/blog-transferee-nominee-alter-ego.html', label: 'Transferee, Nominee and Alter-Ego Liability' },
          { href: '/blog-trust-fund-recovery-penalty.html', label: 'The Trust Fund Recovery Penalty' },
          { href: '/blog-substitute-for-return.html', label: 'The Substitute for Return' },
        ],
      },
      {
        key: 'libexams',
        href: '/blog.html#controversy',
        label: 'EXAMS, PENALTIES &amp; CRIMINAL',
        items: [
          { href: '/blog-irs-audit-notice-what-to-do.html', label: 'IRS Audit Notice: What to Do First' },
          { href: '/blog-irs-summons.html', label: 'The IRS Summons and How to Fight It' },
          { href: '/blog-penalty-regime-6751b.html', label: 'Civil Penalties and the &sect; 6751(b) Defense' },
          { href: '/blog-civil-fraud-eggshell-audit.html', label: 'Civil Tax Fraud and the Eggshell Audit' },
          { href: '/blog-criminal-tax-overview.html', label: 'Criminal Tax: Offenses and Investigation' },
          { href: '/blog-jeopardy-termination-assessments.html', label: 'Jeopardy and Termination Assessments' },
          { href: '/blog-fbar-foreign-account-penalties.html', label: 'FBAR and Foreign-Asset Penalties' },
          { href: '/blog-kwong-after-july-10.html', label: 'Kwong After July 10' },
          { href: '/blog-kwong-covid-deadlines.html', label: 'Kwong and the COVID Refund Window' },
          { href: '/blog-conservation-easement-program-ended.html', label: 'IRS Ends the Easement Settlement Program' },
          { href: '/blog-conservation-easement-settlement.html', label: 'Conservation Easement Settlement IR-2026-65' },
        ],
      },
      {
        key: 'librealestate',
        href: '/blog.html#real-estate',
        label: 'REAL ESTATE',
        items: [
          { href: '/blog-short-term-rental-play.html', label: 'The Short-Term Rental Seven-Day Rule' },
          { href: '/blog-short-term-rental-material-participation.html', label: 'Short-Term Rentals and the 100-Hour Test' },
          { href: '/blog-real-estate-professional-status-reps.html', label: 'Real Estate Professional Status' },
          { href: '/blog-material-participation-seven-tests.html', label: 'Material Participation: The Seven Tests' },
          { href: '/blog-per-se-passive-rule-exceptions.html', label: 'The Per Se Passive Rule and Its Six Exits' },
          { href: '/blog-drop-and-swap-sequencing.html', label: 'Drop-and-Swap and Swap-and-Drop' },
          { href: '/blog-opportunity-zones-2-0-nomination-window.html', label: 'Opportunity Zones 2.0' },
          { href: '/blog-163j-withdraw-real-property-election.html', label: '&sect; 163(j) After OBBBA' },
          { href: '/blog-subdivision-basis-allocation.html', label: 'Basis Allocation Across Subdivided Lots' },
          { href: '/blog-firpta-foreign-sellers.html', label: 'FIRPTA Withholding for Foreign Sellers' },
        ],
      },
      {
        key: 'libplanning',
        href: '/blog.html#compliance',
        label: 'TAX PLANNING',
        items: [
          { href: '/blog-461l-excess-business-loss-and-172-nol.html', label: '&sect; 461(l), NOLs and the 80% Cap' },
          { href: '/blog-augusta-rule-280a-g.html', label: 'The Augusta Rule: &sect; 280A(g)' },
          { href: '/blog-bramblett-phelan-two-entity-structure.html', label: 'The Bramblett-Phelan Two-Entity Structure' },
          { href: '/blog-character-amount-timing.html', label: 'Character, Amount and Timing' },
          { href: '/blog-partnership-agreement-tax-document.html', label: 'The Partnership Agreement as a Tax Document' },
          { href: '/blog-tax-opinions.html', label: 'Tax Opinions and the Confidence Ladder' },
        ],
      },
    ],
  },
  // 2026-09-05 (Paul): the four-tier members program is retired. Clients reach
  // their matters through Clio for Clients; the site's job is to say how.
  // 2026-09-06 (Paul): the item IS the sign-in. Clio's guidance to firms is to put
  // https://clients.clio.com/login on the website; /client-portal.html (how it works)
  // stays reachable from Contact and the retired tier URLs.
  { key: 'portal', label: 'CLIENT PORTAL', href: 'https://clients.clio.com/login', external: true },
  { key: 'contact', label: 'CONTACT', href: '/contact.html' },
];

// ── The scan ─────────────────────────────────────────────────────────────────

/**
 * Does this document have a site nav, and which ids does it already use?
 *
 * Modelled on `footerScan` in ./footer-inject.js — one extra pass over the body
 * `_middleware.js` has already buffered, output discarded.
 *
 * `served` is the re-entrancy guard: a document that already carries an injected
 * nav is left alone rather than rewritten twice, which matters because the
 * marker class is the handle the CI assertion looks the nav up by and two navs
 * would make that lookup ambiguous rather than failing loudly.
 *
 * @param {string} html the buffered response body
 * @param {typeof HTMLRewriter} Rewriter injected so the suite can drive real
 *   lol-html under Node — same contract as `planFromHtml` and `footerScan`.
 */
export async function navScan(html, Rewriter) {
  const seen = { nav: false, served: false, ids: new Set() };
  const rewriter = new Rewriter()
    .on(SITE_NAV_SELECTOR, { element() { seen.nav = true; } })
    .on(`.${SERVED_MARKER_CLASS}`, { element() { seen.served = true; } })
    .on('[id]', {
      element(el) {
        const id = el.getAttribute('id');
        if (id) seen.ids.add(id);
      },
    });
  await rewriter.transform(new Response(html)).arrayBuffer();
  return { wanted: seen.nav && !seen.served, ids: seen.ids };
}

/**
 * Every id a second-level group emits, for one `prefix` and one group.
 *
 * Six, because the two renderings are independent controls and each needs its own
 * panel, its own toggle and — on mobile — its own icon. Naming them off BOTH the
 * parent key and the group key keeps them distinct from the first-level ids
 * (`dlnav-m-tax` vs `dlnav-m-tax-controversy`) and from each other, and leaves
 * room for a second group under some other top-level item later.
 *
 * SHELDON-NAV-R2. Kept as one function rather than spelled out at each use site
 * because `navIds` and the markup MUST agree: an id the markup emits and the scan
 * does not check is exactly the duplicate-id hazard the scan exists to refuse.
 */
export function subIds(prefix, parentKey, key) {
  const stem = `${prefix}-${parentKey}-${key}`;
  return {
    label: stem,
    panel: `${prefix}-d-${parentKey}-${key}`,
    toggle: `${prefix}-dbtn-${parentKey}-${key}`,
    mPanel: `${prefix}-m-${parentKey}-${key}`,
    mToggle: `${prefix}-mbtn-${parentKey}-${key}`,
    mIcon: `${prefix}-mfa-${parentKey}-${key}`,
  };
}

/**
 * Every id `navMarkup(prefix)` would emit, except the five bound names.
 *
 * The single source both the collision scan and the markup read from. #227 built
 * the candidate list inline in `idPrefix`, which was correct while the markup had
 * exactly four id shapes; the second-level group adds six more, and a list that
 * has to be updated in two places to stay honest will eventually not be.
 */
export function navIds(prefix) {
  const ids = [];
  for (const item of TOP_LEVEL) {
    ids.push(`${prefix}-${item.key}`, `${prefix}-m-${item.key}`, `${prefix}-btn-${item.key}`, `${prefix}-fa-${item.key}`);
    for (const sub of item.items || []) {
      if (!sub.items) continue;
      ids.push(...Object.values(subIds(prefix, item.key, sub.key)));
    }
  }
  return ids;
}

/**
 * A prefix none of this document's own ids collide with.
 *
 * The ids `js/main.js` binds are excluded from the check on purpose: they are
 * fixed names, they are in `ids` only because the nav being REPLACED carries
 * them, and treating them as a collision would bump the prefix on every page for
 * no reason. Every other id in the document is a genuine hazard — Bootstrap's
 * `data-target="#x"` finds the FIRST `#x`, so a page with its own `#menu1`
 * accordion would have the mobile nav toggling the article instead of the menu.
 *
 * @param {Set<string>} ids every id in the document
 */
export function idPrefix(ids) {
  const taken = new Set([...ids].filter((id) => !BOUND_IDS.includes(id)));
  const collides = (p) => navIds(p).some((id) => taken.has(id));
  let prefix = 'dlnav';
  for (let n = 2; collides(prefix); n++) prefix = `dlnav${n}`;
  return prefix;
}

// ── The markup ───────────────────────────────────────────────────────────────

const esc = (s) => String(s).replace(/"/g, '&quot;');

// ── THE SECOND LEVEL (SHELDON-NAV-R2) ────────────────────────────────────────
//
// ── WHY THE NESTED PANEL IS NOT A `.dropdown-menu` ───────────────────────────
//
// `js/main.js` opens the first level with
//
//     $('.dropdown').hover(function () { $(this).find('.dropdown-menu').fadeIn() }, …)
//
// — `.find()`, which is a DESCENDANT search, and `fadeIn`/`fadeOut`, which write
// an INLINE `display` that outranks any stylesheet. A nested panel carrying the
// class `dropdown-menu` would therefore be faded in by hovering TAX, and would sit
// open beside the panel it belongs to, permanently, on every page. The nested
// panel is `.dl-subnav-menu` instead, and `js/main.js` is not touched — this order
// changes two files and `js/main.js` is neither of them.
//
// ── WHY THE TOGGLES ARE BOOTSTRAP COLLAPSE TRIGGERS ──────────────────────────
//
// `aria-expanded` has to change when the group opens, and nothing here may add or
// modify a script: a new `<script src>` breaks the swup router's allow-list
// completeness check (CLAUDE.md §3.8), and `js/main.js` is out of this order's
// scope. Bootstrap 4.3.1 already ships on all 113 nav-bearing pages and its
// collapse plugin maintains `aria-expanded` on `[data-toggle="collapse"]` triggers
// by itself — it is what already drives the first-level mobile groups. So BOTH
// toggles, desktop and mobile, are real collapse triggers: they toggle by click,
// they are reachable and operable from the keyboard as `<button>`s, and their
// `aria-expanded` is maintained by code that is already on the page.
//
// Desktop ALSO opens on hover and on `:focus-within`, in css/dl-nav.css. That is
// the same affordance the first level has had since before this module existed,
// and it deliberately does not write `aria-expanded`: a hover is not a state a
// screen reader user can be in, and the first-level panels do not claim one
// either. The keyboard path — tab to the toggle, press it — is the one that both
// opens the panel and announces it.

/** The `<a>`/`<button>` head and nested panel of one second-level group, desktop. */
function desktopSubgroup(parent, sub, prefix) {
  const id = subIds(prefix, parent.key, sub.key);
  // The link, the toggle and the panel are SIBLINGS, deliberately. Wrapping the
  // first two in a head element would have left the panel unreachable from the
  // toggle by any combinator but `:has()`, and one unsupported selector in a
  // comma-separated group invalidates the whole rule — the hover and focus paths
  // would have gone with it. `~` needs no fallback.
  return `<div class="dl-subnav">`
    + `<a class="dropdown-item dl-subnav-parent" id="${id.label}" href="${sub.href}">${sub.label}</a>`
    + `<button type="button" id="${id.toggle}" class="dl-subnav-toggle" data-toggle="collapse"`
    + ` data-target="#${id.panel}" aria-controls="${id.panel}" aria-expanded="false"`
    + ` aria-label="${esc(`Toggle ${sub.label}`)}"><i class="fa fa-angle-right"></i></button>`
    + `<div class="dl-subnav-menu collapse" id="${id.panel}" aria-labelledby="${id.label}">`
    + sub.items.map((l) => `<a class="dropdown-item dl-subnav-item" href="${l.href}">${l.label}</a>`).join('')
    + `</div>`
    + `</div>`;
}

/** The same group on mobile: the `.mobile-parent` shape, one level in. */
function mobileSubgroup(parent, sub, prefix) {
  const id = subIds(prefix, parent.key, sub.key);
  return `<div class="mobile-menu-item mobile-parent dl-subnav-mobile">`
    + `<a href="${sub.href}" class="mm-parent-label dd-sub">${sub.label}</a>`
    + `<button id="${id.mToggle}" class="btn btn-plus" data-toggle="collapse" data-target="#${id.mPanel}"`
    + ` aria-controls="${id.mPanel}" aria-expanded="false" aria-label="${esc(`Toggle ${sub.label}`)}">`
    + `<div id="${id.mIcon}" class="top-icon hidden"><i class="fa fa-minus"></i></div>`
    + `</button>`
    + `<div class="collapse dl-subnav-mobile-menu" id="${id.mPanel}">`
    + sub.items.map((l) => `<a class="dropdown-item dd-sub dl-subnav-item" href="${l.href}">${l.label}</a>`).join('')
    + `</div>`
    + `</div>`;
}

/** One desktop dropdown panel's links, with any second-level group inlined. */
function desktopItems(item, prefix) {
  if (item.members) {
    return TIER_LINKS.map((t) => `<a class="dropdown-item" href="${t.href}">${t.html}</a>`).join('');
  }
  return item.items.map((l) => (l.items
    ? desktopSubgroup(item, l, prefix)
    : `<a class="dropdown-item" href="${l.href}">${l.label}</a>`)).join('');
}

/** One mobile group's links, with any second-level group inlined. */
function mobileItems(item, prefix) {
  if (item.members) {
    return TIER_LINKS.map((t) => `<a class="dropdown-item" href="${t.href}">${t.html}</a>`).join('');
  }
  return item.items.map((l) => (l.items
    ? mobileSubgroup(item, l, prefix)
    : `<a class="dropdown-item dd-sub" href="${l.href}">${l.label}</a>`)).join('');
}

/**
 * The whole `nav.menubar` interior, for one page.
 *
 * Exported because the CI suite builds the expected served page by applying this
 * to the source — the same direction `withFooterLine` uses in
 * test/perch-main.test.mjs, and for the same reason: inserting what is claimed to
 * be injected keeps the "nothing else changed" invariants as EQUALITIES, where
 * stripping the nav out of the served page would have accepted a nav of any
 * shape landing anywhere.
 *
 * ── MOBILE: ONE VALID PATTERN INSTEAD OF THE TWO SHIPPED ────────────────────
 *
 * Every mobile group uses the `div.mobile-menu-item.mobile-parent` shape the
 * PRACTICE group already ships. The other shape in the tree wraps the group in
 * an `<a>` and puts `<a class="dropdown-item">` links INSIDE it — nested anchors,
 * which the HTML parser resolves by closing the outer `<a>` early, so the markup
 * that ships and the DOM the browser builds are already two different things.
 * Re-authoring that would be copying a bug into 113 pages at once.
 *
 * `#thePractice` is deliberately absent. `js/main.js` binds it to a hard
 * navigation to `the-cmm.html` — a page that is not in `sitemap.xml`, is not in
 * this IA, and is reachable today only from variant B's nav. Emitting the id
 * would send visitors there from every page on the site; omitting it leaves
 * `$('#thePractice')` matching nothing, which is a jQuery no-op and is already
 * the state of 103 of the 113 nav-bearing pages. Called out here because it is
 * the one name from CLAUDE.md §4's list this markup does not carry.
 */
export function navMarkup(prefix) {
  const desktop = TOP_LEVEL.map((item) => {
    const labelId = `${prefix}-${item.key}`;
    if (!item.items && !item.members) {
      if (item.external) return `<li class="nav-item"><a class="nav-link" href="${item.href}" target="_blank" rel="noopener">${item.label}</a></li>`;
      return `<li class="nav-item"><a class="nav-link" href="${item.href}">${item.label}</a></li>`;
    }
    // `aria-labelledby` points at the parent link's own id. The shipped markup
    // pointed every panel at `navbarDropdown1`…`4`, which no element on any page
    // has ever had — #227 asks for that repaired rather than copied.
    return `<li class="nav-item dropdown">`
      + `<a class="nav-link" id="${labelId}" href="${item.href}">${item.label}</a>`
      + `<div class="dropdown-menu" aria-labelledby="${labelId}">`
      + desktopItems(item, prefix)
      + `</div></li>`;
  }).join('');

  const mobile = TOP_LEVEL.map((item) => {
    if (!item.items && !item.members) {
      if (item.external) return `<a href="${item.href}" class="mobile-menu-item" target="_blank" rel="noopener">${item.label}</a>`;
      return `<a href="${item.href}" class="mobile-menu-item">${item.label}</a>`;
    }
    const panelId = `${prefix}-m-${item.key}`;
    const toggleId = item.boundToggleId || `${prefix}-btn-${item.key}`;
    const iconId = item.boundIconId || `${prefix}-fa-${item.key}`;
    const label = item.boundLabelId
      ? `<span id="${item.boundLabelId}">${item.label}</span>`
      : item.label;
    return `<div class="mobile-menu-item mobile-parent">`
      + `<a href="${item.href}" class="mm-parent-label">${label}</a>`
      + `<button id="${toggleId}" class="btn btn-plus" data-toggle="collapse" data-target="#${panelId}"`
      + ` aria-controls="${panelId}" aria-expanded="false" aria-label="${esc(`Toggle ${item.label}`)}">`
      + `<div id="${iconId}" class="top-icon hidden"><i class="fa fa-minus"></i></div>`
      + `</button>`
      + `<div class="collapse" id="${panelId}">${mobileItems(item, prefix)}</div>`
      + `</div>`;
  }).join('');

  return `<div class="logo animate__animated animate__fadeIn animate__delay-1s">`
    + `<a href="/index.html"><img class="logo" src="/img/base-hover.png" alt="Donovan Legal PLLC logo"></a>`
    + `</div>`
    + `<div class="burger-toggle animate__animated animate__fadeIn animate__delay-1s">`
    + `<div class="hamburger"><span class="line"></span><span class="line"></span><span class="line"></span></div>`
    + `</div>`
    + `<ul id="menu-desktop" class="navbar-nav ml-auto animate__animated animate__fadeIn animate__delay-1s ${SERVED_MARKER_CLASS}">`
    + desktop
    + `</ul>`
    + `<nav class="nav-mobile-overlay"><div class="nav-mobile-wrapper"><div class="container">`
    + `<div class="nav-mobile"><div class="nav-mobile-header">`
    + `<div class="btn-close menu"><i class="fa fa-times"></i></div>`
    + `</div><div class="nav-mobile-list">${mobile}</div></div>`
    + `</div></div></nav>`;
}

/**
 * The stylesheet tag to compose into `layerHandlers(plan, extraTags)`, or '' when
 * this document gets no nav.
 *
 * It CANNOT be its own `['head', …]` handler: lol-html keeps only the LAST
 * `onEndTag` registered per element, so a second head handler silently deletes
 * the persistent layer's and the router's tags. Same edge, and the same shape,
 * as `barStylesheetTag` and `footerStylesheetTag`.
 */
export function navStylesheetTag(scan) {
  return scan.wanted ? NAV_STYLESHEET_TAG : '';
}

/**
 * HTMLRewriter handlers that replace the site nav's subtree.
 *
 * `setInnerContent` on `nav.menubar` and NOT `replace()` on the element: the
 * three variants carry different class lists on the `<nav>` itself
 * (`navbar menubar padding-0 navbar-expand-lg d-flex …`) and page stylesheets
 * key off them, so the element stays and only its interior changes.
 *
 * First site nav wins, for the reason `perch-main.js` gives: the mobile overlay
 * is a nested `<nav>`, and on a variant A page it matches nothing here but the
 * guard costs nothing and keeps the two modules reading the same way.
 *
 * Returns [] on the 47 fragments, which is what makes this a clean no-op there:
 * a handler for a selector the document does not contain never fires, and no
 * handler is registered at all.
 */
export function navHandlers(scan) {
  if (!scan.wanted) return [];
  const markup = navMarkup(idPrefix(scan.ids));
  let done = false;
  return [[SITE_NAV_SELECTOR, {
    element(el) {
      if (done) return;
      done = true;
      el.setInnerContent(markup, { html: true });
    },
  }]];
}
