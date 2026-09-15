/* ============================================================================
 * JORDAN-CRYPTO-MEMO — Crypto Position Memo engine (Diamond & Reserve).
 * Educational digital-asset tax memo. Not legal or tax advice.
 * All tax thresholds are documented, cited figures — none are invented.
 * ========================================================================== */
'use strict';

// ---- Cited reference data --------------------------------------------------
// Form 8938 / IRC §6038D thresholds, by filing status & residence.
// Source: IRS, Instructions for Form 8938 (Rev. November 2021); IRC § 6038D.
var F8938 = {
  single_us:     { lastDay: 50000,  anyTime: 75000,  label: 'Unmarried / MFS, in the U.S.' },
  mfj_us:        { lastDay: 100000, anyTime: 150000, label: 'MFJ, in the U.S.' },
  single_abroad: { lastDay: 200000, anyTime: 300000, label: 'Unmarried / MFS, living abroad' },
  mfj_abroad:    { lastDay: 400000, anyTime: 600000, label: 'MFJ, living abroad' }
};
var F8938_SRC = 'IRC § 6038D; IRS Instructions for Form 8938 (Rev. Nov. 2021)';
// FBAR — aggregate foreign financial accounts over $10,000 at any time in the year.
// Source: 31 CFR § 1010.350(a); FinCEN Form 114.
var FBAR_THRESHOLD = 10000;
var FBAR_SRC = '31 CFR § 1010.350(a); FinCEN Form 114 (FBAR)';

var CUSTODY_LABEL = { self: 'Self-custody wallet', us_ex: 'U.S. exchange', foreign_ex: 'Foreign exchange', wallet: 'Hosted wallet' };
// Per the reporting rules encoded here, foreign-side custody = foreign exchange or hosted wallet.
function isForeign(custody) { return custody === 'foreign_ex' || custody === 'wallet'; }

var positions = [];
var seq = 1;

// ---- Formatting helpers ----------------------------------------------------
function fmt(n) {
  if (n === null || n === undefined || isNaN(n)) return '—';
  var sign = n < 0 ? '-' : '';
  return sign + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}
function num(id) {
  var el = document.getElementById(id);
  if (window.DonovanInputFormatter && el) return DonovanInputFormatter.getValue(el, NaN);
  return el ? parseFloat(el.value) : NaN;
}

// ---- Holding period (character is always "property" per Notice 2014-21) ----
// Long-term requires holding MORE THAN one year (IRC § 1222); the period begins
// the day after acquisition, so the one-year anniversary itself is still short-term.
function holding(acqStr) {
  if (!acqStr) return null;
  var parts = acqStr.split('-');
  if (parts.length !== 3) return null;
  var acq = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
  if (isNaN(acq.getTime())) return null;
  var now = new Date();
  var today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  var days = Math.floor((today - acq) / 86400000);
  var anniv = new Date(Date.UTC(acq.getUTCFullYear() + 1, acq.getUTCMonth(), acq.getUTCDate()));
  var longTerm = today > anniv; // strictly more than one year
  return { days: days, longTerm: longTerm, future: days < 0 };
}
function holdText(h) {
  if (!h) return '—';
  if (h.future) return 'Future-dated';
  var yrs = (h.days / 365.25);
  var dur = h.days < 365 ? (h.days + ' days') : (yrs.toFixed(1) + ' yrs');
  return dur;
}

// ---- Render ----------------------------------------------------------------
function addPosition() {
  var asset = (document.getElementById('asset').value || '').trim();
  var acq = document.getElementById('acq').value;
  var basis = num('basis');
  var fmv = num('fmv');
  var custody = document.getElementById('custody').value;
  if (!asset) { alert('Enter an asset name.'); return; }
  if (!acq) { alert('Enter an acquisition date.'); return; }
  positions.push({
    id: seq++, asset: asset, acq: acq,
    basis: isNaN(basis) ? 0 : basis,
    fmv: isNaN(fmv) ? 0 : fmv,
    custody: custody
  });
  document.getElementById('asset').value = '';
  document.getElementById('acq').value = '';
  document.getElementById('basis').value = '';
  document.getElementById('fmv').value = '';
  document.getElementById('custody').value = 'self';
  render();
}
function delPosition(id) {
  positions = positions.filter(function (p) { return p.id !== id; });
  render();
}

function render() {
  var body = document.getElementById('posBody');
  if (!positions.length) {
    body.innerHTML = '<tr><td colspan="9" class="empty">No positions yet. Add a position above, or load the example.</td></tr>';
    document.getElementById('aggBox').style.display = 'none';
    document.getElementById('flags').innerHTML = '';
    return;
  }
  var rows = positions.map(function (p) {
    var h = holding(p.acq);
    var gl = p.fmv - p.basis;
    var glCls = gl > 0 ? 'gain' : (gl < 0 ? 'loss' : '');
    var glTxt = (gl > 0 ? '+' : '') + fmt(gl);
    var charPill = h && h.longTerm
      ? '<span class="pill lt">Long-term</span>'
      : '<span class="pill st">Short-term</span>';
    var custPill = isForeign(p.custody)
      ? '<span class="pill foreign">Foreign</span>'
      : '<span class="pill dom">Domestic</span>';
    return '<tr>' +
      '<td><b>' + esc(p.asset) + '</b><br><span style="font-size:11px;color:var(--mute2)">Property &mdash; Notice 2014-21</span></td>' +
      '<td>' + esc(p.acq) + '</td>' +
      '<td>' + esc(CUSTODY_LABEL[p.custody]) + '<br>' + custPill + '</td>' +
      '<td class="num">' + fmt(p.basis) + '</td>' +
      '<td class="num">' + fmt(p.fmv) + '</td>' +
      '<td>' + charPill + '</td>' +
      '<td>' + holdText(h) + '</td>' +
      '<td class="num ' + glCls + '">' + glTxt + '</td>' +
      '<td class="no-print"><button class="del" title="Remove" data-dvn-on="click" data-dvn-do="delPosition(' + p.id + ')">×</button></td>' +
      '</tr>';
  }).join('');
  body.innerHTML = rows;
  renderAggregate();
}

function totals() {
  var t = { basis: 0, fmv: 0, gl: 0, foreign: 0 };
  positions.forEach(function (p) {
    t.basis += p.basis; t.fmv += p.fmv; t.gl += (p.fmv - p.basis);
    if (isForeign(p.custody)) t.foreign += p.fmv;
  });
  return t;
}

function renderAggregate() {
  var t = totals();
  document.getElementById('aggBox').style.display = 'grid';
  document.getElementById('aggBasis').textContent = fmt(t.basis);
  document.getElementById('aggFmv').textContent = fmt(t.fmv);
  var gEl = document.getElementById('aggGain');
  gEl.textContent = (t.gl > 0 ? '+' : '') + fmt(t.gl);
  gEl.className = 'v ' + (t.gl > 0 ? 'gain' : (t.gl < 0 ? 'loss' : ''));
  document.getElementById('aggForeign').textContent = fmt(t.foreign);
  renderFlags(t);
}

function renderFlags(t) {
  var profile = document.getElementById('profile').value;
  var band = F8938[profile];
  var f8938On = t.foreign > band.lastDay;
  var fbarOn = t.foreign > FBAR_THRESHOLD;
  var out = '';

  // Form 8938
  out += '<div class="flag ' + (f8938On ? 'on' : 'off') + '">' +
    '<span class="badge">Form 8938 ' + (f8938On ? 'flag' : 'clear') + '</span>' +
    '<div class="ftext">' +
      (f8938On
        ? 'Foreign-held value <b>' + fmt(t.foreign) + '</b> exceeds the reporting threshold of <b>' + fmt(band.lastDay) + '</b> (last day of year) for a ' + esc(band.label) + ' filer. A <b>Form 8938</b> filing obligation may apply under &sect;&nbsp;6038D.'
        : 'Foreign-held value <b>' + fmt(t.foreign) + '</b> is at or below the last-day threshold of <b>' + fmt(band.lastDay) + '</b> for a ' + esc(band.label) + ' filer. No Form 8938 flag on these figures.') +
      ' The alternate &ldquo;any time during the year&rdquo; threshold is <b>' + fmt(band.anyTime) + '</b>. Directly-held self-custody crypto is generally not a specified foreign financial asset.' +
      '<span class="src">' + F8938_SRC + '</span>' +
    '</div></div>';

  // FBAR
  out += '<div class="flag ' + (fbarOn ? 'on' : 'off') + '">' +
    '<span class="badge">FBAR ' + (fbarOn ? 'flag' : 'clear') + '</span>' +
    '<div class="ftext">' +
      (fbarOn
        ? 'Aggregate foreign-held value <b>' + fmt(t.foreign) + '</b> exceeds <b>' + fmt(FBAR_THRESHOLD) + '</b>. An <b>FBAR (FinCEN Form 114)</b> obligation may apply.'
        : 'Aggregate foreign-held value <b>' + fmt(t.foreign) + '</b> does not exceed <b>' + fmt(FBAR_THRESHOLD) + '</b>. No FBAR flag on these figures.') +
      ' An account holding <em>only</em> virtual currency is not currently an FBAR-reportable account (FinCEN Notice 2020-2), though FinCEN has announced intent to amend; confirm the account&rsquo;s contents.' +
      '<span class="src">' + FBAR_SRC + '</span>' +
    '</div></div>';

  document.getElementById('flags').innerHTML = out;
}

// ---- Profile note ----------------------------------------------------------
function updateProfileNote() {
  var band = F8938[document.getElementById('profile').value];
  document.getElementById('profileNote').innerHTML =
    '<b>Form 8938 thresholds for this profile:</b> ' + fmt(band.lastDay) + ' on the last day of the year, or ' +
    fmt(band.anyTime) + ' at any time during the year. Source: ' + F8938_SRC + '. ' +
    '<b>FBAR:</b> ' + fmt(FBAR_THRESHOLD) + ' aggregate (' + FBAR_SRC + ').';
  if (positions.length) renderAggregate();
}

// ---- Printable memo --------------------------------------------------------
function generateMemo() {
  if (!positions.length) {
    var st = document.getElementById('memoStatus');
    st.style.display = 'block';
    st.innerHTML = 'Add at least one position before generating a memo.';
    return;
  }
  var t = totals();
  var profile = document.getElementById('profile').value;
  var band = F8938[profile];
  var f8938On = t.foreign > band.lastDay;
  var fbarOn = t.foreign > FBAR_THRESHOLD;
  var member = (document.getElementById('memberName').value || '').trim();
  var prepared = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

  var rows = positions.map(function (p) {
    var h = holding(p.acq);
    var gl = p.fmv - p.basis;
    return '<tr>' +
      '<td>' + esc(p.asset) + '</td>' +
      '<td>' + esc(p.acq) + '</td>' +
      '<td>' + esc(CUSTODY_LABEL[p.custody]) + (isForeign(p.custody) ? ' (foreign)' : '') + '</td>' +
      '<td>Property</td>' +
      '<td>' + (h && h.longTerm ? 'Long-term' : 'Short-term') + '</td>' +
      '<td class="num">' + fmt(p.basis) + '</td>' +
      '<td class="num">' + fmt(p.fmv) + '</td>' +
      '<td class="num">' + (gl > 0 ? '+' : '') + fmt(gl) + '</td>' +
      '</tr>';
  }).join('');

  var html =
    '<div class="memo">' +
    '<div class="memo-title">Crypto Position Memo &mdash; Educational Summary</div>' +
    '<div class="memo-meta">' + (member ? 'Prepared for: ' + esc(member) + ' &middot; ' : '') +
      'Filing profile: ' + esc(band.label) + ' &middot; Prepared ' + prepared + ' &middot; Donovan Legal PLLC</div>' +

    '<h3>Positions, character &amp; holding period</h3>' +
    '<table><thead><tr><th>Asset</th><th>Acquired</th><th>Custody</th><th>Character</th>' +
      '<th>Holding period</th><th class="num">Basis</th><th class="num">FMV</th><th class="num">Unrealized G/(L)</th></tr></thead>' +
      '<tbody>' + rows + '</tbody></table>' +
    '<p style="font-size:11.5px;color:var(--mute);margin-top:6px">Character: all digital-asset positions are treated as property (IRS Notice 2014-21). ' +
      'Holding period per IRC &sect;&nbsp;1222 &mdash; long-term requires holding more than one year. ' +
      'The wash-sale rule (&sect;&nbsp;1091) applies to stock and securities and does <b>not</b> currently apply to crypto treated as property.</p>' +

    '<h3>Aggregate</h3>' +
    '<table><tbody>' +
      '<tr><td>Total cost basis</td><td class="num">' + fmt(t.basis) + '</td></tr>' +
      '<tr><td>Total fair market value</td><td class="num">' + fmt(t.fmv) + '</td></tr>' +
      '<tr><td>Aggregate unrealized gain / (loss)</td><td class="num">' + (t.gl > 0 ? '+' : '') + fmt(t.gl) + '</td></tr>' +
      '<tr><td>Foreign-held value (foreign exchange or hosted wallet)</td><td class="num">' + fmt(t.foreign) + '</td></tr>' +
    '</tbody></table>' +

    '<h3>Reporting flags</h3>' +
    '<table><tbody>' +
      '<tr><td><b>Form 8938 (&sect;&nbsp;6038D)</b><br><span style="font-size:11px;color:var(--mute)">' + esc(F8938_SRC) + '</span></td>' +
        '<td>' + (f8938On
          ? 'FLAGGED &mdash; foreign-held ' + fmt(t.foreign) + ' exceeds the ' + fmt(band.lastDay) + ' last-day threshold (any-time ' + fmt(band.anyTime) + ') for a ' + esc(band.label) + ' filer.'
          : 'No flag &mdash; foreign-held ' + fmt(t.foreign) + ' is within the ' + fmt(band.lastDay) + ' last-day threshold (any-time ' + fmt(band.anyTime) + ').') + '</td></tr>' +
      '<tr><td><b>FBAR (FinCEN Form 114)</b><br><span style="font-size:11px;color:var(--mute)">' + esc(FBAR_SRC) + '</span></td>' +
        '<td>' + (fbarOn
          ? 'FLAGGED &mdash; aggregate foreign-held ' + fmt(t.foreign) + ' exceeds ' + fmt(FBAR_THRESHOLD) + '.'
          : 'No flag &mdash; aggregate foreign-held ' + fmt(t.foreign) + ' does not exceed ' + fmt(FBAR_THRESHOLD) + '.') +
        ' An account holding only virtual currency is not currently FBAR-reportable (FinCEN Notice 2020-2).</td></tr>' +
    '</tbody></table>' +

    '<div class="disc-block"><b>Not legal or tax advice.</b> This memo is an educational summary prepared for organizational purposes and does not create an attorney&ndash;client relationship. ' +
      'Digital-asset reporting is fact-specific and the figures above depend entirely on the inputs entered. Thresholds are documented IRS and FinCEN sources current as of 2026 and are cited in-line. ' +
      'Confirm every position and figure with Donovan Legal PLLC before filing. &copy; Donovan Legal PLLC 2026. Attorney advertising.</div>' +
    '</div>';

  document.getElementById('memo').innerHTML = html;
  var st2 = document.getElementById('memoStatus');
  st2.style.display = 'block';
  st2.innerHTML = 'Memo generated. Use <b>Print / PDF</b> to save or print the educational summary.';
}

// ---- Utilities -------------------------------------------------------------
function loadExample() {
  positions = [
    { id: seq++, asset: 'BTC', acq: '2021-03-15', basis: 42000, fmv: 96000, custody: 'us_ex' },
    { id: seq++, asset: 'ETH', acq: '2026-02-10', basis: 18000, fmv: 15500, custody: 'foreign_ex' },
    { id: seq++, asset: 'SOL', acq: '2023-06-20', basis: 6000, fmv: 21000, custody: 'wallet' }
  ];
  render();
}
function resetAll() {
  positions = [];
  document.getElementById('memo').innerHTML = '';
  document.getElementById('memoStatus').style.display = 'none';
  render();
}

// ---- Init ------------------------------------------------------------------
document.getElementById('profile').addEventListener('change', updateProfileNote);
updateProfileNote();
render();
