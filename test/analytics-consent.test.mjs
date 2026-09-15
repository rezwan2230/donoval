// Consent state and the banner (JAY-TRACKING-B2).
//
// The failures worth guarding here are all quiet ones. Consent published in the
// wrong ORDER still "works" — gtag just uses the granted default for the first
// hit of every session and nobody sees an error. A Meta pixel that loads before
// an answer looks identical to one that loaded after. A declined visitor who
// gets re-prompted on every page is a compliance problem that presents as a
// design annoyance. None of these throw, so they are asserted.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  CONSENT_KEY, GRANTED, DENIED, DEFAULT_CONSENT,
  consentUpdate, readConsent, writeConsent, hasAnswered, shouldPrompt, metaAllowed,
} from '../donovan-legal-site/js/analytics/consent.js';
import {
  mountConsentBanner, CONSENT_BANNER_ID, CONSENT_COPY,
} from '../donovan-legal-site/js/analytics/consent-banner.js';

/** A localStorage double, optionally hostile (Safari private mode throws). */
function makeStorage({ throws = false, seed = null } = {}) {
  const map = new Map();
  if (seed) map.set(CONSENT_KEY, seed);
  return {
    getItem: (k) => { if (throws) throw new Error('SecurityError'); return map.has(k) ? map.get(k) : null; },
    setItem: (k, v) => { if (throws) throw new Error('SecurityError'); map.set(k, v); },
    _map: map,
  };
}

describe('consent defaults', () => {
  test('every ad and analytics signal starts denied', () => {
    for (const k of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
      assert.equal(DEFAULT_CONSENT[k], DENIED, `${k} must default denied`);
    }
  });

  test('security_storage stays granted — it is fraud prevention, not tracking', () => {
    assert.equal(DEFAULT_CONSENT.security_storage, GRANTED);
  });

  test('all four Consent Mode v2 signals are present', () => {
    // Omitting ad_user_data or ad_personalization is the classic v2 mistake: it
    // does not error, it just silently loses EEA remarketing eligibility.
    for (const k of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
      assert.ok(k in DEFAULT_CONSENT, `missing ${k}`);
    }
  });

  test('leaves a window for a stored answer to be replayed', () => {
    assert.ok(DEFAULT_CONSENT.wait_for_update > 0);
  });

  test('is frozen, so a caller cannot mutate the default at runtime', () => {
    assert.throws(() => { DEFAULT_CONSENT.ad_storage = GRANTED; }, TypeError);
  });
});

describe('consentUpdate', () => {
  test('accept grants the four ad/analytics signals', () => {
    const u = consentUpdate(true);
    for (const k of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
      assert.equal(u[k], GRANTED);
    }
  });

  test('decline denies them', () => {
    const u = consentUpdate(false);
    for (const k of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
      assert.equal(u[k], DENIED);
    }
  });

  test('never re-sends security_storage or wait_for_update', () => {
    // `wait_for_update` is a default-only key; sending it on an update is a
    // no-op at best and confusing at worst.
    assert.ok(!('wait_for_update' in consentUpdate(true)));
    assert.ok(!('security_storage' in consentUpdate(true)));
  });
});

describe('stored answer', () => {
  test('absent means "has not answered", which is not the same as declined', () => {
    const s = makeStorage();
    assert.equal(readConsent(s), null);
    assert.equal(hasAnswered(s), false);
    assert.equal(shouldPrompt(s), true);
  });

  test('a declined visitor is NOT re-prompted', () => {
    const s = makeStorage({ seed: DENIED });
    assert.equal(shouldPrompt(s), false);
    assert.equal(metaAllowed(s), false);
  });

  test('an accepted visitor is not re-prompted and unlocks Meta', () => {
    const s = makeStorage({ seed: GRANTED });
    assert.equal(shouldPrompt(s), false);
    assert.equal(metaAllowed(s), true);
  });

  test('a corrupted value is treated as no answer, not as consent', () => {
    for (const junk of ['yes', 'true', '1', '', 'GRANTED']) {
      assert.equal(readConsent(makeStorage({ seed: junk })), null, `"${junk}" leaked through`);
      assert.equal(metaAllowed(makeStorage({ seed: junk })), false);
    }
  });

  test('the key carries a version, so re-consent can be forced', () => {
    assert.match(CONSENT_KEY, /\.v\d+$/);
  });

  test('storage that throws degrades to "ask again", never to "granted"', () => {
    // Safari in private mode throws rather than returning null.
    const s = makeStorage({ throws: true });
    assert.equal(readConsent(s), null);
    assert.equal(metaAllowed(s), false);
    assert.equal(writeConsent(s, true), false);
    assert.doesNotThrow(() => shouldPrompt(s));
  });

  test('a null storage (blocked entirely) does not throw', () => {
    assert.equal(readConsent(null), null);
    assert.equal(metaAllowed(null), false);
    assert.equal(shouldPrompt(null), true);
  });
});

describe('the banner', () => {
  let dom, win;
  beforeEach(() => {
    dom = new JSDOM('<!doctype html><body><main id="perch-main"></main></body>', {
      url: 'https://www.donovan.law/',
    });
    win = dom.window;
  });

  test('mounts when the visitor has not answered', () => {
    const bar = mountConsentBanner(win, () => {});
    assert.ok(bar);
    assert.ok(win.document.getElementById(CONSENT_BANNER_ID));
  });

  test('does not mount for someone who already answered — either way', () => {
    for (const answer of [GRANTED, DENIED]) {
      const d = new JSDOM('<!doctype html><body></body>', { url: 'https://www.donovan.law/' });
      d.window.localStorage.setItem(CONSENT_KEY, answer);
      assert.equal(mountConsentBanner(d.window, () => {}), null, `re-prompted after ${answer}`);
    }
  });

  test('mounts on <body>, OUTSIDE the swap container', () => {
    // Inside main#perch-main it would be destroyed by the first soft navigation.
    const bar = mountConsentBanner(win, () => {});
    assert.equal(bar.parentElement, win.document.body);
    assert.equal(bar.closest('#perch-main'), null);
  });

  test('is idempotent — a second call does not stack a second banner', () => {
    mountConsentBanner(win, () => {});
    assert.equal(mountConsentBanner(win, () => {}), null);
    assert.equal(win.document.querySelectorAll(`#${CONSENT_BANNER_ID}`).length, 1);
  });

  test('offers exactly two buttons, Decline first in tab order', () => {
    const bar = mountConsentBanner(win, () => {});
    const buttons = [...bar.querySelectorAll('button')];
    assert.equal(buttons.length, 2);
    assert.equal(buttons[0].textContent, CONSENT_COPY.decline);
    assert.equal(buttons[1].textContent, CONSENT_COPY.accept);
  });

  test('both buttons are real buttons of equal prominence', () => {
    // A decline that is harder to reach than accept is a specific, enforced EU
    // violation. Same element, same classes, no visual demotion.
    const bar = mountConsentBanner(win, () => {});
    const [decline, accept] = bar.querySelectorAll('button');
    assert.equal(decline.tagName, accept.tagName);
    assert.equal(decline.type, 'button');
    assert.equal(decline.className, accept.className);
    assert.equal(decline.getAttribute('style'), accept.getAttribute('style'));
  });

  test('accepting stores GRANTED, removes the bar, and reports true', () => {
    const seen = [];
    const bar = mountConsentBanner(win, (a) => seen.push(a));
    bar.querySelectorAll('button')[1].click();
    assert.deepEqual(seen, [true]);
    assert.equal(win.localStorage.getItem(CONSENT_KEY), GRANTED);
    assert.equal(win.document.getElementById(CONSENT_BANNER_ID), null);
  });

  test('declining stores DENIED, removes the bar, and reports false', () => {
    const seen = [];
    const bar = mountConsentBanner(win, (a) => seen.push(a));
    bar.querySelectorAll('button')[0].click();
    assert.deepEqual(seen, [false]);
    assert.equal(win.localStorage.getItem(CONSENT_KEY), DENIED);
    assert.equal(win.document.getElementById(CONSENT_BANNER_ID), null);
  });

  test('the decision fires once, not once per click', () => {
    const seen = [];
    const bar = mountConsentBanner(win, (a) => seen.push(a));
    const accept = bar.querySelectorAll('button')[1];
    accept.click();
    accept.click();
    assert.deepEqual(seen, [true]);
  });

  test('a throwing callback still dismisses the banner and records the answer', () => {
    const bar = mountConsentBanner(win, () => { throw new Error('downstream'); });
    assert.doesNotThrow(() => bar.querySelectorAll('button')[1].click());
    assert.equal(win.localStorage.getItem(CONSENT_KEY), GRANTED);
    assert.equal(win.document.getElementById(CONSENT_BANNER_ID), null);
  });

  test('carries a labelled landmark, and does not claim to be a dialog', () => {
    // `dialog` implies a focus trap and a modal barrier. This does not block the
    // page, and claiming semantics it does not honour is worse than claiming none.
    const bar = mountConsentBanner(win, () => {});
    assert.equal(bar.getAttribute('role'), 'region');
    assert.ok(bar.getAttribute('aria-label'));
    assert.notEqual(bar.getAttribute('role'), 'dialog');
  });

  test('links to the privacy policy with a resolvable internal href', () => {
    const bar = mountConsentBanner(win, () => {});
    const a = bar.querySelector('a');
    assert.ok(a);
    assert.match(a.getAttribute('href'), /^\//);
    assert.ok(a.textContent.trim().length > 0);
  });

  test('adds no inline event handler attributes (the CSP and CI both refuse them)', () => {
    const bar = mountConsentBanner(win, () => {});
    for (const el of [bar, ...bar.querySelectorAll('*')]) {
      for (const attr of el.getAttributeNames()) {
        assert.ok(!/^on/i.test(attr), `${el.tagName} carries ${attr}`);
      }
    }
  });

  test('injects no <script> of any kind', () => {
    mountConsentBanner(win, () => {});
    assert.equal(win.document.querySelectorAll('script').length, 0);
  });

  test('a focus-visible outline is declared, not just an offset', () => {
    mountConsentBanner(win, () => {});
    const css = win.document.getElementById('dl-consent-style').textContent;
    assert.match(css, /focus-visible\{outline:3px solid/);
  });

  test('mounts nothing when there is no body to mount into', () => {
    const bare = new JSDOM('', { url: 'https://www.donovan.law/' });
    Object.defineProperty(bare.window.document, 'body', { value: null, configurable: true });
    assert.equal(mountConsentBanner(bare.window, () => {}), null);
  });
});

// ── Withdrawal: the control on /disclaimer ───────────────────────────────────
//
// Consent that cannot be withdrawn as easily as it was given is not compliant
// consent, and "clear your browser data" does not count. The page ships the
// control hidden and this module reveals it, so that with ANALYTICS off a
// visitor is never offered a setting that does not exist.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { wireConsentReopen, CONSENT_REOPEN_ID } from '../donovan-legal-site/js/analytics/consent-banner.js';
import { clearConsent } from '../donovan-legal-site/js/analytics/consent.js';

const DISCLAIMER = readFileSync(
  fileURLToPath(new URL('../donovan-legal-site/disclaimer.html', import.meta.url)), 'utf8');

describe('the opt-out control', () => {
  const page = () => new JSDOM(
    `<!doctype html><body><p><button type="button" id="${CONSENT_REOPEN_ID}" hidden>change your cookie choice</button></p></body>`,
    { url: 'https://www.donovan.law/disclaimer' });

  test('is revealed when analytics is running', () => {
    const w = page().window;
    assert.equal(w.document.getElementById(CONSENT_REOPEN_ID).hidden, true);
    wireConsentReopen(w);
    assert.equal(w.document.getElementById(CONSENT_REOPEN_ID).hidden, false);
  });

  test('stays hidden when this module never loads', () => {
    // With ANALYTICS off nothing imports the tracker, so nothing calls
    // wireConsentReopen and the element keeps the `hidden` it shipped with —
    // rather than being a dead control on the firm's policy page.
    const w = page().window;
    assert.equal(w.document.getElementById(CONSENT_REOPEN_ID).hidden, true);
  });

  test('re-opens the banner even for someone who already answered', () => {
    const w = page().window;
    w.localStorage.setItem(CONSENT_KEY, GRANTED);
    wireConsentReopen(w);
    w.document.getElementById(CONSENT_REOPEN_ID).click();
    assert.ok(w.document.getElementById(CONSENT_BANNER_ID), 'the chooser did not come back');
  });

  test('a changed answer reloads, so the page matches the new choice', () => {
    // fbq cannot be recalled once loaded. Reloading is the only honest way to
    // make an accept→decline actually take effect on the page in front of them.
    const w = page().window;
    w.localStorage.setItem(CONSENT_KEY, GRANTED);
    let reloaded = 0;
    wireConsentReopen(w, { reload: () => { reloaded += 1; } });
    w.document.getElementById(CONSENT_REOPEN_ID).click();
    w.document.getElementById(CONSENT_BANNER_ID).querySelectorAll('button')[0].click();
    assert.equal(w.localStorage.getItem(CONSENT_KEY), DENIED);
    assert.equal(reloaded, 1);
  });

  test('an unchanged answer does not reload', () => {
    const w = page().window;
    w.localStorage.setItem(CONSENT_KEY, GRANTED);
    let reloaded = 0;
    wireConsentReopen(w, { reload: () => { reloaded += 1; } });
    w.document.getElementById(CONSENT_REOPEN_ID).click();
    w.document.getElementById(CONSENT_BANNER_ID).querySelectorAll('button')[1].click();
    assert.equal(reloaded, 0);
  });

  test('wiring twice does not double-bind the click', () => {
    const w = page().window;
    wireConsentReopen(w);
    assert.equal(wireConsentReopen(w), null);
  });

  test('is a no-op on a page that ships no control', () => {
    const w = new JSDOM('<!doctype html><body></body>', { url: 'https://www.donovan.law/' }).window;
    assert.doesNotThrow(() => assert.equal(wireConsentReopen(w), null));
  });

  test('clearConsent survives hostile storage', () => {
    assert.equal(clearConsent(makeStorage({ throws: true })), false);
    assert.doesNotThrow(() => clearConsent(null));
  });
});

describe('the disclaimer page ships what the policy promises', () => {
  test('carries the analytics section', () => {
    assert.match(DISCLAIMER, /ANALYTICS AND ADVERTISING MEASUREMENT/);
  });

  test('names both processors and links both policies', () => {
    for (const s of ['Google LLC', 'Meta Platforms', 'policies.google.com/privacy', 'facebook.com/privacy/policy']) {
      assert.ok(DISCLAIMER.includes(s), `disclaimer.html does not mention ${s}`);
    }
  });

  test('states the thing that distinguishes these from Turnstile', () => {
    // Turnstile's paragraph promises no ad use and no cross-site tracking. If
    // this page did not say the opposite for Google and Meta, the omission
    // would read as the same promise.
    assert.match(DISCLAIMER, /may use this information to serve advertisements and to recognize you across other websites/);
  });

  test('ships the opt-out control, hidden, with no inline handler', () => {
    assert.match(DISCLAIMER, new RegExp(`<button[^>]*id="${CONSENT_REOPEN_ID}"[^>]*hidden`));
    const tag = DISCLAIMER.match(new RegExp(`<button[^>]*id="${CONSENT_REOPEN_ID}"[^>]*>`))[0];
    assert.doesNotMatch(tag, /\son[a-z]+=/i, 'inline handlers are refused by the CSP and by CI');
    assert.match(tag, /type="button"/);
  });
});
