// B1 — mint abuse controls: origin allow-list, rate limit, Turnstile.
//
// Before this change /web-call had none of these: an anonymous cross-origin script
// could mint unlimited real Retell tokens, each also triggering a Vantage PII
// lookup. Each test names the abuse it forecloses.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  checkOrigin,
  checkRateLimit,
  verifyTurnstile,
  allowedOrigins,
} from '../donovan-legal-site/functions/_lib/abuse.js';
import { makeKV, makeBrokenKV, stubFetch, muteConsole } from './helpers/stubs.mjs';

const OK = 'https://www.donovan.law';

function req({ origin, referer, ip = '203.0.113.7' } = {}) {
  const h = {};
  if (origin) h['Origin'] = origin;
  if (referer) h['Referer'] = referer;
  if (ip) h['CF-Connecting-IP'] = ip;
  return new Request('https://www.donovan.law/web-call', { method: 'POST', headers: h });
}

describe('origin allow-list', () => {
  test('accepts the canonical production origin', () => {
    assert.equal(checkOrigin(req({ origin: OK }), {}).ok, true);
  });

  test('accepts the apex domain', () => {
    assert.equal(checkOrigin(req({ origin: 'https://donovan.law' }), {}).ok, true);
  });

  test('THE ATTACK: a cross-origin mint is refused', () => {
    const r = checkOrigin(req({ origin: 'https://evil.example' }), {});
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'origin_not_allowed');
  });

  test('a lookalike origin is refused (no substring matching)', () => {
    for (const bad of [
      'https://donovan.law.evil.example',
      'https://evildonovan.law',
      'http://www.donovan.law', // wrong scheme
    ]) {
      const r = checkOrigin(req({ origin: bad }), {});
      assert.equal(r.ok, false, `${bad} must not be allowed`);
    }
  });

  test('a request with NO Origin and no Referer is refused, not allowed', () => {
    // The fail-closed direction: a missing Origin means a non-browser client,
    // which is exactly what this control exists to stop.
    const r = checkOrigin(req({ ip: '203.0.113.7' }), {});
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'no_origin');
  });

  test('falls back to the Referer ORIGIN only, ignoring its path', () => {
    const r = checkOrigin(req({ referer: 'https://www.donovan.law/book.html?x=1' }), {});
    assert.equal(r.ok, true);
    assert.equal(r.origin, OK);
  });

  test('a Referer from a disallowed site is refused', () => {
    const r = checkOrigin(req({ referer: 'https://evil.example/donovan.law' }), {});
    assert.equal(r.ok, false);
  });

  test('normalises case and trailing slash', () => {
    assert.equal(checkOrigin(req({ origin: 'HTTPS://WWW.DONOVAN.LAW/' }), {}).ok, true);
  });

  test('WEB_CALL_ALLOWED_ORIGINS overrides the built-in list wholesale', () => {
    const env = { WEB_CALL_ALLOWED_ORIGINS: 'https://preview.example' };
    assert.equal(checkOrigin(req({ origin: 'https://preview.example' }), env).ok, true);
    // The default list must NOT still apply once overridden.
    assert.equal(checkOrigin(req({ origin: OK }), env).ok, false);
    assert.deepEqual(allowedOrigins(env), ['https://preview.example']);
  });
});

describe('rate limit', () => {
  test('allows up to the cap, then refuses', async () => {
    const kv = makeKV();
    const env = { PERCH_ACTIONS: kv };
    const now = 1_700_000_000_000;

    for (let i = 1; i <= 5; i++) {
      const r = await checkRateLimit(req(), env, now);
      assert.equal(r.ok, true, `mint ${i} should be allowed`);
      assert.equal(r.count, i);
    }

    const m = muteConsole();
    try {
      const blocked = await checkRateLimit(req(), env, now);
      assert.equal(blocked.ok, false);
      assert.equal(blocked.reason, 'rate_limited');
      assert.ok(blocked.retry_after > 0, 'must tell the client when to retry');
    } finally { m.restore(); }
  });

  test('counts per IP, so one abuser does not block everyone else', async () => {
    const kv = makeKV();
    const env = { PERCH_ACTIONS: kv };
    const now = 1_700_000_000_000;
    const m = muteConsole();
    try {
      for (let i = 0; i < 6; i++) await checkRateLimit(req({ ip: '198.51.100.1' }), env, now);
      const other = await checkRateLimit(req({ ip: '198.51.100.2' }), env, now);
      assert.equal(other.ok, true, 'a different IP must not inherit the block');
    } finally { m.restore(); }
  });

  test('the window rolls over', async () => {
    const kv = makeKV();
    const env = { PERCH_ACTIONS: kv };
    const now = 1_700_000_000_000;
    const m = muteConsole();
    try {
      for (let i = 0; i < 6; i++) await checkRateLimit(req(), env, now);
      const blocked = await checkRateLimit(req(), env, now);
      assert.equal(blocked.ok, false);

      // 5 minutes later → new bucket.
      const later = await checkRateLimit(req(), env, now + 301_000);
      assert.equal(later.ok, true);
    } finally { m.restore(); }
  });

  test('a KV outage fails OPEN (documented: must not take the phone line down)', async () => {
    const m = muteConsole();
    try {
      const r = await checkRateLimit(req(), { PERCH_ACTIONS: makeBrokenKV() });
      assert.equal(r.ok, true);
    } finally { m.restore(); }
  });

  test('an unbound KV skips the limiter loudly rather than silently', async () => {
    const m = muteConsole();
    try {
      const r = await checkRateLimit(req(), {});
      assert.equal(r.ok, true);
      assert.ok(m.saw('rate-limit SKIPPED'));
    } finally { m.restore(); }
  });
});

describe('Turnstile', () => {
  test('FAILS CLOSED (503) when TURNSTILE_SECRET_KEY is unset', async () => {
    const m = muteConsole();
    try {
      const r = await verifyTurnstile('tok', req(), {});
      assert.equal(r.ok, false);
      assert.equal(r.status, 503);
      assert.equal(r.reason, 'turnstile_not_configured');
      assert.ok(m.saw('MISCONFIGURED'));
    } finally { m.restore(); }
  });

  test('refuses a request with no token', async () => {
    const r = await verifyTurnstile(undefined, req(), { TURNSTILE_SECRET_KEY: 's' });
    assert.equal(r.ok, false);
    assert.equal(r.status, 403);
    assert.equal(r.reason, 'turnstile_missing');
  });

  test('accepts when siteverify returns success', async () => {
    const f = stubFetch(async () => new Response(JSON.stringify({ success: true })));
    try {
      const r = await verifyTurnstile('good-token', req(), { TURNSTILE_SECRET_KEY: 's' });
      assert.equal(r.ok, true);
      assert.match(f.calls[0][0], /challenges\.cloudflare\.com\/turnstile\/v0\/siteverify/);
    } finally { f.restore(); }
  });

  test('THE ATTACK: a token siteverify rejects does not mint', async () => {
    const m = muteConsole();
    const f = stubFetch(async () => new Response(JSON.stringify({ success: false, 'error-codes': ['invalid-input-response'] })));
    try {
      const r = await verifyTurnstile('forged', req(), { TURNSTILE_SECRET_KEY: 's' });
      assert.equal(r.ok, false);
      assert.equal(r.status, 403);
    } finally { f.restore(); m.restore(); }
  });

  test('a verify we could not complete is NOT a verify that passed', async () => {
    const m = muteConsole();
    const f = stubFetch(async () => { throw new Error('network down'); });
    try {
      const r = await verifyTurnstile('tok', req(), { TURNSTILE_SECRET_KEY: 's' });
      assert.equal(r.ok, false);
      assert.equal(r.status, 503);
    } finally { f.restore(); m.restore(); }
  });

  test('a malformed siteverify body is treated as failure', async () => {
    const m = muteConsole();
    const f = stubFetch(async () => new Response('not json'));
    try {
      const r = await verifyTurnstile('tok', req(), { TURNSTILE_SECRET_KEY: 's' });
      assert.equal(r.ok, false);
    } finally { f.restore(); m.restore(); }
  });
});
