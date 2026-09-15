// ── JAY-TRACKING-B1: putting the analytics module on every page ──────────────
//
// One `<script type="module">` in the head, injected at the edge. The
// alternative was pasting a snippet into ~130 static HTML files, which would be
// wrong twice: it forks immediately (the nav in this repo forked exactly that
// way and #227 spent a ticket un-forking it), and every page Paul adds later
// would silently ship untracked.
//
// Injected at the edge, a new page is tracked the day it exists, with no upkeep
// and nobody to remember.
//
// WHERE THE TAG GOES, AND WHY NOT A `head` HANDLER OF ITS OWN
//
// It composes into the `headTags` string that `layerHandlers` emits, alongside
// `routerTags`, `barStylesheetTag`, `footerStylesheetTag` and `navStylesheetTag`.
// It CANNOT be its own `['head', …]` handler: lol-html keeps only the LAST
// onEndTag callback per element, so a second head handler would silently delete
// the layer's tags. That trap is documented at the top of `_middleware.js` and
// this module obeys it rather than rediscovering it.
//
// The tag is a same-origin `src`, so `script-src 'self'` admits it and it needs
// no nonce — the same reasoning the layer's own script tag already relies on.
// Injected content is not re-fed through the handlers, so NonceStamper never
// sees it, which is fine for exactly that reason.

/** The module the tag points at. Same-origin; `script-src 'self'` covers it. */
export const ANALYTICS_MODULE_SRC = '/js/analytics.js';
export const GTM_CONTAINER_ID = 'GTM-W9DH8BN6';
export const GTM_MODULE_SRC = '/js/gtm.js';

const TAG = `<script type="module" src="${ANALYTICS_MODULE_SRC}"></script>`;
const GTM_TAG = `<script type="module" src="${GTM_MODULE_SRC}"></script>`;
const GTM_NOSCRIPT = `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${GTM_CONTAINER_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`;

function gtmEnabled(env) {
  return analyticsEnabled(env) || env?.CF_PAGES === '1';
}

/**
 * Is analytics switched on for this deployment?
 *
 * ── WHY THIS DIVERGES FROM `routerEnabled` ──────────────────────────────────
 *
 * `routerEnabled` defaults ON for `*.pages.dev` and localhost so previews
 * exercise it, and OFF in production until the flag is set. That is the right
 * shape for a router. It is the WRONG shape here.
 *
 * A preview deploy running the real tags would send test traffic to the real
 * GA4 property, the real Ads conversions and the real Meta dataset — the exact
 * pollution Elroy avoided by scoping `META_CAPI_TOKEN` to Production only. Fake
 * conversions do not merely look untidy in a report: Smart Bidding learns from
 * them, so a week of QA clicks teaches the algorithm to buy the wrong people.
 *
 * So: OFF everywhere unless someone explicitly says `on`. Merging this PR
 * changes nothing observable; deploying it changes nothing observable; setting
 * `ANALYTICS=on` in the Cloudflare environment is the single act that starts
 * tracking, and unsetting it is the whole rollback.
 *
 * Preview verification does not need the tags anyway — `window.__dlAnalytics`
 * records every event with or without a vendor tag present, which is how the
 * wiring is checked without touching live data.
 */
export function analyticsEnabled(env) {
  const flag = env && typeof env.ANALYTICS === 'string' ? env.ANALYTICS.trim().toLowerCase() : '';
  if (flag) return flag === 'on';
  return !!(env && env.CF_PAGES === '1' && env.CF_PAGES_BRANCH === 'local');
}

/**
 * The head tag, or '' when analytics is off.
 *
 * Same shape as `navStylesheetTag(scan)` — a string that composes into
 * `headTags` — so the middleware's head injection stays one concatenation with
 * one owner.
 */
export function analyticsTag(env) {
  return analyticsEnabled(env) ? TAG + tagConfigTags(env) : '';
}

/** GTM is enabled for local/Cloudflare Pages deployments. */
export function gtmTag(env) {
  return gtmEnabled(env) ? GTM_TAG : '';
}

/** The GTM fallback belongs immediately after <body> on enabled deployments. */
export function gtmBodyHandlers(env) {
  return gtmEnabled(env)
    ? [['body', { element: (el) => el.prepend(GTM_NOSCRIPT, { html: true }) }]]
    : [];
}

/**
 * The visitor's country, as a `<meta name="dl:region">` the browser can read.
 *
 * Cloudflare geolocates every request (`request.cf.country`, mirrored in the
 * `cf-ipcountry` header). js/analytics/consent.js uses it to choose the consent
 * DEFAULT: opt-in for the EEA/UK/CH, opt-out elsewhere. Anything that is not two
 * letters (Cloudflare's 'XX' unknown and 'T1' Tor included) is emitted as-is and
 * the browser treats it as unknown, which fails closed to opt-in. Never throws:
 * a geolocation hiccup must not take the page down with it.
 */
export function regionTag(request) {
  try {
    const cf = request && request.cf;
    let c = (cf && typeof cf.country === 'string') ? cf.country : '';
    if (!c && request && request.headers && typeof request.headers.get === 'function') {
      c = request.headers.get('cf-ipcountry') || '';
    }
    c = String(c).trim().toUpperCase().slice(0, 2).replace(/[^A-Z0-9]/g, '');
    return c ? `<meta name="dl:region" content="${c}">` : '';
  } catch (e) {
    return '';
  }
}

// ── PER-DEPLOYMENT TAG CONFIGURATION ─────────────────────────────────────────
//
// The GA4 property, Ads conversion account and Meta dataset are per-FIRM, not
// per-product. They used to be literals in `js/analytics/events.js`, so a second
// law office meant editing source. Now a deployment can override them with
// environment variables and the code ships unchanged.
//
// Emitted as `<meta>` rather than an inline script: injected content is never
// re-fed through NonceStamper, so an inline `<script>` could not carry this
// request's nonce. A `<meta>` has no CSP interaction at all. `js/analytics/
// config.js` reads them and validates each one before use.
//
// ⚠️ These are PUBLIC identifiers — they ship to every visitor in the page. Set
// them as plain environment VARIABLES, never as Cloudflare secrets. Secrets are
// write-only in the dashboard, which would make it impossible to check which
// GA4 property a deployment is actually reporting to.
//
// Unset ⇒ nothing emitted ⇒ config.js keeps Donovan's defaults. So this is inert
// for the current deployment and does not change a single byte of what it sends.

/** env var → meta name. Label vars are `DL_LABEL_<EVENT>`. */
const CONFIG_VARS = Object.freeze({
  GA4_MEASUREMENT_ID: 'dl:ga4',
  ADS_CONVERSION_ID:  'dl:ads',
  META_DATASET_ID:    'dl:meta-dataset',
  CLARITY_PROJECT_ID: 'dl:clarity',
});

const LABEL_VARS = Object.freeze({
  DL_LABEL_BOOKING_CONFIRMED:   'dl:label:booking_confirmed',
  DL_LABEL_QUALIFIER_SUBMITTED: 'dl:label:qualifier_submitted',
  DL_LABEL_CALL_STARTED:        'dl:label:call_started',
  DL_LABEL_MESSAGE_TAKEN:       'dl:label:message_taken',
});

/**
 * Escape a value for an HTML attribute.
 *
 * These come from the deployment's own environment, not from a request, so this
 * is not an XSS boundary in the usual sense. It is still escaped: a stray quote
 * in a mis-pasted variable would otherwise break out of the attribute and
 * corrupt the head of every page on the site — a total outage caused by a typo
 * in a dashboard field.
 */
const attr = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Read a non-empty trimmed string var, or ''. */
function envStr(env, key) {
  const v = env && env[key];
  return typeof v === 'string' && v.trim() ? v.trim() : '';
}

/**
 * The `<meta>` tags describing this deployment's identifiers.
 *
 * Returns '' when nothing is configured, which is the current production state.
 */
export function tagConfigTags(env) {
  if (!env) return '';
  let out = '';
  for (const [key, name] of Object.entries({ ...CONFIG_VARS, ...LABEL_VARS })) {
    const v = envStr(env, key);
    if (v) out += `<meta name="${name}" content="${attr(v)}">`;
  }
  return out;
}
