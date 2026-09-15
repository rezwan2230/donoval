/* Divorce Carryforward Allocation (Donovan Legal PLLC divorce suite, 2026-09-05)
 * Tax attributes do not follow the settlement agreement; they follow the
 * regulations. This tool lists the attributes on the last joint return, says
 * where each one goes after the divorce and why, values it in each spouse's
 * hands, and shows what the agreement can and cannot do about it. Educational
 * tool; nothing entered leaves the browser. Hard-navigated; no inline scripts.
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
  const marg = (inc, st) => { for (const [cap, r] of (st === 'hoh' ? ORD_HOH : ORD_SINGLE)) if (inc <= cap) return r; return .37; };
  const ltcg = (inc, st) => { const [z, f] = st === 'hoh' ? [66200, 579600] : [49450, 545500]; return inc <= z ? 0 : inc <= f ? .15 : .20; };

  /* ── The attributes and the rule that allocates each ────────────────────── */
  const ATTR = {
    nol: { label: 'Net operating loss carryforward', kind: 'deduction', rule: 'follows_generator',
      law: 'A net operating loss carried from a joint-return year to a year in which the spouses file separately is allocated to the spouse whose own losses produced it, computed as if separate returns had been filed for the loss year (Reg. § 1.172-7(d)). Post-2017 NOLs carry forward indefinitely and offset up to 80% of taxable income in any year (§ 172(a)(2)). The agreement cannot move the NOL to the other spouse; it can only equalize with other property.' },
    capital: { label: 'Capital loss carryforward', kind: 'capital', rule: 'follows_generator',
      law: 'A capital loss carryover from a joint return is allocated to the spouse who sustained the loss, based on each spouse\u2019s separate net capital loss for the year it arose (Reg. § 1.1212-1(c)(1)(iii)). A jointly owned account\u2019s losses are split by ownership. On a separate or single return the carryover offsets capital gains plus $3,000 of ordinary income a year ($1,500 married filing separately) \u2014 so a large carryover is worth far more to the spouse who will realize gains.' },
    passive: { label: 'Suspended passive activity loss (§ 469)', kind: 'deduction', rule: 'follows_activity',
      law: 'Suspended passive losses attach to the activity that produced them. If the activity stays with the spouse who owns it, the losses stay with that spouse and are freed on disposition or against passive income. If the activity is transferred to the other spouse incident to divorce, § 469(j)(6) does not let either spouse deduct the suspended losses: they are added to the transferee\u2019s basis in the activity and are recovered only through depreciation or on sale. Who keeps the property decides what the losses are worth.' },
    charitable: { label: 'Charitable contribution carryover', kind: 'deduction', rule: 'follows_generator',
      law: 'A charitable carryover from a joint year is allocated between the spouses in proportion to the contributions each would have carried over had separate returns been filed (Reg. § 1.170A-10(d)(4)(i)); a contribution of jointly owned property is split by ownership. Carryovers expire after five years (§ 170(d)(1)), so a spouse who will not itemize loses it.' },
    ftc: { label: 'Foreign tax credit carryover', kind: 'credit', rule: 'follows_generator',
      law: 'Excess foreign taxes carried forward from a joint year are allocated to the spouse whose foreign-source income and taxes produced them (Reg. § 1.904-2(g)); the ten-year carryforward continues in that spouse\u2019s hands (§ 904(c)).' },
    amt: { label: 'Minimum tax credit (prior-year AMT)', kind: 'credit', rule: 'follows_generator',
      law: 'The minimum tax credit from a joint year is allocated to the spouses in proportion to the AMT each would have paid on a separate return (Form 8801 instructions; the regulations give no more specific rule). Verify the allocation with the preparer of the joint-year return.' },
    gbc: { label: 'General business credit carryforward', kind: 'credit', rule: 'follows_business',
      law: 'Business credit carryforwards (§ 39) follow the spouse who owns the trade or business that generated them; where both spouses owned the business, allocate by their interests in the year the credit arose. The spouse who receives the business in the division receives the credits only if that spouse generated them; the credit does not transfer with the business.' },
    qbi: { label: 'Qualified business income loss carryover (§ 199A)', kind: 'other', rule: 'follows_business',
      law: 'A negative QBI amount carried to the next year (§ 199A(c)(2)) follows the spouse who owns the trade or business; it reduces that spouse\u2019s future QBI deduction and is not usable by the other.' },
    ebl: { label: 'Excess business loss disallowed (§ 461(l))', kind: 'deduction', rule: 'follows_generator',
      law: 'An excess business loss disallowed under § 461(l) becomes a net operating loss carryforward in the following year and is then allocated under the NOL rule to the spouse whose business produced it.' },
    invint: { label: 'Investment interest expense carryforward (§ 163(d))', kind: 'deduction', rule: 'follows_generator',
      law: 'Disallowed investment interest carried forward follows the spouse who incurred the interest on debt to carry that spouse\u2019s investments; a joint margin account\u2019s interest is split by ownership. It is deductible only against net investment income in the later year.' },
    s179: { label: '§ 179 carryover (disallowed expensing)', kind: 'deduction', rule: 'follows_business',
      law: 'A § 179 carryover attaches to the taxpayer\u2019s trades or businesses and follows the spouse who owns the business; it is not transferred with the property under § 1041.' },
    basis: { label: 'Basis records and holding period', kind: 'info', rule: 'carryover',
      law: 'Property transferred incident to divorce takes the transferor\u2019s adjusted basis and holding period (§ 1041(b); § 1223(2)), including any built-in loss. The recipient inherits the depreciation schedule, the recapture, and the burden of proving basis; the agreement should require delivery of the records.' },
  };

  const J = {
    FL: { name: 'Florida', note: 'No state income tax; the federal allocation is the whole picture. The attributes are not marital assets a Florida court divides \u2014 they are tax positions that follow the regulations \u2014 but their value to each spouse is a factor the court may weigh under § 61.075(1)(j) and the parties may equalize.' },
    MA: { name: 'Massachusetts', note: 'Massachusetts has its own carryover rules: capital losses carry forward at the state level, net operating losses are not allowed to individuals, and the federal allocation does not automatically produce the same state result. Each attribute\u2019s state treatment should be confirmed.' },
    NY: { name: 'New York', note: 'New York generally follows the federal attributes with its own modifications and its own NOL rules for individuals; the allocation between spouses follows the federal rule. Confirm the state carryover for each attribute.' },
    CA: { name: 'California', note: 'California has its own NOL and capital-loss carryover regimes (California NOLs carry forward twenty years under its own rules; no 80% limit in the same form) and community-property principles that can treat a loss generated during marriage as community for state purposes. The federal allocation controls the federal return; the California allocation should be separately confirmed.' },
    TX: { name: 'Texas', note: 'No state income tax. Community-property principles do not change the federal allocation of tax attributes, which follows the regulations; but a loss generated by community property during the marriage is, for federal purposes on a joint return, still allocated by which spouse\u2019s items produced it.' },
  };

  const DEFAULT_ROWS = [
    { attr: 'nol', amount: 320000, generatedBy: 'B', asset: 'B\u2019s consulting S corp', assetTo: 'B' },
    { attr: 'capital', amount: 140000, generatedBy: 'joint', asset: 'Joint brokerage account', assetTo: 'split' },
    { attr: 'passive', amount: 85000, generatedBy: 'B', asset: 'Rental condo B owned, going to A', assetTo: 'A' },
    { attr: 'charitable', amount: 40000, generatedBy: 'joint', asset: 'Cash gifts from the joint account', assetTo: 'split' },
    { attr: 'basis', amount: 0, generatedBy: 'joint', asset: 'All transferred property', assetTo: 'split' },
  ];
  let rows = []; let seq = 0;
  const BLANK = [{ attr: 'nol', amount: 0, generatedBy: 'B', asset: '', assetTo: 'B' }, { attr: 'capital', amount: 0, generatedBy: 'joint', asset: '', assetTo: 'split' }];
  function addRow(seed) { rows.push(Object.assign({ id: ++seq, attr: 'nol', amount: 0, generatedBy: 'joint', asset: '', assetTo: 'split' }, seed || {})); }

  function renderRows() {
    const host = $('cf_rows'); if (!host) return;
    host.innerHTML = rows.map((r) => `<div class="cf-row" data-id="${r.id}"><div class="cf-grid">
      <select data-f="attr" aria-label="Attribute">${Object.keys(ATTR).map((k) => `<option value="${k}"${k === r.attr ? ' selected' : ''}>${esc(ATTR[k].label)}</option>`).join('')}</select>
      <input type="text" inputmode="decimal" data-f="amount" value="${r.amount ? Number(r.amount).toLocaleString('en-US') : ''}" placeholder="${ATTR[r.attr].kind === 'info' ? 'n/a' : 'Amount'}" aria-label="Amount" ${ATTR[r.attr].kind === 'info' ? 'disabled' : ''} />
      <select data-f="generatedBy" aria-label="Whose items produced it"><option value="A"${r.generatedBy === 'A' ? ' selected' : ''}>Produced by A\u2019s items</option><option value="B"${r.generatedBy === 'B' ? ' selected' : ''}>Produced by B\u2019s items</option><option value="joint"${r.generatedBy === 'joint' ? ' selected' : ''}>Joint / 50-50</option></select>
      <input type="text" data-f="asset" value="${esc(r.asset)}" placeholder="Activity or asset it came from" aria-label="Activity or asset" />
      <select data-f="assetTo" aria-label="Who receives the activity or asset"><option value="A"${r.assetTo === 'A' ? ' selected' : ''}>Asset to A</option><option value="B"${r.assetTo === 'B' ? ' selected' : ''}>Asset to B</option><option value="split"${r.assetTo === 'split' ? ' selected' : ''}>Split / sold</option></select>
      <button type="button" class="cf-del" data-del aria-label="Remove">&times;</button></div></div>`).join('');
    host.querySelectorAll('[data-f]').forEach((el) => { el.addEventListener('change', onField); if (el.tagName === 'INPUT') el.addEventListener('input', onField); });
    host.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => { rows = rows.filter((r) => r.id !== Number(b.closest('.cf-row').dataset.id)); renderRows(); compute(); }));
  }
  function onField(e) { const el = e.target; const row = rows.find((r) => r.id === Number(el.closest('.cf-row').dataset.id)); if (!row) return; const f = el.dataset.f;
    if (f === 'amount') { row.amount = numv(el.value); if (e.type === 'change') el.value = row.amount ? row.amount.toLocaleString('en-US') : ''; } else { row[f] = el.value; if (f === 'attr') renderRows(); } compute(); }

  function inputs() { return { state: ($('cf_state') || {}).value || 'FL', incA: fld('cf_income_a'), incB: fld('cf_income_b'), statusA: ($('cf_status_a') || {}).value || 'single', statusB: ($('cf_status_b') || {}).value || 'single', gainsA: fld('cf_gains_a'), gainsB: fld('cf_gains_b'), itemA: (($('cf_item_a') || {}).value || 'yes') === 'yes', itemB: (($('cf_item_b') || {}).value || 'yes') === 'yes' }; }

  function allocate(r, i) {
    const a = ATTR[r.attr]; let toA = 0, toB = 0, how = '';
    const gen = r.generatedBy === 'joint' ? 0.5 : r.generatedBy === 'A' ? 1 : 0;
    if (a.kind === 'info') return { toA: 0, toB: 0, how: 'Basis and holding period travel with each asset to whoever receives it (§ 1041(b)).', basisNote: true };
    if (a.rule === 'follows_generator') { toA = r.amount * gen; toB = r.amount * (1 - gen); how = r.generatedBy === 'joint' ? 'Produced by joint items: split 50-50 (or by ownership of the account or property).' : `Produced by ${r.generatedBy}\u2019s items: allocated entirely to ${r.generatedBy}, regardless of who receives the asset.`; }
    else if (a.rule === 'follows_business') { const owner = r.generatedBy === 'joint' ? null : r.generatedBy; if (owner) { toA = owner === 'A' ? r.amount : 0; toB = owner === 'B' ? r.amount : 0; how = `Follows the spouse who owned the business that generated it (${owner})${r.assetTo && r.assetTo !== owner && r.assetTo !== 'split' ? ' \u2014 the business is going to ' + r.assetTo + ', but the attribute does not go with it' : ''}.`; } else { toA = toB = r.amount / 2; how = 'Business owned jointly: split by the spouses\u2019 interests in the year it arose (50-50 here).'; } }
    else if (a.rule === 'follows_activity') {
      if (r.assetTo === 'split') { toA = toB = r.amount / 2; how = 'Activity split or sold: the suspended losses are freed on the disposition and taken by each spouse according to ownership.'; }
      else { const owner = r.generatedBy === 'joint' ? r.assetTo : r.generatedBy; if (r.assetTo === owner) { toA = owner === 'A' ? r.amount : 0; toB = owner === 'B' ? r.amount : 0; how = `The activity stays with ${owner}, who owned it: the suspended losses stay with ${owner}, deductible against passive income or on disposition.`; } else { toA = toB = 0; how = `The activity moves from ${owner} to ${r.assetTo} incident to the divorce: under § 469(j)(6) the ${money(r.amount)} of suspended losses is added to ${r.assetTo}\u2019s basis and is deductible by neither spouse \u2014 recovered only through depreciation or on sale.`; return { toA, toB, how, toBasis: r.amount, basisTo: r.assetTo }; } }
    }
    return { toA, toB, how };
  }
  function valueOf(kind, amt, who, i) { if (!amt) return 0; const inc = who === 'A' ? i.incA : i.incB, st = who === 'A' ? i.statusA : i.statusB; if (kind === 'credit') return amt; if (kind === 'capital') { const gains = who === 'A' ? i.gainsA : i.gainsB; const absorbed = Math.min(amt, gains) * ltcg(inc, st) + Math.min(3000, Math.max(0, amt - gains)) * marg(inc, st); return absorbed; } if (kind === 'deduction') return amt * marg(inc, st); return 0; }

  function compute() {
    const i = inputs(); const jur = J[i.state] || J.FL;
    if (!rows.some((r) => r.amount > 0)) { renderEmpty(jur); return; }
    const lines = []; const tot = { A: 0, B: 0, basis: 0 }; const assumptions = [];
    for (const r of rows) { const a = ATTR[r.attr]; const al = allocate(r, i); const vA = valueOf(a.kind, al.toA, 'A', i), vB = valueOf(a.kind, al.toB, 'B', i); lines.push({ r, a, al, vA, vB }); tot.A += vA; tot.B += vB; if (al.toBasis) tot.basis += al.toBasis; }
    if (!i.incA || !i.incB) assumptions.push(`No post-divorce income for ${!i.incA && !i.incB ? 'either spouse' : !i.incA ? 'Spouse A' : 'Spouse B'}: a deduction is valued at the marginal rate, so a blank income values every carryforward to that spouse at the bottom bracket.`);
    if (rows.some((r) => r.attr === 'capital' && r.amount > 0) && !i.gainsA && !i.gainsB) assumptions.push('No expected capital gains entered: a capital loss carryover is valued at $3,000 a year of ordinary offset only. Enter the gains each spouse expects to realize and the value changes sharply.');
    if (rows.some((r) => r.attr === 'charitable' && r.amount > 0) && (!i.itemA || !i.itemB)) assumptions.push(`${!i.itemA && !i.itemB ? 'Neither spouse' : !i.itemA ? 'Spouse A' : 'Spouse B'} is marked as not itemizing after the divorce: a charitable carryover allocated to a non-itemizer is worth nothing and expires in five years.`);
    assumptions.push('Values are first-year, undiscounted, at 2026 single or head-of-household marginal rates on the income entered; the 80% NOL limit, the §\u00a0469 passive-income requirement, the §\u00a0163(d) investment-income requirement, AMT and state treatment are described but not computed. A carryforward is worth what the spouse who holds it can absorb, which the tool estimates and the agreement should equalize.');
    render({ i, jur, lines, tot, assumptions });
  }
  function renderEmpty(jur) { const res = $('cf_results'); if (res) res.innerHTML = '<p class="cf-empty">Enter at least one carryforward to see where it goes. Or <button type="button" class="cf-link" data-load-sample>load a sample</button>.</p>'; const b = res && res.querySelector('[data-load-sample]'); if (b) b.addEventListener('click', loadSample); renderJurisdiction(jur); }
  function render(m) {
    const { i, jur, lines, tot, assumptions } = m; const res = $('cf_results'); if (!res) return;
    res.innerHTML = `
      ${assumptions.length ? `<div class="cf-assume"><strong>What this run assumed</strong><ul>${assumptions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}
      <div class="cf-summary">
        <div class="cf-card cf-card-hi"><div class="cf-k">Value of the attributes after the divorce</div><div class="cf-v">${money(tot.A)} / ${money(tot.B)}</div><div class="cf-s">Spouse A / Spouse B \u2014 the tax each will save, first year, on the attributes the regulations send to them</div></div>
        <div class="cf-card"><div class="cf-k">Lost to § 469(j)(6)</div><div class="cf-v">${money(tot.basis)}</div><div class="cf-s">suspended losses that become basis when an activity moves between spouses \u2014 deductible by neither</div></div>
        <div class="cf-card"><div class="cf-k">The imbalance to equalize</div><div class="cf-v">${money(Math.abs(tot.A - tot.B))}</div><div class="cf-s">${tot.A > tot.B ? 'in A\u2019s favor' : tot.B > tot.A ? 'in B\u2019s favor' : 'none'}; the agreement cannot move the attributes, so it moves other property instead</div></div>
      </div>
      <div class="table-wrap"><table class="cf-table"><thead><tr><th>Attribute</th><th class="num">Amount</th><th>Where it goes, and why</th><th class="num">To A / value</th><th class="num">To B / value</th></tr></thead><tbody>
        ${lines.map((l) => `<tr><td><strong>${esc(l.a.label)}</strong>${l.r.asset ? `<div class="cf-cell-note">${esc(l.r.asset)}</div>` : ''}</td><td class="num">${l.a.kind === 'info' ? '\u2014' : money(l.r.amount)}</td><td>${esc(l.al.how)}</td><td class="num">${l.a.kind === 'info' ? '\u2014' : money(l.al.toA) + '<div class="cf-cell-note">worth ' + money(l.vA) + '</div>'}</td><td class="num">${l.a.kind === 'info' ? '\u2014' : money(l.al.toB) + '<div class="cf-cell-note">worth ' + money(l.vB) + '</div>'}</td></tr>`).join('')}
      </tbody></table></div>
      <h4>The rules, attribute by attribute</h4>
      ${[...new Set(lines.map((l) => l.r.attr))].map((k) => `<p><strong>${esc(ATTR[k].label)}.</strong> ${esc(ATTR[k].law)}</p>`).join('')}
      <h4>What the agreement can and cannot do</h4>
      <p>It cannot assign a carryforward. The regulations allocate each attribute by whose items produced it or which spouse owns the business or activity, and a clause giving the NOL to the other spouse is unenforceable against the IRS. It can do four things: <strong>document</strong> whose items produced each attribute (the separate-return computation the regulations require, done now while the records exist); <strong>equalize</strong> the value with other property, using the after-tax values above rather than face amounts; <strong>decide who keeps the activity</strong> that carries suspended passive losses, knowing that moving it converts the losses to basis; and <strong>require delivery</strong> of the basis, depreciation and carryforward schedules to the spouse who will need them, with a duty to cooperate on the last joint return and any later amendment.</p>
      <h4>${esc(jur.name)}</h4><p>${esc(jur.note)}</p>
      <p class="cf-meth"><strong>Method.</strong> Each attribute is allocated under the rule stated for it. Deductions are valued at the recipient\u2019s 2026 marginal ordinary rate; capital loss carryovers at the capital-gain rate on gains the recipient expects to realize plus the marginal rate on the $3,000 annual ordinary offset; credits at face; suspended losses that move to basis at zero. First-year, undiscounted, federal only; state carryover regimes differ and are described, not computed. This is a planning schedule, not tax advice and not a court\u2019s division.</p>`;
    renderJurisdiction(jur);
  }
  function renderJurisdiction(jur) { const jn = $('cf_jur_name'); if (jn) jn.textContent = jur.name; const jps = $('cf_print_state'); if (jps) jps.textContent = jur.name; const jp = $('cf_jur_panel'); if (jp) jp.innerHTML = `<div class="cf-jur-grid"><div><strong>${esc(jur.name)} and the attributes</strong><p>${esc(jur.note)}</p></div><div><strong>Federal rules in this tool</strong><p>Reg. §§ 1.172-7(d), 1.1212-1(c)(1)(iii), 1.170A-10(d)(4), 1.904-2(g); §§ 469(j)(6), 199A(c)(2), 461(l), 163(d), 179, 39, 1041(b), 1223(2); Form 8801 instructions for the minimum tax credit. As of September 5, 2026.</p></div></div>`; }
  const SAMPLE = { cf_state: 'FL', cf_income_a: '180,000', cf_income_b: '420,000', cf_status_a: 'hoh', cf_status_b: 'single', cf_gains_a: '20,000', cf_gains_b: '150,000', cf_item_a: 'yes', cf_item_b: 'yes' };
  function loadSample() { Object.keys(SAMPLE).forEach((k) => { const el = $(k); if (el) el.value = SAMPLE[k]; }); rows = []; seq = 0; DEFAULT_ROWS.forEach(addRow); renderRows(); compute(); const r = $('cf_rows'); if (r && r.scrollIntoView) r.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function clearAll() { document.querySelectorAll('#cf_form input[type="text"]').forEach((el) => { el.value = ''; }); ['cf_state', 'cf_status_a', 'cf_status_b', 'cf_item_a', 'cf_item_b'].forEach((id) => { const el = $(id); if (el) el.selectedIndex = 0; }); rows = []; seq = 0; BLANK.forEach(addRow); renderRows(); compute(); }
  function init() {
    const form = $('cf_form'); if (!form) return;
    const on = (id, ev, fn) => { const el = $(id); if (el) el.addEventListener(ev, fn); else console.warn('[cf] missing #' + id); };
    BLANK.forEach(addRow);
    form.querySelectorAll('input:not([data-f]), select:not([data-f])').forEach((el) => { el.addEventListener('input', compute); el.addEventListener('change', () => { if (el.dataset.money !== undefined) { const n = numv(el.value); el.value = n && el.value !== '' ? n.toLocaleString('en-US') : ''; } compute(); }); });
    document.querySelectorAll('[data-cf-sample]').forEach((b) => b.addEventListener('click', loadSample));
    on('cf_add', 'click', () => { addRow({ attr: 'passive', generatedBy: 'joint', assetTo: 'A' }); renderRows(); compute(); });
    on('cf_reset', 'click', clearAll); on('cf_print', 'click', () => window.print());
    renderRows(); compute();
  }
  const safeInit = () => { try { init(); } catch (e) { console.error('[cf] init failed', e); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', safeInit); else safeInit();
  if (typeof module !== 'undefined' && module.exports) module.exports = { ATTR, J, allocate, valueOf, marg };
})();
