// ── Clio Grow Lead Inbox push ─────────────────────────────────────────────────
//
// A booking creates a LEAD in Clio Grow (the firm's intake pipeline — the
// "Leads → For review" queue) via the Lead Inbox API. This is separate from
// Clio Manage: Grow holds prospects (interested, not yet signed); Manage holds
// the calendar + signed clients. So a consult booker → Grow lead, and the
// appointment itself → Manage calendar (handled by provider-clio).
//
// Auth is a simple account "Lead capture token" (GROW_LEAD_TOKEN) — no OAuth.
// Docs: https://docs.developers.clio.com/guides/clio-grow/lead-inbox-api/
//
// Best-effort by contract: the caller must treat a failure here as NON-fatal —
// a confirmed appointment must never fail because the Grow push did.
//
// SHELDON-LEAD-REDIRECT (#143). This call is NOT followed across a redirect. The
// credential here is not a header at all — `inbox_lead_token` is a field in the
// JSON BODY — and a 307 or 308 preserves method and body verbatim, so the firm's
// Grow lead-capture token and the caller's name, email and phone would all be
// re-POSTed to whatever host the Location named. Header stripping is no defence
// against a credential that is not in a header. See redirect-refusal.js.

import { redirectRefusal } from "./redirect-refusal.js";

// US region. EU/CA/AU firms would use eu./ca./au.grow.clio.com — override via
// GROW_BASE if a client is not in the US. GROW_BASE is operator configuration, so
// it chooses the ORIGIN we are willing to talk to; the refusal below is about the
// hop nobody configured. All four regional hosts were probed at branch time and
// none answers a 3xx (see the PR body).
const DEFAULT_GROW_BASE = "https://grow.clio.com";

/**
 * @param {object} env  - context.env (reads GROW_LEAD_TOKEN, optional GROW_BASE)
 * @param {{ name:string, email:string, phone:string, notes:string,
 *           slotISO:string, referringUrl:string }} lead
 * @returns {Promise<{ok:boolean, status?:number, skipped?:string, error?:string}>}
 */
export async function createGrowLead(env, lead) {
  const token = env?.GROW_LEAD_TOKEN;
  if (!token) return { ok: false, skipped: "no_token" };

  const base = env?.GROW_BASE || DEFAULT_GROW_BASE;

  // Split the full name into first/last (both required by Grow).
  const parts = String(lead?.name ?? "").trim().split(/\s+/).filter(Boolean);
  const from_first = parts[0] || "(unknown)";
  const from_last = parts.slice(1).join(" ") || "(unknown)";

  // from_message is required. Prefer the caller's brief description; otherwise
  // synthesize one from the booking so the lead is never empty.
  const slotText = fmtSlot(lead?.slotISO);
  const from_message =
    (lead?.notes && lead.notes.trim())
      ? lead.notes.trim()
      : `Consultation requested via website${slotText ? ` — ${slotText}` : ""}.`;

  const body = {
    inbox_lead_token: token,
    inbox_lead: {
      from_first,
      from_last,
      ...(lead?.email ? { from_email: lead.email } : {}),
      ...(lead?.phone ? { from_phone: lead.phone } : {}),
      from_message,
      // Both required. Fall back to a stable value when the header is absent.
      referring_url: lead?.referringUrl || "https://donovan.law/book",
      // Channel label for the Grow lead card. Defaults to the website booking;
      // the phone "take a message" path overrides it (e.g. "Donovan Phone — Paula").
      from_source: lead?.source || "Donovan Website — Perch Booking",
    },
  };

  // Held in a const so the refusal below can resolve a relative Location against
  // it. UNLIKE the Vantage URL, this one carries no PII — Grow takes everything in
  // the body — so it is safe as a resolution base. It is still never logged.
  const url = `${base}/inbox_leads`;

  try {
    // NEVER log the body — contains PII + the token.
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify(body),
      // NOT FOLLOWED (#143). A 307/308 re-POSTs this body — `inbox_lead_token`
      // plus the caller's name, email and phone — to the Location's host. There is
      // no header for a runtime to strip, so refusing the hop is the whole control.
      redirect: "manual",
    });

    // WHICH DIRECTION THIS FAILS, both at once and on purpose:
    //   · FAIL-CLOSED on egress. No hop is issued, so neither the lead-capture
    //     token nor the lead's PII reaches the redirect target.
    //   · FAIL-OPEN on the booking. Returned in the SAME `{ ok:false }` shape a
    //     Grow 5xx already produces — not thrown — so both callers keep the
    //     behaviour they were written for: create.js logs `grow_lead not created`
    //     and still answers 201 for a confirmed appointment, and take_message.js
    //     (fire-and-forget under waitUntil) still answers the caller. The lead is
    //     lost from the Grow queue, exactly as it is when Grow is down.
    //
    // AND WHAT THAT LINE SAYS — create.js prints `${g.status ?? g.error ?? g.skipped}`
    // and `??` stops at the first non-nullish value, so with `status` set it prints
    // the NUMBER alone: `grow_lead not created: 307`. The host is named only by the
    // warn on the next line, from this module.
    const refusal = redirectRefusal(res, url, "grow /inbox_leads");
    if (refusal) {
      console.warn(`[grow-lead] ${refusal}`);
      return { ok: false, status: res.status, error: refusal };
    }

    return { ok: res.ok, status: res.status };
  } catch (e) {
    return { ok: false, error: String(e?.message ?? e) };
  }
}

// Friendly "Mon, Jul 13 at 10:00 AM" for the synthesized message. Best-effort.
function fmtSlot(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: "America/New_York",
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", hour12: true,
    }).format(d) + " ET";
  } catch (_) {
    return "";
  }
}
