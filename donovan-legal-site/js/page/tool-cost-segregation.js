// =============================================================================
// COMPREHENSIVE COST SEGREGATION CALCULATOR — v2
// Adds: month placed in service, federal/state §168(k) conformity, DLTS toggle
// =============================================================================

const PROPERTY_TYPES = [
  { key: 'res_str',     icon: '\u{1F3D6}\u{FE0F}', name: 'Residential STR',  low: 20, high: 30, mid: 25, isResidential: true,  allocation: { yr5: 0.55, yr7: 0.05, yr15: 0.40 } },
  { key: 'res_ltr',     icon: '\u{1F3E1}',          name: 'Residential LTR',  low: 15, high: 25, mid: 20, isResidential: true,  allocation: { yr5: 0.50, yr7: 0.05, yr15: 0.45 } },
  { key: 'office',      icon: '\u{1F3E2}',          name: 'Office',           low: 25, high: 35, mid: 30, isResidential: false, allocation: { yr5: 0.40, yr7: 0.10, yr15: 0.50 } },
  { key: 'retail',      icon: '\u{1F6CD}\u{FE0F}', name: 'Retail',           low: 30, high: 40, mid: 35, isResidential: false, allocation: { yr5: 0.50, yr7: 0.05, yr15: 0.45 } },
  { key: 'industrial',  icon: '\u{1F3ED}',          name: 'Industrial',       low: 35, high: 45, mid: 40, isResidential: false, allocation: { yr5: 0.45, yr7: 0.05, yr15: 0.50 } },
  { key: 'hospitality', icon: '\u{1F3E8}',          name: 'Hospitality',      low: 25, high: 35, mid: 30, isResidential: false, allocation: { yr5: 0.55, yr7: 0.10, yr15: 0.35 } },
  { key: 'medical',     icon: '\u{1F3E5}',          name: 'Medical',          low: 35, high: 50, mid: 42, isResidential: false, allocation: { yr5: 0.60, yr7: 0.10, yr15: 0.30 } },
  { key: 'storage',     icon: '\u{1F6E2}\u{FE0F}', name: 'Self-Storage',     low: 35, high: 45, mid: 40, isResidential: false, allocation: { yr5: 0.25, yr7: 0.05, yr15: 0.70 } },
  { key: 'restaurant',  icon: '\u{1F37D}\u{FE0F}', name: 'Restaurant',       low: 35, high: 45, mid: 40, isResidential: false, allocation: { yr5: 0.60, yr7: 0.10, yr15: 0.30 } }
];

let SELECTED_PROPERTY_TYPE = 'res_str';

// State §168(k) conformity (May 2026): 8 states conform fully, 33 decouple, 9 have no income tax.
const STATES_168K = {
  AL: {name:'Alabama', conforms:true},
  AK: {name:'Alaska', conforms:'no_tax'},
  AZ: {name:'Arizona', conforms:false},
  AR: {name:'Arkansas', conforms:false},
  CA: {name:'California', conforms:false},
  CO: {name:'Colorado', conforms:true},
  CT: {name:'Connecticut', conforms:false},
  DE: {name:'Delaware', conforms:false},
  FL: {name:'Florida', conforms:'no_tax'},
  GA: {name:'Georgia', conforms:false},
  HI: {name:'Hawaii', conforms:false},
  ID: {name:'Idaho', conforms:false},
  IL: {name:'Illinois', conforms:false},
  IN: {name:'Indiana', conforms:false},
  IA: {name:'Iowa', conforms:false},
  KS: {name:'Kansas', conforms:true},
  KY: {name:'Kentucky', conforms:false},
  LA: {name:'Louisiana', conforms:true},
  ME: {name:'Maine', conforms:false},
  MD: {name:'Maryland', conforms:false},
  MA: {name:'Massachusetts', conforms:false},
  MI: {name:'Michigan', conforms:false},
  MN: {name:'Minnesota', conforms:false},
  MS: {name:'Mississippi', conforms:false},
  MO: {name:'Missouri', conforms:true},
  MT: {name:'Montana', conforms:true},
  NE: {name:'Nebraska', conforms:false},
  NV: {name:'Nevada', conforms:'no_tax'},
  NH: {name:'New Hampshire', conforms:'no_tax'},
  NJ: {name:'New Jersey', conforms:false},
  NM: {name:'New Mexico', conforms:false},
  NY: {name:'New York', conforms:false},
  NC: {name:'North Carolina', conforms:false},
  ND: {name:'North Dakota', conforms:false},
  OH: {name:'Ohio', conforms:false},
  OK: {name:'Oklahoma', conforms:true},
  OR: {name:'Oregon', conforms:false},
  PA: {name:'Pennsylvania', conforms:false},
  RI: {name:'Rhode Island', conforms:false},
  SC: {name:'South Carolina', conforms:false},
  SD: {name:'South Dakota', conforms:'no_tax'},
  TN: {name:'Tennessee', conforms:'no_tax'},
  TX: {name:'Texas', conforms:'no_tax'},
  UT: {name:'Utah', conforms:true},
  VT: {name:'Vermont', conforms:false},
  VA: {name:'Virginia', conforms:false},
  WA: {name:'Washington', conforms:'no_tax'},
  WV: {name:'West Virginia', conforms:false},
  WI: {name:'Wisconsin', conforms:false},
  WY: {name:'Wyoming', conforms:'no_tax'},
  DC: {name:'District of Columbia', conforms:false}
};

function populateStatesCS() {
  const sel = document.getElementById('state_select_cs');
  if (!sel) return;
  const keys = Object.keys(STATES_168K).sort();
  keys.forEach(k => {
    const o = document.createElement('option');
    o.value = k;
    o.textContent = STATES_168K[k].name;
    sel.appendChild(o);
  });
  sel.value = 'FL';
  sel.addEventListener('change', updateStateConformNote);
  updateStateConformNote();
}

function updateStateConformNote() {
  const sel = document.getElementById('state_select_cs');
  const note = document.getElementById('state_conform_note');
  if (!sel || !note) return;
  const code = sel.value;
  const s = STATES_168K[code];
  if (!s) return;
  let html = '';
  if (s.conforms === 'no_tax') {
    html = `<strong>${s.name}.</strong> No state income tax. No state-level depreciation analysis is needed; the state benefit on cost segregation is $0 regardless of bonus depreciation conformity.`;
  } else if (s.conforms === true) {
    html = `<strong>${s.name} conforms to &sect;&nbsp;168(k).</strong> ${s.name} fully recognizes federal bonus depreciation. State and federal Year-1 deductions are identical on the reclassified portion. ${s.name} is one of only 8 states with full conformity (the others: Alabama, Colorado, Kansas, Louisiana, Missouri, Montana, Oklahoma, Utah).`;
  } else {
    html = `<strong>${s.name} decouples from &sect;&nbsp;168(k).</strong> ${s.name} requires add-back of federal bonus depreciation; the reclassified portion is depreciated for state purposes under regular MACRS without bonus. The state Year-1 deduction will be materially smaller than the federal deduction; over the property's life the totals equalize, but for high-bracket residents this front-loads federal benefit and back-loads state benefit. The tool computes federal and state benefit separately below.`;
  }
  note.innerHTML = html;
}

function populatePropertyTypes() {
  const grid = document.getElementById('property_type_grid');
  if (!grid) return;
  grid.innerHTML = '';
  PROPERTY_TYPES.forEach(pt => {
    const card = document.createElement('div');
    card.className = 'pt-card' + (pt.key === SELECTED_PROPERTY_TYPE ? ' active' : '');
    card.setAttribute('data-key', pt.key);
    card.innerHTML = `
      <div class="pt-card-icon">${pt.icon}</div>
      <div class="pt-card-name">${pt.name}</div>
      <div class="pt-card-range">${pt.low}\u2013${pt.high}% reclass</div>
    `;
    card.addEventListener('click', function() {
      const k = this.getAttribute('data-key');
      SELECTED_PROPERTY_TYPE = k;
      document.querySelectorAll('.pt-card').forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      const ptObj = PROPERTY_TYPES.find(p => p.key === k);
      if (ptObj) {
        document.getElementById('reclass_pct').value = ptObj.mid;
      }
    });
    grid.appendChild(card);
  });
}

function getValue(id, def=0) {
  const el = document.getElementById(id);
  if (!el) return def;
  // Use the formatter's value reader if available (strips $/,/% formatting)
  if (window.DonovanInputFormatter) {
    const dl = DonovanInputFormatter.getValue(el, def);
    return dl;
  }
  const v = el.value;
  if (v === '' || v == null) return def;
  const n = parseFloat(v);
  return isNaN(n) ? def : n;
}

function fmtMoney(n) {
  if (n == null || isNaN(n)) return '$0';
  const neg = n < 0;
  const abs = Math.abs(Math.round(n));
  return (neg ? '-$' : '$') + abs.toLocaleString();
}

function fmtPct(n) {
  if (n == null || isNaN(n)) return 'N/A';
  return n.toFixed(2) + '%';
}

// MACRS Year-1 factors (half-year convention; 200% DB for 5/7-year; 150% DB for 15-year)
const MACRS_Y1 = { yr5: 0.20, yr7: 0.1429, yr15: 0.05 };
const MACRS_Y2 = { yr5: 0.32, yr7: 0.2449, yr15: 0.095 };
const MACRS_Y3 = { yr5: 0.192, yr7: 0.1749, yr15: 0.0855 };
const MACRS_Y4 = { yr5: 0.1152, yr7: 0.1249, yr15: 0.077 };
const MACRS_Y5 = { yr5: 0.1152, yr7: 0.0893, yr15: 0.0693 };

// Mid-month Year-1 factor for residential (27.5-yr) and nonresidential (39-yr) real property.
// Formula: (12 - month + 0.5) / 12 / recoveryYears
function midMonthY1(month, isResidential) {
  const recovery = isResidential ? 27.5 : 39;
  return ((12 - month + 0.5) / 12) / recovery;
}

// =============================================================================
// CORE CALCULATION ENGINE
// Returns a result object for a given reclass percentage (used for both
// conservative and DLTS-aggressive runs)
// =============================================================================
function runCostSegCalc(params) {
  const {
    purchasePrice, landPct, reclassPct, ptObj,
    bonusRate, marginalRate, stateRate, stateConforms,
    monthPIS, studyCost
  } = params;

  const isResidential = ptObj.isResidential;
  const recovery = isResidential ? 27.5 : 39;

  // Basis allocation
  const landValue = purchasePrice * landPct;
  const depreciableBasis = purchasePrice - landValue;
  const reclassDollars = purchasePrice * reclassPct;
  const remainingBuilding = Math.max(0, depreciableBasis - reclassDollars);

  // Reclass allocation
  const alloc = ptObj.allocation;
  const yr5Dollars = reclassDollars * alloc.yr5;
  const yr7Dollars = reclassDollars * alloc.yr7;
  const yr15Dollars = reclassDollars * alloc.yr15;

  // Mid-month Year-1 factor for shell
  const shellY1Factor = midMonthY1(monthPIS, isResidential);
  const shellY1 = remainingBuilding * shellY1Factor;

  // ===== FEDERAL Year 1 =====
  // Bonus on reclass
  const bonus5 = yr5Dollars * bonusRate;
  const bonus7 = yr7Dollars * bonusRate;
  const bonus15 = yr15Dollars * bonusRate;
  const totalBonusFed = bonus5 + bonus7 + bonus15;
  // Non-bonused MACRS Y1
  const nonBonus5 = yr5Dollars - bonus5;
  const nonBonus7 = yr7Dollars - bonus7;
  const nonBonus15 = yr15Dollars - bonus15;
  const macrsY1Fed = nonBonus5 * MACRS_Y1.yr5 + nonBonus7 * MACRS_Y1.yr7 + nonBonus15 * MACRS_Y1.yr15;
  const fedY1 = totalBonusFed + macrsY1Fed + shellY1;

  // ===== STATE Year 1 =====
  // If conforming: same as federal
  // If non-conforming or no tax: bonus added back; regular MACRS on full reclass; shell same
  let stateY1;
  if (stateConforms === true) {
    stateY1 = fedY1;
  } else {
    // No bonus at state level — full reclass goes through regular MACRS Y1
    const stateMacrsY1 = yr5Dollars * MACRS_Y1.yr5 + yr7Dollars * MACRS_Y1.yr7 + yr15Dollars * MACRS_Y1.yr15;
    stateY1 = stateMacrsY1 + shellY1;
  }

  // ===== Straight-line baseline (no cost seg) =====
  // Same federal and state: full depreciable basis treated as 27.5/39-year real property, mid-month
  const slY1 = depreciableBasis * shellY1Factor;

  // ===== Incremental over SL =====
  const fedIncremental = fedY1 - slY1;
  const stateIncremental = stateY1 - slY1;

  // ===== Tax benefit =====
  const fedTaxBenefit = fedIncremental * marginalRate;
  const stateTaxBenefit = stateConforms === 'no_tax' ? 0 : stateIncremental * stateRate;
  const totalTaxBenefit = fedTaxBenefit + stateTaxBenefit;
  const netY1Benefit = totalTaxBenefit - studyCost;
  const roiPct = studyCost > 0 ? ((totalTaxBenefit - studyCost) / studyCost * 100) : 0;

  // ===== Multi-year schedule (federal basis) =====
  // For years 2-5, building shell depreciates at full annual rate (1/recovery)
  // Non-bonused reclass continues on regular MACRS
  const annualShell = remainingBuilding / recovery;
  const schedule = [
    { year: 1, year5: macrsY1Fed > 0 ? nonBonus5 * MACRS_Y1.yr5 + bonus5 : bonus5,
                year7: bonus7 + nonBonus7 * MACRS_Y1.yr7,
                year15: bonus15 + nonBonus15 * MACRS_Y1.yr15,
                bldg: shellY1 },
    { year: 2, year5: nonBonus5 * MACRS_Y2.yr5, year7: nonBonus7 * MACRS_Y2.yr7, year15: nonBonus15 * MACRS_Y2.yr15, bldg: annualShell },
    { year: 3, year5: nonBonus5 * MACRS_Y3.yr5, year7: nonBonus7 * MACRS_Y3.yr7, year15: nonBonus15 * MACRS_Y3.yr15, bldg: annualShell },
    { year: 4, year5: nonBonus5 * MACRS_Y4.yr5, year7: nonBonus7 * MACRS_Y4.yr7, year15: nonBonus15 * MACRS_Y4.yr15, bldg: annualShell },
    { year: 5, year5: nonBonus5 * MACRS_Y5.yr5, year7: nonBonus7 * MACRS_Y5.yr7, year15: nonBonus15 * MACRS_Y5.yr15, bldg: annualShell }
  ];
  const slPerYear = depreciableBasis / recovery;
  let cumCS = 0, cumSL = 0;
  schedule.forEach(r => {
    r.total = r.year5 + r.year7 + r.year15 + r.bldg;
    cumCS += r.total;
    if (r.year === 1) {
      cumSL += slY1;  // partial Year 1
    } else {
      cumSL += slPerYear;
    }
    r.cumCS = cumCS;
    r.cumSL = cumSL;
    r.diff = r.total - (r.year === 1 ? slY1 : slPerYear);
    r.taxDiff = r.diff * (marginalRate + (stateConforms !== 'no_tax' ? stateRate : 0));
  });

  return {
    isResidential, recovery, landValue, depreciableBasis, reclassDollars, remainingBuilding,
    yr5Dollars, yr7Dollars, yr15Dollars, bonus5, bonus7, bonus15, totalBonusFed,
    nonBonus5, nonBonus7, nonBonus15, macrsY1Fed, shellY1Factor, shellY1,
    fedY1, stateY1, slY1,
    fedIncremental, stateIncremental,
    fedTaxBenefit, stateTaxBenefit, totalTaxBenefit, netY1Benefit, roiPct,
    schedule, slPerYear, annualShell, alloc
  };
}

// =============================================================================
// MAIN CALCULATE FUNCTION
// =============================================================================
function calculateCostSeg() {
  const purchasePrice = getValue('purchase_price');
  const landPct = getValue('land_pct', 20) / 100;
  const reclassPct = getValue('reclass_pct') / 100;
  const bonusRate = getValue('bonus_rate', 100) / 100;
  const marginalRate = getValue('marginal_rate_cs', 37) / 100;
  const stateRate = getValue('state_rate_cs', 5) / 100;
  const studyCost = getValue('study_cost', 8000);
  const isLookback = (document.getElementById('lookback') || {}).value === 'yes';
  const monthPIS = parseInt((document.getElementById('placed_in_service_month') || {}).value || '1', 10);
  const stateCode = (document.getElementById('state_select_cs') || {}).value || 'FL';
  const stateConforms = STATES_168K[stateCode].conforms;
  const applyDLTS = (document.getElementById('apply_dlts') || {}).value === 'yes';

  if (purchasePrice <= 0) {
    alert('Please enter the property purchase price.');
    return;
  }
  if (reclassPct <= 0) {
    alert('Please enter a reclassification percentage greater than zero.');
    return;
  }

  const ptObj = PROPERTY_TYPES.find(p => p.key === SELECTED_PROPERTY_TYPE) || PROPERTY_TYPES[0];
  if (reclassPct * purchasePrice > (1 - landPct) * purchasePrice) {
    alert('Reclass amount exceeds depreciable basis. Either reduce the reclass percentage, or reduce the land allocation.');
    return;
  }

  // Standard (conservative) calculation
  const standardResult = runCostSegCalc({
    purchasePrice, landPct, reclassPct, ptObj,
    bonusRate, marginalRate, stateRate, stateConforms,
    monthPIS, studyCost
  });

  // DLTS calculation: uses high end of the property type's reclass range
  // The high-end reclass reflects more aggressive engineering-and-tax study practices
  let dltsResult = null;
  if (applyDLTS) {
    const dltsReclassPct = ptObj.high / 100;  // High end of typical range
    dltsResult = runCostSegCalc({
      purchasePrice, landPct, reclassPct: dltsReclassPct, ptObj,
      bonusRate, marginalRate, stateRate, stateConforms,
      monthPIS, studyCost
    });
  }

  renderResults(standardResult, dltsResult, {
    monthPIS, stateCode, stateConforms, isLookback, applyDLTS,
    marginalRate, stateRate, ptObj, reclassPct, bonusRate
  });

  const panel = document.getElementById('results');
  panel.classList.add('show');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =============================================================================
// RENDER RESULTS
// =============================================================================
function renderResults(r, dlts, ctx) {
  const { monthPIS, stateCode, stateConforms, isLookback, applyDLTS, marginalRate, stateRate, ptObj, reclassPct, bonusRate } = ctx;
  const monthNames = ['','January','February','March','April','May','June','July','August','September','October','November','December'];
  const stateName = STATES_168K[stateCode].name;

  // Headline shows DLTS if enabled, else standard
  const headlineResult = applyDLTS && dlts ? dlts : r;
  const headlineLabel = applyDLTS && dlts ? 'Year 1 Tax Benefit — With Donovan Legal Tax Strategy' : 'Year 1 Tax Benefit (Federal + State, Net of Study Cost)';

  const lookbackNote = isLookback ? `
    <div class="info-card warn">
      <strong>Look-back study:</strong> Property placed in service in a prior year. File Form 3115 (DCN 7) with the current year's return to claim the cumulative &sect;&nbsp;481(a) catch-up of ${fmtMoney(headlineResult.fedIncremental)} (federal incremental over straight-line) in the current year without amending prior returns.
    </div>` : '';

  const shellPct = (r.shellY1Factor * 100).toFixed(3);
  const monthNote = `Mid-month Year-1 factor for ${monthNames[monthPIS]} placement on ${r.isResidential ? '27.5-year residential' : '39-year nonresidential'} real property: ${shellPct}% of shell basis.`;

  let stateBenefitNote;
  if (stateConforms === 'no_tax') {
    stateBenefitNote = `<strong>${stateName}</strong> has no state income tax. State Year-1 benefit: $0.`;
  } else if (stateConforms === true) {
    stateBenefitNote = `<strong>${stateName}</strong> conforms to &sect;&nbsp;168(k). State Year-1 incremental deduction equals federal: ${fmtMoney(r.stateIncremental)}.`;
  } else {
    stateBenefitNote = `<strong>${stateName}</strong> decouples from &sect;&nbsp;168(k). State Year-1 incremental deduction (${fmtMoney(r.stateIncremental)}) is materially less than federal (${fmtMoney(r.fedIncremental)}) because bonus depreciation is added back at the state level. State benefit catches up over the remaining MACRS life.`;
  }

  // ----- DLTS comparison panel -----
  let dltsPanel = '';
  if (applyDLTS && dlts) {
    const dltsAddedFed = dlts.fedTaxBenefit - r.fedTaxBenefit;
    const dltsAddedState = dlts.stateTaxBenefit - r.stateTaxBenefit;
    const dltsAddedTotal = dlts.totalTaxBenefit - r.totalTaxBenefit;
    const dltsAddedNet = dlts.netY1Benefit - r.netY1Benefit;
    dltsPanel = `
      <div class="info-card" style="background: rgba(22,155,98,0.10); border-left: 4px solid #169B62; margin-top: 1.5rem;">
        <div style="font-family: 'Gotham Bold', sans-serif; color: #107a4d; font-size: 0.95rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase;">Donovan Legal Tax Strategy &mdash; Additional Year-1 Benefit</div>
        <p style="margin: 0 0 0.75rem 0;">Applying the firm's methodology produces a meaningfully larger Year-1 deduction and tax benefit than the standard analysis. The comparison:</p>
        <table class="macrs-table" style="margin: 0;">
          <thead>
            <tr><th></th><th style="text-align:right;">Standard Calculation</th><th style="text-align:right;">With Donovan Legal Tax Strategy</th><th style="text-align:right;">Additional Benefit</th></tr>
          </thead>
          <tbody>
            <tr><td>Reclass dollars</td><td class="num">${fmtMoney(r.reclassDollars)}</td><td class="num">${fmtMoney(dlts.reclassDollars)}</td><td class="num">${fmtMoney(dlts.reclassDollars - r.reclassDollars)}</td></tr>
            <tr><td>Federal Year-1 deduction (over SL)</td><td class="num">${fmtMoney(r.fedIncremental)}</td><td class="num">${fmtMoney(dlts.fedIncremental)}</td><td class="num">${fmtMoney(dlts.fedIncremental - r.fedIncremental)}</td></tr>
            <tr><td>State Year-1 deduction (over SL)</td><td class="num">${fmtMoney(r.stateIncremental)}</td><td class="num">${fmtMoney(dlts.stateIncremental)}</td><td class="num">${fmtMoney(dlts.stateIncremental - r.stateIncremental)}</td></tr>
            <tr><td>Federal tax savings @ ${(marginalRate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.fedTaxBenefit)}</td><td class="num">${fmtMoney(dlts.fedTaxBenefit)}</td><td class="num">${fmtMoney(dltsAddedFed)}</td></tr>
            <tr><td>State tax savings @ ${(stateRate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.stateTaxBenefit)}</td><td class="num">${fmtMoney(dlts.stateTaxBenefit)}</td><td class="num">${fmtMoney(dltsAddedState)}</td></tr>
            <tr class="total"><td>Total Year-1 tax benefit (gross)</td><td class="num">${fmtMoney(r.totalTaxBenefit)}</td><td class="num">${fmtMoney(dlts.totalTaxBenefit)}</td><td class="num">${fmtMoney(dltsAddedTotal)}</td></tr>
            <tr class="total"><td><strong>Net Year-1 benefit (after study cost)</strong></td><td class="num"><strong>${fmtMoney(r.netY1Benefit)}</strong></td><td class="num"><strong>${fmtMoney(dlts.netY1Benefit)}</strong></td><td class="num"><strong>${fmtMoney(dltsAddedNet)}</strong></td></tr>
          </tbody>
        </table>
        <p style="margin: 0.75rem 0 0 0; font-size: 0.85rem;">The methodology underlying the Donovan Legal Tax Strategy is reserved to the firm's engagement and is not disclosed in this tool. Realization of this benefit depends on specific facts and engagement-level review.</p>
      </div>
    `;
  }

  const html = `
    <div class="result-headline">
      <div class="result-headline-label">${headlineLabel}</div>
      <div class="result-headline-value">${fmtMoney(headlineResult.netY1Benefit)}</div>
      <div class="result-headline-grid">
        <div>
          <div class="result-headline-sub-label">FEDERAL TAX SAVINGS</div>
          <div class="result-headline-sub-value">${fmtMoney(headlineResult.fedTaxBenefit)}</div>
        </div>
        <div>
          <div class="result-headline-sub-label">STATE TAX SAVINGS</div>
          <div class="result-headline-sub-value">${fmtMoney(headlineResult.stateTaxBenefit)}</div>
        </div>
        <div>
          <div class="result-headline-sub-label">STUDY ROI</div>
          <div class="result-headline-sub-value">${headlineResult.roiPct.toFixed(0)}%</div>
        </div>
      </div>
    </div>

    ${lookbackNote}
    ${dltsPanel}

    <div class="info-card">
      <strong>Placed in service:</strong> ${monthNames[monthPIS]}. ${monthNote}
    </div>
    <div class="info-card">${stateBenefitNote}</div>

    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">A. Basis Allocation (Standard Calculation)</h4>
    <table class="macrs-table">
      <tr><td>Purchase price (total)</td><td class="num">${fmtMoney(r.depreciableBasis + r.landValue)}</td><td class="num">100.0%</td></tr>
      <tr><td>Less: land allocation</td><td class="num">(${fmtMoney(r.landValue)})</td><td class="num">${((r.landValue / (r.landValue + r.depreciableBasis))*100).toFixed(1)}%</td></tr>
      <tr class="total"><td>Depreciable basis</td><td class="num">${fmtMoney(r.depreciableBasis)}</td><td class="num">${((r.depreciableBasis / (r.landValue + r.depreciableBasis))*100).toFixed(1)}%</td></tr>
    </table>

    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">B. MACRS Reclassification Breakdown</h4>
    <table class="macrs-table">
      <thead>
        <tr><th>MACRS Category</th><th style="text-align:right;">Reclass $</th><th style="text-align:right;">% of Reclass</th><th style="text-align:right;">Bonus-Eligible (\u00a7 168(k))</th></tr>
      </thead>
      <tbody>
        <tr><td>5-year property (FF&amp;E, decorative items)</td><td class="num">${fmtMoney(r.yr5Dollars)}</td><td class="num">${(r.alloc.yr5*100).toFixed(0)}%</td><td class="num">${fmtMoney(r.bonus5)}</td></tr>
        <tr><td>7-year property (office furniture)</td><td class="num">${fmtMoney(r.yr7Dollars)}</td><td class="num">${(r.alloc.yr7*100).toFixed(0)}%</td><td class="num">${fmtMoney(r.bonus7)}</td></tr>
        <tr><td>15-year property (land improvements)</td><td class="num">${fmtMoney(r.yr15Dollars)}</td><td class="num">${(r.alloc.yr15*100).toFixed(0)}%</td><td class="num">${fmtMoney(r.bonus15)}</td></tr>
        <tr class="total"><td>Total reclassified</td><td class="num">${fmtMoney(r.reclassDollars)}</td><td class="num">100%</td><td class="num">${fmtMoney(r.totalBonusFed)}</td></tr>
        <tr><td>Remaining building shell (${r.isResidential ? '27.5' : '39'}-year SL)</td><td class="num">${fmtMoney(r.remainingBuilding)}</td><td class="num">&mdash;</td><td class="num">N/A</td></tr>
      </tbody>
    </table>
    <div style="font-size: 0.78rem; color: #6b6b6b; margin-top: 0.5rem;">Allocation across 5/7/15-year categories shown is the industry-typical breakdown for <strong>${ptObj.name}</strong>. The actual engineering-and-tax study will refine these percentages.</div>

    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">C. Federal vs. State Year-1 Deduction</h4>
    <table class="macrs-table">
      <thead>
        <tr><th>Component</th><th style="text-align:right;">Federal</th><th style="text-align:right;">State (${stateName})</th><th style="text-align:right;">Difference</th></tr>
      </thead>
      <tbody>
        <tr><td>Bonus depreciation on reclass (${(bonusRate*100).toFixed(0)}%)</td><td class="num">${fmtMoney(r.totalBonusFed)}</td><td class="num">${stateConforms === true ? fmtMoney(r.totalBonusFed) : '$0'}</td><td class="num">${fmtMoney(stateConforms === true ? 0 : -r.totalBonusFed)}</td></tr>
        <tr><td>MACRS Year-1 on non-bonus reclass</td><td class="num">${fmtMoney(r.macrsY1Fed)}</td><td class="num">${stateConforms === true ? fmtMoney(r.macrsY1Fed) : fmtMoney(r.yr5Dollars * MACRS_Y1.yr5 + r.yr7Dollars * MACRS_Y1.yr7 + r.yr15Dollars * MACRS_Y1.yr15)}</td><td class="num">${stateConforms === true ? '$0' : fmtMoney((r.yr5Dollars * MACRS_Y1.yr5 + r.yr7Dollars * MACRS_Y1.yr7 + r.yr15Dollars * MACRS_Y1.yr15) - r.macrsY1Fed)}</td></tr>
        <tr><td>Building shell mid-month Year-1 (${(r.shellY1Factor*100).toFixed(3)}%)</td><td class="num">${fmtMoney(r.shellY1)}</td><td class="num">${fmtMoney(r.shellY1)}</td><td class="num">$0</td></tr>
        <tr class="total"><td>Year-1 total deduction</td><td class="num">${fmtMoney(r.fedY1)}</td><td class="num">${fmtMoney(r.stateY1)}</td><td class="num">${fmtMoney(r.stateY1 - r.fedY1)}</td></tr>
        <tr><td>Straight-line baseline (no cost seg)</td><td class="num">${fmtMoney(r.slY1)}</td><td class="num">${fmtMoney(r.slY1)}</td><td class="num">$0</td></tr>
        <tr class="total"><td><strong>Incremental over straight-line</strong></td><td class="num"><strong>${fmtMoney(r.fedIncremental)}</strong></td><td class="num"><strong>${fmtMoney(r.stateIncremental)}</strong></td><td class="num"><strong>${fmtMoney(r.stateIncremental - r.fedIncremental)}</strong></td></tr>
      </tbody>
    </table>

    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">D. Year-1 Tax Benefit</h4>
    <table class="macrs-table">
      <tr><td>Federal tax savings (${(marginalRate*100).toFixed(1)}% &times; ${fmtMoney(r.fedIncremental)})</td><td class="num">${fmtMoney(r.fedTaxBenefit)}</td></tr>
      <tr><td>State tax savings ${stateConforms === 'no_tax' ? '(no state income tax)' : `(${(stateRate*100).toFixed(1)}% &times; ${fmtMoney(r.stateIncremental)})`}</td><td class="num">${fmtMoney(r.stateTaxBenefit)}</td></tr>
      <tr class="total"><td>Gross Year-1 tax savings</td><td class="num">${fmtMoney(r.totalTaxBenefit)}</td></tr>
      <tr><td>Less: cost segregation study fee</td><td class="num">(${fmtMoney(getValue('study_cost', 8000))})</td></tr>
      <tr class="total"><td><strong>Net Year-1 benefit</strong></td><td class="num"><strong>${fmtMoney(r.netY1Benefit)}</strong></td></tr>
      <tr><td>Study return on investment (ROI)</td><td class="num">${r.roiPct.toFixed(0)}%</td></tr>
    </table>

    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">E. Multi-Year Depreciation Schedule (Federal, Years 1&ndash;5)</h4>
    <table class="proj-table">
      <thead>
        <tr><th>Year</th><th>5-yr</th><th>7-yr</th><th>15-yr</th><th>Bldg Shell</th><th>Cost Seg Total</th><th>Straight-Line</th><th>Incremental</th></tr>
      </thead>
      <tbody>
        ${r.schedule.map(rr => `
        <tr>
          <td>Yr ${rr.year}</td>
          <td>${fmtMoney(rr.year5)}</td>
          <td>${fmtMoney(rr.year7)}</td>
          <td>${fmtMoney(rr.year15)}</td>
          <td>${fmtMoney(rr.bldg)}</td>
          <td><strong>${fmtMoney(rr.total)}</strong></td>
          <td>${fmtMoney(rr.year === 1 ? r.slY1 : r.slPerYear)}</td>
          <td>${fmtMoney(rr.diff)}</td>
        </tr>`).join('')}
        <tr class="total">
          <td>5-Yr Cumulative</td>
          <td colspan="4"></td>
          <td>${fmtMoney(r.schedule[4].cumCS)}</td>
          <td>${fmtMoney(r.schedule[4].cumSL)}</td>
          <td>${fmtMoney(r.schedule[4].cumCS - r.schedule[4].cumSL)}</td>
        </tr>
      </tbody>
    </table>
    <div style="font-size: 0.78rem; color: #6b6b6b; margin-top: 0.5rem;">Multi-year schedule shown on the federal basis. State schedule will differ for non-conforming states; over the full life of the property, federal and state cumulatives equalize, but the timing differs significantly.</div>

    <div class="info-card" style="background: rgba(22,155,98,0.06);">
      <strong>Time value of money note.</strong> The total lifetime depreciation deduction is the same under straight-line and cost segregation &mdash; the difference is timing. Cost segregation pulls deductions into earlier years, where the present-value benefit at the taxpayer's cost of capital can be substantial. The exact NPV depends on the hold period, discount rate, and sale-year recapture treatment &mdash; modeled in the comprehensive rental real estate tax strategy analyzer.
    </div>

    <div class="info-card warn">
      <strong>Recapture at sale.</strong> The reclassified portion (${fmtMoney(r.reclassDollars)}) is &sect;&nbsp;1245 personal property. On sale, accumulated depreciation on the reclassified portion is recaptured as <strong>ordinary income at the taxpayer's marginal rate</strong>, not at the &sect;&nbsp;1250 maximum 25% rate. The trade-off is mitigated by: (i) deferral via &sect;&nbsp;1031 exchange; (ii) elimination via &sect;&nbsp;1014 estate step-up; (iii) lower marginal rates at the time of sale; and (iv) the time-value-of-money advantage of accelerated deductions.
    </div>

    <div class="info-card">
      <strong>Form 3115 filing.</strong> ${isLookback ? 'For this look-back study, file Form 3115 (Application for Change in Accounting Method) under designated change number (DCN) 7 with the current year\'s return.' : 'For a current-year placed-in-service study, no Form 3115 is required &mdash; the cost-segregated depreciation method is adopted on the original return.'}
    </div>
  `;

  document.getElementById('results_body').innerHTML = html;
}

function resetCostSeg() {
  ['purchase_price'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('land_pct').value = '20';
  document.getElementById('placed_in_service_year').value = '2026';
  document.getElementById('placed_in_service_month').value = '1';
  document.getElementById('filing_status_cs').value = 'mfj';
  document.getElementById('reclass_pct').value = '25';
  document.getElementById('bonus_rate').value = '100';
  document.getElementById('marginal_rate_cs').value = '37';
  document.getElementById('state_rate_cs').value = '5';
  document.getElementById('state_select_cs').value = 'FL';
  document.getElementById('study_cost').value = '8000';
  document.getElementById('lookback').value = 'no';
  document.getElementById('apply_dlts').value = 'no';
  SELECTED_PROPERTY_TYPE = 'res_str';
  populatePropertyTypes();
  updateStateConformNote();
  document.getElementById('results').classList.remove('show');
}

document.addEventListener('DOMContentLoaded', function() {
  populatePropertyTypes();
  populateStatesCS();
});
