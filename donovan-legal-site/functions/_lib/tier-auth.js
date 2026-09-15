// ── Member-tier HTTP Basic auth ────────────────────────────────────────────────
//
// Port of the four cPanel-managed `.htaccess` files that PR #1 deleted
// (gold/, platinum/, diamond/, reserve/). The originals were:
//
//     AuthType Basic
//     AuthName "Protected 'public_html/<tier>'"
//     AuthUserFile "/home/.../.htpasswds/public_html/<tier>/passwd"
//     Require valid-user
//
// Apache honours those on a static host; Cloudflare Pages does not read
// .htaccess at all, so deleting them silently published all 40 tier URLs.
// This middleware restores the same model at the edge.
//
// FIDELITY NOTES — deliberate choices, not oversights:
//   • Per-tier credentials. Each original tier had its OWN passwd file, so gold
//     credentials never opened diamond. Tiers stay independent here; there is no
//     hierarchy and no shared master credential.
//   • FAIL CLOSED. If a tier's credentials are not configured, the tier serves
//     503 — it does NOT fall through to public. An "unconfigured means open"
//     default is the same shape of bug that left Vantage's /caller-context
//     publicly readable when WRITE_SECRET was unset.
//   • Credentials come from Pages environment variables ONLY. Never hardcoded,
//     never committed, never logged (not even on a failed attempt).
//
// CONFIGURATION (Cloudflare Pages → Settings → Variables & Secrets).
// Set BOTH per tier, as encrypted secrets:
//   TIER_GOLD_USER      TIER_GOLD_PASS
//   TIER_PLATINUM_USER  TIER_PLATINUM_PASS
//   TIER_DIAMOND_USER   TIER_DIAMOND_PASS
//   TIER_RESERVE_USER   TIER_RESERVE_PASS
// Set them for BOTH the Production and Preview environments — a Preview
// deployment with the variables missing will 503 the tier rather than leak it.

/**
 * Constant-time comparison of two strings.
 *
 * Both sides are hashed to a fixed-width SHA-256 digest first, then compared
 * byte-by-byte with no early exit. Hashing equalises the compared length, so
 * neither the length nor the matching-prefix length of the real credential
 * leaks through response timing.
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

/** 401 challenge. Never cached, never echoes what the client sent. */
function unauthorized(tierLabel) {
  return new Response("401 Unauthorized", {
    status: 401,
    headers: {
      // ASCII only — header values must not carry non-ASCII punctuation.
      "WWW-Authenticate": `Basic realm="Donovan Legal - ${tierLabel} Members", charset="UTF-8"`,
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/** 503 — credentials not configured for this tier. Fail closed. */
function notConfigured(tier) {
  console.error(
    `[tier-auth] MISCONFIGURED tier=${tier} — TIER_${tier.toUpperCase()}_USER/_PASS not set on this Pages environment; refusing to serve gated content.`
  );
  return new Response("503 Service Unavailable", {
    status: 503,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

/**
 * Build a Pages Functions middleware that gates everything under one tier.
 *
 * @param {string} tier  lowercase tier slug — "gold" | "platinum" | "diamond" | "reserve"
 */
export function tierGuard(tier) {
  const TIER = tier.toUpperCase();
  const label = tier.charAt(0).toUpperCase() + tier.slice(1);

  return async function onRequest(context) {
    const { request, env, next } = context;

    const user = (env[`TIER_${TIER}_USER`] || "").trim();
    const pass = env[`TIER_${TIER}_PASS`] || "";
    // Fail closed: an unconfigured tier is never a public tier.
    if (!user || !pass) return notConfigured(tier);

    const header = request.headers.get("Authorization") || "";
    // Scheme token is case-insensitive per RFC 7617.
    if (!/^Basic /i.test(header)) return unauthorized(label);

    let decoded;
    try {
      decoded = atob(header.slice(6).trim());
    } catch {
      // Malformed base64 — same generic challenge, no detail to the client.
      return unauthorized(label);
    }

    // Split on the FIRST colon only: RFC 7617 forbids a colon in the user-id but
    // permits one in the password, so "user:pa:ss" must parse as pa:ss.
    const sep = decoded.indexOf(":");
    if (sep < 0) return unauthorized(label);
    const gotUser = decoded.slice(0, sep);
    const gotPass = decoded.slice(sep + 1);

    // Evaluate BOTH comparisons before branching — short-circuiting on the
    // username would reveal whether a guessed username was correct.
    const [okUser, okPass] = await Promise.all([
      timingSafeEqual(gotUser, user),
      timingSafeEqual(gotPass, pass),
    ]);
    if (!(okUser && okPass)) {
      // Log the outcome only. NEVER log the submitted username or password.
      console.warn(`[tier-auth] denied tier=${tier}`);
      return unauthorized(label);
    }

    // Authenticated. Serve the asset, but make sure nothing shared caches it —
    // these pages are member-only and must not be reused across identities.
    const res = await next();
    const out = new Response(res.body, res);
    out.headers.set("Cache-Control", "private, no-store");
    out.headers.append("Vary", "Authorization");
    return out;
  };
}
