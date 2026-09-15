// ── Tools chips ────────────────────────────────────────────────────────────────
//
// 2026-09-06. Three chips at the top of /tools jump to a group and remember the
// choice (localStorage, this device only), so a visitor who came for the
// real-estate tools does not scroll past the divorce set on the next visit.
// Wrapped in DL.ready so it re-binds after a content swap, like blog-filter.js.
// Nothing about the visitor leaves the browser.

DL.ready(function () {
  var chips = document.querySelectorAll('.dl-chip[data-group]');
  if (!chips.length) return;
  var KEY = 'donovan_tools_group';

  function setActive(group) {
    chips.forEach(function (c) { c.classList.toggle('is-active', c.getAttribute('data-group') === group); });
  }
  function jump(group, smooth) {
    var el = document.getElementById(group);
    if (!el) return;
    var top = el.getBoundingClientRect().top + window.pageYOffset - 84;
    if (smooth && 'scrollBehavior' in document.documentElement.style) window.scrollTo({ top: top, behavior: 'smooth' });
    else window.scrollTo(0, top);
  }
  chips.forEach(function (c) {
    c.addEventListener('click', function (e) {
      e.preventDefault();
      var g = c.getAttribute('data-group');
      setActive(g);
      try { localStorage.setItem(KEY, g); } catch (err) { /* private mode */ }
      jump(g, true);
    });
  });
  // On arrival: a remembered group is marked, and jumped to only when the visitor did
  // not arrive with an anchor of their own.
  var remembered = null;
  try { remembered = localStorage.getItem(KEY); } catch (err) { /* private mode */ }
  if (remembered && document.getElementById(remembered)) {
    setActive(remembered);
    if (!location.hash) jump(remembered, false);
  }
});
