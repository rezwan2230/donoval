/* STR Tax Strategy Analyzer — JavaScript Engine
 * Donovan Legal PLLC
 * Last updated: May 2026
 */

const STATES = {"AL":{"name":"Alabama","rate":0.05,"has_tax":true,"conforms_bonus":true,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Conforms to federal bonus depreciation, §461(l), and §172 80% rule. Capital gains taxed as ordinary income."},"AK":{"name":"Alaska","rate":0.0,"has_tax":false,"conforms_bonus":null,"conforms_461l":null,"conforms_172_80":null,"ltcg_treatment":"no_tax","note":"No individual income tax. State analysis does not apply."},"AZ":{"name":"Arizona","rate":0.025,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. Flat 2.5% income tax including capital gains. Conforms to §461(l) and §172."},"AR":{"name":"Arkansas","rate":0.044,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":false,"ltcg_treatment":{"exclusion":0.5},"note":"Decoupled from federal bonus depreciation. Allows 50% exclusion of net long-term capital gains, producing an effective top rate of approximately 2.2% on LTCG."},"CA":{"name":"California","rate":0.133,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":false,"ltcg_treatment":"ordinary","note":"Static conformity to IRC as of Jan 1, 2025; decoupled from §168(k). Capital gains taxed as ordinary income (no preferential rate). Plus 1% mental health surcharge above $1M (effective 14.4% top). NOL deductions suspended for tax years 2024-2026 for taxpayers with net business income >$1M."},"CO":{"name":"Colorado","rate":0.044,"has_tax":true,"conforms_bonus":true,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Rolling conformity. Conforms to federal bonus depreciation, §461(l), and §172. Flat 4.4% rate on all income including capital gains."},"CT":{"name":"Connecticut","rate":0.0699,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. Capital gains taxed as ordinary income. NOL carryforward extended to 30 years (loss years beginning Jan 1, 2025)."},"DE":{"name":"Delaware","rate":0.066,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation in November 2025 special legislative session. Capital gains taxed as ordinary income."},"DC":{"name":"District of Columbia","rate":0.1075,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Emergency legislation decoupled from §168(k) effective Jan 1, 2025. Capital gains taxed as ordinary income."},"FL":{"name":"Florida","rate":0.0,"has_tax":false,"conforms_bonus":null,"conforms_461l":null,"conforms_172_80":null,"ltcg_treatment":"no_tax","note":"No individual income tax. State analysis does not apply."},"GA":{"name":"Georgia","rate":0.0539,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Fixed conformity to IRC as of Dec 31, 2024; pre-OBBBA bonus depreciation rules apply. Capital gains taxed as ordinary income."},"HI":{"name":"Hawaii","rate":0.11,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":{"rate":0.0725},"note":"Decoupled from federal bonus depreciation. Long-term capital gains taxed at preferential 7.25% rate (vs. up to 11% ordinary)."},"ID":{"name":"Idaho","rate":0.05695,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from §168(k); requires addback. Capital gains taxed as ordinary income (limited 60% deduction available for certain real property held 12+ months)."},"IL":{"name":"Illinois","rate":0.0495,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Selectively decoupled from OBBBA depreciation in early 2026. Flat 4.95% rate on all income including capital gains."},"IN":{"name":"Indiana","rate":0.0305,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. Flat 3.05% rate on all income including capital gains."},"IA":{"name":"Iowa","rate":0.057,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. Capital gains taxed as ordinary income."},"KS":{"name":"Kansas","rate":0.057,"has_tax":true,"conforms_bonus":true,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Conforms to federal bonus depreciation, §461(l), and §172. Capital gains taxed as ordinary income."},"KY":{"name":"Kentucky","rate":0.04,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. Flat 4% rate on all income including capital gains."},"LA":{"name":"Louisiana","rate":0.0425,"has_tax":true,"conforms_bonus":true,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Election available for property placed in service after 1/1/2025. Verify state-specific election requirements. Capital gains taxed as ordinary income."},"ME":{"name":"Maine","rate":0.0715,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. Capital gains taxed as ordinary income up to 7.15%."},"MD":{"name":"Maryland","rate":0.0575,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled if revenue impact >$5M; effectively decoupled for OBBBA. Capital gains taxed as ordinary income; local county rates add 2.25-3.20%."},"MA":{"name":"Massachusetts","rate":0.09,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":{"rate":0.05},"note":"Decoupled from federal bonus depreciation. 5% base rate + 4% surtax on income above $1M. Long-term capital gains taxed at 5% (preferential vs. 8.5% short-term, plus surtax above $1M)."},"MI":{"name":"Michigan","rate":0.0425,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from §168(k) and §168(n) in October 2025. Flat 4.25% rate on all income including capital gains."},"MN":{"name":"Minnesota","rate":0.0985,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":false,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. NOL deduction limited to 70% of taxable income (corporate; individual rules differ). Capital gains taxed as ordinary income up to 9.85%."},"MS":{"name":"Mississippi","rate":0.047,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. Capital gains taxed as ordinary income at flat 4.7%."},"MO":{"name":"Missouri","rate":0.047,"has_tax":true,"conforms_bonus":true,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Conforms to federal bonus depreciation. Capital gains taxed as ordinary income."},"MT":{"name":"Montana","rate":0.059,"has_tax":true,"conforms_bonus":true,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":{"rate":0.039},"note":"Conforms to federal bonus depreciation. Long-term capital gains taxed at preferential rate (effective ~3.9%) for taxpayers with income within standard brackets, vs. ordinary income rate."},"NE":{"name":"Nebraska","rate":0.0584,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. Capital gains taxed as ordinary income."},"NV":{"name":"Nevada","rate":0.0,"has_tax":false,"conforms_bonus":null,"conforms_461l":null,"conforms_172_80":null,"ltcg_treatment":"no_tax","note":"No individual income tax. State analysis does not apply."},"NH":{"name":"New Hampshire","rate":0.0,"has_tax":false,"conforms_bonus":null,"conforms_461l":null,"conforms_172_80":null,"ltcg_treatment":"no_tax","note":"No tax on wages or capital gains. Interest/dividend tax repeal completes by 2027."},"NJ":{"name":"New Jersey","rate":0.1075,"has_tax":true,"conforms_bonus":false,"conforms_461l":false,"conforms_172_80":false,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. Does not generally allow NOL carryforwards for individuals. Capital gains taxed as ordinary income up to 10.75%."},"NM":{"name":"New Mexico","rate":0.059,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":{"exclusion":0.4},"note":"Historically conformed to bonus depreciation; decoupling enacted effective May 20, 2026. Allows 40% exclusion of net long-term capital gains (effective rate ~3.5%)."},"NY":{"name":"New York","rate":0.109,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation under §168(k). Capital gains taxed as ordinary income up to 10.9% state. NYC residents add up to 3.876% city tax."},"NC":{"name":"North Carolina","rate":0.045,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Fixed conformity to IRC as of Jan 1, 2023; pre-OBBBA bonus depreciation. Flat 4.5% rate on all income including capital gains."},"ND":{"name":"North Dakota","rate":0.025,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":{"exclusion":0.4},"note":"Decoupled from federal bonus depreciation. Allows 40% exclusion of net long-term capital gains."},"OH":{"name":"Ohio","rate":0.035,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation; uses 6-year amortization for bonus addback. Capital gains taxed as ordinary income."},"OK":{"name":"Oklahoma","rate":0.0475,"has_tax":true,"conforms_bonus":true,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Partially conforms to federal bonus depreciation. Capital gains generally taxed as ordinary income; Oklahoma-source asset gains may qualify for state-level exclusion."},"OR":{"name":"Oregon","rate":0.099,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. Capital gains taxed as ordinary income up to 9.9%."},"PA":{"name":"Pennsylvania","rate":0.0307,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":false,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation (uses own depreciation rules). Decoupled from OBBBA bonus. NOL deduction capped at 40% of taxable income for 2026 (corporate; increasing 10pts/yr through 2029). Flat 3.07% on personal income."},"RI":{"name":"Rhode Island","rate":0.0599,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. NOL carryforward extended to 20 years (was 5) for tax years beginning Jan 1, 2025. Capital gains taxed as ordinary income."},"SC":{"name":"South Carolina","rate":0.064,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":{"exclusion":0.44},"note":"Decoupled from federal bonus depreciation. Allows 44% exclusion of net long-term capital gains (effective rate ~3.6%)."},"SD":{"name":"South Dakota","rate":0.0,"has_tax":false,"conforms_bonus":null,"conforms_461l":null,"conforms_172_80":null,"ltcg_treatment":"no_tax","note":"No individual income tax. State analysis does not apply."},"TN":{"name":"Tennessee","rate":0.0,"has_tax":false,"conforms_bonus":null,"conforms_461l":null,"conforms_172_80":null,"ltcg_treatment":"no_tax","note":"No individual income tax. State analysis does not apply."},"TX":{"name":"Texas","rate":0.0,"has_tax":false,"conforms_bonus":null,"conforms_461l":null,"conforms_172_80":null,"ltcg_treatment":"no_tax","note":"No individual income tax. State analysis does not apply."},"UT":{"name":"Utah","rate":0.0455,"has_tax":true,"conforms_bonus":true,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Conforms to federal bonus depreciation. Flat 4.55% rate on all income including capital gains."},"VT":{"name":"Vermont","rate":0.0875,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":{"exclusion":0.4},"note":"Decoupled from federal bonus depreciation. Allows 40% exclusion of net long-term capital gains (effective rate ~5.25% top)."},"VA":{"name":"Virginia","rate":0.0575,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Conformity frozen until 2027; effectively decoupled from OBBBA. Capital gains taxed as ordinary income."},"WA":{"name":"Washington","rate":0.07,"has_tax":false,"conforms_bonus":null,"conforms_461l":null,"conforms_172_80":null,"ltcg_treatment":"wa_special","note":"No general income tax. 7% capital gains tax on long-term gains above the indexed threshold (~$262,000 for 2026, single filers; doubled for MFJ) under RCW 82.87. Real estate sales generally exempt from this tax."},"WV":{"name":"West Virginia","rate":0.0482,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":"ordinary","note":"Decoupled from federal bonus depreciation. Capital gains taxed as ordinary income up to 4.82%."},"WI":{"name":"Wisconsin","rate":0.0765,"has_tax":true,"conforms_bonus":false,"conforms_461l":true,"conforms_172_80":true,"ltcg_treatment":{"exclusion":0.3},"note":"Decoupled from federal bonus depreciation. Allows 30% exclusion of net long-term capital gains (60% for farm assets) (effective rate ~5.36% top)."},"WY":{"name":"Wyoming","rate":0.0,"has_tax":false,"conforms_bonus":null,"conforms_461l":null,"conforms_172_80":null,"ltcg_treatment":"no_tax","note":"No individual income tax. State analysis does not apply."}};

// =============================================================================
// CONSTANTS
// =============================================================================
const EBL_THRESHOLDS = {
  2025: { single: 313000, mfj: 626000, hoh: 313000, mfs: 313000 },
  2026: { single: 256000, mfj: 512000, hoh: 256000, mfs: 256000 }
};

// Federal ordinary income tax brackets (per Rev. Proc. 2025-32 for 2026)
// Each entry: [upper threshold, rate]. Top bracket has Infinity threshold.
const FED_BRACKETS_2026 = {
  single: [
    [12400, 0.10],
    [50400, 0.12],
    [105700, 0.22],
    [201775, 0.24],
    [256225, 0.32],
    [640600, 0.35],
    [Infinity, 0.37]
  ],
  mfj: [
    [24800, 0.10],
    [100800, 0.12],
    [211400, 0.22],
    [403550, 0.24],
    [512450, 0.32],
    [768700, 0.35],
    [Infinity, 0.37]
  ],
  hoh: [
    [17700, 0.10],
    [67450, 0.12],
    [105700, 0.22],
    [201775, 0.24],
    [256225, 0.32],
    [640600, 0.35],
    [Infinity, 0.37]
  ],
  mfs: [
    [12400, 0.10],
    [50400, 0.12],
    [105700, 0.22],
    [201775, 0.24],
    [256225, 0.32],
    [384350, 0.35],
    [Infinity, 0.37]
  ]
};

// 2025 federal brackets for comparison (used if taxYear === 2025)
const FED_BRACKETS_2025 = {
  single: [
    [11925, 0.10],
    [48475, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250525, 0.32],
    [626350, 0.35],
    [Infinity, 0.37]
  ],
  mfj: [
    [23850, 0.10],
    [96950, 0.12],
    [206700, 0.22],
    [394600, 0.24],
    [501050, 0.32],
    [751600, 0.35],
    [Infinity, 0.37]
  ],
  hoh: [
    [17000, 0.10],
    [64850, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250500, 0.32],
    [626350, 0.35],
    [Infinity, 0.37]
  ],
  mfs: [
    [11925, 0.10],
    [48475, 0.12],
    [103350, 0.22],
    [197300, 0.24],
    [250525, 0.32],
    [375800, 0.35],
    [Infinity, 0.37]
  ]
};

// Standard deductions (per Rev. Proc. 2025-32 for 2026; OBBBA-adjusted 2025)
const STD_DEDUCTION = {
  2025: { single: 15750, mfj: 31500, hoh: 23625, mfs: 15750 },
  2026: { single: 16100, mfj: 32200, hoh: 24150, mfs: 16100 }
};

const NIIT_RATE = 0.038;
const SECTION_1250_MAX_RATE = 0.25;

const LTCG_BRACKETS_2026 = {
  single: { zero: 49450, fifteen: 545500 },
  mfj:    { zero: 98900, fifteen: 613700 },
  hoh:    { zero: 66200, fifteen: 579600 },
  mfs:    { zero: 49450, fifteen: 306850 }
};

const NIIT_THRESHOLDS = {
  single: 200000, mfj: 250000, hoh: 200000, mfs: 125000
};

// 5-year MACRS half-year convention rates (used for cost-seg portion if not bonus)
const MACRS_5YR = [0.20, 0.32, 0.192, 0.1152, 0.1152, 0.0576];

// 27.5-year residential straight-line, half-year convention
const SL_RESIDENTIAL_FIRST = 1 / 27.5 / 2;
const SL_RESIDENTIAL_FULL = 1 / 27.5;

// =============================================================================
// HELPERS
// =============================================================================
function fmt(n) {
  if (isNaN(n) || n === null) return '\u2014';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(Math.round(n));
  return sign + '$' + abs.toLocaleString('en-US');
}

function fmtPct(n) {
  if (isNaN(n) || n === null) return '\u2014';
  return n.toFixed(2) + '%';
}

// Read a numeric value from any input — strips commas/$/spaces, accepts negative
function num(id) {
  const el = document.getElementById(id);
  if (!el) return 0;
  const cleaned = String(el.value).replace(/[$,\s]/g, '');
  const v = parseFloat(cleaned);
  return isNaN(v) ? 0 : v;
}

function val(id) {
  return document.getElementById(id).value;
}

/* A restored value is whatever localStorage held — JSON.parse hands back an
   attacker-controlled string as happily as a saved one, and `hold_period` is the
   one restored field that reaches HTML with no barrier on it at all: the
   "Over N-year hold" sublabel in renderSummary (CodeQL js/xss-through-dom 31).
   A hold period is a count of years, never text. numYears() is the coercion, and
   it runs on both halves — on the read path, where a value that will not survive
   it is refused rather than written into the field, and again at the
   interpolation sink, because JSON.parse taints the whole restored object and
   the sink-side guard is the one CodeQL credits as the barrier. */
function numYears(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toggleHelp(id) {
  document.getElementById(id).classList.toggle('show');
}

// Format a dollar input with commas as user types
function attachCommaFormatter(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', function(e) {
    const cursorPos = el.selectionStart;
    const oldLen = el.value.length;
    let raw = el.value.replace(/[^0-9.\-]/g, '');
    // Allow only one decimal point and one leading negative
    const negative = raw.startsWith('-');
    raw = raw.replace(/-/g, '');
    const parts = raw.split('.');
    let intPart = parts[0] || '';
    let decPart = parts.length > 1 ? '.' + parts.slice(1).join('').slice(0, 2) : '';
    intPart = intPart.replace(/^0+(?=\d)/, '');
    const formatted = (intPart ? Number(intPart).toLocaleString('en-US') : '') + decPart;
    el.value = (negative ? '-' : '') + formatted;
    const newLen = el.value.length;
    const newCursor = Math.max(0, cursorPos + (newLen - oldLen));
    try { el.setSelectionRange(newCursor, newCursor); } catch (e) {}
  });
}

// Toggle dollar/percent input mode for closing costs
function toggleInputMode(btn) {
  const target = btn.getAttribute('data-target');
  const mode = btn.getAttribute('data-mode');
  // Update button states
  document.querySelectorAll(`[data-target="${target}"]`).forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // Show/hide the appropriate input wrap
  document.getElementById(target + '_dollar_wrap').style.display = (mode === 'dollar') ? '' : 'none';
  document.getElementById(target + '_percent_wrap').style.display = (mode === 'percent') ? '' : 'none';
}

// Toggle NOI input method (cap rate vs gross rents + opex)
function toggleNOIMethod(btn) {
  const mode = btn.getAttribute('data-mode');
  document.querySelectorAll('[data-target="noi_method"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.getElementById('caprate_inputs').style.display = (mode === 'caprate') ? '' : 'none';
  document.getElementById('grossrent_inputs').style.display = (mode === 'grossrent') ? '' : 'none';
}

// =============================================================================
// STATE DROPDOWN POPULATION
// =============================================================================
function populateStates() {
  const select = document.getElementById('state');
  const codes = Object.keys(STATES).sort((a, b) => STATES[a].name.localeCompare(STATES[b].name));
  select.innerHTML = codes.map(c => `<option value="${c}"${c === 'FL' ? ' selected' : ''}>${STATES[c].name}</option>`).join('');
  select.addEventListener('change', updateStateNote);
  updateStateNote();
}

function updateStateNote() {
  const code = val('state');
  const s = STATES[code];
  let summary = '';
  if (s.has_tax) {
    summary = `Top marginal rate ${(s.rate * 100).toFixed(2)}%. Bonus dep: ${s.conforms_bonus ? 'conforms' : 'decoupled'}. § 461(l): ${s.conforms_461l ? 'conforms' : 'decoupled'}. NOL 80%: ${s.conforms_172_80 ? 'conforms' : 'decoupled'}.`;
  } else {
    summary = 'No individual income tax.';
  }
  document.getElementById('state_note').innerHTML = summary;
}

// =============================================================================
// MORTGAGE RATE ESTIMATOR
// =============================================================================
function estimateRate() {
  // Base May 2026 investment property rate
  const base = 7.0;

  // FICO adjustments
  const ficoAdj = {
    '780': -0.50, '760': -0.375, '740': -0.25, '720': 0.0,
    '700': 0.25, '680': 0.50, '660': 0.875, '640': 1.375
  }[val('fico')] || 0;

  // LTV adjustments
  const ltvAdj = {
    '60': -0.25, '70': 0.0, '75': 0.25, '80': 0.75
  }[val('ltv_band')] || 0;

  // Property type
  const propAdj = {
    'sfr': 0.0, 'condo': 0.125, 'multi': 0.25
  }[val('prop_type')] || 0;

  // Loan product
  const loanAdj = {
    'conv': 0.0, 'dscr': 0.0
  }[val('loan_type')] || 0;

  // STR premium (lenders typically charge more for STR vs LTR underwriting)
  const strPremium = 0.25;

  const estRate = base + ficoAdj + ltvAdj + propAdj + loanAdj + strPremium;

  document.getElementById('mortgage_rate').value = estRate.toFixed(3);
  document.getElementById('estimated_rate_display').innerHTML =
    `Estimated Rate: <strong>${estRate.toFixed(3)}%</strong> &nbsp;<span style="font-size: 0.78rem; font-weight: normal; color: #6b6b6b;">(May 2026 baseline + adjustments). Actual rate depends on full underwriting; obtain quotes from multiple lenders.</span>`;
}

// =============================================================================
// MORTGAGE AMORTIZATION
// =============================================================================
function buildAmortization(principal, annualRate, termYears, holdYears) {
  const monthlyRate = annualRate / 12;
  const totalMonths = termYears * 12;
  const monthlyPayment = principal * monthlyRate * Math.pow(1 + monthlyRate, totalMonths) / (Math.pow(1 + monthlyRate, totalMonths) - 1);

  const yearlyData = [];
  let balance = principal;

  for (let year = 1; year <= holdYears; year++) {
    let yearInterest = 0;
    let yearPrincipal = 0;
    for (let m = 0; m < 12; m++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      yearInterest += interestPayment;
      yearPrincipal += principalPayment;
      balance -= principalPayment;
    }
    yearlyData.push({ year, interest: yearInterest, principal: yearPrincipal, endBalance: balance, monthlyPayment });
  }
  return { yearlyData, monthlyPayment };
}

// =============================================================================
// DEPRECIATION SCHEDULES
// =============================================================================
function buildFederalDepreciation(buildingBasis, reclassPct, bonusRate, holdYears) {
  const reclassAmt = buildingBasis * reclassPct;
  const shellAmt = buildingBasis - reclassAmt;
  const bonusDed = reclassAmt * bonusRate;
  const reclassResidual = reclassAmt - bonusDed;

  const yearly = [];
  for (let y = 1; y <= holdYears; y++) {
    let dep = 0;
    if (y === 1) {
      dep += bonusDed;
      // Remaining reclass amount uses 5-year MACRS half-year
      dep += reclassResidual * MACRS_5YR[0];
      dep += shellAmt * SL_RESIDENTIAL_FIRST;
    } else {
      // Continue MACRS on residual reclass
      if (y - 1 < MACRS_5YR.length) {
        dep += reclassResidual * MACRS_5YR[y - 1];
      }
      // Half-year convention: years 2..27 get full SL; year 28 gets half
      if (y < 28) {
        dep += shellAmt * SL_RESIDENTIAL_FULL;
      } else if (y === 28) {
        dep += shellAmt * SL_RESIDENTIAL_FIRST;
      }
    }
    yearly.push(dep);
  }
  return yearly;
}

function buildStateDepreciation(buildingBasis, reclassPct, holdYears, conforms) {
  // If state conforms to federal bonus, this matches federal
  // If state decouples, no bonus — full MACRS schedule
  const reclassAmt = buildingBasis * reclassPct;
  const shellAmt = buildingBasis - reclassAmt;

  const yearly = [];
  for (let y = 1; y <= holdYears; y++) {
    let dep = 0;
    if (y === 1) {
      dep += reclassAmt * MACRS_5YR[0];
      dep += shellAmt * SL_RESIDENTIAL_FIRST;
    } else {
      if (y - 1 < MACRS_5YR.length) {
        dep += reclassAmt * MACRS_5YR[y - 1];
      }
      if (y < 28) {
        dep += shellAmt * SL_RESIDENTIAL_FULL;
      } else if (y === 28) {
        dep += shellAmt * SL_RESIDENTIAL_FIRST;
      }
    }
    yearly.push(dep);
  }
  return yearly;
}

// =============================================================================
// FEDERAL ORDINARY INCOME TAX — compute tax via bracket-walking
// =============================================================================

// Compute federal ordinary income tax on TAXABLE income (after standard deduction)
// using the proper bracket structure. This is the basis for all "tax savings"
// calculations in the model — replaces the previous (and incorrect) approach
// of simply multiplying income by the user-entered marginal rate.
function computeFederalOrdinaryTax(taxableIncome, filingStatus, taxYear) {
  if (taxableIncome <= 0) return 0;
  const brackets = (taxYear === 2025) ? FED_BRACKETS_2025[filingStatus] : FED_BRACKETS_2026[filingStatus];
  let tax = 0;
  let prevThreshold = 0;
  for (const [threshold, rate] of brackets) {
    if (taxableIncome <= threshold) {
      tax += (taxableIncome - prevThreshold) * rate;
      return tax;
    }
    tax += (threshold - prevThreshold) * rate;
    prevThreshold = threshold;
  }
  return tax;
}

// Get the applicable standard deduction for the filing status and tax year
function getStandardDeduction(filingStatus, taxYear) {
  return STD_DEDUCTION[taxYear][filingStatus] || STD_DEDUCTION[2026].mfj;
}

// Get the marginal rate (top applicable bracket rate) for a given taxable income.
// Used for §1245 recapture calculation — the marginal rate is the rate that would
// apply to "the next dollar" of ordinary income at this income level.
function getMarginalRate(taxableIncome, filingStatus, taxYear) {
  if (taxableIncome <= 0) return 0.10;
  const brackets = (taxYear === 2025) ? FED_BRACKETS_2025[filingStatus] : FED_BRACKETS_2026[filingStatus];
  for (const [threshold, rate] of brackets) {
    if (taxableIncome <= threshold) return rate;
  }
  return 0.37;  // top bracket
}

// =============================================================================
// STATE TAX HELPERS — handle different state LTCG treatments and special cases
// =============================================================================

// Compute state tax on LTCG (or ordinary capital gain) given a state code.
// Returns the state tax owed on the LTCG amount.
// Handles: no_tax states, ordinary-income treatment, preferential rates,
// partial exclusions, and Washington's special $262K threshold tax.
function computeStateLTCGTax(ltcgAmt, ordinaryIncome, stateCode, filingStatus) {
  if (ltcgAmt <= 0) return 0;
  const s = STATES[stateCode];
  if (!s.has_tax) {
    // Special case: Washington has 7% LTCG above threshold even though no general income tax
    if (s.ltcg_treatment === 'wa_special') {
      const threshold = filingStatus === 'mfj' ? 524000 : 262000;
      const taxable = Math.max(0, ltcgAmt - threshold);
      return taxable * 0.07;
    }
    return 0;
  }
  const treatment = s.ltcg_treatment;
  if (treatment === 'ordinary') {
    return ltcgAmt * s.rate;
  }
  if (typeof treatment === 'object' && treatment !== null) {
    if ('rate' in treatment) {
      // Preferential flat rate (HI, MA, MT)
      return ltcgAmt * treatment.rate;
    }
    if ('exclusion' in treatment) {
      // Partial exclusion (AR, NM, ND, SC, VT, WI)
      const taxablePortion = ltcgAmt * (1 - treatment.exclusion);
      return taxablePortion * s.rate;
    }
  }
  // Fallback
  return ltcgAmt * s.rate;
}

// Compute state tax on ordinary income at the state's flat/top rate.
// This is a simplification — actual state tax uses graduated brackets.
function computeStateOrdinaryTax(amount, stateCode) {
  if (amount <= 0) return 0;
  const s = STATES[stateCode];
  if (!s.has_tax) return 0;
  return amount * s.rate;
}

// Check whether the state allows the §172 80% NOL utilization rule the same as federal.
// Some states have stricter limits (PA, MN), some suspend NOL deductions (CA), some don't allow individual NOL CFW (NJ).
function stateNOLRule(stateCode) {
  const s = STATES[stateCode];
  if (!s.has_tax) return { allowed: false, percentage: 0, note: 'No state tax' };
  if (stateCode === 'CA') {
    return { allowed: false, percentage: 0, note: 'CA suspended NOL deductions through 2026 for taxpayers with net business income >$1M (limited small business exception applies)' };
  }
  if (stateCode === 'NJ') {
    return { allowed: false, percentage: 0, note: 'NJ generally does not allow NOL carryforwards for individuals' };
  }
  if (stateCode === 'PA') {
    return { allowed: true, percentage: 0.40, note: 'PA caps NOL deduction at 40% of taxable income for 2026 (corporate; individual rules differ)' };
  }
  if (stateCode === 'MN') {
    return { allowed: true, percentage: 0.70, note: 'MN limits NOL deduction to 70% of taxable income (corporate)' };
  }
  if (stateCode === 'AR') {
    return { allowed: true, percentage: 1.00, note: 'AR allows full NOL utilization (no 80% federal cap)' };
  }
  // Default: conforms to federal 80%
  return { allowed: true, percentage: 0.80, note: 'Conforms to federal §172 80% rule' };
}

// =============================================================================
// TAX HELPERS — LTCG bracket stacking and NIIT
// =============================================================================
function computeLTCGTax(ltcgAmt, ordinaryIncome, filingStatus) {
  if (ltcgAmt <= 0) return 0;
  const br = LTCG_BRACKETS_2026[filingStatus];
  // Stack LTCG on top of ordinary income to determine bracket(s)
  const start = Math.max(0, ordinaryIncome);
  const end = start + ltcgAmt;
  let at0 = 0, at15 = 0, at20 = 0;
  if (start < br.zero) at0 = Math.min(end, br.zero) - start;
  const fifteenStart = Math.max(start, br.zero);
  if (fifteenStart < br.fifteen && end > br.zero) at15 = Math.min(end, br.fifteen) - fifteenStart;
  if (end > br.fifteen) at20 = end - Math.max(start, br.fifteen);
  return Math.max(0, at15) * 0.15 + Math.max(0, at20) * 0.20;
}

function computeNIIT(investmentIncome, magi, filingStatus) {
  if (investmentIncome <= 0) return 0;
  const threshold = NIIT_THRESHOLDS[filingStatus];
  const excess = Math.max(0, magi - threshold);
  const niitBase = Math.min(investmentIncome, excess);
  return Math.max(0, niitBase) * NIIT_RATE;
}

// =============================================================================
// ELIGIBILITY DETERMINATION
// =============================================================================
function determineEligibility(inputs) {
  // ==========================================================================
  // STEP 1 — Per Se Passive Analysis (Reg. § 1.469-1T(e)(3)(ii) + § 469(c)(7))
  // ==========================================================================
  // Determine if the activity is "rental activity" (per se passive under §469(c)(2))
  // or whether one of the six exceptions in Reg. §1.469-1T(e)(3)(ii) — or REPS —
  // takes it outside per se passive treatment.

  const step1 = analyzeStep1PerSePassive(inputs);

  // ==========================================================================
  // STEP 2 — Material Participation Tests (Reg. § 1.469-5T)
  // ==========================================================================
  // Run all seven tests against the inputs. If Step 1 establishes that the
  // activity is NOT per se passive, satisfying any one test makes the activity
  // non-passive. If Step 1 keeps the activity as per se passive, MP doesn't
  // matter — losses suspend regardless (unless REPS).
  const step2 = analyzeStep2MaterialParticipation(inputs);

  // ==========================================================================
  // COMBINED VERDICT
  // ==========================================================================
  // Compose final passive/non-passive characterization plus a top-level status
  // for backward compatibility with existing verdict/banner logic.
  const combined = composeStep1Step2Verdict(step1, step2, inputs);

  // Return structured result; keep top-level status/label/explanation fields
  // so existing renderers don't break, but add step1 and step2 detail.
  return {
    status: combined.status,
    label: combined.label,
    explanation: combined.explanation,
    step1: step1,
    step2: step2,
    combined: combined
  };
}

// ----------------------------------------------------------------------------
// Step 1 Analyzer — Six exceptions + REPS
// ----------------------------------------------------------------------------
function analyzeStep1PerSePassive(inputs) {
  const period = inputs.rentalPeriod;                  // 'le7' | 'le30' | 'gt30'
  const sps = inputs.sigPersonalServices === 'yes';
  const eps = inputs.extraPersonalServices === 'yes';
  const incidental = inputs.incidentalRental === 'yes';
  const businessHours = inputs.businessHoursAvail === 'yes';
  const jvUse = inputs.jvUse === 'yes';
  const reps = inputs.reps;

  // Evaluate each exception
  const exceptions = [];

  // (A) Average period ≤ 7 days
  if (period === 'le7') {
    exceptions.push({
      letter: 'A',
      label: '≤ 7 days average use',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(A)',
      satisfied: true,
      note: 'Average customer use period is 7 days or less. The activity is not a rental activity under §469.'
    });
  } else {
    exceptions.push({
      letter: 'A',
      label: '≤ 7 days average use',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(A)',
      satisfied: false,
      note: 'Average customer use exceeds 7 days. Exception (A) does not apply.'
    });
  }

  // (B) 8-30 days + significant personal services
  if (period === 'le30' && sps) {
    exceptions.push({
      letter: 'B',
      label: '8–30 days with significant personal services',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(B)',
      satisfied: true,
      note: 'Average use 8–30 days AND significant personal services provided. The activity is not a rental activity.'
    });
  } else if (period === 'le30' && !sps) {
    exceptions.push({
      letter: 'B',
      label: '8–30 days with significant personal services',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(B)',
      satisfied: false,
      needsDevelopment: true,
      note: 'Average use 8–30 days, but "significant personal services" not indicated. Whether services rise to the "significant" threshold is fact-specific.'
    });
  } else {
    exceptions.push({
      letter: 'B',
      label: '8–30 days with significant personal services',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(B)',
      satisfied: false,
      note: 'Average use is not 8–30 days. Exception (B) does not apply.'
    });
  }

  // (C) Extraordinary personal services
  if (eps) {
    exceptions.push({
      letter: 'C',
      label: 'Extraordinary personal services',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(C)',
      satisfied: true,
      note: 'Extraordinary personal services provided (rental use incidental to services). The activity is not a rental activity, regardless of average period.'
    });
  } else {
    exceptions.push({
      letter: 'C',
      label: 'Extraordinary personal services',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(C)',
      satisfied: false,
      note: 'Extraordinary personal services not indicated.'
    });
  }

  // (D) Incidental rental
  if (incidental) {
    exceptions.push({
      letter: 'D',
      label: 'Incidental to non-rental activity',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(D)',
      satisfied: true,
      needsDevelopment: true,
      note: 'Rental indicated as incidental to a non-rental activity. The exception requires either (i) gross rents ≤ 2% of the lesser of unadjusted basis or FMV (investment property), or (ii) property used principally in a non-rental trade or business with rental during periods of non-use. Verify facts.'
    });
  } else {
    exceptions.push({
      letter: 'D',
      label: 'Incidental to non-rental activity',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(D)',
      satisfied: false,
      note: 'Rental not indicated as incidental.'
    });
  }

  // (E) Business hours / nonexclusive use
  if (businessHours) {
    exceptions.push({
      letter: 'E',
      label: 'Defined business hours / nonexclusive use',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(E)',
      satisfied: true,
      note: 'Property customarily available during defined business hours for nonexclusive use. The activity is not a rental activity.'
    });
  } else {
    exceptions.push({
      letter: 'E',
      label: 'Defined business hours / nonexclusive use',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(E)',
      satisfied: false,
      note: 'Property not operated under defined business hours / nonexclusive use model.'
    });
  }

  // (F) Pass-through entity non-rental use
  if (jvUse) {
    exceptions.push({
      letter: 'F',
      label: 'Pass-through entity non-rental activity',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(F)',
      satisfied: true,
      needsDevelopment: true,
      note: 'Property provided for use in a non-rental activity of a partnership, S corp, or JV in which taxpayer owns an interest. The activity is not a rental activity. Watch for self-rental recharacterization under Reg. § 1.469-2(f)(6).'
    });
  } else {
    exceptions.push({
      letter: 'F',
      label: 'Pass-through entity non-rental activity',
      cite: 'Reg. § 1.469-1T(e)(3)(ii)(F)',
      satisfied: false,
      note: 'Property not provided for pass-through non-rental use.'
    });
  }

  // REPS path — separate from the six exceptions
  let repsAnalysis;
  if (reps === 'yes' || reps === 'spouse') {
    repsAnalysis = {
      satisfied: true,
      label: reps === 'yes' ? 'REPS — Taxpayer qualifies' : 'REPS — Spouse qualifies (joint filing)',
      cite: '§ 469(c)(7)',
      note: 'REPS qualification means rental real estate activities are not per se passive — but the qualifying spouse must still materially participate in the specific rental activity for it to be non-passive.'
    };
  } else {
    repsAnalysis = {
      satisfied: false,
      label: 'REPS not established',
      cite: '§ 469(c)(7)',
      note: 'Neither taxpayer nor spouse qualifies as a real estate professional. REPS path unavailable.'
    };
  }

  // Determine if Step 1 escapes per se passive treatment
  const anyExceptionSatisfied = exceptions.some(e => e.satisfied);
  const satisfiedException = exceptions.find(e => e.satisfied);

  let outcome;
  if (anyExceptionSatisfied) {
    outcome = {
      escapesPerSePassive: true,
      path: 'exception',
      basis: satisfiedException,
      label: `Exception (${satisfiedException.letter}) Applies — Activity is NOT a Rental Activity`,
      summary: `${satisfiedException.cite}. The activity falls outside §469(c)(2) and is analyzed under the general material participation framework.`
    };
  } else if (repsAnalysis.satisfied) {
    outcome = {
      escapesPerSePassive: true,
      path: 'reps',
      basis: repsAnalysis,
      label: 'REPS — Rental Activities Not Per Se Passive',
      summary: `${repsAnalysis.cite}. Per se passive treatment is removed for the qualifying spouse's rental real estate activities; material participation in the specific activity must still be established.`
    };
  } else {
    outcome = {
      escapesPerSePassive: false,
      path: 'none',
      basis: null,
      label: 'Per Se Passive — No Exception Applies',
      summary: 'No exception under Reg. §1.469-1T(e)(3)(ii) applies, and REPS is not established. The activity is per se passive under §469(c)(2); operating losses suspend regardless of material participation.'
    };
  }

  return {
    exceptions: exceptions,
    reps: repsAnalysis,
    outcome: outcome
  };
}

// ----------------------------------------------------------------------------
// Step 2 Analyzer — All 7 material participation tests of Reg. § 1.469-5T
// ----------------------------------------------------------------------------
function analyzeStep2MaterialParticipation(inputs) {
  const tH = inputs.taxpayerHours || 0;
  const oH = inputs.otherHours || 0;
  const spaH = inputs.totalSpaHours || 0;
  const prior5of10 = inputs.prior5of10;          // 'yes' | 'no' | 'unknown'
  const regContinuous = inputs.regularContinuous; // 'yes' | 'no' | 'unknown'
  const mgmt = inputs.management;

  const tests = [];

  // ----- Test 1: 500+ hours -----
  if (tH >= 500) {
    tests.push({ num: 1, label: '500+ hours in current year', cite: 'Reg. § 1.469-5T(a)(1)', satisfied: true,
      note: `${tH} hours reported; threshold met.` });
  } else if (tH > 0) {
    tests.push({ num: 1, label: '500+ hours in current year', cite: 'Reg. § 1.469-5T(a)(1)', satisfied: false,
      note: `${tH} hours reported; ${500 - tH} more needed to satisfy.` });
  } else {
    tests.push({ num: 1, label: '500+ hours in current year', cite: 'Reg. § 1.469-5T(a)(1)', satisfied: false, needsData: true,
      note: 'Enter taxpayer hours to evaluate.' });
  }

  // ----- Test 2: Substantially all of the participation -----
  // Generally satisfied if taxpayer hours >= 0.95 × (taxpayer + all other) hours
  // We use other_hours as the largest single other participant — conservative.
  if (tH > 0 && oH === 0) {
    tests.push({ num: 2, label: 'Substantially all of the participation', cite: 'Reg. § 1.469-5T(a)(2)', satisfied: true,
      note: `Taxpayer is the only individual participating (${tH} hrs taxpayer, 0 hrs others).` });
  } else if (tH > 0 && oH > 0) {
    const ratio = tH / (tH + oH);
    if (ratio >= 0.95) {
      tests.push({ num: 2, label: 'Substantially all of the participation', cite: 'Reg. § 1.469-5T(a)(2)', satisfied: true,
        note: `Taxpayer ${tH} hrs vs. ${oH} hrs others (~${(ratio*100).toFixed(0)}% of participation).` });
    } else {
      tests.push({ num: 2, label: 'Substantially all of the participation', cite: 'Reg. § 1.469-5T(a)(2)', satisfied: false,
        note: `Taxpayer ${tH} hrs vs. ${oH} hrs others (only ~${(ratio*100).toFixed(0)}% of participation). "Substantially all" typically requires ≥95%.` });
    }
  } else {
    tests.push({ num: 2, label: 'Substantially all of the participation', cite: 'Reg. § 1.469-5T(a)(2)', satisfied: false, needsData: true,
      note: 'Enter taxpayer hours to evaluate.' });
  }

  // ----- Test 3: 100+ hours and not less than any other individual -----
  if (mgmt === 'full' && oH < 100) {
    tests.push({ num: 3, label: '100+ hours and not less than any other', cite: 'Reg. § 1.469-5T(a)(3)', satisfied: false,
      note: 'Full-service property manager typically exceeds owner hours. Test 3 fails unless taxpayer hours documented above manager hours.' });
  } else if (tH > 100 && tH >= oH) {
    tests.push({ num: 3, label: '100+ hours and not less than any other', cite: 'Reg. § 1.469-5T(a)(3)', satisfied: true,
      note: `${tH} hours > 100, and ≥ next-highest individual at ${oH} hours.` });
  } else if (tH > 100 && tH < oH) {
    tests.push({ num: 3, label: '100+ hours and not less than any other', cite: 'Reg. § 1.469-5T(a)(3)', satisfied: false,
      note: `${tH} hours exceeds 100, but another individual has ${oH} hours. Test 3 fails on the comparison prong.` });
  } else if (tH > 0 && tH <= 100) {
    tests.push({ num: 3, label: '100+ hours and not less than any other', cite: 'Reg. § 1.469-5T(a)(3)', satisfied: false,
      note: `${tH} hours; need more than 100 to satisfy.` });
  } else {
    tests.push({ num: 3, label: '100+ hours and not less than any other', cite: 'Reg. § 1.469-5T(a)(3)', satisfied: false, needsData: true,
      note: 'Enter taxpayer hours to evaluate.' });
  }

  // ----- Test 4: Significant Participation Activity + total SPA > 500 -----
  // Requires: (a) this activity is an SPA (100+ hours, non-MP), AND (b) sum of all SPA hours > 500
  if (tH >= 100 && tH < 500 && tH <= oH) {
    // This activity could qualify as an SPA — and the user needs total SPA hours from other activities
    const totalForTest4 = tH + spaH;
    if (totalForTest4 > 500) {
      tests.push({ num: 4, label: 'Significant participation activity + total SPA hours > 500', cite: 'Reg. § 1.469-5T(a)(4)', satisfied: true,
        note: `${tH} hrs in this SPA + ${spaH} hrs in other SPAs = ${totalForTest4} hrs total. Threshold met.` });
    } else {
      tests.push({ num: 4, label: 'Significant participation activity + total SPA hours > 500', cite: 'Reg. § 1.469-5T(a)(4)', satisfied: false,
        note: `${tH} hrs in this SPA + ${spaH} hrs in other SPAs = ${totalForTest4} hrs. Need > 500.` });
    }
  } else if (tH >= 500) {
    tests.push({ num: 4, label: 'Significant participation activity + total SPA hours > 500', cite: 'Reg. § 1.469-5T(a)(4)', satisfied: false,
      note: 'Taxpayer hours ≥ 500 — Test 1 controls. Test 4 only applies where current activity does not independently satisfy MP.' });
  } else if (tH > 0 && tH < 100) {
    tests.push({ num: 4, label: 'Significant participation activity + total SPA hours > 500', cite: 'Reg. § 1.469-5T(a)(4)', satisfied: false,
      note: `Activity is not an SPA (requires 100+ hours in the activity). ${tH} hours below threshold.` });
  } else {
    tests.push({ num: 4, label: 'Significant participation activity + total SPA hours > 500', cite: 'Reg. § 1.469-5T(a)(4)', satisfied: false, needsData: true,
      note: 'Enter taxpayer hours to evaluate.' });
  }

  // ----- Test 5: Material participation in 5 of prior 10 years -----
  if (prior5of10 === 'yes') {
    tests.push({ num: 5, label: 'Material participation in any 5 of prior 10 years', cite: 'Reg. § 1.469-5T(a)(5)', satisfied: true,
      note: 'Taxpayer reported MP in this activity in 5+ of the prior 10 tax years.' });
  } else if (prior5of10 === 'no') {
    tests.push({ num: 5, label: 'Material participation in any 5 of prior 10 years', cite: 'Reg. § 1.469-5T(a)(5)', satisfied: false,
      note: 'Taxpayer did not materially participate in 5+ of the prior 10 years.' });
  } else {
    tests.push({ num: 5, label: 'Material participation in any 5 of prior 10 years', cite: 'Reg. § 1.469-5T(a)(5)', satisfied: false, needsData: true,
      note: 'Prior year participation not yet determined.' });
  }

  // ----- Test 6: Personal service activity, 3+ prior years (real estate excluded) -----
  tests.push({ num: 6, label: 'Personal service activity, 3+ prior years', cite: 'Reg. § 1.469-5T(a)(6)', satisfied: false,
    inapplicable: true,
    note: '"Personal service activity" under Reg. § 1.469-5T(d) excludes real estate. Generally not available for STR/LTR taxpayers.' });

  // ----- Test 7: Facts and circumstances -----
  // Must have 100+ hours floor; participation must be regular, continuous, substantial
  if (tH < 100) {
    tests.push({ num: 7, label: 'Facts and circumstances (regular, continuous, substantial)', cite: 'Reg. § 1.469-5T(a)(7), (b)', satisfied: false,
      note: 'Test 7 requires at least 100 hours of participation. Threshold not met.' });
  } else if (regContinuous === 'yes') {
    tests.push({ num: 7, label: 'Facts and circumstances (regular, continuous, substantial)', cite: 'Reg. § 1.469-5T(a)(7), (b)', satisfied: true,
      note: `${tH} hours with regular, continuous, and substantial participation reported. Facts-and-circumstances showing required to support on examination.` });
  } else if (regContinuous === 'no') {
    tests.push({ num: 7, label: 'Facts and circumstances (regular, continuous, substantial)', cite: 'Reg. § 1.469-5T(a)(7), (b)', satisfied: false,
      note: 'Participation not reported as regular, continuous, and substantial. Test 7 not satisfied.' });
  } else {
    tests.push({ num: 7, label: 'Facts and circumstances (regular, continuous, substantial)', cite: 'Reg. § 1.469-5T(a)(7), (b)', satisfied: false, needsData: true,
      note: 'Facts-and-circumstances determination required.' });
  }

  // Determine overall MP status
  const passedTest = tests.find(t => t.satisfied);
  const anyNeedsData = tests.some(t => t.needsData);
  let outcome;
  if (passedTest) {
    outcome = {
      materialParticipation: true,
      satisfiedTestNum: passedTest.num,
      label: `Material Participation Established via Test ${passedTest.num}`,
      summary: `${passedTest.cite}: ${passedTest.label}.`
    };
  } else if (anyNeedsData) {
    outcome = {
      materialParticipation: false,
      label: 'Material Participation — Additional Inputs Needed',
      summary: 'Provide hours and prior-year participation data to complete the seven-test analysis.'
    };
  } else {
    outcome = {
      materialParticipation: false,
      label: 'Material Participation NOT Established',
      summary: 'None of the seven tests of Reg. § 1.469-5T are satisfied with the data provided.'
    };
  }

  return {
    tests: tests,
    outcome: outcome
  };
}

// ----------------------------------------------------------------------------
// Compose Combined Verdict — translate Step 1 + Step 2 → top-level status
// for backward compatibility with the rest of the calculator
// ----------------------------------------------------------------------------
function composeStep1Step2Verdict(step1, step2, inputs) {
  // Activity is non-passive only if BOTH:
  //   (a) Step 1 escapes per se passive (exception or REPS), AND
  //   (b) Step 2 establishes material participation
  if (step1.outcome.escapesPerSePassive && step2.outcome.materialParticipation) {
    const basis = step1.outcome.path === 'exception'
      ? `Exception (${step1.outcome.basis.letter}) under ${step1.outcome.basis.cite}`
      : `REPS under ${step1.outcome.basis.cite}`;
    return {
      status: 'likely-eligible',
      label: 'Non-Passive — Losses Available Against W-2',
      explanation: `Two-step analysis complete. Step 1: ${basis}. Step 2: Material participation established via Test ${step2.outcome.satisfiedTestNum} (${step2.tests.find(t => t.num === step2.outcome.satisfiedTestNum).cite}). The activity is non-passive; operating losses are available to offset W-2 wages and other ordinary income, subject to § 461(l) and § 172.`
    };
  }

  // If Step 1 fails — per se passive regardless of MP
  if (!step1.outcome.escapesPerSePassive) {
    return {
      status: 'likely-ineligible',
      label: 'Per Se Passive — Losses Suspend Under § 469',
      explanation: `Step 1 analysis: No exception under Reg. § 1.469-1T(e)(3)(ii) applies (review the six exceptions above), and REPS is not established. The activity remains a "rental activity" under § 469(c)(2). Operating losses are per se passive and suspend under § 469 until disposition (where they release to offset gain). Material participation under Step 2 does not change this outcome absent an exception or REPS.`
    };
  }

  // Step 1 passes but Step 2 fails (or needs data)
  if (step2.outcome.materialParticipation === false) {
    const stillNeedsData = step2.tests.some(t => t.needsData);
    if (stillNeedsData) {
      return {
        status: 'marginal',
        label: 'Material Participation — Additional Facts Required',
        explanation: `Step 1 analysis: ${step1.outcome.label}. Step 2: Material participation analysis is incomplete — additional facts are needed. Provide complete hours data and prior-year participation to determine which (if any) of the seven tests is satisfied.`
      };
    }
    return {
      status: 'likely-ineligible',
      label: 'Non-Rental Activity But No Material Participation',
      explanation: `Step 1 analysis: ${step1.outcome.label}. The activity escapes per se passive treatment. However, Step 2: None of the seven material participation tests of Reg. § 1.469-5T are satisfied with the inputs provided. The activity is non-rental but non-MP — losses are still treated as from a passive activity under § 469(h) and suspend until material participation is established or the activity is disposed of.`
    };
  }

  // Fallback
  return {
    status: 'marginal',
    label: 'Eligibility — Insufficient Information',
    explanation: 'Provide all inputs in Steps 1 and 2 to complete the §469 analysis.'
  };
}


// =============================================================================
// MAIN CALCULATION
// =============================================================================
function gatherInputsFromDOM() {
  // ----- Gather inputs -----
  const purchasePrice = num('purchase_price');

  // Closing costs — could be dollar or percent based on toggle state
  const closingCostsMode = document.querySelector('[data-target="closing_costs"].active').getAttribute('data-mode');
  const closingCosts = (closingCostsMode === 'dollar')
    ? num('closing_costs')
    : purchasePrice * (num('closing_costs_pct') / 100);

  // Down payment is now a percentage of purchase price
  const downPaymentPct = num('down_payment_pct') / 100;
  const downPayment = purchasePrice * downPaymentPct;

  // NOI: determine from active method (cap rate vs gross rents + opex)
  const noiMethodBtn = document.querySelector('[data-target="noi_method"].active');
  const noiMethod = noiMethodBtn ? noiMethodBtn.getAttribute('data-mode') : 'caprate';
  let year1NOI;
  let capRateInput = num('cap_rate') / 100;
  let grossRentsInput = num('gross_rents');
  let opexRatioInput = num('opex_ratio') / 100;
  if (noiMethod === 'caprate') {
    year1NOI = purchasePrice * capRateInput;
  } else {
    year1NOI = grossRentsInput * (1 - opexRatioInput);
  }

  const inputs = {
    // Step 1 — Per Se Passive Analysis fields
    rentalPeriod: val('rental_period'),
    sigPersonalServices: val('sig_personal_services'),
    extraPersonalServices: val('extra_personal_services'),
    incidentalRental: val('incidental_rental'),
    businessHoursAvail: val('business_hours_avail'),
    jvUse: val('jv_use'),
    reps: val('reps'),
    // Step 2 — Material Participation fields
    management: val('management'),
    taxpayerHours: num('taxpayer_hours'),
    otherHours: num('other_hours'),
    totalSpaHours: num('total_spa_hours'),
    prior5of10: val('prior_5_of_10'),
    regularContinuous: val('regular_continuous'),
    // Steps 3+ unchanged
    purchasePrice: purchasePrice,
    closingCosts: closingCosts,
    landPct: num('land_pct') / 100,
    reclassPct: num('reclass_pct') / 100,
    downPayment: downPayment,
    downPaymentPct: downPaymentPct,
    mortgageRate: num('mortgage_rate') / 100,
    mortgageTerm: num('mortgage_term'),
    noiMethod: noiMethod,
    year1NOI: year1NOI,
    capRate: capRateInput,
    grossRents: grossRentsInput,
    opexRatio: opexRatioInput,
    filingStatus: val('filing_status'),
    taxYear: parseInt(val('tax_year')),
    w2Wages: num('w2_wages'),
    businessIncome: num('business_income'),
    otherNonBusiness: num('other_nonbusiness'),
    ltCapGains: num('lt_cap_gains'),
    state: val('state'),
    holdPeriod: parseInt(val('hold_period')),
    bonusRate: num('bonus_rate') / 100,
    appreciationRate: num('appreciation_rate') / 100,
    rentGrowth: num('rent_growth') / 100,
    opexGrowth: num('opex_growth') / 100,
    sellingCostsPct: num('selling_costs_pct') / 100
  };

  return inputs;
}

function validateInputs(inputs, silent) {
  // When silent is true, return false without alerting (used by heatmap).
  function fail(msg) {
    if (!silent) alert(msg);
    return false;
  }
  // ----- Validate basics -----
  if (inputs.purchasePrice === 0) {
    return fail('Please enter a purchase price.');
  }
  if (inputs.downPaymentPct < 0 || inputs.downPaymentPct > 1) {
    return fail('Down payment percentage must be between 0% and 100%.');
  }
  if (inputs.mortgageRate === 0) {
    return fail('Please enter a mortgage rate (or use the Estimate My Rate button).');
  }
  if (inputs.year1NOI <= 0) {
    if (inputs.noiMethod === 'caprate') {
      return fail('Please enter a Year 1 cap rate.');
    } else {
      return fail('Please enter Gross Annual Rents and an Operating Expense Ratio (the resulting NOI must be positive).');
    }
  }

  // ----- Validate completeness of inputs required for meaningful analysis -----
  // Step 1 must establish a non-per-se-passive activity (exception OR REPS) OR
  // Step 2 hours must be entered. Without these, the §469 analysis is meaningless.
  const hasExceptionInput = inputs.rentalPeriod === 'le7'
    || (inputs.rentalPeriod === 'le30' && inputs.sigPersonalServices === 'yes')
    || inputs.extraPersonalServices === 'yes'
    || inputs.incidentalRental === 'yes'
    || inputs.businessHoursAvail === 'yes'
    || inputs.jvUse === 'yes';
  const hasReps = inputs.reps === 'yes' || inputs.reps === 'spouse';
  const hasHours = inputs.taxpayerHours > 0;
  if (!hasExceptionInput && !hasReps && !hasHours) {
    return fail('Step 1 / Step 2 inputs are required: Either (a) at least one Reg. \u00a7 1.469-1T(e)(3)(ii) exception must be indicated (e.g., \u22647-day average use, significant personal services, etc.), (b) REPS must be established, or (c) taxpayer hours must be entered for the material participation analysis. Without these, the \u00a7 469 analysis cannot proceed.');
  }

  const totalIncome = inputs.w2Wages + Math.max(0, inputs.businessIncome) + inputs.otherNonBusiness;
  if (totalIncome === 0) {
    return fail('Please enter your income in Step 5 — Taxpayer Profile (W-2 Wages, Business Income, or Other Non-Business Income). Without taxable income to shield, the strategy produces no benefit and the analysis is uninformative.');
  }

  return true;
}

function computeScenario(inputs) {
  // ----- Eligibility -----
  const eligibility = determineEligibility(inputs);

  // ----- Property and basis -----
  const totalBasis = inputs.purchasePrice + inputs.closingCosts;
  const landValue = totalBasis * inputs.landPct;
  const buildingBasis = totalBasis - landValue;
  // Cost seg reclassification is expressed as % of total purchase price (per practitioner convention)
  // Clamp the reclass amount to building basis to avoid math impossibility
  const reclassAmtRaw = inputs.purchasePrice * inputs.reclassPct;
  const reclassAmt = Math.min(reclassAmtRaw, buildingBasis * 0.95); // never let reclass exceed 95% of building basis
  const effectiveReclassPct = buildingBasis > 0 ? reclassAmt / buildingBasis : 0;
  const loanAmount = inputs.purchasePrice - inputs.downPayment;

  // ----- Mortgage -----
  const mortgage = buildAmortization(loanAmount, inputs.mortgageRate, inputs.mortgageTerm, inputs.holdPeriod);

  // ----- Depreciation -----
  const fedDep = buildFederalDepreciation(buildingBasis, effectiveReclassPct, inputs.bonusRate, inputs.holdPeriod);
  const stateConforms = STATES[inputs.state].conforms_bonus;
  const stateDep = stateConforms === true ? fedDep : buildStateDepreciation(buildingBasis, effectiveReclassPct, inputs.holdPeriod, false);

  // ----- Annual P&L projection -----
  const ebl = EBL_THRESHOLDS[inputs.taxYear][inputs.filingStatus];
  const eblTextStr = '$' + ebl.toLocaleString();

  let nolBalance = 0;
  let cumFedDep = 0;
  let cumStateDep = 0;
  let cumFedTaxSavings = 0;
  let cumStateTaxSavings = 0;
  let cumCashFlowAfterTax = 0;
  let cumNOI = 0;

  const stateRate = STATES[inputs.state].rate;
  const stateHasTax = STATES[inputs.state].has_tax;

  const yearlyResults = [];

  for (let y = 1; y <= inputs.holdPeriod; y++) {
    // Property value: grows at appreciation rate
    const propValue = inputs.purchasePrice * Math.pow(1 + inputs.appreciationRate, y - 1);
    // NOI: depends on input mode
    //   - Cap rate mode: Year 1 NOI grows at rent growth rate
    //   - Gross rents mode: rents and opex grow independently, NOI = rents − opex
    let noiSimple;
    if (inputs.noiMethod === 'caprate') {
      noiSimple = inputs.year1NOI * Math.pow(1 + inputs.rentGrowth, y - 1);
    } else {
      const rentsY = inputs.grossRents * Math.pow(1 + inputs.rentGrowth, y - 1);
      const opexY = (inputs.grossRents * inputs.opexRatio) * Math.pow(1 + inputs.opexGrowth, y - 1);
      noiSimple = rentsY - opexY;
    }
    const interest = mortgage.yearlyData[y - 1].interest;
    const principal = mortgage.yearlyData[y - 1].principal;
    const debtService = interest + principal;
    const fedDepY = fedDep[y - 1];
    const stateDepY = stateDep[y - 1];
    cumFedDep += fedDepY;
    cumStateDep += stateDepY;

    // Federal rental net income/loss
    const rentalIncomeFed = noiSimple - interest - fedDepY;
    const rentalIncomeState = noiSimple - interest - stateDepY;

    // 469 disposition
    let fedRentalUsable;
    if (eligibility.status === 'likely-eligible') {
      fedRentalUsable = rentalIncomeFed; // active, deductible (subject to 461(l) below)
    } else {
      fedRentalUsable = Math.min(rentalIncomeFed, 0) >= 0 ? rentalIncomeFed : 0;
      // If passive, loss is suspended. We'll show 0 deduction current year.
    }

    // 461(l) analysis (only applies if there's a net business loss)
    let lossUsable461 = fedRentalUsable;
    let nolGenerated = 0;
    let nolUsed = 0;
    let eblAddback = 0;

    // Combine rental position with business position to get net business loss
    const netBusinessPosition = fedRentalUsable + inputs.businessIncome;
    if (netBusinessPosition < 0) {
      const netBusinessLoss = -netBusinessPosition;
      if (netBusinessLoss > ebl) {
        eblAddback = netBusinessLoss - ebl;
        nolGenerated = eblAddback;
        nolBalance += nolGenerated;
      }
    }
    lossUsable461 = fedRentalUsable + eblAddback;

    // ----- Compute BASELINE tax (without rental loss) -----
    // Use proper bracket-walking: AGI - standard deduction = taxable income → walk brackets
    const stdDed = getStandardDeduction(inputs.filingStatus, inputs.taxYear);
    const baselineAGI = inputs.w2Wages + inputs.businessIncome + inputs.otherNonBusiness;
    const baselineTaxableOrd = Math.max(0, baselineAGI - stdDed);
    const baselineOrdinaryTax = computeFederalOrdinaryTax(baselineTaxableOrd, inputs.filingStatus, inputs.taxYear);
    const baselineLTCGTax = computeLTCGTax(inputs.ltCapGains, baselineTaxableOrd, inputs.filingStatus);
    const baselineNIIT = computeNIIT(inputs.otherNonBusiness + inputs.ltCapGains, baselineAGI + inputs.ltCapGains, inputs.filingStatus);
    const baselineFedTax = baselineOrdinaryTax + baselineLTCGTax + baselineNIIT;

    // ----- Compute AFTER-RENTAL-LOSS tax (with rental loss applied) -----
    const agiWithLoss = inputs.w2Wages + inputs.businessIncome + inputs.otherNonBusiness + lossUsable461;
    let agiAfterNOL = agiWithLoss;
    if (nolBalance > 0 && agiWithLoss > 0) {
      const maxNOLUse = agiWithLoss * 0.80;
      nolUsed = Math.min(nolBalance, maxNOLUse);
      nolBalance -= nolUsed;
      agiAfterNOL = agiWithLoss - nolUsed;
    }
    const afterTaxableOrd = Math.max(0, agiAfterNOL - stdDed);
    const afterOrdinaryTax = computeFederalOrdinaryTax(afterTaxableOrd, inputs.filingStatus, inputs.taxYear);
    const afterLTCGTax = computeLTCGTax(inputs.ltCapGains, afterTaxableOrd, inputs.filingStatus);
    const afterNIIT = computeNIIT(inputs.otherNonBusiness + inputs.ltCapGains, Math.max(0, agiAfterNOL) + inputs.ltCapGains, inputs.filingStatus);
    const afterFedTax = afterOrdinaryTax + afterLTCGTax + afterNIIT;
    // Signed tax impact: positive = savings, negative = additional tax owed
    const fedTaxImpact = baselineFedTax - afterFedTax;
    const fedTaxSavings = fedTaxImpact;  // can be negative in profitable rental years
    cumFedTaxSavings += fedTaxImpact;
    const netTaxableFed = agiAfterNOL;

    // State tax — uses state-level rental result (different depreciation)
    let stateTaxSavings = 0;
    if (stateHasTax) {
      // Baseline state tax: ordinary on (W-2 + biz + non-bus) + state-specific LTCG treatment on LT cap gains
      const stateOrdBaseline = (inputs.w2Wages + Math.max(inputs.businessIncome, 0) + inputs.otherNonBusiness) * stateRate;
      const stateLTCGBaseline = computeStateLTCGTax(inputs.ltCapGains, inputs.w2Wages + Math.max(inputs.businessIncome, 0) + inputs.otherNonBusiness, inputs.state, inputs.filingStatus);
      const stateBaseline = stateOrdBaseline + stateLTCGBaseline;
      // After applying rental loss/income at state level (state depreciation differs)
      const stateRentalUsable = (eligibility.status === 'likely-eligible') ? rentalIncomeState : Math.max(rentalIncomeState, 0);
      const stateOrdAfter = Math.max(0, inputs.w2Wages + inputs.businessIncome + inputs.otherNonBusiness + stateRentalUsable) * stateRate;
      const stateLTCGAfter = computeStateLTCGTax(inputs.ltCapGains, Math.max(0, inputs.w2Wages + inputs.businessIncome + inputs.otherNonBusiness + stateRentalUsable), inputs.state, inputs.filingStatus);
      const stateAfter = stateOrdAfter + stateLTCGAfter;
      stateTaxSavings = stateBaseline - stateAfter;  // signed
      cumStateTaxSavings += stateTaxSavings;
    } else if (STATES[inputs.state].ltcg_treatment === 'wa_special') {
      // Washington: no income tax, but 7% LTCG above threshold applies to existing LT gains
      const stateBaseline = computeStateLTCGTax(inputs.ltCapGains, 0, inputs.state, inputs.filingStatus);
      const stateAfter = stateBaseline; // rental loss doesn't change WA capital gains tax
      stateTaxSavings = stateBaseline - stateAfter;
      cumStateTaxSavings += stateTaxSavings;
    }

    // Cash flow
    // Operating: NOI - Debt Service (P&I) - tax (or + savings)
    const cashFlowPreTax = noiSimple - debtService;
    const cashFlowAfterTax = cashFlowPreTax + fedTaxSavings + stateTaxSavings;
    cumCashFlowAfterTax += cashFlowAfterTax;
    cumNOI += noiSimple;

    yearlyResults.push({
      year: y,
      propValue,
      noi: noiSimple,
      interest,
      principal,
      fedDep: fedDepY,
      stateDep: stateDepY,
      rentalIncomeFed,
      rentalIncomeState,
      lossUsable461,
      nolGenerated,
      nolUsed,
      nolBalance,
      fedTaxSavings,
      stateTaxSavings,
      cashFlowPreTax,
      cashFlowAfterTax,
      mortgageBalance: mortgage.yearlyData[y - 1].endBalance
    });
  }

  // =============================================================================
  // SALE-YEAR ANALYSIS
  // =============================================================================
  const saleYear = inputs.holdPeriod;
  const finalValue = inputs.purchasePrice * Math.pow(1 + inputs.appreciationRate, saleYear);
  const sellingCostsPct = (inputs.sellingCostsPct !== undefined && inputs.sellingCostsPct >= 0) ? inputs.sellingCostsPct : 0.07;
  const sellingCosts = finalValue * sellingCostsPct;
  const netSalePrice = finalValue - sellingCosts;
  const fedAdjBasis = totalBasis - cumFedDep;
  const stateAdjBasis = totalBasis - cumStateDep;
  const fedGain = netSalePrice - fedAdjBasis;
  const stateGain = netSalePrice - stateAdjBasis;

  // Recapture analysis (federal)
  // §1245 recapture: depreciation taken on personal property (cost-seg portion that was bonus + MACRS) — recaptured at ordinary rates up to gain
  // §1250 unrecaptured gain: depreciation on real property (building shell) — taxed at max 25%
  // (reclassAmt and effectiveReclassPct already computed in outer scope)
  // Cumulative depreciation on §1245 property (cost-seg portion): could be all of reclassAmt if past recovery period, else partial
  let dep1245 = 0;
  let dep1250 = 0;
  // Re-derive from federal depreciation schedule
  const bonusDed = reclassAmt * inputs.bonusRate;
  const reclassResid = reclassAmt - bonusDed;
  dep1245 = bonusDed;  // bonus portion is fully §1245
  for (let y = 1; y <= saleYear; y++) {
    if (y - 1 < MACRS_5YR.length) {
      dep1245 += reclassResid * MACRS_5YR[y - 1];
    }
  }
  dep1245 = Math.min(dep1245, reclassAmt);  // cap at total cost-seg basis
  dep1250 = cumFedDep - dep1245;

  // -----------------------------------------------------------------
  // Compute sale tax for BOTH modes:
  //   - 'standard': § 1245 recapture applied as default (conservative)
  //   - 'donovan' : Donovan Legal tax strategy applied (no § 1245 recapture)
  // -----------------------------------------------------------------
  function computeSaleAllocation(useStrategy) {
    let remaining = fedGain;
    let s1245Recap, s1250Unrec, ltcgPart, t1245, t1250;

    if (useStrategy) {
      // Donovan Legal tax strategy: § 1245 recapture eliminated
      s1245Recap = 0;
      t1245 = 0;
      s1250Unrec = Math.min(Math.max(0, remaining), dep1250);
      remaining -= s1250Unrec;
      t1250 = s1250Unrec * SECTION_1250_MAX_RATE;
    } else {
      // Standard: § 1245 recapture at ordinary rates — use marginal-cost approach
      // (tax with recapture stacked on top of other ordinary income, minus tax without recapture)
      s1245Recap = Math.min(remaining, dep1245);
      remaining -= s1245Recap;
      const _stdDed = getStandardDeduction(inputs.filingStatus, inputs.taxYear);
      const _baseOrd = Math.max(0, (inputs.w2Wages + Math.max(inputs.businessIncome, 0) + inputs.otherNonBusiness) - _stdDed);
      const _taxWithoutRecap = computeFederalOrdinaryTax(_baseOrd, inputs.filingStatus, inputs.taxYear);
      const _taxWithRecap = computeFederalOrdinaryTax(_baseOrd + s1245Recap, inputs.filingStatus, inputs.taxYear);
      t1245 = _taxWithRecap - _taxWithoutRecap;
      s1250Unrec = Math.min(Math.max(0, remaining), dep1250);
      remaining -= s1250Unrec;
      t1250 = s1250Unrec * SECTION_1250_MAX_RATE;
    }
    ltcgPart = Math.max(0, remaining);

    // LTCG bracket stacking: stack on top of (taxable ordinary income + existing LTCG)
    const _stdD = getStandardDeduction(inputs.filingStatus, inputs.taxYear);
    const lBaseline = Math.max(0, (inputs.w2Wages + Math.max(inputs.businessIncome, 0) + inputs.otherNonBusiness) - _stdD);
    const lBracket = LTCG_BRACKETS_2026[inputs.filingStatus];
    const lStart = lBaseline + inputs.ltCapGains;
    const lEnd = lStart + ltcgPart;
    let l0 = 0, l15 = 0, l20 = 0;
    if (lStart < lBracket.zero) l0 = Math.min(lEnd, lBracket.zero) - lStart;
    const fStart = Math.max(lStart, lBracket.zero);
    if (fStart < lBracket.fifteen && lEnd > lBracket.zero) l15 = Math.min(lEnd, lBracket.fifteen) - fStart;
    if (lEnd > lBracket.fifteen) l20 = lEnd - Math.max(lStart, lBracket.fifteen);
    l0 = Math.max(0, l0); l15 = Math.max(0, l15); l20 = Math.max(0, l20);
    const tLTCG = l15 * 0.15 + l20 * 0.20;

    // NIIT
    let tNIIT = 0;
    const niitThresh = NIIT_THRESHOLDS[inputs.filingStatus];
    const totalIncWithGain = lBaseline + inputs.ltCapGains + ltcgPart + s1250Unrec + s1245Recap;
    if (totalIncWithGain > niitThresh) {
      let invIncome;
      if (eligibility.status !== 'likely-eligible') {
        // Passive disposition — gain is investment income
        invIncome = inputs.otherNonBusiness + inputs.ltCapGains + ltcgPart + s1250Unrec;
      } else {
        // Material participation — only user's separate investment income contributes
        invIncome = inputs.otherNonBusiness + inputs.ltCapGains;
      }
      const niitBase = Math.min(invIncome, totalIncWithGain - niitThresh);
      tNIIT = Math.max(0, niitBase) * NIIT_RATE;
    }

    return {
      sec1245Recapture: s1245Recap,
      sec1250Unrec: s1250Unrec,
      ltcgGain: ltcgPart,
      tax1245: t1245,
      tax1250: t1250,
      taxLTCG: tLTCG,
      taxNIIT: tNIIT,
      totalTax: t1245 + t1250 + tLTCG + tNIIT
    };
  }

  const saleStandard = computeSaleAllocation(false);
  const saleDonovan = computeSaleAllocation(true);
  const strategySavings = saleStandard.totalTax - saleDonovan.totalTax;

  // Active mode for initial render is 'standard'
  let sec1245Recapture = saleStandard.sec1245Recapture;
  let sec1250Unrec = saleStandard.sec1250Unrec;
  let ltcgGain = saleStandard.ltcgGain;
  let tax1245 = saleStandard.tax1245;
  let tax1250 = saleStandard.tax1250;
  let taxLTCG = saleStandard.taxLTCG;
  let taxNIIT = saleStandard.taxNIIT;

  // State tax on sale
  let stateSaleTax = 0;
  if (stateHasTax) {
    // State tax on sale: state LTCG treatment applies to the gain portion
    // For depreciation recapture, state generally taxes at ordinary rates regardless of LTCG treatment
    // Simplification: tax full state gain at LTCG treatment (most states tax recapture as ordinary anyway,
    // and states with LTCG exclusions typically don't apply exclusion to recapture)
    const stateOrdRecap = Math.max(0, Math.min(stateGain, cumStateDep)) * stateRate; // recapture portion at ordinary
    const stateLTCGPortion = Math.max(0, stateGain - cumStateDep);
    const stateLTCGSaleTax = computeStateLTCGTax(stateLTCGPortion, inputs.w2Wages + Math.max(inputs.businessIncome, 0) + inputs.otherNonBusiness, inputs.state, inputs.filingStatus);
    stateSaleTax = stateOrdRecap + stateLTCGSaleTax;
  } else if (STATES[inputs.state].ltcg_treatment === 'wa_special') {
    // Washington: 7% LTCG tax applies to LTCG portion of sale gain above threshold
    // Note: real estate sales are generally exempt from WA capital gains tax under RCW 82.87
    // We exclude STR sale gains from WA tax based on the real estate exemption
    stateSaleTax = 0;
  }

  // Mortgage payoff
  const mortgagePayoff = mortgage.yearlyData[saleYear - 1].endBalance;

  // Compute totals + IRR for BOTH modes
  function computeModeFullResults(saleResult) {
    const totalFed = saleResult.totalTax;
    const eff = fedGain > 0 ? (totalFed / fedGain * 100) : 0;
    const netProceeds = netSalePrice - mortgagePayoff - totalFed - stateSaleTax;
    const initInv = inputs.downPayment + inputs.closingCosts;
    // IRR
    const cf = [-initInv];
    for (let y = 1; y < saleYear; y++) cf.push(yearlyResults[y - 1].cashFlowAfterTax);
    cf.push(yearlyResults[saleYear - 1].cashFlowAfterTax + netProceeds);
    // IRR via bisection. Guard against degenerate CF patterns:
    //   - All-negative or all-positive cash flows → IRR undefined
    //   - Initial investment of zero → IRR undefined
    let computedIRR = null;
    const allNeg = cf.every(x => x <= 0);
    const allPos = cf.every(x => x >= 0);
    const hasInitOutflow = cf[0] < 0;
    if (allNeg || allPos || !hasInitOutflow) {
      computedIRR = null;  // undefined; will display as "N/A" in summary
    } else {
      let lo = -0.99, hi = 10.0;  // expand upper bound for very profitable scenarios
      let prevV = null;
      for (let i = 0; i < 300; i++) {  // more iterations for precision
        const mid = (lo + hi) / 2;
        const v = cf.reduce((s, c, t) => s + c / Math.pow(1 + mid, t), 0);
        if (Math.abs(v) < 0.5) { computedIRR = mid; break; }
        if (v > 0) lo = mid; else hi = mid;
        if (prevV !== null && Math.abs(v - prevV) < 0.001) break;  // stuck — break out
        prevV = v;
      }
      if (computedIRR === null) computedIRR = (lo + hi) / 2;
      // Clamp absurd IRR values (sign of degenerate inputs)
      if (computedIRR > 5.0 || computedIRR < -0.95) computedIRR = null;
    }
    // Total profit = total cash inflows over hold - initial investment
    const totalProfit = cumCashFlowAfterTax + netProceeds - initInv;
    // ROI (cumulative cash-on-cash) = total profit / initial investment
    // Guard against division by zero (e.g., if user enters 100% leverage with no closing costs)
    const roi = initInv > 100 ? (totalProfit / initInv * 100) : 0;
    // Note: roi is meaningless when initInv ≈ $0; we suppress the metric in that case
    // Cumulative effective federal tax rate over the investment life:
    //   Net federal tax = sale-year tax - cumulative operating savings
    //   Total economic gain = cumulative NOI + capital appreciation
    const netFedTax = totalFed - cumFedTaxSavings;
    const capitalAppreciation = netSalePrice - totalBasis;
    const totalEconomicGain = cumNOI + capitalAppreciation;
    // Guard: meaningless if no economic gain (e.g., immediate sale, depreciated below basis)
    let cumEffRate;
    if (totalEconomicGain > 1000) {
      cumEffRate = (netFedTax / totalEconomicGain) * 100;
      // Clamp to a reasonable display range (-100% to 100%) to avoid extreme values from edge cases
      cumEffRate = Math.max(-100, Math.min(100, cumEffRate));
    } else {
      cumEffRate = 0;
    }
    return {
      sale: saleResult,
      totalSaleTaxFed: totalFed,
      effSaleRate: eff,
      cumEffRate: cumEffRate,
      netFedTax: netFedTax,
      netSaleProceeds: netProceeds,
      irr: computedIRR,
      totalProfit: totalProfit,
      roi: roi,
      totalReturn: totalProfit
    };
  }

  const standardResults = computeModeFullResults(saleStandard);
  const donovanResults = computeModeFullResults(saleDonovan);

  // Save to module-level state for toggle handler
  // Year 1 net cash benefit = Year 1 operating cash flow + Year 1 tax savings (already combined in cashFlowAfterTax)
  const year1NetCashBenefit = yearlyResults[0] ? yearlyResults[0].cashFlowAfterTax : 0;
  const year1FedTaxSavings = yearlyResults[0] ? yearlyResults[0].fedTaxSavings : 0;
  const year1OpCashFlow = yearlyResults[0] ? (yearlyResults[0].noi - yearlyResults[0].interest - yearlyResults[0].principal) : 0;
  // Effective tax rate displayed to user (computed, not entered) — based on baseline ordinary income before rental
  const _stdDForDisplay = getStandardDeduction(inputs.filingStatus, inputs.taxYear);
  const _baseAGI = inputs.w2Wages + inputs.businessIncome + inputs.otherNonBusiness;
  const _baseTaxable = Math.max(0, _baseAGI - _stdDForDisplay);
  const _baseTax = computeFederalOrdinaryTax(_baseTaxable, inputs.filingStatus, inputs.taxYear);
  const computedEffRate = _baseAGI > 0 ? (_baseTax / _baseAGI) : 0;
  const computedMarginalRate = getMarginalRate(_baseTaxable, inputs.filingStatus, inputs.taxYear);

  return {
    standard: standardResults,
    donovan: donovanResults,
    strategySavings: standardResults.totalSaleTaxFed - donovanResults.totalSaleTaxFed,
    common: {
      saleYear, finalValue, sellingCosts, netSalePrice,
      sellingCostsPct,
      fedAdjBasis, fedGain, dep1245, dep1250,
      mortgagePayoff,
      stateGain, stateSaleTax, stateAdjBasis, stateHasTax, stateConforms,
      stateName: STATES[inputs.state].name,
      cumFedTaxSavings, cumStateTaxSavings, nolBalance,
      cashFlowAfterTax: cumCashFlowAfterTax,
      cumNOI,
      year1NetCashBenefit,
      year1FedTaxSavings,
      year1OpCashFlow,
      computedEffRate,
      computedMarginalRate,
      initialInvestment: inputs.downPayment + inputs.closingCosts,
      // Financing health metrics
      year1NOI: inputs.year1NOI,
      effectiveCapRate: inputs.year1NOI / inputs.purchasePrice,
      mortgageRate: inputs.mortgageRate,
      noiMethod: inputs.noiMethod,
      eligibility,
      state: inputs.state,
      yearlyResults,
      stateHasTaxFlag: stateHasTax
    }
  };
}

function calculateSTR() {
  const inputs = gatherInputsFromDOM();
  if (!validateInputs(inputs)) return;
  const results = computeScenario(inputs);
  window.__strResults = results;
  window.__strMode = 'standard';

  renderEligibility(results.common.eligibility);
  renderStateStatus(inputs.state);
  renderProjectionTable(results.common.yearlyResults, results.common.stateHasTaxFlag);
  renderForMode('standard');

  document.getElementById('results').classList.add('show');
  document.getElementById('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =============================================================================
// HEAT MAP / SENSITIVITY ANALYZER
// =============================================================================
// Heat map axis definitions: each defines the variable in inputs object,
// label, formatter, and a function returning 5 values centered on user's input
const HEAT_MAP_AXES = {
  purchasePrice: {
    label: 'Purchase Price',
    fmt: function(v) { return '$' + Math.round(v / 1000) + 'K'; },
    inputKey: 'purchasePrice',
    range: function(base) { const b = base || 1000000; return [b * 0.75, b * 0.875, b * 1.0, b * 1.125, b * 1.25]; }
  },
  capRate: {
    label: 'Year 1 Cap Rate',
    fmt: function(v) { return (v * 100).toFixed(1) + '%'; },
    inputKey: 'capRate',
    range: function() { return [0.04, 0.05, 0.06, 0.07, 0.08]; }
  },
  mortgageRate: {
    label: 'Mortgage Rate',
    fmt: function(v) { return (v * 100).toFixed(2) + '%'; },
    inputKey: 'mortgageRate',
    range: function() { return [0.05, 0.06, 0.07, 0.08, 0.09]; }
  },
  holdPeriod: {
    label: 'Hold Period',
    fmt: function(v) { return v + ' yrs'; },
    inputKey: 'holdPeriod',
    range: function() { return [3, 5, 7, 10, 15]; }
  },
  reclassPct: {
    label: 'Cost Seg Reclass %',
    fmt: function(v) { return (v * 100).toFixed(0) + '%'; },
    inputKey: 'reclassPct',
    range: function() { return [0.10, 0.15, 0.20, 0.25, 0.30]; }
  }
};

const HEAT_MAP_METRICS = {
  irr: {
    label: 'After-Tax IRR (Standard)',
    fmt: function(v) { return v === null ? 'N/A' : (v * 100).toFixed(1) + '%'; },
    extract: function(r) { return r.irr; },
    higher_is_better: true
  },
  irrStrategy: {
    label: 'After-Tax IRR (With Strategy)',
    fmt: function(v) { return v === null ? 'N/A' : (v * 100).toFixed(1) + '%'; },
    extract: function(r) { return r.irrStrategy; },
    higher_is_better: true
  },
  year1Benefit: {
    label: 'Year 1 Net Cash Benefit',
    fmt: function(v) { return '$' + Math.round(v).toLocaleString(); },
    extract: function(r) { return r.year1Benefit; },
    higher_is_better: true
  },
  totalProfit: {
    label: 'Total Profit (Standard)',
    fmt: function(v) { return '$' + Math.round(v).toLocaleString(); },
    extract: function(r) { return r.totalProfit; },
    higher_is_better: true
  },
  totalProfitStrategy: {
    label: 'Total Profit (With Strategy)',
    fmt: function(v) { return '$' + Math.round(v).toLocaleString(); },
    extract: function(r) { return r.totalProfitStrategy; },
    higher_is_better: true
  },
  cumEffRate: {
    label: 'Cumulative Effective Tax Rate',
    fmt: function(v) { return v.toFixed(1) + '%'; },
    extract: function(r) { return r.cumEffRate; },
    higher_is_better: false
  }
};

// Color interpolation: red (worst) → yellow (mid) → green (best)
function colorForValue(value, min, max, higherIsBetter) {
  if (value === null || value === undefined || isNaN(value)) return '#f0f0e8';
  if (max === min) return 'rgba(241,196,15,0.45)';
  let t = (value - min) / (max - min);
  if (!higherIsBetter) t = 1 - t;
  t = Math.max(0, Math.min(1, t));
  let r, g, b;
  if (t < 0.5) {
    const u = t * 2;
    r = Math.round(231 + (241 - 231) * u);
    g = Math.round(76 + (196 - 76) * u);
    b = Math.round(60 + (15 - 60) * u);
  } else {
    const u = (t - 0.5) * 2;
    r = Math.round(241 + (39 - 241) * u);
    g = Math.round(196 + (174 - 196) * u);
    b = Math.round(15 + (96 - 15) * u);
  }
  return 'rgba(' + r + ',' + g + ',' + b + ',0.55)';
}

// Run the calculation engine with overrides applied to user's current DOM inputs.
// Returns minimal metrics for the heat map grid.
function computeHeatMapCell(overrides) {
  const baseInputs = gatherInputsFromDOM();
  if (!validateInputs(baseInputs, true)) return null;  // silent check — base scenario invalid
  const inputs = Object.assign({}, baseInputs, overrides);
  // Recompute derived fields if relevant inputs changed
  if (overrides.purchasePrice !== undefined || overrides.capRate !== undefined || overrides.grossRents !== undefined || overrides.opexRatio !== undefined) {
    if (inputs.noiMethod === 'caprate') {
      inputs.year1NOI = inputs.purchasePrice * inputs.capRate;
    } else {
      inputs.year1NOI = inputs.grossRents * (1 - inputs.opexRatio);
    }
  }
  if (overrides.downPaymentPct !== undefined || overrides.purchasePrice !== undefined) {
    inputs.downPayment = inputs.purchasePrice * inputs.downPaymentPct;
  }
  // Wrap in try/catch — degenerate inputs shouldn't crash the grid
  try {
    const r = computeScenario(inputs);
    return {
      irr: r.standard.irr,
      irrStrategy: r.donovan.irr,
      year1Benefit: r.common.year1NetCashBenefit,
      totalProfit: r.standard.totalProfit,
      totalProfitStrategy: r.donovan.totalProfit,
      cumEffRate: r.standard.cumEffRate
    };
  } catch (e) {
    return null;
  }
}

// Render the heat map: 5x5 grid based on currently selected axes and metric.
function renderHeatMap() {
  const xKey = document.getElementById('hm_x_axis').value;
  const yKey = document.getElementById('hm_y_axis').value;
  const metricKey = document.getElementById('hm_metric').value;

  if (xKey === yKey) {
    document.getElementById('heat_map_grid').innerHTML = '<div style="padding:1rem;background:#fff8e1;border-left:3px solid #d4a017;font-size:0.9rem;">X-axis and Y-axis must be different variables.</div>';
    return;
  }

  const xAxis = HEAT_MAP_AXES[xKey];
  const yAxis = HEAT_MAP_AXES[yKey];
  const metric = HEAT_MAP_METRICS[metricKey];

  const baseInputs = gatherInputsFromDOM();
  const xValues = xAxis.range(baseInputs[xAxis.inputKey]);
  const yValues = yAxis.range(baseInputs[yAxis.inputKey]);

  const grid = [];
  let minVal = Infinity, maxVal = -Infinity;
  for (let yi = 0; yi < yValues.length; yi++) {
    const row = [];
    for (let xi = 0; xi < xValues.length; xi++) {
      const overrides = {};
      overrides[xAxis.inputKey] = xValues[xi];
      overrides[yAxis.inputKey] = yValues[yi];
      const result = computeHeatMapCell(overrides);
      const value = result ? metric.extract(result) : null;
      if (value !== null && !isNaN(value) && isFinite(value)) {
        if (value < minVal) minVal = value;
        if (value > maxVal) maxVal = value;
      }
      row.push({ value: value, xVal: xValues[xi], yVal: yValues[yi] });
    }
    grid.push(row);
  }

  // Find user's scenario cell (closest match)
  let userXi = -1, userYi = -1;
  const userXVal = baseInputs[xAxis.inputKey];
  const userYVal = baseInputs[yAxis.inputKey];
  let bestXDiff = Infinity, bestYDiff = Infinity;
  for (let i = 0; i < xValues.length; i++) {
    const d = Math.abs(xValues[i] - userXVal);
    if (d < bestXDiff) { bestXDiff = d; userXi = i; }
  }
  for (let i = 0; i < yValues.length; i++) {
    const d = Math.abs(yValues[i] - userYVal);
    if (d < bestYDiff) { bestYDiff = d; userYi = i; }
  }

  let html = '<div style="overflow-x:auto;">';
  html += '<table style="border-collapse:collapse;margin:0 auto;font-family:\'Open Sans\',sans-serif;font-size:0.85rem;">';
  html += '<tr><td colspan="' + (xValues.length + 1) + '" style="text-align:center;padding:0.5rem 0;color:#6b6b6b;font-size:0.78rem;letter-spacing:1px;text-transform:uppercase;">' + xAxis.label + ' \u2192</td></tr>';
  html += '<tr><td style="background:#1a1a1a;color:#fff;padding:0.5rem 0.65rem;text-align:right;font-size:0.72rem;letter-spacing:0.5px;text-transform:uppercase;">' + yAxis.label + ' \u2193</td>';
  for (let xi = 0; xi < xValues.length; xi++) {
    html += '<td style="background:#1a1a1a;color:#fff;padding:0.5rem 0.65rem;text-align:center;font-weight:600;font-size:0.78rem;">' + xAxis.fmt(xValues[xi]) + '</td>';
  }
  html += '</tr>';
  for (let yi = 0; yi < yValues.length; yi++) {
    html += '<tr>';
    html += '<td style="background:#1a1a1a;color:#fff;padding:0.5rem 0.65rem;text-align:right;font-weight:600;font-size:0.78rem;">' + yAxis.fmt(yValues[yi]) + '</td>';
    for (let xi = 0; xi < xValues.length; xi++) {
      const cell = grid[yi][xi];
      const bg = colorForValue(cell.value, minVal, maxVal, metric.higher_is_better);
      const isUser = (xi === userXi && yi === userYi);
      const borderStyle = isUser ? '3px solid #1a1a1a' : '1px solid #d4d4d0';
      const valueText = cell.value === null ? 'N/A' : metric.fmt(cell.value);
      html += '<td style="background:' + bg + ';padding:0.7rem 0.5rem;text-align:center;border:' + borderStyle + ';min-width:80px;font-weight:600;color:#1a1a1a;position:relative;">';
      if (isUser) {
        html += '<div style="position:absolute;top:-1px;left:-1px;background:#1a1a1a;color:#fff;font-size:0.6rem;padding:1px 4px;font-weight:600;letter-spacing:0.5px;">YOU</div>';
      }
      html += valueText;
      html += '</td>';
    }
    html += '</tr>';
  }
  html += '</table></div>';

  if (userXi >= 0 && userYi >= 0) {
    const userCell = grid[userYi][userXi];
    if (userCell.value !== null) {
      html += '<div style="margin-top:0.85rem;padding:0.75rem 1rem;background:#FFFFFF;border-left:3px solid #169B62;font-size:0.85rem;line-height:1.5;">';
      html += '<strong>Your scenario:</strong> ' + xAxis.label + ' = ' + xAxis.fmt(xValues[userXi]) + ', ' + yAxis.label + ' = ' + yAxis.fmt(yValues[userYi]) + ' \u2192 ' + metric.label + ' = <strong>' + metric.fmt(userCell.value) + '</strong>';
      html += '</div>';
    }
  }

  document.getElementById('heat_map_grid').innerHTML = html;
}


// =============================================================================
// RENDER FUNCTIONS
// =============================================================================
function renderEligibility(elig) {
  // If no Step 1/Step 2 detail, fall back to simple display
  if (!elig.step1 || !elig.step2) {
    const html = `
      <div class="eligibility-result ${elig.status}">
        <span class="eligibility-badge">§ 469 Passive Activity Analysis</span>
        <div style="font-family: 'Gotham Bold', sans-serif; font-size: 1.05rem; color: #1a1a1a; margin-bottom: 0.5rem;">${elig.label}</div>
        <div style="font-size: 0.92rem; line-height: 1.6; color: #1a1a1a;">${elig.explanation}</div>
      </div>
    `;
    document.getElementById('eligibility_panel').innerHTML = html;
    return;
  }

  const s1 = elig.step1;
  const s2 = elig.step2;

  // Build Step 1 exceptions display
  let exceptionsHtml = '';
  s1.exceptions.forEach(e => {
    const icon = e.satisfied ? '✓' : (e.needsDevelopment ? '⚠' : '✗');
    const cls = e.satisfied ? 'mp-pass' : (e.needsDevelopment ? 'mp-needs' : 'mp-fail');
    exceptionsHtml += `
      <div class="mp-row ${cls}">
        <div class="mp-icon">${icon}</div>
        <div class="mp-content">
          <div class="mp-label">Exception (${e.letter}) &mdash; ${e.label}</div>
          <div class="mp-cite">${e.cite}</div>
          <div class="mp-note">${e.note}</div>
        </div>
      </div>
    `;
  });

  // REPS row in Step 1
  const repsIcon = s1.reps.satisfied ? '✓' : '✗';
  const repsCls = s1.reps.satisfied ? 'mp-pass' : 'mp-fail';
  exceptionsHtml += `
    <div class="mp-row ${repsCls}">
      <div class="mp-icon">${repsIcon}</div>
      <div class="mp-content">
        <div class="mp-label">REPS Path</div>
        <div class="mp-cite">${s1.reps.cite}</div>
        <div class="mp-note">${s1.reps.label}. ${s1.reps.note}</div>
      </div>
    </div>
  `;

  // Build Step 2 tests display
  let testsHtml = '';
  s2.tests.forEach(t => {
    let icon, cls;
    if (t.inapplicable) { icon = '—'; cls = 'mp-na'; }
    else if (t.satisfied) { icon = '✓'; cls = 'mp-pass'; }
    else if (t.needsData) { icon = '?'; cls = 'mp-needs'; }
    else { icon = '✗'; cls = 'mp-fail'; }
    testsHtml += `
      <div class="mp-row ${cls}">
        <div class="mp-icon">${icon}</div>
        <div class="mp-content">
          <div class="mp-label">Test ${t.num} &mdash; ${t.label}</div>
          <div class="mp-cite">${t.cite}</div>
          <div class="mp-note">${t.note}</div>
        </div>
      </div>
    `;
  });

  const step1OutcomeClass = s1.outcome.escapesPerSePassive ? 'mp-pass' : 'mp-fail';
  const step2OutcomeClass = s2.outcome.materialParticipation ? 'mp-pass' : 'mp-fail';

  const html = `
    <div class="eligibility-result ${elig.status}">
      <span class="eligibility-badge">§ 469 Passive/Non-Passive Analysis</span>
      <div style="font-family: 'Gotham Bold', sans-serif; font-size: 1.15rem; color: #1a1a1a; margin-bottom: 0.4rem;">${elig.label}</div>
      <div style="font-size: 0.92rem; line-height: 1.6; color: #1a1a1a; margin-bottom: 1.25rem;">${elig.explanation}</div>

      <div class="mp-step-block">
        <div class="mp-step-header">
          <div class="mp-step-num">Step 1</div>
          <div class="mp-step-title">Per Se Passive Analysis &mdash; Reg. &sect;&nbsp;1.469-1T(e)(3)(ii) &amp; &sect;&nbsp;469(c)(7)</div>
        </div>
        <div class="mp-step-outcome ${step1OutcomeClass}">${s1.outcome.label} &mdash; <em>${s1.outcome.summary}</em></div>
        <div class="mp-rows">
          ${exceptionsHtml}
        </div>
      </div>

      <div class="mp-step-block">
        <div class="mp-step-header">
          <div class="mp-step-num">Step 2</div>
          <div class="mp-step-title">Material Participation &mdash; Reg. &sect;&nbsp;1.469-5T (Seven Tests)</div>
        </div>
        <div class="mp-step-outcome ${step2OutcomeClass}">${s2.outcome.label} &mdash; <em>${s2.outcome.summary}</em></div>
        <div class="mp-rows">
          ${testsHtml}
        </div>
      </div>
    </div>
  `;
  document.getElementById('eligibility_panel').innerHTML = html;
}

function renderStateStatus(stateCode) {
  const s = STATES[stateCode];
  let cls = 'no-tax';
  let title = '';

  // Build LTCG treatment label
  let ltcgLabel = '';
  if (s.ltcg_treatment === 'ordinary') {
    ltcgLabel = 'LTCG taxed as ordinary income';
  } else if (s.ltcg_treatment === 'no_tax') {
    ltcgLabel = 'No state income tax';
  } else if (s.ltcg_treatment === 'wa_special') {
    ltcgLabel = '7% LTCG tax above threshold (real estate generally exempt)';
  } else if (typeof s.ltcg_treatment === 'object') {
    if ('rate' in s.ltcg_treatment) {
      ltcgLabel = `Preferential LTCG rate of ${(s.ltcg_treatment.rate * 100).toFixed(2)}%`;
    } else if ('exclusion' in s.ltcg_treatment) {
      ltcgLabel = `${(s.ltcg_treatment.exclusion * 100).toFixed(0)}% exclusion of LTCG (effective rate ~${((1 - s.ltcg_treatment.exclusion) * s.rate * 100).toFixed(2)}%)`;
    }
  }

  if (s.has_tax) {
    cls = s.conforms_bonus ? 'conforms' : 'decoupled';
    const bonusLine = s.conforms_bonus ?
      `<strong>${s.name}</strong> conforms to federal bonus depreciation. Federal and state depreciation are aligned.` :
      `<strong>${s.name}</strong> decouples from federal bonus depreciation. State requires addback of bonus, with depreciation allowed under regular MACRS instead.`;
    title = bonusLine;
  } else {
    title = `<strong>${s.name}</strong> has no individual income tax.`;
  }

  // Conformity table
  const conformityRows = s.has_tax ? `
    <table style="width: 100%; margin-top: 0.75rem; font-size: 0.82rem; border-collapse: collapse;">
      <tr>
        <td style="padding: 0.25rem 0.5rem 0.25rem 0; color: #6b6b6b;">Top Marginal Rate</td>
        <td style="padding: 0.25rem 0; font-weight: 600;">${(s.rate * 100).toFixed(2)}%</td>
      </tr>
      <tr>
        <td style="padding: 0.25rem 0.5rem 0.25rem 0; color: #6b6b6b;">LTCG Treatment</td>
        <td style="padding: 0.25rem 0; font-weight: 600;">${ltcgLabel}</td>
      </tr>
      <tr>
        <td style="padding: 0.25rem 0.5rem 0.25rem 0; color: #6b6b6b;">§ 168(k) Bonus Depreciation</td>
        <td style="padding: 0.25rem 0; font-weight: 600; color: ${s.conforms_bonus ? '#169B62' : '#d35400'};">${s.conforms_bonus ? 'Conforms' : 'Decoupled'}</td>
      </tr>
      <tr>
        <td style="padding: 0.25rem 0.5rem 0.25rem 0; color: #6b6b6b;">§ 461(l) Excess Business Loss</td>
        <td style="padding: 0.25rem 0; font-weight: 600; color: ${s.conforms_461l ? '#169B62' : '#d35400'};">${s.conforms_461l ? 'Conforms' : 'Decoupled'}</td>
      </tr>
      <tr>
        <td style="padding: 0.25rem 0.5rem 0.25rem 0; color: #6b6b6b;">§ 172 NOL 80% Rule</td>
        <td style="padding: 0.25rem 0; font-weight: 600; color: ${s.conforms_172_80 ? '#169B62' : '#d35400'};">${s.conforms_172_80 ? 'Conforms' : 'Decoupled'}</td>
      </tr>
    </table>
  ` : '';

  const html = `
    <div class="state-status ${cls}">
      ${title}
      <div style="font-size: 0.85rem; color: #6b6b6b; margin-top: 0.5rem;">${s.note}</div>
      ${conformityRows}
    </div>
  `;
  document.getElementById('state_status_panel').innerHTML = html;
}

function renderSummary(data) {
  // Color the cumulative effective rate green if negative (net tax-positive investment)
  const cumRateColor = data.cumEffRate < 0 ? '#169B62' : '#1a1a1a';
  const cumRateLabel = data.cumEffRate < 0 ? 'Net tax-positive investment' : 'Federal tax over total economic gain';

  // Show user the computed effective and marginal rates produced by their inputs
  const ratesNote = `<div style="background: #FFFFFF; border-left: 3px solid #169B62; padding: 0.85rem 1.25rem; margin-bottom: 1.25rem; font-size: 0.9rem; line-height: 1.55;">
    <strong style="color: #169B62;">Federal tax rates from your inputs (baseline, before rental loss):</strong>
    Effective rate <strong>${(data.computedEffRate * 100).toFixed(2)}%</strong> &middot;
    Marginal rate <strong>${(data.computedMarginalRate * 100).toFixed(2)}%</strong>.
    Computed using actual 2026 IRS brackets (Rev. Proc. 2025-32) and standard deduction; itemized deductions and credits not modeled.
  </div>`;

  const html = ratesNote + `
    <div class="summary-card">
      <div class="label">After-Tax IRR</div>
      <div class="value">${data.irr === null ? 'N/A' : (data.irr * 100).toFixed(2) + '%'}</div>
      <div class="sublabel">${data.irr === null ? 'Cannot compute (degenerate cash flows)' : 'Over ' + (numYears(val('hold_period')) || 0) + '-year hold'}</div>
    </div>
    <div class="summary-card">
      <div class="label">Cumulative Effective Tax Rate</div>
      <div class="value" style="color: ${cumRateColor};">${data.cumEffRate.toFixed(2)}%</div>
      <div class="sublabel">${cumRateLabel}</div>
    </div>
    <div class="summary-card">
      <div class="label">Year 1 Net Cash Benefit</div>
      <div class="value">${fmt(data.year1NetCashBenefit)}</div>
      <div class="sublabel">Operating cash flow + tax savings, Year 1</div>
    </div>
    <div class="summary-card">
      <div class="label">Cumulative Federal Tax Savings (Operating)</div>
      <div class="value">${fmt(data.cumFedTaxSavings)}</div>
      <div class="sublabel">From depreciation and rental losses, all hold years</div>
    </div>
    <div class="summary-card">
      <div class="label">Net Sale Proceeds</div>
      <div class="value">${fmt(data.netSaleProceeds)}</div>
      <div class="sublabel">After mortgage payoff, sale costs, and tax</div>
    </div>
    <div class="summary-card">
      <div class="label">Total After-Tax Profit</div>
      <div class="value">${fmt(data.totalReturn)}</div>
      <div class="sublabel">Cumulative cash flow + sale proceeds &minus; initial investment</div>
    </div>
  `;
  document.getElementById('summary_grid').innerHTML = html;
}

function renderProjectionTable(years, hasState) {
  const headers = ['<th>Item</th>'].concat(years.map(y => `<th>Yr ${y.year}</th>`)).join('');
  const headerRow = `<thead><tr>${headers}</tr></thead><tbody>`;

  function row(label, fn) {
    const cells = years.map(y => `<td>${fn(y)}</td>`).join('');
    return `<tr><td>${label}</td>${cells}</tr>`;
  }

  function sectionHeader(label) {
    return `<tr class="section-header"><td colspan="${years.length + 1}">${label}</td></tr>`;
  }

  let body = '';
  body += sectionHeader('Property Operations');
  body += row('NOI (3% growth)', y => fmt(y.noi));
  body += row('Mortgage Interest', y => fmt(y.interest));
  body += row('Federal Depreciation', y => fmt(y.fedDep));
  body += row('Rental Net Income (Federal)', y => fmt(y.rentalIncomeFed));

  body += sectionHeader('§ 461(l) and NOL');
  body += row('Loss Usable (Post-461(l))', y => fmt(y.lossUsable461));
  body += row('NOL Generated This Year', y => fmt(y.nolGenerated));
  body += row('NOL Used (80% rule)', y => fmt(y.nolUsed));
  body += row('NOL Balance End of Year', y => fmt(y.nolBalance));

  body += sectionHeader('Tax & Cash Flow');
  body += row('Federal Tax Savings', y => fmt(y.fedTaxSavings));
  if (hasState) body += row('State Tax Savings', y => fmt(y.stateTaxSavings));
  body += row('Cash Flow After Tax', y => fmt(y.cashFlowAfterTax));
  body += row('Mortgage Balance EOY', y => fmt(y.mortgageBalance));

  body += '</tbody>';
  document.getElementById('projection_table').innerHTML = headerRow + body;
}

function renderSaleAnalysis(s) {
  const isStrategyMode = window.__strMode === 'donovan';
  const strategySavings = window.__strResults ? window.__strResults.strategySavings : 0;

  const html = `
    <div style="background: #FFFFFF; padding: 1.25rem 1.5rem; border-left: 3px solid #169B62;">
      <div style="margin-bottom: 0.75rem;"><strong>Sale at end of Year ${s.saleYear}</strong></div>
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 1.5rem; font-size: 0.9rem; line-height: 1.6;">
        <div>Sale price (3% appreciation):</div><div style="text-align: right;">${fmt(s.finalValue)}</div>
        <div>Less selling costs (${((s.sellingCostsPct !== undefined ? s.sellingCostsPct : 0.07) * 100).toFixed(1)}%):</div><div style="text-align: right;">(${fmt(s.sellingCosts)})</div>
        <div><strong>Net sale price:</strong></div><div style="text-align: right;"><strong>${fmt(s.netSalePrice)}</strong></div>
        <div>Federal adjusted basis:</div><div style="text-align: right;">${fmt(s.fedAdjBasis)}</div>
        <div><strong>Federal gain:</strong></div><div style="text-align: right;"><strong>${fmt(s.fedGain)}</strong></div>
      </div>

      <div class="strategy-toggle-wrapper">
        <div class="strategy-toggle-label">Calculation Method</div>
        <div class="strategy-toggle">
          <button type="button" class="strategy-toggle-btn ${!isStrategyMode ? 'active' : ''}" data-mode="standard" onclick="setStrategyMode('standard')">Standard Calculation</button>
          <button type="button" class="strategy-toggle-btn ${isStrategyMode ? 'active' : ''}" data-mode="donovan" onclick="setStrategyMode('donovan')">With Donovan Legal Tax Strategy</button>
        </div>
      </div>

      <div style="margin-top: 1rem;">
        <div style="font-family: 'Gotham Bold', sans-serif; font-size: 0.85rem; color: #169B62; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 0.5rem;">Federal Recapture &amp; Capital Gain Allocation</div>
        ${!isStrategyMode ? `
        <div style="background: #fff8e1; border-left: 4px solid #d4a017; padding: 0.85rem 1.15rem; margin: 0.75rem 0 1rem 0; font-size: 0.88rem; line-height: 1.55;">
          <strong style="color: #d35400;">\u26a1 Disposition Planning Note.</strong> This standard calculation conservatively assumes the entire cost-segregated basis triggers \u00a7\u00a01245 ordinary recapture at sale. <strong>Toggle &ldquo;With Donovan Legal Tax Strategy&rdquo; above to see the result with proper disposition planning applied.</strong>
        </div>` : ''}
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 1.5rem; font-size: 0.88rem; line-height: 1.6;">
          <div>\u00a7\u00a01245 ordinary recapture (cost-seg portion):</div><div style="text-align: right;">${fmt(s.sec1245Recapture)}</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;Tax at marginal rate:</div><div style="text-align: right;">${fmt(s.tax1245)}</div>
          <div>\u00a7\u00a01250 unrecaptured gain (real property dep):</div><div style="text-align: right;">${fmt(s.sec1250Unrec)}</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;Tax at 25% max rate:</div><div style="text-align: right;">${fmt(s.tax1250)}</div>
          <div>Long-term capital gain (residual):</div><div style="text-align: right;">${fmt(s.ltcgGain)}</div>
          <div>&nbsp;&nbsp;&nbsp;&nbsp;Tax (0%/15%/20% bracketed):</div><div style="text-align: right;">${fmt(s.taxLTCG)}</div>
          <div>NIIT (if applicable):</div><div style="text-align: right;">${fmt(s.taxNIIT)}</div>
          <div><strong>Total federal tax on sale:</strong></div><div style="text-align: right;"><strong>${fmt(s.totalSaleTaxFed)}</strong></div>
          <div><strong>Effective federal tax rate on gain:</strong></div><div style="text-align: right;"><strong>${s.effSaleRate.toFixed(2)}%</strong></div>
        </div>
      </div>

      ${isStrategyMode && strategySavings > 0 && window.__strResults ? (() => {
        const std = window.__strResults.standard;
        const dvn = window.__strResults.donovan;
        const taxDelta = std.totalSaleTaxFed - dvn.totalSaleTaxFed;
        const proceedsDelta = dvn.netSaleProceeds - std.netSaleProceeds;
        const irrDelta = (dvn.irr - std.irr) * 100;
        const roiDelta = dvn.roi - std.roi;
        const profitDelta = dvn.totalProfit - std.totalProfit;
        return `
        <div class="strategy-savings-callout show">
          <div class="savings-header">\u2728 Benefits of Donovan Legal Tax Strategy</div>
          <div class="savings-headline-label">Total Federal Tax Savings on Sale</div>
          <div class="savings-headline">${fmt(taxDelta)}</div>
          <table class="savings-comparison-table">
            <thead>
              <tr>
                <th>Metric</th>
                <th>Standard</th>
                <th>With Strategy</th>
                <th>Improvement</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Federal tax on sale</td>
                <td>${fmt(std.totalSaleTaxFed)}</td>
                <td>${fmt(dvn.totalSaleTaxFed)}</td>
                <td class="delta-improvement">\u2212${fmt(taxDelta).replace('-', '')}</td>
              </tr>
              <tr>
                <td>Cumulative effective tax rate</td>
                <td>${std.cumEffRate.toFixed(2)}%</td>
                <td>${dvn.cumEffRate.toFixed(2)}%</td>
                <td class="delta-improvement">\u2212${(std.cumEffRate - dvn.cumEffRate).toFixed(2)}%</td>
              </tr>
              <tr>
                <td>Net sale proceeds</td>
                <td>${fmt(std.netSaleProceeds)}</td>
                <td>${fmt(dvn.netSaleProceeds)}</td>
                <td class="delta-improvement">+${fmt(proceedsDelta).replace('-', '')}</td>
              </tr>
              <tr>
                <td>After-tax IRR</td>
                <td>${std.irr === null ? 'N/A' : (std.irr * 100).toFixed(2) + '%'}</td>
                <td>${dvn.irr === null ? 'N/A' : (dvn.irr * 100).toFixed(2) + '%'}</td>
                <td class="delta-improvement">${(std.irr === null || dvn.irr === null) ? 'N/A' : '+' + irrDelta.toFixed(2) + '%'}</td>
              </tr>
              <tr>
                <td>Cash-on-cash ROI</td>
                <td>${std.roi === 0 ? 'N/A' : std.roi.toFixed(2) + '%'}</td>
                <td>${dvn.roi === 0 ? 'N/A' : dvn.roi.toFixed(2) + '%'}</td>
                <td class="delta-improvement">${(std.roi === 0 || dvn.roi === 0) ? 'N/A' : '+' + roiDelta.toFixed(2) + '%'}</td>
              </tr>
              <tr>
                <td>Total after-tax profit</td>
                <td>${fmt(std.totalProfit)}</td>
                <td>${fmt(dvn.totalProfit)}</td>
                <td class="delta-improvement">+${fmt(profitDelta).replace('-', '')}</td>
              </tr>
            </tbody>
          </table>
          <div class="savings-explainer">
            These improvements reflect proper disposition planning applied to the sale. The methodology is one of several tax-efficient disposition strategies the firm advises clients on, and specific facts and circumstances determine the actual outcome. <strong>Engagement with qualified counsel before sale is essential to executing the strategy correctly.</strong>
            <br><br>
            <a href="contact.html" class="savings-cta">Contact the Firm to Discuss</a>
          </div>
        </div>`;
      })() : ''}

      ${s.stateHasTax ? `
      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #d4d4d0;">
        <div style="font-family: 'Gotham Bold', sans-serif; font-size: 0.85rem; color: #169B62; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 0.5rem;">${s.stateName} State Tax on Sale</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem 1.5rem; font-size: 0.88rem; line-height: 1.6;">
          <div>State adjusted basis:</div><div style="text-align: right;">${fmt(s.stateAdjBasis)}</div>
          <div>State gain (may differ from federal if decoupled):</div><div style="text-align: right;">${fmt(s.stateGain)}</div>
          <div>Estimated state tax on gain:</div><div style="text-align: right;">${fmt(s.stateSaleTax)}</div>
        </div>
      </div>` : ''}
      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed #d4d4d0; font-size: 0.88rem; line-height: 1.6;">
        <div>Mortgage payoff at sale:</div>
        <div style="text-align: right; font-weight: 600;">${fmt(s.mortgagePayoff)}</div>
      </div>
      <div style="margin-top: 1rem; padding-top: 1rem; border-top: 2px solid #169B62; font-size: 1.05rem; line-height: 1.6;">
        <div style="display: flex; justify-content: space-between;"><strong>Net sale proceeds (after-tax, after payoff):</strong><strong style="color: #169B62;">${fmt(s.netSaleProceeds)}</strong></div>
      </div>
    </div>
  `;
  document.getElementById('sale_analysis').innerHTML = html;
}

// =============================================================================
// ECONOMIC PROFILE VERDICT — Scorecard analysis of the user's specific scenario
// =============================================================================

function computeVerdict(mode) {
  const r = window.__strResults[mode];
  const c = window.__strResults.common;
  const yrs = c.yearlyResults;

  // ----- Eligibility gate first -----
  if (c.eligibility.status === 'likely-ineligible') {
    return {
      level: 'unavailable',
      label: 'Strategy Does Not Appear Available',
      message: 'Based on the inputs, the short-term rental tax strategy does not appear available for this scenario. The §\u00a0469 eligibility analysis above identifies the specific issue. Without § 469 eligibility, the rental loss cannot offset W-2 wages, and the analysis below is informational only.',
      scorecard: null
    };
  }

  // Compute cumulative operating cash flow BEFORE tax shield
  // This is the key sanity check: is the property economically viable on its own?
  let cumOpCFPreTax = 0;
  yrs.forEach(y => {
    const opCF = y.noi - y.interest - y.principal;
    cumOpCFPreTax += opCF;
  });
  const year1OpCF = yrs[0] ? (yrs[0].noi - yrs[0].interest - yrs[0].principal) : 0;

  // Compute the IRR if the user DIDN'T have the rental tax benefit
  // (rough proxy: cum operating CF + sale proceeds, no tax shield component)
  // We'll approximate this by checking whether cum op CF is even positive.

  // ----- Score each dimension -----
  const scorecard = [];

  // 1. After-tax IRR vs benchmark
  if (r.irr === null) {
    scorecard.push({ label: 'After-tax IRR', value: 'N/A', verdict: 'neutral', note: 'Cannot compute' });
  } else {
    const irrPct = r.irr * 100;
    let v, n;
    if (irrPct >= 12) { v = 'favorable'; n = 'Above 12% benchmark'; }
    else if (irrPct >= 8) { v = 'solid'; n = 'Solid but below 12%'; }
    else if (irrPct >= 4) { v = 'marginal'; n = 'Below typical return threshold'; }
    else if (irrPct >= 0) { v = 'unfavorable'; n = 'Near-zero return on capital'; }
    else { v = 'unfavorable'; n = 'NEGATIVE return — capital destruction'; }
    scorecard.push({ label: 'After-tax IRR', value: irrPct.toFixed(2) + '%', verdict: v, note: n });
  }

  // 2. Operating Cash Flow (BEFORE tax shield) — critical sanity check
  // This catches the "1% cap rate" failure mode where ops bleed cash but tax shield masks it
  let opCfVerdict, opCfNote;
  if (cumOpCFPreTax >= 0 && year1OpCF >= 0) {
    opCfVerdict = 'favorable';
    opCfNote = 'Property self-supports without tax shield';
  } else if (cumOpCFPreTax >= 0) {
    opCfVerdict = 'solid';
    opCfNote = 'Cumulative ops positive; Year 1 negative';
  } else if (year1OpCF >= 0 && cumOpCFPreTax > -(c.initialInvestment * 0.5)) {
    opCfVerdict = 'marginal';
    opCfNote = 'Operations net-negative over hold period';
  } else {
    opCfVerdict = 'unfavorable';
    opCfNote = 'Operations hemorrhaging cash; tax shield masks losses';
  }
  scorecard.push({ label: 'Operating Cash Flow (Pre-Tax-Shield)', value: '$' + Math.round(cumOpCFPreTax).toLocaleString() + ' cum.', verdict: opCfVerdict, note: opCfNote });

  // 3. Year 1 Cash Benefit as % of initial investment
  const initInv = c.initialInvestment;
  if (initInv > 100) {
    const y1Pct = (c.year1NetCashBenefit / initInv) * 100;
    let v, n;
    if (y1Pct >= 25) { v = 'favorable'; n = 'Strong Year 1 ROI'; }
    else if (y1Pct >= 15) { v = 'solid'; n = 'Solid Year 1 return'; }
    else if (y1Pct >= 5) { v = 'marginal'; n = 'Modest Year 1 return'; }
    else if (y1Pct >= 0) { v = 'unfavorable'; n = 'Near-zero Year 1 return'; }
    else { v = 'unfavorable'; n = 'NEGATIVE Year 1 cash position'; }
    scorecard.push({ label: 'Year 1 Cash Benefit (% of capital invested)', value: y1Pct.toFixed(1) + '%', verdict: v, note: n });
  }

  // 4. § 469 Eligibility
  if (c.eligibility.status === 'likely-eligible') {
    scorecard.push({ label: '§ 469 Eligibility', value: 'Likely Eligible', verdict: 'favorable', note: 'Material participation appears established' });
  } else if (c.eligibility.status === 'marginal') {
    scorecard.push({ label: '§ 469 Eligibility', value: 'Marginal', verdict: 'marginal', note: 'Requires factual development' });
  }

  // 5. Cumulative Effective Tax Rate
  let v, n;
  if (r.cumEffRate < 0) { v = 'favorable'; n = 'Net tax-positive over investment life'; }
  else if (r.cumEffRate < 10) { v = 'favorable'; n = 'Low effective tax burden'; }
  else if (r.cumEffRate < 20) { v = 'solid'; n = 'Moderate effective tax burden'; }
  else if (r.cumEffRate < 30) { v = 'marginal'; n = 'Significant tax burden'; }
  else { v = 'unfavorable'; n = 'High effective tax burden'; }
  scorecard.push({ label: 'Cumulative Effective Tax Rate', value: r.cumEffRate.toFixed(2) + '%', verdict: v, note: n });

  // 6. Total After-Tax Profit
  // The ultimate test: did the investment make money or lose it?
  const profit = r.totalProfit;
  let pv, pn;
  if (profit < 0) { pv = 'unfavorable'; pn = 'INVESTMENT LOSES MONEY over hold period'; }
  else if (profit < initInv * 0.25) { pv = 'marginal'; pn = 'Profit below 25% of capital invested'; }
  else if (profit < initInv * 0.5) { pv = 'solid'; pn = 'Profit 25-50% of capital invested'; }
  else { pv = 'favorable'; pn = 'Profit exceeds 50% of capital invested'; }
  scorecard.push({ label: 'Total After-Tax Profit', value: '$' + Math.round(profit).toLocaleString(), verdict: pv, note: pn });

  // 7. NOI Growth Trajectory
  if (yrs.length >= 3) {
    const y1NOI = yrs[0].noi;
    const yFinalNOI = yrs[yrs.length - 1].noi;
    const noiCAGR = yrs.length > 1 ? Math.pow(Math.abs(yFinalNOI / y1NOI), 1 / (yrs.length - 1)) - 1 : 0;
    let nv, nn;
    if (y1NOI <= 0) { nv = 'unfavorable'; nn = 'NOI starts negative or zero'; }
    else if (yFinalNOI < y1NOI) { nv = 'unfavorable'; nn = 'NOI declining over hold (margin compression)'; }
    else if (noiCAGR < 0.015) { nv = 'marginal'; nn = 'NOI growth lags inflation'; }
    else if (noiCAGR < 0.04) { nv = 'solid'; nn = 'NOI growth stable'; }
    else { nv = 'favorable'; nn = 'NOI growing well'; }
    scorecard.push({ label: 'NOI Growth Trajectory', value: (noiCAGR * 100).toFixed(2) + '% CAGR', verdict: nv, note: nn });
  }

  // 8. Disposition tax concentration
  // Sale tax / cumulative operating tax savings. This dimension surfaces the risk
  // that recapture+gain dwarfs the operating shield. BUT — at high cap rates, ops
  // produce enough cash that the tax shield is small or zero. In that case, the
  // ratio is meaningless (small denominator inflates the ratio). Suppress the
  // unfavorable scoring when operating economics carry the investment on their own.
  const dispoTaxStd = window.__strResults.standard.totalSaleTaxFed;
  const opSavings = c.cumFedTaxSavings;
  const opCfStrong = cumOpCFPreTax > initInv * 0.5;  // ops alone return >50% of capital
  const dispoRatio = (opSavings > 0) ? dispoTaxStd / opSavings : 999;
  let dv, dn;
  if (opCfStrong && opSavings < (initInv * 0.3)) {
    // Property is cash-positive on operations; tax shield is small because it isn't needed
    dv = 'favorable';
    dn = 'Property cash-positive on operations; tax shield not load-bearing';
  } else if (dispoRatio < 1.2) {
    dv = 'favorable'; dn = 'Sale tax modest vs operating savings';
  } else if (dispoRatio < 2) {
    dv = 'solid'; dn = 'Sale tax in line with operating savings';
  } else if (dispoRatio < 3.5) {
    dv = 'marginal'; dn = 'Sale tax substantially exceeds operating savings — plan disposition';
  } else {
    dv = 'unfavorable'; dn = 'Sale tax dominates economics — disposition planning critical';
  }
  scorecard.push({ label: 'Disposition Tax Risk', value: (opCfStrong && opSavings < (initInv * 0.3)) ? 'N/A (ops-funded)' : (dispoRatio < 100 ? dispoRatio.toFixed(2) + 'x' : 'High'), verdict: dv, note: dn });

  // ----- Aggregate -----
  const counts = { favorable: 0, solid: 0, marginal: 0, unfavorable: 0, neutral: 0 };
  scorecard.forEach(s => counts[s.verdict] = (counts[s.verdict] || 0) + 1);

  const positive = counts.favorable + counts.solid;
  const negative = counts.marginal + counts.unfavorable;

  // CRITICAL HARD GATES (override aggregate scoring):
  // (a) Total profit is negative → Unfavorable, no other dimension can save it
  // (b) Cumulative operating CF deeply negative + IRR < 4% → Unfavorable
  let level, label, message;
  const profitLoss = profit < 0;
  const opCfDeepRed = cumOpCFPreTax < -(initInv * 0.5);
  const lowIRR = r.irr !== null && r.irr < 0.04;

  // POSITIVE OVERRIDE — if total profit is exceptional (>50% of capital) AND IRR
  // strong AND ops carry the investment, a single unfavorable signal shouldn't tank
  // the verdict to Marginal. These scenarios are economically excellent.
  const exceptionalProfit = profit > initInv * 0.5;
  const strongIRR = r.irr !== null && r.irr >= 0.12;

  if (profitLoss) {
    level = 'unfavorable';
    label = 'Unfavorable Economic Profile';
    message = 'The mechanical analysis shows the investment loses money over the hold period. Total after-tax profit is negative. The tax benefits do not compensate for the operating and financing economics. Engage counsel to evaluate whether the property and operating model can be restructured, or whether a different investment vehicle better fits the objective.';
  } else if (opCfDeepRed && lowIRR) {
    level = 'unfavorable';
    label = 'Unfavorable Economic Profile';
    message = 'Operations are deeply cash-negative and the after-tax IRR is below typical return thresholds. The tax shield is masking poor underlying economics. Consider revising operating assumptions, financing structure, or property selection.';
  } else if (counts.unfavorable >= 3) {
    level = 'unfavorable';
    label = 'Unfavorable Economic Profile';
    message = 'The mechanical analysis identifies multiple concerns with this scenario. The strategy may not produce the expected benefits given the inputs provided. Consider revising assumptions or engaging counsel to evaluate alternatives.';
  } else if (exceptionalProfit && strongIRR && counts.unfavorable <= 1 && counts.favorable >= 4) {
    // Strong scenario with one isolated concern — call it Favorable
    level = 'favorable';
    label = 'Favorable Economic Profile';
    message = 'Based on the inputs provided, the analysis indicates favorable economic outcomes across most dimensions. The strategy appears to produce meaningful tax and after-tax return benefits. One indicator below warrants attention but does not undermine the overall profile.';
  } else if (counts.unfavorable >= 2) {
    level = 'marginal';
    label = 'Marginal Economic Profile';
    message = 'The analysis identifies multiple meaningful concerns. The strategy may produce benefits but the margin for assumption error is limited. Review the unfavorable indicators carefully before proceeding.';
  } else if (counts.favorable >= 5 && counts.unfavorable === 0) {
    level = 'favorable';
    label = 'Favorable Economic Profile';
    message = 'Based on the inputs provided, the analysis indicates favorable economic outcomes across most dimensions. The strategy appears to produce meaningful tax and after-tax return benefits relative to typical investment benchmarks.';
  } else if (positive >= negative * 2 && counts.unfavorable === 0) {
    level = 'solid';
    label = 'Solid Economic Profile';
    message = 'The analysis indicates a generally favorable economic profile with some dimensions to monitor. Particular attention to the marginal indicators below may improve outcomes.';
  } else if (positive >= negative * 2 && counts.unfavorable === 1 && (exceptionalProfit || strongIRR)) {
    // Mostly positive with one isolated concern but strong economics overall
    level = 'solid';
    label = 'Solid Economic Profile';
    message = 'The analysis indicates a generally favorable economic profile with one specific concern to address. Review the unfavorable indicator below.';
  } else if (negative >= positive) {
    level = 'marginal';
    label = 'Marginal Economic Profile';
    message = 'The analysis identifies meaningful concerns that warrant attention. The strategy may produce benefits but the margin for assumption error is limited. Review the marginal and unfavorable indicators carefully.';
  } else {
    level = 'marginal';
    label = 'Marginal Economic Profile';
    message = 'The analysis identifies mixed signals across dimensions. The strategy may work for this scenario but requires careful review of the marginal indicators below.';
  }

  return { level, label, message, scorecard };
}

// =============================================================================
// FINANCING HEALTH PANEL — Cap-rate spread and DSCR display
// =============================================================================
function renderFinancingHealth() {
  if (!window.__strResults) return;
  const c = window.__strResults.common;
  const yrs = c.yearlyResults;
  if (!yrs || yrs.length === 0) return;

  const capRate = c.effectiveCapRate;
  const mortgageRate = c.mortgageRate;
  const spread = capRate - mortgageRate;
  const year1NOI = yrs[0].noi;
  const year1DebtService = yrs[0].interest + yrs[0].principal;
  const dscr = year1DebtService > 0 ? year1NOI / year1DebtService : 0;

  // Spread color and label
  let spreadColor, spreadLabel, spreadNote;
  if (spread >= 0.015) {
    spreadColor = '#169B62';
    spreadLabel = 'Positive Carry';
    spreadNote = 'Operations cover debt service from day one';
  } else if (spread >= 0) {
    spreadColor = '#169B62';
    spreadLabel = 'Break-Even Carry';
    spreadNote = 'Operations roughly cover debt service';
  } else if (spread >= -0.02) {
    spreadColor = '#d4a017';
    spreadLabel = 'Negative Carry';
    spreadNote = 'Operations do not cover debt service; tax shield required to make economics work';
  } else {
    spreadColor = '#c0392b';
    spreadLabel = 'Deeply Negative Carry';
    spreadNote = 'Significant operating losses; tax shield critical to economics';
  }

  // DSCR color and label
  let dscrColor, dscrLabel, dscrNote;
  if (dscr >= 1.25) {
    dscrColor = '#169B62';
    dscrLabel = 'Healthy';
    dscrNote = 'Meets typical commercial lender threshold (\u22651.25x)';
  } else if (dscr >= 1.10) {
    dscrColor = '#169B62';
    dscrLabel = 'Acceptable';
    dscrNote = 'Below typical commercial threshold but covers debt service';
  } else if (dscr >= 1.00) {
    dscrColor = '#d4a017';
    dscrLabel = 'Marginal';
    dscrNote = 'NOI barely covers debt service; little room for vacancy or expense shock';
  } else if (dscr >= 0.75) {
    dscrColor = '#d4a017';
    dscrLabel = 'Below 1.00x';
    dscrNote = 'NOI does not cover debt service; gap funded from tax shield or out-of-pocket';
  } else {
    dscrColor = '#c0392b';
    dscrLabel = 'Distressed';
    dscrNote = 'NOI covers less than 75% of debt service; meaningful out-of-pocket required';
  }

  const html = `
    <div style="background: #FFFFFF; padding: 1.5rem; margin: 0 0 1.75rem 0; border: 1px solid #d4d4d0;">
      <div style="font-family: 'Open Sans', sans-serif; font-size: 0.75rem; letter-spacing: 1.5px; text-transform: uppercase; color: #169B62; font-weight: 700; margin-bottom: 0.5rem;">Financing Health</div>
      <div style="font-family: 'Gotham Bold', sans-serif; font-size: 1.25rem; color: #1a1a1a; line-height: 1.2; margin-bottom: 0.5rem;">Underwriting at a Glance</div>
      <div style="font-size: 0.9rem; color: #6b6b6b; line-height: 1.5; margin-bottom: 1.25rem;">
        Two indicators commercial lenders use to evaluate a property: the spread between cap rate and mortgage rate (does the property carry itself?) and the Debt Service Coverage Ratio (is NOI sufficient to pay the mortgage?).
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.25rem;">

        <div style="border: 2px solid ${spreadColor}; padding: 1.25rem; background: ${spreadColor}15;">
          <div style="font-family: 'Open Sans', sans-serif; font-size: 0.72rem; letter-spacing: 1.5px; text-transform: uppercase; color: ${spreadColor}; font-weight: 700; margin-bottom: 0.4rem;">Cap Rate &minus; Mortgage Rate</div>
          <div style="font-family: 'Gotham Bold', sans-serif; font-size: 2rem; color: ${spreadColor}; line-height: 1.1; margin-bottom: 0.25rem;">${spread >= 0 ? '+' : ''}${(spread * 100).toFixed(2)}%</div>
          <div style="font-family: 'Gotham Bold', sans-serif; font-size: 0.95rem; color: ${spreadColor}; margin-bottom: 0.5rem;">${spreadLabel}</div>
          <div style="font-size: 0.85rem; color: #1a1a1a; line-height: 1.5; margin-bottom: 0.5rem;">${spreadNote}</div>
          <div style="font-size: 0.78rem; color: #6b6b6b; padding-top: 0.6rem; border-top: 1px dashed ${spreadColor}; line-height: 1.5;">
            Cap rate <strong>${(capRate * 100).toFixed(2)}%</strong> &middot; Mortgage rate <strong>${(mortgageRate * 100).toFixed(2)}%</strong>
          </div>
        </div>

        <div style="border: 2px solid ${dscrColor}; padding: 1.25rem; background: ${dscrColor}15;">
          <div style="font-family: 'Open Sans', sans-serif; font-size: 0.72rem; letter-spacing: 1.5px; text-transform: uppercase; color: ${dscrColor}; font-weight: 700; margin-bottom: 0.4rem;">Debt Service Coverage Ratio (Year 1)</div>
          <div style="font-family: 'Gotham Bold', sans-serif; font-size: 2rem; color: ${dscrColor}; line-height: 1.1; margin-bottom: 0.25rem;">${dscr.toFixed(2)}x</div>
          <div style="font-family: 'Gotham Bold', sans-serif; font-size: 0.95rem; color: ${dscrColor}; margin-bottom: 0.5rem;">${dscrLabel}</div>
          <div style="font-size: 0.85rem; color: #1a1a1a; line-height: 1.5; margin-bottom: 0.5rem;">${dscrNote}</div>
          <div style="font-size: 0.78rem; color: #6b6b6b; padding-top: 0.6rem; border-top: 1px dashed ${dscrColor}; line-height: 1.5;">
            Year 1 NOI <strong>${'$' + Math.round(year1NOI).toLocaleString()}</strong> &divide; Annual debt service <strong>${'$' + Math.round(year1DebtService).toLocaleString()}</strong>
          </div>
        </div>

      </div>

      <div style="font-size: 0.78rem; color: #6b6b6b; line-height: 1.5; margin-top: 1rem; padding-top: 0.85rem; border-top: 1px dashed #d4d4d0;">
        <strong>How to read these.</strong> <em>Positive carry</em> means the property earns more in NOI than it costs to finance &mdash; operations support the investment without relying on the tax shield. <em>DSCR &ge; 1.25x</em> is the typical commercial lender threshold; below 1.00x means NOI alone cannot pay the mortgage. Both metrics flag financing structures where the strategy is doing most of the work, which carries elevated risk if eligibility, depreciation, or other tax assumptions don't hold.
      </div>
    </div>
  `;
  document.getElementById('financing_health_panel').innerHTML = html;
}

function renderVerdict(mode) {
  const v = computeVerdict(mode);
  const colorMap = {
    favorable: { bg: '#e8f5ee', border: '#169B62', text: '#107a4d' },
    solid: { bg: '#e8f5ee', border: '#169B62', text: '#107a4d' },
    marginal: { bg: '#fff8e1', border: '#d4a017', text: '#d35400' },
    unfavorable: { bg: '#fcebea', border: '#c0392b', text: '#922a1f' },
    unavailable: { bg: '#fcebea', border: '#c0392b', text: '#922a1f' }
  };
  const c = colorMap[v.level] || colorMap.marginal;

  // Verdict-specific call-to-action
  let cta;
  if (v.level === 'favorable') {
    cta = 'The economic profile looks favorable; the strategy is highly sensitive to assumption accuracy. Engage counsel before acquisition to validate cost segregation, eligibility documentation, and disposition planning.';
  } else if (v.level === 'solid') {
    cta = 'A solid profile with specific areas to monitor. The marginal indicators below identify the most fragile assumptions. Engage counsel to address these before acquisition.';
  } else if (v.level === 'marginal') {
    cta = 'A marginal profile means small changes to inputs can flip the outcome. Engage counsel to stress-test assumptions and identify whether structural changes (entity choice, financing, hold period) can improve the profile.';
  } else if (v.level === 'unfavorable') {
    cta = 'Multiple concerns identified. Engage counsel before proceeding to determine whether the strategy can be restructured to produce favorable outcomes, or whether a different investment vehicle better fits the objective.';
  } else {
    cta = 'Engage counsel to evaluate whether the property and operating model can be modified to qualify the strategy.';
  }

  let scorecardHtml = '';
  if (v.scorecard) {
    const verdictIcon = {
      favorable: '<span style="color:#169B62;font-weight:700;">\u2713</span>',
      solid: '<span style="color:#169B62;font-weight:700;">\u2713</span>',
      marginal: '<span style="color:#d4a017;font-weight:700;">!</span>',
      unfavorable: '<span style="color:#c0392b;font-weight:700;">\u2717</span>',
      neutral: '<span style="color:#6b6b6b;">\u2014</span>'
    };
    scorecardHtml = '<div style="margin: 1.25rem 0; background: #FFFFFF; border: 1px solid #d4d4d0; padding: 1rem 1.25rem;"><div style="font-family: \'Gotham Bold\', sans-serif; font-size: 0.85rem; color: #169B62; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 0.75rem;">Scorecard</div>';
    v.scorecard.forEach(item => {
      scorecardHtml += '<div style="display: grid; grid-template-columns: 24px 1fr auto auto; gap: 0.75rem; padding: 0.45rem 0; border-bottom: 1px solid #f0f0e8; font-size: 0.88rem; align-items: center;">' +
        '<div style="text-align: center;">' + (verdictIcon[item.verdict] || verdictIcon.neutral) + '</div>' +
        '<div style="font-weight: 600;">' + item.label + '</div>' +
        '<div style="color: #6b6b6b; font-size: 0.82rem;">' + item.note + '</div>' +
        '<div style="font-family: \'Gotham Bold\', sans-serif; min-width: 80px; text-align: right;">' + item.value + '</div>' +
      '</div>';
    });
    scorecardHtml += '</div>';
  }

  const html = `
    <div style="background: ${c.bg}; border: 2px solid ${c.border}; padding: 1.5rem 1.75rem; margin: 0 0 1.75rem 0;">
      <div style="font-family: 'Open Sans', sans-serif; font-size: 0.75rem; letter-spacing: 1.5px; text-transform: uppercase; color: ${c.text}; font-weight: 700; margin-bottom: 0.5rem;">Economic Profile Analysis</div>
      <div style="font-family: 'Gotham Bold', sans-serif; font-size: 1.5rem; color: ${c.text}; line-height: 1.2; margin-bottom: 0.75rem;">${v.label}</div>
      <div style="font-size: 0.95rem; line-height: 1.55; color: #1a1a1a;">${v.message}</div>
      ${scorecardHtml}
      <div style="font-size: 0.9rem; line-height: 1.55; color: #1a1a1a; margin-top: 1rem; padding-top: 0.85rem; border-top: 1px dashed ${c.border};">
        <strong>Next step.</strong> ${cta}
      </div>
      <div style="font-size: 0.78rem; line-height: 1.5; color: #6b6b6b; margin-top: 1rem; padding-top: 0.85rem; border-top: 1px dashed ${c.border};">
        <strong>Important.</strong> This grading is mechanical analysis based on your inputs. It is not investment advice and is not a recommendation to buy, hold, or sell any property. Thresholds and benchmarks used are general industry conventions, not standards specific to your situation. Specific facts and circumstances may produce a different result. Engage qualified counsel before any acquisition.
      </div>
    </div>
  `;
  document.getElementById('verdict_panel').innerHTML = html;
}

// =============================================================================
// MODE-AWARE RENDERING
// =============================================================================
function renderForMode(mode) {
  if (!window.__strResults) return;
  const r = window.__strResults[mode];
  const c = window.__strResults.common;

  // Summary cards
  renderSummary({
    irr: r.irr,
    cumFedTaxSavings: c.cumFedTaxSavings,
    cumStateTaxSavings: c.cumStateTaxSavings,
    nolBalance: c.nolBalance,
    fedGain: c.fedGain,
    effSaleRate: r.effSaleRate,
    cumEffRate: r.cumEffRate,
    netFedTax: r.netFedTax,
    netSaleProceeds: r.netSaleProceeds,
    finalValue: c.finalValue,
    cashFlowAfterTax: c.cashFlowAfterTax,
    totalReturn: r.totalReturn,
    initialInvestment: c.initialInvestment,
    year1NetCashBenefit: c.year1NetCashBenefit,
    year1FedTaxSavings: c.year1FedTaxSavings,
    year1OpCashFlow: c.year1OpCashFlow,
    computedEffRate: c.computedEffRate,
    computedMarginalRate: c.computedMarginalRate
  });

  // Verdict scorecard
  renderVerdict(mode);

  // Financing health (independent of mode)
  renderFinancingHealth();

  // Heat map (only on first render, or when user requests refresh)
  if (document.getElementById('heat_map_grid')) {
    renderHeatMap();
  }

  // Sale analysis
  renderSaleAnalysis({
    saleYear: c.saleYear,
    finalValue: c.finalValue,
    sellingCosts: c.sellingCosts,
    sellingCostsPct: c.sellingCostsPct,
    netSalePrice: c.netSalePrice,
    fedAdjBasis: c.fedAdjBasis,
    fedGain: c.fedGain,
    dep1245: c.dep1245,
    dep1250: c.dep1250,
    sec1245Recapture: r.sale.sec1245Recapture,
    sec1250Unrec: r.sale.sec1250Unrec,
    ltcgGain: r.sale.ltcgGain,
    tax1245: r.sale.tax1245,
    tax1250: r.sale.tax1250,
    taxLTCG: r.sale.taxLTCG,
    taxNIIT: r.sale.taxNIIT,
    totalSaleTaxFed: r.totalSaleTaxFed,
    mortgagePayoff: c.mortgagePayoff,
    netSaleProceeds: r.netSaleProceeds,
    effSaleRate: r.effSaleRate,
    stateGain: c.stateGain,
    stateSaleTax: c.stateSaleTax,
    stateAdjBasis: c.stateAdjBasis,
    stateHasTax: c.stateHasTaxFlag,
    stateConforms: c.stateConforms,
    stateName: c.stateName
  });
}

function setStrategyMode(mode) {
  window.__strMode = mode;
  renderForMode(mode);
}

function resetSTR() {
  // Clear all text and number inputs except those with default values we want to keep
  document.querySelectorAll('input[type="text"], input[type="number"]').forEach(i => {
    i.value = '';
  });
  // Restore selects to their first option
  document.querySelectorAll('select').forEach(s => { s.selectedIndex = 0; });
  document.getElementById('results').classList.remove('show');
  document.getElementById('estimated_rate_display').innerHTML = '';
  // Restore default values
  document.getElementById('land_pct').value = '20';
  document.getElementById('reclass_pct').value = '20';
  document.getElementById('down_payment_pct').value = '25';
  document.getElementById('closing_costs_pct').value = '2.5';
  document.getElementById('cap_rate').value = '6.0';
  document.getElementById('appreciation_rate').value = '3.0';
  document.getElementById('rent_growth').value = '3.0';
  document.getElementById('opex_growth').value = '3.0';
  document.getElementById('opex_ratio').value = '50';
  // Reset closing costs toggle to dollar mode
  document.querySelectorAll('[data-target="closing_costs"]').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-target="closing_costs"][data-mode="dollar"]').classList.add('active');
  document.getElementById('closing_costs_dollar_wrap').style.display = '';
  document.getElementById('closing_costs_percent_wrap').style.display = 'none';
  // Reset NOI toggle to cap rate mode
  document.querySelectorAll('[data-target="noi_method"]').forEach(b => b.classList.remove('active'));
  document.querySelector('[data-target="noi_method"][data-mode="caprate"]').classList.add('active');
  document.getElementById('caprate_inputs').style.display = '';
  document.getElementById('grossrent_inputs').style.display = 'none';
  populateStates();
}

// =============================================================================
// CSV EXPORT
// =============================================================================
function csvEscape(v) {
  if (v === null || v === undefined) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function csvRow(arr) {
  return arr.map(csvEscape).join(',');
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

function csvNum(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return Math.round(n).toString();
}

function csvPct(n) {
  if (n === null || n === undefined || isNaN(n)) return '';
  return n.toFixed(2) + '%';
}

function exportToCSV() {
  if (!window.__strResults) {
    alert('Please run the analysis first.');
    return;
  }
  const r = window.__strResults;
  const std = r.standard;
  const dvn = r.donovan;
  const c = r.common;
  const yrs = c.yearlyResults;
  const today = new Date().toISOString().slice(0, 10);

  let lines = [];

  // Header
  lines.push('STR TAX STRATEGY ANALYZER - DETAILED ANALYSIS');
  lines.push('Generated:,' + today);
  lines.push('Source:,Donovan Legal PLLC - donovan.law');
  lines.push('');

  // Inputs section
  lines.push('=== INPUTS ===');
  lines.push(csvRow(['Activity Classification', val('rental_period')]));
  lines.push(csvRow(['Management Arrangement', val('management')]));
  lines.push(csvRow(['Taxpayer Hours', num('taxpayer_hours')]));
  lines.push(csvRow(['Other Individual Hours', num('other_hours')]));
  lines.push(csvRow(['REPS Status', val('reps')]));
  lines.push(csvRow(['Purchase Price', csvNum(num('purchase_price'))]));
  // NOI method
  const _noiMode = document.querySelector('[data-target="noi_method"].active').getAttribute('data-mode');
  if (_noiMode === 'caprate') {
    lines.push(csvRow(['NOI Input Method', 'Cap Rate']));
    lines.push(csvRow(['Year 1 Cap Rate', val('cap_rate') + '%']));
  } else {
    lines.push(csvRow(['NOI Input Method', 'Gross Rents + OpEx']));
    lines.push(csvRow(['Year 1 Gross Rents', csvNum(num('gross_rents'))]));
    lines.push(csvRow(['Operating Expense Ratio', val('opex_ratio') + '%']));
  }
  const ccMode = document.querySelector('[data-target="closing_costs"].active').getAttribute('data-mode');
  const cc = (ccMode === 'dollar') ? num('closing_costs') : num('purchase_price') * (num('closing_costs_pct') / 100);
  lines.push(csvRow(['Closing Costs', csvNum(cc)]));
  lines.push(csvRow(['Land Allocation %', val('land_pct') + '%']));
  lines.push(csvRow(['Cost Seg Reclass % (of Total Cost)', val('reclass_pct') + '%']));
  lines.push(csvRow(['Down Payment %', val('down_payment_pct') + '%']));
  lines.push(csvRow(['Down Payment (Calculated)', csvNum(c.initialInvestment - cc)]));
  lines.push(csvRow(['Mortgage Rate', val('mortgage_rate') + '%']));
  lines.push(csvRow(['Mortgage Term', val('mortgage_term') + ' years']));
  lines.push(csvRow(['Filing Status', val('filing_status').toUpperCase()]));
  lines.push(csvRow(['Tax Year', val('tax_year')]));
  lines.push(csvRow(['W-2 Wages', csvNum(num('w2_wages'))]));
  lines.push(csvRow(['Business Income', csvNum(num('business_income'))]));
  lines.push(csvRow(['Other Non-Business Income', csvNum(num('other_nonbusiness'))]));
  lines.push(csvRow(['LT Capital Gains', csvNum(num('lt_cap_gains'))]));
  lines.push(csvRow(['State', STATES[val('state')].name]));
  lines.push(csvRow(['Hold Period', val('hold_period') + ' years']));
  if (window.__strResults && window.__strResults.common) {
    const _c = window.__strResults.common;
    lines.push(csvRow(['Computed Effective Federal Rate', (_c.computedEffRate * 100).toFixed(2) + '%']));
    lines.push(csvRow(['Computed Marginal Federal Rate', (_c.computedMarginalRate * 100).toFixed(2) + '%']));
  }
  lines.push(csvRow(['Bonus Depreciation Rate', val('bonus_rate') + '%']));
  lines.push(csvRow(['Annual Property Value Appreciation', val('appreciation_rate') + '%']));
  lines.push(csvRow(['Annual Rent Growth', val('rent_growth') + '%']));
  lines.push(csvRow(['Annual Operating Expense Growth', val('opex_growth') + '%']));
  lines.push('');

  // Eligibility
  lines.push('=== § 469 ELIGIBILITY DETERMINATION ===');
  // The determination text is written into a CSV cell, never into markup, but the
  // strip still has to be complete: see stripTagsToText.
  const eligText = c.eligibility.label + '. ' + stripTagsToText(c.eligibility.explanation).replace(/\s+/g, ' ');
  lines.push(csvRow(['Status', c.eligibility.status]));
  lines.push(csvRow(['Determination', eligText]));
  lines.push('');

  // Summary metrics — both modes
  lines.push('=== SUMMARY METRICS ===');
  lines.push(csvRow(['Metric', 'Standard', 'With Donovan Legal Tax Strategy', 'Improvement']));
  lines.push(csvRow(['After-Tax IRR', csvPct(std.irr * 100), csvPct(dvn.irr * 100), csvPct((dvn.irr - std.irr) * 100)]));
  lines.push(csvRow(['Cumulative Effective Tax Rate', csvPct(std.cumEffRate), csvPct(dvn.cumEffRate), csvPct(std.cumEffRate - dvn.cumEffRate) + ' (lower is better)']));
  lines.push(csvRow(['Cash-on-Cash ROI', csvPct(std.roi), csvPct(dvn.roi), csvPct(dvn.roi - std.roi)]));
  lines.push(csvRow(['Year 1 Net Cash Benefit', csvNum(c.year1NetCashBenefit), csvNum(c.year1NetCashBenefit), '0']));
  lines.push(csvRow(['Cumulative Operating Tax Savings', csvNum(c.cumFedTaxSavings), csvNum(c.cumFedTaxSavings), '0']));
  lines.push(csvRow(['Federal Tax on Sale', csvNum(std.totalSaleTaxFed), csvNum(dvn.totalSaleTaxFed), csvNum(std.totalSaleTaxFed - dvn.totalSaleTaxFed)]));
  lines.push(csvRow(['Net Sale Proceeds', csvNum(std.netSaleProceeds), csvNum(dvn.netSaleProceeds), csvNum(dvn.netSaleProceeds - std.netSaleProceeds)]));
  lines.push(csvRow(['Total After-Tax Profit', csvNum(std.totalProfit), csvNum(dvn.totalProfit), csvNum(dvn.totalProfit - std.totalProfit)]));
  lines.push('');

  // Multi-year projection
  lines.push('=== MULTI-YEAR PROJECTION ===');
  const yrHeader = ['Item'].concat(yrs.map(y => 'Year ' + y.year));
  lines.push(csvRow(yrHeader));
  lines.push(csvRow(['Property Value (3% growth)'].concat(yrs.map(y => csvNum(y.propValue)))));
  lines.push(csvRow(['NOI (3% growth)'].concat(yrs.map(y => csvNum(y.noi)))));
  lines.push(csvRow(['Mortgage Interest'].concat(yrs.map(y => csvNum(y.interest)))));
  lines.push(csvRow(['Mortgage Principal'].concat(yrs.map(y => csvNum(y.principal)))));
  lines.push(csvRow(['Federal Depreciation'].concat(yrs.map(y => csvNum(y.fedDep)))));
  lines.push(csvRow(['State Depreciation'].concat(yrs.map(y => csvNum(y.stateDep)))));
  lines.push(csvRow(['Rental Net Income (Federal)'].concat(yrs.map(y => csvNum(y.rentalIncomeFed)))));
  lines.push(csvRow(['Loss Usable Post-461(l)'].concat(yrs.map(y => csvNum(y.lossUsable461)))));
  lines.push(csvRow(['NOL Generated'].concat(yrs.map(y => csvNum(y.nolGenerated)))));
  lines.push(csvRow(['NOL Used (80% rule)'].concat(yrs.map(y => csvNum(y.nolUsed)))));
  lines.push(csvRow(['NOL Balance EOY'].concat(yrs.map(y => csvNum(y.nolBalance)))));
  lines.push(csvRow(['Federal Tax Impact (savings or owed)'].concat(yrs.map(y => csvNum(y.fedTaxSavings)))));
  if (c.stateHasTaxFlag) {
    lines.push(csvRow(['State Tax Impact'].concat(yrs.map(y => csvNum(y.stateTaxSavings)))));
  }
  lines.push(csvRow(['Cash Flow After Tax'].concat(yrs.map(y => csvNum(y.cashFlowAfterTax)))));
  lines.push(csvRow(['Mortgage Balance EOY'].concat(yrs.map(y => csvNum(y.mortgageBalance)))));
  lines.push('');

  // Sale analysis - standard mode
  lines.push('=== SALE-YEAR ANALYSIS - STANDARD CALCULATION ===');
  lines.push(csvRow(['Sale Price (3% appreciation)', csvNum(c.finalValue)]));
  lines.push(csvRow(['Selling Costs (7%)', csvNum(c.sellingCosts)]));
  lines.push(csvRow(['Net Sale Price', csvNum(c.netSalePrice)]));
  lines.push(csvRow(['Federal Adjusted Basis', csvNum(c.fedAdjBasis)]));
  lines.push(csvRow(['Federal Gain', csvNum(c.fedGain)]));
  lines.push(csvRow(['§ 1245 Recapture (cost-seg)', csvNum(std.sale.sec1245Recapture)]));
  lines.push(csvRow(['Tax on § 1245 Recapture (ordinary rate)', csvNum(std.sale.tax1245)]));
  lines.push(csvRow(['§ 1250 Unrecaptured Gain', csvNum(std.sale.sec1250Unrec)]));
  lines.push(csvRow(['Tax on § 1250 (25% max)', csvNum(std.sale.tax1250)]));
  lines.push(csvRow(['Long-Term Capital Gain', csvNum(std.sale.ltcgGain)]));
  lines.push(csvRow(['Tax on LTCG (0/15/20%)', csvNum(std.sale.taxLTCG)]));
  lines.push(csvRow(['NIIT', csvNum(std.sale.taxNIIT)]));
  lines.push(csvRow(['Total Federal Tax on Sale', csvNum(std.totalSaleTaxFed)]));
  lines.push(csvRow(['Mortgage Payoff', csvNum(c.mortgagePayoff)]));
  if (c.stateHasTaxFlag) {
    lines.push(csvRow(['State Tax on Sale', csvNum(c.stateSaleTax)]));
  }
  lines.push(csvRow(['Net Sale Proceeds (Standard)', csvNum(std.netSaleProceeds)]));
  lines.push('');

  // Sale analysis - strategy mode
  lines.push('=== SALE-YEAR ANALYSIS - WITH DONOVAN LEGAL TAX STRATEGY ===');
  lines.push(csvRow(['§ 1245 Recapture', csvNum(dvn.sale.sec1245Recapture)]));
  lines.push(csvRow(['Tax on § 1245 Recapture', csvNum(dvn.sale.tax1245)]));
  lines.push(csvRow(['§ 1250 Unrecaptured Gain', csvNum(dvn.sale.sec1250Unrec)]));
  lines.push(csvRow(['Tax on § 1250 (25% max)', csvNum(dvn.sale.tax1250)]));
  lines.push(csvRow(['Long-Term Capital Gain', csvNum(dvn.sale.ltcgGain)]));
  lines.push(csvRow(['Tax on LTCG (0/15/20%)', csvNum(dvn.sale.taxLTCG)]));
  lines.push(csvRow(['NIIT', csvNum(dvn.sale.taxNIIT)]));
  lines.push(csvRow(['Total Federal Tax on Sale (Strategy)', csvNum(dvn.totalSaleTaxFed)]));
  lines.push(csvRow(['Net Sale Proceeds (Strategy)', csvNum(dvn.netSaleProceeds)]));
  lines.push('');

  // Disclaimer
  lines.push('=== DISCLAIMER ===');
  lines.push('"This analysis is informational only and is not tax or legal advice. Material participation under § 469, the § 461(l) excess business loss limitation, the § 172 NOL carryforward rules, cost segregation, sale-year recapture, and state tax conformity are all fact-specific determinations that this tool simplifies. Specific facts and circumstances may produce a different result. State conformity reflects information current as of May 2026. Engage qualified counsel before any acquisition or transaction. Reading or using this tool does not create an attorney-client relationship with Donovan Legal PLLC. To discuss your specific facts, contact the firm at info@donovan.law or 561-666-6022."');
  lines.push('');
  lines.push('"© Donovan Legal PLLC. donovan.law"');

  const csv = lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `STR-Analysis-${today}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Attach comma formatters to all dollar inputs
['purchase_price', 'closing_costs', 'gross_rents', 'w2_wages', 'business_income', 'other_nonbusiness', 'lt_cap_gains'].forEach(attachCommaFormatter);

// Initialize
populateStates();


// =============================================================================
// BATCH B.1 — AUTO-RATE, LOCALSTORAGE PERSISTENCE, PRESET SCENARIOS
// =============================================================================

// ----- Auto-Rate Estimator -----
// Triggered when any of fico/ltv_band/loan_type/prop_type changes.
// Auto-fills the mortgage_rate field with the estimator output.
function autoEstimateRate() {
  // Defer to estimateRate() but suppress its alert if mortgage_rate already set;
  // estimateRate already sets the mortgage_rate field, so we just call it.
  try {
    estimateRate();
  } catch (e) {
    console.warn('Auto-rate estimator failed:', e);
  }
}

// ----- Preset Scenarios -----
const STR_PRESETS = {
  beach: {
    label: 'Florida Beach Condo',
    rental_period: 'le7',
    management: 'self',
    taxpayer_hours: 250,
    other_hours: 100,
    reps: 'no',
    sig_personal_services: 'no',
    extra_personal_services: 'no',
    incidental_rental: 'no',
    business_hours_avail: 'no',
    jv_use: 'no',
    total_spa_hours: 0,
    prior_5_of_10: 'no',
    regular_continuous: 'yes',
    purchase_price: '1,200,000',
    closing_costs_pct: 2.5,
    land_pct: 25,
    reclass_pct: 25,
    down_payment_pct: 25,
    mortgage_rate: 7.25,
    mortgage_term: 30,
    noi_method: 'caprate',
    cap_rate: 6.0,
    filing_status: 'mfj',
    tax_year: 2026,
    w2_wages: '600,000',
    business_income: '0',
    other_nonbusiness: '0',
    lt_cap_gains: '0',
    state: 'FL',
    hold_period: 5,
    bonus_rate: 100,
    appreciation_rate: 3.0,
    rent_growth: 3.0,
    opex_growth: 3.5,
    // Rate estimator
    fico: '740',
    ltv_band: '75',
    loan_type: 'conv',
    prop_type: 'condo'
  },
  ski: {
    label: 'Colorado Ski Cabin',
    rental_period: 'le7',
    management: 'cohost',
    taxpayer_hours: 200,
    other_hours: 150,
    reps: 'no',
    sig_personal_services: 'no',
    extra_personal_services: 'no',
    incidental_rental: 'no',
    business_hours_avail: 'no',
    jv_use: 'no',
    total_spa_hours: 0,
    prior_5_of_10: 'no',
    regular_continuous: 'yes',
    purchase_price: '1,500,000',
    closing_costs_pct: 2.5,
    land_pct: 20,
    reclass_pct: 30,
    down_payment_pct: 25,
    mortgage_rate: 7.5,
    mortgage_term: 30,
    noi_method: 'caprate',
    cap_rate: 5.5,
    filing_status: 'mfj',
    tax_year: 2026,
    w2_wages: '750,000',
    business_income: '0',
    other_nonbusiness: '0',
    lt_cap_gains: '0',
    state: 'CO',
    hold_period: 7,
    bonus_rate: 100,
    appreciation_rate: 3.5,
    rent_growth: 3.5,
    opex_growth: 3.5,
    fico: '740',
    ltv_band: '75',
    loan_type: 'conv',
    prop_type: 'sfr'
  },
  urban: {
    label: 'Urban Loft',
    rental_period: 'le7',
    management: 'self',
    taxpayer_hours: 180,
    other_hours: 80,
    reps: 'no',
    sig_personal_services: 'no',
    extra_personal_services: 'no',
    incidental_rental: 'no',
    business_hours_avail: 'no',
    jv_use: 'no',
    total_spa_hours: 0,
    prior_5_of_10: 'no',
    regular_continuous: 'yes',
    purchase_price: '800,000',
    closing_costs_pct: 2.5,
    land_pct: 30,
    reclass_pct: 18,
    down_payment_pct: 25,
    mortgage_rate: 7.0,
    mortgage_term: 30,
    noi_method: 'caprate',
    cap_rate: 6.5,
    filing_status: 'mfj',
    tax_year: 2026,
    w2_wages: '500,000',
    business_income: '0',
    other_nonbusiness: '0',
    lt_cap_gains: '0',
    state: 'TX',
    hold_period: 5,
    bonus_rate: 100,
    appreciation_rate: 2.5,
    rent_growth: 2.5,
    opex_growth: 3.0,
    fico: '740',
    ltv_band: '75',
    loan_type: 'conv',
    prop_type: 'condo'
  }
};

function loadPreset(key) {
  const p = STR_PRESETS[key];
  if (!p) return;
  // Apply each value, accounting for the input element type
  Object.keys(p).forEach(k => {
    if (k === 'label' || k === 'noi_method') return;  // skip non-input keys
    const el = document.getElementById(k);
    if (!el) return;
    el.value = p[k];
  });
  // NOI method toggle (cap rate is the default; presets all use cap rate mode)
  if (p.noi_method === 'caprate') {
    document.querySelectorAll('[data-target="noi_method"]').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector('[data-target="noi_method"][data-mode="caprate"]');
    if (btn) btn.classList.add('active');
    const ci = document.getElementById('caprate_inputs');
    const gi = document.getElementById('grossrent_inputs');
    if (ci) ci.style.display = '';
    if (gi) gi.style.display = 'none';
  }
  // Closing costs toggle: presets use percent mode (closing_costs_pct field)
  document.querySelectorAll('[data-target="closing_costs"]').forEach(b => b.classList.remove('active'));
  const ccBtn = document.querySelector('[data-target="closing_costs"][data-mode="percent"]');
  if (ccBtn) ccBtn.classList.add('active');
  const ccd = document.getElementById('closing_costs_dollar_wrap');
  const ccp = document.getElementById('closing_costs_percent_wrap');
  if (ccd) ccd.style.display = 'none';
  if (ccp) ccp.style.display = '';
  // State note refresh
  if (typeof updateStateNote === 'function') updateStateNote();
  // Save to localStorage
  saveInputsToLocalStorage();
  // Scroll to top of form
  const stepCard = document.querySelector('.step-card');
  if (stepCard) stepCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
  // Toast confirmation
  showToast('Loaded preset: ' + p.label);
}

// ----- localStorage Persistence -----
const STR_STORAGE_KEY = 'donovan_str_analyzer_inputs_v1';

const STR_TRACKED_FIELDS = [
  // Step 1 — Per Se Passive Analysis
  'rental_period', 'sig_personal_services', 'extra_personal_services',
  'incidental_rental', 'business_hours_avail', 'jv_use', 'reps',
  // Step 2 — Material Participation
  'management', 'taxpayer_hours', 'other_hours', 'total_spa_hours',
  'prior_5_of_10', 'regular_continuous',
  // Step 3+ — Property and economics
  'purchase_price', 'closing_costs', 'closing_costs_pct', 'land_pct', 'reclass_pct',
  'down_payment_pct', 'mortgage_rate', 'mortgage_term',
  'cap_rate', 'gross_rents', 'opex_ratio',
  'filing_status', 'tax_year', 'w2_wages', 'business_income', 'other_nonbusiness', 'lt_cap_gains',
  'state', 'hold_period', 'bonus_rate',
  'appreciation_rate', 'rent_growth', 'opex_growth', 'selling_costs_pct',
  'fico', 'ltv_band', 'loan_type', 'prop_type'
];

/* Tracked fields whose restored value is a number, never text. Only hold_period
   reaches HTML unescaped; every other tracked field is read back through num(),
   which parseFloats it before it can reach a sink. */
const STR_NUMERIC_FIELDS = new Set(['hold_period']);

function saveInputsToLocalStorage() {
  try {
    const data = {};
    STR_TRACKED_FIELDS.forEach(id => {
      const el = document.getElementById(id);
      if (el) data[id] = el.value;
    });
    // Track NOI method and closing costs mode toggles
    const noiBtn = document.querySelector('[data-target="noi_method"].active');
    if (noiBtn) data._noi_method = noiBtn.getAttribute('data-mode');
    const ccBtn = document.querySelector('[data-target="closing_costs"].active');
    if (ccBtn) data._closing_costs_mode = ccBtn.getAttribute('data-mode');
    localStorage.setItem(STR_STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    // localStorage may be disabled (private mode, etc.); silently fail
    console.warn('Could not save inputs to localStorage:', e);
  }
}

function restoreInputsFromLocalStorage() {
  try {
    const raw = localStorage.getItem(STR_STORAGE_KEY);
    if (!raw) return false;
    const data = JSON.parse(raw);
    let restored = 0;
    STR_TRACKED_FIELDS.forEach(id => {
      if (data[id] !== undefined) {
        const el = document.getElementById(id);
        if (!el) return;
        // Read-path half of the barrier: a numeric field is coerced on the way
        // in, and a value that will not survive the coercion is not a hold
        // period, so it is refused rather than written into the field.
        if (STR_NUMERIC_FIELDS.has(id)) {
          const n = numYears(data[id]);
          if (n === null) return;
          el.value = String(n); restored++;
          return;
        }
        el.value = data[id]; restored++;
      }
    });
    // Restore NOI method
    if (data._noi_method) {
      document.querySelectorAll('[data-target="noi_method"]').forEach(b => b.classList.remove('active'));
      const btn = document.querySelector('[data-target="noi_method"][data-mode="' + data._noi_method + '"]');
      if (btn) btn.classList.add('active');
      const isCapRate = data._noi_method === 'caprate';
      const ci = document.getElementById('caprate_inputs');
      const gi = document.getElementById('grossrent_inputs');
      if (ci) ci.style.display = isCapRate ? '' : 'none';
      if (gi) gi.style.display = isCapRate ? 'none' : '';
    }
    // Restore closing costs mode
    if (data._closing_costs_mode) {
      document.querySelectorAll('[data-target="closing_costs"]').forEach(b => b.classList.remove('active'));
      const btn = document.querySelector('[data-target="closing_costs"][data-mode="' + data._closing_costs_mode + '"]');
      if (btn) btn.classList.add('active');
      const isDollar = data._closing_costs_mode === 'dollar';
      const dw = document.getElementById('closing_costs_dollar_wrap');
      const pw = document.getElementById('closing_costs_percent_wrap');
      if (dw) dw.style.display = isDollar ? '' : 'none';
      if (pw) pw.style.display = isDollar ? 'none' : '';
    }
    return restored > 0;
  } catch (e) {
    console.warn('Could not restore inputs from localStorage:', e);
    return false;
  }
}

function clearSavedInputs() {
  if (!confirm('Clear all saved inputs and reset to defaults? This will discard your current entries.')) return;
  try {
    localStorage.removeItem(STR_STORAGE_KEY);
  } catch (e) { /* ignore */ }
  if (typeof resetSTR === 'function') resetSTR();
  showToast('Saved inputs cleared');
}

// Attach auto-save on every input change
function attachAutoSave() {
  STR_TRACKED_FIELDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, function() {
      saveInputsToLocalStorage();
    });
  });
  // Also save when toggle buttons are clicked (NOI method, closing costs mode)
  document.querySelectorAll('[data-target="noi_method"], [data-target="closing_costs"]').forEach(btn => {
    btn.addEventListener('click', function() {
      // Delay to let the click handler update active state first
      setTimeout(saveInputsToLocalStorage, 50);
    });
  });
}

// ----- Toast notification (simple, dismissible) -----
function showToast(message) {
  // Remove any existing toast
  const existing = document.getElementById('str_toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'str_toast';
  toast.style.cssText = 'position:fixed;bottom:24px;right:24px;background:#1a1a1a;color:#FFF;padding:0.85rem 1.25rem;border-left:4px solid #169B62;font-family:"Open Sans",sans-serif;font-size:0.88rem;font-weight:600;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.25);opacity:0;transition:opacity 0.2s ease;';
  toast.textContent = message;
  document.body.appendChild(toast);
  // Fade in
  setTimeout(() => { toast.style.opacity = '1'; }, 10);
  // Fade out after 3 seconds
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 250);
  }, 3000);
}

// Run on load: restore inputs and attach auto-save
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    const restored = restoreInputsFromLocalStorage();
    attachAutoSave();
    if (restored) showToast('Restored your previously saved inputs');
  });
} else {
  // Document already loaded (defer attribute ensured this)
  const restored = restoreInputsFromLocalStorage();
  attachAutoSave();
  if (restored) showToast('Restored your previously saved inputs');
}


// =============================================================================
// BATCH B.2 — WIZARD PROGRESS, MOBILE TABLE, ELIGIBILITY BANNER
// =============================================================================

// ----- Wizard progress: mark steps as complete based on required fields -----
const STR_STEP_REQUIRED_FIELDS = {
  1: ['rental_period'],                                   // Per Se Passive — at minimum need average period
  2: ['taxpayer_hours'],                                  // Material Participation — at minimum need hours (unless REPS)
  3: ['purchase_price', 'land_pct', 'reclass_pct'],       // Property Information
  4: ['cap_rate'],                                         // Operations (or gross_rents)
  5: ['down_payment_pct', 'mortgage_rate'],               // Financing
  6: ['filing_status', 'state'],                          // Taxpayer
  7: ['hold_period', 'appreciation_rate']                 // Hold & Assumptions
};

function isFieldComplete(id) {
  const el = document.getElementById(id);
  if (!el) return false;
  const v = (el.value || '').toString().trim().replace(/,/g, '');
  if (v === '' || v === '0') return false;
  // For percentage fields, 0 is acceptable (down payment can be 0 in theory; cap rate cannot)
  // We treat 0 as incomplete for the wizard since it almost always indicates the user hasn't entered yet
  return parseFloat(v) > 0 || (el.tagName === 'SELECT' && v !== '');
}

function isStepComplete(stepNum) {
  if (stepNum === 1) {
    // Step 1 — Per Se Passive: needs rental_period AND at least one exception path OR REPS
    if (!isFieldComplete('rental_period')) return false;
    const period = document.getElementById('rental_period') ? document.getElementById('rental_period').value : '';
    const sps = document.getElementById('sig_personal_services') ? document.getElementById('sig_personal_services').value === 'yes' : false;
    const eps = document.getElementById('extra_personal_services') ? document.getElementById('extra_personal_services').value === 'yes' : false;
    const inc = document.getElementById('incidental_rental') ? document.getElementById('incidental_rental').value === 'yes' : false;
    const bh = document.getElementById('business_hours_avail') ? document.getElementById('business_hours_avail').value === 'yes' : false;
    const jv = document.getElementById('jv_use') ? document.getElementById('jv_use').value === 'yes' : false;
    const reps = document.getElementById('reps') ? document.getElementById('reps').value : 'no';
    // Step 1 is "complete" if there's a clear path:
    //   - period is ≤7 days (Exception A)
    //   - period is 8-30 days AND sps (Exception B)
    //   - eps OR inc OR bh OR jv (Exceptions C-F)
    //   - REPS established
    //   - OR period is >30 days AND no exception/REPS — also "complete" (per se passive determination made)
    if (period === 'le7') return true;
    if (period === 'le30' && sps) return true;
    if (eps || inc || bh || jv) return true;
    if (reps === 'yes' || reps === 'spouse') return true;
    if (period === 'gt30') return true;
    return false;
  }
  if (stepNum === 2) {
    // Step 2 — Material Participation: hours entered OR REPS path (Step 2 not strictly needed for REPS, but encouraged)
    const reps = document.getElementById('reps');
    const repsVal = reps ? reps.value : 'no';
    if (repsVal === 'yes' || repsVal === 'spouse') return true;
    return isFieldComplete('management') && isFieldComplete('taxpayer_hours');
  }
  if (stepNum === 4) {
    // Step 4 — Operations: cap_rate OR (gross_rents + opex_ratio)
    const noiBtn = document.querySelector('[data-target="noi_method"].active');
    const mode = noiBtn ? noiBtn.getAttribute('data-mode') : 'caprate';
    if (mode === 'caprate') return isFieldComplete('cap_rate');
    return isFieldComplete('gross_rents');
  }
  const required = STR_STEP_REQUIRED_FIELDS[stepNum] || [];
  return required.every(isFieldComplete);
}

function updateWizardProgress() {
  let firstIncomplete = null;
  for (let i = 1; i <= 7; i++) {
    const el = document.getElementById('wp_step_' + i);
    if (!el) continue;
    const complete = isStepComplete(i);
    el.classList.remove('wp-priority', 'wp-complete');
    const status = el.querySelector('.wp-step-status');
    if (complete) {
      el.classList.add('wp-complete');
      if (status) status.textContent = '';
    } else {
      if (firstIncomplete === null) firstIncomplete = i;
      if (status) status.textContent = '';
    }
  }
  // Mark first incomplete step as priority (with "Start here" or "Next" hint)
  if (firstIncomplete !== null) {
    const el = document.getElementById('wp_step_' + firstIncomplete);
    if (el) {
      el.classList.add('wp-priority');
      const status = el.querySelector('.wp-step-status');
      if (status) status.textContent = firstIncomplete === 1 ? 'Start here' : 'Next';
    }
    // Also apply priority styling to the step card itself
    document.querySelectorAll('.step-card').forEach(c => c.classList.remove('priority'));
    const card = document.getElementById('step_' + firstIncomplete);
    if (card) card.classList.add('priority');
  } else {
    // All steps complete: clear priority styling
    document.querySelectorAll('.step-card').forEach(c => c.classList.remove('priority'));
  }
}

// Run wizard progress check on every input/change event
function attachWizardProgressListeners() {
  const allFields = [];
  Object.values(STR_STEP_REQUIRED_FIELDS).forEach(arr => arr.forEach(f => allFields.push(f)));
  // Also depend on these for completion detection
  allFields.push('gross_rents', 'opex_ratio', 'reps', 'sig_personal_services',
                  'extra_personal_services', 'incidental_rental', 'business_hours_avail',
                  'jv_use', 'management');
  const unique = [...new Set(allFields)];
  unique.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const evt = el.tagName === 'SELECT' ? 'change' : 'input';
    el.addEventListener(evt, updateWizardProgress);
  });
  document.querySelectorAll('[data-target="noi_method"]').forEach(btn => {
    btn.addEventListener('click', function() {
      setTimeout(updateWizardProgress, 50);
    });
  });
}

// ----- Mobile-friendly multi-year table: attach data-year-label to cells -----
// We hook into renderProjectionTable by wrapping it with a post-processor.
// We can't modify the existing function structure cleanly without editing
// renderProjectionTable directly, so we monkey-patch the result.
const _originalRenderProjectionTable = renderProjectionTable;
renderProjectionTable = function(years, hasState) {
  _originalRenderProjectionTable(years, hasState);
  // Post-process: add data-year-label to each non-first cell using the year header
  const tbl = document.getElementById('projection_table');
  if (!tbl) return;
  tbl.querySelectorAll('tbody tr:not(.section-header)').forEach(tr => {
    const cells = tr.querySelectorAll('td');
    for (let i = 1; i < cells.length; i++) {
      const yearNum = years[i - 1] ? years[i - 1].year : i;
      cells[i].setAttribute('data-year-label', 'Yr ' + yearNum + ':');
    }
  });
};

// ----- Eligibility-gated banner -----
function renderEligibilityBanner() {
  if (!window.__strResults) return;
  const elig = window.__strResults.common.eligibility;
  const banner = document.getElementById('eligibility_banner_top');
  if (!banner) return;

  // Determine which step caused the failure for more specific messaging
  let failurePoint = '';
  if (elig.step1 && elig.step2) {
    if (!elig.step1.outcome.escapesPerSePassive) {
      failurePoint = 'Step 1 (Per Se Passive Analysis) — no exception under Reg. \u00a7 1.469-1T(e)(3)(ii) applies and REPS is not established. The activity is per se passive under \u00a7 469(c)(2); operating losses suspend until disposition.';
    } else if (!elig.step2.outcome.materialParticipation) {
      failurePoint = 'Step 2 (Material Participation) \u2014 the activity escapes per se passive treatment, but none of the seven tests of Reg. \u00a7 1.469-5T are satisfied with the inputs provided. Losses are still treated as passive under \u00a7 469(h).';
    }
  }

  if (elig.status === 'likely-ineligible') {
    banner.innerHTML = `
      <div class="eligibility-banner-ineligible">
        <div class="eligibility-banner-ineligible-label">&#9888;&#65039; Eligibility Concern</div>
        <div class="eligibility-banner-ineligible-title">Operating Tax Savings Below Are Informational Only</div>
        <div class="eligibility-banner-ineligible-body">
          ${failurePoint || 'The &sect;&nbsp;469 analysis indicates the rental loss likely cannot be used to offset W-2 wages or other ordinary income.'} The tax savings figures shown below assume the activity is non-passive; until the issue is resolved, those savings will not be available. The property economics on a pre-tax basis (operating cash flow, sale proceeds) remain reliable. Review the Step 1 and Step 2 analysis above for detail.
        </div>
      </div>
    `;
  } else if (elig.status === 'marginal') {
    banner.innerHTML = `
      <div class="eligibility-banner-marginal">
        <div class="eligibility-banner-marginal-label">Analysis Requires Factual Development</div>
        <div class="eligibility-banner-marginal-title">Operating Tax Savings Are Contingent</div>
        <div class="eligibility-banner-marginal-body">
          The &sect;&nbsp;469 analysis is incomplete or marginal. Step 1 (per se passive analysis) and Step 2 (material participation) together determine whether the activity is non-passive. Either Step 1 requires additional fact development (significant personal services, incidental activity, etc.) or Step 2 requires further data (prior-year participation, hours documentation, facts-and-circumstances showing). The tax savings figures below assume the activity is non-passive once both steps are established.
        </div>
      </div>
    `;
  } else {
    banner.innerHTML = '';
  }
}

// Hook eligibility banner into renderForMode
const _originalRenderForMode = renderForMode;
renderForMode = function(mode) {
  _originalRenderForMode(mode);
  renderEligibilityBanner();
};

// Initialize on load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    attachWizardProgressListeners();
    updateWizardProgress();
  });
} else {
  attachWizardProgressListeners();
  updateWizardProgress();
}


// =============================================================================
// BATCH C.1 — HEADLINE PANEL (strategy preview + contextual CTA + dispo teaser)
// =============================================================================
function renderHeadlinePanel() {
  if (!window.__strResults) return;
  const banner = document.getElementById('headline_panel');
  if (!banner) return;

  const r = window.__strResults;
  const c = r.common;
  const std = r.standard;
  const dvn = r.donovan;
  const elig = c.eligibility;

  // Compute headline numbers
  const yr1Benefit = c.year1NetCashBenefit;
  const totalProfitStd = std.totalProfit;
  const totalProfitDvn = dvn.totalProfit;
  const strategySavings = std.totalSaleTaxFed - dvn.totalSaleTaxFed;
  const dispoTaxStd = std.totalSaleTaxFed;
  const cumFedSavings = c.cumFedTaxSavings;

  // CTA logic — choose appropriate call-to-action
  let ctaTitle, ctaBody, ctaClass;
  if (elig.status === 'likely-ineligible') {
    ctaTitle = 'Engage counsel to evaluate eligibility alternatives';
    ctaBody = 'The §469 eligibility analysis indicates the strategy may not be available as proposed. Donovan Legal can evaluate whether structural changes (activity classification, hours documentation, REPS qualification, entity structuring) can preserve the benefit.';
    ctaClass = 'cta-red';
  } else if (elig.status === 'marginal') {
    ctaTitle = 'Engage counsel to develop the eligibility factual record';
    ctaBody = 'The eligibility analysis is marginal. Whether the §1.469-1T(e)(3)(ii) STR exception applies and whether material participation is established depends on facts that have not been fully developed. Donovan Legal works with taxpayers and CPAs to build a defensible factual record for the position.';
    ctaClass = 'cta-amber';
  } else {
    ctaTitle = 'Engage counsel to validate inputs and implement the strategy';
    ctaBody = 'The mechanical analysis indicates the strategy may produce material benefits. Translating that potential into realized tax savings requires a cost segregation study, proper activity-level documentation, eligible §469 hours, and disposition planning to minimize recapture. Donovan Legal coordinates each component.';
    ctaClass = 'cta-green';
  }

  // Build headline cards. Three metrics across, then CTA below.
  const html = `
    <div class="headline-panel">
      <div class="headline-grid">
        <div class="headline-card">
          <div class="headline-label">Year 1 Net Cash Benefit</div>
          <div class="headline-value">${fmt(yr1Benefit)}</div>
          <div class="headline-sub">Operating cash flow + federal tax savings, year 1</div>
        </div>
        <div class="headline-card">
          <div class="headline-label">Cumulative Operating Tax Savings</div>
          <div class="headline-value">${fmt(cumFedSavings)}</div>
          <div class="headline-sub">Federal tax savings across the ${c.saleYear}-year hold from operating losses</div>
        </div>
        <div class="headline-card">
          <div class="headline-label">Disposition Tax Exposure</div>
          <div class="headline-value">${fmt(dispoTaxStd)}</div>
          <div class="headline-sub">Federal sale tax (Standard); ${strategySavings > 0 ? 'strategy reduces by ' + fmt(strategySavings) : 'strategy benefit minimal'}</div>
        </div>
      </div>
      <div class="headline-cta ${ctaClass}">
        <div class="headline-cta-title">${ctaTitle}</div>
        <div class="headline-cta-body">${ctaBody}</div>
        <div class="headline-cta-action">
          <a href="contact.html" class="headline-cta-btn">Contact Donovan Legal &rarr;</a>
        </div>
      </div>
    </div>
  `;
  banner.innerHTML = html;
}

// Hook into renderForMode
const _origRenderForModeC1 = renderForMode;
renderForMode = function(mode) {
  _origRenderForModeC1(mode);
  renderHeadlinePanel();
};


// =============================================================================
// BATCH C.2 — STRATEGY COMPARISON: STR vs LTR vs HYBRID (STR Y1 → LTR thereafter)
// =============================================================================

// Compute the three strategies and return comparison metrics.
// STR = current STR model (uses gathered inputs as-is)
// LTR = long-term rental: losses are PASSIVE under §469 (suspended; no W-2 offset
//   unless REPS); typically lower gross rents and lower opex; lower cost seg aggressiveness
// HYBRID = STR Year 1 (claim bonus depreciation loss against W-2), then convert to LTR
function computeStrategyComparison() {
  const inputs = gatherInputsFromDOM();
  if (!validateInputs(inputs, true)) return null;

  // ---- STR scenario: use inputs as-is ----
  const strResult = computeScenario(inputs);

  // ---- LTR scenario ----
  // Key adjustments:
  // - Gross rents ~35% lower for LTR (annualized lease vs nightly rate spread)
  // - OpEx ratio ~10pp lower (no cleaning, turnover, dynamic pricing software, much lower management)
  // - Effective cap rate roughly similar to STR (NOI/price ratio) because both rev & cost drop
  // - Losses become PASSIVE under §469 — suspended unless REPS
  // - We model this by ZEROING federal tax savings during the hold period
  //   (passive losses can't offset W-2/active income); they release at disposition.
  // - At sale, suspended losses offset the gain, reducing net sale tax
  const ltrInputs = Object.assign({}, inputs);
  if (inputs.noiMethod === 'caprate') {
    // Reduce effective cap rate slightly (LTR yields typically ~75-80% of STR yields)
    ltrInputs.capRate = inputs.capRate * 0.80;
    ltrInputs.year1NOI = inputs.purchasePrice * ltrInputs.capRate;
  } else {
    ltrInputs.grossRents = inputs.grossRents * 0.65;  // LTR rents ~65% of STR
    ltrInputs.opexRatio = Math.max(0.20, inputs.opexRatio - 0.10);  // 10pp lower opex
    ltrInputs.year1NOI = ltrInputs.grossRents * (1 - ltrInputs.opexRatio);
  }
  // Force §469 ineligibility for LTR (passive activity) UNLESS REPS
  // Override eligibility by setting rental period > 7 days and clearing material participation
  if (inputs.reps !== 'yes' && inputs.reps !== 'spouse') {
    // Mark as ineligible — losses can't offset W-2 during hold
    ltrInputs._ltr_passive = true;
  }

  let ltrResult = null;
  try {
    ltrResult = computeScenario(ltrInputs);
    if (ltrInputs._ltr_passive) {
      // PASSIVE TREATMENT: Zero out federal/state operating tax savings (suspended).
      // At sale, suspended losses release and offset the gain.
      const suspendedLosses = ltrResult.common.cumFedTaxSavings;
      ltrResult.common.cumFedTaxSavings = 0;
      ltrResult.common.cumStateTaxSavings = 0;
      ltrResult.common.year1FedTaxSavings = 0;
      ltrResult.common.year1NetCashBenefit = ltrResult.common.year1OpCashFlow;
      // Recompute total profit: cum op CF + net sale proceeds (no operating tax savings, but recapture is offset by released suspended losses)
      // For simplicity: reduce sale tax by the suspended losses (capped at zero)
      // The suspended loss benefit at disposition is roughly: suspendedLosses (which was a positive value, the tax savings that would have been claimed)
      const releaseBenefit = suspendedLosses;
      ltrResult.standard.totalSaleTaxFed = Math.max(0, ltrResult.standard.totalSaleTaxFed - releaseBenefit);
      ltrResult.donovan.totalSaleTaxFed = Math.max(0, ltrResult.donovan.totalSaleTaxFed - releaseBenefit);
      // Recompute totalProfit and IRR by walking yearly cash flows again with no tax savings
      let cumCFAT = 0;
      ltrResult.common.yearlyResults.forEach(y => {
        y.fedTaxSavings = 0;
        y.stateTaxSavings = 0;
        y.cashFlowAfterTax = y.noi - y.interest - y.principal;
        cumCFAT += y.cashFlowAfterTax;
      });
      ltrResult.common.cashFlowAfterTax = cumCFAT;
      // Net sale proceeds recompute
      const grossSaleStd = ltrResult.common.netSalePrice - ltrResult.common.mortgagePayoff - ltrResult.standard.totalSaleTaxFed - (ltrResult.common.stateSaleTax || 0);
      ltrResult.standard.netSaleProceeds = grossSaleStd;
      ltrResult.standard.totalProfit = cumCFAT + grossSaleStd - (inputs.downPayment + inputs.closingCosts);
      // Recompute IRR with new cash flows
      const cf = [-(inputs.downPayment + inputs.closingCosts)];
      ltrResult.common.yearlyResults.forEach((y, idx) => {
        let v = y.cashFlowAfterTax;
        if (idx === ltrResult.common.yearlyResults.length - 1) v += grossSaleStd;
        cf.push(v);
      });
      ltrResult.standard.irr = computeIRR(cf);
    }
  } catch (e) {
    console.warn('LTR scenario calc failed:', e);
  }

  // ---- HYBRID scenario: STR Year 1, LTR Year 2+ ----
  // Year 1 captures the full STR loss (bonus dep + active treatment if MP).
  // Year 2+ revert to LTR: smaller NOI, passive treatment (no W-2 offset).
  // We approximate by:
  // - Use STR Year 1 result (full tax savings on Year 1 loss including bonus dep)
  // - Use LTR Year 2-N results (suspended losses, smaller NOI)
  // - Sale year: combine federal recapture with released suspended losses
  let hybridResult = null;
  try {
    // Start from the STR result
    hybridResult = computeScenario(inputs);

    // Compute Year 2-N as LTR. We use the ltrResult yearly data starting Year 2.
    if (ltrResult) {
      const strYears = strResult.common.yearlyResults;
      const ltrYears = ltrResult.common.yearlyResults;

      // Build hybrid yearly: Year 1 = STR, Year 2+ = LTR
      const hybridYears = [strYears[0]];
      for (let y = 1; y < strYears.length; y++) {
        if (ltrYears[y]) hybridYears.push(ltrYears[y]);
        else hybridYears.push(strYears[y]);
      }
      hybridResult.common.yearlyResults = hybridYears;

      // Recompute cumulatives
      let cumOpCF = 0, cumFedSave = 0, cumStateSave = 0, cumCFAT = 0;
      hybridYears.forEach(y => {
        cumOpCF += (y.noi - y.interest - y.principal);
        cumFedSave += y.fedTaxSavings || 0;
        cumStateSave += y.stateTaxSavings || 0;
        cumCFAT += y.cashFlowAfterTax || 0;
      });
      hybridResult.common.cumFedTaxSavings = cumFedSave;
      hybridResult.common.cumStateTaxSavings = cumStateSave;
      hybridResult.common.cashFlowAfterTax = cumCFAT;

      // Recompute total profit and IRR
      // Sale proceeds same as STR (sale tax treatment unchanged; depreciation is depreciation)
      const initInv = inputs.downPayment + inputs.closingCosts;
      hybridResult.standard.totalProfit = cumCFAT + hybridResult.standard.netSaleProceeds - initInv;

      // IRR
      const cf = [-initInv];
      hybridYears.forEach((y, idx) => {
        let v = y.cashFlowAfterTax || 0;
        if (idx === hybridYears.length - 1) v += hybridResult.standard.netSaleProceeds;
        cf.push(v);
      });
      hybridResult.standard.irr = computeIRR(cf);
    }
  } catch (e) {
    console.warn('Hybrid scenario calc failed:', e);
  }

  return { str: strResult, ltr: ltrResult, hybrid: hybridResult };
}

// IRR helper (bisection)
function computeIRR(cfs) {
  let lo = -0.99, hi = 10.0;
  for (let i = 0; i < 300; i++) {
    const mid = (lo + hi) / 2;
    const v = cfs.reduce((s, c, t) => s + c / Math.pow(1 + mid, t), 0);
    if (Math.abs(v) < 1) return mid;
    if (v > 0) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

// Render the comparison table
function renderStrategyComparison() {
  const panel = document.getElementById('strategy_comparison_panel');
  if (!panel) return;
  const data = computeStrategyComparison();
  if (!data) { panel.innerHTML = ''; return; }

  const str = data.str, ltr = data.ltr, hybrid = data.hybrid;
  const inputs = gatherInputsFromDOM();
  const initInv = inputs.downPayment + inputs.closingCosts;

  function row(label, strV, ltrV, hybridV, isPercent) {
    const f = isPercent
      ? v => v === null || v === undefined || isNaN(v) ? 'N/A' : (v * 100).toFixed(2) + '%'
      : v => v === null || v === undefined || isNaN(v) ? 'N/A' : fmt(v);
    return `
      <tr>
        <td class="sc-label">${label}</td>
        <td class="sc-value">${f(strV)}</td>
        <td class="sc-value">${f(ltrV)}</td>
        <td class="sc-value">${f(hybridV)}</td>
      </tr>
    `;
  }

  const html = `
    <div class="strategy-comparison-panel">
      <div class="sc-label-row">Strategy Comparison</div>
      <div class="sc-title">STR vs. LTR vs. Hybrid (STR Year 1 → LTR Year 2+)</div>
      <div class="sc-intro">
        Side-by-side comparison of three operating strategies for the same property. <strong>STR</strong> assumes &sect;&nbsp;1.469-1T(e)(3)(ii) qualification with material participation, claiming the full Year 1 cost-seg / bonus depreciation loss against W-2 income. <strong>LTR</strong> assumes long-term rental with passive activity treatment; losses suspend during the hold and release at disposition (unless REPS is established). <strong>Hybrid</strong> claims STR treatment for Year 1 only (capturing the bonus depreciation deduction against ordinary income), then converts to LTR for the balance of the hold &mdash; a common practice for taxpayers who plan to step back from active management after Year 1.
      </div>

      <table class="strategy-comparison-table">
        <thead>
          <tr>
            <th></th>
            <th>STR</th>
            <th>LTR</th>
            <th>Hybrid</th>
          </tr>
        </thead>
        <tbody>
          ${row('Year 1 NOI', str.common.yearlyResults[0].noi, ltr ? ltr.common.yearlyResults[0].noi : null, hybrid ? hybrid.common.yearlyResults[0].noi : null)}
          ${row('Year 1 Fed Tax Savings', str.common.year1FedTaxSavings, ltr ? ltr.common.year1FedTaxSavings : null, hybrid ? hybrid.common.year1FedTaxSavings : null)}
          ${row('Year 1 Net Cash Benefit', str.common.year1NetCashBenefit, ltr ? ltr.common.year1NetCashBenefit : null, hybrid ? hybrid.common.year1NetCashBenefit : null)}
          ${row('Cum. Operating Tax Savings', str.common.cumFedTaxSavings, ltr ? ltr.common.cumFedTaxSavings : null, hybrid ? hybrid.common.cumFedTaxSavings : null)}
          ${row('Net Sale Proceeds (Std)', str.standard.netSaleProceeds, ltr ? ltr.standard.netSaleProceeds : null, hybrid ? hybrid.standard.netSaleProceeds : null)}
          ${row('Total After-Tax Profit', str.standard.totalProfit, ltr ? ltr.standard.totalProfit : null, hybrid ? hybrid.standard.totalProfit : null)}
          ${row('Profit as % of Capital', str.standard.totalProfit / initInv, ltr ? ltr.standard.totalProfit / initInv : null, hybrid ? hybrid.standard.totalProfit / initInv : null, true)}
          ${row('After-Tax IRR', str.standard.irr, ltr ? ltr.standard.irr : null, hybrid ? hybrid.standard.irr : null, true)}
        </tbody>
      </table>

      <div class="sc-note">
        <strong>Reading the comparison.</strong> LTR economics are computed using ~80% of the STR cap rate (or 65% of gross rents with a 10pp lower opex ratio, reflecting that long-term tenants pay less rent but management costs are also materially lower). LTR losses are treated as <strong>passive</strong> under &sect;&nbsp;469; absent REPS, suspended losses cannot offset W-2 wages during the hold and instead release at disposition to offset the gain. The hybrid scenario models claiming STR treatment only in Year 1 (capturing the bonus depreciation deduction against ordinary income when the taxpayer can establish material participation that year), then reverting to LTR. This is a fact-specific strategy; whether activity has actually converted from STR to LTR is determined under the &sect;&nbsp;469 regulations and the surrounding facts and circumstances.
      </div>
    </div>
  `;
  panel.innerHTML = html;
}

// Hook into renderForMode
const _origRenderForModeC2 = renderForMode;
renderForMode = function(mode) {
  _origRenderForModeC2(mode);
  renderStrategyComparison();
};
