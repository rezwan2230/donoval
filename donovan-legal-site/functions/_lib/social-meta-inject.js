// ── JAY-SEO-E1: social preview tags, at the edge ─────────────────────────────
//
// Derives the `twitter:*` card and the missing `og:*` fields from what each page
// ALREADY declares, and injects them into the head.
//
// WHY THE EDGE AND NOT 130 FILES
//
// There is no templating in this repo — the chrome is copy-pasted across ~130
// HTML pages and has already forked once (#227 spent a ticket un-forking the
// nav). Pasting Twitter cards into every file would fork again on the first
// hand-edit, and every page Paul adds later would ship without them.
//
// Injected at the edge, a new page gets correct social previews the day it
// exists, with no upkeep and nobody to remember. Same argument as the analytics
// tag, and the same place.
//
// WHY THIS CAN READ THE PAGE AT ALL
//
// `_middleware.js` already buffers the whole document (`const html = await
// out.text()`) to build the div-ordinal plan. So the values are available BEFORE
// the rewriter runs, and these tags can compose into the existing `headTags`
// string. That matters: lol-html keeps only the LAST `onEndTag` per element, so
// a second `['head', …]` handler would silently delete the layer's tags. This
// module returns a string and registers no handler of its own.
//
// EVERYTHING HERE IS ADDITIVE AND IDEMPOTENT
//
//
// ── WHY THERE IS NO BreadcrumbList HERE (audit item M2) ─────────────────────
//
// It was written, and then removed, because this repo forbids the EDGE from
// injecting an inline <script> — including `application/ld+json`. Five tests
// enforce it (`no inline <style> and no inline <script>`, the head snapshot, the
// utility-bar and footer nonce guards). Injected content is never re-fed through
// NonceStamper, so an injected script cannot be brought inside the nonce CSP by
// the normal path, and the invariant exists precisely so nobody has to reason
// about that per injection site.
//
// Static JSON-LD in a page's own source is fine and already used — 40 blog posts
// carry Article schema, and NonceStamper stamps it because it is in the original
// bytes. So BreadcrumbList is a per-page change, not an edge one, and it belongs
// with the other per-page schema work rather than being forced through here.
//
// A tag the page already declares is never emitted twice — `og:title` stays
// whatever the page says. Two `og:title`s is not a cosmetic problem: scrapers
// take the first, or the last, or neither, depending on the scraper.

/**
 * Read a meta tag's content out of buffered HTML.
 *
 * Attribute order varies across these hand-written pages, so both orders are
 * tried rather than assuming the one the homepage happens to use.
 */
function readMeta(html, attr, value) {
  const v = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]*\\s${attr}=["']${v}["'][^>]*\\scontent=["']([^"']*)["']`, 'i'),
    new RegExp(`<meta[^>]*\\scontent=["']([^"']*)["'][^>]*\\s${attr}=["']${v}["']`, 'i'),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m && m[1]) return decodeEntities(m[1].trim());
  }
  return '';
}

/** Does the page already declare this tag? Then we leave it alone. */
function hasMeta(html, attr, value) {
  const v = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`<meta[^>]*\\s${attr}=["']${v}["']`, 'i').test(html);
}

/** The handful of entities that realistically appear in these pages' meta content. */
function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

/** Escape for an HTML attribute. */
const attrEsc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Read the document title. */
function readTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? decodeEntities(m[1].replace(/\s+/g, ' ').trim()) : '';
}

/**
 * The `twitter:*` card, derived from the page's own Open Graph tags.
 *
 * Derived rather than authored because the OG tags are already per-page, already
 * reviewed, and already correct. Writing a second set by hand would be a second
 * thing to keep in step with the first — and the pair would drift silently,
 * because nothing renders both.
 *
 * ⚠️ `twitter:image:width/height` and `og:image:width/height` are DELIBERATELY
 * NOT emitted. The current `og:image` is a portrait headshot, not the 1200×630
 * card Jason's audit asks for, and declaring dimensions we have not measured
 * would make the crop worse rather than better — a platform trusts the numbers
 * over the file. They belong with the branded OG image, which needs a designer.
 */
function twitterTags(html) {
  // A page that already has a card is left completely alone, rather than having
  // individual fields topped up into an inconsistent mixture.
  if (hasMeta(html, 'name', 'twitter:card')) return '';

  const title = readMeta(html, 'property', 'og:title') || readTitle(html);
  const desc = readMeta(html, 'property', 'og:description')
    || readMeta(html, 'name', 'description');
  const image = readMeta(html, 'property', 'og:image');

  if (!title) return '';

  // `summary`, NOT `summary_large_image` — and this is a deliberate divergence
  // from the audit's recommendation.
  //
  // `summary_large_image` renders a wide banner and needs a ~1200×630 asset. The
  // only image these pages declare is a PORTRAIT headshot, which a large card
  // crops through the face. `summary` shows a small square thumbnail and handles
  // a portrait correctly. Upgrade this line the day the branded OG cover exists
  // (audit item H3, needs a designer) — not before.
  let out = '<meta name="twitter:card" content="summary">';
  out += `<meta name="twitter:title" content="${attrEsc(title)}">`;
  if (desc) out += `<meta name="twitter:description" content="${attrEsc(desc)}">`;
  if (image) {
    out += `<meta name="twitter:image" content="${attrEsc(image)}">`;
    const alt = readMeta(html, 'property', 'og:image:alt') || title;
    out += `<meta name="twitter:image:alt" content="${attrEsc(alt)}">`;
  }
  return out;
}

/** The `og:` fields the pages are missing. Only ever adds. */
function ogCompletionTags(html) {
  let out = '';
  if (!hasMeta(html, 'property', 'og:locale')) {
    out += '<meta property="og:locale" content="en_US">';
  }
  const image = readMeta(html, 'property', 'og:image');
  if (image) {
    if (!hasMeta(html, 'property', 'og:image:alt')) {
      const alt = readMeta(html, 'property', 'og:title') || readTitle(html);
      if (alt) out += `<meta property="og:image:alt" content="${attrEsc(alt)}">`;
    }
    // Only when it is genuinely https — declaring a secure_url that is not
    // secure is worse than omitting it.
    if (!hasMeta(html, 'property', 'og:image:secure_url') && image.startsWith('https://')) {
      out += `<meta property="og:image:secure_url" content="${attrEsc(image)}">`;
    }
  }
  return out;
}

/**
 * Everything this module contributes to `<head>`, as one string.
 *
 * Never throws: it runs inside the request path for every HTML page on the site,
 * and a malformed document must cost a social preview, not the page.
 *
 * @param {string} html  the buffered document
 */
export function socialMetaTags(html) {
  if (typeof html !== 'string' || !html) return '';
  try {
    return twitterTags(html) + ogCompletionTags(html);
  } catch (e) {
    return '';
  }
}
