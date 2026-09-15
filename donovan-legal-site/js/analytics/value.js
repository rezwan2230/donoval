// ── JAY-TRACKING-C1: what a booked consultation is worth ─────────────────────
//
// WHY A CONVERSION NEEDS A NUMBER ON IT
//
// Without a value, Google Ads treats every booking as identical and optimises
// for the MOST bookings. That is the wrong target for this firm: a Reserve-tier
// real estate principal and a general inquiry are both "one booking", and they
// are not remotely the same business.
//
// With a value, bidding optimises for the most VALUE — it will pay several times
// more per click for the profile that produces the first, and quietly stop
// bidding on the profile that produces the second. For a practice with this
// spread in matter value that single change is worth more than every other
// optimisation in the tracking plan put together.
//
// Almost no law firm can do this, because almost none of them know what a lead
// is worth at the moment it converts. This one does: the qualifier derives tier
// and matter server-side, at the moment the caller taps through it.
//
// ⚠️ THE NUMBERS BELOW ARE PLACEHOLDERS AND MUST NOT SURVIVE FIRST CONTACT.
//
// They are RELATIVE weights, not currency, and their only job is to be roughly
// right about ratios until Elroy and Paul set real ones. Bidding cares about the
// ratio between conversions far more than the absolute figures — getting the
// ORDER wrong is what does damage, and the order here is the one the firm's own
// tier taxonomy already asserts. Tracked as P8 in the handoff doc.

// ⚠️ THE QUALIFIER'S VOCABULARY IS NOT THE MARKETING LADDER.
//
// The firm markets four tiers — Gold, Platinum, Diamond, Reserve — but the
// qualifier's `TIER` map (functions/fn/qualifier_submit.js) only ever derives
// three of them, plus an escape hatch:
//
//     first_investment           → Gold
//     portfolio_alongside_career → Platinum
//     real_estate_is_business    → Reserve
//     unsure_escape_hatch        → escape_hatch
//
// Nothing produces Diamond. It stays below so the map does not silently
// downgrade one if the qualifier ever grows a path, but it will not appear in
// the data today. `escape_hatch` — "I'm not sure yet" — was previously missing
// entirely and fell through to BASELINE_VALUE, undervaluing a real prospect.
//
// Keep this table in step with `functions/_lib/conversion-value.js`, which is
// the authoritative copy. A divergence would make the browser and server report
// different values for the same booking.

/** Relative weight per tier. Placeholder — see the warning above. */
export const TIER_VALUE = Object.freeze({
  reserve: 100,      // real_estate_is_business — Real Estate Principal
  diamond: 60,       // Qualifying Operator (REPS/STR) — no qualifier path today
  platinum: 30,      // portfolio_alongside_career — Serious Investor
  gold: 12,          // first_investment — Strategy Consumer
  escape_hatch: 8,   // "not sure yet" — a real prospect, merely unclassified
});

/** Fallback weight per matter when no tier was derived. */
export const MATTER_VALUE = Object.freeze({
  tax: 10,
  real_estate: 10,
  other: 5,
});

/** What an unclassified booking is worth. Deliberately low, never zero. */
export const BASELINE_VALUE = 5;

/** Google Ads and Meta both want a currency alongside the number. */
export const VALUE_CURRENCY = 'USD';

const norm = (s) => (typeof s === 'string' ? s.trim().toLowerCase() : '');

/**
 * Score a booking.
 *
 * Tier wins when present because it is the firm's own richest signal. Matter is
 * the fallback, and the baseline catches everything else.
 *
 * Never returns 0 or a negative. A zero-valued conversion is worse than no value
 * at all: value-based bidding reads it as "this one was worthless" and learns to
 * avoid whatever produced it, which for an unclassified booking is exactly wrong.
 */
export function conversionValue({ tier, matter } = {}) {
  const t = norm(tier);
  if (Object.prototype.hasOwnProperty.call(TIER_VALUE, t)) return TIER_VALUE[t];

  const m = norm(matter);
  if (Object.prototype.hasOwnProperty.call(MATTER_VALUE, m)) return MATTER_VALUE[m];

  return BASELINE_VALUE;
}

/** The value fields to attach to a conversion, or {} when there is nothing to say. */
export function valueParams(context) {
  const value = conversionValue(context);
  return value > 0 ? { value, currency: VALUE_CURRENCY } : {};
}
