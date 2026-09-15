// ── JAY-TRACKING-C2: Meta Conversions API (server-side) ──────────────────────
//
// Reports a confirmed booking to Meta from the edge, as well as from the
// browser. Both copies carry the SAME `event_id`, so Meta collapses them into
// one conversion rather than counting two.
//
// WHY BOTH, WHEN THE PIXEL ALREADY FIRES
//
// The pixel is the copy that gets lost. Ad blockers, iOS Private Relay, tracking
// protection in Safari and Firefox, a tab closed on the confirmation screen — a
// site like this can expect to lose a meaningful share of browser events, and it
// loses them non-randomly: the privacy-conscious, higher-income visitor is
// exactly the one this firm most wants to count. The server copy is sent from
// our own edge after Clio has confirmed the appointment, so nothing in the
// visitor's browser can suppress it.
//
// It is also the only copy that can be trusted. A browser event says "a page
// claims a booking happened". This one is sent after the provider returned a
// confirmation, and it carries the tier — which never leaves the server.
//
// ── SAFETY ───────────────────────────────────────────────────────────────────
//
// This module is called from `functions/booking/create.js`, which writes to
// Paul's live Clio calendar. It therefore obeys three rules without exception:
//
//   1. It NEVER throws. Every path returns a result object.
//   2. It is OFF unless `META_CAPI=on` AND a token is present.
//   3. It is invoked via `waitUntil`, never awaited in the response path, so a
//      slow or down Meta endpoint cannot delay or fail a booking.
//
// A failure here must cost an analytics event and nothing else.
//
// ── PII ──────────────────────────────────────────────────────────────────────
//
// Email, phone and name go to Meta as SHA-256 hashes, normalised first per
// Meta's spec. Raw values are never transmitted and never logged — the log line
// at the end carries a status code and a count, nothing else.

const GRAPH_VERSION = "v21.0";

/** Meta rejects anything older than 7 days; we send immediately, this is a guard. */
const MAX_EVENT_AGE_SEC = 7 * 24 * 60 * 60;

/**
 * On unless explicitly enabled — same shape as `analyticsEnabled`, and
 * deliberately NOT defaulting on for previews. A preview firing real
 * conversions would corrupt the live dataset, and unlike a bad page that is not
 * something you can roll back.
 */
export function capiEnabled(env) {
  const flag = env && typeof env.META_CAPI === "string" ? env.META_CAPI.trim().toLowerCase() : "";
  return flag === "on" && !!(env && env.META_CAPI_TOKEN) && !!(env && env.META_DATASET_ID);
}

/**
 * The deduplication key for a booking, derived identically in both places.
 *
 * ── THIS IS THE WHOLE DEDUP CONTRACT, SO READ IT BEFORE CHANGING IT ─────────
 *
 * Meta collapses a browser event and a server event into one conversion only
 * when `event_name` AND `event_id` both match. The browser fires
 * `booking_confirmed` from a postMessage the moment the widget confirms; the
 * edge fires this one after Clio returns. Neither can see the other's random
 * id, so instead both DERIVE the same id from the one value they both already
 * hold: the Perch `call_id`.
 *
 * The browser half lives in `js/analytics/tracker.js` and MUST produce a byte-
 * identical string. Changing the format here without changing it there does not
 * break anything loudly — it just silently starts counting every booking twice,
 * which then inflates every bid Google and Meta place on real money.
 *
 * @see js/analytics/tracker.js — the matching derivation
 */
export function bookingEventId(callId) {
  const id = String(callId || "").trim();
  return id ? `dlbk_${id}` : "";
}

/** SHA-256 → lowercase hex, which is the only encoding Meta accepts. */
async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Normalise then hash, per Meta's advanced-matching rules.
 *
 * Normalisation is not cosmetic. Meta matches on the hash, so `Paul@Donovan.Law`
 * and `paul@donovan.law` are different people unless we lower-case first. Getting
 * this wrong does not error — it silently produces a match rate of zero, which is
 * the worst kind of bug because the events still arrive and look fine.
 */
async function hashEmail(v) {
  const s = String(v || "").trim().toLowerCase();
  return s.includes("@") ? [await sha256Hex(s)] : undefined;
}

/**
 * Phone: digits only, with a country code. Meta assumes nothing.
 *
 * The booking form does not collect a country, and this firm's clients are
 * overwhelmingly US, so a 10-digit number is prefixed with `1`. An 11-digit
 * number already starting `1` is left alone. Anything else is passed through as
 * digits and left to Meta to match or not — better a missed match than a wrong
 * one attached to a real person's conversion.
 */
async function hashPhone(v) {
  let d = String(v || "").replace(/\D/g, "");
  if (!d) return undefined;
  if (d.length === 10) d = "1" + d;
  if (d.length < 7) return undefined;
  return [await sha256Hex(d)];
}

/** Names: lower-case, letters only, split so Meta gets `fn` and `ln` separately. */
async function hashName(full) {
  const parts = String(full || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z\s'-]/g, "")
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return {};
  const out = { fn: [await sha256Hex(parts[0])] };
  if (parts.length > 1) out.ln = [await sha256Hex(parts[parts.length - 1])];
  return out;
}

/**
 * Build the `user_data` block.
 *
 * `client_ip_address` and `client_user_agent` are NOT hashed — Meta requires
 * them raw, and they are the fields that let a server event match a browser
 * session at all. `fbp`/`fbc` are the pixel's own cookies; when present they are
 * by far the strongest match signal, which is why they are read off the request
 * even though the browser copy already sent them.
 */
export async function buildUserData({ email, phone, name, ip, userAgent, fbp, fbc } = {}) {
  const ud = {};

  const em = await hashEmail(email);
  if (em) ud.em = em;

  const ph = await hashPhone(phone);
  if (ph) ud.ph = ph;

  Object.assign(ud, await hashName(name));

  if (ip) ud.client_ip_address = ip;
  if (userAgent) ud.client_user_agent = userAgent;
  if (fbp) ud.fbp = fbp;
  if (fbc) ud.fbc = fbc;

  return ud;
}

/** Pull `_fbp` / `_fbc` out of the request's Cookie header. */
export function readFbCookies(cookieHeader) {
  const out = {};
  if (typeof cookieHeader !== "string" || !cookieHeader) return out;
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    const v = part.slice(i + 1).trim();
    if (k === "_fbp" && v) out.fbp = v;
    if (k === "_fbc" && v) out.fbc = v;
  }
  return out;
}

/**
 * Send one conversion.
 *
 * Returns `{ sent, skipped?, status?, error? }` and never throws. The caller is
 * inside a confirmed booking; there is no failure here worth surfacing to a
 * client who has just successfully booked a meeting with their attorney.
 *
 * @param {object} env      Worker env — reads META_CAPI, META_CAPI_TOKEN, META_DATASET_ID.
 * @param {object} event
 * @param {string} event.eventName    e.g. 'Schedule'
 * @param {string} event.eventId      MUST equal the browser copy's id, or it double-counts.
 * @param {string} [event.eventSourceUrl]
 * @param {number} [event.value]
 * @param {string} [event.currency]
 * @param {object} [event.userData]   from buildUserData()
 * @param {object} [event.customData] extra, non-PII
 * @param {number} [event.eventTime]  unix seconds; defaults to now
 * @param {Function} [fetchImpl]      injected for tests
 */
export async function sendConversion(env, event = {}, fetchImpl) {
  if (!capiEnabled(env)) return { sent: false, skipped: "disabled" };

  const {
    eventName,
    eventId,
    eventSourceUrl,
    value,
    currency,
    userData = {},
    customData = {},
    eventTime,
  } = event;

  if (!eventName) return { sent: false, skipped: "no_event_name" };

  // No event_id means Meta cannot deduplicate, and the browser pixel has almost
  // certainly already reported this same booking. Sending anyway would inflate
  // the conversion count — which then inflates the bid. Refusing is correct.
  if (!eventId) return { sent: false, skipped: "no_event_id" };

  const now = Math.floor(Date.now() / 1000);
  let ts = Number.isFinite(eventTime) ? Math.floor(eventTime) : now;
  if (ts > now || now - ts > MAX_EVENT_AGE_SEC) ts = now;

  const custom = { ...customData };
  if (Number.isFinite(value) && value > 0) {
    custom.value = value;
    custom.currency = currency || "USD";
  }

  const body = {
    data: [
      {
        event_name: eventName,
        event_time: ts,
        event_id: eventId,
        action_source: "website",
        ...(eventSourceUrl ? { event_source_url: eventSourceUrl } : {}),
        user_data: userData,
        ...(Object.keys(custom).length ? { custom_data: custom } : {}),
      },
    ],
  };

  // Test events show up in Events Manager's Test Events tab and are excluded
  // from reporting — the only safe way to verify this end to end against the
  // real dataset before trusting it.
  if (env.META_TEST_EVENT_CODE) body.test_event_code = env.META_TEST_EVENT_CODE;

  const url =
    `https://graph.facebook.com/${GRAPH_VERSION}/` +
    `${encodeURIComponent(env.META_DATASET_ID)}/events` +
    `?access_token=${encodeURIComponent(env.META_CAPI_TOKEN)}`;

  const doFetch = fetchImpl || fetch;

  try {
    const res = await doFetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      // Status only. Meta echoes submitted fields in its error bodies, so
      // logging the body could put hashed — and occasionally raw — client data
      // into Cloudflare's log stream.
      console.warn(`[meta-capi] ${eventName} rejected: HTTP ${res.status}`);
      return { sent: false, status: res.status, error: "http_error" };
    }

    console.log(`[meta-capi] ${eventName} accepted (match fields: ${Object.keys(userData).length})`);
    return { sent: true, status: res.status };
  } catch (e) {
    console.warn(`[meta-capi] ${eventName} failed: ${String(e?.message ?? e)}`);
    return { sent: false, error: "network_error" };
  }
}
