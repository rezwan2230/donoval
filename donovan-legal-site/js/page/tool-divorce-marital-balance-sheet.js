/* Tax-Effected Marital Balance Sheet — Donovan Legal PLLC (divorce suite, tool 1)
 * 2026-09-05. Educational tool. Reads the equitable-distribution / community
 * schedule the way a tax lawyer reads it: every line carries the tax that is
 * embedded in it, and the "equal" division is recomputed after tax.
 *
 * Boots once at load (hard-navigated route; see js/perch/swap-policy.js).
 * No inline scripts: the page's buttons are wired here with addEventListener.
 * Nothing entered leaves the browser.
 */
(function () {
  'use strict';

  /* ── Jurisdiction rules ─────────────────────────────────────────────────────
     Five states. Each entry drives (a) the default division target, (b) which
     assets are on the table at all, (c) how goodwill is treated, (d) whether
     the court will look at embedded tax, and (e) the state income tax layer.
     Statements are summaries for an educational tool; every one of them has a
     "verify" posture, and the page says so. */
  const J = {
    FL: {
      name: 'Florida', regime: 'Equitable distribution (dual classification)',
      cite: 'Fla. Stat. § 61.075',
      defaultSplit: 0.5, splitLocked: false,
      splitRule: 'The court begins with the premise that the distribution should be equal and may make an unequal distribution on the statutory factors — contribution to the marriage, economic circumstances, duration, career or education sacrificed, contribution to the other spouse’s career, the desirability of keeping a business or asset intact and free of the other spouse’s claims, contribution to acquisition and enhancement of both marital and nonmarital assets, intentional dissipation within two years of filing, and "any other factors necessary to do equity and justice." § 61.075(1)(a)–(j).',
      classes: 'Marital assets include everything acquired during the marriage by either spouse, the enhancement in value of nonmarital assets from marital labor or funds, interspousal gifts, and vested and nonvested retirement benefits accrued during the marriage. Nonmarital: premarital assets, gifts and inheritances from third parties, income from nonmarital assets unless treated as marital, and assets excluded by a valid written agreement. Real property held as tenants by the entireties is presumed marital. § 61.075(6).',
      cutoff: 'Cut-off date for identifying marital assets and liabilities: the earlier of the date of a valid separation agreement or the date the petition is filed. Valuation date: the date or dates the judge finds just and equitable — different assets may carry different dates. § 61.075(7).',
      standard: 'Fair market value. Enterprise goodwill of a business is a marital asset; personal goodwill attributable to a spouse’s continued presence or reputation is not (Thompson v. Thompson, 576 So. 2d 267 (Fla. 1991)); the 2024 amendment to § 61.075 codifies the exclusion of goodwill that depends on the spouse’s continued involvement. Verify the current statutory text.',
      goodwillRule: 'personal_excluded',
      taxRule: 'Tax consequences are considered where they are reasonably certain to occur — a sale ordered or agreed, a retirement account that must be liquidated. Speculative future tax on an asset a spouse will hold is generally not deducted. Practically: the court will not tax-effect the schedule for you; the settlement has to.',
      taxLevel: 'discretionary',
      state: { label: 'No state income tax', ord: () => 0, ltcg: () => 0, note: 'Florida has no personal income tax. Federal rates are the whole picture unless a spouse relocates.' },
      alimony: 'Permanent alimony was abolished for cases filed after July 1, 2023 (SB 1416); durational alimony is capped by length of marriage and amount. Alimony under agreements executed after 2018 is neither deductible nor includible for federal purposes (§ 71 repealed by the TCJA).',
      draftingNotes: [
        'State the valuation date for each asset in the agreement — § 61.075(7) lets the court pick, so the parties should pick first.',
        'If the out-spouse keeps an interest in the home, include the § 121(d)(3)(B) grant-of-use clause so the two-out-of-five-year test keeps running for them.',
        'Allocate suspended passive losses expressly; under § 469(j)(6) they ride with the property as basis and are not otherwise divisible.',
        'For a business the operating spouse keeps, document the enterprise/personal goodwill split the forensic used — that split is a legal question in Florida, not an accounting one.',
      ],
    },
    MA: {
      name: 'Massachusetts', regime: 'Equitable division of all property ("hotchpot")',
      cite: 'M.G.L. c. 208, § 34',
      defaultSplit: 0.5, splitLocked: false,
      splitRule: 'The court may assign to either spouse all or any part of the estate of the other — premarital, inherited and gifted property included. There is no statutory presumption of equality; the § 34 factors (length of marriage, conduct during the marriage, age, health, station, occupation, amount and sources of income, vocational skills, employability, estate, liabilities, needs, opportunity for future acquisition of capital and income, contributions as homemaker) govern. Equal division is the common starting point in a long marriage, not a rule.',
      classes: 'All property of either spouse, however and whenever acquired, is subject to division. Separate origin (inheritance, premarital) is a factor in the division, not a bar to it.',
      cutoff: 'Assets are generally valued as of the date of the divorce trial; the court has discretion to use a different date where equity requires (for example, post-separation appreciation attributable to one spouse’s efforts).',
      standard: 'Fair value in substance for closely held interests: the SJC in Bernier v. Bernier, 449 Mass. 774 (2007), rejected marketability and minority discounts where no sale is contemplated, and held that an S corporation’s earnings should be tax-affected at a rate that captures the S election’s benefit rather than at a full C-corporation rate or not at all. Goodwill of a professional practice may be included (Goldman v. Goldman, 28 Mass. App. Ct. 603 (1990)), with care against double-counting the same earnings in alimony.',
      goodwillRule: 'case_by_case',
      taxRule: 'The court may consider tax consequences that are reasonably certain; speculative or remote tax is not deducted. Bernier makes tax-affecting part of valuation itself for S corporations.',
      taxLevel: 'discretionary',
      state: { label: 'Massachusetts: 5% (9% above the surtax threshold); 8.5% on short-term gains',
        ord: (inc) => inc > 1083150 ? 0.09 : 0.05, ltcg: (inc) => inc > 1083150 ? 0.09 : 0.05,
        note: 'Flat 5% on most income and long-term gains, plus the 4% surtax on taxable income above roughly $1.08 million (indexed). Short-term capital gains are taxed at 8.5%. Verify the current-year surtax threshold.' },
      alimony: 'The Alimony Reform Act (c. 208, §§ 48–55) sets durational limits by length of marriage and caps general term alimony at need or 30–35% of the income difference; income already divided as property is not double-counted. Post-2018 alimony is not deductible or includible federally; Massachusetts continues to follow its own rules — verify the current state treatment.',
      draftingNotes: [
        'Because separate and inherited property is on the table, the agreement should say expressly what was excluded and why — silence invites relitigation under § 34.',
        'For an S corporation, state the tax-affecting rate the parties used (Bernier) so the valuation is not reopened.',
        'Massachusetts taxes short-term gains at 8.5%: an asset a spouse will sell within a year of receipt carries more embedded tax than the federal number suggests.',
        'Address the surtax: a spouse taking a large pre-tax retirement account may cross the $1 million threshold in the year of any lump-sum distribution.',
      ],
    },
    NY: {
      name: 'New York', regime: 'Equitable distribution (dual classification)',
      cite: 'Domestic Relations Law § 236(B)',
      defaultSplit: 0.5, splitLocked: false,
      splitRule: 'Marital property is divided equitably on the factors of DRL § 236(B)(5)(d) — which expressly include "the tax consequences to each party." Equal division is common for a long marriage; a business built by one spouse is often divided unequally.',
      classes: 'Marital: all property acquired by either spouse during the marriage and before commencement of the action, regardless of title. Separate: premarital property; property acquired by bequest, devise, descent or gift from a third party; personal-injury compensation; property acquired in exchange for separate property; and appreciation of separate property except to the extent attributable to the other spouse’s contributions or efforts. Since 2016 the value of a spouse’s enhanced earning capacity from a license, degree, celebrity goodwill or career enhancement is not marital property, though contributions to it remain a factor. § 236(B)(1)(d), (5)(d)(7).',
      cutoff: 'Marital property is measured through the date the action is commenced. Valuation date: a date between commencement and trial, set by the court (§ 236(B)(4)(b)); in practice "active" assets such as a business are valued at commencement and "passive" assets such as securities and real estate at trial.',
      standard: 'Fair market value, with discounts for lack of marketability or control decided case by case. Enterprise goodwill of a business or practice is marital; the 2016 amendment removed enhanced earning capacity and celebrity goodwill from the marital estate.',
      goodwillRule: 'enterprise_only_statutory',
      taxRule: 'Tax consequences are a statutory factor the court must consider (§ 236(B)(5)(d)(11)). New York courts still distinguish tax that is reasonably certain from tax that is speculative, but the after-tax view is squarely before the court here in a way it is not in California or Florida.',
      taxLevel: 'statutory_factor',
      state: { label: 'New York: 6.85%–10.9%, plus New York City 3.876% for city residents',
        ord: (inc) => inc > 25000000 ? 0.109 : inc > 5000000 ? 0.103 : inc > 1077550 ? 0.0965 : inc > 215400 ? 0.0685 : 0.06,
        ltcg: (inc) => inc > 25000000 ? 0.109 : inc > 5000000 ? 0.103 : inc > 1077550 ? 0.0965 : inc > 215400 ? 0.0685 : 0.06,
        note: 'New York taxes capital gains as ordinary income. Brackets shown are approximate single-filer marginal rates; add 3.876% for New York City residents. Verify current-year brackets.' },
      alimony: 'Maintenance follows the statutory guideline formula (DRL § 236(B)(6)) with an income cap that is indexed; post-2018 maintenance is not deductible or includible federally, and New York decoupled so that it remains deductible and includible for New York purposes — verify current treatment.',
      draftingNotes: [
        'Set the valuation date for each asset class in the agreement; the active/passive distinction is a litigation issue the parties can settle.',
        'Because tax consequences are a statutory factor, put the after-tax schedule in the record — it is evidence here, not just a negotiating position.',
        'New York City residency of the recipient spouse adds nearly 4 points to every embedded-tax line; confirm each spouse’s post-divorce residence.',
        'Enhanced earning capacity is off the table since 2016; if the forensic valued a license or degree, that value has to come out.',
      ],
    },
    CA: {
      name: 'California', regime: 'Community property (equal division)',
      cite: 'Cal. Fam. Code §§ 760, 770, 771, 2550, 2552',
      defaultSplit: 0.5, splitLocked: true,
      splitRule: 'Community property must be divided equally (Fam. Code § 2550), by value, not asset by asset — one spouse may take the house and the other the retirement account so long as the totals are equal. Separate property is confirmed to its owner and is not divided. Unequal division is available only by agreement or in narrow statutory cases (e.g., misappropriation, § 2602).',
      classes: 'Community: all property acquired during marriage while domiciled in California, other than by gift or inheritance (§ 760). Separate: premarital property, gifts and inheritances, rents and profits of separate property (§ 770), and earnings and accumulations after the date of separation (§ 771). Separate-property contributions to community acquisitions are reimbursed without interest under § 2640; post-separation use and payments are addressed through Watts charges and Epstein credits.',
      cutoff: 'The date of separation ends the community estate (§ 70). Assets and liabilities are valued "as near as practicable to the time of trial" (§ 2552(a)); on good cause the court may value an asset at another date — a business dependent on one spouse’s personal skill is commonly valued at separation.',
      standard: 'California is the outlier on goodwill: the goodwill of a professional practice or business, including goodwill that depends on the spouse’s personal skill and reputation, is community property and is divided (In re Marriage of Foster, 42 Cal. App. 3d 577 (1974); In re Marriage of Lopez, 38 Cal. App. 3d 93 (1974); In re Marriage of Golden, 270 Cal. App. 2d 401 (1969)). Valuation methods (excess earnings, capitalization) rather than a hypothetical-sale FMV govern goodwill, and minority or marketability discounts are applied sparingly where no sale is contemplated.',
      goodwillRule: 'all_included',
      taxRule: 'The court will not consider tax consequences unless they are "immediate and specific" — a sale ordered or certain to occur (In re Marriage of Fonstein, 17 Cal. 3d 738 (1976)). Embedded tax on an asset a spouse will keep is ignored at trial. The after-tax schedule is therefore a settlement document in California: what the parties agree to, not what the court will impose.',
      taxLevel: 'immediate_and_specific',
      state: { label: 'California: 9.3%–13.3% (capital gains taxed as ordinary income)',
        ord: (inc) => inc > 1000000 ? 0.133 : inc > 721318 ? 0.123 : inc > 432787 ? 0.113 : inc > 360659 ? 0.103 : inc > 70606 ? 0.093 : 0.08,
        ltcg: (inc) => inc > 1000000 ? 0.133 : inc > 721318 ? 0.123 : inc > 432787 ? 0.113 : inc > 360659 ? 0.103 : inc > 70606 ? 0.093 : 0.08,
        note: 'California taxes capital gains as ordinary income; the 1% mental-health surtax applies above $1 million. Brackets shown are approximate single-filer marginal rates; verify current-year figures.' },
      alimony: 'Temporary support follows local guideline formulas; long-term support is set on the § 4320 factors. Post-2018 spousal support is not deductible or includible federally; California did not conform, so it remains deductible and includible for state purposes — verify current treatment.',
      draftingNotes: [
        'Because the court ignores embedded tax at trial, the tax-effected division has to be negotiated and written into the marital settlement agreement — it will not be imposed.',
        'Date of separation controls which earnings and contributions are community; fix it in the agreement.',
        'Community-property reporting: if the spouses file separately for a year in which they were still married, each generally reports half of the community income earned before separation (§ 66; IRS Publication 555); the agreement should say who bears the tax on income earned during the case.',
        'Personal goodwill is divided in California; a valuation that excludes it (as a Florida or Texas appraiser would) understates the community estate.',
      ],
    },
    TX: {
      name: 'Texas', regime: 'Community property ("just and right" division)',
      cite: 'Tex. Fam. Code §§ 3.001–3.003, 7.001–7.009; Tex. Const. art. XVI, § 15',
      defaultSplit: 0.5, splitLocked: false,
      splitRule: 'The court divides the community estate "in a manner that the court deems just and right" (§ 7.001) — not necessarily equally. Disparity of earning capacity, fault in the breakup, health, education, and the size of each spouse’s separate estate are the Murff factors (Murff v. Murff, 615 S.W.2d 696 (Tex. 1981)). The court cannot divest a spouse of separate property (Eggemeyer v. Eggemeyer, 554 S.W.2d 137 (Tex. 1977)).',
      classes: 'Community: all property acquired during marriage other than separate property (§ 3.002), with a presumption that property possessed at dissolution is community (§ 3.003) that must be rebutted by clear and convincing evidence. Separate: property owned before marriage, acquired by gift, devise or descent, and personal-injury recoveries other than for lost earning capacity (§ 3.001). Character is fixed at inception of title; income from separate property is community.',
      cutoff: 'Assets are generally valued as of the date of divorce (trial), and the community estate runs until the decree — Texas has no legal separation, so acquisitions after the parties part but before the decree are still community.',
      standard: 'Fair market value. Personal goodwill of a professional is not divisible community property (Nail v. Nail, 486 S.W.2d 761 (Tex. 1972)); the enterprise goodwill of the business is. Reimbursement claims between the marital estates are governed by § 3.402.',
      goodwillRule: 'personal_excluded',
      taxRule: 'The court may consider whether a specific asset will be subject to taxation and, if so, when the tax will be paid (§ 7.008, added 2005). Texas is therefore between New York and California: embedded tax is permitted evidence, not a mandatory factor.',
      taxLevel: 'permitted',
      state: { label: 'No state income tax', ord: () => 0, ltcg: () => 0, note: 'Texas has no personal income tax. Federal rates are the whole picture unless a spouse relocates.' },
      alimony: 'Court-ordered "spousal maintenance" is limited (Fam. Code ch. 8): generally a ten-year marriage or family violence, the lesser of $5,000 per month or 20% of gross income, and durational caps. Contractual alimony is unrestricted. Post-2018 alimony is not deductible or includible federally.',
      draftingNotes: [
        'Reimbursement claims (§ 3.402) between separate and community estates are decided at the division; put the agreed reimbursements in the decree.',
        'Because the community runs to the decree, income earned during the case is on the table — address it expressly.',
        'Put the § 7.008 tax evidence in the record: the statute invites it, and a decree that recites the after-tax basis of the division is harder to attack.',
        'Personal goodwill is excluded (Nail); a forensic report that folds it into the business value overstates the community estate.',
      ],
    },
  };

  /* ── Federal 2026 (single filer after divorce) ─────────────────────────────
     Ordinary brackets and the 0/15/20 capital-gain thresholds per Rev. Proc.
     2025-32; NIIT threshold is statutory and unindexed. */
  const ORD_2026_SINGLE = [[12400, .10], [50400, .12], [105700, .22], [201775, .24], [256225, .32], [640600, .35], [Infinity, .37]];
  const ORD_2026_HOH    = [[17700, .10], [67450, .12], [105700, .22], [201750, .24], [256200, .32], [640600, .35], [Infinity, .37]];
  const LTCG_2026 = { single: [49450, 545500], hoh: [66200, 579600] };
  const NIIT_THRESH = { single: 200000, hoh: 200000 };

  function marginalOrd(income, status) {
    const t = status === 'hoh' ? ORD_2026_HOH : ORD_2026_SINGLE;
    for (const [cap, r] of t) if (income <= cap) return r;
    return .37;
  }
  function ltcgRate(income, status) {
    const [z, f] = LTCG_2026[status] || LTCG_2026.single;
    return income <= z ? 0 : income <= f ? .15 : .20;
  }
  function niitRate(income, status) { return income > (NIIT_THRESH[status] || 200000) ? .038 : 0; }

  /* ── Asset model ─────────────────────────────────────────────────────────── */
  const TYPES = {
    cash:      { label: 'Cash & equivalents', basis: false, note: 'No embedded tax.' },
    brokerage: { label: 'Brokerage / securities (taxable)', basis: true, note: 'Unrealized gain taxed at capital-gain rates plus NIIT when sold; basis carries over under § 1041.' },
    home:      { label: 'Marital home', basis: true, note: 'Gain over basis, less § 121 exclusion — $500,000 on a joint return before the decree, $250,000 each after; the § 121(d)(3)(B) grant-of-use clause keeps the out-spouse eligible.' },
    rental:    { label: 'Rental / investment real estate', basis: true, depr: true, note: 'Capital gain plus unrecaptured § 1250 gain on depreciation taken (25% ceiling) plus NIIT; suspended passive losses become basis to the recipient under § 469(j)(6).' },
    retire_pre:{ label: 'Retirement — pre-tax (401(k), traditional IRA, pension)', basis: false, note: 'Every dollar is ordinary income when distributed. A QDRO transfer from a qualified plan is not a taxable event and distributions to the alternate payee avoid the 10% penalty (§ 72(t)(2)(C)); an IRA transfer incident to divorce under § 408(d)(6) is tax-free but later distributions are not penalty-protected.' },
    retire_roth:{ label: 'Retirement — Roth', basis: false, note: 'Qualified distributions are tax-free; no embedded tax if the five-year and age rules will be met.' },
    business:  { label: 'Closely held business interest', basis: true, goodwill: true, note: 'Built-in gain taxed on sale (capital gain, with ordinary components under § 751 or § 1239 for some structures). Goodwill treatment depends on the state — see the jurisdiction panel.' },
    options:   { label: 'Stock options / RSUs (unvested or unexercised)', basis: true, ordinary: true, note: 'The spread is ordinary income (wages) when exercised or vested; under Rev. Rul. 2002-22 the transferee spouse reports it on nonqualified options transferred incident to divorce.' },
    insurance: { label: 'Life insurance cash value', basis: true, ordinary: true, note: 'Cash value over premiums paid is ordinary income on surrender.' },
    personal:  { label: 'Vehicles, art, personal property', basis: false, note: 'Generally no embedded tax (losses on personal-use property are not deductible).' },
    debt:      { label: 'Debt (mortgage, loans, taxes owed)', basis: false, isDebt: true, note: 'Enter as a positive number; it is subtracted. Joint tax liabilities: address who bears them and the § 6015 relief posture.' },
  };

  const DEFAULT_ROWS = [
    { type: 'home', desc: 'Marital home', fmv: 1250000, basis: 650000, sep: 'marital', to: 'A' },
    { type: 'debt', desc: 'Mortgage on marital home', fmv: 400000, basis: 0, sep: 'marital', to: 'A' },
    { type: 'retire_pre', desc: 'His 401(k)', fmv: 900000, basis: 0, sep: 'marital', to: 'B' },
    { type: 'brokerage', desc: 'Joint brokerage account', fmv: 600000, basis: 380000, sep: 'marital', to: 'B' },
    { type: 'business', desc: 'Her consulting practice (S corp)', fmv: 800000, basis: 50000, goodwill: 300000, sep: 'marital', to: 'B' },
    { type: 'cash', desc: 'Checking and savings', fmv: 150000, basis: 0, sep: 'marital', to: 'A' },
    { type: 'rental', desc: 'Rental condo', fmv: 700000, basis: 420000, depr: 110000, spl: 40000, sep: 'marital', to: 'A' },
    { type: 'brokerage', desc: 'Inheritance account (hers)', fmv: 300000, basis: 300000, sep: 'separate_B', to: 'B' },
  ];

  let rows = [];
  let rowSeq = 0;
  const BLANK_ROWS = [{ type: 'home', desc: '', fmv: 0, basis: 0 }, { type: 'retire_pre', desc: '', fmv: 0 }, { type: 'brokerage', desc: '', fmv: 0, basis: 0 }];

  const $ = (id) => document.getElementById(id);
  const money = (n) => (n < 0 ? '-' : '') + '$' + Math.abs(Math.round(n || 0)).toLocaleString('en-US');
  const pct = (n) => (Math.round((n || 0) * 1000) / 10).toFixed(1) + '%';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const numv = (v) => { const n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, '')); return Number.isFinite(n) ? n : 0; };

  /* ── Rows UI ────────────────────────────────────────────────────────────── */
  function typeOptions(sel) {
    return Object.keys(TYPES).map((k) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(TYPES[k].label)}</option>`).join('');
  }
  function renderRows() {
    const host = $('mbs_rows'); if (!host) return;
    const jur = J[$('mbs_jurisdiction').value] || J.FL;
    const sepLabel = jur.regime.indexOf('Community') === 0 ? 'Separate' : 'Nonmarital';
    const commLabel = jur.regime.indexOf('Community') === 0 ? 'Community' : 'Marital';
    host.innerHTML = rows.map((r) => {
      const t = TYPES[r.type] || TYPES.cash;
      return `<div class="mbs-row" data-id="${r.id}">
        <div class="mbs-grid">
          <select data-f="type" aria-label="Asset type">${typeOptions(r.type)}</select>
          <input type="text" data-f="desc" value="${esc(r.desc)}" placeholder="Description" aria-label="Description" />
          <input type="text" inputmode="decimal" data-f="fmv" value="${r.fmv ? Number(r.fmv).toLocaleString('en-US') : ''}" placeholder="${t.isDebt ? 'Balance' : 'Value'}" aria-label="Value" />
          ${t.basis ? `<input type="text" inputmode="decimal" data-f="basis" value="${r.basis ? Number(r.basis).toLocaleString('en-US') : ''}" placeholder="Tax basis" aria-label="Tax basis" />` : '<span class="mbs-na" title="Not applicable to this asset type">n/a</span>'}
          ${t.depr ? `<input type="text" inputmode="decimal" data-f="depr" value="${r.depr ? Number(r.depr).toLocaleString('en-US') : ''}" placeholder="Depreciation taken" aria-label="Depreciation taken" />` : '<span class="mbs-na" title="Rental real estate only">n/a</span>'}
          ${t.goodwill ? `<input type="text" inputmode="decimal" data-f="goodwill" value="${r.goodwill ? Number(r.goodwill).toLocaleString('en-US') : ''}" placeholder="Personal goodwill" aria-label="Personal goodwill included in the value" />` : '<span class="mbs-na" title="Business interests only">n/a</span>'}
          <select data-f="sep" aria-label="Character">
            <option value="marital"${r.sep === 'marital' ? ' selected' : ''}>${commLabel}</option>
            <option value="separate_A"${r.sep === 'separate_A' ? ' selected' : ''}>${sepLabel} — Spouse A</option>
            <option value="separate_B"${r.sep === 'separate_B' ? ' selected' : ''}>${sepLabel} — Spouse B</option>
          </select>
          <select data-f="to" aria-label="Awarded to">
            <option value="A"${r.to === 'A' ? ' selected' : ''}>To A</option>
            <option value="B"${r.to === 'B' ? ' selected' : ''}>To B</option>
            <option value="sell"${r.to === 'sell' ? ' selected' : ''}>Sell &amp; split</option>
          </select>
          <button type="button" class="mbs-del" data-del aria-label="Remove row">&times;</button>
        </div>
        ${t.depr ? `<div class="mbs-sub"><label>Suspended passive losses on this property <input type="text" inputmode="decimal" data-f="spl" value="${r.spl ? Number(r.spl).toLocaleString('en-US') : ''}" placeholder="0" /></label></div>` : ''}
        <div class="mbs-note">${t.note}</div>
      </div>`;
    }).join('');
    host.querySelectorAll('[data-f]').forEach((el) => {
      el.addEventListener('change', onField);
      if (el.tagName === 'INPUT') el.addEventListener('input', onField);
    });
    host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      const id = Number(b.closest('.mbs-row').dataset.id);
      rows = rows.filter((r) => r.id !== id); renderRows(); compute();
    }));
  }
  function onField(e) {
    const el = e.target; const row = rows.find((r) => r.id === Number(el.closest('.mbs-row').dataset.id)); if (!row) return;
    const f = el.dataset.f;
    if (['fmv', 'basis', 'depr', 'goodwill', 'spl'].includes(f)) {
      row[f] = numv(el.value);
      if (e.type === 'change') el.value = row[f] ? row[f].toLocaleString('en-US') : '';
    } else {
      row[f] = el.value;
      if (f === 'type') renderRows();
    }
    compute();
  }
  function addRow(seed) {
    rows.push(Object.assign({ id: ++rowSeq, type: 'cash', desc: '', fmv: 0, basis: 0, depr: 0, goodwill: 0, spl: 0, sep: 'marital', to: 'A' }, seed || {}));
  }

  /* ── Engine ─────────────────────────────────────────────────────────────── */
  function spouseProfile(letter, jur) {
    const income = numv($('mbs_income_' + letter).value);
    const status = $('mbs_status_' + letter).value;
    const nyc = jur.name === 'New York' && $('mbs_nyc_' + letter) && $('mbs_nyc_' + letter).checked;
    const st = jur.state;
    return {
      income, status,
      ord: marginalOrd(income, status), ltcg: ltcgRate(income, status), niit: niitRate(income, status),
      stOrd: st.ord(income) + (nyc ? 0.03876 : 0), stLtcg: st.ltcg(income) + (nyc ? 0.03876 : 0),
    };
  }

  /** Embedded tax for one row in the hands of a given spouse profile. */
  function embeddedTax(r, p, jur, homePlan) {
    const t = TYPES[r.type] || TYPES.cash;
    const fmv = r.fmv || 0, basis = r.basis || 0;
    const out = { tax: 0, detail: '' };
    if (t.isDebt || r.type === 'cash' || r.type === 'personal' || r.type === 'retire_roth') return out;
    if (r.type === 'retire_pre') {
      out.tax = fmv * (p.ord + p.stOrd);
      out.detail = `ordinary ${pct(p.ord + p.stOrd)} on the full balance`;
      return out;
    }
    if (r.type === 'options' || r.type === 'insurance') {
      const spread = Math.max(0, fmv - basis);
      out.tax = spread * (p.ord + p.stOrd);
      out.detail = `ordinary ${pct(p.ord + p.stOrd)} on ${money(spread)}`;
      return out;
    }
    if (r.type === 'home') {
      const gain = Math.max(0, fmv - basis - fmv * 0.06);
      const excl = homePlan === 'joint' ? 500000 : 250000;
      const taxable = Math.max(0, gain - excl);
      out.tax = taxable * (p.ltcg + p.niit + p.stLtcg);
      out.detail = `gain ${money(gain)} after 6% selling costs, less § 121 ${money(excl)} → ${money(taxable)} taxable at ${pct(p.ltcg + p.niit + p.stLtcg)}`;
      return out;
    }
    if (r.type === 'rental') {
      const depr = r.depr || 0, spl = r.spl || 0;
      const totalGain = Math.max(0, fmv - fmv * 0.06 - basis);
      const recap = Math.min(depr, totalGain);
      const capGain = Math.max(0, totalGain - recap - spl);
      out.tax = recap * (Math.min(0.25, p.ord) + p.niit + p.stLtcg) + capGain * (p.ltcg + p.niit + p.stLtcg);
      out.detail = `unrecaptured § 1250 ${money(recap)} at ${pct(Math.min(0.25, p.ord) + p.niit + p.stLtcg)}; capital gain ${money(capGain)} (after ${money(spl)} suspended losses freed as basis) at ${pct(p.ltcg + p.niit + p.stLtcg)}`;
      return out;
    }
    if (r.type === 'business') {
      const gain = Math.max(0, fmv - basis);
      out.tax = gain * (p.ltcg + p.niit + p.stLtcg);
      out.detail = `built-in gain ${money(gain)} at ${pct(p.ltcg + p.niit + p.stLtcg)} (ordinary components under § 751 / § 1239 not modeled)`;
      return out;
    }
    // brokerage and anything else with basis
    const gain = fmv - basis;
    if (gain <= 0) { out.detail = gain < 0 ? `built-in loss ${money(-gain)} (a deduction to the recipient, not modeled as a benefit)` : 'no gain'; return out; }
    out.tax = gain * (p.ltcg + p.niit + p.stLtcg);
    out.detail = `unrealized gain ${money(gain)} at ${pct(p.ltcg + p.niit + p.stLtcg)}`;
    return out;
  }

  function compute() {
    const code = $('mbs_jurisdiction').value; const jur = J[code] || J.FL;
    if (!rows.some((r) => (r.fmv || 0) > 0)) {
      const res0 = $('mbs_results');
      if (res0) { res0.innerHTML = '<p class="mbs-empty">Enter at least one asset with a value to see the after-tax division. Or <button type="button" class="mbs-link" data-load-sample>load a sample estate</button> to see how it reads.</p>'; const b = res0.querySelector('[data-load-sample]'); if (b) b.addEventListener('click', () => { const top = document.querySelector('[data-mbs-sample]'); if (top) top.click(); }); }
      renderJurisdiction(jur);
      return;
    }
    const A = spouseProfile('A', jur), B = spouseProfile('B', jur);
    const homePlan = $('mbs_home_plan').value;
    const splitInput = $('mbs_split'); let split = jur.splitLocked ? 0.5 : Math.min(0.9, Math.max(0.1, numv(splitInput.value) / 100 || jur.defaultSplit));
    if (jur.splitLocked) splitInput.value = '50';

    const lines = [];
    const tot = { A: { gross: 0, tax: 0, net: 0 }, B: { gross: 0, tax: 0, net: 0 }, sepA: 0, sepB: 0, maritalGross: 0, maritalNet: 0, goodwillExcluded: 0 };
    for (const r of rows) {
      const t = TYPES[r.type] || TYPES.cash;
      let value = (t.isDebt ? -1 : 1) * (r.fmv || 0);
      let note = '';
      if (r.type === 'business' && r.goodwill && jur.goodwillRule === 'personal_excluded') {
        value -= r.goodwill; tot.goodwillExcluded += r.goodwill;
        note = `personal goodwill ${money(r.goodwill)} excluded from the marital estate in ${jur.name}`;
      } else if (r.type === 'business' && r.goodwill && jur.goodwillRule === 'all_included') {
        note = `personal goodwill ${money(r.goodwill)} is community property in California`;
      } else if (r.type === 'business' && r.goodwill) {
        note = `personal goodwill ${money(r.goodwill)} — treatment decided case by case in ${jur.name}`;
      }
      const recipients = r.to === 'sell' ? [['A', 0.5], ['B', 0.5]] : [[r.to, 1]];
      for (const [who, share] of recipients) {
        const p = who === 'A' ? A : B;
        // A jointly sold home: the $500,000 joint-return exclusion is $250,000 per half.
        const et = embeddedTax(Object.assign({}, r, { fmv: (r.fmv || 0) * share, basis: (r.basis || 0) * share, depr: (r.depr || 0) * share, spl: (r.spl || 0) * share }), p, jur, r.to === 'sell' ? 'keep' : homePlan);
        const gross = value * share, net = gross - et.tax;
        const isSep = r.sep !== 'marital';
        lines.push({ r, who, share, gross, tax: et.tax, net, detail: et.detail, note, isSep });
        if (isSep) { tot[r.sep === 'separate_A' ? 'sepA' : 'sepB'] += gross; }
        else { tot.maritalGross += gross; tot.maritalNet += net; }
        tot[who].gross += gross; tot[who].tax += et.tax; tot[who].net += net;
      }
    }
    // marital-only totals per spouse (division is of the marital / community estate)
    const mar = { A: { gross: 0, net: 0 }, B: { gross: 0, net: 0 } };
    lines.filter((l) => !l.isSep).forEach((l) => { mar[l.who].gross += l.gross; mar[l.who].net += l.net; });
    const targetA_gross = tot.maritalGross * split, targetA_net = tot.maritalNet * split;
    const eqGross = mar.A.gross - targetA_gross;   // positive: A owes B on a gross basis
    const eqNet = mar.A.net - targetA_net;         // positive: A owes B on an after-tax basis
    // What this run assumed -- stated where a reviewer will look for it
    const assumptions = [];
    if (!A.income) assumptions.push('No post-divorce income entered for Spouse A: their federal rates are the bottom brackets (10% ordinary, 0% capital gain, no NIIT), which understates the tax embedded in every asset awarded to them.');
    if (!B.income) assumptions.push('No post-divorce income entered for Spouse B: same effect \u2014 bottom-bracket rates, embedded tax understated.');
    assumptions.push('Real estate gains are computed after assumed selling costs of 6% of value.');
    if (rows.some((r) => r.type === 'retire_pre' && r.fmv > 0)) assumptions.push('Pre-tax retirement balances are taxed at the recipient\u2019s current ordinary rate on the full balance, as if distributed at once; the value of deferral and any lower bracket in retirement are ignored, which overstates the tax, and the 10% additional tax on early distributions is ignored, which understates it.');
    if (rows.some((r) => r.type === 'home' && r.fmv > 0)) assumptions.push(homePlan === 'keep' ? 'The marital home is assumed to be sold later by the recipient as a single filer with a $250,000 § 121 exclusion, which requires that the recipient meet the two-out-of-five-year use test (or have the grant-of-use clause) at that time.' : 'The marital home is assumed to be sold before the decree on a joint return with the $500,000 § 121 exclusion, which requires both spouses to meet the ownership and use tests.');
    if (rows.some((r) => r.type === 'business' && r.fmv > 0)) assumptions.push('Built-in gain in the business is taxed entirely at capital-gain rates; ordinary-income components (§ 751 hot assets in a partnership, § 1239 depreciable property, cash-basis receivables) are not modeled and would increase the tax.');
    if (rows.some((r) => r.type === 'brokerage' && r.fmv > 0 && r.basis === 0)) assumptions.push('A brokerage line was entered with no basis; the entire value is treated as gain. Enter the basis if it is known.');
    if (!jur.splitLocked && split !== jur.defaultSplit) assumptions.push(`An unequal ${pct(split)} / ${pct(1 - split)} division is modeled; the court would have to justify it on the ${jur.name} statutory factors.`);
    if (rows.some((r) => r.sep !== 'marital')) assumptions.push('Separate property is shown but not divided; whether it is in fact separate (and whether any part has become marital through commingling, appreciation from marital effort, or, in Massachusetts, the all-property rule) is a legal question the tool takes from your entry.');
    render({ jur, A, B, lines, tot, mar, split, targetA_gross, targetA_net, eqGross, eqNet, homePlan, assumptions });
  }

  /* ── Render ─────────────────────────────────────────────────────────────── */
  function render(m) {
    const { jur, A, B, lines, tot, mar, split, eqGross, eqNet, assumptions } = m;
    const res = $('mbs_results'); if (!res) return;
    const who = (w) => w === 'A' ? 'Spouse A' : 'Spouse B';
    const rowsHtml = lines.map((l) => `<tr class="${l.isSep ? 'mbs-sep' : ''}">
      <td>${esc(l.r.desc || TYPES[l.r.type].label)}${l.share < 1 ? ' (½)' : ''}<div class="mbs-cell-note">${esc(l.detail)}${l.note ? ' · ' + esc(l.note) : ''}</div></td>
      <td>${l.isSep ? 'Separate' : 'Marital'}</td>
      <td>${who(l.who)}</td>
      <td class="num">${money(l.gross)}</td>
      <td class="num">${l.tax ? '(' + money(l.tax) + ')' : '—'}</td>
      <td class="num">${money(l.net)}</td>
    </tr>`).join('');
    const leakA = mar.A.gross ? (mar.A.gross - mar.A.net) / mar.A.gross : 0, leakB = mar.B.gross ? (mar.B.gross - mar.B.net) / mar.B.gross : 0;
    const gap = eqNet - eqGross;
    res.innerHTML = `
      ${assumptions && assumptions.length ? `<div class="mbs-assume"><strong>What this run assumed</strong><ul>${assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      <div class="mbs-summary">
        <div class="mbs-card"><div class="mbs-k">Marital estate — before tax</div><div class="mbs-v">${money(tot.maritalGross)}</div><div class="mbs-s">A ${money(mar.A.gross)} · B ${money(mar.B.gross)}</div></div>
        <div class="mbs-card"><div class="mbs-k">Marital estate — after embedded tax</div><div class="mbs-v">${money(tot.maritalNet)}</div><div class="mbs-s">A ${money(mar.A.net)} · B ${money(mar.B.net)}</div></div>
        <div class="mbs-card"><div class="mbs-k">Tax leakage by spouse</div><div class="mbs-v">${pct(leakA)} / ${pct(leakB)}</div><div class="mbs-s">share of each spouse’s gross award that is really tax</div></div>
        <div class="mbs-card mbs-card-hi"><div class="mbs-k">Equalization payment at a ${pct(split)} / ${pct(1 - split)} split</div>
          <div class="mbs-v">${money(Math.abs(eqNet))} <span class="mbs-dir">${eqNet >= 0 ? 'A → B' : 'B → A'}</span></div>
          <div class="mbs-s">on the forensic’s gross schedule it is ${money(Math.abs(eqGross))} ${eqGross >= 0 ? 'A → B' : 'B → A'} — a ${money(Math.abs(gap))} difference the schedule does not show</div></div>
      </div>
      <div class="table-wrap"><table class="mbs-table">
        <thead><tr><th>Asset</th><th>Character</th><th>Awarded to</th><th class="num">Gross value</th><th class="num">Embedded tax</th><th class="num">After-tax value</th></tr></thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr><th colspan="3">Spouse A — all property</th><th class="num">${money(tot.A.gross)}</th><th class="num">(${money(tot.A.tax)})</th><th class="num">${money(tot.A.net)}</th></tr>
          <tr><th colspan="3">Spouse B — all property</th><th class="num">${money(tot.B.gross)}</th><th class="num">(${money(tot.B.tax)})</th><th class="num">${money(tot.B.net)}</th></tr>
        </tfoot>
      </table></div>
      ${tot.goodwillExcluded ? `<p class="mbs-flag"><strong>${jur.name} excludes personal goodwill.</strong> ${money(tot.goodwillExcluded)} of the business value entered is personal goodwill and has been taken out of the marital estate above. A forensic report that includes it overstates what is on the table.</p>` : ''}
      <div class="mbs-two">
        <div><h4>Spouse A after the decree</h4><p>Filing ${A.status === 'hoh' ? 'head of household' : 'single'} on ${money(A.income)}: federal ordinary ${pct(A.ord)}, capital gain ${pct(A.ltcg)}, NIIT ${pct(A.niit)}, state ${pct(A.stLtcg)}.</p></div>
        <div><h4>Spouse B after the decree</h4><p>Filing ${B.status === 'hoh' ? 'head of household' : 'single'} on ${money(B.income)}: federal ordinary ${pct(B.ord)}, capital gain ${pct(B.ltcg)}, NIIT ${pct(B.niit)}, state ${pct(B.stLtcg)}.</p></div>
      </div>
      <h4>What the court in ${jur.name} will do with this</h4>
      <p>${esc(jur.taxRule)}</p>
      <h4>Drafting points for the ${jur.name} agreement</h4>
      <ul>${jur.draftingNotes.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
      <p class="mbs-meth"><strong>Method.</strong> Embedded tax is what each recipient would pay to convert the asset to cash after the decree, at that spouse’s own post-divorce marginal rates (2026 single or head-of-household brackets; 0/15/20% capital-gain thresholds; 3.8% NIIT above the statutory threshold; state rates as described in the jurisdiction panel). Real estate assumes 6% selling costs. Retirement accounts are taxed at the recipient’s ordinary rate on the full balance; the 10% additional tax on early distributions is not modeled (a QDRO alternate payee is exempt under § 72(t)(2)(C); an IRA recipient is not), and the timing value of deferral is ignored, which overstates tax on an account that will be drawn over decades and understates the case for taking the pre-tax asset when the recipient expects a lower bracket later. Basis carries over under § 1041 in every case. Separate property is shown but not divided. This is a negotiating schedule, not a court’s order.</p>`;
    renderJurisdiction(jur);
    res.classList.add('show');
  }
  function renderJurisdiction(jur) {
    const jn = $('mbs_jur_name'); if (jn) jn.textContent = jur.name;
    const jps = $('mbs_print_state'); if (jps) jps.textContent = jur.name;
    const jp = $('mbs_jur_panel'); if (jp) jp.innerHTML = `
      <div class="mbs-jur-grid">
        <div><strong>Regime</strong><p>${esc(jur.regime)} — ${esc(jur.cite)}</p></div>
        <div><strong>How it is divided</strong><p>${esc(jur.splitRule)}</p></div>
        <div><strong>What is on the table</strong><p>${esc(jur.classes)}</p></div>
        <div><strong>Cut-off and valuation date</strong><p>${esc(jur.cutoff)}</p></div>
        <div><strong>Valuation standard and goodwill</strong><p>${esc(jur.standard)}</p></div>
        <div><strong>State income tax layer</strong><p><strong>${esc(jur.state.label)}.</strong> ${esc(jur.state.note)}</p></div>
        <div><strong>Alimony / support interaction</strong><p>${esc(jur.alimony)}</p></div>
      </div>`;
  }

  /* ── Boot ───────────────────────────────────────────────────────────────── */
  function onJurisdiction() {
    const jur = J[$('mbs_jurisdiction').value] || J.FL;
    const splitInput = $('mbs_split'); splitInput.disabled = jur.splitLocked; if (jur.splitLocked) splitInput.value = '50';
    const hint = $('mbs_split_hint'); if (hint) hint.textContent = jur.splitLocked ? 'California requires equal division of community property; the split is fixed at 50/50.' : `Default ${Math.round(jur.defaultSplit * 100)}% to Spouse A. ${jur.name} permits an unequal division on the statutory factors — model it here.`;
    document.querySelectorAll('.mbs-nyc').forEach((el) => { el.style.display = jur.name === 'New York' ? '' : 'none'; });
    renderRows(); compute();
  }
  function init() {
    const host = $('mbs_rows'); if (!host) return;
    BLANK_ROWS.forEach(addRow);
    $('mbs_jurisdiction').addEventListener('change', onJurisdiction);
    ['mbs_income_A', 'mbs_income_B'].forEach((id) => {
      const el = $(id);
      el.addEventListener('input', compute);
      el.addEventListener('change', () => { const n = numv(el.value); el.value = n ? n.toLocaleString('en-US') : ''; compute(); });
    });
    $('mbs_split').addEventListener('input', compute);
    $('mbs_split').addEventListener('change', () => { const n = Math.min(90, Math.max(10, numv($('mbs_split').value) || 50)); $('mbs_split').value = String(Math.round(n * 10) / 10); compute(); });
    ['mbs_status_A', 'mbs_status_B', 'mbs_home_plan'].forEach((id) => $(id).addEventListener('change', compute));
    document.querySelectorAll('.mbs-nyc input').forEach((el) => el.addEventListener('change', compute));
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); else console.warn('[mbs] missing #' + id); };
    on('mbs_add', 'click', () => { addRow({ type: 'brokerage', to: 'A' }); renderRows(); compute(); const last = host.querySelector('.mbs-row:last-child input[data-f="desc"]'); if (last) last.focus(); });
    // the sample loader sits at the top of the tool; a second copy may exist near the rows
    document.querySelectorAll('[data-mbs-sample]').forEach((b) => b.addEventListener('click', () => { rows = []; rowSeq = 0; DEFAULT_ROWS.forEach(addRow); renderRows(); compute(); const r0 = $('mbs_rows'); if (r0 && r0.scrollIntoView) r0.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    on('mbs_reset', 'click', () => {
      rows = []; rowSeq = 0; BLANK_ROWS.forEach(addRow);
      ['mbs_income_A', 'mbs_income_B'].forEach((id) => { $(id).value = ''; });
      $('mbs_split').value = '50'; $('mbs_home_plan').value = 'keep'; $('mbs_status_A').value = 'single'; $('mbs_status_B').value = 'single';
      document.querySelectorAll('.mbs-nyc input').forEach((el) => { el.checked = false; });
      renderRows(); compute();
    });
    on('mbs_print', 'click', () => window.print());
    onJurisdiction();
  }
  const safeInit = () => { try { init(); } catch (e) { console.error('[mbs] init failed', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit); else safeInit();

  if (typeof module !== 'undefined' && module.exports) module.exports = { J, TYPES, marginalOrd, ltcgRate, niitRate, embeddedTax };
})();
