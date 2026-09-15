// ── GET /members/auth/config ───────────────────────────────────────────────────
//
// MEMBERS-CLIO-GATED-ACCESS-R1.
//
// Hands the sign-in card the Turnstile SITE key. That is the only thing it returns
// and the only thing it will ever be allowed to return.
//
// WHY AN ENDPOINT FOR A PUBLIC VALUE. A Turnstile site key is public by design — it
// ships in page source wherever a widget renders, and js/booking-widget.js holds a
// literal copy of this one. Serving it from `env` anyway costs ten lines and removes
// a specific failure: if the key is ever rotated, a hard-coded copy keeps rendering
// a widget whose tokens the server now rejects, so every member is refused at
// sign-in with a "verification failed" that names nothing. Reading the SITE key from
// the same environment that holds the SECRET key means the two cannot drift out of
// step. abuse.js records what that drift already cost once, when TURNSTILE_SECRET
// and TURNSTILE_SECRET_KEY became two different names for one idea.
//
// WHAT MUST NEVER BE ADDED HERE. No secret, no Clio value, no member data, no
// environment listing. An unauthenticated GET is the widest surface this feature
// has; it stays a single public constant so there is nothing to reason about.
//
// A null key is NOT an error status. Turnstile being unconfigured is a
// server-side condition the sign-in POST already fails closed on (verifyTurnstile
// 503s). Answering 200 with `null` lets the card render and say something useful
// rather than showing a network error for a problem the visitor cannot cause.

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method !== "GET") {
    return new Response("405 Method Not Allowed", {
      status: 405,
      headers: { Allow: "GET", "Cache-Control": "no-store" },
    });
  }

  return new Response(
    JSON.stringify({
      turnstileSiteKey: String(env?.TURNSTILE_SITE_KEY ?? "").trim() || null,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        // Public and stable, but short-lived so a key rotation takes effect in
        // minutes rather than whenever a browser feels like revalidating.
        "Cache-Control": "public, max-age=300",
      },
    },
  );
}
