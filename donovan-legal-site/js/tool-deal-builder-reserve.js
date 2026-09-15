/* =============================================================================
   DEAL BUILDER TOOL  —  Donovan Reserve
   Donovan Legal PLLC  —  Phase I
   =============================================================================
   Comprehensive deal-modeling environment for sophisticated practitioners.
   Models capital stack, debt under §752, distribution waterfall, governance,
   state and federal tax overlays, and sensitivity across all deal structures
   (Operating LLC, JV, Fund, Master-Feeder, REIT, UPREIT, DownREIT, QOF, QOZB,
   TIC, DST, Series LLC, Ground Lease, Cooperative).

   Phase I scope: deal economics + structural framework + state selector.
   Phase II:   §704(b) and §704(c) allocation engines.
   Phase III:  blocker structures + FIRPTA + tax-exempt UBTI analysis.
   Phase IV:   REIT / OZ / TIC compliance engines.
   Phase V:    org chart editor + branded PDF export.
   Phase VI:   §163(j) / §461(l) / §199A refinements; multi-state apportionment.

   Access is controlled at the server level by Apache Basic Auth via cPanel
   Directory Privacy on the /reserve/ folder. No client-side gate needed.
   ============================================================================= */

'use strict';

// =============================================================================
// STATE
// =============================================================================
const DB = {
  memberClasses: [],
  memberDebt: [],
  promoteTiers: [],
  nextMemberId: 1,
  nextDebtId: 1,
  nextTierId: 1,
  lastResults: null,
};

// =============================================================================
// DEAL TYPE CONFIGURATIONS
// =============================================================================
const DEAL_TYPES = {
  operating_llc: {
    label: 'Operating LLC — single-asset',
    help: '<strong>Operating LLC — single-asset:</strong> Most common structure for a single-property real estate venture. Limited liability, flexible governance, pass-through taxation by default. No special compliance regime beyond §704(b) allocation rules. Best for sponsor + small group of LPs holding a single building or development.',
    defaultEntity: 'LLC',
    multiClass: true,
    debtPermitted: true,
    notes: []
  },
  joint_venture: {
    label: 'Joint Venture — sponsor + LP(s)',
    help: '<strong>Joint Venture:</strong> Sponsor and one or more LPs hold interests in a single LLC. Distinct from a fund in that the sponsor typically holds a substantial equity stake and the LP is identified at formation. Sponsor compensation is through promote, fees, and (sometimes) preferred return.',
    defaultEntity: 'LLC',
    multiClass: true,
    debtPermitted: true,
    notes: []
  },
  fund: {
    label: 'Fund — multiple LPs',
    help: '<strong>Fund:</strong> Sponsor (GP) manages a pool of LPs investing in one or more properties. Subject to securities laws — typical Reg D 506(b) or 506(c) exemption required. Fund-level fees and waterfall apply. Consider blocker structures (Phase III) if foreign or tax-exempt investors are admitted.',
    defaultEntity: 'LP or LLC',
    multiClass: true,
    debtPermitted: true,
    notes: [
      { type: 'warn', text: 'Securities offering — must qualify for Reg D 506(b) or 506(c) exemption or other applicable exemption. Form D filing required within 15 days of first sale.' }
    ]
  },
  master_feeder: {
    label: 'Master-Feeder Fund (offshore feeder)',
    help: '<strong>Master-Feeder Fund:</strong> Onshore feeder for U.S. taxable investors; offshore feeder (typically Cayman or BVI corporation) for U.S. tax-exempt and non-U.S. investors. Both feeders invest into a master fund. Used to address UBTI for tax-exempts and ECI for foreign investors. Consider §882 ECI, branch profits tax (§884), and FIRPTA exposure (Phase III).',
    defaultEntity: 'LP master + LLC onshore feeder + Cayman corp offshore feeder',
    multiClass: true,
    debtPermitted: true,
    notes: [
      { type: 'warn', text: 'Master-Feeder structures introduce complex tax considerations. Phase III adds full FIRPTA, UBTI, and blocker leakage analysis.' }
    ]
  },
  series_llc: {
    label: 'Series LLC',
    help: '<strong>Series LLC:</strong> Permits multiple "series" within a single LLC, each with separate assets and liabilities (in states recognizing series — DE, IL, NV, TX, others). Used to isolate liability across multiple properties without forming separate LLCs. State-by-state recognition is variable; charging-order protection across state lines is uncertain.',
    defaultEntity: 'Series LLC (DE, IL, NV, TX preferred)',
    multiClass: true,
    debtPermitted: true,
    notes: [
      { type: 'info', text: 'Series LLC liability shield is recognized in formation state; cross-state recognition is uncertain. Confirm enforceability in jurisdictions where properties are located.' }
    ]
  },
  reit_private: {
    label: 'Private REIT (closely-held)',
    help: '<strong>Private REIT:</strong> Real Estate Investment Trust electing under §856 et seq. Distributes 90%+ of taxable income to avoid entity-level tax. Subject to 5/50 closely-held test (no more than 50% of REIT held by 5 or fewer individuals during last half of taxable year), 75% and 95% gross income tests, 75% asset test. Used by tax-exempt and foreign investors who would otherwise face UBTI or FIRPTA. Phase IV adds full compliance engine.',
    defaultEntity: 'Maryland corporation or trust (election under §856)',
    multiClass: true,
    debtPermitted: true,
    notes: [
      { type: 'tax', text: '5/50 test: no more than 50% of value of REIT may be held, directly or indirectly, by 5 or fewer individuals during the last half of the taxable year. Use of "demand redemption" or "income-only" non-participating preferred can satisfy 100-shareholder requirement.' },
      { type: 'tax', text: '75% income test: 75%+ of gross income from real estate sources. 95% income test: 95%+ from real estate plus other passive sources. Phase IV adds full compliance modeling.' }
    ]
  },
  reit_public: {
    label: 'Public / Listed REIT',
    help: '<strong>Public REIT:</strong> Same §856 election as private REIT but registered with SEC and listed on national exchange. 100-shareholder requirement easily met; 5/50 test mitigated by public float. Distribution requirement and income/asset tests still apply.',
    defaultEntity: 'Maryland corporation (election under §856)',
    multiClass: true,
    debtPermitted: true,
    notes: [
      { type: 'warn', text: 'Public REIT structure requires SEC registration, ongoing reporting, and exchange listing compliance. Phase I models economics only; structural and securities compliance not modeled.' }
    ]
  },
  upreit: {
    label: 'UPREIT (REIT + Operating Partnership)',
    help: '<strong>UPREIT:</strong> Umbrella Partnership REIT. The REIT is the general partner of an Operating Partnership (OP) that holds all real estate. Property contributors receive OP units (typically convertible to REIT shares) on a tax-deferred basis under §721. Dominant structure for public REITs; enables tax-deferred consolidation of seed assets.',
    defaultEntity: 'REIT GP + Operating Partnership (LLC or LP)',
    multiClass: true,
    debtPermitted: true,
    notes: [
      { type: 'tax', text: '§721 contribution of property for OP units is tax-deferred. OP unit holders may convert to REIT shares (taxable event) on schedule per the OP agreement. Consider §704(c) built-in gain on contributed property — Phase II.' }
    ]
  },
  downreit: {
    label: 'DownREIT',
    help: '<strong>DownREIT:</strong> REIT holds property directly and forms a partnership with a property contributor for a specific property. The contributor receives partnership units (not OP units consolidated across the REIT). Used selectively when full UPREIT roll-up is not desired or feasible.',
    defaultEntity: 'REIT + property-specific partnership',
    multiClass: true,
    debtPermitted: true,
    notes: []
  },
  qof: {
    label: 'Qualified Opportunity Fund (QOF)',
    help: '<strong>QOF:</strong> Entity electing on Form 8996 to invest in Qualified Opportunity Zones (QOZs) under §1400Z-2. Holds at least 90% of assets in QOZ property — either direct QOZ business property or interests in QOZBs. Investors receive temporary deferral, partial step-up at year 5, and elimination of post-investment gain at year 10. Phase IV adds full 90% test and benefits modeling.',
    defaultEntity: 'LLC or corporation electing on Form 8996',
    multiClass: true,
    debtPermitted: true,
    notes: [
      { type: 'tax', text: '90% asset test measured semi-annually (June 30 and December 31). Failure incurs penalty under §1400Z-2(f) unless reasonable cause.' },
      { type: 'tax', text: 'Investor benefits: deferral until earlier of disposition or 12/31/2026; partial basis step-up after 5-year hold (now historical for 2017-vintage deferrals); elimination of post-investment gain after 10-year hold.' }
    ]
  },
  qozb: {
    label: 'Qualified Opportunity Zone Business (QOZB)',
    help: '<strong>QOZB:</strong> Operating business or rental real estate inside a Qualified Opportunity Zone in which a QOF invests. Subject to 70% tangible property test, 50% gross income from active conduct of trade or business within the QOZ, and working capital safe harbor (up to 31 months for construction). Phase IV adds full compliance engine.',
    defaultEntity: 'LLC or corporation owned by a QOF',
    multiClass: true,
    debtPermitted: true,
    notes: [
      { type: 'tax', text: '70% tangible property test (less stringent than QOF\'s 90%). 50% gross income from active conduct within the QOZ. Sin business exclusion: no golf course, country club, massage parlor, hot tub facility, sun-tan facility, racetrack, gambling, or liquor store as principal business.' }
    ]
  },
  tic: {
    label: 'TIC — Rev. Proc. 2002-22',
    help: '<strong>TIC (Tenancy in Common):</strong> Co-ownership of real property treated as direct property ownership (not a partnership) for tax purposes if Rev. Proc. 2002-22 conditions are met. Permits each co-owner to perform §1031 exchange independently. Phase IV adds full Rev. Proc. 2002-22 compliance.',
    defaultEntity: 'Direct co-ownership (no entity)',
    multiClass: false,
    debtPermitted: true,
    notes: [
      { type: 'tax', text: 'Rev. Proc. 2002-22: Maximum 35 co-tenants (most practitioners cap at 15-20 to avoid Service scrutiny). Each co-tenant holds undivided fractional interest in fee, must hold proportionate share of debt and revenue. Affirmative vote of all co-tenants required for major actions.' },
      { type: 'warn', text: 'TIC is treated as direct ownership; the property is the asset, not partnership interests. No §754 election available. Each co-tenant receives separate Form 1099 for income; no Form 1065.' }
    ]
  },
  dst: {
    label: 'DST — Rev. Rul. 2004-86',
    help: '<strong>DST (Delaware Statutory Trust):</strong> Trust holding real estate in which beneficial interests are treated as undivided interests in property under Rev. Rul. 2004-86. Eligible as §1031 replacement property. Trustee has limited authority; investors are passive. Used heavily as 1031 replacement vehicle.',
    defaultEntity: 'Delaware Statutory Trust',
    multiClass: false,
    debtPermitted: true,
    notes: [
      { type: 'tax', text: 'Rev. Rul. 2004-86 "Seven Deadly Sins": (1) no new investors after offering closes, (2) no debt refinancing, (3) no debt prepayment except from sale proceeds, (4) no reinvestment of sale proceeds, (5) no leasehold tenant improvements except routine maintenance, (6) no new leases except market-rate triple-net replacements, and (7) cash held in reserves must be limited and held only for short term.' },
      { type: 'warn', text: 'DST limitations are strict. Any deviation may cause re-characterization as a partnership, defeating §1031 eligibility. Trustee discretion is intentionally minimal.' }
    ]
  },
  ground_lease: {
    label: 'Ground Lease Structure',
    help: '<strong>Ground Lease Structure:</strong> Separate ownership of fee (land) and leasehold (improvements). Used to reduce upfront capital (no land purchase), capture appreciation differently, or comply with tax-exempt counterparty restrictions. Long-term lease (typically 50-99 years). Tax treatment: leasehold improvements depreciable; ground rent deductible as expense.',
    defaultEntity: 'Two parallel LLCs (fee owner + leasehold owner)',
    multiClass: true,
    debtPermitted: true,
    notes: [
      { type: 'info', text: 'Ground lease structures often arise with land held by family trusts, municipalities, or tax-exempt institutions. Confirm UBTI implications for tax-exempt fee owners (Phase III).' }
    ]
  },
  cooperative: {
    label: 'Cooperative',
    help: '<strong>Cooperative:</strong> Equity cooperative under §216 (housing) or Subchapter T (other). Members hold shares plus proprietary lease. Common in NYC residential market; rare in commercial RE. Each member taxed on share of operating expenses and mortgage interest under §216 if 80% of income from tenant-shareholders.',
    defaultEntity: 'Cooperative corporation',
    multiClass: false,
    debtPermitted: true,
    notes: [
      { type: 'tax', text: '§216: tenant-shareholders deduct proportionate share of cooperative\'s real estate taxes and mortgage interest if 80% of cooperative\'s gross income comes from tenant-shareholders. Most commonly used in residential NYC market.' }
    ]
  }
};

// =============================================================================
// JURISDICTION HELP TEXT
// =============================================================================
const JURISDICTION_HELP = {
  FL: '<strong>Florida:</strong> Default for FL-resident principals and FL property. No state income tax. Annual report due May 1. Single-member LLC charging-order protection weakened post-<em>Olmstead v. FTC</em>, 44 So.3d 76 (Fla. 2010). For asset protection priority, consider WY or DE.',
  DE: '<strong>Delaware:</strong> Most prestigious U.S. jurisdiction. Strong corporate law, Court of Chancery for business disputes, business-friendly. Used for fund structures, JVs, holding companies. Franchise tax $300 annually for LLCs. Commercial registered agent required.',
  WY: '<strong>Wyoming:</strong> Strong charging-order protection (sole remedy under Wyo. Stat. § 17-29-503). No state income tax. Low filing fees, strong member privacy. Commercial registered agent typically required for non-resident members. Increasingly used for asset-protection holding structures.',
  NV: '<strong>Nevada:</strong> No state income tax. Charging-order protection (Nev. Rev. Stat. § 86.401). Commercial-litigation reputation strong but case law less developed than Delaware. Often paired with WY for layered asset protection.',
  TX: '<strong>Texas:</strong> No personal state income tax. Series LLC available under Tex. Bus. Org. Code § 101.601 et seq. Franchise tax applies (margin tax) above threshold. Good for TX-based principals or projects.',
  NY: '<strong>New York:</strong> NY LLC publication requirement (Cabra de los Andes — N.Y. LLC Law § 206) — six consecutive weeks in two newspapers. Annual filing fee. Often impractical absent NY-based assets or operations. Consider Delaware as alternative for NY-located property.',
  CA: '<strong>California:</strong> $800 annual LLC tax (Cal. Rev. & Tax. Code § 17941) regardless of activity, plus gross receipts fee above $250K. Strong consumer-protection lean in dispute resolution. Required if doing business in CA regardless of formation state.',
  MD: '<strong>Maryland:</strong> Statutory home of most U.S. REITs due to historical case law. Corporate-law trust statute well-developed. Selected almost exclusively for REIT formation; rare for non-REIT real estate entities.',
  VG: '<strong>British Virgin Islands:</strong> Common offshore feeder jurisdiction. No corporate income tax. Used in master-feeder fund structures for non-U.S. and U.S. tax-exempt investors to address UBTI and ECI. Subject to economic substance rules.',
  KY: '<strong>Cayman Islands:</strong> Most common offshore feeder jurisdiction for sophisticated funds. No corporate income tax. Exempted Companies law well-developed. Subject to economic substance rules.',
  OTHER: '<strong>Other:</strong> Specify the jurisdiction in your deal notes. Engage Donovan Legal to confirm fitness of selected jurisdiction for the deal structure.'
};

// =============================================================================
// STATE TAX DATA — 50 states + DC
// Top marginal income tax rate, LTCG rate, conformity flags
// Note: this is general directional data; for client work, confirm current rates
// =============================================================================
const STATE_DATA = [
  { abbr: 'AL', name: 'Alabama',     incTax: 0.050, ltcg: 0.050, bonus: 'decouple', sec163j: 'decouple', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'AK', name: 'Alaska',      incTax: 0.000, ltcg: 0.000, bonus: 'none', sec163j: 'none', sec461l: 'none', sec199a: 'none', ptet: false },
  { abbr: 'AZ', name: 'Arizona',     incTax: 0.025, ltcg: 0.025, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'AR', name: 'Arkansas',    incTax: 0.044, ltcg: 0.022, bonus: 'decouple', sec163j: 'decouple', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'CA', name: 'California',  incTax: 0.133, ltcg: 0.133, bonus: 'decouple', sec163j: 'decouple', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'CO', name: 'Colorado',    incTax: 0.044, ltcg: 0.044, bonus: 'conform',  sec163j: 'conform', sec461l: 'conform',  sec199a: 'conform',  ptet: true },
  { abbr: 'CT', name: 'Connecticut', incTax: 0.0699, ltcg: 0.0699, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'DE', name: 'Delaware',    incTax: 0.066, ltcg: 0.066, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'conform',  ptet: false },
  { abbr: 'DC', name: 'District of Columbia', incTax: 0.1075, ltcg: 0.1075, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: false },
  { abbr: 'FL', name: 'Florida',     incTax: 0.000, ltcg: 0.000, bonus: 'none', sec163j: 'none', sec461l: 'none', sec199a: 'none', ptet: false },
  { abbr: 'GA', name: 'Georgia',     incTax: 0.0539, ltcg: 0.0539, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'HI', name: 'Hawaii',      incTax: 0.110, ltcg: 0.0725, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: false },
  { abbr: 'ID', name: 'Idaho',       incTax: 0.058, ltcg: 0.058, bonus: 'conform',  sec163j: 'conform', sec461l: 'conform',  sec199a: 'conform',  ptet: true },
  { abbr: 'IL', name: 'Illinois',    incTax: 0.0495, ltcg: 0.0495, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'IN', name: 'Indiana',     incTax: 0.0305, ltcg: 0.0305, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'IA', name: 'Iowa',        incTax: 0.0382, ltcg: 0.0382, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'KS', name: 'Kansas',      incTax: 0.057, ltcg: 0.057, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'KY', name: 'Kentucky',    incTax: 0.040, ltcg: 0.040, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'LA', name: 'Louisiana',   incTax: 0.0425, ltcg: 0.0425, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'ME', name: 'Maine',       incTax: 0.0715, ltcg: 0.0715, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'MD', name: 'Maryland',    incTax: 0.0575, ltcg: 0.0575, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'MA', name: 'Massachusetts', incTax: 0.090, ltcg: 0.090, bonus: 'decouple', sec163j: 'decouple', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'MI', name: 'Michigan',    incTax: 0.0425, ltcg: 0.0425, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'MN', name: 'Minnesota',   incTax: 0.0985, ltcg: 0.0985, bonus: 'decouple', sec163j: 'decouple', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'MS', name: 'Mississippi', incTax: 0.044, ltcg: 0.044, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'MO', name: 'Missouri',    incTax: 0.047, ltcg: 0.047, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'MT', name: 'Montana',     incTax: 0.0589, ltcg: 0.0341, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: false },
  { abbr: 'NE', name: 'Nebraska',    incTax: 0.052, ltcg: 0.052, bonus: 'conform',  sec163j: 'conform', sec461l: 'conform',  sec199a: 'conform',  ptet: true },
  { abbr: 'NV', name: 'Nevada',      incTax: 0.000, ltcg: 0.000, bonus: 'none', sec163j: 'none', sec461l: 'none', sec199a: 'none', ptet: false },
  { abbr: 'NH', name: 'New Hampshire', incTax: 0.000, ltcg: 0.000, bonus: 'none', sec163j: 'none', sec461l: 'none', sec199a: 'none', ptet: false },
  { abbr: 'NJ', name: 'New Jersey',  incTax: 0.1075, ltcg: 0.1075, bonus: 'decouple', sec163j: 'decouple', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'NM', name: 'New Mexico',  incTax: 0.059, ltcg: 0.059, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'NY', name: 'New York',    incTax: 0.109, ltcg: 0.109, bonus: 'decouple', sec163j: 'decouple', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'NC', name: 'North Carolina', incTax: 0.0425, ltcg: 0.0425, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'ND', name: 'North Dakota', incTax: 0.025, ltcg: 0.0136, bonus: 'conform',  sec163j: 'conform', sec461l: 'conform',  sec199a: 'conform',  ptet: false },
  { abbr: 'OH', name: 'Ohio',        incTax: 0.035, ltcg: 0.035, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'OK', name: 'Oklahoma',    incTax: 0.0475, ltcg: 0.0475, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'OR', name: 'Oregon',      incTax: 0.099, ltcg: 0.099, bonus: 'decouple', sec163j: 'decouple', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'PA', name: 'Pennsylvania', incTax: 0.0307, ltcg: 0.0307, bonus: 'decouple', sec163j: 'decouple', sec461l: 'decouple', sec199a: 'decouple', ptet: false },
  { abbr: 'RI', name: 'Rhode Island', incTax: 0.0599, ltcg: 0.0599, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'SC', name: 'South Carolina', incTax: 0.064, ltcg: 0.0288, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'SD', name: 'South Dakota', incTax: 0.000, ltcg: 0.000, bonus: 'none', sec163j: 'none', sec461l: 'none', sec199a: 'none', ptet: false },
  { abbr: 'TN', name: 'Tennessee',   incTax: 0.000, ltcg: 0.000, bonus: 'none', sec163j: 'none', sec461l: 'none', sec199a: 'none', ptet: false },
  { abbr: 'TX', name: 'Texas',       incTax: 0.000, ltcg: 0.000, bonus: 'none', sec163j: 'none', sec461l: 'none', sec199a: 'none', ptet: false },
  { abbr: 'UT', name: 'Utah',        incTax: 0.0465, ltcg: 0.0465, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'VT', name: 'Vermont',     incTax: 0.0875, ltcg: 0.0875, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'VA', name: 'Virginia',    incTax: 0.0575, ltcg: 0.0575, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'WA', name: 'Washington',  incTax: 0.000, ltcg: 0.070, bonus: 'none', sec163j: 'none', sec461l: 'none', sec199a: 'none', ptet: false },
  { abbr: 'WV', name: 'West Virginia', incTax: 0.0512, ltcg: 0.0512, bonus: 'decouple', sec163j: 'conform', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'WI', name: 'Wisconsin',   incTax: 0.0765, ltcg: 0.0573, bonus: 'decouple', sec163j: 'decouple', sec461l: 'decouple', sec199a: 'decouple', ptet: true },
  { abbr: 'WY', name: 'Wyoming',     incTax: 0.000, ltcg: 0.000, bonus: 'none', sec163j: 'none', sec461l: 'none', sec199a: 'none', ptet: false }
];

// =============================================================================
// §752 HELP TEXT
// =============================================================================
const SEC752_HELP = {
  nonrecourse: '<strong>Nonrecourse (Reg §1.752-1(a)(2)):</strong> Debt for which no member bears the economic risk of loss. Allocated under Reg §1.752-3 in three tiers: (1) partner minimum gain shares, (2) §704(c) minimum gain, (3) excess nonrecourse liabilities in accordance with partnership profit sharing ratios. Does NOT increase basis for §465 at-risk purposes.',
  qnrf: '<strong>Qualified Nonrecourse Financing — §465(b)(6):</strong> Nonrecourse financing secured by real property, borrowed from a qualified lender (bank, insurance company, government, related person on commercial terms). DOES increase basis for §465 at-risk purposes, enabling loss deductions. Most institutional real estate construction loans qualify.',
  recourse: '<strong>Recourse (Reg §1.752-2(a)):</strong> Debt for which one or more members bear the economic risk of loss (typically via personal guaranty). Allocated to the guarantor(s) under Reg §1.752-2. Increases at-risk basis of the guarantor only. Bottom-dollar guarantees substantially limited after 2019 final regulations.',
  partner_nonrecourse: '<strong>Partner Nonrecourse Debt — Reg §1.704-2(b)(4):</strong> Nonrecourse debt for which a member (or a related person) bears the economic risk of loss. Deductions attributable to partner nonrecourse debt are allocated to that member. Common in member-financed deals or where a member guarantees a sponsor\'s otherwise-nonrecourse loan.'
};

// =============================================================================
// INITIALIZATION
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initDealTypeHandlers();
  initJurisdictionHandlers();
  initStateSelector();
  initWizardNav();
  initMemberClassHandlers();
  initMemberDebtHandlers();
  initPromoteTierHandlers();
  initInputListeners();
  initResultsActions();
  initClawbackToggle();
  initSec752Handler();

  // Seed with starter member classes and promote tiers
  seedDefaults();

  // Initial render
  recomputeAll();
});

// =============================================================================
// WIZARD NAVIGATION
// =============================================================================
function initWizardNav() {
  document.querySelectorAll('.btn-db-next, .btn-db-back').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = parseInt(btn.dataset.target, 10);
      showStep(target);
      // Always recompute on navigation — the heavy calc is fast and
      // ensures the Results step is current whenever it's viewed.
      recomputeAll();
    });
  });
  // Allow direct tab clicks
  document.querySelectorAll('.db-progress-step').forEach(s => {
    s.addEventListener('click', () => {
      const n = parseInt(s.dataset.step, 10);
      showStep(n);
      recomputeAll();
    });
  });
}

function showStep(n) {
  document.querySelectorAll('.db-step').forEach(s => s.classList.remove('db-step-active'));
  document.querySelector(`.db-step[data-step="${n}"]`).classList.add('db-step-active');
  document.querySelectorAll('.db-progress-step').forEach(s => {
    const stepNum = parseInt(s.dataset.step, 10);
    s.classList.toggle('db-active', stepNum === n);
    s.classList.toggle('db-complete', stepNum < n);
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// =============================================================================
// DEAL TYPE & JURISDICTION HANDLERS
// =============================================================================
function initDealTypeHandlers() {
  const sel = document.getElementById('deal_type');
  sel.addEventListener('change', () => {
    const config = DEAL_TYPES[sel.value];
    document.getElementById('deal_type_help').innerHTML = config.help;
    recomputeAll();
  });
}

function initJurisdictionHandlers() {
  const sel = document.getElementById('jurisdiction');
  sel.addEventListener('change', () => {
    document.getElementById('jurisdiction_help').innerHTML = JURISDICTION_HELP[sel.value];
  });
}

function initSec752Handler() {
  const sel = document.getElementById('senior_752_class');
  sel.addEventListener('change', () => {
    document.getElementById('senior_752_help').innerHTML = SEC752_HELP[sel.value];
  });
}

// =============================================================================
// STATE SELECTOR
// =============================================================================
function initStateSelector() {
  const sel = document.getElementById('property_state');
  STATE_DATA.forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.abbr;
    opt.textContent = `${s.abbr} — ${s.name}`;
    sel.appendChild(opt);
  });
  sel.value = 'FL';
  sel.addEventListener('change', () => {
    renderStateSummary();
    recomputeAll();
  });
  renderStateSummary();
}

function renderStateSummary() {
  const abbr = document.getElementById('property_state').value;
  const s = STATE_DATA.find(x => x.abbr === abbr);
  if (!s) return;
  const flag = (status) => {
    if (status === 'conform') return '<span class="ss-flag conform">Conforms</span>';
    if (status === 'decouple') return '<span class="ss-flag decouple">Decouples</span>';
    return '<span class="ss-flag none">No State Tax</span>';
  };
  const target = document.getElementById('property_state_summary');
  target.innerHTML = `
    <div class="ss-title">${s.name} — Tax Summary</div>
    <div class="ss-grid">
      <div class="ss-item"><label>Top Income Tax</label><div class="ss-value ${s.incTax > 0.08 ? 'red' : s.incTax > 0 ? 'amber' : 'green'}">${(s.incTax * 100).toFixed(2)}%</div></div>
      <div class="ss-item"><label>Top LTCG Rate</label><div class="ss-value ${s.ltcg > 0.08 ? 'red' : s.ltcg > 0 ? 'amber' : 'green'}">${(s.ltcg * 100).toFixed(2)}%</div></div>
      <div class="ss-item"><label>§168(k) Bonus</label><div class="ss-value">${flag(s.bonus)}</div></div>
      <div class="ss-item"><label>§163(j) Interest</label><div class="ss-value">${flag(s.sec163j)}</div></div>
      <div class="ss-item"><label>§461(l) EBL</label><div class="ss-value">${flag(s.sec461l)}</div></div>
      <div class="ss-item"><label>§199A QBI</label><div class="ss-value">${flag(s.sec199a)}</div></div>
      <div class="ss-item"><label>PTET Election</label><div class="ss-value ${s.ptet ? 'green' : ''}">${s.ptet ? 'Available' : 'Not Available'}</div></div>
      <div class="ss-item"><label>Composite Return</label><div class="ss-value">${s.incTax > 0 ? 'Typically Required' : 'N/A'}</div></div>
    </div>
  `;
}

// =============================================================================
// SEED DEFAULTS (typical Reserve deal starter)
// =============================================================================
function seedDefaults() {
  // Two LP classes + sponsor
  addMemberClassData({
    id: DB.nextMemberId++,
    name: 'Class A-1 (Passive LPs)',
    capital: 2000000,
    prefRate: 10,
    classType: 'lp',
    role: 'limited',
    voting: 'pro_rata'
  });
  addMemberClassData({
    id: DB.nextMemberId++,
    name: 'Class A-2 (Guarantor LP)',
    capital: 600000,
    prefRate: 11,
    classType: 'lp_guarantor',
    role: 'limited',
    voting: 'pro_rata'
  });
  addMemberClassData({
    id: DB.nextMemberId++,
    name: 'Sponsor Co-GP',
    capital: 0,
    prefRate: 0,
    classType: 'sponsor',
    role: 'manager',
    voting: 'full'
  });

  // Three promote tiers
  addPromoteTierData({ id: DB.nextTierId++, threshold: 15, basis: 'irr', lpShare: 80, label: 'Tier 3' });
  addPromoteTierData({ id: DB.nextTierId++, threshold: 25, basis: 'irr', lpShare: 70, label: 'Tier 4' });
  addPromoteTierData({ id: DB.nextTierId++, threshold: 999, basis: 'irr', lpShare: 60, label: 'Tier 5 (Final)' });

  renderMemberClasses();
  renderPromoteTiers();
  renderMemberDebt();
}

// =============================================================================
// MEMBER CLASS MANAGEMENT
// =============================================================================
function initMemberClassHandlers() {
  document.getElementById('add_member_class').addEventListener('click', () => {
    addMemberClassData({
      id: DB.nextMemberId++,
      name: `Class ${String.fromCharCode(65 + DB.memberClasses.length)}`,
      capital: 0,
      prefRate: 8,
      classType: 'lp',
      role: 'limited',
      voting: 'pro_rata'
    });
    renderMemberClasses();
    recomputeAll();
  });
}

function addMemberClassData(d) {
  DB.memberClasses.push(d);
}

function removeMemberClass(id) {
  DB.memberClasses = DB.memberClasses.filter(c => c.id !== id);
  renderMemberClasses();
  recomputeAll();
}

function renderMemberClasses() {
  const container = document.getElementById('member_classes_container');
  container.innerHTML = '';
  DB.memberClasses.forEach(cls => {
    const card = document.createElement('div');
    let typeClass = '';
    let badgeClass = '';
    let badgeText = 'LP';
    if (cls.classType === 'sponsor') { typeClass = 'is-sponsor'; badgeClass = 'sponsor'; badgeText = 'SPONSOR / GP'; }
    else if (cls.classType === 'lp_guarantor') { typeClass = 'is-guarantor'; badgeClass = 'guarantor'; badgeText = 'GUARANTOR LP'; }
    else if (cls.classType === 'preferred_equity') { badgeText = 'PREF EQUITY'; }
    else if (cls.classType === 'mezz_equity') { badgeText = 'MEZZ EQUITY'; }

    card.className = `member-class-card ${typeClass}`;

    // Compute investors in this class and total committed
    const classInvestors = (DB.investors || []).filter(i => i.memberClassId === cls.id);
    const totalCommitted = classInvestors.reduce((s, i) => s + (parseFloat(i.capital) || 0), 0);
    const classCapital = parseFloat(cls.capital) || 0;
    const variance = totalCommitted - classCapital;
    const varianceFmt = variance === 0
      ? '<span style="color:#169B62;font-weight:700;">✓ matches class capital</span>'
      : variance > 0
        ? `<span style="color:#8b3a3a;font-weight:700;">over-committed by $${variance.toLocaleString('en-US')}</span>`
        : `<span style="color:#d4a017;font-weight:700;">under-committed by $${Math.abs(variance).toLocaleString('en-US')}</span>`;

    // Build investor sub-rows
    let investorRows = '';
    if (classInvestors.length === 0 && cls.classType !== 'sponsor') {
      investorRows = '<p class="db-help-block" style="margin:0.5rem 0 0.75rem 0;font-size:0.83rem;">No persons or entities added to this class yet. Click <em>+ Add Person / Entity to This Class</em> below to enter the individual subscribers and their commitments.</p>';
    } else {
      const investorTypeOpts = (typeof INVESTOR_TYPES !== 'undefined') ?
        Object.entries(INVESTOR_TYPES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('') : '';
      for (const inv of classInvestors) {
        investorRows += `
          <div class="mc-inv-row" data-inv-id="${inv.id}">
            <div class="mc-inv-fields">
              <div class="mc-field-mini">
                <label>Legal Name</label>
                <input type="text" class="mc-inv-name" data-inv-id="${inv.id}" value="${escapeHtml(inv.name)}" placeholder="e.g., John A. Smith / Smith Family Trust" />
              </div>
              <div class="mc-field-mini">
                <label>Type</label>
                <select class="mc-inv-type" data-inv-id="${inv.id}">${investorTypeOpts}</select>
              </div>
              <div class="mc-field-mini">
                <label>Address</label>
                <input type="text" class="mc-inv-address" data-inv-id="${inv.id}" value="${escapeHtml(inv.address)}" placeholder="Street, City, State, ZIP" />
              </div>
              <div class="mc-field-mini">
                <label>Commitment ($)</label>
                <input type="text" class="mc-inv-capital" data-inv-id="${inv.id}" value="${inv.capital}" />
              </div>
              <div class="mc-field-mini" style="display:flex;align-items:flex-end;">
                <button class="mc-inv-remove" type="button" data-inv-id="${inv.id}">Remove</button>
              </div>
            </div>
          </div>
        `;
      }
    }

    card.innerHTML = `
      <div class="mc-header">
        <div class="mc-title-row">
          <span class="mc-class-badge ${badgeClass}">${badgeText}</span>
          <input class="mc-name-input" type="text" value="${escapeHtml(cls.name)}" data-id="${cls.id}" data-field="name" />
        </div>
        <button class="mc-remove" type="button" data-id="${cls.id}">Remove</button>
      </div>
      <div class="mc-fields">
        <div class="mc-field-mini">
          <label>Class Capital ($) — total raise for this class</label>
          <input type="text" value="${cls.capital}" data-id="${cls.id}" data-field="capital" />
        </div>
        <div class="mc-field-mini">
          <label>Preferred Return (%)</label>
          <input type="text" value="${cls.prefRate}" data-id="${cls.id}" data-field="prefRate" />
        </div>
        <div class="mc-field-mini">
          <label>Class Type</label>
          <select data-id="${cls.id}" data-field="classType">
            <option value="lp" ${cls.classType === 'lp' ? 'selected' : ''}>LP — Cash Investor</option>
            <option value="lp_guarantor" ${cls.classType === 'lp_guarantor' ? 'selected' : ''}>LP — Guarantor</option>
            <option value="preferred_equity" ${cls.classType === 'preferred_equity' ? 'selected' : ''}>Preferred Equity</option>
            <option value="mezz_equity" ${cls.classType === 'mezz_equity' ? 'selected' : ''}>Mezzanine Equity</option>
            <option value="sponsor" ${cls.classType === 'sponsor' ? 'selected' : ''}>Sponsor / GP</option>
          </select>
        </div>
        <div class="mc-field-mini">
          <label>Voting Rights</label>
          <select data-id="${cls.id}" data-field="voting">
            <option value="pro_rata" ${cls.voting === 'pro_rata' ? 'selected' : ''}>Pro Rata</option>
            <option value="full" ${cls.voting === 'full' ? 'selected' : ''}>Full (1 entity = 1 vote)</option>
            <option value="none" ${cls.voting === 'none' ? 'selected' : ''}>None / Limited</option>
            <option value="protective" ${cls.voting === 'protective' ? 'selected' : ''}>Protective Only</option>
          </select>
        </div>
      </div>

      ${cls.classType === 'sponsor' ? '' : `
      <div class="mc-investors-panel">
        <h4>Persons / Entities in This Class
          <span class="mc-investors-summary">
            ${classInvestors.length} subscriber${classInvestors.length === 1 ? '' : 's'} · committed $${totalCommitted.toLocaleString('en-US')} of $${classCapital.toLocaleString('en-US')} class capital · ${varianceFmt}
          </span>
        </h4>
        ${investorRows}
        <button class="mc-add-investor" type="button" data-class-id="${cls.id}">+ Add Person / Entity to This Class</button>
      </div>
      `}
    `;
    container.appendChild(card);
  });

  // Wire up listeners on the new inputs
  container.querySelectorAll('input[data-field], select[data-field]').forEach(el => {
    el.addEventListener('input', e => updateMemberClassField(e));
    el.addEventListener('change', e => updateMemberClassField(e));
  });
  container.querySelectorAll('.mc-remove').forEach(b => {
    b.addEventListener('click', e => {
      const id = parseInt(e.target.dataset.id, 10);
      removeMemberClass(id);
    });
  });

  // ============================================================
  // PHASE 8.7: In-class investor add/edit/remove
  // ============================================================
  // Set investor type selects to their current values
  container.querySelectorAll('.mc-inv-type').forEach(sel => {
    const invId = parseInt(sel.dataset.invId, 10);
    const inv = DB.investors.find(i => i.id === invId);
    if (inv) sel.value = inv.type || 'individual';
  });

  // Edit handlers for in-class investor fields
  container.querySelectorAll('.mc-inv-name, .mc-inv-address, .mc-inv-type').forEach(el => {
    el.addEventListener('input', e => {
      const invId = parseInt(e.target.dataset.invId, 10);
      const inv = DB.investors.find(i => i.id === invId);
      if (!inv) return;
      if (e.target.classList.contains('mc-inv-name')) inv.name = e.target.value;
      else if (e.target.classList.contains('mc-inv-address')) inv.address = e.target.value;
      else if (e.target.classList.contains('mc-inv-type')) inv.type = e.target.value;
    });
    el.addEventListener('change', e => {
      const invId = parseInt(e.target.dataset.invId, 10);
      const inv = DB.investors.find(i => i.id === invId);
      if (!inv) return;
      if (e.target.classList.contains('mc-inv-type')) inv.type = e.target.value;
    });
  });

  // Capital field: update on blur after formatting strip
  container.querySelectorAll('.mc-inv-capital').forEach(el => {
    el.addEventListener('input', e => {
      const invId = parseInt(e.target.dataset.invId, 10);
      const inv = DB.investors.find(i => i.id === invId);
      if (inv) inv.capital = parseFloat(String(e.target.value).replace(/[\$,\s%]/g, '')) || 0;
    });
    el.addEventListener('blur', e => {
      // Trigger re-render to refresh totals/variance display
      renderMemberClasses();
    });
  });

  // Remove handlers
  container.querySelectorAll('.mc-inv-remove').forEach(btn => {
    btn.addEventListener('click', e => {
      const invId = parseInt(e.target.dataset.invId, 10);
      if (!confirm('Remove this person/entity from the class?')) return;
      DB.investors = DB.investors.filter(i => i.id !== invId);
      renderMemberClasses();
      // Also refresh the Step 7 investor list if it's rendered
      if (typeof renderInvestors === 'function') renderInvestors();
      if (typeof updateInvestorSummary === 'function') updateInvestorSummary();
    });
  });

  // Add handlers
  container.querySelectorAll('.mc-add-investor').forEach(btn => {
    btn.addEventListener('click', e => {
      const classId = parseInt(e.target.dataset.classId, 10);
      const newInv = {
        id: DB.nextInvestorId++,
        name: '',
        type: 'individual',
        address: '',
        email: '',
        capital: 0,
        memberClassId: classId,
        aiCategory: '501a5_net_worth',
        signingCapacity: 'self'
      };
      DB.investors.push(newInv);
      renderMemberClasses();
      if (typeof renderInvestors === 'function') renderInvestors();
      if (typeof updateInvestorSummary === 'function') updateInvestorSummary();
    });
  });

  updateCapitalStackSummary();
}

function updateMemberClassField(e) {
  const id = parseInt(e.target.dataset.id, 10);
  const field = e.target.dataset.field;
  const cls = DB.memberClasses.find(c => c.id === id);
  if (!cls) return;

  if (e.target.type === 'number' || e.target.classList.contains('db-fmt-currency') || e.target.classList.contains('db-fmt-percent')) cls[field] = parseFloat(String(e.target.value).replace(/[\$,\s%]/g, '')) || 0;
  else cls[field] = e.target.value;

  // Re-render badge if classType changed
  if (field === 'classType') renderMemberClasses();

  updateCapitalStackSummary();
}

// =============================================================================
// MEMBER DEBT MANAGEMENT
// =============================================================================
function initMemberDebtHandlers() {
  document.getElementById('add_member_debt').addEventListener('click', () => {
    addMemberDebtData({
      id: DB.nextDebtId++,
      lender: 'Member Loan',
      amount: 0,
      rate: 8,
      term752: 'partner_nonrecourse',
      priority: 'subordinate'
    });
    renderMemberDebt();
    recomputeAll();
  });
}

function addMemberDebtData(d) {
  DB.memberDebt.push(d);
}

function removeMemberDebt(id) {
  DB.memberDebt = DB.memberDebt.filter(d => d.id !== id);
  renderMemberDebt();
  recomputeAll();
}

function renderMemberDebt() {
  const container = document.getElementById('member_debt_container');
  container.innerHTML = '';
  if (DB.memberDebt.length === 0) {
    container.innerHTML = '<p class="db-help-block" style="margin:0 0 1rem 0;">No member loans configured. Click below to add a member loan or mezzanine position.</p>';
  }
  DB.memberDebt.forEach(d => {
    const row = document.createElement('div');
    row.className = 'member-debt-row';
    row.innerHTML = `
      <div class="md-header">
        <span class="pt-title">Member Loan / Mezzanine</span>
        <button class="mc-remove" type="button" data-id="${d.id}">Remove</button>
      </div>
      <div class="md-fields">
        <div class="mc-field-mini">
          <label>Lender / Description</label>
          <input type="text" value="${escapeHtml(d.lender)}" data-id="${d.id}" data-field="lender" />
        </div>
        <div class="mc-field-mini">
          <label>Amount ($)</label>
          <input type="number" value="${d.amount}" data-id="${d.id}" data-field="amount" min="0" step="50000" />
        </div>
        <div class="mc-field-mini">
          <label>Rate (%)</label>
          <input type="number" value="${d.rate}" data-id="${d.id}" data-field="rate" min="0" max="30" step="0.25" />
        </div>
        <div class="mc-field-mini">
          <label>§752 Classification</label>
          <select data-id="${d.id}" data-field="term752">
            <option value="nonrecourse" ${d.term752 === 'nonrecourse' ? 'selected' : ''}>Nonrecourse</option>
            <option value="qnrf" ${d.term752 === 'qnrf' ? 'selected' : ''}>Qualified Nonrecourse</option>
            <option value="recourse" ${d.term752 === 'recourse' ? 'selected' : ''}>Recourse</option>
            <option value="partner_nonrecourse" ${d.term752 === 'partner_nonrecourse' ? 'selected' : ''}>Partner Nonrecourse</option>
          </select>
        </div>
        <div class="mc-field-mini">
          <label>Priority</label>
          <select data-id="${d.id}" data-field="priority">
            <option value="senior" ${d.priority === 'senior' ? 'selected' : ''}>Senior</option>
            <option value="subordinate" ${d.priority === 'subordinate' ? 'selected' : ''}>Subordinate</option>
            <option value="mezzanine" ${d.priority === 'mezzanine' ? 'selected' : ''}>Mezzanine</option>
          </select>
        </div>
      </div>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', e => updateMemberDebtField(e));
    el.addEventListener('change', e => updateMemberDebtField(e));
  });
  container.querySelectorAll('.mc-remove').forEach(b => {
    b.addEventListener('click', e => {
      const id = parseInt(e.target.dataset.id, 10);
      removeMemberDebt(id);
    });
  });

  updateCapitalStackSummary();
}

function updateMemberDebtField(e) {
  const id = parseInt(e.target.dataset.id, 10);
  const field = e.target.dataset.field;
  const d = DB.memberDebt.find(x => x.id === id);
  if (!d) return;
  if (e.target.type === 'number' || e.target.classList.contains('db-fmt-currency') || e.target.classList.contains('db-fmt-percent')) d[field] = parseFloat(String(e.target.value).replace(/[\$,\s%]/g, '')) || 0;
  else d[field] = e.target.value;
  updateCapitalStackSummary();
}

// =============================================================================
// PROMOTE TIER MANAGEMENT
// =============================================================================
function initPromoteTierHandlers() {
  document.getElementById('add_promote_tier').addEventListener('click', () => {
    addPromoteTierData({
      id: DB.nextTierId++,
      threshold: 20,
      basis: 'irr',
      lpShare: 70,
      label: `Tier ${DB.promoteTiers.length + 3}`
    });
    renderPromoteTiers();
    recomputeAll();
  });
}

function addPromoteTierData(d) {
  DB.promoteTiers.push(d);
}

function removePromoteTier(id) {
  DB.promoteTiers = DB.promoteTiers.filter(t => t.id !== id);
  renderPromoteTiers();
  recomputeAll();
}

function renderPromoteTiers() {
  const container = document.getElementById('promote_tiers_container');
  container.innerHTML = '';
  DB.promoteTiers.forEach((t, idx) => {
    const isFinal = idx === DB.promoteTiers.length - 1;
    const row = document.createElement('div');
    row.className = `promote-tier-row ${isFinal ? 'tier-final' : ''}`;
    const thresholdLabel = (t.threshold >= 100 || isFinal) ? 'Final Tier (above all hurdles)' : `Up to ${t.threshold}% ${t.basis.toUpperCase()}`;
    row.innerHTML = `
      <div class="pt-header">
        <span class="pt-title">${escapeHtml(t.label)} &mdash; ${thresholdLabel}</span>
        <button class="mc-remove" type="button" data-id="${t.id}">Remove</button>
      </div>
      <div class="pt-fields">
        <div class="mc-field-mini">
          <label>Tier Label</label>
          <input type="text" value="${escapeHtml(t.label)}" data-id="${t.id}" data-field="label" />
        </div>
        <div class="mc-field-mini">
          <label>Hurdle Basis</label>
          <select data-id="${t.id}" data-field="basis">
            <option value="irr" ${t.basis === 'irr' ? 'selected' : ''}>IRR</option>
            <option value="moic" ${t.basis === 'moic' ? 'selected' : ''}>MOIC</option>
          </select>
        </div>
        <div class="mc-field-mini">
          <label>Threshold (${t.basis === 'moic' ? 'multiple' : '%'})</label>
          <input type="number" value="${t.threshold}" data-id="${t.id}" data-field="threshold" min="0" max="999" step="${t.basis === 'moic' ? '0.1' : '0.5'}" />
        </div>
        <div class="mc-field-mini">
          <label>LP Share (%)</label>
          <input type="number" value="${t.lpShare}" data-id="${t.id}" data-field="lpShare" min="0" max="100" step="1" />
        </div>
      </div>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', e => updatePromoteTierField(e));
    el.addEventListener('change', e => updatePromoteTierField(e));
  });
  container.querySelectorAll('.mc-remove').forEach(b => {
    b.addEventListener('click', e => {
      const id = parseInt(e.target.dataset.id, 10);
      removePromoteTier(id);
    });
  });
}

function updatePromoteTierField(e) {
  const id = parseInt(e.target.dataset.id, 10);
  const field = e.target.dataset.field;
  const t = DB.promoteTiers.find(x => x.id === id);
  if (!t) return;
  if (e.target.type === 'number' || e.target.classList.contains('db-fmt-currency') || e.target.classList.contains('db-fmt-percent')) t[field] = parseFloat(String(e.target.value).replace(/[\$,\s%]/g, '')) || 0;
  else t[field] = e.target.value;
  if (field === 'basis') renderPromoteTiers();
  if (field === 'label' || field === 'threshold') renderPromoteTiers();
}

// =============================================================================
// CAPITAL STACK SUMMARY (real-time)
// =============================================================================
function updateCapitalStackSummary() {
  const totalCap = DB.memberClasses.reduce((s, c) => s + (c.capital || 0), 0);
  const seniorDebt = parseFloat(String(document.getElementById('senior_loan').value).replace(/[\$,\s%]/g, '')) || 0;
  const memberDebt = DB.memberDebt.reduce((s, d) => s + (d.amount || 0), 0);
  const totalDebt = seniorDebt + memberDebt;
  const totalStack = totalCap + totalDebt;

  document.getElementById('total_member_capital').textContent = fmt$(totalCap);
  document.getElementById('total_classes').textContent = DB.memberClasses.length;
  document.getElementById('total_senior_debt').textContent = fmt$(seniorDebt);
  document.getElementById('total_member_debt').textContent = fmt$(memberDebt);
  document.getElementById('total_debt').textContent = fmt$(totalDebt);
  document.getElementById('total_capital_stack').textContent = fmt$(totalStack);
  document.getElementById('ltc_pct').textContent = totalStack > 0 ? (totalDebt / totalStack * 100).toFixed(1) + '%' : '0%';
  document.getElementById('equity_pct').textContent = totalStack > 0 ? (totalCap / totalStack * 100).toFixed(1) + '%' : '0%';
}

// =============================================================================
// CLAWBACK TOGGLE
// =============================================================================
function initClawbackToggle() {
  const sel = document.getElementById('clawback_type');
  sel.addEventListener('change', () => {
    const show = sel.value !== 'none';
    document.getElementById('clawback_threshold_group').style.display = show ? 'grid' : 'none';
  });
}

// =============================================================================
// INPUT LISTENERS (recompute on relevant changes)
// =============================================================================
function initInputListeners() {
  const inputIds = [
    'senior_loan', 'senior_rate', 'senior_avg_balance',
    'budget_land', 'budget_building', 'budget_hard', 'budget_contingency',
    'budget_soft', 'budget_dev_fees', 'budget_interest', 'budget_tax_ins',
    'budget_marketing', 'budget_other',
    'hold_months', 'exit_price',
    'disp_commission', 'disp_stamps', 'disp_other',
    'pref_rate', 'pref_type', 'pref_priority',
    'roc_order', 'catchup_style', 'catchup_target',
    'clawback_type', 'clawback_threshold', 'clawback_basis',
    'fee_acquisition', 'fee_development', 'fee_cm', 'fee_disposition',
    'fee_asset_mgmt', 'fee_other',
    'waterfall_style', 'hurdle_basis',
    'member_fed_rate', 'member_niit', 'member_ltcg_rate', 'member_1250_rate'
  ];
  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => { updateCapitalStackSummary(); /* heavy recalc on results tab open */ });
      el.addEventListener('change', () => { updateCapitalStackSummary(); });
    }
  });
}

// =============================================================================
// RESULTS ACTIONS
// =============================================================================
function initResultsActions() {
  document.getElementById('btn_recalculate').addEventListener('click', recomputeAll);
  document.getElementById('btn_save_json').addEventListener('click', saveJSON);
  document.getElementById('btn_load_json').addEventListener('click', () => document.getElementById('load_json_input').click());
  document.getElementById('load_json_input').addEventListener('change', loadJSON);
  document.getElementById('btn_print_summary').addEventListener('click', () => window.print());
  document.getElementById('btn_export_summary').addEventListener('click', exportTermSheet);
}

// =============================================================================
// FORMATTING HELPERS
// =============================================================================
function fmt$(n) {
  if (n === undefined || n === null || isNaN(n)) return '$0';
  const sign = n < 0 ? '-' : '';
  const v = Math.abs(Math.round(n));
  return sign + '$' + v.toLocaleString('en-US');
}

function fmtPct(n, decimals = 1) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return (n * 100).toFixed(decimals) + '%';
}

function fmtMult(n) {
  if (n === undefined || n === null || isNaN(n)) return '—';
  return n.toFixed(2) + 'x';
}

function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/**
 * Remove HTML tags from a value that is going to be rendered as plain text.
 *
 * The spelling this replaces — `String(v).replace(/<[^>]+>/g, '')` — is what
 * CodeQL flags as js/incomplete-multi-character-sanitization, and the flag is
 * correct, though not for the reason the rule's name suggests. A `<` that has
 * no `>` after it anywhere in the string is never matched by `<[^>]+>`, so it
 * survives the pass verbatim: that is exactly the "may still contain <script"
 * the rule reports. The stripped value is then interpolated into a larger
 * template, and the closing `>` the payload was missing is supplied by the
 * next literal in that template — the `</p>` at the end of the paragraph
 * finishes the tag the strip left half-open.
 *
 * Repeating the replace until the string stops changing — the usual remedy for
 * this rule, and the first thing to reach for — fixes nothing here. `[^>]+` is
 * greedy and crosses `<`, so one global pass is already a fixed point:
 * `<<b>script>` comes out as `script>`, not as `<script>`, and a second pass
 * has nothing left to match. (Exhaustively true for every string over
 * `< > a /` up to length 7; the accompanying test asserts it.) The hole is the
 * unmatched tail, and no number of passes closes it.
 *
 * So this is not a replacement at all. It walks the value once and copies out
 * only the characters standing at bracket depth zero, counting `<` in and `>`
 * back out, which means no `<` can appear in the result for any input: an
 * unterminated `<script` takes the remainder of the value with it instead of
 * being left for the template to finish. A stray `>` at depth zero is kept,
 * which is what the regex did with it, and which is inert on its own.
 */
function stripTagsToText(value) {
  if (value === null || value === undefined) return '';
  let out = '';
  let depth = 0;
  for (const ch of String(value)) {
    if (ch === '<') { depth++; continue; }
    if (ch === '>' && depth > 0) { depth--; continue; }
    if (depth === 0) out += ch;
  }
  return out;
}

/* Restored state — a loaded .json deal file — is whatever the file held, and
   JSON.parse hands back an attacker-controlled value as happily as a saved one.
   numOr0() is the coercion for the fields that are numbers rather than text
   (pref rates, unit counts); a value that will not survive it is not a number,
   so it reads as 0 rather than reaching HTML as a string. */
function numOr0(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

/* A <select>'s value is one of its options and nothing else — assigning anything
   else is what a browser already refuses, so validating against the option list
   on the restore path changes no behaviour while keeping an arbitrary string out
   of the field that collectFormData() / collectPhase7Data() later read back.
   Returns null when the value has no business being written to this element. */
function restorableValue(el, v) {
  if (typeof v !== 'string' && typeof v !== 'number' && typeof v !== 'boolean') return null;
  const s = String(v);
  if (el.tagName === 'SELECT') {
    return Array.prototype.some.call(el.options, o => o.value === s) ? s : null;
  }
  return s;
}

/* A state is a two-letter abbreviation (STATE_DATA is keyed on exactly that), so
   anything else in a restored entity is not a state. Refusing it here is the
   read-path half of the barrier on p7.issuer.formationState, which reaches the
   Form D worksheet's Blue Sky paragraph and from there document.write(). */
function restorableState(v) {
  return typeof v === 'string' && /^[A-Za-z]{2}$/.test(v) ? v.toUpperCase() : '';
}

// =============================================================================
// =============================================================================
//                       CALCULATION ENGINE
// =============================================================================
// =============================================================================

// -----------------------------------------------------------------------------
// collectFormData — pull every input into a single state object
// -----------------------------------------------------------------------------
function collectFormData() {
  const v = id => document.getElementById(id).value;
  const n = id => parseFloat(v(id)) || 0;
  const c = id => document.getElementById(id).checked;
  const pct = id => n(id) / 100;

  return {
    // Structure
    dealType: v('deal_type'),
    jurisdiction: v('jurisdiction'),
    projectName: v('project_name'),
    propertyLocation: v('property_location'),

    // Governance
    managementStructure: v('management_structure'),
    majorVoteThreshold: v('major_vote_threshold'),
    majorDecisions: {
      sale: c('md_sale'), refinance: c('md_refinance'), budget: c('md_budget'),
      admit: c('md_admit'), amend: c('md_amend'), dissolve: c('md_dissolve'),
      affiliate: c('md_affiliate'), capitalCall: c('md_capital_call')
    },
    provisions: {
      rofr: c('provision_rofr'), rofo: c('provision_rofo'),
      tag: c('provision_tag'), drag: c('provision_drag'),
      buysell: c('provision_buysell'), putcall: c('provision_putcall'),
      clawback: c('provision_clawback'), keyman: c('provision_keyman')
    },

    // Capital Stack
    memberClasses: DB.memberClasses.map(x => ({...x})),
    memberDebt: DB.memberDebt.map(x => ({...x})),
    seniorLoan: n('senior_loan'),
    seniorLoanType: v('senior_loan_type'),
    seniorRate: pct('senior_rate'),
    seniorAvgBalance: pct('senior_avg_balance'),
    senior752: v('senior_752_class'),

    // Budget
    budget: {
      land: n('budget_land'), building: n('budget_building'),
      hard: n('budget_hard'), contingency: n('budget_contingency'),
      soft: n('budget_soft'), devFees: n('budget_dev_fees'),
      interest: n('budget_interest'), taxIns: n('budget_tax_ins'),
      marketing: n('budget_marketing'), other: n('budget_other')
    },
    holdMonths: n('hold_months'),
    exitPrice: n('exit_price'),

    // Disposition
    dispCommission: pct('disp_commission'),
    dispStamps: pct('disp_stamps'),
    dispOther: n('disp_other'),

    // Waterfall
    waterfallStyle: v('waterfall_style'),
    hurdleBasis: v('hurdle_basis'),
    prefRate: pct('pref_rate'),
    prefType: v('pref_type'),
    prefPriority: v('pref_priority'),
    rocOrder: v('roc_order'),
    promoteTiers: DB.promoteTiers.map(x => ({...x})),
    catchupStyle: v('catchup_style'),
    catchupTarget: pct('catchup_target'),
    clawbackType: v('clawback_type'),
    clawbackThreshold: n('clawback_threshold'),
    clawbackBasis: v('clawback_basis'),

    // Fees
    feeAcquisition: pct('fee_acquisition'),
    feeDevelopment: pct('fee_development'),
    feeCM: pct('fee_cm'),
    feeDisposition: pct('fee_disposition'),
    feeAssetMgmt: pct('fee_asset_mgmt'),
    feeOther: n('fee_other'),

    // State & Tax
    propertyState: v('property_state'),
    overlays: {
      dealer: c('overlay_dealer'), bonus: c('overlay_bonus'),
      costSeg: c('overlay_cost_seg'), sec163j: c('overlay_163j'),
      sec461l: c('overlay_461l'), sec199a: c('overlay_199a'),
      dlts: c('overlay_dlts')
    },
    memberFedRate: pct('member_fed_rate'),
    memberNIIT: v('member_niit') === 'yes',
    memberLTCG: pct('member_ltcg_rate'),
    member1250: pct('member_1250_rate')
  };
}

// -----------------------------------------------------------------------------
// calculateDeal — orchestrates the full computation
// -----------------------------------------------------------------------------
function calculateDeal(data) {
  const years = data.holdMonths / 12;

  // ---- Sources & Uses ----
  const totalMemberCapital = data.memberClasses.reduce((s, c) => s + c.capital, 0);
  const totalMemberDebt = data.memberDebt.reduce((s, d) => s + d.amount, 0);
  const totalDebt = data.seniorLoan + totalMemberDebt;
  const totalSources = totalMemberCapital + totalDebt;

  // Budget aggregation
  const hardSubtotal = data.budget.hard + data.budget.contingency;
  const acqSubtotal = data.budget.land + data.budget.building;
  const softSubtotal = data.budget.soft + data.budget.taxIns + data.budget.marketing + data.budget.other;

  // Sponsor fees (computed off the inputs)
  const fees = {
    acquisition: data.feeAcquisition * data.budget.land,
    development: data.feeDevelopment * 0, // placeholder, compute below
    constructionMgmt: data.feeCM * hardSubtotal,
    disposition: data.feeDisposition * data.exitPrice,
    assetMgmt: data.feeAssetMgmt * totalMemberCapital * years,
    other: data.feeOther
  };

  // Interest carry computation (override if input is provided)
  const computedInterest = data.seniorAvgBalance * data.seniorLoan * data.seniorRate * years;
  const memberDebtInterest = data.memberDebt.reduce((s, d) =>
    s + (data.seniorAvgBalance * d.amount * (d.rate / 100) * years), 0);
  const totalInterest = data.budget.interest > 0 ? data.budget.interest : (computedInterest + memberDebtInterest);

  // Development fee: 2% of TPC. Use input budget_dev_fees if provided, else compute.
  // Use a closed-form solve: TPC = subtotal + dev% * TPC + interest + fixed fees
  // For Phase I, use input value or compute simply.
  const subtotalBeforeDev = acqSubtotal + hardSubtotal + softSubtotal + totalInterest +
                           fees.acquisition + fees.constructionMgmt + fees.disposition +
                           fees.assetMgmt + fees.other;
  let computedDevFee;
  if (data.budget.devFees > 0) {
    computedDevFee = data.budget.devFees;
  } else if (data.feeDevelopment > 0) {
    // Solve TPC = subtotal + dev * TPC  =>  TPC = subtotal / (1 - dev)
    computedDevFee = (subtotalBeforeDev / (1 - data.feeDevelopment)) * data.feeDevelopment;
  } else {
    computedDevFee = 0;
  }
  fees.development = computedDevFee;
  const totalSponsorFees = fees.acquisition + fees.development + fees.constructionMgmt +
                          fees.disposition + fees.assetMgmt + fees.other;

  // Total Project Cost
  const totalProjectCost = subtotalBeforeDev + fees.development;

  // ---- Sale & Disposition ----
  const grossSale = data.exitPrice;
  const brokerComm = grossSale * data.dispCommission;
  const docStamps = grossSale * data.dispStamps;
  const closingCosts = data.dispOther;
  const dispositionFee = fees.disposition; // paid out of sale
  const netSale = grossSale - brokerComm - docStamps - closingCosts - dispositionFee;
  const debtPayoff = totalDebt;
  const cashForWaterfall = Math.max(0, netSale - debtPayoff);

  // ---- Waterfall Execution ----
  const waterfall = executeWaterfall(data, cashForWaterfall, years);

  // ---- Compute per-class returns ----
  const classReturns = data.memberClasses.map(cls => {
    const dist = waterfall.distributions[cls.id] || 0;
    const profit = dist - cls.capital;
    const moic = cls.capital > 0 ? dist / cls.capital : (dist > 0 ? Infinity : 0);
    const irr = cls.capital > 0 && years > 0 && dist > 0 ?
                Math.pow(dist / cls.capital, 1 / years) - 1 : 0;
    return { class: cls, distribution: dist, profit, moic, irr };
  });

  // Aggregate LP metrics
  const lpClasses = classReturns.filter(r => r.class.classType !== 'sponsor');
  const totalLPCap = lpClasses.reduce((s, r) => s + r.class.capital, 0);
  const totalLPDist = lpClasses.reduce((s, r) => s + r.distribution, 0);
  const lpMOIC = totalLPCap > 0 ? totalLPDist / totalLPCap : 0;
  const lpIRR = totalLPCap > 0 && years > 0 && totalLPDist > 0 ?
                Math.pow(totalLPDist / totalLPCap, 1 / years) - 1 : 0;

  // Sponsor totals
  const sponsorClass = classReturns.find(r => r.class.classType === 'sponsor');
  const sponsorPromote = sponsorClass ? sponsorClass.distribution : 0;
  const sponsorTotalComp = sponsorPromote + totalSponsorFees;

  return {
    data,
    years,
    totalSources, totalMemberCapital, totalDebt, totalMemberDebt,
    totalProjectCost,
    fees, totalSponsorFees, totalInterest, computedInterest,
    hardSubtotal, acqSubtotal, softSubtotal,
    grossSale, brokerComm, docStamps, closingCosts, dispositionFee,
    netSale, debtPayoff, cashForWaterfall,
    waterfall,
    classReturns,
    totalLPCap, totalLPDist, lpMOIC, lpIRR,
    sponsorPromote, sponsorTotalComp,
    variance: totalSources - totalProjectCost
  };
}

// -----------------------------------------------------------------------------
// executeWaterfall — tier-by-tier execution, returns full trace and per-class
// distributions.
// -----------------------------------------------------------------------------
function executeWaterfall(data, cashPool, years) {
  const trace = [];
  const distributions = {};
  data.memberClasses.forEach(c => { distributions[c.id] = 0; });

  const lpClasses = data.memberClasses.filter(c => c.classType !== 'sponsor');
  const sponsorClass = data.memberClasses.find(c => c.classType === 'sponsor');
  const totalLPCap = lpClasses.reduce((s, c) => s + c.capital, 0);

  if (totalLPCap === 0) {
    // edge case: no LP capital
    trace.push({ tier: 0, name: 'No LP capital', description: '', total: 0, toLP: 0, toSponsor: 0, remaining: cashPool });
    return { trace, distributions, totalLPDistributions: 0, totalSponsorPromote: 0 };
  }

  let pool = cashPool;

  // ============ TIER 1: PREFERRED RETURN ============
  // Compute pref per class (each may have its own rate)
  let totalPref = 0;
  const prefDueByClass = {};
  for (const cls of lpClasses) {
    const rate = (cls.prefRate || 0) / 100;
    let pref;
    if (data.prefType === 'cumulative_compound') {
      pref = cls.capital * (Math.pow(1 + rate, years) - 1);
    } else if (data.prefType === 'non_cumulative') {
      pref = 0; // non-cumulative; would only accrue if interim distributions present
    } else {
      pref = cls.capital * rate * years; // cumulative simple
    }
    prefDueByClass[cls.id] = pref;
    totalPref += pref;
  }

  if (data.prefPriority === 'class_ordered') {
    // Pay in order of class (lower prefRate first, or by sequence)
    // For Phase I, pay in the order classes appear
    let prefPaidTotal = 0;
    for (const cls of lpClasses) {
      if (pool <= 0) break;
      const due = prefDueByClass[cls.id];
      const paid = Math.min(due, pool);
      distributions[cls.id] += paid;
      pool -= paid;
      prefPaidTotal += paid;
    }
    trace.push({
      tier: 1, name: 'Tier 1 — Preferred Return',
      description: `${(data.prefRate * 100).toFixed(2)}% per annum (class-ordered, ${data.prefType.replace('_', ' ')})`,
      total: prefPaidTotal, toLP: prefPaidTotal, toSponsor: 0, remaining: pool
    });
  } else {
    // Pari passu
    const prefAvailable = Math.min(pool, totalPref);
    const prefRatio = totalPref > 0 ? prefAvailable / totalPref : 0;
    for (const cls of lpClasses) {
      distributions[cls.id] += prefDueByClass[cls.id] * prefRatio;
    }
    trace.push({
      tier: 1, name: 'Tier 1 — Preferred Return',
      description: `${(data.prefRate * 100).toFixed(2)}% per annum (pari passu, ${data.prefType.replace('_', ' ')})`,
      total: prefAvailable, toLP: prefAvailable, toSponsor: 0, remaining: pool - prefAvailable
    });
    pool -= prefAvailable;
  }

  // ============ TIER 2: RETURN OF CAPITAL ============
  const totalROC = totalLPCap;
  const rocAvailable = Math.min(pool, totalROC);
  const rocRatio = totalROC > 0 ? rocAvailable / totalROC : 0;
  for (const cls of lpClasses) {
    distributions[cls.id] += cls.capital * rocRatio;
  }
  trace.push({
    tier: 2, name: 'Tier 2 — Return of Capital',
    description: data.rocOrder.replace('_', ' '),
    total: rocAvailable, toLP: rocAvailable, toSponsor: 0, remaining: pool - rocAvailable
  });
  pool -= rocAvailable;

  // ============ CATCH-UP (if configured) ============
  if (data.catchupStyle !== 'none' && pool > 0) {
    // Catch-up brings sponsor to its target share of profits paid above ROC
    const lpReceivedSoFar = lpClasses.reduce((s, c) => s + distributions[c.id], 0);
    const lpProfitSoFar = lpReceivedSoFar - totalLPCap;
    const sponsorTarget = data.catchupTarget; // e.g., 0.20 for 20% of profits to sponsor
    const totalProfitNeeded = lpProfitSoFar / (1 - sponsorTarget); // target total profit pool
    const sponsorCatchupNeeded = totalProfitNeeded - lpProfitSoFar;

    let catchupAmount;
    let cuLPShare, cuSpShare;
    if (data.catchupStyle === 'full') {
      cuLPShare = 0; cuSpShare = 1;
    } else if (data.catchupStyle === '80_20') {
      cuLPShare = 0.20; cuSpShare = 0.80;
    } else { // 50_50
      cuLPShare = 0.50; cuSpShare = 0.50;
    }

    // Catch-up runs until sponsor reaches sponsorCatchupNeeded
    const catchupTierTotal = Math.min(sponsorCatchupNeeded / cuSpShare, pool);
    catchupAmount = catchupTierTotal;
    const cuToLP = catchupTierTotal * cuLPShare;
    const cuToSponsor = catchupTierTotal * cuSpShare;

    for (const cls of lpClasses) {
      distributions[cls.id] += cuToLP * (cls.capital / totalLPCap);
    }
    if (sponsorClass) distributions[sponsorClass.id] += cuToSponsor;

    trace.push({
      tier: 2.5, name: 'GP Catch-Up',
      description: `${data.catchupStyle.replace('_', '/')} to ${(sponsorTarget * 100).toFixed(0)}% sponsor target`,
      total: catchupTierTotal, toLP: cuToLP, toSponsor: cuToSponsor, remaining: pool - catchupTierTotal
    });
    pool -= catchupTierTotal;
  }

  // ============ TIER 3+: PROMOTE TIERS ============
  // Sort tiers by threshold (ascending), put "final" tier (≥999) last
  const sortedTiers = [...data.promoteTiers].sort((a, b) => a.threshold - b.threshold);

  for (let i = 0; i < sortedTiers.length; i++) {
    if (pool <= 0) break;
    const tier = sortedTiers[i];
    const lpShare = (tier.lpShare || 0) / 100;
    const lpReceivedSoFar = lpClasses.reduce((s, c) => s + distributions[c.id], 0);

    let lpTarget;
    if (tier.threshold >= 999) {
      lpTarget = Infinity;
    } else if (tier.basis === 'irr') {
      lpTarget = totalLPCap * Math.pow(1 + (tier.threshold || 0) / 100, years);
    } else { // moic
      lpTarget = totalLPCap * (tier.threshold || 0);
    }

    let tierTotal;
    if (lpTarget === Infinity) {
      tierTotal = pool;
    } else {
      const lpNeeded = Math.max(0, lpTarget - lpReceivedSoFar);
      tierTotal = lpShare > 0 ? Math.min(lpNeeded / lpShare, pool) : pool;
    }

    const toLP = tierTotal * lpShare;
    const toSponsor = tierTotal * (1 - lpShare);

    for (const cls of lpClasses) {
      distributions[cls.id] += toLP * (cls.capital / totalLPCap);
    }
    if (sponsorClass) distributions[sponsorClass.id] += toSponsor;

    const threshLabel = tier.threshold >= 999 ? 'Above All Hurdles' :
                       `Up to ${tier.threshold}${tier.basis === 'moic' ? 'x MOIC' : '% IRR'}`;
    trace.push({
      tier: 3 + i, name: tier.label || `Tier ${3 + i}`,
      description: `${tier.lpShare}/${(100 - tier.lpShare).toFixed(0)} split ${threshLabel}`,
      total: tierTotal, toLP, toSponsor, remaining: pool - tierTotal
    });
    pool -= tierTotal;
  }

  // ============ CLAWBACK (if configured) ============
  if (data.clawbackType !== 'none' && sponsorClass && distributions[sponsorClass.id] > 0) {
    const lpFinalDist = lpClasses.reduce((s, c) => s + distributions[c.id], 0);
    let lpClawbackTarget;
    if (data.clawbackBasis === 'moic') {
      lpClawbackTarget = totalLPCap * data.clawbackThreshold;
    } else {
      lpClawbackTarget = totalLPCap * Math.pow(1 + data.clawbackThreshold / 100, years);
    }
    const shortfall = Math.max(0, lpClawbackTarget - lpFinalDist);
    if (shortfall > 0) {
      const clawback = Math.min(shortfall, distributions[sponsorClass.id]);
      distributions[sponsorClass.id] -= clawback;
      for (const cls of lpClasses) {
        distributions[cls.id] += clawback * (cls.capital / totalLPCap);
      }
      trace.push({
        tier: 99, name: 'Clawback Adjustment',
        description: `LP minimum ${data.clawbackThreshold}% ${data.clawbackBasis.toUpperCase()} not met; sponsor returns promote`,
        total: clawback, toLP: clawback, toSponsor: -clawback, remaining: pool
      });
    }
  }

  const totalLPDistributions = lpClasses.reduce((s, c) => s + distributions[c.id], 0);
  const totalSponsorPromote = sponsorClass ? distributions[sponsorClass.id] : 0;

  return { trace, distributions, totalLPDistributions, totalSponsorPromote };
}

// -----------------------------------------------------------------------------
// calculateSensitivity — 5x5 grid flexing exit price and hold period
// -----------------------------------------------------------------------------
function calculateSensitivity(baseData) {
  const priceDeltas = [-10, -5, 0, 5, 10];
  const holdDeltas = [-6, -3, 0, 3, 6];
  const grid = [];

  for (const dh of holdDeltas) {
    const row = { hold: baseData.holdMonths + dh, cells: [] };
    for (const dp of priceDeltas) {
      const flexed = JSON.parse(JSON.stringify(baseData));
      flexed.holdMonths = Math.max(1, baseData.holdMonths + dh);
      flexed.exitPrice = baseData.exitPrice * (1 + dp / 100);
      // Reattach memberClasses, etc. (they survive deep clone)
      const result = calculateDeal(flexed);
      row.cells.push({
        priceDelta: dp,
        holdDelta: dh,
        irr: result.lpIRR,
        moic: result.lpMOIC,
        isCenter: dp === 0 && dh === 0
      });
    }
    grid.push(row);
  }
  return { priceDeltas, holdDeltas, grid };
}

// =============================================================================
// =============================================================================
//                       RENDERING
// =============================================================================
// =============================================================================

function recomputeAll() {
  const data = collectFormData();
  const results = calculateDeal(data);
  results.sensitivity = calculateSensitivity(data);
  DB.lastResults = results;

  // Always update real-time summaries
  updateCapitalStackSummary();
  updateBudgetSummary(results);

  // If we're on the results step (or any tab — render anyway), update outputs
  renderResults(results);
}

function updateBudgetSummary(results) {
  document.getElementById('total_project_cost').textContent = fmt$(results.totalProjectCost);
  document.getElementById('capital_stack_check').textContent = fmt$(results.totalSources);
  const variance = results.totalSources - results.totalProjectCost;
  const varEl = document.getElementById('budget_variance');
  varEl.textContent = (variance >= 0 ? '+' : '') + fmt$(variance);
  const warn = document.getElementById('budget_variance_warning');
  if (Math.abs(variance) > 1000) {
    warn.style.display = 'block';
  } else {
    warn.style.display = 'none';
  }
}

function renderResults(r) {
  renderVerdict(r);
  renderSourcesUses(r);
  renderReturnsTable(r);
  renderWaterfallTrace(r);
  renderFeesTable(r);
  renderSensitivity(r);
  renderOrgChart(r);
  renderNotes(r);
}

// -----------------------------------------------------------------------------
// renderVerdict — PENCILS / MARGINAL / DOES NOT PENCIL
// -----------------------------------------------------------------------------
function renderVerdict(r) {
  const card = document.getElementById('verdict_card');
  const headline = document.getElementById('verdict_headline');
  const criteria = document.getElementById('verdict_criteria');

  let verdictText, verdictClass;
  if (r.lpIRR >= 0.20 && r.sponsorPromote > 0) {
    verdictText = 'PENCILS';
    verdictClass = '';
    card.className = 'db-verdict';
  } else if (r.lpIRR >= 0.15) {
    verdictText = 'MARGINAL';
    verdictClass = 'is-marginal';
    card.className = 'db-verdict is-marginal';
  } else {
    verdictText = 'DOES NOT PENCIL';
    verdictClass = 'is-fail';
    card.className = 'db-verdict is-fail';
  }

  if (r.totalLPCap === 0 || r.exitPrice === 0) {
    verdictText = 'AWAITING INPUTS';
    card.className = 'db-verdict';
  }

  headline.textContent = verdictText;

  const irrColor = r.lpIRR >= 0.20 ? 'green' : r.lpIRR >= 0.15 ? 'amber' : 'red';
  const moicColor = r.lpMOIC >= 1.5 ? 'green' : r.lpMOIC >= 1.25 ? 'amber' : 'red';

  criteria.innerHTML = `
    <div class="vc-item">
      <div class="vc-label">LP IRR (Blended)</div>
      <div class="vc-value ${irrColor}">${fmtPct(r.lpIRR, 1)}</div>
    </div>
    <div class="vc-item">
      <div class="vc-label">LP MOIC</div>
      <div class="vc-value ${moicColor}">${fmtMult(r.lpMOIC)}</div>
    </div>
    <div class="vc-item">
      <div class="vc-label">Sponsor Promote</div>
      <div class="vc-value">${fmt$(r.sponsorPromote)}</div>
    </div>
    <div class="vc-item">
      <div class="vc-label">Sponsor Total Comp</div>
      <div class="vc-value">${fmt$(r.sponsorTotalComp)}</div>
    </div>
  `;
}

// -----------------------------------------------------------------------------
// renderSourcesUses
// -----------------------------------------------------------------------------
function renderSourcesUses(r) {
  const body = document.getElementById('sources_uses_body');
  const sources = [
    ['Member Equity', r.totalMemberCapital],
    ['Senior Debt', r.data.seniorLoan],
    ['Member Debt / Mezz', r.totalMemberDebt]
  ].filter(s => s[1] > 0);

  const uses = [
    ['Land', r.data.budget.land],
    ['Existing Building', r.data.budget.building],
    ['Hard Construction', r.data.budget.hard],
    ['Construction Contingency', r.data.budget.contingency],
    ['Soft Costs', r.data.budget.soft],
    ['Sponsor Fees', r.totalSponsorFees],
    ['Interest Carry', r.totalInterest],
    ['Tax & Insurance Carry', r.data.budget.taxIns],
    ['Marketing & Sales Reserve', r.data.budget.marketing],
    ['Other / Working Capital', r.data.budget.other]
  ].filter(u => u[1] > 0);

  const maxRows = Math.max(sources.length, uses.length);
  let html = '';
  for (let i = 0; i < maxRows; i++) {
    const s = sources[i] || ['', null];
    const u = uses[i] || ['', null];
    html += `<tr>
      <td>${s[0]}</td>
      <td class="right">${s[1] !== null ? fmt$(s[1]) : ''}</td>
      <td>${u[0]}</td>
      <td class="right">${u[1] !== null ? fmt$(u[1]) : ''}</td>
    </tr>`;
  }
  html += `<tr class="row-total">
    <td>Total Sources</td>
    <td class="right">${fmt$(r.totalSources)}</td>
    <td>Total Uses</td>
    <td class="right">${fmt$(r.totalProjectCost)}</td>
  </tr>`;
  body.innerHTML = html;
}

// -----------------------------------------------------------------------------
// renderReturnsTable
// -----------------------------------------------------------------------------
function renderReturnsTable(r) {
  const body = document.getElementById('returns_body');
  let html = '';
  for (const ret of r.classReturns) {
    const cls = ret.class;
    const badge = cls.classType === 'sponsor' ? '<span style="color:#C9A961;font-weight:700;font-size:0.7rem;">GP</span> ' :
                  cls.classType === 'lp_guarantor' ? '<span style="color:#8b3a3a;font-weight:700;font-size:0.7rem;">A-2</span> ' :
                  '<span style="color:#169B62;font-weight:700;font-size:0.7rem;">LP</span> ';
    html += `<tr>
      <td>${badge}${escapeHtml(cls.name)}</td>
      <td class="right">${fmt$(cls.capital)}</td>
      <td class="right">${fmt$(ret.distribution)}</td>
      <td class="right">${fmt$(ret.profit)}</td>
      <td class="right">${fmtMult(ret.moic)}</td>
      <td class="right">${fmtPct(ret.irr, 1)}</td>
    </tr>`;
  }
  html += `<tr class="row-total">
    <td>Total LP (Blended)</td>
    <td class="right">${fmt$(r.totalLPCap)}</td>
    <td class="right">${fmt$(r.totalLPDist)}</td>
    <td class="right">${fmt$(r.totalLPDist - r.totalLPCap)}</td>
    <td class="right">${fmtMult(r.lpMOIC)}</td>
    <td class="right">${fmtPct(r.lpIRR, 1)}</td>
  </tr>`;
  body.innerHTML = html;
}

// -----------------------------------------------------------------------------
// renderWaterfallTrace
// -----------------------------------------------------------------------------
function renderWaterfallTrace(r) {
  const body = document.getElementById('waterfall_trace_body');
  let html = '';
  for (const t of r.waterfall.trace) {
    const tierLabel = t.tier === 2.5 ? 'CU' : t.tier === 99 ? 'CB' : t.tier;
    html += `<tr>
      <td>${tierLabel}</td>
      <td><strong>${escapeHtml(t.name)}</strong><br><span style="font-size:0.82rem;color:#6b6b6b;">${escapeHtml(t.description)}</span></td>
      <td class="right">${fmt$(t.total)}</td>
      <td class="right">${fmt$(t.toLP)}</td>
      <td class="right">${fmt$(t.toSponsor)}</td>
      <td class="right">${fmt$(t.remaining)}</td>
    </tr>`;
  }
  body.innerHTML = html;
}

// -----------------------------------------------------------------------------
// renderFeesTable
// -----------------------------------------------------------------------------
function renderFeesTable(r) {
  const body = document.getElementById('fees_body');
  const items = [
    ['Acquisition Fee', `${(r.data.feeAcquisition * 100).toFixed(2)}% of land basis`, r.fees.acquisition],
    ['Development Fee', `${(r.data.feeDevelopment * 100).toFixed(2)}% of TPC`, r.fees.development],
    ['Construction Mgmt Fee', `${(r.data.feeCM * 100).toFixed(2)}% of hard costs`, r.fees.constructionMgmt],
    ['Disposition Fee', `${(r.data.feeDisposition * 100).toFixed(2)}% of sale price`, r.fees.disposition],
    ['Asset Mgmt Fee', `${(r.data.feeAssetMgmt * 100).toFixed(2)}% of equity × ${r.years.toFixed(2)} years`, r.fees.assetMgmt],
    ['Other Fees / Reimbursements', 'Flat amount', r.fees.other]
  ];
  let html = '';
  for (const [label, basis, amt] of items) {
    if (amt > 0) {
      html += `<tr><td>${label}</td><td>${basis}</td><td class="right">${fmt$(amt)}</td></tr>`;
    }
  }
  html += `<tr class="row-total"><td>Total Sponsor Fees</td><td></td><td class="right">${fmt$(r.totalSponsorFees)}</td></tr>`;
  body.innerHTML = html;
}

// -----------------------------------------------------------------------------
// renderSensitivity — 5x5 heat map
// -----------------------------------------------------------------------------
function renderSensitivity(r) {
  const head = document.getElementById('sensitivity_head');
  const body = document.getElementById('sensitivity_body');
  const s = r.sensitivity;

  // Header row: price deltas
  let headHtml = '<tr><th class="row-label">Hold ↓ / Price →</th>';
  for (const dp of s.priceDeltas) {
    headHtml += `<th>${dp >= 0 ? '+' : ''}${dp}% Price</th>`;
  }
  headHtml += '</tr>';
  head.innerHTML = headHtml;

  let bodyHtml = '';
  for (const row of s.grid) {
    const dh = row.hold - r.data.holdMonths;
    bodyHtml += `<tr><td class="row-label">${row.hold} mo (${dh >= 0 ? '+' : ''}${dh})</td>`;
    for (const cell of row.cells) {
      const irr = cell.irr;
      let heat;
      if (irr >= 0.25) heat = 'heat-excellent';
      else if (irr >= 0.18) heat = 'heat-good';
      else if (irr >= 0.12) heat = 'heat-marginal';
      else if (irr >= 0.05) heat = 'heat-poor';
      else heat = 'heat-fail';
      const centerClass = cell.isCenter ? 'center' : '';
      bodyHtml += `<td class="${heat} ${centerClass}"><strong>${fmtPct(irr, 1)}</strong><br><span style="font-size:0.78rem;opacity:0.85;">${fmtMult(cell.moic)}</span></td>`;
    }
    bodyHtml += '</tr>';
  }
  body.innerHTML = bodyHtml;
}

// -----------------------------------------------------------------------------
// renderOrgChart — simple HTML/CSS tree
// -----------------------------------------------------------------------------
function renderOrgChart(r) {
  const target = document.getElementById('org_chart');
  const lpClasses = r.data.memberClasses.filter(c => c.classType !== 'sponsor');
  const sponsor = r.data.memberClasses.find(c => c.classType === 'sponsor');
  const dealLabel = DEAL_TYPES[r.data.dealType]?.label || r.data.dealType;
  const entity = DEAL_TYPES[r.data.dealType]?.defaultEntity || 'LLC';

  let topRow = '<div class="org-row">';
  for (const lp of lpClasses) {
    topRow += `<div class="org-node">
      <div class="org-node-label">${escapeHtml(lp.name)}</div>
      <div class="org-node-sub">${fmt$(lp.capital)} capital · ${numOr0(lp.prefRate)}% pref</div>
    </div>`;
  }
  if (sponsor) {
    topRow += `<div class="org-node is-sponsor">
      <div class="org-node-label">${escapeHtml(sponsor.name)}</div>
      <div class="org-node-sub">Promote: ${fmt$(r.sponsorPromote)}</div>
    </div>`;
  }
  topRow += '</div>';

  const spvLabel = r.data.projectName || '[Project Name]';
  const spvNode = `<div class="org-node is-spv">
    <div class="org-node-label">${escapeHtml(spvLabel)} (${entity})</div>
    <div class="org-node-sub">${escapeHtml(dealLabel)} · ${escapeHtml(r.data.jurisdiction)}</div>
  </div>`;

  const debtRow = r.data.seniorLoan > 0 ? `<div class="org-row">
    <div class="org-node" style="border-left:3px solid #d4a017;">
      <div class="org-node-label">Senior Debt — ${escapeHtml(String(r.data.seniorLoanType || '').replace('_', ' '))}</div>
      <div class="org-node-sub">${fmt$(r.data.seniorLoan)} @ ${(r.data.seniorRate * 100).toFixed(2)}%</div>
    </div>
  </div>` : '';

  const propertyNode = `<div class="org-node">
    <div class="org-node-label">Property</div>
    <div class="org-node-sub">${escapeHtml(r.data.propertyLocation || 'Location TBD')}</div>
  </div>`;

  target.innerHTML = `
    <div class="org-tree">
      ${topRow}
      <div class="org-connector"></div>
      ${spvNode}
      ${debtRow ? '<div class="org-connector"></div>' + debtRow : ''}
      <div class="org-connector"></div>
      ${propertyNode}
    </div>
    <p style="text-align:center;margin-top:1rem;font-size:0.82rem;color:#6b6b6b;font-style:italic;">
      Simplified structure diagram. Phase V will add interactive drag-and-drop editor with blocker entities, parallel feeders, and tax-classification flags.
    </p>
  `;
}

// -----------------------------------------------------------------------------
// renderNotes — structural notes and warnings based on deal config
// -----------------------------------------------------------------------------
function renderNotes(r) {
  const target = document.getElementById('notes_warnings');
  const notes = [];

  // Deal-type-specific notes
  const dealNotes = DEAL_TYPES[r.data.dealType]?.notes || [];
  for (const n of dealNotes) {
    notes.push({ type: n.type, text: n.text });
  }

  // §752 implications based on senior debt classification
  if (r.data.seniorLoan > 0 && r.data.senior752 === 'nonrecourse') {
    notes.push({ type: 'tax', text: 'Senior debt classified as nonrecourse: allocated under Reg §1.752-3 third-tier (profit-sharing ratios). Does NOT increase §465 at-risk basis; loss deductions may be limited.' });
  }
  if (r.data.seniorLoan > 0 && r.data.senior752 === 'qnrf') {
    notes.push({ type: 'tax', text: 'Senior debt classified as qualified nonrecourse financing under §465(b)(6): increases at-risk basis. Confirm lender is qualified (bank, insurance company, or government).' });
  }
  if (r.data.seniorLoan > 0 && r.data.senior752 === 'recourse') {
    notes.push({ type: 'warn', text: 'Recourse debt: allocated to guarantor(s) under Reg §1.752-2 only. Non-guarantor members do not receive basis allocation; their losses may be limited. Confirm guarantor net worth supports the obligation.' });
  }

  // Securities compliance notes
  const lpCount = r.data.memberClasses.filter(c => c.classType !== 'sponsor').length;
  if ((r.data.dealType === 'fund' || r.data.dealType === 'master_feeder' || lpCount > 1) && r.data.dealType !== 'tic') {
    notes.push({ type: 'warn', text: 'Multiple LP investors: confirm Reg D 506(b) or 506(c) exemption, file Form D within 15 days of first sale, and observe state blue sky notice requirements. Accredited investor verification required (especially for 506(c) general solicitation).' });
  }

  // Dealer property warning
  if (r.data.overlays.dealer) {
    notes.push({ type: 'warn', text: 'Sale treated as ordinary income (dealer property): LTCG rates and §1031 unavailable. §199A QBI deduction may apply if rental safe harbor is met (Rev. Proc. 2019-38). Confirm dealer characterization with reference to <em>Malat v. Riddell</em>, 383 U.S. 569 (1966), and held-for-sale-vs-investment factors.' });
  }

  // State conformity warnings
  const stateData = STATE_DATA.find(s => s.abbr === r.data.propertyState);
  if (stateData) {
    if (r.data.overlays.bonus && stateData.bonus === 'decouple') {
      notes.push({ type: 'warn', text: `${stateData.name} decouples from federal §168(k) bonus depreciation. State taxable income will be higher than federal; expect a state addback. Phase VI will model the addback precisely.` });
    }
    if (r.data.overlays.sec461l && stateData.sec461l === 'decouple') {
      notes.push({ type: 'warn', text: `${stateData.name} decouples from federal §461(l) excess business loss limitation. State treatment may permit current deduction even where federal is deferred. Phase VI will model.` });
    }
    if (stateData.ptet && stateData.incTax > 0) {
      notes.push({ type: 'info', text: `${stateData.name} offers a pass-through entity tax (PTET) election. Eligible partnerships may pay state tax at the entity level, deducting the payment federally and bypassing the $10K SALT cap. Engage Donovan Legal to evaluate the election in conjunction with §199A and member basis effects.` });
    }
  }

  // Budget variance
  if (Math.abs(r.variance) > 1000) {
    if (r.variance > 0) {
      notes.push({ type: 'info', text: `Capital stack exceeds project cost by ${fmt$(r.variance)}. Excess will be distributed or held in reserve at closing.` });
    } else {
      notes.push({ type: 'warn', text: `Project cost exceeds capital stack by ${fmt$(-r.variance)}. Additional capital or debt is required to fully fund the project, or budget reductions are needed.` });
    }
  }

  // Clawback note
  if (r.data.clawbackType !== 'none') {
    notes.push({ type: 'info', text: `Clawback provision active: sponsor must return promote if LP fails to achieve ${r.data.clawbackThreshold}${r.data.clawbackBasis === 'moic' ? 'x MOIC' : '% IRR'} at exit. Phase II will model clawback effects on §704(b) capital accounts and the associated personal guaranty obligation.` });
  }

  // DLTS overlay note
  if (r.data.overlays.dlts) {
    notes.push({ type: 'info', text: 'Donovan Legal Tax Strategy (DLTS) overlay enabled. Reserved methodology; analysis reflects firm-developed assumptions. Engagement of the firm under a written engagement letter required to implement the strategy.' });
  }

  // Foreign investor / blocker reminder
  if (lpCount > 0 && r.data.dealType !== 'reit_private' && r.data.dealType !== 'reit_public') {
    notes.push({ type: 'info', text: 'Foreign investors and U.S. tax-exempt entities require additional analysis (FIRPTA, ECI, UBTI, blocker structures). Phase III adds the full module. For preliminary analysis, foreign and tax-exempt investors should be flagged and discussed with the firm prior to closing.' });
  }

  // Always: engagement reminder
  notes.push({ type: 'info', text: 'This tool produces mechanical computation. Engagement of Donovan Legal PLLC under a written engagement letter is required before any structure modeled here is implemented or relied upon.' });

  let html = '';
  for (const n of notes) {
    html += `<div class="note-item note-${n.type}">${n.text}</div>`;
  }
  target.innerHTML = html;
}

// =============================================================================
// SAVE / LOAD JSON
// =============================================================================
function saveJSON() {
  const data = collectFormData();
  const payload = {
    version: 'phase-1',
    savedAt: new Date().toISOString(),
    state: {
      memberClasses: DB.memberClasses,
      memberDebt: DB.memberDebt,
      promoteTiers: DB.promoteTiers,
      nextMemberId: DB.nextMemberId,
      nextDebtId: DB.nextDebtId,
      nextTierId: DB.nextTierId
    },
    formInputs: {
      deal_type: document.getElementById('deal_type').value,
      jurisdiction: document.getElementById('jurisdiction').value,
      project_name: document.getElementById('project_name').value,
      property_location: document.getElementById('property_location').value,
      management_structure: document.getElementById('management_structure').value,
      major_vote_threshold: document.getElementById('major_vote_threshold').value,
      senior_loan: document.getElementById('senior_loan').value,
      senior_loan_type: document.getElementById('senior_loan_type').value,
      senior_rate: document.getElementById('senior_rate').value,
      senior_avg_balance: document.getElementById('senior_avg_balance').value,
      senior_752_class: document.getElementById('senior_752_class').value,
      budget_land: document.getElementById('budget_land').value,
      budget_building: document.getElementById('budget_building').value,
      budget_hard: document.getElementById('budget_hard').value,
      budget_contingency: document.getElementById('budget_contingency').value,
      budget_soft: document.getElementById('budget_soft').value,
      budget_dev_fees: document.getElementById('budget_dev_fees').value,
      budget_interest: document.getElementById('budget_interest').value,
      budget_tax_ins: document.getElementById('budget_tax_ins').value,
      budget_marketing: document.getElementById('budget_marketing').value,
      budget_other: document.getElementById('budget_other').value,
      hold_months: document.getElementById('hold_months').value,
      exit_price: document.getElementById('exit_price').value,
      disp_commission: document.getElementById('disp_commission').value,
      disp_stamps: document.getElementById('disp_stamps').value,
      disp_other: document.getElementById('disp_other').value,
      waterfall_style: document.getElementById('waterfall_style').value,
      hurdle_basis: document.getElementById('hurdle_basis').value,
      pref_rate: document.getElementById('pref_rate').value,
      pref_type: document.getElementById('pref_type').value,
      pref_priority: document.getElementById('pref_priority').value,
      roc_order: document.getElementById('roc_order').value,
      catchup_style: document.getElementById('catchup_style').value,
      catchup_target: document.getElementById('catchup_target').value,
      clawback_type: document.getElementById('clawback_type').value,
      clawback_threshold: document.getElementById('clawback_threshold').value,
      clawback_basis: document.getElementById('clawback_basis').value,
      fee_acquisition: document.getElementById('fee_acquisition').value,
      fee_development: document.getElementById('fee_development').value,
      fee_cm: document.getElementById('fee_cm').value,
      fee_disposition: document.getElementById('fee_disposition').value,
      fee_asset_mgmt: document.getElementById('fee_asset_mgmt').value,
      fee_other: document.getElementById('fee_other').value,
      property_state: document.getElementById('property_state').value,
      member_fed_rate: document.getElementById('member_fed_rate').value,
      member_niit: document.getElementById('member_niit').value,
      member_ltcg_rate: document.getElementById('member_ltcg_rate').value,
      member_1250_rate: document.getElementById('member_1250_rate').value,
      checkboxes: {}
    }
  };
  // Capture checkbox states
  ['md_sale','md_refinance','md_budget','md_admit','md_amend','md_dissolve','md_affiliate','md_capital_call',
   'provision_rofr','provision_rofo','provision_tag','provision_drag','provision_buysell','provision_putcall','provision_clawback','provision_keyman',
   'overlay_dealer','overlay_bonus','overlay_cost_seg','overlay_163j','overlay_461l','overlay_199a','overlay_dlts'].forEach(id => {
    const el = document.getElementById(id);
    if (el) payload.formInputs.checkboxes[id] = el.checked;
  });

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (data.projectName || 'deal').replace(/[^a-zA-Z0-9-_]/g, '_');
  a.href = url;
  a.download = `${name}-deal-builder-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function loadJSON(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const payload = JSON.parse(e.target.result);
      if (payload.version !== 'phase-1') {
        alert('Warning: this file was saved under a different version of the tool. Loading anyway.');
      }
      // Restore DB state
      DB.memberClasses = payload.state.memberClasses || [];
      DB.memberDebt = payload.state.memberDebt || [];
      DB.promoteTiers = payload.state.promoteTiers || [];
      DB.nextMemberId = payload.state.nextMemberId || DB.memberClasses.length + 1;
      DB.nextDebtId = payload.state.nextDebtId || DB.memberDebt.length + 1;
      DB.nextTierId = payload.state.nextTierId || DB.promoteTiers.length + 1;

      // Restore form inputs. Read-path half of the barrier: `jurisdiction` and
      // `senior_loan_type` reach renderOrgChart's innerHTML unescaped, and
      // `dp_issuer_formation_state` reaches document.write() via the Form D
      // worksheet, so a value that the element itself would refuse is not
      // written into it in the first place.
      for (const [id, val] of Object.entries(payload.formInputs)) {
        if (id === 'checkboxes') continue;
        const el = document.getElementById(id);
        if (!el) continue;
        const restorable = restorableValue(el, val);
        if (restorable !== null) el.value = restorable;
      }
      // Restore checkboxes
      if (payload.formInputs.checkboxes) {
        for (const [id, val] of Object.entries(payload.formInputs.checkboxes)) {
          const el = document.getElementById(id);
          if (el) el.checked = val;
        }
      }

      // Re-render and recompute
      renderMemberClasses();
      renderMemberDebt();
      renderPromoteTiers();
      renderStateSummary();
      // Trigger help text updates
      document.getElementById('deal_type_help').innerHTML = DEAL_TYPES[document.getElementById('deal_type').value]?.help || '';
      document.getElementById('jurisdiction_help').innerHTML = JURISDICTION_HELP[document.getElementById('jurisdiction').value] || '';
      document.getElementById('senior_752_help').innerHTML = SEC752_HELP[document.getElementById('senior_752_class').value] || '';
      // Trigger clawback group visibility
      const cbType = document.getElementById('clawback_type').value;
      document.getElementById('clawback_threshold_group').style.display = cbType !== 'none' ? 'grid' : 'none';

      recomputeAll();
      alert(`Deal loaded: ${payload.formInputs.project_name || 'unnamed'} (saved ${payload.savedAt})`);
    } catch (err) {
      alert('Error loading file: ' + err.message);
    }
  };
  reader.readAsText(file);
  // Reset the input so the same file can be loaded again
  event.target.value = '';
}

// =============================================================================
// EXPORT TERM SHEET (downloadable HTML summary)
// =============================================================================
function exportTermSheet() {
  if (!DB.lastResults) recomputeAll();
  const r = DB.lastResults;
  const date = new Date().toISOString().slice(0,10);
  const dealName = r.data.projectName || 'Unnamed Project';
  const dealLabel = DEAL_TYPES[r.data.dealType]?.label || r.data.dealType;
  const state = STATE_DATA.find(s => s.abbr === r.data.propertyState);

  const classRows = r.classReturns.map(ret => `
    <tr><td>${escapeHtml(ret.class.name)}</td><td>${fmt$(ret.class.capital)}</td><td>${fmt$(ret.distribution)}</td><td>${fmtMult(ret.moic)}</td><td>${fmtPct(ret.irr, 1)}</td></tr>
  `).join('');

  const html = `<!doctype html>
<html><head><meta charset="utf-8">
<title>Deal Term Sheet — ${escapeHtml(dealName)}</title>
<style>
  body { font-family: 'Open Sans', Arial, sans-serif; max-width: 920px; margin: 2rem auto; padding: 0 1.5rem; color: #1a1a1a; }
  .header { border-bottom: 3px solid #169B62; padding-bottom: 1rem; margin-bottom: 2rem; }
  .eyebrow { font-size: 0.75rem; letter-spacing: 3px; color: #169B62; font-weight: 700; text-transform: uppercase; margin-bottom: 0.4rem; }
  h1 { font-size: 1.8rem; margin: 0 0 0.4rem 0; color: #1a1a1a; }
  .sub { color: #6b6b6b; font-size: 0.95rem; }
  h2 { font-size: 1.1rem; color: #1a1a1a; margin: 2rem 0 0.75rem 0; padding-bottom: 0.4rem; border-bottom: 1px solid #d4d4d0; text-transform: uppercase; letter-spacing: 1.5px; }
  table { width: 100%; border-collapse: collapse; font-size: 0.92rem; margin-bottom: 1.5rem; }
  th { background: #1a1a1a; color: #F5F5F0; padding: 0.55rem 0.75rem; text-align: left; font-size: 0.78rem; letter-spacing: 1px; text-transform: uppercase; }
  td { padding: 0.55rem 0.75rem; border-bottom: 1px solid #f0f0e8; }
  .right { text-align: right; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 0.85rem; margin-bottom: 1.5rem; }
  .stat { padding: 0.85rem 1rem; background: #fafaf5; border-left: 3px solid #169B62; }
  .stat-label { font-size: 0.7rem; letter-spacing: 1.5px; text-transform: uppercase; color: #6b6b6b; margin-bottom: 0.25rem; font-weight: 700; }
  .stat-value { font-size: 1.2rem; font-weight: 700; color: #1a1a1a; }
  .draft-stamp { color: #8b3a3a; font-size: 0.78rem; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; }
  .footer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #d4d4d0; font-size: 0.82rem; color: #6b6b6b; line-height: 1.6; }
</style>
</head><body>
<div class="header">
  <div class="eyebrow">Deal Term Sheet · Draft · Reserve</div>
  <h1>${escapeHtml(dealName)}</h1>
  <div class="sub">${escapeHtml(dealLabel)} · ${r.data.jurisdiction} entity · Property in ${state ? escapeHtml(state.name) : r.data.propertyState}</div>
  <div class="sub">Generated ${date} · <span class="draft-stamp">DRAFT — Subject to Donovan Legal PLLC review</span></div>
</div>

<h2>Headline Economics</h2>
<div class="stat-grid">
  <div class="stat"><div class="stat-label">LP IRR</div><div class="stat-value">${fmtPct(r.lpIRR, 1)}</div></div>
  <div class="stat"><div class="stat-label">LP MOIC</div><div class="stat-value">${fmtMult(r.lpMOIC)}</div></div>
  <div class="stat"><div class="stat-label">Sponsor Promote</div><div class="stat-value">${fmt$(r.sponsorPromote)}</div></div>
  <div class="stat"><div class="stat-label">Hold Period</div><div class="stat-value">${r.data.holdMonths} mo</div></div>
</div>

<h2>Capital Stack & Project Cost</h2>
<table>
  <tr><td>Total Member Capital</td><td class="right">${fmt$(r.totalMemberCapital)}</td></tr>
  <tr><td>Senior Debt (${r.data.seniorLoanType.replace('_',' ')})</td><td class="right">${fmt$(r.data.seniorLoan)}</td></tr>
  <tr><td>Member Debt / Mezzanine</td><td class="right">${fmt$(r.totalMemberDebt)}</td></tr>
  <tr><td><strong>Total Capital Stack</strong></td><td class="right"><strong>${fmt$(r.totalSources)}</strong></td></tr>
  <tr><td>Total Project Cost</td><td class="right">${fmt$(r.totalProjectCost)}</td></tr>
  <tr><td>Target Sale Price</td><td class="right">${fmt$(r.grossSale)}</td></tr>
  <tr><td>Net Sale (after disposition)</td><td class="right">${fmt$(r.netSale)}</td></tr>
  <tr><td>Cash to Equity Waterfall</td><td class="right">${fmt$(r.cashForWaterfall)}</td></tr>
</table>

<h2>Returns by Class</h2>
<table>
  <thead><tr><th>Class</th><th>Capital</th><th>Distribution</th><th>MOIC</th><th>IRR</th></tr></thead>
  <tbody>${classRows}</tbody>
</table>

<h2>Waterfall Summary</h2>
<table>
  <tr><td>Preferred Return Rate</td><td class="right">${(r.data.prefRate * 100).toFixed(2)}% p.a. (${r.data.prefType.replace('_',' ')})</td></tr>
  <tr><td>Waterfall Style</td><td class="right">${r.data.waterfallStyle}</td></tr>
  <tr><td>Promote Tiers</td><td class="right">${r.data.promoteTiers.length} configured</td></tr>
  <tr><td>Catch-Up</td><td class="right">${r.data.catchupStyle.replace('_','/')} to ${(r.data.catchupTarget * 100).toFixed(0)}%</td></tr>
  <tr><td>Clawback</td><td class="right">${r.data.clawbackType.replace('_',' ')}</td></tr>
</table>

<h2>Sponsor Compensation</h2>
<table>
  <tr><td>Acquisition Fee</td><td class="right">${fmt$(r.fees.acquisition)}</td></tr>
  <tr><td>Development Fee</td><td class="right">${fmt$(r.fees.development)}</td></tr>
  <tr><td>Construction Mgmt Fee</td><td class="right">${fmt$(r.fees.constructionMgmt)}</td></tr>
  <tr><td>Disposition Fee</td><td class="right">${fmt$(r.fees.disposition)}</td></tr>
  <tr><td>Asset Mgmt Fee</td><td class="right">${fmt$(r.fees.assetMgmt)}</td></tr>
  <tr><td>Promote (after waterfall)</td><td class="right">${fmt$(r.sponsorPromote)}</td></tr>
  <tr><td><strong>Total Sponsor Compensation</strong></td><td class="right"><strong>${fmt$(r.sponsorTotalComp)}</strong></td></tr>
</table>

<div class="footer">
  <p><strong>Disclaimer.</strong> This term sheet is generated by the Donovan Legal PLLC Reserve Deal Builder tool. It reflects mechanical computation based on inputs provided. It does not constitute legal, tax, or accounting advice and does not create an attorney-client relationship. Any structure modeled here is subject to firm review under a written engagement letter and may require modification to comply with applicable federal, state, and local law including securities, tax, and bar regulations. Donovan Legal PLLC, 301 W. Atlantic Avenue, Suite 5, Delray Beach, Florida 33444.</p>
  <p style="text-align:right;font-family:monospace;letter-spacing:2px;font-size:0.75rem;color:#999;">DRAFT · RESERVE · ${date}</p>
</div>
</body></html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (dealName).replace(/[^a-zA-Z0-9-_]/g, '_');
  a.href = url;
  a.download = `${name}-term-sheet-${date}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}


// =============================================================================
// =============================================================================
//                       PHASE 2 — TAX ALLOCATIONS
//          §704(b), §704(c) three-method engine, §754, §734(b), §743(b)
//                  Capital Account Roll-Forward, Special Allocations
// =============================================================================
// =============================================================================

// Extend DB state with Phase 2 fields
DB.sec704cLayers = [];
DB.nextLayerId = 1;

// =============================================================================
// HELP TEXT — §704(b) METHODS
// =============================================================================
const SEC704B_HELP = {
  targeted: '<strong>Targeted Capital Account Method:</strong> Modern default for real estate partnerships. Allocations are made to drive capital account balances to the amounts each partner would receive on a hypothetical liquidation following the partnership&rsquo;s distribution waterfall. Implicitly satisfies the partner-by-partner economic effect test through the qualified income offset. Does not require a deficit restoration obligation. Reg.&nbsp;&sect;&nbsp;1.704-1(b)(2) safe harbor not formally claimed but allocations respected if economic effect is preserved.',
  see_dro: '<strong>Substantial Economic Effect with Deficit Restoration Obligation:</strong> Classical safe harbor under Reg.&nbsp;&sect;&nbsp;1.704-1(b)(2)(ii)(b). Requires: (1) maintenance of capital accounts under Reg.&nbsp;&sect;&nbsp;1.704-1(b)(2)(iv); (2) liquidating distributions in accordance with positive capital account balances; and (3) unconditional obligation of each partner with a deficit balance to restore the deficit at liquidation. Rarely used outside of sophisticated structures because the DRO creates personal exposure.',
  see_qio: '<strong>Substantial Economic Effect with Qualified Income Offset:</strong> Alternate test under Reg.&nbsp;&sect;&nbsp;1.704-1(b)(2)(ii)(d). Same as SEE+DRO except that, in lieu of a DRO, the partnership agreement contains a qualified income offset that requires income/gain to be specially allocated to any partner with an unexpected negative capital account balance. Used when partners are unwilling to commit to deficit restoration.'
};

// =============================================================================
// INITIALIZATION — Wire up new Step 6 (Tax Allocations) handlers
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initAllocationHandlers();
});

function initAllocationHandlers() {
  // 704(b) method selector
  const methodSel = document.getElementById('alloc_704b_method');
  if (methodSel) {
    methodSel.addEventListener('change', () => {
      document.getElementById('alloc_704b_help').innerHTML = SEC704B_HELP[methodSel.value];
      // Toggle DRO group visibility
      document.getElementById('dro_group').style.display = methodSel.value === 'see_dro' ? 'block' : 'none';
      if (methodSel.value === 'see_dro') renderDROCheckboxes();
      recomputeAll();
    });
  }

  // 704(c) presence toggle
  const presenceSel = document.getElementById('alloc_704c_present');
  if (presenceSel) {
    presenceSel.addEventListener('change', () => {
      document.getElementById('sec704c_layers_wrap').style.display = presenceSel.value === 'yes' ? 'block' : 'none';
      recomputeAll();
    });
  }

  // Add 704(c) layer
  const addBtn = document.getElementById('add_704c_layer');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      addSec704cLayerData({
        id: DB.nextLayerId++,
        contributor: DB.memberClasses[0]?.name || 'Contributor',
        contributorId: DB.memberClasses[0]?.id || 0,
        bookValue: 0,
        taxBasis: 0,
        assetClass: 'building',
        depLifeBook: 39,
        depLifeTax: 39
      });
      renderSec704cLayers();
      recomputeAll();
    });
  }

  // Cost seg pickup toggle
  const costSegCB = document.getElementById('alloc_cost_seg_pickup');
  if (costSegCB) {
    costSegCB.addEventListener('change', () => {
      document.getElementById('cost_seg_alloc_group').style.display = costSegCB.checked ? 'grid' : 'none';
      recomputeAll();
    });
  }

  // All allocation inputs trigger recompute
  ['alloc_capacct_maintenance', 'alloc_min_gain_chargeback', 'alloc_704c_parallel',
   'alloc_704c_method', 'alloc_754_election', 'alloc_anticipated_transfer',
   'alloc_1245_recapture', 'alloc_1250_unrecaptured', 'alloc_nonrecourse_deduction',
   'cost_seg_pct', 'cost_seg_allocation_target'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => { /* deferred to recompute on results tab */ });
      el.addEventListener('change', () => { /* deferred */ });
    }
  });
}

function renderDROCheckboxes() {
  const target = document.getElementById('dro_class_checkboxes');
  if (!target) return;
  let html = '';
  for (const cls of DB.memberClasses) {
    html += `<label class="db-checkbox">
      <input type="checkbox" class="dro-checkbox" data-id="${cls.id}" />
      ${escapeHtml(cls.name)} <span class="db-help-inline">${cls.classType === 'sponsor' ? 'Sponsor — DRO common' : cls.classType === 'lp_guarantor' ? 'Guarantor LP — DRO common' : 'Cash LP — DRO uncommon'}</span>
    </label>`;
  }
  target.innerHTML = html;
}

// =============================================================================
// §704(c) LAYER MANAGEMENT
// =============================================================================
function addSec704cLayerData(d) {
  DB.sec704cLayers.push(d);
}

function removeSec704cLayer(id) {
  DB.sec704cLayers = DB.sec704cLayers.filter(l => l.id !== id);
  renderSec704cLayers();
  recomputeAll();
}

function renderSec704cLayers() {
  const container = document.getElementById('sec704c_layers_container');
  if (!container) return;
  container.innerHTML = '';
  if (DB.sec704cLayers.length === 0) {
    container.innerHTML = '<p class="db-help-block" style="margin:0 0 1rem 0;">No &sect;&nbsp;704(c) layers configured. Click below to add a contribution event with built-in gain or loss.</p>';
    return;
  }

  // Build contributor dropdown options
  const contribOpts = DB.memberClasses.map(c => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  DB.sec704cLayers.forEach((layer, idx) => {
    const builtIn = layer.bookValue - layer.taxBasis;
    const builtInLabel = builtIn >= 0 ? `Built-in Gain: ${fmt$(builtIn)}` : `Built-in Loss: ${fmt$(-builtIn)}`;
    const builtInClass = builtIn >= 0 ? 'gain' : 'loss';
    const card = document.createElement('div');
    card.className = 'sec704c-layer-card';
    card.innerHTML = `
      <div class="layer-header">
        <span class="layer-badge">LAYER ${idx + 1}</span>
        <button class="mc-remove" type="button" data-id="${layer.id}">Remove</button>
      </div>
      <div class="layer-fields">
        <div class="mc-field-mini">
          <label>Contributing Member</label>
          <select data-id="${layer.id}" data-field="contributorId">
            ${contribOpts}
          </select>
        </div>
        <div class="mc-field-mini">
          <label>Book Value ($)</label>
          <input type="number" value="${layer.bookValue}" data-id="${layer.id}" data-field="bookValue" min="0" step="10000" />
        </div>
        <div class="mc-field-mini">
          <label>Tax Basis ($)</label>
          <input type="number" value="${layer.taxBasis}" data-id="${layer.id}" data-field="taxBasis" min="0" step="10000" />
        </div>
        <div class="mc-field-mini">
          <label>Asset Class</label>
          <select data-id="${layer.id}" data-field="assetClass">
            <option value="land" ${layer.assetClass === 'land' ? 'selected' : ''}>Land (non-depreciable)</option>
            <option value="building" ${layer.assetClass === 'building' ? 'selected' : ''}>Building (39 yr / 27.5 yr)</option>
            <option value="land_improvements" ${layer.assetClass === 'land_improvements' ? 'selected' : ''}>Land Improvements (15 yr)</option>
            <option value="personalty" ${layer.assetClass === 'personalty' ? 'selected' : ''}>5/7 yr Personalty</option>
          </select>
        </div>
        <div class="mc-field-mini">
          <label>Depreciation Life (yrs)</label>
          <input type="number" value="${layer.depLifeBook}" data-id="${layer.id}" data-field="depLifeBook" min="0" max="50" step="0.5" />
        </div>
      </div>
      <div class="layer-built-in">${builtInLabel}</div>
    `;
    container.appendChild(card);

    // Set selected contributor
    const contributorSelect = card.querySelector(`select[data-field="contributorId"]`);
    if (contributorSelect) contributorSelect.value = layer.contributorId;
  });

  container.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('input', e => updateSec704cLayerField(e));
    el.addEventListener('change', e => updateSec704cLayerField(e));
  });
  container.querySelectorAll('.mc-remove').forEach(b => {
    b.addEventListener('click', e => {
      const id = parseInt(e.target.dataset.id, 10);
      removeSec704cLayer(id);
    });
  });
}

function updateSec704cLayerField(e) {
  const id = parseInt(e.target.dataset.id, 10);
  const field = e.target.dataset.field;
  const layer = DB.sec704cLayers.find(l => l.id === id);
  if (!layer) return;
  if (e.target.type === 'number' || e.target.classList.contains('db-fmt-currency') || e.target.classList.contains('db-fmt-percent')) layer[field] = parseFloat(String(e.target.value).replace(/[\$,\s%]/g, '')) || 0;
  else if (field === 'contributorId') {
    layer.contributorId = parseInt(e.target.value, 10);
    const c = DB.memberClasses.find(m => m.id === layer.contributorId);
    if (c) layer.contributor = c.name;
  } else if (field === 'assetClass') {
    layer.assetClass = e.target.value;
    // Auto-set depreciation life
    if (layer.assetClass === 'land') layer.depLifeBook = layer.depLifeTax = 0;
    else if (layer.assetClass === 'building') layer.depLifeBook = layer.depLifeTax = 39;
    else if (layer.assetClass === 'land_improvements') layer.depLifeBook = layer.depLifeTax = 15;
    else if (layer.assetClass === 'personalty') layer.depLifeBook = layer.depLifeTax = 7;
    renderSec704cLayers(); // re-render to reflect new dep life
  } else {
    layer[field] = e.target.value;
  }
  // Re-render the built-in label
  if (field === 'bookValue' || field === 'taxBasis') {
    const builtIn = layer.bookValue - layer.taxBasis;
    const builtInLabel = builtIn >= 0 ? `Built-in Gain: ${fmt$(builtIn)}` : `Built-in Loss: ${fmt$(-builtIn)}`;
    const card = e.target.closest('.sec704c-layer-card');
    if (card) card.querySelector('.layer-built-in').textContent = builtInLabel;
  }
}

// =============================================================================
// COLLECT ALLOCATION DATA (extends collectFormData)
// =============================================================================
function collectAllocationData() {
  const v = id => { const el = document.getElementById(id); if (!el) return ''; return String(el.value).replace(/[$,\s%]/g, '').trim(); };
  const c = id => { const el = document.getElementById(id); return el ? el.checked : false; };
  const n = id => parseFloat(v(id)) || 0;

  const droClasses = [];
  document.querySelectorAll('.dro-checkbox').forEach(cb => {
    if (cb.checked) droClasses.push(parseInt(cb.dataset.id, 10));
  });

  return {
    method704b: v('alloc_704b_method') || 'targeted',
    capAcctMaintenance: v('alloc_capacct_maintenance') || 'full',
    minGainChargeback: v('alloc_min_gain_chargeback') || 'full',
    droClasses,
    sec704cPresent: v('alloc_704c_present') === 'yes',
    sec704cLayers: DB.sec704cLayers.map(l => ({...l})),
    sec704cParallel: v('alloc_704c_parallel') === 'yes',
    sec704cMethod: v('alloc_704c_method') || 'remedial',
    sec754Election: v('alloc_754_election') === 'yes',
    anticipatedTransfer: v('alloc_anticipated_transfer') === 'yes',
    sec1245Recapture: c('alloc_1245_recapture'),
    sec1250Unrecaptured: c('alloc_1250_unrecaptured'),
    costSegPickup: c('alloc_cost_seg_pickup'),
    costSegPct: n('cost_seg_pct'),
    costSegTarget: v('cost_seg_allocation_target') || 'pro_rata',
    nonrecourseDeduction: c('alloc_nonrecourse_deduction')
  };
}

// =============================================================================
// §704(c) CALCULATION ENGINE — Three Methods Run in Parallel
// =============================================================================
//
// Mechanics summary:
//
// For each contributed property with book value B and tax basis T:
//   Built-in gain (BIG) = B - T   (or loss if negative)
//   Book depreciation = B / life_book
//   Tax depreciation  = T / life_tax  (or remedial-modified life)
//
// Partner shares of book depreciation: each partner's share of book dep is
// determined by partnership profit-sharing ratios.
//
// Partner shares of tax depreciation are computed differently per method:
//
// TRADITIONAL (Reg §1.704-3(b)):
//   Non-contributing partners receive tax dep equal to their book dep share,
//   UP TO the partnership's total tax dep (the "ceiling rule"). Contributing
//   partner receives whatever tax dep remains. If non-contributors' aggregate
//   book share exceeds total tax dep, a SHORTFALL occurs — the difference
//   stays with the contributor as built-in gain.
//
// CURATIVE (Reg §1.704-3(c)):
//   Same as Traditional, but the ceiling-rule shortfall is fixed by allocating
//   other items (other partnership income/gain to contributor, or other
//   deductions to non-contributors) to "cure" the imbalance.
//
// REMEDIAL (Reg §1.704-3(d)):
//   Notional tax items are created to fix the ceiling-rule shortfall.
//   Remedial dep allocated to non-contributors; offsetting income to contributor.
//   Special depreciation rule: the BIG portion is depreciated using the SAME
//   recovery period as the partnership's tax dep but treated as newly placed
//   in service (so remedial dep is over the full remaining life).
// =============================================================================
function calculate704cMethod(layer, method, years, lpProfitShare) {
  // lpProfitShare is the aggregate book-share of non-contributing partners
  // (approximated as 1 - contributor's share for Phase 2)

  const builtIn = layer.bookValue - layer.taxBasis;
  if (builtIn === 0 || layer.assetClass === 'land') {
    return {
      method,
      builtIn,
      ceilingRuleShortfall: 0,
      ceilingRuleShortfallTotal: 0,
      curativeAllocations: 0,
      remedialAllocations: 0,
      bookDepTotal: 0,
      taxDepTotal: 0,
      taxDepToContributor: 0,
      taxDepToNonContrib: 0,
      remainingBIG: builtIn
    };
  }

  const life = layer.depLifeBook || 39;
  const yearsForCalc = Math.min(years, life);

  // Annual book dep on book value
  const bookDepAnnual = layer.bookValue / life;
  const bookDepTotal = bookDepAnnual * yearsForCalc;

  // Annual tax dep on tax basis
  const taxDepAnnual = layer.taxBasis / life;
  const taxDepTotal = taxDepAnnual * yearsForCalc;

  // Non-contributors' book share
  const nonContribBookShare = bookDepTotal * lpProfitShare;
  const contribBookShare = bookDepTotal * (1 - lpProfitShare);

  // CEILING RULE: non-contributors get tax dep up to lesser of book share or total tax dep
  let nonContribTaxShare, contribTaxShare, shortfall = 0;

  if (method === 'traditional') {
    if (taxDepTotal >= nonContribBookShare) {
      // No ceiling rule issue
      nonContribTaxShare = nonContribBookShare;
      contribTaxShare = taxDepTotal - nonContribTaxShare;
    } else {
      // Ceiling rule binds
      nonContribTaxShare = taxDepTotal;
      contribTaxShare = 0;
      shortfall = nonContribBookShare - taxDepTotal;
    }
    return {
      method, builtIn, bookDepTotal, taxDepTotal,
      taxDepToContributor: contribTaxShare,
      taxDepToNonContrib: nonContribTaxShare,
      ceilingRuleShortfall: shortfall,
      ceilingRuleShortfallTotal: shortfall,
      curativeAllocations: 0,
      remedialAllocations: 0,
      remainingBIG: builtIn - (nonContribBookShare * (1 - 1) + contribBookShare)
    };
  }

  if (method === 'curative') {
    // Same as traditional, but ceiling-rule shortfall cured by reallocation
    // of OTHER income/deductions. We assume sufficient other items exist
    // (this is generally true for operating real estate partnerships).
    if (taxDepTotal >= nonContribBookShare) {
      nonContribTaxShare = nonContribBookShare;
      contribTaxShare = taxDepTotal - nonContribTaxShare;
      shortfall = 0;
    } else {
      nonContribTaxShare = taxDepTotal; // initial allocation
      contribTaxShare = 0;
      shortfall = nonContribBookShare - taxDepTotal; // cured via reallocation
    }
    return {
      method, builtIn, bookDepTotal, taxDepTotal,
      taxDepToContributor: contribTaxShare,
      taxDepToNonContrib: nonContribTaxShare,
      ceilingRuleShortfall: shortfall,
      ceilingRuleShortfallTotal: 0, // cured
      curativeAllocations: shortfall, // amount of other items reallocated
      remedialAllocations: 0,
      remainingBIG: builtIn
    };
  }

  if (method === 'remedial') {
    // Remedial: same ceiling-rule analysis, but shortfall is fixed by
    // creating notional items. Remedial dep allocated to non-contributor;
    // offsetting income to contributor. Both notional; net zero to partnership.
    if (taxDepTotal >= nonContribBookShare) {
      nonContribTaxShare = nonContribBookShare;
      contribTaxShare = taxDepTotal - nonContribTaxShare;
      shortfall = 0;
    } else {
      nonContribTaxShare = taxDepTotal;
      contribTaxShare = 0;
      shortfall = nonContribBookShare - taxDepTotal;
    }
    // Remedial allocations: shortfall amount of notional dep to non-contributor
    // and offsetting notional income to contributor
    return {
      method, builtIn, bookDepTotal, taxDepTotal,
      taxDepToContributor: contribTaxShare,
      taxDepToNonContrib: nonContribTaxShare,
      ceilingRuleShortfall: shortfall,
      ceilingRuleShortfallTotal: 0, // remedied
      curativeAllocations: 0,
      remedialAllocations: shortfall,
      remainingBIG: builtIn
    };
  }
}

// Compute aggregate §704(c) result across all layers, for all three methods
function calculate704cAggregate(data, allocData, years) {
  const lpClasses = data.memberClasses.filter(c => c.classType !== 'sponsor');
  const totalLPCap = lpClasses.reduce((s, c) => s + c.capital, 0);
  const sponsorClass = data.memberClasses.find(c => c.classType === 'sponsor');

  // Approximate LP aggregate profit share as LP capital / total capital
  const totalCap = data.memberClasses.reduce((s, c) => s + c.capital, 0);
  const lpProfitShare = totalCap > 0 ? totalLPCap / totalCap : 1;

  const results = {
    traditional: { layers: [], totalShortfall: 0, totalCurative: 0, totalRemedial: 0 },
    curative: { layers: [], totalShortfall: 0, totalCurative: 0, totalRemedial: 0 },
    remedial: { layers: [], totalShortfall: 0, totalCurative: 0, totalRemedial: 0 }
  };

  if (!allocData.sec704cPresent || allocData.sec704cLayers.length === 0) {
    return results;
  }

  for (const layer of allocData.sec704cLayers) {
    // Contributor isn't strictly LP or sponsor — but for §704(c), we assume
    // the non-contributing partners' share is the complement of contributor's share
    const contributor = data.memberClasses.find(c => c.id === layer.contributorId);
    const contributorCap = contributor ? contributor.capital : 0;
    const adjLpShare = totalCap > 0 ? (totalCap - contributorCap) / totalCap : 1;

    for (const method of ['traditional', 'curative', 'remedial']) {
      const r = calculate704cMethod(layer, method, years, adjLpShare);
      r.contributorName = contributor?.name || 'Unknown';
      results[method].layers.push(r);
      results[method].totalShortfall += r.ceilingRuleShortfallTotal;
      results[method].totalCurative += r.curativeAllocations;
      results[method].totalRemedial += r.remedialAllocations;
    }
  }
  return results;
}

// =============================================================================
// CAPITAL ACCOUNT ROLL-FORWARD
// =============================================================================
// Computes opening / cumulative allocations / distributions / closing capital
// account for each member class.
//
// For Phase 2, three snapshots:
//   - Opening: post-contribution capital
//   - Cumulative allocations: book income/loss through hold period
//   - Distributions: per the waterfall
//   - Closing: opening + allocations - distributions
//
// Outside basis = book capital + share of partnership debt (under §752)
// =============================================================================
function calculateCapitalAccountRollForward(data, results, allocData) {
  const rows = [];

  // Compute total bookable income/loss from operating cash + sale
  // Phase 2 approximation: total book income = total distributions - total contributions
  // (cash basis for simplicity; tax basis adjustments tracked separately)

  // §752 debt allocation
  // Phase 2: distribute nonrecourse debt under Reg §1.752-3 third tier (profit ratios)
  // and recourse debt to guarantors (if any)
  const totalDebt = data.seniorLoan + data.memberDebt.reduce((s, d) => s + d.amount, 0);
  const totalCap = data.memberClasses.reduce((s, c) => s + c.capital, 0);

  // Recourse debt allocation: if classified as recourse, all to guarantor classes
  const guarantorClasses = data.memberClasses.filter(c => c.classType === 'lp_guarantor' || c.classType === 'sponsor');
  const guarantorCap = guarantorClasses.reduce((s, c) => s + c.capital, 0);

  for (const cls of data.memberClasses) {
    const classReturn = results.classReturns.find(r => r.class.id === cls.id);
    const distribution = classReturn?.distribution || 0;

    // Opening capital account = capital contributed
    const opening = cls.capital;

    // Book income allocation = distribution - capital + ... (driven by waterfall)
    // For targeted method, this matches the waterfall output
    // For SEE method, would compute pro rata to capital then layer on special allocations
    const cumulativeAllocations = distribution - cls.capital;

    // Closing = opening + cumulative - distributions (zero out since liquidating)
    const closing = opening + cumulativeAllocations - distribution; // = 0 if liquidating

    // Outside basis (§752):
    // Debt share depends on classification
    let debtShare = 0;
    if (data.senior752 === 'recourse' && guarantorCap > 0 && (cls.classType === 'lp_guarantor' || cls.classType === 'sponsor')) {
      debtShare = data.seniorLoan * (cls.capital / guarantorCap);
    } else if (data.senior752 === 'nonrecourse' || data.senior752 === 'qnrf' || data.senior752 === 'partner_nonrecourse') {
      // Nonrecourse: allocated under profit ratios
      debtShare = totalCap > 0 ? data.seniorLoan * (cls.capital / totalCap) : 0;
    }
    // Member debt: similar treatment, summed
    for (const md of data.memberDebt) {
      if (md.term752 === 'recourse' && guarantorCap > 0 && (cls.classType === 'lp_guarantor' || cls.classType === 'sponsor')) {
        debtShare += md.amount * (cls.capital / guarantorCap);
      } else {
        debtShare += totalCap > 0 ? md.amount * (cls.capital / totalCap) : 0;
      }
    }

    const outsideBasis = opening + cumulativeAllocations + debtShare;

    rows.push({
      class: cls,
      opening,
      cumulativeAllocations,
      distributions: distribution,
      closing,
      outsideBasis,
      debtShare
    });
  }

  return rows;
}

// =============================================================================
// §754 / §743(b) / §734(b) ANALYSIS
// =============================================================================
function analyze754(data, results, allocData, rollForward) {
  const notes = [];

  const lpClasses = data.memberClasses.filter(c => c.classType !== 'sponsor');
  const totalLPCap = lpClasses.reduce((s, c) => s + c.capital, 0);
  const totalAssets = results.totalProjectCost;

  if (allocData.sec754Election) {
    notes.push({
      type: '734',
      text: 'The partnership has elected under &sect;&nbsp;754. This election is permanent and applies to all subsequent transfers and distributions until revoked with Commissioner consent under Reg.&nbsp;&sect;&nbsp;1.754-1(c). All transferees will receive a &sect;&nbsp;743(b) basis adjustment; all distributions will trigger &sect;&nbsp;734(b) analysis.'
    });
  } else {
    notes.push({
      type: 'info',
      text: 'No &sect;&nbsp;754 election in effect. Mandatory adjustments may still apply: &sect;&nbsp;743(b) is mandatory on any transfer if there is a substantial built-in loss (excess of partnership&rsquo;s adjusted basis over fair market value greater than $250,000); &sect;&nbsp;734(b) is mandatory on a distribution that causes a substantial built-in loss in remaining partnership property.'
    });
  }

  // Check for substantial built-in loss
  // Partnership AB > FMV by more than $250K = mandatory adjustment
  // Phase 2 approximation: compare total project cost to inferred FMV at midpoint
  // For development deals, generally not an issue at formation
  const inferredFMV = data.exitPrice / Math.pow(1 + 0.06, results.years); // crude midpoint
  const substantialBIL = totalAssets - inferredFMV > 250000;
  if (substantialBIL) {
    notes.push({
      type: 'warn',
      text: `Potential substantial built-in loss: partnership&rsquo;s adjusted basis (${fmt$(totalAssets)}) exceeds approximate FMV (${fmt$(inferredFMV)}) by more than $250,000. If a transfer occurs, &sect;&nbsp;743(b) basis adjustment will be MANDATORY regardless of &sect;&nbsp;754 election status. Engage Donovan Legal to confirm the calculation and document.`
    });
  }

  if (allocData.anticipatedTransfer && allocData.sec754Election) {
    // Compute a hypothetical §743(b) adjustment for a transferee acquiring an LP interest
    // §743(b) adjustment = transferee's outside basis - share of partnership's inside basis in property
    if (totalLPCap > 0 && lpClasses.length > 0) {
      const sampleLP = lpClasses[0];
      const sampleShare = sampleLP.capital / totalLPCap;
      const insideShare = sampleShare * totalAssets;
      const hypotheticalPurchasePrice = sampleLP.capital * 1.2; // 20% premium
      const adj = hypotheticalPurchasePrice - insideShare;
      notes.push({
        type: '743',
        text: `Anticipated transfer analysis: if a transferee acquired a ${(sampleShare * 100).toFixed(1)}% LP interest in ${escapeHtml(sampleLP.name)} for ${fmt$(hypotheticalPurchasePrice)} (assumed 20% above capital contribution), the transferee&rsquo;s &sect;&nbsp;743(b) basis adjustment would be approximately ${fmt$(adj)}. This adjustment is allocated under Reg.&nbsp;&sect;&nbsp;1.755-1 between &sect;&nbsp;1245 and &sect;&nbsp;1250 property in accordance with the residual method.`
      });
    }
  }

  // §704(c) interaction
  if (allocData.sec704cPresent && allocData.sec704cLayers.length > 0) {
    notes.push({
      type: 'tax',
      text: `Active &sect;&nbsp;704(c) layers (${allocData.sec704cLayers.length}): a &sect;&nbsp;754 election interacts with &sect;&nbsp;704(c) under Reg.&nbsp;&sect;&nbsp;1.743-1(j) and Reg.&nbsp;&sect;&nbsp;1.755-1. The &sect;&nbsp;743(b) adjustment to a transferee&rsquo;s share of contributed property is computed taking into account the remaining built-in gain in that property allocable to the contributing partner. Coordinate carefully with the &sect;&nbsp;704(c) method selected.`
    });
  }

  return notes;
}

// =============================================================================
// EXTEND recomputeAll TO INCLUDE PHASE 2
// =============================================================================
const _originalRecomputeAll = recomputeAll;
recomputeAll = function() {
  const data = collectFormData();
  const allocData = collectAllocationData();
  const results = calculateDeal(data);
  results.sensitivity = calculateSensitivity(data);
  results.sec704c = calculate704cAggregate(data, allocData, results.years);
  results.rollForward = calculateCapitalAccountRollForward(data, results, allocData);
  results.sec754Analysis = analyze754(data, results, allocData, results.rollForward);
  results.allocData = allocData;
  DB.lastResults = results;

  updateCapitalStackSummary();
  updateBudgetSummary(results);
  renderResults(results);
  renderSec704cComparison(results);
  renderCapitalAccountRollForward(results);
  renderSec754Analysis(results);
};

// =============================================================================
// RENDER §704(c) COMPARISON
// =============================================================================
function renderSec704cComparison(results) {
  const target = document.getElementById('sec704c_comparison_wrap');
  if (!target) return;

  if (!results.allocData.sec704cPresent || results.allocData.sec704cLayers.length === 0) {
    target.innerHTML = '<p class="db-help-block" style="margin:0;">No &sect;&nbsp;704(c) layers configured. To compare allocation methods, enable &sect;&nbsp;704(c) in Step 6 and add at least one contribution layer with built-in gain or loss.</p>';
    return;
  }

  const r = results.sec704c;
  const totalBIG = results.allocData.sec704cLayers.reduce((s, l) => s + (l.bookValue - l.taxBasis), 0);

  // Pick recommendation: remedial generally preferred for fairness, but flag scenarios
  let recommended = 'remedial';
  if (r.traditional.totalShortfall === 0) recommended = 'traditional'; // no ceiling rule issue
  const selectedMethod = results.allocData.sec704cMethod;

  let html = `<div class="db-help-block" style="margin-bottom:1.25rem;">
    <strong>Total Built-In Gain Across Layers:</strong> ${fmt$(totalBIG)}.
    Comparison of how each &sect;&nbsp;704(c) method handles the built-in gain allocation over a ${results.years.toFixed(1)}-year hold.
  </div>`;

  html += '<div class="method-comparison">';

  for (const method of ['traditional', 'curative', 'remedial']) {
    const m = r[method];
    const cardClass = method === recommended ? 'recommended' : '';
    let cite = '';
    let methodLabel = '';
    if (method === 'traditional') {
      cite = 'Reg. § 1.704-3(b)'; methodLabel = 'Traditional';
    } else if (method === 'curative') {
      cite = 'Reg. § 1.704-3(c)'; methodLabel = 'Curative';
    } else {
      cite = 'Reg. § 1.704-3(d)'; methodLabel = 'Remedial';
    }

    const totalTaxDepContrib = m.layers.reduce((s, l) => s + l.taxDepToContributor, 0);
    const totalTaxDepNonContrib = m.layers.reduce((s, l) => s + l.taxDepToNonContrib, 0);

    let note = '';
    if (method === 'traditional') {
      if (m.totalShortfall > 0) {
        note = `Ceiling rule creates a ${fmt$(m.totalShortfall)} shortfall — non-contributors receive less tax depreciation than their book share entitles them to. This shortfall persists until property is sold or the contributor's gain is recognized. Generally inequitable when book/tax disparity is substantial.`;
      } else {
        note = 'No ceiling rule issue. Traditional method works cleanly when tax basis is sufficient to support non-contributors\' book share of depreciation.';
      }
    } else if (method === 'curative') {
      if (m.totalCurative > 0) {
        note = `${fmt$(m.totalCurative)} of other partnership items (e.g., operating income, gain on other property) reallocated to fix ceiling-rule shortfall. Curative allocations must be reasonable in amount and character (Reg. § 1.704-3(c)(3)(iii)).`;
      } else {
        note = 'No curative needed. Same outcome as Traditional in this scenario.';
      }
    } else {
      if (m.totalRemedial > 0) {
        note = `${fmt$(m.totalRemedial)} of notional remedial allocations created — additional tax depreciation to non-contributors, offsetting notional income to contributor. Net zero to partnership; equitable allocation achieved without finding other items.`;
      } else {
        note = 'No remedial allocations needed. Same outcome as Traditional in this scenario.';
      }
    }

    html += `<div class="method-card ${method} ${cardClass}">
      ${method === recommended ? '<span class="recommended-flag">Recommended</span>' : ''}
      ${selectedMethod === method && !results.allocData.sec704cParallel ? '<span class="recommended-flag" style="background:#C9A961;color:#1a1a1a;">Selected</span>' : ''}
      <div class="method-name">${methodLabel}</div>
      <div class="method-cite">${cite}</div>
      <div class="method-stat">
        <div class="method-stat-label">Tax Depreciation to Contributor</div>
        <div class="method-stat-value">${fmt$(totalTaxDepContrib)}</div>
      </div>
      <div class="method-stat">
        <div class="method-stat-label">Tax Depreciation to Non-Contributors</div>
        <div class="method-stat-value">${fmt$(totalTaxDepNonContrib)}</div>
      </div>
      <div class="method-stat">
        <div class="method-stat-label">Ceiling Rule Shortfall</div>
        <div class="method-stat-value ${m.totalShortfall > 0 ? 'warn' : 'good'}">${fmt$(m.totalShortfall)}</div>
      </div>
      ${method === 'curative' ? `<div class="method-stat">
        <div class="method-stat-label">Curative Allocations Used</div>
        <div class="method-stat-value">${fmt$(m.totalCurative)}</div>
      </div>` : ''}
      ${method === 'remedial' ? `<div class="method-stat">
        <div class="method-stat-label">Remedial Allocations Created</div>
        <div class="method-stat-value">${fmt$(m.totalRemedial)}</div>
      </div>` : ''}
      <div class="method-note">${note}</div>
    </div>`;
  }

  html += '</div>';
  target.innerHTML = html;
}

// =============================================================================
// RENDER CAPITAL ACCOUNT ROLL-FORWARD
// =============================================================================
function renderCapitalAccountRollForward(results) {
  const body = document.getElementById('capital_account_body');
  if (!body) return;
  let html = '';
  for (const row of results.rollForward) {
    const cls = row.class;
    const badge = cls.classType === 'sponsor' ? '<span style="color:#C9A961;font-weight:700;font-size:0.7rem;">GP</span> ' :
                  cls.classType === 'lp_guarantor' ? '<span style="color:#8b3a3a;font-weight:700;font-size:0.7rem;">A-2</span> ' :
                  '<span style="color:#169B62;font-weight:700;font-size:0.7rem;">LP</span> ';
    html += `<tr>
      <td>${badge}${escapeHtml(cls.name)}</td>
      <td class="right">${fmt$(row.opening)}</td>
      <td class="right">${(row.cumulativeAllocations >= 0 ? '+' : '') + fmt$(row.cumulativeAllocations)}</td>
      <td class="right">(${fmt$(row.distributions)})</td>
      <td class="right">${fmt$(row.closing)}</td>
      <td class="right">${fmt$(row.outsideBasis)}</td>
    </tr>`;
  }
  body.innerHTML = html;
}

// =============================================================================
// RENDER §754 ANALYSIS
// =============================================================================
function renderSec754Analysis(results) {
  const target = document.getElementById('sec754_analysis');
  if (!target) return;
  let html = '';
  for (const n of results.sec754Analysis) {
    html += `<div class="note-item note-${n.type}">${n.text}</div>`;
  }
  target.innerHTML = html;
}

// =============================================================================
// EXTEND SAVE/LOAD JSON FOR PHASE 2
// =============================================================================
const _originalSaveJSON = saveJSON;
saveJSON = function() {
  // Build the same payload as Phase 1 but extend with Phase 2 state
  const data = collectFormData();
  const allocData = collectAllocationData();

  const payload = {
    version: 'phase-2',
    savedAt: new Date().toISOString(),
    state: {
      memberClasses: DB.memberClasses,
      memberDebt: DB.memberDebt,
      promoteTiers: DB.promoteTiers,
      sec704cLayers: DB.sec704cLayers,
      nextMemberId: DB.nextMemberId,
      nextDebtId: DB.nextDebtId,
      nextTierId: DB.nextTierId,
      nextLayerId: DB.nextLayerId
    },
    formInputs: collectFormInputsForSave(),
    allocationInputs: {
      alloc_704b_method: document.getElementById('alloc_704b_method')?.value,
      alloc_capacct_maintenance: document.getElementById('alloc_capacct_maintenance')?.value,
      alloc_min_gain_chargeback: document.getElementById('alloc_min_gain_chargeback')?.value,
      alloc_704c_present: document.getElementById('alloc_704c_present')?.value,
      alloc_704c_parallel: document.getElementById('alloc_704c_parallel')?.value,
      alloc_704c_method: document.getElementById('alloc_704c_method')?.value,
      alloc_754_election: document.getElementById('alloc_754_election')?.value,
      alloc_anticipated_transfer: document.getElementById('alloc_anticipated_transfer')?.value,
      cost_seg_pct: document.getElementById('cost_seg_pct')?.value,
      cost_seg_allocation_target: document.getElementById('cost_seg_allocation_target')?.value,
      checkboxes: {
        alloc_1245_recapture: document.getElementById('alloc_1245_recapture')?.checked,
        alloc_1250_unrecaptured: document.getElementById('alloc_1250_unrecaptured')?.checked,
        alloc_cost_seg_pickup: document.getElementById('alloc_cost_seg_pickup')?.checked,
        alloc_nonrecourse_deduction: document.getElementById('alloc_nonrecourse_deduction')?.checked
      },
      droClasses: Array.from(document.querySelectorAll('.dro-checkbox')).filter(cb => cb.checked).map(cb => parseInt(cb.dataset.id, 10))
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (data.projectName || 'deal').replace(/[^a-zA-Z0-9-_]/g, '_');
  a.href = url;
  a.download = `${name}-deal-builder-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

function collectFormInputsForSave() {
  const inputIds = [
    'deal_type','jurisdiction','project_name','property_location',
    'management_structure','major_vote_threshold',
    'senior_loan','senior_loan_type','senior_rate','senior_avg_balance','senior_752_class',
    'budget_land','budget_building','budget_hard','budget_contingency',
    'budget_soft','budget_dev_fees','budget_interest','budget_tax_ins',
    'budget_marketing','budget_other',
    'hold_months','exit_price',
    'disp_commission','disp_stamps','disp_other',
    'waterfall_style','hurdle_basis','pref_rate','pref_type','pref_priority','roc_order',
    'catchup_style','catchup_target','clawback_type','clawback_threshold','clawback_basis',
    'fee_acquisition','fee_development','fee_cm','fee_disposition','fee_asset_mgmt','fee_other',
    'property_state','member_fed_rate','member_niit','member_ltcg_rate','member_1250_rate'
  ];
  const result = { checkboxes: {} };
  inputIds.forEach(id => { const el = document.getElementById(id); if (el) result[id] = el.value; });
  ['md_sale','md_refinance','md_budget','md_admit','md_amend','md_dissolve','md_affiliate','md_capital_call',
   'provision_rofr','provision_rofo','provision_tag','provision_drag','provision_buysell','provision_putcall','provision_clawback','provision_keyman',
   'overlay_dealer','overlay_bonus','overlay_cost_seg','overlay_163j','overlay_461l','overlay_199a','overlay_dlts'].forEach(id => {
    const el = document.getElementById(id);
    if (el) result.checkboxes[id] = el.checked;
  });
  return result;
}

// Extend loadJSON to restore Phase 2 state
const _originalLoadJSON = loadJSON;
loadJSON = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const payload = JSON.parse(e.target.result);
      DB.memberClasses = payload.state.memberClasses || [];
      DB.memberDebt = payload.state.memberDebt || [];
      DB.promoteTiers = payload.state.promoteTiers || [];
      DB.sec704cLayers = payload.state.sec704cLayers || [];
      DB.nextMemberId = payload.state.nextMemberId || DB.memberClasses.length + 1;
      DB.nextDebtId = payload.state.nextDebtId || DB.memberDebt.length + 1;
      DB.nextTierId = payload.state.nextTierId || DB.promoteTiers.length + 1;
      DB.nextLayerId = payload.state.nextLayerId || DB.sec704cLayers.length + 1;

      // Restore Phase 1 form inputs
      for (const [id, val] of Object.entries(payload.formInputs || {})) {
        if (id === 'checkboxes') continue;
        const el = document.getElementById(id);
        if (el) el.value = val;
      }
      if (payload.formInputs?.checkboxes) {
        for (const [id, val] of Object.entries(payload.formInputs.checkboxes)) {
          const el = document.getElementById(id);
          if (el) el.checked = val;
        }
      }

      // Restore Phase 2 allocation inputs
      if (payload.allocationInputs) {
        for (const [id, val] of Object.entries(payload.allocationInputs)) {
          if (id === 'checkboxes' || id === 'droClasses') continue;
          const el = document.getElementById(id);
          if (el) el.value = val;
        }
        if (payload.allocationInputs.checkboxes) {
          for (const [id, val] of Object.entries(payload.allocationInputs.checkboxes)) {
            const el = document.getElementById(id);
            if (el) el.checked = val;
          }
        }
      }

      // Re-render everything
      renderMemberClasses();
      renderMemberDebt();
      renderPromoteTiers();
      renderSec704cLayers();
      renderStateSummary();
      document.getElementById('deal_type_help').innerHTML = DEAL_TYPES[document.getElementById('deal_type').value]?.help || '';
      document.getElementById('jurisdiction_help').innerHTML = JURISDICTION_HELP[document.getElementById('jurisdiction').value] || '';
      document.getElementById('senior_752_help').innerHTML = SEC752_HELP[document.getElementById('senior_752_class').value] || '';
      document.getElementById('alloc_704b_help').innerHTML = SEC704B_HELP[document.getElementById('alloc_704b_method').value] || '';
      const cbType = document.getElementById('clawback_type').value;
      document.getElementById('clawback_threshold_group').style.display = cbType !== 'none' ? 'grid' : 'none';
      document.getElementById('sec704c_layers_wrap').style.display = document.getElementById('alloc_704c_present').value === 'yes' ? 'block' : 'none';
      document.getElementById('dro_group').style.display = document.getElementById('alloc_704b_method').value === 'see_dro' ? 'block' : 'none';
      document.getElementById('cost_seg_alloc_group').style.display = document.getElementById('alloc_cost_seg_pickup').checked ? 'grid' : 'none';

      recomputeAll();
      alert(`Deal loaded: ${payload.formInputs?.project_name || 'unnamed'} (version: ${payload.version}, saved ${payload.savedAt})`);
    } catch (err) {
      alert('Error loading file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

// Update the input event listener since loadJSON is reassigned
document.addEventListener('DOMContentLoaded', () => {
  const loadInput = document.getElementById('load_json_input');
  if (loadInput) {
    // Remove existing listener via cloning
    const newInput = loadInput.cloneNode(true);
    loadInput.parentNode.replaceChild(newInput, loadInput);
    newInput.addEventListener('change', loadJSON);
  }
});



// =============================================================================
// =============================================================================
//                  PHASE 3 — INVESTOR TAX PROFILES, BLOCKERS,
//                            FIRPTA, UBTI ANALYSIS
// =============================================================================
// =============================================================================

// Extend DB state with Phase 3 fields
DB.blockers = [];
DB.nextBlockerId = 1;
DB.investorProfiles = {}; // keyed by member class id

// =============================================================================
// TAX PROFILE TYPES — Tax treatment of each investor category
// =============================================================================
const TAX_PROFILES = {
  us_individual: {
    label: 'U.S. Individual',
    isUS: true, isForeign: false, isTaxExempt: false,
    description: 'U.S. citizen or resident individual. Pass-through income taxed at individual rates. NIIT may apply.'
  },
  us_corp: {
    label: 'U.S. Corporation (C-Corp)',
    isUS: true, isForeign: false, isTaxExempt: false,
    description: 'Domestic C-corporation. Pass-through income taxed at corporate rate (currently 21%); dividend tax on distributions to shareholders.'
  },
  us_s_corp: {
    label: 'U.S. S-Corporation',
    isUS: true, isForeign: false, isTaxExempt: false,
    description: 'Pass-through to S-corp shareholders. Single-class-of-stock rule and shareholder eligibility limits apply.'
  },
  us_taxexempt: {
    label: 'U.S. Tax-Exempt — §501(c)(3) Public Charity',
    isUS: true, isForeign: false, isTaxExempt: true,
    description: '§501(c)(3) public charity. UBTI on §514 unrelated debt-financed income unless qualified under §514(c)(9) and the fractions rule is satisfied. Trust UBTI taxed at trust rates; corporate UBTI at corporate rates.'
  },
  us_private_foundation: {
    label: 'U.S. Private Foundation',
    isUS: true, isForeign: false, isTaxExempt: true,
    description: '§501(c)(3) private foundation. Subject to UBTI (§514) AND excise tax on net investment income (§4940). Self-dealing rules under §4941. Generally NOT a qualified organization under §514(c)(9).'
  },
  us_pension: {
    label: 'U.S. Pension / Retirement Plan',
    isUS: true, isForeign: false, isTaxExempt: true,
    description: '§401(a) qualified plan, IRA, or similar. Generally qualifies under §514(c)(9) as a qualified organization. Fractions rule under §514(c)(9)(B)(vi) must be satisfied for partnership allocations.'
  },
  us_educational: {
    label: 'U.S. Educational Institution',
    isUS: true, isForeign: false, isTaxExempt: true,
    description: '§170(b)(1)(A)(ii) educational institution. Qualified organization under §514(c)(9) — exception from UBTI on debt-financed property if fractions rule is satisfied.'
  },
  foreign_individual: {
    label: 'Foreign Individual (Nonresident Alien)',
    isUS: false, isForeign: true, isTaxExempt: false,
    description: 'Nonresident alien. FIRPTA applies to U.S. real property interests. §1445 withholding at 15% of gross sales price. §1446(f) withholding on transfer of partnership interest. U.S. estate tax exposure under §2104 / §2107 — significant issue for direct ownership of U.S. real property.'
  },
  foreign_corp: {
    label: 'Foreign Corporation',
    isUS: false, isForeign: true, isTaxExempt: false,
    description: 'Non-U.S. corporation. Subject to FIRPTA, U.S. ECI taxation, and branch profits tax under §884 (30% on dividend-equivalent amount, subject to treaty reduction). Treaty benefits subject to LOB review.'
  },
  foreign_pension: {
    label: 'Foreign Pension Fund',
    isUS: false, isForeign: true, isTaxExempt: true,
    description: '§897(l) qualified foreign pension fund (post-PATH Act). If qualified, EXEMPT from FIRPTA on disposition of USRPIs. Reg. §1.897(l)-1 final regulations (June 2022) define qualification: organized under foreign law, established to provide retirement benefits, broad participation, no single beneficiary holding >5%, etc.'
  },
  foreign_government: {
    label: 'Foreign Government / Sovereign Wealth Fund',
    isUS: false, isForeign: true, isTaxExempt: true,
    description: '§892 generally exempts foreign governments from U.S. tax on certain investment income. EXCLUSION for commercial activity income (CAI) and income from a "controlled commercial entity" (CCE). Real estate operating activity typically creates CCE risk — REIT or corporate blocker often required to preserve §892 status.'
  },
  foreign_trust: {
    label: 'Foreign Trust',
    isUS: false, isForeign: true, isTaxExempt: false,
    description: 'Non-U.S. trust. Subject to FIRPTA. Reporting on Form 3520 and 3520-A for U.S. beneficiaries. Throwback rules under §665-668 for accumulated distributions.'
  }
};

// =============================================================================
// TREATY COUNTRIES (key withholding rates for blocker structures)
// Rates shown are for portfolio holders; qualified holders typically get lower
// =============================================================================
const TREATY_COUNTRIES = {
  none: { label: 'None / Non-Treaty', dividend: 0.30, interest: 0.30, royalty: 0.30, hasLOB: false },
  CAN: { label: 'Canada', dividend: 0.15, interest: 0.00, royalty: 0.10, hasLOB: true, qualifiedDividend: 0.05 },
  GBR: { label: 'United Kingdom', dividend: 0.15, interest: 0.00, royalty: 0.00, hasLOB: true, qualifiedDividend: 0.05 },
  NLD: { label: 'Netherlands', dividend: 0.15, interest: 0.00, royalty: 0.00, hasLOB: true, qualifiedDividend: 0.05 },
  LUX: { label: 'Luxembourg', dividend: 0.15, interest: 0.00, royalty: 0.00, hasLOB: true, qualifiedDividend: 0.05 },
  IRL: { label: 'Ireland', dividend: 0.15, interest: 0.00, royalty: 0.00, hasLOB: true, qualifiedDividend: 0.05 },
  DEU: { label: 'Germany', dividend: 0.15, interest: 0.00, royalty: 0.00, hasLOB: true, qualifiedDividend: 0.05 },
  FRA: { label: 'France', dividend: 0.15, interest: 0.00, royalty: 0.00, hasLOB: true, qualifiedDividend: 0.05 },
  JPN: { label: 'Japan', dividend: 0.10, interest: 0.10, royalty: 0.00, hasLOB: true, qualifiedDividend: 0.05 },
  CHE: { label: 'Switzerland', dividend: 0.15, interest: 0.00, royalty: 0.00, hasLOB: true, qualifiedDividend: 0.05 },
  AUS: { label: 'Australia', dividend: 0.15, interest: 0.10, royalty: 0.05, hasLOB: true, qualifiedDividend: 0.05 },
  ISR: { label: 'Israel', dividend: 0.25, interest: 0.175, royalty: 0.10, hasLOB: false },
  KOR: { label: 'South Korea', dividend: 0.15, interest: 0.12, royalty: 0.15, hasLOB: true },
  SGP: { label: 'Singapore — No Treaty', dividend: 0.30, interest: 0.30, royalty: 0.30, hasLOB: false },
  CHN: { label: 'China', dividend: 0.10, interest: 0.10, royalty: 0.10, hasLOB: false },
  IND: { label: 'India', dividend: 0.25, interest: 0.15, royalty: 0.15, hasLOB: false },
  BRA: { label: 'Brazil — No Treaty', dividend: 0.30, interest: 0.30, royalty: 0.30, hasLOB: false }
};

// =============================================================================
// BLOCKER TYPES
// =============================================================================
const BLOCKER_TYPES = {
  us_ccorp: {
    label: 'Domestic C-Corp Blocker',
    description: 'U.S. C-corporation interposed between investor(s) and SPV. Income taxed at corporate rate (21%) — converts UBTI to corporate-level income for tax-exempts; eliminates ECI filing obligation for foreign investors. Dividends to foreign shareholders subject to 30% withholding (treaty-reducible).',
    corpTaxRate: 0.21,
    eliminatesUBTI: true,
    eliminatesECI: true,
    leakageProfile: 'high'
  },
  foreign_corp: {
    label: 'Foreign Corporation Blocker (Cayman / BVI / Bermuda)',
    description: 'Offshore corporation. Avoids U.S. corp tax at the blocker level (no entity-level income). Foreign corporation is shareholder of SPV/REIT and bears U.S. tax on ECI and FIRPTA-source income, but eliminates filing/payment obligation for ultimate investors. Generally used for non-U.S. and tax-exempt investors who want one-degree separation from U.S. tax.',
    corpTaxRate: 0.21, // applied to ECI only
    eliminatesUBTI: true,
    eliminatesECI: false,
    leakageProfile: 'medium'
  },
  reit: {
    label: 'REIT Blocker',
    description: 'Captive private REIT interposed between investors and operating properties. REIT pays no entity-level tax if it distributes 90%+ of taxable income. Eliminates UBTI for tax-exempts (REIT dividends are not UBTI under §856). Reduces FIRPTA exposure if domestically-controlled. Subject to REIT compliance regime (Phase IV).',
    corpTaxRate: 0,
    eliminatesUBTI: true,
    eliminatesECI: false,
    leakageProfile: 'low'
  },
  double_blocker: {
    label: 'Double Blocker (Foreign Corp + Domestic Corp)',
    description: 'Foreign corporation owns a domestic C-corp blocker, which in turn owns the SPV interest. Foreign blocker is sole shareholder of the US blocker. Used to separate foreign investor from U.S. ECI and §1446(f) withholding while accepting the cost of the domestic blocker. Common in international fund structures.',
    corpTaxRate: 0.21,
    eliminatesUBTI: true,
    eliminatesECI: true,
    leakageProfile: 'high'
  },
  treaty_blocker: {
    label: 'Treaty Blocker (Netherlands / Luxembourg / Ireland)',
    description: 'Corporation organized in a treaty country with favorable dividend and interest withholding rates and a robust LOB clause. Used to reduce 30% U.S. withholding on dividends from the operating C-corp blocker. Subject to anti-conduit rules under Reg. §1.881-3 and substance requirements.',
    corpTaxRate: 0.21,
    eliminatesUBTI: true,
    eliminatesECI: true,
    leakageProfile: 'medium'
  }
};

// =============================================================================
// INITIALIZATION — Wire up Step 7 handlers
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initInvestorProfilesUI();
  initBlockerHandlers();
  initFirptaHandlers();
});

function initInvestorProfilesUI() {
  // Initial render of investor profiles based on existing member classes
  renderInvestorProfiles();
}

function initBlockerHandlers() {
  const addBtn = document.getElementById('add_blocker');
  if (addBtn) {
    addBtn.addEventListener('click', () => {
      DB.blockers.push({
        id: DB.nextBlockerId++,
        label: `Blocker ${DB.blockers.length + 1}`,
        type: 'us_ccorp',
        jurisdiction: 'DE',
        memberIds: [],
        treatyCountry: 'none',
        notes: ''
      });
      renderBlockers();
      recomputeAll();
    });
  }
}

function initFirptaHandlers() {
  ['firpta_is_usrpi', 'firpta_usrphc_status', 'firpta_domestic_controlled',
   'firpta_disposition_amount', 'ubti_acq_indebtedness', 'ubti_debt_basis_ratio'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => { /* deferred to results recompute */ });
      el.addEventListener('input', () => { /* deferred */ });
    }
  });
}

// =============================================================================
// INVESTOR PROFILES RENDERING
// =============================================================================
function renderInvestorProfiles() {
  const container = document.getElementById('investor_profiles_container');
  if (!container) return;
  container.innerHTML = '';

  if (DB.memberClasses.length === 0) {
    container.innerHTML = '<p class="db-help-block">No member classes configured. Return to Step 2 to add member classes first.</p>';
    return;
  }

  // Ensure each class has an investorProfile object
  for (const cls of DB.memberClasses) {
    if (!DB.investorProfiles[cls.id]) {
      DB.investorProfiles[cls.id] = {
        profileType: 'us_individual',
        treatyCountry: 'none',
        qualifiedOrg514c9: false,
        qualifiedPension897l: false,
        qualifiedSovereign892: false,
        controlledCommercialEntity: false,
        fractionsRuleSatisfied: false,
        notes: ''
      };
    }
  }

  // Build cards
  const profileOpts = Object.entries(TAX_PROFILES).map(([k, v]) =>
    `<option value="${k}">${v.label}</option>`).join('');
  const treatyOpts = Object.entries(TREATY_COUNTRIES).map(([k, v]) =>
    `<option value="${k}">${v.label}</option>`).join('');

  for (const cls of DB.memberClasses) {
    const p = DB.investorProfiles[cls.id];
    const profile = TAX_PROFILES[p.profileType];

    let cardClass = '';
    let badgeClass = '';
    let badgeText = 'INVESTOR';
    if (profile.isTaxExempt && profile.isUS) {
      cardClass = 'us-taxexempt'; badgeClass = 'taxexempt'; badgeText = 'TAX-EXEMPT';
    } else if (profile.isForeign && p.profileType === 'foreign_pension') {
      cardClass = 'foreign-pension'; badgeClass = 'taxexempt'; badgeText = 'FRGN PENSION';
    } else if (profile.isForeign) {
      cardClass = 'foreign'; badgeClass = 'foreign'; badgeText = 'FOREIGN';
    } else {
      badgeClass = ''; badgeText = 'U.S. TAXABLE';
    }

    const card = document.createElement('div');
    card.className = `investor-profile-card ${cardClass}`;

    // Build sub-fields based on profile type
    let subFieldsHtml = '';
    if (profile.isForeign) {
      subFieldsHtml += `<div class="ip-subfields">
        <div class="mc-field-mini">
          <label>Treaty Country</label>
          <select data-id="${cls.id}" data-pfield="treatyCountry">${treatyOpts}</select>
        </div>`;

      if (p.profileType === 'foreign_pension') {
        subFieldsHtml += `<div class="mc-field-mini">
          <label>§ 897(l) Qualified Foreign Pension Fund</label>
          <select data-id="${cls.id}" data-pfield="qualifiedPension897l">
            <option value="false" ${!p.qualifiedPension897l ? 'selected' : ''}>No / Unknown</option>
            <option value="true" ${p.qualifiedPension897l ? 'selected' : ''}>Yes — qualified per Reg. § 1.897(l)-1</option>
          </select>
        </div>`;
      } else if (p.profileType === 'foreign_government') {
        subFieldsHtml += `<div class="mc-field-mini">
          <label>§ 892 Qualified Foreign Government</label>
          <select data-id="${cls.id}" data-pfield="qualifiedSovereign892">
            <option value="false" ${!p.qualifiedSovereign892 ? 'selected' : ''}>No / Unknown</option>
            <option value="true" ${p.qualifiedSovereign892 ? 'selected' : ''}>Yes — qualified per § 892</option>
          </select>
        </div>`;
      }
      subFieldsHtml += `</div>`;
    }

    if (profile.isTaxExempt && profile.isUS) {
      subFieldsHtml += `<div class="ip-subfields">
        <div class="mc-field-mini">
          <label>§ 514(c)(9) Qualified Organization</label>
          <select data-id="${cls.id}" data-pfield="qualifiedOrg514c9">
            <option value="false" ${!p.qualifiedOrg514c9 ? 'selected' : ''}>No</option>
            <option value="true" ${p.qualifiedOrg514c9 ? 'selected' : ''}>Yes — qualified organization</option>
          </select>
        </div>
        <div class="mc-field-mini">
          <label>Fractions Rule (Reg. § 1.514(c)-2)</label>
          <select data-id="${cls.id}" data-pfield="fractionsRuleSatisfied">
            <option value="false" ${!p.fractionsRuleSatisfied ? 'selected' : ''}>Not Satisfied</option>
            <option value="true" ${p.fractionsRuleSatisfied ? 'selected' : ''}>Satisfied — allocations confirmed compliant</option>
          </select>
        </div>
      </div>`;
    }

    card.innerHTML = `
      <div class="ip-header">
        <div class="ip-class-row">
          <span class="ip-class-badge ${badgeClass}">${badgeText}</span>
          <span class="ip-class-name">${escapeHtml(cls.name)}</span>
        </div>
        <span class="ip-capital">${fmt$(cls.capital)} capital</span>
      </div>
      <div class="ip-fields">
        <div class="mc-field-mini">
          <label>Tax Profile</label>
          <select data-id="${cls.id}" data-pfield="profileType">${profileOpts}</select>
        </div>
        <div class="mc-field-mini">
          <label>Status</label>
          <div style="padding: 0.55rem 0; font-size: 0.85rem; color: #4a4a4a;">${profile.isUS ? 'U.S.' : 'Foreign'} · ${profile.isTaxExempt ? 'Tax-Exempt' : 'Taxable'}</div>
        </div>
        <div class="mc-field-mini">
          <label>Note</label>
          <div style="padding: 0.55rem 0; font-size: 0.78rem; color: #6b6b6b; line-height: 1.4;">${profile.description.substring(0, 100)}${profile.description.length > 100 ? '...' : ''}</div>
        </div>
      </div>
      ${subFieldsHtml}
    `;

    container.appendChild(card);

    // Set the dropdown values
    const profileSelect = card.querySelector(`select[data-pfield="profileType"]`);
    if (profileSelect) profileSelect.value = p.profileType;
    const treatySelect = card.querySelector(`select[data-pfield="treatyCountry"]`);
    if (treatySelect) treatySelect.value = p.treatyCountry;
  }

  // Wire up handlers
  container.querySelectorAll('select').forEach(el => {
    el.addEventListener('change', e => updateInvestorProfileField(e));
  });
}

function updateInvestorProfileField(e) {
  const id = parseInt(e.target.dataset.id, 10);
  const field = e.target.dataset.pfield;
  const p = DB.investorProfiles[id];
  if (!p) return;
  if (e.target.value === 'true') p[field] = true;
  else if (e.target.value === 'false') p[field] = false;
  else p[field] = e.target.value;
  renderInvestorProfiles(); // re-render to reflect new sub-fields
  recomputeAll();
}

// =============================================================================
// BLOCKER ENTITY RENDERING
// =============================================================================
function renderBlockers() {
  const container = document.getElementById('blockers_container');
  if (!container) return;
  container.innerHTML = '';

  if (DB.blockers.length === 0) {
    container.innerHTML = '<p class="db-help-block" style="margin:0 0 1rem 0;">No blocker entities configured. Click below to add a blocker structure between investors and the SPV.</p>';
    return;
  }

  const typeOpts = Object.entries(BLOCKER_TYPES).map(([k, v]) =>
    `<option value="${k}">${v.label}</option>`).join('');
  const jurisdictionOpts = `
    <option value="DE">Delaware</option>
    <option value="MD">Maryland (REITs)</option>
    <option value="WY">Wyoming</option>
    <option value="NV">Nevada</option>
    <option value="VG">British Virgin Islands</option>
    <option value="KY">Cayman Islands</option>
    <option value="BMU">Bermuda</option>
    <option value="NLD">Netherlands</option>
    <option value="LUX">Luxembourg</option>
    <option value="IRL">Ireland</option>
  `;
  const treatyOpts = Object.entries(TREATY_COUNTRIES).map(([k, v]) =>
    `<option value="${k}">${v.label}</option>`).join('');

  DB.blockers.forEach((blocker, idx) => {
    const type = BLOCKER_TYPES[blocker.type];
    const card = document.createElement('div');
    card.className = `blocker-card ${blocker.type.replace('_', '-')}`;

    const memberCheckboxes = DB.memberClasses.map(c =>
      `<label><input type="checkbox" class="bk-member-cb" data-blocker-id="${blocker.id}" data-member-id="${c.id}" ${blocker.memberIds.includes(c.id) ? 'checked' : ''}> ${escapeHtml(c.name)}</label>`
    ).join('');

    card.innerHTML = `
      <div class="bk-header">
        <div class="ip-class-row">
          <span class="bk-badge">${type.label.toUpperCase()}</span>
          <input class="mc-name-input" type="text" value="${escapeHtml(blocker.label)}" data-id="${blocker.id}" data-bfield="label" />
        </div>
        <button class="mc-remove" type="button" data-id="${blocker.id}">Remove</button>
      </div>
      <div class="bk-fields">
        <div class="mc-field-mini">
          <label>Blocker Type</label>
          <select data-id="${blocker.id}" data-bfield="type">${typeOpts}</select>
        </div>
        <div class="mc-field-mini">
          <label>Jurisdiction</label>
          <select data-id="${blocker.id}" data-bfield="jurisdiction">${jurisdictionOpts}</select>
        </div>
        <div class="mc-field-mini">
          <label>Treaty Country (if any)</label>
          <select data-id="${blocker.id}" data-bfield="treatyCountry">${treatyOpts}</select>
        </div>
        <div class="mc-field-mini">
          <label>&nbsp;</label>
          <div style="padding: 0.55rem 0; font-size: 0.78rem; color: #4a4a4a; line-height: 1.4;">${type.description.substring(0, 140)}${type.description.length > 140 ? '...' : ''}</div>
        </div>
      </div>
      <div class="bk-members">
        <div class="bk-members-label">Investors Behind This Blocker</div>
        <div class="bk-members-checkboxes">${memberCheckboxes}</div>
      </div>
    `;
    container.appendChild(card);

    // Set values
    card.querySelector(`select[data-bfield="type"]`).value = blocker.type;
    card.querySelector(`select[data-bfield="jurisdiction"]`).value = blocker.jurisdiction;
    card.querySelector(`select[data-bfield="treatyCountry"]`).value = blocker.treatyCountry;
  });

  // Wire up
  container.querySelectorAll('input[type="text"], select').forEach(el => {
    el.addEventListener('change', e => updateBlockerField(e));
    el.addEventListener('input', e => updateBlockerField(e));
  });
  container.querySelectorAll('.bk-member-cb').forEach(cb => {
    cb.addEventListener('change', e => updateBlockerMembers(e));
  });
  container.querySelectorAll('.mc-remove').forEach(b => {
    b.addEventListener('click', e => {
      const id = parseInt(e.target.dataset.id, 10);
      DB.blockers = DB.blockers.filter(b => b.id !== id);
      renderBlockers();
      recomputeAll();
    });
  });
}

function updateBlockerField(e) {
  const id = parseInt(e.target.dataset.id, 10);
  const field = e.target.dataset.bfield;
  const blocker = DB.blockers.find(b => b.id === id);
  if (!blocker || !field) return;
  blocker[field] = e.target.value;
  if (field === 'type') renderBlockers();
  recomputeAll();
}

function updateBlockerMembers(e) {
  const blockerId = parseInt(e.target.dataset.blockerId, 10);
  const memberId = parseInt(e.target.dataset.memberId, 10);
  const blocker = DB.blockers.find(b => b.id === blockerId);
  if (!blocker) return;
  if (e.target.checked) {
    if (!blocker.memberIds.includes(memberId)) blocker.memberIds.push(memberId);
  } else {
    blocker.memberIds = blocker.memberIds.filter(mid => mid !== memberId);
  }
  recomputeAll();
}

// =============================================================================
// COLLECT PHASE 3 DATA
// =============================================================================
function collectPhase3Data() {
  const v = id => { const el = document.getElementById(id); if (!el) return ''; return String(el.value).replace(/[$,\s%]/g, '').trim(); };
  const n = id => parseFloat(v(id)) || 0;

  return {
    investorProfiles: JSON.parse(JSON.stringify(DB.investorProfiles)),
    blockers: DB.blockers.map(b => ({...b, memberIds: [...b.memberIds]})),
    firptaIsUSRPI: v('firpta_is_usrpi') === 'yes',
    firptaUSRPHCStatus: v('firpta_usrphc_status') || 'auto',
    firptaDomesticControlled: v('firpta_domestic_controlled') || 'auto',
    firptaDispositionAmount: n('firpta_disposition_amount'),
    ubtiAcqIndebtedness: v('ubti_acq_indebtedness') || 'auto',
    ubtiDebtBasisRatio: n('ubti_debt_basis_ratio') / 100
  };
}

// =============================================================================
// FIRPTA ANALYSIS ENGINE
// =============================================================================
//
// For each foreign investor (whether direct in SPV, or behind a blocker):
//   1. Determine FIRPTA exposure based on profile + structure
//   2. Compute §1445 withholding on USRPI disposition (15% of gross sales price)
//   3. Compute §1446(f) withholding on partnership interest transfer (10%)
//   4. Apply §897(l) exemption for qualified foreign pension funds
//   5. Apply §897(h)(1) exception for domestically-controlled QIEs
//   6. Apply blocker effects (foreign or domestic corp interposed)
// =============================================================================
function analyzeFIRPTA(data, results, p3Data) {
  const findings = [];
  const foreignInvestors = data.memberClasses.filter(cls => {
    const profile = TAX_PROFILES[p3Data.investorProfiles[cls.id]?.profileType];
    return profile && profile.isForeign;
  });

  if (foreignInvestors.length === 0 || !p3Data.firptaIsUSRPI) {
    return { findings: [], hasExposure: false, totalWithholding: 0 };
  }

  // Determine SPV USRPHC status
  // For real estate partnerships and LLCs, look-through under §897(g) applies
  // partnership interests are USRPIs to the extent of the partnership's USRPIs
  const isUSRPHC = p3Data.firptaUSRPHCStatus === 'usrphc' ||
                   p3Data.firptaUSRPHCStatus === 'auto'; // default to USRPHC for RE deals
  const isCleansed = p3Data.firptaUSRPHCStatus === 'cleansed';

  // Domestically-controlled determination (REIT-specific, but informative)
  // §897(h)(1): foreign person's gain on disposition of stock in a
  // domestically-controlled QIE is NOT FIRPTA income
  const totalCap = data.memberClasses.reduce((s, c) => s + c.capital, 0);
  const usCap = data.memberClasses
    .filter(cls => TAX_PROFILES[p3Data.investorProfiles[cls.id]?.profileType]?.isUS)
    .reduce((s, c) => s + c.capital, 0);
  const pctUS = totalCap > 0 ? usCap / totalCap : 0;
  const isDomesticallyControlled = (data.dealType === 'reit_private' ||
    data.dealType === 'reit_public' || data.dealType === 'upreit') &&
    p3Data.firptaDomesticControlled !== 'no' && pctUS > 0.50;

  const dispositionAmount = p3Data.firptaDispositionAmount > 0 ?
    p3Data.firptaDispositionAmount : data.exitPrice;

  let totalWithholding = 0;
  const investorResults = [];

  for (const cls of foreignInvestors) {
    const p = p3Data.investorProfiles[cls.id];
    const profile = TAX_PROFILES[p.profileType];

    // Check if behind a blocker
    const blocker = p3Data.blockers.find(b => b.memberIds.includes(cls.id));

    // Determine status
    let status, statusDetail, withholding = 0;

    if (p.profileType === 'foreign_pension' && p.qualifiedPension897l) {
      status = 'protected';
      statusDetail = '§ 897(l) Exempt';
      withholding = 0;
    } else if (p.profileType === 'foreign_government' && p.qualifiedSovereign892 && !p.controlledCommercialEntity) {
      status = 'protected';
      statusDetail = '§ 892 Exempt';
      withholding = 0;
    } else if (blocker) {
      const bType = BLOCKER_TYPES[blocker.type];
      if (blocker.type === 'us_ccorp' || blocker.type === 'double_blocker') {
        status = 'protected';
        statusDetail = `Behind ${bType.label}`;
        withholding = 0; // blocker bears the tax
      } else if (blocker.type === 'foreign_corp') {
        status = 'partial';
        statusDetail = `Foreign blocker bears ECI tax + § 884 BPT`;
        // Foreign corp pays corp tax on ECI plus 30% BPT (treaty-reducible)
        const investorShare = cls.capital / totalCap;
        const grossEciFromDisposition = dispositionAmount * investorShare;
        // Corp tax 21% on ECI
        const corpTax = grossEciFromDisposition * 0.21;
        // BPT 30% on dividend-equivalent (after-tax earnings)
        const treatyData = TREATY_COUNTRIES[blocker.treatyCountry || 'none'];
        const bptRate = treatyData ? treatyData.dividend : 0.30;
        const afterCorpTax = grossEciFromDisposition - corpTax;
        const bpt = afterCorpTax * bptRate;
        withholding = corpTax + bpt;
      } else if (blocker.type === 'reit') {
        if (isDomesticallyControlled) {
          status = 'protected';
          statusDetail = 'REIT + § 897(h)(1) DC-QIE';
          withholding = 0;
        } else {
          status = 'partial';
          statusDetail = 'REIT (non-DC) — § 1445 21% withholding on capital gain dist.';
          // 21% withholding on REIT capital gain distributions to foreign holders
          const investorShare = cls.capital / totalCap;
          withholding = dispositionAmount * investorShare * 0.21;
        }
      } else if (blocker.type === 'treaty_blocker') {
        status = 'partial';
        statusDetail = `Treaty blocker — corp tax + reduced WH`;
        const investorShare = cls.capital / totalCap;
        const grossEciFromDisposition = dispositionAmount * investorShare;
        const corpTax = grossEciFromDisposition * 0.21;
        const treatyData = TREATY_COUNTRIES[blocker.treatyCountry || 'none'];
        const whRate = treatyData ? treatyData.qualifiedDividend || treatyData.dividend : 0.30;
        const afterCorpTax = grossEciFromDisposition - corpTax;
        const wh = afterCorpTax * whRate;
        withholding = corpTax + wh;
      }
    } else if (isCleansed) {
      status = 'protected';
      statusDetail = 'Cleansing exception § 897(c)(1)(B)';
      withholding = 0;
    } else if (isDomesticallyControlled && (data.dealType === 'reit_private' || data.dealType === 'reit_public' || data.dealType === 'upreit')) {
      status = 'protected';
      statusDetail = 'DC-QIE § 897(h)(1)';
      withholding = 0;
    } else {
      // Direct investor in real estate partnership — full FIRPTA exposure
      status = 'exposed';
      const investorShare = cls.capital / totalCap;
      // §1445: 15% of gross sales price (on disposition)
      // §1446(f): 10% of amount realized (on partnership interest transfer)
      // Use §1445 for direct USRPI disposition; this is the more common scenario for RE
      withholding = dispositionAmount * investorShare * 0.15;
      statusDetail = '§ 1445 / § 1446(f) — full FIRPTA exposure';
    }

    totalWithholding += withholding;
    investorResults.push({
      class: cls,
      profile: p,
      profileType: p.profileType,
      profileLabel: profile.label,
      blocker,
      status,
      statusDetail,
      withholding
    });

    // Estate tax exposure flag for NRA individuals
    if (p.profileType === 'foreign_individual' && !blocker) {
      findings.push({
        type: 'critical',
        text: `<strong>${escapeHtml(cls.name)} — U.S. estate tax exposure.</strong> Nonresident alien individuals owning direct or indirect U.S. real property are subject to U.S. estate tax under §§ 2104, 2107 at rates up to 40%, with only a $60,000 unified credit equivalent. Strongly recommend interposing a foreign corporation or partnership before death to convert U.S.-situs real property into non-U.S.-situs intangible.`
      });
    }
  }

  // Aggregate findings
  if (totalWithholding > 0) {
    findings.push({
      type: 'flag',
      text: `Total FIRPTA-related withholding across foreign investors: <strong>${fmt$(totalWithholding)}</strong>. Withholding is creditable against final U.S. tax liability via Form 1040-NR or 1120-F. Withholding certificates under § 1445(e) may reduce or eliminate withholding upon advance application to the Service.`
    });
  }

  // §897(h)(1) thresholds
  if (data.dealType === 'reit_private' || data.dealType === 'reit_public' || data.dealType === 'upreit') {
    findings.push({
      type: 'flag',
      text: `Domestically-controlled QIE test: U.S. ownership is approximately <strong>${(pctUS * 100).toFixed(1)}%</strong>. Threshold for § 897(h)(1) exception is 50%. Post-2024 final regulations under Reg. § 1.897-9T may treat certain foreign-owned domestic corporations as foreign for purposes of this test — confirm with reference to the look-through rules.`
    });
  }

  return { findings, investorResults, totalWithholding, hasExposure: totalWithholding > 0 || foreignInvestors.length > 0, pctUS };
}

// =============================================================================
// UBTI ANALYSIS ENGINE
// =============================================================================
//
// For each US tax-exempt investor:
//   1. Determine if §514 unrelated debt-financed income applies
//   2. Apply §514(c)(9) exception if qualified organization + fractions rule
//   3. Compute estimated UDFI exposure (debt-basis ratio × allocable income)
//   4. Apply blocker effects (REIT or C-corp eliminates UBTI passthrough)
//   5. Surface 990-T filing obligation if exposure > $1,000
// =============================================================================
function analyzeUBTI(data, results, p3Data) {
  const findings = [];
  const taxExempts = data.memberClasses.filter(cls => {
    const profile = TAX_PROFILES[p3Data.investorProfiles[cls.id]?.profileType];
    return profile && profile.isUS && profile.isTaxExempt;
  });

  if (taxExempts.length === 0) {
    return { findings: [], investorResults: [], hasExposure: false, totalUBTI: 0 };
  }

  const totalCap = data.memberClasses.reduce((s, c) => s + c.capital, 0);
  const totalDebt = data.seniorLoan + data.memberDebt.reduce((s, d) => s + d.amount, 0);
  const hasAcqDebt = (p3Data.ubtiAcqIndebtedness === 'auto' && totalDebt > 0) ||
                    p3Data.ubtiAcqIndebtedness === 'yes';

  // Compute approximate debt-basis ratio (matches UDFI percentage)
  const debtBasisRatio = hasAcqDebt ?
    (p3Data.ubtiDebtBasisRatio > 0 ? p3Data.ubtiDebtBasisRatio : (totalDebt / Math.max(totalCap + totalDebt, 1))) : 0;

  let totalUBTI = 0;
  const investorResults = [];

  for (const cls of taxExempts) {
    const p = p3Data.investorProfiles[cls.id];
    const profile = TAX_PROFILES[p.profileType];
    const blocker = p3Data.blockers.find(b => b.memberIds.includes(cls.id));

    // Get the investor's share of total profit (approximated from distribution)
    const classReturn = results.classReturns.find(r => r.class.id === cls.id);
    const totalIncome = classReturn ? Math.max(0, classReturn.distribution - cls.capital) : 0;

    let status, statusDetail, udfiAmount = 0, tax = 0;

    if (blocker) {
      const bType = BLOCKER_TYPES[blocker.type];
      if (bType.eliminatesUBTI) {
        status = 'exempt';
        statusDetail = `Behind ${bType.label} — UBTI eliminated`;
        udfiAmount = 0;
        tax = 0;
      } else {
        status = 'exposed';
        statusDetail = `Behind ${bType.label} but UBTI not fully blocked`;
        udfiAmount = totalIncome * debtBasisRatio;
        tax = udfiAmount * 0.21; // assume corp rate
      }
    } else if (!hasAcqDebt) {
      status = 'exempt';
      statusDetail = 'No acquisition indebtedness — no § 514 UDFI';
      udfiAmount = 0;
    } else if (p.qualifiedOrg514c9 && p.fractionsRuleSatisfied) {
      status = 'exempt';
      statusDetail = '§ 514(c)(9) qualified organization + fractions rule satisfied';
      udfiAmount = 0;
    } else if (p.qualifiedOrg514c9 && !p.fractionsRuleSatisfied) {
      status = 'partial';
      statusDetail = '§ 514(c)(9) qualified but fractions rule NOT satisfied — exception lost';
      udfiAmount = totalIncome * debtBasisRatio;
      tax = udfiAmount * 0.21;
    } else {
      status = 'exposed';
      statusDetail = `${(debtBasisRatio * 100).toFixed(0)}% UDFI — taxable UBTI`;
      udfiAmount = totalIncome * debtBasisRatio;
      // Corporate exempts pay at corp rate; trust exempts at trust rates
      const rate = p.profileType === 'us_pension' || p.profileType === 'us_educational' ? 0.21 : 0.37;
      tax = udfiAmount * rate;
    }

    totalUBTI += udfiAmount;
    investorResults.push({
      class: cls,
      profile: p,
      profileLabel: profile.label,
      blocker,
      status,
      statusDetail,
      udfiAmount,
      tax,
      filingObligation: udfiAmount > 1000
    });

    // Specific findings
    if (status === 'partial') {
      findings.push({
        type: 'critical',
        text: `<strong>${escapeHtml(cls.name)} — fractions rule failure.</strong> ${escapeHtml(cls.name)} is a § 514(c)(9) qualified organization, but the partnership&rsquo;s allocations do not satisfy the fractions rule under Reg. § 1.514(c)-2. Result: the entire § 514(c)(9) exception is lost and the investor's share of debt-financed income is fully UBTI. Restructure the allocations or insert a REIT or corporate blocker.`
      });
    }
    if (udfiAmount > 1000) {
      findings.push({
        type: 'flag',
        text: `<strong>${escapeHtml(cls.name)}</strong> must file Form 990-T for UDFI exceeding $1,000. Estimated UBTI: ${fmt$(udfiAmount)}; estimated tax: ${fmt$(tax)}.`
      });
    }
  }

  return { findings, investorResults, totalUBTI, hasExposure: totalUBTI > 0 };
}

// =============================================================================
// BLOCKER LEAKAGE COMPUTATION
// =============================================================================
//
// For each configured blocker, compute approximate tax leakage:
//   - Domestic C-corp: 21% on income, plus dividend WH (30% or treaty)
//   - Foreign corp: 21% on ECI + §884 BPT (30% treaty-reducible)
//   - REIT: 0% if compliant + DC-QIE exception; otherwise FIRPTA-style WH
//   - Double: 21% domestic + WH between domestic and foreign blocker
//   - Treaty: 21% domestic + treaty-reduced WH
// =============================================================================
function analyzeBlockerLeakage(data, results, p3Data) {
  if (p3Data.blockers.length === 0) return { rows: [] };

  const totalCap = data.memberClasses.reduce((s, c) => s + c.capital, 0);
  const rows = [];

  for (const blocker of p3Data.blockers) {
    const bType = BLOCKER_TYPES[blocker.type];
    const treatyData = TREATY_COUNTRIES[blocker.treatyCountry || 'none'];

    // Sum the income flowing through the blocker (allocable share to behind-investors)
    let blockerIncomePool = 0;
    let blockerCapital = 0;
    for (const memberId of blocker.memberIds) {
      const memCls = data.memberClasses.find(c => c.id === memberId);
      const ret = results.classReturns.find(r => r.class.id === memberId);
      if (memCls && ret) {
        blockerIncomePool += Math.max(0, ret.distribution - memCls.capital);
        blockerCapital += memCls.capital;
      }
    }

    let corpTax = 0, withholding = 0, totalLeakage = 0, effectiveRate = 0;
    let notes = '';

    if (blocker.type === 'us_ccorp') {
      corpTax = blockerIncomePool * 0.21;
      const afterTax = blockerIncomePool - corpTax;
      withholding = afterTax * (treatyData ? treatyData.dividend : 0.30);
      totalLeakage = corpTax + withholding;
      notes = `21% federal corp tax + ${((treatyData?.dividend || 0.30) * 100).toFixed(0)}% dividend withholding (${treatyData?.label || 'non-treaty'})`;
    } else if (blocker.type === 'foreign_corp') {
      // ECI only — assume real estate income is ECI
      corpTax = blockerIncomePool * 0.21;
      const afterTax = blockerIncomePool - corpTax;
      withholding = afterTax * 0.30; // §884 BPT, treaty-reducible
      totalLeakage = corpTax + withholding;
      notes = `21% corp tax on ECI + 30% § 884 branch profits tax (treaty-reducible)`;
    } else if (blocker.type === 'reit') {
      // If REIT distributes 90%+, no entity tax. FIRPTA capital gain distributions to foreign WH at 21%.
      const totalDebt = data.seniorLoan + data.memberDebt.reduce((s, d) => s + d.amount, 0);
      const isDC = totalCap > 0 && (totalCap - blockerCapital) / totalCap > 0.50;
      corpTax = 0;
      withholding = isDC ? 0 : blockerIncomePool * 0.21;
      totalLeakage = withholding;
      notes = isDC ? 'REIT compliant + domestically-controlled — no FIRPTA WH' : 'REIT — § 1445 21% WH on capital gain dist. to foreign holders';
    } else if (blocker.type === 'double_blocker') {
      const usTax = blockerIncomePool * 0.21;
      const afterUS = blockerIncomePool - usTax;
      // dividend from US blocker to foreign blocker — 30% / treaty
      const dividendWH = afterUS * 0.30; // could be reduced by treaty
      const remaining = afterUS - dividendWH;
      // Foreign blocker then distributes to ultimate investors — no further US tax
      corpTax = usTax;
      withholding = dividendWH;
      totalLeakage = corpTax + withholding;
      notes = '21% US corp tax + 30% US-source dividend WH to foreign holding; foreign holding distributes free of further US tax';
    } else if (blocker.type === 'treaty_blocker') {
      const usTax = blockerIncomePool * 0.21;
      const afterUS = blockerIncomePool - usTax;
      const rate = treatyData?.qualifiedDividend || treatyData?.dividend || 0.30;
      const dividendWH = afterUS * rate;
      corpTax = usTax;
      withholding = dividendWH;
      totalLeakage = corpTax + withholding;
      notes = `21% US corp tax + ${(rate * 100).toFixed(0)}% treaty-reduced WH (${treatyData?.label || 'non-treaty'}); subject to LOB and anti-conduit (Reg. § 1.881-3)`;
    }

    effectiveRate = blockerIncomePool > 0 ? totalLeakage / blockerIncomePool : 0;

    let leakageClass = 'good';
    if (effectiveRate > 0.35) leakageClass = 'bad';
    else if (effectiveRate > 0.20) leakageClass = 'warn';

    rows.push({
      blocker, type: bType, blockerIncomePool, blockerCapital,
      corpTax, withholding, totalLeakage, effectiveRate,
      leakageClass, notes
    });
  }

  return { rows };
}

// =============================================================================
// STRUCTURAL RECOMMENDATIONS ENGINE
// =============================================================================
//
// Generates recommendations based on:
//   - Foreign + tax-exempt mix (suggest master-feeder)
//   - Foreign individuals without blocker (estate tax warning)
//   - US tax-exempts in leveraged RE without §514(c)(9) (suggest REIT or C-corp blocker)
//   - REIT/UPREIT with foreign LPs (DC-QIE 50% test analysis)
//   - SWFs without REIT (§892 commercial entity risk)
//   - Foreign pension funds with §897(l) potential (qualify them)
// =============================================================================
function generateRecommendations(data, results, p3Data, firpta, ubti) {
  const recs = [];
  const profiles = p3Data.investorProfiles;

  const foreignInvestors = data.memberClasses.filter(c =>
    TAX_PROFILES[profiles[c.id]?.profileType]?.isForeign);
  const taxExempts = data.memberClasses.filter(c => {
    const p = TAX_PROFILES[profiles[c.id]?.profileType];
    return p?.isUS && p?.isTaxExempt;
  });
  const totalDebt = data.seniorLoan + data.memberDebt.reduce((s, d) => s + d.amount, 0);
  const isLeveraged = totalDebt > 0;

  // Foreign individuals — estate tax
  const foreignIndividuals = data.memberClasses.filter(c =>
    profiles[c.id]?.profileType === 'foreign_individual');
  for (const fi of foreignIndividuals) {
    const hasBlocker = p3Data.blockers.some(b => b.memberIds.includes(fi.id));
    if (!hasBlocker) {
      recs.push({
        type: 'critical',
        text: `<strong>${escapeHtml(fi.name)}:</strong> nonresident alien individual with direct USRPI exposure. U.S. estate tax under §§ 2104, 2107 applies at rates up to 40% with only $60,000 unified credit. Interpose a foreign corporation (or partnership-of-foreign-corp) before any contemplated transfer or death. Coordinate with the investor's home country gift/inheritance regime.`
      });
    }
  }

  // Foreign pension funds — confirm §897(l) qualification
  const foreignPensions = data.memberClasses.filter(c =>
    profiles[c.id]?.profileType === 'foreign_pension');
  for (const fp of foreignPensions) {
    const profile = profiles[fp.id];
    if (!profile.qualifiedPension897l) {
      recs.push({
        type: 'recommend',
        text: `<strong>${escapeHtml(fp.name)}:</strong> if structured as a qualified foreign pension fund under § 897(l), this investor is EXEMPT from FIRPTA on USRPI dispositions. Conditions per Reg. § 1.897(l)-1 (June 2022 final): (i) created or organized under the laws of a foreign country; (ii) established to provide retirement or pension benefits; (iii) no single beneficiary holds more than 5%; (iv) regulated by, and provides annual reporting to, tax authorities in its home country; (v) qualified for tax benefits in home country. Engage Donovan Legal to confirm and document qualification.`
      });
    }
  }

  // Foreign government / SWF — §892 + REIT structure
  const foreignSWFs = data.memberClasses.filter(c =>
    profiles[c.id]?.profileType === 'foreign_government');
  for (const swf of foreignSWFs) {
    const profile = profiles[swf.id];
    const hasBlocker = p3Data.blockers.some(b => b.memberIds.includes(swf.id) &&
      (BLOCKER_TYPES[p3Data.blockers.find(bb => bb.id === b.id).type]?.eliminatesECI ||
       p3Data.blockers.find(bb => bb.id === b.id).type === 'reit'));
    if (!hasBlocker && data.dealType !== 'reit_private' && data.dealType !== 'reit_public' && data.dealType !== 'upreit') {
      recs.push({
        type: 'recommend',
        text: `<strong>${escapeHtml(swf.name)}:</strong> sovereign wealth fund (§ 892). Investment in an operating real estate partnership likely creates "controlled commercial entity" risk under § 892(a)(2)(B), which would CAUSE LOSS of the § 892 exemption on ALL the SWF&rsquo;s U.S. investment income (catastrophic for SWFs with diverse U.S. portfolios). Strongly recommend a REIT or corporate blocker to insulate the SWF from commercial activity exposure.`
      });
    }
  }

  // US tax-exempts in leveraged RE
  if (taxExempts.length > 0 && isLeveraged) {
    for (const te of taxExempts) {
      const profile = profiles[te.id];
      const hasBlocker = p3Data.blockers.some(b => b.memberIds.includes(te.id));
      if (!hasBlocker && !(profile.qualifiedOrg514c9 && profile.fractionsRuleSatisfied)) {
        recs.push({
          type: 'recommend',
          text: `<strong>${escapeHtml(te.name)}:</strong> U.S. tax-exempt in leveraged real estate with no § 514(c)(9) protection. Recommend (i) confirming qualified-organization status under § 514(c)(9) and structuring allocations to satisfy the fractions rule; or (ii) interposing a captive REIT or U.S. C-corp blocker to convert UDFI exposure into corporate-level income (which is non-passing through to the tax-exempt).`
        });
      }
    }
  }

  // Mixed pool: foreign + tax-exempt → master-feeder
  if (foreignInvestors.length > 0 && taxExempts.length > 0 && data.dealType !== 'master_feeder' &&
      data.dealType !== 'reit_private' && data.dealType !== 'reit_public' && data.dealType !== 'upreit') {
    recs.push({
      type: 'recommend',
      text: `Mixed pool of foreign and U.S. tax-exempt investors detected. Consider <strong>master-feeder structure</strong>: an onshore feeder (LLC) for U.S. taxable investors investing directly into the master fund, and an offshore feeder (Cayman or BVI corporation) for foreign and tax-exempt investors investing through a corporate blocker into the master fund. This structure addresses ECI (for foreign), UBTI (for tax-exempt), and FIRPTA filing for both. Alternative: private REIT or UPREIT with appropriate income/asset compliance under § 856 (Phase IV).`
    });
  }

  // REIT with foreign LPs — DC-QIE 50% test
  if ((data.dealType === 'reit_private' || data.dealType === 'reit_public' || data.dealType === 'upreit') &&
      foreignInvestors.length > 0) {
    const totalCap = data.memberClasses.reduce((s, c) => s + c.capital, 0);
    const usCap = data.memberClasses.filter(c => TAX_PROFILES[profiles[c.id]?.profileType]?.isUS)
      .reduce((s, c) => s + c.capital, 0);
    const pctUS = totalCap > 0 ? usCap / totalCap : 0;
    if (pctUS <= 0.50) {
      recs.push({
        type: 'critical',
        text: `REIT/UPREIT structure with U.S. ownership at <strong>${(pctUS * 100).toFixed(1)}%</strong> — BELOW 50% threshold for "domestically controlled QIE" under § 897(h)(1). Foreign investors disposing of REIT stock will be subject to FIRPTA. Restructure to bring U.S. ownership above 50%, or accept full FIRPTA exposure on REIT-share dispositions. Note: Reg. § 1.897-9T final regulations (April 2024) apply look-through rules that may treat foreign-owned domestic C-corps as foreign for this test.`
      });
    } else if (pctUS < 0.60) {
      recs.push({
        type: 'flag',
        text: `REIT/UPREIT structure with U.S. ownership at ${(pctUS * 100).toFixed(1)}% — close to the 50% DC-QIE threshold. Maintain a margin of safety; secondary transfers of LP/REIT interests must be monitored to avoid dropping below 50%.`
      });
    }
  }

  // Treaty country flag — anti-conduit / LOB
  for (const blocker of p3Data.blockers) {
    if (blocker.treatyCountry && blocker.treatyCountry !== 'none') {
      const tc = TREATY_COUNTRIES[blocker.treatyCountry];
      if (tc.hasLOB) {
        recs.push({
          type: 'flag',
          text: `Treaty blocker in ${tc.label} (${escapeHtml(blocker.label)}): treaty benefits subject to limitation-on-benefits (LOB) clause requiring genuine qualifying residence (publicly traded, active business, derivative benefits, or competent authority discretionary determination). Anti-conduit financing rules under Reg. § 1.881-3 apply where the blocker is part of a "financing arrangement." Confirm substance, beneficial ownership, and treaty entitlement.`
        });
      }
    }
  }

  // If no foreign or tax-exempt investors, note baseline
  if (foreignInvestors.length === 0 && taxExempts.length === 0) {
    recs.push({
      type: 'recommend',
      text: 'All investors are U.S. taxable. FIRPTA and UBTI not implicated. Continue with the structure as configured; revisit blocker analysis only if foreign or tax-exempt investors are admitted.'
    });
  }

  return recs;
}

// =============================================================================
// EXTEND recomputeAll FOR PHASE 3
// =============================================================================
const _phase2RecomputeAll = recomputeAll;
recomputeAll = function() {
  const data = collectFormData();
  const allocData = collectAllocationData();
  const p3Data = collectPhase3Data();
  const results = calculateDeal(data);
  results.sensitivity = calculateSensitivity(data);
  results.sec704c = calculate704cAggregate(data, allocData, results.years);
  results.rollForward = calculateCapitalAccountRollForward(data, results, allocData);
  results.sec754Analysis = analyze754(data, results, allocData, results.rollForward);
  results.firpta = analyzeFIRPTA(data, results, p3Data);
  results.ubti = analyzeUBTI(data, results, p3Data);
  results.blockerLeakage = analyzeBlockerLeakage(data, results, p3Data);
  results.recommendations = generateRecommendations(data, results, p3Data, results.firpta, results.ubti);
  results.allocData = allocData;
  results.p3Data = p3Data;
  DB.lastResults = results;

  updateCapitalStackSummary();
  updateBudgetSummary(results);
  renderResults(results);
  renderSec704cComparison(results);
  renderCapitalAccountRollForward(results);
  renderSec754Analysis(results);
  renderFIRPTA(results);
  renderUBTI(results);
  renderBlockerLeakage(results);
  renderRecommendations(results);
  // Refresh investor profiles UI to pick up any member class changes
  renderInvestorProfiles();
};

// =============================================================================
// RENDERERS
// =============================================================================
function renderFIRPTA(results) {
  const target = document.getElementById('firpta_analysis_wrap');
  if (!target) return;
  const f = results.firpta;
  if (!f.hasExposure) {
    target.innerHTML = '<p class="db-help-block" style="margin:0;">No foreign investors configured. FIRPTA analysis not applicable. To enable, set one or more member classes to a foreign profile type in Step 7.</p>';
    return;
  }

  let html = '<div class="firpta-panel">';
  html += '<div class="firpta-panel-header">Investor-Level FIRPTA Exposure</div>';
  for (const ir of f.investorResults) {
    const statusClass = ir.status;
    html += `<div class="firpta-investor-row">
      <div class="fi-name">${escapeHtml(ir.class.name)}<br><span style="font-size:0.78rem;font-weight:normal;color:#6b6b6b;">${escapeHtml(ir.profileLabel)}</span></div>
      <div class="fi-status ${statusClass}">${ir.status === 'protected' ? 'PROTECTED' : ir.status === 'partial' ? 'PARTIAL' : 'EXPOSED'}</div>
      <div class="fi-status" style="color:#4a4a4a;font-weight:normal;font-size:0.85rem;">${escapeHtml(ir.statusDetail)}</div>
      <div class="fi-amount">${ir.withholding > 0 ? fmt$(ir.withholding) : '$0'}</div>
    </div>`;
  }
  html += `<div class="firpta-summary">
    <strong>Aggregate FIRPTA exposure:</strong> ${fmt$(f.totalWithholding)} withholding across ${f.investorResults.length} foreign investor${f.investorResults.length !== 1 ? 's' : ''}.
    U.S. ownership for § 897(h)(1) test: ${(f.pctUS * 100).toFixed(1)}%.
    Withholding is creditable against final U.S. tax liability; withholding certificates may reduce it.
  </div>`;

  if (f.findings.length > 0) {
    html += '<div style="margin-top:1.25rem; padding-top:1rem; border-top:1px solid #e8e8e0;">';
    for (const finding of f.findings) {
      const noteClass = finding.type === 'critical' ? 'note-critical' :
                       finding.type === 'flag' ? 'note-flag' : 'note-recommend';
      html += `<div class="note-item ${noteClass}" style="border-bottom:none;">${finding.text}</div>`;
    }
    html += '</div>';
  }

  html += '</div>';
  target.innerHTML = html;
}

function renderUBTI(results) {
  const target = document.getElementById('ubti_analysis_wrap');
  if (!target) return;
  const u = results.ubti;
  if (u.investorResults.length === 0) {
    target.innerHTML = '<p class="db-help-block" style="margin:0;">No U.S. tax-exempt investors configured. UBTI analysis not applicable. To enable, set one or more member classes to a U.S. tax-exempt profile type in Step 7.</p>';
    return;
  }

  let html = '<div class="ubti-panel">';
  html += '<div class="ubti-panel-header">U.S. Tax-Exempt Investor UBTI Analysis</div>';
  for (const ir of u.investorResults) {
    html += `<div class="ubti-row">
      <div class="ur-name">${escapeHtml(ir.class.name)}<br><span style="font-size:0.78rem;font-weight:normal;color:#6b6b6b;">${escapeHtml(ir.profileLabel)}</span></div>
      <div class="ur-status ${ir.status}">${ir.status === 'exempt' ? 'EXEMPT' : ir.status === 'partial' ? 'PARTIAL' : 'TAXABLE'}</div>
      <div class="ur-value" style="font-size:0.85rem;font-weight:normal;text-align:left;">${escapeHtml(ir.statusDetail)}</div>
      <div class="ur-value">UBTI: ${fmt$(ir.udfiAmount)}</div>
      <div class="ur-value">Tax: ${fmt$(ir.tax)}</div>
    </div>`;
  }
  html += `<div class="firpta-summary"><strong>Aggregate UBTI exposure:</strong> ${fmt$(u.totalUBTI)} across ${u.investorResults.length} tax-exempt investor${u.investorResults.length !== 1 ? 's' : ''}. Form 990-T filing required for any investor with UBTI exceeding $1,000.</div>`;

  if (u.findings.length > 0) {
    html += '<div style="margin-top:1.25rem; padding-top:1rem; border-top:1px solid #e8e8e0;">';
    for (const finding of u.findings) {
      const noteClass = finding.type === 'critical' ? 'note-critical' :
                       finding.type === 'flag' ? 'note-flag' : 'note-recommend';
      html += `<div class="note-item ${noteClass}" style="border-bottom:none;">${finding.text}</div>`;
    }
    html += '</div>';
  }

  html += '</div>';
  target.innerHTML = html;
}

function renderBlockerLeakage(results) {
  const target = document.getElementById('blocker_leakage_wrap');
  if (!target) return;
  const b = results.blockerLeakage;
  if (b.rows.length === 0) {
    target.innerHTML = '<p class="db-help-block" style="margin:0;">No blocker entities configured. Add blockers in Step 7 to see tax leakage analysis.</p>';
    return;
  }

  let html = '<div class="leakage-panel">';
  html += '<table class="leakage-table">';
  html += '<thead><tr><th>Blocker</th><th>Type</th><th class="right">Income Through</th><th class="right">Corp Tax</th><th class="right">Withholding</th><th class="right">Total Leakage</th><th class="right">Effective Rate</th></tr></thead>';
  html += '<tbody>';
  for (const row of b.rows) {
    html += `<tr>
      <td><strong>${escapeHtml(row.blocker.label)}</strong><br><span style="font-size:0.78rem;color:#6b6b6b;">${escapeHtml(row.notes)}</span></td>
      <td>${escapeHtml(row.type.label)}</td>
      <td class="right">${fmt$(row.blockerIncomePool)}</td>
      <td class="right">${fmt$(row.corpTax)}</td>
      <td class="right">${fmt$(row.withholding)}</td>
      <td class="right leakage-${row.leakageClass}">${fmt$(row.totalLeakage)}</td>
      <td class="right leakage-${row.leakageClass}">${fmtPct(row.effectiveRate, 1)}</td>
    </tr>`;
  }
  html += '</tbody></table>';
  html += '</div>';
  target.innerHTML = html;
}

function renderRecommendations(results) {
  const target = document.getElementById('structural_recommendations');
  if (!target) return;
  let html = '';
  for (const rec of results.recommendations) {
    const cls = rec.type === 'critical' ? 'note-critical' :
                rec.type === 'flag' ? 'note-flag' : 'note-recommend';
    html += `<div class="note-item ${cls}">${rec.text}</div>`;
  }
  if (!html) html = '<p style="color:#6b6b6b;font-style:italic;">No structural recommendations at this configuration.</p>';
  target.innerHTML = html;
}

// =============================================================================
// EXTEND SAVE/LOAD JSON FOR PHASE 3
// =============================================================================
const _phase2SaveJSON = saveJSON;
saveJSON = function() {
  const data = collectFormData();

  const payload = {
    version: 'phase-3',
    savedAt: new Date().toISOString(),
    state: {
      memberClasses: DB.memberClasses,
      memberDebt: DB.memberDebt,
      promoteTiers: DB.promoteTiers,
      sec704cLayers: DB.sec704cLayers,
      blockers: DB.blockers,
      investorProfiles: DB.investorProfiles,
      nextMemberId: DB.nextMemberId,
      nextDebtId: DB.nextDebtId,
      nextTierId: DB.nextTierId,
      nextLayerId: DB.nextLayerId,
      nextBlockerId: DB.nextBlockerId
    },
    formInputs: collectFormInputsForSave(),
    allocationInputs: {
      alloc_704b_method: document.getElementById('alloc_704b_method')?.value,
      alloc_capacct_maintenance: document.getElementById('alloc_capacct_maintenance')?.value,
      alloc_min_gain_chargeback: document.getElementById('alloc_min_gain_chargeback')?.value,
      alloc_704c_present: document.getElementById('alloc_704c_present')?.value,
      alloc_704c_parallel: document.getElementById('alloc_704c_parallel')?.value,
      alloc_704c_method: document.getElementById('alloc_704c_method')?.value,
      alloc_754_election: document.getElementById('alloc_754_election')?.value,
      alloc_anticipated_transfer: document.getElementById('alloc_anticipated_transfer')?.value,
      cost_seg_pct: document.getElementById('cost_seg_pct')?.value,
      cost_seg_allocation_target: document.getElementById('cost_seg_allocation_target')?.value,
      checkboxes: {
        alloc_1245_recapture: document.getElementById('alloc_1245_recapture')?.checked,
        alloc_1250_unrecaptured: document.getElementById('alloc_1250_unrecaptured')?.checked,
        alloc_cost_seg_pickup: document.getElementById('alloc_cost_seg_pickup')?.checked,
        alloc_nonrecourse_deduction: document.getElementById('alloc_nonrecourse_deduction')?.checked
      },
      droClasses: Array.from(document.querySelectorAll('.dro-checkbox')).filter(cb => cb.checked).map(cb => parseInt(cb.dataset.id, 10))
    },
    phase3Inputs: {
      firpta_is_usrpi: document.getElementById('firpta_is_usrpi')?.value,
      firpta_usrphc_status: document.getElementById('firpta_usrphc_status')?.value,
      firpta_domestic_controlled: document.getElementById('firpta_domestic_controlled')?.value,
      firpta_disposition_amount: document.getElementById('firpta_disposition_amount')?.value,
      ubti_acq_indebtedness: document.getElementById('ubti_acq_indebtedness')?.value,
      ubti_debt_basis_ratio: document.getElementById('ubti_debt_basis_ratio')?.value
    }
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (data.projectName || 'deal').replace(/[^a-zA-Z0-9-_]/g, '_');
  a.href = url;
  a.download = `${name}-deal-builder-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const _phase2LoadJSON = loadJSON;
loadJSON = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const payload = JSON.parse(e.target.result);
      DB.memberClasses = payload.state.memberClasses || [];
      DB.memberDebt = payload.state.memberDebt || [];
      DB.promoteTiers = payload.state.promoteTiers || [];
      DB.sec704cLayers = payload.state.sec704cLayers || [];
      DB.blockers = payload.state.blockers || [];
      DB.investorProfiles = payload.state.investorProfiles || {};
      DB.nextMemberId = payload.state.nextMemberId || DB.memberClasses.length + 1;
      DB.nextDebtId = payload.state.nextDebtId || DB.memberDebt.length + 1;
      DB.nextTierId = payload.state.nextTierId || DB.promoteTiers.length + 1;
      DB.nextLayerId = payload.state.nextLayerId || DB.sec704cLayers.length + 1;
      DB.nextBlockerId = payload.state.nextBlockerId || DB.blockers.length + 1;

      for (const [id, val] of Object.entries(payload.formInputs || {})) {
        if (id === 'checkboxes') continue;
        const el = document.getElementById(id);
        if (el) el.value = val;
      }
      if (payload.formInputs?.checkboxes) {
        for (const [id, val] of Object.entries(payload.formInputs.checkboxes)) {
          const el = document.getElementById(id);
          if (el) el.checked = val;
        }
      }

      if (payload.allocationInputs) {
        for (const [id, val] of Object.entries(payload.allocationInputs)) {
          if (id === 'checkboxes' || id === 'droClasses') continue;
          const el = document.getElementById(id);
          if (el) el.value = val;
        }
        if (payload.allocationInputs.checkboxes) {
          for (const [id, val] of Object.entries(payload.allocationInputs.checkboxes)) {
            const el = document.getElementById(id);
            if (el) el.checked = val;
          }
        }
      }

      if (payload.phase3Inputs) {
        for (const [id, val] of Object.entries(payload.phase3Inputs)) {
          const el = document.getElementById(id);
          if (el) el.value = val;
        }
      }

      renderMemberClasses();
      renderMemberDebt();
      renderPromoteTiers();
      renderSec704cLayers();
      renderInvestorProfiles();
      renderBlockers();
      renderStateSummary();
      document.getElementById('deal_type_help').innerHTML = DEAL_TYPES[document.getElementById('deal_type').value]?.help || '';
      document.getElementById('jurisdiction_help').innerHTML = JURISDICTION_HELP[document.getElementById('jurisdiction').value] || '';
      document.getElementById('senior_752_help').innerHTML = SEC752_HELP[document.getElementById('senior_752_class').value] || '';
      document.getElementById('alloc_704b_help').innerHTML = SEC704B_HELP[document.getElementById('alloc_704b_method').value] || '';
      const cbType = document.getElementById('clawback_type').value;
      document.getElementById('clawback_threshold_group').style.display = cbType !== 'none' ? 'grid' : 'none';
      document.getElementById('sec704c_layers_wrap').style.display = document.getElementById('alloc_704c_present').value === 'yes' ? 'block' : 'none';
      document.getElementById('dro_group').style.display = document.getElementById('alloc_704b_method').value === 'see_dro' ? 'block' : 'none';
      document.getElementById('cost_seg_alloc_group').style.display = document.getElementById('alloc_cost_seg_pickup').checked ? 'grid' : 'none';

      recomputeAll();
      alert(`Deal loaded: ${payload.formInputs?.project_name || 'unnamed'} (version: ${payload.version}, saved ${payload.savedAt})`);
    } catch (err) {
      alert('Error loading file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

// Rebind the load input listener since loadJSON was reassigned
document.addEventListener('DOMContentLoaded', () => {
  const loadInput = document.getElementById('load_json_input');
  if (loadInput) {
    const newInput = loadInput.cloneNode(true);
    loadInput.parentNode.replaceChild(newInput, loadInput);
    newInput.addEventListener('change', loadJSON);
  }
});



// =============================================================================
// =============================================================================
//             PHASE 4 — SPECIALIZED COMPLIANCE ENGINES
//      REIT (§856 et seq.) — OZ (§1400Z-2) — TIC (Rev. Proc. 2002-22) —
//                  DST (Rev. Rul. 2004-86 Seven Deadly Sins)
// =============================================================================
// =============================================================================

// =============================================================================
// INITIALIZATION — Wire up Step 8 module visibility based on deal type
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // When deal type changes, show/hide the relevant compliance module
  const dealTypeSel = document.getElementById('deal_type');
  if (dealTypeSel) {
    dealTypeSel.addEventListener('change', updateComplianceModuleVisibility);
  }
  // Also when DOM is ready, set initial state
  updateComplianceModuleVisibility();

  // Wire up compliance inputs to trigger recompute
  const allComplianceInputs = [
    'reit_num_shareholders', 'reit_top5_ownership', 'reit_re_income_pct',
    'reit_other_passive_income_pct', 'reit_re_assets_pct', 'reit_trs_pct',
    'reit_largest_issuer_pct', 'reit_distribution_pct',
    'qof_90_pct', 'qof_form_8996', 'qozb_70_pct', 'qozb_active_income_pct',
    'qozb_wcsh', 'qozb_sub_improvement', 'qozb_sin_business', 'qof_investor_hold',
    'tic_cotenants', 'tic_largest_interest', 'tic_unanimous', 'tic_fee_interest',
    'tic_proportionate', 'tic_debt', 'tic_manager', 'tic_tax_reporting',
    'dst_sin_1', 'dst_sin_2', 'dst_sin_3', 'dst_sin_4', 'dst_sin_5',
    'dst_sin_6', 'dst_sin_7', 'dst_master_lease', 'dst_springing_llc'
  ];
  allComplianceInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => { /* deferred */ });
      el.addEventListener('input', () => { /* deferred */ });
    }
  });
});

function updateComplianceModuleVisibility() {
  const dealType = document.getElementById('deal_type')?.value || 'operating_llc';

  const reitSec = document.getElementById('reit_compliance_section');
  const ozSec = document.getElementById('oz_compliance_section');
  const ticSec = document.getElementById('tic_compliance_section');
  const dstSec = document.getElementById('dst_compliance_section');
  const noMod = document.getElementById('compliance_no_module');

  const isREIT = ['reit_private', 'reit_public', 'upreit', 'downreit'].includes(dealType);
  const isOZ = ['qof', 'qozb'].includes(dealType);
  const isTIC = dealType === 'tic';
  const isDST = dealType === 'dst';
  const showAny = isREIT || isOZ || isTIC || isDST;

  if (reitSec) reitSec.style.display = isREIT ? 'block' : 'none';
  if (ozSec) ozSec.style.display = isOZ ? 'block' : 'none';
  if (ticSec) ticSec.style.display = isTIC ? 'block' : 'none';
  if (dstSec) dstSec.style.display = isDST ? 'block' : 'none';
  if (noMod) noMod.style.display = showAny ? 'none' : 'block';

  // For OZ: hide QOF or QOZB block when not relevant
  const qofBlock = document.getElementById('qof_compliance_block');
  const qozbBlock = document.getElementById('qozb_compliance_block');
  if (qofBlock) qofBlock.style.display = dealType === 'qof' ? 'block' : 'none';
  if (qozbBlock) qozbBlock.style.display = dealType === 'qozb' || dealType === 'qof' ? 'block' : 'none';
}

// =============================================================================
// COLLECT PHASE 4 DATA
// =============================================================================
function collectPhase4Data() {
  const v = id => { const el = document.getElementById(id); if (!el) return ''; return String(el.value).replace(/[$,\s%]/g, '').trim(); };
  const c = id => { const el = document.getElementById(id); return el ? el.checked : false; };
  const n = id => parseFloat(v(id)) || 0;
  const pct = id => n(id) / 100;

  return {
    // REIT
    reit: {
      numShareholders: n('reit_num_shareholders'),
      top5Ownership: pct('reit_top5_ownership'),
      reIncomePct: pct('reit_re_income_pct'),
      otherPassiveIncomePct: pct('reit_other_passive_income_pct'),
      reAssetsPct: pct('reit_re_assets_pct'),
      trsPct: pct('reit_trs_pct'),
      largestIssuerPct: pct('reit_largest_issuer_pct'),
      distributionPct: pct('reit_distribution_pct')
    },
    // OZ
    oz: {
      qof90Pct: pct('qof_90_pct'),
      qofForm8996: v('qof_form_8996'),
      qozb70Pct: pct('qozb_70_pct'),
      qozbActiveIncomePct: pct('qozb_active_income_pct'),
      qozbWcsh: v('qozb_wcsh'),
      qozbSubImprovement: v('qozb_sub_improvement'),
      qozbSinBusiness: v('qozb_sin_business'),
      qofInvestorHold: v('qof_investor_hold')
    },
    // TIC
    tic: {
      cotenants: n('tic_cotenants'),
      largestInterest: pct('tic_largest_interest'),
      unanimous: v('tic_unanimous') === 'yes',
      feeInterest: v('tic_fee_interest') === 'yes',
      proportionate: v('tic_proportionate') === 'yes',
      debt: v('tic_debt'),
      manager: v('tic_manager'),
      taxReporting: v('tic_tax_reporting')
    },
    // DST
    dst: {
      sin1: c('dst_sin_1'),
      sin2: c('dst_sin_2'),
      sin3: c('dst_sin_3'),
      sin4: c('dst_sin_4'),
      sin5: c('dst_sin_5'),
      sin6: c('dst_sin_6'),
      sin7: c('dst_sin_7'),
      masterLease: v('dst_master_lease') === 'yes',
      springingLLC: v('dst_springing_llc') === 'yes'
    }
  };
}

// =============================================================================
// REIT COMPLIANCE ENGINE — § 856 et seq.
// =============================================================================
//
// Runs the full battery of REIT compliance tests:
//   1. § 856(a)(5) 100-shareholder rule
//   2. § 856(h) 5/50 closely-held test
//   3. § 856(c)(2) 95% gross income test
//   4. § 856(c)(3) 75% gross income test
//   5. § 856(c)(4)(A) 75% asset test
//   6. § 856(c)(4)(B)(ii) TRS 20% limit
//   7. § 856(c)(4)(B)(iii)(I) 5% single issuer
//   8. § 857(a)(1) 90% distribution requirement
// =============================================================================
function runREITCompliance(data, p4Data) {
  const r = p4Data.reit;
  const tests = [];

  // Test 1: 100-shareholder rule
  tests.push({
    name: '100-Shareholder Rule',
    cite: '§ 856(a)(5)',
    actual: r.numShareholders,
    actualLabel: 'Owners',
    threshold: 100,
    thresholdLabel: 'Min',
    status: r.numShareholders >= 100 ? 'pass' : 'fail',
    detail: r.numShareholders >= 100 ?
      `${r.numShareholders} beneficial owners satisfies the 100-shareholder minimum.` :
      `Only ${r.numShareholders} owners — below the 100 required for a REIT. Demand-redemption preferred class is the standard accommodation for private REITs.`
  });

  // Test 2: 5/50 closely-held test
  tests.push({
    name: '5/50 Closely-Held Test',
    cite: '§ 856(h)(1)',
    actual: fmtPct(r.top5Ownership, 1),
    actualLabel: 'Top 5',
    threshold: '< 50%',
    thresholdLabel: 'Max',
    status: r.top5Ownership <= 0.50 ? 'pass' : 'fail',
    detail: r.top5Ownership <= 0.50 ?
      `Top 5 individuals hold ${fmtPct(r.top5Ownership, 1)} — within the 50% closely-held ceiling.` :
      `Top 5 individuals hold ${fmtPct(r.top5Ownership, 1)} — EXCEEDS 50%. REIT status fails this test. Apply § 544 constructive ownership rules carefully; family attribution may push concentration higher than apparent.`
  });

  // Test 3: 95% gross income test
  const totalQualifyingFor95 = r.reIncomePct + r.otherPassiveIncomePct;
  tests.push({
    name: '95% Gross Income Test',
    cite: '§ 856(c)(2)',
    actual: fmtPct(totalQualifyingFor95, 1),
    actualLabel: 'Qualifying',
    threshold: '≥ 95%',
    thresholdLabel: 'Min',
    status: totalQualifyingFor95 >= 0.95 ? 'pass' : (totalQualifyingFor95 >= 0.90 ? 'warn' : 'fail'),
    detail: totalQualifyingFor95 >= 0.95 ?
      `${fmtPct(totalQualifyingFor95, 1)} qualifying income — exceeds 95% threshold.` :
      `${fmtPct(totalQualifyingFor95, 1)} qualifying — BELOW 95%. Non-qualifying income includes operating income from services, gain from sale of dealer property, and most income from a TRS (which is taxed at corp rate). Cure provisions under § 856(c)(6) provide relief with reasonable cause.`
  });

  // Test 4: 75% gross income test
  tests.push({
    name: '75% Gross Income Test',
    cite: '§ 856(c)(3)',
    actual: fmtPct(r.reIncomePct, 1),
    actualLabel: 'Real Estate',
    threshold: '≥ 75%',
    thresholdLabel: 'Min',
    status: r.reIncomePct >= 0.75 ? 'pass' : (r.reIncomePct >= 0.70 ? 'warn' : 'fail'),
    detail: r.reIncomePct >= 0.75 ?
      `${fmtPct(r.reIncomePct, 1)} from real estate sources — exceeds 75% threshold.` :
      `${fmtPct(r.reIncomePct, 1)} from real estate sources — BELOW 75%. Only true real estate income qualifies (rents from real property under § 856(d), mortgage interest secured by real property, gain on sale of real property not held primarily for sale, etc.).`
  });

  // Test 5: 75% asset test
  tests.push({
    name: '75% Asset Test',
    cite: '§ 856(c)(4)(A)',
    actual: fmtPct(r.reAssetsPct, 1),
    actualLabel: 'Real Estate',
    threshold: '≥ 75%',
    thresholdLabel: 'Min',
    status: r.reAssetsPct >= 0.75 ? 'pass' : (r.reAssetsPct >= 0.70 ? 'warn' : 'fail'),
    detail: r.reAssetsPct >= 0.75 ?
      `${fmtPct(r.reAssetsPct, 1)} of asset value in real estate, cash, and government securities — meets 75% test.` :
      `Only ${fmtPct(r.reAssetsPct, 1)} of asset value in qualifying assets — fails 75% asset test. Measured quarterly under § 856(c)(4).`
  });

  // Test 6: TRS 20% limit
  tests.push({
    name: 'TRS Asset Limit',
    cite: '§ 856(c)(4)(B)(ii)',
    actual: fmtPct(r.trsPct, 1),
    actualLabel: 'TRS',
    threshold: '≤ 20%',
    thresholdLabel: 'Max',
    status: r.trsPct <= 0.20 ? 'pass' : (r.trsPct <= 0.25 ? 'warn' : 'fail'),
    detail: r.trsPct <= 0.20 ?
      `TRS holdings at ${fmtPct(r.trsPct, 1)} — within 20% limit. (Reduced from 25% by TCJA effective 1/1/2018.)` :
      `TRS holdings at ${fmtPct(r.trsPct, 1)} — EXCEEDS 20% TCJA-era ceiling. REIT status threatened.`
  });

  // Test 7: 5% single issuer
  tests.push({
    name: 'Largest Single Issuer',
    cite: '§ 856(c)(4)(B)(iii)(I)',
    actual: fmtPct(r.largestIssuerPct, 1),
    actualLabel: 'Largest',
    threshold: '≤ 5%',
    thresholdLabel: 'Max',
    status: r.largestIssuerPct <= 0.05 ? 'pass' : 'fail',
    detail: r.largestIssuerPct <= 0.05 ?
      `Largest single issuer at ${fmtPct(r.largestIssuerPct, 1)} — within 5% limit.` :
      `Largest single issuer at ${fmtPct(r.largestIssuerPct, 1)} — EXCEEDS 5%. Note: real estate assets, government securities, and TRS securities are tested separately and not subject to this 5% cap.`
  });

  // Test 8: 90% distribution requirement
  tests.push({
    name: '90% Distribution Requirement',
    cite: '§ 857(a)(1)(A)',
    actual: fmtPct(r.distributionPct, 1),
    actualLabel: 'Distrib',
    threshold: '≥ 90%',
    thresholdLabel: 'Min',
    status: r.distributionPct >= 0.90 ? 'pass' : 'fail',
    detail: r.distributionPct >= 0.90 ?
      (r.distributionPct >= 1.00 ?
        `Distributing 100%+ of REIT taxable income — meets the 90% test and avoids the § 4981 excise tax on undistributed amounts.` :
        `Distributing ${fmtPct(r.distributionPct, 1)} — meets 90% test. Undistributed amount subject to § 4981 4% excise tax.`) :
      `Distributing only ${fmtPct(r.distributionPct, 1)} — BELOW 90%. REIT status lost. Must distribute 90% of REIT taxable income (excluding net capital gain) to maintain REIT status.`
  });

  // Aggregate status
  const failures = tests.filter(t => t.status === 'fail').length;
  const warnings = tests.filter(t => t.status === 'warn').length;
  let overallStatus = 'pass', overallLabel = 'REIT QUALIFIED';
  if (failures > 0) { overallStatus = 'fail'; overallLabel = `REIT STATUS THREATENED (${failures} ${failures === 1 ? 'failure' : 'failures'})`; }
  else if (warnings > 0) { overallStatus = 'warn'; overallLabel = `${warnings} ITEM${warnings === 1 ? '' : 'S'} AT RISK`; }

  const notes = [];
  if (failures > 0) {
    notes.push({ type: 'critical', text: 'One or more compliance tests failed. REIT status is at risk. Cure provisions under § 856(c)(6) and § 856(g) provide relief with reasonable cause and disclosure on Form 8275; engage Donovan Legal to evaluate.' });
  }
  if (r.trsPct > 0.15 && r.trsPct <= 0.20) {
    notes.push({ type: 'warn', text: 'TRS holdings approach the 20% limit. Monitor quarterly; consider operating activities directly through the REIT where they qualify, or via independent contractors.' });
  }
  if (data.dealType === 'upreit') {
    notes.push({ type: 'info', text: 'UPREIT structure: REIT operates through an Operating Partnership. Income/asset tests applied at REIT level after Operating Partnership look-through under § 856(c)(7). Property contributions to the OP are tax-deferred under § 721; OP units convertible to REIT shares (taxable). §704(c) layers on contributed property (Phase II).' });
  }

  return { tests, overallStatus, overallLabel, notes };
}

// =============================================================================
// OPPORTUNITY ZONE COMPLIANCE — § 1400Z-2
// =============================================================================
function runOZCompliance(data, p4Data) {
  const o = p4Data.oz;
  const tests = [];
  const isQOF = data.dealType === 'qof';
  const isQOZB = data.dealType === 'qozb';

  // QOF Tests (applies if QOF)
  if (isQOF || isQOZB) {
    // 90% asset test (QOF level)
    tests.push({
      name: 'QOF 90% Asset Test',
      cite: '§ 1400Z-2(d)(1)',
      actual: fmtPct(o.qof90Pct, 1),
      actualLabel: 'QOZ Assets',
      threshold: '≥ 90%',
      thresholdLabel: 'Min',
      status: o.qof90Pct >= 0.90 ? 'pass' : (o.qof90Pct >= 0.85 ? 'warn' : 'fail'),
      detail: o.qof90Pct >= 0.90 ?
        `${fmtPct(o.qof90Pct, 1)} of QOF assets in QOZ property — passes 90% test. Measured semi-annually (June 30 and December 31), averaged.` :
        `${fmtPct(o.qof90Pct, 1)} in QOZ property — BELOW 90%. Failure triggers monthly penalty under § 1400Z-2(f) equal to the deficit times the underpayment rate. Reasonable cause exception under Reg. § 1.1400Z2(d)-1(a)(4).`
    });

    // Form 8996 filed
    tests.push({
      name: 'Form 8996 Election',
      cite: 'Reg. § 1.1400Z2(d)-1(a)(2)',
      actual: o.qofForm8996 === 'yes' ? 'Filed' : (o.qofForm8996 === 'planned' ? 'Planned' : 'Not Filed'),
      actualLabel: 'Status',
      threshold: 'Required',
      thresholdLabel: 'Min',
      status: o.qofForm8996 === 'yes' ? 'pass' : (o.qofForm8996 === 'planned' ? 'warn' : 'fail'),
      detail: 'Form 8996 must be attached to the federal tax return for each year the entity is a QOF. Self-certification with no advance IRS approval.'
    });
  }

  // QOZB Tests (applies if QOF or QOZB)
  if (isQOF || isQOZB) {
    tests.push({
      name: 'QOZB 70% Tangible Property Test',
      cite: '§ 1400Z-2(d)(3)(A)(i)',
      actual: fmtPct(o.qozb70Pct, 1),
      actualLabel: 'In QOZ',
      threshold: '≥ 70%',
      thresholdLabel: 'Min',
      status: o.qozb70Pct >= 0.70 ? 'pass' : (o.qozb70Pct >= 0.65 ? 'warn' : 'fail'),
      detail: o.qozb70Pct >= 0.70 ?
        `${fmtPct(o.qozb70Pct, 1)} of tangible property in QOZ — passes 70% threshold.` :
        `${fmtPct(o.qozb70Pct, 1)} — BELOW 70%. "Substantially all" of tangible property in trade or business must be QOZ business property.`
    });

    tests.push({
      name: '50% Active Conduct Gross Income Test',
      cite: '§ 1400Z-2(d)(3)(A)(ii)',
      actual: fmtPct(o.qozbActiveIncomePct, 1),
      actualLabel: 'Active QOZ',
      threshold: '≥ 50%',
      thresholdLabel: 'Min',
      status: o.qozbActiveIncomePct >= 0.50 ? 'pass' : 'fail',
      detail: o.qozbActiveIncomePct >= 0.50 ?
        `${fmtPct(o.qozbActiveIncomePct, 1)} from active conduct of trade or business in QOZ — meets 50% threshold.` :
        `${fmtPct(o.qozbActiveIncomePct, 1)} — BELOW 50%. Three safe harbors under Reg. § 1.1400Z2(d)-1(d)(3)(ii): (i) 50% of services hours, (ii) 50% of services compensation, or (iii) management and operations functions plus tangible property necessary to generate 50% of gross income.`
    });

    // Working capital safe harbor
    tests.push({
      name: 'Working Capital Safe Harbor',
      cite: '§ 1400Z-2(d)(3)(A)(v)',
      actual: o.qozbWcsh === 'yes' ? '31-mo Plan' : (o.qozbWcsh === 'extended' ? '62-mo Plan' : 'None'),
      actualLabel: 'Status',
      threshold: 'Recommended',
      thresholdLabel: 'Min',
      status: o.qozbWcsh === 'yes' || o.qozbWcsh === 'extended' ? 'pass' : 'warn',
      detail: o.qozbWcsh !== 'no' ?
        'Cash held under written plan with quarterly schedule treated as held in QOZ. Critical for construction/development deals where capital is deployed over time.' :
        'No WCSH in place. Cash on hand likely fails the 70% tangible property test — restructure to add a written plan with quarterly schedule under Reg. § 1.1400Z2(d)-1(d)(3)(v).'
    });

    // Substantial improvement
    tests.push({
      name: 'Substantial Improvement / Original Use',
      cite: '§ 1400Z-2(d)(2)(D)(ii)',
      actual: o.qozbSubImprovement === 'met' ? 'Met' :
              o.qozbSubImprovement === 'planned' ? 'Planned' :
              o.qozbSubImprovement === 'not_required' ? 'N/A' : 'Failed',
      actualLabel: 'Status',
      threshold: 'Required',
      thresholdLabel: 'Min',
      status: o.qozbSubImprovement === 'met' || o.qozbSubImprovement === 'not_required' ? 'pass' :
              o.qozbSubImprovement === 'planned' ? 'warn' : 'fail',
      detail: 'If not "original use," additions to basis during any 30-month period must equal or exceed the property\'s adjusted basis at start of period. Land excluded from basis comparison under final regs.'
    });

    // Sin business
    tests.push({
      name: 'Sin Business Exclusion',
      cite: '§ 1400Z-2(d)(3)(A)(iii); § 144(c)(6)(B)',
      actual: o.qozbSinBusiness === 'no' ? 'Compliant' : 'Sin Business',
      actualLabel: 'Status',
      threshold: 'Not Sin',
      thresholdLabel: 'Min',
      status: o.qozbSinBusiness === 'no' ? 'pass' : 'fail',
      detail: o.qozbSinBusiness === 'no' ?
        'Business does not fall within the excluded categories.' :
        'BUSINESS DISQUALIFIED. Sin business categories: golf course, country club, massage parlor, hot tub facility, sun-tan facility, racetrack or other gambling facility, liquor store.'
    });
  }

  // Investor benefit identification
  const holdLabels = {
    'lt_5': '< 5 years (only deferral, expired)',
    '5_to_7': '5-7 years (10% step-up vintage)',
    '7_to_10': '7-10 years (additional 5% step-up vintage)',
    '10_plus': '10+ years (full exclusion of post-investment gain)'
  };
  tests.push({
    name: 'Investor Benefit Tier',
    cite: '§ 1400Z-2(b), (c)',
    actual: holdLabels[o.qofInvestorHold] || o.qofInvestorHold,
    actualLabel: 'Hold',
    threshold: '10+ yrs',
    thresholdLabel: 'Best',
    status: o.qofInvestorHold === '10_plus' ? 'pass' : 'info',
    detail: o.qofInvestorHold === '10_plus' ?
      'Investor will qualify for full exclusion of post-investment gain on disposition of QOF interest under § 1400Z-2(c). This is the dominant remaining OZ benefit.' :
      'Shorter holds receive only the now-historical step-ups (5-year 10%, 7-year additional 5%, both predicated on pre-2027 deferrals which are largely past) and deferral until earlier of 12/31/2026 (date now passed) or disposition. The 10-year benefit is the only remaining substantive benefit.'
  });

  // Aggregate
  const failures = tests.filter(t => t.status === 'fail').length;
  const warnings = tests.filter(t => t.status === 'warn').length;
  let overallStatus = 'pass', overallLabel = 'OZ COMPLIANT';
  if (failures > 0) { overallStatus = 'fail'; overallLabel = `OZ STATUS AT RISK (${failures} ${failures === 1 ? 'failure' : 'failures'})`; }
  else if (warnings > 0) { overallStatus = 'warn'; overallLabel = `${warnings} ITEM${warnings === 1 ? '' : 'S'} AT RISK`; }

  const notes = [];
  if (o.qof90Pct < 0.90 && (isQOF || isQOZB)) {
    notes.push({ type: 'critical', text: '90% asset test failed. Monthly penalty under § 1400Z-2(f) accrues until cured. Reasonable cause exception requires showing the failure was beyond the entity\'s control and was promptly cured.' });
  }
  if (o.qozbWcsh === 'no' && data.budget && data.budget.hard > 0) {
    notes.push({ type: 'warn', text: 'Construction deal without working capital safe harbor: cash deployed for construction over time will fail the QOZB 70% tangible property test as it remains uninvested. Adopt a 31-month (or 62-month) written plan with quarterly schedule.' });
  }
  notes.push({ type: 'info', text: 'Note: the 12/31/2026 deferral deadline has passed. New deferrals are no longer available under existing law unless extended by Congress. The 10-year exclusion benefit remains available for QOF interests acquired with previously-deferred gain.' });

  return { tests, overallStatus, overallLabel, notes };
}

// =============================================================================
// TIC COMPLIANCE — Rev. Proc. 2002-22
// =============================================================================
function runTICCompliance(data, p4Data) {
  const t = p4Data.tic;
  const tests = [];

  tests.push({
    name: 'Co-Tenant Maximum (35)',
    cite: 'Rev. Proc. 2002-22, § 6.01',
    actual: t.cotenants,
    actualLabel: 'Count',
    threshold: '≤ 35',
    thresholdLabel: 'Max',
    status: t.cotenants <= 15 ? 'pass' : (t.cotenants <= 35 ? 'warn' : 'fail'),
    detail: t.cotenants <= 15 ?
      `${t.cotenants} co-tenants — within practitioner-preferred 15-co-tenant safety zone.` :
      t.cotenants <= 35 ?
        `${t.cotenants} co-tenants — within Rev. Proc. ceiling but exceeds practitioner-preferred 15. Increased risk of partnership reclassification challenge.` :
        `${t.cotenants} co-tenants — EXCEEDS 35-co-tenant Rev. Proc. limit.`
  });

  tests.push({
    name: 'Undivided Fee Interest',
    cite: 'Rev. Proc. 2002-22, § 6.02',
    actual: t.feeInterest ? 'Compliant' : 'Violated',
    actualLabel: 'Status',
    threshold: 'Required',
    thresholdLabel: 'Min',
    status: t.feeInterest ? 'pass' : 'fail',
    detail: t.feeInterest ?
      'Each co-tenant holds title as tenant-in-common under local law.' :
      'FATAL: holding through an entity defeats TIC characterization. The arrangement is treated as a partnership.'
  });

  tests.push({
    name: 'Unanimous Vote on Major Decisions',
    cite: 'Rev. Proc. 2002-22, § 6.05',
    actual: t.unanimous ? 'Required' : 'Not Required',
    actualLabel: 'Vote',
    threshold: 'Unanimous',
    thresholdLabel: 'Min',
    status: t.unanimous ? 'pass' : 'fail',
    detail: t.unanimous ?
      'Sale, leasing of substantially all of the property, financing, refinancing, and litigation require unanimous co-tenant approval.' :
      'FATAL: less-than-unanimous decisions on major matters indicate a partnership-like structure. TIC characterization destroyed.'
  });

  tests.push({
    name: 'Proportionate Sharing',
    cite: 'Rev. Proc. 2002-22, § 6.06',
    actual: t.proportionate ? 'Pro Rata' : 'Special',
    actualLabel: 'Allocation',
    threshold: 'Pro Rata',
    thresholdLabel: 'Min',
    status: t.proportionate ? 'pass' : 'fail',
    detail: t.proportionate ?
      'Income, expenses, and capital expenditures shared pro rata to undivided fractional interests.' :
      'FATAL: special allocations or waterfall structures are inconsistent with TIC. Treat as partnership.'
  });

  tests.push({
    name: 'Debt Structure',
    cite: 'Rev. Proc. 2002-22, § 6.12',
    actual: t.debt === 'separate_recourse' ? 'Separate' :
            t.debt === 'joint_and_several' ? 'Joint/Several' : 'Partnership',
    actualLabel: 'Liability',
    threshold: 'Several',
    thresholdLabel: 'Min',
    status: t.debt === 'separate_recourse' ? 'pass' :
            t.debt === 'joint_and_several' ? 'warn' : 'fail',
    detail: t.debt === 'separate_recourse' ?
      'Each co-tenant separately liable for proportionate share of debt.' :
      t.debt === 'joint_and_several' ?
        'Joint and several liability is the commercial-lender norm but violates Rev. Proc. 2002-22 (literally) § 6.12. Practitioners frequently accept this tension; obtain Service ruling or document the divergence and reliance on substance.' :
        'FATAL: partnership-form debt indicates the arrangement is a partnership in substance.'
  });

  tests.push({
    name: 'Manager Arrangement',
    cite: 'Rev. Proc. 2002-22, § 6.07-6.10',
    actual: t.manager === 'independent_lease' ? 'Triple-Net' :
            t.manager === 'separate_managers' ? 'Separate' : 'Co-Tenant',
    actualLabel: 'Manager',
    threshold: 'Arms-Length',
    thresholdLabel: 'Min',
    status: t.manager === 'independent_lease' ? 'pass' :
            t.manager === 'separate_managers' ? 'pass' : 'fail',
    detail: t.manager === 'independent_lease' ?
      'Property leased to single arm\'s-length operator under triple-net lease — classic TIC structure.' :
      t.manager === 'separate_managers' ?
        'Each co-tenant independently manages its share. Acceptable but unusual.' :
        'PROBLEMATIC: a co-tenant managing on behalf of others indicates business activity inconsistent with TIC. Restructure.'
  });

  tests.push({
    name: 'Tax Reporting Method',
    cite: 'Rev. Proc. 2002-22, § 6.04',
    actual: t.taxReporting === 'separate' ? 'Schedule E' : 'Form 1065',
    actualLabel: 'Form',
    threshold: 'Schedule E',
    thresholdLabel: 'Min',
    status: t.taxReporting === 'separate' ? 'pass' : 'fail',
    detail: t.taxReporting === 'separate' ?
      'Each co-tenant reports its share separately. Consistent with TIC.' :
      'FATAL: filing Form 1065 admits partnership status. TIC treatment lost.'
  });

  tests.push({
    name: 'Largest Co-Tenant Concentration',
    cite: 'Best Practice',
    actual: fmtPct(t.largestInterest, 1),
    actualLabel: 'Largest',
    threshold: '< 50%',
    thresholdLabel: 'Soft',
    status: t.largestInterest < 0.50 ? 'pass' : 'warn',
    detail: t.largestInterest < 0.50 ?
      'Largest co-tenant under 50% — no concentration concern.' :
      'Largest co-tenant ≥ 50% — concentration may invite a "partnership in substance" challenge despite formal compliance. Document arm\'s-length terms.'
  });

  const failures = tests.filter(t => t.status === 'fail').length;
  const warnings = tests.filter(t => t.status === 'warn').length;
  let overallStatus = 'pass', overallLabel = 'TIC COMPLIANT — Rev. Proc. 2002-22';
  if (failures > 0) { overallStatus = 'fail'; overallLabel = `TIC FAILED (${failures} fatal violation${failures === 1 ? '' : 's'})`; }
  else if (warnings > 0) { overallStatus = 'warn'; overallLabel = `${warnings} ITEM${warnings === 1 ? '' : 'S'} AT RISK`; }

  const notes = [];
  if (failures > 0) {
    notes.push({ type: 'critical', text: 'TIC structure compromised by one or more fatal violations. The arrangement will likely be reclassified as a partnership, defeating § 1031 eligibility and triggering Form 1065 filing. Restructure before closing or accept partnership treatment.' });
  }
  if (t.debt === 'joint_and_several') {
    notes.push({ type: 'warn', text: 'Joint and several debt vs. Rev. Proc. § 6.12: many commercial TIC structures live with this divergence. The Service has not commonly challenged on this point where the substance otherwise matches Rev. Proc. 2002-22. Document the lender requirement and the co-tenants\' actual proportionate economic obligation.' });
  }
  notes.push({ type: 'info', text: 'Rev. Proc. 2002-22 is a "safe harbor" guidance, not a binding ruling. The Service may still challenge a TIC arrangement on substance even where the safe harbor is satisfied. Conversely, a TIC may still qualify even where one or more conditions deviate, based on facts and circumstances.' });

  return { tests, overallStatus, overallLabel, notes };
}

// =============================================================================
// DST COMPLIANCE — Rev. Rul. 2004-86 Seven Deadly Sins
// =============================================================================
function runDSTCompliance(data, p4Data) {
  const d = p4Data.dst;
  const tests = [];

  const sins = [
    { num: 1, key: 'sin1', name: 'No New Beneficial Owners', detail: 'Once the offering closes, no additional investors may be admitted to the trust.' },
    { num: 2, key: 'sin2', name: 'No Debt Refinancing', detail: 'The original financing cannot be refinanced; structural debt is fixed at closing.' },
    { num: 3, key: 'sin3', name: 'No Debt Prepayment (except from sale)', detail: 'Debt paydown permitted only from disposition proceeds.' },
    { num: 4, key: 'sin4', name: 'No Reinvestment of Proceeds', detail: 'Sale proceeds must be distributed; no rollover into new property.' },
    { num: 5, key: 'sin5', name: 'No TI Beyond Normal Repairs', detail: 'Only routine maintenance permitted; capital improvements and substantial TI prohibited.' },
    { num: 6, key: 'sin6', name: 'No New Leases (except market triple-net)', detail: 'Existing leases run their term; replacement leases must be market-rate triple-net.' },
    { num: 7, key: 'sin7', name: 'Limited Short-Term Cash', detail: 'Reserves limited to operating necessity; no investment portfolio at trust level.' }
  ];

  for (const sin of sins) {
    const compliant = d[sin.key];
    tests.push({
      name: `Sin ${sin.num}: ${sin.name}`,
      cite: 'Rev. Rul. 2004-86',
      actual: compliant ? 'Compliant' : 'VIOLATED',
      actualLabel: 'Status',
      threshold: 'Required',
      thresholdLabel: 'Min',
      status: compliant ? 'pass' : 'fail',
      detail: sin.detail
    });
  }

  // Master Lease / DST 2.0
  if (d.masterLease) {
    tests.push({
      name: 'DST 2.0 Master Lease Structure',
      cite: 'Practice',
      actual: 'In Place',
      actualLabel: 'Structure',
      threshold: 'Optional',
      thresholdLabel: 'Type',
      status: 'info',
      detail: 'Affiliated Master Tenant leases the property from the DST. Operational changes occur at the master-tenant level, mitigating practical tension with Sins 5 and 6.'
    });
  }

  // Springing LLC
  if (d.springingLLC) {
    tests.push({
      name: 'Springing LLC Provision',
      cite: 'Trust Agreement',
      actual: 'In Place',
      actualLabel: 'Provision',
      threshold: 'Optional',
      thresholdLabel: 'Type',
      status: 'info',
      detail: 'On a triggering event (e.g., lender refinance demand, default), the trustee may convert the DST into an LLC. The conversion exits Rev. Rul. 2004-86 compliance but preserves the property — accept partnership classification post-conversion.'
    });
  }

  const failures = tests.filter(t => t.status === 'fail').length;
  let overallStatus = 'pass', overallLabel = 'DST COMPLIANT — Rev. Rul. 2004-86';
  if (failures > 0) { overallStatus = 'fail'; overallLabel = `DST RECLASSIFICATION RISK (${failures} ${failures === 1 ? 'violation' : 'violations'})`; }

  const notes = [];
  if (failures > 0) {
    notes.push({ type: 'critical', text: 'One or more of the Seven Deadly Sins violated. The trust is at risk of reclassification as a business entity (partnership), defeating § 1031 eligibility for inbound exchanges. Any § 1031 exchange completed using a beneficial interest in the affected DST may be disturbed retroactively. Engage Donovan Legal to evaluate and address.' });
  }
  if (!d.masterLease) {
    notes.push({ type: 'info', text: 'Pure pass-through DST structure (no master lease). All operational decisions must be made by the property\'s tenant under existing leases; the trustee has only "ministerial" authority. Suitable for stabilized triple-net assets with credit tenants. Less suitable for value-add or operating-intensive properties.' });
  }
  if (!d.springingLLC) {
    notes.push({ type: 'warn', text: 'No springing-LLC provision. On a triggering event requiring action beyond Rev. Rul. 2004-86 authority, the trust is structurally stuck. Strongly recommend adding a springing-LLC provision before closing.' });
  }

  return { tests, overallStatus, overallLabel, notes };
}

// =============================================================================
// COMPLIANCE DASHBOARD DISPATCHER
// =============================================================================
function runComplianceDashboard(data, p4Data) {
  if (['reit_private', 'reit_public', 'upreit', 'downreit'].includes(data.dealType)) {
    return { type: 'reit', label: 'REIT Compliance — § 856 et seq.', ...runREITCompliance(data, p4Data) };
  }
  if (data.dealType === 'qof' || data.dealType === 'qozb') {
    return { type: 'oz', label: 'Opportunity Zone Compliance — § 1400Z-2', ...runOZCompliance(data, p4Data) };
  }
  if (data.dealType === 'tic') {
    return { type: 'tic', label: 'TIC Compliance — Rev. Proc. 2002-22', ...runTICCompliance(data, p4Data) };
  }
  if (data.dealType === 'dst') {
    return { type: 'dst', label: 'DST Compliance — Rev. Rul. 2004-86', ...runDSTCompliance(data, p4Data) };
  }
  return null;
}

// =============================================================================
// RENDERER — Compliance Dashboard
// =============================================================================
function renderComplianceDashboard(results) {
  const target = document.getElementById('compliance_dashboard_wrap');
  if (!target) return;
  const cd = results.compliance;
  if (!cd) {
    target.innerHTML = '<p class="db-help-block" style="margin:0;">No specialized compliance regime applies to the selected deal type. Compliance dashboard is shown for REIT, Opportunity Zone, TIC, and DST structures only.</p>';
    return;
  }

  let html = `<div class="compliance-dashboard">
    <div class="cd-header">
      <div class="cd-title">${escapeHtml(cd.label)}</div>
      <div class="cd-overall ${cd.overallStatus}">${escapeHtml(cd.overallLabel)}</div>
    </div>`;

  for (const t of cd.tests) {
    const statusLabel = t.status === 'pass' ? 'PASS' :
                       t.status === 'warn' ? 'AT RISK' :
                       t.status === 'fail' ? 'FAIL' :
                       t.status === 'info' ? 'NOTE' : 'N/A';
    html += `<div class="compliance-test">
      <div>
        <div class="ct-name">${escapeHtml(t.name)}</div>
        <div class="ct-cite">${escapeHtml(t.cite)}</div>
        <div class="ct-detail">${t.detail}</div>
      </div>
      <div>
        <div class="ct-actual-label">${escapeHtml(t.actualLabel)}</div>
        <div class="ct-actual">${typeof t.actual === 'string' ? escapeHtml(t.actual) : t.actual}</div>
      </div>
      <div>
        <div class="ct-threshold-label">${escapeHtml(t.thresholdLabel)}</div>
        <div class="ct-threshold">${typeof t.threshold === 'string' ? escapeHtml(t.threshold) : t.threshold}</div>
      </div>
      <div class="ct-status">
        <span class="ct-status-badge ${t.status}">${statusLabel}</span>
      </div>
    </div>`;
  }

  if (cd.notes && cd.notes.length > 0) {
    html += '<div class="cd-notes">';
    for (const n of cd.notes) {
      html += `<div class="note-item ${n.type}">${n.text}</div>`;
    }
    html += '</div>';
  }

  html += '</div>';
  target.innerHTML = html;
}

// =============================================================================
// EXTEND recomputeAll FOR PHASE 4
// =============================================================================
const _phase3RecomputeAll = recomputeAll;
recomputeAll = function() {
  const data = collectFormData();
  const allocData = collectAllocationData();
  const p3Data = collectPhase3Data();
  const p4Data = collectPhase4Data();
  const results = calculateDeal(data);
  results.sensitivity = calculateSensitivity(data);
  results.sec704c = calculate704cAggregate(data, allocData, results.years);
  results.rollForward = calculateCapitalAccountRollForward(data, results, allocData);
  results.sec754Analysis = analyze754(data, results, allocData, results.rollForward);
  results.firpta = analyzeFIRPTA(data, results, p3Data);
  results.ubti = analyzeUBTI(data, results, p3Data);
  results.blockerLeakage = analyzeBlockerLeakage(data, results, p3Data);
  results.recommendations = generateRecommendations(data, results, p3Data, results.firpta, results.ubti);
  results.compliance = runComplianceDashboard(data, p4Data);
  results.allocData = allocData;
  results.p3Data = p3Data;
  results.p4Data = p4Data;
  DB.lastResults = results;

  updateCapitalStackSummary();
  updateBudgetSummary(results);
  renderResults(results);
  renderSec704cComparison(results);
  renderCapitalAccountRollForward(results);
  renderSec754Analysis(results);
  renderFIRPTA(results);
  renderUBTI(results);
  renderBlockerLeakage(results);
  renderComplianceDashboard(results);
  renderRecommendations(results);
  renderInvestorProfiles();
  updateComplianceModuleVisibility();
};

// =============================================================================
// EXTEND SAVE/LOAD FOR PHASE 4
// =============================================================================
const _phase3SaveJSON = saveJSON;
saveJSON = function() {
  const data = collectFormData();
  const phase4Inputs = {};
  ['reit_num_shareholders','reit_top5_ownership','reit_re_income_pct',
   'reit_other_passive_income_pct','reit_re_assets_pct','reit_trs_pct',
   'reit_largest_issuer_pct','reit_distribution_pct',
   'qof_90_pct','qof_form_8996','qozb_70_pct','qozb_active_income_pct',
   'qozb_wcsh','qozb_sub_improvement','qozb_sin_business','qof_investor_hold',
   'tic_cotenants','tic_largest_interest','tic_unanimous','tic_fee_interest',
   'tic_proportionate','tic_debt','tic_manager','tic_tax_reporting',
   'dst_master_lease','dst_springing_llc'].forEach(id => {
    const el = document.getElementById(id);
    if (el) phase4Inputs[id] = el.value;
  });
  const phase4Checkboxes = {};
  ['dst_sin_1','dst_sin_2','dst_sin_3','dst_sin_4','dst_sin_5','dst_sin_6','dst_sin_7'].forEach(id => {
    const el = document.getElementById(id);
    if (el) phase4Checkboxes[id] = el.checked;
  });
  phase4Inputs.checkboxes = phase4Checkboxes;

  const payload = {
    version: 'phase-4',
    savedAt: new Date().toISOString(),
    state: {
      memberClasses: DB.memberClasses,
      memberDebt: DB.memberDebt,
      promoteTiers: DB.promoteTiers,
      sec704cLayers: DB.sec704cLayers,
      blockers: DB.blockers,
      investorProfiles: DB.investorProfiles,
      nextMemberId: DB.nextMemberId,
      nextDebtId: DB.nextDebtId,
      nextTierId: DB.nextTierId,
      nextLayerId: DB.nextLayerId,
      nextBlockerId: DB.nextBlockerId
    },
    formInputs: collectFormInputsForSave(),
    allocationInputs: {
      alloc_704b_method: document.getElementById('alloc_704b_method')?.value,
      alloc_capacct_maintenance: document.getElementById('alloc_capacct_maintenance')?.value,
      alloc_min_gain_chargeback: document.getElementById('alloc_min_gain_chargeback')?.value,
      alloc_704c_present: document.getElementById('alloc_704c_present')?.value,
      alloc_704c_parallel: document.getElementById('alloc_704c_parallel')?.value,
      alloc_704c_method: document.getElementById('alloc_704c_method')?.value,
      alloc_754_election: document.getElementById('alloc_754_election')?.value,
      alloc_anticipated_transfer: document.getElementById('alloc_anticipated_transfer')?.value,
      cost_seg_pct: document.getElementById('cost_seg_pct')?.value,
      cost_seg_allocation_target: document.getElementById('cost_seg_allocation_target')?.value,
      checkboxes: {
        alloc_1245_recapture: document.getElementById('alloc_1245_recapture')?.checked,
        alloc_1250_unrecaptured: document.getElementById('alloc_1250_unrecaptured')?.checked,
        alloc_cost_seg_pickup: document.getElementById('alloc_cost_seg_pickup')?.checked,
        alloc_nonrecourse_deduction: document.getElementById('alloc_nonrecourse_deduction')?.checked
      },
      droClasses: Array.from(document.querySelectorAll('.dro-checkbox')).filter(cb => cb.checked).map(cb => parseInt(cb.dataset.id, 10))
    },
    phase3Inputs: {
      firpta_is_usrpi: document.getElementById('firpta_is_usrpi')?.value,
      firpta_usrphc_status: document.getElementById('firpta_usrphc_status')?.value,
      firpta_domestic_controlled: document.getElementById('firpta_domestic_controlled')?.value,
      firpta_disposition_amount: document.getElementById('firpta_disposition_amount')?.value,
      ubti_acq_indebtedness: document.getElementById('ubti_acq_indebtedness')?.value,
      ubti_debt_basis_ratio: document.getElementById('ubti_debt_basis_ratio')?.value
    },
    phase4Inputs
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (data.projectName || 'deal').replace(/[^a-zA-Z0-9-_]/g, '_');
  a.href = url;
  a.download = `${name}-deal-builder-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const _phase3LoadJSON = loadJSON;
loadJSON = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const payload = JSON.parse(e.target.result);
      DB.memberClasses = payload.state.memberClasses || [];
      DB.memberDebt = payload.state.memberDebt || [];
      DB.promoteTiers = payload.state.promoteTiers || [];
      DB.sec704cLayers = payload.state.sec704cLayers || [];
      DB.blockers = payload.state.blockers || [];
      DB.investorProfiles = payload.state.investorProfiles || {};
      DB.nextMemberId = payload.state.nextMemberId || DB.memberClasses.length + 1;
      DB.nextDebtId = payload.state.nextDebtId || DB.memberDebt.length + 1;
      DB.nextTierId = payload.state.nextTierId || DB.promoteTiers.length + 1;
      DB.nextLayerId = payload.state.nextLayerId || DB.sec704cLayers.length + 1;
      DB.nextBlockerId = payload.state.nextBlockerId || DB.blockers.length + 1;

      for (const [id, val] of Object.entries(payload.formInputs || {})) {
        if (id === 'checkboxes') continue;
        const el = document.getElementById(id);
        if (el) el.value = val;
      }
      if (payload.formInputs?.checkboxes) {
        for (const [id, val] of Object.entries(payload.formInputs.checkboxes)) {
          const el = document.getElementById(id);
          if (el) el.checked = val;
        }
      }
      if (payload.allocationInputs) {
        for (const [id, val] of Object.entries(payload.allocationInputs)) {
          if (id === 'checkboxes' || id === 'droClasses') continue;
          const el = document.getElementById(id);
          if (el) el.value = val;
        }
        if (payload.allocationInputs.checkboxes) {
          for (const [id, val] of Object.entries(payload.allocationInputs.checkboxes)) {
            const el = document.getElementById(id);
            if (el) el.checked = val;
          }
        }
      }
      if (payload.phase3Inputs) {
        for (const [id, val] of Object.entries(payload.phase3Inputs)) {
          const el = document.getElementById(id);
          if (el) el.value = val;
        }
      }
      if (payload.phase4Inputs) {
        for (const [id, val] of Object.entries(payload.phase4Inputs)) {
          if (id === 'checkboxes') continue;
          const el = document.getElementById(id);
          if (el) el.value = val;
        }
        if (payload.phase4Inputs.checkboxes) {
          for (const [id, val] of Object.entries(payload.phase4Inputs.checkboxes)) {
            const el = document.getElementById(id);
            if (el) el.checked = val;
          }
        }
      }

      renderMemberClasses();
      renderMemberDebt();
      renderPromoteTiers();
      renderSec704cLayers();
      renderInvestorProfiles();
      renderBlockers();
      renderStateSummary();
      updateComplianceModuleVisibility();
      document.getElementById('deal_type_help').innerHTML = DEAL_TYPES[document.getElementById('deal_type').value]?.help || '';
      document.getElementById('jurisdiction_help').innerHTML = JURISDICTION_HELP[document.getElementById('jurisdiction').value] || '';
      document.getElementById('senior_752_help').innerHTML = SEC752_HELP[document.getElementById('senior_752_class').value] || '';
      document.getElementById('alloc_704b_help').innerHTML = SEC704B_HELP[document.getElementById('alloc_704b_method').value] || '';
      const cbType = document.getElementById('clawback_type').value;
      document.getElementById('clawback_threshold_group').style.display = cbType !== 'none' ? 'grid' : 'none';
      document.getElementById('sec704c_layers_wrap').style.display = document.getElementById('alloc_704c_present').value === 'yes' ? 'block' : 'none';
      document.getElementById('dro_group').style.display = document.getElementById('alloc_704b_method').value === 'see_dro' ? 'block' : 'none';
      document.getElementById('cost_seg_alloc_group').style.display = document.getElementById('alloc_cost_seg_pickup').checked ? 'grid' : 'none';

      recomputeAll();
      alert(`Deal loaded: ${payload.formInputs?.project_name || 'unnamed'} (version: ${payload.version}, saved ${payload.savedAt})`);
    } catch (err) {
      alert('Error loading file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

document.addEventListener('DOMContentLoaded', () => {
  const loadInput = document.getElementById('load_json_input');
  if (loadInput) {
    const newInput = loadInput.cloneNode(true);
    loadInput.parentNode.replaceChild(newInput, loadInput);
    newInput.addEventListener('change', loadJSON);
  }
});



// =============================================================================
// =============================================================================
//                PHASE 5 — ORG CHART EDITOR (SVG + drag-and-drop)
//                           + DEAL MEMO PDF EXPORT
// =============================================================================
// =============================================================================

// Extend DB state for Phase 5
DB.orgChart = {
  nodes: [],         // { id, label, sub, type, jurisdiction, x, y, w, h, custom }
  edges: [],         // { id, fromId, toId, type ('ownership'|'debt'|'distribution'), label }
  positionOverrides: {}, // { nodeId: {x, y} } — user-dragged positions
  selectedId: null,
  nextNodeId: 1,
  nextEdgeId: 1
};

// SVG namespace
const SVG_NS = 'http://www.w3.org/2000/svg';

// =============================================================================
// AUTO-GENERATE ORG CHART FROM DEAL DATA
// =============================================================================
//
// Layout strategy:
//   Top tier:    Investor classes (LPs, sponsor, guarantors, foreign, tax-exempt)
//   Tier 2:      Blockers (if any) — interposed between investors and SPV
//   Tier 3:      SPV (the main entity)
//   Tier 4 (R):  Senior lender (off to the side)
//   Bottom:      Property
//
// Each member class becomes one node. Blockers become nodes that sit between
// their investors and the SPV. The SPV is centered. Lenders are off-axis.
// Property is at the bottom.
// =============================================================================
function autoGenerateOrgChart(data, p3Data) {
  const nodes = [];
  const edges = [];
  let nextId = 1;

  // SVG canvas dimensions (logical)
  const canvasW = 1100;
  const nodeW = 170;
  const nodeH = 56;
  const tierGap = 110;
  const nodeGap = 22;

  // Tier 1 — Investor nodes
  const investors = data.memberClasses || [];
  const investorNodes = [];
  const investorY = 20;
  // Compute total width needed
  const totalInvW = investors.length * nodeW + (investors.length - 1) * nodeGap;
  let cursorX = (canvasW - totalInvW) / 2;
  for (const cls of investors) {
    let nodeType = 'lp';
    let labelType = 'LP';
    if (cls.classType === 'sponsor') { nodeType = 'sponsor'; labelType = 'GP'; }
    else if (cls.classType === 'lp_guarantor') { nodeType = 'guarantor-lp'; labelType = 'A-2 LP'; }

    // Override based on tax profile if Phase 3 data exists
    const profile = p3Data?.investorProfiles?.[cls.id];
    if (profile) {
      const profileInfo = TAX_PROFILES[profile.profileType];
      if (profileInfo) {
        if (profileInfo.isForeign) nodeType = 'foreign';
        else if (profileInfo.isTaxExempt) nodeType = 'taxexempt';
      }
    }

    const n = {
      id: 'inv_' + cls.id,
      label: cls.name,
      sub: cls.capital > 0 ? fmt$(cls.capital) : labelType,
      type: nodeType,
      jurisdiction: '',
      x: cursorX,
      y: investorY,
      w: nodeW,
      h: nodeH,
      custom: false
    };
    nodes.push(n);
    investorNodes.push(n);
    cursorX += nodeW + nodeGap;
  }

  // Tier 2 — Blockers (if any)
  const blockerNodes = [];
  if (p3Data?.blockers && p3Data.blockers.length > 0) {
    const blockerY = investorY + nodeH + tierGap;
    const totalBlockerW = p3Data.blockers.length * nodeW + (p3Data.blockers.length - 1) * nodeGap;
    let bCursorX = (canvasW - totalBlockerW) / 2;
    for (const blocker of p3Data.blockers) {
      const blockerType = BLOCKER_TYPES[blocker.type];
      const n = {
        id: 'blocker_' + blocker.id,
        label: blocker.label,
        sub: blockerType?.label.substring(0, 24) || blocker.type,
        type: blocker.type === 'reit' ? 'reit' : 'blocker',
        jurisdiction: blocker.jurisdiction || '',
        x: bCursorX,
        y: blockerY,
        w: nodeW,
        h: nodeH,
        custom: false
      };
      nodes.push(n);
      blockerNodes.push({ node: n, blocker });
      bCursorX += nodeW + nodeGap;

      // Edges from each blocker-behind-investor to this blocker
      for (const memberId of blocker.memberIds) {
        const invNode = nodes.find(nn => nn.id === 'inv_' + memberId);
        if (invNode) {
          const cls = data.memberClasses.find(c => c.id === memberId);
          edges.push({
            id: nextId++,
            fromId: invNode.id,
            toId: n.id,
            type: 'ownership',
            label: cls && cls.capital > 0 ? fmt$(cls.capital) : ''
          });
        }
      }
    }
  }

  // Tier 3 — SPV
  const spvY = blockerNodes.length > 0 ?
    (investorY + nodeH + tierGap + nodeH + tierGap) :
    (investorY + nodeH + tierGap);
  const spvNode = {
    id: 'spv',
    label: data.projectName || 'SPV',
    sub: DEAL_TYPES[data.dealType]?.label || 'LLC',
    type: 'spv',
    jurisdiction: data.jurisdiction || '',
    x: (canvasW - nodeW) / 2,
    y: spvY,
    w: nodeW,
    h: nodeH,
    custom: false
  };
  nodes.push(spvNode);

  // Edges: investors → SPV (directly if no blocker; blocker → SPV otherwise)
  const investorsWithBlocker = new Set();
  if (p3Data?.blockers) {
    for (const b of p3Data.blockers) {
      for (const mid of b.memberIds) investorsWithBlocker.add(mid);
    }
  }

  for (const cls of investors) {
    if (!investorsWithBlocker.has(cls.id)) {
      const invNode = nodes.find(n => n.id === 'inv_' + cls.id);
      if (invNode) {
        const totalCap = data.memberClasses.reduce((s, c) => s + c.capital, 0);
        const sharePct = totalCap > 0 ? (cls.capital / totalCap * 100).toFixed(1) + '%' : '';
        edges.push({
          id: nextId++,
          fromId: invNode.id,
          toId: 'spv',
          type: 'ownership',
          label: sharePct
        });
      }
    }
  }

  // Blocker → SPV edges
  for (const { node: bNode } of blockerNodes) {
    edges.push({
      id: nextId++,
      fromId: bNode.id,
      toId: 'spv',
      type: 'ownership',
      label: ''
    });
  }

  // Senior debt — off to the right
  if (data.seniorLoan > 0) {
    const lenderNode = {
      id: 'senior_debt',
      label: 'Senior Lender',
      sub: fmt$(data.seniorLoan) + ' @ ' + (data.seniorRate * 100).toFixed(2) + '%',
      type: 'lender',
      jurisdiction: data.seniorLoanType?.replace('_', ' ') || '',
      x: spvNode.x + nodeW + 80,
      y: spvY,
      w: nodeW,
      h: nodeH,
      custom: false
    };
    nodes.push(lenderNode);
    edges.push({
      id: nextId++,
      fromId: lenderNode.id,
      toId: 'spv',
      type: 'debt',
      label: '§ 752: ' + (data.senior752 || 'nonrecourse')
    });
  }

  // Member debt — also off to the side
  if (data.memberDebt && data.memberDebt.length > 0) {
    let mdX = spvNode.x - nodeW - 80;
    for (const md of data.memberDebt) {
      const mdNode = {
        id: 'mdebt_' + md.id,
        label: md.lender || 'Member Loan',
        sub: fmt$(md.amount) + ' @ ' + md.rate + '%',
        type: 'lender',
        jurisdiction: md.term752 || '',
        x: mdX,
        y: spvY,
        w: nodeW,
        h: nodeH,
        custom: false
      };
      nodes.push(mdNode);
      edges.push({
        id: nextId++,
        fromId: mdNode.id,
        toId: 'spv',
        type: 'debt',
        label: ''
      });
    }
  }

  // Bottom — Property
  const propertyNode = {
    id: 'property',
    label: 'Property',
    sub: data.propertyLocation || 'Location TBD',
    type: 'property',
    jurisdiction: '',
    x: (canvasW - nodeW) / 2,
    y: spvY + nodeH + tierGap,
    w: nodeW,
    h: nodeH,
    custom: false
  };
  nodes.push(propertyNode);
  edges.push({
    id: nextId++,
    fromId: 'spv',
    toId: 'property',
    type: 'ownership',
    label: 'owns'
  });

  // Apply user position overrides
  for (const n of nodes) {
    if (DB.orgChart.positionOverrides[n.id]) {
      n.x = DB.orgChart.positionOverrides[n.id].x;
      n.y = DB.orgChart.positionOverrides[n.id].y;
    }
  }

  // Preserve custom (user-added) nodes
  for (const customNode of DB.orgChart.nodes.filter(n => n.custom)) {
    nodes.push(customNode);
  }
  for (const customEdge of DB.orgChart.edges.filter(e => e.custom)) {
    edges.push(customEdge);
  }

  return { nodes, edges, nextNodeId: nextId, nextEdgeId: nextId };
}

// =============================================================================
// SVG RENDERING — Drag-and-Drop Org Chart
// =============================================================================
function renderOrgChart(results) {
  const container = document.getElementById('org_chart');
  if (!container) return;

  // Auto-generate from current state
  const gen = autoGenerateOrgChart(results.data, results.p3Data);
  DB.orgChart.nodes = gen.nodes;
  DB.orgChart.edges = gen.edges;

  // Compute SVG dimensions
  const maxX = Math.max(...gen.nodes.map(n => n.x + n.w)) + 40;
  const maxY = Math.max(...gen.nodes.map(n => n.y + n.h)) + 40;

  // Build SVG markup
  let svgHtml = `<svg class="org-svg" viewBox="0 0 ${Math.max(maxX, 1100)} ${Math.max(maxY, 500)}" xmlns="${SVG_NS}">
    <defs>
      <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L9,5 L0,10 Z" fill="#4a4a4a" />
      </marker>
      <marker id="arrowhead-debt" markerWidth="10" markerHeight="10" refX="9" refY="5" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L9,5 L0,10 Z" fill="#d4a017" />
      </marker>
    </defs>`;

  // Render edges first (so nodes appear on top)
  for (const edge of gen.edges) {
    const fromNode = gen.nodes.find(n => n.id === edge.fromId);
    const toNode = gen.nodes.find(n => n.id === edge.toId);
    if (!fromNode || !toNode) continue;

    // Connect from bottom of source to top of target (or sides if horizontally adjacent)
    let x1, y1, x2, y2;
    const fromCenter = { x: fromNode.x + fromNode.w/2, y: fromNode.y + fromNode.h/2 };
    const toCenter = { x: toNode.x + toNode.w/2, y: toNode.y + toNode.h/2 };

    // Decide attachment points based on relative position
    const dx = toCenter.x - fromCenter.x;
    const dy = toCenter.y - fromCenter.y;
    if (Math.abs(dy) > Math.abs(dx)) {
      // vertical-ish
      x1 = fromCenter.x;
      y1 = dy > 0 ? fromNode.y + fromNode.h : fromNode.y;
      x2 = toCenter.x;
      y2 = dy > 0 ? toNode.y : toNode.y + toNode.h;
    } else {
      // horizontal-ish
      x1 = dx > 0 ? fromNode.x + fromNode.w : fromNode.x;
      y1 = fromCenter.y;
      x2 = dx > 0 ? toNode.x : toNode.x + toNode.w;
      y2 = toCenter.y;
    }

    const edgeClass = edge.type === 'debt' ? 'org-edge debt' :
                      edge.type === 'distribution' ? 'org-edge distribution' : 'org-edge';
    const marker = edge.type === 'debt' ? 'arrowhead-debt' : 'arrowhead';
    svgHtml += `<line class="${edgeClass}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#${marker})" />`;

    // Edge label at midpoint
    if (edge.label) {
      const midX = (x1 + x2) / 2;
      const midY = (y1 + y2) / 2;
      const labelClass = edge.type === 'debt' ? 'org-edge-label debt' :
                        edge.type === 'distribution' ? 'org-edge-label distribution' : 'org-edge-label';
      svgHtml += `<text class="${labelClass}" x="${midX}" y="${midY - 3}">${escapeHtml(edge.label)}</text>`;
    }
  }

  // Render nodes
  for (const node of gen.nodes) {
    const lightText = node.type === 'spv' || node.type === 'property';
    const selectedClass = DB.orgChart.selectedId === node.id ? ' selected' : '';
    svgHtml += `<g class="org-node-group" data-node-id="${node.id}">
      <rect class="org-node-rect type-${node.type}${selectedClass}"
            x="${node.x}" y="${node.y}" width="${node.w}" height="${node.h}"
            rx="2" ry="2" data-node-id="${node.id}" />
      <text class="org-node-label ${lightText ? 'light' : ''}"
            x="${node.x + node.w/2}" y="${node.y + 20}">${escapeHtml(truncate(node.label, 22))}</text>
      <text class="org-node-sub ${lightText ? 'light' : ''}"
            x="${node.x + node.w/2}" y="${node.y + 36}">${escapeHtml(truncate(node.sub || '', 28))}</text>
      ${node.jurisdiction ? `<text class="org-node-jurisdiction ${lightText ? 'light' : ''}"
            x="${node.x + node.w/2}" y="${node.y + 50}">${escapeHtml(node.jurisdiction)}</text>` : ''}
    </g>`;
  }

  svgHtml += '</svg>';

  // Legend
  const legendHtml = `<div class="org-legend">
    <div class="org-legend-item"><div class="org-legend-swatch spv"></div>SPV</div>
    <div class="org-legend-item"><div class="org-legend-swatch sponsor"></div>Sponsor / GP</div>
    <div class="org-legend-item"><div class="org-legend-swatch lp"></div>LP / Investor</div>
    <div class="org-legend-item"><div class="org-legend-swatch blocker"></div>Blocker</div>
    <div class="org-legend-item"><div class="org-legend-swatch lender"></div>Lender (§752)</div>
    <div class="org-legend-item"><div class="org-legend-swatch property"></div>Property</div>
  </div>`;

  container.innerHTML = svgHtml + legendHtml;

  // Attach interactivity
  attachOrgChartInteractivity(container);
}

function truncate(s, maxLen) {
  if (!s) return '';
  return s.length > maxLen ? s.substring(0, maxLen - 1) + '…' : s;
}

// =============================================================================
// ORG CHART INTERACTIVITY — Drag, select, edit, delete
// =============================================================================
function attachOrgChartInteractivity(container) {
  const svg = container.querySelector('.org-svg');
  if (!svg) return;

  let draggingNode = null;
  let dragOffset = { x: 0, y: 0 };

  const getSVGPoint = (clientX, clientY) => {
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    return pt.matrixTransform(ctm.inverse());
  };

  // Click/drag on nodes
  svg.addEventListener('pointerdown', e => {
    const target = e.target.closest('[data-node-id]');
    if (!target) {
      DB.orgChart.selectedId = null;
      renderOrgChart(DB.lastResults);
      return;
    }
    const nodeId = target.dataset.nodeId;
    const node = DB.orgChart.nodes.find(n => n.id === nodeId);
    if (!node) return;

    DB.orgChart.selectedId = nodeId;
    draggingNode = node;
    const pt = getSVGPoint(e.clientX, e.clientY);
    dragOffset.x = pt.x - node.x;
    dragOffset.y = pt.y - node.y;
    target.setPointerCapture(e.pointerId);
    target.classList.add('dragging');
    e.preventDefault();
  });

  svg.addEventListener('pointermove', e => {
    if (!draggingNode) return;
    const pt = getSVGPoint(e.clientX, e.clientY);
    draggingNode.x = Math.max(0, pt.x - dragOffset.x);
    draggingNode.y = Math.max(0, pt.y - dragOffset.y);
    // Store override
    DB.orgChart.positionOverrides[draggingNode.id] = { x: draggingNode.x, y: draggingNode.y };
    // Re-render on each move (cheap for small charts)
    renderOrgChart(DB.lastResults);
  });

  svg.addEventListener('pointerup', e => {
    if (draggingNode) {
      draggingNode = null;
    }
  });

  // Double-click to edit label
  svg.addEventListener('dblclick', e => {
    const target = e.target.closest('[data-node-id]');
    if (!target) return;
    const nodeId = target.dataset.nodeId;
    const node = DB.orgChart.nodes.find(n => n.id === nodeId);
    if (!node) return;
    const newLabel = prompt('Edit node label:', node.label);
    if (newLabel !== null) {
      node.label = newLabel;
      // For custom nodes, store back; for auto-generated, just override
      if (node.custom) {
        const existing = DB.orgChart.nodes.find(n => n.id === nodeId);
        if (existing) existing.label = newLabel;
      } else {
        // For auto-gen nodes, the label change won't persist across recompute
        // unless we add a label override. Simplest: warn or accept.
      }
      renderOrgChart(DB.lastResults);
    }
  });

  // Keyboard delete
  document.addEventListener('keydown', handleOrgChartKeyDown);
}

function handleOrgChartKeyDown(e) {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (!DB.orgChart.selectedId) return;
    const node = DB.orgChart.nodes.find(n => n.id === DB.orgChart.selectedId);
    if (!node) return;
    if (!node.custom) {
      // Don't delete auto-generated nodes — just deselect
      DB.orgChart.selectedId = null;
      renderOrgChart(DB.lastResults);
      return;
    }
    // Delete custom node
    DB.orgChart.nodes = DB.orgChart.nodes.filter(n => n.id !== DB.orgChart.selectedId);
    DB.orgChart.edges = DB.orgChart.edges.filter(e => e.fromId !== DB.orgChart.selectedId && e.toId !== DB.orgChart.selectedId);
    DB.orgChart.selectedId = null;
    renderOrgChart(DB.lastResults);
  }
}

// =============================================================================
// ORG CHART TOOLBAR
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const regen = document.getElementById('org_regenerate');
  if (regen) {
    regen.addEventListener('click', () => {
      DB.orgChart.positionOverrides = {};
      DB.orgChart.nodes = DB.orgChart.nodes.filter(n => !n.custom);
      DB.orgChart.edges = DB.orgChart.edges.filter(e => !e.custom);
      renderOrgChart(DB.lastResults);
    });
  }

  const addNode = document.getElementById('org_add_node');
  if (addNode) {
    addNode.addEventListener('click', () => {
      const label = prompt('Label for new node:', 'New Entity');
      if (!label) return;
      DB.orgChart.nodes.push({
        id: 'custom_' + DB.orgChart.nextNodeId++,
        label,
        sub: '',
        type: 'custom',
        jurisdiction: '',
        x: 50, y: 50, w: 170, h: 56,
        custom: true
      });
      renderOrgChart(DB.lastResults);
    });
  }

  const resetPos = document.getElementById('org_clear_positions');
  if (resetPos) {
    resetPos.addEventListener('click', () => {
      DB.orgChart.positionOverrides = {};
      renderOrgChart(DB.lastResults);
    });
  }

  const memoBtn = document.getElementById('btn_deal_memo');
  if (memoBtn) {
    memoBtn.addEventListener('click', generateDealMemo);
  }
});

// =============================================================================
// DEAL MEMO — Comprehensive HTML Output for PDF Export
// =============================================================================
function generateDealMemo() {
  if (!DB.lastResults) recomputeAll();
  const r = DB.lastResults;
  const date = new Date().toISOString().slice(0,10);
  const dealName = r.data.projectName || 'Unnamed Project';
  const dealLabel = DEAL_TYPES[r.data.dealType]?.label || r.data.dealType;
  const state = STATE_DATA.find(s => s.abbr === r.data.propertyState);

  // Build the org chart SVG inline (snapshot of current chart)
  const orgChartContainer = document.getElementById('org_chart');
  const orgSvgHtml = orgChartContainer ? orgChartContainer.innerHTML : '';

  // Section: Sources & Uses
  const sources = [
    ['Member Equity', r.totalMemberCapital],
    ['Senior Debt', r.data.seniorLoan],
    ['Member Debt / Mezz', r.totalMemberDebt]
  ].filter(s => s[1] > 0);
  const uses = [
    ['Land', r.data.budget.land],
    ['Existing Building', r.data.budget.building],
    ['Hard Construction', r.data.budget.hard],
    ['Construction Contingency', r.data.budget.contingency],
    ['Soft Costs', r.data.budget.soft],
    ['Sponsor Fees', r.totalSponsorFees],
    ['Interest Carry', r.totalInterest],
    ['Tax & Insurance Carry', r.data.budget.taxIns],
    ['Marketing & Sales Reserve', r.data.budget.marketing],
    ['Other / Working Capital', r.data.budget.other]
  ].filter(u => u[1] > 0);

  let suHtml = '<table class="memo-table"><thead><tr><th>Source</th><th class="right">Amount</th><th>Use</th><th class="right">Amount</th></tr></thead><tbody>';
  const maxRows = Math.max(sources.length, uses.length);
  for (let i = 0; i < maxRows; i++) {
    const s = sources[i] || ['', null];
    const u = uses[i] || ['', null];
    suHtml += `<tr><td>${s[0]}</td><td class="right">${s[1] !== null ? fmt$(s[1]) : ''}</td><td>${u[0]}</td><td class="right">${u[1] !== null ? fmt$(u[1]) : ''}</td></tr>`;
  }
  suHtml += `<tr class="total"><td>Total Sources</td><td class="right">${fmt$(r.totalSources)}</td><td>Total Uses</td><td class="right">${fmt$(r.totalProjectCost)}</td></tr></tbody></table>`;

  // Returns by class
  let returnsHtml = '<table class="memo-table"><thead><tr><th>Class</th><th class="right">Capital</th><th class="right">Distribution</th><th class="right">Profit</th><th class="right">MOIC</th><th class="right">IRR</th></tr></thead><tbody>';
  for (const ret of r.classReturns) {
    returnsHtml += `<tr><td>${escapeHtml(ret.class.name)}</td><td class="right">${fmt$(ret.class.capital)}</td><td class="right">${fmt$(ret.distribution)}</td><td class="right">${fmt$(ret.profit)}</td><td class="right">${fmtMult(ret.moic)}</td><td class="right">${fmtPct(ret.irr, 1)}</td></tr>`;
  }
  returnsHtml += `<tr class="total"><td>Total LP (Blended)</td><td class="right">${fmt$(r.totalLPCap)}</td><td class="right">${fmt$(r.totalLPDist)}</td><td class="right">${fmt$(r.totalLPDist - r.totalLPCap)}</td><td class="right">${fmtMult(r.lpMOIC)}</td><td class="right">${fmtPct(r.lpIRR, 1)}</td></tr></tbody></table>`;

  // Waterfall
  let wfHtml = '<table class="memo-table"><thead><tr><th>Tier</th><th>Description</th><th class="right">Total</th><th class="right">To LPs</th><th class="right">To Sponsor</th></tr></thead><tbody>';
  for (const t of r.waterfall.trace) {
    wfHtml += `<tr><td>${t.tier}</td><td><strong>${escapeHtml(t.name)}</strong><br><span class="meta">${escapeHtml(t.description)}</span></td><td class="right">${fmt$(t.total)}</td><td class="right">${fmt$(t.toLP)}</td><td class="right">${fmt$(t.toSponsor)}</td></tr>`;
  }
  wfHtml += '</tbody></table>';

  // Capital account roll-forward
  let crfHtml = '<table class="memo-table"><thead><tr><th>Class</th><th class="right">Opening</th><th class="right">Cum. Allocations</th><th class="right">Distributions</th><th class="right">Closing</th><th class="right">Outside Basis</th></tr></thead><tbody>';
  if (r.rollForward) {
    for (const row of r.rollForward) {
      crfHtml += `<tr><td>${escapeHtml(row.class.name)}</td><td class="right">${fmt$(row.opening)}</td><td class="right">${(row.cumulativeAllocations >= 0 ? '+' : '') + fmt$(row.cumulativeAllocations)}</td><td class="right">(${fmt$(row.distributions)})</td><td class="right">${fmt$(row.closing)}</td><td class="right">${fmt$(row.outsideBasis)}</td></tr>`;
    }
  }
  crfHtml += '</tbody></table>';

  // §704(c) comparison (if present)
  let sec704cHtml = '';
  if (r.allocData?.sec704cPresent && r.allocData.sec704cLayers?.length > 0 && r.sec704c) {
    sec704cHtml = '<h2>§ 704(c) — Three-Method Comparison</h2>';
    sec704cHtml += '<table class="memo-table"><thead><tr><th>Method</th><th>Citation</th><th class="right">Tax Dep to Contrib</th><th class="right">Tax Dep to Non-Contrib</th><th class="right">Ceiling Shortfall</th></tr></thead><tbody>';
    for (const method of ['traditional', 'curative', 'remedial']) {
      const m = r.sec704c[method];
      const taxDepContrib = m.layers.reduce((s, l) => s + l.taxDepToContributor, 0);
      const taxDepNonContrib = m.layers.reduce((s, l) => s + l.taxDepToNonContrib, 0);
      const cite = method === 'traditional' ? 'Reg. §1.704-3(b)' : method === 'curative' ? 'Reg. §1.704-3(c)' : 'Reg. §1.704-3(d)';
      sec704cHtml += `<tr><td><strong>${method.charAt(0).toUpperCase() + method.slice(1)}</strong></td><td>${cite}</td><td class="right">${fmt$(taxDepContrib)}</td><td class="right">${fmt$(taxDepNonContrib)}</td><td class="right">${fmt$(m.totalShortfall)}</td></tr>`;
    }
    sec704cHtml += '</tbody></table>';
  }

  // FIRPTA section (if foreign investors)
  let firptaHtml = '';
  if (r.firpta?.investorResults?.length > 0) {
    firptaHtml = '<h2>FIRPTA Analysis</h2>';
    firptaHtml += '<table class="memo-table"><thead><tr><th>Investor</th><th>Profile</th><th>Status</th><th class="right">Withholding</th></tr></thead><tbody>';
    for (const ir of r.firpta.investorResults) {
      firptaHtml += `<tr><td>${escapeHtml(ir.class.name)}</td><td>${escapeHtml(ir.profileLabel)}</td><td><strong>${ir.status.toUpperCase()}</strong> — ${escapeHtml(ir.statusDetail)}</td><td class="right">${fmt$(ir.withholding)}</td></tr>`;
    }
    firptaHtml += `<tr class="total"><td colspan="3">Total FIRPTA Withholding</td><td class="right">${fmt$(r.firpta.totalWithholding)}</td></tr></tbody></table>`;
  }

  // UBTI section (if tax-exempt investors)
  let ubtiHtml = '';
  if (r.ubti?.investorResults?.length > 0) {
    ubtiHtml = '<h2>UBTI Analysis</h2>';
    ubtiHtml += '<table class="memo-table"><thead><tr><th>Investor</th><th>Profile</th><th>Status</th><th class="right">UBTI</th><th class="right">Tax</th></tr></thead><tbody>';
    for (const ir of r.ubti.investorResults) {
      ubtiHtml += `<tr><td>${escapeHtml(ir.class.name)}</td><td>${escapeHtml(ir.profileLabel)}</td><td><strong>${ir.status.toUpperCase()}</strong> — ${escapeHtml(ir.statusDetail)}</td><td class="right">${fmt$(ir.udfiAmount)}</td><td class="right">${fmt$(ir.tax)}</td></tr>`;
    }
    ubtiHtml += '</tbody></table>';
  }

  // Compliance section (if applicable)
  let complianceHtml = '';
  if (r.compliance) {
    complianceHtml = `<h2>Specialized Compliance — ${escapeHtml(r.compliance.label)}</h2>`;
    complianceHtml += `<p><strong>Overall Status:</strong> ${escapeHtml(r.compliance.overallLabel)}</p>`;
    complianceHtml += '<table class="memo-table"><thead><tr><th>Test</th><th>Citation</th><th class="right">Actual</th><th class="right">Threshold</th><th class="right">Status</th></tr></thead><tbody>';
    for (const t of r.compliance.tests) {
      complianceHtml += `<tr><td>${escapeHtml(t.name)}</td><td>${escapeHtml(t.cite)}</td><td class="right">${typeof t.actual === 'string' ? escapeHtml(t.actual) : t.actual}</td><td class="right">${typeof t.threshold === 'string' ? escapeHtml(t.threshold) : t.threshold}</td><td class="right"><strong>${t.status.toUpperCase()}</strong></td></tr>`;
    }
    complianceHtml += '</tbody></table>';
  }

  // Recommendations
  let recsHtml = '';
  if (r.recommendations?.length > 0) {
    recsHtml = '<h2>Structural Recommendations</h2><ul class="memo-list">';
    for (const rec of r.recommendations) {
      const tag = rec.type === 'critical' ? 'CRITICAL' : rec.type === 'flag' ? 'FLAG' : 'RECOMMEND';
      recsHtml += `<li><strong>[${tag}]</strong> ${rec.text}</li>`;
    }
    recsHtml += '</ul>';
  }

  // Compose final memo HTML
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Deal Memorandum — ${escapeHtml(dealName)}</title>
  <style>
    @page { size: letter; margin: 0.85in 0.75in 1in 0.75in; }
    body { font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; line-height: 1.5; font-size: 11pt; margin: 0; padding: 0 1.5rem; max-width: 7in; margin-left: auto; margin-right: auto; }
    .cover { page-break-after: always; padding: 4rem 0; text-align: center; min-height: 9in; display: flex; flex-direction: column; justify-content: space-between; }
    .cover .firm-mark { font-family: 'Open Sans', sans-serif; font-size: 10pt; letter-spacing: 4px; color: #169B62; font-weight: 700; margin-bottom: 1rem; }
    .cover .firm-name { font-family: 'Open Sans', sans-serif; font-size: 14pt; letter-spacing: 2px; color: #1a1a1a; font-weight: 700; margin-bottom: 6rem; }
    .cover .memo-label { font-family: 'Open Sans', sans-serif; font-size: 10pt; letter-spacing: 3px; color: #6b6b6b; margin-bottom: 0.5rem; }
    .cover h1 { font-size: 28pt; margin: 0.5rem 0 2rem 0; font-weight: 400; }
    .cover .subhead { font-size: 13pt; color: #4a4a4a; font-style: italic; margin-bottom: 0.5rem; }
    .cover .meta { font-size: 10pt; color: #6b6b6b; margin-top: 2rem; }
    .cover .stamp { font-family: 'Open Sans', sans-serif; font-size: 9pt; letter-spacing: 2px; color: #8b3a3a; border: 2px solid #8b3a3a; padding: 0.6rem 1.2rem; display: inline-block; margin-top: 6rem; font-weight: 700; }
    h2 { font-family: 'Open Sans', sans-serif; font-size: 13pt; color: #1a1a1a; margin: 2rem 0 0.85rem; padding-bottom: 0.35rem; border-bottom: 1.5px solid #169B62; text-transform: uppercase; letter-spacing: 2px; }
    h3 { font-family: 'Open Sans', sans-serif; font-size: 10pt; color: #1a1a1a; margin: 1.25rem 0 0.5rem; text-transform: uppercase; letter-spacing: 1.5px; }
    p { margin: 0.5rem 0; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin: 1.5rem 0; }
    .stat-box { padding: 1rem; border-left: 3px solid #169B62; background: #fafaf5; }
    .stat-label { font-family: 'Open Sans', sans-serif; font-size: 8pt; letter-spacing: 1.5px; text-transform: uppercase; color: #6b6b6b; margin-bottom: 0.25rem; font-weight: 700; }
    .stat-value { font-size: 14pt; font-weight: 700; color: #1a1a1a; font-family: 'Open Sans', sans-serif; }
    .memo-table { width: 100%; border-collapse: collapse; margin: 1rem 0; font-size: 9.5pt; }
    .memo-table th { background: #1a1a1a; color: #FFFFFF; padding: 0.5rem 0.65rem; text-align: left; font-family: 'Open Sans', sans-serif; font-size: 8.5pt; letter-spacing: 1px; text-transform: uppercase; font-weight: 700; }
    .memo-table th.right { text-align: right; }
    .memo-table td { padding: 0.45rem 0.65rem; border-bottom: 0.5px solid #d4d4d0; vertical-align: top; }
    .memo-table td.right { text-align: right; font-variant-numeric: tabular-nums; }
    .memo-table tr.total td { background: #169B62; color: #FFFFFF; font-weight: 700; }
    .memo-table .meta { font-size: 8pt; color: #6b6b6b; }
    .memo-list { padding-left: 1.25rem; }
    .memo-list li { margin-bottom: 0.85rem; line-height: 1.55; }
    .org-chart-page { page-break-before: always; }
    .org-chart-page svg { width: 100%; max-width: 100%; height: auto; }
    .org-legend { display: flex; gap: 1rem; padding: 0.5rem 0; font-size: 8.5pt; flex-wrap: wrap; }
    .footer-disclaimer { margin-top: 3rem; padding-top: 1.5rem; border-top: 1px solid #d4d4d0; font-size: 8.5pt; color: #4a4a4a; line-height: 1.6; }
    .draft-stamp { display: inline-block; color: #8b3a3a; border: 1.5px solid #8b3a3a; padding: 0.15rem 0.55rem; font-family: 'Open Sans', sans-serif; font-size: 8pt; font-weight: 700; letter-spacing: 1.5px; }
    .toc { font-size: 10pt; }
    .toc li { margin-bottom: 0.35rem; }
    .toc .toc-dots { color: #d4d4d0; }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .no-print { display: none; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>

<!-- COVER PAGE -->
<div class="cover">
  <div>
    <div class="firm-mark">DONOVAN LEGAL PLLC · RESERVE</div>
    <div class="firm-name">DEAL MEMORANDUM</div>
  </div>
  <div>
    <div class="memo-label">Project</div>
    <h1>${escapeHtml(dealName)}</h1>
    <div class="subhead">${escapeHtml(dealLabel)}</div>
    <div class="subhead">${state ? escapeHtml(state.name) : escapeHtml(r.data.propertyState || '')} · ${escapeHtml(r.data.jurisdiction || '')} entity</div>
    <div class="meta">Generated ${date}</div>
  </div>
  <div>
    <div class="stamp">DRAFT — PRIVILEGED &amp; CONFIDENTIAL</div>
    <p style="font-size:8pt;color:#6b6b6b;margin-top:1rem;">Subject to Donovan Legal PLLC review and engagement</p>
  </div>
</div>

<!-- TABLE OF CONTENTS -->
<h2>Table of Contents</h2>
<ol class="toc">
  <li>Executive Summary</li>
  <li>Deal Structure</li>
  <li>Capital Stack &amp; Project Budget</li>
  <li>Distribution Waterfall</li>
  <li>Capital Account Roll-Forward</li>
  ${sec704cHtml ? '<li>§ 704(c) Three-Method Comparison</li>' : ''}
  ${firptaHtml ? '<li>FIRPTA Analysis</li>' : ''}
  ${ubtiHtml ? '<li>UBTI Analysis</li>' : ''}
  ${complianceHtml ? '<li>Specialized Compliance</li>' : ''}
  <li>Structural Diagram</li>
  ${recsHtml ? '<li>Structural Recommendations</li>' : ''}
  <li>Disclaimer &amp; Methodology</li>
</ol>

<!-- EXECUTIVE SUMMARY -->
<h2>Executive Summary</h2>
<p>This memorandum sets out the structural and economic terms of the proposed transaction for <strong>${escapeHtml(dealName)}</strong>, a ${escapeHtml(dealLabel)} structured as a ${escapeHtml(r.data.jurisdiction || '')} entity. The project anticipates a ${r.data.holdMonths}-month hold with a target sale price of ${fmt$(r.grossSale)}. Headline economic results are summarized below; detailed analysis follows in subsequent sections.</p>

<div class="stats-grid">
  <div class="stat-box"><div class="stat-label">LP IRR (Blended)</div><div class="stat-value">${fmtPct(r.lpIRR, 1)}</div></div>
  <div class="stat-box"><div class="stat-label">LP MOIC</div><div class="stat-value">${fmtMult(r.lpMOIC)}</div></div>
  <div class="stat-box"><div class="stat-label">Sponsor Promote</div><div class="stat-value">${fmt$(r.sponsorPromote)}</div></div>
  <div class="stat-box"><div class="stat-label">Total Project Cost</div><div class="stat-value">${fmt$(r.totalProjectCost)}</div></div>
</div>

<!-- DEAL STRUCTURE -->
<h2>Deal Structure</h2>
<p><strong>Deal Type.</strong> ${escapeHtml(dealLabel)} formed under the laws of ${escapeHtml(r.data.jurisdiction || 'TBD')}. ${stripTagsToText(DEAL_TYPES[r.data.dealType]?.help)}</p>
<p><strong>Property.</strong> ${escapeHtml(r.data.propertyLocation || 'Location to be determined')}.</p>
<p><strong>Management Structure.</strong> ${escapeHtml((r.data.managementStructure || '').replace(/_/g, ' '))} with major decisions subject to ${escapeHtml((r.data.majorVoteThreshold || '').replace(/_/g, ' '))} member approval.</p>

<!-- CAPITAL STACK -->
<h2>Capital Stack &amp; Project Budget</h2>
${suHtml}

<h3>Returns by Class</h3>
${returnsHtml}

<!-- WATERFALL -->
<h2>Distribution Waterfall</h2>
<p>Waterfall style: <strong>${escapeHtml(r.data.waterfallStyle)}</strong>. Preferred return: <strong>${(r.data.prefRate * 100).toFixed(2)}% per annum</strong> (${escapeHtml((r.data.prefType || '').replace(/_/g, ' '))}, ${escapeHtml((r.data.prefPriority || '').replace(/_/g, ' '))}). Promote tiers: ${r.data.promoteTiers?.length || 0}. Catch-up: ${escapeHtml(r.data.catchupStyle || 'none')}. Clawback: ${escapeHtml(r.data.clawbackType || 'none')}.</p>
${wfHtml}

<!-- CAPITAL ACCOUNT ROLL-FORWARD -->
<h2>Capital Account Roll-Forward &amp; § 752 Outside Basis</h2>
<p>Roll-forward computed under the <strong>${escapeHtml(r.allocData?.method704b || 'targeted')}</strong> § 704(b) method. Outside basis reflects each member&rsquo;s share of partnership liabilities under § 752, classified as <strong>${escapeHtml(r.data.senior752 || 'nonrecourse')}</strong>.</p>
${crfHtml}

${sec704cHtml}

${firptaHtml}

${ubtiHtml}

${complianceHtml}

<!-- ORG CHART -->
<div class="org-chart-page">
  <h2>Structural Diagram</h2>
  <p>Diagram depicts the ownership and debt relationships among the parties to the transaction.</p>
  ${orgSvgHtml}
</div>

${recsHtml}

<!-- DISCLAIMER -->
<div class="footer-disclaimer">
  <h3>Disclaimer &amp; Methodology</h3>
  <p>This Deal Memorandum is generated by the Donovan Legal PLLC Reserve Deal Builder tool. It reflects mechanical computation based on inputs provided. It does not constitute legal, tax, or accounting advice and does not create an attorney-client relationship. Any structure modeled here is subject to firm review under a written engagement letter and may require modification to comply with applicable federal, state, and local law including securities, tax, and bar regulations. Tax rates, statutory thresholds, and conformity flags change; outputs reflect the law in effect as of the generation date.</p>
  <p><strong>Computation methodology.</strong> Waterfall executes American or European style as configured, with tier-by-tier distribution of pool cash. § 704(b) allocations follow the selected method (targeted, SEE+DRO, or SEE+QIO). § 704(c) runs traditional / curative / remedial in parallel. FIRPTA computed at the investor level with § 897(l) and § 897(h)(1) exceptions applied. UBTI under § 514 with § 514(c)(9) qualified-organization exception. Compliance dashboards apply the statutory tests under § 856 (REIT), § 1400Z-2 (OZ), Rev. Proc. 2002-22 (TIC), and Rev. Rul. 2004-86 (DST).</p>
  <p><strong>Donovan Legal PLLC</strong> · 301 W. Atlantic Avenue, Suite 5 · Delray Beach, Florida 33444 · <span class="draft-stamp">DRAFT · ${date}</span></p>
</div>

</body>
</html>`;

  // Open in a new tab and trigger print
  const newWindow = window.open('', '_blank');
  if (!newWindow) {
    alert('Pop-up blocker prevented opening the deal memo. Allow pop-ups for this site, or use the Print Summary button.');
    return;
  }
  newWindow.document.write(html);
  newWindow.document.close();
  // Wait for content to render then trigger print
  setTimeout(() => {
    try { newWindow.print(); } catch(e) { /* user can print manually */ }
  }, 500);
}



// =============================================================================
// =============================================================================
//                  PHASE 6 — TAX OVERLAY REFINEMENTS (FINAL)
//
//   §163(j) Real Property Trade or Business Election
//   §461(l) Excess Business Loss (2026 thresholds)
//   §199A QBI with Rev. Proc. 2019-38 rental safe harbor
//   State PTET election analysis
//   Multi-state apportionment + nonresident withholding + composite returns
//   Year-by-year capital account roll-forward
// =============================================================================
// =============================================================================

// =============================================================================
// 2026 STATUTORY CONSTANTS
// =============================================================================
const SEC_461L_2026 = {
  single: 313000,
  mfj: 626000,
  mfs: 313000,
  hoh: 313000
};
const SEC_448C_THRESHOLD_2025 = 31000000; // average gross receipts test
const SEC_199A_THRESHOLD_2024 = {
  single: 191950,
  mfj: 383900,
  mfs: 191950
};
const CORP_TAX_RATE = 0.21;

// =============================================================================
// WIRE UP CONDITIONAL SUB-SECTIONS BASED ON OVERLAY CHECKBOXES
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Show/hide §163(j) detail when checkbox toggles
  const cb163j = document.getElementById('overlay_163j');
  const detail163j = document.getElementById('overlay_163j_detail');
  if (cb163j && detail163j) {
    detail163j.style.display = cb163j.checked ? 'block' : 'none';
    cb163j.addEventListener('change', () => {
      detail163j.style.display = cb163j.checked ? 'block' : 'none';
      recomputeAll();
    });
  }

  const cb461l = document.getElementById('overlay_461l');
  const detail461l = document.getElementById('overlay_461l_detail');
  if (cb461l && detail461l) {
    detail461l.style.display = cb461l.checked ? 'block' : 'none';
    cb461l.addEventListener('change', () => {
      detail461l.style.display = cb461l.checked ? 'block' : 'none';
      recomputeAll();
    });
  }

  const cb199a = document.getElementById('overlay_199a');
  const detail199a = document.getElementById('overlay_199a_detail');
  if (cb199a && detail199a) {
    detail199a.style.display = cb199a.checked ? 'block' : 'none';
    cb199a.addEventListener('change', () => {
      detail199a.style.display = cb199a.checked ? 'block' : 'none';
      recomputeAll();
    });
  }

  // Wire up overlay-detail inputs
  ['ovl_163j_gross_receipts','ovl_163j_rptb_election','ovl_163j_ati','ovl_163j_total_interest',
   'ovl_461l_filing','ovl_461l_other_income','ovl_461l_existing_nol','ovl_461l_threshold_override',
   'ovl_199a_qualifies','ovl_199a_above_threshold','ovl_199a_w2_wages','ovl_199a_ubia',
   'ovl_ptet_election','ovl_apportionment_states','ovl_member_residency','ovl_composite_return',
   'ovl_rollforward_detail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('change', () => { /* deferred to recompute */ });
      el.addEventListener('input', () => { /* deferred */ });
    }
  });
});

// =============================================================================
// COLLECT PHASE 6 DATA
// =============================================================================
function collectPhase6Data() {
  const v = id => { const el = document.getElementById(id); if (!el) return ''; return String(el.value).replace(/[$,\s%]/g, '').trim(); };
  const c = id => { const el = document.getElementById(id); return el ? el.checked : false; };
  const n = id => parseFloat(v(id)) || 0;

  return {
    enable163j: c('overlay_163j'),
    enable461l: c('overlay_461l'),
    enable199a: c('overlay_199a'),
    sec163j: {
      grossReceipts: n('ovl_163j_gross_receipts'),
      rptbElection: v('ovl_163j_rptb_election') === 'yes',
      ati: n('ovl_163j_ati'),
      totalInterest: n('ovl_163j_total_interest')
    },
    sec461l: {
      filing: v('ovl_461l_filing') || 'mfj',
      otherIncome: n('ovl_461l_other_income'),
      existingNOL: n('ovl_461l_existing_nol'),
      thresholdOverride: n('ovl_461l_threshold_override')
    },
    sec199a: {
      qualifies: v('ovl_199a_qualifies') || 'safe_harbor',
      aboveThreshold: v('ovl_199a_above_threshold') === 'yes',
      w2Wages: n('ovl_199a_w2_wages'),
      ubia: n('ovl_199a_ubia')
    },
    state: {
      ptetElection: v('ovl_ptet_election') || 'evaluate',
      apportionmentStates: (v('ovl_apportionment_states') || '').split(',').map(s => s.trim().toUpperCase()).filter(s => s.length === 2),
      memberResidency: v('ovl_member_residency') || 'all_resident',
      compositeReturn: v('ovl_composite_return') || 'evaluate'
    },
    rollForwardDetail: v('ovl_rollforward_detail') || 'snapshots'
  };
}

// =============================================================================
// §163(j) ENGINE — Interest Limitation
// =============================================================================
function analyze163j(data, results, p6Data) {
  if (!p6Data.enable163j) return null;
  const c = p6Data.sec163j;
  const findings = [];

  // Determine if exempt under small-business exception
  const exempt = c.grossReceipts > 0 && c.grossReceipts <= SEC_448C_THRESHOLD_2025;
  if (exempt) {
    findings.push({ type: 'good', text: `Average gross receipts of ${fmt$(c.grossReceipts)} are at or below the ${fmt$(SEC_448C_THRESHOLD_2025)} small-business threshold. The partnership is exempt from § 163(j) under § 448(c). All business interest is fully deductible.` });
    return {
      exempt: true,
      rptbElection: false,
      totalInterest: c.totalInterest > 0 ? c.totalInterest : results.totalInterest,
      allowedInterest: c.totalInterest > 0 ? c.totalInterest : results.totalInterest,
      disallowedInterest: 0,
      depreciationImpact: 0,
      findings
    };
  }

  // Not exempt — apply the limit
  const totalInt = c.totalInterest > 0 ? c.totalInterest : results.totalInterest;

  if (c.rptbElection) {
    // Elected out — full deduction but ADS depreciation required
    findings.push({ type: 'info', text: `Real property trade or business election under § 163(j)(7)(B) made. The election is <strong>irrevocable</strong>. Full interest deduction permitted but real estate assets depreciate under ADS: residential 30 years, nonresidential 40 years, qualified improvement property 20 years. For a leveraged real estate development, this election generally favors the partnership.` });

    // Approximate the depreciation impact: ADS vs GDS difference
    // Building basis: budget.hard + portion of budget.land allocated to improvements is land (non-depreciable)
    // For simplicity, assume building depreciation difference on hard cost
    const buildingBasis = data.budget.hard + data.budget.contingency;
    const adsLife = 40; // nonresidential default
    const gdsLife = 39;
    const adsAnnual = buildingBasis / adsLife;
    const gdsAnnual = buildingBasis / gdsLife;
    const depDiff = (gdsAnnual - adsAnnual) * results.years;
    findings.push({ type: 'info', text: `Approximate depreciation reduction from ADS election: ${fmt$(depDiff)} over the ${results.years.toFixed(1)}-year hold period. (Building basis ${fmt$(buildingBasis)} × difference between GDS ${gdsLife}-year and ADS ${adsLife}-year.) This is a deferral, not a permanent disallowance.` });

    return {
      exempt: false,
      rptbElection: true,
      totalInterest: totalInt,
      allowedInterest: totalInt,
      disallowedInterest: 0,
      depreciationImpact: -depDiff,
      findings
    };
  }

  // Not elected out — apply 30% ATI limit
  const limit = c.ati * 0.30;
  const allowed = Math.min(totalInt, limit);
  const disallowed = Math.max(0, totalInt - limit);
  if (disallowed > 0) {
    findings.push({ type: 'bad', text: `Interest exceeds 30% of ATI: ${fmt$(disallowed)} disallowed in current year. Carryforward indefinitely as business interest under § 163(j)(2). Consider electing real property trade or business status under § 163(j)(7)(B) (irrevocable; ADS depreciation tradeoff).` });
  } else {
    findings.push({ type: 'good', text: `Interest ${fmt$(totalInt)} is within the 30% × ATI limit of ${fmt$(limit)}. No disallowance.` });
  }

  return {
    exempt: false,
    rptbElection: false,
    totalInterest: totalInt,
    allowedInterest: allowed,
    disallowedInterest: disallowed,
    depreciationImpact: 0,
    findings
  };
}

// =============================================================================
// §461(l) ENGINE — Excess Business Loss
// =============================================================================
function analyze461l(data, results, p6Data) {
  if (!p6Data.enable461l) return null;
  const c = p6Data.sec461l;
  const findings = [];

  const threshold = c.thresholdOverride > 0 ? c.thresholdOverride : SEC_461L_2026[c.filing];

  // For each member, compute the §461(l) outcome
  const memberOutcomes = [];
  for (const cls of data.memberClasses) {
    if (cls.classType === 'sponsor') continue; // sponsor typically structured separately
    const classReturn = results.classReturns.find(r => r.class.id === cls.id);
    if (!classReturn) continue;

    // Approximate member's loss from this deal in the current year
    // For construction-year deals, the partnership generates large losses (interest + dep + soft costs)
    // Simplification: assume year-1 loss = (interest + dep) × share - operating income
    // For Phase 6 MVP, use a simple proxy: half of the partnership's first-year operating loss
    const totalCap = data.memberClasses.reduce((s, c) => s + c.capital, 0);
    const memberShare = totalCap > 0 ? cls.capital / totalCap : 0;

    // Construction-year loss approximation: interest + soft + dep allocation
    // Use the operating-loss estimate as: total fees + interest carry, allocated proportionately
    const annualOperatingLoss = (results.totalInterest + (data.budget.soft || 0)) / Math.max(results.years, 1);
    const memberLoss = -annualOperatingLoss * memberShare; // negative = loss

    // Aggregate with other business income
    const aggregateBusinessIncome = memberLoss + c.otherIncome;
    const excessLoss = Math.min(0, aggregateBusinessIncome) < 0 ?
      Math.max(0, -aggregateBusinessIncome - threshold) : 0;

    const currentYearAllowed = aggregateBusinessIncome >= 0 ? aggregateBusinessIncome :
      Math.max(aggregateBusinessIncome, -threshold);

    memberOutcomes.push({
      class: cls,
      memberLoss,
      otherIncome: c.otherIncome,
      aggregate: aggregateBusinessIncome,
      excessLoss,
      currentYearAllowed,
      carryforwardToNOL: excessLoss
    });

    if (excessLoss > 0) {
      findings.push({ type: 'warn', text: `<strong>${escapeHtml(cls.name)}:</strong> aggregate business loss ${fmt$(-aggregateBusinessIncome)} exceeds threshold ${fmt$(threshold)}. Excess of ${fmt$(excessLoss)} disallowed in current year and carries to next year as § 172 NOL. NOL subject to 80% of taxable income limit under § 172(a)(2).` });
    }
  }

  if (findings.length === 0) {
    findings.push({ type: 'good', text: `No § 461(l) excess business loss issues identified. All member losses currently deductible.` });
  }

  return {
    filing: c.filing,
    threshold,
    existingNOL: c.existingNOL,
    memberOutcomes,
    findings
  };
}

// =============================================================================
// §199A ENGINE — Qualified Business Income Deduction
// =============================================================================
function analyze199a(data, results, p6Data) {
  if (!p6Data.enable199a) return null;
  const c = p6Data.sec199a;
  const findings = [];

  // Threshold check
  if (c.qualifies === 'no') {
    findings.push({ type: 'bad', text: 'Rental activity does not rise to trade or business level. No § 199A deduction available. Most triple-net leases without active landlord involvement fail both Rev. Proc. 2019-38 and common-law analysis.' });
    return { qualifies: false, totalDeduction: 0, memberOutcomes: [], findings };
  }

  if (c.qualifies === 'safe_harbor') {
    findings.push({ type: 'good', text: 'Rev. Proc. 2019-38 safe harbor: 250+ hours of rental services performed annually, separate books and records maintained, contemporaneous records of services, and (for properties placed in service over 4 years prior) the safe-harbor statement filed with the return. § 199A deduction available.' });
  } else if (c.qualifies === 'common_law') {
    findings.push({ type: 'info', text: 'Common-law trade or business analysis: rental qualifies as a § 162 trade or business based on regular and continuous activity. Less safe than Rev. Proc. 2019-38 but available for properties that do not meet the safe harbor.' });
  } else if (c.qualifies === 'dealer') {
    findings.push({ type: 'info', text: 'Dealer activity (e.g., build-and-sell residential development): § 199A deduction available on net ordinary income from the trade or business. Subject to W-2 wage / UBIA limitation above income threshold.' });
  }

  // For each member, compute the deduction
  const memberOutcomes = [];
  for (const cls of data.memberClasses) {
    if (cls.classType === 'sponsor') continue;
    const classReturn = results.classReturns.find(r => r.class.id === cls.id);
    if (!classReturn) continue;

    // Member's QBI = share of partnership ordinary income (or 1250 unrecaptured gain in dealer case)
    // For non-dealer: ordinary rental income only (LTCG on sale excluded from QBI)
    // For dealer: ordinary income from sale included
    const totalCap = data.memberClasses.reduce((s, c) => s + c.capital, 0);
    const memberShare = totalCap > 0 ? cls.capital / totalCap : 0;

    let qbi;
    if (c.qualifies === 'dealer') {
      // Dealer: most of the profit is ordinary income
      qbi = Math.max(0, classReturn.profit);
    } else {
      // Rental: only ordinary rental income, not capital gain on sale
      // Approximation: small fraction of total profit (most comes from gain on sale)
      // For Phase 6, assume 20% of profit is ordinary rental
      qbi = Math.max(0, classReturn.profit * 0.20);
    }

    const tentativeDeduction = qbi * 0.20;

    // Wage/UBIA limit (above threshold only)
    let wageUbiaLimit = Infinity;
    if (c.aboveThreshold) {
      const wageLimit = c.w2Wages * memberShare * 0.50;
      const wageUbiaLimit2 = c.w2Wages * memberShare * 0.25 + c.ubia * memberShare * 0.025;
      wageUbiaLimit = Math.max(wageLimit, wageUbiaLimit2);
    }

    const finalDeduction = Math.min(tentativeDeduction, wageUbiaLimit);
    const limitedByWageUbia = c.aboveThreshold && finalDeduction < tentativeDeduction;

    memberOutcomes.push({
      class: cls,
      qbi,
      tentativeDeduction,
      wageUbiaLimit,
      finalDeduction,
      limitedByWageUbia,
      taxBenefit: finalDeduction * 0.37 // approximate at top marginal rate
    });

    if (limitedByWageUbia) {
      findings.push({ type: 'warn', text: `<strong>${escapeHtml(cls.name)}:</strong> § 199A deduction reduced from ${fmt$(tentativeDeduction)} (20% of QBI) to ${fmt$(finalDeduction)} by wage/UBIA limit. Consider increasing partnership W-2 wages (in-source management) or qualified property basis (cost segregation increases recovery but not UBIA).` });
    }
  }

  const totalDeduction = memberOutcomes.reduce((s, m) => s + m.finalDeduction, 0);
  if (totalDeduction > 0 && findings.filter(f => f.type === 'warn').length === 0) {
    findings.push({ type: 'good', text: `Aggregate § 199A deduction across LP members: ${fmt$(totalDeduction)}. Estimated federal tax benefit at top marginal rate: ${fmt$(totalDeduction * 0.37)}.` });
  }

  return {
    qualifies: c.qualifies,
    aboveThreshold: c.aboveThreshold,
    totalDeduction,
    memberOutcomes,
    findings
  };
}

// =============================================================================
// PTET / MULTI-STATE / NONRESIDENT WITHHOLDING ENGINE
// =============================================================================
function analyzeStateOverlay(data, results, p6Data) {
  const c = p6Data.state;
  const propertyStateData = STATE_DATA.find(s => s.abbr === data.propertyState);
  if (!propertyStateData) return null;

  const findings = [];
  const apportionmentRows = [];

  // PTET analysis
  let ptetAnalysis = null;
  if (propertyStateData.incTax > 0 && propertyStateData.ptet) {
    // Estimate state tax payable on the deal's profit
    const lpTotalProfit = results.totalLPDist - results.totalLPCap;
    const stateTaxAtMember = Math.max(0, lpTotalProfit) * propertyStateData.incTax;
    const stateTaxAtEntity = stateTaxAtMember; // same rate, just shifted to entity

    // Federal benefit from PTET deduction (member can deduct full SALT at entity level)
    // Member's federal benefit: state tax × federal marginal rate × (1 - what would have been SALT-capped)
    // Approximation: full federal deduction of state tax at federal marginal rate
    const federalDeductionBenefit = stateTaxAtEntity * 0.37; // approx top fed marginal

    // Net benefit vs no PTET: federal deduction benefit (assuming SALT was capped)
    const netBenefit = federalDeductionBenefit;

    ptetAnalysis = {
      state: propertyStateData.abbr,
      stateName: propertyStateData.name,
      stateTaxAtMember,
      stateTaxAtEntity,
      federalDeductionBenefit,
      netBenefit,
      recommendation: c.ptetElection === 'yes' ? 'elected' :
                      c.ptetElection === 'no' ? 'rejected' : 'recommended_evaluate'
    };

    if (c.ptetElection === 'evaluate') {
      findings.push({ type: 'good', text: `<strong>PTET evaluation:</strong> ${propertyStateData.name} offers a pass-through entity tax election. Estimated state tax of ${fmt$(stateTaxAtMember)} paid at the entity level becomes a partnership-level deduction, providing approximately ${fmt$(federalDeductionBenefit)} of federal tax savings versus the $10,000 SALT-capped alternative. <strong>Net benefit: ${fmt$(netBenefit)}.</strong> Confirm member-level credit mechanics and timing requirements.` });
    } else if (c.ptetElection === 'yes') {
      findings.push({ type: 'info', text: `PTET election made for ${propertyStateData.name}. Estimated entity-level state tax: ${fmt$(stateTaxAtEntity)}; federal deduction benefit: ${fmt$(federalDeductionBenefit)}. Confirm filing deadline and any annual-election renewal requirement.` });
    }
  } else if (propertyStateData.incTax === 0) {
    findings.push({ type: 'good', text: `${propertyStateData.name} has no state income tax. No PTET or composite return analysis required at the property state level.` });
  } else if (propertyStateData.incTax > 0 && !propertyStateData.ptet) {
    findings.push({ type: 'warn', text: `${propertyStateData.name} has state income tax but no PTET election available. Members will bear state tax personally, subject to the $10,000 SALT cap at the federal level.` });
  }

  // Apportionment to additional states
  for (const stateAbbr of c.apportionmentStates) {
    const stateInfo = STATE_DATA.find(s => s.abbr === stateAbbr);
    if (!stateInfo) continue;
    apportionmentRows.push({
      state: stateAbbr,
      stateName: stateInfo.name,
      incTax: stateInfo.incTax,
      ptet: stateInfo.ptet,
      conformity: {
        bonus: stateInfo.bonus,
        sec163j: stateInfo.sec163j,
        sec461l: stateInfo.sec461l,
        sec199a: stateInfo.sec199a
      }
    });
  }

  // Nonresident withholding analysis
  let nonresidentWH = null;
  if (propertyStateData.incTax > 0 && c.memberResidency !== 'all_resident') {
    const lpTotalProfit = Math.max(0, results.totalLPDist - results.totalLPCap);
    const nonresidentShare = c.memberResidency === 'all_nonresident' ? 1.0 : 0.5; // rough estimate
    const nonresidentProfit = lpTotalProfit * nonresidentShare;
    const withholdingRate = propertyStateData.incTax; // approximate at top state rate
    const withholdingAmount = nonresidentProfit * withholdingRate;

    nonresidentWH = {
      state: propertyStateData.abbr,
      stateName: propertyStateData.name,
      nonresidentProfit,
      withholdingRate,
      withholdingAmount,
      compositeAvailable: c.compositeReturn !== 'no'
    };

    findings.push({ type: 'info', text: `<strong>Nonresident withholding:</strong> approximately ${fmt$(withholdingAmount)} of state tax withholding required on ${fmt$(nonresidentProfit)} of nonresident income at the ${(withholdingRate * 100).toFixed(2)}% state top rate. ${c.compositeReturn === 'yes' ? 'Composite return election simplifies nonresident filing.' : c.compositeReturn === 'no' ? 'Individual nonresident filings required by each member.' : 'Evaluate composite return option vs. individual nonresident filing.'}` });
  }

  return {
    propertyState: propertyStateData,
    ptetAnalysis,
    apportionmentRows,
    nonresidentWH,
    findings
  };
}

// =============================================================================
// YEAR-BY-YEAR CAPITAL ACCOUNT ROLL-FORWARD
// =============================================================================
function calculateAnnualRollForward(data, results, allocData, p6Data) {
  if (p6Data.rollForwardDetail !== 'annual') return null;

  const years = Math.max(1, Math.ceil(results.years));
  const yearlyRows = [];
  const totalCap = data.memberClasses.reduce((s, c) => s + c.capital, 0);
  const totalDebt = data.seniorLoan + data.memberDebt.reduce((s, d) => s + d.amount, 0);

  for (const cls of data.memberClasses) {
    const memberShare = totalCap > 0 ? cls.capital / totalCap : 0;
    const classReturn = results.classReturns.find(r => r.class.id === cls.id);

    // Compute share of partnership debt
    let debtShare = totalCap > 0 ? totalDebt * memberShare : 0;
    if (data.senior752 === 'recourse' && (cls.classType === 'sponsor' || cls.classType === 'lp_guarantor')) {
      const guarantorCap = data.memberClasses
        .filter(c => c.classType === 'sponsor' || c.classType === 'lp_guarantor')
        .reduce((s, c) => s + c.capital, 0);
      debtShare = guarantorCap > 0 ? data.seniorLoan * (cls.capital / guarantorCap) : 0;
    }

    // Distribute the total allocation across years
    // For construction/value-add: front-loaded loss allocations from interest+soft, then gain at exit
    const totalAllocation = classReturn ? classReturn.distribution - cls.capital : 0;

    // Simple model: in operating years (1 to years-1) allocate small operating items;
    // in final year (years), allocate the disposition gain
    let openingBalance = cls.capital;
    const memberYears = [];
    for (let y = 1; y <= years; y++) {
      let allocation;
      if (y === years) {
        // Final year: most of the gain
        allocation = totalAllocation * 0.85;
      } else {
        // Operating years: small (or negative) operating income
        allocation = totalAllocation * 0.15 / Math.max(years - 1, 1);
      }
      const distribution = y === years ? (classReturn ? classReturn.distribution : 0) : 0;
      const closing = openingBalance + allocation - distribution;
      const outsideBasis = closing + debtShare;
      memberYears.push({
        year: y,
        opening: openingBalance,
        allocation,
        distribution,
        closing,
        outsideBasis
      });
      openingBalance = closing;
    }

    yearlyRows.push({
      class: cls,
      years: memberYears
    });
  }

  return { years, rows: yearlyRows };
}

// =============================================================================
// EXTEND recomputeAll FOR PHASE 6
// =============================================================================
const _phase4RecomputeAll = recomputeAll;
recomputeAll = function() {
  const data = collectFormData();
  const allocData = collectAllocationData();
  const p3Data = collectPhase3Data();
  const p4Data = collectPhase4Data();
  const p6Data = collectPhase6Data();
  const results = calculateDeal(data);
  results.sensitivity = calculateSensitivity(data);
  results.sec704c = calculate704cAggregate(data, allocData, results.years);
  results.rollForward = calculateCapitalAccountRollForward(data, results, allocData);
  results.annualRollForward = calculateAnnualRollForward(data, results, allocData, p6Data);
  results.sec754Analysis = analyze754(data, results, allocData, results.rollForward);
  results.firpta = analyzeFIRPTA(data, results, p3Data);
  results.ubti = analyzeUBTI(data, results, p3Data);
  results.blockerLeakage = analyzeBlockerLeakage(data, results, p3Data);
  results.recommendations = generateRecommendations(data, results, p3Data, results.firpta, results.ubti);
  results.compliance = runComplianceDashboard(data, p4Data);
  results.sec163j = analyze163j(data, results, p6Data);
  results.sec461l = analyze461l(data, results, p6Data);
  results.sec199a = analyze199a(data, results, p6Data);
  results.stateOverlay = analyzeStateOverlay(data, results, p6Data);
  results.allocData = allocData;
  results.p3Data = p3Data;
  results.p4Data = p4Data;
  results.p6Data = p6Data;
  DB.lastResults = results;

  updateCapitalStackSummary();
  updateBudgetSummary(results);
  renderResults(results);
  renderSec704cComparison(results);
  renderCapitalAccountRollForward(results);
  renderSec754Analysis(results);
  renderFIRPTA(results);
  renderUBTI(results);
  renderBlockerLeakage(results);
  renderComplianceDashboard(results);
  renderRecommendations(results);
  render163j(results);
  render461l(results);
  render199a(results);
  renderStateOverlay(results);
  renderInvestorProfiles();
  updateComplianceModuleVisibility();
};

// =============================================================================
// RENDERERS
// =============================================================================
function render163j(results) {
  const target = document.getElementById('overlay_163j_output_wrap');
  if (!target) return;
  const r = results.sec163j;
  if (!r) { target.innerHTML = ''; return; }

  let html = `<div class="overlay-output-panel">
    <div class="oop-header">
      <div class="oop-title">§ 163(j) — Interest Limitation</div>
      <div class="oop-cite">26 U.S.C. § 163(j)</div>
    </div>
    <div class="oop-grid">
      <div class="oop-stat ${r.exempt ? '' : (r.disallowedInterest > 0 ? 'bad' : '')}">
        <div class="oop-stat-label">Status</div>
        <div class="oop-stat-value ${r.exempt ? 'good' : (r.disallowedInterest > 0 ? 'bad' : 'good')}">${r.exempt ? 'EXEMPT' : (r.rptbElection ? 'ELECTED OUT' : 'SUBJECT')}</div>
      </div>
      <div class="oop-stat">
        <div class="oop-stat-label">Total Interest</div>
        <div class="oop-stat-value">${fmt$(r.totalInterest)}</div>
      </div>
      <div class="oop-stat">
        <div class="oop-stat-label">Allowed</div>
        <div class="oop-stat-value good">${fmt$(r.allowedInterest)}</div>
      </div>
      <div class="oop-stat ${r.disallowedInterest > 0 ? 'bad' : ''}">
        <div class="oop-stat-label">Disallowed / Carryforward</div>
        <div class="oop-stat-value ${r.disallowedInterest > 0 ? 'bad' : 'good'}">${fmt$(r.disallowedInterest)}</div>
      </div>
    </div>`;
  for (const f of r.findings) {
    html += `<div class="oop-detail"><strong>${f.type === 'good' ? '✓' : f.type === 'bad' ? '!' : 'ℹ'}</strong> ${f.text}</div>`;
  }
  html += '</div>';
  target.innerHTML = html;
}

function render461l(results) {
  const target = document.getElementById('overlay_461l_output_wrap');
  if (!target) return;
  const r = results.sec461l;
  if (!r) { target.innerHTML = ''; return; }

  const totalExcess = r.memberOutcomes.reduce((s, m) => s + m.excessLoss, 0);

  let html = `<div class="overlay-output-panel">
    <div class="oop-header">
      <div class="oop-title">§ 461(l) — Excess Business Loss</div>
      <div class="oop-cite">26 U.S.C. § 461(l); 2026 threshold</div>
    </div>
    <div class="oop-grid">
      <div class="oop-stat">
        <div class="oop-stat-label">Filing Status</div>
        <div class="oop-stat-value">${r.filing.toUpperCase()}</div>
      </div>
      <div class="oop-stat">
        <div class="oop-stat-label">2026 Threshold</div>
        <div class="oop-stat-value">${fmt$(r.threshold)}</div>
      </div>
      <div class="oop-stat ${totalExcess > 0 ? 'warn' : ''}">
        <div class="oop-stat-label">Aggregate Excess Loss</div>
        <div class="oop-stat-value ${totalExcess > 0 ? 'warn' : 'good'}">${fmt$(totalExcess)}</div>
      </div>
      <div class="oop-stat">
        <div class="oop-stat-label">Carryforward to § 172 NOL</div>
        <div class="oop-stat-value">${fmt$(totalExcess)}</div>
      </div>
    </div>`;

  if (r.memberOutcomes.length > 0) {
    html += '<table class="cap-acct-annual-table" style="margin-top:1rem;"><thead><tr><th>Member</th><th class="right">Loss from Deal</th><th class="right">Other Income</th><th class="right">Aggregate</th><th class="right">Excess Loss</th></tr></thead><tbody>';
    for (const m of r.memberOutcomes) {
      html += `<tr><td><strong>${escapeHtml(m.class.name)}</strong></td><td class="right">${fmt$(m.memberLoss)}</td><td class="right">${fmt$(m.otherIncome)}</td><td class="right">${fmt$(m.aggregate)}</td><td class="right">${fmt$(m.excessLoss)}</td></tr>`;
    }
    html += '</tbody></table>';
  }

  for (const f of r.findings) {
    html += `<div class="oop-detail" style="margin-top:1rem;">${f.text}</div>`;
  }
  html += '</div>';
  target.innerHTML = html;
}

function render199a(results) {
  const target = document.getElementById('overlay_199a_output_wrap');
  if (!target) return;
  const r = results.sec199a;
  if (!r) { target.innerHTML = ''; return; }

  let html = `<div class="overlay-output-panel green-accent">
    <div class="oop-header">
      <div class="oop-title">§ 199A — Qualified Business Income Deduction</div>
      <div class="oop-cite">26 U.S.C. § 199A; Rev. Proc. 2019-38</div>
    </div>
    <div class="oop-grid">
      <div class="oop-stat ${r.qualifies ? '' : 'bad'}">
        <div class="oop-stat-label">Trade or Business Status</div>
        <div class="oop-stat-value ${r.qualifies ? 'good' : 'bad'}">${r.qualifies === 'safe_harbor' ? 'SAFE HARBOR' : r.qualifies === 'common_law' ? 'COMMON LAW' : r.qualifies === 'dealer' ? 'DEALER' : 'NOT QBI'}</div>
      </div>
      <div class="oop-stat">
        <div class="oop-stat-label">Above Threshold</div>
        <div class="oop-stat-value">${r.aboveThreshold ? 'YES' : 'NO'}</div>
      </div>
      <div class="oop-stat">
        <div class="oop-stat-label">Aggregate Deduction</div>
        <div class="oop-stat-value good">${fmt$(r.totalDeduction)}</div>
      </div>
      <div class="oop-stat">
        <div class="oop-stat-label">Est. Federal Tax Benefit</div>
        <div class="oop-stat-value good">${fmt$(r.totalDeduction * 0.37)}</div>
      </div>
    </div>`;

  if (r.memberOutcomes.length > 0) {
    html += '<table class="cap-acct-annual-table" style="margin-top:1rem;"><thead><tr><th>Member</th><th class="right">QBI</th><th class="right">20% × QBI</th><th class="right">Wage/UBIA Limit</th><th class="right">Deduction</th></tr></thead><tbody>';
    for (const m of r.memberOutcomes) {
      html += `<tr><td><strong>${escapeHtml(m.class.name)}</strong></td><td class="right">${fmt$(m.qbi)}</td><td class="right">${fmt$(m.tentativeDeduction)}</td><td class="right">${m.wageUbiaLimit === Infinity ? '—' : fmt$(m.wageUbiaLimit)}</td><td class="right">${fmt$(m.finalDeduction)}</td></tr>`;
    }
    html += '</tbody></table>';
  }

  for (const f of r.findings) {
    html += `<div class="oop-detail" style="margin-top:1rem;">${f.text}</div>`;
  }
  html += '</div>';
  target.innerHTML = html;
}

function renderStateOverlay(results) {
  const target = document.getElementById('state_tax_overlay_output_wrap');
  if (!target) return;
  const r = results.stateOverlay;
  if (!r) { target.innerHTML = ''; return; }

  let html = `<div class="overlay-output-panel charcoal-accent">
    <div class="oop-header">
      <div class="oop-title">State Tax Overlays — PTET, Apportionment, Withholding</div>
      <div class="oop-cite">${escapeHtml(r.propertyState.name)}</div>
    </div>`;

  if (r.ptetAnalysis) {
    const p = r.ptetAnalysis;
    html += `<div class="oop-grid">
      <div class="oop-stat">
        <div class="oop-stat-label">PTET Available</div>
        <div class="oop-stat-value good">YES</div>
      </div>
      <div class="oop-stat">
        <div class="oop-stat-label">State Tax (at Member or Entity)</div>
        <div class="oop-stat-value">${fmt$(p.stateTaxAtMember)}</div>
      </div>
      <div class="oop-stat">
        <div class="oop-stat-label">Federal Deduction Benefit</div>
        <div class="oop-stat-value good">${fmt$(p.federalDeductionBenefit)}</div>
      </div>
      <div class="oop-stat">
        <div class="oop-stat-label">Net PTET Benefit</div>
        <div class="oop-stat-value good">${fmt$(p.netBenefit)}</div>
      </div>
    </div>`;
  }

  if (r.apportionmentRows.length > 0) {
    html += '<h4 style="margin-top:1.25rem;font-family:\'Gotham Bold\',\'Open Sans\',sans-serif;font-size:0.9rem;text-transform:uppercase;letter-spacing:1.2px;">Multi-State Apportionment</h4>';
    html += '<table class="cap-acct-annual-table"><thead><tr><th>State</th><th class="right">Top Rate</th><th>§168(k)</th><th>§163(j)</th><th>§461(l)</th><th>§199A</th><th>PTET</th></tr></thead><tbody>';
    for (const ap of r.apportionmentRows) {
      const flag = s => s === 'conform' ? 'Conform' : s === 'decouple' ? 'Decouple' : '—';
      html += `<tr><td><strong>${ap.state} — ${escapeHtml(ap.stateName)}</strong></td><td class="right">${(ap.incTax * 100).toFixed(2)}%</td><td>${flag(ap.conformity.bonus)}</td><td>${flag(ap.conformity.sec163j)}</td><td>${flag(ap.conformity.sec461l)}</td><td>${flag(ap.conformity.sec199a)}</td><td>${ap.ptet ? 'Available' : 'N/A'}</td></tr>`;
    }
    html += '</tbody></table>';
  }

  if (r.nonresidentWH) {
    const nw = r.nonresidentWH;
    html += `<div class="oop-detail" style="margin-top:1rem;"><strong>Nonresident Withholding:</strong> ${fmt$(nw.withholdingAmount)} at the ${(nw.withholdingRate * 100).toFixed(2)}% top rate of ${escapeHtml(nw.stateName)} on ${fmt$(nw.nonresidentProfit)} of nonresident-allocable income.</div>`;
  }

  for (const f of r.findings) {
    html += `<div class="oop-detail" style="margin-top:0.85rem;">${f.text}</div>`;
  }
  html += '</div>';
  target.innerHTML = html;
}

// Extend renderCapitalAccountRollForward to show year-by-year when configured
const _phase5RenderRollForward = renderCapitalAccountRollForward;
renderCapitalAccountRollForward = function(results) {
  _phase5RenderRollForward(results);
  // If annual roll-forward is enabled, add the detailed view below the snapshot table
  if (results.annualRollForward && results.annualRollForward.rows.length > 0) {
    const baseTable = document.getElementById('capital_account_table');
    if (!baseTable) return;
    // Remove any prior annual block
    const prior = document.getElementById('annual_rollforward_block');
    if (prior) prior.remove();

    const block = document.createElement('div');
    block.id = 'annual_rollforward_block';
    block.style.marginTop = '1.5rem';

    let html = '<h4 style="margin-top:0;font-family:\'Gotham Bold\',\'Open Sans\',sans-serif;font-size:0.9rem;text-transform:uppercase;letter-spacing:1.2px;">Year-by-Year Detail</h4>';
    for (const memberRow of results.annualRollForward.rows) {
      html += `<div style="margin-bottom:1.25rem;"><div style="font-weight:700;margin-bottom:0.4rem;">${escapeHtml(memberRow.class.name)}</div>`;
      html += '<table class="cap-acct-annual-table"><thead><tr><th>Year</th><th class="right">Opening</th><th class="right">Allocation</th><th class="right">Distribution</th><th class="right">Closing</th><th class="right">Outside Basis</th></tr></thead><tbody>';
      for (const y of memberRow.years) {
        html += `<tr class="year-row"><td>Year ${y.year}</td><td class="right">${fmt$(y.opening)}</td><td class="right">${(y.allocation >= 0 ? '+' : '') + fmt$(y.allocation)}</td><td class="right">${y.distribution > 0 ? '(' + fmt$(y.distribution) + ')' : '—'}</td><td class="right">${fmt$(y.closing)}</td><td class="right">${fmt$(y.outsideBasis)}</td></tr>`;
      }
      html += '</tbody></table></div>';
    }
    block.innerHTML = html;
    baseTable.parentNode.parentNode.insertBefore(block, baseTable.parentNode.nextSibling);
  } else {
    const prior = document.getElementById('annual_rollforward_block');
    if (prior) prior.remove();
  }
};

// =============================================================================
// EXTEND SAVE/LOAD FOR PHASE 6
// =============================================================================
const _phase4SaveJSON = saveJSON;
saveJSON = function() {
  const data = collectFormData();
  const phase6Inputs = {};
  ['ovl_163j_gross_receipts','ovl_163j_rptb_election','ovl_163j_ati','ovl_163j_total_interest',
   'ovl_461l_filing','ovl_461l_other_income','ovl_461l_existing_nol','ovl_461l_threshold_override',
   'ovl_199a_qualifies','ovl_199a_above_threshold','ovl_199a_w2_wages','ovl_199a_ubia',
   'ovl_ptet_election','ovl_apportionment_states','ovl_member_residency','ovl_composite_return',
   'ovl_rollforward_detail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) phase6Inputs[id] = el.value;
  });

  // Build same payload as Phase 4 plus phase6Inputs
  const payload = {
    version: 'phase-6',
    savedAt: new Date().toISOString(),
    state: {
      memberClasses: DB.memberClasses,
      memberDebt: DB.memberDebt,
      promoteTiers: DB.promoteTiers,
      sec704cLayers: DB.sec704cLayers,
      blockers: DB.blockers,
      investorProfiles: DB.investorProfiles,
      orgChart: { positionOverrides: DB.orgChart.positionOverrides, customNodes: DB.orgChart.nodes.filter(n => n.custom), customEdges: DB.orgChart.edges.filter(e => e.custom) },
      nextMemberId: DB.nextMemberId,
      nextDebtId: DB.nextDebtId,
      nextTierId: DB.nextTierId,
      nextLayerId: DB.nextLayerId,
      nextBlockerId: DB.nextBlockerId
    },
    formInputs: collectFormInputsForSave(),
    allocationInputs: {
      alloc_704b_method: document.getElementById('alloc_704b_method')?.value,
      alloc_capacct_maintenance: document.getElementById('alloc_capacct_maintenance')?.value,
      alloc_min_gain_chargeback: document.getElementById('alloc_min_gain_chargeback')?.value,
      alloc_704c_present: document.getElementById('alloc_704c_present')?.value,
      alloc_704c_parallel: document.getElementById('alloc_704c_parallel')?.value,
      alloc_704c_method: document.getElementById('alloc_704c_method')?.value,
      alloc_754_election: document.getElementById('alloc_754_election')?.value,
      alloc_anticipated_transfer: document.getElementById('alloc_anticipated_transfer')?.value,
      cost_seg_pct: document.getElementById('cost_seg_pct')?.value,
      cost_seg_allocation_target: document.getElementById('cost_seg_allocation_target')?.value,
      checkboxes: {
        alloc_1245_recapture: document.getElementById('alloc_1245_recapture')?.checked,
        alloc_1250_unrecaptured: document.getElementById('alloc_1250_unrecaptured')?.checked,
        alloc_cost_seg_pickup: document.getElementById('alloc_cost_seg_pickup')?.checked,
        alloc_nonrecourse_deduction: document.getElementById('alloc_nonrecourse_deduction')?.checked
      },
      droClasses: Array.from(document.querySelectorAll('.dro-checkbox')).filter(cb => cb.checked).map(cb => parseInt(cb.dataset.id, 10))
    },
    phase3Inputs: {
      firpta_is_usrpi: document.getElementById('firpta_is_usrpi')?.value,
      firpta_usrphc_status: document.getElementById('firpta_usrphc_status')?.value,
      firpta_domestic_controlled: document.getElementById('firpta_domestic_controlled')?.value,
      firpta_disposition_amount: document.getElementById('firpta_disposition_amount')?.value,
      ubti_acq_indebtedness: document.getElementById('ubti_acq_indebtedness')?.value,
      ubti_debt_basis_ratio: document.getElementById('ubti_debt_basis_ratio')?.value
    },
    phase4Inputs: (function() {
      const o = { checkboxes: {} };
      ['reit_num_shareholders','reit_top5_ownership','reit_re_income_pct',
       'reit_other_passive_income_pct','reit_re_assets_pct','reit_trs_pct',
       'reit_largest_issuer_pct','reit_distribution_pct',
       'qof_90_pct','qof_form_8996','qozb_70_pct','qozb_active_income_pct',
       'qozb_wcsh','qozb_sub_improvement','qozb_sin_business','qof_investor_hold',
       'tic_cotenants','tic_largest_interest','tic_unanimous','tic_fee_interest',
       'tic_proportionate','tic_debt','tic_manager','tic_tax_reporting',
       'dst_master_lease','dst_springing_llc'].forEach(id => { const el = document.getElementById(id); if (el) o[id] = el.value; });
      ['dst_sin_1','dst_sin_2','dst_sin_3','dst_sin_4','dst_sin_5','dst_sin_6','dst_sin_7'].forEach(id => { const el = document.getElementById(id); if (el) o.checkboxes[id] = el.checked; });
      return o;
    })(),
    phase6Inputs
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (data.projectName || 'deal').replace(/[^a-zA-Z0-9-_]/g, '_');
  a.href = url;
  a.download = `${name}-deal-builder-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const _phase4LoadJSON = loadJSON;
loadJSON = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const payload = JSON.parse(e.target.result);
      DB.memberClasses = payload.state.memberClasses || [];
      DB.memberDebt = payload.state.memberDebt || [];
      DB.promoteTiers = payload.state.promoteTiers || [];
      DB.sec704cLayers = payload.state.sec704cLayers || [];
      DB.blockers = payload.state.blockers || [];
      DB.investorProfiles = payload.state.investorProfiles || {};
      DB.nextMemberId = payload.state.nextMemberId || DB.memberClasses.length + 1;
      DB.nextDebtId = payload.state.nextDebtId || DB.memberDebt.length + 1;
      DB.nextTierId = payload.state.nextTierId || DB.promoteTiers.length + 1;
      DB.nextLayerId = payload.state.nextLayerId || DB.sec704cLayers.length + 1;
      DB.nextBlockerId = payload.state.nextBlockerId || DB.blockers.length + 1;
      if (payload.state.orgChart) {
        DB.orgChart.positionOverrides = payload.state.orgChart.positionOverrides || {};
        const customNodes = payload.state.orgChart.customNodes || [];
        const customEdges = payload.state.orgChart.customEdges || [];
        DB.orgChart.nodes = customNodes;
        DB.orgChart.edges = customEdges;
      }

      const setAll = (obj, type) => {
        if (!obj) return;
        for (const [id, val] of Object.entries(obj)) {
          if (id === 'checkboxes' || id === 'droClasses') continue;
          const el = document.getElementById(id);
          if (el) el.value = val;
        }
        if (obj.checkboxes) {
          for (const [id, val] of Object.entries(obj.checkboxes)) {
            const el = document.getElementById(id);
            if (el) el.checked = val;
          }
        }
      };

      setAll(payload.formInputs);
      setAll(payload.allocationInputs);
      setAll(payload.phase3Inputs);
      setAll(payload.phase4Inputs);
      setAll(payload.phase6Inputs);

      renderMemberClasses();
      renderMemberDebt();
      renderPromoteTiers();
      renderSec704cLayers();
      renderInvestorProfiles();
      renderBlockers();
      renderStateSummary();
      updateComplianceModuleVisibility();
      document.getElementById('deal_type_help').innerHTML = DEAL_TYPES[document.getElementById('deal_type').value]?.help || '';
      document.getElementById('jurisdiction_help').innerHTML = JURISDICTION_HELP[document.getElementById('jurisdiction').value] || '';
      document.getElementById('senior_752_help').innerHTML = SEC752_HELP[document.getElementById('senior_752_class').value] || '';
      document.getElementById('alloc_704b_help').innerHTML = SEC704B_HELP[document.getElementById('alloc_704b_method').value] || '';
      const cbType = document.getElementById('clawback_type').value;
      document.getElementById('clawback_threshold_group').style.display = cbType !== 'none' ? 'grid' : 'none';
      document.getElementById('sec704c_layers_wrap').style.display = document.getElementById('alloc_704c_present').value === 'yes' ? 'block' : 'none';
      document.getElementById('dro_group').style.display = document.getElementById('alloc_704b_method').value === 'see_dro' ? 'block' : 'none';
      document.getElementById('cost_seg_alloc_group').style.display = document.getElementById('alloc_cost_seg_pickup').checked ? 'grid' : 'none';
      // Phase 6 overlay-detail visibility
      ['163j','461l','199a'].forEach(k => {
        const cb = document.getElementById('overlay_' + k);
        const detail = document.getElementById('overlay_' + k + '_detail');
        if (cb && detail) detail.style.display = cb.checked ? 'block' : 'none';
      });

      recomputeAll();
      alert(`Deal loaded: ${payload.formInputs?.project_name || 'unnamed'} (version: ${payload.version}, saved ${payload.savedAt})`);
    } catch (err) {
      alert('Error loading file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

document.addEventListener('DOMContentLoaded', () => {
  const loadInput = document.getElementById('load_json_input');
  if (loadInput) {
    const newInput = loadInput.cloneNode(true);
    loadInput.parentNode.replaceChild(newInput, loadInput);
    newInput.addEventListener('change', loadJSON);
  }
});



// =============================================================================
// =============================================================================
//                  PHASE 7 — DEAL DOCUMENT PACKAGE
//   Three securities levels (Reg D 506(b) F&F / 506(b) Sophisticated / 506(c))
//   Full document stack assembly with substantive templates
// =============================================================================
// =============================================================================

// Extend DB state
DB.signatories = [];
DB.investors = [];
DB.nextSignatoryId = 1;
DB.nextInvestorId = 1;

// =============================================================================
// CONSTANTS — Accredited Investor categories under Rule 501(a)
// =============================================================================
const AI_CATEGORIES = {
  '501a1': { label: 'Bank, savings institution, broker-dealer, insurance company, investment company, etc.', cite: 'Rule 501(a)(1)' },
  '501a2': { label: 'Private business development company', cite: 'Rule 501(a)(2)' },
  '501a3': { label: 'Tax-exempt organization, corporation, partnership, or LLC with assets > $5M', cite: 'Rule 501(a)(3)' },
  '501a4': { label: 'Director, executive officer, or general partner of the issuer', cite: 'Rule 501(a)(4)' },
  '501a5_income': { label: 'Individual with income > $200K (or $300K joint) for last 2 years and expected current year', cite: 'Rule 501(a)(5)' },
  '501a5_networth': { label: 'Individual with net worth > $1M (excluding primary residence)', cite: 'Rule 501(a)(5)' },
  '501a6': { label: 'Trust with assets > $5M, not formed to acquire the securities, with sophisticated decision-maker', cite: 'Rule 501(a)(6)' },
  '501a7': { label: 'Entity in which all equity owners are accredited investors', cite: 'Rule 501(a)(7)' },
  '501a8': { label: 'Holder of designated professional certification (Series 7, 65, 82) in good standing', cite: 'Rule 501(a)(8)' },
  '501a9': { label: 'Family office with > $5M AUM, not formed to acquire securities, directed by sophisticated person', cite: 'Rule 501(a)(9)' },
  '501a10': { label: 'Family client of a family office described in (a)(9)', cite: 'Rule 501(a)(10)' },
  '501a11': { label: 'Knowledgeable employee of a private fund issuer', cite: 'Rule 501(a)(11)' }
};

const INVESTOR_TYPES = {
  individual: 'Individual',
  joint: 'Joint Individuals (spouses)',
  rev_trust: 'Revocable Trust',
  irrev_trust: 'Irrevocable Trust',
  llc: 'Limited Liability Company',
  corp: 'Corporation',
  lp: 'Limited Partnership',
  ira: 'IRA / Self-Directed IRA',
  qualified_plan: 'Qualified Retirement Plan',
  family_office: 'Family Office',
  foundation: 'Foundation',
  other: 'Other (specify in name)'
};

const SIGNING_CAPACITY = {
  self: 'Individually (Self)',
  trustee: 'Trustee',
  authorized_officer: 'Authorized Officer',
  manager: 'Manager',
  managing_member: 'Managing Member',
  general_partner: 'General Partner',
  attorney_in_fact: 'Attorney-in-Fact',
  ira_custodian: 'IRA Custodian (For Benefit Of)',
  other: 'Other'
};

// =============================================================================
// INITIALIZATION
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  initDealPackageUI();
});

function initDealPackageUI() {
  // Seed default signatory if list empty
  if (DB.signatories.length === 0) {
    DB.signatories.push({
      id: DB.nextSignatoryId++,
      name: '',
      title: 'Manager',
      capacity: 'manager',
      entity: 'issuer'
    });
  }

  renderSignatories();
  renderInvestors();
  updateInvestorSummary();

  // Wire add buttons
  const addSig = document.getElementById('add_signatory');
  if (addSig) {
    addSig.addEventListener('click', () => {
      DB.signatories.push({
        id: DB.nextSignatoryId++,
        name: '',
        title: '',
        capacity: 'manager',
        entity: 'issuer'
      });
      renderSignatories();
    });
  }

  const addInv = document.getElementById('add_investor');
  if (addInv) {
    addInv.addEventListener('click', () => {
      DB.investors.push({
        id: DB.nextInvestorId++,
        name: '',
        type: 'individual',
        address: '',
        email: '',
        capital: 0,
        memberClassId: DB.memberClasses[0]?.id || null,
        aiCategory: '501a5_income',
        signingCapacity: 'self'
      });
      renderInvestors();
      updateInvestorSummary();
    });
  }

  // Wire issuer-name suggestion from project name
  const issuerNameEl = document.getElementById('dp_issuer_name');
  const projectNameEl = document.getElementById('project_name');
  if (issuerNameEl && projectNameEl && !issuerNameEl.value) {
    issuerNameEl.placeholder = projectNameEl.value ? `e.g., ${projectNameEl.value} Holdings LLC` : 'e.g., Project Holdings LLC';
  }

  // Wire generate button
  const genBtn = document.getElementById('generate_deal_package');
  if (genBtn) {
    genBtn.addEventListener('click', generateDealPackage);
  }

  // Sponsor entity individual toggle
  const sponsorIndCb = document.getElementById('dp_sponsor_individual');
  const sponsorSection = document.getElementById('dp_sponsor_entity_section');
  if (sponsorIndCb && sponsorSection) {
    const updateSponsorVisibility = () => {
      sponsorSection.style.display = sponsorIndCb.checked ? 'none' : 'block';
    };
    updateSponsorVisibility();
    sponsorIndCb.addEventListener('change', updateSponsorVisibility);
  }
}

// =============================================================================
// SIGNATORIES RENDERER
// =============================================================================
function renderSignatories() {
  const container = document.getElementById('signatories_container');
  if (!container) return;
  container.innerHTML = '';

  const capacityOpts = Object.entries(SIGNING_CAPACITY).map(([k, v]) =>
    `<option value="${k}">${v}</option>`).join('');

  for (const sig of DB.signatories) {
    const card = document.createElement('div');
    card.className = 'signatory-card';
    card.innerHTML = `
      <div class="sig-header">
        <span class="sig-badge">Signatory</span>
        <button class="mc-remove" type="button" data-id="${sig.id}">Remove</button>
      </div>
      <div class="sig-fields">
        <div class="mc-field-mini">
          <label>Full Legal Name</label>
          <input type="text" class="sig-name" data-id="${sig.id}" value="${escapeHtml(sig.name)}" placeholder="e.g., Paul K. Donovan, Esq." />
        </div>
        <div class="mc-field-mini">
          <label>Title</label>
          <input type="text" class="sig-title" data-id="${sig.id}" value="${escapeHtml(sig.title)}" placeholder="e.g., Manager" />
        </div>
        <div class="mc-field-mini">
          <label>Signing Capacity</label>
          <select class="sig-capacity" data-id="${sig.id}">${capacityOpts}</select>
        </div>
        <div class="mc-field-mini">
          <label>Signs For</label>
          <select class="sig-entity" data-id="${sig.id}">
            <option value="issuer">Issuer Only</option>
            <option value="sponsor">Sponsor Only</option>
            <option value="both">Issuer &amp; Sponsor</option>
          </select>
        </div>
      </div>`;
    container.appendChild(card);
    card.querySelector('.sig-capacity').value = sig.capacity;
    card.querySelector('.sig-entity').value = sig.entity;
  }

  // Wire handlers
  container.querySelectorAll('.sig-name, .sig-title').forEach(el => {
    el.addEventListener('input', e => {
      const id = parseInt(e.target.dataset.id, 10);
      const sig = DB.signatories.find(s => s.id === id);
      if (!sig) return;
      if (e.target.classList.contains('sig-name')) sig.name = e.target.value;
      if (e.target.classList.contains('sig-title')) sig.title = e.target.value;
    });
  });
  container.querySelectorAll('.sig-capacity, .sig-entity').forEach(el => {
    el.addEventListener('change', e => {
      const id = parseInt(e.target.dataset.id, 10);
      const sig = DB.signatories.find(s => s.id === id);
      if (!sig) return;
      if (e.target.classList.contains('sig-capacity')) sig.capacity = e.target.value;
      if (e.target.classList.contains('sig-entity')) sig.entity = e.target.value;
    });
  });
  container.querySelectorAll('.mc-remove').forEach(b => {
    b.addEventListener('click', e => {
      const id = parseInt(e.target.dataset.id, 10);
      DB.signatories = DB.signatories.filter(s => s.id !== id);
      renderSignatories();
    });
  });
}

// =============================================================================
// INVESTORS RENDERER
// =============================================================================
function renderInvestors() {
  const container = document.getElementById('investors_container');
  if (!container) return;
  container.innerHTML = '';

  if (DB.investors.length === 0) {
    container.innerHTML = '<p class="db-help-block" style="margin:0 0 1rem 0;">No investors added yet. Click below to add the first investor.</p>';
    return;
  }

  const typeOpts = Object.entries(INVESTOR_TYPES).map(([k, v]) =>
    `<option value="${k}">${v}</option>`).join('');
  const aiOpts = Object.entries(AI_CATEGORIES).map(([k, v]) =>
    `<option value="${k}">${v.cite} — ${v.label}</option>`).join('');
  const capacityOpts = Object.entries(SIGNING_CAPACITY).map(([k, v]) =>
    `<option value="${k}">${v}</option>`).join('');
  const classOpts = DB.memberClasses.map(c =>
    `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join('');

  DB.investors.forEach((inv, idx) => {
    const card = document.createElement('div');
    card.className = 'investor-card';
    card.innerHTML = `
      <div class="inv-header">
        <span class="inv-badge">Investor ${idx + 1}</span>
        <button class="mc-remove" type="button" data-id="${inv.id}">Remove</button>
      </div>
      <div class="inv-fields-row1">
        <div class="mc-field-mini">
          <label>Legal Name</label>
          <input type="text" class="inv-name" data-id="${inv.id}" value="${escapeHtml(inv.name)}" placeholder="e.g., John A. Smith / Smith Family Trust" />
        </div>
        <div class="mc-field-mini">
          <label>Investor Type</label>
          <select class="inv-type" data-id="${inv.id}">${typeOpts}</select>
        </div>
        <div class="mc-field-mini">
          <label>Mailing Address</label>
          <input type="text" class="inv-address" data-id="${inv.id}" value="${escapeHtml(inv.address)}" placeholder="Street, City, State, ZIP" />
        </div>
        <div class="mc-field-mini">
          <label>Capital Commitment ($)</label>
          <input type="number" class="inv-capital" data-id="${inv.id}" value="${inv.capital}" min="0" step="10000" />
        </div>
      </div>
      <div class="inv-fields-row2">
        <div class="mc-field-mini">
          <label>Email (optional)</label>
          <input type="email" class="inv-email" data-id="${inv.id}" value="${escapeHtml(inv.email)}" placeholder="optional" />
        </div>
        <div class="mc-field-mini">
          <label>Member Class</label>
          <select class="inv-class" data-id="${inv.id}">${classOpts}</select>
        </div>
        <div class="mc-field-mini">
          <label>Accredited Investor Category</label>
          <select class="inv-ai" data-id="${inv.id}">${aiOpts}</select>
        </div>
        <div class="mc-field-mini">
          <label>Signing Capacity</label>
          <select class="inv-capacity" data-id="${inv.id}">${capacityOpts}</select>
        </div>
      </div>`;
    container.appendChild(card);
    card.querySelector('.inv-type').value = inv.type;
    card.querySelector('.inv-class').value = inv.memberClassId || '';
    card.querySelector('.inv-ai').value = inv.aiCategory;
    card.querySelector('.inv-capacity').value = inv.signingCapacity;
  });

  // Wire handlers
  container.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', updateInvestorField);
    el.addEventListener('input', updateInvestorField);
  });
  container.querySelectorAll('.mc-remove').forEach(b => {
    b.addEventListener('click', e => {
      const id = parseInt(e.target.dataset.id, 10);
      DB.investors = DB.investors.filter(i => i.id !== id);
      renderInvestors();
      updateInvestorSummary();
    });
  });
}

function updateInvestorField(e) {
  const id = parseInt(e.target.dataset.id, 10);
  const inv = DB.investors.find(i => i.id === id);
  if (!inv) return;
  if (e.target.classList.contains('inv-name')) inv.name = e.target.value;
  else if (e.target.classList.contains('inv-type')) inv.type = e.target.value;
  else if (e.target.classList.contains('inv-address')) inv.address = e.target.value;
  else if (e.target.classList.contains('inv-capital')) { inv.capital = parseFloat(String(e.target.value).replace(/[\$,\s%]/g, '')) || 0; updateInvestorSummary(); }
  else if (e.target.classList.contains('inv-email')) inv.email = e.target.value;
  else if (e.target.classList.contains('inv-class')) inv.memberClassId = parseInt(e.target.value, 10);
  else if (e.target.classList.contains('inv-ai')) inv.aiCategory = e.target.value;
  else if (e.target.classList.contains('inv-capacity')) inv.signingCapacity = e.target.value;
}

function updateInvestorSummary() {
  const summaryEl = document.getElementById('investor_summary');
  if (!summaryEl) return;

  const totalCommitted = DB.investors.reduce((s, i) => s + (i.capital || 0), 0);
  const totalMemberCapital = DB.memberClasses.reduce((s, c) => s + (c.capital || 0), 0);
  const numInvestors = DB.investors.length;
  const numAccredited = DB.investors.filter(i => i.aiCategory && i.aiCategory.startsWith('501a')).length;

  // Match check
  let matchClass = 'good';
  let matchLabel = 'MATCH';
  const diff = totalCommitted - totalMemberCapital;
  if (Math.abs(diff) > 1) {
    matchClass = diff > 0 ? 'warn' : 'bad';
    matchLabel = diff > 0 ? `+${fmt$(diff)}` : `${fmt$(diff)}`;
  } else if (totalCommitted === 0 && totalMemberCapital === 0) {
    matchClass = '';
    matchLabel = '—';
  }

  summaryEl.innerHTML = `
    <div class="dis-stat">
      <div class="dis-label">Investors</div>
      <div class="dis-value">${numInvestors}</div>
    </div>
    <div class="dis-stat">
      <div class="dis-label">Accredited</div>
      <div class="dis-value good">${numAccredited} / ${numInvestors}</div>
    </div>
    <div class="dis-stat">
      <div class="dis-label">Total Committed</div>
      <div class="dis-value">${fmt$(totalCommitted)}</div>
    </div>
    <div class="dis-stat">
      <div class="dis-label">vs. Member Capital (Step 2)</div>
      <div class="dis-value ${matchClass}">${matchLabel}</div>
    </div>`;
}



// =============================================================================
// COLLECT PHASE 7 DATA
// =============================================================================
function collectPhase7Data() {
  const v = id => { const el = document.getElementById(id); if (!el) return ''; return String(el.value).replace(/[$,\s%]/g, '').trim(); };
  const c = id => { const el = document.getElementById(id); return el ? el.checked : false; };

  const selectedLevel = document.querySelector('input[name="sec_level"]:checked')?.value || 'level_1_ff';

  return {
    securitiesLevel: selectedLevel,
    issuer: {
      name: v('dp_issuer_name'),
      type: v('dp_issuer_type'),
      formationState: v('dp_issuer_formation_state'),
      formationDate: v('dp_issuer_formation_date'),
      address: v('dp_issuer_address'),
      ein: v('dp_issuer_ein'),
      securities: v('dp_issuer_securities') || 'Membership Interests'
    },
    sponsor: {
      isIndividual: c('dp_sponsor_individual'),
      name: v('dp_sponsor_name'),
      type: v('dp_sponsor_type'),
      formationState: v('dp_sponsor_formation_state'),
      relationship: v('dp_sponsor_relationship'),
      address: v('dp_sponsor_address')
    },
    signatories: JSON.parse(JSON.stringify(DB.signatories)),
    investors: JSON.parse(JSON.stringify(DB.investors)),
    options: {
      includeDealMemo: v('dp_include_deal_memo') === 'yes',
      outputFormat: v('dp_output_format') || 'html_combined',
      draftingNotes: v('dp_drafting_notes')
    }
  };
}

// =============================================================================
// SECURITIES LEVEL CONFIGURATION
// =============================================================================
const SEC_LEVEL_CONFIG = {
  level_0_no_reg_d: {
    label: 'No Reg D Filing — Small JV (Pre-Existing Relationships)',
    rule: 'No Reg D — Operating-Member Joint Venture',
    permitsGenSolic: false,
    requiresVerification: false,
    aiSelfCert: false,
    includesPPM: false,
    includesRiskLetter: false,
    includesVerifLetter: false,
    includesGenSolicMemo: false,
    includesSubAgreement: false,
    includesAIQuestionnaire: false,
    includesFormDWorksheet: false,
    includesBlueSky: false,
    includesJVAnalysisMemo: true,
    includesJoinder: true
  },
  level_1_ff: {
    label: 'Friends & Family (Reg D 506(b) — Lean)',
    rule: '506(b)',
    permitsGenSolic: false,
    requiresVerification: false,
    aiSelfCert: true,
    includesPPM: false,
    includesRiskLetter: true,
    includesVerifLetter: false,
    includesGenSolicMemo: false
  },
  level_2_soph: {
    label: 'Sophisticated 506(b) — Full Disclosure',
    rule: '506(b)',
    permitsGenSolic: false,
    requiresVerification: false,
    aiSelfCert: true,
    includesPPM: true,
    includesRiskLetter: false,
    includesVerifLetter: false,
    includesGenSolicMemo: false
  },
  level_3_506c: {
    label: 'General Solicitation (Reg D 506(c))',
    rule: '506(c)',
    permitsGenSolic: true,
    requiresVerification: true,
    aiSelfCert: false,
    includesPPM: true,
    includesRiskLetter: false,
    includesVerifLetter: true,
    includesGenSolicMemo: true
  }
};

// =============================================================================
// HELPER FUNCTIONS FOR TEMPLATES
// =============================================================================
function entityFullDesignation(entity) {
  if (!entity || !entity.name) return '[Entity Name TBD]';
  const stateName = STATE_DATA.find(s => s.abbr === entity.formationState)?.name || entity.formationState;
  return `${escapeHtml(entity.name)}, a ${escapeHtml(stateName)} ${escapeHtml(entity.type)}`;
}

function entityShortName(entity) {
  return entity && entity.name ? escapeHtml(entity.name) : '[Entity Name TBD]';
}

function listMembers(memberClasses, investors) {
  // Group investors by member class
  const grouped = {};
  for (const cls of memberClasses) {
    grouped[cls.id] = { class: cls, investors: investors.filter(i => i.memberClassId === cls.id) };
  }
  return grouped;
}

function todayLong() {
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const d = new Date();
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

// =============================================================================
// DOCUMENT 1: COVER + TABLE OF CONTENTS
// =============================================================================
function generatePackageCover(p7, dealData, levelConfig) {
  const dealName = dealData.projectName || 'Unnamed Project';
  return `
<div class="pkg-cover">
  <div>
    <div class="firm-mark">DONOVAN LEGAL PLLC · RESERVE</div>
    <div class="firm-name">DEAL DOCUMENT PACKAGE</div>
  </div>
  <div>
    <div class="memo-label">Issuer</div>
    <h1>${entityShortName(p7.issuer)}</h1>
    <div class="subhead">${escapeHtml(dealName)}</div>
    <div class="subhead">${escapeHtml(levelConfig.label)}</div>
    <div class="meta">Generated ${todayLong()}</div>
  </div>
  <div>
    <div class="draft-stamp-large">DRAFT — PRIVILEGED &amp; CONFIDENTIAL</div>
    <p class="cover-notice">
      The documents in this package are templates generated by the Donovan Legal PLLC Reserve Deal Builder. They reflect the deal parameters as entered into the tool. Substantive review, customization, and execution are subject to a written engagement letter with the firm. Nothing in this package constitutes legal, tax, or accounting advice or creates an attorney-client relationship. Do not distribute or execute without firm approval.
    </p>
  </div>
</div>
`;
}

function generatePackageTOC(p7, dealData, levelConfig) {
  const investorCount = p7.investors.length;
  let toc = `
<div class="pkg-toc">
  <h2>Package Index</h2>
  <ol>
    <li><strong>Package Overview</strong> — securities-law summary and document map</li>
    <li><strong>Operating Agreement</strong> of ${entityShortName(p7.issuer)}</li>`;
  if (levelConfig.includesRiskLetter) {
    toc += `<li><strong>Risk Disclosure Letter</strong> (Friends &amp; Family level)</li>`;
  }
  if (levelConfig.includesPPM) {
    toc += `<li><strong>Private Placement Memorandum</strong></li>`;
  }
  toc += `<li><strong>Subscription Agreement</strong> — Form (and ${investorCount} executed counterpart${investorCount === 1 ? '' : 's'})</li>`;
  toc += `<li><strong>Accredited Investor Questionnaire</strong> — Form (and ${investorCount} executed counterpart${investorCount === 1 ? '' : 's'})</li>`;
  if (levelConfig.includesVerifLetter) {
    toc += `<li><strong>Investor Verification Documentation Standard</strong> (506(c))</li>`;
  }
  if (levelConfig.includesGenSolicMemo) {
    toc += `<li><strong>General Solicitation Compliance Memorandum</strong> (506(c))</li>`;
  }
  toc += `<li><strong>Form D Filing Worksheet</strong></li>`;
  toc += `<li><strong>State Blue Sky Notice</strong> &mdash; ${p7.issuer.formationState || 'TBD'}</li>`;
  if (p7.options.includeDealMemo) {
    toc += `<li><strong>Exhibit A:</strong> Deal Memorandum — Financial Analysis &amp; Structural Diagram</li>`;
  }
  toc += `</ol>
</div>
`;
  return toc;
}

// =============================================================================
// DOCUMENT 2: PACKAGE OVERVIEW
// =============================================================================
function generatePackageOverview(p7, dealData, levelConfig) {
  const numInvestors = p7.investors.length;
  const numAccredited = p7.investors.filter(i => i.aiCategory && i.aiCategory.startsWith('501a')).length;
  const totalCommitted = p7.investors.reduce((s, i) => s + (i.capital || 0), 0);

  return `
<div class="pkg-section">
  <h2 class="pkg-doc-title">1. Package Overview &amp; Securities-Law Summary</h2>

  <h3>Offering Profile</h3>
  <table class="pkg-table">
    <tr><td><strong>Issuer:</strong></td><td>${entityFullDesignation(p7.issuer)}</td></tr>
    <tr><td><strong>Project:</strong></td><td>${escapeHtml(dealData.projectName || 'TBD')}</td></tr>
    <tr><td><strong>Deal Type:</strong></td><td>${escapeHtml(DEAL_TYPES[dealData.dealType]?.label || dealData.dealType)}</td></tr>
    <tr><td><strong>Securities Offered:</strong></td><td>${escapeHtml(p7.issuer.securities)}</td></tr>
    <tr><td><strong>Total Capital Sought:</strong></td><td>${fmt$(totalCommitted)} (${numInvestors} investor${numInvestors === 1 ? '' : 's'})</td></tr>
    <tr><td><strong>Securities Exemption:</strong></td><td>Regulation D Rule ${levelConfig.rule}</td></tr>
    <tr><td><strong>General Solicitation:</strong></td><td>${levelConfig.permitsGenSolic ? 'Permitted under Rule 506(c)' : '<strong>PROHIBITED</strong> — pre-existing relationship required'}</td></tr>
    <tr><td><strong>Verification Standard:</strong></td><td>${levelConfig.requiresVerification ? 'Reasonable steps required (Rule 506(c)(2)(ii))' : 'Self-certification of accredited status'}</td></tr>
    <tr><td><strong>Investor Profile:</strong></td><td>${numAccredited} of ${numInvestors} represent accredited status under Rule 501(a)</td></tr>
  </table>

  <h3>Document Map</h3>
  <p>This package contains the following materials, ordered as they appear:</p>
  <ul>
    <li><strong>Operating Agreement</strong> — the governance document of the Issuer LLC; binds members; sets out capital, allocations, distributions, management, transfers, dissolution.</li>
    ${levelConfig.includesRiskLetter ? '<li><strong>Risk Disclosure Letter</strong> — abbreviated disclosure for Friends &amp; Family offerings where investors have pre-existing substantive relationships with the sponsor; substitutes for full PPM at Level 1.</li>' : ''}
    ${levelConfig.includesPPM ? '<li><strong>Private Placement Memorandum (PPM)</strong> — comprehensive disclosure document including investment summary, risk factors, tax considerations, conflicts of interest, and securities regulatory disclosures.</li>' : ''}
    <li><strong>Subscription Agreement</strong> — binds each investor to the offering on the stated terms; contains investor representations regarding accredited status, sophistication, and ability to bear economic risk.</li>
    <li><strong>Accredited Investor Questionnaire</strong> — captures investor identity, mailing address, AI category election under Rule 501(a), and (for 506(c)) supporting documentation.</li>
    ${levelConfig.includesVerifLetter ? '<li><strong>Investor Verification Documentation Standard</strong> — describes the reasonable verification methods the Issuer will accept to satisfy Rule 506(c)(2)(ii), including income, net worth, broker/CPA/lawyer letters, and SEC registration.</li>' : ''}
    ${levelConfig.includesGenSolicMemo ? '<li><strong>General Solicitation Compliance Memorandum</strong> — internal memo addressing the permitted and prohibited promotional activities, the Rule 506(d) bad-actor disqualification check, and the verification methodology.</li>' : ''}
    <li><strong>Form D Filing Worksheet</strong> — data pre-fill for the Form D notice filing with the SEC via EDGAR (15 days after first sale).</li>
    <li><strong>State Blue Sky Notice</strong> — notice filing in the state of formation; additional state notices required where investors reside.</li>
    ${p7.options.includeDealMemo ? '<li><strong>Exhibit A: Deal Memorandum</strong> — full financial analysis, capital stack, waterfall, capital account roll-forward, tax allocations, FIRPTA/UBTI, compliance dashboard, structural diagram, and recommendations as generated by the Deal Builder Phase&nbsp;V Deal Memo output.</li>' : ''}
  </ul>

  ${p7.options.draftingNotes ? `<h3>Drafting Notes</h3><div class="pkg-callout">${escapeHtml(p7.options.draftingNotes)}</div>` : ''}

  <h3>Important Securities-Law Considerations</h3>
  <p><strong>Bad Actor Disqualification (Rule 506(d)).</strong> Each "covered person" (issuer, predecessors, affiliated issuers, directors, executive officers, general partners, managing members, beneficial owners of 20%+ of outstanding voting securities, promoters, investment managers, and persons compensated for solicitation) must be evaluated against the disqualifying events of Rule 506(d)(1). Disqualifying events generally include certain criminal convictions, court injunctions, regulatory orders, SEC disciplinary orders, suspensions, and postal fraud orders within specified lookback periods. The Issuer must perform this analysis and obtain certifications from each covered person prior to commencing the offering.</p>

  <p><strong>Integration.</strong> Rule 152 (post-March 2021 framework) provides safe harbors for offerings made in close proximity. Separate offerings completed more than 30 days apart will not be integrated. Within 30 days, offerings are not integrated if (i) each offering complies with its own exemption, and (ii) for exempt offerings without general solicitation, no information about a concurrent general-solicitation offering would have caused the non-solicitation offering to fail.</p>

  <p><strong>Form D Filing.</strong> A Form D notice must be filed with the SEC via EDGAR no later than 15 calendar days after the first sale of securities in the offering. Annual amendments and amendments upon material changes are required.</p>

  <p><strong>State Notice Filings.</strong> Most states require a Form D / "Blue Sky" notice filing with the state securities administrator within a specified period after the first sale (typically 15 days; some states require pre-sale filing). The Issuer should identify each state in which an investor resides and confirm the applicable notice requirements.</p>

  ${levelConfig.permitsGenSolic ? '<p><strong>General Solicitation Verification.</strong> For Rule 506(c) offerings permitting general solicitation, the Issuer must take reasonable steps to verify the accredited status of each purchaser. Self-certification is INSUFFICIENT. Acceptable methods under Rule 506(c)(2)(ii) and SEC interpretive guidance include: (i) reviewing IRS Form W-2, 1040, or similar income documentation; (ii) reviewing bank statements, brokerage statements, and credit reports for net worth verification; (iii) obtaining written confirmation from a registered broker-dealer, investment adviser, licensed attorney, or CPA; or (iv) other reasonable methods. The verification standard is intended to be more rigorous than the prior 506(b) self-certification framework.</p>' : ''}
</div>
`;
}



// =============================================================================
// DOCUMENT 3: OPERATING AGREEMENT
// =============================================================================
function generateOperatingAgreement(p7, dealData, results) {
  const issuer = p7.issuer;
  const sponsor = p7.sponsor;
  const stateName = STATE_DATA.find(s => s.abbr === issuer.formationState)?.name || issuer.formationState;
  const sponsorRelationship = sponsor.isIndividual ? 'individually' :
    (sponsor.relationship === 'gp' ? 'General Partner' :
     sponsor.relationship === 'managing_member' ? 'Managing Member' : 'Manager');

  // Build member roster from investors grouped by class
  const membersByClass = listMembers(dealData.memberClasses, p7.investors);
  let memberRosterHtml = '';
  for (const cls of dealData.memberClasses) {
    if (cls.classType === 'sponsor') continue;
    const investors = membersByClass[cls.id]?.investors || [];
    if (investors.length === 0) continue;
    memberRosterHtml += `<tr><td colspan="3"><strong>${escapeHtml(cls.name)}</strong> (${escapeHtml((cls.classType || '').replace('_',' '))} — ${(cls.prefRate * 100).toFixed(2)}% preferred return)</td></tr>`;
    for (const inv of investors) {
      memberRosterHtml += `<tr><td>${escapeHtml(inv.name)}</td><td>${escapeHtml(inv.address)}</td><td>${fmt$(inv.capital)}</td></tr>`;
    }
  }

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">2. OPERATING AGREEMENT</h2>
  <p class="pkg-doc-subtitle">${entityShortName(issuer).toUpperCase()}, a ${escapeHtml(stateName)} ${escapeHtml(issuer.type)}</p>

  <p class="pkg-recital">This Operating Agreement (this <strong>"Agreement"</strong>) is entered into as of ${escapeHtml(issuer.formationDate || '[Effective Date]')} (the <strong>"Effective Date"</strong>) by and among ${entityShortName(issuer)}, a ${escapeHtml(stateName)} ${escapeHtml(issuer.type)} (the <strong>"Company"</strong>), and the persons listed on <strong>Exhibit&nbsp;A</strong> hereto (each, a <strong>"Member"</strong> and collectively, the <strong>"Members"</strong>).</p>

  <h3 class="pkg-article">RECITALS</h3>
  <p>WHEREAS, the Company was formed as a ${escapeHtml(stateName)} ${escapeHtml(issuer.type)} by the filing of Articles of Organization with the ${escapeHtml(stateName)} Secretary of State on ${escapeHtml(issuer.formationDate || '[Formation Date]')};</p>
  <p>WHEREAS, the Members desire to set forth the terms governing the operation and management of the Company in accordance with the ${escapeHtml(stateName)} ${escapeHtml(issuer.type === 'LLC' ? 'Revised Limited Liability Company Act' : (issuer.type === 'LP' ? 'Revised Uniform Limited Partnership Act' : 'applicable corporate or trust law'))};</p>
  <p>NOW, THEREFORE, in consideration of the mutual covenants herein contained, the Members agree as follows:</p>

  <h3 class="pkg-article">ARTICLE I — DEFINITIONS</h3>
  <p><strong>1.1 Definitions.</strong> For purposes of this Agreement, the following terms have the meanings indicated:</p>
  <p><strong>"Act"</strong> means the ${escapeHtml(stateName)} ${escapeHtml(issuer.type === 'LLC' ? 'Revised Limited Liability Company Act' : 'applicable law')}, as amended.</p>
  <p><strong>"Capital Account"</strong> means the capital account of each Member maintained in accordance with Section&nbsp;3.6 and Treasury Regulations § 1.704-1(b)(2)(iv).</p>
  <p><strong>"Capital Contribution"</strong> means the cash or fair market value of property contributed by a Member to the capital of the Company.</p>
  <p><strong>"Code"</strong> means the Internal Revenue Code of 1986, as amended.</p>
  <p><strong>"Distribution"</strong> means any cash or other property distributed by the Company to a Member in respect of its Membership Interest.</p>
  <p><strong>"Fiscal Year"</strong> means the Company's fiscal year, which shall end on December&nbsp;31 of each year unless otherwise required by the Code.</p>
  <p><strong>"Manager"</strong> means ${sponsor.isIndividual ? 'the individual designated as Manager on Exhibit B' : entityFullDesignation(sponsor)}, or such successor as may be appointed pursuant to this Agreement.</p>
  <p><strong>"Member"</strong> means each person listed on Exhibit A and any additional or substituted person admitted as a Member in accordance with this Agreement.</p>
  <p><strong>"Membership Interest"</strong> means a Member's entire interest in the Company, including its right to receive Distributions, its share of Profits and Losses, and any voting or consent rights.</p>
  <p><strong>"Preferred Return"</strong> has the meaning set forth in Section&nbsp;5.2.</p>
  <p><strong>"Profits"</strong> and <strong>"Losses"</strong> mean, for each Fiscal Year, the Company's taxable income or loss, computed in accordance with Code § 703(a) and adjusted as set forth in this Agreement.</p>
  <p><strong>"Treasury Regulations"</strong> means the regulations promulgated under the Code, as in effect from time to time.</p>

  <h3 class="pkg-article">ARTICLE II — FORMATION AND PURPOSE</h3>
  <p><strong>2.1 Formation.</strong> The Company was formed under the Act. The Members confirm and ratify the filing of the Articles of Organization (or equivalent organizational document) with the ${escapeHtml(stateName)} Secretary of State.</p>
  <p><strong>2.2 Name.</strong> The name of the Company is ${entityShortName(issuer)}.</p>
  <p><strong>2.3 Principal Office.</strong> The principal office of the Company is ${escapeHtml(issuer.address || '[Principal Office Address]')}.</p>
  <p><strong>2.4 Registered Agent.</strong> The registered agent for service of process in ${escapeHtml(stateName)} shall be the person or entity designated in the Articles of Organization, as may be changed from time to time by the Manager.</p>
  <p><strong>2.5 Purpose.</strong> The purpose of the Company is to acquire, develop, hold, lease, operate, finance, refinance, and dispose of the real property and improvements located at ${escapeHtml(dealData.propertyLocation || '[Property Location]')} (the <strong>"Property"</strong>) and to engage in any lawful business or activity for which a ${escapeHtml(issuer.type)} may be organized under the Act in connection therewith. The Company may also engage in any related or incidental activities approved by the Manager.</p>
  <p><strong>2.6 Term.</strong> The Company shall continue in existence until terminated and dissolved as provided in Article XII.</p>

  <h3 class="pkg-article">ARTICLE III — CAPITAL CONTRIBUTIONS</h3>
  <p><strong>3.1 Initial Capital Contributions.</strong> Each Member shall make the Initial Capital Contribution set forth opposite its name on <strong>Exhibit A</strong>. The aggregate Initial Capital Contributions of all Members shall be ${fmt$(p7.investors.reduce((s,i)=>s+(i.capital||0),0))}.</p>
  <p><strong>3.2 Additional Capital Contributions.</strong> No Member shall be required to make any Additional Capital Contribution. If the Manager determines that additional capital is required for the operation of the Company, the Manager may (but shall not be required to) call for Additional Capital Contributions from the Members pro rata in proportion to their respective Membership Interests. A Member's failure to fund a called contribution shall be subject to the dilution and remedies set forth in Section&nbsp;3.3.</p>
  <p><strong>3.3 Failure to Fund.</strong> If any Member fails to fund a properly called Additional Capital Contribution within ten (10) Business Days of the call notice, the funding Members may (i) advance the shortfall as a member loan bearing interest at the prime rate plus four percent (4%) and repayable from distributions otherwise payable to the defaulting Member, or (ii) contribute the shortfall as additional capital and proportionately dilute the defaulting Member's Membership Interest. The remedies in this Section are cumulative.</p>
  <p><strong>3.4 Loans by Members.</strong> A Member may, with the consent of the Manager, lend funds to the Company. Any such loan shall be on arm's-length terms and shall not be treated as a Capital Contribution.</p>
  <p><strong>3.5 No Interest on Capital.</strong> No Member shall be entitled to interest on its Capital Contribution except as expressly provided herein.</p>
  <p><strong>3.6 Capital Accounts.</strong> A separate Capital Account shall be maintained for each Member in accordance with Treas. Reg. § 1.704-1(b)(2)(iv). Capital Accounts shall be increased by Capital Contributions and allocations of Profits, and decreased by Distributions and allocations of Losses.</p>

  <h3 class="pkg-article">ARTICLE IV — ALLOCATIONS OF PROFITS AND LOSSES</h3>
  <p><strong>4.1 General Allocation.</strong> Except as otherwise provided in this Article IV, Profits and Losses shall be allocated to the Members in accordance with the <strong>${escapeHtml(results?.allocData?.method704b || 'targeted')}</strong> method, in a manner consistent with Treas. Reg. § 1.704-1(b) and the economic intent of the Members as reflected in the Distribution provisions of Article V.</p>
  <p><strong>4.2 § 704(c) Allocations.</strong> If any property is contributed to the Company with a fair market value different from its adjusted tax basis, items of income, gain, loss, and deduction with respect to such property shall be allocated among the Members so as to take account of the variation between the basis of the property and its fair market value in accordance with Code § 704(c) and Treas. Reg. § 1.704-3, using the <strong>${escapeHtml(results?.allocData?.method704c || 'traditional')}</strong> method.</p>
  <p><strong>4.3 Regulatory Allocations.</strong> Notwithstanding any other provision, the following allocations shall be made in the following order: (a) minimum gain chargeback under Treas. Reg. § 1.704-2(f); (b) chargeback of partner nonrecourse debt minimum gain under Treas. Reg. § 1.704-2(i)(4); (c) qualified income offset under Treas. Reg. § 1.704-1(b)(2)(ii)(d); (d) gross income allocation; and (e) nonrecourse deductions and partner nonrecourse deductions in accordance with Treas. Reg. §§ 1.704-2(b) and 1.704-2(i)(2).</p>
  <p><strong>4.4 Recapture.</strong> To the extent permitted by Treas. Reg. § 1.1245-1(e) and § 1.1250-1(f), depreciation recapture shall be allocated to the Members who received the related depreciation deductions.</p>
  <p><strong>4.5 Tax Allocations Generally Follow Book Allocations.</strong> Except as otherwise provided in Section 4.2, tax allocations of Profits, Losses, and other tax items shall follow the corresponding book allocations.</p>

  <h3 class="pkg-article">ARTICLE V — DISTRIBUTIONS</h3>
  <p><strong>5.1 Available Cash.</strong> The Manager shall cause the Company to distribute Available Cash (defined as cash on hand reduced by amounts reserved by the Manager for working capital, capital expenditures, debt service, contingencies, and any other purpose deemed prudent by the Manager) to the Members in accordance with Section 5.2 (Distribution Waterfall).</p>
  <p><strong>5.2 Distribution Waterfall.</strong> Available Cash shall be distributed as follows, in the following order of priority:</p>
  <p style="margin-left:1.5rem;"><strong>(a) Preferred Return.</strong> First, ${(dealData.prefRate * 100).toFixed(2)}% per annum, ${escapeHtml((dealData.prefType || 'cumulative').replace('_',' '))} ${escapeHtml((dealData.prefPriority || 'pari passu').replace('_',' '))}, on each Member's unreturned Capital Contributions until each Member has received Distributions equal to such Preferred Return.</p>
  <p style="margin-left:1.5rem;"><strong>(b) Return of Capital.</strong> Second, in proportion to each Member's unreturned Capital Contributions, until each Member has received Distributions equal to its Capital Contributions.</p>
  <p style="margin-left:1.5rem;"><strong>(c) Promote Tiers.</strong> Third, the remainder shall be distributed pursuant to the promote tiers set forth on <strong>Exhibit C</strong>, with the Sponsor receiving incentive distributions ("promote") above defined hurdles as detailed therein.</p>
  <p><strong>5.3 Tax Distributions.</strong> Within thirty (30) days following the end of each Fiscal Year, the Manager may cause the Company to make Tax Distributions to each Member in an amount equal to its allocated share of taxable income for such year multiplied by the Assumed Tax Rate. Tax Distributions shall be treated as advances against, and shall reduce, future Distributions otherwise payable to such Member under Section 5.2. The <strong>"Assumed Tax Rate"</strong> means the highest combined federal, state, and local marginal income tax rate applicable to any Member, as reasonably determined by the Manager.</p>
  <p><strong>5.4 Withholding.</strong> The Company shall withhold and pay over to the appropriate tax authorities any amounts required to be withheld pursuant to the Code or applicable state, local, or foreign tax law (including FIRPTA withholding under Code § 1445 and § 1446 with respect to foreign Members, and any state nonresident withholding). Any amount so withheld shall be treated as a Distribution to the affected Member.</p>

  <h3 class="pkg-article">ARTICLE VI — MANAGEMENT</h3>
  <p><strong>6.1 Manager.</strong> The business and affairs of the Company shall be managed by ${sponsor.isIndividual ? 'the individual designated on Exhibit B' : entityFullDesignation(sponsor)} (the <strong>"Manager"</strong>). The Manager shall have all powers necessary or appropriate to carry out the purposes of the Company and to manage its business and affairs, subject only to limitations expressly set forth in this Agreement or in the Act.</p>
  <p><strong>6.2 Powers of the Manager.</strong> Without limiting the generality of Section 6.1, the Manager shall have full power and authority to: (a) acquire, develop, finance, refinance, lease, manage, and dispose of the Property; (b) execute and deliver all documents on behalf of the Company; (c) employ professionals, contractors, and consultants; (d) maintain books and records; (e) cause the Company to obtain insurance; (f) prosecute and defend legal actions; (g) make tax elections; and (h) take such other actions as the Manager deems necessary or appropriate.</p>
  <p><strong>6.3 Major Decisions.</strong> Notwithstanding Section 6.2, the following actions shall require the affirmative vote of Members holding more than ${escapeHtml((dealData.majorVoteThreshold || 'majority').replace('_',' '))} of the Membership Interests (the <strong>"Major Decisions"</strong>): (i) sale of all or substantially all of the Property; (ii) merger, consolidation, or conversion of the Company; (iii) admission of additional Members (other than as transferees of existing Members in accordance with Article IX); (iv) amendment of this Agreement that adversely affects a class of Members disproportionately; (v) dissolution of the Company (other than at the end of its term); (vi) commencement of bankruptcy proceedings; and (vii) any transaction with the Manager or its affiliates not on arm's-length terms.</p>
  <p><strong>6.4 Standard of Care.</strong> The Manager shall perform its duties in good faith and with the care of an ordinarily prudent person in a like position under similar circumstances. The Manager shall have the benefit of the business judgment rule. To the fullest extent permitted by law, the Manager shall not be liable to the Company or any Member for any action taken or omitted in good faith.</p>
  <p><strong>6.5 Compensation.</strong> The Manager shall be entitled to receive the fees set forth on <strong>Exhibit B</strong> (including any acquisition, development, construction management, asset management, and disposition fees, as applicable). The Manager shall be reimbursed for reasonable out-of-pocket expenses incurred on behalf of the Company.</p>
  <p><strong>6.6 Removal of Manager.</strong> The Manager may be removed only for Cause upon the affirmative vote of Members holding seventy-five percent (75%) or more of the Membership Interests held by Members other than the Manager and its affiliates. <strong>"Cause"</strong> means (a) fraud or willful misconduct; (b) gross negligence resulting in material harm to the Company; (c) material breach of this Agreement not cured within thirty (30) days of notice; (d) conviction of a felony; or (e) bankruptcy or insolvency of the Manager.</p>

  <h3 class="pkg-article">ARTICLE VII — INDEMNIFICATION</h3>
  <p><strong>7.1 Indemnification.</strong> The Company shall indemnify and hold harmless the Manager, its affiliates, and their respective officers, directors, members, partners, employees, and agents (each, an <strong>"Indemnified Person"</strong>) from and against any and all losses, claims, damages, liabilities, judgments, fines, settlements, and reasonable expenses (including reasonable attorneys' fees) arising out of or relating to the business of the Company, except to the extent attributable to the gross negligence, willful misconduct, or fraud of such Indemnified Person.</p>
  <p><strong>7.2 Advancement of Expenses.</strong> Expenses incurred in defending a covered proceeding shall be advanced by the Company upon receipt of an undertaking by the Indemnified Person to repay such amounts if it is ultimately determined that indemnification is not available.</p>

  <h3 class="pkg-article">ARTICLE VIII — BOOKS, RECORDS, AND REPORTING</h3>
  <p><strong>8.1 Books and Records.</strong> The Manager shall maintain complete and accurate books and records of the Company at its principal office. Each Member shall have the right to inspect the books and records upon reasonable notice during normal business hours.</p>
  <p><strong>8.2 Annual Financial Statements.</strong> Within one hundred twenty (120) days after the end of each Fiscal Year, the Manager shall deliver to each Member: (i) an unaudited balance sheet as of the end of such year; (ii) an unaudited statement of operations for such year; (iii) a statement of each Member's Capital Account; and (iv) such tax information as is necessary to enable each Member to prepare its federal and state income tax returns, including a Schedule K-1.</p>
  <p><strong>8.3 Tax Matters Partner / Partnership Representative.</strong> The Manager (or such other Member as the Manager may designate) shall serve as the <strong>"Partnership Representative"</strong> within the meaning of Code § 6223 with full authority to act on behalf of the Company in all tax matters, including any audit, examination, or proceeding before the Internal Revenue Service or any state or local tax authority, and to make all decisions and elections under the centralized partnership audit regime of the Bipartisan Budget Act of 2015 (the <strong>"BBA"</strong>).</p>
  <p><strong>8.4 Tax Elections.</strong> The Manager shall make all tax elections deemed appropriate, including (without limitation) the election under Code § 754 if the Manager determines such election is in the best interests of the Members.</p>

  <h3 class="pkg-article">ARTICLE IX — TRANSFERS AND ASSIGNMENTS</h3>
  <p><strong>9.1 Restrictions on Transfer.</strong> No Member may sell, assign, transfer, pledge, or otherwise dispose of all or any portion of its Membership Interest (a <strong>"Transfer"</strong>) without the prior written consent of the Manager, which consent may be withheld in the Manager's sole discretion. Any purported Transfer in violation of this Article shall be null and void.</p>
  <p><strong>9.2 Permitted Transfers.</strong> Notwithstanding Section 9.1, a Member may Transfer all or part of its Membership Interest, without Manager consent, to: (i) an affiliate; (ii) a revocable trust for estate planning purposes where the transferor remains the trustee and beneficiary; or (iii) by reason of death or incompetence to the Member's estate or legal representative.</p>
  <p><strong>9.3 Right of First Refusal.</strong> Any proposed Transfer (other than a Permitted Transfer) shall be subject to a right of first refusal in favor of the Company and then the other Members, on the same terms and conditions as the proposed Transfer.</p>
  <p><strong>9.4 Drag-Along; Tag-Along.</strong> [Reserved — to be customized to deal-specific terms.]</p>
  <p><strong>9.5 Compliance with Securities Laws.</strong> No Transfer shall be permitted unless the proposed transferee provides representations satisfactory to the Manager that the Transfer is exempt from registration under the Securities Act of 1933 and applicable state securities laws.</p>

  <h3 class="pkg-article">ARTICLE X — REPRESENTATIONS AND WARRANTIES OF MEMBERS</h3>
  <p>Each Member represents and warrants to the Company and to each other Member, as of the date of this Agreement and as of the date of any Capital Contribution: (a) it has full power and authority to enter into and perform this Agreement; (b) the execution and delivery of this Agreement and the performance of its obligations hereunder have been duly authorized; (c) it is acquiring its Membership Interest for investment for its own account and not with a view to distribution; (d) it qualifies as an "accredited investor" within the meaning of Rule 501(a) of Regulation D under the Securities Act of 1933, as further described in the Accredited Investor Questionnaire executed by such Member; (e) it has had the opportunity to ask questions of, and receive answers from, the Manager concerning the terms of this offering; and (f) it can bear the economic risk of its investment, including the risk of total loss.</p>

  <h3 class="pkg-article">ARTICLE XI — DISSOLUTION AND WINDING UP</h3>
  <p><strong>11.1 Events of Dissolution.</strong> The Company shall be dissolved upon the earliest to occur of: (a) the sale or other disposition of all or substantially all of the Company's assets; (b) the determination of the Manager that the Company should be dissolved, ratified by Members holding ${escapeHtml((dealData.majorVoteThreshold || 'majority').replace('_',' '))} of the Membership Interests; (c) the entry of a decree of judicial dissolution under the Act; or (d) any other event causing dissolution under the Act.</p>
  <p><strong>11.2 Winding Up.</strong> Upon dissolution, the Manager (or, if none, a liquidator appointed by the Members) shall wind up the affairs of the Company, liquidate its assets, pay or provide for its liabilities, and distribute any remaining assets in accordance with Section 11.3.</p>
  <p><strong>11.3 Final Distribution.</strong> The proceeds of liquidation shall be distributed in the following order: (a) to creditors of the Company (other than Members); (b) to establish reserves for contingent liabilities; (c) to Members in repayment of any member loans; and (d) to Members in accordance with their positive Capital Account balances.</p>

  <h3 class="pkg-article">ARTICLE XII — MISCELLANEOUS</h3>
  <p><strong>12.1 Notices.</strong> All notices required under this Agreement shall be in writing and shall be delivered personally, by overnight courier, or by certified mail to the address set forth on Exhibit A (or such other address as may be provided in writing).</p>
  <p><strong>12.2 Governing Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of ${escapeHtml(stateName)}, without regard to its conflicts of laws principles.</p>
  <p><strong>12.3 Dispute Resolution.</strong> Any dispute arising out of or relating to this Agreement shall be resolved by binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules in ${escapeHtml(stateName)}. Judgment on the award may be entered in any court of competent jurisdiction.</p>
  <p><strong>12.4 Entire Agreement.</strong> This Agreement (together with its Exhibits) constitutes the entire agreement among the Members concerning the subject matter hereof and supersedes all prior agreements and understandings.</p>
  <p><strong>12.5 Amendments.</strong> This Agreement may be amended only by a written instrument signed by the Manager and Members holding ${escapeHtml((dealData.majorVoteThreshold || 'majority').replace('_',' '))} of the Membership Interests; provided that no amendment shall adversely affect a Member disproportionately without such Member's consent.</p>
  <p><strong>12.6 Counterparts.</strong> This Agreement may be executed in counterparts, each of which shall constitute an original.</p>
  <p><strong>12.7 Severability.</strong> If any provision is held invalid, the remainder shall continue in full force.</p>
  <p><strong>12.8 Confidentiality.</strong> Each Member shall maintain the confidentiality of all non-public information regarding the Company.</p>

  <p style="margin-top:2rem;"><strong>IN WITNESS WHEREOF,</strong> the parties have executed this Agreement as of the Effective Date.</p>

  <div class="pkg-signature-block">
    <p><strong>MANAGER:</strong></p>
    <p>${sponsor.isIndividual ? '' : entityShortName(sponsor) + '<br>'}</p>
    ${p7.signatories.filter(s => s.entity === 'sponsor' || s.entity === 'both').map(s => `
      <p>By: __________________________________<br>
      Name: ${escapeHtml(s.name || '[Name]')}<br>
      Title: ${escapeHtml(s.title || '[Title]')}<br>
      ${SIGNING_CAPACITY[s.capacity] ? 'Capacity: ' + SIGNING_CAPACITY[s.capacity] : ''}</p>
    `).join('')}
  </div>

  <p style="margin-top:2rem;"><strong>MEMBERS:</strong> Each Member shall execute a separate counterpart signature page incorporated herein as part of <strong>Exhibit A</strong>.</p>

  <h3 class="pkg-article">EXHIBIT A — MEMBER ROSTER AND CAPITAL CONTRIBUTIONS</h3>
  <table class="pkg-table">
    <thead><tr><th>Member Legal Name</th><th>Mailing Address</th><th>Capital Contribution</th></tr></thead>
    <tbody>${memberRosterHtml || '<tr><td colspan="3"><em>No investors entered. Member roster will populate from the Investor List in Step 10.</em></td></tr>'}</tbody>
  </table>

  <h3 class="pkg-article">EXHIBIT B — MANAGER COMPENSATION AND FEES</h3>
  <p>The Manager shall be entitled to the following fees from the Company (each, calculated as set forth):</p>
  <ul>
    <li><strong>Development Fee:</strong> ${(dealData.devFee * 100).toFixed(2)}% of Total Project Cost, payable as the budget is funded.</li>
    <li><strong>Construction Management Fee:</strong> ${(dealData.cmFee * 100).toFixed(2)}% of hard construction costs, payable monthly during construction.</li>
    <li><strong>Asset Management Fee:</strong> ${(dealData.amFee * 100).toFixed(2)}% per annum of unreturned Capital Contributions, payable monthly during the hold period.</li>
    <li><strong>Disposition Fee:</strong> ${(dealData.dispFee * 100).toFixed(2)}% of gross sale proceeds at exit.</li>
    <li><strong>Promoted Interest:</strong> as set forth on Exhibit C.</li>
  </ul>

  <h3 class="pkg-article">EXHIBIT C — PROMOTE TIERS AND DISTRIBUTION WATERFALL DETAIL</h3>
  <p>Distributions of Available Cash and proceeds of sale shall be made pursuant to the following waterfall (Section 5.2):</p>
  <p style="margin-left:1rem;"><strong>Tier 1 — Preferred Return:</strong> ${(dealData.prefRate * 100).toFixed(2)}% per annum, ${escapeHtml((dealData.prefType || 'cumulative').replace('_',' '))} ${escapeHtml((dealData.prefPriority || 'pari passu').replace('_',' '))}, on unreturned Capital Contributions.</p>
  <p style="margin-left:1rem;"><strong>Tier 2 — Return of Capital:</strong> pari passu return of Capital Contributions.</p>
  ${(dealData.promoteTiers || []).map((t, i) => `<p style="margin-left:1rem;"><strong>Tier ${i+3} — ${escapeHtml(t.hurdle || '')} Hurdle:</strong> ${(t.lpPct * 100).toFixed(0)}% to Members, ${(t.spPct * 100).toFixed(0)}% to Sponsor as promoted interest until reaching ${escapeHtml(t.threshold ? t.threshold + (t.metric === 'irr' ? '% IRR' : 'x MOIC') : 'next hurdle')}.</p>`).join('')}
  ${dealData.catchupStyle && dealData.catchupStyle !== 'none' ? `<p style="margin-left:1rem;"><strong>Catchup:</strong> ${escapeHtml(dealData.catchupStyle.replace('_',' '))}.</p>` : ''}
  ${dealData.clawbackType && dealData.clawbackType !== 'none' ? `<p style="margin-left:1rem;"><strong>Clawback:</strong> ${escapeHtml(dealData.clawbackType.replace('_',' '))} at ${(dealData.clawbackThreshold * 100).toFixed(0)}% threshold${dealData.guarantorPg ? ', with sponsor personal guaranty' : ''}.</p>` : ''}
</div>
`;
}



// =============================================================================
// DOCUMENT: SUBSCRIPTION AGREEMENT (per investor)
// =============================================================================
function generateSubscriptionAgreement(p7, dealData, investor, levelConfig, sectionNum) {
  const issuer = p7.issuer;
  const stateName = STATE_DATA.find(s => s.abbr === issuer.formationState)?.name || issuer.formationState;
  const memberClass = dealData.memberClasses.find(c => c.id === investor.memberClassId);

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">${sectionNum}. SUBSCRIPTION AGREEMENT</h2>
  <p class="pkg-doc-subtitle">${entityShortName(issuer).toUpperCase()} — Investor: ${escapeHtml(investor.name || '[Investor Name]')}</p>

  <p class="pkg-recital">This Subscription Agreement (this <strong>"Agreement"</strong>) is made and entered into as of the date set forth on the signature page below (the <strong>"Subscription Date"</strong>) by and between ${entityFullDesignation(issuer)} (the <strong>"Company"</strong>), and the subscriber identified on the signature page below (the <strong>"Subscriber"</strong>).</p>

  <h3 class="pkg-article">1. SUBSCRIPTION</h3>
  <p><strong>1.1 Subscription Amount.</strong> Subscriber hereby irrevocably subscribes for and agrees to purchase ${escapeHtml(p7.issuer.securities)} of the Company (the <strong>"Securities"</strong>) in the aggregate principal amount of <strong>${fmt$(investor.capital)}</strong> (the <strong>"Subscription Amount"</strong>), subject to the terms of this Agreement and the Operating Agreement of the Company (the <strong>"Operating Agreement"</strong>).</p>
  <p><strong>1.2 Member Class.</strong> Subscriber's investment shall be allocated to the <strong>${escapeHtml(memberClass ? memberClass.name : 'TBD')}</strong> class of membership interests, as defined in the Operating Agreement.</p>
  <p><strong>1.3 Payment.</strong> Subscriber shall pay the Subscription Amount by wire transfer or other immediately available funds to the Company's designated account upon acceptance of this subscription by the Company.</p>
  <p><strong>1.4 Acceptance by the Company.</strong> This subscription is not binding upon the Company until accepted in writing by the Manager. The Manager may, in its sole discretion, accept or reject this subscription in whole or in part. Upon acceptance, Subscriber shall be admitted to the Company as a Member.</p>

  <h3 class="pkg-article">2. REPRESENTATIONS AND WARRANTIES OF SUBSCRIBER</h3>
  <p>Subscriber represents and warrants to the Company that, as of the Subscription Date:</p>
  <p><strong>2.1 Authority.</strong> Subscriber has the full power and authority to enter into this Agreement, to perform Subscriber's obligations hereunder, and to consummate the transactions contemplated hereby. This Agreement has been duly executed by Subscriber and constitutes a legal, valid, and binding obligation of Subscriber.</p>
  <p><strong>2.2 Accredited Investor Status.</strong> Subscriber is an "accredited investor" as defined in Rule 501(a) of Regulation D under the Securities Act of 1933, as amended (the <strong>"Securities Act"</strong>). The specific category under which Subscriber qualifies as an accredited investor is set forth in the Accredited Investor Questionnaire executed concurrently herewith. ${levelConfig.requiresVerification ? '<strong>Subscriber acknowledges that this offering is conducted pursuant to Rule 506(c) of Regulation D and that the Company is required to take reasonable steps to verify Subscriber\'s accredited status. Subscriber agrees to provide the documentation requested by the Company to support such verification.</strong>' : ''}</p>
  <p><strong>2.3 Investment Purpose.</strong> Subscriber is acquiring the Securities for Subscriber's own account, for investment purposes only, and not with a view to or for resale or distribution. Subscriber has no present intention to sell, transfer, or otherwise dispose of the Securities or any portion thereof.</p>
  <p><strong>2.4 No Public Market; Illiquidity.</strong> Subscriber understands that there is no public market for the Securities, none is anticipated to develop, and Subscriber must be prepared to bear the economic risk of investment in the Securities for an indefinite period. The Securities have not been registered under the Securities Act or any state securities laws and may not be resold or transferred except in a transaction registered under, or exempt from, such laws and in compliance with the Operating Agreement.</p>
  <p><strong>2.5 Risk; Sophistication.</strong> Subscriber has sufficient knowledge and experience in financial and business matters to evaluate the merits and risks of an investment in the Securities. Subscriber acknowledges the substantial risks of this investment, including the possible loss of the entire Subscription Amount. Subscriber has carefully reviewed ${levelConfig.includesPPM ? 'the Private Placement Memorandum' : 'the Risk Disclosure Letter'} furnished to Subscriber in connection with this offering and has had the opportunity to ask questions of, and receive answers from, the Manager.</p>
  <p><strong>2.6 Reliance on Own Advisors.</strong> Subscriber has had the opportunity to consult with its own legal, tax, and financial advisors regarding the merits and risks of this investment. Subscriber is not relying on the Company, the Manager, Donovan Legal PLLC, or any of their affiliates for legal, tax, or investment advice.</p>
  <p><strong>2.7 No General Solicitation.</strong> ${levelConfig.permitsGenSolic ? 'Subscriber acknowledges that this offering is conducted under Rule 506(c) and may be marketed via general solicitation and general advertising. Subscriber\'s decision to invest was based on Subscriber\'s independent evaluation following such general solicitation as Subscriber may have received.' : 'Subscriber did not learn of this investment opportunity through general solicitation or general advertising. Subscriber has a pre-existing substantive relationship with the Manager or its principals.'}</p>
  <p><strong>2.8 No Regulatory Approval.</strong> Subscriber understands that no federal or state agency has approved or disapproved the Securities, passed upon the fairness of the terms of this offering, or endorsed any disclosure document.</p>
  <p><strong>2.9 Truthful Information.</strong> All information provided by Subscriber in this Agreement and in the Accredited Investor Questionnaire is true, complete, and accurate. Subscriber agrees to promptly notify the Company of any change in such information prior to the acceptance of this subscription.</p>
  <p><strong>2.10 Anti-Money-Laundering.</strong> No portion of the funds being used to purchase the Securities is derived from, or related to, any activity that is prohibited by U.S. or applicable foreign law. Subscriber is not, and is not acting on behalf of, any person on the U.S. Treasury Department's Office of Foreign Assets Control list of Specially Designated Nationals or otherwise subject to U.S. economic sanctions.</p>

  <h3 class="pkg-article">3. REPRESENTATIONS AND WARRANTIES OF THE COMPANY</h3>
  <p><strong>3.1 Organization and Authority.</strong> The Company is duly organized and validly existing under the laws of ${escapeHtml(stateName)} and has all corporate or limited liability company power to enter into this Agreement and the Operating Agreement.</p>
  <p><strong>3.2 Authorization.</strong> The execution, delivery, and performance of this Agreement and the issuance and sale of the Securities have been duly authorized by all necessary action on the part of the Company.</p>
  <p><strong>3.3 Reg D Exemption.</strong> The Company has structured this offering in reliance on the exemption from registration provided by Rule ${levelConfig.rule} of Regulation D under the Securities Act and applicable state securities exemptions.</p>

  <h3 class="pkg-article">4. INDEMNIFICATION</h3>
  <p>Subscriber agrees to indemnify and hold harmless the Company, the Manager, and each of their respective affiliates, officers, directors, members, partners, employees, agents, and counsel from and against any and all losses, damages, liabilities, and expenses (including reasonable attorneys' fees) arising out of or related to any breach by Subscriber of any representation, warranty, or covenant contained herein or in the Accredited Investor Questionnaire.</p>

  <h3 class="pkg-article">5. RESTRICTIONS ON TRANSFER</h3>
  <p>Subscriber acknowledges that the Securities are subject to the transfer restrictions set forth in Article IX of the Operating Agreement and that any certificate evidencing the Securities will bear a legend substantially as follows:</p>
  <p class="pkg-legend">"THE SECURITIES REPRESENTED BY THIS CERTIFICATE HAVE NOT BEEN REGISTERED UNDER THE SECURITIES ACT OF 1933 OR ANY APPLICABLE STATE SECURITIES LAWS. THEY MAY NOT BE OFFERED FOR SALE, SOLD, TRANSFERRED, PLEDGED, OR HYPOTHECATED IN THE ABSENCE OF AN EFFECTIVE REGISTRATION STATEMENT UNDER SAID ACT AND APPLICABLE STATE LAWS, OR AN OPINION OF COUNSEL SATISFACTORY TO THE COMPANY THAT SUCH REGISTRATION IS NOT REQUIRED. THE SECURITIES ARE ALSO SUBJECT TO THE TRANSFER RESTRICTIONS SET FORTH IN THE COMPANY'S OPERATING AGREEMENT."</p>

  <h3 class="pkg-article">6. MISCELLANEOUS</h3>
  <p><strong>6.1 Governing Law.</strong> This Agreement shall be governed by the laws of ${escapeHtml(stateName)}.</p>
  <p><strong>6.2 Entire Agreement.</strong> This Agreement, the Operating Agreement, and the Accredited Investor Questionnaire constitute the entire agreement between the parties.</p>
  <p><strong>6.3 Counterparts.</strong> This Agreement may be executed in counterparts and via electronic signature.</p>
  <p><strong>6.4 Successors.</strong> This Agreement binds and benefits the parties and their respective successors and permitted assigns.</p>

  <h3 class="pkg-article">SIGNATURE PAGE</h3>

  <div class="pkg-signature-block">
    <p><strong>SUBSCRIBER:</strong></p>
    <p>Legal Name: ${escapeHtml(investor.name || '_______________________________')}</p>
    <p>Investor Type: ${escapeHtml(INVESTOR_TYPES[investor.type] || investor.type)}</p>
    <p>Mailing Address: ${escapeHtml(investor.address || '_______________________________')}</p>
    <p>Email: ${escapeHtml(investor.email || '_______________________________')}</p>
    <p>Subscription Amount: <strong>${fmt$(investor.capital)}</strong></p>
    <p>Member Class: ${escapeHtml(memberClass ? memberClass.name : '_______________________________')}</p>
    <p style="margin-top:1.5rem;">
      Date: __________________________<br><br>
      By: __________________________________<br>
      Print Name: ${escapeHtml(investor.name || '_______________________________')}<br>
      ${investor.signingCapacity !== 'self' ? `Capacity: ${SIGNING_CAPACITY[investor.signingCapacity] || investor.signingCapacity}` : 'Capacity: Individually'}
    </p>
  </div>

  <div class="pkg-signature-block" style="margin-top:2rem;">
    <p><strong>ACCEPTED BY THE COMPANY:</strong></p>
    <p>${entityShortName(issuer)}</p>
    ${p7.signatories.filter(s => s.entity === 'issuer' || s.entity === 'both').slice(0, 1).map(s => `
      <p style="margin-top:1rem;">
      By: __________________________________<br>
      Name: ${escapeHtml(s.name || '[Name]')}<br>
      Title: ${escapeHtml(s.title || '[Title]')}<br>
      ${SIGNING_CAPACITY[s.capacity] ? 'Capacity: ' + SIGNING_CAPACITY[s.capacity] : ''}<br>
      Acceptance Date: __________________________
      </p>
    `).join('')}
  </div>
</div>
`;
}

// =============================================================================
// DOCUMENT: ACCREDITED INVESTOR QUESTIONNAIRE (per investor, varies by level)
// =============================================================================
function generateAIQuestionnaire(p7, dealData, investor, levelConfig, sectionNum) {
  const issuer = p7.issuer;
  const selectedCat = AI_CATEGORIES[investor.aiCategory];

  // Build the category list, marking the selected one
  let categoryListHtml = '';
  for (const [key, cat] of Object.entries(AI_CATEGORIES)) {
    const checked = key === investor.aiCategory;
    categoryListHtml += `
      <p style="margin: 0.5rem 0; ${checked ? 'font-weight:700;' : ''}">
        ${checked ? '☑' : '☐'} <strong>${cat.cite}</strong> — ${cat.label}
      </p>`;
  }

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">${sectionNum}. ACCREDITED INVESTOR QUESTIONNAIRE</h2>
  <p class="pkg-doc-subtitle">${entityShortName(issuer).toUpperCase()} — Investor: ${escapeHtml(investor.name || '[Investor Name]')}</p>

  <p class="pkg-recital">This Questionnaire is being provided to determine whether the Subscriber qualifies as an "accredited investor" within the meaning of Rule 501(a) of Regulation D under the Securities Act of 1933, as amended. The information provided in this Questionnaire is necessary to satisfy the Issuer's obligations under federal and state securities laws and will be kept confidential except as required for legal compliance purposes.${levelConfig.requiresVerification ? ' <strong>This offering is conducted under Rule 506(c), and the Company is required to take reasonable steps to verify Subscriber\'s accredited status pursuant to Rule 506(c)(2)(ii). Subscriber agrees to provide documentation supporting the category(ies) selected below.</strong>' : ''}</p>

  <h3 class="pkg-article">PART I — IDENTIFICATION</h3>
  <p>Full Legal Name: <strong>${escapeHtml(investor.name || '_______________________________')}</strong></p>
  <p>Investor Type: <strong>${escapeHtml(INVESTOR_TYPES[investor.type] || investor.type)}</strong></p>
  <p>Mailing Address: <strong>${escapeHtml(investor.address || '_______________________________')}</strong></p>
  <p>Email: <strong>${escapeHtml(investor.email || '_______________________________')}</strong></p>
  <p>Signing Capacity: <strong>${escapeHtml(SIGNING_CAPACITY[investor.signingCapacity] || 'Individually')}</strong></p>

  <h3 class="pkg-article">PART II — ACCREDITED INVESTOR CATEGORY ELECTION</h3>
  <p>Subscriber represents that Subscriber qualifies as an accredited investor under the following category(ies) (check all that apply, primary category marked):</p>

  ${categoryListHtml}

  ${selectedCat ? `<div class="pkg-callout"><strong>Selected category:</strong> ${selectedCat.cite} — ${selectedCat.label}</div>` : ''}

  ${levelConfig.requiresVerification ? `
  <h3 class="pkg-article">PART III — VERIFICATION DOCUMENTATION (Rule 506(c))</h3>
  <p>Subscriber agrees to provide the following documentation to the Issuer (or its designated verification agent) to support the accredited investor category(ies) above. Select the verification method(s) Subscriber will use:</p>
  <p>☐ <strong>Income.</strong> Subscriber will provide IRS Forms W-2, 1099, or 1040 for the two most recent years, together with a written representation that Subscriber reasonably expects to reach the income level in the current year.</p>
  <p>☐ <strong>Net Worth.</strong> Subscriber will provide bank statements, brokerage statements, certificates of deposit, tax assessments, appraisal reports, and a consumer credit report dated within three months, supporting net worth in excess of $1,000,000 (excluding primary residence).</p>
  <p>☐ <strong>Third-Party Confirmation.</strong> Subscriber will furnish a written confirmation from one of the following persons that such person has taken reasonable steps to verify Subscriber's accredited status within the past three months:</p>
  <p style="margin-left:1.5rem;">(a) A registered broker-dealer or registered investment adviser;<br>
  (b) An attorney in good standing under the laws of the jurisdiction in which the attorney is admitted to practice;<br>
  (c) A certified public accountant; or<br>
  (d) An "enrolled agent" within the meaning of 31 C.F.R. § 10.4(c).</p>
  <p>☐ <strong>Previously Verified.</strong> Subscriber previously held securities of the Issuer (or an affiliate) as an accredited investor and continues to certify accredited status.</p>
  <p>☐ <strong>Other Method.</strong> Such other reasonable method as the Issuer may accept in writing.</p>
  ` : `
  <h3 class="pkg-article">PART III — SELF-CERTIFICATION</h3>
  <p>Subscriber certifies under penalty of perjury that the foregoing accredited investor category election is accurate and complete. Subscriber acknowledges that the Issuer is relying on this self-certification under Rule 506(b) of Regulation D and is not required (and shall not be required) to take steps to verify Subscriber's accredited status beyond Subscriber's certification herein.</p>
  `}

  <h3 class="pkg-article">PART IV — SOPHISTICATION AND SUITABILITY</h3>
  <p>Please indicate the most accurate description of Subscriber's investment experience and sophistication:</p>
  <p>☐ Subscriber has substantial professional experience in finance, real estate investments, or related fields.</p>
  <p>☐ Subscriber has previously invested in private placements of similar securities.</p>
  <p>☐ Subscriber regularly utilizes the advice of an independent financial advisor, attorney, or CPA in evaluating investment opportunities.</p>
  <p>☐ Subscriber is investing only a portion of liquid net worth that Subscriber can afford to lose without affecting Subscriber's lifestyle or financial security.</p>
  <p>☐ Subscriber has no significant investment experience and is relying entirely on the disclosure documents and personal evaluation.</p>

  <p><strong>Risk Tolerance Acknowledgment.</strong> Subscriber understands that this investment is speculative and involves substantial risks, including (i) the risk of total loss of the Subscription Amount; (ii) lack of liquidity (no public market); (iii) reliance on the Manager for the success of the investment; (iv) potential conflicts of interest; (v) tax risks; and (vi) risks specific to real estate (construction, market, leasing, regulatory, and operational risks). Subscriber represents that Subscriber can bear this economic risk and that the loss of the Subscription Amount would not materially affect Subscriber's financial security.</p>

  <h3 class="pkg-article">PART V — SIGNATURE</h3>
  <p>Subscriber represents and warrants that the information set forth in this Questionnaire is true, complete, and accurate as of the date hereof, and Subscriber agrees to promptly notify the Issuer of any change in such information prior to acceptance of the related subscription.</p>

  <div class="pkg-signature-block" style="margin-top:1.5rem;">
    <p>Subscriber: <strong>${escapeHtml(investor.name || '_______________________________')}</strong></p>
    <p style="margin-top:1.5rem;">
      Date: __________________________<br><br>
      Signature: __________________________________<br>
      Print Name: ${escapeHtml(investor.name || '_______________________________')}<br>
      ${investor.signingCapacity !== 'self' ? `Capacity: ${SIGNING_CAPACITY[investor.signingCapacity] || investor.signingCapacity}` : 'Capacity: Individually'}
    </p>
  </div>
</div>
`;
}



// =============================================================================
// DOCUMENT: RISK DISCLOSURE LETTER (Level 1 — Friends & Family)
// =============================================================================
function generateRiskDisclosureLetter(p7, dealData, results, sectionNum) {
  const issuer = p7.issuer;
  const totalCommitted = p7.investors.reduce((s,i)=>s+(i.capital||0), 0);

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">${sectionNum}. RISK DISCLOSURE LETTER</h2>
  <p class="pkg-doc-subtitle">${entityShortName(issuer).toUpperCase()} — Friends &amp; Family Offering</p>

  <p>Dear Prospective Investor:</p>

  <p>You are being offered the opportunity to acquire ${escapeHtml(p7.issuer.securities)} of ${entityFullDesignation(issuer)} (the <strong>"Company"</strong>). This letter sets forth material risks associated with the investment and serves as your written risk disclosure in lieu of a full Private Placement Memorandum. The Company is offering ${escapeHtml(p7.issuer.securities)} pursuant to Rule 506(b) of Regulation D under the Securities Act of 1933. The offering is being made only to a limited number of investors with whom the Manager has a pre-existing substantive relationship. <strong>This is an investment with substantial risks. Please review carefully, consult with your own advisors, and make your investment decision only after you fully understand and can accept these risks.</strong></p>

  <h3 class="pkg-article">SUMMARY OF THE INVESTMENT</h3>
  <p><strong>Issuer:</strong> ${entityShortName(issuer)} (${escapeHtml(STATE_DATA.find(s=>s.abbr===issuer.formationState)?.name || issuer.formationState)} ${escapeHtml(issuer.type)})</p>
  <p><strong>Project:</strong> ${escapeHtml(dealData.projectName || 'TBD')} located at ${escapeHtml(dealData.propertyLocation || 'TBD')}</p>
  <p><strong>Deal Type:</strong> ${escapeHtml(DEAL_TYPES[dealData.dealType]?.label || dealData.dealType)}</p>
  <p><strong>Total Capital Sought:</strong> ${fmt$(totalCommitted)}</p>
  <p><strong>Preferred Return:</strong> ${(dealData.prefRate * 100).toFixed(2)}% per annum, ${escapeHtml((dealData.prefType || 'cumulative').replace('_',' '))}</p>
  <p><strong>Anticipated Hold Period:</strong> approximately ${(results?.years || 0).toFixed(1)} years</p>
  <p><strong>Anticipated Exit:</strong> sale or refinancing of the Property</p>
  <p><strong>Securities Offered:</strong> ${escapeHtml(p7.issuer.securities)}</p>
  <p><strong>Securities Exemption:</strong> Reg D 506(b)</p>

  <h3 class="pkg-article">MATERIAL RISKS</h3>

  <p><strong>1. Total Loss of Investment.</strong> Real estate development and operating investments involve substantial risk, including the risk that you may lose your entire investment. The Property may experience construction delays, cost overruns, leasing failures, market downturns, regulatory issues, environmental contamination, casualty events, or other adverse developments. There is no guarantee of any return of capital, much less a profit. You should invest only an amount you can afford to lose entirely without affecting your financial security or lifestyle.</p>

  <p><strong>2. Illiquidity.</strong> Your ${escapeHtml(p7.issuer.securities)} cannot be resold or transferred without the Manager's prior written consent. There is no public market for these securities and none will ever develop. You must be prepared to hold your investment until the Manager determines to liquidate the Property, which may not occur for several years and may be deferred beyond your preferred timeline. Even after exit, distributions are subject to reserves, contingent liabilities, and final tax returns.</p>

  <p><strong>3. Reliance on the Manager.</strong> The success of the investment depends substantially on the skill, experience, and judgment of the Manager. The Manager has broad discretion in operating the Company, including the timing of acquisitions, financings, sales, and distributions. Investors have limited voting rights and cannot directly control the operations of the Company. The Manager could make decisions that are unfavorable to investors. Removal of the Manager requires cause and a high vote threshold (75% of non-Manager Members) and may be difficult to invoke as a practical matter.</p>

  <p><strong>4. Conflicts of Interest.</strong> The Manager and its affiliates may engage in other business activities, including investments in other real estate projects that compete with this Company for capital, management attention, and acquisition opportunities. The Manager and its affiliates receive fees for services to the Company (development, construction management, asset management, disposition, and promoted interest), which may incentivize the Manager to make decisions that are not optimal for investors. Affiliated transactions are permitted under the Operating Agreement subject to a Major Decision vote, but the Manager's control over deal flow gives rise to inherent conflicts.</p>

  <p><strong>5. Leverage.</strong> ${dealData.seniorLoan > 0 ? `The Property is anticipated to be financed in part with senior debt of ${fmt$(dealData.seniorLoan)} at an interest rate of approximately ${(dealData.seniorRate * 100).toFixed(2)}%. Leverage magnifies both upside and downside; if the Property fails to generate sufficient income to service the debt, the lender may foreclose, and your investment may be wiped out. ${dealData.senior752 === 'recourse' ? 'The senior debt is structured as recourse to one or more guarantors; in the event of foreclosure, deficiency claims may pursue the guarantors but not the broader investor pool.' : 'The senior debt is structured as nonrecourse, limiting personal liability but increasing dependence on the Property\'s value to satisfy the obligation.'}` : 'The Property is anticipated to be unlevered, eliminating senior debt risk but limiting potential return on equity through financial leverage.'}</p>

  <p><strong>6. Construction Risk.</strong> ${(dealData.budget?.hard || 0) > 0 ? 'A significant portion of the project budget is allocated to construction. Construction projects are subject to schedule slippage, cost overruns, labor and materials shortages, weather delays, contractor disputes, change orders, permitting delays, and other risks that could increase the budget or extend the timeline beyond projections. Construction cost overruns reduce returns and may require additional capital contributions. ' : ''}The contingency reserve set forth in the budget may not be sufficient to absorb all overruns.</p>

  <p><strong>7. Market Risk.</strong> The value of the Property at exit depends on real estate market conditions, including supply and demand, interest rates, cap rate movement, employment, demographics, and broader economic factors. The exit price assumed for the financial projections is an estimate and may not be realized. A market downturn could materially reduce the exit value and your returns.</p>

  <p><strong>8. Tax Risk.</strong> The federal, state, and local tax consequences of this investment are complex and depend on each investor's individual circumstances. The Company will allocate items of income, gain, loss, deduction, and credit to investors in accordance with the Operating Agreement, and investors will be required to report their allocable share on their tax returns even if no cash is distributed. Specific tax considerations include:</p>
  <p style="margin-left:1.5rem;">(a) Phantom income from depreciation recapture and taxable allocations exceeding cash distributions;<br>
  (b) Taxation of any disposition gain as both § 1231 / § 1250 capital gain (including § 1250 unrecaptured gain at 25%) and ordinary income from depreciation recapture under § 1245;<br>
  (c) State and local taxation in the state of property location for non-resident investors, including potential nonresident withholding;<br>
  (d) Net investment income tax (3.8% NIIT) under § 1411 on rental and disposition income for high-income investors;<br>
  (e) Limitations on the deduction of losses under § 461(l) (excess business loss);<br>
  (f) Possible loss of QBI deduction under § 199A if rental fails Rev. Proc. 2019-38 safe harbor.</p>
  <p>You should consult your own tax advisor regarding the specific tax consequences applicable to your situation. <strong>The Company makes no representation or warranty regarding the tax consequences to any investor.</strong></p>

  <p><strong>9. No Third-Party Review.</strong> This offering is not registered with the Securities and Exchange Commission or any state securities regulator. No regulator has reviewed or approved this letter, the Operating Agreement, or the merits of this offering. The Company has not engaged independent valuation experts, investment bankers, or third-party financial advisors to review the projected returns. The financial projections in the Deal Memorandum (attached as Exhibit A, if elected) are estimates only and may prove materially incorrect.</p>

  <p><strong>10. Securities Restrictions.</strong> The ${escapeHtml(p7.issuer.securities)} are restricted securities under the Securities Act. They may not be resold or transferred except pursuant to an effective registration statement or an applicable exemption. Holders should expect to hold the securities for the full term of the Company.</p>

  <p><strong>11. Sponsor Track Record.</strong> Past performance of the Manager or its affiliates on other projects does not guarantee future performance of this Company. Each project is subject to its own unique risks. Investors should evaluate this investment on the merits of the specific Property and structure, not solely on the Manager's prior performance.</p>

  <p><strong>12. Allocation of Returns.</strong> The Operating Agreement establishes a distribution waterfall with preferred return, return of capital, and promote tiers. The Manager receives a substantial share of the upside above the preferred return through promoted interest. This structure aligns interests but also reduces investor returns relative to a flat pro rata distribution. Investors should review the waterfall mechanics in detail.</p>

  <h3 class="pkg-article">ADDITIONAL CONSIDERATIONS</h3>
  <p><strong>Suitability.</strong> This investment is suitable only for accredited investors with substantial financial resources, no immediate need for liquidity, sophistication to evaluate the merits and risks, and the ability to bear the full loss of the investment. If you do not meet all of these criteria, this investment is not suitable for you.</p>
  <p><strong>Investment Decision.</strong> Your investment decision should be based solely on the Operating Agreement, this Risk Disclosure Letter, the Accredited Investor Questionnaire, your own due diligence, and the advice of your own legal, tax, and financial advisors. No oral statement or representation by the Manager or any other person may be relied upon as superseding this written disclosure.</p>
  <p><strong>No Investment Advice.</strong> Nothing in this letter or any other document furnished in connection with this offering constitutes legal, tax, or investment advice. You should consult your own advisors before investing.</p>

  <h3 class="pkg-article">ACKNOWLEDGMENT</h3>
  <p>By executing the Subscription Agreement, the undersigned Investor acknowledges that the Investor has received, read, and understood this Risk Disclosure Letter, that the Investor has had the opportunity to ask questions of and receive answers from the Manager, and that the Investor accepts the risks described herein and elsewhere in the offering materials.</p>

  <div class="pkg-signature-block">
    <p>This Risk Disclosure Letter is dated ${todayLong()}.</p>
    <p style="margin-top:1.5rem;">${entityShortName(issuer)}</p>
    ${p7.signatories.filter(s => s.entity === 'issuer' || s.entity === 'both').slice(0, 1).map(s => `
      <p style="margin-top:0.85rem;">By: __________________________________<br>
      Name: ${escapeHtml(s.name || '[Name]')}<br>
      Title: ${escapeHtml(s.title || '[Title]')}</p>
    `).join('')}
  </div>
</div>
`;
}



// =============================================================================
// DOCUMENT: PRIVATE PLACEMENT MEMORANDUM (Levels 2 & 3)
// =============================================================================
function generatePPM(p7, dealData, results, levelConfig, sectionNum) {
  const issuer = p7.issuer;
  const sponsor = p7.sponsor;
  const stateName = STATE_DATA.find(s => s.abbr === issuer.formationState)?.name || issuer.formationState;
  const totalCommitted = p7.investors.reduce((s,i)=>s+(i.capital||0), 0);
  const numInvestors = p7.investors.length;

  return `
<div class="pkg-section pkg-doc ppm-doc">
  <h2 class="pkg-doc-title">${sectionNum}. PRIVATE PLACEMENT MEMORANDUM</h2>

  <div class="ppm-cover-block">
    <p style="text-align:center; font-size: 1.15rem; font-weight:700; letter-spacing:1.5px; margin-bottom: 1rem;">${entityShortName(issuer).toUpperCase()}</p>
    <p style="text-align:center; font-size:0.9rem; margin-bottom:0.85rem;">a ${escapeHtml(stateName)} ${escapeHtml(issuer.type)}</p>
    <p style="text-align:center; font-size:1.1rem; font-weight:700; margin-bottom:1rem;">${fmt$(totalCommitted)} OFFERING OF ${escapeHtml(p7.issuer.securities).toUpperCase()}</p>
    <p style="text-align:center; font-size:0.85rem; font-style:italic; margin-bottom:0.5rem;">${escapeHtml(levelConfig.label)}</p>
    <p style="text-align:center; font-size:0.9rem;">Project: ${escapeHtml(dealData.projectName || 'TBD')}</p>
    <p style="text-align:center; font-size:0.85rem; color:#6b6b6b;">Located at: ${escapeHtml(dealData.propertyLocation || 'TBD')}</p>
    <p style="text-align:center; margin-top:1.5rem; font-size:0.78rem; letter-spacing:1.5px;">DATED ${todayLong().toUpperCase()}</p>
  </div>

  <div class="ppm-legend-box">
    <p style="font-weight:700; text-align:center; margin-bottom:0.85rem;">IMPORTANT NOTICES</p>
    <p style="font-size:0.85rem;">THE SECURITIES OFFERED HEREBY HAVE NOT BEEN REGISTERED UNDER THE U.S. SECURITIES ACT OF 1933, AS AMENDED (THE "SECURITIES ACT"), OR UNDER THE SECURITIES LAWS OF ANY STATE. THESE SECURITIES ARE BEING OFFERED IN RELIANCE UPON EXEMPTIONS FROM REGISTRATION PROVIDED BY RULE ${levelConfig.rule} OF REGULATION D UNDER THE SECURITIES ACT AND APPLICABLE STATE SECURITIES LAW EXEMPTIONS. THE SECURITIES ARE SUBJECT TO RESTRICTIONS ON TRANSFER AND RESALE AND MAY NOT BE RESOLD OR OTHERWISE TRANSFERRED EXCEPT PURSUANT TO AN EFFECTIVE REGISTRATION STATEMENT OR AN AVAILABLE EXEMPTION.</p>
    <p style="font-size:0.85rem;">NEITHER THE SECURITIES AND EXCHANGE COMMISSION NOR ANY STATE SECURITIES COMMISSION HAS PASSED UPON OR APPROVED THESE SECURITIES OR THE ADEQUACY OF THIS MEMORANDUM. ANY REPRESENTATION TO THE CONTRARY IS A CRIMINAL OFFENSE.</p>
    <p style="font-size:0.85rem;">${levelConfig.permitsGenSolic ? 'THIS OFFERING IS BEING CONDUCTED UNDER RULE 506(c) OF REGULATION D. ALL PURCHASERS MUST BE VERIFIED ACCREDITED INVESTORS. THE COMPANY MAY USE GENERAL SOLICITATION AND GENERAL ADVERTISING IN CONNECTION WITH THIS OFFERING.' : 'THIS OFFERING IS BEING CONDUCTED UNDER RULE 506(b) OF REGULATION D. THE COMPANY MAY NOT USE GENERAL SOLICITATION OR GENERAL ADVERTISING. EACH PURCHASER MUST HAVE A PRE-EXISTING SUBSTANTIVE RELATIONSHIP WITH THE COMPANY OR ITS PRINCIPALS.'}</p>
    <p style="font-size:0.85rem;">THIS INVESTMENT INVOLVES SIGNIFICANT RISKS, INCLUDING THE POSSIBILITY OF TOTAL LOSS. PROSPECTIVE INVESTORS SHOULD CAREFULLY REVIEW THE RISK FACTORS BEGINNING ON THE PAGE TITLED "RISK FACTORS" AND CONSULT WITH THEIR OWN LEGAL, TAX, AND FINANCIAL ADVISORS.</p>
    <p style="font-size:0.85rem;">NO OFFERING MEMORANDUM, NO REPRESENTATIONS BY THE COMPANY OR ITS MANAGER, AND NO PROJECTIONS OR FINANCIAL DATA CONTAINED HEREIN SHALL CONSTITUTE LEGAL, TAX, OR INVESTMENT ADVICE. THIS MEMORANDUM HAS BEEN PREPARED FROM INFORMATION DERIVED FROM SOURCES BELIEVED RELIABLE BUT WHICH HAS NOT BEEN INDEPENDENTLY VERIFIED. NO PROJECTIONS OR FINANCIAL FORECASTS SHOULD BE CONSIDERED A GUARANTEE OF RETURNS.</p>
  </div>

  <h3 class="pkg-article">PPM TABLE OF CONTENTS</h3>
  <ol class="pkg-list">
    <li>Executive Summary</li>
    <li>Investment Summary &amp; Term Sheet</li>
    <li>The Sponsor and Management</li>
    <li>The Investment Opportunity</li>
    <li>Use of Proceeds</li>
    <li>Risk Factors</li>
    <li>Federal Income Tax Considerations</li>
    <li>State Tax Considerations</li>
    <li>Securities Regulatory Considerations</li>
    <li>Conflicts of Interest</li>
    <li>Material Agreements</li>
    <li>Reports to Investors</li>
    <li>Subscription Procedure</li>
    <li>Glossary of Defined Terms</li>
  </ol>

  <h3 class="pkg-article">1. EXECUTIVE SUMMARY</h3>
  <p>${entityShortName(issuer)} (the <strong>"Company"</strong>) is a ${escapeHtml(stateName)} ${escapeHtml(issuer.type)} formed to acquire, develop, hold, lease, operate, and ultimately dispose of the real property located at ${escapeHtml(dealData.propertyLocation || '[Property Location]')} (the <strong>"Property"</strong>). The Company is offering ${escapeHtml(p7.issuer.securities)} in the aggregate amount of ${fmt$(totalCommitted)} to qualified investors pursuant to this Memorandum.</p>
  <p>The Company is managed by ${sponsor.isIndividual ? 'one or more designated individuals' : entityFullDesignation(sponsor)} (the <strong>"Manager"</strong>). The Manager's principals have ${escapeHtml('extensive')} experience in real estate development, transactional law, tax structuring, and capital deployment. The deal is structured to align the Manager's economic interests with those of investors through a preferred return, return of capital, and promoted interest waterfall, with the Manager earning incentive distributions only after investors achieve defined return hurdles.</p>
  <p>The investment is expected to generate cash distributions over an anticipated hold period of approximately ${(results?.years || 0).toFixed(1)} years, culminating in a sale or refinancing event. Preliminary projections indicate a target LP IRR of approximately ${fmtPct(results?.lpIRR || 0, 1)} and an MOIC of approximately ${fmtMult(results?.lpMOIC || 0)}. <strong>These projections are estimates only, depend on numerous assumptions, and may not be achieved.</strong></p>

  <h3 class="pkg-article">2. INVESTMENT SUMMARY &amp; TERM SHEET</h3>
  <table class="pkg-table">
    <tr><td><strong>Issuer:</strong></td><td>${entityFullDesignation(issuer)}</td></tr>
    <tr><td><strong>Manager:</strong></td><td>${sponsor.isIndividual ? 'Individual Manager(s) as designated' : entityFullDesignation(sponsor)}</td></tr>
    <tr><td><strong>Property:</strong></td><td>${escapeHtml(dealData.propertyLocation || 'TBD')}</td></tr>
    <tr><td><strong>Project Type:</strong></td><td>${escapeHtml(DEAL_TYPES[dealData.dealType]?.label || dealData.dealType)}</td></tr>
    <tr><td><strong>Total Project Cost:</strong></td><td>${fmt$(results?.totalProjectCost || 0)}</td></tr>
    <tr><td><strong>Capital Stack:</strong></td><td>${fmt$(results?.totalMemberCapital || 0)} member equity + ${fmt$(dealData.seniorLoan || 0)} senior debt${(results?.totalMemberDebt || 0) > 0 ? ' + ' + fmt$(results.totalMemberDebt) + ' member debt' : ''}</td></tr>
    <tr><td><strong>Securities Offered:</strong></td><td>${escapeHtml(p7.issuer.securities)}</td></tr>
    <tr><td><strong>Total Offering:</strong></td><td>${fmt$(totalCommitted)}</td></tr>
    <tr><td><strong>Number of Investors:</strong></td><td>${numInvestors}</td></tr>
    <tr><td><strong>Anticipated Hold Period:</strong></td><td>${(results?.years || 0).toFixed(1)} years</td></tr>
    <tr><td><strong>Preferred Return:</strong></td><td>${(dealData.prefRate * 100).toFixed(2)}% per annum, ${escapeHtml((dealData.prefType || 'cumulative').replace('_',' '))} ${escapeHtml((dealData.prefPriority || 'pari passu').replace('_',' '))}</td></tr>
    <tr><td><strong>Waterfall Style:</strong></td><td>${escapeHtml(dealData.waterfallStyle || 'American')}</td></tr>
    <tr><td><strong>Promote Tiers:</strong></td><td>${(dealData.promoteTiers || []).length} tier(s)</td></tr>
    <tr><td><strong>Catchup:</strong></td><td>${escapeHtml((dealData.catchupStyle || 'none').replace('_',' '))}</td></tr>
    <tr><td><strong>Clawback:</strong></td><td>${escapeHtml((dealData.clawbackType || 'none').replace('_',' '))}${dealData.clawbackThreshold ? ` (${(dealData.clawbackThreshold * 100).toFixed(0)}% threshold)` : ''}</td></tr>
    <tr><td><strong>Manager Fees:</strong></td><td>Dev ${(dealData.devFee * 100).toFixed(1)}% / CM ${(dealData.cmFee * 100).toFixed(1)}% / AM ${(dealData.amFee * 100).toFixed(1)}% / Disp ${(dealData.dispFee * 100).toFixed(1)}%</td></tr>
    <tr><td><strong>Target LP IRR:</strong></td><td>${fmtPct(results?.lpIRR || 0, 1)} (projected, not guaranteed)</td></tr>
    <tr><td><strong>Target LP MOIC:</strong></td><td>${fmtMult(results?.lpMOIC || 0)} (projected, not guaranteed)</td></tr>
    <tr><td><strong>Securities Exemption:</strong></td><td>Rule ${levelConfig.rule} of Regulation D</td></tr>
    <tr><td><strong>Investor Eligibility:</strong></td><td>Accredited Investors as defined in Rule 501(a)${levelConfig.requiresVerification ? '; verification required under Rule 506(c)(2)(ii)' : '; self-certification permitted under Rule 506(b)'}</td></tr>
  </table>

  <h3 class="pkg-article">3. THE SPONSOR AND MANAGEMENT</h3>
  <p>The Company is managed by ${sponsor.isIndividual ? 'one or more designated individuals' : entityFullDesignation(sponsor)} as <strong>${sponsor.relationship === 'gp' ? 'General Partner' : sponsor.relationship === 'managing_member' ? 'Managing Member' : 'Manager'}</strong>. ${sponsor.isIndividual ? '' : 'The Manager is a wholly-affiliated entity of the principals identified below.'}</p>
  <p><strong>Manager Principals.</strong> The Manager is led by the principals listed in the Signatory section of this Memorandum. Each principal brings substantial professional experience relevant to the Property and the deal structure, including (as applicable) tax planning for real estate developers, transactional legal representation, certified public accounting, real estate brokerage, and construction management.</p>
  <p><strong>Authorized Signatories.</strong> The persons authorized to sign on behalf of the Manager and/or the Company are identified in the signature block of this Memorandum and on the signature pages of the Operating Agreement, Subscription Agreement, and related documents.</p>
  <p><strong>Bad-Actor Disqualification.</strong> Each "covered person" within the meaning of Rule 506(d) has been evaluated and the Manager represents (and the Sponsor principals each have certified) that no disqualifying event under Rule 506(d)(1) has occurred within the applicable lookback periods.</p>

  <h3 class="pkg-article">4. THE INVESTMENT OPPORTUNITY</h3>
  <p>The Company will acquire ${escapeHtml(dealData.propertyLocation || '[the Property location]')} and ${(dealData.budget?.hard || 0) > 0 ? 'develop, construct, lease, and operate' : 'lease and operate'} the Property over the anticipated hold period of approximately ${(results?.years || 0).toFixed(1)} years. The exit strategy is sale or refinancing at the conclusion of the hold period, with proceeds distributed pursuant to the waterfall set forth in the Operating Agreement.</p>
  <p>The Manager has evaluated the Property based on a combination of market analysis, comparable sales, cost-of-replacement analysis, projected operating income, and exit valuation assumptions. The Sponsor's underwriting reflects judgments about market trajectory, leasing timing, construction cost, and disposition cap rates that may prove incorrect.</p>

  <h3 class="pkg-article">5. USE OF PROCEEDS</h3>
  <p>The Company will use the proceeds of this offering, together with senior debt and member debt (if any), to fund the Total Project Cost set forth in the budget. Approximate use of proceeds (subject to actual costs incurred):</p>
  <table class="pkg-table">
    ${(dealData.budget?.land || 0) > 0 ? `<tr><td>Land Acquisition</td><td class="right">${fmt$(dealData.budget.land)}</td></tr>` : ''}
    ${(dealData.budget?.building || 0) > 0 ? `<tr><td>Existing Building Acquisition</td><td class="right">${fmt$(dealData.budget.building)}</td></tr>` : ''}
    ${(dealData.budget?.hard || 0) > 0 ? `<tr><td>Hard Construction Costs</td><td class="right">${fmt$(dealData.budget.hard)}</td></tr>` : ''}
    ${(dealData.budget?.contingency || 0) > 0 ? `<tr><td>Construction Contingency</td><td class="right">${fmt$(dealData.budget.contingency)}</td></tr>` : ''}
    ${(dealData.budget?.soft || 0) > 0 ? `<tr><td>Soft Costs (architectural, engineering, legal, etc.)</td><td class="right">${fmt$(dealData.budget.soft)}</td></tr>` : ''}
    ${(results?.totalSponsorFees || 0) > 0 ? `<tr><td>Sponsor Fees (development, CM, asset mgmt, disposition)</td><td class="right">${fmt$(results.totalSponsorFees)}</td></tr>` : ''}
    ${(results?.totalInterest || 0) > 0 ? `<tr><td>Interest Carry</td><td class="right">${fmt$(results.totalInterest)}</td></tr>` : ''}
    ${(dealData.budget?.taxIns || 0) > 0 ? `<tr><td>Tax &amp; Insurance Carry</td><td class="right">${fmt$(dealData.budget.taxIns)}</td></tr>` : ''}
    ${(dealData.budget?.marketing || 0) > 0 ? `<tr><td>Marketing &amp; Sales Reserve</td><td class="right">${fmt$(dealData.budget.marketing)}</td></tr>` : ''}
    ${(dealData.budget?.other || 0) > 0 ? `<tr><td>Other / Working Capital</td><td class="right">${fmt$(dealData.budget.other)}</td></tr>` : ''}
    <tr class="total"><td><strong>Total Project Cost</strong></td><td class="right"><strong>${fmt$(results?.totalProjectCost || 0)}</strong></td></tr>
  </table>

  <h3 class="pkg-article">6. RISK FACTORS</h3>
  <p><em>Investors should consider all of the following risks in addition to those described elsewhere in this Memorandum. The risks described herein are not exclusive and other risks not currently known to the Manager or considered immaterial may also affect the investment.</em></p>

  <p><strong>6.1 Total Loss of Investment.</strong> An investment in the Company is speculative and may result in the loss of all capital contributed. The Manager makes no representation that any return of capital, much less profit, will be achieved.</p>

  <p><strong>6.2 Illiquidity and Transfer Restrictions.</strong> The ${escapeHtml(p7.issuer.securities)} are not transferable except with the consent of the Manager and in compliance with applicable securities laws. There is no public market and none is anticipated. Investors must be prepared to hold their investment for the full term of the Company.</p>

  <p><strong>6.3 Construction and Development Risk.</strong> ${(dealData.budget?.hard || 0) > 0 ? `The Project budget includes ${fmt$(dealData.budget.hard)} in hard construction costs. Construction is subject to delays, cost overruns, labor and materials shortages, weather, supply chain disruptions, contractor disputes, change orders, environmental discoveries, and permitting delays. The construction contingency may be insufficient.` : 'The Project does not require substantial construction; however, capital improvements during the hold period may exceed budget.'}</p>

  <p><strong>6.4 Leverage Risk.</strong> ${dealData.seniorLoan > 0 ? `The Property is financed in part with senior debt of ${fmt$(dealData.seniorLoan)} at ${(dealData.seniorRate * 100).toFixed(2)}%. Leverage magnifies returns in both directions; failure to service debt may result in foreclosure and loss of equity.` : 'The Property is anticipated to be unlevered.'}</p>

  <p><strong>6.5 Real Estate Market Risk.</strong> Property values are subject to local and macroeconomic conditions, interest rate movements, cap rate changes, employment, and demographic trends. The Manager's exit value assumption may not be achieved.</p>

  <p><strong>6.6 Leasing and Operating Risk.</strong> The Property's income depends on the ability to lease the space at projected rents to qualified tenants. Tenant defaults, vacancies, and rental concessions could reduce cash flow and exit value.</p>

  <p><strong>6.7 Reliance on Manager.</strong> Investors have limited voting and control rights. The Manager controls operations, financing, leasing, and disposition decisions. Investors must rely on the Manager's judgment.</p>

  <p><strong>6.8 Conflicts of Interest.</strong> The Manager and its affiliates earn substantial fees from the Company (development, CM, asset management, disposition, promoted interest). These fees create incentives that may conflict with investor interests. The Manager may engage in other real estate activities that compete for capital and management attention.</p>

  <p><strong>6.9 Tax Risks.</strong> The federal and state tax consequences of this investment are complex and depend on each investor's individual circumstances. Specific concerns:</p>
  <p style="margin-left:1rem;">(a) Allocation of taxable income without corresponding cash distributions ("phantom income");<br>
  (b) Depreciation recapture under § 1245 (ordinary) and § 1250 unrecaptured gain (25% rate);<br>
  (c) State income tax in the property state for nonresident investors, including potential withholding;<br>
  (d) Net Investment Income Tax (3.8%) for high-income investors;<br>
  (e) Limitations under § 461(l) (excess business loss), § 163(j) (interest), § 469 (passive activity), and § 199A (QBI);<br>
  (f) ${dealData.dealType === 'qof' || dealData.dealType === 'qozb' ? 'Opportunity Zone benefits subject to compliance with § 1400Z-2 90% / 70% tests; ' : ''}${['reit_private','reit_public','upreit','downreit'].includes(dealData.dealType) ? 'REIT compliance under § 856 et seq.; ' : ''}${dealData.dealType === 'tic' ? 'TIC compliance under Rev. Proc. 2002-22; ' : ''}${dealData.dealType === 'dst' ? 'DST compliance under Rev. Rul. 2004-86 (seven deadly sins); ' : ''}other deal-type-specific considerations.</p>
  <p>Investors should consult their own tax advisors. The Company makes no warranty as to tax consequences.</p>

  <p><strong>6.10 Securities Law Risk.</strong> If the Manager fails to comply with Rule ${levelConfig.rule} (general solicitation rules, bad-actor disqualification, integration, Form D filing), the offering exemption could be lost. ${levelConfig.permitsGenSolic ? 'Rule 506(c) compliance depends on reasonable verification steps; failure to verify could disqualify the exemption.' : 'Rule 506(b) compliance depends on the absence of general solicitation; even inadvertent solicitation could disqualify the exemption.'}</p>

  <p><strong>6.11 Regulatory Risk.</strong> Zoning, building codes, environmental regulations, fair housing laws, rent control, transfer taxes, and other regulatory requirements could increase costs, delay the Project, or reduce value. The Manager makes no representation about future regulatory developments.</p>

  <p><strong>6.12 Force Majeure; Casualty.</strong> Hurricane, flood, fire, earthquake, terrorism, pandemic, or other casualty events could damage the Property, delay the timeline, or impair value. Insurance may be insufficient or unavailable.</p>

  <h3 class="pkg-article">7. FEDERAL INCOME TAX CONSIDERATIONS</h3>
  <p>The Company is anticipated to be classified as a partnership for federal income tax purposes (unless it elects to be taxed as a corporation, which is not currently anticipated). Each investor will receive an annual Schedule K-1 reporting its allocable share of income, deductions, and credits.</p>
  <p><strong>Allocations.</strong> Items of income, gain, loss, deduction, and credit will be allocated under the partnership allocation rules of Subchapter K, in accordance with the Operating Agreement and Treas. Reg. § 1.704-1 et seq.</p>
  <p><strong>§ 704(c).</strong> If any property is contributed at a value different from its tax basis, items of income, gain, loss, and deduction with respect to such property will be allocated to take account of the variation between basis and value under Code § 704(c), using the ${escapeHtml(results?.allocData?.method704c || 'traditional')} method.</p>
  <p><strong>Capital Accounts.</strong> The Company will maintain capital accounts for each Member in accordance with Treas. Reg. § 1.704-1(b)(2)(iv).</p>
  <p><strong>§ 752 Debt Allocation.</strong> Each Member's share of partnership liabilities will be determined under Treas. Reg. §§ 1.752-1 through 1.752-7. The senior debt of ${fmt$(dealData.seniorLoan || 0)} is anticipated to be classified as ${escapeHtml(dealData.senior752 || 'nonrecourse')}.</p>
  <p><strong>§ 163(j).</strong> Interest deductions may be limited under § 163(j) unless the Company qualifies for a small business exception or elects real property trade or business status under § 163(j)(7)(B), in which case ADS depreciation is required.</p>
  <p><strong>Depreciation.</strong> Buildings depreciate over 27.5 years (residential rental) or 39 years (nonresidential) under GDS; longer under ADS. Cost segregation may accelerate recovery of certain components into 5-, 7-, or 15-year recovery periods.</p>
  <p><strong>Disposition.</strong> Sale of the Property will generate § 1231 gain (capital) plus § 1250 unrecaptured gain (25% rate) and § 1245 recapture (ordinary income to the extent of prior depreciation on personal property).</p>
  <p><strong>Foreign Investors.</strong> Non-U.S. investors are subject to FIRPTA (15% withholding under § 1445 on disposition, plus possible § 1446(f) withholding on partnership interest transfers). Branch profits tax may apply to foreign corporate Members. Treaty benefits subject to LOB review.</p>
  <p><strong>Tax-Exempt Investors.</strong> U.S. tax-exempt Members may have unrelated business taxable income (UBTI) and unrelated debt-financed income (UDFI) under §§ 511-514. § 514(c)(9) qualified organization status and fractions rule compliance may eliminate UBTI for certain qualifying institutions.</p>

  <h3 class="pkg-article">8. STATE TAX CONSIDERATIONS</h3>
  <p>The Property is located in ${escapeHtml(STATE_DATA.find(s => s.abbr === dealData.propertyState)?.name || dealData.propertyState || 'TBD')}. Each investor's allocable share of income will generally be sourced to that state and subject to state income tax. Nonresident Members may be subject to state nonresident withholding by the Company. The Manager may evaluate, and at the Members' direction may make, an entity-level pass-through entity tax (PTET) election to provide a federal deduction of state tax otherwise subject to the $10,000 SALT cap.</p>
  <p>State tax considerations vary materially by investor residency. Investors should consult their own state tax advisors.</p>

  <h3 class="pkg-article">9. SECURITIES REGULATORY CONSIDERATIONS</h3>
  <p>This offering is conducted under Rule ${levelConfig.rule} of Regulation D under the Securities Act of 1933. ${levelConfig.permitsGenSolic ? 'Rule 506(c) permits general solicitation but requires that all purchasers be accredited investors and that the Issuer take reasonable steps to verify their accredited status pursuant to Rule 506(c)(2)(ii).' : 'Rule 506(b) prohibits general solicitation and permits self-certification of accredited status by purchasers.'}</p>
  <p>The Company will file Form D with the SEC within 15 days of the first sale. State Blue Sky notices will be filed in each state where investors reside, as required.</p>
  <p>The Manager has performed bad-actor disqualification analysis under Rule 506(d) for each covered person.</p>

  <h3 class="pkg-article">10. CONFLICTS OF INTEREST</h3>
  <p><strong>Manager Fees.</strong> The Manager receives substantial fees from the Company. The aggregate fee load incentivizes the Manager to consummate the transaction even if not optimal for investors. The fee structure is disclosed in the Operating Agreement (Exhibit B) and is subject to review by counsel.</p>
  <p><strong>Affiliated Transactions.</strong> The Manager or its affiliates may contract with the Company to provide services (construction management, property management, brokerage). These contracts are required to be on arm's-length terms but the Manager's control of the Company makes the negotiation inherently conflicted.</p>
  <p><strong>Other Investments.</strong> The Manager and its affiliates may invest in other real estate projects that compete with this Company.</p>
  <p><strong>Counsel.</strong> Donovan Legal PLLC has prepared the offering documents on behalf of the Manager. Investors should retain their own counsel to evaluate the offering and to negotiate any individual concerns.</p>

  <h3 class="pkg-article">11. MATERIAL AGREEMENTS</h3>
  <p>The material agreements governing the investment are:</p>
  <ul>
    <li>Operating Agreement of the Company (forming part of this package).</li>
    <li>Subscription Agreement executed by each investor.</li>
    <li>Senior Loan Documents (between the Company and the senior lender).</li>
    <li>Construction Manager Agreement (between the Company and the construction manager, if applicable).</li>
    <li>Property Management Agreement (if and when entered into).</li>
    <li>Brokerage / Listing Agreements (if and when entered into).</li>
    <li>Form D filing materials.</li>
  </ul>

  <h3 class="pkg-article">12. REPORTS TO INVESTORS</h3>
  <p>The Company will provide investors with: (a) within 120 days of fiscal year end, unaudited annual financial statements and Schedule K-1; (b) such interim reports as the Manager deems advisable; (c) notices of material events; (d) updates on the Project's progress; and (e) such other information as may be required by the Operating Agreement or by applicable law.</p>

  <h3 class="pkg-article">13. SUBSCRIPTION PROCEDURE</h3>
  <p>To subscribe for ${escapeHtml(p7.issuer.securities)}, a prospective investor must (i) review this Memorandum, the Operating Agreement, and the Accredited Investor Questionnaire; (ii) execute and deliver the Subscription Agreement and the Accredited Investor Questionnaire; (iii) ${levelConfig.requiresVerification ? 'provide documentation supporting accredited investor verification; ' : ''}(iv) wire the Subscription Amount to the Company's designated account; and (v) receive written acceptance of the subscription from the Manager. Subscriptions are not binding on the Company until accepted in writing by the Manager. The Manager may reject any subscription in its sole discretion.</p>

  <h3 class="pkg-article">14. GLOSSARY OF DEFINED TERMS</h3>
  <p>Capitalized terms used in this Memorandum and not otherwise defined have the meanings set forth in the Operating Agreement.</p>

  <div class="pkg-signature-block" style="margin-top:2rem;">
    <p>This Private Placement Memorandum is dated ${todayLong()}.</p>
    <p style="margin-top:1.5rem;">${entityShortName(issuer)}</p>
    ${p7.signatories.filter(s => s.entity === 'issuer' || s.entity === 'both').slice(0, 1).map(s => `
      <p style="margin-top:0.85rem;">By: __________________________________<br>
      Name: ${escapeHtml(s.name || '[Name]')}<br>
      Title: ${escapeHtml(s.title || '[Title]')}</p>
    `).join('')}
  </div>
</div>
`;
}



// =============================================================================
// DOCUMENT: FORM D FILING WORKSHEET
// =============================================================================
function generateFormDWorksheet(p7, dealData, results, levelConfig, sectionNum) {
  const issuer = p7.issuer;
  const sponsor = p7.sponsor;
  const stateName = STATE_DATA.find(s => s.abbr === issuer.formationState)?.name || issuer.formationState;
  const totalCommitted = p7.investors.reduce((s,i)=>s+(i.capital||0), 0);
  const numInvestors = p7.investors.length;
  const numAccredited = p7.investors.filter(i => i.aiCategory && i.aiCategory.startsWith('501a')).length;

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">${sectionNum}. FORM D FILING WORKSHEET</h2>
  <p class="pkg-doc-subtitle">Data pre-fill for SEC Form D notice filing via EDGAR</p>

  <div class="pkg-callout"><strong>Filing Deadline:</strong> Form D must be filed with the SEC via EDGAR no later than <strong>15 calendar days</strong> after the date of first sale of securities in the offering. Amendments are required upon material changes and annually for ongoing offerings.</div>

  <h3 class="pkg-article">Item 1 — Issuer's Identity</h3>
  <table class="pkg-table">
    <tr><td>Legal Name of Issuer:</td><td>${entityShortName(issuer)}</td></tr>
    <tr><td>Jurisdiction of Incorporation/Organization:</td><td>${escapeHtml(stateName)}</td></tr>
    <tr><td>Entity Type:</td><td>${escapeHtml(issuer.type)}</td></tr>
    <tr><td>Year of Incorporation/Organization:</td><td>${escapeHtml(issuer.formationDate || '[YYYY]')}</td></tr>
    <tr><td>CIK (if any):</td><td>[Obtain via EDGAR filer registration]</td></tr>
    <tr><td>Principal Place of Business:</td><td>${escapeHtml(issuer.address || '[Address]')}</td></tr>
    <tr><td>Telephone:</td><td>[Issuer phone]</td></tr>
    <tr><td>EIN:</td><td>${escapeHtml(issuer.ein || '[Apply via Form SS-4 if not yet assigned]')}</td></tr>
  </table>

  <h3 class="pkg-article">Item 2 — Principal Place of Business and Contact Information</h3>
  <p>Same as Item 1. Designate a contact person for SEC inquiries.</p>

  <h3 class="pkg-article">Item 3 — Related Persons</h3>
  <p>List each executive officer, director, manager, and any beneficial owner of 20% or more of the outstanding voting securities. Each Related Person must be evaluated against Rule 506(d) bad-actor disqualification.</p>
  ${sponsor.isIndividual ? '<p><em>Manager principals to be listed individually.</em></p>' : `
  <table class="pkg-table">
    <tr><td><strong>Related Person:</strong></td><td>${entityShortName(sponsor)}</td></tr>
    <tr><td>Relationship:</td><td>${sponsor.relationship === 'gp' ? 'General Partner' : sponsor.relationship === 'managing_member' ? 'Managing Member' : 'Manager'}</td></tr>
    <tr><td>Address:</td><td>${escapeHtml(sponsor.address || issuer.address || '[Address]')}</td></tr>
  </table>`}
  ${p7.signatories.map(s => `
  <table class="pkg-table" style="margin-top:0.85rem;">
    <tr><td><strong>Related Person:</strong></td><td>${escapeHtml(s.name)}</td></tr>
    <tr><td>Relationship:</td><td>${escapeHtml(s.title)} (${SIGNING_CAPACITY[s.capacity] || s.capacity})</td></tr>
    <tr><td>Acting For:</td><td>${s.entity === 'both' ? 'Issuer and Sponsor' : (s.entity === 'sponsor' ? 'Sponsor' : 'Issuer')}</td></tr>
  </table>`).join('')}

  <h3 class="pkg-article">Item 4 — Industry Group</h3>
  <p>Select: <strong>Real Estate</strong> — most likely sub-category:</p>
  <p>☐ Commercial &nbsp;&nbsp; ☐ Construction &nbsp;&nbsp; ☐ REITs &amp; Finance &nbsp;&nbsp; ☐ Residential &nbsp;&nbsp; ☐ Other Real Estate</p>

  <h3 class="pkg-article">Item 5 — Issuer Size</h3>
  <p>Aggregate Net Asset Value of the Issuer (range): ☐ No Revenues &nbsp;&nbsp; ☐ $1 - $1M &nbsp;&nbsp; ☐ $1M - $5M &nbsp;&nbsp; ☐ $5M - $25M &nbsp;&nbsp; ☐ $25M - $100M &nbsp;&nbsp; ☐ Over $100M &nbsp;&nbsp; ☐ Decline to Disclose &nbsp;&nbsp; ☐ Not Applicable</p>

  <h3 class="pkg-article">Item 6 — Federal Exemption(s) Claimed</h3>
  <p style="font-weight:700;">☑ Rule ${levelConfig.rule} of Regulation D</p>
  <p>☐ Rule 504 &nbsp;&nbsp; ☐ Rule 506(b) &nbsp;&nbsp; ☐ Rule 506(c) &nbsp;&nbsp; ☐ Securities Act § 4(a)(5) &nbsp;&nbsp; ☐ Investment Company Act § 3(c) [_____]</p>

  <h3 class="pkg-article">Item 7 — Type of Filing</h3>
  <p>☑ New Notice &nbsp;&nbsp; ☐ Amendment</p>
  <p>Date of First Sale: __________________ (or check ☐ if first sale yet to occur)</p>

  <h3 class="pkg-article">Item 8 — Duration of Offering</h3>
  <p>Does the issuer intend the offering to continue for more than one year from the date of this filing? ☐ Yes &nbsp;&nbsp; ☐ No</p>

  <h3 class="pkg-article">Item 9 — Type(s) of Securities Offered</h3>
  <p>☑ Equity &nbsp;&nbsp; ☐ Debt &nbsp;&nbsp; ☐ Option to Acquire Another Security &nbsp;&nbsp; ☐ Security to be Acquired Upon Exercise of Option &nbsp;&nbsp; ☐ Tenant-in-Common &nbsp;&nbsp; ☐ Mineral Property &nbsp;&nbsp; ☐ Pooled Investment Fund Interests &nbsp;&nbsp; ☐ Other</p>
  <p>Description: ${escapeHtml(p7.issuer.securities)} of ${entityShortName(issuer)}</p>

  <h3 class="pkg-article">Item 10 — Business Combination Transaction</h3>
  <p>Is this offering being made in connection with a business combination transaction? ☐ Yes &nbsp;&nbsp; ☑ No</p>

  <h3 class="pkg-article">Item 11 — Minimum Investment</h3>
  <p>Minimum investment accepted from any outside investor: $${(p7.investors.length > 0 ? Math.min(...p7.investors.map(i => i.capital).filter(c => c > 0)) : 0).toLocaleString()}</p>

  <h3 class="pkg-article">Item 12 — Sales Compensation</h3>
  <p>Will any person receive sales compensation in connection with this offering? ☐ Yes &nbsp;&nbsp; ☑ No (typical for principals' offering)</p>
  <p>If yes, list each recipient (broker-dealer name, CRD number, states of solicitation).</p>

  <h3 class="pkg-article">Item 13 — Offering and Sales Amounts</h3>
  <table class="pkg-table">
    <tr><td>Total Offering Amount:</td><td class="right">${fmt$(totalCommitted)} (or check ☐ Indefinite)</td></tr>
    <tr><td>Total Amount Sold as of filing date:</td><td class="right">[$_______]</td></tr>
    <tr><td>Total Remaining to be Sold:</td><td class="right">[$_______]</td></tr>
  </table>

  <h3 class="pkg-article">Item 14 — Investors</h3>
  <table class="pkg-table">
    <tr><td>Number of Non-Accredited Investors who have invested:</td><td class="right">${numInvestors - numAccredited}</td></tr>
    <tr><td>Total Number of Investors who have invested:</td><td class="right">${numInvestors}</td></tr>
  </table>
  ${levelConfig.permitsGenSolic ? '<p><strong>Note (506(c)):</strong> All investors must be Accredited Investors verified pursuant to Rule 506(c)(2)(ii). Non-accredited investor count must be zero.</p>' : ''}

  <h3 class="pkg-article">Item 15 — Sales Commissions &amp; Finders' Fees</h3>
  <p>Sales Commissions: $_______&nbsp;&nbsp; Finders' Fees: $_______</p>

  <h3 class="pkg-article">Item 16 — Use of Proceeds</h3>
  <p>Amount of gross proceeds used or proposed to be used for payments to executive officers, directors, or promoters: $_______ (or estimate)</p>

  <h3 class="pkg-article">Item 17 — Signature and Submission</h3>
  <p>Filed pursuant to Regulation D Rule ${levelConfig.rule}. The Issuer certifies that, if the Issuer is claiming a Rule 505 exemption, the Issuer is not disqualified from relying on Rule 505 for one of the reasons stated in Rule 505(b)(2)(iii).</p>
  <p>Signature: __________________________________&nbsp;&nbsp; Date: __________________</p>
  <p>Name of Signer: ${escapeHtml(p7.signatories[0]?.name || '[Authorized Signatory]')}&nbsp;&nbsp; Title: ${escapeHtml(p7.signatories[0]?.title || '[Title]')}</p>

  <h3 class="pkg-article">State Blue Sky Notice Filings</h3>
  <p>Identify each state in which an investor resides. Most states require a notice filing (often called "Blue Sky" filing) within 15 days of first sale in that state, typically accompanied by a filing fee. The following states are likely to require notice based on the investor roster:</p>
  <p>${(() => {
    const states = new Set();
    for (const inv of p7.investors) {
      const parts = inv.address.split(',').map(s => s.trim());
      for (const part of parts) {
        if (part.length === 2 && /^[A-Z]{2}$/i.test(part)) states.add(part.toUpperCase());
        else {
          const match = part.match(/\b([A-Z]{2})\b\s+\d{5}/);
          if (match) states.add(match[1]);
        }
      }
    }
    return states.size > 0 ? Array.from(states).join(', ') : `${escapeHtml(issuer.formationState || '[State]')} (formation state)`;
  })()}</p>
  <p><em>Each state's notice filing requirements should be verified independently. The NASAA Electronic Filing Depository (EFD) is available for many states.</em></p>
</div>
`;
}

// =============================================================================
// DOCUMENT: STATE BLUE SKY NOTICE (property state)
// =============================================================================
function generateBlueSkyNotice(p7, dealData, levelConfig, sectionNum) {
  const issuer = p7.issuer;
  const stateName = STATE_DATA.find(s => s.abbr === issuer.formationState)?.name || issuer.formationState;
  const totalCommitted = p7.investors.reduce((s,i)=>s+(i.capital||0), 0);
  const isFlorida = issuer.formationState === 'FL';

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">${sectionNum}. STATE BLUE SKY NOTICE</h2>
  <p class="pkg-doc-subtitle">${escapeHtml(stateName)} ${isFlorida ? '(Form FL F-X)' : 'Notice of Sale of Securities'}</p>

  <div class="pkg-callout"><strong>Filing Timing:</strong> Most states require notice within 15 days after the first sale in the state. Some states require pre-sale filing or accept the federal Form D as the notice. Filing fees vary by state ($100 - $1,500 typical). The NASAA Electronic Filing Depository (EFD) is available for many states.</div>

  ${isFlorida ? `
  <h3 class="pkg-article">Florida Uniform Notice of Federal Covered Securities (Form F-X)</h3>
  <p>Pursuant to Florida Statutes § 517.082 and Rule 69W-500.014 F.A.C., the Issuer files this notice with the Florida Office of Financial Regulation Division of Securities for the offer and sale of federal covered securities under Rule ${levelConfig.rule} of Regulation D.</p>
  ` : `
  <h3 class="pkg-article">Notice of Sale of Securities (${escapeHtml(stateName)})</h3>
  <p>Pursuant to applicable ${escapeHtml(stateName)} state securities law, the Issuer files this notice with the ${escapeHtml(stateName)} state securities administrator for the offer and sale of federal covered securities under Rule ${levelConfig.rule} of Regulation D.</p>
  `}

  <table class="pkg-table">
    <tr><td><strong>Issuer:</strong></td><td>${entityFullDesignation(issuer)}</td></tr>
    <tr><td><strong>Principal Place of Business:</strong></td><td>${escapeHtml(issuer.address || '[Address]')}</td></tr>
    <tr><td><strong>State of Formation:</strong></td><td>${escapeHtml(stateName)}</td></tr>
    <tr><td><strong>Federal Exemption Relied Upon:</strong></td><td>Rule ${levelConfig.rule} of Regulation D</td></tr>
    <tr><td><strong>Type of Securities:</strong></td><td>${escapeHtml(p7.issuer.securities)}</td></tr>
    <tr><td><strong>Total Offering Amount:</strong></td><td>${fmt$(totalCommitted)}</td></tr>
    <tr><td><strong>Date of First Sale in this State:</strong></td><td>[MM/DD/YYYY]</td></tr>
    <tr><td><strong>Amount Sold to Date in this State:</strong></td><td>$_______</td></tr>
  </table>

  <h3 class="pkg-article">Filing Materials</h3>
  <p>The Issuer is filing concurrently:</p>
  <ul>
    <li>Copy of federal Form D (filed with SEC via EDGAR)</li>
    <li>This Notice (Form F-X or state equivalent)</li>
    <li>Consent to Service of Process (Form U-2)</li>
    <li>${isFlorida ? 'Filing fee of $200 (per FL Statutes § 517.082(2))' : '[State filing fee per state-specific rule]'}</li>
  </ul>

  <h3 class="pkg-article">Filer's Signature</h3>
  <div class="pkg-signature-block">
    <p>${entityShortName(issuer)}</p>
    ${p7.signatories.filter(s => s.entity === 'issuer' || s.entity === 'both').slice(0, 1).map(s => `
      <p style="margin-top:0.85rem;">By: __________________________________<br>
      Name: ${escapeHtml(s.name || '[Name]')}<br>
      Title: ${escapeHtml(s.title || '[Title]')}<br>
      Date: __________________</p>
    `).join('')}
  </div>

  <p style="font-size:0.85rem; font-style:italic; margin-top:1rem;">Counsel should verify the current filing requirements, forms, fees, and submission method for ${escapeHtml(stateName)} as of the filing date, as state rules change. Additional state notices are required wherever an investor resides; see Form D Worksheet, "State Blue Sky Notice Filings."</p>
</div>
`;
}

// =============================================================================
// DOCUMENT: INVESTOR VERIFICATION LETTER (Level 3 — 506(c) only)
// =============================================================================
function generateVerificationLetter(p7, dealData, levelConfig, sectionNum) {
  const issuer = p7.issuer;

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">${sectionNum}. INVESTOR VERIFICATION DOCUMENTATION STANDARD</h2>
  <p class="pkg-doc-subtitle">Rule 506(c)(2)(ii) — Reasonable Verification of Accredited Investor Status</p>

  <p class="pkg-recital">Because this offering is conducted pursuant to Rule 506(c) of Regulation D and permits general solicitation, the Issuer is required to take <strong>reasonable steps</strong> to verify that each purchaser is an accredited investor. Self-certification by the purchaser is NOT sufficient. This document describes the verification methods the Issuer will accept and the documentation each method requires. Each investor should select one method and provide the corresponding documentation prior to acceptance of the subscription.</p>

  <h3 class="pkg-article">METHOD 1 — Income Verification (Individual Investors)</h3>
  <p>For investors qualifying under Rule 501(a)(5) on income, provide either:</p>
  <p style="margin-left:1.5rem;">(a) IRS Form W-2, Form 1099, Schedule K-1, or Form 1040 for the two most recent years showing income exceeding $200,000 (or $300,000 jointly with spouse); <strong>AND</strong></p>
  <p style="margin-left:1.5rem;">(b) A written representation that the investor reasonably expects to reach the income level in the current year.</p>
  <p>The Issuer will accept redacted documents that confirm the dollar threshold without disclosing other sensitive details.</p>

  <h3 class="pkg-article">METHOD 2 — Net Worth Verification (Individual Investors)</h3>
  <p>For investors qualifying under Rule 501(a)(5) on net worth, provide the following dated within the past three months:</p>
  <p style="margin-left:1.5rem;">(a) Documentation of assets: bank statements, brokerage statements, certificates of deposit, tax assessments, and appraisal reports (real estate excluding primary residence);</p>
  <p style="margin-left:1.5rem;">(b) Documentation of liabilities: a consumer credit report from at least one of the three nationwide consumer reporting agencies, plus a written representation that all liabilities have been disclosed;</p>
  <p style="margin-left:1.5rem;">(c) A written representation confirming joint net worth (if applicable, with spouse or spousal equivalent) exceeds $1,000,000 excluding primary residence.</p>

  <h3 class="pkg-article">METHOD 3 — Third-Party Professional Confirmation</h3>
  <p>Furnish a written confirmation, dated within the past three months, from one of the following persons, who has taken reasonable steps to verify the investor's accredited status:</p>
  <p style="margin-left:1.5rem;">(a) A registered broker-dealer (with CRD number);</p>
  <p style="margin-left:1.5rem;">(b) A registered investment adviser (with CRD or IARD number);</p>
  <p style="margin-left:1.5rem;">(c) A licensed attorney in good standing under the laws of the jurisdiction in which the attorney is admitted to practice; or</p>
  <p style="margin-left:1.5rem;">(d) A certified public accountant in good standing.</p>
  <p>A sample form of professional confirmation is attached below.</p>

  <h3 class="pkg-article">METHOD 4 — Previously Verified Investor</h3>
  <p>An investor who previously acquired securities of the Issuer (or an affiliate) as an accredited investor may certify continued accredited status without providing fresh documentation, provided the prior verification was not stale (typically within five years).</p>

  <h3 class="pkg-article">METHOD 5 — Knowledgeable Employee</h3>
  <p>If the Issuer is a private fund and the investor is a "knowledgeable employee" within the meaning of Rule 3c-5 under the Investment Company Act, status as such satisfies the verification requirement.</p>

  <h3 class="pkg-article">METHOD 6 — Entities Qualifying Under Rule 501(a)(1)-(4), (7)-(11)</h3>
  <p>For entities qualifying as accredited investors based on regulated status (banks, broker-dealers, etc.), tax-exempt organization status, asset size, or knowledgeable employees, provide documentation of the qualifying status (e.g., regulatory registration, IRS determination letter, audited financial statements).</p>

  <h3 class="pkg-article">SAMPLE THIRD-PARTY VERIFICATION LETTER</h3>
  <div class="pkg-callout" style="font-style:normal;">
    <p>[Letterhead of Attorney / CPA / Broker-Dealer / Investment Adviser]</p>
    <p>Date: __________________</p>
    <p>To: ${entityShortName(issuer)}</p>
    <p>Re: Investor Verification for Accredited Investor Status — Rule 506(c)(2)(ii)</p>
    <p>Dear Manager:</p>
    <p>I am a [licensed attorney / certified public accountant / registered broker-dealer / registered investment adviser] in good standing, [CRD/Bar number ____]. I represent [or have a professional relationship with] [Investor Name] (the "Investor"). Within the past three (3) months I have taken reasonable steps to verify that the Investor qualifies as an "accredited investor" within the meaning of Rule 501(a) of Regulation D under the Securities Act of 1933, based on the following category(ies):</p>
    <p>☐ Rule 501(a)(5) on income (individual or joint income above the threshold)</p>
    <p>☐ Rule 501(a)(5) on net worth (in excess of $1,000,000 excluding primary residence)</p>
    <p>☐ Other category: ______________________________</p>
    <p>I confirm that the Investor is an accredited investor as of the date hereof. This letter is being provided to you in connection with the Investor's proposed investment in ${entityShortName(issuer)} and may be relied upon by the Issuer for purposes of satisfying Rule 506(c)(2)(ii).</p>
    <p>Sincerely,</p>
    <p>__________________________________<br>
    Name: ______________________________<br>
    Title: ______________________________<br>
    Firm: ______________________________</p>
  </div>

  <h3 class="pkg-article">VERIFICATION RECORDS</h3>
  <p>The Issuer will retain verification records, including all documentation submitted by each investor and any third-party confirmation letters, for at least five (5) years from the date of the related sale, as is reasonable under the circumstances. Verification records will be kept confidential and used solely for compliance and regulatory examination purposes.</p>
</div>
`;
}

// =============================================================================
// DOCUMENT: GENERAL SOLICITATION COMPLIANCE MEMO (Level 3 only)
// =============================================================================
function generateGenSolicMemo(p7, dealData, levelConfig, sectionNum) {
  const issuer = p7.issuer;

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">${sectionNum}. GENERAL SOLICITATION COMPLIANCE MEMORANDUM</h2>
  <p class="pkg-doc-subtitle">Rule 506(c) — Internal Compliance Framework</p>

  <p class="pkg-recital"><strong>To:</strong> Manager and authorized signatories of ${entityShortName(issuer)}<br>
  <strong>From:</strong> Donovan Legal PLLC (template)<br>
  <strong>Re:</strong> General Solicitation Compliance Framework under Rule 506(c)<br>
  <strong>Date:</strong> ${todayLong()}</p>

  <p>This memorandum outlines the compliance framework applicable to ${entityShortName(issuer)} (the <strong>"Issuer"</strong>) in conducting its offering under Rule 506(c) of Regulation D, which permits general solicitation and general advertising subject to specified conditions.</p>

  <h3 class="pkg-article">1. Permitted Activities Under Rule 506(c)</h3>
  <p>Rule 506(c) permits, in connection with the offer and sale of securities:</p>
  <p style="margin-left:1.5rem;">(a) Public-facing websites and landing pages describing the offering;</p>
  <p style="margin-left:1.5rem;">(b) Social media announcements, posts, and advertising;</p>
  <p style="margin-left:1.5rem;">(c) Email solicitation to persons regardless of pre-existing relationship;</p>
  <p style="margin-left:1.5rem;">(d) Print, radio, television, and online advertising;</p>
  <p style="margin-left:1.5rem;">(e) Press releases announcing the offering;</p>
  <p style="margin-left:1.5rem;">(f) Public-facing pitch decks and offering teasers;</p>
  <p style="margin-left:1.5rem;">(g) Industry conferences, panel appearances, and networking events at which the offering is mentioned;</p>
  <p style="margin-left:1.5rem;">(h) Webinars and recorded video content describing the deal;</p>
  <p style="margin-left:1.5rem;">(i) Public references to current or prior funds, including aggregated performance data.</p>

  <h3 class="pkg-article">2. Restrictions That Continue to Apply</h3>
  <p>Notwithstanding the permissibility of general solicitation, the following restrictions apply:</p>
  <p style="margin-left:1.5rem;"><strong>(a) Accredited Investor Limitation.</strong> ALL purchasers must be Accredited Investors as defined in Rule 501(a). Non-accredited investors may NOT be admitted, even those who would qualify under Rule 506(b)'s up-to-35-sophisticated-investor allowance. Any sale to a non-accredited investor will disqualify the entire offering.</p>
  <p style="margin-left:1.5rem;"><strong>(b) Reasonable Verification.</strong> The Issuer must take reasonable steps to verify the accredited status of each purchaser pursuant to Rule 506(c)(2)(ii). Self-certification is NOT sufficient. See "Investor Verification Documentation Standard" for permitted methods.</p>
  <p style="margin-left:1.5rem;"><strong>(c) Anti-Fraud.</strong> The general anti-fraud provisions of the federal securities laws (§ 17(a) of the Securities Act and § 10(b) and Rule 10b-5 of the Exchange Act) apply to all materials and communications. Statements must be accurate and not misleading.</p>
  <p style="margin-left:1.5rem;"><strong>(d) Performance Advertising.</strong> If past performance is advertised, comply with applicable SEC rules and FINRA guidance. Disclose methodology, time period, and material assumptions. Performance projections must be reasonable, supported, and clearly labeled as estimates.</p>
  <p style="margin-left:1.5rem;"><strong>(e) Investment Adviser Status.</strong> Public solicitation may trigger investment adviser status for the Manager. Confirm exemptions (e.g., private fund adviser, family office, intrastate) before commencing general solicitation.</p>
  <p style="margin-left:1.5rem;"><strong>(f) Commodity Pool Regulations.</strong> If the offering involves any element of commodity pool participation, CFTC and NFA rules apply in addition to securities laws.</p>

  <h3 class="pkg-article">3. Rule 506(d) Bad-Actor Disqualification Check</h3>
  <p>For each "covered person" — including the Issuer, its predecessors, affiliated issuers, directors, executive officers, managers, managing members, general partners, beneficial owners of 20% or more of outstanding voting securities, promoters, investment managers, and persons compensated for solicitation — the Issuer must confirm that no disqualifying event under Rule 506(d)(1) has occurred within the applicable lookback period. Disqualifying events include:</p>
  <p style="margin-left:1.5rem;">(a) Criminal convictions for certain felonies and misdemeanors (5-year lookback for issuers, 10-year for executive officers);</p>
  <p style="margin-left:1.5rem;">(b) Court injunctions or restraining orders within 5 years;</p>
  <p style="margin-left:1.5rem;">(c) Certain final orders of state securities, banking, insurance, or credit-union regulators within 10 years;</p>
  <p style="margin-left:1.5rem;">(d) SEC disciplinary orders (no time limit);</p>
  <p style="margin-left:1.5rem;">(e) SEC cease-and-desist orders within 5 years;</p>
  <p style="margin-left:1.5rem;">(f) Suspensions or expulsions from registered securities associations or self-regulatory organizations;</p>
  <p style="margin-left:1.5rem;">(g) U.S. Postal Service false-representation orders within 5 years.</p>
  <p>The Manager should obtain a written representation and certification from each covered person prior to commencing the offering, and should re-confirm prior to each significant material change.</p>

  <h3 class="pkg-article">4. Filing and Documentation Requirements</h3>
  <p style="margin-left:1.5rem;">(a) <strong>Form D.</strong> File with the SEC via EDGAR within 15 calendar days of first sale. Re-file annually and upon material changes. Check the Rule 506(c) box.</p>
  <p style="margin-left:1.5rem;">(b) <strong>State Blue Sky.</strong> File notice in every state where an investor resides; deadlines vary by state.</p>
  <p style="margin-left:1.5rem;">(c) <strong>Marketing Materials Repository.</strong> Maintain a record of all written marketing materials, advertisements, and public communications used in the offering. Retain for at least five years.</p>
  <p style="margin-left:1.5rem;">(d) <strong>Verification Records.</strong> Retain verification documentation for each investor for at least five years.</p>

  <h3 class="pkg-article">5. Integration With Other Offerings</h3>
  <p>Under Rule 152 (post-March 2021 framework), separate offerings made by the same issuer may be integrated if conducted too close in time. Specifically:</p>
  <p style="margin-left:1.5rem;">(a) Offerings completed more than 30 days apart are not integrated;</p>
  <p style="margin-left:1.5rem;">(b) Within 30 days, offerings are not integrated if each complies with its own exemption AND, for offerings without general solicitation, no information about the concurrent solicitation offering would have caused the non-solicitation offering to fail.</p>
  <p>The Manager should track all concurrent and recent prior offerings to avoid integration issues.</p>

  <h3 class="pkg-article">6. Compliance Checklist</h3>
  <p>Before commencing general solicitation:</p>
  <p>☐ Bad-actor certifications obtained from all covered persons</p>
  <p>☐ Verification methodology adopted and described in Subscription documents</p>
  <p>☐ Marketing materials reviewed by counsel</p>
  <p>☐ Performance advertising reviewed for SEC/FINRA compliance</p>
  <p>☐ Investment adviser status evaluated</p>
  <p>☐ Marketing materials repository established</p>
  <p>☐ Verification records protocol established</p>
  <p>☐ State Blue Sky filing readiness for likely investor states</p>
  <p>☐ Form D filing process and EDGAR access confirmed</p>
  <p>☐ Integration analysis with concurrent/recent offerings completed</p>

  <p style="font-size:0.85rem; font-style:italic; margin-top:1rem;">This memorandum is a template framework. The Manager should review and customize based on the specific marketing strategy, channels, and message of the offering, in consultation with counsel.</p>
</div>
`;
}



// =============================================================================
// MAIN ASSEMBLY: generateDealPackage()
// =============================================================================
function generateDealPackage() {
  const p7 = collectPhase7Data();
  const dealData = collectFormData();
  const results = DB.lastResults || calculateDeal(dealData);
  const levelConfig = SEC_LEVEL_CONFIG[p7.securitiesLevel];

  // Validation
  const issues = [];
  if (!p7.issuer.name) issues.push('Issuer legal name is required.');
  if (!p7.issuer.formationState) issues.push('Issuer state of formation is required.');
  if (p7.signatories.length === 0) issues.push('At least one authorized signatory must be specified.');
  if (p7.signatories.some(s => !s.name)) issues.push('All signatories must have a name.');
  if (p7.investors.length === 0) issues.push('At least one investor must be added to the Investor List.');
  if (p7.investors.some(i => !i.name)) issues.push('All investors must have a legal name.');
  if (p7.investors.some(i => !i.capital || i.capital <= 0)) issues.push('All investors must have a positive Capital Commitment.');
  if (p7.investors.some(i => !i.memberClassId)) issues.push('All investors must be assigned to a member class.');

  if (issues.length > 0) {
    alert('Cannot generate deal package. Issues to resolve:\n\n' + issues.join('\n'));
    return;
  }

  // Build the document HTML in order
  let sectionNum = 2;
  let bodyHtml = generatePackageCover(p7, dealData, levelConfig);
  bodyHtml += generatePackageTOC(p7, dealData, levelConfig);
  bodyHtml += generatePackageOverview(p7, dealData, levelConfig);
  bodyHtml += generateOperatingAgreement(p7, dealData, results);
  sectionNum = 3;

  if (levelConfig.includesRiskLetter) {
    bodyHtml += generateRiskDisclosureLetter(p7, dealData, results, sectionNum++);
  }
  if (levelConfig.includesPPM) {
    bodyHtml += generatePPM(p7, dealData, results, levelConfig, sectionNum++);
  }

  // Sub Ag form section
  bodyHtml += `<div class="pkg-section pkg-doc">
    <h2 class="pkg-doc-title">${sectionNum++}. SUBSCRIPTION AGREEMENT &mdash; Form and Executed Counterparts</h2>
    <p class="pkg-doc-subtitle">${p7.investors.length} counterpart${p7.investors.length === 1 ? '' : 's'} follow, each personalized for the named subscriber</p>
  </div>`;

  // Per-investor Subscription Agreements
  for (const inv of p7.investors) {
    bodyHtml += generateSubscriptionAgreement(p7, dealData, inv, levelConfig, `${sectionNum - 1}.${p7.investors.indexOf(inv) + 1}`);
  }

  // AI Questionnaire form section
  bodyHtml += `<div class="pkg-section pkg-doc">
    <h2 class="pkg-doc-title">${sectionNum++}. ACCREDITED INVESTOR QUESTIONNAIRE &mdash; Form and Executed Counterparts</h2>
    <p class="pkg-doc-subtitle">${p7.investors.length} counterpart${p7.investors.length === 1 ? '' : 's'} follow, each personalized for the named investor</p>
  </div>`;

  // Per-investor AI Questionnaires
  for (const inv of p7.investors) {
    bodyHtml += generateAIQuestionnaire(p7, dealData, inv, levelConfig, `${sectionNum - 1}.${p7.investors.indexOf(inv) + 1}`);
  }

  if (levelConfig.includesVerifLetter) {
    bodyHtml += generateVerificationLetter(p7, dealData, levelConfig, sectionNum++);
  }
  if (levelConfig.includesGenSolicMemo) {
    bodyHtml += generateGenSolicMemo(p7, dealData, levelConfig, sectionNum++);
  }

  bodyHtml += generateFormDWorksheet(p7, dealData, results, levelConfig, sectionNum++);
  bodyHtml += generateBlueSkyNotice(p7, dealData, levelConfig, sectionNum++);

  // Deal Memo appendix if elected
  if (p7.options.includeDealMemo) {
    bodyHtml += `<div class="pkg-section pkg-doc">
      <h2 class="pkg-doc-title">EXHIBIT A &mdash; Deal Memorandum (Financial Analysis &amp; Structural Diagram)</h2>
      <p class="pkg-doc-subtitle">${escapeHtml(dealData.projectName || 'Project')} &mdash; ${todayLong()}</p>
      <p style="font-style:italic; color:#6b6b6b;">The following Deal Memorandum is generated by the Donovan Legal PLLC Reserve Deal Builder Phase&nbsp;V output. It is attached for the convenience of investors and forms part of this package.</p>
      <div style="margin-top:1.5rem;">
        ${(typeof generateDealMemoBody === 'function') ? generateDealMemoBody(dealData, results) : '<p><em>Deal Memo content not available in this session. Generate the Deal Memo from the Results step (Step&nbsp;9), then re-generate the Deal Package.</em></p>'}
      </div>
    </div>`;
  }

  // Wrap everything in a full HTML doc with print styles
  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Deal Package — ${escapeHtml(p7.issuer.name)}</title>
<style>
${getDealPackagePrintCSS()}
</style>
</head>
<body>
  <div class="pkg-draft-stamp">DRAFT &middot; PRIVILEGED &amp; CONFIDENTIAL</div>
  <div class="pkg-container">
    ${bodyHtml}
  </div>
  <div class="pkg-footer">
    Generated ${todayLong()} &middot; Donovan Legal PLLC &middot; Reserve Deal Builder &middot; DRAFT &mdash; for review under engagement letter
  </div>
</body>
</html>`;

  // Open in new tab
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(fullHtml);
    newWindow.document.close();
  } else {
    alert('Pop-up blocked. Please allow pop-ups for this page to view the deal package.');
  }
}

// =============================================================================
// PRINT-OPTIMIZED CSS FOR DEAL PACKAGE OUTPUT
// =============================================================================
function getDealPackagePrintCSS() {
  return `
    @page { size: letter; margin: 0.85in 0.75in 1in 0.75in; }
    * { box-sizing: border-box; }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 11pt; line-height: 1.55;
      color: #1a1a1a; background: #F5F5F0;
      margin: 0; padding: 0;
    }
    .pkg-container { max-width: 7.5in; margin: 0 auto; padding: 0.5in 0.5in 1in 0.5in; background: #FFFFFF; }
    .pkg-draft-stamp {
      position: fixed; top: 0.4in; right: 0.4in;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 0.7rem; letter-spacing: 2px;
      padding: 0.35rem 0.6rem; background: #8b3a3a; color: #FFFFFF;
      transform: rotate(8deg); border: 2px solid #8b3a3a;
      opacity: 0.85; z-index: 1000; pointer-events: none;
    }
    @media print {
      .pkg-draft-stamp { display: none; }
      .pkg-container { padding: 0; max-width: 100%; }
      .pkg-section { page-break-after: always; }
      .pkg-doc { page-break-before: always; }
      h2.pkg-doc-title, h3.pkg-article { page-break-after: avoid; }
      p, table { page-break-inside: avoid; }
    }
    .pkg-cover {
      min-height: 9in; display: flex; flex-direction: column;
      justify-content: space-between; padding: 1in 0.5in;
      page-break-after: always;
    }
    .pkg-cover .firm-mark {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 0.8rem; letter-spacing: 3px;
      color: #169B62; font-weight: 700;
    }
    .pkg-cover .firm-name {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 1.6rem; font-weight: 700;
      color: #1a1a1a; margin-top: 0.5rem;
      letter-spacing: 1.5px;
    }
    .pkg-cover .memo-label {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 0.75rem; letter-spacing: 2px;
      color: #6b6b6b; text-transform: uppercase;
    }
    .pkg-cover h1 {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 2.2rem; font-weight: 700;
      color: #1a1a1a; margin: 0.5rem 0;
      letter-spacing: -0.5px;
    }
    .pkg-cover .subhead {
      font-size: 1.1rem; color: #4a4a4a;
      margin: 0.35rem 0;
    }
    .pkg-cover .meta {
      font-size: 0.9rem; color: #6b6b6b;
      margin-top: 0.5rem; font-style: italic;
    }
    .pkg-cover .draft-stamp-large {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 0.9rem; letter-spacing: 3px;
      padding: 0.6rem 1rem; background: #8b3a3a;
      color: #FFFFFF; display: inline-block;
      margin-bottom: 1rem; font-weight: 700;
    }
    .pkg-cover .cover-notice {
      font-size: 0.85rem; line-height: 1.65;
      color: #4a4a4a; max-width: 5.5in;
      padding-top: 1rem; border-top: 1px solid #d4d4d0;
    }
    .pkg-toc { page-break-after: always; padding: 1in 0.5in; }
    .pkg-toc h2 {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 1.4rem; font-weight: 700;
      color: #1a1a1a; margin: 0 0 1.5rem 0;
      padding-bottom: 0.5rem; border-bottom: 2px solid #169B62;
      letter-spacing: 0.5px;
    }
    .pkg-toc ol {
      list-style: none; counter-reset: toc-counter;
      padding: 0; margin: 0;
    }
    .pkg-toc ol li {
      counter-increment: toc-counter;
      padding: 0.5rem 0; border-bottom: 1px dotted #d4d4d0;
      font-size: 0.95rem; color: #1a1a1a;
    }
    .pkg-toc ol li::before {
      content: counter(toc-counter, decimal) ". ";
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-weight: 700; color: #169B62;
      margin-right: 0.5rem;
    }
    .pkg-section { padding: 0.5in 0; }
    .pkg-doc { padding-top: 0.5in; }
    .pkg-doc-title {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 1.4rem; font-weight: 700;
      color: #1a1a1a; margin: 0 0 0.35rem 0;
      letter-spacing: 0.5px; text-transform: uppercase;
      padding-bottom: 0.4rem; border-bottom: 3px solid #169B62;
    }
    .pkg-doc-subtitle {
      font-size: 0.95rem; color: #4a4a4a;
      font-style: italic; margin: 0 0 1.5rem 0;
    }
    .pkg-article {
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 1rem; font-weight: 700;
      color: #1a1a1a; margin: 1.5rem 0 0.85rem 0;
      letter-spacing: 0.5px;
      padding-bottom: 0.25rem; border-bottom: 1px solid #d4d4d0;
    }
    .pkg-recital {
      margin: 1rem 0; padding: 1rem;
      background: #fafaf5; border-left: 3px solid #169B62;
      font-size: 0.95rem; line-height: 1.65;
    }
    .pkg-callout {
      padding: 0.85rem 1rem; background: #fff8e0;
      border-left: 3px solid #d4a017;
      margin: 1rem 0; font-size: 0.9rem;
    }
    .pkg-legend {
      padding: 0.85rem; background: #f0f0e8;
      border: 1px solid #c4c4b8;
      font-family: 'Courier New', Courier, monospace;
      font-size: 0.78rem; letter-spacing: 0.3px;
      margin: 0.85rem 0;
    }
    .pkg-list { font-size: 0.95rem; line-height: 1.7; }
    .pkg-table {
      width: 100%; border-collapse: collapse; margin: 0.85rem 0;
      font-size: 0.92rem;
    }
    .pkg-table td {
      padding: 0.4rem 0.6rem;
      border-bottom: 1px solid #e8e8e0;
      vertical-align: top;
    }
    .pkg-table td.right { text-align: right; font-variant-numeric: tabular-nums; }
    .pkg-table th {
      background: #1a1a1a; color: #F5F5F0;
      padding: 0.5rem 0.6rem; text-align: left;
      font-family: 'Helvetica Neue', Arial, sans-serif;
      font-size: 0.78rem; font-weight: 700;
      letter-spacing: 1px; text-transform: uppercase;
    }
    .pkg-table tr.total td {
      background: #169B62; color: #FFFFFF;
      font-weight: 700;
    }
    .pkg-signature-block {
      margin: 1.5rem 0; padding: 1rem 1.25rem;
      background: #fafaf5; border: 1px solid #d4d4d0;
      font-size: 0.92rem; line-height: 1.65;
    }
    .ppm-cover-block {
      margin: 1.5rem 0 2rem 0; padding: 2rem 1.5rem;
      border: 2px solid #1a1a1a; text-align: center;
      page-break-after: avoid;
    }
    .ppm-legend-box {
      margin: 1.5rem 0; padding: 1.25rem;
      background: #f8f8f0; border: 1.5px solid #1a1a1a;
      font-size: 0.88rem; line-height: 1.65;
    }
    .pkg-footer {
      text-align: center; padding: 1rem 0; margin-top: 2rem;
      font-size: 0.78rem; color: #6b6b6b; font-style: italic;
      border-top: 1px solid #d4d4d0;
    }
    p { margin: 0.55rem 0; }
    strong { font-weight: 700; }
  `;
}



// =============================================================================
// EXTEND SAVE/LOAD FOR PHASE 7
// =============================================================================
const _phase6SaveJSON = saveJSON;
saveJSON = function() {
  const data = collectFormData();

  // Collect Phase 6 inputs
  const phase6Inputs = {};
  ['ovl_163j_gross_receipts','ovl_163j_rptb_election','ovl_163j_ati','ovl_163j_total_interest',
   'ovl_461l_filing','ovl_461l_other_income','ovl_461l_existing_nol','ovl_461l_threshold_override',
   'ovl_199a_qualifies','ovl_199a_above_threshold','ovl_199a_w2_wages','ovl_199a_ubia',
   'ovl_ptet_election','ovl_apportionment_states','ovl_member_residency','ovl_composite_return',
   'ovl_rollforward_detail'].forEach(id => {
    const el = document.getElementById(id);
    if (el) phase6Inputs[id] = el.value;
  });

  // Collect Phase 7 inputs
  const phase7Inputs = {};
  ['dp_issuer_name','dp_issuer_type','dp_issuer_formation_state','dp_issuer_formation_date',
   'dp_issuer_address','dp_issuer_ein','dp_issuer_securities',
   'dp_sponsor_name','dp_sponsor_type','dp_sponsor_formation_state','dp_sponsor_relationship','dp_sponsor_address',
   'dp_include_deal_memo','dp_output_format','dp_drafting_notes'].forEach(id => {
    const el = document.getElementById(id);
    if (el) phase7Inputs[id] = el.value;
  });
  phase7Inputs.dp_sponsor_individual = document.getElementById('dp_sponsor_individual')?.checked || false;
  phase7Inputs.sec_level = document.querySelector('input[name="sec_level"]:checked')?.value || 'level_1_ff';

  const payload = {
    version: 'phase-7',
    savedAt: new Date().toISOString(),
    state: {
      memberClasses: DB.memberClasses,
      memberDebt: DB.memberDebt,
      promoteTiers: DB.promoteTiers,
      sec704cLayers: DB.sec704cLayers,
      blockers: DB.blockers,
      investorProfiles: DB.investorProfiles,
      signatories: DB.signatories,
      investors: DB.investors,
      orgChart: { positionOverrides: DB.orgChart.positionOverrides, customNodes: DB.orgChart.nodes.filter(n => n.custom), customEdges: DB.orgChart.edges.filter(e => e.custom) },
      nextMemberId: DB.nextMemberId,
      nextDebtId: DB.nextDebtId,
      nextTierId: DB.nextTierId,
      nextLayerId: DB.nextLayerId,
      nextBlockerId: DB.nextBlockerId,
      nextSignatoryId: DB.nextSignatoryId,
      nextInvestorId: DB.nextInvestorId
    },
    formInputs: collectFormInputsForSave(),
    allocationInputs: {
      alloc_704b_method: document.getElementById('alloc_704b_method')?.value,
      alloc_capacct_maintenance: document.getElementById('alloc_capacct_maintenance')?.value,
      alloc_min_gain_chargeback: document.getElementById('alloc_min_gain_chargeback')?.value,
      alloc_704c_present: document.getElementById('alloc_704c_present')?.value,
      alloc_704c_parallel: document.getElementById('alloc_704c_parallel')?.value,
      alloc_704c_method: document.getElementById('alloc_704c_method')?.value,
      alloc_754_election: document.getElementById('alloc_754_election')?.value,
      alloc_anticipated_transfer: document.getElementById('alloc_anticipated_transfer')?.value,
      cost_seg_pct: document.getElementById('cost_seg_pct')?.value,
      cost_seg_allocation_target: document.getElementById('cost_seg_allocation_target')?.value,
      checkboxes: {
        alloc_1245_recapture: document.getElementById('alloc_1245_recapture')?.checked,
        alloc_1250_unrecaptured: document.getElementById('alloc_1250_unrecaptured')?.checked,
        alloc_cost_seg_pickup: document.getElementById('alloc_cost_seg_pickup')?.checked,
        alloc_nonrecourse_deduction: document.getElementById('alloc_nonrecourse_deduction')?.checked
      },
      droClasses: Array.from(document.querySelectorAll('.dro-checkbox')).filter(cb => cb.checked).map(cb => parseInt(cb.dataset.id, 10))
    },
    phase3Inputs: {
      firpta_is_usrpi: document.getElementById('firpta_is_usrpi')?.value,
      firpta_usrphc_status: document.getElementById('firpta_usrphc_status')?.value,
      firpta_domestic_controlled: document.getElementById('firpta_domestic_controlled')?.value,
      firpta_disposition_amount: document.getElementById('firpta_disposition_amount')?.value,
      ubti_acq_indebtedness: document.getElementById('ubti_acq_indebtedness')?.value,
      ubti_debt_basis_ratio: document.getElementById('ubti_debt_basis_ratio')?.value
    },
    phase4Inputs: (function() {
      const o = { checkboxes: {} };
      ['reit_num_shareholders','reit_top5_ownership','reit_re_income_pct',
       'reit_other_passive_income_pct','reit_re_assets_pct','reit_trs_pct',
       'reit_largest_issuer_pct','reit_distribution_pct',
       'qof_90_pct','qof_form_8996','qozb_70_pct','qozb_active_income_pct',
       'qozb_wcsh','qozb_sub_improvement','qozb_sin_business','qof_investor_hold',
       'tic_cotenants','tic_largest_interest','tic_unanimous','tic_fee_interest',
       'tic_proportionate','tic_debt','tic_manager','tic_tax_reporting',
       'dst_master_lease','dst_springing_llc'].forEach(id => { const el = document.getElementById(id); if (el) o[id] = el.value; });
      ['dst_sin_1','dst_sin_2','dst_sin_3','dst_sin_4','dst_sin_5','dst_sin_6','dst_sin_7'].forEach(id => { const el = document.getElementById(id); if (el) o.checkboxes[id] = el.checked; });
      return o;
    })(),
    phase6Inputs,
    phase7Inputs
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const name = (data.projectName || 'deal').replace(/[^a-zA-Z0-9-_]/g, '_');
  a.href = url;
  a.download = `${name}-deal-builder-${new Date().toISOString().slice(0,10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

const _phase6LoadJSON = loadJSON;
loadJSON = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const payload = JSON.parse(e.target.result);
      DB.memberClasses = payload.state.memberClasses || [];
      DB.memberDebt = payload.state.memberDebt || [];
      DB.promoteTiers = payload.state.promoteTiers || [];
      DB.sec704cLayers = payload.state.sec704cLayers || [];
      DB.blockers = payload.state.blockers || [];
      DB.investorProfiles = payload.state.investorProfiles || {};
      DB.signatories = payload.state.signatories || [];
      DB.investors = payload.state.investors || [];
      DB.nextMemberId = payload.state.nextMemberId || DB.memberClasses.length + 1;
      DB.nextDebtId = payload.state.nextDebtId || DB.memberDebt.length + 1;
      DB.nextTierId = payload.state.nextTierId || DB.promoteTiers.length + 1;
      DB.nextLayerId = payload.state.nextLayerId || DB.sec704cLayers.length + 1;
      DB.nextBlockerId = payload.state.nextBlockerId || DB.blockers.length + 1;
      DB.nextSignatoryId = payload.state.nextSignatoryId || DB.signatories.length + 1;
      DB.nextInvestorId = payload.state.nextInvestorId || DB.investors.length + 1;
      if (payload.state.orgChart) {
        DB.orgChart.positionOverrides = payload.state.orgChart.positionOverrides || {};
        const customNodes = payload.state.orgChart.customNodes || [];
        const customEdges = payload.state.orgChart.customEdges || [];
        DB.orgChart.nodes = customNodes;
        DB.orgChart.edges = customEdges;
      }

      const setAll = (obj) => {
        if (!obj) return;
        for (const [id, val] of Object.entries(obj)) {
          if (id === 'checkboxes' || id === 'droClasses') continue;
          if (id === 'dp_sponsor_individual') {
            const el = document.getElementById(id);
            if (el) el.checked = !!val;
            continue;
          }
          if (id === 'sec_level') {
            const el = document.querySelector(`input[name="sec_level"][value="${val}"]`);
            if (el) el.checked = true;
            continue;
          }
          const el = document.getElementById(id);
          if (el) el.value = val;
        }
        if (obj.checkboxes) {
          for (const [id, val] of Object.entries(obj.checkboxes)) {
            const el = document.getElementById(id);
            if (el) el.checked = val;
          }
        }
      };

      setAll(payload.formInputs);
      setAll(payload.allocationInputs);
      setAll(payload.phase3Inputs);
      setAll(payload.phase4Inputs);
      setAll(payload.phase6Inputs);
      setAll(payload.phase7Inputs);

      renderMemberClasses();
      renderMemberDebt();
      renderPromoteTiers();
      renderSec704cLayers();
      renderInvestorProfiles();
      renderBlockers();
      renderStateSummary();
      renderSignatories();
      renderInvestors();
      updateInvestorSummary();
      updateComplianceModuleVisibility();
      document.getElementById('deal_type_help').innerHTML = DEAL_TYPES[document.getElementById('deal_type').value]?.help || '';
      document.getElementById('jurisdiction_help').innerHTML = JURISDICTION_HELP[document.getElementById('jurisdiction').value] || '';
      document.getElementById('senior_752_help').innerHTML = SEC752_HELP[document.getElementById('senior_752_class').value] || '';
      document.getElementById('alloc_704b_help').innerHTML = SEC704B_HELP[document.getElementById('alloc_704b_method').value] || '';
      const cbType = document.getElementById('clawback_type').value;
      document.getElementById('clawback_threshold_group').style.display = cbType !== 'none' ? 'grid' : 'none';
      document.getElementById('sec704c_layers_wrap').style.display = document.getElementById('alloc_704c_present').value === 'yes' ? 'block' : 'none';
      document.getElementById('dro_group').style.display = document.getElementById('alloc_704b_method').value === 'see_dro' ? 'block' : 'none';
      document.getElementById('cost_seg_alloc_group').style.display = document.getElementById('alloc_cost_seg_pickup').checked ? 'grid' : 'none';
      ['163j','461l','199a'].forEach(k => {
        const cb = document.getElementById('overlay_' + k);
        const detail = document.getElementById('overlay_' + k + '_detail');
        if (cb && detail) detail.style.display = cb.checked ? 'block' : 'none';
      });
      // Sponsor individual section visibility
      const sponsorIndCb = document.getElementById('dp_sponsor_individual');
      const sponsorSection = document.getElementById('dp_sponsor_entity_section');
      if (sponsorIndCb && sponsorSection) sponsorSection.style.display = sponsorIndCb.checked ? 'none' : 'block';

      recomputeAll();
      alert(`Deal loaded: ${payload.formInputs?.project_name || 'unnamed'} (version: ${payload.version}, saved ${payload.savedAt})`);
    } catch (err) {
      alert('Error loading file: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
};

document.addEventListener('DOMContentLoaded', () => {
  const loadInput = document.getElementById('load_json_input');
  if (loadInput) {
    const newInput = loadInput.cloneNode(true);
    loadInput.parentNode.replaceChild(newInput, loadInput);
    newInput.addEventListener('change', loadJSON);
  }
});



// =============================================================================
// =============================================================================
//             PHASE 8 — STATE LAW ENGINE + MULTI-TIER ENTITY STRUCTURE
//
//   State-specific statutory references and provisions for 8 formation states:
//   DE, FL, WY, NV, TX, CA, NY, MA
//
//   Full multi-tier entity tree: Issuer, Holdco, Sponsor, Trust, Blocker, Feeder
//   Per-entity Operating Agreement generation
//   Integration with Phase 3 blocker recommendations
// =============================================================================
// =============================================================================

// =============================================================================
// STATE LAW DATA
// Eight formation states. For each: statute citations, charging order rules,
// series LLC availability, fiduciary duty waivability, publication requirements,
// default management, and notable features that affect drafting.
// =============================================================================
const STATE_LAW_DATA = {
  DE: {
    name: 'Delaware',
    llcAct: {
      shortName: 'Delaware Limited Liability Company Act',
      definedTerm: 'Delaware Limited Liability Company Act',
      citation: '6 Del. C. §§ 18-101 et seq.',
      formationDoc: 'Certificate of Formation',
      formationDocCitation: '6 Del. C. § 18-201',
      filingOffice: 'Delaware Division of Corporations'
    },
    lpAct: {
      shortName: 'Delaware Revised Uniform Limited Partnership Act',
      definedTerm: 'Delaware Revised Uniform Limited Partnership Act',
      citation: '6 Del. C. §§ 17-101 et seq.',
      formationDoc: 'Certificate of Limited Partnership',
      filingOffice: 'Delaware Division of Corporations'
    },
    chargingOrder: {
      exclusive: true,
      citation: '6 Del. C. § 18-703',
      foreclosurePermitted: false,
      provision: 'On application to a court of competent jurisdiction by a judgment creditor of a member, the court may charge the membership interest of the member with payment of the unsatisfied amount of the judgment. To the extent so charged, the judgment creditor has only the rights of an assignee of the membership interest. The charging order constitutes the exclusive remedy by which a judgment creditor may satisfy a judgment from a member\u2019s interest in the Company. No foreclosure of the membership interest is permitted.'
    },
    seriesLLC: { available: true, citation: '6 Del. C. § 18-215', note: 'Series LLC structure permitted; assets and obligations of each series may be segregated if requirements met.' },
    fiduciaryDuties: {
      waivability: 'broad',
      citation: '6 Del. C. § 18-1101(c)',
      provision: 'To the extent permitted by 6 Del. C. § 18-1101(c), the duties (including fiduciary duties) of the Manager and any other person to the Company or to any Member or other person bound by the Agreement may be expanded, restricted, or eliminated by the express provisions of this Agreement; provided, however, that the implied contractual covenant of good faith and fair dealing may not be eliminated. The Members acknowledge and agree to such modification.'
    },
    publication: { required: false },
    defaultMgmt: 'member-managed',
    defaultMgmtNote: 'Default under § 18-402 is member management unless the LLC agreement provides for manager management.',
    annualFees: { type: 'flat franchise tax', amount: 300, dueDate: 'June 1', citation: '6 Del. C. § 18-1107' },
    incTax: { entityLevel: false, note: 'Delaware does not impose entity-level income tax on LLCs taxed as partnerships.' },
    notableFeatures: [
      'Contractual freedom doctrine — broad ability to waive default rules',
      'Sophisticated Court of Chancery for governance disputes',
      'No state income tax on out-of-state-source income of out-of-state LLCs',
      'Most widely used formation state for sophisticated deals',
      'Robust Series LLC framework under § 18-215'
    ],
    dissolutionEvents: 'Dissolution per § 18-801: occurrence of an event specified in the LLC agreement; written consent of all members; (judicial dissolution under § 18-802) determination that it is no longer reasonably practicable to carry on the business.'
  },
  FL: {
    name: 'Florida',
    llcAct: {
      shortName: 'Florida Revised Limited Liability Company Act',
      definedTerm: 'Florida Revised Limited Liability Company Act',
      citation: 'Fla. Stat. ch. 605 (2014)',
      formationDoc: 'Articles of Organization',
      formationDocCitation: 'Fla. Stat. § 605.0201',
      filingOffice: 'Florida Department of State, Division of Corporations'
    },
    lpAct: {
      shortName: 'Florida Revised Uniform Limited Partnership Act',
      citation: 'Fla. Stat. ch. 620',
      formationDoc: 'Certificate of Limited Partnership',
      filingOffice: 'Florida Department of State, Division of Corporations'
    },
    chargingOrder: {
      exclusive: 'multi-member only',
      citation: 'Fla. Stat. § 605.0503',
      foreclosurePermitted: 'single-member only',
      provision: 'A charging order pursuant to Fla. Stat. § 605.0503 is the sole and exclusive remedy by which a judgment creditor of a Member or transferee may satisfy a judgment from a Member\u2019s transferable interest in a multi-member limited liability company. The Olmstead carve-out under Fla. Stat. § 605.0503(4) permits foreclosure of the membership interest only if the Company has a single member. Members are advised that the addition of substantive economic interests of other members preserves charging-order-only protection.'
    },
    seriesLLC: { available: 'recent', citation: 'Fla. Stat. § 605.0902 (effective 2024)', note: 'Series LLC permitted in Florida effective 2024 under the protected series provisions; however, the doctrine is recent and untested in Florida courts.' },
    fiduciaryDuties: {
      waivability: 'partial',
      citation: 'Fla. Stat. § 605.0105(3)',
      provision: 'Subject to the express limitations of Fla. Stat. § 605.0105(3), this Agreement may eliminate or alter the standards of liability and the duty of loyalty of the Manager (other than the implied contractual obligation of good faith and fair dealing); however, the Agreement may not authorize or require knowingly violative conduct.'
    },
    publication: { required: false },
    defaultMgmt: 'member-managed',
    defaultMgmtNote: 'Default under § 605.0407 is member management unless the Articles of Organization or this Agreement provide otherwise.',
    annualFees: { type: 'annual report fee', amount: 138.75, dueDate: 'May 1', citation: 'Fla. Stat. § 605.0212' },
    incTax: { entityLevel: false, note: 'Florida does not impose state income tax on individuals; LLCs taxed as partnerships are pass-through. C-corp LLCs subject to 5.5% Florida corporate income tax.' },
    notableFeatures: [
      'No state income tax on individuals',
      'Florida doc stamp tax on real property transfers (0.7% deeds + 0.35% mortgages)',
      'Charging order is exclusive remedy for multi-member LLCs only',
      'Series LLC framework recently enacted (2024); untested',
      'Homestead protections under Florida Constitution Art. X, § 4'
    ],
    dissolutionEvents: 'Dissolution per Fla. Stat. § 605.0701: occurrence of an event specified in this Agreement; consent of all members; judicial dissolution under § 605.0702; or administrative dissolution for failure to file annual report.'
  },
  WY: {
    name: 'Wyoming',
    llcAct: {
      shortName: 'Wyoming Limited Liability Company Act',
      definedTerm: 'Wyoming Limited Liability Company Act',
      citation: 'W.S. §§ 17-29-101 et seq.',
      formationDoc: 'Articles of Organization',
      formationDocCitation: 'W.S. § 17-29-201',
      filingOffice: 'Wyoming Secretary of State'
    },
    lpAct: {
      shortName: 'Wyoming Uniform Limited Partnership Act',
      citation: 'W.S. §§ 17-14-201 et seq.',
      formationDoc: 'Certificate of Limited Partnership',
      filingOffice: 'Wyoming Secretary of State'
    },
    chargingOrder: {
      exclusive: true,
      citation: 'W.S. § 17-29-503',
      foreclosurePermitted: false,
      provision: 'On application by a judgment creditor of a Member, the court may charge the transferable interest of the Member with payment of the unsatisfied amount of the judgment with interest. To the extent so charged, the judgment creditor has only the rights of a transferee of the transferable interest. The charging order constitutes the exclusive remedy by which a judgment creditor may satisfy a judgment from the Member\u2019s interest, and no foreclosure of the membership interest is permitted under W.S. § 17-29-503(c).'
    },
    seriesLLC: { available: true, citation: 'W.S. § 17-29-211', note: 'Wyoming Series LLC permitted with strong asset segregation protections.' },
    fiduciaryDuties: {
      waivability: 'broad',
      citation: 'W.S. § 17-29-110',
      provision: 'This Agreement may eliminate or modify the duty of loyalty and the duty of care of the Manager and other persons to the Company or to any Member, subject only to the implied contractual covenant of good faith and fair dealing, as permitted by W.S. § 17-29-110(b).'
    },
    publication: { required: false },
    defaultMgmt: 'member-managed',
    defaultMgmtNote: 'Default management is by the members under W.S. § 17-29-407 unless this Agreement provides for manager management.',
    annualFees: { type: 'annual report license tax', amount: 60, dueDate: 'first day of anniversary month', citation: 'W.S. § 17-29-209', note: 'License tax is $60 minimum or $0.0002 per dollar of in-state assets, whichever is greater.' },
    incTax: { entityLevel: false, note: 'Wyoming has no state income tax (individuals or entities).' },
    notableFeatures: [
      'No state income tax (individuals or entities)',
      'Strong member anonymity: members not disclosed on Secretary of State filings',
      'Charging order is exclusive remedy with foreclosure expressly prohibited',
      'Robust Series LLC framework',
      'Favored for sponsor entities, holding companies, and asset-protection structures'
    ],
    dissolutionEvents: 'Dissolution per W.S. § 17-29-701: occurrence of an event specified in this Agreement; consent of all members; or judicial dissolution.'
  },
  NV: {
    name: 'Nevada',
    llcAct: {
      shortName: 'Nevada Limited Liability Companies Act',
      definedTerm: 'Nevada Limited Liability Companies Act',
      citation: 'NRS Chapter 86',
      formationDoc: 'Articles of Organization',
      formationDocCitation: 'NRS § 86.151',
      filingOffice: 'Nevada Secretary of State'
    },
    lpAct: {
      shortName: 'Nevada Revised Uniform Limited Partnership Act',
      citation: 'NRS Chapter 87A',
      formationDoc: 'Certificate of Limited Partnership',
      filingOffice: 'Nevada Secretary of State'
    },
    chargingOrder: {
      exclusive: true,
      citation: 'NRS § 86.401',
      foreclosurePermitted: false,
      provision: 'On application by a judgment creditor of a Member, the court may charge the membership interest of the Member with payment of the unsatisfied amount of the judgment. To the extent so charged, the judgment creditor has only the rights of an assignee of the membership interest. The charging order constitutes the exclusive remedy by which a judgment creditor may satisfy a judgment from the Member\u2019s interest under NRS § 86.401(2), and no foreclosure is permitted.'
    },
    seriesLLC: { available: true, citation: 'NRS § 86.296', note: 'Nevada Series LLC permitted with statutory asset segregation.' },
    fiduciaryDuties: {
      waivability: 'broad',
      citation: 'NRS § 86.286',
      provision: 'This Agreement may eliminate or modify the duties (including fiduciary duties) of the Manager and other persons to the Company or to any Member, except for the implied contractual covenant of good faith and fair dealing, as permitted by NRS § 86.286.'
    },
    publication: { required: false },
    defaultMgmt: 'member-managed',
    defaultMgmtNote: 'Default management is by members under NRS § 86.291 unless the Articles or this Agreement provide otherwise.',
    annualFees: { type: 'annual list + business license', amount: 350, dueDate: 'last day of anniversary month', citation: 'NRS §§ 86.263, 76.130', note: 'Annual list filing $150 + state business license $200 = $350.' },
    incTax: { entityLevel: false, note: 'Nevada has no state income tax (individuals or entities). Nevada Commerce Tax may apply above $4M Nevada gross revenue.' },
    notableFeatures: [
      'No state income tax (individuals or entities)',
      'Strong member anonymity',
      'Charging order exclusive remedy',
      'Series LLC available',
      'Annual fees higher than Wyoming (~$350 vs $60)',
      'Nevada Commerce Tax applies to certain large in-state operations'
    ],
    dissolutionEvents: 'Dissolution per NRS § 86.491: occurrence of an event specified in this Agreement; consent of all members; or judicial dissolution.'
  },
  TX: {
    name: 'Texas',
    llcAct: {
      shortName: 'Texas Business Organizations Code (LLC provisions)',
      definedTerm: 'Texas Business Organizations Code',
      citation: 'Tex. Bus. Orgs. Code ch. 101',
      formationDoc: 'Certificate of Formation',
      formationDocCitation: 'Tex. Bus. Orgs. Code § 3.005',
      filingOffice: 'Texas Secretary of State'
    },
    lpAct: {
      shortName: 'Texas Business Organizations Code (LP provisions)',
      citation: 'Tex. Bus. Orgs. Code ch. 153',
      formationDoc: 'Certificate of Formation',
      filingOffice: 'Texas Secretary of State'
    },
    chargingOrder: {
      exclusive: true,
      citation: 'Tex. Bus. Orgs. Code § 101.112',
      foreclosurePermitted: false,
      provision: 'On application by a judgment creditor of a Member, the court may charge the Member\u2019s membership interest with payment of the unsatisfied amount of the judgment. To the extent so charged, the judgment creditor has only the rights of an assignee. The charging order is the exclusive remedy by which a judgment creditor may satisfy a judgment from a Member\u2019s interest under Tex. Bus. Orgs. Code § 101.112(d), and no foreclosure is permitted.'
    },
    seriesLLC: { available: true, citation: 'Tex. Bus. Orgs. Code §§ 101.601 - 101.622', note: 'Texas Series LLC permitted with statutory asset segregation.' },
    fiduciaryDuties: {
      waivability: 'broad',
      citation: 'Tex. Bus. Orgs. Code § 101.401',
      provision: 'The duties of the Manager (including fiduciary duties) may be expanded, restricted, or eliminated by this Agreement to the extent permitted by Tex. Bus. Orgs. Code § 101.401, except for the implied contractual covenant of good faith and fair dealing.'
    },
    publication: { required: false },
    defaultMgmt: 'member-managed',
    defaultMgmtNote: 'Default under § 101.251 is member management.',
    annualFees: { type: 'franchise tax', amount: 'revenue-based', dueDate: 'May 15', citation: 'Tex. Tax Code ch. 171', note: 'Franchise tax applies above the no-tax-due threshold (approx. $2.47M in revenue for 2024); rate 0.375%-0.75%.' },
    incTax: { entityLevel: false, note: 'Texas has no personal income tax. Entities subject to Texas franchise tax above threshold.' },
    notableFeatures: [
      'No personal income tax',
      'Franchise tax applies to entities (revenue-based)',
      'Public Information Report required annually',
      'Charging order exclusive remedy',
      'Series LLC available'
    ],
    dissolutionEvents: 'Dissolution per Tex. Bus. Orgs. Code § 11.051: occurrence of an event specified in this Agreement; consent of members; or judicial dissolution.'
  },
  CA: {
    name: 'California',
    llcAct: {
      shortName: 'California Revised Uniform Limited Liability Company Act',
      definedTerm: 'California Revised Uniform Limited Liability Company Act',
      citation: 'Cal. Corp. Code §§ 17701.01 et seq.',
      formationDoc: 'Articles of Organization',
      formationDocCitation: 'Cal. Corp. Code § 17702.01',
      filingOffice: 'California Secretary of State'
    },
    lpAct: {
      shortName: 'California Uniform Limited Partnership Act',
      citation: 'Cal. Corp. Code §§ 15900 et seq.',
      formationDoc: 'Certificate of Limited Partnership',
      filingOffice: 'California Secretary of State'
    },
    chargingOrder: {
      exclusive: false,
      citation: 'Cal. Corp. Code § 17705.03',
      foreclosurePermitted: true,
      provision: 'Pursuant to Cal. Corp. Code § 17705.03, a judgment creditor of a Member or transferee may apply for and obtain a charging order against the transferable interest of the Member. The court may, upon a showing that the distributions under the charging order will not pay the judgment within a reasonable time, order foreclosure of the membership interest. Foreclosure of a membership interest is permitted in California, and members should not assume charging-order-exclusive protection.'
    },
    seriesLLC: { available: false, note: 'California does not authorize Series LLCs. Foreign series LLCs may be qualified as foreign entities but each series may be required to register separately.' },
    fiduciaryDuties: {
      waivability: 'limited',
      citation: 'Cal. Corp. Code § 17704.09',
      provision: 'The Manager owes the Company and its Members the fiduciary duties of loyalty and care. This Agreement may modify, but not eliminate, those duties to the extent permitted by Cal. Corp. Code § 17704.09. California restricts the scope of permissible waivers more than Delaware, Nevada, or Wyoming.'
    },
    publication: { required: false },
    defaultMgmt: 'member-managed',
    defaultMgmtNote: 'Default is member management under § 17704.07 unless the Articles or this Agreement provide for manager management.',
    annualFees: { type: 'annual minimum franchise tax + gross receipts fee', amount: 800, dueDate: '15th day of 4th month after FY end', citation: 'Cal. Rev. & Tax. Code § 17941, § 17942', note: 'Annual minimum tax $800 + additional fee on gross receipts schedule ($900-$11,790).' },
    incTax: { entityLevel: 'minimum tax + fee', note: 'California imposes $800 minimum franchise tax on all LLCs registered or doing business in California, plus a gross-receipts-based fee. LLCs taxed as partnerships are pass-through but entity-level tax still applies.' },
    notableFeatures: [
      'High state income tax (up to 13.3% individual + 1% mental health surtax on income above $1M)',
      'Annual minimum franchise tax $800 plus gross receipts fee',
      'No Series LLC',
      'Charging order with foreclosure permitted',
      'Limited fiduciary duty waivability',
      'Doing business in CA triggers tax even for foreign LLCs'
    ],
    dissolutionEvents: 'Dissolution per Cal. Corp. Code § 17707.01: vote of majority of members; occurrence of dissolution event specified in this Agreement; or judicial dissolution.'
  },
  NY: {
    name: 'New York',
    llcAct: {
      shortName: 'New York Limited Liability Company Law',
      definedTerm: 'New York Limited Liability Company Law',
      citation: 'N.Y. LLC Law §§ 101 et seq.',
      formationDoc: 'Articles of Organization',
      formationDocCitation: 'N.Y. LLC Law § 203',
      filingOffice: 'New York Department of State, Division of Corporations'
    },
    lpAct: {
      shortName: 'New York Revised Limited Partnership Act',
      citation: 'N.Y. Partnership Law §§ 121-101 et seq.',
      formationDoc: 'Certificate of Limited Partnership',
      filingOffice: 'New York Department of State'
    },
    chargingOrder: {
      exclusive: false,
      citation: 'N.Y. LLC Law § 607',
      foreclosurePermitted: true,
      provision: 'Pursuant to N.Y. LLC Law § 607, a judgment creditor of a Member may obtain a charging order against the membership interest. The statute does not designate the charging order as the exclusive remedy, and New York courts have permitted foreclosure of membership interests in appropriate circumstances. Members should not assume charging-order-exclusive protection in New York.'
    },
    seriesLLC: { available: false, note: 'New York does not authorize Series LLCs.' },
    fiduciaryDuties: {
      waivability: 'limited',
      citation: 'N.Y. LLC Law § 409',
      provision: 'The Manager owes the Company and its Members the duty to act in good faith and with the degree of care of an ordinarily prudent person. This Agreement may modify these duties to the extent permitted by N.Y. LLC Law § 409; however, the duty of loyalty and the duty of good faith may not be eliminated.'
    },
    publication: {
      required: true,
      citation: 'N.Y. LLC Law § 206',
      provision: 'Within 120 days of formation, the Company must publish notice of formation in two newspapers (one daily, one weekly) designated by the county clerk of the county in which the Company\u2019s office is located, for six consecutive weeks, and file a Certificate of Publication with the Department of State. Failure to comply suspends the Company\u2019s authority to do business in New York. Publication costs typically $1,000-$2,000 in New York County and less in other counties.'
    },
    defaultMgmt: 'member-managed',
    defaultMgmtNote: 'Default management is by members under § 401 unless the Articles or this Agreement provide for manager management.',
    annualFees: { type: 'biennial statement + filing fee on income', amount: 'income-based', dueDate: 'biennial', citation: 'N.Y. LLC Law § 301, § 658', note: 'Biennial Statement filing fee $9; annual filing fee for LLCs taxed as partnerships based on NY-source gross income ($25 - $4,500).' },
    incTax: { entityLevel: 'filing fee', note: 'New York imposes annual filing fee on LLCs taxed as partnerships ($25-$4,500) plus individual state income tax on members\u2019 distributive shares.' },
    notableFeatures: [
      'Publication requirement under § 206 (cost $1,000-$2,000+)',
      'High state income tax (up to 10.9% individual)',
      'No Series LLC',
      'Charging order with foreclosure permitted',
      'Filing fee on LLCs based on gross income',
      'Biennial Statement filing required'
    ],
    dissolutionEvents: 'Dissolution per N.Y. LLC Law § 701: occurrence of an event specified in this Agreement; consent of majority members; or judicial dissolution.'
  },
  MA: {
    name: 'Massachusetts',
    llcAct: {
      shortName: 'Massachusetts Limited Liability Company Act',
      definedTerm: 'Massachusetts Limited Liability Company Act',
      citation: 'M.G.L. ch. 156C',
      formationDoc: 'Certificate of Organization',
      formationDocCitation: 'M.G.L. ch. 156C § 12',
      filingOffice: 'Massachusetts Secretary of the Commonwealth, Corporations Division'
    },
    lpAct: {
      shortName: 'Massachusetts Revised Uniform Limited Partnership Act',
      citation: 'M.G.L. ch. 109',
      formationDoc: 'Certificate of Limited Partnership',
      filingOffice: 'Massachusetts Secretary of the Commonwealth'
    },
    chargingOrder: {
      exclusive: false,
      citation: 'M.G.L. ch. 156C § 39',
      foreclosurePermitted: true,
      provision: 'Pursuant to M.G.L. ch. 156C § 39, a court may charge a Member\u2019s interest with payment of an unsatisfied judgment. The statute does not designate the charging order as the exclusive remedy, and Massachusetts courts have permitted foreclosure in appropriate cases. Members should not assume charging-order-exclusive protection.'
    },
    seriesLLC: { available: false, note: 'Massachusetts does not authorize Series LLCs.' },
    fiduciaryDuties: {
      waivability: 'limited',
      citation: 'M.G.L. ch. 156C § 11',
      provision: 'The Manager owes the Company and its Members duties of loyalty and care. This Agreement may modify the duty of care but the duty of loyalty (avoidance of self-dealing, usurpation of opportunity, and conflict of interest) is not fully waivable under Massachusetts law.'
    },
    publication: { required: false },
    defaultMgmt: 'member-managed',
    defaultMgmtNote: 'Massachusetts default management is by members unless the Certificate or this Agreement designates managers.',
    annualFees: { type: 'annual report fee', amount: 500, dueDate: 'anniversary of formation', citation: 'M.G.L. ch. 156C § 12', note: 'Annual report fee $500 for LLCs.' },
    incTax: { entityLevel: false, note: 'Massachusetts does not impose entity-level income tax on LLCs taxed as partnerships. 5% state individual income tax + 4% surtax on income above $1M (effective 2023).' },
    notableFeatures: [
      'State income tax 5% + 4% surtax above $1M (Massachusetts Millionaires Tax)',
      'No Series LLC',
      'Charging order with foreclosure permitted',
      'Higher annual fees than Delaware/Wyoming ($500 vs $60-300)',
      'Older statute, fewer modern provisions than DE/WY/NV'
    ],
    dissolutionEvents: 'Dissolution per M.G.L. ch. 156C § 43: occurrence of an event specified in this Agreement; consent of members; or judicial dissolution.'
  }
};

// =============================================================================
// ENTITY ROLES
// =============================================================================
const ENTITY_ROLES = {
  issuer: { label: 'Issuer (Securities Offering Entity)', description: 'The entity that offers and issues securities to investors. Receives subscription agreements. Typically the SPV that owns or controls the deal asset. Exactly one entity must be designated as Issuer.' },
  property_opco: { label: 'Property Opco (Operating Company)', description: 'The entity that holds direct legal title to and operates the real property. Often the same as Issuer in single-tier deals; in multi-tier structures, owned by the Issuer or Holdco.' },
  holdco: { label: 'Holdco (Holding Company)', description: 'An upstream entity that holds all or substantially all of the interests in one or more operating entities. Often Delaware for governance benefits even when assets are in another state.' },
  sponsor: { label: 'Sponsor / Manager Entity', description: 'The management entity that controls the Issuer or Holdco. Frequently formed in Wyoming, Nevada, or Delaware for asset-protection or anonymity benefits.' },
  trust: { label: 'Trust', description: 'A trust (revocable or irrevocable) that holds an interest in the structure for estate-planning or asset-protection purposes. Common above the sponsor entity.' },
  blocker: { label: 'Blocker Entity', description: 'A C-corporation (domestic or foreign) interposed between the operating entity and a tax-sensitive investor (foreign person, tax-exempt organization). See Phase 3 blocker analysis.' },
  feeder: { label: 'Feeder Fund', description: 'A pooled investment vehicle (often Cayman or Delaware) that aggregates investments from a class of investors (often foreign or tax-exempt) and invests through the master structure.' },
  custodian: { label: 'IRA Custodian / SDIRA Vehicle', description: 'A self-directed IRA custodian holding an interest on behalf of an underlying IRA owner. Subject to UBIT/UBTI considerations.' },
  other: { label: 'Other Entity', description: 'Any other entity in the structure (subsidiary, parallel entity, etc.).' }
};

// =============================================================================
// DB ENTITY MODEL EXTENSION
// =============================================================================
DB.entities = [];
DB.nextEntityId = 1;



// =============================================================================
// PHASE 8: ENTITY CRUD HELPERS
// =============================================================================
function makeNewEntity(role = 'issuer') {
  const isIssuer = role === 'issuer';
  return {
    id: DB.nextEntityId++,
    name: '',
    type: 'LLC',
    state: 'FL',
    role: role,
    parentId: null,
    formationDate: '',
    address: '',
    ein: '',
    securities: isIssuer ? 'Membership Interests' : '',
    isIssuer: isIssuer,
    generateOpAg: role === 'issuer' || role === 'holdco' || role === 'property_opco'
  };
}

function getIssuerEntity() {
  return DB.entities.find(e => e.isIssuer) || DB.entities[0] || null;
}

function getEntityById(id) {
  return DB.entities.find(e => e.id === id);
}

function getEntityChildren(parentId) {
  return DB.entities.filter(e => e.parentId === parentId);
}

function getRootEntities() {
  return DB.entities.filter(e => !e.parentId);
}

// Backward compatibility: derive Phase 7 issuer/sponsor from new entity model
function deriveLegacyIssuerSponsor() {
  const issuer = getIssuerEntity();
  const sponsor = DB.entities.find(e => e.role === 'sponsor');
  if (issuer) {
    document.getElementById('dp_issuer_name').value = issuer.name;
    document.getElementById('dp_issuer_type').value = issuer.type;
    document.getElementById('dp_issuer_formation_state').value = issuer.state;
    document.getElementById('dp_issuer_formation_date').value = issuer.formationDate;
    document.getElementById('dp_issuer_address').value = issuer.address;
    document.getElementById('dp_issuer_ein').value = issuer.ein;
    document.getElementById('dp_issuer_securities').value = issuer.securities || 'Membership Interests';
  }
  if (sponsor) {
    document.getElementById('dp_sponsor_individual').checked = false;
    document.getElementById('dp_sponsor_name').value = sponsor.name;
    document.getElementById('dp_sponsor_type').value = sponsor.type;
    document.getElementById('dp_sponsor_formation_state').value = sponsor.state;
    document.getElementById('dp_sponsor_address').value = sponsor.address;
  } else {
    document.getElementById('dp_sponsor_individual').checked = true;
  }
}

// =============================================================================
// PHASE 8: INITIALIZE ENTITIES
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  if (DB.entities.length === 0) {
    // Seed with one Issuer entity
    DB.entities.push(makeNewEntity('issuer'));
  }
  renderEntities();
  renderEntityTreePreview();
  // Re-render signatories with new entity-aware UI
  if (typeof renderSignatories === 'function') renderSignatories();

  const addEntBtn = document.getElementById('add_entity');
  if (addEntBtn) {
    addEntBtn.addEventListener('click', () => {
      // Default new entity role based on what's already there
      const existingRoles = DB.entities.map(e => e.role);
      let nextRole = 'sponsor';
      if (!existingRoles.includes('sponsor')) nextRole = 'sponsor';
      else if (!existingRoles.includes('holdco')) nextRole = 'holdco';
      else if (!existingRoles.includes('trust')) nextRole = 'trust';
      else nextRole = 'other';
      DB.entities.push(makeNewEntity(nextRole));
      // New entity is not the issuer
      DB.entities[DB.entities.length - 1].isIssuer = false;
      renderEntities();
      renderEntityTreePreview();
      renderSignatories();
      deriveLegacyIssuerSponsor();
    });
  }
});

// =============================================================================
// PHASE 8: RENDER ENTITIES
// =============================================================================
function renderEntities() {
  const container = document.getElementById('entities_container');
  if (!container) return;
  container.innerHTML = '';

  const roleOpts = Object.entries(ENTITY_ROLES).map(([k, v]) =>
    `<option value="${k}">${escapeHtml(v.label)}</option>`).join('');
  const typeOpts = ['LLC', 'LP', 'Series LLC', 'C-Corp', 'S-Corp', 'Statutory Trust', 'Trust (non-statutory)', 'Foreign Entity']
    .map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
  const stateOpts = Object.entries(STATE_LAW_DATA)
    .map(([abbr, sl]) => `<option value="${abbr}">${escapeHtml(sl.name)} (${abbr})</option>`)
    .concat(['<option value="other">Other (not in state law engine)</option>'])
    .join('');

  DB.entities.forEach((entity, idx) => {
    const card = document.createElement('div');
    const roleKey = entity.role || 'other';
    card.className = `entity-card is-${roleKey}${entity.isIssuer ? ' is-issuer' : ''}`;

    const parentOpts = `<option value="">— Top of structure —</option>` +
      DB.entities.filter(e => e.id !== entity.id).map(e =>
        `<option value="${e.id}">${escapeHtml(e.name || `Entity ${e.id}`)}</option>`).join('');

    const stateLaw = STATE_LAW_DATA[entity.state];

    card.innerHTML = `
      <div class="ent-header">
        <span class="ent-badge bg-${roleKey}">${escapeHtml(ENTITY_ROLES[roleKey]?.label || 'Entity')}${entity.isIssuer ? ' · ISSUER' : ''}</span>
        <button class="mc-remove" type="button" data-id="${entity.id}">Remove</button>
      </div>
      <div class="ent-fields-row1">
        <div class="mc-field-mini">
          <label>Legal Name</label>
          <input type="text" class="ent-name" data-id="${entity.id}" value="${escapeHtml(entity.name)}" placeholder="e.g., Project Holdings LLC" />
        </div>
        <div class="mc-field-mini">
          <label>Entity Type</label>
          <select class="ent-type" data-id="${entity.id}">${typeOpts}</select>
        </div>
        <div class="mc-field-mini">
          <label>State of Formation</label>
          <select class="ent-state" data-id="${entity.id}">${stateOpts}</select>
        </div>
        <div class="mc-field-mini">
          <label>Role</label>
          <select class="ent-role" data-id="${entity.id}">${roleOpts}</select>
        </div>
      </div>
      <div class="ent-fields-row2">
        <div class="mc-field-mini">
          <label>Principal Office Address</label>
          <input type="text" class="ent-address" data-id="${entity.id}" value="${escapeHtml(entity.address)}" placeholder="Street, City, State ZIP" />
        </div>
        <div class="mc-field-mini">
          <label>Formation Date</label>
          <input type="text" class="ent-fdate" data-id="${entity.id}" value="${escapeHtml(entity.formationDate)}" placeholder="e.g., May 2026" />
        </div>
        <div class="mc-field-mini">
          <label>EIN</label>
          <input type="text" class="ent-ein" data-id="${entity.id}" value="${escapeHtml(entity.ein)}" placeholder="XX-XXXXXXX" />
        </div>
        <div class="mc-field-mini">
          <label>Parent Entity</label>
          <select class="ent-parent" data-id="${entity.id}">${parentOpts}</select>
        </div>
      </div>
      <div class="ent-fields-row3">
        <div class="mc-field-mini">
          <label>Authorized Securities (Issuer only)</label>
          <input type="text" class="ent-securities" data-id="${entity.id}" value="${escapeHtml(entity.securities)}" placeholder="e.g., Membership Interests" ${entity.isIssuer ? '' : 'disabled'} />
        </div>
        <div class="mc-field-mini">
          <label>Generate Op Ag / LPA</label>
          <select class="ent-genopag" data-id="${entity.id}">
            <option value="yes">Yes &mdash; generate</option>
            <option value="no">No</option>
          </select>
        </div>
        <div class="mc-field-mini" style="display:flex;align-items:flex-end;">
          <label class="db-checkbox" style="margin:0;">
            <input type="checkbox" class="ent-isissuer" data-id="${entity.id}" ${entity.isIssuer ? 'checked' : ''} />
            <strong>This is the Issuer (receives subscriptions)</strong>
          </label>
        </div>
      </div>
      ${stateLaw ? `
        <div class="ent-statelaw-summary">
          <strong>${escapeHtml(stateLaw.name)} ${escapeHtml(entity.type)} provisions:</strong>
          Governed by ${escapeHtml(stateLaw.llcAct.definedTerm)}, ${escapeHtml(stateLaw.llcAct.citation)}.
          Formation document: ${escapeHtml(stateLaw.llcAct.formationDoc)}; filed with ${escapeHtml(stateLaw.llcAct.filingOffice)}.
          Charging order: ${stateLaw.chargingOrder.exclusive === true ? '<strong>exclusive remedy</strong>' : stateLaw.chargingOrder.exclusive === 'multi-member only' ? '<strong>exclusive for multi-member only</strong>' : 'not exclusive (foreclosure permitted)'}.
          Series LLC: ${stateLaw.seriesLLC.available === true ? 'available' : stateLaw.seriesLLC.available === 'recent' ? 'recently enacted' : 'not available'}.
          Publication: ${stateLaw.publication.required ? '<strong>required ($1-2K cost)</strong>' : 'not required'}.
          Fiduciary duty waivability: ${stateLaw.fiduciaryDuties.waivability}.
          Annual fees: ${typeof stateLaw.annualFees.amount === 'number' ? '$' + stateLaw.annualFees.amount : stateLaw.annualFees.amount}.
        </div>
      ` : '<div class="ent-statelaw-summary" style="background:rgba(212,160,23,0.06);border-left-color:#d4a017;"><strong>State not in engine.</strong> Document templates will use generic language. Phase 8 supports DE, FL, WY, NV, TX, CA, NY, MA.</div>'}
    `;
    container.appendChild(card);
    card.querySelector('.ent-type').value = entity.type;
    card.querySelector('.ent-state').value = entity.state;
    card.querySelector('.ent-role').value = entity.role;
    card.querySelector('.ent-parent').value = entity.parentId || '';
    card.querySelector('.ent-genopag').value = entity.generateOpAg ? 'yes' : 'no';
  });

  // Wire handlers
  container.querySelectorAll('input, select').forEach(el => {
    const updateFn = e => updateEntityField(e);
    el.addEventListener('change', updateFn);
    el.addEventListener('input', updateFn);
  });
  container.querySelectorAll('.mc-remove').forEach(b => {
    b.addEventListener('click', e => {
      const id = parseInt(e.target.dataset.id, 10);
      const wasIssuer = DB.entities.find(en => en.id === id)?.isIssuer;
      DB.entities = DB.entities.filter(en => en.id !== id);
      // If we removed the issuer, designate the first remaining as issuer
      if (wasIssuer && DB.entities.length > 0) DB.entities[0].isIssuer = true;
      // Clean up any signatory references and child entities pointing to removed parent
      for (const ent of DB.entities) {
        if (ent.parentId === id) ent.parentId = null;
      }
      for (const sig of DB.signatories) {
        if (sig.entityIds) sig.entityIds = sig.entityIds.filter(eid => eid !== id);
      }
      renderEntities();
      renderEntityTreePreview();
      renderSignatories();
      deriveLegacyIssuerSponsor();
    });
  });
}

function updateEntityField(e) {
  const id = parseInt(e.target.dataset.id, 10);
  const entity = DB.entities.find(en => en.id === id);
  if (!entity) return;
  const cls = e.target.className;

  if (cls.includes('ent-name')) entity.name = e.target.value;
  else if (cls.includes('ent-type')) entity.type = e.target.value;
  else if (cls.includes('ent-state')) entity.state = e.target.value;
  else if (cls.includes('ent-role')) entity.role = e.target.value;
  else if (cls.includes('ent-parent')) entity.parentId = e.target.value ? parseInt(e.target.value, 10) : null;
  else if (cls.includes('ent-address')) entity.address = e.target.value;
  else if (cls.includes('ent-fdate')) entity.formationDate = e.target.value;
  else if (cls.includes('ent-ein')) entity.ein = e.target.value;
  else if (cls.includes('ent-securities')) entity.securities = e.target.value;
  else if (cls.includes('ent-genopag')) entity.generateOpAg = e.target.value === 'yes';
  else if (cls.includes('ent-isissuer')) {
    if (e.target.checked) {
      // Only one issuer at a time
      for (const en of DB.entities) en.isIssuer = (en.id === id);
    } else {
      entity.isIssuer = false;
      // Ensure at least one issuer
      if (!DB.entities.some(en => en.isIssuer) && DB.entities.length > 0) {
        DB.entities[0].isIssuer = true;
      }
    }
    renderEntities();
    renderEntityTreePreview();
    renderSignatories();
    deriveLegacyIssuerSponsor();
    return;
  }
  // State or role changed — re-render to refresh state law summary
  if (cls.includes('ent-state') || cls.includes('ent-role') || cls.includes('ent-name')) {
    renderEntityTreePreview();
    renderEntities();  // refresh state law block
    renderSignatories();
  }
  deriveLegacyIssuerSponsor();
}

// =============================================================================
// PHASE 8: RENDER ENTITY TREE PREVIEW
// =============================================================================
function renderEntityTreePreview() {
  const target = document.getElementById('entity_tree_preview');
  if (!target) return;

  if (DB.entities.length === 0) {
    target.innerHTML = '<h4>Entity Structure Preview</h4><p style="font-style:italic;color:#6b6b6b;margin:0;">No entities defined yet.</p>';
    return;
  }

  // Build tree by recursively walking children of root entities
  const renderNode = (entity, depth) => {
    const indent = '&nbsp;'.repeat(depth * 4);
    const arrow = depth > 0 ? '└─ ' : '';
    const stateName = STATE_LAW_DATA[entity.state]?.name || entity.state;
    let html = `<div class="entity-tree-node role-${entity.role}" style="margin-left:${depth * 1.5}rem;">
      <span class="ent-tree-name">${indent}${arrow}${escapeHtml(entity.name || `(Entity ${entity.id})`)}</span>
      <span class="ent-tree-meta"> · ${escapeHtml(entity.type)} · ${escapeHtml(stateName)} · ${escapeHtml(ENTITY_ROLES[entity.role]?.label || entity.role)}</span>
      ${entity.isIssuer ? '<span class="ent-tree-issuer-flag">Issuer</span>' : ''}
    </div>`;
    // Render children
    for (const child of getEntityChildren(entity.id)) {
      html += renderNode(child, depth + 1);
    }
    return html;
  };

  let html = '<h4>Entity Structure Preview</h4>';
  for (const root of getRootEntities()) {
    html += renderNode(root, 0);
  }

  // Validation badges
  const issuerCount = DB.entities.filter(e => e.isIssuer).length;
  if (issuerCount !== 1) {
    html += `<p style="margin-top:0.85rem;color:#B01F24;font-weight:700;">⚠ Exactly one entity must be designated as the Issuer (currently ${issuerCount}).</p>`;
  }

  target.innerHTML = html;
}

// =============================================================================
// PHASE 8: UPDATE SIGNATORY MODEL — multi-entity assignment
// =============================================================================
function renderSignatories() {
  const container = document.getElementById('signatories_container');
  if (!container) return;
  container.innerHTML = '';

  const capacityOpts = Object.entries(SIGNING_CAPACITY).map(([k, v]) =>
    `<option value="${k}">${v}</option>`).join('');

  for (const sig of DB.signatories) {
    // Migrate from old entity field if needed
    if (!sig.entityIds) {
      sig.entityIds = [];
      const issuer = getIssuerEntity();
      const sponsor = DB.entities.find(e => e.role === 'sponsor');
      if (sig.entity === 'issuer' && issuer) sig.entityIds = [issuer.id];
      else if (sig.entity === 'sponsor' && sponsor) sig.entityIds = [sponsor.id];
      else if (sig.entity === 'both' && issuer && sponsor) sig.entityIds = [issuer.id, sponsor.id];
      else if (issuer) sig.entityIds = [issuer.id];
    }

    const entityCheckboxes = DB.entities.map(e =>
      `<label style="display:inline-flex;align-items:center;gap:0.3rem;margin-right:0.85rem;font-size:0.85rem;">
        <input type="checkbox" class="sig-entity-cb" data-sigid="${sig.id}" data-entid="${e.id}" ${sig.entityIds.includes(e.id) ? 'checked' : ''} />
        ${escapeHtml(e.name || `Entity ${e.id}`)} <span style="color:#6b6b6b;">(${escapeHtml(ENTITY_ROLES[e.role]?.label.split(' ')[0] || e.role)})</span>
      </label>`).join('');

    const card = document.createElement('div');
    card.className = 'signatory-card';
    card.innerHTML = `
      <div class="sig-header">
        <span class="sig-badge">Signatory</span>
        <button class="mc-remove" type="button" data-id="${sig.id}">Remove</button>
      </div>
      <div class="sig-fields">
        <div class="mc-field-mini">
          <label>Full Legal Name</label>
          <input type="text" class="sig-name" data-id="${sig.id}" value="${escapeHtml(sig.name)}" placeholder="e.g., Paul K. Donovan, Esq." />
        </div>
        <div class="mc-field-mini">
          <label>Title</label>
          <input type="text" class="sig-title" data-id="${sig.id}" value="${escapeHtml(sig.title)}" placeholder="e.g., Manager" />
        </div>
        <div class="mc-field-mini">
          <label>Signing Capacity</label>
          <select class="sig-capacity" data-id="${sig.id}">${capacityOpts}</select>
        </div>
        <div class="mc-field-mini">
          <label>Signs On Behalf Of (check all that apply)</label>
          <div style="padding-top:0.4rem;">${entityCheckboxes || '<em style="color:#6b6b6b;">No entities defined</em>'}</div>
        </div>
      </div>`;
    container.appendChild(card);
    card.querySelector('.sig-capacity').value = sig.capacity;
  }

  // Wire handlers
  container.querySelectorAll('.sig-name, .sig-title').forEach(el => {
    el.addEventListener('input', e => {
      const id = parseInt(e.target.dataset.id, 10);
      const sig = DB.signatories.find(s => s.id === id);
      if (!sig) return;
      if (e.target.classList.contains('sig-name')) sig.name = e.target.value;
      if (e.target.classList.contains('sig-title')) sig.title = e.target.value;
    });
  });
  container.querySelectorAll('.sig-capacity').forEach(el => {
    el.addEventListener('change', e => {
      const id = parseInt(e.target.dataset.id, 10);
      const sig = DB.signatories.find(s => s.id === id);
      if (sig) sig.capacity = e.target.value;
    });
  });
  container.querySelectorAll('.sig-entity-cb').forEach(cb => {
    cb.addEventListener('change', e => {
      const sigId = parseInt(e.target.dataset.sigid, 10);
      const entId = parseInt(e.target.dataset.entid, 10);
      const sig = DB.signatories.find(s => s.id === sigId);
      if (!sig) return;
      if (!sig.entityIds) sig.entityIds = [];
      if (e.target.checked && !sig.entityIds.includes(entId)) sig.entityIds.push(entId);
      else if (!e.target.checked) sig.entityIds = sig.entityIds.filter(id => id !== entId);
    });
  });
  container.querySelectorAll('.mc-remove').forEach(b => {
    b.addEventListener('click', e => {
      const id = parseInt(e.target.dataset.id, 10);
      DB.signatories = DB.signatories.filter(s => s.id !== id);
      renderSignatories();
    });
  });
}



// =============================================================================
// PHASE 8: REFACTORED COLLECT PHASE 7 DATA — multi-entity
// =============================================================================
const _phase7CollectPhase7Data = collectPhase7Data;
collectPhase7Data = function() {
  const v = id => { const el = document.getElementById(id); if (!el) return ''; return String(el.value).replace(/[$,\s%]/g, '').trim(); };
  const c = id => { const el = document.getElementById(id); return el ? el.checked : false; };

  const selectedLevel = document.querySelector('input[name="sec_level"]:checked')?.value || 'level_1_ff';

  // Build entity list — primary source of truth is DB.entities (Phase 8)
  let entities = JSON.parse(JSON.stringify(DB.entities));

  // If somehow empty, fall back to legacy single-issuer model
  if (entities.length === 0) {
    entities.push({
      id: 1,
      name: v('dp_issuer_name'),
      type: v('dp_issuer_type'),
      state: v('dp_issuer_formation_state'),
      role: 'issuer',
      parentId: null,
      formationDate: v('dp_issuer_formation_date'),
      address: v('dp_issuer_address'),
      ein: v('dp_issuer_ein'),
      securities: v('dp_issuer_securities') || 'Membership Interests',
      isIssuer: true,
      generateOpAg: true
    });
  }

  const issuerEntity = entities.find(e => e.isIssuer) || entities[0];

  return {
    securitiesLevel: selectedLevel,
    entities: entities,
    issuerEntity: issuerEntity,
    // Legacy compatibility — issuer and sponsor pointers for older code paths
    issuer: {
      name: issuerEntity.name,
      type: issuerEntity.type,
      formationState: issuerEntity.state,
      formationDate: issuerEntity.formationDate,
      address: issuerEntity.address,
      ein: issuerEntity.ein,
      securities: issuerEntity.securities || 'Membership Interests'
    },
    sponsor: (function() {
      const s = entities.find(e => e.role === 'sponsor');
      if (!s) return { isIndividual: true, name: '', type: '', formationState: '', relationship: '', address: '' };
      return {
        isIndividual: false,
        name: s.name, type: s.type, formationState: s.state,
        relationship: s.parentId === issuerEntity.id ? 'manager' : 'manager',
        address: s.address
      };
    })(),
    signatories: JSON.parse(JSON.stringify(DB.signatories)),
    investors: JSON.parse(JSON.stringify(DB.investors)),
    options: {
      includeDealMemo: v('dp_include_deal_memo') === 'yes',
      outputFormat: v('dp_output_format') || 'html_combined',
      draftingNotes: v('dp_drafting_notes')
    }
  };
};

// =============================================================================
// PHASE 8: HELPER — get state law for an entity (with fallback)
// =============================================================================
function getStateLawForEntity(entity) {
  return STATE_LAW_DATA[entity.state] || null;
}

function entityFullDesignationP8(entity) {
  if (!entity || !entity.name) return '[Entity Name TBD]';
  const stateName = STATE_LAW_DATA[entity.state]?.name || entity.state;
  return `${escapeHtml(entity.name)}, a ${escapeHtml(stateName)} ${escapeHtml(entity.type)}`;
}

function getSignatoriesForEntity(p7, entityId) {
  return p7.signatories.filter(s => s.entityIds && s.entityIds.includes(entityId));
}

// =============================================================================
// PHASE 8: ENTITY STRUCTURE DIAGRAM DOCUMENT
// =============================================================================
function generateStructureDiagram(p7, dealData, sectionNum) {
  const renderNode = (entity, depth) => {
    const stateName = STATE_LAW_DATA[entity.state]?.name || entity.state;
    const indent = '&nbsp;'.repeat(depth * 4);
    const arrow = depth > 0 ? '└─ ' : '';
    let html = `<div style="margin: 0.35rem 0; padding: 0.5rem 0.75rem; background: #fafaf5; border-left: 3px solid #1a1a1a;">
      <strong>${indent}${arrow}${escapeHtml(entity.name || '[Unnamed]')}</strong>
      ${entity.isIssuer ? ' <span style="background:#169B62;color:#FFFFFF;padding:0.05rem 0.4rem;font-size:0.7rem;letter-spacing:1px;">ISSUER</span>' : ''}
      <br><span style="font-size: 0.88rem; color: #4a4a4a;">${escapeHtml(entity.type)} · ${escapeHtml(stateName)} · ${escapeHtml(ENTITY_ROLES[entity.role]?.label || entity.role)}</span>
      ${entity.address ? `<br><span style="font-size: 0.82rem; color: #6b6b6b;">${escapeHtml(entity.address)}</span>` : ''}
    </div>`;
    for (const child of p7.entities.filter(e => e.parentId === entity.id)) {
      html += renderNode(child, depth + 1);
    }
    return html;
  };

  let treeHtml = '';
  const roots = p7.entities.filter(e => !e.parentId);
  for (const root of roots) {
    treeHtml += renderNode(root, 0);
  }

  // Entity summary table
  let entityTable = '<table class="pkg-table"><thead><tr><th>Entity</th><th>Type</th><th>State of Formation</th><th>Role</th><th>Parent</th></tr></thead><tbody>';
  for (const e of p7.entities) {
    const parent = p7.entities.find(p => p.id === e.parentId);
    const stateName = STATE_LAW_DATA[e.state]?.name || e.state;
    entityTable += `<tr>
      <td><strong>${escapeHtml(e.name || '[Unnamed]')}</strong>${e.isIssuer ? ' (Issuer)' : ''}</td>
      <td>${escapeHtml(e.type)}</td>
      <td>${escapeHtml(stateName)}</td>
      <td>${escapeHtml(ENTITY_ROLES[e.role]?.label || e.role)}</td>
      <td>${parent ? escapeHtml(parent.name || `Entity ${parent.id}`) : '— Top —'}</td>
    </tr>`;
  }
  entityTable += '</tbody></table>';

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">${sectionNum}. ENTITY STRUCTURE DIAGRAM</h2>
  <p class="pkg-doc-subtitle">Multi-tier ownership and management structure</p>

  <p>The deal structure consists of ${p7.entities.length} entit${p7.entities.length === 1 ? 'y' : 'ies'} organized as follows. Each entity is governed by the law of its state of formation; provisions in the Operating Agreement(s) reflect state-specific statutory requirements.</p>

  <h3 class="pkg-article">Structure Diagram</h3>
  ${treeHtml}

  <h3 class="pkg-article">Entity Summary</h3>
  ${entityTable}

  <h3 class="pkg-article">Per-Entity Governing Law</h3>
  ${p7.entities.map(e => {
    const sl = STATE_LAW_DATA[e.state];
    if (!sl) return `<p><strong>${escapeHtml(e.name || `Entity ${e.id}`)}:</strong> formed in ${escapeHtml(e.state)} (not in the state law engine; documents use generic provisions).</p>`;
    return `<p><strong>${escapeHtml(e.name || `Entity ${e.id}`)} (${escapeHtml(e.type)}, ${escapeHtml(sl.name)}):</strong> governed by ${escapeHtml(sl.llcAct.shortName)}, ${escapeHtml(sl.llcAct.citation)}. Charging order: ${sl.chargingOrder.exclusive === true ? 'exclusive remedy' : sl.chargingOrder.exclusive === 'multi-member only' ? 'exclusive for multi-member only' : 'not exclusive'}. Series LLC: ${sl.seriesLLC.available === true ? 'available' : sl.seriesLLC.available === 'recent' ? 'recently enacted' : 'not available'}. ${sl.publication.required ? '<strong>Publication required.</strong>' : ''}</p>`;
  }).join('')}
</div>
`;
}



// =============================================================================
// PHASE 8: REFACTORED OPERATING AGREEMENT — entity-aware + state-specific
// =============================================================================
const _phase7GenerateOperatingAgreement = generateOperatingAgreement;
generateOperatingAgreement = function(p7, dealData, results, targetEntity) {
  // Default to the Issuer entity if no target specified (legacy compatibility)
  const entity = targetEntity || p7.issuerEntity || p7.entities[0];
  if (!entity) return '<div class="pkg-section pkg-doc"><p>No entity to generate Operating Agreement for.</p></div>';

  const stateLaw = getStateLawForEntity(entity);
  const isLP = entity.type === 'LP' || entity.type === 'Limited Partnership';
  const isLLC = entity.type === 'LLC' || entity.type === 'Series LLC';
  const docTitle = isLP ? 'LIMITED PARTNERSHIP AGREEMENT' : 'OPERATING AGREEMENT';
  const partyType = isLP ? 'Partner' : 'Member';
  const interestType = isLP ? 'Partnership Interest' : 'Membership Interest';

  // State-specific Act citations
  const actCitation = stateLaw ? (isLP ? stateLaw.lpAct : stateLaw.llcAct) : null;
  const actDefinedTerm = actCitation ? actCitation.definedTerm || actCitation.shortName : 'applicable state limited liability company law';
  const actCitationText = actCitation ? `${actCitation.shortName}, ${actCitation.citation}` : '[applicable state law]';
  const formationDocName = actCitation ? actCitation.formationDoc : (isLP ? 'Certificate of Limited Partnership' : 'Articles of Organization');
  const filingOffice = actCitation ? actCitation.filingOffice : '[applicable filing office]';
  const stateName = stateLaw ? stateLaw.name : entity.state;

  // Build member roster from investors grouped by class (only for Issuer entity)
  const isIssuerDoc = entity.isIssuer;
  let memberRosterHtml = '';
  if (isIssuerDoc) {
    const membersByClass = listMembers(dealData.memberClasses, p7.investors);
    for (const cls of dealData.memberClasses) {
      if (cls.classType === 'sponsor') continue;
      const investors = membersByClass[cls.id]?.investors || [];
      if (investors.length === 0) continue;
      memberRosterHtml += `<tr><td colspan="3"><strong>${escapeHtml(cls.name)}</strong> (${escapeHtml((cls.classType || '').replace('_',' '))} — ${(cls.prefRate * 100).toFixed(2)}% preferred return)</td></tr>`;
      for (const inv of investors) {
        memberRosterHtml += `<tr><td>${escapeHtml(inv.name)}</td><td>${escapeHtml(inv.address)}</td><td>${fmt$(inv.capital)}</td></tr>`;
      }
    }
  } else {
    memberRosterHtml = `<tr><td colspan="3"><em>This entity is not the Issuer. Member roster reflects the parent entity in the structure: ${escapeHtml(getEntityById(entity.parentId)?.name || 'no parent designated')}.</em></td></tr>`;
  }

  // Get manager — the sponsor entity or the parent entity that manages this entity
  const managerEntity = p7.entities.find(e => e.role === 'sponsor' && e.parentId !== entity.id) ||
                        (p7.entities.find(e => e.id === entity.parentId && e.role !== 'trust'));
  const managerDescription = managerEntity ?
    `${entityShortName(managerEntity)}, a ${escapeHtml(STATE_LAW_DATA[managerEntity.state]?.name || managerEntity.state)} ${escapeHtml(managerEntity.type)}` :
    '[Manager TBD]';

  // Signatories for this specific entity
  const entitySignatories = getSignatoriesForEntity(p7, entity.id);

  // Children entities (e.g., Issuer owns Property Opco)
  const childEntities = p7.entities.filter(e => e.parentId === entity.id);

  // State-specific charging order provision
  const chargingOrderHtml = stateLaw ? `
    <p>${stateLaw.chargingOrder.provision}</p>
  ` : '<p>The charging order remedy and any related foreclosure rights are governed by applicable state law.</p>';

  // State-specific fiduciary duty provision
  const fiduciaryHtml = stateLaw ? `
    <p>${stateLaw.fiduciaryDuties.provision}</p>
  ` : '<p>The Manager shall owe such fiduciary duties as required by applicable state law, subject to such modifications as are permitted thereunder.</p>';

  // State-specific publication notice (NY only)
  let publicationHtml = '';
  if (stateLaw && stateLaw.publication && stateLaw.publication.required) {
    publicationHtml = `<p><strong>NEW YORK PUBLICATION REQUIREMENT.</strong> ${stateLaw.publication.provision}</p>`;
  }

  // State-specific dissolution events
  const dissolutionHtml = stateLaw ? `
    <p>${stateLaw.dissolutionEvents}</p>
  ` : '<p>Dissolution shall occur upon the events specified in this Agreement and as required by applicable state law.</p>';

  // Series LLC provision (if state allows and entity is Series)
  let seriesLLCHtml = '';
  if (entity.type === 'Series LLC' && stateLaw && (stateLaw.seriesLLC.available === true || stateLaw.seriesLLC.available === 'recent')) {
    seriesLLCHtml = `<p><strong>SERIES STRUCTURE.</strong> The Company is organized as a Series LLC pursuant to ${escapeHtml(stateLaw.seriesLLC.citation)}. Each Series shall constitute a separate series with its own associated assets, members, and obligations. The debts, liabilities, obligations, and expenses incurred with respect to any one Series shall be enforceable only against the assets of such Series, and not against the assets of the Company generally or any other Series, in accordance with the statutory series protection requirements.</p>`;
  }

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">${docTitle}</h2>
  <p class="pkg-doc-subtitle">${entityShortName(entity).toUpperCase()}, a ${escapeHtml(stateName)} ${escapeHtml(entity.type)}</p>

  <p class="pkg-recital">This ${escapeHtml(isLP ? 'Limited Partnership Agreement' : 'Operating Agreement')} (this <strong>"Agreement"</strong>) is entered into as of ${escapeHtml(entity.formationDate || '[Effective Date]')} (the <strong>"Effective Date"</strong>) by and among ${entityFullDesignationP8(entity)} (the <strong>"Company"</strong>), and the persons listed on <strong>Exhibit&nbsp;A</strong> hereto (each, a <strong>"${partyType}"</strong> and collectively, the <strong>"${partyType}s"</strong>).</p>

  <h3 class="pkg-article">RECITALS</h3>
  <p>WHEREAS, the Company was formed as a ${escapeHtml(stateName)} ${escapeHtml(entity.type)} by the filing of ${escapeHtml(formationDocName)} with ${escapeHtml(filingOffice)} on ${escapeHtml(entity.formationDate || '[Formation Date]')};</p>
  <p>WHEREAS, the ${partyType}s desire to set forth the terms governing the operation and management of the Company in accordance with the ${escapeHtml(actDefinedTerm)};</p>
  ${childEntities.length > 0 ? `<p>WHEREAS, the Company holds direct or indirect interests in the following entities, which form part of the consolidated deal structure: ${childEntities.map(c => `<strong>${escapeHtml(c.name || `Entity ${c.id}`)}</strong>, a ${escapeHtml(STATE_LAW_DATA[c.state]?.name || c.state)} ${escapeHtml(c.type)} (${escapeHtml(ENTITY_ROLES[c.role]?.label || c.role)})`).join('; ')};</p>` : ''}
  <p>NOW, THEREFORE, in consideration of the mutual covenants herein contained, the ${partyType}s agree as follows:</p>

  ${publicationHtml}

  <h3 class="pkg-article">ARTICLE I — DEFINITIONS</h3>
  <p><strong>1.1 Definitions.</strong> For purposes of this Agreement, the following terms have the meanings indicated:</p>
  <p><strong>"Act"</strong> means the ${escapeHtml(actCitationText)}, as amended.</p>
  <p><strong>"Capital Account"</strong> means the capital account of each ${partyType} maintained in accordance with Section&nbsp;3.6 and Treasury Regulations § 1.704-1(b)(2)(iv).</p>
  <p><strong>"Capital Contribution"</strong> means the cash or fair market value of property contributed by a ${partyType} to the capital of the Company.</p>
  <p><strong>"Code"</strong> means the Internal Revenue Code of 1986, as amended.</p>
  <p><strong>"Distribution"</strong> means any cash or other property distributed by the Company to a ${partyType} in respect of its ${interestType}.</p>
  <p><strong>"Fiscal Year"</strong> means the Company's fiscal year, which shall end on December&nbsp;31 of each year unless otherwise required by the Code.</p>
  <p><strong>"Manager"</strong> means ${managerDescription}, or such successor as may be appointed pursuant to this Agreement.</p>
  <p><strong>"${partyType}"</strong> means each person listed on Exhibit A and any additional or substituted person admitted as a ${partyType} in accordance with this Agreement.</p>
  <p><strong>"${interestType}"</strong> means a ${partyType}'s entire interest in the Company, including its right to receive Distributions, its share of Profits and Losses, and any voting or consent rights.</p>
  <p><strong>"Preferred Return"</strong> has the meaning set forth in Section&nbsp;5.2.</p>
  <p><strong>"Profits"</strong> and <strong>"Losses"</strong> mean, for each Fiscal Year, the Company's taxable income or loss, computed in accordance with Code § 703(a) and adjusted as set forth in this Agreement.</p>
  <p><strong>"Treasury Regulations"</strong> means the regulations promulgated under the Code, as in effect from time to time.</p>

  <h3 class="pkg-article">ARTICLE II — FORMATION AND PURPOSE</h3>
  <p><strong>2.1 Formation.</strong> The Company was formed under the Act by the filing of ${escapeHtml(formationDocName)} with ${escapeHtml(filingOffice)}. The ${partyType}s confirm and ratify the filing.</p>
  <p><strong>2.2 Name.</strong> The name of the Company is ${entityShortName(entity)}.</p>
  <p><strong>2.3 Principal Office.</strong> The principal office of the Company is ${escapeHtml(entity.address || '[Principal Office Address]')}.</p>
  <p><strong>2.4 Registered Agent.</strong> The registered agent for service of process in ${escapeHtml(stateName)} shall be the person or entity designated in the ${escapeHtml(formationDocName)}, as may be changed from time to time by the Manager.</p>
  <p><strong>2.5 Purpose.</strong> The purpose of the Company is to ${isIssuerDoc ? `acquire, develop, hold, lease, operate, finance, refinance, and dispose of the real property and improvements located at ${escapeHtml(dealData.propertyLocation || '[Property Location]')} (the <strong>"Property"</strong>) and to engage in any lawful business or activity for which a ${escapeHtml(entity.type)} may be organized under the Act in connection therewith` : `act as ${escapeHtml(ENTITY_ROLES[entity.role]?.label || entity.role)} in the deal structure described in the Recitals, and to engage in any lawful business or activity for which a ${escapeHtml(entity.type)} may be organized under the Act`}. The Company may also engage in any related or incidental activities approved by the Manager.</p>
  <p><strong>2.6 Term.</strong> The Company shall continue in existence until terminated and dissolved as provided in Article XI.</p>

  ${seriesLLCHtml}

  <h3 class="pkg-article">ARTICLE III — CAPITAL CONTRIBUTIONS</h3>
  <p><strong>3.1 Initial Capital Contributions.</strong> Each ${partyType} shall make the Initial Capital Contribution set forth opposite its name on <strong>Exhibit A</strong>.${isIssuerDoc ? ` The aggregate Initial Capital Contributions of all ${partyType}s shall be ${fmt$(p7.investors.reduce((s,i)=>s+(i.capital||0),0))}.` : ''}</p>
  <p><strong>3.2 Additional Capital Contributions.</strong> No ${partyType} shall be required to make any Additional Capital Contribution. If the Manager determines that additional capital is required for the operation of the Company, the Manager may (but shall not be required to) call for Additional Capital Contributions from the ${partyType}s pro rata in proportion to their respective ${interestType}s.</p>
  <p><strong>3.3 Failure to Fund.</strong> If any ${partyType} fails to fund a properly called Additional Capital Contribution within ten (10) Business Days of the call notice, the funding ${partyType}s may (i) advance the shortfall as a ${partyType.toLowerCase()} loan bearing interest at the prime rate plus four percent (4%) and repayable from distributions otherwise payable to the defaulting ${partyType}, or (ii) contribute the shortfall as additional capital and proportionately dilute the defaulting ${partyType}'s ${interestType}.</p>
  <p><strong>3.4 Loans by ${partyType}s.</strong> A ${partyType} may, with the consent of the Manager, lend funds to the Company. Any such loan shall be on arm's-length terms and shall not be treated as a Capital Contribution.</p>
  <p><strong>3.5 No Interest on Capital.</strong> No ${partyType} shall be entitled to interest on its Capital Contribution except as expressly provided herein.</p>
  <p><strong>3.6 Capital Accounts.</strong> A separate Capital Account shall be maintained for each ${partyType} in accordance with Treas. Reg. § 1.704-1(b)(2)(iv). Capital Accounts shall be increased by Capital Contributions and allocations of Profits, and decreased by Distributions and allocations of Losses.</p>

  <h3 class="pkg-article">ARTICLE IV — ALLOCATIONS OF PROFITS AND LOSSES</h3>
  <p><strong>4.1 General Allocation.</strong> Except as otherwise provided in this Article IV, Profits and Losses shall be allocated to the ${partyType}s in accordance with the <strong>${escapeHtml(results?.allocData?.method704b || 'targeted')}</strong> method, in a manner consistent with Treas. Reg. § 1.704-1(b) and the economic intent of the ${partyType}s as reflected in the Distribution provisions of Article V.</p>
  <p><strong>4.2 § 704(c) Allocations.</strong> If any property is contributed to the Company with a fair market value different from its adjusted tax basis, items of income, gain, loss, and deduction with respect to such property shall be allocated among the ${partyType}s so as to take account of the variation between the basis of the property and its fair market value in accordance with Code § 704(c) and Treas. Reg. § 1.704-3, using the <strong>${escapeHtml(results?.allocData?.method704c || 'traditional')}</strong> method.</p>
  <p><strong>4.3 Regulatory Allocations.</strong> Notwithstanding any other provision, the following allocations shall be made in the following order: (a) minimum gain chargeback under Treas. Reg. § 1.704-2(f); (b) chargeback of ${partyType.toLowerCase()} nonrecourse debt minimum gain under Treas. Reg. § 1.704-2(i)(4); (c) qualified income offset under Treas. Reg. § 1.704-1(b)(2)(ii)(d); (d) gross income allocation; and (e) nonrecourse deductions and ${partyType.toLowerCase()} nonrecourse deductions in accordance with Treas. Reg. §§ 1.704-2(b) and 1.704-2(i)(2).</p>
  <p><strong>4.4 Recapture.</strong> To the extent permitted by Treas. Reg. § 1.1245-1(e) and § 1.1250-1(f), depreciation recapture shall be allocated to the ${partyType}s who received the related depreciation deductions.</p>
  <p><strong>4.5 Tax Allocations Generally Follow Book Allocations.</strong> Except as otherwise provided in Section 4.2, tax allocations of Profits, Losses, and other tax items shall follow the corresponding book allocations.</p>

  <h3 class="pkg-article">ARTICLE V — DISTRIBUTIONS</h3>
  <p><strong>5.1 Available Cash.</strong> The Manager shall cause the Company to distribute Available Cash to the ${partyType}s in accordance with Section 5.2 (Distribution Waterfall).</p>
  <p><strong>5.2 Distribution Waterfall.</strong> ${isIssuerDoc ? 'Available Cash shall be distributed as follows:' : 'Available Cash shall be distributed in accordance with the waterfall set forth in the operating agreement of the Issuer entity, as flowed through to this Company on a pro-rata basis.'}</p>
  ${isIssuerDoc ? `<p style="margin-left:1.5rem;"><strong>(a) Preferred Return.</strong> First, ${(dealData.prefRate * 100).toFixed(2)}% per annum, ${escapeHtml((dealData.prefType || 'cumulative').replace('_',' '))} ${escapeHtml((dealData.prefPriority || 'pari passu').replace('_',' '))}, on each ${partyType}'s unreturned Capital Contributions until each ${partyType} has received Distributions equal to such Preferred Return.</p>
  <p style="margin-left:1.5rem;"><strong>(b) Return of Capital.</strong> Second, in proportion to each ${partyType}'s unreturned Capital Contributions, until each ${partyType} has received Distributions equal to its Capital Contributions.</p>
  <p style="margin-left:1.5rem;"><strong>(c) Promote Tiers.</strong> Third, the remainder shall be distributed pursuant to the promote tiers set forth on <strong>Exhibit C</strong>.</p>` : ''}
  <p><strong>5.3 Tax Distributions.</strong> Within thirty (30) days following the end of each Fiscal Year, the Manager may cause the Company to make Tax Distributions to each ${partyType} in an amount equal to its allocated share of taxable income for such year multiplied by the Assumed Tax Rate.</p>
  <p><strong>5.4 Withholding.</strong> The Company shall withhold and pay over to the appropriate tax authorities any amounts required to be withheld pursuant to the Code or applicable state, local, or foreign tax law (including FIRPTA withholding under Code § 1445 and § 1446 with respect to foreign ${partyType}s).</p>

  <h3 class="pkg-article">ARTICLE VI — MANAGEMENT</h3>
  <p><strong>6.1 Manager.</strong> The business and affairs of the Company shall be managed by ${managerDescription} (the <strong>"Manager"</strong>). The Manager shall have all powers necessary or appropriate to carry out the purposes of the Company.</p>
  ${stateLaw ? `<p><strong>6.2 Statutory Default.</strong> ${escapeHtml(stateLaw.defaultMgmtNote)}</p>` : ''}
  <p><strong>6.3 Powers of the Manager.</strong> Without limiting the generality of Section 6.1, the Manager shall have full power and authority to: (a) acquire, develop, finance, refinance, lease, manage, and dispose of Company assets; (b) execute and deliver all documents on behalf of the Company; (c) employ professionals, contractors, and consultants; (d) maintain books and records; (e) cause the Company to obtain insurance; (f) prosecute and defend legal actions; (g) make tax elections; and (h) take such other actions as the Manager deems necessary or appropriate.</p>
  <p><strong>6.4 Major Decisions.</strong> Notwithstanding Section 6.3, the following actions shall require the affirmative vote of ${partyType}s holding more than ${escapeHtml((dealData.majorVoteThreshold || 'majority').replace('_',' '))} of the ${interestType}s: (i) sale of all or substantially all Company assets; (ii) merger, consolidation, or conversion; (iii) admission of additional ${partyType}s; (iv) amendment of this Agreement adversely affecting a class disproportionately; (v) dissolution (other than at end of term); (vi) commencement of bankruptcy; and (vii) any transaction with the Manager or its affiliates not on arm's-length terms.</p>
  <p><strong>6.5 Standard of Care and Fiduciary Duties.</strong> The Manager shall perform its duties in good faith and with the care of an ordinarily prudent person.</p>
  ${fiduciaryHtml}
  <p><strong>6.6 Compensation.</strong> The Manager shall be entitled to receive the fees set forth on <strong>Exhibit B</strong>.</p>
  <p><strong>6.7 Removal.</strong> The Manager may be removed only for Cause upon the affirmative vote of ${partyType}s holding seventy-five percent (75%) or more of the ${interestType}s held by ${partyType}s other than the Manager and its affiliates.</p>

  <h3 class="pkg-article">ARTICLE VII — INDEMNIFICATION</h3>
  <p>The Company shall indemnify and hold harmless the Manager, its affiliates, and their respective officers, directors, ${partyType.toLowerCase()}s, partners, employees, and agents from and against any and all losses, claims, damages, liabilities, judgments, fines, settlements, and reasonable expenses arising out of or relating to the business of the Company, except to the extent attributable to gross negligence, willful misconduct, or fraud.</p>

  <h3 class="pkg-article">ARTICLE VIII — BOOKS, RECORDS, AND REPORTING</h3>
  <p><strong>8.1 Books and Records.</strong> The Manager shall maintain complete and accurate books and records of the Company at its principal office.</p>
  <p><strong>8.2 Annual Statements.</strong> Within one hundred twenty (120) days after the end of each Fiscal Year, the Manager shall deliver to each ${partyType} unaudited annual financial statements and tax information necessary to enable each ${partyType} to prepare its tax returns, including a Schedule K-1.</p>
  <p><strong>8.3 Partnership Representative.</strong> The Manager (or such other ${partyType} as the Manager may designate) shall serve as the <strong>"Partnership Representative"</strong> within the meaning of Code § 6223.</p>
  <p><strong>8.4 Tax Elections.</strong> The Manager shall make all tax elections deemed appropriate, including the election under Code § 754 if the Manager determines such election is in the best interests of the ${partyType}s.</p>

  <h3 class="pkg-article">ARTICLE IX — TRANSFERS, ASSIGNMENTS, AND CHARGING ORDER</h3>
  <p><strong>9.1 Restrictions on Transfer.</strong> No ${partyType} may sell, assign, transfer, pledge, or otherwise dispose of all or any portion of its ${interestType} (a <strong>"Transfer"</strong>) without the prior written consent of the Manager. Any purported Transfer in violation of this Article shall be null and void.</p>
  <p><strong>9.2 Permitted Transfers.</strong> A ${partyType} may Transfer all or part of its ${interestType}, without Manager consent, to: (i) an affiliate; (ii) a revocable trust for estate planning; or (iii) by reason of death to the ${partyType}'s estate.</p>
  <p><strong>9.3 Right of First Refusal.</strong> Any proposed Transfer (other than a Permitted Transfer) shall be subject to a right of first refusal in favor of the Company and then the other ${partyType}s.</p>
  <p><strong>9.4 Securities Law Compliance.</strong> No Transfer shall be permitted unless the proposed transferee provides representations satisfactory to the Manager that the Transfer is exempt from registration under the Securities Act of 1933 and applicable state securities laws.</p>
  <p><strong>9.5 Charging Order.</strong></p>
  ${chargingOrderHtml}

  <h3 class="pkg-article">ARTICLE X — REPRESENTATIONS AND WARRANTIES</h3>
  <p>Each ${partyType} represents and warrants that: (a) it has full power and authority to enter into this Agreement; (b) it is acquiring its ${interestType} for investment for its own account; (c) it qualifies as an "accredited investor" within the meaning of Rule 501(a) of Regulation D; (d) it has had the opportunity to ask questions of the Manager; and (e) it can bear the economic risk of its investment, including total loss.</p>

  <h3 class="pkg-article">ARTICLE XI — DISSOLUTION AND WINDING UP</h3>
  <p><strong>11.1 Events of Dissolution.</strong></p>
  ${dissolutionHtml}
  <p><strong>11.2 Winding Up.</strong> Upon dissolution, the Manager (or, if none, a liquidator) shall wind up the affairs of the Company, liquidate its assets, pay or provide for its liabilities, and distribute any remaining assets in accordance with Section 11.3.</p>
  <p><strong>11.3 Final Distribution.</strong> The proceeds of liquidation shall be distributed: (a) to creditors (other than ${partyType}s); (b) to establish reserves; (c) to ${partyType}s in repayment of any ${partyType.toLowerCase()} loans; and (d) to ${partyType}s in accordance with positive Capital Account balances.</p>

  <h3 class="pkg-article">ARTICLE XII — MISCELLANEOUS</h3>
  <p><strong>12.1 Notices.</strong> All notices required under this Agreement shall be in writing and delivered to the address on Exhibit A.</p>
  <p><strong>12.2 Governing Law.</strong> This Agreement shall be governed by and construed in accordance with the laws of the State of ${escapeHtml(stateName)}, without regard to its conflicts of laws principles.</p>
  <p><strong>12.3 Dispute Resolution.</strong> Any dispute shall be resolved by binding arbitration administered by the American Arbitration Association under its Commercial Arbitration Rules in ${escapeHtml(stateName)}. ${entity.state === 'DE' ? 'The parties acknowledge the availability of the Delaware Court of Chancery for matters of corporate governance under the LLC Agreement; the parties may agree by separate instrument to designate the Court of Chancery as the forum for such matters.' : ''}</p>
  <p><strong>12.4 Entire Agreement.</strong> This Agreement (with its Exhibits) constitutes the entire agreement among the ${partyType}s.</p>
  <p><strong>12.5 Amendments.</strong> This Agreement may be amended only by a written instrument signed by the Manager and ${partyType}s holding ${escapeHtml((dealData.majorVoteThreshold || 'majority').replace('_',' '))} of the ${interestType}s.</p>
  <p><strong>12.6 Counterparts.</strong> This Agreement may be executed in counterparts.</p>
  <p><strong>12.7 Severability.</strong> If any provision is held invalid, the remainder shall continue in full force.</p>

  <p style="margin-top:2rem;"><strong>IN WITNESS WHEREOF,</strong> the parties have executed this Agreement as of the Effective Date.</p>

  <div class="pkg-signature-block">
    <p><strong>MANAGER:</strong></p>
    <p>${managerEntity ? entityShortName(managerEntity) + '<br>' : ''}</p>
    ${entitySignatories.map(s => `
      <p>By: __________________________________<br>
      Name: ${escapeHtml(s.name || '[Name]')}<br>
      Title: ${escapeHtml(s.title || '[Title]')}<br>
      ${SIGNING_CAPACITY[s.capacity] ? 'Capacity: ' + SIGNING_CAPACITY[s.capacity] : ''}</p>
    `).join('') || '<p><em>No signatories assigned to this entity.</em></p>'}
  </div>

  <p style="margin-top:2rem;"><strong>${partyType.toUpperCase()}S:</strong> Each ${partyType} shall execute a separate counterpart signature page incorporated herein as part of <strong>Exhibit A</strong>.</p>

  <h3 class="pkg-article">EXHIBIT A — ${partyType.toUpperCase()} ROSTER AND CAPITAL CONTRIBUTIONS</h3>
  <table class="pkg-table">
    <thead><tr><th>${partyType} Legal Name</th><th>Mailing Address</th><th>Capital Contribution</th></tr></thead>
    <tbody>${memberRosterHtml}</tbody>
  </table>

  ${isIssuerDoc ? `
  <h3 class="pkg-article">EXHIBIT B — MANAGER COMPENSATION AND FEES</h3>
  <p>The Manager shall be entitled to the following fees:</p>
  <ul>
    <li><strong>Development Fee:</strong> ${(dealData.devFee * 100).toFixed(2)}% of Total Project Cost.</li>
    <li><strong>Construction Management Fee:</strong> ${(dealData.cmFee * 100).toFixed(2)}% of hard construction costs.</li>
    <li><strong>Asset Management Fee:</strong> ${(dealData.amFee * 100).toFixed(2)}% per annum of unreturned Capital Contributions.</li>
    <li><strong>Disposition Fee:</strong> ${(dealData.dispFee * 100).toFixed(2)}% of gross sale proceeds.</li>
    <li><strong>Promoted Interest:</strong> as set forth on Exhibit C.</li>
  </ul>

  <h3 class="pkg-article">EXHIBIT C — PROMOTE TIERS AND DISTRIBUTION WATERFALL</h3>
  <p>Distributions shall be made pursuant to the following waterfall:</p>
  <p style="margin-left:1rem;"><strong>Tier 1 — Preferred Return:</strong> ${(dealData.prefRate * 100).toFixed(2)}% per annum, ${escapeHtml((dealData.prefType || 'cumulative').replace('_',' '))} ${escapeHtml((dealData.prefPriority || 'pari passu').replace('_',' '))}.</p>
  <p style="margin-left:1rem;"><strong>Tier 2 — Return of Capital:</strong> pari passu return of Capital Contributions.</p>
  ${(dealData.promoteTiers || []).map((t, i) => `<p style="margin-left:1rem;"><strong>Tier ${i+3} — ${escapeHtml(t.hurdle || '')} Hurdle:</strong> ${(t.lpPct * 100).toFixed(0)}% to ${partyType}s, ${(t.spPct * 100).toFixed(0)}% to Sponsor.</p>`).join('')}
  ` : ''}

  ${stateLaw ? `
  <h3 class="pkg-article">EXHIBIT D — STATE-SPECIFIC PROVISIONS (${escapeHtml(stateName)})</h3>
  <p><strong>Statute.</strong> This Agreement is governed by ${escapeHtml(stateLaw.llcAct.shortName)}, ${escapeHtml(stateLaw.llcAct.citation)}.</p>
  <p><strong>Filing Office.</strong> ${escapeHtml(stateLaw.llcAct.filingOffice)}; formation document is the ${escapeHtml(stateLaw.llcAct.formationDoc)}.</p>
  <p><strong>Charging Order.</strong> ${stateLaw.chargingOrder.exclusive === true ? 'Charging order is the exclusive remedy of a judgment creditor; foreclosure of a member interest is not permitted.' : stateLaw.chargingOrder.exclusive === 'multi-member only' ? 'Charging order is exclusive for multi-member LLCs; single-member LLCs may permit foreclosure under the Olmstead carve-out.' : 'Charging order remedy applies; foreclosure of a member interest is permitted in appropriate circumstances.'}</p>
  <p><strong>Fiduciary Duties.</strong> Waivability: ${escapeHtml(stateLaw.fiduciaryDuties.waivability)} (${escapeHtml(stateLaw.fiduciaryDuties.citation)}).</p>
  ${stateLaw.publication.required ? `<p><strong>Publication Requirement.</strong> ${stateLaw.publication.provision}</p>` : ''}
  <p><strong>Annual Fees.</strong> ${escapeHtml(stateLaw.annualFees.type)} of ${typeof stateLaw.annualFees.amount === 'number' ? '$' + stateLaw.annualFees.amount : stateLaw.annualFees.amount}, due ${escapeHtml(stateLaw.annualFees.dueDate || 'annually')}.</p>
  <p><strong>Notable Features.</strong></p>
  <ul>${stateLaw.notableFeatures.map(f => `<li>${escapeHtml(f)}</li>`).join('')}</ul>
  ` : ''}
</div>
`;
};



// =============================================================================
// PHASE 8: REFACTORED generateDealPackage — multi-entity, multi-OA
// =============================================================================
const _phase7GenerateDealPackage = generateDealPackage;
generateDealPackage = function() {
  const p7 = collectPhase7Data();
  const dealData = collectFormData();
  const results = DB.lastResults || calculateDeal(dealData);
  const levelConfig = SEC_LEVEL_CONFIG[p7.securitiesLevel];

  // Validation
  const issues = [];
  if (p7.entities.length === 0) issues.push('At least one entity must be defined in the Entity Structure.');
  if (p7.entities.filter(e => e.isIssuer).length !== 1) issues.push('Exactly one entity must be designated as the Issuer (currently ' + p7.entities.filter(e => e.isIssuer).length + ').');
  for (const ent of p7.entities) {
    if (!ent.name) issues.push(`Entity ${ent.id} is missing a legal name.`);
    if (!ent.state) issues.push(`Entity "${ent.name || ent.id}" is missing a state of formation.`);
  }
  if (p7.signatories.length === 0) issues.push('At least one authorized signatory must be specified.');
  if (p7.signatories.some(s => !s.name)) issues.push('All signatories must have a name.');
  if (p7.signatories.some(s => !s.entityIds || s.entityIds.length === 0)) issues.push('Each signatory must be assigned to at least one entity.');
  if (p7.investors.length === 0) issues.push('At least one investor must be added to the Investor List.');
  if (p7.investors.some(i => !i.name)) issues.push('All investors must have a legal name.');
  if (p7.investors.some(i => !i.capital || i.capital <= 0)) issues.push('All investors must have a positive Capital Commitment.');
  if (p7.investors.some(i => !i.memberClassId)) issues.push('All investors must be assigned to a member class.');

  if (issues.length > 0) {
    alert('Cannot generate deal package. Issues to resolve:\n\n' + issues.join('\n'));
    return;
  }

  // Build the document HTML in order
  let sectionNum = 2;
  let bodyHtml = generatePackageCover(p7, dealData, levelConfig);
  bodyHtml += generatePackageTOC(p7, dealData, levelConfig);
  bodyHtml += generatePackageOverview(p7, dealData, levelConfig);

  // PHASE 8: Insert structure diagram before the Op Ags
  bodyHtml += generateStructureDiagram(p7, dealData, sectionNum++);

  // PHASE 8: Generate an Op Ag for EACH entity that has generateOpAg flag
  const entitiesWithOA = p7.entities.filter(e => e.generateOpAg);
  for (let i = 0; i < entitiesWithOA.length; i++) {
    const entity = entitiesWithOA[i];
    const oaSectionHeader = `<div class="pkg-section pkg-doc">
      <h2 class="pkg-doc-title">${sectionNum}. ${entity.type === 'LP' ? 'LIMITED PARTNERSHIP AGREEMENT' : 'OPERATING AGREEMENT'} of ${entityShortName(entity)}</h2>
      <p class="pkg-doc-subtitle">${entityShortName(entity)} (${escapeHtml(STATE_LAW_DATA[entity.state]?.name || entity.state)} ${escapeHtml(entity.type)}) — ${escapeHtml(ENTITY_ROLES[entity.role]?.label || entity.role)}${entity.isIssuer ? ' · ISSUER' : ''}</p>
    </div>`;
    bodyHtml += oaSectionHeader;
    bodyHtml += generateOperatingAgreement(p7, dealData, results, entity);
    sectionNum++;
  }

  if (levelConfig.includesRiskLetter) {
    bodyHtml += generateRiskDisclosureLetter(p7, dealData, results, sectionNum++);
  }
  if (levelConfig.includesPPM) {
    bodyHtml += generatePPM(p7, dealData, results, levelConfig, sectionNum++);
  }

  // Sub Ag form section
  bodyHtml += `<div class="pkg-section pkg-doc">
    <h2 class="pkg-doc-title">${sectionNum++}. SUBSCRIPTION AGREEMENT &mdash; Form and Executed Counterparts</h2>
    <p class="pkg-doc-subtitle">${p7.investors.length} counterpart${p7.investors.length === 1 ? '' : 's'} follow, each personalized for the named subscriber and addressed to the Issuer entity (${entityShortName(p7.issuerEntity)})</p>
  </div>`;
  for (const inv of p7.investors) {
    bodyHtml += generateSubscriptionAgreement(p7, dealData, inv, levelConfig, `${sectionNum - 1}.${p7.investors.indexOf(inv) + 1}`);
  }

  // AI Questionnaire form section
  bodyHtml += `<div class="pkg-section pkg-doc">
    <h2 class="pkg-doc-title">${sectionNum++}. ACCREDITED INVESTOR QUESTIONNAIRE &mdash; Form and Executed Counterparts</h2>
    <p class="pkg-doc-subtitle">${p7.investors.length} counterpart${p7.investors.length === 1 ? '' : 's'} follow</p>
  </div>`;
  for (const inv of p7.investors) {
    bodyHtml += generateAIQuestionnaire(p7, dealData, inv, levelConfig, `${sectionNum - 1}.${p7.investors.indexOf(inv) + 1}`);
  }

  if (levelConfig.includesVerifLetter) {
    bodyHtml += generateVerificationLetter(p7, dealData, levelConfig, sectionNum++);
  }
  if (levelConfig.includesGenSolicMemo) {
    bodyHtml += generateGenSolicMemo(p7, dealData, levelConfig, sectionNum++);
  }

  bodyHtml += generateFormDWorksheet(p7, dealData, results, levelConfig, sectionNum++);

  // PHASE 8: Generate a Blue Sky notice for EACH unique formation state
  const formationStates = [...new Set(p7.entities.map(e => e.state))];
  for (const fs of formationStates) {
    if (STATE_LAW_DATA[fs]) {
      // Generate notice for this state by temporarily swapping the issuer's formation state
      const stateSpecificP7 = JSON.parse(JSON.stringify(p7));
      stateSpecificP7.issuer.formationState = fs;
      stateSpecificP7.issuerEntity = stateSpecificP7.entities.find(e => e.isIssuer);
      bodyHtml += generateBlueSkyNotice(stateSpecificP7, dealData, levelConfig, `${sectionNum}.${formationStates.indexOf(fs) + 1}`);
    }
  }
  sectionNum++;

  if (p7.options.includeDealMemo) {
    bodyHtml += `<div class="pkg-section pkg-doc">
      <h2 class="pkg-doc-title">EXHIBIT A &mdash; Deal Memorandum (Financial Analysis &amp; Structural Diagram)</h2>
      <p class="pkg-doc-subtitle">${escapeHtml(dealData.projectName || 'Project')} &mdash; ${todayLong()}</p>
      <p style="font-style:italic; color:#6b6b6b;">The following Deal Memorandum is generated by the Donovan Legal PLLC Reserve Deal Builder Phase&nbsp;V output. It is attached for the convenience of investors and forms part of this package.</p>
      <div style="margin-top:1.5rem;">
        ${(typeof generateDealMemoBody === 'function') ? generateDealMemoBody(dealData, results) : '<p><em>Deal Memo content not available in this session. Generate the Deal Memo from the Results step (Step&nbsp;9), then re-generate the Deal Package.</em></p>'}
      </div>
    </div>`;
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Deal Package — ${escapeHtml(p7.issuer.name)}</title>
<style>${getDealPackagePrintCSS()}</style>
</head>
<body>
  <div class="pkg-draft-stamp">DRAFT &middot; PRIVILEGED &amp; CONFIDENTIAL</div>
  <div class="pkg-container">
    ${bodyHtml}
  </div>
  <div class="pkg-footer">
    Generated ${todayLong()} &middot; Donovan Legal PLLC &middot; Reserve Deal Builder &middot; DRAFT &mdash; for review under engagement letter
  </div>
</body>
</html>`;

  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(fullHtml);
    newWindow.document.close();
  } else {
    alert('Pop-up blocked. Please allow pop-ups for this page to view the deal package.');
  }
};

// =============================================================================
// PHASE 8: REFACTORED TOC to include per-entity Op Ags and Structure Diagram
// =============================================================================
const _phase7GeneratePackageTOC = generatePackageTOC;
generatePackageTOC = function(p7, dealData, levelConfig) {
  const investorCount = p7.investors.length;
  const entitiesWithOA = p7.entities.filter(e => e.generateOpAg);

  let toc = `
<div class="pkg-toc">
  <h2>Package Index</h2>
  <ol>
    <li><strong>Package Overview</strong> — securities-law summary and document map</li>
    <li><strong>Entity Structure Diagram</strong> — multi-tier ownership and management structure (${p7.entities.length} entit${p7.entities.length === 1 ? 'y' : 'ies'})</li>`;
  for (const ent of entitiesWithOA) {
    const docName = ent.type === 'LP' ? 'Limited Partnership Agreement' : 'Operating Agreement';
    toc += `<li><strong>${docName}</strong> of ${entityShortName(ent)} (${escapeHtml(STATE_LAW_DATA[ent.state]?.name || ent.state)} ${escapeHtml(ent.type)})${ent.isIssuer ? ' — Issuer' : ''}</li>`;
  }
  if (levelConfig.includesRiskLetter) toc += `<li><strong>Risk Disclosure Letter</strong> (Friends &amp; Family level)</li>`;
  if (levelConfig.includesPPM) toc += `<li><strong>Private Placement Memorandum</strong></li>`;
  toc += `<li><strong>Subscription Agreement</strong> — Form (and ${investorCount} executed counterpart${investorCount === 1 ? '' : 's'})</li>`;
  toc += `<li><strong>Accredited Investor Questionnaire</strong> — Form (and ${investorCount} executed counterpart${investorCount === 1 ? '' : 's'})</li>`;
  if (levelConfig.includesVerifLetter) toc += `<li><strong>Investor Verification Documentation Standard</strong> (506(c))</li>`;
  if (levelConfig.includesGenSolicMemo) toc += `<li><strong>General Solicitation Compliance Memorandum</strong> (506(c))</li>`;
  toc += `<li><strong>Form D Filing Worksheet</strong></li>`;
  const formationStates = [...new Set(p7.entities.map(e => e.state))].filter(s => STATE_LAW_DATA[s]);
  toc += `<li><strong>State Blue Sky Notice(s)</strong> &mdash; ${formationStates.map(s => STATE_LAW_DATA[s]?.name || s).join(', ') || 'TBD'}</li>`;
  if (p7.options.includeDealMemo) toc += `<li><strong>Exhibit A:</strong> Deal Memorandum — Financial Analysis &amp; Structural Diagram</li>`;
  toc += `</ol>
</div>
`;
  return toc;
};



// =============================================================================
// PHASE 8: EXTEND SAVE/LOAD FOR MULTI-ENTITY STATE
// =============================================================================
const _phase7SaveJSON = saveJSON;
saveJSON = function() {
  // Wrap the Phase 7 save and inject Phase 8 entity state into the state payload
  const originalCreateElement = document.createElement.bind(document);
  let capturedBlob = null;
  document.createElement = function(tag) {
    const el = originalCreateElement(tag);
    if (tag.toLowerCase() === 'a') {
      const origClick = el.click ? el.click.bind(el) : function() {};
      el.click = function() {
        // Augment the blob: re-fetch and inject entities + nextEntityId
        if (el.href && el.href.startsWith('blob:')) {
          try {
            fetch(el.href).then(r => r.json()).then(payload => {
              payload.version = 'phase-8';
              payload.state.entities = DB.entities;
              payload.state.nextEntityId = DB.nextEntityId;
              const newBlob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
              const newUrl = URL.createObjectURL(newBlob);
              const downloader = originalCreateElement('a');
              downloader.href = newUrl;
              downloader.download = el.download;
              document.body.appendChild(downloader);
              origClick.call(downloader);
              setTimeout(() => {
                document.body.removeChild(downloader);
                URL.revokeObjectURL(newUrl);
                document.createElement = originalCreateElement;
              }, 100);
            }).catch(err => {
              console.error('Phase 8 save augmentation failed:', err);
              origClick();  // fall back to original
              document.createElement = originalCreateElement;
            });
            return;
          } catch (err) {
            console.error('Phase 8 save augmentation error:', err);
          }
        }
        origClick();
        document.createElement = originalCreateElement;
      };
    }
    return el;
  };
  _phase7SaveJSON();
};

const _phase7LoadJSON = loadJSON;
loadJSON = function(event) {
  const file = event.target.files[0];
  if (!file) return;
  const origReader = new FileReader();
  origReader.onload = e => {
    try {
      const payload = JSON.parse(e.target.result);
      // Load Phase 8 entities if present. The issuer entity's `state` becomes
      // p7.issuer.formationState, which reaches the Form D worksheet's Blue Sky
      // paragraph and from there document.write(), so it is coerced to the
      // two-letter shape a state abbreviation actually has on the way in.
      if (payload.state && payload.state.entities) {
        DB.entities = (Array.isArray(payload.state.entities) ? payload.state.entities : [])
          .filter(en => en && typeof en === 'object')
          .map(en => { en.state = restorableState(en.state); return en; });
        DB.nextEntityId = payload.state.nextEntityId || DB.entities.length + 1;
      } else {
        // Migrate from Phase 7: build entities from legacy issuer/sponsor fields
        DB.entities = [];
        DB.nextEntityId = 1;
        const f = payload.formInputs || {};
        const p7 = payload.phase7Inputs || {};
        if (p7.dp_issuer_name) {
          DB.entities.push({
            id: DB.nextEntityId++, name: p7.dp_issuer_name, type: p7.dp_issuer_type || 'LLC',
            state: restorableState(p7.dp_issuer_formation_state) || 'FL', role: 'issuer', parentId: null,
            formationDate: p7.dp_issuer_formation_date || '', address: p7.dp_issuer_address || '',
            ein: p7.dp_issuer_ein || '', securities: p7.dp_issuer_securities || 'Membership Interests',
            isIssuer: true, generateOpAg: true
          });
        }
        if (!p7.dp_sponsor_individual && p7.dp_sponsor_name) {
          DB.entities.push({
            id: DB.nextEntityId++, name: p7.dp_sponsor_name, type: p7.dp_sponsor_type || 'LLC',
            state: restorableState(p7.dp_sponsor_formation_state) || 'WY', role: 'sponsor',
            parentId: DB.entities[0]?.id || null,
            formationDate: '', address: p7.dp_sponsor_address || '',
            ein: '', securities: '', isIssuer: false, generateOpAg: false
          });
        }
      }
      // Re-trigger Phase 7 load (which handles everything else)
      const newFile = new File([e.target.result], file.name, { type: 'application/json' });
      const newEvent = { target: { files: [newFile], value: '' } };
      _phase7LoadJSON(newEvent);
      // After Phase 7 load completes, re-render Phase 8 UI
      setTimeout(() => {
        renderEntities();
        renderEntityTreePreview();
        renderSignatories();
      }, 250);
    } catch (err) {
      alert('Error loading file: ' + err.message);
    }
  };
  origReader.readAsText(file);
  event.target.value = '';
};

document.addEventListener('DOMContentLoaded', () => {
  // Re-wire load input now that Phase 8 loadJSON is in place
  const loadInput = document.getElementById('load_json_input');
  if (loadInput) {
    const newInput = loadInput.cloneNode(true);
    loadInput.parentNode.replaceChild(newInput, loadInput);
    newInput.addEventListener('change', loadJSON);
  }
});



// =============================================================================
// PHASE 8: PATCH PPM SPONSOR & MANAGEMENT SECTION + FORM D RELATED PERSONS
// We override the relevant generators to enumerate the full entity tree
// instead of describing only a single Manager.
// =============================================================================
const _phase7GeneratePPM = generatePPM;
generatePPM = function(p7, dealData, results, levelConfig, sectionNum) {
  // Generate the original PPM
  let html = _phase7GeneratePPM(p7, dealData, results, levelConfig, sectionNum);

  // Build the multi-tier replacement for "THE SPONSOR AND MANAGEMENT"
  const issuer = p7.issuerEntity;
  const allEntities = p7.entities;
  const issuerStateLaw = STATE_LAW_DATA[issuer.state];

  // Build entity-by-entity description
  const entityDescriptions = allEntities.map(e => {
    const sl = STATE_LAW_DATA[e.state];
    const stateName = sl?.name || e.state;
    const role = ENTITY_ROLES[e.role]?.label || e.role;
    const parent = allEntities.find(p => p.id === e.parentId);
    return `<li><strong>${escapeHtml(e.name || '[Unnamed]')}</strong>${e.isIssuer ? ' <em>(Issuer)</em>' : ''} — a ${escapeHtml(stateName)} ${escapeHtml(e.type)} serving the role of ${escapeHtml(role)}${parent ? `, owned by ${escapeHtml(parent.name || `Entity ${parent.id}`)}` : ' (top of structure)'}. Governed by ${sl ? escapeHtml(sl.llcAct.shortName) + ', ' + escapeHtml(sl.llcAct.citation) : 'applicable state law'}.</li>`;
  }).join('');

  const newSponsorSection = `<h3 class="pkg-article">3. THE STRUCTURE, SPONSOR, AND MANAGEMENT</h3>
  <p><strong>Multi-Tier Entity Structure.</strong> The deal is conducted through a multi-tier entity structure consisting of ${allEntities.length} entit${allEntities.length === 1 ? 'y' : 'ies'} formed in ${[...new Set(allEntities.map(e => STATE_LAW_DATA[e.state]?.name || e.state))].join(', ')}. Each entity in the structure is governed by the law of its state of formation, and the Operating Agreement(s) reflect state-specific statutory requirements. The Entity Structure Diagram (Section 2 of this Package) provides a visual representation of the ownership and management chain.</p>
  <p><strong>Entities in the Structure.</strong></p>
  <ul style="margin-left:1.5rem;">${entityDescriptions}</ul>
  <p><strong>Issuer.</strong> Subscriptions and Capital Contributions are made to ${entityFullDesignationP8(issuer)} (the <strong>"Issuer"</strong>), which is the entity offering the securities described in this Memorandum. ${issuerStateLaw ? `The Issuer's governing law (${escapeHtml(issuerStateLaw.llcAct.shortName)}, ${escapeHtml(issuerStateLaw.llcAct.citation)}) provides ${issuerStateLaw.chargingOrder.exclusive === true ? '<strong>charging-order-exclusive remedy protection</strong>' : issuerStateLaw.chargingOrder.exclusive === 'multi-member only' ? '<strong>charging-order-exclusive protection for multi-member LLCs</strong>' : 'a charging order remedy that does not exclude foreclosure'} against judgment creditors of the members.` : ''}</p>
  <p><strong>Manager Principals.</strong> The principals identified in the Signatory section of this Memorandum and the Operating Agreement(s) bring substantial professional experience relevant to the Property and the deal structure, including (as applicable) tax planning for real estate developers, transactional legal representation, certified public accounting, real estate brokerage, and construction management.</p>
  <p><strong>Authorized Signatories.</strong> The persons authorized to sign on behalf of each entity in the structure are identified in the signature blocks of the respective Operating Agreement(s), the Subscription Agreement, and related documents. Investors should review carefully which entity each signatory is binding when signing.</p>
  <p><strong>Bad-Actor Disqualification.</strong> Each "covered person" within the meaning of Rule 506(d) has been evaluated and the Manager represents (and the Sponsor principals each have certified) that no disqualifying event under Rule 506(d)(1) has occurred within the applicable lookback periods.</p>`;

  // Replace the Phase 7 sponsor section
  const oldSection = '<h3 class="pkg-article">3. THE SPONSOR AND MANAGEMENT</h3>';
  const idxStart = html.indexOf(oldSection);
  const idxEnd = html.indexOf('<h3 class="pkg-article">4. THE INVESTMENT OPPORTUNITY</h3>');
  if (idxStart !== -1 && idxEnd !== -1) {
    html = html.substring(0, idxStart) + newSponsorSection + '\n\n  ' + html.substring(idxEnd);
  }

  return html;
};

// =============================================================================
// PHASE 8: PATCH FORM D RELATED PERSONS to list ALL entities
// =============================================================================
const _phase7GenerateFormDWorksheet = generateFormDWorksheet;
generateFormDWorksheet = function(p7, dealData, results, levelConfig, sectionNum) {
  let html = _phase7GenerateFormDWorksheet(p7, dealData, results, levelConfig, sectionNum);

  // Build new Related Persons block enumerating all entities
  const relatedPersonsRows = p7.entities.map(e => {
    const sl = STATE_LAW_DATA[e.state];
    const role = ENTITY_ROLES[e.role]?.label || e.role;
    let relationship = '';
    if (e.isIssuer) relationship = 'Issuer (subject of Form D)';
    else if (e.role === 'sponsor') relationship = 'Manager / Sponsor';
    else if (e.role === 'holdco') relationship = 'Holding Company in chain of ownership';
    else if (e.role === 'trust') relationship = 'Trust holding indirect interest';
    else if (e.role === 'blocker') relationship = 'Blocker entity (tax structuring)';
    else if (e.role === 'feeder') relationship = 'Feeder fund vehicle';
    else if (e.role === 'property_opco') relationship = 'Property Operating Company';
    else relationship = role;
    return `<tr>
      <td><strong>${escapeHtml(e.name || '[Unnamed]')}</strong></td>
      <td>${escapeHtml(e.type)} (${sl ? escapeHtml(sl.name) : escapeHtml(e.state)})</td>
      <td>${escapeHtml(relationship)}</td>
      <td>${escapeHtml(e.address || '')}</td>
    </tr>`;
  }).join('');

  const newRelatedBlock = `<h3 class="pkg-article">Item 3 — Related Persons (Full Entity Structure)</h3>
  <p>For each related person (including, for Form D purposes, all directors, executive officers, and persons performing similar functions of the Issuer, as well as all entities in the ownership/management chain), provide:</p>
  <table class="pkg-table">
    <thead><tr><th>Entity / Person Name</th><th>Entity Type and Jurisdiction</th><th>Relationship to Issuer</th><th>Address</th></tr></thead>
    <tbody>${relatedPersonsRows}</tbody>
  </table>
  <p>Each Related Person listed above must be evaluated against Rule 506(d) bad-actor disqualification. In addition to the entities listed above, all natural-person principals serving as managers, directors, executive officers, or general partners of any entity in the chain must be separately disclosed on Form D with full address. See the Signatory section of this Package for the natural persons.</p>`;

  // Replace the original Item 3 section if present
  const oldHeader = '<h3 class="pkg-article">Item 3 — Related Persons</h3>';
  if (html.includes(oldHeader)) {
    const startIdx = html.indexOf(oldHeader);
    // Find the next <h3 class="pkg-article"> starting with "Item " to know where Item 3 ends
    const afterHeader = html.substring(startIdx + oldHeader.length);
    const nextH3Match = afterHeader.match(/<h3 class="pkg-article">Item \d/);
    if (nextH3Match) {
      const nextHeaderIdx = afterHeader.indexOf(nextH3Match[0]);
      const before = html.substring(0, startIdx);
      const after = afterHeader.substring(nextHeaderIdx);
      html = before + newRelatedBlock + '\n\n  ' + after;
    }
  }

  return html;
};

// =============================================================================
// PHASE 8: First-time-user backward compat — seed entity from legacy fields
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  // If DB.entities was seeded with one empty entity but legacy issuer fields have values,
  // populate the seed entity from the legacy fields
  setTimeout(() => {
    if (DB.entities.length === 1 && !DB.entities[0].name) {
      const legacyName = document.getElementById('dp_issuer_name')?.value;
      if (legacyName) {
        DB.entities[0].name = legacyName;
        DB.entities[0].type = document.getElementById('dp_issuer_type')?.value || 'LLC';
        DB.entities[0].state = document.getElementById('dp_issuer_formation_state')?.value || 'FL';
        DB.entities[0].formationDate = document.getElementById('dp_issuer_formation_date')?.value || '';
        DB.entities[0].address = document.getElementById('dp_issuer_address')?.value || '';
        DB.entities[0].ein = document.getElementById('dp_issuer_ein')?.value || '';
        DB.entities[0].securities = document.getElementById('dp_issuer_securities')?.value || 'Membership Interests';
        renderEntities();
        renderEntityTreePreview();
      }
    }
  }, 100);
});



// =============================================================================
// =============================================================================
//                  PHASE 8.5 — STATE LAW ENGINE EXPANSION
//                  All 50 states + DC fully populated
//                  Plus Phase 3 blocker → entity integration
//                  Plus NY §206 publication compliance generator
// =============================================================================
// =============================================================================

// Helper to build provision text from flags. Lets state entries stay compact.
function _chargingOrderProvision(stateName, citation, exclusive, foreclosurePermitted) {
  if (exclusive === true) {
    return `On application by a judgment creditor of a Member, the court may charge the Member's transferable interest with payment of the unsatisfied amount of the judgment. To the extent so charged, the judgment creditor has only the rights of a transferee. Under ${citation}, the charging order constitutes the exclusive remedy by which a judgment creditor may satisfy a judgment from the Member's interest, and ${foreclosurePermitted ? 'foreclosure may be available only on a showing of strict statutory criteria' : 'no foreclosure of the membership interest is permitted'}.`;
  }
  if (exclusive === 'multi-member only') {
    return `Under ${citation}, the charging order is the exclusive remedy of a judgment creditor against a multi-member ${stateName} limited liability company. For a single-member ${stateName} limited liability company, the court may order foreclosure of the membership interest in appropriate circumstances. Members are advised that the addition of substantive economic interests of other members preserves charging-order-only protection.`;
  }
  return `Pursuant to ${citation}, a judgment creditor of a Member may obtain a charging order against the Member's transferable interest. The statute does not designate the charging order as the exclusive remedy, and ${stateName} courts have permitted foreclosure of membership interests in appropriate circumstances. Members should not assume charging-order-exclusive protection in ${stateName}.`;
}

function _fiduciaryDutyProvision(stateName, citation, waivability) {
  if (waivability === 'broad') {
    return `To the extent permitted by ${citation}, the duties (including fiduciary duties) of the Manager and any other person to the Company or to any Member may be expanded, restricted, or eliminated by the express provisions of this Agreement; provided, however, that the implied contractual covenant of good faith and fair dealing may not be eliminated.`;
  }
  if (waivability === 'partial') {
    return `Subject to the express limitations of ${citation}, this Agreement may eliminate or alter the standards of liability and the duty of care of the Manager (other than the implied contractual obligation of good faith and fair dealing); however, the Agreement may not authorize knowingly violative conduct.`;
  }
  return `The Manager owes the Company and its Members the duties of loyalty and care imposed by ${citation}. This Agreement may modify, but not eliminate, those duties. ${stateName} restricts the scope of permissible waivers more strictly than Delaware, Nevada, or Wyoming.`;
}

function _dissolutionEvents(stateName, citation) {
  return `Dissolution per ${citation}: occurrence of an event specified in this Agreement; consent of all Members (or such lesser threshold as this Agreement provides); judicial dissolution; or administrative dissolution for failure to maintain good standing.`;
}

// Reusable builder for state entries
function _buildState(name, params) {
  const sl = params.llcAct.citation;
  return {
    name: name,
    llcAct: {
      shortName: params.llcAct.shortName,
      definedTerm: params.llcAct.shortName,
      citation: params.llcAct.citation,
      formationDoc: params.llcAct.formationDoc || 'Articles of Organization',
      formationDocCitation: params.llcAct.formationDocCitation || params.llcAct.citation,
      filingOffice: params.llcAct.filingOffice || `${name} Secretary of State`
    },
    lpAct: {
      shortName: params.lpAct?.shortName || `${name} Limited Partnership Act`,
      definedTerm: params.lpAct?.shortName || `${name} Limited Partnership Act`,
      citation: params.lpAct?.citation || 'applicable state limited partnership statute',
      formationDoc: 'Certificate of Limited Partnership',
      filingOffice: params.llcAct.filingOffice || `${name} Secretary of State`
    },
    chargingOrder: {
      exclusive: params.chargingOrder.exclusive,
      citation: params.chargingOrder.citation,
      foreclosurePermitted: params.chargingOrder.foreclosurePermitted || false,
      provision: params.chargingOrder.provision || _chargingOrderProvision(name, params.chargingOrder.citation, params.chargingOrder.exclusive, params.chargingOrder.foreclosurePermitted)
    },
    seriesLLC: params.seriesLLC || { available: false, note: `${name} does not authorize Series LLCs.` },
    fiduciaryDuties: {
      waivability: params.fiduciaryDuties.waivability,
      citation: params.fiduciaryDuties.citation,
      provision: params.fiduciaryDuties.provision || _fiduciaryDutyProvision(name, params.fiduciaryDuties.citation, params.fiduciaryDuties.waivability)
    },
    publication: params.publication || { required: false },
    defaultMgmt: params.defaultMgmt || 'member-managed',
    defaultMgmtNote: params.defaultMgmtNote || `Default management is by Members under ${params.llcAct.citation} unless this Agreement provides otherwise.`,
    annualFees: params.annualFees,
    incTax: params.incTax || { entityLevel: false, note: `${name} state income tax may apply to Members' distributive shares.` },
    notableFeatures: params.notableFeatures || [],
    dissolutionEvents: params.dissolutionEvents || _dissolutionEvents(name, params.llcAct.citation)
  };
}

// ============================================================================
// REMAINING 42 STATES + DC
// (Existing 8: DE, FL, WY, NV, TX, CA, NY, MA already in STATE_LAW_DATA)
// ============================================================================
Object.assign(STATE_LAW_DATA, {

  // -------- NORTHEAST --------
  NJ: _buildState('New Jersey', {
    llcAct: { shortName: 'New Jersey Revised Uniform Limited Liability Company Act', citation: 'N.J.S.A. § 42:2C-1 et seq.', formationDoc: 'Certificate of Formation', filingOffice: 'New Jersey Department of the Treasury, Division of Revenue' },
    lpAct: { shortName: 'New Jersey Uniform Limited Partnership Act (2000)', citation: 'N.J.S.A. § 42:2A-1 et seq.' },
    chargingOrder: { exclusive: true, citation: 'N.J.S.A. § 42:2C-43', foreclosurePermitted: false },
    seriesLLC: { available: false, note: 'New Jersey does not authorize Series LLCs.' },
    fiduciaryDuties: { waivability: 'partial', citation: 'N.J.S.A. § 42:2C-11' },
    annualFees: { type: 'annual report fee', amount: 75, dueDate: 'anniversary month', citation: 'N.J.S.A. § 42:2C-26' },
    incTax: { entityLevel: 'partnership filing fee', note: 'New Jersey imposes a partnership filing fee of $150 per partner (up to $250,000) on LLCs taxed as partnerships. High state income tax (up to 10.75% individual).' },
    notableFeatures: ['High state income tax (up to 10.75% individual)', 'Partnership filing fee of $150 per partner', 'Charging order is exclusive remedy', 'No Series LLC', 'Strict nonresident withholding requirements']
  }),
  CT: _buildState('Connecticut', {
    llcAct: { shortName: 'Connecticut Uniform Limited Liability Company Act', citation: 'Conn. Gen. Stat. § 34-243 et seq.' },
    chargingOrder: { exclusive: false, citation: 'Conn. Gen. Stat. § 34-259' },
    fiduciaryDuties: { waivability: 'partial', citation: 'Conn. Gen. Stat. § 34-255i' },
    annualFees: { type: 'annual report fee', amount: 80, dueDate: 'anniversary month' },
    incTax: { entityLevel: 'pass-through entity tax', note: 'Connecticut imposes a mandatory Pass-Through Entity Tax (PTET) on LLCs at 6.99% with a partial offsetting credit to Members. Individual income tax up to 6.99%.' },
    notableFeatures: ['Mandatory pass-through entity tax (6.99%)', 'No Series LLC', 'Foreclosure permitted']
  }),
  RI: _buildState('Rhode Island', {
    llcAct: { shortName: 'Rhode Island Limited Liability Company Act', citation: 'R.I. Gen. Laws § 7-16-1 et seq.' },
    chargingOrder: { exclusive: false, citation: 'R.I. Gen. Laws § 7-16-37' },
    fiduciaryDuties: { waivability: 'partial', citation: 'R.I. Gen. Laws § 7-16-17' },
    annualFees: { type: 'annual report fee', amount: 50, dueDate: 'November 1' },
    notableFeatures: ['No Series LLC', 'Minimum corporate tax $400 applies to LLCs by election']
  }),
  NH: _buildState('New Hampshire', {
    llcAct: { shortName: 'New Hampshire Limited Liability Company Act', citation: 'N.H. RSA 304-C' },
    chargingOrder: { exclusive: true, citation: 'N.H. RSA 304-C:124' },
    fiduciaryDuties: { waivability: 'broad', citation: 'N.H. RSA 304-C:107' },
    annualFees: { type: 'annual report fee', amount: 100, dueDate: 'April 1' },
    notableFeatures: ['No state income tax on wages (Interest & Dividends Tax repealed effective 2025)', 'Business Profits Tax (7.5%) applies above $103,000 gross income', 'Charging order exclusive']
  }),
  VT: _buildState('Vermont', {
    llcAct: { shortName: 'Vermont Limited Liability Company Act', citation: '11 V.S.A. § 4001 et seq.' },
    chargingOrder: { exclusive: false, citation: '11 V.S.A. § 4074' },
    fiduciaryDuties: { waivability: 'partial', citation: '11 V.S.A. § 4059' },
    annualFees: { type: 'annual report fee', amount: 35, dueDate: 'anniversary quarter' },
    notableFeatures: ['Low annual fees', 'Blockchain-Based LLC (BBLLC) framework available under 11 V.S.A. § 4172']
  }),
  ME: _buildState('Maine', {
    llcAct: { shortName: 'Maine Limited Liability Company Act', citation: '31 M.R.S. § 1501 et seq.' },
    chargingOrder: { exclusive: false, citation: '31 M.R.S. § 1573' },
    fiduciaryDuties: { waivability: 'partial', citation: '31 M.R.S. § 1559' },
    annualFees: { type: 'annual report fee', amount: 85, dueDate: 'June 1' },
    notableFeatures: ['No Series LLC', 'Foreclosure permitted']
  }),
  PA: _buildState('Pennsylvania', {
    llcAct: { shortName: 'Pennsylvania Uniform Limited Liability Company Act of 2016', citation: '15 Pa.C.S. § 8811 et seq.' },
    lpAct: { shortName: 'Pennsylvania Uniform Limited Partnership Act of 2016', citation: '15 Pa.C.S. § 8611 et seq.' },
    chargingOrder: { exclusive: true, citation: '15 Pa.C.S. § 8853', foreclosurePermitted: false },
    fiduciaryDuties: { waivability: 'partial', citation: '15 Pa.C.S. § 8849.1' },
    annualFees: { type: 'decennial registration', amount: 70, dueDate: 'every 10 years (years ending in "1")', note: 'Pennsylvania does not require annual reports; instead a Decennial Report is filed every 10 years.' },
    incTax: { entityLevel: false, note: 'Pennsylvania flat individual income tax 3.07%. Corporate Net Income Tax 8.49% (decreasing annually to 4.99% by 2031).' },
    notableFeatures: ['Decennial Report instead of annual report (filed every 10 years)', 'Charging order is exclusive remedy', 'No Series LLC', 'Modern Uniform Act adopted 2016', 'Pennsylvania publication requirement REPEALED (was § 8503; no longer in effect)']
  }),
  MD: _buildState('Maryland', {
    llcAct: { shortName: 'Maryland Limited Liability Company Act', citation: 'Md. Code, Corps. & Ass\'ns § 4A-101 et seq.' },
    chargingOrder: { exclusive: false, citation: 'Md. Code, Corps. & Ass\'ns § 4A-607' },
    fiduciaryDuties: { waivability: 'partial', citation: 'Md. Code, Corps. & Ass\'ns § 4A-401' },
    annualFees: { type: 'annual report + personal property return', amount: 300, dueDate: 'April 15', citation: 'Md. Tax-Prop. § 11-101' },
    notableFeatures: ['$300 annual report fee (higher than DE/WY)', 'Personal Property Tax Return required', 'No Series LLC', 'Pass-through entity tax (PTET) election available']
  }),

  // -------- SOUTHEAST --------
  VA: _buildState('Virginia', {
    llcAct: { shortName: 'Virginia Limited Liability Company Act', citation: 'Va. Code § 13.1-1000 et seq.' },
    chargingOrder: { exclusive: 'multi-member only', citation: 'Va. Code § 13.1-1041.1', foreclosurePermitted: 'single-member only' },
    fiduciaryDuties: { waivability: 'broad', citation: 'Va. Code § 13.1-1024.1' },
    annualFees: { type: 'annual registration fee', amount: 50, dueDate: 'last day of anniversary month' },
    notableFeatures: ['Low annual fee ($50)', 'Charging order exclusive for multi-member LLCs', 'No Series LLC', 'Broad fiduciary duty waivability', 'Major commercial RE jurisdiction (DC suburbs, Hampton Roads)']
  }),
  WV: _buildState('West Virginia', {
    llcAct: { shortName: 'West Virginia Uniform Limited Liability Company Act', citation: 'W.Va. Code § 31B-1-101 et seq.' },
    chargingOrder: { exclusive: false, citation: 'W.Va. Code § 31B-5-504' },
    fiduciaryDuties: { waivability: 'partial', citation: 'W.Va. Code § 31B-4-409' },
    annualFees: { type: 'annual report fee', amount: 25, dueDate: 'July 1' }
  }),
  NC: _buildState('North Carolina', {
    llcAct: { shortName: 'North Carolina Limited Liability Company Act', citation: 'N.C.G.S. § 57D-1-01 et seq.' },
    chargingOrder: { exclusive: 'multi-member only', citation: 'N.C.G.S. § 57D-5-03' },
    fiduciaryDuties: { waivability: 'partial', citation: 'N.C.G.S. § 57D-3-21' },
    annualFees: { type: 'annual report fee', amount: 200, dueDate: 'April 15' },
    notableFeatures: ['Major commercial RE jurisdiction (Research Triangle, Charlotte)', 'Charging order exclusive for multi-member LLCs', 'No Series LLC', 'Annual report fee higher than national average']
  }),
  SC: _buildState('South Carolina', {
    llcAct: { shortName: 'South Carolina Uniform Limited Liability Company Act of 1996', citation: 'S.C. Code § 33-44-101 et seq.' },
    chargingOrder: { exclusive: true, citation: 'S.C. Code § 33-44-504', foreclosurePermitted: false },
    fiduciaryDuties: { waivability: 'partial', citation: 'S.C. Code § 33-44-409' },
    annualFees: { type: 'no annual report required for LLCs', amount: 0, dueDate: 'N/A', note: 'South Carolina does not require annual reports for most LLCs (only those taxed as C-corporations).' },
    notableFeatures: ['No annual report required for partnership-taxed LLCs', 'Charging order exclusive', 'Coastal SC and Greenville-Spartanburg are major RE markets']
  }),
  GA: _buildState('Georgia', {
    llcAct: { shortName: 'Georgia Limited Liability Company Act', citation: 'O.C.G.A. § 14-11-100 et seq.' },
    chargingOrder: { exclusive: 'multi-member only', citation: 'O.C.G.A. § 14-11-504' },
    fiduciaryDuties: { waivability: 'partial', citation: 'O.C.G.A. § 14-11-305' },
    annualFees: { type: 'annual registration', amount: 50, dueDate: 'April 1' },
    notableFeatures: ['Atlanta is major commercial RE market', 'Charging order exclusive for multi-member LLCs', 'No Series LLC', 'Low annual fee']
  }),
  AL: _buildState('Alabama', {
    llcAct: { shortName: 'Alabama Limited Liability Company Law of 2014', citation: 'Code of Alabama, Title 10A, Chapter 5A' },
    chargingOrder: { exclusive: true, citation: 'Ala. Code § 10A-5A-5.03' },
    seriesLLC: { available: true, citation: 'Ala. Code § 10A-5A-11.01' },
    fiduciaryDuties: { waivability: 'broad', citation: 'Ala. Code § 10A-5A-1.08' },
    annualFees: { type: 'Business Privilege Tax + annual report', amount: 100, dueDate: '15th day of 3rd month after FY end', note: 'Minimum Business Privilege Tax is $100; varies based on net worth.' },
    notableFeatures: ['Series LLC available', 'Charging order exclusive', 'Business Privilege Tax minimum $100']
  }),
  MS: _buildState('Mississippi', {
    llcAct: { shortName: 'Mississippi Limited Liability Company Act', citation: 'Miss. Code § 79-29-101 et seq.' },
    chargingOrder: { exclusive: true, citation: 'Miss. Code § 79-29-703' },
    fiduciaryDuties: { waivability: 'broad', citation: 'Miss. Code § 79-29-403' },
    annualFees: { type: 'annual report fee', amount: 25, dueDate: 'April 15' }
  }),
  LA: _buildState('Louisiana', {
    llcAct: { shortName: 'Louisiana Limited Liability Company Law', citation: 'La. R.S. § 12:1301 et seq.' },
    chargingOrder: { exclusive: false, citation: 'La. R.S. § 12:1331' },
    fiduciaryDuties: { waivability: 'partial', citation: 'La. R.S. § 12:1314' },
    annualFees: { type: 'annual report fee', amount: 35, dueDate: 'anniversary month' },
    notableFeatures: ['Civil law jurisdiction (unique among U.S. states)', 'Louisiana doctrine of usufruct may affect interests', 'No Series LLC', 'Foreclosure permitted']
  }),
  AR: _buildState('Arkansas', {
    llcAct: { shortName: 'Arkansas Uniform Limited Liability Company Act of 2021', citation: 'Ark. Code § 4-38-101 et seq.' },
    chargingOrder: { exclusive: true, citation: 'Ark. Code § 4-38-504' },
    fiduciaryDuties: { waivability: 'partial', citation: 'Ark. Code § 4-38-409' },
    annualFees: { type: 'franchise tax', amount: 150, dueDate: 'May 1' }
  }),
  KY: _buildState('Kentucky', {
    llcAct: { shortName: 'Kentucky Limited Liability Company Act', citation: 'KRS Chapter 275' },
    chargingOrder: { exclusive: 'multi-member only', citation: 'KRS § 275.260' },
    fiduciaryDuties: { waivability: 'partial', citation: 'KRS § 275.170' },
    annualFees: { type: 'annual report fee', amount: 15, dueDate: 'June 30' },
    notableFeatures: ['Very low annual fee ($15)', 'Charging order exclusive for multi-member LLCs', 'Limited Liability Entity Tax (LLET) applies to LLCs']
  }),
  TN: _buildState('Tennessee', {
    llcAct: { shortName: 'Tennessee Revised Limited Liability Company Act', citation: 'T.C.A. § 48-249-101 et seq.' },
    chargingOrder: { exclusive: true, citation: 'T.C.A. § 48-249-509', foreclosurePermitted: false },
    seriesLLC: { available: true, citation: 'T.C.A. § 48-249-309' },
    fiduciaryDuties: { waivability: 'broad', citation: 'T.C.A. § 48-249-403' },
    annualFees: { type: 'annual report + franchise tax', amount: 300, dueDate: '1st day of 4th month after FY end', note: 'Annual report fee $300; franchise tax minimum $100 on net worth (greater of in-state property or apportioned net worth).' },
    incTax: { entityLevel: 'franchise + excise tax', note: 'Tennessee imposes Franchise Tax (0.25% net worth, min $100) and Excise Tax (6.5% net earnings) at entity level on LLCs taxed as partnerships.' },
    notableFeatures: ['Tennessee Franchise & Excise Tax applies at entity level', 'Series LLC available', 'Charging order exclusive', 'Nashville and Memphis are major RE markets']
  }),

  // -------- MIDWEST --------
  OH: _buildState('Ohio', {
    llcAct: { shortName: 'Ohio Revised Limited Liability Company Act', citation: 'Ohio Rev. Code § 1706.01 et seq.' },
    chargingOrder: { exclusive: true, citation: 'Ohio Rev. Code § 1706.342', foreclosurePermitted: false },
    seriesLLC: { available: true, citation: 'Ohio Rev. Code § 1706.76', note: 'Ohio Series LLC available effective 2022 under revised LLC Act.' },
    fiduciaryDuties: { waivability: 'broad', citation: 'Ohio Rev. Code § 1706.08' },
    annualFees: { type: 'no annual report', amount: 0, dueDate: 'N/A', note: 'Ohio does not require an annual report for LLCs.' },
    notableFeatures: ['No annual report required for LLCs', 'Series LLC available (2022)', 'Charging order exclusive', 'Modern statute (2022 revision)', 'Columbus and Cleveland are major commercial RE markets']
  }),
  IN: _buildState('Indiana', {
    llcAct: { shortName: 'Indiana Business Flexibility Act', citation: 'Ind. Code § 23-18 et seq.' },
    chargingOrder: { exclusive: false, citation: 'Ind. Code § 23-18-6-7' },
    fiduciaryDuties: { waivability: 'partial', citation: 'Ind. Code § 23-18-4-2' },
    annualFees: { type: 'biennial report fee', amount: 50, dueDate: 'biennial', note: 'Biennial report $50 (every two years).' }
  }),
  MI: _buildState('Michigan', {
    llcAct: { shortName: 'Michigan Limited Liability Company Act', citation: 'MCL § 450.4101 et seq.' },
    chargingOrder: { exclusive: false, citation: 'MCL § 450.4507' },
    fiduciaryDuties: { waivability: 'partial', citation: 'MCL § 450.4404' },
    annualFees: { type: 'annual statement', amount: 25, dueDate: 'February 15' },
    notableFeatures: ['Low annual fee ($25)', 'Detroit emerging RE market', 'Foreclosure permitted', 'No Series LLC']
  }),
  IL: _buildState('Illinois', {
    llcAct: { shortName: 'Illinois Limited Liability Company Act', citation: '805 ILCS 180' },
    lpAct: { shortName: 'Illinois Uniform Limited Partnership Act (2001)', citation: '805 ILCS 215' },
    chargingOrder: { exclusive: 'multi-member only', citation: '805 ILCS 180/30-20', foreclosurePermitted: 'single-member only' },
    seriesLLC: { available: true, citation: '805 ILCS 180/37-40', note: 'Illinois Series LLC available; each Series may have separate name, members, managers, and assets.' },
    fiduciaryDuties: { waivability: 'partial', citation: '805 ILCS 180/15-3' },
    annualFees: { type: 'annual report fee', amount: 75, dueDate: 'last day of anniversary month' },
    notableFeatures: ['Chicago is major commercial RE market', 'Series LLC available', 'Charging order exclusive for multi-member LLCs', 'Personal property replacement tax (1.5%) applies to LLCs taxed as partnerships', 'Illinois PTET election available']
  }),
  WI: _buildState('Wisconsin', {
    llcAct: { shortName: 'Wisconsin Limited Liability Company Law', citation: 'Wis. Stat. ch. 183' },
    chargingOrder: { exclusive: true, citation: 'Wis. Stat. § 183.0504' },
    fiduciaryDuties: { waivability: 'partial', citation: 'Wis. Stat. § 183.0409' },
    annualFees: { type: 'annual report fee', amount: 25, dueDate: 'end of anniversary quarter' }
  }),
  MN: _buildState('Minnesota', {
    llcAct: { shortName: 'Minnesota Revised Uniform Limited Liability Company Act', citation: 'Minn. Stat. ch. 322C' },
    chargingOrder: { exclusive: false, citation: 'Minn. Stat. § 322C.0503' },
    fiduciaryDuties: { waivability: 'partial', citation: 'Minn. Stat. § 322C.0409' },
    annualFees: { type: 'annual renewal', amount: 0, dueDate: 'December 31', note: 'No fee for timely annual renewal; $25 fee if late.' },
    notableFeatures: ['No fee for timely annual renewal', 'Minneapolis-St. Paul major commercial RE market', 'High individual income tax (up to 9.85%)']
  }),
  IA: _buildState('Iowa', {
    llcAct: { shortName: 'Iowa Revised Uniform Limited Liability Company Act', citation: 'Iowa Code ch. 489' },
    chargingOrder: { exclusive: true, citation: 'Iowa Code § 489.503' },
    seriesLLC: { available: true, citation: 'Iowa Code § 489.1201' },
    fiduciaryDuties: { waivability: 'partial', citation: 'Iowa Code § 489.409' },
    annualFees: { type: 'biennial report', amount: 30, dueDate: 'biennial' },
    notableFeatures: ['Series LLC available', 'Biennial reporting (not annual)', 'Charging order exclusive']
  }),
  MO: _buildState('Missouri', {
    llcAct: { shortName: 'Missouri Limited Liability Company Act', citation: 'Mo. Rev. Stat. § 347.010 et seq.' },
    chargingOrder: { exclusive: true, citation: 'Mo. Rev. Stat. § 347.119' },
    fiduciaryDuties: { waivability: 'broad', citation: 'Mo. Rev. Stat. § 347.088' },
    annualFees: { type: 'no annual report required', amount: 0, dueDate: 'N/A', note: 'Missouri does not require annual reports for LLCs.' },
    notableFeatures: ['No annual report required for LLCs', 'Charging order exclusive', 'Broad fiduciary duty waivability', 'Kansas City and St. Louis RE markets']
  }),
  KS: _buildState('Kansas', {
    llcAct: { shortName: 'Kansas Revised Limited Liability Company Act', citation: 'K.S.A. § 17-7662 et seq.' },
    chargingOrder: { exclusive: 'multi-member only', citation: 'K.S.A. § 17-76,113' },
    seriesLLC: { available: true, citation: 'K.S.A. § 17-76,143' },
    fiduciaryDuties: { waivability: 'broad', citation: 'K.S.A. § 17-7673' },
    annualFees: { type: 'annual report fee', amount: 55, dueDate: '15th day of 4th month after FY end' },
    notableFeatures: ['Series LLC available', 'Modeled after Delaware (broad fiduciary waiver)', 'Charging order exclusive for multi-member LLCs']
  }),
  NE: _buildState('Nebraska', {
    llcAct: { shortName: 'Nebraska Uniform Limited Liability Company Act', citation: 'Neb. Rev. Stat. § 21-101 et seq.' },
    chargingOrder: { exclusive: true, citation: 'Neb. Rev. Stat. § 21-141' },
    fiduciaryDuties: { waivability: 'partial', citation: 'Neb. Rev. Stat. § 21-138' },
    publication: { required: true, citation: 'Neb. Rev. Stat. § 21-193', provision: 'Within 45 days after formation, the Company must publish notice of organization in a legal newspaper of general circulation in the county where its designated office is located, for three successive weeks. Proof of publication must be filed with the Secretary of State. Failure to comply may result in administrative dissolution.' },
    annualFees: { type: 'biennial report fee', amount: 25, dueDate: 'biennial', note: 'Biennial report $25.' },
    notableFeatures: ['<strong>Publication required</strong> under § 21-193 (in legal newspaper for 3 weeks)', 'Biennial reporting', 'Charging order exclusive']
  }),
  ND: _buildState('North Dakota', {
    llcAct: { shortName: 'North Dakota Uniform Limited Liability Company Act', citation: 'N.D.C.C. ch. 10-32.1' },
    chargingOrder: { exclusive: false, citation: 'N.D.C.C. § 10-32.1-43' },
    seriesLLC: { available: true, citation: 'N.D.C.C. § 10-32.1-09' },
    fiduciaryDuties: { waivability: 'partial', citation: 'N.D.C.C. § 10-32.1-40' },
    annualFees: { type: 'annual report fee', amount: 50, dueDate: 'November 15' },
    notableFeatures: ['Series LLC available', 'Strong asset protection trust law (Dynasty Trust friendly)']
  }),
  SD: _buildState('South Dakota', {
    llcAct: { shortName: 'South Dakota Limited Liability Company Act', citation: 'SDCL ch. 47-34A' },
    chargingOrder: { exclusive: true, citation: 'SDCL § 47-34A-503', foreclosurePermitted: false },
    seriesLLC: { available: true, citation: 'SDCL § 47-34A-216', note: 'South Dakota Series LLC permitted.' },
    fiduciaryDuties: { waivability: 'broad', citation: 'SDCL § 47-34A-110' },
    annualFees: { type: 'annual report fee', amount: 50, dueDate: 'first day of anniversary month' },
    incTax: { entityLevel: false, note: 'South Dakota has no state income tax (individuals or entities).' },
    notableFeatures: ['No state income tax', 'Charging order exclusive remedy', 'Series LLC available', 'Strong dynasty trust statute (1,000-year perpetuities)', 'Strong asset protection — "the new Nevada" for trust and LLC planning', 'No state income tax on individuals or entities']
  }),

  // -------- SOUTH CENTRAL --------
  OK: _buildState('Oklahoma', {
    llcAct: { shortName: 'Oklahoma Limited Liability Company Act', citation: '18 Okla. Stat. § 2000 et seq.' },
    chargingOrder: { exclusive: true, citation: '18 Okla. Stat. § 2034', foreclosurePermitted: false },
    seriesLLC: { available: true, citation: '18 Okla. Stat. § 2054.4' },
    fiduciaryDuties: { waivability: 'broad', citation: '18 Okla. Stat. § 2002' },
    annualFees: { type: 'annual certificate fee', amount: 25, dueDate: 'anniversary month' },
    notableFeatures: ['Series LLC available', 'Charging order exclusive', 'Broad fiduciary waiver (modeled after Delaware)']
  }),

  // -------- MOUNTAIN / WEST --------
  CO: _buildState('Colorado', {
    llcAct: { shortName: 'Colorado Limited Liability Company Act', citation: 'C.R.S. § 7-80-101 et seq.' },
    chargingOrder: { exclusive: true, citation: 'C.R.S. § 7-80-703' },
    fiduciaryDuties: { waivability: 'partial', citation: 'C.R.S. § 7-80-108' },
    annualFees: { type: 'periodic report', amount: 10, dueDate: 'anniversary month' },
    notableFeatures: ['Very low periodic report fee ($10)', 'Denver/Boulder major commercial RE market', 'Charging order exclusive (2014 statute)']
  }),
  NM: _buildState('New Mexico', {
    llcAct: { shortName: 'New Mexico Limited Liability Company Act', citation: 'NMSA 1978, § 53-19-1 et seq.' },
    chargingOrder: { exclusive: false, citation: 'NMSA § 53-19-35' },
    fiduciaryDuties: { waivability: 'partial', citation: 'NMSA § 53-19-16' },
    annualFees: { type: 'no annual report', amount: 0, dueDate: 'N/A', note: 'New Mexico does not require annual reports for LLCs.' },
    notableFeatures: ['No annual report required', 'No public disclosure of members on Articles of Organization', 'Anonymity advantage similar to Wyoming/Nevada']
  }),
  AZ: _buildState('Arizona', {
    llcAct: { shortName: 'Arizona Limited Liability Company Act', citation: 'A.R.S. § 29-3101 et seq.' },
    chargingOrder: { exclusive: true, citation: 'A.R.S. § 29-3503', foreclosurePermitted: false },
    fiduciaryDuties: { waivability: 'broad', citation: 'A.R.S. § 29-3105' },
    publication: { required: true, citation: 'A.R.S. § 29-3201', provision: 'Within 60 days after the Articles of Organization are filed, the Company must publish notice of formation in a newspaper of general circulation in the county of its known place of business, for three consecutive publications. An Affidavit of Publication must be retained. Publication is not required for LLCs with a statutory agent located in Maricopa or Pima County, where the Arizona Corporation Commission publishes notices on its public website.' },
    annualFees: { type: 'no annual report', amount: 0, dueDate: 'N/A', note: 'Arizona does not require annual reports for LLCs.' },
    notableFeatures: ['<strong>Publication required</strong> under § 29-3201 (in newspaper for 3 weeks; not required in Maricopa or Pima County)', 'No annual report required', 'Charging order exclusive', 'Broad fiduciary waiver', 'Modern statute (2020 revision)']
  }),
  UT: _buildState('Utah', {
    llcAct: { shortName: 'Utah Revised Uniform Limited Liability Company Act', citation: 'Utah Code § 48-3a-101 et seq.' },
    chargingOrder: { exclusive: 'multi-member only', citation: 'Utah Code § 48-3a-503' },
    fiduciaryDuties: { waivability: 'partial', citation: 'Utah Code § 48-3a-409' },
    annualFees: { type: 'annual report fee', amount: 18, dueDate: 'anniversary month' },
    notableFeatures: ['Low annual fee ($18)', 'Charging order exclusive for multi-member LLCs', 'Salt Lake City growing commercial RE market']
  }),
  ID: _buildState('Idaho', {
    llcAct: { shortName: 'Idaho Uniform Limited Liability Company Act', citation: 'Idaho Code § 30-25-101 et seq.' },
    chargingOrder: { exclusive: true, citation: 'Idaho Code § 30-25-503' },
    fiduciaryDuties: { waivability: 'partial', citation: 'Idaho Code § 30-25-409' },
    annualFees: { type: 'annual report', amount: 0, dueDate: 'anniversary month', note: 'Annual report required but no fee.' },
    notableFeatures: ['No annual report fee', 'Charging order exclusive']
  }),
  MT: _buildState('Montana', {
    llcAct: { shortName: 'Montana Limited Liability Company Act', citation: 'Mont. Code Ann. § 35-8-101 et seq.' },
    chargingOrder: { exclusive: true, citation: 'Mont. Code Ann. § 35-8-705' },
    seriesLLC: { available: true, citation: 'Mont. Code Ann. § 35-8-304' },
    fiduciaryDuties: { waivability: 'partial', citation: 'Mont. Code Ann. § 35-8-307' },
    annualFees: { type: 'annual report fee', amount: 20, dueDate: 'April 15' },
    notableFeatures: ['Series LLC available', 'No state sales tax', 'Low annual fee']
  }),
  WA: _buildState('Washington', {
    llcAct: { shortName: 'Washington Limited Liability Company Act', citation: 'RCW ch. 25.15' },
    chargingOrder: { exclusive: true, citation: 'RCW § 25.15.256' },
    fiduciaryDuties: { waivability: 'partial', citation: 'RCW § 25.15.038' },
    annualFees: { type: 'annual report fee', amount: 60, dueDate: 'anniversary month' },
    incTax: { entityLevel: 'B&O Tax', note: 'Washington has no individual income tax but imposes Business & Occupation (B&O) Tax on gross receipts. Capital Gains Tax (7%) on certain gains above threshold.' },
    notableFeatures: ['No individual income tax (B&O Tax instead)', 'Seattle major commercial RE market', 'Charging order exclusive', '7% Capital Gains Tax on gains above threshold (2022)']
  }),
  OR: _buildState('Oregon', {
    llcAct: { shortName: 'Oregon Limited Liability Company Act', citation: 'ORS ch. 63' },
    chargingOrder: { exclusive: false, citation: 'ORS § 63.259' },
    fiduciaryDuties: { waivability: 'partial', citation: 'ORS § 63.155' },
    annualFees: { type: 'annual report fee', amount: 100, dueDate: 'anniversary month' },
    notableFeatures: ['High individual income tax (up to 9.9%)', 'Foreclosure permitted', 'Portland commercial RE market']
  }),

  // -------- PACIFIC / OTHER --------
  AK: _buildState('Alaska', {
    llcAct: { shortName: 'Alaska Revised Limited Liability Company Act', citation: 'Alaska Stat. ch. 10.50' },
    chargingOrder: { exclusive: true, citation: 'Alaska Stat. § 10.50.380', foreclosurePermitted: false },
    fiduciaryDuties: { waivability: 'broad', citation: 'Alaska Stat. § 10.50.135' },
    annualFees: { type: 'biennial report + license', amount: 100, dueDate: 'January 2 (biennial)', note: 'Biennial report $100; business license required.' },
    incTax: { entityLevel: false, note: 'Alaska has no state income tax (individuals or entities) and no statewide sales tax.' },
    notableFeatures: ['No state income tax', 'Strong Alaska Trust Act asset protection', 'Charging order exclusive', 'Broad fiduciary waiver']
  }),
  HI: _buildState('Hawaii', {
    llcAct: { shortName: 'Hawaii Uniform Limited Liability Company Act', citation: 'Haw. Rev. Stat. § 428-101 et seq.' },
    chargingOrder: { exclusive: false, citation: 'Haw. Rev. Stat. § 428-504' },
    fiduciaryDuties: { waivability: 'partial', citation: 'Haw. Rev. Stat. § 428-409' },
    annualFees: { type: 'annual report fee', amount: 15, dueDate: 'end of anniversary quarter' },
    notableFeatures: ['Low annual fee ($15)', 'High individual income tax (up to 11%)', 'Conveyance Tax on real property transfers (0.1%-1.25%)']
  }),

  DC: _buildState('District of Columbia', {
    llcAct: { shortName: 'District of Columbia Uniform Limited Liability Company Act of 2010', citation: 'D.C. Code § 29-801.01 et seq.' },
    chargingOrder: { exclusive: false, citation: 'D.C. Code § 29-806.03' },
    seriesLLC: { available: true, citation: 'D.C. Code § 29-802.06' },
    fiduciaryDuties: { waivability: 'partial', citation: 'D.C. Code § 29-804.09' },
    annualFees: { type: 'biennial report fee', amount: 300, dueDate: 'April 1 (biennial)' },
    notableFeatures: ['Series LLC available', 'Biennial reporting', 'Higher fees than most states ($300 biennial)', 'Federal District jurisdiction']
  })
});



// =============================================================================
// PHASE 8.5: BLOCKER RECOMMENDATION → ENTITY INTEGRATION
//
// Augment generateRecommendations to attach a suggestedEntity payload to each
// blocker-related recommendation, then override renderRecommendations to show
// a "Create Entity from Recommendation" button. Clicking the button adds a
// new entity to DB.entities pre-configured with the recommended state/type.
// =============================================================================

const _phase3GenerateRecommendations = generateRecommendations;
generateRecommendations = function(data, results, p3Data, firpta, ubti) {
  const recs = _phase3GenerateRecommendations(data, results, p3Data, firpta, ubti);

  // Augment recs with suggestedEntity payloads where the recommendation calls for a blocker
  const profiles = p3Data.investorProfiles;
  const dealName = (data.projectName || 'Deal').replace(/[^A-Za-z0-9]+/g, ' ').trim();

  for (const rec of recs) {
    if (rec.suggestedEntity) continue;  // already augmented

    // Foreign individual — suggest foreign C-corp blocker
    if (rec.text.includes('nonresident alien individual') && rec.text.includes('Interpose a foreign corporation')) {
      const matchName = rec.text.match(/<strong>([^:]+):/);
      const investorName = matchName ? matchName[1] : 'Foreign Individual';
      rec.suggestedEntity = {
        proposedName: `${dealName} Foreign Blocker Ltd.`,
        type: 'Foreign Entity',
        state: 'other',
        role: 'blocker',
        rationale: `Foreign C-corporation to insulate ${investorName} from U.S. estate tax exposure on direct USRPI holdings. Common jurisdictions: BVI, Cayman, Bermuda. Consider netting with FIRPTA analysis.`,
        generateOpAg: false
      };
      rec.actionLabel = 'Add Foreign Blocker to Structure';
    }
    // Foreign SWF without blocker — suggest REIT or domestic C-corp blocker
    else if (rec.text.includes('sovereign wealth fund') && rec.text.includes('REIT or corporate blocker')) {
      rec.suggestedEntity = {
        proposedName: `${dealName} REIT Blocker Inc.`,
        type: 'C-Corp',
        state: 'MD',
        role: 'blocker',
        rationale: 'Maryland C-corporation electing REIT status under § 856. Maryland is the dominant REIT jurisdiction for governance and statute familiarity. Insulates the SWF from § 892(a)(2)(B) controlled-commercial-entity risk.',
        generateOpAg: false
      };
      rec.actionLabel = 'Add Maryland REIT Blocker to Structure';
    }
    // U.S. tax-exempt with no §514(c)(9) — suggest C-corp blocker
    else if (rec.text.includes('tax-exempt in leveraged real estate') && rec.text.includes('U.S. C-corp blocker')) {
      rec.suggestedEntity = {
        proposedName: `${dealName} UBTI Blocker Inc.`,
        type: 'C-Corp',
        state: 'DE',
        role: 'blocker',
        rationale: 'Delaware C-corporation to convert UDFI exposure into corporate-level income (non-passing-through to the tax-exempt). Loss of 21% federal corporate tax must be weighed against the 37%/21%-bracketed UBIT/UDFI savings.',
        generateOpAg: false
      };
      rec.actionLabel = 'Add UBTI Blocker to Structure';
    }
    // Foreign corporation directly in partnership — suggest domestic C-corp blocker
    else if (rec.text.includes('foreign corporation') && rec.text.includes('domestic C-corp blocker')) {
      rec.suggestedEntity = {
        proposedName: `${dealName} ECI Blocker Inc.`,
        type: 'C-Corp',
        state: 'DE',
        role: 'blocker',
        rationale: 'Delaware C-corporation to absorb ECI and § 1446(f) withholding, providing the foreign corporate investor with cleaner U.S. tax exposure (single layer of 21% corporate tax + 30% dividend WH or treaty-reduced rate).',
        generateOpAg: false
      };
      rec.actionLabel = 'Add Domestic ECI Blocker to Structure';
    }
  }

  return recs;
};

// Override renderRecommendations to show action buttons
const _phase3RenderRecommendations = renderRecommendations;
renderRecommendations = function(results) {
  const target = document.getElementById('structural_recommendations');
  if (!target) return;
  let html = '';
  for (let i = 0; i < results.recommendations.length; i++) {
    const rec = results.recommendations[i];
    const cls = rec.type === 'critical' ? 'note-critical' :
                rec.type === 'flag' ? 'note-flag' : 'note-recommend';
    html += `<div class="note-item ${cls}">${rec.text}`;
    if (rec.suggestedEntity) {
      const se = rec.suggestedEntity;
      const sl = STATE_LAW_DATA[se.state];
      html += `
        <div class="rec-entity-suggestion" style="margin-top:0.85rem;padding:0.75rem 1rem;background:rgba(22,155,98,0.06);border-left:3px solid #169B62;">
          <p style="margin:0 0 0.5rem 0;font-size:0.88rem;"><strong>Suggested Entity:</strong> <em>${escapeHtml(se.proposedName)}</em> — ${escapeHtml(se.type)} ${escapeHtml(sl?.name || se.state)} (${escapeHtml(ENTITY_ROLES[se.role]?.label || se.role)})</p>
          <p style="margin:0 0 0.65rem 0;font-size:0.82rem;color:#4a4a4a;">${escapeHtml(se.rationale)}</p>
          <button class="btn-add-suggested-entity" data-rec-idx="${i}" type="button" style="background:#169B62;color:#FFFFFF;border:none;padding:0.4rem 0.9rem;font-family:'Gotham Bold',sans-serif;font-size:0.78rem;letter-spacing:1px;text-transform:uppercase;cursor:pointer;">
            + ${escapeHtml(rec.actionLabel || 'Add to Entity Structure')}
          </button>
        </div>`;
    }
    html += `</div>`;
  }
  if (!html) html = '<p style="color:#6b6b6b;font-style:italic;">No structural recommendations at this configuration.</p>';
  target.innerHTML = html;

  // Wire action buttons
  target.querySelectorAll('.btn-add-suggested-entity').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.target.dataset.recIdx, 10);
      const rec = results.recommendations[idx];
      if (!rec || !rec.suggestedEntity) return;
      const se = rec.suggestedEntity;

      // Find parent — default to the Issuer entity
      const issuer = getIssuerEntity();
      const newEntity = {
        id: DB.nextEntityId++,
        name: se.proposedName,
        type: se.type,
        state: se.state,
        role: se.role,
        parentId: issuer ? issuer.id : null,
        formationDate: '',
        address: issuer ? issuer.address : '',
        ein: '',
        securities: '',
        isIssuer: false,
        generateOpAg: se.generateOpAg
      };
      DB.entities.push(newEntity);

      // Re-render entity views
      renderEntities();
      renderEntityTreePreview();
      renderSignatories();
      deriveLegacyIssuerSponsor();

      // Visual feedback
      btn.textContent = '✓ Added — see Step 10';
      btn.disabled = true;
      btn.style.background = '#6b6b6b';
      btn.style.cursor = 'default';

      // Scroll to Step 10 if visible, or notify
      const step10 = document.getElementById('step-10');
      if (step10) {
        const banner = document.createElement('div');
        banner.style.cssText = 'position:fixed;top:20px;right:20px;background:#169B62;color:#FFFFFF;padding:0.85rem 1.25rem;font-family:Open Sans,sans-serif;font-size:0.88rem;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:9999;';
        banner.textContent = `Added "${se.proposedName}" to Entity Structure (Step 10).`;
        document.body.appendChild(banner);
        setTimeout(() => banner.remove(), 4000);
      }
    });
  });
};

// =============================================================================
// PHASE 8.5: NEW YORK §206 PUBLICATION COMPLIANCE GENERATOR
// =============================================================================
function generateNYPublicationCompliance(p7, dealData, nyEntity, sectionNum) {
  if (!nyEntity || nyEntity.state !== 'NY') return '';
  const sl = STATE_LAW_DATA.NY;
  const formationDate = nyEntity.formationDate || '[Formation Date]';
  const today = todayLong();

  // Compute publication deadline (120 days from formation)
  let deadlineStr = '[Formation Date + 120 days]';
  const fdMatch = formationDate.match(/(\d{4})/);
  if (fdMatch) {
    // Best effort: parse a date if possible
    try {
      const dt = new Date(formationDate);
      if (!isNaN(dt.getTime())) {
        dt.setDate(dt.getDate() + 120);
        deadlineStr = dt.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
      }
    } catch (e) {}
  }

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">${sectionNum}. NEW YORK §206 PUBLICATION COMPLIANCE</h2>
  <p class="pkg-doc-subtitle">${entityShortName(nyEntity)} — Compliance with N.Y. LLC Law § 206</p>

  <h3 class="pkg-article">A. Statutory Requirement</h3>
  <p>${sl.publication.provision}</p>

  <h3 class="pkg-article">B. Compliance Checklist</h3>
  <table class="pkg-table">
    <thead><tr><th>Step</th><th>Action</th><th>Deadline</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td>1</td><td>Confirm the county in which the Company's office is located</td><td>Upon formation</td><td>☐</td></tr>
      <tr><td>2</td><td>Contact the County Clerk to obtain the designated newspapers (one daily, one weekly)</td><td>Within 30 days of formation</td><td>☐</td></tr>
      <tr><td>3</td><td>Submit notice text to the designated newspapers for six consecutive weeks of publication</td><td>Within 60 days of formation</td><td>☐</td></tr>
      <tr><td>4</td><td>Obtain Affidavits of Publication from both newspapers</td><td>Upon completion of 6-week run</td><td>☐</td></tr>
      <tr><td>5</td><td>File Certificate of Publication with N.Y. Department of State</td><td><strong>By ${escapeHtml(deadlineStr)}</strong> (120 days from formation)</td><td>☐</td></tr>
      <tr><td>6</td><td>Pay Certificate of Publication filing fee ($50) and retain DOS-stamped copy in corporate book</td><td>At time of filing</td><td>☐</td></tr>
    </tbody>
  </table>
  <p><strong>Penalty for Non-Compliance.</strong> Failure to timely complete publication and file the Certificate of Publication results in <strong>suspension of the Company's authority to do business in New York</strong>, including the ability to maintain an action in New York courts, until publication is completed. Publication may be made at any time, even after the 120-day deadline.</p>

  <h3 class="pkg-article">C. Notice of Formation — Required Content</h3>
  <p>The notice to be published in the designated newspapers must contain the following information (substantially in the following format):</p>
  <div style="margin:1rem 0;padding:1.25rem;background:#fafaf5;border:1px solid #d4d4d0;font-family:Georgia,serif;">
    <p style="margin:0 0 0.85rem 0;text-align:center;"><strong>NOTICE OF FORMATION OF LIMITED LIABILITY COMPANY</strong></p>
    <p style="margin:0;"><strong>Notice of formation of ${entityShortName(nyEntity)}</strong> (the "LLC"). Articles of Organization filed with the Secretary of State of New York (SSNY) on ${escapeHtml(formationDate)}. Office located in [_____________] County. SSNY designated as agent of LLC upon whom process against it may be served. SSNY shall mail process to the LLC at ${escapeHtml(nyEntity.address || '[Principal Office Address]')}. Purpose: any lawful business activity.</p>
  </div>
  <p><em>Note:</em> The notice must run unchanged for six consecutive weeks. Any variation between the published notice and the Articles of Organization (including in the LLC name, county, address, or purpose statement) may invalidate the publication.</p>

  <h3 class="pkg-article">D. Certificate of Publication — Filing Instructions</h3>
  <p>Upon completion of the six-week publication run, file the Certificate of Publication with:</p>
  <div style="margin:1rem 0;padding:1rem 1.25rem;background:#fafaf5;border-left:3px solid #1a1a1a;">
    <p style="margin:0;font-family:Open Sans,sans-serif;">
      <strong>New York Department of State</strong><br>
      Division of Corporations<br>
      One Commerce Plaza<br>
      99 Washington Avenue<br>
      Albany, NY 12231<br>
      <em>Filing fee: $50.00 (check payable to "Department of State")</em>
    </p>
  </div>
  <p>Include with the Certificate of Publication: (i) an original or certified copy of each Affidavit of Publication (one daily newspaper, one weekly newspaper); and (ii) the $50 filing fee. The DOS will return a stamped, filed copy as confirmation. Retain the stamped copy permanently in the LLC's records.</p>

  <h3 class="pkg-article">E. Estimated Cost</h3>
  <table class="pkg-table">
    <thead><tr><th>Cost Item</th><th>Estimated Range</th></tr></thead>
    <tbody>
      <tr><td>Daily newspaper publication (6 weeks)</td><td>$500 – $1,500 (New York County) / $100 – $400 (other counties)</td></tr>
      <tr><td>Weekly newspaper publication (6 weeks)</td><td>$100 – $300</td></tr>
      <tr><td>Certificate of Publication filing fee</td><td>$50</td></tr>
      <tr><td><strong>Total estimated cost</strong></td><td><strong>$650 – $1,850 (New York County) / $250 – $750 (other counties)</strong></td></tr>
    </tbody>
  </table>
  <p style="margin-top:1rem;"><em>Document prepared ${escapeHtml(today)} for ${entityShortName(nyEntity)}. The deadlines computed in this document assume the formation date entered in the tool; verify against the Articles of Organization as filed.</em></p>
</div>
`;
}

// =============================================================================
// PHASE 8.5: INSERT NY PUBLICATION DOC INTO PACKAGE
// =============================================================================
const _phase8GenerateDealPackagePre85 = generateDealPackage;
generateDealPackage = function() {
  // Run the Phase 8 package generator with a captured-output trick: temporarily override window.open
  const origOpen = window.open;
  let capturedHtml = '';
  window.open = function() {
    return {
      document: {
        write: html => { capturedHtml = html; },
        close: () => {}
      }
    };
  };
  _phase8GenerateDealPackagePre85();
  window.open = origOpen;
  if (!capturedHtml) return;  // validation likely failed

  // Inject NY publication compliance docs for each NY entity in the structure
  const p7 = collectPhase7Data();
  const nyEntities = p7.entities.filter(e => e.state === 'NY');
  if (nyEntities.length > 0) {
    // Compute next section number: count existing sections
    const sectionTitles = capturedHtml.match(/<h2 class="pkg-doc-title">(\d+)\./g) || [];
    let maxSection = 0;
    for (const t of sectionTitles) {
      const m = t.match(/(\d+)\./);
      if (m) maxSection = Math.max(maxSection, parseInt(m[1], 10));
    }
    let nextSection = maxSection + 1;

    let nyDocs = '';
    for (const ne of nyEntities) {
      nyDocs += generateNYPublicationCompliance(p7, collectFormData(), ne, nextSection++);
    }

    // Insert NY docs before the closing </div>'s
    const insertPoint = capturedHtml.lastIndexOf('</div>\n  <div class="pkg-footer">');
    if (insertPoint !== -1) {
      capturedHtml = capturedHtml.substring(0, insertPoint) + nyDocs + capturedHtml.substring(insertPoint);
    } else {
      // Fallback: append before </body>
      const bodyClose = capturedHtml.lastIndexOf('</body>');
      if (bodyClose !== -1) {
        capturedHtml = capturedHtml.substring(0, bodyClose) + nyDocs + capturedHtml.substring(bodyClose);
      }
    }
  }

  // Now open the (potentially augmented) package
  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(capturedHtml);
    newWindow.document.close();
  } else {
    alert('Pop-up blocked. Please allow pop-ups for this page to view the deal package.');
  }
};



// =============================================================================
// =============================================================================
//          PHASE 8.6 — INPUT FORMATTING (REBUILT)
//
//  Currency inputs display as $1,500,000 on blur, raw digits on focus.
//  Percentage inputs display as 10.00% on blur, raw digits on focus.
//  Raw value is stored in input.dataset.rawValue.
//  All read sites (v helpers and parseFloat patterns) strip $,% formatting.
// =============================================================================
// =============================================================================

function stripFmt(value) {
  if (value === null || value === undefined || value === '') return '';
  return String(value).replace(/[\$,\s%]/g, '').trim();
}

function formatCurrency(value) {
  const raw = stripFmt(value);
  if (raw === '' || raw === '-') return '';
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  return '$' + num.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatPercent(value) {
  const raw = stripFmt(value);
  if (raw === '' || raw === '-') return '';
  const num = parseFloat(raw);
  if (isNaN(num)) return raw;
  return num.toFixed(2) + '%';
}

const CURRENCY_INPUT_PATTERNS = [
  /^senior_loan$/, /^exit_price$/, /^disp_other$/, /^fee_other$/,
  /^budget_/, /^ovl_163j_(gross_receipts|ati|total_interest)$/,
  /^ovl_461l_(other_income|existing_nol|threshold_override)$/,
  /^ovl_199a_(w2_wages|ubia)$/
];

const PERCENT_INPUT_PATTERNS = [
  /^senior_rate$/, /^senior_avg_balance$/, /^disp_commission$/, /^disp_stamps$/,
  /^pref_rate$/, /^clawback_threshold$/,
  /^fee_(acquisition|development|cm|disposition|asset_mgmt)$/,
  /^member_(fed_rate|ltcg_rate|1250_rate)$/
];

const CURRENCY_CLASS_PATTERNS = ['mc-capital', 'mc-carry', 'md-amount', 'inv-capital'];
const PERCENT_CLASS_PATTERNS = ['mc-pref', 'md-rate', 'tier-threshold', 'tier-lp', 'tier-sp'];

// Dynamic inputs use data-field attribute instead of class/id
const CURRENCY_DATA_FIELDS = new Set(['capital', 'amount', 'carry']);
const PERCENT_DATA_FIELDS = new Set(['prefRate', 'rate', 'threshold', 'lpPct', 'spPct']);

function applyCurrencyFormatting(input) {
  if (!input || input._fmtInstalled) return;
  input._fmtInstalled = true;
  input.type = 'text';
  input.setAttribute('inputmode', 'decimal');
  input.classList.add('db-fmt-currency');

  // Format initial value
  const initialRaw = stripFmt(input.value);
  input.dataset.rawValue = initialRaw;
  if (initialRaw !== '' && !isNaN(parseFloat(initialRaw))) {
    input.value = formatCurrency(initialRaw);
  }

  input.addEventListener('focus', () => {
    const raw = stripFmt(input.value);
    input.dataset.rawValue = raw;
    input.value = raw;
    requestAnimationFrame(() => input.select?.());
  });

  input.addEventListener('blur', () => {
    const raw = stripFmt(input.value);
    input.dataset.rawValue = raw;
    if (raw !== '' && !isNaN(parseFloat(raw))) {
      input.value = formatCurrency(raw);
    } else {
      input.value = '';
    }
  });

  input.addEventListener('input', () => {
    input.dataset.rawValue = stripFmt(input.value);
  });
}

function applyPercentFormatting(input) {
  if (!input || input._fmtInstalled) return;
  input._fmtInstalled = true;
  input.type = 'text';
  input.setAttribute('inputmode', 'decimal');
  input.classList.add('db-fmt-percent');

  const initialRaw = stripFmt(input.value);
  input.dataset.rawValue = initialRaw;
  if (initialRaw !== '' && !isNaN(parseFloat(initialRaw))) {
    input.value = formatPercent(initialRaw);
  }

  input.addEventListener('focus', () => {
    const raw = stripFmt(input.value);
    input.dataset.rawValue = raw;
    input.value = raw;
    requestAnimationFrame(() => input.select?.());
  });

  input.addEventListener('blur', () => {
    const raw = stripFmt(input.value);
    input.dataset.rawValue = raw;
    if (raw !== '' && !isNaN(parseFloat(raw))) {
      input.value = formatPercent(raw);
    } else {
      input.value = '';
    }
  });

  input.addEventListener('input', () => {
    input.dataset.rawValue = stripFmt(input.value);
  });
}

function shouldFormatAsCurrency(input) {
  const id = input.id || '';
  if (CURRENCY_INPUT_PATTERNS.some(re => re.test(id))) return true;
  if (CURRENCY_CLASS_PATTERNS.some(c => input.classList.contains(c))) return true;
  const df = input.dataset?.field || input.getAttribute?.('data-field');
  if (df && CURRENCY_DATA_FIELDS.has(df)) return true;
  return false;
}

function shouldFormatAsPercent(input) {
  const id = input.id || '';
  if (PERCENT_INPUT_PATTERNS.some(re => re.test(id))) return true;
  if (PERCENT_CLASS_PATTERNS.some(c => input.classList.contains(c))) return true;
  const df = input.dataset?.field || input.getAttribute?.('data-field');
  if (df && PERCENT_DATA_FIELDS.has(df)) return true;
  return false;
}

function applyFormattingToAllInputs() {
  document.querySelectorAll('input').forEach(input => {
    if (shouldFormatAsCurrency(input)) {
      applyCurrencyFormatting(input);
    } else if (shouldFormatAsPercent(input)) {
      applyPercentFormatting(input);
    }
  });
}

function watchForNewInputs() {
  if (!window.MutationObserver) return;
  const observer = new MutationObserver(mutations => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (node.nodeType !== 1) continue;
        const inputs = [];
        if (node.tagName === 'INPUT') inputs.push(node);
        if (node.querySelectorAll) {
          for (const el of node.querySelectorAll('input')) inputs.push(el);
        }
        for (const input of inputs) {
          if (input._fmtInstalled) continue;
          if (shouldFormatAsCurrency(input)) applyCurrencyFormatting(input);
          else if (shouldFormatAsPercent(input)) applyPercentFormatting(input);
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

document.addEventListener('DOMContentLoaded', () => {
  applyFormattingToAllInputs();
  watchForNewInputs();
});


// =============================================================================
// PHASE 8.6 — STARTER SCENARIOS
// Six representative deal structures with realistic industry-standard values.
// Loading a scenario pre-populates the form; all values are editable.
// =============================================================================

const STARTER_SCENARIOS = {

  // ---------------------------------------------------------------------------
  // 0. Small Operating-Member JV (No Reg D Filing)
  // ---------------------------------------------------------------------------
  small_jv_no_reg_d: {
    label: 'Small Operating-Member JV (No Reg D)',
    description: 'A small joint venture among 3-5 operating members with pre-existing substantive business or personal relationships, each actively participating in management. Member interests are not "securities" under Howey because each Member retains voting rights on Major Decisions and the Manager is not unique/irreplaceable. Total capital under $2M; FL-formed LLC.',
    formInputs: {
      project_name: '[Project Name] JV LLC',
      deal_type: 'operating_llc',
      property_state: 'FL',
      property_location: '[City, FL]',
      hold_months: 36,
      senior_loan: 800000,
      senior_rate: 7,
      senior_avg_balance: 85,
      senior_752: 'qualified_nonrecourse',
      budget_land: 1500000,
      budget_building: 600000,
      budget_hard: 0,
      budget_contingency: 30000,
      budget_soft: 50000,
      budget_dev_fees: 20000,
      budget_interest: 90000,
      budget_tax_ins: 25000,
      budget_marketing: 5000,
      budget_other: 10000,
      exit_price: 2800000,
      disp_commission: 5,
      disp_stamps: 0.7,
      disp_other: 10000,
      pref_rate: 8,
      waterfall_style: 'American',
      catchup_style: 'none',
      clawback_type: 'none',
      clawback_threshold: 0,
      guarantor_pg: 'no',
      fee_acquisition: 0,
      fee_development: 1,
      fee_cm: 0,
      fee_disposition: 1,
      fee_asset_mgmt: 0,
      member_fed_rate: 37,
      member_ltcg_rate: 20,
      member_1250_rate: 25
    },
    memberClasses: [
      { name: 'Operating Members', classType: 'lp', capital: 1500000, prefRate: 0.08, prefType: 'cumulative_non_compound', prefPriority: 'pari_passu' },
      { name: 'Sponsor / Manager', classType: 'sponsor', capital: 0, prefRate: 0, prefType: 'cumulative_non_compound', prefPriority: 'pari_passu' }
    ],
    promoteTiers: [
      { hurdle: '8% Pref', threshold: 8, metric: 'irr', lpPct: 0.8, spPct: 0.2 }
    ],
    entities: [
      { name: '[Project] JV LLC', type: 'LLC', state: 'FL', role: 'issuer', parentId: null, formationDate: '', address: '', ein: '', securities: 'Membership Interests', isIssuer: true, generateOpAg: true }
    ],
    securitiesLevel: 'level_0_no_reg_d'
  },

  // ---------------------------------------------------------------------------
  // 1. Single-Family Spec Build (FL) — small joint venture
  // ---------------------------------------------------------------------------
  sf_spec_build_fl: {
    label: 'Single-Family Spec Build (FL)',
    description: 'A short-hold ground-up single-family residential project in Florida, sponsor-driven with 2–4 friends-and-family LPs and a senior construction loan. Typical of upper-bracket spec building in coastal Florida markets. Total project cost ~$4.5M; ARV target ~$5.5M; 18-month hold.',
    formInputs: {
      project_name: '[Property Address] Spec Build LLC',
      deal_type: 'joint_venture',
      property_state: 'FL',
      property_location: '[City, FL]',
      hold_months: 18,
      senior_loan: 2000000,
      senior_rate: 7.5,
      senior_avg_balance: 75,
      senior_752: 'qualified_nonrecourse',
      budget_land: 1500000,
      budget_building: 0,
      budget_hard: 1500000,
      budget_contingency: 100000,
      budget_soft: 100000,
      budget_dev_fees: 60000,
      budget_interest: 175000,
      budget_tax_ins: 30000,
      budget_marketing: 15000,
      budget_other: 20000,
      exit_price: 5500000,
      disp_commission: 5,
      disp_stamps: 0.7,
      disp_other: 15000,
      pref_rate: 8,
      waterfall_style: 'American',
      catchup_style: 'none',
      clawback_type: 'lookback',
      clawback_threshold: 10,
      guarantor_pg: 'yes',
      fee_acquisition: 0,
      fee_development: 2,
      fee_cm: 5,
      fee_disposition: 1,
      fee_asset_mgmt: 0,
      member_fed_rate: 37,
      member_ltcg_rate: 20,
      member_1250_rate: 25
    },
    memberClasses: [
      { name: 'Class A LP', classType: 'lp', capital: 500000, prefRate: 0.08, prefType: 'cumulative_non_compound', prefPriority: 'pari_passu' },
      { name: 'Sponsor', classType: 'sponsor', capital: 0, prefRate: 0, prefType: 'cumulative_non_compound', prefPriority: 'pari_passu' }
    ],
    promoteTiers: [
      { hurdle: '8% Pref', threshold: 8, metric: 'irr', lpPct: 0.8, spPct: 0.2 },
      { hurdle: '18% IRR', threshold: 18, metric: 'irr', lpPct: 0.7, spPct: 0.3 }
    ],
    entities: [
      { name: '[Project] Owner LLC', type: 'LLC', state: 'FL', role: 'issuer', parentId: null, formationDate: '', address: '', ein: '', securities: 'Class A Membership Interests', isIssuer: true, generateOpAg: true }
    ],
    securitiesLevel: 'level_1_ff'
  },

  // ---------------------------------------------------------------------------
  // 2. Multifamily Value-Add Joint Venture (Southeast)
  // ---------------------------------------------------------------------------
  multifamily_value_add: {
    label: 'Multifamily Value-Add JV (Southeast)',
    description: 'Mid-size value-add multifamily acquisition with renovation budget in a Southeast metro. Two LP classes (standard pref + A-2 with personal guaranty), 5-year hold. Two-tier entity structure with a Delaware Holdco above the state Opco for governance flexibility, taken out via stabilization-driven refi or sale.',
    formInputs: {
      project_name: '[Asset] Multifamily Value-Add LLC',
      deal_type: 'joint_venture',
      property_state: 'GA',
      property_location: '[City, GA]',
      hold_months: 60,
      senior_loan: 14000000,
      senior_rate: 6.75,
      senior_avg_balance: 95,
      senior_752: 'qualified_nonrecourse',
      budget_land: 15000000,
      budget_building: 0,
      budget_hard: 3000000,
      budget_contingency: 250000,
      budget_soft: 350000,
      budget_dev_fees: 400000,
      budget_interest: 2200000,
      budget_tax_ins: 350000,
      budget_marketing: 50000,
      budget_other: 100000,
      exit_price: 30000000,
      disp_commission: 2.5,
      disp_stamps: 0,
      disp_other: 75000,
      pref_rate: 9,
      waterfall_style: 'American',
      catchup_style: 'none',
      clawback_type: 'lookback',
      clawback_threshold: 12,
      guarantor_pg: 'yes',
      fee_acquisition: 1,
      fee_development: 2,
      fee_cm: 4,
      fee_disposition: 1,
      fee_asset_mgmt: 0.5,
      member_fed_rate: 37,
      member_ltcg_rate: 20,
      member_1250_rate: 25
    },
    memberClasses: [
      { name: 'Class A LP', classType: 'lp', capital: 5000000, prefRate: 0.09, prefType: 'cumulative_non_compound', prefPriority: 'pari_passu' },
      { name: 'Class A-2 LP (Guarantor)', classType: 'lp_guarantor', capital: 1000000, prefRate: 0.11, prefType: 'cumulative_non_compound', prefPriority: 'priority' },
      { name: 'Sponsor', classType: 'sponsor', capital: 0, prefRate: 0, prefType: 'cumulative_non_compound', prefPriority: 'pari_passu' }
    ],
    promoteTiers: [
      { hurdle: '9% Pref', threshold: 9, metric: 'irr', lpPct: 0.8, spPct: 0.2 },
      { hurdle: '14% IRR', threshold: 14, metric: 'irr', lpPct: 0.7, spPct: 0.3 },
      { hurdle: '20% IRR', threshold: 20, metric: 'irr', lpPct: 0.6, spPct: 0.4 }
    ],
    entities: [
      { name: '[Project] Holdings LLC', type: 'LLC', state: 'DE', role: 'holdco', parentId: null, formationDate: '', address: '', ein: '', securities: '', isIssuer: false, generateOpAg: true },
      { name: '[Project] Owner LLC', type: 'LLC', state: 'GA', role: 'property_opco', parentId: 1, formationDate: '', address: '', ein: '', securities: 'Class A Membership Interests', isIssuer: true, generateOpAg: true }
    ],
    securitiesLevel: 'level_2_soph'
  },

  // ---------------------------------------------------------------------------
  // 3. Ground-Up Multifamily Development (multi-tier)
  // ---------------------------------------------------------------------------
  groundup_multifamily_dev: {
    label: 'Ground-Up Multifamily Development',
    description: 'Large-scale ground-up multifamily development with senior construction debt, multi-class equity, and multi-tier sponsor entity structure (Wyoming Sponsor → Delaware Holdco → Property Opco). Sized for 200–300 units; total project cost ~$60M; exit at stabilization (~5 years).',
    formInputs: {
      project_name: '[Project Name] Multifamily Development LLC',
      deal_type: 'joint_venture',
      property_state: 'TX',
      property_location: '[City, TX]',
      hold_months: 60,
      senior_loan: 42000000,
      senior_rate: 7.25,
      senior_avg_balance: 70,
      senior_752: 'qualified_nonrecourse',
      budget_land: 9000000,
      budget_building: 0,
      budget_hard: 38000000,
      budget_contingency: 2000000,
      budget_soft: 4500000,
      budget_dev_fees: 1200000,
      budget_interest: 4200000,
      budget_tax_ins: 850000,
      budget_marketing: 150000,
      budget_other: 200000,
      exit_price: 78000000,
      disp_commission: 2,
      disp_stamps: 0,
      disp_other: 150000,
      pref_rate: 10,
      waterfall_style: 'American',
      catchup_style: 'none',
      clawback_type: 'lookback',
      clawback_threshold: 12,
      guarantor_pg: 'yes',
      fee_acquisition: 1,
      fee_development: 3,
      fee_cm: 4,
      fee_disposition: 1,
      fee_asset_mgmt: 1,
      member_fed_rate: 37,
      member_ltcg_rate: 20,
      member_1250_rate: 25
    },
    memberClasses: [
      { name: 'Class A LP', classType: 'lp', capital: 18000000, prefRate: 0.10, prefType: 'cumulative_non_compound', prefPriority: 'pari_passu' },
      { name: 'Sponsor', classType: 'sponsor', capital: 2000000, prefRate: 0.10, prefType: 'cumulative_non_compound', prefPriority: 'pari_passu' }
    ],
    promoteTiers: [
      { hurdle: '10% Pref', threshold: 10, metric: 'irr', lpPct: 0.75, spPct: 0.25 },
      { hurdle: '15% IRR', threshold: 15, metric: 'irr', lpPct: 0.65, spPct: 0.35 },
      { hurdle: '22% IRR', threshold: 22, metric: 'irr', lpPct: 0.50, spPct: 0.50 }
    ],
    entities: [
      { name: '[Sponsor] Capital Management LLC', type: 'LLC', state: 'WY', role: 'sponsor', parentId: null, formationDate: '', address: '', ein: '', securities: '', isIssuer: false, generateOpAg: true },
      { name: '[Project] Holdings LLC', type: 'LLC', state: 'DE', role: 'holdco', parentId: 1, formationDate: '', address: '', ein: '', securities: '', isIssuer: false, generateOpAg: true },
      { name: '[Project] Owner LLC', type: 'LLC', state: 'TX', role: 'property_opco', parentId: 2, formationDate: '', address: '', ein: '', securities: 'Class A Membership Interests', isIssuer: true, generateOpAg: true }
    ],
    securitiesLevel: 'level_2_soph'
  },

  // ---------------------------------------------------------------------------
  // 4. Opportunity Zone Multifamily
  // ---------------------------------------------------------------------------
  opportunity_zone: {
    label: 'Opportunity Zone Multifamily (QOF + QOZB)',
    description: 'QOZ-compliant multifamily development. 10-year hold to achieve § 1400Z-2(c) basis step-up to FMV at exit. Two-entity structure: QOF (Qualified Opportunity Fund) holds 100% of QOZB (Qualified Opportunity Zone Business) where the property is held. Investors contribute deferred capital gains.',
    formInputs: {
      project_name: '[Project Name] QOF LLC',
      deal_type: 'qof',
      property_state: 'FL',
      property_location: '[OZ Census Tract, City]',
      hold_months: 120,
      senior_loan: 20000000,
      senior_rate: 7,
      senior_avg_balance: 75,
      senior_752: 'qualified_nonrecourse',
      budget_land: 5000000,
      budget_building: 0,
      budget_hard: 15000000,
      budget_contingency: 1000000,
      budget_soft: 2000000,
      budget_dev_fees: 500000,
      budget_interest: 1750000,
      budget_tax_ins: 400000,
      budget_marketing: 50000,
      budget_other: 100000,
      exit_price: 50000000,
      disp_commission: 2,
      disp_stamps: 0.7,
      disp_other: 100000,
      pref_rate: 8,
      waterfall_style: 'American',
      catchup_style: 'none',
      clawback_type: 'lookback',
      clawback_threshold: 10,
      guarantor_pg: 'yes',
      fee_acquisition: 0,
      fee_development: 2.5,
      fee_cm: 4,
      fee_disposition: 1,
      fee_asset_mgmt: 1,
      member_fed_rate: 37,
      member_ltcg_rate: 20,
      member_1250_rate: 25
    },
    memberClasses: [
      { name: 'QOF Investors (Deferred Gain Capital)', classType: 'lp', capital: 8000000, prefRate: 0.08, prefType: 'cumulative_non_compound', prefPriority: 'pari_passu' },
      { name: 'Sponsor', classType: 'sponsor', capital: 0, prefRate: 0, prefType: 'cumulative_non_compound', prefPriority: 'pari_passu' }
    ],
    promoteTiers: [
      { hurdle: '8% Pref', threshold: 8, metric: 'irr', lpPct: 0.8, spPct: 0.2 },
      { hurdle: '13% IRR', threshold: 13, metric: 'irr', lpPct: 0.7, spPct: 0.3 },
      { hurdle: '18% IRR', threshold: 18, metric: 'irr', lpPct: 0.6, spPct: 0.4 }
    ],
    entities: [
      { name: '[Project] QOF LLC', type: 'LLC', state: 'DE', role: 'issuer', parentId: null, formationDate: '', address: '', ein: '', securities: 'Class A Membership Interests', isIssuer: true, generateOpAg: true },
      { name: '[Project] QOZB LLC', type: 'LLC', state: 'FL', role: 'property_opco', parentId: 1, formationDate: '', address: '', ein: '', securities: '', isIssuer: false, generateOpAg: true }
    ],
    securitiesLevel: 'level_2_soph'
  },

  // ---------------------------------------------------------------------------
  // 5. Friends & Family Single-Asset (506(b) F&F)
  // ---------------------------------------------------------------------------
  friends_family: {
    label: 'Friends & Family Single-Asset (506(b) F&F)',
    description: 'Small single-asset acquisition or short-hold development with 4–8 friends-and-family investors. Lean F&F-level 506(b) documentation (Risk Disclosure Letter in lieu of PPM). 24-month hold; assumes existing pre-existing substantive relationships with all investors; no general solicitation.',
    formInputs: {
      project_name: '[Asset Name] LLC',
      deal_type: 'operating_llc',
      property_state: 'FL',
      property_location: '[City, FL]',
      hold_months: 24,
      senior_loan: 1100000,
      senior_rate: 7,
      senior_avg_balance: 85,
      senior_752: 'qualified_nonrecourse',
      budget_land: 1200000,
      budget_building: 600000,
      budget_hard: 0,
      budget_contingency: 30000,
      budget_soft: 35000,
      budget_dev_fees: 20000,
      budget_interest: 90000,
      budget_tax_ins: 18000,
      budget_marketing: 5000,
      budget_other: 12000,
      exit_price: 2400000,
      disp_commission: 5,
      disp_stamps: 0.7,
      disp_other: 10000,
      pref_rate: 8,
      waterfall_style: 'American',
      catchup_style: 'none',
      clawback_type: 'none',
      clawback_threshold: 0,
      guarantor_pg: 'no',
      fee_acquisition: 0,
      fee_development: 1,
      fee_cm: 0,
      fee_disposition: 1,
      fee_asset_mgmt: 0,
      member_fed_rate: 37,
      member_ltcg_rate: 20,
      member_1250_rate: 25
    },
    memberClasses: [
      { name: 'F&F LP', classType: 'lp', capital: 800000, prefRate: 0.08, prefType: 'cumulative_non_compound', prefPriority: 'pari_passu' },
      { name: 'Sponsor', classType: 'sponsor', capital: 0, prefRate: 0, prefType: 'cumulative_non_compound', prefPriority: 'pari_passu' }
    ],
    promoteTiers: [
      { hurdle: '8% Pref', threshold: 8, metric: 'irr', lpPct: 0.8, spPct: 0.2 }
    ],
    entities: [
      { name: '[Asset] Owner LLC', type: 'LLC', state: 'FL', role: 'issuer', parentId: null, formationDate: '', address: '', ein: '', securities: 'Membership Interests', isIssuer: true, generateOpAg: true }
    ],
    securitiesLevel: 'level_1_ff'
  },

  // ---------------------------------------------------------------------------
  // 6. Institutional Fund — Master-Feeder with Foreign Investor Blocker (506(c))
  // ---------------------------------------------------------------------------
  institutional_fund: {
    label: 'Institutional Fund — Master-Feeder w/ Blocker (506(c))',
    description: 'Multi-asset institutional commingled fund with both US-taxable and offshore investor classes. Cayman feeder for non-US investors flows through a Delaware C-corp blocker into a Delaware master partnership; US investors invest directly into the master. 7-year hold. 506(c) general solicitation with verified accredited investors. Wyoming sponsor entity for the GP.',
    formInputs: {
      project_name: '[Fund Name] Real Estate Fund I LP',
      deal_type: 'master_feeder',
      property_state: 'multi',
      property_location: 'Multiple US commercial assets',
      hold_months: 84,
      senior_loan: 50000000,
      senior_rate: 6.5,
      senior_avg_balance: 90,
      senior_752: 'qualified_nonrecourse',
      budget_land: 80000000,
      budget_building: 0,
      budget_hard: 0,
      budget_contingency: 1500000,
      budget_soft: 2000000,
      budget_dev_fees: 1000000,
      budget_interest: 18000000,
      budget_tax_ins: 4000000,
      budget_marketing: 200000,
      budget_other: 300000,
      exit_price: 145000000,
      disp_commission: 1.5,
      disp_stamps: 0.4,
      disp_other: 500000,
      pref_rate: 8,
      waterfall_style: 'European',
      catchup_style: 'gp_50_to_pari',
      clawback_type: 'lookback',
      clawback_threshold: 8,
      guarantor_pg: 'no',
      fee_acquisition: 1,
      fee_development: 1,
      fee_cm: 0,
      fee_disposition: 1,
      fee_asset_mgmt: 1.5,
      member_fed_rate: 37,
      member_ltcg_rate: 20,
      member_1250_rate: 25
    },
    memberClasses: [
      { name: 'US Master Partnership LPs', classType: 'lp', capital: 35000000, prefRate: 0.08, prefType: 'cumulative_compounding', prefPriority: 'pari_passu' },
      { name: 'Offshore Feeder LPs (via Blocker)', classType: 'lp_foreign', capital: 25000000, prefRate: 0.08, prefType: 'cumulative_compounding', prefPriority: 'pari_passu' },
      { name: 'GP / Sponsor', classType: 'sponsor', capital: 2000000, prefRate: 0.08, prefType: 'cumulative_compounding', prefPriority: 'pari_passu' }
    ],
    promoteTiers: [
      { hurdle: '8% Pref', threshold: 8, metric: 'irr', lpPct: 0.8, spPct: 0.2 }
    ],
    entities: [
      { name: '[Fund] Capital Management LLC', type: 'LLC', state: 'WY', role: 'sponsor', parentId: null, formationDate: '', address: '', ein: '', securities: '', isIssuer: false, generateOpAg: true },
      { name: '[Fund] GP LLC', type: 'LLC', state: 'DE', role: 'sponsor', parentId: 1, formationDate: '', address: '', ein: '', securities: '', isIssuer: false, generateOpAg: true },
      { name: '[Fund] Master LP', type: 'LP', state: 'DE', role: 'issuer', parentId: 2, formationDate: '', address: '', ein: '', securities: 'Class A Limited Partnership Interests', isIssuer: true, generateOpAg: true },
      { name: '[Fund] Offshore Feeder Ltd.', type: 'Foreign Entity', state: 'other', role: 'feeder', parentId: null, formationDate: '', address: 'Cayman Islands', ein: '', securities: '', isIssuer: false, generateOpAg: false },
      { name: '[Fund] US Blocker Inc.', type: 'C-Corp', state: 'DE', role: 'blocker', parentId: 4, formationDate: '', address: '', ein: '', securities: '', isIssuer: false, generateOpAg: false }
    ],
    securitiesLevel: 'level_3_506c'
  }
};

// =============================================================================
// LOAD A STARTER SCENARIO
// =============================================================================
function loadStarterScenario(scenarioKey) {
  const scenario = STARTER_SCENARIOS[scenarioKey];
  if (!scenario) return;

  if (!confirm(`Load the "${scenario.label}" starter scenario? This will overwrite all current input values.`)) return;

  // Clear DB collections first
  DB.memberClasses = [];
  DB.memberDebt = [];
  DB.promoteTiers = [];
  DB.sec704cLayers = [];
  DB.blockers = [];
  DB.investorProfiles = {};
  DB.entities = [];
  DB.signatories = [];
  DB.investors = [];
  DB.nextMemberId = 1;
  DB.nextDebtId = 1;
  DB.nextTierId = 1;
  DB.nextLayerId = 1;
  DB.nextBlockerId = 1;
  DB.nextEntityId = 1;
  DB.nextSignatoryId = 1;
  DB.nextInvestorId = 1;

  // Populate form input fields
  for (const [id, value] of Object.entries(scenario.formInputs)) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.type === 'checkbox') {
      el.checked = (value === true || value === 'yes' || value === 'true');
    } else {
      el.value = String(value);
    }
    // Trigger change event so any listeners (especially state-dependent UIs) update
    el.dispatchEvent(new Event('change', { bubbles: true }));
  }

  // Populate member classes
  for (const mc of scenario.memberClasses) {
    DB.memberClasses.push({ id: DB.nextMemberId++, ...mc });
  }

  // Populate promote tiers
  for (const t of scenario.promoteTiers) {
    DB.promoteTiers.push({ id: DB.nextTierId++, ...t });
  }

  // Populate entities — fix up parentIds since they're array-indexed in scenarios
  const entityIdMap = {};
  scenario.entities.forEach((e, idx) => {
    const newId = DB.nextEntityId++;
    entityIdMap[idx + 1] = newId;
    DB.entities.push({
      id: newId,
      name: e.name, type: e.type, state: e.state, role: e.role,
      parentId: e.parentId ? entityIdMap[e.parentId] : null,
      formationDate: e.formationDate || '',
      address: e.address || '',
      ein: e.ein || '',
      securities: e.securities || '',
      isIssuer: e.isIssuer || false,
      generateOpAg: e.generateOpAg !== false
    });
  });

  // Set securities level
  if (scenario.securitiesLevel) {
    const levelRadio = document.querySelector(`input[name="sec_level"][value="${scenario.securitiesLevel}"]`);
    if (levelRadio) levelRadio.checked = true;
  }

  // Re-render all dependent UIs
  if (typeof renderMemberClasses === 'function') renderMemberClasses();
  if (typeof renderPromoteTiers === 'function') renderPromoteTiers();
  if (typeof renderMemberDebt === 'function') renderMemberDebt();
  if (typeof renderBlockers === 'function') renderBlockers();
  if (typeof renderEntities === 'function') renderEntities();
  if (typeof renderEntityTreePreview === 'function') renderEntityTreePreview();
  if (typeof renderSignatories === 'function') renderSignatories();
  if (typeof renderInvestors === 'function') renderInvestors();
  if (typeof deriveLegacyIssuerSponsor === 'function') deriveLegacyIssuerSponsor();
  if (typeof updateLevelDescription === 'function') updateLevelDescription();

  // Apply formatting to all inputs (including those just populated)
  setTimeout(() => applyFormattingToAllInputs(), 100);

  // Notify
  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:20px;right:20px;background:#169B62;color:#FFFFFF;padding:0.85rem 1.25rem;font-family:Open Sans,sans-serif;font-size:0.88rem;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:9999;max-width:380px;';
  banner.innerHTML = `<strong>Loaded:</strong> ${scenario.label}<br><span style="font-size:0.78rem;">Review and customize every field for your specific deal before generating documents.</span>`;
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 6000);
}

// =============================================================================
// CLEAR ALL — reset form to blank state
// =============================================================================
function clearAllInputs() {
  if (!confirm('Clear all inputs and reset the tool to a blank state?')) return;

  // Reset all numeric inputs to their default/empty
  document.querySelectorAll('input[type="number"], input.db-fmt-currency, input.db-fmt-percent').forEach(input => {
    const defaultValue = input.dataset.defaultValue || input.getAttribute('value') || '0';
    input.value = defaultValue;
  });
  document.querySelectorAll('input[type="text"]:not(.db-fmt-currency):not(.db-fmt-percent)').forEach(input => {
    if (input.id && !input.id.startsWith('mc_') && !input.id.startsWith('md_') && !input.id.startsWith('inv_') && !input.id.startsWith('tier_') && !input.id.startsWith('sig_') && !input.id.startsWith('ent-')) {
      input.value = '';
    }
  });
  document.querySelectorAll('select').forEach(sel => {
    if (sel.id !== 'starter_scenario_select') {
      sel.selectedIndex = 0;
    }
  });
  document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);

  // Clear DB collections
  DB.memberClasses = [];
  DB.memberDebt = [];
  DB.promoteTiers = [];
  DB.sec704cLayers = [];
  DB.blockers = [];
  DB.investorProfiles = {};
  DB.entities = [];
  DB.signatories = [];
  DB.investors = [];
  DB.nextMemberId = 1;
  DB.nextDebtId = 1;
  DB.nextTierId = 1;
  DB.nextLayerId = 1;
  DB.nextBlockerId = 1;
  DB.nextEntityId = 1;
  DB.nextSignatoryId = 1;
  DB.nextInvestorId = 1;

  // Re-init Step 10 entity seed
  DB.entities.push(makeNewEntity('issuer'));

  // Re-render everything
  if (typeof renderMemberClasses === 'function') renderMemberClasses();
  if (typeof renderPromoteTiers === 'function') renderPromoteTiers();
  if (typeof renderMemberDebt === 'function') renderMemberDebt();
  if (typeof renderBlockers === 'function') renderBlockers();
  if (typeof renderEntities === 'function') renderEntities();
  if (typeof renderEntityTreePreview === 'function') renderEntityTreePreview();
  if (typeof renderSignatories === 'function') renderSignatories();
  if (typeof renderInvestors === 'function') renderInvestors();

  // Clear results
  const resultsTarget = document.getElementById('results_panel');
  if (resultsTarget) resultsTarget.innerHTML = '<p style="color:#6b6b6b;font-style:italic;">Enter deal inputs and click Calculate to see results.</p>';

  const banner = document.createElement('div');
  banner.style.cssText = 'position:fixed;top:20px;right:20px;background:#6b6b6b;color:#FFFFFF;padding:0.85rem 1.25rem;font-family:Open Sans,sans-serif;font-size:0.88rem;box-shadow:0 2px 8px rgba(0,0,0,0.2);z-index:9999;';
  banner.textContent = 'All inputs cleared.';
  document.body.appendChild(banner);
  setTimeout(() => banner.remove(), 3000);
}

// =============================================================================
// Wire up the scenario picker
// =============================================================================
document.addEventListener('DOMContentLoaded', () => {
  const select = document.getElementById('starter_scenario_select');
  const loadBtn = document.getElementById('btn_load_scenario');
  const clearBtn = document.getElementById('btn_clear_scenario');
  const descEl = document.getElementById('scenario_desc');

  if (select) {
    select.addEventListener('change', e => {
      const key = e.target.value;
      const scenario = STARTER_SCENARIOS[key];
      if (scenario && descEl) {
        descEl.textContent = scenario.description;
        descEl.classList.add('visible');
      } else if (descEl) {
        descEl.classList.remove('visible');
      }
    });
  }

  if (loadBtn) {
    loadBtn.addEventListener('click', () => {
      const key = select?.value;
      if (!key) {
        alert('Please select a starter scenario from the dropdown first.');
        return;
      }
      loadStarterScenario(key);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', clearAllInputs);
  }
});



// =============================================================================
// =============================================================================
//          PHASE 8.7 — NO-REG-D DOCUMENT GENERATORS
//
//  When the user selects Level 0 (No Reg D Filing — Small JV), the package
//  drops PPM, Sub Agreement, AI Questionnaire, Form D, Blue Sky, and Risk
//  Disclosure Letter. In their place, the package adds:
//    1. JV Securities Analysis Memo — counsel's reasoned analysis under Howey
//       and applicable no-action precedents
//    2. Member Joinder and Acknowledgment — per investor, confirms pre-existing
//       relationship and active participation
// =============================================================================
// =============================================================================

function generateJVAnalysisMemo(p7, dealData, levelConfig, sectionNum) {
  const issuer = p7.issuerEntity;
  const sl = STATE_LAW_DATA[issuer.state];
  const stateName = sl?.name || issuer.state;
  const today = todayLong();
  const numMembers = p7.investors.length;
  const totalCapital = p7.investors.reduce((s, i) => s + (i.capital || 0), 0);

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">${sectionNum}. JV SECURITIES ANALYSIS MEMORANDUM</h2>
  <p class="pkg-doc-subtitle">Counsel's analysis of why this transaction does not require Reg D filing &mdash; ${todayLong()}</p>

  <p style="background:#fafaf5;border-left:3px solid #d4a017;padding:0.85rem 1.1rem;font-style:italic;">
    <strong>IMPORTANT NOTICE.</strong> This memorandum is prepared by counsel as an internal analytical record of the basis on which the Sponsor and the firm have concluded that the ${entityShortName(issuer)} Operating Agreement does not require federal or state securities registration or Regulation D filing. This conclusion is fact-specific and depends on the representations and active participation of each Member. <strong>If any of the assumptions stated below are not accurate as to any Member, this analysis must be revisited and the transaction may need to be re-structured as a Reg D 506(b) Friends &amp; Family offering or higher level.</strong>
  </p>

  <h3 class="pkg-article">I. Transaction Summary</h3>
  <p>The Sponsor proposes to organize ${entityFullDesignationP8(issuer)} (the "<strong>Company</strong>") as a small joint venture among ${numMembers} Member${numMembers === 1 ? '' : 's'} who collectively will commit approximately ${fmt$(totalCapital)} of equity capital to acquire, develop, and/or operate ${escapeHtml(dealData.propertyLocation || 'the Property')}. The Sponsor and each Member have pre-existing substantive business or personal relationships.</p>

  <h3 class="pkg-article">II. Question Presented</h3>
  <p>Whether the offer and sale of membership interests in the Company to the Members constitutes an "offer or sale of securities" within the meaning of Section 2(a)(1) of the Securities Act of 1933 (the "<strong>1933 Act</strong>") and Section 3(a)(10) of the Securities Exchange Act of 1934, such that federal registration under Section 5 of the 1933 Act is required absent an applicable exemption; and if so, whether the transaction qualifies for an exemption other than Rule 506 of Regulation D.</p>

  <h3 class="pkg-article">III. Howey Analysis</h3>
  <p>Under <em>SEC v. W.J. Howey Co.</em>, 328 U.S. 293 (1946) and its progeny, the Supreme Court established the four-prong test for determining whether an "investment contract" is a security:</p>
  <ol style="margin-left:1.5rem;">
    <li><strong>An investment of money,</strong></li>
    <li><strong>in a common enterprise,</strong></li>
    <li><strong>with an expectation of profits</strong></li>
    <li><strong>derived solely (or predominantly) from the entrepreneurial or managerial efforts of others.</strong></li>
  </ol>

  <p><strong>Application to LLC interests.</strong> The leading authority addressing LLC interests is <em>SEC v. Merchant Capital, LLC</em>, 483 F.3d 747 (11th Cir. 2007), and its predecessor circuits applying Williamson factors. The analysis turns substantially on the fourth prong: whether each Member's expectation of profits derives from its own efforts (rebutting "efforts of others") or from a passive position in which the Sponsor or Manager is doing the work. Under <em>Williamson v. Tucker</em>, 645 F.2d 404 (5th Cir. 1981), an LLC interest is presumed NOT to be a security if:</p>
  <ol style="margin-left:1.5rem;">
    <li>The agreement among the parties leaves so little power in the hands of the partner or venturer that the arrangement in fact distributes power as would a limited partnership; or</li>
    <li>The partner or venturer is so inexperienced and unknowledgeable in business affairs that he is incapable of intelligently exercising his powers; or</li>
    <li>The partner or venturer is so dependent on some unique entrepreneurial or managerial ability of the promoter or manager that he cannot replace the manager of the enterprise or otherwise exercise meaningful partnership powers.</li>
  </ol>
  <p>Where <strong>none</strong> of these conditions is satisfied, the general partnership / member-managed LLC interest is presumed <em>not</em> to be a security.</p>

  <h3 class="pkg-article">IV. Application to the Company</h3>
  <p><strong>Member Participation.</strong> Counsel has been advised, and the Member Joinder &amp; Acknowledgment executed by each Member confirms, the following with respect to each Member:</p>
  <ul style="margin-left:1.5rem;">
    <li>Each Member has a pre-existing substantive business or personal relationship with the Sponsor predating this transaction;</li>
    <li>Each Member possesses business or professional experience reasonably sufficient to evaluate the merits and risks of the venture;</li>
    <li>Each Member has voting rights (as set forth in the Operating Agreement) on Major Decisions, including sale of all or substantially all assets, refinancing, dissolution, amendment of the Operating Agreement, and approval of transactions between the Manager and its affiliates;</li>
    <li>The Operating Agreement does not vest in the Sponsor / Manager any unique entrepreneurial ability such that the Manager could not be replaced; the Members retain the right to remove the Manager for Cause by ${escapeHtml((dealData.majorVoteThreshold || 'majority').replace('_',' '))} vote;</li>
    <li>No Member is being solicited as a passive investor in the typical "syndicated offering" sense; rather, each Member has been or is being introduced to the transaction through pre-existing relationships, with full opportunity to participate in due diligence, review of documents, and ongoing operating decisions;</li>
    <li>The Members are not aggregated through any common solicitation channel or public-facing marketing.</li>
  </ul>

  <p><strong>Williamson Factor Analysis.</strong> Applying the three Williamson conditions:</p>
  <ol style="margin-left:1.5rem;">
    <li><strong>Allocation of power:</strong> The Operating Agreement is consistent with a true joint venture and grants each Member substantive Major Decision voting rights. This is not a "limited partnership in disguise."</li>
    <li><strong>Sophistication of Members:</strong> Each Member is experienced and knowledgeable, as confirmed by the Joinder. None lacks the capacity to intelligently exercise the voting rights granted.</li>
    <li><strong>Dependence on unique managerial ability:</strong> While the Sponsor brings deal-execution and tax-structuring experience, the Sponsor's role is replaceable. The Operating Agreement provides for Manager removal and replacement.</li>
  </ol>

  <p><strong>Conclusion under <em>Howey</em>:</strong> The membership interests in ${entityShortName(issuer)} are <strong>not</strong> "investment contracts" within the meaning of the 1933 Act because the fourth <em>Howey</em> prong is not satisfied. The Members' expectation of profits is derived in material part from their own efforts &mdash; including voting, oversight, replacement of the Manager if necessary, and active participation in Major Decisions &mdash; rather than solely from the entrepreneurial efforts of others. The Williamson factors are not met.</p>

  <h3 class="pkg-article">V. Backup Exemption Analysis</h3>
  <p>If, contrary to the analysis above, the SEC or a court were to determine that the membership interests are "securities," counsel believes the offer and sale would in any event qualify for one or more of the following exemptions:</p>
  <ul style="margin-left:1.5rem;">
    <li><strong>Section 4(a)(2) of the 1933 Act</strong> &mdash; "transactions by an issuer not involving any public offering." Under <em>SEC v. Ralston Purina Co.</em>, 346 U.S. 119 (1953), this exemption applies where offerees can fend for themselves through pre-existing relationships, access to information equivalent to a registration statement, and the absence of public solicitation. All conditions are satisfied here.</li>
    <li><strong>Rule 504 of Regulation D</strong> &mdash; limited offerings under $10,000,000, with no general solicitation, in a 12-month period. ${totalCapital <= 10000000 ? 'The proposed raise is within this threshold.' : 'The proposed raise exceeds this threshold; Section 4(a)(2) or another non-Reg D exemption is the relevant fallback.'}</li>
    <li><strong>Intrastate offering exemption (Section 3(a)(11) and Rule 147 or 147A)</strong> &mdash; if all Members reside in ${escapeHtml(stateName)} and the Company satisfies the in-state operations requirements (doing business test, 80% of assets/revenues in-state).</li>
  </ul>

  <h3 class="pkg-article">VI. State Securities Law Considerations</h3>
  <p>${escapeHtml(stateName)} blue sky law generally follows the federal "security" definition; if the membership interests are not federal securities under <em>Howey</em>, they are likewise not state securities in most jurisdictions. ${sl ? `Specifically, ${escapeHtml(sl.name)} treatment of LLC interests under the state's Limited Liability Company Act (${escapeHtml(sl.llcAct.citation)}) is consistent with the analysis above; the Act treats member-managed LLCs as genuine joint ventures where members have material governance rights.` : ''}</p>
  <p>Even if the interests were deemed state securities, ${escapeHtml(stateName)} typically affords a limited-offering exemption for small offerings to fewer than a specified number of investors with pre-existing relationships; counsel will confirm the specific exemption claimed.</p>

  <h3 class="pkg-article">VII. Conclusion and Reservation</h3>
  <p>Based on the analysis above, the Sponsor and counsel have concluded that:</p>
  <ol style="margin-left:1.5rem;">
    <li>The membership interests in ${entityShortName(issuer)} are not "securities" within the meaning of the 1933 Act because they do not constitute "investment contracts" under <em>Howey</em>, and</li>
    <li>Federal registration under Section 5 of the 1933 Act is not required, and</li>
    <li>A Form D filing under Regulation D is not required because no Reg D exemption is being relied upon, and</li>
    <li>No state Blue Sky filing is required because the interests are not state securities or, if deemed to be, qualify for a limited-offering exemption.</li>
  </ol>

  <p><strong>RESERVATION.</strong> This conclusion is fact-dependent. If <em>any</em> of the following occur, the conclusion must be re-visited and the transaction may need to be restructured as a Reg D offering or otherwise registered:</p>
  <ul style="margin-left:1.5rem;">
    <li>Any Member is solicited through general advertising or to a person without a pre-existing relationship;</li>
    <li>The Manager removal or Major Decision voting rights are diluted by amendment of the Operating Agreement;</li>
    <li>Additional Members are admitted without similar pre-existing relationships and active-participation indicia;</li>
    <li>The Sponsor is replaced and a new Manager is held out as bringing unique entrepreneurial ability on which the Members are dependent;</li>
    <li>An SEC enforcement action, no-action letter, or judicial decision changes the legal landscape applicable to small-JV LLC interests.</li>
  </ul>

  <p>Counsel and Sponsor will monitor and address each of these contingencies. This Memorandum is dated as of ${escapeHtml(today)}.</p>
</div>
`;
}

function generateMemberJoinder(p7, dealData, investor, levelConfig, sectionNum) {
  const issuer = p7.issuerEntity;
  const sl = STATE_LAW_DATA[issuer.state];
  const stateName = sl?.name || issuer.state;
  const memberClass = dealData.memberClasses.find(c => c.id === investor.memberClassId);

  return `
<div class="pkg-section pkg-doc">
  <h2 class="pkg-doc-title">${sectionNum}. MEMBER JOINDER AND ACKNOWLEDGMENT</h2>
  <p class="pkg-doc-subtitle">${escapeHtml(investor.name)} &mdash; Joinder to Operating Agreement of ${entityShortName(issuer)}</p>

  <p>This <strong>Member Joinder and Acknowledgment</strong> (this "<strong>Joinder</strong>") is delivered by the undersigned (the "<strong>Member</strong>") in connection with the Member's admission as a Member of ${entityFullDesignationP8(issuer)} (the "<strong>Company</strong>") and the Member's execution of the Company's Operating Agreement of even date herewith.</p>

  <h3 class="pkg-article">1. Joinder to Operating Agreement</h3>
  <p>The Member hereby joins, becomes a party to, and agrees to be bound by all of the terms and conditions of the Operating Agreement of the Company, in the capacity of a Member in the ${escapeHtml(memberClass?.name || 'designated class')} class. The Member's name, mailing address, and Initial Capital Contribution are as follows:</p>

  <table class="pkg-table">
    <tbody>
      <tr><td><strong>Legal Name:</strong></td><td>${escapeHtml(investor.name)}</td></tr>
      <tr><td><strong>Member Type:</strong></td><td>${escapeHtml(INVESTOR_TYPES[investor.type] || investor.type)}</td></tr>
      <tr><td><strong>Mailing Address:</strong></td><td>${escapeHtml(investor.address)}</td></tr>
      <tr><td><strong>Email:</strong></td><td>${escapeHtml(investor.email || 'Not provided')}</td></tr>
      <tr><td><strong>Member Class:</strong></td><td>${escapeHtml(memberClass?.name || 'TBD')}</td></tr>
      <tr><td><strong>Initial Capital Contribution:</strong></td><td>${fmt$(investor.capital)}</td></tr>
    </tbody>
  </table>

  <h3 class="pkg-article">2. Representations of the Member</h3>
  <p>The Member represents and warrants to the Company and to each other Member as follows:</p>

  <p><strong>(a) Pre-Existing Substantive Relationship.</strong> The Member has a pre-existing substantive business and/or personal relationship with the Manager and/or one or more of the other Members. This relationship predates the formation of the Company and did not arise as a result of any general advertising, mass solicitation, internet posting, or seminar.</p>

  <p><strong>(b) Active Participation.</strong> The Member is investing in the Company as an active participant in a true joint venture, not as a passive investor seeking solely to earn a return from the efforts of others. The Member understands that:</p>
  <ul style="margin-left:1.5rem;">
    <li>The Member has voting rights on Major Decisions of the Company as set forth in the Operating Agreement, including the right to vote on sale of all or substantially all assets, refinancing, dissolution, amendments adversely affecting the Member's class, and any transaction between the Manager and its affiliates;</li>
    <li>The Member has the right (alone or together with other Members) to remove the Manager for Cause by ${escapeHtml((dealData.majorVoteThreshold || 'majority').replace('_',' '))} vote;</li>
    <li>The Member will participate in the affairs of the Company by reviewing financial statements, attending Member meetings (or executing written consents), and exercising the Member's voting rights;</li>
    <li>The Member has had full access to the Manager, to all books and records, and to all material information regarding the Company and the proposed business of the Company.</li>
  </ul>

  <p><strong>(c) Sophistication and Experience.</strong> The Member has such business and professional experience as to be capable of evaluating the merits and risks of an investment in the Company and is fully able to exercise the Member voting rights granted by the Operating Agreement. The Member is not so inexperienced or unknowledgeable in business affairs as to be incapable of intelligently exercising those rights.</p>

  <p><strong>(d) Manager Not Unique.</strong> The Member acknowledges that, while the Manager brings deal-execution and tax-structuring expertise, the Member does not regard the Manager as possessing such unique entrepreneurial or managerial ability that the Manager could not be replaced. The Member retains the right and ability, alone or together with other Members, to remove and replace the Manager in accordance with the Operating Agreement.</p>

  <p><strong>(e) No Reliance on Public Solicitation.</strong> The Member did not learn of the opportunity to invest in the Company through any general advertising, public solicitation, internet posting, mass mailing, seminar, or other public-facing communication. The Member's investment is the result of pre-existing, direct, substantive relationship with the Manager and/or other Members.</p>

  <p><strong>(f) Investment Intent.</strong> The Member is acquiring its membership interest for the Member's own account, for investment purposes (in the sense of acquiring an active equity interest in a joint venture business), and not with a view to or for sale in connection with any distribution of any portion thereof.</p>

  <p><strong>(g) Ability to Bear Loss.</strong> The Member is able to bear the economic risk of the Member's investment, including the risk of total loss of the Member's Initial Capital Contribution.</p>

  <p><strong>(h) Information.</strong> The Member has received and reviewed the Operating Agreement, the JV Securities Analysis Memorandum, and such other information as the Member has requested. The Member has had the opportunity to ask questions of, and receive answers from, the Manager regarding the terms and conditions of the offering and the business and financial condition of the Company.</p>

  <p><strong>(i) No Securities Filing.</strong> The Member acknowledges and agrees that the Company has not filed (and does not intend to file) a Form D under Regulation D with respect to the offer and sale of membership interests, and is not relying on any Regulation D exemption. The Member acknowledges that this position is based on counsel's analysis that the membership interests are not "securities" under <em>SEC v. W.J. Howey Co.</em> and applicable circuit-level authority.</p>

  <h3 class="pkg-article">3. Acknowledgment of Risks</h3>
  <p>The Member acknowledges that an investment in the Company involves substantial risk, including (without limitation): the risk of complete loss; illiquidity (no public market for membership interests; restrictions on transfer); dependence on the Manager for day-to-day operations; real estate market and macroeconomic risks; concentration risk in a single (or limited number of) asset(s); tax risks; and the risk that any of the representations made by the Member in this Joinder could later be challenged or shown to be inaccurate, in which case the analysis supporting the absence of a Reg D filing could be undermined and the Company could become subject to securities-law liability.</p>

  <h3 class="pkg-article">4. Counterparts; Governing Law</h3>
  <p>This Joinder may be executed in counterparts. This Joinder is governed by the laws of the State of ${escapeHtml(stateName)}.</p>

  <p style="margin-top:1.5rem;"><strong>IN WITNESS WHEREOF,</strong> the Member has executed this Joinder as of the date set forth below.</p>

  <div class="pkg-signature-block">
    <p><strong>MEMBER:</strong></p>
    <p>By: __________________________________<br>
    Name: ${escapeHtml(investor.name)}<br>
    ${investor.signingCapacity && investor.signingCapacity !== 'self' ? `Capacity: ${escapeHtml(SIGNING_CAPACITY[investor.signingCapacity] || investor.signingCapacity)}<br>` : ''}
    Date: __________________________________</p>
  </div>

  <div class="pkg-signature-block" style="margin-top:2rem;">
    <p><strong>ACCEPTED:</strong></p>
    <p>${entityShortName(issuer)}</p>
    <p>By: __________________________________<br>
    Name: [Manager Name]<br>
    Title: Manager<br>
    Date: __________________________________</p>
  </div>
</div>
`;
}



// =============================================================================
// PHASE 8.7 — PATCH generateDealPackage for level_0_no_reg_d
//
// When Level 0 is selected: skip PPM, Sub Agreement, AI Questionnaire,
// Form D, Blue Sky, Risk Letter. Add JV Analysis Memo + per-investor Joinder.
// =============================================================================

const _phase85GenerateDealPackage = generateDealPackage;
generateDealPackage = function() {
  // Check if Level 0 is selected; if not, fall through to existing logic
  const selectedLevel = document.querySelector('input[name="sec_level"]:checked')?.value || 'level_1_ff';

  if (selectedLevel !== 'level_0_no_reg_d') {
    return _phase85GenerateDealPackage();
  }

  // Level 0 path — build a streamlined package
  const p7 = collectPhase7Data();
  const dealData = collectFormData();
  const results = DB.lastResults || calculateDeal(dealData);
  const levelConfig = SEC_LEVEL_CONFIG.level_0_no_reg_d;

  // Validation (same as Reg D path but without AI/Form D requirements)
  const issues = [];
  if (p7.entities.length === 0) issues.push('At least one entity must be defined.');
  if (p7.entities.filter(e => e.isIssuer).length !== 1) issues.push('Exactly one entity must be designated as the Issuer.');
  for (const ent of p7.entities) {
    if (!ent.name) issues.push(`Entity ${ent.id} is missing a legal name.`);
    if (!ent.state) issues.push(`Entity "${ent.name || ent.id}" is missing a state of formation.`);
  }
  if (p7.signatories.length === 0) issues.push('At least one authorized signatory must be specified.');
  if (p7.signatories.some(s => !s.name)) issues.push('All signatories must have a name.');
  if (p7.signatories.some(s => !s.entityIds || s.entityIds.length === 0)) issues.push('Each signatory must be assigned to at least one entity.');
  if (p7.investors.length === 0) issues.push('At least one Member must be added.');
  if (p7.investors.some(i => !i.name)) issues.push('All Members must have a legal name.');
  if (p7.investors.some(i => !i.capital || i.capital <= 0)) issues.push('All Members must have a positive Capital Commitment.');
  if (p7.investors.some(i => !i.memberClassId)) issues.push('All Members must be assigned to a member class.');

  if (issues.length > 0) {
    alert('Cannot generate deal package. Issues to resolve:\n\n' + issues.join('\n'));
    return;
  }

  // Warn if the deal characteristics suggest Level 0 may not be appropriate
  const memberCount = p7.investors.length;
  const totalCapital = p7.investors.reduce((s, i) => s + (i.capital || 0), 0);
  const warnings = [];
  if (memberCount > 8) {
    warnings.push(`This package has ${memberCount} Members. The No-Reg-D analysis is most defensible for small JVs (typically 2-6 Members). Consider whether Reg D 506(b) Friends & Family is more appropriate.`);
  }
  if (totalCapital > 5000000) {
    warnings.push(`Total Member commitments are ${fmt$(totalCapital)}. At this scale, the SEC and state regulators may scrutinize the "operating member JV" characterization. Consider whether Reg D 506(b) or 506(c) is more appropriate.`);
  }
  if (warnings.length > 0) {
    if (!confirm('Caution — Level 0 (No Reg D) may not be the optimal compliance level for this deal:\n\n' + warnings.join('\n\n') + '\n\nProceed anyway?')) return;
  }

  let sectionNum = 2;
  let bodyHtml = generatePackageCover(p7, dealData, levelConfig);
  bodyHtml += generatePackageTOC(p7, dealData, levelConfig);
  bodyHtml += generatePackageOverview(p7, dealData, levelConfig);
  bodyHtml += generateStructureDiagram(p7, dealData, sectionNum++);

  // JV Securities Analysis Memo — primary distinguishing document
  bodyHtml += generateJVAnalysisMemo(p7, dealData, levelConfig, sectionNum++);

  // Per-entity Operating Agreement (same as Reg D path)
  const entitiesWithOA = p7.entities.filter(e => e.generateOpAg);
  for (const entity of entitiesWithOA) {
    bodyHtml += `<div class="pkg-section pkg-doc">
      <h2 class="pkg-doc-title">${sectionNum}. ${entity.type === 'LP' ? 'LIMITED PARTNERSHIP AGREEMENT' : 'OPERATING AGREEMENT'} of ${entityShortName(entity)}</h2>
      <p class="pkg-doc-subtitle">${entityShortName(entity)} (${escapeHtml(STATE_LAW_DATA[entity.state]?.name || entity.state)} ${escapeHtml(entity.type)}) — ${escapeHtml(ENTITY_ROLES[entity.role]?.label || entity.role)}${entity.isIssuer ? ' · ISSUER' : ''}</p>
    </div>`;
    bodyHtml += generateOperatingAgreement(p7, dealData, results, entity);
    sectionNum++;
  }

  // Member Joinder & Acknowledgment — one per investor (replaces Sub Agreement + AI Questionnaire)
  bodyHtml += `<div class="pkg-section pkg-doc">
    <h2 class="pkg-doc-title">${sectionNum++}. MEMBER JOINDER &amp; ACKNOWLEDGMENT &mdash; Form and Executed Counterparts</h2>
    <p class="pkg-doc-subtitle">${memberCount} counterpart${memberCount === 1 ? '' : 's'} follow, each personalized for the named Member and joining the Operating Agreement of ${entityShortName(p7.issuerEntity)}</p>
  </div>`;
  for (const inv of p7.investors) {
    bodyHtml += generateMemberJoinder(p7, dealData, inv, levelConfig, `${sectionNum - 1}.${p7.investors.indexOf(inv) + 1}`);
  }

  if (p7.options.includeDealMemo) {
    bodyHtml += `<div class="pkg-section pkg-doc">
      <h2 class="pkg-doc-title">EXHIBIT A &mdash; Deal Memorandum</h2>
      <p class="pkg-doc-subtitle">${escapeHtml(dealData.projectName || 'Project')} &mdash; ${todayLong()}</p>
      <div style="margin-top:1.5rem;">
        ${(typeof generateDealMemoBody === 'function') ? generateDealMemoBody(dealData, results) : '<p><em>Deal Memo content not available in this session.</em></p>'}
      </div>
    </div>`;
  }

  // NY publication compliance docs if any NY entity
  const nyEntities = p7.entities.filter(e => e.state === 'NY');
  for (const ne of nyEntities) {
    bodyHtml += generateNYPublicationCompliance(p7, dealData, ne, sectionNum++);
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>JV Deal Package — ${escapeHtml(p7.issuer.name)}</title>
<style>${getDealPackagePrintCSS()}</style>
</head>
<body>
  <div class="pkg-draft-stamp">DRAFT &middot; PRIVILEGED &amp; CONFIDENTIAL &middot; NO REG D OFFERING</div>
  <div class="pkg-container">
    ${bodyHtml}
  </div>
  <div class="pkg-footer">
    Generated ${todayLong()} &middot; Donovan Legal PLLC &middot; Reserve Deal Builder &middot; Level 0 (No Reg D Filing) &mdash; for review under engagement letter
  </div>
</body>
</html>`;

  const newWindow = window.open('', '_blank');
  if (newWindow) {
    newWindow.document.write(fullHtml);
    newWindow.document.close();
  } else {
    alert('Pop-up blocked. Please allow pop-ups for this page to view the deal package.');
  }
};

// Override TOC for Level 0
const _phase85GeneratePackageTOC = generatePackageTOC;
generatePackageTOC = function(p7, dealData, levelConfig) {
  if (levelConfig === SEC_LEVEL_CONFIG.level_0_no_reg_d) {
    const memberCount = p7.investors.length;
    const entitiesWithOA = p7.entities.filter(e => e.generateOpAg);
    let toc = `
<div class="pkg-toc">
  <h2>Package Index</h2>
  <ol>
    <li><strong>Package Overview</strong> — JV characterization and document map</li>
    <li><strong>Entity Structure Diagram</strong> — multi-tier ownership and management structure</li>
    <li><strong>JV Securities Analysis Memorandum</strong> — counsel's reasoned analysis under <em>Howey</em></li>`;
    for (const ent of entitiesWithOA) {
      const docName = ent.type === 'LP' ? 'Limited Partnership Agreement' : 'Operating Agreement';
      toc += `<li><strong>${docName}</strong> of ${entityShortName(ent)} (${escapeHtml(STATE_LAW_DATA[ent.state]?.name || ent.state)} ${escapeHtml(ent.type)})${ent.isIssuer ? ' — Issuer' : ''}</li>`;
    }
    toc += `<li><strong>Member Joinder &amp; Acknowledgment</strong> — Form (and ${memberCount} executed counterpart${memberCount === 1 ? '' : 's'})</li>`;
    const nyEntities = p7.entities.filter(e => e.state === 'NY');
    for (const ne of nyEntities) {
      toc += `<li><strong>New York §206 Publication Compliance</strong> for ${entityShortName(ne)}</li>`;
    }
    if (p7.options.includeDealMemo) toc += `<li><strong>Exhibit A:</strong> Deal Memorandum</li>`;
    toc += `</ol>
</div>
`;
    return toc;
  }
  return _phase85GeneratePackageTOC(p7, dealData, levelConfig);
};

