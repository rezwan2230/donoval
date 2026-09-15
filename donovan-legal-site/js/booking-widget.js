// ── Donovan Legal inline booking widget ───────────────────────────────────────
//
// Self-contained vanilla JS. No build step. No framework. ES2017 compatible.
//
// Usage:
//   <div id="dl-booking"
//        data-api="https://vantage.ticoai.net"
//        data-deployment="donovan-main"
//        data-type="consult">   <!-- optional: preselect type -->
//   </div>
//   <script src="/js/booking-widget.js" defer></script>
//
// Dev convenience: if the page URL has ?api=http://127.0.0.1:8096, the widget
// uses that origin instead of data-api. DEV-ONLY; harmless in prod (origin
// mismatch means CORS will block non-localhost requests automatically).
//
// Provider note: currently wired to provider=mock (no Clio creds yet).
// Swap by updating the Firestore deployment doc — the widget is provider-agnostic.
//
// ── Accessibility ──────────────────────────────────────────────────────────────
// - All interactive elements are real <button> or <input> elements with labels.
// - aria-live="polite" region announces confirmation and errors without focus loss.
// - Focus is moved to the first visible input/button when a step transitions.
// - No PII is written to console logs anywhere in this file.
//
// ── i18n ──────────────────────────────────────────────────────────────────────
// All user-visible strings are in the STRINGS constant below. Replace or wrap
// STRINGS with a locale resolver when internationalisation is needed.
//
// ── No-global-bleed ───────────────────────────────────────────────────────────
// All CSS is scoped under .dl-booking (injected once into <head>).
// All JS lives inside the IIFE below.

(function () {
  'use strict';

  // ── String catalogue (i18n-ready) ──────────────────────────────────────────
  var STRINGS = {
    loading:           'Loading available times…',
    errorLoad:         'Unable to load booking options. Please try again.',
    errorNetwork:      'Network error. Please check your connection and try again.',
    errorSlotTaken:    'That time was just taken. Here are the next available slots.',
    errorGeneric:      'Something went wrong. Please try again.',
    errorRequired:     'This field is required.',
    errorEmail:        'Please enter a valid email address.',
    errorPhone:        'Please enter a valid phone number.',
    stepType:          'Select appointment type',
    stepDate:          'Select a date',
    stepTime:          'Select a time',
    stepForm:          'Your details',
    back:              'Back',
    next:              'Next',
    confirm:           'Confirm Appointment',
    submitting:        'Scheduling…',
    confirmTitle:      'Appointment Submitted',
    // SHELDON-CLIO-CONFIRM-EMAIL: this promise is now kept. The booking used to
    // send `contact_id` on the Clio create body — not a field on that resource, so
    // Clio discarded it, no attendee attached and no email was ever sent. The
    // entry now carries the client as an attendee with send_email_notification,
    // so Clio itself dispatches the confirmation and the calendar invite.
    confirmEmail:      'A confirmation email with a calendar invitation is on its way from Clio — please check your inbox, and your spam folder if you don’t see it.',
    confirmAnotherLink:'Schedule another appointment',
    noticeNoConfidential: 'Please do not include confidential information — a brief description of the matter is enough.',
    labelName:         'Full name',
    labelEmail:        'Email address',
    labelPhone:        'Phone number',
    labelNotes:        'Brief description (optional)',
    placeholderName:   'Jane Smith',
    placeholderEmail:  'jane@example.com',
    placeholderPhone:  '(561) 555-0100',
    placeholderNotes:  'Brief description of your matter',
    noSlots:           'No times available on this day.',
    noDays:            'No available dates in the next 14 days. Please contact the firm directly.',
    tzLabel:           function (tzName) { return 'Times shown in ' + tzName + '.'; },
    durationLabel:     function (min) { return min + '‑minute consultation'; },
  };

  // ── CSS (scoped under .dl-booking) ────────────────────────────────────────
  var WIDGET_CSS = [
    '.dl-booking{--dl-green:#169B62;--dl-green-dark:#107a4d;--dl-ink:#1a1a1a;',
    '--dl-muted:#4a4a4a;--dl-border:#d4d4d0;--dl-bg:#fafaf7;--dl-white:#fff;',
    'font-family:"Open Sans",system-ui,sans-serif;color:var(--dl-ink);',
    'max-width:680px;margin:0 auto;}',

    // Live indicator
    '.dl-booking .dl-bk-live-notice{font-size:.72rem;letter-spacing:1.5px;',
    'text-transform:uppercase;color:var(--dl-green);font-weight:700;',
    'margin-bottom:1.25rem;}',

    // Step header
    '.dl-booking .dl-bk-step-label{font-size:.78rem;letter-spacing:1.5px;',
    'text-transform:uppercase;color:var(--dl-green);font-weight:700;',
    'margin-bottom:.5rem;}',

    // Error/status banner
    '.dl-booking .dl-bk-alert{padding:.85rem 1rem;border-radius:4px;',
    'font-size:.9rem;margin-bottom:1rem;line-height:1.5;}',
    '.dl-booking .dl-bk-alert-error{background:#fff0f0;border-left:4px solid #c0392b;',
    'color:#7a1a1a;}',
    '.dl-booking .dl-bk-alert-info{background:#fff8e1;border-left:4px solid #d4a017;',
    'color:#5a4000;}',

    // Type picker
    '.dl-booking .dl-bk-type-list{list-style:none;padding:0;margin:0;}',
    '.dl-booking .dl-bk-type-btn{display:block;width:100%;text-align:left;',
    'background:var(--dl-white);border:1.5px solid var(--dl-border);',
    'border-radius:6px;padding:.9rem 1.1rem;margin-bottom:.6rem;',
    'cursor:pointer;font-size:.95rem;font-family:inherit;color:var(--dl-ink);',
    'transition:border-color 180ms,background 180ms;}',
    '.dl-booking .dl-bk-type-btn:hover,.dl-booking .dl-bk-type-btn:focus{',
    'border-color:var(--dl-green);outline:2px solid var(--dl-green);',
    'outline-offset:-2px;}',
    '.dl-booking .dl-bk-type-name{font-weight:600;display:block;}',
    '.dl-booking .dl-bk-type-dur{font-size:.82rem;color:var(--dl-muted);',
    'margin-top:.2rem;display:block;}',

    // Date strip
    '.dl-booking .dl-bk-date-strip{display:flex;flex-wrap:nowrap;overflow-x:auto;',
    'gap:.45rem;padding-bottom:.5rem;-webkit-overflow-scrolling:touch;',
    'scrollbar-width:thin;}',
    '.dl-booking .dl-bk-date-btn{flex:0 0 auto;',
    'background:var(--dl-white);border:1.5px solid var(--dl-border);',
    'border-radius:6px;padding:.5rem .75rem;cursor:pointer;font-family:inherit;',
    'font-size:.82rem;text-align:center;min-width:54px;',
    'transition:border-color 180ms,background 180ms,color 180ms;}',
    '.dl-booking .dl-bk-date-btn .dl-bk-date-wd{display:block;font-weight:700;',
    'font-size:.7rem;letter-spacing:.8px;text-transform:uppercase;',
    'color:var(--dl-muted);}',
    '.dl-booking .dl-bk-date-btn .dl-bk-date-d{display:block;font-size:1.05rem;',
    'font-weight:600;margin:.1rem 0;}',
    '.dl-booking .dl-bk-date-btn .dl-bk-date-mo{display:block;font-size:.7rem;',
    'color:var(--dl-muted);}',
    '.dl-booking .dl-bk-date-btn:hover,.dl-booking .dl-bk-date-btn:focus{',
    'border-color:var(--dl-green);outline:2px solid var(--dl-green);',
    'outline-offset:-2px;}',
    '.dl-booking .dl-bk-date-btn.selected{background:var(--dl-green);',
    'border-color:var(--dl-green);color:var(--dl-white);}',
    '.dl-booking .dl-bk-date-btn.selected .dl-bk-date-wd,',
    '.dl-booking .dl-bk-date-btn.selected .dl-bk-date-mo{color:rgba(255,255,255,.8);}',

    // Time slots
    '.dl-booking .dl-bk-tz-note{font-size:.78rem;color:var(--dl-muted);',
    'margin:.75rem 0 .6rem;line-height:1.4;}',
    '.dl-booking .dl-bk-slots{display:flex;flex-wrap:wrap;gap:.45rem;',
    'margin-top:.5rem;}',
    '.dl-booking .dl-bk-slot-btn{background:var(--dl-white);',
    'border:1.5px solid var(--dl-border);border-radius:6px;',
    'padding:.5rem .9rem;cursor:pointer;font-family:inherit;font-size:.88rem;',
    'font-weight:600;color:var(--dl-ink);',
    'transition:border-color 180ms,background 180ms,color 180ms;}',
    '.dl-booking .dl-bk-slot-btn:hover,.dl-booking .dl-bk-slot-btn:focus{',
    'border-color:var(--dl-green);outline:2px solid var(--dl-green);',
    'outline-offset:-2px;}',
    '.dl-booking .dl-bk-slot-btn.selected{background:var(--dl-green);',
    'border-color:var(--dl-green);color:var(--dl-white);}',
    '.dl-booking .dl-bk-no-slots{color:var(--dl-muted);font-size:.9rem;',
    'padding:.5rem 0;}',

    // Form
    '.dl-booking .dl-bk-form{margin-top:.5rem;}',
    '.dl-booking .dl-bk-field{margin-bottom:1rem;}',
    '.dl-booking .dl-bk-label{display:block;font-size:.85rem;font-weight:600;',
    'margin-bottom:.35rem;color:var(--dl-ink);}',
    '.dl-booking .dl-bk-input{display:block;width:100%;',
    'border:1.5px solid var(--dl-border);border-radius:5px;',
    'padding:.6rem .8rem;font-family:inherit;font-size:.95rem;',
    'color:var(--dl-ink);background:var(--dl-white);',
    'transition:border-color 180ms;}',
    '.dl-booking .dl-bk-input:focus{outline:2px solid var(--dl-green);',
    'outline-offset:-1px;border-color:var(--dl-green);}',
    '.dl-booking .dl-bk-input.invalid{border-color:#c0392b;}',
    '.dl-booking .dl-bk-field-err{font-size:.78rem;color:#c0392b;',
    'margin-top:.25rem;display:block;}',
    '.dl-booking .dl-bk-notice{font-size:.8rem;color:var(--dl-muted);',
    'line-height:1.5;margin-bottom:1rem;padding:.6rem .8rem;',
    'background:var(--dl-bg);border-left:3px solid var(--dl-border);}',
    // Honeypot — visually and assistively hidden
    '.dl-booking .dl-bk-hp{position:absolute;left:-9999px;',
    'width:1px;height:1px;overflow:hidden;}',

    // Buttons row
    '.dl-booking .dl-bk-btn-row{display:flex;gap:.75rem;margin-top:1.25rem;',
    'flex-wrap:wrap;}',
    '.dl-booking .dl-bk-btn-primary{display:inline-flex;align-items:center;',
    'background:var(--dl-green);color:var(--dl-white);border:none;',
    'border-radius:30px;padding:.75rem 2rem;font-family:inherit;',
    'font-size:.88rem;font-weight:700;letter-spacing:1.5px;',
    'text-transform:uppercase;cursor:pointer;',
    'transition:background 200ms,transform 200ms;}',
    '.dl-booking .dl-bk-btn-primary:hover{background:var(--dl-green-dark);',
    'transform:translateY(-1px);}',
    '.dl-booking .dl-bk-btn-primary:focus{outline:2px solid var(--dl-green);',
    'outline-offset:3px;}',
    '.dl-booking .dl-bk-btn-primary:disabled{opacity:.55;cursor:not-allowed;',
    'transform:none;}',
    '.dl-booking .dl-bk-btn-back{display:inline-flex;align-items:center;',
    'background:transparent;color:var(--dl-muted);border:1.5px solid var(--dl-border);',
    'border-radius:30px;padding:.75rem 1.5rem;font-family:inherit;',
    'font-size:.88rem;cursor:pointer;',
    'transition:border-color 180ms,color 180ms;}',
    '.dl-booking .dl-bk-btn-back:hover{border-color:var(--dl-ink);',
    'color:var(--dl-ink);}',
    '.dl-booking .dl-bk-btn-back:focus{outline:2px solid var(--dl-green);',
    'outline-offset:3px;}',

    // Confirmation
    '.dl-booking .dl-bk-confirm{text-align:center;padding:2rem 1rem;}',
    '.dl-booking .dl-bk-confirm-icon{font-size:2.5rem;color:var(--dl-green);',
    'margin-bottom:1rem;}',
    '.dl-booking .dl-bk-confirm h3{font-family:"Open Sans",sans-serif;',
    'font-size:1.35rem;font-weight:700;color:var(--dl-ink);',
    'margin-bottom:.5rem;}',
    '.dl-booking .dl-bk-confirm-slot{font-size:1.05rem;font-weight:600;',
    'color:var(--dl-green);margin:.75rem 0 .5rem;}',
    '.dl-booking .dl-bk-confirm-email{font-size:.9rem;color:var(--dl-muted);',
    'margin:.35rem 0 1.5rem;}',
    '.dl-booking .dl-bk-restart{background:none;border:none;',
    'color:var(--dl-green);font-family:inherit;font-size:.88rem;',
    'cursor:pointer;text-decoration:underline;padding:0;}',
    '.dl-booking .dl-bk-restart:focus{outline:2px solid var(--dl-green);',
    'outline-offset:2px;}',

    // Skeleton / loading shimmer
    '@keyframes dl-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}',
    '.dl-booking .dl-bk-skeleton{background:linear-gradient(90deg,#f0f0ec 25%,#e8e8e3 50%,#f0f0ec 75%);',
    'background-size:200% 100%;animation:dl-shimmer 1.4s infinite;',
    'border-radius:4px;height:2.2rem;margin-bottom:.5rem;}',

    // Step separator
    '.dl-booking .dl-bk-sep{border:none;border-top:1px solid var(--dl-border);',
    'margin:1.5rem 0;}',

    // Mobile
    '@media(max-width:480px){',
    '.dl-booking .dl-bk-btn-row{flex-direction:column;}',
    '.dl-booking .dl-bk-btn-primary,.dl-booking .dl-bk-btn-back{width:100%;',
    'justify-content:center;}',
    '}',
  ].join('');

  // ── Utility helpers ────────────────────────────────────────────────────────

  /** Inject the widget CSS once per page. */
  function injectStyles() {
    if (document.getElementById('dl-booking-styles')) return;
    var s = document.createElement('style');
    s.id = 'dl-booking-styles';
    s.textContent = WIDGET_CSS;
    document.head.appendChild(s);
  }

  /** Resolve the API base URL: ?api= query param overrides data-api (dev path). */
  function resolveApiBase(containerEl) {
    try {
      var params = new URLSearchParams(window.location.search);
      var qpApi = params.get('api');
      if (qpApi) return qpApi.replace(/\/$/, ''); // DEV-ONLY query-param override
    } catch (e) {}
    return (containerEl.getAttribute('data-api') || '').replace(/\/$/, '');
  }

  /** Detect the visitor's IANA timezone name (falls back to UTC). */
  function detectTimezone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; }
    catch (e) { return 'UTC'; }
  }

  /** Return a display-friendly timezone abbreviation, e.g. "Eastern Time (ET)". */
  function tzDisplayName(tz) {
    try {
      var fmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'short' });
      var parts = fmt.formatToParts(new Date());
      var short = '';
      for (var i = 0; i < parts.length; i++) {
        if (parts[i].type === 'timeZoneName') { short = parts[i].value; break; }
      }
      // Build "Eastern Time (ET)" style
      var longFmt = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'long' });
      var longParts = longFmt.formatToParts(new Date());
      var longName = '';
      for (var j = 0; j < longParts.length; j++) {
        if (longParts[j].type === 'timeZoneName') { longName = longParts[j].value; break; }
      }
      if (longName && short) return longName + ' (' + short + ')';
      return short || tz;
    } catch (e) { return tz; }
  }

  /**
   * Format a UTC ISO slot start into the visitor's local time string.
   * Returns e.g. "9:00 AM"
   */
  function formatSlotTime(isoStr, tz) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }).format(new Date(isoStr));
    } catch (e) { return isoStr; }
  }

  /**
   * Format a UTC ISO slot start as a long date+time string for confirmation.
   * Returns e.g. "Monday, July 7, 2026 at 9:00 AM Eastern Time (ET)"
   */
  function formatSlotFull(isoStr, tz) {
    try {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZoneName: 'short',
      }).format(new Date(isoStr));
    } catch (e) { return isoStr; }
  }

  /**
   * Extract the local calendar date key "YYYY-MM-DD" from a UTC ISO string,
   * in the visitor's timezone. Used to group slots by day.
   */
  function localDateKey(isoStr, tz) {
    try {
      var fmt = new Intl.DateTimeFormat('en-CA', { // YYYY-MM-DD
        timeZone: tz,
        year: 'numeric', month: '2-digit', day: '2-digit',
      });
      return fmt.format(new Date(isoStr));
    } catch (e) {
      return isoStr.slice(0, 10); // fallback: UTC date
    }
  }

  /**
   * Format a date key "YYYY-MM-DD" for display in the date strip.
   * Returns { wd: "MON", d: "7", mo: "JUL" }
   */
  function formatDateKey(dateKey, tz) {
    try {
      var d = new Date(dateKey + 'T12:00:00Z'); // noon UTC to avoid date flip
      // Intl in tz to get correct day/month for that date
      var fmtLong = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short', month: 'short', day: 'numeric',
      });
      var parts = {};
      fmtLong.formatToParts(d).forEach(function (p) { parts[p.type] = p.value; });
      return {
        wd: (parts.weekday || '').toUpperCase().slice(0, 3),
        d:  parts.day || '',
        mo: (parts.month || '').toUpperCase().slice(0, 3),
      };
    } catch (e) {
      var bits = dateKey.split('-');
      return { wd: '', d: bits[2] || '', mo: bits[1] || '' };
    }
  }

  /** Group slots array by local date key in tz. Returns Map<dateKey → slots[]>. */
  function groupSlotsByDay(slots, tz) {
    var map = {};
    for (var i = 0; i < slots.length; i++) {
      var key = localDateKey(slots[i].startISO, tz);
      if (!map[key]) map[key] = [];
      map[key].push(slots[i]);
    }
    return map;
  }

  // ── Natural day/time matching (for the voice agent, Paula) ─────────────────
  //
  // Paula hears a caller say a date and time in plain speech ("July 10th",
  // "11 AM"). These are loose strings. The slots the widget loaded are UTC
  // ISO instants; the caller only ever SEES/SAYS times in the widget's
  // display timezone (the visitor's browser tz, from detectTimezone()).
  // So matching MUST project each slot into that display tz before comparing
  // — never compare against the raw UTC ISO fields.
  //
  // These functions are pure (no closure over widget state) so they can be
  // unit-tested standalone via the guarded CommonJS export at the bottom of
  // this file (same pattern as do_page_action.js's sanitizeBookingArgs).

  var MONTH_NAMES = [
    'january', 'february', 'march', 'april', 'may', 'june',
    'july', 'august', 'september', 'october', 'november', 'december',
  ];
  var MONTH_ABBR = MONTH_NAMES.map(function (m) { return m.slice(0, 3); });

  function monthIndexFromWord(word) {
    var w = word.toLowerCase();
    var i = MONTH_NAMES.indexOf(w);
    if (i !== -1) return i + 1;
    i = MONTH_ABBR.indexOf(w.slice(0, 3));
    if (i !== -1 && MONTH_ABBR[i] === w.slice(0, 3)) return i + 1;
    return null;
  }

  /**
   * Parse a loose day string as a caller would say it.
   * Supports: "YYYY-MM-DD", "Month DayNumber" (full or 3-letter month,
   * e.g. "July 10", "Jul 10"), "the 10th", or a bare day-of-month number
   * ("10"). Returns { year: number|null, month: number|null (1-12),
   * day: number|null } — any field the string didn't specify is null.
   * Returns null if nothing recognisable was found.
   */
  // Resolve a spoken day-of-month WORD ("seventeenth", "the third",
  // "twenty-first") to 1–31, or null. Callers routinely say the ordinal in
  // words and Paula echoes it, so booking_show_date must understand them —
  // parseDayString's digit scan alone misses "the seventeenth".
  function dayWordToNum(str) {
    var s = ' ' + String(str).toLowerCase().replace(/[-]/g, ' ').replace(/\s+/g, ' ') + ' ';
    var UNIT = { one: 1, first: 1, two: 2, second: 2, three: 3, third: 3, four: 4, fourth: 4,
      five: 5, fifth: 5, six: 6, sixth: 6, seven: 7, seventh: 7, eight: 8, eighth: 8, nine: 9, ninth: 9 };
    // compound: twenty/thirty (+ optional unit) — check before single words
    var m = s.match(/ (twenty|thirty)(?: (one|first|two|second|three|third|four|fourth|five|fifth|six|sixth|seven|seventh|eight|eighth|nine|ninth))? /);
    if (m) {
      var base = m[1] === 'twenty' ? 20 : 30;
      var v = base + (m[2] ? UNIT[m[2]] : 0);
      if (v >= 1 && v <= 31) return v;
    }
    var TEEN = { ten: 10, tenth: 10, eleven: 11, eleventh: 11, twelve: 12, twelfth: 12,
      thirteen: 13, thirteenth: 13, fourteen: 14, fourteenth: 14, fifteen: 15, fifteenth: 15,
      sixteen: 16, sixteenth: 16, seventeen: 17, seventeenth: 17, eighteen: 18, eighteenth: 18,
      nineteen: 19, nineteenth: 19, twentieth: 20, thirtieth: 30, thirtyfirst: 31 };
    for (var w in TEEN) { if (s.indexOf(' ' + w + ' ') >= 0) return TEEN[w]; }
    for (var u in UNIT) { if (s.indexOf(' ' + u + ' ') >= 0) return UNIT[u]; }
    return null;
  }

  function parseDayString(dayStr) {
    if (!dayStr) return null;
    var s = String(dayStr).trim().toLowerCase();
    if (!s) return null;

    // YYYY-MM-DD
    var iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (iso) {
      return { year: parseInt(iso[1], 10), month: parseInt(iso[2], 10), day: parseInt(iso[3], 10) };
    }

    // "Month DayNumber[,][ Year]" or "DayNumber Month" — search for a month
    // word anywhere and a day number anywhere else in the string.
    var monthMatch = s.match(/([a-z]+)/g);
    var foundMonth = null;
    if (monthMatch) {
      for (var i = 0; i < monthMatch.length; i++) {
        var mi = monthIndexFromWord(monthMatch[i]);
        if (mi) { foundMonth = mi; break; }
      }
    }
    var yearMatch = s.match(/\b(20\d{2})\b/);
    var foundYear = yearMatch ? parseInt(yearMatch[1], 10) : null;

    // Day number: first 1-2 digit number that isn't part of the year match.
    var dayNum = null;
    var numMatches = s.match(/\d{1,2}(?:st|nd|rd|th)?/g);
    if (numMatches) {
      for (var j = 0; j < numMatches.length; j++) {
        var raw = numMatches[j].replace(/(st|nd|rd|th)$/, '');
        var n = parseInt(raw, 10);
        // Skip if this exact substring is actually the year we already found
        // (guards against re-reading "2026" digits as a day).
        if (foundYear && numMatches[j].length === 4) continue;
        if (n >= 1 && n <= 31) { dayNum = n; break; }
      }
    }

    // Digits missing? fall back to a spoken word day ("the seventeenth").
    if (dayNum == null) {
      var wordDay = dayWordToNum(s);
      if (wordDay != null) dayNum = wordDay;
    }

    if (foundMonth || dayNum) {
      return { year: foundYear, month: foundMonth, day: dayNum };
    }
    return null;
  }

  /**
   * Parse a loose time string as a caller would say it.
   * Supports: "11", "11am", "11 AM", "11:00", "11:00 AM", "2pm", "2:30 pm".
   * Returns { hour12: number (1-12), minute: number (0-59),
   *           meridiem: 'am'|'pm'|null } or null if unparseable.
   * meridiem is null when the string gave no am/pm marker — the caller
   * (matcher) decides how to resolve that ambiguity against candidate slots.
   */
  function parseTimeString(timeStr) {
    if (!timeStr) return null;
    var s = String(timeStr).trim().toLowerCase();
    if (!s) return null;

    var m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?$/);
    if (!m) return null;

    var hour = parseInt(m[1], 10);
    var minute = m[2] ? parseInt(m[2], 10) : 0;
    var meridiemRaw = m[3] ? m[3].replace(/\./g, '') : null;
    var meridiem = meridiemRaw ? meridiemRaw.slice(0, 2) : null; // 'am' | 'pm' | null

    if (hour < 1 || hour > 12 || minute < 0 || minute > 59) return null;

    return { hour12: hour, minute: minute, meridiem: meridiem };
  }

  /**
   * Convert a parsed time { hour12, meridiem } to 24h hour. If meridiem is
   * null, returns both possibilities (am and pm reads) for the caller to
   * disambiguate against available slots.
   * Returns array of candidate 24h hours, e.g. [11] if meridiem given,
   * or [11, 23] if ambiguous (11 AM or 11 PM). "12" wraps to 0/12 correctly
   * (12 AM -> 0, 12 PM -> 12) via the %12 normalisation below.
   */
  function timeToHour24Candidates(parsedTime) {
    var h = parsedTime.hour12 % 12; // 12 -> 0
    if (parsedTime.meridiem === 'am') return [h];
    if (parsedTime.meridiem === 'pm') return [h + 12];
    // No am/pm given — both readings are candidates.
    return [h, h + 12];
  }

  /**
   * Project a slot's UTC startISO into the display timezone and return its
   * calendar fields there: { year, month(1-12), day, hour(0-23), minute }.
   * This is the crux of tz-correct matching — never compare parsed request
   * fields against the raw UTC ISO string fields.
   */
  function slotLocalFields(startISO, tz) {
    try {
      var fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric', hour12: false,
      });
      var parts = {};
      fmt.formatToParts(new Date(startISO)).forEach(function (p) { parts[p.type] = p.value; });
      var hour = parseInt(parts.hour, 10);
      // Intl's hour12:false can emit "24" for midnight in some engines — normalise.
      if (hour === 24) hour = 0;
      return {
        year: parseInt(parts.year, 10),
        month: parseInt(parts.month, 10),
        day: parseInt(parts.day, 10),
        hour: hour,
        minute: parseInt(parts.minute, 10),
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Match a natural day+time request against a flat list of slots, in the
   * given display timezone. Returns the matching slot's startISO, or null.
   *
   * Day matching: any parsed field (year/month/day) that the request DIDN'T
   * specify is treated as a wildcard. A bare day-of-month ("10") matches any
   * slot whose local day-of-month is 10, regardless of month.
   *
   * Time matching: if the request gave an explicit am/pm, only that reading
   * is tried. If it did NOT, both the am and pm readings are tried; the
   * match only succeeds if exactly one candidate slot matches across both
   * readings (predictable — never silently guesses between two real
   * options). This is where the "hour <= 8 assume PM" business-hours
   * plausibility rule is intentionally NOT hard-coded: instead we let the
   * actual availability decide, which is stricter and avoids surprising a
   * caller who really meant AM.
   *
   * @param {Array<{startISO:string}>} slots
   * @param {string} tz
   * @param {string} dayStr
   * @param {string} timeStr
   * @returns {string|null} matching slot startISO, or null
   */
  function matchSlotByDayTime(slots, tz, dayStr, timeStr) {
    if (!slots || !slots.length) return null;
    var parsedTime = parseTimeString(timeStr);
    if (!parsedTime) return null;
    var parsedDay = parseDayString(dayStr); // may be null — time-only request

    var hourCandidates = timeToHour24Candidates(parsedTime);
    var minute = parsedTime.minute;

    // Collect all slots matching the day constraint (or all slots, if no day
    // constraint was parseable at all).
    var dayMatches = [];
    for (var i = 0; i < slots.length; i++) {
      var f = slotLocalFields(slots[i].startISO, tz);
      if (!f) continue;
      if (parsedDay) {
        if (parsedDay.year && f.year !== parsedDay.year) continue;
        if (parsedDay.month && f.month !== parsedDay.month) continue;
        if (parsedDay.day && f.day !== parsedDay.day) continue;
        // If parsedDay had nothing usable (shouldn't happen — parseDayString
        // returns null in that case) skip filtering.
      }
      dayMatches.push({ slot: slots[i], f: f });
    }
    if (dayMatches.length === 0) return null;

    // Try each hour candidate (1 if am/pm given, 2 if ambiguous). Collect all
    // slot matches across all candidates so we can detect true ambiguity.
    var found = [];
    for (var c = 0; c < hourCandidates.length; c++) {
      var hc = hourCandidates[c];
      for (var j = 0; j < dayMatches.length; j++) {
        var dm = dayMatches[j];
        if (dm.f.hour === hc && dm.f.minute === minute) {
          found.push(dm.slot.startISO);
        }
      }
    }

    if (found.length === 1) return found[0];
    return null; // no match, or genuinely ambiguous (e.g. both 11am & 11pm slots exist)
  }

  /**
   * Match a natural day request against a list of loaded dayKeys ("YYYY-MM-DD",
   * the widget's own grouping key — already in the display tz because
   * groupSlotsByDay/localDateKey produced them via `tz`). Used by showDate()
   * to OPEN a day (reveal its times) without selecting a slot.
   *
   * Unlike matchSlotByDayTime, there's no time component and no am/pm
   * ambiguity to resolve — this only needs to resolve day/month/(year)
   * against the finite list of dayKeys that actually have availability. If
   * more than one loaded day matches the (possibly partial) parsed fields —
   * e.g. a bare day-of-month that collides across two loaded months — this
   * intentionally refuses to guess, same "predictable over clever" rule as
   * the slot matcher.
   *
   * @param {Array<string>} dayKeys  ordered "YYYY-MM-DD" keys (state.dayKeys)
   * @param {string} tz
   * @param {string} dayStr
   * @returns {string|null} matching dayKey, or null
   */
  function matchDayInDayKeys(dayKeys, tz, dayStr) {
    if (!dayKeys || !dayKeys.length) return null;
    var parsedDay = parseDayString(dayStr);
    if (!parsedDay) return null;

    var found = [];
    for (var i = 0; i < dayKeys.length; i++) {
      var key = dayKeys[i];
      // dayKeys are "YYYY-MM-DD" already expressed in the display tz (see
      // localDateKey/groupSlotsByDay) — project via noon-UTC the same way
      // formatDateKey does, then read the calendar fields back out in tz,
      // so a dayKey compares apples-to-apples with parseDayString's fields
      // regardless of tz offset edge cases around midnight.
      var f = slotLocalFields(key + 'T12:00:00Z', tz);
      if (!f) continue;
      if (parsedDay.year && f.year !== parsedDay.year) continue;
      if (parsedDay.month && f.month !== parsedDay.month) continue;
      if (parsedDay.day && f.day !== parsedDay.day) continue;
      found.push(key);
    }

    if (found.length === 1) return found[0];
    return null; // no match, or ambiguous — do not guess
  }

  /**
   * Resolve a caller's day phrasing to one of the loaded availability dayKeys —
   * the flexible front door for booking_show_date. Callers say the day every
   * which way: "Friday", "Friday the 17th", "the 17th", "the seventeenth",
   * "beginning of August", "end of the month", "next Friday". Strategy, in order:
   *   1. Explicit month/day  → matchDayInDayKeys (precise; handles "July 17", "the 17th").
   *   2. Month (+ position)  → "beginning/mid/end of August", bare month, this/next month.
   *   3. Weekday name        → nearest matching available day ("Friday", "next Friday").
   *   4. Bare position       → "the soonest" / "end of the month" with no month word.
   * Resolves ONLY against days that actually have availability (finite dayKeys),
   * so it never opens an empty or out-of-range day. Returns a dayKey or null.
   */
  function resolveSpokenDay(dayKeys, tz, dayStr) {
    if (!dayKeys || !dayKeys.length || !dayStr) return null;

    // 1. explicit month+day (most precise) — reuse the strict field matcher
    var direct = matchDayInDayKeys(dayKeys, tz, dayStr);
    if (direct) return direct;

    var s = ' ' + String(dayStr).toLowerCase().replace(/[.,\-]/g, ' ').replace(/\s+/g, ' ') + ' ';

    // per-dayKey calendar fields (weekday abbr, month number, day) in tz
    var MO = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    var info = [];
    for (var i = 0; i < dayKeys.length; i++) {
      var f = formatDateKey(dayKeys[i], tz);
      info.push({ key: dayKeys[i], wd: (f.wd || '').toUpperCase(), mo: MO.indexOf((f.mo || '').toLowerCase().slice(0, 3)) + 1, day: parseInt(f.d, 10) });
    }

    // strict month token — whole words only, so "maybe" never reads as "may"
    var MONTHS = { january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
      jan: 1, feb: 2, mar: 3, apr: 4, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
    var mon = null;
    for (var mk in MONTHS) { if (s.indexOf(' ' + mk + ' ') >= 0) { mon = MONTHS[mk]; break; } }

    var pos = null;
    if (/ (begin|beginning|start|early|soon|soonest|earliest|first part|first of) /.test(s)) pos = 'start';
    else if (/ (end|late|later|latter|last part) /.test(s)) pos = 'end';
    else if (/ (mid|middle) /.test(s)) pos = 'mid';

    var targetMonth = mon;
    if (!targetMonth && / next month /.test(s)) targetMonth = (info[0].mo % 12) + 1;
    else if (!targetMonth && (/ this month /.test(s) || / the month /.test(s))) targetMonth = info[0].mo;

    // 2. month (+ optional position)
    if (targetMonth) {
      var inM = info.filter(function (x) { return x.mo === targetMonth; });
      if (!inM.length) return null; // month named but nothing open then
      if (pos === 'end') return inM[inM.length - 1].key;
      if (pos === 'mid') return inM[Math.floor((inM.length - 1) / 2)].key;
      return inM[0].key; // start / default → first open day that month
    }

    // 3. weekday name → nearest matching available day
    var WD = { sunday: 'SUN', sun: 'SUN', monday: 'MON', mon: 'MON', tuesday: 'TUE', tue: 'TUE', tues: 'TUE',
      wednesday: 'WED', wed: 'WED', weds: 'WED', thursday: 'THU', thu: 'THU', thurs: 'THU',
      friday: 'FRI', fri: 'FRI', saturday: 'SAT', sat: 'SAT' };
    var wdT = null;
    for (var wk in WD) { if (s.indexOf(' ' + wk + ' ') >= 0) { wdT = WD[wk]; break; } }
    if (wdT) {
      var wm = info.filter(function (x) { return x.wd === wdT; });
      if (!wm.length) return null;
      if (/ next /.test(s) && wm.length > 1) return wm[1].key; // "next Friday" → the following one
      return wm[0].key;
    }

    // 4. bare position, no month/weekday ("the soonest", "end of the month")
    if (pos === 'start') return info[0].key;
    if (pos === 'end') return info[info.length - 1].key;

    return null;
  }

  /** Escape text for safe innerHTML insertion. */
  function esc(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Move browser focus to the first focusable element inside `el`.
   *
   * ── JORDAN-BOOKING-WIDGET-DETAILS-R1 ──────────────────────────────────────
   * The selector used to be `'button,input,textarea,select,[tabindex]:not([tabindex="-1"])'`,
   * where `:not([tabindex="-1"])` binds ONLY to the `[tabindex]` term. The bare
   * `input` term therefore matched every input regardless of tab order — and the
   * first input in the details form is the bot HONEYPOT
   * (`#dl-bk-hp-field`, `tabindex="-1"`, inside an `aria-hidden` wrapper parked
   * at `left:-9999px`). So arriving at the details step focused the honeypot.
   *
   * Two ways that hurts a real caller, both silent:
   *   • the browser scrolls to bring a focused element on screen, and this one
   *     sits 9999px off to the left;
   *   • a caller who starts typing the moment the form appears — which is the
   *     ordinary thing to do, and the only thing a keyboard or screen-reader user
   *     can do — types their name into the honeypot. `handleFormSubmit` reads
   *     `if (hp && hp.value) return;` and ABORTS THE BOOKING with no error, no
   *     disabled button and no announcement. The caller never reaches the
   *     confirmation screen and is never told why.
   *
   * So skip anything explicitly out of the tab order, disabled, or assistively
   * hidden, and return what was focused so callers can assert on it.
   */
  function focusFirst(el) {
    try {
      var nodes = el.querySelectorAll('button,input,textarea,select,[tabindex]');
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.disabled) continue;
        if (n.type === 'hidden') continue;
        if (n.getAttribute('tabindex') === '-1') continue;          // out of tab order on purpose
        if (n.closest && n.closest('[aria-hidden="true"]')) continue; // honeypot / decorative
        n.focus();
        return n;
      }
    } catch (e) {}
    return null;
  }

  /** Generate a UUID v4 for idempotency keys. Falls back to Math.random. */
  function uuid4() {
    try {
      if (crypto && crypto.randomUUID) return crypto.randomUUID();
      var bytes = crypto.getRandomValues(new Uint8Array(16));
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      var hex = Array.from(bytes).map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');
      return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
    } catch (e) {
      return 'xxxx-xxxx-4xxx-yxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
      });
    }
  }

  // ── Core fetch helpers ─────────────────────────────────────────────────────

  /**
   * Fetch appointment types from the harness.
   * GET /booking/types?deployment=<id>
   */
  // Fetch a URL with automatic retries on transient failures (5xx / network).
  // The Clio provider path can hit occasional edge→Clio blips that self-heal in
  // a second or two; retrying makes those invisible to the caller instead of
  // surfacing a scary error. Retries: 3 attempts, ~400ms/900ms backoff. A 4xx
  // (bad request) is NOT retried — it won't get better.
  function fetchRetry(url, label, attempt) {
    attempt = attempt || 1;
    var MAX = 3;
    return fetch(url).then(function (r) {
      if (r.ok) return r.json();
      var transient = r.status >= 500 || r.status === 0;
      if (transient && attempt < MAX) {
        return new Promise(function (res) { setTimeout(res, attempt * 500); })
          .then(function () { return fetchRetry(url, label, attempt + 1); });
      }
      throw new Error(label + ':' + r.status);
    }).catch(function (e) {
      // Network-level failure (fetch rejected) — retry too.
      if (attempt < MAX && !/:\d+$/.test(String(e && e.message))) {
        return new Promise(function (res) { setTimeout(res, attempt * 500); })
          .then(function () { return fetchRetry(url, label, attempt + 1); });
      }
      throw e;
    });
  }

  function fetchTypes(apiBase, deployment) {
    var url = apiBase + '/booking/types?deployment=' + encodeURIComponent(deployment);
    return fetchRetry(url, 'types_fetch_failed');
  }

  /**
   * Fetch availability from the harness.
   * GET /booking/availability?deployment=&type=&days=30&tz=
   * 30-day horizon so a caller near month-end can reach "beginning of August".
   */
  function fetchAvailability(apiBase, deployment, typeId, tz) {
    var url = apiBase + '/booking/availability'
      + '?deployment=' + encodeURIComponent(deployment)
      + '&type=' + encodeURIComponent(typeId)
      + '&days=30'
      + '&tz=' + encodeURIComponent(tz);
    return fetchRetry(url, 'avail_fetch_failed');
  }


  /**
   * Hand the confirmed booking's contact fields to the Google tag as
   * `user_data`, in the shape enhanced conversions expects. Pure formatting,
   * no network: gtag normalises and hashes. Phone goes out as E.164 (+1 and ten
   * digits for a North American number; anything already carrying a country
   * code is passed through), name is split on the last space. Empty fields
   * are simply omitted. No-op when gtag is absent (analytics off, or blocked).
   */
  function setEnhancedConversionData(win, p) {
    if (!win || typeof win.gtag !== 'function' || !p) return;
    var out = {};
    var email = String(p.email || '').trim().toLowerCase();
    if (email) out.email = email;
    var digits = String(p.phone || '').replace(/[^0-9+]/g, '');
    if (digits) {
      if (digits.charAt(0) !== '+') {
        digits = digits.replace(/\D/g, '');
        if (digits.length === 10) digits = '+1' + digits;
        else if (digits.length === 11 && digits.charAt(0) === '1') digits = '+' + digits;
        else digits = '';
      }
      if (digits) out.phone_number = digits;
    }
    var name = String(p.name || '').trim().replace(/\s+/g, ' ');
    if (name) {
      var cut = name.lastIndexOf(' ');
      out.address = cut > 0
        ? { first_name: name.slice(0, cut), last_name: name.slice(cut + 1) }
        : { first_name: name };
    }
    if (Object.keys(out).length) win.gtag('set', 'user_data', out);
  }

  /**
   * POST booking create to the harness.
   * POST /booking/create { deployment, type, slot, name, email, phone, notes }
   */
  function postCreate(apiBase, payload, idempKey) {
    var url = apiBase + '/booking/create';
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempKey,
      },
      body: JSON.stringify(payload),
    }).then(function (r) {
      return r.json().then(function (data) {
        return { status: r.status, data: data };
      });
    });
  }

  // ── Widget state machine ───────────────────────────────────────────────────
  //
  // States: LOADING → TYPE_PICK (if >1 type) → DATE_PICK → TIME_PICK → FORM → SUBMITTING → CONFIRMED | ERROR

  function initWidget(container) {
    var apiBase   = resolveApiBase(container);
    var deployment = container.getAttribute('data-deployment') || 'donovan-main';
    var preType    = container.getAttribute('data-type') || '';
    // Display + match in the FIRM's timezone (data-tz), not the visitor's browser
    // tz. The voice agent offers times in the firm tz and the appointment IS in
    // the firm tz, so everyone must see the same clock — otherwise "11 AM Eastern"
    // from the agent doesn't line up with what the caller sees, and slot selection
    // by day+time fails. Falls back to the visitor's tz only if data-tz is absent.
    var tz         = container.getAttribute('data-tz') || detectTimezone();
    var tzName     = tzDisplayName(tz);

    // ── Widget state ────────────────────────────────────────────────────────
    var state = {
      step:       'LOADING',  // LOADING | TYPE_PICK | DATE_PICK | FORM | SUBMITTING | CONFIRMED
      types:      [],
      selectedType: null,     // { id, name, duration_min }
      slots:      [],         // all slots from availability
      slotsByDay: {},         // dateKey -> slots[]
      dayKeys:    [],         // ordered list of dateKeys that have slots
      selectedDay: null,      // dateKey
      selectedSlot: null,     // { startISO, endISO }
      bookingResult: null,    // server response
      alert:      null,       // { kind: 'error'|'info', message }
      submitting: false,
    };

    // ── Agent-driven booking state ──────────────────────────────────────────
    // _agentPrefill: values supplied by Paula to pre-populate the form.
    // _userDirty: tracks which fields the caller has typed into manually.
    //   A dirty field is NEVER overwritten by the agent (caller's keystrokes win).
    // _pendingSlot: slot ISO the agent requested before availability was loaded;
    //   applied automatically in loadAvailability once slots arrive.
    // _pendingDayTime: a { day, time } natural request that arrived before
    //   availability was loaded; matched + applied once slots arrive (mirrors
    //   _pendingSlot's deferral path).
    // _pendingShowDate: a bare day string the agent asked to OPEN (showDate)
    // before availability was loaded; matched + applied once slots arrive
    // (mirrors _pendingSlot / _pendingDayTime's deferral path). Unlike those
    // two, applying it never advances past DATE_PICK — see _applyShowDate.
    var _agentPrefill = { name: '', email: '', phone: '', notes: '' };
    var _userDirty    = { name: false, email: false, phone: false, notes: false };
    // Cloudflare Turnstile (bot mitigation on the booking write). Site key is public.
    // The widget is rendered into the details form; its token rides on /booking/create
    // and is verified server-side. Enforcement is NOT optional: /booking/create refuses
    // a booking without a valid token, and refuses ALL bookings (503) if the server's
    // TURNSTILE_SECRET_KEY is unset. This mount is therefore load-bearing, not additive.
    var TURNSTILE_SITEKEY = '0x4AAAAAAD3X3AEk_IbefC4I';
    var _tsWidgetId = null; // id of the currently-rendered Turnstile widget (details form)
    var _pendingSlot  = null; // ISO string | null
    var _pendingDayTime = null; // { day, time } | null
    var _pendingShowDate = null; // day string | null

    // ── Live region for screen-reader announcements ─────────────────────────
    var liveRegion = document.createElement('div');
    liveRegion.setAttribute('role', 'status');
    liveRegion.setAttribute('aria-live', 'polite');
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
    document.body.appendChild(liveRegion);

    function announce(msg) {
      liveRegion.textContent = '';
      // Small delay so screen readers catch the change
      setTimeout(function () { liveRegion.textContent = msg; }, 50);
    }

    // ── Render dispatcher ───────────────────────────────────────────────────
    function render() {
      container.className = 'dl-booking';
      switch (state.step) {
        case 'LOADING':     renderLoading();    break;
        case 'TYPE_PICK':   renderTypePick();   break;
        case 'DATE_PICK':   renderDatePick();   break;
        case 'FORM':        renderForm();       break;
        case 'SUBMITTING':  renderSubmitting(); break;
        case 'CONFIRMED':   renderConfirmed();  break;
        default:            renderLoading();
      }
    }

    // ── Alert HTML ──────────────────────────────────────────────────────────
    function alertHTML() {
      if (!state.alert) return '';
      var cls = state.alert.kind === 'error' ? 'dl-bk-alert-error' : 'dl-bk-alert-info';
      return '<div class="dl-bk-alert ' + cls + '" role="alert">' + esc(state.alert.message) + '</div>';
    }

    // ── LOADING ─────────────────────────────────────────────────────────────
    function renderLoading() {
      container.innerHTML = [
        '<div aria-label="' + esc(STRINGS.loading) + '" role="status">',
        '<div class="dl-bk-skeleton" style="width:40%;height:1rem;"></div>',
        '<div class="dl-bk-skeleton" style="width:100%;height:3rem;margin-top:.5rem;"></div>',
        '<div class="dl-bk-skeleton" style="width:100%;height:3rem;margin-top:.5rem;"></div>',
        '<div class="dl-bk-skeleton" style="width:100%;height:3rem;margin-top:.5rem;"></div>',
        '</div>',
      ].join('');
    }

    // ── TYPE_PICK ───────────────────────────────────────────────────────────
    function renderTypePick() {
      var html = [
        '<p class="dl-bk-step-label">' + esc(STRINGS.stepType) + '</p>',
        alertHTML(),
        '<ul class="dl-bk-type-list" role="list">',
      ];
      state.types.forEach(function (t, idx) {
        html.push(
          '<li>',
          '<button class="dl-bk-type-btn" data-idx="' + idx + '"',
          ' aria-label="' + esc(t.name) + ', ' + esc(STRINGS.durationLabel(t.duration_min)) + '">',
          '<span class="dl-bk-type-name">' + esc(t.name) + '</span>',
          '<span class="dl-bk-type-dur">' + esc(STRINGS.durationLabel(t.duration_min)) + '</span>',
          '</button>',
          '</li>'
        );
      });
      html.push('</ul>');
      container.innerHTML = html.join('');

      // Bind type buttons
      var btns = container.querySelectorAll('.dl-bk-type-btn');
      btns.forEach(function (btn) {
        btn.addEventListener('click', function () {
          var idx = parseInt(btn.getAttribute('data-idx'), 10);
          state.selectedType = state.types[idx];
          loadAvailability();
        });
      });
      focusFirst(container);
    }

    // ── DATE_PICK ────────────────────────────────────────────────────────────
    function renderDatePick() {
      if (state.dayKeys.length === 0) {
        container.innerHTML = [
          '<p class="dl-bk-step-label">' + esc(STRINGS.stepDate) + '</p>',
          alertHTML(),
          '<p class="dl-bk-no-slots">' + esc(STRINGS.noDays) + '</p>',
          '<div class="dl-bk-btn-row">',
          state.types.length > 1
            ? '<button class="dl-bk-btn-back" id="dl-bk-back">' + esc(STRINGS.back) + '</button>'
            : '',
          '</div>',
        ].join('');
        bindBack();
        return;
      }

      var html = [
        '<p class="dl-bk-step-label">' + esc(STRINGS.stepDate) + '</p>',
        alertHTML(),
        '<div class="dl-bk-date-strip" role="list" aria-label="' + esc(STRINGS.stepDate) + '">',
      ];

      state.dayKeys.forEach(function (key) {
        var df = formatDateKey(key, tz);
        var selected = key === state.selectedDay ? ' selected' : '';
        var ariaPressed = key === state.selectedDay ? 'true' : 'false';
        html.push(
          '<button class="dl-bk-date-btn' + selected + '" role="listitem"',
          ' data-key="' + esc(key) + '"',
          ' aria-pressed="' + ariaPressed + '"',
          ' aria-label="' + esc(df.wd + ' ' + df.d + ' ' + df.mo) + '">',
          '<span class="dl-bk-date-wd">' + esc(df.wd) + '</span>',
          '<span class="dl-bk-date-d">' + esc(df.d) + '</span>',
          '<span class="dl-bk-date-mo">' + esc(df.mo) + '</span>',
          '</button>'
        );
      });

      html.push('</div>');

      // Time slots section (shown when a day is selected)
      if (state.selectedDay) {
        var daySlots = state.slotsByDay[state.selectedDay] || [];
        html.push(
          '<hr class="dl-bk-sep">',
          '<p class="dl-bk-step-label">' + esc(STRINGS.stepTime) + '</p>',
          '<p class="dl-bk-tz-note">' + esc(STRINGS.tzLabel(tzName)) + '</p>'
        );
        if (daySlots.length === 0) {
          html.push('<p class="dl-bk-no-slots">' + esc(STRINGS.noSlots) + '</p>');
        } else {
          html.push('<div class="dl-bk-slots" role="list" aria-label="' + esc(STRINGS.stepTime) + '">');
          daySlots.forEach(function (slot, idx) {
            var label = formatSlotTime(slot.startISO, tz);
            var sel = (state.selectedSlot && state.selectedSlot.startISO === slot.startISO) ? ' selected' : '';
            var ariaP = sel ? 'true' : 'false';
            html.push(
              '<button class="dl-bk-slot-btn' + sel + '" role="listitem"',
              ' data-idx="' + idx + '"',
              ' aria-pressed="' + ariaP + '"',
              ' aria-label="' + esc(label) + '">',
              esc(label),
              '</button>'
            );
          });
          html.push('</div>');
        }
      }

      // Back + Next
      html.push('<div class="dl-bk-btn-row" style="margin-top:1.5rem;">');
      if (state.types.length > 1) {
        html.push('<button class="dl-bk-btn-back" id="dl-bk-back">' + esc(STRINGS.back) + '</button>');
      }
      if (state.selectedSlot) {
        html.push('<button class="dl-bk-btn-primary" id="dl-bk-next">' + esc(STRINGS.next) + '</button>');
      }
      html.push('</div>');

      container.innerHTML = html.join('');

      // Scroll the horizontal date strip so the selected date lands near the LEFT
      // edge, with the days that follow trailing to its right — the "jump me to
      // August, here's what's after" reading. Critical when Paula opens a date the
      // caller can't see yet ("beginning of August"); otherwise the strip stays on
      // today and they'd have to drag it right. Scrolls ONLY the strip's own
      // overflow (scrollLeft) — it never moves the page or the calendar frame.
      if (state.selectedDay) {
        var selBtn = container.querySelector('.dl-bk-date-btn.selected');
        var strip = container.querySelector('.dl-bk-date-strip');
        if (selBtn && strip) {
          try {
            var sRect = strip.getBoundingClientRect();
            var bRect = selBtn.getBoundingClientRect();
            // bring the selected button's left edge to the strip's left edge, keeping
            // ~one date of lead-in before it so it doesn't sit flush against the edge.
            strip.scrollLeft += (bRect.left - sRect.left) - bRect.width;
          } catch (e) {}
        }
      }

      // Bind date buttons
      container.querySelectorAll('.dl-bk-date-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var key = btn.getAttribute('data-key');
          state.selectedDay = key;
          state.selectedSlot = null;
          render();
          // After re-render, scroll the time slots into view gently
          var slotsEl = container.querySelector('.dl-bk-slots');
          if (slotsEl) {
            try { slotsEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch(e) {}
          }
          announce(STRINGS.stepTime);
        });
      });

      // Bind time-slot buttons
      //
      // ── JORDAN-BOOKING-WIDGET-DETAILS-R1 ────────────────────────────────────
      // A valid slot selection ADVANCES TO THE DETAILS STEP, on the first click.
      //
      // It used to set `state.selectedSlot`, re-render DATE_PICK, and stop —
      // leaving `state.step` on DATE_PICK and the details form unrendered. The
      // only way forward was a second, separate press of `#dl-bk-next`, which
      // that same re-render had just created at the bottom of the widget. The
      // screen the caller was looking at still said "Select a date" / "Select a
      // time"; the slot they had tapped turned green and nothing else changed.
      //
      // That reads as "my tap didn't register", so callers re-tap the slot — and
      // a re-tap was a pure no-op, because selecting the already-selected slot
      // re-rendered the same DATE_PICK screen again. On a voice-assisted booking,
      // where Paula has just confirmed the time out loud, the caller is looking
      // for the details screen; they never got one, re-picked, and the call ended
      // Unsuccessful. That is the reported defect.
      //
      // The deeper problem was that the widget held TWO definitions of "a slot
      // was selected". Paula's path (`DLBooking.selectSlot` → `_applySlot`) set
      // `step = 'FORM'` and rendered the details; the caller's own click did not.
      // The same act advanced the widget for one driver and not the other. So the
      // click now goes through `_applySlot` — the SAME function Paula's path uses
      // — rather than getting a second, subtly different implementation. One
      // definition, both drivers.
      //
      // `_applySlot` matches by INSTANT and re-derives `selectedDay` from the
      // matched slot, so it cannot select a slot the widget does not actually
      // hold; a click whose slot has gone missing leaves the step where it is
      // rather than advancing to a details screen for nothing.
      if (state.selectedDay) {
        var daySlotsList = state.slotsByDay[state.selectedDay] || [];
        container.querySelectorAll('.dl-bk-slot-btn').forEach(function (btn) {
          btn.addEventListener('click', function () {
            var idx = parseInt(btn.getAttribute('data-idx'), 10);
            var slot = daySlotsList[idx];
            if (!slot || !slot.startISO) return;
            _applySlot(slot.startISO); // sets step = 'FORM', renders, moves focus
          });
        });
      }

      // Back
      bindBack();

      // Next
      var nextBtn = container.querySelector('#dl-bk-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', function () {
          state.step = 'FORM';
          state.alert = null;
          render();
          focusFirst(container);
        });
      }

      if (!state.selectedDay) focusFirst(container);
    }

    // ── FORM ─────────────────────────────────────────────────────────────────
    function renderForm() {
      var slotLabel = state.selectedSlot ? formatSlotFull(state.selectedSlot.startISO, tz) : '';
      var typeLabel = state.selectedType ? state.selectedType.name : '';

      var html = [
        '<p class="dl-bk-step-label">' + esc(STRINGS.stepForm) + '</p>',
        alertHTML(),
        state.selectedSlot
          ? '<p style="font-size:.9rem;margin-bottom:1.25rem;line-height:1.5;">'
            + '<strong>' + esc(typeLabel) + '</strong><br>'
            + '<span style="color:var(--dl-green);font-weight:600;">' + esc(slotLabel) + '</span>'
            + '</p>'
          : '',
        '<form class="dl-bk-form" id="dl-bk-form" novalidate autocomplete="on">',

        // Honeypot field — bots fill this in; real users don't see it
        '<div class="dl-bk-hp" aria-hidden="true">',
        '<label for="dl-bk-hp-field">Leave this blank</label>',
        '<input type="text" id="dl-bk-hp-field" name="website" tabindex="-1" autocomplete="off">',
        '</div>',

        // Name
        '<div class="dl-bk-field">',
        '<label class="dl-bk-label" for="dl-bk-name">' + esc(STRINGS.labelName) + ' <span aria-hidden="true">*</span></label>',
        '<input class="dl-bk-input" id="dl-bk-name" name="name" type="text"',
        ' placeholder="' + esc(STRINGS.placeholderName) + '"',
        ' autocomplete="name" required aria-required="true">',
        '<span class="dl-bk-field-err" id="dl-bk-name-err" role="alert" aria-live="assertive"></span>',
        '</div>',

        // Email
        '<div class="dl-bk-field">',
        '<label class="dl-bk-label" for="dl-bk-email">' + esc(STRINGS.labelEmail) + ' <span aria-hidden="true">*</span></label>',
        '<input class="dl-bk-input" id="dl-bk-email" name="email" type="email"',
        ' placeholder="' + esc(STRINGS.placeholderEmail) + '"',
        ' autocomplete="email" required aria-required="true">',
        '<span class="dl-bk-field-err" id="dl-bk-email-err" role="alert" aria-live="assertive"></span>',
        '</div>',

        // Phone
        '<div class="dl-bk-field">',
        '<label class="dl-bk-label" for="dl-bk-phone">' + esc(STRINGS.labelPhone) + ' <span aria-hidden="true">*</span></label>',
        '<input class="dl-bk-input" id="dl-bk-phone" name="phone" type="tel"',
        ' placeholder="' + esc(STRINGS.placeholderPhone) + '"',
        ' autocomplete="tel" required aria-required="true">',
        '<span class="dl-bk-field-err" id="dl-bk-phone-err" role="alert" aria-live="assertive"></span>',
        '</div>',

        // Notes
        '<div class="dl-bk-field">',
        '<label class="dl-bk-label" for="dl-bk-notes">' + esc(STRINGS.labelNotes) + '</label>',
        '<textarea class="dl-bk-input" id="dl-bk-notes" name="notes" rows="3"',
        ' placeholder="' + esc(STRINGS.placeholderNotes) + '"',
        ' aria-describedby="dl-bk-notes-hint"></textarea>',
        '<span class="dl-bk-notice" id="dl-bk-notes-hint">' + esc(STRINGS.noticeNoConfidential) + '</span>',
        '</div>',

        // Turnstile mount point — rendered explicitly after innerHTML (see below).
        '<div class="dl-bk-field" id="dl-bk-turnstile"></div>',

        '<div class="dl-bk-btn-row">',
        '<button class="dl-bk-btn-back" type="button" id="dl-bk-back">' + esc(STRINGS.back) + '</button>',
        '<button class="dl-bk-btn-primary" type="submit" id="dl-bk-submit">' + esc(STRINGS.confirm) + '</button>',
        '</div>',

        '</form>',
      ];

      container.innerHTML = html.join('');

      // Populate agent-prefilled values (only non-dirty fields).
      // Agents fill; callers confirm — no field is overwritten after the caller types.
      var nameEl  = container.querySelector('#dl-bk-name');
      var emailEl = container.querySelector('#dl-bk-email');
      var phoneEl = container.querySelector('#dl-bk-phone');
      var notesEl = container.querySelector('#dl-bk-notes');
      if (nameEl  && _agentPrefill.name  && !_userDirty.name)  { nameEl.value  = _agentPrefill.name;  }
      if (emailEl && _agentPrefill.email && !_userDirty.email) { emailEl.value = _agentPrefill.email; }
      if (phoneEl && _agentPrefill.phone && !_userDirty.phone) { phoneEl.value = _agentPrefill.phone; }
      if (notesEl && _agentPrefill.notes && !_userDirty.notes) { notesEl.value = _agentPrefill.notes; }

      // Mark a field as user-dirty on any input event (not on programmatic .value= assignment).
      function markDirty(field, el) {
        if (!el) return;
        el.addEventListener('input', function () { _userDirty[field] = true; }, { once: true });
      }
      markDirty('name',  nameEl);
      markDirty('email', emailEl);
      markDirty('phone', phoneEl);
      markDirty('notes', notesEl);

      // Turnstile — render into the mount point. The api.js script is async, so it
      // may not be ready the instant the form paints; retry briefly until it is.
      // If it never loads, the token is empty and the server rejects the booking with
      // 403 TURNSTILE_REQUIRED (see /booking/create) — the caller sees the generic
      // error and can retry. Fail-closed by design: no token, no calendar write.
      _tsWidgetId = null;
      (function mountTurnstile(tries) {
        var mount = container.querySelector('#dl-bk-turnstile');
        if (!mount) return;
        if (window.turnstile && typeof window.turnstile.render === 'function') {
          try {
            _tsWidgetId = window.turnstile.render(mount, { sitekey: TURNSTILE_SITEKEY });
          } catch (e) { /* already rendered / transient — ignore */ }
        } else if (tries < 40) {
          setTimeout(function () { mountTurnstile(tries + 1); }, 150);
        }
      })(0);

      // Back
      bindBack(function () {
        state.step = 'DATE_PICK';
        state.alert = null;
        render();
        focusFirst(container);
      });

      // Form submit
      var form = container.querySelector('#dl-bk-form');
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        handleFormSubmit(form);
      });

      focusFirst(container);
    }

    function handleFormSubmit(form) {
      // Honeypot check — if filled, silently abort (bot)
      var hp = form.querySelector('#dl-bk-hp-field');
      if (hp && hp.value) return;

      var nameEl  = form.querySelector('#dl-bk-name');
      var emailEl = form.querySelector('#dl-bk-email');
      var phoneEl = form.querySelector('#dl-bk-phone');
      var notesEl = form.querySelector('#dl-bk-notes');
      var submitBtn = form.querySelector('#dl-bk-submit');

      var name  = (nameEl.value  || '').trim();
      var email = (emailEl.value || '').trim();
      var phone = (phoneEl.value || '').trim();
      var notes = (notesEl.value || '').trim();

      // Clear previous errors
      ['name','email','phone'].forEach(function (f) {
        var inp = form.querySelector('#dl-bk-' + f);
        var err = form.querySelector('#dl-bk-' + f + '-err');
        if (inp) inp.classList.remove('invalid');
        if (err) err.textContent = '';
      });

      var valid = true;

      function fieldErr(field, msg) {
        var inp = form.querySelector('#dl-bk-' + field);
        var err = form.querySelector('#dl-bk-' + field + '-err');
        if (inp) inp.classList.add('invalid');
        if (err) err.textContent = msg;
        valid = false;
      }

      if (!name) fieldErr('name', STRINGS.errorRequired);
      if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fieldErr('email', STRINGS.errorEmail);
      if (!phone || phone.length < 7) fieldErr('phone', STRINGS.errorPhone);

      if (!valid) {
        // Focus the first invalid field
        var firstInvalid = form.querySelector('.invalid');
        if (firstInvalid) firstInvalid.focus();
        return;
      }

      // Disable submit to prevent double-submit
      submitBtn.disabled = true;
      submitBtn.textContent = STRINGS.submitting;

      var idempKey = uuid4();
      var payload = {
        deployment: deployment,
        type:  state.selectedType ? state.selectedType.id : '',
        slot:  state.selectedSlot ? state.selectedSlot.startISO : '',
        name:  name,
        email: email,
        phone: phone,
        notes: notes,
        // Perch voice-call id (set via the setCallId bridge). Lets the backend
        // fold the caller's qualifier answers into the Clio description + Grow
        // lead server-side. Absent for a plain web booking — harmless.
        call_id: (window.__perchCallId || undefined),
        // The negative of the line above, and it is NOT redundant with it. An
        // absent call_id means "no key in page memory", which the backend answers
        // by recovering one from the dl_qual cookie (#153). This says "this booking
        // claims NO qualifier record at all" — set by js/perch-layer.js only when
        // the visitor opened the qualifier card and abandoned it, and the one thing
        // that stops the cookie handing them the PREVIOUS visitor's answers on a
        // shared browser. Carries no id and no answer; the backend can only ever
        // withhold on it. Absent for every other booking — harmless.
        qualifier_claim: (window.__perchQualifierClaim || undefined),
        // Cloudflare Turnstile token — verified server-side before any Clio write.
        turnstile_token: (window.turnstile && _tsWidgetId != null) ? (window.turnstile.getResponse(_tsWidgetId) || '') : '',
      };

      // No PII in logs — we intentionally log only the booking shape without contact fields.
      state.step = 'SUBMITTING';
      state.submitting = true;
      render();

      postCreate(apiBase, payload, idempKey)
        .then(function (resp) {
          state.submitting = false;
          // Success = the appointment was CONFIRMED at the provider. A 207
          // PARTIAL_FAILURE (confirmed:true but our record-write failed) is still
          // a real booking for the caller — treating it as an error here would
          // make them re-book and double-book. Provider truth wins.
          if (resp.status === 201 || (resp.data && (resp.data.ok || resp.data.confirmed === true))) {
            state.bookingResult = resp.data;
            state.step = 'CONFIRMED';
            state.alert = null;
            render();
            announce(STRINGS.confirmTitle + '. ' + STRINGS.confirmEmail);
            // ── ENHANCED CONVERSIONS (2026-09-03) ──────────────────────────────
            // Google Ads has enhanced conversions ON for the manager account,
            // method "Google tag". The tag only benefits if it is HANDED the
            // contact data before the conversion event fires, and this is the one
            // place in the browser that holds it: the booking the visitor just
            // made. `gtag('set', 'user_data', ...)` attaches it to every later
            // event in this document; the tracker's `conversion` for
            // booking_confirmed (js/analytics/tracker.js, on the postMessage
            // below) is the one that matters. Google hashes in the browser.
            // Consent Mode governs it: with `ad_user_data` denied, gtag drops the
            // field, so an EEA visitor who did not accept sends none. The
            // message below still carries no PII -- this does not ride on it.
            try { setEnhancedConversionData(window, payload); } catch (ecErr) { /* never break a confirmed booking */ }
            // Tell the Perch shell the booking is in — it forwards to the bridge so
            // Paula (get_booking_result) can give a warm goodbye and end the call.
            try {
              window.parent.postMessage({
                __perchBooking: 'confirmed',
                slotISO: state.selectedSlot ? state.selectedSlot.startISO : null,
                // SHELDON-CALLMAP-AND-CALLID task 4 — the id this booking was
                // actually made under, carried on the message instead of left for
                // the listener to re-derive.
                //
                // `js/perch/command-channel.js` forwards this confirmation to
                // /fn/booking_confirmed and had exactly one source for the call id:
                // `curCall`, set only by `channel.start()`, which only a LIVE voice
                // call calls. Every other route to a confirmed booking left it null
                // and the POST went out with no call_id, so the endpoint answered
                // MISSING_CALL_ID and the booked flag Paula reads was never written
                // — the no-voice qualifier path (#158), which sets `__perchCallId`
                // through `set_call_id` and never starts a channel, and any
                // confirmation arriving on a document that did not host the call.
                //
                // `payload.call_id` is the value that was JUST sent to
                // /booking/create, so the flag and the booking name the same
                // session by construction rather than by two globals agreeing.
                // Undefined for a plain web booking — unchanged, and the endpoint's
                // refusal is correct there: there is no call to flag.
                //
                // Same-origin only (targetOrigin is `location.origin`), to the same
                // listener that already receives this message. It carries no PII;
                // the id is the bridge's bearer credential and it travels no
                // further than the two listeners in this document.
                call_id: payload.call_id || undefined,
              }, location.origin);
            } catch (e) {}
          } else if (resp.status === 409 || (resp.data && resp.data.code === 'SLOT_TAKEN')) {
            // Slot taken — refresh availability and show friendly message
            state.step = 'DATE_PICK';
            state.selectedSlot = null;
            state.alert = { kind: 'info', message: STRINGS.errorSlotTaken };
            loadAvailability(true);
          } else {
            // Generic API error
            state.step = 'FORM';
            state.alert = {
              kind: 'error',
              message: (resp.data && resp.data.error) ? resp.data.error : STRINGS.errorGeneric,
            };
            render();
            focusFirst(container);
          }
        })
        .catch(function () {
          state.submitting = false;
          state.step = 'FORM';
          state.alert = { kind: 'error', message: STRINGS.errorNetwork };
          render();
          focusFirst(container);
        });
    }

    // ── SUBMITTING ──────────────────────────────────────────────────────────
    function renderSubmitting() {
      container.innerHTML = [
        '<div role="status" aria-label="' + esc(STRINGS.submitting) + '" style="text-align:center;padding:2.5rem 1rem;">',
        '<div class="dl-bk-skeleton" style="width:60%;height:1.2rem;margin:0 auto .75rem;"></div>',
        '<div class="dl-bk-skeleton" style="width:80%;height:1rem;margin:0 auto .5rem;"></div>',
        '<div class="dl-bk-skeleton" style="width:50%;height:1rem;margin:0 auto;"></div>',
        '</div>',
      ].join('');
    }

    // ── CONFIRMED ───────────────────────────────────────────────────────────
    function renderConfirmed() {
      var slotLabel = state.selectedSlot ? formatSlotFull(state.selectedSlot.startISO, tz) : '';
      container.innerHTML = [
        '<div class="dl-bk-confirm">',
        '<div class="dl-bk-confirm-icon" aria-hidden="true">&#10003;</div>',
        '<h3>' + esc(STRINGS.confirmTitle) + '</h3>',
        '<p class="dl-bk-confirm-slot">' + esc(slotLabel) + '</p>',
        '<p class="dl-bk-confirm-email">' + esc(STRINGS.confirmEmail) + '</p>',
        '<button class="dl-bk-restart" id="dl-bk-restart">',
        esc(STRINGS.confirmAnotherLink),
        '</button>',
        '</div>',
      ].join('');

      var restartBtn = container.querySelector('#dl-bk-restart');
      if (restartBtn) {
        restartBtn.addEventListener('click', function () {
          // Reset to beginning
          state.step = 'LOADING';
          state.selectedType = null;
          state.selectedDay = null;
          state.selectedSlot = null;
          state.slots = [];
          state.slotsByDay = {};
          state.dayKeys = [];
          state.bookingResult = null;
          state.alert = null;
          render();
          loadTypes();
        });
        restartBtn.focus();
      }
    }

    // ── Back button utility ─────────────────────────────────────────────────
    function bindBack(customHandler) {
      var backBtn = container.querySelector('#dl-bk-back');
      if (!backBtn) return;
      backBtn.addEventListener('click', function () {
        if (customHandler) { customHandler(); return; }
        // Default back from DATE_PICK → TYPE_PICK (if >1 type)
        if (state.types.length > 1) {
          state.step = 'TYPE_PICK';
          state.selectedSlot = null;
          state.selectedDay = null;
          state.alert = null;
          render();
          focusFirst(container);
        }
      });
    }

    // ── Data loading ────────────────────────────────────────────────────────
    function loadTypes() {
      state.step = 'LOADING';
      render();
      fetchTypes(apiBase, deployment)
        .then(function (data) {
          state.types = data.types || [];
          if (state.types.length === 0) {
            state.alert = { kind: 'error', message: STRINGS.errorLoad };
            state.step = 'TYPE_PICK'; // render empty with error
            render();
            return;
          }
          // If preType matches, auto-select it
          if (preType) {
            var found = null;
            for (var i = 0; i < state.types.length; i++) {
              if (state.types[i].id === preType) { found = state.types[i]; break; }
            }
            if (found) {
              state.selectedType = found;
              loadAvailability();
              return;
            }
          }
          // If only one type, skip the picker
          if (state.types.length === 1) {
            state.selectedType = state.types[0];
            loadAvailability();
            return;
          }
          state.step = 'TYPE_PICK';
          render();
          focusFirst(container);
        })
        .catch(function () {
          state.alert = { kind: 'error', message: STRINGS.errorLoad };
          container.innerHTML = [
            '<div class="dl-bk-alert dl-bk-alert-error" role="alert">',
            esc(STRINGS.errorLoad),
            '</div>',
            '<div class="dl-bk-btn-row">',
            '<button class="dl-bk-btn-primary" id="dl-bk-retry">' + esc('Try again') + '</button>',
            '</div>',
          ].join('');
          var retryBtn = container.querySelector('#dl-bk-retry');
          if (retryBtn) retryBtn.addEventListener('click', loadTypes);
          announce(STRINGS.errorLoad);
        });
    }

    function loadAvailability(keepAlert) {
      if (!keepAlert) state.alert = null;
      state.step = 'LOADING';
      render();
      var typeId = state.selectedType ? state.selectedType.id : '';
      fetchAvailability(apiBase, deployment, typeId, tz)
        .then(function (data) {
          state.slots = data.slots || [];
          state.slotsByDay = groupSlotsByDay(state.slots, tz);
          state.dayKeys = Object.keys(state.slotsByDay).sort();
          // Auto-select first available day
          state.selectedDay = state.dayKeys.length > 0 ? state.dayKeys[0] : null;
          state.selectedSlot = null;
          state.step = 'DATE_PICK';

          // If the agent called selectSlot before availability was loaded, apply
          // the deferred slot now that we have the full slot list.
          if (_pendingSlot) {
            var iso = _pendingSlot;
            _pendingSlot = null;
            _applySlot(iso); // may advance step to FORM; calls render() internally
          } else if (_pendingDayTime) {
            var dt = _pendingDayTime;
            _pendingDayTime = null;
            _applyDayTime(dt.day, dt.time); // may advance step to FORM; calls render() internally
          } else if (_pendingShowDate) {
            var sd = _pendingShowDate;
            _pendingShowDate = null;
            _applyShowDate(sd); // stays on DATE_PICK; calls render() internally
          } else {
            render();
            focusFirst(container);
          }
        })
        .catch(function () {
          state.alert = { kind: 'error', message: STRINGS.errorLoad };
          state.step = state.types.length > 1 ? 'TYPE_PICK' : 'DATE_PICK';
          state.slots = [];
          state.slotsByDay = {};
          state.dayKeys = [];
          render();
          announce(STRINGS.errorLoad);
        });
    }

    // ── _applySlot: select a slot by ISO and advance to FORM ───────────────
    // Shared logic used by DLBooking.selectSlot and the _pendingSlot deferred path.
    // Returns { ok: true } on success, { ok: false, reason } on failure.
    function _applySlot(startISO) {
      // Match by INSTANT, not raw string: an agent-supplied ISO may be a
      // different valid representation of the same moment (…09:00:00.000Z vs
      // …09:00:00Z vs an offset form like …05:00:00-04:00). Exact string
      // equality would spuriously reject a real slot.
      var wantMs = Date.parse(startISO);
      if (isNaN(wantMs)) return { ok: false, reason: 'bad_iso' };
      for (var di = 0; di < state.dayKeys.length; di++) {
        var dk = state.dayKeys[di];
        var daySlots = state.slotsByDay[dk] || [];
        for (var si = 0; si < daySlots.length; si++) {
          if (Date.parse(daySlots[si].startISO) === wantMs) {
            state.selectedDay  = dk;
            state.selectedSlot = daySlots[si];
            state.step = 'FORM';
            state.alert = null;
            render();
            focusFirst(container);
            return { ok: true };
          }
        }
      }
      return { ok: false, reason: 'slot_not_found' };
    }

    // ── _applyDayTime: match a natural day+time request and apply it ───────
    // Shared logic used by DLBooking.selectSlot({day,time}) and the
    // _pendingDayTime deferred path. Delegates the actual matching to the
    // pure matchSlotByDayTime() (tz-correct — see its doc comment above),
    // then reuses _applySlot() to select + advance to FORM.
    // Returns { ok: true } on success, { ok: false, reason: 'slot_not_found' }
    // on no match (or genuine am/pm ambiguity — matchSlotByDayTime returns
    // null in both cases, by design: predictable over clever).
    function _applyDayTime(dayStr, timeStr) {
      // Resolve the target day with the flexible parser (handles "the first
      // Monday of August" etc.), and fall back to the day already OPEN on screen
      // — the caller typically opens a date, then just says a time on it. Then
      // match the time WITHIN that day's slots. This fixes the class of bug where
      // a fuzzy day phrase parsed to a slotless date and the time never selected.
      var dayKey = resolveSpokenDay(state.dayKeys, tz, dayStr) || state.selectedDay;
      var pool = (dayKey && state.slotsByDay[dayKey]) ? state.slotsByDay[dayKey] : state.slots;
      var iso = matchSlotByDayTime(pool, tz, null, timeStr); // time-only within the chosen day
      if (!iso) return { ok: false, reason: 'slot_not_found' };
      return _applySlot(iso);
    }

    // ── _applyShowDate: OPEN a date (reveal its times) without selecting ───
    // a slot and WITHOUT advancing past DATE_PICK. This is the "browse, then
    // pick" path: the caller (via Paula) names a day; the widget highlights
    // that date and shows its time buttons; the caller picks a time
    // themselves (or asks Paula to pick one, which then goes through
    // selectSlot/_applyDayTime as usual). Delegates day resolution to the
    // pure matchDayInDayKeys() (tz-correct — see its doc comment above).
    // Returns { ok: true } on success, { ok: false, reason: 'date_unavailable' }
    // if the day isn't parseable, isn't in the loaded range, is ambiguous,
    // or has no open slots.
    function _applyShowDate(dayStr) {
      var key = resolveSpokenDay(state.dayKeys, tz, dayStr);
      if (!key) return { ok: false, reason: 'date_unavailable' };
      var daySlots = state.slotsByDay[key] || [];
      if (daySlots.length === 0) return { ok: false, reason: 'date_unavailable' };
      state.selectedDay = key;
      // Deliberately do NOT touch state.selectedSlot here — if the caller had
      // already picked a slot on a different day and just wants to browse
      // another date first, we don't want to silently clear that choice.
      // (Matches the semantics of the date-strip click handler otherwise
      // clearing selectedSlot only because it's changing days; showDate's
      // whole point is "look, don't commit" so we leave prior selection be
      // unless it belonged to a different day — the render only shows the
      // Next button when selectedSlot's day still lines up with what's on
      // screen, so no stale-looking selected slot is displayed.)
      if (state.selectedSlot) {
        var stillOnThisDay = daySlots.some(function (s) {
          return state.selectedSlot && s.startISO === state.selectedSlot.startISO;
        });
        if (!stillOnThisDay) state.selectedSlot = null;
      }
      state.step = 'DATE_PICK'; // explicit — never advance to FORM from showDate
      state.alert = null;
      render();
      return { ok: true };
    }

    // ── Agent API (registered with window.DLBooking after boot) ────────────
    //
    // TRUST / UX BOUNDARY: the agent fills fields and picks a slot; the caller
    // always presses "Confirm Appointment" to submit. Never auto-submit here.
    var _agentAPI = {
      prefill: function (fields) {
        if (!fields || typeof fields !== 'object') return;
        // Persist agent values; do not mark user-dirty (we're the agent, not the user).
        if (fields.name  !== undefined) { _agentPrefill.name  = String(fields.name  || ''); }
        if (fields.email !== undefined) { _agentPrefill.email = String(fields.email || ''); }
        if (fields.phone !== undefined) { _agentPrefill.phone = String(fields.phone || ''); }
        if (fields.notes !== undefined) { _agentPrefill.notes = String(fields.notes || ''); }
        // If the FORM step is already rendered, patch the DOM directly on non-dirty fields.
        if (state.step === 'FORM') {
          var nameEl  = container.querySelector('#dl-bk-name');
          var emailEl = container.querySelector('#dl-bk-email');
          var phoneEl = container.querySelector('#dl-bk-phone');
          var notesEl = container.querySelector('#dl-bk-notes');
          if (nameEl  && _agentPrefill.name  && !_userDirty.name)  { nameEl.value  = _agentPrefill.name;  }
          if (emailEl && _agentPrefill.email && !_userDirty.email) { emailEl.value = _agentPrefill.email; }
          if (phoneEl && _agentPrefill.phone && !_userDirty.phone) { phoneEl.value = _agentPrefill.phone; }
          if (notesEl && _agentPrefill.notes && !_userDirty.notes) { notesEl.value = _agentPrefill.notes; }
        }
        // Values persist into renderForm() whenever the widget reaches FORM.
      },

      selectType: function (typeId) {
        if (!typeId || state.step !== 'TYPE_PICK') return;
        for (var i = 0; i < state.types.length; i++) {
          if (state.types[i].id === typeId) {
            state.selectedType = state.types[i];
            loadAvailability();
            return;
          }
        }
        // typeId not found — silently no-op (agent may have stale type list)
      },

      // Accepts EITHER:
      //   (a) an ISO string startISO — back-compat, matched by instant.
      //   (b) an object { day, time } — natural day+time as a caller would
      //       say it (e.g. day:"July 10", time:"11 AM"), matched in the
      //       widget's DISPLAY timezone via matchSlotByDayTime().
      selectSlot: function (arg) {
        if (arg && typeof arg === 'object' && !Array.isArray(arg)) {
          var day  = arg.day  != null ? String(arg.day)  : '';
          var time = arg.time != null ? String(arg.time) : '';
          if (!time) return { ok: false, reason: 'invalid_time' };
          // If availability isn't loaded yet, defer until loadAvailability completes.
          if (state.step === 'LOADING' || state.slots.length === 0) {
            _pendingDayTime = { day: day, time: time };
            return { ok: true, deferred: true };
          }
          return _applyDayTime(day, time);
        }

        if (!arg || typeof arg !== 'string') {
          return { ok: false, reason: 'invalid_iso' };
        }
        // If availability isn't loaded yet, defer until loadAvailability completes.
        if (state.step === 'LOADING' || state.slots.length === 0) {
          _pendingSlot = arg;
          return { ok: true, deferred: true };
        }
        return _applySlot(arg);
      },

      // OPEN a specific date — reveal its time buttons WITHOUT selecting a
      // slot or advancing the step. Lets the caller browse a day's times and
      // then pick one themselves. Accepts a bare day string ("July 10",
      // "the 10th", "2026-07-10", "10") or { day: "..." }.
      showDate: function (arg) {
        var day = (arg && typeof arg === 'object' && !Array.isArray(arg))
          ? (arg.day != null ? String(arg.day) : '')
          : (arg != null ? String(arg) : '');
        if (!day) return { ok: false, reason: 'date_unavailable' };
        // If availability isn't loaded yet, defer until loadAvailability completes.
        if (state.step === 'LOADING' || state.dayKeys.length === 0) {
          _pendingShowDate = day;
          return { ok: true, deferred: true };
        }
        return _applyShowDate(day);
      },

      getState: function () {
        return {
          step: state.step,
          selectedSlot: state.selectedSlot || null,
          selectedDay: state.selectedDay || null,
          typesLoaded: state.types.length > 0,
          prefill: {
            name:  !!_agentPrefill.name,
            email: !!_agentPrefill.email,
            phone: !!_agentPrefill.phone,
            notes: !!_agentPrefill.notes,
          },
        };
      },

      // ── The A2.3 post-swap Turnstile seam (JORDAN-PERCH-A23, #53) ────────
      //
      // WHY A SEAM AND NOT A ROUTER-SIDE `turnstile.render()`: the token that
      // rides on /booking/create is read as `getResponse(_tsWidgetId)` (:1321),
      // and `_tsWidgetId` lives in THIS closure. A widget rendered from outside
      // would paint a perfectly good challenge whose id nobody here holds — the
      // token would still go out empty and the booking would still 403. So the
      // re-render has to happen where the id can be captured, and the router
      // calls in rather than reaching past.
      //
      // WHAT IT REPAIRS. `mountTurnstile` (:1228-1237) retries only while
      // `window.turnstile` is ABSENT. If `render()` THROWS — which is what a
      // fresh post-swap node hitting a registry that still holds the previous
      // generation's widget looks like — the catch swallows it, `_tsWidgetId`
      // stays null, and nothing ever tries again. The form stays submittable
      // and the write silently 403s TURNSTILE_REQUIRED. Reproduced in
      // test/perch-swup-router.test.mjs.
      //
      // THE DOUBLE-RENDER GUARD is the `_tsWidgetId != null && mount has a
      // child` branch: a widget that is genuinely alive on THIS node is
      // re-executed with `reset()` (a fresh token on the same widget), never
      // rendered a second time. Only a mount with no live widget is rendered.
      //
      // Nothing on the production path calls this. It is reached exclusively
      // from js/perch/reinit.js, which only loads when the router is active.
      remountTurnstile: function () {
        var mount = container.querySelector('#dl-bk-turnstile');
        // Not at the FORM step: there is no mount point yet, and the widget's
        // own render will run when the form paints. Nothing to repair.
        if (!mount) return { ok: false, reason: 'no_mount' };
        if (!window.turnstile || typeof window.turnstile.render !== 'function') {
          return { ok: false, reason: 'api_absent' };
        }

        // Already initialized on this exact node → re-execute, do not re-render.
        if (_tsWidgetId != null && mount.firstElementChild) {
          try {
            window.turnstile.reset(_tsWidgetId);
            return { ok: true, action: 'reset', id: String(_tsWidgetId) };
          } catch (e) { /* fall through and rebuild it cleanly */ }
        }

        // Otherwise the mount carries no live widget. Drop whatever the
        // registry still associates with this closure before rendering, so the
        // "already rendered" throw cannot come back on the retry.
        try { if (_tsWidgetId != null) window.turnstile.remove(_tsWidgetId); } catch (e) { /* orphan already gone */ }
        _tsWidgetId = null;
        mount.innerHTML = '';
        try {
          _tsWidgetId = window.turnstile.render(mount, { sitekey: TURNSTILE_SITEKEY });
          return { ok: _tsWidgetId != null, action: 'render', id: _tsWidgetId == null ? null : String(_tsWidgetId) };
        } catch (e) {
          return { ok: false, reason: 'render_threw', error: String(e) };
        }
      },
    };

    // ── Bootstrap ───────────────────────────────────────────────────────────
    render(); // show skeleton immediately
    loadTypes();

    // Register with the public API once the widget is alive. Queued calls
    // (prefill/selectSlot that arrived before DOMContentLoaded) replay here.
    // ORDERING: the DLBooking IIFE is defined BELOW this one in the file, so at
    // first boot window.DLBooking does not exist yet — stash the live API and
    // let the DLBooking block pick it up when it defines itself.
    if (window.DLBooking && typeof window.DLBooking._register === 'function') {
      window.DLBooking._register(_agentAPI);
    } else {
      window.__dlAgentAPIPending = _agentAPI;
    }
  }

  // ── Entry point ────────────────────────────────────────────────────────────
  // Called once the DOM is ready. Finds all .dl-booking / [id="dl-booking"] containers.
  function boot() {
    injectStyles();
    var containers = document.querySelectorAll('[data-api]');
    // Also check the conventional id
    var byId = document.getElementById('dl-booking');
    if (byId && !byId.hasAttribute('data-api-init')) {
      // If found by id but missing data-api, skip (must have data-api)
    }
    for (var i = 0; i < containers.length; i++) {
      var c = containers[i];
      if (c.hasAttribute('data-api-init')) continue; // already initialized
      c.setAttribute('data-api-init', '1');
      initWidget(c);
    }
  }

  // Boot only runs in a real DOM. In the Node unit-test context (see the
  // guarded export below) `document` does not exist — this file is loaded
  // there purely to extract the pure matcher/parser functions, never to
  // actually boot a widget. This guard is a no-op in every real browser.
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', boot);
    } else {
      boot();
    }

    // ── The A2.2 re-init seam (SHELDON-PERCH-A22, #52) ──────────────────────
    //
    // `DOMContentLoaded` fires once per DOCUMENT. Under the Swup router the
    // document never reloads, so a swap that brings a fresh `#dl-booking` into
    // `<main id="perch-main">` would find nothing to boot it —
    // RE-INIT-INVENTORY §3.2 / §5 row 5, and the reason the A2.5 spike's reveal
    // check had to assert `widgetBooted` and not just "the gate opened".
    //
    // Published on the widget's existing public control surface rather than as a
    // new global, so the router calls a documented API instead of reaching into
    // this closure. `Object.assign` because the DLBooking IIFE below runs AFTER
    // this one and would otherwise clobber the property.
    //
    // Safe to call on every swap, including swaps to pages with no widget:
    // `boot()` skips containers already carrying `[data-api-init]` (:1747) and
    // `injectStyles()` guards on `#dl-booking-styles` (:239). It touches no
    // booking state and performs no write — it is container discovery only.
    window.DLBooking = Object.assign(window.DLBooking || {}, { boot: boot });
  }

  // Guarded export for unit tests: only exposes the pure day/time parsing +
  // matching functions; does not affect browser loading (typeof process
  // is 'undefined' in a browser, so this branch never runs there). Same
  // pattern as sanitizeBookingArgs in functions/fn/do_page_action.js.
  if (typeof process !== 'undefined' && process.env && process.env.NODE_TEST_CONTEXT) {
    // eslint-disable-next-line no-undef
    module.exports = {
      parseDayString: parseDayString,
      parseTimeString: parseTimeString,
      timeToHour24Candidates: timeToHour24Candidates,
      slotLocalFields: slotLocalFields,
      matchSlotByDayTime: matchSlotByDayTime,
      matchDayInDayKeys: matchDayInDayKeys,
    };
  }
})();

// ── DLBooking public API ──────────────────────────────────────────────────────
//
// Namespaced widget control surface for Paula (the Retell voice agent) and the
// Perch shell. All calls from the outside world go through postMessage into this
// API; the widget's internal state machine (inside the IIFE above) is not directly
// reachable, so this object is the formal seam.
//
// TRUST / UX BOUNDARY — IMPORTANT:
//   The agent (Paula) may prefill form fields and select a slot on the caller's
//   behalf, but she NEVER submits the form. The human caller always presses the
//   "Confirm Appointment" button. This is a deliberate design choice: it keeps the
//   caller in control, prevents accidental double-booking, and preserves the legal
//   significance of the caller's affirmative act of scheduling.
//
// Usage (all methods are no-ops if the widget has not initialised yet — calls are
// queued and replayed once the widget calls DLBooking._register):
//   DLBooking.prefill({ name, email, phone, notes })
//   DLBooking.selectType(typeId)
//   DLBooking.selectSlot(startISO)              // back-compat: exact ISO instant
//   DLBooking.selectSlot({ day, time })          // natural: "July 10" + "11 AM"
//   DLBooking.showDate("July 10")                // OPEN a date; stays on DATE_PICK
//   DLBooking.getState()
//
(function () {
  'use strict';

  // Calls queued before the widget has registered itself.
  var _pending = [];
  // The live widget API registered by initWidget via DLBooking._register(api).
  var _api = null;

  function _dispatch(method, arg) {
    if (_api && typeof _api[method] === 'function') {
      return _api[method](arg);
    }
    // Widget not ready yet — queue the call for replay on registration.
    _pending.push({ method: method, arg: arg });
    return undefined;
  }

  // Object.assign, not a bare assignment: the boot IIFE above publishes
  // `DLBooking.boot` (the A2.2 re-init seam, #52) before this runs, and a
  // replacement would drop it — leaving the router with nothing to call and the
  // widget silently un-booted after a content swap.
  window.DLBooking = Object.assign(window.DLBooking || {}, {
    /**
     * Register the live widget instance. Called once from inside initWidget after
     * the first render. Replays any queued calls immediately in order.
     * @param {{ prefill, selectType, selectSlot, getState }} api
     */
    _register: function (api) {
      _api = api;
      var q = _pending.splice(0);
      for (var i = 0; i < q.length; i++) {
        _dispatch(q[i].method, q[i].arg);
      }
    },

    /**
     * Prefill the booking form fields.
     * Only overwrites fields the caller has NOT already typed into manually.
     * User-dirty tracking per field (name/email/phone/notes) is maintained inside
     * the widget; a field touched by the user will not be overwritten by the agent.
     * @param {{ name?: string, email?: string, phone?: string, notes?: string }} fields
     */
    prefill: function (fields) { return _dispatch('prefill', fields); },

    /**
     * Select an appointment type by its id.
     * Triggers availability load if the widget is at TYPE_PICK. No-op if the id
     * is unknown or if the widget is past that step.
     * @param {string} typeId
     */
    selectType: function (typeId) { return _dispatch('selectType', typeId); },

    /**
     * Select a slot, either by exact ISO instant (back-compat) or by a
     * natural day+time request as the caller (via Paula) would say it.
     * - If availability is loaded and a slot matches: selects the day + slot
     *   and advances the widget to FORM, then returns { ok: true }.
     * - If availability is not yet loaded: stores the target and applies it
     *   when loading completes, then returns { ok: true, deferred: true }.
     * - If no slot matches (wrong day, wrong time, or genuine am/pm
     *   ambiguity): returns { ok: false, reason: 'slot_not_found' }.
     *
     * The { day, time } form is matched in the widget's DISPLAY timezone
     * (the visitor's browser tz) — the same tz the times are shown in on
     * screen — via matchSlotByDayTime(). See that function's doc comment
     * for day/time parsing rules.
     *
     * @param {string | { day?: string, time: string }} arg
     *   e.g. "2026-07-10T14:00:00Z", or { day: "July 10", time: "11 AM" }
     * @returns {{ ok: boolean, reason?: string, deferred?: boolean } | undefined}
     */
    selectSlot: function (arg) { return _dispatch('selectSlot', arg); },

    /**
     * OPEN a specific date on the DATE_PICK step — reveals that day's time
     * buttons WITHOUT selecting a slot and WITHOUT advancing the step. Lets
     * the caller browse a day's availability and then pick a time
     * themselves (or ask Paula to pick one via selectSlot). The widget
     * REMAINS on DATE_PICK; it never auto-advances to FORM from this call.
     * - If availability is loaded and the day matches exactly one loaded
     *   date with open slots: highlights that date, returns { ok: true }.
     * - If availability is not yet loaded: defers and applies once loading
     *   completes, returns { ok: true, deferred: true }.
     * - If no match (wrong day, out of the loaded range, ambiguous, or the
     *   day has no open slots): returns { ok: false, reason: 'date_unavailable' },
     *   and the widget's current view is left unchanged.
     *
     * Day parsing/matching is tz-correct — matched against the widget's
     * DISPLAY timezone (data-tz / detected browser tz), the same tz the
     * date strip is rendered in — via matchDayInDayKeys().
     *
     * @param {string | { day: string }} arg
     *   e.g. "July 10", "the 10th", "2026-07-10", or { day: "July 10" }
     * @returns {{ ok: boolean, reason?: string, deferred?: boolean } | undefined}
     */
    showDate: function (arg) { return _dispatch('showDate', arg); },

    /**
     * Return a snapshot of current widget state for the agent's read-back.
     * @returns {{ step: string, selectedSlot: object|null, selectedDay: string|null,
     *             typesLoaded: boolean,
     *             prefill: { name: boolean, email: boolean, phone: boolean, notes: boolean } }}
     */
    getState: function () { return _dispatch('getState'); },

    /**
     * Re-render (or re-execute) the Turnstile widget on the CURRENT DOM.
     * The A2.3 post-swap seam — see the implementation's comment inside
     * initWidget for why the router cannot do this from the outside.
     *
     * NOT routed through `_dispatch`: the queue exists so an agent call that
     * arrives before the widget boots is replayed later, and replaying a
     * re-render at an unobserved moment is worse than reporting that there was
     * no widget to re-render. The caller is a per-swap checklist step that
     * records its own result, so it needs a synchronous answer, not a promise
     * that something happened eventually.
     *
     * @returns {{ ok: boolean, action?: 'render'|'reset', id?: string|null,
     *             reason?: string, error?: string }}
     */
    remountTurnstile: function () {
      if (!_api || typeof _api.remountTurnstile !== 'function') {
        return { ok: false, reason: 'no_widget' };
      }
      return _api.remountTurnstile();
    },
  });

  // Pick up a widget that booted BEFORE this block defined window.DLBooking
  // (the widget IIFE sits above this one in the file — see initWidget's stash).
  if (window.__dlAgentAPIPending) {
    window.DLBooking._register(window.__dlAgentAPIPending);
    try { delete window.__dlAgentAPIPending; } catch (e) { window.__dlAgentAPIPending = null; }
  }

  // ── postMessage bridge ──────────────────────────────────────────────────────
  // perch-inject.js posts { type:'dl-booking', action, payload } into this page.
  // This listener translates those into DLBooking API calls.
  // Same-origin check: reject any message not from our own origin (matches the
  // origin check in perch-inject.js where these messages originate).
  window.addEventListener('message', function (e) {
    if (e.origin !== location.origin) return; // reject cross-origin
    var d = e.data;
    if (!d || d.type !== 'dl-booking') return;
    try {
      var action  = d.action;
      var payload = d.payload;
      if (action === 'prefill')         { window.DLBooking.prefill(payload); }
      else if (action === 'selectType') { window.DLBooking.selectType(payload); }
      else if (action === 'selectSlot') { window.DLBooking.selectSlot(payload); }
      else if (action === 'showDate')   { window.DLBooking.showDate(payload); }
      else if (action === 'setCallId')  { try { window.__perchCallId = (payload && payload.call_id) || ''; } catch (idErr) {} }
      // getState is not dispatched via postMessage — no return channel in that direction.
      // Acknowledge receipt so the shell can STOP re-delivering (it retries until
      // acked to survive the page-load race). Without this the shell keeps firing
      // messages for ~10s, which lands mid date/time selection.
      if (action === 'prefill') {
        try { window.parent.postMessage({ __perchBookingAck: true, action: 'prefill' }, location.origin); } catch (ackErr) {}
      }
    } catch (err) {}
  });
})();
