// ── JAY-TRACKING-B2: consent state ───────────────────────────────────────────
//
// Pure. No DOM, no storage of its own, no side effects — the banner (the UI) and
// analytics.js (the wiring) both call in here, and CI exercises the decision
// rules rather than a re-implementation of them. Same reasoning as
// js/perch/placement.js and js/analytics/events.js.
//
// WHAT WAS DECIDED, AND BY WHOM
//
// Elroy chose Accept/Decline shown to EVERY visitor — not geo-gated to the EEA —
// on the grounds that one compliant behaviour everywhere is simpler to defend
// than two behaviours and a country lookup. Tracking waits for the answer.
//
// Google Consent Mode v2 is what makes "waits for the answer" affordable. With
// consent denied, gtag still sends COOKIELESS pings: no identifiers, no storage,
// but Google can model conversions from them. So a visitor who declines, or who
// scrolls past and never answers, is not a total loss.
//
// Meta has no equivalent. Its pixel either runs or it does not — so
// fbevents.js is not loaded AT ALL until someone accepts. That asymmetry is the
// reason the two vendors are handled differently in analytics.js, and it is not
// an oversight.

/**
 * Where the answer is kept, and why the name carries a version.
 *
 * If the privacy policy or the categories ever change materially, consent
 * obtained under the old wording is not consent to the new. Bumping this suffix
 * re-asks everyone, which is the correct behaviour and is otherwise very easy to
 * forget. Do not reuse a version after changing what is being consented to.
 */
export const CONSENT_KEY = 'dl.consent.v1';

export const GRANTED = 'granted';
export const DENIED = 'denied';

/**
 * Consent Mode v2 defaults, applied BEFORE gtag loads.
 *
 * All four ad/analytics signals denied. `security_storage` stays granted because
 * it covers fraud prevention and is not a tracking signal — denying it is
 * cargo-cult strictness that buys nothing.
 *
 * `wait_for_update` gives the page a moment to apply a stored answer before gtag
 * decides how to behave, so a returning visitor who already accepted is not
 * briefly treated as denied on every page load.
 */
export const DEFAULT_CONSENT = Object.freeze({
  ad_storage: DENIED,
  ad_user_data: DENIED,
  ad_personalization: DENIED,
  analytics_storage: DENIED,
  functionality_storage: DENIED,
  personalization_storage: DENIED,
  security_storage: GRANTED,
  wait_for_update: 500,
});

// ── REGION-SCOPED DEFAULTS (2026-09-03) ──────────────────────────────────────
//
// Paul's decision, reversing Elroy's: the opt-in posture above is the LAW only
// in the EEA, the UK and Switzerland. No U.S. state the firm targets requires
// opt-in, and a banner most visitors never touch was turning every unanswered
// U.S. booking into a modelled estimate. So the default now depends on where
// the visitor is:
//
//   • opt-in regions (list below)  -> DEFAULT_CONSENT, exactly as before
//   • everywhere else, region KNOWN -> OPT_OUT_CONSENT: granted, and the banner
//                                     is a notice with a working Decline
//   • region UNKNOWN                -> DEFAULT_CONSENT (fail closed)
//
// The region comes from the edge: Cloudflare knows the country of every request
// and functions/_lib/analytics-inject.js writes it into <meta name="dl:region">.
// It is a hint, not a promise, so the gtag defaults are ALSO scoped by Google's
// own `region` parameter: the denied default carries `region: OPT_IN_REGIONS`,
// and gtag applies the more specific default regardless of what the edge said.

/** ISO 3166-1 alpha-2: EU-27, EEA (IS, LI, NO), UK, Switzerland. */
export const OPT_IN_REGIONS = Object.freeze([
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU',
  'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES',
  'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
]);

/** Everything granted. The opt-OUT posture for visitors outside OPT_IN_REGIONS. */
export const OPT_OUT_CONSENT = Object.freeze({
  ad_storage: GRANTED,
  ad_user_data: GRANTED,
  ad_personalization: GRANTED,
  analytics_storage: GRANTED,
  functionality_storage: GRANTED,
  personalization_storage: GRANTED,
  security_storage: GRANTED,
  wait_for_update: 500,
});

/**
 * Cloudflare's placeholder codes: `XX` (country unknown) and `T1` (Tor exit).
 * Both are well-formed two-character strings and neither is a country, so
 * without this list `XX` would read as "some non-EU country" and open up.
 */
const NOT_A_COUNTRY = Object.freeze(['XX', 'T1']);

/** Normalise whatever the edge wrote: 2 upper-case letters naming a country, or ''. */
export function normaliseRegion(code) {
  const c = typeof code === 'string' ? code.trim().toUpperCase() : '';
  if (!/^[A-Z]{2}$/.test(c)) return '';
  return NOT_A_COUNTRY.indexOf(c) === -1 ? c : '';
}

/** Does this region require opt-in? Unknown ('' or junk) counts as YES. */
export function isOptInRegion(code) {
  const c = normaliseRegion(code);
  return c === '' || OPT_IN_REGIONS.indexOf(c) !== -1;
}

/**
 * The `gtag('consent', 'default', ...)` parameter objects to publish, in order.
 *
 * Opt-in or unknown region: one global denied default -- byte-for-byte what the
 * site published before this change, so every existing test and every EEA
 * visitor sees no difference. Known opt-out region: the denied default scoped to
 * OPT_IN_REGIONS (Google applies it to those visitors even if the edge hint
 * was wrong), then a global granted default for everyone else.
 */
export function defaultConsentCalls(region) {
  if (isOptInRegion(region)) return [{ ...DEFAULT_CONSENT }];
  return [
    { ...DEFAULT_CONSENT, region: OPT_IN_REGIONS.slice() },
    { ...OPT_OUT_CONSENT },
  ];
}

/** The update sent to gtag once a visitor answers. */
export function consentUpdate(accepted) {
  const v = accepted ? GRANTED : DENIED;
  return {
    ad_storage: v,
    ad_user_data: v,
    ad_personalization: v,
    analytics_storage: v,
    functionality_storage: v,
    personalization_storage: v,
  };
}

/**
 * The stored answer: GRANTED, DENIED, or null for "has not answered".
 *
 * Null and DENIED are deliberately different. Both mean "do not track", but only
 * null means "still ask" — a visitor who declined must not be re-prompted on
 * every page, which is nagging, and in the EEA is its own compliance problem.
 *
 * Storage access is wrapped: Safari in private mode throws on localStorage
 * rather than returning null, and an exception here would take the banner — and
 * anything that ran after it — down with it.
 */
export function readConsent(storage) {
  try {
    const raw = storage && storage.getItem(CONSENT_KEY);
    return raw === GRANTED || raw === DENIED ? raw : null;
  } catch (e) {
    return null;
  }
}

/** Persist the answer. Returns false if storage refused, so the caller can tell. */
export function writeConsent(storage, accepted) {
  try {
    storage.setItem(CONSENT_KEY, accepted ? GRANTED : DENIED);
    return true;
  } catch (e) {
    return false;
  }
}

/**
 * Forget the answer, so the banner asks again.
 *
 * This is the withdrawal path, and withdrawal has to be as easy as consent —
 * an EEA requirement that is failed far more often than it is met, usually by
 * offering no mechanism at all.
 */
export function clearConsent(storage) {
  try {
    storage.removeItem(CONSENT_KEY);
    return true;
  } catch (e) {
    return false;
  }
}

/** Has this visitor answered at all? */
export function hasAnswered(storage) {
  return readConsent(storage) !== null;
}

/** Should the banner be shown? Only when there is no answer on file. */
export function shouldPrompt(storage) {
  return !hasAnswered(storage);
}

/**
 * May the Meta pixel (and Clarity) be loaded?
 *
 * Meta has no cookieless mode, so this is a hard gate. An explicit answer always
 * wins: GRANTED loads, DENIED does not, wherever the visitor is. With NO answer
 * on file the region decides -- opt-in regions (and unknown) withhold, opt-out
 * regions load. Called without a region it behaves exactly as it always did.
 */
export function metaAllowed(storage, region) {
  const answer = readConsent(storage);
  if (answer === GRANTED) return true;
  if (answer === DENIED) return false;
  return region === undefined ? false : !isOptInRegion(region);
}
