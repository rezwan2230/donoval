// ── GET /consent-notice ────────────────────────────────────────────────────────
//
// Serves the canonical FL §934.03 pre-recording disclosure that the browser must
// display and the caller must affirmatively accept before /web-call will mint a
// Retell token.
//
// The text lives server-side so the wording shown to the caller and the wording
// recorded in the consent audit trail cannot drift apart, and so Paul can revise
// it in one place (functions/_lib/consent.js) without touching every page that
// starts a call.
//
// Response: 200 { version, text, decline }

// This endpoint is also where the CONSENT TICKET is minted (Dr. Insane RE-GATE R2,
// finding B1). The ticket is the server-issued, HMAC-signed artifact the browser
// must hand back to /web-call; because the client cannot produce a valid signature,
// a fabricated consent value no longer mints a Retell token. Issuing it here — at
// the moment the disclosure is served — is what binds "the wording you were shown"
// to "the consent you returned". See _lib/consent-ticket.js.

import { CONSENT_VERSION, DISCLOSURE_TEXT, DECLINE_OPTIONS } from "./_lib/consent.js";
import { issueConsentTicket } from "./_lib/consent-ticket.js";
import { checkOrigin } from "./_lib/abuse.js";

export async function onRequestGet(context) {
  const { request, env } = context;

  // Bind the ticket to the requesting origin so one lifted from this response is
  // useless on another site. A request with no usable origin still gets the
  // disclosure TEXT (it is public, and refusing it would just hide the wording),
  // but gets no ticket — and without a ticket /web-call will not mint.
  const origin = checkOrigin(request, env);
  const issued = origin.ok
    ? await issueConsentTicket(env, { origin: origin.origin })
    : { ok: false, reason: origin.reason };

  if (!issued.ok) {
    console.warn(`[consent-notice] no ticket issued reason=${issued.reason}`);
  }

  return new Response(
    JSON.stringify({
      version: CONSENT_VERSION,
      text: DISCLOSURE_TEXT,
      decline: DECLINE_OPTIONS,
      // Absent when we could not issue one. The client treats a missing ticket as
      // "cannot take consent" and refuses to start a recorded call — fail closed.
      ticket: issued.ok ? issued.ticket : null,
      expires_in: issued.ok ? issued.expires_in : 0,
      // Turnstile's SITE key is public by design (it ships in the page that renders
      // the widget); the SECRET key never leaves the server. It is delivered here
      // rather than hardcoded because this is a static site with no build-time env
      // injection, and hardcoding it would mean a key rotation required a code
      // change to 145 HTML files.
      turnstile_site_key: (env && env.TURNSTILE_SITE_KEY || "").trim() || null,
    }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        // Must not be cached: a revised disclosure has to reach callers immediately,
        // a stale version string would be rejected by /web-call anyway, and the
        // ticket is single-use — a cached one would be spent on arrival.
        "Cache-Control": "no-store",
      },
    }
  );
}
