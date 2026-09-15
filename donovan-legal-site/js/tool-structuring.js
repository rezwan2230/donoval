/* Donovan Legal — RESERVE Structuring Tool (Advisory)
 * JavaScript Engine — Thread 1 of 3
 * Last updated: May 2026
 *
 * Architecture (mirrors tool-entity-formation-multi.js patterns):
 *   - Three-tier ladder ('public' < 'platinum' < 'reserve') driven by
 *     window.__DONOVAN_TIER set inline in the HTML wrapper before this script
 *     loads. RESERVE-only tool — PLATINUM and below render the gate page.
 *   - Multi-step wizard producing a structuring memorandum.
 *
 *   THREAD 1 SCOPE (this build):
 *     Step 1 — Setup (deal identity, jurisdiction, asset type)
 *     Step 2 — Investor Identity Routing (9 routes)
 *     Step 3 — Entity Classification & CTB Analysis (§ 301.7701-3, per-se list,
 *              late-election relief, treaty/LOB, § 708(b)(2) division/merger)
 *     Step 4 — Review & Generate Memorandum (Thread 1 sections only)
 *
 *   THREAD 2 (next build) ADDS:
 *     Step 3a — Related-Party Debt Analysis (§ 163(j), § 267, § 707(b),
 *               Reg. § 1.752-2(d), § 385, anti-conduit, AHYDO)
 *     Step 3b — Management Fee Characterization (§ 707(a) vs § 707(c),
 *               profits-interest fee waiver post-§ 1061)
 *     Step 3c — Mezzanine Debt Characterization (13-factor debt vs equity)
 *
 *   THREAD 3 (final build) ADDS:
 *     SVG org-chart engine with 16-type legend
 *     Integration handoff to Tool #1 (Multi-Eight) and RESERVE 12-Step
 *     via localStorage key `donovan_legal_structuring_outcome_v1` + JSON export
 *
 * No external dependencies. Vanilla JS only.
 */

// =============================================================================
// TIER GATING — three-tier ladder
// =============================================================================
// public    rank 0 — gate page only
// platinum  rank 1 — gate page only (RESERVE-only tool)
// reserve   rank 2 — full tool access
// =============================================================================
const RAW_TIER = (typeof window !== 'undefined' && window.__DONOVAN_TIER) || 'public';
// Normalize 'gold' and 'client' aliases to public for gating purposes.
const TIER = (RAW_TIER === 'gold' || RAW_TIER === 'client') ? 'public' : RAW_TIER;
const TIER_RANK = { public: 0, platinum: 1, reserve: 2 };
function tierRank(t)   { return TIER_RANK[t] != null ? TIER_RANK[t] : 0; }
function isAtLeast(t)  { return tierRank(TIER) >= tierRank(t); }
function isPublic()    { return TIER === 'public'; }
function isPlatinum()  { return TIER === 'platinum'; }
function isReserve()   { return isAtLeast('reserve'); }
function hasToolAccess() { return isReserve(); }
const TIER_LABEL = { public: 'PUBLIC', platinum: 'PLATINUM', reserve: 'RESERVE' };

// =============================================================================
// JURISDICTIONS — minimum data shared with Tool #1 for downstream consistency
// =============================================================================
// We track only the data the structuring tool needs (state name + tax notes).
// Tool #1 (Multi-Eight) and the RESERVE 12-Step carry the full statute hooks.
// =============================================================================
const STATES = {
  FL: { code: 'FL', name: 'Florida',        incomeTax: false, note: 'No state income tax; FL residency planning friendly.' },
  DE: { code: 'DE', name: 'Delaware',       incomeTax: true,  note: 'Default formation state for institutional deals; Chancery Court advantage.' },
  WY: { code: 'WY', name: 'Wyoming',        incomeTax: false, note: 'No state income tax; strongest charging-order protection.' },
  TX: { code: 'TX', name: 'Texas',          incomeTax: false, note: 'No state income tax; franchise tax applies.' },
  NY: { code: 'NY', name: 'New York',       incomeTax: true,  note: 'High-tax jurisdiction; § 206 publication requirement.' },
  CA: { code: 'CA', name: 'California',     incomeTax: true,  note: 'High-tax; $800 LLC franchise tax; gross receipts fee.' },
  SC: { code: 'SC', name: 'South Carolina', incomeTax: true,  note: 'Moderate tax burden.' },
  NC: { code: 'NC', name: 'North Carolina', incomeTax: true,  note: 'Flat 4.5% individual rate (2026).' },
  SD: { code: 'SD', name: 'South Dakota',   incomeTax: false, note: 'No state income tax; favored trust situs for dynasty trusts.' },
  NV: { code: 'NV', name: 'Nevada',         incomeTax: false, note: 'No state income tax; modified business tax applies.' }
};
const STATE_CODES = Object.keys(STATES);
function stateInfo(code) { return STATES[code] || STATES.DE; }

// =============================================================================
// INVESTOR IDENTITY ROUTES — nine top-level routes
// =============================================================================
// Each route carries:
//   key         — internal identifier
//   label       — human-readable name
//   blurb       — one-sentence summary for the UI
//   keyCites    — primary IRC / Reg / treaty cites
//   coreAnalysis — array of paragraphs (or paragraph-keys) for the memo
//   blocker     — { recommended: bool, type: 'us_c_corp'|'foreign_corp'|'none', rationale }
//   flags       — array of structural flags the analysis surfaces
//   subRoutes   — for routes with substantive branches (trusts, foreign trusts)
// =============================================================================
const INVESTOR_ROUTES = {
  domestic_individual: {
    key: 'domestic_individual',
    label: 'Domestic Individual (U.S. citizen or resident alien)',
    blurb: 'Direct LP / member interest is typically appropriate; no blocker structure needed.',
    keyCites: ['I.R.C. § 1411 (NIIT)', 'I.R.C. § 469 (passive activity)', 'I.R.C. § 1061 (carried interest)'],
    blocker: { recommended: false, type: 'none', rationale: 'Direct flow-through is preferred; pass-through rate plus § 199A QBI for qualifying activities.' },
    flags: ['niit_exposure', 'passive_activity_loss', 'state_residency_planning'],
    subRoutes: null
  },
  tax_exempt: {
    key: 'tax_exempt',
    label: 'Tax-Exempt Organization (§ 501 entity, pension trust, university endowment)',
    blurb: 'UBTI/UDFI exposure under § 511; § 514(c)(9) fractions rule for qualifying RE, blocker corporation otherwise.',
    keyCites: ['I.R.C. § 511', 'I.R.C. § 512', 'I.R.C. § 514(c)(9)', 'Treas. Reg. § 1.514(c)-2'],
    blocker: { recommended: 'conditional', type: 'us_c_corp', rationale: 'C-corp blocker neutralizes UBTI/UDFI; alternative is § 514(c)(9) compliance for qualified organizations holding qualifying real property indebtedness.' },
    flags: ['ubti_udfi', 'fractions_rule', 'blocker_drag', 'erisa_plan_assets'],
    subRoutes: null
  },
  swf: {
    key: 'swf',
    label: 'Sovereign Wealth Fund / Foreign Governmental Investor',
    blurb: '§ 892 exemption for passive investment income only; commercial-activity contamination disqualifies the entire fund.',
    keyCites: ['I.R.C. § 892', 'Treas. Reg. §§ 1.892-1T through 1.892-7T', 'Prop. Reg. § 1.892-5 (REG-146537-06, Nov. 2011)'],
    blocker: { recommended: true, type: 'us_c_corp', rationale: 'Blocker insulates § 892 fund from commercial-activity taint by ensuring SWF holds passive corporate stock rather than direct partnership interest in operating real estate.' },
    flags: ['section_892_exemption', 'commercial_activity_taint', 'controlled_commercial_entity', 'qualified_holding_corporation'],
    subRoutes: null
  },
  foreign_individual: {
    key: 'foreign_individual',
    label: 'Foreign Individual (nonresident alien)',
    blurb: 'ECI and FIRPTA exposure on U.S. real property interests; U.S. blocker corporation typically recommended.',
    keyCites: ['I.R.C. § 871', 'I.R.C. § 897 (FIRPTA)', 'I.R.C. § 1445', 'I.R.C. § 1446(f)'],
    blocker: { recommended: true, type: 'us_c_corp', rationale: 'Blocker converts FIRPTA-tainted USRPI gain into corporate-level tax + dividend WHT, avoiding individual filing obligation and ECI complexity. Trade-off: 21% corporate rate + 30% (or treaty) WHT vs. direct 37% individual rate; blocker often wins after NIIT and state.' },
    flags: ['firpta', 'eci', '1446f_withholding', 'estate_tax_exposure', 'treaty_benefits'],
    subRoutes: null
  },
  foreign_corporation: {
    key: 'foreign_corporation',
    label: 'Foreign Corporation (treaty-eligible jurisdiction)',
    blurb: 'Branch profits tax under § 884 if ECI; treaty analysis essential; LOB article must be cleared.',
    keyCites: ['I.R.C. § 882', 'I.R.C. § 884 (Branch Profits Tax)', 'I.R.C. § 897', 'Applicable U.S. income tax treaty Article 10 (Dividends) and LOB article'],
    blocker: { recommended: 'conditional', type: 'us_c_corp', rationale: 'A second-tier U.S. C-corp blocker can be used to manage branch profits exposure and qualify for treaty dividend rates. Without a blocker, foreign corp holds USRPI directly, triggers BPT on dividend equivalent amount.' },
    flags: ['branch_profits_tax', 'treaty_application', 'lob_article', 'subpart_f_concerns'],
    subRoutes: null
  },
  per_se_foreign_corp: {
    key: 'per_se_foreign_corp',
    label: 'Per Se Foreign Corporation (§ 301.7701-2(b)(8) listed entity)',
    blurb: 'Entity is classified as a corporation as a matter of law; check-the-box election is NOT available.',
    keyCites: ['Treas. Reg. § 301.7701-2(b)(8)', 'Treas. Reg. § 301.7701-3(a)'],
    blocker: { recommended: 'inherent', type: 'foreign_corp', rationale: 'The investor itself is already corporate. Analysis collapses into the foreign-corporation route (treaty, BPT) plus any additional U.S. blocker layer if FIRPTA management warrants it.' },
    flags: ['per_se_status', 'no_ctb_available', 'corporate_classification_locked'],
    subRoutes: null
  },
  foreign_pension: {
    key: 'foreign_pension',
    label: 'Foreign Pension / Qualified Foreign Pension Fund',
    blurb: '§ 897(l) QFPF exemption from FIRPTA if statutory requirements are met; direct ownership often preferred.',
    keyCites: ['I.R.C. § 897(l)', 'Treas. Reg. § 1.897(l)-1', 'I.R.C. § 1445(f)(3) certification mechanics'],
    blocker: { recommended: false, type: 'none', rationale: 'QFPF status, if established, exempts the fund from FIRPTA on USRPI dispositions. Blocker would destroy this benefit. Verification of QFPF status under Reg. § 1.897(l)-1 is the principal diligence task.' },
    flags: ['qfpf_certification', 'firpta_exemption_897l', 'eligible_fund_test', 'qualified_controlled_entity'],
    subRoutes: null
  },
  domestic_trust: {
    key: 'domestic_trust',
    label: 'Domestic Trust (grantor, complex non-grantor, or dynasty)',
    blurb: 'Three substantive sub-routes — grantor trust (transparent), non-grantor complex trust (separate taxpayer), GST-exempt dynasty trust (long-term planning vehicle).',
    keyCites: ['I.R.C. §§ 671–679 (grantor trust rules)', 'I.R.C. §§ 641–685 (Subchapter J)', 'I.R.C. § 2631 (GST exemption)', 'Reg. § 301.7701-7 (domestic trust test)'],
    blocker: { recommended: false, type: 'none', rationale: 'Trust structure already provides the relevant tax characterization. Grantor trust is transparent (grantor reports); non-grantor trust is a separate taxpayer (compressed brackets — § 1(e) reaches 37% at roughly $16,000 of taxable income, indexed annually).' },
    flags: ['grantor_status', 'compressed_brackets', 'gst_planning', 'state_situs_planning'],
    subRoutes: {
      grantor:     { label: 'Grantor Trust',     summary: 'Transparent for income tax; grantor recognized as owner under §§ 671–678.' },
      non_grantor: { label: 'Non-Grantor (Complex) Trust', summary: 'Separate taxpayer under Subchapter J; compressed § 1(e) brackets reach 37% at roughly $16,000 of taxable income (indexed annually; verify the current-year threshold).' },
      dynasty:     { label: 'GST-Exempt Dynasty Trust', summary: 'Long-horizon transfer-tax vehicle; situs in SD, NV, AK, or DE preferred for perpetuities and asset protection.' }
    }
  },
  foreign_trust: {
    key: 'foreign_trust',
    label: 'Foreign Trust (grantor or non-grantor)',
    blurb: 'Distinct machinery from foreign-corp routes — § 679 outbound transfer rules and §§ 665–668 throwback rules apply.',
    keyCites: ['I.R.C. § 679', 'I.R.C. §§ 665–668 (throwback / accumulation distribution)', 'I.R.C. § 6048 (Forms 3520 / 3520-A)', 'Reg. § 301.7701-7 (court and control tests)'],
    blocker: { recommended: 'conditional', type: 'us_c_corp', rationale: 'For a foreign non-grantor trust with U.S. beneficiaries, a blocker can prevent UNI accumulation and the punitive throwback regime; for a foreign grantor trust with a U.S. grantor (subject to § 679), domestic-trust analysis controls.' },
    flags: ['section_679_outbound', 'throwback_uni', 'forms_3520_3520a', 'court_and_control_tests', 'beneficiary_planning'],
    subRoutes: {
      grantor:     { label: 'Foreign Grantor Trust',     summary: 'Grantor recognized as owner; if grantor is U.S. person, § 679 may apply on outbound transfer.' },
      non_grantor: { label: 'Foreign Non-Grantor Trust', summary: 'Separate foreign taxpayer; U.S. beneficiaries face throwback rules and UNI accumulation under §§ 665–668; Form 3520 reporting.' }
    }
  }
};
const INVESTOR_ROUTE_KEYS = Object.keys(INVESTOR_ROUTES);

// =============================================================================
// PER-SE FOREIGN CORPORATIONS — Treas. Reg. § 301.7701-2(b)(8) (representative list)
// =============================================================================
// This list represents the most commonly encountered per-se foreign corps.
// The full regulatory list contains ~80 jurisdictions; the firm should consult
// the current regulation text for any jurisdiction not enumerated here.
// =============================================================================
// v13.4 — Extended per-se foreign list per Reg. § 301.7701-2(b)(8)(i).
// Each entry is a foreign business entity whose status as a corporation for U.S. federal tax
// purposes is fixed by regulation (not subject to check-the-box election).
const PER_SE_LIST = [
  { country: 'Argentina',       form: 'Sociedad Anónima (S.A.)' },
  { country: 'Australia',       form: 'Public Limited Company' },
  { country: 'Austria',         form: 'Aktiengesellschaft (AG)' },
  { country: 'Barbados',        form: 'Limited Company' },
  { country: 'Belgium',         form: 'Société Anonyme / Naamloze Vennootschap (NV)' },
  { country: 'Belize',          form: 'Public Limited Company' },
  { country: 'Bolivia',         form: 'Sociedad Anónima' },
  { country: 'Brazil',          form: 'Sociedade Anônima (S.A.)' },
  { country: 'Bulgaria',        form: 'Aktsionerno Druzhestvo' },
  { country: 'Canada',          form: 'Corporation and Company' },
  { country: 'Chile',           form: 'Sociedad Anónima (S.A.)' },
  { country: 'China (People\'s Republic)', form: 'Gufen Youxian Gongsi' },
  { country: 'Republic of China (Taiwan)', form: 'Ku-fen Yu-hsien Kung-szu' },
  { country: 'Colombia',        form: 'Sociedad Anónima' },
  { country: 'Costa Rica',      form: 'Sociedad Anónima' },
  { country: 'Cyprus',          form: 'Public Limited Company' },
  { country: 'Czech Republic',  form: 'Akciová Společnost (a.s.)' },
  { country: 'Denmark',         form: 'Aktieselskab (A/S)' },
  { country: 'Ecuador',         form: 'Sociedad Anónima or Compañía Anónima' },
  { country: 'Egypt',           form: 'Sharikat Al-Mossahamah' },
  { country: 'El Salvador',     form: 'Sociedad Anónima' },
  { country: 'Estonia',         form: 'Aktsiaselts' },
  { country: 'European Economic Area / European Union', form: 'Societas Europaea (SE)' },
  { country: 'Finland',         form: 'Julkinen Osakeyhtiö / Publikt Aktiebolag' },
  { country: 'France',          form: 'Société Anonyme (S.A.)' },
  { country: 'Germany',         form: 'Aktiengesellschaft (AG)' },
  { country: 'Greece',          form: 'Anonymos Etairia (A.E.)' },
  { country: 'Guam',            form: 'Corporation' },
  { country: 'Guatemala',       form: 'Sociedad Anónima' },
  { country: 'Guyana',          form: 'Public Limited Company' },
  { country: 'Honduras',        form: 'Sociedad Anónima' },
  { country: 'Hong Kong',       form: 'Public Limited Company' },
  { country: 'Hungary',         form: 'Részvénytársaság' },
  { country: 'Iceland',         form: 'Hlutafelag' },
  { country: 'India',           form: 'Public Limited Company' },
  { country: 'Indonesia',       form: 'Perseroan Terbuka' },
  { country: 'Ireland',         form: 'Public Limited Company (plc)' },
  { country: 'Israel',          form: 'Public Limited Company' },
  { country: 'Italy',           form: 'Società per Azioni (S.p.A.)' },
  { country: 'Jamaica',         form: 'Public Limited Company' },
  { country: 'Japan',           form: 'Kabushiki Kaisha (K.K.)' },
  { country: 'Kazakhstan',      form: 'Ashyk Aktsionerlik Kogham' },
  { country: 'Republic of Korea', form: 'Chusik Hoesa' },
  { country: 'Latvia',          form: 'Akciju Sabiedrība' },
  { country: 'Liberia',         form: 'Corporation' },
  { country: 'Liechtenstein',   form: 'Aktiengesellschaft' },
  { country: 'Lithuania',       form: 'Akcine Bendroves' },
  { country: 'Luxembourg',      form: 'Société Anonyme (S.A.)' },
  { country: 'Malaysia',        form: 'Berhad' },
  { country: 'Malta',           form: 'Public Limited Company' },
  { country: 'Mexico',          form: 'Sociedad Anónima (S.A.)' },
  { country: 'Morocco',         form: 'Société Anonyme' },
  { country: 'Netherlands',     form: 'Naamloze Vennootschap (N.V.)' },
  { country: 'New Zealand',     form: 'Limited Company' },
  { country: 'Nicaragua',       form: 'Compañía Anónima' },
  { country: 'Nigeria',         form: 'Public Limited Company' },
  { country: 'Northern Mariana Islands', form: 'Corporation' },
  { country: 'Norway',          form: 'Allment Aksjeselskap (ASA)' },
  { country: 'Pakistan',        form: 'Public Limited Company' },
  { country: 'Panama',          form: 'Sociedad Anónima' },
  { country: 'Paraguay',        form: 'Sociedad Anónima' },
  { country: 'Peru',            form: 'Sociedad Anónima' },
  { country: 'Philippines',     form: 'Stock Corporation' },
  { country: 'Poland',          form: 'Spólka Akcyjna' },
  { country: 'Portugal',        form: 'Sociedade Anónima' },
  { country: 'Puerto Rico',     form: 'Corporation' },
  { country: 'Romania',         form: 'Societate pe Actiuni' },
  { country: 'Russia',          form: 'Otkrytoye Aktsionernoy Obshchestvo' },
  { country: 'Saudi Arabia',    form: 'Sharikat Al-Mossahamah' },
  { country: 'Singapore',       form: 'Public Limited Company' },
  { country: 'Slovak Republic', form: 'Akciová Spoločnosť' },
  { country: 'Slovenia',        form: 'Delniska Druzba' },
  { country: 'South Africa',    form: 'Public Limited Company' },
  { country: 'Spain',           form: 'Sociedad Anónima (S.A.)' },
  { country: 'Surinam',         form: 'Naamloze Vennootschap' },
  { country: 'Sweden',          form: 'Publika Aktiebolag (publ)' },
  { country: 'Switzerland',     form: 'Aktiengesellschaft (AG)' },
  { country: 'Thailand',        form: 'Borisat Chamkad (Mahachon)' },
  { country: 'Trinidad and Tobago', form: 'Limited Company' },
  { country: 'Tunisia',         form: 'Société Anonyme' },
  { country: 'Turkey',          form: 'Anonim Şirket (A.Ş.)' },
  { country: 'Ukraine',         form: 'Aktsionerne Tovarystvo Vidkrytogo Typu' },
  { country: 'United Kingdom',  form: 'Public Limited Company (plc)' },
  { country: 'United States Virgin Islands', form: 'Corporation' },
  { country: 'Uruguay',         form: 'Sociedad Anónima' },
  { country: 'Venezuela',       form: 'Sociedad Anónima or Compañía Anónima' }
];
function isPerSeJurisdiction(country) {
  if (!country) return false;
  const c = String(country).trim().toLowerCase();
  return PER_SE_LIST.some(function (p) { return p.country.toLowerCase() === c; });
}
function getPerSeForm(country) {
  if (!country) return null;
  const c = String(country).trim().toLowerCase();
  const match = PER_SE_LIST.find(function (p) { return p.country.toLowerCase() === c; });
  return match ? match.form : null;
}

// =============================================================================
// CHECK-THE-BOX (CTB) FRAMEWORK — Treas. Reg. § 301.7701-3
// =============================================================================
const CTB_RULES = {
  // Default classification absent an election (§ 301.7701-3(b))
  defaults: {
    domestic_eligible_one_member:   { classification: 'disregarded',  electable: true,  note: 'Disregarded as separate from owner; default for SMLLC.' },
    domestic_eligible_two_or_more:  { classification: 'partnership',  electable: true,  note: 'Partnership by default; election to be treated as association (and thus corporation) on Form 8832.' },
    foreign_eligible_all_limited:   { classification: 'association',  electable: true,  note: 'Default to association (corporation) if all members have limited liability under foreign law; election to partnership available.' },
    foreign_eligible_one_member_limited: { classification: 'association', electable: true, note: 'Foreign single-member entity with limited liability defaults to association.' },
    foreign_eligible_one_member_unlimited: { classification: 'disregarded', electable: true, note: 'Foreign single-member entity where the member has unlimited liability defaults to disregarded.' },
    foreign_eligible_two_or_more_at_least_one_unlimited: { classification: 'partnership', electable: true, note: 'Foreign entity with two or more members defaults to partnership if any member has unlimited liability under foreign law.' },
    per_se_foreign: { classification: 'association', electable: false, note: 'Per se foreign corporation under § 301.7701-2(b)(8); classification is fixed by regulation and no election is available.' }
  },
  electionMechanics: {
    form: 'Form 8832 — Entity Classification Election',
    effectiveDate: 'Up to 75 days before, or 12 months after, the date filed (Reg. § 301.7701-3(c)(1)(iii)).',
    fiveYearLimitation: 'Once an election is made, an additional election cannot be made within 60 months unless > 50% ownership change (Reg. § 301.7701-3(c)(1)(iv)).'
  },
  lateElectionRelief: {
    revenueProcedure: 'Rev. Proc. 2009-41',
    window: 'Three years and 75 days from the requested effective date.',
    requirements: [
      'Eligible entity did not timely elect.',
      'Either (a) the entity has not filed a Federal tax or information return for the first year because the election was untimely, or (b) the entity has filed returns consistent with the requested classification.',
      'The entity has reasonable cause for the failure to make the timely election.',
      'Three years and 75 days from the requested effective date have not passed.'
    ],
    procedure: 'File Form 8832 with the IRS service center where the entity files its return, with "FILED PURSUANT TO REV. PROC. 2009-41" written at the top.'
  },
  hybridConcerns: [
    'Hybrid entity treatment may produce different classification in U.S. vs. foreign jurisdiction (e.g., U.S. treats as partnership; foreign jurisdiction treats as corporation).',
    'Dual-resident corporation issues under § 269B and treaty residence tiebreakers.',
    'Reverse hybrid (e.g., U.S. corporation that is fiscally transparent in foreign jurisdiction) raises § 894(c) limitations on treaty benefits.',
    'Anti-hybrid rules under § 267A may disallow deductions on hybrid payments to related parties.'
  ]
};

// =============================================================================
// TREATY / LOB ANALYSIS — for foreign-corp and treaty-eligible routes
// =============================================================================
const TREATY_LOB = {
  description: 'Where a foreign investor seeks treaty-reduced WHT or BPT rates, the applicable U.S. income tax treaty must be analyzed for benefits eligibility under its Limitation on Benefits (LOB) article.',
  commonLOBTests: [
    'Publicly Traded Test — generally requires principal class of shares traded on a recognized stock exchange in the residence state.',
    'Subsidiary of Publicly Traded — requires 50% or more ownership by qualifying publicly traded parent.',
    'Ownership and Base Erosion — at least 50% owned by qualifying residents of the treaty state AND less than 50% of gross income paid or accrued to non-residents in deductible payments.',
    'Active Trade or Business — treaty benefits available with respect to income derived in connection with, or incidental to, an active trade or business in the residence state, where the U.S. activity is substantial in relation to the treaty-state activity.',
    'Derivative Benefits — frequently included in EU-country treaties; qualifying ownership by residents of EU member states that would themselves qualify under a treaty with the U.S. providing equivalent benefits.',
    'Competent Authority (Discretionary) — relief available on request to U.S. Competent Authority where the principal purpose of the establishment of the entity was not the obtaining of treaty benefits.'
  ],
  ctbForTreatyPurposes: 'A separate question from U.S. classification: the entity\'s classification in the residence state and the U.S. classification may diverge (hybrid issues), which can disqualify treaty benefits under § 894(c) or treaty-specific anti-hybrid provisions. Where the U.S. and foreign classifications differ, treaty benefits must be tested separately on the U.S. and foreign sides.',
  practicePoint: 'Where the structure relies on treaty rates (e.g., 5% direct-dividend WHT under a U.S.–Netherlands or U.S.–U.K. treaty), the LOB analysis is not optional and frequently determines whether the structure is viable. Document the qualifying LOB test in the file before issuance.'
};

// =============================================================================
// § 708(b)(2) DIVISION AND MERGER MECHANICS
// =============================================================================
// Relevant when the structuring sits on top of an existing partnership.
// TCJA repealed the technical-termination rule under former § 708(b)(1)(B);
// what remains is the assets-over / assets-up framework for partnership
// divisions and mergers under § 708(b)(2) and Reg. § 1.708-1(c) and (d).
// =============================================================================
const SECTION_708 = {
  divisions: {
    cite: 'I.R.C. § 708(b)(2)(B); Reg. § 1.708-1(d)',
    rule: 'A partnership is divided into two or more partnerships, with one or more resulting partnerships continuing the prior partnership.',
    continuationRule: 'Any resulting partnership whose members own more than 50% of the capital and profits interests in the prior partnership is treated as the continuation of the prior partnership.',
    forms: ['Assets-Over (default)', 'Assets-Up'],
    practicePoint: 'Used to separate operating real estate from passive holdings, segregate § 704(c) layers, or facilitate disparate-investor exits without a sale.'
  },
  mergers: {
    cite: 'I.R.C. § 708(b)(2)(A); Reg. § 1.708-1(c)',
    rule: 'Two or more partnerships combine; resulting partnership is treated as the continuation of any merging partnership whose members own more than 50% of the capital and profits interests in the resulting partnership; all other merging partnerships terminate.',
    forms: ['Assets-Over (default)', 'Assets-Up'],
    practicePoint: 'Asset-over form generally produces preferable § 704(c) outcomes by avoiding triggering events at the partner level.'
  },
  noTechnicalTermination: 'TCJA (P.L. 115-97, § 13504) repealed the former 50%-sale technical-termination rule of § 708(b)(1)(B) effective for tax years beginning after December 31, 2017. Structuring no longer needs to manage the 50%-in-12-months trap; ordinary divisions and mergers under § 708(b)(2) remain available.'
};

// =============================================================================
// RELATED-PARTY DEBT — Thread 2 Module 1
// =============================================================================
// Authorities for the analyzeRelatedPartyDebt function. § 163(j) is the
// dominant authority; the OBBBA (P.L. 119-21, July 4, 2025) permanently
// restored the EBITDA-equivalent ATI addback for tax years beginning after
// December 31, 2024, reversing the EBIT-equivalent regime that applied
// 2022-2024. Rev. Proc. 2026-17 provides a one-shot revocation window for
// RPTB elections made during the EBIT years that may no longer be attractive.
// =============================================================================
const RPD_RULES = {
  section163j: {
    cite: 'I.R.C. § 163(j); Reg. §§ 1.163(j)-1 through 1.163(j)-11',
    rule: 'A taxpayer\'s deduction for business interest expense is limited to the sum of (i) business interest income, (ii) 30% of adjusted taxable income (ATI), and (iii) floor-plan financing interest.',
    obbbaAddback: 'For tax years beginning after December 31, 2024, ATI is computed on an EBITDA-equivalent basis: depreciation, amortization, and depletion are added back. OBBBA (P.L. 119-21, July 4, 2025) made this addback permanent, restoring the more favorable computation that applied 2018-2021 and replacing the EBIT-equivalent regime of 2022-2024.',
    obbbaCfcExclusions: 'OBBBA also excludes Subpart F inclusions, GILTI, and § 78 gross-ups from ATI for tax years beginning after December 31, 2024.',
    capitalizedInterest2026: 'Effective for tax years beginning after December 31, 2025, electively capitalized interest under §§ 263(a) and 263(g) is subject to the § 163(j) limitation and cannot be sheltered from the limit by being charged to inventory or constructed-property basis.',
    floorPlanException: 'Floor-plan financing interest (secured by motor vehicles held for sale or lease) is fully deductible; OBBBA expanded the definition of qualifying motor vehicles.'
  },
  section163j7Election: {
    cite: 'I.R.C. § 163(j)(7); Reg. § 1.163(j)-9',
    rule: 'A real property trade or business (defined under § 469(c)(7)(C)) may elect out of § 163(j). The election is generally irrevocable.',
    tradeoff: 'In exchange for escape from the § 163(j) limitation, the electing business must depreciate nonresidential real property, residential rental property, and qualified improvement property under the Alternative Depreciation System (ADS) — generally longer recovery periods with no bonus depreciation eligibility.',
    obbbaRevocationWindow: 'Rev. Proc. 2026-17 provides a one-shot revocation window for RPTB elections made for tax years beginning in 2022, 2023, or 2024 (the EBIT regime). Revocation must be made by amended return filed by the earlier of October 15, 2026, or the close of the statute of limitations for the election year. The election is treated as if it had never been made.',
    obbbaPlanningPoint: 'The restored EBITDA addback may make the RPTB election less attractive than it appeared under the 2022-2024 EBIT regime, particularly for real estate businesses with material depreciation deductions. Re-run the model under the EBITDA addback before relying on a prior RPTB election or before making a new one.'
  },
  section267: {
    cite: 'I.R.C. § 267',
    rule: 'Losses on sales between related persons are disallowed under § 267(a)(1); the disallowed loss may be recovered on a subsequent disposition by the related transferee, but only to the extent of gain. Matching rules under § 267(a)(2) and (a)(3) defer the payor\'s deduction for accrued but unpaid amounts to a related-person payee until the payee includes the amount in income.'
  },
  section707b: {
    cite: 'I.R.C. § 707(b)',
    rule: 'Loss on a sale or exchange between a partnership and a partner owning (directly or constructively) more than 50% of the capital or profits interest is disallowed (§ 707(b)(1)). Gain on a sale between such related persons is converted to ordinary income to the extent the property is not a capital asset in the transferee\'s hands (§ 707(b)(2)).'
  },
  reg7522d: {
    cite: 'Reg. § 1.752-2(d)',
    rule: 'Where a related person bears the economic risk of loss for a partnership liability, that liability is allocated to the partner to whom the lender is related. Limited de minimis exception under Reg. § 1.752-2(d)(1) where the lender-partner (or related person) holds a 10%-or-less interest in each item of partnership income, gain, loss, deduction and credit and the loan would be qualified nonrecourse financing under § 465(b)(6) if it were not made by a partner.',
    practicePoint: 'Related-party recourse debt destroys the at-risk benefit that ordinary recourse debt provides to non-related partners and may also reallocate basis in ways that frustrate partner-level loss utilization.'
  },
  section385: {
    cite: 'I.R.C. § 385; Reg. § 1.385-1; Notice 94-47; Indmar / Roth Steel common-law factors',
    rule: 'The Service may treat an instrument as stock, as indebtedness, or as part of each, under § 385 and the federal common-law debt-equity factors. The documentation regulations formerly at Reg. § 1.385-2 were removed in 2019 (T.D. 9880); the distribution and funding rules of Reg. § 1.385-3 remain for expanded-group instruments. Documentation practice is now governed by the common-law factors and Notice 94-47 rather than a regulatory checklist.',
    documentationFactors: [
      'Written documentation of an unconditional and legally binding obligation to pay a sum certain on demand or at one or more fixed dates.',
      'Written documentation evidencing creditor\'s rights typical of an arm\'s-length creditor-debtor relationship (e.g., right to enforce, accelerate, sue).',
      'Documentation supporting a reasonable expectation of repayment at the time of issuance (cash-flow projections, asset coverage, debt-service capacity).',
      'Documentation evidencing genuine debtor-creditor conduct after issuance (timely interest payments, enforcement of remedies on default, treatment as debt on financial statements).'
    ],
    practicePoint: 'In the related-party context, contemporaneous documentation is the difference between a respected debt instrument and a recharacterization as equity. Documentation must be created before or contemporaneous with the issuance; backfilled documentation is regularly rejected on examination.'
  },
  antiConduit: {
    cite: 'Reg. § 1.881-3',
    rule: 'A financing arrangement may be recharacterized where (i) it consists of advances of money or property between three or more parties, (ii) at least one of the intermediate parties is a conduit entity, and (iii) but for the conduit, the tax imposed by Chapters 3 or 4 would be greater.',
    practicePoint: 'Multi-party related-party financing chains running through a treaty jurisdiction must be tested for conduit treatment. Where the principal purpose of the structure was treaty-shopping, the intermediate entity is disregarded and full WHT applies to the payments from the U.S. obligor.'
  },
  ahydo: {
    cite: 'I.R.C. § 163(i)',
    rule: 'An applicable high-yield discount obligation (AHYDO) is a corporate debt instrument with (i) a maturity date more than 5 years from issue, (ii) yield to maturity equal to or greater than the applicable federal rate (AFR) plus 5 percentage points, and (iii) significant original issue discount.',
    consequence: 'The disqualified portion of OID (the portion attributable to the excess over AFR + 6 percentage points) is permanently disallowed as a deduction. The remaining OID is deferred until actually paid (rather than accrued).',
    practicePoint: 'AHYDO concerns are common in PIK structures and deeply subordinated paper. The disqualified-portion rule must be modeled before the instrument is finalized; a yield correction by a basis point can move the instrument across the threshold.'
  },
  oid: {
    cite: 'I.R.C. §§ 1272-1275',
    rule: 'OID is included in the holder\'s income (and deducted by the issuer, subject to § 163(j) and § 163(i)) as it economically accrues, generally on a constant-yield basis. PIK interest is OID for these purposes.'
  },
  selfChargedInterest: {
    cite: 'I.R.C. § 469(l)(1)(A)',
    rule: 'Where a passive-activity partner makes a loan to a partnership that conducts a passive activity, a portion of the interest income may be recharacterized as derived from a passive activity (and thus available to absorb passive losses). The self-charged rules are largely beneficial to the partner-lender; the regulatory framework is at Reg. § 1.469-7.'
  }
};

// =============================================================================
// MANAGEMENT FEE CHARACTERIZATION — Thread 2 Module 2
// =============================================================================
// Authorities for analyzeManagementFee. The mgmt-fee module surfaces the
// § 707(a) vs § 707(c) router, the 2015 proposed-reg six-factor disguised-
// payment-for-services test (REG-115452-14; still PROPOSED as of September 2026
// despite the IRS's stated position that the proposed regs reflect
// Congressional intent), and the § 1402(a)(13) SE-tax analysis, including
// the Soroban / Sirius circuit split.
// =============================================================================
const MGMT_FEE_RULES = {
  section707a: {
    cite: 'I.R.C. § 707(a)',
    rule: 'A partner who engages in a transaction with the partnership other than in his capacity as a partner is treated as if he were not a partner for that transaction. Services in a non-partner capacity are treated as services from an independent contractor: the partnership generally deducts the payment under § 162 (subject to capitalization), and the recipient reports the payment as compensation income.'
  },
  section707c: {
    cite: 'I.R.C. § 707(c)',
    rule: 'A guaranteed payment is a payment to a partner for services or for the use of capital that is determined without regard to partnership income. Treated as paid to a non-partner for § 162 deduction purposes, but the recipient reports the payment as ordinary income from the partnership (Schedule K-1, not Form W-2 or 1099). Subject to SE tax in the recipient\'s hands.'
  },
  disguisedPayment: {
    cite: 'I.R.C. § 707(a)(2)(A); Prop. Reg. § 1.707-2 (REG-115452-14, 80 Fed. Reg. 43652, July 23, 2015)',
    status: 'The 2015 proposed regulations remain PROPOSED as of September 2026. The IRS has stated that the proposed regulations generally reflect Congressional intent pending finalization, and practitioners and the Service routinely cite them in this posture.',
    rule: 'An arrangement is treated as a disguised payment for services if (i) a person (the service provider) performs services in a partner capacity or in anticipation of partner status, (ii) there is a related direct or indirect allocation and distribution to the service provider, and (iii) the totality of the facts and circumstances indicate that the arrangement was, in substance, a payment for services rather than a distributive share.',
    sixFactors: [
      {
        key: 'significant_entrepreneurial_risk',
        label: 'Significant Entrepreneurial Risk (SER)',
        weight: 'most heavily weighted',
        summary: 'Whether the service provider\'s allocation is subject to significant entrepreneurial risk relative to the overall risk of the partnership. An allocation that is capped, fixed, or otherwise insulated from risk lacks SER and is presumptively a disguised payment. Per the preamble, an arrangement with SER will generally be respected as a distributive share.'
      },
      {
        key: 'transitory_partner_status',
        label: 'Status as Partner (Transitory vs. Continuing)',
        weight: 'secondary',
        summary: 'Transitory or short-term partner status weighs in favor of disguised-payment characterization. A continuing, long-term partner interest weighs against it.'
      },
      {
        key: 'timing_of_allocation',
        label: 'Timing of Allocations Close to Service Performance',
        weight: 'secondary',
        summary: 'Allocations and distributions made close in time to the performance of services weigh in favor of disguised-payment characterization.'
      },
      {
        key: 'value_of_services',
        label: 'Value-of-Services Relationship to Allocation',
        weight: 'secondary',
        summary: 'Where the size of the allocation correlates closely to the value of the services performed (rather than to the partner\'s overall economic interest in the partnership), the arrangement weighs toward disguised-payment characterization.'
      },
      {
        key: 'short_service_period',
        label: 'Period of Service Relative to Payment',
        weight: 'secondary',
        summary: 'A short period of service preceding a substantial allocation weighs in favor of disguised-payment characterization.'
      },
      {
        key: 'payment_from_net_cash_flow',
        label: 'Net Cash Flow / Distribution Mechanics',
        weight: 'secondary',
        summary: 'Where the allocation is funded from a separate revenue stream or net cash flow segregated from general partnership earnings, the arrangement weighs toward disguised-payment characterization.'
      }
    ],
    practicePoint: 'The SER factor is dispositive in practice. A fee waiver that lacks meaningful entrepreneurial risk (e.g., waived for a one-year period in exchange for a profits interest funded only from gain on the assets purchased with the waived fees, with no cumulative deficit risk to the recipient) will be recharacterized.'
  },
  section1061FeeWaiver: {
    cite: 'I.R.C. § 1061; T.D. 9945 (Reg. §§ 1.1061-1 through 1.1061-6, 86 Fed. Reg. 5452, Jan. 19, 2021)',
    status: 'Final regulations are in effect. The capital-interest exception under Reg. § 1.1061-3(c) is critical to fee-waiver structures.',
    rule: 'An "applicable partnership interest" (API) is a partnership interest transferred to or held in connection with the performance of substantial services in an applicable trade or business. Net long-term capital gain allocated with respect to an API is recharacterized as short-term unless the underlying asset has been held more than three years.',
    capitalInterestException: 'The capital-interest exception (Reg. § 1.1061-3(c)) preserves long-term character for allocations attributable to invested capital, provided the allocation is "Capital Interest Allocation" satisfying the regulatory requirements. Where a fee waiver is structured to feed into a capital interest funded by waived fees, the capital-interest exception will generally NOT apply because the recipient did not contribute its own funds and is not personally liable for any loan funding the capital. Reg. § 1.1061-3(c)(3)(iii)(C).',
    practicePoint: 'The intersection of the 2015 disguised-payment-for-services proposed regs and the 2021 § 1061 final regs is the practical danger zone for fee-waiver structures. A waiver that survives the six-factor disguised-payment test may still be recharacterized as short-term gain under § 1061 if the resulting interest fails the capital-interest exception. Both gates must be cleared.'
  },
  section1402a13: {
    cite: 'I.R.C. § 1402(a)(13)',
    rule: 'The distributive share of any item of income or loss of a "limited partner, as such" is excluded from net earnings from self-employment, except for guaranteed payments described in § 707(c) for services actually rendered to or on behalf of the partnership.',
    taxCourtPosition: 'The Tax Court applies a functional analysis: "limited partner, as such" requires a fact-based inquiry into the partner\'s role, with the result that an active LP partner whose participation is not "generally akin" to that of a passive investor is subject to self-employment tax on the distributive share. Renkemeyer, Campbell & Weaver, LLP v. Comm\'r, 136 T.C. 137 (2011); Soroban Capital Partners LP v. Comm\'r, 161 T.C. 310 (2023) (Soroban I — establishing the functional test); Denham Capital Mgmt. LP v. Comm\'r, T.C. Memo. 2024-114 (Dec. 23, 2024) (first application of the functional test to the partners\' roles); Soroban Capital Partners LP v. Comm\'r, T.C. Memo. 2025-52 (May 28, 2025) (Soroban II — applying the test to the Soroban facts; partners failed).',
    fifthCircuitSplit: 'The Fifth Circuit first rejected the functional approach in Sirius Solutions, L.L.L.P. v. Comm\'r, 165 F.4th 374 (5th Cir. Jan. 16, 2026) (2-1; Graves, J., dissenting), holding that "limited partner" takes its meaning from state-law form and limited liability. On the Government\'s petition for rehearing the panel WITHDREW that opinion and, on August 12, 2026, substituted a per curiam opinion, now captioned K Alain, L.L.L.P. v. Comm\'r, No. 24-60240 (5th Cir. Aug. 12, 2026), holding that the "original public meaning" of "limited partner" is a partner who "plays no significant role in managing or running a business." The outcome (vacate and remand) is unchanged, but state-law status no longer controls: the Fifth Circuit standard is now role-based, asks whether the partner has a significant managerial role, and does not draw the line between permissible participation and disqualifying management. Rehearing en banc was denied; a further petition was possible within 45 days of the substitute opinion. The Tax Court\'s functional test remains on appeal in Denham (1st Cir.) and Soroban (2d Cir.).',
    golsenMechanic: 'The split is mediated by Golsen v. Comm\'r, 54 T.C. 742 (1970), aff\'d on other grounds, 445 F.2d 985 (10th Cir. 1971): the Tax Court applies Sirius in any case appealable to the Fifth Circuit, and refund litigation is governed by the appellate circuit of the chosen district. Controlling authority is therefore a function of appellate jurisdiction — petitioner residence at filing under § 7482(b)(1)(A) (Tax Court), or the district selected for a refund action.',
    pendingChallenges: 'Additional challenges to the functional approach remain pending — see, e.g., Point72 Asset Mgmt., L.P. v. Comm\'r, Docket No. 12752-23 (T.C.) — and a future circuit decision or Supreme Court grant could collapse the split.',
    practicePoint: 'Forum was a planning variable while the January 2026 Sirius opinion stood; since the August 12, 2026 substitute opinion the Fifth Circuit standard is also role-based, and the practical planning posture converges: document the partner\'s role profile (hours, decision authority, holding-out to third parties) in every circuit, and separate any GP or management-company role from the LP interest. Confirm forum and re-confirm if facts move; the standards still differ in articulation and the Denham (1st Cir.) and Soroban (2d Cir.) appeals are pending.'
  },
  section482: {
    cite: 'I.R.C. § 482; Reg. § 1.482-1 et seq.',
    rule: 'In transactions between commonly controlled taxpayers, the Service may allocate income, deductions, credits, or allowances to clearly reflect income. Arm\'s-length pricing is required where the partnership and the management-services entity are under common control.'
  }
};

// =============================================================================
// MEZZANINE DEBT CHARACTERIZATION — Thread 2 Module 3
// =============================================================================
// 13-factor debt-vs-equity test drawn from the Indmar / Roth Steel line and
// Notice 94-47. Aggregate score drives the recommendation: true mezz / true
// debt at the high end, disguised equity at the low end, preferred-equity
// characterization in the middle band.
// =============================================================================
const MEZZ_RULES = {
  thirteenFactorTest: {
    cite: 'Indmar Products Co. v. Comm\'r, 444 F.3d 771 (6th Cir. 2006); Roth Steel Tube Co. v. Comm\'r, 800 F.2d 625 (6th Cir. 1986); Notice 94-47, 1994-1 C.B. 357',
    introduction: 'The federal common-law debt-vs-equity inquiry weighs thirteen non-exclusive factors. No single factor is dispositive; the aggregate determination is one of substance over form.',
    factors: [
      { key: 'name_on_instrument',                label: 'Name on the Instrument',                              summary: 'A note, debenture, or bond is more likely to be respected as debt; an equity certificate weighs toward equity. The label alone is never controlling.' },
      { key: 'fixed_maturity',                    label: 'Fixed Maturity Date',                                 summary: 'A definite maturity date with a sum certain payable supports debt characterization; an open-ended or perpetual instrument weighs toward equity.' },
      { key: 'source_of_payments',                label: 'Source of Payments',                                  summary: 'Payments contingent on partnership earnings or asset performance weigh toward equity; payments from general assets and required regardless of performance support debt.' },
      { key: 'right_to_enforce',                  label: 'Right to Enforce Payment',                            summary: 'A holder\'s contractual right to demand payment, accelerate, and sue on default supports debt; absence of enforcement remedies weighs toward equity.' },
      { key: 'participation_in_management',       label: 'Participation in Management Increased by Default',    summary: 'A holder who receives management or board rights upon nonpayment is functioning more like an equity holder; pure creditor remedies (foreclose, sue) support debt.' },
      { key: 'status_vs_regular_creditors',       label: 'Status Equal to or Inferior to Regular Creditors',    summary: 'Pari passu or senior status with general unsecured creditors supports debt; deep subordination beneath all creditors weighs toward equity.' },
      { key: 'intent_of_parties',                 label: 'Intent of the Parties',                               summary: 'Documented intent in transaction documents, board resolutions, financial statements, and tax returns. Treatment as debt in all four supports debt; inconsistent treatment is fatal.' },
      { key: 'identity_holder_shareholder',       label: 'Identity of Holder and Shareholder',                  summary: 'Where the lender and the equity holder are the same person (or proportionate to equity), the inquiry tightens against debt; arm\'s-length third-party lender supports debt.' },
      { key: 'thin_capitalization',               label: 'Thin or Adequate Capitalization',                     summary: 'A debt-to-equity ratio outside the range a third-party lender would accept weighs toward equity. Real-estate operating partnerships routinely tolerate higher ratios than operating businesses; benchmark to the asset class.' },
      { key: 'subordination',                     label: 'Subordination to or Preference Over Other Indebtedness', summary: 'Mezzanine debt is by definition subordinated to senior debt; this factor is neutral-to-slightly-against in the mezz context, since subordination is genuine commercial practice in this market.' },
      { key: 'ability_to_obtain_outside_financing', label: 'Ability of Obligor to Obtain Outside Financing',    summary: 'Where the partnership could have obtained similar financing from an unrelated lender on comparable terms, the related-party instrument is more likely to be respected as debt; where outside financing would not have been available, the inquiry tilts toward equity.' },
      { key: 'sinking_fund',                      label: 'Sinking Fund Provisions',                             summary: 'A required sinking fund or scheduled principal amortization supports debt; balloon-at-maturity-only with no interim amortization is consistent with mezz but contributes nothing to debt weight.' },
      { key: 'payment_from_earnings',             label: 'Payment of Interest from Earnings',                   summary: 'Interest paid from earnings is consistent with debt; payment of interest only when distributable cash exists, with deferral or PIK accrual otherwise, suggests equity-like contingency.' }
    ],
    aggregateBands: {
      debt: { min: 48, label: 'True debt (mezzanine)', summary: 'The instrument should be respected as bona fide indebtedness for federal tax purposes. § 163 interest deduction available subject to § 163(j); OID and AHYDO testing required.' },
      preferred_equity: { min: 32, label: 'Preferred equity (debt-equity hybrid)', summary: 'The instrument operates as preferred equity. Returns are non-deductible distributions; no interest deduction. Common in real-estate mezz where the senior lender prohibits true subordinated debt at the OpCo.' },
      disguised_equity: { min: 0, label: 'Disguised equity', summary: 'The instrument should be recharacterized as equity. § 163 deduction disallowed; payments are dividends or distributions; potential § 385 documentation failure consequences.' }
    }
  },
  ahydoOverlay: {
    cite: 'I.R.C. § 163(i)',
    rule: 'Where the instrument is respected as debt, the AHYDO rules apply if (i) maturity > 5 years, (ii) significant OID, and (iii) yield to maturity ≥ AFR + 5 percentage points. The disqualified portion (excess of yield over AFR + 6) is permanently disallowed; the remaining OID is deferred until paid.',
    practicePoint: 'Mezz with material PIK accrual frequently flunks the AHYDO yield test. Bifurcation between current-pay and accrual tranches, or capping the PIK accrual, can move the instrument under the threshold.'
  },
  oidOverlay: {
    cite: 'I.R.C. §§ 1272-1275',
    rule: 'PIK interest and discount-issue features produce OID. The issuer accrues interest expense (subject to § 163(j) and § 163(i)) and the holder accrues interest income on a constant-yield basis regardless of cash payment.'
  },
  debtForEquityExchange: {
    cite: 'I.R.C. § 108(e)(8)',
    rule: 'In a partnership context, the contribution of a partnership debt instrument to the partnership in exchange for a partnership interest produces COD income to the extent the debt discharged exceeds the fair market value of the partnership interest issued (§ 108(e)(8); Reg. § 1.108-8). The COD income is allocated among the persons who were partners immediately before the discharge, in accordance with their interests under § 704(b).',
    practicePoint: 'A mezz instrument restructured into preferred equity post-issuance is a debt-for-equity exchange; the COD-income allocation must be modeled. Recourse vs nonrecourse character of the discharged debt affects the timing and partner-level consequences.'
  },
  trueMezzVsPreferredEquity: {
    practicePoint: 'In real-estate practice, the senior lender frequently prohibits subordinated debt at the property-owning OpCo. The mezz instrument is then commonly placed at HoldCo as a true loan against the HoldCo membership interest, or restructured as preferred equity at OpCo. The choice affects (i) debt characterization at the federal level, (ii) UCC vs mortgage foreclosure remedies, (iii) intercreditor flexibility, and (iv) the senior-lender consent requirement.'
  }
};

// =============================================================================
// QUALIFIED OPPORTUNITY ZONE INVESTMENT — Thread 3 Module
// =============================================================================
// OBBBA (P.L. 119-21, July 4, 2025) made the QOZ program permanent and
// established a parallel OZ 2.0 regime that activates January 1, 2027. The
// existing TCJA-designated QOZs (OZ 1.0) run through December 31, 2028; the
// new OBBBA-designated QOZs (OZ 2.0) activate January 1, 2027. The regimes
// differ on deferral mechanics, basis step-up, substantial-improvement
// thresholds, and eligibility criteria. The module surfaces the dead-zone
// trap for gains realized before July 5, 2026 (stuck in OZ 1.0 with the
// hard Dec 31, 2026 recognition) and the K-1 180-day-from-unextended-return-
// due-date workaround that lets pass-through gains roll into Jan 2027
// OZ 2.0 investments.
// =============================================================================
const QOZ_RULES = {
  baseStatute: {
    cite: 'I.R.C. §§ 1400Z-1, 1400Z-2; Reg. §§ 1.1400Z2(a)-1 through 1.1400Z2(f)-1',
    rule: 'A taxpayer may elect to defer recognition of capital gain by investing the gain amount in a Qualified Opportunity Fund (QOF) within 180 days of the gain realization event. The QOF must hold at least 90% of its assets in Qualified Opportunity Zone Property, which includes Qualified Opportunity Zone Business Property and equity or partnership interests in a Qualified Opportunity Zone Business (QOZB).'
  },
  obbbaEnactment: {
    cite: 'OBBBA, P.L. 119-21 (July 4, 2025), Title VII, Subtitle E (Investing in America)',
    rule: 'OBBBA made the QOZ program permanent (no further sunset). A second-round designation cycle opens July 1, 2026 (90-day governor window) with new designations effective January 1, 2027. Existing TCJA-designated QOZs ("OZ 1.0") continue through December 31, 2028; OBBBA-designated QOZs ("OZ 2.0") activate January 1, 2027 alongside the OZ 1.0 designations during a 24-month overlap (calendar 2027 and 2028). Puerto Rico\'s deemed island-wide designation was repealed for the 2.0 cycle and its 1.0 designations sunset a year early, on December 31, 2027 (Rev. Proc. 2026-14). Nominations for the 2.0 cycle are due September 28, 2026, extendable by 30 days to October 28, 2026; the 25% cap is applied to a 2020-census tract map.'
  },
  oz1_vs_oz2: {
    cite: 'I.R.C. § 1400Z-2(b), as amended by OBBBA § 70422; Reg. § 1.1400Z2(b)-1',
    deferralOZ1_0: 'Fixed sunset: deferred gain is recognized on December 31, 2026 (or earlier disposition / inclusion event), regardless of holding period.',
    deferralOZ2_0: 'Rolling 5-year deferral: deferred gain is recognized on the fifth anniversary of the investment in the QOF (or earlier disposition / inclusion event).',
    basisStepUp_OZ1_0: 'Five-year step-up of 10%, seven-year step-up of an additional 5% (15% aggregate) — phased out by the fixed Dec 31, 2026 recognition for investments made after Dec 31, 2019 (7-year) and Dec 31, 2021 (5-year).',
    basisStepUp_OZ2_0: 'Five-year step-up of 10% (standard QOFs); five-year step-up of 30% for Qualified Rural Opportunity Funds (QROFs). Held-10-years exclusion of post-investment appreciation preserved (no sunset on the back-end exclusion).',
    holdingTen: 'Both regimes preserve the post-investment-appreciation exclusion at year 10 (elective basis step-up to FMV on disposition), § 1400Z-2(c). OBBBA added an outer limit for 2.0 investments: the fair-market-value election must be made by the thirtieth anniversary of the investment.'
  },
  substantialImprovement: {
    cite: 'I.R.C. § 1400Z-2(d)(2)(D); Reg. § 1.1400Z2(d)-2(b)(4)',
    standardThreshold: 'For non-rural QOZB property: improvements equal to or exceeding the adjusted basis of the existing structure, measured over a 30-month period beginning after acquisition. Land value is excluded from the test.',
    ruralThreshold: 'Rural QOZB property: 50% substantial-improvement threshold (down from 100%), effective for property acquired after July 4, 2025. OBBBA § 70423.',
    practicePoint: 'The 50% threshold is statutory under OBBBA. Confirm the QOZ is classified as rural under the OBBBA definition (an area other than a city or town with a population over 50,000 and its adjacent urbanized area, drawn from the Consolidated Farm and Rural Development Act) before relying on it; a Qualified Rural Opportunity Fund must hold substantially all of its zone property in such areas.'
  },
  eligibilityChanges: {
    cite: 'I.R.C. § 1400Z-1(c), as amended by OBBBA § 70421',
    rule: 'OBBBA narrowed the QOZ eligibility criteria for the second-round designation: (i) a tract qualifies on income only if median family income does not exceed 70% of the applicable area or statewide median (down from 80%), and a tract qualifying on a 20% poverty rate is disqualified if its median family income exceeds 125% of the applicable median; (ii) the contiguous-tract carveout was repealed; (iii) eligibility is measured on 2020-census tract geography with 2020-2024 ACS data (Rev. Proc. 2026-14). Industry estimates of how many current zones remain fully eligible vary (roughly six in ten by one count) before the 25% cap is applied.',
    practicePoint: 'For OZ 2.0 planning, confirm the target census tract is on the post-OBBBA designation list (effective Jan 1, 2027), not the pre-OBBBA TCJA list. A tract that qualified under OZ 1.0 (low-income community via NMTC parity, or contiguous-tract carveout) may NOT qualify under OZ 2.0.'
  },
  deadZone2026: {
    cite: 'I.R.C. § 1400Z-2(a)(1) flush language; Reg. § 1.1400Z2(a)-1(b)(4) and (c)(8)(iii) (180-day rule for pass-through gains); Notice 2026-40 (June 18, 2026) (transition guidance: legacy benefits preserved, Dec. 31, 2026 inclusion cannot be re-deferred, working-capital safe-harbor milestones, 2026 gains with windows into 2027)',
    rule: 'Capital gains realized before July 5, 2026 are subject to the OZ 1.0 regime, which requires recognition no later than December 31, 2026. The 180-day investment window is therefore the binding constraint: a gain realized on (e.g.) March 1, 2026 has a 180-day deadline of August 28, 2026 — within the OZ 1.0 regime — and any QOF formed after that date cannot accept the deferral election for that gain.',
    workaround: 'For pass-through gains (gain reported on a K-1), the 180-day window may be elected to begin on (i) the date of the partnership\'s gain realization, (ii) the last day of the partnership taxable year, or (iii) the unextended due date of the partnership return for the year of gain (March 15, 2027 for calendar-year partnerships). Reg. § 1.1400Z2(a)-1(c)(8)(iii). Election (iii) lets a K-1 gain realized during calendar-year 2026 roll into a QOF investment as late as September 11, 2027 — squarely within the OZ 2.0 regime.',
    practicePoint: 'For any 2026 gain realization that the taxpayer expects to roll into a QOF, document the election under Reg. § 1.1400Z2(a)-1(c)(8)(iii) on the partnership return for 2026 (filed by March 15, 2027) before the OZ 1.0 / OZ 2.0 boundary closes. Direct-recognition gains (Schedule D / Form 8949) realized before July 5, 2026 do NOT benefit from this workaround and are stuck in OZ 1.0.'
  },
  qozbRequirements: {
    cite: 'I.R.C. § 1400Z-2(d)(3); Reg. § 1.1400Z2(d)-1(d)',
    rule: 'A Qualified Opportunity Zone Business (QOZB) must satisfy (i) 70% tangible-property test (at least 70% of tangible business property is QOZB property); (ii) 50% gross-income test (at least 50% of gross income from active conduct of trade or business in the QOZ — three safe harbors available); (iii) substantial-use test (substantially all use of tangible property is in the QOZ); (iv) less-than-5% nonqualified-financial-property test; and (v) not be a "sin business" (golf, country club, massage parlor, hot tub facility, suntan facility, racetrack, gambling, liquor store). The QOZB sits below the QOF in the structure.'
  }
};

// =============================================================================
// SVG ORGANIZATION CHART — Composable shape vocabulary (v12.0)
// =============================================================================
// Each NODE_TYPE has:
//   primary: { shape, border }   — the outer shape and its border style (solid/dotted)
//   inner:   { shape, border }   — optional nested shape (for DREs, hybrids)
//   fill, stroke, textColor      — colors
//   width, height                — dimensions
//   badge                        — top-right badge text (F, PS, CTB, REIT, etc.)
//   legendDescription            — text shown in auto-generated legend
//
// Shape primitives: 'circle', 'square', 'triangle', 'hexagon', 'parallelogram',
//                   'rounded_rect', 'rect_chamfered'
// Border styles: 'solid' (US-opaque / standard) | 'dotted' (US-transparent /
//                pass-through)
//
// Per Paul's spec (Donovan Legal v12 architecture):
//   Circle           = person
//   Square           = corporation
//   Triangle         = partnership
//   Hexagon          = trust
//   Parallelogram    = property / terminal asset
//   Dotted border    = transparent / pass-through
//   Inner shape      = either the owner (DRE case) or the contradicting
//                      classification dimension (hybrid case)
//
// Hybrid encodings:
//   Forward hybrid (foreign corp in home; US partnership):
//     primary = square dotted (corp form, US-transparent)
//     inner   = triangle solid (US treatment = partnership)
//   Reverse hybrid (US corp; foreign partnership):
//     primary = square solid (US-opaque corp)
//     inner   = triangle dotted (foreign-transparent partnership)
// =============================================================================
const NODE_TYPES = {
  person: {
    label: 'Individual',
    primary: { shape: 'circle', border: 'solid' },
    inner: null,
    fill: '#5fc88e',
    stroke: '#0A4A2A',
    textColor: '#0A4A2A',
    width: 60,
    height: 60,
    badge: null,
    legendDescription: 'Natural person (US or foreign)'
  },
  llc: {
    label: 'LLC',
    primary: { shape: 'triangle', border: 'solid' },
    inner: null,
    fill: '#F5F5F0',
    stroke: '#169B62',
    textColor: '#1a1a1a',
    width: 130,
    height: 80,
    badge: null,
    legendDescription: 'US LLC (default partnership classification)'
  },
  lp: {
    label: 'LP',
    primary: { shape: 'triangle', border: 'solid' },
    inner: null,
    fill: '#F5F5F0',
    stroke: '#169B62',
    textColor: '#1a1a1a',
    width: 130,
    height: 80,
    badge: 'LP',
    legendDescription: 'US Limited Partnership'
  },
  s_corp: {
    label: 'S Corporation',
    primary: { shape: 'square', border: 'solid' },
    inner: null,
    fill: '#F5F5F0',
    stroke: '#C9A961',
    textColor: '#1a1a1a',
    width: 120,
    height: 70,
    badge: 'S',
    legendDescription: 'US S corporation (subchapter S election)'
  },
  c_corp: {
    label: 'C Corporation',
    primary: { shape: 'square', border: 'solid' },
    inner: null,
    fill: '#F5F5F0',
    stroke: '#0A4A2A',
    textColor: '#0A4A2A',
    width: 120,
    height: 70,
    badge: null,
    legendDescription: 'US C corporation'
  },
  dre: {
    label: 'Disregarded Entity',
    primary: { shape: 'triangle', border: 'dotted' },
    inner: { shape: 'circle', border: 'solid' },
    fill: '#F5F5F0',
    stroke: '#8a8b8d',
    textColor: '#1a1a1a',
    width: 130,
    height: 80,
    badge: 'DRE',
    legendDescription: 'Disregarded entity (single owner; transparent for US tax — owner shown inside)'
  },
  foreign_corp: {
    label: 'Foreign Corporation',
    primary: { shape: 'square', border: 'solid' },
    inner: null,
    fill: '#fdfdfa',
    stroke: '#0A4A2A',
    textColor: '#0A4A2A',
    width: 120,
    height: 70,
    badge: 'F',
    legendDescription: 'Foreign corporation (opaque in home jurisdiction and US)'
  },
  foreign_partnership: {
    label: 'Foreign Partnership',
    primary: { shape: 'triangle', border: 'solid' },
    inner: null,
    fill: '#fdfdfa',
    stroke: '#169B62',
    textColor: '#1a1a1a',
    width: 130,
    height: 80,
    badge: 'F',
    legendDescription: 'Foreign partnership (transparent in home and US)'
  },
  per_se_foreign_corp: {
    label: 'Per-Se Foreign Corp.',
    primary: { shape: 'square', border: 'solid' },
    inner: null,
    fill: '#fdfdfa',
    stroke: '#7a1a1a',
    textColor: '#7a1a1a',
    width: 120,
    height: 70,
    badge: 'PS',
    legendDescription: 'Per-se foreign corporation (Reg. § 301.7701-2(b)(8) — mandatory corporate classification)'
  },
  ctb_eligible_foreign: {
    // Forward hybrid: corporation in home, partnership for US (eligible-entity CTB elected or default)
    label: 'CTB-Eligible Foreign Entity',
    primary: { shape: 'square', border: 'dotted' },
    inner: { shape: 'triangle', border: 'solid' },
    fill: '#fdfdfa',
    stroke: '#169B62',
    textColor: '#1a1a1a',
    width: 130,
    height: 80,
    badge: 'CTB',
    legendDescription: 'Foreign eligible entity classified as partnership for US tax (forward hybrid)'
  },
  reverse_hybrid: {
    // Reverse hybrid: US opaque corporation; partnership in home jurisdiction
    label: 'Reverse Hybrid Entity',
    primary: { shape: 'square', border: 'solid' },
    inner: { shape: 'triangle', border: 'dotted' },
    fill: '#fdfdfa',
    stroke: '#0A4A2A',
    textColor: '#0A4A2A',
    width: 130,
    height: 80,
    badge: 'RH',
    legendDescription: 'Reverse hybrid (corporation for US tax; partnership in home jurisdiction) — § 267A risk'
  },
  domestic_trust: {
    label: 'Domestic Trust',
    primary: { shape: 'hexagon', border: 'solid' },
    inner: null,
    fill: '#F5F5F0',
    stroke: '#0A4A2A',
    textColor: '#0A4A2A',
    width: 130,
    height: 70,
    badge: null,
    legendDescription: 'US trust under Reg. § 301.7701-7'
  },
  foreign_grantor_trust: {
    // Foreign grantor trust: transparent (grantor recognized as owner under §§ 671-679)
    label: 'Foreign Grantor Trust',
    primary: { shape: 'hexagon', border: 'dotted' },
    inner: null,
    fill: '#fdfdfa',
    stroke: '#0A4A2A',
    textColor: '#0A4A2A',
    width: 130,
    height: 70,
    badge: 'FGT',
    legendDescription: 'Foreign grantor trust (transparent — grantor is owner under §§ 671-679)'
  },
  foreign_non_grantor_trust: {
    // Foreign non-grantor trust: opaque (separate taxpayer; throwback regime)
    label: 'Foreign Non-Grantor Trust',
    primary: { shape: 'hexagon', border: 'solid' },
    inner: null,
    fill: '#fdfdfa',
    stroke: '#0A4A2A',
    textColor: '#0A4A2A',
    width: 130,
    height: 70,
    badge: 'FNGT',
    legendDescription: 'Foreign non-grantor trust (opaque; throwback regime §§ 665-668)'
  },
  reit: {
    label: 'REIT',
    primary: { shape: 'square', border: 'solid' },
    inner: null,
    fill: '#F5F5F0',
    stroke: '#C9A961',
    textColor: '#0A4A2A',
    width: 120,
    height: 70,
    badge: 'REIT',
    legendDescription: 'Real Estate Investment Trust (§§ 856-859)'
  },
  // v12.2 — Taxable REIT Subsidiary
  trs: {
    label: 'TRS',
    primary: { shape: 'square', border: 'solid' },
    inner: null,
    fill: '#fff8e8',
    stroke: '#7a6010',
    textColor: '#5a4010',
    width: 100,
    height: 60,
    badge: 'TRS',
    legendDescription: 'Taxable REIT Subsidiary (§ 856(l)) — pays corporate tax; used for active-income (e.g., hotel operations under RIDEA)'
  },
  // v12.2 — UPREIT operating partnership (between REIT and PropCo)
  uprt_op: {
    label: 'UPREIT OP',
    primary: { shape: 'triangle', border: 'solid' },
    inner: null,
    fill: '#fdf5e8',
    stroke: '#7a6010',
    textColor: '#5a4010',
    width: 140,
    height: 80,
    badge: 'OP',
    legendDescription: 'UPREIT Operating Partnership (§ 721 contribution vehicle; holds property and issues OP units)'
  },
  qozb_qozf: {
    label: 'QOF / QOZB',
    primary: { shape: 'rect_chamfered', border: 'solid' },
    inner: null,
    fill: '#fdf5e8',
    stroke: '#C9A961',
    textColor: '#0A4A2A',
    width: 120,
    height: 70,
    badge: 'OZ',
    legendDescription: 'Qualified Opportunity Fund or QOZ Business (§§ 1400Z-1, 1400Z-2)'
  },
  qi_1031: {
    label: '§ 1031 Qualified Intermediary',
    primary: { shape: 'rect_chamfered', border: 'dotted' },
    inner: null,
    fill: '#F5F5F0',
    stroke: '#C9A961',
    textColor: '#1a1a1a',
    width: 130,
    height: 70,
    badge: 'QI',
    legendDescription: 'Section 1031 Qualified Intermediary (constructive holder of exchange proceeds)'
  },
  property: {
    label: 'Underlying Property',
    // v13.1 — Property as dashed circle (terminal asset symbol; the dotted boundary marks it as the
    // ultimate underlying real-estate asset, distinguished from operating entities above it).
    primary: { shape: 'circle', border: 'dotted' },
    inner: null,
    fill: '#e8f0e8',
    stroke: '#0A4A2A',
    textColor: '#0A4A2A',
    width: 130,
    height: 130,
    badge: null,
    legendDescription: 'Real property / underlying asset (terminal node; dashed boundary marks the asset)'
  },
  // v12.1 — intermediate (foreign) blocker for Cayman top-of-stack
  intermediate_blocker_foreign: {
    label: 'Foreign Blocker',
    primary: { shape: 'square', border: 'solid' },
    inner: null,
    fill: '#fff8e8',
    stroke: '#5a4a10',
    textColor: '#5a4a10',
    width: 130,
    height: 70,
    badge: 'IB',
    legendDescription: 'Intermediate foreign blocker (top-of-stack, typically Cayman or Bermuda)'
  },
  // v13.0 — Sponsor side: GP entity, ManagementCo, Carry vehicle, Family office
  gp_entity: {
    label: 'GP Entity',
    primary: { shape: 'triangle', border: 'solid' },
    inner: null,
    fill: '#e8f5e8',
    stroke: '#0A4A2A',
    textColor: '#0A4A2A',
    width: 130,
    height: 80,
    badge: 'GP',
    legendDescription: 'General Partner entity (LLC or LP; holds GP capital + management rights)'
  },
  management_company: {
    label: 'ManagementCo',
    primary: { shape: 'square', border: 'solid' },
    inner: null,
    fill: '#f0fcf5',
    stroke: '#019A48',
    textColor: '#0A4A2A',
    width: 130,
    height: 70,
    badge: 'M-Co',
    legendDescription: 'Management Company (often S-corp or LLC; receives base management fee under IMA)'
  },
  carry_vehicle: {
    label: 'Carry Vehicle',
    primary: { shape: 'triangle', border: 'solid' },
    inner: null,
    fill: '#fdf5e8',
    stroke: '#C9A961',
    textColor: '#5a4010',
    width: 130,
    height: 80,
    badge: 'API',
    legendDescription: 'Carry / Promote Vehicle (separate entity holding the API for § 1061; often family-LP for estate planning)'
  },
  family_office_vehicle: {
    label: 'Family Office',
    primary: { shape: 'hexagon', border: 'solid' },
    inner: null,
    fill: '#f5e8f5',
    stroke: '#4a1a4a',
    textColor: '#4a1a4a',
    width: 140,
    height: 70,
    badge: 'FO',
    legendDescription: 'Family Office / estate-planning vehicle (GRAT, IDGT, family LP) above sponsor — preserves principal equity'
  },
  // v13.0 — Multi-tier operating structure: HoldCo, MidCo, OpCo, PropCo
  holdco: {
    label: 'HoldCo',
    primary: { shape: 'triangle', border: 'solid' },
    inner: null,
    fill: '#F5F5F0',
    stroke: '#0A4A2A',
    textColor: '#0A4A2A',
    width: 130,
    height: 80,
    badge: 'HoldCo',
    legendDescription: 'Holding Company tier (top of operating chain; financing flexibility / sometimes REIT vehicle)'
  },
  midco: {
    label: 'MidCo',
    primary: { shape: 'triangle', border: 'solid' },
    inner: null,
    fill: '#F5F5F0',
    stroke: '#169B62',
    textColor: '#1a1a1a',
    width: 130,
    height: 80,
    badge: 'MidCo',
    legendDescription: 'Intermediate tier (between HoldCo and OpCo; debt placement layer / tax planning)'
  },
  propco: {
    label: 'PropCo',
    primary: { shape: 'triangle', border: 'solid' },
    inner: null,
    fill: '#e8f0e8',
    stroke: '#0A4A2A',
    textColor: '#0A4A2A',
    width: 130,
    height: 80,
    badge: 'SPE',
    legendDescription: 'Property Company / Special-Purpose Entity (single-asset; lender bankruptcy-remoteness requirement)'
  },
  // v13.2 — Delaware Statutory Trust (DST)
  dst_trust: {
    label: 'DST',
    primary: { shape: 'hexagon', border: 'solid' },
    inner: null,
    fill: '#f0f5ff',
    stroke: '#1a3a7a',
    textColor: '#1a3a7a',
    width: 140,
    height: 80,
    badge: 'DST',
    legendDescription: 'Delaware Statutory Trust (Rev. Rul. 2004-86; beneficial interests = undivided fractional interests in property for § 1031)'
  },
  // v13.2 — TIC co-owner pool (conceptual marker; each owner renders as individual node)
  tic_owner_pool: {
    label: 'TIC Pool',
    primary: { shape: 'square', border: 'dotted' },
    inner: null,
    fill: '#fdf7e8',
    stroke: '#8a6010',
    textColor: '#5a4010',
    width: 140,
    height: 80,
    badge: 'TIC',
    legendDescription: 'Tenant-in-Common arrangement (Rev. Proc. 2002-22; not an entity for tax — each co-owner holds undivided fractional interest)'
  },
  // v13.3 — Tax-credit investor (LIHTC or ITC; typically institutional under CRA mandate)
  tax_credit_investor: {
    label: 'Tax-Credit Investor',
    primary: { shape: 'square', border: 'solid' },
    inner: null,
    fill: '#e8f5fa',
    stroke: '#1a5a7a',
    textColor: '#1a3a5a',
    width: 140,
    height: 75,
    badge: 'TCI',
    legendDescription: 'Tax-Credit Investor — LIHTC (§ 42) or ITC (§ 48); typically institutional (bank under CRA mandate) holding 99.99% LP'
  },
  // v13.3 — Project LP (LIHTC or solar; holds underlying property + receives credits)
  project_lp: {
    label: 'Project LP',
    primary: { shape: 'triangle', border: 'solid' },
    inner: null,
    fill: '#f5f5e8',
    stroke: '#5a5a10',
    textColor: '#3a3a10',
    width: 140,
    height: 85,
    badge: 'PLP',
    legendDescription: 'Project Limited Partnership (holds property; receives § 42 LIHTC / § 48 ITC; passes credits + losses to LP)'
  }
};

// Note: NODE_TYPES has 18 entries — 17 entity types per the legend plus
// `property` (terminal asset). v12.0 adds `reverse_hybrid` (§ 267A-relevant)
// to the pre-v12.0 17-type catalog.

// =============================================================================
// EDGE_KINDS — v12.0 expanded vocabulary (4 → 10 kinds)
// =============================================================================
// Each kind has stroke color, stroke width, dash pattern, arrow style, and
// label description (for legend). Distribution_waterfall and fee_flow carry
// label content (tier or fee type) populated per-edge at render time.
// =============================================================================
const EDGE_KINDS = {
  // --- Ownership (5 classes) ---
  ownership: {
    label: 'Ownership (common equity)',
    stroke: '#1a1a1a',
    strokeWidth: 1.5,
    dasharray: null,
    arrow: 'none'
  },
  ownership_preferred: {
    label: 'Ownership (preferred equity)',
    stroke: '#C9A961',
    strokeWidth: 2.0,
    dasharray: null,
    arrow: 'none'
  },
  ownership_gp: {
    label: 'GP interest (general partner)',
    stroke: '#0A4A2A',
    strokeWidth: 2.5,
    dasharray: null,
    arrow: 'none'
  },
  ownership_carry: {
    label: 'Carry / profits interest (§ 1061 API)',
    stroke: '#019A48',
    strokeWidth: 1.5,
    dasharray: '3 3',
    arrow: 'none'
  },
  // --- Governance ---
  management: {
    label: 'Management / governance (no economic interest)',
    stroke: '#169B62',
    strokeWidth: 1.25,
    dasharray: '4 3',
    arrow: 'open'
  },
  // --- Debt (3 seniorities) ---
  debt_senior: {
    label: 'Senior debt',
    stroke: '#5a1010',
    strokeWidth: 1.75,
    dasharray: '6 2',
    arrow: 'closed'
  },
  debt_mezzanine: {
    label: 'Mezzanine debt',
    stroke: '#7a1a1a',
    strokeWidth: 1.5,
    dasharray: '6 3',
    arrow: 'closed'
  },
  debt_subordinated: {
    label: 'Subordinated debt',
    stroke: '#9a3a3a',
    strokeWidth: 1.25,
    dasharray: '4 4',
    arrow: 'closed'
  },
  // Generic debt (backward compatibility — used by older preset/derivation code)
  debt: {
    label: 'Debt (seniority unspecified)',
    stroke: '#7a1a1a',
    strokeWidth: 1.25,
    dasharray: '6 2',
    arrow: 'closed'
  },
  // --- Distribution / fees ---
  distribution_waterfall: {
    label: 'Distribution waterfall tier',
    stroke: '#C9A961',
    strokeWidth: 1.25,
    dasharray: '2 4',
    arrow: 'open'
  },
  fee_flow: {
    label: 'Fee flow (mgmt / acq / disp / etc.)',
    stroke: '#5a6a3a',
    strokeWidth: 1.0,
    dasharray: '1 3',
    arrow: 'open'
  },
  // --- Property / service ---
  property_interest: {
    label: 'Property interest',
    stroke: '#0A4A2A',
    strokeWidth: 1.5,
    dasharray: '2 2',
    arrow: 'none'
  },
  service_contract: {
    label: 'Service contract (PM, AM, brand, etc.)',
    stroke: '#5a6a3a',
    strokeWidth: 1.0,
    dasharray: '5 3 1 3',
    arrow: 'open'
  }
};

// =============================================================================
// DIAGRAM LAYOUT — Auto-layout constants
// =============================================================================
const DIAGRAM_LAYOUT = {
  canvasWidth: 760,
  canvasHeight: 520,
  layerHeight: 110,           // vertical spacing between layers
  layerTopMargin: 40,
  nodeMinSpacing: 36,         // minimum horizontal gap between nodes within a layer
  snapGrid: 12,               // drag snap-to-grid in pixels
  // Layer ordering (top to bottom)
  layerOrder: ['sponsor', 'investors', 'intermediate_blocker', 'blocker', 'target', 'tier_below', 'qoz', 'property']
};

// =============================================================================
// STRUCT_PRESETS — Pre-populated structural archetypes (v11.3)
// =============================================================================
// Each preset is a partial state-shape merged into defaultState() on apply.
// Practitioners pick a preset to bootstrap inputs for a common deal type, then
// customize. Some presets fully render in v11.x; others are scaffolded for the
// v12 sponsor / REIT / multi-tier / multi-blocker architecture. The `renderQuality`
// field flags which is which.
//
// renderQuality:
//   'full'      — diagram and memo render correctly in v11.x
//   'partial'   — investor and entity inputs populate; diagram lacks sponsor /
//                 multi-tier / multi-blocker rendering until v12
//   'scaffold'  — preset populates state but key features (REIT, DST, UPREIT,
//                 LIHTC, tax-equity) await v12+ analysis modules; user sees a
//                 functional but incomplete representation
// =============================================================================
const STRUCT_PRESETS = {
  single_member_llc: {
    label: 'Single-Member LLC',
    emoji: '🏠',
    description: 'One owner, one property, disregarded for tax',
    authority: 'Reg. § 301.7701-3',
    tier: 'direct',
    renderQuality: 'full',
    state: {
      project_name: 'Example Single-Member Holding LLC',
      jurisdiction: 'DE',
      asset_type: 'real_estate_operating',
      deal_size: '2500000',
      investors: [
        { id: 'm1', label: 'Sole Member', route: 'domestic_individual', pct: 100 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'one_member',
      ctb_election: 'default'
    }
  },

  friends_and_family: {
    label: 'Friends & Family LLC',
    emoji: '👥',
    description: '2–8 domestic individuals, no blocker, simple capital + carry',
    authority: 'Reg. § 301.7701-3 / § 761(a)',
    tier: 'direct',
    renderQuality: 'full',
    state: {
      project_name: 'Example Friends & Family RE LLC',
      jurisdiction: 'DE',
      asset_type: 'real_estate_operating',
      deal_size: '5000000',
      investors: [
        { id: 'ff1', label: 'Member 1 (Managing)', route: 'domestic_individual', pct: 25 },
        { id: 'ff2', label: 'Member 2', route: 'domestic_individual', pct: 25 },
        { id: 'ff3', label: 'Member 3', route: 'domestic_individual', pct: 20 },
        { id: 'ff4', label: 'Member 4', route: 'domestic_individual', pct: 15 },
        { id: 'ff5', label: 'Member 5', route: 'domestic_individual', pct: 15 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default'
    }
  },

  sponsor_capital_jv: {
    label: 'Sponsor + Capital Partner JV',
    emoji: '🤝',
    description: 'Two-party JV — sponsor with promote waterfall over capital-partner pref',
    authority: '§ 704(b) PIP-based JV',
    tier: 'direct',
    renderQuality: 'full', // v13.0.1: sponsor side now ships in v13.0
    state: {
      project_name: 'Example Sponsor-Capital JV',
      jurisdiction: 'DE',
      asset_type: 'real_estate_development',
      deal_size: '25000000',
      investors: [
        { id: 'cap', label: 'Capital Partner LP', route: 'domestic_individual', pct: 90 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default',
      mgmt_fee_present: true,
      mgmt_fee_recipient_type: 'partner',
      mgmt_fee_amount_basis: 'percentage_aum',
      mgmt_fee_amount: '500000',
      mgmt_fee_arm_length: true,
      mgmt_fee_characterization_intended: 'section_707c',
      mgmt_fee_se_tax_concern: true,
      mgmt_fee_forum_jurisdiction: 'default_functional',
      // v13.0.1 — sponsor side configured (sponsor now its own cluster, not an investor)
      sponsor_present: true,
      sponsor_structure: 'mgmt_co_plus_gp',
      sponsor_mgmt_co_form: 'llc',
      sponsor_gp_form: 'llc'
    }
  },

  domestic_only_fund: {
    label: 'Domestic-Only Fund',
    emoji: '🏛️',
    description: 'Sponsor + multiple US LPs; standard 1.5/20 with 8% pref',
    authority: 'Standard PE fund — § 707(c) / § 1061',
    tier: 'institutional',
    renderQuality: 'full', // v13.0.1: sponsor side now ships in v13.0
    state: {
      project_name: 'Example Domestic Real Estate Fund I',
      jurisdiction: 'DE',
      asset_type: 'investment_fund',
      deal_size: '150000000',
      investors: [
        { id: 'lp1', label: 'LP 1 — Family Office', route: 'domestic_individual', pct: 25 },
        { id: 'lp2', label: 'LP 2 — Endowment', route: 'tax_exempt', pct: 25 },
        { id: 'lp3', label: 'LP 3 — HNW Individual', route: 'domestic_individual', pct: 20 },
        { id: 'lp4', label: 'LP 4 — Trust', route: 'domestic_trust', trustSub: 'non_grantor', pct: 16 },
        { id: 'lp5', label: 'LP 5 — Individual', route: 'domestic_individual', pct: 14 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default',
      mgmt_fee_present: true,
      mgmt_fee_recipient_type: 'partner',
      mgmt_fee_amount_basis: 'percentage_aum',
      mgmt_fee_amount: '2250000',
      mgmt_fee_arm_length: true,
      mgmt_fee_characterization_intended: 'section_707c',
      mgmt_fee_se_tax_concern: true,
      mgmt_fee_forum_jurisdiction: 'default_functional',
      // v13.0.1 — institutional sponsor side (S-corp ManagementCo, LLC GP, separate carry vehicle for vertical-slice)
      sponsor_present: true,
      sponsor_structure: 'mgmt_co_plus_gp_plus_carry_vehicle',
      sponsor_carry_in_separate_vehicle: true,
      sponsor_mgmt_co_form: 's_corp',
      sponsor_gp_form: 'llc'
    }
  },

  mixed_domestic_foreign: {
    label: 'Mixed Domestic + Foreign Fund',
    emoji: '🌐',
    description: 'US LPs + offshore feeder + foreign LPs; C-corp blocker for foreign + tax-exempt',
    authority: '§ 897 / § 892 / § 511',
    tier: 'institutional',
    renderQuality: 'full',
    state: {
      project_name: 'Example Mixed Fund I',
      jurisdiction: 'DE',
      asset_type: 'real_estate_operating',
      deal_size: '300000000',
      investors: [
        { id: 'gp', label: 'GP / Sponsor', route: 'domestic_individual', pct: 2 },
        { id: 'lp1', label: 'US Family Office', route: 'domestic_individual', pct: 15 },
        { id: 'lp2', label: 'US Pension Trust', route: 'tax_exempt', pct: 15 },
        { id: 'lp3', label: 'German Family Office', route: 'foreign_individual', country: 'Germany', pct: 12 },
        { id: 'lp4', label: 'Cayman Fund-of-Funds', route: 'foreign_corporation', country: 'Cayman', pct: 18 },
        { id: 'lp5', label: 'Netherlands Pension (QFPF)', route: 'foreign_pension', country: 'Netherlands', pct: 13 },
        { id: 'lp6', label: 'US HNW Individual', route: 'domestic_individual', pct: 12 },
        { id: 'lp7', label: 'Domestic Non-Grantor Trust', route: 'domestic_trust', trustSub: 'non_grantor', pct: 13 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default',
      mgmt_fee_present: true,
      mgmt_fee_recipient_type: 'partner',
      mgmt_fee_amount_basis: 'percentage_aum',
      mgmt_fee_amount: '4500000',
      mgmt_fee_arm_length: true,
      mgmt_fee_characterization_intended: 'section_707c',
      mgmt_fee_se_tax_concern: true,
      mgmt_fee_forum_jurisdiction: 'default_functional',
      mezz_present: true,
      mezz_principal: '30000000',
      mezz_stated_rate: '11.5',
      mezz_maturity_years: '7',
      mezz_subordination: 'mezzanine'
    }
  },

  tax_exempt_heavy: {
    label: 'Tax-Exempt Heavy Fund',
    emoji: '🎓',
    description: 'UBTI-blocking via C-corp blocker; § 514(c)(9) fractions-rule alternative surfaced',
    authority: '§ 511 / § 514(c)(9)',
    tier: 'institutional',
    renderQuality: 'full',
    state: {
      project_name: 'Example Tax-Exempt Institutional Fund',
      jurisdiction: 'DE',
      asset_type: 'real_estate_operating',
      deal_size: '200000000',
      investors: [
        { id: 'gp', label: 'GP / Sponsor', route: 'domestic_individual', pct: 2 },
        { id: 'lp1', label: 'University Endowment', route: 'tax_exempt', pct: 25 },
        { id: 'lp2', label: 'Public Pension Fund', route: 'tax_exempt', pct: 25 },
        { id: 'lp3', label: 'Private Foundation', route: 'tax_exempt', pct: 18 },
        { id: 'lp4', label: 'Corporate Pension Trust', route: 'tax_exempt', pct: 15 },
        { id: 'lp5', label: 'US HNW Co-Investor', route: 'domestic_individual', pct: 15 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default',
      mgmt_fee_present: true,
      mgmt_fee_recipient_type: 'partner',
      mgmt_fee_amount_basis: 'percentage_aum',
      mgmt_fee_amount: '3000000',
      mgmt_fee_arm_length: true,
      mgmt_fee_characterization_intended: 'section_707c',
      mgmt_fee_se_tax_concern: true,
      mgmt_fee_forum_jurisdiction: 'default_functional'
    }
  },

  swf_vehicle: {
    label: 'Sovereign Wealth Fund Vehicle',
    emoji: '🏰',
    description: '§ 892 blocker insulating SWF from commercial-activity taint',
    authority: '§ 892 / Reg. § 1.892-5T',
    tier: 'institutional',
    renderQuality: 'full',
    state: {
      project_name: 'Example SWF Co-Investment Vehicle',
      jurisdiction: 'DE',
      asset_type: 'real_estate_operating',
      deal_size: '500000000',
      investors: [
        { id: 'gp', label: 'GP / Sponsor', route: 'domestic_individual', pct: 1 },
        { id: 'swf1', label: 'Sovereign Wealth Fund', route: 'swf', country: 'Saudi Arabia', pct: 60 },
        { id: 'lp1', label: 'US Institutional Co-Investor', route: 'tax_exempt', pct: 25 },
        { id: 'lp2', label: 'US HNW Co-Investor', route: 'domestic_individual', pct: 14 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default'
    }
  },

  cayman_us_stack: {
    label: 'Cayman / US Blocker Stack',
    emoji: '🇰🇾',
    description: 'Foreign LPs → Cayman master → US C-corp blocker → fund. Treaty + § 894 anti-conduit overlay',
    authority: '§ 894 / § 7701(l) / § 892',
    tier: 'institutional',
    renderQuality: 'full', // v13.0.1: v12.1 ships Cayman top-of-stack intermediate blocker
    state: {
      project_name: 'Example Cayman / US Master Fund Stack',
      jurisdiction: 'DE',
      asset_type: 'real_estate_operating',
      deal_size: '400000000',
      investors: [
        { id: 'lp1', label: 'Foreign Family Office (DE)', route: 'foreign_individual', country: 'Germany', pct: 22 },
        { id: 'lp2', label: 'Foreign HNW (UK)', route: 'foreign_individual', country: 'United Kingdom', pct: 19 },
        { id: 'lp3', label: 'Foreign Corp (Cayman)', route: 'foreign_corporation', country: 'Cayman', pct: 25 },
        { id: 'lp4', label: 'Foreign Non-Grantor Trust', route: 'foreign_trust', country: 'Luxembourg', trustSub: 'non_grantor', pct: 14 },
        { id: 'lp5', label: 'US Co-Investor', route: 'domestic_individual', pct: 20 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default',
      treaty_country: 'United Kingdom',
      treaty_lob_test: 'derivative_benefits',
      // v13.0.1 — Cayman top-of-stack intermediate blocker (v12.1)
      blocker_strategy: 'auto_shared',
      blocker_use_intermediate: true,
      blocker_intermediate_jurisdiction: 'KY',
      // v13.0.1 — sponsor side (v13.0)
      sponsor_present: true,
      sponsor_structure: 'mgmt_co_plus_gp',
      sponsor_mgmt_co_form: 's_corp',
      sponsor_gp_form: 'llc'
    }
  },

  private_dc_reit: {
    label: 'Private REIT — Domestically Controlled',
    emoji: '🏢',
    description: 'DC-REIT (>50% US-owned); shares NOT USRPI on disposition by foreign holders',
    authority: '§ 856 / § 897(h)(4)',
    tier: 'reit',
    renderQuality: 'partial', // v12.2: REIT module operational; entity-classification recommendation expansion is v12.3+
    state: {
      project_name: 'Example Private DC-REIT',
      jurisdiction: 'MD', // most REITs are MD due to favorable corporate law
      asset_type: 'real_estate_operating',
      deal_size: '500000000',
      investors: [
        { id: 'gp', label: 'Sponsor', route: 'domestic_individual', pct: 5 },
        { id: 'lp1', label: 'US Institutional 1', route: 'tax_exempt', pct: 30 },
        { id: 'lp2', label: 'US Institutional 2', route: 'tax_exempt', pct: 20 },
        { id: 'lp3', label: 'Foreign Investor (will hold non-USRPI DC-REIT shares)', route: 'foreign_corporation', country: 'Cayman', pct: 30 },
        { id: 'lp4', label: 'US HNW', route: 'domestic_individual', pct: 15 }
      ],
      proposed_entity_type: 'us_llc', // REIT is overlay; underlying entity classification handled separately
      proposed_member_count: 'two_or_more',
      ctb_election: 'elect_corp', // REIT is a corporation
      // v12.2 — REIT state
      reit_present: true,
      reit_domestically_controlled: 'dc',
      reit_public_or_private: 'private',
      reit_structure: 'standalone',
      reit_us_ownership_pct: '70',
      reit_distribution_compliance: 'planned_on_track'
    }
  },

  fc_reit: {
    label: 'Foreign-Controlled REIT',
    emoji: '🌍',
    description: 'FC-REIT — shares ARE USRPI on disposition; § 897(k) public-trading carve-out if applicable',
    authority: '§ 856 / § 897(k)(2)',
    tier: 'reit',
    renderQuality: 'partial',
    state: {
      project_name: 'Example Foreign-Controlled REIT',
      jurisdiction: 'MD',
      asset_type: 'real_estate_operating',
      deal_size: '400000000',
      investors: [
        { id: 'gp', label: 'Sponsor', route: 'domestic_individual', pct: 2 },
        { id: 'lp1', label: 'Foreign Institutional 1', route: 'foreign_corporation', country: 'Cayman', pct: 35 },
        { id: 'lp2', label: 'Foreign Institutional 2', route: 'foreign_corporation', country: 'Singapore', pct: 25 },
        { id: 'lp3', label: 'Foreign Family Office', route: 'foreign_individual', country: 'United Arab Emirates', pct: 18 },
        { id: 'lp4', label: 'US Co-Investor', route: 'domestic_individual', pct: 20 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'elect_corp',
      // v12.2 — REIT state
      reit_present: true,
      reit_domestically_controlled: 'fc',
      reit_public_or_private: 'public_listed_nyse_nasdaq',
      reit_structure: 'standalone',
      reit_us_ownership_pct: '22',
      reit_share_class_5pct_test_concern: false,
      reit_distribution_compliance: 'planned_on_track'
    }
  },

  hotel_ridea_reit: {
    label: 'Hotel RIDEA REIT',
    emoji: '🏨',
    description: 'DC-REIT + TRS + brand manager; active hotel income routed through TRS',
    authority: '§ 856(l) / RIDEA (H.R. 4337, P.L. 110-289)',
    tier: 'reit',
    renderQuality: 'partial',
    state: {
      project_name: 'Example Hotel RIDEA REIT',
      jurisdiction: 'MD',
      asset_type: 'real_estate_operating',
      deal_size: '350000000',
      investors: [
        { id: 'gp', label: 'Hotel Sponsor', route: 'domestic_individual', pct: 5 },
        { id: 'lp1', label: 'US Institutional', route: 'tax_exempt', pct: 35 },
        { id: 'lp2', label: 'US HNW Investors (collective)', route: 'domestic_individual', pct: 40 },
        { id: 'lp3', label: 'Foreign Investor (DC-REIT preserves non-USRPI)', route: 'foreign_corporation', country: 'Cayman', pct: 20 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'elect_corp',
      // v12.2 — REIT state (UPREIT + TRS for hotel operations)
      reit_present: true,
      reit_domestically_controlled: 'dc',
      reit_public_or_private: 'private',
      reit_structure: 'umbrella_partnership_uprt',
      reit_us_ownership_pct: '80',
      reit_trs_present: true,
      reit_distribution_compliance: 'planned_on_track'
    }
  },

  senior_housing_ridea: {
    label: 'Senior Housing RIDEA',
    emoji: '🏥',
    description: 'DC-REIT + TRS operator; healthcare regulatory overlay',
    authority: '§ 856(l) / Stark Law exemption flag',
    tier: 'reit',
    renderQuality: 'partial',
    state: {
      project_name: 'Example Senior Housing RIDEA REIT',
      jurisdiction: 'MD',
      asset_type: 'real_estate_operating',
      deal_size: '250000000',
      investors: [
        { id: 'gp', label: 'Healthcare Sponsor', route: 'domestic_individual', pct: 5 },
        { id: 'lp1', label: 'Healthcare-Focused Institutional', route: 'tax_exempt', pct: 45 },
        { id: 'lp2', label: 'US HNW', route: 'domestic_individual', pct: 30 },
        { id: 'lp3', label: 'Foreign Institutional', route: 'foreign_corporation', country: 'Cayman', pct: 20 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'elect_corp',
      // v12.2 — REIT state (UPREIT + TRS for senior housing operations under RIDEA)
      reit_present: true,
      reit_domestically_controlled: 'dc',
      reit_public_or_private: 'private',
      reit_structure: 'umbrella_partnership_uprt',
      reit_us_ownership_pct: '80',
      reit_trs_present: true,
      reit_distribution_compliance: 'planned_on_track'
    }
  },

  dst_1031: {
    label: '§ 1031 DST Sponsor Program',
    emoji: '🔄',
    description: 'Sponsored Delaware Statutory Trust — multiple 1031 exchangers acquire beneficial interests',
    authority: 'Rev. Rul. 2004-86',
    tier: 'specialty',
    renderQuality: 'full', // v13.2: DST analytical module operational
    state: {
      project_name: 'Example § 1031 DST Program',
      jurisdiction: 'DE',
      asset_type: 'real_estate_operating',
      deal_size: '50000000',
      investors: [
        { id: 'i1', label: '1031 Exchanger 1', route: 'domestic_individual', pct: 22 },
        { id: 'i2', label: '1031 Exchanger 2', route: 'domestic_individual', pct: 22 },
        { id: 'i3', label: '1031 Exchanger 3', route: 'domestic_individual', pct: 16 },
        { id: 'i4', label: '1031 Exchanger 4', route: 'domestic_trust', trustSub: 'grantor', pct: 15 },
        { id: 'i5', label: '1031 Exchanger 5', route: 'domestic_individual', pct: 25 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default',
      // v13.2 — DST state (Rev. Rul. 2004-86 compliant configuration; master lease + springing LLC)
      dst_present: true,
      dst_sponsor_offering: true,
      dst_offering_closed: true,
      dst_can_renegotiate_debt: false,
      dst_can_reinvest_proceeds: false,
      dst_capex_restricted_to_normal: true,
      dst_reserves_short_term_us_debt_only: true,
      dst_distributions_at_least_annual: true,
      dst_springing_llc_provision: true,
      dst_master_lease_present: true,
      dst_exchanger_count: '5',
      // Sponsor side configured
      sponsor_present: true,
      sponsor_structure: 'mgmt_co_plus_gp',
      sponsor_mgmt_co_form: 'llc',
      sponsor_gp_form: 'llc'
    }
  },

  tic_1031: {
    label: '§ 1031 TIC Arrangement',
    emoji: '🔁',
    description: 'Tenant-in-common (≤ 35 owners); QI-coordinated exchange',
    authority: 'Rev. Proc. 2002-22',
    tier: 'specialty',
    renderQuality: 'full', // v13.2: TIC analytical module operational
    state: {
      project_name: 'Example § 1031 TIC Acquisition',
      jurisdiction: 'DE',
      asset_type: 'real_estate_operating',
      deal_size: '25000000',
      investors: [
        { id: 'tic1', label: 'TIC Holder 1', route: 'domestic_individual', pct: 35 },
        { id: 'tic2', label: 'TIC Holder 2', route: 'domestic_individual', pct: 30 },
        { id: 'tic3', label: 'TIC Holder 3', route: 'domestic_trust', trustSub: 'grantor', pct: 20 },
        { id: 'tic4', label: 'TIC Holder 4', route: 'domestic_individual', pct: 15 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default',
      // v13.2 — TIC state (Rev. Proc. 2002-22 compliant; 4 co-owners well within 35-cap)
      tic_present: true,
      tic_owner_count: '4',
      tic_unanimity_for_major_decisions: true,
      tic_management_agreement_annual: true,
      tic_proportionate_profit_loss_sharing: true,
      tic_proportionate_debt_sharing: true,
      tic_individual_transfer_rights: true,
      tic_lender_consent_required: true,
      tic_sponsor_payments_fmv: true,
      tic_business_activities_minimal: true
    }
  },

  uprt_contribution: {
    label: '§ 721 UPREIT Contribution',
    emoji: '🏗️',
    description: 'Property owner contributes to OP for OP units; tax-deferred + tax-protection agreement',
    authority: '§ 721 / § 721(c) anti-abuse',
    tier: 'specialty',
    renderQuality: 'partial', // v13.0.1: REIT + UPREIT OP render; full contributor-side entity modeling still v13.1+
    state: {
      project_name: 'Example § 721 UPREIT Contribution',
      jurisdiction: 'MD',
      asset_type: 'real_estate_operating',
      deal_size: '75000000',
      investors: [
        { id: 'contrib1', label: 'Property Contributor (receives OP units)', route: 'domestic_individual', pct: 30 },
        { id: 'contrib2', label: 'Property Contributor 2 (Trust)', route: 'domestic_trust', trustSub: 'dynasty', pct: 20 },
        { id: 'existing_lp', label: 'Existing OP Holders', route: 'domestic_individual', pct: 50 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default',
      // v13.0.1 — REIT + UPREIT OP rendering via v12.2 REIT module
      reit_present: true,
      reit_domestically_controlled: 'dc',
      reit_public_or_private: 'private',
      reit_structure: 'umbrella_partnership_uprt',
      reit_us_ownership_pct: '85',
      reit_uprt_contribution_planned: true,
      reit_distribution_compliance: 'planned_on_track'
    }
  },

  lihtc_syndication: {
    label: 'LIHTC Syndication',
    emoji: '🏘️',
    description: '§ 42 affordable housing — tax-credit investor LP + developer GP + project LP',
    authority: '§ 42 / § 47 (if historic)',
    tier: 'specialty',
    renderQuality: 'full', // v13.3: LIHTC analytical module operational
    state: {
      project_name: 'Example LIHTC Project Partnership',
      jurisdiction: 'DE',
      asset_type: 'real_estate_development',
      deal_size: '40000000',
      investors: [
        { id: 'dev_gp', label: 'Developer GP', route: 'domestic_individual', pct: 1 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default',
      // v13.3 — LIHTC state (9% credits with QCT/DDA boost; 30-year extended compliance)
      lihtc_present: true,
      lihtc_credit_type: '9_pct',
      lihtc_qualified_basis_calc: 'qct_dda_130_boost',
      lihtc_compliance_period_years: '15',
      lihtc_extended_use_period: '15',
      lihtc_yield_to_investor_target_pct: '5.5',
      lihtc_state_credits_present: false,
      lihtc_historic_credits_present: false,
      // v13.3 — Sponsor side (developer is the GP)
      sponsor_present: true,
      sponsor_structure: 'mgmt_co_plus_gp',
      sponsor_mgmt_co_form: 'llc',
      sponsor_gp_form: 'llc'
    }
  },

  solar_tax_equity: {
    label: 'Tax-Equity Solar Overlay',
    emoji: '⚡',
    description: '§ 48 ITC tax-equity flip on RE asset; partnership flip post-IRA',
    authority: '§ 48 / § 6418 transferability',
    tier: 'specialty',
    renderQuality: 'full', // v13.3: Solar tax-equity analytical module operational
    state: {
      project_name: 'Example Solar Tax-Equity Flip',
      jurisdiction: 'DE',
      asset_type: 'real_estate_development',
      deal_size: '15000000',
      investors: [
        { id: 'developer_sponsor', label: 'Solar Developer (post-flip 95%)', route: 'domestic_individual', pct: 1 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default',
      // v13.3 — Solar tax-equity state (partnership flip with domestic content + energy community adders)
      solar_tax_equity_present: true,
      solar_tax_equity_structure: 'partnership_flip',
      solar_itc_base_rate_pct: '30',
      solar_energy_community_adder: true,
      solar_domestic_content_adder: true,
      solar_low_income_adder: false,
      solar_pre_flip_investor_pct: '99',
      solar_post_flip_investor_pct: '5',
      solar_flip_trigger: 'irr_hurdle',
      solar_target_irr_pct: '8',
      // v13.3 — Sponsor side
      sponsor_present: true,
      sponsor_structure: 'mgmt_co_plus_gp',
      sponsor_mgmt_co_form: 'llc',
      sponsor_gp_form: 'llc'
    }
  },

  family_office_multigen: {
    label: 'Family Office Multi-Generational',
    emoji: '👪',
    description: 'Estate-planning trust above sponsor entity holding RE; GST allocation; valuation discounts',
    authority: '§ 2702 / § 2704 / § 2631',
    tier: 'estate',
    renderQuality: 'full', // v13.0.1: v13.0 ships family_office_vehicle node + sponsor_family_office_above
    state: {
      project_name: 'Example Family Office RE Vehicle',
      jurisdiction: 'DE',
      asset_type: 'real_estate_operating',
      deal_size: '30000000',
      investors: [
        { id: 'idgt', label: 'IDGT (Intentionally Defective Grantor Trust)', route: 'domestic_trust', trustSub: 'grantor', pct: 60 },
        { id: 'dynasty', label: 'GST-Exempt Dynasty Trust', route: 'domestic_trust', trustSub: 'dynasty', pct: 30 },
        { id: 'principal', label: 'Principal (retained interest)', route: 'domestic_individual', pct: 10 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default',
      // v13.0.1 — family office sponsor stack with separate carry vehicle for vertical-slice estate planning
      sponsor_present: true,
      sponsor_structure: 'mgmt_co_plus_gp_plus_carry_vehicle',
      sponsor_family_office_above: true,
      sponsor_carry_in_separate_vehicle: true,
      sponsor_mgmt_co_form: 'llc',
      sponsor_gp_form: 'llc'
    }
  },

  crt_re_holding: {
    label: 'Charitable Remainder Trust',
    emoji: '✝️',
    description: 'CRT holding RE; tax-deferred sale exit mechanic; income to non-charitable beneficiary',
    authority: '§ 664',
    tier: 'estate',
    renderQuality: 'partial',
    state: {
      project_name: 'Example CRT-Held Real Estate',
      jurisdiction: 'DE',
      asset_type: 'real_estate_operating',
      deal_size: '10000000',
      investors: [
        { id: 'crt', label: 'Charitable Remainder Unitrust', route: 'domestic_trust', trustSub: 'non_grantor', pct: 100 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'one_member',
      ctb_election: 'default'
    }
  },

  qoz_investment: {
    label: 'Opportunity Zone QOF + QOZB',
    emoji: '🏚️',
    description: 'Pre-populated QOZ structure with OZ 1.0 / OZ 2.0 regime branching',
    authority: '§ 1400Z-2 / OBBBA P.L. 119-21',
    tier: 'specialty',
    renderQuality: 'full',
    state: {
      project_name: 'Example QOZ Investment',
      jurisdiction: 'DE',
      asset_type: 'real_estate_development',
      deal_size: '20000000',
      investors: [
        { id: 'sponsor', label: 'QOF Sponsor', route: 'domestic_individual', pct: 5 },
        { id: 'qoz_lp1', label: 'QOF Investor 1', route: 'domestic_individual', pct: 35 },
        { id: 'qoz_lp2', label: 'QOF Investor 2', route: 'domestic_individual', pct: 30 },
        { id: 'qoz_lp3', label: 'QOF Investor 3 — Trust', route: 'domestic_trust', trustSub: 'non_grantor', pct: 30 }
      ],
      proposed_entity_type: 'us_llc',
      proposed_member_count: 'two_or_more',
      ctb_election: 'default',
      qoz_present: true,
      qoz_gain_realization_date: '2026-09-15',
      qoz_gain_source: 'direct',
      qoz_designation_regime: 'auto',
      qoz_qozb_below_qof: true,
      qoz_substantial_improvement_planned: true,
      qoz_holding_period_target: 'ten_year'
    }
  }
};

const STRUCT_PRESET_KEYS = Object.keys(STRUCT_PRESETS);

// Apply a preset to a fresh defaultState, merging the preset's state fields.
// Returns a new state object; does not mutate inputs.
function applyPreset(presetKey) {
  const preset = STRUCT_PRESETS[presetKey];
  if (!preset) return defaultState();
  const base = defaultState();
  const merged = Object.assign({}, base, preset.state);
  // Ensure diagram is fresh (positions cleared on preset apply)
  merged.diagram = { positions: {}, edge_overrides: {}, user_modified: false, visited: false };
  // If preset doesn't specify effective_date, keep today's
  if (!merged.effective_date) merged.effective_date = todayISO();
  // v13.1 — Track active preset so the diagram can label which archetype it's demonstrating
  merged.active_preset_key = presetKey;
  return merged;
}

// =============================================================================
// HELPERS
// =============================================================================
function todayISO() { return new Date().toISOString().slice(0, 10); }
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function formatCurrency(n) {
  if (n == null || n === '' || isNaN(Number(n))) return '—';
  const v = Number(n);
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function joinSentences(arr) {
  return (arr || []).filter(function (x) { return x && String(x).trim(); }).join(' ');
}
function ulFromArray(arr) {
  if (!arr || !arr.length) return '';
  return '<ul class="memo-list">' + arr.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul>';
}
function citesAsParenthetical(arr) {
  if (!arr || !arr.length) return '';
  return '(' + arr.join('; ') + ')';
}

// =============================================================================
// STATE MODEL — defaultState
// =============================================================================
function defaultState() {
  return {
    // Step 1 — Deal Setup
    project_name: '',
    jurisdiction: 'DE',
    asset_type: 'real_estate_operating',  // real_estate_operating | real_estate_development | investment_fund | operating_business | mixed
    asset_location_state: '',
    deal_size: '',
    // v13.6 — Multi-property mode. 1 = single property (legacy); >1 = N property nodes
    // rendered as siblings below the tier-bottom. Common in REITs and multi-asset funds.
    properties_count: 1,
    effective_date: todayISO(),
    matter_no: '',

    // Step 2 — Investor Identity
    // Array of investors: { id, label, route (route key), country (for foreign), trustSub (for trust routes), pct (approximate equity %) }
    investors: [],

    // Step 3 — Entity Classification & CTB
    proposed_entity_type: 'us_llc',            // us_llc | foreign_eligible | foreign_per_se
    proposed_entity_country: '',               // populated when foreign
    proposed_member_count: 'two_or_more',      // one_member | two_or_more
    foreign_liability_all_limited: 'yes',      // for foreign eligibles: yes | no | mixed
    ctb_election: 'default',                   // default | elect_corp | elect_partnership | elect_disregarded
    ctb_timing: 'on_formation',                // on_formation | mid_year | late_relief
    late_relief_intended_effective: '',        // ISO date if late
    treaty_country: '',                        // residence treaty country (foreign-corp route)
    treaty_lob_test: 'not_applicable',         // not_applicable | publicly_traded | subsidiary_of_pt | ownership_base_erosion | active_trade_business | derivative_benefits | competent_authority
    hybrid_concerns: false,
    section_708_b2_applicable: 'none',         // none | division | merger
    section_708_b2_notes: '',

    // Step 3b — Blocker strategy (v12.1)
    // 'auto_shared' (default): single shared C-corp blocker for all blocker-routed investors
    //   (v11.1 behavior preserved). 'separate_per_class': generates up to 5 parallel blockers
    //   (UBTI / § 892 / FIRPTA / BPT-treaty / UNI-throwback) — one per route-class needing one.
    //   'manual_configured': user assigns each blocker-needing investor to a specific blocker
    //   (UI deferred; for v12.1 falls back to auto_shared with a memo note).
    blocker_strategy: 'auto_shared',           // auto_shared | separate_per_class | manual_configured
    blocker_use_intermediate: false,           // true = add Cayman/foreign top-of-stack blocker layer above the US blocker(s)
    blocker_intermediate_jurisdiction: 'KY',   // 'KY' Cayman | 'BM' Bermuda | 'BS' Bahamas | 'LU' Luxembourg | other

    // Step 3c — REIT analysis (v12.2)
    reit_present: false,                       // true triggers full REIT analysis (Section X)
    reit_domestically_controlled: 'unknown',   // dc | fc | unknown (§ 897(h)(4))
    reit_public_or_private: 'private',         // private | public_listed_nyse_nasdaq | public_traded_otc_only
    reit_structure: 'standalone',              // standalone | umbrella_partnership_uprt
    reit_us_ownership_pct: '',                 // decimal percent — for 50% DC threshold (§ 897(h)(4)(B))
    reit_share_class_5pct_test_concern: false, // § 897(k)(2) — public REIT 5% shareholder threshold
    reit_trs_present: false,                   // § 856(l) Taxable REIT Subsidiary
    reit_uprt_contribution_planned: false,     // § 721 contribution to OP for OP units
    reit_distribution_compliance: 'planned_on_track', // planned_on_track | concern | not_assessed

    // Step 3d — Sponsor structure (v13.0)
    // The sponsor side of a real-estate deal is conceptually distinct from the
    // investor panel: it's the principals, the management company, the GP entity,
    // and the carry vehicle. None of these sit in the "investor" layer; they sit
    // alongside it with specific economic + governance relationships.
    sponsor_present: false,                    // true → render sponsor side in diagram + memo Section IV.B
    sponsor_structure: 'mgmt_co_plus_gp',      // simple | mgmt_co_plus_gp | mgmt_co_plus_gp_plus_carry_vehicle
    sponsor_carry_in_separate_vehicle: false,  // § 1061 / estate-planning structuring
    sponsor_family_office_above: false,        // family office / IDGT / GRAT above sponsor entity
    sponsor_mgmt_co_form: 's_corp',            // s_corp | llc | c_corp (typical: S-corp or LLC)
    sponsor_gp_form: 'llc',                    // llc | lp | c_corp (typical: LLC)

    // Step 3e — Multi-tier operating structure (v13.0)
    // HoldCo / MidCo / OpCo / PropCo tiering. Each tier serves distinct purposes:
    //   HoldCo: financing flexibility; sometimes REIT
    //   MidCo: intermediate debt placement; tax planning
    //   OpCo (= target_entity by default): operating entity
    //   PropCo: single-purpose property-holding entity; lender bankruptcy-remoteness
    tier_structure: 'flat',                    // flat | holdco_opco | holdco_opco_propco | holdco_midco_opco_propco
    tier_holdco_rationale: 'financing_flex',   // financing_flex | reit_overlay | bankruptcy_remote | tax_planning
    tier_propco_rationale: 'lender_spe',       // lender_spe | bankruptcy_remote | per_asset_isolation

    // v13.1 — Active preset tracking (used to render preset label on diagram)
    active_preset_key: null,                   // null | preset key (e.g. 'domestic_only_fund')

    // Step 3f — § 1031 DST Sponsor Program (v13.2)
    // Delaware Statutory Trust under 12 Del. C. § 3801 et seq.; beneficial interests qualify as
    // undivided fractional interests in real estate under Rev. Rul. 2004-86 ONLY if the trust
    // agreement avoids the "seven deadly sins." Sponsor offering documents must comply.
    dst_present: false,
    dst_sponsor_offering: false,               // sponsor offering vs. private structure
    dst_offering_closed: true,                 // sin #1: capital contributions only during offering window
    dst_can_renegotiate_debt: false,           // sin #2 if true
    dst_can_reinvest_proceeds: false,          // sin #3 if true
    dst_capex_restricted_to_normal: true,      // sin #4: capex limited to normal repair/maintenance/minor improvements
    dst_reserves_short_term_us_debt_only: true, // sin #6: reserves only in short-term US debt
    dst_distributions_at_least_annual: true,   // sin #7: distributions at least annually
    dst_springing_llc_provision: true,         // permits conversion to LLC if active management required
    dst_master_lease_present: false,           // master lease to operator (common DST structure)
    dst_exchanger_count: '',                   // approximate count of 1031 exchangers acquiring beneficial interests

    // Step 3g — § 1031 TIC Arrangement (v13.2)
    // Tenant-in-common co-ownership under Rev. Proc. 2002-22. Each co-owner holds undivided
    // fractional interest as a TIC; the arrangement must satisfy 15 conditions to be eligible
    // for a favorable IRS private letter ruling that the co-ownership is not a partnership.
    tic_present: false,
    tic_owner_count: '',                       // safe harbor: max 35 co-owners
    tic_unanimity_for_major_decisions: true,   // condition 6: unanimity for major decisions
    tic_management_agreement_annual: true,     // condition 13: management agreement renewable annually at FMV
    tic_proportionate_profit_loss_sharing: true, // condition 8
    tic_proportionate_debt_sharing: true,      // condition 10
    tic_individual_transfer_rights: true,      // condition 9: each co-owner can transfer/encumber individually
    tic_lender_consent_required: true,         // condition 14
    tic_sponsor_payments_fmv: true,            // condition 15
    tic_business_activities_minimal: true,     // condition 12

    // Step 3h — § 42 LIHTC Syndication (v13.3)
    // Low-Income Housing Tax Credit syndication under § 42. Typical structure: tax-credit
    // investor (institutional) holds 99.99% LP interest; developer GP holds 0.01% with
    // promote on residual. Credits flow per § 704(b)/(c) allocation. State LIHTCs may
    // accompany federal credits (twinned-state programs).
    lihtc_present: false,
    lihtc_credit_type: '9_pct',                // 9_pct | 4_pct | combined_9_4
    lihtc_state_credits_present: false,        // accompanying state LIHTC
    lihtc_historic_credits_present: false,     // § 47 historic credits twinned
    lihtc_qualified_basis_calc: 'standard',    // standard | qct_dda_130_boost (qualified census tract / difficult-development area)
    lihtc_compliance_period_years: '15',       // 15-year initial; 30-year extended use
    lihtc_extended_use_period: '15',           // additional years beyond initial compliance
    lihtc_recapture_risk_concern: false,       // § 42(j) recapture if compliance fails
    lihtc_yield_to_investor_target_pct: '',    // typical 4-7% after-tax IRR

    // Step 3i — § 48 ITC Solar Tax-Equity Flip (v13.3)
    // Investment Tax Credit partnership flip structure for solar/renewable projects.
    // Post-IRA (2022+): § 48 ITC at 30% base + adders (energy community, domestic content,
    // low-income community). § 6418 transferability allows ITC sale to unrelated transferee
    // (post-IRA). Partnership flip remains common for sponsors retaining post-flip economics.
    solar_tax_equity_present: false,
    solar_tax_equity_structure: 'partnership_flip', // partnership_flip | transfer_election_6418 | sale_leaseback
    solar_itc_base_rate_pct: '30',             // 30% base post-IRA (was 26% pre-2023)
    solar_energy_community_adder: false,       // +10% adder under § 48(a)(14)
    solar_domestic_content_adder: false,       // +10% adder under § 48(a)(13)
    solar_low_income_adder: false,             // +10% or +20% adder under § 48(e)
    solar_pre_flip_investor_pct: '99',         // pre-flip allocation to tax-equity investor (often 99%)
    solar_post_flip_investor_pct: '5',         // post-flip allocation (often 5%)
    solar_flip_trigger: 'irr_hurdle',          // irr_hurdle | time_based | hybrid
    solar_target_irr_pct: '8',                 // post-tax IRR target for flip
    solar_transferability_election: false,     // § 6418 transferability election

    // Step 4a — Related-Party Debt (Thread 2)
    has_related_party_debt: false,
    rpd_lender_type: 'partner',                // partner | partner_affiliate | other_related
    rpd_principal: '',
    rpd_rate: '',                              // decimal stated as percent string, e.g. "8.5"
    rpd_maturity_years: '',
    rpd_terms_arm_length: true,
    rpd_section_163j_concerned: false,
    rpd_rptb_election: false,                  // real-property-trade-or-business election under § 163(j)(7)
    rpd_recourse_treatment: 'nonrecourse',     // recourse | nonrecourse | qualified_nonrecourse
    rpd_385_documentation_complete: false,
    rpd_anti_conduit_concern: false,
    rpd_ahydo_concern: false,                  // applicable high-yield discount obligation § 163(i)

    // Step 4b — Management Fee (Thread 2)
    mgmt_fee_present: false,
    mgmt_fee_recipient_type: 'partner',        // partner | non_partner_affiliate | unrelated
    mgmt_fee_amount_basis: 'fixed',            // fixed | percentage_aum | percentage_revenue | hybrid
    mgmt_fee_amount: '',
    mgmt_fee_arm_length: true,
    mgmt_fee_characterization_intended: 'section_707c',  // section_707a | section_707c | profits_interest_fee_waiver | distribution
    mgmt_fee_fee_waiver_present: false,
    mgmt_fee_fee_waiver_risk_assessment: 'meaningful_economic_risk',  // meaningful_economic_risk | no_meaningful_risk | safe_harbor_clean
    mgmt_fee_se_tax_concern: false,
    // NOTE: mgmt_fee_forum_jurisdiction added post-Sirius (5th Cir. Jan. 16, 2026)
    // to surface the circuit split on § 1402(a)(13) functional analysis.
    // 'default_functional' = Tax Court / Soroban-line functional analysis.
    // 'fifth_circuit_sirius' = Fifth Circuit forum. Was "state-law form controls"
    // under the January 2026 Sirius opinion; since the Aug. 12, 2026 substitute
    // opinion (K Alain) the Fifth Circuit standard is role-based too.
    mgmt_fee_forum_jurisdiction: 'default_functional',  // default_functional | fifth_circuit_sirius

    // Step 4c — Mezzanine Debt (Thread 2)
    mezz_present: false,
    mezz_principal: '',
    mezz_stated_rate: '',
    mezz_paid_in_kind: false,
    mezz_equity_kicker: false,
    mezz_maturity_years: '',
    mezz_subordination: 'mezzanine',           // senior | mezzanine | preferred | common
    mezz_thirteen_factor_scores: {
      name_on_instrument: 3,
      fixed_maturity: 3,
      source_of_payments: 3,
      right_to_enforce: 3,
      participation_in_management: 3,
      status_vs_regular_creditors: 3,
      intent_of_parties: 3,
      identity_holder_shareholder: 3,
      thin_capitalization: 3,
      subordination: 3,
      ability_to_obtain_outside_financing: 3,
      sinking_fund: 3,
      payment_from_earnings: 3
    },

    // Step 4d — Qualified Opportunity Zone Investment (Thread 3 — NEW)
    qoz_present: false,
    qoz_gain_realization_date: '',             // ISO date; drives oz_1.0 vs oz_2.0 regime
    qoz_gain_source: 'direct',                 // direct | passthrough_k1
    qoz_designation_regime: 'auto',            // auto | oz_1_0 | oz_2_0 (manual override)
    qoz_rural: false,                          // QROF 30% step-up + 50% sub-improvement
    qoz_qozb_below_qof: true,                  // structure: QOF holds QOZB? (typical) or QOF directly owns QOZB Property?
    qoz_substantial_improvement_planned: true,
    qoz_holding_period_target: 'ten_year',     // ten_year (post-investment exclusion) | five_year_step | shorter
    qoz_passthrough_180day_election: 'not_elected',  // not_elected | gain_date | partnership_yearend | return_due_date

    // Step 5 — Structure Diagram (Thread 3 — NEW)
    // Diagram nodes and edges are DERIVED from the analysis (see deriveStructureGraph).
    // User refinements are stored as overlays on top of the derived graph.
    diagram: {
      positions: {},                           // { [nodeId]: {x, y} } — user-dragged positions
      edge_overrides: {},                      // { [edgeId]: {label, kind} } — user-edited edges
      user_modified: false,                    // whether the user has refined the diagram
      visited: false                           // whether the user has opened the diagram panel
    },

    // Step 6 — Output / Generation flags (Thread 3 build)
    include_thread2_only_notice: true
  };
}

// =============================================================================
// ANALYSIS FUNCTIONS
// =============================================================================
// Each analysis function returns a structured object that the memorandum
// builder consumes. Pure functions — inputs in, structured analysis out, no
// side effects. Testable from Node.
// =============================================================================

function analyzeInvestor(inv) {
  if (!inv || !inv.route) return null;
  const r = INVESTOR_ROUTES[inv.route];
  if (!r) return null;
  const subInfo = (r.subRoutes && inv.trustSub) ? r.subRoutes[inv.trustSub] : null;
  return {
    id: inv.id,
    label: inv.label || '[Unnamed Investor]',
    routeKey: r.key,
    routeLabel: r.label,
    routeBlurb: r.blurb,
    subRouteKey: inv.trustSub || null,
    subRouteLabel: subInfo ? subInfo.label : null,
    subRouteSummary: subInfo ? subInfo.summary : null,
    country: inv.country || null,
    perSe: (inv.route === 'per_se_foreign_corp' && inv.country) ? isPerSeJurisdiction(inv.country) : null,
    perSeForm: (inv.route === 'per_se_foreign_corp' && inv.country) ? getPerSeForm(inv.country) : null,
    keyCites: r.keyCites.slice(),
    blocker: Object.assign({}, r.blocker),
    flags: r.flags.slice(),
    pct: inv.pct,
    // Sub-conditional: only meaningful for foreign_trust with trustSub === 'grantor'.
    // When grantor is a U.S. person, § 679 applies and domestic-trust analysis controls
    // (investor routed direct, not through blocker). Per INVESTOR_ROUTES.foreign_trust.blocker.rationale.
    grantor_is_us_person: inv.grantor_is_us_person === true
  };
}

function analyzeInvestorPanel(state) {
  const items = (state.investors || []).map(analyzeInvestor).filter(Boolean);
  const routeCounts = {};
  items.forEach(function (i) { routeCounts[i.routeKey] = (routeCounts[i.routeKey] || 0) + 1; });

  // Compute aggregate recommendations
  const blockerRecommendedCount = items.filter(function (i) { return i.blocker.recommended === true || i.blocker.recommended === 'conditional' || i.blocker.recommended === 'inherent'; }).length;
  const hasUbtiInvestor = items.some(function (i) { return i.routeKey === 'tax_exempt'; });
  const hasFirptaSensitiveInvestor = items.some(function (i) { return i.routeKey === 'foreign_individual' || i.routeKey === 'foreign_corporation' || (i.routeKey === 'per_se_foreign_corp'); });
  const hasQfpfInvestor = items.some(function (i) { return i.routeKey === 'foreign_pension'; });
  const hasSwfInvestor = items.some(function (i) { return i.routeKey === 'swf'; });
  const hasForeignTrust = items.some(function (i) { return i.routeKey === 'foreign_trust'; });
  const hasMixedDomestic = items.some(function (i) { return i.routeKey === 'domestic_individual' || i.routeKey === 'domestic_trust'; });

  // Surfacing the QFPF-vs-blocker tension
  const qfpfBlockerConflict = hasQfpfInvestor && blockerRecommendedCount > 0;

  return {
    items: items,
    count: items.length,
    routeCounts: routeCounts,
    flags: {
      blocker_recommended_for_some: blockerRecommendedCount > 0,
      mixed_us_and_foreign: hasMixedDomestic && (hasFirptaSensitiveInvestor || hasForeignTrust || hasSwfInvestor || hasQfpfInvestor),
      ubti_in_play: hasUbtiInvestor,
      firpta_in_play: hasFirptaSensitiveInvestor || hasForeignTrust,
      section_892_in_play: hasSwfInvestor,
      qfpf_in_play: hasQfpfInvestor,
      qfpf_blocker_conflict: qfpfBlockerConflict
    }
  };
}

function analyzeCTB(state) {
  const r = { inputs: {}, defaultClassification: null, electionAvailable: false, electionRecommended: null,
              lateReliefAnalysis: null, perSeFlag: false, treatyAnalysis: null, hybridFlag: false,
              divisionMergerFlag: null, narrative: [] };

  r.inputs.proposed_entity_type = state.proposed_entity_type;
  r.inputs.proposed_entity_country = state.proposed_entity_country;
  r.inputs.proposed_member_count = state.proposed_member_count;
  r.inputs.foreign_liability_all_limited = state.foreign_liability_all_limited;
  r.inputs.ctb_election = state.ctb_election;

  // Determine default classification
  if (state.proposed_entity_type === 'us_llc') {
    if (state.proposed_member_count === 'one_member') {
      r.defaultClassification = CTB_RULES.defaults.domestic_eligible_one_member;
    } else {
      r.defaultClassification = CTB_RULES.defaults.domestic_eligible_two_or_more;
    }
    r.electionAvailable = true;
  } else if (state.proposed_entity_type === 'foreign_eligible') {
    if (state.proposed_member_count === 'one_member') {
      if (state.foreign_liability_all_limited === 'yes') {
        r.defaultClassification = CTB_RULES.defaults.foreign_eligible_one_member_limited;
      } else {
        r.defaultClassification = CTB_RULES.defaults.foreign_eligible_one_member_unlimited;
      }
    } else {
      if (state.foreign_liability_all_limited === 'yes') {
        r.defaultClassification = CTB_RULES.defaults.foreign_eligible_all_limited;
      } else {
        r.defaultClassification = CTB_RULES.defaults.foreign_eligible_two_or_more_at_least_one_unlimited;
      }
    }
    r.electionAvailable = true;
  } else if (state.proposed_entity_type === 'foreign_per_se') {
    r.defaultClassification = CTB_RULES.defaults.per_se_foreign;
    r.electionAvailable = false;
    r.perSeFlag = true;
  }

  // Recommendation
  if (state.ctb_election === 'default') {
    r.electionRecommended = 'No election; default classification applies.';
  } else if (state.ctb_election === 'elect_corp') {
    r.electionRecommended = r.electionAvailable
      ? 'Elect association (corporation) treatment on Form 8832.'
      : 'Election not available — entity is per se corporate under Reg. § 301.7701-2(b)(8); recommendation is moot.';
  } else if (state.ctb_election === 'elect_partnership') {
    r.electionRecommended = r.electionAvailable
      ? 'Elect partnership treatment on Form 8832 (foreign eligible with multiple members where default would be association).'
      : 'Election not available.';
  } else if (state.ctb_election === 'elect_disregarded') {
    r.electionRecommended = r.electionAvailable
      ? 'Elect disregarded entity treatment on Form 8832 (single-member entity where default would be association).'
      : 'Election not available.';
  }

  // Late relief analysis
  if (state.ctb_timing === 'late_relief') {
    r.lateReliefAnalysis = {
      revenueProcedure: CTB_RULES.lateElectionRelief.revenueProcedure,
      window: CTB_RULES.lateElectionRelief.window,
      requirements: CTB_RULES.lateElectionRelief.requirements.slice(),
      procedure: CTB_RULES.lateElectionRelief.procedure,
      intendedEffective: state.late_relief_intended_effective || null
    };
  }

  // Treaty + LOB
  if (state.treaty_country) {
    r.treatyAnalysis = {
      country: state.treaty_country,
      lobTestClaimed: state.treaty_lob_test,
      ctbForTreatyPurposes: TREATY_LOB.ctbForTreatyPurposes,
      practicePoint: TREATY_LOB.practicePoint
    };
  }

  // Hybrid
  if (state.hybrid_concerns) {
    r.hybridFlag = true;
    r.hybridConcerns = CTB_RULES.hybridConcerns.slice();
  }

  // § 708(b)(2)
  if (state.section_708_b2_applicable && state.section_708_b2_applicable !== 'none') {
    r.divisionMergerFlag = state.section_708_b2_applicable;
    if (state.section_708_b2_applicable === 'division') {
      r.divisionMergerMechanics = SECTION_708.divisions;
    } else if (state.section_708_b2_applicable === 'merger') {
      r.divisionMergerMechanics = SECTION_708.mergers;
    }
    r.section708Notes = state.section_708_b2_notes || '';
  }

  return r;
}

function analyzeEntityClassification(state) {
  // Determine recommended downstream document tool based on inputs.
  // Single member with simple US LLC formation → route to Single-Member tool
  // Two or more members, US LLC, all-cash, simple → route to Multi-Eight
  // Otherwise (multi-tier promote, property contrib, HoldCo·OpCo, foreign blocker) → route to RESERVE 12-Step
  const inv = analyzeInvestorPanel(state);

  let downstream = 'reserve_12_step';
  let rationale = '';

  if (state.proposed_entity_type === 'us_llc' && state.proposed_member_count === 'one_member') {
    if (!inv.flags.firpta_in_play && !inv.flags.section_892_in_play && !inv.flags.qfpf_in_play && !inv.flags.ubti_in_play) {
      downstream = 'single_member';
      rationale = 'Single US owner, US LLC, no foreign / tax-exempt complexity — Single-Member tool (Gold-tier accessible).';
    } else {
      downstream = 'reserve_12_step';
      rationale = 'Single owner but foreign / tax-exempt / § 892 concerns require the 12-Step Multi-Member tool for blocker layering and elective complexity.';
    }
  } else if (state.proposed_entity_type === 'us_llc' && state.proposed_member_count === 'two_or_more') {
    // Identify which complexity factors actually fire on these facts.
    const factors = [];
    if (inv.flags.firpta_in_play) factors.push('FIRPTA exposure');
    if (inv.flags.section_892_in_play) factors.push('§ 892 sovereign investor');
    if (inv.flags.qfpf_in_play) factors.push('§ 897(l) QFPF interest');
    if (inv.flags.ubti_in_play) factors.push('UBTI / tax-exempt blocker need');
    if (state.hybrid_concerns) factors.push('hybrid-entity concerns');
    if (state.section_708_b2_applicable && state.section_708_b2_applicable !== 'none') {
      factors.push('§ 708(b)(2) division / merger');
    }
    const complexity = factors.length > 0;
    if (complexity) {
      downstream = 'reserve_12_step';
      const factorPhrase = factors.length === 1
        ? factors[0]
        : (factors.length === 2
            ? factors.join(' and ')
            : factors.slice(0, -1).join(', ') + ', and ' + factors[factors.length - 1]);
      rationale = 'Multi-member US LLC with ' + factorPhrase
        + ' — the 12-Step Multi-Member tool is required for HoldCo·OpCo, full § 704(b) safe-harbor allocations, multi-tier promote, and blocker integration where applicable.';
    } else {
      downstream = 'multi_eight';
      rationale = 'Multi-member US LLC, domestic investors, all-cash contributions, single class of interests — Multi-Eight document set is the right deliverable.';
    }
  } else if (state.proposed_entity_type === 'foreign_eligible' || state.proposed_entity_type === 'foreign_per_se') {
    downstream = 'reserve_12_step';
    rationale = 'Foreign-formed entity — document assembly requires customized foreign-law overlay handled in the 12-Step Multi-Member workflow with bespoke-counsel engagement.';
  }

  // ============================================================================
  // v13.4 — DC-REIT alternative recommendation
  // ============================================================================
  // When the investor panel includes meaningful foreign holders AND US ownership
  // exceeds 50%, a DC-REIT becomes a viable structural alternative to the
  // LLC + C-corp blocker structure. The advantage: DC-REIT shares are NOT USRPI
  // under § 897(h)(4) — foreign holders escape FIRPTA on share disposition
  // without a blocker. This is a real-asset/real-estate-specific alternative
  // that should be surfaced in the entity-classification recommendation, not
  // only in Section X (REIT) when the practitioner has already pre-decided.
  // ============================================================================
  const altRecommendations = [];
  if (state.asset_type && (state.asset_type.indexOf('real_estate') === 0 || state.asset_type === 'investment_fund')) {
    // Compute US vs foreign share of investor capital
    let usSharePct = 0;
    let foreignSharePct = 0;
    (state.investors || []).forEach(function (i) {
      const route = i.route;
      const pct = typeof i.pct === 'number' ? i.pct : parseFloat(i.pct) || 0;
      if (route === 'domestic_individual' || route === 'tax_exempt' || route === 'domestic_trust') {
        usSharePct += pct;
      } else if (route && (route.indexOf('foreign_') === 0 || route === 'swf' || route === 'per_se_foreign_corp')) {
        foreignSharePct += pct;
      }
    });
    const investorMixSupportsDC = usSharePct > 50;
    const meaningfulForeign = foreignSharePct >= 10; // ≥ 10% foreign makes DC-REIT a real conversation
    const reitAlreadyConsidered = !!state.reit_present;
    if (meaningfulForeign && investorMixSupportsDC && !reitAlreadyConsidered) {
      altRecommendations.push({
        label: 'Domestically Controlled REIT (DC-REIT)',
        statutoryBasis: '§§ 856-859 + § 897(h)(4)',
        rationale: 'Investor panel shows ' + usSharePct.toFixed(1) + '% US share and ' + foreignSharePct.toFixed(1) + '% foreign share — '
          + 'US ownership exceeds the § 897(h)(4) 50% threshold for domestic-control achievability. '
          + 'A DC-REIT structure would render REIT shares NOT USRPI on disposition by foreign holders — '
          + 'a materially different outcome from the LLC + C-corp blocker stack (which converts FIRPTA gain into corporate-level tax + dividend WHT). '
          + 'Tradeoffs: REIT compliance overhead (75/95 income tests, 75 asset test, 90% distribution); '
          + 'reduced flexibility on operating activities (operating real estate may require a Taxable REIT Subsidiary under § 856(l)); '
          + 'and structural complexity at formation (Maryland corp, REIT-qualifying documentation). '
          + 'Worth examining when foreign LPs are seeking liquidity on share-disposition events and the LLC blocker WHT economics are unattractive.',
        confidence: 'high'
      });
    } else if (meaningfulForeign && !investorMixSupportsDC) {
      altRecommendations.push({
        label: 'Foreign-Controlled REIT (FC-REIT) — limited alternative',
        statutoryBasis: '§§ 856-859 + § 897(k)(2)',
        rationale: 'Investor panel shows ' + usSharePct.toFixed(1) + '% US share and ' + foreignSharePct.toFixed(1) + '% foreign share — '
          + 'US ownership is at or below the 50% threshold, so DC-REIT status is not achievable on these facts. '
          + 'FC-REIT shares ARE USRPI on disposition (no § 897(h)(4) escape); however, if the REIT is publicly traded, '
          + 'foreign &lt;5% holders qualify for the § 897(k)(2) carve-out. For a private FC-REIT, the FIRPTA economics on '
          + 'share disposition are similar to a blocker structure — the FC-REIT does not solve the structural problem. '
          + 'Consider only if (a) public listing is contemplated and (b) foreign investor concentration permits the &lt;5% carve-out.',
        confidence: 'low'
      });
    }
  }

  return {
    downstream: downstream,
    downstreamLabel: ({
      single_member: 'Single-Member Entity Formation Tool',
      multi_eight: 'Multi-Member LLC (Eight-Step) Tool',
      reserve_12_step: 'Multi-Member LLC (12-Step) Tool'
    })[downstream],
    rationale: rationale,
    altRecommendations: altRecommendations,
    investorPanel: inv
  };
}

// =============================================================================
// THREAD 2 — RELATED-PARTY DEBT ANALYSIS
// =============================================================================
function analyzeRelatedPartyDebt(state) {
  const r = {
    present: !!state.has_related_party_debt,
    inputs: {},
    flags: {
      section_163j_in_play: false,
      rptb_election_in_play: false,
      related_recourse_in_play: false,
      section_385_documentation_deficient: false,
      anti_conduit_in_play: false,
      ahydo_in_play: false,
      self_charged_interest_available: false
    },
    rate_decimal: null,
    ahydo_threshold_note: null,
    narrative: []
  };

  if (!r.present) {
    r.narrative.push('Not applicable: no related-party debt is present in the proposed capital structure. The § 163(j), Reg. § 1.752-2(d), § 385, anti-conduit, and AHYDO analyses below are not engaged on the present record.');
    return r;
  }

  r.inputs.rpd_lender_type = state.rpd_lender_type;
  r.inputs.rpd_principal = state.rpd_principal;
  r.inputs.rpd_rate = state.rpd_rate;
  r.inputs.rpd_maturity_years = state.rpd_maturity_years;
  r.inputs.rpd_terms_arm_length = !!state.rpd_terms_arm_length;
  r.inputs.rpd_section_163j_concerned = !!state.rpd_section_163j_concerned;
  r.inputs.rpd_rptb_election = !!state.rpd_rptb_election;
  r.inputs.rpd_recourse_treatment = state.rpd_recourse_treatment;
  r.inputs.rpd_385_documentation_complete = !!state.rpd_385_documentation_complete;
  r.inputs.rpd_anti_conduit_concern = !!state.rpd_anti_conduit_concern;
  r.inputs.rpd_ahydo_concern = !!state.rpd_ahydo_concern;

  // Normalize rate input to decimal (accepts "8.5", "0.085", "8.5%")
  if (state.rpd_rate != null && state.rpd_rate !== '') {
    const raw = String(state.rpd_rate).replace('%', '').trim();
    const n = Number(raw);
    if (!isNaN(n)) {
      r.rate_decimal = n > 1 ? n / 100 : n;
    }
  }

  // Flag computations
  r.flags.section_163j_in_play = state.rpd_section_163j_concerned === true;
  r.flags.rptb_election_in_play = state.rpd_rptb_election === true;
  r.flags.related_recourse_in_play = state.rpd_recourse_treatment === 'recourse';
  r.flags.section_385_documentation_deficient = state.rpd_385_documentation_complete === false;
  r.flags.anti_conduit_in_play = state.rpd_anti_conduit_concern === true;
  r.flags.ahydo_in_play = state.rpd_ahydo_concern === true;
  r.flags.self_charged_interest_available = state.rpd_lender_type === 'partner';

  // AHYDO threshold guidance — yield vs AFR + 5
  if (r.rate_decimal != null) {
    r.ahydo_threshold_note = 'Stated rate, normalized: ' + (r.rate_decimal * 100).toFixed(2) + '%. The AHYDO yield-to-maturity threshold is AFR + 5 percentage points; the relevant AFR (short-, mid-, or long-term, semi-annual compounding) depends on the maturity. For mid- and long-term AFRs in the current rate environment, a stated coupon of 9-10% with material PIK accrual frequently crosses the AHYDO threshold once the OID is grossed up.';
  }

  return r;
}

// =============================================================================
// THREAD 2 — MANAGEMENT FEE CHARACTERIZATION
// =============================================================================
function analyzeManagementFee(state) {
  const r = {
    present: !!state.mgmt_fee_present,
    inputs: {},
    flags: {
      section_707a_router: false,
      section_707c_router: false,
      fee_waiver_present: false,
      disguised_payment_risk: 'low',
      section_1061_capital_interest_exception_unavailable: false,
      se_tax_exposure: 'unknown',
      arm_length_concern: false
    },
    sixFactorAggregate: null,
    forumPosture: null,
    narrative: []
  };

  if (!r.present) {
    r.narrative.push('Not applicable: no management fee arrangement is present in the proposed structure. The § 707(a)/(c) characterization, six-factor disguised-payment-for-services analysis, fee-waiver mechanics, and § 1402(a)(13) SE-tax analysis below are not engaged on the present record.');
    return r;
  }

  r.inputs.recipient_type = state.mgmt_fee_recipient_type;
  r.inputs.amount_basis = state.mgmt_fee_amount_basis;
  r.inputs.amount = state.mgmt_fee_amount;
  r.inputs.arm_length = !!state.mgmt_fee_arm_length;
  r.inputs.characterization_intended = state.mgmt_fee_characterization_intended;
  r.inputs.fee_waiver_present = !!state.mgmt_fee_fee_waiver_present;
  r.inputs.fee_waiver_risk_assessment = state.mgmt_fee_fee_waiver_risk_assessment;
  r.inputs.se_tax_concern = !!state.mgmt_fee_se_tax_concern;
  r.inputs.forum_jurisdiction = state.mgmt_fee_forum_jurisdiction;

  // § 707(a) vs § 707(c) router
  if (state.mgmt_fee_recipient_type === 'unrelated' || state.mgmt_fee_recipient_type === 'non_partner_affiliate') {
    r.flags.section_707a_router = true;
  } else if (state.mgmt_fee_characterization_intended === 'section_707c') {
    r.flags.section_707c_router = true;
  } else if (state.mgmt_fee_characterization_intended === 'section_707a') {
    r.flags.section_707a_router = true;
  }

  r.flags.fee_waiver_present = !!state.mgmt_fee_fee_waiver_present;
  r.flags.arm_length_concern = !state.mgmt_fee_arm_length;

  // Disguised-payment risk (six-factor) — simplified scoring from SER assessment
  if (r.flags.fee_waiver_present) {
    if (state.mgmt_fee_fee_waiver_risk_assessment === 'no_meaningful_risk') {
      r.flags.disguised_payment_risk = 'high';
      r.sixFactorAggregate = {
        ser_lacking: true,
        rationale: 'The fee waiver lacks significant entrepreneurial risk (SER), the most heavily weighted of the six factors under Prop. Reg. § 1.707-2. The arrangement is presumptively a disguised payment for services and the waived fee will be recharacterized as ordinary compensation income to the recipient regardless of label.'
      };
    } else if (state.mgmt_fee_fee_waiver_risk_assessment === 'meaningful_economic_risk') {
      r.flags.disguised_payment_risk = 'moderate';
      r.sixFactorAggregate = {
        ser_lacking: false,
        rationale: 'The fee waiver carries meaningful economic risk on the recipient\'s representation. SER is the gating factor; the remaining five factors (status as partner, timing of allocations, value-of-services correlation, period of service, net-cash-flow funding) must each be developed in the engagement file. A waiver with documented SER will generally be respected as a distributive share absent failure on two or more of the secondary factors.'
      };
    } else if (state.mgmt_fee_fee_waiver_risk_assessment === 'safe_harbor_clean') {
      r.flags.disguised_payment_risk = 'low';
      r.sixFactorAggregate = {
        ser_lacking: false,
        rationale: 'The fee waiver is structured to satisfy each of the six factors: subject to the partnership\'s overall risk, with continuing partner status, no timing-of-allocation manipulation, no close value-of-services correlation, no short-service window, and funded from general net cash flow rather than a segregated revenue stream.'
      };
    }
  }

  // § 1061 capital-interest exception availability
  if (r.flags.fee_waiver_present) {
    r.flags.section_1061_capital_interest_exception_unavailable = true;
  }

  // SE tax exposure — forum-aware (post-Sirius, Golsen-mediated)
  if (state.mgmt_fee_se_tax_concern) {
    if (state.mgmt_fee_forum_jurisdiction === 'fifth_circuit_sirius') {
      r.flags.se_tax_exposure = 'fifth_circuit_sirius_controls';
      r.forumPosture = {
        forum: 'fifth_circuit',
        forumLabel: 'Fifth Circuit (TX/LA/MS)',
        controllingAuthority: 'K Alain, L.L.L.P. v. Comm\'r (formerly Sirius Solutions, L.L.L.P. v. Comm\'r), No. 24-60240 (5th Cir. Aug. 12, 2026) (substitute per curiam opinion on panel rehearing, withdrawing 165 F.4th 374 (Jan. 16, 2026))',
        controllingPosition: 'Role-based, not status-based. A "limited partner, as such" is a partner who plays no significant role in managing or running the business; state-law LP status and limited liability are not sufficient. Some non-managerial participation may be permitted; the line is undefined.',
        rule: 'Under the Fifth Circuit\'s substitute opinion, the § 1402(a)(13) exclusion is available to a partner who plays no significant role in managing or running the partnership\'s business. State-law limited-partner status and limited liability do not by themselves qualify the partner. The standard differs from the Tax Court\'s Soroban test in its source and articulation, but both now look to the partner\'s role.',
        practicePoint: 'The January 2026 planning posture (form controls; document the LP designation and limited liability) no longer holds. Document the partner\'s actual role: hours, decision authority, holding-out to third parties, and the separation of any GP or management-company role from the LP interest. Assume that a partner with a significant managerial role is subject to self-employment tax on the distributive share in every circuit. Monitor the further rehearing period and the First and Second Circuit appeals.'
      };
    } else {
      r.flags.se_tax_exposure = 'functional_analysis_required';
      r.forumPosture = {
        forum: 'all_other_circuits',
        forumLabel: 'Tax Court / non-Fifth Circuit (Soroban-line functional analysis)',
        controllingAuthority: 'Soroban Capital Partners LP v. Comm\'r, 161 T.C. 310 (2023); Soroban Capital Partners LP v. Comm\'r, T.C. Memo. 2025-52 (May 28, 2025); Denham Capital Mgmt. LP v. Comm\'r, T.C. Memo. 2024-114 (Dec. 23, 2024); Renkemeyer, Campbell & Weaver, LLP v. Comm\'r, 136 T.C. 137 (2011)',
        controllingPosition: 'Functional analysis required. An active LP partner whose participation is not "generally akin" to that of a passive investor is subject to self-employment tax on the distributive share notwithstanding state-law LP designation.',
        rule: 'The § 1402(a)(13) exclusion is available only to a partner functioning as a limited partner — that is, a passive investor not actively managing the partnership business. A partner held out to the public as essential to the business, who works substantially full-time on its affairs, or who exercises day-to-day management authority is a limited partner "in name only" and the exclusion is denied.',
        practicePoint: 'Where the partner is actively involved, the safer planning posture is to assume SE tax applies to the partner\'s entire distributive share (other than guaranteed payments, which are subject to SE tax regardless under § 1402(a)(13) flush language). The Fifth Circuit\'s Sirius decision is a forum-specific carve-out: it does not control outside TX/LA/MS, and the Tax Court continues to apply the functional test to non-Fifth-Circuit cases.'
      };
    }
  }

  return r;
}

// =============================================================================
// THREAD 2 — MEZZANINE DEBT CHARACTERIZATION
// =============================================================================
function analyzeMezzanineDebt(state) {
  const r = {
    present: !!state.mezz_present,
    inputs: {},
    flags: {
      ahydo_concern: false,
      oid_accrual: false,
      equity_kicker: false,
      circuit_split_irrelevant: true  // mezz analysis is federal common-law, no circuit split here
    },
    factorAggregate: null,
    recommendation: null,
    rate_decimal: null,
    narrative: []
  };

  if (!r.present) {
    r.narrative.push('Not applicable: no mezzanine financing is present in the proposed capital structure. The 13-factor Indmar / Roth Steel debt-vs-equity analysis, AHYDO testing, and OID accrual analysis below are not engaged on the present record.');
    return r;
  }

  r.inputs.principal = state.mezz_principal;
  r.inputs.stated_rate = state.mezz_stated_rate;
  r.inputs.paid_in_kind = !!state.mezz_paid_in_kind;
  r.inputs.equity_kicker = !!state.mezz_equity_kicker;
  r.inputs.maturity_years = state.mezz_maturity_years;
  r.inputs.subordination = state.mezz_subordination;
  r.inputs.scores = Object.assign({}, state.mezz_thirteen_factor_scores || {});

  // Normalize rate input
  if (state.mezz_stated_rate != null && state.mezz_stated_rate !== '') {
    const raw = String(state.mezz_stated_rate).replace('%', '').trim();
    const n = Number(raw);
    if (!isNaN(n)) {
      r.rate_decimal = n > 1 ? n / 100 : n;
    }
  }

  // Score aggregation (1..5 each, 13 factors → max 65, min 13)
  const factorKeys = MEZZ_RULES.thirteenFactorTest.factors.map(function (f) { return f.key; });
  let sum = 0;
  let count = 0;
  const perFactor = [];
  factorKeys.forEach(function (k) {
    const s = (r.inputs.scores && r.inputs.scores[k] != null) ? Number(r.inputs.scores[k]) : 3;
    const score = (isNaN(s) || s < 1 || s > 5) ? 3 : s;
    sum += score;
    count++;
    const f = MEZZ_RULES.thirteenFactorTest.factors.filter(function (x) { return x.key === k; })[0];
    perFactor.push({ key: k, label: f ? f.label : k, score: score, summary: f ? f.summary : '' });
  });

  r.factorAggregate = {
    sum: sum,
    count: count,
    average: count > 0 ? sum / count : 0,
    perFactor: perFactor
  };

  // Recommendation bands — drawn from MEZZ_RULES.aggregateBands
  const bands = MEZZ_RULES.thirteenFactorTest.aggregateBands;
  if (sum >= bands.debt.min) {
    r.recommendation = {
      band: 'debt',
      label: bands.debt.label,
      summary: bands.debt.summary,
      score: sum
    };
  } else if (sum >= bands.preferred_equity.min) {
    r.recommendation = {
      band: 'preferred_equity',
      label: bands.preferred_equity.label,
      summary: bands.preferred_equity.summary,
      score: sum
    };
  } else {
    r.recommendation = {
      band: 'disguised_equity',
      label: bands.disguised_equity.label,
      summary: bands.disguised_equity.summary,
      score: sum
    };
  }

  // AHYDO gating — only meaningful if instrument is respected as debt
  if (r.recommendation.band === 'debt') {
    const maturity = Number(state.mezz_maturity_years || 0);
    if ((maturity > 5 || state.mezz_paid_in_kind) && r.rate_decimal != null) {
      r.flags.ahydo_concern = true;
    }
  }

  r.flags.oid_accrual = !!state.mezz_paid_in_kind;
  r.flags.equity_kicker = !!state.mezz_equity_kicker;

  return r;
}

// =============================================================================
// THREAD 3 — QUALIFIED OPPORTUNITY ZONE ANALYSIS
// =============================================================================
// Analyzes QOZ investment structure under the OZ 1.0 / OZ 2.0 regimes.
// Auto-derives the regime from gain realization date (vs July 5, 2026 OBBBA
// effective boundary), surfaces the 2026 dead-zone trap, and identifies the
// passthrough K-1 180-day workaround where applicable.
// =============================================================================
function analyzeQOZ(state) {
  const r = {
    present: !!state.qoz_present,
    inputs: {},
    flags: {
      regime_oz_1_0: false,
      regime_oz_2_0: false,
      dead_zone_2026: false,
      passthrough_workaround_available: false,
      rural_qrof: false,
      designation_eligibility_caveat: false
    },
    regime: null,                              // 'oz_1_0' | 'oz_2_0' | null
    deadZoneFlag: null,
    workaroundFlag: null,
    narrative: []
  };

  if (!r.present) {
    r.narrative.push('Not applicable: no Qualified Opportunity Zone investment is present in the proposed structure. The analysis has considered and excluded the OZ 1.0 / OZ 2.0 regime analysis, the substantial-improvement test, the 2026 dead-zone trap, and the post-OBBBA eligibility caveats on the present record.');
    return r;
  }

  r.inputs.gain_realization_date = state.qoz_gain_realization_date;
  r.inputs.gain_source = state.qoz_gain_source;
  r.inputs.designation_regime = state.qoz_designation_regime;
  r.inputs.rural = !!state.qoz_rural;
  r.inputs.qozb_below_qof = !!state.qoz_qozb_below_qof;
  r.inputs.substantial_improvement_planned = !!state.qoz_substantial_improvement_planned;
  r.inputs.holding_period_target = state.qoz_holding_period_target;
  r.inputs.passthrough_180day_election = state.qoz_passthrough_180day_election;

  // Determine regime: explicit override or auto from gain realization date
  let regime;
  if (state.qoz_designation_regime === 'oz_1_0') {
    regime = 'oz_1_0';
  } else if (state.qoz_designation_regime === 'oz_2_0') {
    regime = 'oz_2_0';
  } else {
    // auto-derive: OZ 2.0 boundary is July 5, 2026 (OBBBA effective)
    if (state.qoz_gain_realization_date) {
      const gainDate = new Date(state.qoz_gain_realization_date);
      const ozBoundary = new Date('2026-07-05');
      regime = gainDate < ozBoundary ? 'oz_1_0' : 'oz_2_0';
    } else {
      regime = 'oz_2_0'; // forward-looking default; flag uncertainty in narrative
      r.narrative.push('No gain realization date entered. Defaulting to OZ 2.0 regime for prospective planning; confirm the gain realization date before relying on any part of this analysis.');
    }
  }

  r.regime = regime;
  if (regime === 'oz_1_0') {
    r.flags.regime_oz_1_0 = true;
    // Dead-zone check: OZ 1.0 with deferred-gain recognition on Dec 31, 2026
    if (state.qoz_gain_realization_date) {
      const gainDate = new Date(state.qoz_gain_realization_date);
      const deadZoneStart = new Date('2026-01-01');
      const ozBoundary = new Date('2026-07-05');
      if (gainDate >= deadZoneStart && gainDate < ozBoundary) {
        r.flags.dead_zone_2026 = true;
        // Workaround availability: only for pass-through gains
        if (state.qoz_gain_source === 'passthrough_k1') {
          r.flags.passthrough_workaround_available = true;
          r.workaroundFlag = {
            type: 'passthrough_180day',
            rule: QOZ_RULES.deadZone2026.workaround,
            practicePoint: QOZ_RULES.deadZone2026.practicePoint,
            actionable: 'Elect the partnership-return-due-date start under Reg. § 1.1400Z2(a)-1(c)(8)(iii) on the partnership return for 2026 (filed by March 15, 2027). This shifts the 180-day window deadline to September 11, 2027, well within OZ 2.0.'
          };
        } else {
          r.deadZoneFlag = {
            type: 'direct_gain_stuck',
            rule: 'Direct-recognition gains (Schedule D / Form 8949) realized in 2026 before July 5 are stuck in OZ 1.0. The 180-day deferral window closes before any OZ 2.0 investment can be made, and the deferred gain is recognized on December 31, 2026 regardless.',
            practicePoint: 'No structural workaround is available for direct-recognition gains in this window. Consider whether the gain can be deferred through other means (§ 1031 exchange if the asset qualifies, § 453 installment treatment, or holding to recognize after July 4, 2026) before electing OZ 1.0 treatment.'
          };
        }
      }
    }
  } else {
    r.flags.regime_oz_2_0 = true;
  }

  // Rural QROF flag
  if (state.qoz_rural) {
    r.flags.rural_qrof = true;
  }

  // OZ 2.0 eligibility caveat
  if (regime === 'oz_2_0') {
    r.flags.designation_eligibility_caveat = true;
  }

  return r;
}

// =============================================================================
// v12.2 — REIT ANALYSIS (Section X)
// =============================================================================
// Substantive analysis of REIT structure when state.reit_present === true.
// Covers: § 856 organizational + income + asset + distribution tests;
//         § 897(h)(4) DC-REIT exemption (shares NOT USRPI);
//         § 897(k)(2) public REIT 5%-shareholder carve-out;
//         § 856(l) Taxable REIT Subsidiary;
//         § 721 / § 721(c) UPREIT contribution mechanics if applicable.
// =============================================================================
function analyzeREIT(state) {
  const present = !!state.reit_present;
  if (!present) return { present: false, inputs: {}, flags: {} };

  const dc = state.reit_domestically_controlled === 'dc';
  const fc = state.reit_domestically_controlled === 'fc';
  const unknown = !dc && !fc;
  const isPublic = state.reit_public_or_private && state.reit_public_or_private.indexOf('public') === 0;
  const isPrivate = state.reit_public_or_private === 'private';
  const isUPREIT = state.reit_structure === 'umbrella_partnership_uprt';
  const hasTRS = !!state.reit_trs_present;
  const usOwnPct = parseFloat(state.reit_us_ownership_pct);
  const usOwnPctValid = !isNaN(usOwnPct);
  const distributionConcern = state.reit_distribution_compliance === 'concern';

  // Investor-mix signal: does the investor panel support DC achievability?
  // (Independent of what the practitioner asserted in state.reit_domestically_controlled.)
  let usSharePct = 0;
  let foreignSharePct = 0;
  (state.investors || []).forEach(function (inv) {
    const route = inv.route;
    const pct = typeof inv.pct === 'number' ? inv.pct : parseFloat(inv.pct) || 0;
    // Coarse: domestic_individual, tax_exempt, domestic_trust → US
    // foreign_*, swf → foreign
    // per_se_foreign_corp → foreign
    // foreign_pension → foreign
    if (route === 'domestic_individual' || route === 'tax_exempt' || route === 'domestic_trust') {
      usSharePct += pct;
    } else if (route && (route.indexOf('foreign_') === 0 || route === 'swf' || route === 'per_se_foreign_corp')) {
      foreignSharePct += pct;
    }
  });
  const investorMixSupportsDC = usSharePct > 50;
  const investorMixSupportsFC = foreignSharePct >= 50;

  return {
    present: true,
    inputs: {
      reit_domestically_controlled: state.reit_domestically_controlled,
      reit_public_or_private: state.reit_public_or_private,
      reit_structure: state.reit_structure,
      reit_us_ownership_pct: state.reit_us_ownership_pct,
      reit_share_class_5pct_test_concern: state.reit_share_class_5pct_test_concern,
      reit_trs_present: state.reit_trs_present,
      reit_uprt_contribution_planned: state.reit_uprt_contribution_planned,
      reit_distribution_compliance: state.reit_distribution_compliance
    },
    flags: {
      is_dc_reit: dc,
      is_fc_reit: fc,
      dc_status_unknown: unknown,
      is_public: isPublic,
      is_private: isPrivate,
      is_uprt: isUPREIT,
      has_trs: hasTRS,
      // DC-REIT structural achievability
      dc_threshold_met_per_practitioner: usOwnPctValid && usOwnPct > 50,
      dc_threshold_below_per_practitioner: usOwnPctValid && usOwnPct <= 50,
      investor_mix_supports_dc: investorMixSupportsDC,
      investor_mix_supports_fc: investorMixSupportsFC,
      // § 897(k)(2) — public REIT 5%-shareholder carve-out
      section_897k_carveout_potentially_applicable: isPublic && !state.reit_share_class_5pct_test_concern,
      section_897k_5pct_concern_raised: isPublic && state.reit_share_class_5pct_test_concern,
      // UPREIT § 721 + § 721(c) anti-abuse
      section_721c_concern: isUPREIT && foreignSharePct > 0,
      // Distribution compliance
      distribution_concern_raised: distributionConcern
    },
    investorMix: {
      us_share_pct: usSharePct,
      foreign_share_pct: foreignSharePct
    }
  };
}

// =============================================================================
// v13.0 — SPONSOR + TIER ANALYSIS (Section IV.B / IV.C)
// =============================================================================
// The sponsor side of a deal is structurally distinct from the investor panel:
// principals (natural persons or family-office vehicles), a Management Company
// (typically S-corp or LLC; receives base mgmt fee), a GP entity (LLC or LP;
// holds GP capital + management rights), and optionally a Carry Vehicle (separate
// entity holding the § 1061 API, common for estate-planning vertical-slice planning).
//
// The tier structure is the multi-layer ownership chain BELOW the target:
//   HoldCo → (MidCo) → OpCo → PropCo → Property
// Each tier serves distinct purposes (financing flexibility; bankruptcy
// remoteness; debt placement; per-asset isolation).
// =============================================================================
function analyzeSponsorAndTier(state) {
  const sponsorPresent = !!state.sponsor_present;
  const sponsorStructure = state.sponsor_structure || 'mgmt_co_plus_gp';
  const carryInSeparate = !!state.sponsor_carry_in_separate_vehicle;
  const familyOfficeAbove = !!state.sponsor_family_office_above;
  const mgmtCoForm = state.sponsor_mgmt_co_form || 's_corp';
  const gpForm = state.sponsor_gp_form || 'llc';

  const tierStructure = state.tier_structure || 'flat';
  const tierHoldco = tierStructure.indexOf('holdco') >= 0;
  const tierMidco = tierStructure.indexOf('midco') >= 0;
  const tierPropco = tierStructure.indexOf('propco') >= 0;

  // Composes "sponsorPresent + carryInSeparate" with the explicit sponsor_structure choice
  const hasSeparateCarry = sponsorPresent && (
    sponsorStructure === 'mgmt_co_plus_gp_plus_carry_vehicle' || carryInSeparate
  );
  const hasMgmtCo = sponsorPresent && sponsorStructure !== 'simple';
  const hasGP = sponsorPresent; // always present when sponsor side is present
  const hasFamilyOffice = sponsorPresent && familyOfficeAbove;

  return {
    sponsor: {
      present: sponsorPresent,
      structure: sponsorStructure,
      has_mgmt_co: hasMgmtCo,
      has_gp: hasGP,
      has_separate_carry: hasSeparateCarry,
      has_family_office: hasFamilyOffice,
      mgmt_co_form: mgmtCoForm,
      gp_form: gpForm
    },
    tier: {
      structure: tierStructure,
      has_holdco: tierHoldco,
      has_midco: tierMidco,
      has_propco: tierPropco,
      depth: 1 + (tierHoldco ? 1 : 0) + (tierMidco ? 1 : 0) + (tierPropco ? 1 : 0),
      holdco_rationale: state.tier_holdco_rationale || 'financing_flex',
      propco_rationale: state.tier_propco_rationale || 'lender_spe'
    }
  };
}

// =============================================================================
// v13.2 — § 1031 DST (Delaware Statutory Trust) ANALYSIS
// =============================================================================
// Rev. Rul. 2004-86 governs whether DST beneficial interests qualify as
// undivided fractional interests in real estate (so as to be acquired by 1031
// exchangers and receive § 1031 nonrecognition treatment). The "seven deadly
// sins" of Rev. Rul. 2004-86 are operational restrictions on the DST trustee
// that, if violated, would result in the DST being treated as a partnership
// (or business entity) rather than a grantor trust — breaking § 1031
// qualification for the beneficial interests.
// =============================================================================
function analyzeDST(state) {
  const present = !!state.dst_present;
  if (!present) return { present: false, inputs: {}, flags: {}, violations: [] };

  // Seven deadly sins — each violation is a check failure
  const violations = [];
  if (!state.dst_offering_closed) {
    violations.push({ sin: 1, name: 'Offering not closed', cite: 'Rev. Rul. 2004-86, Restriction 1', explanation: 'Trustee accepts additional capital contributions after the offering closes; DST treated as business entity.' });
  }
  if (state.dst_can_renegotiate_debt) {
    violations.push({ sin: 2, name: 'Trustee can renegotiate debt', cite: 'Rev. Rul. 2004-86, Restriction 2', explanation: 'Trustee retains discretion to renegotiate the terms of existing loans.' });
  }
  if (state.dst_can_reinvest_proceeds) {
    violations.push({ sin: 3, name: 'Trustee can reinvest sales proceeds', cite: 'Rev. Rul. 2004-86, Restriction 3', explanation: 'Trustee can reinvest sales proceeds into new property (active investment decision; turns DST into partnership).' });
  }
  if (!state.dst_capex_restricted_to_normal) {
    violations.push({ sin: 4, name: 'Capex not restricted', cite: 'Rev. Rul. 2004-86, Restriction 4', explanation: 'Capital expenditures not limited to normal repair/maintenance/minor non-structural improvements/replacements required by law.' });
  }
  if (!state.dst_reserves_short_term_us_debt_only) {
    violations.push({ sin: 6, name: 'Reserves not in short-term US debt', cite: 'Rev. Rul. 2004-86, Restriction 6', explanation: 'Cash reserves invested in instruments other than short-term US debt obligations.' });
  }
  if (!state.dst_distributions_at_least_annual) {
    violations.push({ sin: 7, name: 'Distributions less than annual', cite: 'Rev. Rul. 2004-86, Restriction 7', explanation: 'Distributions to beneficial interest holders are not at least annual.' });
  }

  return {
    present: true,
    inputs: {
      dst_sponsor_offering: state.dst_sponsor_offering,
      dst_exchanger_count: state.dst_exchanger_count,
      dst_master_lease_present: state.dst_master_lease_present,
      dst_springing_llc_provision: state.dst_springing_llc_provision
    },
    flags: {
      is_compliant: violations.length === 0,
      has_master_lease: !!state.dst_master_lease_present,
      has_springing_llc: !!state.dst_springing_llc_provision,
      is_sponsor_offering: !!state.dst_sponsor_offering
    },
    violations: violations
  };
}

// =============================================================================
// v13.2 — § 1031 TIC (Tenant-in-Common) ANALYSIS
// =============================================================================
// Rev. Proc. 2002-22 sets out 15 conditions for the IRS to consider issuing
// a private letter ruling that a TIC co-ownership arrangement is NOT a
// partnership for federal tax purposes. While not a safe harbor in strict
// terms (the IRS reserves discretion), the 15 conditions are the de facto
// industry standard for structuring TIC arrangements.
// =============================================================================
function analyzeTIC(state) {
  const present = !!state.tic_present;
  if (!present) return { present: false, inputs: {}, flags: {}, deficiencies: [] };

  const ownerCount = parseInt(state.tic_owner_count, 10);
  const ownerCountValid = !isNaN(ownerCount) && ownerCount > 0;

  // Check against Rev. Proc. 2002-22 conditions; flag deficiencies
  const deficiencies = [];
  if (ownerCountValid && ownerCount > 35) {
    deficiencies.push({ cond: 2, name: '35-owner cap exceeded', cite: 'Rev. Proc. 2002-22 § 6.02', explanation: 'TIC arrangement has more than 35 co-owners — outside the IRS PLR-favorable safe harbor; the IRS will not issue a favorable ruling.' });
  }
  if (!state.tic_unanimity_for_major_decisions) {
    deficiencies.push({ cond: 6, name: 'Major decisions not unanimous', cite: 'Rev. Proc. 2002-22 § 6.06', explanation: 'Major decisions (sale, leasing, refinancing) require less than unanimous consent — risks characterization as partnership.' });
  }
  if (!state.tic_management_agreement_annual) {
    deficiencies.push({ cond: 13, name: 'Management agreement not annual', cite: 'Rev. Proc. 2002-22 § 6.13', explanation: 'Management/brokerage agreement exceeds one year or is not renewable annually at FMV.' });
  }
  if (!state.tic_proportionate_profit_loss_sharing) {
    deficiencies.push({ cond: 8, name: 'Profit/loss not proportionate', cite: 'Rev. Proc. 2002-22 § 6.08', explanation: 'Co-owners do not share profits/losses in proportion to their undivided interests.' });
  }
  if (!state.tic_proportionate_debt_sharing) {
    deficiencies.push({ cond: 10, name: 'Debt not proportionate', cite: 'Rev. Proc. 2002-22 § 6.10', explanation: 'Co-owners do not share debt in proportion to their undivided interests.' });
  }
  if (!state.tic_individual_transfer_rights) {
    deficiencies.push({ cond: 9, name: 'Individual transfer rights restricted', cite: 'Rev. Proc. 2002-22 § 6.09', explanation: 'Co-owners cannot transfer or encumber their individual interests without other co-owners\' consent (beyond reasonable restrictions).' });
  }
  if (!state.tic_business_activities_minimal) {
    deficiencies.push({ cond: 12, name: 'Business activities beyond co-ownership', cite: 'Rev. Proc. 2002-22 § 6.12', explanation: 'TIC arrangement engaged in business activities beyond customary co-ownership and property maintenance.' });
  }
  if (!state.tic_sponsor_payments_fmv) {
    deficiencies.push({ cond: 15, name: 'Sponsor payments not FMV', cite: 'Rev. Proc. 2002-22 § 6.15', explanation: 'Payments to sponsors (or affiliates) not at fair market value.' });
  }

  return {
    present: true,
    inputs: {
      tic_owner_count: state.tic_owner_count,
      tic_lender_consent_required: state.tic_lender_consent_required
    },
    flags: {
      is_compliant: deficiencies.length === 0,
      owner_count_within_safe_harbor: ownerCountValid && ownerCount <= 35,
      owner_count_exceeds_safe_harbor: ownerCountValid && ownerCount > 35,
      owner_count: ownerCountValid ? ownerCount : null
    },
    deficiencies: deficiencies
  };
}

// =============================================================================
// v13.3 — § 42 LIHTC Syndication ANALYSIS
// =============================================================================
// Low-Income Housing Tax Credit syndication is the standard affordable-housing
// finance structure. Tax-credit investor (typically a bank under CRA mandate
// or an institutional investor seeking after-tax yield) contributes equity in
// exchange for ~99.99% of the federal LIHTCs (and accompanying losses).
// Developer/general partner contributes development services + 0.01% capital;
// receives a development fee + post-credit residual.
// =============================================================================
function analyzeLIHTC(state) {
  const present = !!state.lihtc_present;
  if (!present) return { present: false, inputs: {}, flags: {} };

  const creditType = state.lihtc_credit_type || '9_pct';
  const compliancePeriod = parseInt(state.lihtc_compliance_period_years, 10) || 15;
  const extendedUse = parseInt(state.lihtc_extended_use_period, 10) || 15;
  const totalCompliance = compliancePeriod + extendedUse;
  const hasStateCredits = !!state.lihtc_state_credits_present;
  const hasHistoricCredits = !!state.lihtc_historic_credits_present;
  const has130Boost = state.lihtc_qualified_basis_calc === 'qct_dda_130_boost';
  const recaptureFlag = !!state.lihtc_recapture_risk_concern;

  return {
    present: true,
    inputs: {
      lihtc_credit_type: creditType,
      lihtc_compliance_period_years: state.lihtc_compliance_period_years,
      lihtc_extended_use_period: state.lihtc_extended_use_period,
      lihtc_yield_to_investor_target_pct: state.lihtc_yield_to_investor_target_pct
    },
    flags: {
      is_9_pct: creditType === '9_pct',
      is_4_pct: creditType === '4_pct',
      is_combined: creditType === 'combined_9_4',
      has_state_credits: hasStateCredits,
      has_historic_credits: hasHistoricCredits,
      has_130_boost: has130Boost,
      recapture_concern_raised: recaptureFlag,
      total_compliance_years: totalCompliance
    }
  };
}

// =============================================================================
// v13.3 — § 48 ITC Solar Tax-Equity Flip ANALYSIS
// =============================================================================
// Investment Tax Credit partnership flip — the dominant pre-IRA solar tax-equity
// structure and still common post-IRA. Tax-equity investor receives 99% of ITC
// + depreciation + cash for the first ~5-10 years; "flip" occurs when investor
// reaches target IRR (typically 8%); post-flip allocations drop to ~5%.
//
// Post-IRA (2022+) overlays:
//   - § 48 ITC base 30% + adders for energy community / domestic content / low-income
//   - § 6418 transferability allows direct sale of credit to unrelated party
//     (avoiding partnership-flip complexity but at a discount, typically 92-95¢/$)
// =============================================================================
function analyzeSolarTaxEquity(state) {
  const present = !!state.solar_tax_equity_present;
  if (!present) return { present: false, inputs: {}, flags: {} };

  const structure = state.solar_tax_equity_structure || 'partnership_flip';
  const baseRate = parseFloat(state.solar_itc_base_rate_pct) || 30;
  const hasEnergyCommunity = !!state.solar_energy_community_adder;
  const hasDomesticContent = !!state.solar_domestic_content_adder;
  const hasLowIncome = !!state.solar_low_income_adder;
  const isTransferElection = structure === 'transfer_election_6418';

  // Cumulative ITC rate including adders (each adder is +10%, low-income can be +10 or +20%)
  let totalITC = baseRate;
  if (hasEnergyCommunity) totalITC += 10;
  if (hasDomesticContent) totalITC += 10;
  if (hasLowIncome) totalITC += 10; // simplification — could be +20 for some categories

  return {
    present: true,
    inputs: {
      solar_tax_equity_structure: structure,
      solar_itc_base_rate_pct: state.solar_itc_base_rate_pct,
      solar_pre_flip_investor_pct: state.solar_pre_flip_investor_pct,
      solar_post_flip_investor_pct: state.solar_post_flip_investor_pct,
      solar_flip_trigger: state.solar_flip_trigger,
      solar_target_irr_pct: state.solar_target_irr_pct
    },
    flags: {
      is_partnership_flip: structure === 'partnership_flip',
      is_transfer_election: isTransferElection,
      is_sale_leaseback: structure === 'sale_leaseback',
      has_energy_community_adder: hasEnergyCommunity,
      has_domestic_content_adder: hasDomesticContent,
      has_low_income_adder: hasLowIncome,
      adder_count: (hasEnergyCommunity ? 1 : 0) + (hasDomesticContent ? 1 : 0) + (hasLowIncome ? 1 : 0),
      total_itc_pct: totalITC,
      post_ira: true // tool is post-2022; ITC base is 30%, transferability available
    }
  };
}

// =============================================================================
// THREAD 3 — STRUCTURE GRAPH DERIVATION
// =============================================================================
// Pure function that consumes the analysis output and produces a graph
// (nodes + edges) representing the proposed structure. Layered top-to-bottom:
//   investors → blocker (conditional) → target entity → qoz (conditional) →
//   property. The graph is consumed by the SVG renderer and by the
//   downstream-handoff payload builder.
// =============================================================================
function deriveStructureGraph(state, analysis) {
  const nodes = [];
  const edges = [];

  const inv = analysis.investorPanel || analysis.entityClassification.investorPanel;
  const ec = analysis.entityClassification;
  const qz = analysis.qoz;
  const sponsorTier = analysis.sponsorTier || { sponsor: { present: false }, tier: { structure: 'flat' } };

  // ============================================================================
  // Layer 0 — Sponsor cluster (v13.0) — rendered above investor layer
  // ============================================================================
  // Topology:
  //   [Family Office] → Principal → [ManagementCo, GP Entity, Carry Vehicle]
  //                                          ↓ (mgmt fee + GP equity + carry)
  //                                       Fund/Target
  //
  // For v13.0 simplicity, the sponsor cluster is positioned in the 'sponsor'
  // layer above 'investors'. The edges from sponsor entities to target use
  // semantic edge kinds (service_contract, fee_flow, ownership_gp, ownership_carry)
  // from the v12.0 edge vocabulary.
  // ============================================================================
  let sponsorPrincipalId = null;
  let mgmtCoId = null;
  let gpEntityId = null;
  let carryVehicleId = null;
  let familyOfficeId = null;
  if (sponsorTier.sponsor.present) {
    // Family Office (top of sponsor stack — optional)
    if (sponsorTier.sponsor.has_family_office) {
      familyOfficeId = 'sponsor_family_office';
      nodes.push({
        id: familyOfficeId,
        type: 'family_office_vehicle',
        layer: 'sponsor',
        label: 'Family Office',
        sublabel: 'GRAT / IDGT / Family LP',
        pct: '',
        meta: { role: 'principal_estate_vehicle' }
      });
    }

    // Sponsor Principal (natural person OR family-office vehicle as the "owner" of the sponsor side)
    sponsorPrincipalId = 'sponsor_principal';
    nodes.push({
      id: sponsorPrincipalId,
      type: 'person',
      layer: 'sponsor',
      label: 'Principal',
      sublabel: 'Sponsor Principal(s)',
      pct: '',
      meta: { role: 'sponsor_principal' }
    });
    if (familyOfficeId) {
      edges.push({
        id: 'edge_' + familyOfficeId + '_to_' + sponsorPrincipalId,
        from: familyOfficeId,
        to: sponsorPrincipalId,
        kind: 'ownership',
        label: ''
      });
    }

    // GP entity (always present when sponsor side is present)
    if (sponsorTier.sponsor.has_gp) {
      gpEntityId = 'sponsor_gp_entity';
      nodes.push({
        id: gpEntityId,
        type: 'gp_entity',
        layer: 'sponsor',
        label: 'GP Entity',
        sublabel: (sponsorTier.sponsor.gp_form === 'lp' ? 'GP (LP)' : (sponsorTier.sponsor.gp_form === 'c_corp' ? 'GP (C-Corp)' : 'GP (LLC)')),
        pct: '',
        meta: { role: 'gp', form: sponsorTier.sponsor.gp_form }
      });
      edges.push({
        id: 'edge_' + sponsorPrincipalId + '_to_' + gpEntityId,
        from: sponsorPrincipalId,
        to: gpEntityId,
        kind: 'ownership',
        label: ''
      });
    }

    // ManagementCo
    if (sponsorTier.sponsor.has_mgmt_co) {
      mgmtCoId = 'sponsor_mgmt_co';
      const mgmtForm = sponsorTier.sponsor.mgmt_co_form;
      const mgmtFormLabel = mgmtForm === 's_corp' ? 'S-Corp' : (mgmtForm === 'c_corp' ? 'C-Corp' : 'LLC');
      nodes.push({
        id: mgmtCoId,
        type: 'management_company',
        layer: 'sponsor',
        label: 'ManagementCo',
        sublabel: mgmtFormLabel + ' — IMA party',
        pct: '',
        meta: { role: 'management_company', form: mgmtForm }
      });
      edges.push({
        id: 'edge_' + sponsorPrincipalId + '_to_' + mgmtCoId,
        from: sponsorPrincipalId,
        to: mgmtCoId,
        kind: 'ownership',
        label: ''
      });
    }

    // Carry Vehicle (separate entity holding the API)
    if (sponsorTier.sponsor.has_separate_carry) {
      carryVehicleId = 'sponsor_carry_vehicle';
      nodes.push({
        id: carryVehicleId,
        type: 'carry_vehicle',
        layer: 'sponsor',
        label: 'Carry Vehicle',
        sublabel: '§ 1061 API',
        pct: '',
        meta: { role: 'carry_vehicle' }
      });
      edges.push({
        id: 'edge_' + sponsorPrincipalId + '_to_' + carryVehicleId,
        from: sponsorPrincipalId,
        to: carryVehicleId,
        kind: 'ownership',
        label: ''
      });
    }
  }

  // Layer 1 — Investors (with per-route blocker decision tracking)
  const investorIds = [];
  const blockerRoutedIds = [];   // investors whose route calls for blocker interposition
  const directRoutedIds = [];    // investors who own the target directly
  const invItems = (inv && inv.items) || [];
  if (invItems.length) {
    invItems.forEach(function (ia, idx) {
      const nodeId = 'investor_' + (ia.id || idx);
      investorIds.push(nodeId);
      const route = ia.routeKey;
      let nodeType = 'person';
      // Map investor route → node type
      if (route === 'domestic_individual' || route === 'foreign_individual') {
        nodeType = 'person';
      } else if (route === 'tax_exempt') {
        nodeType = 'c_corp'; // tax-exempt typically organized as nonprofit corp
      } else if (route === 'swf') {
        nodeType = 'foreign_corp';
      } else if (route === 'foreign_corporation') {
        nodeType = 'foreign_corp';
      } else if (route === 'per_se_foreign_corp') {
        nodeType = 'per_se_foreign_corp';
      } else if (route === 'foreign_pension') {
        nodeType = 'foreign_corp';
      } else if (route === 'domestic_trust') {
        nodeType = 'domestic_trust';
      } else if (route === 'foreign_trust') {
        nodeType = (ia.subRouteKey && ia.subRouteKey.indexOf('grantor') === 0) ? 'foreign_grantor_trust' : 'foreign_non_grantor_trust';
      }
      nodes.push({
        id: nodeId,
        type: nodeType,
        layer: 'investors',
        label: ia.label || ('Investor ' + (idx + 1)),
        sublabel: ia.routeLabel || '',
        pct: ia.pct || '',
        meta: { routeKey: route, country: ia.country }
      });

      // Per-route blocker decision — consult INVESTOR_ROUTES, not deal-level flags
      const routeDef = INVESTOR_ROUTES[route];
      const blockerRec = routeDef && routeDef.blocker && routeDef.blocker.recommended;
      let routeThroughBlocker;
      if (blockerRec === true) {
        // Recommended: SWF, foreign individual — always route through blocker
        routeThroughBlocker = true;
      } else if (blockerRec === 'conditional') {
        // Conditional: tax_exempt, foreign_corp, foreign_trust — conditional triggers fire
        // by definition once these investors are in the deal (UBTI present iff tax-exempt
        // present, etc.), so condition is satisfied.
        //
        // SUB-CONDITIONAL: A foreign grantor trust with a U.S. grantor is subject to § 679
        // and follows domestic-trust analysis (direct ownership), per INVESTOR_ROUTES.foreign_trust.blocker.rationale.
        // Honor that sub-conditional when the practitioner flags grantor_is_us_person.
        if (route === 'foreign_trust'
            && (ia.subRouteKey === 'grantor' || (ia.subRouteKey && ia.subRouteKey.indexOf('grantor') === 0))
            && ia.grantor_is_us_person === true) {
          routeThroughBlocker = false;  // direct — domestic-trust analysis controls
        } else {
          routeThroughBlocker = true;
        }
      } else if (blockerRec === 'inherent') {
        // Per-se foreign corp: already corporate. Default direct; the additional U.S.
        // blocker layer is an optional add-on the practitioner refines manually.
        routeThroughBlocker = false;
      } else {
        // false (or any other value): domestic individual, QFPF, domestic trust — direct.
        // QFPF in particular MUST stay direct (§ 897(l) exemption destroyed by blocker).
        routeThroughBlocker = false;
      }

      if (routeThroughBlocker) blockerRoutedIds.push(nodeId);
      else directRoutedIds.push(nodeId);
    });
  } else {
    // Placeholder investor node if none defined
    nodes.push({
      id: 'investor_placeholder',
      type: 'person',
      layer: 'investors',
      label: '[Investor]',
      sublabel: 'Identity TBD',
      pct: '',
      meta: {}
    });
    investorIds.push('investor_placeholder');
    directRoutedIds.push('investor_placeholder');
  }

  // ============================================================================
  // Layer 2 — Blocker(s) — v12.1 multi-strategy
  // ============================================================================
  // Three strategies (read from state.blocker_strategy):
  //   'auto_shared' (default)        — one shared blocker_corp for all blocker-routed investors
  //   'separate_per_class'           — up to 5 parallel blockers, one per route-class
  //   'manual_configured'            — practitioner-assigned (v12.1 falls back to auto_shared)
  //
  // Plus optional Cayman/foreign top-of-stack (state.blocker_use_intermediate):
  //   When true, blocker-routed investors → intermediate_blocker_foreign → US blocker(s) → target
  // ============================================================================
  const blockerStrategy = state.blocker_strategy || 'auto_shared';
  const useIntermediate = state.blocker_use_intermediate === true;
  const intermediateJurisdiction = state.blocker_intermediate_jurisdiction || 'KY';
  // Map jurisdiction codes to display names
  const intermediateJurisdictionLabel = ({
    KY: 'Cayman', BM: 'Bermuda', BS: 'Bahamas', LU: 'Luxembourg',
    IE: 'Ireland', NL: 'Netherlands', LI: 'Liechtenstein'
  })[intermediateJurisdiction] || intermediateJurisdiction;

  let blockerIds = [];          // collection of all US blocker node IDs created
  let intermediateBlockerId = null;

  if (blockerRoutedIds.length > 0) {
    // Group investors by triggering route-class for `separate_per_class` strategy
    const investorsByRouteClass = {};   // routeKey → [investorNodeIds]
    blockerRoutedIds.forEach(function (iid) {
      const node = nodes.filter(function (n) { return n.id === iid; })[0];
      if (!node || !node.meta || !node.meta.routeKey) return;
      const rk = node.meta.routeKey;
      if (!investorsByRouteClass[rk]) investorsByRouteClass[rk] = [];
      investorsByRouteClass[rk].push(iid);
    });

    // Rationale labels per route-class
    const rationaleByRoute = {
      tax_exempt: 'UBTI mitigation',
      swf: '§ 892 commercial-activity insulation',
      foreign_individual: 'FIRPTA conversion',
      foreign_corporation: 'BPT / treaty management',
      foreign_trust: 'UNI / throwback avoidance'
    };
    // Sub-label per blocker (when separate-per-class)
    const sublabelByRoute = {
      tax_exempt: 'UBTI Blocker',
      swf: '§ 892 Blocker',
      foreign_individual: 'FIRPTA Blocker',
      foreign_corporation: 'BPT Blocker',
      foreign_trust: 'UNI Blocker'
    };

    if (blockerStrategy === 'separate_per_class') {
      // Generate a separate blocker per route-class
      Object.keys(investorsByRouteClass).forEach(function (routeKey) {
        const bId = 'blocker_corp_' + routeKey;
        blockerIds.push(bId);
        nodes.push({
          id: bId,
          type: 'c_corp',
          layer: 'blocker',
          label: sublabelByRoute[routeKey] || 'Blocker Corp.',
          sublabel: 'C Corporation Blocker',
          pct: '',
          meta: {
            rationale: rationaleByRoute[routeKey] || 'Blocker',
            routesServed: [routeKey],
            strategy: 'separate_per_class'
          }
        });
        // Edges from the route-class's investors → this blocker
        investorsByRouteClass[routeKey].forEach(function (iid) {
          edges.push({
            id: 'edge_' + iid + '_to_' + bId,
            from: iid,
            to: bId,
            kind: 'ownership',
            label: ''
          });
        });
      });
    } else {
      // 'auto_shared' (default) — and 'manual_configured' falls back here for v12.1
      const sharedId = 'blocker_corp';
      blockerIds.push(sharedId);
      const rationaleParts = Object.keys(investorsByRouteClass)
        .map(function (rk) { return rationaleByRoute[rk]; })
        .filter(Boolean);
      const routesServed = Object.keys(investorsByRouteClass);
      nodes.push({
        id: sharedId,
        type: 'c_corp',
        layer: 'blocker',
        label: 'Blocker Corp.',
        sublabel: 'C Corporation Blocker',
        pct: '',
        meta: {
          rationale: rationaleParts.join('; ') || 'Blocker',
          routesServed: routesServed,
          strategy: blockerStrategy === 'manual_configured' ? 'manual_configured_fallback' : 'auto_shared'
        }
      });
      // Edges from all blocker-routed investors → shared blocker
      blockerRoutedIds.forEach(function (iid) {
        edges.push({
          id: 'edge_' + iid + '_to_' + sharedId,
          from: iid,
          to: sharedId,
          kind: 'ownership',
          label: ''
        });
      });
    }

    // Cayman / foreign intermediate top-of-stack
    // When enabled, blocker-routed investors connect to the intermediate; the
    // intermediate connects down to each US blocker. The investor-to-US-blocker
    // edges are rewritten to investor-to-intermediate, and new intermediate-to-US-blocker
    // edges are added.
    if (useIntermediate) {
      intermediateBlockerId = 'intermediate_blocker_' + intermediateJurisdiction.toLowerCase();
      nodes.push({
        id: intermediateBlockerId,
        type: 'intermediate_blocker_foreign',
        layer: 'intermediate_blocker',
        label: intermediateJurisdictionLabel + ' Blocker',
        sublabel: 'Foreign Intermediate (treaty + § 894 risk)',
        pct: '',
        meta: {
          jurisdiction: intermediateJurisdiction,
          rationale: 'Foreign intermediate above US blocker; treaty + § 894 anti-conduit + § 7701(l) conduit-financing caveats apply',
          servesBlockers: blockerIds.slice()
        }
      });

      // Rewrite all investor → US-blocker edges to investor → intermediate
      const newEdges = [];
      edges.forEach(function (ed) {
        if (blockerIds.indexOf(ed.to) >= 0 && blockerRoutedIds.indexOf(ed.from) >= 0) {
          // Redirect this edge to point at the intermediate instead
          newEdges.push({
            id: 'edge_' + ed.from + '_to_' + intermediateBlockerId,
            from: ed.from,
            to: intermediateBlockerId,
            kind: 'ownership',
            label: ''
          });
        } else {
          newEdges.push(ed);
        }
      });
      // Replace edges with newEdges
      edges.length = 0;
      newEdges.forEach(function (ed) { edges.push(ed); });

      // Add intermediate → each US blocker edge
      blockerIds.forEach(function (bId) {
        edges.push({
          id: 'edge_' + intermediateBlockerId + '_to_' + bId,
          from: intermediateBlockerId,
          to: bId,
          kind: 'ownership',
          label: ''
        });
      });
    }
  }

  // For backward-compatibility, expose a `blockerId` (used by Layer 3 routing
  // below) — for separate-per-class, this becomes the array; for auto_shared,
  // the single shared blocker.
  const blockerId = blockerIds.length === 1 ? blockerIds[0] : null;

  // ============================================================================
  // Layer 2.5 — REIT (v12.2) — conditional: state.reit_present === true
  // ============================================================================
  // When REIT is present, the topology becomes:
  //   investors/blockers → REIT → [UPREIT OP if applicable] → target → property
  //   + TRS sibling of REIT (if reit_trs_present)
  // ============================================================================
  const reitAnalysis = analysis.reit;
  const reitPresent = reitAnalysis && reitAnalysis.present;
  let reitId = null;
  let uprtOpId = null;
  let trsId = null;
  if (reitPresent) {
    reitId = 'reit_entity';
    // Compose DC/FC and PUB/PRIV sublabel
    const dcfc = reitAnalysis.flags.is_dc_reit ? 'DC' : (reitAnalysis.flags.is_fc_reit ? 'FC' : 'DC/FC TBD');
    const pubpriv = reitAnalysis.flags.is_public ? 'Public' : (reitAnalysis.flags.is_private ? 'Private' : '');
    const sublabel = pubpriv ? (dcfc + '-REIT (' + pubpriv + ')') : (dcfc + '-REIT');
    nodes.push({
      id: reitId,
      type: 'reit',
      layer: 'blocker', // sits in the blocker layer (above target); could be its own layer
      label: 'REIT',
      sublabel: sublabel,
      pct: '',
      meta: {
        dc: reitAnalysis.flags.is_dc_reit,
        fc: reitAnalysis.flags.is_fc_reit,
        public: reitAnalysis.flags.is_public,
        private: reitAnalysis.flags.is_private,
        uprt: reitAnalysis.flags.is_uprt,
        trs_present: reitAnalysis.flags.has_trs
      }
    });
    // Edges from blockers → REIT (if blockers exist)
    blockerIds.forEach(function (bId) {
      edges.push({
        id: 'edge_' + bId + '_to_' + reitId,
        from: bId,
        to: reitId,
        kind: 'ownership',
        label: ''
      });
    });
    // Edges from direct-routed investors → REIT
    directRoutedIds.forEach(function (iid) {
      edges.push({
        id: 'edge_' + iid + '_to_' + reitId,
        from: iid,
        to: reitId,
        kind: 'ownership',
        label: ''
      });
    });

    // UPREIT OP — inserted between REIT and target when UPREIT structure
    if (reitAnalysis.flags.is_uprt) {
      uprtOpId = 'uprt_op_entity';
      nodes.push({
        id: uprtOpId,
        type: 'uprt_op',
        layer: 'blocker',
        label: 'UPREIT OP',
        sublabel: 'Operating Partnership',
        pct: '',
        meta: { reit_owner: reitId }
      });
      edges.push({
        id: 'edge_' + reitId + '_to_' + uprtOpId,
        from: reitId,
        to: uprtOpId,
        kind: 'ownership',
        label: ''
      });
    }

    // TRS — sibling of REIT (or sibling of UPREIT OP if UPREIT) for RIDEA-style structures
    if (reitAnalysis.flags.has_trs) {
      trsId = 'trs_entity';
      nodes.push({
        id: trsId,
        type: 'trs',
        layer: 'blocker',
        label: 'TRS',
        sublabel: '§ 856(l)',
        pct: '',
        meta: { parent: uprtOpId || reitId, role: 'rideea_or_active_operations' }
      });
      // TRS owned by REIT (or by UPREIT OP if UPREIT)
      const trsParent = uprtOpId || reitId;
      edges.push({
        id: 'edge_' + trsParent + '_to_' + trsId,
        from: trsParent,
        to: trsId,
        kind: 'ownership',
        label: ''
      });
    }
  }

  // Layer 3 — Target entity (the partnership / LLC being formed)
  const targetId = 'target_entity';
  let targetType = 'llc';
  if (state.proposed_entity_type === 'foreign_eligible') {
    targetType = 'ctb_eligible_foreign';
  } else if (state.proposed_entity_type === 'foreign_per_se') {
    targetType = 'per_se_foreign_corp';
  } else if (state.proposed_member_count === 'one_member') {
    targetType = 'dre'; // single-member LLC defaults to disregarded
    if (state.ctb_election === 'elect_corp') targetType = 'c_corp';
    if (state.ctb_election === 'elect_partnership') targetType = 'llc';
  } else {
    targetType = 'llc';
    if (state.ctb_election === 'elect_corp') targetType = 'c_corp';
  }
  nodes.push({
    id: targetId,
    type: targetType,
    layer: 'target',
    label: state.project_name || 'Target Entity',
    sublabel: NODE_TYPES[targetType] ? NODE_TYPES[targetType].label : targetType,
    pct: '',
    meta: { jurisdiction: state.jurisdiction }
  });

  // Edges into target.
  // v12.2: When REIT is present, the REIT (or UPREIT OP) connects to target.
  //   - UPREIT: REIT → UPREIT OP → target
  //   - Standalone REIT: REIT → target (TRS is sibling, not in this chain)
  //   - No REIT: blockers/direct investors → target (v12.1 behavior preserved)
  if (reitPresent) {
    // REIT or UPREIT OP connects down to target
    const reitChainBottom = uprtOpId || reitId;
    edges.push({
      id: 'edge_' + reitChainBottom + '_to_' + targetId,
      from: reitChainBottom,
      to: targetId,
      kind: 'ownership',
      label: ''
    });
    // Direct-routed investors and blockers already edged to REIT above; no more edges to target needed.
  } else {
    // Pre-v12.2 behavior: blockers/direct investors → target
    blockerIds.forEach(function (bId) {
      edges.push({
        id: 'edge_' + bId + '_to_' + targetId,
        from: bId,
        to: targetId,
        kind: 'ownership',
        label: ''
      });
    });
    directRoutedIds.forEach(function (iid) {
      edges.push({
        id: 'edge_' + iid + '_to_' + targetId,
        from: iid,
        to: targetId,
        kind: 'ownership',
        label: ''
      });
    });
  }

  // ============================================================================
  // Sponsor → Target semantic edges (v13.0)
  // ============================================================================
  // GP equity (typically 1% capital + management rights) — ownership_gp edge.
  // ManagementCo service contract under IMA — service_contract edge.
  // Carry vehicle holding § 1061 API — ownership_carry edge.
  // These edges use the v12.0 vocabulary and surface in the legend.
  // ============================================================================
  if (gpEntityId) {
    edges.push({
      id: 'edge_' + gpEntityId + '_to_' + targetId,
      from: gpEntityId,
      to: targetId,
      kind: 'ownership_gp',
      label: 'GP'
    });
  }
  if (mgmtCoId) {
    edges.push({
      id: 'edge_' + mgmtCoId + '_to_' + targetId,
      from: mgmtCoId,
      to: targetId,
      kind: 'service_contract',
      label: 'IMA'
    });
  }
  if (carryVehicleId) {
    edges.push({
      id: 'edge_' + carryVehicleId + '_to_' + targetId,
      from: carryVehicleId,
      to: targetId,
      kind: 'ownership_carry',
      label: 'API'
    });
  }

  // ============================================================================
  // Multi-tier operating structure (v13.0) — between target and QOZ/property
  // ============================================================================
  // The "target" node above is conceptually the top of the operating chain.
  // When tier_structure is non-flat, we render an additional chain BELOW target:
  //   target → [HoldCo] → [MidCo] → [PropCo] → property
  // Each tier is conditional based on tier_structure.
  // ============================================================================
  let tierBottom = targetId; // the bottom of the tier chain — connects to property/QOZ
  if (sponsorTier.tier.has_holdco) {
    // Note: In real practice, HoldCo is often ABOVE the OpCo (target). For
    // diagram clarity in v13.0, we render HoldCo as the first tier BELOW
    // target, with the understanding that the target node is functioning as
    // the master vehicle and HoldCo/MidCo/PropCo are intermediate holding
    // entities en route to the property terminal.
    const holdcoId = 'tier_holdco';
    nodes.push({
      id: holdcoId,
      type: 'holdco',
      layer: 'tier_below',
      label: 'HoldCo',
      sublabel: 'Holding Entity',
      pct: '',
      meta: { tier: 'holdco', rationale: sponsorTier.tier.holdco_rationale }
    });
    edges.push({
      id: 'edge_' + tierBottom + '_to_' + holdcoId,
      from: tierBottom,
      to: holdcoId,
      kind: 'ownership',
      label: ''
    });
    tierBottom = holdcoId;
  }
  if (sponsorTier.tier.has_midco) {
    const midcoId = 'tier_midco';
    nodes.push({
      id: midcoId,
      type: 'midco',
      layer: 'tier_below',
      label: 'MidCo',
      sublabel: 'Intermediate Tier',
      pct: '',
      meta: { tier: 'midco' }
    });
    edges.push({
      id: 'edge_' + tierBottom + '_to_' + midcoId,
      from: tierBottom,
      to: midcoId,
      kind: 'ownership',
      label: ''
    });
    tierBottom = midcoId;
  }
  if (sponsorTier.tier.has_propco) {
    const propcoId = 'tier_propco';
    nodes.push({
      id: propcoId,
      type: 'propco',
      layer: 'tier_below',
      label: 'PropCo',
      sublabel: 'Single-Asset SPE',
      pct: '',
      meta: { tier: 'propco', rationale: sponsorTier.tier.propco_rationale }
    });
    edges.push({
      id: 'edge_' + tierBottom + '_to_' + propcoId,
      from: tierBottom,
      to: propcoId,
      kind: 'ownership',
      label: ''
    });
    tierBottom = propcoId;
  }
  // tierBottom is now the entity that should connect to property (or QOZ if present).

  // ============================================================================
  // v13.2 — § 1031 Specialty Layer (DST or TIC)
  // ============================================================================
  // DST trust or TIC co-owner pool inserted between tier-bottom (or target) and
  // property. The DST/TIC is the "container" that ultimately holds the property;
  // 1031 exchangers acquire beneficial interests (DST) or undivided fractional
  // interests (TIC). Diagrammatically, the DST/TIC node sits above property.
  // ============================================================================
  const dstAnalysis = analysis.dst;
  const ticAnalysis = analysis.tic;
  let dstId = null;
  let ticId = null;
  if (dstAnalysis && dstAnalysis.present) {
    dstId = 'dst_entity';
    nodes.push({
      id: dstId,
      type: 'dst_trust',
      layer: 'qoz', // reuse qoz layer for visual positioning (between target and property)
      label: 'DST',
      sublabel: dstAnalysis.flags.is_compliant ? 'Rev. Rul. 2004-86 ✓' : 'Rev. Rul. 2004-86 ✗ (' + dstAnalysis.violations.length + ' sin' + (dstAnalysis.violations.length === 1 ? '' : 's') + ')',
      pct: '',
      meta: {
        compliant: dstAnalysis.flags.is_compliant,
        violation_count: dstAnalysis.violations.length,
        has_master_lease: dstAnalysis.flags.has_master_lease,
        has_springing_llc: dstAnalysis.flags.has_springing_llc
      }
    });
    edges.push({
      id: 'edge_' + tierBottom + '_to_' + dstId,
      from: tierBottom,
      to: dstId,
      kind: 'ownership',
      label: ''
    });
    tierBottom = dstId; // DST becomes the new bottom — property edge flows from here
  }
  if (ticAnalysis && ticAnalysis.present) {
    ticId = 'tic_entity';
    const ownerCount = ticAnalysis.flags.owner_count;
    const sublabel = ownerCount !== null
      ? 'Rev. Proc. 2002-22 (' + ownerCount + ' co-owner' + (ownerCount === 1 ? '' : 's') + (ticAnalysis.flags.owner_count_exceeds_safe_harbor ? ' — exceeds cap' : '') + ')'
      : 'Rev. Proc. 2002-22';
    nodes.push({
      id: ticId,
      type: 'tic_owner_pool',
      layer: 'qoz', // reuse qoz layer
      label: 'TIC Co-Ownership',
      sublabel: sublabel,
      pct: '',
      meta: {
        compliant: ticAnalysis.flags.is_compliant,
        owner_count: ownerCount,
        within_safe_harbor: ticAnalysis.flags.owner_count_within_safe_harbor
      }
    });
    edges.push({
      id: 'edge_' + tierBottom + '_to_' + ticId,
      from: tierBottom,
      to: ticId,
      kind: 'ownership',
      label: ''
    });
    tierBottom = ticId;
  }

  // ============================================================================
  // v13.3 — Tax-Credit Layer (LIHTC + Solar Tax-Equity)
  // ============================================================================
  // When LIHTC or Solar tax-equity is configured, insert a tax-credit investor
  // node (sits in the investor layer; conceptually it's an institutional LP
  // holding 99% of the credits) and a Project LP node (sits between target
  // and property; receives the federal credits and passes them to the LP).
  // ============================================================================
  const lihtcAnalysis = analysis.lihtc;
  const solarAnalysis = analysis.solarTaxEquity;
  let tciId = null;
  let projectLpId = null;
  if ((lihtcAnalysis && lihtcAnalysis.present) || (solarAnalysis && solarAnalysis.present)) {
    // Tax-credit investor — placed in the investor layer
    tciId = 'tax_credit_investor';
    let tciSublabel = '';
    if (lihtcAnalysis && lihtcAnalysis.present) {
      const ctLabel = lihtcAnalysis.flags.is_9_pct ? '9% LIHTC' : (lihtcAnalysis.flags.is_4_pct ? '4% LIHTC' : 'Combined 9/4%');
      tciSublabel = '§ 42 ' + ctLabel + ' (99.99% LP)';
    } else if (solarAnalysis && solarAnalysis.present) {
      if (solarAnalysis.flags.is_partnership_flip) {
        tciSublabel = '§ 48 ITC ' + String(solarAnalysis.flags.total_itc_pct) + '% (' + (state.solar_pre_flip_investor_pct || '99') + '% pre-flip)';
      } else if (solarAnalysis.flags.is_transfer_election) {
        tciSublabel = '§ 6418 Transferee (' + String(solarAnalysis.flags.total_itc_pct) + '% ITC)';
      } else {
        tciSublabel = '§ 48 ITC Lessor';
      }
    }
    nodes.push({
      id: tciId,
      type: 'tax_credit_investor',
      layer: 'investors',
      label: 'Tax-Credit Investor',
      sublabel: tciSublabel,
      pct: '',
      meta: {
        lihtc: !!(lihtcAnalysis && lihtcAnalysis.present),
        solar: !!(solarAnalysis && solarAnalysis.present),
        structure: solarAnalysis && solarAnalysis.present ? solarAnalysis.inputs.solar_tax_equity_structure : null
      }
    });
    // Tax-credit investor → target (the target IS the project LP in simple structures)
    edges.push({
      id: 'edge_' + tciId + '_to_' + targetId,
      from: tciId,
      to: targetId,
      kind: 'ownership',
      label: '99%'
    });

    // Project LP node — sits between target (top) and property/tier-bottom
    // Inserted only if the practitioner wants the dedicated project-LP node;
    // for v13.3, we always render it when LIHTC or solar is present, as the
    // canonical LIHTC / ITC structure has a distinct project LP under a holding entity.
    projectLpId = 'project_lp_entity';
    let projectLpSublabel = '';
    if (lihtcAnalysis && lihtcAnalysis.present) {
      projectLpSublabel = 'LIHTC Project LP';
    } else if (solarAnalysis && solarAnalysis.present) {
      projectLpSublabel = 'Solar Project LP';
    }
    nodes.push({
      id: projectLpId,
      type: 'project_lp',
      layer: 'qoz', // reuse qoz layer position (between target and property)
      label: 'Project LP',
      sublabel: projectLpSublabel,
      pct: '',
      meta: {
        lihtc: !!(lihtcAnalysis && lihtcAnalysis.present),
        solar: !!(solarAnalysis && solarAnalysis.present)
      }
    });
    // tierBottom (target or tier-chain bottom) → Project LP
    edges.push({
      id: 'edge_' + tierBottom + '_to_' + projectLpId,
      from: tierBottom,
      to: projectLpId,
      kind: 'ownership',
      label: ''
    });
    tierBottom = projectLpId; // Project LP is new tier-bottom; property edges from here
  }

  // Layer 4 — QOZ (conditional: QOF/QOZB present)
  let qofId = null;
  let qozbId = null;
  if (qz && qz.present) {
    qofId = 'qof_entity';
    nodes.push({
      id: qofId,
      type: 'qozb_qozf',
      layer: 'qoz',
      label: (qz.flags.rural_qrof ? 'QROF' : 'QOF'),
      sublabel: qz.flags.rural_qrof ? 'Qualified Rural Opportunity Fund' : 'Qualified Opportunity Fund',
      pct: '',
      meta: { regime: qz.regime, rural: qz.flags.rural_qrof }
    });
    // Edge target → QOF
    edges.push({
      id: 'edge_' + targetId + '_to_' + qofId,
      from: targetId,
      to: qofId,
      kind: 'ownership',
      label: ''
    });
    if (qz.inputs.qozb_below_qof) {
      qozbId = 'qozb_entity';
      nodes.push({
        id: qozbId,
        type: 'qozb_qozf',
        layer: 'qoz',
        label: 'QOZB',
        sublabel: 'Qualified Opportunity Zone Business',
        pct: '',
        meta: { regime: qz.regime, role: 'qozb_operating' }
      });
      edges.push({
        id: 'edge_' + qofId + '_to_' + qozbId,
        from: qofId,
        to: qozbId,
        kind: 'ownership',
        label: ''
      });
    }
  }

  // Layer 5 — Property (v13.6: multi-property mode when state.properties_count > 1)
  const propertiesCount = Math.max(1, parseInt(state.properties_count, 10) || 1);
  const terminalOwner = qozbId || qofId || tierBottom;
  const assetSublabel = ({
    real_estate_operating: 'Operating Real Estate',
    real_estate_development: 'Development Real Estate',
    investment_fund: 'Fund Portfolio',
    operating_business: 'Operating Business',
    mixed: 'Mixed Asset'
  })[state.asset_type] || 'Asset';

  if (propertiesCount === 1) {
    // Legacy single-property path — unchanged
    const propertyId = 'property_asset';
    nodes.push({
      id: propertyId,
      type: 'property',
      layer: 'property',
      label: 'Underlying Property',
      sublabel: assetSublabel,
      pct: '',
      meta: { asset_type: state.asset_type, asset_location: state.asset_location_state }
    });
    edges.push({
      id: 'edge_' + terminalOwner + '_to_' + propertyId,
      from: terminalOwner,
      to: propertyId,
      kind: 'property_interest',
      label: ''
    });
  } else {
    // v13.6 — Multi-property: render N property nodes as siblings below terminalOwner
    for (let pIdx = 0; pIdx < propertiesCount; pIdx++) {
      const propertyId = 'property_asset_' + (pIdx + 1);
      nodes.push({
        id: propertyId,
        type: 'property',
        layer: 'property',
        label: 'Property ' + (pIdx + 1),
        sublabel: assetSublabel,
        pct: '',
        meta: { asset_type: state.asset_type, asset_location: state.asset_location_state, property_index: pIdx + 1 }
      });
      edges.push({
        id: 'edge_' + terminalOwner + '_to_' + propertyId,
        from: terminalOwner,
        to: propertyId,
        kind: 'property_interest',
        label: ''
      });
    }
  }

  return { nodes: nodes, edges: edges };
}

// =============================================================================
// THREAD 3 — AUTO-LAYOUT
// =============================================================================
// Deterministic hierarchical layout: assigns (x, y) positions to nodes based
// on layer order and per-layer node count. Same input graph → identical
// positions, which is required for print-grade SVG output and for smoke
// testing.
// =============================================================================
function autoLayout(graph) {
  const positions = {};
  const W = DIAGRAM_LAYOUT.canvasWidth;
  const layerHeight = DIAGRAM_LAYOUT.layerHeight;
  const topMargin = DIAGRAM_LAYOUT.layerTopMargin;
  const MAX_PER_ROW = 6;        // beyond this, split into multiple rows within the layer
  const ROW_SPACING = 80;       // vertical spacing between rows within a single layer

  // Group nodes by layer
  const layerGroups = {};
  DIAGRAM_LAYOUT.layerOrder.forEach(function (l) { layerGroups[l] = []; });
  graph.nodes.forEach(function (n) {
    if (!layerGroups[n.layer]) layerGroups[n.layer] = [];
    layerGroups[n.layer].push(n);
  });

  // Determine which layers are populated
  const populatedLayers = DIAGRAM_LAYOUT.layerOrder.filter(function (l) {
    return layerGroups[l] && layerGroups[l].length > 0;
  });

  // Lay out each populated layer top-to-bottom; layers with >MAX_PER_ROW nodes split
  // into multiple rows, and subsequent layers shift down by the row overflow.
  // v13.1 — Sponsor-layer nodes are LEFT-biased (positioned in the left ~40% of the canvas)
  // rather than centered, distinguishing the sponsor cluster from the central investor flow.
  let currentY = topMargin;
  populatedLayers.forEach(function (layerKey) {
    const layerNodes = layerGroups[layerKey];
    const count = layerNodes.length;
    const rowCount = Math.max(1, Math.ceil(count / MAX_PER_ROW));
    const nodesPerRow = Math.ceil(count / rowCount);
    const isSponsorLayer = layerKey === 'sponsor';
    layerNodes.forEach(function (node, idx) {
      const rowIdx = Math.floor(idx / nodesPerRow);
      const colIdx = idx % nodesPerRow;
      // Last row may have fewer nodes than nodesPerRow; center it accordingly
      const lastRowSize = count - (rowCount - 1) * nodesPerRow;
      const rowSize = (rowIdx === rowCount - 1) ? lastRowSize : nodesPerRow;
      const spec = NODE_TYPES[node.type] || { width: 120, height: 56 };
      const nodeWidth = spec.width || 120;
      let x;
      if (isSponsorLayer) {
        // Left-bias: pack sponsor nodes into the LEFT 40% of the canvas, anchored to ~5% from the left edge.
        // For multiple nodes in the row, spread them within the left 40% region.
        const sponsorRegionLeft = W * 0.04;
        const sponsorRegionWidth = W * 0.36;
        x = sponsorRegionLeft + ((colIdx + 1) * sponsorRegionWidth) / (rowSize + 1) - (nodeWidth / 2);
      } else {
        x = ((colIdx + 1) * W) / (rowSize + 1) - (nodeWidth / 2);
      }
      const y = currentY + (rowIdx * ROW_SPACING);
      positions[node.id] = { x: Math.round(x), y: Math.round(y) };
    });
    // Advance Y by the row span used + the inter-layer gap
    const layerSpan = rowCount * ROW_SPACING;
    const interLayerGap = layerHeight - ROW_SPACING; // 30px at default values
    currentY += layerSpan + interLayerGap;
  });

  return positions;
}

// =============================================================================
// THREAD 3 — SVG RENDERER
// =============================================================================
// Two modes: 'interactive' (in the wizard panel, drag-enabled scaffolding)
// and 'print' (static for memo embedding). Same renderer module; mode flag
// changes what data-* attributes and CSS classes are emitted.
// =============================================================================
// =============================================================================
// SVG RENDERER — v12.0 composable shapes + orthogonal routing + auto legend
// =============================================================================

// Render a single shape primitive at (0,0) relative to a group. Returns SVG string.
// border = 'solid' | 'dotted'; dimensions w × h; styling via fill/stroke.
function renderShapePrimitive(shape, border, w, h, fill, stroke, strokeWidth) {
  const dashAttr = border === 'dotted' ? ' stroke-dasharray="4 3"' : '';
  const sw = strokeWidth != null ? strokeWidth : 1.5;
  if (shape === 'circle') {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 2;
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"' + dashAttr + '/>';
  }
  if (shape === 'square') {
    return '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"' + dashAttr + '/>';
  }
  if (shape === 'rounded_rect') {
    return '<rect x="0" y="0" width="' + w + '" height="' + h + '" rx="10" ry="10" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"' + dashAttr + '/>';
  }
  if (shape === 'triangle') {
    // v13.1 — Apex-up triangle (point at top, flat base at bottom).
    // Path: top vertex → bottom-right corner → bottom-left corner.
    const path = 'M ' + (w / 2) + ' 0 L ' + w + ' ' + h + ' L 0 ' + h + ' Z';
    return '<path d="' + path + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"' + dashAttr + ' stroke-linejoin="round"/>';
  }
  if (shape === 'hexagon') {
    const path = 'M 14 0 L ' + (w - 14) + ' 0 L ' + w + ' ' + (h / 2) + ' L ' + (w - 14) + ' ' + h + ' L 14 ' + h + ' L 0 ' + (h / 2) + ' Z';
    return '<path d="' + path + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"' + dashAttr + ' stroke-linejoin="round"/>';
  }
  if (shape === 'parallelogram') {
    const skew = 12;
    const path = 'M ' + skew + ' 0 L ' + w + ' 0 L ' + (w - skew) + ' ' + h + ' L 0 ' + h + ' Z';
    return '<path d="' + path + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"' + dashAttr + ' stroke-linejoin="round"/>';
  }
  if (shape === 'rect_chamfered') {
    const c = 8;
    const path = 'M ' + c + ' 0 L ' + (w - c) + ' 0 L ' + w + ' ' + c + ' L ' + w + ' ' + (h - c) + ' L ' + (w - c) + ' ' + h + ' L ' + c + ' ' + h + ' L 0 ' + (h - c) + ' L 0 ' + c + ' Z';
    return '<path d="' + path + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"' + dashAttr + ' stroke-linejoin="round"/>';
  }
  // Unknown shape — fall back to rect
  return '<rect x="0" y="0" width="' + w + '" height="' + h + '" fill="' + fill + '" stroke="' + stroke + '" stroke-width="' + sw + '"' + dashAttr + '/>';
}

// Compute the connection point on a shape's bottom edge (for outgoing edges
// from this node) at the node's local coordinate frame, given the shape type
// and dimensions. Returns { x, y }.
function shapeBottomConnector(shape, w, h) {
  if (shape === 'circle') return { x: w / 2, y: h - 1 };
  if (shape === 'triangle') return { x: w / 2, y: h };        // bottom vertex
  if (shape === 'parallelogram') return { x: w / 2 - 6, y: h }; // accounts for skew
  if (shape === 'hexagon') return { x: w / 2, y: h };
  // square, rounded_rect, rect_chamfered: middle of bottom edge
  return { x: w / 2, y: h };
}

// Top connector (for incoming edges).
function shapeTopConnector(shape, w, h) {
  if (shape === 'circle') return { x: w / 2, y: 1 };
  if (shape === 'triangle') return { x: w / 2, y: 0 };
  if (shape === 'parallelogram') return { x: w / 2 + 6, y: 0 };
  if (shape === 'hexagon') return { x: w / 2, y: 0 };
  return { x: w / 2, y: 0 };
}

// Orthogonal (3-segment) edge path from source-bottom to target-top.
// Returns an SVG path "d" attribute string.
function orthogonalPath(fromX, fromY, toX, toY) {
  // v13.5 backward-compatible signature — uses naive 3-segment routing.
  // Use orthogonalPathWithObstacles for obstacle-aware routing.
  if (Math.abs(fromX - toX) < 2) {
    return 'M ' + fromX + ' ' + fromY + ' L ' + toX + ' ' + toY;
  }
  const midY = fromY + (toY - fromY) / 2;
  return 'M ' + fromX + ' ' + fromY
    + ' L ' + fromX + ' ' + midY
    + ' L ' + toX + ' ' + midY
    + ' L ' + toX + ' ' + toY;
}

// =============================================================================
// v13.5 — Obstacle-aware orthogonal routing
// =============================================================================
// Detects when the horizontal mid-segment of a 3-segment path crosses through
// other node bounding boxes (obstacles). If so, lifts the mid-segment to route
// AROUND the obstacles either above or below the natural midpoint.
//
// Used in renderSVG when obstacle list is available (typically all nodes
// except source and target of the current edge).
// =============================================================================
function orthogonalPathWithObstacles(fromX, fromY, toX, toY, obstacles, channelOffset) {
  // Vertically aligned — no horizontal segment to clear.
  if (Math.abs(fromX - toX) < 2) {
    return 'M ' + fromX + ' ' + fromY + ' L ' + toX + ' ' + toY;
  }

  const baseMidY = fromY + (toY - fromY) / 2;
  const channel = channelOffset || 0;
  let midY = baseMidY + channel;

  // Compute horizontal extent of the mid-segment
  const segLeft = Math.min(fromX, toX);
  const segRight = Math.max(fromX, toX);
  const PADDING = 8; // clearance margin around obstacles

  // Function: does the horizontal segment at y=midY cross any obstacle?
  function segmentIntersectsObstacles(y) {
    if (!obstacles || obstacles.length === 0) return null;
    for (let i = 0; i < obstacles.length; i++) {
      const o = obstacles[i];
      const oxL = o.x - PADDING;
      const oxR = o.x + o.w + PADDING;
      const oyT = o.y - PADDING;
      const oyB = o.y + o.h + PADDING;
      // Mid-segment runs horizontally at y=midY from segLeft to segRight
      if (y >= oyT && y <= oyB && segLeft <= oxR && segRight >= oxL) {
        return o;
      }
    }
    return null;
  }

  // If midY clears all obstacles, use it.
  if (!segmentIntersectsObstacles(midY)) {
    return 'M ' + fromX + ' ' + fromY
      + ' L ' + fromX + ' ' + midY
      + ' L ' + toX + ' ' + midY
      + ' L ' + toX + ' ' + toY;
  }

  // Otherwise — try lifting the mid-segment ABOVE all obstacles in the horizontal extent,
  // then BELOW. Pick whichever requires the smaller deviation from baseMidY.
  let maxObstacleBottom = -Infinity;
  let minObstacleTop = Infinity;
  if (obstacles && obstacles.length > 0) {
    obstacles.forEach(function (o) {
      const oxL = o.x - PADDING;
      const oxR = o.x + o.w + PADDING;
      if (segLeft <= oxR && segRight >= oxL) {
        maxObstacleBottom = Math.max(maxObstacleBottom, o.y + o.h + PADDING);
        minObstacleTop = Math.min(minObstacleTop, o.y - PADDING);
      }
    });
  }

  // Candidate 1: route above (midY = minObstacleTop - 2)
  const tryAboveY = minObstacleTop - 2;
  // Candidate 2: route below (midY = maxObstacleBottom + 2)
  const tryBelowY = maxObstacleBottom + 2;

  // But the mid-segment Y still has to lie between fromY and toY for the L-shape to make sense.
  // If the chart has source above target (fromY < toY, normal case), midY should be in [fromY+1, toY-1].
  // Routing "above" means midY < baseMidY (closer to source); "below" means midY > baseMidY (closer to target).
  // Both are legal as long as midY is strictly between fromY and toY.
  const yMin = Math.min(fromY, toY) + 1;
  const yMax = Math.max(fromY, toY) - 1;

  const aboveValid = tryAboveY >= yMin && tryAboveY <= yMax && !segmentIntersectsObstacles(tryAboveY);
  const belowValid = tryBelowY >= yMin && tryBelowY <= yMax && !segmentIntersectsObstacles(tryBelowY);

  if (aboveValid && belowValid) {
    // Pick smaller deviation from baseMidY
    midY = Math.abs(tryAboveY - baseMidY) <= Math.abs(tryBelowY - baseMidY) ? tryAboveY : tryBelowY;
  } else if (aboveValid) {
    midY = tryAboveY;
  } else if (belowValid) {
    midY = tryBelowY;
  } else {
    // Both blocked — fall back to baseMidY (best effort; will visibly cross an obstacle).
    midY = baseMidY;
  }

  return 'M ' + fromX + ' ' + fromY
    + ' L ' + fromX + ' ' + midY
    + ' L ' + toX + ' ' + midY
    + ' L ' + toX + ' ' + toY;
}

function renderSVG(graph, positions, mode, chartTitle) {
  mode = mode || 'print';
  // v13.1 — Optional chartTitle renders above the chart (used to label the
  // structural archetype when rendering a preset; e.g. "Structural Archetype: Domestic-Only Fund").
  const titleHeight = chartTitle ? 32 : 0;
  // Compute viewBox dimensions to fit actual content.
  let W = DIAGRAM_LAYOUT.canvasWidth;
  let H = DIAGRAM_LAYOUT.canvasHeight;
  graph.nodes.forEach(function (n) {
    const pos = positions[n.id] || { x: 0, y: 0 };
    const spec = NODE_TYPES[n.type] || { width: 120, height: 70 };
    const rightEdge = pos.x + (spec.width || 120) + 10;
    const bottomEdge = pos.y + (spec.height || 70) + 30;
    if (rightEdge > W) W = rightEdge;
    if (bottomEdge > H) H = bottomEdge;
  });

  // Compute legend dimensions (added below the chart)
  const legend = buildLegendData(graph);
  const legendHeight = legend.entryCount > 0 ? (60 + Math.ceil(legend.entryCount / 2) * 22) : 0;
  const totalH = H + legendHeight + titleHeight;

  let svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + totalH
    + '" class="struct-diagram-svg' + (mode === 'interactive' ? ' struct-diagram-svg-interactive' : ' struct-diagram-svg-print')
    + '" data-mode="' + esc(mode) + '">';

  // Defs — arrowheads for edge kinds that need them
  svg += '<defs>'
    + '<marker id="arrow-open" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
    +   '<path d="M 0 0 L 10 5 L 0 10" fill="none" stroke="#169B62" stroke-width="1.5"/>'
    + '</marker>'
    + '<marker id="arrow-closed" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">'
    +   '<path d="M 0 0 L 10 5 L 0 10 z" fill="#7a1a1a" stroke="#7a1a1a"/>'
    + '</marker>'
    + '</defs>';

  // v13.1 — Chart title (e.g. "Structural Archetype: Domestic-Only Fund") rendered at the top.
  if (chartTitle) {
    svg += '<text x="' + (W / 2) + '" y="22" font-family="Georgia, serif" font-size="14" font-weight="bold" fill="#0A4A2A" text-anchor="middle">'
        + esc(chartTitle) + '</text>';
  }

  // Open the chart content group — shifted down by titleHeight if a title is present.
  // This affects all background, grid, edges, and nodes; legend is rendered outside this group.
  svg += '<g class="struct-diagram-chart-content" transform="translate(0,' + titleHeight + ')">';

  // Background (and grid in interactive mode)
  if (mode === 'interactive') {
    svg += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fdfdfa" stroke="none"/>';
    for (let gx = 0; gx <= W; gx += DIAGRAM_LAYOUT.snapGrid * 4) {
      svg += '<line x1="' + gx + '" y1="0" x2="' + gx + '" y2="' + H + '" stroke="#e8e8e0" stroke-width="0.5"/>';
    }
    for (let gy = 0; gy <= H; gy += DIAGRAM_LAYOUT.snapGrid * 4) {
      svg += '<line x1="0" y1="' + gy + '" x2="' + W + '" y2="' + gy + '" stroke="#e8e8e0" stroke-width="0.5"/>';
    }
  } else {
    svg += '<rect x="0" y="0" width="' + W + '" height="' + H + '" fill="#fdfdfa" stroke="#d8d8d0" stroke-width="0.5"/>';
  }

  // v13.5 — Precompute node bounding boxes for obstacle-aware routing.
  // Each obstacle = {id, x, y, w, h}. When routing edge from A to B, the
  // obstacle list excludes A and B (we don't treat source/target as obstacles).
  const nodeBoxes = {};
  graph.nodes.forEach(function (n) {
    const pos = positions[n.id] || { x: 0, y: 0 };
    const spec = NODE_TYPES[n.type] || { width: 120, height: 70 };
    nodeBoxes[n.id] = {
      id: n.id,
      x: pos.x,
      y: pos.y,
      w: spec.width || 120,
      h: spec.height || 70
    };
  });

  // Edges (orthogonal/Manhattan routing — first so nodes paint on top)
  graph.edges.forEach(function (edge) {
    const fromNode = graph.nodes.filter(function (n) { return n.id === edge.from; })[0];
    const toNode = graph.nodes.filter(function (n) { return n.id === edge.to; })[0];
    if (!fromNode || !toNode) return;
    const fromPos = positions[fromNode.id] || { x: 0, y: 0 };
    const toPos = positions[toNode.id] || { x: 0, y: 0 };
    const fromSpec = NODE_TYPES[fromNode.type] || { width: 120, height: 70, primary: { shape: 'square' } };
    const toSpec = NODE_TYPES[toNode.type] || { width: 120, height: 70, primary: { shape: 'square' } };
    const fromConn = shapeBottomConnector(fromSpec.primary ? fromSpec.primary.shape : 'square', fromSpec.width, fromSpec.height);
    const toConn = shapeTopConnector(toSpec.primary ? toSpec.primary.shape : 'square', toSpec.width, toSpec.height);
    const fromX = fromPos.x + fromConn.x;
    const fromY = fromPos.y + fromConn.y;
    const toX = toPos.x + toConn.x;
    const toY = toPos.y + toConn.y;

    const edgeSpec = EDGE_KINDS[edge.kind] || EDGE_KINDS.ownership;
    let markerAttr = '';
    if (edgeSpec.arrow === 'open') markerAttr = ' marker-end="url(#arrow-open)"';
    else if (edgeSpec.arrow === 'closed') markerAttr = ' marker-end="url(#arrow-closed)"';
    const dashAttr = edgeSpec.dasharray ? ' stroke-dasharray="' + edgeSpec.dasharray + '"' : '';

    // v13.5 — Build obstacle list excluding source and target of this edge
    const obstacles = [];
    Object.keys(nodeBoxes).forEach(function (id) {
      if (id !== edge.from && id !== edge.to) obstacles.push(nodeBoxes[id]);
    });

    const d = orthogonalPathWithObstacles(fromX, fromY, toX, toY, obstacles, 0);
    svg += '<path d="' + d + '" fill="none" stroke="' + edgeSpec.stroke + '" stroke-width="' + edgeSpec.strokeWidth + '"' + dashAttr + markerAttr
      + ' data-edge-id="' + esc(edge.id) + '" class="struct-diagram-edge struct-diagram-edge-' + esc(edge.kind) + '"/>';

    // Edge label (placed at horizontal midpoint of the cross-segment)
    if (edge.label) {
      const midX = (fromX + toX) / 2;
      const midY = fromY + (toY - fromY) / 2;
      svg += '<text x="' + midX + '" y="' + (midY - 3) + '" font-family="Georgia, serif" font-size="10" fill="#1a1a1a" text-anchor="middle">' + esc(edge.label) + '</text>';
    }
  });

  // Nodes
  graph.nodes.forEach(function (node) {
    const spec = NODE_TYPES[node.type] || NODE_TYPES.llc;
    const pos = positions[node.id] || { x: 0, y: 0 };
    const W2 = spec.width || 120;
    const H2 = spec.height || 70;
    const interactiveAttrs = mode === 'interactive'
      ? ' data-node-id="' + esc(node.id) + '" data-node-type="' + esc(node.type) + '" class="struct-diagram-node struct-diagram-node-' + esc(node.type) + '" style="cursor:move"'
      : ' class="struct-diagram-node struct-diagram-node-print struct-diagram-node-' + esc(node.type) + '"';
    svg += '<g transform="translate(' + pos.x + ',' + pos.y + ')"' + interactiveAttrs + '>';

    // Primary shape
    const primary = spec.primary || { shape: 'square', border: 'solid' };
    svg += renderShapePrimitive(primary.shape, primary.border, W2, H2, spec.fill, spec.stroke, 1.5);

    // Inner shape (nested ~50% of outer, centered)
    if (spec.inner) {
      const inner = spec.inner;
      const innerScale = 0.45;
      const iw = Math.round(W2 * innerScale);
      const ih = Math.round(H2 * innerScale);
      const ix = (W2 - iw) / 2;
      const iy = (H2 - ih) / 2;
      // Inner sits at offset (ix, iy) inside the outer; emit as nested transform group
      svg += '<g transform="translate(' + ix + ',' + iy + ')">'
        + renderShapePrimitive(inner.shape, inner.border, iw, ih, '#ffffff', spec.stroke, 1.0)
        + '</g>';
    }

    // Badge (top-right) — composes with regime/sub-type marker if node.meta carries one
    let badge = spec.badge || '';
    if (node.type === 'qozb_qozf' && node.meta && node.meta.regime) {
      badge = node.meta.regime === 'oz_2_0' ? 'OZ 2.0' : 'OZ 1.0';
    }
    if (badge) {
      svg += '<rect x="' + (W2 - badge.length * 5.5 - 8) + '" y="2" width="' + (badge.length * 5.5 + 6) + '" height="11" fill="rgba(255,255,255,0.7)" stroke="none"/>';
      svg += '<text x="' + (W2 - 4) + '" y="11" font-family="Georgia, serif" font-size="8" font-weight="bold" fill="' + spec.textColor + '" text-anchor="end">' + esc(badge) + '</text>';
    }

    // Label (centered)
    // v13.1 — Apex-up triangles: label positions LOWER (in the wide base region) since the top is a point.
    const isTriangle = primary.shape === 'triangle';
    const labelY = isTriangle ? H2 / 2 + 8 : H2 / 2 - 2;
    svg += '<text x="' + (W2 / 2) + '" y="' + labelY + '" font-family="Georgia, serif" font-size="11" font-weight="bold" fill="' + spec.textColor + '" text-anchor="middle">' + esc(truncateLabel(node.label, 18)) + '</text>';
    if (node.sublabel) {
      const subY = isTriangle ? labelY + 12 : labelY + 14;
      svg += '<text x="' + (W2 / 2) + '" y="' + subY + '" font-family="Georgia, serif" font-size="9" fill="' + spec.textColor + '" text-anchor="middle">' + esc(truncateLabel(node.sublabel, 24)) + '</text>';
    }
    if (node.pct) {
      svg += '<text x="' + (W2 / 2) + '" y="' + (H2 + 12) + '" font-family="Georgia, serif" font-size="9" fill="#1a1a1a" text-anchor="middle">' + esc(node.pct) + '%</text>';
    }

    svg += '</g>';
  });

  // Close the v13.1 chart content group (shifted down by titleHeight if title present)
  svg += '</g>';

  // Legend (rendered below the chart area, OUTSIDE the chart content transform group
  // so legend sits at the absolute bottom of the SVG regardless of title presence)
  if (legend.entryCount > 0) {
    svg += renderLegendSVG(legend, 8, H + titleHeight + 10, W - 16);
  }

  svg += '</svg>';
  return svg;
}

// Build legend data from the nodes and edges actually in the graph.
// Returns { nodeTypes: [{type, spec}], edgeKinds: [{kind, spec}], entryCount }
function buildLegendData(graph) {
  const nodeTypesSeen = {};
  const edgeKindsSeen = {};
  graph.nodes.forEach(function (n) { nodeTypesSeen[n.type] = true; });
  graph.edges.forEach(function (e) { edgeKindsSeen[e.kind] = true; });
  const nodeTypes = Object.keys(nodeTypesSeen)
    .filter(function (t) { return !!NODE_TYPES[t]; })
    .map(function (t) { return { type: t, spec: NODE_TYPES[t] }; });
  const edgeKinds = Object.keys(edgeKindsSeen)
    .filter(function (k) { return !!EDGE_KINDS[k]; })
    .map(function (k) { return { kind: k, spec: EDGE_KINDS[k] }; });
  return {
    nodeTypes: nodeTypes,
    edgeKinds: edgeKinds,
    entryCount: nodeTypes.length + edgeKinds.length
  };
}

// Render the auto-generated legend as SVG, placed at (x, y) with given width.
function renderLegendSVG(legend, x, y, width) {
  let svg = '<g class="struct-diagram-legend" transform="translate(' + x + ',' + y + ')">';
  // Title strip
  svg += '<rect x="0" y="0" width="' + width + '" height="22" fill="#f5f5f0" stroke="#d8d8d0" stroke-width="0.5"/>';
  svg += '<text x="8" y="15" font-family="Georgia, serif" font-size="11" font-weight="bold" fill="#0A4A2A">Legend</text>';

  const entries = legend.nodeTypes.concat(legend.edgeKinds.map(function (e) {
    return { type: '__edge__', kind: e.kind, spec: e.spec, isEdge: true };
  }));
  const colWidth = (width - 16) / 2;
  entries.forEach(function (entry, idx) {
    const col = idx % 2;
    const row = Math.floor(idx / 2);
    const ex = 8 + col * colWidth;
    const ey = 30 + row * 22;
    // Swatch (16 × 12)
    const swX = ex;
    const swY = ey;
    if (entry.isEdge) {
      // Edge swatch: short stroke of the edge kind
      const spec = entry.spec;
      const dashAttr = spec.dasharray ? ' stroke-dasharray="' + spec.dasharray + '"' : '';
      let markerAttr = '';
      if (spec.arrow === 'open') markerAttr = ' marker-end="url(#arrow-open)"';
      else if (spec.arrow === 'closed') markerAttr = ' marker-end="url(#arrow-closed)"';
      svg += '<line x1="' + swX + '" y1="' + (swY + 6) + '" x2="' + (swX + 18) + '" y2="' + (swY + 6) + '" stroke="' + spec.stroke + '" stroke-width="' + spec.strokeWidth + '"' + dashAttr + markerAttr + '/>';
    } else {
      // Node-type swatch: miniature of the primary shape
      const spec = entry.spec;
      const primary = spec.primary || { shape: 'square', border: 'solid' };
      svg += '<g transform="translate(' + swX + ',' + swY + ')">'
        + renderShapePrimitive(primary.shape, primary.border, 18, 12, spec.fill, spec.stroke, 1.0)
        + '</g>';
    }
    // Label text
    const labelX = swX + 24;
    const labelY = swY + 9;
    const labelText = entry.isEdge ? entry.spec.label : (entry.spec.legendDescription || entry.spec.label);
    svg += '<text x="' + labelX + '" y="' + labelY + '" font-family="Georgia, serif" font-size="9" fill="#1a1a1a">' + esc(truncateLabel(labelText, 60)) + '</text>';
  });
  svg += '</g>';
  return svg;
}

function truncateLabel(s, maxLen) {
  if (!s) return '';
  s = String(s);
  if (s.length <= maxLen) return s;
  return s.slice(0, maxLen - 1) + '…';
}

// Convenience wrappers
function renderInteractiveSVG(graph, positions, chartTitle) {
  return renderSVG(graph, positions, 'interactive', chartTitle);
}

function renderPrintSVG(graph, positions, chartTitle) {
  return renderSVG(graph, positions, 'print', chartTitle);
}

// v13.1 — Compose the chart title from state. Returns null when no preset is active
// (e.g. when the user has hand-configured state from defaultState rather than applyPreset).
function composeChartTitle(state) {
  if (!state || !state.active_preset_key) return null;
  const p = STRUCT_PRESETS[state.active_preset_key];
  if (!p) return null;
  return 'Structural Archetype: ' + p.label;
}

// Apply snap-to-grid (used by the drag handler)
function snapToGrid(value, grid) {
  grid = grid || DIAGRAM_LAYOUT.snapGrid;
  return Math.round(value / grid) * grid;
}

// =============================================================================
// THREAD 3 — DOWNSTREAM HANDOFF PAYLOAD
// =============================================================================
// Builds the JSON payload deposited into localStorage at key
// donovan_legal_structuring_outcome_v1 for consumption by the downstream
// document-assembly tool (Single-Member, Multi-Eight, or RESERVE 12-Step).
// Same payload is exposed via the "Export Payload (JSON)" button for
// cross-environment handoff.
// =============================================================================
function buildDownstreamPayload(state, analysis) {
  const ec = analysis.entityClassification;
  const rpd = analysis.rpd;
  const mgf = analysis.mgmtFee;
  const mzz = analysis.mezz;
  const qz = analysis.qoz;

  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_tool: 'structuring',
    source_tool_version: 'v11',
    project: {
      name: state.project_name || '',
      matter_no: state.matter_no || '',
      effective_date: state.effective_date || todayISO()
    },
    jurisdiction: state.jurisdiction,
    asset: {
      type: state.asset_type,
      location_state: state.asset_location_state || '',
      deal_size: state.deal_size || ''
    },
    entity: {
      proposed_type: state.proposed_entity_type,
      proposed_country: state.proposed_entity_country || '',
      member_count: state.proposed_member_count,
      ctb_election: state.ctb_election,
      ctb_timing: state.ctb_timing,
      treaty_country: state.treaty_country || '',
      treaty_lob_test: state.treaty_lob_test,
      hybrid_concerns: !!state.hybrid_concerns,
      section_708_b2: state.section_708_b2_applicable
    },
    investors: (state.investors || []).map(function (inv) {
      return {
        id: inv.id,
        label: inv.label,
        route: inv.route,
        country: inv.country || '',
        trust_sub: inv.trustSub || '',
        pct: inv.pct || ''
      };
    }),
    securitiesLevel: (function () {
      // Heuristic: domestic individuals only → level_1; foreign / tax-exempt → level_2; mixed → level_3
      const flags = (analysis.investorPanel && analysis.investorPanel.flags) || {};
      if (flags.firpta_in_play || flags.section_892_in_play || flags.qfpf_in_play) return 'level_3';
      if (flags.ubti_in_play) return 'level_2';
      return 'level_1';
    })(),
    debtStructure: rpd && rpd.present ? {
      present: true,
      lender_type: rpd.inputs.lender_type,
      principal: rpd.inputs.principal,
      rate: rpd.inputs.rate,
      maturity_years: rpd.inputs.maturity_years,
      recourse_treatment: rpd.inputs.recourse_treatment,
      section_163j_concerned: !!rpd.inputs.section_163j_concerned,
      rptb_election: !!rpd.inputs.rptb_election,
      ahydo_concern: !!rpd.inputs.ahydo_concern,
      anti_conduit_concern: !!rpd.inputs.anti_conduit_concern
    } : { present: false },
    mgmtFee: mgf && mgf.present ? {
      present: true,
      recipient_type: mgf.inputs.recipient_type,
      amount_basis: mgf.inputs.amount_basis,
      amount: mgf.inputs.amount,
      arm_length: !!mgf.inputs.arm_length,
      characterization_intended: mgf.inputs.characterization_intended,
      fee_waiver_present: !!mgf.inputs.fee_waiver_present,
      fee_waiver_risk_assessment: mgf.inputs.fee_waiver_risk_assessment,
      se_tax_concern: !!mgf.inputs.se_tax_concern,
      forum_jurisdiction: mgf.inputs.forum_jurisdiction
    } : { present: false },
    mezz: mzz && mzz.present ? {
      present: true,
      principal: mzz.inputs.principal,
      stated_rate: mzz.inputs.stated_rate,
      paid_in_kind: !!mzz.inputs.paid_in_kind,
      equity_kicker: !!mzz.inputs.equity_kicker,
      maturity_years: mzz.inputs.maturity_years,
      subordination: mzz.inputs.subordination,
      thirteen_factor_aggregate: mzz.aggregateScore || null,
      recommendation: mzz.recommendation || null
    } : { present: false },
    qoz: qz && qz.present ? {
      present: true,
      gain_realization_date: qz.inputs.gain_realization_date,
      gain_source: qz.inputs.gain_source,
      regime: qz.regime,
      designation_regime_input: qz.inputs.designation_regime,
      rural: !!qz.inputs.rural,
      qozb_below_qof: !!qz.inputs.qozb_below_qof,
      substantial_improvement_planned: !!qz.inputs.substantial_improvement_planned,
      holding_period_target: qz.inputs.holding_period_target,
      passthrough_180day_election: qz.inputs.passthrough_180day_election,
      flags: qz.flags
    } : { present: false },
    diagram: state.diagram && state.diagram.visited ? {
      visited: true,
      user_modified: !!state.diagram.user_modified,
      positions_count: Object.keys(state.diagram.positions || {}).length
    } : { visited: false },
    recommendedTool: ec.downstream,
    recommendedToolLabel: ec.downstreamLabel,
    rationale: ec.rationale
  };
}

// =============================================================================
// MEMORANDUM BUILDER
// =============================================================================
// Each section returns an HTML fragment. buildMemorandum assembles them.
// Thread 3 splices in Section V (Structure Diagram), renumbers VI–IX, and
// adds new Section X (QOZ).
// =============================================================================

function memoHeader(state) {
  const today = state.effective_date || todayISO();
  return ''
    + '<div class="memo-header">'
    +   '<div class="memo-firm">DONOVAN LEGAL PLLC</div>'
    +   '<div class="memo-firm-sub">301 W. Atlantic Avenue, Suite 5 &middot; Delray Beach, Florida 33444</div>'
    +   '<div class="memo-draft-badge">PRIVILEGED &amp; CONFIDENTIAL &middot; ATTORNEY WORK PRODUCT &middot; DRAFT</div>'
    +   '<h1 class="memo-title">Structuring Memorandum</h1>'
    +   '<div class="memo-project">' + esc(state.project_name || '[Project Name]') + '</div>'
    +   '<div class="memo-date">Date of memorandum: ' + esc(today) + '</div>'
    +   (state.matter_no ? '<div class="memo-matter">Matter No.: ' + esc(state.matter_no) + '</div>' : '')
    + '</div>';
}

function memoDisclaimer() {
  return ''
    + '<p class="memo-disclaimer"><strong>DRAFT NOTICE.</strong> '
    + 'This memorandum is a draft generated by an automated analytical tool and has not been reviewed or finalized by Donovan Legal PLLC. '
    + 'It is not legal advice. The conclusions herein are preliminary and depend on a complete review of the facts, the underlying transaction documents, '
    + 'and the financial and tax position of each party. Donovan Legal PLLC will review the draft against the specific facts of the engagement, '
    + 'finalize the analysis, and issue a final memorandum only upon issuance under a written engagement letter. '
    + 'Reading or using this draft does not create an attorney-client relationship.'
    + '</p>';
}

function memoExecutiveSummary(state, analysis) {
  const ec = analysis.entityClassification;
  const inv = ec.investorPanel;
  const investorCount = inv.count;

  let asset = ({
    real_estate_operating: 'operating real estate',
    real_estate_development: 'real estate development',
    investment_fund: 'investment fund',
    operating_business: 'operating business',
    mixed: 'mixed asset profile'
  })[state.asset_type] || 'the underlying asset';

  let entityDescription = '';
  if (state.proposed_entity_type === 'us_llc') {
    entityDescription = 'a U.S. limited liability company formed in ' + esc(stateInfo(state.jurisdiction).name);
  } else if (state.proposed_entity_type === 'foreign_eligible') {
    entityDescription = 'a foreign eligible entity formed in ' + esc(state.proposed_entity_country || '[country]');
  } else if (state.proposed_entity_type === 'foreign_per_se') {
    entityDescription = 'a per se foreign corporation formed in ' + esc(state.proposed_entity_country || '[country]') + ' (' + esc(getPerSeForm(state.proposed_entity_country) || 'corporate form') + ')';
  }

  return ''
    + '<section class="memo-section">'
    +   '<h2 class="memo-h2">I. Executive Summary</h2>'
    +   '<p>This memorandum analyzes the recommended structuring of <strong>' + esc(state.project_name || '[Project Name]') + '</strong> '
    +   'for the acquisition and holding of ' + asset + '. '
    +   'The proposed entity is ' + entityDescription + ', '
    +   'with ' + investorCount + ' ' + (investorCount === 1 ? 'investor' : 'investors') + ' across '
    +   Object.keys(inv.routeCounts).length + ' distinct identity ' + (Object.keys(inv.routeCounts).length === 1 ? 'category' : 'categories') + '.</p>'
    +   '<p>Based on the investor identity profile and the proposed entity classification, '
    +   'the recommended downstream document-assembly workflow is the <strong>' + esc(ec.downstreamLabel) + '</strong>. '
    +   '<em>' + esc(ec.rationale) + '</em></p>'
    +   (inv.flags.qfpf_blocker_conflict
       ? '<p class="memo-callout"><strong>QFPF / § 897(l) preservation.</strong> '
         + 'The investor panel includes a Qualified Foreign Pension Fund. The auto-derived structure correctly preserves the QFPF\'s interest on a parallel direct-ownership track that bypasses the U.S. blocker corporation, preserving the § 897(l) FIRPTA exemption that blocker interposition would otherwise destroy. '
         + 'Verification of QFPF qualification under Reg. § 1.897(l)-1 remains the principal diligence task; the structural conflict that would arise from blocker interposition is resolved at the diagram level.</p>'
       : '')
    + '</section>';
}

function memoInvestorIdentitySection(state, analysis) {
  const inv = analysis.entityClassification.investorPanel;
  if (!inv.items.length) {
    return ''
      + '<section class="memo-section">'
      +   '<h2 class="memo-h2">II. Investor Identity Analysis</h2>'
      +   '<p><em>No investors specified. The investor identity analysis cannot be completed without identifying the parties.</em></p>'
      + '</section>';
  }

  let html = ''
    + '<section class="memo-section">'
    +   '<h2 class="memo-h2">II. Investor Identity Analysis</h2>'
    +   '<p>The following table identifies each investor and the applicable analytical route. Each route is treated in turn below.</p>'
    +   '<table class="memo-table"><thead><tr>'
    +     '<th>Investor</th><th>Identity Route</th><th>Approx. %</th><th>Blocker Posture</th>'
    +   '</tr></thead><tbody>';

  inv.items.forEach(function (it) {
    let blockerStr = '';
    if (it.blocker.recommended === true) blockerStr = 'Recommended';
    else if (it.blocker.recommended === 'conditional') blockerStr = 'Conditional';
    else if (it.blocker.recommended === 'inherent') blockerStr = 'Inherent (investor is already corporate)';
    else blockerStr = 'None';

    html += '<tr>'
      + '<td>' + esc(it.label) + '</td>'
      + '<td>' + esc(it.routeLabel) + (it.subRouteLabel ? ' &mdash; ' + esc(it.subRouteLabel) : '') + (it.country ? ' (' + esc(it.country) + ')' : '') + '</td>'
      + '<td>' + (it.pct != null && it.pct !== '' ? esc(String(it.pct)) + '%' : '&mdash;') + '</td>'
      + '<td>' + esc(blockerStr) + '</td>'
      + '</tr>';
  });
  html += '</tbody></table>';

  // Per-route narrative
  const seenRoutes = {};
  inv.items.forEach(function (it) {
    if (seenRoutes[it.routeKey]) return;
    seenRoutes[it.routeKey] = true;
    const r = INVESTOR_ROUTES[it.routeKey];
    html += ''
      + '<h3 class="memo-h3">' + esc(r.label) + '</h3>'
      + '<p>' + esc(r.blurb) + '</p>';

    // Sub-route detail (trusts)
    if (it.subRouteLabel) {
      html += '<p><strong>' + esc(it.subRouteLabel) + '.</strong> ' + esc(it.subRouteSummary || '') + '</p>';
    }

    // Per-se confirmation
    if (it.routeKey === 'per_se_foreign_corp' && it.country) {
      if (it.perSe) {
        html += '<p><strong>Per se status confirmed.</strong> The corporate form indicated for ' + esc(it.country)
              + ' (' + esc(it.perSeForm || '') + ') is enumerated in the per se foreign corporation list under Treas. Reg. § 301.7701-2(b)(8). '
              + 'Check-the-box election is unavailable; the entity is classified as a corporation for U.S. federal tax purposes as a matter of regulation.</p>';
      } else {
        html += '<p><strong>Per se status not confirmed.</strong> The jurisdiction ' + esc(it.country)
              + ' is not in the abbreviated per se list maintained by this tool. Counsel should consult the current text of Reg. § 301.7701-2(b)(8) '
              + 'for the complete and authoritative list before issuing the final memorandum.</p>';
      }
    }

    // Blocker rationale
    html += '<p><strong>Blocker analysis.</strong> ' + esc(r.blocker.rationale) + '</p>';

    // Key cites
    html += '<p class="memo-cites"><em>Key authorities: ' + r.keyCites.map(esc).join('; ') + '.</em></p>';
  });

  return html + '</section>';
}

function memoCTBSection(state, analysis) {
  const c = analysis.ctb;

  let html = '<section class="memo-section">'
    + '<h2 class="memo-h2">III. Entity Classification &amp; Check-the-Box Analysis</h2>';

  // Default classification
  if (c.defaultClassification) {
    html += '<h3 class="memo-h3">A. Default Classification</h3>'
      + '<p>Under Treas. Reg. § 301.7701-3, the proposed entity defaults to classification as '
      + '<strong>' + esc(c.defaultClassification.classification) + '</strong>. '
      + esc(c.defaultClassification.note) + '</p>';
  }

  // Election recommendation
  if (c.electionRecommended) {
    html += '<h3 class="memo-h3">B. Election Recommendation</h3>'
      + '<p>' + esc(c.electionRecommended) + '</p>';
    if (c.electionAvailable && state.ctb_election !== 'default') {
      html += '<p><strong>Election mechanics.</strong> ' + esc(CTB_RULES.electionMechanics.form) + '. '
        + esc(CTB_RULES.electionMechanics.effectiveDate) + ' ' + esc(CTB_RULES.electionMechanics.fiveYearLimitation) + '</p>';
    }
  }

  // Per se flag
  if (c.perSeFlag) {
    html += '<p class="memo-flag"><strong>Per Se Status.</strong> '
      + 'The entity is per se corporate under Treas. Reg. § 301.7701-2(b)(8). No CTB election is available. '
      + 'Any U.S. tax planning must accept the corporate classification as fixed.</p>';
  }

  // Late relief
  if (c.lateReliefAnalysis) {
    html += '<h3 class="memo-h3">C. Late Election Relief Analysis</h3>'
      + '<p>Late relief is sought under <strong>' + esc(c.lateReliefAnalysis.revenueProcedure) + '</strong>. '
      + 'The relief window is ' + esc(c.lateReliefAnalysis.window) + '</p>'
      + '<p><strong>Requirements:</strong></p>'
      + ulFromArray(c.lateReliefAnalysis.requirements)
      + '<p><strong>Procedure:</strong> ' + esc(c.lateReliefAnalysis.procedure) + '</p>'
      + (c.lateReliefAnalysis.intendedEffective ? '<p><strong>Intended effective date:</strong> ' + esc(c.lateReliefAnalysis.intendedEffective) + '. Counsel must verify that the three-year-and-75-day window has not expired before filing.</p>' : '');
  }

  // Treaty / LOB
  if (c.treatyAnalysis) {
    html += '<h3 class="memo-h3">D. Treaty Eligibility and Limitation on Benefits</h3>'
      + '<p>The structure relies on U.S. tax treaty benefits with <strong>' + esc(c.treatyAnalysis.country) + '</strong>. '
      + esc(TREATY_LOB.description) + '</p>'
      + '<p><strong>Common LOB tests:</strong></p>'
      + ulFromArray(TREATY_LOB.commonLOBTests)
      + '<p><strong>Claimed test:</strong> '
      + esc(({
          'not_applicable': 'Not applicable (no treaty claim made)',
          'publicly_traded': 'Publicly Traded Test',
          'subsidiary_of_pt': 'Subsidiary of Publicly Traded',
          'ownership_base_erosion': 'Ownership and Base Erosion',
          'active_trade_business': 'Active Trade or Business',
          'derivative_benefits': 'Derivative Benefits',
          'competent_authority': 'Competent Authority (Discretionary)'
        }[c.treatyAnalysis.lobTestClaimed] || c.treatyAnalysis.lobTestClaimed))
      + '.</p>'
      + '<p><strong>CTB for treaty purposes.</strong> ' + esc(TREATY_LOB.ctbForTreatyPurposes) + '</p>'
      + '<p><em>Practice point.</em> ' + esc(TREATY_LOB.practicePoint) + '</p>';
  }

  // Hybrid
  if (c.hybridFlag) {
    html += '<h3 class="memo-h3">E. Hybrid and Dual-Resident Considerations</h3>'
      + '<p>The structure presents one or more hybrid-entity concerns. The following must be addressed in the final analysis:</p>'
      + ulFromArray(c.hybridConcerns);
  }

  // § 708(b)(2)
  if (c.divisionMergerFlag) {
    const m = c.divisionMergerMechanics;
    const label = c.divisionMergerFlag === 'division' ? 'Partnership Division' : 'Partnership Merger';
    html += '<h3 class="memo-h3">F. § 708(b)(2) ' + esc(label) + '</h3>'
      + '<p><strong>Authority.</strong> ' + esc(m.cite) + '</p>'
      + '<p><strong>Rule.</strong> ' + esc(m.rule) + '</p>'
      + '<p><strong>Continuation.</strong> ' + esc(m.continuationRule) + '</p>'
      + '<p><strong>Available forms:</strong> ' + m.forms.map(esc).join('; ') + '. ' + esc(m.practicePoint) + '</p>'
      + '<p><em>' + esc(SECTION_708.noTechnicalTermination) + '</em></p>'
      + (c.section708Notes ? '<p><strong>Engagement-specific notes.</strong> ' + esc(c.section708Notes) + '</p>' : '');
  }

  return html + '</section>';
}

function memoEntityClassificationRecommendation(state, analysis) {
  const ec = analysis.entityClassification;
  let html = ''
    + '<section class="memo-section">'
    +   '<h2 class="memo-h2">IV. Entity Classification &mdash; Recommendation and Downstream Workflow</h2>'
    +   '<p>Based on the investor identity profile and CTB analysis above, the recommended downstream document-assembly workflow is:</p>'
    +   '<div class="memo-recommendation"><strong>' + esc(ec.downstreamLabel) + '</strong></div>'
    +   '<p>' + esc(ec.rationale) + '</p>';

  // v13.4 — Surface DC-REIT or FC-REIT alternative when investor mix supports
  if (ec.altRecommendations && ec.altRecommendations.length > 0) {
    html += '<h3 class="memo-h3">Alternative Structural Recommendation</h3>'
      + '<p>The principal recommendation above is the LLC + blocker structure appropriate to the investor panel. '
      + 'On these facts, the following alternative structure also warrants consideration:</p>';
    ec.altRecommendations.forEach(function (alt) {
      const confidenceClass = alt.confidence === 'high' ? 'memo-callout' : 'memo-flag';
      html += '<div class="' + confidenceClass + '">'
        + '<strong>' + esc(alt.label) + '</strong> &mdash; ' + esc(alt.statutoryBasis) + '. '
        + esc(alt.rationale)
        + '</div>';
    });
  }

  html += '<p>A proposed organization chart depicting the recommended structure is set out at Section V below. '
      + 'The capital-structure characterization analysis follows at Sections VI&ndash;IX, and the Qualified Opportunity Zone '
      + 'analysis (if applicable) at Section X. The handoff payload to the recommended downstream tool is generated on '
      + 'memo finalization and is available either via the in-browser continuity link or as a JSON export for cross-environment transfer.</p>'
    + '</section>';

  return html;
}

// ----- v13.0 — Sponsor Structure + Multi-Tier Operating Structure (Section IV.B / IV.C) -----
function memoSectionSponsorTier(state, analysis) {
  const st = analysis.sponsorTier;
  if (!st) return '';
  const hasSponsor = st.sponsor.present;
  const hasTier = st.tier.structure !== 'flat';
  if (!hasSponsor && !hasTier) return '';

  let html = '';

  // ----- IV.B Sponsor Structure -----
  if (hasSponsor) {
    const mgmtFormLabel = st.sponsor.mgmt_co_form === 's_corp' ? 'S corporation' : (st.sponsor.mgmt_co_form === 'c_corp' ? 'C corporation' : 'LLC');
    const gpFormLabel = st.sponsor.gp_form === 'lp' ? 'limited partnership' : (st.sponsor.gp_form === 'c_corp' ? 'C corporation' : 'LLC');

    html += '<section class="memo-section">'
      + '<h2 class="memo-h2">IV.B Sponsor Structure</h2>'
      + '<p>The sponsor side of the deal is rendered as a distinct cluster above the investor layer in the proposed organization chart. '
      + 'The sponsor entities and their economic + governance relationships to the fund are summarized below.</p>';

    // Components present
    html += '<h3 class="memo-h3">Sponsor Components</h3>'
      + '<ul>';
    if (st.sponsor.has_family_office) {
      html += '<li><strong>Family Office Vehicle.</strong> A family-office or estate-planning vehicle '
        + '(e.g., GRAT, IDGT, family LP) sits above the sponsor principals, holding the principals\' interests in the '
        + 'management company, GP entity, and carry vehicle. This vehicle is the long-term owner of the sponsor side; '
        + 'estate-planning techniques (annual exclusion gifts, valuation discounts under §§ 2701-2704, grantor-trust '
        + 'income-tax-burn) operate at this layer.</li>';
    }
    html += '<li><strong>Sponsor Principal(s).</strong> The natural-person principal(s) of the sponsor. '
      + 'For § 1402(a)(13) self-employment-tax analysis and § 1061 carried-interest holding-period mechanics, the principals\' '
      + 'role and time commitment to the fund are the substantive facts that drive characterization.</li>';
    html += '<li><strong>GP Entity (' + esc(gpFormLabel) + ').</strong> '
      + 'Holds the GP interest in the fund &mdash; typically 1&ndash;5% capital + management authority. '
      + 'The GP entity is the named general partner under the partnership agreement and bears management responsibility. '
      + 'When the GP form is an LLC, the LLC manager (often the ManagementCo) acts on the GP\'s behalf under the operating agreement.</li>';
    if (st.sponsor.has_mgmt_co) {
      html += '<li><strong>ManagementCo (' + esc(mgmtFormLabel) + ').</strong> '
        + 'The platform-level management entity. ManagementCo is the party to the Investment Management Agreement (IMA) '
        + 'with the fund and receives the annual base management fee. ManagementCo form selection drives self-employment-tax '
        + 'planning: an S corporation election allows the principals to receive a reasonable salary subject to FICA and '
        + 'the balance as S-corp distribution (no SE tax), whereas an LLC defaults to partnership treatment with self-employment '
        + 'tax on principals\' distributive shares (subject to the § 1402(a)(13) limited-partner exception &mdash; '
        + 'currently in flux per <em>K Alain, L.L.L.P.</em> (formerly <em>Sirius Solutions</em>), No. 24-60240 (5th Cir. Aug. 12, 2026) (substitute opinion); '
        + '<em>Soroban II</em>, T.C. Memo. 2025-52).</li>';
    }
    if (st.sponsor.has_separate_carry) {
      html += '<li><strong>Carry Vehicle (§ 1061 API).</strong> '
        + 'A separate entity holding the API (applicable partnership interest) for § 1061 carried-interest purposes. '
        + 'Common in institutional sponsor structures for vertical-slice estate planning &mdash; the carry vehicle is itself '
        + 'a family LP whose interests are gifted into trusts (annual exclusion / GRAT / dynasty) at formation when valuation '
        + 'discounts are deepest. The carry vehicle holds the carry interest in the fund directly; subsequent distributions '
        + 'from the fund\'s carry waterfall flow to the carry vehicle, then to its members, who may include junior principals '
        + 'and family-trust beneficiaries.</li>';
    }
    html += '</ul>';

    // Economic + Governance Relationships
    html += '<h3 class="memo-h3">Economic and Governance Relationships</h3>'
      + '<p>The sponsor-to-fund relationships use the following organizational-chart vocabulary:</p>'
      + '<ul>'
      + '<li><strong>GP Equity (' + (st.sponsor.has_gp ? 'shown' : 'not shown') + ').</strong> '
      + 'The GP entity holds a GP interest in the fund &mdash; rendered in the diagram with a bold GP-equity line distinguishing it from LP equity. '
      + 'Economic terms (capital share, distribution waterfall participation, carry mechanics) are documented in the partnership agreement.</li>';
    if (st.sponsor.has_mgmt_co) {
      html += '<li><strong>Management Service Contract.</strong> The IMA between ManagementCo and the fund is rendered as a service-contract edge in the diagram. '
        + 'The annual base management fee (typically 1.5&ndash;2% of committed capital during the investment period, stepping down post-investment-period) '
        + 'flows from the fund to ManagementCo. Mgmt-fee characterization analysis is set out in Section VIII below.</li>';
    }
    if (st.sponsor.has_separate_carry) {
      html += '<li><strong>Carry Interest (API).</strong> The carry vehicle holds the API directly; the carry waterfall '
        + '(typically 20% above an 8% pref) flows to the carry vehicle when hurdles are met. '
        + 'Rendered with the v12.0 carry-interest edge style. '
        + '§ 1061 three-year holding requirement applies to API gains; the API is recognized as a separate property class for '
        + 'estate-planning valuation purposes.</li>';
    }
    html += '</ul>';

    html += '</section>';
  }

  // ----- IV.C Multi-Tier Operating Structure -----
  if (hasTier) {
    html += '<section class="memo-section">'
      + '<h2 class="memo-h2">IV.C Multi-Tier Operating Structure</h2>'
      + '<p>The proposed structure includes a multi-tier ownership chain between the fund (or REIT) and the underlying property. '
      + 'The tiers and their structural rationales are:</p>'
      + '<ul>';

    if (st.tier.has_holdco) {
      const rationaleMap = {
        financing_flex: 'Financing flexibility — multiple lender tranches at the HoldCo level, with the OpCo and PropCo below holding the operating assets and providing the lender\'s collateral package',
        reit_overlay: 'REIT overlay — the HoldCo is itself a REIT vehicle providing the § 856-859 tax-advantaged distribution treatment',
        bankruptcy_remote: 'Bankruptcy remoteness — the HoldCo isolates the operating entities from the sponsor-level credit exposure',
        tax_planning: 'Tax planning — the HoldCo layer enables debt-placement and § 752 nonrecourse-allocation planning'
      };
      html += '<li><strong>HoldCo.</strong> ' + esc(rationaleMap[st.tier.holdco_rationale] || rationaleMap.financing_flex) + '.</li>';
    }
    if (st.tier.has_midco) {
      html += '<li><strong>MidCo.</strong> Intermediate tier between HoldCo and OpCo. Common for placing intermediate-tier '
        + 'debt (mezzanine financing) at a different entity than senior debt &mdash; senior at PropCo (collateralized by '
        + 'the real property), mezzanine at MidCo (collateralized by pledge of OpCo equity), and unsecured / sponsor financing '
        + 'at HoldCo. The tier separation allows lenders to enforce against distinct collateral packages without cross-default.</li>';
    }
    if (st.tier.has_propco) {
      const propRationaleMap = {
        lender_spe: 'Lender single-purpose-entity (SPE) requirement — senior lenders mandate a bankruptcy-remote PropCo holding the property, with independent directors, separateness covenants, and no other liabilities',
        bankruptcy_remote: 'Bankruptcy remoteness — the PropCo isolates each property asset from claims against the broader operating group',
        per_asset_isolation: 'Per-asset isolation — multi-property portfolios use a PropCo per property to isolate cross-collateralization risk and facilitate asset-level dispositions'
      };
      html += '<li><strong>PropCo.</strong> ' + esc(propRationaleMap[st.tier.propco_rationale] || propRationaleMap.lender_spe) + '.</li>';
    }

    html += '</ul>';
    html += '<p>The depth of the tier chain (' + esc(String(st.tier.depth)) + ' tier' + (st.tier.depth === 1 ? '' : 's') + ' below the fund) reflects the structural-complexity '
      + 'tradeoff: deeper chains afford more financing and bankruptcy-remoteness flexibility but increase entity-level administrative cost, '
      + '§ 752 nonrecourse-allocation complexity, and consolidation-tax-return administration. The recommended depth should be '
      + 'calibrated against the actual lender requirements and the operating-business complexity, not pre-built as a one-size-fits-all template.</p>';
    html += '</section>';
  }

  return html;
}

// ----- Thread 3 Section V: Structure Diagram -----

function memoStructureDiagram(state, analysis) {
  const graph = analysis.graph;
  const positions = analysis.positions;
  const userModified = state.diagram && state.diagram.user_modified;
  const visited = state.diagram && state.diagram.visited;

  let html = '<section class="memo-section memo-section-diagram">'
    + '<h2 class="memo-h2">V. Proposed Structure &mdash; Visual Reference</h2>';

  if (!visited && !userModified) {
    html += '<p><em>The diagram below reflects the auto-derived structure based on the investor identity, entity classification, and capital-structure inputs above. The diagram was not opened in the wizard before memo generation; node positions are the deterministic auto-layout. To refine layout for inclusion in a client-facing deliverable, return to the Structure Diagram panel.</em></p>';
  } else if (userModified) {
    html += '<p><em>The diagram below reflects the structure as refined in the Structure Diagram panel. Node positions have been adjusted by the practitioner from the auto-layout default.</em></p>';
  } else {
    html += '<p><em>The diagram below reflects the auto-derived structure based on the inputs above. The Structure Diagram panel was opened but node positions were not refined.</em></p>';
  }

  // Insert the print SVG inline (v13.1: pass chart title when a preset is active)
  html += '<div class="memo-diagram-container">'
    + renderPrintSVG(graph, positions, composeChartTitle(state))
    + '</div>';

  // Caption — legend of node types present in this diagram
  const presentTypes = {};
  graph.nodes.forEach(function (n) { presentTypes[n.type] = true; });
  const legendItems = Object.keys(presentTypes).map(function (t) {
    return (NODE_TYPES[t] && NODE_TYPES[t].label) || t;
  });
  html += '<p class="memo-diagram-caption"><strong>Node types depicted:</strong> ' + esc(legendItems.join('; ')) + '. Solid lines denote ownership; dashed lines denote management or property interests; closed-arrow lines denote debt. Percentages on edges indicate ownership where specified.</p>';

  return html + '</section>';
}

// ----- Thread 2 sections, renumbered VI / VII / VIII / IX -----

function memoCapitalStructureIntro(state, analysis) {
  const rpd = analysis.rpd, mgf = analysis.mgmtFee, mzz = analysis.mezz, qz = analysis.qoz;
  const presentList = [];
  if (rpd.present) presentList.push('related-party debt');
  if (mgf.present) presentList.push('a management fee arrangement');
  if (mzz.present) presentList.push('mezzanine financing');
  if (qz.present) presentList.push('a Qualified Opportunity Zone investment');

  let intro;
  if (presentList.length === 0) {
    intro = 'On the present record, the capital structure includes none of the four characterization-sensitive elements addressed by this build. Sections VII, VIII, IX, and X below confirm the analysis was considered and noted as not applicable.';
  } else if (presentList.length === 1) {
    const onlySectionMap = {
      'related-party debt': 'VII',
      'a management fee arrangement': 'VIII',
      'mezzanine financing': 'IX',
      'a Qualified Opportunity Zone investment': 'X'
    };
    intro = 'On the present record, the capital structure includes ' + presentList[0] + '. Section ' + onlySectionMap[presentList[0]] + ' below analyzes the characterization; the remaining sections in this Part are addressed as not applicable.';
  } else {
    intro = 'On the present record, the capital structure includes ' + joinWithAnd(presentList) + '. Each element is analyzed in turn at Sections VII, VIII, IX, and X below as applicable.';
  }

  return ''
    + '<section class="memo-section">'
    +   '<h2 class="memo-h2">VI. Capital Structure &mdash; Overview</h2>'
    +   '<p>' + esc(intro) + '</p>'
    +   '<p>The four modules below characterize the federal-tax treatment of, respectively, related-party debt instruments (§§ 163(j), 267, 707(b), 385; Reg. § 1.752-2(d); anti-conduit and AHYDO overlays); management-fee arrangements between the partnership and a partner or partner affiliate (§§ 707(a), 707(c), 1061, 1402(a)(13)); mezzanine instruments under the federal-common-law thirteen-factor debt-vs-equity test (Indmar / Roth Steel line; Notice 94-47); and Qualified Opportunity Zone investments under the OZ 1.0 / OZ 2.0 regimes (§§ 1400Z-1, 1400Z-2; OBBBA, P.L. 119-21, July 4, 2025).</p>'
    + '</section>';
}

function joinWithAnd(arr) {
  if (!arr || !arr.length) return '';
  if (arr.length === 1) return arr[0];
  if (arr.length === 2) return arr[0] + ' and ' + arr[1];
  return arr.slice(0, -1).join(', ') + ', and ' + arr[arr.length - 1];
}

function memoSectionRPD(state, analysis) {
  const r = analysis.rpd;
  let html = '<section class="memo-section">'
    + '<h2 class="memo-h2">VII. Related-Party Debt Analysis</h2>';

  if (!r.present) {
    html += '<p><em>Not applicable: no related-party debt is present in the proposed capital structure. The analysis has considered and excluded § 163(j), Reg. § 1.752-2(d), § 385 documentation, anti-conduit, and AHYDO analysis on the present record.</em></p>';
    return html + '</section>';
  }

  // Dynamic-letter counter — A, B, C, D, ... assigned in order as subsections render.
  // Prevents the C → F jump when conditional subsections are skipped.
  let letterIdx = 0;
  function nextLetter() { return String.fromCharCode(65 + letterIdx++); }

  // A. Loan Terms and Documentation
  html += '<h3 class="memo-h3">' + nextLetter() + '. Loan Terms and Documentation (§ 385)</h3>'
    + '<p><strong>Lender:</strong> ' + esc(({
        'partner': 'a partner of the partnership',
        'partner_affiliate': 'an affiliate of a partner',
        'other_related': 'a related person other than a partner or partner affiliate'
      }[r.inputs.rpd_lender_type] || r.inputs.rpd_lender_type)) + '. '
    + '<strong>Principal:</strong> ' + formatCurrency(r.inputs.rpd_principal) + '. '
    + '<strong>Stated rate:</strong> ' + (r.rate_decimal != null ? (r.rate_decimal * 100).toFixed(2) + '%' : (r.inputs.rpd_rate ? esc(r.inputs.rpd_rate) + '%' : 'not specified')) + '. '
    + '<strong>Maturity:</strong> ' + (r.inputs.rpd_maturity_years ? esc(r.inputs.rpd_maturity_years) + ' years' : 'not specified') + '. '
    + '<strong>Terms represented as arm\'s length:</strong> ' + (r.inputs.rpd_terms_arm_length ? 'Yes.' : 'No &mdash; pricing risk under § 482 must be addressed.') + '</p>'
    + '<p><strong>§ 385 documentation status.</strong> ' + (r.flags.section_385_documentation_deficient
      ? 'The four documentation factors of Reg. § 1.385-2 are <strong>not yet complete</strong> for this instrument. Contemporaneous documentation must be in place by issuance; backfilled documentation is regularly rejected on examination. The four factors are:'
      : 'The four documentation factors of Reg. § 1.385-2 have been represented as complete. The engagement file should verify (and date-stamp) each factor before closing.')
    + '</p>'
    + ulFromArray(RPD_RULES.section385.documentationFactors);

  // B. § 163(j)
  if (r.flags.section_163j_in_play) {
    html += '<h3 class="memo-h3">' + nextLetter() + '. Interest Limitation Analysis (§ 163(j))</h3>'
      + '<p><strong>Rule.</strong> ' + esc(RPD_RULES.section163j.rule) + ' ' + esc(RPD_RULES.section163j.cite) + '.</p>'
      + '<p><strong>OBBBA &mdash; ATI computation post-2024.</strong> ' + esc(RPD_RULES.section163j.obbbaAddback) + '</p>'
      + '<p><strong>OBBBA &mdash; international-item exclusions.</strong> ' + esc(RPD_RULES.section163j.obbbaCfcExclusions) + '</p>'
      + '<p><strong>OBBBA &mdash; capitalized-interest restriction (effective 2026).</strong> ' + esc(RPD_RULES.section163j.capitalizedInterest2026) + '</p>';
    if (r.flags.rptb_election_in_play) {
      // B.1 is a sub-heading of B; doesn't increment the main-letter counter
      html += '<h3 class="memo-h3">' + String.fromCharCode(64 + letterIdx) + '.1 Real-Property-Trade-or-Business Election (§ 163(j)(7))</h3>'
        + '<p><strong>Rule.</strong> ' + esc(RPD_RULES.section163j7Election.rule) + ' ' + esc(RPD_RULES.section163j7Election.cite) + '.</p>'
        + '<p><strong>Tradeoff.</strong> ' + esc(RPD_RULES.section163j7Election.tradeoff) + '</p>'
        + '<p class="memo-flag"><strong>OBBBA planning point.</strong> ' + esc(RPD_RULES.section163j7Election.obbbaPlanningPoint) + '</p>'
        + '<p><strong>One-shot revocation window.</strong> ' + esc(RPD_RULES.section163j7Election.obbbaRevocationWindow) + '</p>';
    }
  } else {
    html += '<h3 class="memo-h3">' + nextLetter() + '. Interest Limitation Analysis (§ 163(j))</h3>'
      + '<p>The matter is not represented as raising § 163(j) concerns. Recommended: model the partnership\'s ATI under the restored EBITDA addback (OBBBA, effective for tax years beginning after December 31, 2024) before relying on this representation. ' + esc(RPD_RULES.section163j.cite) + '.</p>';
  }

  // C. Recourse / Nonrecourse allocation
  html += '<h3 class="memo-h3">' + nextLetter() + '. Recourse / Nonrecourse Allocation under Reg. § 1.752-2(d)</h3>'
    + '<p><strong>Recourse treatment:</strong> ' + esc(({
        'recourse': 'Recourse',
        'nonrecourse': 'Nonrecourse',
        'qualified_nonrecourse': 'Qualified nonrecourse (§ 465(b)(6))'
      }[r.inputs.rpd_recourse_treatment] || r.inputs.rpd_recourse_treatment)) + '.</p>';
  if (r.flags.related_recourse_in_play) {
    html += '<p><strong>Related-recourse allocation.</strong> ' + esc(RPD_RULES.reg7522d.rule) + ' ' + esc(RPD_RULES.reg7522d.cite) + '. '
      + esc(RPD_RULES.reg7522d.practicePoint) + '</p>';
  } else {
    html += '<p>The debt is represented as nonrecourse (or qualified nonrecourse). Reg. § 1.752-2(d) related-party recourse allocation does not apply on the present record; nonrecourse allocations follow §§ 752(a) and 1.752-3.</p>';
  }

  // D. AHYDO (conditional)
  if (r.flags.ahydo_in_play) {
    html += '<h3 class="memo-h3">' + nextLetter() + '. AHYDO Test (§ 163(i))</h3>'
      + '<p><strong>Definition.</strong> ' + esc(RPD_RULES.ahydo.rule) + '</p>'
      + '<p><strong>Consequence.</strong> ' + esc(RPD_RULES.ahydo.consequence) + '</p>'
      + (r.ahydo_threshold_note ? '<p><strong>Threshold note.</strong> ' + esc(r.ahydo_threshold_note) + '</p>' : '')
      + '<p><em>Practice point.</em> ' + esc(RPD_RULES.ahydo.practicePoint) + '</p>';
  }

  // E. Anti-conduit (conditional)
  if (r.flags.anti_conduit_in_play) {
    html += '<h3 class="memo-h3">' + nextLetter() + '. Anti-Conduit Considerations</h3>'
      + '<p><strong>Rule.</strong> ' + esc(RPD_RULES.antiConduit.rule) + ' ' + esc(RPD_RULES.antiConduit.cite) + '.</p>'
      + '<p><em>Practice point.</em> ' + esc(RPD_RULES.antiConduit.practicePoint) + '</p>';
  }

  // F. Self-charged (informational, conditional)
  if (r.flags.self_charged_interest_available) {
    html += '<h3 class="memo-h3">' + nextLetter() + '. Self-Charged Interest (§ 469(l)(1)(A))</h3>'
      + '<p>' + esc(RPD_RULES.selfChargedInterest.rule) + ' ' + esc(RPD_RULES.selfChargedInterest.cite) + '.</p>';
  }

  // Cross-cutting cites
  html += '<p class="memo-cites"><em>Cross-cutting authorities: '
    + esc(RPD_RULES.section267.cite) + '; '
    + esc(RPD_RULES.section707b.cite) + '; '
    + esc(RPD_RULES.oid.cite) + '.</em></p>';

  return html + '</section>';
}

function memoSectionMgmtFee(state, analysis) {
  const r = analysis.mgmtFee;
  let html = '<section class="memo-section">'
    + '<h2 class="memo-h2">VIII. Management Fee Characterization</h2>';

  if (!r.present) {
    html += '<p><em>Not applicable: no management fee arrangement is present in the proposed structure. The analysis has considered and excluded the § 707(a)/(c) characterization analysis, the six-factor disguised-payment-for-services test, and the § 1402(a)(13) SE-tax analysis on the present record.</em></p>';
    return html + '</section>';
  }

  // A. Recipient and Relationship
  html += '<h3 class="memo-h3">A. Recipient and Relationship to Partnership</h3>'
    + '<p><strong>Recipient:</strong> ' + esc(({
        'partner': 'a partner of the partnership',
        'non_partner_affiliate': 'an affiliate of a partner (non-partner)',
        'unrelated': 'an unrelated party'
      }[r.inputs.recipient_type] || r.inputs.recipient_type)) + '. '
    + '<strong>Fee basis:</strong> ' + esc(({
        'fixed': 'Fixed dollar amount',
        'percentage_aum': 'Percentage of assets under management',
        'percentage_revenue': 'Percentage of revenue',
        'hybrid': 'Hybrid (combination of bases)'
      }[r.inputs.amount_basis] || r.inputs.amount_basis)) + '. '
    + (r.inputs.amount ? '<strong>Fee amount:</strong> ' + formatCurrency(r.inputs.amount) + '. ' : '')
    + '<strong>Represented as arm\'s length:</strong> ' + (r.inputs.arm_length ? 'Yes.' : 'No &mdash; § 482 pricing exposure must be addressed.') + '</p>';

  if (r.flags.arm_length_concern) {
    html += '<p class="memo-flag"><strong>Arm\'s-length concern.</strong> ' + esc(MGMT_FEE_RULES.section482.rule) + ' ' + esc(MGMT_FEE_RULES.section482.cite) + '.</p>';
  }

  // B. Characterization
  html += '<h3 class="memo-h3">B. Characterization Analysis</h3>'
    + '<p><strong>Intended characterization:</strong> ' + esc(({
        'section_707a': '§ 707(a) services-from-non-partner',
        'section_707c': '§ 707(c) guaranteed payment',
        'profits_interest_fee_waiver': 'Profits-interest / fee-waiver structure',
        'distribution': 'Distribution (capital interest allocation)'
      }[r.inputs.characterization_intended] || r.inputs.characterization_intended)) + '.</p>'
    + '<p><strong>§ 707(a).</strong> ' + esc(MGMT_FEE_RULES.section707a.rule) + ' ' + esc(MGMT_FEE_RULES.section707a.cite) + '.</p>'
    + '<p><strong>§ 707(c).</strong> ' + esc(MGMT_FEE_RULES.section707c.rule) + ' ' + esc(MGMT_FEE_RULES.section707c.cite) + '.</p>';

  // C. Fee Waiver (six-factor)
  if (r.flags.fee_waiver_present) {
    html += '<h3 class="memo-h3">C. Fee Waiver Mechanics &mdash; Six-Factor Disguised-Payment Test</h3>'
      + '<p><strong>Authority.</strong> ' + esc(MGMT_FEE_RULES.disguisedPayment.cite) + '.</p>'
      + '<p><strong>Regulatory status.</strong> ' + esc(MGMT_FEE_RULES.disguisedPayment.status) + '</p>'
      + '<p><strong>Rule.</strong> ' + esc(MGMT_FEE_RULES.disguisedPayment.rule) + '</p>'
      + '<p><strong>Six factors:</strong></p>'
      + '<ol class="memo-list">'
      + MGMT_FEE_RULES.disguisedPayment.sixFactors.map(function (f) {
          return '<li><strong>' + esc(f.label) + '</strong> &mdash; <em>' + esc(f.weight) + '.</em> ' + esc(f.summary) + '</li>';
        }).join('')
      + '</ol>';

    if (r.sixFactorAggregate) {
      const cls = r.flags.disguised_payment_risk === 'high' ? 'memo-flag' : '';
      html += '<p' + (cls ? ' class="' + cls + '"' : '') + '><strong>Aggregate assessment.</strong> ' + esc(r.sixFactorAggregate.rationale) + '</p>';
    }

    // § 1061 capital-interest exception interaction
    html += '<h3 class="memo-h3">C.1 § 1061 Capital-Interest Exception Interaction</h3>'
      + '<p><strong>Authority.</strong> ' + esc(MGMT_FEE_RULES.section1061FeeWaiver.cite) + '.</p>'
      + '<p><strong>Rule.</strong> ' + esc(MGMT_FEE_RULES.section1061FeeWaiver.rule) + '</p>'
      + '<p class="memo-flag"><strong>Capital-interest exception generally unavailable.</strong> ' + esc(MGMT_FEE_RULES.section1061FeeWaiver.capitalInterestException) + '</p>'
      + '<p><em>Practice point.</em> ' + esc(MGMT_FEE_RULES.section1061FeeWaiver.practicePoint) + '</p>';
  }

  // D. SE Tax — post-Soroban / Denham / Sirius circuit split with Golsen mechanic
  if (r.inputs.se_tax_concern) {
    html += '<h3 class="memo-h3">D. Self-Employment Tax Treatment (§ 1402(a)(13))</h3>';

    // Tension paragraph — controlling authority across the circuit split
    html += '<p><strong>§ 1402(a)(13) &mdash; controlling authority.</strong> Application of the limited-partner exception to a state-law LP performing substantial services is contested between the Tax Court and the Fifth Circuit, and the divergence is outcome-determinative on these facts. ' + esc(MGMT_FEE_RULES.section1402a13.taxCourtPosition) + ' ' + esc(MGMT_FEE_RULES.section1402a13.fifthCircuitSplit) + '</p>';

    html += '<p>' + esc(MGMT_FEE_RULES.section1402a13.golsenMechanic) + ' '
      + (r.forumPosture
          ? 'On the present record, forum: <strong>' + esc(r.forumPosture.forumLabel) + '</strong>. The controlling position is: <em>' + esc(r.forumPosture.controllingPosition) + '</em> Controlling authority: ' + esc(r.forumPosture.controllingAuthority) + '. '
          : '')
      + 'A material change in partner residence or in chosen forum could shift the controlling line; the practitioner should confirm forum at the engagement-letter stage and re-confirm if facts move. ' + esc(MGMT_FEE_RULES.section1402a13.pendingChallenges) + '</p>';

    if (r.forumPosture) {
      const flagClass = r.forumPosture.forum === 'fifth_circuit' ? '' : 'memo-flag';
      html += '<p' + (flagClass ? ' class="' + flagClass + '"' : '') + '><strong>Rule applied.</strong> ' + esc(r.forumPosture.rule) + '</p>'
        + '<p><em>Practice point.</em> ' + esc(r.forumPosture.practicePoint) + '</p>';
    }

    html += '<p><em>Practitioner note.</em> ' + esc(MGMT_FEE_RULES.section1402a13.practicePoint) + '</p>';
  }

  return html + '</section>';
}

function memoSectionMezz(state, analysis) {
  const r = analysis.mezz;
  let html = '<section class="memo-section">'
    + '<h2 class="memo-h2">IX. Mezzanine Debt Characterization</h2>';

  if (!r.present) {
    html += '<p><em>Not applicable: no mezzanine financing is present in the proposed capital structure. The analysis has considered and excluded the 13-factor Indmar / Roth Steel debt-vs-equity analysis, AHYDO and OID overlays, and the § 108(e)(8) debt-for-equity-exchange analysis on the present record.</em></p>';
    return html + '</section>';
  }

  // A. Stated Terms and Documentation
  html += '<h3 class="memo-h3">A. Stated Terms and Documentation</h3>'
    + '<p><strong>Principal:</strong> ' + formatCurrency(r.inputs.principal) + '. '
    + '<strong>Stated rate:</strong> ' + (r.rate_decimal != null ? (r.rate_decimal * 100).toFixed(2) + '%' : (r.inputs.stated_rate ? esc(r.inputs.stated_rate) + '%' : 'not specified')) + '. '
    + '<strong>Maturity:</strong> ' + (r.inputs.maturity_years ? esc(r.inputs.maturity_years) + ' years' : 'not specified') + '. '
    + '<strong>Payment-in-kind:</strong> ' + (r.inputs.paid_in_kind ? 'Yes.' : 'No.') + ' '
    + '<strong>Equity kicker:</strong> ' + (r.inputs.equity_kicker ? 'Yes.' : 'No.') + ' '
    + '<strong>Subordination:</strong> ' + esc(({
        'senior': 'Senior',
        'mezzanine': 'Mezzanine (subordinated to senior debt)',
        'preferred': 'Preferred',
        'common': 'Common'
      }[r.inputs.subordination] || r.inputs.subordination)) + '.</p>';

  // B. Thirteen-factor analysis
  html += '<h3 class="memo-h3">B. Thirteen-Factor Debt-vs-Equity Analysis</h3>'
    + '<p><strong>Authority.</strong> ' + esc(MEZZ_RULES.thirteenFactorTest.cite) + '.</p>'
    + '<p>' + esc(MEZZ_RULES.thirteenFactorTest.introduction) + '</p>'
    + '<table class="memo-table"><thead><tr>'
    + '<th>#</th><th>Factor</th><th>Score (1–5)</th><th>Practice Note</th>'
    + '</tr></thead><tbody>';
  r.factorAggregate.perFactor.forEach(function (f, i) {
    html += '<tr>'
      + '<td>' + (i + 1) + '</td>'
      + '<td>' + esc(f.label) + '</td>'
      + '<td>' + f.score + '</td>'
      + '<td>' + esc(f.summary) + '</td>'
      + '</tr>';
  });
  html += '</tbody></table>'
    + '<p><strong>Aggregate score:</strong> ' + r.factorAggregate.sum + ' / 65 (mean ' + r.factorAggregate.average.toFixed(2) + '). '
    + 'Scoring rubric: 1 = strongly weighs against debt; 3 = neutral; 5 = strongly supports debt. '
    + 'Debt-band ≥ ' + MEZZ_RULES.thirteenFactorTest.aggregateBands.debt.min + '; '
    + 'preferred-equity band ' + MEZZ_RULES.thirteenFactorTest.aggregateBands.preferred_equity.min + '–' + (MEZZ_RULES.thirteenFactorTest.aggregateBands.debt.min - 1) + '; '
    + 'disguised-equity band < ' + MEZZ_RULES.thirteenFactorTest.aggregateBands.preferred_equity.min + '.</p>';

  // C. AHYDO + OID overlay
  html += '<h3 class="memo-h3">C. AHYDO and OID Considerations</h3>';
  if (r.flags.ahydo_concern) {
    html += '<p class="memo-flag"><strong>AHYDO concern.</strong> ' + esc(MEZZ_RULES.ahydoOverlay.rule) + ' ' + esc(MEZZ_RULES.ahydoOverlay.cite) + '.</p>'
      + '<p><em>Practice point.</em> ' + esc(MEZZ_RULES.ahydoOverlay.practicePoint) + '</p>';
  } else if (r.recommendation.band === 'debt') {
    html += '<p>AHYDO testing is potentially in play because the instrument is recommended for debt characterization. ' + esc(MEZZ_RULES.ahydoOverlay.rule) + ' ' + esc(MEZZ_RULES.ahydoOverlay.cite) + '. The yield, OID, and maturity inputs on the present record do not present an AHYDO concern, but verify the AFR + 5 threshold against the actual issue-date AFR before closing.</p>';
  } else {
    html += '<p>AHYDO testing is moot. The instrument is recommended for ' + esc(r.recommendation.band === 'preferred_equity' ? 'preferred-equity' : 'equity') + ' characterization (see Part D below); § 163(i) applies only to debt instruments and the disqualified-portion analysis is therefore inapplicable.</p>';
  }
  if (r.flags.oid_accrual) {
    html += '<p><strong>OID / PIK accrual.</strong> ' + esc(MEZZ_RULES.oidOverlay.rule) + ' ' + esc(MEZZ_RULES.oidOverlay.cite) + '. The PIK feature on this instrument requires constant-yield accrual; the issuer and holder must accrue interest on a current basis regardless of cash payment.</p>';
  }

  // D. Recommendation
  html += '<h3 class="memo-h3">D. Recommended Characterization</h3>'
    + '<div class="memo-recommendation"><strong>' + esc(r.recommendation.label) + '</strong> &mdash; aggregate score ' + r.recommendation.score + '</div>'
    + '<p>' + esc(r.recommendation.summary) + '</p>';

  if (r.recommendation.band === 'preferred_equity' || r.recommendation.band === 'disguised_equity') {
    html += '<p><em>Cross-reference.</em> ' + esc(MEZZ_RULES.trueMezzVsPreferredEquity.practicePoint) + '</p>';
    if (r.recommendation.band === 'disguised_equity') {
      html += '<p><strong>§ 108(e)(8) debt-for-equity exchange.</strong> ' + esc(MEZZ_RULES.debtForEquityExchange.rule) + ' ' + esc(MEZZ_RULES.debtForEquityExchange.cite) + '. ' + esc(MEZZ_RULES.debtForEquityExchange.practicePoint) + '</p>';
    }
  }

  if (r.flags.equity_kicker) {
    html += '<p class="memo-flag"><strong>Equity kicker.</strong> The instrument includes an equity kicker (warrants, conversion right, or profit-participation feature). The kicker is generally bifurcated for tax purposes: the debt portion is tested under the 13-factor analysis; the equity portion is treated as a separate property interest. The kicker may also raise § 305 deemed-distribution issues if the conversion ratio adjusts on dividends.</p>';
  }

  return html + '</section>';
}

// ----- Thread 3 Section X: Qualified Opportunity Zone Analysis -----

// =============================================================================
// v12.2 — REIT memo section (X when reit_present)
// =============================================================================
function memoSectionREIT(state, analysis) {
  const r = analysis.reit;
  if (!r || !r.present) {
    // REIT analysis suppressed when reit_present is false — no section renders.
    return '';
  }

  // Build the section dynamically with subsections lettered A, B, C, ... using a counter
  let letterIdx = 0;
  function nextLetter() { return String.fromCharCode(65 + letterIdx++); }

  let html = '<section class="memo-section">'
    + '<h2 class="memo-h2">X. REIT Analysis</h2>';

  // ----- A. Statutory Framework -----
  html += '<h3 class="memo-h3">' + nextLetter() + '. Statutory Framework</h3>'
    + '<p><strong>Authority.</strong> I.R.C. §§ 856-859 (REIT qualification and taxation); '
    + 'Reg. § 1.856-0 through § 1.860J-1 (implementing regulations); '
    + 'I.R.C. § 897(h)(4) (domestically controlled REIT carve-out from FIRPTA); '
    + 'I.R.C. § 897(k)(2) (publicly traded REIT 5%-shareholder carve-out from FIRPTA); '
    + 'I.R.C. § 856(l) (Taxable REIT Subsidiary).</p>'
    + '<p>To qualify as a REIT for federal tax purposes, the entity must satisfy four categories of tests: '
    + '<strong>(i) Organizational</strong> &mdash; taxable as a domestic corporation; managed by trustees or directors; '
    + 'transferable shares; not closely held by 5 or fewer individuals (the 5/50 test under § 856(h)); '
    + '≥ 100 shareholders for at least 335 days of the taxable year. '
    + '<strong>(ii) 75% / 95% Income Tests</strong> (§§ 856(c)(2), (c)(3)) &mdash; at least 75% of gross income from '
    + 'real estate sources (rents from real property, interest on mortgages secured by real property, '
    + 'gain from disposition of real property), and 95% from real estate sources plus passive sources '
    + '(dividends, interest, gains from disposition of stock or securities). '
    + '<strong>(iii) 75% Asset Test</strong> (§ 856(c)(4)) &mdash; at least 75% of total assets in real estate, '
    + 'cash, cash items, and government securities, measured quarterly. '
    + '<strong>(iv) 90% Distribution Requirement</strong> (§ 857(a)(1)) &mdash; REIT must distribute at least 90% '
    + 'of its REIT taxable income to shareholders annually. Failure subjects retained earnings to '
    + 'corporate tax plus loss of REIT status.</p>';

  // ----- B. Domestic Control Determination (§ 897(h)(4)) -----
  html += '<h3 class="memo-h3">' + nextLetter() + '. Domestic Control Determination (§ 897(h)(4))</h3>'
    + '<p><strong>Rule.</strong> A &ldquo;domestically controlled REIT&rdquo; (DC-REIT) is one in which '
    + 'less than 50% in value of the stock is held directly or indirectly by foreign persons at all relevant times '
    + 'during the testing period (typically the 5-year period ending on the date of disposition). '
    + 'I.R.C. § 897(h)(4)(B); Reg. § 1.897-1(c)(2).</p>'
    + '<p><strong>Significance.</strong> Stock of a DC-REIT is <strong>not</strong> a U.S. real property interest (USRPI). '
    + 'Disposition of DC-REIT shares by a foreign holder is therefore not subject to FIRPTA &mdash; '
    + 'a structurally distinct outcome from a direct or partnership-held real estate investment, where '
    + 'sale-leg gain is subject to the 21% corporate rate (via blocker) or 30%/treaty WHT on dividend distributions. '
    + 'I.R.C. § 897(h)(4); Treas. Reg. § 1.897-1(c)(3) (T.D. 10000, April 25, 2024): for the 50% determination, '
    + 'look through partnerships, trusts, estates, REITs, RICs and &mdash; the 2024 change &mdash; any non-publicly-traded domestic C corporation '
    + 'that is itself more than 50% foreign-owned (a &ldquo;foreign-controlled domestic corporation&rdquo;); qualified foreign pension funds are treated as foreign persons. '
    + 'A ten-year transition rule (through April 24, 2034) protects REITs existing on April 24, 2024 that do not acquire significant new U.S. real property or shift materially toward foreign ownership.</p>';

  if (r.flags.is_dc_reit) {
    html += '<p class="memo-callout"><strong>Recommendation &mdash; DC-REIT structure represented.</strong> '
      + 'The matter is represented as structured to satisfy the &lt; 50% foreign-ownership threshold.';
    if (r.flags.dc_threshold_met_per_practitioner) {
      html += ' Practitioner has indicated US ownership of ' + esc(r.inputs.reit_us_ownership_pct) + '% &mdash; '
        + 'comfortably above the 50% threshold. ';
    } else if (r.flags.dc_threshold_below_per_practitioner) {
      html += ' <strong>Caveat:</strong> Practitioner has indicated US ownership of ' + esc(r.inputs.reit_us_ownership_pct) + '%, '
        + 'which is at or below the 50% threshold. DC-REIT status is <strong>not</strong> established on these facts; '
        + 'restructuring or additional US capital is required to achieve DC status.';
    }
    if (r.flags.investor_mix_supports_dc) {
      html += ' Independent verification of investor mix corroborates DC achievability ('
        + r.investorMix.us_share_pct.toFixed(1) + '% US share on the investor panel inputs).';
    } else {
      html += ' <strong>Investor-mix flag:</strong> The aggregate investor panel shows '
        + r.investorMix.us_share_pct.toFixed(1) + '% US share and ' + r.investorMix.foreign_share_pct.toFixed(1) + '% foreign share. '
        + 'The DC status representation should be scrutinized against the look-through rules of '
        + 'Reg. § 1.897-1(c)(3) (T.D. 10000, 2024) &mdash; including the look-through of foreign-controlled domestic corporations &mdash; before reliance.';
    }
    html += '</p>';
  } else if (r.flags.is_fc_reit) {
    html += '<p class="memo-flag"><strong>Foreign-controlled REIT (FC-REIT) represented.</strong> '
      + 'The REIT is represented as foreign-controlled (≥ 50% foreign ownership). FC-REIT shares <strong>are</strong> USRPI for FIRPTA purposes; '
      + 'foreign holders are subject to FIRPTA on disposition under I.R.C. § 897(h)(1) and (h)(4)(A). '
      + 'The § 897(h)(1) constructive-distribution rule additionally treats REIT capital-gain distributions to a foreign holder '
      + 'as gain from the sale or exchange of a USRPI. This is a materially less favorable structure than DC-REIT '
      + 'for foreign investors and the structuring should be examined for whether DC achievability is feasible.</p>';
  } else if (r.flags.dc_status_unknown) {
    html += '<p class="memo-flag"><strong>DC status not yet determined.</strong> '
      + 'The DC vs FC determination has not been made on the present record. This is one of the most consequential '
      + 'structural decisions in the REIT analysis. Given the investor panel mix ('
      + r.investorMix.us_share_pct.toFixed(1) + '% US share; ' + r.investorMix.foreign_share_pct.toFixed(1) + '% foreign share), '
      + (r.flags.investor_mix_supports_dc
          ? 'DC achievability appears feasible. The structuring should be calibrated to preserve DC status &mdash; '
            + 'foreign-investor admission should be capped, and any UPREIT contributions from foreign contributors should be modeled against the 50% threshold.'
          : (r.flags.investor_mix_supports_fc
              ? 'the investor mix is at or above the 50% foreign threshold; achieving DC status would require restructuring of the investor panel. Since T.D. 10000 (April 2024) a U.S. blocker corporation that is itself more than 50% foreign-owned is looked through under Reg. § 1.897-1(c)(3), so interposing foreign investors through domestic blockers no longer manufactures domestic control unless the blocker is publicly traded or the REIT qualifies for the ten-year transition rule.'
              : 'the investor mix is mixed and the DC determination depends on the precise composition of capital. Modeling against the Reg. § 1.897-1(c)(3) look-through rules (T.D. 10000, 2024) is recommended before finalization.')) + '</p>';
  }

  // ----- C. Public vs Private REIT (§ 897(k)(2)) -----
  html += '<h3 class="memo-h3">' + nextLetter() + '. Public vs Private REIT (§ 897(k)(2))</h3>';
  if (r.flags.is_public) {
    html += '<p><strong>Public REIT &mdash; § 897(k)(2) carve-out.</strong> '
      + 'For REITs the stock of which is publicly traded on an established securities market in the United States, '
      + 'a foreign holder whose ownership does not exceed 5% (by vote or value) of any class of stock at any time during '
      + 'the testing period is not treated as holding a USRPI with respect to that stock. '
      + 'I.R.C. § 897(k)(2); Reg. § 1.897-1(c)(2)(iii). '
      + 'This carve-out is independent of (and additive to) the DC-REIT analysis above &mdash; '
      + 'a foreign &lt; 5% holder of a publicly traded REIT is exempt from FIRPTA on share disposition regardless of '
      + 'whether the REIT is domestically controlled.</p>';
    if (r.flags.section_897k_5pct_concern_raised) {
      html += '<p class="memo-flag"><strong>5%-shareholder concern raised.</strong> '
        + 'The practitioner has flagged a potential 5%-shareholder concern. '
        + 'The § 897(k)(2) carve-out is unavailable for foreign holders exceeding the 5% threshold at any point during the testing period. '
        + 'Holdings should be monitored against this threshold; planning consideration should be given to whether share-class structuring '
        + '(e.g., dual-class or multi-class) can keep foreign holdings within the carve-out.</p>';
    }
  } else if (r.flags.is_private) {
    html += '<p><strong>Private REIT.</strong> The REIT is represented as private (not publicly traded). '
      + 'The § 897(k)(2) carve-out is unavailable for shares of non-publicly-traded REITs &mdash; '
      + 'reliance on the DC-REIT analysis under § 897(h)(4) is therefore the principal FIRPTA-mitigation pathway. '
      + 'Independent of FIRPTA, the private REIT is fully eligible for the § 857(a)(1) 90% distribution-and-deduction regime '
      + 'and the standard REIT income / asset tests.</p>';
  }

  // ----- D. Taxable REIT Subsidiary (§ 856(l)) -----
  if (r.flags.has_trs) {
    html += '<h3 class="memo-h3">' + nextLetter() + '. Taxable REIT Subsidiary (§ 856(l))</h3>'
      + '<p><strong>TRS structure represented.</strong> The REIT is structured with one or more Taxable REIT Subsidiaries. '
      + 'A TRS is a domestic corporation that is wholly or partially owned by a REIT and that has jointly elected with the REIT '
      + 'to be treated as a TRS. I.R.C. § 856(l).</p>'
      + '<p><strong>Asset and income testing.</strong> Securities of a TRS may not exceed 20% of total REIT assets '
      + '(§ 856(c)(4)(B)(ii)(III), post-PATH Act increase from the prior 25%). The TRS itself pays corporate-level tax '
      + 'on its income; distributions from the TRS to the REIT count as dividend income for the 95% income test '
      + 'but generally do not count for the 75% income test, and arm\'s-length intercompany pricing is required '
      + '(§ 857(b)(7) imposes a 100% excise tax on rents that are not arm\'s length).</p>'
      + '<p><strong>RIDEA application.</strong> The TRS structure enables the REIT to participate in active operating '
      + 'income through arm\'s-length lease-and-operate arrangements &mdash; the classic application is hotel operations under the '
      + 'REIT Investment Diversification and Empowerment Act regime (Pub. L. 110-289, H.R. 4337), where the REIT '
      + 'owns the hotel real estate, an operating-lease vehicle owned by a TRS operates the hotel, and a third-party '
      + 'or affiliated brand-management agreement supplies day-to-day operations. Senior housing structures '
      + 'use the analogous RIDEA pathway.</p>';
  }

  // ----- E. UPREIT Structure (§ 721) -----
  if (r.flags.is_uprt) {
    html += '<h3 class="memo-h3">' + nextLetter() + '. UPREIT Structure &mdash; § 721 Contribution Mechanics</h3>'
      + '<p><strong>UPREIT structure represented.</strong> The REIT is structured as an UPREIT (Umbrella Partnership REIT) &mdash; '
      + 'the REIT owns a controlling interest in an operating partnership (OP), and the OP holds the underlying real estate. '
      + 'Property contributors receive OP units in exchange for property contributions under § 721, with tax deferral on '
      + 'the contribution event.</p>'
      + '<p><strong>§ 721(a) general nonrecognition.</strong> Contribution of property to the OP in exchange for OP units is '
      + 'a tax-deferred transaction under § 721(a). The contributor takes a substituted basis in the OP units; the OP '
      + 'takes a carryover basis in the contributed property. Subsequent sale of the property by the OP triggers built-in '
      + 'gain allocations under § 704(c) (which is an economic-analysis topic outside this structural memo).</p>'
      + '<p><strong>OP-unit-to-REIT-share conversion.</strong> The OP partnership agreement typically permits the OP-unit holder '
      + 'to convert OP units to REIT shares on a 1:1 basis after a holding period. Conversion is generally treated as '
      + 'a distribution by the OP followed by a contribution to the REIT &mdash; the conversion is a taxable event '
      + 'unless structured carefully (the REIT itself can satisfy the consideration in cash to avoid the conversion '
      + 'triggering gain to the OP-unit holder).</p>'
      + '<p><strong>Tax-protection and make-whole agreements.</strong> The OP typically agrees not to sell contributed property '
      + 'for a tax-protection period (often 7-10 years), and to indemnify the contributor for any tax incurred on a premature sale. '
      + 'These are economic / drafting items but are surfaced here because they constrain the REIT\'s structural flexibility.</p>';

    if (r.flags.section_721c_concern) {
      html += '<p class="memo-flag"><strong>§ 721(c) anti-abuse concern.</strong> '
      + 'The presence of foreign partners (or foreign-controlled domestic upper-tier partners) in the UPREIT OP triggers § 721(c) '
      + 'examination. Section 721(c) and the regulations under Reg. §§ 1.721(c)-1 through 1.721(c)-7 require '
      + 'gain-on-contribution recognition for transfers to a partnership with a related foreign partner, '
      + 'unless gain-deferral methods are elected and substantial requirements (including the &ldquo;gain deferral method&rdquo; '
      + 'and the &ldquo;remedial method&rdquo; under § 704(c)) are met. Failure to satisfy the deferral method '
      + 'requirements results in immediate gain recognition on contribution. The transfer should be modeled '
      + 'against Reg. § 1.721(c)-2 before consummation.</p>';
    }
  }

  // ----- F. Distribution Compliance -----
  html += '<h3 class="memo-h3">' + nextLetter() + '. Distribution Compliance and 90% Test</h3>'
    + '<p><strong>§ 857(a)(1) distribution requirement.</strong> The REIT must distribute at least 90% of its REIT taxable income '
    + '(other than net capital gain) to shareholders annually. Distributions are deductible to the REIT under § 857(b)(2)(B) '
    + '(the dividends-paid deduction), causing taxable income at the REIT level to be effectively reduced to zero in a '
    + 'fully-distributing REIT. The 90% threshold is a hard requirement; failure permits the REIT to retain status only '
    + 'by paying tax on the undistributed portion at corporate rates, plus a 4% excise under § 4981.</p>'
    + '<p><strong>Dividend characterization at the shareholder level.</strong> REIT dividends are characterized as '
    + 'ordinary dividends (§ 854(a)), capital-gain dividends (§ 857(b)(3)), or return of capital (§ 301(c)(2)) '
    + 'based on the underlying source of the distribution. Ordinary REIT dividends are not qualified-dividend-eligible '
    + 'under § 1(h)(11) but are eligible for the 20% § 199A deduction (subject to limitations).</p>';
  if (r.flags.distribution_concern_raised) {
    html += '<p class="memo-flag"><strong>Distribution compliance flagged.</strong> '
      + 'The practitioner has flagged a potential 90%-distribution compliance concern. '
      + 'A REIT failing the 90% distribution test loses REIT status for the year of failure (subject to limited '
      + 'reasonable-cause relief under § 856(g)). Cash-flow modeling against expected REIT taxable income — '
      + 'including any non-cash income (e.g., income from passive partnership investments, OID, depreciation recapture) — '
      + 'should precede final structuring.</p>';
  }

  // ----- G. Structural Recommendation Summary -----
  html += '<h3 class="memo-h3">' + nextLetter() + '. Structural Recommendation</h3>';
  const structuralLine = (r.flags.is_dc_reit
    ? 'DC-REIT' + (r.flags.is_public ? ' (publicly traded)' : ' (private)')
    : (r.flags.is_fc_reit
        ? 'FC-REIT' + (r.flags.is_public ? ' (publicly traded)' : ' (private)')
        : 'REIT (DC/FC determination pending)'));
  const trsLine = r.flags.has_trs ? ' with Taxable REIT Subsidiary' : '';
  const uprtLine = r.flags.is_uprt ? ', UPREIT structure with § 721 OP-unit contribution mechanism' : '';
  html += '<p><strong>' + structuralLine + trsLine + uprtLine + '.</strong> '
    + 'The structural recommendation reflects the practitioner\'s designation of REIT election and the supporting '
    + 'inputs. Substantive REIT compliance &mdash; § 856 organizational compliance, the 75% / 95% income tests, the '
    + '75% asset test, and the 90% distribution requirement &mdash; is an ongoing operational matter for the engagement '
    + 'and the REIT\'s annual compliance procedures, and is outside the scope of this structural memorandum.</p>';

  return html + '</section>';
}

// =============================================================================
// v13.2 — § 1031 Specialty Structures memo section (DST + TIC)
// =============================================================================
// Section number: dynamic — sits AFTER QOZ. If REIT present, QOZ = XI and
// Specialty 1031 = XII. If REIT absent, QOZ = X and Specialty 1031 = XI.
// Scope notice (if rendered) then becomes XII or XIII respectively.
// =============================================================================
function memoSectionSpecialty1031(state, analysis) {
  const dst = analysis.dst;
  const tic = analysis.tic;
  if ((!dst || !dst.present) && (!tic || !tic.present)) return '';

  const reitPresent = analysis.reit && analysis.reit.present;
  // QOZ always renders (even if not present, as a "not applicable" stub) so it always consumes a section number.
  // REIT renders only when present.
  // Section number for Specialty 1031: after QOZ — so X+1 (if no REIT) or X+2 (if REIT).
  const sectionNumber = reitPresent ? 'XII' : 'XI';

  let html = '<section class="memo-section">'
    + '<h2 class="memo-h2">' + sectionNumber + '. § 1031 Specialty Structures</h2>';

  let letterIdx = 0;
  function nextLetter() { return String.fromCharCode(65 + letterIdx++); }

  // ----- A/B. DST -----
  if (dst && dst.present) {
    html += '<h3 class="memo-h3">' + nextLetter() + '. Delaware Statutory Trust (DST) &mdash; Rev. Rul. 2004-86 Compliance</h3>'
      + '<p><strong>Authority.</strong> Delaware Statutory Trust Act, 12 Del. C. § 3801 et seq.; Rev. Rul. 2004-86, 2004-2 C.B. 191. '
      + 'Under Rev. Rul. 2004-86, beneficial interests in a DST qualify as undivided fractional interests in real estate (eligible '
      + 'for § 1031 exchange treatment) ONLY if the DST trust agreement avoids the &ldquo;seven deadly sins&rdquo; &mdash; '
      + 'operational restrictions on the trustee designed to ensure the DST functions as a grantor trust (with each beneficial '
      + 'interest holder treated as owning a proportionate share of the underlying property) rather than as a business entity '
      + '(which would be taxed as a partnership and break § 1031 qualification).</p>';

    if (dst.flags.is_compliant) {
      html += '<p class="memo-callout"><strong>Rev. Rul. 2004-86 compliance: CONFIRMED.</strong> '
        + 'The DST trust agreement, as represented, satisfies the seven operational restrictions of Rev. Rul. 2004-86. '
        + 'Beneficial interests are treated as undivided fractional interests in the underlying real property for § 1031 purposes; '
        + '1031 exchangers may acquire beneficial interests as replacement property in their like-kind exchanges.</p>';
    } else {
      html += '<p class="memo-flag"><strong>Rev. Rul. 2004-86 compliance: ' + dst.violations.length
        + ' violation' + (dst.violations.length === 1 ? '' : 's') + ' identified.</strong> '
        + 'The DST trust agreement, as represented, violates the following operational restrictions of Rev. Rul. 2004-86:</p>'
        + '<ul>';
      dst.violations.forEach(function (v) {
        html += '<li><strong>Sin #' + v.sin + ' &mdash; ' + esc(v.name) + '</strong> (' + esc(v.cite) + '). ' + esc(v.explanation) + '</li>';
      });
      html += '</ul>'
        + '<p>Each violation independently risks recharacterization of the DST as a business entity, which would result in '
        + 'partnership taxation at the DST level and loss of § 1031 nonrecognition treatment for the beneficial-interest holders. '
        + 'Remediation: amend the trust agreement to add restrictions on the trustee\'s authority, or convert the DST to a '
        + 'limited-liability company under the &ldquo;springing LLC&rdquo; provision (if available) and accept partnership treatment going forward.</p>';
    }

    if (dst.flags.has_master_lease) {
      html += '<p><strong>Master lease structure.</strong> '
        + 'The DST is represented as employing a master lease to an affiliated operator. This is the standard DST operating '
        + 'arrangement: because the DST trustee\'s authority is severely restricted by the Rev. Rul. 2004-86 compliance regime '
        + '(no debt renegotiation, no significant capex, no reinvestment of sales proceeds), the operator-affiliate (typically '
        + 'a single-member LLC owned by the sponsor) leases the entire property from the DST under a long-term net lease and '
        + 'conducts the active operating decisions. The DST receives fixed rent from the master lessee; the master lessee '
        + 'collects tenant rent and operates the property. Care must be taken that the master lease itself is at arm\'s length '
        + '(per IRS examination focus on related-party master leases).</p>';
    }

    if (dst.flags.has_springing_llc) {
      html += '<p><strong>Springing LLC provision.</strong> '
        + 'The DST trust agreement includes a springing-LLC provision authorizing conversion to a limited-liability company '
        + 'if circumstances arise requiring active management beyond the Rev. Rul. 2004-86 restrictions (typically a debt '
        + 'workout, major capital expenditure, or property sale where reinvestment is desired). On conversion, the DST '
        + 'transitions to partnership tax treatment going forward; § 1031 nonrecognition for the prior exchange period is '
        + 'preserved (the conversion is generally a non-event for the prior § 1031 treatment because the beneficial-interest '
        + 'holders\' tax positions in the underlying property are continuous). Conversion is a substantive decision and should '
        + 'be coordinated with all beneficial-interest holders, the master lessee, and the lender.</p>';
    }
  }

  // ----- A/B. TIC -----
  if (tic && tic.present) {
    html += '<h3 class="memo-h3">' + nextLetter() + '. Tenant-in-Common (TIC) Arrangement &mdash; Rev. Proc. 2002-22 Conditions</h3>'
      + '<p><strong>Authority.</strong> Rev. Proc. 2002-22, 2002-1 C.B. 733. '
      + 'A tenant-in-common arrangement is a co-ownership structure where each co-owner holds an undivided fractional interest '
      + 'in real property as a tenant-in-common (rather than through an entity). Each co-owner is treated as owning the property '
      + 'directly for federal tax purposes &mdash; provided the arrangement is not characterized as a partnership. '
      + 'Rev. Proc. 2002-22 sets out 15 conditions under which the IRS will consider issuing a favorable private letter ruling '
      + 'that the TIC arrangement is not a partnership. The 15 conditions are the de facto industry standard for TIC structuring '
      + 'used in § 1031 exchange contexts (where 1031 exchangers acquire TIC interests as like-kind replacement property).</p>';

    if (tic.flags.owner_count !== null) {
      html += '<p><strong>Co-owner count.</strong> ' + esc(String(tic.flags.owner_count)) + ' co-owner'
        + (tic.flags.owner_count === 1 ? '' : 's') + '. ';
      if (tic.flags.owner_count_within_safe_harbor) {
        html += 'Within the 35-co-owner cap of Rev. Proc. 2002-22 § 6.02; the arrangement is within the IRS PLR-favorable threshold.</p>';
      } else if (tic.flags.owner_count_exceeds_safe_harbor) {
        html += '<strong>Exceeds 35-co-owner cap</strong> of Rev. Proc. 2002-22 § 6.02. The IRS will not issue a favorable PLR. '
          + 'Partnership characterization risk is materially elevated; the practitioner should consider restructuring '
          + '(reducing co-owner count) or accepting partnership treatment.</p>';
      }
    }

    if (tic.flags.is_compliant) {
      html += '<p class="memo-callout"><strong>Rev. Proc. 2002-22 compliance: CONFIRMED.</strong> '
        + 'The TIC arrangement, as represented, satisfies the conditions of Rev. Proc. 2002-22. The arrangement is '
        + 'a candidate for a favorable IRS private letter ruling that it is not a partnership for federal tax purposes; '
        + 'each co-owner is treated as owning an undivided fractional interest in the property directly, eligible for '
        + '§ 1031 nonrecognition treatment on disposition.</p>';
    } else {
      html += '<p class="memo-flag"><strong>Rev. Proc. 2002-22 compliance: ' + tic.deficiencies.length
        + ' deficienc' + (tic.deficiencies.length === 1 ? 'y' : 'ies') + ' identified.</strong></p>'
        + '<ul>';
      tic.deficiencies.forEach(function (d) {
        html += '<li><strong>Condition ' + d.cond + ' &mdash; ' + esc(d.name) + '</strong> (' + esc(d.cite) + '). ' + esc(d.explanation) + '</li>';
      });
      html += '</ul>'
        + '<p>Each deficiency risks the IRS treating the co-ownership as a partnership rather than a TIC. The cumulative '
        + 'effect on PLR-eligibility is substantial: any single deficiency may cause the IRS to decline a favorable ruling, '
        + 'and the practical industry approach is to satisfy all 15 conditions where possible. Remediation depends on the '
        + 'specific deficiency &mdash; governance provisions can typically be amended; the 35-owner cap is a structural '
        + 'constraint requiring restructuring.</p>';
    }

    html += '<p><strong>§ 1031 application.</strong> When properly structured under Rev. Proc. 2002-22, the TIC arrangement '
      + 'enables an exchanger to acquire a TIC interest as like-kind replacement property in a § 1031 exchange. The TIC '
      + 'sponsor (typically a syndicator) assembles a property and the TIC investors (typically QI-coordinated 1031 exchangers) '
      + 'acquire their respective undivided fractional interests at closing. Care is required at the QI level to ensure that '
      + 'the exchanger\'s receipt of a TIC interest qualifies as like-kind replacement property under Treas. Reg. § 1.1031(a)-1 '
      + 'and is not constructively received before the 180-day exchange period closes.</p>';
  }

  return html + '</section>';
}


// =============================================================================
// v13.3 — Tax-Credit Modules memo section (LIHTC + Solar tax-equity flip)
// =============================================================================
// Section number: dynamic, AFTER Specialty 1031 and QOZ. If REIT present, this
// becomes XIII; otherwise XII.
// =============================================================================
function memoSectionTaxCredits(state, analysis) {
  const lihtc = analysis.lihtc;
  const solar = analysis.solarTaxEquity;
  if ((!lihtc || !lihtc.present) && (!solar || !solar.present)) return '';

  const reitPresent = analysis.reit && analysis.reit.present;
  const sectionNumber = reitPresent ? 'XIII' : 'XII';

  let html = '<section class="memo-section">'
    + '<h2 class="memo-h2">' + sectionNumber + '. Tax-Credit Structures</h2>';

  let letterIdx = 0;
  function nextLetter() { return String.fromCharCode(65 + letterIdx++); }

  // ----- LIHTC -----
  if (lihtc && lihtc.present) {
    html += '<h3 class="memo-h3">' + nextLetter() + '. § 42 Low-Income Housing Tax Credit Syndication</h3>'
      + '<p><strong>Authority.</strong> I.R.C. § 42 (LIHTC); Reg. § 1.42-1 et seq.; § 42(h) allocation; '
      + '§ 42(j) recapture; Rev. Proc. 2014-12 (partnership LIHTC safe harbor); '
      + '§ 47 (historic credit; potentially twinned). OBBBA (P.L. 119-21, July 4, 2025) permanently increased each state\'s 9% allocation ceiling by 12% beginning in 2026 and lowered the tax-exempt-bond financing test from 50% to 25% (see below); '
      + 'state LIHTC programs (e.g., California, New York) frequently twin federal credits with state credits at varying ratios.</p>';

    // Credit type
    const ctLabel = lihtc.flags.is_9_pct ? '9% LIHTC' : (lihtc.flags.is_4_pct ? '4% LIHTC (with tax-exempt bond financing)' : 'Combined 9% + 4% LIHTC');
    html += '<p><strong>Credit type.</strong> ' + esc(ctLabel) + '. ';
    if (lihtc.flags.is_9_pct) {
      html += 'The 9% credit (technically a 70% present-value credit on eligible basis under § 42(b)) is the competitive credit '
        + 'allocated by state housing finance agencies through Qualified Allocation Plans (QAP). Yields approximately 9¢ per $1 of '
        + 'eligible basis annually for the 10-year credit period.';
    } else if (lihtc.flags.is_4_pct) {
      html += 'The 4% credit (technically a 30% present-value credit on eligible basis under § 42(b)) is the non-competitive credit '
        + 'available when tax-exempt private-activity bonds finance at least 50% of aggregate basis &mdash; reduced by OBBBA (P.L. 119-21) to 25% for buildings placed in service after December 31, 2025 where at least 5% of the aggregate basis is financed by bonds issued after that date. The 4% credit is '
        + 'in practice "by-right" once the bond financing is in place. Post-2020, the 4% credit rate was permanently set at 4% '
        + '(not floating).';
    } else {
      html += 'Combined 9% + 4% structures are used for mixed-population projects or where 9% credits are insufficient to '
        + 'close the financing gap. 4% credits are typically applied to acquisition basis; 9% credits to rehabilitation / construction basis.';
    }
    html += '</p>';

    if (lihtc.flags.has_130_boost) {
      html += '<p><strong>130% Eligible Basis Boost.</strong> The project is located in a Qualified Census Tract (QCT) '
        + 'or Difficult Development Area (DDA), making the eligible basis 130% of construction/rehab cost basis under § 42(d)(5)(B). '
        + 'This increases the LIHTC yield by 30% over a non-boosted project &mdash; a material economics driver in high-cost '
        + 'or distressed-tract developments.</p>';
    }

    // Compliance period
    html += '<p><strong>Compliance period.</strong> Initial 15-year compliance period under § 42(i)(1); '
      + 'state-required Extended Use Agreement typically adds an additional ' + esc(state.lihtc_extended_use_period || '15')
      + ' years (' + esc(String(lihtc.flags.total_compliance_years)) + ' total). '
      + 'During the compliance period, the project must remain at or below the elected income limit '
      + '(20-50, 40-60, or income-averaging under § 42(g)(1)(C)) with units rent-restricted under § 42(g)(2). '
      + 'Non-compliance triggers recapture of accelerated credits under § 42(j) plus interest.</p>';

    if (lihtc.flags.recapture_concern_raised) {
      html += '<p class="memo-flag"><strong>Recapture concern flagged.</strong> '
        + 'The practitioner has raised a § 42(j) recapture concern. Recapture is calculated based on the proportion of credits '
        + 'taken (the &ldquo;accelerated&rdquo; portion) for the unit-years that fall out of compliance. '
        + 'In a partnership LIHTC, the LP investor faces recapture pro rata to its credit allocation. Cure provisions under '
        + '§ 42(g)(1)(B) (next-available-unit rule) and § 42(d)(7) (casualty loss) provide narrow relief windows. '
        + 'Compliance monitoring documentation should be confirmed before final structuring.</p>';
    }

    // Twinned state / historic
    if (lihtc.flags.has_state_credits || lihtc.flags.has_historic_credits) {
      html += '<p><strong>Twinned credits.</strong> ';
      if (lihtc.flags.has_state_credits) {
        html += 'State LIHTCs accompany the federal credits. State credit structures vary by jurisdiction &mdash; some are '
          + 'directly allocable like federal (CA / NY style); others are sold/transferred separately (GA / MO). The investor '
          + 'composition (federal-only investor vs. state-credit-purchaser) may differ. ';
      }
      if (lihtc.flags.has_historic_credits) {
        html += 'Section 47 historic rehabilitation credit is twinned with the LIHTC &mdash; common in adaptive-reuse projects '
          + '(historic schools, hospitals, manufacturing buildings converted to affordable housing). The § 47 credit is taken '
          + 'ratably over 5 years post-TCJA (changed from immediate prior). The historic credit and LIHTC investor are often '
          + 'the same party (institutional CRA-motivated bank).';
      }
      html += '</p>';
    }

    // Typical partnership structure
    html += '<p><strong>Typical partnership structure.</strong> '
      + 'Tax-credit investor LP (typically 99.99% of credits, losses, and tax-affected residuals); '
      + 'developer/general partner (0.01% capital + development fee + post-credit cash-flow promote); '
      + '§ 704(b) economic-effect-tested allocations of the credits and losses; '
      + 'qualified income offset and minimum gain chargeback provisions; '
      + '15-year credit period followed by Year 15 exit (typically GP buyout of LP at FMV with floor). '
      + 'Investor pricing reflects target after-tax yield (typically 4&ndash;7% post-tax IRR on credit equity).</p>';
  }

  // ----- Solar tax-equity -----
  if (solar && solar.present) {
    html += '<h3 class="memo-h3">' + nextLetter() + '. § 48 ITC Solar Tax-Equity Structure</h3>'
      + '<p><strong>Authority.</strong> I.R.C. § 48E (clean electricity investment credit, for property placed in service after 2024; § 48 for earlier property), 30% base rate; '
      + '§ 48(a)(13) (domestic content adder); § 48(a)(14) (energy community adder); '
      + '§ 48(e) (low-income community adder); '
      + 'I.R.C. § 6418 (transferability election, post-IRA 2022); '
      + 'Rev. Proc. 2007-65 (partnership flip safe harbor — solar). '
      + 'The Inflation Reduction Act of 2022 (P.L. 117-169) substantially reset the solar credit structure: '
      + '30% base rate permanently (was 26% / phasing-down pre-IRA); '
      + 'three 10% adders for energy-community / domestic-content / low-income; '
      + 'and § 6418 transferability allowing a direct sale of the credit to an unrelated transferee &mdash; '
      + 'a meaningful structural alternative to the partnership flip.</p>'
    + '<p class="memo-flag"><strong>OBBBA (P.L. 119-21, July 4, 2025) changed the horizon.</strong> For wind and solar, the § 48E credit is terminated for facilities placed in service after December 31, 2027 unless construction began on or before July 4, 2026 (twelve months after enactment), with beginning-of-construction determined under the tightened standards Treasury announced in 2025 (Notice 2025-42 and successors). Credits are also denied where the taxpayer is a prohibited foreign entity or receives material assistance from one under the FEOC rules, phased in from 2026, and § 6418 transfers to prohibited foreign entities are barred. Any solar tax-equity or transferability structure modeled here must be tested against the placed-in-service and beginning-of-construction dates before the economics are relied upon.</p>';

    // Structure
    if (solar.flags.is_partnership_flip) {
      html += '<h4 class="memo-h4">Partnership Flip Structure</h4>'
        + '<p><strong>Pre-flip allocation.</strong> Tax-equity investor receives ' + esc(state.solar_pre_flip_investor_pct || '99')
        + '% of tax items (ITC, depreciation, taxable income/loss) until flip. '
        + '<strong>Post-flip allocation.</strong> Investor drops to ' + esc(state.solar_post_flip_investor_pct || '5') + '%; sponsor takes 95% post-flip. '
        + '<strong>Flip trigger.</strong> ' + (state.solar_flip_trigger === 'time_based' ? 'Time-based — fixed date (typically Year 5 or 6 to complete the § 50 recapture period)'
          : state.solar_flip_trigger === 'hybrid' ? 'Hybrid — IRR hurdle plus minimum time (Year 5 floor; flip at earlier of IRR or Year 7)'
          : 'IRR-hurdle — investor reaches ' + esc(state.solar_target_irr_pct || '8') + '% post-tax IRR; flip occurs automatically') + '. '
        + 'The Rev. Proc. 2007-65 safe harbor governs partnership-flip economic substance: '
        + 'sponsor must retain meaningful upside post-flip; investor cannot receive guaranteed returns; '
        + 'put/call rights must be at FMV with floor. Modern flips routinely satisfy the safe-harbor framework.</p>';
    }
    if (solar.flags.is_transfer_election) {
      html += '<h4 class="memo-h4">§ 6418 Transferability Election</h4>'
        + '<p>Post-IRA § 6418 permits the project owner (typically the sponsor or its single-member LLC) to '
        + 'transfer the ITC (and certain other clean-energy credits) to an unrelated transferee via election. '
        + 'The transferee pays cash for the credit (typically 92&ndash;95¢ per $1 of credit at current market); '
        + 'the project owner avoids the partnership-flip complexity but accepts the discount. '
        + 'Practical advantages: simpler closing; no investor partner in the deal; sponsor retains 100% of cash economics. '
        + 'Practical disadvantages: cash discount on credit value; no depreciation pass-through to transferee (depreciation stays with project owner); '
        + 'transferee must be unrelated (related-party transfers disallowed under § 6418(a)). '
        + 'Pre-filing election required; transferee identification must be set by tax-return filing date. '
        + 'Recapture under § 50 remains with the project owner notwithstanding the transfer.</p>';
    }
    if (solar.flags.is_sale_leaseback) {
      html += '<h4 class="memo-h4">Sale-Leaseback Structure</h4>'
        + '<p>Sale-leaseback (more common for fuel cells and some solar) transfers ITC ownership to a lessor (investor); '
        + 'sponsor leases the system back from the lessor. Less common than partnership flip but used for very large projects '
        + 'or for sponsors who can monetize the depreciation separately. Post-IRA, § 6418 transferability has reduced sale-leaseback usage.</p>';
    }

    // Adders
    if (solar.flags.adder_count > 0) {
      html += '<h4 class="memo-h4">ITC Adders</h4>'
        + '<p>Total ITC rate with adders: <strong>' + esc(String(solar.flags.total_itc_pct)) + '%</strong> '
        + '(30% base + ' + esc(String(solar.flags.adder_count)) + ' adder' + (solar.flags.adder_count === 1 ? '' : 's') + ').</p>'
        + '<ul>';
      if (solar.flags.has_energy_community_adder) {
        html += '<li><strong>Energy Community Adder (+10%, § 48(a)(14)).</strong> '
          + 'Project located in (a) a brownfield site as defined in 42 U.S.C. § 9601(39), (b) a statistical area with significant '
          + 'employment in fossil-fuel industries and unemployment ≥ national average, or (c) a census tract where a coal mine '
          + 'closed after 1999 or a coal-fired electric generating unit was retired after 2009. The adder doubles for the '
          + 'first 5 GW of facility installations meeting the criteria. Notice 2023-29 governs eligibility.</li>';
      }
      if (solar.flags.has_domestic_content_adder) {
        html += '<li><strong>Domestic Content Adder (+10%, § 48(a)(13)).</strong> '
          + 'All structural steel and iron 100% domestically produced (per FTA-style domestic content rules); '
          + 'manufactured products threshold (initially 40%, ratcheting up annually). Notice 2023-38 and Notice 2024-41 '
          + 'provide compliance safe harbors and good-faith effort defenses.</li>';
      }
      if (solar.flags.has_low_income_adder) {
        html += '<li><strong>Low-Income Community Adder (+10% or +20%, § 48(e)).</strong> '
          + 'Project located in a low-income community or on tribal lands; allocated through annual capacity-allocation program '
          + 'administered by Treasury / DOE. Annual cap of 1.8 GW. +10% for low-income community / tribal location; '
          + '+20% for projects on qualified low-income residential buildings or providing financial benefit to low-income households.</li>';
      }
      html += '</ul>';
    }

    // Transferability vs. flip economics
    if (solar.flags.is_partnership_flip) {
      html += '<p><strong>Transferability vs. flip &mdash; structural choice.</strong> '
        + 'Practitioner has selected the partnership-flip structure. For comparison, an § 6418 transfer election would '
        + 'avoid the multi-year flip mechanics in exchange for accepting a 5&ndash;8% cash discount on credit value. '
        + 'Flip remains preferred when (a) project depreciation is substantial (only flip passes depreciation through to investor), '
        + '(b) investor seeks the partnership tax-shelter dynamics independent of credit value, or '
        + '(c) sponsor wants tax-equity investor as a long-term capital partner. Transfer election is preferred when the '
        + 'sponsor seeks structural simplicity, has alternative depreciation utilization, or the project size doesn\'t '
        + 'support the flip\'s fixed transaction costs.</p>';
    }
  }

  return html + '</section>';
}


function memoSectionQOZ(state, analysis) {
  const r = analysis.qoz;
  // v12.2 — section number depends on REIT presence:
  // No REIT → QOZ is Section X; REIT present → REIT is X, QOZ shifts to XI.
  const reitPresent = analysis.reit && analysis.reit.present;
  const sectionNumber = reitPresent ? 'XI' : 'X';
  let html = '<section class="memo-section">'
    + '<h2 class="memo-h2">' + sectionNumber + '. Qualified Opportunity Zone Investment Analysis</h2>';

  if (!r.present) {
    html += '<p><em>Not applicable: no Qualified Opportunity Zone investment is contemplated in the proposed structure. The analysis has considered and excluded the OZ 1.0 / OZ 2.0 regime analysis, the substantial-improvement test (Reg. § 1.1400Z2(d)-2(b)(4)), the 2026 dead-zone trap, and the post-OBBBA eligibility caveats (P.L. 119-21, July 4, 2025) on the present record.</em></p>';
    return html + '</section>';
  }

  // A. Statutory framework
  html += '<h3 class="memo-h3">A. Statutory Framework and OBBBA Enactment</h3>'
    + '<p><strong>Base statute.</strong> ' + esc(QOZ_RULES.baseStatute.rule) + ' ' + esc(QOZ_RULES.baseStatute.cite) + '.</p>'
    + '<p><strong>OBBBA enactment.</strong> ' + esc(QOZ_RULES.obbbaEnactment.rule) + ' ' + esc(QOZ_RULES.obbbaEnactment.cite) + '.</p>';

  // B. Regime determination
  html += '<h3 class="memo-h3">B. Regime Determination &mdash; OZ 1.0 vs OZ 2.0</h3>';
  if (r.regime === 'oz_1_0') {
    html += '<p>On the present record, the investment is governed by the <strong>OZ 1.0 regime</strong>. ' + esc(QOZ_RULES.oz1_vs_oz2.deferralOZ1_0) + ' Five- and seven-year basis step-ups (10% / 5%) are largely phased out by the fixed December 31, 2026 recognition date for investments made after the corresponding lookback windows. The post-investment appreciation exclusion at year 10 remains available under § 1400Z-2(c).</p>';
  } else {
    html += '<p>On the present record, the investment is governed by the <strong>OZ 2.0 regime</strong>. ' + esc(QOZ_RULES.oz1_vs_oz2.deferralOZ2_0) + '</p>'
      + '<p><strong>Basis step-up.</strong> ' + esc(QOZ_RULES.oz1_vs_oz2.basisStepUp_OZ2_0) + '</p>';
    if (r.flags.designation_eligibility_caveat) {
      html += '<p class="memo-flag"><strong>Eligibility caveat.</strong> ' + esc(QOZ_RULES.eligibilityChanges.rule) + ' ' + esc(QOZ_RULES.eligibilityChanges.cite) + '.</p>'
        + '<p><em>Practice point.</em> ' + esc(QOZ_RULES.eligibilityChanges.practicePoint) + '</p>';
    }
  }
  html += '<p><strong>Ten-year hold.</strong> ' + esc(QOZ_RULES.oz1_vs_oz2.holdingTen) + '</p>';

  // C. Substantial improvement
  html += '<h3 class="memo-h3">C. Substantial Improvement Test</h3>';
  if (r.flags.rural_qrof) {
    html += '<p>The investment is in a <strong>rural Qualified Opportunity Zone</strong>. The substantial-improvement threshold is therefore the OBBBA-codified 50% test. ' + esc(QOZ_RULES.substantialImprovement.ruralThreshold) + '</p>'
      + '<p><em>Practice point.</em> ' + esc(QOZ_RULES.substantialImprovement.practicePoint) + '</p>';
  } else {
    html += '<p>' + esc(QOZ_RULES.substantialImprovement.standardThreshold) + ' ' + esc(QOZ_RULES.substantialImprovement.cite) + '.</p>';
  }

  // D. 2026 Dead-Zone analysis
  if (r.flags.dead_zone_2026) {
    html += '<h3 class="memo-h3">D. 2026 Dead-Zone Trap</h3>'
      + '<p class="memo-flag"><strong>Dead-zone trigger.</strong> ' + esc(QOZ_RULES.deadZone2026.rule) + '</p>';
    if (r.flags.passthrough_workaround_available && r.workaroundFlag) {
      html += '<p><strong>Pass-through K-1 workaround available.</strong> ' + esc(r.workaroundFlag.rule) + '</p>'
        + '<p><em>Actionable.</em> ' + esc(r.workaroundFlag.actionable) + '</p>'
        + '<p><em>Practice point.</em> ' + esc(r.workaroundFlag.practicePoint) + '</p>';
    } else if (r.deadZoneFlag) {
      html += '<p class="memo-flag"><strong>Direct-recognition gain stuck.</strong> ' + esc(r.deadZoneFlag.rule) + '</p>'
        + '<p><em>Practice point.</em> ' + esc(r.deadZoneFlag.practicePoint) + '</p>';
    }
  }

  // E. QOZB requirements (if QOZB below QOF)
  if (r.inputs.qozb_below_qof) {
    html += '<h3 class="memo-h3">' + (r.flags.dead_zone_2026 ? 'E' : 'D') + '. QOZB Requirements</h3>'
      + '<p>' + esc(QOZ_RULES.qozbRequirements.rule) + ' ' + esc(QOZ_RULES.qozbRequirements.cite) + '.</p>';
  }

  return html + '</section>';
}

function memoThread3Notice(state, analysis) {
  // v13.3 — section number reflects all conditionally-rendered sections:
  // REIT (X if present), Specialty 1031 (after QOZ if DST or TIC), Tax Credits (LIHTC or Solar).
  const reitPresent = analysis && analysis.reit && analysis.reit.present;
  const specialty1031Present = analysis && (
    (analysis.dst && analysis.dst.present) ||
    (analysis.tic && analysis.tic.present)
  );
  const taxCreditsPresent = analysis && (
    (analysis.lihtc && analysis.lihtc.present) ||
    (analysis.solarTaxEquity && analysis.solarTaxEquity.present)
  );
  let sectionOffset = 0;
  if (reitPresent) sectionOffset++;
  if (specialty1031Present) sectionOffset++;
  if (taxCreditsPresent) sectionOffset++;
  const romanMap = { 0: 'XI', 1: 'XII', 2: 'XIII', 3: 'XIV' };
  const sectionNumber = romanMap[sectionOffset] || 'XI';
  return ''
    + '<section class="memo-section memo-thread-notice">'
    +   '<h2 class="memo-h2">' + sectionNumber + '. Scope Notice &mdash; What This Tool Covers</h2>'
    +   '<p>This memorandum is generated by the Structuring Tool published at donovan.law. '
    +   'The tool covers (investor identity routing across nine routes; check-the-box classification with per-se cross-check, treaty/LOB, and § 708(b)(2) division/merger; entity-classification recommendation; capital-structure characterization across related-party debt, management fee, mezzanine, and Qualified Opportunity Zone investment; structure diagram with sixteen-type legend; and downstream document-tool handoff) are operative as of the date above. '
    +   'The § 1402(a)(13) authority is current through September 4, 2026 (K Alain, L.L.L.P. v. Comm\'r, formerly Sirius Solutions, No. 24-60240 (5th Cir. Aug. 12, 2026) (substitute per curiam opinion on panel rehearing); Soroban II, T.C. Memo. 2025-52). '
    +   'The OBBBA QOZ 2.0 implementation reflects P.L. 119-21 (July 4, 2025); the OBBBA § 163(j) EBITDA-addback restoration and Rev. Proc. 2026-17 RPTB revocation window are reflected in the related-party debt module.</p>'
    +   '<p>This memorandum is an EDUCATIONAL ILLUSTRATION generated by a self-service tool published by Donovan Legal PLLC. It is not legal advice, has not been reviewed by counsel, and is not a structure to implement. No attorney-client relationship is created by use of this tool. Review with counsel before relying on any part of it: donovan.law/book.</p>'
    + '</section>';
}

function buildMemorandum(state) {
  const analysis = {
    entityClassification: analyzeEntityClassification(state),
    ctb: analyzeCTB(state),
    rpd: analyzeRelatedPartyDebt(state),
    mgmtFee: analyzeManagementFee(state),
    mezz: analyzeMezzanineDebt(state),
    qoz: analyzeQOZ(state),
    reit: analyzeREIT(state),
    sponsorTier: analyzeSponsorAndTier(state),
    dst: analyzeDST(state),
    tic: analyzeTIC(state),
    lihtc: analyzeLIHTC(state),
    solarTaxEquity: analyzeSolarTaxEquity(state)
  };
  // investorPanel surfaced at top level for downstream graph derivation
  analysis.investorPanel = analysis.entityClassification.investorPanel;

  // Derive graph + positions (auto-layout overlaid by user refinements)
  const graph = deriveStructureGraph(state, analysis);
  const autoPositions = autoLayout(graph);
  const userPositions = (state.diagram && state.diagram.positions) || {};
  const positions = {};
  graph.nodes.forEach(function (n) {
    positions[n.id] = userPositions[n.id] || autoPositions[n.id] || { x: 0, y: 0 };
  });
  analysis.graph = graph;
  analysis.positions = positions;

  const html = ''
    + '<article class="memo-document">'
    +   memoHeader(state)
    +   memoDisclaimer()
    +   memoExecutiveSummary(state, analysis)
    +   memoInvestorIdentitySection(state, analysis)
    +   memoCTBSection(state, analysis)
    +   memoEntityClassificationRecommendation(state, analysis)
    +   memoSectionSponsorTier(state, analysis)
    +   memoStructureDiagram(state, analysis)
    +   memoCapitalStructureIntro(state, analysis)
    +   memoSectionRPD(state, analysis)
    +   memoSectionMgmtFee(state, analysis)
    +   memoSectionMezz(state, analysis)
    +   memoSectionREIT(state, analysis)         // v12.2 — Section X when reit_present
    +   memoSectionQOZ(state, analysis)          // Section X or XI depending on REIT presence
    +   memoSectionSpecialty1031(state, analysis)  // v13.2 — DST + TIC § 1031 specialty
    +   memoSectionTaxCredits(state, analysis)     // v13.3 — LIHTC + Solar tax-equity
    +   (state.include_thread2_only_notice ? memoThread3Notice(state, analysis) : '')
    + '</article>';

  return { title: 'Structuring Memorandum', html: html, analysis: analysis };
}

function buildDocumentSet(state) {
  return {
    memorandum: buildMemorandum(state)
  };
}

// =============================================================================
// REVIEW SUMMARY — for UI display before generation
// =============================================================================
function generateReviewSummary(state) {
  const warnings = [];
  const inv = analyzeInvestorPanel(state);
  if (!state.project_name) warnings.push('Project name has not been set.');
  if (!state.jurisdiction) warnings.push('Formation jurisdiction has not been selected.');
  if (inv.count === 0) warnings.push('No investors have been added. The memorandum cannot be meaningfully generated.');
  if (state.proposed_entity_type === 'foreign_eligible' && !state.proposed_entity_country) {
    warnings.push('Proposed entity is foreign, but the country has not been specified.');
  }
  if (state.proposed_entity_type === 'foreign_per_se' && !state.proposed_entity_country) {
    warnings.push('Proposed entity is per se foreign, but the country has not been specified.');
  }
  if (state.proposed_entity_type === 'foreign_per_se' && state.proposed_entity_country && !isPerSeJurisdiction(state.proposed_entity_country)) {
    warnings.push('Country "' + state.proposed_entity_country + '" is not enumerated in this tool\'s per se list; verify against current Reg. § 301.7701-2(b)(8) text.');
  }
  if (state.ctb_timing === 'late_relief' && !state.late_relief_intended_effective) {
    warnings.push('Late-relief is selected but the intended effective date has not been set.');
  }
  if (state.treaty_country && state.treaty_lob_test === 'not_applicable') {
    warnings.push('A treaty country is specified but no LOB test has been claimed; treaty benefits cannot be relied on without a satisfied LOB test.');
  }
  if (inv.flags.qfpf_blocker_conflict) {
    warnings.push('Investor panel includes a QFPF and at least one investor for whom a blocker is recommended — § 897(l) exemption is destroyed by blocker interposition; structural resolution required.');
  }
  return { warnings: warnings, investorCount: inv.count, routeCount: Object.keys(inv.routeCounts).length };
}

// =============================================================================
// UI BINDINGS (browser only)
// =============================================================================
// Engine is testable from Node without a DOM. UI bindings below run on
// DOMContentLoaded and only in browser context.
// =============================================================================

let toolState;
if (typeof window !== 'undefined') {
  toolState = defaultState();
}

const STORAGE_KEY = 'donovan_legal_structuring_draft_v1';

function saveStateToStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toolState));
    }
  } catch (e) { /* silent */ }
}
function loadStateFromStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    const fresh = defaultState();
    Object.keys(obj).forEach(function (k) { fresh[k] = obj[k]; });
    toolState = fresh;
  } catch (e) { /* silent */ }
}
function clearStorage() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* silent */ }
}

function showPanel(panelKey) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.struct-panel').forEach(function (p) {
    p.classList.toggle('struct-panel-active', p.getAttribute('data-panel') === panelKey);
  });
  document.querySelectorAll('.struct-nav-item').forEach(function (n) {
    n.classList.toggle('struct-nav-active', n.getAttribute('data-panel') === panelKey);
  });
  if (panelKey === 'generate') {
    refreshReviewSummary();
  }
  if (panelKey === 'investors') {
    refreshInvestorList();
  }
  if (panelKey === 'capital') {
    renderMezzFactorGrid();
    handleConditionalDisplay();
  }
  if (panelKey === 'diagram') {
    renderDiagramPanel();
  }
}

function bindNav() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.struct-nav-item').forEach(function (n) {
    n.addEventListener('click', function (e) {
      e.preventDefault();
      showPanel(n.getAttribute('data-panel'));
    });
  });
  document.querySelectorAll('[data-next]').forEach(function (b) {
    b.addEventListener('click', function () { showPanel(b.getAttribute('data-next')); });
  });
  document.querySelectorAll('[data-prev]').forEach(function (b) {
    b.addEventListener('click', function () { showPanel(b.getAttribute('data-prev')); });
  });
}

function populateJurisdictions() {
  if (typeof document === 'undefined') return;
  const sel = document.getElementById('jurisdiction');
  if (!sel) return;
  sel.innerHTML = STATE_CODES.map(function (c) {
    const s = STATES[c];
    return '<option value="' + c + '">' + esc(s.name) + ' (' + c + ')</option>';
  }).join('');
}

function bindSimpleFields() {
  if (typeof document === 'undefined') return;
  // Text/select/date/number fields (value-typed)
  ['project_name', 'jurisdiction', 'asset_type', 'asset_location_state', 'deal_size', 'properties_count', 'effective_date', 'matter_no',
   'proposed_entity_type', 'proposed_entity_country', 'proposed_member_count', 'foreign_liability_all_limited',
   'ctb_election', 'ctb_timing', 'late_relief_intended_effective', 'treaty_country', 'treaty_lob_test',
   'section_708_b2_applicable', 'section_708_b2_notes',
   // v12.1 — blocker-strategy fields
   'blocker_strategy', 'blocker_intermediate_jurisdiction',
   // v12.2 — REIT fields
   'reit_domestically_controlled', 'reit_public_or_private', 'reit_structure',
   'reit_us_ownership_pct', 'reit_distribution_compliance',
   // v13.0 — Sponsor + Tier fields (value-typed)
   'sponsor_structure', 'sponsor_mgmt_co_form', 'sponsor_gp_form',
   'tier_structure', 'tier_holdco_rationale', 'tier_propco_rationale',
   // v13.2 — DST + TIC value-typed fields
   'dst_exchanger_count', 'tic_owner_count',
   // v13.3 — LIHTC + Solar value-typed fields
   'lihtc_credit_type', 'lihtc_qualified_basis_calc', 'lihtc_compliance_period_years',
   'lihtc_extended_use_period', 'lihtc_yield_to_investor_target_pct',
   'solar_tax_equity_structure', 'solar_itc_base_rate_pct',
   'solar_pre_flip_investor_pct', 'solar_post_flip_investor_pct',
   'solar_flip_trigger', 'solar_target_irr_pct',
   // Thread 2 — value-typed fields
   'rpd_lender_type', 'rpd_principal', 'rpd_rate', 'rpd_maturity_years', 'rpd_recourse_treatment',
   'mgmt_fee_recipient_type', 'mgmt_fee_amount_basis', 'mgmt_fee_amount',
   'mgmt_fee_characterization_intended', 'mgmt_fee_fee_waiver_risk_assessment', 'mgmt_fee_forum_jurisdiction',
   'mezz_principal', 'mezz_stated_rate', 'mezz_maturity_years', 'mezz_subordination',
   // Thread 3 — QOZ value-typed fields
   'qoz_gain_realization_date', 'qoz_gain_source', 'qoz_designation_regime',
   'qoz_holding_period_target', 'qoz_passthrough_180day_election'].forEach(function (key) {
    const el = document.getElementById(key);
    if (!el) return;
    el.addEventListener('change', function () { toolState[key] = el.value; saveStateToStorage(); handleConditionalDisplay(); });
    el.addEventListener('input', function () { toolState[key] = el.value; saveStateToStorage(); handleConditionalDisplay(); });
  });
  // Checkbox fields (boolean-typed)
  ['hybrid_concerns',
   // v12.1 — blocker intermediate toggle
   'blocker_use_intermediate',
   // v12.2 — REIT boolean fields
   'reit_present', 'reit_trs_present', 'reit_uprt_contribution_planned', 'reit_share_class_5pct_test_concern',
   // v13.0 — Sponsor + Tier boolean fields
   'sponsor_present', 'sponsor_carry_in_separate_vehicle', 'sponsor_family_office_above',
   // v13.2 — DST + TIC boolean fields
   'dst_present', 'dst_sponsor_offering', 'dst_offering_closed', 'dst_can_renegotiate_debt',
   'dst_can_reinvest_proceeds', 'dst_capex_restricted_to_normal', 'dst_reserves_short_term_us_debt_only',
   'dst_distributions_at_least_annual', 'dst_springing_llc_provision', 'dst_master_lease_present',
   'tic_present', 'tic_unanimity_for_major_decisions', 'tic_management_agreement_annual',
   'tic_proportionate_profit_loss_sharing', 'tic_proportionate_debt_sharing', 'tic_individual_transfer_rights',
   'tic_lender_consent_required', 'tic_sponsor_payments_fmv', 'tic_business_activities_minimal',
   // v13.3 — LIHTC + Solar boolean fields
   'lihtc_present', 'lihtc_state_credits_present', 'lihtc_historic_credits_present', 'lihtc_recapture_risk_concern',
   'solar_tax_equity_present', 'solar_energy_community_adder', 'solar_domestic_content_adder',
   'solar_low_income_adder', 'solar_transferability_election',
   // Thread 2 — boolean fields
   'has_related_party_debt', 'rpd_terms_arm_length', 'rpd_section_163j_concerned', 'rpd_rptb_election',
   'rpd_385_documentation_complete', 'rpd_anti_conduit_concern', 'rpd_ahydo_concern',
   'mgmt_fee_present', 'mgmt_fee_arm_length', 'mgmt_fee_fee_waiver_present', 'mgmt_fee_se_tax_concern',
   'mezz_present', 'mezz_paid_in_kind', 'mezz_equity_kicker',
   // Thread 3 — QOZ boolean fields
   'qoz_present', 'qoz_rural', 'qoz_qozb_below_qof', 'qoz_substantial_improvement_planned'].forEach(function (key) {
    const el = document.getElementById(key);
    if (!el) return;
    el.addEventListener('change', function () { toolState[key] = !!el.checked; saveStateToStorage(); handleConditionalDisplay(); });
  });
}

function handleConditionalDisplay() {
  if (typeof document === 'undefined') return;
  // Foreign entity country block
  const foreignCountryBlock = document.getElementById('foreign_country_block');
  if (foreignCountryBlock) {
    foreignCountryBlock.style.display = (toolState.proposed_entity_type === 'foreign_eligible' || toolState.proposed_entity_type === 'foreign_per_se') ? '' : 'none';
  }
  // Foreign liability block (eligibles only)
  const foreignLiabilityBlock = document.getElementById('foreign_liability_block');
  if (foreignLiabilityBlock) {
    foreignLiabilityBlock.style.display = (toolState.proposed_entity_type === 'foreign_eligible') ? '' : 'none';
  }
  // Late-relief block
  const lateBlock = document.getElementById('late_relief_block');
  if (lateBlock) {
    lateBlock.style.display = (toolState.ctb_timing === 'late_relief') ? '' : 'none';
  }
  // § 708 notes block
  const s708Block = document.getElementById('s708_notes_block');
  if (s708Block) {
    s708Block.style.display = (toolState.section_708_b2_applicable && toolState.section_708_b2_applicable !== 'none') ? '' : 'none';
  }

  // v12.1 — intermediate-jurisdiction field only shown when intermediate is enabled
  const intermJurField = document.getElementById('blocker_intermediate_jurisdiction_field');
  if (intermJurField) {
    intermJurField.style.display = (toolState.blocker_use_intermediate === true) ? '' : 'none';
  }

  // Thread 2 — subpanel collapse based on "present" toggles
  applySubpanelCollapse('rpd', toolState.has_related_party_debt);
  applySubpanelCollapse('mgmt_fee', toolState.mgmt_fee_present);
  applySubpanelCollapse('mezz', toolState.mezz_present);
  // v12.2 — REIT subpanel
  applySubpanelCollapse('reit', toolState.reit_present);
  // Thread 3 — QOZ subpanel
  applySubpanelCollapse('qoz', toolState.qoz_present);
  // v13.0 — Sponsor + Tier subpanels
  applySubpanelCollapse('sponsor', toolState.sponsor_present);
  // tier_present is a UI-side convenience flag — its collapse mirrors whether tier_structure is non-flat
  applySubpanelCollapse('tier', toolState.tier_structure && toolState.tier_structure !== 'flat');

  // Within mgmt fee — fee-waiver-only fields
  const waiverBlock = document.getElementById('mgmt_fee_waiver_block');
  if (waiverBlock) {
    waiverBlock.style.display = (toolState.mgmt_fee_present && toolState.mgmt_fee_fee_waiver_present) ? '' : 'none';
  }
  // Within mgmt fee — forum selector visible only if SE tax concern is in play
  const forumBlock = document.getElementById('mgmt_fee_forum_block');
  if (forumBlock) {
    forumBlock.style.display = (toolState.mgmt_fee_present && toolState.mgmt_fee_se_tax_concern) ? '' : 'none';
  }
}

function applySubpanelCollapse(key, present) {
  if (typeof document === 'undefined') return;
  const el = document.querySelector('.struct-subpanel[data-subpanel="' + key + '"]');
  if (!el) return;
  if (present) {
    el.classList.remove('struct-subpanel-collapsed');
  } else {
    el.classList.add('struct-subpanel-collapsed');
  }
}

// Thread 2 — 13-factor scoring grid
function renderMezzFactorGrid() {
  if (typeof document === 'undefined') return;
  const grid = document.getElementById('mezz_factor_grid');
  if (!grid) return;
  const factors = MEZZ_RULES.thirteenFactorTest.factors;
  const scores = toolState.mezz_thirteen_factor_scores || {};
  grid.innerHTML = factors.map(function (f, i) {
    const v = (scores[f.key] != null) ? scores[f.key] : 3;
    return '<div class="struct-factor-row">'
      + '<label for="mezz_score_' + f.key + '" title="' + esc(f.summary) + '">'
      + (i + 1) + '. ' + esc(f.label)
      + '</label>'
      + '<select id="mezz_score_' + f.key + '" data-factor="' + f.key + '">'
      + [1, 2, 3, 4, 5].map(function (n) {
          return '<option value="' + n + '"' + (n === v ? ' selected' : '') + '>' + n + '</option>';
        }).join('')
      + '</select>'
      + '</div>';
  }).join('');
  // Bind each score selector
  grid.querySelectorAll('select[data-factor]').forEach(function (sel) {
    sel.addEventListener('change', function () {
      const factor = sel.getAttribute('data-factor');
      if (!toolState.mezz_thirteen_factor_scores) toolState.mezz_thirteen_factor_scores = {};
      toolState.mezz_thirteen_factor_scores[factor] = Number(sel.value);
      saveStateToStorage();
    });
  });
}

function newInvestor() {
  return {
    id: 'inv_' + Math.random().toString(36).slice(2, 10),
    label: '',
    route: 'domestic_individual',
    country: '',
    trustSub: '',
    pct: ''
  };
}

function addInvestor() {
  toolState.investors.push(newInvestor());
  saveStateToStorage();
  refreshInvestorList();
}

function removeInvestor(id) {
  toolState.investors = toolState.investors.filter(function (i) { return i.id !== id; });
  saveStateToStorage();
  refreshInvestorList();
}

function refreshInvestorList() {
  if (typeof document === 'undefined') return;
  const c = document.getElementById('investor_list');
  if (!c) return;
  if (!toolState.investors.length) {
    c.innerHTML = '<p class="struct-empty"><em>No investors added yet. Add the first investor to begin identity-routing analysis.</em></p>';
    return;
  }
  const routeOpts = INVESTOR_ROUTE_KEYS.map(function (k) {
    return { v: k, label: INVESTOR_ROUTES[k].label };
  });
  let html = '';
  toolState.investors.forEach(function (inv, idx) {
    const r = INVESTOR_ROUTES[inv.route];
    const showsCountry = (inv.route === 'foreign_individual' || inv.route === 'foreign_corporation' || inv.route === 'per_se_foreign_corp' || inv.route === 'foreign_pension' || inv.route === 'swf' || inv.route === 'foreign_trust');
    const showsSub = !!(r && r.subRoutes);
    html += '<div class="struct-investor-row" data-id="' + esc(inv.id) + '">'
      + '<div class="struct-investor-hdr">'
      +   '<div class="struct-investor-no">Investor ' + (idx + 1) + '</div>'
      +   '<button class="struct-btn-ghost struct-btn-warn" data-action="remove">Remove</button>'
      + '</div>'
      + '<div class="struct-field-grid">'
      +   '<div class="struct-field"><label>Name / Reference</label>'
      +     '<input type="text" data-ifield="label" value="' + esc(inv.label) + '" placeholder="e.g., Sponsor A; Trust X; Pension Fund Y" /></div>'
      +   '<div class="struct-field"><label>Approx. Equity %</label>'
      +     '<input type="number" data-ifield="pct" value="' + esc(inv.pct) + '" placeholder="0" min="0" max="100" step="0.01" /></div>'
      +   '<div class="struct-field struct-field-wide"><label>Identity Route</label>'
      +     '<select data-ifield="route">'
      +     routeOpts.map(function (o) { return '<option value="' + o.v + '"' + (o.v === inv.route ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('')
      +     '</select></div>';
    if (showsCountry) {
      html += '<div class="struct-field"><label>Country / Jurisdiction</label>'
        +     '<input type="text" data-ifield="country" value="' + esc(inv.country) + '" placeholder="e.g., Germany; Cayman; Saudi Arabia" /></div>';
    }
    if (showsSub) {
      const subOpts = Object.keys(r.subRoutes).map(function (k) { return { v: k, label: r.subRoutes[k].label }; });
      html += '<div class="struct-field"><label>Sub-route</label>'
        +     '<select data-ifield="trustSub">'
        +     '<option value=""' + (!inv.trustSub ? ' selected' : '') + '>— Select —</option>'
        +     subOpts.map(function (o) { return '<option value="' + o.v + '"' + (o.v === inv.trustSub ? ' selected' : '') + '>' + esc(o.label) + '</option>'; }).join('')
        +     '</select></div>';
    }
    // Foreign grantor trust — surface U.S.-grantor sub-conditional
    // (Reg. § 301.7701-7 + § 679: if grantor is a U.S. person, domestic-trust
    // analysis controls; investor routes direct, not through blocker.)
    if (inv.route === 'foreign_trust' && inv.trustSub === 'grantor') {
      html += '<div class="struct-field struct-field-wide">'
        +     '<label class="struct-check-toggle">'
        +       '<input type="checkbox" data-ifield="grantor_is_us_person"' + (inv.grantor_is_us_person ? ' checked' : '') + ' />'
        +       ' Grantor is a U.S. person (§ 679 applies; domestic-trust analysis controls — routes direct, not through blocker)'
        +     '</label>'
        +     '</div>';
    }
    html += '</div>'
      + '<p class="struct-route-blurb"><em>' + esc(r ? r.blurb : '') + '</em></p>'
      + '</div>';
  });
  c.innerHTML = html;

  // Bind input handlers
  c.querySelectorAll('.struct-investor-row').forEach(function (row) {
    const id = row.getAttribute('data-id');
    row.querySelectorAll('[data-ifield]').forEach(function (input) {
      const f = input.getAttribute('data-ifield');
      const h = function () {
        const inv = toolState.investors.find(function (x) { return x.id === id; });
        if (!inv) return;
        if (f === 'pct') {
          inv[f] = input.value === '' ? '' : Number(input.value);
        } else if (input.type === 'checkbox') {
          inv[f] = !!input.checked;
        } else {
          inv[f] = input.value;
        }
        saveStateToStorage();
        if (f === 'route' || f === 'trustSub') refreshInvestorList();  // re-render to show/hide conditional fields
      };
      input.addEventListener('change', h);
      input.addEventListener('input', h);
    });
    row.querySelector('[data-action="remove"]').addEventListener('click', function () {
      if (confirm('Remove this investor?')) removeInvestor(id);
    });
  });
}

function refreshReviewSummary() {
  if (typeof document === 'undefined') return;
  const c = document.getElementById('review_summary');
  if (!c) return;
  const sum = generateReviewSummary(toolState);
  let html = '<div class="struct-summary-line"><strong>Project:</strong> ' + esc(toolState.project_name || 'not specified') + '</div>'
    + '<div class="struct-summary-line"><strong>Jurisdiction:</strong> ' + esc(stateInfo(toolState.jurisdiction).name) + '</div>'
    + '<div class="struct-summary-line"><strong>Investors:</strong> ' + sum.investorCount + ' across ' + sum.routeCount + ' identity ' + (sum.routeCount === 1 ? 'route' : 'routes') + '</div>'
    + '<div class="struct-summary-line"><strong>Proposed entity:</strong> ' + esc(({
        us_llc: 'U.S. LLC',
        foreign_eligible: 'Foreign eligible entity',
        foreign_per_se: 'Per se foreign corporation'
      }[toolState.proposed_entity_type] || 'not specified')) + '</div>';
  if (sum.warnings.length) {
    html += '<div class="struct-warnings"><strong>Warnings:</strong>' + ulFromArray(sum.warnings) + '</div>';
  } else {
    html += '<div class="struct-summary-ok">All required inputs are set. Ready to generate.</div>';
  }
  c.innerHTML = html;
}

function bindGenerate() {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('btn_generate');
  if (!btn) return;
  btn.addEventListener('click', function () {
    const docs = buildDocumentSet(toolState);
    const pane = document.getElementById('doc_preview');
    if (pane) pane.innerHTML = docs.memorandum.html;
    const wrap = document.getElementById('generated_docs');
    if (wrap) wrap.style.display = '';
    // Save downstream payload to localStorage for the receiving tool
    try {
      const payload = buildDownstreamPayload(toolState, docs.memorandum.analysis);
      window.localStorage.setItem('donovan_legal_structuring_outcome_v1', JSON.stringify(payload));
      // Update the "Continue to [Tool]" button label
      const lbl = document.getElementById('downstream_tool_label');
      if (lbl) lbl.textContent = payload.recommendedToolLabel || 'Downstream Tool';
    } catch (e) {
      // localStorage unavailable — silent failure; JSON export still works
    }
  });
  const printBtn = document.getElementById('btn_print_doc');
  if (printBtn) printBtn.addEventListener('click', function () { window.print(); });
  const copyBtn = document.getElementById('btn_copy_doc');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    const pane = document.getElementById('doc_preview');
    if (!pane) return;
    const text = pane.innerText || pane.textContent || '';
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text);
    }
  });
  // Thread 3 — Export JSON payload
  const exportBtn = document.getElementById('btn_export_json');
  if (exportBtn) exportBtn.addEventListener('click', function () {
    const docs = buildDocumentSet(toolState);
    const payload = buildDownstreamPayload(toolState, docs.memorandum.analysis);
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'structuring_outcome_' + (toolState.project_name || 'matter').replace(/[^a-zA-Z0-9_-]/g, '_') + '_' + new Date().toISOString().slice(0,10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });
  // Thread 3 — Continue to downstream tool
  const contBtn = document.getElementById('btn_continue_downstream');
  if (contBtn) contBtn.addEventListener('click', function () {
    const docs = buildDocumentSet(toolState);
    const payload = buildDownstreamPayload(toolState, docs.memorandum.analysis);
    try {
      window.localStorage.setItem('donovan_legal_structuring_outcome_v1', JSON.stringify(payload));
    } catch (e) { /* silent */ }
    // Resolve target URL based on recommended tool
    const downstreamMap = {
      single_member: 'tool-entity-formation.html',
      multi_eight: 'tool-entity-formation-multi.html',
      reserve_12_step: 'tool-operating-agreement.html'
    };
    const target = downstreamMap[payload.recommendedTool] || downstreamMap.reserve_12_step;
    window.location.href = target;
  });
}

// =============================================================================
// THREAD 3 — DIAGRAM PANEL UI
// =============================================================================
function renderDiagramPanel() {
  if (typeof document === 'undefined') return;
  const canvas = document.getElementById('diagram_canvas');
  if (!canvas) return;

  // Run lightweight analysis (just what the graph needs)
  const analysis = {
    entityClassification: analyzeEntityClassification(toolState),
    ctb: analyzeCTB(toolState),
    rpd: analyzeRelatedPartyDebt(toolState),
    mgmtFee: analyzeManagementFee(toolState),
    mezz: analyzeMezzanineDebt(toolState),
    qoz: analyzeQOZ(toolState),
    reit: analyzeREIT(toolState),
    sponsorTier: analyzeSponsorAndTier(toolState),
    dst: analyzeDST(toolState),
    tic: analyzeTIC(toolState),
    lihtc: analyzeLIHTC(toolState),
    solarTaxEquity: analyzeSolarTaxEquity(toolState)
  };
  analysis.investorPanel = analysis.entityClassification.investorPanel;

  const graph = deriveStructureGraph(toolState, analysis);
  const autoPositions = autoLayout(graph);
  // Overlay user positions onto auto-layout (user positions win)
  const userPositions = (toolState.diagram && toolState.diagram.positions) || {};
  const positions = {};
  graph.nodes.forEach(function (n) {
    positions[n.id] = userPositions[n.id] || autoPositions[n.id] || { x: 0, y: 0 };
  });

  // Mark panel as visited
  if (!toolState.diagram) toolState.diagram = { positions: {}, edge_overrides: {}, user_modified: false, visited: false };
  toolState.diagram.visited = true;
  saveStateToStorage();

  // Render (v13.1: pass chart title when a preset is active)
  canvas.innerHTML = renderInteractiveSVG(graph, positions, composeChartTitle(toolState));
  attachDiagramDragHandlers(graph);
  updateDiagramStatus();

  // Toolbar bindings (idempotent — replace existing listeners by cloning)
  const redrawBtn = document.getElementById('btn_diagram_redraw');
  if (redrawBtn && !redrawBtn.__bound) {
    redrawBtn.__bound = true;
    redrawBtn.addEventListener('click', function () {
      if (!confirm('Re-derive the structure from current Section 1\u20134 inputs? Any custom node positions will be discarded.')) return;
      toolState.diagram = { positions: {}, edge_overrides: {}, user_modified: false, visited: true };
      saveStateToStorage();
      renderDiagramPanel();
    });
  }
  const resetBtn = document.getElementById('btn_diagram_reset_layout');
  if (resetBtn && !resetBtn.__bound) {
    resetBtn.__bound = true;
    resetBtn.addEventListener('click', function () {
      toolState.diagram.positions = {};
      toolState.diagram.user_modified = false;
      saveStateToStorage();
      renderDiagramPanel();
    });
  }
}

function updateDiagramStatus() {
  if (typeof document === 'undefined') return;
  const el = document.getElementById('diagram_status');
  if (!el) return;
  if (toolState.diagram && toolState.diagram.user_modified) {
    el.textContent = 'Refined layout (user-modified)';
    el.className = 'struct-diagram-status struct-diagram-status-modified';
  } else {
    el.textContent = 'Auto-layout (deterministic)';
    el.className = 'struct-diagram-status';
  }
}

function attachDiagramDragHandlers(graph) {
  if (typeof document === 'undefined') return;
  const svg = document.querySelector('#diagram_canvas svg');
  if (!svg) return;
  // Bounds from the SVG's actual viewBox (auto-adjusts if dimensions grew for
  // high-investor-count layouts)
  const vb = (svg.getAttribute('viewBox') || '0 0 760 520').split(/\s+/);
  const W = parseFloat(vb[2]) || DIAGRAM_LAYOUT.canvasWidth;
  const H = parseFloat(vb[3]) || DIAGRAM_LAYOUT.canvasHeight;

  let dragState = null;

  function svgPoint(evt) {
    const pt = svg.createSVGPoint();
    pt.x = evt.clientX;
    pt.y = evt.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  }

  svg.addEventListener('mousedown', function (e) {
    const target = e.target;
    const nodeG = target.closest('g.struct-diagram-node');
    if (!nodeG) return;
    const nodeId = nodeG.getAttribute('data-node-id');
    if (!nodeId) return;
    const start = svgPoint(e);
    const transform = nodeG.getAttribute('transform') || '';
    const m = /translate\(\s*([-\d.]+)\s*,\s*([-\d.]+)\s*\)/.exec(transform);
    const startX = m ? parseFloat(m[1]) : 0;
    const startY = m ? parseFloat(m[2]) : 0;
    dragState = {
      nodeId: nodeId,
      nodeG: nodeG,
      startPointer: start,
      startX: startX,
      startY: startY,
      nodeWidth: (NODE_TYPES[nodeG.getAttribute('data-node-type')] || { width: 120 }).width,
      nodeHeight: (NODE_TYPES[nodeG.getAttribute('data-node-type')] || { height: 56 }).height
    };
    e.preventDefault();
  });

  document.addEventListener('mousemove', function (e) {
    if (!dragState) return;
    const cur = svgPoint(e);
    const dx = cur.x - dragState.startPointer.x;
    const dy = cur.y - dragState.startPointer.y;
    let newX = dragState.startX + dx;
    let newY = dragState.startY + dy;
    // Snap to grid
    newX = snapToGrid(newX);
    newY = snapToGrid(newY);
    // Bounds-clamp
    if (newX < 0) newX = 0;
    if (newY < 0) newY = 0;
    if (newX + dragState.nodeWidth > W) newX = W - dragState.nodeWidth;
    if (newY + dragState.nodeHeight > H) newY = H - dragState.nodeHeight;
    dragState.nodeG.setAttribute('transform', 'translate(' + newX + ',' + newY + ')');
    dragState.currentX = newX;
    dragState.currentY = newY;
  });

  document.addEventListener('mouseup', function () {
    if (!dragState) return;
    if (dragState.currentX != null) {
      if (!toolState.diagram) toolState.diagram = { positions: {}, edge_overrides: {}, user_modified: false, visited: true };
      toolState.diagram.positions[dragState.nodeId] = { x: dragState.currentX, y: dragState.currentY };
      toolState.diagram.user_modified = true;
      saveStateToStorage();
      updateDiagramStatus();
      // Re-render to recalculate edges
      renderDiagramPanel();
    }
    dragState = null;
  });
}

function bindStorageButtons() {
  if (typeof document === 'undefined') return;
  const s = document.getElementById('btn_save_state');
  const l = document.getElementById('btn_load_state');
  const c = document.getElementById('btn_clear_state');
  if (s) s.addEventListener('click', function () { saveStateToStorage(); flashMessage('Draft saved.'); });
  if (l) l.addEventListener('click', function () { loadStateFromStorage(); syncFieldsFromState(); refreshInvestorList(); flashMessage('Draft loaded.'); });
  if (c) c.addEventListener('click', function () {
    if (!confirm('Reset all inputs? This cannot be undone.')) return;
    toolState = defaultState();
    clearStorage();
    syncFieldsFromState();
    refreshInvestorList();
    flashMessage('Reset.');
  });
}

function bindAddInvestor() {
  if (typeof document === 'undefined') return;
  const b = document.getElementById('btn_add_investor');
  if (b) b.addEventListener('click', function () { addInvestor(); });
}

function syncFieldsFromState() {
  if (typeof document === 'undefined') return;
  Object.keys(toolState).forEach(function (k) {
    if (k === 'investors' || k === 'mezz_thirteen_factor_scores' || k === 'diagram') return;
    const el = document.getElementById(k);
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = !!toolState[k];
    } else {
      el.value = toolState[k] == null ? '' : toolState[k];
    }
  });
  handleConditionalDisplay();
}

function flashMessage(text) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('struct_flash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'struct_flash';
    el.className = 'struct-flash';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('struct-flash-show');
  setTimeout(function () { el.classList.remove('struct-flash-show'); }, 2200);
}

// =============================================================================
// PRESET BAR — v11.3 structural archetype presets
// =============================================================================
function renderPresetBar() {
  if (typeof document === 'undefined') return;
  const grid = document.getElementById('struct_preset_grid');
  if (!grid) return;
  grid.innerHTML = STRUCT_PRESET_KEYS.map(function (key) {
    const p = STRUCT_PRESETS[key];
    const qualityBadge = p.renderQuality === 'scaffold'
      ? '<span class="struct-preset-tile-badge struct-preset-tile-badge-scaffold" title="Limited render — entity-class-specific analytical module (DST / LIHTC / tax-equity flip) not yet built; deferred to v13.1+">limited</span>'
      : (p.renderQuality === 'partial'
          ? '<span class="struct-preset-tile-badge struct-preset-tile-badge-partial" title="Partial render — preset populates state; some structural features render but supporting analytical module is still being developed">partial</span>'
          : '');
    return ''
      + '<button class="struct-preset-tile" data-preset="' + esc(key) + '" title="' + esc(p.description) + '\u000A\u000A' + esc(p.authority) + '">'
      +   '<div class="struct-preset-tile-emoji">' + p.emoji + '</div>'
      +   '<div class="struct-preset-tile-label">' + esc(p.label) + qualityBadge + '</div>'
      +   '<div class="struct-preset-tile-desc">' + esc(p.description) + '</div>'
      +   '<div class="struct-preset-tile-cite">' + esc(p.authority) + '</div>'
      + '</button>';
  }).join('');
  // Bind click handlers
  grid.querySelectorAll('.struct-preset-tile').forEach(function (btn) {
    btn.addEventListener('click', function () {
      applyPresetToTool(btn.getAttribute('data-preset'));
    });
  });
}

function applyPresetToTool(presetKey) {
  if (typeof document === 'undefined') return;
  if (!STRUCT_PRESETS[presetKey]) return;
  toolState = applyPreset(presetKey);
  saveStateToStorage();
  syncFieldsFromState();
  refreshInvestorList();
  // Show toast + status banner
  const p = STRUCT_PRESETS[presetKey];
  const statusEl = document.getElementById('struct_preset_status');
  if (statusEl) {
    statusEl.textContent = 'Loaded archetype: ' + p.emoji + ' ' + p.label + '. Fields populated; customize as needed.';
    statusEl.style.display = '';
    statusEl.classList.add('struct-preset-status-active');
  }
  flashMessage('Loaded archetype: ' + p.label);
  showPanel('setup');
}

function handlePresetURLParam() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  // Look for ?preset=<key> in current URL
  const params = new URLSearchParams(window.location.search || '');
  const presetKey = params.get('preset');
  if (presetKey && STRUCT_PRESETS[presetKey]) {
    applyPresetToTool(presetKey);
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    if (!hasToolAccess()) return; // gate page is rendered by the HTML; engine stays idle
    populateJurisdictions();
    loadStateFromStorage();
    syncFieldsFromState();
    bindSimpleFields();
    bindNav();
    bindAddInvestor();
    bindStorageButtons();
    bindGenerate();
    refreshInvestorList();
    renderMezzFactorGrid();
    renderPresetBar();
    handleConditionalDisplay();
    showPanel('setup');
    // After initial init, check for ?preset=<key> URL parameter and apply if present
    handlePresetURLParam();
  });
}

// =============================================================================
// EXPORTS (for Node testing)
// =============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TIER, RAW_TIER,
    isPublic, isPlatinum, isReserve, isAtLeast, hasToolAccess,
    tierRank, TIER_LABEL,
    STATES, STATE_CODES, stateInfo,
    INVESTOR_ROUTES, INVESTOR_ROUTE_KEYS,
    PER_SE_LIST, isPerSeJurisdiction, getPerSeForm,
    CTB_RULES, TREATY_LOB, SECTION_708,
    RPD_RULES, MGMT_FEE_RULES, MEZZ_RULES,
    QOZ_RULES, NODE_TYPES, EDGE_KINDS, DIAGRAM_LAYOUT,
    STRUCT_PRESETS, STRUCT_PRESET_KEYS, applyPreset,
    // v12.0 visual-foundation helpers (exported for smoke)
    renderShapePrimitive, shapeBottomConnector, shapeTopConnector,
    orthogonalPath, orthogonalPathWithObstacles, buildLegendData, renderLegendSVG,
    defaultState,
    analyzeInvestor, analyzeInvestorPanel,
    analyzeCTB, analyzeEntityClassification,
    analyzeRelatedPartyDebt, analyzeManagementFee, analyzeMezzanineDebt,
    analyzeQOZ,
    analyzeREIT,
    analyzeSponsorAndTier,
    analyzeDST,
    analyzeTIC,
    analyzeLIHTC,
    analyzeSolarTaxEquity,
    deriveStructureGraph, autoLayout,
    renderSVG, renderInteractiveSVG, renderPrintSVG,
    composeChartTitle,
    snapToGrid, truncateLabel,
    buildDownstreamPayload,
    buildMemorandum, buildDocumentSet,
    generateReviewSummary,
    esc, formatCurrency
  };
}
