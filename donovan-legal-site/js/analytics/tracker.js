// ── JAY-TRACKING-A1: the browser wiring ──────────────────────────────────────
//
// Turns things that already happen on this site into analytics events. It adds
// no new signals of its own and it owns no UI, which is deliberate: the booking
// flow, the qualifier and the voice call must behave identically whether this
// module loaded, failed to load, or was blocked by an ad blocker. Every listener
// is wrapped and every sink is optional.
//
// WHY IT LISTENS INSTEAD OF BEING CALLED
//
// Three of the four conversions already announce themselves:
//
//   • `vantage:call-start`      — js/perch/call.js:129 and js/donovan-widget.js:300
//   • `__perchBooking:'confirmed'` postMessage — js/booking-widget.js
//   • `perch:content-swapped` / `dl:content-swapped` — the Swup router
//
// so those cost no edit to any existing module. Only the qualifier had no
// signal, and it got one line matching the `vantage:call-start` shape.
//
// INERT UNTIL THE CSP CHANGE LANDS
//
// `gtag` and `fbq` cannot load until the CSP allows their hosts (PR B). Until
// then every event still runs through this module and lands in `buffer`, so the
// wiring can be verified in the console BEFORE the CSP is touched. That is the
// point: PR B should be a six-host change that turns on something already known
// to work, not a change that debuts three new things at once.

import {
  PAGE_VIEW,
  BOOKING_CONFIRMED,
  QUALIFIER_SUBMITTED,
  CALL_STARTED,
  TEL_CLICK,
  buildCatalogue,
  destinationsFor,
  newEventId,
} from './events.js';
import { resolveTagConfig } from './config.js';
import { captureAttribution } from './attribution.js';
import { valueParams } from './value.js';

/** Events the router dispatches on `document` once new content is in place. */
const SWAP_EVENTS = ['perch:content-swapped', 'dl:content-swapped'];

/** The one line js/perch/qualifier.js adds. */
const QUALIFIER_EVENT = 'dl:qualifier-submitted';

/**
 * The booking's deduplication key — the browser half of a two-sided contract.
 *
 * `functions/booking/create.js` reports the same booking to Meta's Conversions
 * API from the edge. Meta merges the two into one conversion ONLY if both carry
 * the same `event_id`, and neither side can see the other's random id — so both
 * derive one from the `call_id` they already share.
 *
 * ⚠️ `functions/_lib/meta-capi.js` has the matching derivation and the two MUST
 * stay byte-identical. A divergence throws no error; it silently double-counts
 * every booking, which inflates the bids Google and Meta place with real money.
 * There is a test pinning the two together — do not delete it.
 *
 * No call_id ⇒ "" ⇒ a random id here and no server copy at all, which is the
 * server's documented choice: undercount rather than double-count.
 */
export function bookingEventId(callId) {
  const id = String(callId || '').trim();
  return id ? `dlbk_${id}` : '';
}

/** How many events to keep for QA. Enough to see a whole session, small enough
 *  that a long-lived tab cannot grow without bound. */
const BUFFER_LIMIT = 50;

/** Collapse repeat taps on a `tel:` link into one intent. */
const TEL_DEDUP_MS = 30000;

/**
 * Build a tracker. Nothing happens until `start()`.
 *
 * Every dependency is injected so the whole thing runs under jsdom in CI. A
 * tracker that could only be exercised in a real browser would be a tracker
 * nobody exercised.
 *
 * @param {object} opts
 * @param {Window} opts.win
 * @param {Document} [opts.doc]
 */
export function createTracker({ win, doc = win.document, config } = {}) {
  if (!win) throw new TypeError('createTracker needs a window');

  // This deployment's identifiers. Resolved once at construction — the meta tags
  // are in the head of the document that loaded us and cannot change under a
  // client-side navigation. Injectable so tests can drive a second tenant.
  const tagConfig = config || resolveTagConfig(win);
  const catalogue = buildCatalogue(tagConfig);

  /** Everything this tracker has emitted, newest last. Read by QA. */
  const buffer = [];

  // ── Guards ────────────────────────────────────────────────────────────────
  //
  // lastPageViewUrl: the router documents a deliberate one-time double run on
  // first arrival of a page type (see the comment above `announce()` in
  // perch-swup-router.js), and it dispatches one of TWO event names depending
  // on phase. Both would otherwise double-count. Comparing the URL collapses
  // them without caring which cause fired.
  //
  // callInFlight: `vantage:call-start` is dispatched by two modules, so a
  // document that loaded both would report two call starts for one call. Reset
  // on `vantage:call-end` so a second, genuine call in the same session counts.
  let lastPageViewUrl = null;
  let callInFlight = false;
  let lastTelClick = 0;
  let started = false;

  // Captured once at start(), then carried. Reading it per-event off
  // `location.search` was the defect: by the time someone books on /book the
  // click id that paid for the visit is no longer in the URL.
  let attribution = {};

  // What the qualifier told us about this visitor, used to value the booking.
  let qualContext = {};

  const off = [];
  const on = (target, type, fn) => {
    const safe = (ev) => { try { fn(ev); } catch (e) { /* analytics never breaks a page */ } };
    target.addEventListener(type, safe);
    off.push(() => target.removeEventListener(type, safe));
  };

  /**
   * Call a vendor tag without letting it reach the page.
   *
   * Wrapping the LISTENERS is not enough. `pageView()` is also called directly
   * from `start()` for the initial load, so a tag that throws there — an ad
   * blocker commonly leaves a stub that does — would propagate into whatever
   * imported this module. Every sink call goes through here instead, so the
   * blast radius of a hostile or broken tag is one uncounted event.
   */
  const sink = (fn, ...args) => {
    if (typeof fn !== 'function') return;
    try { fn(...args); } catch (e) { /* a broken tag is not a broken page */ }
  };

  /**
   * Send one event everywhere it goes.
   *
   * Order matters only in that the buffer is written first: if a sink throws,
   * QA can still see that the event was raised.
   */
  function emit(name, params = {}, forcedEventId) {
    const dest = destinationsFor(name, catalogue);
    // A forced id is how an event agrees with the server-side copy of itself.
    // Random otherwise — most events have no server twin to match.
    const eventId = forcedEventId || newEventId(win.crypto);
    const payload = { ...attribution, ...params, event_id: eventId };

    buffer.push({ name, eventId, params: payload, at: Date.now() });
    if (buffer.length > BUFFER_LIMIT) buffer.shift();

    // GA4 always gets the event under its own name, conversion or not.
    sink(win.gtag, 'event', dest ? dest.ga4 : name, { ...payload, send_to: tagConfig.ga4 });
    // Google Ads only gets the four conversions, addressed by label. A catalogue
    // entry with no label (a deployment that configured no action for it) has
    // `ads: null` — the GA4 event above still fires, so the signal survives.
    if (dest && dest.ads) sink(win.gtag, 'event', 'conversion', { send_to: dest.ads, transaction_id: eventId });

    if (dest) {
      // `eventID` (capital D — Meta's spelling) is what deduplicates this
      // against the server-side copy PR C will send for the same occurrence.
      sink(win.fbq, 'track', dest.meta, payload, { eventID: eventId });
    }

    return eventId;
  }

  /**
   * A navigation completed.
   *
   * GA4 is configured with `send_page_view: false` (see js/analytics.js), so
   * this is the ONLY thing that reports a page view — including the first one.
   * Meta's pixel has no client-side-routing awareness at all, so without this
   * it would record one PageView per session for the life of the tab.
   */
  function pageView(url) {
    const href = url || (win.location && win.location.href) || '';
    if (href && href === lastPageViewUrl) return null;
    lastPageViewUrl = href;

    const eventId = newEventId(win.crypto);
    const params = {
      ...attribution,
      page_location: href,
      page_title: doc && doc.title,
      event_id: eventId,
    };

    buffer.push({ name: PAGE_VIEW, eventId, params, at: Date.now() });
    if (buffer.length > BUFFER_LIMIT) buffer.shift();

    sink(win.gtag, 'event', PAGE_VIEW, { ...params, send_to: tagConfig.ga4 });
    sink(win.fbq, 'track', 'PageView', {}, { eventID: eventId });
    return eventId;
  }

  function start() {
    if (started) return api;
    started = true;

    // Capture BEFORE the first page view, so even the landing hit carries it.
    attribution = captureAttribution(win);

    // Page views: the initial load, then every router swap.
    pageView();
    for (const type of SWAP_EVENTS) {
      on(doc, type, (ev) => {
        // The router puts the destination on `detail.url`; fall back to
        // location for any dispatcher that does not.
        const url = ev && ev.detail && ev.detail.url;
        // A soft navigation can arrive carrying new parameters — a visitor who
        // clicks a tagged internal link, or lands mid-visit from an ad.
        attribution = captureAttribution(win);
        pageView(url ? new URL(url, win.location.href).href : undefined);
      });
    }

    // Phone intent. Delegated from the document rather than bound to each link,
    // because the call bar and footer are re-rendered on every soft navigation
    // and per-element listeners would be lost on the first swap — silently, and
    // only for visitors who navigated, which is the worst kind of partial data.
    //
    // `click` fires before the browser hands off to the dialler, and the event
    // is dispatched synchronously to gtag's queue, so nothing is lost to the
    // navigation. Deliberately NOT preventDefault'd or delayed: making a client
    // wait to reach a lawyer so an analytics beacon can land is the wrong trade.
    on(doc, 'click', (ev) => {
      const link = ev && ev.target && typeof ev.target.closest === 'function'
        ? ev.target.closest('a[href^="tel:"]')
        : null;
      if (!link) return;
      // Two taps on the same number are one intent; a tap after a real pause is
      // a second one. Compared against a timestamp rather than cleared by a
      // `setTimeout`, because a pending 30s timer keeps the event loop alive —
      // which stalls CI for 30 seconds per test and, in a browser, holds a
      // closure over the window after the tracker has been stopped.
      const now = Date.now();
      if (now - lastTelClick < TEL_DEDUP_MS) return;
      lastTelClick = now;
      emit(TEL_CLICK, { link_url: link.getAttribute('href') || '' });
    });

    // Voice call started.
    on(win, 'vantage:call-start', () => {
      if (callInFlight) return;
      callInFlight = true;
      emit(CALL_STARTED);
    });
    on(win, 'vantage:call-end', () => { callInFlight = false; });

    // Qualifier card submitted.
    on(win, QUALIFIER_EVENT, (ev) => {
      const d = (ev && ev.detail) || {};
      // Held for the booking, which is the conversion that carries the value.
      // The qualifier fires minutes earlier and is the only place tier is known.
      qualContext = { tier: d.tier, matter: d.matter };
      emit(QUALIFIER_SUBMITTED, d.matter ? { matter: d.matter } : {});
    });

    // Booking confirmed. The widget announces this with a same-origin
    // postMessage that js/perch/command-channel.js already consumes; we listen
    // to the same message rather than asking the widget to grow a second
    // announcement. Origin is checked for the same reason it is checked there
    // (security finding F-01): a message from anywhere else is not ours.
    on(win, 'message', (ev) => {
      if (!ev || ev.origin !== win.location.origin) return;
      const d = ev.data;
      if (!d || d.__perchBooking !== 'confirmed') return;
      // The value is what makes Google bid for the RIGHT booking rather than
      // the most bookings. Derived from what the qualifier already worked out.
      emit(BOOKING_CONFIRMED, {
        ...(d.call_id ? { call_id: d.call_id } : {}),
        ...valueParams(qualContext),
      }, bookingEventId(d.call_id));
    });

    return api;
  }

  function stop() {
    while (off.length) off.pop()();
    started = false;
  }

  const api = {
    start, stop, emit, pageView, buffer,
    get started() { return started; },
    get attribution() { return { ...attribution }; },
  };
  return api;
}
