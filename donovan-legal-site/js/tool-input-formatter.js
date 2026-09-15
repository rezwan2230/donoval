/* ============================================================================
 * Donovan Legal PLLC — Shared Input Formatter
 * ============================================================================
 * Drop-in utility that formats numeric inputs with thousands separators (for
 * dollar amounts) or percent signs (for rate inputs), and that strips formatting
 * cleanly so calling code can read raw numeric values.
 *
 * Design pattern (proven in the Deal Builder, generalized here):
 *   - On page load, inputs flagged for formatting are converted from
 *     type="number" to type="text" inputmode="decimal" so commas/$/% can render.
 *   - On focus: strip formatting, show raw editable digits, select all.
 *   - On blur: re-apply formatting for readable display.
 *   - input.dataset.rawValue holds the canonical raw value throughout.
 *
 * Usage:
 *   1) Add this script tag once: <script src="js/tool-input-formatter.js"></script>
 *   2) In your tool, after the DOM is ready, call:
 *        DonovanInputFormatter.attachAll();           // auto-discovers by class
 *      or:
 *        DonovanInputFormatter.attachCurrency('rel_fmv');
 *        DonovanInputFormatter.attachPercent('marginal_rate');
 *   3) When reading values, use:
 *        DonovanInputFormatter.getValue('rel_fmv')   // returns numeric or 0
 *      or strip manually:
 *        DonovanInputFormatter.strip(input.value)    // returns string of digits
 *
 * Auto-discovery: any input with class="dl-currency" or class="dl-percent"
 * gets the appropriate formatter attached on attachAll().
 *
 * Compatible with legacy code that calls parseFloat(input.value) directly —
 * the value displayed in the DOM at any moment is human-readable, but the
 * dataset.rawValue is always parseable. For maximum compatibility, callers
 * should prefer DonovanInputFormatter.getValue() which handles both formatted
 * and raw values transparently.
 * ============================================================================ */
(function(global) {
  'use strict';

  function strip(value) {
    if (value === null || value === undefined || value === '') return '';
    return String(value).replace(/[\$,\s%]/g, '').trim();
  }

  function formatCurrency(value) {
    const raw = strip(value);
    if (raw === '' || raw === '-') return '';
    const num = parseFloat(raw);
    if (isNaN(num)) return raw;
    // Display whole dollars; if the raw has decimals, show up to 2.
    const hasDecimal = raw.includes('.');
    const opts = hasDecimal
      ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
      : { maximumFractionDigits: 0 };
    const sign = num < 0 ? '-' : '';
    return sign + '$' + Math.abs(num).toLocaleString('en-US', opts);
  }

  function formatPercent(value) {
    const raw = strip(value);
    if (raw === '' || raw === '-') return '';
    const num = parseFloat(raw);
    if (isNaN(num)) return raw;
    // Trim trailing .00 if present
    const formatted = num.toFixed(2).replace(/\.?0+$/, '');
    return formatted + '%';
  }

  function attachCurrency(input) {
    if (typeof input === 'string') input = document.getElementById(input);
    if (!input || input._dlFmtAttached) return;
    input._dlFmtAttached = true;
    // Switch to text/decimal so commas/dollar sign can render
    input.type = 'text';
    input.setAttribute('inputmode', 'decimal');
    input.classList.add('dl-currency');

    const initialRaw = strip(input.value);
    input.dataset.rawValue = initialRaw;
    if (initialRaw !== '' && !isNaN(parseFloat(initialRaw))) {
      input.value = formatCurrency(initialRaw);
    }

    input.addEventListener('focus', () => {
      const raw = strip(input.value);
      input.dataset.rawValue = raw;
      input.value = raw;
      // Select all so typing replaces — convenient for fast entry
      requestAnimationFrame(() => { try { input.select(); } catch (e) {} });
    });

    input.addEventListener('blur', () => {
      const raw = strip(input.value);
      input.dataset.rawValue = raw;
      if (raw !== '' && !isNaN(parseFloat(raw))) {
        input.value = formatCurrency(raw);
      } else if (raw === '') {
        // leave blank — placeholder shows
        input.value = '';
      }
    });

    input.addEventListener('input', () => {
      input.dataset.rawValue = strip(input.value);
    });
  }

  function attachPercent(input) {
    if (typeof input === 'string') input = document.getElementById(input);
    if (!input || input._dlFmtAttached) return;
    input._dlFmtAttached = true;
    input.type = 'text';
    input.setAttribute('inputmode', 'decimal');
    input.classList.add('dl-percent');

    const initialRaw = strip(input.value);
    input.dataset.rawValue = initialRaw;
    if (initialRaw !== '' && !isNaN(parseFloat(initialRaw))) {
      input.value = formatPercent(initialRaw);
    }

    input.addEventListener('focus', () => {
      const raw = strip(input.value);
      input.dataset.rawValue = raw;
      input.value = raw;
      requestAnimationFrame(() => { try { input.select(); } catch (e) {} });
    });

    input.addEventListener('blur', () => {
      const raw = strip(input.value);
      input.dataset.rawValue = raw;
      if (raw !== '' && !isNaN(parseFloat(raw))) {
        input.value = formatPercent(raw);
      } else if (raw === '') {
        input.value = '';
      }
    });

    input.addEventListener('input', () => {
      input.dataset.rawValue = strip(input.value);
    });
  }

  // Discover and attach formatters automatically based on CSS classes.
  // Inputs marked .dl-currency or .dl-percent get the appropriate treatment.
  function attachAll(root) {
    root = root || document;
    root.querySelectorAll('input.dl-currency').forEach(attachCurrency);
    root.querySelectorAll('input.dl-percent').forEach(attachPercent);
  }

  // Helper for reading the numeric value back from any registered input.
  // Falls back to parseFloat of the visible value for inputs not registered.
  function getValue(idOrEl, defaultValue) {
    if (defaultValue === undefined) defaultValue = 0;
    const el = (typeof idOrEl === 'string') ? document.getElementById(idOrEl) : idOrEl;
    if (!el) return defaultValue;
    const raw = (el.dataset && el.dataset.rawValue !== undefined)
      ? el.dataset.rawValue
      : strip(el.value);
    if (raw === '' || raw === null) return defaultValue;
    const n = parseFloat(raw);
    return isNaN(n) ? defaultValue : n;
  }

  // Public API
  global.DonovanInputFormatter = {
    strip: strip,
    formatCurrency: formatCurrency,
    formatPercent: formatPercent,
    attachCurrency: attachCurrency,
    attachPercent: attachPercent,
    attachAll: attachAll,
    getValue: getValue
  };
})(typeof window !== 'undefined' ? window : this);
