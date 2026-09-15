// --- tel:/mailto: frame escape ---------------------------------------------
// WHY: every page of this site renders inside the #site iframe on /perch. A
// tel: or mailto: anchor with no target navigates the IFRAME, and the shell's
// frame-src CSP does not allow those schemes, so Cloudflare serves the
// blocked-content page instead of handing off to the OS. Escaping to the TOP
// browsing context lets the phone/mail handler fire and leaves the framed page
// exactly where it was. Same family as the empty-frame-source finding.
//
// Vanilla + first in the file on purpose: this must not depend on jQuery
// having loaded, and it must not be an inline script (nonce CSP).
// Only `target` and `rel` are touched — never the href.
(function () {
  'use strict';
  var ESCAPE = /^\s*(tel|mailto):/i;

  function escapeAnchor(a) {
    if (!a || !ESCAPE.test(a.getAttribute('href') || '')) return;
    a.setAttribute('target', '_top');
    if (!a.getAttribute('rel')) a.setAttribute('rel', 'noopener');
  }

  function sweep(root) {
    (root || document).querySelectorAll('a[href^="tel:"], a[href^="mailto:"]').forEach(escapeAnchor);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { sweep(); });
  } else {
    sweep();
  }

  // Safety net for anchors injected after the sweep (widget, soft-nav body swap):
  // the browser reads `target` when it runs the default action, so setting it
  // during the capture phase still redirects the navigation. Nothing is
  // prevented or rewritten here.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a) escapeAnchor(a);
  }, true);
})();

// --- MEMBERS portal gate loader ---------------------------------------------
// WHY: the MEMBERS dropdown links the four tier directories, which tier-auth.js
// gates with Basic auth and fails closed — so with TIER_*_USER/PASS unset the
// public gets a 503 from GOLD/PLATINUM/DIAMOND/RESERVE on every page. The
// dropdown is duplicated across 74 pages, so the intercept ships here, in the
// one script they all already load, rather than as 148 markup edits.
//
// An external <script src>, NOT inline: the CSP in functions/_middleware.js is
// `script-src 'self' 'nonce-…'` with strict-dynamic deliberately NOT set, so a
// same-origin src is admitted by 'self' and needs no nonce. Absolute path
// because this file is loaded as both "js/main.js" and "../js/main.js".
// Vanilla and above the jQuery calls on purpose — same reason as the escape.
// No `defer`: a dynamically inserted script is async by definition, so the
// attribute would be a no-op that reads like a guarantee. The gate is
// self-contained and binds a document-level listener, so load order is moot.
document.head.appendChild(Object.assign(document.createElement('script'), { src: '/js/members-gate.js' }));

$(".img-hover").click(function () {
  $(this).addClass("hidden", 1000, "easeInBack");
});

$(".mobile-hover").click(function () {
  $(this).addClass("hidden", 1000, "easeInBack");
});

$(".cmm-logo-hover").click(function () {
  $(this).addClass("hidden", 1000, "easeInBack");
});

jQuery(function ($) {
  var pop = $('.pin-popup');
  pop.click(function (e) {
    e.stopPropagation();
  });

  $('a.marker').click(function (e) {
    e.preventDefault();
    e.stopPropagation();
    $(this).next('.pin-popup').toggleClass('open');
    $(this).parent().siblings().children('.pin-popup').removeClass('open');
  });

  $(document).click(function () {
    pop.removeClass('open');
  });

  pop.each(function () {
    var w = $(window).outerWidth(),
      edge = Math.round(($(this).offset().left) + ($(this).outerWidth()));
    if (w < edge) {
      $(this).addClass('edge');
    }
  });
});

$(document).ready(function () {
  $(".hamburger").click(function () {
    $('.nav-mobile-overlay').addClass("open");
    $('body').addClass("no-scroll");
  });
  $(".btn-close.menu").click(function () {
    closeMobileNav();
  });

  // ── Close the mobile overlay when a link inside it is followed ─────────────
  //
  // BUG: tapping a nav item appeared to do nothing. It was navigating — the
  // soft router swaps the content in place rather than reloading the document,
  // so there is no new page load to clear `.open`, and `.nav-mobile-overlay.open`
  // is a fixed, opaque, full-viewport panel at z-index 1031. The visitor was
  // looking at the menu sitting on top of the page they had just navigated to,
  // and only saw it after tapping the close button.
  //
  // Delegated, so it also covers menu markup rendered after a swap.
  $(document).on('click', '.nav-mobile-overlay a[href]', function () {
    closeMobileNav();
  });
});

/** Single place that closes the mobile overlay and releases the scroll lock. */
function closeMobileNav() {
  $('.nav-mobile-overlay').removeClass("open");
  $('body').removeClass("no-scroll");
}

// Safety net: any content swap ends with the overlay closed, whatever caused it
// — link tap, back/forward, or a programmatic navigation from the assistant.
document.addEventListener('dl:content-swapped', function () {
  var o = document.querySelector('.nav-mobile-overlay');
  if (o) o.classList.remove('open');
  document.body.classList.remove('no-scroll');
});

$('.dropdown').hover(function () {
  $(this).find('.dropdown-menu').stop(true, true).delay(100).fadeIn(200);
}, function () {
  $(this).find('.dropdown-menu').stop(true, true).delay(100).fadeOut(200);
});

$('#theFirm').click(function (e) {
  e.preventDefault();

  setTimeout(function () {
    window.location.href = "ourfirm.html";
  }, 1000);

});

$('#thePractice').click(function (e) {
  e.preventDefault();

  setTimeout(function () {
    window.location.href = "the-cmm.html";
  }, 1000);

});

$(function () {
  $("#btn-tf").click(function () {
    $("#fa-tf").toggleClass("hidden");
  });
});

$(function () {
  $("#btn-tp").click(function () {
    $("#fa-tp").toggleClass("hidden");
  });
});
