/* Divorce Marital Home — Keep, Sell, or Buy Out (Donovan Legal PLLC divorce suite, 2026-09-05)
 * Three paths for the house, each priced after tax under § 121 and § 1041, the
 * grant-of-use clause, timing against the decree, the buyout math, and the
 * state's transfer-tax and property-tax wrinkles. Educational tool; nothing
 * entered leaves the browser. Hard-navigated route; no inline scripts.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
  const pct = (n) => (Math.round((n || 0) * 1000) / 10).toFixed(1) + '%';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const numv = (id) => { const el = $(id); if (!el) return 0; const n = Number(String(el.value || '').replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };
  const pctv = (id) => numv(id) / 100;

  /* ── Federal 2026 ─────────────────────────────────────────────────────────── */
  const LTCG = { single: [49450, 545500], hoh: [66200, 579600], mfj: [98900, 613700] };
  const NIIT = { single: 200000, hoh: 200000, mfj: 250000 };
  const ltcgRate = (income, status) => { const [z, f] = LTCG[status] || LTCG.single; return income <= z ? 0 : income <= f ? 0.15 : 0.20; };
  const niit = (income, status) => income > (NIIT[status] || 200000) ? 0.038 : 0;
  const EXCL = { single: 250000, mfj: 500000 };

  /* ── State layer ─────────────────────────────────────────────────────────── */
  const J = {
    FL: { name: 'Florida', tax: () => 0, taxLabel: 'No state income tax on the gain.',
      transfer: 'Deeds between spouses conveying the marital home in connection with a dissolution are exempt from the documentary stamp tax when recorded within one year after the dissolution (Fla. Stat. § 201.02(7)); a deed outside that window, or one carrying new consideration such as an assumed mortgage, may be taxed at $0.70 per $100. Confirm with the closing agent.',
      propertyTax: 'Homestead: after the divorce only the spouse who lives there keeps the exemption and the Save Our Homes cap on that home; the departing spouse may transfer up to $500,000 of accumulated cap benefit to a new Florida homestead (portability), on the abandonment and new-application rules and timing. Confirm with the county property appraiser.',
      note: 'Equitable distribution; the court will value the home as of the date it finds just and equitable and may award exclusive use and possession to the parent with the children for a period, with the sale or buyout deferred.' },
    MA: { name: 'Massachusetts', tax: (inc) => inc > 1083150 ? 0.09 : 0.05, taxLabel: '5% on long-term gain (9% above the surtax threshold); 8.5% if held one year or less.',
      transfer: 'The deeds excise ($4.56 per $1,000) is measured by consideration; a conveyance between spouses incident to a divorce for no consideration beyond the division of marital property is generally treated as having no taxable consideration, but an assumed mortgage or cash buyout can be consideration. Confirm with the registry and counsel.',
      propertyTax: 'No reassessment on the interspousal transfer as such; the residential exemption, where a municipality offers one, follows the resident owner.',
      note: 'All property is divisible under c. 208 § 34; the court may order the house sold, award it to one spouse with an offsetting adjustment, or defer the sale until the children are emancipated.' },
    NY: { name: 'New York', tax: (inc) => inc > 25000000 ? 0.109 : inc > 5000000 ? 0.103 : inc > 1077550 ? 0.0965 : inc > 215400 ? 0.0685 : 0.06, taxLabel: 'Gain taxed as ordinary income, roughly 6\u201310.9%; add 3.876% for a New York City resident.',
      transfer: 'The New York real estate transfer tax applies to conveyances for consideration; a transfer between spouses pursuant to a divorce is generally treated as for consideration to the extent of any mortgage assumed or cash paid, with the marital-property exchange itself outside the tax. New York City imposes its own transfer tax. Confirm with counsel before the deed is drawn.',
      propertyTax: 'No reassessment on transfer; the STAR exemption follows the resident owner and income limits.',
      note: 'Equitable distribution; the marital home is commonly awarded to the custodial parent with exclusive occupancy until the youngest child\u2019s emancipation, sale deferred, and the other spouse\u2019s equity fixed or shared at sale.' },
    CA: { name: 'California', tax: (inc) => inc > 1000000 ? 0.133 : inc > 721318 ? 0.123 : inc > 432787 ? 0.113 : inc > 360659 ? 0.103 : inc > 70606 ? 0.093 : 0.08, taxLabel: 'Gain taxed as ordinary income, roughly 9.3\u201313.3%.',
      transfer: 'The documentary transfer tax exempts a transfer between spouses in connection with a dissolution (Rev. & Tax. Code § 11927); counties and cities follow the state exemption.',
      propertyTax: 'The interspousal transfer exclusion (Rev. & Tax. Code § 63) keeps the Proposition 13 base-year value in place when the home is transferred between spouses incident to the divorce \u2014 no reassessment. The exclusion is lost if the home is sold to a third party or later transferred outside the exclusions.',
      note: 'Community property, divided equally in value. Separate-property contributions to the home are reimbursed without interest under § 2640; post-separation mortgage payments and exclusive use are addressed through Epstein credits and Watts charges; a deferred sale of the family home to keep the children in place is available under §§ 3800\u20133810 (a Duke order).' },
    TX: { name: 'Texas', tax: () => 0, taxLabel: 'No state income tax on the gain.',
      transfer: 'Texas has no real estate transfer tax; a special warranty deed or deed pursuant to the decree conveys the interest, with an owelty-of-partition lien commonly used to secure the buyout.',
      propertyTax: 'The homestead exemption and the 10% appraisal cap stay with the spouse who continues to occupy the home as a principal residence; the other spouse\u2019s exemption ends.',
      note: 'Community property divided in a just and right manner; the court may award the home to one spouse with an owelty lien to the other, or order it sold. The community runs to the decree, so mortgage paydown during the case is community too.' },
  };

  const SAMPLE = { mh_state: 'FL', mh_fmv: '1,250,000', mh_mortgage: '400,000', mh_basis: '650,000', mh_costs: '6', mh_years_owned: '9', mh_income_a: '180,000', mh_income_b: '420,000', mh_status_a: 'hoh', mh_status_b: 'single', mh_share_b: '50', mh_years_later: '5', mh_appreciation: '3', mh_refi_rate: '6.5', mh_refi_term: '30', mh_b_use_ok: 'yes' };

  function inputs() {
    return {
      state: ($('mh_state') || {}).value || 'FL',
      fmv: numv('mh_fmv'), mortgage: numv('mh_mortgage'), basis: numv('mh_basis'), costs: pctv('mh_costs') || 0.06, yearsOwned: numv('mh_years_owned'),
      incA: numv('mh_income_a'), incB: numv('mh_income_b'), statusA: ($('mh_status_a') || {}).value || 'single', statusB: ($('mh_status_b') || {}).value || 'single',
      shareB: Math.min(1, Math.max(0, numv('mh_share_b') / 100 || 0.5)),
      yearsLater: numv('mh_years_later'), appreciation: pctv('mh_appreciation'),
      refiRate: pctv('mh_refi_rate'), refiTerm: numv('mh_refi_term') || 30,
      bUseOk: (($('mh_b_use_ok') || {}).value || 'yes') === 'yes',      // B (departing) still meets the use test now
      nyc: !!($('mh_nyc') && $('mh_nyc').checked),
      aStayCertain: !!($('mh_a_stay') && $('mh_a_stay').checked),
    };
  }

  function gainTax(gain, income, status, jur, nycFlag) {
    const st = jur.tax(income) + (nycFlag && jur.name === 'New York' ? 0.03876 : 0);
    const rate = ltcgRate(income, status) + niit(income, status) + st;
    return { tax: Math.max(0, gain) * rate, rate };
  }

  function payment(principal, rate, years) { const n = years * 12, r = rate / 12; if (!n || !principal) return 0; if (!r) return principal / n; return principal * r / (1 - Math.pow(1 + r, -n)); }

  function compute() {
    const i = inputs(); const jur = J[i.state] || J.FL;
    if (!i.fmv) { renderEmpty(jur); return; }
    const equity = i.fmv - i.mortgage;
    const sellNow = (() => {
      // Path 1: sell before the decree on a joint return, $500,000 exclusion (both must meet ownership and use)
      const netPrice = i.fmv * (1 - i.costs); const gain = netPrice - i.basis;
      const taxable = Math.max(0, gain - EXCL.mfj);
      const t = gainTax(taxable, i.incA + i.incB, 'mfj', jur, i.nyc);
      const proceeds = netPrice - i.mortgage - t.tax;
      return { netPrice, gain, taxable, tax: t.tax, rate: t.rate, proceeds, toA: proceeds * (1 - i.shareB), toB: proceeds * i.shareB };
    })();
    const buyout = (() => {
      // Path 2: A keeps the home; B is bought out of B's share of the equity now; A sells later as a single/HOH filer
      const grossBuyout = equity * i.shareB;                       // what the forensic schedule calls B's half
      const futureFmv = i.fmv * Math.pow(1 + i.appreciation, i.yearsLater);
      const netPrice = futureFmv * (1 - i.costs); const gain = netPrice - i.basis;     // carryover basis under § 1041: A bears the whole gain
      const excl = EXCL.single; const taxable = Math.max(0, gain - excl);
      const t = gainTax(taxable, i.incA, i.statusA, jur, i.nyc);
      // the embedded tax B escapes and A inherits: B's share of the tax on today's gain, computed at A's rates
      const todayGain = i.fmv * (1 - i.costs) - i.basis; const todayTaxable = Math.max(0, todayGain - excl);
      const embeddedNow = gainTax(todayTaxable, i.incA, i.statusA, jur, i.nyc).tax;
      const taxEffectedBuyout = Math.max(0, grossBuyout - embeddedNow * i.shareB - i.fmv * i.costs * i.shareB);   // net of B's share of the tax and the selling costs A will eventually pay
      const refiPrincipal = i.mortgage + grossBuyout; const pmt = payment(refiPrincipal, i.refiRate, i.refiTerm);
      const aNetLater = netPrice - t.tax - refiPrincipal * (1 - Math.min(1, i.yearsLater / i.refiTerm) * 0.35);   // rough remaining balance after yearsLater of amortization
      return { grossBuyout, taxEffectedBuyout, futureFmv, netPrice, gain, taxable, tax: t.tax, rate: t.rate, refiPrincipal, pmt, aNetLater, embeddedNow, exclusionOk: i.aStayCertain || true };
    })();
    const coOwn = (() => {
      // Path 3: both keep their interests; A lives there; sale in yearsLater. With the § 121(d)(3)(B) clause B keeps the use test; without it B loses the exclusion after the 3-year lookback runs out
      const futureFmv = i.fmv * Math.pow(1 + i.appreciation, i.yearsLater);
      const netPrice = futureFmv * (1 - i.costs); const gain = netPrice - i.basis;
      const gainA = gain * (1 - i.shareB), gainB = gain * i.shareB;
      const tA = gainTax(Math.max(0, gainA - EXCL.single), i.incA, i.statusA, jur, i.nyc);
      const bHasExclusion = i.yearsLater <= 3 && i.bUseOk;      // without the clause, B's own use must fall within the 5-year lookback
      const tBWith = gainTax(Math.max(0, gainB - EXCL.single), i.incB, i.statusB, jur, i.nyc);
      const tBWithout = gainTax(Math.max(0, gainB - (bHasExclusion ? EXCL.single : 0)), i.incB, i.statusB, jur, i.nyc);
      const mortgageLater = i.mortgage * (1 - Math.min(1, i.yearsLater / 30) * 0.3);
      const netA = (netPrice - mortgageLater) * (1 - i.shareB) - tA.tax;
      const netBWith = (netPrice - mortgageLater) * i.shareB - tBWith.tax, netBWithout = (netPrice - mortgageLater) * i.shareB - tBWithout.tax;
      return { futureFmv, netPrice, gain, gainA, gainB, tA: tA.tax, tBWith: tBWith.tax, tBWithout: tBWithout.tax, netA, netBWith, netBWithout, bHasExclusion, mortgageLater };
    })();
    const assumptions = [];
    if (!i.incA) assumptions.push('No post-divorce income entered for Spouse A: bottom-bracket rates (0% capital gain, no NIIT) understate the tax on every path where A pays it.');
    if (!i.incB) assumptions.push('No post-divorce income entered for Spouse B: same effect on B\u2019s tax.');
    if (!i.basis) assumptions.push('No basis entered: the entire value is treated as gain. Basis is purchase price plus capital improvements less any depreciation (home office, rental period); enter it.');
    if (i.yearsOwned && i.yearsOwned < 2) assumptions.push('The home has been owned less than two years: neither spouse meets the § 121 ownership test yet, and no exclusion would be available on a sale today. The exclusions shown assume the test is met.');
    assumptions.push(`Selling costs of ${pct(i.costs)} of price are assumed on every sale.`);
    assumptions.push(`The "sell now" path assumes a sale closed before the decree and reported on a joint return with the $500,000 exclusion, which requires that both spouses meet the two-out-of-five-year ownership and use tests as of the sale (either spouse\u2019s ownership counts for both; each spouse\u2019s own use is required, § 121(b)(2)).`);
    assumptions.push(`The later-sale paths assume ${pct(i.appreciation)} annual appreciation for ${i.yearsLater} years and a $250,000 exclusion for Spouse A as a ${i.statusA === 'hoh' ? 'head-of-household' : 'single'} filer who continues to live in the home; mortgage balances at the later sale are rough amortization estimates, not a schedule.`);
    if (!i.bUseOk) assumptions.push('Spouse B is marked as no longer meeting the use test today; without the grant-of-use clause B has no exclusion on a later sale.');
    if (i.state === 'NY' && !i.nyc) assumptions.push('New York City residency unchecked; a city resident adds 3.876% to every gain.');
    render({ i, jur, equity, sellNow, buyout, coOwn, assumptions });
  }

  function renderEmpty(jur) {
    const res = $('mh_results'); if (res) res.innerHTML = '<p class="mh-empty">Enter the home\u2019s value, mortgage and basis to compare the three paths. Or <button type="button" class="mh-link" data-load-sample>load a sample</button>.</p>';
    const b = res && res.querySelector('[data-load-sample]'); if (b) b.addEventListener('click', loadSample);
    renderJurisdiction(jur);
  }

  function render(m) {
    const { i, jur, equity, sellNow, buyout, coOwn, assumptions } = m; const res = $('mh_results'); if (!res) return;
    res.innerHTML = `
      ${assumptions.length ? `<div class="mh-assume"><strong>What this run assumed</strong><ul>${assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      <div class="mh-summary">
        <div class="mh-card"><div class="mh-k">Equity today</div><div class="mh-v">${money(equity)}</div><div class="mh-s">value ${money(i.fmv)} less mortgage ${money(i.mortgage)}; basis ${money(i.basis)}; built-in gain before selling costs ${money(i.fmv - i.basis)}</div></div>
        <div class="mh-card mh-card-hi"><div class="mh-k">1 \u00b7 Sell now, before the decree</div><div class="mh-v">${money(sellNow.proceeds)}</div><div class="mh-s">net proceeds after ${pct(i.costs)} costs, the mortgage, and ${money(sellNow.tax)} tax on ${money(sellNow.taxable)} of gain above the $500,000 joint exclusion \u2192 A ${money(sellNow.toA)} \u00b7 B ${money(sellNow.toB)}</div></div>
        <div class="mh-card mh-card-hi"><div class="mh-k">2 \u00b7 A keeps it and buys B out</div><div class="mh-v">${money(buyout.taxEffectedBuyout)}</div><div class="mh-s">the tax-effected buyout of B\u2019s ${pct(i.shareB)} \u2014 the gross equity share is ${money(buyout.grossBuyout)}, less B\u2019s share of the selling costs and of the ${money(buyout.embeddedNow)} of tax A inherits with the carryover basis</div></div>
        <div class="mh-card mh-card-hi"><div class="mh-k">3 \u00b7 Co-own, A lives there, sell in ${i.yearsLater} years</div><div class="mh-v">${money(coOwn.netA)} / ${money(coOwn.netBWith)}</div><div class="mh-s">A / B after tax with the grant-of-use clause in the agreement; without it B nets ${money(coOwn.netBWithout)} (${coOwn.bHasExclusion ? 'B\u2019s own use still qualifies at that date' : 'B has lost the $250,000 exclusion'})</div></div>
      </div>

      <h4>Path 1 \u2014 sell now</h4>
      <p>Sale price ${money(i.fmv)} less ${pct(i.costs)} costs = ${money(sellNow.netPrice)}; gain over basis ${money(sellNow.gain)}; $500,000 joint exclusion leaves ${money(sellNow.taxable)} taxable at ${pct(sellNow.rate)} (federal capital gain + NIIT + ${jur.name} at the parties\u2019 combined income on a joint return) = ${money(sellNow.tax)}. After the mortgage: ${money(sellNow.proceeds)}, divided ${pct(1 - i.shareB)} / ${pct(i.shareB)}. The joint exclusion is the largest single tax lever in the house: it is available only while a joint return can be filed \u2014 the sale must close in a year the parties are still married on December 31 and file jointly \u2014 and each spouse must have used the home as a principal residence for two of the last five years.</p>

      <h4>Path 2 \u2014 A keeps the home</h4>
      <p>The transfer of B\u2019s interest to A is tax-free under § 1041 and A takes B\u2019s basis, so A carries the entire ${money(i.fmv - i.basis)} of built-in gain and will have only a $250,000 exclusion when A eventually sells. A buyout at gross equity (${money(buyout.grossBuyout)}) makes B whole today and hands A a tax bill B will never share. The tax-effected buyout (${money(buyout.taxEffectedBuyout)}) reduces B\u2019s share by B\u2019s ${pct(i.shareB)} of the selling costs and of the tax embedded in the gain at A\u2019s rates \u2014 the number to negotiate from. Financing: refinancing the ${money(i.mortgage)} mortgage plus a ${money(buyout.grossBuyout)} cash buyout is ${money(buyout.refiPrincipal)} at ${pct(i.refiRate)} over ${i.refiTerm} years, about ${money(buyout.pmt)} a month; that is ${pct(buyout.pmt * 12 / Math.max(1, i.incA))} of A\u2019s income. If A sells in ${i.yearsLater} years at ${money(buyout.futureFmv)}: gain ${money(buyout.gain)}, exclusion $250,000, tax ${money(buyout.tax)} at ${pct(buyout.rate)}. ${i.statusA === 'hoh' ? 'A files head of household, which raises the 15% threshold.' : ''} The buyout can also be paid in other assets from the marital balance sheet instead of cash \u2014 which is where the two tools meet.</p>

      <h4>Path 3 \u2014 keep both names on the deed</h4>
      <p>A lives in the home; B keeps a ${pct(i.shareB)} interest and is paid at the later sale. B moves out, so after three years B fails the two-out-of-five-year use test on B\u2019s own facts. Section 121(d)(3)(B) fixes this: if the agreement grants A the right to use the home, B is treated as using it too for as long as A does, and B keeps a $250,000 exclusion on B\u2019s half of the gain. With the clause: A nets ${money(coOwn.netA)} and B nets ${money(coOwn.netBWith)} on a sale in ${i.yearsLater} years. Without it: B nets ${money(coOwn.netBWithout)} \u2014 a ${money(coOwn.netBWith - coOwn.netBWithout)} difference from one sentence in the agreement. The agreement also has to say who pays the mortgage, taxes, insurance and repairs in the meantime, who gets the mortgage-interest and property-tax deductions (the payer, if the payer is an owner), whether the payments are support or property, and what happens if A remarries or wants to refinance.</p>

      <h4>${jur.name}</h4>
      <p><strong>State tax on the gain.</strong> ${esc(jur.taxLabel)} <strong>Transfer tax.</strong> ${esc(jur.transfer)} <strong>Property tax.</strong> ${esc(jur.propertyTax)} <strong>Division.</strong> ${esc(jur.note)}</p>

      <h4>The clauses</h4>
      <ul>
        <li><strong>Grant of use</strong> (Path 3): \u201cSpouse A shall have the exclusive right to use and occupy the residence until [event]; the parties intend that Spouse B be treated as using the residence during that period for purposes of § 121(d)(3)(B).\u201d</li>
        <li><strong>Sale timing</strong> (Path 1): a closing date before December 31 of a year the parties will still be married and will file jointly, or an express agreement to file jointly for the year of sale with the tax allocated.</li>
        <li><strong>Buyout</strong> (Path 2): the price stated as tax-effected equity, the refinance deadline that releases B from the mortgage, a lien or owelty for the unpaid buyout, and the § 1041 transfer within the safe periods (one year after the marriage ends, or up to six years if related to the cessation).</li>
        <li><strong>Deductions and carrying costs</strong> (Paths 2 and 3): who claims mortgage interest and property tax, who pays what, and whether payments by the non-resident spouse are alimony, child support or property.</li>
      </ul>

      <p class="mh-meth"><strong>Method.</strong> Federal capital-gain rates use the 2026 thresholds (0/15/20%) for the filing status shown, plus 3.8% NIIT above the statutory threshold, plus the state rate at the income entered; a joint-return sale uses the parties\u2019 combined income and the joint thresholds. Basis carries over under § 1041 on any transfer between spouses incident to divorce. The exclusion assumes the two-out-of-five-year tests are met as described; partial exclusions for unforeseen circumstances, depreciation recapture from a home office or rental period, the § 121(b)(5) nonqualified-use rule, and points, refinance costs and interest deductibility are not modeled. Mortgage balances at later dates are rough. This is a negotiating schedule, not tax advice and not a court\u2019s division.</p>`;
    renderJurisdiction(jur);
  }

  function renderJurisdiction(jur) {
    const jn = $('mh_jur_name'); if (jn) jn.textContent = jur.name;
    const jps = $('mh_print_state'); if (jps) jps.textContent = jur.name;
    const jp = $('mh_jur_panel'); if (jp) jp.innerHTML = `<div class="mh-jur-grid"><div><strong>How ${esc(jur.name)} deals with the house</strong><p>${esc(jur.note)}</p><p style="margin-top:.5rem;"><strong>State tax on the gain:</strong> ${esc(jur.taxLabel)}</p></div><div><strong>Transfer tax on the deed</strong><p>${esc(jur.transfer)}</p><p style="margin-top:.5rem;"><strong>Property tax after the transfer:</strong> ${esc(jur.propertyTax)}</p></div></div>`;
    document.querySelectorAll('.mh-ny').forEach((el) => { el.style.display = jur.name === 'New York' ? '' : 'none'; });
  }

  function loadSample() { Object.keys(SAMPLE).forEach((k) => { const el = $(k); if (el) el.value = SAMPLE[k]; }); compute(); const r = $('mh_results'); if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function clearAll() { document.querySelectorAll('#mh_form input[type="text"]').forEach((el) => { el.value = ''; }); document.querySelectorAll('#mh_form input[type="checkbox"]').forEach((el) => { el.checked = false; }); ['mh_state', 'mh_status_a', 'mh_status_b', 'mh_b_use_ok'].forEach((id) => { const el = $(id); if (el) el.selectedIndex = 0; }); compute(); }

  function init() {
    const form = $('mh_form'); if (!form) return;
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); else console.warn('[mh] missing #' + id); };
    form.querySelectorAll('input, select').forEach((el) => {
      el.addEventListener('input', compute);
      el.addEventListener('change', () => { if (el.dataset.money !== undefined) { const n = Number(String(el.value).replace(/[^0-9.\-]/g, '')); el.value = Number.isFinite(n) && el.value !== '' ? n.toLocaleString('en-US') : ''; } compute(); });
    });
    document.querySelectorAll('[data-mh-sample]').forEach((b) => b.addEventListener('click', loadSample));
    on('mh_reset', 'click', clearAll);
    on('mh_print', 'click', () => window.print());
    compute();
  }
  const safeInit = () => { try { init(); } catch (e) { console.error('[mh] init failed', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit); else safeInit();
  if (typeof module !== 'undefined' && module.exports) module.exports = { J, ltcgRate, niit, payment };
})();
