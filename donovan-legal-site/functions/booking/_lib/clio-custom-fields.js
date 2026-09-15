// ── Clio Contact custom fields — name → id resolution ─────────────────────────
//
// SHELDON-CLIO-CONTACT-MAPPING. The intake answers the firm qualifies on
// (matter, bands, language, source) have to land on the Clio CONTACT as
// structured fields, not only as prose in a Note, so the lawyer can read them at
// a glance and Clio can filter on them. Clio models that as CustomFieldValue
// entries on the contact, and each one addresses its CustomField BY ID:
//
//   custom_field_values: [ { value: "$1.5M–$3M", custom_field: { id: 12345 } } ]
//
// There is no by-name form. Ids are per-firm and are NOT knowable at build time,
// so this module is the one place that turns the stable field NAMES below into
// whatever ids this particular Clio account happens to use.
//
// ── THIS MODULE READS. IT DOES NOT CREATE. ───────────────────────────────────
// R2. There is no code path from here to POST /custom_fields, deliberately and
// permanently. A CustomField is SCHEMA, not data: it appears on every contact form
// in the firm's account, and its `field_type` cannot be changed once set — the
// PATCH body has no such property at all:
//
//   paths["/custom_fields/{id}.json"].patch.requestBody
//     .content["application/json"].schema.properties.data.properties
//     = { display_order, displayed, name, picklist_options, required }
//
// So a definition minted with the wrong type is permanent, and nothing in the API
// distinguishes "created the field" from "created a SECOND field with the same
// name" — POST /custom_fields answers 201 either way and the duplicate is invisible
// from here. David is creating the Intake fields by hand in Clio settings, where he
// can see what he is adding to the firm's account. This module's whole job is to
// find what he made.
//
// Resolution is therefore two sources, and a name that neither answers is simply
// SKIPPED — the contact writes without it:
//
//   1. CLIO_INTAKE_FIELD_IDS — ids handed over by the firm. Authoritative.
//   2. the name lookup — GET /custom_fields, admitted on field_type.
//
// A TRUNCATED WALK IS A FAILED WALK. The page loop is bounded, and running out of
// pages is not the same as reaching the end of the account: a name absent from the
// pages we managed to read is not absent from the account. The loop reports that
// honestly rather than letting a partial enumeration masquerade as a complete one.
//
// AND A WALK ONLY FOLLOWS CURSORS THAT STAY ON CLIO. SHELDON-BOOKING-ORIGIN — the
// page loop follows a URL out of a RESPONSE BODY, and the transport it follows it
// with carries the firm's Clio bearer token. See listContactFields; the admission
// test is nextPageUrl in clio-paging.js and it is the same one the calendar walk in
// provider-clio.js uses.
//
// CACHED PER ISOLATE, like the OAuth token cache in provider-clio.js. Resolution
// costs one GET on the first booking an isolate serves and nothing after it. Ids are
// stable for the life of the field, so a stale cache entry can only be wrong if
// someone DELETES a custom field in Clio settings, which surfaces as a rejected
// value on the contact PATCH — non-fatal there, and cleared by the next isolate.
//
// NOTHING HERE MAY FAIL A BOOKING. The appointment is the product; a CRM field is
// not. Every failure path resolves to "fewer ids than asked for", the contact PATCH
// simply carries fewer custom_field_values, and the same answers remain readable in
// the intake Note (provider-clio.js writeIntakeNote) which does not depend on this
// module at all. That Note is why degrading silently here is acceptable: the data is
// never lost, only its structured copy.
//
// NEVER LOGS A VALUE. Field NAMES are firm configuration and safe to log; the
// values bound to them are the client's finances. Only names and counts appear in
// the warn lines below.

import { nextPageUrl } from "./clio-paging.js";

// ── WHAT AN ANSWER IS ABOUT — the field class ────────────────────────────────
//
// SHELDON-INTAKE-FIELD-MERGE-POLICY. A contact's custom fields are a CURRENT-STATE
// surface: there is one row per field and the lawyer reads whatever it holds now.
// The intake note is the opposite — append-only, one verbatim block per session —
// and it is correct as it stands. This column exists only for the current-state
// surface, and it answers ONE question: when a returning client books again and
// supplies FEWER answers than last time, which of the fields they did not repeat
// may keep standing?
//
// Answering that per field rather than globally is the whole point, because the two
// classes fail in opposite directions:
//
//   MATTER — what THIS ENGAGEMENT is about: the category, its sub-type, who it is
//     for, and which consultation was booked. These are a SET, and they are only
//     true together. A second booking about a different matter that carries a
//     sub-type from the first produces a contact no single session ever produced:
//     the live blend was `Matter Category: Other` beside `Sub-Type: Ownership`,
//     which is impossible because Other has no sub-types. Keeping a matter-scoped
//     answer past its matter is not conservative, it is a fabrication.
//
//   PERSON — what is true of the CLIENT, not of any one matter: their income band,
//     net worth band, language, and how they found the firm. A booking that does not
//     re-ask "what language do you speak" is not evidence that the answer changed.
//     Clearing these on every short booking would delete standing facts about a
//     client because a later form was shorter, which is the opposite failure.
//
// The four post-call fields are NEITHER, and they are deliberately not classified
// here: they are Retell's analysis, written by their own writer on their own path,
// and this policy does not reach them. See POSTCALL_CUSTOM_FIELDS.
export const FIELD_SCOPE = Object.freeze({
  MATTER: "matter",
  PERSON: "person",
});

/**
 * The intake answers that ride on the contact, in display order.
 *
 * `key`  — the qualifier field name as fn/qualifier_submit.js cleans it.
 * `name` — the CustomField name in Clio. THE CONTRACT WITH THE FIRM'S ACCOUNT:
 *          these are the names David creates in Clio settings, and resolution finds
 *          them by exactly this spelling.
 * `type` — the `field_type` this entry EXPECTS to find, declared per field rather
 *          than assumed globally. A row whose type does not match its own
 *          expectation is refused, never bound (see listContactFields).
 * `scope` — WHAT THE ANSWER IS ABOUT, which decides whether a later booking that
 *          does not repeat it may leave it standing. See FIELD_SCOPE.
 *
 * Every entry is `text_line` today, and the column exists anyway. Two reasons it is
 * not a single module-level constant: the type is immutable once the field is made,
 * so the expectation is a property OF THE FIELD rather than of this module; and the
 * moment one of these should legitimately be a `date` or a `numeric`, a global
 * constant is the thing that would have to be loosened for all seven at once.
 *
 * text_line for the seven on purpose: a picklist would have to enumerate every band
 * and matter option here, and a qualifier that later gains an option would then
 * write a value Clio REJECTS. A text line accepts whatever the qualifier's own
 * LABELS table renders, so the two can drift without dropping data.
 *
 * Valid types are the enum at
 *   paths["/custom_fields.json"].post.requestBody
 *     .content["application/json"].schema.properties.data.properties.field_type.enum
 *   = [checkbox, contact, currency, date, time, email, matter, numeric, picklist,
 *      text_area, text_line, url]
 *
 * Deliberately NOT a superset of the qualifier. The Perch card collects more than
 * this (citizenship, classification, tier, strategy path, the legacy tax block);
 * those stay in the Note. This list is what the firm asked to be able to READ and
 * FILTER on, and every entry added here is one more field on every contact, so the
 * list grows by decision, not by default.
 */
export const INTAKE_CUSTOM_FIELDS = [
  { key: "matter_category", name: "Intake Matter Category", type: "text_line", scope: FIELD_SCOPE.MATTER },
  { key: "matter_sub",      name: "Intake Matter Sub-Type",  type: "text_line", scope: FIELD_SCOPE.MATTER },
  { key: "for_whom",        name: "Intake For Whom",         type: "text_line", scope: FIELD_SCOPE.MATTER },
  { key: "income_band",     name: "Intake Income Band",      type: "text_line", scope: FIELD_SCOPE.PERSON },
  { key: "net_worth_band",  name: "Intake Net Worth Band",   type: "text_line", scope: FIELD_SCOPE.PERSON },
  { key: "language",        name: "Intake Language",         type: "text_line", scope: FIELD_SCOPE.PERSON },
  { key: "source",          name: "Intake Source",           type: "text_line", scope: FIELD_SCOPE.PERSON },
];

/**
 * The answers that ride on the contact and DID NOT come from the client.
 *
 * SHELDON-BOOKING-WRITE-CONSULT-AND-WEBSITE. `Intake Consult Type` is the
 * appointment the booking is FOR. It is a separate list from the seven above, and
 * the separation is load-bearing rather than tidy:
 *
 *   intake-policy.js derives SELF_REPORTED_KEYS from INTAKE_CUSTOM_FIELDS —
 *     `SELF_REPORTED_KEYS = INTAKE_CUSTOM_FIELDS.map((f) => f.key)`
 *
 * so a key added to that list becomes a key the WRITE POLICY will admit off a stored
 * qualifier record. The seven belong there because the client said them out loud. A
 * consult type is not something a client self-reports; it is what the booking
 * REQUEST carries, and admitting it to the policy would mean a qualifier record
 * could supply one — precisely the post-call characterisation #153 built that policy
 * to refuse. Keeping the lists apart means the value can only ever arrive from the
 * booking's own `typeId`, which is the only source that is true by construction.
 *
 * Everything else about it is identical to the seven, deliberately: same module,
 * same `text_line` expectation, same by-name resolution, same type admission, same
 * "not found ⇒ skipped, never created". See CONTACT_CUSTOM_FIELDS.
 *
 * The `key` column here is the intake-map key provider-clio.js writes under, not a
 * qualifier field name — the seven above are both at once, this one is only the
 * former.
 */
export const BOOKING_CUSTOM_FIELDS = [
  { key: "consult_type", name: "Intake Consult Type", type: "text_line", scope: FIELD_SCOPE.MATTER },
];

/**
 * The four POST-CALL fields, which are Retell's analysis of the call rather than
 * anything the caller typed or said verbatim.
 *
 * A SEPARATE LIST, NOT AN EIGHTH THROUGH ELEVENTH ENTRY ABOVE, and the separation is
 * load-bearing rather than tidy. `intake-policy.js` does
 *
 *     export const SELF_REPORTED_KEYS = Object.freeze(INTAKE_CUSTOM_FIELDS.map((f) => f.key));
 *
 * so appending here would not merely declare four fields — it would make `urgency`,
 * `interest`, `user_sentiment` and `call_summary` ADMISSIBLE OFF A STORED QUALIFIER
 * RECORD, one `.map()` away in a different file. That is precisely the machine
 * characterisation intake-policy.js exists to refuse, arriving through the
 * declaration list instead of through the write. The seven stay the seven; the
 * policy's allow-list is unchanged by anything in this block.
 *
 * WRITTEN ONLY BY THE POST-CALL WEBHOOK, on a contact a booking already resolved —
 * never on the booking path, which does not have these values and must not invent
 * them. See functions/webhooks/retell-postcall.js.
 *
 * BACK-OFFICE ONLY. Nothing here may reach a client-facing surface: the calendar
 * entry description, the confirmation email and the .ics body are composed by
 * buildClientDescription, which takes no parameter through which one of these could
 * arrive.
 *
 * `Intake Call Summary` is a `text_area` because it is prose measured in sentences;
 * a `text_line` would be the wrong shape for it in Clio's own UI. The other three
 * are short labels. A field whose type on the account does not match its entry here
 * is REFUSED, not bound — see listContactFields — so these types are a contract with
 * what David creates in Clio settings, not a preference.
 */
export const POSTCALL_CUSTOM_FIELDS = [
  { key: "urgency",        name: "Intake Urgency",        type: "text_line" },
  { key: "interest",       name: "Intake Interest",       type: "text_line" },
  { key: "user_sentiment", name: "Intake Call Sentiment", type: "text_line" },
  { key: "call_summary",   name: "Intake Call Summary",   type: "text_area" },
];

/**
 * Every Contact CustomField this integration knows how to bind — THREE lists, one
 * union: the seven the client self-reports, the booking-level ones the firm's own
 * request carries, and the four the post-call analysis produces.
 *
 * ONE UNION, RESOLVED ONCE. Everything below this line walks THIS list rather than
 * any one third, so a field added to any of them automatically gets the id seed, the
 * name lookup, the field_type admission test and the not-found warn without a second
 * code path being written for it.
 *
 * THE RESOLVER WALKS THIS; THE POLICY DERIVES FROM `INTAKE_CUSTOM_FIELDS` ALONE.
 * That split is the whole point, and it is the only reason the thirds stay apart:
 * one enumeration of the account serves every writer without the booking-level or
 * post-call names widening what a stored qualifier record may supply. See
 * BOOKING_CUSTOM_FIELDS and POSTCALL_CUSTOM_FIELDS for why each is its own list.
 */
export const CONTACT_CUSTOM_FIELDS = [
  ...INTAKE_CUSTOM_FIELDS,
  ...BOOKING_CUSTOM_FIELDS,
  ...POSTCALL_CUSTOM_FIELDS,
];

/**
 * The fields the booking write's merge policy classifies — the seven the client
 * self-reports plus the one the booking request carries.
 *
 * NOT `CONTACT_CUSTOM_FIELDS`. The union includes the four post-call fields, and
 * they are not part of this policy at any scope: they have their own writer, their
 * own read, and no notion of a matter context. Deriving from the union would hand
 * the booking path an opinion about fields it must never write.
 *
 * THIS IS A CLASSIFICATION, NOT AN ADMISSION. `intake-policy.js` derives
 * `SELF_REPORTED_KEYS` from `INTAKE_CUSTOM_FIELDS` alone, and nothing below widens
 * it: no key becomes admissible off a stored qualifier record by being classified
 * here, and `consult_type` in particular stays out of that list exactly as
 * BOOKING_CUSTOM_FIELDS explains. What a field's scope decides is only whether a
 * booking that OMITS it may leave a previous booking's answer standing.
 */
const MERGE_POLICY_FIELDS = [...INTAKE_CUSTOM_FIELDS, ...BOOKING_CUSTOM_FIELDS];

// A Set, and deliberately not an `Object.freeze`d one: freezing a Set is decorative
// — the entries live in internal slots and `.add` still works — so claiming it here
// would be a guarantee that does not hold. Membership is what callers read.
const keysWithScope = (scope) =>
  new Set(MERGE_POLICY_FIELDS.filter((f) => f.scope === scope).map((f) => f.key));

/**
 * The matter-scoped keys — written as a SET because a booking that establishes a
 * matter context writes all of them or clears all of them, never a subset.
 *
 * AN UNCLASSIFIED FIELD IS IN NEITHER SET, AND THAT IS THE SAFE SIDE. A new entry
 * added above without a `scope` is absent here, so the writer treats it the way it
 * treats a person-scoped field: written when supplied, left standing when not —
 * which is exactly today's behaviour. Forgetting to classify a field can therefore
 * only fail to clear something; it can never clear something it should not. The
 * totality of the classification is pinned by the suite rather than by a throw,
 * because this module's contract (see the header) is that nothing in it may fail a
 * booking.
 */
export const MATTER_SCOPED_KEYS = keysWithScope(FIELD_SCOPE.MATTER);

/** The person-scoped keys — each written when supplied, kept when not. */
export const PERSON_SCOPED_KEYS = keysWithScope(FIELD_SCOPE.PERSON);

/**
 * The one answer whose presence means "this booking is about a matter".
 *
 * The parent of the matter-scoped set: a sub-type is a sub-type OF a category, so a
 * booking that names a category has said what this engagement is about and its
 * matter surface is authoritative. A booking that names none has said nothing about
 * a matter, and the correct reading of silence there is "unchanged", not "cleared".
 */
export const MATTER_CONTEXT_KEY = "matter_category";

/** name → the field_type that name is required to have. */
const EXPECTED_TYPE = new Map(CONTACT_CUSTOM_FIELDS.map((f) => [f.name, f.type]));

// GET /custom_fields takes the LOWERCASE spelling of parent_type:
//   paths["/custom_fields.json"].get.parameters[].name === "parent_type",
//   schema.enum = ["matter","contact"]
// (The capitalised spelling belongs to the create body, which this module no longer
// has. They are two different enums in the same spec and swapping them is a 400 on
// one call and a silently wrong filter on the other.)
const PARENT_TYPE_QUERY = "contact";

// Bound the pagination walk. A firm with more than this many contact custom fields
// exists in theory; stopping is still better than an unbounded subrequest loop on
// the path to a calendar write. Exhausting it is reported as a FAILED list.
const MAX_PAGES = 10;
const PAGE_LIMIT = 200;

// ── Per-isolate cache ────────────────────────────────────────────────────────
// name → id for fields we have resolved; `_listed` records that an enumeration of
// the account actually succeeded; `_denied` records names found on the account with
// the wrong field_type, so the refusal costs one warn per isolate rather than one
// per booking.
const _idByName = new Map();
const _denied = new Set();
let _listed = false;

/** Test-only: drop the per-isolate cache so each case starts from a cold account. */
export function __resetIntakeFieldCache() {
  _idByName.clear();
  _denied.clear();
  _listed = false;
}

/**
 * Ids handed over by the firm instead of discovered.
 *
 * THE PRIMARY PATH. David creates the field set in Clio settings, reads the ids, and
 * sets CLIO_INTAKE_FIELD_IDS to a JSON object keyed by the `key` column above —
 * {"income_band":123,…}. Seeded ids are used as-is and skip the name lookup entirely.
 *
 * It is also the operator's override on the field_type admission test: a seeded id
 * is a human saying "bind to THIS field", and the listing rules do not second-guess
 * it. A partial object is fine — unlisted keys fall through to the lookup.
 *
 * This is a configuration value, not a secret: a custom-field id is meaningless
 * without the OAuth credentials that are resolved elsewhere, and it is read here
 * exactly the way CLIO_CALENDAR_ID is read in config.js. Malformed JSON is ignored
 * rather than thrown — a typo in a dashboard value must not stop bookings.
 */
function seedFromEnv(env) {
  const raw = String(env?.CLIO_INTAKE_FIELD_IDS ?? "").trim();
  if (!raw) return;
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (_) {
    return; // Do not log the value — it is operator input echoed into our stream.
  }
  if (!parsed || typeof parsed !== "object") return;
  // Over ALL THREE lists: an operator handing over ids should be able to seed a
  // booking-level or post-call field exactly the way they seed one of the seven.
  // Seeding a key is not the same as granting it policy admission — that is
  // intake-policy.js's allow-list, and it does not read this object.
  for (const f of CONTACT_CUSTOM_FIELDS) {
    const id = parsed[f.key];
    if (id == null || id === "") continue;
    const n = Number(id);
    if (Number.isFinite(n) && n > 0) _idByName.set(f.name, n);
  }
}

/**
 * The subset of `wanted` whose ids the cache already knows.
 *
 * Defaults to the WHOLE union, never to one third of it: a caller that names no
 * subset is asking for everything this module resolves, which is what every caller
 * that predates the parameter was already getting.
 */
function snapshot(wanted = CONTACT_CUSTOM_FIELDS) {
  const ids = {};
  for (const f of wanted) {
    if (_idByName.has(f.name)) ids[f.key] = _idByName.get(f.name);
  }
  return ids;
}

/**
 * Enumerate the account's Contact custom fields into the cache.
 *
 * Returns true ONLY if every page requested came back OK **and the walk actually
 * reached the end of the account**. MAX_PAGES is a bound on the subrequest count,
 * not a licence to conclude anything about what lies past it — so exhausting it with
 * `next` still set returns FALSE, and whatever ids the pages we did read yielded
 * stay cached and usable.
 *
 * EVERY ROW IS ADMITTED ON ITS field_type BEFORE IT IS BOUND. The type cannot be
 * changed after creation (see the module header), so a name whose field is not the
 * type that entry declares is refused outright rather than bound to a field that
 * would reject the value on every booking from here on — a failure that would
 * otherwise surface only as a warn on a booking that looks completely clean.
 */
async function listContactFields(api) {
  let url = `/custom_fields?parent_type=${PARENT_TYPE_QUERY}&deleted=false`
          + `&fields=id,name,field_type&limit=${PAGE_LIMIT}`;

  for (let page = 0; page < MAX_PAGES && url; page += 1) {
    let res;
    try {
      res = await api.get(url);
    } catch (_) {
      return false;
    }
    if (!res?.ok) return false;

    let payload;
    try {
      payload = await res.json();
    } catch (_) {
      return false;
    }

    const rows = Array.isArray(payload?.data) ? payload.data : [];
    for (const row of rows) {
      const name = String(row?.name ?? "").trim();
      const id = Number(row?.id);
      if (!name || !Number.isFinite(id) || id <= 0) continue;

      // Only the names we actually read are our business. A firm's other custom
      // fields are none of it, whatever type they are.
      const expected = EXPECTED_TYPE.get(name);
      if (expected === undefined) continue;

      // First match wins, and a first match that was REFUSED stays refused. A firm
      // that already has two fields with one name has a problem this module did not
      // create and must not compound by quietly preferring the second copy.
      if (_idByName.has(name) || _denied.has(name)) continue;

      const fieldType = String(row?.field_type ?? "").trim();
      if (fieldType !== expected) {
        _denied.add(name);
        // NAMES ONLY — never a value, and never the observed type, which is why the
        // two cases get two sentences instead of one interpolated field_type.
        console.warn(
          fieldType
            ? `[clio] custom field has the wrong type — not bound: ${name}`
            : `[clio] custom field reported no type — not bound: ${name}`,
        );
        continue;
      }

      _idByName.set(name, id);
    }

    // Clio v4 paging: meta.paging.next is an absolute URL, absent on the last page.
    //
    // SHELDON-BOOKING-ORIGIN. THE IDENTICAL UNVALIDATED WALK, and it leaks the same
    // credential. `api.get` passes anything starting with "http" straight through to
    // clioFetch, which attaches the firm's live Clio bearer token — so a cursor out of
    // a response body pointing anywhere at all was a token handout, bounded only by
    // MAX_PAGES. Admitted through the same helper the calendar walk uses, so a fix in
    // one place cannot be a fix in only one place.
    //
    // REFUSED AS A FAILED LIST, NOT AS A THROWN BOOKING. This module's contract, in
    // its own header, is that nothing here may fail a booking: every failure path
    // resolves to "fewer ids than asked for" and the same answers stay legible on the
    // intake Note. A refused cursor is exactly that kind of failure — the enumeration
    // did not finish, so it returns false like every other incomplete walk. What it
    // does NOT do is stay quiet about it: the warn names the host, because the fact
    // worth alerting on is not the missing custom fields, it is that something asked
    // for the firm's Clio token.
    let next;
    try {
      next = nextPageUrl(payload?.meta?.paging?.next, "GET /custom_fields");
    } catch (err) {
      console.warn(`[clio] custom field list refused a next page cursor: ${err.message}`);
      return false;
    }
    url = next;

    // The loop can end two ways. `url` empty means Clio said there is no next page —
    // the account is enumerated. `url` still set on the final iteration means we
    // stopped counting, not that Clio stopped listing.
    if (url && page + 1 >= MAX_PAGES) {
      console.warn(`[clio] custom field list truncated at ${MAX_PAGES} pages — treated as a failed list`);
      return false;
    }
  }

  return true;
}

/**
 * Resolve every intake field name to a Clio CustomField id and cache the result for
 * the life of the isolate.
 *
 * A name that resolves to nothing is SKIPPED — absent from `ids`, therefore absent
 * from the contact body, never sent with a null id and never created.
 *
 * @param {{ get:(path:string)=>Promise<Response> }} api
 *        Thin read-only transport supplied by provider-clio.js so this module
 *        carries no auth, no base URL and no knowledge of how a token is minted.
 *        There is no `post` member, because there is nothing here to post.
 * @param {object} env  Pages environment — read only for CLIO_INTAKE_FIELD_IDS.
 * @param {Array<{key:string,name:string,type:string}>} [wanted]
 *        WHICH fields this caller needs ids for. DEFAULTS TO THE WHOLE UNION —
 *        `CONTACT_CUSTOM_FIELDS`, never one third of it. This parameter narrows what
 *        an EXPLICIT caller asks for; it must never narrow what a caller that omits
 *        it receives. The booking path calls `resolveIntakeFieldIds(api, env)` with
 *        no third argument and needs `Intake Consult Type` back (#172) — defaulting
 *        to the seven would resolve the field, then drop its id on the way out of
 *        `snapshot`, and the consult type would go unwritten with nothing failing.
 *        The post-call webhook passes POSTCALL_CUSTOM_FIELDS explicitly and so keeps
 *        its scoped "not found on the account" line. The ACCOUNT WALK is shared and
 *        unscoped either way (listContactFields admits every name in
 *        CONTACT_CUSTOM_FIELDS), so one enumeration still serves every caller and
 *        the per-isolate cache is not split in three.
 * @returns {Promise<{ ids: Record<string, number>, denied: boolean }>}
 *          `ids` is keyed by the qualifier field name and may be partial or empty;
 *          `denied` is true when a name was found on the account but refused on
 *          type, which is the signal that the field set needs settling by hand in
 *          Clio settings and its ids handed back through CLIO_INTAKE_FIELD_IDS.
 */
export async function resolveIntakeFieldIds(api, env, wanted = CONTACT_CUSTOM_FIELDS) {
  seedFromEnv(env);

  const missing = () => wanted
    .filter((f) => !_idByName.has(f.name) && !_denied.has(f.name));

  if (!missing().length) return { ids: snapshot(wanted), denied: _denied.size > 0 };

  if (!_listed) {
    if (!(await listContactFields(api))) {
      console.warn("[clio] custom field list failed — intake fields not resolved this booking");
      // A partial walk can still have refused a name on type before it ran out of
      // pages, and that refusal is exactly as reportable as any other.
      return { ids: snapshot(wanted), denied: _denied.size > 0 };
    }
    _listed = true;
  }

  if (_denied.size) {
    // Names only, never values. This is the line that tells David a field he made
    // does not have the type this code expects, so either the field or
    // CLIO_INTAKE_FIELD_IDS needs adjusting in Clio settings.
    console.warn(
      `[clio] custom fields not bound — check the type, or set CLIO_INTAKE_FIELD_IDS for: ${[..._denied].join(", ")}`,
    );
  }

  // Anything still missing after a SUCCESSFUL enumeration is genuinely not on the
  // account under that name. It is skipped, not created.
  const unresolved = missing();
  if (unresolved.length) {
    console.warn(
      `[clio] custom fields not found on the account — skipped: ${unresolved.map((f) => f.name).join(", ")}`,
    );
  }

  return { ids: snapshot(wanted), denied: _denied.size > 0 };
}
