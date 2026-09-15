// ── /web-call mint abuse controls ──────────────────────────────────────────────
//
// Dr. Insane RE-GATE R2 blocker B1. Before this module, POST /web-call was an
// unauthenticated, unthrottled, same-origin-optional endpoint that minted a real
// Retell access token — i.e. an anonymous internet caller could burn the firm's
// Retell minutes, and every mint also triggered a Vantage /caller-context lookup.
// The FL §934.03 consent gate that landed in `0ef10e8` is an EVIDENTIARY control
// (it proves which wording a caller saw); it was never an ABUSE control, because
// a valid assertion could be assembled from a public constant. This module is the
// abuse control; consent.js now carries the anti-forgery half.
//
// Three independent layers, each fail-closed:
//   1. checkOrigin   — the mint is same-site only. Cross-origin POSTs are refused.
//   2. checkRateLimit— per-IP fixed window, so one client cannot drain the account.
//   3. verifyTurnstile — Cloudflare Turnstile proves a browser/human, not a script.
//      `challenges.cloudflare.com` was already whitelisted in the CSP for this;
//      it had simply never been wired up.
//
// CONFIGURATION (Cloudflare Pages → Settings → Variables & Secrets).
// Set for BOTH Production and Preview — an unset secret 503s the endpoint, it
// does not fall through to open (same fail-closed rule as tier-auth.js):
//   TURNSTILE_SECRET_KEY   (secret)  — server-side siteverify key
//   WEB_CALL_ALLOWED_ORIGINS (plain, optional) — comma-separated override of the
//                                     built-in production allow-list below.

/** Built-in allow-list. Overridden wholesale by WEB_CALL_ALLOWED_ORIGINS if set. */
const DEFAULT_ALLOWED_ORIGINS = [
  "https://www.donovan.law",
  "https://donovan.law",
];

/** Per-IP fixed-window rate limit for token mints. */
const RATE_LIMIT_MAX = 5; // mints per window per IP
const RATE_LIMIT_WINDOW_S = 300; // 5 minutes

/**
 * Parse the configured origin allow-list.
 * @returns {string[]} normalized origins (no trailing slash, lowercased)
 */
export function allowedOrigins(env) {
  const raw = (env.WEB_CALL_ALLOWED_ORIGINS || "").trim();
  const list = raw
    ? raw.split(",").map((s) => s.trim()).filter(Boolean)
    : DEFAULT_ALLOWED_ORIGINS;
  return list.map((o) => o.replace(/\/+$/, "").toLowerCase());
}

/**
 * Same-site check for a state-changing POST.
 *
 * Uses Origin, falling back to Referer's origin. A request carrying NEITHER is
 * refused rather than allowed: every real browser sends Origin on a cross-origin
 * or same-origin POST with a JSON content-type, so a missing Origin means a
 * non-browser client — exactly what this control exists to stop.
 *
 * SAME-ORIGIN AS AN ADDITIONAL ACCEPT (`opts.allowSameOrigin`), off by default.
 *
 * The fixed allow-list is right for /web-call, where the point is that ONLY the
 * production site may burn Retell minutes — a preview deployment minting real
 * tokens is a cost, so preview being excluded there is the feature.
 *
 * It is wrong for the members endpoints. Those exist on every deployment, and a
 * preview build that cannot sign anyone in cannot be reviewed — which is the whole
 * purpose of a preview. Worse, the failure is a flat 403 that looks identical to an
 * attack being blocked, so the reviewer debugs the wrong thing.
 *
 * Accepting the request's OWN origin is not a relaxation, it is the textbook CSRF
 * check: "the page that submitted this is served from the host it submitted to."
 * On production the origin IS www.donovan.law, so this accepts exactly what the
 * allow-list already accepted and nothing more. What it adds is that the same code
 * works on preview, and on any hostname the site is ever served from, without a
 * variable somebody has to remember to set.
 *
 * @param {Request} request
 * @param {object} env
 * @param {{allowSameOrigin?: boolean}} [opts]
 * @returns {{ok: true, origin: string} | {ok: false, reason: string}}
 */
export function checkOrigin(request, env, opts = {}) {
  const allow = allowedOrigins(env);
  if (opts.allowSameOrigin) {
    try { allow.push(new URL(request.url).origin.toLowerCase()); } catch { /* unparseable → no extra accept */ }
  }

  let origin = (request.headers.get("Origin") || "").trim();
  if (!origin) {
    // Fall back to Referer, taking ONLY its origin component.
    const ref = (request.headers.get("Referer") || "").trim();
    if (ref) {
      try { origin = new URL(ref).origin; } catch { /* malformed → stays empty */ }
    }
  }
  if (!origin) return { ok: false, reason: "no_origin" };

  const norm = origin.replace(/\/+$/, "").toLowerCase();
  if (!allow.includes(norm)) return { ok: false, reason: "origin_not_allowed" };
  return { ok: true, origin: norm };
}

/**
 * Per-IP fixed-window rate limit, backed by the PERCH_ACTIONS KV namespace.
 *
 * HONEST LIMITATION: Workers KV is eventually consistent, so a burst issued in
 * parallel from one IP can overshoot the cap before the counter converges. This
 * is a cost-control and casual-abuse layer, NOT a hard concurrency bound — the
 * hard controls are the origin check and Turnstile, which a script cannot satisfy
 * at all. A strongly-consistent limiter needs a Durable Object; PERCH_BRIDGE is a
 * separately-deployed Worker (perch-do), so adding one is an ops change for David
 * rather than something this PR can land on its own. Tracked as the follow-up in
 * the PR body.
 *
 * Fails OPEN on a KV error — a KV outage must not take the phone line down. The
 * two hard controls still stand in that case.
 *
 * SEPARATE BUCKETS PER ROUTE. `opts` exists so a second caller gets its own
 * counter instead of its own copy of this function — the same reason
 * verifyTurnstile takes a `tag`. Without it, members signing in would spend the
 * phone line's budget and a busy sign-in hour would start refusing calls, which is
 * a coupling nobody would think to look for. Defaults reproduce the /web-call
 * behaviour exactly, so existing callers are unchanged.
 *
 * @param {Request} request
 * @param {object} env
 * @param {number} [now]
 * @param {{bucket?: string, max?: number, windowS?: number, tag?: string}} [opts]
 * @returns {Promise<{ok: true, count: number} | {ok: false, reason: string, retry_after: number}>}
 */
export async function checkRateLimit(request, env, now = Date.now(), opts = {}) {
  const bucket = opts.bucket || "webcall";
  const max = opts.max || RATE_LIMIT_MAX;
  const windowS = opts.windowS || RATE_LIMIT_WINDOW_S;
  const tag = opts.tag || "web-call";

  const kv = env.PERCH_ACTIONS;
  if (!kv) {
    console.warn(`[${tag}] rate-limit SKIPPED — PERCH_ACTIONS KV not bound`);
    return { ok: true, count: 0 };
  }

  const ip = (request.headers.get("CF-Connecting-IP") || "").trim() || "unknown";
  // Fixed window: bucket the clock so the key rolls over on its own and the KV
  // TTL cleans up behind us. No read-modify-write of a shared list.
  const windowStart = Math.floor(now / 1000 / windowS) * windowS;
  const key = `rl:${bucket}:${ip}:${windowStart}`;

  try {
    const prior = parseInt((await kv.get(key)) || "0", 10) || 0;
    if (prior >= max) {
      const retryAfter = windowStart + windowS - Math.floor(now / 1000);
      // Log the outcome and the window, never anything caller-identifying beyond
      // the fact that some IP tripped it.
      console.warn(`[${tag}] RATE_LIMITED count=${prior} window=${windowStart}`);
      return { ok: false, reason: "rate_limited", retry_after: Math.max(1, retryAfter) };
    }
    // TTL slightly past the window so the key cannot outlive its own bucket.
    await kv.put(key, String(prior + 1), { expirationTtl: windowS + 60 });
    return { ok: true, count: prior + 1 };
  } catch (e) {
    console.error(`[${tag}] rate-limit KV error err=${String((e && e.message) || e)}`);
    return { ok: true, count: 0 }; // fail open — see note above
  }
}

/**
 * Verify a Cloudflare Turnstile token against siteverify.
 *
 * FAIL CLOSED on an unset secret: an unconfigured Turnstile must not silently
 * degrade the endpoint back to anonymous minting. That "unset means no-op" shape
 * is precisely the defect Dr. Insane flagged in Vantage's requireWriteSecret and
 * that tier-auth.js already refuses to repeat.
 *
 * This is the ONLY Turnstile implementation in the tree, and TURNSTILE_SECRET_KEY
 * is the ONLY secret name. /booking/create previously carried a second copy that
 * read a differently-named secret (TURNSTILE_SECRET) and fell OPEN when it was
 * unset — two implementations is how the names drifted apart in the first place,
 * so new callers pass a `tag` rather than copying this function.
 *
 * @param {string} token
 * @param {Request} request
 * @param {object} env
 * @param {string} [tag]  log prefix identifying the calling route
 * @returns {Promise<{ok: true} | {ok: false, reason: string, status: number}>}
 */
export async function verifyTurnstile(token, request, env, tag = "web-call") {
  const secret = (env?.TURNSTILE_SECRET_KEY || "").trim();
  if (!secret) {
    console.error(
      `[${tag}] MISCONFIGURED — TURNSTILE_SECRET_KEY not set on this Pages environment; refusing the request.`
    );
    return { ok: false, reason: "turnstile_not_configured", status: 503 };
  }
  if (!token || typeof token !== "string") {
    return { ok: false, reason: "turnstile_missing", status: 403 };
  }

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  const ip = request.headers.get("CF-Connecting-IP");
  if (ip) form.append("remoteip", ip);

  try {
    // Bound the wait — siteverify is on Cloudflare's edge, so this is fast, but a
    // hung verify must not hold the request open indefinitely.
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 5000);
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
      signal: ctl.signal,
    });
    clearTimeout(timer);
    const data = await r.json().catch(() => ({}));
    if (!data || data.success !== true) {
      // Cloudflare's error codes are diagnostic — log them, never relay them.
      console.warn(`[${tag}] TURNSTILE_FAILED codes=${JSON.stringify(data && data["error-codes"] || [])}`);
      return { ok: false, reason: "turnstile_failed", status: 403 };
    }
    return { ok: true };
  } catch (e) {
    // A verify we could not complete is a verify that did not pass.
    console.error(`[${tag}] turnstile_error err=${String((e && e.message) || e)}`);
    return { ok: false, reason: "turnstile_error", status: 503 };
  }
}
