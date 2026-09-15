// ── JAY-TRACKING-D1: per-deployment tag configuration ────────────────────────
//
// Reads this deployment's advertising identifiers off `<meta>` tags the edge
// injected, falling back to Donovan's defaults when a deployment sets none.
//
// WHY THIS EXISTS
//
// The three identifiers — GA4 property, Ads conversion account, Meta dataset —
// are per-FIRM, not per-product. They were literals in `events.js`, which meant
// onboarding a second law office required editing source and shipping a build.
// Worse, the server-side Conversions API read `env.META_DATASET_ID` while the
// browser pixel kept its literal: two sources of truth for one ID, and if they
// ever disagreed half the conversions would land in a dataset nobody was
// looking at.
//
// Now: env vars on the deployment, injected as meta tags, read here. A new
// tenant is configuration.
//
// WHY META TAGS AND NOT AN INLINE SCRIPT
//
// An inline `<script>` — even a `type="application/json"` data block — invites a
// CSP argument this site has already settled. Injected content is never re-fed
// through NonceStamper, so it could not carry this request's nonce. A `<meta>`
// has no CSP interaction whatsoever, needs no nonce, and cannot execute.
//
// WHY NOT `window.__something`
//
// Same reason: setting a global needs an inline script to set it. The DOM is
// already the transport, exactly as `currentNonce()` in analytics.js reads the
// nonce off a stamped element rather than having it templated in.

import { DEFAULT_TAG_CONFIG } from './events.js';

/** The meta-tag names the edge writes. Kept in one place, used by both sides. */
export const META_NAMES = Object.freeze({
  ga4:  'dl:ga4',
  ads:  'dl:ads',
  meta: 'dl:meta-dataset',
  clarity: 'dl:clarity',
  /** Prefix; the full name is `dl:label:<event>`. */
  labelPrefix: 'dl:label:',
});

/**
 * Shapes a tag identifier is allowed to take.
 *
 * Validated rather than trusted because a mis-set environment variable is the
 * realistic failure — a trailing newline from a secrets pipeline, a copied value
 * with quotes still attached. An invalid ID does not error anywhere; it just
 * sends every conversion for the rest of the deployment's life to an account
 * that does not exist. Falling back to the known-good default is strictly
 * better than honouring a malformed override.
 */
const SHAPES = Object.freeze({
  ga4:  /^G-[A-Z0-9]{4,20}$/i,
  ads:  /^AW-\d{6,20}$/i,
  meta: /^\d{6,25}$/,
  clarity: /^[a-z0-9]{5,20}$/i,
  label: /^[A-Za-z0-9_-]{6,64}$/,
});

/** Read one meta tag's content, or '' if absent. */
function metaContent(doc, name) {
  if (!doc || typeof doc.querySelector !== 'function') return '';
  // Attribute selectors need the value quoted — these names contain a colon,
  // which is a pseudo-class introducer in a bare selector.
  const el = doc.querySelector(`meta[name="${name}"]`);
  const v = el && (el.getAttribute('content') || '');
  return typeof v === 'string' ? v.trim() : '';
}

/**
 * Resolve this deployment's tag config.
 *
 * Field-by-field, not all-or-nothing: a deployment that overrides only the GA4
 * property keeps Donovan's Ads and Meta values. All-or-nothing would make
 * partial configuration silently wrong, and partial configuration is the normal
 * state during an onboarding.
 *
 * Never throws — a missing document, a hostile meta tag and a typo all resolve
 * to the default, because the alternative is analytics taking down a page.
 *
 * @param {Window} [win]
 * @returns {{ga4:string, ads:string, meta:string, labels:object}}
 */
export function resolveTagConfig(win) {
  const doc = win && win.document;
  const out = {
    ga4:  DEFAULT_TAG_CONFIG.ga4,
    ads:  DEFAULT_TAG_CONFIG.ads,
    meta: DEFAULT_TAG_CONFIG.meta,
    clarity: DEFAULT_TAG_CONFIG.clarity,
    labels: { ...DEFAULT_TAG_CONFIG.labels },
  };
  if (!doc) return out;

  try {
    for (const key of ['ga4', 'ads', 'meta', 'clarity']) {
      const raw = metaContent(doc, META_NAMES[key]);
      if (raw && SHAPES[key].test(raw)) out[key] = raw;
    }

    // Labels are per-conversion-action and change with the Ads account, so a
    // deployment overriding `ads` almost always overrides these too. An override
    // REPLACES the default set rather than merging into it: a new account's
    // labels have nothing to do with Donovan's, and a half-merged set would
    // quietly report some conversions into the previous firm's account.
    const overrides = {};
    let sawAny = false;
    for (const name of Object.keys(DEFAULT_TAG_CONFIG.labels)) {
      const raw = metaContent(doc, META_NAMES.labelPrefix + name);
      if (!raw) continue;
      sawAny = true;
      if (SHAPES.label.test(raw)) overrides[name] = raw;
    }
    if (sawAny) out.labels = overrides;
  } catch (e) {
    // A broken selector or an exotic document must not stop the page.
    return {
      ga4: DEFAULT_TAG_CONFIG.ga4,
      ads: DEFAULT_TAG_CONFIG.ads,
      meta: DEFAULT_TAG_CONFIG.meta,
      clarity: DEFAULT_TAG_CONFIG.clarity,
      labels: { ...DEFAULT_TAG_CONFIG.labels },
    };
  }

  return out;
}

/** True when this deployment is running someone else's identifiers. */
export function isOverridden(cfg) {
  return !!cfg && (
    cfg.ga4 !== DEFAULT_TAG_CONFIG.ga4 ||
    cfg.ads !== DEFAULT_TAG_CONFIG.ads ||
    cfg.meta !== DEFAULT_TAG_CONFIG.meta
  );
}
