// Reading served HTML the way a JS-off crawler does — with a real parser.
//
// ── WHY THIS FILE EXISTS (CodeQL, PR #86) ────────────────────────────────────
// Both A5.1 suites started with the same hand-rolled extractor: strip comments,
// strip <script>/<style>/<noscript> with `[\s\S]*?` pairs, then `<[^>]+>` → ' '.
// CodeQL raised four HIGH alerts across the two copies —
// `js/bad-tag-filter` and `js/incomplete-multi-character-sanitization` — and it
// is right on the substance even though nothing here is a sanitiser: a
// single-pass `<[^>]+>` replace does not survive nested or malformed markup, and
// `<script\b[^>]*>` does not match every tag shape a browser accepts. An
// extractor that disagrees with a browser is a measurement bug in a gate whose
// entire job is "what does a crawler actually receive", so the answer is not to
// suppress the alert — it is to stop parsing HTML with regexes.
//
// jsdom is already a devDependency and is the parser the rest of the suite uses.
// It does NOT execute scripts unless `runScripts` is set, which is exactly the
// JS-off condition being modelled.
//
// ── AND WHY IT IS SHARED ─────────────────────────────────────────────────────
// The four alerts were two defects counted twice, because the helper had been
// copied into a second file. One copy, imported by both.
//
// Memory-safety note: every function below drops its jsdom window before
// returning. Holding windows in an array is how this suite OOMs CI —
// [[feedback_jsdom_per_page_array_ooms_ci]].

import { JSDOM } from 'jsdom';

/** Parse once, hand the document to `fn`, and release the window. */
function withDocument(html, fn) {
  const dom = new JSDOM(html);
  try {
    return fn(dom.window.document);
  } finally {
    dom.window.close();
  }
}

/**
 * The text a JS-off crawler can read.
 *
 * `<script>`, `<style>` and `<noscript>` are removed rather than merely skipped:
 * content that exists only inside a script string is content the crawler never
 * sees, and that is the whole point of the measurement. Comments never appear in
 * `textContent`, so they need no handling.
 */
export function bodyText(html) {
  return withDocument(html, (doc) => {
    for (const el of doc.querySelectorAll('script, style, noscript')) el.remove();
    return (doc.body ? doc.body.textContent : '').replace(/\s+/g, ' ').trim();
  });
}

/** Words of server-rendered body text. */
export function wordCount(text) {
  return text.split(' ').filter(Boolean).length;
}

/** Convenience: the two are never wanted apart. */
export function bodyWords(html) {
  return wordCount(bodyText(html));
}

/** `<title>`, collapsed. */
export function titleOf(html) {
  return withDocument(html, (doc) => (doc.title || '').replace(/\s+/g, ' ').trim());
}

/**
 * h1 or h2 — some practice pages lead with h2; either proves a rendered heading.
 * Matches the A1.1 gate's definition so the two cannot disagree about a page.
 */
export function headings(html) {
  return withDocument(html, (doc) =>
    [...doc.querySelectorAll('h1, h2')].map((el) => el.textContent.trim()).filter(Boolean));
}

/**
 * True if the document carries a robots meta containing `noindex`.
 *
 * The attribute is matched case-insensitively by hand rather than with a `[i]`
 * attribute selector, so this does not depend on selector-level case folding.
 */
export function hasNoindex(html) {
  return withDocument(html, (doc) => {
    for (const meta of doc.querySelectorAll('meta[name]')) {
      if ((meta.getAttribute('name') || '').trim().toLowerCase() !== 'robots') continue;
      if (/\bnoindex\b/i.test(meta.getAttribute('content') || '')) return true;
    }
    return false;
  });
}

/** Does the document declare `<link rel="canonical" href="…">` equal to `href`? */
export function canonicalHref(html) {
  return withDocument(html, (doc) => {
    const link = doc.querySelector('link[rel="canonical"]');
    return link ? link.getAttribute('href') : null;
  });
}
