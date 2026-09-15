/* Donovan Legal — RESERVE Deal Economics Tool
 * JavaScript Engine — Thread 1 of 4-6
 * Last updated: May 2026
 *
 * Architecture (mirrors tool-structuring.js patterns):
 *   - Three-tier ladder ('public' < 'platinum' < 'reserve') driven by
 *     window.__DONOVAN_TIER set inline in the HTML wrapper before this script
 *     loads. RESERVE-only — public and platinum render gate page only.
 *   - Argus-style multi-year cash-flow modeling layered with capital-stack
 *     structure (LP common, LP pref, GP, sponsor co-invest, mezz, senior debt).
 *
 *   THREAD 1 SCOPE (this build):
 *     - defaultState + ECON_PRESETS (30 deal-type presets, ≥20 at renderQuality 'full')
 *     - Feasibility module: sources & uses, capital stack, pro forma, DSCR,
 *       LTV, LTC, sensitivity grid, break-even, development budget
 *     - Bidirectional handoff intake (Structuring outgoing, Multi-Eight draft,
 *       12-Step draft, forward-compatible EF outgoing schemas)
 *     - Outgoing payload schema (donovan_legal_economics_outcome_v1)
 *     - Memo composition (Sections I-VI rendered; VII-IX scaffolded)
 *     - Excel workbook generation (3 tabs populated; tabs 4-10 structured)
 *     - Post-Run dashboard panel state
 *
 *   THREAD 2 (next build) ADDS:
 *     - Deal Structuring Layer: allocation method, § 704(c) method,
 *       § 752 debt allocation, QIO + min-gain chargebacks, multi-tier
 *       promote (catch-up, clawback, lookback). Memo VII-VIII.
 *
 *   THREAD 3 — Hold-Period Modeling (waterfall execution, capital accounts,
 *     depreciation with bonus + cost-seg, refinance event).
 *
 *   THREAD 4 — Disposition (hypothetical liquidation, § 1245/1250 recapture,
 *     § 1031 deferred-gain mechanics).
 *
 *   THREAD 5 — Excel output complete (live formulas across all 10 tabs,
 *     chart objects, per-partner K-1 projections).
 *
 *   THREAD 6 — Integration, cross-thread regression, Argus benchmark, polish.
 *
 * Excel output: engine returns a SheetJS-compatible workbook object structure.
 * The browser wrapper loads /js/vendor/xlsx-writer.js and calls
 * XLSX.writeFile(wb, filename) on the engine output. Node smoke tests
 * inspect the workbook structure directly without requiring SheetJS.
 *
 * No external runtime dependencies (SheetJS is a download-time helper only).
 * Vanilla JS only.
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
function tierRank(t)    { return TIER_RANK[t] != null ? TIER_RANK[t] : 0; }
function isAtLeast(t)   { return tierRank(TIER) >= tierRank(t); }
function isPublic()     { return TIER === 'public'; }
function isPlatinum()   { return TIER === 'platinum'; }
function isReserve()    { return isAtLeast('reserve'); }
function hasToolAccess(){ return isReserve(); }
const TIER_LABEL = { public: 'PUBLIC', platinum: 'PLATINUM', reserve: 'RESERVE' };

// =============================================================================
// STATES — same ten as the Structuring Tool for cross-tool consistency
// =============================================================================
// Each state carries name, income-tax flag, transfer-tax (deed stamp/RTT) bps
// for itemized disposition costs, and a brief note.
// Transfer-tax bps: applied to disposition gross sale price as the state
// portion (county / city transfer taxes are layered separately when material).
// =============================================================================
const STATES = {
  FL: { code: 'FL', name: 'Florida',        incomeTax: false, transferBps: 70,  note: 'No state income tax; deed-stamp 0.70% statewide.' },
  DE: { code: 'DE', name: 'Delaware',       incomeTax: true,  transferBps: 400, note: 'State + local transfer tax 4% combined typical.' },
  WY: { code: 'WY', name: 'Wyoming',        incomeTax: false, transferBps: 0,   note: 'No state income tax; no real estate transfer tax.' },
  TX: { code: 'TX', name: 'Texas',          incomeTax: false, transferBps: 0,   note: 'No state income tax; no statewide transfer tax.' },
  NY: { code: 'NY', name: 'New York',       incomeTax: true,  transferBps: 40,  note: 'Statewide RPTT 0.40% (NYC adds substantially; mansion tax above $1M).' },
  CA: { code: 'CA', name: 'California',     incomeTax: true,  transferBps: 11,  note: 'Documentary transfer tax 0.11% statewide; county/city additions material.' },
  SC: { code: 'SC', name: 'South Carolina', incomeTax: true,  transferBps: 37,  note: 'Deed-recording fee 0.37% statewide.' },
  NC: { code: 'NC', name: 'North Carolina', incomeTax: true,  transferBps: 20,  note: 'Excise stamp tax 0.20%.' },
  SD: { code: 'SD', name: 'South Dakota',   incomeTax: false, transferBps: 10,  note: 'No state income tax; transfer fee 0.10%.' },
  NV: { code: 'NV', name: 'Nevada',         incomeTax: false, transferBps: 25,  note: 'No state income tax; real property transfer tax ~0.25%.' }
};
const STATE_CODES = Object.keys(STATES);
function stateInfo(code) { return STATES[code] || STATES.DE; }

// =============================================================================
// ASSET CLASSES — six top-level classifications, used to drive default
// operating ratios and revenue model selection.
// =============================================================================
const ASSET_CLASSES = {
  residential:  { key: 'residential',  label: 'Residential',  description: 'For-sale residential and rental residential.' },
  commercial:   { key: 'commercial',   label: 'Commercial',   description: 'Office, retail, industrial, medical office.' },
  hospitality:  { key: 'hospitality',  label: 'Hospitality',  description: 'Hotel and STR; RevPAR/ADR/occupancy-driven.' },
  mixed_use:    { key: 'mixed_use',    label: 'Mixed-Use',    description: 'Vertical mixed-use; multi-product parallel cash flows.' },
  development:  { key: 'development',  label: 'Development',  description: 'Ground-up; construction loan; lease-up phase.' },
  specialty:    { key: 'specialty',    label: 'Specialty',    description: 'NNN, LIHTC, QOZ, land, sale-leaseback.' }
};

// =============================================================================
// CASH FLOW PROFILES — five archetypes. Each preset declares its profile.
// =============================================================================
//   'for_sale'    — short cycle, no operating cash flow during build, sales velocity
//   'hold'        — multi-year rental NOI, debt service, exit at hold-end
//   'hospitality' — RevPAR/ADR/occupancy; high opex; brand royalty layer
//   'mixed_use'   — multiple parallel streams (for-sale + hold)
//   'development' — construction phase + lease-up + stabilized hold + exit
// =============================================================================
const CASH_FLOW_PROFILES = ['for_sale', 'hold', 'hospitality', 'mixed_use', 'development'];

// =============================================================================
// CAPITAL CLASS TYPES — ranked for waterfall priority (lower = senior)
// =============================================================================
const CAPITAL_CLASS_TYPES = {
  sr_debt:          { rank: 1, label: 'Senior Debt',           kind: 'debt',   description: 'Mortgage / construction loan' },
  mezz:             { rank: 2, label: 'Mezzanine Debt',        kind: 'debt',   description: 'Subordinate debt' },
  lp_pref:          { rank: 3, label: 'LP Preferred Equity',   kind: 'equity', description: 'Preferred return + capital before common' },
  lp_common:        { rank: 4, label: 'LP Common Equity',      kind: 'equity', description: 'Common LP interest' },
  sponsor_coinvest: { rank: 5, label: 'Sponsor Co-Invest',     kind: 'equity', description: 'Sponsor capital alongside LPs' },
  gp_interest:      { rank: 6, label: 'GP Interest',           kind: 'equity', description: 'Carried-interest holder / sponsor promote' },
  other:            { rank: 7, label: 'Other',                 kind: 'equity', description: 'Other capital class' }
};
const CAPITAL_CLASS_TYPE_KEYS = Object.keys(CAPITAL_CLASS_TYPES);

// =============================================================================
// EXIT STRATEGIES
// =============================================================================
const EXIT_STRATEGIES = {
  hold_and_exit:       { label: 'Hold and Exit at Sale',          description: 'Stabilize, hold for term, sell at exit cap' },
  sell_at_completion:  { label: 'Sell at Completion',             description: 'For-sale / development; sell upon delivery' },
  '1031_exchange':     { label: '§ 1031 Like-Kind Exchange',      description: 'Defer gain via QI; replacement property in 180 days' },
  refi_recap:          { label: 'Refinance and Recapitalize',     description: 'Mid-hold refi; capital return; continue holding' }
};
const EXIT_STRATEGY_KEYS = Object.keys(EXIT_STRATEGIES);

// =============================================================================
// MATH OPTIONALITY DEFAULTS — surfaces from handoff §5.5
// =============================================================================
// Each toggle defaults documented; Thread 2 wires UI controls; Thread 3 wires
// analytical branches. Thread 1 carries the state fields with defaults so
// downstream threads can swap defaults to non-defaults without schema change.
// =============================================================================
const MATH_DEFAULTS = {
  pref_return_accrual_basis: 'simple',           // simple | compound
  pref_return_payment:        'accrued',         // current_pay | accrued
  gp_catchup_speed:           1.00,              // 1.00 | 0.80 | 0.50
  waterfall_hurdle_basis:     'IRR',             // IRR | MOIC | cash_on_cash
  promote_structure:          'multi_tier',      // single_tier | multi_tier
  promote_tiers_default:      [
    { hurdle_pct: 0.08, lp_pct: 0.80, gp_pct: 0.20 },
    { hurdle_pct: 0.12, lp_pct: 0.70, gp_pct: 0.30 },
    { hurdle_pct: 0.20, lp_pct: 0.50, gp_pct: 0.50 }
  ],
  clawback_mechanic:          'end_of_fund',     // end_of_fund | annual_lookback
  section_704c_method:        'traditional_with_curative', // traditional | traditional_with_curative | remedial
  section_752_method:         'standard_hierarchy',        // standard_hierarchy | recourse_tracing | qnrf_as_recourse
  depreciation_method:        'sl_macrs',        // sl_macrs (+ optional cost-seg overlay)
  cost_seg_overlay:           false,             // toggle
  bonus_depreciation_rate:    1.00,              // 1.00 | 0.80 | 0.60 | 0
  exit_cap_basis:             'spread_to_going_in', // constant | spread_to_going_in | stress
  exit_cap_spread_bps:        50,                // spread above going-in cap
  disposition_costs_method:   'itemized',        // lump | itemized
  disposition_costs_lump_pct: 0.01,              // when lump
  refinance_mechanic:         'cash_out_max_ltv',// rate_term | cash_out_max_ltv
  vacancy_basis:              'asset_class_default', // per-preset default; user can override
  growth_rates_basis:         'line_item_specific', // single_cagr | line_item_specific
  federal_tax_rate:           0.37,              // 37% individual top rate
  niit_rate:                  0.038              // 3.8% NIIT layered for individuals
};

// =============================================================================
// OBBBA BONUS DEPRECIATION — per partner's brief: 100% for property placed
// in service post Jan 19, 2025 under One Big Beautiful Bill Act restoration.
// =============================================================================
const BONUS_DEPRECIATION = {
  rate_current_year: 1.00,
  rate_2024:         0.60,
  rate_2023:         0.80,
  rate_2025_pre_obba: 0.40, // 40% under TCJA phase-down before OBBBA restoration
  obba_effective_date: '2025-01-19',
  cite: 'OBBBA § 70302 (Pub. L. 119-21); I.R.C. § 168(k)'
};

// =============================================================================
// UTILITIES
// =============================================================================
function todayISO() { return new Date().toISOString().slice(0, 10); }
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
function fmtMoney(n) {
  const v = Number(n) || 0;
  if (v === 0) return '$\u2014';
  if (v < 0) return '($' + Math.abs(v).toLocaleString('en-US', { maximumFractionDigits: 0 }) + ')';
  return '$' + v.toLocaleString('en-US', { maximumFractionDigits: 0 });
}
function fmtMoneyDec(n, dec) {
  const v = Number(n) || 0;
  const d = dec == null ? 0 : dec;
  if (v === 0) return '$\u2014';
  if (v < 0) return '($' + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) + ')';
  return '$' + v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}
function fmtPercent(n, decimals) {
  const d = (decimals == null) ? 2 : decimals;
  const v = Number(n);
  if (!isFinite(v)) return '\u2014';
  return (v * 100).toFixed(d) + '%';
}
function fmtMultiple(n, decimals) {
  const d = (decimals == null) ? 2 : decimals;
  const v = Number(n);
  if (!isFinite(v)) return '\u2014';
  return v.toFixed(d) + 'x';
}
function round2(n) { return Math.round(Number(n) * 100) / 100; }
function round4(n) { return Math.round(Number(n) * 10000) / 10000; }

// IRR — Newton-Raphson on cash-flow array, t=0 is the first element.
// Returns null if no convergence (default-flat sign, divergent NPV, etc.).
function computeIRR(cashFlows, guess) {
  if (!Array.isArray(cashFlows) || cashFlows.length < 2) return null;
  // Need at least one negative and one positive cash flow
  let hasNeg = false, hasPos = false;
  for (let i = 0; i < cashFlows.length; i++) {
    if (cashFlows[i] < 0) hasNeg = true;
    if (cashFlows[i] > 0) hasPos = true;
  }
  if (!hasNeg || !hasPos) return null;
  let r = (guess == null) ? 0.10 : guess;
  const maxIter = 200;
  const tol = 1e-7;
  for (let iter = 0; iter < maxIter; iter++) {
    let npv = 0, dnpv = 0;
    for (let t = 0; t < cashFlows.length; t++) {
      const denom = Math.pow(1 + r, t);
      npv += cashFlows[t] / denom;
      if (t > 0) dnpv -= t * cashFlows[t] / Math.pow(1 + r, t + 1);
    }
    if (Math.abs(dnpv) < 1e-12) return null;
    const rNew = r - npv / dnpv;
    if (!isFinite(rNew)) return null;
    if (Math.abs(rNew - r) < tol) {
      if (rNew < -0.999 || rNew > 10) return null;
      return rNew;
    }
    r = rNew;
  }
  return null;
}

// MOIC — Sum positive / sum |negative|
function computeMOIC(cashFlows) {
  if (!Array.isArray(cashFlows) || cashFlows.length < 1) return null;
  let totalIn = 0, totalOut = 0;
  for (let i = 0; i < cashFlows.length; i++) {
    if (cashFlows[i] < 0) totalIn += -cashFlows[i];
    else totalOut += cashFlows[i];
  }
  if (totalIn <= 0) return null;
  return totalOut / totalIn;
}

// Cash-on-cash yield by year — annual CF / equity invested in that year (or
// running cumulative equity in for a hold preset).
function computeCashOnCash(annualCf, equityInvested) {
  if (!equityInvested || equityInvested <= 0) return null;
  return annualCf / equityInvested;
}

// =============================================================================
// DEFAULT STATE — every field documented; downstream threads add to this.
// =============================================================================
function defaultState() {
  return {
    // -------- IDENTITY --------
    project_name: '',
    matter_no: '',
    effective_date: todayISO(),
    deal_type: 'apartment_value_add',          // preset key
    asset_class: 'residential',                // residential | commercial | hospitality | mixed_use | development | specialty
    cash_flow_profile: 'hold',                 // for_sale | hold | hospitality | mixed_use | development
    jurisdiction: 'DE',                        // entity formation state
    asset_location_state: 'FL',                // physical asset state
    active_preset_key: null,                   // null or preset key

    // -------- DEAL PARAMETERS --------
    hold_period_years: 5,
    exit_strategy: 'hold_and_exit',

    // -------- ACQUISITION + DEVELOPMENT --------
    acquisition_price: 0,
    closing_costs_pct: 0.02,                   // 2% acquisition closing
    due_diligence_costs: 0,
    financing_fees_pct: 0.01,                  // 1% origination
    debt_placement_fee_pct: 0,                 // additional broker fee

    // Development budget (used for value-add and ground-up presets)
    development_present: false,
    hard_costs: 0,
    soft_costs: 0,                             // arch / eng / permits / legal
    contingency_pct: 0.10,                     // 10% of hard costs
    interest_reserve: 0,                       // computed by default; user can override
    lease_up_costs: 0,                         // TI/LCs during lease-up phase
    pre_opening_costs: 0,                      // hotel: FF&E + ramp-up

    // -------- REVENUE MODEL (asset-class dependent) --------
    // For "hold" residential/commercial:
    units_count: 0,
    avg_unit_rent_monthly: 0,                  // residential
    rent_growth_pct: 0.03,
    vacancy_pct: 0.05,                         // economic vacancy
    other_income_pct_of_rent: 0.03,            // laundry, parking, fees

    // For commercial — annual base rent (NNN typically) and TI/LC
    annual_base_rent_psf: 0,
    rentable_sqft: 0,
    rent_growth_commercial_pct: 0.025,
    cam_pass_through: true,

    // For hospitality — RevPAR drivers
    rooms_count: 0,
    avg_daily_rate: 0,                         // ADR
    occupancy_pct: 0.65,
    revpar_growth_pct: 0.03,
    fnb_pct_of_rooms: 0.20,                    // F&B as % of room revenue
    other_dept_pct_of_rooms: 0.05,

    // For for-sale — sales velocity
    total_units_to_sell: 0,
    avg_sale_price: 0,
    sales_velocity_units_per_month: 0,
    sale_price_growth_pct: 0,                  // typically 0 for for-sale

    // -------- OPERATING EXPENSES (% of effective gross revenue) --------
    opex_ratio: 0.40,                          // EGR-based ratio; preset-default per asset class
    opex_growth_pct: 0.03,
    capex_reserve_per_unit: 250,               // residential per door per year
    ti_lc_reserve_per_sqft: 0.50,              // commercial; per RSF per year
    ff_e_reserve_pct_of_revenue: 0.04,         // hospitality; 4% of revenue typical
    property_tax_basis_pct: 0.012,             // 1.2% of acquisition; jurisdiction-dependent
    insurance_per_unit: 350,                   // residential per door per year

    // -------- CAPITAL STACK --------
    capital_classes: [],                       // array of { id, label, type, committed, pref_rate_pct, hurdle_position, promote_split_pct, debt_rate_pct, debt_term_years, debt_amort_years, debt_io_period_years, debt_maturity_years, debt_payment_priority, debt_rate_type, payment_basis }

    // -------- SPONSOR STRUCTURE --------
    sponsor_form: 'llc',                       // llc | lp | corp
    sponsor_coinvest_pct: 0.05,                // 5% sponsor co-invest typical
    sponsor_has_gp: true,
    sponsor_has_carry_vehicle: false,

    // -------- EXIT ASSUMPTIONS --------
    exit_cap_rate: 0.065,                      // applied to Year N+1 NOI
    going_in_cap_rate: 0.060,                  // computed from acquisition/Y1 NOI when omitted
    exit_cap_method: 'spread_to_going_in',     // overrides math default if set; else MATH_DEFAULTS
    disposition_costs_method: 'itemized',
    disposition_brokerage_pct: 0.015,          // 1.5% brokerage typical institutional
    disposition_legal_psf: 0,                  // attorney/title; flat OK
    disposition_other_costs: 0,

    // -------- SENSITIVITY GRID --------
    sensitivity_axis_x: 'rent_growth',         // rent_growth | sales_velocity | occupancy
    sensitivity_axis_y: 'exit_cap',            // exit_cap | sales_price | adr
    sensitivity_x_range: [-0.02, -0.01, 0, 0.01, 0.02],  // delta around base
    sensitivity_y_range: [-0.01, -0.005, 0, 0.005, 0.01],

    // -------- MATH OPTIONALITY --------
    math: JSON.parse(JSON.stringify(MATH_DEFAULTS)),

    // -------- HANDOFF INTAKE STATE --------
    handoff_intake: {
      source_tool: null,                       // 'structuring' | '12step' | 'multi_eight' | null
      applied_at: null,
      raw_payload: null
    },

    // -------- RUN STATE --------
    last_run: {
      timestamp: null,
      analysis: null
    }
  };
}

// =============================================================================
// DEAL TYPE PRESETS — 30 archetypes per handoff §5.3
// =============================================================================
// Each entry:
//   label              — human display
//   emoji              — single emoji for tile rendering
//   description        — one-sentence preset summary
//   asset_class        — residential | commercial | hospitality | mixed_use | development | specialty
//   cash_flow_profile  — for_sale | hold | hospitality | mixed_use | development
//   tier               — 'standard' | 'specialty'
//   renderQuality      — 'full' (analytical core covers it) | 'partial' (Thread 2+ adds detail) | 'scaffold' (Thread 4+)
//   state              — partial state object merged into defaultState() on apply
// =============================================================================
const ECON_PRESETS = {

  // ============ FOR-SALE RESIDENTIAL (4) ============
  single_family_spec: {
    label: 'Single-Family Spec Build',
    emoji: '🏗️',
    description: 'Buy lot, build, sell. No operating cash flow; 12–24 month cycle.',
    asset_class: 'residential',
    cash_flow_profile: 'for_sale',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Spec Build LLC',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'residential', cash_flow_profile: 'for_sale',
      hold_period_years: 2, exit_strategy: 'sell_at_completion',
      acquisition_price: 350000, closing_costs_pct: 0.02,
      development_present: true,
      hard_costs: 850000, soft_costs: 95000, contingency_pct: 0.10,
      total_units_to_sell: 1, avg_sale_price: 1750000,
      sales_velocity_units_per_month: 1,
      capital_classes: [
        { id: 'sd1', label: 'Construction Loan', type: 'sr_debt', committed: 875000, debt_rate_pct: 0.085, debt_term_years: 2, debt_io_period_years: 2, debt_amort_years: 0, debt_maturity_years: 2, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io' },
          { id: 'sp1', label: 'Sponsor Equity', type: 'sponsor_coinvest', committed: 425000 }
      ],
      sensitivity_axis_x: 'sales_velocity', sensitivity_axis_y: 'sales_price',
      sensitivity_x_range: [-3, -1, 0, 1, 3],
      sensitivity_y_range: [-0.10, -0.05, 0, 0.05, 0.10]
    }
  },

  single_family_flip: {
    label: 'Single-Family Flip',
    emoji: '🔨',
    description: 'Buy distressed, renovate, sell. 6–12 month cycle.',
    asset_class: 'residential',
    cash_flow_profile: 'for_sale',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Flip LLC',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'residential', cash_flow_profile: 'for_sale',
      hold_period_years: 1, exit_strategy: 'sell_at_completion',
      acquisition_price: 280000, closing_costs_pct: 0.02,
      development_present: true,
      hard_costs: 95000, soft_costs: 12000, contingency_pct: 0.15,
      total_units_to_sell: 1, avg_sale_price: 525000,
      sales_velocity_units_per_month: 1,
      capital_classes: [
        { id: 'hm1', label: 'Hard Money', type: 'sr_debt', committed: 285000, debt_rate_pct: 0.11, debt_term_years: 1, debt_io_period_years: 1, debt_amort_years: 0, debt_maturity_years: 1, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io' },
        { id: 'sp1', label: 'Sponsor Equity', type: 'sponsor_coinvest', committed: 115000 }
      ],
      sensitivity_axis_x: 'sales_velocity', sensitivity_axis_y: 'sales_price',
      sensitivity_x_range: [-2, -1, 0, 1, 2],
      sensitivity_y_range: [-0.08, -0.04, 0, 0.04, 0.08]
    }
  },

  condo_development: {
    label: 'Ground-Up Condo Development',
    emoji: '🏢',
    description: 'Multi-unit condo for sale; sales velocity by unit type; HOA setup.',
    asset_class: 'residential',
    cash_flow_profile: 'for_sale',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Condo Development LP',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'residential', cash_flow_profile: 'for_sale',
      hold_period_years: 3, exit_strategy: 'sell_at_completion',
      acquisition_price: 8500000, closing_costs_pct: 0.025,
      development_present: true,
      hard_costs: 36000000, soft_costs: 5200000, contingency_pct: 0.08,
      total_units_to_sell: 48, avg_sale_price: 1450000,
      sales_velocity_units_per_month: 3,
      capital_classes: [
        { id: 'sd1', label: 'Construction Loan', type: 'sr_debt', committed: 33000000, debt_rate_pct: 0.075, debt_term_years: 3, debt_io_period_years: 3, debt_amort_years: 0, debt_maturity_years: 3, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io' },
        { id: 'mz1', label: 'Mezzanine', type: 'mezz', committed: 5500000, debt_rate_pct: 0.12, debt_term_years: 3, debt_io_period_years: 3, debt_amort_years: 0, debt_maturity_years: 3, debt_payment_priority: 2, debt_rate_type: 'fixed', payment_basis: 'io' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 9700000, pref_rate_pct: 0.08, hurdle_position: 1, promote_split_pct: 0.20 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 1500000 }
      ],
      sensitivity_axis_x: 'sales_velocity', sensitivity_axis_y: 'sales_price',
      sensitivity_x_range: [-2, -1, 0, 1, 2],
      sensitivity_y_range: [-0.10, -0.05, 0, 0.05, 0.10]
    }
  },

  condo_conversion: {
    label: 'Apartment-to-Condo Conversion',
    emoji: '🔁',
    description: 'Acquire apartment, convert to condo, sell. Conversion budget + sales velocity.',
    asset_class: 'residential',
    cash_flow_profile: 'for_sale',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Condo Conversion LLC',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'residential', cash_flow_profile: 'for_sale',
      hold_period_years: 3, exit_strategy: 'sell_at_completion',
      acquisition_price: 22000000, closing_costs_pct: 0.025,
      development_present: true,
      hard_costs: 7500000, soft_costs: 1800000, contingency_pct: 0.10,
      total_units_to_sell: 80, avg_sale_price: 525000,
      sales_velocity_units_per_month: 4,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 22000000, debt_rate_pct: 0.075, debt_term_years: 3, debt_io_period_years: 3, debt_amort_years: 0, debt_maturity_years: 3, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 8100000, pref_rate_pct: 0.08, hurdle_position: 1, promote_split_pct: 0.20 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 1700000 }
      ],
      sensitivity_axis_x: 'sales_velocity', sensitivity_axis_y: 'sales_price',
      sensitivity_x_range: [-3, -1, 0, 1, 3],
      sensitivity_y_range: [-0.10, -0.05, 0, 0.05, 0.10]
    }
  },

  // ============ RESIDENTIAL HOLD (5) ============
  sfr_brrrr: {
    label: 'SFR BRRRR Portfolio',
    emoji: '🏘️',
    description: 'Single-family rentals; buy/rehab/rent/refi/repeat.',
    asset_class: 'residential',
    cash_flow_profile: 'hold',
    tier: 'standard',
    renderQuality: 'partial',
    state: {
      project_name: 'Example SFR BRRRR LLC',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'residential', cash_flow_profile: 'hold',
      hold_period_years: 5, exit_strategy: 'refi_recap',
      units_count: 25, acquisition_price: 5250000,
      avg_unit_rent_monthly: 2100, rent_growth_pct: 0.035,
      vacancy_pct: 0.06, other_income_pct_of_rent: 0.03,
      opex_ratio: 0.42, opex_growth_pct: 0.03,
      capex_reserve_per_unit: 350, property_tax_basis_pct: 0.012, insurance_per_unit: 425,
      closing_costs_pct: 0.025, financing_fees_pct: 0.0125,
      development_present: true,  // rehab budget
      hard_costs: 525000, soft_costs: 65000, contingency_pct: 0.10,
      exit_cap_rate: 0.065, going_in_cap_rate: 0.055,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 3937500, debt_rate_pct: 0.0725, debt_term_years: 5, debt_io_period_years: 1, debt_amort_years: 30, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 1330000, pref_rate_pct: 0.08, hurdle_position: 1, promote_split_pct: 0.20 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 70000 }
      ]
    }
  },

  small_multifamily: {
    label: 'Small Multifamily (2–4 unit)',
    emoji: '🏡',
    description: 'Small residential hold; mortgage financing; long-term rental.',
    asset_class: 'residential',
    cash_flow_profile: 'hold',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Small Multifamily LLC',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'residential', cash_flow_profile: 'hold',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      units_count: 4, acquisition_price: 1200000,
      avg_unit_rent_monthly: 3000, rent_growth_pct: 0.03,
      vacancy_pct: 0.05, other_income_pct_of_rent: 0.02,
      opex_ratio: 0.38, opex_growth_pct: 0.03,
      capex_reserve_per_unit: 350, property_tax_basis_pct: 0.012, insurance_per_unit: 475,
      closing_costs_pct: 0.03, financing_fees_pct: 0.0125,
      exit_cap_rate: 0.065, going_in_cap_rate: 0.058,
      capital_classes: [
        { id: 'sd1', label: 'Conventional Mortgage', type: 'sr_debt', committed: 900000, debt_rate_pct: 0.0725, debt_term_years: 7, debt_io_period_years: 0, debt_amort_years: 30, debt_maturity_years: 30, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'amort' },
        { id: 'sp1', label: 'Sponsor Equity', type: 'sponsor_coinvest', committed: 300000 }
      ]
    }
  },

  apartment_value_add: {
    label: 'Apartment Value-Add',
    emoji: '🏬',
    description: '5+ unit apartment; value-add; rent bump trajectory; hold-and-exit.',
    asset_class: 'residential',
    cash_flow_profile: 'hold',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Apartment Value-Add LP',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'residential', cash_flow_profile: 'hold',
      hold_period_years: 5, exit_strategy: 'hold_and_exit',
      units_count: 120, acquisition_price: 18500000,
      avg_unit_rent_monthly: 1700, rent_growth_pct: 0.05,    // value-add: above-market rent ramp
      vacancy_pct: 0.07, other_income_pct_of_rent: 0.04,
      opex_ratio: 0.40, opex_growth_pct: 0.03,
      capex_reserve_per_unit: 300, property_tax_basis_pct: 0.012, insurance_per_unit: 425,
      closing_costs_pct: 0.02, financing_fees_pct: 0.01,
      development_present: true, hard_costs: 2400000, soft_costs: 250000, contingency_pct: 0.10,
      exit_cap_rate: 0.060, going_in_cap_rate: 0.055,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 14800000, debt_rate_pct: 0.065, debt_term_years: 5, debt_io_period_years: 2, debt_amort_years: 30, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 5400000, pref_rate_pct: 0.08, hurdle_position: 1, promote_split_pct: 0.20 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 950000 }
      ]
    }
  },

  apartment_stabilized: {
    label: 'Apartment Stabilized',
    emoji: '🏨',
    description: 'Institutional-quality stabilized apartment acquisition; modest growth.',
    asset_class: 'residential',
    cash_flow_profile: 'hold',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Stabilized Apartment LP',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'residential', cash_flow_profile: 'hold',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      units_count: 250, acquisition_price: 55000000,
      avg_unit_rent_monthly: 2200, rent_growth_pct: 0.03,
      vacancy_pct: 0.05, other_income_pct_of_rent: 0.04,
      opex_ratio: 0.36, opex_growth_pct: 0.03,
      capex_reserve_per_unit: 350, property_tax_basis_pct: 0.012, insurance_per_unit: 400,
      closing_costs_pct: 0.015, financing_fees_pct: 0.0075,
      exit_cap_rate: 0.055, going_in_cap_rate: 0.050,
      capital_classes: [
        { id: 'sd1', label: 'Agency Loan (Fannie/Freddie)', type: 'sr_debt', committed: 35750000, debt_rate_pct: 0.0575, debt_term_years: 7, debt_io_period_years: 3, debt_amort_years: 30, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 18250000, pref_rate_pct: 0.07, hurdle_position: 1, promote_split_pct: 0.15 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 1000000 }
      ]
    }
  },

  build_to_rent: {
    label: 'Build-to-Rent SFR Community',
    emoji: '🏘️',
    description: 'Ground-up BTR community; ground-up + lease-up + stabilized hold.',
    asset_class: 'development',
    cash_flow_profile: 'development',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example BTR Community LP',
      jurisdiction: 'DE', asset_location_state: 'TX',
      asset_class: 'development', cash_flow_profile: 'development',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      units_count: 150, acquisition_price: 4500000,
      avg_unit_rent_monthly: 2100, rent_growth_pct: 0.03,
      vacancy_pct: 0.06, other_income_pct_of_rent: 0.04,
      opex_ratio: 0.35, opex_growth_pct: 0.03,
      capex_reserve_per_unit: 200, property_tax_basis_pct: 0.022, insurance_per_unit: 350,
      closing_costs_pct: 0.02, financing_fees_pct: 0.015,
      development_present: true, hard_costs: 31500000, soft_costs: 3800000, contingency_pct: 0.08, lease_up_costs: 850000,
      exit_cap_rate: 0.055, going_in_cap_rate: 0.052,
      capital_classes: [
        { id: 'sd1', label: 'Construction Loan', type: 'sr_debt', committed: 28000000, debt_rate_pct: 0.0775, debt_term_years: 3, debt_io_period_years: 3, debt_amort_years: 0, debt_maturity_years: 3, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 10800000, pref_rate_pct: 0.09, hurdle_position: 1, promote_split_pct: 0.25 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 1900000 }
      ]
    }
  },

  // ============ STR / HOSPITALITY-RESIDENTIAL (2) ============
  str_single_property: {
    label: 'STR Single Property',
    emoji: '🏖️',
    description: 'Vacation rental, short-term; § 469 Exception A active business.',
    asset_class: 'hospitality',
    cash_flow_profile: 'hold',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example STR Property LLC',
      jurisdiction: 'FL', asset_location_state: 'FL',
      asset_class: 'hospitality', cash_flow_profile: 'hold',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      units_count: 1, rooms_count: 4, acquisition_price: 1850000,
      avg_daily_rate: 425, occupancy_pct: 0.62, revpar_growth_pct: 0.03,
      opex_ratio: 0.45, opex_growth_pct: 0.035,
      property_tax_basis_pct: 0.012, insurance_per_unit: 6500,
      closing_costs_pct: 0.025, financing_fees_pct: 0.015,
      exit_cap_rate: 0.085, going_in_cap_rate: 0.075,
      capital_classes: [
        { id: 'sd1', label: 'Vacation Home Loan', type: 'sr_debt', committed: 1295000, debt_rate_pct: 0.0825, debt_term_years: 7, debt_io_period_years: 0, debt_amort_years: 30, debt_maturity_years: 30, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'amort' },
        { id: 'sp1', label: 'Sponsor Equity', type: 'sponsor_coinvest', committed: 600000 }
      ],
      sensitivity_axis_x: 'occupancy', sensitivity_axis_y: 'adr'
    }
  },

  medium_term_rental: {
    label: 'Medium-Term / Corporate Housing',
    emoji: '🛏️',
    description: 'Corporate housing; 8–30 day stays; § 469 Exception B.',
    asset_class: 'hospitality',
    cash_flow_profile: 'hold',
    tier: 'standard',
    renderQuality: 'partial',
    state: {
      project_name: 'Example MTR Property LLC',
      jurisdiction: 'DE', asset_location_state: 'TX',
      asset_class: 'hospitality', cash_flow_profile: 'hold',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      units_count: 8, acquisition_price: 2400000,
      avg_unit_rent_monthly: 4200, rent_growth_pct: 0.03,
      vacancy_pct: 0.12, other_income_pct_of_rent: 0.05,
      opex_ratio: 0.42, opex_growth_pct: 0.03,
      capex_reserve_per_unit: 600, property_tax_basis_pct: 0.022, insurance_per_unit: 850,
      closing_costs_pct: 0.025, financing_fees_pct: 0.0125,
      exit_cap_rate: 0.075, going_in_cap_rate: 0.065,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 1680000, debt_rate_pct: 0.0775, debt_term_years: 7, debt_io_period_years: 1, debt_amort_years: 25, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'sp1', label: 'Sponsor Equity', type: 'sponsor_coinvest', committed: 720000 }
      ]
    }
  },

  // ============ COMMERCIAL HOLD (6) ============
  office_value_add: {
    label: 'Office Value-Add',
    emoji: '🏢',
    description: 'Office with vacancy lease-up; TI allowances; LCs.',
    asset_class: 'commercial',
    cash_flow_profile: 'hold',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Office Value-Add LP',
      jurisdiction: 'DE', asset_location_state: 'TX',
      asset_class: 'commercial', cash_flow_profile: 'hold',
      hold_period_years: 5, exit_strategy: 'hold_and_exit',
      rentable_sqft: 145000, acquisition_price: 22000000,
      annual_base_rent_psf: 28, rent_growth_commercial_pct: 0.025, cam_pass_through: true,
      vacancy_pct: 0.15,   // value-add starting vacancy
      opex_ratio: 0.35, opex_growth_pct: 0.025,
      ti_lc_reserve_per_sqft: 1.25, property_tax_basis_pct: 0.022,
      closing_costs_pct: 0.02, financing_fees_pct: 0.01,
      development_present: true, hard_costs: 2200000, soft_costs: 220000, contingency_pct: 0.10, lease_up_costs: 1750000,
      exit_cap_rate: 0.075, going_in_cap_rate: 0.080,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 16500000, debt_rate_pct: 0.07, debt_term_years: 5, debt_io_period_years: 2, debt_amort_years: 30, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 7700000, pref_rate_pct: 0.09, hurdle_position: 1, promote_split_pct: 0.25 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 1970000 }
      ]
    }
  },

  office_stabilized: {
    label: 'Office Stabilized',
    emoji: '🏛️',
    description: 'Stabilized office hold; modest growth.',
    asset_class: 'commercial',
    cash_flow_profile: 'hold',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Stabilized Office LP',
      jurisdiction: 'DE', asset_location_state: 'TX',
      asset_class: 'commercial', cash_flow_profile: 'hold',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      rentable_sqft: 220000, acquisition_price: 48000000,
      annual_base_rent_psf: 27, rent_growth_commercial_pct: 0.025, cam_pass_through: true,
      vacancy_pct: 0.07,
      opex_ratio: 0.30, opex_growth_pct: 0.025,
      ti_lc_reserve_per_sqft: 0.80, property_tax_basis_pct: 0.022,
      closing_costs_pct: 0.015, financing_fees_pct: 0.0075,
      exit_cap_rate: 0.070, going_in_cap_rate: 0.065,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 31200000, debt_rate_pct: 0.065, debt_term_years: 7, debt_io_period_years: 3, debt_amort_years: 30, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 15800000, pref_rate_pct: 0.08, hurdle_position: 1, promote_split_pct: 0.20 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 1000000 }
      ]
    }
  },

  retail_strip_anchor: {
    label: 'Anchored Retail Strip',
    emoji: '🛍️',
    description: 'Strip center / anchored retail; tenant credit; CAM pass-through.',
    asset_class: 'commercial',
    cash_flow_profile: 'hold',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Anchored Retail LP',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'commercial', cash_flow_profile: 'hold',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      rentable_sqft: 75000, acquisition_price: 15500000,
      annual_base_rent_psf: 23, rent_growth_commercial_pct: 0.02, cam_pass_through: true,
      vacancy_pct: 0.05,
      opex_ratio: 0.18, opex_growth_pct: 0.025,
      ti_lc_reserve_per_sqft: 1.50, property_tax_basis_pct: 0.012,
      closing_costs_pct: 0.02, financing_fees_pct: 0.01,
      exit_cap_rate: 0.075, going_in_cap_rate: 0.070,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 10075000, debt_rate_pct: 0.0675, debt_term_years: 7, debt_io_period_years: 2, debt_amort_years: 30, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 4900000, pref_rate_pct: 0.08, hurdle_position: 1, promote_split_pct: 0.20 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 525000 }
      ]
    }
  },

  industrial_warehouse: {
    label: 'Industrial Warehouse',
    emoji: '🏭',
    description: 'Distribution / warehouse; NNN or modified-gross; low opex.',
    asset_class: 'commercial',
    cash_flow_profile: 'hold',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Industrial LP',
      jurisdiction: 'DE', asset_location_state: 'TX',
      asset_class: 'commercial', cash_flow_profile: 'hold',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      rentable_sqft: 350000, acquisition_price: 38000000,
      annual_base_rent_psf: 8.50, rent_growth_commercial_pct: 0.03, cam_pass_through: true,
      vacancy_pct: 0.04,
      opex_ratio: 0.10, opex_growth_pct: 0.025,   // NNN: very low op-ex to landlord
      ti_lc_reserve_per_sqft: 0.40, property_tax_basis_pct: 0.022,
      closing_costs_pct: 0.015, financing_fees_pct: 0.0075,
      exit_cap_rate: 0.060, going_in_cap_rate: 0.055,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 24700000, debt_rate_pct: 0.062, debt_term_years: 7, debt_io_period_years: 3, debt_amort_years: 25, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 12700000, pref_rate_pct: 0.07, hurdle_position: 1, promote_split_pct: 0.15 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 600000 }
      ]
    }
  },

  self_storage: {
    label: 'Self-Storage',
    emoji: '📦',
    description: 'Self-storage; tenant retention; move-in/out velocity; rate optimization.',
    asset_class: 'commercial',
    cash_flow_profile: 'hold',
    tier: 'standard',
    renderQuality: 'partial',
    state: {
      project_name: 'Example Self-Storage LP',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'commercial', cash_flow_profile: 'hold',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      rentable_sqft: 65000, acquisition_price: 12500000,
      annual_base_rent_psf: 14, rent_growth_commercial_pct: 0.035, cam_pass_through: false,
      vacancy_pct: 0.10,   // physical vacancy in self-storage trades like economic vacancy
      opex_ratio: 0.32, opex_growth_pct: 0.03,
      ti_lc_reserve_per_sqft: 0.10, property_tax_basis_pct: 0.012,
      closing_costs_pct: 0.02, financing_fees_pct: 0.01,
      exit_cap_rate: 0.060, going_in_cap_rate: 0.058,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 8125000, debt_rate_pct: 0.0675, debt_term_years: 7, debt_io_period_years: 2, debt_amort_years: 30, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 3875000, pref_rate_pct: 0.08, hurdle_position: 1, promote_split_pct: 0.20 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 500000 }
      ]
    }
  },

  medical_office_life_sciences: {
    label: 'Medical Office / Life Sciences',
    emoji: '🧬',
    description: 'MOB or lab; specialized TI; longer-term leases.',
    asset_class: 'commercial',
    cash_flow_profile: 'hold',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example MOB / Life Sciences LP',
      jurisdiction: 'DE', asset_location_state: 'NC',
      asset_class: 'commercial', cash_flow_profile: 'hold',
      hold_period_years: 10, exit_strategy: 'hold_and_exit',
      rentable_sqft: 95000, acquisition_price: 32000000,
      annual_base_rent_psf: 38, rent_growth_commercial_pct: 0.03, cam_pass_through: true,
      vacancy_pct: 0.05,
      opex_ratio: 0.28, opex_growth_pct: 0.025,
      ti_lc_reserve_per_sqft: 3.50, property_tax_basis_pct: 0.012,
      closing_costs_pct: 0.02, financing_fees_pct: 0.01,
      exit_cap_rate: 0.065, going_in_cap_rate: 0.060,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 20800000, debt_rate_pct: 0.065, debt_term_years: 10, debt_io_period_years: 3, debt_amort_years: 30, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 10200000, pref_rate_pct: 0.08, hurdle_position: 1, promote_split_pct: 0.20 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 1000000 }
      ]
    }
  },

  // ============ HOSPITALITY (3) ============
  hotel_full_service: {
    label: 'Hotel — Full Service (Branded)',
    emoji: '🏨',
    description: 'Branded full-service; RevPAR/ADR/occupancy; F&B; brand royalty.',
    asset_class: 'hospitality',
    cash_flow_profile: 'hospitality',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Full-Service Hotel LP',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'hospitality', cash_flow_profile: 'hospitality',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      rooms_count: 285, acquisition_price: 78000000,
      avg_daily_rate: 285, occupancy_pct: 0.72, revpar_growth_pct: 0.03,
      fnb_pct_of_rooms: 0.40, other_dept_pct_of_rooms: 0.10,
      opex_ratio: 0.68, opex_growth_pct: 0.03,  // includes brand royalty
      ff_e_reserve_pct_of_revenue: 0.04, property_tax_basis_pct: 0.012,
      closing_costs_pct: 0.02, financing_fees_pct: 0.01,
      exit_cap_rate: 0.085, going_in_cap_rate: 0.075,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 46800000, debt_rate_pct: 0.075, debt_term_years: 7, debt_io_period_years: 2, debt_amort_years: 25, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 27200000, pref_rate_pct: 0.09, hurdle_position: 1, promote_split_pct: 0.25 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 4000000 }
      ]
    }
  },

  hotel_limited_service: {
    label: 'Hotel — Limited Service / Extended Stay',
    emoji: '🏩',
    description: 'Limited or extended-stay; lower opex; brand royalty.',
    asset_class: 'hospitality',
    cash_flow_profile: 'hospitality',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Limited-Service Hotel LP',
      jurisdiction: 'DE', asset_location_state: 'TX',
      asset_class: 'hospitality', cash_flow_profile: 'hospitality',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      rooms_count: 125, acquisition_price: 22500000,
      avg_daily_rate: 165, occupancy_pct: 0.74, revpar_growth_pct: 0.025,
      fnb_pct_of_rooms: 0.05, other_dept_pct_of_rooms: 0.03,
      opex_ratio: 0.55, opex_growth_pct: 0.03,
      ff_e_reserve_pct_of_revenue: 0.04, property_tax_basis_pct: 0.022,
      closing_costs_pct: 0.02, financing_fees_pct: 0.0125,
      exit_cap_rate: 0.090, going_in_cap_rate: 0.080,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 14625000, debt_rate_pct: 0.0775, debt_term_years: 7, debt_io_period_years: 2, debt_amort_years: 25, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 7000000, pref_rate_pct: 0.09, hurdle_position: 1, promote_split_pct: 0.20 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 875000 }
      ]
    }
  },

  hotel_boutique: {
    label: 'Hotel — Boutique / Independent',
    emoji: '🛎️',
    description: 'Independent boutique; no brand royalty; higher ADR; concentration risk.',
    asset_class: 'hospitality',
    cash_flow_profile: 'hospitality',
    tier: 'standard',
    renderQuality: 'full',
    state: {
      project_name: 'Example Boutique Hotel LP',
      jurisdiction: 'DE', asset_location_state: 'NY',
      asset_class: 'hospitality', cash_flow_profile: 'hospitality',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      rooms_count: 65, acquisition_price: 38000000,
      avg_daily_rate: 425, occupancy_pct: 0.70, revpar_growth_pct: 0.035,
      fnb_pct_of_rooms: 0.45, other_dept_pct_of_rooms: 0.08,
      opex_ratio: 0.65, opex_growth_pct: 0.035,
      ff_e_reserve_pct_of_revenue: 0.04, property_tax_basis_pct: 0.020,
      closing_costs_pct: 0.025, financing_fees_pct: 0.0125,
      exit_cap_rate: 0.080, going_in_cap_rate: 0.072,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 22800000, debt_rate_pct: 0.0775, debt_term_years: 5, debt_io_period_years: 2, debt_amort_years: 25, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 13700000, pref_rate_pct: 0.10, hurdle_position: 1, promote_split_pct: 0.25 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 1500000 }
      ]
    }
  },

  // ============ MIXED-USE (2) ============
  condo_retail_mixed: {
    label: 'Vertical Mixed-Use (Condo + Retail)',
    emoji: '🏙️',
    description: 'For-sale condos above ground-floor retail.',
    asset_class: 'mixed_use',
    cash_flow_profile: 'mixed_use',
    tier: 'standard',
    renderQuality: 'partial',
    state: {
      project_name: 'Example Mixed-Use Condo/Retail LP',
      jurisdiction: 'DE', asset_location_state: 'NY',
      asset_class: 'mixed_use', cash_flow_profile: 'mixed_use',
      hold_period_years: 4, exit_strategy: 'sell_at_completion',
      acquisition_price: 18000000, closing_costs_pct: 0.025,
      development_present: true,
      hard_costs: 62000000, soft_costs: 8500000, contingency_pct: 0.09,
      total_units_to_sell: 65, avg_sale_price: 1850000,
      sales_velocity_units_per_month: 3,
      rentable_sqft: 18500, annual_base_rent_psf: 85, vacancy_pct: 0.10,
      capital_classes: [
        { id: 'sd1', label: 'Construction Loan', type: 'sr_debt', committed: 56000000, debt_rate_pct: 0.0775, debt_term_years: 4, debt_io_period_years: 4, debt_amort_years: 0, debt_maturity_years: 4, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io' },
        { id: 'mz1', label: 'Mezzanine', type: 'mezz', committed: 12000000, debt_rate_pct: 0.13, debt_term_years: 4, debt_io_period_years: 4, debt_amort_years: 0, debt_maturity_years: 4, debt_payment_priority: 2, debt_rate_type: 'fixed', payment_basis: 'io' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 17000000, pref_rate_pct: 0.09, hurdle_position: 1, promote_split_pct: 0.25 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 3500000 }
      ]
    }
  },

  condo_hotel_retail: {
    label: 'Tri-Product Mixed-Use (Condo + Hotel + Retail)',
    emoji: '🏛️',
    description: 'Condos + hotel + retail; phased delivery; parallel streams.',
    asset_class: 'mixed_use',
    cash_flow_profile: 'mixed_use',
    tier: 'specialty',
    renderQuality: 'partial',
    state: {
      project_name: 'Example Tri-Product Mixed-Use LP',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'mixed_use', cash_flow_profile: 'mixed_use',
      hold_period_years: 5, exit_strategy: 'hold_and_exit',
      acquisition_price: 32000000, closing_costs_pct: 0.025,
      development_present: true,
      hard_costs: 175000000, soft_costs: 22000000, contingency_pct: 0.08, lease_up_costs: 6500000,
      total_units_to_sell: 95, avg_sale_price: 2250000,
      sales_velocity_units_per_month: 3,
      rooms_count: 180, avg_daily_rate: 350, occupancy_pct: 0.68,
      rentable_sqft: 32000, annual_base_rent_psf: 75,
      exit_cap_rate: 0.075, going_in_cap_rate: 0.068,
      capital_classes: [
        { id: 'sd1', label: 'Construction Loan', type: 'sr_debt', committed: 165000000, debt_rate_pct: 0.0775, debt_term_years: 4, debt_io_period_years: 4, debt_amort_years: 0, debt_maturity_years: 4, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io' },
        { id: 'mz1', label: 'Mezzanine', type: 'mezz', committed: 30000000, debt_rate_pct: 0.13, debt_term_years: 4, debt_io_period_years: 4, debt_amort_years: 0, debt_maturity_years: 4, debt_payment_priority: 2, debt_rate_type: 'fixed', payment_basis: 'io' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 51000000, pref_rate_pct: 0.10, hurdle_position: 1, promote_split_pct: 0.30 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 9000000 }
      ]
    }
  },

  // ============ DEVELOPMENT (3) ============
  dev_multifamily: {
    label: 'Ground-Up Multifamily',
    emoji: '🏗️',
    description: 'Construction loan + interest reserve + lease-up + stabilized hold + exit.',
    asset_class: 'development',
    cash_flow_profile: 'development',
    tier: 'standard',
    renderQuality: 'partial',
    state: {
      project_name: 'Example Ground-Up Multifamily LP',
      jurisdiction: 'DE', asset_location_state: 'TX',
      asset_class: 'development', cash_flow_profile: 'development',
      hold_period_years: 5, exit_strategy: 'hold_and_exit',
      units_count: 220, acquisition_price: 9500000,
      avg_unit_rent_monthly: 1850, rent_growth_pct: 0.03,
      vacancy_pct: 0.05, other_income_pct_of_rent: 0.04,
      opex_ratio: 0.35, opex_growth_pct: 0.03,
      capex_reserve_per_unit: 200, property_tax_basis_pct: 0.022, insurance_per_unit: 375,
      closing_costs_pct: 0.02, financing_fees_pct: 0.0125,
      development_present: true, hard_costs: 52000000, soft_costs: 6500000, contingency_pct: 0.08, lease_up_costs: 1850000,
      exit_cap_rate: 0.058, going_in_cap_rate: 0.055,
      capital_classes: [
        { id: 'sd1', label: 'Construction Loan', type: 'sr_debt', committed: 48000000, debt_rate_pct: 0.075, debt_term_years: 3, debt_io_period_years: 3, debt_amort_years: 0, debt_maturity_years: 3, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 18900000, pref_rate_pct: 0.09, hurdle_position: 1, promote_split_pct: 0.25 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 2950000 }
      ]
    }
  },

  dev_commercial: {
    label: 'Ground-Up Office / Industrial',
    emoji: '🏗️',
    description: 'Ground-up commercial; pre-leasing; construction-to-permanent financing.',
    asset_class: 'development',
    cash_flow_profile: 'development',
    tier: 'standard',
    renderQuality: 'partial',
    state: {
      project_name: 'Example Ground-Up Industrial LP',
      jurisdiction: 'DE', asset_location_state: 'TX',
      asset_class: 'development', cash_flow_profile: 'development',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      rentable_sqft: 425000, acquisition_price: 8500000,
      annual_base_rent_psf: 9.25, rent_growth_commercial_pct: 0.03, cam_pass_through: true,
      vacancy_pct: 0.10, opex_ratio: 0.10, opex_growth_pct: 0.025,
      ti_lc_reserve_per_sqft: 0.50, property_tax_basis_pct: 0.022,
      closing_costs_pct: 0.02, financing_fees_pct: 0.0125,
      development_present: true, hard_costs: 31500000, soft_costs: 4200000, contingency_pct: 0.08, lease_up_costs: 1800000,
      exit_cap_rate: 0.063, going_in_cap_rate: 0.058,
      capital_classes: [
        { id: 'sd1', label: 'Construction Loan', type: 'sr_debt', committed: 33000000, debt_rate_pct: 0.0725, debt_term_years: 3, debt_io_period_years: 3, debt_amort_years: 0, debt_maturity_years: 3, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 11200000, pref_rate_pct: 0.09, hurdle_position: 1, promote_split_pct: 0.25 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 1800000 }
      ]
    }
  },

  dev_hotel: {
    label: 'Ground-Up Hotel',
    emoji: '🏗️',
    description: 'Ground-up hotel; brand-required FF&E; pre-opening costs; ramp to stabilized.',
    asset_class: 'development',
    cash_flow_profile: 'development',
    tier: 'standard',
    renderQuality: 'partial',
    state: {
      project_name: 'Example Ground-Up Hotel LP',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'development', cash_flow_profile: 'development',
      hold_period_years: 7, exit_strategy: 'hold_and_exit',
      rooms_count: 195, acquisition_price: 7500000,
      avg_daily_rate: 245, occupancy_pct: 0.68, revpar_growth_pct: 0.03,
      fnb_pct_of_rooms: 0.30, other_dept_pct_of_rooms: 0.07,
      opex_ratio: 0.62, opex_growth_pct: 0.03,
      ff_e_reserve_pct_of_revenue: 0.04, property_tax_basis_pct: 0.012,
      closing_costs_pct: 0.025, financing_fees_pct: 0.015,
      development_present: true, hard_costs: 42000000, soft_costs: 5800000, contingency_pct: 0.08, pre_opening_costs: 1850000,
      exit_cap_rate: 0.083, going_in_cap_rate: 0.073,
      capital_classes: [
        { id: 'sd1', label: 'Construction Loan', type: 'sr_debt', committed: 39000000, debt_rate_pct: 0.0775, debt_term_years: 4, debt_io_period_years: 4, debt_amort_years: 0, debt_maturity_years: 4, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 14900000, pref_rate_pct: 0.10, hurdle_position: 1, promote_split_pct: 0.30 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 3250000 }
      ]
    }
  },

  // ============ SPECIALTY (5) ============
  land_entitlement: {
    label: 'Land Entitlement / Subdivision',
    emoji: '🗺️',
    description: 'Land + entitlement; improve; subdivide; sell to homebuilder.',
    asset_class: 'specialty',
    cash_flow_profile: 'for_sale',
    tier: 'specialty',
    renderQuality: 'full',
    state: {
      project_name: 'Example Land Entitlement LP',
      jurisdiction: 'DE', asset_location_state: 'TX',
      asset_class: 'specialty', cash_flow_profile: 'for_sale',
      hold_period_years: 3, exit_strategy: 'sell_at_completion',
      acquisition_price: 12000000, closing_costs_pct: 0.02,
      development_present: true,
      hard_costs: 8500000, soft_costs: 3200000, contingency_pct: 0.12,
      total_units_to_sell: 1, avg_sale_price: 32500000,   // bulk sale to homebuilder
      sales_velocity_units_per_month: 1,
      capital_classes: [
        { id: 'sd1', label: 'Land Loan', type: 'sr_debt', committed: 13500000, debt_rate_pct: 0.09, debt_term_years: 3, debt_io_period_years: 3, debt_amort_years: 0, debt_maturity_years: 3, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 8500000, pref_rate_pct: 0.10, hurdle_position: 1, promote_split_pct: 0.30 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 1700000 }
      ]
    }
  },

  nnn_single_tenant: {
    label: 'NNN Single-Tenant',
    emoji: '🏪',
    description: 'Triple-net single-tenant; long lease; minimal landlord opex.',
    asset_class: 'specialty',
    cash_flow_profile: 'hold',
    tier: 'specialty',
    renderQuality: 'full',
    state: {
      project_name: 'Example NNN Single-Tenant LP',
      jurisdiction: 'DE', asset_location_state: 'FL',
      asset_class: 'specialty', cash_flow_profile: 'hold',
      hold_period_years: 10, exit_strategy: 'hold_and_exit',
      rentable_sqft: 11500, acquisition_price: 5800000,
      annual_base_rent_psf: 35, rent_growth_commercial_pct: 0.02, cam_pass_through: true,
      vacancy_pct: 0,
      opex_ratio: 0.03, opex_growth_pct: 0.02,  // absolute NNN: only ground-lease type reserves
      ti_lc_reserve_per_sqft: 0, property_tax_basis_pct: 0.012,
      closing_costs_pct: 0.015, financing_fees_pct: 0.0075,
      exit_cap_rate: 0.062, going_in_cap_rate: 0.060,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 3770000, debt_rate_pct: 0.0625, debt_term_years: 10, debt_io_period_years: 3, debt_amort_years: 25, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'sp1', label: 'Sponsor Equity', type: 'sponsor_coinvest', committed: 2030000 }
      ]
    }
  },

  sale_leaseback: {
    label: 'Sale-Leaseback',
    emoji: '🔄',
    description: 'Acquire from operating tenant + simultaneous leaseback; bond-like cash flow.',
    asset_class: 'specialty',
    cash_flow_profile: 'hold',
    tier: 'specialty',
    renderQuality: 'full',
    state: {
      project_name: 'Example Sale-Leaseback LP',
      jurisdiction: 'DE', asset_location_state: 'NC',
      asset_class: 'specialty', cash_flow_profile: 'hold',
      hold_period_years: 15, exit_strategy: 'hold_and_exit',
      rentable_sqft: 185000, acquisition_price: 28500000,
      annual_base_rent_psf: 12, rent_growth_commercial_pct: 0.02, cam_pass_through: true,
      vacancy_pct: 0,
      opex_ratio: 0.02, opex_growth_pct: 0.02,
      ti_lc_reserve_per_sqft: 0, property_tax_basis_pct: 0.012,
      closing_costs_pct: 0.015, financing_fees_pct: 0.0075,
      exit_cap_rate: 0.075, going_in_cap_rate: 0.0775,   // SLB priced above market cap
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 18525000, debt_rate_pct: 0.0625, debt_term_years: 10, debt_io_period_years: 3, debt_amort_years: 25, debt_maturity_years: 10, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'io_then_amort' },
        { id: 'lp1', label: 'LP Common', type: 'lp_common', committed: 9275000, pref_rate_pct: 0.075, hurdle_position: 1, promote_split_pct: 0.15 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 700000 }
      ]
    }
  },

  lihtc_syndication: {
    label: 'LIHTC Syndication (§ 42)',
    emoji: '🏛️',
    description: 'Affordable; tax-credit investor at 99% LP; developer GP.',
    asset_class: 'specialty',
    cash_flow_profile: 'hold',
    tier: 'specialty',
    renderQuality: 'scaffold',
    state: {
      project_name: 'Example LIHTC Project LP',
      jurisdiction: 'DE', asset_location_state: 'NC',
      asset_class: 'specialty', cash_flow_profile: 'hold',
      hold_period_years: 15, exit_strategy: 'hold_and_exit',  // 15-year compliance period
      units_count: 120, acquisition_price: 3500000,
      avg_unit_rent_monthly: 850, rent_growth_pct: 0.02,
      vacancy_pct: 0.05, other_income_pct_of_rent: 0.02,
      opex_ratio: 0.45, opex_growth_pct: 0.03,
      capex_reserve_per_unit: 350, property_tax_basis_pct: 0,  // PILOT common
      closing_costs_pct: 0.02, financing_fees_pct: 0.0125,
      development_present: true, hard_costs: 22000000, soft_costs: 4500000, contingency_pct: 0.08,
      exit_cap_rate: 0.07, going_in_cap_rate: 0.065,
      capital_classes: [
        { id: 'sd1', label: 'Senior Loan', type: 'sr_debt', committed: 18000000, debt_rate_pct: 0.06, debt_term_years: 17, debt_io_period_years: 0, debt_amort_years: 30, debt_maturity_years: 17, debt_payment_priority: 1, debt_rate_type: 'fixed', payment_basis: 'amort' },
        { id: 'lp1', label: 'LIHTC LP (99%)', type: 'lp_common', committed: 11000000, pref_rate_pct: 0, hurdle_position: 0, promote_split_pct: 0 },
        { id: 'sp1', label: 'Developer GP (1%)', type: 'gp_interest', committed: 1000000 }
      ]
    }
  },

  qoz_investment: {
    label: 'QOZ Investment (QOF / QOZB)',
    emoji: '🌐',
    description: 'QOZ regime; QOF + QOZB structure; OZ 2.0 if post-2026 reinvestment.',
    asset_class: 'specialty',
    cash_flow_profile: 'development',
    tier: 'specialty',
    renderQuality: 'scaffold',
    state: {
      project_name: 'Example QOZ Investment LP',
      jurisdiction: 'DE', asset_location_state: 'NC',
      asset_class: 'specialty', cash_flow_profile: 'development',
      hold_period_years: 10, exit_strategy: 'hold_and_exit',  // 10-year hold for basis step-up
      units_count: 180, acquisition_price: 5500000,
      avg_unit_rent_monthly: 1750, rent_growth_pct: 0.03,
      vacancy_pct: 0.06, other_income_pct_of_rent: 0.03,
      opex_ratio: 0.38, opex_growth_pct: 0.03,
      capex_reserve_per_unit: 300, property_tax_basis_pct: 0.012, insurance_per_unit: 425,
      closing_costs_pct: 0.025, financing_fees_pct: 0.0125,
      development_present: true, hard_costs: 38000000, soft_costs: 4800000, contingency_pct: 0.08, lease_up_costs: 1100000,
      exit_cap_rate: 0.060, going_in_cap_rate: 0.058,
      capital_classes: [
        { id: 'sd1', label: 'Construction Loan', type: 'sr_debt', committed: 36000000, debt_rate_pct: 0.0775, debt_term_years: 3, debt_io_period_years: 3, debt_amort_years: 0, debt_maturity_years: 3, debt_payment_priority: 1, debt_rate_type: 'floating', payment_basis: 'io' },
        { id: 'lp1', label: 'QOF Investor Capital', type: 'lp_common', committed: 13400000, pref_rate_pct: 0.07, hurdle_position: 1, promote_split_pct: 0.20 },
        { id: 'sp1', label: 'Sponsor Co-Invest', type: 'sponsor_coinvest', committed: 1700000 }
      ]
    }
  }
};
const ECON_PRESET_KEYS = Object.keys(ECON_PRESETS);

// =============================================================================
// APPLY PRESET — merge preset.state into a fresh defaultState
// =============================================================================
function applyPreset(presetKey) {
  const preset = ECON_PRESETS[presetKey];
  if (!preset) return defaultState();
  const base = defaultState();
  // Deep-merge preset.state onto base. capital_classes overwrites entirely
  // (not merged element-wise) so preset capital stack is canonical for that
  // preset.
  const merged = Object.assign({}, base);
  Object.keys(preset.state).forEach(function (k) {
    merged[k] = preset.state[k];
  });
  // Tag the active preset
  merged.active_preset_key = presetKey;
  // Ensure math object is a fresh clone (avoid shared mutation)
  merged.math = JSON.parse(JSON.stringify(MATH_DEFAULTS));
  return merged;
}

// =============================================================================
// CAPITAL STACK ANALYSIS
// =============================================================================
// Sorts and totals the capital stack; computes per-class shares; LTV and LTC.
// =============================================================================
function analyzeCapitalStack(state) {
  const stack = (state.capital_classes || []).map(function (c) {
    return Object.assign({}, c);
  });
  // Annotate each class with rank, kind from CAPITAL_CLASS_TYPES
  stack.forEach(function (c) {
    const typeInfo = CAPITAL_CLASS_TYPES[c.type] || CAPITAL_CLASS_TYPES.other;
    c._rank = typeInfo.rank;
    c._kind = typeInfo.kind;
    c._typeLabel = typeInfo.label;
  });
  // Sort by rank ascending (senior debt first)
  stack.sort(function (a, b) { return a._rank - b._rank; });

  let totalCapital = 0, totalDebt = 0, totalEquity = 0;
  stack.forEach(function (c) {
    const amt = Number(c.committed) || 0;
    totalCapital += amt;
    if (c._kind === 'debt') totalDebt += amt;
    else totalEquity += amt;
  });

  // Per-class share of total capital
  stack.forEach(function (c) {
    const amt = Number(c.committed) || 0;
    c._pctOfStack = totalCapital > 0 ? amt / totalCapital : 0;
  });

  // Acquisition cost includes acquisition price + closing + financing fees.
  // Total project cost includes acquisition + development budget.
  const acquisitionPrice = Number(state.acquisition_price) || 0;
  const closingCosts = acquisitionPrice * (Number(state.closing_costs_pct) || 0);
  const dueDiligence = Number(state.due_diligence_costs) || 0;
  const financingFees = totalDebt * (Number(state.financing_fees_pct) || 0);
  const debtPlacementFee = totalDebt * (Number(state.debt_placement_fee_pct) || 0);

  const hardCosts = state.development_present ? (Number(state.hard_costs) || 0) : 0;
  const softCosts = state.development_present ? (Number(state.soft_costs) || 0) : 0;
  const contingency = hardCosts * (Number(state.contingency_pct) || 0);
  const interestReserve = Number(state.interest_reserve) || 0;
  const leaseUpCosts = Number(state.lease_up_costs) || 0;
  const preOpeningCosts = Number(state.pre_opening_costs) || 0;

  const totalDevelopmentBudget = hardCosts + softCosts + contingency + interestReserve + leaseUpCosts + preOpeningCosts;
  const acquisitionCost = acquisitionPrice + closingCosts + dueDiligence + financingFees + debtPlacementFee;
  const totalUses = acquisitionCost + totalDevelopmentBudget;
  const totalSources = totalCapital;

  // LTV at acquisition — debt / (acquisition price)
  const ltvAtAcquisition = acquisitionPrice > 0 ? totalDebt / acquisitionPrice : null;
  // LTC — debt / total project cost
  const ltc = totalUses > 0 ? totalDebt / totalUses : null;
  // Sources-uses gap (should be small after honest capitalization)
  const sourcesUsesGap = totalSources - totalUses;

  return {
    stack: stack,
    totals: {
      totalCapital: totalCapital,
      totalDebt: totalDebt,
      totalEquity: totalEquity,
      acquisitionPrice: acquisitionPrice,
      closingCosts: closingCosts,
      dueDiligence: dueDiligence,
      financingFees: financingFees,
      debtPlacementFee: debtPlacementFee,
      hardCosts: hardCosts,
      softCosts: softCosts,
      contingency: contingency,
      interestReserve: interestReserve,
      leaseUpCosts: leaseUpCosts,
      preOpeningCosts: preOpeningCosts,
      totalDevelopmentBudget: totalDevelopmentBudget,
      acquisitionCost: acquisitionCost,
      totalUses: totalUses,
      totalSources: totalSources,
      sourcesUsesGap: sourcesUsesGap
    },
    metrics: {
      ltvAtAcquisition: ltvAtAcquisition,
      ltc: ltc,
      equityPct: totalCapital > 0 ? totalEquity / totalCapital : null,
      debtPct: totalCapital > 0 ? totalDebt / totalCapital : null
    }
  };
}

// =============================================================================
// DEBT SERVICE COMPUTATION
// =============================================================================
// Per-tranche, per-year debt service. Handles three payment_basis modes:
//   'io'             — interest-only for entire term
//   'amort'          — principal-and-interest from year 1
//   'io_then_amort'  — interest-only for `debt_io_period_years`, then PI thereafter
// Returns array of yearly service objects per tranche, and aggregate.
// =============================================================================
function annualPaymentForAmortizing(principal, annualRate, amortYears) {
  if (annualRate === 0) return amortYears > 0 ? principal / amortYears : principal;
  const r = annualRate;
  const n = amortYears;
  return principal * (r / (1 - Math.pow(1 + r, -n)));
}

function buildDebtSchedule(state, holdYears) {
  const stack = (state.capital_classes || []).filter(function (c) {
    const ti = CAPITAL_CLASS_TYPES[c.type];
    return ti && ti.kind === 'debt';
  });
  const tranches = [];
  stack.forEach(function (c) {
    const principal = Number(c.committed) || 0;
    const rate = Number(c.debt_rate_pct) || 0;
    const ioYears = Number(c.debt_io_period_years) || 0;
    const amortYears = Number(c.debt_amort_years) || 0;
    const term = Number(c.debt_term_years) || holdYears;
    const basis = c.payment_basis || 'amort';

    let balance = principal;
    const years = [];
    let amortPayment = 0;
    if (basis === 'amort' && amortYears > 0) {
      amortPayment = annualPaymentForAmortizing(principal, rate, amortYears);
    }
    for (let y = 1; y <= holdYears; y++) {
      let interest = balance * rate;
      let principalPaid = 0;
      let yearService = 0;
      const inIoWindow = (basis === 'io_then_amort' && y <= ioYears) || (basis === 'io');
      if (inIoWindow) {
        principalPaid = 0;
        yearService = interest;
      } else {
        // Amortizing
        let payment;
        if (basis === 'io_then_amort') {
          // Re-amortize remaining balance over remaining amort years
          const remainingAmortYears = Math.max(1, amortYears - (y - ioYears - 1));
          payment = annualPaymentForAmortizing(balance, rate, remainingAmortYears);
        } else if (basis === 'amort') {
          payment = amortPayment;
        } else {
          payment = interest;
        }
        principalPaid = Math.max(0, payment - interest);
        // Don't over-amortize past balance
        if (principalPaid > balance) principalPaid = balance;
        yearService = interest + principalPaid;
      }
      const openingBalance = balance;
      balance = balance - principalPaid;
      // Maturity: if year >= term, balloon any remaining balance
      let balloon = 0;
      if (y === holdYears) {
        // At exit, remaining balance is paid off via sale proceeds (not part of operating DS).
        // Tracked separately for capital-stack repayment.
        balloon = balance;
      }
      years.push({
        year: y,
        openingBalance: openingBalance,
        interest: interest,
        principal: principalPaid,
        totalService: yearService,
        closingBalance: balance,
        balloon: balloon
      });
    }
    tranches.push({
      id: c.id,
      label: c.label,
      type: c.type,
      committed: principal,
      rate: rate,
      basis: basis,
      years: years,
      finalBalance: balance
    });
  });

  // Aggregate per year
  const aggregate = [];
  for (let y = 1; y <= holdYears; y++) {
    let interest = 0, principal = 0, total = 0, balance = 0;
    tranches.forEach(function (t) {
      if (t.years[y - 1]) {
        interest += t.years[y - 1].interest;
        principal += t.years[y - 1].principal;
        total += t.years[y - 1].totalService;
        balance += t.years[y - 1].closingBalance;
      }
    });
    aggregate.push({
      year: y,
      interest: interest,
      principal: principal,
      totalService: total,
      closingDebtBalance: balance
    });
  }
  return { tranches: tranches, aggregate: aggregate };
}

// =============================================================================
// OPERATING REVENUE — asset-class-specific revenue model
// =============================================================================
// Year 0 = stabilized baseline; thereafter grow per rent_growth.
// For 'for_sale' presets: no operating revenue from rentals; sales velocity drives revenue (handled separately).
// =============================================================================
function buildOperatingRevenue(state, year, baseYearOverride) {
  const profile = state.cash_flow_profile;
  const yearIndex = year - 1;
  if (profile === 'for_sale') {
    // No operating rental revenue
    return {
      grossPotentialRevenue: 0,
      vacancyLoss: 0,
      otherIncome: 0,
      effectiveGrossRevenue: 0,
      breakdown: { kind: 'for_sale', noRevenue: true }
    };
  }
  if (profile === 'hospitality' || (profile === 'hold' && state.asset_class === 'hospitality')) {
    // RevPAR-driven
    const rooms = Number(state.rooms_count) || 0;
    const baseAdr = Number(state.avg_daily_rate) || 0;
    const occ = Number(state.occupancy_pct) || 0;
    const growth = Number(state.revpar_growth_pct) || 0;
    const adr = baseAdr * Math.pow(1 + growth, yearIndex);
    const roomRev = rooms * adr * occ * 365;
    const fnbRev = roomRev * (Number(state.fnb_pct_of_rooms) || 0);
    const otherDeptRev = roomRev * (Number(state.other_dept_pct_of_rooms) || 0);
    return {
      grossPotentialRevenue: roomRev + fnbRev + otherDeptRev,
      vacancyLoss: 0,  // occupancy is already in computation
      otherIncome: fnbRev + otherDeptRev,
      effectiveGrossRevenue: roomRev + fnbRev + otherDeptRev,
      breakdown: { kind: 'hospitality', adr: adr, occupancy: occ, rooms: rooms, roomRevenue: roomRev, fnb: fnbRev, otherDept: otherDeptRev }
    };
  }
  // Residential vs commercial hold (specialty grouped with commercial — $/sqft pricing)
  if (state.asset_class === 'commercial' || state.asset_class === 'specialty') {
    const sqft = Number(state.rentable_sqft) || 0;
    const baseRent = Number(state.annual_base_rent_psf) || 0;
    const growth = Number(state.rent_growth_commercial_pct) || 0;
    const rentThisYear = baseRent * Math.pow(1 + growth, yearIndex);
    const gpr = sqft * rentThisYear;
    const vacancy = gpr * (Number(state.vacancy_pct) || 0);
    const camOther = state.cam_pass_through ? gpr * 0.10 : 0;  // simplified pass-through reimb
    const egr = gpr - vacancy + camOther;
    return {
      grossPotentialRevenue: gpr,
      vacancyLoss: vacancy,
      otherIncome: camOther,
      effectiveGrossRevenue: egr,
      breakdown: { kind: 'commercial', sqft: sqft, rentPsf: rentThisYear }
    };
  }
  // Default residential hold (also catches mixed_use, development on the residential side once stabilized)
  const units = Number(state.units_count) || 0;
  const baseRent = Number(state.avg_unit_rent_monthly) || 0;
  const growth = Number(state.rent_growth_pct) || 0;
  const rentThisYear = baseRent * Math.pow(1 + growth, yearIndex);
  const gpr = units * rentThisYear * 12;
  const vacancy = gpr * (Number(state.vacancy_pct) || 0);
  const otherIncome = gpr * (Number(state.other_income_pct_of_rent) || 0);
  const egr = gpr - vacancy + otherIncome;
  return {
    grossPotentialRevenue: gpr,
    vacancyLoss: vacancy,
    otherIncome: otherIncome,
    effectiveGrossRevenue: egr,
    breakdown: { kind: 'residential', units: units, rentPerUnitMonthly: rentThisYear }
  };
}

// =============================================================================
// OPERATING EXPENSES — based on EGR + per-asset-class adjustments
// =============================================================================
function buildOperatingExpenses(state, year, egr) {
  const yearIndex = year - 1;
  const opexGrowth = Number(state.opex_growth_pct) || 0;
  const baseRatio = Number(state.opex_ratio) || 0;
  const acquisitionPrice = Number(state.acquisition_price) || 0;
  const ptBasis = Number(state.property_tax_basis_pct) || 0;
  // Operating opex as ratio of EGR, grown
  const opexCore = egr * baseRatio * Math.pow(1 + opexGrowth, 0);  // ratio already applies in this year; growth handled via EGR + ratio applied as static ratio (acceptable simplification for Thread 1)
  // Property tax — separate line, grows with assessed value (simplified: 2% per year)
  const propertyTax = acquisitionPrice * ptBasis * Math.pow(1.02, yearIndex);
  // Per-asset-class reserves
  let capexReserve = 0, tiLcReserve = 0, ffeReserve = 0, insurance = 0;
  if (state.asset_class === 'residential') {
    capexReserve = (Number(state.units_count) || 0) * (Number(state.capex_reserve_per_unit) || 0) * Math.pow(1 + opexGrowth, yearIndex);
    insurance = (Number(state.units_count) || 0) * (Number(state.insurance_per_unit) || 0) * Math.pow(1 + opexGrowth, yearIndex);
  } else if (state.asset_class === 'commercial' || state.asset_class === 'specialty') {
    tiLcReserve = (Number(state.rentable_sqft) || 0) * (Number(state.ti_lc_reserve_per_sqft) || 0) * Math.pow(1 + opexGrowth, yearIndex);
  } else if (state.asset_class === 'hospitality') {
    ffeReserve = egr * (Number(state.ff_e_reserve_pct_of_revenue) || 0);
  }
  const totalOpex = opexCore + propertyTax + capexReserve + tiLcReserve + ffeReserve + insurance;
  return {
    operatingExpensesCore: opexCore,
    propertyTax: propertyTax,
    capexReserve: capexReserve,
    tiLcReserve: tiLcReserve,
    ffeReserve: ffeReserve,
    insurance: insurance,
    totalOperatingExpenses: totalOpex
  };
}

// =============================================================================
// PRO FORMA — Year 1 through hold period
// =============================================================================
function buildProForma(state, debtSchedule) {
  const years = [];
  const hold = Math.max(1, Number(state.hold_period_years) || 1);
  // For-sale presets: revenue is sales, not operating rent. We still build an
  // operating skeleton so the structure is consistent; revenue lines will be 0
  // and a separate `salesProceeds` array tracks sales.
  for (let y = 1; y <= hold; y++) {
    const rev = buildOperatingRevenue(state, y);
    const opex = buildOperatingExpenses(state, y, rev.effectiveGrossRevenue);
    const noi = rev.effectiveGrossRevenue - opex.totalOperatingExpenses;
    const ds = debtSchedule.aggregate[y - 1] || { interest: 0, principal: 0, totalService: 0, closingDebtBalance: 0 };
    const cfbt = noi - ds.totalService;
    const unleveredCf = noi;
    years.push({
      year: y,
      revenue: rev,
      operatingExpenses: opex,
      noi: noi,
      debtService: ds,
      cashFlowBeforeTax: cfbt,
      unleveredCashFlow: unleveredCf,
      dscr: ds.totalService > 0 ? noi / ds.totalService : null,
      debtYield: ds.closingDebtBalance > 0 ? noi / ds.closingDebtBalance : null
    });
  }
  return years;
}

// =============================================================================
// FOR-SALE REVENUE — sales velocity, sale price, total revenue per year
// =============================================================================
function buildForSaleRevenue(state) {
  if (state.cash_flow_profile !== 'for_sale' && state.cash_flow_profile !== 'mixed_use') {
    return null;
  }
  const totalUnits = Number(state.total_units_to_sell) || 0;
  const avgPrice = Number(state.avg_sale_price) || 0;
  const velocity = Number(state.sales_velocity_units_per_month) || 0;
  const priceGrowth = Number(state.sale_price_growth_pct) || 0;
  const hold = Math.max(1, Number(state.hold_period_years) || 1);

  const years = [];
  let unitsRemaining = totalUnits;
  for (let y = 1; y <= hold; y++) {
    // Allow 12 months of velocity per year; ignore initial development lag for Thread 1 simplicity
    // (Thread 5 layers in pre-sales / construction-overlap modeling).
    let unitsThisYear = Math.min(unitsRemaining, velocity * 12);
    // Allow construction year to have zero sales for typical condo dev:
    // for simplicity assume sales begin in final year for short-cycle, or
    // distribute across construction + delivery for longer cycles.
    if (state.cash_flow_profile === 'for_sale' && state.development_present && y < hold) {
      // No deliveries until final year for simple spec/flip/conversion presets
      unitsThisYear = 0;
    }
    if (state.cash_flow_profile === 'for_sale' && y === hold) {
      unitsThisYear = unitsRemaining;  // close out all remaining units in final year
    }
    const priceThisYear = avgPrice * Math.pow(1 + priceGrowth, y - 1);
    const gross = unitsThisYear * priceThisYear;
    unitsRemaining -= unitsThisYear;
    years.push({
      year: y,
      unitsSold: unitsThisYear,
      averageSalePrice: priceThisYear,
      grossSalesRevenue: gross,
      unitsRemainingEoy: unitsRemaining
    });
  }
  return { years: years, totalUnitsAtStart: totalUnits, finalUnitsRemaining: unitsRemaining };
}

// =============================================================================
// EXIT CALCULATION — disposition at end of hold
// =============================================================================
function computeExit(state, proForma, debtSchedule, capStack) {
  const hold = proForma.length;
  if (hold === 0) return null;
  const finalYear = proForma[hold - 1];
  let grossExit = 0;
  let methodNote = '';

  if (state.cash_flow_profile === 'for_sale') {
    // Exit value = remaining sales revenue in final year (already captured); 
    // disposition costs apply per-unit-sale rather than wholesale.
    grossExit = 0;
    methodNote = 'For-sale: revenue captured through unit sales; no terminal-cap exit.';
  } else {
    // Standard cap-rate exit: forward NOI / exit cap rate
    // Use Year N+1 NOI estimate = final-year NOI * (1 + rent growth)
    const profile = state.cash_flow_profile;
    let nextNoi = finalYear.noi;
    if (profile !== 'for_sale') {
      const growthApprox = state.asset_class === 'commercial' ? (Number(state.rent_growth_commercial_pct) || 0) :
                          state.asset_class === 'hospitality' ? (Number(state.revpar_growth_pct) || 0) :
                          (Number(state.rent_growth_pct) || 0);
      nextNoi = finalYear.noi * (1 + growthApprox);
    }
    const exitCap = Number(state.exit_cap_rate) || 0.07;
    grossExit = exitCap > 0 ? nextNoi / exitCap : 0;
    methodNote = 'Cap-rate exit: Year ' + (hold + 1) + ' NOI / exit cap (' + (exitCap * 100).toFixed(2) + '%).';
  }

  // Disposition costs
  let dispositionCosts = 0;
  let costsBreakdown = {};
  if ((state.disposition_costs_method || state.math.disposition_costs_method) === 'lump') {
    dispositionCosts = grossExit * (Number(state.math.disposition_costs_lump_pct) || 0.01);
    costsBreakdown = { lump: dispositionCosts };
  } else {
    const stInfo = stateInfo(state.asset_location_state);
    const transferTax = grossExit * (stInfo.transferBps / 10000);
    const brokerage = grossExit * (Number(state.disposition_brokerage_pct) || 0);
    const legal = Number(state.disposition_legal_psf) || 0;
    const other = Number(state.disposition_other_costs) || 0;
    dispositionCosts = transferTax + brokerage + legal + other;
    costsBreakdown = { transferTax: transferTax, brokerage: brokerage, legal: legal, other: other };
  }

  // Debt payoff = remaining debt balance at end of hold (the balloon from each tranche)
  let debtPayoff = 0;
  debtSchedule.tranches.forEach(function (t) {
    if (t.years.length > 0) {
      const last = t.years[t.years.length - 1];
      debtPayoff += last.closingBalance;
    }
  });

  // Net sale proceeds to equity
  // For for-sale: we already captured revenue through unit sales; no separate exit.
  // For hold: gross exit - disposition - debt payoff = equity proceeds
  const equityProceeds = state.cash_flow_profile === 'for_sale' ? 0 : (grossExit - dispositionCosts - debtPayoff);

  return {
    grossExit: grossExit,
    methodNote: methodNote,
    dispositionCosts: dispositionCosts,
    dispositionCostsBreakdown: costsBreakdown,
    debtPayoff: debtPayoff,
    equityProceeds: equityProceeds,
    exitYear: hold
  };
}

// =============================================================================
// DEAL-LEVEL RETURNS — IRR / MOIC / cash-on-cash
// =============================================================================
// Per-class returns come in Thread 3 after waterfall execution. Thread 1
// computes deal-level returns to equity (treating all equity as one bucket),
// LP IRR (treating LP common + LP pref as a bucket), and sponsor IRR (sponsor
// co-invest as a bucket; promote impact comes in Thread 3).
// =============================================================================
function computeDealReturns(state, capStack, proForma, exit, forSaleRevenue, debtSchedule) {
  // Equity invested at t=0 (negative)
  let totalEquityInvested = 0;
  const equityClasses = capStack.stack.filter(function (c) { return c._kind === 'equity'; });
  equityClasses.forEach(function (c) { totalEquityInvested += Number(c.committed) || 0; });
  const lpClasses = capStack.stack.filter(function (c) {
    return c.type === 'lp_common' || c.type === 'lp_pref';
  });
  const sponsorClasses = capStack.stack.filter(function (c) {
    return c.type === 'sponsor_coinvest' || c.type === 'gp_interest';
  });
  let lpEquity = 0; lpClasses.forEach(function (c) { lpEquity += Number(c.committed) || 0; });
  let sponsorEquity = 0; sponsorClasses.forEach(function (c) { sponsorEquity += Number(c.committed) || 0; });

  // Deal-level CF series: t=0 negative equity; Years 1..N cash flow before tax (after debt service); plus exit proceeds in final year
  const cfDeal = [-totalEquityInvested];
  const cfLp = [-lpEquity];
  const cfSponsor = [-sponsorEquity];
  const hold = proForma.length;
  for (let y = 1; y <= hold; y++) {
    let cfThisYear = proForma[y - 1].cashFlowBeforeTax;
    // For-sale: add sales revenue this year (less debt service from above)
    if (forSaleRevenue && forSaleRevenue.years && forSaleRevenue.years[y - 1]) {
      cfThisYear += forSaleRevenue.years[y - 1].grossSalesRevenue;
    }
    if (y === hold && exit) {
      // For-sale: equity proceeds already captured. For hold: add exit equity proceeds + final debt payoff offset already handled above
      cfThisYear += exit.equityProceeds;
      if (state.cash_flow_profile === 'for_sale') {
        // Final year: subtract debt payoff via final balloon
        let balloonOut = 0;
        debtSchedule.tranches.forEach(function (t) {
          const last = t.years[t.years.length - 1];
          if (last) balloonOut += last.closingBalance;
        });
        cfThisYear -= balloonOut;
      }
    }
    cfDeal.push(cfThisYear);
    // LP / Sponsor split — Thread 1 simplifying assumption: split deal CFs by equity share until waterfall ships in Thread 3
    const lpShare = totalEquityInvested > 0 ? lpEquity / totalEquityInvested : 0;
    const spShare = totalEquityInvested > 0 ? sponsorEquity / totalEquityInvested : 0;
    cfLp.push(cfThisYear * lpShare);
    cfSponsor.push(cfThisYear * spShare);
  }

  const dealIrr = computeIRR(cfDeal);
  const lpIrr = computeIRR(cfLp);
  const sponsorIrr = computeIRR(cfSponsor);
  const moic = computeMOIC(cfDeal);
  const lpMoic = computeMOIC(cfLp);
  const spMoic = computeMOIC(cfSponsor);

  // Hold yield — average annual CF / total equity (excludes exit)
  let totalAnnualCfExHand = 0;
  for (let y = 1; y < cfDeal.length - 1; y++) totalAnnualCfExHand += cfDeal[y];
  // Include final year operating component only (exclude exit proceeds)
  if (hold > 0 && proForma[hold - 1]) totalAnnualCfExHand += proForma[hold - 1].cashFlowBeforeTax;
  const avgAnnualCf = hold > 0 ? totalAnnualCfExHand / hold : 0;
  const holdYield = totalEquityInvested > 0 ? avgAnnualCf / totalEquityInvested : null;

  return {
    cfDeal: cfDeal,
    cfLp: cfLp,
    cfSponsor: cfSponsor,
    dealIrr: dealIrr,
    lpIrr: lpIrr,
    sponsorIrr: sponsorIrr,
    moic: moic,
    lpMoic: lpMoic,
    sponsorMoic: spMoic,
    holdYield: holdYield,
    totalEquityInvested: totalEquityInvested,
    lpEquity: lpEquity,
    sponsorEquity: sponsorEquity,
    note: 'Per-class returns split by equity share for Thread 1; full per-partner waterfall ships Thread 3.'
  };
}

// =============================================================================
// SENSITIVITY GRID — two-variable
// =============================================================================
// Default axes per cash_flow_profile, per handoff §11.2:
//   hold:       rent_growth × exit_cap
//   for_sale:   sales_velocity × sales_price
//   hospitality: occupancy × ADR
// Each axis: 5 perturbations around the base. Output: 5×5 grid of deal IRR.
// =============================================================================
function runSensitivity(state) {
  const xAxis = state.sensitivity_axis_x || 'rent_growth';
  const yAxis = state.sensitivity_axis_y || 'exit_cap';
  const xRange = state.sensitivity_x_range || [-0.02, -0.01, 0, 0.01, 0.02];
  const yRange = state.sensitivity_y_range || [-0.01, -0.005, 0, 0.005, 0.01];
  const grid = [];
  for (let j = 0; j < yRange.length; j++) {
    const row = [];
    for (let i = 0; i < xRange.length; i++) {
      const scenario = JSON.parse(JSON.stringify(state));
      // Apply X axis delta
      switch (xAxis) {
        case 'rent_growth':
          scenario.rent_growth_pct = (Number(state.rent_growth_pct) || 0) + xRange[i];
          scenario.rent_growth_commercial_pct = (Number(state.rent_growth_commercial_pct) || 0) + xRange[i];
          break;
        case 'sales_velocity':
          scenario.sales_velocity_units_per_month = Math.max(0.1, (Number(state.sales_velocity_units_per_month) || 1) + xRange[i]);
          break;
        case 'occupancy':
          scenario.occupancy_pct = Math.max(0.01, Math.min(1, (Number(state.occupancy_pct) || 0.65) + xRange[i]));
          break;
      }
      // Apply Y axis delta
      switch (yAxis) {
        case 'exit_cap':
          scenario.exit_cap_rate = Math.max(0.01, (Number(state.exit_cap_rate) || 0.07) + yRange[j]);
          break;
        case 'sales_price':
          scenario.avg_sale_price = (Number(state.avg_sale_price) || 0) * (1 + yRange[j]);
          break;
        case 'adr':
          scenario.avg_daily_rate = (Number(state.avg_daily_rate) || 0) * (1 + yRange[j]);
          break;
      }
      // Recurse: light analysis just for IRR
      const capStack = analyzeCapitalStack(scenario);
      const debt = buildDebtSchedule(scenario, Math.max(1, Number(scenario.hold_period_years) || 1));
      const pf = buildProForma(scenario, debt);
      const fsR = buildForSaleRevenue(scenario);
      const exit = computeExit(scenario, pf, debt, capStack);
      const ret = computeDealReturns(scenario, capStack, pf, exit, fsR, debt);
      row.push(ret.dealIrr);
    }
    grid.push(row);
  }
  return {
    xAxis: xAxis, yAxis: yAxis,
    xRange: xRange, yRange: yRange,
    grid: grid
  };
}

// =============================================================================
// BREAK-EVEN ANALYSIS
// =============================================================================
function computeBreakEven(state, proForma, capStack, debtSchedule) {
  // Occupancy break-even — at what occupancy does NOI = debt service?
  // Approximate using Year 1 economics.
  const yr1 = proForma[0];
  if (!yr1) return { note: 'No pro-forma data.' };
  const debtY1 = yr1.debtService.totalService;

  let occupancyBreakEven = null;
  if (state.cash_flow_profile === 'hospitality' || state.asset_class === 'hospitality') {
    // RevPAR-driven
    const rev = yr1.revenue;
    const opex = yr1.operatingExpenses.totalOperatingExpenses;
    if (rev.effectiveGrossRevenue > 0 && (Number(state.occupancy_pct) || 0) > 0) {
      const revPerOccPoint = rev.effectiveGrossRevenue / state.occupancy_pct;
      const requiredRevenue = opex + debtY1;
      occupancyBreakEven = revPerOccPoint > 0 ? requiredRevenue / revPerOccPoint : null;
    }
  } else if (state.cash_flow_profile !== 'for_sale') {
    // Residential / commercial: vacancy break-even
    const rev = yr1.revenue;
    const opex = yr1.operatingExpenses.totalOperatingExpenses;
    const gpr = rev.grossPotentialRevenue;
    if (gpr > 0) {
      // NOI = (1-v) * GPR + otherIncome - opex = debt service
      // (1-v) * GPR = debt + opex - otherIncome
      const required = debtY1 + opex - rev.otherIncome;
      const maxVac = 1 - (required / gpr);
      // Convert maxVac (max sustainable vacancy) to break-even occupancy
      occupancyBreakEven = Math.max(0, Math.min(1, 1 - maxVac));
    }
  }

  // Debt yield break-even — NOI / debt at standard institutional threshold
  // Convention: 8% debt-yield is the soft floor; report current vs threshold
  const totalDebt = capStack.totals.totalDebt;
  const yr1DebtYield = totalDebt > 0 ? yr1.noi / totalDebt : null;
  const debtYieldThreshold = 0.08;

  // Sale-price break-even (for for-sale): unit price at which exit equity proceeds = 0 (all equity at risk recovered)
  let salePriceBreakEven = null;
  if (state.cash_flow_profile === 'for_sale' && state.total_units_to_sell > 0) {
    // Total equity to recover
    let totalEquity = 0;
    capStack.stack.forEach(function (c) { if (c._kind === 'equity') totalEquity += Number(c.committed) || 0; });
    // Total debt to repay
    let totalDebtPayoff = 0;
    debtSchedule.tranches.forEach(function (t) { totalDebtPayoff += Number(t.committed) || 0; });
    // Disposition costs scale with revenue; simplified to 5% lump for break-even
    const requiredRevenue = (totalEquity + totalDebtPayoff) / (1 - 0.05);
    salePriceBreakEven = requiredRevenue / state.total_units_to_sell;
  }

  return {
    occupancyBreakEven: occupancyBreakEven,
    yearOneDebtYield: yr1DebtYield,
    debtYieldThreshold: debtYieldThreshold,
    debtYieldMargin: yr1DebtYield != null ? yr1DebtYield - debtYieldThreshold : null,
    salePriceBreakEven: salePriceBreakEven,
    yearOneDscr: yr1.dscr
  };
}


// =============================================================================
// FEASIBILITY — top-level analytical wrapper for Thread 1
// =============================================================================
function analyzeFeasibility(state) {
  const capStack = analyzeCapitalStack(state);
  const hold = Math.max(1, Number(state.hold_period_years) || 1);
  const debt = buildDebtSchedule(state, hold);
  const proForma = buildProForma(state, debt);
  const forSaleRevenue = buildForSaleRevenue(state);
  const exit = computeExit(state, proForma, debt, capStack);
  const returns = computeDealReturns(state, capStack, proForma, exit, forSaleRevenue, debt);
  const sensitivity = runSensitivity(state);
  const breakEven = computeBreakEven(state, proForma, capStack, debt);

  // Per-year LTV — Year-end debt balance / current asset value
  // For Thread 1 we mark to value via Y1 NOI / going-in cap (approximate) and
  // grow asset value with NOI growth proxy.
  const ltvByYear = [];
  let approxValue = (Number(state.acquisition_price) || 0);
  if (proForma[0] && proForma[0].noi > 0 && (Number(state.going_in_cap_rate) || 0) > 0) {
    approxValue = proForma[0].noi / state.going_in_cap_rate;
  }
  proForma.forEach(function (yr, idx) {
    const debtBal = yr.debtService.closingDebtBalance;
    // Mark-to-market value approximate: Y1 value grown at rent growth as a proxy
    const growthApprox = state.asset_class === 'commercial' ? (Number(state.rent_growth_commercial_pct) || 0) :
                        state.asset_class === 'hospitality' ? (Number(state.revpar_growth_pct) || 0) :
                        (Number(state.rent_growth_pct) || 0);
    const yearValue = approxValue * Math.pow(1 + growthApprox, idx);
    ltvByYear.push({
      year: yr.year,
      value: yearValue,
      debtBalance: debtBal,
      ltv: yearValue > 0 ? debtBal / yearValue : null
    });
  });

  return {
    state: state,
    capStack: capStack,
    debtSchedule: debt,
    proForma: proForma,
    forSaleRevenue: forSaleRevenue,
    exit: exit,
    returns: returns,
    sensitivity: sensitivity,
    breakEven: breakEven,
    ltvByYear: ltvByYear,
    summary: (function () {
      const acq = capStack.totals.acquisitionPrice || 0;
      const y1NOI = proForma[0] ? proForma[0].noi : 0;
      const impliedCapAtAcq = acq > 0 && y1NOI > 0 ? y1NOI / acq : null;
      const targetCap = Number(state.going_in_cap_rate) || null;
      const isForSale = state.cash_flow_profile === 'for_sale' || state.cash_flow_profile === 'development';
      const qualityFlags = [];
      if (isForSale && (y1NOI || 0) <= 0) qualityFlags.push('NO_RENTAL_INCOME_Y1');
      if (capStack.totals.totalDebt > acq && acq > 0) qualityFlags.push('LTV_OVER_ACQUISITION');
      if (!isForSale && impliedCapAtAcq != null && targetCap != null && impliedCapAtAcq < targetCap * 0.9) qualityFlags.push('IMPLIED_CAP_BELOW_TARGET');
      if (!isForSale && proForma[0] && proForma[0].dscr != null && proForma[0].dscr < 1.0) qualityFlags.push('Y1_DSCR_BELOW_1');
      if (returns.dealIrr == null || !isFinite(returns.dealIrr)) qualityFlags.push('IRR_DID_NOT_CONVERGE');
      if (returns.moic != null && returns.moic < 0.8) qualityFlags.push('LOSS_OF_CAPITAL');
      return {
        preset: state.active_preset_key || 'custom',
        dealType: state.deal_type,
        assetClass: state.asset_class,
        cashFlowProfile: state.cash_flow_profile,
        holdYears: hold,
        // Capital
        totalCapital: capStack.totals.totalCapital,
        totalDebt: capStack.totals.totalDebt,
        totalEquity: capStack.totals.totalEquity,
        equityRequired: capStack.totals.totalEquity,
        acquisitionPrice: acq,
        totalUses: capStack.totals.totalUses,
        sourcesUsesGap: capStack.totals.sourcesUsesGap,
        // Leverage
        ltvAtAcquisition: capStack.metrics.ltvAtAcquisition,
        ltc: capStack.metrics.ltc,
        // Cap rates
        impliedGoingInCap: impliedCapAtAcq,
        targetGoingInCap: targetCap,
        exitCapRate: Number(state.exit_cap_rate) || null,
        // Returns
        dealIrr: returns.dealIrr,
        lpIrr: returns.lpIrr,
        sponsorIrr: returns.sponsorIrr,
        moic: returns.moic,
        lpMoic: returns.lpMoic,
        holdYield: returns.holdYield,
        // Coverage
        year1Dscr: proForma[0] && !isForSale ? proForma[0].dscr : null,
        yearFinalDscr: proForma[hold - 1] && !isForSale ? proForma[hold - 1].dscr : null,
        year1DebtYield: proForma[0] && !isForSale ? proForma[0].debtYield : null,
        // Exit
        exitValue: exit.grossExit,
        netExitProceeds: exit.equityProceeds,
        debtPayoffAtExit: exit.debtPayoff,
        dispositionCostsAtExit: exit.dispositionCosts,
        // Quality
        qualityFlags: qualityFlags,
        // For-sale specific
        forSaleTotalRevenue: forSaleRevenue ? forSaleRevenue.years.reduce(function (a, y) { return a + y.grossSalesRevenue; }, 0) : null
      };
    })()
  };
}

// =============================================================================
// HANDOFF PAYLOAD — outgoing schema (donovan_legal_economics_outcome_v1)
// =============================================================================
function buildOutgoingPayload(state, analysis) {
  const capStack = analysis.capStack;
  const returns = analysis.returns;
  return {
    schema_version: '1.0',
    generated_at: new Date().toISOString(),
    source_tool: 'economics',
    source_tool_version: 'v1',
    project_name: state.project_name || '',
    matter_no: state.matter_no || '',
    effective_date: state.effective_date || todayISO(),
    deal_type: state.active_preset_key || state.deal_type || '',
    asset_class: state.asset_class || '',
    jurisdiction: state.jurisdiction || '',
    asset_location_state: state.asset_location_state || '',
    hold_period_years: Number(state.hold_period_years) || 0,
    exit_strategy: state.exit_strategy || 'hold_and_exit',
    total_capitalization: capStack.totals.totalCapital,
    equity_required: capStack.totals.totalEquity,
    debt_capital: capStack.totals.totalDebt,
    capital_classes: (state.capital_classes || []).map(function (c) {
      return {
        class_name: c.label || '',
        class_type: c.type || 'other',
        capital_committed: Number(c.committed) || 0,
        pref_rate_pct: c.pref_rate_pct != null ? Number(c.pref_rate_pct) : null,
        hurdle_position: Number(c.hurdle_position) || 0,
        promote_split_pct: c.promote_split_pct != null ? Number(c.promote_split_pct) : null
      };
    }),
    sponsor: {
      form: state.sponsor_form || 'llc',
      coinvest_pct: Number(state.sponsor_coinvest_pct) || 0,
      has_gp: !!state.sponsor_has_gp,
      has_carry_vehicle: !!state.sponsor_has_carry_vehicle
    },
    deal_returns_summary: {
      sponsor_irr_pct: returns.sponsorIrr,
      lp_irr_pct: returns.lpIrr,
      moic: returns.moic,
      hold_yield_pct: returns.holdYield
    },
    structuring_handoff_hints: {
      recommended_entity_type: 'us_llc',
      recommended_proposed_member_count: ((state.capital_classes || []).filter(function (c) {
        return CAPITAL_CLASS_TYPES[c.type] && CAPITAL_CLASS_TYPES[c.type].kind === 'equity';
      }).length > 1) ? 'two_or_more' : 'one_member',
      investors_outline: (state.capital_classes || [])
        .filter(function (c) { return CAPITAL_CLASS_TYPES[c.type] && CAPITAL_CLASS_TYPES[c.type].kind === 'equity'; })
        .map(function (c) {
          const total = capStack.totals.totalEquity;
          const pct = total > 0 ? (Number(c.committed) || 0) / total : 0;
          return {
            label: c.label,
            route_hint: c.type === 'sponsor_coinvest' ? 'sponsor_individual' : 'domestic_individual',
            pct: round4(pct)
          };
        })
    }
  };
}

// =============================================================================
// HANDOFF INTAKE — read sibling-tool keys and offer pre-population
// =============================================================================
// Sibling keys to check (priority order):
//   1. donovan_legal_structuring_outcome_v1   (Structuring outgoing; full intake)
//   2. donovan_oa_generator_v1                (12-Step draft; primary EF intake per partner directive)
//   3. donovan_legal_ef_multi_draft_v1        (Multi-Eight draft; secondary EF intake)
//   4. donovan_legal_ef_12step_outcome_v1     (future 12-Step outgoing; parser ready)
//   5. donovan_legal_ef_multi_outcome_v1      (future Multi-Eight outgoing; parser ready)
//   6. donovan_legal_ef_single_outcome_v1     (future Single-Member outgoing; parser ready)
// =============================================================================
const HANDOFF_SOURCES = [
  { key: 'donovan_legal_structuring_outcome_v1', label: 'Structuring Tool', kind: 'structuring', priority: 1 },
  { key: 'donovan_oa_generator_v1',              label: '12-Step (draft)',  kind: '12step_draft', priority: 2 },
  { key: 'donovan_legal_ef_multi_draft_v1',      label: 'Multi-Eight (draft)', kind: 'multi_eight_draft', priority: 3 },
  { key: 'donovan_legal_ef_12step_outcome_v1',   label: '12-Step (outgoing)', kind: '12step_outgoing', priority: 4 },
  { key: 'donovan_legal_ef_multi_outcome_v1',    label: 'Multi-Eight (outgoing)', kind: 'multi_eight_outgoing', priority: 5 },
  { key: 'donovan_legal_ef_single_outcome_v1',   label: 'Single-Member (outgoing)', kind: 'single_member_outgoing', priority: 6 }
];

function scanHandoffSources() {
  const results = [];
  if (typeof localStorage === 'undefined') return results;
  HANDOFF_SOURCES.forEach(function (src) {
    try {
      const raw = localStorage.getItem(src.key);
      if (raw) {
        const parsed = JSON.parse(raw);
        results.push(Object.assign({}, src, { payload: parsed }));
      }
    } catch (e) {
      // silent — corrupt payload; skip
    }
  });
  return results.sort(function (a, b) { return a.priority - b.priority; });
}

function applyHandoffIntake(state, source) {
  if (!source || !source.payload) return state;
  const newState = JSON.parse(JSON.stringify(state));
  const p = source.payload;
  // Mapping varies by kind
  switch (source.kind) {
    case 'structuring':
      // From donovan_legal_structuring_outcome_v1
      if (p.project_name)     newState.project_name = p.project_name;
      if (p.matter_no)        newState.matter_no = p.matter_no;
      if (p.jurisdiction)     newState.jurisdiction = p.jurisdiction;
      if (p.asset_location_state) newState.asset_location_state = p.asset_location_state;
      if (p.effective_date)   newState.effective_date = p.effective_date;
      if (p.asset_type) {
        // Map structuring asset_type → economics asset_class
        const mp = {
          'real_estate_operating':   'residential',
          'real_estate_development': 'development',
          'investment_fund':         'specialty',
          'operating_business':      'commercial',
          'mixed':                   'mixed_use'
        };
        newState.asset_class = mp[p.asset_type] || 'residential';
      }
      // Investor panel → capital classes outline
      if (Array.isArray(p.investors) && p.investors.length > 0) {
        newState.capital_classes = p.investors.map(function (inv, i) {
          return {
            id: 'lp' + (i + 1),
            label: inv.label || ('Investor ' + (i + 1)),
            type: 'lp_common',
            committed: 0,  // requires user input
            pref_rate_pct: null,
            hurdle_position: 0,
            promote_split_pct: null
          };
        });
      }
      break;
    case '12step_draft':
      // From donovan_oa_generator_v1 (the 12-Step OA Generator draft state)
      if (p.companyName && p.companyName !== '_______________') newState.project_name = p.companyName;
      if (p.jurisdiction)   newState.jurisdiction = p.jurisdiction;
      if (p.effectiveDate)  newState.effective_date = p.effectiveDate;
      // entityStructure (single | holdco_opco) — informs handoff hints; no direct state mapping in Thread 1
      // members[] / classes[] → capital_classes outline
      if (Array.isArray(p.classes) && p.classes.length > 0) {
        newState.capital_classes = p.classes.map(function (cls, i) {
          // Translate OA class structure to Economics capital_classes
          // OA class has: name, type ('common'|'preferred'), capitalContribution, prefReturn etc.
          let econType = 'lp_common';
          if (cls.type === 'preferred' || cls.isPreferred) econType = 'lp_pref';
          if (i === 0 && p.entityStructure === 'single') econType = 'lp_common';
          return {
            id: 'c' + (i + 1),
            label: cls.name || cls.label || ('Class ' + String.fromCharCode(65 + i)),
            type: econType,
            committed: Number(cls.capitalContribution) || 0,
            pref_rate_pct: cls.prefReturn ? Number(cls.prefReturn) : (Number(p.prefReturnRate) || null),
            hurdle_position: cls.hurdleNumber || 0,
            promote_split_pct: cls.promoteSplit ? Number(cls.promoteSplit) : null
          };
        });
      } else if (Array.isArray(p.members) && p.members.length > 0) {
        // Fallback: project members to capital classes (one LP class per member)
        newState.capital_classes = p.members.map(function (m, i) {
          return {
            id: 'm' + (i + 1),
            label: m.name || ('Member ' + (i + 1)),
            type: i === 0 && p.managerName ? 'sponsor_coinvest' : 'lp_common',
            committed: Number(m.capitalContribution) || 0,
            pref_rate_pct: Number(p.prefReturnRate) || null,
            hurdle_position: 0,
            promote_split_pct: null
          };
        });
      }
      // Math defaults pulled from OA settings
      if (p.prefReturnRate)    newState.math.pref_return_accrual_basis = p.prefReturnCompounding === 'compound' ? 'compound' : 'simple';
      if (p.section704cMethod) newState.math.section_704c_method = p.section704cMethod;
      if (p.section752Method)  newState.math.section_752_method = p.section752Method;
      if (p.allocationMethod)  newState.math.allocation_method_preference = p.allocationMethod;
      if (Array.isArray(p.promoteTiers) && p.promoteTiers.length > 0) {
        newState.math.promote_tiers_default = p.promoteTiers.map(function (t) {
          return {
            hurdle_pct: Number(t.hurdle) || 0,
            lp_pct: Number(t.lpSplit) || 0,
            gp_pct: Number(t.gpSplit) || 0
          };
        });
      }
      // Securities — Reg D
      if (p.regDOfferingAmount && Number(p.regDOfferingAmount) > 0) {
        // Use as hint to set total equity expectation (not directly to acquisition price)
        newState._securities_target_raise = Number(p.regDOfferingAmount);
      }
      break;
    case 'multi_eight_draft':
      // From donovan_legal_ef_multi_draft_v1
      if (p.company_name)     newState.project_name = p.company_name;
      if (p.jurisdiction)     newState.jurisdiction = p.jurisdiction;
      if (p.effective_date)   newState.effective_date = p.effective_date;
      if (p.business_purpose) {
        const bp = String(p.business_purpose).toLowerCase();
        if (bp.indexOf('real_estate') >= 0) newState.asset_class = 'residential';
      }
      if (Array.isArray(p.members) && p.members.length > 0) {
        newState.capital_classes = p.members.map(function (m, i) {
          return {
            id: 'm' + (i + 1),
            label: m.name || ('Member ' + (i + 1)),
            type: (p.manager_name && m.name === p.manager_name) ? 'sponsor_coinvest' : 'lp_common',
            committed: Number(m.capital_contribution) || 0,
            pref_rate_pct: p.pref_return_enabled ? Number(p.pref_return_rate) : null,
            hurdle_position: 0,
            promote_split_pct: null
          };
        });
      }
      if (p.securities_target_raise) newState._securities_target_raise = Number(p.securities_target_raise);
      break;
    case '12step_outgoing':
    case 'multi_eight_outgoing':
    case 'single_member_outgoing':
      // Forward-compatible parsers — emit only when those EF tools start writing
      // outgoing payloads (separate follow-up thread). Schema mirrors structuring.
      if (p.project_name)     newState.project_name = p.project_name;
      if (p.matter_no)        newState.matter_no = p.matter_no;
      if (p.jurisdiction)     newState.jurisdiction = p.jurisdiction;
      if (p.effective_date)   newState.effective_date = p.effective_date;
      if (Array.isArray(p.capital_classes_outline) && p.capital_classes_outline.length > 0) {
        newState.capital_classes = p.capital_classes_outline.map(function (c, i) {
          return {
            id: 'fc' + (i + 1),
            label: c.label || ('Class ' + (i + 1)),
            type: c.type || 'lp_common',
            committed: Number(c.committed) || 0,
            pref_rate_pct: c.pref_rate_pct != null ? Number(c.pref_rate_pct) : null,
            hurdle_position: Number(c.hurdle_position) || 0,
            promote_split_pct: c.promote_split_pct != null ? Number(c.promote_split_pct) : null
          };
        });
      }
      break;
  }
  newState.handoff_intake = {
    source_tool: source.kind,
    source_label: source.label,
    source_key: source.key,
    applied_at: todayISO(),
    raw_payload: source.payload
  };
  return newState;
}


// =============================================================================
// MEMORANDUM COMPOSITION — Sections I-VI rendered; VII-IX scaffolded.
// =============================================================================
// Voice: senior partner to senior partner. Skadden-tier cites. No preamble.
// Output: { html: string, plainText: string, sections: { ... } }
// =============================================================================
function buildMemorandum(state, analysis) {
  const a = analysis || analyzeFeasibility(state);
  const sections = [];

  // -------- HEADER --------
  const header = [
    '<div class="memo-header">',
    '  <div class="memo-firm">DONOVAN LEGAL PLLC</div>',
    '  <div class="memo-eyebrow">Deal Economics &mdash; Feasibility Memorandum (DRAFT)</div>',
    '  <table class="memo-meta">',
    '    <tr><td>Project:</td><td>' + esc(state.project_name || '\u2014') + '</td>',
    '        <td>Matter:</td><td>' + esc(state.matter_no || '\u2014') + '</td></tr>',
    '    <tr><td>Date:</td><td>' + esc(state.effective_date || todayISO()) + '</td>',
    '        <td>Deal Type:</td><td>' + esc(state.active_preset_key ? (ECON_PRESETS[state.active_preset_key] ? ECON_PRESETS[state.active_preset_key].label : state.active_preset_key) : state.deal_type) + '</td></tr>',
    '    <tr><td>Asset Class:</td><td>' + esc(ASSET_CLASSES[state.asset_class] ? ASSET_CLASSES[state.asset_class].label : state.asset_class) + '</td>',
    '        <td>Jurisdiction:</td><td>' + esc(stateInfo(state.jurisdiction).name) + ' / asset in ' + esc(stateInfo(state.asset_location_state).name) + '</td></tr>',
    '  </table>',
    '  <div class="memo-draft-badge">DRAFT &middot; FOR INTERNAL REVIEW</div>',
    '</div>'
  ].join('\n');

  // -------- EXECUTIVE SUMMARY --------
  const sx = a.summary;
  const execSummary = [
    '<section class="memo-section">',
    '  <h2>Executive Summary</h2>',
    '  <p>The deal is capitalized at ' + esc(fmtMoney(sx.totalCapital)) + ' against a ' + esc(fmtMoney(a.capStack.totals.acquisitionPrice)) + ' acquisition' +
      (a.capStack.totals.totalDevelopmentBudget > 0 ? ' plus ' + esc(fmtMoney(a.capStack.totals.totalDevelopmentBudget)) + ' of development budget' : '') +
      '. Senior debt comprises ' + esc(fmtMoney(sx.totalDebt)) + ' (' + esc(fmtPercent(a.capStack.metrics.debtPct || 0, 1)) + ' of stack); equity comprises ' + esc(fmtMoney(sx.totalEquity)) + ' (' + esc(fmtPercent(a.capStack.metrics.equityPct || 0, 1)) + ').</p>',
    '  <p>Loan-to-value at acquisition is ' + esc(a.capStack.metrics.ltvAtAcquisition != null ? fmtPercent(a.capStack.metrics.ltvAtAcquisition, 1) : 'n/a') +
      '; loan-to-cost is ' + esc(a.capStack.metrics.ltc != null ? fmtPercent(a.capStack.metrics.ltc, 1) : 'n/a') + '.</p>',
    (sx.dealIrr != null
      ? '  <p>Deal-level IRR is ' + esc(fmtPercent(sx.dealIrr, 1)) + ' on an equity multiple of ' + esc(sx.moic != null ? fmtMultiple(sx.moic) : '\u2014') + ' over a ' + esc(sx.holdYears) + '-year hold' +
        (sx.holdYield != null ? ', with an average cash-on-cash yield of ' + esc(fmtPercent(sx.holdYield, 2)) : '') + '. ' +
        (sx.year1Dscr != null && sx.year1Dscr > 0
          ? 'Year 1 DSCR clears at ' + esc(fmtMultiple(sx.year1Dscr)) + (sx.year1Dscr >= 1.20 ? '; institutional underwriting thresholds (1.20x – 1.30x) are met.' : '; below institutional underwriting thresholds (1.20x – 1.30x) and warrants restructuring.') : '') + '</p>'
      : '  <p>Deal-level IRR cannot be computed (cash-flow series lacks both positive and negative values). Verify the inputs.</p>'),
    '  <p class="memo-callout"><strong>Note on Thread 1 scope.</strong> This memorandum reports feasibility-level economics: capital stack, sources &amp; uses, pro-forma NOI, deal-level IRR and MOIC, sensitivity, and break-even. Per-partner waterfall execution (LP pref, GP catch-up, multi-tier promote, clawback), § 704(b) capital-account maintenance, and § 1245/1250 recapture on disposition ship in subsequent threads.</p>',
    '</section>'
  ].join('\n');
  sections.push(execSummary);

  // -------- SECTION I — SOURCES AND USES --------
  const stackRows = a.capStack.stack.map(function (c) {
    return '<tr>' +
      '<td>' + esc(c.label || '') + '</td>' +
      '<td>' + esc(c._typeLabel || c.type) + '</td>' +
      '<td class="memo-right">' + esc(fmtMoney(c.committed)) + '</td>' +
      '<td class="memo-right">' + esc(fmtPercent(c._pctOfStack || 0, 1)) + '</td>' +
      '</tr>';
  }).join('');
  const t = a.capStack.totals;
  const sectionI = [
    '<section class="memo-section">',
    '  <h2>I. Sources and Uses</h2>',
    '  <h3>Uses</h3>',
    '  <table class="memo-table">',
    '    <tr><td>Acquisition price</td><td class="memo-right">' + esc(fmtMoney(t.acquisitionPrice)) + '</td></tr>',
    '    <tr><td>Closing costs (' + esc(fmtPercent(state.closing_costs_pct || 0, 1)) + ')</td><td class="memo-right">' + esc(fmtMoney(t.closingCosts)) + '</td></tr>',
    (t.dueDiligence > 0 ? '    <tr><td>Due diligence costs</td><td class="memo-right">' + esc(fmtMoney(t.dueDiligence)) + '</td></tr>' : ''),
    '    <tr><td>Financing fees (' + esc(fmtPercent(state.financing_fees_pct || 0, 1)) + ' of debt)</td><td class="memo-right">' + esc(fmtMoney(t.financingFees)) + '</td></tr>',
    (t.debtPlacementFee > 0 ? '    <tr><td>Debt placement fee</td><td class="memo-right">' + esc(fmtMoney(t.debtPlacementFee)) + '</td></tr>' : ''),
    (t.hardCosts > 0     ? '    <tr><td>Hard costs</td><td class="memo-right">' + esc(fmtMoney(t.hardCosts)) + '</td></tr>' : ''),
    (t.softCosts > 0     ? '    <tr><td>Soft costs</td><td class="memo-right">' + esc(fmtMoney(t.softCosts)) + '</td></tr>' : ''),
    (t.contingency > 0   ? '    <tr><td>Contingency</td><td class="memo-right">' + esc(fmtMoney(t.contingency)) + '</td></tr>' : ''),
    (t.interestReserve > 0 ? '    <tr><td>Interest reserve</td><td class="memo-right">' + esc(fmtMoney(t.interestReserve)) + '</td></tr>' : ''),
    (t.leaseUpCosts > 0  ? '    <tr><td>Lease-up costs (TI/LC)</td><td class="memo-right">' + esc(fmtMoney(t.leaseUpCosts)) + '</td></tr>' : ''),
    (t.preOpeningCosts > 0 ? '    <tr><td>Pre-opening costs (hospitality FF&amp;E + ramp)</td><td class="memo-right">' + esc(fmtMoney(t.preOpeningCosts)) + '</td></tr>' : ''),
    '    <tr class="memo-total"><td><strong>Total Uses</strong></td><td class="memo-right"><strong>' + esc(fmtMoney(t.totalUses)) + '</strong></td></tr>',
    '  </table>',
    '  <h3>Sources</h3>',
    '  <table class="memo-table">',
    '    <thead><tr><th>Capital Class</th><th>Type</th><th class="memo-right">Committed</th><th class="memo-right">% of Stack</th></tr></thead>',
    '    <tbody>',
    stackRows,
    '    <tr class="memo-total"><td colspan="2"><strong>Total Sources</strong></td><td class="memo-right"><strong>' + esc(fmtMoney(t.totalSources)) + '</strong></td><td class="memo-right">100.0%</td></tr>',
    '    </tbody>',
    '  </table>',
    (Math.abs(t.sourcesUsesGap) > 1
      ? '  <p class="memo-callout memo-warn"><strong>Sources/Uses gap: ' + esc(fmtMoney(t.sourcesUsesGap)) + '.</strong> ' + (t.sourcesUsesGap > 0 ? 'Overfunded; refine equity commitments.' : 'Underfunded; close the gap before proceeding.') + '</p>'
      : '  <p class="memo-help">Sources and uses balance.</p>'),
    '</section>'
  ].filter(function (line) { return line.length > 0; }).join('\n');
  sections.push(sectionI);

  // -------- SECTION II — CAPITAL STACK --------
  const sectionII = [
    '<section class="memo-section">',
    '  <h2>II. Capital Stack</h2>',
    '  <p>The stack ranks from senior debt (rank 1) through GP carry (rank 6) per Donovan Legal\'s waterfall convention. Stack-level metrics:</p>',
    '  <table class="memo-table memo-table-half">',
    '    <tr><td>Total capitalization</td><td class="memo-right">' + esc(fmtMoney(t.totalCapital)) + '</td></tr>',
    '    <tr><td>Senior debt</td><td class="memo-right">' + esc(fmtMoney(t.totalDebt)) + '</td></tr>',
    '    <tr><td>Total equity</td><td class="memo-right">' + esc(fmtMoney(t.totalEquity)) + '</td></tr>',
    '    <tr><td>Loan-to-Value (at acquisition)</td><td class="memo-right">' + esc(a.capStack.metrics.ltvAtAcquisition != null ? fmtPercent(a.capStack.metrics.ltvAtAcquisition, 2) : '\u2014') + '</td></tr>',
    '    <tr><td>Loan-to-Cost</td><td class="memo-right">' + esc(a.capStack.metrics.ltc != null ? fmtPercent(a.capStack.metrics.ltc, 2) : '\u2014') + '</td></tr>',
    '  </table>',
    (a.debtSchedule.tranches.length > 0
      ? '  <h3>Debt Schedule</h3>' +
        '  <table class="memo-table"><thead><tr><th>Tranche</th><th class="memo-right">Principal</th><th class="memo-right">Rate</th><th>Basis</th><th class="memo-right">Y1 Service</th><th class="memo-right">Maturity Balance</th></tr></thead><tbody>' +
        a.debtSchedule.tranches.map(function (tr) {
          const y1 = tr.years[0] || { totalService: 0 };
          return '<tr>' +
            '<td>' + esc(tr.label) + '</td>' +
            '<td class="memo-right">' + esc(fmtMoney(tr.committed)) + '</td>' +
            '<td class="memo-right">' + esc(fmtPercent(tr.rate, 2)) + '</td>' +
            '<td>' + esc(tr.basis) + '</td>' +
            '<td class="memo-right">' + esc(fmtMoney(y1.totalService)) + '</td>' +
            '<td class="memo-right">' + esc(fmtMoney(tr.finalBalance)) + '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table>'
      : '  <p class="memo-help">No debt tranches in stack (all-equity capitalization).</p>'),
    '</section>'
  ].join('\n');
  sections.push(sectionII);

  // -------- SECTION III — PRO FORMA SUMMARY --------
  const pfRows = a.proForma.map(function (y) {
    return '<tr>' +
      '<td>Year ' + y.year + '</td>' +
      '<td class="memo-right">' + esc(fmtMoney(y.revenue.effectiveGrossRevenue)) + '</td>' +
      '<td class="memo-right">' + esc(fmtMoney(y.operatingExpenses.totalOperatingExpenses)) + '</td>' +
      '<td class="memo-right">' + esc(fmtMoney(y.noi)) + '</td>' +
      '<td class="memo-right">' + esc(fmtMoney(y.debtService.totalService)) + '</td>' +
      '<td class="memo-right">' + esc(fmtMoney(y.cashFlowBeforeTax)) + '</td>' +
      '<td class="memo-right">' + esc(y.dscr != null ? fmtMultiple(y.dscr) : '\u2014') + '</td>' +
      '</tr>';
  }).join('');
  const sectionIII = [
    '<section class="memo-section">',
    '  <h2>III. Operating Pro Forma Summary</h2>',
    (state.cash_flow_profile === 'for_sale'
      ? '  <p>For-sale profile: no rental NOI; revenue is captured through unit sales. The operating pro-forma below reflects holding-period overhead only.</p>'
      : '  <p>Year-by-year NOI, debt service, cash flow before tax, and DSCR over the ' + a.proForma.length + '-year hold.</p>'),
    '  <table class="memo-table">',
    '    <thead><tr><th>Period</th><th class="memo-right">EGR</th><th class="memo-right">OpEx</th><th class="memo-right">NOI</th><th class="memo-right">Debt Service</th><th class="memo-right">CFBT</th><th class="memo-right">DSCR</th></tr></thead>',
    '    <tbody>',
    pfRows,
    '    </tbody>',
    '  </table>',
    (a.forSaleRevenue
      ? '  <h3>Sales Revenue</h3>' +
        '  <table class="memo-table"><thead><tr><th>Period</th><th class="memo-right">Units Sold</th><th class="memo-right">Avg Price</th><th class="memo-right">Gross Sales</th><th class="memo-right">Units Remaining</th></tr></thead><tbody>' +
        a.forSaleRevenue.years.map(function (y) {
          return '<tr>' +
            '<td>Year ' + y.year + '</td>' +
            '<td class="memo-right">' + y.unitsSold + '</td>' +
            '<td class="memo-right">' + esc(fmtMoney(y.averageSalePrice)) + '</td>' +
            '<td class="memo-right">' + esc(fmtMoney(y.grossSalesRevenue)) + '</td>' +
            '<td class="memo-right">' + y.unitsRemainingEoy + '</td>' +
            '</tr>';
        }).join('') +
        '</tbody></table>'
      : ''),
    '</section>'
  ].join('\n');
  sections.push(sectionIII);

  // -------- SECTION IV — RETURNS ANALYSIS --------
  const r = a.returns;
  const ex = a.exit;
  const sectionIV = [
    '<section class="memo-section">',
    '  <h2>IV. Returns Analysis</h2>',
    '  <table class="memo-table memo-table-half">',
    '    <tr><td>Total equity invested</td><td class="memo-right">' + esc(fmtMoney(r.totalEquityInvested)) + '</td></tr>',
    '    <tr><td>Deal-level IRR</td><td class="memo-right">' + esc(r.dealIrr != null ? fmtPercent(r.dealIrr, 2) : '\u2014') + '</td></tr>',
    '    <tr><td>Deal-level MOIC</td><td class="memo-right">' + esc(r.moic != null ? fmtMultiple(r.moic) : '\u2014') + '</td></tr>',
    '    <tr><td>LP IRR (equity-share split)</td><td class="memo-right">' + esc(r.lpIrr != null ? fmtPercent(r.lpIrr, 2) : '\u2014') + '</td></tr>',
    '    <tr><td>Sponsor IRR (equity-share split)</td><td class="memo-right">' + esc(r.sponsorIrr != null ? fmtPercent(r.sponsorIrr, 2) : '\u2014') + '</td></tr>',
    '    <tr><td>Average cash-on-cash yield</td><td class="memo-right">' + esc(r.holdYield != null ? fmtPercent(r.holdYield, 2) : '\u2014') + '</td></tr>',
    '  </table>',
    (ex
      ? '  <h3>Disposition</h3>' +
        '  <table class="memo-table memo-table-half">' +
        '    <tr><td>Method</td><td>' + esc(ex.methodNote) + '</td></tr>' +
        '    <tr><td>Gross exit value</td><td class="memo-right">' + esc(fmtMoney(ex.grossExit)) + '</td></tr>' +
        '    <tr><td>Disposition costs</td><td class="memo-right">(' + esc(fmtMoney(ex.dispositionCosts).replace(/[$()]/g, '')) + ')</td></tr>' +
        '    <tr><td>Debt payoff at exit</td><td class="memo-right">(' + esc(fmtMoney(ex.debtPayoff).replace(/[$()]/g, '')) + ')</td></tr>' +
        '    <tr class="memo-total"><td><strong>Equity proceeds at exit</strong></td><td class="memo-right"><strong>' + esc(fmtMoney(ex.equityProceeds)) + '</strong></td></tr>' +
        '  </table>'
      : ''),
    '  <p class="memo-help">' + esc(r.note || '') + '</p>',
    '</section>'
  ].join('\n');
  sections.push(sectionIV);

  // -------- SECTION V — SENSITIVITY --------
  const s = a.sensitivity;
  const sensCells = s.grid.map(function (row, j) {
    return '<tr><th class="memo-right">' + esc((s.yRange[j] >= 0 ? '+' : '') + s.yRange[j]) + '</th>' +
      row.map(function (v) {
        return '<td class="memo-right">' + esc(v != null ? fmtPercent(v, 1) : '\u2014') + '</td>';
      }).join('') + '</tr>';
  }).join('');
  const sectionV = [
    '<section class="memo-section">',
    '  <h2>V. Sensitivity Analysis</h2>',
    '  <p>Two-variable IRR grid: <strong>' + esc(s.xAxis) + '</strong> (columns; perturbation from base) by <strong>' + esc(s.yAxis) + '</strong> (rows).</p>',
    '  <table class="memo-table memo-sens">',
    '    <thead><tr><th></th>' + s.xRange.map(function (x) { return '<th class="memo-right">' + esc((x >= 0 ? '+' : '') + x) + '</th>'; }).join('') + '</tr></thead>',
    '    <tbody>',
    sensCells,
    '    </tbody>',
    '  </table>',
    '</section>'
  ].join('\n');
  sections.push(sectionV);

  // -------- SECTION VI — BREAK-EVEN --------
  const b = a.breakEven;
  const sectionVI = [
    '<section class="memo-section">',
    '  <h2>VI. Break-Even Analysis</h2>',
    '  <table class="memo-table memo-table-half">',
    (b.occupancyBreakEven != null ? '    <tr><td>Occupancy break-even (Year 1)</td><td class="memo-right">' + esc(fmtPercent(b.occupancyBreakEven, 1)) + '</td></tr>' : ''),
    (b.yearOneDebtYield != null ? '    <tr><td>Year 1 debt yield</td><td class="memo-right">' + esc(fmtPercent(b.yearOneDebtYield, 2)) + '</td></tr>' : ''),
    (b.debtYieldThreshold != null ? '    <tr><td>Institutional debt-yield threshold</td><td class="memo-right">' + esc(fmtPercent(b.debtYieldThreshold, 2)) + '</td></tr>' : ''),
    (b.debtYieldMargin != null ? '    <tr><td>Debt-yield margin</td><td class="memo-right">' + (b.debtYieldMargin >= 0 ? '+' : '') + esc(fmtPercent(b.debtYieldMargin, 2)) + '</td></tr>' : ''),
    (b.salePriceBreakEven != null ? '    <tr><td>Sale-price break-even (per unit)</td><td class="memo-right">' + esc(fmtMoney(b.salePriceBreakEven)) + '</td></tr>' : ''),
    (b.yearOneDscr != null ? '    <tr><td>Year 1 DSCR</td><td class="memo-right">' + esc(fmtMultiple(b.yearOneDscr)) + '</td></tr>' : ''),
    '  </table>',
    '</section>'
  ].filter(function (line) { return line.length > 0; }).join('\n');
  sections.push(sectionVI);

  // -------- SECTIONS VII-IX — SCAFFOLDED (Thread 2+) --------
  const scaffoldedSections = [
    '<section class="memo-section memo-section-scaffold">',
    '  <h2>VII. Deal Structuring Layer <span class="memo-thread-badge">Thread 2</span></h2>',
    '  <p>Allocation methodology selection (traditional / targeted-capital / layer-cake), § 704(c) method (traditional / traditional-with-curative / remedial; cite I.R.C. § 704(c); Treas. Reg. § 1.704-3), § 752 debt allocation (standard hierarchy / recourse-tracing / QNRF-as-recourse; cite I.R.C. § 752 and Treas. Reg. § 1.752-2), QIO and minimum-gain chargeback wiring (Treas. Reg. § 1.704-2), and multi-tier promote with catch-up and clawback ship in Thread 2. This section will populate once Thread 2 deploys.</p>',
    '</section>',
    '<section class="memo-section memo-section-scaffold">',
    '  <h2>VIII. Hold-Period Modeling <span class="memo-thread-badge">Thread 3</span></h2>',
    '  <p>Waterfall execution per event (operating distribution, refinance, sale), § 704(b) capital-account maintenance with safe-harbor regulatory allocations, depreciation with bonus + cost-segregation overlay (' + esc(BONUS_DEPRECIATION.cite) + '), and refinance / cash-out event modeling ship in Thread 3.</p>',
    '</section>',
    '<section class="memo-section memo-section-scaffold">',
    '  <h2>IX. Disposition Mechanics <span class="memo-thread-badge">Thread 4</span></h2>',
    '  <p>Hypothetical liquidation per § 1.704-1(b)(2)(ii)(b), § 1245 / § 1250 recapture computation (including unrecaptured § 1250 gain), § 1031 like-kind exchange deferred-gain mechanics (I.R.C. § 1031, Treas. Reg. § 1.1031), § 199A QBI projection, and BBA partnership-representative push-out election (I.R.C. § 6226) ship in Thread 4.</p>',
    '</section>'
  ].join('\n');
  sections.push(scaffoldedSections);

  // -------- FOOTER --------
  const footer = [
    '<section class="memo-section memo-section-footer">',
    '  <p class="memo-footer-cite"><strong>Authorities relied upon (Thread 1).</strong> I.R.C. §§ 168(k), 704(b), 752, 1411, 1031 (for forward-compatible exit-strategy framing); ' + esc(BONUS_DEPRECIATION.cite) + '; Treas. Reg. §§ 1.704-1(b)(2), 1.704-2 (minimum gain), 1.704-3 (§ 704(c) methods), 1.752-2 (recourse allocation). For asset-class-specific authorities (LIHTC § 42, QOZ §§ 1400Z-1 and 1400Z-2 / OZ 2.0, REIT § 856 et seq., DST Rev. Rul. 2004-86, TIC Rev. Proc. 2002-22): see Structuring Tool memorandum where applicable.</p>',
    '  <p class="memo-footer-disclaimer"><strong>Privileged and confidential. Attorney work product.</strong> This is a feasibility-level analysis prepared for internal review only. It is not an offering document, securities recommendation, tax opinion, or fairness opinion. All economic projections are estimates that depend on assumptions identified herein; actual results will differ. Capital-account, allocation, waterfall, and recapture treatment require the analyses scaffolded above and the related Donovan Legal tools (Structuring; 12-Step; Multi-Member Eight-Step; Single-Member Formation).</p>',
    '</section>'
  ].join('\n');

  const html = header + '\n' + sections.join('\n') + '\n' + footer;
  return {
    html: html,
    plainText: html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
    sections: { header: header, body: sections, footer: footer }
  };
}


// =============================================================================
// EXCEL WORKBOOK — SheetJS-compatible object structure
// =============================================================================
// Engine returns a workbook OBJECT (not a file). Browser wrapper calls
// XLSX.writeFile(wb, filename) using vendored /js/vendor/xlsx-writer.js.
// Node smoke inspects the object structure directly without requiring SheetJS.
//
// SheetJS workbook shape:
//   { SheetNames: ['Tab1', 'Tab2', ...],
//     Sheets: {
//       'Tab1': { '!ref': 'A1:D10', A1: {v: 'Header', t: 's'}, ... },
//       ...
//     } }
//
// Cell types: 's' (string), 'n' (number), 'b' (bool); 'f' field carries formula.
// Tabs 1-3 populated; Tabs 4-10 structured with sheet name + header row.
// Thread 5 wires live formulas across all 10 tabs.
// =============================================================================
function _xlCol(n) {
  // 1-indexed column number → Excel letter (A, B, ..., Z, AA, AB, ...)
  let s = '';
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}
function _xlAddr(col, row) { return _xlCol(col) + row; }
function _xlSheet(rows) {
  // rows: array of arrays. Each cell can be a primitive (string/number/bool)
  // or an object { v, t, f, z } where z is a number format.
  const sheet = {};
  let maxCol = 0;
  rows.forEach(function (row, rIdx) {
    row.forEach(function (cell, cIdx) {
      const addr = _xlAddr(cIdx + 1, rIdx + 1);
      let obj;
      if (cell == null) return;
      if (typeof cell === 'object' && !Array.isArray(cell)) {
        obj = Object.assign({}, cell);
      } else if (typeof cell === 'number') {
        obj = { v: cell, t: 'n' };
      } else if (typeof cell === 'boolean') {
        obj = { v: cell, t: 'b' };
      } else {
        obj = { v: String(cell), t: 's' };
      }
      sheet[addr] = obj;
      if (cIdx + 1 > maxCol) maxCol = cIdx + 1;
    });
  });
  if (rows.length > 0 && maxCol > 0) {
    sheet['!ref'] = 'A1:' + _xlAddr(maxCol, rows.length);
  } else {
    sheet['!ref'] = 'A1:A1';
  }
  return sheet;
}

function buildExcelWorkbook(state, analysis) {
  const a = analysis || analyzeFeasibility(state);
  const presetLabel = state.active_preset_key && ECON_PRESETS[state.active_preset_key]
    ? ECON_PRESETS[state.active_preset_key].label
    : (state.deal_type || 'Custom Deal');

  // ===== TAB 1 — DEAL SUMMARY =====
  const t1Rows = [
    ['DONOVAN LEGAL — DEAL ECONOMICS — DEAL SUMMARY'],
    [],
    ['Project', state.project_name || ''],
    ['Matter No.', state.matter_no || ''],
    ['Date', state.effective_date || todayISO()],
    ['Deal Type', presetLabel],
    ['Asset Class', ASSET_CLASSES[state.asset_class] ? ASSET_CLASSES[state.asset_class].label : (state.asset_class || '')],
    ['Cash-Flow Profile', state.cash_flow_profile || ''],
    ['Jurisdiction (entity)', stateInfo(state.jurisdiction).name],
    ['Jurisdiction (asset)', stateInfo(state.asset_location_state).name],
    ['Hold Period (years)', { v: Number(state.hold_period_years) || 0, t: 'n' }],
    ['Exit Strategy', state.exit_strategy || ''],
    [],
    ['CAPITAL STACK SUMMARY'],
    ['Total Capitalization', { v: a.capStack.totals.totalCapital, t: 'n', z: '$#,##0' }],
    ['Total Senior Debt + Mezz', { v: a.capStack.totals.totalDebt, t: 'n', z: '$#,##0' }],
    ['Total Equity', { v: a.capStack.totals.totalEquity, t: 'n', z: '$#,##0' }],
    ['LTV (acquisition)', { v: a.capStack.metrics.ltvAtAcquisition || 0, t: 'n', z: '0.00%' }],
    ['LTC', { v: a.capStack.metrics.ltc || 0, t: 'n', z: '0.00%' }],
    [],
    ['RETURNS'],
    ['Deal IRR', { v: a.returns.dealIrr != null ? a.returns.dealIrr : 0, t: 'n', z: '0.00%' }],
    ['Deal MOIC', { v: a.returns.moic != null ? a.returns.moic : 0, t: 'n', z: '0.00"x"' }],
    ['LP IRR (equity-share split — Thread 1)', { v: a.returns.lpIrr != null ? a.returns.lpIrr : 0, t: 'n', z: '0.00%' }],
    ['Sponsor IRR (equity-share split — Thread 1)', { v: a.returns.sponsorIrr != null ? a.returns.sponsorIrr : 0, t: 'n', z: '0.00%' }],
    ['Average Cash-on-Cash Yield', { v: a.returns.holdYield != null ? a.returns.holdYield : 0, t: 'n', z: '0.00%' }],
    [],
    ['Year 1 DSCR', { v: a.proForma[0] && a.proForma[0].dscr != null ? a.proForma[0].dscr : 0, t: 'n', z: '0.00"x"' }],
    ['Year 1 Debt Yield', { v: a.breakEven && a.breakEven.yearOneDebtYield != null ? a.breakEven.yearOneDebtYield : 0, t: 'n', z: '0.00%' }],
    [],
    ['NOTE', 'Per-partner waterfall, capital accounts, and recapture ship in subsequent threads.']
  ];

  // ===== TAB 2 — CAPITAL STACK =====
  const t2Rows = [
    ['CAPITAL STACK DETAIL'],
    [],
    ['Class', 'Type', 'Rank', 'Committed', '% of Stack', 'Pref Rate', 'Hurdle Position', 'Promote Split'],
  ];
  a.capStack.stack.forEach(function (c) {
    t2Rows.push([
      c.label || '',
      c._typeLabel || c.type,
      { v: c._rank || 0, t: 'n' },
      { v: Number(c.committed) || 0, t: 'n', z: '$#,##0' },
      { v: c._pctOfStack || 0, t: 'n', z: '0.0%' },
      { v: c.pref_rate_pct != null ? Number(c.pref_rate_pct) : 0, t: 'n', z: '0.00%' },
      { v: c.hurdle_position || 0, t: 'n' },
      { v: c.promote_split_pct != null ? Number(c.promote_split_pct) : 0, t: 'n', z: '0.00%' }
    ]);
  });
  // Totals using SUM formulas (live)
  const t2StackStart = 4;
  const t2StackEnd = t2StackStart + a.capStack.stack.length - 1;
  t2Rows.push([]);
  t2Rows.push([
    'TOTAL', '', '',
    { f: 'SUM(D' + t2StackStart + ':D' + t2StackEnd + ')', t: 'n', z: '$#,##0' },
    { f: 'SUM(E' + t2StackStart + ':E' + t2StackEnd + ')', t: 'n', z: '0.0%' },
    '', '', ''
  ]);
  t2Rows.push([]);
  t2Rows.push(['SOURCES & USES']);
  t2Rows.push(['Uses', '', '', '', '', '', '', '']);
  t2Rows.push(['Acquisition Price', '', '', { v: a.capStack.totals.acquisitionPrice, t: 'n', z: '$#,##0' }]);
  t2Rows.push(['Closing Costs', '', '', { v: a.capStack.totals.closingCosts, t: 'n', z: '$#,##0' }]);
  t2Rows.push(['Due Diligence', '', '', { v: a.capStack.totals.dueDiligence, t: 'n', z: '$#,##0' }]);
  t2Rows.push(['Financing Fees', '', '', { v: a.capStack.totals.financingFees, t: 'n', z: '$#,##0' }]);
  if (a.capStack.totals.totalDevelopmentBudget > 0) {
    t2Rows.push(['Hard Costs', '', '', { v: a.capStack.totals.hardCosts, t: 'n', z: '$#,##0' }]);
    t2Rows.push(['Soft Costs', '', '', { v: a.capStack.totals.softCosts, t: 'n', z: '$#,##0' }]);
    t2Rows.push(['Contingency', '', '', { v: a.capStack.totals.contingency, t: 'n', z: '$#,##0' }]);
    if (a.capStack.totals.leaseUpCosts > 0) t2Rows.push(['Lease-Up Costs', '', '', { v: a.capStack.totals.leaseUpCosts, t: 'n', z: '$#,##0' }]);
    if (a.capStack.totals.preOpeningCosts > 0) t2Rows.push(['Pre-Opening Costs', '', '', { v: a.capStack.totals.preOpeningCosts, t: 'n', z: '$#,##0' }]);
  }
  t2Rows.push(['TOTAL USES', '', '', { v: a.capStack.totals.totalUses, t: 'n', z: '$#,##0' }]);

  // ===== TAB 3 — PRO FORMA =====
  const t3Rows = [
    ['OPERATING PRO FORMA — YEAR 1 THROUGH HOLD'],
    [],
    ['Line Item / Year'].concat(a.proForma.map(function (y) { return 'Year ' + y.year; }))
  ];
  // Revenue
  t3Rows.push(['Effective Gross Revenue'].concat(a.proForma.map(function (y) {
    return { v: y.revenue.effectiveGrossRevenue, t: 'n', z: '$#,##0' };
  })));
  t3Rows.push(['Operating Expenses'].concat(a.proForma.map(function (y) {
    return { v: y.operatingExpenses.totalOperatingExpenses, t: 'n', z: '$#,##0' };
  })));
  // NOI as formula = revenue - opex (live)
  const noiRow = ['NOI'];
  for (let c = 0; c < a.proForma.length; c++) {
    const col = _xlCol(c + 2);
    noiRow.push({ f: col + '4-' + col + '5', t: 'n', z: '$#,##0' });
  }
  t3Rows.push(noiRow);
  t3Rows.push(['Debt Service'].concat(a.proForma.map(function (y) {
    return { v: y.debtService.totalService, t: 'n', z: '$#,##0' };
  })));
  // CFBT = NOI - debt service (live)
  const cfbtRow = ['Cash Flow Before Tax'];
  for (let c = 0; c < a.proForma.length; c++) {
    const col = _xlCol(c + 2);
    cfbtRow.push({ f: col + '6-' + col + '7', t: 'n', z: '$#,##0' });
  }
  t3Rows.push(cfbtRow);
  // DSCR = NOI / debt service (live; protect divide-by-zero)
  const dscrRow = ['DSCR'];
  for (let c = 0; c < a.proForma.length; c++) {
    const col = _xlCol(c + 2);
    dscrRow.push({ f: 'IF(' + col + '7=0,0,' + col + '6/' + col + '7)', t: 'n', z: '0.00"x"' });
  }
  t3Rows.push(dscrRow);

  // ===== TABS 4-10 — STRUCTURED HEADERS (Thread 5 wires live formulas) =====
  const t4Rows = [
    ['CAPITAL ACCOUNTS — § 704(b) ROLLFORWARD'],
    [],
    ['NOTE: This tab populates in Thread 3 when capital-account maintenance ships.'],
    [],
    ['Partner', 'Opening Balance', 'Contributions', 'Allocations of Income', 'Allocations of Loss', 'Distributions', 'Ending Balance']
  ];
  const t5Rows = [
    ['WATERFALL BY DISTRIBUTION EVENT'],
    [],
    ['NOTE: This tab populates in Thread 3 when waterfall execution ships.'],
    [],
    ['Event Date', 'Event Type', 'Available Cash', 'Return of Capital', 'Pref Return', 'Catch-Up', 'Promote', 'LP Receives', 'GP Receives']
  ];
  const t6Rows = [
    ['PER-PARTNER LEDGER'],
    [],
    ['NOTE: This tab populates in Thread 3 with per-partner distribution and allocation history.'],
    [],
    ['Date', 'Partner', 'Transaction', 'Cash In', 'Cash Out', 'Income Allocated', 'Loss Allocated', 'Running Capital Account']
  ];
  const t7Rows = [
    ['DISPOSITION SUMMARY'],
    [],
    ['NOTE: This tab populates in Thread 4 with full disposition mechanics, including § 1245/1250 recapture.'],
    [],
    ['Item', 'Amount', 'Notes'],
    ['Gross Sale Proceeds', { v: a.exit ? a.exit.grossExit : 0, t: 'n', z: '$#,##0' }, a.exit ? a.exit.methodNote : ''],
    ['Disposition Costs (itemized)', { v: a.exit ? -a.exit.dispositionCosts : 0, t: 'n', z: '$#,##0' }, 'See Section IV of memo'],
    ['Debt Payoff', { v: a.exit ? -a.exit.debtPayoff : 0, t: 'n', z: '$#,##0' }, 'Balloons from all tranches'],
    ['Equity Proceeds', { v: a.exit ? a.exit.equityProceeds : 0, t: 'n', z: '$#,##0' }, 'Pre-waterfall']
  ];
  const t8Rows = [
    ['K-1 PROJECTIONS'],
    [],
    ['NOTE: This tab populates in Thread 4 with per-partner K-1 line-item projections.'],
    [],
    ['Partner', 'Year', 'Box 1 Ord Inc', 'Box 2 Net Rental RE Inc', 'Box 5 Interest', 'Box 9a LTCG', 'Box 9c § 1250', 'Box 14 SE', 'Box 20 § 199A']
  ];
  const sRows = [
    ['SENSITIVITY DASHBOARD'],
    [],
    ['X Axis: ' + (a.sensitivity.xAxis || ''), '', 'Y Axis: ' + (a.sensitivity.yAxis || '')],
    [],
    ['IRR Grid (Y rows × X columns)']
  ];
  // Header row with x perturbations
  const sxHeader = [''];
  a.sensitivity.xRange.forEach(function (x) { sxHeader.push((x >= 0 ? '+' : '') + String(x)); });
  sRows.push(sxHeader);
  a.sensitivity.grid.forEach(function (row, j) {
    const r = [(a.sensitivity.yRange[j] >= 0 ? '+' : '') + String(a.sensitivity.yRange[j])];
    row.forEach(function (v) {
      r.push({ v: v != null ? v : 0, t: 'n', z: '0.00%' });
    });
    sRows.push(r);
  });
  const t10Rows = [
    ['NOTES & ASSUMPTIONS'],
    [],
    ['Key Assumption', 'Value', 'Source / Reference'],
    ['Federal Tax Rate (top individual)', { v: state.math.federal_tax_rate, t: 'n', z: '0.0%' }, '2026 stat'],
    ['NIIT Rate', { v: state.math.niit_rate, t: 'n', z: '0.0%' }, '§ 1411'],
    ['Bonus Depreciation', { v: state.math.bonus_depreciation_rate, t: 'n', z: '0.0%' }, BONUS_DEPRECIATION.cite],
    ['Exit Cap Method', state.math.exit_cap_basis, 'Donovan Legal convention'],
    ['Disposition Costs Method', state.math.disposition_costs_method, 'Donovan Legal convention'],
    ['§ 704(c) Method', state.math.section_704c_method, 'Reg. § 1.704-3'],
    ['§ 752 Allocation', state.math.section_752_method, 'Reg. § 1.752-2'],
    [],
    ['Disclaimer', 'Privileged and confidential. Attorney work product. Not an offering document or fairness opinion.']
  ];

  const wb = {
    SheetNames: [
      'Deal Summary',
      'Capital Stack',
      'Year 1-N Pro Forma',
      'Capital Accounts',
      'Waterfall by Event',
      'Per-Partner Ledger',
      'Disposition Summary',
      'K-1 Projections',
      'Sensitivity Dashboard',
      'Notes & Assumptions'
    ],
    Sheets: {
      'Deal Summary':            _xlSheet(t1Rows),
      'Capital Stack':           _xlSheet(t2Rows),
      'Year 1-N Pro Forma':      _xlSheet(t3Rows),
      'Capital Accounts':        _xlSheet(t4Rows),
      'Waterfall by Event':      _xlSheet(t5Rows),
      'Per-Partner Ledger':      _xlSheet(t6Rows),
      'Disposition Summary':     _xlSheet(t7Rows),
      'K-1 Projections':         _xlSheet(t8Rows),
      'Sensitivity Dashboard':   _xlSheet(sRows),
      'Notes & Assumptions':     _xlSheet(t10Rows)
    }
  };
  return wb;
}


// =============================================================================
// LOCAL STORAGE — draft state + scan for sibling-tool intake
// =============================================================================
const STORAGE_KEY = 'donovan_legal_economics_draft_v1';
const OUTGOING_KEY = 'donovan_legal_economics_outcome_v1';

let toolState = defaultState();

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
    if (raw) {
      const parsed = JSON.parse(raw);
      // Merge onto fresh defaults (forward-compatible if schema gains fields)
      toolState = Object.assign(defaultState(), parsed);
      if (!toolState.math) toolState.math = JSON.parse(JSON.stringify(MATH_DEFAULTS));
    }
  } catch (e) { /* silent */ }
}

function clearStorage() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(STORAGE_KEY);
  } catch (e) { /* silent */ }
  toolState = defaultState();
}

// =============================================================================
// UI BINDINGS — under typeof document guard; Node smoke is unaffected.
// =============================================================================
function _showPanel(panelKey) {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.econ-panel').forEach(function (el) {
    el.classList.remove('econ-panel-active');
  });
  document.querySelectorAll('.econ-nav-item').forEach(function (el) {
    el.classList.remove('econ-nav-active');
  });
  const panel = document.querySelector('.econ-panel[data-panel="' + panelKey + '"]');
  if (panel) panel.classList.add('econ-panel-active');
  const nav = document.querySelector('.econ-nav-item[data-panel="' + panelKey + '"]');
  if (nav) nav.classList.add('econ-nav-active');
}

function _bindNav() {
  if (typeof document === 'undefined') return;
  document.querySelectorAll('.econ-nav-item').forEach(function (el) {
    el.addEventListener('click', function (ev) {
      ev.preventDefault();
      const key = el.getAttribute('data-panel');
      if (key) _showPanel(key);
    });
  });
}

function _populateJurisdictions() {
  if (typeof document === 'undefined') return;
  ['jurisdiction', 'asset_location_state'].forEach(function (id) {
    const sel = document.getElementById(id);
    if (!sel) return;
    sel.innerHTML = '';
    STATE_CODES.forEach(function (code) {
      const opt = document.createElement('option');
      opt.value = code;
      opt.textContent = STATES[code].name;
      sel.appendChild(opt);
    });
  });
}

function _renderPresetBar() {
  if (typeof document === 'undefined') return;
  const grid = document.getElementById('econ_preset_grid');
  if (!grid) return;
  grid.innerHTML = '';
  ECON_PRESET_KEYS.forEach(function (key) {
    const p = ECON_PRESETS[key];
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'econ-preset-tile';
    tile.setAttribute('data-preset-key', key);
    tile.setAttribute('data-render-quality', p.renderQuality);
    tile.innerHTML =
      '<div class="econ-preset-tile-emoji">' + p.emoji + '</div>' +
      '<div class="econ-preset-tile-label">' + esc(p.label) + '</div>' +
      '<div class="econ-preset-tile-desc">' + esc(p.description) + '</div>' +
      (p.renderQuality !== 'full' ? '<div class="econ-preset-tile-badge">' + esc(p.renderQuality) + '</div>' : '');
    tile.addEventListener('click', function () { _applyPresetToTool(key); });
    grid.appendChild(tile);
  });
}

function _applyPresetToTool(presetKey) {
  if (typeof document === 'undefined') return;
  if (!ECON_PRESETS[presetKey]) return;
  toolState = applyPreset(presetKey);
  saveStateToStorage();
  _syncFieldsFromState();
  _renderCapitalClasses();
  const statusEl = document.getElementById('econ_preset_status');
  if (statusEl) {
    const p = ECON_PRESETS[presetKey];
    statusEl.textContent = 'Loaded archetype: ' + p.emoji + ' ' + p.label + '. Inputs populated; customize as needed.';
    statusEl.style.display = '';
  }
  _showPanel('setup');
}

function _bindSimpleFields() {
  if (typeof document === 'undefined') return;
  const fields = [
    'project_name', 'matter_no', 'effective_date',
    'jurisdiction', 'asset_location_state',
    'asset_class', 'cash_flow_profile',
    'hold_period_years', 'exit_strategy',
    'acquisition_price', 'closing_costs_pct', 'due_diligence_costs',
    'financing_fees_pct', 'debt_placement_fee_pct',
    'development_present', 'hard_costs', 'soft_costs', 'contingency_pct',
    'interest_reserve', 'lease_up_costs', 'pre_opening_costs',
    'units_count', 'avg_unit_rent_monthly', 'rent_growth_pct',
    'vacancy_pct', 'other_income_pct_of_rent',
    'annual_base_rent_psf', 'rentable_sqft', 'rent_growth_commercial_pct',
    'rooms_count', 'avg_daily_rate', 'occupancy_pct', 'revpar_growth_pct',
    'fnb_pct_of_rooms', 'other_dept_pct_of_rooms',
    'total_units_to_sell', 'avg_sale_price', 'sales_velocity_units_per_month', 'sale_price_growth_pct',
    'opex_ratio', 'opex_growth_pct',
    'capex_reserve_per_unit', 'ti_lc_reserve_per_sqft', 'ff_e_reserve_pct_of_revenue',
    'property_tax_basis_pct', 'insurance_per_unit',
    'exit_cap_rate', 'going_in_cap_rate',
    'disposition_brokerage_pct', 'disposition_legal_psf', 'disposition_other_costs'
  ];
  fields.forEach(function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', function () {
      let val = el.value;
      if (el.type === 'checkbox') val = el.checked;
      else if (el.type === 'number') val = Number(val);
      toolState[id] = val;
      saveStateToStorage();
    });
  });
}

function _syncFieldsFromState() {
  if (typeof document === 'undefined') return;
  Object.keys(toolState).forEach(function (k) {
    const el = document.getElementById(k);
    if (!el) return;
    if (el.type === 'checkbox') el.checked = !!toolState[k];
    else el.value = toolState[k] != null ? toolState[k] : '';
  });
}

function _renderCapitalClasses() {
  if (typeof document === 'undefined') return;
  const wrap = document.getElementById('econ_capital_classes_list');
  if (!wrap) return;
  wrap.innerHTML = '';
  (toolState.capital_classes || []).forEach(function (c, i) {
    const row = document.createElement('div');
    row.className = 'econ-cap-row';
    row.innerHTML =
      '<div class="econ-cap-row-label">' + esc(c.label || 'Class ' + (i + 1)) + '</div>' +
      '<div class="econ-cap-row-type">' + esc((CAPITAL_CLASS_TYPES[c.type] || CAPITAL_CLASS_TYPES.other).label) + '</div>' +
      '<div class="econ-cap-row-amt">' + esc(fmtMoney(c.committed)) + '</div>' +
      (c.pref_rate_pct != null && c.pref_rate_pct > 0 ? '<div class="econ-cap-row-pref">' + esc(fmtPercent(c.pref_rate_pct, 1)) + ' pref</div>' : '');
    wrap.appendChild(row);
  });
}

function _renderResults(analysis) {
  if (typeof document === 'undefined') return;
  const memo = buildMemorandum(toolState, analysis);
  const pane = document.getElementById('econ_memo_preview');
  if (pane) pane.innerHTML = memo.html;
  const wrap = document.getElementById('econ_results_panel');
  if (wrap) wrap.style.display = '';

  // Update post-Run summary cards
  const s = analysis.summary;
  const updates = {
    'econ_kpi_total_cap':  fmtMoney(s.totalCapital),
    'econ_kpi_total_debt': fmtMoney(s.totalDebt),
    'econ_kpi_total_eq':   fmtMoney(s.totalEquity),
    'econ_kpi_ltv':        s.ltvAtAcquisition != null ? fmtPercent(s.ltvAtAcquisition, 1) : '\u2014',
    'econ_kpi_ltc':        s.ltc != null ? fmtPercent(s.ltc, 1) : '\u2014',
    'econ_kpi_deal_irr':   s.dealIrr != null ? fmtPercent(s.dealIrr, 2) : '\u2014',
    'econ_kpi_moic':       s.moic != null ? fmtMultiple(s.moic) : '\u2014',
    'econ_kpi_y1_dscr':    s.year1Dscr != null ? fmtMultiple(s.year1Dscr) : '\u2014'
  };
  Object.keys(updates).forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.textContent = updates[id];
  });
}

function _runModel() {
  if (typeof document === 'undefined') return null;
  try {
    const analysis = analyzeFeasibility(toolState);
    toolState.last_run = { timestamp: todayISO(), analysis: null };  // don't serialize analysis to storage
    saveStateToStorage();
    _renderResults(analysis);
    // Write outgoing payload for downstream tools
    try {
      const payload = buildOutgoingPayload(toolState, analysis);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(OUTGOING_KEY, JSON.stringify(payload));
      }
    } catch (e) { /* silent */ }
    _showPanel('results');
    return analysis;
  } catch (e) {
    console.error('Run model failed:', e);
    if (typeof alert === 'function') alert('Run failed: ' + (e.message || 'unknown error'));
    return null;
  }
}

function _bindRunButton() {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('btn_econ_run');
  if (btn) btn.addEventListener('click', _runModel);
}

function _bindDownloadExcel() {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('btn_econ_download_excel');
  if (!btn) return;
  btn.addEventListener('click', function () {
    if (typeof XLSX === 'undefined') {
      alert('Excel library not loaded. Refresh the page.');
      return;
    }
    const analysis = analyzeFeasibility(toolState);
    const wb = buildExcelWorkbook(toolState, analysis);
    const project = (toolState.project_name || 'deal').replace(/[^a-zA-Z0-9_-]/g, '_');
    const filename = 'donovan_legal_economics_' + project + '_' + todayISO() + '.xlsx';
    XLSX.writeFile(wb, filename);
  });
}

function _bindPrintMemo() {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('btn_econ_print');
  if (btn) btn.addEventListener('click', function () { window.print(); });
}

function _bindStorageButtons() {
  if (typeof document === 'undefined') return;
  const saveBtn = document.getElementById('btn_econ_save');
  const loadBtn = document.getElementById('btn_econ_load');
  const clearBtn = document.getElementById('btn_econ_clear');
  if (saveBtn) saveBtn.addEventListener('click', function () { saveStateToStorage(); _flash('Draft saved.'); });
  if (loadBtn) loadBtn.addEventListener('click', function () { loadStateFromStorage(); _syncFieldsFromState(); _renderCapitalClasses(); _flash('Draft loaded.'); });
  if (clearBtn) clearBtn.addEventListener('click', function () {
    if (typeof confirm === 'function' && !confirm('Reset all inputs to defaults? This clears the draft.')) return;
    clearStorage();
    _syncFieldsFromState();
    _renderCapitalClasses();
    _flash('Reset.');
  });
}

function _flash(msg) {
  if (typeof document === 'undefined') return;
  let el = document.getElementById('econ_flash');
  if (!el) {
    el = document.createElement('div');
    el.id = 'econ_flash';
    el.className = 'econ-flash';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = '1';
  setTimeout(function () { el.style.opacity = '0'; }, 2000);
}

function _bindContinueToStructuring() {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('btn_econ_continue_structuring');
  if (!btn) return;
  btn.addEventListener('click', function () {
    // Per handoff §11.3: confirmation modal with "Don't ask again this session"
    let skipConfirm = false;
    try { skipConfirm = sessionStorage.getItem('econ_skip_handoff_confirm') === '1'; } catch (e) {}
    if (!skipConfirm) {
      const msg = 'Continue to Structuring Tool with current Deal Economics outputs?\n\nThis writes the outgoing payload (donovan_legal_economics_outcome_v1) for the Structuring Tool to read on load.\n\n[OK to continue]';
      if (typeof confirm === 'function' && !confirm(msg)) return;
      try { sessionStorage.setItem('econ_skip_handoff_confirm', '1'); } catch (e) {}
    }
    // Ensure outgoing payload is fresh
    try {
      const analysis = analyzeFeasibility(toolState);
      const payload = buildOutgoingPayload(toolState, analysis);
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(OUTGOING_KEY, JSON.stringify(payload));
      }
    } catch (e) { /* silent */ }
    window.location.href = './tool-structuring.html';
  });
}

function _renderHandoffBanner() {
  if (typeof document === 'undefined') return;
  const banner = document.getElementById('econ_handoff_banner');
  if (!banner) return;
  const sources = scanHandoffSources();
  if (sources.length === 0) {
    banner.style.display = 'none';
    return;
  }
  banner.style.display = '';
  banner.innerHTML =
    '<strong>Sibling-tool data detected.</strong> Pre-populate from: ' +
    sources.map(function (src) {
      return '<button type="button" class="econ-handoff-btn" data-source-key="' + esc(src.key) + '">' + esc(src.label) + '</button>';
    }).join(' ') +
    ' <button type="button" id="econ_handoff_dismiss" class="econ-handoff-dismiss">Dismiss</button>';
  banner.querySelectorAll('.econ-handoff-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const key = btn.getAttribute('data-source-key');
      const src = sources.find(function (s) { return s.key === key; });
      if (!src) return;
      toolState = applyHandoffIntake(toolState, src);
      saveStateToStorage();
      _syncFieldsFromState();
      _renderCapitalClasses();
      _flash('Pre-populated from ' + src.label);
      banner.style.display = 'none';
    });
  });
  const dismiss = document.getElementById('econ_handoff_dismiss');
  if (dismiss) dismiss.addEventListener('click', function () { banner.style.display = 'none'; });
}

// URL preset deep-link handler (mirror RE Analyzer pattern)
function _handlePresetURLParam() {
  if (typeof document === 'undefined' || typeof window === 'undefined') return false;
  let key = null;
  const hash = (typeof location !== 'undefined' && location.hash) ? location.hash : '';
  const hashMatch = hash.match(/[#&]preset=([a-zA-Z0-9_-]+)/);
  if (hashMatch) key = hashMatch[1];
  if (!key && typeof location !== 'undefined' && location.search) {
    const qsMatch = location.search.match(/[?&]preset=([a-zA-Z0-9_-]+)/);
    if (qsMatch) key = qsMatch[1];
  }
  if (!key || !ECON_PRESETS[key]) return false;
  _applyPresetToTool(key);
  return true;
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function () {
    if (!hasToolAccess()) return;
    _populateJurisdictions();
    loadStateFromStorage();
    _syncFieldsFromState();
    _bindSimpleFields();
    _bindNav();
    _renderPresetBar();
    _renderCapitalClasses();
    _renderHandoffBanner();
    _bindRunButton();
    _bindDownloadExcel();
    _bindPrintMemo();
    _bindStorageButtons();
    _bindContinueToStructuring();
    _showPanel('setup');
    // URL preset wins over restored state
    _handlePresetURLParam();
  });
}

// =============================================================================
// EXPORTS — Node testing
// =============================================================================
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    // Tier
    TIER, RAW_TIER,
    isPublic, isPlatinum, isReserve, isAtLeast, hasToolAccess,
    tierRank, TIER_LABEL,
    // Constants
    STATES, STATE_CODES, stateInfo,
    ASSET_CLASSES, CASH_FLOW_PROFILES,
    CAPITAL_CLASS_TYPES, CAPITAL_CLASS_TYPE_KEYS,
    EXIT_STRATEGIES, EXIT_STRATEGY_KEYS,
    MATH_DEFAULTS, BONUS_DEPRECIATION,
    // Utilities (exposed for smoke)
    esc, fmtMoney, fmtMoneyDec, fmtPercent, fmtMultiple, round2, round4,
    computeIRR, computeMOIC, computeCashOnCash,
    todayISO,
    // Presets
    ECON_PRESETS, ECON_PRESET_KEYS, applyPreset,
    // State
    defaultState,
    // Analytical core
    analyzeCapitalStack, buildDebtSchedule, buildProForma,
    buildOperatingRevenue, buildOperatingExpenses,
    buildForSaleRevenue, computeExit, computeDealReturns,
    runSensitivity, computeBreakEven, analyzeFeasibility,
    // Memo + Excel
    buildMemorandum, buildExcelWorkbook,
    // Handoff
    buildOutgoingPayload, HANDOFF_SOURCES,
    scanHandoffSources, applyHandoffIntake,
    // Storage (no-op in Node)
    STORAGE_KEY, OUTGOING_KEY,
    saveStateToStorage, loadStateFromStorage, clearStorage
  };
}

