// ── POST /members/auth/signout ─────────────────────────────────────────────────
//
// MEMBERS-CLIO-GATED-ACCESS-R1.
//
// Clears the session cookie. That is the whole endpoint.
//
// NOTHING TO REVOKE SERVER-SIDE, BY DESIGN. The session is a signed cookie, not a
// row in a table, so there is no server state to delete and nothing that can drift
// out of step with the browser. The cost of that choice is that a cookie already
// copied elsewhere stays valid until its own expiry — which is why the expiry is
// inside the signed payload and why rotating MEMBERS_SESSION_SECRET invalidates
// every session at once. Sign-out is a convenience for the member; the secret
// rotation is the actual revoke-all.
//
// NO AUTH REQUIRED, AND NO ORIGIN CHECK. Being able to clear your own cookie is not
// a privilege worth gating: the worst a forged cross-origin sign-out achieves is
// logging a member out, and refusing it would mean a member with a damaged session
// could not clear it. Compare the sign-in path, where the same forgery would mint
// access — which is why THAT one is same-site only.

import { clearSession } from "../../_lib/member-auth.js";

export async function onRequest(context) {
  if (context.request.method !== "POST") {
    return new Response("405 Method Not Allowed", {
      status: 405,
      headers: { Allow: "POST", "Cache-Control": "no-store" },
    });
  }

  console.log("[member-signout] outcome=signed_out");
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "private, no-store",
      "Set-Cookie": clearSession(),
    },
  });
}
