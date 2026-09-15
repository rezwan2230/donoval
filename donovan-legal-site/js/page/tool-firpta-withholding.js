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

document.getElementById('situation').addEventListener('change', function() {
  document.getElementById('cert_group').style.display = (this.value === 'certificate') ? 'block' : 'none';
});

function calculateFIRPTA() {
  const salePrice = num('sale_price');
  const situation = document.getElementById('situation').value;

  let rate = 0.15;
  let note = '';

  switch (situation) {
    case 'standard':
      rate = 0.15;
      note = 'Default 15% withholding applies under § 1445(a). The withheld amount is reported on Form 8288 and Form 8288-A within 20 days of closing.';
      break;
    case 'residence_low':
      if (salePrice > 300000) {
        rate = 0.10;
        note = 'The 0% personal-residence rate applies only when the amount realized is $300,000 or less. At this sale price, the 10% rate applies (sale price $300,001–$1,000,000).';
      } else {
        rate = 0;
        note = 'The 0% withholding rate under § 1445(b)(5) requires (i) the property be acquired by the buyer for use as a residence, (ii) the buyer furnish a signed affidavit to that effect, and (iii) the amount realized be $300,000 or less. All three requirements must be satisfied; otherwise the standard 15% rate applies.';
      }
      break;
    case 'residence_mid':
      if (salePrice <= 300000) {
        rate = 0;
        note = 'At this sale price ($300,000 or less), the 0% personal-residence rate applies if the buyer furnishes the affidavit of personal use.';
      } else if (salePrice > 1000000) {
        rate = 0.15;
        note = 'The 10% personal-residence rate applies only when the amount realized is between $300,001 and $1,000,000. Above $1,000,000, the standard 15% rate applies.';
      } else {
        rate = 0.10;
        note = 'The 10% reduced rate applies to personal-residence transactions where the amount realized is between $300,001 and $1,000,000 and the buyer furnishes the affidavit of personal use.';
      }
      break;
    case 'residence_high':
      rate = 0.15;
      note = 'For personal residences with a sale price exceeding $1,000,000, the standard 15% rate applies regardless of the buyer\'s personal-use affidavit.';
      break;
    case 'certificate':
      const certPct = num('cert_rate');
      rate = certPct / 100;
      note = 'A withholding certificate issued under § 1445(c)(3) authorizes withholding at the rate specified in the certificate, which is typically based on the seller\'s estimated U.S. tax liability on the sale rather than on a percentage of the gross sale price. The certificate must be issued by the IRS before the buyer is entitled to withhold at the reduced rate. If the application is pending at closing, withheld funds are typically held in escrow.';
      break;
    case 'exempt':
      rate = 0;
      note = 'No withholding applies if (i) the seller furnishes a verified non-foreign affidavit confirming U.S. person status, (ii) the seller is a qualifying entity that is not a U.S. real property holding corporation, or (iii) another statutory exemption applies. Buyers and closing agents should verify the basis for any claimed exemption.';
      break;
  }

  const withhold = salePrice * rate;
  const netSeller = salePrice - withhold;

  document.getElementById('amt_realized').textContent = fmt(salePrice);
  document.getElementById('rate').textContent = (rate * 100).toFixed(2) + '%';
  document.getElementById('withhold_amt').textContent = fmt(withhold);
  document.getElementById('net_seller').textContent = fmt(netSeller);
  document.getElementById('result_note').textContent = note;

  const panel = document.getElementById('results');
  panel.classList.add('show');
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function resetFIRPTA() {
  document.getElementById('sale_price').value = '';
  document.getElementById('cert_rate').value = '';
  document.getElementById('situation').value = 'standard';
  document.getElementById('cert_group').style.display = 'none';
  document.getElementById('results').classList.remove('show');
}
