/* Year-of-Divorce Filing Planner (Donovan Legal PLLC divorce suite, 2026-09-05)
 * Filing status for the decree year under § 7703 (married on December 31 or not;
 * "considered unmarried" for head of household), the tax each way, who claims the
 * children, how joint payments split, and the § 6015 exposure on the joint years.
 * Educational tool; nothing entered leaves the browser. Hard-navigated; no inline scripts.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
  const pct = (n) => (Math.round((n || 0) * 1000) / 10).toFixed(1) + '%';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const numv = (id) => { const el = $(id); if (!el) return 0; const n = Number(String(el.value || '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };

  /* ── Federal 2026 (indexed figures; verify each January) ─────────────────── */
  const FED = {
    asOf: 'September 5, 2026 (2026 federal parameters)',
    std: { single: 16100, hoh: 24150, mfj: 32200, mfs: 16100 },
    br: {
      single: [[12400, .10], [50400, .12], [105700, .22], [201775, .24], [256225, .32], [640600, .35], [Infinity, .37]],
      hoh: [[17700, .10], [67450, .12], [105700, .22], [201750, .24], [256200, .32], [640600, .35], [Infinity, .37]],
      mfj: [[24800, .10], [100800, .12], [211400, .22], [403550, .24], [512450, .32], [768700, .35], [Infinity, .37]],
      mfs: [[12400, .10], [50400, .12], [105700, .22], [201775, .24], [256225, .32], [384350, .35], [Infinity, .37]],
    },
    ctc: 2200, ctcPhase: { single: 200000, hoh: 200000, mfs: 200000, mfj: 400000 },
    niit: { single: 200000, hoh: 200000, mfs: 125000, mfj: 250000 },
  };
  function fedTax(taxable, status) { let t = 0, prev = 0; for (const [cap, r] of FED.br[status]) { if (taxable <= prev) break; t += (Math.min(taxable, cap) - prev) * r; prev = cap; } return Math.max(0, t); }
  function ctc(kids, agi, status) { if (!kids) return 0; const full = FED.ctc * kids; const over = Math.max(0, agi - FED.ctcPhase[status]); return Math.max(0, full - Math.ceil(over / 1000) * 50); }

  const J = {
    FL: { name: 'Florida', tax: () => 0, note: 'No state income tax; the federal status decision stands alone.', community: false },
    MA: { name: 'Massachusetts', tax: (inc) => inc * (inc > 1083150 ? 0.09 : 0.05), note: 'Flat 5% (9% above the surtax threshold), so the status choice barely moves the state tax; Massachusetts generally requires spouses who file a joint federal return to file jointly, and offers a head-of-household exemption rather than a separate rate schedule.', community: false },
    NY: { name: 'New York', tax: (inc, st) => { const b = st === 'mfj' ? [[17150, .04], [23600, .045], [27900, .0525], [161550, .055], [323200, .06], [2155350, .0685], [Infinity, .0965]] : [[8500, .04], [11700, .045], [13900, .0525], [80650, .055], [215400, .06], [1077550, .0685], [Infinity, .0965]]; let t = 0, p = 0; for (const [c, r] of b) { if (inc <= p) break; t += (Math.min(inc, c) - p) * r; p = c; } return t; }, note: 'Progressive rates; New York requires the same filing status as the federal return (with exceptions for spouses of different residency), and New York City residents add a city tax. The New York figures here are rough bracket approximations.', community: false },
    CA: { name: 'California', tax: (inc, st) => { const m = st === 'mfj' ? 2 : 1; const b = [[10756 * m, .01], [25499 * m, .02], [40245 * m, .04], [55866 * m, .06], [70606 * m, .08], [360659 * m, .093], [432787 * m, .103], [721318 * m, .113], [Infinity, .123]]; let t = 0, p = 0; for (const [c, r] of b) { if (inc <= p) break; t += (Math.min(inc, c) - p) * r; p = c; } return t + (inc > 1000000 ? (inc - 1000000) * 0.01 : 0); }, note: 'Progressive rates; California requires the same filing status as federal (with residency exceptions). Community property: spouses who file separately while married each report half of the community income earned before separation (§ 66; Pub. 555), which can make MFS pointless as a way to isolate one spouse\u2019s income. The California figures here are rough bracket approximations.', community: true },
    TX: { name: 'Texas', tax: () => 0, note: 'No state income tax. Community property: on a federal MFS return each spouse reports half of the community income for the period of marriage (§ 66; Pub. 555), subject to the § 66(a) exception where the spouses lived apart all year and no community income was transferred between them.', community: true },
  };

  const SAMPLE = { fp_state: 'FL', fp_wages_a: '180,000', fp_wages_b: '420,000', fp_other_a: '5,000', fp_other_b: '35,000', fp_itemized_a: '0', fp_itemized_b: '0', fp_kids: '2', fp_custodial: 'A', fp_release: 'no', fp_apart6: 'yes', fp_est_joint: '40,000', fp_withheld_a: '30,000', fp_withheld_b: '95,000', fp_decree: 'before' };

  function inputs() {
    return {
      state: ($('fp_state') || {}).value || 'FL', wagesA: numv('fp_wages_a'), wagesB: numv('fp_wages_b'), otherA: numv('fp_other_a'), otherB: numv('fp_other_b'),
      itemA: numv('fp_itemized_a'), itemB: numv('fp_itemized_b'), kids: Math.max(0, Math.round(numv('fp_kids'))),
      custodial: ($('fp_custodial') || {}).value || 'A', release: (($('fp_release') || {}).value || 'no') === 'yes', apart6: (($('fp_apart6') || {}).value || 'yes') === 'yes',
      estJoint: numv('fp_est_joint'), withheldA: numv('fp_withheld_a'), withheldB: numv('fp_withheld_b'), decree: ($('fp_decree') || {}).value || 'before',
    };
  }

  function person(inc, status, item, kidsClaimed, jur) {
    const ded = Math.max(FED.std[status], item); const taxable = Math.max(0, inc - ded);
    const fed = fedTax(taxable, status) - ctc(kidsClaimed, inc, status); const st = jur.tax(inc, status);
    return { inc, status, ded, taxable, fed: Math.max(0, fed), st, total: Math.max(0, fed) + st, kidsClaimed, marg: (() => { for (const [cap, r] of FED.br[status]) if (taxable <= cap) return r; return .37; })() };
  }

  function compute() {
    const i = inputs(); const jur = J[i.state] || J.FL;
    if (!(i.wagesA || i.wagesB)) { renderEmpty(jur); return; }
    const incA = i.wagesA + i.otherA, incB = i.wagesB + i.otherB;
    const custodial = i.custodial, nonCust = custodial === 'A' ? 'B' : 'A';
    const kidsCust = i.release ? 0 : i.kids, kidsNon = i.release ? i.kids : 0;     // CTC/dependency follow the release; HOH never does
    const statusOf = (who, marriedYearEnd) => {
      const isCust = who === custodial && i.kids > 0;
      if (!marriedYearEnd) return isCust ? 'hoh' : 'single';
      // still married on Dec. 31: MFS, unless "considered unmarried" (§ 7703(b)) -- custodial, lived apart last 6 months
      return isCust && i.apart6 ? 'hoh' : 'mfs';
    };
    // Scenario 1: decree entered by December 31 -- unmarried for the whole year
    const s1A = person(incA, statusOf('A', false), i.itemA, custodial === 'A' ? kidsCust : kidsNon, jur), s1B = person(incB, statusOf('B', false), i.itemB, custodial === 'B' ? kidsCust : kidsNon, jur);
    // Scenario 2a: still married -- joint return
    const jointItem = i.itemA + i.itemB; const jointDed = Math.max(FED.std.mfj, jointItem); const jointInc = incA + incB; const jointTaxable = Math.max(0, jointInc - jointDed);
    const joint = { fed: Math.max(0, fedTax(jointTaxable, 'mfj') - ctc(i.kids, jointInc, 'mfj')), st: jur.tax(jointInc, 'mfj'), ded: jointDed, taxable: jointTaxable }; joint.total = joint.fed + joint.st;
    // Scenario 2b: still married -- separate returns (MFS, or HOH for the considered-unmarried custodial parent)
    let mfsIncA = incA, mfsIncB = incB, communityNote = '';
    if (jur.community && !i.apart6) { mfsIncA = mfsIncB = (incA + incB) / 2; communityNote = 'Community-property state and the spouses were not apart all year: on separate returns each reports half of the combined income (§ 66), so MFS does not separate the incomes.'; }
    const s2A = person(mfsIncA, statusOf('A', true), i.itemA, custodial === 'A' ? kidsCust : kidsNon, jur), s2B = person(mfsIncB, statusOf('B', true), i.itemB, custodial === 'B' ? kidsCust : kidsNon, jur);
    // MFS itemizing rule: if either itemizes, both must (the other gets zero standard deduction)
    let mfsRule = '';
    if (s2A.status === 'mfs' && s2B.status === 'mfs') { const aIt = i.itemA > FED.std.mfs, bIt = i.itemB > FED.std.mfs; if (aIt !== bIt) { mfsRule = 'On separate returns, if one spouse itemizes the other may not take the standard deduction (§ 63(c)(6)(A)); the non-itemizing spouse\u2019s deduction is shown at zero.'; if (aIt) { s2B.ded = i.itemB; s2B.taxable = Math.max(0, mfsIncB - s2B.ded); s2B.fed = Math.max(0, fedTax(s2B.taxable, 'mfs') - ctc(s2B.kidsClaimed, mfsIncB, 'mfs')); s2B.total = s2B.fed + s2B.st; } else { s2A.ded = i.itemA; s2A.taxable = Math.max(0, mfsIncA - s2A.ded); s2A.fed = Math.max(0, fedTax(s2A.taxable, 'mfs') - ctc(s2A.kidsClaimed, mfsIncA, 'mfs')); s2A.total = s2A.fed + s2A.st; } } }
    const tot1 = s1A.total + s1B.total, tot2sep = s2A.total + s2B.total;
    // payments: withholding follows the wage-earner; joint estimates split by agreement or in proportion to separate tax
    const estShareA = (s1A.total + s1B.total) ? s1A.total / (s1A.total + s1B.total) : 0.5;
    const balA1 = s1A.total - i.withheldA - i.estJoint * estShareA, balB1 = s1B.total - i.withheldB - i.estJoint * (1 - estShareA);
    const assumptions = [];
    assumptions.push(`Federal 2026 parameters: standard deductions $${FED.std.single.toLocaleString()} single / $${FED.std.hoh.toLocaleString()} head of household / $${FED.std.mfj.toLocaleString()} joint; child tax credit $2,200 per child under 17 with the $200,000 / $400,000 phase-outs. Verify each January.`);
    assumptions.push('Income is treated as ordinary; capital gains, qualified dividends, NIIT, the QBI deduction, AMT, self-employment tax and every credit other than the child tax credit are not modeled. State taxes are approximations at the bracket level.');
    if (i.kids && custodial === 'A' && i.apart6 && i.decree === 'after') assumptions.push('Spouse A is treated as "considered unmarried" for head of household while still married: the tests are living apart from the spouse for the last six months of the year, paying more than half the cost of the home, and the home being a child\u2019s principal residence for more than half the year (§ 7703(b)). All three are taken from your entries.');
    if (i.release) assumptions.push('The dependency (and the child tax credit) is treated as released to the non-custodial parent by Form 8332; head-of-household status, the dependent-care credit and the earned-income credit cannot be released and stay with the custodial parent.');
    if (!i.itemA && !i.itemB) assumptions.push('No itemized deductions entered; the standard deduction is used for everyone. Mortgage interest, property tax (SALT-capped) and charitable gifts follow the spouse who paid them from the spouse\u2019s own funds on a separate return.');
    if (communityNote) assumptions.push(communityNote);
    if (mfsRule) assumptions.push(mfsRule);
    render({ i, jur, incA, incB, s1A, s1B, joint, s2A, s2B, tot1, tot2sep, balA1, balB1, estShareA, custodial, nonCust, assumptions });
  }

  function renderEmpty(jur) { const res = $('fp_results'); if (res) res.innerHTML = '<p class="fp-empty">Enter both spouses\u2019 income to compare the filing scenarios. Or <button type="button" class="fp-link" data-load-sample>load a sample</button>.</p>'; const b = res && res.querySelector('[data-load-sample]'); if (b) b.addEventListener('click', loadSample); renderJurisdiction(jur); }

  function render(m) {
    const { i, jur, incA, incB, s1A, s1B, joint, s2A, s2B, tot1, tot2sep, balA1, balB1, estShareA, custodial, nonCust, assumptions } = m; const res = $('fp_results'); if (!res) return;
    const lbl = { single: 'Single', hoh: 'Head of household', mfs: 'Married filing separately', mfj: 'Married filing jointly' };
    const best = Math.min(tot1, joint.total, tot2sep); const bestName = best === joint.total ? 'a joint return (stay married through December 31)' : best === tot1 ? 'a decree entered by December 31' : 'separate returns while still married';
    const sepTotal = Math.min(joint.total, tot2sep);
    res.innerHTML = `
      ${assumptions.length ? `<div class="fp-assume"><strong>What this run assumed</strong><ul>${assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      <div class="fp-summary">
        <div class="fp-card ${best === tot1 ? 'fp-card-hi' : ''}"><div class="fp-k">Decree by December 31</div><div class="fp-v">${money(tot1)}</div><div class="fp-s">A files ${lbl[s1A.status]} (${money(s1A.total)}) \u00b7 B files ${lbl[s1B.status]} (${money(s1B.total)})</div></div>
        <div class="fp-card ${best === joint.total ? 'fp-card-hi' : ''}"><div class="fp-k">Still married \u2014 joint return</div><div class="fp-v">${money(joint.total)}</div><div class="fp-s">one return, joint and several liability for all of it</div></div>
        <div class="fp-card ${best === tot2sep ? 'fp-card-hi' : ''}"><div class="fp-k">Still married \u2014 separate returns</div><div class="fp-v">${money(tot2sep)}</div><div class="fp-s">A files ${lbl[s2A.status]} (${money(s2A.total)}) \u00b7 B files ${lbl[s2B.status]} (${money(s2B.total)})</div></div>
        <div class="fp-card"><div class="fp-k">The timing decision is worth</div><div class="fp-v">${money(Math.abs(tot1 - sepTotal))}</div><div class="fp-s">${tot1 < sepTotal ? 'in favor of a decree before year-end' : tot1 > sepTotal ? 'in favor of staying married through December 31 and filing ' + (joint.total <= tot2sep ? 'jointly' : 'separately') : 'a wash'} \u2014 the family total; who bears it is the next question</div></div>
      </div>

      <h4>Marital status on December 31 decides the year</h4>
      <p>Under § 7703(a), a person divorced or legally separated under a decree of divorce or separate maintenance on the last day of the year is unmarried for the whole year; a person still married on December 31 files jointly or separately. A spouse who is still married can file as head of household only if "considered unmarried": living apart from the spouse for the last six months of the year, paying more than half the cost of keeping up the home, and the home being the principal residence of a child the spouse can claim (or could but for a Form 8332 release) for more than half the year (§ 7703(b)). The cheapest total here is ${bestName}, but the family total is not the only question: a joint return makes each spouse liable for all of the tax, and the savings have to be divided in the agreement.</p>

      <div class="table-wrap"><table class="fp-table"><thead><tr><th>Scenario</th><th>Spouse A</th><th>Spouse B</th><th class="num">Family total</th></tr></thead><tbody>
        <tr><td>Decree by Dec. 31</td><td>${lbl[s1A.status]}: income ${money(incA)}, deduction ${money(s1A.ded)}, federal ${money(s1A.fed)}, state ${money(s1A.st)}${s1A.kidsClaimed ? ', claims ' + s1A.kidsClaimed + ' child(ren)' : ''}</td><td>${lbl[s1B.status]}: income ${money(incB)}, deduction ${money(s1B.ded)}, federal ${money(s1B.fed)}, state ${money(s1B.st)}${s1B.kidsClaimed ? ', claims ' + s1B.kidsClaimed + ' child(ren)' : ''}</td><td class="num">${money(tot1)}</td></tr>
        <tr><td>Still married, joint</td><td colspan="2">Married filing jointly: income ${money(incA + incB)}, deduction ${money(joint.ded)}, federal ${money(joint.fed)}, state ${money(joint.st)}, ${i.kids} child(ren) on the return</td><td class="num">${money(joint.total)}</td></tr>
        <tr><td>Still married, separate</td><td>${lbl[s2A.status]}: income ${money(s2A.inc)}, deduction ${money(s2A.ded)}, federal ${money(s2A.fed)}, state ${money(s2A.st)}</td><td>${lbl[s2B.status]}: income ${money(s2B.inc)}, deduction ${money(s2B.ded)}, federal ${money(s2B.fed)}, state ${money(s2B.st)}</td><td class="num">${money(tot2sep)}</td></tr>
      </tbody></table></div>

      <h4>Who claims the children</h4>
      <p>The custodial parent \u2014 the one with more overnights (§ 152(e)) \u2014 claims the children unless a signed Form 8332 releases the dependency to the other for the year (or for specified years). The release carries the child tax credit and the dependency; it does not carry head-of-household status, the dependent-care credit or the earned-income credit, which stay with the custodial parent. Here ${custodial === 'A' ? 'Spouse A' : 'Spouse B'} is custodial${i.release ? ' and has released the dependency to ' + (nonCust === 'A' ? 'Spouse A' : 'Spouse B') : ''}; the credit is ${money(ctc(i.kids, i.release ? (nonCust === 'A' ? incA : incB) : (custodial === 'A' ? incA : incB), i.release ? (nonCust === 'A' ? s1A.status : s1B.status) : (custodial === 'A' ? s1A.status : s1B.status)))} to the claiming parent after the phase-out at that parent\u2019s income. Alternating years is common and requires a new Form 8332 for each year released; the agreement should say what happens if support is in arrears.</p>

      <h4>Payments already made</h4>
      <p>Withholding belongs to the spouse whose wages it came from (A ${money(i.withheldA)}, B ${money(i.withheldB)}). Joint estimated payments (${money(i.estJoint)}) may be divided between the spouses however they agree on separate returns; absent agreement they are allocated in proportion to each spouse\u2019s separate tax liability (${pct(estShareA)} to A here). On the decree-by-December-31 scenario, A ${balA1 >= 0 ? 'owes ' + money(balA1) : 'is refunded ' + money(-balA1)} and B ${balB1 >= 0 ? 'owes ' + money(balB1) : 'is refunded ' + money(-balB1)} before any other credits. The agreement should allocate the joint estimates in writing and state who receives any refund on the last joint return; a refund on a joint return can be taken for either spouse\u2019s separate debts unless the other files Form 8379 as an injured spouse.</p>

      <h4>Joint and several liability, and the way out</h4>
      <p>Every joint return the spouses have filed makes each of them liable for the whole tax, interest and penalties on it (§ 6013(d)(3)) \u2014 and an indemnity clause in the settlement agreement binds the spouses, not the IRS. Relief under § 6015 comes three ways: innocent-spouse relief for an understatement attributable to the other spouse that the requesting spouse did not know of and had no reason to know of (§ 6015(b)); separation of liability, available once divorced, legally separated or living apart for twelve months, allocating the deficiency to the spouse whose items produced it (§ 6015(c)), which must be elected within two years of the first collection activity against the requesting spouse; and equitable relief for the rest, including underpayments of tax shown on the return (§ 6015(f), Rev. Proc. 2013-34), available until the collection statute runs or, for a refund, within the refund period. Before the last joint return is signed: pull the account transcripts for the open years, decide who signs and who reviews, and put the indemnity, the audit-cooperation duty and the allocation of any future refund or deficiency in the agreement. ${esc(jur.name)}: ${esc(jur.note)}</p>

      <p class="fp-meth"><strong>Method.</strong> Federal tax is computed on ordinary income at the 2026 brackets for each status, with the larger of the standard deduction and itemized deductions entered and the child tax credit after phase-out; state tax is an approximation. Not modeled: capital gains and qualified dividends, NIIT, AMT, the QBI deduction, self-employment tax, the dependent-care and education credits, the earned-income credit, itemized-deduction interactions (the SALT cap on separate returns, the mortgage-interest split), IRA and student-loan phase-outs that are harsher on separate returns, and the taxation of Social Security. In community-property states the § 66 rules are applied only in the blunt form described above. This is a planning schedule, not tax advice and not a return.</p>`;
    renderJurisdiction(jur);
  }

  function renderJurisdiction(jur) { const jn = $('fp_jur_name'); if (jn) jn.textContent = jur.name; const jps = $('fp_print_state'); if (jps) jps.textContent = jur.name; const jp = $('fp_jur_panel'); if (jp) jp.innerHTML = `<div class="fp-jur-grid"><div><strong>${esc(jur.name)} and the status decision</strong><p>${esc(jur.note)}</p></div><div><strong>Federal parameters in this tool</strong><p>As of ${esc(FED.asOf)}: standard deductions $16,100 / $24,150 / $32,200; child tax credit $2,200 per child, phasing out above $200,000 ($400,000 joint); brackets as published for 2026. Verified each January.</p></div></div>`; }
  function loadSample() { Object.keys(SAMPLE).forEach((k) => { const el = $(k); if (el) el.value = SAMPLE[k]; }); compute(); const r = $('fp_results'); if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function clearAll() { document.querySelectorAll('#fp_form input[type="text"]').forEach((el) => { el.value = ''; }); ['fp_state', 'fp_custodial', 'fp_release', 'fp_apart6', 'fp_decree'].forEach((id) => { const el = $(id); if (el) el.selectedIndex = 0; }); compute(); }
  function init() {
    const form = $('fp_form'); if (!form) return;
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); else console.warn('[fp] missing #' + id); };
    form.querySelectorAll('input, select').forEach((el) => { el.addEventListener('input', compute); el.addEventListener('change', () => { if (el.dataset.money !== undefined) { const n = Number(String(el.value).replace(/[^0-9.\-]/g, '')); el.value = Number.isFinite(n) && el.value !== '' ? n.toLocaleString('en-US') : ''; } compute(); }); });
    document.querySelectorAll('[data-fp-sample]').forEach((b) => b.addEventListener('click', loadSample));
    on('fp_reset', 'click', clearAll); on('fp_print', 'click', () => window.print());
    compute();
  }
  const safeInit = () => { try { init(); } catch (e) { console.error('[fp] init failed', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit); else safeInit();
  if (typeof module !== 'undefined' && module.exports) module.exports = { FED, J, fedTax, ctc };
})();
