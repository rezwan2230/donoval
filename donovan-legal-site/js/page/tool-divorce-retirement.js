/* Divorce Retirement Division — QDRO, § 408(d)(6), Roth, Pensions (Donovan Legal PLLC divorce suite, 2026-09-05)
 * Every retirement asset in the estate on an after-tax footing, the vehicle each
 * one requires, the penalty exception only one vehicle carries, the pension's
 * present value, and the cash-now trap. Educational tool; nothing entered
 * leaves the browser. Hard-navigated route; no inline scripts.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
  const pct = (n) => (Math.round((n || 0) * 1000) / 10).toFixed(1) + '%';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const numv = (v) => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const fld = (id) => numv(($(id) || {}).value);

  const ORD_SINGLE = [[12400, .10], [50400, .12], [105700, .22], [201775, .24], [256225, .32], [640600, .35], [Infinity, .37]];
  const ORD_HOH = [[17700, .10], [67450, .12], [105700, .22], [201750, .24], [256200, .32], [640600, .35], [Infinity, .37]];
  const marg = (inc, status) => { for (const [cap, r] of (status === 'hoh' ? ORD_HOH : ORD_SINGLE)) if (inc <= cap) return r; return .37; };

  const J = {
    FL: { name: 'Florida', tax: () => 0, taxLabel: 'No state income tax on distributions.', regime: 'Equitable distribution. Vested and nonvested retirement benefits accrued during the marriage are marital assets (§ 61.075(6)(a)1.d.); the marital portion of a pension is commonly measured by a coverture fraction (years of service during the marriage over total service). The Florida Retirement System accepts qualifying court orders for division of FRS benefits under § 61.076 and § 121.091(1)(h); confirm the plan\u2019s procedures.', plans: 'FRS (state and local employees), federal and military plans have their own order requirements; a private-plan QDRO form will not be accepted as drafted.' },
    MA: { name: 'Massachusetts', tax: () => 0.05, taxLabel: '5% on distributions (9% above the surtax threshold); Massachusetts does not tax Social Security or Massachusetts public pensions, and gives no general pension exclusion for private plans.', regime: 'All property under c. 208 § 34 \u2014 the entire account, not only the marital portion, is before the court, with the premarital accrual a factor in the division. Pensions may be divided by present-value offset or by a QDRO sharing future payments; Massachusetts public pensions (MSERS, PERAC systems) accept domestic relations orders under G. L. c. 32.', plans: 'Massachusetts public retirement systems follow c. 32 and their own DRO forms.' },
    NY: { name: 'New York', tax: (inc) => inc > 215400 ? 0.0685 : 0.06, taxLabel: 'Distributions taxed as ordinary income (roughly 6\u201310.9%); New York exempts New York State and local government pensions entirely and excludes the first $20,000 of other pension and IRA income for taxpayers 59\u00bd and older; add 3.876% for New York City residents.', regime: 'Equitable distribution; the marital portion of a pension is the Majauskas fraction (Majauskas v. Majauskas, 61 N.Y.2d 481 (1984)) \u2014 months of service during the marriage before commencement over total months of service at retirement \u2014 and the non-participant\u2019s share is customarily 50% of that portion, paid by a DRO when the participant retires, unless the parties agree to an offset. New York public pensions (NYSLRS, NYSTRS, NYC systems) accept DROs on their own terms.', plans: 'NYSLRS and the New York City systems publish model DROs; the Majauskas formula is the default.' },
    CA: { name: 'California', tax: (inc) => inc > 721318 ? 0.123 : inc > 432787 ? 0.113 : inc > 360659 ? 0.103 : inc > 70606 ? 0.093 : 0.08, taxLabel: 'Distributions taxed as ordinary income (roughly 9.3\u201313.3%); California taxes pensions and IRA distributions in full and does not tax Social Security.', regime: 'Community property: benefits accrued from the date of marriage to the date of separation are community and are divided equally, by a time-rule (coverture) fraction for defined-benefit plans (In re Marriage of Brown, 15 Cal. 3d 838 (1976)); the court must join the plan as a party before it can be ordered to divide (Fam. Code §§ 2060\u20132065). CalPERS and CalSTRS accept DROs on their own forms and offer both a time-rule (Model A) and a separate-account (Model B) division.', plans: 'CalPERS, CalSTRS and the county systems have model orders; joinder of the plan is required.' },
    TX: { name: 'Texas', tax: () => 0, taxLabel: 'No state income tax on distributions.', regime: 'Community property: the portion of a defined-contribution account accrued during the marriage, and of a defined-benefit plan measured by the Berry formula (Berry v. Berry, 647 S.W.2d 945 (Tex. 1983) \u2014 the community interest is valued as of the date of divorce, not at retirement) are community and divided in a just and right manner. Texas has a statutory QDRO form for the Employees Retirement System and Teacher Retirement System (Fam. Code ch. 9, subch. B).', plans: 'ERS and TRS use statutory model orders; Berry limits the community share to benefits accrued at divorce.' },
  };

  const TYPES = {
    k401: { label: '401(k) / 403(b) / 457(b) \u2014 pre-tax', vehicle: 'QDRO', pretax: true, roth: false },
    k401roth: { label: 'Roth 401(k) / Roth 403(b)', vehicle: 'QDRO', pretax: false, roth: true },
    ira: { label: 'Traditional IRA / SEP / SIMPLE', vehicle: '408(d)(6)', pretax: true, roth: false },
    iraroth: { label: 'Roth IRA', vehicle: '408(d)(6)', pretax: false, roth: true },
    pension: { label: 'Defined-benefit pension (monthly benefit at retirement)', vehicle: 'QDRO', pretax: true, roth: false, db: true },
    gov: { label: 'Federal / military / state pension', vehicle: 'DRO / court order (plan-specific)', pretax: true, roth: false, db: true },
    nqdc: { label: 'Non-qualified deferred compensation', vehicle: 'Not divisible by QDRO \u2014 assignment or offset', pretax: true, roth: false },
    taxable: { label: 'Taxable brokerage (for comparison)', vehicle: 'Retitle \u2014 § 1041', pretax: false, roth: false, taxable: true },
  };

  const DEFAULT_ROWS = [
    { type: 'k401', desc: 'His 401(k)', balance: 900000, owner: 'B', maritalPct: 100, toOther: 50 },
    { type: 'iraroth', desc: 'Her Roth IRA', balance: 180000, owner: 'A', maritalPct: 100, toOther: 0 },
    { type: 'pension', desc: 'His county pension', balance: 0, monthly: 4200, yearsToRetire: 12, payoutYears: 22, owner: 'B', maritalPct: 65, toOther: 50 },
    { type: 'taxable', desc: 'Joint brokerage', balance: 400000, basis: 250000, owner: 'A', maritalPct: 100, toOther: 50 },
  ];
  let rows = []; let seq = 0;
  const BLANK = [{ type: 'k401', desc: '', balance: 0, owner: 'B', maritalPct: 100, toOther: 50 }, { type: 'ira', desc: '', balance: 0, owner: 'A', maritalPct: 100, toOther: 0 }];
  function addRow(seed) { rows.push(Object.assign({ id: ++seq, type: 'k401', desc: '', balance: 0, basis: 0, monthly: 0, yearsToRetire: 0, payoutYears: 20, owner: 'B', maritalPct: 100, toOther: 0 }, seed || {})); }

  function renderRows() {
    const host = $('rt_rows'); if (!host) return;
    host.innerHTML = rows.map((r) => { const t = TYPES[r.type];
      return `<div class="rt-row" data-id="${r.id}"><div class="rt-grid">
        <select data-f="type" aria-label="Account type">${Object.keys(TYPES).map((k) => `<option value="${k}"${k === r.type ? ' selected' : ''}>${esc(TYPES[k].label)}</option>`).join('')}</select>
        <input type="text" data-f="desc" value="${esc(r.desc)}" placeholder="Description" aria-label="Description" />
        ${t.db ? `<input type="text" inputmode="decimal" data-f="monthly" value="${r.monthly ? Number(r.monthly).toLocaleString('en-US') : ''}" placeholder="Monthly benefit" aria-label="Monthly benefit at retirement" />` : `<input type="text" inputmode="decimal" data-f="balance" value="${r.balance ? Number(r.balance).toLocaleString('en-US') : ''}" placeholder="Balance" aria-label="Balance" />`}
        ${t.taxable ? `<input type="text" inputmode="decimal" data-f="basis" value="${r.basis ? Number(r.basis).toLocaleString('en-US') : ''}" placeholder="Basis" aria-label="Basis" />` : t.db ? `<input type="text" inputmode="decimal" data-f="yearsToRetire" value="${r.yearsToRetire || ''}" placeholder="Yrs to retire" aria-label="Years to retirement" />` : '<span class="rt-na">n/a</span>'}
        ${t.db ? `<input type="text" inputmode="decimal" data-f="payoutYears" value="${r.payoutYears || ''}" placeholder="Payout yrs" aria-label="Expected years of payments" />` : '<span class="rt-na">n/a</span>'}
        <select data-f="owner" aria-label="Owner"><option value="A"${r.owner === 'A' ? ' selected' : ''}>A owns</option><option value="B"${r.owner === 'B' ? ' selected' : ''}>B owns</option></select>
        <input type="text" inputmode="decimal" data-f="maritalPct" value="${r.maritalPct}" placeholder="Marital %" aria-label="Marital portion percent" />
        <input type="text" inputmode="decimal" data-f="toOther" value="${r.toOther}" placeholder="% to other" aria-label="Percent of the marital portion to the other spouse" />
        <button type="button" class="rt-del" data-del aria-label="Remove">&times;</button>
      </div><div class="rt-note">${esc(t.vehicle === 'QDRO' ? 'Divided by QDRO (§ 414(p)); distributions to the alternate payee are taxed to the alternate payee and exempt from the 10% additional tax (§ 72(t)(2)(C)).' : t.vehicle === '408(d)(6)' ? 'Transferred incident to divorce under § 408(d)(6): tax-free to both, the recipient\u2019s own IRA thereafter; NO penalty exception for the recipient\u2019s later early withdrawals.' : t.vehicle)}</div></div>`; }).join('');
    host.querySelectorAll('[data-f]').forEach((el) => { el.addEventListener('change', onField); if (el.tagName === 'INPUT') el.addEventListener('input', onField); });
    host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { rows = rows.filter((r) => r.id !== Number(b.closest('.rt-row').dataset.id)); renderRows(); compute(); }));
  }
  function onField(e) { const el = e.target; const row = rows.find((r) => r.id === Number(el.closest('.rt-row').dataset.id)); if (!row) return; const f = el.dataset.f;
    if (['balance', 'basis', 'monthly', 'yearsToRetire', 'payoutYears', 'maritalPct', 'toOther'].includes(f)) { row[f] = numv(el.value); if (e.type === 'change' && ['balance', 'basis', 'monthly'].includes(f)) el.value = row[f] ? row[f].toLocaleString('en-US') : ''; }
    else { row[f] = el.value; if (f === 'type') renderRows(); }
    compute(); }

  function inputs() {
    return {
      state: ($('rt_state') || {}).value || 'FL', incA: fld('rt_income_a'), incB: fld('rt_income_b'), statusA: ($('rt_status_a') || {}).value || 'single', statusB: ($('rt_status_b') || {}).value || 'single',
      ageA: fld('rt_age_a'), ageB: fld('rt_age_b'), discount: fld('rt_discount') / 100 || 0.05, cashNow: fld('rt_cash_now'), cashTo: ($('rt_cash_to') || {}).value || 'A', nyc: !!($('rt_nyc') && $('rt_nyc').checked), marriageYears: fld('rt_marriage_years'),
    };
  }
  function pvPension(monthly, yearsToRetire, payoutYears, r) { const n = Math.round(payoutYears * 12), rm = r / 12; if (!n || !monthly) return 0; const pvAtRet = rm ? monthly * (1 - Math.pow(1 + rm, -n)) / rm : monthly * n; return pvAtRet / Math.pow(1 + r, Math.max(0, yearsToRetire)); }

  function compute() {
    const i = inputs(); const jur = J[i.state] || J.FL;
    if (!rows.some((r) => r.balance > 0 || r.monthly > 0)) { renderEmpty(jur); return; }
    const rateFor = (who) => { const inc = who === 'A' ? i.incA : i.incB, st = who === 'A' ? i.statusA : i.statusB; return marg(inc, st) + jur.tax(inc) + (i.nyc && jur.name === 'New York' ? 0.03876 : 0); };
    const lines = []; const tot = { A: { gross: 0, net: 0 }, B: { gross: 0, net: 0 } }; const before = { A: { gross: 0, net: 0 }, B: { gross: 0, net: 0 } };
    const assumptions = [];
    for (const r of rows) {
      const t = TYPES[r.type]; const other = r.owner === 'A' ? 'B' : 'A';
      const gross = t.db ? pvPension(r.monthly, r.yearsToRetire, r.payoutYears, i.discount) : r.balance;
      if (!gross) continue;
      const marital = gross * Math.min(1, Math.max(0, r.maritalPct / 100)); const separate = gross - marital;
      const toOther = marital * Math.min(1, Math.max(0, r.toOther / 100)); const keep = gross - toOther;
      const netOf = (amt, who) => t.roth ? amt : t.taxable ? amt - Math.max(0, amt - (r.basis || 0) * (amt / gross)) * 0.188 : amt * (1 - rateFor(who));
      lines.push({ r, t, gross, marital, separate, keepGross: keep, keepNet: netOf(keep, r.owner), otherGross: toOther, otherNet: netOf(toOther, other), rateOwner: t.roth ? 0 : t.taxable ? 0.188 : rateFor(r.owner), rateOther: t.roth ? 0 : t.taxable ? 0.188 : rateFor(other) });
      tot[r.owner].gross += keep; tot[r.owner].net += netOf(keep, r.owner); tot[other].gross += toOther; tot[other].net += netOf(toOther, other);
      before[r.owner].gross += gross; before[r.owner].net += netOf(gross, r.owner);
    }
    // cash-now scenario
    const cashWho = i.cashTo; const cashRate = rateFor(cashWho); const age = cashWho === 'A' ? i.ageA : i.ageB;
    const viaQdro = i.cashNow ? { withheld: i.cashNow * 0.20, tax: i.cashNow * cashRate, penalty: 0, net: i.cashNow * (1 - cashRate) } : null;
    const viaIra = i.cashNow ? { tax: i.cashNow * cashRate, penalty: age && age < 59.5 ? i.cashNow * 0.10 : 0, net: i.cashNow * (1 - cashRate) - (age && age < 59.5 ? i.cashNow * 0.10 : 0) } : null;
    const viaOwnerCashout = i.cashNow ? { taxOnOwner: i.cashNow * rateFor(cashWho === 'A' ? 'B' : 'A'), penalty: ((cashWho === 'A' ? i.ageB : i.ageA) || 0) < 59.5 ? i.cashNow * 0.10 : 0 } : null;
    if (!i.incA || !i.incB) assumptions.push(`No post-divorce income entered for ${!i.incA && !i.incB ? 'either spouse' : !i.incA ? 'Spouse A' : 'Spouse B'}: bottom-bracket rates understate the tax embedded in every pre-tax account awarded to them.`);
    assumptions.push('Pre-tax balances are valued after tax at the recipient\u2019s current ordinary rate on the whole balance, as if distributed at once: this overstates the tax on an account drawn down over retirement, possibly at a lower bracket, and ignores the value of continued deferral. Roth balances are treated as fully tax-free (qualified distribution). Taxable brokerage is reduced by tax on the built-in gain at 18.8%.');
    if (rows.some((r) => TYPES[r.type].db && r.monthly > 0)) assumptions.push(`Pension present values discount the stated monthly benefit for the expected payout years at ${pct(i.discount)}, back to today from the retirement date, with no cost-of-living adjustment, no survivor benefit and no mortality table \u2014 a rough figure; a plan actuary or the plan\u2019s own present-value statement is the real one.`);
    if (!i.marriageYears) assumptions.push('No length of marriage entered: the Social Security derivative-benefit note below cannot be tested (ten years is the threshold).');
    if (rows.some((r) => r.maritalPct < 100)) assumptions.push('Marital portions below 100% are your entry (a coverture fraction for a pension, or premarital balance plus growth for an account); the tracing that supports them is a legal question the tool takes from you.');
    render({ i, jur, lines, tot, before, viaQdro, viaIra, viaOwnerCashout, cashRate, assumptions });
  }

  function renderEmpty(jur) { const res = $('rt_results'); if (res) res.innerHTML = '<p class="rt-empty">Enter at least one account or pension to see the division. Or <button type="button" class="rt-link" data-load-sample>load a sample</button>.</p>'; const b = res && res.querySelector('[data-load-sample]'); if (b) b.addEventListener('click', loadSample); renderJurisdiction(jur); }

  function render(m) {
    const { i, jur, lines, tot, before, viaQdro, viaIra, viaOwnerCashout, cashRate, assumptions } = m; const res = $('rt_results'); if (!res) return;
    const who = (w) => w === 'A' ? 'Spouse A' : 'Spouse B';
    const equalGrossGap = Math.abs(tot.A.gross - tot.B.gross), netGap = Math.abs(tot.A.net - tot.B.net);
    res.innerHTML = `
      ${assumptions.length ? `<div class="rt-assume"><strong>What this run assumed</strong><ul>${assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      <div class="rt-summary">
        <div class="rt-card"><div class="rt-k">Retirement assets before division</div><div class="rt-v">${money(before.A.gross + before.B.gross)}</div><div class="rt-s">A ${money(before.A.gross)} \u00b7 B ${money(before.B.gross)} (pensions at present value)</div></div>
        <div class="rt-card"><div class="rt-k">After the division \u2014 gross</div><div class="rt-v">${money(tot.A.gross)} / ${money(tot.B.gross)}</div><div class="rt-s">A / B; gap ${money(equalGrossGap)}</div></div>
        <div class="rt-card rt-card-hi"><div class="rt-k">After the division \u2014 after tax</div><div class="rt-v">${money(tot.A.net)} / ${money(tot.B.net)}</div><div class="rt-s">A / B; gap ${money(netGap)} \u2014 ${netGap > equalGrossGap * 1.15 ? 'the gross split hides a real disparity' : netGap < equalGrossGap * 0.85 ? 'the gross gap is smaller after tax' : 'gross and after-tax tell the same story'}</div></div>
      </div>

      <div class="table-wrap"><table class="rt-table"><thead><tr><th>Account</th><th>Vehicle</th><th class="num">Value</th><th class="num">Marital</th><th class="num">Stays with owner</th><th class="num">To the other spouse</th><th class="num">After tax: owner / other</th></tr></thead><tbody>
        ${lines.map((l) => `<tr><td>${esc(l.r.desc || l.t.label)}<div class="rt-cell-note">${esc(l.t.label)} \u00b7 ${who(l.r.owner)} owns</div></td><td>${esc(l.t.vehicle)}</td><td class="num">${money(l.gross)}</td><td class="num">${money(l.marital)}${l.separate ? `<div class="rt-cell-note">${money(l.separate)} separate</div>` : ''}</td><td class="num">${money(l.keepGross)}</td><td class="num">${money(l.otherGross)}</td><td class="num">${money(l.keepNet)} / ${money(l.otherNet)}<div class="rt-cell-note">${pct(l.rateOwner)} / ${pct(l.rateOther)}</div></td></tr>`).join('')}
      </tbody></table></div>

      <h4>The vehicle decides the tax</h4>
      <p><strong>Qualified plans</strong> (401(k), 403(b), 457(b), pensions) divide only by a qualified domestic relations order under § 414(p); the plan administrator must qualify it, and the agreement should say who drafts it, who pays, and what happens to the alternate payee if the participant dies before it is entered. Distributions to a spouse or former spouse as alternate payee are taxed to the alternate payee (§ 402(e)(1)(A)), may be rolled to an IRA, and are exempt from the 10% additional tax under § 72(t)(2)(C) \u2014 which makes the QDRO the one door through which a spouse under 59\u00bd can take cash from a retirement account without the penalty. A payment to the alternate payee that is not directly rolled over carries 20% mandatory withholding (§ 3405(c)). <strong>IRAs</strong> divide by transfer incident to divorce under § 408(d)(6): tax-free to both if made under the decree or a written instrument incident to it, the recipient\u2019s own IRA afterward \u2014 and the § 72(t)(2)(C) exception does not apply to IRAs, so the recipient who then withdraws before 59\u00bd pays the penalty. <strong>The cash-out trap:</strong> if the owner withdraws from the IRA and hands the money over, the owner is taxed and penalized and the recipient has cash the decree did not protect. <strong>Roth</strong> balances are tax-free if qualified; the recipient\u2019s five-year clock is measured on the recipient\u2019s own Roth history (Reg. § 1.408A-6) \u2014 confirm before relying on an immediate tax-free withdrawal. <strong>Non-qualified deferred compensation</strong> cannot be divided by QDRO; it is assigned by the employer\u2019s consent or offset with other assets, and Rev. Rul. 2002-22 taxes the recipient on nonqualified deferred compensation and options transferred incident to divorce when paid or exercised.</p>

      ${i.cashNow ? `<h4>${who(i.cashTo)} needs ${money(i.cashNow)} now</h4>
      <p><strong>Through a QDRO from a qualified plan:</strong> taxed to ${who(i.cashTo)} at ${pct(cashRate)} (${money(viaQdro.tax)}), no 10% penalty regardless of age, 20% withheld at payment (${money(viaQdro.withheld)}) and settled on the return; net about ${money(viaQdro.net)}. <strong>From an IRA received under § 408(d)(6):</strong> same tax, plus a ${money(viaIra.penalty)} penalty ${viaIra.penalty ? 'because ' + who(i.cashTo) + ' is under 59\u00bd' : '(none \u2014 age 59\u00bd or over)'}; net about ${money(viaIra.net)}. <strong>If the owner cashes out and pays it over:</strong> the owner bears ${money(viaOwnerCashout.taxOnOwner)} of tax${viaOwnerCashout.penalty ? ' and a ' + money(viaOwnerCashout.penalty) + ' penalty' : ''} for money that leaves the household \u2014 the worst of the three, and the most common. If cash is needed, route it through the QDRO.</p>` : ''}

      <h4>Pensions, survivor benefits and the marital fraction</h4>
      <p>A defined-benefit pension is divided either by a <strong>separate-interest</strong> QDRO (the alternate payee gets a benefit actuarially adjusted to the alternate payee\u2019s own life, payable when the alternate payee elects) or a <strong>shared-payment</strong> QDRO (a share of each payment when the participant retires, ending at the participant\u2019s death unless survivor benefits are assigned). The agreement must address the qualified joint and survivor annuity and pre-retirement survivor annuity (§ 417) \u2014 naming the former spouse as surviving spouse for the marital portion \u2014 or the stream dies with the participant. The marital portion is a coverture fraction (${esc(jur.name === 'New York' ? 'Majauskas' : jur.name === 'California' ? 'the time rule of Brown' : jur.name === 'Texas' ? 'Berry, valued at divorce' : 'service during the marriage over total service')}); early-retirement subsidies, COLAs and post-divorce raises are each a negotiated point. Federal (FERS/CSRS through OPM), military (USFSPA; the 2017 frozen-benefit rule fixes the former spouse\u2019s share at the rank and years at divorce) and state plans each require their own form of order. ${esc(jur.plans)}</p>

      <h4>Social Security</h4>
      <p>Not divisible and not on the balance sheet, but a marriage of ten years or more entitles a divorced spouse to a benefit of up to 50% of the former spouse\u2019s primary insurance amount from age 62 (reduced) if unmarried, without reducing the worker\u2019s own benefit, and to a survivor benefit later. ${i.marriageYears ? (i.marriageYears >= 10 ? `At ${i.marriageYears} years this marriage qualifies.` : `At ${i.marriageYears} years this marriage does not; if the tenth anniversary is close, the timing of the final decree is worth a conversation.`) : ''}</p>

      <h4>${jur.name}</h4>
      <p>${esc(jur.regime)} <strong>State tax on distributions:</strong> ${esc(jur.taxLabel)}</p>

      <p class="rt-meth"><strong>Method.</strong> After-tax values apply each recipient\u2019s 2026 federal marginal rate (single or head of household) plus the state rate at the income entered to the whole pre-tax balance; Roth balances are taken at face; taxable accounts are reduced by 18.8% of built-in gain. Pension present values are a simple annuity calculation from the retirement date at the discount rate entered. Marital portions and division percentages are your entries. Not modeled: mortality, survivor-benefit elections, early-retirement subsidies, plan loans, after-tax (basis) amounts in a traditional account (§ 72(e) pro-rata recovery), required minimum distributions, net unrealized appreciation on employer stock, and the New York pension exclusion. This is a negotiating schedule, not tax advice and not a court\u2019s division.</p>`;
    renderJurisdiction(jur);
  }

  function renderJurisdiction(jur) {
    const jn = $('rt_jur_name'); if (jn) jn.textContent = jur.name; const jps = $('rt_print_state'); if (jps) jps.textContent = jur.name;
    const jp = $('rt_jur_panel'); if (jp) jp.innerHTML = `<div class="rt-jur-grid"><div><strong>How ${esc(jur.name)} divides retirement</strong><p>${esc(jur.regime)}</p></div><div><strong>State tax on distributions</strong><p>${esc(jur.taxLabel)}</p><p style="margin-top:.5rem;"><strong>Plans with their own orders:</strong> ${esc(jur.plans)}</p></div></div>`;
    document.querySelectorAll('.rt-ny').forEach((el) => { el.style.display = jur.name === 'New York' ? '' : 'none'; });
  }
  const SAMPLE = { rt_state: 'FL', rt_income_a: '180,000', rt_income_b: '420,000', rt_status_a: 'hoh', rt_status_b: 'single', rt_age_a: '46', rt_age_b: '49', rt_discount: '5', rt_cash_now: '150,000', rt_cash_to: 'A', rt_marriage_years: '14' };
  function loadSample() { Object.keys(SAMPLE).forEach((k) => { const el = $(k); if (el) el.value = SAMPLE[k]; }); rows = []; seq = 0; DEFAULT_ROWS.forEach(addRow); renderRows(); compute(); const r = $('rt_rows'); if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function clearAll() { document.querySelectorAll('#rt_form input[type="text"]').forEach((el) => { el.value = ''; }); document.querySelectorAll('#rt_form input[type="checkbox"]').forEach((el) => { el.checked = false; }); ['rt_state', 'rt_status_a', 'rt_status_b', 'rt_cash_to'].forEach((id) => { const el = $(id); if (el) el.selectedIndex = 0; }); rows = []; seq = 0; BLANK.forEach(addRow); renderRows(); compute(); }
  function init() {
    const form = $('rt_form'); if (!form) return;
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); else console.warn('[rt] missing #' + id); };
    BLANK.forEach(addRow);
    form.querySelectorAll('input:not([data-f]), select:not([data-f])').forEach((el) => { el.addEventListener('input', compute); el.addEventListener('change', () => { if (el.dataset.money !== undefined) { const n = numv(el.value); el.value = n && el.value !== '' ? n.toLocaleString('en-US') : ''; } compute(); }); });
    document.querySelectorAll('[data-rt-sample]').forEach((b) => b.addEventListener('click', loadSample));
    on('rt_add', 'click', () => { addRow({ type: 'ira', owner: 'A' }); renderRows(); compute(); });
    on('rt_reset', 'click', clearAll); on('rt_print', 'click', () => window.print());
    renderRows(); compute();
  }
  const safeInit = () => { try { init(); } catch (e) { console.error('[rt] init failed', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit); else safeInit();
  if (typeof module !== 'undefined' && module.exports) module.exports = { J, TYPES, pvPension, marg };
})();
