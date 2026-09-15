// ── Root middleware: per-request CSP nonce ─────────────────────────────────────
//
// Dr. Insane RE-GATE R2 blocker B3: `script-src 'unsafe-inline'` meant any XSS on
// a page carrying caller PII executed freely — the CSP was decorative against the
// exact attack that matters here.
//
// WHY A MIDDLEWARE AND NOT `_headers`.
// `_headers` is a static file, so it cannot carry a per-request nonce. The two
// static alternatives both fail on this site:
//   • hashes — 205 inline <script> blocks reduce to 85 unique bodies; 85 sha256
//     hashes is a ~4.4 KB Content-Security-Policy header on EVERY response.
//   • externalize all 205 — a 145-file edit with real regression risk, for no
//     security gain over a nonce.
// So the CSP is issued here instead, and HTMLRewriter stamps the matching nonce
// onto every inline <script> as the HTML streams past. No page edits, and an
// injected <script> cannot guess the nonce.
//
// CSP OWNERSHIP: this middleware is the ONLY place the Content-Security-Policy is
// set. It was deliberately removed from `_headers` in the same change — two
// sources would have meant browsers intersecting two policies, and a stale
// `unsafe-inline` in the static file would have silently widened the live one.
// Everything in `_headers` that is NOT the CSP (HSTS, nosniff, Permissions-Policy,
// cache rules) stays there; those need no per-request value.
//
// WHAT THIS DOES NOT COVER — inline event-handler attributes (onclick="…").
// A nonce cannot apply to an attribute; only `'unsafe-hashes'` can, which would
// reopen most of what this closes. The 255 such handlers were therefore rewritten
// to addEventListener via `js/inline-actions.js` in this same change. If a new
// `onclick=` is added to a page it will now silently stop working, which is the
// intended failure direction: broken button, not an open policy.
//
// STYLE-SRC — deliberately still 'unsafe-inline'. 1706 `style="…"` attributes
// across 145 files would each need a hash or a class refactor, and unlike
// script-src the exposure is CSS injection rather than script execution. David
// scoped this to script-src for now; the style-src refactor is the tracked
// follow-up in the PR body. It is called out here so nobody reads this file and
// concludes style-src was simply forgotten.

// ── SWAP CONTAINER (SHELDON-PERCH-A01) ────────────────────────────────────────
//
// The same reason this file exists at all — 143 pages that cannot be edited one by
// one — is why the router's swap container is injected here too. `_lib/perch-main.js`
// carries the whole argument; the only thing this file decides is WHERE in the
// response pipeline it happens: after the CSP/no-store headers are set, in the same
// HTMLRewriter pass that stamps the nonce, so an injected `<main>` costs one extra
// parse of an already-buffered body and nothing else.

import { planFromHtml, injectHandlers } from './_lib/perch-main.js';

// ── PERSISTENT LAYER (JORDAN-PERCH-A21) ───────────────────────────────────────
//
// The container above is only half of the arrangement: something has to hold the
// orb and the live call OUTSIDE it, or a swap unmounts the call it was built to
// protect. `_lib/perch-layer-inject.js` references that layer from the same
// `plan`, so a page gets a container and a layer together or neither.
import { layerHandlers } from './_lib/perch-layer-inject.js';

// ── SOFT NAVIGATION (SHELDON-PERCH-A22) ───────────────────────────────────────
//
// The third tag derived from the same `plan`: the Swup router that swaps the
// container A0.1 injects, under the layer A2.1 mounts. It is Preview-only by
// default — see `routerEnabled` in _lib/perch-router-inject.js for the gate and
// the PERCH_ROUTER kill switch — and it is emitted through `layerHandlers`
// rather than as its own `head` handler because lol-html keeps only the last
// `onEndTag` callback per element, so a second handler would delete the layer's
// tags outright.
import { routerTags } from './_lib/perch-router-inject.js';

/**
 * Directives that never vary per request. Kept here so the policy reads in one place.
 * Exported so test/csp.test.mjs can assert on the real policy string rather than a
 * copy of it — a test that re-declares the CSP proves only that the copy is correct.
 */
export function buildCsp(nonce) {
  return [
    "default-src 'self'",
    // No 'unsafe-inline'. Inline blocks are admitted ONLY by this request's nonce.
    // 'strict-dynamic' is intentionally NOT used: the site loads classic scripts
    // from the listed CDNs, and strict-dynamic would ignore those host allowances.
    `script-src 'self' 'nonce-${nonce}' https://vantage.ticoai.net https://cdn.theconnexus.ai https://portal.theconnexus.ai https://code.jquery.com https://cdnjs.cloudflare.com https://esm.sh https://challenges.cloudflare.com`,
    "connect-src 'self' https://esm.sh https://vantage.ticoai.net https://*.retellai.com wss://*.retellai.com wss://*.livekit.cloud https://*.livekit.cloud https://portal.theconnexus.ai https://challenges.cloudflare.com",
    // See the STYLE-SRC note above — tracked follow-up, not an oversight.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    "frame-src 'self' https://vantage.ticoai.net https://portal.theconnexus.ai https://challenges.cloudflare.com",
    // Framing is controlled here, not by X-Frame-Options — a blanket SAMEORIGIN
    // would block the Perch shell from iframing the site (the F-10 fix).
    "frame-ancestors 'self' https://vantage.ticoai.net https://*.ticoai.net",
    "base-uri 'self'",
    "form-action 'self' https://vantage.ticoai.net",
    "object-src 'none'",
  ].join('; ');
}

// ── STALE-NONCE / CACHING (SHELDON-NOSTORE) ───────────────────────────────────
//
// THE DEFECT, as observed live in the Perch shell: the CSP header is regenerated
// per request, but the HTML BODY carrying the matching nonce could come from a
// cache. When those two desync the browser sees a fresh `nonce-B` policy over a
// body stamped `nonce-A`, so every inline <script> on the page is blocked.
//
// Pages serves HTML with `cache-control: public, max-age=0, must-revalidate` and
// an ETag. That combination does NOT mean "do not cache" — it means "cache it,
// then revalidate every time". The revalidation returns 304 Not Modified, which
// carries no body, so the browser re-displays its STORED copy (nonce-A) while
// this middleware issues a brand-new policy (nonce-B) on that very 304. That is
// the desync, and it reproduces on every load until the cache entry is evicted.
//
// Closing it takes both halves, because they fix different populations:
//
//   1. RESPONSE SIDE — `no-store` + drop the validators. Stops a nonced body
//      from being stored at all, so no FUTURE request can revalidate one. The
//      ETag/Last-Modified strip matters because a validator left on the response
//      is exactly what a client would echo back to trigger the 304 above.
//
//   2. REQUEST SIDE — drop `If-None-Match` / `If-Modified-Since` on document
//      requests. Half 1 only helps clients that have not cached a page yet.
//      Browsers that ALREADY hold a nonced copy keep sending their stored
//      validator, and the asset handler keeps answering 304 with no body — so
//      they would stay broken indefinitely. Stripping the validator forces a
//      full 200, which streams through HTMLRewriter and gets a matching nonce.
//
// SCOPED TO HTML ON PURPOSE. `no-store` on /css /js /img would throw away the
// caching those assets are deliberately configured for in `_headers`, so half 1
// keys off the RESPONSE content-type and half 2 off the REQUEST destination —
// a stylesheet or image request still revalidates and still 304s normally.

/**
 * True when the client is asking for an HTML document, so half 2 above can skip
 * subresources. `sec-fetch-dest` is authoritative where present; `iframe` counts
 * because the Perch shell frames this site (the F-10 path). Older clients that
 * send no Fetch-Metadata fall back to the Accept header.
 */
function isDocumentRequest(request) {
  const dest = request.headers.get('sec-fetch-dest');
  if (dest) return dest === 'document' || dest === 'iframe';
  return (request.headers.get('accept') || '').includes('text/html');
}

/** Stamps nonce="…" onto every inline <script> (i.e. every <script> without src). */
class NonceStamper {
  constructor(nonce) { this.nonce = nonce; }
  element(el) {
    // A <script src="…"> is authorised by the host allow-list, not the nonce, and
    // stamping it would be harmless but pointless. Inline blocks are what need it.
    if (el.hasAttribute('src')) return;
    el.setAttribute('nonce', this.nonce);
  }
}

export async function onRequest(context) {
  const { request, next } = context;

  // Half 2 (see the STALE-NONCE note above): a document request that carries a
  // validator would be answered 304-with-no-body, re-displaying an old nonce.
  // Strip the validators so the asset handler must return a full 200 we can
  // stamp. Subresource requests are left untouched — they keep revalidating.
  let res;
  if (isDocumentRequest(request) && (request.headers.has('If-None-Match') || request.headers.has('If-Modified-Since'))) {
    const unconditional = new Request(request);
    unconditional.headers.delete('If-None-Match');
    unconditional.headers.delete('If-Modified-Since');
    res = await next(unconditional);
  } else {
    res = await next();
  }

  // Only HTML gets rewritten. Rewriting a JSON/JS/image body would be wasted work
  // and HTMLRewriter would mangle nothing useful, but the CSP still applies to
  // every response so a non-HTML asset is not left policy-free.
  const ctype = res.headers.get('content-type') || '';

  // 16 bytes of CSPRNG → 32 hex chars. Per-request and unguessable, which is the
  // entire security property: an injected <script> cannot carry a valid nonce.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let nonce = '';
  for (let i = 0; i < bytes.length; i++) nonce += bytes[i].toString(16).padStart(2, '0');

  const out = new Response(res.body, res);
  out.headers.set('Content-Security-Policy', buildCsp(nonce));

  if (!ctype.includes('text/html')) return out;

  // Half 1. HTML ONLY — this is below the non-HTML early return above, so /css
  // /js /img never reach it and keep the Cache-Control from `_headers`.
  out.headers.set('Cache-Control', 'no-store');
  // A validator left here is what a client echoes back to earn a bodyless 304,
  // which is precisely how a stale nonce survives. Drop both.
  out.headers.delete('ETag');
  out.headers.delete('Last-Modified');

  // A bodyless HTML response (304/204, or a HEAD) has nothing to buffer or rewrite.
  // Reading it would yield '' and re-emitting that as a body is worse than a no-op.
  if (!out.body || out.status === 204 || out.status === 304) return out;

  // Buffer once: the swap-container plan needs a look-ahead pass the streaming
  // rewriter cannot give (see _lib/perch-main.js). 44 KB average / 152 KB worst
  // case on this site, and HTML is `no-store` above, so nothing was streaming to
  // a cache anyway.
  const html = await out.text();
  const plan = await planFromHtml(html, HTMLRewriter);

  let rewriter = new HTMLRewriter().on('script', new NonceStamper(nonce));
  for (const [selector, handler] of injectHandlers(plan)) rewriter = rewriter.on(selector, handler);
  // Injected content is emitted raw and is not re-fed through the handlers above,
  // so the layer's <script> never reaches NonceStamper. It does not need to:
  // it is an external same-origin src, admitted by `script-src 'self'`.
  for (const [selector, handler] of layerHandlers(plan, routerTags(plan, context.env, request.url))) {
    rewriter = rewriter.on(selector, handler);
  }

  // Content-Length described the pre-injection body. HTMLRewriter drops it on its
  // own, but re-declaring it here would be a lie for the window in between.
  out.headers.delete('Content-Length');
  const init = { status: out.status, statusText: out.statusText, headers: out.headers };

  return rewriter.transform(new Response(html, init));
}
