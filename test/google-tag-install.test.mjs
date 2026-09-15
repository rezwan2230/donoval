// JAY-TRACKING-F1 — how the Google tag is installed.
//
// `installGoogleTag` had NO test coverage, and that is how the defect this file
// now guards reached production:
//
//   `send_page_view: false` was set on BOTH the GA4 and the Google Ads config.
//   The comment justified it for GA4 — this is a Swup SPA, so the tracker fires
//   page views itself. But the tracker only sends them to GA4. Google Ads was
//   therefore sent NOTHING except conversion events, and since `booking_confirmed`
//   requires a real booking, no conversion had ever fired. Google Ads had
//   received zero hits, ever.
//
//   Nothing errored. GA4 collected normally. The only symptom was Google Ads
//   reporting the tag as "never detected", four conversion actions stuck on
//   Inactive, and — the expensive part — remarketing audiences that could never
//   accumulate a single user, at any traffic volume.
//
// Every test below asserts a property that, had it existed, would have failed
// on the day that flag was added.

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { installGoogleTag, installMetaPixel }
  from '../donovan-legal-site/js/analytics.js';
import { DEFAULT_TAG_CONFIG }
  from '../donovan-legal-site/js/analytics/events.js';

function mount() {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>',
    { url: 'https://www.donovan.law/' });
  return { win: dom.window, doc: dom.window.document };
}

/** dataLayer entries are `arguments` objects; normalise to arrays. */
const calls = (win) => (win.dataLayer || []).map((a) => Array.from(a));
const configFor = (win, id) =>
  calls(win).find(([kind, target]) => kind === 'config' && target === id);

// ── The defect ──────────────────────────────────────────────────────────────

describe('Google Ads must receive page-level hits', () => {
  let ctx;
  beforeEach(() => { ctx = mount(); });

  test('the Ads config does NOT suppress the automatic page view', () => {
    // THE test in this file. With `send_page_view: false` here, Google Ads
    // receives nothing but conversions — so the tag reads as never detected and
    // no remarketing audience can ever build.
    installGoogleTag(ctx.win, ctx.doc);
    const cfg = configFor(ctx.win, DEFAULT_TAG_CONFIG.ads);
    assert.ok(cfg, 'the Ads id must be configured at all');
    const opts = cfg[2];
    assert.notEqual(opts && opts.send_page_view, false,
      'Ads page view must not be suppressed — it is what builds remarketing audiences');
  });

  test('GA4 DOES suppress it — the tracker owns page views there', () => {
    // The other half of the pair. This site navigates client-side, so gtag's
    // automatic page view fires once per document and never again; the tracker
    // replaces it. Leaving it on would double-count every session's entry page.
    installGoogleTag(ctx.win, ctx.doc);
    assert.equal(configFor(ctx.win, DEFAULT_TAG_CONFIG.ga4)[2].send_page_view, false);
  });

  test('the two streams are configured differently, on purpose', () => {
    // Guards against someone "tidying up" the asymmetry back into a bug.
    installGoogleTag(ctx.win, ctx.doc);
    const ga4 = configFor(ctx.win, DEFAULT_TAG_CONFIG.ga4)[2];
    const ads = configFor(ctx.win, DEFAULT_TAG_CONFIG.ads)[2];
    assert.notDeepEqual(ga4, ads,
      'if these ever match, one of them is wrong — see the header of analytics.js');
  });
});

// ── Consent ordering ────────────────────────────────────────────────────────

describe('Consent Mode v2 ordering', () => {
  test('the default is published BEFORE js and before either config', () => {
    // gtag applies the FIRST default it sees. A default published after
    // `config` is too late, and the session's first hit goes out with storage
    // granted — which is the whole compliance posture, lost silently.
    const { win, doc } = mount();
    installGoogleTag(win, doc);
    const kinds = calls(win).map(([k]) => k);
    assert.equal(kinds[0], 'consent', 'consent must be the very first call');
    assert.ok(kinds.indexOf('consent') < kinds.indexOf('js'));
    assert.ok(kinds.indexOf('consent') < kinds.indexOf('config'));
  });

  test('every ad and analytics signal starts denied', () => {
    const { win, doc } = mount();
    installGoogleTag(win, doc);
    const [, , params] = calls(win).find(([k, m]) => k === 'consent' && m === 'default');
    for (const key of ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage']) {
      assert.equal(params[key], 'denied', `${key} must default to denied`);
    }
  });
});

// ── Loader and tenant config ────────────────────────────────────────────────

describe('the loader', () => {
  test('is fetched with the GA4 id and marked async', () => {
    const { win, doc } = mount();
    installGoogleTag(win, doc);
    const s = doc.querySelector('script[src*="googletagmanager.com/gtag/js"]');
    assert.ok(s, 'the loader must be appended');
    assert.ok(s.src.includes(DEFAULT_TAG_CONFIG.ga4));
    assert.equal(s.async, true);
  });

  test('a second call is a no-op — no duplicate tag, no duplicate consent', () => {
    const { win, doc } = mount();
    installGoogleTag(win, doc);
    const before = calls(win).length;
    installGoogleTag(win, doc);
    assert.equal(calls(win).length, before, 'installing twice must not re-push anything');
    assert.equal(doc.querySelectorAll('script[src*="gtag/js"]').length, 1);
  });

  test('a second tenant is configured with ITS ids, not Donovan\'s', () => {
    const { win, doc } = mount();
    const other = { ga4: 'G-OTHER1234', ads: 'AW-99999999', meta: '5550001112223', labels: {} };
    installGoogleTag(win, doc, other);
    assert.ok(configFor(win, 'G-OTHER1234'));
    assert.ok(configFor(win, 'AW-99999999'));
    assert.equal(configFor(win, DEFAULT_TAG_CONFIG.ads), undefined,
      'Donovan\'s Ads account must not be configured on another firm\'s deployment');
    assert.ok(doc.querySelector('script[src*="G-OTHER1234"]'));
  });

  test('the Ads page view is not suppressed for a second tenant either', () => {
    const { win, doc } = mount();
    installGoogleTag(win, doc, { ga4: 'G-OTHER1234', ads: 'AW-99999999', meta: '1', labels: {} });
    const opts = configFor(win, 'AW-99999999')[2];
    assert.notEqual(opts && opts.send_page_view, false);
  });
});

// ── The Meta pixel, for symmetry ────────────────────────────────────────────

describe('the Meta pixel', () => {
  test('initialises with the dataset and does NOT track its own PageView', () => {
    // Meta's stock snippet ends with fbq('track','PageView'). Copying that in
    // would give the entry page two, because the tracker fires it as well.
    const { win, doc } = mount();
    const fired = [];
    installMetaPixel(win, doc);
    win.fbq.callMethod = (...a) => fired.push(a);
    assert.ok(win.fbq, 'fbq must exist');
    assert.equal(fired.filter(([k, n]) => k === 'track' && n === 'PageView').length, 0);
  });

  test('is idempotent', () => {
    const { win, doc } = mount();
    installMetaPixel(win, doc);
    const first = win.fbq;
    installMetaPixel(win, doc);
    assert.equal(win.fbq, first);
    assert.equal(doc.querySelectorAll('script[src*="fbevents.js"]').length, 1);
  });
});
