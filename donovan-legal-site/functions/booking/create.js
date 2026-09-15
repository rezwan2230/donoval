// ── POST /booking/create ───────────────────────────────────────────────────────
//
// Creates a booking via the configured provider (Clio or mock), mirrors a
// summary to the PERCH_ACTIONS KV namespace, and returns the confirmation.
//
// This endpoint writes to the firm's REAL Clio calendar. Every check below the
// parse step runs BEFORE that write and every one of them fails closed.
//
// Flow:
//   1. Rate-limit check (per-isolate in-memory, per CF-Connecting-IP)
//   2. Input validation (type, slot, name, email, phone)
//   3. Appointment type must be on the adapter's allow-list  → 400
//   4. Turnstile verify — unset secret refuses, never falls open → 503/403
//   5. Idempotency key check (KV lookup — same key → replay cached result)
//   5b. Bind `call_id` to a server-side qualifier record before anything joins to
//      it (#57), from the body OR — when the call is already over and the page's
//      in-memory key is gone with it — from the server-set qualifier cookie (#153).
//      Unconfirmed ⇒ the booking proceeds with NO qualifier context.
//   6. Availability re-check for the exact slot                → 409
//   7. Call adapter.createBooking()
//   8. Mirror booking summary to PERCH_ACTIONS KV (207 semantics — KV failure
//      does NOT fail the response; provider-confirmed = success)
//   9. Return 201 { ok, booking_id, provider_ref, confirmed }
//
// Response shapes:
//   201  { ok: true, booking_id, provider_ref, confirmed: true }
//   207  { ok: false, provider_ref, confirmed, error, code: "PARTIAL_FAILURE" }
//         — provider confirmed but KV mirror write failed
//   400  { error, code: "VALIDATION_ERROR" }   — includes an unknown `type`
//   403  { error, code: "TURNSTILE_REQUIRED" | "TURNSTILE_FAILED" }
//   409  { error, code: "SLOT_TAKEN" }         — slot went busy after selection
//   429  { error, code: "RATE_LIMITED" }
//   502  { error, code: "PROVIDER_ERROR" }
//   503  { error, code: "TURNSTILE_NOT_CONFIGURED" | "TURNSTILE_UNAVAILABLE" }
//
// DEPLOY REQUIREMENT: TURNSTILE_SECRET_KEY must be set on BOTH the Production and
// Preview Pages environments. Unset ⇒ this endpoint returns 503 for every booking.
// That is deliberate (an unverified write to a real calendar is worse than an
// outage), but it means the secret has to land with — or before — this code.
//
// No CORS handling: same-origin (widget and functions share the Pages origin).
// The vantage source handled CORS because the widget called a cross-origin
// Vantage service.  With both on the same Pages deployment that distinction
// is gone, so all Access-Control-Allow-* and OPTIONS handling is dropped.
//
// Rate limiting: per-isolate in-memory Map (10 requests/minute/IP).
// Per-isolate limiting is best-effort — Cloudflare's worker infrastructure may
// route the same IP to different isolates under load, so this is a best-effort
// guard, not a hard cap.  Cloudflare's own DDoS mitigation and the Clio API's
// own rate limiting are the real backstops for abuse at scale.

import { resolveConfig, getAdapter } from "./_lib/config.js";
import { createGrowLead } from "./_lib/grow-lead.js";
import { resolveQualifierBinding, QUALIFIER_JOIN } from "./_lib/qualifier-bind.js";
// The allow-list itself, so "everything was omitted" can be recognised as total
// loss rather than counted against a number written down here and left to drift.
import { SELF_REPORTED_KEYS } from "./_lib/intake-policy.js";
import { readQualifierCookie, clearQualifierCookie, claimsNothing } from "../_lib/qualifier-cookie.js";
import { verifyTurnstile } from "../_lib/abuse.js";
// The index key, built in ONE place and imported by the post-call reader too, so
// the producer and the consumer cannot drift apart into a silent miss.
import { conversionValue, VALUE_CURRENCY } from "../_lib/conversion-value.js";
import { sendConversion, buildUserData, readFbCookies, capiEnabled, bookingEventId } from "../_lib/meta-capi.js";

const DEPLOYMENT = "donovan-main";


// ── Per-isolate rate limiter ──────────────────────────────────────────────────
// Map<ip, { count, windowStart }>
const _rateLimitStore = new Map();
const RATE_LIMIT_MAX = 10;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute

function checkRateLimit(ip) {
  const now = Date.now();
  const key = ip || "unknown";
  const entry = _rateLimitStore.get(key);

  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    _rateLimitStore.set(key, { count: 1, windowStart: now });
    return true; // allowed
  }
  if (entry.count >= RATE_LIMIT_MAX) {
    return false; // blocked
  }
  entry.count++;
  return true;
}

// ── Idempotency cache (per-isolate) ──────────────────────────────────────────
// For long-lived idempotency guarantees across isolate restarts, the KV store is
// the source of truth (see step 3 in the flow above). This in-memory cache is a
// fast path for repeated requests within the same isolate lifetime.
const _idempCache = new Map();

/**
 * @param {import("@cloudflare/workers-types").EventContext} context
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  // ── Rate limit ───────────────────────────────────────────────────────────
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  if (!checkRateLimit(ip)) {
    console.warn(`[booking/create] RATE_LIMITED ip=${ip}`);
    return jsonError(429, "rate_limit_exceeded", "RATE_LIMITED");
  }

  // ── Parse body ───────────────────────────────────────────────────────────
  let b = {};
  try {
    b = await request.json();
  } catch (_) {
    return jsonError(400, "request body must be JSON", "VALIDATION_ERROR");
  }

  // ── Input validation ─────────────────────────────────────────────────────
  const typeId  = clampStr(b.type,  60).trim();
  const slotISO = clampStr(b.slot,  64).trim();
  const name    = clampStr(b.name,  120).trim();
  const email   = clampStr(b.email, 200).trim().toLowerCase();
  const phone   = clampStr(b.phone, 40).trim();
  const notes   = clampStr(b.notes, 500).trim();
  // Optional: the Perch voice-call id, threaded from the shell so we can fold the
  // caller's qualifier answers into the booking record server-side (see below).
  const callId  = clampStr(b.call_id, 128).trim();
  // Optional: the browser's explicit statement that this booking claims NO
  // qualifier record. Clamped hard — it is a one-word enum, never an identifier,
  // and nothing downstream ever echoes it. See the cookie fallback below.
  const qualClaim = clampStr(b.qualifier_claim, 32).trim();
  // Cloudflare Turnstile token (bot mitigation). Verified below, gated on the secret.
  const turnstileToken = clampStr(b.turnstile_token, 4096).trim();

  const errors = [];
  if (!typeId) errors.push("type is required");
  if (!slotISO) errors.push("slot is required");
  if (!name) errors.push("name is required");
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) errors.push("valid email is required");
  if (!phone) errors.push("phone is required");

  const slotMs = Date.parse(slotISO);
  if (!slotISO || isNaN(slotMs)) {
    errors.push("slot must be a valid ISO-8601 date-time");
  } else if (slotMs < Date.now() - 60_000) {
    errors.push("slot must be in the future");
  } else if (slotMs > Date.now() + 365 * 86400_000) {
    errors.push("slot must be within 1 year");
  }

  if (errors.length) {
    return jsonError(400, errors.join("; "), "VALIDATION_ERROR");
  }

  // ── Resolve provider ──────────────────────────────────────────────────────
  // Hoisted above the type allow-list and the availability re-check, both of
  // which need the adapter. Nothing here writes.
  //
  // resolveConfig FAILS CLOSED: if neither BOOKING_PROVIDER=mock nor
  // CLIO_CALENDAR_ID is set it throws MISSING_CALENDAR_CONFIG rather than falling
  // back to the sandbox default calendar. Refuse the write with a 503 — an
  // unconfigured calendar is worse than an outage, same posture as Turnstile.
  let cfg;
  try {
    cfg = resolveConfig(env);
  } catch (e) {
    if (e?.code === "MISSING_CALENDAR_CONFIG") {
      console.error("[booking/create] MISSING_CALENDAR_CONFIG — refusing booking");
      return jsonError(503, "booking_not_configured", "MISSING_CALENDAR_CONFIG");
    }
    throw e;
  }

  let adapter;
  try {
    adapter = await getAdapter(cfg.provider);
  } catch (e) {
    console.error(`[booking/create] UNKNOWN_PROVIDER provider=${cfg.provider} err=${String(e?.message ?? e)}`);
    return jsonError(400, "unknown_provider", "UNKNOWN_PROVIDER");
  }

  // ── Appointment type allow-list (Sarah D3) ────────────────────────────────
  // `type` was previously checked for non-emptiness only, so ANY string booked —
  // it flows into the Clio calendar entry summary, and a distinct value also
  // defeats the `email|slot|type` idempotency key, which is how the same slot got
  // double-booked during the preview gate. The allow-list is the SAME list the
  // adapter serves from GET /booking/types, so there is one source of truth and a
  // type that is bookable is by construction a type a client could have offered.
  let allowedTypes;
  try {
    allowedTypes = await adapter.listAppointmentTypes(cfg.config);
  } catch (e) {
    console.error(`[booking/create] TYPE_LOOKUP_FAIL provider=${cfg.provider} err=${String(e?.message ?? e)}`);
    return jsonError(502, "booking_provider_unavailable", "PROVIDER_ERROR");
  }

  const matchedType = (allowedTypes ?? []).find((t) => String(t.id) === typeId);
  if (!matchedType) {
    // Log the rejected value (an id from a fixed list is not PII) so an enumeration
    // attempt is visible; the response never echoes it back.
    console.warn(`[booking/create] UNKNOWN_TYPE typeId=${typeId}`);
    return jsonError(400, "unknown appointment type", "VALIDATION_ERROR");
  }

  // ── Cloudflare Turnstile (bot mitigation) ──────────────────────────────────
  // FAIL CLOSED, including on an unset secret. This used to read a secret named
  // TURNSTILE_SECRET (no other file in the tree used that name) behind an
  // `if (secret)` guard, so the endpoint that writes to Paul's REAL calendar was
  // unprotected whenever the secret was absent or misspelled — the "unset means
  // DISABLED" shape that tier-auth.js and _lib/abuse.js already refuse. Shared
  // implementation, one secret name: TURNSTILE_SECRET_KEY.
  const ts = await verifyTurnstile(turnstileToken, request, env, "booking/create");
  if (!ts.ok) {
    return jsonError(ts.status, ts.status === 503 ? "verification_unavailable" : "verification_failed", {
      turnstile_not_configured: "TURNSTILE_NOT_CONFIGURED",
      turnstile_missing:        "TURNSTILE_REQUIRED",
      turnstile_failed:         "TURNSTILE_FAILED",
      turnstile_error:          "TURNSTILE_UNAVAILABLE",
    }[ts.reason] ?? "TURNSTILE_FAILED");
  }

  // ── Idempotency key ───────────────────────────────────────────────────────
  // Header: Idempotency-Key (optional). Check in-memory cache first, then KV.
  // On hit: replay the cached result without calling the provider again.
  const idempKey = clampStr(request.headers.get("idempotency-key") ?? "", 128).trim();

  if (idempKey) {
    // Fast path: in-memory cache (same isolate, within lifetime)
    const cached = _idempCache.get(`${DEPLOYMENT}:${idempKey}`);
    if (cached) {
      console.log(`[booking/create] idempotent (memory) key=${idempKey}`);
      return jsonOk(201, { ...cached, idempotent: true });
    }
    // Slow path: KV lookup
    if (env?.PERCH_ACTIONS) {
      try {
        const kvRaw = await env.PERCH_ACTIONS.get(`booking-idemp:${idempKey}`);
        if (kvRaw) {
          const kvData = JSON.parse(kvRaw);
          console.log(`[booking/create] idempotent (KV) key=${idempKey}`);
          _idempCache.set(`${DEPLOYMENT}:${idempKey}`, kvData); // warm in-memory cache
          return jsonOk(201, { ...kvData, idempotent: true });
        }
      } catch (_) {
        // Non-fatal: proceed without idempotency check rather than blocking.
      }
    }
  }

  // ── Bind the call_id to a server-side qualifier record (SHELDON-A32, #57) ──
  // If this booking is tied to a Perch voice call, the caller's tap-through
  // answers were stored server-side by fn/qualifier_submit — in the PERCH_BRIDGE
  // DO slot `qual:<callId>` and in the durable KV copy `qualbk:<callId>`. The
  // submitted call_id is checked against those records BEFORE anything is joined
  // to it: Sarah's A4.1 gate found this value was read from the body and trusted,
  // so the join was only as trustworthy as the browser that claimed it (#57).
  //
  // Confirmed ⇒ the plain-English summary reaches Paul and Wendy, and the id is
  // allowed to serve as the Vantage merge key. Where it reaches Paul CHANGED in
  // SHELDON-CLIO-CONFIRM-EMAIL: it used to be appended to the Clio calendar
  // description, which is now emailed verbatim to the client, so it goes to a Note
  // on the Clio contact instead. `enrichedNotes` below still carries it to Grow and
  // Vantage — both attorney-side — exactly as before.
  // Not confirmed ⇒ the booking still completes, with the plain notes and NO merge
  // key, so a forged id opens a fresh Vantage lead instead of folding this booking
  // into a call session the server cannot vouch for. See _lib/qualifier-bind.js —
  // it never throws, and every store failure resolves to "not verified".
  //
  // ── SHELDON-QUALIFIER-BOOKING-JOIN (#153): TWO PLACES THE KEY CAN ARRIVE ────
  // The body value is the live-call path and is unchanged. The cookie is the path
  // for a booking completed AFTER the call ended, which is the case that was
  // losing every Intake field on a Clio integration that was otherwise correct.
  //
  // WHY THE BODY KEY GOES MISSING. `js/booking-widget.js` reads it from exactly
  // one place — `window.__perchCallId`, a JS global written by the live command
  // channel (js/perch/booking-control.js) and by nothing else. It is stored
  // nowhere, so it lives only as long as the document that hosted the call. The
  // unlock flag it travels with IS persisted (localStorage, set in the same
  // navigate branch of js/perch/command-channel.js), which is how a caller reaches
  // a fully unlocked /book page carrying no idea which call unlocked it. The
  // qualifier record itself was never lost: `qualbk:<call_id>` holds a 6h TTL and
  // qualifier-bind.js confirms on that copy alone.
  //
  // ORDER IS THE POLICY. The body wins when it verifies, because it is the live
  // call this document is actually part of; the cookie is consulted only when the
  // body produced no join, so a browser carrying a stale cookie can never displace
  // the call in front of it. The cookie is not trusted any more than the body was:
  // both go through the SAME resolveQualifierBinding against records only the
  // server writes, and a fabricated value in either resolves `unverified`,
  // attaches nothing, and never becomes a Vantage merge key.
  //
  // ── SHELDON-QUALIFIER-JOIN-COMPOSE (#153 + #158): AND ONE THAT MUST NOT ─────
  // The fallback above is right for a booking that LOST its key and wrong for one
  // that never had a key to lose, and until the browser said so the two were the
  // same request. Both arrive with an empty `call_id` and a live `dl_qual` cookie:
  //
  //   the case the cookie EXISTS for   — qualified on a call or in an earlier tab,
  //                                       booking now; page memory is gone
  //   the case it must NOT serve       — opened the qualifier card, ABANDONED it,
  //                                       and booked; nothing was ever submitted
  //
  // The second is `js/perch-layer.js`'s `abandonAfterQualifier`, which promises the
  // booking "travels the ordinary no-`call_id` route (`join: 'none'`)". That is a
  // true statement about the BODY and a false one about the outcome, because this
  // function then supplied a key the browser deliberately withheld. On a shared
  // browser inside the 6h window that is the PREVIOUS visitor's key: their income
  // band, net worth band, matter, language and source onto this client's Clio
  // contact, their state as this client's address, their summary on the note and
  // the Grow lead, their id as the Vantage merge key — and the join recorded
  // `attached`, so nothing signalled it. sessionStorage is per tab; the cookie is
  // per browser. Only the browser can tell the two apart, so it tells us.
  //
  // The marker WITHHOLDS AND NOTHING ELSE. It is not believed the way the join key
  // is not believed — it does not need to be, because there is no value of it that
  // attaches anything to anyone. Forging it costs the forger their own enrichment.
  // Absence of it means what it has always meant, so #153's post-call booking is
  // untouched: this is an explicit opt-out, never an opt-in a silent client fails.
  const noClaim = claimsNothing(qualClaim);

  const cookieCallId = readQualifierCookie(request);
  let qual = await resolveQualifierBinding(env, callId);
  let joinKey = qual.verified ? callId : "";
  let keySource = qual.verified ? "body" : "";

  if (!noClaim && !qual.verified && cookieCallId && cookieCallId !== callId) {
    const viaCookie = await resolveQualifierBinding(env, cookieCallId);
    if (viaCookie.verified) {
      // A body id that was submitted and did NOT verify is still worth recording as
      // a refusal — it is the forged-id signal #57 added. Keeping it means the log
      // line below reports "we refused what was claimed AND recovered the real one"
      // rather than overwriting the first fact with the second.
      if (qual.join === QUALIFIER_JOIN.UNVERIFIED) {
        console.warn("[booking/create] body call_id unverified — recovered the join from the qualifier cookie");
      }
      qual = viaCookie;
      joinKey = cookieCallId;
      keySource = "cookie";
    }
  }

  const enrichedNotes = qual.summary ? [notes, qual.summary].filter(Boolean).join("\n\n") : notes;
  // Merge key for Vantage — the verified id only, whichever carrier it arrived on.
  // "" reaches upsertVantageLead as a falsy callId, which is the documented
  // no-call_id path (fresh lead, nothing typed is dropped); no change to that
  // function's contract or write shape.
  const mergeCallId = joinKey;

  // Recorded so the join is auditable rather than inferred. The call_id itself is
  // NEVER logged — neither the body's nor the cookie's: fn/qualifier_result.js
  // documents it as a bearer capability, and a log line is one more place it can
  // leak from. Presence, carrier and outcome only.
  console.log(
    `[booking/create] qualifier_join=${qual.join}` +
    (qual.source ? ` source=${qual.source}` : "") +
    (keySource ? ` key_source=${keySource}` : "") +
    ` call_id_present=${callId ? "yes" : "no"}` +
    ` cookie_present=${cookieCallId ? "yes" : "no"}` +
    // The marker is logged as a BOOLEAN, never echoed. A `claims_nothing=yes` beside
    // a `cookie_present=yes` is the composition case being refused, and it is the
    // only line that distinguishes "no cookie was there" from "a cookie was there
    // and we declined it" — without it the fix and the absence of the bug it fixes
    // read identically in production.
    ` claims_nothing=${noClaim ? "yes" : "no"}`,
  );

  // What the write policy dropped, by FIELD NAME ONLY (#153 tasks 3 and 4 —
  // _lib/intake-policy.js). `omitted` is the ordinary partial qualifier and is not
  // a problem; `placeholders` and `rejected` are, and they are the two that were
  // invisible before. A booking whose state arrives as `address 1` now says so here
  // instead of writing it to a client record. Values are never logged: they are the
  // client's finances.
  const pol = qual.policy;
  if (pol?.placeholders?.length || pol?.rejected?.length) {
    console.warn(
      "[booking/create] intake not written" +
      (pol.placeholders.length ? ` placeholder=${pol.placeholders.join(",")}` : "") +
      (pol.rejected.length ? ` not_self_reported=${pol.rejected.join(",")}` : ""),
    );
  }

  // TOTAL LOSS, TOLD APART FROM AN ORDINARY PARTIAL (#154 task 4, path 1).
  //
  // The branch above deliberately treats `omitted` as unremarkable, and for one or
  // two absent answers it is. But `omitted` covering the WHOLE allow-list is a
  // different fact: the qualifier record was found and read, and it carried no
  // usable answer at all, so `qual.intake` is `{}` and the Clio contact will get
  // ZERO custom fields. That is the live symptom, and today it logs nothing —
  // it is not a placeholder and not a rejection, so neither arm above fires, and
  // one missing answer and seven missing answers were the same silence.
  //
  // Length equality IS set equality here: intake-policy.js builds `omitted` by
  // walking SELF_REPORTED_KEYS and pushing each key at most once, so covering the
  // count covers the set. A withheld or absent binding gives `omitted: []`, which
  // is length 0 and correctly does not fire — "no qualifier" is a fifth path and
  // is not this one.
  //
  // Names only. These arrays exist to be logged precisely because they carry no
  // values (see intake-policy.js).
  if (pol?.omitted?.length === SELF_REPORTED_KEYS.length) {
    console.warn(
      "[booking/create] intake empty — zero custom fields will be written" +
      ` absent=${pol.omitted.join(",")}`,
    );
  }

  // ── Re-check availability immediately before the write (Sarah D4) ─────────
  // The slot the caller picked was free when /booking/availability rendered the
  // grid, which may have been minutes ago. Without this, two callers racing for
  // the last slot both got a 201 and Paul got two overlapping appointments.
  //
  // This narrows the race to the window between this read and the POST below; it
  // does NOT close it (Clio exposes no conditional-create), so this is a
  // last-writer check, not a lock.
  //
  // THE WINDOW IS NOT MILLISECONDS WIDE, and calling it that was wrong from the day
  // the contact path landed (SHELDON-CLIO-CONTACT-MAPPING). Between this read and
  // the POST, adapter.createBooking makes FOUR SEQUENTIAL CLIO ROUND TRIPS on the
  // new-contact path — GET /contacts (search), GET /custom_fields (id resolution),
  // POST /contacts, PATCH /contacts/{id} (enrichment) — and THREE on the returning-
  // contact path, where the create drops out. None of it is parallel; each one waits
  // for the one before it. Two can drop out: the custom-field list is cached per
  // isolate, so only the first booking an isolate serves pays for it, and the
  // enrichment PATCH is skipped when the diff is empty. Four and three are the
  // populated-intake figures, which is the case the firm actually books.
  //
  // And each of those round trips can retry once: clioFetch retries a 429 or a 5xx
  // after sleeping min(Retry-After, 10s), so the worst case is ten seconds of
  // deliberate backoff PER ROUND TRIP — call it forty seconds on the new-contact
  // path — before the calendar POST is even attempted. A Clio that is rate-limiting
  // the firm is exactly the condition under which two callers are most likely to be
  // racing, so the window is widest precisely when it matters.
  //
  // That is still narrower than the double-booking Sarah reproduced, which was
  // minutes wide, and it is still the right check. But it is seconds, not
  // milliseconds, and a comment that says otherwise is the reason nobody has
  // prioritised closing it. A hard guarantee needs provider-side support; tracked
  // for Zane.
  //
  // Window = exactly [slot, slot+duration): computeAvailability drops any candidate
  // starting before `from` or ending after `to`, so a free, correctly-aligned slot
  // comes back as the single element and an off-grid slot comes back empty (also a
  // refusal — an off-grid time was never bookable).
  const slotEndISO = new Date(slotMs + matchedType.duration_min * 60_000).toISOString();

  let openSlots;
  try {
    openSlots = await adapter.getAvailability(
      cfg.config,
      { typeId, fromISO: new Date(slotMs).toISOString(), toISO: slotEndISO, tz: cfg.config?.tz },
      env,
    );
  } catch (e) {
    // Could not confirm the slot is free ⇒ do not write. An unverifiable calendar
    // fails closed, exactly like an unreachable Turnstile.
    console.error(`[booking/create] AVAILABILITY_RECHECK_FAIL provider=${cfg.provider} err=${String(e?.message ?? e)}`);
    return jsonError(502, "booking_provider_unavailable", "PROVIDER_ERROR");
  }

  // Compare by epoch, not by string: the caller sends "…T14:00:00Z" while the
  // adapter emits "…T14:00:00.000Z", and those are the same instant.
  const stillFree = (openSlots ?? []).some((s) => Date.parse(s.startISO) === slotMs);
  if (!stillFree) {
    console.warn(`[booking/create] SLOT_TAKEN typeId=${typeId} slot=${slotISO}`);
    // 409 + SLOT_TAKEN is the shape booking-widget.js already branches on: it
    // reloads availability and shows the "that time was just taken" message.
    return jsonError(409, "slot_no_longer_available", "SLOT_TAKEN");
  }

  // ── Call provider ─────────────────────────────────────────────────────────
  let providerResult;
  try {
    // SHELDON-CLIO-CONFIRM-EMAIL: the typed notes and the qualifier summary are
    // passed SEPARATELY and `enrichedNotes` is deliberately NOT passed to the
    // adapter at all. The adapter files both on a Note attached to the Clio
    // contact (attorney-side) and builds the calendar-entry description from
    // firm-configured constants only — the description is now emailed to the
    // client, so a single bundled `notes` argument is the exact shape that would
    // put income_band and net_worth_band in front of the client. Grow, Vantage and
    // the KV record below still receive `enrichedNotes` unchanged; none of them is
    // client-facing.
    //
    // SHELDON-CLIO-CONTACT-MAPPING adds `intake` — the SAME verified qualifier
    // answers as `intakeSummary`, structured instead of prose, so the adapter can
    // write them onto the Clio contact as custom fields and set the contact's
    // address from the caller's state. It travels the identical route: only ever
    // to the contact and the note, never to the description. Note that it is gated
    // on the same binding as the summary — an unverified call_id yields {} here,
    // so a forged id cannot stamp intake answers onto a stranger's contact.
    providerResult = await adapter.createBooking(cfg.config, {
      typeId,
      slotISO,
      contact: { name, email, phone },
      notes,
      intakeSummary: qual.summary,
      intake: { fields: qual.intake, state: qual.state },
    }, env);
  } catch (e) {
    // NEVER log name/email/phone — PII. The adapter's own message (e.g.
    // "clio: POST /calendar_entries failed — HTTP 401") is diagnostic only: it goes
    // to the server log, never to the client. Callers branch on `code`.
    console.error(`[booking/create] PROVIDER_ERROR provider=${cfg.provider} typeId=${typeId} err=${String(e?.message ?? e)}`);
    return jsonError(502, "booking_provider_unavailable", "PROVIDER_ERROR");
  }

  // ── Spend the qualifier record — HERE, not at resolve time (#153) ──────────
  // The appointment exists now. One qualifier record attaches to at most one
  // booking, which is unchanged; WHEN it is spent is not. The clear used to run
  // inside resolveQualifierBinding, ahead of the availability re-check and ahead of
  // this provider call, so a booking that came back 409 SLOT_TAKEN — the caller's
  // slot went while they were filling in the form, which is the single most common
  // non-success on this endpoint — destroyed the qualifier before the caller had
  // booked anything. They then re-picked a time and completed a booking that
  // carried no intake at all: the same silent loss this ticket is about, reached
  // one retry later.
  //
  // Both carriers are spent together. Clearing the KV copy while leaving the cookie
  // armed would hand the next booking on this browser an id whose record is gone —
  // it resolves `unverified`, so nothing is misattached, but the log would report a
  // forged-id refusal for a key the server itself issued.
  //
  // ANY cookie this browser presented is spent, not only one that produced the
  // join. If it joined, it is used up. If it did not, it is a qualifier from an
  // earlier session that this booking has now moved past, and leaving it armed is
  // precisely the shared-browser exposure the module header flags — the next person
  // to book on this machine would inherit it. Neither case has a reason to keep it.
  await qual.consume();
  const spendCookie = !!cookieCallId;

  // ── Push a lead to Clio Grow (best-effort, NON-fatal) ─────────────────────
  // The appointment is already confirmed above; the firm's intake pipeline
  // lives in Grow, so we drop the person into the "For review" leads queue.
  // A Grow failure must never fail a confirmed booking — log and move on.
  if (env?.GROW_LEAD_TOKEN) {
    try {
      const referer = request.headers.get("referer") || "";
      const g = await createGrowLead(env, { name, email, phone, notes: enrichedNotes, slotISO, referringUrl: referer });
      if (!g.ok) console.warn(`[booking/create] grow_lead not created: ${g.status ?? g.error ?? g.skipped}`);
    } catch (e) {
      console.warn(`[booking/create] grow_lead error: ${String(e?.message ?? e)}`);
    }
  }

  // ── The Vantage upsert stood here (SHELDON-BOOKING-VANTAGE, #41) ───────────
  // It mirrored the typed fields to `vantage.ticoai.net/upsert-lead`, keyed on
  // call_id, so the lead dashboard Paula watched showed a full lead rather than a
  // name-only half-lead. Both ends of that are gone: Paula is gone with the voice
  // concierge, and Vantage is severed with the ConnexUS/GCP teardown.
  //
  // Nothing about the booking's OUTCOME changes. The write was best-effort and
  // explicitly non-fatal — wrapped in try/catch, logging a status and continuing —
  // so it never decided whether a booking succeeded. Clio Manage and Clio Grow
  // above are the system of record and are untouched.

  // ── Mirror to PERCH_ACTIONS KV ────────────────────────────────────────────
  // KV write is best-effort: provider-confirmed = success regardless of KV result.
  // If KV write fails we return 207 PARTIAL_FAILURE (same semantics as the
  // Firestore write failure path in the vantage source routes.js).
  //
  // booking_id is the KV key suffix (no Firestore doc id here — KV key IS the id).
  // No notes-PII in KV: only the shape needed for the admin console + callbacks.
  const bookingId = `${Date.now()}-${crypto.randomUUID()}`;

  const kvSummary = {
    booking_id:   bookingId,
    deployment:   DEPLOYMENT,
    provider:     cfg.provider,
    provider_ref: providerResult.provider_ref ?? "",
    confirmed:    providerResult.confirmed,
    type_id:      typeId,
    slot_iso:     slotISO,
    status:       providerResult.confirmed ? "confirmed" : "pending",
    created:      new Date().toISOString(),
    source:       "harness",
    // Minimal contact info for reconciliation — no free-text notes (PII risk).
    // name/email/phone are standard booking record fields, not confidential content.
    name,
    email,
    phone,
    // A32 (#57): whether the Perch qualifier joined this booking, and on what
    // evidence. "attached" = server-confirmed and the answers are on the Clio
    // contact note; "verified_no_summary" = the call is real but no summary text
    // survived; "unverified" = a call_id was submitted and the server could not
    // match it, so nothing was joined; "none" = an ordinary web booking. The raw
    // call_id is deliberately NOT stored — it is a bearer capability, and this
    // record is a back-office audit trail, not a place to park one.
    qualifier_join: qual.join,
    ...(qual.source ? { qualifier_source: qual.source } : {}),
    // #153: WHICH carrier the join key arrived on — "body" (the live-call global)
    // or "cookie" (the durable server-set copy). Still never the id itself. This is
    // the number Paul's answer to "is the Clio join working now?" actually depends
    // on: a fleet of `key_source=cookie` joins is the post-call booking case that
    // used to attach nothing.
    ...(keySource ? { qualifier_key_source: keySource } : {}),
    // COMPOSE-R1: this booking said it claims no qualifier record, and a cookie was
    // in the jar that would otherwise have been believed. Recorded only when it
    // actually changed the outcome, so the field's presence in the back-office
    // record IS the count of cross-visitor joins refused — a number Paul can be
    // given, rather than an absence that could equally mean the path never ran.
    ...(noClaim && cookieCallId ? { qualifier_claim_refused: true } : {}),
    ...(idempKey ? { idempotency_key: idempKey } : {}),
  };

  let kvWriteOk = false;
  if (env?.PERCH_ACTIONS) {
    try {
      // Primary record: booking:<id>
      await env.PERCH_ACTIONS.put(
        `booking:${bookingId}`,
        JSON.stringify(kvSummary),
        { expirationTtl: 60 * 60 * 24 * 90 }, // 90-day TTL; archival to durable store is a prod follow-up
      );
      // Idempotency index: booking-idemp:<key> → booking_id + provider_ref
      if (idempKey) {
        const idempData = {
          ok:           true,
          booking_id:   bookingId,
          provider_ref: providerResult.provider_ref ?? "",
          confirmed:    providerResult.confirmed,
        };
        await env.PERCH_ACTIONS.put(
          `booking-idemp:${idempKey}`,
          JSON.stringify(idempData),
          { expirationTtl: 60 * 60 * 24 }, // 24-hour idempotency window
        );
        _idempCache.set(`${DEPLOYMENT}:${idempKey}`, idempData);
      }
      kvWriteOk = true;
    } catch (kvErr) {
      // KV write failed — log and fall through to 207.
      console.error(`[booking/create] KV_WRITE_FAIL provider=${cfg.provider} err=${String(kvErr?.message ?? kvErr)}`);
    }
  } else {
    // PERCH_ACTIONS binding not present (e.g. local wrangler dev without KV).
    // Treat as if KV is unavailable — return 207 only if provider confirmed.
    // In practice wrangler pages dev --local will hit this path; --remote won't.
    console.warn("[booking/create] PERCH_ACTIONS binding not available — KV mirror skipped");
    kvWriteOk = true; // don't 207 just because KV binding is absent locally
  }

  // ── The call → contact index stood here (SHELDON-CALLMAP-AND-CALLID) ───────
  //
  // It wrote `callmap:<joinKey>` into PERCH_ACTIONS on every server-verified voice
  // booking, holding the Clio contact_id so that POST-CALL ENRICHMENT could find the
  // contact minutes or hours later and patch Retell's after-call analysis onto it.
  //
  // That reader was `readCallmap` in functions/_lib/retell-postcall.js, reached from
  // the /webhooks/retell-postcall route. Both are deleted with the voice concierge,
  // and they were the index's ONLY reader — so what remained here was a KV write, on
  // every booking, that nothing would ever read. Removed rather than left: an entry
  // nobody reads is not a cache, it is litter with a seven-day TTL.
  //
  // Nothing about the booking changes. This was best-effort by construction, had its
  // own try/catch, and deliberately did not feed `kvWriteOk` — a failure here never
  // moved the response. The `booking:` audit record above is untouched and is still
  // what Paul and Wendy read.

  // ── Report the conversion to Meta, server-side (best-effort, NON-fatal) ────
  //
  // Placed here so it covers BOTH remaining exits — the 201 and the 207 where
  // Clio confirmed but our KV mirror did not. A 207 booking is a real booking;
  // the appointment exists in Paul's calendar, so the conversion is real too.
  //
  // It deliberately does NOT cover the idempotent 201 replays earlier in this
  // function. Those are the same booking answered twice, and reporting them
  // twice would inflate the count that sets the bid.
  //
  // NEVER awaited. `waitUntil` hands this to the runtime to finish after the
  // response has already gone back to the caller, so Meta being slow or down
  // costs a booking exactly nothing. The whole block is wrapped anyway: this
  // runs after a confirmed calendar write, and there is no failure here worth
  // turning a successful booking into an error page for.
  if (capiEnabled(env)) {
    const eventId = bookingEventId(callId);
    if (!eventId) {
      // No call_id means no shared key, so the browser pixel's id and ours could
      // not agree and Meta would count the booking twice. Skipping loses a
      // server-side copy of a direct /book visit; sending would corrupt the
      // conversion count that sets the bid. Undercounting is the safer failure.
      console.log("[booking/create] capi skipped: no call_id to deduplicate on");
    } else {
      const value = conversionValue({ tier: qual.tier, matter: qual.matter });
      const send = (async () => {
        try {
          const userData = await buildUserData({
            email, phone, name,
            ip,
            userAgent: request.headers.get("User-Agent") || "",
            ...readFbCookies(request.headers.get("Cookie")),
          });
          await sendConversion(env, {
            eventName: "Schedule",
            eventId,
            eventSourceUrl: request.headers.get("Referer") || "",
            value,
            currency: VALUE_CURRENCY,
            userData,
            // Tier is the reason this event exists. It is a coarse band, not
            // client data, and it is what lets Google and Meta learn which ads
            // produce Reserve-tier principals rather than merely the most
            // bookings.
            customData: { content_name: "consultation", ...(qual.tier ? { tier: qual.tier } : {}) },
          });
        } catch (e) {
          console.warn(`[booking/create] capi error: ${String(e?.message ?? e)}`);
        }
      })();
      if (typeof context.waitUntil === "function") context.waitUntil(send);
    }
  }

  console.log(`[booking/create] ok provider=${cfg.provider} typeId=${typeId} confirmed=${providerResult.confirmed} kvWriteOk=${kvWriteOk}`);

  if (!kvWriteOk) {
    // Provider confirmed the booking but our KV mirror failed — 207 PARTIAL_FAILURE.
    // The widget treats provider-confirmed (even 207) as a success (see booking-widget.js
    // handleFormSubmit: resp.data.confirmed === true → CONFIRMED state).
    return new Response(JSON.stringify({
      ok: false,
      provider_ref: providerResult.provider_ref ?? "",
      confirmed:    providerResult.confirmed,
      error:        "booking_recorded_but_save_failed",
      code:         "PARTIAL_FAILURE",
    }), {
      status: 207,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cookieHeader(spendCookie) },
    });
  }

  return jsonOk(201, {
    ok:           true,
    booking_id:   bookingId,
    provider_ref: providerResult.provider_ref ?? "",
    confirmed:    providerResult.confirmed,
  }, cookieHeader(spendCookie));
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function clampStr(s, max) {
  const str = String(s ?? "");
  return str.length > max ? str.slice(0, max) : str;
}

function jsonOk(status, body, extra) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...(extra || {}) },
  });
}

/**
 * The `Set-Cookie` that spends the qualifier join key, or nothing.
 *
 * ONLY ON A CONFIRMED BOOKING (#153). The two terminal success paths — 201 and the
 * 207 whose provider write succeeded — carry it; every refusal above returns
 * through `jsonError` and deliberately does not. A 409 SLOT_TAKEN or a 502 is a
 * caller who is about to try again, and burning their join key on the way out is
 * how the retry ends up carrying no intake — the same defect as the one this
 * endpoint is being fixed for, spelled with a different verb.
 */
function cookieHeader(spend) {
  return spend ? { "Set-Cookie": clearQualifierCookie() } : {};
}

// Client-facing errors carry a stable `code` and a generic `error` only. Exception
// detail is logged server-side (see the catch blocks above) and never serialized
// into the response — CodeQL js/stack-trace-exposure, alert 139. `message` is only
// ever a fixed string or our own VALIDATION_ERROR field list, never an exception.
function jsonError(status, message, code) {
  const body = { error: message, code: code ?? String(status) };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
