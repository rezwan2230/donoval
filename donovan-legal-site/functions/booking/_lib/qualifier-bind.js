// ── Server-side call_id → qualifier binding ───────────────────────────────────
//
// SHELDON-PERCH-A32-CALLID-BIND (issue #57). Sarah's A4.1 cutover gate found that
// /booking/create read `call_id` straight out of the request body and used it as
// the join key for the caller's qualifier answers. The end-to-end thread worked,
// but nothing on the server ever asked whether that call_id named a real Perch
// call — so the join was only as trustworthy as the browser that claimed it.
//
// Two distinct things hung off the unchecked value:
//
//   1. The Clio calendar description + the Grow lead. create.js looked up
//      `qualbk:<callId>` in PERCH_ACTIONS and appended the plain-English summary
//      to the booking notes. This path did at least require a KV hit, so a random
//      forged id attached nothing — but the lookup was incidental, not a check.
//
//   2. The Vantage merge key. `upsertVantageLead({ callId })` forwarded the body
//      value verbatim as `call_id=` on /upsert-lead, where Vantage MERGES the
//      booking into whatever lead already carries that id. Nothing verified it at
//      all. A forged id folded a stranger's booking into another caller's lead
//      record; a garbage id scattered orphan keys through the dashboard.
//
// This module is the one place that decides whether a submitted call_id is real.
// It answers with evidence the SERVER wrote, never with anything the client sent:
//
//   • PERCH_ACTIONS KV, key `qualbk:<callId>` — the durable back-office copy
//     fn/qualifier_submit writes when the caller finishes the modal (6h TTL),
//     precisely so the later booking can join to it. It carries the summary text,
//     and it is now the ONLY witness.
//
// It used to be two records, either of which confirmed: the above, and a
// PERCH_BRIDGE Durable Object slot `qual:<callId>` probed through a
// non-destructive /has. The DO went with the voice concierge — nothing writes the
// slot and the binding is off the Pages project — so that arm is deleted rather
// than left to evaluate false forever.
//
// THE VERIFYING SET IS UNCHANGED by the DO's removal, which is the point worth
// stating. The two records were OR'd, and the KV copy was already carrying nearly
// every genuine booking on its own: Paula's get_qualifier_result consumed the DO
// slot mid-call, so by the time the caller reached the booking form the bridge
// slot was usually gone. Dropping the arm that was almost always absent narrows
// nothing; it removes a lookup that could only answer "unknown".
//
// FAIL CLOSED ON ATTACHMENT, NEVER ON THE BOOKING. Every failure mode here —
// bridge unreachable, KV down, binding absent, malformed id — resolves to
// "not verified". Not verified means the qualifier context is withheld: no summary
// in the Clio description, no merge key to Vantage. It never means the booking is
// refused. An appointment that Clio confirmed must not be lost because an
// enrichment lookup failed, and an unverifiable claim must not be treated as true
// just because the store that would have refuted it was unavailable — that is the
// `if (secret && …)` fail-open shape this codebase refuses everywhere else.
//
// NOT A PROOF OF OWNERSHIP. A confirmed call_id proves a Perch session by that id
// submitted a qualifier on this deployment. It does NOT prove the person booking
// is that caller — the call_id remains a bearer capability, as
// fn/qualifier_result.js already documents, so a leaked id still joins. Binding
// the join to caller identity is a separate change with its own failure modes and
// is explicitly out of scope for #57.

import { selectIntakeFields, selectState } from "./intake-policy.js";

/**
 * Outcome of the binding, recorded on the booking so Paul and Wendy can tell at a
 * glance whether the qualifier actually joined — and, when it did not, whether the
 * caller simply booked without a call or arrived with an id the server could not
 * vouch for.
 */
export const QUALIFIER_JOIN = {
  /** No call_id was submitted — an ordinary web booking. Nothing to join. */
  NONE: "none",
  /** A call_id was submitted but no server-side record matches it. Withheld. */
  UNVERIFIED: "unverified",
  /** Server-confirmed, but no summary text survives (KV expired / empty). */
  VERIFIED_NO_SUMMARY: "verified_no_summary",
  /** Server-confirmed and the qualifier summary was folded into the booking. */
  ATTACHED: "attached",
};

// A call_id becomes a KV key (it used to travel in a URL query string too — the
// bridge probe and the Vantage merge key, both now gone), so constrain it to a conservative id charset. This is
// a shape guard, not the security control — the record lookup below is. It exists
// so a malformed value is rejected before it is echoed into a subrequest at all.
// Retell ids look like `call_9f2c…`; the modal threads that value through unchanged.
const CALL_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

// `default` is the shared-bucket sentinel the B2 fix removed: fn/qualifier_submit
// refuses to write under it and fn/qualifier_result refuses to read it. Refuse it
// here too, so a booking can never be the fourth call site that reintroduces it.
const RESERVED_IDS = new Set(["default"]);

/**
 * Resolve a submitted call_id against the server's own qualifier records.
 *
 * Never throws: every store is best-effort and every failure degrades to
 * "not verified". The caller is expected to book regardless.
 *
 * @param {Record<string, any>} env  Pages environment bindings (PERCH_ACTIONS)
 * @param {string} callId            the value submitted in the request body
 * @returns {Promise<{
 *   verified: boolean,   // a server-written record exists for this call_id
 *   source: string,      // "" | "kv" — which store confirmed
 *   summary: string,     // the plain-English qualifier block, "" when none survives
 *   intake: object,      // the same answers, structured — {} when none survives
 *   state: string,       // the caller's state / "outside_us", "" when none survives
 *   tier: string,        // derived membership tier, lower-cased, "" when unknown — REPORTING ONLY
 *   matter: string,      // "tax" | "real_estate" | "other", "" when unknown — REPORTING ONLY
 *   policy: object,      // what the write policy omitted / refused, key names only
 *   join: string,        // one of QUALIFIER_JOIN — recorded on the booking
 *   consume: () => Promise<void>,  // one-shot clear, NOT run yet — see below
 * }>}
 */
export async function resolveQualifierBinding(env, callId) {
  const id = String(callId ?? "").trim();

  if (!id) {
    return { ...WITHHELD, join: QUALIFIER_JOIN.NONE };
  }
  if (!CALL_ID_RE.test(id) || RESERVED_IDS.has(id.toLowerCase())) {
    // Do not log the value — a malformed id is still an attacker-chosen string and
    // logging it hands them a write into our log stream.
    return { ...WITHHELD, join: QUALIFIER_JOIN.UNVERIFIED };
  }

  // `probeBridge` stood here and its result was OR'd in: `bridgePresent || kv.present`.
  // The bridge DO is gone with the voice concierge — the binding is off the Pages
  // project and nothing writes the `qual:<id>` slot any more — so the probe could
  // only ever have returned false, and an OR against a constant false is the KV
  // check on its own. Which is what its own docstring said would happen: "the KV
  // copy carries the verification on its own, exactly as it does today."
  //
  // So this is a simplification, NOT a loosening: the set of call_ids that verify
  // is unchanged, because every one of them was verified by KV already.
  const kv = await readQualifierCopy(env, id);

  if (!kv.present) {
    return { ...WITHHELD, join: QUALIFIER_JOIN.UNVERIFIED };
  }

  return {
    verified: true,
    source: "kv",
    summary: kv.summary,
    intake: kv.intake,
    state: kv.state,
    tier: kv.tier,
    matter: kv.matter,
    policy: kv.policy,
    join: kv.summary ? QUALIFIER_JOIN.ATTACHED : QUALIFIER_JOIN.VERIFIED_NO_SUMMARY,
    consume: kv.present ? () => clearQualifierCopy(env, id) : NO_CONSUME,
  };
}

/**
 * Clear the durable copy so a second booking cannot re-attach the same answers.
 *
 * ONE-SHOT, BUT NOT ON READ ANY MORE, and that change is the point rather than a
 * refactor. This delete used to run inside the resolve above — before the
 * availability re-check, before the provider call, before anything could go wrong.
 * A booking that then came back 409 SLOT_TAKEN (the caller's slot went while they
 * were typing) or 502 left the caller re-picking a time with their qualifier
 * already destroyed, so the booking they DID complete carried nothing. That is the
 * same silent loss as the join defect this ticket exists to fix, one retry later.
 *
 * The guarantee it protects is unchanged: a given qualifier record attaches to at
 * most one booking. It is now spent when a booking is actually CONFIRMED, which is
 * the moment the answers have landed somewhere.
 *
 * Never throws. A failed delete costs a duplicate summary on a hypothetical second
 * booking, which is not a reason to fail one Clio has already accepted.
 */
async function clearQualifierCopy(env, id) {
  try {
    await env?.PERCH_ACTIONS?.delete?.(`qualbk:${id}`);
  } catch (_) { /* non-fatal */ }
}

/** The no-op consume for a binding with no KV copy to spend (bridge-only, or none). */
const NO_CONSUME = async () => {};

/**
 * The shape returned whenever the qualifier context is withheld.
 *
 * One frozen literal rather than four hand-written object literals: every field
 * this function can return has to be present and empty on the withheld paths, and
 * spelling them out at each `return` is how a later field gets added to the
 * verified branch and quietly left `undefined` on the unverified one. A caller
 * reading `.intake` off an unverified binding must get {}, not undefined, because
 * the difference between them is the difference between "no answers" and a
 * TypeError on the path to a calendar write.
 */
const WITHHELD = Object.freeze({
  verified: false, source: "", summary: "", intake: {}, state: "",
  tier: "", matter: "",
  policy: Object.freeze({ omitted: [], placeholders: [], rejected: [] }),
  consume: NO_CONSUME,
});

// `probeBridge` and its docstring stood here — a non-destructive `/has` probe
// against the bridge DO's `qual:<id>` slot. Removed with the DO binding; see the
// note at its former call site above.

/**
 * Read the durable back-office copy `qualbk:<id>` from PERCH_ACTIONS.
 *
 * `present` is about the RECORD, not the text: a record whose summary is empty
 * still proves the call_id is real (so the Vantage merge key is legitimate) while
 * attaching nothing to the Clio contact.
 *
 * `intake` and `state` are the structured half of the same record
 * (SHELDON-CLIO-CONTACT-MAPPING) — the answers that become custom_field_values and
 * the address province on the Clio contact. They are read DEFENSIVELY because the
 * record has a 6h TTL and this code can deploy while records written by the
 * previous fn/qualifier_submit are still live: an older record has a summary and no
 * `intake`, which must degrade to "no custom fields on the contact", never to a
 * throw on the path to a booking.
 *
 * THIS IS WHERE THE WRITE POLICY RUNS (#153, tasks 3 and 4). `_lib/intake-policy.js`
 * decides what a stored record is allowed to become: every self-reported answer we
 * have, nothing for the ones we do not, no placeholder in place of either, and no
 * post-call characterisation at all. It runs HERE, at the one point a record turns
 * into data a writer can see, rather than at each write — a policy applied after
 * the value has been copied into a summary, a Grow lead and a Vantage upsert is a
 * policy about whichever copy it was bolted onto.
 *
 * It replaces `sanitizeIntake`, which admitted any key with any non-empty string.
 * That was enough to keep the object flat and not enough to keep it TRUE: it would
 * have written `state: "address 1"` — the live 2026-08-04 value — and would have
 * written a Retell sentiment score onto a client record had one ever been put on
 * the record. Shape was checked; provenance and meaning were not.
 */
async function readQualifierCopy(env, id) {
  try {
    const raw = await env?.PERCH_ACTIONS?.get?.(`qualbk:${id}`);
    if (!raw) return ABSENT;
    let q = {};
    try { q = JSON.parse(raw); } catch (_) { /* malformed record still proves existence */ }
    const selected = selectIntakeFields(q?.intake);
    return {
      present: true,
      summary: q?.summary ? String(q.summary) : "",
      intake: selected.fields,
      state: selectState(q?.state),
      // Reporting-only, and deliberately NOT routed through selectIntakeFields.
      // The write policy above governs what becomes a Clio contact field; tier is
      // not one and must never become one. It exists solely to put a number on the
      // conversion. Absent on records written before this shipped — hence "".
      tier: pickFrom(TIER_VALUES, q?.tier),
      matter: pickFrom(MATTER_VALUES, q?.matter),
      policy: {
        omitted: selected.omitted,
        placeholders: selected.placeholders,
        rejected: selected.rejected,
      },
    };
  } catch (_) {
    // KV unavailable ⇒ unknown, not confirmed.
    return ABSENT;
  }
}

/** No record — or no readable one. Frozen for the same reason WITHHELD is. */
const ABSENT = Object.freeze({
  present: false, summary: "", intake: {}, state: "",
  tier: "", matter: "",
  policy: Object.freeze({ omitted: [], placeholders: [], rejected: [] }),
});

/**
 * The only tier and matter values a record is allowed to carry.
 *
 * An allow-list rather than a passthrough, for the same reason the malformed
 * call_id above is never logged: this string ends up in an outbound analytics
 * payload, and a record is not a trusted input just because it came from our own
 * KV. Anything unrecognised becomes "", which the value map scores as baseline.
 *
 * Lower-cased on comparison because `fn/qualifier_submit.js` writes 'Gold' and
 * 'Reserve' capitalised but 'escape_hatch' lower — a real inconsistency in the
 * source data, normalised here rather than propagated.
 */
const TIER_VALUES = new Set(["gold", "platinum", "diamond", "reserve", "escape_hatch"]);
const MATTER_VALUES = new Set(["tax", "real_estate", "other"]);

const pickFrom = (allowed, v) => {
  const s = typeof v === "string" ? v.trim().toLowerCase() : "";
  return allowed.has(s) ? s : "";
};
