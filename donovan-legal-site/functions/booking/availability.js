// ── GET /booking/availability ──────────────────────────────────────────────────
//
// Returns open slots for the Donovan Legal deployment.
//
// Query params:
//   deployment  — ignored (single-tenant, always "donovan-main"); accepted for
//                 widget compatibility so the same widget code works unchanged.
//   type        — appointment type id (optional; affects slot duration)
//   days        — horizon in days (optional, default 30, max 60)
//   tz          — IANA timezone override (optional; falls back to cfg.tz)
//
// Response shape (identical to vantage routes.js):
//   200 { ok, deployment, type, from, to, tz, slots:[{startISO,endISO}] }
//   400 { error, code: "UNKNOWN_PROVIDER" }
//   500 { error, code: "PROVIDER_ERROR" }
//
// No CORS handling: see types.js for rationale.

import { resolveConfig, getAdapter } from "./_lib/config.js";

const DEPLOYMENT = "donovan-main";

/**
 * @param {import("@cloudflare/workers-types").EventContext} context
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  const typeId     = clampStr(url.searchParams.get("type") ?? "", 60).trim();
  const days       = parseDays(url.searchParams.get("days") ?? "");
  const tzOverride = clampStr(url.searchParams.get("tz") ?? "", 60).trim();

  // resolveConfig FAILS CLOSED: if neither BOOKING_PROVIDER=mock nor
  // CLIO_CALENDAR_ID is set it throws MISSING_CALENDAR_CONFIG rather than falling
  // back to the sandbox default calendar. Refuse the read with a clean 503 —
  // matching booking/create.js — instead of surfacing an uncaught 500.
  let cfg;
  try {
    cfg = resolveConfig(env);
  } catch (e) {
    if (e?.code === "MISSING_CALENDAR_CONFIG") {
      console.error("[booking/availability] MISSING_CALENDAR_CONFIG — refusing request");
      return jsonError(503, "booking_not_configured", "MISSING_CALENDAR_CONFIG");
    }
    throw e;
  }
  const tz = tzOverride || cfg.config?.tz || "America/New_York";

  console.log(`[booking/availability] req provider=${cfg.provider} typeId=${typeId} days=${days}`);

  let adapter;
  try {
    adapter = await getAdapter(cfg.provider);
  } catch (e) {
    console.error(`[booking/availability] UNKNOWN_PROVIDER provider=${cfg.provider} err=${String(e?.message ?? e)}`);
    return jsonError(400, "unknown_provider", "UNKNOWN_PROVIDER");
  }

  const now = new Date();
  const fromISO = now.toISOString();
  const toISO   = new Date(now.getTime() + days * 86400_000).toISOString();

  try {
    // Thread env into the adapter — the Clio adapter needs it for secret resolution.
    // The mock adapter ignores env (no secrets needed).
    const slots = await adapter.getAvailability(cfg.config, { typeId, fromISO, toISO, tz }, env);
    console.log(`[booking/availability] ok provider=${cfg.provider} typeId=${typeId} slots=${slots.length}`);
    return jsonOk(200, {
      ok: true,
      deployment: DEPLOYMENT,
      type: typeId,
      from: fromISO,
      to: toISO,
      tz,
      slots,
    });
  } catch (e) {
    // Adapter detail (e.g. "clio: token refresh failed HTTP 401") is diagnostic only —
    // it goes to the server log, never to the client. Callers branch on `code`.
    console.error(`[booking/availability] PROVIDER_ERROR provider=${cfg.provider} typeId=${typeId} err=${String(e?.message ?? e)}`);
    return jsonError(500, "availability_unavailable", "PROVIDER_ERROR");
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function parseDays(raw) {
  // Default 30 days so a caller near month-end can reach into next month
  // ("beginning of August"). Max 60. Override with ?days=.
  const n = parseInt(raw || "30", 10);
  if (isNaN(n)) return 30;
  return Math.max(1, Math.min(60, n));
}

function clampStr(s, max) {
  const str = String(s ?? "");
  return str.length > max ? str.slice(0, max) : str;
}

function jsonOk(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Client-facing errors carry a stable `code` and a generic `error` only. Exception
// detail is logged server-side (see the catch blocks above) and never serialized
// into the response — CodeQL js/stack-trace-exposure, alert 137.
function jsonError(status, message, code) {
  const body = { error: message, code: code ?? String(status) };
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
