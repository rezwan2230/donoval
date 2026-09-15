/* Divorce Alimony / Spousal Support Estimator + Alimony-vs-Property Trade-Off
 * Donovan Legal PLLC divorce suite, tool 3 (2026-09-05). Educational tool.
 * Five states, five regimes; then the federal after-tax picture (post-TCJA:
 * alimony is neither deductible nor includible) and the state decoupling
 * (MA, NY, CA still deduct/include), and the present value of the stream against
 * an offsetting lump of property. Nothing entered leaves the browser.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
  const pct = (n) => (Math.round((n || 0) * 1000) / 10).toFixed(1) + '%';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const numv = (id) => { const el = $(id); if (!el) return 0; const n = Number(String(el.value || '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const pctv = (id) => numv(id) / 100;
  const yrs = (n) => (Math.round(n * 10) / 10).toFixed(n % 1 ? 1 : 0) + (n === 1 ? ' year' : ' years');

  /* ── State regimes ─────────────────────────────────────────────────────── */
  const J = {
    FL: { name: 'Florida', cite: 'Fla. Stat. § 61.08 (as amended by SB 1416, effective July 1, 2023)',
      summary: 'Permanent alimony is abolished for petitions filed after July 1, 2023. Four forms remain: temporary, bridge-the-gap (up to two years), rehabilitative (up to five years, on a written plan) and durational. Durational alimony is not available for a marriage under three years; its length may not exceed 50% of a short-term marriage (under ten years), 60% of a moderate-term marriage (ten to twenty) or 75% of a long-term marriage (twenty or more), extended beyond those limits only on a finding of exceptional circumstances under § 61.08(8)(c); and the amount may not exceed the lesser of the recipient\u2019s reasonable need or 35% of the difference between the parties\u2019 net incomes. Net income is computed as under the child-support statute (§ 61.30(2)\u2013(3): gross income from all sources, including imputed income for voluntary unemployment, less the enumerated deductions). The court must first find that one party has a need and the other the ability to pay; it then weighs the § 61.08(3) factors, and adultery, a supportive relationship (§ 61.14(1)(b)) and the payor\u2019s reasonable retirement are all in play. The length of the marriage runs from the date of marriage to the date of filing.',
      stateTax: 'None. Florida has no personal income tax; federal treatment is the whole picture.', decoupled: false,
      compute(i) {
        const diff = Math.max(0, i.payorNet - i.payeeNet);
        const capAmt = 0.35 * diff / 12;
        const need = i.need > 0 ? i.need : Infinity;
        const monthly = Math.max(0, Math.min(capAmt, need));
        let maxYears, band;
        if (i.years < 3) { maxYears = 0; band = 'under three years: no durational alimony (bridge-the-gap or rehabilitative only)'; }
        else if (i.years < 10) { maxYears = i.years * 0.5; band = 'short-term marriage: up to 50% of its length'; }
        else if (i.years < 20) { maxYears = i.years * 0.6; band = 'moderate-term marriage: up to 60% of its length'; }
        else { maxYears = i.years * 0.75; band = 'long-term marriage: up to 75% of its length'; }
        return { monthly, years: maxYears, basis: `Lesser of the recipient\u2019s reasonable need (${i.need > 0 ? money(i.need) + '/mo' : 'not entered \u2014 treated as unlimited'}) and 35% of the net-income difference (${money(diff)}/yr \u2192 ${money(capAmt)}/mo). Duration: ${band}. These are ceilings, not entitlements; the court must first find need and ability to pay.`, isCap: true };
      } },
    MA: { name: 'Massachusetts', cite: 'M.G.L. c. 208, §§ 48\u201355 (Alimony Reform Act of 2011, effective March 1, 2012)',
      summary: 'General term alimony should generally not exceed the recipient\u2019s need or 30% to 35% of the difference between the parties\u2019 gross incomes at the time of the order (§ 53(b)). Duration runs off the length of the marriage (§ 49(b)): up to 50% of the number of months for a marriage of five years or less, 60% for five to ten, 70% for ten to fifteen, 80% for fifteen to twenty; indefinite for a marriage over twenty years. General term alimony ends on the payor reaching full Social Security retirement age (§ 49(f)), on the recipient\u2019s remarriage, and may be suspended, reduced or terminated on cohabitation (§ 49(d)). Rehabilitative, reimbursement and transitional alimony are separate forms with their own limits. Income for alimony excludes capital gains, dividends and interest derived from assets divided in the case (§ 53(c)(1)); and since Cavanagh v. Cavanagh, 490 Mass. 398 (2022), where both alimony and child support are in play the court calculates alimony first, then child support, then compares the alternative sequence and chooses the more equitable result, rather than simply excluding income used for child support under § 53(c)(2). Deviation from the presumptive amount or duration is available on the § 53(e) factors. The 30\u201335% band was written when alimony was deductible; practitioners now argue for the lower end, or for tax-adjusted percentages, because the payor pays from after-tax dollars federally.',
      stateTax: 'Massachusetts did not adopt the TCJA change: for Massachusetts income tax, alimony remains deductible by the payor and includible by the recipient (TIR 18-14). The federal rule is the opposite.', decoupled: true,
      compute(i) {
        const diff = Math.max(0, i.payorGross - i.payeeGross);
        const lo = 0.30 * diff / 12, hi = 0.35 * diff / 12;
        const need = i.need > 0 ? i.need : Infinity;
        const monthly = Math.max(0, Math.min(hi, need)); const monthlyLo = Math.max(0, Math.min(lo, need));
        let maxYears, band;
        if (i.years <= 5) { maxYears = i.years * 0.5; band = 'five years or less: up to 50% of the marriage'; }
        else if (i.years <= 10) { maxYears = i.years * 0.6; band = 'over five to ten years: up to 60%'; }
        else if (i.years <= 15) { maxYears = i.years * 0.7; band = 'over ten to fifteen years: up to 70%'; }
        else if (i.years <= 20) { maxYears = i.years * 0.8; band = 'over fifteen to twenty years: up to 80%'; }
        else { maxYears = Math.max(0, i.payorRetireYears); band = 'over twenty years: indefinite, ending at the payor\u2019s full retirement age'; }
        return { monthly, monthlyLo, years: maxYears, basis: `30\u201335% of the gross-income difference (${money(diff)}/yr \u2192 ${money(lo)}\u2013${money(hi)}/mo), capped at the recipient\u2019s need (${i.need > 0 ? money(i.need) + '/mo' : 'not entered'}). Duration: ${band}${i.years > 20 ? ` \u2014 modeled to the payor\u2019s retirement in ${yrs(i.payorRetireYears)}` : ''}. Presumptive, not mandatory; the court may deviate on the § 53(e) factors.`, isCap: true };
      } },
    NY: { name: 'New York', cite: 'Domestic Relations Law § 236(B)(6) (post-divorce maintenance guidelines, effective January 2016)',
      summary: 'Post-divorce maintenance is presumptively set by formula on income up to a cap that is adjusted every two years ($241,000 from March 1, 2026, up from $228,000 \u2014 confirm the current figure on the field below). Where the payor is also paying child support: the lesser of (a) 20% of the payor\u2019s income minus 25% of the payee\u2019s income and (b) 40% of combined income minus the payee\u2019s income. Where child support is not being paid by the payor: the lesser of (a) 30% of the payor\u2019s income minus 20% of the payee\u2019s income and (b) 40% of combined income minus the payee\u2019s income. \u201cIncome\u201d is income as defined for child support (Family Court Act § 413 / DRL § 240(1-b)(b)(5): gross income as reported, less FICA and New York City and Yonkers taxes, with the court\u2019s power to impute). Income above the cap is at the court\u2019s discretion on the § 236(B)(6)(e) factors, and the court may deviate from the guideline amount where it is unjust or inappropriate. Duration follows an advisory schedule: 15\u201330% of the marriage for a marriage up to fifteen years, 30\u201340% for fifteen to twenty, 35\u201350% over twenty; the court may award non-durational maintenance. Temporary maintenance during the case follows a parallel formula (§ 236(B)(5-a)).',
      stateTax: 'New York decoupled from the TCJA: maintenance remains deductible by the payor and includible by the recipient for New York State (and City) income tax (Tax Law § 612(w)). The federal rule is the opposite.', decoupled: true,
      compute(i) {
        const cap = i.nyCap || 241000;
        const payor = Math.min(i.payorGross, cap), payee = i.payeeGross;
        const a = i.nyChildSupport ? 0.20 * payor - 0.25 * payee : 0.30 * payor - 0.20 * payee;
        const b = 0.40 * (payor + payee) - payee;
        const annual = Math.max(0, Math.min(a, b));
        const monthly = annual / 12;
        let lo, hi, band;
        if (i.years <= 15) { lo = 0.15; hi = 0.30; band = 'up to fifteen years: 15\u201330% of the marriage'; }
        else if (i.years <= 20) { lo = 0.30; hi = 0.40; band = 'fifteen to twenty years: 30\u201340%'; }
        else { lo = 0.35; hi = 0.50; band = 'over twenty years: 35\u201350%'; }
        return { monthly, years: i.years * (lo + hi) / 2, yearsLo: i.years * lo, yearsHi: i.years * hi, basis: `Guideline on income up to the ${money(cap)} cap${i.payorGross > cap ? ` (payor\u2019s income above the cap, ${money(i.payorGross - cap)}, is discretionary)` : ''}: ${i.nyChildSupport ? '20% of payor \u2212 25% of payee' : '30% of payor \u2212 20% of payee'} = ${money(a)}/yr; 40% of combined \u2212 payee = ${money(b)}/yr; the lesser controls. Duration: ${band}; the midpoint is modeled.`, isCap: false };
      } },
    CA: { name: 'California', cite: 'Cal. Fam. Code §§ 4320, 4330, 4336; local temporary-support guidelines',
      summary: 'California has no statewide formula for long-term spousal support; the court weighs the § 4320 factors (the marital standard of living, each party\u2019s earning capacity, contributions to the other\u2019s career, the payor\u2019s ability to pay, the parties\u2019 needs, assets and obligations, the duration of the marriage, age and health, domestic violence, tax consequences, the goal of self-support within a reasonable period, and any other just and equitable factor). Temporary support during the case follows local guideline formulas run on net disposable income (Santa Clara and Alameda: 40% of the higher earner\u2019s net less 50% of the lower earner\u2019s net, adjusted for child support; other counties use variants) and courts may not use those formulas for the permanent order (In re Marriage of Schulze, 60 Cal. App. 4th 519 (1997)). For a marriage under ten years the working presumption is support for half the length of the marriage; for a marriage of ten years or more the court retains jurisdiction indefinitely (§ 4336) and support is set on the factors without a formula.',
      stateTax: 'California did not conform to the TCJA: spousal support remains deductible by the payor and includible by the recipient for California income tax. The federal rule is the opposite.', decoupled: true,
      compute(i) {
        const temp = Math.max(0, 0.40 * i.payorNet - 0.50 * i.payeeNet) / 12;
        const years = i.years < 10 ? i.years / 2 : Math.max(0, i.payorRetireYears);
        return { monthly: temp, years, basis: `Temporary-support guideline (Santa Clara / Alameda): 40% of the higher earner\u2019s net (${money(i.payorNet)}) less 50% of the lower earner\u2019s net (${money(i.payeeNet)}) = ${money(temp)}/mo, before any child-support adjustment. Long-term support has NO formula; the temporary figure is shown only as the number the case starts from. Duration: ${i.years < 10 ? 'under ten years \u2014 half the marriage is the working presumption' : 'ten years or more \u2014 indefinite jurisdiction; modeled to the payor\u2019s retirement in ' + yrs(i.payorRetireYears)}.`, isCap: false };
      } },
    TX: { name: 'Texas', cite: 'Tex. Fam. Code ch. 8 (spousal maintenance)',
      summary: 'Court-ordered maintenance is the exception. Eligibility requires that the spouse seeking it lack sufficient property to provide for minimum reasonable needs and either (a) a marriage of ten years or more with a diligent but unsuccessful effort to earn sufficient income or develop skills, (b) an incapacitating disability, (c) custody of a child requiring substantial care, or (d) family violence within two years of filing (§ 8.051). The amount may not exceed the lesser of $5,000 per month or 20% of the payor\u2019s average monthly gross income (§ 8.055). Duration is capped at five years for a marriage of ten to twenty years (or the family-violence route), seven years for twenty to thirty, ten years for thirty or more, and the court must limit it to the shortest reasonable period unless disability or a child\u2019s needs require otherwise (§ 8.054). The recipient must also overcome a rebuttable presumption that maintenance is not warranted unless diligent efforts to earn or develop skills have been made (§ 8.053), and maintenance ends on remarriage or cohabitation with a romantic partner (§ 8.056). Contractual alimony agreed by the parties is not subject to these limits and is enforced as a contract.',
      stateTax: 'None. Texas has no personal income tax.', decoupled: false,
      compute(i) {
        const capAmt = Math.min(5000, 0.20 * (i.payorGross / 12)); // § 8.055: lesser of $5,000 or 20% of the obligor's AVERAGE monthly gross income
        const eligible = i.years >= 10 || i.txException;
        let maxYears = 0, band = 'not eligible for court-ordered maintenance on the facts entered (marriage under ten years and no exception marked); contractual alimony remains available';
        if (eligible) { if (i.years >= 30) { maxYears = 10; band = 'thirty years or more: up to ten years'; } else if (i.years >= 20) { maxYears = 7; band = 'twenty to thirty years: up to seven years'; } else { maxYears = 5; band = 'ten to twenty years (or the family-violence route): up to five years'; } }
        return { monthly: eligible ? capAmt : 0, years: maxYears, basis: `Cap: lesser of $5,000/mo or 20% of the payor\u2019s gross (${money(0.20 * i.payorGross / 12)}/mo) = ${money(capAmt)}/mo. Duration: ${band}. The court must also find the recipient lacks sufficient property for minimum reasonable needs.`, isCap: true, ineligible: !eligible };
      } },
  };

  /* ── Federal 2026 single brackets (post-divorce) for the after-tax picture ── */
  const ORD = [[12400, .10], [50400, .12], [105700, .22], [201775, .24], [256225, .32], [640600, .35], [Infinity, .37]];
  const marg = (inc) => { for (const [cap, r] of ORD) if (inc <= cap) return r; return .37; };

  const SAMPLE = { al_state: 'FL', al_years: '14', al_payor_gross: '420,000', al_payee_gross: '90,000', al_payor_net: '300,000', al_payee_net: '72,000', al_need: '6,500', al_payor_retire: '12', al_ny_cap: '241,000', al_payor_state_rate: '0', al_payee_state_rate: '0', al_discount: '5', al_property_ltcg: '15' };

  function inputs() {
    let payorGross = numv('al_payor_gross'), payeeGross = numv('al_payee_gross');
    let payorNetIn = numv('al_payor_net'), payeeNetIn = numv('al_payee_net');
    const swapped = payeeGross > payorGross;   // the labels say "higher earner" -- the numbers decide
    if (swapped) { [payorGross, payeeGross] = [payeeGross, payorGross]; [payorNetIn, payeeNetIn] = [payeeNetIn, payorNetIn]; }
    const payorNetEst = payorNetIn === 0 && payorGross > 0, payeeNetEst = payeeNetIn === 0 && payeeGross > 0;
    return {
      state: ($('al_state') || {}).value || 'FL', years: Math.max(0, numv('al_years')), swapped,
      payorGross, payeeGross,
      // Net income, where the state uses it, is entered; if blank it is ESTIMATED and the estimate is shown on screen.
      payorNet: payorNetIn || payorGross * 0.72, payeeNet: payeeNetIn || payeeGross * 0.80, payorNetEst, payeeNetEst,
      need: numv('al_need'), payorRetireYears: numv('al_payor_retire') || 15,
      nyCap: numv('al_ny_cap'), nyChildSupport: !!($('al_ny_cs') && $('al_ny_cs').checked), txException: !!($('al_tx_exception') && $('al_tx_exception').checked),
      payorStateRate: pctv('al_payor_state_rate'), payeeStateRate: pctv('al_payee_state_rate'),
      discount: pctv('al_discount') || 0.05, propertyLtcg: pctv('al_property_ltcg'),
      overrideMonthly: Math.max(0, numv('al_override_monthly')), overrideYears: Math.max(0, numv('al_override_years')),
    };
  }

  function pv(monthly, years, r) { const n = Math.round(years * 12); const rm = r / 12; if (!n) return 0; if (!rm) return monthly * n; return monthly * (1 - Math.pow(1 + rm, -n)) / rm; }

  function compute() {
    const i = inputs(); const jur = J[i.state] || J.FL;
    if (!(i.payorGross || i.payeeGross)) { renderEmpty(jur); return; }
    const g = jur.compute(i);
    const monthly = i.overrideMonthly > 0 ? i.overrideMonthly : g.monthly;
    const years = i.overrideYears > 0 ? i.overrideYears : g.years;
    // What the tool assumed, stated where a reviewer will look for it
    const assumptions = [];
    if (i.swapped) assumptions.push('The incomes were entered with the lower earner in the payor field; the tool treats the higher earner as the payor. Swap them back if that is wrong.');
    if (i.years === 0) assumptions.push('No length of marriage entered; every duration rule depends on it and the durations shown are zero.');
    if ((jur.name === 'Florida' || jur.name === 'California') && (i.payorNetEst || i.payeeNetEst)) assumptions.push(`Net income was not entered for ${i.payorNetEst && i.payeeNetEst ? 'either party' : i.payorNetEst ? 'the payor' : 'the recipient'} and was ESTIMATED at ${i.payorNetEst ? '72% of the payor\u2019s gross' : ''}${i.payorNetEst && i.payeeNetEst ? ' and ' : ''}${i.payeeNetEst ? '80% of the recipient\u2019s gross' : ''}. ${jur.name === 'Florida' ? 'Florida net income is defined by § 61.30(3) (gross less the allowable deductions); enter the actual figures.' : 'The California guideline runs on net disposable income; enter the actual figures.'}`);
    if (jur.isCap !== false && i.need === 0 && (jur.name === 'Florida' || jur.name === 'Massachusetts')) assumptions.push(`No monthly need entered; in ${jur.name} the award may not exceed the recipient\u2019s reasonable need, so the ceiling shown is the percentage limit alone and the actual ceiling may be lower.`);
    if (jur.name === 'New York' && i.payorGross > (i.nyCap || 241000)) assumptions.push(`The payor\u2019s income exceeds the ${money(i.nyCap || 241000)} cap; the formula was applied to the cap and the excess ${money(i.payorGross - (i.nyCap || 241000))} is discretionary under the § 236(B)(6)(e) factors. Confirm the cap in force at the date of the order.`);
    if (jur.name === 'New York' && !i.nyCap) assumptions.push('The New York income cap field is blank; $241,000 (the March 1, 2026 figure) was used.');
    if (jur.name === 'Massachusetts' && i.years > 20 && !numv('al_payor_retire')) assumptions.push('Marriage over twenty years and no retirement horizon entered; a 15-year horizon was assumed for the present value. General term alimony ends at the payor\u2019s full Social Security retirement age (§ 49(f)).');
    if (jur.name === 'California' && i.years >= 10 && !numv('al_payor_retire')) assumptions.push('Marriage of ten years or more and no horizon entered; a 15-year horizon was assumed for the present value. California retains jurisdiction indefinitely (§ 4336) and sets support on the § 4320 factors.');
    if (jur.decoupled && i.payorStateRate === 0 && i.payeeStateRate === 0) assumptions.push(`${jur.name} still deducts and includes alimony for state tax; no state rates were entered, so the state effect shown is zero.`);
    if (i.overrideMonthly > 0 && g.isCap && i.overrideMonthly > g.monthly) assumptions.push(`The modeled amount ${money(i.overrideMonthly)}/mo exceeds the ${jur.name} ceiling of ${money(g.monthly)}/mo; a court could not order it, though the parties may agree to it.`);
    if (i.overrideYears > 0 && g.isCap && g.years > 0 && i.overrideYears > g.years) assumptions.push(`The modeled duration ${yrs(i.overrideYears)} exceeds the ${jur.name} limit of ${yrs(g.years)} on these facts.`);
    if (i.discount === 0.05 && !numv('al_discount')) assumptions.push('No discount rate entered; 5% was assumed for present values.');
    const annual = monthly * 12;
    // After-tax picture. Federal: post-2018 instruments -- no deduction, no inclusion.
    // State: MA / NY / CA still deduct and include at the state level.
    const payorFedRate = marg(i.payorGross), payeeFedRate = marg(i.payeeGross);
    const payorStateSaving = jur.decoupled ? annual * i.payorStateRate : 0;   // state deduction value to payor
    const payeeStateTax = jur.decoupled ? annual * i.payeeStateRate : 0;      // state inclusion cost to payee
    const payorPreTaxCost = annual / (1 - payorFedRate - (jur.decoupled ? 0 : i.payorStateRate)); // pre-tax income the payor must earn to fund the after-tax payment (state deduction handled below)
    const payorNetCost = annual - payorStateSaving;                            // after-tax cost per year
    const payeeNetReceipt = annual - payeeStateTax;                            // after-tax value per year
    const pvPayor = pv(payorNetCost / 12, years, i.discount), pvPayee = pv(payeeNetReceipt / 12, years, i.discount), pvNominal = pv(monthly, years, i.discount), nominal = annual * years;
    // Property equivalent: the after-tax property the recipient would need instead; and what pre-tax property that is at the recipient's gain rate
    const propertyAfterTax = pvPayee;
    const propertyPreTax = i.propertyLtcg > 0 ? propertyAfterTax / (1 - i.propertyLtcg) : propertyAfterTax;
    render({ i, jur, g, monthly, years, annual, nominal, payorFedRate, payeeFedRate, payorStateSaving, payeeStateTax, payorNetCost, payeeNetReceipt, payorPreTaxCost, pvPayor, pvPayee, pvNominal, propertyAfterTax, propertyPreTax, assumptions });
  }

  function renderEmpty(jur) {
    const res = $('al_results'); if (res) res.innerHTML = '<p class="al-empty">Enter the length of the marriage and both incomes to see the estimate. Or <button type="button" class="al-link" data-load-sample>load a sample</button>.</p>';
    const b = res && res.querySelector('[data-load-sample]'); if (b) b.addEventListener('click', loadSample);
    renderJurisdiction(jur);
  }

  function render(m) {
    const { i, jur, g, monthly, years, annual, nominal, payorFedRate, payeeFedRate, payorStateSaving, payeeStateTax, payorNetCost, payeeNetReceipt, pvPayor, pvPayee, pvNominal, propertyAfterTax, propertyPreTax, assumptions } = m;
    const res = $('al_results'); if (!res) return;
    const overridden = i.overrideMonthly > 0 || i.overrideYears > 0;
    res.innerHTML = `
      ${assumptions.length ? `<div class="al-assume"><strong>What this run assumed</strong><ul>${assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      <div class="al-summary">
        <div class="al-card"><div class="al-k">${g.isCap ? 'Statutory ceiling' : 'Guideline figure'} in ${jur.name}</div><div class="al-v">${money(g.monthly)}<span class="al-unit">/mo</span></div><div class="al-s">${g.years > 0 ? 'for up to ' + yrs(g.years) : 'no duration on these facts'}${g.yearsLo != null ? ` (advisory ${yrs(g.yearsLo)}\u2013${yrs(g.yearsHi)})` : ''}${g.monthlyLo != null ? `; 30% end ${money(g.monthlyLo)}/mo` : ''}</div></div>
        <div class="al-card"><div class="al-k">Modeled${overridden ? ' (your override)' : ''}</div><div class="al-v">${money(monthly)}<span class="al-unit">/mo</span></div><div class="al-s">${money(annual)}/yr for ${yrs(years)} = ${money(nominal)} nominal</div></div>
        <div class="al-card"><div class="al-k">What it costs the payor</div><div class="al-v">${money(payorNetCost)}<span class="al-unit">/yr</span></div><div class="al-s">paid from after-tax dollars (no federal deduction since 2019)${jur.decoupled ? `; ${jur.name} deduction saves ${money(payorStateSaving)}/yr` : ''}. To fund it the payor earns about ${money(annual / (1 - payorFedRate))} pre-tax at a ${pct(payorFedRate)} federal bracket.</div></div>
        <div class="al-card"><div class="al-k">What the recipient keeps</div><div class="al-v">${money(payeeNetReceipt)}<span class="al-unit">/yr</span></div><div class="al-s">tax-free federally${jur.decoupled ? `; ${jur.name} taxes it \u2014 ${money(payeeStateTax)}/yr at ${pct(i.payeeStateRate)}` : ''}</div></div>
      </div>

      <h4>The trade-off: the stream, or property instead</h4>
      <div class="al-summary">
        <div class="al-card al-card-hi"><div class="al-k">Present value to the recipient</div><div class="al-v">${money(pvPayee)}</div><div class="al-s">${yrs(years)} of after-tax receipts discounted at ${pct(i.discount)}; ${money(pvNominal)} before state tax</div></div>
        <div class="al-card al-card-hi"><div class="al-k">Present value of the payor\u2019s cost</div><div class="al-v">${money(pvPayor)}</div><div class="al-s">after the ${jur.decoupled ? jur.name + ' deduction' : 'absence of any deduction'}; the gap between the two cards is the tax system\u2019s take</div></div>
        <div class="al-card al-card-hi"><div class="al-k">Property that replaces the stream</div><div class="al-v">${money(propertyPreTax)}</div><div class="al-s">${money(propertyAfterTax)} after tax in the recipient\u2019s hands; grossed up at a ${pct(i.propertyLtcg)} embedded-tax rate on the property taken. Cash or Roth = ${money(propertyAfterTax)}; appreciated stock or a pre-tax 401(k) = more.</div></div>
      </div>
      <p class="al-note">A recipient who takes property instead of the stream gives up modifiability and the risk of the payor\u2019s death, job loss or remarriage-termination, and takes on investment risk. A payor who pays property instead gives up the tax deduction only where the state still allows one, and buys finality. Both sides should price those risks; the discount rate above is the place to do it.</p>

      <h4>How the figure was built</h4>
      <p>${esc(g.basis)}</p>
      ${g.ineligible ? `<p class="al-flag"><strong>Texas eligibility.</strong> On the facts entered the recipient would not qualify for court-ordered maintenance; the parties can still agree to contractual alimony in any amount and for any period.</p>` : ''}

      <h4>Tax treatment of the payments</h4>
      <p><strong>Federal:</strong> for divorce or separation instruments executed after December 31, 2018 (or earlier instruments modified to adopt the new rule), alimony is neither deductible by the payor nor includible by the recipient (TCJA § 11051, repealing §§ 71 and 215). <strong>${jur.name}:</strong> ${esc(jur.stateTax)}</p>

      <p class="al-meth"><strong>Method.</strong> Guideline and ceiling amounts follow the state statute as summarized in the panel below; where a state has no formula (California long-term support) the tool shows the temporary-support guideline as the starting number and says so. Federal brackets are the 2026 single-filer schedule; the payor\u2019s pre-tax cost divides the payment by one minus the payor\u2019s marginal federal rate. State deduction and inclusion are applied only in the states that decoupled from the TCJA, at the rates you enter. Present values use monthly payments discounted at the rate you enter, without escalation, without probability of early termination, and without the child-support interaction (which in Massachusetts and New York can change the figure materially). Imputed income, the tax-affecting of the percentages in the decoupled states, retirement-account and business income characterization, and the interaction with property division (income from divided assets is excluded in Massachusetts; double-counting is a live issue everywhere) are not modeled. Every number here is a ceiling, a presumption or a starting point; none is an entitlement, and the court decides on the statutory factors.</p>`;
    renderJurisdiction(jur);
  }

  function renderJurisdiction(jur) {
    const jn = $('al_jur_name'); if (jn) jn.textContent = jur.name;
    const jps = $('al_print_state'); if (jps) jps.textContent = jur.name;
    const jp = $('al_jur_panel'); if (jp) jp.innerHTML = `<div class="al-jur-grid"><div><strong>Regime</strong><p>${esc(jur.summary)}</p></div><div><strong>State tax treatment</strong><p>${esc(jur.stateTax)}</p><p style="margin-top:.5rem;"><strong>Authority:</strong> ${esc(jur.cite)}</p></div></div>`;
    document.querySelectorAll('.al-ny').forEach((el) => { el.style.display = jur.name === 'New York' ? '' : 'none'; });
    document.querySelectorAll('.al-tx').forEach((el) => { el.style.display = jur.name === 'Texas' ? '' : 'none'; });
    document.querySelectorAll('.al-net').forEach((el) => { el.style.display = (jur.name === 'Florida' || jur.name === 'California') ? '' : 'none'; });
    document.querySelectorAll('.al-decoupled').forEach((el) => { el.style.display = jur.decoupled ? '' : 'none'; });
    const hint = $('al_state_hint'); if (hint) hint.textContent = jur.decoupled ? `${jur.name} still deducts and includes alimony at the state level; enter each party\u2019s state marginal rate.` : `${jur.name} has no state income tax on these payments.`;
  }

  function loadSample() { Object.keys(SAMPLE).forEach((k) => { const el = $(k); if (el) el.value = SAMPLE[k]; }); const cs = $('al_ny_cs'); if (cs) cs.checked = true; compute(); const r = $('al_results'); if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function clearAll() { document.querySelectorAll('#al_form input[type="text"]').forEach((el) => { el.value = ''; }); document.querySelectorAll('#al_form input[type="checkbox"]').forEach((el) => { el.checked = false; }); const st = $('al_state'); if (st) st.value = 'FL'; const cap = $('al_ny_cap'); if (cap) cap.value = '241,000'; compute(); }

  function init() {
    const form = $('al_form'); if (!form) return;
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); else console.warn('[al] missing #' + id); };
    form.querySelectorAll('input, select').forEach((el) => {
      el.addEventListener('input', compute);
      el.addEventListener('change', () => { if (el.dataset.money !== undefined) { const n = Number(String(el.value).replace(/[^0-9.\-]/g, '')); el.value = Number.isFinite(n) && el.value !== '' ? n.toLocaleString('en-US') : ''; } compute(); });
    });
    document.querySelectorAll('[data-al-sample]').forEach((b) => b.addEventListener('click', loadSample));
    on('al_reset', 'click', clearAll);
    on('al_print', 'click', () => window.print());
    compute();
  }
  const safeInit = () => { try { init(); } catch (e) { console.error('[al] init failed', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit); else safeInit();
  if (typeof module !== 'undefined' && module.exports) module.exports = { J, pv, marg };
})();
