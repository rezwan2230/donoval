// ── A 3xx on a credentialed lead push is a refusal, not a hop ────────────────
//
// SHELDON-LEAD-REDIRECT (#143). `fetch` follows redirects by default, so for any
// call made with the platform default the host we chose and the host we finally
// talked to are two different things, decided by a `Location` header — a string
// out of somebody else's response. That is the same defect SHELDON-BOOKING-SINK
// closed inside clioFetch (provider-clio.js), and the two lead pushes in this
// directory do not go through clioFetch, so they never got it.
//
// WHY IT IS WORSE HERE THAN IT WAS AT THE CLIO SINK. The fetch specification
// strips exactly three headers when a redirect crosses origins — `Authorization`,
// `Cookie` and `Proxy-Authorization` (WHATWG fetch §4.4, "HTTP-redirect fetch").
// It strips nothing else. Neither of these two calls is authenticated by any of
// those three:
//
//   · vantage-lead.js authenticates with the CUSTOM header `x-write-secret`,
//     which is not on that list and therefore rides along to whatever host the
//     Location names. Its name, email and phone are in the QUERY STRING, and a
//     canonicalising redirector conventionally re-spells the original query into
//     its Location, so the PII travels too.
//   · grow-lead.js authenticates with `inbox_lead_token` in the JSON BODY, and a
//     307 or 308 preserves method and body verbatim — so the firm's Grow lead
//     capture token and the caller's name, email and phone are forwarded intact.
//
// So on both calls the credential and the PII survive the hop that a bearer token
// would not have survived. Not following is the only refusal that does not depend
// on a runtime's redirect behaviour.
//
// NOTHING HERE REDIRECTS TODAY — probed at branch time, both endpoints answer the
// live request directly (see the PR body's verification table). This is what says
// so, by host, on the first booking after it changes.
//
// SHAPE MATCHES provider-clio.js AT b9ad53b, deliberately: `redirect: "manual"`
// on the request, and a 3xx refused by naming the LOCATION HOST and nothing else.
// That file carries its own inline copy of this logic and is untouched here —
// SHELDON-BOOKING-SINK (PR #138) is in flight across it. Folding the two onto this
// helper is a follow-up once #138 lands, not a merge-conflict to create now.

/**
 * Decide whether a response is a redirect, and describe the refusal if it is.
 *
 * NEVER RETURNS A URL — ours or theirs. The caller's URL carries name, email and
 * phone on the Vantage path (vantage-lead.js says never log it, and this is the
 * function that would otherwise have been the place that did), and the Location is
 * chosen by whoever answered. A HOST is the fact an operator needs to act on and
 * the most that can be said safely.
 *
 * FAILS CLOSED ON EVERY 3xx, which is the point of taking the status first:
 *
 *   · An ABSENT Location is still a refusal. There is no "well-formed redirect"
 *     test to pass — a 3xx we did not follow and a 3xx we could not follow are the
 *     same answer, and reading this as "no Location, so nothing happened, carry on"
 *     would hand the next release a pass-through with no test to catch it.
 *   · A RELATIVE Location is still a refusal. It is resolved only so the host can
 *     be NAMED; resolving it same-host does not make it not a redirect.
 *   · A HOSTLESS Location — one that parses but has no authority, so `mailto:`,
 *     `data:`, `javascript:` — is still a refusal, and is named as HOSTLESS.
 *     It is not the same fact as a malformed header and must not read like one:
 *     "does not parse" sends an operator hunting a truncated `Location` that is
 *     not there, when what actually arrived was a well-formed URL of a scheme
 *     with nobody to name. The scheme itself is not echoed — it is the one part
 *     of a Location this function could still repeat back, and the rule here is
 *     that a HOST is the most that is ever said.
 *   · An UNPARSEABLE Location is still a refusal, named as such.
 *
 * @param {Response} res    the response as returned under `redirect: "manual"`
 * @param {string} base     an absolute URL on the origin that answered, used ONLY as
 *                          the base for resolving a relative Location. Nothing but
 *                          its HOST is ever read from the resolved URL, and neither
 *                          it nor the Location is ever returned or logged.
 *
 *                          PASS THE NARROWEST THING THE CALLER HAS. Both callers are
 *                          correct and they pass different things, which is the whole
 *                          reason this reads "an absolute URL" and not "an origin":
 *                          vantage-lead.js passes the bare origin because ITS request
 *                          URL carries name, email and phone in the query string and
 *                          that URL must not enter this function at all; grow-lead.js
 *                          passes its request URL, which carries no PII because Grow
 *                          takes every field in the body. The host that comes out is
 *                          identical either way.
 * @param {string} label    what answered, for the message (e.g. "vantage /upsert-lead")
 * @returns {string|null}   a PII-free refusal message, or null when `res` is not a 3xx.
 */
export function redirectRefusal(res, base, label) {
  const status = res?.status ?? 0;
  if (status < 300 || status >= 400) return null;

  const loc = res.headers?.get?.("location");

  let named;
  if (!loc) {
    named = "refused a redirect carrying no Location header";
  } else {
    // Parsed once and held, so "did not parse" and "parsed but named no host"
    // stay two different answers. Reading only `.host` collapsed them: both come
    // out as the empty string, and the shape that actually reaches a lead sink
    // in the wild — a `mailto:` in a Location — got labelled malformed.
    let parsed = null;
    try { parsed = new URL(loc, base); } catch (_) { /* named below */ }

    if (!parsed) {
      named = "refused a redirect whose Location does not parse";
    } else if (!parsed.host) {
      named = "refused a redirect whose Location names no host";
    } else {
      named = `refused redirect to host ${parsed.host}`;
    }
  }

  return `${label} answered HTTP ${status} — ${named}`;
}
