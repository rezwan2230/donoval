// ── Floating booking widget: click-to-play video ────────────────────────────
// The video sits static behind a poster with a play affordance. A click is a
// user gesture, so playback runs WITH sound — the one thing autoplay can never
// do. Clicking again pauses; when the video ends it resets to the poster. The
// Book CTA beside it is a plain anchor and needs no JS at all.
//
// ── SOFT NAVIGATION ──────────────────────────────────────────────────────────
// The widget lives outside the Swup container (end of <body>), so it survives
// every swap and this module runs ONCE per document. Swup syncs neither <body>
// attributes nor our visibility, so on every swap event the suppress class is
// re-derived from `location.pathname`. The list below mirrors SUPPRESS in
// functions/_lib/book-float-inject.js — keep them identical.
(() => {
  const SUPPRESS_CLASS = 'dl-bf-suppress';
  const SUPPRESS = ['/book', '/book.html', '/engagement', '/engagement.html'];

  const root = document.querySelector('.dl-book-float');
  if (!root) return;
  const btn = root.querySelector('.dl-bf-media');
  const video = root.querySelector('video');
  const play = root.querySelector('.dl-bf-play');
  if (!btn || !video || !play) return;

  const showPlay = (on) => { play.style.opacity = on ? '1' : '0'; };
  const reset = () => {
    try { video.pause(); video.currentTime = 0; } catch (e) { /* not started */ }
    showPlay(true);
    btn.setAttribute('aria-label', 'Play introduction video');
  };

  btn.addEventListener('click', () => {
    if (video.paused) {
      video.muted = false;
      const p = video.play();
      if (p && p.catch) p.catch(() => { /* leave the poster if refused */ });
      showPlay(false);
      btn.setAttribute('aria-label', 'Pause introduction video');
    } else {
      video.pause();
      showPlay(true);
      btn.setAttribute('aria-label', 'Play introduction video');
    }
  });

  video.addEventListener('ended', reset);

  const sync = () => {
    const hide = SUPPRESS.indexOf(location.pathname) !== -1;
    document.body.classList.toggle(SUPPRESS_CLASS, hide);
    if (hide) reset();
  };
  sync();
  document.addEventListener('dl:content-swapped', sync);
  document.addEventListener('perch:content-swapped', sync);
  window.addEventListener('popstate', sync);
})();
