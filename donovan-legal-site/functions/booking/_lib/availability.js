// ── Availability computation engine ───────────────────────────────────────────
//
// Ported verbatim from vantage/server/lib/booking/availability.js.
// Pure logic — no I/O. Works in the Cloudflare Workers runtime (Intl API is
// available; no Node-specific imports). Runs identically in both environments.
//
// DST safety: all wall-clock arithmetic uses Intl.DateTimeFormat; localMidnight
// converges in ≤3 passes for all IANA timezones (spring-forward + fall-back safe).

/** @typedef {{ startISO: string, endISO: string }} Block */
/** @typedef {{ startISO: string, endISO: string }} Slot */

/**
 * Return the wall-clock parts of a UTC epoch in a given IANA timezone.
 * @param {number} epochMs
 * @param {string} tz
 * @returns {{ year:number, month:number, day:number, hour:number, minute:number, weekday:number }}
 */
export function wallClock(epochMs, tz) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = {};
  for (const { type, value } of fmt.formatToParts(new Date(epochMs))) {
    parts[type] = value;
  }
  // Intl.DateTimeFormat hour12:false returns hour "24" for midnight — normalize.
  const hour = parseInt(parts.hour, 10) % 24;
  const DAYS = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10) - 1, // 0-based
    day: parseInt(parts.day, 10),
    hour,
    minute: parseInt(parts.minute, 10),
    weekday: DAYS[parts.weekday] ?? -1,
  };
}

/**
 * Return the UTC epoch (ms) of local midnight for a given calendar date in tz.
 * DST-correct via iterative adjustment; converges in ≤3 passes.
 * @param {number} year
 * @param {number} month  0-based
 * @param {number} day
 * @param {string} tz
 * @returns {number}
 */
export function localMidnight(year, month, day, tz) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    hour12: false,
  });

  let guess = Date.UTC(year, month, day, 0, 0, 0);

  for (let pass = 0; pass < 4; pass++) {
    const parts = {};
    for (const { type, value } of fmt.formatToParts(new Date(guess))) parts[type] = value;
    const localYear  = parseInt(parts.year, 10);
    const localMonth = parseInt(parts.month, 10) - 1;
    const localDay   = parseInt(parts.day, 10);
    const localHour  = parseInt(parts.hour, 10) % 24;
    const localMin   = parseInt(parts.minute, 10);

    if (localHour === 0 && localMin === 0 && localYear === year && localMonth === month && localDay === day) {
      break;
    }

    const localAsUTC  = Date.UTC(localYear, localMonth, localDay, localHour, localMin, 0);
    const targetAsUTC = Date.UTC(year, month, day, 0, 0, 0);
    guess -= localAsUTC - targetAsUTC;
  }

  return guess;
}

/**
 * Advance a UTC epoch by exactly one calendar day, staying in tz (DST-correct).
 * @param {number} epochMs
 * @param {string} tz
 * @returns {number}
 */
export function nextDay(epochMs, tz) {
  const candidate = epochMs + 25 * 3600_000;
  const w = wallClock(candidate, tz);
  return localMidnight(w.year, w.month, w.day, tz);
}

/**
 * Do two time intervals overlap? Closed-open convention: [a,b) overlaps [c,d) iff
 * a < d && c < b.  Edge-touching does NOT overlap.
 * @param {number} aStart
 * @param {number} aEnd
 * @param {number} bStart
 * @param {number} bEnd
 * @returns {boolean}
 */
export function overlaps(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Generate candidate slots for a single business day.
 * @param {number} dayMidnightMs
 * @param {{ tz:string, start_hour:number, end_hour:number, slot_min:number, buffer_min:number }} cfg
 * @returns {Array<{startMs:number, endMs:number}>}
 */
export function slotsForDay(dayMidnightMs, cfg) {
  const { tz, start_hour, end_hour, slot_min, buffer_min } = cfg;
  const stride = slot_min + buffer_min;
  const slots = [];

  const w = wallClock(dayMidnightMs + 3600_000, tz);
  const base = localMidnight(w.year, w.month, w.day, tz);

  for (let minuteOffset = 0; ; minuteOffset += stride) {
    const totalMin = start_hour * 60 + minuteOffset;
    const startMs = base + totalMin * 60_000;
    const endMs = startMs + slot_min * 60_000;
    const slotEndHour = totalMin / 60 + slot_min / 60;
    if (slotEndHour > end_hour) break;
    if (slots.length >= 48) break;
    slots.push({ startMs, endMs });
  }
  return slots;
}

/**
 * Compute open booking slots by generating candidates across [fromMs, toMs)
 * and subtracting busy blocks.
 *
 * @param {object} windowCfg
 * @param {Block[]} busyBlocks
 * @param {number} fromMs
 * @param {number} toMs
 * @param {number} [nowMs]
 * @returns {Slot[]}
 */
export function computeAvailability(windowCfg, busyBlocks, fromMs, toMs, nowMs) {
  const now = nowMs ?? Date.now();
  const {
    tz = "America/New_York",
    business_days = [1, 2, 3, 4, 5],
    start_hour = 9,
    end_hour = 17,
    slot_min = 60,
    buffer_min = 0,
  } = windowCfg;

  const busy = busyBlocks
    .map((b) => ({ s: Date.parse(b.startISO), e: Date.parse(b.endISO) }))
    .filter((b) => !isNaN(b.s) && !isNaN(b.e) && b.s < b.e);

  const open = [];

  const wFrom = wallClock(fromMs, tz);
  let dayMs = localMidnight(wFrom.year, wFrom.month, wFrom.day, tz);

  let safety = 0;
  while (dayMs < toMs && safety++ < 400) {
    const wDay = wallClock(dayMs + 3600_000, tz);
    if (business_days.includes(wDay.weekday)) {
      for (const slot of slotsForDay(dayMs, { tz, start_hour, end_hour, slot_min, buffer_min })) {
        if (slot.startMs < fromMs) continue;
        if (slot.endMs > toMs) continue;
        if (slot.startMs < now) continue;
        const blocked = busy.some((b) => overlaps(slot.startMs, slot.endMs, b.s, b.e));
        if (!blocked) {
          open.push({
            startISO: new Date(slot.startMs).toISOString(),
            endISO: new Date(slot.endMs).toISOString(),
          });
        }
      }
    }
    dayMs = nextDay(dayMs, tz);
  }

  return open;
}
