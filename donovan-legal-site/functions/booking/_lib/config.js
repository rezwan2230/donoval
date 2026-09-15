// ── Donovan Legal — single-tenant booking config ──────────────────────────────
//
// This file replaces the Firestore deployment-doc lookup used in the Vantage
// multi-tenant harness.  The site is single-tenant; config lives here as a
// constant and is resolved at request time.
//
// Secret references follow the _env convention from provider.js:
//   cfg.client_id_env = "CLIO_CLIENT_ID"
// The route handlers resolve actual values via resolveSecret(cfg, key, context.env).
//
// calendar_id: 9151718 is Elroy's sandbox UserCalendar used for development.
// SWAP TO PAUL'S calendar_id at production consent.

/** @type {{ provider: string, config: object }} */
export const DONOVAN_BOOKING_CFG = {
  provider: "clio-manage",
  config: {
    // ── Secret references (resolved from context.env at runtime) ──────────
    client_id_env:      "CLIO_CLIENT_ID",
    client_secret_env:  "CLIO_CLIENT_SECRET",
    refresh_token_env:  "CLIO_REFRESH_TOKEN",

    // ── Non-secret calendar identifier ─────────────────────────────────────
    // Default is Elroy's sandbox calendar. In production this is overridden by
    // the CLIO_CALENDAR_ID env var (set in the Cloudflare dashboard) — see
    // resolveConfig below — so swapping to a firm's calendar is a dashboard
    // change, not a code edit.
    calendar_id: 9151718,

    // ── Availability window ────────────────────────────────────────────────
    tz:             "America/New_York",
    business_days:  [1, 2, 3, 4, 5], // Mon–Fri
    start_hour:     9,                // 9 AM ET
    // 10 PM ET. This is the END of the window, not the last start time: a slot is
    // only offered if it ENDS at or before this hour, so with slot_min 30 the last
    // bookable consult begins 9:30 PM and finishes at 10. Evening availability is
    // deliberate — the qualifier and the calendar entry are automatic, so a booking
    // taken at 9 PM costs nothing to capture and is a prospect who would otherwise
    // have found a firm that answers after five.
    end_hour:       22,
    slot_min:       30,               // 30-minute consults (per Wendy)
    buffer_min:     0,
    days_ahead:     14,

    // ── Appointment types (Clio has no native types API) ──────────────────
    appointment_types: [
      { id: "consult", name: "Initial Consultation", duration_min: 30 },
    ],

    // ── Client-facing calendar-entry content ───────────────────────────────
    // These three values are the ONLY things that reach the calendar entry
    // description, and the description is what Clio renders verbatim into the
    // attendee's confirmation email and .ics (SHELDON-CLIO-CONFIRM-EMAIL). They
    // are firm-configured constants, never anything a caller typed.
    //
    // meeting_link is deliberately EMPTY by default and is set per-environment
    // via BOOKING_MEETING_LINK (dashboard change, not a code edit — same pattern
    // as CLIO_CALENDAR_ID above).
    //
    // EMPTY IS NOW A CHOICE, NOT AN ABSENCE (SHELDON-CLIO-DYNAMIC-ZOOM). Unset ⇒
    // the calendar entry asks Clio to mint a unique Zoom meeting for that booking
    // and Clio fills `location` itself; the description still carries no join line,
    // because the URL does not exist until Clio answers and Clio's own invite and
    // .ics carry it. SET ⇒ that value is the firm's static room: it rides
    // `location`, no meeting is minted, and the description links it. That is the
    // fallback for the two cases Clio returns no meeting on — an ineligible
    // pricing tier, or no Zoom connected to the account.
    meeting_link: "",
    // Already public on 89 and 85 pages of this site respectively, so putting them
    // in an outbound email discloses nothing new.
    firm_phone: "(561) 666-6022",
    firm_email: "info@donovan.law",
  },
};

/**
 * Apply the per-environment overrides that are not secrets: the meeting link the
 * confirmation email points at. Kept in one place so the mock and Clio branches of
 * resolveConfig cannot drift — a demo that renders a different description than
 * production is a description nobody has actually reviewed.
 */
function withEnvOverrides(config, env) {
  const link = String(env?.BOOKING_MEETING_LINK ?? "").trim();
  return link ? { ...config, meeting_link: link } : config;
}

/**
 * Resolve the booking config for the current request.
 *
 * If context.env.BOOKING_PROVIDER === "mock", returns the mock provider config
 * instead of Clio — kill-switch for demos that don't have live Clio credentials.
 *
 * @param {object} env  - context.env
 * @returns {{ provider: string, config: object }}
 */
export function resolveConfig(env) {
  if (env?.BOOKING_PROVIDER === "mock") {
    return {
      provider: "mock",
      config: withEnvOverrides({
        tz: "America/New_York",
        business_days: [1, 2, 3, 4, 5],
        start_hour: 9,
        // Mirrors the live window above. The mock exists so preview exercises the
        // same shape of day the real provider will; a preview that stopped at five
        // would not surface an evening-slot bug until production did.
        end_hour: 22,
        slot_min: 60,
        buffer_min: 0,
        days_ahead: 14,
        appointment_types: [
          { id: "consult", name: "Initial Consultation", duration_min: 60 },
        ],
        meeting_link: "",
        firm_phone: DONOVAN_BOOKING_CFG.config.firm_phone,
        firm_email: DONOVAN_BOOKING_CFG.config.firm_email,
      }, env),
    };
  }
  // Onboarding a firm's calendar is a dashboard change, not a code edit: if
  // CLIO_CALENDAR_ID is set in the environment, it overrides the default.
  const calId = env?.CLIO_CALENDAR_ID;
  if (calId != null && String(calId).trim() !== "") {
    return {
      ...DONOVAN_BOOKING_CFG,
      config: withEnvOverrides(
        { ...DONOVAN_BOOKING_CFG.config, calendar_id: Number(calId) },
        env,
      ),
    };
  }
  // FAIL CLOSED. There is no safe default calendar. The old fallthrough returned
  // DONOVAN_BOOKING_CFG, whose default calendar_id is Elroy's sandbox (9151718) —
  // so a forgotten CLIO_CALENDAR_ID silently booked real clients into a sandbox
  // nobody watches. Neither the mock kill-switch nor a real calendar id is set,
  // so refuse rather than fall back to the sandbox. The route layer maps this to
  // a 503 (see create.js onRequestPost), matching the Turnstile fail-closed shape.
  const err = new Error(
    "booking calendar is not configured: set CLIO_CALENDAR_ID, or BOOKING_PROVIDER=mock for demos",
  );
  err.code = "MISSING_CALENDAR_CONFIG";
  throw err;
}

/**
 * Resolve the config for a CONTACT write — a contact inquiry from /contact, which
 * creates or reuses a Clio Manage contact and files a note on it.
 *
 * SEPARATE FROM resolveConfig BECAUSE THE CALENDAR IS NOT ITS BUSINESS, and that
 * distinction is load-bearing rather than tidiness. resolveConfig fails closed on a
 * missing CLIO_CALENDAR_ID, which is exactly right for a booking — there is no safe
 * default calendar and the sandbox fallback was a real defect. Reusing it here would
 * have coupled the contact form to a variable it never reads: an unset
 * CLIO_CALENDAR_ID would 503 every inquiry, and the firm would lose the leads while
 * the only broken thing was a calendar nobody was booking into. Contacts and notes
 * need the OAuth secrets and nothing else.
 *
 * BOOKING_PROVIDER=mock is still honoured, and for the same reason it exists on the
 * booking path: a demo deployment must not write into the firm's REAL Clio account.
 * The route layer treats "mock" as "record nothing in Manage" — see fn/contact.js.
 *
 * @param {object} env  - context.env
 * @returns {{ provider: string, config: object }}
 */
export function resolveContactConfig(env) {
  if (env?.BOOKING_PROVIDER === "mock") {
    return { provider: "mock", config: {} };
  }
  return {
    provider: DONOVAN_BOOKING_CFG.provider,
    config: DONOVAN_BOOKING_CFG.config,
  };
}

/**
 * Return the correct adapter module for the given provider key.
 * Throws on unknown provider (maps to 400 UNKNOWN_PROVIDER at the route layer).
 *
 * @param {string} provider
 * @returns {object}  adapter with { listAppointmentTypes, getAvailability, createBooking }
 */
export async function getAdapter(provider) {
  if (provider === "clio-manage") {
    return await import("./provider-clio.js");
  }
  if (provider === "mock") {
    return await import("./provider-mock.js");
  }
  throw new Error(`Unknown booking provider: "${provider}"`);
}
