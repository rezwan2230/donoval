// JORDAN-HEADER-UTILITY-BAR — Preview verifier.
//
// Reads the bytes a real Cloudflare Pages Preview serves and checks the six things
// the order asks for. Run:
//
//   node test/preview/verify-header-utility-bar.mjs https://<hash>.donovan-site.pages.dev
//
// Use the PINNED `<hash>.` form, never the branch alias: Pages truncates alias
// hostnames and an alias can serve a stale asset (docs/PERCH-COMMAND-CHANNEL-CALL-TEST.md).
//
// A fresh Preview 404s its assets for up to a minute, so `0 of N` here is a
// propagation smell, not a verdict — re-run before believing it.

import { JSDOM } from 'jsdom';

const base = (process.argv[2] || '').replace(/\/+$/, '');
if (!base) {
  console.error('usage: node test/preview/verify-header-utility-bar.mjs <preview-origin>');
  process.exit(2);
}

/** home, a tool page, and contact — the three the order names, plus two shapes. */
const PAGES = [
  ['/', 'home (router on → the real homepage, not the shell)'],
  ['/tool-firpta-withholding', 'a tool page'],
  ['/contact', 'contact'],
  ['/book', 'the CTA destination itself'],
  ['/blog-irs-levy', 'a blog page (a different body shape)'],
];

const results = [];
let failures = 0;

function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  if (!ok) failures++;
}

async function get(path) {
  const res = await fetch(base + path, { redirect: 'manual', headers: { 'sec-fetch-dest': 'document' } });
  return { res, body: res.status === 200 ? await res.text() : '' };
}

// ── 0. The stylesheet the bar depends on is actually served ───────────────────
{
  const res = await fetch(`${base}/css/dl-utility-bar.css`);
  const css = res.status === 200 ? await res.text() : '';
  check('/css/dl-utility-bar.css is served 200 as text/css',
    res.status === 200 && /text\/css/.test(res.headers.get('content-type') || ''),
    `${res.status} ${res.headers.get('content-type')}`);
  check('…and it defines the bar', css.includes('.dl-ubar-cta'), `${css.length} bytes`);
}

// ── 1-5. Per page ─────────────────────────────────────────────────────────────
for (const [path, label] of PAGES) {
  const { res, body } = await get(path);
  if (res.status !== 200) {
    check(`${path} — 200 (${label})`, false, `${res.status} ${res.headers.get('location') || ''}`);
    continue;
  }
  // A Pages Preview answers a missing route with a 200 "Not Found" page, so
  // status alone proves nothing — assert on the parsed document.
  const doc = new JSDOM(body).window.document;
  const title = (doc.querySelector('title') || {}).textContent || '';
  check(`${path} — 200 and a real document (${label})`, !/^\s*Not Found\s*$/i.test(title), title.slice(0, 60));

  // ── the bar ──
  const bars = doc.querySelectorAll('.dl-ubar');
  check(`${path} — exactly one utility bar`, bars.length === 1, `${bars.length}`);
  if (bars.length !== 1) continue;
  const bar = bars[0];

  check(`${path} — the bar is the first body child`,
    doc.body.firstElementChild === bar,
    doc.body.firstElementChild && doc.body.firstElementChild.tagName);

  const container = doc.querySelector('main#perch-main');
  check(`${path} — the bar is OUTSIDE main#perch-main`,
    !!container && !container.contains(bar), container ? 'container present' : 'NO CONTAINER');

  // ── social: target=_blank ──
  const social = [...bar.querySelectorAll('a')].filter((a) => /^https?:/.test(a.getAttribute('href') || ''));
  check(`${path} — four social links, all target=_blank rel=noopener noreferrer`,
    social.length === 4
      && social.every((a) => a.getAttribute('target') === '_blank')
      && social.every((a) => a.getAttribute('rel') === 'noopener noreferrer'),
    social.map((a) => `${a.getAttribute('title')}:${a.getAttribute('target')}`).join(' '));

  // ── CTA: target=_top, which is what takes the click to the top window ──
  const cta = bar.querySelector('.dl-ubar-cta');
  check(`${path} — CTA → /book with target=_top`,
    !!cta && cta.getAttribute('href') === '/book' && cta.getAttribute('target') === '_top',
    cta ? `${cta.getAttribute('href')} target=${cta.getAttribute('target')}` : 'absent');

  // ── the stylesheet reference ──
  check(`${path} — references /css/dl-utility-bar.css once, in <head>`,
    doc.querySelectorAll('link[href="/css/dl-utility-bar.css"]').length === 1
      && doc.head.querySelector('link[href="/css/dl-utility-bar.css"]') !== null);

  // ── nothing inline was injected into the bar ──
  const inlineOffenders = [bar, ...bar.querySelectorAll('*')]
    .filter((el) => el.hasAttribute('style') || [...el.attributes].some((a) => /^on/i.test(a.name)));
  check(`${path} — the bar carries no style attribute and no on* handler`,
    inlineOffenders.length === 0 && !bar.querySelector('style, script'),
    `${inlineOffenders.length} offenders`);

  // ── CSP: one nonce, and every inline script carries it ──
  const csp = res.headers.get('content-security-policy') || '';
  const declared = (csp.match(/'nonce-([0-9a-f]{32})'/) || [])[1];
  const stamped = new Set([...doc.querySelectorAll('script')]
    .filter((s) => !s.hasAttribute('src'))
    .map((s) => s.getAttribute('nonce')));
  check(`${path} — CSP declares a nonce and every inline script carries exactly it`,
    !!declared && !stamped.has(null) && [...stamped].every((n) => n === declared),
    `declared=${declared ? declared.slice(0, 8) : 'none'}… inline blocks=${stamped.size} distinct`);
  check(`${path} — script-src carries no 'unsafe-inline'`, !/script-src[^;]*unsafe-inline/.test(csp));

  // ── the footer is still there, top AND bottom ──
  const footerSocial = doc.querySelectorAll('.dl-connect .dl-social a');
  const footerCta = doc.querySelector('.dl-connect-cta');
  const callbar = doc.querySelector('.dl-callbar a[href^="tel:"]');
  const hasFooter = doc.querySelector('.dl-connect') !== null;
  if (hasFooter) {
    check(`${path} — footer dl-connect intact: 4 social + click-to-call`,
      footerSocial.length === 4 && !!footerCta && footerCta.getAttribute('href') === 'tel:+15616666022',
      `${footerSocial.length} social, cta=${footerCta && footerCta.getAttribute('href')}`);
    check(`${path} — sticky mobile call bar intact`, !!callbar, callbar && callbar.getAttribute('href'));
    check(`${path} — top and bottom BOTH present`, bars.length === 1 && footerSocial.length === 4);
  } else {
    check(`${path} — (no footer connect block on this page shape)`, true, 'skipped');
  }

  // ── the tel:/mailto: escape is still resolvable on this page ──
  const telLinks = [...doc.querySelectorAll('a[href^="tel:"], a[href^="mailto:"]')];
  if (telLinks.length) {
    const loadsMain = [...doc.querySelectorAll('script[src]')]
      .some((s) => /\/?js\/main\.js$/.test(s.getAttribute('src')));
    check(`${path} — its ${telLinks.length} tel:/mailto: links resolve a _top escape`,
      loadsMain || telLinks.every((a) => a.getAttribute('target') === '_top'),
      loadsMain ? 'via js/main.js sweep' : 'via markup');
  }

  // ── the other injections survived the third head writer ──
  check(`${path} — the persistent layer's tags survived`,
    !!doc.querySelector('link[href="/css/perch-layer.css"]')
      && !!doc.querySelector('script[src="/js/perch-layer.js"]'));
}

// ── report ────────────────────────────────────────────────────────────────────
console.log(`\nJORDAN-HEADER-UTILITY-BAR — Preview verification\n${base}\n`);
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail ? `  — ${r.detail}` : ''}`);
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures ? 1 : 0);
