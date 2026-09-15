// ── Mock booking provider — Cloudflare Pages Functions port ───────────────────
//
// Ported from vantage/server/lib/booking/provider-mock.js.
//
// Change from Node source: Buffer.from(...).toString("base64url") is not
// available in the Workers runtime.  Replaced with a btoa-based equivalent
// that produces the same "deterministic fake id" property (stable per
// email+slot+typeId triple) without Buffer.
//
// All other logic is identical.

import { computeAvailability } from "./availability.js";

const DEFAULT_TYPES = [
  { id: "consult", name: "Initial Consultation", duration_min: 60 },
  { id: "followup", name: "Follow-Up", duration_min: 30 },
];

const DEFAULT_CFG = {
  tz: "America/New_York",
  business_days: [1, 2, 3, 4, 5],
  start_hour: 9,
  end_hour: 22,
  slot_min: 60,
  buffer_min: 0,
  days_ahead: 14,
};

/**
 * Return the configured appointment types.
 * @param {object} cfg
 * @returns {Promise<Array<{id:string, name:string, duration_min:number}>>}
 */
export async function listAppointmentTypes(cfg) {
  const types = Array.isArray(cfg?.appointment_types) && cfg.appointment_types.length
    ? cfg.appointment_types
    : DEFAULT_TYPES;
  return types.map((t) => ({
    id: String(t.id ?? "unknown"),
    name: String(t.name ?? "Appointment"),
    duration_min: Number(t.duration_min ?? 60),
  }));
}

/**
 * Return open slots. Mock has no real calendar — all business hours are free.
 * @param {object} cfg
 * @param {{ typeId:string, fromISO:string, toISO:string, tz:string }} params
 * @returns {Promise<Array<{startISO:string, endISO:string}>>}
 */
export async function getAvailability(cfg, { typeId, fromISO, toISO, tz }) {
  const merged = { ...DEFAULT_CFG, ...(cfg ?? {}) };
  const types = await listAppointmentTypes(cfg);
  const match = types.find((t) => t.id === typeId);
  if (match) merged.slot_min = match.duration_min;
  if (tz) merged.tz = tz;

  const fromMs = Date.parse(fromISO);
  const toMs = Date.parse(toISO);
  if (isNaN(fromMs) || isNaN(toMs) || fromMs >= toMs) return [];

  return computeAvailability(merged, [], fromMs, toMs);
}

/**
 * Echo a confirmed booking back with a deterministic fake provider_ref.
 *
 * Workers runtime note: Buffer.from().toString("base64url") is not available.
 * We use btoa() with a URI-safe substitution — same stability guarantee
 * (same inputs → same output) without Node builtins.
 *
 * @param {object} cfg
 * @param {{ typeId:string, slotISO:string, contact:{name:string,email:string,phone:string}, notes:string }} params
 * @returns {Promise<{booking_id:string, confirmed:boolean, provider_ref:string}>}
 */
export async function createBooking(cfg, { typeId, slotISO, contact }) {
  const key = `${contact?.email ?? ""}|${slotISO ?? ""}|${typeId ?? ""}`;
  // btoa requires a Latin-1-safe string; encode as UTF-8 percent-escaped then take base64.
  const b64 = btoa(encodeURIComponent(key))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const provider_ref = "mock-" + b64.slice(0, 16);
  return {
    booking_id: "",
    confirmed: true,
    provider_ref,
  };
}
