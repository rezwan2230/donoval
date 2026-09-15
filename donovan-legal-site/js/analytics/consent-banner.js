// ── JAY-TRACKING-B2: the consent banner ──────────────────────────────────────
//
// A small bar at the bottom of the page with two equal buttons. Built entirely
// in JS, appended to <body>, styled by a <style> element this module creates.
//
// WHY IT BUILDS ITS OWN DOM RATHER THAN SHIPPING MARKUP
//
// Three repo constraints, and they all point the same way:
//   • No inline <script> in <body> (test/swap-container.test.mjs) and no `on*=`
//     attributes (test/repo-invariants.test.mjs) — so markup with wired handlers
//     is not an option, and the CSP would kill it anyway.
//   • The nav forked across 96 files because chrome was copy-pasted. Adding
//     banner markup to ~130 HTML files would repeat exactly that mistake.
//   • The router swaps `main#perch-main`. Anything inside it is destroyed on the
//     first soft navigation, so the banner is appended to <body> directly —
//     outside the swap container, same reasoning as the persistent layer.
//
// WHY TWO EQUAL BUTTONS
//
// Decline must be as easy as Accept. A decline hidden behind a second click, or
// greyed out beside a bright accept, is a specific and well-enforced EU
// violation. Both buttons here are the same size, same weight, same tab order
// distance, and Decline comes FIRST so it is not the afterthought.

import { shouldPrompt, writeConsent, clearConsent, readConsent } from './consent.js';

const BANNER_ID = 'dl-consent';
const STYLE_ID = 'dl-consent-style';

/** The opt-out control on /disclaimer. Ships hidden; this module reveals it. */
const REOPEN_ID = 'dl-consent-reopen';

const COPY = {
  text: 'We use cookies to understand how visitors use this site and to measure our advertising. Declining does not affect anything on the site.',
  policy: 'Privacy Policy',
  policyHref: '/disclaimer',
  decline: 'Decline',
  accept: 'Accept',
  label: 'Cookie consent',
};

// Colours are taken from the site's own palette rather than invented. The
// contrast pairs below are what the a11y sweep will measure, so they are stated
// once here instead of scattered through the rules.
const CSS = `
#${BANNER_ID}{position:fixed;left:0;right:0;bottom:0;z-index:2147483000;
  background:#0d3b2e;color:#fff;padding:14px 18px;font-size:14px;line-height:1.5;
  display:flex;flex-wrap:wrap;gap:12px 20px;align-items:center;justify-content:center;
  box-shadow:0 -2px 12px rgba(0,0,0,.25)}
#${BANNER_ID} p{margin:0;max-width:62ch}
#${BANNER_ID} a{color:#fff;text-decoration:underline}
#${BANNER_ID} .dl-consent-actions{display:flex;gap:10px;flex:0 0 auto}
#${BANNER_ID} button{font:inherit;font-weight:600;cursor:pointer;
  padding:9px 22px;min-width:118px;border-radius:4px;border:1px solid #fff;
  background:transparent;color:#fff}
#${BANNER_ID} button:hover{background:rgba(255,255,255,.14)}
#${BANNER_ID} button:focus-visible{outline:3px solid #ffd166;outline-offset:2px}
@media (max-width:640px){
  #${BANNER_ID}{flex-direction:column;align-items:stretch;text-align:left}
  #${BANNER_ID} .dl-consent-actions{justify-content:stretch}
  #${BANNER_ID} button{flex:1 1 0}
}
#${REOPEN_ID}{background:none;border:0;padding:0;font:inherit;color:inherit;
  text-decoration:underline;cursor:pointer}
#${REOPEN_ID}:focus-visible{outline:2px solid #0d3b2e;outline-offset:2px}
@media (prefers-reduced-motion:no-preference){
  #${BANNER_ID}{animation:dl-consent-in .18s ease-out}
  @keyframes dl-consent-in{from{transform:translateY(100%)}to{transform:none}}
}`;

function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = CSS;
  doc.head.appendChild(style);
}

/**
 * Show the banner if this visitor has not answered yet.
 *
 * @param {Window} win
 * @param {(accepted:boolean)=>void} onDecision called once, with the answer
 * @returns {HTMLElement|null} the banner, or null when no prompt was needed
 */
export function mountConsentBanner(win, onDecision) {
  const doc = win.document;
  if (!doc || !doc.body) return null;
  if (doc.getElementById(BANNER_ID)) return null;

  let storage = null;
  try { storage = win.localStorage; } catch (e) { storage = null; }
  if (!shouldPrompt(storage)) return null;

  ensureStyle(doc);

  // `role="region"` and not `dialog`: a dialog implies a focus trap and a modal
  // barrier, and this deliberately does not block the page — the site works
  // whether or not the visitor ever answers. Claiming dialog semantics without
  // trapping focus is worse for a screen reader than claiming nothing.
  const bar = doc.createElement('aside');
  bar.id = BANNER_ID;
  bar.setAttribute('role', 'region');
  bar.setAttribute('aria-label', COPY.label);

  const p = doc.createElement('p');
  p.appendChild(doc.createTextNode(COPY.text + ' '));
  const a = doc.createElement('a');
  a.href = COPY.policyHref;
  a.textContent = COPY.policy;
  p.appendChild(a);

  const actions = doc.createElement('div');
  actions.className = 'dl-consent-actions';

  // One decision per banner, enforced rather than assumed. Detaching the bar
  // makes a second click impossible for a person, but the handler is still
  // reachable — and the downstream effects are not harmless to repeat: the
  // callback installs the Meta pixel and pushes a consent update, so a second
  // pass means a second pixel and a duplicated signal.
  let decided = false;
  const finish = (accepted) => {
    if (decided) return;
    decided = true;
    writeConsent(storage, accepted);
    bar.remove();
    try { onDecision(accepted); } catch (e) { /* a bad callback must not strand the UI */ }
  };

  // Decline first in the DOM, so it is first in tab order too.
  for (const [label, accepted] of [[COPY.decline, false], [COPY.accept, true]]) {
    const b = doc.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.addEventListener('click', () => finish(accepted));
    actions.appendChild(b);
  }

  bar.appendChild(p);
  bar.appendChild(actions);
  doc.body.appendChild(bar);
  return bar;
}

/**
 * Wire the "change your cookie choice" control, wherever a page ships one.
 *
 * ── WHY THE PAGE SHIPS IT HIDDEN AND THIS REVEALS IT ────────────────────────
 * The control is only meaningful when analytics is switched on. With ANALYTICS
 * unset this module never loads, so the element stays hidden and a visitor is
 * never offered a setting that does not exist — instead of a dead link on the
 * firm's policy page.
 *
 * ── WHY IT IS WIRED HERE AND NOT IN THE MARKUP ──────────────────────────────
 * `on*=` attributes are refused by both the CSP and CI, disclaimer.html does not
 * load `js/inline-actions.js`, and adding a script tag for one button would trip
 * the router's asset allow-list. This module already loads on every page, so it
 * costs nothing to have it adopt the element.
 *
 * ── WHY IT RELOADS ──────────────────────────────────────────────────────────
 * Withdrawal has to be as effective as it is easy. A visitor who accepted has a
 * Meta pixel on the page, and nothing can unload it — `fbq` cannot be recalled.
 * Reloading is the only honest way to make the page match the new answer, and it
 * is also the simplest thing to reason about: after a change, the page is in
 * exactly the state a first-time visitor with that answer would get.
 */
export function wireConsentReopen(win, { reload } = {}) {
  const doc = win.document;
  const el = doc && doc.getElementById(REOPEN_ID);
  if (!el || el.dataset.dlWired === '1') return null;
  el.dataset.dlWired = '1';

  ensureStyle(doc);
  el.hidden = false;

  el.addEventListener('click', () => {
    let storage = null;
    try { storage = win.localStorage; } catch (e) { storage = null; }
    const before = readConsent(storage);
    clearConsent(storage);
    mountConsentBanner(win, (accepted) => {
      const after = accepted ? 'granted' : 'denied';
      if (after === before) return;
      // Injected so CI can observe it: jsdom's `location` is not redefinable,
      // and a reload seam that cannot be asserted is a reload nobody proved.
      const doReload = reload || (() => win.location.reload());
      try { doReload(); } catch (e) { /* no-op */ }
    });
  });
  return el;
}

export const CONSENT_BANNER_ID = BANNER_ID;
export const CONSENT_REOPEN_ID = REOPEN_ID;
export const CONSENT_COPY = COPY;
