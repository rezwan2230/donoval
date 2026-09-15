// ── Blog topic filter ─────────────────────────────────────────────────────────
//
// JORDAN-PERCH-A02 (#47). Externalised verbatim from the inline <script> that
// sat after js/main.js in blog.html. Logic unchanged; wrapped in DL.ready so it
// re-binds after a content swap, where the buttons are new element objects and
// the listeners bound to the old ones went with them.

DL.ready(function () {
  var btns = document.querySelectorAll('.blog-filter-btn');
  var secs = document.querySelectorAll('.blog-section');
  // Absent on every page but /blog. After a swap this callback still fires.
  if (!btns.length) return;

  function apply(f) {
    secs.forEach(function (sec) {
      var show = (f === 'all') || (sec.getAttribute('data-topic') === f);
      sec.classList.toggle('is-hidden', !show);
    });
    btns.forEach(function (b) {
      b.classList.toggle('is-active', b.getAttribute('data-filter') === f);
    });
    document.querySelectorAll('.blog-post-card.xtag').forEach(function (c) {
      c.classList.toggle('xtag-show', c.getAttribute('data-show') === f);
    });
  }
  btns.forEach(function (b) {
    b.addEventListener('click', function () { apply(b.getAttribute('data-filter')); });
  });
});
