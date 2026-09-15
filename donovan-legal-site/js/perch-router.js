// perch-router.js — soft navigation for the multi-page Donovan site.
// WHY: a voice call lives in this page's JS. A full-page reload destroys it.
// This router intercepts internal link clicks and swaps the page content WITHOUT
// a reload, so the widget (#dvn-perch-root) and its live call survive. The perch
// beacon already fires on pushState, so analytics keep working too.
(function () {
  'use strict';
  if (window.__perchRouter) return; window.__perchRouter = true;

  // scripts NOT to re-execute on swap: already-loaded vendors + our own persistent layer
  const SKIP = /perch\.js|perch-router\.js|donovan-widget\.js|vantage\.ticoai\.net|jquery|bootstrap|anime|modernizr|plugins\.js|main\.js|fontawesome|gtag|googletag/i;
  const sameOrigin = (u) => { try { return new URL(u, location.href).origin === location.origin; } catch (e) { return false; } };

  async function softNav(url, push) {
    let html;
    try {
      const r = await fetch(url, { credentials: 'same-origin', headers: { 'X-Perch-Soft': '1' } });
      if (!r.ok) { location.href = url; return; }
      html = await r.text();
    } catch (e) { location.href = url; return; } // any fetch problem → safe hard nav

    const doc = new DOMParser().parseFromString(html, 'text/html');

    // 1) detach the persistent widget so the body swap can't destroy it
    const root = document.getElementById('dvn-perch-root');
    if (root && root.parentNode) root.parentNode.removeChild(root);

    // 2) swap the body content (scripts inserted via innerHTML do NOT auto-run)
    document.body.className = doc.body.className || '';
    document.body.innerHTML = doc.body.innerHTML;

    // 3) re-attach the widget (its JS closure + the live call are untouched)
    if (root) document.body.appendChild(root);

    // 4) update head essentials
    document.title = doc.title || document.title;
    const nc = doc.querySelector('link[rel="canonical"]'), cc = document.querySelector('link[rel="canonical"]');
    if (nc && cc) cc.setAttribute('href', nc.getAttribute('href'));

    // 4b) adopt page scripts the incoming document declares in its <head>.
    //
    // JORDAN-PERCH-A02 (#47). Page behaviour — the booking-gate reveal, the blog
    // filter, the tool engines — used to be inline in <body>, which meant step 5
    // below tried to re-run it. Under the per-request nonce CSP that never worked:
    // a <script> element built here has no nonce, so the browser refuses it. The
    // fix was to move that code to external files referenced from <head>, and the
    // head is NOT swapped — so without this step, soft-navigating INTO /book would
    // never load js/page/booking-gate.js and the reveal would still never run.
    //
    // Externals are admitted by the CSP host allow-list, not by a nonce, so unlike
    // step 5's inline branch this actually executes.
    const loaded = new Set(
      [...document.querySelectorAll('script[src]')].map((s) => s.src)
    );
    doc.head.querySelectorAll('script[src]').forEach((old) => {
      const href = new URL(old.getAttribute('src'), url).href;
      if (SKIP.test(href) || loaded.has(href)) return;
      const s = document.createElement('script');
      for (const a of old.attributes) s.setAttribute(a.name, a.value);
      s.src = href;
      // Dynamically-created scripts default to async, which would let
      // js/page/booking-gate.js run before js/dl-init.js has defined DL.ready.
      // Insertion order is the contract the markup expressed; keep it.
      s.async = false;
      document.head.appendChild(s);
      loaded.add(href);
    });

    // 5) re-run page scripts (inline + page-specific src), skipping vendors + our layer
    //
    // NOTE: the inline branch (`s.textContent = …`) is dead under the nonce CSP and
    // cannot be revived without 'unsafe-inline' or 'strict-dynamic'. It is retained
    // only so a page that somehow still carries an inline block fails the same way
    // it does today rather than differently. test/swap-container.test.mjs asserts
    // the tree has none, which is what actually keeps this path unreachable.
    doc.body.querySelectorAll('script').forEach((old) => {
      const src = old.getAttribute('src') || '';
      if ((src && SKIP.test(src)) || (!src && SKIP.test(old.textContent || ''))) return;
      const s = document.createElement('script');
      for (const a of old.attributes) s.setAttribute(a.name, a.value);
      if (!src) s.textContent = old.textContent;
      else s.async = false; // same ordering contract as 4b
      document.body.appendChild(s);
    });

    // 6) update URL (perch beacon hooks pushState → fires /visit) + scroll
    if (push) history.pushState({ perch: 1 }, '', url);
    const hash = new URL(url, location.href).hash;
    if (hash) { const el = document.getElementById(hash.slice(1)); if (el) el.scrollIntoView(); }
    else window.scrollTo(0, 0);

    // 7) tell already-loaded page scripts the container has new content in it.
    // js/dl-init.js turns this into a re-run of every DL.ready callback — which is
    // how the booking-gate reveal fires on a swap without being re-executed from
    // the fetched markup. Last, so listeners see the final DOM and URL.
    document.dispatchEvent(new CustomEvent('dl:content-swapped', { detail: { url } }));
  }

  document.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest && e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!href || href[0] === '#' || /^(mailto:|tel:|javascript:)/i.test(href)) return;
    if (a.target === '_blank' || a.hasAttribute('download') || a.getAttribute('rel') === 'external') return;
    if (!sameOrigin(href)) return;
    e.preventDefault();
    softNav(new URL(href, location.href).href, true);
  }, true);

  addEventListener('popstate', () => softNav(location.href, false));

  // expose for the widget's page-control (v1.1) to drive navigation through the router
  window.__perchNav = (url) => softNav(new URL(url, location.href).href, true);
})();
