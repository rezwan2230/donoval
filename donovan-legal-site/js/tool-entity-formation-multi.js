/* Entity Formation — Multi-Member LLC (Simplified) — JavaScript Engine
 * Donovan Legal PLLC
 * Last updated: May 2026 (Phase 1 — Platinum/Reserve build)
 *
 * Architecture:
 *   - Three-tier ladder ('public' < 'platinum' < 'reserve') driven by
 *     window.__DONOVAN_TIER set inline in the HTML wrapper before this script
 *     loads. Gold members do not have access to this tool (they use the
 *     Single-Member tool); the engine treats 'gold' as public for gating.
 *   - Eight-step wizard (sidebar nav) producing three documents:
 *       (i) Operating Agreement
 *      (ii) Subscription Agreement
 *     (iii) Joinder Agreement
 *     plus, conditional on Securities Compliance Level:
 *       Level 0 — JV Securities Analysis Memo (Howey / Williamson)
 *       Level 1 — Risk Disclosure Letter (Reg D 506(b))
 *   - Single class of membership interests with optional preferred return.
 *   - Traditional allocations only (allocations follow Percentage Interests).
 *   - All-cash contributions only (no § 704(c) machinery in this tool;
 *     property contributions route to the Reserve 12-step tool).
 *   - Member soft cap: 10. Above 10 the UI warns but does not block.
 */

// =============================================================================
// TIER GATING — three-tier ladder
// =============================================================================
// public    rank 0 — open URL; no tool access (gate page only)
// platinum  rank 1 — full tool access
// reserve   rank 2 — full tool access (Reserve members also get the 12-step)
//
// Gold members are intentionally not on the ladder; the gold wrapper would
// resolve to 'public' here, and the tool would render the upgrade gate.
// =============================================================================
const RAW_TIER = (typeof window !== 'undefined' && window.__DONOVAN_TIER) || 'public';
// Normalize 'gold' → 'public' since Gold tier does not include this tool.
const TIER = (RAW_TIER === 'gold' || RAW_TIER === 'client') ? 'public' : RAW_TIER;
const TIER_RANK = { public: 0, platinum: 1, reserve: 2 };
function tierRank(t)   { return TIER_RANK[t] != null ? TIER_RANK[t] : 0; }
function isAtLeast(t)  { return tierRank(TIER) >= tierRank(t); }
function isPublic()    { return TIER === 'public'; }
function isPlatinum()  { return isAtLeast('platinum'); }
function isReserve()   { return isAtLeast('reserve'); }
function isMember()    { return isAtLeast('platinum'); }
const TIER_LABEL = { public: 'PUBLIC PREVIEW', platinum: 'PLATINUM', reserve: 'RESERVE' };

// =============================================================================
// STATES — ten-jurisdiction support
// =============================================================================
// Per partner directive: FL, DE, WY, TX, NY, CA, SC, NC, SD, NV.
// Each entry carries statute-citation hooks and feature flags used to
// parameterize the generated Operating Agreement.
// =============================================================================
const STATES = {
  FL: {
    name: 'Florida',
    fidElim: 'modified', // fiduciary-duty modification: full (DE §18-1101(c)) / broad / modified / restricted
    code: 'FL',
    actName: 'Florida Revised Limited Liability Company Act',
    actCite: 'Chapter 605, Florida Statutes',
    formationDocName: 'Articles of Organization',
    formationFilingOffice: 'Florida Department of State, Division of Corporations',
    filingFee: 125,
    annualReportDue: 'May 1',
    annualReportFee: 138.75,
    incomeTax: 'no',
    chargingOrderCite: 'Fla. Stat. § 605.0503',
    chargingOrderRule: 'exclusive remedy for multi-member LLC; Olmstead carve-out for single-member LLC does not apply here',
    freedomOfContractCite: 'Fla. Stat. § 605.0105',
    seriesAvailable: false,
    note: 'Florida is a "no-income-tax" state; useful for FL-resident principals. Annual report required by May 1. Olmstead does not reach multi-member LLCs.'
  },
  DE: {
    name: 'Delaware',
    fidElim: 'full', // fiduciary-duty modification: full (DE §18-1101(c)) / broad / modified / restricted
    code: 'DE',
    actName: 'Delaware Limited Liability Company Act',
    actCite: '6 Del. C. § 18-101 et seq.',
    formationDocName: 'Certificate of Formation',
    formationFilingOffice: 'Delaware Secretary of State, Division of Corporations',
    filingFee: 110,
    annualReportDue: 'June 1',
    annualReportFee: 400, // LLC annual tax; raised from $300 by HB 400 effective tax year 2026 (payable June 1, 2027)
    incomeTax: 'no_passthrough',
    chargingOrderCite: '6 Del. C. § 18-703',
    chargingOrderRule: 'charging order is the sole and exclusive remedy of a judgment creditor of a Member',
    freedomOfContractCite: '6 Del. C. § 18-1101',
    seriesAvailable: true,
    note: 'Delaware is the institutional default. § 18-1101(b) codifies freedom of contract; § 18-1101(c) permits broad elimination of fiduciary duties (except the implied covenant of good faith and fair dealing). Court of Chancery provides specialized commercial adjudication. Annual franchise tax: $300.'
  },
  WY: {
    name: 'Wyoming',
    fidElim: 'broad', // fiduciary-duty modification: full (DE §18-1101(c)) / broad / modified / restricted
    code: 'WY',
    actName: 'Wyoming Limited Liability Company Act',
    actCite: 'Wyo. Stat. §§ 17-29-101 et seq.',
    formationDocName: 'Articles of Organization',
    formationFilingOffice: 'Wyoming Secretary of State',
    filingFee: 100,
    annualReportDue: 'first day of the anniversary month of formation',
    annualReportFee: 60,
    incomeTax: 'no',
    chargingOrderCite: 'Wyo. Stat. § 17-29-503',
    chargingOrderRule: 'charging order is the sole and exclusive remedy; foreclosure is statutorily prohibited',
    freedomOfContractCite: 'Wyo. Stat. § 17-29-110',
    seriesAvailable: true,
    note: 'Wyoming offers strong charging-order protection (foreclosure barred) and asset-protection LLC features. No state income tax. Privacy-friendly (members not disclosed publicly).'
  },
  TX: {
    name: 'Texas',
    fidElim: 'broad', // fiduciary-duty modification: full (DE §18-1101(c)) / broad / modified / restricted
    code: 'TX',
    actName: 'Texas Business Organizations Code (LLC provisions)',
    actCite: 'Tex. Bus. Orgs. Code §§ 101.001 et seq.',
    formationDocName: 'Certificate of Formation',
    formationFilingOffice: 'Texas Secretary of State',
    filingFee: 300,
    annualReportDue: 'May 15 (Public Information Report; Franchise Tax Report)',
    annualReportFee: 0,
    incomeTax: 'franchise',
    chargingOrderCite: 'Tex. Bus. Orgs. Code § 101.112',
    chargingOrderRule: 'charging order is the exclusive remedy by which a judgment creditor may satisfy a judgment against a Member',
    freedomOfContractCite: 'Tex. Bus. Orgs. Code § 101.052',
    seriesAvailable: true,
    note: 'Texas has no personal income tax but imposes a franchise tax (margin tax) on entities with revenue above $2.47M (2026). Strong charging-order protection. Filing fee is high ($300) relative to peers.'
  },
  NY: {
    name: 'New York',
    fidElim: 'restricted', // fiduciary-duty modification: full (DE §18-1101(c)) / broad / modified / restricted
    code: 'NY',
    actName: 'New York Limited Liability Company Law',
    actCite: 'N.Y. Ltd. Liab. Co. L. § 101 et seq.',
    formationDocName: 'Articles of Organization',
    formationFilingOffice: 'New York Department of State, Division of Corporations',
    filingFee: 200,
    annualReportDue: 'biennial statement, every two years',
    annualReportFee: 9,
    incomeTax: 'yes',
    chargingOrderCite: 'N.Y. Ltd. Liab. Co. L. § 607',
    chargingOrderRule: 'charging order available; not expressly exclusive under statute',
    freedomOfContractCite: 'N.Y. Ltd. Liab. Co. L. § 417',
    seriesAvailable: false,
    note: 'New York imposes a publication requirement (LLC must publish in two newspapers for six weeks; cost $1,000–$2,000 in NYC). Annual LLC fee scales with gross income. Strict tax registration for nonresident members.'
  },
  CA: {
    name: 'California',
    fidElim: 'restricted', // fiduciary-duty modification: full (DE §18-1101(c)) / broad / modified / restricted
    code: 'CA',
    actName: 'California Revised Uniform Limited Liability Company Act',
    actCite: 'Cal. Corp. Code § 17701.01 et seq.',
    formationDocName: 'Articles of Organization (Form LLC-1)',
    formationFilingOffice: 'California Secretary of State',
    filingFee: 70,
    annualReportDue: 'Statement of Information every two years; Form 568 annually',
    annualReportFee: 20,
    incomeTax: 'yes',
    chargingOrderCite: 'Cal. Corp. Code § 17705.03',
    chargingOrderRule: 'charging order is the sole and exclusive remedy by which a judgment creditor may satisfy a judgment',
    freedomOfContractCite: 'Cal. Corp. Code § 17701.10',
    seriesAvailable: false,
    note: 'California imposes an $800 annual minimum franchise tax (waived only for first year of formation) plus a gross-receipts-based LLC fee on income over $250,000. Mandatory withholding on nonresident-member distributions. Plan accordingly for any CA-resident member or any property located in CA.'
  },
  SC: {
    name: 'South Carolina',
    fidElim: 'restricted', // fiduciary-duty modification: full (DE §18-1101(c)) / broad / modified / restricted
    code: 'SC',
    actName: 'South Carolina Uniform Limited Liability Company Act of 1996',
    actCite: 'S.C. Code Ann. §§ 33-44-101 et seq.',
    formationDocName: 'Articles of Organization',
    formationFilingOffice: 'South Carolina Secretary of State',
    filingFee: 110,
    annualReportDue: 'none (LLC not required to file annual report)',
    annualReportFee: 0,
    incomeTax: 'yes',
    chargingOrderCite: 'S.C. Code Ann. § 33-44-504',
    chargingOrderRule: 'charging order available; statute reserves court power to order foreclosure',
    freedomOfContractCite: 'S.C. Code Ann. § 33-44-103',
    seriesAvailable: false,
    note: 'South Carolina has no annual report or franchise tax for LLCs (manager-managed LLCs file a Form SC1065 if partnership-taxed). State income tax applies; nonresident-member withholding required. Useful for operators with Southeast property concentration.'
  },
  NC: {
    name: 'North Carolina',
    fidElim: 'modified', // fiduciary-duty modification: full (DE §18-1101(c)) / broad / modified / restricted
    code: 'NC',
    actName: 'North Carolina Limited Liability Company Act',
    actCite: 'N.C. Gen. Stat. §§ 57D-1-01 et seq.',
    formationDocName: 'Articles of Organization',
    formationFilingOffice: 'North Carolina Secretary of State',
    filingFee: 125,
    annualReportDue: 'April 15',
    annualReportFee: 200,
    incomeTax: 'yes',
    chargingOrderCite: 'N.C. Gen. Stat. § 57D-5-03',
    chargingOrderRule: 'charging order is the exclusive remedy of a judgment creditor of a Member',
    freedomOfContractCite: 'N.C. Gen. Stat. § 57D-2-30',
    seriesAvailable: false,
    note: 'North Carolina annual report fee is among the highest in the region ($200). State income tax 4.50% (2026); nonresident-member withholding required. Strong charging-order protection statutorily.'
  },
  SD: {
    name: 'South Dakota',
    fidElim: 'modified', // fiduciary-duty modification: full (DE §18-1101(c)) / broad / modified / restricted
    code: 'SD',
    actName: 'South Dakota Limited Liability Company Act',
    actCite: 'S.D. Codified Laws §§ 47-34A-101 et seq.',
    formationDocName: 'Articles of Organization',
    formationFilingOffice: 'South Dakota Secretary of State',
    filingFee: 150,
    annualReportDue: 'first day of the anniversary month of formation',
    annualReportFee: 50,
    incomeTax: 'no',
    chargingOrderCite: 'S.D. Codified Laws § 47-34A-504',
    chargingOrderRule: 'charging order is the exclusive remedy by which a judgment creditor may satisfy a judgment against a Member',
    freedomOfContractCite: 'S.D. Codified Laws § 47-34A-110',
    seriesAvailable: true,
    note: 'South Dakota has no state income tax. Strong charging-order protection. Most often selected in combination with a South Dakota dynasty trust for high-net-worth estate planning structures.'
  },
  NV: {
    name: 'Nevada',
    fidElim: 'broad', // fiduciary-duty modification: full (DE §18-1101(c)) / broad / modified / restricted
    code: 'NV',
    actName: 'Nevada Limited Liability Company Act',
    actCite: 'Nev. Rev. Stat. §§ 86.011 et seq.',
    formationDocName: 'Articles of Organization',
    formationFilingOffice: 'Nevada Secretary of State',
    filingFee: 425,
    annualReportDue: 'last day of the anniversary month of formation (Annual List + State Business License)',
    annualReportFee: 350,
    incomeTax: 'no',
    chargingOrderCite: 'Nev. Rev. Stat. § 86.401',
    chargingOrderRule: 'charging order is the exclusive remedy of a judgment creditor of a Member or assignee',
    freedomOfContractCite: 'Nev. Rev. Stat. § 86.286',
    seriesAvailable: true,
    note: 'Nevada has no state income tax but imposes a Commerce Tax on entities with Nevada-source gross revenue above $4M. Annual filing fees are high ($350+ combined). Strong charging-order protection. Commercial Court available in Eighth Judicial District.'
  }
};

const STATE_CODES = Object.keys(STATES);

// =============================================================================
// MEMBER SOFT CAP
// =============================================================================
const MEMBER_SOFT_CAP = 10;

// =============================================================================
// SECURITIES COMPLIANCE LEVELS
// =============================================================================
// Per partner directive: Platinum tool supports Level 0 and Level 1 only.
// Level 2 (full PPM) and Level 3 (506(c) with general solicitation) remain
// Reserve-only and are surfaced only by the 12-step tool.
// =============================================================================
const SEC_LEVELS = {
  level_0: {
    label: 'Level 0 — Joint Venture (no securities offering)',
    description: 'Operating-member joint venture where Membership Interests do not constitute "securities" under Howey and Williamson v. Tucker — all Members are actively involved in management and economic destiny.',
    companionDoc: 'JV Securities Analysis Memo'
  },
  level_1: {
    label: 'Level 1 — Reg D 506(b) (accredited + up to 35 sophisticated non-accredited)',
    description: 'Friends-and-family private placement under Reg D Rule 506(b). No general solicitation. Accredited investors plus up to 35 sophisticated non-accredited investors. Risk Disclosure Letter in lieu of full PPM.',
    companionDoc: 'Risk Disclosure Letter'
  }
};

// =============================================================================
// STATE-WIDE HELPERS
// =============================================================================
function stateInfo(code) { return STATES[code] || STATES.DE; }
function formatCurrency(n) {
  if (n == null || n === '' || isNaN(Number(n))) return '$0';
  const v = Number(n);
  if (v >= 1e6) return '$' + (v).toLocaleString('en-US', { maximumFractionDigits: 0 });
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
function formatPercent(n, decimals) {
  decimals = (decimals == null) ? 4 : decimals;
  if (n == null || n === '' || isNaN(Number(n))) return '0%';
  return (Number(n) * 100).toFixed(decimals).replace(/\.?0+$/, '') + '%';
}
function pct(n) { return formatPercent(n, 4); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
/** The company name with exactly one designator: never "Atlantic RE LLC, LLC". */
/** 2026-09-04 -> September 4, 2026 (falls back to the input when unparseable). */
const US_STATE_NAMES = {AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',CT:'Connecticut',DE:'Delaware',DC:'the District of Columbia',FL:'Florida',GA:'Georgia',HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',PR:'Puerto Rico',VI:'the U.S. Virgin Islands'};
function stateNameFromCode(code) { return US_STATE_NAMES[code] || code; }

function dlLongDate(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
  if (!m) return iso || '';
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function dlCompanyName(name) {
  const n = String(name || '').trim();
  if (!n) return '[Company Name], LLC';
  return /\b(L\.?L\.?C\.?|Limited Liability Company)\s*$/i.test(n) ? n : n + ', LLC';
}

function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// =============================================================================
// STATE MODEL — the configuration object that drives document generation
// =============================================================================
// Initialized with sensible defaults. Mutated by the panel UI via setStateField()
// and the dynamic-member CRUD helpers. Serialized to localStorage for save/load.
// =============================================================================
function defaultState() {
  return {
    // Panel 1 — Company & Jurisdiction
    company_name: '',
    jurisdiction: 'DE',
    effective_date: todayISO(),
    principal_street: '',
    principal_csz: '',
    ra_name: '',
    ra_street: '',
    ra_csz: '',
    business_purpose: 'real_estate_holding',
    business_purpose_detail: '',
    // Panel 2 — Members & Contributions
    members: [], // [{ id, name, type, address, capital, percentage, accredited }]
    contribution_acknowledgement: false,
    // Panel 3 — Management & Governance
    management_structure: 'manager_managed',
    manager_name: '',
    fiduciary_duties: 'eliminated_per_18_1101',
    major_decisions: {
      sale_assets: true,
      merger: true,
      dissolution: true,
      indebtedness: true,
      amend_oa: true,
      admit_member: true,
      tax_election: true,
      affiliate_tx: true,
      change_business: true
    },
    major_decision_threshold: 'supermajority_66',
    manager_removal: 'cause_only',
    // Panel 4 — Distributions
    pref_return_enabled: false,
    pref_return_rate: '0.08',
    pref_return_compounding: 'annual',
    pref_return_cumulative: 'cumulative',
    distribution_timing: 'quarterly',
    liquidation_method: 'per_capital_accounts',
    // Panel 5 — Tax Elections
    tax_classification: 'partnership',
    section_754_election: 'manager_discretion',
    section_752_method: 'profit_sharing_ratios',
    qualified_nonrecourse_method: 'real_estate_special_rule',
    bba_pr_designation: 'manager',
    bba_designated_individual: '',
    push_out_election: 'mandatory_for_audits',
    tax_year: 'calendar',
    accounting_method: 'accrual',
    tax_distributions_enabled: 'mandatory',
    assumed_tax_rate: '0.40',
    assumed_tax_rate_custom: '',
    tax_distribution_treatment: 'advance',
    // Panel 6 — Transfers
    transfer_general: 'strict_consent',
    permitted_transferees: {
      family: true,
      wholly_owned: true,
      affiliates: true,
      at_death: true,
      charitable: false,
      employee_benefit: false
    },
    rofo: 'enabled',
    rofr: 'disabled',
    drag_along: 'enabled',
    drag_along_threshold: 'supermajority_66',
    tag_along: 'enabled',
    tag_along_trigger: 'change_of_control',
    // Panel 7 — Securities Compliance
    securities_level: 'level_0',
    securities_target_raise: '',
    securities_min_subscription: '',
    securities_max_investors: '',
    property_location: '',
    anticipated_hold: '',
    offering_period: '',
    securities_description: 'Membership Interests',
    project_description: '',
    use_of_proceeds: '',
    blue_sky_states: '',
    // Panel 8 — Special Provisions
    spe_provisions: 'none',
    charging_order: 'standard',
    indemnification: 'standard',
    confidentiality: 'standard',
    restrictive_covenants: 'none',
    dispute_resolution: 'delaware_chancery',
    forum_state: ''
  };
}

// =============================================================================
// SPE & SPECIAL PROVISIONS HELPERS
// =============================================================================
function speLanguage(mode) {
  if (mode === 'none') return '';
  let base = 'The Company shall: (a) engage solely in the business set forth in Section 2.04 and not engage in any other business; (b) maintain its books, records, accounts, and bank accounts separate from those of any Affiliate; (c) not commingle assets with those of any Affiliate; (d) hold itself out to creditors and the public as a separate legal entity; (e) not guarantee, become liable for, or otherwise assume the obligations of any Affiliate, except as expressly permitted by senior lender; (f) not incur indebtedness other than the Permitted Indebtedness (as defined in any senior loan agreement); and (g) maintain an arm\u2019s-length relationship with each of its Affiliates.';
  if (mode === 'standard_plus_independent') {
    base += ' The Company shall maintain at least one Independent Manager whose affirmative vote shall be required for (i) the voluntary commencement by the Company of any case under any applicable insolvency law, (ii) the consent by the Company to the appointment of a receiver, trustee, custodian, or similar official, (iii) the making by the Company of a general assignment for the benefit of creditors, or (iv) the dissolution or liquidation of the Company.';
  }
  return base;
}

function chargingOrderLanguage(mode, state) {
  const s = stateInfo(state);
  if (mode === 'none') return '';
  let base = 'A judgment creditor of a Member shall have only the rights of an assignee of the Member\u2019s economic interest in the Company. The sole and exclusive remedy of such judgment creditor with respect to the Member\u2019s interest in the Company shall be a charging order against the Member\u2019s economic interest as provided in ' + s.chargingOrderCite + '. The judgment creditor shall have no right to interfere with the management or operation of the Company, no right to inspect or copy Company books and records, and no right to compel distributions.';
  if (mode === 'enhanced') {
    base += ' No judicial foreclosure of the Member\u2019s interest shall be permitted. The charging order shall not entitle the judgment creditor to information about the Company\u2019s operations or to participate in any management decision.';
  }
  return base;
}

// =============================================================================
// DOCUMENT GENERATORS
// =============================================================================
// Each generator returns an HTML string suitable for injection into the
// document-preview pane. The HTML uses semantic article structure; the print
// stylesheet renders these to PDF-ready layout. All cite strings are
// state-parameterized from STATES[].
//
// generateOperatingAgreement(state) - the core 30-40 page agreement
// generateSubscriptionAgreement(state) - investor-side subscription form
// generateJoinder(state) - signature page for new/transferred members
// generateJVMemo(state) - if Securities Level 0
// generateRiskDisclosureLetter(state) - if Securities Level 1
// =============================================================================

function docHeader(title, state) {
  const today = state.effective_date || todayISO();
  return '<div class="doc-header">'
    + '<div class="doc-firm">EDUCATIONAL DRAFT</div>'
    + '<div class="doc-firm-sub">Generated with the Donovan Legal PLLC drafting tool at donovan.law &middot; not a firm work product</div>'
    + '<div class="doc-draft-badge">DRAFT &middot; EDUCATIONAL ILLUSTRATION &middot; NOT FOR SIGNATURE</div>'
    + '<h1 class="doc-title">' + esc(title) + '</h1>'
    + '<div class="doc-company">' + esc(dlCompanyName(state.company_name)) + '</div>'
    + '<div class="doc-date">Effective as of ' + esc(dlLongDate(today)) + '</div>'
    + '</div>';
}

function docDisclaimer(state, securitiesLevel) {
  let extra = '';
  if (securitiesLevel === 'level_0') {
    extra = ' This transaction has been structured as a joint venture in which all Members are actively engaged in management of the business and economic destiny; the Membership Interests are not, and have not been treated as, "securities" subject to registration under the Securities Act of 1933 or applicable state blue-sky laws.';
  } else if (securitiesLevel === 'level_1') {
    extra = ' The Membership Interests offered hereunder are being offered and sold in reliance on the exemption provided by Rule 506(b) of Regulation D under the Securities Act of 1933. No general solicitation or general advertising has been or shall be conducted in connection with this offering.';
  }
  return '<p class="doc-disclaimer"><strong>DRAFT NOTICE.</strong> This document is an educational illustration generated by a self-service drafting tool published by Donovan Legal PLLC. It has not been reviewed by counsel, is not legal advice, is not tailored to the parties, the lender, the asset or the formation state, and is not legally effective for any purpose. It is not to be filed, signed or circulated to investors. Using the tool does not create an attorney-client relationship. Have formation documents prepared or reviewed by counsel admitted in the formation state before anything is filed or signed.' + extra + '</p>';
}

function memberRoster(state) {
  if (!state.members || state.members.length === 0) {
    return '<p><em>[No Members have been added. See Schedule A.]</em></p>';
  }
  let html = '<table class="doc-roster"><thead><tr><th>Member</th><th>Type</th><th>Capital Contribution</th><th>Percentage Interest</th></tr></thead><tbody>';
  state.members.forEach(function (m) {
    html += '<tr>'
      + '<td>' + esc(m.name || '[Unnamed Member]') + '</td>'
      + '<td>' + esc(memberTypeLabel(m.type)) + '</td>'
      + '<td style="text-align:right;">' + formatCurrency(m.capital) + '</td>'
      + '<td style="text-align:right;">' + (m.percentage != null ? (Number(m.percentage) * 100).toFixed(4).replace(/\.?0+$/, '') + '%' : '0%') + '</td>'
      + '</tr>';
  });
  html += '</tbody></table>';
  return html;
}

function memberTypeLabel(t) {
  return ({
    individual: 'Individual',
    trust: 'Trust',
    llc: 'Limited Liability Company',
    s_corp: 'S-Corporation',
    c_corp: 'C-Corporation',
    lp: 'Limited Partnership',
    ira: 'Self-Directed IRA',
    other: 'Other'
  })[t] || 'Individual';
}

function thresholdLabel(t) {
  return ({
    majority: 'a Majority in Interest (greater than fifty percent (50%))',
    supermajority_66: 'a Supermajority (sixty-six and two-thirds percent (66 2/3%))',
    supermajority_75: 'a Supermajority (seventy-five percent (75%))',
    unanimous: 'unanimous consent of all Members'
  })[t] || 'a Majority in Interest';
}

function fidLabel(t) {
  return ({
    default: 'the fiduciary duties provided under the Act and applicable law, as expressly modified by this Agreement, together with the implied contractual covenant of good faith and fair dealing',
    eliminated_per_18_1101: 'the implied contractual covenant of good faith and fair dealing only; to the fullest extent permitted by the Act, all other fiduciary duties at law or in equity are hereby eliminated. To the extent the Act does not permit a duty to be eliminated, that duty is restricted to the fullest extent the Act permits, and any Member or Manager acting in good-faith reliance on this Agreement shall not be liable for breach of such duty',
    modified_business_judgment: 'duties under a modified business judgment rule standard, requiring that each act or omission be in good faith and on an informed basis',
    retained: 'the duties of loyalty and care as they exist at common law and under the Act, without limitation or modification by this Agreement, together with the implied contractual covenant of good faith and fair dealing'
  })[t] || '';
}

// -----------------------------------------------------------------------------
// generateOperatingAgreement
// -----------------------------------------------------------------------------
function generateOperatingAgreement(state) {
  const s = stateInfo(state.jurisdiction);
  const companyName = state.company_name || '[Company Name]';
  const effDate = state.effective_date || todayISO();
  const members = state.members || [];
  const mgmt = state.management_structure || 'manager_managed';
  const isManagerManaged = (mgmt !== 'member_managed');
  const isBoard = (mgmt === 'board_managed');

  let html = '';
  html += docHeader('Operating Agreement', state);
  html += docDisclaimer(state, state.securities_level);

  // Recitals
  html += '<h2>Recitals</h2>'
    + '<p>This Operating Agreement (this "<strong>Agreement</strong>") of <strong>' + esc(dlCompanyName(companyName)) + '</strong> (the "<strong>Company</strong>"), a limited liability company formed under the ' + esc(s.actName) + ', ' + esc(s.actCite) + ' (the "<strong>Act</strong>"), is entered into effective as of ' + esc(dlLongDate(effDate)) + ' (the "<strong>Effective Date</strong>") by and among the persons listed as Members on Schedule A hereto.</p>'
    + '<p>The Members desire to set forth their respective rights and obligations with respect to the Company and to provide for the operation of the Company in accordance with the Act.</p>'
    + '<p>The Members acknowledge that all Capital Contributions to the Company have been or shall be made in cash. The Members further acknowledge that no Member has contributed or will contribute property having a fair market value materially different from its adjusted tax basis, and accordingly no Section 704(c) allocation method election is required under this Agreement. Any future contribution of non-cash property shall require the prior written consent of all Members and shall be addressed by amendment to this Agreement.</p>'
    + '<p>NOW, THEREFORE, in consideration of the mutual covenants contained herein, the Members agree as follows:</p>';

  // Article I — Definitions (abbreviated for the draft; firm finalizes full glossary)
  html += '<h2>Article I &mdash; Definitions</h2>'
    + '<p>For purposes of this Agreement, the following terms have the meanings set forth below. Capitalized terms used but not defined herein have the meanings ascribed in the Act.</p>'
    + '<dl class="doc-defs">'
    + '<dt>"Act"</dt><dd>Means the ' + esc(s.actName) + ', ' + esc(s.actCite) + ', as amended from time to time.</dd>'
    + '<dt>"Affiliate"</dt><dd>Means, with respect to any Person, any other Person that directly or indirectly controls, is controlled by, or is under common control with such Person.</dd>'
    + '<dt>"Available Cash"</dt><dd>Means, as of any date, cash and cash equivalents held by the Company in excess of (i) reasonable reserves for working capital, capital expenditures, contingent liabilities, and debt service, (ii) amounts required to be retained under any agreement with a senior lender, and (iii) amounts required to be retained under the Act.</dd>'
    + '<dt>"Capital Account"</dt><dd>Means the capital account maintained for each Member in accordance with the regulations promulgated under Section 704(b) of the Internal Revenue Code, including adjustments for contributions, distributions, allocations of net income and net loss, and revaluations as permitted under Treasury Regulation § 1.704-1(b)(2)(iv)(f).</dd>'
    + '<dt>"Capital Contribution"</dt><dd>Means, with respect to any Member, the aggregate amount of cash contributed by such Member to the Company.</dd>'
    + '<dt>"Code"</dt><dd>Means the Internal Revenue Code of 1986, as amended.</dd>'
    + '<dt>"Joinder Agreement"</dt><dd>Means a written instrument, in form reasonably acceptable to the ' + (isManagerManaged ? 'Manager' : 'Members') + ', by which a transferee of a Membership Interest agrees to be bound by this Agreement as a Member.</dd>'
    + '<dt>"Majority in Interest"</dt><dd>Means Members holding more than fifty percent (50%) of the Percentage Interests then held by all Members entitled to vote on the matter.</dd>'
    + '<dt>"Membership Interest"</dt><dd>Means a Member\u2019s entire interest in the Company, including the Member\u2019s Percentage Interest, Capital Account, right to distributions, and right to vote or participate in management to the extent provided in this Agreement.</dd>'
    + '<dt>"Net Income" and "Net Loss"</dt><dd>Mean, for each fiscal year or other period, the Company\u2019s taxable income or loss for such period determined under Section 703(a) of the Code (including all items required to be separately stated under Section 703(a)(1)), adjusted as required to maintain Capital Accounts in accordance with Treasury Regulation § 1.704-1(b)(2)(iv).</dd>'
    + (state.pref_return_enabled
        ? '<dt>"Preferred Return"</dt><dd>Means, with respect to each Member, a return on Unreturned Capital Contributions accruing at the rate of ' + pct(Number(state.pref_return_rate)) + ' per annum, ' + (state.pref_return_compounding === 'simple' ? 'computed on a simple basis (not compounded)' : (state.pref_return_compounding === 'quarterly' ? 'compounded quarterly' : (state.pref_return_compounding === 'monthly' ? 'compounded monthly' : 'compounded annually'))) + ', and accruing on a ' + (state.pref_return_cumulative === 'non_cumulative' ? 'non-cumulative' : 'cumulative') + ' basis.</dd>'
        : '')
    + '<dt>"Percentage Interest"</dt><dd>Means, with respect to each Member, the percentage set forth opposite such Member\u2019s name on Schedule A, as the same may be adjusted from time to time in accordance with this Agreement.</dd>'
    + '<dt>"Person"</dt><dd>Means an individual, partnership, joint venture, association, corporation, limited liability company, trust, estate, governmental entity, or other entity.</dd>'
    + '<dt>"Supermajority"</dt><dd>Means Members holding at least sixty-six and two-thirds percent (66 2/3%) of the Percentage Interests then held by all Members entitled to vote on the matter.</dd>'
    + '<dt>"Tax Distributions"</dt><dd>Means the distributions described in Section 5.03.</dd>'
    + '<dt>"Transfer"</dt><dd>Means any sale, assignment, gift, pledge, encumbrance, or other disposition of all or any part of a Membership Interest, whether voluntary, involuntary, or by operation of law.</dd>'
    + (state.pref_return_enabled ? '<dt>"Unreturned Capital Contributions"</dt><dd>Means, with respect to each Member, the excess of (i) the aggregate Capital Contributions of such Member over (ii) all distributions to such Member made pursuant to Section 5.02(b).</dd>' : '')
    + '</dl>';

  // Article II — Organization
  html += '<h2>Article II &mdash; Organization and Purpose</h2>'
    + '<p><strong>Section 2.01. Formation.</strong> The Company has been formed as a limited liability company under the Act by the filing of its ' + esc(s.formationDocName) + ' with the ' + esc(s.formationFilingOffice) + ' on or about the Effective Date.</p>'
    + '<p><strong>Section 2.02. Name.</strong> The name of the Company is "<strong>' + esc(dlCompanyName(companyName)) + '</strong>." The Company may conduct business under such other names or trade names as the ' + (isManagerManaged ? 'Manager' : 'Members') + ' may from time to time determine.</p>'
    + '<p><strong>Section 2.03. Principal Office; Registered Agent.</strong> The principal office of the Company is located at ' + esc(state.principal_street || '[Street]') + ', ' + esc(state.principal_csz || '[City, State, ZIP]') + '. The registered agent of the Company in the State of ' + esc(s.name) + ' is ' + esc(state.ra_name || '[Registered Agent Name]') + ', located at ' + esc(state.ra_street || '[Street]') + ', ' + esc(state.ra_csz || '[City, State, ZIP]') + '.</p>'
    + '<p><strong>Section 2.04. Purpose.</strong> The purpose of the Company is to ' + businessPurposeLanguage(state.business_purpose) + ', and to engage in any other lawful act or activity for which limited liability companies may be organized under the Act, in each case to the extent not prohibited by Section 2.05 (Single-Purpose Entity Covenants) if applicable.</p>'
    + '<p><strong>Section 2.05. Term.</strong> The Company commenced on the date of filing of the ' + esc(s.formationDocName) + ' and shall continue perpetually unless dissolved earlier in accordance with this Agreement or the Act.</p>'
    + (state.spe_provisions !== 'none'
        ? '<p><strong>Section 2.06. Single-Purpose Entity Covenants.</strong> ' + speLanguage(state.spe_provisions) + '</p>'
        : '');

  // Article III — Members and Capital
  html += '<h2>Article III &mdash; Members and Capital Contributions</h2>'
    + '<p><strong>Section 3.01. Members.</strong> The Members of the Company are listed on Schedule A. Each Member\u2019s Capital Contribution, Percentage Interest, and address for notices are set forth on Schedule A.</p>'
    + '<p><strong>Section 3.02. Initial Capital Contributions.</strong> Each Member has contributed to the Company the amount of cash set forth opposite such Member\u2019s name on Schedule A. All Capital Contributions have been made in cash.</p>'
    + '<p><strong>Section 3.03. Additional Capital Contributions.</strong> ' + additionalCapitalLanguage(state) + '</p>'
    + '<p><strong>Section 3.04. Capital Accounts.</strong> A Capital Account shall be maintained for each Member in accordance with Treasury Regulation § 1.704-1(b)(2)(iv). Capital Accounts shall be (a) increased by the amount of Capital Contributions made by the Member and the Member\u2019s allocable share of Net Income; and (b) decreased by the amount of distributions to the Member and the Member\u2019s allocable share of Net Loss.</p>'
    + '<p><strong>Section 3.05. No Interest on Capital; No Withdrawal.</strong> No Member shall be entitled to interest on its Capital Contributions or its Capital Account. No Member shall have the right to withdraw any portion of its Capital Contributions or to receive any distribution except as expressly provided in this Agreement.</p>'
    + '<p><strong>Section 3.06. Single Class.</strong> The Company shall have a single class of Membership Interests. All Members shall hold Membership Interests of the same class, distinguished only by Percentage Interest.' + (state.pref_return_enabled ? ' The single class carries a Preferred Return: under Section 5.02, Available Cash is applied first to each Member\u2019s accrued Preferred Return and then to the return of each Member\u2019s Unreturned Capital Contributions, in each case pro rata within the class, before any pro-rata residual distribution. The Preferred Return does not create a second class of Membership Interests; every Member holds the same class on the same terms.' : ' Distributions shall be made pro rata in accordance with Percentage Interests.') + '</p>';

  // Article IV — Allocations
  html += '<h2>Article IV &mdash; Allocations</h2>'
    + '<p><strong>Section 4.01. General Allocation.</strong> All Net Income, Net Loss, and items of income, gain, loss, deduction, and credit of the Company for any fiscal year shall be allocated to the Members in proportion to their Percentage Interests. The Members intend that this allocation method constitute a "traditional" allocation following the Members\u2019 economic interests in the Company within the meaning of Treasury Regulation § 1.704-1(b)(3).</p>'
    + '<p><strong>Section 4.02. Tax Allocations.</strong> All items of income, gain, loss, deduction, and credit recognized by the Company for federal income tax purposes shall be allocated among the Members in the same proportion as the corresponding items of Net Income or Net Loss are allocated under Section 4.01. The Members acknowledge that all Capital Contributions have been made in cash; accordingly, no allocations under Section 704(c) of the Code (relating to contributed property with a fair market value different from its adjusted basis) are anticipated under this Agreement.</p>'
    + '<p><strong>Section 4.03. No Special Allocations.</strong> This Agreement does not provide for special allocations, regulatory chargeback allocations, qualified income offset allocations, minimum gain chargebacks, or curative or remedial allocations of any kind. The Members acknowledge that the absence of such allocations reflects the simplified single-class structure adopted by the Members for this Company and the absence of contributed property. If, after the Effective Date, facts arise that would require regulatory allocations under Treasury Regulation §§ 1.704-1(b) or 1.704-2, the Members shall consult counsel and amend this Agreement accordingly.</p>';

  // Article V — Distributions
  html += '<h2>Article V &mdash; Distributions</h2>';
  if (state.pref_return_enabled) {
    html += '<p><strong>Section 5.01. Distribution Timing.</strong> Subject to the Act and any senior lender requirements, the ' + (isManagerManaged ? 'Manager' : 'Members') + ' shall cause the Company to distribute Available Cash ' + distTimingLabel(state.distribution_timing) + '.</p>'
      + '<p><strong>Section 5.02. Distribution Order.</strong> Available Cash shall be distributed in the following order:</p>'
      + '<ol class="doc-numbered">'
      + '<li><strong>First,</strong> to the Members in proportion to their then-unpaid Preferred Return amounts, until each Member has received cumulative distributions under this paragraph equal to its accrued and unpaid Preferred Return;</li>'
      + '<li><strong>Second,</strong> to the Members in proportion to their respective Unreturned Capital Contributions, until each Member has received cumulative distributions under this paragraph equal to its Capital Contributions; and</li>'
      + '<li><strong>Third,</strong> to the Members pro rata in proportion to their Percentage Interests.</li>'
      + '</ol>'
      + '<p>The Preferred Return shall accrue from the date of each Capital Contribution at the rate of ' + pct(Number(state.pref_return_rate)) + ' per annum, ' + (state.pref_return_compounding === 'simple' ? 'computed on a simple basis (not compounded)' : (state.pref_return_compounding === 'quarterly' ? 'compounded quarterly' : (state.pref_return_compounding === 'monthly' ? 'compounded monthly' : 'compounded annually'))) + ', on a ' + (state.pref_return_cumulative === 'non_cumulative' ? 'non-cumulative' : 'cumulative') + ' basis.</p>';
  } else {
    html += '<p><strong>Section 5.01. Distribution Timing.</strong> Subject to the Act and any senior lender requirements, the ' + (isManagerManaged ? 'Manager' : 'Members') + ' shall cause the Company to distribute Available Cash ' + distTimingLabel(state.distribution_timing) + '.</p>'
      + '<p><strong>Section 5.02. Distribution Order.</strong> Available Cash shall be distributed to the Members pro rata in proportion to their Percentage Interests. No Preferred Return is provided for under this Agreement.</p>';
  }
  html += '<p><strong>Section 5.03. Tax Distributions.</strong> ' + taxDistributionsLanguage(state) + '</p>'
    + '<p><strong>Section 5.04. Liquidating Distributions.</strong> ' + (state.liquidation_method === 'per_capital_accounts' ? 'Upon dissolution of the Company, distributions shall be made in accordance with the positive Capital Account balances of the Members, after giving effect to all contributions, distributions, and allocations for all periods.' : 'Upon dissolution of the Company, distributions shall be made in accordance with the order of priority set forth in Section 5.02.') + '</p>';

  // Article VI — Management
  html += '<h2>Article VI &mdash; Management</h2>';
  if (mgmt === 'member_managed') {
    html += '<p><strong>Section 6.01. Member-Managed.</strong> The Company is a Member-Managed limited liability company. Each Member is hereby designated as a manager of the Company within the meaning of the Act, and has the authority to bind the Company in accordance with the Act and this Agreement, subject to the Major Decision provisions of Section 6.04.</p>';
  } else if (mgmt === 'manager_managed') {
    html += '<p><strong>Section 6.01. Manager-Managed.</strong> The Company is a Manager-Managed limited liability company. The Members hereby designate ' + esc(state.manager_name || '[Manager Name]') + ' as the initial Manager of the Company. Subject to the Major Decision provisions of Section 6.04, the Manager has full and exclusive authority to manage and control the business of the Company.</p>'
      + '<p><strong>Section 6.02. Manager Removal.</strong> ' + managerRemovalLanguage(state.manager_removal) + '</p>';
  } else {
    html += '<p><strong>Section 6.01. Board-Managed.</strong> The Company is governed by a Board of Managers. The Members shall elect the Managers as provided in this Agreement. The Board shall act by majority vote, and each Manager shall have one vote. The initial Board shall consist of the individuals identified on Schedule B.</p>';
  }
  html += '<p><strong>Section 6.03. Fiduciary Duties.</strong> The duties owed by the ' + (isManagerManaged ? 'Manager' : 'Members') + ' to the Company and to each Member shall be governed by ' + fidLabel(state.fiduciary_duties) + '.'
    + (state.fiduciary_duties === 'eliminated_per_18_1101' && s.fidElim && s.fidElim !== 'full'
        ? ' <em>[Drafting note: ' + esc(s.name) + ' ' + (s.fidElim === 'broad' ? 'permits broad modification of fiduciary duties but is not identical to Delaware § 18-1101(c); counsel should conform this Section to the ' + esc(s.actName) + '.' : s.fidElim === 'modified' ? 'permits fiduciary duties to be modified but not eliminated; this Section will operate as a restriction, not an elimination, and counsel should conform it to the ' + esc(s.actName) + '.' : 'restricts the modification of fiduciary duties; elimination language may be unenforceable, and counsel should conform this Section to the ' + esc(s.actName) + '.') + ']</em>'
        : '')
    + '</p>'
    + '<p><strong>Section 6.04. Major Decisions.</strong> Notwithstanding the general authority of the ' + (isManagerManaged ? 'Manager' : 'Members') + ', the following matters require the affirmative consent of ' + thresholdLabel(state.major_decision_threshold) + ':</p>'
    + majorDecisionList(state)
    + '<p><strong>Section 6.05. Meetings; Action by Written Consent.</strong> Meetings of the Members may be called by the ' + (isManagerManaged ? 'Manager' : 'any Member') + ' on not less than ten (10) business days\u2019 prior written notice. Any action required or permitted to be taken at a meeting may be taken without a meeting if a written consent setting forth the action is signed by Members holding the requisite Percentage Interests.</p>';

  // Article VII — Transfers
  html += '<h2>Article VII &mdash; Transfers</h2>'
    + '<p><strong>Section 7.01. General Restriction.</strong> ' + transferGeneralLanguage(state.transfer_general) + '</p>'
    + '<p><strong>Section 7.02. Permitted Transferees.</strong> Notwithstanding Section 7.01, the following transfers are permitted without the consent otherwise required, in each case subject to (i) the transferee\u2019s execution of a Joinder Agreement, (ii) compliance with applicable securities laws, and (iii) such tax-related representations as the ' + (isManagerManaged ? 'Manager' : 'other Members') + ' may reasonably require:</p>'
    + permittedTransfereesList(state)
    + (state.rofo === 'enabled' ? '<p><strong>Section 7.03. Right of First Offer.</strong> Before transferring any Membership Interest to any Person other than a Permitted Transferee, the transferring Member shall first offer the Interest to the non-transferring Members at the price and on the terms the transferring Member proposes to accept from the third-party transferee. The non-transferring Members shall have thirty (30) days to accept the offer in writing, in proportion to their respective Percentage Interests (with rights of overallotment if any Member declines).</p>' : '')
    + (state.rofr === 'enabled' ? '<p><strong>Section 7.0' + (state.rofo === 'enabled' ? '4' : '3') + '. Right of First Refusal.</strong> If the transferring Member receives a bona fide written offer from a third party for the purchase of all or any portion of its Membership Interest, the transferring Member shall give written notice to the non-transferring Members, and the non-transferring Members shall have thirty (30) days to elect to purchase the Interest on the same terms set forth in the third-party offer.</p>' : '')
    + (state.drag_along === 'enabled' ? '<p><strong>Section ' + nextTransferSec(state, 'drag') + '. Drag-Along Right.</strong> If Members holding ' + thresholdLabel(state.drag_along_threshold) + ' (the "<strong>Initiating Members</strong>") approve a sale of all or substantially all of the Membership Interests or assets of the Company to a non-Affiliated third party, the Initiating Members may require all other Members to participate in such sale on the same terms and conditions, including the same price per Percentage Interest and the same representations, warranties, and indemnities, on a pro-rata basis.</p>' : '')
    + (state.tag_along === 'enabled' ? '<p><strong>Section ' + nextTransferSec(state, 'tag') + '. Tag-Along Right.</strong> If any Member proposes to transfer Membership Interests constituting ' + tagAlongTriggerLabel(state.tag_along_trigger) + ' to a non-Affiliated third party, the proposed transferor shall give the other Members the right to participate in the sale on a pro-rata basis at the same price and on the same terms.</p>' : '');

  // Article VIII — Tax Matters
  html += '<h2>Article VIII &mdash; Tax Matters</h2>'
    + '<p><strong>Section 8.01. Federal Tax Classification.</strong> ' + taxClassificationLanguage(state.tax_classification) + '</p>'
    + '<p><strong>Section 8.02. Section 754 Election.</strong> ' + section754Language(state.section_754_election) + '</p>'
    + '<p><strong>Section 8.03. Allocation of Nonrecourse Liabilities.</strong> Excess nonrecourse liabilities of the Company (within the meaning of Treasury Regulation § 1.752-3(a)(3)) shall be allocated among the Members ' + section752Label(state.section_752_method) + '. Qualified nonrecourse financing within the meaning of Section 465(b)(6) of the Code shall be allocated ' + (state.qualified_nonrecourse_method === 'real_estate_special_rule' ? 'in accordance with the special rule of Section 465(b)(6) for real-estate-secured financing' : 'in accordance with the general rule of Section 465 (at risk only to the extent of personal liability)') + '.</p>'
    + '<p><strong>Section 8.04. BBA Partnership Representative.</strong> The Partnership Representative of the Company within the meaning of Section 6223 of the Code shall be ' + bbaPRLabel(state.bba_pr_designation, state.manager_name) + '.' + (state.bba_designated_individual ? ' The Designated Individual for purposes of Treasury Regulation § 301.6223-1 shall be ' + esc(state.bba_designated_individual) + '.' : '') + ' ' + pushOutLanguage(state.push_out_election) + '</p>'
    + '<p><strong>Section 8.05. Tax Year; Accounting Method.</strong> The fiscal year of the Company is ' + (state.tax_year === 'calendar' ? 'the calendar year' : (state.tax_year === 'fiscal_required' ? 'the fiscal year required under Section 706 of the Code' : 'the tax year of the Majority Member')) + '. The Company shall maintain its books and records on the ' + (state.accounting_method === 'cash' ? 'cash basis (subject to compliance with Section 448 of the Code)' : (state.accounting_method === 'accrual' ? 'accrual basis' : 'basis elected by the ' + (isManagerManaged ? 'Manager' : 'Members'))) + ' of accounting.</p>';

  // Article IX — Other Provisions (numbered sequentially at build time; the
  // earlier arithmetic skipped 9.04 and emitted "9.010" — 2026-09-04 audit)
  html += '<h2>Article IX &mdash; Other Provisions</h2>';
  let ixN = 0;
  const ixSec = function () { ixN += 1; return '9.' + (ixN < 10 ? '0' + ixN : ixN); };
  if (state.charging_order !== 'none') {
    html += '<p><strong>Section ' + ixSec() + '. Charging Order Protection.</strong> ' + chargingOrderLanguage(state.charging_order, state.jurisdiction) + '</p>';
  }
  html += '<p><strong>Section ' + ixSec() + '. Indemnification.</strong> ' + indemnificationLanguage(state.indemnification, isManagerManaged) + '</p>';
  if (state.confidentiality !== 'none') {
    html += '<p><strong>Section ' + ixSec() + '. Confidentiality.</strong> ' + confidentialityLanguage(state.confidentiality) + '</p>';
  }
  if (state.restrictive_covenants !== 'none') {
    html += '<p><strong>Section ' + ixSec() + '. Restrictive Covenants.</strong> ' + restrictiveCovenantsLanguage(state.restrictive_covenants) + '</p>';
  }
  html += '<p><strong>Section ' + ixSec() + '. Dispute Resolution.</strong> ' + disputeResolutionLanguage(state.dispute_resolution, s, state.forum_state) + '</p>'
    + '<p><strong>Section ' + ixSec() + '. Governing Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of ' + esc(s.name) + ', without regard to its conflict-of-laws principles.</p>'
    + '<p><strong>Section ' + ixSec() + '. Entire Agreement; Amendments.</strong> This Agreement (together with the schedules and exhibits hereto) constitutes the entire agreement among the Members with respect to the subject matter hereof and supersedes all prior agreements. This Agreement may be amended only by a written instrument signed by ' + thresholdLabel(state.major_decision_threshold) + ', except that any amendment that adversely affects a Member disproportionately relative to other Members shall also require the written consent of that Member.</p>'
    + '<p><strong>Section ' + ixSec() + '. Severability.</strong> If any provision of this Agreement is held to be invalid or unenforceable, the remaining provisions shall continue in full force and effect.</p>'
    + '<p><strong>Section ' + ixSec() + '. Counterparts; Electronic Signatures.</strong> This Agreement may be executed in counterparts, each of which constitutes an original. Signatures transmitted by PDF or electronic means shall be deemed originals.</p>';

  // Signature block
  html += '<h2>Signatures</h2>'
    + '<p>IN WITNESS WHEREOF, the undersigned Members have executed this Operating Agreement as of the Effective Date set forth above.</p>'
    + signatureBlocks(state);

  // Schedule A — Member Roster
  html += '<h2>Schedule A &mdash; Members</h2>' + memberRoster(state);

  // Wrapper
  return '<div class="doc-page">' + html + '</div>';
}

function nextTransferSec(state, which) {
  let n = 2; // 7.01 is general, 7.02 is permitted transferees
  if (state.rofo === 'enabled') n++;
  if (state.rofr === 'enabled') n++;
  if (which === 'drag') return '7.0' + (n + 1);
  if (which === 'tag') {
    let m = n + 1;
    if (state.drag_along === 'enabled') m++;
    return '7.0' + m;
  }
  return '7.0' + (n + 1);
}


// -----------------------------------------------------------------------------
// Helper text generators
// -----------------------------------------------------------------------------
function businessPurposeLanguage(p) {
  return ({
    real_estate_holding: 'acquire, own, hold, lease, operate, manage, finance, refinance, develop, improve, and dispose of real property and interests in real property',
    real_estate_development: 'develop, construct, finance, lease, manage, own, hold, and dispose of real property and interests in real property',
    real_estate_operating: 'operate, manage, finance, refinance, and dispose of one or more operating real estate businesses, including short-term rental, hospitality, and related ancillary services',
    investment_fund: 'invest in, hold, manage, and dispose of investment assets, including direct and indirect interests in real estate and operating businesses',
    operating_business: 'conduct any lawful general business activity',
    general: 'engage in any lawful business activity for which limited liability companies may be organized under the Act'
  })[p] || 'engage in any lawful business activity for which limited liability companies may be organized under the Act';
}

function additionalCapitalLanguage(state) {
  const mode = state.additional_capital_mode || 'permissive';
  return ({
    none: 'No Additional Capital Contributions shall be required or permitted without an amendment to this Agreement approved by ' + thresholdLabel(state.major_decision_threshold) + '.',
    permissive: 'Additional Capital Contributions may be made by the Members with the consent of ' + (state.management_structure === 'manager_managed' ? 'the Manager and Members holding a Majority in Interest' : 'Members holding a Majority in Interest') + '. No Member shall be obligated to make any Additional Capital Contribution.',
    mandatory_pro_rata: 'The ' + (state.management_structure === 'manager_managed' ? 'Manager' : 'Members') + ' may call for Additional Capital Contributions on a pro-rata basis (in proportion to Percentage Interests) upon not less than fifteen (15) days\u2019 prior written notice. If a Member fails to fund a properly-noticed capital call, the non-defaulting Members may advance the defaulting Member\u2019s share as a Member Loan bearing interest at twenty-five percent (25%) per annum, repayable with priority before any distributions to the defaulting Member.',
    conditional: 'Additional Capital Contributions shall be permitted only upon the occurrence of (i) a cash shortfall threatening the Company\u2019s ability to meet its obligations as they come due, (ii) a requirement imposed by a senior lender, or (iii) such other conditions as ' + thresholdLabel(state.major_decision_threshold) + ' may approve in writing.'
  })[mode];
}

function distTimingLabel(t) {
  return ({
    quarterly: 'on a quarterly basis, within forty-five (45) days after the end of each calendar quarter, to the extent of Available Cash',
    semi_annual: 'on a semi-annual basis, within sixty (60) days after the end of each semi-annual period, to the extent of Available Cash',
    annual: 'on an annual basis, within ninety (90) days after the end of each fiscal year, to the extent of Available Cash',
    manager_discretion: 'in the discretion of the Manager, to the extent of Available Cash'
  })[t] || 'on a quarterly basis';
}

function taxDistributionsLanguage(state) {
  const m = state.tax_distributions_enabled;
  if (m === 'none') return 'No Tax Distributions shall be required under this Agreement.';
  const rate = state.assumed_tax_rate === 'highest_marginal'
    ? 'the highest combined marginal federal and state income tax rate applicable to any Member'
    : (state.assumed_tax_rate === 'custom'
        ? ((Number(state.assumed_tax_rate_custom) || 0).toFixed(1).replace(/\.0$/, '') + '%')
        : (Number(state.assumed_tax_rate) * 100).toFixed(0) + '%');
  const treat = state.tax_distribution_treatment === 'advance'
    ? 'Tax Distributions shall be treated as advances against the next-in-time distributions to which each Member would otherwise be entitled under Section 5.02, with recoupment applied against subsequent distributions to that Member only.'
    : 'Tax Distributions shall be in addition to, and not in lieu of, other distributions under Section 5.02.';
  return (m === 'mandatory'
    ? 'The Company shall make Tax Distributions to the Members on a quarterly basis at least seven (7) days prior to each estimated-tax-payment deadline. Tax Distributions shall be calculated at an assumed rate of ' + rate + ' applied to each Member\u2019s allocable share of taxable income for the preceding period.'
    : 'The ' + (state.management_structure === 'manager_managed' ? 'Manager' : 'Members') + ' may, but is not required to, cause the Company to make Tax Distributions to the Members. If made, Tax Distributions shall be calculated at an assumed rate of ' + rate + '.') + ' ' + treat;
}

function majorDecisionList(state) {
  const md = state.major_decisions || {};
  const items = [];
  if (md.sale_assets) items.push('Sale of all or substantially all of the assets of the Company');
  if (md.merger) items.push('Merger, consolidation, or conversion of the Company');
  if (md.dissolution) items.push('Dissolution or winding up of the Company');
  if (md.indebtedness) items.push('Incurrence of indebtedness above a threshold to be set by the ' + (state.management_structure === 'manager_managed' ? 'Manager' : 'Members'));
  if (md.amend_oa) items.push('Amendment of this Agreement');
  if (md.admit_member) items.push('Admission of a new Member (other than a Permitted Transferee)');
  if (md.tax_election) items.push('Material tax elections (other than annual routine elections)');
  if (md.affiliate_tx) items.push('Affiliate transactions other than at arm\u2019s length on disclosed terms');
  if (md.change_business) items.push('Change in the Company\u2019s principal business purpose');
  if (items.length === 0) return '<p>None.</p>';
  let html = '<ul class="doc-bullets">';
  items.forEach(function (i) { html += '<li>' + esc(i) + '</li>'; });
  return html + '</ul>';
}

function managerRemovalLanguage(t) {
  return ({
    cause_only: 'The Manager may be removed only for Cause, upon thirty (30) days\u2019 prior written notice and an opportunity to cure if the basis for removal is curable. "Cause" means (i) fraud, willful misconduct, or gross negligence by the Manager in the performance of its duties; (ii) any felony conviction or admission of guilt; or (iii) any material uncured breach of this Agreement.',
    cause_or_majority: 'The Manager may be removed (i) for Cause as defined above, or (ii) upon the affirmative vote of Members holding a Majority in Interest, in either case on not less than thirty (30) days\u2019 prior written notice.',
    supermajority: 'The Manager may be removed upon the affirmative vote of Members holding sixty-six and two-thirds percent (66 2/3%) of Percentage Interests not held by the Manager or its Affiliates.'
  })[t] || '';
}

function permittedTransfereesList(state) {
  const pt = state.permitted_transferees || {};
  const items = [];
  if (pt.family) items.push('Transfers to a revocable trust for the benefit of the Member, an irrevocable trust for the benefit of the Member\u2019s spouse or descendants, a grantor retained annuity trust ("GRAT"), an intentionally defective grantor trust ("IDGT"), or a family limited partnership of which the Member or the Member\u2019s family is the principal beneficial owner');
  if (pt.wholly_owned) items.push('Transfers to a wholly-owned entity of the transferring Member (which may be a single-member limited liability company, an S-Corporation, or a wholly-owned subsidiary)');
  if (pt.affiliates) items.push('Transfers to Affiliates of the transferring Member (entities controlled by, controlling, or under common control with the Member)');
  if (pt.at_death) items.push('Transfers by will or pursuant to the laws of intestate succession upon the death of an individual Member');
  if (pt.charitable) items.push('Transfers to one or more charitable organizations described in Section 501(c)(3) of the Code or to one or more donor-advised funds');
  if (pt.employee_benefit) items.push('Transfers to employee benefit trusts of the transferring Member or its Affiliates');
  if (items.length === 0) return '<p>None.</p>';
  let html = '<ul class="doc-bullets">';
  items.forEach(function (i) { html += '<li>' + esc(i) + '</li>'; });
  return html + '</ul>';
}

function tagAlongTriggerLabel(t) {
  return ({
    any_transfer: 'any transfer to a non-Affiliated third party',
    change_of_control: 'a change of control of the Company (defined as the transfer of more than twenty-five percent (25%) of Percentage Interests to a non-Affiliated transferee or group)',
    majority_transfer: 'the transfer of a Majority in Interest to a non-Affiliated transferee'
  })[t] || '';
}

function transferGeneralLanguage(t) {
  return ({
    strict_consent: 'No Member shall sell, transfer, assign, pledge, encumber, or otherwise dispose of all or any portion of its Membership Interest, whether voluntarily, involuntarily, or by operation of law, without the prior written consent of ' + 'all Members' + ', except for transfers to Permitted Transferees as defined in Section 7.02.',
    consent_with_permitted: 'No Member shall transfer all or any portion of its Membership Interest without the prior written consent of Members holding a Majority in Interest, except for transfers to Permitted Transferees.',
    restricted_class: 'Transfers of Membership Interests shall be subject to class-specific restrictions as set forth in the schedules hereto.',
    open_with_compliance: 'Membership Interests may be transferred subject only to compliance with applicable securities laws (including the receipt of an opinion of counsel as to the availability of an exemption from registration if the transfer is not registered) and the transferee\u2019s execution of a Joinder Agreement.'
  })[t] || '';
}

function taxClassificationLanguage(t) {
  return ({
    partnership: 'The Company shall be classified as a partnership for federal income tax purposes under Subchapter K of the Code. The Members do not authorize any election under Treasury Regulation § 301.7701-3 to be treated otherwise.',
    s_corp: 'The Company shall elect to be treated as an S-Corporation by timely filing Form 2553 with the Internal Revenue Service. The Members acknowledge the S-Corporation eligibility requirements, including the single-class-of-stock requirement and the prohibition on certain shareholders.',
    c_corp: 'The Company shall elect to be treated as an association taxable as a corporation by timely filing Form 8832 with the Internal Revenue Service.'
  })[t] || '';
}

function section754Language(t) {
  return ({
    mandatory_make: 'The Company shall make a valid and timely election under Section 754 of the Code effective as of the Company\u2019s first taxable year.',
    manager_discretion: 'The Manager may, in its discretion, cause the Company to make a valid and timely election under Section 754 of the Code if and when the Manager determines such election is beneficial. The Members acknowledge that a Section 754 election, once made, is binding for that taxable year and all subsequent years unless revoked with consent of the Commissioner.',
    member_request: 'Upon the written request of any Member acquiring a Membership Interest by purchase or transfer (other than by reason of contribution to the Company), the Manager shall cause the Company to make a valid and timely election under Section 754 of the Code.',
    no_election: 'The Company shall not make an election under Section 754 of the Code. The Members acknowledge that, notwithstanding the foregoing, an inside basis adjustment under Section 743(b) is mandatory in the case of a "substantial built-in loss" within the meaning of Section 743(d)(1).'
  })[t] || '';
}

function section752Label(t) {
  return ({
    profit_sharing_ratios: 'in proportion to the Members\u2019 respective Percentage Interests (representing the Members\u2019 shares of Company profits)',
    significant_item: 'using the "significant item" method, in proportion to the Members\u2019 shares of an item of nonrecourse-deduction-producing income',
    alternative: 'using the alternative method permitted under Treasury Regulation § 1.752-3(a)(3)',
    additional_method: 'using the additional method permitted under Treasury Regulation § 1.752-3(a)(3)'
  })[t] || 'in proportion to the Members\u2019 respective Percentage Interests';
}

function bbaPRLabel(t, managerName) {
  return ({
    manager: 'the Manager (or its designee)',
    specific_member: 'a specifically named Member to be designated in writing',
    third_party: 'an independent third party (such as the Company\u2019s outside CPA firm)',
    rotating: 'a Member to be designated annually on a rotating basis'
  })[t] || 'the Manager';
}

function pushOutLanguage(t) {
  return ({
    mandatory_for_audits: 'The Partnership Representative shall make a "push-out" election under Section 6226 of the Code for any imputed underpayment arising from any partnership-level audit adjustment, to the extent such election is available.',
    manager_discretion: 'The Partnership Representative may, in its discretion, make a "push-out" election under Section 6226 of the Code for any imputed underpayment arising from any partnership-level audit adjustment.',
    no_election: 'The Partnership Representative shall not make a "push-out" election under Section 6226 of the Code; any imputed underpayment shall be paid by the Company.'
  })[t] || '';
}

function indemnificationLanguage(t, isManagerManaged) {
  const role = isManagerManaged ? 'the Manager' : 'each Member';
  return ({
    standard: 'The Company shall indemnify ' + role + ' against any liability or expense (including reasonable attorneys\u2019 fees) arising out of any action taken in good faith on behalf of the Company. Expenses shall be advanced upon receipt of an undertaking to repay if it is ultimately determined that the indemnitee is not entitled to indemnification. Indemnification shall be mandatory to the extent the indemnitee prevails on the merits.',
    enhanced: 'The Company shall indemnify ' + role + ' to the fullest extent permitted by law against any liability or expense arising out of any action taken in good faith on behalf of the Company, with mandatory advance of expenses. The Company shall maintain a directors-and-officers liability insurance policy with a coverage limit of not less than [amount to be determined by the Members].',
    basic: 'The Company shall indemnify ' + role + ' against liabilities or expenses arising out of actions taken on behalf of the Company, except to the extent that such liabilities or expenses arise from acts or omissions constituting gross negligence or willful misconduct.'
  })[t] || '';
}

function confidentialityLanguage(t) {
  return ({
    standard: 'Each Member agrees that it will hold, and will cause its representatives to hold, in confidence all non-public information about the Company received in its capacity as a Member, and will not disclose such information except (i) to its tax, legal, and financial advisors who agree to maintain the confidentiality of such information, (ii) as required by law or regulatory process, or (iii) as expressly approved in writing by the Manager.',
    enhanced: 'Each Member agrees that it will hold all non-public Company information in strict confidence. Breach of this provision will result in liquidated damages of not less than ten thousand dollars ($10,000) per breach and shall entitle the Company to seek injunctive relief without proof of irreparable harm. This confidentiality obligation shall survive a Member\u2019s withdrawal from the Company for three (3) years.'
  })[t] || '';
}

function restrictiveCovenantsLanguage(t) {
  return ({
    non_solicit: 'For a period of two (2) years following a Member\u2019s withdrawal from or transfer of its Membership Interest in the Company, the Member shall not solicit any employee, contractor, or consultant of the Company.',
    full: 'For a period of two (2) years following a Member\u2019s withdrawal from or transfer of its Membership Interest in the Company, the Member shall not (i) directly or indirectly engage in a business that competes with the Company in any geographic area where the Company conducts business, or (ii) solicit any employee, contractor, customer, or counterparty of the Company. The Members acknowledge that the foregoing restrictions are reasonable in scope and duration; if any court determines otherwise, the restrictions shall be reformed to the maximum extent enforceable.'
  })[t] || '';
}

function disputeResolutionLanguage(t, s, forumCode) {
  const st = s || stateInfo('DE');
  const forumInfo = forumCode ? (STATES[forumCode] || null) : null;
  const forumName = forumInfo ? forumInfo.name : (forumCode ? stateNameFromCode(forumCode) : st.name);
  const isDE = (forumCode ? forumCode : st.code) === 'DE';
  const chosen = !!forumCode && forumCode !== st.code;
  const note = chosen ? ' <em>[Drafting note: the Members have selected a forum outside the formation state. The governing law remains ' + st.name + ' law for the Company\u2019s internal affairs; the forum clause is enforceable only if the chosen courts have a basis for jurisdiction over each Member.]</em>' : '';
  return ({
    delaware_chancery: (isDE
      ? 'Any dispute arising out of or relating to this Agreement shall be resolved exclusively in the Court of Chancery of the State of Delaware, and each Member hereby submits to the jurisdiction of that court.'
      : 'Any dispute arising out of or relating to this Agreement shall be resolved exclusively in the state courts of the State of ' + forumName + (chosen ? '' : ' sitting in the county in which the Company\u2019s principal office is located') + ' (or the business or chancery division of such courts, if one exists), and each Member hereby submits to the jurisdiction of those courts.') + note,
    mediation_then_aaa: 'Any dispute arising out of or relating to this Agreement shall first be submitted to mediation under the Commercial Mediation Procedures of the American Arbitration Association. If mediation does not resolve the dispute within sixty (60) days, the dispute shall be submitted to binding arbitration under the AAA Commercial Arbitration Rules, with the seat of arbitration in Wilmington, Delaware.',
    aaa_arbitration: 'Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration under the AAA Commercial Arbitration Rules, with the seat of arbitration in the State of ' + forumName + (chosen ? '' : ', in the county in which the Company\u2019s principal office is located') + '.' + note,
    jams_arbitration: 'Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration under the JAMS Comprehensive Arbitration Rules, with the seat of arbitration in the State of ' + forumName + '.' + note,
    state_court_only: 'Any dispute arising out of or relating to this Agreement shall be resolved exclusively in a state court of competent jurisdiction in the State of ' + forumName + '.' + note
  })[t] || '';
}

function signatureBlocks(state) {
  if (!state.members || state.members.length === 0) {
    return '<p><em>[Signature blocks for each Member to be completed by counsel.]</em></p>';
  }
  let html = '<div class="doc-sigs">';
  state.members.forEach(function (m) {
    html += '<div class="doc-sig-block">'
      + '<div class="doc-sig-line">__________________________________________</div>'
      + '<div class="doc-sig-name">' + esc(m.name || '[Member Name]') + '</div>'
      + '<div class="doc-sig-type">' + esc(memberTypeLabel(m.type)) + '</div>'
      + (m.type !== 'individual' ? '<div class="doc-sig-byname">By: __________________________</div><div class="doc-sig-title">Title: __________________________</div>' : '')
      + '</div>';
  });
  html += '</div>';
  return html;
}

// -----------------------------------------------------------------------------
// generateSubscriptionAgreement
// -----------------------------------------------------------------------------
function generateSubscriptionAgreement(state) {
  const s = stateInfo(state.jurisdiction);
  const companyName = state.company_name || '[Company Name]';
  const sec = state.securities_level || 'level_0';
  let html = '';

  html += docHeader('Subscription Agreement', state);
  html += docDisclaimer(state, sec);

  html += '<p>This Subscription Agreement (this "<strong>Subscription Agreement</strong>") is entered into as of the date set forth on the signature page by and between ' + esc(dlCompanyName(companyName)) + ', a ' + esc(s.name) + ' limited liability company (the "<strong>Company</strong>"), and the undersigned subscriber (the "<strong>Subscriber</strong>").</p>';

  html += '<h2>1. Subscription</h2>'
    + '<p>The Subscriber hereby irrevocably subscribes for that number of ' + esc(state.securities_description || 'Membership Interests') + ' (the "<strong>Interests</strong>") set forth on the signature page, at the aggregate subscription price set forth on the signature page (the "<strong>Subscription Amount</strong>"). The Subscriber tenders the Subscription Amount in immediately-available funds concurrently with the execution of this Subscription Agreement.</p>'
    + '<p>The Subscriber acknowledges that the Subscription Amount shall be applied to the Subscriber\u2019s Capital Contribution and Percentage Interest as set forth on Schedule A of the Operating Agreement, as the same shall be updated upon the Company\u2019s acceptance of this Subscription Agreement.</p>';

  html += '<h2>2. Acceptance</h2>'
    + '<p>This subscription is conditioned upon, and shall not become effective until, acceptance by the Company. The Company may accept or reject this subscription, in whole or in part, in its sole discretion. If the Company rejects this subscription in whole or in part, the Subscription Amount (or the rejected portion thereof) shall be returned to the Subscriber without interest.</p>';

  html += '<h2>3. Representations and Warranties of the Subscriber</h2>'
    + '<p>The Subscriber represents and warrants to the Company that:</p>'
    + '<ol class="doc-numbered">'
    + '<li><strong>Authority.</strong> The Subscriber has full power and authority to execute and deliver this Subscription Agreement and the Joinder Agreement attached as Exhibit A, and to consummate the transactions contemplated hereby.</li>'
    + '<li><strong>Investment Intent.</strong> The Subscriber is acquiring the Interests for the Subscriber\u2019s own account, for investment purposes only, and not with a view to, or for resale in connection with, the distribution thereof. The Subscriber has no present intention of selling, granting any participation in, or otherwise distributing the Interests.</li>'
    + '<li><strong>No Registration; Restricted Securities.</strong> The Subscriber understands that the Interests have not been registered under the Securities Act of 1933, as amended (the "<strong>Securities Act</strong>"), or under any state securities laws, and that the Interests are "restricted securities" within the meaning of Rule 144 under the Securities Act. The Subscriber understands that the Interests may not be sold, transferred, pledged, or otherwise disposed of except pursuant to an effective registration statement or an available exemption from registration.</li>'
    + (sec === 'level_1'
        ? '<li><strong>Accredited Investor Status.</strong> The Subscriber is an "accredited investor" within the meaning of Rule 501(a) of Regulation D under the Securities Act, OR the Subscriber is a non-accredited investor with sufficient business and financial sophistication to evaluate the merits and risks of the investment. The Subscriber has completed and delivered the Accredited Investor Questionnaire attached as Exhibit B.</li>'
        : '<li><strong>Active Member Status.</strong> The Subscriber acknowledges that this transaction has been structured as an operating-member joint venture in which the Subscriber will be actively involved in management of the Company\u2019s business and economic destiny, and that the Interests are not being treated as "securities" subject to registration under the Securities Act or applicable state blue-sky laws. The Subscriber represents that the Subscriber has the experience, knowledge, and financial resources appropriate for active participation in such a joint venture.</li>')
    + '<li><strong>Receipt of Information.</strong> The Subscriber has received, reviewed, and had the opportunity to ask questions concerning: (i) this Subscription Agreement; (ii) the Operating Agreement (as it will be in effect immediately following the closing); (iii) the ' + (sec === 'level_1' ? 'Risk Disclosure Letter' : 'JV Securities Analysis Memorandum') + '; and (iv) such other information as the Subscriber has requested.</li>'
    + '<li><strong>Risk; No Guarantee.</strong> The Subscriber has reviewed and understands the risks set forth in the ' + (sec === 'level_1' ? 'Risk Disclosure Letter' : 'JV Securities Analysis Memorandum') + ' and is willing and able to bear the economic risk of the investment, including the risk of a complete loss of the Subscriber\u2019s investment. The Subscriber understands that the Company has provided no assurance, representation, or guarantee with respect to the future financial performance of the Company.</li>'
    + '<li><strong>Tax Matters.</strong> The Subscriber has consulted, or has had the opportunity to consult, with the Subscriber\u2019s own tax, legal, and financial advisors regarding the federal, state, and local tax consequences of the investment. The Subscriber acknowledges that the Company is treated as a partnership for U.S. federal income tax purposes and that the Subscriber will receive a Schedule K-1 each year reporting the Subscriber\u2019s allocable share of partnership items.</li>'
    + '<li><strong>No Reliance.</strong> The Subscriber has not relied on any representation or warranty of the Company or its representatives other than those expressly set forth in the Operating Agreement and this Subscription Agreement.</li>'
    + '</ol>';

  html += '<h2>4. Adoption of Operating Agreement</h2>'
    + '<p>By signing this Subscription Agreement, the Subscriber hereby adopts, ratifies, and agrees to be bound by the Operating Agreement of the Company as if the Subscriber were an original signatory thereto. The Subscriber agrees to execute and deliver the Joinder Agreement attached as Exhibit A.</p>';

  html += '<h2>5. Miscellaneous</h2>'
    + '<p>This Subscription Agreement shall be governed by and construed in accordance with the laws of the State of ' + esc(s.name) + '. This Subscription Agreement may be executed in counterparts, each of which shall be deemed an original.</p>';

  // Signature & subscription block
  html += '<h2>Signature</h2>'
    + '<div class="doc-sub-block">'
    + '<div>Name of Subscriber: ____________________________________________</div>'
    + '<div style="margin-top:0.5rem;">Subscription Amount: $____________________________</div>'
    + '<div style="margin-top:0.5rem;">Date: __________________________</div>'
    + '<div style="margin-top:1rem;">Signature: __________________________________________</div>'
    + '<div style="margin-top:0.25rem;">By (if entity Subscriber): __________________________</div>'
    + '<div style="margin-top:0.25rem;">Title: __________________________</div>'
    + '</div>';

  html += '<h2>Accepted by the Company</h2>'
    + '<div class="doc-sub-block">'
    + '<div>' + esc(dlCompanyName(companyName)) + '</div>'
    + '<div style="margin-top:0.5rem;">By: __________________________________________</div>'
    + '<div style="margin-top:0.25rem;">Name: __________________________</div>'
    + '<div style="margin-top:0.25rem;">Title: ' + (state.management_structure === 'manager_managed' ? 'Manager' : 'Authorized Member') + '</div>'
    + '<div style="margin-top:0.25rem;">Date: __________________________</div>'
    + '</div>';

  return '<div class="doc-page">' + html + '</div>';
}

// -----------------------------------------------------------------------------
// generateJoinder
// -----------------------------------------------------------------------------
function generateJoinder(state) {
  const s = stateInfo(state.jurisdiction);
  const companyName = state.company_name || '[Company Name]';
  let html = '';

  html += docHeader('Joinder Agreement', state);
  html += docDisclaimer(state, state.securities_level);

  html += '<p>This Joinder Agreement (this "<strong>Joinder</strong>") is entered into as of the date set forth on the signature page by the undersigned (the "<strong>Joining Member</strong>") and is delivered to ' + esc(dlCompanyName(companyName)) + ', a ' + esc(s.name) + ' limited liability company (the "<strong>Company</strong>"), and the existing Members of the Company.</p>';

  html += '<h2>1. Joinder</h2>'
    + '<p>The Joining Member hereby (i) acknowledges receipt of the Operating Agreement of the Company dated ' + esc(dlLongDate(state.effective_date || todayISO())) + ' (as amended, the "<strong>Operating Agreement</strong>"), (ii) accepts and agrees to be bound by all of the terms, conditions, and provisions of the Operating Agreement as if the Joining Member were a signatory to the Operating Agreement as a Member, and (iii) shall be admitted to the Company as a Member with the Capital Contribution and Percentage Interest set forth on the signature page.</p>';

  html += '<h2>2. Representations</h2>'
    + '<p>The Joining Member represents and warrants to the Company and to each other Member that: (a) the Joining Member has full power and authority to execute and deliver this Joinder; (b) the Joining Member has read and understands the Operating Agreement; (c) the Joining Member is acquiring its Membership Interest for the Joining Member\u2019s own account, for investment purposes only; and (d) the Joining Member has consulted, or has had the opportunity to consult, with the Joining Member\u2019s own tax, legal, and financial advisors.</p>';

  html += '<h2>3. Schedule A Amendment</h2>'
    + '<p>Upon execution of this Joinder, Schedule A to the Operating Agreement shall be amended automatically to reflect the Joining Member\u2019s admission, Capital Contribution, and Percentage Interest, without further action by any other Member.</p>';

  html += '<h2>4. Governing Law</h2>'
    + '<p>This Joinder shall be governed by the laws of the State of ' + esc(s.name) + '.</p>';

  html += '<h2>Signature</h2>'
    + '<div class="doc-sub-block">'
    + '<div>Name of Joining Member: ________________________________________</div>'
    + '<div style="margin-top:0.5rem;">Type of Member: __________________________</div>'
    + '<div style="margin-top:0.5rem;">Notice Address: __________________________________________</div>'
    + '<div style="margin-top:0.5rem;">Capital Contribution: $____________________________</div>'
    + '<div style="margin-top:0.5rem;">Percentage Interest: ______________%</div>'
    + '<div style="margin-top:0.5rem;">Date: __________________________</div>'
    + '<div style="margin-top:1rem;">Signature: __________________________________________</div>'
    + '<div style="margin-top:0.25rem;">By (if entity Joining Member): __________________________</div>'
    + '<div style="margin-top:0.25rem;">Title: __________________________</div>'
    + '</div>';

  return '<div class="doc-page">' + html + '</div>';
}

// -----------------------------------------------------------------------------
// generateJVMemo — Securities Level 0
// -----------------------------------------------------------------------------
function generateJVMemo(state) {
  const companyName = state.company_name || '[Company Name]';
  const s = stateInfo(state.jurisdiction);
  let html = '';

  html += docHeader('Joint Venture Securities Analysis Memorandum', state);
  html += docDisclaimer(state, 'level_0');

  html += '<h2>1. Purpose</h2>'
    + '<p>This Memorandum analyzes whether the Membership Interests in ' + esc(dlCompanyName(companyName)) + ' (the "<strong>Company</strong>") constitute "securities" subject to registration under the Securities Act of 1933 (the "<strong>Securities Act</strong>") or applicable state blue-sky laws. The Members of the Company have structured the venture as an operating-member joint venture in which each Member is actively engaged in the management of the Company\u2019s business and shares in the economic destiny of the venture.</p>';

  html += '<h2>2. The Howey Test</h2>'
    + '<p>Under <em>SEC v. W.J. Howey Co.</em>, 328 U.S. 293 (1946), an investment constitutes an "investment contract" subject to federal securities regulation if it involves (i) an investment of money (ii) in a common enterprise (iii) with an expectation of profits (iv) solely from the efforts of others. The fourth element \u2014 reliance "solely" (or, post-Howey, "predominantly") on the efforts of others \u2014 is the dispositive question in operating-member joint ventures.</p>';

  html += '<h2>3. The Williamson Factors</h2>'
    + '<p>The Fifth Circuit decision in <em>Williamson v. Tucker</em>, 645 F.2d 404 (5th Cir. 1981), provides the governing framework for distinguishing operating-member joint ventures from passive investment vehicles. Under <em>Williamson</em>, a general partnership or joint venture interest is presumed not to be a security unless one of the following factors is present:</p>'
    + '<ol class="doc-numbered">'
    + '<li>the agreement among the parties leaves so little power in the hands of the partner or venturer that the arrangement in fact distributes power as would a limited partnership;</li>'
    + '<li>the partner or venturer is so inexperienced and unknowledgeable in business affairs that he is incapable of intelligently exercising his partnership or venture powers; or</li>'
    + '<li>the partner or venturer is so dependent on some unique entrepreneurial or managerial ability of the promoter or manager that he cannot replace the manager or otherwise exercise meaningful partnership or venture powers.</li>'
    + '</ol>';

  html += '<h2>4. Analysis</h2>'
    + '<p>The Operating Agreement of the Company has been drafted to support the joint-venture conclusion as follows:</p>'
    + '<ul class="doc-bullets">'
    + '<li><strong>Distribution of power.</strong> The Operating Agreement reserves Major Decisions (sale of all or substantially all assets, merger, dissolution, amendment, admission of new Members, material tax elections, affiliate transactions, and changes in business purpose) to the Members at a ' + thresholdLabel(state.major_decision_threshold) + ' threshold. ' + (state.management_structure === 'member_managed' ? 'The Company is Member-Managed; each Member has direct authority over day-to-day operations.' : 'Although the Company is Manager-Managed, the scope of Manager authority is constrained by the Major Decisions provisions, and Members retain removal and amendment rights.') + '</li>'
    + '<li><strong>Member experience.</strong> Each Member has represented in its Subscription Agreement that the Member has the experience, knowledge, and financial resources appropriate for active participation in a joint venture.</li>'
    + '<li><strong>Replaceable manager.</strong> ' + (state.manager_removal === 'cause_only' ? 'The Manager (if any) is replaceable for Cause as defined in the Operating Agreement, with a curable-default mechanism preserving Member control.' : 'The Manager (if any) is replaceable upon a Member vote, demonstrating that the venture\u2019s success is not dependent on any unique managerial ability of a particular person.') + '</li>'
    + '</ul>';

  html += '<h2>5. Conclusion</h2>'
    + '<p>Based on the foregoing, the Members intend to take the position &mdash; a position counsel has not yet reviewed and must confirm before any interest is issued &mdash; that the Membership Interests should not be treated as "securities" subject to registration under the Securities Act or applicable state blue-sky laws. The Members nonetheless acknowledge that the joint-venture analysis is fact-specific and that future changes to the Operating Agreement or to the operation of the Company could alter this conclusion, particularly if such changes diminish the active management role of any Member or expand the Manager\u2019s unilateral authority.</p>'
    + '<p>The Members further acknowledge that, even if the Membership Interests are not "securities" for registration purposes, the antifraud provisions of the federal and state securities laws (including Section 17 of the Securities Act and Section 10(b) of the Securities Exchange Act of 1934) apply to all transactions in the Interests, and the Members agree to conduct themselves accordingly.</p>';

  html += '<h2>6. Caveats</h2>'
    + '<p>This Memorandum addresses only the question of "investment contract" status under <em>Howey</em> and <em>Williamson</em>. It does not address: (i) any state-law analysis under non-conforming state securities statutes; (ii) any analysis under the Investment Company Act of 1940; (iii) any analysis under the Investment Advisers Act of 1940; (iv) any registration or licensing obligations of any Member or Manager; or (v) any analysis of the tax treatment of the Membership Interests.</p>'
    + '<p>This Memorandum is a draft prepared by an automated assembly tool and has not been reviewed or finalized by counsel. It does not constitute legal advice.</p>';

  return '<div class="doc-page">' + html + '</div>';
}

// -----------------------------------------------------------------------------
// generateRiskDisclosureLetter — Securities Level 1
// -----------------------------------------------------------------------------
function generateRiskDisclosureLetter(state) {
  const companyName = state.company_name || '[Company Name]';
  const s = stateInfo(state.jurisdiction);
  let html = '';

  html += docHeader('Risk Disclosure Letter', state);
  html += docDisclaimer(state, 'level_1');

  html += '<h2>Purpose and Use of This Letter</h2>'
    + '<p>This Risk Disclosure Letter (this "<strong>Letter</strong>") accompanies the offering by ' + esc(dlCompanyName(companyName)) + ' (the "<strong>Company</strong>") of its ' + esc(state.securities_description || 'Membership Interests') + ' (the "<strong>Interests</strong>"). The Interests are being offered in reliance on the exemption provided by Rule 506(b) of Regulation D under the Securities Act of 1933 (the "<strong>Securities Act</strong>"). This Letter is intended to provide each prospective investor with material information about the Company, the proposed business, and the risks of the investment. It is delivered in lieu of (and not in addition to) a full Private Placement Memorandum, on the basis that the Members holding Interests under this offering will be limited to accredited investors and a small number of sophisticated non-accredited investors with a pre-existing relationship to the Manager.</p>';

  html += '<h2>The Offering</h2>'
    + '<ul class="doc-bullets">'
    + '<li><strong>Issuer:</strong> ' + esc(dlCompanyName(companyName)) + ', a ' + esc(s.name) + ' limited liability company.</li>'
    + '<li><strong>Securities Offered:</strong> ' + esc(state.securities_description || 'Membership Interests') + '.</li>'
    + (state.securities_target_raise ? '<li><strong>Target Raise:</strong> ' + esc(state.securities_target_raise) + '.</li>' : '')
    + (state.securities_min_subscription ? '<li><strong>Minimum Subscription per Investor:</strong> ' + esc(state.securities_min_subscription) + '.</li>' : '')
    + (state.securities_max_investors ? '<li><strong>Maximum Number of Investors:</strong> ' + esc(state.securities_max_investors) + '.</li>' : '')
    + (state.offering_period ? '<li><strong>Offering Period:</strong> Up to ' + esc(state.offering_period) + ' months to close.</li>' : '')
    + (state.anticipated_hold ? '<li><strong>Anticipated Hold Period:</strong> ' + esc(state.anticipated_hold) + ' years.</li>' : '')
    + '<li><strong>Exemption Relied Upon:</strong> Rule 506(b) of Regulation D under the Securities Act. No general solicitation or general advertising has been or will be used in connection with this offering.</li>'
    + '</ul>';

  if (state.project_description) {
    html += '<h2>Business Description</h2>'
      + '<p>' + esc(state.project_description).replace(/\n/g, '<br>') + '</p>';
  }

  if (state.use_of_proceeds) {
    html += '<h2>Use of Proceeds</h2>'
      + '<pre class="doc-pre">' + esc(state.use_of_proceeds) + '</pre>';
  }

  html += '<h2>Risk Factors</h2>'
    + '<p>An investment in the Interests is highly speculative and involves substantial risk. Prospective investors should carefully consider, among other things, the following risks before making an investment decision:</p>'
    + '<ol class="doc-numbered">'
    + '<li><strong>Speculative Investment; Risk of Loss.</strong> An investment in the Interests is speculative. There can be no assurance that the Company will achieve its objectives. Investors may lose all or substantially all of their investment.</li>'
    + '<li><strong>Illiquidity.</strong> The Interests have not been registered under the Securities Act or under any state securities laws. The Interests are subject to substantial transfer restrictions under the Operating Agreement. There is and will be no public market for the Interests, and none is expected to develop. Investors must be prepared to hold the Interests indefinitely.</li>'
    + '<li><strong>Limited Information; Reliance on Manager.</strong> Although this Letter contains information about the Company\u2019s proposed business, it does not contain all the information that an investor might consider material. The Company is a newly-formed entity and has no operating history. Investors will rely on the Manager for management decisions and for periodic reporting.</li>'
    + '<li><strong>Tax Risks.</strong> The Company will be treated as a partnership for U.S. federal income tax purposes. Investors will receive a Schedule K-1 each year and will be required to report their allocable share of partnership items on their personal returns. Allocations may include phantom income (taxable income without corresponding cash distributions). Tax laws and rates are subject to change; the Company makes no representation about the tax results of an investment.</li>'
    + '<li><strong>Real Estate Risks.</strong> Real estate investments are subject to risks including changes in market value, vacancy and re-leasing risk, casualty, environmental liabilities, interest-rate movements, refinancing risk, tenant credit, and changes in zoning, taxation, and regulation.</li>'
    + '<li><strong>Leverage Risk.</strong> The Company is expected to use leverage. Leverage magnifies both gains and losses. A material decline in asset value could result in margin calls, foreclosure, or loss of the investment.</li>'
    + '<li><strong>Distributions Not Guaranteed.</strong> Distributions are subject to Available Cash, the discretion of the Manager (subject to the Operating Agreement), and the requirements of any senior lender. There can be no assurance that distributions will be made on the schedule described in the Operating Agreement or at all.</li>'
    + '<li><strong>Conflicts of Interest.</strong> The Manager and its Affiliates may pursue other business opportunities, including opportunities that compete with the Company. Affiliate-transaction protections in the Operating Agreement do not eliminate the possibility of conflicts.</li>'
    + '<li><strong>Dilution.</strong> Additional Capital Contributions, if permitted under the Operating Agreement, could dilute the Percentage Interests of non-contributing Members.</li>'
    + '<li><strong>Forward-Looking Statements.</strong> Any forward-looking statements provided by the Company or its representatives (including projections, pro formas, or models) are subject to material uncertainty and should not be relied upon as a guarantee of future performance.</li>'
    + '</ol>';

  html += '<h2>Suitability</h2>'
    + '<p>The Interests are suitable only for investors who: (i) have the financial resources to bear the loss of their entire investment; (ii) have no need for short-term liquidity from the investment; (iii) understand the speculative nature of the investment; and (iv) have evaluated, or have had the opportunity to evaluate, the investment with the assistance of their own tax, legal, and financial advisors.</p>';

  html += '<h2>Eligibility</h2>'
    + '<p>The Interests are offered only to (i) accredited investors within the meaning of Rule 501(a) of Regulation D and (ii) up to thirty-five (35) non-accredited investors with sufficient business and financial sophistication, in each case with a pre-existing relationship to the Manager. The Company will require an executed Accredited Investor Questionnaire from each subscriber before accepting any subscription.</p>';

  const anyNonAccredited = (state.members || []).some(function (m) { return m.accredited === false; });
  if (anyNonAccredited) {
    html += '<h2>Information Required for Non-Accredited Investors</h2>'
      + '<p><em>[Drafting note: at least one Member is marked non-accredited. Where any purchaser in a Rule 506(b) offering is not an accredited investor, Rule 502(b) requires the issuer to furnish, a reasonable time before sale, the non-financial and financial statement information specified in Rule 502(b)(2) &mdash; for a non-reporting issuer, the information called for by Part II of Form 1-A or Part I of a registration statement, scaled to offering size, and for offerings up to $20 million, financial statements of which at least the balance sheet must be audited. A lean risk letter does not satisfy Rule 502(b). Counsel must either restrict the offering to accredited investors or expand the disclosure.]</em></p>';
  }
  html += '<h2>No General Solicitation</h2>'
    + '<p>The offering is conducted in reliance on Rule 506(b), which does not permit general solicitation or general advertising. The Company and its Manager have not engaged in any such conduct in connection with this offering and will not do so.</p>';

  html += '<h2>Confidentiality</h2>'
    + '<p>This Letter is being furnished to prospective investors on a confidential basis. Each recipient agrees not to reproduce or distribute this Letter, in whole or in part, to any third party without the prior written consent of the Manager, except to the recipient\u2019s tax, legal, and financial advisors who agree to be bound by these confidentiality obligations.</p>';

  html += '<p style="margin-top:2rem;"><em>This Risk Disclosure Letter is a draft prepared by an automated assembly tool and has not been reviewed or finalized by counsel. It is not, and is not intended to be, an offer to sell or a solicitation of an offer to buy any securities. Final terms of the offering will be set forth in the executed Subscription Agreement and the Operating Agreement.</em></p>';

  return '<div class="doc-page">' + html + '</div>';
}

// =============================================================================
// REVIEW SUMMARY
// =============================================================================
function generateReviewSummary(state) {
  const s = stateInfo(state.jurisdiction);
  const sec = SEC_LEVELS[state.securities_level] || SEC_LEVELS.level_0;
  const totalCapital = (state.members || []).reduce(function (acc, m) { return acc + (Number(m.capital) || 0); }, 0);
  const totalPercent = (state.members || []).reduce(function (acc, m) { return acc + (Number(m.percentage) || 0); }, 0);

  let html = '<div class="oa-review-grid">';

  html += '<div class="oa-review-section"><h3>Company &amp; Jurisdiction</h3><dl>'
    + '<dt>Company Name</dt><dd>' + esc(state.company_name ? dlCompanyName(state.company_name) : '[not set]') + '</dd>'
    + '<dt>Formation State</dt><dd>' + esc(s.name) + ' (' + esc(s.actCite) + ')</dd>'
    + '<dt>Effective Date</dt><dd>' + esc(state.effective_date || '[not set]') + '</dd>'
    + '<dt>Principal Office</dt><dd>' + esc(state.principal_street || '[not set]') + (state.principal_csz ? ', ' + esc(state.principal_csz) : '') + '</dd>'
    + '<dt>Registered Agent</dt><dd>' + esc(state.ra_name || '[not set]') + '</dd>'
    + '<dt>Filing Office</dt><dd>' + esc(s.formationFilingOffice) + '</dd>'
    + '<dt>Filing Fee</dt><dd>' + formatCurrency(s.filingFee) + '</dd>'
    + '<dt>Annual Report</dt><dd>Due ' + esc(s.annualReportDue) + (s.annualReportFee ? ' &middot; ' + formatCurrency(s.annualReportFee) : '') + '</dd>'
    + '</dl></div>';

  html += '<div class="oa-review-section"><h3>Members &amp; Capital</h3><dl>'
    + '<dt>Number of Members</dt><dd>' + (state.members ? state.members.length : 0) + (state.members && state.members.length > MEMBER_SOFT_CAP ? ' <span class="oa-warn">(above ' + MEMBER_SOFT_CAP + '-member soft cap)</span>' : '') + '</dd>'
    + '<dt>Total Capital Contributions</dt><dd>' + formatCurrency(totalCapital) + '</dd>'
    + '<dt>Total Percentage Interest</dt><dd>' + (Math.abs(totalPercent - 1) < 0.0001 ? '100% <span class="oa-ok">&#10003;</span>' : (totalPercent * 100).toFixed(4).replace(/\.?0+$/, '') + '% <span class="oa-warn">(must total 100%)</span>') + '</dd>'
    + '</dl></div>';

  html += '<div class="oa-review-section"><h3>Management</h3><dl>'
    + '<dt>Structure</dt><dd>' + esc(({ member_managed: 'Member-Managed', manager_managed: 'Manager-Managed', board_managed: 'Board-Managed' })[state.management_structure] || '') + '</dd>'
    + (state.management_structure === 'manager_managed' ? '<dt>Manager</dt><dd>' + esc(state.manager_name || '[not set]') + '</dd>' : '')
    + '<dt>Major Decision Threshold</dt><dd>' + esc(thresholdLabel(state.major_decision_threshold)) + '</dd>'
    + '<dt>Fiduciary Duties</dt><dd>' + esc(({ default: 'Statutory default duties (as modified by the agreement)', eliminated_per_18_1101: 'Eliminated to maximum extent', modified_business_judgment: 'Modified business judgment', retained: 'Retained at common-law levels' })[state.fiduciary_duties] || '') + '</dd>'
    + '</dl></div>';

  html += '<div class="oa-review-section"><h3>Distributions</h3><dl>'
    + '<dt>Preferred Return</dt><dd>' + (state.pref_return_enabled ? pct(Number(state.pref_return_rate)) + ' &middot; ' + ({ simple: 'simple', annual: 'annual compounding', quarterly: 'quarterly compounding', monthly: 'monthly compounding' })[state.pref_return_compounding] + ' &middot; ' + (state.pref_return_cumulative === 'cumulative' ? 'cumulative' : 'non-cumulative') : 'None &mdash; pro-rata pure') + '</dd>'
    + '<dt>Timing</dt><dd>' + esc(({ quarterly: 'Quarterly', semi_annual: 'Semi-Annual', annual: 'Annual', manager_discretion: 'Manager Discretion' })[state.distribution_timing] || '') + '</dd>'
    + '<dt>Liquidating Distributions</dt><dd>' + (state.liquidation_method === 'per_capital_accounts' ? 'Per positive Capital Accounts' : 'Per waterfall (consistent with operating)') + '</dd>'
    + '</dl></div>';

  html += '<div class="oa-review-section"><h3>Tax</h3><dl>'
    + '<dt>Classification</dt><dd>' + esc(({ partnership: 'Partnership (Subchapter K)', s_corp: 'S-Corporation', c_corp: 'C-Corporation' })[state.tax_classification] || '') + '</dd>'
    + '<dt>§ 754 Election</dt><dd>' + esc(({ mandatory_make: 'Mandatory', manager_discretion: 'Manager discretion', member_request: 'Upon Member request', no_election: 'No election' })[state.section_754_election] || '') + '</dd>'
    + '<dt>§ 752 Method</dt><dd>' + esc(({ profit_sharing_ratios: 'Profit sharing ratios', significant_item: 'Significant item', alternative: 'Alternative', additional_method: 'Additional method' })[state.section_752_method] || '') + '</dd>'
    + '<dt>BBA PR</dt><dd>' + esc(({ manager: 'Manager', specific_member: 'Specific Member', third_party: 'Third party', rotating: 'Rotating' })[state.bba_pr_designation] || '') + '</dd>'
    + '<dt>Tax Distributions</dt><dd>' + esc(({ mandatory: 'Mandatory', permissive: 'Permissive', none: 'None' })[state.tax_distributions_enabled] || '') + '</dd>'
    + '</dl></div>';

  html += '<div class="oa-review-section"><h3>Transfers</h3><dl>'
    + '<dt>General Restriction</dt><dd>' + esc(({ strict_consent: 'Strict (all-Member consent)', consent_with_permitted: 'Majority consent', restricted_class: 'Class-specific', open_with_compliance: 'Open with compliance' })[state.transfer_general] || '') + '</dd>'
    + '<dt>ROFO / ROFR</dt><dd>' + (state.rofo === 'enabled' ? 'ROFO' : '') + (state.rofo === 'enabled' && state.rofr === 'enabled' ? ' + ROFR' : (state.rofr === 'enabled' ? 'ROFR' : '')) + ((state.rofo === 'disabled' && state.rofr === 'disabled') ? 'Neither' : '') + '</dd>'
    + '<dt>Drag-Along</dt><dd>' + (state.drag_along === 'enabled' ? 'Enabled (' + thresholdLabel(state.drag_along_threshold) + ')' : 'Not included') + '</dd>'
    + '<dt>Tag-Along</dt><dd>' + (state.tag_along === 'enabled' ? 'Enabled (' + tagAlongTriggerLabel(state.tag_along_trigger) + ')' : 'Not included') + '</dd>'
    + '</dl></div>';

  html += '<div class="oa-review-section"><h3>Securities &amp; Special</h3><dl>'
    + '<dt>Compliance Level</dt><dd>' + esc(sec.label) + '</dd>'
    + '<dt>Companion Doc</dt><dd>' + esc(sec.companionDoc) + '</dd>'
    + '<dt>SPE Covenants</dt><dd>' + esc(({ none: 'None', standard: 'Standard SPE covenants', standard_plus_independent: 'Standard SPE + Independent Manager' })[state.spe_provisions] || '') + '</dd>'
    + '<dt>Charging Order</dt><dd>' + esc(({ standard: 'Standard', enhanced: 'Enhanced', none: 'None' })[state.charging_order] || '') + '</dd>'
    + '<dt>Indemnification</dt><dd>' + esc(({ standard: 'Standard', enhanced: 'Enhanced (+D&O)', basic: 'Basic' })[state.indemnification] || '') + '</dd>'
    + '<dt>Dispute Resolution</dt><dd>' + esc(({ delaware_chancery: 'Delaware Chancery', mediation_then_aaa: 'Mediation → AAA', aaa_arbitration: 'AAA Arbitration', jams_arbitration: 'JAMS', state_court_only: 'State court' })[state.dispute_resolution] || '') + '</dd>'
    + '</dl></div>';

  html += '</div>';

  // Pre-flight checklist
  const warnings = [];
  if (!state.company_name) warnings.push('Company name is missing.');
  if (!state.principal_street) warnings.push('Principal office address is missing.');
  if (!state.ra_name) warnings.push('Registered agent is missing.');
  if (!state.members || state.members.length === 0) warnings.push('At least one Member is required.');
  if (state.members && state.members.length === 1) warnings.push('Multi-Member tool requires at least two Members (use the Single-Member tool instead).');
  if (state.members && state.members.length > MEMBER_SOFT_CAP) warnings.push('More than ' + MEMBER_SOFT_CAP + ' Members \u2014 consider whether the 12-step tool is more appropriate.');
  if (Math.abs(totalPercent - 1) > 0.0001 && state.members && state.members.length > 0) warnings.push('Member Percentage Interests must total 100% (currently ' + (totalPercent * 100).toFixed(4).replace(/\.?0+$/, '') + '%).');
  if (state.management_structure === 'manager_managed' && !state.manager_name) warnings.push('Manager name is required for Manager-Managed structure.');

  if (warnings.length > 0) {
    html += '<div class="oa-warn-block"><h3>Items to Address Before Final Generation</h3><ul>';
    warnings.forEach(function (w) { html += '<li>' + esc(w) + '</li>'; });
    html += '</ul></div>';
  } else {
    html += '<div class="oa-ok-block"><h3>Configuration Complete</h3><p>All required fields are populated. Click "Generate Draft Documents" below to produce the document set.</p></div>';
  }

  return html;
}

// =============================================================================
// DOC SET BUILDER — returns map of doc-key -> HTML
// =============================================================================
function buildDocumentSet(state) {
  const docs = {
    op_agreement: { title: 'Operating Agreement', html: generateOperatingAgreement(state) },
    subscription: { title: 'Subscription Agreement', html: generateSubscriptionAgreement(state) },
    joinder: { title: 'Joinder Agreement', html: generateJoinder(state) }
  };
  if (state.securities_level === 'level_0') {
    docs.jv_memo = { title: 'JV Securities Memo', html: generateJVMemo(state) };
  } else if (state.securities_level === 'level_1') {
    docs.risk_letter = { title: 'Risk Disclosure Letter', html: generateRiskDisclosureLetter(state) };
  }
  return docs;
}

// =============================================================================
// UI BINDINGS — only run in browser
// =============================================================================
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', function () { initTool(); });
}

// Module-level state cache — single instance per page load
let toolState = defaultState();

function initTool() {
  if (isPublic()) {
    // Public gate — no tool initialization
    return;
  }
  populateJurisdictionDropdown();
  bindFields();
  bindNavigation();
  bindMembersList();
  renderMembers();
  bindGenerate();
  loadStateFromStorage();
  renderMembers();
  syncFieldsFromState();
}

function populateJurisdictionDropdown() {
  const sel = document.getElementById('jurisdiction');
  if (!sel) return;
  sel.innerHTML = '';
  STATE_CODES.forEach(function (code) {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = STATES[code].name;
    sel.appendChild(opt);
  });
  sel.value = toolState.jurisdiction;
  const helpEl = document.getElementById('jurisdiction_help');
  if (helpEl) helpEl.innerHTML = STATES[sel.value].note;
  sel.addEventListener('change', function () {
    toolState.jurisdiction = sel.value;
    if (helpEl) helpEl.innerHTML = STATES[sel.value].note;
    saveStateToStorage();
  });
}

function bindFields() {
  dlBindAddressBlocks(document);
  // Simple input/select bindings — id matches state key
  const fields = [
    'company_name', 'effective_date', 'principal_street', 'principal_csz',
    'principal_street2', 'principal_city', 'principal_state', 'principal_zip',
    'ra_name', 'ra_street', 'ra_csz', 'ra_city', 'ra_state', 'ra_zip', 'business_purpose', 'business_purpose_detail',
    'management_structure', 'manager_name', 'fiduciary_duties',
    'major_decision_threshold', 'manager_removal',
    'pref_return_rate', 'pref_return_compounding', 'pref_return_cumulative',
    'distribution_timing', 'liquidation_method',
    'tax_classification', 'section_754_election', 'section_752_method',
    'qualified_nonrecourse_method', 'bba_pr_designation', 'bba_designated_individual',
    'push_out_election', 'tax_year', 'accounting_method', 'tax_distributions_enabled',
    'assumed_tax_rate', 'assumed_tax_rate_custom', 'tax_distribution_treatment',
    'transfer_general', 'rofo', 'rofr', 'drag_along', 'drag_along_threshold',
    'tag_along', 'tag_along_trigger',
    'securities_level', 'securities_target_raise', 'securities_min_subscription',
    'securities_max_investors', 'property_location', 'anticipated_hold',
    'offering_period', 'securities_description', 'project_description',
    'use_of_proceeds', 'blue_sky_states',
    'spe_provisions', 'charging_order', 'indemnification', 'confidentiality',
    'restrictive_covenants', 'dispute_resolution', 'forum_state', 'additional_capital_mode'
  ];
  fields.forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function () {
      toolState[id] = el.value;
      saveStateToStorage();
      handleConditionalDisplay();
    });
    el.addEventListener('input', function () {
      toolState[id] = el.value;
      saveStateToStorage();
    });
  });

  // Pref return checkbox
  const prefEnable = document.getElementById('pref_return_enabled');
  if (prefEnable) {
    prefEnable.addEventListener('change', function () {
      toolState.pref_return_enabled = prefEnable.checked;
      saveStateToStorage();
      handleConditionalDisplay();
    });
  }

  // Contribution acknowledgement
  const ack = document.getElementById('contribution_acknowledgement');
  if (ack) {
    ack.addEventListener('change', function () {
      toolState.contribution_acknowledgement = ack.checked;
      saveStateToStorage();
    });
  }

  // Major decisions checkboxes
  Object.keys(toolState.major_decisions).forEach(function (key) {
    const el = document.getElementById('md_' + key);
    if (!el) return;
    el.addEventListener('change', function () {
      toolState.major_decisions[key] = el.checked;
      saveStateToStorage();
    });
  });

  // Permitted transferees checkboxes
  Object.keys(toolState.permitted_transferees).forEach(function (key) {
    const el = document.getElementById('pt_' + key);
    if (!el) return;
    el.addEventListener('change', function () {
      toolState.permitted_transferees[key] = el.checked;
      saveStateToStorage();
    });
  });
}

function handleConditionalDisplay() {
  const rateSel = document.getElementById('assumed_tax_rate');
  const rateCustom = document.getElementById('assumed_tax_rate_custom');
  if (rateSel && rateCustom) rateCustom.style.display = rateSel.value === 'custom' ? '' : 'none';
  // Show/hide manager name field
  const mgmtSel = document.getElementById('management_structure');
  const mgrBlock = document.getElementById('manager_name_block');
  if (mgmtSel && mgrBlock) {
    mgrBlock.style.display = mgmtSel.value === 'manager_managed' ? '' : 'none';
  }
  // Show/hide pref return details
  const prefEnable = document.getElementById('pref_return_enabled');
  const prefDetails = document.getElementById('pref_return_details');
  if (prefEnable && prefDetails) {
    prefDetails.style.display = prefEnable.checked ? '' : 'none';
  }
  // Show/hide Level 1 fields
  const secLevel = document.getElementById('securities_level');
  const level1Block = document.getElementById('securities_level_1_block');
  if (secLevel && level1Block) {
    level1Block.style.display = secLevel.value === 'level_1' ? '' : 'none';
  }
}

function bindNavigation() {
  // Sidebar nav
  document.querySelectorAll('.oa-nav-item').forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      const target = el.getAttribute('data-panel');
      activatePanel(target);
    });
  });
  // Continue / Back buttons
  document.querySelectorAll('[data-next]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activatePanel(btn.getAttribute('data-next'));
    });
  });
  document.querySelectorAll('[data-prev]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      activatePanel(btn.getAttribute('data-prev'));
    });
  });
  // Save / Load / Reset
  const saveBtn = document.getElementById('btn_save_state');
  if (saveBtn) saveBtn.addEventListener('click', function () { saveStateToStorage(); flashMessage('Draft saved.'); });
  const loadBtn = document.getElementById('btn_load_state');
  if (loadBtn) loadBtn.addEventListener('click', function () { loadStateFromStorage(); syncFieldsFromState(); renderMembers(); flashMessage('Draft loaded.'); });
  const resetBtn = document.getElementById('btn_clear_state');
  if (resetBtn) resetBtn.addEventListener('click', function () {
    if (confirm('Clear all fields and start over? This cannot be undone.')) {
      toolState = defaultState();
      clearStorage();
      syncFieldsFromState();
      renderMembers();
      activatePanel('company');
      flashMessage('Draft reset.');
    }
  });
}

function activatePanel(name) {
  document.querySelectorAll('.oa-panel').forEach(function (p) {
    p.classList.remove('oa-panel-active');
    if (p.getAttribute('data-panel') === name) p.classList.add('oa-panel-active');
  });
  document.querySelectorAll('.oa-nav-item').forEach(function (n) {
    n.classList.remove('oa-nav-active');
    if (n.getAttribute('data-panel') === name) n.classList.add('oa-nav-active');
  });
  if (name === 'generate') {
    const summary = document.getElementById('review_summary');
    if (summary) summary.innerHTML = generateReviewSummary(toolState);
  }
  // Scroll to top of main panel
  const main = document.querySelector('.oa-main');
  if (main) main.scrollTop = 0;
}

// =============================================================================
// MEMBERS LIST CRUD
// =============================================================================
function bindMembersList() {
  const addBtn = document.getElementById('btn_add_member');
  if (addBtn) addBtn.addEventListener('click', function () { addMember(); });
  const eqBtn = document.getElementById('btn_equalize_members');
  if (eqBtn) eqBtn.addEventListener('click', function () { equalizeMembers(); });
}

function addMember() {
  const id = 'm_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  toolState.members.push({
    id: id,
    name: '',
    type: 'individual',
    address: '',
    capital: '',
    percentage: '',
    accredited: false
  });
  renderMembers();
  saveStateToStorage();
}

function removeMember(id) {
  toolState.members = toolState.members.filter(function (m) { return m.id !== id; });
  renderMembers();
  saveStateToStorage();
}

function equalizeMembers() {
  const n = toolState.members.length;
  if (n === 0) return;
  const equal = 1 / n;
  toolState.members.forEach(function (m) { m.percentage = equal; });
  // Also equalize capital if any contribution amounts have been entered
  const totalCap = toolState.members.reduce(function (acc, m) { return acc + (Number(m.capital) || 0); }, 0);
  if (totalCap > 0) {
    const eqCap = totalCap / n;
    toolState.members.forEach(function (m) { m.capital = Math.round(eqCap); });
  }
  renderMembers();
  saveStateToStorage();
}

function renderMembers() {
  const container = document.getElementById('members_list');
  if (!container) return;

  if (toolState.members.length === 0) {
    container.innerHTML = '<div class="oa-empty">No Members added yet. Click "+ Add Member" to begin.</div>';
    updateMembersSummary();
    return;
  }

  let html = '';
  toolState.members.forEach(function (m, idx) {
    html += '<div class="oa-member-row" data-id="' + m.id + '">'
      + '<div class="oa-member-num">Member ' + (idx + 1) + '</div>'
      + '<div class="oa-member-grid">'
      + '<div class="oa-field"><label>Name <span class="oa-req">*</span></label>'
      + '<input type="text" data-mfield="name" value="' + esc(m.name) + '" placeholder="Full legal name" /></div>'
      + '<div class="oa-field"><label>Type</label>'
      + '<select data-mfield="type">'
      + ['individual', 'trust', 'llc', 's_corp', 'c_corp', 'lp', 'ira', 'other'].map(function (t) {
        return '<option value="' + t + '"' + (m.type === t ? ' selected' : '') + '>' + memberTypeLabel(t) + '</option>';
      }).join('')
      + '</select></div>'
      + '<div class="oa-field oa-field-wide"><label>Notice Address</label>'
      + '<input type="text" data-mfield="addr_street" value="' + esc(m.addr_street || '') + '" placeholder="Street address" />'
      + '<input type="text" data-mfield="addr_street2" value="' + esc(m.addr_street2 || '') + '" placeholder="Suite, floor or unit (optional)" style="margin-top:0.5rem;" />'
      + '<div style="display:grid; grid-template-columns: 2fr 1.4fr 1fr; gap:0.5rem; margin-top:0.5rem;">'
      + '<input type="text" data-mfield="addr_city" value="' + esc(m.addr_city || '') + '" placeholder="City" />'
      + '<select data-mfield="addr_state">' + DL_STATE_OPTIONS.replace('value="' + esc(m.addr_state || '__none__') + '"', 'value="' + esc(m.addr_state || '__none__') + '" selected') + '</select>'
      + '<input type="text" data-mfield="addr_zip" value="' + esc(m.addr_zip || '') + '" placeholder="ZIP" inputmode="numeric" maxlength="10" />'
      + '</div></div>'
      + '<div class="oa-field"><label>Capital Contribution (cash, $)</label>'
      + '<input type="number" data-mfield="capital" value="' + esc(m.capital) + '" placeholder="0" min="0" step="1" /></div>'
      + '<div class="oa-field"><label>Percentage Interest (%)</label>'
      + '<input type="number" data-mfield="percentage_pct" value="' + (m.percentage === '' || m.percentage == null ? '' : esc(String(Math.round(Number(m.percentage) * 1000000) / 10000))) + '" placeholder="e.g., 50" min="0" max="100" step="0.01" /></div>'
      + '<div class="oa-field oa-field-check">'
      + '<label class="oa-check"><input type="checkbox" data-mfield="accredited"' + (m.accredited ? ' checked' : '') + ' /> Accredited investor (Reg D 506(b))</label>'
      + '</div>'
      + '</div>'
      + '<div class="oa-member-actions"><button class="oa-btn-ghost oa-btn-warn" data-action="remove">Remove Member</button></div>'
      + '</div>';
  });
  container.innerHTML = html;

  // Re-bind inputs
  container.querySelectorAll('.oa-member-row').forEach(function (row) {
    const id = row.getAttribute('data-id');
    row.querySelectorAll('[data-mfield]').forEach(function (input) {
      const field = input.getAttribute('data-mfield');
      const handler = function () {
        const m = toolState.members.find(function (x) { return x.id === id; });
        if (!m) return;
        if (field === 'accredited') {
          m.accredited = input.checked;
        } else if (field === 'capital') {
          m[field] = input.value === '' ? '' : Number(input.value);
        } else if (field === 'percentage_pct') {
          // Entered as a percent (50 = 50%); stored as the fraction the documents use.
          m.percentage = input.value === '' ? '' : Number(input.value) / 100;
        } else if (/^addr_/.test(field)) {
          m[field] = input.value;
          const cityLine = [m.addr_city, [m.addr_state, m.addr_zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
          m.address = [m.addr_street, m.addr_street2, cityLine].filter(Boolean).join(', ');
        } else {
          m[field] = input.value;
        }
        saveStateToStorage();
        updateMembersSummary();
      };
      input.addEventListener('change', handler);
      input.addEventListener('input', handler);
    });
    row.querySelector('[data-action="remove"]').addEventListener('click', function () {
      if (confirm('Remove this Member?')) removeMember(id);
    });
  });

  updateMembersSummary();
}

function updateMembersSummary() {
  const sum = document.getElementById('members_summary');
  if (!sum) return;
  const n = toolState.members.length;
  const totalCap = toolState.members.reduce(function (acc, m) { return acc + (Number(m.capital) || 0); }, 0);
  const totalPct = toolState.members.reduce(function (acc, m) { return acc + (Number(m.percentage) || 0); }, 0);
  const pctDisplay = (totalPct * 100).toFixed(4).replace(/\.?0+$/, '');
  const pctClass = Math.abs(totalPct - 1) < 0.0001 ? 'oa-ok' : 'oa-warn';
  const capClass = n >= 2 ? 'oa-ok' : 'oa-warn';
  let html = '<div class="oa-summary-line"><strong>Members:</strong> <span class="' + capClass + '">' + n + '</span>';
  if (n > MEMBER_SOFT_CAP) html += ' <span class="oa-warn">(above ' + MEMBER_SOFT_CAP + '-member soft cap)</span>';
  html += '</div>';
  html += '<div class="oa-summary-line"><strong>Total Capital:</strong> ' + formatCurrency(totalCap) + '</div>';
  html += '<div class="oa-summary-line"><strong>Total Percentage Interest:</strong> <span class="' + pctClass + '">' + pctDisplay + '%</span>';
  if (Math.abs(totalPct - 1) > 0.0001 && n > 0) html += ' <span class="oa-warn">(must total 100%)</span>';
  html += '</div>';
  sum.innerHTML = html;
}

// =============================================================================
// GENERATE
// =============================================================================
function bindGenerate() {
  const btn = document.getElementById('btn_generate');
  if (!btn) return;
  btn.addEventListener('click', function () {
    const docs = buildDocumentSet(toolState);
    renderGeneratedDocs(docs);
  });

  // Doc tab buttons (bound after generation)
  document.addEventListener('click', function (e) {
    if (!e.target.matches('.oa-doc-tab')) return;
    document.querySelectorAll('.oa-doc-tab').forEach(function (t) { t.classList.remove('oa-doc-tab-active'); });
    e.target.classList.add('oa-doc-tab-active');
    const key = e.target.getAttribute('data-doc');
    const pane = document.getElementById('doc_preview');
    if (pane && window.__GENERATED_DOCS && window.__GENERATED_DOCS[key]) {
      pane.innerHTML = window.__GENERATED_DOCS[key].html;
    }
  });

  const printBtn = document.getElementById('btn_print_doc');
  if (printBtn) printBtn.addEventListener('click', function () { dlPrintDocument(); });

  const copyBtn = document.getElementById('btn_copy_doc');
  if (copyBtn) copyBtn.addEventListener('click', function () {
    const pane = document.getElementById('doc_preview');
    if (!pane) return;
    // 2026-09-04: copied text carries the educational / not-for-signature header the print carries.
    const text = 'DRAFT — EDUCATIONAL — NOT FOR SIGNATURE\nPrepared with an educational drafting tool published by Donovan Legal PLLC. Not legal advice. Not reviewed by counsel. Not for filing or signature. Review with counsel before use: donovan.law/book\n\n' + (pane.innerText || pane.textContent || '');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { flashMessage('Copied to clipboard.'); });
    }
  });
}

function renderGeneratedDocs(docs) {
  window.__GENERATED_DOCS = docs;
  const container = document.getElementById('generated_docs');
  if (!container) return;
  container.style.display = '';

  const tabsBar = document.querySelector('.oa-doc-tabs');
  if (tabsBar) {
    tabsBar.innerHTML = '';
    let first = true;
    Object.keys(docs).forEach(function (k) {
      const btn = document.createElement('button');
      btn.className = 'oa-doc-tab' + (first ? ' oa-doc-tab-active' : '');
      btn.setAttribute('data-doc', k);
      btn.textContent = docs[k].title;
      tabsBar.appendChild(btn);
      first = false;
    });
  }

  const pane = document.getElementById('doc_preview');
  const firstKey = Object.keys(docs)[0];
  if (pane && firstKey) pane.innerHTML = docs[firstKey].html;
}

// =============================================================================
// STORAGE
// =============================================================================
const STORAGE_KEY = 'donovan_legal_ef_multi_draft_v1';
function saveStateToStorage() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toolState));
    }
  } catch (e) { /* storage unavailable; silent */ }
}
function loadStateFromStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const obj = JSON.parse(raw);
    // Shallow merge into a fresh default to ensure new keys are present
    const fresh = defaultState();
    Object.keys(obj).forEach(function (k) { fresh[k] = obj[k]; });
    toolState = fresh;
  } catch (e) { /* parse error; silent */ }
}
function clearStorage() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* silent */ }
}

function syncFieldsFromState() {
  Object.keys(toolState).forEach(function (k) {
    if (k === 'members' || k === 'major_decisions' || k === 'permitted_transferees') return;
    const el = document.getElementById(k);
    if (!el) return;
    if (el.type === 'checkbox') {
      el.checked = !!toolState[k];
    } else {
      el.value = toolState[k] == null ? '' : toolState[k];
    }
  });
  Object.keys(toolState.major_decisions).forEach(function (k) {
    const el = document.getElementById('md_' + k);
    if (el) el.checked = !!toolState.major_decisions[k];
  });
  Object.keys(toolState.permitted_transferees).forEach(function (k) {
    const el = document.getElementById('pt_' + k);
    if (el) el.checked = !!toolState.permitted_transferees[k];
  });
  const jurEl = document.getElementById('jurisdiction');
  if (jurEl) jurEl.value = toolState.jurisdiction;
  handleConditionalDisplay();
}

function flashMessage(text) {
  let el = document.getElementById('oa_flash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'oa_flash';
    el.className = 'oa-flash';
    document.body.appendChild(el);
  }
  el.textContent = text;
  el.classList.add('oa-flash-show');
  setTimeout(function () { el.classList.remove('oa-flash-show'); }, 2200);
}

// =============================================================================
// EXPORTS (for Node testing)
// =============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TIER, RAW_TIER,
    isPublic, isPlatinum, isReserve, isAtLeast, isMember,
    tierRank, TIER_LABEL,
    STATES, STATE_CODES, MEMBER_SOFT_CAP, SEC_LEVELS,
    defaultState,
    stateInfo, formatCurrency, formatPercent, pct,
    generateOperatingAgreement,
    generateSubscriptionAgreement,
    generateJoinder,
    generateJVMemo,
    generateRiskDisclosureLetter,
    generateReviewSummary,
    buildDocumentSet,
    memberTypeLabel,
    speLanguage, chargingOrderLanguage,
    additionalCapitalLanguage, taxDistributionsLanguage,
    section754Language, taxClassificationLanguage,
    indemnificationLanguage, disputeResolutionLanguage,
    transferGeneralLanguage, businessPurposeLanguage
  };
}

// =============================================================================
// ADDRESS BLOCKS (2026-09-04 audit). Each address is entered as street / suite /
// city / state / ZIP. The legacy single "City, State ZIP" field the document
// builders read is now a hidden input, composed here from the parts, so the
// builders, the saved-draft keys and the review panel are unchanged.
// =============================================================================
function dlComposeAddress(targetId) {
  const hidden = document.getElementById(targetId);
  if (!hidden) return;
  let s2 = '', city = '', st = '', zip = '';
  document.querySelectorAll('[data-dl-addr="' + targetId + '"]').forEach(function (p) {
    const v = (p.value || '').trim();
    if (/_street2$/.test(p.id)) s2 = v; else if (/_city$/.test(p.id)) city = v;
    else if (/_state$/.test(p.id)) st = v; else if (/_zip$/.test(p.id)) zip = v;
  });
  const cityLine = [city, [st, zip].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  hidden.value = [s2, cityLine].filter(Boolean).join(', ');
  hidden.dispatchEvent(new Event('input', { bubbles: true }));
  hidden.dispatchEvent(new Event('change', { bubbles: true }));
}
function dlRestoreAddressParts(targetId) {
  // A saved draft carries only the composed line; put what can be parsed back
  // into the parts so the visitor is not shown empty boxes over a filled hidden field.
  const hidden = document.getElementById(targetId);
  if (!hidden || !hidden.value) return;
  const parts = {};
  document.querySelectorAll('[data-dl-addr="' + targetId + '"]').forEach(function (p) {
    if (/_street2$/.test(p.id)) parts.s2 = p; else if (/_city$/.test(p.id)) parts.city = p;
    else if (/_state$/.test(p.id)) parts.st = p; else if (/_zip$/.test(p.id)) parts.zip = p;
  });
  if (parts.city && parts.city.value) return; // already populated
  const m = hidden.value.match(/^(?:(.*?),\s*)?([^,]+?),\s*([A-Z]{2})\s*([0-9]{5}(?:-[0-9]{4})?)?\s*$/);
  if (!m) return;
  if (parts.s2 && m[1]) parts.s2.value = m[1];
  if (parts.city) parts.city.value = m[2] || '';
  if (parts.st) parts.st.value = m[3] || '';
  if (parts.zip && m[4]) parts.zip.value = m[4];
}
function dlBindAddressBlocks(root) {
  (root || document).querySelectorAll('[data-dl-addr]').forEach(function (el) {
    const target = el.getAttribute('data-dl-addr');
    ['input', 'change'].forEach(function (ev) { el.addEventListener(ev, function () { dlComposeAddress(target); }); });
  });
  const seen = {};
  (root || document).querySelectorAll('[data-dl-addr]').forEach(function (el) {
    const t = el.getAttribute('data-dl-addr'); if (seen[t]) return; seen[t] = true; dlRestoreAddressParts(t);
  });
}
const DL_STATE_OPTIONS = '<option value="">State</option><option value="AL">AL &mdash; Alabama</option><option value="AK">AK &mdash; Alaska</option><option value="AZ">AZ &mdash; Arizona</option><option value="AR">AR &mdash; Arkansas</option><option value="CA">CA &mdash; California</option><option value="CO">CO &mdash; Colorado</option><option value="CT">CT &mdash; Connecticut</option><option value="DE">DE &mdash; Delaware</option><option value="DC">DC &mdash; District of Columbia</option><option value="FL">FL &mdash; Florida</option><option value="GA">GA &mdash; Georgia</option><option value="HI">HI &mdash; Hawaii</option><option value="ID">ID &mdash; Idaho</option><option value="IL">IL &mdash; Illinois</option><option value="IN">IN &mdash; Indiana</option><option value="IA">IA &mdash; Iowa</option><option value="KS">KS &mdash; Kansas</option><option value="KY">KY &mdash; Kentucky</option><option value="LA">LA &mdash; Louisiana</option><option value="ME">ME &mdash; Maine</option><option value="MD">MD &mdash; Maryland</option><option value="MA">MA &mdash; Massachusetts</option><option value="MI">MI &mdash; Michigan</option><option value="MN">MN &mdash; Minnesota</option><option value="MS">MS &mdash; Mississippi</option><option value="MO">MO &mdash; Missouri</option><option value="MT">MT &mdash; Montana</option><option value="NE">NE &mdash; Nebraska</option><option value="NV">NV &mdash; Nevada</option><option value="NH">NH &mdash; New Hampshire</option><option value="NJ">NJ &mdash; New Jersey</option><option value="NM">NM &mdash; New Mexico</option><option value="NY">NY &mdash; New York</option><option value="NC">NC &mdash; North Carolina</option><option value="ND">ND &mdash; North Dakota</option><option value="OH">OH &mdash; Ohio</option><option value="OK">OK &mdash; Oklahoma</option><option value="OR">OR &mdash; Oregon</option><option value="PA">PA &mdash; Pennsylvania</option><option value="RI">RI &mdash; Rhode Island</option><option value="SC">SC &mdash; South Carolina</option><option value="SD">SD &mdash; South Dakota</option><option value="TN">TN &mdash; Tennessee</option><option value="TX">TX &mdash; Texas</option><option value="UT">UT &mdash; Utah</option><option value="VT">VT &mdash; Vermont</option><option value="VA">VA &mdash; Virginia</option><option value="WA">WA &mdash; Washington</option><option value="WV">WV &mdash; West Virginia</option><option value="WI">WI &mdash; Wisconsin</option><option value="WY">WY &mdash; Wyoming</option><option value="PR">PR &mdash; Puerto Rico</option><option value="VI">VI &mdash; U.S. Virgin Islands</option>';

// =============================================================================
// PRINT (2026-09-04 audit). `window.print()` on the page printed the whole tool
// -- header, sidebar, footer, the floating widget -- around the document. The
// document now prints alone in its own window, with the educational watermark
// on every page and a "Print / Save as PDF" bar, exactly like the other two
// drafting tools.
// =============================================================================
function dlPrintDocument() {
  const pane = document.getElementById('doc_preview');
  if (!pane || !pane.innerHTML.trim()) { alert('Generate the documents first.'); return; }
  const w = window.open('', '_blank');
  if (!w) { alert('Your browser blocked the print window. Allow pop-ups for this site and try again.'); return; }
  let css = '';
  document.querySelectorAll('link[rel="stylesheet"]').forEach(function (l) { css += '<link rel="stylesheet" href="' + new URL(l.getAttribute('href'), location.href).href + '">'; });
  css += '<style>'
    + ' @page { margin: 1in 0.85in; }'
    + ' body { background: #fff; margin: 0; padding: 0 0.25in; }'
    + ' .oa-doc-preview { border: none; max-height: none; overflow: visible; }'
    + " body::before { content: 'DRAFT \\2014 EDUCATIONAL \\2014 NOT FOR SIGNATURE'; position: fixed; top: 42%; left: 0; right: 0; text-align: center; transform: rotate(-28deg); font-family: 'Open Sans', Arial, sans-serif; font-size: 22pt; font-weight: 800; letter-spacing: 2px; color: rgba(176, 31, 36, 0.14); white-space: nowrap; z-index: 9999; pointer-events: none; }"
    + " body::after { content: 'Donovan Legal PLLC \\2014 educational drafting tool. Not legal advice, not reviewed by counsel, not for filing or signature. donovan.law/book'; position: fixed; bottom: 0.25in; left: 0; right: 0; text-align: center; font-family: 'Open Sans', Arial, sans-serif; font-size: 8pt; color: #B01F24; }"
    + " .dl-print-bar { position: sticky; top: 0; background: #0a5a37; color: #F5F5F0; padding: 0.6rem 1rem; font-family: 'Open Sans', Arial, sans-serif; font-size: 10.5pt; display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; }"
    + ' .dl-print-bar button { background: #C9A961; color: #084B2E; border: 0; border-radius: 4px; padding: 0.45rem 0.9rem; font-weight: 800; cursor: pointer; }'
    + ' @media print { .dl-print-bar { display: none !important; } }'
    + '</style>';
  const bar = '<div class="dl-print-bar"><button id="dl_print_now" type="button">Print / Save as PDF</button><span>In the dialog, choose <strong>&ldquo;Save as PDF&rdquo;</strong> as the printer or destination to keep a copy. The watermark prints on every page.</span></div>';
  w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Draft Documents</title>' + css + '</head><body>' + bar
    + '<div class="oa-doc-preview">' + pane.innerHTML + '</div>'
    + '</body></html>');
  w.document.close();
  dlWirePrintWindow(w);
}

/**
 * Print a document written into a popup. The site's Content-Security-Policy
 * (script-src 'self' + nonce) also governs the about:blank popup, so any
 * <script> written INTO the popup is blocked -- which is why "Print / Save as
 * PDF" silently did nothing. Everything is wired from this window instead:
 * the toolbar button and the automatic print both call the popup's print().
 */
function dlWirePrintWindow(w) {
  if (!w || !w.document) return;
  const go = function () { try { w.focus(); w.print(); } catch (e) { /* user closed it */ } };
  const btn = w.document.getElementById('dl_print_now');
  if (btn) btn.addEventListener('click', go);
  // Fonts and the stylesheet links need a beat; document.write'd documents are
  // usually 'complete' already, so fall back to a timer.
  if (w.document.readyState === 'complete') { setTimeout(go, 450); }
  else { w.addEventListener('load', function () { setTimeout(go, 300); }); setTimeout(go, 1500); }
}
