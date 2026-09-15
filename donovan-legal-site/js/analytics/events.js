// ── JAY-TRACKING-A1: the analytics event catalogue ───────────────────────────
//
// This module is pure — no imports, no DOM, no top-level side effects — for the
// same reason `js/perch/placement.js` is: the catalogue IS the contract between
// this site and two ad platforms, and CI has to exercise THAT rather than a
// re-implementation of it. A test that imported the browser wiring would be
// asserting against a copy.
//
// The four business events below are the ones Google Ads already has conversion
// actions for. The labels are not secrets — they ship in the page on every site
// that runs a Google Ads tag — so they live in code, in one place, rather than
// in four call sites where they can drift.
//
// See docs/MARKETING-TRACKING-HANDOFF.md for why any of this exists.

// ── TENANT CONFIGURATION ─────────────────────────────────────────────────────
//
// Every identifier below is per-FIRM, not per-product. Onboarding a second law
// office means a different GA4 property, a different Ads account and a different
// Meta dataset — so they are DEFAULTS here, overridable per deployment, not
// constants baked into the product.
//
// The override arrives as `<meta name="dl:ga4" content="…">` tags injected into
// the head by `functions/_lib/analytics-inject.js` from the Cloudflare
// environment. `js/analytics/config.js` reads them. A new tenant is env vars on
// their own deployment, not a code edit.
//
// Meta tags rather than an inline JSON block on purpose: an inline `<script>`
// would need a nonce, and injected content is never re-fed through NonceStamper.
// A `<meta>` has no CSP interaction at all.
//
// ⚠️ THIS FILE STAYS PURE. No DOM, no imports, no top-level side effects — the
// catalogue IS the contract with two ad platforms and CI has to exercise THAT,
// not a re-implementation. So config is a PARAMETER here; reading it from the
// page is `config.js`'s job.

/**
 * Donovan Legal's identifiers — the defaults when a deployment sets no overrides.
 *
 * All three are public: they ship to every visitor in the page and are readable
 * with View Source. They belong in env VARS, never in Cloudflare secrets, which
 * are write-only in the dashboard and would make a marketing ID impossible to
 * verify after the fact.
 */
export const DEFAULT_TAG_CONFIG = Object.freeze({
  ga4:  'G-187CYLV2YX',
  ads:  'AW-18269868294',
  meta: '1769060274465061',
  /** Microsoft Clarity project id. Empty ⇒ Clarity never loads; set the
   *  CLARITY_PROJECT_ID env var on the deployment to switch it on. */
  clarity: '',
  labels: Object.freeze({
    booking_confirmed:   'hG-rCJWFnNkcEIai4IdE',
    qualifier_submitted: '5l53CJ3rhtkcEIai4IdE',
    call_started:        'Qj83CJ_qhtkcEIai4IdE',
    message_taken:       'BMoiCJrrhtkcEIai4IdE',
  }),
});

/** @deprecated Prefer the resolved config. Kept so existing imports still work. */
export const GA4_MEASUREMENT_ID = DEFAULT_TAG_CONFIG.ga4;

/** @deprecated Prefer the resolved config. */
export const ADS_CONVERSION_ID = DEFAULT_TAG_CONFIG.ads;

/** @deprecated Prefer the resolved config. */
export const META_DATASET_ID = DEFAULT_TAG_CONFIG.meta;

// ── The four business events ─────────────────────────────────────────────────

export const BOOKING_CONFIRMED    = 'booking_confirmed';
export const QUALIFIER_SUBMITTED  = 'qualifier_submitted';
export const CALL_STARTED         = 'call_started';
export const MESSAGE_TAKEN        = 'message_taken';

/** Not a conversion. Fired on every navigation, including client-side ones. */
export const PAGE_VIEW = 'page_view';

/**
 * Someone tapped a `tel:` link — the first micro-conversion.
 *
 * ── WHY THIS ONE MATTERS MORE THAN IT LOOKS ─────────────────────────────────
 *
 * Perch cannot transfer a caller; it points them at the phone number. So on the
 * web, "I want to speak to someone" ends as a tap on a `tel:` link and the
 * session ends there — currently reporting nothing at all.
 *
 * The call itself can never be attributed: a phone call carries no browser, no
 * `gclid`, no `_fbc`. **The tap can.** It happens in the page with the click id
 * still attached, which makes it the only measurable, attributable evidence of
 * phone intent we can have before Google call reporting exists.
 *
 * Deliberately NOT in the CATALOGUE. There is no Google Ads conversion action
 * for it and no Meta standard event that would not collide with `call_started`
 * (both would be `Contact`, and a visitor who does both would be counted twice).
 * So it goes to GA4 only, where it can be marked a key event and imported later
 * without inventing a label that does not exist.
 */
export const TEL_CLICK = 'tel_click';

/**
 * Where each business event goes.
 *
 * `ads` is the full `send_to` value. Google's own snippet format is
 * `<conversion id>/<label>`, and keeping them joined here means a call site can
 * never pair the right label with the wrong account.
 *
 * `meta` is the Meta standard event name. `Schedule` outranks `Lead` in the
 * Aggregated Event Measurement priority list (see the handoff doc §6) because a
 * booked consultation is worth more than a qualifier tap, and AEM only lets the
 * highest-priority event through for an opted-out iOS visitor.
 */
/**
 * The Meta standard event each business event maps to.
 *
 * Tenant-independent — these are Meta's vocabulary, not Donovan's, so they are
 * NOT part of the overridable config. Only the account identifiers vary per firm.
 */
export const META_EVENT = Object.freeze({
  [BOOKING_CONFIRMED]:   'Schedule',
  [QUALIFIER_SUBMITTED]: 'Lead',
  [CALL_STARTED]:        'Contact',
  [MESSAGE_TAKEN]:       'SubmitApplication',
});

/**
 * Build the routing table for one tenant's identifiers.
 *
 * A function rather than a literal so a second firm is configuration rather than
 * a fork. Unknown labels are skipped rather than emitted as `AW-x/undefined`,
 * which Google accepts and silently attributes nowhere.
 *
 * @param {object} [cfg] shape of DEFAULT_TAG_CONFIG
 */
export function buildCatalogue(cfg = DEFAULT_TAG_CONFIG) {
  const ads = (cfg && cfg.ads) || DEFAULT_TAG_CONFIG.ads;
  const labels = (cfg && cfg.labels) || {};
  const out = {};
  for (const name of Object.keys(META_EVENT)) {
    const label = labels[name];
    out[name] = Object.freeze({
      ga4:  name,
      // No label configured ⇒ no Ads destination. The GA4 event still fires, so
      // the signal is not lost; it just is not claimed as a conversion by an
      // account that has no action for it.
      ads:  label ? `${ads}/${label}` : null,
      meta: META_EVENT[name],
    });
  }
  return Object.freeze(out);
}

/**
 * Donovan's routing table — the default build.
 *
 * Retained as a named export because tests and the pure-module contract depend
 * on a catalogue that needs no page to exist. Runtime code should prefer
 * `buildCatalogue(resolveTagConfig(win))`.
 */
export const CATALOGUE = buildCatalogue(DEFAULT_TAG_CONFIG);

/** The conversions, in AEM priority order — highest value first. */
export const AEM_PRIORITY = Object.freeze([
  'Schedule', 'Lead', 'Contact', 'SubmitApplication', 'ViewContent', 'PageView',
]);

/**
 * Look up an event's destinations.
 *
 * Returns `null` for anything not in the catalogue rather than throwing: a
 * mis-typed event name must not be able to break a caller's booking flow. The
 * tracker treats null as "buffer it, send it nowhere", which shows up in QA as
 * a missing conversion rather than as a broken page.
 */
export function destinationsFor(name, catalogue = CATALOGUE) {
  return Object.prototype.hasOwnProperty.call(catalogue, name)
    ? catalogue[name]
    : null;
}

/** Is this a conversion (as opposed to `page_view`)? */
export function isConversion(name) {
  return destinationsFor(name) !== null;
}

/**
 * Mint an id that identifies ONE occurrence of an event.
 *
 * Both the browser event and the server-side copy (PR C) carry the same id, and
 * Meta uses it to collapse the two into one conversion. Without it the same
 * booking is counted twice, and the bidding algorithm learns from a number that
 * is wrong in the flattering direction.
 *
 * `crypto.randomUUID` is available in every browser this site supports and in
 * Node 22 (the engine floor in package.json). The fallback exists for
 * non-secure contexts, where `crypto` is present but `randomUUID` is not — it
 * only has to be unique within one visitor's session, not globally.
 */
export function newEventId(cryptoImpl) {
  const c = cryptoImpl || (typeof globalThis !== 'undefined' ? globalThis.crypto : undefined);
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  if (c && typeof c.getRandomValues === 'function') {
    const b = c.getRandomValues(new Uint8Array(16));
    return Array.from(b, (n) => n.toString(16).padStart(2, '0')).join('');
  }
  // No crypto at all. Still has to be unique per occurrence, so include a
  // counter — two events in the same millisecond are ordinary here (a page view
  // and a conversion can land together).
  fallbackCounter += 1;
  return `e${Date.now().toString(36)}${fallbackCounter.toString(36)}`;
}
let fallbackCounter = 0;

/**
 * The attribution parameters worth carrying on every event.
 *
 * Vantage's perch.js already captures these into its visitor record, which is
 * what PR C reads server-side. Reading them again here is not duplication: the
 * browser event and the server event are matched on `event_id`, and Meta's
 * browser-side matching additionally wants `fbclid` on the event itself.
 *
 * Pure: takes a query string, returns a plain object. No `location` access.
 */
export function attributionFrom(search) {
  const out = {};
  if (!search) return out;
  const qs = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of ['gclid', 'fbclid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content']) {
    const v = qs.get(key);
    if (v) out[key] = v;
  }
  return out;
}
