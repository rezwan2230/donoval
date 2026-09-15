/* Divorce Business Valuation — Calculation of Value (Donovan Legal PLLC divorce suite, tool 2)
 * 2026-09-05. Educational tool. Values a closely held business on fundamental
 * principles, then applies the choices that the two sides actually fight over —
 * the standard of value, goodwill, tax-affecting, and discounts — under the
 * selected state's posture, and shows what each choice does to the number.
 * Nothing entered leaves the browser. Hard-navigated route; no inline scripts.
 */
(function () {
  'use strict';

  /* ── State posture on the contested choices ─────────────────────────────── */
  const J = {
    FL: { name: 'Florida', standard: 'Fair market value',
      keyPersonSeparate: false,
      standardText: 'Florida values a marital business at fair market value — the price a willing buyer would pay a willing seller, neither under compulsion. Because the equitable-distribution statute asks what is fair, courts adjust around the edges: they will not award one spouse a value the other could never realize, and they will not let a spouse walk away with a business valued as if its goodwill left with the founder when it did not.',
      goodwill: 'personal_excluded', goodwillText: 'Enterprise goodwill is marital; personal goodwill — value that depends on the owner-spouse’s continued presence, skill and reputation — is not (Thompson v. Thompson, 576 So. 2d 267 (Fla. 1991)); the 2024 amendment to § 61.075 codifies the exclusion. The allocation between the two is the single largest valuation dispute in a Florida professional-practice case. Verify the current statutory text.',
      taxAffect: 'case_by_case', taxAffectText: 'No controlling Florida rule on tax-affecting S-corporation earnings; appraisers commonly apply a partial rate, and the choice is litigated.',
      dlom: 'permitted', dloc: 'permitted', discountsText: 'Marketability and minority discounts are permitted where the facts support them and are contested where the owner-spouse keeps the interest and no sale is contemplated. Courts have accepted and rejected both; the record on why a hypothetical buyer would demand the discount is what carries the day.',
      keyPerson: 'Often folded into personal goodwill rather than taken as a separate discount — taking both is double-counting.',
      cite: 'Fla. Stat. § 61.075; Thompson v. Thompson, 576 So. 2d 267 (Fla. 1991)' },
    MA: { name: 'Massachusetts', standard: 'Fair value (in substance)',
      keyPersonSeparate: false,
      standardText: 'The SJC in Bernier v. Bernier, 449 Mass. 774 (2007), held that for a closely held business the spouse keeps, the judge should determine the value of the interest to the retaining spouse — a "fair value" concept — rather than a hypothetical sale price, and rejected marketability and minority discounts where no sale is contemplated. Massachusetts is the clearest of the five states that valuation in divorce is an equitable exercise, not a transaction.',
      goodwill: 'case_by_case', goodwillText: 'Goodwill of a professional practice may be included in the marital estate (Goldman v. Goldman, 28 Mass. App. Ct. 603 (1990)); the caution is double-counting the same earnings in alimony. Massachusetts does not draw the Florida/Texas personal-goodwill line as a rule.',
      taxAffect: 'partial', taxAffectText: 'Bernier requires tax-affecting an S corporation’s earnings at a rate that captures the S election’s benefit to the owner — not the full C-corporation rate (which ignores the benefit) and not zero (which ignores that the owner pays tax on the income). The court accepted a metric derived from the shareholder’s dividend-tax advantage.',
      dlom: 'disfavored', dloc: 'disfavored', discountsText: 'Bernier: no marketability or minority discount where the retaining spouse is not selling and the interest is not truly a minority position in substance. Discounts return only when a sale is actually contemplated or the interest is one the spouse cannot control or liquidate.',
      keyPerson: 'Considered within the capitalization rate or the earnings normalization, not as a separate discount, consistent with the fair-value posture.',
      cite: 'M.G.L. c. 208, § 34; Bernier v. Bernier, 449 Mass. 774 (2007)' },
    NY: { name: 'New York', standard: 'Fair market value, equitably applied',
      keyPersonSeparate: true,
      standardText: 'New York values at fair market value but with an explicit statutory instruction that the division be equitable and that "the difficulty of evaluating any component asset" and the desirability of retaining the business intact are factors (DRL § 236(B)(5)(d)). In practice the Appellate Divisions accept a wide band of methods and scrutinize discounts closely; a value the spouse cannot realize without selling is a common ground for reducing the non-owner’s share rather than the value.',
      goodwill: 'enterprise_statutory', goodwillText: 'Goodwill of a business or practice is marital property. Since 2016 the value of a spouse’s enhanced earning capacity from a license, degree or "celebrity goodwill" is not marital property (§ 236(B)(5)(d)(7)), which removes one classic New York battleground but not the enterprise/personal goodwill dispute in an ordinary practice.',
      taxAffect: 'case_by_case', taxAffectText: 'No controlling New York rule; both full and partial tax-affecting appear in reported decisions and the choice is decided on the expert record.',
      dlom: 'permitted', dloc: 'permitted', discountsText: 'Marketability discounts are frequently accepted for closely held interests; minority discounts are accepted for true minority positions and rejected where the spouse controls the company. Stacking both is the usual fight.',
      keyPerson: 'Accepted as a separate consideration in some cases; contested as duplicative of personal goodwill in others.',
      cite: 'DRL § 236(B)(5)(d)' },
    CA: { name: 'California', standard: 'Value to the community (investment value)',
      keyPersonSeparate: false,
      standardText: 'California does not value a community business at a hypothetical sale price. The court determines the value of the going concern to the community — including goodwill that could not be sold — because the equal-division mandate (Fam. Code § 2550) requires that the spouse who keeps the business account for everything it is worth to that spouse. Methods are flexible (capitalization of excess earnings is the traditional one); the touchstone is what the owner-spouse actually has.',
      goodwill: 'all_included', goodwillText: 'All goodwill, personal and enterprise, is community property and is divided (In re Marriage of Foster, 42 Cal. App. 3d 577 (1974); In re Marriage of Lopez, 38 Cal. App. 3d 93 (1974)). A valuation that excludes personal goodwill, as a Florida or Texas appraiser would, understates the community estate in California.',
      taxAffect: 'disfavored', taxAffectText: 'Hypothetical taxes on a sale that is not going to happen are not deducted (In re Marriage of Fonstein, 17 Cal. 3d 738 (1976)); tax-affecting earnings is viewed skeptically for the same reason unless the business will in fact be sold.',
      dlom: 'disfavored', dloc: 'disfavored', discountsText: 'Where the owner-spouse retains the business and no sale is contemplated, marketability and minority discounts are generally rejected — they measure a transaction that will not occur. Discounts return when the interest will actually be sold or is a genuine minority position.',
      keyPerson: 'Rarely allowed as a separate discount because the goodwill definition already treats the owner’s personal contribution as community value.',
      cite: 'Cal. Fam. Code §§ 2550, 2552; In re Marriage of Foster, 42 Cal. App. 3d 577 (1974); In re Marriage of Fonstein, 17 Cal. 3d 738 (1976)' },
    TX: { name: 'Texas', standard: 'Fair market value',
      keyPersonSeparate: false,
      standardText: 'Texas values community property at fair market value — what a willing buyer would pay a willing seller — and the "just and right" division (§ 7.001) operates on the split, not on the value. The court may consider whether an asset will be taxed and when (§ 7.008).',
      goodwill: 'personal_excluded', goodwillText: 'Personal goodwill of a professional is not property and is not divisible (Nail v. Nail, 486 S.W.2d 761 (Tex. 1972)); the enterprise goodwill of the business is community property. Texas is the strictest of the five on this line.',
      taxAffect: 'case_by_case', taxAffectText: 'No controlling Texas rule; § 7.008 invites tax evidence and appraisers commonly tax-affect S-corporation earnings.',
      dlom: 'permitted', dloc: 'permitted', discountsText: 'Marketability and minority discounts are routinely applied to closely held interests in Texas valuations and accepted where supported by the record; they are contested where the spouse controls the company.',
      keyPerson: 'Generally subsumed in the personal-goodwill exclusion under Nail.',
      cite: 'Tex. Fam. Code §§ 7.001, 7.008; Nail v. Nail, 486 S.W.2d 761 (Tex. 1972)' },
  };

  const $ = (id) => document.getElementById(id);
  let lastModel = null;
  const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
  const pct = (n) => (Math.round((n || 0) * 1000) / 10).toFixed(1) + '%';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const numv = (id) => { const el = $(id); if (!el) return 0; const n = Number(String(el.value || '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const pctv = (id) => numv(id) / 100;

  const SAMPLE = {
    bv_state: 'FL', bv_entity: 's_corp', bv_interest: '100', bv_industry_mult_low: '3.0', bv_industry_mult_high: '4.5',
    bv_rev: '2,400,000', bv_pretax: '380,000', bv_pretax_y2: '340,000', bv_pretax_y3: '300,000', bv_weighting: '321',
    bv_int_expense: '25,000', bv_da: '35,000', bv_owner_comp: '320,000', bv_market_comp: '180,000', bv_addbacks: '45,000', bv_onetime: '30,000',
    bv_capex: '40,000', bv_growth: '3', bv_rf: '4.3', bv_erp_lo: '5.0', bv_erp_hi: '6.0', bv_size_lo: '3.5', bv_size_hi: '4.5', bv_specific_lo: '4.0', bv_specific_hi: '6.0', bv_owner_rate: '30',
    bv_w_income: '60', bv_w_market: '40', bv_w_asset: '0', bv_distributions: '', bv_cf_basis: 'auto',
    bv_company: 'Atlantic Consulting Group, Inc.', bv_valdate: '2026-06-30', bv_descr: 'Management consulting practice founded by the owner-spouse in 2014; twelve employees; two clients account for 38% of revenue.',
    bv_owner_comp_y2: '300,000', bv_owner_comp_y3: '280,000', bv_addbacks_y2: '40,000', bv_addbacks_y3: '38,000', bv_onetime_y2: '0', bv_onetime_y3: '-15,000',
    bv_income_method: 'cap', bv_g1: '8', bv_g2: '6', bv_g3: '5', bv_g4: '4', bv_g5: '3',
    bv_wc_required: '180,000', bv_wc_actual: '230,000',
    bv_src_rf: 'U.S. Treasury 20-year constant maturity, valuation date', bv_src_erp: 'Kroll Cost of Capital Navigator, supply-side ERP', bv_src_size: 'Kroll size-premium decile (CRSP)', bv_src_specific: 'Customer concentration (38% in two clients); owner-dependent origination; no second-tier management', bv_src_mult: 'DealStats, NAICS 5416, transactions 2022-2026, revenue $1-5M',
    bv_base: 'sde', bv_industry_mult_low: '2.2', bv_industry_mult_high: '3.0',
    bv_net_assets: '410,000', bv_tangible_return: '8', bv_intangible_cap: '20', bv_debt: '300,000', bv_nonop: '0', bv_excess_cash: '50,000',
    bv_personal_gw: '40', bv_dlom: '20', bv_dloc: '0', bv_keyperson: '10', bv_taxrate: '26', bv_bernier: '12',
    bv_mum_relationships: '2', bv_mum_reputation: '2', bv_mum_noncompete: '1', bv_mum_depth: '1', bv_mum_systems: '1', bv_mum_transfer: '1',
  };

  function inputs() {
    return {
      state: ($('bv_state') || {}).value || 'FL', entity: ($('bv_entity') || {}).value || 's_corp', interest: numv('bv_interest') / 100 || 1,
      multLow: numv('bv_industry_mult_low'), multHigh: numv('bv_industry_mult_high'),
      rev: numv('bv_rev'), pretax: numv('bv_pretax'), pretaxY2: numv('bv_pretax_y2'), pretaxY3: numv('bv_pretax_y3'), weighting: ($('bv_weighting') || {}).value || 'recent',
      intExpense: numv('bv_int_expense'), da: numv('bv_da'), ownerComp: numv('bv_owner_comp'), marketComp: numv('bv_market_comp'), addbacks: numv('bv_addbacks'), onetime: numv('bv_onetime'),
      capex: numv('bv_capex'), growth: pctv('bv_growth'), rf: pctv('bv_rf'),
      erpLo: pctv('bv_erp_lo'), erpHi: pctv('bv_erp_hi') || pctv('bv_erp_lo'), sizeLo: pctv('bv_size_lo'), sizeHi: pctv('bv_size_hi') || pctv('bv_size_lo'), specLo: pctv('bv_specific_lo'), specHi: pctv('bv_specific_hi') || pctv('bv_specific_lo'),
      ownerRate: pctv('bv_owner_rate') || 0.30,
      wIncome: numv('bv_w_income'), wMarket: numv('bv_w_market'), wAsset: numv('bv_w_asset'),
      distributions: numv('bv_distributions'), cfBasis: ($('bv_cf_basis') || {}).value || 'auto',
      company: (($('bv_company') || {}).value || '').trim(), valdate: (($('bv_valdate') || {}).value || '').trim(), descr: (($('bv_descr') || {}).value || '').trim(),
      ownerCompY2: numv('bv_owner_comp_y2'), ownerCompY3: numv('bv_owner_comp_y3'), addbacksY2: numv('bv_addbacks_y2'), addbacksY3: numv('bv_addbacks_y3'), onetimeY2: numv('bv_onetime_y2'), onetimeY3: numv('bv_onetime_y3'),
      incomeMethod: ($('bv_income_method') || {}).value || 'cap', g: [pctv('bv_g1'), pctv('bv_g2'), pctv('bv_g3'), pctv('bv_g4'), pctv('bv_g5')],
      wcRequired: numv('bv_wc_required'), wcActual: numv('bv_wc_actual'),
      src: { rf: (($('bv_src_rf') || {}).value || '').trim(), erp: (($('bv_src_erp') || {}).value || '').trim(), size: (($('bv_src_size') || {}).value || '').trim(), specific: (($('bv_src_specific') || {}).value || '').trim(), mult: (($('bv_src_mult') || {}).value || '').trim() },
      base: ($('bv_base') || {}).value || 'pretax',
      netAssets: numv('bv_net_assets'), tangibleReturn: pctv('bv_tangible_return') || 0.08, intangibleCap: pctv('bv_intangible_cap') || 0.20,
      debt: numv('bv_debt'), nonop: numv('bv_nonop'), excessCash: numv('bv_excess_cash'),
      personalGw: pctv('bv_personal_gw'), dlom: pctv('bv_dlom'), dloc: pctv('bv_dloc'), keyPerson: pctv('bv_keyperson'),
      taxRate: pctv('bv_taxrate'), bernierRate: pctv('bv_bernier'),
      mum: ['relationships', 'reputation', 'noncompete', 'depth', 'systems', 'transfer'].map((k) => Math.min(3, Math.max(0, numv('bv_mum_' + k)))),
    };
  }

  /** The fundamentals: weighted, normalized earnings on three bases → income, market and asset approaches. */
  function fundamentals(i) {
    // Weighted reported pre-tax earnings (most recent = Y1)
    const ys = [i.pretax, i.pretaxY2, i.pretaxY3];
    const have = ys.filter((v, k) => k === 0 || v !== 0);
    let weightedPretax = i.pretax;
    if (i.weighting === '321' && have.length > 1) { const w = [3, 2, 1].slice(0, have.length); weightedPretax = have.reduce((a, v, k) => a + v * w[k], 0) / w.reduce((a, b) => a + b, 0); }
    else if (i.weighting === 'avg' && have.length > 1) { weightedPretax = have.reduce((a, b) => a + b, 0) / have.length; }
    // Per-year normalization schedule (Y1 most recent). Owner comp, add-backs and one-time items by year; market comp and capex single.
    const years = [
      { label: 'Y1 (most recent)', pretax: i.pretax, ownerComp: i.ownerComp, addbacks: i.addbacks, onetime: i.onetime },
      { label: 'Y2', pretax: i.pretaxY2, ownerComp: i.ownerCompY2 || i.ownerComp, addbacks: i.addbacksY2, onetime: i.onetimeY2 },
      { label: 'Y3', pretax: i.pretaxY3, ownerComp: i.ownerCompY3 || i.ownerComp, addbacks: i.addbacksY3, onetime: i.onetimeY3 },
    ].filter((y, k) => k === 0 || y.pretax !== 0).map((y) => Object.assign(y, { compAdj: Math.max(0, y.ownerComp - i.marketComp), norm: y.pretax + Math.max(0, y.ownerComp - i.marketComp) + y.addbacks + y.onetime - i.capex }));
    const wts = years.length === 1 ? [1] : i.weighting === '321' ? [3, 2, 1].slice(0, years.length) : i.weighting === 'avg' ? years.map(() => 1) : [1].concat(years.slice(1).map(() => 0));
    const wsum = wts.reduce((a, b) => a + b, 0);
    const compAdj = years.reduce((a, y, k) => a + y.compAdj * wts[k], 0) / wsum;
    const wAddbacks = years.reduce((a, y, k) => a + y.addbacks * wts[k], 0) / wsum;
    const wOnetime = years.reduce((a, y, k) => a + y.onetime * wts[k], 0) / wsum;
    // Three earnings bases, all normalized (weighted across the schedule)
    const pretaxNorm = years.reduce((a, y, k) => a + y.norm * wts[k], 0) / wsum;             // for the income approach
    const ebitda = weightedPretax + i.intExpense + i.da + compAdj + wAddbacks + wOnetime;   // market: EBITDA multiples
    const sde = weightedPretax + i.intExpense + i.da + i.ownerComp + wAddbacks + wOnetime;  // market: SDE multiples (one owner's full comp added back)
    const baseEarnings = i.base === 'sde' ? sde : i.base === 'ebitda' ? ebitda : pretaxNorm;
    // Build-up rate is an AFTER-tax equity rate. Applied to after-tax earnings under full or partial
    // tax-affecting; converted to a pre-tax equivalent when the earnings stay pre-tax (no tax-affecting).
    // Each build-up component is a range; the conclusion uses the midpoint and the ends bound the sensitivity.
    const capLo = Math.max(0.05, i.rf + i.erpLo + i.sizeLo + i.specLo - i.growth);
    const capHi = Math.max(0.05, i.rf + i.erpHi + i.sizeHi + i.specHi - i.growth);
    const capAfterTax = (capLo + capHi) / 2;
    const capPreTax = capAfterTax / (1 - i.ownerRate);
    const capValue = (earn, rate) => (earn * (1 + i.growth)) / rate;
    const incomeAt = (rate) => ({
      none: capValue(pretaxNorm, rate / (1 - i.ownerRate)),
      full: capValue(pretaxNorm * (1 - i.taxRate), rate),
      bernier: capValue(pretaxNorm * (1 - i.bernierRate), rate),
    });
    const income = incomeAt(capAfterTax);
    // DCF alternative: five explicit years at the entered growth path, terminal at long-term growth; discount rate = cap rate + long-term growth.
    const dcfAt = (rate, earnAfterTax) => {
      const k = rate + i.growth; let pv = 0, e = earnAfterTax;
      for (let y = 0; y < 5; y++) { e = e * (1 + (i.g[y] || i.growth)); pv += e / Math.pow(1 + k, y + 1); }
      const terminal = (e * (1 + i.growth)) / Math.max(0.01, k - i.growth);
      return pv + terminal / Math.pow(1 + k, 5);
    };
    const dcf = {
      none: dcfAt(capPreTax, pretaxNorm),
      full: dcfAt(capAfterTax, pretaxNorm * (1 - i.taxRate)),
      bernier: dcfAt(capAfterTax, pretaxNorm * (1 - i.bernierRate)),
    };
    // Working capital: surplus over the requirement is a non-operating asset; a deficit reduces equity
    const wcAdj = (i.wcRequired || i.wcActual) ? (i.wcActual - i.wcRequired) : 0;
    // Approach weights (normalized). Asset approach: a floor always; a weighted component only if given weight.
    const wSum = (i.wIncome + i.wMarket + i.wAsset) || 100;
    const w = { income: (i.wIncome || (i.wMarket || i.wAsset ? 0 : 60)) / wSum, market: (i.wMarket || 0) / wSum, asset: (i.wAsset || 0) / wSum };
    if (!(i.wIncome || i.wMarket || i.wAsset)) { w.income = 0.6; w.market = 0.4; w.asset = 0; }
    const market = { low: baseEarnings * i.multLow, high: baseEarnings * i.multHigh, mid: baseEarnings * (i.multLow + i.multHigh) / 2, base: baseEarnings };
    // Excess earnings (Rev. Rul. 68-609): goodwill = (normalized earnings - fair return on net tangibles) / intangible cap rate
    const fairReturn = i.netAssets * i.tangibleReturn;
    const excess = Math.max(0, pretaxNorm - fairReturn);
    const goodwillEE = excess / i.intangibleCap;
    const excessEarningsValue = i.netAssets + goodwillEE;
    return { years, wts, weightedPretax, compAdj, wAddbacks, wOnetime, pretaxNorm, ebitda, sde, baseEarnings, capLo, capHi, capAfterTax, capPreTax, income, incomeAt, dcf, dcfAt, wcAdj, w, market, asset: i.netAssets, fairReturn, excess, goodwillEE, excessEarningsValue, yearsUsed: have.length };
  }

  /** MUM-lite: six attributes scored 0-3 → suggested personal share of goodwill. */
  function mumSuggest(scores) {
    // attributes 0-2 point toward the person (relationships, reputation, absence of a non-compete);
    // 3-5 point toward the enterprise (management depth, systems/brand, transferability). Non-compete: 0 = none in place.
    const personal = scores[0] + scores[1] + (3 - scores[2]);
    const enterprise = scores[3] + scores[4] + scores[5];
    const tot = personal + enterprise; if (!tot) return null;
    return personal / tot;
  }

  function computeAll() {
    const i = inputs(); const jur = J[i.state] || J.FL; const f = fundamentals(i);
    if (!(i.pretax || i.rev || i.netAssets)) { renderEmpty(jur); return; }
    const taxSel = $('bv_tax_choice');
    const taxChoice = jur.taxAffect === 'partial' ? 'bernier' : jur.taxAffect === 'disfavored' ? 'none' : (taxSel ? taxSel.value : 'bernier');
    if (taxSel) { taxSel.disabled = jur.taxAffect !== 'case_by_case'; if (jur.taxAffect !== 'case_by_case') taxSel.value = taxChoice; }
    // MUM suggestion → personal goodwill share (the typed % wins if the user set one)
    const mum = mumSuggest(i.mum); const mumEl = $('bv_mum_out');
    if (mumEl) mumEl.textContent = mum == null ? '' : `Attribute scoring suggests ${pct(mum)} personal / ${pct(1 - mum)} enterprise.`;
    const personalShare = i.personalGw > 0 ? i.personalGw : (mum == null ? 0 : mum);

    const incomeV = i.incomeMethod === 'dcf' ? f.dcf[taxChoice] : f.income[taxChoice];
    const blend = (inc, mkt) => {
      const hasMkt = mkt > 0; const wI = hasMkt ? f.w.income : f.w.income + f.w.market; const wM = hasMkt ? f.w.market : 0; const wA = f.w.asset;
      const tot = (wI + wM + wA) || 1;
      return (inc * wI + mkt * wM + f.asset * wA) / tot;
    };
    const enterpriseRaw = blend(incomeV, f.market.mid);
    const floorApplied = f.asset > enterpriseRaw;
    const enterprise = floorApplied ? f.asset : enterpriseRaw;
    // Equity bridge: the interest is in the equity, not the enterprise
    const equity = enterprise - i.debt + i.nonop + i.excessCash + f.wcAdj;
    // Goodwill: excess-earnings (derived) is the primary measure; the implied residual is shown beside it
    const goodwillImplied = Math.max(0, enterprise - f.asset);
    // The split is applied to the goodwill that actually sits in the value being divided: the excess-earnings
    // figure, capped at the goodwill implied by the concluded enterprise value (you cannot exclude more than is there).
    const goodwill = f.goodwillEE > 0 ? Math.min(f.goodwillEE, goodwillImplied) : goodwillImplied;
    const personalGw = goodwill * personalShare;
    const gwExcluded = jur.goodwill === 'personal_excluded' ? personalGw : 0;
    const maritalEquity = Math.max(0, equity - gwExcluded);
    const proRataControl = maritalEquity * i.interest;
    // Minority cash-flow basis: an interest that cannot compel distributions is worth what it actually receives.
    const minorityRate = taxChoice === 'none' ? f.capPreTax : f.capAfterTax;
    const distAfter = taxChoice === 'none' ? i.distributions : i.distributions * (1 - (taxChoice === 'full' ? i.taxRate : i.bernierRate));
    const minorityBasis = i.distributions > 0 ? (distAfter * (1 + i.growth)) / minorityRate : 0;
    const useMinority = i.interest < 0.5 && minorityBasis > 0 && (i.cfBasis === 'minority' || (i.cfBasis === 'auto' && jur.dloc === 'permitted'));
    const proRata = useMinority ? minorityBasis : proRataControl;
    const dlomAllowed = jur.dlom === 'permitted', dlocAllowed = jur.dloc === 'permitted' && i.interest < 0.5 && !useMinority; // a minority cash-flow basis already prices the lack of control
    const afterDloc = proRata * (1 - (dlocAllowed ? i.dloc : 0));
    const afterDlom = afterDloc * (1 - (dlomAllowed ? i.dlom : 0));
    const keyAllowed = !!jur.keyPersonSeparate;
    const conclusion = afterDlom * (1 - (keyAllowed ? i.keyPerson : 0));

    const rows = [];
    const t = (label, lowV, highV, posture, note) => rows.push({ label, lowV, highV, posture, note });
    const bridge = (ev) => Math.max(0, ev - i.debt + i.nonop + i.excessCash + f.wcAdj);
    t('Tax-affecting the earnings', bridge(blend(f.income.full, f.market.mid)), bridge(blend(f.income.none, f.market.mid)), jur.taxAffect === 'partial' ? 'Fixed by Bernier (partial)' : jur.taxAffect === 'disfavored' ? 'Disfavored — no hypothetical tax' : 'Open — litigated', jur.taxAffectText);
    t('Capitalization rate (build-up range)', bridge(blend(f.incomeAt(f.capHi)[taxChoice], f.market.mid)), bridge(blend(f.incomeAt(f.capLo)[taxChoice], f.market.mid)), 'Expert judgment — every component is argued', 'The risk-free rate is observable; the equity, size and company-specific premiums are opinions. The range you entered is the argument.');
    if (i.interest < 0.5 && minorityBasis > 0) t('Minority cash flows vs. pro-rata share', Math.min(minorityBasis, proRataControl), Math.max(minorityBasis, proRataControl), useMinority ? 'Distributions basis used (control discount not stacked)' : 'Pro-rata basis used', 'A minority holder who cannot compel distributions is worth what the interest actually receives; valuing it on pro-rata earnings and then discounting for lack of control is the same argument twice.');
    t('Personal vs. enterprise goodwill', equity - personalGw, equity, jur.goodwill === 'personal_excluded' ? 'Personal goodwill excluded' : jur.goodwill === 'all_included' ? 'All goodwill divided' : 'Case by case', jur.goodwillText);
    t('Discount for lack of marketability', proRata * (1 - i.dlom), proRata, dlomAllowed ? 'Permitted, contested if no sale' : 'Disfavored where spouse keeps the business', jur.discountsText);
    if (i.interest < 1) t('Minority / lack-of-control discount', proRata * (1 - i.dloc), proRata, dlocAllowed ? 'Permitted for a true minority interest' : (i.interest >= 0.5 ? 'Not available — controlling interest' : 'Disfavored where no sale'), jur.discountsText);
    t('Key-person discount', afterDlom * (1 - i.keyPerson), afterDlom, keyAllowed ? 'Contested as duplicative of goodwill' : 'Not taken separately in this state', jur.keyPerson);

    // Sensitivity: conclusion across the build-up range (low, mid, high cap rate) and the multiple (low / mid / high)
    const rateShifts = [f.capLo - f.capAfterTax, (f.capLo - f.capAfterTax) / 2, 0, (f.capHi - f.capAfterTax) / 2, f.capHi - f.capAfterTax];
    const mults = [i.multLow, (i.multLow + i.multHigh) / 2, i.multHigh];
    const sens = rateShifts.map((sh) => mults.map((mlt) => {
      const rate = Math.max(0.03, f.capAfterTax + sh);
      const inc = i.incomeMethod === 'dcf' ? f.dcfAt(taxChoice === 'none' ? rate / (1 - i.ownerRate) : rate, taxChoice === 'none' ? f.pretaxNorm : f.pretaxNorm * (1 - (taxChoice === 'full' ? i.taxRate : i.bernierRate))) : f.incomeAt(rate)[taxChoice];
      const ev = blend(inc, f.baseEarnings * mlt);
      const eq = Math.max(0, (Math.max(ev, f.asset)) - i.debt + i.nonop + i.excessCash + f.wcAdj);
      const gw = Math.max(0, (Math.max(ev, f.asset)) - f.asset); const gwx = jur.goodwill === 'personal_excluded' ? Math.min(gw, goodwill) * personalShare : 0;
      const pr = useMinority ? minorityBasis : Math.max(0, eq - gwx) * i.interest;
      return pr * (1 - (dlocAllowed ? i.dloc : 0)) * (1 - (dlomAllowed ? i.dlom : 0)) * (1 - (keyAllowed ? i.keyPerson : 0));
    }));

    lastModel = { i, jur, f, taxChoice, incomeV, enterprise, equity, floorApplied, goodwillImplied, goodwill, personalShare, personalGw, gwExcluded, maritalEquity, proRata, proRataControl, minorityBasis, useMinority, afterDloc, afterDlom, conclusion, rows, sens, rateShifts, mults, mum, dlomAllowed, dlocAllowed, keyAllowed };
    render(lastModel);
  }

  function renderEmpty(jur) {
    const res = $('bv_results'); if (res) res.innerHTML = '<p class="bv-empty">Enter the business’s pre-tax earnings, revenue or net assets to see the valuation. Or <button type="button" class="bv-link" data-load-sample>load a sample business</button>.</p>';
    const b = res && res.querySelector('[data-load-sample]'); if (b) b.addEventListener('click', loadSample);
    renderJurisdiction(jur);
  }

  function render(m) {
    const { i, jur, f, taxChoice, incomeV, enterprise, equity, floorApplied, goodwillImplied, goodwill, personalShare, personalGw, gwExcluded, maritalEquity, proRata, proRataControl, minorityBasis, useMinority, afterDloc, afterDlom, conclusion, rows, sens, rateShifts, mults, mum } = m;
    const wTxt = `income ${pct(f.w.income)} / market ${pct(f.w.market)}${f.w.asset ? ' / asset ' + pct(f.w.asset) : ''}`;
    const res = $('bv_results'); if (!res) return;
    const low = Math.min(conclusion, ...rows.map((r) => r.lowV).filter((v) => v > 0));
    const high = Math.max(conclusion, ...rows.map((r) => r.highV));
    const baseName = i.base === 'sde' ? "seller’s discretionary earnings" : i.base === 'ebitda' ? 'EBITDA' : 'normalized pre-tax earnings';
    const taxLabel = taxChoice === 'none' ? `no tax-affecting — pre-tax earnings at a ${pct(f.capPreTax)} pre-tax-equivalent rate` : taxChoice === 'full' ? `fully tax-affected at ${pct(i.taxRate)}, after-tax rate ${pct(f.capAfterTax)}` : `Bernier partial tax-affecting at ${pct(i.bernierRate)}, after-tax rate ${pct(f.capAfterTax)}`;
    res.innerHTML = `
      <div class="bv-summary">
        <div class="bv-card"><div class="bv-k">Normalized pre-tax earnings</div><div class="bv-v">${money(f.pretaxNorm)}</div><div class="bv-s">${f.yearsUsed > 1 ? f.yearsUsed + '-year ' + (i.weighting === '321' ? 'weighted (3-2-1)' : 'average') : 'most recent year'} reported ${money(f.weightedPretax)} + owner comp above market ${money(f.compAdj)} + add-backs ${money(i.addbacks)} + one-time ${money(i.onetime)} − sustaining capex ${money(i.capex)}. SDE ${money(f.sde)} · EBITDA ${money(f.ebitda)}</div></div>
        <div class="bv-card"><div class="bv-k">Enterprise value (100%)</div><div class="bv-v">${money(enterprise)}</div><div class="bv-s">income ${money(incomeV)} by ${i.incomeMethod === 'dcf' ? 'five-year DCF' : 'single-period capitalization'} (${taxLabel}) ; market ${money(f.market.mid)} = ${baseName} ${money(f.baseEarnings)} × ${i.multLow}–${i.multHigh}; weights ${wTxt}; build-up range ${pct(f.capLo)}–${pct(f.capHi)}${floorApplied ? '; net-asset floor applied' : ''}</div></div>
        <div class="bv-card"><div class="bv-k">Equity value (100%) → marital interest</div><div class="bv-v">${money(proRata)}</div><div class="bv-s">enterprise − debt ${money(i.debt)} + non-operating assets ${money(i.nonop)} + excess cash ${money(i.excessCash)} = equity ${money(equity)}${f.wcAdj ? ` (working capital ${f.wcAdj >= 0 ? 'surplus' : 'deficit'} ${money(f.wcAdj)} included)` : ''}${gwExcluded ? `; less ${money(gwExcluded)} personal goodwill excluded in ${jur.name}` : ''}; × ${pct(i.interest)} interest${useMinority ? ` — valued on the distributions the interest receives (${money(minorityBasis)}) rather than its pro-rata share (${money(proRataControl)})` : ''}</div></div>
        <div class="bv-card bv-card-hi"><div class="bv-k">Indicated value for settlement, after the ${jur.name} posture on discounts</div><div class="bv-v">${money(conclusion)}</div><div class="bv-s">negotiating range ${money(low)} – ${money(high)}: the two ends are the two sides’ positions on the choices below</div></div>
      </div>

      <h4>What moves the number in ${jur.name}</h4>
      <div class="table-wrap"><table class="bv-table">
        <thead><tr><th>Contested choice</th><th class="num">Resolved against the owner-spouse</th><th class="num">Resolved for the owner-spouse</th><th class="num">Swing</th><th>${jur.name} posture</th></tr></thead>
        <tbody>${rows.map((r) => `<tr><td><strong>${esc(r.label)}</strong><div class="bv-cell-note">${esc(r.note)}</div></td><td class="num">${money(r.highV)}</td><td class="num">${money(r.lowV)}</td><td class="num">${money(r.highV - r.lowV)}</td><td>${esc(r.posture)}</td></tr>`).join('')}</tbody>
      </table></div>

      <h4>Goodwill — derived, not assumed</h4>
      <p>Excess-earnings method (Rev. Rul. 68-609): normalized earnings ${money(f.pretaxNorm)} less a ${pct(i.tangibleReturn)} return on net tangible assets of ${money(f.asset)} (${money(f.fairReturn)}) leaves excess earnings of ${money(f.excess)}, capitalized at ${pct(i.intangibleCap)} → goodwill of <strong>${money(f.goodwillEE)}</strong> by that method (${money(goodwillImplied)} implied by the concluded value; the lower figure, ${money(goodwill)}, is the goodwill the split is applied to). Personal share ${pct(personalShare)} = ${money(personalGw)}${i.personalGw > 0 ? ' (your entry)' : (mum == null ? '' : ' (from the attribute scoring)')}. ${esc(jur.goodwillText)}</p>

      <h4>Discounts</h4>
      <p class="bv-cell-note">Reference bands: restricted-stock studies (SEC Institutional, Moroney, Maher, Silber, FMV Opinions, Columbia) report median lack-of-marketability discounts roughly in the 13%–35% range for registered-but-restricted shares; pre-IPO studies (Emory, Willamette, Valuation Advisors) report 40%–60% for private shares before a public offering. A closely held operating business typically sits between them; the entered ${pct(i.dlom)} should be justified against these.</p>
      <p>Marital equity ${money(maritalEquity)} × ${pct(i.interest)} = ${money(proRata)} → after lack-of-control ${money(afterDloc)} → after lack-of-marketability ${money(afterDlom)} → after key-person ${money(conclusion)}. ${esc(jur.discountsText)} ${esc(jur.keyPerson)}</p>

      <h4>Sensitivity — the conclusion across the capitalization rate and the multiple</h4>
      <div class="table-wrap"><table class="bv-table bv-sens">
        <thead><tr><th>Cap rate (after-tax basis; low → high of the build-up range)</th>${mults.map((mlt) => `<th class="num">${baseName} × ${mlt.toFixed(2)}</th>`).join('')}</tr></thead>
        <tbody>${sens.map((row, k) => `<tr><td>${pct(f.capAfterTax + rateShifts[k])}${rateShifts[k] === 0 ? ' <em>(entered)</em>' : ''}</td>${row.map((v, j) => `<td class="num${rateShifts[k] === 0 && j === 1 ? ' bv-center' : ''}">${money(v)}</td>`).join('')}</tr>`).join('')}</tbody>
      </table></div>

      <h4>The standard of value in ${jur.name}</h4>
      <p>${esc(jur.standardText)}</p>

      <p class="bv-meth"><strong>Method.</strong> Reported pre-tax earnings for up to three years are weighted as selected, then normalized (owner compensation above market, discretionary add-backs, non-recurring items, sustaining capital expenditure). The income approach capitalizes next year’s normalized earnings at a build-up rate (risk-free + equity risk premium + size premium + company-specific risk − long-term growth), each premium entered as a range whose midpoint sets the conclusion and whose ends bound the sensitivity table; the build-up rate is an after-tax equity rate, so it is applied to tax-affected earnings, and when the state’s posture leaves the earnings pre-tax the rate is converted to a pre-tax equivalent at the owner’s ${pct(i.ownerRate)} rate. The market approach applies your multiple to the matching earnings base — SDE, EBITDA or pre-tax — and the approaches are blended at the weights you set (default 60% income / 40% market); adjusted net tangible assets are a floor and, if weighted, a component. A minority interest with a distributions figure is valued on what it receives (control-versus-minority cash flows) instead of pro-rata earnings, and the lack-of-control discount is then not applied — the two are the same adjustment. The equity bridge deducts interest-bearing debt and adds non-operating assets and excess cash. Goodwill is derived by the excess-earnings method and split personal/enterprise by your entry or by the six-attribute scoring; the state decides whether the personal share counts. Discounts apply in the order lack-of-control, then lack-of-marketability, then key-person, and only where the state’s posture permits. This is a calculated value for negotiation and mediation — it is not an appraisal, it has not been prepared by a credentialed appraiser under USPAP or SSVS, and it is not admissible as one. When the case needs an expert, hire one; the point of this schedule is to know whether it does, and what to ask them to prove.</p>`;
    renderJurisdiction(jur);
  }

  function renderJurisdiction(jur) {
    const jn = $('bv_jur_name'); if (jn) jn.textContent = jur.name;
    const jps = $('bv_print_state'); if (jps) jps.textContent = jur.name;
    const jp = $('bv_jur_panel'); if (jp) jp.innerHTML = `
      <div class="bv-jur-grid">
        <div><strong>Standard of value — ${esc(jur.standard)}</strong><p>${esc(jur.standardText)}</p></div>
        <div><strong>Goodwill</strong><p>${esc(jur.goodwillText)}</p></div>
        <div><strong>Tax-affecting</strong><p>${esc(jur.taxAffectText)}</p></div>
        <div><strong>Discounts</strong><p>${esc(jur.discountsText)} ${esc(jur.keyPerson)}</p></div>
        <div><strong>Authority</strong><p>${esc(jur.cite)}</p></div>
      </div>`;
    const taxSel = $('bv_tax_choice'); const taxHint = $('bv_tax_hint');
    if (taxHint) taxHint.textContent = jur.taxAffect === 'partial' ? 'Massachusetts: Bernier fixes partial tax-affecting.' : jur.taxAffect === 'disfavored' ? 'California: hypothetical tax on earnings that will not be sold is disfavored; none applied.' : `${jur.name} leaves this open — choose the position to model.`;
    document.querySelectorAll('.bv-disc-note').forEach((el) => { el.textContent = jur.dlom === 'permitted' ? `${jur.name} permits discounts where the record supports them.` : `${jur.name} disfavors discounts where the spouse keeps the business; entered discounts are shown but not applied to the conclusion.`; });
  }


  /* ── Calculation of Value — DRAFT report ────────────────────────────────────
     Assembled from the current model in the form of an SSVS calculation-engagement
     report, watermarked DRAFT — NOT ISSUED. It becomes a firm deliverable only
     when a credentialed reviewer at the firm has verified the inputs, sourced the
     data and signed. The print window is driven from this page (the site's CSP
     blocks scripts written into a popup). */
  function buildReport(m) {
    const { i, jur, f, taxChoice, incomeV, enterprise, equity, floorApplied, goodwillImplied, goodwill, personalShare, personalGw, gwExcluded, maritalEquity, proRata, proRataControl, minorityBasis, useMinority, afterDloc, afterDlom, conclusion, rows, sens, rateShifts, mults, dlomAllowed, dlocAllowed, keyAllowed } = m;
    const company = i.company || '[Company name]';
    const vdate = i.valdate ? new Date(i.valdate + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '[valuation date]';
    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const baseName = i.base === 'sde' ? "seller's discretionary earnings" : i.base === 'ebitda' ? 'EBITDA' : 'normalized pre-tax earnings';
    const taxText = taxChoice === 'none' ? `The earnings were not tax-affected; the after-tax build-up rate was converted to a pre-tax equivalent of ${pct(f.capPreTax)} at an assumed owner rate of ${pct(i.ownerRate)}.` : taxChoice === 'full' ? `The earnings were tax-affected at an entity-level rate of ${pct(i.taxRate)}.` : `The earnings were tax-affected at ${pct(i.bernierRate)}, a partial rate reflecting the pass-through owner's tax advantage (the approach accepted in Bernier v. Bernier, 449 Mass. 774 (2007)).`;
    const src = (v, dflt) => v ? esc(v) : `<span class="rep-missing">[${dflt} — source to be inserted by the reviewer]</span>`;
    const sched = `<table class="rep-table"><thead><tr><th>Normalization</th>${f.years.map((y) => `<th class="num">${esc(y.label)}</th>`).join('')}<th class="num">Weight</th></tr></thead><tbody>
      <tr><td>Reported pre-tax earnings</td>${f.years.map((y) => `<td class="num">${money(y.pretax)}</td>`).join('')}<td></td></tr>
      <tr><td>Owner compensation paid</td>${f.years.map((y) => `<td class="num">${money(y.ownerComp)}</td>`).join('')}<td></td></tr>
      <tr><td>Less market compensation</td>${f.years.map(() => `<td class="num">(${money(i.marketComp)})</td>`).join('')}<td></td></tr>
      <tr><td>Excess owner compensation added back</td>${f.years.map((y) => `<td class="num">${money(y.compAdj)}</td>`).join('')}<td></td></tr>
      <tr><td>Discretionary add-backs</td>${f.years.map((y) => `<td class="num">${money(y.addbacks)}</td>`).join('')}<td></td></tr>
      <tr><td>Non-recurring items (net)</td>${f.years.map((y) => `<td class="num">${money(y.onetime)}</td>`).join('')}<td></td></tr>
      <tr><td>Less sustaining capital expenditures</td>${f.years.map(() => `<td class="num">(${money(i.capex)})</td>`).join('')}<td></td></tr>
      <tr class="rep-total"><td>Normalized pre-tax earnings</td>${f.years.map((y, k) => `<td class="num">${money(y.norm)}</td>`).join('')}<td class="num">${f.wts.map((w) => w).join(' / ')}</td></tr>
    </tbody></table><p class="rep-note">Weighted normalized pre-tax earnings: <strong>${money(f.pretaxNorm)}</strong>. Interest expense ${money(i.intExpense)} and depreciation and amortization ${money(i.da)} are added back for the EBITDA (${money(f.ebitda)}) and SDE (${money(f.sde)}) bases.</p>`;
    const sensTable = `<table class="rep-table"><thead><tr><th>Capitalization rate</th>${mults.map((mlt) => `<th class="num">${baseName} × ${mlt.toFixed(2)}</th>`).join('')}</tr></thead><tbody>${sens.map((row, k) => `<tr>${rateShifts[k] === 0 ? '<td><strong>' : '<td>'}${pct(f.capAfterTax + rateShifts[k])}${rateShifts[k] === 0 ? ' (concluded)</strong>' : ''}</td>${row.map((v) => `<td class="num">${money(v)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
    const contested = `<table class="rep-table"><thead><tr><th>Choice</th><th class="num">Against owner-spouse</th><th class="num">For owner-spouse</th><th>${esc(jur.name)} posture</th></tr></thead><tbody>${rows.map((r) => `<tr><td>${esc(r.label)}</td><td class="num">${money(r.highV)}</td><td class="num">${money(r.lowV)}</td><td>${esc(r.posture)}</td></tr>`).join('')}</tbody></table>`;
    return `
<div class="rep-cover">
  <div class="rep-kicker">DRAFT — NOT ISSUED · CALCULATION ENGAGEMENT (AICPA SSVS No. 1)</div>
  <h1>Calculation of Value</h1>
  <div class="rep-sub">${esc(company)}</div>
  <div class="rep-sub">${pct(i.interest)} ${i.interest >= 0.5 ? 'controlling' : 'non-controlling'} interest · as of ${esc(vdate)}</div>
  <div class="rep-sub">Purpose: property division in a marital dissolution governed by ${esc(jur.name)} law</div>
  <div class="rep-sub rep-draft">Prepared with the Donovan Legal PLLC valuation calculator on ${esc(today)}. This draft has not been reviewed, sourced or signed. It is not a conclusion of value and may not be relied upon or presented to any court or party until issued by a credentialed reviewer.</div>
  <div class="rep-notice"><strong>Educational tool &mdash; not legal advice.</strong> This document was generated by a self-service calculator published by Donovan Legal PLLC for educational and illustrative purposes only. It applies textbook valuation methods to figures the user entered, summarizes state law at a high level, and may not reflect current law or the user&rsquo;s circumstances. It is not legal, tax, accounting or valuation advice; it has not been prepared by a credentialed appraiser; and generating it does not create an attorney&ndash;client or any other professional relationship with Donovan Legal PLLC. Do not act on it without advice specific to your facts from a qualified professional.</div>
</div>

<h2>1. Engagement and standard of value</h2>
<p>This is a calculation engagement as defined by the AICPA Statement on Standards for Valuation Services No. 1: the analyst and the client agreed on the approaches and procedures below, and the result is a <em>calculated value</em>, not a conclusion of value. A valuation engagement, which would involve additional procedures and produce a conclusion of value, was not performed. The calculated value may differ from a conclusion of value.</p>
<p>The standard of value follows the law of the forum: <strong>${esc(jur.standard)}</strong>. ${esc(jur.standardText)}</p>
<p>Premise of value: going concern. Level of value: ${useMinority ? 'non-controlling, on the cash flows the interest actually receives' : i.interest >= 0.5 ? 'controlling' : 'non-controlling, valued on a pro-rata share of controlling cash flows with the adjustments described in Section 7'}.</p>

<h2>2. The company</h2>
<p>${i.descr ? esc(i.descr) : '<span class="rep-missing">[Description of the business, its history, ownership and operations — to be inserted by the reviewer]</span>'} The entity is ${esc(({ s_corp: 'an S corporation', llc: 'a limited liability company taxed as a partnership', partnership: 'a partnership', sole: 'a sole proprietorship or disregarded entity', c_corp: 'a C corporation' })[i.entity] || 'a closely held entity')} with most recent annual revenue of ${money(i.rev)}.</p>

<h2>3. Sources of information</h2>
<ul>
  <li>Financial statements or tax returns for the ${f.years.length} year${f.years.length > 1 ? 's' : ''} shown in Section 4, as provided by the owner-spouse. <span class="rep-missing">[Reviewer: identify the statements — compiled, reviewed, audited, or tax returns — and the periods.]</span></li>
  <li>Risk-free rate: ${src(i.src.rf, 'Treasury source and date')}.</li>
  <li>Equity risk premium: ${src(i.src.erp, 'ERP source')}.</li>
  <li>Size premium: ${src(i.src.size, 'size-premium source')}.</li>
  <li>Company-specific risk: ${src(i.src.specific, 'basis for the company-specific premium')}.</li>
  <li>Market multiples: ${src(i.src.mult, 'transaction database, industry code, period and size band')}.</li>
</ul>

<h2>4. Normalization of earnings</h2>
${sched}

<h2>5. Income approach</h2>
<p>${i.incomeMethod === 'dcf' ? `A five-year discounted cash flow was prepared with growth of ${i.g.map((g) => pct(g)).join(', ')} in years one through five and a terminal growth rate of ${pct(i.growth)}. The discount rate is the build-up capitalization rate plus long-term growth.` : `Weighted normalized earnings were capitalized as a single period, grown one year at ${pct(i.growth)}.`} The capitalization rate was built up as: risk-free rate ${pct(i.rf)}; equity risk premium ${pct(i.erpLo)}–${pct(i.erpHi)}; size premium ${pct(i.sizeLo)}–${pct(i.sizeHi)}; company-specific risk ${pct(i.specLo)}–${pct(i.specHi)}; less long-term growth ${pct(i.growth)}; range ${pct(f.capLo)}–${pct(f.capHi)}, midpoint <strong>${pct(f.capAfterTax)}</strong>. ${taxText}</p>
<p>Indicated enterprise value, income approach: <strong>${money(incomeV)}</strong>.</p>

<h2>6. Market approach and asset approach</h2>
<p>${f.market.mid > 0 ? `Transaction multiples of ${i.multLow}× to ${i.multHigh}× were applied to ${baseName} of ${money(f.baseEarnings)}, indicating ${money(f.market.low)} to ${money(f.market.high)}, midpoint <strong>${money(f.market.mid)}</strong>.` : 'No market multiples were applied.'} Adjusted net tangible assets were ${money(f.asset)}${floorApplied ? ', which exceeded the income and market indications and was adopted as the value' : ', which serves as a floor'}.</p>
<p>Reconciliation: income ${pct(f.w.income)}, market ${pct(f.w.market)}${f.w.asset ? `, asset ${pct(f.w.asset)}` : ''}. <strong>Enterprise value (100%): ${money(enterprise)}.</strong> Equity bridge: less interest-bearing debt ${money(i.debt)}, plus non-operating assets ${money(i.nonop)}, plus excess cash ${money(i.excessCash)}${f.wcAdj ? `, ${f.wcAdj >= 0 ? 'plus working-capital surplus' : 'less working-capital deficit'} ${money(Math.abs(f.wcAdj))}` : ''} = <strong>equity value ${money(equity)}</strong>.</p>

<h2>7. Goodwill, discounts and the ${esc(jur.name)} posture</h2>
<p>By the excess-earnings method (Rev. Rul. 68-609), normalized earnings of ${money(f.pretaxNorm)} less a ${pct(i.tangibleReturn)} return on net tangible assets (${money(f.fairReturn)}) leave excess earnings of ${money(f.excess)}, capitalized at ${pct(i.intangibleCap)} for goodwill of ${money(f.goodwillEE)}; the goodwill implied by the concluded value is ${money(goodwillImplied)}, and the lower figure, ${money(goodwill)}, is used. The personal share of goodwill is ${pct(personalShare)} (${money(personalGw)}), ${i.personalGw > 0 ? 'as determined by the client' : 'as indicated by the attribute scoring'}. ${esc(jur.goodwillText)} ${gwExcluded ? `Personal goodwill of ${money(gwExcluded)} is therefore excluded from the marital estate.` : 'No goodwill is excluded under this posture.'}</p>
<p>Marital equity ${money(maritalEquity)} × ${pct(i.interest)} = ${money(proRataControl)} pro rata.${useMinority ? ` The interest is non-controlling and is valued on the distributions it receives, ${money(i.distributions)} per year, indicating ${money(minorityBasis)}; no separate lack-of-control discount is applied.` : ''} Lack-of-control discount ${pct(i.dloc)}: ${dlocAllowed ? 'applied' : 'not applied'}. Lack-of-marketability discount ${pct(i.dlom)}: ${dlomAllowed ? 'applied' : 'not applied'}. Key-person discount ${pct(i.keyPerson)}: ${keyAllowed ? 'applied' : 'not applied separately'}. ${esc(jur.discountsText)} ${esc(jur.keyPerson)}</p>
<p>Reference bands for lack-of-marketability discounts: restricted-stock studies (median roughly 13%–35%) and pre-IPO studies (40%–60%). <span class="rep-missing">[Reviewer: support the discount applied against these studies and the facts of this interest.]</span></p>

<h2>8. Calculated value</h2>
<p class="rep-value">The calculated value of the ${pct(i.interest)} interest in ${esc(company)} as of ${esc(vdate)}, for the purpose stated, is <strong>${money(conclusion)}</strong>.</p>
<h3>Contested choices and their effect</h3>
${contested}
<h3>Sensitivity</h3>
${sensTable}

<h2>9. Assumptions and limiting conditions</h2>
<ol>
  <li>Financial information was provided by the owner-spouse and was not audited, reviewed or independently verified.</li>
  <li>No site visit or management interview was conducted unless described in Section 2.</li>
  <li>The calculated value is as of the valuation date; events after that date were not considered.</li>
  <li>The standard of value is the one applied by the courts of ${esc(jur.name)} in marital dissolution, as summarized in Section 1, and may differ from fair market value for tax or transaction purposes.</li>
  <li>This report is for use in the parties' settlement negotiation and mediation. It is not to be used for financing, tax reporting, or any other purpose, and it is not to be filed with or presented to any court unless and until it is issued under signature.</li>
  <li>Market data, premiums and multiples are as identified in Section 3; where a source is marked as missing, the figure is the client's and has not been sourced.</li>
  <li>The analyst has no present or contemplated financial interest in the company and the fee is not contingent on the value reported.</li>
  <li><strong>Until issued under signature, this document is an educational illustration only.</strong> It is not legal, tax, accounting or valuation advice; it does not create an attorney&ndash;client or any other professional relationship with Donovan Legal PLLC; state law is summarized, not stated, and may have changed; and no one may rely on it, file it, or present it to a court, mediator or opposing party.</li>
</ol>

<h2>10. Representation of the analyst</h2>
<p>I performed a calculation engagement in accordance with the Statement on Standards for Valuation Services of the American Institute of Certified Public Accountants. The analyses, opinions and calculated value expressed are my own, developed from the procedures agreed with the client and the information described above.</p>
<div class="rep-sig">
  <div>______________________________<br/>Reviewer, CPA<br/>Donovan Legal PLLC · Delray Beach, Florida<br/>Date: ______________</div>
  <div class="rep-draft">NOT SIGNED — DRAFT PREPARED BY CALCULATOR</div>
</div>`;
  }

  function openReport() {
    if (!lastModel) { alert('Enter the business first.'); return; }
    const w = window.open('', '_blank');
    if (!w) { alert('Your browser blocked the report window. Allow pop-ups for this site and try again.'); return; }
    const css = `<style>
      @page { margin: 0.9in 0.85in; }
      body { font-family: Georgia, 'Times New Roman', serif; color: #1F2A24; font-size: 11pt; line-height: 1.5; max-width: 7.2in; margin: 0 auto; padding: 0.4in 0.2in 1in; }
      h1 { font-family: 'Open Sans', Arial, sans-serif; font-size: 24pt; margin: 0.2in 0 0.1in; color: #0a5a37; } h2 { font-family: 'Open Sans', Arial, sans-serif; font-size: 13pt; color: #0a5a37; margin: 1.4rem 0 0.4rem; border-bottom: 1px solid #C9A961; padding-bottom: 0.15rem; page-break-after: avoid; } h3 { font-family: 'Open Sans', Arial, sans-serif; font-size: 11pt; margin: 1rem 0 0.3rem; }
      .rep-cover { text-align: center; padding: 1.2in 0 0.6in; page-break-after: always; } .rep-kicker { font-family: 'Open Sans', Arial, sans-serif; font-size: 9pt; letter-spacing: 2px; color: #B01F24; font-weight: 700; } .rep-sub { font-size: 12pt; margin: 0.3rem 0; } .rep-draft { color: #B01F24; font-size: 9.5pt; margin-top: 1rem; }
      .rep-table { width: 100%; border-collapse: collapse; font-size: 9.5pt; margin: 0.6rem 0; page-break-inside: avoid; } .rep-table th, .rep-table td { border-bottom: 1px solid #ddd; padding: 0.3rem 0.4rem; text-align: left; vertical-align: top; } .rep-table .num { text-align: right; white-space: nowrap; } .rep-total td { font-weight: 700; border-top: 2px solid #1F2A24; }
      .rep-note { font-size: 9.5pt; color: #444; } .rep-notice { margin: 1.2rem auto 0; max-width: 6.4in; text-align: left; font-family: 'Open Sans', Arial, sans-serif; font-size: 9pt; line-height: 1.5; padding: 0.6rem 0.8rem; background: #F4F1E8; border-left: 4px solid #C9A961; } .rep-missing { color: #B01F24; font-style: italic; } .rep-value { font-size: 12.5pt; }
      .rep-sig { display: flex; justify-content: space-between; align-items: flex-end; margin-top: 2rem; font-size: 10pt; } .rep-sig .rep-draft { font-weight: 700; }
      body::before { content: 'DRAFT \\2014 NOT ISSUED \\2014 CALCULATION ENGAGEMENT'; position: fixed; top: 42%; left: 0; right: 0; text-align: center; transform: rotate(-28deg); font-family: 'Open Sans', Arial, sans-serif; font-size: 22pt; font-weight: 800; letter-spacing: 2px; color: rgba(176, 31, 36, 0.13); white-space: nowrap; z-index: 9999; pointer-events: none; }
      body::after { content: 'Donovan Legal PLLC \\2014 EDUCATIONAL ILLUSTRATION, NOT LEGAL ADVICE. Draft prepared with the firm\\2019s valuation calculator; not reviewed, sourced or signed; not a conclusion of value; no attorney-client relationship; not for filing or reliance. donovan.law/book'; position: fixed; bottom: 0.25in; left: 0; right: 0; text-align: center; font-family: 'Open Sans', Arial, sans-serif; font-size: 8pt; color: #B01F24; }
      .dl-print-bar { position: sticky; top: 0; background: #0a5a37; color: #F5F5F0; padding: 0.6rem 1rem; font-family: 'Open Sans', Arial, sans-serif; font-size: 10.5pt; display: flex; flex-wrap: wrap; align-items: center; gap: 0.75rem; margin: -0.4in -0.2in 0.4in; } .dl-print-bar button { background: #C9A961; color: #084B2E; border: 0; border-radius: 4px; padding: 0.45rem 0.9rem; font-weight: 800; cursor: pointer; } @media print { .dl-print-bar { display: none !important; } }
    </style>`;
    const bar = '<div class="dl-print-bar"><button id="dl_print_now" type="button">Print / Save as PDF</button><span>Choose <strong>&ldquo;Save as PDF&rdquo;</strong> as the destination. Red bracketed items are for the firm&rsquo;s reviewer to complete before the report can be issued.</span></div>';
    w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>Calculation of Value — DRAFT</title>' + css + '</head><body>' + bar + buildReport(lastModel) + '</body></html>');
    w.document.close();
    const go = function () { try { w.focus(); w.print(); } catch (e) { /* closed */ } };
    const btn = w.document.getElementById('dl_print_now'); if (btn) btn.addEventListener('click', go);
  }

  function loadSample() { Object.keys(SAMPLE).forEach((k) => { const el = $(k); if (el) el.value = SAMPLE[k]; }); computeAll(); const r = $('bv_results'); if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function clearAll() { document.querySelectorAll('#bv_form input, #bv_form textarea').forEach((el) => { el.value = ''; }); const st = $('bv_state'); if (st) st.value = 'FL'; const en = $('bv_entity'); if (en) en.value = 's_corp'; const b = $('bv_base'); if (b) b.value = 'pretax'; const w = $('bv_weighting'); if (w) w.value = 'recent'; const im = $('bv_income_method'); if (im) im.value = 'cap'; const cf = $('bv_cf_basis'); if (cf) cf.value = 'auto'; document.querySelectorAll('#bv_form textarea').forEach((el) => { el.value = ''; }); computeAll(); }

  function init() {
    const form = $('bv_form'); if (!form) return;
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); else console.warn('[bv] missing #' + id); };
    form.querySelectorAll('input, textarea').forEach((el) => {
      el.addEventListener('input', computeAll);
      el.addEventListener('change', () => { if (el.dataset.money !== undefined) { const n = Number(String(el.value).replace(/[^0-9.\-]/g, '')); el.value = Number.isFinite(n) && el.value !== '' ? n.toLocaleString('en-US') : ''; } computeAll(); });
    });
    form.querySelectorAll('select').forEach((el) => el.addEventListener('change', computeAll));
    document.querySelectorAll('[data-bv-sample]').forEach((b) => b.addEventListener('click', loadSample));
    on('bv_reset', 'click', clearAll);
    on('bv_print', 'click', () => window.print());
    on('bv_report', 'click', openReport);
    computeAll();
  }
  const safeInit = () => { try { init(); } catch (e) { console.error('[bv] init failed', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit); else safeInit();

  if (typeof module !== 'undefined' && module.exports) module.exports = { J, fundamentals, inputs, mumSuggest };
})();
