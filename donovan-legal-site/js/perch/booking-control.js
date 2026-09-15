// ── SHELDON-PERCH-A31: the direct-DOM booking control adapter ────────────────
//
// Ticket #56 · Phase A / Phase 3 · Order SHELDON-PERCH-A31-BOOKING-DOM.
// Depends on A0.2 (#65) `DL.ready`, A0.3 (#63) the inventory, A2.1 (#74) the
// persistent layer and A2.2 (#75) the Swup router.
//
// ── THE PROBLEM ──────────────────────────────────────────────────────────────
// Every booking command Paula issues reaches the widget the same way today:
//
//   /fn/do_page_action ─▶ Durable Object ─▶ /fn/page-poll
//     ─▶ js/perch/call.js  host.drive(cmd, null, payload)
//     ─▶ perch.html's iframe adapter: site.contentWindow.postMessage({type:'perch'})
//     ─▶ perch-inject.js (inside the iframe)  window.postMessage({type:'dl-booking'})
//     ─▶ js/booking-widget.js's bridge ─▶ window.DLBooking.<method>()
//
// Hops 2 and 3 exist only because the content lives in an `<iframe>`. Under the
// A2.2 router the site is ONE document: there is no `site.contentWindow` to post
// into, and `perch-inject.js` is never loaded, so `js/perch-layer.js`'s host
// posts `{type:'perch'}` at its own window where nothing is listening. That is
// not a hypothetical — it is written down as the known gap at the top of
// `createLayerHost()`: "Wiring that executor into the top-level document is
// Phase 3; until then these messages are simply unobserved."
//
// This module is that executor, and it takes the shorter road on purpose. There
// is no frame boundary left to cross, so re-creating `perch-inject.js` in the top
// document would mean posting a message to ourselves in order to call a function
// we can already reach. Instead every command is mapped onto the widget's
// PUBLISHED API — `window.DLBooking.*`, the formal seam the widget's own header
// calls "the formal seam" — with the same payload shapes, in the same order.
//
// ── WHAT THIS DELIBERATELY DOES NOT DO ───────────────────────────────────────
//   • It does not remove, replace or weaken the postMessage path. The iframe
//     shell (`perch.html` + `js/page/perch-shell.js` + `perch-inject.js`) is the
//     live production booking path until A5 retires it, and it is untouched by
//     this ticket — including `js/booking-widget.js`'s `{type:'dl-booking'}`
//     bridge listener, which this module does not go near. The adapter engages
//     only when a router has registered itself with the layer (see
//     `js/perch-layer.js`); with no router the host's behaviour is byte-identical
//     to what shipped in A2.1.
//   • It does not touch the booking WRITE path. `functions/booking/create.js` is
//     unchanged, and nothing here submits: see the trust boundary below.
//   • It does not touch tier auth, the CSP, or the script-adoption allow-list.
//   • It does not sanitise. `functions/fn/do_page_action.js:24` already bounds and
//     strips every field server-side before the command is queued, and the widget
//     validates day/time/typeId against real availability. A second, differently
//     written sanitiser in the browser would be a second contract to keep in sync
//     and the first place the two would drift.
//
// ── THE TRUST BOUNDARY, RESTATED WHERE THE NEW PATH CROSSES IT ───────────────
// Paula prefills fields and selects a type, a date and a slot. The CALLER always
// presses "Confirm Appointment". `DLBooking` exposes no submit, this module calls
// only prefill / selectType / selectSlot / showDate, and `showDate` is explicitly
// the browse verb — `_applyShowDate` pins `state.step = 'DATE_PICK'` and never
// advances to FORM. Nothing here auto-submits, and `SUBMIT_METHODS` below is the
// executable form of that sentence rather than a comment asking to be believed.

/**
 * Every command this adapter answers for, mapped to the `window.DLBooking`
 * method the postMessage path would have reached.
 *
 * The left column is the `cmd` as it leaves `functions/fn/do_page_action.js`; the
 * right column is `perch-inject.js`'s `action` and the API behind it. Keeping the
 * table explicit — rather than deriving the method name from the command — is
 * what makes "identical semantics to the postMessage path" checkable by reading
 * two files side by side.
 */
export const COMMAND_MAP = Object.freeze({
  booking_prefill:     'prefill',
  booking_select_type: 'selectType',
  booking_select_slot: 'selectSlot',
  booking_show_date:   'showDate',
  // Not a Paula command: the shell hands the live call id down so the widget can
  // attach it to /booking/create. It rides the same `drive()` seam and dies the
  // same way without an iframe, so it belongs here. It has no DLBooking method —
  // the postMessage bridge sets a window global directly, and so does this.
  set_call_id:         null,
});

/** The commands above, as a list. Ordering matches RE-INIT-INVENTORY §2.3. */
export const BOOKING_COMMANDS = Object.freeze(Object.keys(COMMAND_MAP));

/**
 * Methods this adapter may never call, asserted in CI.
 *
 * `DLBooking` has no submit today. This list exists so that the day someone adds
 * one, the test that reads it fails before the adapter can grow a call to it.
 */
export const FORBIDDEN_METHODS = Object.freeze(['submit', 'confirm', 'book', 'create']);

/**
 * Build the adapter.
 *
 * Takes `win`/`doc` rather than reaching for the globals so CI can drive the real
 * functions against a jsdom window without a browser and without the Retell SDK.
 *
 * @param {Window} win the live window (owns `DLBooking`, `__perchCallId`, `DL`)
 * @param {Document} [doc] the live document; defaults to `win.document`
 */
export function createBookingControl(win, doc) {
  const document_ = doc || (win && win.document) || null;

  /** Rolling telemetry, read by the Preview verifier and by anyone debugging. */
  const log = [];
  function record(entry) {
    log.push(entry);
    if (log.length > 50) log.shift();
    return entry;
  }

  /** Is this a command the adapter owns? Anything else falls through untouched. */
  function handles(cmd) {
    return Object.prototype.hasOwnProperty.call(COMMAND_MAP, cmd);
  }

  /**
   * The widget's public control surface, or null when the page has not loaded
   * `js/booking-widget.js`.
   *
   * Looked up on EVERY call rather than captured once: under the router the
   * widget's script is adopted mid-session, the first time a swap lands on a page
   * that needs it (`js/perch/swap-policy.js`), so a reference cached at layer
   * mount would be null for the whole session.
   */
  function api() {
    const a = win && win.DLBooking;
    return a && typeof a === 'object' ? a : null;
  }

  /**
   * Acknowledge a prefill, exactly as the postMessage bridge does.
   *
   * `js/perch/call.js:83-95` re-delivers the prefill payload on a 700 ms interval,
   * capped at 6 tries, and stops early on
   * `{__perchBookingAck:true, action:'prefill'}` — because Paula fires the payload
   * while /book is still arriving and a single delivery would be lost. In the
   * iframe model the ack is posted by the widget's bridge listener
   * (`js/booking-widget.js:1939`); the direct path never runs that listener, so
   * without this the loop would always run its full ~4.2 s and keep firing into
   * the caller's date clicks. That is the delta this restores.
   *
   * ONLY when the widget's surface is actually present. `DLBooking.prefill` queues
   * into `_pending` and replays on `_register`, so "the API exists" is genuinely
   * "the payload is held" — the same guarantee the bridge listener gives. When the
   * script has not loaded at all the payload IS lost, and the re-delivery loop is
   * precisely the thing that must keep running.
   */
  function ackPrefill() {
    try {
      win.postMessage({ __perchBookingAck: true, action: 'prefill' }, win.location.origin);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Execute one booking command against the widget's published API.
   *
   * Never throws: this runs inside the 1.2 s page-control poll, and one bad
   * payload must not take the poll — and with it every later command — down.
   *
   * @param {string} cmd one of BOOKING_COMMANDS
   * @param {any} payload the sanitized payload from /fn/page-poll, verbatim
   * @returns {{handled: boolean, cmd: string, reason?: string, result?: any, acked?: boolean}}
   */
  function apply(cmd, payload) {
    if (!handles(cmd)) return { handled: false, cmd, reason: 'not_a_booking_command' };

    // `set_call_id` has no DLBooking method. The bridge sets `window.__perchCallId`
    // and the widget reads it at submit time (js/booking-widget.js:1319) to join the
    // booking to the live call in the Clio description and the Grow lead. Same
    // assignment, same coercion, same swallowed failure.
    if (cmd === 'set_call_id') {
      try {
        win.__perchCallId = (payload && payload.call_id) || '';
        return record({ handled: true, cmd, via: 'window.__perchCallId', result: { call_id: win.__perchCallId } });
      } catch (e) {
        return record({ handled: true, cmd, via: 'window.__perchCallId', reason: 'assign_failed', error: String(e) });
      }
    }

    const method = COMMAND_MAP[cmd];
    const surface = api();
    if (!surface || typeof surface[method] !== 'function') {
      // The widget is not on this page (or not adopted yet). The postMessage path
      // behaves the same way — the message lands in a document with no listener —
      // so reporting `widget_absent` is the faithful translation, not a failure.
      return record({ handled: true, cmd, via: 'DLBooking.' + method, reason: 'widget_absent' });
    }

    let result;
    try {
      result = surface[method](payload);
    } catch (e) {
      return record({ handled: true, cmd, via: 'DLBooking.' + method, reason: 'threw', error: String(e) });
    }

    const entry = { handled: true, cmd, via: 'DLBooking.' + method, result: result === undefined ? null : result };
    if (cmd === 'booking_prefill') entry.acked = ackPrefill();
    return record(entry);
  }

  /**
   * Run the /book reveal directly.
   *
   * `js/page/booking-gate.js` registers the reveal through `DL.ready`, so the
   * router's `dl:content-swapped` event re-runs it after every swap and the
   * ordinary unlock handshake — `js/perch/call.js:151` writes
   * `localStorage['donovan_booking_unlock']` BEFORE `host.go('/book.html')`,
   * A2.2 swaps, the gate reads it — needs nothing from this module.
   *
   * The case it does NOT cover is a `navigate` to the page already on screen. The
   * iframe shell reloaded the frame unconditionally, which re-ran the inline gate;
   * a soft router correctly treats a same-URL visit as nothing to do, so no swap
   * fires, no `DL.ready` callback re-runs, and a caller Paula has just unlocked
   * while they were already sitting on /book keeps looking at "a quick step
   * first". This is the one place the router path loses behaviour the iframe path
   * had, and calling the gate's own published function is the whole repair.
   *
   * Idempotent, because the gate is: it reads the 30-minute localStorage window
   * and sets two `display` values. Running it on a page with no `#book-gate`
   * returns quietly by design (`js/page/booking-gate.js:49`).
   */
  function revealGate() {
    const reveal = win && win.DL && win.DL.revealBookingGate;
    if (typeof reveal !== 'function') {
      return record({ handled: true, cmd: 'reveal_gate', reason: 'gate_absent' });
    }
    try {
      return record({ handled: true, cmd: 'reveal_gate', via: 'DL.revealBookingGate', result: reveal() });
    } catch (e) {
      return record({ handled: true, cmd: 'reveal_gate', reason: 'threw', error: String(e) });
    }
  }

  /** Read-only diagnostics. Exposes no way to drive the widget. */
  function probe() {
    const surface = api();
    const gate = document_ && document_.getElementById ? document_.getElementById('book-gate') : null;
    const live = document_ && document_.getElementById ? document_.getElementById('book-live') : null;
    return {
      commands: BOOKING_COMMANDS.slice(),
      widgetPresent: !!surface,
      methods: surface ? BOOKING_COMMANDS.map((c) => COMMAND_MAP[c]).filter(Boolean)
        .filter((m) => typeof surface[m] === 'function') : [],
      gatePublished: !!(win && win.DL && typeof win.DL.revealBookingGate === 'function'),
      callId: (win && win.__perchCallId) || null,
      bookGate: gate ? gate.style.display || '' : null,
      bookLive: live ? live.style.display || '' : null,
      log: log.slice(-10),
    };
  }

  return { handles, apply, revealGate, probe };
}
