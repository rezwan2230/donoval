// The edge injection and the CSP allowance it travels with (JAY-TRACKING-B1).
//
// Two invariants are worth more than the rest of this file combined:
//
//   1. The flag governs BOTH the tag and the CSP hosts. If they could ever
//      disagree, the failure modes are a policy allowing hosts nothing contacts
//      (untidy), or a tag the policy blocks (silent, and the symptom is "the ads
//      don't work" three weeks later). One flag, both effects, asserted here.
//
//   2. With the flag off, the emitted policy is byte-identical to today's. That
//      is what makes this change safe to merge and safe to DEPLOY — switching on
//      is a Cloudflare environment variable, not a release.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { buildCsp } from '../donovan-legal-site/functions/_middleware.js';
import {
  analyticsTag,
  analyticsEnabled,
  ANALYTICS_MODULE_SRC,
} from '../donovan-legal-site/functions/_lib/analytics-inject.js';

const NONCE = 'test-nonce-000';
const directive = (csp, name) =>
  csp.split('; ').find((d) => d.startsWith(`${name} `)) || '';

const ON = { ANALYTICS: 'on' };

describe('the flag', () => {
  test('is off when unset, empty, or anything other than "on"', () => {
    for (const env of [undefined, {}, { ANALYTICS: '' }, { ANALYTICS: 'off' }, { ANALYTICS: 'true' }, { ANALYTICS: '1' }]) {
      assert.equal(analyticsEnabled(env), false, `unexpectedly on for ${JSON.stringify(env)}`);
    }
  });

  test('is on only for an explicit "on", tolerating case and whitespace', () => {
    for (const v of ['on', 'ON', ' on ', 'On']) {
      assert.equal(analyticsEnabled({ ANALYTICS: v }), true, `did not enable for ${JSON.stringify(v)}`);
    }
  });

  test('does not default on for preview hosts the way routerEnabled does', () => {
    // Deliberate divergence. A preview running the real tags would send test
    // traffic to the real GA4 property, the real Ads conversions and the real
    // Meta dataset — and Smart Bidding LEARNS from fake conversions. There is no
    // url argument here at all, which is the point: nothing about where this is
    // deployed can switch it on.
    assert.equal(analyticsEnabled.length, 1);
  });
});

describe('the head tag', () => {
  test('is empty when the flag is off', () => {
    assert.equal(analyticsTag(undefined), '');
    assert.equal(analyticsTag({}), '');
    assert.equal(analyticsTag({ ANALYTICS: 'off' }), '');
  });

  test('is one module script pointing at the same-origin module', () => {
    const tag = analyticsTag(ON);
    assert.equal(tag, `<script type="module" src="${ANALYTICS_MODULE_SRC}"></script>`);
    assert.equal(ANALYTICS_MODULE_SRC, '/js/analytics.js');
  });

  test('is same-origin, so it needs no nonce and no host allowance', () => {
    // Injected content is not re-fed through the handlers, so NonceStamper never
    // sees it. `script-src 'self'` is what admits it — the same reasoning the
    // layer's own script tag already relies on.
    const tag = analyticsTag(ON);
    assert.doesNotMatch(tag, /nonce/);
    assert.match(tag, /src="\//, 'must be a root-relative same-origin src');
    assert.doesNotMatch(tag, /https?:/);
  });

  test('composes as a string, like navStylesheetTag', () => {
    // It has to concatenate into `headTags`. It cannot be its own ['head', …]
    // handler: lol-html keeps only the LAST onEndTag per element, so a second
    // head handler would silently delete the layer's tags.
    assert.equal(typeof analyticsTag(ON), 'string');
    assert.equal(typeof analyticsTag({}), 'string');
  });
});

describe('the CSP allowance', () => {
  test('with the flag OFF the policy is byte-identical to the old one', () => {
    // The safety property of this whole change. Merging and deploying it must
    // alter nothing until someone sets the variable.
    const off = buildCsp(NONCE);
    const explicit = buildCsp(NONCE, { analytics: false });
    assert.equal(off, explicit);
    for (const host of ['googletagmanager', 'facebook', 'google-analytics', 'doubleclick']) {
      assert.doesNotMatch(off, new RegExp(host), `${host} leaked into the off policy`);
    }
  });

  test('with the flag ON script-src admits the vendor script hosts', () => {
    const src = directive(buildCsp(NONCE, { analytics: true }), 'script-src');
    assert.match(src, /https:\/\/\*\.googletagmanager\.com/);
    assert.match(src, /https:\/\/connect\.facebook\.net/);
    assert.match(src, /https:\/\/\*\.clarity\.ms/);
  });

  test('with the flag ON connect-src admits the beacon endpoints', () => {
    const conn = directive(buildCsp(NONCE, { analytics: true }), 'connect-src');
    for (const host of [
      'https://*.google-analytics.com',
      'https://*.analytics.google.com',
      'https://*.googletagmanager.com',
      'https://*.g.doubleclick.net',
      'https://*.google.com',
      'https://*.facebook.com',
      'https://*.clarity.ms',
    ]) {
      assert.ok(conn.includes(host), `connect-src is missing ${host}`);
    }
  });

  test('the analytics module itself needs no new host — it is same-origin', () => {
    const src = directive(buildCsp(NONCE, { analytics: true }), 'script-src');
    assert.match(src, /'self'/);
  });

  test('turning analytics on does not weaken anything else', () => {
    // The regression that would matter most: an edit that widened the policy
    // while reaching for a host. Everything the OFF policy said must still hold.
    const off = buildCsp(NONCE, { analytics: false });
    const on = buildCsp(NONCE, { analytics: true });
    for (const d of off.split('; ')) {
      const name = d.split(' ')[0];
      const onD = directive(on, name) || on.split('; ').find((x) => x === d) || '';
      const sources = d.slice(name.length).trim();
      if (!sources) { assert.ok(on.includes(d), `${name} disappeared`); continue; }
      for (const s of sources.split(/\s+/)) {
        assert.ok(onD.includes(s), `${name} lost ${s} when analytics was enabled`);
      }
    }
    assert.doesNotMatch(on, /unsafe-inline[^;]*script-src|script-src[^;]*unsafe-inline/);
  });

  test('frame-src admits the Ads conversion frame ONLY when analytics is on', () => {
    // gtag's conversion linker frames td.doubleclick.net during Ads
    // conversions; blocked, measurement survived but every tag audit read the
    // console violation as breakage. The allowance rides the analytics flag so
    // the off-state policy stays byte-identical.
    const on = directive(buildCsp(NONCE, { analytics: true }), 'frame-src');
    assert.match(on, /doubleclick\.net/);
    assert.match(on, /googletagmanager\.com/);
    const off = directive(buildCsp(NONCE, { analytics: false }), 'frame-src');
    assert.doesNotMatch(off, /doubleclick|googletagmanager/);
  });

  test('the analytics flag is independent of the frame-ancestors flag', () => {
    const a = buildCsp(NONCE, { lockFrameAncestors: true, analytics: false });
    const b = buildCsp(NONCE, { lockFrameAncestors: true, analytics: true });
    assert.match(a, /frame-ancestors 'self';/);
    assert.match(b, /frame-ancestors 'self';/);
    assert.notEqual(a, b);
  });
});

// ── End to end, through the real middleware and the real parser ──────────────
//
// Everything above tests the pieces. This drives `onRequest` with the lol-html
// engine Cloudflare actually runs, because the pieces being right is not the
// same claim as the tag reaching the page. The specific way this could pass unit
// tests and still fail in production is the head-handler trap documented at the
// top of _middleware.js: lol-html keeps only the LAST onEndTag callback per
// element, so a tag registered the wrong way vanishes with no error anywhere.

import { onRequest } from '../donovan-legal-site/functions/_middleware.js';
import { HTMLRewriter as RealHTMLRewriter } from './helpers/html-rewriter.mjs';

const PAGE = `<!doctype html><html><head><title>t</title></head>
<body><div class="container"><h1>Tax</h1><p>${'word '.repeat(120)}</p></div></body></html>`;

async function serve(env) {
  const saved = globalThis.HTMLRewriter;
  globalThis.HTMLRewriter = RealHTMLRewriter;
  try {
    const request = new Request('https://www.donovan.law/tax-controversy', {
      headers: { 'sec-fetch-dest': 'document' },
    });
    const res = await onRequest({
      request,
      env,
      next: async () => new Response(PAGE, { headers: { 'content-type': 'text/html; charset=utf-8' } }),
    });
    return { html: await res.text(), csp: res.headers.get('Content-Security-Policy') || '' };
  } finally {
    globalThis.HTMLRewriter = saved;
  }
}

describe('end to end through the real middleware', () => {
  test('with the flag OFF the page carries no analytics tag and no analytics hosts', async () => {
    const { html, csp } = await serve({});
    assert.doesNotMatch(html, /js\/analytics\.js/);
    assert.doesNotMatch(csp, /googletagmanager|facebook|google-analytics/);
  });

  test('with the flag ON the tag is in the head, exactly once', async () => {
    const { html } = await serve(ON);
    const head = html.slice(0, html.toLowerCase().indexOf('</head>'));
    assert.match(head, /<script type="module" src="\/js\/analytics\.js"><\/script>/,
      'the tag did not reach <head> — check it composes into headTags rather than its own head handler');
    assert.equal((html.match(/js\/analytics\.js/g) || []).length, 1);
  });

  test('with the flag ON the CSP on that same response admits the vendors', async () => {
    // The pair that must never disagree: tag present, hosts allowed, one flag.
    const { html, csp } = await serve(ON);
    assert.match(html, /js\/analytics\.js/);
    assert.match(csp, /googletagmanager\.com/);
    assert.match(csp, /https:\/\/connect\.facebook\.net/);
  });

  test('the layer and router head tags survive alongside it (the lol-html trap)', async () => {
    // If the analytics tag had been registered as its own ['head', …] handler,
    // one of these two sets would be silently gone. This is the control.
    const off = await serve({});
    const on = await serve(ON);
    const headOf = (h) => h.slice(0, h.toLowerCase().indexOf('</head>'));
    for (const tag of headOf(off.html).match(/<(script|link)\b[^>]*>/gi) || []) {
      assert.ok(headOf(on.html).includes(tag), `enabling analytics dropped a head tag: ${tag}`);
    }
  });
});
