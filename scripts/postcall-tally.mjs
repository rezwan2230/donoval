#!/usr/bin/env node
// ── ADAM-POSTCALL-OBSERVABILITY-R1 · read-only tally over a captured wrangler tail ──
//
// Counts the post-call enrichment outcomes and the booking-time qualifier join out
// of a capture file, and prints the QUALIFIER-SKIP RATE — the number the #180
// joinKey trade turns on.
//
// ── THIS FILE SHIPS NOTHING ──────────────────────────────────────────────────
// It reads a file. It makes no network request, touches no binding, reads no
// secret, and adds no log line to any Function. Every category below is a LITERAL
// SUBSTRING of a string that already exists in the deployed source, quoted beside
// it with the file and line it came from. If a category here has no `source:`
// pointer, it does not belong here.
//
// ── WHY THE SKIP RATE IS NOT A LOG LINE ──────────────────────────────────────
// `booking/create.js:718` warns `callmap not written` when a call booked but Clio
// resolved no contact. That is a DIFFERENT fact from the one #180 needs, and
// reading it as the skip rate would answer the wrong question with a real number.
//
// #180 proposes keying `callmap:` on the server-verified `joinKey` instead of the
// call_id as SUBMITTED (see the caveat block at booking/create.js:690). `joinKey`
// is `callId` when the qualifier binding verified and `""` when it did not
// (create.js:335), and the callmap write is gated on a non-empty key — so the
// bookings that would LOSE their callmap under #180 are exactly those that
// submitted a call_id and got no verified binding for it.
//
// That population is legible in one line and one line only, the
// `qualifier_join=` record at create.js:365, which emits `key_source=` ONLY when
// the binding verified:
//
//     keySource = qual.verified ? "body" : ""            // create.js:336, :350
//     (keySource ? ` key_source=${keySource}` : "")      // create.js:368
//
// So: a `qualifier_join=` line with `call_id_present=yes` and NO `key_source=`
// is a qualifier skip. That is derived here, not logged, and no production code
// changed to make it derivable.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// ── The categories, each quoted from the source that emits it ────────────────
//
// ORDER IS LOAD-BEARING. First match wins, and `fields not applied` must be
// tested before `fields applied` would be — they are tested here as disjoint
// literals so neither can swallow the other, and the test fixture proves it.
export const CATEGORIES = Object.freeze([
  // ── Gate 1: signature (functions/_lib/retell-auth.js) ─────────────────────
  {
    key: "signature_invalid",
    label: "signature refused (invalid HMAC)",
    group: "signature",
    literal: "[retell-auth] SIGNATURE_INVALID",
    source: "functions/_lib/retell-auth.js:100",
  },
  {
    key: "signature_misconfigured",
    label: "signature refused (RETELL_API_KEY unset)",
    group: "signature",
    literal: "[retell-auth] MISCONFIGURED",
    source: "functions/_lib/retell-auth.js:83",
  },

  // ── Gate 2: agent identity (functions/_lib/retell-postcall.js) ────────────
  {
    key: "agent_missing",
    label: "agent refused (no call.agent_id)",
    group: "agent",
    literal: "[postcall] AGENT_MISSING",
    source: "functions/_lib/retell-postcall.js:76",
  },
  {
    key: "agent_mismatch",
    label: "agent refused (another agent)",
    group: "agent",
    literal: "[postcall] AGENT_MISMATCH",
    source: "functions/_lib/retell-postcall.js:80",
  },

  // ── Gate 3: event type (functions/webhooks/retell-postcall.js) ────────────
  {
    key: "event_ignored",
    label: "ignored: not call_analyzed",
    group: "delivery",
    literal: "[postcall] ignored event=",
    source: "functions/webhooks/retell-postcall.js:106",
  },

  // ── Gate 4: callmap ──────────────────────────────────────────────────────
  {
    key: "no_contact",
    label: "ignored: no_contact (call never booked)",
    group: "delivery",
    literal: "[postcall] no contact resolved:",
    source: "functions/webhooks/retell-postcall.js:119",
  },

  // ── Past the gates ───────────────────────────────────────────────────────
  {
    key: "unparseable_body",
    label: "refused: signed but unparseable body",
    group: "delivery",
    literal: "[postcall] signed delivery had an unparseable body",
    source: "functions/webhooks/retell-postcall.js:94",
  },
  {
    key: "not_configured",
    label: "ignored: booking config unavailable",
    group: "delivery",
    literal: "[postcall] booking config unavailable",
    source: "functions/webhooks/retell-postcall.js:145",
  },
  {
    key: "applied",
    label: "APPLIED (fields written to the contact)",
    group: "delivery",
    literal: "[postcall] fields applied count=",
    source: "functions/booking/_lib/provider-clio.js:2247",
  },
  {
    key: "not_applied",
    label: "write failed (PATCH refused or threw)",
    group: "delivery",
    literal: "[postcall] fields not applied:",
    source: "functions/booking/_lib/provider-clio.js:2241, :2250",
  },
  {
    key: "contact_not_read",
    label: "write skipped: contact not read back",
    group: "delivery",
    literal: "[postcall] contact not read",
    source: "functions/booking/_lib/provider-clio.js:1128 (POSTCALL_READ_LOG)",
  },
  {
    key: "ids_unresolved_error",
    label: "write skipped: field id resolve errored",
    group: "delivery",
    literal: "[postcall] field ids not resolved:",
    source: "functions/booking/_lib/provider-clio.js:2209",
  },
  {
    key: "ids_absent",
    label: "write skipped: fields absent from the Clio account",
    group: "delivery",
    literal: "[postcall] no post-call field ids on the account",
    source: "functions/booking/_lib/provider-clio.js:2216",
  },
  {
    key: "no_change",
    label: "write skipped: no_change (already current)",
    group: "delivery",
    literal: "[postcall] nothing to apply: no_change",
    source: "functions/booking/_lib/provider-clio.js:2225",
  },
  {
    key: "no_fields_to_write",
    label: "write skipped: analysis produced no fields",
    group: "delivery",
    literal: "[postcall] no fields to write",
    source: "functions/booking/_lib/provider-clio.js:2200",
  },

  // ── Diagnostic, NOT a delivery outcome ───────────────────────────────────
  // Fires once per delivery that clears all four gates, ALONGSIDE whichever
  // outcome above follows it. Counting it as a delivery would double-count
  // every applied write, so it is grouped `detail` and excluded from the sum.
  {
    key: "analysis_selected",
    label: "(detail) analysis selected",
    group: "detail",
    literal: "[postcall] analysis selected count=",
    source: "functions/webhooks/retell-postcall.js:128",
  },

  // ── booking/create.js — the producer side ────────────────────────────────
  {
    key: "qualifier_join",
    label: "booking: qualifier_join record",
    group: "booking",
    literal: "[booking/create] qualifier_join=",
    source: "functions/booking/create.js:365",
  },
  {
    key: "join_recovered_cookie",
    label: "booking: body call_id unverified, recovered from cookie",
    group: "booking",
    literal: "[booking/create] body call_id unverified",
    source: "functions/booking/create.js:346",
  },
  {
    key: "callmap_no_contact",
    label: "booking: callmap not written (no Clio contact resolved)",
    group: "booking",
    literal: "[booking/create] callmap not written",
    source: "functions/booking/create.js:718",
  },
  {
    key: "callmap_write_failed",
    label: "booking: callmap write failed (KV)",
    group: "booking",
    literal: "[booking/create] callmap write failed:",
    source: "functions/booking/create.js:731",
  },
]);

/** Every delivery outcome is terminal and mutually exclusive: at most one per POST. */
const DELIVERY_KEYS = Object.freeze(
  CATEGORIES.filter((c) => c.group === "delivery" || c.group === "agent").map((c) => c.key),
);

/**
 * Pull the log messages out of one captured line.
 *
 * Handles both capture shapes, and NEVER throws:
 *   • `--format json`   — one JSON object per line, messages under `logs[].message[]`
 *   • `--format pretty` — the line IS the message (ANSI and all)
 *
 * A line that parses as JSON but carries no logs yields no messages; a line that
 * does not parse is handed back whole, because a truncated tail's last line is a
 * half-written JSON object and dropping it silently would understate a count.
 *
 * @param {string} line
 * @returns {string[]}
 */
export function extractMessages(line) {
  const trimmed = typeof line === "string" ? line.trim() : "";
  if (!trimmed) return [];

  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    let obj;
    try {
      obj = JSON.parse(trimmed);
    } catch (_) {
      // Not JSON after all (or truncated). Fall through and read it as text.
      return [trimmed];
    }
    const out = [];
    const logs = Array.isArray(obj?.logs) ? obj.logs : [];
    for (const entry of logs) {
      const m = entry?.message;
      if (typeof m === "string") out.push(m);
      else if (Array.isArray(m)) out.push(m.map(stringifyArg).join(" "));
      else if (m != null) out.push(stringifyArg(m));
    }
    const exceptions = Array.isArray(obj?.exceptions) ? obj.exceptions : [];
    for (const ex of exceptions) {
      const m = ex?.message;
      if (m != null) out.push(`[exception] ${stringifyArg(m)}`);
    }
    return out;
  }

  return [trimmed];
}

function stringifyArg(v) {
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch (_) {
    return String(v);
  }
}

/**
 * Which category is this message? `null` when nothing claims it — the caller
 * counts those as `other`. Never throws on a non-string.
 *
 * @param {unknown} message
 * @returns {string|null}
 */
export function classify(message) {
  if (typeof message !== "string" || !message) return null;
  for (const c of CATEGORIES) {
    if (message.includes(c.literal)) return c.key;
  }
  return null;
}

/** `key=value` off a space-separated log line, or "" when the key is absent. */
function field(message, key) {
  const m = new RegExp(`\\b${key}=([^\\s]+)`).exec(message);
  return m ? m[1] : "";
}

/**
 * Tally a whole capture.
 *
 * @param {string} text  the capture file's contents
 * @returns {object}
 */
export function tally(text) {
  const counts = Object.create(null);
  for (const c of CATEGORIES) counts[c.key] = 0;
  counts.other = 0;

  const join = {
    /** `qualifier_join=` lines that submitted a body call_id — these have a callmap today. */
    voiceBookings: 0,
    /** …of those, the ones with NO verified key. #180 would drop their callmap. */
    skips: 0,
    /** …and the ones with a verified key, which #180 keeps. */
    verified: 0,
    /** No body call_id but a verified cookie key — #180 would GAIN these. */
    cookieOnlyKey: 0,
    /** `claims_nothing=yes`, the explicit opt-out. Reported so it is not read as a skip. */
    claimsNothing: 0,
    /** The `qualifier_join=` enum, as a histogram. */
    byJoin: Object.create(null),
  };

  let messages = 0;
  let lines = 0;

  const source = typeof text === "string" ? text : "";
  for (const rawLine of source.split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    lines += 1;

    let extracted;
    try {
      extracted = extractMessages(rawLine);
    } catch (_) {
      // extractMessages is written not to throw; if it ever does, the line is
      // still evidence and must not take the run down with it.
      extracted = [rawLine];
    }

    for (const msg of extracted) {
      messages += 1;
      const key = classify(msg);
      if (key == null) {
        counts.other += 1;
        continue;
      }
      counts[key] += 1;
      if (key === "qualifier_join") readJoin(msg, join);
    }
  }

  const deliveries = DELIVERY_KEYS.reduce((n, k) => n + counts[k], 0);
  const signatureRefusals = counts.signature_invalid + counts.signature_misconfigured;
  const agentRefusals = counts.agent_missing + counts.agent_mismatch;

  return {
    lines,
    messages,
    counts,
    deliveries,
    signatureRefusals,
    agentRefusals,
    join,
    /** null, never NaN, when there is no denominator to divide by. */
    skipRatePct: join.voiceBookings > 0 ? (join.skips / join.voiceBookings) * 100 : null,
  };
}

function readJoin(message, join) {
  const joinValue = field(message, "qualifier_join") || "(unparsed)";
  join.byJoin[joinValue] = (join.byJoin[joinValue] ?? 0) + 1;

  const keySource = field(message, "key_source"); // "" ⇔ the binding did not verify
  const callIdPresent = field(message, "call_id_present") === "yes";
  if (field(message, "claims_nothing") === "yes") join.claimsNothing += 1;

  if (callIdPresent) {
    join.voiceBookings += 1;
    if (keySource) join.verified += 1;
    else join.skips += 1;
  } else if (keySource) {
    join.cookieOnlyKey += 1;
  }
}

// ── Report ──────────────────────────────────────────────────────────────────

function pad(s, n) {
  const t = String(s);
  return t.length >= n ? t : t + " ".repeat(n - t.length);
}
function padLeft(s, n) {
  const t = String(s);
  return t.length >= n ? t : " ".repeat(n - t.length) + t;
}

function section(title, rows, width) {
  const out = [title, "-".repeat(width + 8)];
  for (const [label, n] of rows) out.push(`${pad(label, width)}  ${padLeft(n, 6)}`);
  return out;
}

/**
 * The plain summary table, plus the one number #180 turns on.
 *
 * @param {ReturnType<typeof tally>} t
 * @returns {string}
 */
export function formatReport(t) {
  // Wide enough for the longest label in CATEGORIES, so no row wraps the column.
  const W = 56;
  const byKey = (k) => CATEGORIES.find((c) => c.key === k);
  const row = (k) => [byKey(k).label, t.counts[k]];

  const out = [];
  out.push("ADAM-POSTCALL-OBSERVABILITY-R1 — post-call tally");
  out.push(`capture: ${t.lines} line(s), ${t.messages} log message(s)`);
  out.push("");

  out.push(...section(
    "POST-CALL WEBHOOK — deliveries",
    [
      ...DELIVERY_KEYS.map(row),
      ["── deliveries (sum of the above)", t.deliveries],
    ],
    W,
  ));
  out.push("");

  out.push(...section(
    "SIGNATURE REFUSALS — see the caveat in the docs",
    [
      row("signature_invalid"),
      row("signature_misconfigured"),
      ["── signature refusals", t.signatureRefusals],
    ],
    W,
  ));
  out.push("");

  out.push(...section(
    "BOOKING PRODUCER — booking/create.js",
    [
      row("qualifier_join"),
      row("join_recovered_cookie"),
      row("callmap_no_contact"),
      row("callmap_write_failed"),
    ],
    W,
  ));
  out.push("");

  out.push(...section(
    "OTHER",
    [row("analysis_selected"), ["unrecognised lines (other)", t.counts.other]],
    W,
  ));
  out.push("");

  // ── The #180 number ───────────────────────────────────────────────────────
  out.push("QUALIFIER-SKIP RATE — the #180 joinKey trade");
  out.push("-".repeat(W + 8));
  out.push(`${pad("voice bookings (call_id_present=yes)", W)}  ${padLeft(t.join.voiceBookings, 6)}`);
  out.push(`${pad("  verified join key — #180 KEEPS the callmap", W)}  ${padLeft(t.join.verified, 6)}`);
  out.push(`${pad("  no verified key  — #180 DROPS the callmap", W)}  ${padLeft(t.join.skips, 6)}`);
  out.push(`${pad("cookie-only key   — #180 GAINS a callmap", W)}  ${padLeft(t.join.cookieOnlyKey, 6)}`);
  out.push(`${pad("  of which claims_nothing=yes (opt-out)", W)}  ${padLeft(t.join.claimsNothing, 6)}`);
  out.push("");
  out.push(
    t.skipRatePct == null
      ? "qualifier-skip rate: n/a — no voice booking in this capture, so this "
        + "window decides nothing. Widen it before reading a verdict."
      : `qualifier-skip rate: ${t.skipRatePct.toFixed(1)}%`
        + ` (${t.join.skips} of ${t.join.voiceBookings} voice bookings)`,
  );

  const joins = Object.entries(t.join.byJoin);
  if (joins.length) {
    out.push("");
    out.push("qualifier_join= histogram");
    out.push("-".repeat(W + 8));
    for (const [k, n] of joins.sort((a, b) => b[1] - a[1])) {
      out.push(`${pad(`  ${k}`, W)}  ${padLeft(n, 6)}`);
    }
  }

  return out.join("\n");
}

// ── CLI ─────────────────────────────────────────────────────────────────────

function readStdin() {
  try {
    return readFileSync(0, "utf8");
  } catch (_) {
    return "";
  }
}

const USAGE = `ADAM-POSTCALL-OBSERVABILITY-R1 — tally a captured wrangler tail.

  node scripts/postcall-tally.mjs <capture-file> [--json]
  cat capture.jsonl | node scripts/postcall-tally.mjs [--json]

Reads a file. Makes no network request and touches no binding.
See docs/ADAM-POSTCALL-OBSERVABILITY-R1.md for the capture recipe.`;

export function main(argv = process.argv.slice(2)) {
  const flags = argv.filter((a) => a.startsWith("-"));
  const files = argv.filter((a) => !a.startsWith("-"));

  if (flags.includes("-h") || flags.includes("--help")) {
    process.stdout.write(`${USAGE}\n`);
    return 0;
  }

  let text;
  if (files.length) {
    try {
      text = readFileSync(files[0], "utf8");
    } catch (err) {
      process.stderr.write(`cannot read ${files[0]}: ${err?.message ?? err}\n`);
      return 2;
    }
  } else {
    text = readStdin();
  }

  if (!text.trim()) {
    process.stderr.write("empty capture — nothing to tally.\n\n");
    process.stderr.write(`${USAGE}\n`);
    return 2;
  }

  const t = tally(text);
  process.stdout.write(
    flags.includes("--json")
      ? `${JSON.stringify(t, null, 2)}\n`
      : `${formatReport(t)}\n`,
  );
  return 0;
}

// Only when run directly, so the test can import the parser without side effects.
// pathToFileURL, not a hand-built `file://` string: on Windows argv[1] is
// `C:\…`, and `new URL("file://C:/…")` reads the drive letter as the HOST.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main();
}
