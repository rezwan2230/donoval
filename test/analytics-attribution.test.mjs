// Attribution persistence and conversion value (JAY-TRACKING-C1).
//
// The defect this suite locks shut produced no error and no visible symptom.
// Attribution was read off `location.search` at the moment an event fired, and
// on this site conversions almost never happen on the landing URL — someone
// arrives on /tax-controversy?gclid=…, reads, talks to Paula, and books on
// /book. Every conversion went out with no click id.
//
// Google's own `_gcl_aw` cookie meant the Ads report still looked right, which
// is precisely why nobody would have found it. What it broke is the offline
// import and Meta's server-side matching, both of which read OUR parameters.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import {
  parseAttribution, readStored, merge, captureAttribution, hasClickId,
  ATTRIBUTION_KEY, CLICK_ID_KEYS,
} from '../donovan-legal-site/js/analytics/attribution.js';
import {
  conversionValue, valueParams, TIER_VALUE, MATTER_VALUE, BASELINE_VALUE, VALUE_CURRENCY,
} from '../donovan-legal-site/js/analytics/value.js';
import { createTracker } from '../donovan-legal-site/js/analytics/tracker.js';
import { CATALOGUE, BOOKING_CONFIRMED, CALL_STARTED } from '../donovan-legal-site/js/analytics/events.js';

const ORIGIN = 'https://www.donovan.law';

function mount(url = `${ORIGIN}/`) {
  const dom = new JSDOM('<!doctype html><title>t</title><body></body>', { url });
  const win = dom.window;
  const gtagCalls = [];
  win.gtag = (...a) => gtagCalls.push(a);
  win.fbq = () => {};
  return { win, doc: win.document, gtagCalls };
}

const ga4 = (calls, name) => calls.filter(([k, n]) => k === 'event' && n === name);

describe('parseAttribution', () => {
  test('lifts every click id and utm parameter', () => {
    const got = parseAttribution('?gclid=G&gbraid=GB&wbraid=WB&fbclid=F&msclkid=M&utm_source=s&utm_medium=m&utm_campaign=c&utm_term=t&utm_content=x');
    assert.deepEqual(Object.keys(got).sort(), [
      'fbclid', 'gbraid', 'gclid', 'msclkid', 'utm_campaign', 'utm_content', 'utm_medium', 'utm_source', 'utm_term', 'wbraid',
    ]);
  });

  test('includes gbraid and wbraid — iOS app campaigns send those instead of gclid', () => {
    assert.deepEqual(parseAttribution('?gbraid=ABC'), { gbraid: 'ABC' });
    assert.ok(CLICK_ID_KEYS.includes('wbraid'));
  });

  test('ignores anything that is not attribution, including PII', () => {
    assert.deepEqual(parseAttribution('?gclid=G&email=a@b.com&name=Paul'), { gclid: 'G' });
  });

  test('drops empty values and copes with no query at all', () => {
    assert.deepEqual(parseAttribution('?gclid=&utm_source=s'), { utm_source: 's' });
    assert.deepEqual(parseAttribution(''), {});
    assert.deepEqual(parseAttribution(undefined), {});
  });
});

describe('merge — the precedence rule', () => {
  test('an empty record takes whatever arrives', () => {
    assert.deepEqual(merge({}, { gclid: 'G' }), { gclid: 'G' });
  });

  test('a bare utm link mid-visit does NOT erase the click that paid for it', () => {
    // The whole point. A newsletter link clicked on page four must not overwrite
    // the gclid that bought the visit — that is a conversion credited to the
    // wrong channel, and it looks entirely normal in the report.
    const stored = { gclid: 'PAID', utm_source: 'google' };
    assert.deepEqual(merge(stored, { utm_source: 'newsletter' }), stored);
  });

  test('a genuine second ad click DOES replace it', () => {
    assert.deepEqual(
      merge({ gclid: 'FIRST' }, { gclid: 'SECOND', utm_source: 'google' }),
      { gclid: 'SECOND', utm_source: 'google' },
    );
  });

  test('a page with no parameters changes nothing', () => {
    const stored = { gclid: 'G' };
    assert.deepEqual(merge(stored, {}), stored);
  });

  test('hasClickId distinguishes a paid click from mere tagging', () => {
    assert.equal(hasClickId({ gclid: 'G' }), true);
    assert.equal(hasClickId({ fbclid: 'F' }), true);
    assert.equal(hasClickId({ utm_source: 'newsletter' }), false);
    assert.equal(hasClickId({}), false);
  });
});

describe('storage', () => {
  test('survives a corrupt record rather than throwing', () => {
    const bad = { getItem: () => '{not json', setItem: () => {} };
    assert.deepEqual(readStored(bad), {});
  });

  test('refuses a non-object payload', () => {
    for (const raw of ['[1,2]', '"str"', 'null', '42']) {
      assert.deepEqual(readStored({ getItem: () => raw, setItem: () => {} }), {});
    }
  });

  test('survives storage that throws (Safari private mode)', () => {
    const hostile = { getItem: () => { throw new Error('SecurityError'); }, setItem: () => { throw new Error('x'); } };
    assert.deepEqual(readStored(hostile), {});
    const w = mount().win;
    Object.defineProperty(w, 'localStorage', { value: hostile, configurable: true });
    assert.doesNotThrow(() => captureAttribution(w));
  });
});

describe('captureAttribution', () => {
  test('persists the landing parameters', () => {
    const { win } = mount(`${ORIGIN}/tax-controversy?gclid=ABC&utm_source=google`);
    const got = captureAttribution(win);
    assert.equal(got.gclid, 'ABC');
    assert.deepEqual(JSON.parse(win.localStorage.getItem(ATTRIBUTION_KEY)).gclid, 'ABC');
  });

  test('returns the stored record on a later page with no parameters', () => {
    // THE REGRESSION. Land on an ad, book two pages later.
    const landing = mount(`${ORIGIN}/tax-controversy?gclid=ABC`);
    captureAttribution(landing.win);
    const stored = landing.win.localStorage.getItem(ATTRIBUTION_KEY);

    const booking = mount(`${ORIGIN}/book`);
    booking.win.localStorage.setItem(ATTRIBUTION_KEY, stored);
    assert.equal(captureAttribution(booking.win).gclid, 'ABC');
  });

  test('does not rewrite storage when nothing changed', () => {
    const { win } = mount(`${ORIGIN}/?gclid=ABC`);
    captureAttribution(win);
    let writes = 0;
    const real = win.localStorage.getItem(ATTRIBUTION_KEY);
    Object.defineProperty(win, 'localStorage', {
      value: { getItem: () => real, setItem: () => { writes += 1; } }, configurable: true,
    });
    captureAttribution(win);
    assert.equal(writes, 0, 'a twenty-page visit must not perform twenty writes');
  });
});

describe('conversion value', () => {
  test('tier ranks in the order the firm\'s own taxonomy asserts', () => {
    assert.ok(TIER_VALUE.reserve > TIER_VALUE.diamond);
    assert.ok(TIER_VALUE.diamond > TIER_VALUE.platinum);
    assert.ok(TIER_VALUE.platinum > TIER_VALUE.gold);
    assert.ok(TIER_VALUE.gold > BASELINE_VALUE);
  });

  test('tier wins over matter — it is the richer signal', () => {
    assert.equal(conversionValue({ tier: 'reserve', matter: 'other' }), TIER_VALUE.reserve);
  });

  test('matter is the fallback when no tier was derived', () => {
    assert.equal(conversionValue({ matter: 'tax' }), MATTER_VALUE.tax);
  });

  test('an unclassified booking gets the baseline, never zero', () => {
    // A zero-valued conversion is worse than no value: value-based bidding reads
    // it as "worthless" and learns to avoid whatever produced it.
    assert.equal(conversionValue({}), BASELINE_VALUE);
    assert.equal(conversionValue(), BASELINE_VALUE);
    assert.ok(conversionValue({ tier: 'nonsense' }) > 0);
  });

  test('tolerates casing and stray whitespace from the qualifier', () => {
    assert.equal(conversionValue({ tier: ' Reserve ' }), TIER_VALUE.reserve);
    assert.equal(conversionValue({ matter: 'TAX' }), MATTER_VALUE.tax);
  });

  test('does not resolve inherited Object properties as tiers', () => {
    assert.equal(conversionValue({ tier: 'constructor' }), BASELINE_VALUE);
    assert.equal(conversionValue({ matter: 'toString' }), BASELINE_VALUE);
  });

  test('valueParams carries a currency alongside the number', () => {
    assert.deepEqual(valueParams({ tier: 'gold' }), { value: TIER_VALUE.gold, currency: VALUE_CURRENCY });
  });

  test('the tables are frozen — a caller cannot reprice a tier at runtime', () => {
    assert.throws(() => { TIER_VALUE.reserve = 1; }, TypeError);
  });
});

describe('the tracker, end to end', () => {
  test('a conversion on a later page still carries the landing click id', () => {
    const landing = mount(`${ORIGIN}/tax-controversy?gclid=ABC&utm_source=google`);
    createTracker(landing).start();
    const stored = landing.win.localStorage.getItem(ATTRIBUTION_KEY);

    const booking = mount(`${ORIGIN}/book`);
    booking.win.localStorage.setItem(ATTRIBUTION_KEY, stored);
    const t = createTracker(booking).start();
    t.emit(CALL_STARTED);

    const params = ga4(booking.gtagCalls, CALL_STARTED)[0][2];
    assert.equal(params.gclid, 'ABC', 'the click id was lost between landing and conversion');
    assert.equal(params.utm_source, 'google');
  });

  test('a booking carries a value derived from the qualifier', () => {
    const ctx = mount(`${ORIGIN}/`);
    createTracker(ctx).start();
    ctx.win.dispatchEvent(new ctx.win.CustomEvent('dl:qualifier-submitted', { detail: { matter: 'tax' } }));
    ctx.win.dispatchEvent(new ctx.win.MessageEvent('message', {
      data: { __perchBooking: 'confirmed' }, origin: ORIGIN,
    }));

    const params = ga4(ctx.gtagCalls, BOOKING_CONFIRMED)[0][2];
    assert.equal(params.value, MATTER_VALUE.tax);
    assert.equal(params.currency, VALUE_CURRENCY);
  });

  test('a booking with no qualifier still carries the baseline, not nothing', () => {
    const ctx = mount(`${ORIGIN}/`);
    createTracker(ctx).start();
    ctx.win.dispatchEvent(new ctx.win.MessageEvent('message', {
      data: { __perchBooking: 'confirmed' }, origin: ORIGIN,
    }));
    assert.equal(ga4(ctx.gtagCalls, BOOKING_CONFIRMED)[0][2].value, BASELINE_VALUE);
  });

  test('the Google Ads conversion still addresses the right label', () => {
    const ctx = mount(`${ORIGIN}/`);
    createTracker(ctx).start();
    ctx.win.dispatchEvent(new ctx.win.MessageEvent('message', {
      data: { __perchBooking: 'confirmed' }, origin: ORIGIN,
    }));
    const conv = ctx.gtagCalls.find(([k, n]) => k === 'event' && n === 'conversion');
    assert.equal(conv[2].send_to, CATALOGUE[BOOKING_CONFIRMED].ads);
  });

  test('attribution is readable for debugging without touching storage', () => {
    const ctx = mount(`${ORIGIN}/?gclid=Z`);
    const t = createTracker(ctx).start();
    assert.equal(t.attribution.gclid, 'Z');
    t.attribution.gclid = 'tampered';
    assert.equal(t.attribution.gclid, 'Z', 'the getter must hand back a copy');
  });
});
