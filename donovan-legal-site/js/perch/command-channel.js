// ── SHELDON-PERCH-COMMAND-CHANNEL: the consumer end of the PERCH_BRIDGE ──────
//
// Order SHELDON-PERCH-COMMAND-CHANNEL · priority regression from the A51 cutover.
//
// ── WHAT WENT WRONG, IN ONE SENTENCE ─────────────────────────────────────────
// A51 (#62) retired the shell from `/`, so a visitor now lands on a CONTENT page
// carrying the injected layer instead of on `perch.html` carrying the shell. The
// layer boots the router and the launcher — and nothing else. The code that reads
// Paula's queued commands out of the bridge and drives the page lived inside
// `createCall()` in js/perch/call.js, and `createCall()` is only ever built by
// `mountShellConcierge()`, which js/perch-layer.js deliberately never calls. So on
// a content page `do_page_action` returned `{status:"done"}` — truthfully, the
// command WAS queued in the Durable Object — and then nobody ever polled for it.
//
// A live manual call proved it: goto commands acknowledged, zero swaps, zero
// navigations; `open_qualifier` acknowledged, no modal; `window.__perch` null
// (nothing had mounted the qualifier, which is what locks that probe on).
//
// ── WHY THIS IS AN EXTRACTION AND NOT A SECOND IMPLEMENTATION ────────────────
// The obvious repair is to write a poll loop into the layer. That would be the
// third copy of this wire contract in the tree (the shell's, perch-inject.js's,
// and the new one), and the first place the two live hosts would drift — the
// booking payload shapes here are the contract Paula's tool configs are written
// against, so a divergence is a caller sitting in front of a calendar that does
// not fill in.
//
// So the loop moved OUT of js/perch/call.js, unchanged, into this module. The
// shell reaches it through `createCall()` exactly as before — `/perch` is the
// rollback target and its behaviour must not move — and the layer reaches it
// directly, because on a content page the live Retell session belongs to
// js/donovan-widget.js's launcher and NOT to `createCall()`. One implementation,
// two owners of the call.
//
// ── WHAT DELIBERATELY DID NOT CHANGE ─────────────────────────────────────────
// Every wire shape: the `x-perch-call-id` header credential (B2-c), the prefill
// re-delivery loop and its 6-try cap, the `/book` unlock write, the
// `open_qualifier` payload destructuring, and the fall-through that hands
// anything unrecognised to `host.drive(cmd, target)`. This module is the same
// code in a different file, plus a `probe()` that lets a verifier see the loop
// running without a live call.
//
// (The 1.2 s interval was on that list until ADAM-PAGEPOLL-THROTTLE-R1 moved the
// waiting to the server. What a command looks like, and how fast it arrives, are
// both unchanged; how many requests it takes to receive one is not. See the note
// above POLL_MS.)

/**
 * @typedef {Object} PerchHost
 * @property {(cmd: string, target?: string|null, payload?: any) => void} drive
 * @property {(href: string) => void} go
 * @property {(cb: Function) => void} afterNavigate
 * @property {(cb: Function) => void} onContentReady
 */

// ── ADAM-PAGEPOLL-THROTTLE-R1: the loop stopped asking 50 times a minute ─────
//
// This module used to run `setInterval(…, 1200)` for the length of the call:
// ~180 requests to /fn/page-poll on a three-minute call, ~179 of them answered
// `{}`. That is real Worker cost and it is also the noise that makes the tail
// unreadable when a live call has to be diagnosed from it.
//
// The cadence is NOT what changed — see the note in functions/fn/page-poll.js.
// Polling slower is the obvious move and it is the wrong one: on a voice call the
// interval IS the latency between Paula saying "let me pull that up" and the
// calendar appearing, so a 10× longer interval buys the invocation cut with a
// 12-second stare. Instead the Function now HOLDS the connection open and answers
// the moment the bridge has something. This loop asks for that hold, and waits.
//
// Three properties this arrangement has to keep, all of them load-bearing:
//   • ONE REQUEST IN FLIGHT. `setInterval` fires on a clock; a 25 s answer would
//     have stacked 20 of them per caller. The loop is self-clocking instead — the
//     next poll is scheduled from the end of the last one.
//   • DEGRADES TO TODAY. A deployment whose Function does not hold answers
//     immediately and without the `x-perch-held` header, and the loop falls back
//     to the POLL_MS interval it has always run. Nothing about that path is new.
//   • IT ENDS. See `stop()` and the ceilings below.

/**
 * The fallback interval, in ms — the gap between polls when the server did NOT
 * hold the connection. This is the pre-throttle cadence, kept verbatim so an
 * un-held deployment behaves exactly as it did before this ticket.
 */
export const POLL_MS = 1200;

/**
 * How long we ask /fn/page-poll to hold the connection open, in ms.
 *
 * The Function clamps this to its own MAX_HOLD_MS. At 25 s a three-minute call
 * costs ~8 invocations where it used to cost ~180.
 */
export const HOLD_MS = 25000;

/**
 * Gap after an answer the server HELD. Near zero on purpose: the waiting already
 * happened server-side, so re-opening at once is what keeps the channel live —
 * but not literally zero, because a Function that starts answering instantly
 * while still claiming to hold must not become a hot loop.
 */
export const HELD_GAP_MS = 150;

/** First back-off after a failed poll, doubling to FAIL_MAX_MS. */
export const FAIL_BASE_MS = 1200;
export const FAIL_MAX_MS = 15000;

/**
 * Consecutive failures before the loop gives up.
 *
 * With the doubling back-off that is ~2 minutes of an unreachable bridge. A call
 * whose page-poll has been unreachable that long is over — the browser is offline
 * or the session is gone — and a loop that keeps trying forever is exactly the
 * "polls indefinitely after completion" this ticket is closing.
 */
export const MAX_FAILS = 12;

/**
 * Absolute ceiling on one bound channel, in ms.
 *
 * `stop()` is the normal end: js/donovan-widget.js calls `releaseCall()` from the
 * Retell SDK's `call_ended` and `error`. This is what happens when that event
 * never arrives — a backgrounded tab whose WebRTC session died quietly, an SDK
 * that dropped the handler — because without it the answer to "how long can this
 * poll?" is "until the tab closes". No real consultation runs 45 minutes on a
 * bridge that has stayed silent, and the caller loses nothing when it fires: the
 * call itself is untouched and the launcher can bind a new one.
 */
export const MAX_SESSION_MS = 45 * 60 * 1000;

/** Prefill re-delivery cadence and cap, unchanged from the shell. */
export const PREFILL_MS = 700;
export const PREFILL_TRIES = 6;

// ── JORDAN-PERCH-NATIVE-BOOK: one road onto the calendar, two drivers ────────
//
// The qualifier's done state promises "she'll pull up the calendar" and, until
// this ticket, only Paula could — she had to issue `goto_booking` herself, and on
// a live call she often did not, so the caller sat on the done card and stalled.
//
// `advanceToBooking()` below gives the completed card its own way in. It is NOT a
// second implementation of that road: it builds the exact `{cmd:'batch', actions:
// [navigate, booking_prefill]}` shape `functions/fn/do_page_action.js` coalesces
// Paula's pair into, and hands it to the SAME `dispatch()`. No new command
// vocabulary, no new unlock write, no new prefill loop — the navigate branch does
// the localStorage unlock and the soft `host.go`, and `deliverPrefill` does the
// re-delivery, exactly as they do for Paula.
//
// Which means the two drivers can now arrive within milliseconds of each other:
// the caller taps the last answer while Paula, reading `get_qualifier_result`,
// says "let me pull that up" and fires `goto_booking` + `booking_prefill`. Two
// navigates to /book would be two swaps and two reveals; two prefills would be
// the second one REPLACING the first, dropping whichever fields the other had.
// The two constants below are how those converge to one of each.

/**
 * The booking page, spelled as Paula's own tool spells it.
 *
 * `ACTION_MAP.goto_booking` and `book_consult` in functions/fn/do_page_action.js
 * both queue `{cmd:'navigate', target:'/book.html'}`. Using a DIFFERENT spelling
 * here — `/book`, say — would still satisfy the `toBook` test below and still
 * reach the same document, and it would also make the auto-advance and Paula
 * navigate to two different URLs, which the router would treat as two real
 * navigations. They are held to the same string by
 * test/perch-native-book.test.mjs, which reads the Function's exported ACTION_MAP.
 */
export const BOOK_PATH = '/book.html';

/**
 * How long an executed `/book` navigate suppresses another one, in ms.
 *
 * A window rather than a permanent latch, and the size is the collision it is
 * built for: Paula's half of the race arrives on the next bridge read (1.2 s,
 * whether the browser makes it or the held Function does — see HOLD_TICK_MS in
 * functions/fn/page-poll.js) or the one after, and the prefill re-delivery loop
 * it pairs with runs for
 * PREFILL_MS × PREFILL_TRIES ≈ 4.2 s. Ten seconds covers that with slack and
 * still leaves a caller who wanders off /book and is sent back later with an
 * ordinary, un-suppressed navigation — a latch with no expiry would answer that
 * caller with nothing at all.
 */
export const BOOK_COALESCE_MS = 10000;

/**
 * Is this navigate target the booking page?
 *
 * The same `indexOf('/book') === 0` test that has gated the unlock write since the
 * shell, extracted so the auto-advance and the coalescer cannot disagree with the
 * navigate branch about what counts as booking.
 */
export function isBookTarget(target) {
  return typeof target === 'string' && target.indexOf('/book') === 0;
}

/**
 * Merge a prefill onto the one already pending.
 *
 * Non-empty incoming fields win; absent or empty ones keep what is pending. That
 * ordering is what makes "one prefill batch" true whichever driver arrives second:
 * `{notes}` from a completed qualifier landing on Paula's `{name, email, phone}`
 * keeps all four, and Paula's `{name, email, phone}` landing on the qualifier's
 * `{notes}` does too. Replacement — which is what a bare assignment did — dropped
 * whatever the other driver had contributed.
 *
 * Nothing is lost by ignoring empty values: `sanitizeBookingArgs` refuses a
 * prefill whose every field is empty, and the widget only applies non-empty ones
 * (js/booking-widget.js:1640-1643), so clearing a field was never reachable
 * through this path.
 */
export function mergePrefill(pending, next) {
  if (!next || typeof next !== 'object') return pending || null;
  if (!pending || typeof pending !== 'object') return next;
  const out = Object.assign({}, pending);
  for (const k of Object.keys(next)) {
    const v = next[k];
    if (v === undefined || v === null || String(v) === '') continue;
    out[k] = v;
  }
  return out;
}

// ── SHELDON-PERCH-TIER-KEY-HANDOFF: the consumer half of the tier refusal ────
//
// `functions/fn/do_page_action.js` no longer queues a navigate for `/gold/` …
// `/reserve/` — they are behind HTTP Basic auth, so they are on swap-policy's
// `tier-basic-auth` exclusion list, so `host.go()` can only serve them with a
// `location.assign()` that ends the live call (ADAM key audit H2, #96).
//
// This is the same rule on the other side of the bridge, and it is here rather
// than only in the Function for one reason: the two halves deploy as one Pages
// build, but a browser holds a page for as long as the call lasts. A command
// written by the previous deployment, or replayed from the bridge, arrives at
// whatever client is loaded. The producer decides what to queue; the consumer
// decides what it is willing to execute, and it is the consumer that owns
// `host.go`.
//
// Both spellings of this regex — here and in the Function — are held to
// swap-policy's REAL `excludeReason()` by test/perch-tier-key-handoff.test.mjs.
export const TIER_PATH_RE = /^\/(gold|platinum|diamond|reserve)(\/|$)/i;

/**
 * Is this navigate target a members-only tier page?
 *
 * Resolved as a path, not matched against the raw string: `https://host/gold/`
 * and `/gold/` are the same locked door, and a bare `#anchor` is neither.
 * Unparseable input is treated as NOT a tier — it is handed on to `host.go`,
 * which is exactly today's behaviour for a malformed target.
 */
export function isTierPath(target, base) {
  const href = String(target == null ? '' : target);
  if (!href) return false;
  let path = href;
  try {
    path = new URL(href, base || 'https://www.donovan.law/').pathname;
  } catch (e) { /* keep the raw string; the regex is anchored either way */ }
  return TIER_PATH_RE.test(path);
}

/**
 * Build the command consumer.
 *
 * @param {PerchHost} host          the surface to drive (iframe adapter or layer adapter)
 * @param {{say?: Function, openQualifier?: Function}} ui
 * @param {Window} [win]            the window that owns the message bus; injectable for CI
 * @returns {{start: (callId: string) => void, stop: Function, callId: () => string|null,
 *            deliverPrefill: Function, probe: () => object}}
 */
export function createCommandChannel(host, ui, win) {
  const w = win || (typeof window !== 'undefined' ? window : null);
  const say = (ui && ui.say) || function () {};

  let curCall = null;
  let polls = 0;
  let commands = 0;
  const log = [];

  // ── Poll-loop state (ADAM-PAGEPOLL-THROTTLE-R1) ────────────────────────────
  // `pollGen` is the off switch: every `start()` and every `stop()` bumps it, and
  // the loop checks it after each await. An in-flight fetch and a pending gap
  // therefore cannot outlive the call they belong to, which is what `clearInterval`
  // used to buy — a generation counter buys it for an async loop as well, where a
  // handle alone would not (the awaited fetch has no handle to clear).
  let pollGen = 0;
  let polling = false;
  let pollStartedAt = 0;
  let fails = 0;
  let stopped = null;
  let gapTimer = null;
  let gapWake = null;
  let inFlight = null;

  // Timers come from the window the channel was handed, so a channel driving a
  // different document is cancelled when that document goes. Taken as a PAIR —
  // a jsdom handle cannot be cleared by the ambient global's clearTimeout, and
  // swapping only half leaves `stop()` unable to cancel the gap it scheduled.
  const setT = (w && typeof w.setTimeout === 'function') ? w.setTimeout.bind(w) : setTimeout;
  const clearT = (w && typeof w.clearTimeout === 'function') ? w.clearTimeout.bind(w) : clearTimeout;
  const nowMs = () => Date.now();

  function record(entry) {
    log.push(entry);
    if (log.length > 20) log.shift();
    return entry;
  }

  // ── Prefill delivery ───────────────────────────────────────────────────────
  // Paula typically fires booking_prefill the instant she opens the calendar —
  // while /book is still loading and the widget's message listener isn't up yet.
  // A single postMessage would be lost in that window, so the payload is
  // RE-DELIVERED on a short interval: the widget stores it the first time it is
  // alive to receive it, then applies it when the form step renders. Redelivery
  // is idempotent (the widget never overwrites a field the caller has typed).
  let prefillPayload = null;
  let prefillTimer = null;

  // JORDAN-PERCH-NATIVE-BOOK: when a `/book` navigate was last EXECUTED, and
  // whether the completed qualifier has already asked for one. `bookNavs` is the
  // number that has to stay at 1 across a qualifier auto-advance racing a Paula
  // `goto_booking`, and it is on `probe()` so the Preview verifier can read it.
  let bookNavAt = 0;
  let bookNavs = 0;
  let advanced = false;

  function deliverPrefill(payload) {
    // MERGED, not replaced — see mergePrefill above. Two drivers can each hold a
    // different half of the form.
    if (payload) prefillPayload = mergePrefill(prefillPayload, payload);
    if (!prefillPayload) return;
    let tries = 0;
    clearInterval(prefillTimer);
    const send = () => { try { host.drive('booking_prefill', null, prefillPayload); } catch (e) { /* host gone */ } };
    send(); // immediate attempt
    prefillTimer = setInterval(() => {
      tries++;
      if (!prefillPayload || tries >= PREFILL_TRIES) { clearInterval(prefillTimer); return; }
      send();
    }, PREFILL_MS);
  }

  if (w) {
    w.addEventListener('message', (e) => {
      if (e.origin !== w.location.origin) return;
      const d = e.data;
      // Widget acks prefill receipt → stop re-delivering immediately so the message
      // stream doesn't run into the caller's date/time clicks.
      if (d && d.__perchBookingAck && d.action === 'prefill') {
        prefillPayload = null;
        clearInterval(prefillTimer);
      }
      if (d && d.__perchBooking === 'confirmed') {
        // Booking submitted in the widget → tell the bridge so Paula
        // (get_booking_result) can give a warm goodbye and hang up.
        say("You're all set — a confirmation email is on its way; keep an eye on your inbox.", 5000);
        // ── WHERE THE CALL ID USED TO GO (SHELDON-CALLMAP-AND-CALLID task 4) ──
        //
        // `curCall` was the only source, and it is set by `start()` alone — which
        // only `perch-layer.js:bindCall()` calls, and only for a LIVE voice call.
        // So a confirmation that reached this listener any other way sent
        // `call_id: undefined`, and `fn/booking_confirmed` refused it with
        // MISSING_CALL_ID: the booked flag was never written, and Paula's
        // `get_booking_result` saw nothing for a booking that had just completed.
        //
        // The message now carries the id the widget put on the booking itself
        // (`js/booking-widget.js`, `payload.call_id` ← `window.__perchCallId`),
        // which is present on the no-voice path — `perch-layer.js` hands it over
        // via `set_call_id` and starts no channel — and on any document that
        // received the id but did not host the call.
        //
        // ORDER: `curCall` FIRST. On a live call this channel's id is the Retell
        // session, it is the credential the poll authenticates with, and it is the
        // one the bridge is keyed on; the widget's global is re-handed FROM it by
        // `onContentReady` above, so the two agree, and where they could not, the
        // live call wins. The message is a FALLBACK for the case that had nothing,
        // never an override for the case that had the right thing.
        //
        // Trimmed and type-checked before use: this arrives on a postMessage, the
        // same-origin guard above is what makes it ours, and a non-string is a
        // malformed message, not an id. It is never logged — see `probe()`.
        const fromMsg = typeof d.call_id === 'string' ? d.call_id.trim() : '';
        const confirmCallId = curCall || fromMsg;
        try {
          w.fetch('/fn/booking_confirmed', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ call_id: confirmCallId || undefined, slotISO: d.slotISO || undefined }),
          }).catch(() => {});
        } catch (err) { /* fire and forget */ }
      }
    });
  }

  // Every content load re-announces itself. Re-hand the live call id to the
  // booking widget so it survives navigation to /book and rides along on
  // /booking/create.
  host.onContentReady(() => { if (curCall) host.drive('set_call_id', null, { call_id: curCall }); });

  /**
   * Execute one command from the bridge.
   *
   * Split out of the interval body so CI can drive the real dispatch table with a
   * fabricated action and assert what the host was asked to do — the alternative
   * is asserting on the spelling of this file, which proves nothing about
   * behaviour ([[feedback_assert_behavior_not_source_spelling]]).
   */
  function dispatch(d, depth) {
    if (!d || !d.cmd) return null;
    commands++;

    // ── SHELDON-COMMAND-CHANNEL-QUALIFIER-BOOKING: more than one command per poll ─
    //
    // The bridge Durable Object holds ONE pending action per call and it is
    // drained once per 1.2 s, so two commands issued in the same turn used to
    // destroy each other — `goto_booking` + `booking_prefill` (the booking step)
    // and `goto_*` + `open_qualifier` (how Paula opens a topic) are exactly that
    // pair, and they are the two flows that failed on the live call.
    // functions/fn/do_page_action.js now coalesces them into one `batch` rather
    // than clobbering; this is the other half.
    //
    // Executed IN ORDER through this same dispatch, because order is load-bearing:
    // the navigate has to write the `/book` unlock and start the swap before the
    // prefill's re-delivery loop begins, which is the order Paula issues them in.
    // One bad member must not swallow the rest — the poll is the only channel the
    // caller has left at this point.
    //
    // `depth` refuses a nested batch. do_page_action never builds one (it flattens
    // on coalesce), and a bridge that somehow served a self-referencing batch must
    // not be able to spin this loop inside the poll tick.
    if (d.cmd === 'batch') {
      const items = Array.isArray(d.actions) ? d.actions : [];
      if (depth) return record({ cmd: 'batch', n: items.length, reason: 'nested_batch_refused' });
      const ran = [];
      for (const item of items) {
        try { dispatch(item, 1); ran.push(item && item.cmd); } catch (e) { ran.push('threw'); }
      }
      return record({ cmd: 'batch', n: items.length, ran });
    }

    if (d.cmd === 'navigate') {
      // A members-only tier page is a hard document load or nothing, and a hard
      // document load is the end of the call. Refuse it here, before the unlock
      // flag and before `host.go`, and say so in the record — a caller who asked
      // about Gold gets Paula's spoken answer, not a dead line.
      if (isTierPath(d.target, w && w.location && w.location.href)) {
        return record({ cmd: 'navigate', target: d.target, refused: 'tier_basic_auth', via: 'none' });
      }
      // Agent-driven booking nav = the pre-qual gate passed → unlock the
      // calendar for this session.
      const toBook = isBookTarget(d.target);
      // JORDAN-PERCH-NATIVE-BOOK: the coalescer. A `/book` navigate that lands
      // inside BOOK_COALESCE_MS of one this channel has already executed is the
      // OTHER driver arriving — the qualifier's auto-advance and Paula's
      // `goto_booking` both want the caller on the calendar, and they want it
      // once. Refused here, before the unlock write and before `host.go`, so the
      // second one costs no swap and no reveal; anything paired with it in the
      // same batch (the prefill, invariably) still runs. Recorded, never silent:
      // a coalesced navigate that should have been a real one has to be visible
      // in `probe().log`.
      if (toBook && bookNavAt && (Date.now() - bookNavAt) < BOOK_COALESCE_MS) {
        return record({ cmd: 'navigate', target: d.target, via: 'none', coalesced: 'book_nav_already_run' });
      }
      if (toBook) {
        try { w && w.localStorage.setItem('donovan_booking_unlock', String(Date.now())); } catch (e) { /* private mode */ }
        bookNavAt = Date.now();
        bookNavs++;
      }
      host.go(d.target);
      // After navigating to /book, re-deliver any prefill Paula already sent
      // (covers the common order: navigate → prefill, both fired near-instantly).
      if (toBook) host.afterNavigate(() => { if (prefillPayload) deliverPrefill(prefillPayload); });
      return record({ cmd: 'navigate', target: d.target, via: 'host.go' });
    }
    if (d.cmd === 'booking_prefill') {
      deliverPrefill(d.payload);
      return record({ cmd: d.cmd, via: 'deliverPrefill' });
    }
    if (d.cmd === 'booking_select_slot' || d.cmd === 'booking_select_type' || d.cmd === 'booking_show_date') {
      // Forward {day}/{typeId}/slot verbatim; the generic fall-through drops payloads.
      host.drive(d.cmd, null, d.payload);
      return record({ cmd: d.cmd, via: 'host.drive' });
    }
    if (d.cmd === 'open_qualifier') {
      // Layer/shell-level modal — the matter is tapped in-card, so carry lang +
      // source and do NOT forward this to the content surface.
      if (ui && ui.openQualifier) {
        ui.openQualifier((d.payload && d.payload.lang) || d.lang, (d.payload && d.payload.source) || d.source);
        return record({ cmd: d.cmd, via: 'openQualifier' });
      }
      return record({ cmd: d.cmd, via: 'openQualifier', reason: 'no_qualifier_mounted' });
    }
    host.drive(d.cmd, d.target);
    return record({ cmd: d.cmd, target: d.target || null, via: 'host.drive' });
  }

  /**
   * JORDAN-PERCH-NATIVE-BOOK: the completed qualifier's way onto the calendar.
   *
   * Called by the host from `mountQualifier`'s `onQualified` (js/perch-layer.js).
   * Everything it does, Paula's own coalesced pair already does — this only
   * decides WHEN, and refuses to do it twice.
   *
   * Idempotent per channel: the card can only be completed once per call, but the
   * `?qualifier=` affordance and a re-opened card can both re-enter `submitQual`,
   * and a second navigate is a second swap the caller did not ask for.
   *
   * Paula stays canonical for the CONTENT: a field she has already queued is left
   * exactly as she queued it, and only fields she has not are contributed. The
   * navigate itself then passes through the same coalescer her `goto_booking` does,
   * so whichever of the two arrives second costs no second navigation.
   *
   * @param {{name?: string, email?: string, phone?: string, notes?: string}|null} prefill
   *   as built by `bookingPrefillFrom` in js/perch/qualifier.js
   */
  function advanceToBooking(prefill) {
    if (advanced) return record({ cmd: 'auto_advance', via: 'none', coalesced: 'already_advanced' });
    advanced = true;

    const add = {};
    for (const k of Object.keys(prefill || {})) {
      const v = prefill[k];
      if (v === undefined || v === null || String(v) === '') continue;
      if (prefillPayload && prefillPayload[k]) continue; // Paula already has this field
      add[k] = v;
    }

    const actions = [{ cmd: 'navigate', target: BOOK_PATH }];
    if (Object.keys(add).length) actions.push({ cmd: 'booking_prefill', payload: add });
    // Through `dispatch`, as a batch, because that is the shape the bridge's own
    // coalescer produces and the only shape both hosts already execute in order.
    return dispatch({ cmd: 'batch', actions });
  }

  // ── Page control ───────────────────────────────────────────────────────────
  // Poll a Pages Function for actions queued by Paula. (Local UAT used SSE;
  // serverless Pages uses KV-polling.)

  /** Sleep `ms`, or until `stop()` wakes us — whichever is first. */
  function gap(ms) {
    return new Promise((resolve) => {
      gapWake = resolve;
      gapTimer = setT(() => { gapTimer = null; gapWake = null; resolve(); }, ms);
    });
  }

  /** Read a response header without assuming the response HAS headers. */
  function headerOf(r, name) {
    try { return (r && r.headers && typeof r.headers.get === 'function') ? r.headers.get(name) : null; }
    catch (e) { return null; }
  }

  /** End the loop for a reason that is not `stop()`, and say which. */
  function halt(reason) {
    stopped = reason;
    record({ cmd: 'poll', halted: reason, polls });
    stop();
  }

  /**
   * One poll. Returns the gap to wait before the next one, or a halt reason.
   *
   * The `gen` check after every await is what makes `stop()` immediate: a call
   * that ended while this request was open must not dispatch a command into a
   * page whose session is gone.
   */
  async function pollOnce(gen, callId) {
    polls++;
    let ctrl = null;
    try { ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null; } catch (e) { ctrl = null; }
    inFlight = ctrl;
    try {
      // B2-c: the call id is this poll's only credential — send it as a header so
      // it stays out of edge access logs and the Referer chain, never as ?call_id=.
      // `x-perch-wait` asks the Function to hold this connection open rather than
      // answer `{}` immediately; a deployment that does not know the header simply
      // answers at once and the loop falls back to POLL_MS.
      const init = { headers: { 'x-perch-call-id': callId, 'x-perch-wait': String(HOLD_MS) } };
      if (ctrl) init.signal = ctrl.signal;
      const r = await (w ? w.fetch : fetch)('/fn/page-poll', init);
      if (gen !== pollGen) return { gap: POLL_MS };
      if (!r || !r.ok) {
        // 400 is the Function refusing this poll's credential, and it refuses the
        // same way every time — there is no retry that turns it into a 200, so a
        // loop that kept trying would be pure invocation cost forever.
        if (r && r.status === 400) return { halt: 'rejected' };
        return failGap();
      }
      fails = 0;
      const held = headerOf(r, 'x-perch-held') === '1';
      const d = await r.json();
      if (gen !== pollGen) return { gap: POLL_MS };
      if (d && d.cmd) {
        console.log('[perch] page-control →', d);
        dispatch(d);
      }
      return { gap: held ? HELD_GAP_MS : POLL_MS };
    } catch (e) {
      // A dropped poll is not an error worth surfacing to the caller — but a
      // hundred of them in a row is not a dropped poll, it is a dead channel.
      if (gen !== pollGen) return { gap: POLL_MS };
      return failGap();
    } finally {
      if (inFlight === ctrl) inFlight = null;
    }
  }

  function failGap() {
    fails++;
    if (fails >= MAX_FAILS) return { halt: 'unreachable' };
    return { gap: Math.min(FAIL_MAX_MS, FAIL_BASE_MS * Math.pow(2, fails - 1)) };
  }

  async function loop(gen, callId) {
    // The leading gap is POLL_MS, which is exactly when the old `setInterval`
    // fired its first poll. Held or not, the first command's latency is unchanged.
    let ms = POLL_MS;
    while (gen === pollGen) {
      await gap(ms);
      if (gen !== pollGen) return;
      if (nowMs() - pollStartedAt >= MAX_SESSION_MS) return halt('max_session');
      const r = await pollOnce(gen, callId);
      if (gen !== pollGen) return;
      if (r.halt) return halt(r.halt);
      ms = r.gap;
    }
  }

  function start(boundId) {
    const callId = String(boundId === undefined || boundId === null ? '' : boundId).trim();
    stop();
    curCall = callId || null;
    // Nothing to poll FOR. The Function answers a blank credential with 400 and
    // would keep answering it; not starting is cheaper than halting later.
    if (!callId) { stopped = 'no_call_id'; record({ cmd: 'poll', halted: 'no_call_id' }); return; }

    // Hand the call id to the booking widget for the CURRENT page — covers the
    // case where the caller is already on /book when the call connects.
    // Navigations are re-covered by the onContentReady handler above.
    try { host.drive('set_call_id', null, { call_id: callId }); } catch (e) { /* host gone */ }

    stopped = null;
    fails = 0;
    pollStartedAt = nowMs();
    polling = true;
    const gen = ++pollGen;
    loop(gen, callId);
  }

  function stop() {
    pollGen++;
    polling = false;
    // Cancel the pending gap AND wake the loop so it can see the generation
    // change and return, rather than sitting suspended on a promise nobody will
    // ever resolve.
    if (gapTimer) { clearT(gapTimer); gapTimer = null; }
    if (gapWake) { const wake = gapWake; gapWake = null; try { wake(); } catch (e) { /* nothing waiting */ } }
    // Abort the open poll. Locally it stops a stale response from dispatching;
    // on the wire it is what collapses a HELD request server-side, so a call that
    // just ended stops costing bridge reads for the rest of its 25 s window.
    const ctrl = inFlight; inFlight = null;
    if (ctrl) { try { ctrl.abort(); } catch (e) { /* already settled */ } }
  }

  /**
   * Read-only state. Drives nothing.
   *
   * `callId` reports `'set'` / null rather than the value: the call id is the
   * bearer credential for the whole bridge (see functions/fn/page-poll.js B2-c),
   * and a diagnostic that prints it hands it to anything that can read a probe.
   * Same posture as `window.__perch.probe()` in js/perch/qualifier.js.
   */
  function probe() {
    return {
      polling,
      callId: curCall ? 'set' : null,
      polls,
      commands,
      // ADAM-PAGEPOLL-THROTTLE-R1. `polls` is the invocation count this ticket is
      // measured on — one per /fn/page-poll request, held or not. `stopped` names
      // WHY a loop that is no longer polling ended, so a channel that gave up is
      // distinguishable from one that was never started and from one `stop()`
      // ended normally (null after a clean stop).
      stopped,
      fails,
      prefillPending: prefillPayload !== null,
      // JORDAN-PERCH-NATIVE-BOOK. `bookNavs` is the acceptance number: a qualifier
      // auto-advance racing a Paula `goto_booking` must leave it at 1. The pending
      // prefill is reported by KEY NAME only — it holds the caller's name, email
      // and phone, and a diagnostic that prints those hands them to anything that
      // can read a probe. Same posture as `callId` above.
      prefillFields: prefillPayload ? Object.keys(prefillPayload).filter((k) => prefillPayload[k]) : [],
      bookNavs,
      autoAdvanced: advanced,
      log: log.slice(-10),
    };
  }

  return { start, stop, dispatch, deliverPrefill, advanceToBooking, callId: () => curCall, probe };
}
