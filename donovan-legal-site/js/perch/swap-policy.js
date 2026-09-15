// ── SHELDON-PERCH-A22: what the router is allowed to intercept and adopt ─────
//
// Ticket #52 · Phase A / Phase 2 · depends on A0.1 (#66), A0.2 (#65), A0.3 (#63),
// A2.1 (#74) and the A2.5 spike verdict (#55).
//
// The policy lives in its own module, with no imports beyond ./placement.js and
// no top-level side effects, for the same reason placement.js does: this IS the
// ticket's security contract, and CI has to exercise THESE functions rather than
// a re-implementation of them. A test that re-declared the allow-list would prove
// only that the copy is correct. See [[feedback_assert_behavior_not_source_spelling]].
//
// ── WHY AN ALLOW-LIST AND NOT "SYNC WHAT THE PAGE ASKS FOR" ──────────────────
// The A2.5 spike synced every `<script src>` the incoming document carried that
// the live document did not already have. That answered the spike's question and
// it is the wrong shape to ship: it makes the set of code the router will execute
// a function of whatever markup comes back over the wire. Deny-by-default inverts
// that — the shell decides, in this file, which files a swap may execute, and a
// script that is not named here is not run no matter what the response says.
//
// Three properties follow, and each is asserted in test/perch-swup-router.test.mjs:
//   • Only `<script src>` is ever adopted. An inline block is never copied,
//     re-created, re-nonced or eval'd — that is the A0.2 rule (js/dl-init.js) and
//     the swap-container CI guard, and this router does not carve an exception.
//   • Every adopted tag is a FRESH element carrying `src` and nothing else. No
//     nonce is read, copied or forged; the CSP admits these by host allow-list
//     (`script-src 'self' … https://challenges.cloudflare.com`), never by nonce.
//   • The union of ADOPT and DENY must equal the set of scripts the interceptable
//     pages actually reference. A new page script reds CI instead of silently
//     landing on the deny path and dying in production.
//
// ── THE NUMBERS BELOW ARE MEASURED, NOT ESTIMATED ────────────────────────────
// Every count in this file came from running the REAL A0.1 pipeline
// (functions/_lib/perch-main.js) over all 143 shipped HTML documents and reading
// the result with jsdom. 143 documents → 2 with no container (`skip`), 41 behind
// tier auth or otherwise excluded below → 96 interceptable pages, referencing 22
// distinct scripts. Both halves of the classification are reproduced by
// test/perch-swup-router.test.mjs from the tree, so they cannot drift.

import { CONTAINER_ID, EVENT_SWAPPED } from './placement.js';

export { CONTAINER_ID, EVENT_SWAPPED };

/** The A0.2 re-init bus (js/dl-init.js). Dispatched on `document` after adoption. */
export const EVENT_CONTENT_SWAPPED = 'dl:content-swapped';

/** The one region the router replaces. */
export const CONTAINER_SELECTOR = '#' + CONTAINER_ID;

// ── 1. Routes the router must never intercept ────────────────────────────────
//
// Two families, and they are excluded for completely different reasons. Keeping
// the reason on the rule is the point: a future reader has to be able to tell
// "this is a security boundary" from "this page's calculator has no re-init seam".
export const EXCLUDED_ROUTES = [
  {
    id: 'tier-basic-auth',
    re: /^\/(gold|platinum|diamond|reserve)(\/|$)/i,
    reason:
      'HTTP Basic auth at the edge (functions/_lib/tier-auth.js). A 401 + '
      + 'WWW-Authenticate pair only produces the browser credential prompt on a REAL '
      + 'document navigation; Swup fetches with fetch(), so an intercepted tier link '
      + 'yields an opaque 401 the router would swallow or render — and the member is '
      + 'never asked for a password.',
  },
  // ── `no-container-shell` stood here, and REMOVING IT IS A BEHAVIOUR CHANGE ────
  //
  // It excluded `/`, `/perch` and `/perch.html` from soft navigation, because all
  // three reached the concierge shell: `_redirects` carried `/  /perch.html  200`,
  // A0.1 skipped the shell (it hosted the orb), so there was no #perch-main and Swup
  // would have thrown looking for one.
  //
  // Every clause of that is now false. The rewrite is deleted, `/` resolves to
  // index.html — an ordinary content page that A0.1 gives a container to — and
  // perch.html does not exist, with both its spellings 301ing to `/`.
  //
  // Leaving the rule would have been the quiet kind of wrong: the HOMEPAGE, the most
  // linked-to page on the site, would have been the one page that hard-navigated,
  // and nothing would have failed to say so.
  {
    id: 'no-container-fragment',
    re: /^\/nav-block(\.html)?$/i,
    reason: 'A nav fragment with no swappable content; A0.1 decides `skip`.',
  },
  // ── `no-container-index` stood here, for the same reason and with the same fate ──
  //
  // It excluded `/index` and `/index.html` because both led to `/`, and `/` was the
  // shell. `/` is index.html itself now, so these are spellings of an ordinary page
  // with an ordinary container. `/index.html` still 301s to `/` (that rule predates
  // all of this and is untouched), which the router follows to a page it can swap.
  // ── Pages whose behaviour cannot be re-established by a swap ───────────────
  //
  // These four all work on a FIRST arrival and break silently on a RETURN visit,
  // or never boot at all — the class the A2.5 spike recorded as F2. A script is
  // adopted exactly once (re-executing a classic script would re-declare its
  // top-level `const`s and throw), so a load-time binding attached to elements
  // that a later swap replaced is simply gone. Excluding the page costs a full
  // navigation, which is precisely today's behaviour; leaving it in would ship a
  // calculator that looks fine and does nothing on the second visit.
  //
  // Removing an entry from this list is a real Phase-3 work item, not a cleanup:
  // give the module a `DL.ready`-registered init (js/dl-init.js) first.
  {
    id: 'load-time-bootstrap-1031',
    re: /^\/tool-1031-exchange(\.html)?$/i,
    reason:
      'js/tool-1031-exchange.js:2594 boots on a bare DOMContentLoaded. Adopted after '
      + 'the document has loaded, that event has already fired and the tool never boots '
      + 'at all — not even on first arrival.',
  },
  {
    id: 'load-time-bootstrap-rental',
    re: /^\/tool-rental-real-estate-tax-strategy-analyzer(\.html)?$/i,
    reason:
      'js/tool-rental-real-estate-tax-strategy-analyzer.js:4533,4758 guard on '
      + 'readyState, so they boot on first arrival and never again — the bindings are '
      + 'attached to elements the next swap replaces.',
  },
  {
    id: 'load-time-bootstrap-str',
    re: /^\/tool-str-strategy-analyzer(\.html)?$/i,
    reason: 'js/tool-str-strategy-analyzer.js:3108,3314 — same readyState-once shape as the rental analyzer.',
  },
  {
    id: 'load-time-bootstrap-entity-formation',
    re: /^\/tool-entity-formation(\.html)?$/i,
    reason:
      'js/tool-entity-formation.js:17,18,57,68 bind #access_submit / #access_code / '
      + '#management_structure / #jurisdiction at parse time with no ready gate.',
  },
  {
    id: 'load-time-bootstrap-firpta',
    re: /^\/tool-firpta-withholding(\.html)?$/i,
    reason: 'js/page/tool-firpta-withholding.js:15 binds #situation `change` at parse time.',
  },
  // -- 2026-09-04: the four member tools published at the root (TOOLS-OPEN-2) --
  // Same F2 shape as the five above: each boots once at load with bindings on
  // elements a swap would replace. Excluded pending a DL.ready re-init seam.
  {
    id: 'load-time-bootstrap-entity-formation-multi',
    re: /^\/tool-entity-formation-multi(\.html)?$/i,
    reason: 'js/tool-entity-formation-multi.js:1188 boots initTool() on a bare DOMContentLoaded.',
  },
  {
    id: 'load-time-bootstrap-operating-agreement',
    re: /^\/tool-operating-agreement(\.html)?$/i,
    reason: 'js/tool-operating-agreement.js:20 boots on a bare DOMContentLoaded.',
  },
  {
    id: 'load-time-bootstrap-structuring',
    re: /^\/tool-structuring(\.html)?$/i,
    reason: 'js/tool-structuring.js boots on DOMContentLoaded (see ~6159) and binds the sidebar at load.',
  },
  {
    id: 'load-time-bootstrap-material-participation',
    re: /^\/tool-material-participation-tracker(\.html)?$/i,
    reason: 'js/page/tool-material-participation-tracker.js binds #tpName/#spName/#year `input` and #eDate at parse time (line 285-286) and initialises IndexedDB once.',
  },
  {
    id: 'load-time-bootstrap-divorce-balance-sheet',
    re: /^\/tool-divorce-marital-balance-sheet(\.html)?$/i,
    reason: 'js/page/tool-divorce-marital-balance-sheet.js builds the asset rows and binds them at load (DOMContentLoaded / init) -- a swap would orphan the listeners.',
  },
  {
    id: 'load-time-bootstrap-divorce-valuation',
    re: /^\/tool-divorce-business-valuation(\.html)?$/i,
    reason: 'js/page/tool-divorce-business-valuation.js binds every input at load (init) -- a swap would orphan the listeners.',
  },
  {
    id: 'load-time-bootstrap-divorce-alimony',
    re: /^\/tool-divorce-alimony(\.html)?$/i,
    reason: 'js/page/tool-divorce-alimony.js binds every input at load (init) -- a swap would orphan the listeners.',
  },
  {
    id: 'load-time-bootstrap-divorce-child-support',
    re: /^\/tool-divorce-child-support(\.html)?$/i,
    reason: 'js/page/tool-divorce-child-support.js binds every input at load (init) -- a swap would orphan the listeners.',
  },
  {
    id: 'load-time-bootstrap-divorce-marital-home',
    re: /^\/tool-divorce-marital-home(\.html)?$/i,
    reason: 'js/page/tool-divorce-marital-home.js binds every input at load (init) -- a swap would orphan the listeners.',
  },
  {
    id: 'load-time-bootstrap-divorce-retirement',
    re: /^\/tool-divorce-retirement(\.html)?$/i,
    reason: 'js/page/tool-divorce-retirement.js builds the account rows and binds them at load -- a swap would orphan the listeners.',
  },
  {
    id: 'load-time-bootstrap-divorce-filing',
    re: /^\/tool-divorce-filing(\.html)?$/i,
    reason: 'js/page/tool-divorce-filing.js binds every input at load (init) -- a swap would orphan the listeners.',
  },
  {
    id: 'load-time-bootstrap-divorce-carryforwards',
    re: /^\/tool-divorce-carryforwards(\.html)?$/i,
    reason: 'js/page/tool-divorce-carryforwards.js builds the attribute rows and binds them at load -- a swap would orphan the listeners.',
  },
  {
    id: 'load-time-bootstrap-divorce-tax-rider',
    re: /^\/tool-divorce-tax-rider(\.html)?$/i,
    reason: 'js/page/tool-divorce-tax-rider.js binds the form and the print window at load -- a swap would orphan the listeners.',
  },
  {
    id: 'load-time-bootstrap-engagement-scoping',
    re: /^\/engagement-scoping(\/.*)?$/i,
    reason:
      'js/engagement-scoping.js mounts a React root into #root at load. A return visit '
      + 'presents a new, empty #root that nothing re-mounts into.',
  },
];

/**
 * Why this path must not be intercepted, or null if it may be.
 * @param {string} pathname
 * @returns {{id: string, reason: string} | null}
 */
export function excludeReason(pathname) {
  for (const rule of EXCLUDED_ROUTES) {
    if (rule.re.test(pathname)) return { id: rule.id, reason: rule.reason };
  }
  return null;
}

// ── 2. The script adoption allow-list ────────────────────────────────────────
//
// THE GAP THIS CLOSES, in one sentence, because it is the finding the whole
// ticket turns on: `DL.ready` re-runs what is REGISTERED in the live document,
// and across this tree almost nothing is — js/dl-init.js is referenced by 2 of
// 143 pages and js/page/booking-gate.js by exactly one — so a swap from /contact
// into /book dispatches the re-init event into a document where the gate code has
// never been loaded, and `#book-live` stays hidden behind a gate no code is
// present to open. (A2.5 spike, finding F1.)
//
// Keys are ORIGIN-RELATIVE for same-origin scripts (`/js/…`), so the same list
// works on Preview, on localhost and in production, and are full absolute URLs
// for the one cross-origin script. `?v=` cache-busting would change the key and
// fail closed — CI's completeness check reds rather than the page silently losing
// its behaviour.
//
// HEAD **AND** END-OF-BODY. Head-only adoption is not enough and this is the
// single most load-bearing line in the file: js/booking-widget.js is an
// end-of-body tag, which A0.1 leaves OUTSIDE the container, and it is what makes
// the booking widget actually boot after a swap into /book.
export const ADOPT_SCRIPTS = new Map([
  ['/js/dl-init.js', {
    where: 'head',
    why: 'defines DL.ready — the A0.2 re-init bus. Must execute before any page script that registers with it.',
  }],
  ['/js/page/booking-gate.js', {
    where: 'head',
    why: 'THE reveal. Hides #book-gate and shows #book-live for a caller Paula has already qualified.',
  }],
  ['/js/page/contact-form.js', {
    where: 'head',
    why: 'THE inquiry form on contact.html (SHELDON-CONTACT-ROUTE-R1, #214). Registered via DL.ready, so it re-binds the swapped form and re-renders the Turnstile challenge into the new mount. Denying it would leave a form whose submit handler is bound to nodes the swap destroyed: the button would fall through to a native POST, which form-action refuses, and the inquiry would be lost exactly the way the Formspree action lost it.',
  }],
  ['/js/page/blog-filter.js', { where: 'head', why: 'blog.html tag filter; registered via DL.ready.' }],
  ['/js/page/tools-chips.js', { where: 'head', why: 'tools.html group chips; registered via DL.ready, re-binds after a swap.' }],
  // `/js/page/login-coming-soon.js` stood here until JORDAN-196-LOGIN-SIGNOUT-R1 (#196).
  // login.html was the only page that loaded it and both are deleted, so the entry
  // became one of the dead rows the `these list entries are referenced by no
  // interceptable page` test exists to catch. Removed with the page, not left behind.
  ['/js/page/input-formatter.js', {
    where: 'head',
    why: 'currency/percent input formatting on 3 interceptable tool pages. Exposes DonovanInputFormatter.attachAll(root), which the re-init recipe re-calls on every swap (spike F2).',
  }],
  ['/js/page/tool-capital-gains.js', { where: 'head', why: 'calculator; invoked through the delegated data-dvn-do dispatcher.' }],
  ['/js/page/tool-cost-segregation.js', { where: 'head', why: 'calculator; delegated dispatch.' }],
  ['/js/page/tool-irs-notice-guide.js', { where: 'head', why: 'calculator; delegated dispatch.' }],
  ['/js/page/tool-oic-rcp-estimator.js', { where: 'head', why: 'calculator; delegated dispatch.' }],
  ['/js/inline-actions.js', {
    where: 'body',
    why: 'the delegated data-dvn-on / data-dvn-do dispatcher (js/inline-actions.js:167-170). Binds on `document`, so once adopted it survives every later swap.',
  }],
  ['/js/booking-widget.js', {
    where: 'body',
    why: 'END-OF-BODY, outside the container. Without it the reveal shows an empty shell: this is what boots the widget (spike F1, condition C1).',
  }],
  ['https://challenges.cloudflare.com/turnstile/v0/api.js', {
    where: 'body',
    why: 'provides window.turnstile, which js/booking-widget.js:1228-1236 renders EXPLICITLY into #dl-bk-turnstile. Denying it would leave turnstile_token empty and /booking/create would reject every booking — i.e. omitting it would break the booking write path, not protect it. Already on the CSP script-src host allow-list; no CSP change. SHELDON-CONTACT-ROUTE-R1 (#214): contact.html now carries the same tag in its HEAD (async defer makes the placements equivalent, and keeping it out of the body leaves the body children the edge injector counts untouched), for the same explicit render into #dl-contact-turnstile — so `where` is the /book placement, not a rule.',
  }],
]);

/**
 * Scripts the interceptable pages reference that must NEVER be adopted, each with
 * the reason. Being on this list is a decision; being on neither list is a bug,
 * and CI treats it as one.
 */
export const DENY_SCRIPTS = new Map([
  // The Vantage beacon stood here. It was denied because the swap contract is
  // re-notify, never re-load (RE-INIT-INVENTORY 3.6). The tag is gone from all 156
  // pages with the Vantage severance, so there is nothing left to deny.
  // js/donovan-widget.js stood here - the concierge on 139 of 143 pages, denied
  // because it mounted its launcher into the A2.1 persistent layer and re-running it
  // would have mounted a second. It went with the voice concierge.
  ['/js/main.js', {
    why: 'the site-nav binder. Measured against the real A0.1 output: every one of its targets (.hamburger, .dropdown, .btn-close.menu, #theFirm, #thePractice, #btn-tf, #btn-tp, nav.menubar, .nav-mobile-overlay) is OUTSIDE #perch-main on all 96 interceptable pages — 0 inside — so the swap never destroys them and there is nothing to re-bind. Re-executing it would double-bind its document-level click listener and re-append the members-gate loader.',
  }],
  ['/js/plugins.js', { why: 'shared vendor bundle; guaranteed present by the shared-chrome gate below.' }],
  ['/js/vendor/bootstrap.min.js', { why: 'shared vendor; its data-api handlers are delegated on `document` and survive every swap.' }],
  ['/js/vendor/modernizr-3.7.1.min.js', { why: 'shared vendor; feature detection at load, nothing to re-run.' }],
  ['/js/vendor/jquery-3.3.1.min.js', { why: 'shared vendor; re-executing jQuery would discard every plugin and handler registered against the live instance.' }],
  ['/js/vendor/jquery-fallback.js', { why: 'a parser-time document.write() fallback for the jQuery CDN. document.write after load would blank the document.' }],
  ['https://code.jquery.com/jquery-3.3.1.min.js', { why: 'shared vendor, CDN copy of the above.' }],
  ['https://cdnjs.cloudflare.com/ajax/libs/animejs/2.0.2/anime.min.js', { why: 'shared vendor animation library; guaranteed present by the shared-chrome gate.' }],

  // ── The two tags the EDGE injects, which is why they are not in any page file ─
  //
  // functions/_lib/perch-layer-inject.js writes both of these into every
  // container page as the HTML streams out, so they are in the incoming document
  // of every swap even though `grep` finds them in no .html file. Deny-by-default
  // already refused them; naming them makes the refusal a decision with a reason
  // instead of an unlisted script in the log, which is what a reader debugging a
  // swap would otherwise have to work out for themselves.
  ['/js/perch-layer.js', {
    why: 'the persistent layer, already mounted in this document. Re-executing the module would run its boot a second time; the layer holds the live call, so a second mount is the failure the layer exists to prevent.',
  }],
  ['/js/perch-swup-router.js', {
    why: 'this router, already running. Re-executing it would construct a second Swup instance and every link would be intercepted twice.',
  }],
]);

/**
 * Normalise a `src` to its allow-list key.
 *
 * Resolved against the URL of the document the tag came FROM, not against
 * `location.href`: the incoming document is where `js/main.js` and
 * `../js/main.js` mean different things, and by the time this runs the live
 * document's URL has already moved.
 *
 * @param {string} raw the literal src attribute
 * @param {string} baseHref URL of the document that carried the tag
 * @param {string} origin the live document's origin
 * @returns {{key: string, href: string} | null} null for an unusable/foreign-protocol src
 */
export function scriptKey(raw, baseHref, origin) {
  if (!raw) return null;
  let u;
  try {
    u = new URL(raw, baseHref);
  } catch (e) {
    return null;
  }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return null;
  u.hash = '';
  return { key: u.origin === origin ? u.pathname + u.search : u.href, href: u.href };
}

/**
 * May the router execute this script? Deny by default.
 * @param {string} key from scriptKey()
 */
export function adoptDecision(key) {
  const allowed = ADOPT_SCRIPTS.get(key);
  if (allowed) return { adopt: true, listed: true, reason: allowed.why };
  const denied = DENY_SCRIPTS.get(key);
  if (denied) return { adopt: false, listed: true, reason: denied.why };
  return {
    adopt: false,
    listed: false,
    reason: 'not on the adoption allow-list — deny by default',
  };
}

/**
 * Decide, for one incoming document, exactly which scripts a swap may execute.
 *
 * THE DECISION LIVES HERE, NOT IN THE ROUTER, and that split is deliberate: this
 * function is the thing CI has to be able to interrogate. The router's remaining
 * job is twelve lines that create a `<script src>` per queued URL — nothing that
 * could reintroduce an inline block, a nonce or an eval without the diff saying so.
 *
 * Three properties hold by construction and are asserted in
 * test/perch-swup-router.test.mjs against the real 143-document tree:
 *   • `queue` only ever contains entries whose key is in ADOPT_SCRIPTS;
 *   • only `script[src]` is ever considered — an inline `<script>` in the incoming
 *     document is not read, not copied and not reported as adoptable;
 *   • nothing already present in the live document is re-executed.
 *
 * @param {Document} incomingDoc parsed response document
 * @param {{incomingUrl: string, origin: string, loadedHrefs: Set<string>}} ctx
 * @returns {{queue: Array<{key: string, href: string}>, decisions: Array<object>}}
 */
export function planAdoption(incomingDoc, ctx) {
  const decisions = [];
  const queue = [];
  if (!incomingDoc) return { queue, decisions };

  const have = new Set(ctx.loadedHrefs || []);
  // `script[src]` — the whole document, head AND end-of-body. A selector that
  // stopped at <head> would leave js/booking-widget.js behind, and the reveal
  // would show an empty shell. An inline <script> does not match this selector at
  // all, which is how "never adopt an inline block" is enforced: not by filtering
  // one out, but by never selecting one.
  for (const tag of incomingDoc.querySelectorAll('script[src]')) {
    const raw = tag.getAttribute('src');
    const k = scriptKey(raw, ctx.incomingUrl, ctx.origin);
    if (!k) {
      decisions.push({ src: raw, adopted: false, listed: false, reason: 'unusable or non-http src' });
      continue;
    }
    const verdict = adoptDecision(k.key);
    if (!verdict.adopt) {
      decisions.push({ src: k.key, adopted: false, listed: verdict.listed, reason: verdict.reason });
      continue;
    }
    if (have.has(k.href)) {
      decisions.push({ src: k.key, adopted: false, listed: true, reason: 'already loaded in this document' });
      continue;
    }
    have.add(k.href); // a document may list the same src twice
    queue.push({ key: k.key, href: k.href });
    decisions.push({ src: k.key, adopted: true, listed: true, reason: verdict.reason });
  }
  return { queue, decisions };
}

// ── 3. The shared-chrome gate ────────────────────────────────────────────────
//
// A0.1 puts the site nav OUTSIDE the swap container, which is what makes the nav
// survive a swap. The same fact has a consequence the ticket does not mention:
// the chrome the visitor keeps is the chrome of the document they LOADED. Swap
// from a page that has none into a page that has one and the destination renders
// without its nav — and, on the pages that carry no jQuery/Bootstrap either,
// without the vendor libraries its content expects.
//
// Measured over the 96 interceptable pages: 83 carry the shared chrome, 13 do
// not (404.html, the 8 controversy-roadmap posts, blog-bramblett, and three
// tool teasers). Every one of those 13 renders with no site nav TODAY, so
// hard-navigating away from them is exactly the behaviour they have now — zero
// regression, and the alternative is a destination page silently stripped of its
// navigation.
//
// This is evaluated against the LIVE document, so it bites only on a full page
// LOAD of a chrome-less page: once a visitor has soft-navigated INTO one from a
// chrome-bearing page, the chrome is still there (it is outside the container)
// and navigation continues to swap.
export function sharedChrome(doc, win) {
  const nav = !!(doc && doc.querySelector('nav.menubar'));
  const jquery = !!(win && win.jQuery);
  return { ok: nav && jquery, nav, jquery };
}
