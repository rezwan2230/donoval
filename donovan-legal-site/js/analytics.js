// ── JAY-TRACKING-A1: analytics entry point ───────────────────────────────────
//
// Boots the tracker and, once the CSP allows it, the two vendor tags.
//
// Reached only when `ANALYTICS=on` is set for the deployment: the edge injects
// the tag that loads this file, and the CSP grows the two vendor hosts, from the
// same flag. See `functions/_lib/analytics-inject.js` — with the flag unset,
// nothing here runs and the policy carries no analytics allowance.
//
// See docs/MARKETING-TRACKING-HANDOFF.md.

import { DEFAULT_TAG_CONFIG } from './analytics/events.js';
import { resolveTagConfig } from './analytics/config.js';
import { createTracker } from './analytics/tracker.js';
import { DENIED, readConsent, defaultConsentCalls, consentUpdate, metaAllowed, isOptInRegion } from './analytics/consent.js';
import { mountConsentBanner, wireConsentReopen } from './analytics/consent-banner.js';

/**
 * Install the Google tag.
 *
 * ── GA4: `send_page_view: false`, and it is required ────────────────────────
 *
 * This site navigates client-side (Swup), so gtag's automatic page view fires
 * once, on the first document, and never again. The tracker fires page views
 * itself on every swap including the first. Leaving the automatic one on would
 * double-count the entry page of every session and under-count everything else.
 *
 * ── GOOGLE ADS: the automatic page view STAYS ON, and that is the fix ───────
 *
 * This flag used to be set on both streams, with the comment above given as the
 * reason for both. It does not transfer, and the mistake was invisible:
 *
 *   • the tracker replaces the suppressed page view — but only for GA4
 *     (`tracker.js`, `send_to: tagConfig.ga4`)
 *   • Google Ads was sent NOTHING except conversion events
 *   • and no conversion had fired yet, because `booking_confirmed` needs a real
 *     booking
 *
 * So Google Ads had received zero hits, ever, and its diagnostics correctly
 * reported the tag as never detected — while GA4 was collecting normally. Two
 * streams, one compensating mechanism, and the flag applied to both.
 *
 * The double-counting argument is a GA4 REPORTING concern. Google Ads has no
 * page-view metric to inflate; it uses these hits for tag detection and, more
 * importantly, to build remarketing audiences. Suppressed, no audience can ever
 * accumulate — so the 100-user Display and 1,000-user Search thresholds would
 * never be reached no matter how much traffic the site got. That failure would
 * have surfaced months later as "remarketing just doesn't work here", with
 * nothing in the code obviously wrong.
 *
 * One automatic hit per document load is the right amount: enough to tag the
 * visitor, and SPA swaps do not need to repeat it.
 */
/**
 * The visitor's country as the edge saw it, or '' when the meta is absent.
 * Written by functions/_lib/analytics-inject.js from Cloudflare's request
 * geolocation. '' makes every consent decision fall back to opt-in.
 */
export function readRegion(doc) {
  if (!doc || typeof doc.querySelector !== 'function') return '';
  const el = doc.querySelector('meta[name="dl:region"]');
  const v = el && el.getAttribute('content');
  return typeof v === 'string' ? v.trim() : '';
}

export function installGoogleTag(win, doc, cfg = DEFAULT_TAG_CONFIG, region = undefined) {
  if (win.gtag) return;

  win.dataLayer = win.dataLayer || [];
  // gtag must push `arguments`, not an array literal — Google's own loader
  // depends on the arguments object's shape.
  function gtag() { win.dataLayer.push(arguments); }
  win.gtag = gtag;

  // ── CONSENT MODE v2 — set BEFORE anything else, including the loader ───────
  //
  // Order is the whole contract. gtag applies the FIRST default it sees, so a
  // default published after `config` is too late and the first hit of the
  // session goes out with storage granted. Everything ad- and
  // analytics-related starts denied; a stored acceptance is replayed as an
  // `update` immediately below, which is what `wait_for_update` leaves room for.
  // Region-scoped since 2026-09-03 -- see js/analytics/consent.js. With the
  // region unknown or opt-in this is the single denied default it always was.
  for (const params of defaultConsentCalls(region)) gtag('consent', 'default', params);

  gtag('js', new Date());
  gtag('config', cfg.ga4, { send_page_view: false });
  // No options object: Ads keeps its automatic page view. See the header — this
  // is what makes the tag detectable and lets remarketing audiences build.
  gtag('config', cfg.ads);

  const s = doc.createElement('script');
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${cfg.ga4}`;
  // The middleware issues a per-request nonce and stamps it onto inline
  // scripts. gtag.js propagates the nonce of the script that loaded it to the
  // scripts it injects, so carrying it here keeps the whole chain inside the
  // policy — no 'unsafe-inline' anywhere.
  const nonce = currentNonce(doc);
  if (nonce) s.setAttribute('nonce', nonce);
  doc.head.appendChild(s);
}

/**
 * Install the Meta pixel.
 *
 * PageView is deliberately NOT tracked here — the tracker owns it, for the same
 * client-side-routing reason as above. Meta's stock snippet ends with a
 * `fbq('track','PageView')` and copying that in would give the entry page two.
 *
 * If this ever fights the CSP (Meta's fbevents.js is less careful about nonce
 * propagation than Google's tag), the answer is to drop it and rely on the
 * server-side Conversions API in PR C — NOT to weaken the policy. That decision
 * is recorded in the handoff doc rather than left to whoever hits it at 11pm.
 */
export function installMetaPixel(win, doc, cfg = DEFAULT_TAG_CONFIG) {
  if (win.fbq) return;

  const n = win.fbq = function () {
    n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
  };
  if (!win._fbq) win._fbq = n;
  n.push = n;
  n.loaded = true;
  n.version = '2.0';
  n.queue = [];

  const s = doc.createElement('script');
  s.async = true;
  s.src = 'https://connect.facebook.net/en_US/fbevents.js';
  const nonce = currentNonce(doc);
  if (nonce) s.setAttribute('nonce', nonce);
  doc.head.appendChild(s);

  win.fbq('init', cfg.meta);
}

/**
 * This request's CSP nonce, read off a script the middleware already stamped.
 *
 * Reading it from the DOM rather than templating it in keeps this file static
 * and cacheable — the nonce changes every request, a static asset cannot carry
 * it, and the middleware is already the single owner of nonce issuance.
 */
function currentNonce(doc) {
  const el = doc.querySelector('script[nonce]');
  // `nonce` is hidden from attribute reads in some browsers as an
  // exfiltration defence; the IDL property still works.
  return (el && (el.nonce || el.getAttribute('nonce'))) || null;
}

/**
 * Wire everything up.
 *
 * `loadVendors` defaults false so importing this module — in a test, or from
 * anywhere that only wants the tracker — never reaches for a vendor host. The
 * self-boot at the bottom passes true, because the only thing that loads this
 * file is the edge tag, and the edge only emits that tag when the flag that
 * also widens the CSP is on. Policy and page cannot disagree.
 */
/**
 * Install Microsoft Clarity (session replay + heatmaps).
 *
 * Loads ONLY when a project id is configured AND — because recordings are
 * tracking in the fullest sense, with no cookieless mode — under exactly the
 * same consent gate as the Meta pixel: not before a visitor accepts, and on
 * acceptance it starts with that page. Masking is configured Strict in the
 * Clarity dashboard, not here; this module only decides WHETHER it runs.
 */
export function installClarity(win, doc, cfg = DEFAULT_TAG_CONFIG) {
  if (!cfg.clarity || win.clarity) return;
  const c = win.clarity = function () { (c.q = c.q || []).push(arguments); };
  const s = doc.createElement('script');
  s.async = true;
  s.src = `https://www.clarity.ms/tag/${cfg.clarity}`;
  const nonce = currentNonce(doc);
  if (nonce) s.setAttribute('nonce', nonce);
  doc.head.appendChild(s);
}

export function boot(win = globalThis, { loadVendors = false } = {}) {
  const doc = win.document;
  if (!doc) return null;
  if (win.__dlAnalytics) return win.__dlAnalytics;

  // This deployment's identifiers, from `<meta>` tags the edge injected, falling
  // back to Donovan's defaults. Resolved once and threaded everywhere so the
  // pixel, the Google tag and the tracker cannot disagree about which accounts
  // they are reporting to.
  const tagConfig = resolveTagConfig(win);
  // Where the visitor is, per the edge. Drives the consent DEFAULT only; an
  // answer the visitor already gave always outranks it.
  const region = readRegion(doc);

  let storage = null;
  try { storage = win.localStorage; } catch (e) { storage = null; }

  if (loadVendors) {
    // Google loads either way. Under Consent Mode v2 with everything denied it
    // sets no cookies and sends no identifiers — only cookieless pings Google
    // can model from. That is what makes "tracking waits for the answer"
    // affordable rather than a total blackout for anyone who scrolls past.
    try { installGoogleTag(win, doc, tagConfig, region); } catch (e) { /* never break the page */ }
    if (metaAllowed(storage, region)) {
      // Meta has NO cookieless mode: the pixel either runs or it does not. So
      // "declined" and "not answered yet" are the same instruction here, and
      // fbevents.js is not fetched at all until someone accepts.
      try { installMetaPixel(win, doc, tagConfig); } catch (e) { /* never break the page */ }
      try { installClarity(win, doc, tagConfig); } catch (e) { /* never break the page */ }
    }
    try { applyStoredConsent(win, storage); } catch (e) { /* never break the page */ }
  }

  const tracker = createTracker({ win, doc, config: tagConfig });
  tracker.start();

  // Exposed for QA: `__dlAnalytics.buffer` shows every event this page raised,
  // whether or not a vendor tag was there to receive it. Before PR B that
  // buffer is the ONLY evidence the wiring works, and after it, it is the
  // fastest way to tell "the event never fired" from "the event fired and the
  // platform dropped it" — two problems with completely different fixes.
  win.__dlAnalytics = tracker;

  if (loadVendors) {
    // Shown only when there is no answer on file. A visitor who declined is not
    // re-asked on every page — nagging, and its own compliance problem in the
    // EEA. Mounted after the tracker so a decision can act on a live tracker.
    // 2026-09-06 (Paul): the banner is for the regions where consent is REQUIRED
    // (the opt-in list, and unknown, which fails closed). Elsewhere the granted
    // default already applies and the opt-out control on /disclaimer remains; a
    // US visitor was being asked Accept/Decline on every visit until they clicked.
    try {
      if (isOptInRegion(region)) mountConsentBanner(win, (accepted) => {
        if (typeof win.gtag === 'function') win.gtag('consent', 'update', consentUpdate(accepted));
        // Meta was withheld until now; an accept is the first moment it may load.
        if (accepted) {
          try { installMetaPixel(win, doc, tagConfig); } catch (e) { /* no-op */ }
          try { installClarity(win, doc, tagConfig); } catch (e) { /* no-op */ }
        }
      });
    } catch (e) { /* a banner that fails to mount must not stop the page */ }

    // The opt-out control on /disclaimer. A no-op on every other page, and on
    // that page too when this module never loaded — which is the point: the
    // element stays hidden rather than offering a setting that does not exist.
    try { wireConsentReopen(win); } catch (e) { /* no-op */ }
  }

  return tracker;
}

/**
 * Replay a previously stored answer.
 *
 * A returning visitor already told us. Without this they would be treated as
 * denied for the first hit of every session despite having accepted — which
 * under-reports, and is the sort of thing that looks like "the tag is broken".
 */
function applyStoredConsent(win, storage) {
  if (typeof win.gtag !== 'function') return;
  const answer = readConsent(storage);
  if (answer === DENIED) {
    // A visitor in an opt-out region who clicked Decline started this page load
    // with a GRANTED default. Their answer has to be replayed the same way an
    // acceptance is, or Decline would be a button that does nothing after the
    // first page.
    win.gtag('consent', 'update', consentUpdate(false));
  } else if (metaAllowed(storage)) {
    win.gtag('consent', 'update', consentUpdate(true));
  }
}

// Self-boot when loaded as a module in a browser. Importing this file in Node
// (as the tests do) must have no effect, hence the document check.
if (typeof document !== 'undefined') boot(window, { loadVendors: true });
