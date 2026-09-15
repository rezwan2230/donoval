// ── The qualifier→booking join key, carried by the browser ───────────────────
//
// SHELDON-QUALIFIER-BOOKING-JOIN-R1 · issue #153, task 2.
//
// ── THE DEFECT THIS EXISTS TO CLOSE ──────────────────────────────────────────
// A caller finishes the Perch qualifier, Paula opens the calendar, the call ends,
// and the caller books. Clio gets the contact, the calendar entry, the attendee,
// the Zoom link and the confirmation email — and NONE of the seven Intake fields,
// because the booking never named the qualifier record it belonged to.
//
// The record was never lost. `fn/qualifier_submit` writes `qualbk:<call_id>` to
// PERCH_ACTIONS with a SIX HOUR TTL, and `booking/_lib/qualifier-bind.js` treats
// that copy alone as confirming — it is built precisely for the case where the call
// is over and the read-once bridge slot is long gone. The record sat in KV, valid,
// with hours left on it, and the booking simply had no way to ask for it.
//
// It had no way because the join key lived in ONE place: `window.__perchCallId`, a
// plain JavaScript global on the page (`js/booking-widget.js`, submit payload). It
// is written by the live command channel and by nothing else, so it exists only for
// as long as the document that hosted the call is still the document on screen.
// Nothing persists it. Compare the flag it travels with — the same navigate branch
// in `js/perch/command-channel.js` writes `donovan_booking_unlock` to localStorage,
// which is why a caller can arrive at a fully UNLOCKED /book page that has no idea
// which call unlocked it.
//
// ── WHY A COOKIE, AND WHY THAT IS THE SERVER-SIDE ANSWER ─────────────────────
// The join has to be recoverable from something the BOOKING REQUEST already
// carries, and the booking request carries exactly three things: the form fields,
// the origin, and the browser's cookie jar. The form fields cannot help — the
// qualifier never collects a name, an email or a phone number (the card asks for
// none of the three; see `NOTE_ANSWER_KEYS` in js/perch/qualifier.js), so there is
// nothing to index `qualbk:` by that both halves know.
//
// That leaves the cookie jar, and it is the only carrier that is genuinely
// server-side: the server sets it on the qualifier response and reads it off the
// booking request. No widget change, no Retell agent change, no new tool, no new
// client storage — which matters because a fix that needed either of those would be
// Jordan's and Zane's, and would change the shape of the /book rebuild in #115.
//
// The browser then carries the key across everything page memory could not: the
// call ending, a hard navigation, a reload, a closed tab, a second visit inside the
// window. That is the whole fix.
//
// ── THE ATTRIBUTES ARE THE SECURITY ARGUMENT ─────────────────────────────────
// HttpOnly     — page script cannot read it. This is STRICTLY NARROWER than the
//                global it backstops: `window.__perchCallId` is readable by any
//                script on the page, and the call id is a bearer capability
//                (fn/qualifier_result.js). Moving the carrier off the JS heap
//                removes a read surface rather than adding one.
// Secure       — HTTPS only. The site is HTTPS-only; this makes it unbypassable.
// SameSite=Lax — a cross-site POST does not carry it, so it cannot be used to
//                attach a qualifier to a booking driven from another origin. The
//                real booking is a same-origin fetch (`data-api=""` on /book), which
//                Lax sends in full.
// Path=/       — set from /fn/qualifier_submit, read at /booking/create.
// Max-Age      — EQUAL TO THE KV TTL, deliberately. Longer and the cookie outlives
//                the record it names; shorter and a genuine join inside the record's
//                own lifetime is silently dropped. Neither is safe to guess at, so
//                the two are the same constant.
//
// ── IT IS NOT A CREDENTIAL AND IT CANNOT FORGE A JOIN ────────────────────────
// Everything the cookie names still goes through `resolveQualifierBinding`, which
// only confirms against records the SERVER wrote. A cookie the client fabricates
// resolves to `unverified`, attaches nothing, and never becomes a Vantage merge
// key — the same outcome as a forged body `call_id`, through the same gate. This
// module widens WHERE the id can arrive from, never WHETHER an id is believed.
//
// ── RESIDUAL, WRITTEN DOWN RATHER THAN DISCOVERED LATER ──────────────────────
// A shared browser. Caller A qualifies and never books; caller B books on the same
// browser within the window and inherits A's answers. Bounded three ways and none
// of them removes it: the record is ONE-SHOT (spent on the first confirmed
// booking), the window is 6h, and the cookie is cleared the moment it is used. The
// pre-existing global had the same exposure inside one document; this trades a
// narrower window for a real join, and it is the right trade for a firm that is
// currently getting no intake at all. Binding the join to caller identity is the
// same out-of-scope change `_lib/qualifier-bind.js` already flags for #57.

/**
 * The cookie name.
 *
 * `__Host-` is deliberately NOT used. The prefix would force `Path=/` and forbid
 * `Domain`, both of which are already true here, but it also makes the cookie
 * origin-bound in a way that breaks the `donovan.law` → `www.donovan.law` hop the
 * site actually serves. A prefix that is right in principle and wrong for the
 * deployment is a cookie that silently never arrives, which is the failure this
 * whole module exists to fix.
 */
export const QUALIFIER_COOKIE = "dl_qual";

/**
 * Six hours, in seconds — the same window `fn/qualifier_submit` gives the
 * `qualbk:<call_id>` KV record. Exported so the two are provably one number and a
 * test can assert it rather than a reader having to notice it.
 */
export const QUALIFIER_COOKIE_MAX_AGE = 60 * 60 * 6;

/**
 * The body value with which a booking declares that IT CLAIMS NOTHING.
 *
 * SHELDON-QUALIFIER-JOIN-COMPOSE-R1, and it is the answer to a question the
 * residual noted above turned out to be too generous about. That paragraph bounds
 * the shared-browser case with "the record is ONE-SHOT, the window is 6h, and the
 * cookie is cleared the moment it is used" — all true, and all beside the point
 * once js/perch-layer.js grew a path that reaches /booking/create having
 * deliberately submitted NOTHING. A visitor who opens the qualifier card, abandons
 * it, and books is not a visitor whose booking should inherit the previous
 * visitor's answers, and the fallback below cannot tell them apart from the case
 * this module exists for: both arrive with an empty `call_id` and a live cookie.
 *
 * So the browser says which one it is. `create.js` honours this by skipping the
 * cookie fallback entirely.
 *
 * IT IS NOT TRUSTED INPUT AND IT DOES NOT NEED TO BE. Every other value in this
 * flow is believed only against a record the server wrote, because believing a
 * client's claim would ATTACH something. This one can only WITHHOLD: there is no
 * spelling of it that joins a record, names a merge key, or writes a custom field.
 * A client that forges it enriches its own booking less, which is a thing it could
 * already do by sending no cookie. That is why it is safe to read straight off the
 * body while the join key beside it is not.
 *
 * Spelled once here and once as `CLAIM_NONE` in js/perch/web-session.js. CI holds
 * the two equal — a marker the browser sends and the server does not recognise is
 * a silent fail-OPEN, and it would look exactly like the defect it prevents.
 */
export const QUALIFIER_CLAIM_NONE = "none";

/**
 * Does this booking declare that it claims nothing?
 *
 * Case-folded and trimmed because the value crosses a JSON body and the cost of
 * being strict here is asymmetric: an unrecognised marker fails OPEN — the cookie
 * fallback runs and the composition defect is back — while a leniently matched one
 * only ever withholds enrichment from the booking that asked to be withheld from.
 *
 * ABSENCE IS NOT A CLAIM. A body with no marker at all is the ordinary booking the
 * cookie was built for (#153: the caller whose page-memory key died with the
 * document), and it must keep falling back or this fix reinstates that defect. The
 * marker is an explicit opt-OUT, never an opt-in that a silent client fails.
 *
 * @param {any} value  the raw `qualifier_claim` field from the request body
 * @returns {boolean}
 */
export function claimsNothing(value) {
  return String(value ?? "").trim().toLowerCase() === QUALIFIER_CLAIM_NONE;
}

/** Shared attributes, in one string, so set and clear cannot drift on posture. */
const ATTRS = "Path=/; HttpOnly; Secure; SameSite=Lax";

/**
 * The `Set-Cookie` value that arms the join.
 *
 * Returns "" for an id that is empty or carries anything a cookie value may not —
 * a caller that got no id must emit NO header rather than an empty cookie, and a
 * value containing `;` or a control character would be a header-splitting write.
 * The charset here is deliberately tighter than a cookie's legal one and matches
 * `CALL_ID_RE` in booking/_lib/qualifier-bind.js: the only thing this ever carries
 * is a Retell call id, so anything else is a bug or an attack and neither belongs
 * in a response header.
 *
 * @param {string} callId
 * @returns {string} a Set-Cookie header value, or "" to emit nothing
 */
export function setQualifierCookie(callId) {
  const id = String(callId ?? "").trim();
  if (!id || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)) return "";
  return `${QUALIFIER_COOKIE}=${id}; ${ATTRS}; Max-Age=${QUALIFIER_COOKIE_MAX_AGE}`;
}

/**
 * The `Set-Cookie` value that spends it.
 *
 * SAME ATTRIBUTES AS THE SET, which is not tidiness — a browser matches an
 * expiring cookie on name, path and domain, so a clear that spells `Path` or
 * `Secure` differently leaves the original cookie sitting in the jar and the
 * "one-shot" guarantee becomes a comment about something that did not happen.
 */
export function clearQualifierCookie() {
  return `${QUALIFIER_COOKIE}=; ${ATTRS}; Max-Age=0`;
}

/**
 * Read the join key off a request's `Cookie` header.
 *
 * Hand-parsed rather than split on a regex over the whole header: the value is
 * matched only as a complete `name=value` pair between delimiters, so a cookie
 * named `x_dl_qual` or `dl_qual_backup` cannot answer for `dl_qual`. That is the
 * substring-versus-token distinction that makes a look-alike pass elsewhere.
 *
 * Returns "" when the header is absent, malformed, or names no such cookie.
 * NEVER logged by any caller — the value is a bearer capability.
 *
 * @param {Request} request
 * @returns {string}
 */
export function readQualifierCookie(request) {
  let header = "";
  try {
    header = request?.headers?.get?.("cookie") ?? "";
  } catch (_) {
    return "";
  }
  if (!header) return "";

  for (const part of String(header).split(";")) {
    const eq = part.indexOf("=");
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== QUALIFIER_COOKIE) continue;
    // First match wins. A jar holding two cookies of one name is already
    // ambiguous; preferring a later duplicate is how a shadowing write would
    // beat the one the server set.
    return part.slice(eq + 1).trim();
  }
  return "";
}
