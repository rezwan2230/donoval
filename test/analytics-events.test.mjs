// The analytics event catalogue (JAY-TRACKING-A1).
//
// This suite exists because the catalogue is a contract with two ad platforms
// that we cannot see from here. If a conversion label drifts, Google does not
// error — it silently records nothing, the campaign optimises against a signal
// that never arrives, and the first symptom is a spend report weeks later. So
// the labels are asserted literally, against the values read out of the Google
// Ads account on 2026-08-10.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  GA4_MEASUREMENT_ID,
  ADS_CONVERSION_ID,
  META_DATASET_ID,
  CATALOGUE,
  AEM_PRIORITY,
  BOOKING_CONFIRMED,
  QUALIFIER_SUBMITTED,
  CALL_STARTED,
  MESSAGE_TAKEN,
  destinationsFor,
  isConversion,
  newEventId,
  attributionFrom,
} from '../donovan-legal-site/js/analytics/events.js';

describe('identifiers', () => {
  test('match the accounts they were read from', () => {
    assert.equal(GA4_MEASUREMENT_ID, 'G-187CYLV2YX');
    assert.equal(ADS_CONVERSION_ID, 'AW-18269868294');
    assert.equal(META_DATASET_ID, '1769060274465061');
  });
});

describe('catalogue', () => {
  test('covers exactly the four conversion actions that exist in Google Ads', () => {
    assert.deepEqual(
      Object.keys(CATALOGUE).sort(),
      [CALL_STARTED, BOOKING_CONFIRMED, MESSAGE_TAKEN, QUALIFIER_SUBMITTED].sort(),
    );
  });

  test('every send_to is the conversion ID joined to its own label', () => {
    // The failure this guards is pairing a real label with the wrong account —
    // which looks correct in a diff and reports nothing in production.
    for (const [name, dest] of Object.entries(CATALOGUE)) {
      assert.ok(dest.ads.startsWith(`${ADS_CONVERSION_ID}/`), `${name} is addressed to another account`);
      const label = dest.ads.slice(ADS_CONVERSION_ID.length + 1);
      assert.match(label, /^[A-Za-z0-9_-]{10,}$/, `${name} has an implausible label`);
    }
  });

  test('the four labels are the ones in the account', () => {
    assert.equal(CATALOGUE[BOOKING_CONFIRMED].ads,   'AW-18269868294/hG-rCJWFnNkcEIai4IdE');
    assert.equal(CATALOGUE[QUALIFIER_SUBMITTED].ads, 'AW-18269868294/5l53CJ3rhtkcEIai4IdE');
    assert.equal(CATALOGUE[CALL_STARTED].ads,        'AW-18269868294/Qj83CJ_qhtkcEIai4IdE');
    assert.equal(CATALOGUE[MESSAGE_TAKEN].ads,       'AW-18269868294/BMoiCJrrhtkcEIai4IdE');
  });

  test('no two events share a label', () => {
    const labels = Object.values(CATALOGUE).map((d) => d.ads);
    assert.equal(new Set(labels).size, labels.length);
  });

  test('the booking is the highest-priority Meta event', () => {
    // AEM only lets the top-priority event through for an opted-out visitor, so
    // a booking must outrank a qualifier tap. Getting this backwards costs the
    // conversion that actually matters.
    const rank = (e) => AEM_PRIORITY.indexOf(e);
    assert.ok(rank(CATALOGUE[BOOKING_CONFIRMED].meta) < rank(CATALOGUE[QUALIFIER_SUBMITTED].meta));
    assert.ok(rank(CATALOGUE[QUALIFIER_SUBMITTED].meta) < rank(CATALOGUE[CALL_STARTED].meta));
    assert.ok(AEM_PRIORITY.every((e) => rank(e) >= 0));
  });

  test('is frozen — a caller cannot mutate the contract at runtime', () => {
    assert.throws(() => { CATALOGUE[BOOKING_CONFIRMED] = null; }, TypeError);
  });
});

describe('destinationsFor', () => {
  test('returns the destinations for a known event', () => {
    assert.equal(destinationsFor(BOOKING_CONFIRMED).meta, 'Schedule');
  });

  test('returns null for an unknown event rather than throwing', () => {
    // A typo must degrade to a missing conversion, never to a broken booking.
    assert.equal(destinationsFor('bookingConfirmed'), null);
    assert.equal(destinationsFor(''), null);
    assert.equal(destinationsFor(undefined), null);
  });

  test('does not resolve inherited Object properties', () => {
    assert.equal(destinationsFor('toString'), null);
    assert.equal(destinationsFor('constructor'), null);
  });

  test('isConversion distinguishes the four from a page view', () => {
    assert.equal(isConversion(CALL_STARTED), true);
    assert.equal(isConversion('page_view'), false);
  });
});

describe('newEventId', () => {
  test('uses randomUUID when the platform has it', () => {
    const id = newEventId({ randomUUID: () => 'fixed-uuid' });
    assert.equal(id, 'fixed-uuid');
  });

  test('falls back to getRandomValues in a non-secure context', () => {
    const id = newEventId({ getRandomValues: (a) => { a.fill(0xab); return a; } });
    assert.equal(id, 'ab'.repeat(16));
  });

  test('still yields distinct ids with no crypto at all', () => {
    // Two events in the same millisecond are ordinary here — a page view and a
    // conversion routinely land together — so a timestamp alone is not enough.
    const a = newEventId({});
    const b = newEventId({});
    assert.notEqual(a, b);
  });

  test('produces unique ids across many calls', () => {
    const ids = new Set(Array.from({ length: 500 }, () => newEventId()));
    assert.equal(ids.size, 500);
  });
});

describe('attributionFrom', () => {
  test('lifts the click ids and all five utm parameters', () => {
    const got = attributionFrom('?gclid=G1&fbclid=F1&utm_source=google&utm_medium=cpc&utm_campaign=tax&utm_term=1031&utm_content=a');
    assert.deepEqual(got, {
      gclid: 'G1', fbclid: 'F1',
      utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'tax',
      utm_term: '1031', utm_content: 'a',
    });
  });

  test('ignores parameters that are not attribution', () => {
    const got = attributionFrom('?gclid=G1&email=someone@example.com&ref=x');
    assert.deepEqual(got, { gclid: 'G1' });
  });

  test('never carries an empty value', () => {
    assert.deepEqual(attributionFrom('?gclid=&utm_source=google'), { utm_source: 'google' });
  });

  test('works with or without the leading question mark, and on nothing', () => {
    assert.deepEqual(attributionFrom('gclid=G1'), { gclid: 'G1' });
    assert.deepEqual(attributionFrom(''), {});
    assert.deepEqual(attributionFrom(undefined), {});
  });
});
