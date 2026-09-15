// ── POST /members/auth/signin ──────────────────────────────────────────────────
//
// MEMBERS-CLIO-GATED-ACCESS-R1.
//
// Takes an email address the visitor typed, asks Clio what engagement level that
// contact holds, and — if it holds one — sets the signed session cookie the four
// level middlewares read. Nothing is emailed. Nothing is written to Clio. The only
// outbound write anywhere in this feature is the request-access lead, and that is a
// different endpoint.
//
// THE CREDENTIAL IS AN ASSERTED EMAIL ADDRESS, AND THAT IS A RECORDED TRADE.
// Anyone who knows a member's address can reach that member's level, and this
// endpoint's answer discloses whether a given address is a member. Both are stated
// in the order's accepted-risk section; Plan A (a one-time emailed sign-in link) is
// the named fix and is deliberately out of scope. What follows reduces BULK abuse —
// it does not change that property, and no comment here should imply otherwise.
//
// FOUR LAYERS BEFORE CLIO IS EVER ASKED, each fail-closed, none of them new:
//   1. checkOrigin      same-site only, so a cross-origin page cannot mint sessions
//   2. checkRateLimit   per-IP, in its OWN bucket — see below
//   3. verifyTurnstile  proves a browser, not a script enumerating addresses
//   4. shape checks     on the body, before an address is handed to a lookup
//
// A SEPARATE RATE-LIMIT BUCKET, NOT A SECOND LIMITER. checkRateLimit now takes
// `opts`, so sign-ins count against `rl:member-signin:` while /web-call keeps
// `rl:webcall:`. Sharing one bucket would mean a busy sign-in hour starts refusing
// phone calls — a coupling nobody would think to look for and nothing would report.
// abuse.js states the rule this follows: new callers pass a parameter rather than
// copy the function, because two copies is how TURNSTILE_SECRET and
// TURNSTILE_SECRET_KEY drifted apart.
//
// WHY SIGN-IN TELEMETRY DOES NOT GO TO VANTAGE. The order sketched routing it
// through sendVantageUpsert. That helper writes `/upsert-lead`, which creates or
// updates a LEAD — a member signing in is not a lead, and sending one would put
// existing clients into the firm's new-business dashboard. Sign-in outcomes are
// operational, so they are logged where every other operational signal on this site
// is logged, in the `[module] outcome key=value` shape. Request-access IS a lead and
// still goes to Vantage, from its own endpoint.
//
// WHAT IS LOGGED, AND WHAT IS NOT. Outcome, level, and a SALTED hash of the address
// — never the address itself, never the cookie. The salt is what makes the hash
// non-reversible: an unsalted hash of an email is trivially cracked against a
// candidate list, so it would be the address in all but name. The hash exists only
// so twelve failures from one address are distinguishable from twelve addresses;
// nothing reads it back.
//
// WHAT A MEMBER OPENS IS NEVER LOGGED. That someone signed in is operational.
// What a client is working on is not ours to record.
//
// CONFIGURATION — see functions/_lib/member-auth.js.

import { checkOrigin, checkRateLimit, verifyTurnstile } from "../../_lib/abuse.js";
import { resolveTier, mintSession } from "../../_lib/member-auth.js";

const TAG = "member-signin";

/** Sign-in attempts per IP per window. Turnstile is the hard control; this is cost. */
const SIGNIN_MAX = 10;
const SIGNIN_WINDOW_S = 600; // 10 minutes

function json(body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      // A sign-in answer is per-identity and must never be reused by a shared cache.
      "Cache-Control": "private, no-store",
      ...extraHeaders,
    },
  });
}

/**
 * Salted, non-reversible identifier for one address, for logs only.
 *
 * Returns "" when MEMBERS_HASH_SALT is unset, and the caller then logs no
 * identifier at all. It does NOT fall back to an unsalted hash: a hash that looks
 * anonymous but is reversible is worse than logging nothing, because it invites
 * being treated as anonymous.
 */
async function saltedHash(email, env) {
  const salt = String(env?.MEMBERS_HASH_SALT ?? "").trim();
  if (!salt) return "";
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${salt}:${email}`),
  );
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function handleSignin(context) {
  const { request, env } = context;

  // 0. This environment can only issue a session it can later verify. An unset
  //    signing secret must 503 HERE, before Turnstile and before Clio: HMAC with an
  //    empty key is still a valid HMAC, so minting would succeed and hand out
  //    cookies anyone could forge. Same fail-closed rule, same log shape, as
  //    tier-auth.js and verifyTurnstile.
  if (!String(env?.MEMBERS_SESSION_SECRET ?? "").trim()) {
    console.error(
      `[${TAG}] MISCONFIGURED — MEMBERS_SESSION_SECRET not set on this Pages environment; refusing to issue a session.`,
    );
    return json({ ok: false, reason: "unavailable" }, 503);
  }

  // 1. Same-site only.
  // allowSameOrigin: the members endpoints exist on every deployment, and a
  // preview that cannot sign anyone in cannot be reviewed. On production this
  // accepts exactly what the fixed allow-list already did. See abuse.js.
  const origin = checkOrigin(request, env, { allowSameOrigin: true });
  if (!origin.ok) {
    console.warn(`[${TAG}] denied reason=${origin.reason}`);
    return json({ ok: false, reason: "forbidden" }, 403);
  }

  // 2. Per-IP, in this endpoint's own bucket.
  const rl = await checkRateLimit(request, env, Date.now(), {
    bucket: "member-signin",
    max: SIGNIN_MAX,
    windowS: SIGNIN_WINDOW_S,
    tag: TAG,
  });
  if (!rl.ok) {
    return json({ ok: false, reason: "rate_limited" }, 429, {
      "Retry-After": String(rl.retry_after),
    });
  }

  // 3. Body shape, before anything expensive.
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, reason: "bad_request" }, 400);
  }
  const email = String(body?.email ?? "").trim().toLowerCase();
  const token = body?.turnstileToken ?? body?.["cf-turnstile-response"] ?? "";

  // 4. Turnstile. Deliberately verified BEFORE the address is validated, so a
  //    script cannot use the cheap shape check as a free oracle.
  const ts = await verifyTurnstile(token, request, env, TAG);
  if (!ts.ok) {
    return json({ ok: false, reason: "verification_failed" }, ts.status);
  }

  // A malformed address is refused in the same shape as a non-member. There is no
  // reason to help a caller distinguish "not an email" from "not a member".
  if (!email || email.length > 254 || !email.includes("@")) {
    return json({ ok: false, reason: "not_a_member" }, 200);
  }

  const hash = await saltedHash(email, env);
  const who = hash ? ` id=${hash}` : "";

  let result;
  try {
    result = await resolveTier(email, env);
  } catch (e) {
    // Never surface the underlying error — it can name internal hosts and fields.
    console.error(`[${TAG}] lookup_error err=${String((e && e.message) || e)}${who}`);
    return json({ ok: false, reason: "unavailable" }, 503);
  }

  // Clio could not answer, or answered something this build refuses to interpret.
  // FAIL CLOSED, and say which, because these are the states an operator has to fix.
  if (!result.tier && result.reason !== "no_tier" && result.reason !== "bad_input") {
    console.error(`[${TAG}] denied reason=${result.reason}${who}`);
    const misconfigured =
      result.reason === "option_map_unavailable" || result.reason === "clio_unreachable";
    return json({ ok: false, reason: misconfigured ? "unavailable" : "not_a_member" },
      misconfigured ? 503 : 200);
  }

  // Not a member. A contact with a blank level and no contact at all answer
  // IDENTICALLY — the response must not disclose which, and neither does the log.
  if (!result.tier) {
    console.log(`[${TAG}] outcome=not_a_member${who}`);
    return json({ ok: false, reason: "not_a_member" }, 200);
  }

  // A member. The level is returned VERBATIM as Clio spelled it; this endpoint does
  // not know what levels exist, does not rank them, and does not name any room. The
  // sign-in card maps the label to a room name and falls back to the plain label for
  // one it has never seen — which is what lets the firm add a level without a deploy.
  const cookie = await mintSession(result.tier, env);
  console.log(`[${TAG}] outcome=signed_in tier=${result.tier}${who}`);
  return json({ ok: true, tier: result.tier }, 200, { "Set-Cookie": cookie });
}

/**
 * ONE EXPORT, dispatching on the method itself.
 *
 * Pages resolves `onRequest` and `onRequestPost` by a precedence rule, and relying
 * on which one wins is the kind of detail that is correct until someone upgrades
 * something. A single handler cannot be ambiguous. Anything but POST gets 405 with
 * no body — a GET to this path should reveal nothing about what lives here.
 */
export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("405 Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST", "Cache-Control": "no-store" },
    });
  }
  return handleSignin(context);
}
