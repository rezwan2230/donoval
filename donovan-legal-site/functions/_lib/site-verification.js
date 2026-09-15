// ── JAY-SEO-E2: search-engine site verification ──────────────────────────────
//
// Emits the `<meta>` tag a webmaster console asks for when you prove you own a
// domain. Env-driven, so a second firm's deployment sets a variable rather than
// committing a file.
//
// WHY THIS IS NOT PART OF analytics-inject.js
//
// `analyticsTag()` is gated on `ANALYTICS=on`, and this must NOT be. Verification
// is about proving ownership of the domain, which has nothing to do with whether
// tracking is switched on — and the failure mode is nasty in a quiet way: Google
// re-checks the token periodically and **un-verifies a property whose tag has
// disappeared**. Tying it to the analytics flag would mean switching tracking off
// for an afternoon silently costs you Search Console access, with the loss
// showing up weeks later as missing data nobody can explain.
//
// WHY A META TAG AND NOT THE HTML-FILE METHOD
//
// Google also accepts an uploaded `googleXXXX.html` file. That would work, and it
// is arguably simpler — but it hardcodes one tenant's token into the repo, so a
// second firm needs a commit and a deploy rather than an environment variable.
// The meta tag rides the same edge-injection path everything else uses, so it is
// also automatically present on every page rather than only at the root, which
// is more robust: the console may fetch any URL it likes.
//
// It composes into the shared `headTags` string for the lol-html
// last-onEndTag-wins reason documented in `_middleware.js` — a second
// `['head', …]` handler would silently delete the layer's tags.
//
// ── HOW TO GET A TOKEN ───────────────────────────────────────────────────────
//
//   Google  → search.google.com/search-console → Add property → URL prefix
//             → https://www.donovan.law → "HTML tag" method. Copy ONLY the
//             `content` value, not the whole tag.
//             Set `GOOGLE_SITE_VERIFICATION`, redeploy, then click Verify.
//
//   Bing    → bing.com/webmasters → Add site → "HTML Meta Tag".
//             Set `BING_SITE_VERIFICATION`.
//
// ⚠️ These tokens are PUBLIC — they ship in the page and are readable with View
// Source. They are not secrets and gain nothing from being encrypted; they only
// prove that whoever set them can change the site. Leave the actual credentials
// (Clio, Retell, Turnstile) where they are.
//
// ⚠️ DO NOT REMOVE A TOKEN once a property is verified. The console re-checks it.

/** env var → the meta `name` each console looks for. */
const PROVIDERS = Object.freeze({
  GOOGLE_SITE_VERIFICATION: 'google-site-verification',
  BING_SITE_VERIFICATION: 'msvalidate.01',
});

/**
 * What a verification token is allowed to look like.
 *
 * Validated rather than trusted for the same reason the tag config is: a value
 * pasted with the surrounding `<meta …>` still attached, or with quotes, is the
 * realistic accident. It would not error — verification would simply never
 * succeed, and the person clicking "Verify" would have no idea why.
 *
 * Google's tokens are 43 URL-safe base64 characters; Bing's are 32 hex. The
 * range below is deliberately loose enough to survive either changing format,
 * and strict enough to reject a pasted tag or an empty string.
 */
const TOKEN_RE = /^[A-Za-z0-9_-]{16,128}$/;

const attr = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The verification meta tags for this deployment.
 *
 * Returns '' when nothing is configured, which is the current production state —
 * so this ships inert and changes not one byte until someone sets a variable.
 *
 * Never throws: it runs in the request path for every HTML page, and a malformed
 * environment must cost a verification, not the site.
 *
 * @param {object} env Worker environment
 * @returns {string} zero or more `<meta>` tags, concatenated
 */
export function siteVerificationTags(env) {
  if (!env) return '';
  let out = '';
  try {
    for (const [key, name] of Object.entries(PROVIDERS)) {
      const raw = env[key];
      const token = typeof raw === 'string' ? raw.trim() : '';
      if (!token) continue;
      if (!TOKEN_RE.test(token)) {
        // Loud enough to find, quiet enough not to leak the value.
        console.warn(`[site-verification] ${key} is malformed and was ignored`);
        continue;
      }
      out += `<meta name="${name}" content="${attr(token)}">`;
    }
  } catch (e) {
    return '';
  }
  return out;
}
