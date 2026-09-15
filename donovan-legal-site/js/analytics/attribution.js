// ── JAY-TRACKING-C1: attribution that survives the journey ───────────────────
//
// THE DEFECT THIS FIXES
//
// The tracker read `gclid` off `window.location.search` at the moment an event
// fired. On this site the interesting events almost never happen on the landing
// URL: someone arrives at `/tax-controversy?gclid=ABC`, reads, talks to Paula,
// taps through the qualifier and books on `/book`. By then the query string is
// long gone, so every conversion went out with NO click id attached.
//
// Google itself would still have attributed the browser-side conversion — gtag
// keeps its own `_gcl_aw` cookie — so the failure was invisible in the Ads
// report and would have stayed invisible. What it silently broke is everything
// that reads OUR parameters: the offline import that tells Google a booking was
// worth 20x a general inquiry, and Meta's server-side matching, which needs the
// `fbclid` and has no cookie of its own to fall back on.
//
// So: capture once, on first sight, and carry it for the rest of the visit.
//
// WHY FIRST-TOUCH WINS WITHIN A VISIT
//
// If a visitor arrives on an ad and later re-enters with different parameters,
// the stored set is NOT overwritten unless the new one carries its own click id.
// A `utm_source=newsletter` link clicked mid-visit must not erase the gclid that
// paid for them being here. A genuine second ad click does carry a click id, and
// that is the one case where overwriting is right.

const KEY = 'dl.attr.v1';

/** Everything worth carrying. Click ids first — they are the ones that pay. */
export const ATTRIBUTION_KEYS = Object.freeze([
  'gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid',
  'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
]);

/** The ids that identify a paid click, as opposed to mere campaign tagging. */
export const CLICK_ID_KEYS = Object.freeze(['gclid', 'gbraid', 'wbraid', 'fbclid', 'msclkid']);

/** Lift attribution parameters out of a query string. Pure. */
export function parseAttribution(search) {
  const out = {};
  if (!search) return out;
  const qs = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  for (const key of ATTRIBUTION_KEYS) {
    const v = qs.get(key);
    if (v) out[key] = v;
  }
  return out;
}

export const hasClickId = (attr) => CLICK_ID_KEYS.some((k) => attr && attr[k]);

/** What is on file for this visit, or an empty object. */
export function readStored(storage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch (e) {
    // Corrupt JSON, or storage that throws (Safari private mode). Either way the
    // right answer is "we know nothing", never a half-parsed object.
    return {};
  }
}

/**
 * Decide what should be on file after seeing this URL.
 *
 * Pure, so the precedence rule is testable without a browser — it is the part
 * that is easy to get subtly wrong and impossible to notice afterwards.
 */
export function merge(stored, incoming) {
  const haveStored = Object.keys(stored || {}).length > 0;
  if (!Object.keys(incoming || {}).length) return stored || {};
  if (!haveStored) return { ...incoming };
  // A fresh paid click replaces the record. Anything else — a newsletter link, a
  // shared URL with utm tags — must not erase the click that paid for the visit.
  return hasClickId(incoming) ? { ...incoming } : { ...stored };
}

/**
 * Capture from the current URL and return everything known for this visit.
 *
 * Called once per page load. Writes only when the record actually changes, so a
 * visitor browsing twenty pages performs one write rather than twenty.
 */
export function captureAttribution(win) {
  let storage = null;
  try { storage = win.localStorage; } catch (e) { storage = null; }

  const incoming = parseAttribution(win.location && win.location.search);
  const stored = readStored(storage);
  const next = merge(stored, incoming);

  if (storage && JSON.stringify(next) !== JSON.stringify(stored)) {
    try { storage.setItem(KEY, JSON.stringify(next)); } catch (e) { /* nothing to do */ }
  }
  return next;
}

export const ATTRIBUTION_KEY = KEY;
