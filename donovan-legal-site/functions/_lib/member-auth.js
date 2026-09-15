// functions/_lib/member-auth.js
//
// MEMBERSHIP GATE — Clio is the roster, this file is the door.
//
// The firm admits a member by setting ONE picklist field, "Membership Tier", on
// that person's Clio contact. Nothing about membership is stored on the website:
// no member list, no passwords, no roster file. A paralegal changes a dropdown in
// the system they already live in, and the door here reflects it on the member's
// next sign-in.
//
// THE ONE RULE THIS FILE EXISTS TO PROTECT: no tier names live in this code.
// Not a list, not an enum, not a mapping table. The gate compares the string Clio
// returned against the name of the folder being requested. That is the whole
// decision. It means the firm can add "Sapphire" by creating a picklist option and
// a /sapphire/ folder — with no deploy, no ticket, and no engineer. The moment a
// tier list appears in here, administration has leaked back onto the website and
// the property is gone.
//
// WHAT A PICKLIST RETURNS, AND WHY THERE IS A SECOND CALL. Clio's custom-field
// values come back as the picklist OPTION ID, not the label:
//
//     Membership Tier value = "11238563"        NOT "Gold"
//
// This differs from the twelve Intake fields, which are `text_line` and answer with
// their label directly — which is exactly why it is worth a comment. Resolving the
// id needs a second read of /custom_fields, so that map is cached per isolate the
// same way booking/_lib/clio-custom-fields.js caches the Intake field ids. The
// MEMBERSHIP read is never cached: revocation has to bite on the next sign-in.
//
// FAIL CLOSED, EVERY PATH. Clio unreachable, a malformed body, an option id the
// cached map has never seen, a contact matching more than one record — all deny.
// A membership gate that fails open is worse than no gate, because it looks like
// one.
//
// CONFIGURATION (Cloudflare Pages → Settings → Variables & Secrets).
// Set these for BOTH the Production and Preview environments — a Preview
// deployment with them missing 503s the level rather than leaking it:
//
//   MEMBERS_SESSION_SECRET     HMAC key for the session cookie. Rotating it ends
//                              every session at once — the emergency revoke-all.
//   MEMBERS_HASH_SALT          salt for the sign-in telemetry hash. SALTED: an
//                              unsalted hash of an email is trivially reversible
//                              against a candidate list.
//   CLIO_MEMBERS_CLIENT_ID     optional; falls back to CLIO_* (see creds() below)
//   CLIO_MEMBERS_CLIENT_SECRET
//   CLIO_MEMBERS_REFRESH_TOKEN
//   TURNSTILE_SITE_KEY         already present. Reused, not duplicated.
//   TURNSTILE_SECRET_KEY
//
// SEE ALSO
//   docs/MEMBERS-CLIO-GATED-ACCESS-R1.md  the order — build spec, test contract, rollback
//   functions/_lib/tier-auth.js           the temporary gate this replaces; its
//                                         503-fail-closed and timing-safe compare
//                                         are inherited here deliberately
//   functions/_lib/abuse.js               verifyTurnstile / checkRateLimit — reused, not rebuilt
//   functions/_lib/qualifier-cookie.js    the house cookie attribute string
//   docs/members-v2/                      the four tickets (#186–#189)

const CLIO_BASE = "https://app.clio.com/api/v4";
const CLIO_TOKEN_URL = "https://app.clio.com/oauth/token";
const TIER_FIELD_NAME = "Membership Tier";

/** Refresh 10 minutes before a typical 60-minute expiry — mirrors provider-clio.js. */
const TOKEN_REFRESH_INTERVAL_MS = 50 * 60 * 1000;

export const MEMBER_COOKIE = "dl_member";

/**
 * Sliding window. Each page load inside a tier renews it, so this is time since the
 * member last did anything — not time since they signed in. Someone working through
 * an afternoon is never interrupted; a laptop left open in a lobby still locks.
 *
 * The cookie is ALSO session-scoped (no Max-Age), so closing the browser ends it
 * regardless. Whichever comes first.
 */
export const MEMBER_SESSION_MAX_AGE_S = 60 * 60 * 12;

/** Same attribute string as the qualifier cookie. Path=/ is deliberate — see below. */
const COOKIE_ATTRS = "Path=/; HttpOnly; Secure; SameSite=Lax";

// ─────────────────────────────────────────────────────────────────────────────
// Credentials
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The gate prefers its OWN Clio binding and falls back to the booking one.
 *
 * WHY A SEPARATE BINDING IS OFFERED AT ALL. Preview and Production carry different
 * `CLIO_*` values — Preview points at a different Clio account (verified: the two
 * environments return different calendar availability). A preview build reading
 * Preview's Clio would look for "Membership Tier" in an account that has never had
 * it and deny every member, which reads as a broken build rather than a
 * misconfiguration. `CLIO_MEMBERS_*` lets the gate point at the firm's Clio in both
 * environments. That is safe here and nowhere else in this codebase, because this
 * file only ever issues GET requests.
 */
function creds(env) {
  const pick = (a, b) => (String(env?.[a] ?? "").trim() || String(env?.[b] ?? "").trim());
  return {
    clientId: pick("CLIO_MEMBERS_CLIENT_ID", "CLIO_CLIENT_ID"),
    clientSecret: pick("CLIO_MEMBERS_CLIENT_SECRET", "CLIO_CLIENT_SECRET"),
    refreshToken: pick("CLIO_MEMBERS_REFRESH_TOKEN", "CLIO_REFRESH_TOKEN"),
  };
}

const tokenCache = new Map();

async function accessToken(env) {
  const { clientId, clientSecret, refreshToken } = creds(env);
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("member-auth: Clio credentials not configured");
  }
  const cached = tokenCache.get(clientId);
  if (cached && Date.now() - cached.at < TOKEN_REFRESH_INTERVAL_MS) return cached.token;

  const res = await fetch(CLIO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
    }).toString(),
  });
  if (!res.ok) throw new Error(`member-auth: token refresh HTTP ${res.status}`);
  const data = await res.json();
  if (!data?.access_token) throw new Error("member-auth: token response carried no access_token");

  tokenCache.set(clientId, { token: data.access_token, at: Date.now() });
  return data.access_token;
}

async function clioGet(path, env) {
  const token = await accessToken(env);
  return fetch(`${CLIO_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    redirect: "manual", // a redirect on a credentialed read is refused, never followed
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// The picklist option map  (id → label)
// ─────────────────────────────────────────────────────────────────────────────

let optionMap = null;       // Map<string id, string label>
let optionMapAt = 0;
const OPTION_MAP_TTL_MS = 60 * 60 * 1000;

/**
 * Cached per isolate. The map only changes when somebody edits the field itself,
 * so an hour is generous; the MEMBERSHIP read that actually decides access is never
 * cached.
 *
 * Returns null on any failure, and every caller treats null as "deny" rather than
 * "allow everything" — see resolveTier.
 */
async function tierOptionMap(env) {
  if (optionMap && Date.now() - optionMapAt < OPTION_MAP_TTL_MS) return optionMap;

  const fields = "id,name,field_type,picklist_options{id,option}";
  let res;
  try {
    res = await clioGet(
      `/custom_fields.json?parent_type=contact&deleted=false&limit=200&fields=${encodeURIComponent(fields)}`,
      env,
    );
  } catch {
    return null;
  }
  if (!res.ok) return null;

  let body;
  try { body = await res.json(); } catch { return null; }

  const field = (body?.data || []).find(
    (f) => String(f?.name ?? "").trim() === TIER_FIELD_NAME,
  );
  if (!field) return null;

  const map = new Map();
  for (const opt of field.picklist_options || []) {
    if (opt?.id != null && opt?.option) map.set(String(opt.id), String(opt.option));
  }
  if (map.size === 0) return null;

  optionMap = map;
  optionMapAt = Date.now();
  return optionMap;
}

// ─────────────────────────────────────────────────────────────────────────────
// The lookup
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Resolve the membership tier for an email address.
 *
 * @returns {Promise<{ tier: string|null, reason: string }>}
 *   tier is the LABEL EXACTLY AS THE FIRM TYPED IT IN CLIO — "Gold", "Sapphire",
 *   whatever. This function never validates it against a list, because there is no
 *   list. `reason` is for logging only and is never shown to the visitor.
 *
 * A null tier means "not a member" and must be indistinguishable to the caller from
 * "no such contact" — the sign-in response must not reveal which.
 */
export async function resolveTier(email, env) {
  const addr = String(email ?? "").trim().toLowerCase();
  if (!addr || addr.length > 254 || !addr.includes("@")) return { tier: null, reason: "bad_input" };

  const map = await tierOptionMap(env);
  if (!map) return { tier: null, reason: "option_map_unavailable" };

  const fields = "id,custom_field_values{value,field_name}";
  let res;
  try {
    res = await clioGet(
      `/contacts.json?type=Person&limit=10&query=${encodeURIComponent(addr)}&fields=${encodeURIComponent(fields)}`,
      env,
    );
  } catch {
    return { tier: null, reason: "clio_unreachable" };
  }
  if (!res.ok) return { tier: null, reason: `clio_http_${res.status}` };

  let body;
  try { body = await res.json(); } catch { return { tier: null, reason: "unreadable_body" }; }

  const found = [];
  for (const contact of body?.data || []) {
    for (const v of contact?.custom_field_values || []) {
      if (String(v?.field_name ?? "").trim() !== TIER_FIELD_NAME) continue;
      if (v?.value == null || v.value === "") continue;
      const label = map.get(String(v.value));
      // An id the map has never seen means a tier was added in Clio since this
      // isolate cached the map. Deny — never guess, never default.
      if (!label) return { tier: null, reason: "unmapped_option" };
      found.push(label);
    }
  }

  if (found.length === 0) return { tier: null, reason: "no_tier" };

  // One address on several contacts carrying DIFFERENT tiers is unresolvable, and
  // guessing would either over- or under-grant. This has happened on this account
  // (duplicate contacts sharing one address), so it is a real path, not a
  // theoretical one. Refuse and let the firm fix the duplicate.
  const distinct = [...new Set(found)];
  if (distinct.length > 1) return { tier: null, reason: "ambiguous_contacts" };

  return { tier: distinct[0], reason: "ok" };
}

// ─────────────────────────────────────────────────────────────────────────────
// The session cookie
// ─────────────────────────────────────────────────────────────────────────────
//
// PAYLOAD IS TIER AND EXPIRY. NOTHING ELSE.
// No email, no name, no contact id. After sign-in the address has served its
// purpose, and a cookie that carries no personal data is a cookie that cannot leak
// any. It also means the value is meaningless to anyone who obtains it without the
// signing secret.
//
// PATH=/ RATHER THAN /gold. Path-scoping looks tighter and is worse here: a
// Platinum member landing on /gold/ would present no cookie at all, the gate would
// see an anonymous visitor, and they would be asked to sign in again. That is the
// dead-end this work exists to remove. One cookie at / lets any tier page read the
// tier and offer the member their own room.

function b64urlEncode(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  const pad = str.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(pad + "=".repeat((4 - (pad.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * @returns {string} the signing secret, or "" when unconfigured.
 *
 * Returning "" rather than throwing is deliberate: an unconfigured environment must
 * reach `notConfigured()` and answer 503 loudly. It must NOT be swallowed into
 * "no valid session", which would silently redirect every member to sign-in and log
 * nothing — indistinguishable from "everybody got logged out", and the same
 * silent-miss shape callmap-key.js was written to remove.
 */
function sessionSecret(env) {
  return String(env?.MEMBERS_SESSION_SECRET ?? "").trim();
}

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return b64urlEncode(new Uint8Array(sig));
}

/**
 * Constant-time comparison — the same shape tier-auth.js uses, kept identical on
 * purpose.
 *
 * Both sides are hashed to a fixed-width SHA-256 digest FIRST, then compared
 * byte-by-byte with no early exit. Hashing equalises the compared length, so
 * neither the length nor the matching-prefix length of the real signature leaks
 * through response timing. A compare that returns early on a length mismatch —
 * which is the obvious way to write this — leaks exactly that.
 */
async function timingSafeEqual(a, b) {
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
 * 503 — this environment cannot make an access decision, so it refuses to serve.
 *
 * Mirrors tier-auth.js's notConfigured(): fail closed AND say so, because the only
 * person who can fix a missing Pages variable is looking at the logs.
 */
function notConfigured(tier, missing) {
  console.error(
    `[member-auth] MISCONFIGURED tier=${tier} — ${missing} not set on this Pages environment; refusing to serve gated content.`
  );
  return new Response("503 Service Unavailable", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * @returns {Promise<string>} a Set-Cookie value carrying a signed { tier, exp }.
 * @throws if MEMBERS_SESSION_SECRET is unset.
 *
 * THROWING HERE IS THE POINT. HMAC with an empty key is a perfectly valid HMAC, so
 * an unconfigured environment would happily mint cookies that anyone who noticed
 * could forge — a gate that appears to work and admits everybody. Callers must
 * check the secret and 503 before reaching this; the throw is the backstop for the
 * one that forgets.
 */
export async function mintSession(tier, env, now = Date.now()) {
  if (!sessionSecret(env)) throw new Error("member-auth: MEMBERS_SESSION_SECRET not set");
  const payload = JSON.stringify({ t: tier, e: now + MEMBER_SESSION_MAX_AGE_S * 1000 });
  const body = b64urlEncode(new TextEncoder().encode(payload));
  const sig = await hmac(sessionSecret(env), body);
  // No Max-Age: a session cookie, so closing the browser also ends it. The absolute
  // expiry inside the payload is the second, independent bound.
  return `${MEMBER_COOKIE}=${body}.${sig}; ${COOKIE_ATTRS}`;
}

export function clearSession() {
  return `${MEMBER_COOKIE}=; ${COOKIE_ATTRS}; Max-Age=0`;
}

export function readCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}

/**
 * Verify a session cookie.
 *
 * @returns {Promise<string|null>} the tier label, or null for absent / forged /
 *   tampered / expired. The caller cannot tell those apart, and does not need to.
 */
export async function readSession(request, env, now = Date.now()) {
  const raw = readCookie(request, MEMBER_COOKIE);
  if (!raw) return null;

  const dot = raw.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);

  const secret = sessionSecret(env);
  if (!secret) return null; // memberGuard has already 503'd; this path is for direct callers

  let expected;
  try { expected = await hmac(secret, body); } catch { return null; }
  if (!(await timingSafeEqual(sig, expected))) return null;

  let payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(b64urlDecode(body)));
  } catch {
    return null;
  }
  if (!payload?.t || typeof payload.e !== "number" || now >= payload.e) return null;
  return String(payload.t);
}

// ─────────────────────────────────────────────────────────────────────────────
// The gate
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Guard one tier folder.
 *
 * `folder` is the directory name — "gold", "reserve", "sapphire". It is compared
 * case-insensitively against whatever Clio said. There is no list to be a member of
 * and no rank to outrank: your tier opens your folder.
 *
 * RUNS ON EVERY PAGE, not just the index. A member who bookmarks or is sent a deep
 * link meets the same check as someone arriving at the front.
 *
 * The redirect carries the folder that was asked for and the tier actually held, so
 * the sign-in card can say "you're a Platinum member — enter The Partners Room"
 * instead of stopping dead. Both values are echoed verbatim; the card decides how to
 * present them, because the room names live in js/members-gate.js and this file is
 * not going to learn them.
 */
export function memberGuard(folder) {
  const want = String(folder).toLowerCase();

  return async function onRequest(context) {
    const { request, env, next } = context;

    // FAIL CLOSED, LOUDLY — before anything else. An environment with no signing
    // secret cannot verify a session, so it cannot make an access decision, so it
    // serves nothing. 503 and not a redirect: a redirect would look like a member
    // being asked to sign in again and would leave no trace of the real cause.
    if (!sessionSecret(env)) return notConfigured(want, "MEMBERS_SESSION_SECRET");

    const tier = await readSession(request, env);

    if (tier && tier.toLowerCase() === want) {
      const res = await next();
      // Slide the window on every page inside the tier.
      try {
        const out = new Response(res.body, res);
        out.headers.append("Set-Cookie", await mintSession(tier, env));
        out.headers.set("Cache-Control", "private, no-store");
        return out;
      } catch {
        return res;
      }
    }

    // No session, or a session for a different level. Send them to the PUBLIC page
    // for the level they asked for — membership-gold.html and its three siblings
    // already exist, are indexed, carry the level description in the firm's voice,
    // and end in the consultation CTA. JORDAN-MEMBERS-MARKETING shipped them. There
    // is nothing to build here and nothing to invent.
    //
    // `holds` is echoed VERBATIM, whatever Clio said. The card uses it to offer the
    // member their own room by name. This file does not know the room names and is
    // not going to learn them — that is what lets the firm add a level without a
    // deploy.
    const url = new URL(request.url);
    const to = new URL(`/membership-${want}`, url.origin);
    to.searchParams.set("signin", "1");
    if (tier) to.searchParams.set("holds", tier);
    console.warn(`[member-auth] denied tier=${want}${tier ? " reason=wrong_level" : " reason=no_session"}`);

    // NO-STORE ON THE REDIRECT TOO, not only on the 200 and the 503.
    //
    // This redirect is per-identity: the same URL answers 302 for a signed-out
    // visitor and 200 for a member. A 302 is not cacheable by default, but "by
    // default" depends on every intermediary agreeing, and the failure mode is
    // quiet — a member signs in, navigates to their own room, and is bounced back
    // to the sign-in page by a cached redirect with nothing anywhere going red.
    //
    // Response.redirect() returns an immutable response, so it is rebuilt rather
    // than mutated.
    const res = Response.redirect(to.toString(), 302);
    const out = new Response(null, {
      status: 302,
      headers: {
        Location: res.headers.get("Location"),
        "Cache-Control": "private, no-store",
        Vary: "Cookie",
      },
    });
    return out;
  };
}
