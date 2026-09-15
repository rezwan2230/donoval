// ── MEMBERS portal gate ───────────────────────────────────────────────────────
// JORDAN / ORDER JORDAN-MEMBERS-GATE-MODAL
//
// THE DEFECT
// The MEMBERS nav dropdown links GOLD / PLATINUM / DIAMOND / RESERVE at the four
// tier directories. functions/_lib/tier-auth.js gates those directories with HTTP
// Basic and — correctly — FAILS CLOSED when the tier credentials are unset. With
// TIER_*_USER / TIER_*_PASS unconfigured, every one of those four links answers a
// bare 503 to the public, on all 74 pages that carry the dropdown.
//
// WHY THE FIX IS HERE AND NOT IN THE MARKUP OR THE ROUTE
//   • Not the markup: the dropdown is duplicated across 74 HTML pages (desktop nav
//     + mobile overlay on each). Editing them individually is 148 edit sites and a
//     guaranteed drift surface.
//   • Not the route: fail-closed is the correct behaviour for tier-auth, and this
//     order does not touch it. tier-auth.js and every tier route are unchanged.
// So: one shared capture-phase intercept, loaded site-wide from js/main.js, that
// answers the click with a gate modal instead of letting the 503 be navigated.
//
// WHAT THIS DOES NOW (MEMBERS-CLIO-GATED-ACCESS-R1)
// The modal signs a member in. It posts an email address to /members/auth/signin,
// which resolves that contact's engagement level from Clio and sets a signed,
// level-only session cookie; the four level middlewares then read it.
//
// There is still NO PASSWORD FIELD in this file, and that is not an oversight —
// the credential IS the email address the firm holds on the member's Clio contact.
// The order's accepted-risk section is explicit that this is a trade for delivery
// speed, and names the fix (a one-time emailed sign-in link) as out of scope.
//
// This file holds no secret, mints nothing, and decides nothing. It posts an
// address and renders whichever of four answers comes back. It also holds NO LIST
// of engagement levels for the purposes of that decision: the level it navigates to
// is derived from the label the SERVER returned, which is why a level added in Clio
// works here without a deploy.
//
// CSP
// The site runs a per-request nonce CSP (functions/_middleware.js). Nothing here
// is inline: no <style>, no style="", no el.style write, no inline handler. All
// presentation is class-driven from /css/members-gate.css, which this file
// injects once. The DOM is built with createElement/textContent — never
// innerHTML — following the pattern in js/consent-gate.js.
//
// PORTABILITY
// Every class and id is namespaced `dvnmg-`, the whole surface is one detached
// subtree owned by one module, and the only page contract is "an anchor whose
// href resolves to a tier root". That means the gate can be lifted into a Perch
// overlay widget later without selector or markup rework.

(function () {
  'use strict';

  // Idempotent: js/main.js appends this script once per document, but a soft-nav
  // body swap or a second injection must not double-bind the click handler.
  if (window.__dvnMembersGate) return;
  window.__dvnMembersGate = true;

  // ── THE ONE CONFIG OBJECT ───────────────────────────────────────────────────
  // Every name, label and destination the gate renders lives here. Renaming a
  // room, re-wording a persona, or repointing the consultation link is a one-line
  // edit in this block — no logic below reads a literal name.
  var CONFIG = {
    stylesheet: '/css/members-gate.css',
    // Existing booking page. Absolute so it resolves identically from a root page
    // (js/main.js), a tier page (../js/main.js), and inside the /perch iframe.
    bookingHref: '/book.html',
    // The firm's public address, kept for the retired mailto: path only. Request
    // access now POSTs to /members/request-access; nothing here composes mail.
    contactEmail: 'info@donovan.law',
    eyebrowSuffix: 'Member Portal',
    // Footer copy, per the approved mockup. Two standing lines for every tier,
    // plus the Reserve seat cap. `reserveCap` is COPY ONLY — which tiers show it
    // is decided in css/members-gate.css by the card's tier modifier
    // (.dvnmg-tier-reserve .dvnmg-footnote-cap), not by any branch here, so the
    // gate's logic is identical for all four rooms.
    footnote: 'By application only.',
    footnoteOpen: 'Public tools remain freely available.',
    reserveCap: 'Limited to 100 members.',
    privateNote:
      'This is a private, members-only area of Donovan Legal. Access is granted to admitted members and is not open to the public.',
    tiers: {
      gold: {
        label: 'GOLD',
        portal: 'The Strategy Room',
        persona: 'For the Strategy Consumer',
      },
      platinum: {
        label: 'PLATINUM',
        portal: 'The Partners Room',
        persona: 'For the Strategic Partner',
      },
      diamond: {
        label: 'DIAMOND',
        portal: 'The Operators Room',
        persona: 'For the Qualifying Operator',
      },
      reserve: {
        // RESERVE renders with the firm's "RE" case cue (css/main.css) — the
        // split is presentational only; the label reads RESERVE either way.
        label: 'RESERVE',
        splitLabel: ['RE', 'SERVE'],
        portal: 'The Reserve Room',
        // The 100-seat cap moved to the footer (CONFIG.reserveCap) where the
        // mockup puts it; it is the Reserve cap, not a persona attribute.
        persona: 'For the Principal',
      },
    },
    // ── Sign-in (MEMBERS-CLIO-GATED-ACCESS-R1) ───────────────────────────────
    // The Google / Microsoft buttons that stood here were placeholders for an IdP
    // that is not being built. Membership lives on the member's Clio contact, so
    // the credential is the email address the firm already has for them — see the
    // order's accepted-risk section, which is candid that this is a trade.
    endpoints: {
      config: '/members/auth/config',
      signin: '/members/auth/signin',
    },
    signinLede: 'Enter the email address the firm has on file for you.',
    signinCta: 'Enter',
    // Every refusal reads the same to the visitor. The server already declines to
    // distinguish "no such contact" from "contact with no level", and the card must
    // not undo that by wording them differently.
    notAMember:
      'We could not find a membership for that address. If you believe this is an error, please contact the firm — or request member access below.',
    signinError: 'Something went wrong. Please try again, or contact the firm.',
    signinBusy: 'Checking…',
    verifyFailed: 'We could not complete the browser check. Please try again in a moment.',
    // Shown when a member of one level opens a link to another. Never an automatic
    // redirect: an auto-redirect assumes the target folder exists, and a renamed or
    // missing folder becomes a 404 loop. A link the member clicks cannot fail that way.
    // TWO DIFFERENT NAMES, and using the wrong one reads as broken English: the
    // member holds a LEVEL ("Platinum"), which opens a ROOM ("The Partners Room").
    // Passing the room to both produced "You are a The Partners Room member." on
    // the first live run.
    wrongLevelLede: function (level) { return 'You are a ' + level + ' member.'; },
    wrongLevelCta: function (room) { return 'Enter ' + room; },
  };

  var TIER_KEYS = Object.keys(CONFIG.tiers);

  // A tier ROOT, with an optional leading and an optional trailing slash. Deeper
  // tier URLs (/gold/tool-1031-exchange.html) are deliberately NOT matched: a
  // visitor already inside a tier has authenticated, and intercepting their
  // in-tier navigation would break the members area rather than protect it.
  var TIER_ROUTE = new RegExp('^/?(' + TIER_KEYS.join('|') + ')/?$', 'i');

  // ── Tier resolution ─────────────────────────────────────────────────────────

  /**
   * The path an anchor would actually navigate to, resolved against the document.
   * Resolving (rather than string-matching the attribute) is what makes the one
   * handler cover every form the 74 pages use: "gold/", "/gold/", "../gold/",
   * and a fully-qualified https://www.donovan.law/gold/.
   * @returns {string|null} a pathname, or null if the href is off-site/unusable
   */
  function resolvedPath(a) {
    var raw = a.getAttribute('href');
    if (!raw) return null;
    // Never touch a scheme that does not navigate a page.
    if (/^(mailto|tel|javascript|data|blob):/i.test(raw)) return null;
    try {
      var u = new URL(a.href, document.baseURI);
      // Cross-origin links are somebody else's site — leave them alone.
      if (u.origin !== window.location.origin && u.protocol !== 'file:') return null;
      return u.pathname;
    } catch (e) {
      // No usable base (a bare fragment, or an exotic embedding context). Fall
      // back to the attribute so the guard degrades to string form, not to off.
      return raw.split('#')[0].split('?')[0];
    }
  }

  /**
   * Which tier this anchor leads to, if any.
   * Primary source is the resolved href. The brand-tier span inside the anchor is
   * the documented fallback for a link whose href form we could not resolve.
   * @returns {string|null} a key of CONFIG.tiers
   */
  function tierOf(a) {
    var path = resolvedPath(a);
    if (path) {
      // "/gold/" → ["/gold/", "gold"]; also tolerates a trailing-slash-free form.
      var m = String(path).replace(/\/{2,}/g, '/').match(TIER_ROUTE);
      if (m) return m[1].toLowerCase();
    }
    for (var i = 0; i < TIER_KEYS.length; i++) {
      if (a.querySelector('.brand-' + TIER_KEYS[i])) return TIER_KEYS[i];
    }
    return null;
  }

  // ── Stylesheet ──────────────────────────────────────────────────────────────

  function ensureStyles() {
    if (document.querySelector('link[data-dvnmg-styles]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CONFIG.stylesheet;
    link.setAttribute('data-dvnmg-styles', '');
    (document.head || document.documentElement).appendChild(link);
  }

  // ── Provider marks — REMOVED by MEMBERS-CLIO-GATED-ACCESS-R1 ────────────────
  //
  // The Google and Microsoft logo builders (svg/path/rect/providerMark) lived here
  // and drew the two SSO buttons. Both buttons are gone: membership is resolved
  // from the member's Clio contact, so there is no identity provider to badge.
  // Deleted rather than left unused — a dead logo builder is the kind of thing
  // someone later reads as evidence that SSO is planned.

  var els = null;          // built once, reused for every tier
  var currentTier = null;
  var lastTrigger = null;  // restored on close

  function mkButton(cls, label) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    b.textContent = label;
    return b;
  }

  function build() {
    if (els) return els;
    ensureStyles();

    var overlay = document.createElement('div');
    overlay.className = 'dvnmg-overlay';
    overlay.id = 'dvnmg-overlay';
    overlay.hidden = true;

    var card = document.createElement('div');
    card.className = 'dvnmg-card';
    card.id = 'dvnmg-card';
    card.setAttribute('role', 'dialog');
    card.setAttribute('aria-modal', 'true');
    card.setAttribute('aria-labelledby', 'dvnmg-title');
    card.setAttribute('aria-describedby', 'dvnmg-private');

    var close = mkButton('dvnmg-close', '×');
    close.id = 'dvnmg-close';
    close.setAttribute('aria-label', 'Close');

    // ── Eyebrow: "<TIER> · Member Portal" ────────────────────────────────────
    var eyebrow = document.createElement('p');
    eyebrow.className = 'dvnmg-eyebrow';
    eyebrow.id = 'dvnmg-eyebrow';

    var eyebrowTier = document.createElement('span');
    eyebrowTier.className = 'dvnmg-eyebrow-tier';

    var sep = document.createElement('span');
    sep.className = 'dvnmg-eyebrow-sep';
    sep.textContent = '·';

    var eyebrowSuffix = document.createElement('span');
    eyebrowSuffix.className = 'dvnmg-eyebrow-suffix';
    eyebrowSuffix.textContent = CONFIG.eyebrowSuffix;

    eyebrow.appendChild(eyebrowTier);
    eyebrow.appendChild(sep);
    eyebrow.appendChild(eyebrowSuffix);

    var title = document.createElement('h2');
    title.className = 'dvnmg-title';
    title.id = 'dvnmg-title';

    var persona = document.createElement('p');
    persona.className = 'dvnmg-persona';
    persona.id = 'dvnmg-persona';

    var privateNote = document.createElement('p');
    privateNote.className = 'dvnmg-private';
    privateNote.id = 'dvnmg-private';
    privateNote.textContent = CONFIG.privateNote;

    // ── Sign-in panel ────────────────────────────────────────────────────────
    var signin = document.createElement('div');
    signin.className = 'dvnmg-panel dvnmg-panel-signin';
    signin.id = 'dvnmg-panel-signin';

    // ── The sign-in form ─────────────────────────────────────────────────────
    // Every class here already exists in css/members-gate.css — dvnmg-field,
    // dvnmg-input and dvnmg-cta are the same ones the "launching soon" panel uses.
    // Reusing them is deliberate: #27 left the modal's brand treatment as David's
    // call and it is still unspecified, so this ticket wires behaviour and changes
    // no colour, type, spacing or room name.
    var providers = document.createElement('div');
    providers.className = 'dvnmg-providers dvnmg-signin-form';

    var signinLede = document.createElement('p');
    signinLede.className = 'dvnmg-signin-lede';
    signinLede.id = 'dvnmg-signin-lede';
    signinLede.textContent = CONFIG.signinLede;

    var signinLabel = document.createElement('label');
    signinLabel.className = 'dvnmg-field';
    signinLabel.setAttribute('for', 'dvnmg-signin-email');
    signinLabel.textContent = 'Email address';

    var signinEmail = document.createElement('input');
    signinEmail.type = 'email';
    signinEmail.className = 'dvnmg-input';
    signinEmail.id = 'dvnmg-signin-email';
    signinEmail.name = 'dvnmg_signin_email';
    signinEmail.setAttribute('autocomplete', 'email');
    signinEmail.setAttribute('inputmode', 'email');
    signinEmail.setAttribute('placeholder', 'you@firm.com');

    // Turnstile mounts here, rendered on first open rather than on page load —
    // 74 pages carry this script and almost none of them will ever open the modal.
    var tsMount = document.createElement('div');
    tsMount.className = 'dvnmg-turnstile';
    tsMount.id = 'dvnmg-turnstile';

    var signinSubmit = mkButton('dvnmg-cta dvnmg-signin-submit', CONFIG.signinCta);
    signinSubmit.id = 'dvnmg-signin-submit';

    // One status region for every outcome. aria-live so a screen reader hears the
    // refusal — a sighted user sees the text appear, and this is the equivalent.
    var signinMsg = document.createElement('p');
    signinMsg.className = 'dvnmg-signin-msg';
    signinMsg.id = 'dvnmg-signin-msg';
    signinMsg.setAttribute('role', 'status');
    signinMsg.setAttribute('aria-live', 'polite');
    signinMsg.hidden = true;

    // Where a member of a DIFFERENT level is offered their own room. Built empty
    // and filled at answer time, because the room name comes from whatever the
    // server echoed back, which may be a level this file has never heard of.
    var elsewhere = document.createElement('a');
    elsewhere.className = 'dvnmg-cta dvnmg-elsewhere';
    elsewhere.id = 'dvnmg-elsewhere';
    elsewhere.hidden = true;

    signinSubmit.addEventListener('click', function () { submitSignin(); });
    signinEmail.addEventListener('keydown', function (e) {
      // Enter submits. There is no <form>, so nothing does this for us, and a
      // login box that ignores Enter feels broken to everyone who has used one.
      if (e.key === 'Enter') { e.preventDefault(); submitSignin(); }
    });

    providers.appendChild(signinLede);
    providers.appendChild(signinLabel);
    providers.appendChild(signinEmail);
    providers.appendChild(tsMount);
    providers.appendChild(signinSubmit);
    providers.appendChild(signinMsg);
    providers.appendChild(elsewhere);

    var divider = document.createElement('div');
    divider.className = 'dvnmg-divider';
    divider.appendChild(document.createTextNode('or'));

    var request = mkButton('dvnmg-request', 'Request member access');
    request.id = 'dvnmg-request';
    request.addEventListener('click', function () {
      startAuth('request-access', currentTier);
    });

    // Footer. All three lines are emitted for every tier and are identical for
    // every tier; the Reserve cap is revealed by the stylesheet under
    // .dvnmg-tier-reserve and is display:none otherwise. No branch here.
    var footnote = document.createElement('p');
    footnote.className = 'dvnmg-footnote';
    footnote.id = 'dvnmg-footnote';
    [
      ['dvnmg-footnote-line', CONFIG.footnote],
      ['dvnmg-footnote-line', CONFIG.footnoteOpen],
      ['dvnmg-footnote-cap', CONFIG.reserveCap],
    ].forEach(function (line) {
      var s = document.createElement('span');
      s.className = line[0];
      s.textContent = line[1];
      footnote.appendChild(s);
    });

    signin.appendChild(providers);
    signin.appendChild(divider);
    signin.appendChild(request);
    signin.appendChild(footnote);

    // ── "Launching soon" panel — the current stub for startAuth ──────────────
    var soon = document.createElement('div');
    soon.className = 'dvnmg-panel dvnmg-panel-soon';
    soon.id = 'dvnmg-panel-soon';
    soon.hidden = true;

    var soonLede = document.createElement('p');
    soonLede.className = 'dvnmg-soon-lede';
    soonLede.id = 'dvnmg-soon-lede';
    soonLede.textContent = 'Launching soon';

    var soonBody = document.createElement('p');
    soonBody.className = 'dvnmg-soon-body';
    soonBody.id = 'dvnmg-soon-body';

    var consult = document.createElement('a');
    consult.className = 'dvnmg-cta dvnmg-cta-ghost';
    consult.id = 'dvnmg-consult';
    consult.href = CONFIG.bookingHref;
    consult.textContent = 'Schedule a consultation';
    // THE FRONT DOOR, not the last room of the flow.
    //
    // `book.html` on its own lands on the date/time picker and SKIPS the qualifier,
    // so the firm would get a booking with no matter type and no urgency — most of
    // what makes the consultation worth having.
    //
    // `data-perch-book` is perch-layer.js's own published contract
    // (BOOK_INTENT_ATTR): a delegated click handler opens the no-voice qualifier and
    // runs the whole chain. Its VALUE becomes the lead's `source` attribution via
    // /fn/qualifier_submit, and a visitor who arrives this way was never asked "how
    // did you hear about us", so it is the most useful thing that field will hold.
    //
    // An attribute, not a call. `openBookIntent` is inside perch-layer's closure and
    // `openQualifier` was deliberately removed from window.__perch (DR-INSANE-A33,
    // #58); PR #185 is rewriting that whole surface. The attribute is the contract
    // that survives it. And the handler only preventDefault()s on success, so the
    // href above remains the failure floor exactly as that module intends.
    consult.setAttribute('data-perch-book', 'members_gate');

    // AND GET OUT OF THE WAY. Handing off is not enough — this overlay sits at
    // z-index > 2147483000 (just under the consent gate, by design), so the
    // qualifier opens BEHIND it and the visitor sees a card that appears to do
    // nothing. Found live.
    //
    // WHY THIS LISTENS ON `window` AND NOT ON THE ANCHOR. perch-layer's book-intent
    // handler is a DOCUMENT-level CAPTURE listener that calls stopPropagation() the
    // moment the intent opens, so the event never reaches the anchor's own
    // listeners. Capture runs window → document → … → target, so window is the only
    // place that is guaranteed to see this click first.
    //
    // It does NOT preventDefault. Closing is all we do; whether the qualifier opens
    // or the href is followed stays perch-layer's decision, including its no-JS
    // failure floor.

    var back = mkButton('dvnmg-back', 'Back');
    back.id = 'dvnmg-back';
    back.addEventListener('click', function () {
      showPanel('signin');
      var first = card.querySelector('#dvnmg-signin-email');
      if (first) first.focus();
    });

    soon.appendChild(soonLede);
    soon.appendChild(soonBody);
    soon.appendChild(consult);
    soon.appendChild(back);

    card.appendChild(close);
    card.appendChild(eyebrow);
    card.appendChild(title);
    card.appendChild(persona);
    card.appendChild(privateNote);
    card.appendChild(signin);
    card.appendChild(soon);
    overlay.appendChild(card);

    // ESC, backdrop, and the focus trap.
    close.addEventListener('click', function () { closeModal(); });
    overlay.addEventListener('mousedown', function (e) {
      // mousedown (not click) so a drag that STARTS inside the card and ends on
      // the backdrop — selecting text, for instance — does not close the modal.
      if (e.target === overlay) closeModal();
    });
    card.addEventListener('keydown', onCardKey);
    overlay.addEventListener('keydown', onOverlayKey);

    (document.body || document.documentElement).appendChild(overlay);

    els = {
      overlay: overlay, card: card, close: close,
      eyebrowTier: eyebrowTier, title: title, persona: persona,
      signin: signin, soon: soon, soonLede: soonLede, soonBody: soonBody,
      consult: consult,
      signinEmail: signinEmail, signinSubmit: signinSubmit, signinMsg: signinMsg,
      signinLede: signinLede, elsewhere: elsewhere, tsMount: tsMount,
    };
    return els;
  }

  function showPanel(which) {
    if (!els) return;
    els.signin.hidden = which !== 'signin';
    els.soon.hidden = which !== 'soon';
  }

  // ── Turnstile ───────────────────────────────────────────────────────────────
  //
  // Loaded on FIRST MODAL OPEN, never on page load. 74 pages carry this script and
  // almost none of them will ever open the modal; fetching a third-party script on
  // all of them to serve the few that do is a cost with no return. `?render=explicit`
  // is the same URL js/consent-gate.js uses, for the same reason — it stops the
  // widget auto-rendering into whatever it finds first.
  //
  // The site key comes from /members/auth/config rather than a literal here, so a
  // rotated key cannot leave this file rendering a widget whose tokens the server
  // has started rejecting. See that endpoint for the longer version.

  var TURNSTILE_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  var tsWidgetId = null;
  var tsSiteKey = null;
  var tsLoading = null;

  // THE TOKEN ARRIVES LATER THAN render() RETURNS, and getting that wrong is what
  // made the first live attempt fail. render() resolving means the widget EXISTS;
  // the challenge then runs and delivers its token through the `callback` option
  // some time afterwards. Reading getResponse() in the next tick returns '', the
  // server correctly refuses an empty token, and the card says "Something went
  // wrong" — a real refusal caused entirely by asking too early.
  //
  // js/booking-widget.js does not hit this because it renders at MOUNT and reads at
  // SUBMIT, with a person filling in a form in between. This modal has no such gap,
  // so the token is captured from the callback and awaited explicitly.
  var tsToken = '';
  var tsWaiters = [];

  function tsDeliver(token) {
    tsToken = token || '';
    var waiting = tsWaiters;
    tsWaiters = [];
    waiting.forEach(function (resolve) { resolve(tsToken); });
  }

  /**
   * Resolve with a token, or with '' after `ms`.
   *
   * Resolving empty rather than rejecting is deliberate: the request is still sent,
   * the server still refuses it, and the refusal comes from the one place entitled
   * to make it. A client that decided by itself not to ask would be a second,
   * silent gate with no logging.
   */
  function awaitToken(ms) {
    if (tsToken) return Promise.resolve(tsToken);
    return new Promise(function (resolve) {
      var done = false;
      var finish = function (t) { if (!done) { done = true; resolve(t || ''); } };
      tsWaiters.push(finish);
      setTimeout(function () { finish(''); }, ms);
    });
  }

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[src="' + src + '"]');
      if (existing) {
        if (window.turnstile) return resolve();
        existing.addEventListener('load', function () { resolve(); });
        existing.addEventListener('error', function () { reject(new Error('turnstile')); });
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.addEventListener('load', function () { resolve(); });
      s.addEventListener('error', function () { reject(new Error('turnstile')); });
      (document.head || document.documentElement).appendChild(s);
    });
  }

  /**
   * Ensure a Turnstile widget exists in the card. Idempotent.
   *
   * Resolves even when it could not render. The sign-in POST fails closed on a
   * missing token all by itself, so refusing to show the form here would only
   * replace a clear server refusal with a blank modal.
   */
  function ensureTurnstile() {
    if (tsLoading) return tsLoading;
    tsLoading = (function () {
      var b = build();
      return fetch(CONFIG.endpoints.config, { credentials: 'same-origin' })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (cfg) {
          tsSiteKey = cfg && cfg.turnstileSiteKey;
          if (!tsSiteKey) return null;
          return loadScript(TURNSTILE_SRC);
        })
        .then(function () {
          if (!tsSiteKey) return null;
          if (!window.turnstile || typeof window.turnstile.render !== 'function') return null;
          if (tsWidgetId !== null) return tsWidgetId;
          // render() THROWS on a duplicate mount or a bad key — a rejected promise
          // here would surface as an unhandled rejection on a page that is
          // otherwise fine, so it is caught and the form simply carries on.
          try {
            tsWidgetId = window.turnstile.render(b.tsMount, {
              sitekey: tsSiteKey,
              callback: function (token) { tsDeliver(token); },
              // A challenge that errored or expired must not leave a stale token
              // behind — a resubmit would then send one Cloudflare has already
              // retired, which reads as tampering rather than as a timeout.
              'error-callback': function () { tsDeliver(''); },
              'expired-callback': function () { tsDeliver(''); },
              'timeout-callback': function () { tsDeliver(''); },
            });
          } catch (e) {
            tsWidgetId = null;
          }
          return tsWidgetId;
        })
        .catch(function () { return null; });
    })();
    return tsLoading;
  }

  function turnstileToken() {
    if (!window.turnstile || tsWidgetId === null) return '';
    try { return window.turnstile.getResponse(tsWidgetId) || ''; } catch (e) { return ''; }
  }

  /** A used token cannot be replayed, so a second attempt needs a fresh one. */
  function resetTurnstile() {
    tsToken = '';
    if (!window.turnstile || tsWidgetId === null) return;
    try { window.turnstile.reset(tsWidgetId); } catch (e) {}
  }

  // ── Sign-in ─────────────────────────────────────────────────────────────────

  function setMsg(text) {
    var b = build();
    b.signinMsg.textContent = text || '';
    b.signinMsg.hidden = !text;
  }

  function setBusy(on) {
    var b = build();
    b.signinSubmit.disabled = !!on;
    b.signinEmail.disabled = !!on;
    b.signinSubmit.textContent = on ? CONFIG.signinBusy : CONFIG.signinCta;
  }

  /**
   * Offer a member their own room instead of dead-ending them.
   *
   * `level` is whatever the server echoed back — the label exactly as the firm
   * typed it in Clio. If this file recognises it, the member is offered the room by
   * name; if it does not, they are offered the level by its own name. That fallback
   * is what makes adding an engagement level a Clio edit rather than a deploy, so
   * it is load-bearing rather than defensive.
   */
  function offerLevel(level) {
    var b = build();
    var key = String(level || '').toLowerCase();
    var known = CONFIG.tiers[key];
    var room = known ? known.portal : level;
    // The LEVEL for the sentence, the ROOM for the button. `level` arrives exactly
    // as Clio spelled it, which is already how the firm wants it written.
    setMsg(CONFIG.wrongLevelLede(level));
    b.elsewhere.textContent = CONFIG.wrongLevelCta(room);
    b.elsewhere.href = '/' + encodeURIComponent(key) + '/';
    b.elsewhere.hidden = false;
    b.elsewhere.focus();
  }

  function submitSignin() {
    var b = build();
    var email = (b.signinEmail.value || '').trim();
    b.elsewhere.hidden = true;
    if (!email || email.indexOf('@') < 0) {
      setMsg('Please enter the email address the firm has on file for you.');
      b.signinEmail.focus();
      return;
    }

    setBusy(true);
    setMsg('');

    ensureTurnstile()
      .then(function () { return tsToken || awaitToken(8000) || turnstileToken(); })
      .then(function (token) {
        return fetch(CONFIG.endpoints.signin, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email, turnstileToken: token || turnstileToken() }),
        });
      })
      .then(function (res) {
        return res.json().then(function (data) { return { status: res.status, data: data }; });
      })
      .then(function (out) {
        setBusy(false);
        resetTurnstile();
        var data = out.data || {};

        if (data.ok && data.tier) {
          // Signed in. The cookie is already set either way; what differs is
          // whether this is the room they asked for.
          //
          // The slug is derived from the label the SERVER returned, lower-cased —
          // the same comparison the middleware makes — so this file still holds no
          // list of levels.
          var slug = String(data.tier).toLowerCase();

          // A member of a DIFFERENT level is OFFERED their room, never sent to it.
          // An automatic redirect assumes that folder exists; a renamed or missing
          // one becomes a redirect loop, and the member cannot tell what happened.
          // A link they click cannot fail that way, and they keep the choice.
          if (currentTier && slug !== String(currentTier).toLowerCase()) {
            offerLevel(data.tier);
            return;
          }

          // TOP, not the /perch iframe: the member area is a full-page area and
          // must not end up rendered inside the concierge frame.
          (window.top || window).location.assign('/' + encodeURIComponent(slug) + '/');
          return;
        }

        if (data.reason === 'rate_limited') {
          setMsg('Too many attempts. Please wait a few minutes and try again.');
          return;
        }
        if (data.reason === 'not_a_member') {
          setMsg(CONFIG.notAMember);
          return;
        }
        if (data.reason === 'verification_failed') {
          // Distinct from the generic error on purpose. "Something went wrong" sent
          // a member looking for a problem with their membership when the actual
          // answer is "the browser check has not finished — press Enter again."
          setMsg(CONFIG.verifyFailed);
          return;
        }
        // verification_failed, unavailable, bad_request, and anything unforeseen.
        // One wording: the visitor can act on none of these differently, and
        // itemising them would describe our internals to whoever asked.
        setMsg(CONFIG.signinError);
      })
      .catch(function () {
        setBusy(false);
        resetTurnstile();
        setMsg(CONFIG.signinError);
      });
  }

  // ── startAuth — request access ──────────────────────────────────────────────
  /**
   * Single entry point for every action on the sign-in panel, keyed by provider
   * id (from data-provider) and the tier the modal was opened with.
   *
   * ⚠️ CURRENTLY A STUB. It performs NO authentication. It does not read, send,
   * mint, or store a credential, a token, or a secret. All it does is swap the
   * card to a "launching soon" panel.
   *
   * TODO(IdP): when the members portal is real, this is the only function that
   * changes. Replace the showPanel('soon') call with the redirect, e.g.
   *
   *     var next = '/members/auth/start'
   *              + '?provider=' + encodeURIComponent(provider)
   *              + '&tier='     + encodeURIComponent(tier);
   *     window.top.location.assign(next);   // top, not the /perch iframe
   *
   * Constraints that must hold when that lands:
   *   • The redirect target must be same-origin and server-owned; this file must
   *     never hold a client secret, and must never accept a redirect target from
   *     the page.
   *   • Navigate the TOP browsing context — an OAuth screen cannot render inside
   *     the /perch #site iframe (frame-ancestors), the same class of problem the
   *     tel:/mailto: escape in js/main.js fixes.
   *   • The IdP origin must be added to connect-src/form-action in
   *     functions/_middleware.js. That is a separate, gated change.
   */
  function startAuth(provider, tier) {
    var t = CONFIG.tiers[tier];
    var room = t ? t.portal : 'The member portal';
    var b = build();
    b.soonLede.textContent = 'Request member access';
    b.soonBody.textContent =
      room + ' admits members by application, and it starts with a confidential consultation. ' +
      'The firm will scope an engagement with you there.';
    showPanel('soon');
    b.consult.focus();
  }

  // ── Request member access → the firm's real intake ────────────────────────
  //
  // This used to capture an email and post a lead to Vantage. It doesn't any more,
  // and the reason is worth writing down because the endpoint that served it has
  // been deleted with it.
  //
  // An address in a dashboard gives the firm nothing to act on: no matter type, no
  // urgency, no appointment, and nobody committed to watching for it. The booking
  // flow — qualifier, slot, contact in Clio, calendar invite — is the firm's actual
  // intake, it is already proven, and it ends with a scheduled call rather than a
  // row somebody has to notice. Every membership page's own CTA already points
  // there, and the firm's copy says engagement terms are set in a consultation.
  //
  // THE TIER CONTEXT IS NOT LOST. Vantage's visitor log already records that this
  // visitor_id viewed /membership-<level>, and the booking flow sends the same
  // visitor_id with its lead. The hub links "looked at Reserve" to "booked a
  // consultation" without a second write from us.
  //
  // WE NAVIGATE, WE DO NOT CALL IN. `openQualifier` was removed from
  // `window.__perch` on purpose (DR-INSANE-A33, #58) because a writable global
  // could be swapped to intercept the caller's answers. And PR #185 is rewriting
  // qualifier.js, perch-layer.js, booking-modal.js and journey.js right now. A URL
  // is the stable contract; an internal function is not one at all.

  // ── Open / close ────────────────────────────────────────────────────────────

  function renderTier(tier) {
    var t = CONFIG.tiers[tier];
    if (!t) return;
    var b = build();

    // Eyebrow tier word. RESERVE carries the firm's "RE" case cue.
    while (b.eyebrowTier.firstChild) b.eyebrowTier.removeChild(b.eyebrowTier.firstChild);
    if (t.splitLabel) {
      var re = document.createElement('span');
      re.className = 'dvnmg-eyebrow-re';
      re.textContent = t.splitLabel[0];
      b.eyebrowTier.appendChild(re);
      b.eyebrowTier.appendChild(document.createTextNode(t.splitLabel[1]));
    } else {
      b.eyebrowTier.textContent = t.label;
    }

    b.title.textContent = t.portal;
    b.persona.textContent = t.persona;
    b.consult.href = CONFIG.bookingHref;

    TIER_KEYS.forEach(function (k) { b.card.classList.remove('dvnmg-tier-' + k); });
    b.card.classList.add('dvnmg-tier-' + tier);
  }

  function openModal(tier, trigger) {
    var b = build();
    currentTier = tier;
    lastTrigger = trigger || document.activeElement;
    renderTier(tier);
    showPanel('signin');
    // Start the browser check NOW, while the member is still typing, instead of at
    // submit. Turnstile needs a moment to run and hand back a token; starting it on
    // the click that needs it is what made the first live attempt post an empty one.
    ensureTurnstile();
    b.overlay.hidden = false;
    var first = b.card.querySelector('#dvnmg-signin-email') || b.close;
    if (first && first.focus) first.focus();
  }

  function closeModal() {
    if (!els || els.overlay.hidden) return;
    els.overlay.hidden = true;
    showPanel('signin');
    currentTier = null;
    // Restore focus to the dropdown item that opened the gate.
    try {
      if (lastTrigger && lastTrigger.focus && document.contains(lastTrigger)) lastTrigger.focus();
    } catch (e) {}
    lastTrigger = null;
  }

  function onOverlayKey(e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    }
  }

  /** Focus trap. Tab cycles within the card and never escapes to the page behind. */
  function onCardKey(e) {
    if (e.key !== 'Tab') return;
    var focusable = [].slice
      .call(els.card.querySelectorAll('a[href], button, input, select, textarea, [tabindex]'))
      .filter(function (el) {
        if (el.disabled || el.getAttribute('tabindex') === '-1') return false;
        // hidden panels are display:none, but jsdom has no layout — check the
        // [hidden] ancestor directly so the trap is correct in both.
        for (var n = el; n && n !== els.card; n = n.parentNode) {
          if (n.hidden) return false;
        }
        return true;
      });
    if (!focusable.length) return;
    var first = focusable[0];
    var last = focusable[focusable.length - 1];
    var active = document.activeElement;
    if (e.shiftKey && (active === first || !els.card.contains(active))) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (active === last || !els.card.contains(active))) {
      e.preventDefault();
      first.focus();
    }
  }

  // ── The intercept ───────────────────────────────────────────────────────────
  //
  // CAPTURE phase, on document, so it runs before Bootstrap's dropdown handlers
  // and before perch-inject.js's own capture listener can act — and, critically,
  // before the browser's default action. preventDefault stops the navigation to
  // the 503; stopPropagation keeps the dropdown from also reacting to the click.
  document.addEventListener('click', function (e) {
    // Let modified clicks through untouched — a middle-click or ctrl-click is a
    // deliberate "open elsewhere", and swallowing it would be worse than the 503.
    if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    // Never intercept a click that originated INSIDE the gate itself.
    if (els && els.overlay.contains(a)) return;
    var tier = tierOf(a);
    if (!tier) return;
    e.preventDefault();
    e.stopPropagation();
    openModal(tier, a);
  }, true);

  // Escape works even if focus has drifted out of the card (e.g. the user clicked
  // the backdrop first). The overlay listener above covers the in-card case.
  document.addEventListener('keydown', function (e) {
    if (!els || els.overlay.hidden) return;
    if (e.key === 'Escape' || e.key === 'Esc') closeModal();
  }, true);

  // ── Arriving from the gate's own redirect ───────────────────────────────────
  //
  // memberGuard sends an unauthenticated visitor to /membership-<level>?signin=1,
  // and a member holding a DIFFERENT level to the same page with &holds=<Level>.
  // Without this, that redirect lands on the public page with no card and no
  // explanation — which is precisely the dead end this work exists to remove, and
  // is exactly what it did on the first live run.
  //
  // `holds` is echoed straight back from the server, so it is treated as untrusted
  // text: it selects a room name for display and is never used to grant anything.
  // The session cookie is the only thing that opens a door.
  function openFromQuery() {
    var params;
    try { params = new URL(window.location.href).searchParams; } catch (e) { return; }
    if (params.get('signin') !== '1') return;

    // Which level's page are we on? Taken from the PATH, not from the query, so a
    // crafted link cannot open the card for a room the page is not about.
    var m = /\/membership-([a-z0-9-]+)/i.exec(window.location.pathname);
    var tier = m && m[1].toLowerCase();
    if (!tier || !CONFIG.tiers[tier]) return;

    openModal(tier, null);

    var holds = (params.get('holds') || '').trim().slice(0, 40);
    if (holds) offerLevel(holds);
  }

  // Gated on document.body, NOT on readyState. The only thing openFromQuery needs
  // is somewhere to append the card, and `readyState === 'loading'` can be true
  // while body already exists — in which case waiting for DOMContentLoaded means
  // waiting for an event that, depending on how the script was injected, may
  // already have fired. The card then never appears and the redirect dead-ends,
  // silently, which is the failure this whole function exists to prevent.
  window.addEventListener('click', function (e) {
    if (!els || els.overlay.hidden) return;
    var t = e.target && e.target.closest ? e.target.closest('#dvnmg-consult') : null;
    if (t) closeModal();
  }, true);

  if (document.body) {
    openFromQuery();
  } else {
    document.addEventListener('DOMContentLoaded', openFromQuery);
  }

  // Exposed for the test suite and for a future Perch overlay host that wants to
  // open the gate itself. Read-only surface: no credential passes through it.
  window.__dvnMembersGateApi = {
    openFromQuery: openFromQuery,
    open: openModal,
    close: closeModal,
    tierOf: tierOf,
    config: CONFIG,
  };
})();
