// 2026 long-term capital gain brackets (IRS Rev. Proc. 2025-32)
const BRACKETS_2026 = {
  single: { zero: 49450, fifteen: 545500 },
  mfj:    { zero: 98900, fifteen: 613700 },
  hoh:    { zero: 66200, fifteen: 579600 },
  mfs:    { zero: 49450, fifteen: 306850 }
};

// NIIT thresholds (statutory, not inflation-adjusted since 2013)
const NIIT_THRESHOLDS = {
  single: 200000,
  mfj:    250000,
  hoh:    200000,
  mfs:    125000
};

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

function calculateCapGains() {
  const status = document.getElementById('filing_status').value;
  const ordIncome = num('ord_income');
  const gain = num('ltcg');
  const niitChoice = document.getElementById('niit').value;

  const br = BRACKETS_2026[status];
  const niitThresh = NIIT_THRESHOLDS[status];
  const totalIncome = ordIncome + gain;

  // Determine how the gain is bracketed
  // The gain "stacks" on top of ordinary income
  let gainAt0 = 0, gainAt15 = 0, gainAt20 = 0;

  // Where the gain starts (top of ordinary income) and ends (top of total income)
  const gainStart = ordIncome;
  const gainEnd = ordIncome + gain;

  // Portion of gain in 0% bracket: up to br.zero
  if (gainStart < br.zero) {
    gainAt0 = Math.min(gainEnd, br.zero) - gainStart;
  }
  // Portion in 15% bracket
  const fifteenStart = Math.max(gainStart, br.zero);
  if (fifteenStart < br.fifteen && gainEnd > br.zero) {
    gainAt15 = Math.min(gainEnd, br.fifteen) - fifteenStart;
  }
  // Portion in 20% bracket
  const twentyStart = Math.max(gainStart, br.fifteen);
  if (gainEnd > br.fifteen) {
    gainAt20 = gainEnd - twentyStart;
  }

  gainAt0 = Math.max(0, gainAt0);
  gainAt15 = Math.max(0, gainAt15);
  gainAt20 = Math.max(0, gainAt20);

  const capGainsTax = (gainAt15 * 0.15) + (gainAt20 * 0.20);

  // NIIT
  let niitTax = 0;
  if (niitChoice === 'apply') {
    niitTax = gain * 0.038;
  } else if (niitChoice === 'auto') {
    if (totalIncome > niitThresh) {
      const niitBase = Math.min(gain, totalIncome - niitThresh);
      niitTax = niitBase * 0.038;
    }
  }
  // 'exempt' = 0

  const totalTax = capGainsTax + niitTax;
  const effRate = gain > 0 ? (totalTax / gain * 100) : 0;

  document.getElementById('total_income').textContent = fmt(totalIncome);
  document.getElementById('gain_0').textContent = fmt(gainAt0);
  document.getElementById('gain_15').textContent = fmt(gainAt15);
  document.getElementById('gain_20').textContent = fmt(gainAt20);
  document.getElementById('capgains_tax').textContent = fmt(capGainsTax);
  document.getElementById('niit_tax').textContent = fmt(niitTax);
  document.getElementById('total_tax').textContent = fmt(totalTax);
  document.getElementById('eff_rate').textContent = effRate.toFixed(2) + '%';

  let note = '';
  if (gain === 0) {
    note = 'No long-term capital gain entered. Enter a positive gain amount to see the calculation.';
  } else if (gainAt20 > 0 && gainAt15 === 0 && gainAt0 === 0) {
    note = 'The entire gain falls in the 20% bracket. Total federal tax on the gain (including NIIT if applicable) approaches 23.8%.';
  } else if (gainAt0 > 0 && gainAt15 === 0 && gainAt20 === 0) {
    note = 'The entire gain falls in the 0% bracket. No federal capital gains tax applies. NIIT may still apply if MAGI exceeds the threshold.';
  } else if (gainAt15 > 0 && gainAt0 === 0 && gainAt20 === 0) {
    note = 'The entire gain falls in the 15% bracket. Total federal tax on the gain (including NIIT if applicable) approaches 18.8%.';
  } else {
    note = 'The gain spans multiple brackets. Each portion is taxed at the rate corresponding to its position when stacked on top of your ordinary taxable income.';
  }
  document.getElementById('result_note').textContent = note;

  const panel = document.getElementById('results');
  panel.classList.add('show');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetCapGains() {
  document.getElementById('ord_income').value = '';
  document.getElementById('ltcg').value = '';
  document.getElementById('filing_status').value = 'single';
  document.getElementById('niit').value = 'auto';
  document.getElementById('results').classList.remove('show');
}
