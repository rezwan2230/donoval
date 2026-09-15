// ── Clio Manage adapter — Cloudflare Pages Functions port ─────────────────────
//
// Ported from vantage/server/lib/booking/provider-clio.js.
//
// Key differences from the Node source:
//   • No process.env — secrets resolved via resolveSecret(cfg, key, env) where
//     `env` is context.env threaded down from the route handler.
//   • No node: imports — fetch is the global Workers fetch; setTimeout is global.
//   • Buffer.from(...).toString("base64url") is NOT available in Workers — not
//     needed here (mock uses it; Clio doesn't).
//   • Token cache (Map) lives per-isolate — same lifetime semantics as Node
//     in-process cache; acceptable for single-tenant deployment.
//
// CLIO_FIELDS and all verified comments are preserved EXACTLY from the source.

import { computeAvailability } from "./availability.js";
import { resolveSecret } from "./provider.js";
import {
  resolveIntakeFieldIds, CONTACT_CUSTOM_FIELDS, POSTCALL_CUSTOM_FIELDS,
  MATTER_SCOPED_KEYS, MATTER_CONTEXT_KEY,
} from "./clio-custom-fields.js";
import { CLIO_BASE, nextPageUrl, assertClioOrigin } from "./clio-paging.js";

// VERIFIED against Elroy's Clio developer sandbox 2026-07-03 (probes in
// scratchpad/clio-verify-*.mjs). Findings that corrected the initial guesses:
//   • Date filter = from/to with FULL ISO datetime. start_date/end_date do NOT
//     filter (returned rows even in an exclude-window) — must use from/to.
//   • Response envelope = { meta:{paging,records}, data:[…] }.
//   • Entry fields = start_at/end_at (ISO w/ offset, e.g. 2026-07-06T09:00:00-06:00).
//   • POST entry references the calendar via calendar_owner:{ id } — NOT calendar_id.
//     POST body IS wrapped in { data:… }; response = { data:{ id, etag } }.
//   • Contact type = "Person"; email = email_addresses[{address,name,default_email}].
//   • Refresh does NOT rotate the refresh_token (stable — store once).
//   • who_am_i needs the Users scope (not requested) → 403 expected, irrelevant.
const CLIO_FIELDS = {
  // GET /api/v4/calendar_entries — VERIFIED
  CALENDAR_ENTRIES_FROM_PARAM: "from",              // full ISO datetime
  CALENDAR_ENTRIES_TO_PARAM:   "to",                // full ISO datetime
  CALENDAR_ENTRIES_CALENDAR_ID_PARAM: "calendar_id",
  CALENDAR_ENTRIES_FIELDS_PARAM: "fields",
  // SPEC-BACKED (SHELDON-BOOKING-SAFETY). openapi.v4.json documents both on
  // GET /calendar_entries.json:
  //   paths["/calendar_entries.json"].get.parameters[].name — the list contains
  //   "limit" and "page_token".
  //   limit  — "A limit on the number of CalendarEntry records to be returned.
  //             Limit can range between 1 and 200. Default: `200`."
  // page_token is the query parameter Clio's own next-page URL carries; this file
  // follows that URL whole rather than rebuilding it, so the name is recorded here
  // for the reader and never interpolated. See fetchBusyBlocks.
  CALENDAR_ENTRIES_LIMIT_PARAM: "limit",
  CALENDAR_ENTRIES_PAGE_TOKEN_PARAM: "page_token",
  CALENDAR_ENTRY_START_FIELD: "start_at",
  CALENDAR_ENTRY_END_FIELD:   "end_at",

  // POST /api/v4/calendar_entries — VERIFIED (body wrapped in { data })
  CE_BODY_SUMMARY:     "summary",
  CE_BODY_START_AT:    "start_at",
  CE_BODY_END_AT:      "end_at",
  CE_BODY_CALENDAR_OWNER: "calendar_owner",         // { id: <calendar_id> } — NOT calendar_id
  CE_BODY_DESCRIPTION: "description",
  CE_BODY_LOCATION:    "location",                  // static rooms only — see CE_BODY_CONFERENCE

  // ── Dynamic per-booking video meeting ────────────────────────────────────
  // SPEC-BACKED, unlike the two attendee keys below. integrations/clio/openapi.v4.json
  // documents `data.conference_meeting` on POST /calendar_entries.json as an object
  // whose only property is `type`, with the enum EXACTLY ["zoom"] — so "zoom" is not
  // a preference here, it is the only value the contract accepts. Sent on create,
  // Clio mints a UNIQUE Zoom meeting for that entry, fills `location` itself with a
  // Clio video_conferences wrapper URL, and carries the join link in the invite and
  // the .ics it already sends to the attendee.
  //
  // RESOLVES TO NULL, SILENTLY, ON A 201. The spec says so in the field's own
  // description: "If no conference meeting is present or the user is in an
  // ineligible pricing tier for this feature, it will be null." No Zoom connected
  // has the same outcome. Nothing here can detect that at create time, which is
  // exactly what BOOKING_MEETING_LINK is the fallback for — set it and the firm's
  // permanent room ships as a static `location` instead, no meeting minted.
  CE_BODY_CONFERENCE:  "conference_meeting",        // { type: "zoom" }
  CE_CONFERENCE_TYPE:  "zoom",                      // the ONLY value the enum accepts

  // ── Attendee + confirmation email ────────────────────────────────────────
  // FULLY SPECIFIED, and the comment that used to sit here saying otherwise was
  // wrong. Both keys are in the vendored contract, with their sub-shape:
  //
  //   paths["/calendar_entries.json"].post.requestBody
  //     .content["application/json"].schema.properties.data.properties
  //       .attendees.items.properties = { id, type, _destroy }
  //         · id   "Not required for creating new Attendee, but required for
  //                 updating or deleting existing ones."
  //         · type "The type of attendee (Calendar, Contact)"
  //       .send_email_notification
  //         "Whether the calendar Entry should send email notifications to
  //          attendees"
  //
  // So `attendees:[{id,type:"Contact"}]` with `send_email_notification:true` is the
  // documented shape, not a lucky guess — and the live probe for
  // SHELDON-CLIO-CONFIRM-EMAIL confirmed the delivery semantic end to end (the
  // email AND the .ics reached the attendee with no human touching the Clio UI).
  //
  // WHAT REMAINS TRUE, AND IS THE REASON THE PREVIEW VERIFIER EXISTS: v4 silently
  // DISCARDS unrecognised keys on a create body. That is how the previous
  // `contact_id` — genuinely not a field on this resource — sat here looking correct
  // while attaching nothing and sending nothing. A regression of that shape looks
  // like "clients stopped getting confirmation emails", never like an HTTP error, so
  // test/preview/verify-clio-confirm-email.mjs prints the body for a human to read.
  CE_BODY_ATTENDEES:   "attendees",                 // [{ id, type:"Contact" }, { id, type:"Calendar" }]
  CE_BODY_SEND_EMAIL:  "send_email_notification",   // true ⇒ Clio emails the attendees
  CE_ATTENDEE_TYPE:    "Contact",
  // The firm side of the invitation. The v4 schema quoted above gives the
  // attendee type as "(Calendar, Contact)" — there is NO "User" type — so a firm
  // user is invited by attaching THEIR CALENDAR, and the id required is the same
  // `calendar_id` already in cfg. Clio's documented behaviour for an invited firm
  // user is that "the events will appear on their personal calendars", which is
  // the mechanism this booking path never used: the entry was written ONTO the
  // calendar via calendar_owner, but nobody was ever invited TO it. Writing an
  // entry onto a calendar notifies no one; being an attendee does.
  CE_ATTENDEE_TYPE_CAL: "Calendar",

  // POST /api/v4/notes — the attorney-side intake record.
  // Documented Clio v4 shape; NOT probed live by this ticket. Written best-effort
  // and never allowed to fail a confirmed booking (see writeIntakeNote).
  NOTE_BODY_SUBJECT: "subject",
  NOTE_BODY_DETAIL:  "detail",
  NOTE_BODY_TYPE:    "type",                        // "Contact" — associates to a contact
  NOTE_BODY_CONTACT: "contact",                     // { id: <contact_id> }

  // GET /api/v4/contacts — the DOCUMENTED search parameter is `query`:
  //   paths["/contacts.json"].get.parameters[].name — the list contains "query"
  //   and does NOT contain "q".
  //
  // `q` used to sit here on the strength of a sandbox note calling it the working
  // spelling. That is the most dangerous possible thing to be wrong about on this
  // call: an unrecognised query parameter does not error, it is IGNORED, so the
  // search silently stops filtering and every returning client falls through to the
  // create branch as "not found". Use the name the contract documents.
  CONTACT_QUERY_PARAM: "query",
  CONTACT_TYPE_PARAM:  "type",                      // "Person"
  CONTACT_EMAIL_FIELD: "email_addresses",           // [{address, name, default_email}]
  CONTACT_EMAIL_ADDRESS_FIELD: "address",

  // POST /api/v4/contacts — VERIFIED
  CONTACT_BODY_FIRST_NAME: "first_name",
  CONTACT_BODY_LAST_NAME:  "last_name",
  CONTACT_BODY_TYPE:       "type",                  // "Person"
  CONTACT_BODY_EMAIL:      "email_addresses",       // [{address, name, default_email}]
  CONTACT_BODY_PHONE:      "phone_numbers",         // [{number, name, default_number}]

  // The property on a phone_numbers row that the existing-phone guard compares.
  // Named here rather than spelled inline at the four sites that used it, because a
  // sub-resource's SELECTION and its READER have to agree letter for letter and
  // nothing forced them to while one was a constant and the other a literal — see
  // CONTACT_SEARCH_FIELDS_ENRICHED for what that costs.
  CONTACT_PHONE_NUMBER_FIELD: "number",

  // ── The rest of the intake, on the contact ───────────────────────────────
  // SHELDON-CLIO-CONTACT-MAPPING. SPEC-BACKED, from the vendored contract
  // (integrations/clio/openapi.v4.json, POST /contacts.json and
  // PATCH /contacts/{id}.json): `addresses` and `custom_field_values` are real
  // fields on both bodies, unlike the two calendar-entry attendee keys above.
  //
  // THEY SHIP ON THE PATCH ONLY. Both are legal on the create body and neither is
  // sent there any more — see findOrCreateContact. Optional fields belong on the
  // request whose failure is survivable, not on the one that mints the id the
  // attendee and the confirmation email hang off.
  //
  // THE CONTACT IS THE LAWYER-ONLY RECORD, and that is the whole reason the bands
  // are allowed here and nowhere else. Clio never emails a contact's fields to the
  // contact; it emails the CALENDAR ENTRY's description (see buildClientDescription).
  // Everything in this block therefore carries the full intake — income_band and
  // net_worth_band included — while the client-facing description continues to
  // carry firm-configured constants only. The two surfaces must never be
  // conflated: a band reaching the description is a leak, a band reaching the
  // contact is the requirement.
  CONTACT_BODY_ADDRESSES:  "addresses",             // [{name, province, country, …}]
  CONTACT_ADDRESS_PROVINCE: "province",             // Clio's name for state — NOT "state"
  // The second property the existing-address guard compares. `outside_us` is
  // recorded as a country rather than a province (see buildAddresses), so a
  // selection that asks for province alone would make the outside-the-U.S. branch
  // of that guard read undefined on every row and re-append the address forever.
  CONTACT_ADDRESS_COUNTRY:  "country",
  CONTACT_BODY_CUSTOM_FIELDS: "custom_field_values", // [{value, custom_field:{id}, id?}]
  CONTACT_CUSTOM_FIELD_REF: "custom_field",         // { id: <CustomField id> }

  // ── The contact's Website, and it is a STANDARD field, not a custom one ──────
  // SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE. Spec-backed from the same vendored
  // contract as `addresses` and `custom_field_values` — `web_sites` is a real
  // property on BOTH bodies:
  //
  //   paths["/contacts.json"].post.requestBody…data.properties.web_sites
  //   paths["/contacts/{id}.json"].patch.requestBody…data.properties.web_sites
  //     .items.properties = { name, address, default_web_site }
  //
  // It is therefore the same kind of PATCH array as the other three (rule 1 in the
  // contract notes below): a row with no `id` is an APPEND, an existing row left out
  // is untouched, and nothing here ever sends `_destroy`. Writing one row cannot
  // delete a website a client already has — but it can sit a second one beside it,
  // which is why the write is gated on there being none (see updateContact).
  CONTACT_BODY_WEB_SITES: "web_sites",              // [{name, address, default_web_site}]
  CONTACT_WEB_SITE_ADDRESS: "address",              // the URL — the ONE property read

  CONTACT_WEB_SITE_DEFAULT: "default_web_site",

  // THE ONLY KEY THAT ATTRIBUTES A ROW ON A CONTACT READ, and it is not the one
  // above. `custom_field` is the WRITE side's addressing; on the READ side Clio
  // answers a contact's custom_field_values with `field_name` and nothing that
  // resolves to a CustomField id. Established by direct probe against the live
  // grant (PR 163, issue 153):
  //
  //   id,custom_field_values{id,value,field_name}         200 · attributes
  //   id,custom_field_values{id,value,custom_field}       200 · ATTRIBUTES NOTHING
  //   id,custom_field_values{id,value,custom_field{ id }} 400 · Clio's selector
  //                                                       grammar has no second
  //                                                       level, so that arm can
  //                                                       never succeed
  //
  // So a contact's existing values are matched by NAME here. The name is the same
  // contract with the firm's account that clio-custom-fields.js resolves ids by —
  // one spelling, two directions — which is why matching on it is not a weaker
  // join than the id would have been, merely the reachable one.
  CONTACT_CUSTOM_FIELD_NAME: "field_name",          // "Intake Income Band"
};

// ── What the vendored contract actually says, and where ──────────────────────
//
// Read from integrations/clio/openapi.v4.json rather than assumed. Paths are given
// so the next person can re-read the same lines instead of re-deriving them.
//
// 1. A PATCH ARRAY IS A SET OF OPERATIONS, NOT A REPLACEMENT SET. This is the
//    question the whole update path hangs on: if `phone_numbers: [one number]`
//    REPLACED the array, every other number a returning client has in Clio would be
//    deleted by a booking. It does not. Each of the three arrays we send carries a
//    `_destroy` member, described as:
//
//      "The destroy flag. If the flag is set to `true` and the unique identifier of
//       the associated PhoneNumber is present, the PhoneNumber is deleted from the
//       Contact."
//
//      paths["/contacts/{id}.json"].patch.requestBody
//        .content["application/json"].schema.properties.data.properties
//          .phone_numbers.items.properties._destroy
//          .addresses.items.properties._destroy
//          .custom_field_values.items.properties._destroy
//
//    Deletion therefore requires an explicit flag AND an existing id. A member with
//    no `id` is a create (append); a member with an `id` is an update in place; an
//    existing member simply left out of the array is untouched. Nothing in this file
//    ever sends `_destroy`, so nothing here can delete a client's data.
//
// 2. EACH LABEL ENUM IS CLOSED, AND THEY ARE THREE DIFFERENT ENUMS. Worth saying
//    plainly because they overlap enough to look like one shared list and are not:
//
//      email_addresses[].name  = ["Work","Home","Other"]                → we send "Work"
//      phone_numbers[].name    = ["Work","Home","Mobile","Fax",
//                                 "Pager","Skype","Other"]              → we send "Mobile"
//      addresses[].name        = ["Work","Home","Billing","Other"]      → we send "Home"
//
//    each at …schema.properties.data.properties.<field>.items.properties.name.enum.
//    "Mobile" is a phone label and is NOT in the email enum; "Billing" is an address
//    label and is in neither of the others. Reading the email enum as the general
//    rule is how a valid phone label gets "corrected" into an invalid one.
//
// 3. `custom_field_values[].id` IS AN OPAQUE STRING THAT MAY BE NULL. Not an
//    integer, unlike every other id on the resource
//    (…patch….custom_field_values.items.properties.id.type === "string"), and the
//    Contacts tag documentation says what it actually is:
//
//      "The `id` of the CustomFieldValue is a composite value including the custom
//       field type."          e.g.  id: "text_line-1"
//      "Note: The `id` may be `NULL` when the CustomField is displayed by default
//       but has not yet been given a value."
//      "Note: If the `id` is `NULL`, you must provide `custom_field{id}` to create
//       the CustomFieldValue and assign a value."
//
//    So it is never parsed, never coerced, and a null one is treated as "no existing
//    value" — which sends the create form (custom_field:{id} and no id), exactly as
//    the documentation instructs. See existingValueIndex and buildCustomFieldValues.
//
// 4. ONE UNRESOLVED DISCREPANCY, recorded rather than acted on. The create body
//    declares `required: ["name","type"]`:
//
//      paths["/contacts.json"].post.requestBody
//        .content["application/json"].schema.properties.data.required
//
//    while the Contacts tag documentation says a Person needs "at least a first name
//    or a last name", names `first_name`/`last_name` the PREFERRED form, and calls
//    the bare `name` parameter "discouraged" because Clio has to infer the
//    components and 422s when it cannot. This code sends the split, which is the
//    recommended shape; a bare `name` is not added on the strength of a `required`
//    list the prose immediately qualifies.

// ── The calendar read's page size, and the bound on how many pages it may walk ──
//
// SHELDON-BOOKING-SAFETY. 200 is the contract's documented MAXIMUM and its default
// (see CALENDAR_ENTRIES_LIMIT_PARAM), so asking for it is asking for the fewest
// possible round trips on a call a client is waiting behind. It is also the number
// the full-page backstop in fetchBusyBlocks compares against, which is the reason
// it is sent rather than left implicit.
//
// MAX_PAGES bounds the subrequest count, and 10 pages is 2000 calendar entries in
// one availability window. /booking/availability caps the horizon at 60 days, so
// this is over 33 entries a day, every day, for two months — far past any plausible
// single attorney's calendar, and still well inside the Workers subrequest budget.
// It is a ceiling on cost, NOT a claim about what lies past it: exhausting it with
// a next page still outstanding throws, exactly as an unreadable page does.
const CALENDAR_PAGE_LIMIT = 200;
const CALENDAR_MAX_PAGES = 10;

// CLIO_BASE is imported from clio-paging.js rather than declared here. The origin
// check on a paging cursor is "the origin of CLIO_BASE", and that sentence is only
// true if there is exactly one CLIO_BASE — a second copy in this file is how the
// constant and the thing checking it drift apart (SHELDON-BOOKING-ORIGIN).
const CLIO_TOKEN_URL = "https://app.clio.com/oauth/token";
const TOKEN_REFRESH_INTERVAL_MS = 50 * 60 * 1000; // refresh 10 min before typical 60-min expiry

// Per-isolate token cache: { accessToken, fetchedAt }
// Keyed by client_id so multiple deployments with different apps don't collide.
// In the Workers runtime this Map lives for the lifetime of the isolate — same
// semantics as the Node in-process cache. Single-tenant here so no key collision.
const tokenCache = new Map();

/**
 * Obtain a valid access token, refreshing from Clio if the cache is stale.
 * NEVER logs the token value.
 *
 * @param {object} cfg
 * @param {object} env  - context.env (replaces process.env)
 * @returns {Promise<string>}
 */
async function getAccessToken(cfg, env) {
  const clientId = resolveSecret(cfg, "client_id_env", env);
  const cacheKey = clientId || "__default__";
  const cached = tokenCache.get(cacheKey);

  if (cached && Date.now() - cached.fetchedAt < TOKEN_REFRESH_INTERVAL_MS) {
    return cached.accessToken;
  }

  const clientSecret = resolveSecret(cfg, "client_secret_env", env);
  const refreshToken = resolveSecret(cfg, "refresh_token_env", env);
  const currentToken = resolveSecret(cfg, "access_token_env", env);

  // If we have no refresh token, fall back to the current access token as-is.
  if (!refreshToken) {
    if (currentToken) {
      tokenCache.set(cacheKey, { accessToken: currentToken, fetchedAt: Date.now() });
      return currentToken;
    }
    throw new Error("clio: no refresh_token or access_token configured");
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
  });

  // NEVER log body — contains client_secret + refresh_token.
  const res = await clioFetch(CLIO_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
    _skipAuth: true,
  }, cfg, env);

  if (!res.ok) {
    throw new Error(`clio: token refresh failed — HTTP ${res.status}`);
  }
  const data = await res.json();
  const accessToken = data.access_token;
  if (!accessToken) {
    throw new Error("clio: token refresh returned no access_token");
  }

  tokenCache.set(cacheKey, { accessToken, fetchedAt: Date.now() });
  return accessToken;
}

/**
 * Read an Authorization value off whatever header shape a caller built.
 *
 * SHELDON-BOOKING-SINK. The sink assertion is only as good as its ability to tell
 * that a request IS credentialed. clioFetch builds a plain object today, and reading
 * the Headers and entry-array forms as well costs three lines and stops the check
 * from going silently blind if that ever changes — a guard that quietly stops
 * guarding is worse than no guard, because the tests keep passing.
 *
 * Case-insensitive on the key, because HTTP header names are.
 *
 * @param {HeadersInit|undefined} headers
 * @returns {string} the value, or "" when there is no Authorization header.
 */
function authHeaderOf(headers) {
  if (!headers) return "";
  if (typeof headers.get === "function") return headers.get("authorization") ?? "";
  if (Array.isArray(headers)) {
    const row = headers.find(([k]) => String(k).toLowerCase() === "authorization");
    return row ? String(row[1]) : "";
  }
  const key = Object.keys(headers).find((k) => k.toLowerCase() === "authorization");
  return key ? String(headers[key]) : "";
}

/**
 * Fetch wrapper for all Clio API calls.
 * Handles Bearer auth injection; retries ONLY what is safe to send twice.
 * NEVER logs token values or PII request bodies.
 *
 * SHELDON-BOOKING-SAFETY. The congestion retry used to branch on the STATUS alone
 * and never on the METHOD, and that is how a retry inside our own client became the
 * mechanism of a double booking. Walk it: the calendar POST reaches Clio, Clio
 * writes the entry, and the 2xx is lost on the way back — a gateway timeout, an
 * origin hiccup, anything that turns a completed write into a 502/503/504. This
 * function saw a 5xx, waited two seconds, and SENT THE SAME CREATE BODY AGAIN.
 * Clio has no idempotency key on /calendar_entries, so the second body is a second
 * appointment. The read-back then recorded the SECOND entry's id, so even the
 * provider_ref pointed at the duplicate and the original was invisible to
 * everything downstream — nothing errored, nothing warned, and two entries sat on
 * the attorney's calendar for the same slot.
 *
 * That is the same harm SHELDON-CLIO-BUSYBLOCKS was cut to prevent, arriving from
 * the opposite direction. 129 stopped us from WRITING INTO a slot we could not see
 * was taken; this stops us from writing a slot TWICE ourselves. A guard on the read
 * cannot catch it, because the re-check ran once, correctly, before the first POST.
 *
 * WHAT MAY BE REPEATED. Not "non-GET", which is the shape of the rule, but the
 * reason under it: a request may be sent again only when sending it again cannot
 * produce a second thing.
 *
 *   · GET — reads nothing into existence. Repeatable, unconditionally, and the
 *     availability read on the path to a booking DEPENDS on the retry: a calendar
 *     read that fails now fails the booking closed (129), so retrying a transient
 *     5xx there is the difference between a refused consultation and a booked one.
 *   · The token refresh (`_skipAuth`) — a POST by transport, a mint by effect. It
 *     creates no record on the firm's account, and VERIFIED at the top of this file:
 *     "Refresh does NOT rotate the refresh_token (stable — store once)", so a second
 *     refresh costs at most a discarded access token. It is also upstream of every
 *     other call here, so refusing to retry it would fail bookings for a hiccup on
 *     the one request in this file that has nothing to lose.
 *   · Everything else — POST /calendar_entries, POST /contacts, PATCH /contacts/{id},
 *     POST /notes — is NOT repeated on 429 or 5xx. The status is handed back to the
 *     caller exactly as Clio sent it, and each caller already has a defined answer
 *     for a failed write: createBooking throws (the route answers 502), the contact
 *     create returns null, the PATCH and the note warn.
 *
 * WHY NO-RETRY RATHER THAN RETRY-THEN-RECONCILE. The order allows retrying the
 * create and reading the slot back before a second one, IF there is evidence that a
 * transient 5xx on create is common. There is none — no telemetry, no logged
 * occurrence, nothing in this repo records a single 5xx from POST /calendar_entries.
 * Reconciliation is also strictly worse here than it looks: the read that would have
 * to prove "no entry exists for this slot yet" is the SAME read whose wrong-shaped
 * answers 129 spent a ticket learning not to trust, and a reconcile that misreads a
 * committed write as absent creates the duplicate anyway — with an extra round trip
 * of latency on every failure, in front of a waiting client. Not repeating is the
 * behaviour whose worst case is bounded: the client is told the booking failed for
 * an entry that may in fact exist, which the firm can SEE on the calendar and fix,
 * where the duplicate is invisible by construction.
 *
 * SHELDON-BOOKING-SINK. TWO THINGS THIS FUNCTION USED TO TAKE ON TRUST, and both of
 * them decide where the firm's token goes.
 *
 * THE TARGET. This function bearer-authenticates whatever absolute URL it is handed
 * and had no opinion about where that was. SHELDON-BOOKING-ORIGIN closed the one
 * producer of an attacker-influenceable URL — the paging cursor — at both of its call
 * sites, but a check at the call site is a check a new call site does not inherit,
 * and the transport in intakeFieldIds forwards ANY path beginning with "http" here
 * verbatim. So the origin test now also sits HERE, at the sink: every request whose
 * headers carry an Authorization value is asserted onto the Clio origin before it is
 * dispatched, and a third walk written next year gets the check without knowing it
 * exists. The header, not `_skipAuth`, is what the test reads — a caller that builds
 * its own Authorization header is exactly the case a flag-based test would miss.
 *
 * THE REDIRECT, which was the larger hole of the two. `fetch` follows redirects by
 * default, so a 302 was a hop this function never saw: the target it asserted and the
 * host it finally talked to were two different things, decided by a Location header —
 * and a Location header is a string Clio put in a response, exactly as trusted as the
 * `next` cursor in a response BODY that this whole line of work exists because of. So
 * redirects are not followed. `redirect: "manual"` hands the 3xx back, and a 3xx is a
 * refusal that names the LOCATION host. Two harms, either sufficient on its own:
 *
 *   · Whether a runtime strips `Authorization` across an origin change is the
 *     runtime's business and not a control this integration gets to rely on. The Node
 *     fetch this suite runs on strips it; Workers is a different implementation and
 *     nothing here pins its behaviour. Not following is the same refusal under both.
 *   · Even with the header stripped, following a redirect means the BODY that the
 *     calendar walk parses into busy blocks came from whoever answered — so an empty
 *     `{"data":[]}` from an off-host hop reads as "the attorney has nothing booked"
 *     and frees a booked afternoon. That is 129's double booking arriving through the
 *     transport instead of through the parse, and it is unreachable if no hop is made.
 *
 * NOTHING IN THIS INTEGRATION REDIRECTS. Every URL here is built against CLIO_BASE
 * or is a cursor already admitted onto that origin, and the one Clio endpoint the
 * vendored research records as answering a redirect — GET /documents/:id/download,
 * a 303 to a storage URL (clio-integration-research.md §"Documents") — has no caller
 * in this repo and no route that could acquire one. If a Clio call is ever seen
 * answering a 3xx, the refusal below is what says so, by host, on the first booking.
 *
 * THE 401 IS DELIBERATELY STILL RETRIED ON EVERY METHOD, and it is the one place
 * this rule bends. A 401 is not "the request went wrong", it is "the request was
 * never authorised" — Clio's OAuth layer refuses it in front of the resource
 * handler, so there is no committed write behind it to duplicate. The mechanism is
 * real and specific to this integration: Clio invalidates a prior access token when
 * the refresh token is used elsewhere, so a cached token goes stale MID-LIFE, and
 * without this self-heal the next calendar POST after any token churn fails a
 * booking outright. The order's stated purpose is a 5xx or 429 after a committed
 * write; a 401 is the case where nothing was committed.
 *
 * @param {string} url
 * @param {RequestInit & { _skipAuth?: boolean }} options
 * @param {object} cfg
 * @param {object} env  - context.env
 * @returns {Promise<Response>}
 */
async function clioFetch(url, options, cfg, env) {
  const { _skipAuth, ...fetchOpts } = options;
  // Absent method means GET, per fetch. Spelled out rather than assumed, because
  // this value now decides whether a write can be sent twice.
  const method = String(fetchOpts.method ?? "GET").toUpperCase();

  if (!_skipAuth) {
    const token = await getAccessToken(cfg, env);
    fetchOpts.headers = {
      "Authorization": `Bearer ${token}`,
      "Accept": "application/json",
      ...(fetchOpts.headers ?? {}),
    };
  }

  // NOT FOLLOWED. See the header — a Location header is a string out of a response,
  // and following one makes the host we asserted and the host we talk to two
  // different things. Set here rather than at each `fetch` below so the retry cannot
  // be the attempt that forgets.
  fetchOpts.redirect = "manual";

  /**
   * Dispatch one attempt, through the sink checks.
   *
   * Both the assertion and the redirect refusal live in here rather than around the
   * first `fetch`, because the retry re-attaches the Authorization header and is a
   * second request in every sense that matters to either check.
   */
  const send = async () => {
    // THE SINK ASSERTION. Reads the EFFECTIVE headers, not `_skipAuth`: the harm is
    // a bearer token on the wire, and a caller that hand-rolled the header would be
    // invisible to a flag test. The token mint passes this trivially — it sends no
    // Authorization header at all, and CLIO_TOKEN_URL is on the Clio origin anyway.
    if (authHeaderOf(fetchOpts.headers)) {
      try {
        assertClioOrigin(url, `${method} request`);
      } catch (err) {
        // WARNED HERE, because not every caller of this function reports a throw.
        // intakeFieldIds swallows one into `{}` by contract, so without this line the
        // one event worth alerting on — something asked for the firm's Clio token —
        // would be the quietest thing in the log.
        console.warn(`[clio] request refused before dispatch: ${err.message}`);
        throw err;
      }
    }

    const r = await fetch(url, fetchOpts);

    if (r.status >= 300 && r.status < 400) {
      // A 3xx is a refusal, not a hop. The LOCATION host is named — that is the fact
      // an operator needs — and neither URL is logged: the Location is attacker-
      // chosen, and our own carries the firm's calendar id and read window.
      //
      // Resolved against the request URL so a RELATIVE Location still yields a host
      // to name. It is refused either way; "same host" is not "not a redirect".
      const loc = r.headers.get("location");
      let named;
      if (!loc) named = "refused a redirect carrying no Location header";
      else {
        let host = "";
        try { host = new URL(loc, url).host; } catch (_) { /* unparseable */ }
        named = host
          ? `refused redirect to host ${host}`
          : "refused a redirect whose Location does not parse";
      }
      console.warn(`[clio] ${method} answered HTTP ${r.status} — ${named}`);
      throw new Error(`clio: ${method} request answered HTTP ${r.status} — ${named}`);
    }

    return r;
  };

  let res = await send();

  // See the header. `repeatable` is the whole of the change: a congested response is
  // retried only for a request that cannot mint a second record.
  const repeatable = method === "GET" || _skipAuth === true;
  const congested = res.status === 429 || (res.status >= 500 && res.status < 600);
  const staleAuth = res.status === 401 && !_skipAuth;

  if (staleAuth || (congested && repeatable)) {
    if (!staleAuth) {
      const retryAfterSec = parseInt(res.headers.get("Retry-After") ?? "2", 10) || 2;
      await new Promise((r) => setTimeout(r, Math.min(retryAfterSec * 1000, 10_000)));
    }
    if (!_skipAuth) {
      tokenCache.clear();
      const token = await getAccessToken(cfg, env);
      fetchOpts.headers = { ...fetchOpts.headers, "Authorization": `Bearer ${token}` };
    }
    res = await send();
  }

  return res;
}

/**
 * Fetch busy calendar blocks from Clio for the given date range.
 *
 * THE ONLY THING THAT MAKES A SLOT LOOK TAKEN. Everything downstream — the grid the
 * client picks from, and the re-check create.js runs in the instant before the
 * calendar write — is `computeAvailability(window, THESE BLOCKS, …)`. An empty
 * return from here is not a neutral value, it is the positive assertion "the
 * attorney has nothing booked in this window", and it makes every slot in the
 * window free. So this function has exactly one safe failure direction: it may
 * throw, and it may never guess.
 *
 * SHELDON-CLIO-BUSYBLOCKS. It used to guess, through the same door R3 closed one
 * function away in searchContactByEmail: `Array.isArray(data?.data) ? data.data : []`
 * read a 200 carrying `{}`, or `{"data":null}`, or an error envelope with no `data`
 * at all, as a calendar with nothing on it. It is worse here than it was there. A
 * wrong-shaped search body cost the firm a duplicate contact — bad, unmergeable,
 * but a CRM problem. A wrong-shaped calendar body cost a client the slot Paul was
 * already sitting in: the re-check reads "free", the POST goes through, and two
 * people arrive for the same consultation on a live legal calendar.
 *
 * An unparseable body already failed closed, by accident rather than by design —
 * res.json() throws and the throw becomes a 502 at the route. Only the wrong-shaped
 * 200 failed open. Both are now explicit, and each says so in its OWN words, for
 * the same reason R3 gave: "Clio sent bytes that are not JSON" and "Clio sent JSON
 * that is not a result set" are different operational facts, and an operator who
 * cannot tell them apart in the logs can diagnose neither.
 *
 * A GENUINELY EMPTY DAY STILL RETURNS []. `{"data":[]}` is Clio answering "I looked,
 * nothing is booked", and an attorney with a clear Tuesday must stay bookable. The
 * guard tests the SHAPE, never the length — see the narrowing test in
 * test/clio-busy-blocks.test.mjs, which exists so a future tightening cannot quietly
 * turn "fail closed on nonsense" into "refuse every free calendar".
 *
 * SHELDON-BOOKING-SAFETY: A TRUNCATED PAGE IS A WELL-FORMED ANSWER, and that is the
 * hole 129's shape guard cannot see. This call sent no `limit` and never followed a
 * page, while the contract caps a list at 200 (`limit` "can range between 1 and 200.
 * Default: 200") and /booking/availability accepts a horizon of up to 60 days. An
 * attorney with more than 200 entries in the window therefore got the first 200 —
 * a perfectly shaped `{ data:[…200 entries…] }`, which passes every test 129 added —
 * and EVERY ENTRY PAST THE CAP WAS READ AS FREE TIME. The overflow is not a random
 * subset either: it is one contiguous end of the window, so a busy attorney's later
 * weeks went wholly bookable.
 *
 * SO THE PAGES ARE WALKED, AND A WALK THAT CANNOT FINISH REFUSES. Both, because
 * either alone fails open:
 *
 *   · WALKED via `meta.paging.next`, the absolute next-page URL, exactly as
 *     clio-custom-fields.js already walks the custom-field list. `limit` is sent
 *     explicitly rather than left to the default, so the page size is a number this
 *     file KNOWS instead of one it assumes.
 *   · ADMITTED BEFORE IT IS WALKED (SHELDON-BOOKING-ORIGIN). The cursor is a URL out
 *     of a RESPONSE BODY and clioFetch bearer-authenticates any absolute URL, so
 *     "non-empty string" was never a sufficient test: it let a body nominate where
 *     the firm's Clio access token got sent, nine times over, from a public endpoint,
 *     silently. nextPageUrl (clio-paging.js) is the one place a cursor is admitted,
 *     and it admits only an absolute URL on CLIO_BASE's own origin.
 *   · REFUSED when the walk cannot be shown to have finished. `meta` is NOT in the
 *     vendored contract — it appears as a response property in zero of the 419
 *     schemas, as the guard note below has said since 129 — so its absence proves
 *     nothing, and a walk that trusted `meta.paging.next` alone would read "no next
 *     page" on every truncated response and degrade silently back to the defect. The
 *     backstop is contract-independent: a final page that came back FULL is
 *     indistinguishable from a page with more behind it, so it is not an answer, and
 *     it throws. Likewise a walk still holding a `next` when the page bound runs out.
 *
 * The backstop can fire on a calendar that is genuinely exactly `limit` entries and
 * genuinely complete. That refuses one bookable window, in the same fail-closed
 * direction 129 established, and is the price of not being able to tell that case
 * apart from a truncation. A cheaper reading is not available: the only thing an
 * over-full page tells us is that we do not know what else is there.
 *
 * @param {object} cfg
 * @param {object} env
 * @param {string} fromISO
 * @param {string} toISO
 * @returns {Promise<Array<{startISO:string, endISO:string}>>}
 * @throws when Clio did not answer with a readable, COMPLETE list of entries, or
 *         when a page named a next page this integration will not follow.
 */
async function fetchBusyBlocks(cfg, env, fromISO, toISO) {
  const calendarId = cfg?.calendar_id;
  if (!calendarId) {
    // FAIL CLOSED, where this used to `return []`. "We do not know which calendar to
    // read" is the most complete form of not knowing what is booked, and returning
    // an empty block list for it declared the unknown calendar wholly free.
    //
    // It is reachable in production, not just in theory. resolveConfig refuses to
    // build a Clio config without CLIO_CALENDAR_ID, but it coerces with
    // `Number(calId)` — so a dashboard value that is SET and non-numeric ("paul", a
    // pasted URL) survives that check as NaN, arrives here, and every slot on the
    // grid went free.
    //
    // `!calendarId` IS THE WHOLE TEST, and an explicit `Number.isNaN` arm alongside
    // it would be unreachable: NaN is falsy, so it is already caught here. Nor is
    // whitespace a second case — `Number(" 9084638 ")` is 9084638, not NaN, because
    // Number trims. resolveConfig is the sole producer of this field and always
    // coerces, so NaN and 0 are the only unusable values that can arrive, and both
    // are falsy.
    console.warn("[clio] calendar read refused: no usable calendar_id");
    throw new Error("clio: no usable calendar_id — cannot read busy blocks");
  }

  // VERIFIED: from/to take FULL ISO datetime (date-only start_date/end_date does
  // not actually filter). Pass the ISO strings as-is.
  const params = new URLSearchParams({
    [CLIO_FIELDS.CALENDAR_ENTRIES_CALENDAR_ID_PARAM]: String(calendarId),
    [CLIO_FIELDS.CALENDAR_ENTRIES_FROM_PARAM]: fromISO,
    [CLIO_FIELDS.CALENDAR_ENTRIES_TO_PARAM]:   toISO,
    [CLIO_FIELDS.CALENDAR_ENTRIES_FIELDS_PARAM]: [
      CLIO_FIELDS.CALENDAR_ENTRY_START_FIELD,
      CLIO_FIELDS.CALENDAR_ENTRY_END_FIELD,
    ].join(","),
    // SENT, not inherited. The documented default is also 200, so this changes no
    // request Clio sees — but it makes the page size a value this file states, which
    // is what the full-page backstop below is allowed to compare against. Reading a
    // cap we merely assumed would be the same guess the guard exists to remove.
    [CLIO_FIELDS.CALENDAR_ENTRIES_LIMIT_PARAM]: String(CALENDAR_PAGE_LIMIT),
  });

  let url = `${CLIO_BASE}/calendar_entries?${params}`;
  const entries = [];
  let pages = 0;

  while (url) {
    pages += 1;
    const res = await clioFetch(url, { method: "GET" }, cfg, env);

    if (!res.ok) {
      throw new Error(`clio: GET /calendar_entries failed — HTTP ${res.status}`);
    }

    let data;
    try {
      data = await res.json();
    } catch (_) {
      // Already the behaviour before this ticket — res.json() threw and the throw
      // reached the route — but it happened silently and by accident. Named now, so
      // the log distinguishes it from the shape refusal below.
      console.warn("[clio] calendar read returned an unreadable body");
      throw new Error("clio: GET /calendar_entries returned an unreadable body");
    }

    // VERIFIED AGAINST integrations/clio/openapi.v4.json: the v4 list envelope is
    // `{ data: [...] }`, and `data` is REQUIRED — CalendarEntry_List declares
    // `required: ["data"]`, as do all 79 `*_List` schemas in the vendored spec.
    //
    // It does NOT declare `meta`. `meta` appears as a response property in zero of
    // the 419 schemas in the spec. The walk below reads `meta.paging.next` anyway,
    // because the 2026-07-03 sandbox probe saw it and clio-custom-fields.js has
    // walked it in this repo since — but it is EMPIRICAL, not contractual, and that
    // is precisely why its absence is never read as "this was the last page". See
    // the full-page backstop.
    //
    // The guard below cannot misfire on a documented 200: `data` is required on every
    // documented list response, and `fields` selects WITHIN each entry — it cannot
    // drop the envelope.
    //
    // THE SHAPE IS THE ANSWER. A 200 without a `data` array is not a calendar with
    // nothing on it; it is Clio not telling us what is on the calendar. See the
    // header — this is the line the double-booking walked through.
    if (!Array.isArray(data?.data)) {
      console.warn("[clio] calendar read returned a body with no entry array");
      throw new Error("clio: GET /calendar_entries returned a body with no entry array");
    }
    const page = data.data;
    for (const e of page) entries.push(e);

    // Clio v4 paging: meta.paging.next is an absolute URL, absent on the last page.
    // Same shape clio-custom-fields.js walks — and now through the same admission
    // check, in the same helper.
    //
    // SHELDON-BOOKING-ORIGIN. THE RAW CURSOR IS NEVER ASSIGNED TO `url`. It used to
    // be, on nothing more than `typeof next === "string" && next !== ""` — and a
    // non-empty string says nothing about WHERE it points. clioFetch attaches the
    // firm's live Clio bearer token to any absolute URL it is handed, so a `next`
    // pointing off-host was the firm's Clio access token being sent to whoever named
    // it, up to nine times per availability read (CALENDAR_MAX_PAGES − 1), from a
    // PUBLIC unauthenticated endpoint, and unlogged. nextPageUrl admits a cursor only
    // when it is an absolute URL on CLIO_BASE's own origin, and throws naming the
    // rejected host otherwise — the same fail-closed direction as every other refusal
    // in this function, and reaching the route as the same 502.
    //
    // WARNED IN ITS OWN WORDS, like every other refusal here. The helper's message
    // already names the host; the catch exists so the line reaches the operator log
    // on the same terms as "no entry array" and "unreadable body" rather than only as
    // whatever the route makes of a thrown error. Rethrown unchanged — this is a
    // refusal, not a recovery.
    let next;
    try {
      next = nextPageUrl(data?.meta?.paging?.next, "GET /calendar_entries");
    } catch (err) {
      console.warn(`[clio] calendar read refused a next page cursor: ${err.message}`);
      throw err;
    }
    const hasNext = next !== "";

    if (!hasNext) {
      // THE BACKSTOP, and the only line here that would still be needed if Clio's
      // paging envelope were in the contract. "No next page" and "a next page we
      // were not told about" are the same bytes when the page came back FULL: at
      // exactly `limit` entries there is nothing in the response that distinguishes
      // a complete calendar from a truncated one, and the truncated reading is the
      // one that frees somebody's booked afternoon. So a full final page is not an
      // answer. Its own words, so an operator can tell it from the shape refusal.
      if (page.length >= CALENDAR_PAGE_LIMIT) {
        console.warn("[clio] calendar read stopped on a full page with no next page — treated as unread");
        throw new Error("clio: GET /calendar_entries returned a truncated entry list");
      }
      break;
    }

    if (pages >= CALENDAR_MAX_PAGES) {
      // Running out of pages is not reaching the end of the window. Same rule
      // clio-custom-fields.js applies to the field list — a bound on subrequests is
      // not a licence to conclude anything about what lies past it — except that
      // there a truncated walk costs the enrichment, and here it would cost a client
      // their slot, so it throws rather than returning what it managed to read.
      console.warn(`[clio] calendar read truncated at ${CALENDAR_MAX_PAGES} pages — treated as unread`);
      throw new Error("clio: GET /calendar_entries did not finish paging");
    }

    url = next;
  }

  // THE POSITIVE LINE, and the reason the empty case is not silent. "Nothing is
  // booked" and "we could not find out what is booked" now
  // produce different lines rather than the same absence of one, so an operator
  // reading a suspiciously open grid can tell which they are looking at. Count
  // only: the entries carry the firm's schedule and never go to a log.
  //
  // The page count rides on the same line because the two numbers are read together:
  // a jump to several pages is what a firm outgrowing one page looks like, and it is
  // the last quiet moment before the backstop starts refusing bookings.
  console.log(`[clio] calendar entries read: ${entries.length} (pages: ${pages})`);

  return entries
    .map((e) => ({
      startISO: String(e?.[CLIO_FIELDS.CALENDAR_ENTRY_START_FIELD] ?? ""),
      endISO:   String(e?.[CLIO_FIELDS.CALENDAR_ENTRY_END_FIELD] ?? ""),
    }))
    .filter((b) => b.startISO && b.endISO);
}

// The two `fields` selections the contact search runs with.
//
// ENRICHED is what the update path actually needs: without the existing phone
// numbers, addresses and custom-field VALUE ids, a PATCH can only append
// duplicates. MINIMAL is the selection this call used before this ticket and is
// the only one VERIFIED against the firm's Clio (2026-07-03 sandbox probe).
//
// Asking for more fields is not free: an unrecognised `fields` value is a 400 on
// the SEARCH, and a failed search does not degrade to "no enrichment", it degrades
// to `found = null`, which CREATES A SECOND CONTACT for a client Clio already has.
// That is a worse outcome than this ticket's entire upside, so the enriched
// selection is attempted and the minimal one is the floor it falls back to.
//
// ONE SUB-SELECTION, AND IT IS THE ONE THE LIVE GRANT ANSWERS.
// SHELDON-INTAKE-WRITE-FIX. Every sub-resource here was named PLAINLY, on the
// reasoning that the nested `field{sub}` form was Clio documentation rather than
// vendored contract and "this is not the call to find that out on". The call was
// made anyway, by the write-path verifier, against the live grant (PR 163):
// a PLAIN `custom_field_values` comes back as rows carrying `id` and `value` and
// NOTHING THAT NAMES THEIR FIELD. That is a well-formed answer and it is useless
// to the one thing this selection exists for — matching a value we are about to
// write against the value already on the record — so every booking asked for the
// enriched record and got, for the custom fields, exactly what the minimal one
// would have given it.
//
// `custom_field_values{id,value,field_name}` is the selection the probe recorded a
// 200 and twelve NAMED rows for, and it is one level deep: the second level
// (`custom_field{id}`) is a 400 on this grant and is not reachable from here at
// all. The other sub-resources stay plain — the probe says nothing about them, and
// widening a selection nobody has read back is how this defect was written the
// first time.
//
// AND THE FLOOR IS STILL THE FLOOR. If this selection is ever refused, the minimal
// one answers and the contact is still FOUND — no duplicate Person, no failed
// booking. The nesting is attempted, never depended on.
//
// ── SHELDON-DEDUPE-SELECTION-FIX (#154) — AND THE SAME TRAP CLOSED ON THE OTHER
//    THREE SUB-RESOURCES ───────────────────────────────────────────────────────
//
// The paragraph above was right about the mechanism and wrong about its blast
// radius. It read the plain-selection trap as a custom-fields problem and left the
// other sub-resources plain on the reasoning that "widening a selection nobody has
// read back is how this defect was written the first time". That reasoning inverted
// the risk: the danger was never asking for a property, it was asking for a
// SUB-RESOURCE and then reading a property of it that was never selected.
//
// Every sub-resource below is read for exactly one property, and a PLAIN selection
// returns none of them. Elroy probed the live grant read-only and
// `fields=id,email_addresses` answers with rows shaped `{id, etag}` — no `address`
// anywhere. So the matcher in searchContactByEmail lower-cased `undefined` on every
// row, matched nothing, and returned `{conclusive:true, contact:null}` — a CONFIDENT
// not-found, with no warning, because a well-formed 200 carrying rows is exactly
// what "Clio answered and holds nobody" looks like. findOrCreateContact then took
// the licensed create branch and minted A DUPLICATE PERSON ON EVERY BOOKING. Three
// Bobby Brown contacts are the live evidence. The same shape hits the other two:
// updateContact's existing-phone guard reads `.number` and its existing-address
// guard reads `.province`/`.country`, so both answered "no" unconditionally and
// re-appended a phone and an address every time.
//
// Elroy verified the fix on the same live grant, read-only:
//
//   id,email_addresses                 rows shaped {id, etag} · NO address
//   id,email_addresses{address}        the real address · matches contact 2413664198
//
// `custom_field_values{id,value,field_name}` was already correct and is unchanged —
// it is the one selection that was sub-selected, which is precisely why it is the
// one thing that worked. Its second level (`custom_field{id}`) is still a 400 on
// this grant and is still not reachable; every selection here stays ONE level deep.
//
// AND THE FLOOR HAD THE SAME HOLE. The minimal selection is what the search falls
// back to when the enriched one is refused, and it asked for `email_addresses`
// plainly too — so the fallback could not match either, and the "no duplicate
// Person" guarantee the paragraph below claims was never true at any rung. It is
// sub-selected here for the same reason and by the same probe.
const CONTACT_SEARCH_FIELDS_MINIMAL = [
  "id",
  `${CLIO_FIELDS.CONTACT_EMAIL_FIELD}`
    + `{${CLIO_FIELDS.CONTACT_EMAIL_ADDRESS_FIELD}}`,
].join(",");
const CONTACT_SEARCH_FIELDS_ENRICHED = [
  "id",
  CLIO_FIELDS.CONTACT_BODY_FIRST_NAME,
  CLIO_FIELDS.CONTACT_BODY_LAST_NAME,
  // Each sub-selection names EXACTLY the property its reader reads, and the reader
  // now spells it with the same constant, so the two cannot drift apart silently.
  `${CLIO_FIELDS.CONTACT_EMAIL_FIELD}`
    + `{${CLIO_FIELDS.CONTACT_EMAIL_ADDRESS_FIELD}}`,
  `${CLIO_FIELDS.CONTACT_BODY_PHONE}`
    + `{${CLIO_FIELDS.CONTACT_PHONE_NUMBER_FIELD}}`,
  `${CLIO_FIELDS.CONTACT_BODY_ADDRESSES}`
    + `{${CLIO_FIELDS.CONTACT_ADDRESS_PROVINCE},${CLIO_FIELDS.CONTACT_ADDRESS_COUNTRY}}`,
  `${CLIO_FIELDS.CONTACT_BODY_CUSTOM_FIELDS}`
    + `{id,value,${CLIO_FIELDS.CONTACT_CUSTOM_FIELD_NAME}}`,
  // ── SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE ────────────────────────────────
  // The Website write is "only when it is EMPTY", and a selection that does not ask
  // for `web_sites` cannot tell an empty one from an unread one. Both answer
  // `undefined`, and treating `undefined` as empty is how a client's own website
  // gets a second row shoved beside it — the confident not-found that #154 spent a
  // whole ticket removing from the email matcher, re-entering through a new field.
  //
  // So it is SELECTED here, and the reader is still not allowed to conclude
  // "empty" from this line alone: a search that falls back to the MINIMAL selection
  // does not carry it, so the write is additionally gated on WHICH selection
  // answered. See `enriched` in searchContactByEmail and `webSitesReadable` in
  // updateContact — the selection makes the fact readable, the flag proves it was
  // read.
  //
  // ONE LEVEL DEEP, sub-selected on exactly the property its reader reads, by the
  // rule the two paragraphs above this list were written to establish. A plain
  // `web_sites` is the `email_addresses` trap with a different field name.
  `${CLIO_FIELDS.CONTACT_BODY_WEB_SITES}`
    + `{${CLIO_FIELDS.CONTACT_WEB_SITE_ADDRESS}}`,
].join(",");

// The selections the search runs, in order, and the bound on how many times it may
// ask before it gives up. Attempt 1 is the rich selection the update path wants;
// attempts 2 and 3 are the VERIFIED minimal one — the second because Clio may be
// refusing the selection, the third because it may simply have been unavailable.
// clioFetch already retries a 429/5xx/stale-401 once internally, so three attempts
// here is up to six requests and is the ceiling: this sits on the path to a calendar
// write and a client is waiting on it.
const CONTACT_SEARCH_ATTEMPTS = [
  CONTACT_SEARCH_FIELDS_ENRICHED,
  CONTACT_SEARCH_FIELDS_MINIMAL,
  CONTACT_SEARCH_FIELDS_MINIMAL,
];

// ── SHELDON-154-CLIO-DEDUP — THE PHONE LEG'S OWN FLOOR ───────────────────────
//
// The email floor above sub-selects `email_addresses{address}` and NOTHING ELSE,
// because that is the one property its matcher reads. The phone matcher reads
// `phone_numbers[].number`, and the email floor does not carry it — so running the
// phone leg down onto CONTACT_SEARCH_FIELDS_MINIMAL would compare `undefined` on
// every row, match nobody, and report a CONFIDENT NOT-FOUND. That is #154 exactly,
// re-entering through a second field, and it is the one mistake this ticket is not
// allowed to make while fixing it.
//
// So the phone leg gets a floor of its own, built by the same rule: one level deep,
// sub-selected on precisely the property its reader reads. It is a SEPARATE constant
// rather than a field appended to the email floor, because the floor's whole job is
// to be the selection that still answers when the enriched one is refused — widening
// it would put the email leg's last rung at the phone leg's risk for nothing.
const CONTACT_SEARCH_FIELDS_MINIMAL_PHONE = [
  "id",
  `${CLIO_FIELDS.CONTACT_BODY_PHONE}`
    + `{${CLIO_FIELDS.CONTACT_PHONE_NUMBER_FIELD}}`,
].join(",");

// Same three rungs, same reasoning, different floor. The enriched selection already
// carries `phone_numbers{number}`, so attempt 1 is shared.
const CONTACT_PHONE_SEARCH_ATTEMPTS = [
  CONTACT_SEARCH_FIELDS_ENRICHED,
  CONTACT_SEARCH_FIELDS_MINIMAL_PHONE,
  CONTACT_SEARCH_FIELDS_MINIMAL_PHONE,
];

/**
 * Ask Clio whether it already holds a Person with this email.
 *
 * ANSWERS IN THREE STATES, NOT TWO, AND THAT IS THE WHOLE FIX. This used to return
 * `null` both for "Clio says there is no such contact" and for "Clio did not
 * answer", and the caller could not tell them apart, so it created. A 429 or a 5xx
 * on the search therefore MINTED A DUPLICATE PERSON for a client Clio already had —
 * and the duplicate looked like success from every angle: it carries the attendee,
 * so the client still gets their confirmation email, while the intake note and the
 * seven custom field values file onto an empty second record and the one the
 * attorney actually opens gets nothing. Nothing errors, nothing alerts, and the
 * firm's CRM quietly forks per outage.
 *
 * So: `{ conclusive: true, contact }` means Clio answered — `contact` is the match
 * or null, and null genuinely licenses a create. `{ conclusive: false }` means it
 * did not, and the caller must NOT create. Refusing to write is recoverable (the
 * next booking links correctly); a duplicate Person is not — nothing in this code
 * can find it again, let alone merge it.
 *
 * ANSWERED means an HTTP 200 whose body PARSES AND CARRIES A `data` ARRAY — all
 * three, not the first two (R3). A transport failure, a non-2xx, a body that is not
 * JSON and a body without a result array are four distinct ways of not answering,
 * each warns in its own words, and every one of them falls through to the next
 * attempt and then to `{ conclusive: false }`.
 *
 * The enriched selection is attempted first and the minimal one is the floor it
 * falls back to. A contact found through the fallback carries no phone/address/
 * custom-field detail, so updateContact sees an empty record and its "does the
 * contact already have this?" tests all answer no — the intake is appended rather
 * than updated in place. Fewer guarantees, same contact.
 *
 * AND `enriched` SAYS WHICH RUNG ANSWERED, because for one field that distinction is
 * the difference between correct and destructive.
 * SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE. The paragraph above is an accurate and
 * fairly cheerful description of a fallback whose every consequence is an APPEND: a
 * duplicate phone row, a duplicate address, a second custom-field value. Untidy,
 * recoverable, and the contact is still FOUND, which was always the point.
 *
 * The Website write is not that shape. It is licensed by ABSENCE — "set it only when
 * the contact has none" — and a record that was never asked for `web_sites` reports
 * absence exactly as loudly as a record that genuinely has none. Under the minimal
 * selection every contact on the account looks website-less, so "never overwrite a
 * client's own site" would hold only for as long as the enriched selection kept
 * working, and would fail silently the first time it did not.
 *
 * A guard that is correct only on the happy path is the failure this file has now
 * paid for twice — the `email_addresses` matcher in #154, the create-path value index
 * in #170 — and both times the shape was the same: a well-formed answer to a question
 * we had not actually asked. So the rung is REPORTED rather than inferred. True means
 * the record came off attempt 1 and its `web_sites` is an observation. False means the
 * field was not read, and nothing may be concluded from its absence.
 *
 * @returns {Promise<{conclusive: boolean, contact: object|null, enriched: boolean}>}
 */
async function searchContactByEmail(cfg, env, email) {
  const emailLower = String(email ?? "").trim().toLowerCase();
  // No email to search on is not an outage — there is conclusively nothing to find.
  // Nothing was read either, so `enriched` is false: there is no record to enrich,
  // and the flag never claims a read that did not happen.
  if (!emailLower) return { conclusive: true, contact: null, enriched: false };

  const found = await runContactSearch(cfg, env, {
    query: email,
    attempts: CONTACT_SEARCH_ATTEMPTS,
    label: "contact search",
    match: (row) => {
      const emails = Array.isArray(row?.[CLIO_FIELDS.CONTACT_EMAIL_FIELD])
        ? row[CLIO_FIELDS.CONTACT_EMAIL_FIELD]
        : [];
      return emails.some((e) =>
        String(e?.[CLIO_FIELDS.CONTACT_EMAIL_ADDRESS_FIELD] ?? "").toLowerCase() === emailLower
      );
    },
  });

  // ── SHELDON-154-CLIO-DEDUP — WHICH ONE, WHEN THE FIRM ALREADY HAS SEVERAL ───
  //
  // This used to be `.find()`: the first exact match in the order the page arrived.
  // While duplicates exist — and they do, that is the ticket — "first on the page" is
  // whatever `order` happens to default to, so two bookings by the same client could
  // land on two DIFFERENT records and the fork would keep widening from both ends.
  //
  // The OLDEST id wins instead. It is the record the firm has been working out of,
  // it is the one the paralegal merges the others INTO (see docs/runbooks), and it is
  // decided here rather than by the vendor's sort order, so it holds whatever Clio
  // returns and in whatever sequence.
  return { conclusive: found.conclusive, contact: oldest(found.matches), enriched: found.enriched };
}

/**
 * The lowest-id record in a match list, or null. Ties and non-numeric ids fall back
 * to the first match rather than to nothing — a deterministic answer beats a correct
 * refusal here, because the caller's alternative to "a match" is "mint a duplicate".
 */
function oldest(matches) {
  if (!Array.isArray(matches) || matches.length === 0) return null;
  return matches.reduce((best, row) => {
    const a = Number(best?.id);
    const b = Number(row?.id);
    if (!Number.isFinite(b)) return best;
    if (!Number.isFinite(a)) return row;
    return b < a ? row : best;
  });
}

/**
 * Ask Clio whether it already holds a Person on this PHONE NUMBER.
 *
 * ── SHELDON-154-CLIO-DEDUP — WHY A SECOND KEY AT ALL ─────────────────────────
 *
 * #154 fixed the email matcher and the CRM kept forking anyway, because the email
 * was never the stable half of the identity. A client books once from a personal
 * address and once from work, or types a different one on the phone, and the search
 * asks Clio a question whose honest answer is "no, nobody has THAT address" — a
 * conclusive not-found, correctly reported, licensing a create for a person Clio
 * already holds. Three David Pierce records are what that looks like from the firm's
 * side. Measured on the write path: booking 1 creates, booking 2 on the same email
 * reuses, booking 3 on the SAME PHONE and a different email creates again.
 *
 * The phone is the other identifier every booking on every channel collects, and
 * Clio's own `query` already searches it — the vendored contract calls the parameter
 * a "Wildcard search for name, title, email address, address, phone number, …", so
 * this is the documented endpoint asked a second documented question, not a new one.
 *
 * ── AND IT ONLY RUNS WHERE A DUPLICATE WOULD OTHERWISE BE MINTED ─────────────
 *
 * The caller reaches here only after the email search answered and matched NOBODY —
 * the exact branch that creates today. A returning client whose email is already on
 * the record never gets here, so the common booking costs zero extra subrequests and
 * the ceiling this file sets on the calendar-write path is untouched.
 *
 * ── WHAT THIS CANNOT DO, SAID OUT LOUD ──────────────────────────────────────
 *
 * Clio's `query` is a WILDCARD OVER THE STORED STRING and there is no normalised
 * phone lookup on the contract at all. `5615550142` does not match a stored
 * `(561) 555-0142` and neither matches a stored `561-555-0142`. So both spellings we
 * could plausibly have stored are asked for — the raw one the client typed, which is
 * what this code writes on create, and the digits — and the MATCHER is normalised
 * (`phoneKey`, digits only) so that whatever comes back is compared format-blind.
 * A number stored in a third spelling still will not be found, and that is a limit of
 * the vendor's search, not a thing to paper over: this widens reuse, it does not
 * promise it.
 *
 * ── THREE STATES, LIKE THE EMAIL LEG, AND FOR THE SAME REASON ───────────────
 *
 * A spelling that did not answer cannot be read as "nobody has this number". If any
 * spelling failed to answer and no match was found, the whole leg is INCONCLUSIVE and
 * the caller must not create — the same trade the email leg makes, and the same one
 * PR 138 reasoned out: a booking that fails to link is restored by the next booking,
 * a duplicate Person is not.
 *
 * @returns {Promise<{conclusive: boolean, matches: object[], enriched: boolean}>}
 */
async function searchContactByPhone(cfg, env, phone) {
  const raw = String(phone ?? "").trim();
  const digits = phoneKey(raw);
  // No number to search on is not an outage — there is conclusively nothing to find,
  // and no request is made. A booking with no phone costs this leg nothing.
  if (!digits) return { conclusive: true, matches: [], enriched: false };

  // The spellings we might have stored, deduped so an already-bare number is asked
  // for once rather than twice.
  const spellings = raw === digits ? [raw] : [raw, digits];

  let everySpellingAnswered = true;
  for (const q of spellings) {
    const found = await runContactSearch(cfg, env, {
      query: q,
      attempts: CONTACT_PHONE_SEARCH_ATTEMPTS,
      label: "contact phone search",
      match: (row) => {
        const phones = Array.isArray(row?.[CLIO_FIELDS.CONTACT_BODY_PHONE])
          ? row[CLIO_FIELDS.CONTACT_BODY_PHONE]
          : [];
        return phones.some(
          (p) => phoneKey(p?.[CLIO_FIELDS.CONTACT_PHONE_NUMBER_FIELD]) === digits,
        );
      },
    });

    if (!found.conclusive) { everySpellingAnswered = false; continue; }
    // A match ends the leg: the remaining spelling can only find the same person.
    if (found.matches.length) {
      return { conclusive: true, matches: found.matches, enriched: found.enriched };
    }
  }

  // Every spelling answered and none matched ⇒ Clio genuinely holds nobody on this
  // number. Otherwise we simply did not get to ask, and must not say we did.
  return { conclusive: everySpellingAnswered, matches: [], enriched: false };
}

/**
 * One search, three states, told apart — shared by the email and phone legs.
 *
 * Extracted from searchContactByEmail unchanged in behaviour. The two legs differ in
 * exactly three things (the query string, the attempt list, and what counts as a
 * match) and in NOTHING about how an answer is distinguished from a non-answer — so
 * that reasoning lives once. A second hand-written copy of this loop is how the phone
 * leg would come to treat an unreadable body as an empty result set while the email
 * leg still knew better.
 *
 * `label` is how this search NAMES itself in the logs. The two legs fail for the same
 * reasons and cost the operator different things, and a shared string would leave
 * "which search could not reach Clio" unanswerable in the one place it is asked.
 *
 * @returns {Promise<{conclusive: boolean, matches: object[], enriched: boolean}>}
 */
async function runContactSearch(cfg, env, { query, attempts, match, label }) {
  const run = async (fields) => {
    const qParams = new URLSearchParams({
      [CLIO_FIELDS.CONTACT_QUERY_PARAM]: query,
      [CLIO_FIELDS.CONTACT_TYPE_PARAM]: "Person",
      [CLIO_FIELDS.CALENDAR_ENTRIES_FIELDS_PARAM]: fields,
    });
    return clioFetch(`${CLIO_BASE}/contacts?${qParams}`, { method: "GET" }, cfg, env);
  };

  for (let attempt = 0; attempt < attempts.length; attempt += 1) {
    let res;
    try {
      res = await run(attempts[attempt]);
    } catch (_) {
      // Transport failure. Status only — there is no status, so say so and move on.
      console.warn(`[clio] ${label} attempt ${attempt + 1} failed: error`);
      continue;
    }

    if (!res?.ok) {
      // Status only. The response body echoes the query, and the query is the
      // client's email address or their telephone number.
      console.warn(`[clio] ${label} attempt ${attempt + 1} HTTP ${res?.status}`);
      continue;
    }

    let searchData;
    try {
      searchData = await res.json();
    } catch (_) {
      // A 200 we cannot read is not an empty result set. Treat it as no answer.
      console.warn(`[clio] ${label} attempt ${attempt + 1} returned an unreadable body`);
      continue;
    }

    // R3. PARSEABLE IS NOT THE SAME AS ANSWERED, and this is the last door the
    // duplicate could still walk through. The shape test used to sit inline —
    // `Array.isArray(data) ? data : []` — so a 200 carrying `{}`, or `{"data":null}`,
    // or an error object with no `data` at all, collapsed to an empty candidate list
    // and was then reported as CONCLUSIVE. That is the whole defect this function was
    // cut to close, arriving one layer lower down: the caller reads "Clio answered,
    // and it holds nobody", creates, and the firm gets the second Person record all
    // over again. A body without a result array is no answer, so it takes the same
    // `continue` the unreadable body takes — and says so in its OWN words, because
    // "Clio replied with something we could not interpret" is a different operational
    // fact from "Clio replied with bytes that are not JSON", and the two get told
    // apart in the logs or neither is diagnosable.
    if (!Array.isArray(searchData?.data)) {
      console.warn(`[clio] ${label} attempt ${attempt + 1} returned a body with no result array`);
      continue;
    }

    // EVERY match, not the first one. The caller decides which — the email leg takes
    // the oldest, the phone leg REFUSES when there is more than one (see
    // findOrCreateContact). Neither of those decisions is available to a `.find()`.
    const matches = searchData.data.filter((c) => match(c));

    // Clio answered. An empty result set is a real answer and does license a create.
    //
    // Attempt 0 is the ONLY rung that ran the enriched selection (both attempt lists
    // are enriched, minimal, minimal), so it is the only one whose record may be read
    // for a field's ABSENCE. Derived from the list in hand rather than from a second
    // copy of it — a hand-written `attempt === 0` and a reordered attempt list is
    // exactly how this flag would come to lie.
    return {
      conclusive: true,
      matches,
      enriched: attempts[attempt] === CONTACT_SEARCH_FIELDS_ENRICHED,
    };
  }

  return { conclusive: false, matches: [], enriched: false };
}

/**
 * How the create path NAMES a failed enriched read, and what it says is lost.
 * Pinned by test/clio-create-path-write.test.mjs, which asserts this wording.
 */
const CREATE_PATH_READ_LOG = Object.freeze({
  what: "[clio] created contact not re-read",
  consequence: " — intake values go out in create form",
});

/**
 * The post-call read's wording. THE CONSEQUENCE IS THE OPPOSITE ONE, and that is why
 * it is a separate constant rather than a reworded string. When the CREATE path
 * cannot re-read a contact it degrades to create-form rows, because a client is
 * waiting on a confirmation email and a wrong-form row is better than a lost
 * booking. The post-call webhook has NO client waiting, so it degrades the other
 * way — it writes nothing at all rather than send create-form rows onto materialised
 * ones and earn back the 422 that PR 170 closed.
 */
const POSTCALL_READ_LOG = Object.freeze({
  what: "[postcall] contact not read",
  consequence: " — no post-call fields written",
});

/**
 * Read a contact we JUST CREATED back, with the selection the search uses.
 *
 * SHELDON-INTAKE-CREATE-PATH-422. THE CREATE PATH NEVER LOOKED AT THE CONTACT IT
 * MADE. findOrCreateContact built the enrichment's `found` shim out of the create
 * BODY, and that body has no custom fields in it by design (the optional half moved
 * to the PATCH), so the shim carried `custom_field_values: []` as a literal. An
 * empty array is an empty existingValueIndex, and an empty index is create-form for
 * every row — `custom_field{id}` with no `id` — which is exactly the form PR 167
 * removed from the REUSE path and never removed from this one.
 *
 * That is not a cosmetic asymmetry. Live, on the same deploy: a reused contact sent
 * rows shaped `{id, value, custom_field{id}}` and Clio answered 200; a freshly
 * created one sent `{value, custom_field{id}}` with no value id and Clio answered
 * 422. The two branches differ in exactly this.
 *
 * A CONTACT IS NOT BORN EMPTY. Clio materialises a CustomFieldValue row for every
 * CustomField that is displayed by default, so the record that exists one moment
 * after POST /contacts already carries rows for the seven Intake fields — with their
 * own composite value ids. The create path could not see them because it never
 * asked. This is the ask, and it is deliberately the SAME selection the search runs
 * (CONTACT_SEARCH_FIELDS_ENRICHED, one level deep, `custom_field_values{id,value,
 * field_name}`) rather than a second spelling of it: two spellings of one selection
 * is how the read and its reader drift apart, which is the defect PR 167 closed.
 *
 * AND IT DEGRADES TO EXACTLY TODAY'S BEHAVIOUR. Every failure — transport, non-2xx,
 * an unreadable body, a body that is not a single record — returns null, the shim
 * keeps its empty array, and the rows go out in create form the way they do now.
 * The fix cannot cost a booking anything it does not already cost, and it cannot
 * fail closed onto a client waiting for a confirmation email. It says so out loud in
 * its own words, because "the re-read did not happen" and "the contact genuinely has
 * no rows" produce identical PATCH bodies and must not produce identical logs.
 *
 * ONE EXTRA SUBREQUEST, ON THE CREATE PATH ONLY. A returning client's booking is
 * untouched — that branch already holds the search's enriched record and never
 * reaches here.
 *
 * @param {{what:string, consequence:string}} [log]
 *        How a failed read is NAMED. The read itself is one request and one shape
 *        check; what differs between callers is what is LOST when it fails, and a
 *        shared helper that logged the create path's consequence on the post-call
 *        path would tell the operator the wrong thing about the wrong write. The
 *        default reproduces the create-path wording exactly.
 * @returns {Promise<object|null>} the contact record, or null on any failure.
 */
async function readContactAfterCreate(cfg, env, contactId, log = CREATE_PATH_READ_LOG) {
  const qParams = new URLSearchParams({
    [CLIO_FIELDS.CALENDAR_ENTRIES_FIELDS_PARAM]: CONTACT_SEARCH_FIELDS_ENRICHED,
  });

  let res;
  try {
    res = await clioFetch(
      `${CLIO_BASE}/contacts/${contactId}?${qParams}`, { method: "GET" }, cfg, env,
    );
  } catch (_) {
    console.warn(`${log.what}: error${log.consequence}`);
    return null;
  }
  if (!res?.ok) {
    // Status only, like every other read on this path: the body echoes the record.
    console.warn(`${log.what}: HTTP ${res?.status}${log.consequence}`);
    return null;
  }

  let payload;
  try {
    payload = await res.json();
  } catch (_) {
    console.warn(`${log.what}: unreadable body${log.consequence}`);
    return null;
  }

  // A single-record read answers with an OBJECT. An array here means we were served
  // a list — a different endpoint's answer — and reading it as a record would index
  // nothing while looking like a success.
  const record = payload?.data;
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    console.warn(`${log.what}: no record in the body${log.consequence}`);
    return null;
  }
  return record;
}

/**
 * Split the single booking-form name field into Clio's first/last pair.
 *
 * NO PLACEHOLDER SURNAME. This used to fall back to the literal string "(unknown)"
 * when the caller typed one word, on the reasoning that a blank last name sorts
 * badly in Clio and a visible placeholder tells the lawyer the form never asked.
 * That reasoning was wrong in the only place it mattered: the string is not a note
 * to the lawyer, it is the client's NAME. It is what the attorney sees in the
 * contact list, what search matches on, and — because Clio composes a Person's
 * display name from these fields — a real client on the firm's books called
 * "(unknown)". A caller who enters "Cher", or the many people whose legal name is
 * one word, got that.
 *
 * It was also unnecessary. The Contacts tag documentation is explicit that a Person
 * needs "at least a first name or a last name" — one of the two, not both — and
 * recommends the individual name fields over the composed `name` parameter. So
 * there is nothing to pad.
 *
 * A single token therefore becomes the LAST name with no first name at all. That is
 * the honest mapping: we do not know whether one word is a given name or a surname,
 * and last_name is the field Clio sorts, searches and composes the display name
 * from, so a lone token there reads as itself rather than as a defect.
 *
 * `single` travels with the pair so updateContact can refuse to write a surname
 * this function GUESSED onto a record a human already curated — see there.
 *
 * @returns {{firstName:string, lastName:string, single:boolean}}
 *          firstName is "" when the form gave only one token; callers omit empty
 *          fields from the body rather than sending "".
 */
function splitName(fullName) {
  const parts = String(fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) {
    return { firstName: "", lastName: parts[0] ?? "", single: true };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
    single: false,
  };
}

/** Digits only, so "(561) 555-0142" and "5615550142" are recognised as one number. */
function phoneKey(v) {
  return String(v ?? "").replace(/\D/g, "");
}

/**
 * Turn the qualifier's `state` answer into a Clio address.
 *
 * Clio calls the field `province`, not `state` — a body spelling it `state` is an
 * unrecognised key, and v4 DISCARDS those silently (the same failure mode that hid
 * `contact_id` on the calendar entry for months), so it would look like a clean
 * 201 with an empty address.
 *
 * The qualifier stores either a two-letter code or the literal `outside_us`. The
 * second is not a province, so it is recorded as a country instead of thrown away:
 * "this client is not in the U.S." is exactly the sort of fact the lawyer wants on
 * the record before the consultation.
 */
function buildAddresses(state) {
  const s = String(state ?? "").trim();
  if (!s) return [];
  if (s.toLowerCase() === "outside_us") {
    return [{ name: "Home", [CLIO_FIELDS.CONTACT_ADDRESS_COUNTRY]: "Outside the U.S." }];
  }
  if (/^[A-Za-z]{2}$/.test(s)) {
    return [{ name: "Home", [CLIO_FIELDS.CONTACT_ADDRESS_PROVINCE]: s.toUpperCase() }];
  }
  return [];
}

/** intake key → the CustomField NAME it binds to, from the one list there is. */
const INTAKE_NAME_BY_KEY = new Map(CONTACT_CUSTOM_FIELDS.map((f) => [f.key, f.name]));

// ── The consult type, from the booking's own typeId ──────────────────────────
//
// SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE. The one thing every booking has and
// the contact never carried: WHICH consultation was booked. It is not a qualifier
// answer — see BOOKING_CUSTOM_FIELDS in clio-custom-fields.js for why that
// distinction is enforced by keeping it out of the seven — and it reaches the
// contact on both the web and the voice path for one plain reason: `typeId` is a
// required parameter of createBooking, so there is no booking on either channel
// that lacks one.
//
// NOTHING IS INVENTED WHEN THE LOOKUP MISSES. The value is the appointment's
// configured NAME, resolved through the firm's own allow-list; an id the allow-list
// does not know is written VERBATIM instead. That fallback is deliberately the
// opposite of the client-facing one: buildClientDescription falls back to the
// generic word "Consultation" because an internal id is not something to show a
// client, while this field is the lawyer's own record and a raw `typeId` is the
// truthful answer to "what did they book". Substituting a friendly label the firm
// never configured would be this code making something up on a client record.
const CONSULT_TYPE_KEY = "consult_type";

/**
 * The configured appointment type for an id, or undefined.
 *
 * ONE LOOKUP, TWO READERS. createBooking already resolved this for the calendar
 * entry's client-facing name; doing it a second time by hand here is how the
 * confirmation email and the CRM field come to name two different appointments for
 * one booking. They take DIFFERENT fallbacks (see above) and they must not take
 * different matches.
 */
function matchAppointmentType(cfg, typeId) {
  return (Array.isArray(cfg?.appointment_types) ? cfg.appointment_types : [])
    .find((t) => String(t?.id) === String(typeId));
}

/**
 * The value written to `Intake Consult Type`, or "" when there is no typeId at all.
 *
 * "" IS AN UNSUPPLIED MATTER-SCOPED ANSWER, which is not the same thing it was
 * before SHELDON-INTAKE-FIELD-MERGE-POLICY. `Intake Consult Type` is classified with
 * the matter set (clio-custom-fields.js), so on a booking that names a matter
 * category an empty consult type CLEARS the row rather than leaving the previous
 * booking's consultation standing beside a new matter — which is the same fabricated
 * pair the sub-type produced. On a booking with no matter category nothing is
 * cleared and the behaviour is exactly as it was.
 *
 * In practice this is close to unreachable: `typeId` is a required parameter of
 * createBooking, so there is no booking on either channel that lacks one, and an id
 * the firm's allow-list does not know is written VERBATIM rather than dropped. The
 * empty case is the defensive floor, not a path a real booking takes.
 */
function consultTypeValue(cfg, typeId) {
  const id = String(typeId ?? "").trim();
  if (!id) return "";
  return String(matchAppointmentType(cfg, id)?.name ?? "").trim() || id;
}

// ── The firm's own website, recorded as where the booking came from ──────────
//
// A FIXED FIRM CONSTANT, WHICH IS THE WHOLE OF ITS SAFETY. There is no parameter,
// no caller input and no qualifier answer that can influence what this write sends:
// the value is one literal, so a leak through this field is not something that has
// to be argued about at call sites. It is the same property that makes
// buildClientDescription's claim checkable, applied to a field on the other side of
// the split.
//
// NOT in config.js beside firm_phone / firm_email on purpose. Those three exist
// because they reach the CLIENT through the calendar-entry description and must be
// firm-settable per environment. This one never reaches a client at all — it is a
// provenance marker on the lawyer-only CRM record — so putting it in the
// client-facing config block would file it under the wrong contract.
const FIRM_WEBSITE = "https://www.donovan.law/";

// The `web_sites[].name` enum is a FOURTH closed label list, overlapping the other
// three (see the contract notes) without being any of them:
//
//   web_sites[].name = ["Work","Personal","Twitter","Facebook","LinkedIn",
//                       "Instant Messenger","Other"]              default: "Other"
//   …schema.properties.data.properties.web_sites.items.properties.name.enum
//
// "Other" is sent, and not merely because the spec defaults to it. "Work" and
// "Personal" are both CLAIMS ABOUT THE CLIENT — that this URL is their employer's
// site, or their own. It is neither. It is the firm's site, on the client's record,
// because that is where they booked. "Other" is the only label in the enum that
// says nothing untrue about the person whose record it lands on.
const WEB_SITE_LABEL = "Other";

// Every booking that reaches this adapter came through donovan.law's booking widget
// — see the gate in updateContact for why that is structural rather than assumed.
// The name exists so the day there IS a non-website booking channel, the thing that
// has to change is a predicate with a comment on it and not a silent `true`.
const WEBSITE_SOURCED = true;

/**
 * The same map for the four post-call fields. SEPARATE, because the by-name rung in
 * buildCustomFieldValues is the one that actually fires against the live grant: a
 * writer whose keys are missing from the map it was handed silently loses the
 * update form and sends create-form rows onto materialised ones.
 */
const POSTCALL_NAME_BY_KEY = new Map(POSTCALL_CUSTOM_FIELDS.map((f) => [f.key, f.name]));

/**
 * The default for `clearableKeys`: nothing may be cleared.
 *
 * A caller that says nothing about field classes gets the pre-policy behaviour —
 * supplied fields written, unsupplied fields left standing. The post-call writer is
 * that caller and must stay that caller: its four fields are one analysis of one
 * call, it has no matter context to reason from, and a missing sentiment is not
 * evidence that the sentiment changed.
 */
const NO_CLEARS = new Set();

/**
 * Build the `custom_field_values` array for the intake answers we have ids for.
 *
 * `existingByFieldId` maps CustomField id → the CustomFieldValue id already on this
 * contact. Supplying that value id UPDATES the answer in place; omitting it ADDS a
 * second value alongside the first. On the update path the omission is the bug: a
 * client who books three times would otherwise end up with three "Intake Income
 * Band" rows on one contact, which is worse than not writing the field at all
 * because the lawyer cannot tell which one is current.
 *
 * Ids come from clio-custom-fields.js and may be partial — a field that could not
 * be resolved is simply absent from the body rather than sent with a null id.
 *
 * THE VALUE ID IS OPAQUE AND MAY BE ABSENT. It is a composite string like
 * "text_line-1", not a number (see the contract notes at the top of this file), so
 * it is passed through exactly as Clio handed it over — never parsed, never
 * compared numerically, never rebuilt. When it is null or missing, the documented
 * instruction is to send `custom_field{id}` and let Clio create the value, which is
 * precisely what omitting `id` here does.
 *
 * AN UNSUPPLIED FIELD IS NOT AUTOMATICALLY A SKIPPED ONE. `clearableKeys` names the
 * keys this caller has licensed to be EMPTIED when the answer is absent, and it is
 * the whole of SHELDON-INTAKE-FIELD-MERGE-POLICY. The default is the empty set —
 * skip everything unsupplied, exactly as this function behaved before — so a caller
 * that does not opt in cannot start deleting a client's answers by upgrading. A
 * licensed clear still goes out in UPDATE form carrying the id the contact already
 * holds, and is emitted only when the contact actually holds a non-empty value:
 * there is no path through this function that sends a create-form blank.
 *
 * @param {Set<string>} [clearableKeys] keys that may be emptied when unsupplied.
 */
function buildCustomFieldValues(
  intakeFields, ids, existing, nameByKey = INTAKE_NAME_BY_KEY, clearableKeys = NO_CLEARS,
) {
  const out = [];
  for (const [key, fieldId] of Object.entries(ids ?? {})) {
    if (fieldId == null) continue;
    const value = String(intakeFields?.[key] ?? "").trim();
    // BY ID FIRST, BY NAME SECOND, AND THE SECOND IS THE ONE THAT FIRES LIVE. The
    // id route is kept because it is the stronger join and costs nothing when the
    // rows cannot carry it; the name route is what a real contact read answers.
    // See existingValueIndex.
    //
    // `nameByKey` defaults to the seven so the booking path is unchanged. The
    // post-call writer passes its own map: the by-name fallback is the rung that
    // fires against the live grant, so a writer whose keys are absent from the map
    // would silently lose it and send create-form rows onto materialised ones —
    // the exact 422 PR 170 closed. The map travels with the caller for that reason.
    const name = nameByKey.get(key);
    const existingValueId = existing?.byFieldId?.get(String(fieldId))
      ?? (name == null ? undefined : existing?.byName?.get(name));

    if (!value) {
      // ── THE FIELD THIS BOOKING DID NOT SUPPLY ──────────────────────────────
      //
      // SHELDON-INTAKE-FIELD-MERGE-POLICY. This branch used to be an unconditional
      // `continue`, and that blanket skip is what produced the reported blend: a
      // returning client's second booking supplied `Matter Category: Other` and no
      // sub-type, the previous booking's `Sub-Type: Ownership` was never cleared,
      // and the contact came to read a pair no single session ever produced — Other
      // has no sub-types at all. Skipping an unsupplied field is right for one class
      // of answer and wrong for the other; which class is declared per field in
      // clio-custom-fields.js, and `clearableKeys` is that decision already made by
      // the caller. An empty set restores the old behaviour exactly, which is what
      // the post-call writer gets.
      if (!clearableKeys.has(key)) continue;

      // THE CLEAR IS AN UPDATE OR IT IS NOTHING. Both guards are the same guard:
      // without a value id already on this contact the only row we could send is the
      // CREATE form — `custom_field{id}` and no `id` — onto a field Clio has already
      // materialised, which is precisely the 422 PR 170 closed. There is also
      // nothing to clear in that case: no id means no value. So a degraded read,
      // which yields an empty index, cannot make this branch write anything at all —
      // the same fail-safe direction `webSitesReadable` gives the website write.
      if (existingValueId == null) continue;

      // ALREADY BLANK ⇒ SAY NOTHING. A displayed-by-default field that was never
      // given a value carries a real id and an empty string, so without this the
      // clear would fire on every matter booking and write "" onto "". See the note
      // in existingValueIndex for why that costs more than a wasted row.
      const held = existing?.textByFieldId?.get(String(fieldId))
        ?? (name == null ? undefined : existing?.textByName?.get(name));
      if (!held) continue;

      out.push({
        // Update form, carrying the id the contact already holds — the row is
        // emptied in place. `_destroy` is NEVER sent (contract note 1): the
        // CustomFieldValue stays, its value goes.
        id: existingValueId,
        value: "",
        [CLIO_FIELDS.CONTACT_CUSTOM_FIELD_REF]: { id: fieldId },
      });
      continue;
    }

    out.push({
      // Present ⇒ update in place. Absent ⇒ create. Nothing in between.
      ...(existingValueId == null ? {} : { id: existingValueId }),
      value,
      [CLIO_FIELDS.CONTACT_CUSTOM_FIELD_REF]: { id: fieldId },
    });
  }
  return out;
}

/**
 * Which keys THIS booking has licensed the write to clear.
 *
 * THE GUARD IS THE MATTER CONTEXT, and it is what keeps the policy from eating a
 * returning client's record. A booking that names a matter category has
 * said what this engagement is about, so its matter surface is authoritative and
 * every matter-scoped field it did not supply is stale by construction. A booking
 * that names NO category has said nothing about a matter at all — a plain
 * re-booking, a voice call that never reached the qualifier's matter step — and the
 * only honest reading of that silence is "unchanged". Without this gate the shortest
 * possible booking would wipe the matter surface of every returning client, which is
 * a worse defect than the blend it set out to fix.
 *
 * PERSON-SCOPED KEYS ARE NEVER RETURNED, at any matter context. They are not part of
 * the matter set and a matter changing says nothing about the client's language.
 */
function matterClearKeys(intakeFields) {
  const hasMatterContext = String(intakeFields?.[MATTER_CONTEXT_KEY] ?? "").trim() !== "";
  return hasMatterContext ? MATTER_SCOPED_KEYS : NO_CLEARS;
}

/**
 * What this contact ALREADY holds, indexed both ways a row can be attributed.
 *
 * The VALUE in both maps is the CustomFieldValue's own composite id, stored
 * verbatim. Supplying it on the PATCH is what makes the write an UPDATE of the
 * value the lawyer is looking at rather than a second value alongside it.
 *
 * SHELDON-INTAKE-WRITE-FIX — THIS INDEX WAS EMPTY ON EVERY LIVE BOOKING, and it was
 * empty by construction rather than by accident. It read one key, `custom_field.id`,
 * and the live grant does not put that key on a contact's rows at any selection this
 * integration can ask for: plain returns `id`/`value` only, `{…custom_field}` returns
 * a wrapper with no usable id, and `{…custom_field{id}}` is a 400 (PR 163's probe
 * table, reproduced at CONTACT_CUSTOM_FIELD_NAME). So every row was skipped, the map
 * came back empty, and every one of the seven answers went to Clio in CREATE form —
 * `custom_field{id}` with no `id` — no matter what the contact already carried.
 *
 * That form is correct for exactly one case, and Clio's own documentation says which:
 * "If the `id` is NULL, you must provide `custom_field{id}` to create the
 * CustomFieldValue and assign a value." A row that HAS an id is the other case, and
 * it was being written as though it were the first.
 *
 * BOTH KEYS ARE INDEXED, and the id one is not dead weight: it is the stronger join
 * (a name can be re-spelled in Clio settings, an id cannot), it is what a PATCH
 * response or a future selection may yet carry, and keeping it means the fallback is
 * a widening rather than a swap. `byName` is the one that fires today.
 *
 * A row whose `id` is null is skipped rather than indexed: the documentation says
 * that is what a displayed-but-unset field looks like, and it means "create", which
 * is the same thing as not being in this index.
 *
 * @returns {{byFieldId: Map<string, string>, byName: Map<string, string>}}
 */
function existingValueIndex(contactRecord) {
  const byFieldId = new Map();
  const byName = new Map();
  const textByFieldId = new Map();
  const textByName = new Map();
  const rows = Array.isArray(contactRecord?.[CLIO_FIELDS.CONTACT_BODY_CUSTOM_FIELDS])
    ? contactRecord[CLIO_FIELDS.CONTACT_BODY_CUSTOM_FIELDS]
    : [];
  for (const row of rows) {
    const valueId = row?.id;
    if (valueId == null || valueId === "") continue;
    // WHAT THE ROW HOLDS TODAY, alongside the id that addresses it.
    //
    // SHELDON-INTAKE-FIELD-MERGE-POLICY. The clear branch in buildCustomFieldValues
    // needs to tell "this field holds Ownership" from "this field is materialised and
    // blank", and the value id answers neither — a displayed-by-default field that
    // has never been given a value still has one. Without this, every booking that
    // establishes a matter context would send a blank onto fields that are already
    // blank: rows Clio accepts and changes nothing with, on the latency path to a
    // client's calendar write, and enough to turn `no_change` — the signal that says
    // an enrichment genuinely had nothing to do — into a PATCH that always fires.
    const text = String(row?.value ?? "").trim();
    const fieldId = row?.[CLIO_FIELDS.CONTACT_CUSTOM_FIELD_REF]?.id;
    if (fieldId != null) {
      byFieldId.set(String(fieldId), valueId);
      textByFieldId.set(String(fieldId), text);
    }
    // Trimmed, never case-folded. The name is the contract with the firm's account
    // and clio-custom-fields.js resolves ids by exactly this spelling; matching
    // loosely HERE would bind a value to a field the id lookup would have refused.
    const name = String(row?.[CLIO_FIELDS.CONTACT_CUSTOM_FIELD_NAME] ?? "").trim();
    // FIRST ROW WINS, same rule the id walk applies. A contact carrying two rows
    // under one name is a state this code did not create and must not compound by
    // preferring whichever copy Clio happened to serialise last. The text map is
    // keyed off the SAME test so the value and the id a row contributes can never
    // come from two different rows.
    if (name && !byName.has(name)) {
      byName.set(name, valueId);
      textByName.set(name, text);
    }
  }
  return { byFieldId, byName, textByFieldId, textByName };
}

// ── What a Clio write REFUSED, said out loud without saying what it refused ───
//
// SHELDON-INTAKE-CREATE-PATH-422. The contact PATCH logged its status and nothing
// else — `contact enrichment not applied: HTTP 422` — and a bare 422 cannot answer
// the only question that matters when the enrichment is built correctly and still
// rejected: WHICH FIELD did Clio refuse. The two live candidates produce the same
// line. A `custom_field_values` rejection means the rows are in the wrong FORM (a
// create-form row for a value the contact already carries). An `addresses` or a
// `state`/`province` rejection means a VALUE Clio will not take, which is a
// different defect with a different fix. Elroy flagged that the live evidence
// changed two variables at once — channel AND contact reuse — so the next 422 has
// to name its own cause instead of leaving the two hypotheses tied.
//
// AND THE BODY IS THE ONE THING ON THIS PATH THAT MAY NOT BE LOGGED. Clio's
// validation errors echo the offending record back, and the offending record is the
// client's finances: `income_band` and `net_worth_band` are on every row of that
// PATCH. So this reads the body and emits, from it, ONLY:
//
//   · FIELD NAMES, and only names drawn from the CLOSED vocabulary below. A key
//     that is not in the vocabulary is COUNTED, never printed — so a body that put
//     a client's answer in a key position still cannot spell it into the stream.
//   · ERROR MESSAGES that survive three independent filters (see safeMessage).
//     Anything that does not survive is counted as redacted, so the operator can
//     see that Clio said something without this line saying what.
//
// A leak here would be worse than the blindness it fixes, so every rule is
// deny-by-default: the emitter has an allow-list, not a block-list.

/**
 * Keys this line is permitted to NAME. Every field we can send plus the structural
 * keys a Clio error envelope is built from — nothing else.
 *
 * Built from CLIO_FIELDS so a body key we send is automatically nameable and cannot
 * drift out of this list, and extended with the error-shape keys and the two
 * spellings of a US state, because "Clio refused `province`" is precisely the
 * answer that ends this investigation the other way.
 */
const FAILURE_VOCAB = new Set([
  ...Object.values(CLIO_FIELDS).filter((v) => typeof v === "string"),
  "data", "error", "errors", "message", "messages", "code", "status", "reason",
  "base", "details", "detail", "field", "fields", "field_name", "field_type",
  "id", "type", "name", "value", "values", "state", "province", "country",
  "attributes", "record", "resource", "title", "source", "pointer",
]);

/**
 * Keys whose string leaf is DATA, not diagnosis. Never eligible to be a message,
 * whatever it looks like — `value` is the band itself, `name` is a label, `detail`
 * is the whole intake note.
 */
const FAILURE_VALUE_KEYS = new Set([
  "value", "values", "address", "number", "detail", "subject", "name",
  "first_name", "last_name", "province", "country", "state", "email", "phone",
]);

/** Bounds on the walk. An error body is small; a hostile one must not be walked far. */
const FAILURE_MAX_DEPTH = 6;
const FAILURE_MAX_NODES = 400;
const FAILURE_MAX_NAMES = 12;
const FAILURE_MAX_MESSAGES = 3;

/**
 * Every string this booking SENT on the request that failed, so none of them can
 * come back out through the response. Walks the body object we serialised — not a
 * hand-kept list, because a hand-kept list is the thing that goes stale the first
 * time a field is added to the PATCH.
 */
function sentStrings(body, out = new Set(), depth = 0) {
  if (depth > FAILURE_MAX_DEPTH || out.size > 200) return out;
  if (typeof body === "string") {
    const s = body.trim();
    if (s.length >= 2) out.add(s.toLowerCase());
    return out;
  }
  if (Array.isArray(body)) {
    for (const v of body) sentStrings(v, out, depth + 1);
    return out;
  }
  if (body && typeof body === "object") {
    for (const v of Object.values(body)) sentStrings(v, out, depth + 1);
  }
  return out;
}

/**
 * Admit a message, or refuse it. THREE FILTERS, EACH SUFFICIENT ON ITS OWN.
 *
 *   1. Its key is not a data-bearing one (checked by the caller).
 *   2. Its SHAPE is a validation sentence: letters and light punctuation only. No
 *      digit, no `$`, no `@`, no `—`. Every band, every phone number, every email
 *      and every currency figure fails this outright.
 *   3. It does not contain — case-insensitively — anything we SENT. That is what
 *      catches the values with no digit in them at all: a matter category, a state,
 *      a client's name.
 *
 * Filter 2 alone would pass "Real estate is invalid"; filter 3 alone would pass a
 * band this booking did not send but the contact already carried. Together they
 * leave a Clio validation message and nothing else.
 */
function safeMessage(text, sent) {
  const s = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!s || s.length > 80) return null;
  if (!/^[A-Za-z][A-Za-z ,.'()/:_-]*$/.test(s)) return null;
  const lower = s.toLowerCase();
  for (const v of sent) if (lower.includes(v)) return null;
  return s;
}

/**
 * Read a failed Clio write's body and describe it in names and messages only.
 *
 * EXPORTED FOR THE LEAK TEST. The one assertion that matters here — "a 422 body
 * carrying the client's bands produces a log line carrying none of them" — is about
 * this function's output, and driving it only through a booking would leave the
 * value-bearing body shapes unreachable. Production callers are updateContact and
 * writeIntakeNote; both hand it the body they sent.
 *
 * @param {string} bodyText  the raw response body — NEVER logged, only parsed.
 * @param {object} sentBody  the request body this call serialised, for filter 3.
 * @returns {string} a space-separated diagnostic, safe to print verbatim.
 */
export function describeClioFailure(bodyText, sentBody) {
  const raw = String(bodyText ?? "").trim();
  if (!raw) return "clio_body=empty";

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    // The bytes are not printed. An unreadable body is its own fact and that is all.
    return "clio_body=unparseable";
  }

  const sent = sentStrings(sentBody);
  const names = new Set();
  const messages = [];
  let unnamed = 0;
  let redacted = 0;
  let nodes = 0;

  const walk = (node, key, depth) => {
    if (nodes++ > FAILURE_MAX_NODES || depth > FAILURE_MAX_DEPTH) return;
    if (Array.isArray(node)) {
      for (const v of node) walk(v, key, depth + 1);
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        // A dotted key ("addresses.province") names its parts or it names nothing.
        const parts = String(k).split(".").filter(Boolean);
        if (parts.length && parts.every((p) => FAILURE_VOCAB.has(p))) {
          if (names.size < FAILURE_MAX_NAMES) names.add(String(k));
        } else {
          unnamed += 1;
        }
        walk(v, String(k), depth + 1);
      }
      return;
    }
    if (typeof node !== "string") return;
    const base = String(key ?? "").split(".").pop();
    if (FAILURE_VALUE_KEYS.has(base)) return;   // data, by position. Not read at all.
    // DENY BY DEFAULT ON THE KEY TOO. A string under a key this module does not
    // recognise has no established meaning, and "unknown meaning" is not a licence
    // to print it: the body could carry another booking's answer under a key we have
    // never seen, which filter 3 cannot catch because WE did not send it. Counted,
    // never printed.
    if (!FAILURE_VOCAB.has(base)) { redacted += 1; return; }
    const ok = safeMessage(node, sent);
    if (ok == null) { redacted += 1; return; }
    if (messages.length < FAILURE_MAX_MESSAGES && !messages.includes(ok)) messages.push(ok);
  };

  walk(parsed, null, 0);

  return [
    `clio_fields=${names.size ? [...names].join(",") : "none"}`,
    unnamed ? `clio_unnamed_keys=${unnamed}` : "",
    `clio_messages=${messages.length ? messages.join(" | ") : "none"}`,
    redacted ? `clio_redacted=${redacted}` : "",
  ].filter(Boolean).join(" ");
}

/**
 * Read a failed response's body without ever letting the read itself become a
 * failure. A body that cannot be read is described as such and nothing throws.
 */
async function failureDetail(res, sentBody) {
  try {
    return describeClioFailure(await res.text(), sentBody);
  } catch (_) {
    return "clio_body=unreadable";
  }
}

/**
 * Resolve the intake custom-field ids, never fatally.
 *
 * Wrapped here rather than inside the resolver so that a transport-level throw —
 * an unrefreshable token, a DNS failure — costs the custom fields and nothing else.
 * The contact still writes, and the same answers are still legible on the intake
 * Note.
 *
 * THE TRANSPORT IS READ-ONLY, and that is structural rather than a convention:
 * clio-custom-fields.js cannot create a field definition because the object it is
 * handed has no way to send anything but a GET.
 */
/**
 * The read-only transport handed to modules that enumerate a Clio list.
 *
 * `path.startsWith("http")` IS THE PASSTHROUGH ZANE'S REVIEW NAMED, and it is still
 * here on purpose: a paging cursor is an absolute URL, so a walk following one has to
 * be able to hand this an absolute URL. What changed is that the passthrough is no
 * longer the last word on where the request goes — clioFetch asserts the origin at
 * the sink, so an absolute path arriving here from ANY source, cursor or otherwise,
 * is refused before the firm's token is attached to it.
 *
 * EXPORTED SO THE SINK CAN BE PROVEN ON THIS PATH. Every URL this transport carries
 * today has already been through nextPageUrl, which means a test driving it through
 * the booking route can only ever exercise the CALL-SITE check — the two would be
 * indistinguishable. Handing this object an off-origin absolute path directly is the
 * third walk, written by hand, and it is the one thing that tells the two checks
 * apart. Production behaviour is unchanged: intakeFieldIds is still the only caller.
 *
 * @param {object} cfg
 * @param {object} env
 * @returns {{ get:(path:string)=>Promise<Response> }} GET only. There is no `post`
 *          member because clio-custom-fields.js must not be able to create a field.
 */
export function clioReadApi(cfg, env) {
  return {
    get: (path) => clioFetch(
      path.startsWith("http") ? path : `${CLIO_BASE}${path}`,
      { method: "GET" }, cfg, env,
    ),
  };
}

async function intakeFieldIds(cfg, env, intakeFields) {
  // ── DIAGNOSTIC ONLY (#154 task 4) ──────────────────────────────────────────
  // Four different silent paths end in "zero custom fields on the contact", and
  // until now they all arrived at the SAME log line — `enrichment not applied` —
  // or at no line at all. That is why the live zero-fields symptom could not be
  // root-caused from production logs: the message could not tell an empty intake
  // apart from an unresolvable field list apart from an empty diff. These warns
  // separate them. NOTHING about the write changes; this function returns exactly
  // what it returned before on every branch.
  //
  // FIELD NAMES AND COUNTS ONLY, NEVER A VALUE. The values are the client's
  // finances (income_band, net_worth_band), and a diagnostic that prints them is
  // a leak wearing a diagnostic's clothes.
  // PATH 2 ASKS ABOUT THE CLIENT'S ANSWERS, NOT ABOUT THE MAP'S SIZE — AND IT HAD TO
  // BE REWORDED TO GO ON MEANING THAT.
  // SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE. This branch used to fire on "the map
  // is empty", and the map is now non-empty on EVERY booking because the consult type
  // is always in it. Left as a size test, path 2 would simply have STOPPED FIRING on
  // the exact bookings it was cut for — the #154 line that tells "the client answered
  // nothing" apart from "the answers could not be resolved" would have gone quiet, and
  // a detector that has been unhooked reads in production exactly like a defect that
  // has been fixed.
  //
  // So the question it asks is now the question it always meant: did the CLIENT tell
  // us anything. That is a fact about the qualifier and is unchanged by a
  // booking-level field sitting beside it. Same sentence, deliberately — it is the
  // same operational fact and the log line that names it should not move — with a
  // tail that stops claiming zero fields on a booking that will write one. Names and
  // counts only, and the only name is a key of ours; never a value.
  const selfReported = Object.keys(intakeFields ?? {}).filter((k) => k !== CONSULT_TYPE_KEY);
  const nothingAtAll = !intakeFields || Object.keys(intakeFields).length === 0;
  if (selfReported.length === 0) {
    console.warn(
      "[clio] intake field ids not resolved: no intake answers to resolve — "
      + (nothingAtAll
        ? "zero custom fields will be written"
        : `only ${CONSULT_TYPE_KEY} will be written`),
    );
  }
  // Nothing whatsoever to resolve — no qualifier AND no typeId. Unreachable from
  // createBooking, which cannot be called without a typeId; kept because this
  // function's contract is about the map it is handed, not about its one caller.
  if (nothingAtAll) return {};
  try {
    const api = clioReadApi(cfg, env);
    const { ids } = await resolveIntakeFieldIds(api, env);
    return ids;
  } catch (_) {
    // Path 3: the resolver threw and this catch swallowed it whole. The booking
    // still succeeds by design (see the header) — but it succeeded silently, and a
    // firm reading its logs had no way to know the custom-field lookup was the leg
    // that failed. Names of the fields we WANTED, so the loss is nameable; the
    // error itself is not logged because clio-custom-fields.js errors can quote the
    // response body.
    console.warn(`[clio] intake field ids not resolved: error — zero custom fields will be written wanted=${Object.keys(intakeFields).join(",")}`);
    return {};
  }
}

/**
 * Find an existing Clio contact by email, or create one if not found, and in EITHER
 * case populate it with everything intake collected.
 *
 * SHELDON-CLIO-CONTACT-MAPPING. The contact used to be created bare — a name split
 * and an email — because its only job was to exist so the calendar entry had
 * someone to attach as an attendee. The firm's requirement is the opposite: this is
 * the lawyer-only CRM record, so it should carry the whole picture. Standard fields
 * (first/last name, email, phone, address province from the qualifier's state) plus
 * the seven intake answers as custom_field_values, bands included.
 *
 * THE UPDATE PATH IS NOT AN AFTERTHOUGHT. A returning client matches on email and
 * takes the found branch, and before this change that branch wrote NOTHING — the
 * second booking's intake vanished and the contact kept whatever the first booking
 * left. It now PATCHes, additively: name and phone and address fill gaps rather
 * than overwrite (a client who corrected their number in Clio keeps the correction,
 * and the new number is appended, not substituted), while the intake answers are
 * updated in place because the point of them is to be CURRENT.
 *
 * THE CREATE CARRIES IDENTITY ONLY, AND THE ENRICHMENT FOLLOWS ON THE PATCH.
 * This is the R2 review's first blocker and the reason both branches now end in the
 * same call. The seven custom_field_values and the address used to ride on the very
 * POST that MINTS the contact, so a single optional field Clio disliked — a
 * custom-field id deleted in settings, an address shape it rejected, a value too
 * long — failed the create, findOrCreateContact returned null, and the booking went
 * on to write a calendar entry with NO attendee and NO send_email_notification and
 * NO intake note, while still answering 201. The client silently loses their
 * confirmation email: precisely the regression SHELDON-CLIO-CONFIRM-EMAIL was cut
 * to close, re-entered through the optional half of a body.
 *
 * So the POST now sends what a contact cannot exist without — type, name, email,
 * phone — and everything optional goes through updateContact, which is best-effort
 * by contract and whose worst outcome is a warn. There is no longer any field on
 * this path whose rejection can cost the client their email.
 *
 * Returns the Clio contact id or null (non-fatal — booking proceeds without link).
 *
 * @param {object} cfg
 * @param {object} env
 * @param {{ name:string, email:string, phone:string }} contact
 * @param {{ fields?:Record<string,string>, state?:string }} [intake]
 *        The qualifier answers, ALREADY rendered to the plain-English labels the
 *        lawyer reads (fn/qualifier_submit.js owns that table). Absent for an
 *        ordinary web booking with no Perch call, in which case the contact is
 *        still populated from the form — just without the custom fields.
 * @param {string} [typeId]
 *        The appointment type this booking is FOR, straight off the request that
 *        createBooking was called with. Threaded here rather than derived, because
 *        the contact write is the only place that needs it and it is the one piece
 *        of booking-level data every booking on every channel carries.
 * @returns {Promise<string|number|null>}
 */
async function findOrCreateContact(cfg, env, contact, intake, typeId) {
  if (!contact?.email) return null;

  // THE CLIENT'S ANSWERS AND THE BOOKING'S OWN FACT, MERGED ONCE, HERE.
  // SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE. `intake.fields` has already been
  // through intake-policy.js, whose allow-list is the SEVEN self-reported keys and
  // nothing else — so a stored qualifier record cannot carry `consult_type` no
  // matter what was written into it, and the spread order below is belt to that
  // structural brace rather than the guarantee itself. The consult type can only
  // come from this booking's own typeId.
  const selfReported = intake?.fields ?? {};
  const consultType = consultTypeValue(cfg, typeId);
  const intakeFields = consultType
    ? { ...selfReported, [CONSULT_TYPE_KEY]: consultType }
    : selfReported;
  const addresses = buildAddresses(intake?.state);

  const search = await searchContactByEmail(cfg, env, contact.email);
  if (!search.conclusive) {
    // FAIL CLOSED. Clio never told us whether it holds this client, so we do not
    // get to decide that it does not. Taking the no-contact path costs this ONE
    // booking its attendee, its confirmation email and its intake note — all of
    // which the next booking restores — where creating would cost the firm a second
    // Person record that nothing here can find again or merge.
    //
    // Its own message, distinct from every other warn on this path, so it is
    // alertable: this is the line that means "Clio was unreachable during a booking",
    // not "the enrichment did not apply".
    console.warn("[clio] contact search inconclusive — no contact linked this booking, no duplicate created");
    return null;
  }
  const found = search.contact;

  const ids = await intakeFieldIds(cfg, env, intakeFields);

  const { firstName, lastName } = splitName(contact.name);

  if (found?.id) {
    // `search.enriched` is the whole licence for the Website write on this branch:
    // it is true only when the record in hand came off the selection that actually
    // asked for `web_sites`. See searchContactByEmail.
    await enrich(cfg, env, found, contact, {
      addresses, intakeFields, ids, webSitesReadable: search.enriched,
    });
    return found.id;
  }

  // ── SHELDON-154-CLIO-DEDUP — THE EMAIL IS NOT THE PERSON ────────────────────
  //
  // Clio answered and holds nobody on this ADDRESS. That is the whole of what has
  // been established, and it is not the same fact as "Clio does not hold this
  // client" — which is the fact the create below actually needs. A client who booked
  // once from a personal address and once from work is a returning client to whom
  // this code has, until now, said "new". Three David Pierce records, and the test
  // bookings behind this ticket, are that gap.
  //
  // So the second identifier the booking form always collects gets asked about before
  // a second record is minted. Only on THIS branch — the one that creates.
  const byPhone = await searchContactByPhone(cfg, env, contact.phone);

  if (!byPhone.conclusive) {
    // FAIL CLOSED, by the rule the email leg above already follows and for the same
    // arithmetic: this booking loses its attendee, its confirmation email and its
    // intake note, all of which the next booking restores, where creating on a
    // question Clio never answered risks the one thing nothing in this file can undo.
    //
    // Its own message. "The email search could not reach Clio" and "the phone search
    // could not" are different operational facts about different requests, and an
    // operator reading one line has to be able to tell which happened.
    console.warn("[clio] contact phone search inconclusive — no contact linked this booking, no duplicate created");
    return null;
  }

  if (byPhone.matches.length > 1) {
    // A NUMBER TWO PEOPLE ANSWER IS NOT AN IDENTITY. A household line, an office
    // switchboard, a couple sharing a mobile — Clio holds several Persons on it, and
    // nothing here can say which of them is booking. Guessing is worse than the
    // duplicate this ticket exists to stop: it files one client's intake answers onto
    // another client's contact record, at a law firm.
    //
    // So the phone is DISCARDED as a key and a new contact is created, which is both
    // the honest answer (this may genuinely be a new person in the same household)
    // and exactly today's behaviour. Counted, never named — the number is the client's.
    console.warn(`[clio] phone matches ${byPhone.matches.length} contacts — ambiguous, not used as an identity`);
  } else if (byPhone.matches.length === 1) {
    const [byPhoneMatch] = byPhone.matches;
    // Worth a line of its own in the log: the firm's record for this client is about
    // to gain a second email address, and that is a thing the operator should be able
    // to see happening without opening Clio. Names nothing — no address, no number.
    console.warn("[clio] contact matched on phone, not email — reusing the existing contact");
    await enrich(cfg, env, byPhoneMatch, contact, {
      // Same licence rule as the email branch: the Website write is permitted only
      // when the record in hand came off the rung that actually asked for `web_sites`.
      addresses, intakeFields, ids, webSitesReadable: byPhone.enriched,
    });
    return byPhoneMatch.id;
  }

  // Not found — create a new contact. IDENTITY ONLY: who this person is and how to
  // reach them, and nothing whose rejection could cost us the id. See the header.
  const contactBody = {
    data: {
      [CLIO_FIELDS.CONTACT_BODY_TYPE]: "Person",
      // Empty name fields are OMITTED, never sent as "". A single-token name has no
      // first name (see splitName) and `first_name: ""` would be us asserting the
      // client has none rather than that the form never split one out.
      ...(firstName ? { [CLIO_FIELDS.CONTACT_BODY_FIRST_NAME]: firstName } : {}),
      ...(lastName ? { [CLIO_FIELDS.CONTACT_BODY_LAST_NAME]: lastName } : {}),
      [CLIO_FIELDS.CONTACT_BODY_EMAIL]: [
        // The EMAIL label enum is ["Work","Home","Other"] — its own list, not a
        // house style. Phone and address have different ones (see the contract
        // notes at the top of this file).
        { [CLIO_FIELDS.CONTACT_EMAIL_ADDRESS_FIELD]: contact.email, name: "Work", default_email: true },
      ],
      ...(contact.phone ? {
        [CLIO_FIELDS.CONTACT_BODY_PHONE]: [
          {
            [CLIO_FIELDS.CONTACT_PHONE_NUMBER_FIELD]: contact.phone,
            name: "Mobile",
            default_number: true,
          },
        ],
      } : {}),
    },
  };

  const createRes = await clioFetch(`${CLIO_BASE}/contacts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(contactBody), // NEVER log — contains PII
  }, cfg, env);

  if (!createRes.ok) {
    // Non-fatal: proceed without a linked contact.
    return null;
  }

  let createData;
  try {
    createData = await createRes.json();
  } catch (_) {
    return null;
  }
  const newId = createData?.data?.id ?? null;
  if (newId == null) return null;

  // THE CUSTOM FIELDS COME FROM THE RECORD, THE REST FROM THE BODY WE SENT.
  //
  // The shim below is still built from what we just sent for name, phone and
  // address, and that is still right: those are the fields whose diff we can compute
  // exactly from our own request, and they were correct before this ticket — name
  // and phone are on the record and skip, the address is new and goes.
  //
  // The custom fields are the one member that could NOT be derived that way, because
  // the create body deliberately carries none of them and the contact Clio just
  // minted carries a default row for each. A literal `[]` there was an assertion
  // about the record rather than a description of the request, and it was false. See
  // readContactAfterCreate. Null (any failure) keeps the old empty array, so this
  // widens the create path's knowledge and narrows nothing.
  const created = await readContactAfterCreate(cfg, env, newId);
  const createdRows = created?.[CLIO_FIELDS.CONTACT_BODY_CUSTOM_FIELDS];
  // The websites belong to the same "read the record, do not describe the request"
  // rule the custom fields established one line above. We sent no `web_sites` on the
  // create body, so a literal `[]` here would even be TRUE today — and it would be
  // true by luck, asserted rather than observed, which is the precise shape the
  // create-path 422 was. `webSitesReadable` below is what carries the difference:
  // when the re-read failed, `created` is null and the Website write is declined
  // instead of being licensed by a shim we wrote ourselves.
  const createdSites = created?.[CLIO_FIELDS.CONTACT_BODY_WEB_SITES];

  await enrich(cfg, env, {
    id: newId,
    [CLIO_FIELDS.CONTACT_BODY_FIRST_NAME]: firstName,
    [CLIO_FIELDS.CONTACT_BODY_LAST_NAME]: lastName,
    [CLIO_FIELDS.CONTACT_BODY_PHONE]: contact.phone
      ? [{ [CLIO_FIELDS.CONTACT_PHONE_NUMBER_FIELD]: contact.phone }]
      : [],
    [CLIO_FIELDS.CONTACT_BODY_ADDRESSES]: [],
    [CLIO_FIELDS.CONTACT_BODY_CUSTOM_FIELDS]: Array.isArray(createdRows) ? createdRows : [],
    [CLIO_FIELDS.CONTACT_BODY_WEB_SITES]: Array.isArray(createdSites) ? createdSites : [],
  }, contact, { addresses, intakeFields, ids, webSitesReadable: created != null });

  return newId;
}

/**
 * updateContact, wrapped so it cannot throw past the contact id.
 *
 * updateContact already resolves rather than throws on every HTTP outcome, but the
 * whole point of the create/enrich split is that NOTHING in the optional half may
 * reach findOrCreateContact's caller as an exception: createBooking catches a throw
 * from here by setting clioContactId to null, which drops the attendee, the
 * confirmation email and the intake note — the same loss the split exists to
 * prevent, arriving through a different door. One try/catch closes both doors.
 */
async function enrich(cfg, env, record, contact, detail) {
  try {
    return await updateContact(cfg, env, record, contact, detail);
  } catch (_) {
    console.warn("[clio] contact enrichment not applied: error");
    return { ok: false, skipped: "error" };
  }
}

/**
 * PATCH a contact with anything this booking adds.
 *
 * BOTH BRANCHES END HERE, and that is the shape of the R2 fix. A contact Clio
 * already held arrives as the record the search returned; a contact we just minted
 * arrives as a shim describing what the create body carried. Either way this is the
 * ONLY call that sends `addresses` and `custom_field_values`, so the whole optional
 * half of the intake sits behind one best-effort request instead of riding on the
 * POST that has to succeed for the client to get their confirmation email.
 *
 * ADDITIVE, AND SILENT WHEN THERE IS NOTHING TO SAY. Every branch below asks
 * "does the contact already have this?" before sending it, and an empty diff skips
 * the request entirely rather than issuing a PATCH whose body is `{data:{}}`. That
 * matters beyond tidiness: this runs on the path to a calendar write, so a
 * no-op subrequest is latency spent on the client's booking.
 *
 * BEST EFFORT, NEVER FATAL — same contract as writeIntakeNote. The contact id is
 * already resolved by the time this runs, so the attendee, the confirmation email
 * and the intake Note all survive a failure here; only the enrichment is lost.
 */
async function updateContact(cfg, env, found, contact, {
  addresses, intakeFields, ids, webSitesReadable = false,
}) {
  const data = {};

  // Name: fill only. An existing contact may have been corrected by hand in Clio,
  // and a booking form's single name field is a weaker source than that.
  //
  // AND A GUESSED SURNAME IS NEVER WRITTEN HERE AT ALL. When the form gave one
  // token, splitName puts it in `lastName` because that is the least-wrong place for
  // it on a NEW contact — but on an EXISTING one it would be this booking overwriting
  // a blank surname with a word we do not know to be a surname, on a record the firm
  // may have curated. The create path can afford the guess (there is no prior
  // information to lose); the update path cannot. This is the second route the
  // "(unknown)" defect had, and closing the placeholder without closing this would
  // have left it open.
  const { firstName, lastName, single } = splitName(contact.name);
  if (!String(found?.[CLIO_FIELDS.CONTACT_BODY_FIRST_NAME] ?? "").trim() && firstName) {
    data[CLIO_FIELDS.CONTACT_BODY_FIRST_NAME] = firstName;
  }
  if (!single && !String(found?.[CLIO_FIELDS.CONTACT_BODY_LAST_NAME] ?? "").trim() && lastName) {
    data[CLIO_FIELDS.CONTACT_BODY_LAST_NAME] = lastName;
  }

  // Phone: append when this number is genuinely new. Compared on digits, so a
  // re-formatted copy of the same number is not appended a second time.
  const existingPhones = Array.isArray(found?.[CLIO_FIELDS.CONTACT_BODY_PHONE])
    ? found[CLIO_FIELDS.CONTACT_BODY_PHONE]
    : [];
  const newPhoneKey = phoneKey(contact?.phone);
  if (newPhoneKey && !existingPhones.some(
    (p) => phoneKey(p?.[CLIO_FIELDS.CONTACT_PHONE_NUMBER_FIELD]) === newPhoneKey,
  )) {
    data[CLIO_FIELDS.CONTACT_BODY_PHONE] = [{
      [CLIO_FIELDS.CONTACT_PHONE_NUMBER_FIELD]: contact.phone,
      name: "Mobile",
      // Only claim the default slot when there is nothing to displace.
      ...(existingPhones.length ? {} : { default_number: true }),
    }];
  }

  // Address: append only when the contact has no address carrying this province
  // (or, for the outside-the-U.S. case, this country).
  const existingAddresses = Array.isArray(found?.[CLIO_FIELDS.CONTACT_BODY_ADDRESSES])
    ? found[CLIO_FIELDS.CONTACT_BODY_ADDRESSES]
    : [];
  const wanted = addresses[0];
  if (wanted) {
    const already = existingAddresses.some((a) =>
      (wanted[CLIO_FIELDS.CONTACT_ADDRESS_PROVINCE] &&
        String(a?.[CLIO_FIELDS.CONTACT_ADDRESS_PROVINCE] ?? "").toUpperCase()
          === wanted[CLIO_FIELDS.CONTACT_ADDRESS_PROVINCE]) ||
      (wanted[CLIO_FIELDS.CONTACT_ADDRESS_COUNTRY] &&
        String(a?.[CLIO_FIELDS.CONTACT_ADDRESS_COUNTRY] ?? "")
          === wanted[CLIO_FIELDS.CONTACT_ADDRESS_COUNTRY])
    );
    if (!already) data[CLIO_FIELDS.CONTACT_BODY_ADDRESSES] = addresses;
  }

  // ── Website: the firm's own site, and ONLY onto a contact that has none ──────
  //
  // SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE. Every booking that reaches this
  // adapter arrived through POST /booking/create — donovan.law's own booking widget.
  // Paula's voice path does not book by a second route; it drives that same widget
  // (fn/do_page_action.js `book_consult` navigates to /book.html). There is no other
  // door into createBooking in this repo, which is what makes "website-sourced" true
  // by construction here rather than a channel guess. `WEBSITE_SOURCED` is the one
  // line that changes on the day a booking channel exists that is NOT the website.
  //
  // TWO GATES, AND THEY REFUSE FOR DIFFERENT REASONS.
  //
  //   webSitesReadable  — did we actually READ this contact's websites? False on a
  //     minimal-selection search fallback and on a create whose re-read failed. An
  //     unread field is not an empty one, and this is the gate that keeps "only when
  //     empty" from decaying into "whenever we could not see" the moment the
  //     enriched selection is refused.
  //   the emptiness test — does the contact carry a website TODAY? A client who
  //     typed their own URL into Clio, or whom Paul entered by hand, keeps it. This
  //     write can only ever add the firm's site to a blank field; it cannot replace,
  //     and (per contract rule 1, no `_destroy`) it cannot delete.
  //
  // A row with a blank `address` is not a website — Clio materialises empty rows the
  // same way it does for custom fields — so the test is on the VALUE, not on the row
  // count. Counting rows would make an account that shows an empty Website field
  // look permanently occupied and the write would never fire.
  if (WEBSITE_SOURCED && webSitesReadable) {
    const existingSites = Array.isArray(found?.[CLIO_FIELDS.CONTACT_BODY_WEB_SITES])
      ? found[CLIO_FIELDS.CONTACT_BODY_WEB_SITES]
      : [];
    const hasWebsite = existingSites.some(
      (w) => String(w?.[CLIO_FIELDS.CONTACT_WEB_SITE_ADDRESS] ?? "").trim() !== "",
    );
    if (!hasWebsite) {
      data[CLIO_FIELDS.CONTACT_BODY_WEB_SITES] = [{
        [CLIO_FIELDS.CONTACT_WEB_SITE_ADDRESS]: FIRM_WEBSITE,
        name: WEB_SITE_LABEL,
        // Claim the default slot only when there is nothing to displace — the same
        // rule the phone branch above applies, for the same reason.
        ...(existingSites.length ? {} : { [CLIO_FIELDS.CONTACT_WEB_SITE_DEFAULT]: true }),
      }];
    }
  }

  // Intake answers: updated in place, not appended — see buildCustomFieldValues.
  //
  // AND THE MATTER SET IS WRITTEN WHOLE OR NOT AT ALL. `matterClearKeys` is the only
  // thing that licenses a clear, and it licenses one only when this booking named a
  // matter category. That is what stops a second booking's `Other` from inheriting
  // the first booking's `Ownership` — see buildCustomFieldValues' empty branch. The
  // post-call writer passes no such licence and is unchanged.
  const customFieldValues = buildCustomFieldValues(
    intakeFields, ids, existingValueIndex(found), INTAKE_NAME_BY_KEY, matterClearKeys(intakeFields),
  );
  if (customFieldValues.length) {
    data[CLIO_FIELDS.CONTACT_BODY_CUSTOM_FIELDS] = customFieldValues;
  }

  if (Object.keys(data).length === 0) {
    // Path 4 (#154 task 4). An empty diff means NO PATCH IS SENT AT ALL, which is
    // correct behaviour and was completely invisible: the enrichment simply did not
    // happen and nothing said so. The built count is the load-bearing half — a
    // no_change with seven values built is a genuinely up-to-date contact, a
    // no_change with ZERO is the zero-fields symptom arriving through this door
    // rather than through intakeFieldIds, and the two were indistinguishable.
    // A COUNT, not the rows: the rows carry the answers.
    console.warn(`[clio] contact enrichment skipped: no_change custom_field_values_built=${customFieldValues.length}`);
    return { ok: true, skipped: "no_change" };
  }

  try {
    const res = await clioFetch(`${CLIO_BASE}/contacts/${found.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }), // NEVER log — contains PII and the bands
    }, cfg, env);
    if (!res.ok) {
      // THE BODY IS READ, AND STILL NEVER PRINTED. `HTTP 422` alone could not tell
      // a rejected FORM from a rejected VALUE, which is the whole of the create-path
      // question; describeClioFailure names the field Clio refused and emits nothing
      // that came off the wire as data. See the block above it.
      console.warn(
        `[clio] contact enrichment not applied: HTTP ${res.status} `
        + `${await failureDetail(res, { data })}`,
      );
      return { ok: false, status: res.status };
    }
    return { ok: true, status: res.status };
  } catch (_) {
    console.warn("[clio] contact enrichment not applied: error");
    return { ok: false, skipped: "error" };
  }
}

/**
 * Write the four Retell post-call analysis fields onto a contact a booking already
 * resolved. DRINSANE-RETELL-POSTCALL-WEBHOOK-R2 · issue #122.
 *
 * WHY THIS LIVES HERE AND NOT IN THE WEBHOOK. The correct PATCH form is not
 * "custom_field_values"; it is "custom_field_values, each row carrying the value id
 * this contact already holds for that field, resolved by NAME because the live grant
 * cannot attribute a row by id" — five paragraphs of hard-won contract spread across
 * existingValueIndex, buildCustomFieldValues and CONTACT_SEARCH_FIELDS_ENRICHED, all
 * of them module-private. A second writer in another file would have to restate that
 * contract, and a restated contract is one that drifts: the create path drifted from
 * the reuse path by exactly this much and the difference was a live 422 on every
 * freshly created contact. So the post-call write is a caller of the SAME index and
 * the SAME builder, not a copy of their conclusions.
 *
 * IT WRITES NOTHING ELSE. The body carries `custom_field_values` and no other key —
 * no name, no phone, no address, no `web_sites`. A post-call analysis is not evidence
 * about a client's identity and must not be allowed to edit it.
 *
 * THE READ IS MANDATORY, WHICH IS THE ONE PLACE THIS DIVERGES FROM THE BOOKING PATH.
 * findOrCreateContact tolerates a failed re-read and sends create-form rows, because
 * a client is waiting on a confirmation email and a rejected enrichment costs less
 * than a lost booking. Nothing is waiting on this write. So a contact we could not
 * read is a contact we do not write to: create-form rows onto the materialised rows a
 * booking has already filled is the 422, and earning it here would also risk a SECOND
 * value row under the same field name on a live client record, which is the outcome
 * buildCustomFieldValues' whole update-in-place design exists to prevent.
 *
 * NEVER FATAL, AND NEVER LOUD ABOUT A VALUE. Every failure returns a shape, logs
 * names and counts, and lets the webhook answer 2xx — a retried post-call delivery
 * that re-writes the same values in place is a no-op by construction, so failing
 * closed here would buy nothing and cost the vendor's retry budget.
 *
 * @param {object} cfg
 * @param {object} env
 * @param {string|number} contactId  resolved from `callmap:<call_id>`, never from
 *                                   the webhook envelope, which is PII-scrubbed.
 * @param {Record<string,string>} fields  keyed by POSTCALL_CUSTOM_FIELDS.key, already
 *                                   through selectPostCallFields' policy.
 * @returns {Promise<{ok:boolean, status?:number, skipped?:string, written?:number}>}
 */
export async function writePostCallFields(cfg, env, contactId, fields) {
  if (contactId == null || contactId === "") return { ok: false, skipped: "no_contact" };

  // KEY NAMES ONLY, everywhere in this function. The values are a summary of the
  // caller's legal matter and a judgement about them as a person.
  const wantedKeys = Object.keys(fields ?? {});
  if (!wantedKeys.length) {
    console.warn("[postcall] no fields to write — the analysis produced none");
    return { ok: true, skipped: "no_fields" };
  }

  let ids;
  try {
    ids = (await resolveIntakeFieldIds(clioReadApi(cfg, env), env, POSTCALL_CUSTOM_FIELDS)).ids;
  } catch (_) {
    // The resolver's own errors can quote a response body, so the error is not logged.
    console.warn(`[postcall] field ids not resolved: error — nothing written wanted=${wantedKeys.join(",")}`);
    return { ok: false, skipped: "ids_unresolved" };
  }
  if (!Object.keys(ids).length) {
    // The expected state until the four fields exist in Clio settings under exactly
    // the names in POSTCALL_CUSTOM_FIELDS. Named, not silent, because "David has not
    // made the fields yet" and "the account walk failed" produce the same empty write.
    console.warn(`[postcall] no post-call field ids on the account — nothing written wanted=${wantedKeys.join(",")}`);
    return { ok: false, skipped: "ids_unresolved" };
  }

  const record = await readContactAfterCreate(cfg, env, contactId, POSTCALL_READ_LOG);
  if (!record) return { ok: false, skipped: "contact_not_read" };

  // NO CLEAR LICENCE, DELIBERATELY — the fifth argument is omitted so this writer
  // keeps the blanket skip-on-empty that SHELDON-INTAKE-FIELD-MERGE-POLICY replaced
  // on the BOOKING path only. These four are one analysis of one call: there is no
  // matter context here to reason from, and an analysis that produced no sentiment is
  // not evidence that the caller's sentiment changed. `selectPostCallFields` has
  // already dropped the keys Retell said nothing about, so an absent key here means
  // "not analysed", never "answered empty".
  const values = buildCustomFieldValues(fields, ids, existingValueIndex(record), POSTCALL_NAME_BY_KEY);
  if (!values.length) {
    console.warn(`[postcall] nothing to apply: no_change wanted=${wantedKeys.join(",")} resolved=${Object.keys(ids).length}`);
    return { ok: true, skipped: "no_change" };
  }

  const data = { [CLIO_FIELDS.CONTACT_BODY_CUSTOM_FIELDS]: values };
  try {
    const res = await clioFetch(`${CLIO_BASE}/contacts/${contactId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data }), // NEVER log — carries the summary and the sentiment
    }, cfg, env);
    if (!res.ok) {
      // The body is READ and still never printed: a Clio validation error echoes the
      // offending record, and the offending record here is the caller's matter in
      // prose. describeClioFailure names fields from a closed vocabulary and counts
      // everything else. Same emitter the booking PATCH uses.
      console.warn(
        `[postcall] fields not applied: HTTP ${res.status} `
        + `${await failureDetail(res, { data })}`,
      );
      return { ok: false, status: res.status };
    }
    console.log(`[postcall] fields applied count=${values.length} names=${wantedKeys.join(",")}`);
    return { ok: true, status: res.status, written: values.length };
  } catch (_) {
    console.warn(`[postcall] fields not applied: error wanted=${wantedKeys.join(",")}`);
    return { ok: false, skipped: "error" };
  }
}

/**
 * Build the calendar entry `description`.
 *
 * THIS TEXT IS EMAILED TO THE CLIENT. Clio renders the entry description verbatim
 * into the attendee's confirmation email and into the .ics body, so the
 * description is a CLIENT-FACING surface, not an internal note field. Before
 * SHELDON-CLIO-CONFIRM-EMAIL it carried `enrichedNotes` — the caller's typed text
 * PLUS the Perch qualifier block, which includes the income and net-worth bands.
 * Nothing sent that email, so nothing leaked; attaching an attendee turns the
 * same description into an outbound message. Attendee-attach and this split are
 * therefore ONE change and must never be separated — the attendee path plus a
 * description carrying enrichedNotes IS the leak.
 *
 * The signature is the guard. This function takes NO caller-supplied text: not
 * notes, not the qualifier summary, not contact PII, not even `typeId` (the
 * appointment NAME is resolved from the configured allow-list, and an unmatched
 * id falls back to a fixed string). Every argument is a value the firm configured.
 * There is consequently no parameter through which a band string could arrive,
 * which is what makes the "no bands in the description" claim grep-provable
 * rather than a promise about call sites.
 *
 * The attorney-side detail lives on a Note attached to the Clio contact — see
 * writeIntakeNote — and continues to reach Grow, Vantage and the KV booking
 * record exactly as before.
 *
 * @param {{ typeName:string, meetingLink:string, firmPhone:string, firmEmail:string }} p
 * @returns {string}
 */
export function buildClientDescription({ typeName, meetingLink, firmPhone, firmEmail }) {
  const what = `${typeName || "Consultation"} with Donovan Legal PLLC.`;

  const reschedule = firmPhone && firmEmail
    ? `Need to reschedule or cancel? Call ${firmPhone} or email ${firmEmail}.`
    : firmPhone
      ? `Need to reschedule or cancel? Call ${firmPhone}.`
      : firmEmail
        ? `Need to reschedule or cancel? Email ${firmEmail}.`
        : "Need to reschedule or cancel? Please contact the firm.";

  return [
    what,
    // Omitted rather than faked when unconfigured: a broken join link in a client's
    // confirmation email is worse than no link at all.
    meetingLink ? `Join the meeting: ${meetingLink}` : "",
    "",
    reschedule,
  ].filter((line, i, all) => line !== "" || (i > 0 && all[i - 1] !== "")).join("\n");
}

/**
 * Write the intake summary to a Note ON THE CONTACT.
 *
 * This is the attorney-side half of the description split. Everything the firm
 * needs to qualify the matter — the caller's typed notes, their phone and email,
 * and the Perch qualifier block WITH the income and net-worth bands — lands here,
 * on a record only the firm can read, instead of in the calendar entry Clio emails
 * to the client.
 *
 * BEST EFFORT, NEVER FATAL. The appointment is already confirmed by the time this
 * runs. A notes failure must not turn a booked consultation into a 502, so every
 * path here resolves rather than throws, exactly like the Grow and Vantage pushes
 * in create.js. When it cannot write, the summary is still in the Grow lead, the
 * Vantage lead and the KV booking record — this is an extra copy, not the only one.
 *
 * Requires a contact id, so it is live only when the CLIO_CREATE_CONTACT flag is
 * on (the same flag that produces the attendee). Flag off ⇒ no attendee, no
 * confirmation email, and no note — and the description is client-safe either way.
 *
 * @param {object} cfg
 * @param {object} env
 * @param {string|number} contactId
 * @param {{ contact:{name?:string,email?:string,phone?:string}, notes?:string, intakeSummary?:string, typeName?:string, slotISO?:string }} p
 * @returns {Promise<{ok:boolean, skipped?:string, status?:number}>}
 */
async function writeIntakeNote(cfg, env, contactId, { contact, notes, intakeSummary, typeName, slotISO }) {
  if (contactId == null || contactId === "") return { ok: false, skipped: "no_contact" };

  const detail = [
    typeName ? `Appointment: ${typeName}` : "",
    slotISO ? `Requested slot: ${slotISO}` : "",
    contact?.phone ? `Phone: ${contact.phone}` : "",
    contact?.email ? `Email: ${contact.email}` : "",
    notes ? `\nClient notes:\n${notes}` : "",
    intakeSummary ? `\n${intakeSummary}` : "",
  ].filter(Boolean).join("\n");

  if (!detail) return { ok: false, skipped: "empty" };

  return await postContactNote(cfg, env, contactId, {
    subject: "Booking intake — website",
    detail,
    label: "intake note",
  });
}

/**
 * POST one Contact-typed note to Clio Manage.
 *
 * Extracted from writeIntakeNote UNCHANGED in behaviour, so the booking path and
 * the contact-inquiry path cannot drift into two different ideas of how a note is
 * posted, what may be logged about a rejected one, or which failures are silent.
 * `label` names the note in the warn — an operator reading "note not written" has
 * to be able to tell a lost booking intake from a lost website inquiry.
 *
 * NEVER logs the body. The detail is the most value-dense thing this module sends
 * (a client's contact details, their description of their matter, and on the
 * booking path their qualification bands); describeClioFailure is the only reader
 * allowed near it.
 *
 * @returns {Promise<{ok:boolean, status?:number, skipped?:string}>}
 */
async function postContactNote(cfg, env, contactId, { subject, detail, label }) {
  const noteBody = {
    data: {
      [CLIO_FIELDS.NOTE_BODY_SUBJECT]: subject,
      [CLIO_FIELDS.NOTE_BODY_DETAIL]:  detail,
      [CLIO_FIELDS.NOTE_BODY_TYPE]:    "Contact",
      [CLIO_FIELDS.NOTE_BODY_CONTACT]: { id: contactId },
    },
  };

  try {
    const res = await clioFetch(`${CLIO_BASE}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(noteBody), // NEVER log — carries PII and the qualification bands
    }, cfg, env);
    if (res.ok) return { ok: true, status: res.status };
    // THE NOTE WRITE USED TO FAIL IN COMPLETE SILENCE — it returned its status to a
    // caller that only records it, so a rejected note left no line at all. It gets
    // the same treatment as the enrichment PATCH and for the same reason: the note
    // carries the FULL intake detail, so its body is the most value-dense thing this
    // module sends, and describeClioFailure is the only reader allowed near it.
    console.warn(
      `[clio] ${label} not written: HTTP ${res.status} `
      + `${await failureDetail(res, noteBody)}`,
    );
    return { ok: false, status: res.status };
  } catch (_) {
    return { ok: false, skipped: "error" };
  }
}

/**
 * Is the Manage contact path switched on?
 *
 * David owns the value; this only reads the flag. Accepts the usual truthy
 * spellings rather than the literal "1" alone — a dashboard value of `true` is
 * exactly the sort of near-miss that silently disables the confirmation email and
 * looks identical to the bug this ticket fixes.
 */
function contactPathEnabled(env) {
  const v = String(env?.CLIO_CREATE_CONTACT ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

// ── Exported adapter methods ───────────────────────────────────────────────────
//
// Each method accepts (cfg, params, env) where env is context.env threaded from
// the route handler.  The env argument is appended so the existing
// listAppointmentTypes(cfg) two-arg signature still works — env is optional there
// because it doesn't need secrets.

/**
 * Return the configured appointment types.
 * Clio Manage has no native "appointment types" API — list lives in cfg.
 *
 * @param {object} cfg
 * @returns {Promise<Array<{id:string, name:string, duration_min:number}>>}
 */
export async function listAppointmentTypes(cfg) {
  const types = Array.isArray(cfg?.appointment_types) && cfg.appointment_types.length
    ? cfg.appointment_types
    : [{ id: "consult", name: "Initial Consultation", duration_min: cfg?.slot_min ?? 60 }];

  return types.map((t) => ({
    id: String(t.id ?? "unknown"),
    name: String(t.name ?? "Appointment"),
    duration_min: Number(t.duration_min ?? 60),
  }));
}

/**
 * Fetch open slots by computing availability minus Clio calendar busy blocks.
 *
 * @param {object} cfg
 * @param {{ typeId:string, fromISO:string, toISO:string, tz:string }} params
 * @param {object} env  - context.env (required; resolves Clio secrets)
 * @returns {Promise<Array<{startISO:string, endISO:string}>>}
 */
export async function getAvailability(cfg, { typeId, fromISO, toISO, tz }, env) {
  const windowCfg = {
    tz: tz || cfg?.tz || "America/New_York",
    business_days: cfg?.business_days ?? [1, 2, 3, 4, 5],
    start_hour: cfg?.start_hour ?? 9,
    end_hour: cfg?.end_hour ?? 17,
    slot_min: cfg?.slot_min ?? 60,
    buffer_min: cfg?.buffer_min ?? 0,
    days_ahead: cfg?.days_ahead ?? 14,
  };

  if (typeId) {
    const types = await listAppointmentTypes(cfg);
    const match = types.find((t) => t.id === typeId);
    if (match) windowCfg.slot_min = match.duration_min;
  }

  const fromMs = Date.parse(fromISO);
  const toMs = Date.parse(toISO);
  if (isNaN(fromMs) || isNaN(toMs) || fromMs >= toMs) return [];

  const busyBlocks = await fetchBusyBlocks(cfg, env, fromISO, toISO);
  return computeAvailability(windowCfg, busyBlocks, fromMs, toMs);
}

/**
 * Create a booking in Clio: find/create Contact, create the CalendarEntry with the
 * contact ATTACHED AS AN ATTENDEE so Clio sends the confirmation email and the
 * .ics, then file the intake summary as a Note on that contact.
 *
 * `notes` (the caller's typed text) and `intakeSummary` (the Perch qualifier
 * block, which carries income_band and net_worth_band) arrive SEPARATELY and both
 * go to the contact note. Neither is passed to buildClientDescription — that
 * function has no parameter that could accept them.
 *
 * The meeting is DYNAMIC by default (SHELDON-CLIO-DYNAMIC-ZOOM): the entry asks
 * Clio to mint a unique Zoom meeting per booking and to fill `location` itself.
 * A configured BOOKING_MEETING_LINK switches to a static room instead. Exactly one
 * of the two ships on any create body; see the entryBody comments below.
 *
 * @param {object} cfg
 * `intake` is the THIRD member of that family and the newest: the same qualifier
 * answers as `intakeSummary`, but structured, so they can be written onto the
 * contact as custom_field_values instead of only as prose. It is subject to exactly
 * the same rule — it reaches findOrCreateContact and writeIntakeNote, and it is not
 * in buildClientDescription's parameter list.
 *
 * @param {{ typeId:string, slotISO:string, contact:{name:string,email:string,phone:string}, notes?:string, intakeSummary?:string, intake?:{fields?:Record<string,string>, state?:string} }} params
 * @param {object} env  - context.env
 * `contact_id` is the resolved Clio contact, or "" when there is none. See the
 * return statement for why it is now reported.
 *
 * @returns {Promise<{booking_id:string, confirmed:boolean, provider_ref:string, contact_id:string}>}
 */
export async function createBooking(cfg, { typeId, slotISO, contact, notes, intakeSummary, intake }, env) {
  const slotMs = Date.parse(slotISO);
  if (isNaN(slotMs)) throw new Error("clio: invalid slotISO");

  const slotMin = cfg?.slot_min ?? 60;
  const endMs = slotMs + slotMin * 60_000;

  // The Manage contact is now LOAD-BEARING, not CRM tidiness. It was gated off
  // with a comment saying leads flow to Clio Grow so Manage need not be cluttered,
  // and that reasoning is stale: the contact id is what attaches the ATTENDEE, and
  // the attendee is what makes Clio send the client their confirmation email and
  // calendar invite. It is also the record the intake note hangs off. With the flag
  // off there is no attendee, no confirmation email and no note — today's
  // behaviour, minus the leak. David owns the flag value; nothing here sets it.
  //
  // Still non-fatal: a contact lookup that fails books the appointment anyway,
  // silently losing the email rather than the consultation.
  let clioContactId = null;
  if (contactPathEnabled(env)) {
    try {
      // `typeId` travels to the contact write and NOWHERE ELSE that is new. It is
      // the appointment the client booked — firm configuration, not client data —
      // and it lands on the lawyer-only contact as `Intake Consult Type`. It still
      // does not reach buildClientDescription, which has no parameter for it.
      clioContactId = await findOrCreateContact(cfg, env, contact, intake, typeId);
    } catch (_) {
      // Don't let contact lookup block the booking.
    }
  }

  // One lookup, shared with the consult-type field so the confirmation email and the
  // CRM record can never name two different appointments for one booking. The
  // FALLBACKS still differ and deliberately so — see consultTypeValue.
  const matchedType = matchAppointmentType(cfg, typeId);
  const typeName = matchedType?.name ?? "Consultation";
  const meetingLink = String(cfg?.meeting_link ?? "").trim();

  // DYNAMIC IS THE DEFAULT. An empty meeting_link is no longer "no link" — it is
  // "let Clio mint one", a unique Zoom meeting per booking instead of one room
  // every client of the firm shares. A configured BOOKING_MEETING_LINK is now an
  // explicit choice of a static room, and the escape hatch for the two cases
  // conference_meeting silently returns null on: an ineligible Clio pricing tier,
  // or no Zoom connected to the account (see CE_BODY_CONFERENCE).
  const dynamicMeeting = meetingLink === "";

  const summary = [contact?.name, typeId].filter(Boolean).join(" — ");

  // CLIENT-FACING. See buildClientDescription: no caller text, no PII, no bands.
  //
  // In dynamic mode meetingLink is "", so the description carries no join line —
  // correct rather than a gap, because the URL does not EXIST until Clio answers
  // this POST, and the invite and .ics Clio sends the attendee carry it anyway.
  // Passing a link we do not have could only mean faking one. The parameter list
  // is unchanged either way: this function still has no parameter that could
  // accept the caller's notes or the qualifier bands.
  const description = buildClientDescription({
    typeName,
    meetingLink,
    firmPhone: cfg?.firm_phone ?? "",
    firmEmail: cfg?.firm_email ?? "",
  });

  const entryBody = {
    data: { // VERIFIED: Clio v4 POST body wraps in { data: … }
      [CLIO_FIELDS.CE_BODY_SUMMARY]:  summary,
      [CLIO_FIELDS.CE_BODY_START_AT]: new Date(slotMs).toISOString(),
      [CLIO_FIELDS.CE_BODY_END_AT]:   new Date(endMs).toISOString(),
      // VERIFIED: calendar is referenced via calendar_owner:{ id }, not calendar_id.
      [CLIO_FIELDS.CE_BODY_CALENDAR_OWNER]: { id: cfg?.calendar_id },
      [CLIO_FIELDS.CE_BODY_DESCRIPTION]: description,
      // EXACTLY ONE meeting source ships on a body, never both.
      //
      //   dynamic (default) — conference_meeting only. Clio writes `location`
      //     itself, with its own video_conferences wrapper URL. Pre-filling a
      //     static `location` here would be us overwriting the field Clio needs
      //     to hand the client the meeting it just minted.
      //   static (BOOKING_MEETING_LINK set) — `location` only. The firm chose a
      //     permanent room, so no meeting is minted and nothing is left to null.
      ...(dynamicMeeting
        ? { [CLIO_FIELDS.CE_BODY_CONFERENCE]: { type: CLIO_FIELDS.CE_CONFERENCE_TYPE } }
        : { [CLIO_FIELDS.CE_BODY_LOCATION]: meetingLink }),
      // The fix. `contact_id` used to sit here: it is NOT a field on the create
      // body, so Clio discarded it, no attendee ever attached, and no confirmation
      // email was ever sent. attendees + send_email_notification is the shape the
      // live probe confirmed actually dispatches (see CLIO_FIELDS above).
      //
      // ── BOTH SIDES ARE INVITED, AND THE FIRM SIDE IS NOT OPTIONAL ────────────
      // The array carried the CLIENT only. Everything downstream followed from
      // that single omission: Clio emails attendees, the firm was not one, so the
      // booking produced a confirmation for the prospect and silence for the firm.
      // The entry still landed on the firm calendar — calendar_owner put it there —
      // but an entry written onto a calendar notifies nobody and, not being an
      // invitation, gives Outlook nothing to act on either.
      //
      // Attaching the calendar as an attendee is what makes the firm an INVITEE
      // rather than merely the owner of the surface the row was written to. It
      // needs no new configuration: the id is `cfg.calendar_id`, already required
      // and already validated, so this cannot introduce a second thing to keep in
      // sync with the first.
      //
      // Guarded on `cfg?.calendar_id` for symmetry with `clioContactId`, not
      // because it can plausibly be missing — resolveBookingConfig fails closed
      // long before this line if it is. An attendee entry with `id: undefined`
      // would be silently discarded by v4 exactly the way `contact_id` was, which
      // is the specific failure this whole block exists to remember.
      ...(clioContactId ? {
        [CLIO_FIELDS.CE_BODY_ATTENDEES]: [
          { id: clioContactId, type: CLIO_FIELDS.CE_ATTENDEE_TYPE },
          ...(cfg?.calendar_id
            ? [{ id: cfg.calendar_id, type: CLIO_FIELDS.CE_ATTENDEE_TYPE_CAL }]
            : []),
        ],
        [CLIO_FIELDS.CE_BODY_SEND_EMAIL]: true,
      } : {}),
    },
  };

  // NEVER log entryBody — carries the client's name.
  const res = await clioFetch(`${CLIO_BASE}/calendar_entries`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(entryBody),
  }, cfg, env);

  if (!res.ok) {
    throw new Error(`clio: POST /calendar_entries failed — HTTP ${res.status}`);
  }

  // READ-BACK IS DELIBERATELY NARROW: the entry id, nothing else. In dynamic mode
  // the response `location` comes back as a Clio video_conferences wrapper URL
  // carrying a per-meeting token, and `conference_meeting` carries join_url,
  // conference_id and conference_password. None of it is parsed, validated,
  // returned to the widget or written to KV, so a wrapper URL is tolerated by
  // construction rather than by a rule that could drift — and there is nothing to
  // shape-check against, since the same field is a plain string in static mode and
  // the whole object is null on an ineligible tier.
  //
  // NOTHING BELOW MAY LOG IT. A join URL is a bearer capability: anyone holding it
  // is in the client's consultation. The only log on this path is the note-outcome
  // warn further down, which prints a status and never a body.
  //
  // AND THIS IS THE ONE READ IN THE FILE WHERE FAILING CLOSED WOULD BE THE BUG.
  // Everything above this line runs BEFORE a write and refuses when it cannot see;
  // this runs AFTER one. Clio has already answered 2xx, so the appointment EXISTS on
  // the attorney's calendar and the client's invite is already going out. An
  // unreadable body here used to throw out of createBooking, create.js caught it and
  // answered 502, and the widget told the client their booking failed — for an
  // appointment that had in fact been made. The client rebooks, and the firm gets
  // the double booking this entire ticket exists to prevent, produced by being
  // strict in the one place strictness has no undo.
  //
  // So the read-back is best-effort by the same logic as writeIntakeNote: the worst
  // outcome is a booking whose provider_ref is "unknown", which is a record-keeping
  // loss, not a calendar one. Nothing below may log the body — see above.
  let data = null;
  try {
    data = await res.json();
  } catch (_) {
    // ONE OF TWO WAYS TO LOSE THE REF, and it gets its own words. "Clio sent bytes
    // that are not JSON" is a transport/proxy fact; "Clio sent JSON with no id in
    // it" below is a contract fact, and they are not diagnosed the same way.
    console.warn("[clio] calendar entry created but the response body was not JSON");
  }
  const entryId = data?.data?.id ?? null;

  // THE WARN BELONGS ON THE OUTCOME, NOT ON ONE CAUSE OF IT. It used to sit inside
  // the catch above, so the case that actually reaches an operator — a clean 201
  // whose parsed body carries no entry id — emitted NOTHING, and the booking was
  // reported to the client as confirmed with `provider_ref: "unknown"` and no line
  // anywhere saying the reference had been lost. A 2xx with no readable id is the
  // same loss whichever way the body failed us, so it warns either way; when the
  // body was unparseable both lines fire, and the pair says cause AND consequence.
  //
  // Status/outcome only. The body carries the client's name and, in dynamic mode, a
  // join URL that is a bearer capability — see above. Neither reaches a log.
  if (entryId == null) {
    console.warn("[clio] calendar entry created but no entry id was readable — provider_ref lost");
  }

  // Attorney-side half of the split. After the entry, and never fatal to it.
  const note = await writeIntakeNote(cfg, env, clioContactId, {
    contact, notes, intakeSummary, typeName, slotISO,
  });
  if (!note.ok) {
    // Outcome only — the detail is the thing that must not reach a log.
    console.warn(`[clio] intake note not filed: ${note.skipped ?? `HTTP ${note.status}`}`);
  }

  return {
    booking_id: "",       // route layer fills this after KV write
    confirmed: true,      // VERIFIED: Clio calendar entries are immediately confirmed
    provider_ref: entryId != null ? String(entryId) : "unknown",
    // THE ID THAT NEVER LEFT THIS FUNCTION (SHELDON-CALLMAP-AND-CALLID, task 1).
    //
    // `clioContactId` is resolved above, used for the attendee, used for the note,
    // and then dropped on the floor — so post-call enrichment, which starts from a
    // call and has to arrive at a Clio contact, had nothing to arrive at. The route
    // layer builds the call → contact index from this (see create.js `callmap:`);
    // it is returned, not written here, because THIS file has no idea whether the
    // booking came from a voice call.
    //
    // "" — not null, not absent — when the contact path is off (`contactPathEnabled`
    // false) or the lookup threw into the non-fatal catch above. That is the same
    // spelling `provider_ref` uses for "we made the booking and lost the reference",
    // and it is what the route layer's guard tests: a booking with no contact writes
    // no index entry rather than a half of one.
    //
    // Nothing else about the write changed. The entry body, the attendee, the note
    // and every refusal above are byte-identical; this is a read of a value the
    // function already held.
    contact_id: clioContactId != null && clioContactId !== "" ? String(clioContactId) : "",
  };
}

// ── SHELDON-CONTACT-ROUTE (#214): the website inquiry, as a Manage record ─────
//
// The "Send an Initial Inquiry" form on /contact posted to a third-party form app
// (Formspree) that does not deliver. This is the Clio Manage half of its
// replacement: the person who wrote in becomes — or is recognised as — a Contact,
// and what they wrote becomes a Note on that contact.
//
// IT REUSES findOrCreateContact RATHER THAN MINTING ITS OWN CREATE, and that is the
// whole point of routing it through this module. That function carries the
// SHELDON-154 dedup — email first, then PHONE on the branch that would otherwise
// create — and both of its fail-closed refusals: a search Clio never answered
// yields NO contact instead of a second record for a client the firm already has.
// A hand-rolled POST /contacts on the inquiry path would have been a third door
// into the duplicate problem #154 exists to close, on the highest-volume channel.
//
// WHAT IT DOES NOT DO. No intake answers and no consult type — a website inquiry
// has neither, so `intake` and `typeId` are null and buildCustomFieldValues is
// handed an empty map. `NO_CLEARS` is the default there, so nothing an existing
// client answered on a previous booking is cleared by writing in through the form.
// The name/phone/address/website enrichment is fill-only and unchanged.
//
// THE `WEBSITE_SOURCED` CLAIM STILL HOLDS with a second caller. It asserts the
// contact reached this adapter from donovan.law, and the contact form is on
// donovan.law — see updateContact.
//
// NEVER LOGS THE INQUIRY. `detail` carries the writer's name, email, phone and
// their description of their legal matter. Every line below prints a status, an
// outcome or a field NAME, and nothing else.
//
// @param {object} cfg
// @param {{contact: {name:string, email:string, phone:string},
//          inquiry: {referral:string, matterType:string, urgency:string,
//                    description:string}}} params
// @param {object} env
// @returns {Promise<{ok:boolean, contact_id:string, note:object, reason?:string}>}
export async function createContactInquiry(cfg, { contact, inquiry }, env) {
  let contactId = null;
  try {
    // intake=null, typeId=null — see above. Both are load-bearing omissions, not
    // parameters nobody got round to threading.
    contactId = await findOrCreateContact(cfg, env, contact, null, null);
  } catch (e) {
    // DEFENSIVE, AND SAID PLAINLY BECAUSE THE OBVIOUS READING IS WRONG. An
    // unconfigured credential does NOT arrive here: getAccessToken throws, but
    // clioFetch turns that into a failed search, so an environment missing its Clio
    // secrets takes the fail-closed `!conclusive` branch inside findOrCreateContact
    // and returns null with its own warn. What this catch is for is anything that
    // escapes that function unexpectedly — the same posture createBooking takes,
    // for the same reason: the inquiry has already been delivered to Grow, and a
    // throw out of the RECORD leg must not become a failed submission.
    //
    // Message only — resolveSecret never puts a secret in the Error, and nothing
    // here prints the inquiry.
    console.warn(`[clio] contact inquiry: contact not resolved — ${String(e?.message ?? e)}`);
    return { ok: false, contact_id: "", note: { ok: false, skipped: "no_contact" }, reason: "contact_error" };
  }

  if (contactId == null || contactId === "") {
    // findOrCreateContact already warned WHICH refusal this was (search inconclusive,
    // phone search inconclusive, or a rejected create). Do not restate it — say what
    // it costs, which is the fact this caller owns.
    return { ok: false, contact_id: "", note: { ok: false, skipped: "no_contact" }, reason: "no_contact" };
  }

  const detail = [
    inquiry?.matterType ? `Nature of matter: ${inquiry.matterType}` : "",
    inquiry?.urgency    ? `Timing: ${inquiry.urgency}` : "",
    inquiry?.referral   ? `Heard about the firm: ${inquiry.referral}` : "",
    contact?.phone      ? `Phone: ${contact.phone}` : "",
    contact?.email      ? `Email: ${contact.email}` : "",
    inquiry?.description ? `\nDescription of the matter:\n${inquiry.description}` : "",
  ].filter(Boolean).join("\n");

  const note = await postContactNote(cfg, env, contactId, {
    subject: "Website inquiry — contact form",
    detail,
    label: "contact inquiry note",
  });

  // THE NOTE IS THE RECORD, so its failure is the leg's failure — unlike the booking
  // path, where a lost note still leaves an appointment on the calendar. Here a
  // contact with no note is a name with no inquiry attached to it.
  if (!note.ok) {
    console.warn(`[clio] contact inquiry note not filed: ${note.skipped ?? `HTTP ${note.status}`}`);
  }

  return {
    ok: note.ok,
    contact_id: String(contactId),
    note,
    ...(note.ok ? {} : { reason: "note_failed" }),
  };
}
