// B1 — the anti-forgery half of the FL §934.03 gate.
//
// The defect these tests exist for: before this change, /web-call accepted a
// consent assertion whose every field was public, so a forged value minted a real
// Retell token. The assertion is now a server-signed ticket. Each test below names
// the attack it forecloses.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  issueConsentTicket,
  verifyConsentTicket,
  TICKET_TTL_MS,
} from '../donovan-legal-site/functions/_lib/consent-ticket.js';
import { CONSENT_VERSION } from '../donovan-legal-site/functions/_lib/consent.js';
import { makeKV, makeBrokenKV, muteConsole } from './helpers/stubs.mjs';

const SECRET = 'test-secret-do-not-use-in-production-0123456789abcdef';
const ORIGIN = 'https://www.donovan.law';

function env(overrides = {}) {
  return { CONSENT_TICKET_SECRET: SECRET, ...overrides };
}

/** Re-sign a payload with a DIFFERENT secret — i.e. what an attacker can produce. */
function tamperPayload(ticket, mutate) {
  const [body, sig] = ticket.split('.');
  const json = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  mutate(json);
  const forged = Buffer.from(JSON.stringify(json), 'utf8').toString('base64url');
  return `${forged}.${sig}`; // old signature over new payload
}

describe('consent ticket — issue', () => {
  test('issues a two-part signed ticket bound to the origin', async () => {
    const r = await issueConsentTicket(env(), { origin: ORIGIN });
    assert.equal(r.ok, true);
    assert.match(r.ticket, /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    assert.equal(r.expires_in, Math.floor(TICKET_TTL_MS / 1000));
  });

  test('FAILS CLOSED when CONSENT_TICKET_SECRET is unset', async () => {
    const m = muteConsole();
    try {
      const r = await issueConsentTicket({}, { origin: ORIGIN });
      assert.equal(r.ok, false);
      assert.equal(r.reason, 'not_configured');
      assert.ok(m.saw('MISCONFIGURED'), 'a misconfigured deploy must be loud');
    } finally { m.restore(); }
  });

  test('two tickets are never identical (jti is random)', async () => {
    const a = await issueConsentTicket(env(), { origin: ORIGIN });
    const b = await issueConsentTicket(env(), { origin: ORIGIN });
    assert.notEqual(a.ticket, b.ticket);
  });
});

describe('consent ticket — verify (happy path)', () => {
  test('round-trips and records the SERVER clock, not a client timestamp', async () => {
    const now = Date.now();
    const { ticket } = await issueConsentTicket(env(), { origin: ORIGIN, now });
    const r = await verifyConsentTicket(env(), ticket, { origin: ORIGIN, now: now + 1000 });
    assert.equal(r.ok, true);
    assert.equal(r.record.granted, true);
    assert.equal(r.record.version, CONSENT_VERSION);
    assert.equal(r.record.acknowledged_at, new Date(now).toISOString());
    assert.equal(r.record.origin, ORIGIN);
    assert.ok(r.record.jti);
  });
});

describe('consent ticket — forgery is refused', () => {
  test('THE B1 ATTACK: a hand-built assertion from public values is rejected', async () => {
    // Exactly what an attacker could assemble knowing only GET /consent-notice:
    // the current version string and a fresh timestamp. No signature.
    const forged = Buffer.from(
      JSON.stringify({ v: CONSENT_VERSION, iat: Date.now(), jti: 'attacker', org: ORIGIN })
    ).toString('base64url');
    const r = await verifyConsentTicket(env(), `${forged}.notarealsignature`, { origin: ORIGIN });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'ticket_bad_signature');
  });

  test('a ticket signed with the wrong secret is rejected', async () => {
    const { ticket } = await issueConsentTicket(env({ CONSENT_TICKET_SECRET: 'other-secret' }), { origin: ORIGIN });
    const r = await verifyConsentTicket(env(), ticket, { origin: ORIGIN });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'ticket_bad_signature');
  });

  test('mutating the payload invalidates the signature (no payload is trusted first)', async () => {
    const { ticket } = await issueConsentTicket(env(), { origin: ORIGIN });
    const tampered = tamperPayload(ticket, (p) => { p.org = 'https://evil.example'; });
    const r = await verifyConsentTicket(env(), tampered, { origin: 'https://evil.example' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'ticket_bad_signature');
  });

  test('extending the expiry by editing iat is caught by the signature', async () => {
    const { ticket } = await issueConsentTicket(env(), { origin: ORIGIN });
    const tampered = tamperPayload(ticket, (p) => { p.iat = Date.now() + 10 * 60 * 1000; });
    const r = await verifyConsentTicket(env(), tampered, { origin: ORIGIN });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'ticket_bad_signature');
  });

  for (const [label, value] of [
    ['missing', undefined],
    ['empty', ''],
    ['non-string', 12345],
    ['no separator', 'abcdef'],
    ['empty signature', 'abcdef.'],
    ['empty payload', '.abcdef'],
  ]) {
    test(`malformed ticket (${label}) is rejected without throwing`, async () => {
      const r = await verifyConsentTicket(env(), value, { origin: ORIGIN });
      assert.equal(r.ok, false);
      assert.ok(['ticket_missing', 'ticket_malformed'].includes(r.reason), `got ${r.reason}`);
    });
  }
});

describe('consent ticket — time and origin binding', () => {
  test('a ticket older than the TTL is rejected', async () => {
    const now = Date.now();
    const { ticket } = await issueConsentTicket(env(), { origin: ORIGIN, now });
    const r = await verifyConsentTicket(env(), ticket, { origin: ORIGIN, now: now + TICKET_TTL_MS + 1000 });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'ticket_expired');
  });

  test('a ticket still inside the TTL is accepted at the boundary', async () => {
    const now = Date.now();
    const { ticket } = await issueConsentTicket(env(), { origin: ORIGIN, now });
    const r = await verifyConsentTicket(env(), ticket, { origin: ORIGIN, now: now + TICKET_TTL_MS - 1000 });
    assert.equal(r.ok, true);
  });

  test('a ticket from the future (beyond skew) is rejected', async () => {
    const now = Date.now();
    const { ticket } = await issueConsentTicket(env(), { origin: ORIGIN, now: now + 5 * 60 * 1000 });
    const r = await verifyConsentTicket(env(), ticket, { origin: ORIGIN, now });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'ticket_future');
  });

  test('a ticket lifted to another origin is rejected', async () => {
    const { ticket } = await issueConsentTicket(env(), { origin: ORIGIN });
    const r = await verifyConsentTicket(env(), ticket, { origin: 'https://evil.example' });
    assert.equal(r.ok, false);
    assert.equal(r.reason, 'ticket_origin_mismatch');
  });

  test('FAILS CLOSED on verify when the secret is unset', async () => {
    const m = muteConsole();
    try {
      const { ticket } = await issueConsentTicket(env(), { origin: ORIGIN });
      const r = await verifyConsentTicket({}, ticket, { origin: ORIGIN });
      assert.equal(r.ok, false);
      assert.equal(r.reason, 'not_configured');
    } finally { m.restore(); }
  });
});

describe('consent ticket — single use', () => {
  test('the second use of a ticket is refused', async () => {
    const m = muteConsole();
    try {
      const kv = makeKV();
      const e = env({ PERCH_ACTIONS: kv });
      const { ticket } = await issueConsentTicket(e, { origin: ORIGIN });

      const first = await verifyConsentTicket(e, ticket, { origin: ORIGIN });
      assert.equal(first.ok, true, 'first use must succeed');

      const second = await verifyConsentTicket(e, ticket, { origin: ORIGIN });
      assert.equal(second.ok, false);
      assert.equal(second.reason, 'ticket_replayed');
    } finally { m.restore(); }
  });

  test('a KV outage does not take the phone line down (burn fails open, by design)', async () => {
    const m = muteConsole();
    try {
      const e = env({ PERCH_ACTIONS: makeBrokenKV() });
      const { ticket } = await issueConsentTicket(e, { origin: ORIGIN });
      const r = await verifyConsentTicket(e, ticket, { origin: ORIGIN });
      // Deliberate: signature + TTL + origin still held. Documented in the source.
      assert.equal(r.ok, true);
      assert.ok(m.saw('jti burn failed'));
    } finally { m.restore(); }
  });
});
