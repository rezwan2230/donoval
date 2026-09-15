/* § 1031 Like-Kind Exchange Calculator — JavaScript Engine
 * Donovan Legal PLLC
 * Last updated: May 2026 (Phase 4 — Drop-and-Swap / Swap-and-Drop)
 *
 * Architecture:
 *   - Four-tier ladder ('public' < 'gold' < 'platinum' < 'reserve') driven by
 *     window.__DONOVAN_TIER set inline in the HTML wrapper BEFORE this script
 *     loads. Each tier inherits everything below it.
 *   - Four exchange modes, all functional:
 *       Forward         — all tiers (incl. public preview)
 *       Reverse         — all members (Gold / Platinum / Reserve)
 *       Multi-Property  — all members (Gold / Platinum / Reserve)
 *       Drop-and-Swap   — all members (Gold / Platinum / Reserve)
 *     Policy note: per partner directive (May 2026), all four exchange modes
 *     are equally accessible to every member tier. Only the public preview
 *     remains restricted to the Forward mode. The tier-lock infrastructure
 *     is preserved below in case future policy distinguishes by tier again.
 *   - Mode selector at the top of the form swaps which input panel is visible.
 *     Panels for modes above the user's tier are locked at init time with a
 *     blur-overlay teaser.
 *   - Public tier banner renders on page load (not just after Calculate).
 *   - Forward and Reverse share the same computational core (computeExchange).
 *     Multi-Property aggregates at the exchange-group level under Reg. § 1.1031(j)-1.
 *     Drop-and-Swap allocates the relinquished property pro-rata to the partners
 *     and runs computeExchange per § 1031-electing partner; cash-out partners
 *     recognize their allocated share immediately.
 */

// =============================================================================
// TIER GATING — four-tier ladder
// =============================================================================
// public    rank 0 — open URL; forward basic (realized gain, ID timeline, boot top line, §121 diagnostic)
// gold      rank 1 — full feature set across all four exchange modes
// platinum  rank 2 — same feature set as gold (tier exists for membership economics, not feature gating)
// reserve   rank 3 — same feature set as gold (tier exists for membership economics, not feature gating)
//
// Legacy alias: 'client' is accepted and mapped to 'gold' for back-compat with
// any wrapper that pre-dates the tier-ladder rename.
// =============================================================================
const RAW_TIER = (typeof window !== 'undefined' && window.__DONOVAN_TIER) || 'public';
const TIER = RAW_TIER === 'client' ? 'gold' : RAW_TIER;
const TIER_RANK = { public: 0, gold: 1, platinum: 2, reserve: 3 };
function tierRank(t)   { return TIER_RANK[t] != null ? TIER_RANK[t] : 0; }
function isAtLeast(t)  { return tierRank(TIER) >= tierRank(t); }
function isPublic()    { return TIER === 'public'; }
function isGold()      { return isAtLeast('gold'); }
function isPlatinum()  { return isAtLeast('platinum'); }
function isReserve()   { return isAtLeast('reserve'); }
// Back-compat alias used throughout the render code from prior builds:
function isMember()    { return isAtLeast('gold'); }
const TIER_LABEL = { public: 'PUBLIC PREVIEW', gold: 'GOLD', platinum: 'PLATINUM', reserve: 'RESERVE' };

// Wrap an HTML fragment in a locked-panel overlay. Caller supplies title and body;
// the CTA is firm-standard and routes to the membership explainer.
function tierLock(panelHtml, title, body, ctaHref) {
  const t = title || 'Member access required';
  const b = body  || 'Full analysis available to Gold, Platinum, and Reserve members of Donovan Legal PLLC.';
  const href = ctaHref || (isPublic() ? 'engagement.html' : '../engagement.html');
  return `<div class="tier-locked-panel">
    <div class="tier-locked-content">${panelHtml}</div>
    <div class="tier-locked-overlay">
      <div class="tier-lock-icon">&#128274;</div>
      <div class="tier-lock-title">${t}</div>
      <div class="tier-lock-body">${b}</div>
      <a href="${href}" class="tier-lock-cta">Learn about membership &rarr;</a>
    </div>
  </div>`;
}

// =============================================================================
// STATES — § 1031 conformity table
// =============================================================================
const STATES_1031 = {
  AL:{name:'Alabama',conforms:true,note:''}, AK:{name:'Alaska',conforms:'no_tax',note:'No state income tax'},
  AZ:{name:'Arizona',conforms:true,note:''}, AR:{name:'Arkansas',conforms:true,note:''},
  CA:{name:'California',conforms:'special',note:'FTB 3840 claw-back applies indefinitely to California-source gain'},
  CO:{name:'Colorado',conforms:true,note:''}, CT:{name:'Connecticut',conforms:true,note:''},
  DE:{name:'Delaware',conforms:true,note:''}, FL:{name:'Florida',conforms:'no_tax',note:'No state income tax'},
  GA:{name:'Georgia',conforms:true,note:''}, HI:{name:'Hawaii',conforms:true,note:''},
  ID:{name:'Idaho',conforms:true,note:''}, IL:{name:'Illinois',conforms:true,note:''},
  IN:{name:'Indiana',conforms:true,note:''}, IA:{name:'Iowa',conforms:true,note:''},
  KS:{name:'Kansas',conforms:true,note:''}, KY:{name:'Kentucky',conforms:true,note:''},
  LA:{name:'Louisiana',conforms:true,note:''}, ME:{name:'Maine',conforms:true,note:''},
  MD:{name:'Maryland',conforms:true,note:''}, MA:{name:'Massachusetts',conforms:true,note:'Some state-source gain tracking similar to CA'},
  MI:{name:'Michigan',conforms:true,note:''}, MN:{name:'Minnesota',conforms:true,note:''},
  MS:{name:'Mississippi',conforms:true,note:''}, MO:{name:'Missouri',conforms:true,note:''},
  MT:{name:'Montana',conforms:true,note:''}, NE:{name:'Nebraska',conforms:true,note:''},
  NV:{name:'Nevada',conforms:'no_tax',note:'No state income tax'},
  NH:{name:'New Hampshire',conforms:'no_tax',note:'No income tax (interest/dividends only)'},
  NJ:{name:'New Jersey',conforms:true,note:''}, NM:{name:'New Mexico',conforms:true,note:''},
  NY:{name:'New York',conforms:true,note:''}, NC:{name:'North Carolina',conforms:true,note:''},
  ND:{name:'North Dakota',conforms:true,note:''}, OH:{name:'Ohio',conforms:true,note:''},
  OK:{name:'Oklahoma',conforms:true,note:''}, OR:{name:'Oregon',conforms:'special',note:'Form 24 claw-back tracking required'},
  PA:{name:'Pennsylvania',conforms:true,note:'Conforms for individuals as of Jan 1, 2023 (previously non-conforming)'},
  RI:{name:'Rhode Island',conforms:true,note:''}, SC:{name:'South Carolina',conforms:true,note:''},
  SD:{name:'South Dakota',conforms:'no_tax',note:'No state income tax'},
  TN:{name:'Tennessee',conforms:'no_tax',note:'No income tax'},
  TX:{name:'Texas',conforms:'no_tax',note:'No state income tax'},
  UT:{name:'Utah',conforms:true,note:''}, VT:{name:'Vermont',conforms:true,note:''},
  VA:{name:'Virginia',conforms:true,note:''}, WA:{name:'Washington',conforms:'no_tax',note:'No state income tax (RE exempt from WA 7% LTCG)'},
  WV:{name:'West Virginia',conforms:true,note:''}, WI:{name:'Wisconsin',conforms:true,note:''},
  WY:{name:'Wyoming',conforms:'no_tax',note:'No state income tax'},
  DC:{name:'District of Columbia',conforms:true,note:''}
};

function populateStates1031() {
  document.querySelectorAll('select[data-role="state-1031"]').forEach(sel => {
    if (sel.options.length > 0) return; // already populated
    Object.keys(STATES_1031).sort().forEach(k => {
      const o = document.createElement('option');
      o.value = k;
      o.textContent = STATES_1031[k].name;
      sel.appendChild(o);
    });
    sel.value = 'FL';
  });
}

// =============================================================================
// FORMATTING HELPERS
// =============================================================================
function getValue(id, def = 0) {
  const el = document.getElementById(id);
  if (!el) return def;
  if (window.DonovanInputFormatter) {
    return window.DonovanInputFormatter.getValue(el, def);
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

function addDaysISO(iso, days) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function daysBetween(isoStart, isoEnd) {
  if (!isoStart || !isoEnd) return null;
  const a = new Date(isoStart + 'T00:00:00');
  const b = new Date(isoEnd + 'T00:00:00');
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return null;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

// =============================================================================
// MODE SELECTOR
// =============================================================================
// Four modes: forward / reverse / drop-swap / multi.
// Per-mode tier requirements are defined in MODE_REQUIRES (see Mode Dispatch
// section). On init, applyModeLocks() replaces the content of any mode panel
// whose required tier exceeds the user's tier with a locked-overlay teaser.

function getMode() {
  const btn = document.querySelector('#mode_toggle button.active');
  return btn ? btn.getAttribute('data-mode') : 'forward';
}

function setupModeSelector() {
  const buttons = document.querySelectorAll('#mode_toggle button');
  buttons.forEach(btn => {
    btn.addEventListener('click', function() {
      const mode = this.getAttribute('data-mode');
      buttons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      // Show the chosen mode's input panel, hide the others
      document.querySelectorAll('.mode-panel').forEach(p => {
        p.style.display = (p.getAttribute('data-mode') === mode) ? '' : 'none';
      });
      // Reset results when switching modes
      const results = document.getElementById('results');
      if (results) results.classList.remove('show');
    });
  });
  // Initialize: forward visible by default
  document.querySelectorAll('.mode-panel').forEach(p => {
    p.style.display = (p.getAttribute('data-mode') === 'forward') ? '' : 'none';
  });
}

// Lock mode panels whose required tier exceeds the user's tier.
// Replaces the entire panel content with a tierLock overlay so the user
// cannot fill in inputs or interact with form fields they don't have access to.
function applyModeLocks() {
  document.querySelectorAll('.mode-panel').forEach(panel => {
    const mode = panel.getAttribute('data-mode');
    const required = (typeof MODE_REQUIRES !== 'undefined' && MODE_REQUIRES[mode]) || 'public';
    if (isAtLeast(required)) return; // user has access; leave panel alone
    const modeName = modeDisplayName(mode);
    const tierLabel = required === 'platinum' ? 'Platinum or Reserve' : 'Reserve';
    const placeholder = `
      <div style="padding:1.5rem 2rem;">
        <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin: 0 0 0.5rem 0; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">${modeName}</h4>
        <p style="font-size: 0.9rem; color: #4a4a4a; line-height: 1.55;">${modeBlurbHTML(mode)}</p>
      </div>`;
    const lockedHTML = tierLock(
      placeholder,
      `${modeName} — ${tierLabel} Members Only`,
      `${modeName} requires ${tierLabel} membership. ${required === 'reserve'
        ? 'These structures involve case-law and basis-allocation complexity reserved for sponsor-level engagement.'
        : 'Reverse exchange involves QEAA parking-arrangement structuring under Rev. Proc. 2000-37 that benefits from the additional analytical surface area in the Platinum tier.'}`,
      isPublic() ? 'engagement.html' : '../engagement.html'
    );
    panel.innerHTML = lockedHTML;
  });
}

// =============================================================================
// IDENTIFICATION RULE TOGGLE (forward and reverse)
// =============================================================================
function setupIDRuleToggle() {
  document.querySelectorAll('[data-role="id-rule-toggle"]').forEach(toggle => {
    const buttons = toggle.querySelectorAll('button');
    buttons.forEach(btn => {
      btn.addEventListener('click', function() {
        buttons.forEach(b => b.classList.remove('active'));
        this.classList.add('active');
        const rule = this.getAttribute('data-rule');
        // Update the associated rule-card display (cards share data-rule attribute)
        const cardSet = toggle.parentElement.querySelectorAll('.id-rule-card');
        cardSet.forEach(c => c.classList.remove('active'));
        cardSet.forEach(c => {
          if (c.getAttribute('data-rule') === rule) c.classList.add('active');
        });
      });
    });
  });
}

function getIDRule(scope) {
  // scope is the mode prefix ('fwd' or 'rev'); defaults to forward
  const selector = '[data-role="id-rule-toggle"][data-scope="' + (scope || 'fwd') + '"] button.active';
  const btn = document.querySelector(selector);
  return btn ? btn.getAttribute('data-rule') : 'three';
}

function idRuleText(rule) {
  if (rule === 'three') return '3-Property Rule (up to 3 identified, any FMV)';
  if (rule === '200')   return '200% Rule (any number, aggregate FMV ≤ 200% of relinquished)';
  return '95% Exception (any number, must acquire ≥ 95% of identified)';
}

function idRuleShort(rule) {
  if (rule === 'three') return '3-Property Rule';
  if (rule === '200')   return '200% Rule';
  return '95% Exception';
}

// =============================================================================
// CORE COMPUTATION — pure function used by both forward and reverse engines.
// Inputs are explicit, no DOM reads. This makes the computation unit-testable.
// =============================================================================
function computeExchange(inputs) {
  const {
    relFMV, relSellExp, relBasis, relAccumDep, rel1245Dep, relMortgage,
    repFMV, repMortgage, cashAdded, cashReceived,
    eatFees,                  // reverse-only: EAT/QI fees treated as exchange expense
    improvementCost,          // reverse-only: improvements built during parking
    marginalRate, ltcgRate, unrec1250Rate, niitRate, stateRate,
    stateCode,
    use121, exclusion121,     // §121 exclusion amount actually applied
    applyDLTS
  } = inputs;

  // Amount realized = relFMV - selling expenses. EAT/QI fees on reverse are
  // additional selling expenses for purposes of computing amount realized.
  const totalSellExp = relSellExp + (eatFees || 0);
  const amountRealized = relFMV - totalSellExp;
  const realizedGain = amountRealized - relBasis;

  // Boot computation — same for all modes.
  const grossMortgageBoot = Math.max(0, relMortgage - repMortgage);
  const netMortgageBoot = Math.max(0, grossMortgageBoot - cashAdded);
  const netCashBoot = Math.max(0, cashReceived);
  const totalBoot = netCashBoot + netMortgageBoot;
  const sec1250DepPotential = Math.max(0, relAccumDep - rel1245Dep);
  const stateConforms = (STATES_1031[stateCode] || {}).conforms;

  // §121 layering — caller supplies the exclusion amount applied (whether
  // conservative or DLTS-aggressive). Engine just applies it.
  const section121Excluded = use121 ? exclusion121 : 0;
  const gainAfter121 = Math.max(0, realizedGain - section121Excluded);

  // Recognized gain = lesser of (gain after § 121) or (total boot).
  let recognizedGain = Math.min(gainAfter121, totalBoot);
  if (recognizedGain < 0) recognizedGain = 0;

  // Recapture allocation under § 1245(b)(4) and the § 1250 25% cap.
  const recapture1245 = Math.min(recognizedGain, rel1245Dep);
  const remaining1 = recognizedGain - recapture1245;
  const recapture1250 = Math.min(remaining1, sec1250DepPotential);
  const remaining2 = remaining1 - recapture1250;
  const recogLTCG = Math.max(0, remaining2);

  const deferredGain = Math.max(0, gainAfter121 - recognizedGain);

  // Replacement basis. For reverse improvement exchanges, improvements add to
  // the basis dollar-for-dollar (improvements are treated as additional cash
  // outlay by the taxpayer through the EAT).
  const repFMVWithImprovements = repFMV + (improvementCost || 0);
  const repBasis = repFMVWithImprovements - deferredGain;

  // Carryover / excess split under Reg. § 1.168(i)-6.
  const carryoverBasis = Math.max(0, relBasis - relAccumDep);
  const excessBasis = Math.max(0, repBasis - carryoverBasis);

  // Tax computation on recognized gain.
  const tax1245 = recapture1245 * marginalRate;
  const tax1250 = recapture1250 * unrec1250Rate;
  const taxLTCG = recogLTCG * ltcgRate;
  const niit = (recapture1250 + recogLTCG) * niitRate;
  const fedTaxRecognized = tax1245 + tax1250 + taxLTCG + niit;
  const stateTaxRecognized = (stateConforms === true || stateConforms === 'special')
    ? recognizedGain * stateRate : 0;

  // Deferred federal tax = hypothetical tax on full gain - tax recognized now.
  const hyp1245 = Math.min(gainAfter121, rel1245Dep);
  const hypRem1 = gainAfter121 - hyp1245;
  const hyp1250 = Math.min(hypRem1, sec1250DepPotential);
  const hypRem2 = hypRem1 - hyp1250;
  const hypLTCG = Math.max(0, hypRem2);
  const hypFedTax = hyp1245 * marginalRate + hyp1250 * unrec1250Rate + hypLTCG * ltcgRate
                  + (hyp1250 + hypLTCG) * niitRate;
  const deferredFedTax = Math.max(0, hypFedTax - fedTaxRecognized);
  const hypStateTax = (stateConforms === true || stateConforms === 'special')
    ? gainAfter121 * stateRate : 0;
  const deferredStateTax = Math.max(0, hypStateTax - stateTaxRecognized);

  return {
    inputs,
    amountRealized, realizedGain, totalSellExp,
    grossMortgageBoot, netMortgageBoot, netCashBoot, totalBoot,
    sec1250DepPotential, stateConforms,
    section121Excluded, gainAfter121, recognizedGain,
    recapture1245, recapture1250, recogLTCG,
    deferredGain, repFMVWithImprovements, repBasis, carryoverBasis, excessBasis,
    tax1245, tax1250, taxLTCG, niit, fedTaxRecognized, stateTaxRecognized,
    totalTaxRecognized: fedTaxRecognized + stateTaxRecognized,
    deferredFedTax, deferredStateTax,
    hypFedTax, hypStateTax,
    applyDLTS: !!applyDLTS
  };
}

// =============================================================================
// MULTI-YEAR HOLDING-PERIOD PROJECTION (members only)
// Models the continuing depreciation on the replacement property under
// Reg. § 1.168(i)-6, separating carryover basis (relinquished schedule) from
// excess basis (new asset, full 27.5- or 39-year life). Projects the running
// basis, accumulated depreciation, and deferred-tax exposure over the hold.
// =============================================================================
function computeMultiYearProjection(r, holdYears, propertyType, remainingLife) {
  // r is the core result; propertyType is 'residential' (27.5yr) or 'commercial' (39yr).
  // remainingLife is the years remaining on the carryover basis's original schedule.
  if (holdYears <= 0) return null;

  const newLife = propertyType === 'commercial' ? 39 : 27.5;
  const carryAnnualDep = remainingLife > 0 ? (r.carryoverBasis / remainingLife) : 0;
  const excessAnnualDep = newLife > 0 ? (r.excessBasis / newLife) : 0;

  const years = [];
  let runCarry = r.carryoverBasis;
  let runExcess = r.excessBasis;
  let cumDep = 0;

  for (let y = 1; y <= holdYears; y++) {
    const carryDep = Math.min(runCarry, carryAnnualDep);
    const excessDep = Math.min(runExcess, excessAnnualDep);
    const yearDep = carryDep + excessDep;
    runCarry -= carryDep;
    runExcess -= excessDep;
    cumDep += yearDep;
    const adjBasis = r.repBasis - cumDep;
    years.push({
      year: y,
      carryDep,
      excessDep,
      yearDep,
      cumDep,
      adjBasis,
      remainingCarry: runCarry,
      remainingExcess: runExcess
    });
  }

  // Year-of-sale exposure assuming the replacement is sold at year holdYears
  // for its current FMV with no appreciation modeled (pure mechanics; the user
  // can flex the value assumption in the analyzer for fuller scenarios).
  const finalYear = years[years.length - 1];
  const projectedGainAtSale = r.repFMVWithImprovements - finalYear.adjBasis;
  // For simplicity, treat the full projected gain as carrying the deferred
  // recapture + LTCG character of the original relinquished property plus
  // the additional 1250 recapture from new depreciation during the hold.
  const newDepRecaptured = cumDep; // all the new depreciation becomes § 1250 unrecaptured at sale
  const inputs = r.inputs;
  const tax1250AtSale = Math.min(newDepRecaptured, projectedGainAtSale) * inputs.unrec1250Rate;
  const ltcgPortion = Math.max(0, projectedGainAtSale - newDepRecaptured);
  const taxLTCGAtSale = ltcgPortion * inputs.ltcgRate;
  const niitAtSale = projectedGainAtSale * inputs.niitRate;
  const hypotheticalFedTaxAtSale = tax1250AtSale + taxLTCGAtSale + niitAtSale + r.deferredFedTax;
  // ^^ note: r.deferredFedTax is the original deferred federal tax that gets
  // pulled back into recognition on a fully-taxable disposition at the end.

  return {
    propertyType, newLife, remainingLife,
    carryAnnualDep, excessAnnualDep,
    years,
    projectedGainAtSale,
    newDepRecaptured,
    tax1250AtSale,
    taxLTCGAtSale,
    niitAtSale,
    hypotheticalFedTaxAtSale,
    deferredCarriedFromOriginal: r.deferredFedTax
  };
}

// =============================================================================
// FORWARD EXCHANGE — orchestrator. Gathers DOM inputs, computes, renders.
// =============================================================================
function calculateForward() {
  // Gather inputs
  const inputs = {
    relFMV:       getValue('fwd_rel_fmv'),
    relSellExp:   getValue('fwd_rel_sell_exp'),
    relBasis:     getValue('fwd_rel_basis'),
    relAccumDep:  getValue('fwd_rel_accum_dep'),
    rel1245Dep:   getValue('fwd_rel_1245_dep'),
    relMortgage:  getValue('fwd_rel_mortgage'),
    repFMV:       getValue('fwd_rep_fmv'),
    repMortgage:  getValue('fwd_rep_mortgage'),
    cashAdded:    getValue('fwd_cash_added'),
    cashReceived: getValue('fwd_cash_received'),
    eatFees: 0,
    improvementCost: 0,
    marginalRate: getValue('fwd_marginal_rate', 37) / 100,
    ltcgRate:     getValue('fwd_ltcg_rate', 20) / 100,
    unrec1250Rate:getValue('fwd_unrec_1250_rate', 25) / 100,
    niitRate:     getValue('fwd_niit_rate', 3.8) / 100,
    stateRate:    getValue('fwd_state_rate', 5) / 100,
    stateCode:    (document.getElementById('fwd_state_select') || {}).value || 'FL',
    use121:       (document.getElementById('fwd_use_121') || {}).value === 'yes',
    exclusion121: 0, // set below
    applyDLTS:    isMember() && (document.getElementById('fwd_apply_dlts') || {}).value === 'yes'
  };

  if (inputs.relFMV <= 0 || inputs.repFMV <= 0) {
    alert('Enter the fair market values of both the relinquished and replacement properties.');
    return;
  }

  const filing121 = (document.getElementById('fwd_filing_121') || {}).value || 'mfj';
  const cap121 = filing121 === 'mfj' ? 500000 : 250000;

  // Standard (conservative) § 121 layer: exclusion capped at gain net of depreciation
  // (cautious reading of § 121(d)(6) carving out post-1997 depreciation).
  const amountRealizedDraft = inputs.relFMV - inputs.relSellExp;
  const realizedGainDraft = amountRealizedDraft - inputs.relBasis;
  let conservativeExclusion = 0;
  if (inputs.use121 && realizedGainDraft > 0) {
    const excludable = Math.max(0, realizedGainDraft - inputs.relAccumDep);
    conservativeExclusion = Math.min(excludable, cap121);
  }
  const inputsStandard = Object.assign({}, inputs, { exclusion121: conservativeExclusion, applyDLTS: false });
  const standardResult = computeExchange(inputsStandard);

  // DLTS run (members only): more aggressive layering — exclusion capped only by
  // the statutory dollar limit; depreciation portion deferred under § 1031.
  let dltsResult = null;
  if (inputs.applyDLTS && inputs.use121 && realizedGainDraft > 0) {
    const aggressiveExclusion = Math.min(realizedGainDraft, cap121);
    const inputsDLTS = Object.assign({}, inputs, { exclusion121: aggressiveExclusion, applyDLTS: true });
    dltsResult = computeExchange(inputsDLTS);
  }

  const r = (inputs.applyDLTS && dltsResult) ? dltsResult : standardResult;

  // Multi-year projection (Platinum and above)
  let projection = null;
  if (isPlatinum()) {
    const holdYears = Math.round(getValue('fwd_hold_years', 0));
    if (holdYears > 0) {
      const propertyType = (document.getElementById('fwd_property_type') || {}).value || 'residential';
      const remainingLife = getValue('fwd_remaining_life', propertyType === 'commercial' ? 30 : 20);
      projection = computeMultiYearProjection(r, holdYears, propertyType, remainingLife);
    }
  }

  // Timeline
  const closeDate = (document.getElementById('fwd_close_date') || {}).value || '';
  const taxYearDue = (document.getElementById('fwd_tax_year_due') || {}).value || '';
  const timeline = computeForwardTimeline(closeDate, taxYearDue);

  renderForwardResults({
    standardResult, dltsResult, r,
    projection, timeline,
    filing121, idRule: getIDRule('fwd'),
    inputs
  });
}

function computeForwardTimeline(closeDate, taxYearDue) {
  if (!closeDate) return null;
  const date45 = addDaysISO(closeDate, 45);
  const date180 = addDaysISO(closeDate, 180);
  let acquisitionDeadline, acquisitionDeadlineSource;
  if (taxYearDue && taxYearDue < date180) {
    acquisitionDeadline = taxYearDue;
    acquisitionDeadlineSource = '(accelerated by tax filing deadline; file an extension to preserve full 180 days)';
  } else {
    acquisitionDeadline = date180;
    acquisitionDeadlineSource = '(180 days from close)';
  }
  return { closeDate, date45, date180, acquisitionDeadline, acquisitionDeadlineSource };
}

function renderTimelineFwd(t, idRule) {
  if (!t) return '<div class="info-card warn"><strong>Enter the relinquished property closing date</strong> above to visualize the 45-day identification and 180-day acquisition windows.</div>';
  return `
    <div class="timeline-vis">
      <h4>45-Day Identification + 180-Day Acquisition Timeline</h4>
      <div style="font-size: 0.85rem; color: #6b6b6b; margin-bottom: 0.4rem;">Relinquished property closes: <strong style="color: #1a1a1a;">${formatDate(t.closeDate)}</strong></div>
      <div class="timeline-bar">
        <div class="timeline-fill-180"></div>
        <div class="timeline-fill-45"></div>
        <div class="timeline-marker" style="left: 0;">
          <div class="timeline-marker-label" style="left: 20px; transform: none;">Close</div>
          <div class="timeline-marker-date" style="left: 20px; transform: none;">${formatDate(t.closeDate)}</div>
        </div>
        <div class="timeline-marker" style="left: 25%;">
          <div class="timeline-marker-label">Day 45</div>
          <div class="timeline-marker-date">${formatDate(t.date45)}</div>
        </div>
        <div class="timeline-marker" style="left: 100%;">
          <div class="timeline-marker-label" style="left: auto; right: 20px; transform: none;">Day 180</div>
          <div class="timeline-marker-date" style="left: auto; right: 20px; transform: none;">${formatDate(t.date180)}</div>
        </div>
      </div>
      <div class="timeline-row">
        <div class="timeline-cell warn">
          <strong>Identification Deadline</strong>
          ${formatDate(t.date45)}<br>
          <span style="font-size: 0.78rem; color: #6b6b6b;">45 days after close. Replacement properties must be unambiguously identified in writing to the QI.</span>
        </div>
        <div class="timeline-cell">
          <strong>Acquisition Deadline</strong>
          ${formatDate(t.acquisitionDeadline)}<br>
          <span style="font-size: 0.78rem; color: #6b6b6b;">${t.acquisitionDeadlineSource}</span>
        </div>
        <div class="timeline-cell">
          <strong>Identification Rule</strong>
          ${idRuleShort(idRule)}<br>
          <span style="font-size: 0.78rem; color: #6b6b6b;">${idRuleText(idRule).split('(')[1].replace(')','')}</span>
        </div>
      </div>
    </div>
  `;
}

function renderTierBanner() {
  // Used by results panel. The static at-load banner is separate (renderStaticTierBanner).
  if (isPublic()) {
    return `<div class="tier-banner tier-public">
      <div class="tier-banner-text"><strong>Public preview.</strong> Realized gain, identification rules timeline, boot top-line, and § 121 + § 1031 layered diagnostic shown openly. Tax detail, basis bifurcation, deferred tax, Donovan Legal Tax Strategy, multi-year projection, and the advanced exchange modes are members-only.</div>
      <a href="engagement.html" class="tier-banner-cta">Learn about membership &rarr;</a>
    </div>`;
  }
  // All member tiers (Gold / Platinum / Reserve) get the same full analysis
  // surface. Per May 2026 policy update, no feature gating between member tiers.
  return `<div class="tier-banner tier-client">
    <div class="tier-banner-text"><strong>Full analysis.</strong> Forward, reverse, drop-and-swap, and multi-property exchange modes. Donovan Legal Tax Strategy toggle, tax-detail allocation across § 1245 / § 1250 / LTCG / NIIT, basis bifurcation under Reg. § 1.168(i)-6, deferred federal and state tax, state non-conformity treatment, multi-year holding-period projection, reverse exchange under Rev. Proc. 2000-37, partnership-level drop-and-swap (both variants), and multi-property exchange under Reg. § 1.1031(j)-1.</div>
  </div>`;
}

// Static tier banner — rendered into #tier_banner_top on page load, visible
// from initial render (not gated behind clicking Calculate).
function renderStaticTierBanner() {
  const el = document.getElementById('tier_banner_top');
  if (!el) return;
  el.innerHTML = renderTierBanner();
}

function renderDLTSPanel(standardResult, dltsResult, inputs) {
  if (!inputs.applyDLTS) return '';
  if (!dltsResult || !inputs.use121) {
    return `<div class="info-card warn" style="margin: 1rem 0;">
      <strong>Donovan Legal Tax Strategy not applicable to this scenario.</strong> The firm's methodology produces material benefit primarily when the relinquished property has a meaningful § 121 + § 1031 layering question (i.e., the property was the taxpayer's principal residence within the 5 years preceding sale and was subsequently converted to rental use). For pure rental-to-rental exchanges, the firm's value is delivered through identification strategy, replacement property due diligence, and structuring rather than computational differences.
    </div>`;
  }
  const totalSavings = standardResult.totalTaxRecognized - dltsResult.totalTaxRecognized;
  return `
    <div class="info-card" style="background: rgba(22,155,98,0.10); border-left: 4px solid #169B62; margin: 1rem 0;">
      <div style="font-family: 'Gotham Bold', sans-serif; color: #107a4d; font-size: 0.95rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase;">Donovan Legal Tax Strategy &mdash; Effect on This Exchange</div>
      <p style="margin: 0 0 0.75rem 0;">Applying the firm's methodology to the § 121 + § 1031 combination changes the layering treatment of the exclusion and the depreciation portion of the gain. The comparison:</p>
      <table class="boot-table" style="margin: 0;">
        <thead>
          <tr><th></th><th style="text-align:right;">Standard Calculation</th><th style="text-align:right;">With Donovan Legal Tax Strategy</th><th style="text-align:right;">Additional Benefit</th></tr>
        </thead>
        <tbody>
          <tr><td>§ 121 exclusion applied</td><td class="num">${fmtMoney(standardResult.section121Excluded)}</td><td class="num">${fmtMoney(dltsResult.section121Excluded)}</td><td class="num">${fmtMoney(dltsResult.section121Excluded - standardResult.section121Excluded)}</td></tr>
          <tr><td>Realized gain after § 121</td><td class="num">${fmtMoney(standardResult.gainAfter121)}</td><td class="num">${fmtMoney(dltsResult.gainAfter121)}</td><td class="num">${fmtMoney(dltsResult.gainAfter121 - standardResult.gainAfter121)}</td></tr>
          <tr><td>Recognized gain (current year tax)</td><td class="num">${fmtMoney(standardResult.recognizedGain)}</td><td class="num">${fmtMoney(dltsResult.recognizedGain)}</td><td class="num">${fmtMoney(dltsResult.recognizedGain - standardResult.recognizedGain)}</td></tr>
          <tr><td>Deferred gain (carried to replacement)</td><td class="num">${fmtMoney(standardResult.deferredGain)}</td><td class="num">${fmtMoney(dltsResult.deferredGain)}</td><td class="num">${fmtMoney(dltsResult.deferredGain - standardResult.deferredGain)}</td></tr>
          <tr><td>Federal tax recognized</td><td class="num">${fmtMoney(standardResult.fedTaxRecognized)}</td><td class="num">${fmtMoney(dltsResult.fedTaxRecognized)}</td><td class="num">${fmtMoney(standardResult.fedTaxRecognized - dltsResult.fedTaxRecognized)}</td></tr>
          <tr><td>State tax recognized</td><td class="num">${fmtMoney(standardResult.stateTaxRecognized)}</td><td class="num">${fmtMoney(dltsResult.stateTaxRecognized)}</td><td class="num">${fmtMoney(standardResult.stateTaxRecognized - dltsResult.stateTaxRecognized)}</td></tr>
          <tr class="total"><td><strong>Total tax saved in exchange year</strong></td><td class="num"><strong>${fmtMoney(standardResult.totalTaxRecognized)}</strong></td><td class="num"><strong>${fmtMoney(dltsResult.totalTaxRecognized)}</strong></td><td class="num"><strong>${fmtMoney(totalSavings)}</strong></td></tr>
          <tr><td>Replacement property basis</td><td class="num">${fmtMoney(standardResult.repBasis)}</td><td class="num">${fmtMoney(dltsResult.repBasis)}</td><td class="num">${fmtMoney(dltsResult.repBasis - standardResult.repBasis)}</td></tr>
        </tbody>
      </table>
      <p style="margin: 0.75rem 0 0 0; font-size: 0.85rem;">The methodology underlying the Donovan Legal Tax Strategy is reserved to the firm's engagement and is not disclosed in this tool. Realization of this benefit depends on specific facts, the holding-period and use-history of the relinquished property, and engagement-level review.</p>
    </div>
  `;
}

function renderMultiYearProjection(projection, r) {
  if (!projection) return '';
  const rows = projection.years.map(y => `
    <tr>
      <td>Year ${y.year}</td>
      <td class="num">${fmtMoney(y.carryDep)}</td>
      <td class="num">${fmtMoney(y.excessDep)}</td>
      <td class="num">${fmtMoney(y.yearDep)}</td>
      <td class="num">${fmtMoney(y.cumDep)}</td>
      <td class="num">${fmtMoney(y.adjBasis)}</td>
    </tr>
  `).join('');
  return `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">G. Multi-Year Holding-Period Projection (Reg. § 1.168(i)-6)</h4>
    <p style="font-size: 0.88rem; color: #4a4a4a; margin-bottom: 0.75rem;">Depreciation on the replacement property is bifurcated: the carryover basis (${fmtMoney(r.carryoverBasis)}) continues on the relinquished property's remaining ${projection.remainingLife}-year schedule at ${fmtMoney(projection.carryAnnualDep)}/year; the excess basis (${fmtMoney(r.excessBasis)}) depreciates as a new ${projection.newLife}-year asset at ${fmtMoney(projection.excessAnnualDep)}/year.</p>
    <div class="multi-year-table-wrapper">
    <table class="boot-table">
      <thead>
        <tr>
          <th>Year</th>
          <th style="text-align:right;">Carryover Dep</th>
          <th style="text-align:right;">Excess Dep</th>
          <th style="text-align:right;">Total Dep</th>
          <th style="text-align:right;">Cum. Dep</th>
          <th style="text-align:right;">Adj. Basis</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
    </div>
    <div class="info-card" style="margin-top: 1rem;">
      <strong>Projected exposure if replacement sold at end of year ${projection.years.length}:</strong>
      Projected gain ${fmtMoney(projection.projectedGainAtSale)} (using current FMV as proxy for sale price; flex with the analyzer for appreciation-aware modeling).
      Reflects ${fmtMoney(projection.newDepRecaptured)} of new § 1250 depreciation accumulated during the hold, plus the original deferred federal tax of ${fmtMoney(projection.deferredCarriedFromOriginal)} pulled back into recognition.
      Hypothetical federal tax at sale: ${fmtMoney(projection.hypotheticalFedTaxAtSale)}.
      Held to death and stepped up under § 1014, the entire deferred liability is eliminated.
    </div>
  `;
}

function renderForwardResults(ctx) {
  const { standardResult, dltsResult, r, projection, timeline, filing121, idRule, inputs } = ctx;

  const isFullDeferral = r.recognizedGain === 0 && r.realizedGain > 0;
  const stateName = (STATES_1031[inputs.stateCode] || {}).name || '';
  const stateConforms = r.stateConforms;
  const stateConformText =
    stateConforms === 'no_tax'  ? `${stateName} imposes no state income tax — no state-level deferral concern.`
  : stateConforms === 'special' ? `${stateName} conforms to federal § 1031 but imposes a tracking/claw-back requirement: ${STATES_1031[inputs.stateCode].note}. The taxpayer must file the state's tracking return annually until the deferred gain is ultimately recognized in California (or wherever the source state requires).`
  :                               `${stateName} conforms to federal § 1031 treatment.`;

  // Build the panel HTML, gating premium sections behind tier checks.
  let html = renderTierBanner();
  html += renderTimelineFwd(timeline, idRule);

  // HEADLINE — visible to all tiers; for public, the deferred-tax sub-card is locked.
  html += `
    <div class="result-headline">
      <div class="result-headline-label">${inputs.applyDLTS && dltsResult ? 'Recognized Gain — With Donovan Legal Tax Strategy' : 'Recognized Gain (Boot Triggered)'}</div>
      <div class="result-headline-value">${fmtMoney(r.recognizedGain)}</div>
      <div class="result-headline-grid">
        <div>
          <div class="result-headline-sub-label">DEFERRED GAIN</div>
          <div class="result-headline-sub-value">${fmtMoney(r.deferredGain)}</div>
        </div>
        <div>
          <div class="result-headline-sub-label">DEFERRED FED TAX</div>
          <div class="result-headline-sub-value">${isMember() ? fmtMoney(r.deferredFedTax) : '<span style="color:#6b6b6b;">Member</span>'}</div>
        </div>
        <div>
          <div class="result-headline-sub-label">REPLACEMENT BASIS</div>
          <div class="result-headline-sub-value">${fmtMoney(r.repBasis)}</div>
        </div>
      </div>
    </div>
  `;

  // DLTS panel (members only and when DLTS applied)
  if (isMember()) {
    html += renderDLTSPanel(standardResult, dltsResult, inputs);
  }

  // § 121 layered diagnostic — visible to all tiers (this is the diagnostic spec'd for public)
  if (inputs.use121) {
    html += `
      <div class="info-card">
        <strong>§ 121 Exclusion Applied:</strong> ${fmtMoney(r.section121Excluded)} of gain excluded under § 121 (principal residence exclusion, ${filing121 === 'mfj' ? '$500K MFJ' : '$250K single'} cap).
        ${inputs.applyDLTS && dltsResult
          ? 'Strategy applied under the firm\'s methodology; the depreciation portion is deferred under § 1031 along with the rest of the post-exclusion gain.'
          : 'Conservative treatment: depreciation taken after May 6, 1997 not excludable per § 121(d)(6) and is carved out of the exclusion. The standard calculation reduces the available exclusion accordingly.'}
        Remaining ${fmtMoney(r.gainAfter121)} subject to § 1031 analysis below.
      </div>
    `;
  }

  // A. Realized gain — visible to all
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">A. Realized Gain Computation (§ 1001(a))</h4>
    <table class="boot-table">
      <tr><td>Fair market value of relinquished property</td><td class="num">${fmtMoney(inputs.relFMV)}</td></tr>
      <tr><td>Less: selling expenses</td><td class="num">(${fmtMoney(inputs.relSellExp)})</td></tr>
      <tr><td><strong>Amount realized</strong></td><td class="num"><strong>${fmtMoney(r.amountRealized)}</strong></td></tr>
      <tr><td>Less: adjusted basis of relinquished property</td><td class="num">(${fmtMoney(inputs.relBasis)})</td></tr>
      <tr class="total"><td>Realized gain</td><td class="num">${fmtMoney(r.realizedGain)}</td></tr>
      ${inputs.use121 ? `<tr><td>Less: § 121 exclusion</td><td class="num">(${fmtMoney(r.section121Excluded)})</td></tr>
      <tr class="total"><td>Realized gain after § 121</td><td class="num">${fmtMoney(r.gainAfter121)}</td></tr>` : ''}
    </table>
  `;

  // B. Boot analysis — visible to all (diagnostic)
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">B. Boot Analysis (§ 1031(b))</h4>
    <table class="boot-table">
      <tr><td>Cash received by taxpayer</td><td class="num">${fmtMoney(inputs.cashReceived)}</td></tr>
      <tr><td>Relinquished mortgage</td><td class="num">${fmtMoney(inputs.relMortgage)}</td></tr>
      <tr><td>Less: replacement mortgage</td><td class="num">(${fmtMoney(inputs.repMortgage)})</td></tr>
      <tr><td>Gross mortgage boot (debt relief)</td><td class="num">${fmtMoney(r.grossMortgageBoot)}</td></tr>
      <tr><td>Less: cash added by taxpayer (offsets mortgage boot)</td><td class="num">(${fmtMoney(Math.min(r.grossMortgageBoot, inputs.cashAdded))})</td></tr>
      <tr><td><strong>Net cash boot received</strong></td><td class="num"><strong>${fmtMoney(r.netCashBoot)}</strong></td></tr>
      <tr><td><strong>Net mortgage boot</strong></td><td class="num"><strong>${fmtMoney(r.netMortgageBoot)}</strong></td></tr>
      <tr class="total"><td>Total boot</td><td class="num">${fmtMoney(r.totalBoot)}</td></tr>
    </table>
  `;

  // C. Recognized vs deferred — top line visible to all; recapture allocation locked for public
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">C. Recognized vs. Deferred Gain</h4>
    <table class="boot-table">
      <tr><td>Realized gain after § 121</td><td class="num">${fmtMoney(r.gainAfter121)}</td></tr>
      <tr><td>Total boot</td><td class="num">${fmtMoney(r.totalBoot)}</td></tr>
      <tr><td><strong>Recognized gain</strong> (lesser of realized gain or boot)</td><td class="num"><strong>${fmtMoney(r.recognizedGain)}</strong></td></tr>
      ${(r.recognizedGain > 0 && isMember()) ? `
        <tr><td>&nbsp;&nbsp;&nbsp;Allocated to § 1245 recapture (ordinary income)</td><td class="num">${fmtMoney(r.recapture1245)}</td></tr>
        <tr><td>&nbsp;&nbsp;&nbsp;Allocated to § 1250 unrecaptured (25% max)</td><td class="num">${fmtMoney(r.recapture1250)}</td></tr>
        <tr><td>&nbsp;&nbsp;&nbsp;Allocated to LTCG (residual)</td><td class="num">${fmtMoney(r.recogLTCG)}</td></tr>
      ` : ''}
      <tr class="total"><td>Deferred gain</td><td class="num">${fmtMoney(r.deferredGain)}</td></tr>
    </table>
  `;

  // D. Tax detail — MEMBER ONLY
  if (isMember()) {
    if (r.recognizedGain > 0) {
      html += `
        <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">D. Tax on Recognized Gain</h4>
        <table class="boot-table">
          <tr><td>Tax on § 1245 recapture @ ${(inputs.marginalRate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.tax1245)}</td></tr>
          <tr><td>Tax on § 1250 unrecaptured @ ${(inputs.unrec1250Rate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.tax1250)}</td></tr>
          <tr><td>Tax on LTCG @ ${(inputs.ltcgRate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.taxLTCG)}</td></tr>
          <tr><td>NIIT @ ${(inputs.niitRate*100).toFixed(1)}% (on § 1250 + LTCG)</td><td class="num">${fmtMoney(r.niit)}</td></tr>
          <tr class="total"><td>Total federal tax on recognized gain</td><td class="num">${fmtMoney(r.fedTaxRecognized)}</td></tr>
          <tr><td>State tax @ ${(inputs.stateRate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.stateTaxRecognized)}</td></tr>
        </table>
      `;
    } else {
      html += '<div class="info-card"><strong>No tax recognized.</strong> All realized gain is deferred under § 1031(a)(1). The deferred gain is preserved as a reduction in the replacement property\'s basis.</div>';
    }

    // E. Replacement basis
    html += `
      <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">E. Replacement Property Basis (§ 1031(d))</h4>
      <table class="boot-table">
        <tr><td>FMV of replacement property</td><td class="num">${fmtMoney(inputs.repFMV)}</td></tr>
        <tr><td>Less: deferred gain</td><td class="num">(${fmtMoney(r.deferredGain)})</td></tr>
        <tr class="total"><td>Replacement property basis</td><td class="num">${fmtMoney(r.repBasis)}</td></tr>
        <tr><td>&nbsp;&nbsp;&nbsp;Carryover basis (continuing depreciation on relinquished schedule)</td><td class="num">${fmtMoney(r.carryoverBasis)}</td></tr>
        <tr><td>&nbsp;&nbsp;&nbsp;Excess basis (new depreciation schedule, full applicable life)</td><td class="num">${fmtMoney(r.excessBasis)}</td></tr>
      </table>

      <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">F. Deferred Tax (the Power of § 1031)</h4>
      <table class="boot-table">
        <tr><td>Hypothetical federal tax on full sale</td><td class="num">${fmtMoney(r.hypFedTax)}</td></tr>
        <tr><td>Less: federal tax recognized now (boot)</td><td class="num">(${fmtMoney(r.fedTaxRecognized)})</td></tr>
        <tr class="total"><td><strong>Federal tax deferred via § 1031</strong></td><td class="num"><strong>${fmtMoney(r.deferredFedTax)}</strong></td></tr>
        <tr><td>State tax deferred</td><td class="num">${fmtMoney(r.deferredStateTax)}</td></tr>
      </table>
    `;

    // Multi-year projection (members only, if hold years entered)
    html += renderMultiYearProjection(projection, r);
  } else {
    // Public tier: lock the tax detail + basis + deferred tax + multi-year sections
    const placeholder = `
      <div style="padding:1.5rem 2rem;">
        <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin: 0 0 0.5rem 0; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">Tax Detail · Replacement Basis · Deferred Tax · Multi-Year Projection</h4>
        <p style="font-size: 0.9rem; color: #4a4a4a; line-height: 1.55;">Federal tax allocation across § 1245 recapture, § 1250 unrecaptured gain, residual LTCG, and NIIT. Replacement property basis bifurcated into carryover (continuing depreciation on the relinquished schedule per Reg. § 1.168(i)-6) and excess (new asset life). Deferred federal and state tax computation. Multi-year depreciation projection on the replacement property with year-of-sale exposure analysis.</p>
      </div>`;
    html += tierLock(
      placeholder,
      'Full Tax & Basis Analysis — Member Access',
      'Federal tax detail, replacement basis bifurcation under Reg. § 1.168(i)-6, deferred federal and state tax, and the multi-year holding-period projection are available to Gold, Platinum, and Reserve members.'
    );
  }

  // State conformity card — visible to all
  html += `
    <div class="info-card" style="margin-top: 1rem;">
      <strong>State conformity:</strong> ${stateConformText}
    </div>
    <div class="info-card">
      <strong>Identification rule selected:</strong> ${idRuleText(idRule)}.<br>
      ${idRule === 'three' ? 'Identify up to 3 replacement properties of any aggregate FMV. Most common in practice.'
        : idRule === '200' ? 'Identify any number of properties with aggregate FMV ≤ 200% of the relinquished property\'s FMV. Useful when uncertain about deal closings.'
        : 'Identify any number of properties; must acquire ≥ 95% of total identified aggregate FMV. Strictest rule, rarely used.'}
    </div>
  `;

  // Outcome summary
  if (isFullDeferral) {
    html += `
      <div class="info-card" style="background: rgba(22,155,98,0.10); border-left: 4px solid #169B62;">
        <strong>Full deferral achieved.</strong> No boot, no recognition. The full ${fmtMoney(r.realizedGain)} of realized gain is deferred under § 1031(a)(1). The deferred amount reduces the replacement property's basis to ${fmtMoney(r.repBasis)} (instead of its FMV of ${fmtMoney(inputs.repFMV)}). When the replacement property is sold in a taxable disposition, the deferred gain will be recognized (unless deferred again or eliminated at death under § 1014).
      </div>`;
  } else if (r.recognizedGain >= r.realizedGain) {
    html += `
      <div class="info-card warn">
        <strong>No deferral achieved.</strong> Boot equals or exceeds realized gain — the full gain is recognized. Consider modifying the exchange structure to reduce boot or evaluate whether a non-exchange disposition is preferable.
      </div>`;
  } else {
    html += `
      <div class="info-card">
        <strong>Partial deferral.</strong> ${fmtMoney(r.recognizedGain)} of gain is recognized now (triggered by ${fmtMoney(r.totalBoot)} of boot); the remaining ${fmtMoney(r.deferredGain)} is deferred into the replacement property's basis. To eliminate the recognition, restructure to avoid boot: increase replacement mortgage to match relinquished, add cash to the replacement side, or avoid receiving cash from the QI.
      </div>`;
  }

  document.getElementById('results_body').innerHTML = html;
  const panel = document.getElementById('results');
  panel.classList.add('show');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =============================================================================
// REVERSE EXCHANGE (Phase 2) — Rev. Proc. 2000-37 QEAA Safe Harbor
// =============================================================================
// Two parking variants:
//   'rep-park'  — Exchange Last: EAT parks REPLACEMENT property; taxpayer later
//                 sells relinquished and acquires from the EAT. Most common.
//   'rel-park'  — Exchange First: EAT parks RELINQUISHED property; taxpayer
//                 immediately acquires replacement; EAT later sells relinquished.
//
// Both variants subject to 180-day cap from the EAT acquisition date. The 45-day
// identification clock runs from the EAT acquisition date, with the identified
// property being either the relinquished (rep-park) or replacement (rel-park).
//
// Improvement-exchange addendum: improvements built during parking become part
// of the replacement property's value at delivery, provided they are sufficiently
// completed by day 180. See Bartell v. Comm'r, 147 T.C. No. 5 (2016) for the
// outside-safe-harbor pre-2000-37 case-law treatment; the safe harbor is the
// recommended path.

function calculateReverse() {
  // Tier check — reverse is available at Platinum and above
  if (!isPlatinum()) {
    alert('Reverse exchange analysis is available to Platinum and Reserve members.');
    return;
  }

  const variant = (document.getElementById('rev_variant') || {}).value || 'rep-park';
  const includeImprovements = (document.getElementById('rev_improvements') || {}).value === 'yes';

  const inputs = {
    relFMV:       getValue('rev_rel_fmv'),
    relSellExp:   getValue('rev_rel_sell_exp'),
    relBasis:     getValue('rev_rel_basis'),
    relAccumDep:  getValue('rev_rel_accum_dep'),
    rel1245Dep:   getValue('rev_rel_1245_dep'),
    relMortgage:  getValue('rev_rel_mortgage'),
    repFMV:       getValue('rev_rep_fmv'),
    repMortgage:  getValue('rev_rep_mortgage'),
    cashAdded:    getValue('rev_cash_added'),
    cashReceived: getValue('rev_cash_received'),
    eatFees:      getValue('rev_eat_fees'),
    improvementCost: includeImprovements ? getValue('rev_improvement_cost') : 0,
    marginalRate: getValue('rev_marginal_rate', 37) / 100,
    ltcgRate:     getValue('rev_ltcg_rate', 20) / 100,
    unrec1250Rate:getValue('rev_unrec_1250_rate', 25) / 100,
    niitRate:     getValue('rev_niit_rate', 3.8) / 100,
    stateRate:    getValue('rev_state_rate', 5) / 100,
    stateCode:    (document.getElementById('rev_state_select') || {}).value || 'FL',
    use121:       false,    // §121 not typically available in reverse — primarily commercial/investment
    exclusion121: 0,
    applyDLTS:    false     // DLTS doesn't apply to reverse (no §121 layering); future Phase could extend
  };

  if (inputs.relFMV <= 0 || inputs.repFMV <= 0) {
    alert('Enter the fair market values of both the relinquished and replacement properties.');
    return;
  }

  const r = computeExchange(inputs);

  // QEAA timeline computation
  const eatAcquireDate = (document.getElementById('rev_eat_acquire_date') || {}).value || '';
  const exchangeClose  = (document.getElementById('rev_exchange_close_date') || {}).value || '';
  const timeline = computeReverseTimeline(eatAcquireDate, exchangeClose, variant);

  // Multi-year projection on the replacement (same as forward — Reserve gets it)
  let projection = null;
  const holdYears = Math.round(getValue('rev_hold_years', 0));
  if (holdYears > 0) {
    const propertyType = (document.getElementById('rev_property_type') || {}).value || 'commercial';
    const remainingLife = getValue('rev_remaining_life', propertyType === 'commercial' ? 30 : 20);
    projection = computeMultiYearProjection(r, holdYears, propertyType, remainingLife);
  }

  renderReverseResults({
    r, timeline, variant, includeImprovements, projection,
    idRule: getIDRule('rev'),
    inputs
  });
}

function computeReverseTimeline(eatDate, exchangeCloseDate, variant) {
  if (!eatDate) return null;
  const day45 = addDaysISO(eatDate, 45);
  const day180 = addDaysISO(eatDate, 180);
  let actualDays = null;
  let safeHarborStatus = 'pending';
  if (exchangeCloseDate) {
    actualDays = daysBetween(eatDate, exchangeCloseDate);
    if (actualDays != null) {
      safeHarborStatus = actualDays <= 180 ? 'within' : 'blown';
    }
  }
  return {
    variant, eatDate, day45, day180, exchangeCloseDate, actualDays, safeHarborStatus
  };
}

function renderReverseResults(ctx) {
  const { r, timeline, variant, includeImprovements, projection, idRule, inputs } = ctx;
  const stateName = (STATES_1031[inputs.stateCode] || {}).name || '';
  const stateConforms = r.stateConforms;
  const stateConformText =
    stateConforms === 'no_tax'  ? `${stateName} imposes no state income tax — no state-level deferral concern.`
  : stateConforms === 'special' ? `${stateName} conforms to federal § 1031 but imposes a tracking/claw-back requirement: ${STATES_1031[inputs.stateCode].note}.`
  :                               `${stateName} conforms to federal § 1031 treatment.`;

  let html = `<div class="tier-banner tier-client">
    <div class="tier-banner-text"><strong>Member analysis — Reverse Exchange under Rev. Proc. 2000-37.</strong> Parking-arrangement variant: <strong>${variant === 'rep-park' ? 'Exchange Last (replacement parked)' : 'Exchange First (relinquished parked)'}</strong>${includeImprovements ? '; improvement-exchange addendum active.' : '.'}</div>
  </div>`;

  // QEAA Timeline visualization
  html += renderReverseTimeline(timeline, idRule);

  // Headline
  html += `
    <div class="result-headline">
      <div class="result-headline-label">Recognized Gain (Boot Triggered)</div>
      <div class="result-headline-value">${fmtMoney(r.recognizedGain)}</div>
      <div class="result-headline-grid">
        <div>
          <div class="result-headline-sub-label">DEFERRED GAIN</div>
          <div class="result-headline-sub-value">${fmtMoney(r.deferredGain)}</div>
        </div>
        <div>
          <div class="result-headline-sub-label">DEFERRED FED TAX</div>
          <div class="result-headline-sub-value">${fmtMoney(r.deferredFedTax)}</div>
        </div>
        <div>
          <div class="result-headline-sub-label">REPLACEMENT BASIS</div>
          <div class="result-headline-sub-value">${fmtMoney(r.repBasis)}</div>
        </div>
      </div>
    </div>
  `;

  // QEAA Structure callout
  html += renderQEAAStructure(variant, includeImprovements, inputs, r);

  // A. Realized gain (with EAT fees rolled into selling expenses)
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">A. Realized Gain Computation (§ 1001(a))</h4>
    <table class="boot-table">
      <tr><td>Fair market value of relinquished property</td><td class="num">${fmtMoney(inputs.relFMV)}</td></tr>
      <tr><td>Less: ordinary selling expenses</td><td class="num">(${fmtMoney(inputs.relSellExp)})</td></tr>
      <tr><td>Less: EAT / QI fees and parking costs (transaction cost)</td><td class="num">(${fmtMoney(inputs.eatFees)})</td></tr>
      <tr><td><strong>Amount realized</strong></td><td class="num"><strong>${fmtMoney(r.amountRealized)}</strong></td></tr>
      <tr><td>Less: adjusted basis of relinquished property</td><td class="num">(${fmtMoney(inputs.relBasis)})</td></tr>
      <tr class="total"><td>Realized gain</td><td class="num">${fmtMoney(r.realizedGain)}</td></tr>
    </table>
    <p style="font-size: 0.85rem; color: #4a4a4a; margin-top: 0.5rem;">EAT and QI fees in a reverse exchange are properly treated as transaction costs reducing the amount realized on the relinquished property. Title-holding fees, accommodation fees, parking-period property tax and insurance reimbursed to the EAT, and the EAT's legal and entity-formation costs all qualify. Cost-benefit: a typical reverse exchange runs $7,500–$25,000 in EAT/QI fees against the deferred federal tax shown below.</p>
  `;

  // B. Boot analysis (same as forward)
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">B. Boot Analysis (§ 1031(b))</h4>
    <table class="boot-table">
      <tr><td>Cash received by taxpayer</td><td class="num">${fmtMoney(inputs.cashReceived)}</td></tr>
      <tr><td>Relinquished mortgage</td><td class="num">${fmtMoney(inputs.relMortgage)}</td></tr>
      <tr><td>Less: replacement mortgage</td><td class="num">(${fmtMoney(inputs.repMortgage)})</td></tr>
      <tr><td>Gross mortgage boot (debt relief)</td><td class="num">${fmtMoney(r.grossMortgageBoot)}</td></tr>
      <tr><td>Less: cash added by taxpayer (offsets mortgage boot)</td><td class="num">(${fmtMoney(Math.min(r.grossMortgageBoot, inputs.cashAdded))})</td></tr>
      <tr><td><strong>Net cash boot received</strong></td><td class="num"><strong>${fmtMoney(r.netCashBoot)}</strong></td></tr>
      <tr><td><strong>Net mortgage boot</strong></td><td class="num"><strong>${fmtMoney(r.netMortgageBoot)}</strong></td></tr>
      <tr class="total"><td>Total boot</td><td class="num">${fmtMoney(r.totalBoot)}</td></tr>
    </table>
    <p style="font-size: 0.85rem; color: #4a4a4a; margin-top: 0.5rem;">Boot mechanics in a reverse exchange follow the same rules as a forward exchange. The QEAA structure determines <em>who holds title when</em>; it does not change the gain-recognition arithmetic.</p>
  `;

  // C. Recognized vs deferred
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">C. Recognized vs. Deferred Gain</h4>
    <table class="boot-table">
      <tr><td>Realized gain</td><td class="num">${fmtMoney(r.realizedGain)}</td></tr>
      <tr><td>Total boot</td><td class="num">${fmtMoney(r.totalBoot)}</td></tr>
      <tr><td><strong>Recognized gain</strong> (lesser of realized gain or boot)</td><td class="num"><strong>${fmtMoney(r.recognizedGain)}</strong></td></tr>
      ${r.recognizedGain > 0 ? `
        <tr><td>&nbsp;&nbsp;&nbsp;Allocated to § 1245 recapture (ordinary income)</td><td class="num">${fmtMoney(r.recapture1245)}</td></tr>
        <tr><td>&nbsp;&nbsp;&nbsp;Allocated to § 1250 unrecaptured (25% max)</td><td class="num">${fmtMoney(r.recapture1250)}</td></tr>
        <tr><td>&nbsp;&nbsp;&nbsp;Allocated to LTCG (residual)</td><td class="num">${fmtMoney(r.recogLTCG)}</td></tr>
      ` : ''}
      <tr class="total"><td>Deferred gain</td><td class="num">${fmtMoney(r.deferredGain)}</td></tr>
    </table>
  `;

  // D. Tax detail
  if (r.recognizedGain > 0) {
    html += `
      <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">D. Tax on Recognized Gain</h4>
      <table class="boot-table">
        <tr><td>Tax on § 1245 recapture @ ${(inputs.marginalRate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.tax1245)}</td></tr>
        <tr><td>Tax on § 1250 unrecaptured @ ${(inputs.unrec1250Rate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.tax1250)}</td></tr>
        <tr><td>Tax on LTCG @ ${(inputs.ltcgRate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.taxLTCG)}</td></tr>
        <tr><td>NIIT @ ${(inputs.niitRate*100).toFixed(1)}% (on § 1250 + LTCG)</td><td class="num">${fmtMoney(r.niit)}</td></tr>
        <tr class="total"><td>Total federal tax on recognized gain</td><td class="num">${fmtMoney(r.fedTaxRecognized)}</td></tr>
        <tr><td>State tax @ ${(inputs.stateRate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.stateTaxRecognized)}</td></tr>
      </table>
    `;
  }

  // E. Replacement basis (with improvements)
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">E. Replacement Property Basis (§ 1031(d))</h4>
    <table class="boot-table">
      <tr><td>FMV of replacement property (at EAT acquisition)</td><td class="num">${fmtMoney(inputs.repFMV)}</td></tr>
      ${includeImprovements ? `<tr><td>Plus: improvements completed during parking (added to basis)</td><td class="num">${fmtMoney(inputs.improvementCost)}</td></tr>
      <tr><td><strong>Replacement FMV including improvements</strong></td><td class="num"><strong>${fmtMoney(r.repFMVWithImprovements)}</strong></td></tr>` : ''}
      <tr><td>Less: deferred gain</td><td class="num">(${fmtMoney(r.deferredGain)})</td></tr>
      <tr class="total"><td>Replacement property basis</td><td class="num">${fmtMoney(r.repBasis)}</td></tr>
      <tr><td>&nbsp;&nbsp;&nbsp;Carryover basis (continuing depreciation on relinquished schedule)</td><td class="num">${fmtMoney(r.carryoverBasis)}</td></tr>
      <tr><td>&nbsp;&nbsp;&nbsp;Excess basis (new depreciation schedule, full applicable life)</td><td class="num">${fmtMoney(r.excessBasis)}</td></tr>
    </table>
  `;

  // F. Deferred tax
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">F. Deferred Tax</h4>
    <table class="boot-table">
      <tr><td>Hypothetical federal tax on full sale</td><td class="num">${fmtMoney(r.hypFedTax)}</td></tr>
      <tr><td>Less: federal tax recognized now (boot)</td><td class="num">(${fmtMoney(r.fedTaxRecognized)})</td></tr>
      <tr class="total"><td><strong>Federal tax deferred via § 1031</strong></td><td class="num"><strong>${fmtMoney(r.deferredFedTax)}</strong></td></tr>
      <tr><td>State tax deferred</td><td class="num">${fmtMoney(r.deferredStateTax)}</td></tr>
      <tr><td>Net of EAT/QI fees (${fmtMoney(inputs.eatFees)} of transaction costs)</td><td class="num">${fmtMoney(r.deferredFedTax - inputs.eatFees)}</td></tr>
    </table>
    <p style="font-size: 0.85rem; color: #4a4a4a; margin-top: 0.5rem;">The "net of fees" row is the practical economic deferral after accounting for the EAT/QI cost of structuring the reverse. Positive value confirms the reverse pencils out economically; negative value (very rare) means the structuring cost exceeds the deferral benefit.</p>
  `;

  // Multi-year projection (Reserve gets it; reverse exchanges are typically commercial)
  html += renderMultiYearProjection(projection, r);

  // State conformity + Identification rule
  html += `
    <div class="info-card" style="margin-top: 1rem;">
      <strong>State conformity:</strong> ${stateConformText}
    </div>
    <div class="info-card">
      <strong>Identification rule selected:</strong> ${idRuleText(idRule)}.
      In a reverse exchange under the rep-park variant, the 45-day identification clock runs from the EAT acquisition of the replacement property and identifies the <em>relinquished</em> property to be sold. In the rel-park variant, the clock runs from the EAT acquisition of the relinquished property and identifies the <em>replacement</em>.
    </div>
  `;

  // Strategy considerations
  html += renderReverseStrategyConsiderations(variant, includeImprovements, timeline, inputs, r);

  document.getElementById('results_body').innerHTML = html;
  const panel = document.getElementById('results');
  panel.classList.add('show');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderReverseTimeline(t, idRule) {
  if (!t) {
    return '<div class="info-card warn"><strong>Enter the EAT acquisition date</strong> above to visualize the 45-day identification and 180-day exchange completion windows under Rev. Proc. 2000-37.</div>';
  }

  let statusBanner = '';
  if (t.safeHarborStatus === 'within') {
    statusBanner = `<div class="info-card" style="background: rgba(22,155,98,0.10); border-left: 4px solid #169B62; margin-bottom: 1rem;">
      <strong>Within safe harbor.</strong> Exchange completion at day ${t.actualDays} of 180. Rev. Proc. 2000-37 safe harbor preserved.
    </div>`;
  } else if (t.safeHarborStatus === 'blown') {
    statusBanner = `<div class="info-card warn" style="margin-bottom: 1rem;">
      <strong>Safe harbor blown — exchange completion at day ${t.actualDays} of 180.</strong> The Rev. Proc. 2000-37 safe harbor is no longer available. The transaction may still qualify under the pre-2000-37 case-law standard articulated in Bartell v. Comm'r, 147 T.C. No. 5 (2016), but the analysis is fact-specific and the IRS may challenge the structure. Strongly consider engagement-level review before relying on a non-safe-harbor reverse.
    </div>`;
  }

  return `
    ${statusBanner}
    <div class="timeline-vis">
      <h4>Rev. Proc. 2000-37 QEAA Timeline</h4>
      <div style="font-size: 0.85rem; color: #6b6b6b; margin-bottom: 0.4rem;">EAT acquires parked property: <strong style="color: #1a1a1a;">${formatDate(t.eatDate)}</strong></div>
      <div class="timeline-bar">
        <div class="timeline-fill-180"></div>
        <div class="timeline-fill-45"></div>
        <div class="timeline-marker" style="left: 0;">
          <div class="timeline-marker-label" style="left: 20px; transform: none;">EAT acquires</div>
          <div class="timeline-marker-date" style="left: 20px; transform: none;">${formatDate(t.eatDate)}</div>
        </div>
        <div class="timeline-marker" style="left: 25%;">
          <div class="timeline-marker-label">Day 45 (ID)</div>
          <div class="timeline-marker-date">${formatDate(t.day45)}</div>
        </div>
        <div class="timeline-marker" style="left: 100%;">
          <div class="timeline-marker-label" style="left: auto; right: 20px; transform: none;">Day 180 (close)</div>
          <div class="timeline-marker-date" style="left: auto; right: 20px; transform: none;">${formatDate(t.day180)}</div>
        </div>
      </div>
      <div class="timeline-row">
        <div class="timeline-cell warn">
          <strong>45-Day Identification</strong>
          ${formatDate(t.day45)}<br>
          <span style="font-size: 0.78rem; color: #6b6b6b;">${t.variant === 'rep-park' ? 'Identify the relinquished property to be sold' : 'Identify the replacement property to be acquired'} in writing to the EAT/QI.</span>
        </div>
        <div class="timeline-cell">
          <strong>180-Day Exchange Completion</strong>
          ${formatDate(t.day180)}<br>
          <span style="font-size: 0.78rem; color: #6b6b6b;">EAT must transfer the parked property to the taxpayer (or to the buyer of relinquished) by this date. No statutory extension.</span>
        </div>
        <div class="timeline-cell">
          <strong>Identification Rule</strong>
          ${idRuleShort(idRule)}<br>
          <span style="font-size: 0.78rem; color: #6b6b6b;">${idRuleText(idRule).split('(')[1].replace(')','')}</span>
        </div>
      </div>
    </div>
  `;
}

function renderQEAAStructure(variant, includeImprovements, inputs, r) {
  const variantDescription = variant === 'rep-park'
    ? `<strong>Exchange Last (replacement parked).</strong> The EAT takes title to the replacement property at the outset using funds advanced by the taxpayer or financed in the EAT's name. The taxpayer then has 45 days to identify the relinquished property to be sold and 180 days from the EAT acquisition to close the relinquished sale and take title to the replacement from the EAT. Most common variant in practice — used when the replacement property is available immediately but the taxpayer cannot find a buyer for the relinquished within the forward exchange's 180-day window.`
    : `<strong>Exchange First (relinquished parked).</strong> The EAT takes title to the relinquished property; the taxpayer immediately receives the sale proceeds and uses them to acquire the replacement (which the taxpayer titles directly). The EAT then has 180 days to sell the relinquished property to a third party. Less common — used when the relinquished property is hard to value precisely or the taxpayer needs certainty of replacement acquisition before letting go of the relinquished asset.`;

  const improvementsBlock = includeImprovements ? `
    <p style="margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed #d4d4d0;"><strong>Improvement-exchange addendum.</strong> The EAT holds title while improvements totaling ${fmtMoney(inputs.improvementCost)} are constructed on the parked property. Improvements must be sufficiently complete by day 180 to be included in the value delivered; partially-complete improvements may not count toward the like-kind value test under § 1031(a)(1). The improvement value adds to the replacement's basis dollar-for-dollar.</p>` : '';

  return `
    <div class="info-card" style="border-left: 4px solid #169B62;">
      <div style="font-family: 'Gotham Bold', sans-serif; color: #107a4d; font-size: 0.95rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase;">QEAA Structure under Rev. Proc. 2000-37</div>
      <p style="margin: 0;">${variantDescription}</p>
      ${improvementsBlock}
    </div>
  `;
}

function renderReverseStrategyConsiderations(variant, includeImprovements, timeline, inputs, r) {
  const issues = [];

  // 180-day cap
  if (timeline && timeline.actualDays != null) {
    if (timeline.safeHarborStatus === 'within') {
      issues.push(`<li><strong>180-day cap satisfied:</strong> exchange completed at day ${timeline.actualDays} of 180. Safe harbor preserved.</li>`);
    } else {
      issues.push(`<li><strong>180-day cap exceeded</strong> at day ${timeline.actualDays}. The Rev. Proc. 2000-37 safe harbor is unavailable. Consider whether non-safe-harbor treatment under Bartell is defensible on the facts, or whether to abandon the exchange and recognize gain.</li>`);
    }
  } else {
    issues.push(`<li><strong>180-day cap:</strong> enter the EAT acquisition date and the actual exchange completion date to verify safe harbor compliance.</li>`);
  }

  // EAT economics
  if (inputs.eatFees > 0 && r.deferredFedTax > 0) {
    const ratio = (inputs.eatFees / r.deferredFedTax) * 100;
    issues.push(`<li><strong>EAT/QI cost ratio:</strong> ${fmtMoney(inputs.eatFees)} of structuring cost against ${fmtMoney(r.deferredFedTax)} of deferred federal tax (${ratio.toFixed(1)}% of the deferral benefit). ${ratio < 10 ? 'Strongly favorable economics.' : ratio < 25 ? 'Reasonable economics; reverse pencils.' : 'Marginal economics — verify the deferral materially exceeds the structuring cost net of time-value considerations.'}</li>`);
  }

  // Variant-specific risks
  if (variant === 'rep-park') {
    issues.push(`<li><strong>Funding the EAT (rep-park variant):</strong> The taxpayer typically lends funds to the EAT to acquire the replacement or guarantees the EAT's financing. Loan must be on commercially reasonable terms; the EAT should not be a sham entity. Verify EAT has independent existence and legitimate business purpose beyond the exchange.</li>`);
    issues.push(`<li><strong>Lease-back during parking:</strong> Taxpayer may lease the parked replacement property from the EAT during the parking period for use or to generate income. Lease must be on arm's-length terms; rents must be reasonable to avoid recharacterization.</li>`);
  } else {
    issues.push(`<li><strong>EAT carrying the relinquished (rel-park variant):</strong> The EAT bears the burden of finding a buyer within 180 days. If no buyer is found, the EAT may need to sell at a discount or the exchange may collapse. Verify the relinquished property's marketability before electing this variant.</li>`);
    issues.push(`<li><strong>Replacement acquired immediately (rel-park):</strong> The taxpayer takes title to the replacement at outset, with sale proceeds from the relinquished delivered through the QI/EAT. The taxpayer has the use of the replacement during the entire parking period; useful when the replacement is income-producing or operationally critical to start immediately.</li>`);
  }

  // Improvement exchange
  if (includeImprovements) {
    issues.push(`<li><strong>Improvement timing (Reg. § 1.1031(k)-1(e)):</strong> Improvements must be sufficiently complete by day 180 to count toward like-kind value. Construction risk during parking — weather delays, permit delays, or contractor disputes that push completion past day 180 result in the improvements being treated as boot rather than like-kind property. Insurance and aggressive scheduling are critical.</li>`);
    issues.push(`<li><strong>Bartell v. Commissioner (147 T.C. No. 5 (2016)):</strong> The Tax Court approved a non-safe-harbor reverse improvement exchange where the EAT held the property for ~17 months while improvements were built. The case provides authority for parking periods beyond 180 days in extreme cases, but the IRS continues to view the safe harbor as the recommended path. Engagement-level review required for any non-safe-harbor reverse.</li>`);
  }

  // California specific
  if (inputs.stateCode === 'CA') {
    issues.push(`<li><strong>California FTB 3840 reporting:</strong> If the relinquished property is California real estate, the taxpayer must file Form 3840 annually until the deferred gain is ultimately recognized in California or extinguished at death. Failure to file produces immediate California gain recognition. Tracking the parked period plus subsequent holding period of the replacement is essential.</li>`);
  } else if (inputs.stateCode === 'OR') {
    issues.push(`<li><strong>Oregon Form 24 reporting:</strong> Similar to California's FTB 3840, Oregon requires annual tracking of deferred gain on out-of-state replacements via Form 24.</li>`);
  }

  return `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">Strategy Considerations — Reverse Exchange</h4>
    <div class="info-card">
      <ul style="margin: 0; padding-left: 1.25rem; line-height: 1.7;">
        ${issues.join('')}
      </ul>
    </div>
  `;
}

// =============================================================================
// DROP-AND-SWAP (Phase 4) — Partnership-level § 1031
// =============================================================================
// Two variants:
//   drop-swap (drop-then-swap): Partnership distributes property to partners as
//     TICs BEFORE the exchange. Each partner then individually elects § 1031 or
//     cashes out. Direct partnership authority: Mason v. Comm'r, T.C. Memo
//     1988-273. Corporate analog: Bolker v. Comm'r, 81 T.C. 782 (1983),
//     aff'd 760 F.2d 1039 (9th Cir. 1985).
//   swap-drop (swap-then-drop): Partnership does § 1031 in its own name, then
//     distributes the replacement to partners as TICs. Direct partnership
//     authority: Magneson v. Comm'r, 81 T.C. 767 (1983), aff'd 753 F.2d 1490
//     (9th Cir. 1985). Corporate analog: Maloney v. Comm'r, 93 T.C. 89 (1989).
//
// Both turn on whether the property was "held for productive use in a trade or
// business or for investment" under § 1031(a)(1). The IRS challenges these on
// step-transaction (Commissioner v. Court Holding Co., 324 U.S. 331 (1945)) and
// business-purpose grounds when the gap between distribution and exchange is
// short. None of the cases sets a bright-line holding-period safe harbor; the
// calculator therefore reports a gap-day risk gradient, not a pass/fail.
//
// Partnership interests are not eligible for § 1031 — post-TCJA (2017),
// § 1031(a)(1) is limited to real property, and partnership interests are
// personal property. The structural workaround is to convert the partnership's
// real-property holding into directly-held TIC interests before (drop-swap) or
// after (swap-drop) the exchange. (Former § 1031(a)(2)(D), added by DEFRA '84,
// Pub. L. No. 98-369, § 77, expressly excluded partnership interests; post-TCJA
// the exclusion follows from the real-property limitation itself.)
//
// Modeling approach (intentionally simplified for scenario planning; engagement-
// level review required for any actual transaction):
//   - Each partner is allocated FMV, sell expenses, accumulated depreciation,
//     § 1245 amounts, and mortgage by ownership percentage.
//   - Each partner's basis after distribution is treated as their pre-distribution
//     outside basis in the partnership interest (the § 732(b) liquidating-
//     distribution result, which is the most common drop-and-swap structure).
//   - For § 1031-electing partners: computeExchange is called per-partner with
//     their allocated amounts and individual tax profile.
//   - For cash-out partners: realized gain is recognized in full at the partner
//     level, with § 1245 first, then § 1250 (capped at allocated § 1250 dep),
//     then LTCG, plus NIIT on § 1250 and LTCG portions.
//   - Cash boot and cash added are allocated pro-rata to ownership.
// =============================================================================

// Holding-period gap classification. Returns one of four bands keyed on the
// number of days between distribution and exchange. Per the case-law review
// (Magneson, Bolker, Maloney, Mason) NO bright-line safe harbor exists; these
// labels are risk gradients, not legal conclusions, and the UI copy says so.
function computeDropSwapHoldingGap(distributionDateISO, exchangeDateISO, variant) {
  if (!distributionDateISO || !exchangeDateISO) {
    return {
      gapDays: null,
      classification: 'unknown',
      label: 'Dates required',
      message: 'Enter both the distribution date and the exchange close date to assess holding-period risk.'
    };
  }
  // For drop-swap: distribution comes first, then exchange. Gap = exchange - distribution.
  // For swap-drop: exchange comes first, then distribution. Gap = distribution - exchange.
  // In either case, absolute value of the day count is what matters for IRS scrutiny.
  let rawGap;
  if (variant === 'swap-drop') {
    rawGap = daysBetween(exchangeDateISO, distributionDateISO);
  } else {
    rawGap = daysBetween(distributionDateISO, exchangeDateISO);
  }
  const gapDays = Math.abs(rawGap);
  // Same-day distributions sit in a uniquely exposed posture under the step-
  // transaction doctrine (Court Holding). Magneson's same-day swap-then-drop
  // succeeded, but it is the outlier, and a same-day drop-then-swap is much
  // weaker because no individual investment intent can mature in the gap.
  if (gapDays <= 30) {
    return {
      gapDays,
      classification: 'critical',
      label: `${gapDays}-day gap — critical risk`,
      message: 'Gap of 30 days or less. Step-transaction (Court Holding) and business-purpose challenges are likely. Magneson succeeded on a same-day swap-then-drop because the partnership was the continuing investment vehicle; a same-day drop-then-swap presents materially weaker facts. Engagement-level structural review essential before proceeding.'
    };
  }
  if (gapDays < 180) {
    return {
      gapDays,
      classification: 'red',
      label: `${gapDays}-day gap — significant risk`,
      message: 'Gap is under six months. The IRS commonly raises step-transaction and "held for investment" challenges in this range. The taxpayer-favorable cases (Mason, Bolker) involved facts beyond just the elapsed time — documented investment intent, separate negotiation, and business reasons for the restructuring. Strong documentary record required.'
    };
  }
  if (gapDays < 730) {
    return {
      gapDays,
      classification: 'yellow',
      label: `${gapDays}-day gap — moderate risk`,
      message: 'Gap is between six months and two years. Heightened audit scrutiny, but case-law trends are more taxpayer-favorable in this range. Documentary evidence of investment intent at the moment of exchange remains essential. No bright-line safe harbor — outcome depends on facts and circumstances.'
    };
  }
  return {
    gapDays,
    classification: 'green',
    label: `${gapDays}-day gap — lower risk`,
    message: 'Gap is two years or longer. Case-law trends are taxpayer-favorable in this range, particularly where the property has been rented or otherwise used for investment during the interval. There is still no bright-line safe harbor; documentary evidence of investment intent remains essential and the IRS may still raise step-transaction in egregious factual patterns.'
  };
}

// California FTB exposure flag — fires when the relinquished property is in CA.
// The FTB tracks deferred California-source gain under FTB 3840 and has been
// historically skeptical of drop-and-swap structures with short gap periods.
// The flag warns but asserts no specific outcome (no published FTB ruling on
// the drop-and-swap question is cited in user-facing copy).
function computeDropSwapCAFTBFlag(propertyStateCode, holdingGap) {
  if (propertyStateCode !== 'CA') {
    return { triggered: false, message: '' };
  }
  let severity = 'standard';
  if (holdingGap && (holdingGap.classification === 'critical' || holdingGap.classification === 'red')) {
    severity = 'elevated';
  }
  const baseMsg = 'Relinquished property is California real estate. The Franchise Tax Board tracks deferred California-source gain under FTB 3840 indefinitely (claw-back applies on ultimate disposition outside CA). The FTB has historically scrutinized drop-and-swap structures more aggressively than the IRS, particularly where the gap between distribution and exchange is short.';
  const elevatedAddendum = ' Given the short holding-period gap in this scenario, CA-specific structural review is strongly recommended before proceeding.';
  return {
    triggered: true,
    severity,
    message: severity === 'elevated' ? baseMsg + elevatedAddendum : baseMsg
  };
}

// Case-authority lookup for the doctrinal walk-through. Returns the primary
// partnership-level case for the chosen variant and the corporate-level analog.
function dropSwapCaseAuthority(variant) {
  if (variant === 'swap-drop') {
    return {
      direction: 'swap-then-drop',
      primary: {
        name: 'Magneson v. Commissioner',
        cite: '81 T.C. 767 (1983), aff\'d, 753 F.2d 1490 (9th Cir. 1985)',
        holding: 'Taxpayer exchanged real estate and on the same day contributed the replacement to a partnership in exchange for a general partnership interest. The Ninth Circuit held the § 1031 exchange satisfied the "holding for investment" requirement because the partnership contribution was a continuation of the investment in modified form, not a liquidation of it. § 1031 and § 721 both sustained.'
      },
      corporateAnalog: {
        name: 'Maloney v. Commissioner',
        cite: '93 T.C. 89 (1989)',
        holding: 'Corporation exchanged real estate in a § 1031 transaction and then liquidated under § 333, distributing the replacement to its shareholders. The Tax Court sustained § 1031 nonrecognition, holding that the subsequent liquidation did not retroactively defeat the corporation\'s investment purpose at the moment of exchange.'
      }
    };
  }
  // Default: drop-then-swap
  return {
    direction: 'drop-then-swap',
    primary: {
      name: 'Mason v. Commissioner',
      cite: 'T.C. Memo 1988-273',
      holding: 'Partnerships terminated and distributed property to the partner under § 731. The partner then individually exchanged the distributed property under § 1031. The Tax Court sustained nonrecognition, holding the individual partner satisfied the "held for productive use" requirement notwithstanding the recency of the § 731 distribution.'
    },
    corporateAnalog: {
      name: 'Bolker v. Commissioner',
      cite: '81 T.C. 782 (1983), aff\'d, 760 F.2d 1039 (9th Cir. 1985)',
      holding: 'Corporation liquidated under § 333 and distributed real estate to its sole shareholder, who then exchanged it in a prearranged § 1031 transaction. The Ninth Circuit held that intent to exchange at the moment of acquisition does not defeat the holding requirement so long as the taxpayer\'s economic position in like-kind property is preserved.'
    }
  };
}

// CORE COMPUTATION for Drop-and-Swap / Swap-and-Drop. Pure function, no DOM
// access; unit-testable. Reuses computeExchange per § 1031-electing partner.
function computeDropSwap(inputs) {
  const {
    variant,                  // 'drop-swap' | 'swap-drop'
    property,                 // { fmv, sellExp, insideBasis, accumDep, sec1245Dep, mortgage, stateCode }
    replacement,              // { fmv, mortgage }
    cashAdded,                // deal-level cash added
    cashReceived,             // deal-level cash boot received
    distributionDate,         // ISO date
    exchangeDate,             // ISO date
    partners                  // [{ name, ownershipPct, outsideBasis, elects1031, marginalRate, ltcgRate, unrec1250Rate, niitRate, stateRate, stateCode }]
  } = inputs;

  if (!partners || partners.length === 0) {
    return null;
  }

  // Ownership sanity check — sum should be ~1.0
  const ownershipSum = partners.reduce((s, p) => s + (p.ownershipPct || 0), 0);
  const ownershipWarning = Math.abs(ownershipSum - 1.0) > 0.005
    ? `Partner ownership percentages sum to ${(ownershipSum*100).toFixed(2)}% — should equal 100%. Allocations have been computed on the ownership values as entered; verify before relying on results.`
    : null;

  // Holding-period gap classification
  const holdingPeriod = computeDropSwapHoldingGap(distributionDate, exchangeDate, variant);

  // CA FTB exposure flag (relinquished property state)
  const caFTBFlag = computeDropSwapCAFTBFlag(property.stateCode, holdingPeriod);

  // Case authority for the chosen variant
  const caseAuthority = dropSwapCaseAuthority(variant);

  // Compute partner-level outcomes
  const partnerResults = partners.map(p => {
    const pct = p.ownershipPct || 0;

    // Allocate the property amounts to this partner pro-rata
    const allocatedFMV       = (property.fmv       || 0) * pct;
    const allocatedSellExp   = (property.sellExp   || 0) * pct;
    const allocatedAccumDep  = (property.accumDep  || 0) * pct;
    const allocatedSec1245   = (property.sec1245Dep|| 0) * pct;
    const allocatedMortgage  = (property.mortgage  || 0) * pct;
    const allocatedRepFMV    = (replacement.fmv      || 0) * pct;
    const allocatedRepMort   = (replacement.mortgage || 0) * pct;
    const allocatedCashAdded = (cashAdded     || 0) * pct;
    const allocatedCashRecv  = (cashReceived  || 0) * pct;

    // Partner's basis after distribution = outside basis (§ 732(b) liquidating
    // distribution treatment). User provides this directly.
    const partnerBasis = p.outsideBasis || 0;

    if (p.elects1031) {
      // Run computeExchange with the partner's allocated portion.
      const ex = computeExchange({
        relFMV:        allocatedFMV,
        relSellExp:    allocatedSellExp,
        relBasis:      partnerBasis,
        relAccumDep:   allocatedAccumDep,
        rel1245Dep:    allocatedSec1245,
        relMortgage:   allocatedMortgage,
        repFMV:        allocatedRepFMV,
        repMortgage:   allocatedRepMort,
        cashAdded:     allocatedCashAdded,
        cashReceived:  allocatedCashRecv,
        eatFees: 0, improvementCost: 0,
        marginalRate:  p.marginalRate  || 0,
        ltcgRate:      p.ltcgRate      || 0,
        unrec1250Rate: p.unrec1250Rate || 0,
        niitRate:      p.niitRate      || 0,
        stateRate:     p.stateRate     || 0,
        stateCode:     p.stateCode     || property.stateCode,
        use121: false, exclusion121: 0,
        applyDLTS: false
      });
      return {
        name: p.name || '',
        ownershipPct: pct,
        outsideBasis: partnerBasis,
        elects1031: true,
        stateCode: p.stateCode || property.stateCode,
        allocatedFMV, allocatedSellExp, allocatedAccumDep, allocatedSec1245,
        allocatedMortgage, allocatedRepFMV, allocatedRepMort,
        allocatedCashAdded, allocatedCashRecv,
        realizedGain:   ex.realizedGain,
        recognizedGain: ex.recognizedGain,
        deferredGain:   ex.deferredGain,
        recapture1245:  ex.recapture1245,
        recapture1250:  ex.recapture1250,
        recogLTCG:      ex.recogLTCG,
        federalTax:     ex.fedTaxRecognized,
        stateTax:       ex.stateTaxRecognized,
        totalTax:       ex.fedTaxRecognized + ex.stateTaxRecognized,
        deferredFedTax: ex.deferredFedTax,
        deferredStateTax: ex.deferredStateTax,
        repBasis:       ex.repBasis,
        exchangeResult: ex
      };
    }

    // Cash-out partner: recognize the full allocated realized gain immediately.
    // Recapture stacks § 1245 → § 1250 → LTCG.
    const amountRealized = allocatedFMV - allocatedSellExp;
    const realizedGain = amountRealized - partnerBasis;
    const recognizedGain = Math.max(0, realizedGain);

    // Recapture stacking on the recognized amount
    const allocatedSec1250Pool = Math.max(0, allocatedAccumDep - allocatedSec1245);
    const recapture1245 = Math.min(recognizedGain, allocatedSec1245);
    const rem1 = recognizedGain - recapture1245;
    const recapture1250 = Math.min(rem1, allocatedSec1250Pool);
    const rem2 = rem1 - recapture1250;
    const recogLTCG = Math.max(0, rem2);

    const tax1245 = recapture1245 * (p.marginalRate || 0);
    const tax1250 = recapture1250 * (p.unrec1250Rate || 0);
    const taxLTCG = recogLTCG     * (p.ltcgRate || 0);
    const niit    = (recapture1250 + recogLTCG) * (p.niitRate || 0);
    const federalTax = tax1245 + tax1250 + taxLTCG + niit;

    const partnerStateCode = p.stateCode || property.stateCode;
    const partnerStateConforms = (STATES_1031[partnerStateCode] || {}).conforms;
    const stateTax = (partnerStateConforms === true || partnerStateConforms === 'special')
      ? recognizedGain * (p.stateRate || 0) : 0;

    return {
      name: p.name || '',
      ownershipPct: pct,
      outsideBasis: partnerBasis,
      elects1031: false,
      stateCode: partnerStateCode,
      allocatedFMV, allocatedSellExp, allocatedAccumDep, allocatedSec1245,
      allocatedMortgage, allocatedRepFMV, allocatedRepMort,
      allocatedCashAdded, allocatedCashRecv,
      realizedGain,
      recognizedGain,
      deferredGain: 0,
      recapture1245, recapture1250, recogLTCG,
      federalTax,
      stateTax,
      totalTax: federalTax + stateTax,
      deferredFedTax: 0,
      deferredStateTax: 0,
      repBasis: 0,
      exchangeResult: null
    };
  });

  // Aggregates
  const aggregates = {
    totalFMV:            partnerResults.reduce((s, r) => s + r.allocatedFMV, 0),
    totalRealizedGain:   partnerResults.reduce((s, r) => s + r.realizedGain, 0),
    totalRecognizedGain: partnerResults.reduce((s, r) => s + r.recognizedGain, 0),
    totalDeferredGain:   partnerResults.reduce((s, r) => s + r.deferredGain, 0),
    totalFederalTax:     partnerResults.reduce((s, r) => s + r.federalTax, 0),
    totalStateTax:       partnerResults.reduce((s, r) => s + r.stateTax, 0),
    totalDeferredFedTax: partnerResults.reduce((s, r) => s + r.deferredFedTax, 0),
    totalDeferredStateTax: partnerResults.reduce((s, r) => s + r.deferredStateTax, 0),
    countElecting:       partnerResults.filter(r => r.elects1031).length,
    countCashOut:        partnerResults.filter(r => !r.elects1031).length
  };
  aggregates.totalTax = aggregates.totalFederalTax + aggregates.totalStateTax;
  aggregates.totalDeferredTax = aggregates.totalDeferredFedTax + aggregates.totalDeferredStateTax;

  return {
    variant,
    property, replacement,
    cashAdded, cashReceived,
    distributionDate, exchangeDate,
    partners: partnerResults,
    aggregates,
    ownershipSum,
    ownershipWarning,
    holdingPeriod,
    caFTBFlag,
    caseAuthority
  };
}

// =============================================================================
// DROP-AND-SWAP — DOM ORCHESTRATOR. Gathers inputs, computes, renders.
// =============================================================================
function calculateDropSwap() {
  if (!isReserve()) {
    showLockedModeMessage('drop-swap', 'reserve');
    return;
  }

  const variant = (document.getElementById('ds_variant') || {}).value || 'drop-swap';

  const property = {
    fmv:         getValue('ds_property_fmv'),
    sellExp:     getValue('ds_property_sell_exp'),
    insideBasis: getValue('ds_property_inside_basis'),
    accumDep:    getValue('ds_property_accum_dep'),
    sec1245Dep:  getValue('ds_property_1245_dep'),
    mortgage:    getValue('ds_property_mortgage'),
    stateCode:   (document.getElementById('ds_property_state') || {}).value || 'FL'
  };
  const replacement = {
    fmv:      getValue('ds_replacement_fmv'),
    mortgage: getValue('ds_replacement_mortgage')
  };
  const cashAdded    = getValue('ds_cash_added');
  const cashReceived = getValue('ds_cash_received');
  const distributionDate = (document.getElementById('ds_distribution_date') || {}).value || '';
  const exchangeDate     = (document.getElementById('ds_exchange_date') || {}).value || '';

  const partners = gatherDropSwapPartners();

  if (!partners || partners.length === 0) {
    document.getElementById('results_body').innerHTML =
      '<div class="info-card warn">Add at least one partner row before running the analysis.</div>';
    const panel = document.getElementById('results');
    panel.classList.add('show');
    panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }

  const r = computeDropSwap({
    variant, property, replacement,
    cashAdded, cashReceived,
    distributionDate, exchangeDate,
    partners
  });

  renderDropSwapResults(r);
  const panel = document.getElementById('results');
  panel.classList.add('show');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function gatherDropSwapPartners() {
  const rows = document.querySelectorAll('.ds-partner-row');
  const out = [];
  rows.forEach(row => {
    const get = (field) => {
      const el = row.querySelector('[data-field="' + field + '"]');
      if (!el) return null;
      return el.value;
    };
    const num = (field, dflt) => {
      const v = get(field);
      if (v == null || v === '') return dflt != null ? dflt : 0;
      const cleaned = String(v).replace(/[,$\s%]/g, '');
      const n = parseFloat(cleaned);
      return isNaN(n) ? (dflt != null ? dflt : 0) : n;
    };
    const pct = num('ownershipPct') / 100; // form is in % units
    const electsRaw = get('elects1031');
    const elects1031 = electsRaw === 'yes' || electsRaw === true;
    out.push({
      name:           get('name') || '',
      ownershipPct:   pct,
      outsideBasis:   num('outsideBasis'),
      elects1031:     elects1031,
      marginalRate:   num('marginalRate')  / 100,
      ltcgRate:       num('ltcgRate')      / 100,
      unrec1250Rate:  num('unrec1250Rate') / 100,
      niitRate:       num('niitRate')      / 100,
      stateRate:      num('stateRate')     / 100,
      stateCode:      get('stateCode') || ''
    });
  });
  return out;
}

function renderDropSwapResults(r) {
  if (!r) {
    document.getElementById('results_body').innerHTML =
      '<div class="info-card warn">No results — verify inputs and try again.</div>';
    return;
  }

  const variantLabel = r.variant === 'swap-drop' ? 'Swap-and-Drop (exchange first, then distribute)' : 'Drop-and-Swap (distribute first, then exchange)';

  let html = `<div class="tier-banner tier-client">
    <div class="tier-banner-text"><strong>Member analysis — Partnership-level § 1031.</strong> ${variantLabel}. ${r.partners.length} partner${r.partners.length === 1 ? '' : 's'} (${r.aggregates.countElecting} electing § 1031 · ${r.aggregates.countCashOut} cashing out). Federal recapture stacked at the partner level on the allocated share; § 1031-electing partners receive the per-partner deferred-gain treatment.</div>
  </div>`;

  if (r.ownershipWarning) {
    html += `<div class="info-card warn"><strong>Ownership total:</strong> ${r.ownershipWarning}</div>`;
  }

  // Headline metrics
  html += `
    <div class="result-headline">
      <div class="result-headline-label">Aggregate Recognized Gain (Across All Partners)</div>
      <div class="result-headline-value">${fmtMoney(r.aggregates.totalRecognizedGain)}</div>
      <div class="result-headline-grid">
        <div>
          <div class="result-headline-sub-label">AGG. DEFERRED GAIN</div>
          <div class="result-headline-sub-value">${fmtMoney(r.aggregates.totalDeferredGain)}</div>
        </div>
        <div>
          <div class="result-headline-sub-label">AGG. FED + STATE TAX NOW</div>
          <div class="result-headline-sub-value">${fmtMoney(r.aggregates.totalTax)}</div>
        </div>
        <div>
          <div class="result-headline-sub-label">AGG. DEFERRED TAX</div>
          <div class="result-headline-sub-value">${fmtMoney(r.aggregates.totalDeferredTax)}</div>
        </div>
      </div>
    </div>
  `;

  // Holding-period gap visualization. Inline-styled so the build ships without
  // requiring a CSS-file edit; colors track the four-band risk gradient.
  const hp = r.holdingPeriod;
  if (hp.classification !== 'unknown') {
    const palette = {
      green:    { bg: '#e8f5ee', border: '#169B62', text: '#0a5f3a', tag: '#169B62' },
      yellow:   { bg: '#fdf6e3', border: '#c9a227', text: '#8a6d10', tag: '#c9a227' },
      red:      { bg: '#fbe9e7', border: '#c0392b', text: '#922b21', tag: '#c0392b' },
      critical: { bg: '#3a1a1a', border: '#922b21', text: '#fbe9e7', tag: '#fbe9e7' }
    };
    const p = palette[hp.classification] || palette.yellow;
    html += `
      <div style="margin: 1rem 0; padding: 1rem 1.25rem; background: ${p.bg}; border-left: 4px solid ${p.border}; border-radius: 4px; color: ${p.text};">
        <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; margin-bottom: 0.5rem;">
          <div style="font-family: 'Gotham Bold', sans-serif; font-size: 1.05rem;">${hp.label}</div>
          <div style="font-size: 0.75rem; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; color: ${p.tag}; background: rgba(255,255,255,0.4); padding: 0.2rem 0.6rem; border-radius: 3px;">${hp.classification.toUpperCase()}</div>
        </div>
        <p style="margin: 0 0 0.5rem 0; line-height: 1.55; font-size: 0.92rem;">${hp.message}</p>
        <p style="margin: 0; font-size: 0.82rem; line-height: 1.5; opacity: 0.85;"><em>No bright-line safe harbor exists for the holding period. These gradients reflect case-law trends and are scenario-planning inputs only; the actual outcome on audit depends on facts and circumstances.</em></p>
      </div>
    `;
  } else {
    html += `<div class="info-card"><strong>Holding-period gap:</strong> ${hp.message}</div>`;
  }

  // CA FTB flag
  if (r.caFTBFlag.triggered) {
    const ftbClass = r.caFTBFlag.severity === 'elevated' ? 'warn' : '';
    html += `<div class="info-card ${ftbClass}"><strong>California FTB exposure flagged:</strong> ${r.caFTBFlag.message}</div>`;
  }

  // Aggregate property and partnership data
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">A. Partnership-Level Property Data</h4>
    <table class="boot-table">
      <tr><td>Relinquished property FMV</td><td class="num">${fmtMoney(r.property.fmv)}</td></tr>
      <tr><td>Selling expenses</td><td class="num">(${fmtMoney(r.property.sellExp)})</td></tr>
      <tr><td>Partnership's inside basis</td><td class="num">${fmtMoney(r.property.insideBasis)}</td></tr>
      <tr><td>Accumulated depreciation (total)</td><td class="num">${fmtMoney(r.property.accumDep)}</td></tr>
      <tr><td>&sect; 1245 portion of depreciation</td><td class="num">${fmtMoney(r.property.sec1245Dep)}</td></tr>
      <tr><td>Mortgage on relinquished</td><td class="num">${fmtMoney(r.property.mortgage)}</td></tr>
      <tr><td>Replacement property FMV</td><td class="num">${fmtMoney(r.replacement.fmv)}</td></tr>
      <tr><td>Replacement mortgage</td><td class="num">${fmtMoney(r.replacement.mortgage)}</td></tr>
      <tr><td>Deal-level cash added</td><td class="num">${fmtMoney(r.cashAdded)}</td></tr>
      <tr><td>Deal-level cash received</td><td class="num">${fmtMoney(r.cashReceived)}</td></tr>
    </table>
  `;

  // Per-partner table
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">B. Per-Partner Allocation and Tax Outcome</h4>
    <div class="multi-year-table-wrapper">
    <table class="boot-table">
      <thead><tr>
        <th>Partner</th>
        <th style="text-align:right;">Own. %</th>
        <th>Election</th>
        <th style="text-align:right;">Allocated FMV</th>
        <th style="text-align:right;">Outside Basis</th>
        <th style="text-align:right;">Realized Gain</th>
        <th style="text-align:right;">Recognized Now</th>
        <th style="text-align:right;">Deferred</th>
        <th style="text-align:right;">Fed Tax</th>
        <th style="text-align:right;">State Tax</th>
      </tr></thead>
      <tbody>
        ${r.partners.map((p, i) => `<tr>
          <td>${p.name || ('Partner ' + (i+1))}</td>
          <td class="num">${(p.ownershipPct * 100).toFixed(2)}%</td>
          <td>${p.elects1031 ? '<span style="color:#169B62;font-weight:600;">§ 1031</span>' : '<span style="color:#a64;font-weight:600;">Cash out</span>'}</td>
          <td class="num">${fmtMoney(p.allocatedFMV)}</td>
          <td class="num">${fmtMoney(p.outsideBasis)}</td>
          <td class="num">${fmtMoney(p.realizedGain)}</td>
          <td class="num">${fmtMoney(p.recognizedGain)}</td>
          <td class="num">${fmtMoney(p.deferredGain)}</td>
          <td class="num">${fmtMoney(p.federalTax)}</td>
          <td class="num">${fmtMoney(p.stateTax)}</td>
        </tr>`).join('')}
        <tr class="total">
          <td>Total</td>
          <td class="num">${(r.ownershipSum * 100).toFixed(2)}%</td>
          <td>${r.aggregates.countElecting}/${r.partners.length} elect</td>
          <td class="num">${fmtMoney(r.aggregates.totalFMV)}</td>
          <td class="num">&mdash;</td>
          <td class="num">${fmtMoney(r.aggregates.totalRealizedGain)}</td>
          <td class="num">${fmtMoney(r.aggregates.totalRecognizedGain)}</td>
          <td class="num">${fmtMoney(r.aggregates.totalDeferredGain)}</td>
          <td class="num">${fmtMoney(r.aggregates.totalFederalTax)}</td>
          <td class="num">${fmtMoney(r.aggregates.totalStateTax)}</td>
        </tr>
      </tbody>
    </table>
    </div>
  `;

  // Per-partner recapture breakdown — shown for any partner with recognized
  // gain (cash-out partners always; § 1031-electing partners only if boot
  // forced recognition).
  const partnersWithGain = r.partners.filter(p => p.recognizedGain > 0);
  if (partnersWithGain.length > 0) {
    html += `
      <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">C. Recapture Stacking on Recognized Gain</h4>
      <div class="multi-year-table-wrapper">
      <table class="boot-table">
        <thead><tr>
          <th>Partner</th>
          <th>Posture</th>
          <th style="text-align:right;">Recognized</th>
          <th style="text-align:right;">&sect; 1245 (Ordinary)</th>
          <th style="text-align:right;">&sect; 1250 (25% cap)</th>
          <th style="text-align:right;">LTCG</th>
        </tr></thead>
        <tbody>
          ${partnersWithGain.map((p, i) => `<tr>
              <td>${p.name || ('Partner ' + (i+1))}</td>
              <td>${p.elects1031 ? '§ 1031 (boot)' : 'Cash out'}</td>
              <td class="num">${fmtMoney(p.recognizedGain)}</td>
              <td class="num">${fmtMoney(p.recapture1245)}</td>
              <td class="num">${fmtMoney(p.recapture1250)}</td>
              <td class="num">${fmtMoney(p.recogLTCG)}</td>
            </tr>`).join('')}
        </tbody>
      </table>
      </div>
      <p class="member-only-note" style="margin-top: 0.5rem;">Recapture stacks &sect; 1245 (ordinary, at marginal rate) &rarr; &sect; 1250 (unrecaptured, capped at 25%) &rarr; long-term capital gain (20% above the threshold). NIIT (3.8%) layers on the &sect; 1250 and LTCG portions and is rolled into the per-partner federal tax shown in Section B. Allocations are per partner's individual tax profile.</p>
    `;
  }

  // Variant-specific case-authority panel
  const ca = r.caseAuthority;
  const variantDescription = r.variant === 'swap-drop'
    ? 'In a swap-and-drop, the partnership executes the § 1031 exchange in its own name, then distributes the replacement property to the partners as TICs (or terminates and distributes). Each partner who continues to hold the TIC carries forward the deferred gain; partners who exit at the partnership level take cash distributions (which can themselves be § 731 recognition events to the extent they exceed outside basis).'
    : 'In a drop-and-swap, the partnership distributes the relinquished property to its partners as TICs (or terminates and distributes) BEFORE the exchange. Each partner then individually elects § 1031 or sells their TIC interest. § 1031-electing partners run their own exchanges; cash-out partners recognize the full allocated gain immediately.';

  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">D. Doctrinal Posture and Case Authority</h4>
    <div class="info-card">
      <p><strong>${ca.direction === 'swap-then-drop' ? 'Swap-then-Drop' : 'Drop-then-Swap'}:</strong> ${variantDescription}</p>
      <p style="margin-top: 0.75rem;"><strong>Statutory framework.</strong> § 1031 nonrecognition is currently limited to "real property held for productive use in a trade or business or for investment" (§ 1031(a)(1), as amended by TCJA, Pub. L. No. 115-97, § 13303 (2017)). Partnership interests are personal property and are categorically ineligible. The structural workaround is to convert the partnership's real-property holding into directly-held TIC interests before (drop-then-swap) or after (swap-then-drop) the exchange, so that the § 1031 transaction is between two real-property positions. (Former § 1031(a)(2)(D), added by DEFRA '84, Pub. L. No. 98-369, § 77, expressly excluded partnership interests; the TCJA real-property limitation absorbed that exclusion.)</p>
      <p style="margin-top: 0.75rem;"><strong>Primary authority (partnership-level).</strong> <em>${ca.primary.name}</em>, ${ca.primary.cite}. ${ca.primary.holding}</p>
      <p style="margin-top: 0.75rem;"><strong>Corporate analog.</strong> <em>${ca.corporateAnalog.name}</em>, ${ca.corporateAnalog.cite}. ${ca.corporateAnalog.holding}</p>
      <p style="margin-top: 0.75rem;"><strong>Adverse doctrine to plan around.</strong> <em>Commissioner v. Court Holding Co.</em>, 324 U.S. 331 (1945), supplies the step-transaction framework the IRS uses to challenge tightly-choreographed drop-and-swap structures. The taxpayer-favorable cases above all involved documented investment intent, separately negotiated transactions, and business reasons for the restructuring; absence of those factors materially weakens the position.</p>
      <p style="margin-top: 0.75rem;"><strong>What the cases do not provide.</strong> A bright-line holding-period safe harbor. The cases turn on facts at the moment of exchange — whether the property was "held for productive use" — not elapsed days. Same-day swap-then-drop succeeded in Magneson; same-day drop-then-swap has weaker support because the individual taxpayer's investment intent has not had time to mature.</p>
      <p style="margin-top: 0.75rem; font-size: 0.85rem; color: #555;"><em>Engagement-level review is the recommended path for any actual transaction. The calculator operationalizes the doctrinal framework for in-house scenario planning; it does not replace structural analysis of the specific facts.</em></p>
    </div>
  `;

  document.getElementById('results_body').innerHTML = html;
}

// =============================================================================
// DROP-AND-SWAP DYNAMIC PARTNER ROWS — add/remove partner rows from the form
// =============================================================================
function setupDropSwapPartnerRows() {
  const addBtn = document.getElementById('ds_add_partner');
  if (addBtn) addBtn.addEventListener('click', () => addDropSwapPartnerRow());

  // Ensure at least one partner row on initial setup
  const rows = document.querySelectorAll('.ds-partner-row');
  if (rows.length === 0) addDropSwapPartnerRow();
}

function addDropSwapPartnerRow() {
  const container = document.getElementById('ds_partner_list');
  if (!container) return;
  const existing = container.querySelectorAll('.ds-partner-row').length;
  const defaultName = 'Partner ' + (existing + 1);

  const row = document.createElement('div');
  row.className = 'ds-partner-row multi-prop-row'; // reuse multi-prop-row styling
  row.innerHTML = `
    <div class="multi-row-header">
      <input type="text" data-field="name" class="multi-row-label" placeholder="${defaultName}" value="${defaultName}">
      <button type="button" class="multi-row-remove" title="Remove this partner">&times;</button>
    </div>
    <div class="multi-row-grid" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));">
      <div class="form-group"><label>Ownership %</label><div class="input-prefix"><input type="text" inputmode="decimal" data-field="ownershipPct" placeholder="0"></div></div>
      <div class="form-group"><label>Outside Basis</label><div class="input-prefix"><input type="text" inputmode="decimal" class="dl-currency" data-field="outsideBasis" placeholder="0"></div></div>
      <div class="form-group"><label>Elects &sect; 1031?</label>
        <select data-field="elects1031">
          <option value="yes">Yes — elect § 1031</option>
          <option value="no">No — cash out (recognize now)</option>
        </select>
      </div>
      <div class="form-group"><label>Marginal Rate (%)</label><div class="input-prefix"><input type="text" inputmode="decimal" data-field="marginalRate" value="37" placeholder="37"></div></div>
      <div class="form-group"><label>LTCG Rate (%)</label><div class="input-prefix"><input type="text" inputmode="decimal" data-field="ltcgRate" value="20" placeholder="20"></div></div>
      <div class="form-group"><label>Unrec. &sect; 1250 Rate (%)</label><div class="input-prefix"><input type="text" inputmode="decimal" data-field="unrec1250Rate" value="25" placeholder="25"></div></div>
      <div class="form-group"><label>NIIT Rate (%)</label><div class="input-prefix"><input type="text" inputmode="decimal" data-field="niitRate" value="3.8" placeholder="3.8"></div></div>
      <div class="form-group"><label>State Rate (%)</label><div class="input-prefix"><input type="text" inputmode="decimal" data-field="stateRate" value="0" placeholder="0"></div></div>
      <div class="form-group"><label>Partner State</label><select data-field="stateCode" data-role="state-1031"></select></div>
    </div>
  `;

  row.querySelector('.multi-row-remove').addEventListener('click', () => {
    const allRows = container.querySelectorAll('.ds-partner-row');
    if (allRows.length <= 1) {
      alert('At least one partner is required.');
      return;
    }
    row.remove();
  });

  container.appendChild(row);

  // Populate the per-partner state select with the STATES_1031 table
  populateStates1031();

  // Re-run formatter on the new fields if available
  if (window.DonovanInputFormatter && window.DonovanInputFormatter.attachToContainer) {
    window.DonovanInputFormatter.attachToContainer(row);
  }
}

// =============================================================================
// MULTI-PROPERTY EXCHANGE (Phase 3) — Reg. § 1.1031(j)-1
// =============================================================================
// Configurations: 1→N (one relinquished, multiple replacement), M→1 (multiple
// relinquished, one replacement), M→N (multiple of each).
//
// Under Reg. § 1.1031(j)-1, properties of like-kind are grouped into "exchange
// groups". Post-TCJA, real estate is one large like-kind group, so for real
// estate exchanges this calculator treats all properties as a single group.
// Within the group:
//   - Net cash boot and net mortgage relief are computed at the AGGREGATE level
//   - Recognition cap = lesser of (aggregate gain) or (aggregate boot)
//   - Recapture pools (§ 1245, § 1250) are summed across relinquished properties
//   - Deferred gain reduces aggregate replacement basis
//   - Per-replacement basis is allocated by FMV ratio
// =============================================================================

function computeMultiPropertyExchange(relProps, repProps, profile) {
  // Validate at least one of each
  if (!relProps || relProps.length === 0 || !repProps || repProps.length === 0) {
    return null;
  }

  // Aggregate relinquished side
  let aggRelFMV = 0, aggRelSellExp = 0, aggRelBasis = 0;
  let aggRelAccumDep = 0, aggRel1245Dep = 0, aggRelMortgage = 0;
  relProps.forEach(p => {
    aggRelFMV       += p.relFMV       || 0;
    aggRelSellExp   += p.relSellExp   || 0;
    aggRelBasis     += p.relBasis     || 0;
    aggRelAccumDep  += p.relAccumDep  || 0;
    aggRel1245Dep   += p.rel1245Dep   || 0;
    aggRelMortgage  += p.relMortgage  || 0;
  });

  // Aggregate replacement side
  let aggRepFMV = 0, aggRepMortgage = 0;
  repProps.forEach(p => {
    aggRepFMV      += p.repFMV       || 0;
    aggRepMortgage += p.repMortgage  || 0;
  });

  // Aggregate-level amount realized and realized gain
  const aggAmountRealized = aggRelFMV - aggRelSellExp;
  const aggRealizedGain   = aggAmountRealized - aggRelBasis;

  // Aggregate boot — same mechanics as single-property, just at the group level
  const grossMortgageBoot = Math.max(0, aggRelMortgage - aggRepMortgage);
  const netMortgageBoot   = Math.max(0, grossMortgageBoot - (profile.cashAdded || 0));
  const netCashBoot       = Math.max(0, profile.cashReceived || 0);
  const totalBoot         = netCashBoot + netMortgageBoot;

  // Aggregate recapture pools across relinquished properties
  const aggSec1250DepPotential = Math.max(0, aggRelAccumDep - aggRel1245Dep);

  // No § 121 in multi-property context (multi-property is investment/operator territory,
  // not principal residence — § 121 layered analysis would be unusual here)
  const gainAfter121 = aggRealizedGain;

  // Recognized gain — lesser of aggregate gain or aggregate boot
  let recognizedGain = Math.min(gainAfter121, totalBoot);
  if (recognizedGain < 0) recognizedGain = 0;

  // Recapture allocation at the aggregate level — § 1245 first, then § 1250, then LTCG
  const recapture1245 = Math.min(recognizedGain, aggRel1245Dep);
  const rem1 = recognizedGain - recapture1245;
  const recapture1250 = Math.min(rem1, aggSec1250DepPotential);
  const rem2 = rem1 - recapture1250;
  const recogLTCG = Math.max(0, rem2);

  const deferredGain = Math.max(0, gainAfter121 - recognizedGain);

  // Aggregate replacement basis under § 1031(d): replacement FMV minus deferred gain
  // (replacement basis takes a downward adjustment of the deferred gain across the group)
  const aggRepBasis = aggRepFMV - deferredGain;

  // Per-replacement basis allocation by FMV ratio
  const repAllocations = repProps.map(p => {
    const fmvRatio = aggRepFMV > 0 ? ((p.repFMV || 0) / aggRepFMV) : 0;
    const allocatedBasis = aggRepBasis * fmvRatio;
    // Per-property carryover/excess split: pro-rata the aggregate carryover and excess
    // by the same FMV ratio. (Reg. § 1.168(i)-6 applied at the group level then
    // proportionalized; conservative treatment.)
    const aggCarryover = Math.max(0, aggRelBasis - aggRelAccumDep);
    const aggExcess    = Math.max(0, aggRepBasis - aggCarryover);
    const carryover = aggCarryover * fmvRatio;
    const excess    = aggExcess    * fmvRatio;
    return {
      repFMV: p.repFMV || 0,
      repMortgage: p.repMortgage || 0,
      fmvRatio,
      allocatedBasis,
      carryover,
      excess,
      label: p.label || ''
    };
  });

  // Tax on recognized gain
  const tax1245 = recapture1245 * (profile.marginalRate || 0);
  const tax1250 = recapture1250 * (profile.unrec1250Rate || 0);
  const taxLTCG = recogLTCG     * (profile.ltcgRate || 0);
  const niit    = (recapture1250 + recogLTCG) * (profile.niitRate || 0);
  const fedTaxRecognized = tax1245 + tax1250 + taxLTCG + niit;

  // State conformity — checked once at the aggregate level
  const stateConforms = (STATES_1031[profile.stateCode] || {}).conforms;
  const stateTaxRecognized = (stateConforms === true || stateConforms === 'special')
    ? recognizedGain * (profile.stateRate || 0) : 0;

  // Hypothetical tax on full gain — to compute deferred-tax economics
  const hyp1245 = Math.min(gainAfter121, aggRel1245Dep);
  const hypRem1 = gainAfter121 - hyp1245;
  const hyp1250 = Math.min(hypRem1, aggSec1250DepPotential);
  const hypRem2 = hypRem1 - hyp1250;
  const hypLTCG = Math.max(0, hypRem2);
  const hypFedTax = hyp1245 * (profile.marginalRate || 0)
                  + hyp1250 * (profile.unrec1250Rate || 0)
                  + hypLTCG * (profile.ltcgRate || 0)
                  + (hyp1250 + hypLTCG) * (profile.niitRate || 0);
  const deferredFedTax = Math.max(0, hypFedTax - fedTaxRecognized);
  const hypStateTax = (stateConforms === true || stateConforms === 'special')
    ? gainAfter121 * (profile.stateRate || 0) : 0;
  const deferredStateTax = Math.max(0, hypStateTax - stateTaxRecognized);

  // Identification rule check (informational — calculator doesn't enforce)
  let idRuleStatus = null;
  if (profile.idRule === 'three') {
    idRuleStatus = {
      rule: 'three',
      satisfied: repProps.length <= 3,
      message: repProps.length <= 3
        ? `Within 3-property cap (${repProps.length} of 3 used).`
        : `Exceeds 3-property cap (${repProps.length} identified). Switch to 200% rule or 95% exception.`
    };
  } else if (profile.idRule === '200') {
    const aggRepIdentifiedFMV = aggRepFMV; // assumes all identified = all listed
    const ratio = aggRelFMV > 0 ? (aggRepIdentifiedFMV / aggRelFMV) : 0;
    idRuleStatus = {
      rule: '200',
      satisfied: ratio <= 2.0,
      ratio,
      message: ratio <= 2.0
        ? `Aggregate replacement FMV is ${(ratio*100).toFixed(0)}% of aggregate relinquished FMV (within 200% cap).`
        : `Aggregate replacement FMV is ${(ratio*100).toFixed(0)}% of aggregate relinquished FMV — exceeds 200% cap. Acquire ≥ 95% of identified or remove excess from identification.`
    };
  } else { // 95%
    idRuleStatus = {
      rule: '95',
      satisfied: true,
      message: '95% exception applies — must acquire at least 95% of aggregate identified FMV. Verify acquisition matches identification.'
    };
  }

  return {
    relProps, repProps, profile,
    aggRelFMV, aggRelSellExp, aggRelBasis, aggRelAccumDep, aggRel1245Dep, aggRelMortgage,
    aggRepFMV, aggRepMortgage,
    aggAmountRealized, aggRealizedGain,
    grossMortgageBoot, netMortgageBoot, netCashBoot, totalBoot,
    aggSec1250DepPotential,
    gainAfter121, recognizedGain,
    recapture1245, recapture1250, recogLTCG,
    deferredGain, aggRepBasis, repAllocations,
    tax1245, tax1250, taxLTCG, niit,
    fedTaxRecognized, stateTaxRecognized,
    totalTaxRecognized: fedTaxRecognized + stateTaxRecognized,
    hypFedTax, hypStateTax,
    deferredFedTax, deferredStateTax,
    stateConforms,
    idRuleStatus
  };
}

function gatherMultiProperties(side) {
  // side is 'rel' or 'rep'. Reads .multi-prop-row elements with data-side attribute.
  const rows = document.querySelectorAll('.multi-prop-row[data-side="' + side + '"]');
  const props = [];
  rows.forEach((row, idx) => {
    if (side === 'rel') {
      props.push({
        label:       row.querySelector('[data-field="label"]').value || ('Property ' + String.fromCharCode(65 + idx)),
        relFMV:      parseNumericField(row, 'relFMV'),
        relSellExp:  parseNumericField(row, 'relSellExp'),
        relBasis:    parseNumericField(row, 'relBasis'),
        relAccumDep: parseNumericField(row, 'relAccumDep'),
        rel1245Dep:  parseNumericField(row, 'rel1245Dep'),
        relMortgage: parseNumericField(row, 'relMortgage')
      });
    } else {
      props.push({
        label:       row.querySelector('[data-field="label"]').value || ('Replacement ' + String.fromCharCode(65 + idx)),
        repFMV:      parseNumericField(row, 'repFMV'),
        repMortgage: parseNumericField(row, 'repMortgage')
      });
    }
  });
  return props;
}

function parseNumericField(row, fieldName) {
  const el = row.querySelector('[data-field="' + fieldName + '"]');
  if (!el) return 0;
  if (window.DonovanInputFormatter) {
    return window.DonovanInputFormatter.getValue(el, 0);
  }
  const v = parseFloat(el.value);
  return isNaN(v) ? 0 : v;
}

function calculateMulti() {
  if (!isMember()) {
    alert('Multi-Property analysis is available to members.');
    return;
  }
  const relProps = gatherMultiProperties('rel');
  const repProps = gatherMultiProperties('rep');

  if (relProps.length === 0 || repProps.length === 0) {
    alert('Add at least one relinquished property and one replacement property.');
    return;
  }

  // Validate at least one FMV is positive on each side
  if (relProps.every(p => p.relFMV <= 0) || repProps.every(p => p.repFMV <= 0)) {
    alert('Enter the fair market values of at least one relinquished and one replacement property.');
    return;
  }

  const profile = {
    cashAdded:    getValue('multi_cash_added'),
    cashReceived: getValue('multi_cash_received'),
    marginalRate: getValue('multi_marginal_rate', 37) / 100,
    ltcgRate:     getValue('multi_ltcg_rate', 20) / 100,
    unrec1250Rate:getValue('multi_unrec_1250_rate', 25) / 100,
    niitRate:     getValue('multi_niit_rate', 3.8) / 100,
    stateRate:    getValue('multi_state_rate', 5) / 100,
    stateCode:    (document.getElementById('multi_state_select') || {}).value || 'FL',
    idRule:       getIDRule('multi')
  };

  const r = computeMultiPropertyExchange(relProps, repProps, profile);
  renderMultiResults(r);
}

function renderMultiResults(r) {
  if (!r) {
    document.getElementById('results_body').innerHTML = '<div class="info-card warn">No results — verify inputs and try again.</div>';
    return;
  }
  const stateName = (STATES_1031[r.profile.stateCode] || {}).name || '';
  const stateConformText =
    r.stateConforms === 'no_tax'  ? `${stateName} imposes no state income tax — no state-level deferral concern.`
  : r.stateConforms === 'special' ? `${stateName} conforms to federal § 1031 but imposes a tracking/claw-back requirement: ${STATES_1031[r.profile.stateCode].note}.`
  :                                 `${stateName} conforms to federal § 1031 treatment.`;

  let html = `<div class="tier-banner tier-client">
    <div class="tier-banner-text"><strong>Member analysis — Multi-Property Exchange under Reg. &sect; 1.1031(j)-1.</strong> ${r.relProps.length} relinquished &rarr; ${r.repProps.length} replacement. Aggregate boot mechanics applied at the exchange-group level; replacement basis allocated by FMV ratio.</div>
  </div>`;

  // Headline
  html += `
    <div class="result-headline">
      <div class="result-headline-label">Aggregate Recognized Gain</div>
      <div class="result-headline-value">${fmtMoney(r.recognizedGain)}</div>
      <div class="result-headline-grid">
        <div>
          <div class="result-headline-sub-label">AGGREGATE DEFERRED GAIN</div>
          <div class="result-headline-sub-value">${fmtMoney(r.deferredGain)}</div>
        </div>
        <div>
          <div class="result-headline-sub-label">DEFERRED FED TAX</div>
          <div class="result-headline-sub-value">${fmtMoney(r.deferredFedTax)}</div>
        </div>
        <div>
          <div class="result-headline-sub-label">AGG. REPLACEMENT BASIS</div>
          <div class="result-headline-sub-value">${fmtMoney(r.aggRepBasis)}</div>
        </div>
      </div>
    </div>
  `;

  // ID rule status
  if (r.idRuleStatus) {
    const statusClass = r.idRuleStatus.satisfied ? '' : 'warn';
    html += `<div class="info-card ${statusClass}">
      <strong>Identification rule (${idRuleShort(r.idRuleStatus.rule)}):</strong> ${r.idRuleStatus.message}
    </div>`;
  }

  // A. Aggregate amount realized and realized gain
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">A. Aggregate Realized Gain (Reg. &sect; 1.1031(j)-1)</h4>
    <table class="boot-table">
      <tr><td>Aggregate FMV of relinquished properties (&Sigma; over ${r.relProps.length})</td><td class="num">${fmtMoney(r.aggRelFMV)}</td></tr>
      <tr><td>Less: aggregate selling expenses</td><td class="num">(${fmtMoney(r.aggRelSellExp)})</td></tr>
      <tr><td><strong>Aggregate amount realized</strong></td><td class="num"><strong>${fmtMoney(r.aggAmountRealized)}</strong></td></tr>
      <tr><td>Less: aggregate adjusted basis</td><td class="num">(${fmtMoney(r.aggRelBasis)})</td></tr>
      <tr class="total"><td>Aggregate realized gain</td><td class="num">${fmtMoney(r.aggRealizedGain)}</td></tr>
    </table>
  `;

  // B. Per-property breakdown of relinquished
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">B. Relinquished Properties (Per-Property Detail)</h4>
    <div class="multi-year-table-wrapper">
    <table class="boot-table">
      <thead><tr>
        <th>Property</th>
        <th style="text-align:right;">FMV</th>
        <th style="text-align:right;">Sell. Exp.</th>
        <th style="text-align:right;">Basis</th>
        <th style="text-align:right;">Accum. Dep.</th>
        <th style="text-align:right;">&sect; 1245</th>
        <th style="text-align:right;">Mortgage</th>
      </tr></thead>
      <tbody>
        ${r.relProps.map(p => `<tr>
          <td>${p.label}</td>
          <td class="num">${fmtMoney(p.relFMV)}</td>
          <td class="num">${fmtMoney(p.relSellExp)}</td>
          <td class="num">${fmtMoney(p.relBasis)}</td>
          <td class="num">${fmtMoney(p.relAccumDep)}</td>
          <td class="num">${fmtMoney(p.rel1245Dep)}</td>
          <td class="num">${fmtMoney(p.relMortgage)}</td>
        </tr>`).join('')}
        <tr class="total">
          <td>Aggregate</td>
          <td class="num">${fmtMoney(r.aggRelFMV)}</td>
          <td class="num">${fmtMoney(r.aggRelSellExp)}</td>
          <td class="num">${fmtMoney(r.aggRelBasis)}</td>
          <td class="num">${fmtMoney(r.aggRelAccumDep)}</td>
          <td class="num">${fmtMoney(r.aggRel1245Dep)}</td>
          <td class="num">${fmtMoney(r.aggRelMortgage)}</td>
        </tr>
      </tbody>
    </table>
    </div>
  `;

  // C. Aggregate boot
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">C. Aggregate Boot (§ 1031(b))</h4>
    <table class="boot-table">
      <tr><td>Aggregate cash received by taxpayer</td><td class="num">${fmtMoney(r.profile.cashReceived)}</td></tr>
      <tr><td>Aggregate relinquished mortgage</td><td class="num">${fmtMoney(r.aggRelMortgage)}</td></tr>
      <tr><td>Less: aggregate replacement mortgage</td><td class="num">(${fmtMoney(r.aggRepMortgage)})</td></tr>
      <tr><td>Gross mortgage boot (aggregate debt relief)</td><td class="num">${fmtMoney(r.grossMortgageBoot)}</td></tr>
      <tr><td>Less: cash added by taxpayer (offsets mortgage boot)</td><td class="num">(${fmtMoney(Math.min(r.grossMortgageBoot, r.profile.cashAdded))})</td></tr>
      <tr><td><strong>Net cash boot</strong></td><td class="num"><strong>${fmtMoney(r.netCashBoot)}</strong></td></tr>
      <tr><td><strong>Net mortgage boot</strong></td><td class="num"><strong>${fmtMoney(r.netMortgageBoot)}</strong></td></tr>
      <tr class="total"><td>Total aggregate boot</td><td class="num">${fmtMoney(r.totalBoot)}</td></tr>
    </table>
    <p style="font-size: 0.85rem; color: #4a4a4a; margin-top: 0.5rem;">Boot is computed at the AGGREGATE level under Reg. § 1.1031(j)-1, not pairwise. Cash and mortgage flows across all properties in the exchange group net together before recognition is determined.</p>
  `;

  // D. Recognition and allocation
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">D. Aggregate Recognition &amp; Recapture Allocation</h4>
    <table class="boot-table">
      <tr><td>Aggregate realized gain</td><td class="num">${fmtMoney(r.aggRealizedGain)}</td></tr>
      <tr><td>Total aggregate boot</td><td class="num">${fmtMoney(r.totalBoot)}</td></tr>
      <tr><td><strong>Recognized gain</strong> (lesser of gain or boot)</td><td class="num"><strong>${fmtMoney(r.recognizedGain)}</strong></td></tr>
      ${r.recognizedGain > 0 ? `
        <tr><td>&nbsp;&nbsp;&nbsp;Allocated to § 1245 recapture (ordinary income)</td><td class="num">${fmtMoney(r.recapture1245)}</td></tr>
        <tr><td>&nbsp;&nbsp;&nbsp;Allocated to § 1250 unrecaptured (25% max)</td><td class="num">${fmtMoney(r.recapture1250)}</td></tr>
        <tr><td>&nbsp;&nbsp;&nbsp;Allocated to LTCG (residual)</td><td class="num">${fmtMoney(r.recogLTCG)}</td></tr>
      ` : ''}
      <tr class="total"><td>Aggregate deferred gain</td><td class="num">${fmtMoney(r.deferredGain)}</td></tr>
    </table>
    <p style="font-size: 0.85rem; color: #4a4a4a; margin-top: 0.5rem;">Recapture pools are computed at the aggregate level. § 1245 recapture across all relinquished properties (${fmtMoney(r.aggRel1245Dep)}) and § 1250 unrecaptured (${fmtMoney(r.aggSec1250DepPotential)}) are pooled before allocating to recognized gain.</p>
  `;

  // E. Tax on recognized gain
  if (r.recognizedGain > 0) {
    html += `
      <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">E. Tax on Aggregate Recognized Gain</h4>
      <table class="boot-table">
        <tr><td>Tax on § 1245 recapture @ ${(r.profile.marginalRate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.tax1245)}</td></tr>
        <tr><td>Tax on § 1250 unrecaptured @ ${(r.profile.unrec1250Rate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.tax1250)}</td></tr>
        <tr><td>Tax on LTCG @ ${(r.profile.ltcgRate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.taxLTCG)}</td></tr>
        <tr><td>NIIT @ ${(r.profile.niitRate*100).toFixed(1)}% (on § 1250 + LTCG)</td><td class="num">${fmtMoney(r.niit)}</td></tr>
        <tr class="total"><td>Total federal tax on recognized gain</td><td class="num">${fmtMoney(r.fedTaxRecognized)}</td></tr>
        <tr><td>State tax @ ${(r.profile.stateRate*100).toFixed(1)}%</td><td class="num">${fmtMoney(r.stateTaxRecognized)}</td></tr>
      </table>
    `;
  } else {
    html += '<div class="info-card"><strong>No tax recognized at aggregate level.</strong> All aggregate realized gain is deferred under § 1031(a)(1). The deferred gain is allocated across replacement properties pro-rata by FMV.</div>';
  }

  // F. Per-replacement basis allocation
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">F. Per-Replacement Basis Allocation (FMV Ratio)</h4>
    <p style="font-size: 0.88rem; color: #4a4a4a; margin-bottom: 0.75rem;">Aggregate replacement basis (${fmtMoney(r.aggRepBasis)}) is allocated across replacement properties in proportion to each property's FMV. Per-property carryover and excess basis split applied at the same ratio under Reg. § 1.168(i)-6.</p>
    <div class="multi-year-table-wrapper">
    <table class="boot-table">
      <thead><tr>
        <th>Replacement</th>
        <th style="text-align:right;">FMV</th>
        <th style="text-align:right;">FMV Ratio</th>
        <th style="text-align:right;">Allocated Basis</th>
        <th style="text-align:right;">Carryover</th>
        <th style="text-align:right;">Excess</th>
        <th style="text-align:right;">Mortgage</th>
      </tr></thead>
      <tbody>
        ${r.repAllocations.map(a => `<tr>
          <td>${a.label}</td>
          <td class="num">${fmtMoney(a.repFMV)}</td>
          <td class="num">${(a.fmvRatio * 100).toFixed(2)}%</td>
          <td class="num">${fmtMoney(a.allocatedBasis)}</td>
          <td class="num">${fmtMoney(a.carryover)}</td>
          <td class="num">${fmtMoney(a.excess)}</td>
          <td class="num">${fmtMoney(a.repMortgage)}</td>
        </tr>`).join('')}
        <tr class="total">
          <td>Aggregate</td>
          <td class="num">${fmtMoney(r.aggRepFMV)}</td>
          <td class="num">100.00%</td>
          <td class="num">${fmtMoney(r.aggRepBasis)}</td>
          <td class="num">${fmtMoney(r.repAllocations.reduce((s,a)=>s+a.carryover,0))}</td>
          <td class="num">${fmtMoney(r.repAllocations.reduce((s,a)=>s+a.excess,0))}</td>
          <td class="num">${fmtMoney(r.aggRepMortgage)}</td>
        </tr>
      </tbody>
    </table>
    </div>
  `;

  // G. Deferred tax
  html += `
    <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin-top: 1.5rem; margin-bottom: 0.5rem; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">G. Deferred Tax</h4>
    <table class="boot-table">
      <tr><td>Hypothetical federal tax on full aggregate sale</td><td class="num">${fmtMoney(r.hypFedTax)}</td></tr>
      <tr><td>Less: federal tax recognized now (boot)</td><td class="num">(${fmtMoney(r.fedTaxRecognized)})</td></tr>
      <tr class="total"><td><strong>Federal tax deferred via § 1031</strong></td><td class="num"><strong>${fmtMoney(r.deferredFedTax)}</strong></td></tr>
      <tr><td>State tax deferred</td><td class="num">${fmtMoney(r.deferredStateTax)}</td></tr>
    </table>
  `;

  // State conformity + strategy
  html += `
    <div class="info-card" style="margin-top: 1rem;">
      <strong>State conformity:</strong> ${stateConformText}
    </div>
    <div class="info-card">
      <strong>Multi-property considerations:</strong>
      <ul style="margin: 0.4rem 0 0 0; padding-left: 1.25rem; line-height: 1.7;">
        <li>The 45-day identification clock applies to ALL replacement properties as a group; identification must list every property the taxpayer intends to acquire.</li>
        <li>The 180-day acquisition deadline (or tax-filing-date acceleration) applies to the FINAL property — all acquisitions must close by that date.</li>
        <li>If actual acquisition differs from identification, the 95% exception (acquiring ≥ 95% of identified aggregate FMV) is the safety valve.</li>
        <li>FMV-ratio basis allocation means a high-FMV / low-basis replacement absorbs disproportionately more deferred gain — verify the allocation aligns with operating intent before closing.</li>
        <li>Disposition of one replacement while continuing to hold the others triggers gain on that property using its allocated basis; the other replacements continue at their allocated bases.</li>
      </ul>
    </div>
  `;

  document.getElementById('results_body').innerHTML = html;
  const panel = document.getElementById('results');
  panel.classList.add('show');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =============================================================================
// MULTI-PROPERTY DYNAMIC ROWS — add/remove property rows from the form
// =============================================================================
function setupMultiPropertyRows() {
  // Wire up the "+ Add" buttons
  const addRelBtn = document.getElementById('multi_add_rel');
  const addRepBtn = document.getElementById('multi_add_rep');
  if (addRelBtn) addRelBtn.addEventListener('click', () => addMultiPropertyRow('rel'));
  if (addRepBtn) addRepBtn.addEventListener('click', () => addMultiPropertyRow('rep'));

  // Ensure at least one row of each on initial setup
  const relRows = document.querySelectorAll('.multi-prop-row[data-side="rel"]');
  const repRows = document.querySelectorAll('.multi-prop-row[data-side="rep"]');
  if (relRows.length === 0) addMultiPropertyRow('rel');
  if (repRows.length === 0) addMultiPropertyRow('rep');
}

function addMultiPropertyRow(side) {
  const container = document.getElementById('multi_' + side + '_list');
  if (!container) return;
  const existing = container.querySelectorAll('.multi-prop-row').length;
  const letter = String.fromCharCode(65 + existing); // A, B, C, ...
  const defaultLabel = (side === 'rel' ? 'Property ' : 'Replacement ') + letter;

  const row = document.createElement('div');
  row.className = 'multi-prop-row';
  row.setAttribute('data-side', side);

  if (side === 'rel') {
    row.innerHTML = `
      <div class="multi-row-header">
        <input type="text" data-field="label" class="multi-row-label" placeholder="${defaultLabel}" value="${defaultLabel}">
        <button type="button" class="multi-row-remove" title="Remove this property">&times;</button>
      </div>
      <div class="multi-row-grid multi-row-grid-rel">
        <div class="form-group"><label>FMV (Sale Price)</label><div class="input-prefix"><input type="text" inputmode="decimal" class="dl-currency" data-field="relFMV" placeholder="0"></div></div>
        <div class="form-group"><label>Selling Expenses</label><div class="input-prefix"><input type="text" inputmode="decimal" class="dl-currency" data-field="relSellExp" placeholder="0"></div></div>
        <div class="form-group"><label>Adjusted Basis</label><div class="input-prefix"><input type="text" inputmode="decimal" class="dl-currency" data-field="relBasis" placeholder="0"></div></div>
        <div class="form-group"><label>Accum. Depreciation</label><div class="input-prefix"><input type="text" inputmode="decimal" class="dl-currency" data-field="relAccumDep" placeholder="0"></div></div>
        <div class="form-group"><label>&sect; 1245 Cost Seg / Bonus</label><div class="input-prefix"><input type="text" inputmode="decimal" class="dl-currency" data-field="rel1245Dep" placeholder="0"></div></div>
        <div class="form-group"><label>Mortgage Balance</label><div class="input-prefix"><input type="text" inputmode="decimal" class="dl-currency" data-field="relMortgage" placeholder="0"></div></div>
      </div>
    `;
  } else {
    row.innerHTML = `
      <div class="multi-row-header">
        <input type="text" data-field="label" class="multi-row-label" placeholder="${defaultLabel}" value="${defaultLabel}">
        <button type="button" class="multi-row-remove" title="Remove this property">&times;</button>
      </div>
      <div class="multi-row-grid multi-row-grid-rep">
        <div class="form-group"><label>FMV (Purchase Price)</label><div class="input-prefix"><input type="text" inputmode="decimal" class="dl-currency" data-field="repFMV" placeholder="0"></div></div>
        <div class="form-group"><label>Mortgage Balance</label><div class="input-prefix"><input type="text" inputmode="decimal" class="dl-currency" data-field="repMortgage" placeholder="0"></div></div>
      </div>
    `;
  }

  // Wire up the remove button
  row.querySelector('.multi-row-remove').addEventListener('click', () => {
    const allRows = container.querySelectorAll('.multi-prop-row');
    if (allRows.length <= 1) {
      alert('At least one property is required.');
      return;
    }
    row.remove();
  });

  container.appendChild(row);

  // Re-run formatter on the new fields if available
  if (window.DonovanInputFormatter && window.DonovanInputFormatter.attachToContainer) {
    window.DonovanInputFormatter.attachToContainer(row);
  }
}



// =============================================================================
// MODE DISPATCH — per-mode tier requirements
// =============================================================================
// forward     → public (everyone; content gated within the result render)
// reverse     → platinum (and above)
// drop-swap   → reserve (Phase 4 — both drop-then-swap and swap-then-drop variants)
// multi       → reserve (Phase 3 — Reg. § 1.1031(j)-1 aggregate mechanics)
// =============================================================================
// As of policy update: all calculator modes are open to any member tier
// (Gold, Platinum, Reserve). Forward remains public-accessible for the
// website preview. Reverse, Drop-and-Swap, and Multi-Property now require
// only Gold (= entry-level membership), not Platinum or Reserve.
const MODE_REQUIRES = {
  'forward':    'public',
  'reverse':    'gold',
  'drop-swap':  'gold',
  'multi':      'gold'
};

function modeRequiresTier(mode) {
  return MODE_REQUIRES[mode] || 'public';
}

// kept for backward compat with the prior public API
function modeRequiresReserve(mode) {
  return modeRequiresTier(mode) === 'reserve';
}

function calculate1031() {
  const mode = getMode();
  const required = modeRequiresTier(mode);

  if (!isAtLeast(required)) {
    showLockedModeMessage(mode, required);
    return;
  }

  if (mode === 'forward')        calculateForward();
  else if (mode === 'reverse')   calculateReverse();
  else if (mode === 'drop-swap') calculateDropSwap();
  else if (mode === 'multi')     calculateMulti();
}

function modeDisplayName(mode) {
  return mode === 'reverse'    ? 'Reverse Exchange'
       : mode === 'drop-swap'  ? 'Drop-and-Swap'
       : mode === 'multi'      ? 'Multi-Property Exchange'
       :                         'Forward Exchange';
}

function modeBlurbHTML(mode) {
  return mode === 'reverse'
      ? 'Rev. Proc. 2000-37 QEAA safe harbor analysis. Both parking-arrangement variants (exchange-last with replacement parked, exchange-first with relinquished parked). 180-day cap modeling. Improvement-exchange addendum with substantial-improvement timing under Reg. § 1.1031(k)-1(e). EAT entity economics and the deferred-tax-net-of-fees diagnostic.'
    : mode === 'drop-swap'
      ? 'Partnership-level § 1031 with the drop-and-swap and swap-and-drop variants. Case-law analysis under Magneson, Bolker, Maloney, and Mason. § 1031(a)(1) "held for productive use" doctrinal walk-through. California FTB exposure flagging. Timing-between-distribution-and-exchange risk visualization.'
    : 'Multi-property exchanges with 1→N, M→1, and M→N configurations. Basis allocation under Reg. § 1.1031(j)-1. Three identification rules\' interactions in the multi-property context. Boot computation when relinquished and replacement counts differ.';
}

function showLockedModeMessage(mode, required) {
  const modeName = modeDisplayName(mode);
  const tierLabel = required === 'platinum' ? 'Platinum or Reserve' : 'Reserve';
  const placeholderInputs = `
    <div style="padding:1.5rem 2rem;">
      <h4 style="font-family: 'Gotham Bold', sans-serif; color: #169B62; margin: 0 0 0.5rem 0; letter-spacing: 0.5px; text-transform: uppercase; font-size: 0.9rem;">${modeName}</h4>
      <p style="font-size: 0.9rem; color: #4a4a4a; line-height: 1.55;">${modeBlurbHTML(mode)}</p>
    </div>`;
  const html = tierLock(
    placeholderInputs,
    `${modeName} — ${tierLabel} Members Only`,
    `${modeName} requires ${tierLabel} membership. ${required === 'reserve' ? 'Drop-and-Swap and Multi-Property involve partnership-level and basis-allocation complexity reserved for sponsor-level engagement.' : 'Reverse exchange involves QEAA parking-arrangement structuring under Rev. Proc. 2000-37 that benefits from the additional analytical surface area in the Platinum tier.'}`,
    isPublic() ? 'engagement.html' : '../engagement.html'
  );
  document.getElementById('results_body').innerHTML = html;
  const panel = document.getElementById('results');
  panel.classList.add('show');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// =============================================================================
// RESET
// =============================================================================
function reset1031() {
  const mode = getMode();
  const prefix = mode === 'forward' ? 'fwd_' : 'rev_';
  const textFields = [
    'rel_fmv','rel_sell_exp','rel_basis','rel_accum_dep','rel_1245_dep','rel_mortgage',
    'rep_fmv','rep_mortgage','cash_added','cash_received',
    'close_date','tax_year_due','eat_acquire_date','exchange_close_date',
    'eat_fees','improvement_cost','hold_years','remaining_life'
  ];
  textFields.forEach(suffix => {
    const el = document.getElementById(prefix + suffix);
    if (el) el.value = '';
  });
  // Reset rates to defaults
  const rateDefaults = { marginal_rate: '37', ltcg_rate: '20', unrec_1250_rate: '25', niit_rate: '3.8', state_rate: '5' };
  Object.keys(rateDefaults).forEach(k => {
    const el = document.getElementById(prefix + k);
    if (el) el.value = rateDefaults[k];
  });
  // Reset selects
  const selects = { state_select: 'FL', use_121: 'no', filing_121: 'mfj', apply_dlts: 'no',
                    property_type: prefix === 'rev_' ? 'commercial' : 'residential',
                    variant: 'rep-park', improvements: 'no' };
  Object.keys(selects).forEach(k => {
    const el = document.getElementById(prefix + k);
    if (el) el.value = selects[k];
  });
  // Reset id rule toggle
  const scope = prefix === 'fwd_' ? 'fwd' : 'rev';
  const toggle = document.querySelector('[data-role="id-rule-toggle"][data-scope="' + scope + '"]');
  if (toggle) {
    toggle.querySelectorAll('button').forEach(b => b.classList.remove('active'));
    const firstBtn = toggle.querySelector('button[data-rule="three"]');
    if (firstBtn) firstBtn.classList.add('active');
    if (toggle.parentElement) {
      toggle.parentElement.querySelectorAll('.id-rule-card').forEach(c => c.classList.remove('active'));
      const firstCard = toggle.parentElement.querySelector('.id-rule-card[data-rule="three"]');
      if (firstCard) firstCard.classList.add('active');
    }
  }
  const results = document.getElementById('results');
  if (results) results.classList.remove('show');
}

// =============================================================================
// INIT
// =============================================================================
if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', function() {
    populateStates1031();
    setupModeSelector();
    setupIDRuleToggle();
    setupMultiPropertyRows();      // Phase 3 — dynamic property rows
    setupDropSwapPartnerRows();    // Phase 4 — dynamic partner rows
    applyModeLocks();
    renderStaticTierBanner();
  });
}

// Export for Node smoke tests
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    TIER, RAW_TIER,
    isPublic, isGold, isPlatinum, isReserve, isAtLeast, isMember,
    tierRank, TIER_LABEL,
    MODE_REQUIRES, modeRequiresTier, modeRequiresReserve, modeDisplayName,
    STATES_1031,
    computeExchange,
    computeMultiYearProjection,
    computeMultiPropertyExchange,
    computeDropSwap,                       // Phase 4
    computeDropSwapHoldingGap,             // Phase 4
    computeDropSwapCAFTBFlag,              // Phase 4
    dropSwapCaseAuthority,                 // Phase 4
    computeForwardTimeline,
    computeReverseTimeline,
    daysBetween, addDaysISO,
    idRuleText, idRuleShort
  };
}
