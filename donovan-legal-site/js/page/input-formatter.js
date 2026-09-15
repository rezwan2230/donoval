/* Donovan Legal Input Formatter — inlined for deployment robustness.
   * Formats <input class="dl-currency"> with $ and commas, and
   * <input class="dl-percent"> with % suffix. Strip on focus, format on blur. */
  (function() {
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
      const formatted = num.toFixed(2).replace(/\.?0+$/, '');
      return formatted + '%';
    }
    function attachCurrency(input) {
      if (typeof input === 'string') input = document.getElementById(input);
      if (!input || input._dlFmtAttached) return;
      input._dlFmtAttached = true;
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
        requestAnimationFrame(() => { try { input.select(); } catch (e) {} });
      });
      input.addEventListener('blur', () => {
        const raw = strip(input.value);
        input.dataset.rawValue = raw;
        if (raw !== '' && !isNaN(parseFloat(raw))) {
          input.value = formatCurrency(raw);
        } else if (raw === '') { input.value = ''; }
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
        } else if (raw === '') { input.value = ''; }
      });
      input.addEventListener('input', () => {
        input.dataset.rawValue = strip(input.value);
      });
    }
    function attachAll(root) {
      root = root || document;
      const currencyInputs = root.querySelectorAll('input.dl-currency');
      const percentInputs = root.querySelectorAll('input.dl-percent');
      currencyInputs.forEach(attachCurrency);
      percentInputs.forEach(attachPercent);
      // Visible diagnostic: log how many we attached so a deploy is easy to verify
      try { console.log('[Donovan formatter] attached', currencyInputs.length, 'currency +', percentInputs.length, 'percent inputs'); } catch (e) {}
    }
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
    window.DonovanInputFormatter = {
      strip: strip, formatCurrency: formatCurrency, formatPercent: formatPercent,
      attachCurrency: attachCurrency, attachPercent: attachPercent,
      attachAll: attachAll, getValue: getValue
    };
    // Run attachAll AS SOON AS POSSIBLE — both now (if DOM is ready) and on
    // DOMContentLoaded (if not). Belt and suspenders against script ordering.
    function init() { try { attachAll(); } catch (e) { console.error('[Donovan formatter]', e); } }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  })();
