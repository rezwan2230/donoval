// ── JORDAN-PERCH-A21: the persistent overlay layer ───────────────────────────
//
// Ticket #51 · Phase A / Phase 2 · depends on A0.1 (#66).
//
// ── THE PROBLEM THIS SOLVES ──────────────────────────────────────────────────
// A live Perch call is a WebRTC session, an open microphone and a JS closure. It
// dies the instant the document that owns it is torn down. The site survives
// navigation today only by putting all 143 content pages inside an `<iframe>`
// and keeping the call in the outer shell (`perch.html`) — which costs the site
// its URLs, its crawlability and its scroll position.
//
// Option B removes the iframe and swaps `<main id="perch-main">` in place
// (A2.2). That only works if the call lives in the same document as the content
// but OUTSIDE the region being swapped. This module is that outside region.
//
// ── THE INVARIANT ────────────────────────────────────────────────────────────
// Exactly one container — `<div id="perch-persistent">` — holding the page's
// concierge chrome and the live-call closure behind it, mounted as a DIRECT
// SIBLING of `<main id="perch-main">`, and never as a descendant of it.
//
// On a content page that concierge is `js/donovan-widget.js` (139 of 143 pages):
// `#dvn-perch-launcher`, which mints from /web-call and owns a RetellWebClient.
// It appends itself into this layer. The shell's `#concierge` orb is the OTHER
// implementation, shared through `js/perch/*` and driven by the shell today; the
// layer can take it over with this module's exported `mountShellConcierge()` —
// a module export, never a window property (DR-INSANE-A33, #58) — when `/` stops
// iframing the site. The layer never shows both at once; see the note there.
//
// "Direct sibling" is deliberate and stronger than "somewhere outside". A0.1
// injects the container at four different depths depending on the page shape
// (`wrap-div` puts it inside `div.box > div.border-grey`, `wrap-body` at body
// level, `stamp` onto a page's own `<main>`). Anchoring the layer to the
// container's own parent means one rule covers all 30 body shapes, and the
// relationship a reviewer has to check is a single `parentNode` comparison
// rather than "is it outside" evaluated against a tree that differs per page.
//
// ── WHY position:fixed FORCED A RUNTIME PROBE ────────────────────────────────
// The layer is `position:fixed` so the orb floats over the page. But a fixed
// element is positioned relative to the nearest ancestor that establishes a
// containing block — any ancestor carrying `transform`, `filter`, `perspective`,
// `backdrop-filter`, `contain` or a `will-change` naming one of those. On a
// `wrap-div` page the layer's ancestors are site chrome this ticket does not
// own, and a stylesheet change three months from now could silently trap the
// orb inside a card.
//
// So the mount MEASURES rather than assumes: it inserts the layer, reads the
// rect back, and if the layer is not viewport-anchored it re-homes to
// `document.body` and records `hostFallback`. `document.body` is still outside
// the container on every page — a body child cannot be a descendant of a `<main>`
// that is itself a body descendant — so the load-bearing invariant holds either
// way, and the weaker placement is reported instead of being silently accepted.
// See [[feedback_assert_behavior_not_source_spelling]]: the check is a measured
// rect, not a scan of the stylesheet for `transform`.
//
// ── WHERE THIS RUNS, AND WHERE IT DOES NOT ───────────────────────────────────
//   • Injected into `<head>` by `functions/_lib/perch-layer-inject.js`, on the
//     same pages A0.1 gives a container to. No page file references it.
//   • It mounts only in a TOP-LEVEL browsing context. Inside the Perch shell's
//     iframe, or inside a Vantage embed, the outer frame already owns an orb;
//     mounting here too would put two orbs on screen and start two calls.
//   • It mounts only when `#perch-main` exists. A page with no swap container
//     has nothing to swap, so it needs no layer — and the one page that hosts an
//     orb of its own (`perch.html`, the shell) is precisely the page A0.1 skips.
//     The two rules agree by construction rather than by a path list.

// JORDAN-196-LOGIN-SIGNOUT-R1 (#196): a SIDE-EFFECT import, and the only one in
// this file. /members/auth/signout had shipped with no caller since
// MEMBERS-CLIO-GATED-ACCESS-R1, so a member on a shared machine could not end
// their own session. That control has to reach all 39 pages under the four tier
// roots, and it cannot get there as a <script> tag: test/chrome-diff.test.mjs
// compares the script/stylesheet manifest of every changed page and fails on any
// change to it — the one rule the reviewed-structural allowlist does not waive.
// This module IS on all 39 (perch-layer-inject.js writes it into <head> of every
// page A0.1 gives a container to, which is all of them), so it is the load path
// that edits no page.
//
// It imports NOTHING and exports NOTHING. members-signout.js is a plain IIFE that
// boots itself and scopes itself by pathname, so it is not coupled to the layer:
// in particular the layer declines to mount inside a frame, and sign-out has no
// reason to inherit that. The layer's own behaviour below is untouched by it.
import '/js/members-signout.js';

// `chrome.js` (the orb) and `call.js` (the RetellWebClient) came out with the voice
// concierge. Their only caller here was `mountShellConcierge()`, which was already
// dormant — "deliberately not called on page load" — so nothing that ran lost a
// dependency. `command-channel.js` and `page-control.js` deliberately STAY: the
// no-voice qualifier flow below reuses their dispatch table without ever starting
// a poll, which is what JORDAN-NOVOICE-FRONTDOOR built it to do.
// JORDAN-PERCH-NATIVE-BOOK: `bookingPrefillFrom` is the answers → booking-fields
// translation, exported from the module that owns the question bank so the labels
// cannot drift from the options the caller actually tapped.
import { mountQualifier, bookingPrefillFrom } from '/js/perch/qualifier.js';
// A31 (#56): the direct-DOM booking executor. Kept in its own module for the same
// reason placement.js is — CI drives the real mapping against a jsdom window
// without loading Swup, the Retell SDK or the orb.
import { createBookingControl } from '/js/perch/booking-control.js';
// SHELDON-PERCH-COMMAND-CHANNEL: the consumer stack the A51 cutover left behind
// in the shell. `createCommandChannel` is the poll loop + dispatch table lifted
// out of js/perch/call.js; `createPageControl` is perch-inject.js's scroll /
// highlight branches ported to the live document.
// JORDAN-NOVOICE-FRONTDOOR: `BOOK_PATH` and `isBookTarget` are the channel's own
// spellings, already held to `ACTION_MAP.goto_booking.target` by CI. The no-voice
// door must reach the SAME page Paula's `goto_booking` does, or the two doors
// would disagree about where the calendar is.
import { createCommandChannel, BOOK_PATH, isBookTarget } from '/js/perch/command-channel.js';

/** Where a declined intake card sends the visitor instead of the calendar. */
const CONTACT_PATH = '/contact.html';
import { createPageControl } from '/js/perch/page-control.js';

// JORDAN-NOVOICE-FRONTDOOR: the join key a visitor who never called still needs.
// See that module's header for why `fn/qualifier_submit` refuses a submission
// without one, and why an id minted here is not a credential.
import {
  sessionId, markQualified, isQualified, stashPrefill, takePrefill,
  markClaimsNothing, claimsNothing, clearQualified, CLAIM_NONE,
} from '/js/perch/web-session.js';

// Placement rules, invariants and the shared constants live in ./perch/placement.js
// so CI can exercise the real functions without loading the Retell SDK, the
// consent gate or the orb DOM.
import {
  CONTAINER_ID, LAYER_ID, CONTAINER_SELECTOR,
  EVENT_MOUNTED, EVENT_SWAPPED, inspect, isPersistent, placeLayer,
} from '/js/perch/placement.js';

// DR-INSANE-A33 (#58): the exposure boundary. `claim`/`publish` own
// `window.Perch` outright instead of assigning into it, and `hasRouter` /
// `navigateVia` replace the `setRouter` handle this file used to publish. See
// the header of that file for what was reachable before and why.
import {
  claim, publish, hasRouter, navigateVia, routerLock, onRouterRegistered,
} from '/js/perch/surface.js';

// Re-exported because A2.2 imports the layer, not its internals.
export {
  CONTAINER_ID, LAYER_ID, CONTAINER_SELECTOR, LAYER_SELECTOR,
  EVENT_MOUNTED, EVENT_SWAPPED, isPersistent, inspect,
} from '/js/perch/placement.js';

// ── JORDAN-NOVOICE-FRONTDOOR: the book-intent convention ─────────────────────
//
// One attribute, one delegated listener, any number of triggers. An element marked
// with it opens the intake card instead of navigating; its `href` stays exactly as
// authored and remains the no-JS floor. Exported so the edge injector's test and
// the page markup are checked against the SAME string this file listens for — a
// convention spelled twice is a convention that drifts.
//
// The VALUE is the trigger label, and it reaches the lead record's `source` field
// (`/fn/qualifier_submit` → Vantage) where the firm reads attribution. Known values
// today: `utility_bar` (the #108 CTA), `contact_page` (the contact-page link), and
// `consent_decline`, which js/consent-gate.js passes directly rather than through
// an element.
export const BOOK_INTENT_ATTR = 'data-perch-book';
export const BOOK_INTENT_SELECTOR = '[' + BOOK_INTENT_ATTR + ']';

function buildLayer(doc) {
  const layer = doc.createElement('div');
  layer.id = LAYER_ID;
  // The layer is a full-viewport overlay that must not intercept clicks meant
  // for the page. Children opt back in (`#perch-persistent > * { pointer-events:
  // auto }` in css/perch-layer.css) so only the orb, the caption and the open
  // qualifier card are hit-testable.
  layer.setAttribute('data-perch-persistent', '');
  // Not `aria-hidden` — the orb is an interactive control and the qualifier is a
  // dialog. It is a presentational wrapper, so it takes no role of its own.
  return layer;
}

/**
 * The full control object. MODULE-PRIVATE since A33 (#58) — it holds the live
 * layer node, the concierge, the call and the qualifier, and publishing it was
 * the finding the A4.1 QA gate raised. `publicSurface` below is what the window
 * gets.
 */
let instance = null;
/** The frozen read-only surface published as `window.Perch.layer`. */
let publicSurface = null;

/**
 * Mount the persistent layer. Idempotent — a second call returns the first
 * instance's public surface, which is what makes it safe for the router to call
 * defensively after a swap.
 *
 * ── A33: WHAT THIS RETURNS, AND WHY IT IS NOT THE INSTANCE ───────────────────
 * `mount` is an ES module export, so any same-origin script can reach it with a
 * dynamic `import()`. If it returned the instance, de-exposing `window.Perch`
 * would have moved the control surface rather than removed it — `import('/js/
 * perch-layer.js').then(m => m.mount().root)` would hand back the live layer
 * node and the concierge. It returns the same read-only surface the window sees.
 */
export function mount() {
  if (instance) return publicSurface;

  const doc = document;
  const container = doc.getElementById(CONTAINER_ID);
  if (!container) return null; // no swap container → not a swappable page

  const layer = buildLayer(doc);

  // Direct sibling of the container, with a measured fallback if an ancestor
  // containing block would trap a position:fixed overlay. See ./perch/placement.js.
  const placed = placeLayer(doc, layer);
  if (!placed.ok) throw new Error('[perch-layer] ' + placed.reason);
  const { hostFallback } = placed;

  // ── Live-session identity ──────────────────────────────────────────────────
  // `instanceId` is minted once per mount. If a swap ever destroyed and rebuilt
  // the layer, this value would change — which makes it the cheapest possible
  // proof of continuity for A2.2's tests and for the Preview verifier. `ticks`
  // is monotonic and resets to 0 on a document reload, so a swap that silently
  // fell back to a hard navigation is detectable.
  const instanceId = 'perch-' + Math.random().toString(36).slice(2, 10);
  const mountedAt = performance.now();
  let ticks = 0;
  setInterval(() => { ticks++; }, 100);

  // Live, non-DOM resources the layer holds open across swaps. The call
  // registers its WebRTC audio here when it connects; the acceptance harness
  // registers a stand-in oscillator through the same API (a real Retell session
  // needs a Turnstile solve, which refuses automation by design).
  const liveResources = new Map();

  // ── The concierge that goes IN the layer ───────────────────────────────────
  //
  // On this site the concierge on a content page is `js/donovan-widget.js`
  // (loaded by 139 of 143 pages): it renders `#dvn-perch-launcher`, mints from
  // /web-call and holds its own RetellWebClient. It now appends itself into this
  // layer instead of into `document.body` — one line, at its `mount()`.
  //
  // So the layer does NOT build a second orb. An earlier revision of this ticket
  // did, and the Preview check caught the result: the shell's `#concierge` and
  // the widget's launcher landed on top of each other in the bottom-right corner,
  // both at z-index 2147483000, with the launcher winning the hit test. Two
  // concierges is a visible defect, and choosing WHICH one a page should show is
  // a product decision this ticket does not own.
  //
  // ── THE ORB PATH IS GONE, AND THIS IS WHERE IT WAS ─────────────────────────
  //
  // `mountShellConcierge()` stood here: the post-shell entry point that would have
  // built the orb, the caption and a voice call into this layer once `/` stopped
  // iframing the site. It was never called on page load, so removing it changed no
  // behaviour — but it was the only caller of `js/perch/chrome.js` and
  // `js/perch/call.js`, which is why both could go with it.
  //
  // `concierge` survives as a null that never fills. The three accessors on the
  // instance below (`concierge`, `call`, `qualifier`) keep answering `null` rather
  // than throwing, because callers that predate the removal — the swap path, the
  // members gate — read them defensively and a missing property would be the louder
  // failure. The no-voice qualifier below owns its own card and does not use this.
  const host = createLayerHost();
  const concierge = null;

  // ── JORDAN-NOVOICE-FRONTDOOR: intake WITHOUT a call ────────────────────────
  //
  // ── THE GAP ────────────────────────────────────────────────────────────────
  // JORDAN-PERCH-NATIVE-BOOK (#109) wired the qualifier→calendar auto-advance into
  // `mountCommandConsumer()`, which only runs when a router registers, and whose
  // card only ever opened from an `open_qualifier` Paula issued on a live call. So
  // the entire intake flow was reachable exactly one way: talk to Paula. A visitor
  // who taps "Book a Consultation" in the utility bar reached Paul's calendar
  // having answered nothing, and the firm received a booking with no intake.
  //
  // Nothing about the flow needs a call. The card is standalone; `navigate` +
  // `booking_prefill` need only a registered router; the layer mounts on
  // DOMContentLoaded regardless. So this is a second ENTRY POINT into an existing
  // flow, not a second flow — which is what makes one shared record possible
  // (Task 4) without the #114 journey state machine.
  //
  // ── ONE CARD, TWO CHANNELS ─────────────────────────────────────────────────
  // The card is mounted HERE, in the call-independent path, and the live-call
  // consumer below ADOPTS it rather than mounting a second one. That is forced,
  // not stylistic: `mountQualifier` is adopt-or-build on the fixed id `#qual`, so a
  // second call returns a second closure over the SAME DOM node — two `qualAns`
  // objects, two step counters, one set of click handlers, last render wins — and
  // `lockGlobal` refuses a second `window.__perch`, so the second card's probe
  // would silently report the first card's state.
  //
  // The CHANNELS are separate, and that separation is the load-bearing half:
  // `advanceToBooking` latches `advanced` per channel, so sharing one instance
  // would let a completed no-voice card make a later live-call auto-advance a
  // no-op (and the reverse). The no-voice channel is never `start()`ed — it has no
  // call id to poll with, and nothing to poll for.
  let noVoice = null;
  let bookIntents = 0;
  // JORDAN-SITE-UX-FIXES-R1. The two ways a card ends without a submit, counted
  // apart, because the whole ticket is that they are no longer the same outcome:
  // `dismissals` go nowhere, `declines` go to the calendar. A probe that reported
  // one number for both would read identically before and after this change.
  let dismissals = 0;
  let declines = 0;
  /**
   * Is a WebRTC session up in this document?
   *
   * Set by `bindCall` BEFORE its router gate and cleared by `releaseCall`, so it is
   * true even on a deployment where the bridge consumer is off. A boolean, never
   * the call id — the id is the bridge's bearer credential.
   */
  let liveCall = false;

  /**
   * Which id this document's qualifier record is written under.
   *
   * THE WHOLE OF TASK 4 IS THIS FUNCTION. `fn/qualifier_submit` refuses a
   * submission with no `call_id` (400 `call_id_required`, the B2 fix that removed
   * the shared `qual:default` bucket), and the modal's POST is fire-and-forget — a
   * 400 resolves rather than rejects, so a no-voice card with a null id would
   * render its done state over a record that was never written. Minting an id here
   * is what makes the no-voice door produce the same three server-side rows the
   * voice door produces: `qual:<id>` in the bridge DO, `qualbk:<id>` in
   * PERCH_ACTIONS, and the Vantage lead keyed on `call_id`. Same stores, same key
   * name, same shape — so `booking/_lib/qualifier-bind.js` keeps its single join.
   *
   * `liveCall && consumer`, not `consumer` alone: `releaseCall()` stops the poll
   * but leaves the channel's `curCall` set, so a visitor who hangs up and THEN taps
   * the CTA would otherwise write their second record under the dead call's id —
   * where Paula's read-once `get_qualifier_result` has already consumed the slot.
   */
  function joinKey() {
    if (liveCall && consumer) {
      const live = consumer.channel.callId();
      if (live) return live;
    }
    return sessionId(window);
  }

  function mountNoVoiceQualifier() {
    if (noVoice) return noVoice;
    // Its own channel. Never started: `start()` needs the bridge credential and
    // there is no call here. Everything the no-voice flow uses — the navigate
    // branch's unlock write, the soft `host.go`, `deliverPrefill` — is reached
    // through `dispatch`, which does not care whether the poll is running.
    const channel = createCommandChannel(host, {});
    const qualifier = mountQualifier(layer, {
      callId: joinKey,
      onQualified: (answers) => { bookIntentOpen = false; return advanceAfterQualifier(answers); },
      // JORDAN-SITE-UX-FIXES-R1: two callbacks where there was one, because the
      // card now tells the host WHICH of the two non-completing endings happened.
      // `onDismissed` is the backdrop, Esc and Back — the visitor stays put.
      // `onDeclined` is the labelled control inside the card — the calendar opens.
      onDismissed: () => abandonAfterQualifier(),
      onDeclined: (partial) => declineAfterQualifier(partial),
      // And the card only OFFERS the decline when this host would act on it. Same
      // condition `declineAfterQualifier` returns early on, asked before the button
      // is painted rather than after it is pressed — a card Paula raised mid-call
      // is not a card the visitor asked to book from, and it must not carry a
      // control that promises the calendar and delivers a silent close.
      canDecline: () => bookIntentOpen,
    });
    noVoice = { channel, qualifier };
    return noVoice;
  }

  /**
   * Was THIS opening of the card a book intent, rather than Paula's?
   *
   * The gate on the abandon path, and the reason it exists: `open_qualifier` is a
   * command Paula issues mid-conversation, and a caller who waves that card away
   * has not asked to go anywhere. Navigating them to the calendar would be a
   * behaviour change to the voice path — and on a router-less deployment it would
   * be a `location.assign` that hangs up the call they are still on.
   *
   * Set by `openBookIntent` only, and cleared the moment the card is completed or
   * dismissed, so it describes one opening and never leaks into the next.
   */
  let bookIntentOpen = false;

  /**
   * A card the visitor waved away. They stay exactly where they are.
   *
   * ── JORDAN-SITE-UX-FIXES-R1: THE DEFECT THIS FUNCTION WAS ──────────────────
   *
   * What used to be here is now `declineAfterQualifier` below, unchanged. What
   * changed is WHICH GESTURE reaches it, and that was the production defect: a
   * click on the dark area outside the intake card dismissed it AND navigated to
   * /book AND wrote the 30-minute booking unlock. So the qualifier the CTA exists
   * to put in front of the calendar was bypassed by the single most common way
   * anyone closes a modal they did not mean to open — and the "soft gate" on /book
   * was left open behind them for half an hour.
   *
   * #158's Task 5 reasoning is quoted below because it is still true and it is
   * still the reason the DECLINE path exists; it was only ever wrong about what a
   * dismiss means:
   *
   *     "The book-intent listener called `preventDefault()` on an anchor whose
   *      `href` was the calendar; if closing the card then did nothing, the visitor
   *      would be stranded on the page they started from and the CTA would be
   *      strictly WORSE than the plain link it replaced."
   *
   * They are not stranded. `js/perch/qualifier.js` now paints the destination as a
   * control they can see and press, so the visitor who genuinely wants the calendar
   * without the questions says so and gets it — and the visitor who tapped outside
   * a dialog gets the page they were reading back. One gesture, one meaning.
   *
   * Nothing is written here. No unlock, no claims-nothing marker, no prefill stash,
   * no navigation: a dismissed card must leave the tab byte-identical to a card
   * that was never opened, or the next /book visit inherits a decision the visitor
   * never made.
   */
  function abandonAfterQualifier() {
    if (!bookIntentOpen) return { via: 'none', reason: 'not a book intent' };
    bookIntentOpen = false;
    dismissals++;
    return { via: 'none', reason: 'dismissed — the visitor stays on this page' };
  }

  /**
   * The visitor pressed DECLINE: skip the questions, open the calendar anyway.
   *
   * The body below is #158's abandon path, moved rather than rewritten — every
   * comment in it describes a decision that is still exactly right for a visitor
   * who ASKED to go to the calendar without answering. Only the trigger moved, from
   * "closed the card somehow" to "pressed the control that says this".
   *
   * A booking with partial intake beats no booking, so they go to the calendar with
   * whatever they did tap already in the note.
   *
   * `directToBooking`, deliberately, and NOT `channel.advanceToBooking`: the
   * channel latches `advanced` on first use, so spending it here would make a
   * LATER completed card in the same document a silent no-op. This path is also
   * the one that must not claim a qualifier record — nothing was POSTed, so
   * `markQualified` is not called, no `set_call_id` is issued, and the booking
   * travels the ordinary no-`call_id` route (`join: 'none'`) rather than
   * presenting an id the server cannot vouch for.
   *
   * ── AND SAYING NOTHING IS NOT THE SAME AS SAYING NOTHING IS CLAIMED ─────────
   * SHELDON-QUALIFIER-JOIN-COMPOSE-R1. Every sentence above stayed true and the
   * conclusion stopped being. Withholding the key made the body identical to the
   * one case `booking/create.js` was taught to RECOVER a key for — the visitor
   * whose page-memory id died with the document — so the server supplied from the
   * `dl_qual` cookie exactly what this path declined to send. That cookie is per
   * BROWSER for six hours while everything here is per TAB, so on a shared browser
   * it is the previous visitor's: their finances onto this client's Clio record,
   * joined and reported `attached`.
   *
   * `markClaimsNothing` is this path saying so out loud, and the only thing that
   * can: the server sees one empty `call_id` for both cases and cannot tell which
   * visitor it is looking at. It is a no-op on a tab that already qualified — see
   * web-session.js — so a visitor who finishes the card and later abandons a second
   * one does not lose their own join.
   */
  function declineAfterQualifier(partial) {
    if (!bookIntentOpen) return { via: 'none', reason: 'not a book intent' };
    bookIntentOpen = false;
    declines++;
    try {
      if (liveCall) {
        // A book intent raised during a live call. The visitor still asked to
        // book, but a hard navigation would end the session — so unlock and let
        // their own next trip to /book land on a revealed calendar.
        //
        // NO CLAIMS-NOTHING MARKER HERE, and the omission is deliberate. There IS a
        // call in progress, so a qualifier record for it may exist or may be
        // written before this visitor books; marking the tab would suppress the
        // post-call cookie join that #153 exists to restore. The marker is only
        // ever for a visitor with no call and nothing submitted.
        unlockBooking();
        return { via: 'deferred', reason: 'live call — refusing to navigate on abandon' };
      }
      markClaimsNothing(window);
      applyQualifierClaim();
      // ── 2026-09-02: A DECLINE NO LONGER REACHES THE CALENDAR ──────────────
      // This used to be `directToBooking(bookingPrefillFrom(partial))` — unlock
      // + soft-swap to /book with the partial answers as the note. That was the
      // one route onto Paul's calendar that bypassed the protocol, and the firm
      // closed it: the calendar unlocks ONLY through a completed card (every
      // money question already offers "Prefer not to say", so reluctance still
      // completes; only abandonment does not). A visitor who would rather not
      // answer is not stranded — the control that reaches here is labelled as
      // the way to the contact form and phone, and that is where it goes. No
      // unlock is written, and `bookingPrefillFrom(partial)` is not called: the
      // partial answers travel nowhere.
      // 2026-09-04: and it no longer goes to the contact form either. The
      // control is a tel: link; the phone is the only alternative to answering.
      return { via: 'phone', reason: 'decline offers the phone only; nothing navigates' };
    } catch (e) {
      console.error('[perch-layer] abandon advance failed', e);
      return { via: 'none', reason: 'threw' };
    }
  }

  /**
   * A completed card, from either door, onto the prefilled calendar.
   *
   * Which channel it travels on is decided by whether a call is live, and for one
   * reason: on a live call Paula may issue `goto_booking` in the same breath, and
   * the two must coalesce to ONE navigate — which only works if they share a
   * channel. With no call there is no Paula, nothing to converge with, and a
   * separate channel is what keeps the two doors' latches independent.
   */
  function advanceAfterQualifier(answers) {
    const prefill = bookingPrefillFrom(answers);
    try {
      const bound = !!(liveCall && consumer && consumer.channel.callId());
      if (!bound) {
        // The no-voice half of the join. `markQualified` records that a card
        // actually completed under this tab's id — without it, every later /book
        // visit in the tab would present an id naming no record and resolve
        // `unverified`, turning a clean signal into noise. `set_call_id` is the
        // seam `booking-widget.js` already reads at submit time (`__perchCallId`),
        // so the booking POST carries the same key the qualifier POSTed under and
        // NOTHING on the booking side changes.
        //
        // Deliberately not run when bound: on a live call `channel.start()` has
        // already pointed `__perchCallId` at the Retell id, and overwriting it
        // would detach the call's own booking from the call's own record.
        markQualified(window);
        try { host.applyBooking('set_call_id', { call_id: sessionId(window) }); } catch (e) { /* widget absent */ }
      }
      const channel = bound ? consumer.channel : mountNoVoiceQualifier().channel;
      if (hasRouter()) {
        // The path #109 proved: unlock + soft swap + prefill, coalesced, through
        // the dispatch table Paula's own commands travel.
        return channel.advanceToBooking(prefill);
      }
      if (liveCall) {
        // No router AND a live call. `host.go` can only serve this with a
        // `location.assign`, and that ends the WebRTC session — so it must not
        // run. Degrade instead of navigating: write the unlock and hold the
        // prefill, so the visitor's own next trip to /book (the CTA anchor is a
        // real link) lands on a revealed, prefilled calendar.
        unlockBooking();
        return { via: 'deferred', reason: 'no router with a live call — refusing to hard-navigate' };
      }
      return directToBooking(prefill);
    } catch (e) {
      // The card is already showing its done state. Failing to open the calendar
      // must not turn that into a broken card or a dead call.
      console.error('[perch-layer] booking advance failed', e);
      return { via: 'none', reason: 'threw' };
    }
  }

  /**
   * Restate this tab's claims-nothing marker where the booking widget reads it.
   *
   * `js/booking-widget.js` composes its POST from `window`, so the marker has to be
   * ON the window the widget is in, and it has to be re-applied on every document —
   * a global does not survive the `location.assign` the no-router abandon path
   * performs, which is exactly the navigation that leads to the booking this marker
   * is about. `web-session.js` holds the durable copy in sessionStorage; this puts
   * the current document's shadow of it back.
   *
   * NOT ROUTED THROUGH `host.applyBooking`. That reaches `booking-control.js`, whose
   * `COMMAND_MAP` is held equal to the commands `perch-inject.js` forwards from the
   * bridge — so adding a verb there would make "claims nothing" a REMOTELY DRIVABLE
   * command, settable by anything that can queue a page action. This is a local
   * decision about a local visitor and it must not become part of Paula's surface.
   * The assignment is the same shape `set_call_id` performs and swallows failure the
   * same way; a frozen or cross-origin `window` costs the marker, not the booking.
   *
   * Written only when the marker is actually set. Assigning `''` otherwise would
   * clear a marker a later document had legitimately applied.
   */
  function applyQualifierClaim() {
    try {
      if (claimsNothing(window)) window.__perchQualifierClaim = CLAIM_NONE;
    } catch (e) { /* frozen window — the booking still completes, unenriched */ }
  }

  /** The 30-minute window js/page/booking-gate.js reads to reveal `#book-live`. */
  function unlockBooking() {
    try { window.localStorage.setItem('donovan_booking_unlock', String(Date.now())); } catch (e) { /* private mode */ }
  }

  /**
   * Pick up a no-voice qualifier on the booking page, however the visitor got here.
   *
   * Called once at mount, and it covers the two ways a completed card reaches
   * /book with a fresh document: the no-router `location.assign` below, and a
   * visitor who simply closed the card and clicked the link themselves. On any
   * other page it does nothing rather than spending the prefill into a document
   * with no `DLBooking` — a payload applied to `widget_absent` is a payload the
   * visitor never sees.
   *
   * The id is re-presented here because `window.__perchCallId` does not survive a
   * document load; `web-session.js` holds it in sessionStorage precisely so this
   * side of the load can restate it.
   *
   * THE TWO HALVES ARE GATED DIFFERENTLY, and that asymmetry is Task 5. The join
   * key is claimed only when a card actually completed (`isQualified`), because an
   * id naming no record resolves `unverified` and turns a clean signal into noise.
   * The PREFILL is applied either way: a visitor who abandoned the card halfway
   * still tapped those answers, and carrying them onto the form is the difference
   * between partial intake and none.
   */
  function resumeNoVoiceBooking() {
    try {
      if (!isBookTarget(window.location.pathname)) return null;
      if (isQualified(window)) {
        try { host.applyBooking('set_call_id', { call_id: sessionId(window) }); } catch (e) { /* widget absent */ }
      }
      // THE THIRD THING THAT HAS TO CROSS THE LOAD. The key and the prefill were
      // always restated here; the claims-nothing marker has to be too, because the
      // document that decided it is gone by the time the widget composes the POST.
      // Without this the abandon path's decision dies at the `location.assign` and
      // the booking arrives at /booking/create indistinguishable from the one whose
      // key was merely lost — which is the composition defect, restored by omission.
      applyQualifierClaim();
      const payload = takePrefill(window);
      if (!payload || typeof payload !== 'object') return null;
      return host.applyBooking('booking_prefill', payload);
    } catch (e) {
      return null;
    }
  }

  /**
   * The no-router fallback: reach the calendar without the router at all.
   *
   * With no router `host.go` is a `location.assign` — a full document load. On the
   * no-voice path that is ACCEPTABLE and nowhere else is: there is no WebRTC
   * session to protect, which is the entire reason the soft swap exists. The
   * prefill and the join key cannot survive that load in memory, so they ride in
   * sessionStorage and `resumeNoVoiceBooking()` picks them up on the new document.
   *
   * Already on /book, no navigation is needed or wanted — `location.assign` to the
   * page you are on is a reload that would throw the prefill away. Apply it in
   * place and run the gate's own reveal, which is idempotent by design.
   *
   * Nothing here submits. `host.applyBooking` reaches `booking-control.js`, whose
   * FORBIDDEN_METHODS list is unchanged and whose COMMAND_MAP has no submit verb;
   * the visitor still presses Confirm.
   */
  function directToBooking(prefill) {
    unlockBooking();
    if (isBookTarget(window.location.pathname)) {
      const applied = prefill ? host.applyBooking('booking_prefill', prefill) : null;
      host.revealBooking();
      return { via: 'in_page', applied };
    }
    // Park it BEFORE the navigation: with no router this is a `location.assign`
    // and nothing in memory survives it. With a router `host.go` soft-swaps and
    // the stash simply goes unread — harmless, and read-once either way.
    stashPrefill(prefill, window);
    host.go(BOOK_PATH);
    return { via: 'document_load' };
  }

  /**
   * Open the card for a visitor who asked to book. The BOOK A CONSULTATION door.
   *
   * Returns false — rather than throwing — when there is nothing to open, because
   * the caller is a click handler that only calls `preventDefault()` on true. A
   * failure therefore falls through to the anchor's own `href`, so the no-JS floor
   * doubles as the failure floor.
   *
   * `source` is the trigger label, and it lands in the lead record's `source` field
   * (`/fn/qualifier_submit` → Vantage) where the firm reads attribution. A visitor
   * who arrives this way was never asked "how did you hear about us", so the field
   * is otherwise empty and the door is the most useful thing in it.
   */
  function openBookIntent(source) {
    const nv = mountNoVoiceQualifier();
    if (!nv) return false;
    let lang = '';
    try { lang = doc.documentElement.getAttribute('lang') || ''; } catch (e) { lang = ''; }
    bookIntentOpen = true;
    nv.qualifier.openQualifier(lang, String(source || 'book_cta'));
    bookIntents++;
    return true;
  }

  // ── SHELDON-PERCH-COMMAND-CHANNEL: the consumer stack ──────────────────────
  //
  // ── THE REGRESSION THIS IS ─────────────────────────────────────────────────
  // Read `mountShellConcierge` above and the shape of the A51 defect is right
  // there: the poll loop, the qualifier and the navigation drive were only ever
  // built by that function, and that function is "deliberately not called on page
  // load" because calling it would put a SECOND orb on top of the launcher. So
  // when A51 (#62) moved every visitor off the shell and onto a content page, it
  // moved them onto the one page shape where none of it is built. Paula's
  // commands reached the Durable Object, `do_page_action` answered `done`, and the
  // page they were meant to drive had nobody reading them.
  //
  // ── WHY THIS IS NOT `mountShellConcierge()` ────────────────────────────────
  // Because the concierge is not the problem. On a content page
  // `js/donovan-widget.js`'s `#dvn-perch-launcher` is the concierge, and it holds
  // the RetellWebClient and the /web-call token — JORDAN-PERCH-LAUNCHER-PARITY
  // (#89) dressed it to look exactly like the shell's orb for that reason. What
  // is missing is not a second orb; it is the CONSUMER behind the one that is
  // already there. So this builds the consumer alone: the bridge poll, the
  // qualifier card, and nothing that paints a control.
  //
  // The live session's identity comes from the launcher through `bindCall()`
  // below, because `createCall()` — which is what normally owns a call id — is
  // exactly the thing we are NOT building here.
  //
  // ── GATED ON THE ROUTER, WHICH IS THE GATE THAT ALREADY EXISTS ─────────────
  // Called only from `onRouterRegistered`, so with `PERCH_ROUTER` unset the
  // router module is never injected, this never runs, and the layer's behaviour
  // is byte-identical to what production serves today: no poll, no qualifier, no
  // `window.__perch`. That is the same `router !== null` signal A31 (#56) scoped
  // the direct booking path to, for the same three reasons named there.
  let consumer = null;

  function mountCommandConsumer() {
    if (consumer) return consumer;

    // ── JORDAN-PERCH-NATIVE-BOOK (#109), re-homed by JORDAN-NOVOICE-FRONTDOOR ──
    //
    // THE SYMPTOM #109 fixed. A completed card POSTed the lead, told the caller
    // "Paula will pull up the calendar" — and stopped. The calendar appeared only
    // if Paula separately issued `goto_booking`, so the caller read a promise and
    // then sat there.
    //
    // THE ROUTE ALREADY EXISTED, in full: `command-channel.js`'s navigate branch
    // writes `donovan_booking_unlock` and soft-swaps through `host.go` →
    // `navigateVia` (the WHOLE point — a full document load ends the WebRTC
    // session the layer exists to protect), `booking-gate.js` reveals
    // `#book-live`, and `booking-control.js` drives `DLBooking` on the page. No
    // `location.assign` on this path, no `target="_top"`, no second unlock write,
    // and nothing that submits — FORBIDDEN_METHODS still holds and the CALLER
    // always presses Confirm.
    //
    // THE VOICE PATH IS UNCHANGED BY THE RE-HOMING. The trigger now lives in
    // `mountNoVoiceQualifier` / `advanceAfterQualifier` above, because the card
    // had to become reachable without a call. On a live call `advanceAfterQualifier`
    // computes `bound` true and takes exactly the branch this block used to be —
    // `consumer.channel.advanceToBooking(bookingPrefillFrom(answers))` — and skips
    // the no-voice join entirely, so `__perchCallId` keeps naming the Retell call.
    //
    // This function ADOPTS that one card rather than mounting a second — see the
    // ONE CARD, TWO CHANNELS note there for why a second `mountQualifier` on this
    // layer is a collision and not an option. The other two `mountQualifier` call
    // sites in the tree stay deliberately unwired: `mountShellConcierge()` above
    // is "deliberately not called on page load" (it would build a second orb), and
    // `js/page/perch-shell.js` is the `/perch` rollback target.
    const qualifier = mountNoVoiceQualifier().qualifier;
    const channel = createCommandChannel(host, {
      // The launcher owns the only status pill on a content page. Handing the
      // channel its own would mean two, so `bindCall()` lends us the widget's and
      // this is the no-op until it does — see `say` on the instance below.
      say: (...a) => { if (consumer && consumer.say) consumer.say(...a); },
      openQualifier: (...a) => qualifier.openQualifier(...a),
    });

    consumer = { channel, qualifier, say: null };
    return consumer;
  }

  /**
   * Hand the layer the live call.
   *
   * `js/donovan-widget.js` calls this from its `call_started` handler with the
   * `call_id` /web-call minted, and `releaseCall()` from `call_ended` / `error`.
   * The id is what the poll sends as `x-perch-call-id`, so until this is called
   * there is nothing to poll FOR and the loop correctly does not run.
   *
   * `say` is the widget's own status pill, lent to the channel so the booking
   * confirmation line lands on the surface the caller is already looking at.
   */
  function bindCall(detail) {
    const callId = detail && (detail.callId || detail.call_id);
    if (!callId) return { ok: false, reason: 'no call id' };
    // JORDAN-NOVOICE-FRONTDOOR: recorded BEFORE the router gate, and deliberately.
    // `js/donovan-widget.js` mints and connects whether or not a router is present;
    // only the CONSUMER is router-gated. So without this flag the layer would have
    // no way to know a WebRTC session is up on a router-less deployment, and the
    // no-voice fallback's `location.assign` would hang up on a live caller. It is a
    // boolean, never the id — the id is the bridge's bearer credential.
    liveCall = true;
    if (!hasRouter()) return { ok: false, reason: 'no router — the consumer is off for this deployment' };
    const c = mountCommandConsumer();
    c.say = (detail && typeof detail.say === 'function') ? detail.say : null;
    c.channel.start(String(callId));
    return { ok: true };
  }

  function releaseCall() {
    liveCall = false;
    if (!consumer) return { ok: true, reason: 'nothing bound' };
    consumer.channel.stop();
    consumer.say = null;
    return { ok: true };
  }

  instance = {
    root: layer,
    container: () => doc.getElementById(CONTAINER_ID),
    instanceId,
    hostFallback,
    isPersistent,
    /** Always null since the orb path was removed — see the note where it stood. */
    get concierge() { return concierge; },
    get call() { return concierge && concierge.call; },
    get qualifier() { return concierge && concierge.qualifier; },
    /** SHELDON-PERCH-COMMAND-CHANNEL: the bridge consumer, once the router is in. */
    mountCommandConsumer,
    /** JORDAN-NOVOICE-FRONTDOOR: the call-independent card and its own channel. */
    mountNoVoiceQualifier,
    openBookIntent,
    bindCall,
    releaseCall,
    inspect: () => inspect(doc),

    /**
     * A31 (#56): what the booking control channel currently sees — whether the
     * router is active, whether the widget's API is present, and the last ten
     * commands with their outcomes. Diagnostics only; it drives nothing.
     */
    bookingProbe: () => host.bookingProbe(),

    /**
     * Register a live resource the layer must keep alive across swaps.
     * @param {string} name
     * @param {{ clock: () => number, state?: () => string }} handle
     */
    attachLiveResource(name, handle) { liveResources.set(name, handle); return handle; },
    detachLiveResource(name) { liveResources.delete(name); },

    /**
     * Everything a swap-continuity check needs, in one call.
     *
     * `ticks` and `uptimeMs` are monotonic within a document; `instanceId`
     * identifies the closure. Compare all three across a swap: unchanged
     * instanceId + advanced clocks = the layer was never torn down.
     */
    probe() {
      const resources = {};
      for (const [name, h] of liveResources) {
        try {
          resources[name] = { clock: h.clock(), state: h.state ? h.state() : null };
        } catch (e) {
          resources[name] = { clock: null, state: 'error' };
        }
      }
      return {
        instanceId,
        ticks,
        uptimeMs: performance.now() - mountedAt,
        hostFallback,
        callLive: concierge ? concierge.call.isLive() : null,
        callUptimeMs: concierge ? concierge.call.uptimeMs() : null,
        // SHELDON-PERCH-COMMAND-CHANNEL. `null` here on a page with the router on
        // is the A51 regression itself, so it is the first thing a verifier reads.
        // The channel's own probe reports `callId` as 'set'/null, never the value:
        // the call id is the bridge's bearer credential (functions/fn/page-poll.js
        // B2-c) and a diagnostic that prints it hands it out.
        commandChannel: consumer ? consumer.channel.probe() : null,
        // JORDAN-NOVOICE-FRONTDOOR: the card is now mounted in the call-independent
        // path, so this is true on every layer page — including a deployment with
        // the router off, where `commandChannel` above is still correctly null. It
        // used to be `!!consumer`, i.e. "a call bound on a routed deployment".
        qualifierMounted: !!noVoice,
        // The no-voice door's own state. `bookNavs`/`autoAdvanced` inside this
        // channel probe are separate latches from `commandChannel`'s — that
        // separation is the point. `joinKey` reports SHAPE, never the value: the
        // Retell id is a bearer credential and a diagnostic that prints it hands it
        // out, so the two doors are told apart by which door, not by which id.
        noVoice: noVoice ? {
          channel: noVoice.channel.probe(),
          bookIntents,
          dismissals,
          declines,
          liveCall,
          joinKey: (liveCall && consumer && consumer.channel.callId()) ? 'call' : 'web_session',
        } : null,
        pageControl: host.pageProbe(),
        // Which concierge this page actually shows, and whether it is in here.
        concierge: conciergeState(),
        resources,
        placement: inspect(doc),
      };
    },
  };

  /**
   * Report the concierge on this page, whoever owns it.
   *
   * `#dvn-perch-launcher` is the widget's; `#concierge` is the shell orb's. The
   * acceptance condition is that exactly one exists and that it is inside this
   * layer — anything else is either a duplicate or a node a swap can destroy.
   */
  function conciergeState() {
    const widget = doc.getElementById('dvn-perch-launcher');
    const orbEl = doc.getElementById('concierge');
    const present = [widget, orbEl].filter(Boolean);
    const c = doc.getElementById(CONTAINER_ID);
    return {
      kind: widget ? 'widget' : orbEl ? 'shell-orb' : 'none',
      count: present.length,
      allInLayer: present.length > 0 && present.every((e) => layer.contains(e)),
      insideContainer: present.some((e) => !!(c && c.contains(e))),
    };
  }

  // Re-assert the invariant after every swap. A2.2 dispatches EVENT_SWAPPED; if
  // a future router change ever re-parents or clones the layer, this is what
  // turns a silent regression into a console error on the very first swap.
  doc.addEventListener(EVENT_SWAPPED, () => {
    const after = inspect(doc);
    if (!after.ok) {
      console.error('[perch-layer] invariant broken after content swap', after);
    }
  });

  // ── JORDAN-NOVOICE-FRONTDOOR: the card, mounted with no call in sight ──────
  //
  // THE CALL-INDEPENDENT MOUNT PATH. Unconditional and NOT behind
  // `onRouterRegistered`, because the no-router fallback exists precisely for the
  // deployment where no router is injected — gating the card on a router would put
  // the fallback behind the condition it was written to survive.
  //
  // This is a REAL behaviour change on a router-less deployment, and it is the one
  // thing to look at in review: `#qual` is now built, and `window.__perch` is now
  // locked, on every layer page. Both were previously absent with `PERCH_ROUTER`
  // unset. What is still absent is everything that talks to the bridge — the poll
  // never starts, no `x-perch-call-id` is ever sent, and `probe().commandChannel`
  // stays null until a call binds.
  mountNoVoiceQualifier();

  // ── The book-intent listener ───────────────────────────────────────────────
  //
  // ONE delegated listener on `document`, for `[data-perch-book]`. Delegated
  // because the marked elements are in the SWAPPED region (the contact-page link)
  // or injected by the edge on every page (the utility-bar CTA), so a per-element
  // binding would be lost by the first soft navigation and would need re-running on
  // every `dl:content-swapped`. A `document` listener survives every swap by
  // construction — the same reason `js/inline-actions.js` is on the adoption
  // allow-list rather than re-bound.
  //
  // ── WHY preventDefault IS REQUIRED, AND WHY IT IS CONDITIONAL ──────────────
  // The utility-bar CTA carries `target="_top"` (JORDAN-HEADER-UTILITY-BAR, #108),
  // which is its escape hatch out of the Perch shell iframe and stays exactly as it
  // is. Unframed — the only context this layer mounts in — an unprevented click on
  // it is a full document load, which would throw away the card we are about to
  // open and, on a routed page, any live call with it.
  //
  // But `preventDefault()` runs only when the card actually opened. A visitor whose
  // click is swallowed by a handler that then failed has a dead button, so the
  // anchor's own `href` is both the no-JS floor and the failure floor.
  //
  // Modified and non-primary clicks are left entirely alone: cmd/ctrl-click,
  // middle-click and shift-click are how people open a link in a new tab, and a
  // modal in THIS tab is not what they asked for.
  //
  // ── WHY THE CAPTURE PHASE, AND WHY stopPropagation ─────────────────────────
  //
  // MEASURED on the Preview during #110, where the bubble-phase version of this
  // handler was completely INERT on every routed page. Swup does not delegate on
  // `document`; it delegates on `document.documentElement` —
  //
  //     const l = s instanceof Document ? s.documentElement : s;  // swup.umd.js
  //
  // — which sits one node BELOW `document` in the event path. So on a bubbling
  // click Swup's handler runs first no matter which of us registered first, and it
  // calls `preventDefault()` before ours is reached. A `if (ev.defaultPrevented)
  // return` first guard, written to respect another handler's decision, therefore
  // declined every single click against a SPA router that preventDefaults every
  // internal link: `probe().noVoice.bookIntents` stayed 0 while the page swapped to
  // /book with nothing asked, and jsdom could not see it because there is no Swup
  // in jsdom. Same shape as [[feedback_router_early_return_makes_optout_inert]].
  //
  // Capture at `document` runs before capture at `documentElement` and before every
  // bubble listener, so this is first by the tree rather than by luck.
  //
  // `stopPropagation()` is then required, not belt-and-braces: `swup.umd.js`
  // contains no `defaultPrevented` check anywhere, so preventing the default does
  // NOT stop it from performing the visit. Scoped to matched elements only — an
  // event that is not a book intent is never touched, so nothing else on the page
  // (js/inline-actions.js's delegated dispatcher, the router's ordinary links)
  // changes behaviour.
  doc.addEventListener('click', (ev) => {
    try {
      if (ev.defaultPrevented || ev.button !== 0 || ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
      const t = ev.target && ev.target.closest ? ev.target.closest(BOOK_INTENT_SELECTOR) : null;
      if (!t) return;
      if (openBookIntent(t.getAttribute(BOOK_INTENT_ATTR) || '')) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    } catch (e) {
      // Nothing was prevented or stopped on this path, so the router — or failing
      // that the browser — still follows the href. The link is the failure floor.
      console.error('[perch-layer] book intent failed', e);
    }
  }, true);

  // A no-voice qualifier that finished on a previous document — the no-router
  // fallback's navigation, or a visitor who closed the card and clicked through
  // themselves. No-ops everywhere except /book with a completed card behind it.
  resumeNoVoiceBooking();

  // ── The other half of the one-shot (SHELDON-QUALIFIER-JOIN-COMPOSE-R1) ──────
  //
  // `booking/create.js` spends the `dl_qual` cookie the moment a booking is
  // CONFIRMED, so one qualifier record attaches to at most one booking. This tab's
  // copy of that decision was not spent with it, and the two stores drifting apart
  // at that exact moment is a bug with a signature: `resumeNoVoiceBooking` kept
  // re-presenting an id whose KV record `qual.consume()` had just deleted, every
  // later booking in the tab resolved `unverified`, and the server logged a
  // forged-id refusal against a key it had issued itself. The firm's own returning
  // visitor, reported as an attack.
  //
  // The widget's confirmation is the same signal `command-channel.js` already
  // listens for — a same-origin `postMessage` from `js/booking-widget.js` on the
  // 201/207 path — and it fires whether or not a channel was ever mounted, which a
  // no-voice tab's may not have been. Listened for HERE rather than in the channel
  // for that reason.
  try {
    window.addEventListener('message', (ev) => {
      try {
        if (ev.origin !== window.location.origin) return;
        if (!ev.data || ev.data.__perchBooking !== 'confirmed') return;
        // The tab's claim is spent. The claims-nothing marker deliberately is NOT
        // (web-session.js): a tab that submitted nothing has still submitted
        // nothing after it books.
        clearQualified(window);
        // And stop presenting the key itself, or the next booking in this tab
        // sends an id whose record is gone. ONLY on the no-voice path: a live call
        // owns `__perchCallId` through `channel.start()` and `onContentReady`
        // re-hands it, so clearing it here would fight the call for its own global.
        if (!liveCall) {
          try { host.applyBooking('set_call_id', { call_id: '' }); } catch (e) { /* widget absent */ }
        }
      } catch (e) { /* a malformed message must never break the page */ }
    });
  } catch (e) { /* no window listener surface — nothing here is load-bearing for the booking */ }

  // ── A33 (#58): the published surface ───────────────────────────────────────
  //
  // Four keys, and the rule they satisfy is narrow enough to check by reading
  // them: nothing here mutates navigation or booking, and nothing here hands out
  // a node, a closure or a constructor.
  //
  //   probe / bookingProbe   read-only diagnostics. `bookingProbe` is the A31
  //                          Preview verifier's gate check (`routerActive`).
  //   attach/detachLiveResource
  //                          the ONLY mutators, and they mutate a diagnostics
  //                          Map that nothing but `probe()` reads. They stay
  //                          public because the A22 acceptance harness proves
  //                          swap survival by parking a live AudioContext clock
  //                          here (test/preview/verify-a22.mjs) — presence in the
  //                          DOM is not proof of a surviving session, a running
  //                          clock is. See [[feedback_spike_prove_with_a_live_resource]].
  //
  // Deliberately NOT published, all of which used to be: `setRouter` (installs
  // the navigation callback every agent-driven `go` passes through — the finding),
  // `root` and `container` (live nodes; a script holding `root` can re-parent the
  // layer INTO the swap container and every navigation then destroys the call),
  // `concierge` / `call` / `qualifier` (whole control objects — `call.hangUp`,
  // `qualifier.openQualifier`), `mountShellConcierge` (builds a second orb),
  // `inspect` / `isPersistent` / `instanceId` / `hostFallback` (all already
  // readable through `probe()`, so publishing them twice only widens the surface).
  publicSurface = {
    probe: () => instance.probe(),
    bookingProbe: () => host.bookingProbe(),
    attachLiveResource: (name, handle) => { instance.attachLiveResource(name, handle); },
    detachLiveResource: (name) => { instance.detachLiveResource(name); },
  };

  // Fail-closed: if we cannot OWN `window.Perch`, we publish nothing into it.
  // Assigning into a namespace someone else authored is how the surface would be
  // captured — see [[feedback_published_instance_is_not_a_probe_namespace]]. The
  // layer itself keeps working; only the diagnostics go dark.
  const claimed = claim(window);
  if (claimed.ok) {
    const put = publish(window, 'layer', publicSurface);
    if (!put.ok) console.error('[perch-layer] layer surface not published:', put.reason);
  } else {
    console.error('[perch-layer] namespace not claimed:', claimed.reason);
  }

  // ── SHELDON-PERCH-COMMAND-CHANNEL: boot the consumer when the router is in ──
  //
  // Not `if (hasRouter())` — it is unconditionally false at this point. Both
  // modules are deferred `type="module"` tags in `<head>`, so the layer's
  // DOMContentLoaded handler is registered first and runs first, and the router
  // registers later still, after awaiting swup.umd.js. See `onRouterRegistered`
  // in js/perch/surface.js for why this is a one-shot callback rather than a poll.
  //
  // With `PERCH_ROUTER` unset the router module is never injected, this callback
  // never fires, and nothing below it is built — no poll, no qualifier card, no
  // `window.__perch`. Production is unchanged until the variable is set.
  onRouterRegistered(() => {
    try {
      mountCommandConsumer();
    } catch (e) {
      // A consumer that fails to build must not take the page or the call with
      // it. The launcher still calls; only Paula's page control is missing.
      console.error('[perch-layer] command consumer failed to mount', e);
    }
  });

  layer.dispatchEvent(new CustomEvent(EVENT_MOUNTED, { bubbles: true, detail: { instanceId } }));
  return publicSurface;
}

/**
 * Bind the live call to the layer's bridge consumer.
 *
 * A MODULE export, and deliberately not a window property — same boundary A33
 * (#58) drew for `mountShellConcierge`. The argument is the `x-perch-call-id`
 * credential every bridge poll carries, so a `window.Perch.layer.bindCall` would
 * let any script in the document point the poll at a call id of its choosing.
 * (The residual risk that a same-origin script can `import()` this file is the
 * one recorded at the top of js/perch/surface.js, unchanged: a script that can
 * execute a same-origin module can also just `fetch('/fn/page-poll')` with the
 * same header, so this adds no reach it did not already have.)
 *
 * Returns `{ok:false}` rather than throwing when there is no router — the caller
 * is `js/donovan-widget.js`'s `call_started` handler and must never be able to
 * fail the call it has just connected.
 *
 * @param {{callId?: string, call_id?: string, say?: Function}} detail
 */
export function bindCall(detail) {
  return instance ? instance.bindCall(detail) : { ok: false, reason: 'layer not mounted' };
}

/**
 * JORDAN-NOVOICE-FRONTDOOR: open the intake card for a visitor who is not on a
 * call, and who may have just declined to be recorded.
 *
 * A MODULE export, not a window property — the same boundary A33 (#58) drew for
 * `bindCall` and `mountShellConcierge`. It opens a dialog that collects the
 * visitor's residency, income band and net-worth band, so a `window.Perch.layer`
 * handle to it would let any script on the page raise that card at a moment nobody
 * asked for and watch what gets tapped into it.
 *
 * The caller is `js/consent-gate.js`'s decline branch, which reaches it with a
 * dynamic `import()`. That is a cache hit, not a second execution — the edge
 * injects this module into every container page's `<head>`, so it is already
 * evaluated by the time a consent modal can exist.
 *
 * Returns `false` rather than throwing when there is no layer (the `/perch` shell,
 * `nav-block`, or any document A0.1 decided `skip` for), so the caller can fall
 * back to the surface it had before.
 *
 * @param {string} source the trigger label, e.g. 'consent_decline'
 */
export function openBookingQualifier(source) {
  return instance ? instance.openBookIntent(source) : false;
}

/** Stop the bridge poll. Called from the launcher's `call_ended` / `error`. */
export function releaseCall() {
  return instance ? instance.releaseCall() : { ok: false, reason: 'layer not mounted' };
}

// `mountShellConcierge()` was exported here. It built the orb and a voice call into
// the mounted layer, and was the post-shell entry point for when `/` stopped
// iframing the site. That future did not arrive before the concierge was retired,
// so the export goes with the function rather than standing as a name that returns
// nothing. Anything importing it will now fail loudly at build time, which is the
// correct way for a removed capability to announce itself.

/**
 * The host adapter for the de-iframed model.
 *
 * The shell's adapter drives an `<iframe>`; this one drives the live document.
 *
 * ── SHELDON-PERCH-A31 (#56): the executor Phase 3 was waiting for ────────────
 * A2.1 shipped `drive()` posting the shell's exact `{type:'perch', cmd, target,
 * payload}` envelope at its own window, and said so plainly: "Wiring that
 * executor into the top-level document is Phase 3; until then these messages are
 * simply unobserved." They still are — nothing in a top-level document listens
 * for `{type:'perch'}`, because the listener is `perch-inject.js` and that file
 * only ever runs INSIDE the shell's iframe. So under the router every booking
 * command Paula issues reached exactly nobody.
 *
 * `drive()` now takes the direct road for booking commands when — and only when —
 * a router has registered. `router !== null` is the precise signal, and it is the
 * right one for three reasons: A2.2 registers itself at boot, so it is true
 * exactly when the site is one document; it is a closure variable rather than a
 * global, so nothing outside can flip it; and in production, where
 * `PERCH_ROUTER` is unset and no router is injected, it is false and this
 * function's behaviour is byte-identical to what shipped in A2.1.
 *
 * Non-booking commands (`scroll`, `highlight`, `scrollby`) still take the
 * postMessage road unchanged. They were unobserved under the router before this
 * ticket and they remain so; #56 scopes Phase 3 to the booking channel, and
 * quietly widening it here would be a change nobody reviewed.
 */
/**
 * Every URL spelling that resolves to the homepage document.
 *
 * `/` and `/index` and `/index.html` all reach the same bytes, and
 * js/perch/swap-policy.js EXCLUDES all three from soft navigation — correctly,
 * for the site as it was: `/` was a 200-rewrite to the concierge shell, which has
 * no `#perch-main` for Swup to swap.
 */
export const HOME_SPELLINGS = /^\/(index(\.html)?|home(\.html)?)?$/i;

/**
 * The homepage path that is actually swappable. Extensionless, and not `/index`.
 * SHELDON-PERCH-A51 (#62) measured every other spelling on Preview: `/index.html`
 * 301s, `/index` and `/home.html` 308 through Pages' canonicaliser, and `/home` is
 * the one that answers 200 with bytes. It is the file `/` itself now serves.
 */
export const HOME_PATH = '/home';

/**
 * Rewrite an agent-driven navigation target that names the homepage.
 *
 * ── WHY THIS IS NOT COSMETIC ─────────────────────────────────────────────────
 * `goto_home` maps to `/index.html` in functions/fn/do_page_action.js, and the
 * router's registered callback hard-navigates anything `excludeReason()` matches:
 *
 *     if (excludeReason(path)) { location.assign(href); return; }
 *
 * `/index.html` matches `no-container-index`. So the very first thing Paula does
 * on most tours — take the caller home — would be a full document load, and a full
 * document load destroys the WebRTC session the entire layer exists to protect.
 * The caller is hung up on, mid-sentence, and the log would read `navigate → done`.
 *
 * The exclusion is still right for a LINK to `/index.html` (it 301s, and fetching
 * a redirect chain into a swap is not something Swup should be asked to do). What
 * changed is the destination: after A51 the homepage document is `/home`, it gets a
 * container like every other content page, and it is on no exclusion list. So the
 * repair is to send the agent to the spelling that is swappable rather than to
 * widen an exclusion rule that is protecting something real.
 *
 * A caller who is ALREADY on a homepage spelling gets `currentPath` back, which
 * `go()` reads as a same-page visit: nothing to swap, and `revealGate()` still
 * runs. That is the iframe shell's behaviour too — it reloaded the frame — minus
 * the reload.
 *
 * Router-gated at the call site: with no router this function is never reached
 * and `go()` behaves exactly as it did in A2.1.
 *
 * @param {string} href the agent's target
 * @param {string} [currentPath] defaults to the live `location.pathname`
 */
export function homeTarget(href, currentPath) {
  const here = currentPath === undefined ? location.pathname : currentPath;
  let path;
  try {
    path = new URL(href, location.href).pathname;
  } catch (e) {
    return href; // unparseable — hand it on untouched and let the router decide
  }
  if (!HOME_SPELLINGS.test(path)) return href;
  return HOME_SPELLINGS.test(here) ? here : HOME_PATH;
}

function createLayerHost() {
  // A33 (#58): the router lives in js/perch/surface.js §2, reached through
  // `hasRouter()` / `navigateVia()`. It used to be `let router = null` here with
  // a `host.setRouter` published on `window.Perch.layer` — which is how a page
  // script could install its own navigation callback. The gate semantics are
  // unchanged: `hasRouter()` is the same `router !== null` A31 (#56) scoped the
  // direct booking path to, and in production, where `PERCH_ROUTER` is unset and
  // no router is injected, it is false and `drive()` behaves exactly as in A2.1.

  // Built once per layer, but every lookup inside it is live — the booking
  // widget's script is adopted mid-session by A2.2 on the first swap into a page
  // that needs it, so a reference captured here would be null for good.
  const control = createBookingControl(window, document);
  // SHELDON-PERCH-COMMAND-CHANNEL: the other half of perch-inject.js's executor —
  // scroll / scrollby / highlight against the live document. A31 scoped itself to
  // the booking family and said so; those four scroll actions are still on Paula's
  // published tool list, and on a content page they moved nothing.
  const pageControl = createPageControl(window, document);

  const host = {
    drive(cmd, target, payload) {
      // One document, no frame to post into: call the widget's published API.
      if (hasRouter() && control.handles(cmd)) {
        const outcome = control.apply(cmd, payload);
        if (outcome && outcome.handled) return outcome;
      }
      // Same gate, same reason: with no router this is untouched A2.1 behaviour.
      if (hasRouter() && pageControl.handles(cmd)) {
        const outcome = pageControl.apply(cmd, target);
        if (outcome && outcome.handled) return outcome;
      }
      // The iframe shell's channel, and every non-booking command. Unchanged.
      try {
        window.postMessage({ type: 'perch', cmd, target, payload: payload || undefined }, location.origin);
      } catch (e) { /* no-op */ }
      return undefined;
    },
    go(href) {
      // Prefer the router — a soft navigation is the entire point of the layer,
      // because a hard navigation destroys the call the layer exists to protect.
      // Falling back to location.assign is correct but lossy, and is why this PR
      // should land with or after A2.2 rather than ahead of it.
      if (hasRouter()) {
        href = homeTarget(href);
        // A2.2 skips a same-URL visit, correctly — there is nothing to swap. But
        // the iframe shell reloaded the frame on every `go`, and that reload is
        // what re-ran /book's unlock reveal. `js/perch/call.js:151` writes the
        // unlock flag immediately BEFORE this call, so a caller Paula unlocks
        // while they are already on /book is exactly the case that loses the
        // reveal. Run it directly; the gate is idempotent and no-ops off /book.
        let samePage = false;
        try {
          samePage = new URL(href, location.href).pathname === location.pathname;
        } catch (e) { /* unparseable — let the router decide */ }
        navigateVia(href);
        if (samePage) control.revealGate();
        return;
      }
      console.warn('[perch-layer] no router registered — hard navigation will end any live call:', href);
      try { location.assign(href); } catch (e) { /* blocked */ }
    },
    afterNavigate(cb) {
      document.addEventListener(EVENT_SWAPPED, cb, { once: true });
    },
    onContentReady(cb) {
      document.addEventListener(EVENT_SWAPPED, cb);
      window.addEventListener('message', (e) => {
        if (e.origin !== location.origin) return;
        if (e.data && e.data.type === 'perch:ready') cb(e.data);
      });
    },
  };

  // Read-only surface for the A31 Preview verifier and for anyone debugging a
  // booking command that did not land. `routerActive` is the gate itself, so the
  // one thing a reviewer has to check is observable rather than inferred.
  //
  // A33 adds `routerRefused`: the number of scripts that tried to install a
  // navigation callback after A2.2 had already registered. It is normally 0, and
  // a non-zero value on a live page is a hijack attempt — which would otherwise
  // leave no trace at all now that the attempt fails silently.
  // ── JORDAN-NOVOICE-FRONTDOOR: the booking executor, without the router gate ──
  //
  // `drive()` above gates `control.apply` on `hasRouter()`, and that gate protects
  // something real: with the router off, A2.1's behaviour must be byte-identical,
  // so a booking command has to keep taking the postMessage road it took then.
  //
  // The no-voice door has no such history to preserve — it did not exist in A2.1 —
  // and the postMessage road cannot serve it in any case. `perch-inject.js` is the
  // only listener for `{type:'perch'}` and it runs INSIDE the shell's iframe, while
  // `boot()` below refuses to mount this layer in a frame at all. So from here that
  // road provably goes nowhere, with or without a router. These two reach the
  // widget's published API directly, which is the only road that exists.
  //
  // Neither can submit: `control.apply` dispatches through COMMAND_MAP, which has
  // no submit verb, and `revealGate` calls `DL.revealBookingGate` — two `display`
  // values and a scroll. FORBIDDEN_METHODS is unchanged.
  host.applyBooking = (cmd, payload) => control.apply(cmd, payload);
  host.revealBooking = () => control.revealGate();

  host.bookingProbe = () => Object.assign(
    { routerActive: hasRouter(), routerRefused: routerLock().refused },
    control.probe(),
  );
  /** The same, for the scroll/highlight family. Read by `probe()`. */
  host.pageProbe = () => pageControl.probe();
  return host;
}

// ── Boot ─────────────────────────────────────────────────────────────────────
// Only in a top-level browsing context. `window.top === window.self` is false
// inside the Perch shell's iframe and inside a Vantage embed — both of which
// already carry their own orb one frame up.
function boot() {
  try {
    if (window.top !== window.self) return; // framed → the outer frame owns the orb
  } catch (e) {
    return; // cross-origin frame ancestor → treat as framed, mount nothing
  }
  try {
    mount();
  } catch (e) {
    // A layer that fails to mount must not take the page down with it. The page
    // still renders and still navigates; only the concierge is missing.
    console.error('[perch-layer] mount failed', e);
  }
}

// `typeof document` rather than a bare reference so the module can be imported
// by a Node test without executing the browser boot path.
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
}
