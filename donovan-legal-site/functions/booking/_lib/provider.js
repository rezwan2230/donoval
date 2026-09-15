// ── Booking provider interface ─────────────────────────────────────────────────
//
// Ported from vantage/server/lib/booking/provider.js (documentation + validator).
// No runtime code changes — the interface contract and assertAdapterInterface
// function are identical to the source.
//
// ── Secret resolution in the Pages Functions context ──────────────────────────
// In the Cloudflare Workers runtime there is no process.env.  Secrets come from
// context.env (bound at the edge by wrangler / Pages secrets).
//
// The adapter contract uses the _env naming convention:
//   cfg.client_id_env = "CLIO_CLIENT_ID"
// Adapters resolve secrets by calling resolveSecret(cfg, "client_id_env", env)
// where `env` is context.env threaded down from the route handler.
//
// Raw credentials are NEVER stored in config or logged.

/**
 * Validate that an adapter object implements the required interface.
 * Call this in tests or at startup to catch missing exports early.
 *
 * @param {object} adapter
 * @param {string} name
 */
export function assertAdapterInterface(adapter, name) {
  for (const method of ["listAppointmentTypes", "getAvailability", "createBooking"]) {
    if (typeof adapter[method] !== "function") {
      throw new TypeError(`Booking adapter "${name}" is missing required method: ${method}`);
    }
  }
}

/**
 * Resolve a secret from context.env using a cfg reference key.
 * Replaces the process.env lookup from the Node source.
 *
 * @param {object} cfg   - provider config (carries _env reference keys)
 * @param {string} envKey - cfg field whose value is the env var name
 * @param {object} env   - context.env from the Pages Function handler
 * @returns {string}
 */
export function resolveSecret(cfg, envKey, env) {
  const varName = cfg?.[envKey];
  if (!varName) return "";
  return (env?.[varName] ?? "").trim();
}
