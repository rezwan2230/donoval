function fmt(n) {
  if (isNaN(n) || n === null) return '—';
  const sign = n < 0 ? '-' : '';
  const abs = Math.abs(n);
  return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function num(id) {
  const el = document.getElementById(id);
  const raw = (window.DonovanInputFormatter && el) ? DonovanInputFormatter.getValue(el, NaN) : (el ? parseFloat(el.value) : NaN);
  const v = raw;
  return isNaN(v) ? 0 : v;
}

function calculateOIC() {
  const qsv = num('assets_qsv');
  const liab = num('liabilities');
  const income = num('monthly_income');
  const expenses = num('monthly_expenses');
  const offerType = document.getElementById('offer_type').value;

  const nre = Math.max(0, qsv - liab);
  const dmi = Math.max(0, income - expenses);
  const multiplier = (offerType === 'lump') ? 12 : 24;
  const future = dmi * multiplier;
  const rcp = nre + future;

  document.getElementById('r_qsv').textContent = fmt(qsv);
  document.getElementById('r_encumbrance').textContent = fmt(liab);
  document.getElementById('r_nre').textContent = fmt(nre);
  document.getElementById('r_income').textContent = fmt(income);
  document.getElementById('r_expenses').textContent = fmt(expenses);
  document.getElementById('r_dmi').textContent = fmt(dmi);
  document.getElementById('r_multiplier').textContent = multiplier + ' months';
  document.getElementById('r_future').textContent = fmt(future);
  document.getElementById('r_rcp').textContent = fmt(rcp);

  let note = '';
  if (qsv === 0 && income === 0) {
    note = 'Enter your assets and income to see the RCP estimate.';
  } else if (rcp === 0) {
    note = 'The estimated RCP is zero. The IRS will generally not accept an offer of zero, but may consider whether currently-not-collectible (CNC) status is appropriate. Discuss alternatives with qualified counsel.';
  } else if (dmi === 0 && nre > 0) {
    note = 'No disposable monthly income. RCP equals net realizable equity in assets. Lump-sum and periodic-payment offers produce the same RCP in this scenario.';
  } else if (nre === 0 && dmi > 0) {
    note = 'No net realizable equity. RCP equals the future income component (' + multiplier + ' months × DMI). Consider whether a lump-sum offer (12-month multiplier) is more advantageous than a periodic-payment offer (24-month multiplier).';
  } else {
    const lumpRcp = nre + (dmi * 12);
    const periodicRcp = nre + (dmi * 24);
    note = 'Comparison of offer types: lump-sum offer RCP ≈ $' + lumpRcp.toLocaleString() + '; periodic-payment offer RCP ≈ $' + periodicRcp.toLocaleString() + '. A lump-sum offer requires payment within five months and produces a lower minimum offer; a periodic-payment offer is paid over up to 24 months and requires the taxpayer to make payments during IRS evaluation.';
  }
  document.getElementById('result_note').textContent = note;

  const panel = document.getElementById('results');
  panel.classList.add('show');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetOIC() {
  ['assets_qsv','liabilities','monthly_income','monthly_expenses'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('offer_type').value = 'lump';
  document.getElementById('results').classList.remove('show');
}
