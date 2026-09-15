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
// ── FRAME HEADERS (DR-INSANE-A34) ────────────────────────────────────────────
//
// `routerEnabled` is imported for a second reason now: it is the flag that says
// "this deployment has retired the shell", and the frame headers must flip on the
// same flag and not a day earlier. See the FRAME-ANCESTORS note on buildCsp().
import { routerTags, routerEnabled } from './_lib/perch-router-inject.js';

// ── SHELL RETIREMENT (SHELDON-PERCH-A51) — DONE BY DELETION ───────────────────
//
// This is where `homepageRequest` / `homepageRedirect` used to be imported from
// `_lib/perch-shell-retire.js`, and the whole module is gone with the concierge.
//
// A51 existed to solve one problem: `_redirects` carried `/  /perch.html  200`,
// so `/` served the Perch shell — a noindex, 9-word stub that iframed the real
// homepage. A crawler saw the stub while sitemap.xml declared `/` indexable.
// Because `_redirects` is applied by the asset handler DOWNSTREAM of this
// Function, the rewrite could not be undone after the fact; the only fix was to
// hand the asset handler a different path (`/home`) before `next()` ever saw `/`.
// It was gated on PERCH_ROUTER so production could roll back to the shell.
//
// Both halves are now moot, and keeping them would be worse than removing them:
//
//   * The rewrite is deleted from `_redirects`, so `/` resolves to index.html —
//     the real, indexable homepage — with no substitution needed. A51's outcome
//     is now the default rather than something a flag has to buy.
//   * `homepageRedirect` downgraded the switched-OFF `308 → /perch` to a no-store
//     307, so a visitor in a rollback window could not cache their way onto the
//     shell permanently. There is no switched-OFF state to protect any more: the
//     shell is deleted, so PERCH_ROUTER=off cannot restore it. A kill switch
//     whose rollback target no longer exists is a trap, not a safety net.
//
// The switch itself stays — `routerEnabled` still gates soft navigation and the
// frame headers above. It just no longer decides which page is at `/`, which
// also means Preview and production now serve the SAME homepage bytes. They did
// not while the substitution was live (Preview got home.html, production
// index.html), and that divergence is exactly what makes a preview sign-off
// worth less than it looks.

// ── HEADER UTILITY BAR (JORDAN-HEADER-UTILITY-BAR) ────────────────────────────
//
// The fifth thing derived from the same `plan`, and the only one that is visible
// to a visitor. The site had no header call-to-action at all, and its header
// markup is hand-duplicated across 143 files — so the bar is injected here for
// exactly the reason the container, the layer and the router are: one handler
// beats a 143-file edit, and a page authored next month gets it for free.
//
// Two halves, in two places, because <head> is a contended element:
//   • `barHandlers(plan)` prepends the markup to <body>. Its own handler, safely,
//     because it only uses element()/prepend() and never onEndTag.
//   • `barStylesheetTag(plan)` is composed into `layerHandlers`' extraTags below.
//     It CANNOT be its own ['head', …] handler — lol-html keeps only the LAST
//     onEndTag callback per element, so a second head handler would silently
//     delete the layer's and the router's tags. Same reason A22 composes.
import { barHandlers, barStylesheetTag } from './_lib/utility-bar-inject.js';
import { floatHandlers, floatStylesheetTag } from './_lib/book-float-inject.js';

// ── FOOTER OFFICE-CITY LINE (SHELDON-PAUL-CHROME, #223) ───────────────────────
//
// The sixth injection, and the first one whose gate is NOT the `plan`. Florida
// Bar Rule 4-7.12(a)(2) requires the city of the office to be disclosed, and the
// hand-authored `.dl-connect` footer carries phone, email and social but no
// location on any of the 100 pages that have one. It is injected here for the
// same reason as everything above it — one handler beats a 100-file edit that
// would trip chrome-diff on all 100 — and in the same two halves:
//   • `footerHandlers(wanted)` places the line after `.dl-connect-direct`. Its
//     own handler, safely, because it only uses element()/after().
//   • `footerStylesheetTag(wanted)` composes into `layerHandlers`' extraTags
//     below, for the lol-html last-onEndTag-wins reason the bar's does.
//
// `wanted` comes from `footerScan` rather than from `plan` because this line
// belongs to a BLOCK, not to the page: a document with no `.dl-connect` has
// nowhere to put it. See the long note in _lib/footer-inject.js for why that
// distinction is deliberate and why the scan is needed at all (head closes
// before the footer is parsed, so the streaming pass cannot answer in time).
import { footerHandlers, footerStylesheetTag, footerScan } from './_lib/footer-inject.js';

// ── THE SITE NAVIGATION (SHELDON-PAUL-NAV, #227) ──────────────────────────────
//
// The seventh injection, and the first one that REPLACES hand-authored markup
// rather than adding to it. `nav.menubar` is byte-duplicated across 113 files and
// has already forked into three incompatible menus that all pass CI; a per-page
// edit is refused outright by chrome-diff's `site-navigation` rule, which has no
// waiver. So the nav joins everything above it: one handler, zero page edits, and
// the fork collapses because one definition is served to all three variants.
//
// ── WHY THIS IS SAFE NEXT TO THE DIV-ORDINAL PLAN ────────────────────────────
//
// This is the one injector that rewrites markup INSIDE the div whose end tag is
// `plan.openAfterDivEnd`, so it is the one that could plausibly move the swap
// container. It cannot, and the reason is the order of operations in this file:
// `planFromHtml` runs over the ORIGINAL buffered bytes below, and this handler is
// composed into the SAME second pass as the container — where lol-html still
// fires `onEndTag` for the divs whose content is being replaced, and never
// re-feeds the injected divs through the handlers. Pass 2's `</div>` counter
// therefore visits exactly the end tags pass 1 numbered.
//
// That is measured, not assumed: `scripts/nav/plan-invariance.mjs` proves it on a
// page from each variant and on a no-nav fragment, with a control that proves the
// harness can see a one-ordinal shift, and `test/nav-inject.test.mjs` re-runs it
// in CI. Moving this ABOVE `planFromHtml`, into a pass of its own, breaks it.
//
// Two halves, in two places, for the reason the bar and the footer line are:
//   • `navHandlers(navState)` replaces the nav's interior. Its own handler,
//     safely, because it only uses element()/setInnerContent() and never onEndTag.
//   • `navStylesheetTag(navState)` composes into `layerHandlers`' extraTags.
import { navHandlers, navStylesheetTag, navScan } from './_lib/nav-inject.js';
//   • `analyticsTag(env)` composes into the same `extraTags` string. Empty unless
//     the ANALYTICS flag is explicitly `on`, so merging and deploying this change
//     nothing until someone sets it — see _lib/analytics-inject.js.
import { analyticsTag, analyticsEnabled, regionTag, gtmTag, gtmBodyHandlers } from './_lib/analytics-inject.js';
import { socialMetaTags } from './_lib/social-meta-inject.js';
import { siteVerificationTags } from './_lib/site-verification.js';

/**
 * Directives that never vary per request. Kept here so the policy reads in one place.
 * Exported so test/csp.test.mjs can assert on the real policy string rather than a
 * copy of it — a test that re-declares the CSP proves only that the copy is correct.
 *
 * @param {string} nonce this request's nonce
 * @param {{ analytics?: boolean }} [opts] `analytics` adds the vendor hosts the
 *   tracking tags contact, and only when those tags are actually being injected.
 *   `lockFrameAncestors` used to live here too — see the FRAME-ANCESTORS note
 *   inside for why the policy no longer has two states to choose between.
 */
export function buildCsp(nonce, { analytics = false } = {}) {
  return [
    "default-src 'self'",
    // No 'unsafe-inline'. Inline blocks are admitted ONLY by this request's nonce.
    // 'strict-dynamic' is intentionally NOT used: the site loads classic scripts
    // from the listed CDNs, and strict-dynamic would ignore those host allowances.
    // `esm.sh` is gone from here too. It served exactly one module — the
    // RetellWebClient the concierge orb loaded — and no file in the shipped tree
    // imports from it any more, so the allowance now names a supplier the site has
    // no relationship with. Left in, it would be the sort of entry someone restores
    // rather than questions.
    // The three ConnexUS hosts — vantage.ticoai.net, cdn.theconnexus.ai and
    // portal.theconnexus.ai — came out with the Vantage severance. The beacon
    // `<script src="https://vantage.ticoai.net/perch.js">` was the only thing on
    // the site that ever loaded from any of them, and it is gone from all 156
    // pages it was on; the other two were never referenced by a single file in
    // the tree at all. Same argument as `esm.sh` above: an allowance for a host
    // the site has no relationship with is an entry someone later restores
    // rather than questions.
    `script-src 'self' 'nonce-${nonce}' https://code.jquery.com https://cdnjs.cloudflare.com https://challenges.cloudflare.com${analytics ? ' https://*.googletagmanager.com https://www.googleadservices.com https://pagead2.googlesyndication.com https://connect.facebook.net https://*.clarity.ms' : ''}`,
    // ── ANALYTICS HOSTS (JAY-TRACKING-B1) ───────────────────────────────────
    //
    // Added ONLY when the ANALYTICS flag is on, so a deployment that is not
    // running the tags does not carry an allowance for hosts it never contacts.
    // `/js/analytics.js` itself needs nothing here — it is same-origin, already
    // admitted by `script-src 'self'`. These two entries are for the VENDOR
    // scripts that module loads, and the endpoints they beacon to.
    //
    // `frame-src` gains `td.doubleclick.net` + `www.googletagmanager.com` when
    // analytics is on: gtag's conversion linker attempts that frame during Ads
    // conversions, and while measurement survived without it, the blocked frame
    // logged console CSP violations that read as breakage in every third-party
    // tag audit (and will matter if enhanced conversions / remarketing are
    // enabled). Allowing it when — and only when — the tags run keeps the
    // off-state policy byte-identical.
    // The Retell and LiveKit origins came out with the voice concierge. The browser
    // no longer opens a WebRTC session, so allowing them would be a permission
    // granted to nothing — and a policy that still names a capability the site does
    // not have reads, to the next person, as though it does. `esm.sh` went with them:
    // it served the RetellWebClient module and has no other caller left on the page.
    // The Vantage origins are out of `connect-src` for a second reason beyond the
    // beacon: `functions/booking/_lib/vantage-{lead,upsert}.js` are deleted, so no
    // fetch to `vantage.ticoai.net/upsert-lead` is issued from anywhere any more.
    // Leads reach Clio Grow and Clio Manage through the site's own Functions.
    `connect-src 'self' https://challenges.cloudflare.com${analytics ? ' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://*.g.doubleclick.net https://*.doubleclick.net https://*.google.com https://www.googleadservices.com https://pagead2.googlesyndication.com https://*.facebook.com https://*.clarity.ms https://c.bing.com' : ''}`,
    // See the STYLE-SRC note above — tracked follow-up, not an oversight.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: https:",
    `frame-src 'self' https://challenges.cloudflare.com${analytics ? ' https://*.doubleclick.net https://*.googletagmanager.com' : ''}`,
    // ── FRAME-ANCESTORS (DR-INSANE-A34, #59) — NOW UNCONDITIONAL ────────────
    //
    // A34 made this a two-state policy because the Perch shell iframed this site
    // cross-origin, so the wide string had to stay until the shell was retired:
    //
    //     lockFrameAncestors false → 'self' https://vantage.ticoai.net https://*.ticoai.net
    //     lockFrameAncestors true  → 'self'
    //
    // The shell is deleted and Vantage is severed, so nothing off-origin frames
    // this site in EITHER state and the wide branch protects an embed that cannot
    // happen. What it does still do is grant framing rights to `*.ticoai.net` — a
    // wildcard over a domain whose subdomains this repo does not control — which
    // is pure clickjacking surface on a law firm's site. So the two states
    // collapse to the locked one.
    //
    // 'self' rather than 'none': the site's own pages may embed each other
    // same-origin, and refusing that would be a change nobody asked for.
    //
    // The `lockFrameAncestors` option is therefore GONE from this function — an
    // option that cannot change the output is worse than no option, because it
    // reads as a control that still works. `X-Frame-Options: SAMEORIGIN` further
    // down is a separate, header-level decision and keeps its own gate.
    "frame-ancestors 'self'",
    "base-uri 'self'",
    "form-action 'self'",
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
  const localHost = ['localhost', '127.0.0.1', '::1'].includes(new URL(request.url).hostname);
  const runtimeEnv = localHost && !context.env?.ANALYTICS
    ? { ...context.env, ANALYTICS: 'on' }
    : context.env;

  // A51's `homepageRequest` stood here, substituting `/home` for `/`. With the
  // shell deleted there is nothing to substitute away from — `/` is the real
  // homepage — so the request goes to the asset handler unchanged.

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

  // DR-INSANE-A34. Read the flag ONCE, here, and let both frame headers hang off
  // the same boolean — two independent reads could disagree if the gate ever grows
  // a condition, and "CSP says one thing, X-Frame-Options says another" is exactly
  // the state that makes framing behaviour unreadable from either header alone.
  //
  // Deployment-scoped, not page-scoped: unlike `routerTags` below this does NOT
  // consult the per-page `plan`. Who may frame this site is a property of the
  // deployment, and gating it per page would leave the shell page itself — the one
  // page with a 'skip' plan — on the permissive policy after the cutover.
  const framesLocked = routerEnabled(context.env, request.url);

  const out = new Response(res.body, res);
  // The analytics allowance travels with the flag that decides whether the tag is
  // injected at all, so the policy and the page can never disagree: no tag means
  // no hosts, and a host allowance is never left behind by a rollback.
  const analyticsOn = analyticsEnabled(runtimeEnv);
  out.headers.set('Content-Security-Policy', buildCsp(nonce, { analytics: analyticsOn }));
  // Set alongside the CSP and above the non-HTML early return, for the same reason
  // the CSP is: a response that is not HTML today can still be rendered in a frame.
  // Only ever ADDED — with the flag off this header is absent exactly as it is
  // today, which is what keeps the shell able to iframe the site before cutover.
  if (framesLocked) out.headers.set('X-Frame-Options', 'SAMEORIGIN');

  // SHELDON-PERCH-CLEANUP-ROUTING-KEYS' `homepageRedirect` stood here, downgrading
  // the switched-OFF `308 → /perch` at `/` to a no-store 307 so no browser could
  // cache its way onto the shell for good. `/` is a 200 in every deployment now —
  // there is no permanent redirect left at `/` to downgrade.

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
  // #223. A second look-ahead over the SAME buffered string, for the same reason
  // the plan needs one: the answer is in the body and the tag it decides goes in
  // the head. False on every document with no `.dl-connect` footer, which is what
  // makes the whole injection a no-op there rather than an empty paragraph.
  const wantsFooterLine = await footerScan(html, HTMLRewriter);
  // #227. A third look-ahead over the same buffered string. It answers two things
  // the streaming pass could not: whether this document has a `nav.menubar` at
  // all (47 fragments do not, and the stylesheet must not ship to them), and
  // which ids the document already uses — the mobile collapse panels need ids
  // that collide with none of them, and `<head>` closes long before the page's
  // own ids have been seen.
  const navState = await navScan(html, HTMLRewriter);

  let rewriter = new HTMLRewriter().on('script', new NonceStamper(nonce));
  for (const [selector, handler] of injectHandlers(plan)) rewriter = rewriter.on(selector, handler);
  // Injected content is emitted raw and is not re-fed through the handlers above,
  // so the layer's <script> never reaches NonceStamper. It does not need to:
  // it is an external same-origin src, admitted by `script-src 'self'`.
  // JORDAN-HEADER-UTILITY-BAR. The bar's stylesheet reference rides in the SAME
  // head callback as the layer's and the router's tags — see the import note. The
  // bar's own markup handler is registered separately below, on <body>.
  const headTags = routerTags(plan, context.env, request.url)
    + barStylesheetTag(plan)
    + floatStylesheetTag(new URL(request.url).pathname)
    + footerStylesheetTag(wantsFooterLine)
    + navStylesheetTag(navState)
    + analyticsTag(runtimeEnv)
    + gtmTag(runtimeEnv, nonce)
    + (analyticsEnabled(runtimeEnv) ? regionTag(context.request) : '')
    // JAY-SEO-E2. NOT gated on ANALYTICS, deliberately — a console re-checks its
    // token and un-verifies a property whose tag has vanished, so tying this to
    // the tracking flag would mean switching tracking off for an afternoon
    // silently costs Search Console access weeks later. Empty unless a token is
    // set, so it ships inert. Same head string for the last-onEndTag-wins reason.
    + siteVerificationTags(context.env)
    // JAY-SEO-E1. Rides in the SAME head string for the lol-html
    // last-onEndTag-wins reason documented above: a second ['head', …] handler
    // would silently delete the layer's tags. Derived from `html`, which is
    // already buffered above for the div-ordinal plan, so this costs no extra
    // pass. Purely additive — a tag the page already declares is never emitted
    // twice.
    + socialMetaTags(html);
  for (const [selector, handler] of layerHandlers(plan, headTags)) {
    rewriter = rewriter.on(selector, handler);
  }
  // Registered last so it is unambiguous that nothing above depends on it. The
  // prepended markup is emitted right after the <body> start tag, so it lands
  // above the site nav and OUTSIDE main#perch-main even on the pages whose
  // container opens at body child 0. Injected content is not re-fed through the
  // handlers, so the ordinals `plan` is written in are unaffected.
  // The floating booking widget PREPENDS to <body> too, and it is registered
  // BEFORE the bar on purpose. lol-html applies consecutive `prepend()` calls on
  // one element by placing each new one AHEAD of the previously inserted content,
  // so the last handler to prepend owns the first body child. The utility bar
  // must be that child (test/utility-bar.test.mjs: 'the bar is the first element
  // in <body>'), so the widget goes in first and the bar lands in front of it.
  // Neither is re-fed through the handlers, so the container ordinals `plan` was
  // measured in are unaffected. Why the widget prepends at all rather than
  // appending is documented in _lib/book-float-inject.js.
  for (const [selector, handler] of floatHandlers(new URL(request.url).pathname)) rewriter = rewriter.on(selector, handler);
  for (const [selector, handler] of barHandlers(plan)) rewriter = rewriter.on(selector, handler);
  for (const [selector, handler] of gtmBodyHandlers(runtimeEnv)) rewriter = rewriter.on(selector, handler);
  // #223. Registered after the bar for the same reason the bar is registered last:
  // nothing above depends on it. It writes into the footer, far below anything the
  // container/layer/router ordinals are measured against, and injected content is
  // not re-fed through the handlers — so the plan's ordinals are unaffected and
  // this cannot re-trigger itself. Empty array on a document with no footer.
  for (const [selector, handler] of footerHandlers(wantsFooterLine)) {
    rewriter = rewriter.on(selector, handler);
  }
  // #227. Registered LAST, and that position is the argument. Every handler above
  // is measured in ordinals taken from the original bytes; this one replaces a
  // subtree those ordinals are counted THROUGH. Registering it after them makes
  // it unambiguous that it contributes nothing they read — and lol-html dispatches
  // by selector, not by registration order, so the divs inside the old nav still
  // fire the `onEndTag` the container's plan is counting even though their bytes
  // never reach the output. Empty array on the 47 documents with no site nav.
  for (const [selector, handler] of navHandlers(navState)) {
    rewriter = rewriter.on(selector, handler);
  }

  // Content-Length described the pre-injection body. HTMLRewriter drops it on its
  // own, but re-declaring it here would be a lie for the window in between.
  out.headers.delete('Content-Length');
  const init = { status: out.status, statusText: out.statusText, headers: out.headers };

  return rewriter.transform(new Response(html, init));
}
