// ── Signed consent tickets — the anti-forgery half of the §934.03 gate ─────────
//
// PROBLEM (Dr. Insane RE-GATE R2, finding B1): validateConsent() in consent.js
// checks only client-supplied fields against a PUBLIC constant, so a forged
// assertion mints a real Retell token. Consent was provable-after-the-fact but
// not unforgeable-at-the-door.
//
// FIX: the server issues the consent artifact, so the client cannot author one.
//   1. GET /consent-notice mints a ticket: an HMAC-SHA256-signed payload naming
//      the disclosure version, issue time, a random jti, and the requesting origin.
//   2. The browser shows the modal and, on "I agree", returns that exact ticket.
//   3. POST /web-call verifies the signature with CONSENT_TICKET_SECRET. Without
//      the secret the signature cannot be produced, so a fabricated consent value
//      is rejected before any token is minted.
//
// The ticket is bound four ways — signature, TTL, origin, and single-use (jti) —
// so it cannot be forged, replayed after expiry, lifted to another site, or
// reused for a second call.
//
// WHAT THIS DOES AND DOES NOT PROVE. It proves the assertion originated from this
// server, for this origin, recently, and exactly once. It cannot prove a human
// read the modal — no server-side check can, since a scripted client could always
// fetch /consent-notice and immediately return the ticket. Proving a *human* is
// Turnstile's job (functions/_lib/abuse.js); the two controls compose, and B1
// requires both. Neither alone is sufficient.
//
// CONFIGURATION (Cloudflare Pages → Settings → Variables & Secrets), BOTH
// Production and Preview:
//   CONSENT_TICKET_SECRET  (secret) — random 32+ byte string, e.g.
//                                     `openssl rand -hex 32`. Rotating it
//                                     invalidates outstanding tickets, which only
//                                     forces open modals to be re-acknowledged.

import { CONSENT_VERSION } from "./consent.js";

/** A ticket is only good for a short window — long enough to read the modal. */
export const TICKET_TTL_MS = 15 * 60 * 1000;

/** base64url helpers (no padding) — Workers provide btoa/atob. */
function b64uEncode(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64uDecode(str) {
  const pad = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** Sign a payload string with the ticket secret, returning base64url HMAC. */
async function signPayload(payloadB64, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payloadB64));
  const v = new Uint8Array(sig);
  let bin = "";
  for (let i = 0; i < v.length; i++) bin += String.fromCharCode(v[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Constant-time compare over fixed-width digests.
 * Same construction as tier-auth.js / retell-auth.js.
 */
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(a)),
    crypto.subtle.digest("SHA-256", enc.encode(b)),
  ]);
  const va = new Uint8Array(da);
  const vb = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < va.length; i++) diff |= va[i] ^ vb[i];
  return diff === 0;
}

/**
 * Mint a consent ticket. Called by GET /consent-notice.
 *
 * FAIL CLOSED: with no CONSENT_TICKET_SECRET we cannot issue an unforgeable
 * ticket, so we issue nothing at all rather than falling back to the forgeable
 * client-only assertion.
 *
 * @returns {Promise<{ok: true, ticket: string, expires_in: number} | {ok: false, reason: string}>}
 */
export async function issueConsentTicket(env, { origin = "", now = Date.now() } = {}) {
  const secret = ((env && env.CONSENT_TICKET_SECRET) || "").trim();
  if (!secret) {
    console.error(
      "[consent] MISCONFIGURED — CONSENT_TICKET_SECRET not set on this Pages environment; cannot issue consent tickets."
    );
    return { ok: false, reason: "not_configured" };
  }
  const payload = {
    v: CONSENT_VERSION,
    iat: now,
    jti: crypto.randomUUID(),
    org: String(origin || "").replace(/\/+$/, "").toLowerCase(),
  };
  const body = b64uEncode(JSON.stringify(payload));
  const sig = await signPayload(body, secret);
  return { ok: true, ticket: `${body}.${sig}`, expires_in: Math.floor(TICKET_TTL_MS / 1000) };
}

/**
 * Verify a consent ticket returned by the browser. Called by POST /web-call.
 *
 * Checks, in order: configured → parseable → signature → version → TTL → origin
 * → not already spent. The signature is checked BEFORE anything in the payload
 * is trusted.
 *
 * SINGLE-USE CAVEAT: the jti is burned in Workers KV, which is eventually
 * consistent, so two simultaneous replays of one ticket can both slip through
 * before the burn converges. That narrows replay to a race window rather than
 * closing it outright; the TTL, origin binding, per-IP rate limit and Turnstile
 * all still apply to each attempt. A strongly-consistent burn needs a Durable
 * Object — the same follow-up as the rate limiter.
 *
 * @returns {Promise<{ok: true, record: object} | {ok: false, reason: string}>}
 */
export async function verifyConsentTicket(env, ticket, { origin = "", now = Date.now() } = {}) {
  const secret = ((env && env.CONSENT_TICKET_SECRET) || "").trim();
  if (!secret) {
    console.error("[consent] MISCONFIGURED — CONSENT_TICKET_SECRET not set; refusing to mint.");
    return { ok: false, reason: "not_configured" };
  }
  if (!ticket || typeof ticket !== "string") return { ok: false, reason: "ticket_missing" };

  const dot = ticket.indexOf(".");
  if (dot < 1 || dot === ticket.length - 1) return { ok: false, reason: "ticket_malformed" };
  const body = ticket.slice(0, dot);
  const sig = ticket.slice(dot + 1);

  // Signature first — nothing in the payload is trusted until this passes.
  const expected = await signPayload(body, secret);
  if (!(await safeEqual(sig, expected))) return { ok: false, reason: "ticket_bad_signature" };

  let payload;
  try {
    payload = JSON.parse(b64uDecode(body));
  } catch {
    return { ok: false, reason: "ticket_unparseable" };
  }
  if (!payload || typeof payload !== "object") return { ok: false, reason: "ticket_unparseable" };

  // The caller must have agreed to the wording this server currently serves.
  if (payload.v !== CONSENT_VERSION) return { ok: false, reason: "version_mismatch" };

  const iat = Number(payload.iat);
  if (!Number.isFinite(iat)) return { ok: false, reason: "ticket_bad_iat" };
  if (iat > now + 60 * 1000) return { ok: false, reason: "ticket_future" };
  if (iat < now - TICKET_TTL_MS) return { ok: false, reason: "ticket_expired" };

  // Origin binding — a ticket minted for donovan.law is useless on another site.
  const want = String(origin || "").replace(/\/+$/, "").toLowerCase();
  if (payload.org && want && payload.org !== want) {
    return { ok: false, reason: "ticket_origin_mismatch" };
  }

  // Single-use burn. A KV failure must not take the phone line down, so a burn we
  // cannot perform is logged and allowed — signature + TTL + origin still hold.
  const kv = env && env.PERCH_ACTIONS;
  if (kv && payload.jti) {
    const key = `consent:jti:${payload.jti}`;
    try {
      if (await kv.get(key)) {
        console.warn("[consent] TICKET_REPLAY — already spent, refusing mint");
        return { ok: false, reason: "ticket_replayed" };
      }
      await kv.put(key, "1", { expirationTtl: Math.floor(TICKET_TTL_MS / 1000) + 60 });
    } catch (e) {
      console.error(`[consent] jti burn failed err=${String((e && e.message) || e)}`);
    }
  }

  return {
    ok: true,
    record: {
      granted: true,
      version: CONSENT_VERSION,
      // The affirmative act is bounded by the ticket's own issue time; we record
      // the server clock, never a client-supplied timestamp.
      acknowledged_at: new Date(iat).toISOString(),
      recorded_at: new Date(now).toISOString(),
      jti: payload.jti,
      origin: payload.org || null,
    },
  };
}
