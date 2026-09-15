// ── Clio v4 paging cursor — the one place a next-page URL is admitted ─────────
//
// SHELDON-BOOKING-ORIGIN. Every list walk in this integration follows a URL that
// CLIO PUT IN A RESPONSE BODY, and every request that walk issues goes through
// clioFetch, which attaches the firm's live Clio bearer token to whatever absolute
// URL it is handed. Those two facts together are the whole problem: a `next` cursor
// is attacker-influenceable data being turned into a credentialed request, and
// nothing downstream of the assignment can tell that it was.
//
// WHAT THE WALKS USED TO DO. Both of them — fetchBusyBlocks in provider-clio.js and
// listContactFields in this directory — read `meta.paging.next`, tested it with
// `typeof next === "string" && next !== ""`, and assigned it to the loop variable.
// A non-empty string is not a claim about WHERE the string points. A body carrying
//
//   { "data": [...], "meta": { "paging": { "next": "https://evil.example/x" } } }
//
// therefore sent `Authorization: Bearer <the firm's Clio access token>` to
// evil.example, and — because the calendar walk is bounded at ten pages and each
// page can name the next — up to nine times per availability read. Availability is
// an UNAUTHENTICATED public endpoint (/booking/availability), so the request rate is
// the attacker's to choose. None of it logged: the walk had nothing to say about a
// cursor it had accepted.
//
// This is the same class adam/clio-scope-verifier-r2 carried as its headline finding
// at c820cee. It is being fixed here rather than there because these two walks are
// the ones that exist on this branch.
//
// ── THE CHECK, AND WHY IT IS SHAPED THIS WAY ─────────────────────────────────
//
// The cursor must parse as an ABSOLUTE URL whose ORIGIN equals the origin of
// CLIO_BASE. Origin, not host: an origin comparison also refuses an `http://`
// downgrade of the right hostname, which a host comparison would wave through and
// which would put the bearer token on the wire in clear text.
//
// ABSOLUTE IS AN ASSUMPTION, AND IT IS STATED RATHER THAN ASSUMED SILENTLY. The
// vendored contract (integrations/clio/openapi.v4.json) documents NEITHER `meta` nor
// `paging` nor `next` — the string "paging" appears twice in that file, both times in
// the info-block prose linking out to Clio's hosted pagination page, and `"next"`
// appears as a key exactly zero times. So the shape is empirical, from two places
// that agree: the 2026-07-03 sandbox probe recorded in provider-clio.js ("meta.paging
// .next is an absolute URL"), and project-handoff/03-research/clio-integration-
// research.md §4.1, which describes the pagination metadata as "`meta.paging.next`
// and `meta.paging.previous` URLs in response body".
//
// A RELATIVE CURSOR IS THEREFORE REFUSED, NOT RESOLVED. `new URL(raw)` with no base
// throws on a relative string and that throw is caught into a refusal here. That is
// deliberate and it is the fail-closed direction: resolving a relative cursor against
// CLIO_BASE would be safe as far as the token goes, but it would also mean this file
// had quietly started accepting a cursor shape nobody has ever observed Clio send,
// and the observation is the only evidence there is about any of it. If Clio is ever
// seen sending a relative cursor, the fix is to add a resolving arm HERE, once, with
// the observation recorded next to it — not to loosen the test at a call site.
//
// ONE HELPER, TWO CALL SITES, AND THAT IS THE POINT. The defect was not that either
// walk was written carelessly; it was that the walk is a shape you write again every
// time a new list needs following, and the unsafe version is the shorter one. A third
// walk that reads a raw `meta.paging.next` is now the thing that stands out in review.
//
// ── AND "STANDS OUT IN REVIEW" IS NOT A CONTROL (SHELDON-BOOKING-SINK) ───────
//
// The paragraph above is the honest description of what nextPageUrl alone buys, and
// it is also its own indictment: it describes a REVIEW control, not a CODE control.
// Nothing in this file stopped a third walk from being written; it only made the
// omission conspicuous to a reader who happened to know to look. Two facts kept the
// original defect one line of forgetfulness away from returning:
//
//   · clioFetch attaches `Authorization: Bearer <the firm's Clio access token>` to
//     whatever absolute URL it is handed and has no opinion about where that is.
//   · the read-only transport in provider-clio.js (intakeFieldIds) forwards ANY
//     path beginning with "http" to clioFetch verbatim, so a module handed that
//     transport can name a host and be believed.
//
// So the same origin test now also sits AT THE SINK — assertClioOrigin below, called
// inside clioFetch for every request that carries an Authorization header. The two
// checks are deliberately not one: nextPageUrl refuses a bad cursor at the point
// where the walk can still say something useful about it and keep its own fail-closed
// direction, while assertClioOrigin is the backstop that holds when a future caller
// never consults nextPageUrl at all. Neither is redundant with the other, and the
// sink one is the only one that a walk nobody has written yet already obeys.

/**
 * Refuse to let a credentialed request leave the Clio origin.
 *
 * THE SINK, not a call site. clioFetch calls this immediately before dispatching any
 * request whose headers carry an Authorization value — including the retry — so the
 * firm's bearer token cannot reach a host this integration would not have named,
 * whatever produced the URL and whether or not it went through nextPageUrl.
 *
 * SAME TEST AS THE CURSOR CHECK, AND ON PURPOSE. Origin equality against CLIO_ORIGIN:
 * an `http://` downgrade of the right hostname is refused, and so is a look-alike
 * host a prefix comparison would wave through.
 *
 * NAMES THE HOST, NEVER THE URL. A rejected target is attacker-chosen data, and on
 * the calendar path our own URLs carry the firm's calendar id and the read window in
 * their query. The host is the fact an operator needs.
 *
 * @param {unknown} url    The absolute URL clioFetch is about to dispatch.
 * @param {string} where   Which request is asking, for the message. Operator-facing;
 *                         must not contain a URL.
 * @throws {Error} when the target is not an absolute URL on the Clio origin, or
 *                 carries URL credentials.
 */
export function assertClioOrigin(url, where) {
  let parsed;
  try {
    parsed = new URL(String(url));
  } catch (_) {
    // No host to name because there is no host. A relative target reaching the sink
    // means a caller skipped the base-URL join, which is a bug, not an attack — and
    // it is refused on the same terms either way.
    throw new Error(`clio: ${where} targets a URL that is not absolute — refused`);
  }

  if (parsed.origin !== CLIO_ORIGIN) {
    throw new Error(
      `clio: ${where} would send the firm's Clio token off-origin — refused host ${parsed.host}`,
    );
  }

  // Right origin or not, a URL carrying credentials is not one this integration
  // built. Same refusal nextPageUrl makes, for the same reason, at the other end.
  if (parsed.username || parsed.password) {
    throw new Error(
      `clio: ${where} targets a URL carrying credentials — refused host ${parsed.host}`,
    );
  }
}

/** The v4 API root every walk in this integration is allowed to stay inside. */
export const CLIO_BASE = "https://app.clio.com/api/v4";

/** Derived, never spelled twice — the check is "the origin of CLIO_BASE" literally. */
export const CLIO_ORIGIN = new URL(CLIO_BASE).origin;

/**
 * Admit a Clio paging cursor, or refuse it.
 *
 * TAKES THE RAW VALUE, so a caller never handles an unvalidated cursor at all. The
 * "is there a next page?" test lives here too, for the same reason: a caller that
 * did its own `typeof next === "string"` first is a caller that can forget to call
 * this afterwards.
 *
 * NEVER PUTS THE CURSOR IN A MESSAGE. The rejected HOST is named — that is the fact
 * an operator needs and the fact the order asks for — and the rest of the URL is not,
 * because a cursor echoes the query it pages, and on the calendar walk that query
 * carries the firm's calendar id and the window it was read over.
 *
 * @param {unknown} rawNext  `meta.paging.next` exactly as it came off the body.
 * @param {string} where     Which walk is asking, for the message. Operator-facing.
 * @returns {string} "" when there is no next page; the canonical URL when there is.
 * @throws {Error} when a cursor is present but is not an absolute URL on the Clio
 *                 origin. NEVER returns a URL this integration would not have built
 *                 itself.
 */
export function nextPageUrl(rawNext, where) {
  // Absent, null, or empty — Clio saying this was the last page. Not a refusal.
  // (The CALLER may still refuse: on the calendar walk, "no next page" on a FULL
  // page is treated as unread — see the backstop in fetchBusyBlocks. That is a
  // separate question from where a cursor points and stays where it is.)
  if (rawNext == null || rawNext === "") return "";

  if (typeof rawNext !== "string") {
    throw new Error(`clio: ${where} returned a non-string next page cursor — refused`);
  }

  let parsed;
  try {
    parsed = new URL(rawNext);
  } catch (_) {
    // Relative, or not a URL at all. No host to name because there is no host.
    throw new Error(`clio: ${where} returned a next page cursor that is not an absolute URL — refused`);
  }

  if (parsed.origin !== CLIO_ORIGIN) {
    // THE HOST IS NAMED. This is the line that tells an operator the firm's Clio
    // token was ASKED FOR by somewhere it does not belong — and the refusal is what
    // stops it having been sent.
    throw new Error(
      `clio: ${where} returned an off-origin next page cursor — refused host ${parsed.host}`,
    );
  }

  // Credentials in the URL are not a thing Clio sends, and fetch's handling of them
  // varies by runtime. Right origin or not, a cursor carrying them is not a cursor
  // this integration built, so it does not get walked.
  if (parsed.username || parsed.password) {
    throw new Error(
      `clio: ${where} returned a next page cursor carrying credentials — refused host ${parsed.host}`,
    );
  }

  return parsed.toString();
}
