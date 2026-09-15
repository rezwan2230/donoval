// ── Booking gate reveal ───────────────────────────────────────────────────────
//
// JORDAN-PERCH-A02 (#47). Externalised verbatim from the inline <script> that
// used to sit between #book-live and .book-fallback in book.html.
//
// WHY IT MOVED. It was the single most load-bearing inline script on the site
// and the one the per-request nonce CSP would have killed first: after an Option
// B content swap the fetched /book markup carries a different nonce, the browser
// refuses the inline block, and a caller Paula has already qualified sees the
// "a quick step first" placeholder forever. See js/dl-init.js for the full
// mechanics. Loaded from <head>, so it is not in the swapped markup at all.
//
// The gate logic below is UNCHANGED — same dev bypass, same 30-minute
// localStorage window, same reveal and scroll. The only difference is that it is
// wrapped in DL.ready, so it also runs after a content swap.
//
// SOFT GATE, NOT AUTH. Unchanged from the inline version and worth restating
// where the code now lives: this keeps unqualified walk-ups off Paul's calendar.
// It is not an authorisation boundary and never was — /booking/create does the
// real verification server-side (Turnstile + type allow-list + availability
// re-check). Nothing here is a security control, so nothing here is weakened by
// being readable.

// SHELDON-PERCH-A31 (#56). The gate body is now a NAMED function so it can be
// called, not only scheduled. Everything inside it is unchanged — same dev
// bypass, same 30-minute window, same reveal, same scroll — and it is still
// registered through DL.ready below, so the load path and the post-swap path are
// byte-for-byte the behaviour that shipped in A02.
//
// WHY IT ALSO NEEDS TO BE CALLABLE. DL.ready re-runs this on
// `dl:content-swapped`, which covers every navigation that actually swaps. It
// does not cover a `navigate` to the page already on screen: the iframe shell
// reloaded the frame unconditionally and re-ran the gate, while a soft router
// correctly treats a same-URL visit as nothing to do. A caller Paula unlocks
// while they are already sitting on /book would otherwise keep looking at "a
// quick step first" forever. js/perch/booking-control.js calls this directly for
// exactly that case. Returns whether the reveal fired, for the adapter's log.
function revealBookingGate() {
  try {
    var unlocked = false;

    // DEV-ONLY: ?unlock=dev bypasses the localStorage gate so the widget
    // is reachable without a live Paula call. NEVER remove this comment.
    // This path is intentionally harmless in production — it only shows
    // the same booking widget a qualified caller would see; it does not
    // grant any authenticated access.
    //
    // ── JORDAN-SITE-UX-FIXES-R1: AND IT IS NO LONGER REACHABLE IN PRODUCTION ──
    //
    // The sentence above is still true about ACCESS and was never true about
    // QUALIFICATION, which is what this gate is for. `?unlock=dev` is a query
    // string: a visitor types it, a link carries it, a search engine indexes it.
    // On www.donovan.law it was a public URL that put an unqualified walk-up on
    // Paul's calendar — the third defect in this order, and the only one of the
    // three that needed no bug at all, just the address.
    //
    // The affordance is KEPT, not deleted, because driving the widget without a
    // live Paula call is how this page is developed and how the Preview is
    // reviewed. It is scoped to the surfaces that are for exactly that: localhost,
    // the loopback addresses, and *.pages.dev (every Preview deployment). The
    // apex and www are refused, which is the whole change.
    try {
      var params = new URLSearchParams(window.location.search);
      if (params.get('unlock') === 'dev' && isDevHost(window.location.hostname)) { unlocked = true; }
    } catch (e) {}

    // Production gate: localStorage timestamp set by Paula's page-control nav.
    if (!unlocked) {
      var raw = localStorage.getItem('donovan_booking_unlock');
      unlocked = raw && (Date.now() - parseInt(raw, 10) < 30 * 60 * 1000);
    }

    if (unlocked) {
      var gate = document.getElementById('book-gate');
      var live = document.getElementById('book-live');
      // Absent on every page that is not /book. After a swap this callback still
      // fires, so finding nothing is the ordinary case and must not throw.
      if (!gate || !live) return { revealed: false, reason: 'not_book_page' };
      gate.style.display = 'none';
      live.style.display = 'block';
      // Scroll the widget into view so the caller lands directly on it.
      setTimeout(function () { try { live.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {} }, 300);
      return { revealed: true };
    }
    // ── JORDAN-SITE-UX-FIXES-R1: a bare /book visit lands IN the qualifier ─────
    //
    // Locked, and the visitor is standing on the booking page. Before this the
    // page answered them with a paragraph — "tap Talk to Paula at the corner of
    // the screen to begin" — which is a signpost, not a door: it asks a visitor
    // who came here to book to go and find a control somewhere else on the page.
    // /book was reachable as a public entry point and the qualifier was the thing
    // it pointed AT rather than the thing it opened.
    //
    // So the gate opens the intake card itself, on the page, over the placeholder
    // that stays behind it. The URL does not move — a redirect would take the
    // widget host away from under the modal and voice flows that soft-swap INTO
    // this page and reveal it in place, which is the one thing this must not do.
    // The verdict rides out on the return so the decision is READABLE — the reach
    // for the layer is a dynamic `import()`, which is not observable from the
    // caller, so without this the only evidence a guard ran would be that nothing
    // happened, which is also what a guard that never ran looks like.
    //
    // ── JORDAN-BOOKING-GATE-255-A (#255): the placeholder IS the qualifier ────
    //
    // R1's card was raised through the persistent layer, by the same assistant
    // this pull request retires. With the launcher gone the card stopped being
    // raised, and `#book-gate` fell back to what is behind it — a paragraph that
    // now names a control no page has. A fresh visitor could not reach the
    // calendar by any route: only the email and phone fallback was left.
    //
    // book.html now carries the questions itself, and `bindBookingQualifier`
    // below answers a completed form by writing the SAME 30-minute unlock and
    // calling back into THIS function — so the reveal a qualified visitor gets is
    // the branch above, byte for byte the one `?unlock=dev` exercises, and there
    // is no second way to open `#book-live`.
    //
    // `offerIntakeOnDirectVisit()` is left exactly as it was and still runs. It
    // is self-limiting: with no layer in the document it returns `no_layer` and
    // opens nothing, and on a deployment that still mounts one it opens the card
    // it always did. What it must not do is decide anything for the on-page form,
    // and it does not — the two are independent, and both roads end at the same
    // unlock key and the same `revealBookingGate` call.
    return {
      revealed: false,
      reason: 'locked',
      intake: offerIntakeOnDirectVisit(),
      qualifier: bindBookingQualifier(),
    };
  } catch (e) { return { revealed: false, reason: 'error' }; }
}

/**
 * Is `?unlock=dev` allowed to speak on this host?
 *
 * Loopback and Preview only. Everything else — the apex, www, and any hostname
 * this list does not know — is refused, so the default for an unrecognised
 * production surface is "no bypass" rather than "bypass".
 *
 * RESIDUAL, written down rather than discovered later: `*.pages.dev` includes the
 * project's own `donovan-site.pages.dev`, which serves the same build production
 * does. It is the address the firm's Preview review happens on and it is not the
 * address the firm publishes, so the bypass stays reachable there deliberately.
 * Narrowing it further would take the dev affordance away from the only surface
 * that reviews this page before it ships.
 */
function isDevHost(hostname) {
  var h = String(hostname || '').toLowerCase();
  if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1') return true;
  if (h === '0.0.0.0') return true;
  return h === 'pages.dev' || h.slice(-10) === '.pages.dev';
}

// One offer per document. `DL.ready` re-runs the gate on every content swap, and a
// visitor who dismissed the card is not asked again by the same page swapping under
// them — a modal that reappears every navigation is a trap, not a gate.
var intakeOffered = false;

/**
 * Open the intake card for a visitor who arrived at /book without qualifying.
 *
 * Reached by dynamic `import()` and NOT by a window property, which is the A33
 * (#58) boundary this repo already draws around this exact function:
 * `openBookingQualifier` raises a dialog that collects residency, income band and
 * net-worth band, and a `window.*` handle to it would let any script on the page
 * raise that card unasked. Same call shape `js/consent-gate.js` uses for the
 * consent-decline door, including the `#perch-persistent` check FIRST so the
 * module is not evaluated in a document that has no layer to open it into.
 *
 * NOT DURING A LIVE CALL. Paula owns the card while a WebRTC session is up — she
 * issues `open_qualifier` herself, at the point in the conversation she chose. A
 * caller who navigates to /book mid-call must not have a second opening race hers.
 */
// ── DIRECT-LOAD RACE (2026-09-02) ───────────────────────────────────────────
//
// On a DIRECT load of /book this file runs as a deferred classic script, and the
// persistent layer runs as a deferred `type="module"` the edge appends at the END
// of <head> — so this runs first. `DL.ready` sees readyState 'interactive' and
// calls the gate immediately, `#perch-persistent` does not exist yet (the layer
// mounts on DOMContentLoaded), the offer returns `no_layer`, and DL.ready only
// re-runs on a content swap. Net effect: a visitor who typed /book got the
// three-question floor; the same visitor arriving by soft navigation got the
// card. One retry, after every DOMContentLoaded listener has run (a macrotask
// queued from inside that event), with `load` as the belt. `intakeOffered` is
// untouched by the failed attempt, so the retry is the same one-shot offer.
var intakeRetryScheduled = false;
function scheduleIntakeRetry() {
  if (intakeRetryScheduled) return;
  intakeRetryScheduled = true;
  var fire = function () { setTimeout(function () { try { offerIntakeOnDirectVisit(); } catch (e) {} }, 0); };
  try {
    if (document.readyState === 'complete') { fire(); return; }
    document.addEventListener('DOMContentLoaded', fire, { once: true });
    window.addEventListener('load', fire, { once: true });
  } catch (e) { /* no retry — the placeholder form is still the floor */ }
}

function offerIntakeOnDirectVisit() {
  if (intakeOffered) return { offered: false, reason: 'already_offered' };
  try {
    // `#book-gate` exists on the booking page and nowhere else, so this is also
    // what keeps the offer off every other page the swap re-runs the gate on.
    if (!document.getElementById('book-gate')) return { offered: false, reason: 'not_book_page' };
    if (!document.getElementById('perch-persistent')) {
      scheduleIntakeRetry();
      return { offered: false, reason: 'no_layer' };
    }
    var probe = window.Perch && window.Perch.layer ? window.Perch.layer.probe() : null;
    if (probe && probe.noVoice && probe.noVoice.liveCall) return { offered: false, reason: 'live_call' };
  } catch (e) { return { offered: false, reason: 'error' }; }

  intakeOffered = true;
  try {
    import('/js/perch-layer.js').then(function (m) {
      try {
        if (m && typeof m.openBookingQualifier === 'function') m.openBookingQualifier('book_direct');
      } catch (e) { /* the placeholder behind it is still the floor */ }
    }).catch(function () { /* no module, no card — the placeholder still reads */ });
  } catch (e) { /* no dynamic import — the placeholder still reads */ }
  return { offered: true };
}

// ── JORDAN-BOOKING-GATE-255-A (#255): the on-page qualifier ─────────────────
//
// THE QUESTIONS THE FIRM ASKS BEFORE IT BOOKS. Which state the visitor lives in,
// what kind of matter it is, and a sentence about it. Deliberately NOT the income
// and net-worth bands the retired card collected: those existed so a caller could
// TAP a figure rather than say it aloud on a recorded line, and they travelled to
// the firm over the /fn/qualifier_submit route this pull request severs. Asking
// for them here would open a disclosure surface with nowhere to send it.
//
// ── WHY THIS BUILDS DOM INSTEAD OF BINDING MARKUP IN book.html ──────────────
//
// It is the only place the questions can live on this branch, and that is a
// measured claim rather than a preference.
//
// book.html clears chrome-diff's `page-structure` rule through exactly one route:
// the ZANE-CHROME-DIFF-255-A asset-removal licence, whose reconstruction holds
// only while the dropped Vantage beacon is the SOLE element-tree delta on the
// page. `structuralWaiver` cannot cover it instead — book.html is already on
// REVIEWED_STRUCTURAL and the waiver is refused a step before the list is even
// consulted, because dropping that end-of-body <script> already changed the
// ordered body children. Both waivers were driven directly over book.html with a
// single empty <span> added: both refuse, and the page reds. So one element added
// to book.html would cost either a relaxed trap or a broadened removal licence,
// and this order forbids both.
//
// Words in book.html are free — the element tree compares tags and attributes and
// never text — so the page keeps the copy and this file keeps the controls.
//
// SOFT GATE, UNCHANGED. Worth restating now that the questions are in a file
// anyone can read: this keeps unqualified walk-ups off Paul's calendar and is not
// an authorisation boundary. /booking/create does the real verification server
// side — Turnstile, the appointment-type allow-list and an availability re-check
// — and none of it consults this form or the flag it writes.
//
// NOTHING IS POSTED FROM HERE. The answers go into the booking form's own notes
// field through `DLBooking.prefill`, the widget's published API, into the same
// textarea the visitor can read and edit before pressing Confirm. The firm
// receives them on the appointment it already receives, over the write path that
// already exists; this file opens no request of its own.

/** The unlock key `revealBookingGate` above reads. One spelling, one writer. */
var BOOKING_UNLOCK_KEY = 'donovan_booking_unlock';

/** Where the questions are built. Present on /book and on no other page. */
var QUALIFIER_HOST_SELECTOR = '#book-gate .book-placeholder';
var QUALIFIER_FORM_ID = 'book-qualifier';

/** The states, plus the one answer that is not a state. Same list, same order and
 *  the same "outside the US" tail the retired card offered. */
var US_STATES = ('AL Alabama|AK Alaska|AZ Arizona|AR Arkansas|CA California|CO Colorado|CT Connecticut|'
  + 'DE Delaware|DC District of Columbia|FL Florida|GA Georgia|HI Hawaii|ID Idaho|IL Illinois|IN Indiana|'
  + 'IA Iowa|KS Kansas|KY Kentucky|LA Louisiana|ME Maine|MD Maryland|MA Massachusetts|MI Michigan|'
  + 'MN Minnesota|MS Mississippi|MO Missouri|MT Montana|NE Nebraska|NV Nevada|NH New Hampshire|'
  + 'NJ New Jersey|NM New Mexico|NY New York|NC North Carolina|ND North Dakota|OH Ohio|OK Oklahoma|'
  + 'OR Oregon|PA Pennsylvania|RI Rhode Island|SC South Carolina|SD South Dakota|TN Tennessee|TX Texas|'
  + 'UT Utah|VT Vermont|VA Virginia|WA Washington|WV West Virginia|WI Wisconsin|WY Wyoming')
  .split('|').map(function (s) {
    var i = s.indexOf(' ');
    return { v: s.slice(0, i), t: s.slice(i + 1) };
  }).concat([{ v: 'outside_us', t: 'Outside the United States' }]);

var MATTER_OPTIONS = [
  { v: 'tax', t: 'Tax' },
  { v: 'real_estate', t: 'Real estate' },
  { v: 'other', t: 'Other' },
  { v: 'not_sure', t: 'Not sure yet' },
];

/**
 * The three questions, in the order they are asked.
 *
 * `label` is what the visitor reads, `message` is what an unanswered one says,
 * and `key` is what the composed note calls it. One table, so a change to the
 * screening step is a change in one place.
 */
var QUESTIONS = [
  {
    key: 'state',
    id: 'book-qual-state',
    kind: 'select',
    options: US_STATES,
    label: 'Which state do you live in?',
    message: 'Please choose the state you live in.',
  },
  {
    key: 'matter',
    id: 'book-qual-matter',
    kind: 'select',
    options: MATTER_OPTIONS,
    label: 'What type of matter would you like to discuss?',
    message: 'Please choose the type of matter.',
  },
  {
    key: 'about',
    id: 'book-qual-about',
    kind: 'textarea',
    label: 'Briefly, what is the matter about?',
    placeholder: 'A sentence or two is plenty',
    hint: 'A brief description is enough — please do not include confidential or sensitive information.',
    message: 'Please add a sentence or two about the matter.',
  },
];

/**
 * The answers, as the sentence the firm reads on the appointment.
 *
 * Mirrors the allow-list `bookingPrefillFrom` composed from — the matter first,
 * because that is the part the firm needs the top of — and clamps to the same 500
 * characters `clampStr(b.notes, 500)` clamps to in functions/booking/create.js,
 * so a long free-text answer cannot push the matter line off the end.
 */
function composeQualifierNote(answers) {
  var MATTER_LABEL = {};
  for (var i = 0; i < MATTER_OPTIONS.length; i++) {
    MATTER_LABEL[MATTER_OPTIONS[i].v] = MATTER_OPTIONS[i].t;
  }
  var STATE_LABEL = {};
  for (var j = 0; j < US_STATES.length; j++) STATE_LABEL[US_STATES[j].v] = US_STATES[j].t;

  var parts = [];
  if (answers.matter) parts.push('Matter: ' + (MATTER_LABEL[answers.matter] || answers.matter));
  if (answers.state) parts.push('Resides in: ' + (STATE_LABEL[answers.state] || answers.state));
  if (answers.about) parts.push('About: ' + answers.about);

  // CR is folded first, so a textarea that hands back CRLF leaves no stray \r in
  // the note; every other control character then goes, exactly as the server-side
  // `sanitizeBookingArgs` does it. \n survives on purpose — /booking/create keeps
  // newlines in `notes` and joins the qualifier summary onto them with "\n\n".
  var note = parts.join('\n')
    .replace(/\r\n?/g, '\n')
    .replace(/[\x00-\x09\x0B-\x1F\x7F]/g, ' ')
    .trim();
  return note.length > 500 ? note.slice(0, 500) : note;
}

/**
 * Build one question. Every node is created and its text set with `textContent`,
 * never assembled as an HTML string — there is no untrusted input here today and
 * this is how it stays that way if a question ever carries one.
 *
 * A `<p>` and not a `<div>`, and that is deliberate: the edge middleware places
 * main#perch-main, the persistent layer and the booking bar by counting this
 * document's divs, so the qualifier contributes none. It is built after
 * DOMContentLoaded, long after the server has streamed its ordinals, but a
 * division element here would still be one a later reader has to reason about.
 */
function buildQuestion(doc, q) {
  var field = doc.createElement('p');
  field.className = 'book-qual-field';

  var label = doc.createElement('label');
  label.className = 'book-qual-label';
  label.setAttribute('for', q.id);
  label.textContent = q.label;
  field.appendChild(label);

  var input;
  if (q.kind === 'select') {
    input = doc.createElement('select');
    var blank = doc.createElement('option');
    blank.value = '';
    blank.textContent = 'Please choose\u2026';
    input.appendChild(blank);
    for (var i = 0; i < q.options.length; i++) {
      var opt = doc.createElement('option');
      opt.value = q.options[i].v;
      opt.textContent = q.options[i].t;
      input.appendChild(opt);
    }
  } else {
    input = doc.createElement('textarea');
    input.setAttribute('rows', '3');
    if (q.placeholder) input.setAttribute('placeholder', q.placeholder);
    input.className = 'book-qual-textarea';
  }
  input.id = q.id;
  input.name = q.key;
  input.required = true;
  input.className = (input.className ? input.className + ' ' : '') + 'book-qual-input';

  var describedBy = [];
  var hint = null;
  if (q.hint) {
    hint = doc.createElement('span');
    hint.className = 'book-qual-hint';
    hint.id = q.id + '-hint';
    hint.textContent = q.hint;
    describedBy.push(hint.id);
  }
  var err = doc.createElement('span');
  err.className = 'book-qual-err';
  err.id = q.id + '-err';
  err.setAttribute('role', 'alert');
  err.setAttribute('aria-live', 'assertive');
  describedBy.push(err.id);
  input.setAttribute('aria-describedby', describedBy.join(' '));

  field.appendChild(input);
  if (hint) field.appendChild(hint);
  field.appendChild(err);
  return field;
}

/**
 * Build the qualifier into `#book-gate`, once per document that has one.
 *
 * Idempotent by the id it writes: a second call finds `#book-qualifier` already
 * there and returns it rather than building a second card. That matters because
 * `DL.ready` re-runs this on every content swap — and after a swap the container
 * holds NEW nodes, so "already built" has to be asked of the DOM in front of us
 * and never of a module-level flag.
 */
function buildBookingQualifier() {
  var doc = document;
  var host = doc.querySelector(QUALIFIER_HOST_SELECTOR);
  // Absent on every page that is not /book, which after a swap is the ordinary
  // case and must not throw.
  if (!host) return null;

  var existing = doc.getElementById(QUALIFIER_FORM_ID);
  if (existing && host.contains(existing)) return existing;

  var form = doc.createElement('form');
  form.className = 'book-qual-form';
  form.id = QUALIFIER_FORM_ID;
  // No action and no method: this form never posts. `novalidate` because the
  // messages below are the ones the visitor should read, in the page's own voice
  // and in the page's own error slots, rather than a browser bubble.
  form.setAttribute('novalidate', 'novalidate');

  for (var i = 0; i < QUESTIONS.length; i++) form.appendChild(buildQuestion(doc, QUESTIONS[i]));

  var submit = doc.createElement('button');
  submit.type = 'submit';
  submit.id = 'book-qual-submit';
  submit.className = 'book-cta';
  submit.textContent = 'Show me the calendar';
  form.appendChild(submit);

  var status = doc.createElement('span');
  status.className = 'book-qual-status';
  status.id = 'book-qual-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  form.appendChild(status);

  host.appendChild(form);
  return form;
}

/**
 * Build the qualifier and answer a completed one by revealing the calendar.
 *
 * The reveal is `revealBookingGate()` itself — the same function, the same
 * localStorage key and therefore the same branch `?unlock=dev` takes. There is no
 * second way to open `#book-live`, which is what keeps the dev affordance and the
 * real door honest about each other.
 */
function bindBookingQualifier() {
  var form;
  try {
    form = buildBookingQualifier();
  } catch (e) { return { bound: false, reason: 'error' }; }
  if (!form) return { bound: false, reason: 'not_book_page' };
  if (form.dlQualifierBound) return { bound: false, reason: 'already_bound' };
  form.dlQualifierBound = true;

  function showError(q, text) {
    var el = document.getElementById(q.id);
    var slot = document.getElementById(q.id + '-err');
    if (slot) slot.textContent = text || '';
    if (el) {
      if (text) el.setAttribute('aria-invalid', 'true');
      else el.removeAttribute('aria-invalid');
    }
  }

  form.addEventListener('submit', function (ev) {
    // First thing, always. The form has no action, so without this a submit is a
    // full navigation to /book — which would throw away the reveal about to
    // happen and land the visitor back on the questions they just answered.
    if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();

    var answers = {};
    var firstBad = null;
    for (var i = 0; i < QUESTIONS.length; i++) {
      var q = QUESTIONS[i];
      var el = document.getElementById(q.id);
      var value = el && el.value ? String(el.value).trim() : '';
      if (!value) {
        showError(q, q.message);
        if (!firstBad) firstBad = el;
      } else {
        showError(q, '');
        answers[q.key] = value;
      }
    }
    if (firstBad) {
      try { firstBad.focus(); } catch (e) {}
      return;
    }

    // Written BEFORE the reveal, because the reveal is what reads it.
    try { localStorage.setItem(BOOKING_UNLOCK_KEY, String(Date.now())); } catch (e) {}

    // The widget's published API queues calls made before it has booted and
    // replays them on registration, so this is safe whether js/booking-widget.js
    // has run yet or not. It fills only a field the visitor has not typed into,
    // so it can never overwrite something they wrote.
    try {
      var note = composeQualifierNote(answers);
      if (note && window.DLBooking && typeof window.DLBooking.prefill === 'function') {
        window.DLBooking.prefill({ notes: note });
      }
    } catch (e) { /* the calendar matters more than the note */ }

    var status = document.getElementById('book-qual-status');
    if (status) status.textContent = 'Thank you — the calendar is below.';

    revealBookingGate();
  });

  return { bound: true };
}

// Unchanged from A02: the gate runs at load and after every content swap.
// The qualifier is registered FIRST so that on a swap into /book the questions
// are on screen and listening before the reveal decides what to do with them.
DL.ready(bindBookingQualifier);
DL.ready(revealBookingGate);

// Published so js/perch/booking-control.js can run the reveal for the one case
// DL.ready cannot see — a navigate to the page already on screen. Additive: it
// adds a callable to the existing DL namespace and changes nothing above.
window.DL = window.DL || {};
window.DL.revealBookingGate = revealBookingGate;

// JORDAN-SITE-UX-FIXES-R1. Published for the same reason `revealBookingGate` is —
// so the guard can be driven and read by CI rather than grepped for. Deliberately
// NOT `offerIntakeOnDirectVisit`: that one opens the intake dialog, and publishing
// it would put back on `window` exactly the handle A33 took off it. This is a pure
// predicate over a string; it decides nothing and reveals nothing.
window.DL.isBookingDevHost = isDevHost;

// JORDAN-BOOKING-GATE-255-A. Published on the same terms as `revealBookingGate`:
// it builds and binds the questions and opens nothing on its own — the calendar
// still comes from `revealBookingGate`, and only after a visitor has answered.
// Idempotent, so a caller cannot use it to raise a second card.
window.DL.bindBookingQualifier = bindBookingQualifier;
