// ── MEMBER SIGN-OUT control ───────────────────────────────────────────────────
// JORDAN / ORDER JORDAN-196-LOGIN-SIGNOUT-R1 (#196)
//
// THE DEFECT
// `functions/members/auth/signout.js` has existed since MEMBERS-CLIO-GATED-ACCESS-R1
// and NOTHING on this site has ever called it. A member signs in through the gate
// card, lands in one of the four portals, and there is no way back out: the session
// cookie is a session cookie, so it survives every tab and every navigation until
// the whole browser is closed. On a machine that is not theirs — a client's office,
// a shared workstation — the next person to open /gold/ is still signed in as them.
// This file is the missing control. It is the entire change on the client side; the
// endpoint is not touched, and neither is anything that decides access.
//
// WHAT IT DOES NOT DO. It reads no cookie (the session cookie is HttpOnly and this
// file could not read it if it wanted to), holds no credential, decides nothing, and
// never asks the server a question whose answer changes what it renders. It posts to
// one endpoint and navigates. Every access decision stays in
// `functions/_lib/member-auth.js`, unchanged.
//
// ── WHY THE MEMBER AREA IS RECOGNISED BY ITS PATH ───────────────────────────
// The obvious alternative is "render the control when the visitor is signed in",
// and it is not available: `dl_member` is `HttpOnly`, deliberately, so no script can
// see it. The path is the honest signal instead, and it is exact rather than
// approximate — `memberGuard` gates precisely `/gold/`, `/platinum/`, `/diamond/`
// and `/reserve/`, and a signed-out visitor never sees a document from inside one:
// the guard answers 302 to `/membership-<level>?signin=1` before the page is served.
// So on every document this control mounts into, a session exists by construction.
//
// ── WHY IT IS LOADED BY js/perch-layer.js AND NOT BY A <script> TAG ─────────
// A tag would have to be added to 39 hand-authored HTML files, and
// `test/chrome-diff.test.mjs` compares the `<script src>` / `<link href>` manifest
// of every changed page and fails on any change to it — a rule the reviewed-
// structural allowlist does NOT waive (it suppresses `page-structure` and nothing
// else). The layer module is already injected into <head> of all 39 by
// `functions/_lib/perch-layer-inject.js` (measured: `planFromHtml` returns
// wrap-body / wrap-div / stamp for every page under the four tier roots, never
// 'skip'), so one side-effect import there reaches all of them and edits no page.
//
// The import is a SIDE-EFFECT import and this file is a plain IIFE, so it boots on
// its own and does not wait for — or depend on — the layer mounting. That matters:
// the layer deliberately declines to mount inside a frame, and the sign-out control
// has no reason to inherit that decision.
//
// ── WHY A SWAP CANNOT DUPLICATE IT ──────────────────────────────────────────
// `js/perch/swap-policy.js` excludes `/(gold|platinum|diamond|reserve)/` from the
// router outright (`tier-basic-auth`), so every arrival in the member area is a real
// document load and this module runs once per document. The `__dvnMembersSignout`
// guard and the `#dvnms-signout` lookup are still here for the injected-twice case,
// on the same reasoning as js/members-gate.js's.
//
// ── WHY THE FAILURE PATH DOES NOT NAVIGATE ──────────────────────────────────
// If the POST does not come back 2xx, the cookie has NOT been cleared. Navigating
// away anyway would show the member the public homepage — which reads exactly like a
// successful sign-out — while their session is still live for the next person at the
// keyboard. That is worse than the defect this fixes, so a failed POST re-enables the
// button and says so, and the member stays where they are.
//
// ── WHY location.replace AND NOT location.assign ────────────────────────────
// `replace` drops the portal page out of the session history, so Back does not walk
// into it. The server already refuses to serve it — `memberGuard` sets
// `Cache-Control: private, no-store` on the 200 and on the 302 — so this is the
// second bound and not the only one, but on a shared machine "Back shows nothing"
// is worth having without a round trip.

(function () {
  'use strict';

  if (window.__dvnMembersSignout) return;
  window.__dvnMembersSignout = true;

  // ── The one config object ───────────────────────────────────────────────────
  var CONFIG = {
    // Exactly the four folders `memberGuard` gates. Deeper paths match too: every
    // tool page under a tier is inside the same session.
    memberArea: /^\/(gold|platinum|diamond|reserve)(\/|$)/i,
    endpoint: '/members/auth/signout',
    // Where a signed-out member lands. The site root, not /engagement: after signing
    // out on someone else's machine the honest destination is the public site, and
    // it is unambiguous that the member area is behind them.
    after: '/',
    stylesheet: '/css/members-signout.css',
    label: 'Sign out',
    busyLabel: 'Signing out…',
    // One wording for every failure. The member can act on none of them differently,
    // and itemising them would describe our internals to whoever asked.
    error: 'We could not sign you out. Please try again, or close the browser.',
    // Named for a screen reader, because the visible word is one word and the
    // control ends a privileged session.
    ariaLabel: 'Sign out of the member portal',
  };

  var BUTTON_ID = 'dvnms-signout';

  /** Is this document inside the gated member area? */
  function inMemberArea(pathname) {
    return CONFIG.memberArea.test(String(pathname || ''));
  }

  function ensureStyles() {
    if (document.querySelector('link[data-dvnms-styles]')) return;
    var link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CONFIG.stylesheet;
    link.setAttribute('data-dvnms-styles', '');
    (document.head || document.documentElement).appendChild(link);
  }

  /**
   * Where the control goes on THIS page.
   *
   * The 39 member pages come in three shapes and there is no element common to all
   * of them, so the host is resolved rather than assumed:
   *
   *   1. `.phead-right`      — the four portal index pages, beside "Return to
   *                            donovan.law". Already a flex row with its own gap.
   *   2. `.tool-header-inner`— the 15 tool pages that carry a header bar, at the
   *                            end of the row after the back link.
   *   3. a bar of its own    — the remaining 20 (the three SAMPLE documents and the
   *                            tools with no header), inserted after the injected
   *                            utility bar so it sits at the top of the page and in
   *                            the flow. Never position:fixed: a fixed chip would
   *                            land on the utility bar's own right-hand CTA.
   *
   * @returns {{host: Element, wrap: boolean}|null}
   */
  function resolveHost() {
    var phead = document.querySelector('.phead-right');
    if (phead) return { host: phead, wrap: false };

    var toolRow = document.querySelector('.tool-header .tool-header-inner')
      || document.querySelector('.tool-header-inner');
    if (toolRow) return { host: toolRow, wrap: true };

    if (!document.body) return null;
    var bar = document.createElement('div');
    bar.className = 'dvnms-bar';
    // After the utility bar, which `utility-bar-inject.js` prepends to <body> and
    // which is therefore outside `main#perch-main`. Landing after it keeps this bar
    // outside the swap container too — not that the router touches these pages, but
    // "outside the container" is the property that stays true if that ever changes.
    var ubar = document.body.querySelector(':scope > .dl-ubar');
    if (ubar && ubar.nextSibling) document.body.insertBefore(bar, ubar.nextSibling);
    else if (ubar) document.body.appendChild(bar);
    else document.body.insertBefore(bar, document.body.firstChild);
    return { host: bar, wrap: false };
  }

  function build(host, wrap) {
    var button = document.createElement('button');
    button.type = 'button';
    button.id = BUTTON_ID;
    button.className = 'dvnms-signout';
    button.textContent = CONFIG.label;
    button.setAttribute('aria-label', CONFIG.ariaLabel);

    var msg = document.createElement('p');
    msg.className = 'dvnms-msg';
    msg.id = 'dvnms-msg';
    msg.setAttribute('role', 'status');
    msg.setAttribute('aria-live', 'polite');
    msg.hidden = true;

    if (wrap) {
      var slot = document.createElement('div');
      slot.className = 'dvnms-slot';
      slot.appendChild(msg);
      slot.appendChild(button);
      host.appendChild(slot);
    } else {
      host.appendChild(msg);
      host.appendChild(button);
    }

    button.addEventListener('click', function () { submit(button, msg); });
    return button;
  }

  function setBusy(button, on) {
    button.disabled = !!on;
    button.textContent = on ? CONFIG.busyLabel : CONFIG.label;
  }

  function setMsg(msg, text) {
    msg.textContent = text || '';
    msg.hidden = !text;
  }

  function submit(button, msg) {
    if (button.disabled) return;
    setBusy(button, true);
    setMsg(msg, '');

    // `credentials: 'same-origin'` so the cookie the endpoint is clearing is
    // actually on the request. Nothing is read out of the response body: the
    // endpoint's answer is the `Set-Cookie` header, and the status is the whole
    // verdict.
    fetch(CONFIG.endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { Accept: 'application/json' },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('signout ' + res.status);
        (window.top || window).location.replace(CONFIG.after);
      })
      .catch(function () {
        setBusy(button, false);
        setMsg(msg, CONFIG.error);
        button.focus();
      });
  }

  function mount() {
    if (!inMemberArea(window.location && window.location.pathname)) return null;
    if (document.getElementById(BUTTON_ID)) return document.getElementById(BUTTON_ID);
    var slot = resolveHost();
    if (!slot) return null;
    ensureStyles();
    return build(slot.host, slot.wrap);
  }

  // Gated on `document.body`, not on readyState — the same reasoning as
  // js/members-gate.js's `openFromQuery`: `readyState === 'loading'` can be true
  // while body already exists, and waiting for a DOMContentLoaded that has already
  // fired means the control never appears, silently.
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);

  // Exposed for the test suite. Read-only surface: no credential passes through it,
  // and `mount` is idempotent.
  window.__dvnMembersSignoutApi = {
    mount: mount,
    inMemberArea: inMemberArea,
    config: CONFIG,
    buttonId: BUTTON_ID,
  };
})();
