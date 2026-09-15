// ── GET /booking/types ─────────────────────────────────────────────────────────
//
// Returns the appointment types for the Donovan Legal deployment.
//
// Response shape (identical to vantage routes.js):
//   200 { ok: true, deployment: "donovan-main", types: [{id,name,duration_min}] }
//   400 { error, code: "UNKNOWN_PROVIDER" }
//   500 { error, code: "PROVIDER_ERROR" }
//
// No CORS handling: the widget and functions share the same Cloudflare Pages
// origin (donovan.law / pages.dev).  Same-origin requests never trigger a CORS
// preflight, so no Access-Control-Allow-* headers are needed.  The vantage
// source had CORS handling because the widget was on a client site calling the
// Vantage service (cross-origin).  That distinction is gone here.

import { resolveConfig, getAdapter } from "./_lib/config.js";

/**
 * @param {import("@cloudflare/workers-types").EventContext} context
 */
export async function onRequestGet(context) {
  const { env } = context;
  // resolveConfig FAILS CLOSED: an unconfigured calendar throws
  // MISSING_CALENDAR_CONFIG rather than falling back to the sandbox default.
  // Refuse with a clean 503 — matching booking/create.js — not an uncaught 500.
  let cfg;
  try {
    cfg = resolveConfig(env);
  } catch (e) {
    if (e?.code === "MISSING_CALENDAR_CONFIG") {
      console.error("[booking/types] MISSING_CALENDAR_CONFIG — refusing request");
      return jsonError(503, "booking_not_configured", "MISSING_CALENDAR_CONFIG");
    }
    throw e;
  }

  let adapter;
  try {
    adapter = await getAdapter(cfg.provider);
  } catch (e) {
    console.error(`[booking/types] UNKNOWN_PROVIDER provider=${cfg.provider} err=${String(e?.message ?? e)}`);
    return jsonError(400, "unknown_provider", "UNKNOWN_PROVIDER");
  }

  try {
    const types = await adapter.listAppointmentTypes(cfg.config);
    console.log(`[booking/types] ok provider=${cfg.provider} count=${types.length}`);
    return jsonOk(200, { ok: true, deployment: "donovan-main", types });
  } catch (e) {
    console.error(`[booking/types] PROVIDER_ERROR provider=${cfg.provider} err=${String(e?.message ?? e)}`);
    return jsonError(500, "booking_unavailable", "PROVIDER_ERROR");
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function jsonOk(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

// Client-facing errors carry a stable `code` and a generic `error` only. Exception
// detail is logged server-side and never serialized into the response —
// CodeQL js/stack-trace-exposure, alert 138.
function jsonError(status, message, code) {
  return new Response(JSON.stringify({ error: message, code: code ?? String(status) }), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
