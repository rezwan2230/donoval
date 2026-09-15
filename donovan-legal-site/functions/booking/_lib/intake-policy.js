// ── What may be persisted onto a Clio contact, and what may not ───────────────
//
// SHELDON-QUALIFIER-BOOKING-JOIN-R1 · issue #153, tasks 3 and 4.
//
// Until this module the partial-write policy existed, but only as an emergent
// property of three separate `if (value)` guards spread across two files. That is
// exactly the shape that looks correct in review and is impossible to state: ask
// "what does this write when the caller answered four of seven questions?" and the
// only honest answer was "read buildCustomFieldValues, then buildAddresses, then
// sanitizeIntake, and hope they agree". They did agree. Nothing said so, nothing
// tested it, and nothing stopped a fourth guard being written differently.
//
// So the policy is one function now, and it is three sentences long:
//
//   1. WRITE EVERY FIELD WE HAVE.     A self-reported answer reaches the contact.
//   2. OMIT EVERY FIELD WE DO NOT.    An unanswered question is ABSENT from the
//                                     body — never "", never null, never a dash.
//   3. NEVER WRITE A PLACEHOLDER.     A value that is a form scaffold rather than
//                                     an answer is refused, and the field is
//                                     treated as unanswered.
//
// ── WHY RULE 3 IS NOT PEDANTRY ───────────────────────────────────────────────
// The live call on 2026-08-04 stored the caller's state as the literal string
// `address 1` while the state dropdown had never been selected. A blank state
// tells the lawyer "we did not ask, or they did not say". `address 1` tells the
// lawyer the client lives somewhere called address 1 — it is a claim, it is false,
// and it is on a client record at a law firm. A placeholder is strictly worse than
// a blank because a blank is honest about its own absence.
//
// `address 1` is not a typo; it is the NAME OF A FORM FIELD that reached a value
// slot. That whole family — `address 1`, `line 2`, `field 3`, `option 1` — is
// refused by shape below rather than by enumerating the strings, because the next
// one will be spelled differently and the point is the shape, not the string.
//
// ── RULE 4, WHICH IS ABOUT WHERE THE ANSWER CAME FROM ────────────────────────
// ONLY SELF-REPORTED ANSWERS ARE PERSISTED. The seven fields below are answers the
// caller gave: six tapped in the qualifier card, one (`source`) relayed verbatim
// from what they said. Retell publishes a post-call analysis alongside every
// transcript — sentiment, a generated summary, an urgency read, an interest score —
// and none of it may ever reach the contact, no matter how convenient it looks on
// a lead record. Three reasons, in the order they matter here:
//
//   • It is a MACHINE'S CHARACTERISATION OF A PERSON written onto a law firm's
//     client record, where it is indistinguishable from something the client said.
//   • It would be read back as fact by whoever opens the contact next.
//   • It is not evidence. The caller can neither see it nor correct it.
//
// The gate is an ALLOW-LIST, not a block-list, so a Retell field invented after
// this file was written is refused by default rather than by having been foreseen.
// `DERIVED_REFUSED` below exists ONLY so the refusal is legible and testable — it
// is documentation with an assertion attached, never the mechanism. A key absent
// from both lists is still refused.
//
// ── WHERE THIS RUNS ──────────────────────────────────────────────────────────
// At the READ boundary — `_lib/qualifier-bind.js`, the one place a stored qualifier
// record becomes data a writer can see. Not at the write boundary, because by then
// the value has already been copied into a summary, a Grow lead and a Vantage
// upsert, and a policy that runs after the copies is a policy about one of them.
//
// NOTHING HERE THROWS AND NOTHING HERE CAN FAIL A BOOKING. Every refusal resolves
// to "that field is absent", which is rule 2 — the same outcome as never having
// been asked. The appointment is the product; a CRM field is not.

import { INTAKE_CUSTOM_FIELDS } from "./clio-custom-fields.js";

/**
 * The self-reported answers that may be persisted to the contact.
 *
 * DERIVED FROM `INTAKE_CUSTOM_FIELDS` rather than re-spelled, so "the seven" is one
 * list in one file. Adding a field to the Clio mapping and forgetting to allow it
 * here would silently write nothing; adding it here and forgetting the mapping
 * would resolve no id and write nothing. One list cannot disagree with itself.
 */
export const SELF_REPORTED_KEYS = Object.freeze(INTAKE_CUSTOM_FIELDS.map((f) => f.key));

const SELF_REPORTED = new Set(SELF_REPORTED_KEYS);

/**
 * Post-call analysis fields, named so the refusal is readable and testable.
 *
 * NOT THE MECHANISM — the allow-list above is. These are the keys Retell's call
 * analysis actually publishes (plus the two Vantage derives), written down so that
 * a test can prove a record carrying every one of them writes none of them, and so
 * that a future reader can see the intent rather than infer it from an omission.
 * A key on neither list is refused exactly as firmly as a key on this one.
 */
export const DERIVED_REFUSED = Object.freeze([
  "user_sentiment", "sentiment", "call_summary", "summary", "call_analysis",
  "in_voicemail", "call_successful", "agent_sentiment", "custom_analysis_data",
  "urgency", "interest", "interest_level", "lead_score", "score", "disposition",
  "intent", "qualified", "routing_outcome", "tier", "strategy_path",
]);

/**
 * Values that are form scaffolding rather than answers.
 *
 * Compared case-insensitively after trimming, after collapsing internal runs of
 * whitespace, and after dropping a TRAILING ellipsis, full stop or colon — so
 * "N / A" matches "n/a" and the qualifier card's own unselected option, which
 * renders as the literal `Select…`, matches "select". That trailing strip is
 * narrow on purpose: no answer to any of the seven ends in "…" or ":", and the two
 * real values that come closest — "Undetermined (exam stage)" and "Declined to
 * say" — are untouched by it.
 *
 * Nothing else is stripped. "$500K–$1.5M" must survive this comparison exactly as
 * written, and a normaliser aggressive enough to make "n/a" match "na" by deleting
 * slashes is aggressive enough to mangle a real band label.
 */
const PLACEHOLDER_VALUES = new Set([
  "n/a", "n / a", "na", "none", "nil", "null", "undefined", "nan",
  "unknown", "(unknown)", "unspecified", "not specified", "not provided",
  "not given", "no answer", "no response", "blank", "empty", "tbd", "to be determined",
  "todo", "test", "testing", "example", "sample", "placeholder", "default",
  "select", "select one", "select an option", "choose", "choose one", "pick one",
  "your answer", "enter value", "value", "string", "text", "xxx", "xx",
  // The card renders in Spanish too (js/perch/qualifier.js), so its unselected
  // option and the shrugs a Spanish-speaking caller relays through `source` are
  // the same refusals in the other language. A policy that only knows English
  // placeholders writes the Spanish ones to the contact.
  "seleccione", "seleccione una opción", "elija", "elija una opción",
  "ninguno", "ninguna", "nada", "desconocido", "desconocida", "no aplica",
  "n/d", "no sé", "no se", "sin especificar", "no especificado", "pendiente",
]);

/**
 * Form-scaffold labels that leaked into a value slot.
 *
 * THIS IS THE `address 1` FAMILY, matched by shape. A label plus an ordinal is
 * never an answer to any of the seven questions: no matter category, sub-type,
 * for-whom, band, language or source has ever been "address 1" or "option 2".
 */
const SCAFFOLD_LABEL_RE = /^(address|street|line|field|option|item|row|column|col|choice|answer|entry|input|value|step|question)\s*[-_#]?\s*\d+$/i;

/** Nothing but punctuation, dashes, dots or whitespace — a typed shrug. */
const PUNCTUATION_ONLY_RE = /^[\s\-‐-―_.,;:*?!/\\|()[\]{}'"]+$/;

/**
 * Is this value a placeholder rather than an answer?
 *
 * "Declined to say" is NOT a placeholder and must never become one: a caller who
 * declined to state their income band ANSWERED the question, and that answer is
 * exactly the one the firm needs on the record. This is the sharpest edge in the
 * file and it is the reason the refusal is a fixed list plus two shapes rather
 * than anything that reasons about how informative a value looks.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
export function isPlaceholder(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return true; // an empty value is "we do not have it", which rule 2 omits
  if (PUNCTUATION_ONLY_RE.test(raw)) return true;
  if (SCAFFOLD_LABEL_RE.test(raw)) return true;
  const normalised = raw
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[…:.]+$/, "")
    .trim();
  return PLACEHOLDER_VALUES.has(normalised) || PLACEHOLDER_VALUES.has(raw.toLowerCase().replace(/\s+/g, " "));
}

/**
 * Apply the whole policy to one stored qualifier record's `intake` half.
 *
 * @param {unknown} raw  whatever was on the record — trusted for nothing
 * @returns {{
 *   fields: Record<string, string>,  // rule 1: every answer we have
 *   omitted: string[],               // rule 2: allow-listed, no answer stored
 *   placeholders: string[],          // rule 3: allow-listed, value refused
 *   rejected: string[],              // rule 4: key is not a self-reported answer
 * }}
 *   Every array carries KEY NAMES ONLY. The values are the client's finances and
 *   the caller's own words; a diagnostic that reports them is a diagnostic that
 *   leaks them, and these arrays exist to be logged.
 */
export function selectIntakeFields(raw) {
  const fields = {};
  const omitted = [];
  const placeholders = [];
  const rejected = [];

  const source = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};

  // Rule 4 first, over what the record actually carries: anything outside the
  // allow-list is refused before its value is even looked at.
  for (const key of Object.keys(source)) {
    if (!SELF_REPORTED.has(key)) rejected.push(key);
  }

  // Rules 1–3, over the allow-list rather than over the record, so the answer to
  // "which fields do we not have?" is complete rather than limited to the keys the
  // record happened to mention.
  for (const key of SELF_REPORTED_KEYS) {
    const value = source[key];
    // A nested object or an array is not an answer; it is a shape we did not write.
    // Refused as a placeholder rather than coerced, because String({}) is
    // "[object Object]" and writing THAT to a client record is the defect this file
    // exists to prevent, arriving through a different door.
    if (value != null && typeof value === "object") { placeholders.push(key); continue; }
    const trimmed = String(value ?? "").trim();
    if (!trimmed) { omitted.push(key); continue; }
    if (isPlaceholder(trimmed)) { placeholders.push(key); continue; }
    fields[key] = trimmed;
  }

  return { fields, omitted, placeholders, rejected };
}

/**
 * The 50 states plus the District of Columbia, exactly as the qualifier card
 * offers them (`js/perch/qualifier.js` → `US_STATES`).
 *
 * A SHAPE TEST IS NOT AN ADMISSION TEST, and that distinction is rule 3 applied to
 * `state`. The check this replaces was `/^[A-Za-z]{2}$/`, which admits `XX`, `ZZ`
 * and `AB` — two-letter strings that are not places. They would have been written
 * to the contact's address `province` as though the caller had named them, which is
 * the same false claim `address 1` was, one validation layer down.
 */
export const US_STATE_CODES = Object.freeze([
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO",
  "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA",
  "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
]);

const US_STATES = new Set(US_STATE_CODES);

/** The qualifier's own sentinel for "not in the United States". */
export const OUTSIDE_US = "outside_us";

/**
 * The caller's state, or "" when we do not have one.
 *
 * "" is rule 2: `_lib/provider-clio.js`'s `buildAddresses` returns no address for
 * it, so the contact simply carries no address rather than an address asserting a
 * place the caller never named.
 *
 * @param {unknown} raw
 * @returns {string} a USPS code, `outside_us`, or ""
 */
export function selectState(raw) {
  const value = String(raw ?? "").trim();
  if (!value || isPlaceholder(value)) return "";
  if (value.toLowerCase() === OUTSIDE_US) return OUTSIDE_US;
  const code = value.toUpperCase();
  return US_STATES.has(code) ? code : "";
}
