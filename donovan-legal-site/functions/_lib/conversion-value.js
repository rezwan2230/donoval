// ── JAY-TRACKING-C1: what a confirmed booking is worth ───────────────────────
//
// The authoritative value map. `js/analytics/value.js` holds a browser-side copy
// used for the immediate conversion ping; this one is authoritative because it
// runs where the tier actually exists.
//
// WHY THE BROWSER CANNOT DO THIS
//
// The tier is derived in `functions/fn/qualifier_submit.js` from the caller's
// tapped answers and never leaves the server. The browser fires
// `booking_confirmed` knowing only the matter type. So the browser's value is a
// coarse approximation and this one is the real number — which is the whole
// argument for reporting the conversion server-side as well.
//
// ⚠️ THE TIER VOCABULARY IS NOT THE MEMBERSHIP LADDER
//
// The firm markets four membership tiers — Gold, Platinum, Diamond, Reserve.
// The qualifier only ever derives THREE of them, plus an escape hatch:
//
//     first_investment           → Gold
//     portfolio_alongside_career → Platinum
//     real_estate_is_business    → Reserve
//     unsure_escape_hatch        → escape_hatch
//
// There is no path that produces Diamond. It is accepted below anyway, so that
// if the qualifier ever grows one this map does not silently drop it to baseline
// — but nobody should expect to see it in the data today.
//
// `escape_hatch` is "I am not sure yet", which is a real answer and a real
// prospect. It is valued above baseline and below Gold.

/**
 * Relative weight per tier. NOT currency.
 *
 * ⚠️ PLACEHOLDERS. Elroy and Paul own the real numbers.
 *
 * Bidding cares about the RATIO between conversions far more than the absolute
 * figures, so getting the ORDER wrong is what does damage. The order here is the
 * one the firm's own tier taxonomy already asserts, so it is defensible until
 * replaced. The magnitudes are not.
 */
export const TIER_VALUE = Object.freeze({
  reserve: 100,       // real_estate_is_business — Real Estate Principal
  diamond: 60,        // no qualifier path produces this today
  platinum: 30,       // portfolio_alongside_career — Serious Investor
  gold: 12,           // first_investment — Strategy Consumer
  escape_hatch: 8,    // "not sure yet" — a real prospect, just unclassified
});

/** Fallback weight by matter when no tier was derived at all. */
export const MATTER_VALUE = Object.freeze({
  tax: 10,
  real_estate: 10,
  other: 5,
});

/**
 * What an unclassified booking is worth.
 *
 * Deliberately low, and deliberately NOT zero. A zero-valued conversion is worse
 * than sending no value: value-based bidding reads it as "this one was
 * worthless" and learns to avoid whatever produced it. For a booking we simply
 * failed to classify, that is precisely backwards.
 */
export const BASELINE_VALUE = 5;

export const VALUE_CURRENCY = "USD";

const norm = (s) => (typeof s === "string" ? s.trim().toLowerCase() : "");
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);

/**
 * Score a confirmed booking.
 *
 * Tier wins when present — it is the richest signal the firm has. Matter is the
 * fallback. Baseline catches everything else. Never returns zero or negative.
 */
export function conversionValue({ tier, matter } = {}) {
  const t = norm(tier);
  if (own(TIER_VALUE, t)) return TIER_VALUE[t];

  const m = norm(matter);
  if (own(MATTER_VALUE, m)) return MATTER_VALUE[m];

  return BASELINE_VALUE;
}

/** `{ value, currency }` for a conversion payload. */
export function valueParams(context) {
  const value = conversionValue(context);
  return value > 0 ? { value, currency: VALUE_CURRENCY } : {};
}

/**
 * Read tier and matter off whatever the qualifier record turned out to be.
 *
 * Tolerant on purpose: the `qualbk:` record is written by a different endpoint
 * on a 6-hour TTL, so a booking can legitimately arrive with no record, a
 * partial one, or one written before the tier field existed. Every one of those
 * has to degrade to a baseline-valued conversion rather than throw inside a
 * confirmed booking.
 */
export function contextFromQualifier(qual) {
  if (!qual || typeof qual !== "object") return {};
  return {
    tier: typeof qual.tier === "string" ? qual.tier : undefined,
    matter: typeof qual.matter === "string" ? qual.matter : undefined,
  };
}
