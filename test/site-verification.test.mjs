// JAY-SEO-E2 — search-engine site verification tags.
//
// The failure this guards is slow and silent: a console re-checks its token
// periodically and un-verifies a property whose tag has disappeared. Nobody sees
// an error — Search Console just stops having data, weeks later, and the cause
// is an unrelated change someone made in between.
//
// So the tests that matter are: it is NOT coupled to the analytics flag, it is
// inert when unconfigured, and a mis-pasted token is refused loudly rather than
// emitted as something that will never verify.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import { siteVerificationTags }
  from '../donovan-legal-site/functions/_lib/site-verification.js';
import { analyticsTag }
  from '../donovan-legal-site/functions/_lib/analytics-inject.js';
import { muteConsole } from './helpers/stubs.mjs';

const GOOGLE = 'abcdefghijklmnopqrstuvwxyz0123456789_-ABCDE';
const BING = '0123456789abcdef0123456789abcdef';

const parse = (html) =>
  new JSDOM(`<!doctype html><html><head>${html}</head><body></body></html>`).window.document;

describe('inert until configured', () => {
  test('nothing is emitted with no token', () => {
    assert.equal(siteVerificationTags({}), '');
    assert.equal(siteVerificationTags(undefined), '');
    assert.equal(siteVerificationTags(null), '');
  });

  test('production today is unchanged (regression control)', () => {
    // The env this ships into. If this ever fails, something set a token
    // without anyone deciding to.
    assert.equal(siteVerificationTags({ ANALYTICS: 'on', META_DATASET_ID: '1769060274465061' }), '');
  });

  test('an empty or whitespace token emits nothing', () => {
    assert.equal(siteVerificationTags({ GOOGLE_SITE_VERIFICATION: '' }), '');
    assert.equal(siteVerificationTags({ GOOGLE_SITE_VERIFICATION: '   ' }), '');
  });
});

describe('emitting a token', () => {
  test('Google gets the name its console looks for', () => {
    const doc = parse(siteVerificationTags({ GOOGLE_SITE_VERIFICATION: GOOGLE }));
    const el = doc.querySelector('meta[name="google-site-verification"]');
    assert.ok(el);
    assert.equal(el.getAttribute('content'), GOOGLE);
  });

  test('Bing uses msvalidate.01, not a google-style name', () => {
    const doc = parse(siteVerificationTags({ BING_SITE_VERIFICATION: BING }));
    assert.equal(doc.querySelector('meta[name="msvalidate.01"]').getAttribute('content'), BING);
  });

  test('both can be set at once without interfering', () => {
    const doc = parse(siteVerificationTags({
      GOOGLE_SITE_VERIFICATION: GOOGLE, BING_SITE_VERIFICATION: BING,
    }));
    assert.equal(doc.querySelectorAll('meta').length, 2);
  });

  test('surrounding whitespace is tolerated, not rejected', () => {
    const doc = parse(siteVerificationTags({ GOOGLE_SITE_VERIFICATION: `  ${GOOGLE}  ` }));
    assert.equal(doc.querySelector('meta[name="google-site-verification"]').getAttribute('content'), GOOGLE);
  });
});

describe('a mis-pasted token is refused, not emitted', () => {
  test('the whole meta tag pasted in is rejected', () => {
    // The realistic accident: copying Google's snippet rather than the content
    // value. Emitting it would not error — verification would simply never
    // succeed, with nothing to explain why.
    const c = muteConsole();
    try {
      const out = siteVerificationTags({
        GOOGLE_SITE_VERIFICATION: `<meta name="google-site-verification" content="${GOOGLE}" />`,
      });
      assert.equal(out, '');
      assert.ok(c.saw('malformed'), 'should say so rather than fail silently');
    } finally { c.restore(); }
  });

  test('quotes, spaces and short strings are rejected', () => {
    const c = muteConsole();
    try {
      for (const bad of [`"${GOOGLE}"`, 'too short', 'abc', 'has spaces in it', '<script>']) {
        assert.equal(siteVerificationTags({ GOOGLE_SITE_VERIFICATION: bad }), '',
          `should reject ${JSON.stringify(bad)}`);
      }
    } finally { c.restore(); }
  });

  test('the warning names the variable but never the value', () => {
    const c = muteConsole();
    try {
      siteVerificationTags({ GOOGLE_SITE_VERIFICATION: 'bad value with spaces' });
      assert.ok(c.saw('GOOGLE_SITE_VERIFICATION'));
      assert.ok(!c.saw('bad value'), 'must not echo the token into the log stream');
    } finally { c.restore(); }
  });

  test('a hostile value cannot break out of the attribute', () => {
    const c = muteConsole();
    try {
      const out = siteVerificationTags({ GOOGLE_SITE_VERIFICATION: 'a" onload="alert(1)' });
      assert.equal(out, '', 'the shape check refuses it before escaping matters');
    } finally { c.restore(); }
  });

  test('never throws, whatever the environment holds', () => {
    for (const v of [42, {}, [], null, undefined, true]) {
      assert.doesNotThrow(() => siteVerificationTags({ GOOGLE_SITE_VERIFICATION: v }));
    }
  });
});

describe('NOT coupled to the analytics flag', () => {
  test('a token is emitted with ANALYTICS off', () => {
    // THE test in this file. Google re-checks the token and un-verifies a
    // property whose tag has gone. If this were gated on ANALYTICS, switching
    // tracking off for an afternoon would silently cost Search Console access,
    // and the loss would surface weeks later as missing data.
    const env = { GOOGLE_SITE_VERIFICATION: GOOGLE };
    assert.equal(analyticsTag(env), '', 'control: analytics really is off');
    assert.ok(siteVerificationTags(env).includes('google-site-verification'));
  });

  test('and with ANALYTICS on', () => {
    const env = { ANALYTICS: 'on', GOOGLE_SITE_VERIFICATION: GOOGLE };
    assert.ok(siteVerificationTags(env).includes('google-site-verification'));
  });
});
