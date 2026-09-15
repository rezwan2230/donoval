// ── POST /fn/contact — the "Send an Initial Inquiry" sink ─────────────────────
//
// ORDER SHELDON-CONTACT-ROUTE-R1 (#214).
//
// WHAT THIS REPLACES. donovan-legal-site/contact.html posted its inquiry form to
// `https://formspree.io/f/xnjwgzkj` — a third-party form app that does not deliver.
// It could not have delivered from this site even if the account were live: the
// edge CSP has carried `form-action 'self' https://vantage.ticoai.net` since the
// A02 hardening (functions/_middleware.js), and a browser refuses a form
// submission to a host that directive does not name. The form was a dead control
// on a law firm's contact page, and every inquiry typed into it was lost silently
// — no bounce to the writer, no error on the page, nothing in the firm's queue.
//
// WHERE THE INQUIRY GOES NOW, both legs inside systems the site already uses and
// neither of them a new dependency:
//
//   1. Clio Grow Lead Inbox (booking/_lib/grow-lead.js, GROW_LEAD_TOKEN) — the
//      SAME sender fn/take_message and booking/create already push to. This is the
//      DELIVERY leg: a lead landing in Grow's "For review" queue is what raises the
//      firm's new-lead notification to info@donovan.law. It is REQUIRED here, which
//      is the one place this route deliberately differs from every other caller of
//      createGrowLead — see "THE TWO LEGS" below.
//   2. Clio Manage contact + note (booking/_lib/provider-clio.js
//      createContactInquiry) — the RECORD leg. Creates or REUSES the contact
//      through the SHELDON-154 email-or-phone dedup, then files the inquiry as a
//      note on it. No new Clio integration, no second dedup implementation.
//
// ── THE TWO LEGS, AND WHY THEY FAIL DIFFERENTLY ──────────────────────────────
//
// The order is deliberate and the asymmetry is the whole design:
//
//   Grow FIRST, and hard-required. Nothing is written to Clio Manage until the
//   firm has actually received the inquiry, so a caller who is told "that did not
//   send" and retries produces NO Manage residue from the failed attempt — no
//   orphan contact, no duplicate note. An unset GROW_LEAD_TOKEN is a 503 with a
//   warn, never a silent drop: `createGrowLead` returns `{skipped:"no_token"}`, and
//   a `{skipped}` read by a caller guarded on `status !== undefined` is invisible
//   by construction. That is the DRINSANE-LEAD-FAILCLOSED (#151) defect exactly,
//   and this route refuses to reproduce it.
//
//   Manage SECOND, surfaced but not fatal. Once Grow has accepted the lead the
//   inquiry HAS reached the firm. Answering 502 at that point would tell the writer
//   to submit again and deliver the same inquiry twice. So a failed Manage leg
//   answers 200 with `clio_contact:"unavailable"` in the body AND a warn — it is
//   reported, never swallowed, and never dressed up as a clean success.
//
// ── FAIL-CLOSED ORDER. Every check runs BEFORE either write. ────────────────
//   1. Same-origin (checkOrigin, allowSameOrigin — works on Preview)   → 403
//   2. Per-IP rate limit, its OWN KV bucket, not the phone line's      → 429
//   3. Field validation                                               → 400
//   4. Turnstile — unset secret refuses, never falls open       → 503/403
//   5. Clio Grow lead                                           → 502/503
//   6. Clio Manage contact + note                        → reported in body
//
// Response shapes:
//   200  { ok: true, clio_contact: "recorded" | "unavailable" }
//   400  { error, code: "VALIDATION_ERROR" }
//   403  { error, code: "ORIGIN_REFUSED" | "TURNSTILE_REQUIRED" | "TURNSTILE_FAILED" }
//   429  { error, code: "RATE_LIMITED" }
//   502  { error, code: "LEAD_NOT_DELIVERED" }
//   503  { error, code: "TURNSTILE_NOT_CONFIGURED" | "TURNSTILE_UNAVAILABLE"
//                     | "LEAD_NOT_CONFIGURED" }
//
// DEPLOY REQUIREMENT: TURNSTILE_SECRET_KEY and GROW_LEAD_TOKEN must both be set on
// the Production AND Preview Pages environments. Either one unset ⇒ this endpoint
// refuses every inquiry with a 503 and a logged reason. That is deliberate: an
// inquiry the writer was told had sent, which reached nobody, is what this ticket
// exists to end.
//
// ── LOGGING RULE, absolute. ─────────────────────────────────────────────────
// Nothing here logs a secret, and nothing logs the inquiry. The writer's name,
// email, phone, and their description of their legal matter never reach a log line
// on any branch — every warn below prints an outcome, a status or a field NAME.
// The one caller-derived value that IS logged is the field-name list on a
// validation failure, which is a list of OUR keys, not their answers.

import { createGrowLead } from "../booking/_lib/grow-lead.js";
import { resolveContactConfig, getAdapter } from "../booking/_lib/config.js";
import { checkOrigin, checkRateLimit, verifyTurnstile } from "../_lib/abuse.js";

const TAG = "fn/contact";

/** The channel label on the Grow lead card — the firm's own queue, so it must say
 * which door this one came through. `take_message` uses "Donovan Phone — Paula"
 * and the booking widget "Donovan Website — Perch Booking"; a lead from here is
 * neither, and a card that cannot be told apart from a booking is a card the
 * intake person works in the wrong order. */
const LEAD_SOURCE = "Donovan Website — Contact Form";

/** Where the lead came from, for Grow's required `referring_url`. */
const REFERRING_URL = "https://www.donovan.law/contact";

/**
 * Length cap on `matter_type`.
 *
 * DELIBERATELY NOT AN ALLOW-LIST OF THE NINE OPTIONS THE SELECT OFFERS. The select
 * is a convenience for the writer, not a security boundary — the value reaches a
 * Grow lead card and a Clio note, both of which are free text — and refusing a
 * value the dropdown does not know would only ever lose a client whose browser
 * autofilled something odd. It is clamped like every other free-text field instead.
 */
const MATTER_MAX = 80;

export async function onRequestPost(context) {
  const { request, env } = context;

  // ── 1. Same-origin ──────────────────────────────────────────────────────────
  // `allowSameOrigin` for the reason _lib/abuse.js sets out at length: the fixed
  // production allow-list is right for /web-call, where only the live site may burn
  // Retell minutes, and wrong for a form that has to be reviewable on a Preview
  // deployment. Accepting the request's OWN origin is the textbook CSRF check, and
  // on production that origin IS www.donovan.law.
  const origin = checkOrigin(request, env, { allowSameOrigin: true });
  if (!origin.ok) {
    console.warn(`[${TAG}] ORIGIN_REFUSED reason=${origin.reason}`);
    return jsonError(403, "request_refused", "ORIGIN_REFUSED");
  }

  // ── 2. Rate limit ───────────────────────────────────────────────────────────
  // ITS OWN BUCKET. `checkRateLimit` takes one precisely so a second caller gets a
  // separate counter instead of a copy of the function: without it a burst of form
  // spam would spend the phone line's budget and start refusing real calls, which
  // is a coupling nobody debugging the phone would think to look for.
  const rl = await checkRateLimit(request, env, Date.now(), {
    bucket: "contact", max: 5, windowS: 600, tag: TAG,
  });
  if (!rl.ok) {
    // Retry-After so the page can say something better than "try again" — the
    // limiter already knows when the window rolls over.
    return jsonError(429, "too_many_requests", "RATE_LIMITED", {
      "Retry-After": String(rl.retry_after),
    });
  }

  // ── 3. Parse and validate ───────────────────────────────────────────────────
  let b = {};
  try {
    b = await request.json();
  } catch (_) {
    return jsonError(400, "request body must be JSON", "VALIDATION_ERROR");
  }
  if (!b || typeof b !== "object") b = {};

  // The seven fields contact.html posts, clamped at the same lengths the booking
  // path uses for the fields it shares. Free-text is collapsed the way
  // take_message collapses transcription — a pasted email thread arrives with
  // newlines and tabs, and the description is the one field a client will paste
  // into.
  const name        = clean(b.name, 120);
  const email       = clean(b.email, 200).toLowerCase();
  const phone       = clean(b.phone, 40);
  const referral    = clean(b.referral, 200);
  const matterType  = clean(b.matter_type, MATTER_MAX);
  const urgency     = clean(b.urgency, 80);
  // THE ONE FIELD THAT KEEPS ITS LINE BREAKS. `clean` collapses every run of
  // whitespace, which is right for a name, a phone number and a transcribed voice
  // message — and wrong for the only field on this form a client types paragraphs
  // into. Flattening a matter description into one line loses the structure the
  // person writing it chose, in the field the attorney actually reads.
  const description = cleanMultiline(b.description, 2000);
  const turnstileToken = String(b.turnstile_token ?? "").trim().slice(0, 4096);

  // Required: the three the form marks with a required-mark, plus a parseable
  // email — an inquiry the firm cannot answer is not an inquiry.
  const missing = [];
  if (!name) missing.push("name");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) missing.push("email");
  if (!matterType) missing.push("matter_type");
  if (!description) missing.push("description");
  if (missing.length) {
    // OUR key names, never their answers. This is the one caller-shaped thing that
    // reaches a log on this route, and it is a subset of a list written above.
    console.warn(`[${TAG}] VALIDATION_ERROR missing=${missing.join(",")}`);
    return jsonError(400, `missing or invalid: ${missing.join(", ")}`, "VALIDATION_ERROR");
  }

  // ── 4. Turnstile ────────────────────────────────────────────────────────────
  // The shared implementation and the one secret name, exactly as /booking/create
  // calls it. FAIL CLOSED INCLUDING ON AN UNSET SECRET: the "unset means DISABLED"
  // shape is what tier-auth.js, _lib/abuse.js and booking/create.js all already
  // refuse, and an unverified write into the firm's real intake queue is the same
  // exposure fn/take_message was re-authenticated to close.
  const ts = await verifyTurnstile(turnstileToken, request, env, TAG);
  if (!ts.ok) {
    return jsonError(ts.status, ts.status === 503 ? "verification_unavailable" : "verification_failed", {
      turnstile_not_configured: "TURNSTILE_NOT_CONFIGURED",
      turnstile_missing:        "TURNSTILE_REQUIRED",
      turnstile_failed:         "TURNSTILE_FAILED",
      turnstile_error:          "TURNSTILE_UNAVAILABLE",
    }[ts.reason] ?? "TURNSTILE_FAILED");
  }

  // ── 5. Clio Grow lead — THE DELIVERY LEG, required ──────────────────────────
  //
  // `from_message` is built here rather than left to grow-lead.js's synthesized
  // fallback, because the fallback describes a BOOKING ("Consultation requested via
  // website") and this is not one. The intake person reads this text as the whole of
  // the inquiry, so it carries every field the form collected.
  //
  // The token itself never appears here: createGrowLead reads GROW_LEAD_TOKEN from
  // env and puts it in the request BODY, which is also why that sender refuses to
  // follow a redirect (SHELDON-LEAD-REDIRECT #143) — there is no header for a
  // runtime to strip.
  const lead = await createGrowLead(env, {
    name,
    email,
    phone,
    notes: composeLeadMessage({ matterType, urgency, referral, description }),
    source: LEAD_SOURCE,
    referringUrl: REFERRING_URL,
  });

  if (!lead.ok) {
    // NO CREDENTIAL, NO SILENCE. `{skipped:"no_token"}` is the branch that used to
    // vanish: the sender does not send at all, returns no `status`, and a caller
    // guarded on `status !== undefined` warns nothing and reports success. It gets
    // its own message, its own code and its own status here — an unconfigured lead
    // inbox is a misconfiguration to fix, not an outage to wait out.
    if (lead.skipped === "no_token") {
      console.error(
        `[${TAG}] MISCONFIGURED — GROW_LEAD_TOKEN not set on this Pages environment; `
        + "the inquiry was NOT delivered and was refused rather than dropped.",
      );
      return jsonError(503, "inquiry_not_configured", "LEAD_NOT_CONFIGURED");
    }
    // A NON-2xx IS A FAILURE, NOT A SUCCESS. Status or transport outcome only —
    // `lead.error` on the refused-redirect branch names a HOST, which is grow-lead's
    // own warn to print and not an inquiry field.
    console.warn(`[${TAG}] LEAD_NOT_DELIVERED grow=${lead.status ?? "no_response"}`);
    return jsonError(502, "inquiry_not_delivered", "LEAD_NOT_DELIVERED");
  }

  // ── 6. Clio Manage contact + note — THE RECORD LEG, surfaced not fatal ──────
  //
  // Runs only after the firm has the inquiry. Its outcome rides in the response so
  // a failure here is visible to whoever is watching the form, and it never
  // downgrades a delivered inquiry to a "your message failed" the writer would
  // answer by sending it twice.
  const recorded = await recordInManage(env, {
    contact: { name, email, phone },
    inquiry: { referral, matterType, urgency, description },
  });

  return jsonOk(200, { ok: true, clio_contact: recorded ? "recorded" : "unavailable" });
}

/**
 * Create-or-reuse the Clio Manage contact and file the inquiry note on it.
 *
 * Never throws: the caller has already delivered the lead and must not turn a
 * bookkeeping failure into a failed submission. Every exit warns.
 *
 * @returns {Promise<boolean>} true only when the contact resolved AND the note filed.
 */
async function recordInManage(env, { contact, inquiry }) {
  const { provider, config } = resolveContactConfig(env);
  if (provider === "mock") {
    // A DEMO DEPLOYMENT MUST NOT WRITE INTO THE FIRM'S REAL CLIO. Announced, so a
    // production environment that somehow carries BOOKING_PROVIDER=mock is visible
    // in the log rather than quietly recording nothing.
    console.warn(`[${TAG}] BOOKING_PROVIDER=mock — inquiry delivered to Grow, NOT recorded in Clio Manage`);
    return false;
  }

  let adapter;
  try {
    adapter = await getAdapter(provider);
  } catch (e) {
    console.warn(`[${TAG}] clio adapter unavailable provider=${provider}`);
    return false;
  }
  if (typeof adapter.createContactInquiry !== "function") {
    console.warn(`[${TAG}] provider ${provider} has no createContactInquiry — inquiry not recorded in Clio Manage`);
    return false;
  }

  try {
    const res = await adapter.createContactInquiry(config, { contact, inquiry }, env);
    if (!res?.ok) {
      // provider-clio has already warned WHICH refusal this was, in its own words
      // and without the inquiry. Say what it cost, at this route's tag, so the two
      // lines together read cause-then-consequence.
      console.warn(`[${TAG}] inquiry delivered to Grow but NOT recorded in Clio Manage: ${res?.reason ?? "unknown"}`);
      return false;
    }
    return true;
  } catch (e) {
    // Message only. resolveSecret never puts a secret in the Error and nothing in
    // the adapter puts the inquiry in one, but this is the last catch before a log
    // so it stays narrow on purpose.
    console.warn(`[${TAG}] clio manage write threw — inquiry not recorded: ${String(e?.message ?? e)}`);
    return false;
  }
}

/**
 * The text the intake person reads on the Grow lead card.
 *
 * Every field the form collected, labelled, in the order the form asks them — the
 * card IS the inquiry for whoever works the queue, so a field omitted here is a
 * field the firm never sees. Empty optionals are dropped rather than sent as empty
 * labels.
 */
function composeLeadMessage({ matterType, urgency, referral, description }) {
  return [
    matterType ? `Nature of matter: ${matterType}` : "",
    urgency    ? `Timing: ${urgency}` : "",
    referral   ? `Heard about the firm: ${referral}` : "",
    description ? `\n${description}` : "",
  ].filter(Boolean).join("\n");
}

/** Collapse whitespace, trim, cap. Same treatment take_message gives free text. */
function clean(v, max) {
  return String(v ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

/**
 * Trim and cap while KEEPING paragraph structure.
 *
 * Line endings are normalised (a browser posts CRLF from a <textarea>), runs of
 * blank lines are collapsed to one so a pasted document cannot pad the note out,
 * horizontal whitespace inside a line is collapsed, and every other C0 control
 * character is dropped — the note detail is rendered in Clio's UI and a stray
 * control byte has no business travelling there. What survives is the writer's own
 * paragraphs.
 */
function cleanMultiline(v, max) {
  return String(v ?? "")
    .replace(/\r\n?/g, "\n")
    // C0 controls and DEL, minus the newline the line above just normalised.
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/[^\S\n]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n").map((line) => line.trim()).join("\n")
    .trim()
    .slice(0, max);
}

function jsonOk(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function jsonError(status, message, code, extra) {
  return new Response(JSON.stringify({ error: message, code: code ?? String(status) }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(extra || {}) },
  });
}
