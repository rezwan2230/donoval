/* Donovan Legal Input Formatter — inlined for deployment robustness.
 * Formats <input class="dl-currency"> with $ and commas. Strip on focus, format on blur. */
(function () {
  'use strict';
  function strip(value) {
    if (value === null || value === undefined || value === '') return '';
    return String(value).replace(/[\$,\s%]/g, '').trim();
  }
  function formatCurrency(value) {
    var raw = strip(value);
    if (raw === '' || raw === '-') return '';
    var n = parseFloat(raw);
    if (isNaN(n)) return raw;
    var hasDecimal = raw.indexOf('.') !== -1;
    var opts = hasDecimal ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 };
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(n).toLocaleString('en-US', opts);
  }
  function attachCurrency(input) {
    if (typeof input === 'string') input = document.getElementById(input);
    if (!input || input._dlFmtAttached) return;
    input._dlFmtAttached = true;
    input.type = 'text';
    input.setAttribute('inputmode', 'decimal');
    input.classList.add('dl-currency');
    var initialRaw = strip(input.value);
    input.dataset.rawValue = initialRaw;
    if (initialRaw !== '' && !isNaN(parseFloat(initialRaw))) input.value = formatCurrency(initialRaw);
    input.addEventListener('focus', function () {
      var raw = strip(input.value); input.dataset.rawValue = raw; input.value = raw;
      requestAnimationFrame(function () { try { input.select(); } catch (e) {} });
    });
    input.addEventListener('blur', function () {
      var raw = strip(input.value); input.dataset.rawValue = raw;
      if (raw !== '' && !isNaN(parseFloat(raw))) input.value = formatCurrency(raw);
      else if (raw === '') input.value = '';
    });
    input.addEventListener('input', function () { input.dataset.rawValue = strip(input.value); });
  }
  function attachAll(root) {
    root = root || document;
    var currencyInputs = root.querySelectorAll('input.dl-currency');
    currencyInputs.forEach(attachCurrency);
  }
  function getValue(idOrEl, defaultValue) {
    if (defaultValue === undefined) defaultValue = 0;
    var el = (typeof idOrEl === 'string') ? document.getElementById(idOrEl) : idOrEl;
    if (!el) return defaultValue;
    var raw = (el.dataset && el.dataset.rawValue !== undefined) ? el.dataset.rawValue : strip(el.value);
    if (raw === '' || raw === null) return defaultValue;
    var n = parseFloat(raw);
    return isNaN(n) ? defaultValue : n;
  }
  window.DonovanInputFormatter = {
    strip: strip, formatCurrency: formatCurrency, attachCurrency: attachCurrency,
    attachAll: attachAll, getValue: getValue
  };
  function init() { try { attachAll(); } catch (e) {} }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
