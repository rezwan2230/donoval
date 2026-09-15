// Region-scoped consent defaults (2026-09-03).
//
// The decision: opt-in stays the posture for the EEA, the UK and Switzerland;
// everywhere else the default is granted and the banner is a notice with a
// working Decline. The quiet failures to guard: an unknown region silently
// opening up (it must fail closed), a stored Decline being ignored on the next
// page in an opt-out region, and the edge meta being emitted with anything but a
// clean country code.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  GRANTED, DENIED, DEFAULT_CONSENT, OPT_OUT_CONSENT, OPT_IN_REGIONS,
  normaliseRegion, isOptInRegion, defaultConsentCalls, metaAllowed, CONSENT_KEY,
} from '../donovan-legal-site/js/analytics/consent.js';
import { regionTag } from '../donovan-legal-site/functions/_lib/analytics-inject.js';

const SIGNALS = ['ad_storage', 'ad_user_data', 'ad_personalization', 'analytics_storage'];

function storageWith(seed) {
  const map = new Map();
  if (seed) map.set(CONSENT_KEY, seed);
  return { getItem: (k) => (map.has(k) ? map.get(k) : null), setItem: (k, v) => map.set(k, v) };
}

describe('region classification', () => {
  test('the EEA, UK and Switzerland are opt-in', () => {
    for (const c of ['DE', 'FR', 'IE', 'NL', 'GB', 'CH', 'NO', 'IS', 'LI']) assert.equal(isOptInRegion(c), true, c);
  });
  test('the United States and the rest of the world are not', () => {
    for (const c of ['US', 'CA', 'MX', 'BR', 'AU', 'JP', 'AE']) assert.equal(isOptInRegion(c), false, c);
  });
  test('unknown or malformed input fails CLOSED to opt-in', () => {
    for (const c of ['', 'XX', 'T1', 'usa', '1', null, undefined, 42]) assert.equal(isOptInRegion(c), true, String(c));
  });
  test('normalisation is case-insensitive and rejects junk', () => {
    assert.equal(normaliseRegion(' us '), 'US');
    assert.equal(normaliseRegion('U'), '');
    assert.equal(normaliseRegion('<b>'), '');
  });
  test('the opt-in list is frozen and has no duplicates', () => {
    assert.ok(Object.isFrozen(OPT_IN_REGIONS));
    assert.equal(new Set(OPT_IN_REGIONS).size, OPT_IN_REGIONS.length);
  });
});

describe('the gtag defaults', () => {
  test('an opt-in region publishes exactly the single denied default it always did', () => {
    const calls = defaultConsentCalls('DE');
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0], { ...DEFAULT_CONSENT });
    assert.equal('region' in calls[0], false, 'no region scoping -- global denied');
  });
  test('an unknown region does the same', () => {
    assert.deepEqual(defaultConsentCalls(''), [{ ...DEFAULT_CONSENT }]);
    assert.deepEqual(defaultConsentCalls(undefined), [{ ...DEFAULT_CONSENT }]);
  });
  test('an opt-out region publishes denied-for-the-EEA first, then granted for everyone else', () => {
    const calls = defaultConsentCalls('US');
    assert.equal(calls.length, 2);
    for (const k of SIGNALS) assert.equal(calls[0][k], DENIED, `${k} denied in the scoped default`);
    assert.deepEqual(calls[0].region, [...OPT_IN_REGIONS], 'the denied default is scoped to the opt-in regions');
    for (const k of SIGNALS) assert.equal(calls[1][k], GRANTED, `${k} granted in the global default`);
    assert.equal('region' in calls[1], false, 'the granted default is global');
    assert.ok(calls[1].wait_for_update > 0, 'still leaves room for a stored answer to be replayed');
  });
  test('OPT_OUT_CONSENT is frozen and grants every signal', () => {
    assert.ok(Object.isFrozen(OPT_OUT_CONSENT));
    for (const k of SIGNALS) assert.equal(OPT_OUT_CONSENT[k], GRANTED);
    assert.equal(OPT_OUT_CONSENT.security_storage, GRANTED);
  });
});

describe('metaAllowed with a region', () => {
  test('an explicit answer always wins, wherever the visitor is', () => {
    assert.equal(metaAllowed(storageWith(GRANTED), 'DE'), true);
    assert.equal(metaAllowed(storageWith(DENIED), 'US'), false);
  });
  test('no answer: opt-out region loads, opt-in and unknown withhold', () => {
    assert.equal(metaAllowed(storageWith(null), 'US'), true);
    assert.equal(metaAllowed(storageWith(null), 'FR'), false);
    assert.equal(metaAllowed(storageWith(null), ''), false);
  });
  test('called without a region it behaves exactly as before', () => {
    assert.equal(metaAllowed(storageWith(null)), false);
    assert.equal(metaAllowed(storageWith(GRANTED)), true);
  });
});

describe('the edge meta', () => {
  const req = (country, header) => ({
    cf: country === undefined ? undefined : { country },
    headers: { get: (k) => (k === 'cf-ipcountry' ? header || null : null) },
  });
  test('writes the Cloudflare country as a meta the browser can read', () => {
    assert.equal(regionTag(req('US')), '<meta name="dl:region" content="US">');
  });
  test('falls back to the cf-ipcountry header', () => {
    assert.equal(regionTag(req(undefined, 'de')), '<meta name="dl:region" content="DE">');
  });
  test('emits nothing when neither is present, and never throws', () => {
    assert.equal(regionTag(req(undefined, null)), '');
    assert.equal(regionTag(undefined), '');
    assert.equal(regionTag({}), '');
  });
  test('cannot be used to inject markup', () => {
    assert.equal(regionTag(req('">' + '<script>')), '', 'junk sanitises to nothing');
    // A stray quote is stripped; the one-letter remainder reaches the browser,
    // where normaliseRegion() rejects it and the visitor is treated as opt-in.
    assert.equal(regionTag(req('U"')), '<meta name="dl:region" content="U">');
  });
});
