// ── FL Stat. §934.03 two-party recording consent ───────────────────────────────
//
// Florida is an all-party-consent state. Recording a call without every party's
// consent is a third-degree felony (§934.06), and the "procure" prong reaches the
// vendor doing the recording. Per perch-legal-compliance-memo.md §1 and the §6
// Go/No-Go checklist, the build requires:
//
//     "a pre-recording disclosure the caller affirmatively acknowledges
//      ('press 1 / say I agree') BEFORE audio is captured"
//     "decline → non-recorded human callback/end"
//
// ENFORCEMENT MODEL — why the gate sits at token mint, not inside the call:
//
// A Retell web call begins capturing audio the moment the SDK connects. Any
// consent step that runs *during* the call is therefore already too late — the
// caller is recorded while listening to the disclosure. So the gate is placed
// one step earlier: /web-call refuses to mint a Retell access token unless the
// request carries a valid consent assertion. No token → no call → no recording.
// Consent necessarily precedes record-start because the call cannot exist first.
//
// The check is server-side on purpose. The browser modal is the user experience;
// THIS is the control. A client that skips the modal gets 403, not a call.
//
// ── STATUS: DRAFT LANGUAGE ─────────────────────────────────────────────────────
// DISCLOSURE_TEXT below is the AI-drafted starting point from the compliance memo.
// It is NOT attorney-approved. Paul Donovan, Esq. finalizes the wording before
// production (memo §6: "Paul finalizes language"). When the text changes, bump
// CONSENT_VERSION in the same commit — the version is recorded with every consent
// event, so the audit log can prove which wording a given caller actually saw.

/**
 * Bump this whenever DISCLOSURE_TEXT changes. Stored with every consent event so
 * an audit can reconstruct exactly what the caller agreed to.
 * Format: v<n>-<YYYY-MM-DD>-<draft|approved>
 */
export const CONSENT_VERSION = "v1-2026-07-20-draft";

/**
 * Read aloud/shown BEFORE any audio is captured.
 *
 * Covers what the memo says the current "I'm an automated assistant" line does
 * NOT cover: that it is AI (memo §5 — use the word explicitly), that the call is
 * recorded AND transcribed, who does the recording, that it cannot give legal
 * advice, and that nothing here creates an attorney-client relationship.
 */
export const DISCLOSURE_TEXT = [
  "Before we connect you:",
  "",
  "You will be speaking with an artificial intelligence (AI) assistant, not a person.",
  "",
  "This call will be recorded and transcribed by Donovan Legal PLLC and its voice " +
    "technology provider, and a summary may be stored so we can assist you if you " +
    "contact us again. Florida law requires the consent of everyone on the call " +
    "before it can be recorded.",
  "",
  "The AI assistant cannot give legal advice, and speaking with it does not create " +
    "an attorney-client relationship.",
  "",
  "If you agree to be recorded, choose \"I agree\" to continue. If you do not agree, " +
    "choose \"Do not record\" — we will not start a recorded call, and you can reach " +
    "us by phone or through our contact form instead.",
].join("\n");

/** Offered when the caller declines. Memo §1: decline → non-recorded path, never a dead end. */
export const DECLINE_OPTIONS = {
  message:
    "No problem — we have not started a recording. You can reach Donovan Legal " +
    "PLLC directly and speak with a person, or send us a message and we will get " +
    "back to you.",
  contact_url: "/contact.html",
};

/** Clock skew allowances for the caller-supplied acknowledgment timestamp. */
const MAX_AGE_MS = 15 * 60 * 1000; // consent older than 15 min → re-ask
const MAX_SKEW_MS = 2 * 60 * 1000; // tolerate a client clock up to 2 min fast

/**
 * Validate the SHAPE of a consent assertion from the browser.
 *
 * Shape: { granted: true, version: "<CONSENT_VERSION>", acknowledged_at: "<ISO 8601>" }
 *
 * ⚠️ SHAPE ONLY — THIS IS NOT AN AUTHENTICITY CHECK.
 * Every field it inspects is client-supplied and independently guessable:
 * CONSENT_VERSION is served publicly by GET /consent-notice, and
 * `acknowledged_at` just has to be a recent timestamp. A three-line script can
 * therefore satisfy this function without a human ever seeing the disclosure —
 * which is exactly what Dr. Insane's RE-GATE R2 finding B1 said. It remains
 * useful as the EVIDENTIARY record (it pins which wording was acknowledged and
 * when), but authenticity is established separately by the signed ticket in
 * _lib/consent-ticket.js.
 *
 * Callers minting a Retell token must use verifyConsentTicket(), not this.
 *
 * Deliberately strict — every failure returns a reason for the SERVER LOG only.
 * The caller gets a generic 403; we never coach a client into forging a payload.
 *
 * @returns {{ok: true, record: object} | {ok: false, reason: string}}
 */
export function validateConsent(consent, nowMs = Date.now()) {
  if (!consent || typeof consent !== "object") return { ok: false, reason: "missing" };

  // Strict boolean true. A truthy "false" string or 1 must not pass.
  if (consent.granted !== true) return { ok: false, reason: "not_granted" };

  // The caller must have agreed to the wording this server is currently serving.
  // A stale tab holding an old disclosure re-prompts rather than silently binding
  // the caller to text they never saw.
  if (consent.version !== CONSENT_VERSION) return { ok: false, reason: "version_mismatch" };

  const ts = Date.parse(String(consent.acknowledged_at ?? ""));
  if (!Number.isFinite(ts)) return { ok: false, reason: "bad_timestamp" };
  if (ts > nowMs + MAX_SKEW_MS) return { ok: false, reason: "timestamp_in_future" };
  if (ts < nowMs - MAX_AGE_MS) return { ok: false, reason: "stale" };

  return {
    ok: true,
    record: {
      granted: true,
      version: CONSENT_VERSION,
      acknowledged_at: new Date(ts).toISOString(),
      recorded_at: new Date(nowMs).toISOString(),
    },
  };
}
