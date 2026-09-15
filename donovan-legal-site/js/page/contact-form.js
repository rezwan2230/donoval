// ── The "Send an Initial Inquiry" form on /contact ────────────────────────────
//
// ORDER SHELDON-CONTACT-ROUTE-R1 (#214).
//
// The form used to be a plain `action="https://formspree.io/f/xnjwgzkj"` POST. Two
// things were wrong with that and only one of them was the missing delivery:
// `form-action 'self' https://vantage.ticoai.net` in the edge CSP means the browser
// REFUSES a submission to formspree.io outright, and a blocked form-action is a
// console message, not an error the page can see. So the button did nothing, said
// nothing, and the inquiry was gone.
//
// This posts the same seven fields as JSON to the site's own /fn/contact, which
// routes them into Clio Grow and Clio Manage, and reports the outcome ON THE PAGE.
// The writer is never handed off to a third-party thank-you screen, which is also
// why `e.preventDefault()` is the first thing the submit handler does — a native
// submit here would be silently killed by the same CSP directive.
//
// ── WHY DL.ready AND NOT A BARE ADDEVENTLISTENER ────────────────────────────
// /contact is an interceptable route: the Swup router replaces #perch-main and the
// form inside it becomes NEW element objects, so a listener bound to the old node
// is gone. DL.ready re-runs this callback on every `dl:content-swapped` as well as
// at load — see js/dl-init.js. The callback is therefore re-entrant by contract:
// it re-queries the DOM, and it returns quietly when the form is absent, which is
// what it will find on all 95 other interceptable pages.
//
// ── AND WHY TURNSTILE IS RENDERED EXPLICITLY ────────────────────────────────
// The implicit `class="cf-turnstile"` mode renders once, when api.js loads. After
// a swap the script is already loaded and never re-executes (the router adopts a
// script once — js/perch/swap-policy.js), so an implicit widget would leave the
// new mount point EMPTY, `getResponse()` would return nothing, and /fn/contact
// would answer 403 TURNSTILE_REQUIRED on a form that looked fine. That is the same
// stranded-challenge failure JORDAN-PERCH-A23 fixed for the booking widget; the
// explicit render + the remount below is this form's version of it.

DL.ready(function () {
  'use strict';

  var form = document.getElementById('dl-contact-form');
  // Absent on every page but /contact. After a swap this callback still fires.
  if (!form) return;

  // Already wired in THIS document (DL.ready can be invoked more than once against
  // the same nodes). Re-binding the same element would double-post the inquiry.
  if (form.getAttribute('data-dl-bound') === '1') return;
  form.setAttribute('data-dl-bound', '1');

  // Public site key — the same widget the booking path uses. Public by design; the
  // secret half is TURNSTILE_SECRET_KEY, server-side, and is never in this file.
  var TURNSTILE_SITEKEY = '0x4AAAAAAD3X3AEk_IbefC4I';

  var statusEl = document.getElementById('dl-contact-status');
  var button = form.querySelector('.submit-btn');
  var mount = document.getElementById('dl-contact-turnstile');
  var widgetId = null;
  var sending = false;

  // ── Turnstile mount, with the same retry the booking widget uses ────────────
  // api.js is `async defer`, so window.turnstile may not exist yet when this runs.
  // Bounded retry rather than an unbounded poll: if the challenge never arrives the
  // submit below reports it as a verification failure, which is the honest outcome.
  (function mountTurnstile(tries) {
    if (!mount || tries > 40) return;
    if (window.turnstile && typeof window.turnstile.render === 'function') {
      try {
        widgetId = window.turnstile.render(mount, { sitekey: TURNSTILE_SITEKEY });
      } catch (e) { /* an already-rendered mount throws; the existing widget stands */ }
      return;
    }
    setTimeout(function () { mountTurnstile(tries + 1); }, 150);
  }(0));

  function token() {
    if (!window.turnstile || widgetId == null) return '';
    try { return window.turnstile.getResponse(widgetId) || ''; } catch (e) { return ''; }
  }

  /** A token is single-use — a retry with a spent one 403s. Reset after every
   *  attempt that did not succeed, so the second try can actually work. */
  function resetChallenge() {
    if (!window.turnstile || widgetId == null) return;
    try { window.turnstile.reset(widgetId); } catch (e) { /* nothing to reset */ }
  }

  /**
   * Say what happened, on the page.
   *
   * `textContent`, never innerHTML: every message below is a constant, but the
   * function is the one place a future edit could put a server string on the page,
   * and this closes that door before it opens.
   */
  function say(kind, message) {
    if (!statusEl) return;
    statusEl.className = 'form-status form-status-' + kind;
    statusEl.textContent = message;
    statusEl.hidden = false;
  }

  form.addEventListener('submit', function (e) {
    // FIRST, unconditionally. A native submit to /fn/contact would navigate away
    // from the page and lose the on-page result; a native submit anywhere else is
    // blocked by form-action and reports nothing at all.
    e.preventDefault();
    if (sending) return;

    var payload = {
      name: value('name'),
      email: value('email'),
      phone: value('phone'),
      referral: value('referral'),
      matter_type: value('matter_type'),
      urgency: value('urgency'),
      description: value('description'),
      turnstile_token: token(),
    };

    sending = true;
    if (button) { button.disabled = true; }
    say('pending', 'Sending your inquiry…');

    fetch('/fn/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Same-origin, so the Origin header the endpoint checks is sent by the
      // browser and cannot be set from here.
      credentials: 'same-origin',
      body: JSON.stringify(payload),
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        return { ok: res.ok, status: res.status, body: body };
      });
    }).then(function (r) {
      if (r.ok && r.body && r.body.ok) {
        form.reset();
        say('ok',
          'Thank you — your inquiry has reached the firm. Someone will follow up at the '
          + 'email address you gave. For anything time-sensitive, please call (561) 666-6022.');
        // The form is spent; a second submit of the same text would file a second
        // lead. Leave the button disabled and let the page reload be the reset.
        return;
      }
      say('error', messageFor(r));
      resetChallenge();
      if (button) { button.disabled = false; }
      sending = false;
    }).catch(function () {
      // Network failure, offline, or a request the browser refused. We cannot know
      // whether it arrived, so the message says what to do rather than guessing.
      say('error',
        'We could not send your inquiry just now. Please try again, or email '
        + 'info@donovan.law or call (561) 666-6022.');
      resetChallenge();
      if (button) { button.disabled = false; }
      sending = false;
    });
  });

  /** Read one named control out of THIS form. Missing control ⇒ "". */
  function value(name) {
    var el = form.elements ? form.elements[name] : null;
    return el && typeof el.value === 'string' ? el.value : '';
  }

  /**
   * Turn an endpoint refusal into something a person can act on.
   *
   * Deliberately coarse. The endpoint's `code` distinguishes "the secret is not
   * configured" from "the challenge failed", and the writer of an inquiry can do
   * nothing with that difference — but they CAN be told to try the challenge again
   * versus to phone the firm, and those are different sentences.
   */
  function messageFor(r) {
    var code = (r.body && r.body.code) || '';
    if (code === 'VALIDATION_ERROR') {
      return 'Please check the required fields — name, email, nature of matter and a '
        + 'brief description are needed before this can be sent.';
    }
    if (code === 'TURNSTILE_REQUIRED' || code === 'TURNSTILE_FAILED') {
      return 'Please complete the "I am human" check above the button, then send again.';
    }
    if (code === 'RATE_LIMITED') {
      return 'That is several inquiries in a short time. Please wait a few minutes, or call '
        + '(561) 666-6022.';
    }
    return 'We could not send your inquiry just now. Please try again shortly, or email '
      + 'info@donovan.law or call (561) 666-6022.';
  }
});
