// ── Floating booking widget, injected at the edge on every page ─────────────
//
// Two targets side by side: Paul's introduction video (static poster; a click
// plays it WITH sound — a user gesture is what unlocks audio) and the Book
// pill, a plain same-origin <a> to the booking flow that works before any JS
// loads and under every CSP state.
//
// ── WHY EVERY PAGE, INCLUDING /book (THE SOFT-NAVIGATION FIX) ────────────────
// Production runs the Swup router (PERCH_ROUTER=on). A soft navigation swaps
// `main#perch-main` only; this widget is appended at the END of <body>, outside
// that container, so it PERSISTS across swaps — and the router's head sync
// (js/perch/reinit.js `syncHead`) reconciles stylesheet links against the
// INCOMING document, protecting only the two shell sheets. The first cut of
// this injector emitted neither markup nor stylesheet on /book, which produced
// exactly two live defects:
//   • soft-navigate INTO /book: the widget survived the swap, the incoming head
//     did not declare its stylesheet, syncHead removed it → a 480px raw <video>
//     parked below the footer with a bare text link beside it;
//   • land on /book by full load (no markup), then soft-navigate anywhere: the
//     incoming page's widget markup sits outside the container and is never
//     adopted → no widget until a hard refresh.
// So the stylesheet, the behaviour module and the markup now ship on EVERY
// content page, identically. syncHead keeps a link whose signature the incoming
// head also declares, and the markup is already in the live document. What
// changes per page is only VISIBILITY: the edge stamps `dl-bf-suppress` on
// <body> for the protocol pages (a full load with JS off still hides it), and
// js/dl-book-float.js re-derives that class from `location.pathname` on every
// swap, because Swup does not sync <body> attributes either.
//
// ── ASSET NAMES ARE VERSIONED ON PURPOSE ─────────────────────────────────────
// `_headers` serves /img/* as `public, max-age=31536000, immutable`. Replacing
// a file under the same name never reaches a browser that has seen the old one
// (the v1 muted loop kept playing for a year of visits). Bump the suffix when
// the media changes; never overwrite in place.

export const FLOAT_STYLESHEET = '/css/dl-book-float.css';
export const FLOAT_SCRIPT = '/js/dl-book-float.js';
export const FLOAT_STYLESHEET_TAG = `<link rel="stylesheet" href="${FLOAT_STYLESHEET}">`
  + `<script type="module" src="${FLOAT_SCRIPT}"></script>`;

export const FLOAT_VIDEO = '/img/paul-book-float-v2.mp4';
export const FLOAT_POSTER = '/img/paul-book-float-poster-v2.jpg';

/** Same destination as every other CTA on the site. Extensionless. */
const BOOKING_HREF = '/book';

const MEDIA_HTML = '<button class="dl-bf-media" type="button"'
  + ' aria-label="Play introduction video">'
  + `<video src="${FLOAT_VIDEO}" poster="${FLOAT_POSTER}"`
  + ' preload="metadata" playsinline disablepictureinpicture></video>'
  + '<span class="dl-bf-play" aria-hidden="true"></span>'
  + '</button>';

/** `data-perch-book` marks the pill as a BOOK INTENT, exactly as the header
 *  utility bar's link is marked (utility-bar-inject.js): js/perch-layer.js's
 *  capture-phase click handler opens the full intake card IN PLACE — matter →
 *  drill-down → state → who it concerns → income → net worth — and on
 *  completion writes the booking unlock and swaps to /book with the calendar
 *  revealed. Without the attribute the pill was a plain navigation to /book,
 *  where a visitor who had already dismissed the card in this document got
 *  only the three-question floor. The href stays: with no layer, no router or
 *  no JS the link still lands on /book, whose own gate offers the card. */
export const FLOAT_HTML = '<div class="dl-book-float">'
  + MEDIA_HTML
  + `<a class="dl-bf-cta" href="${BOOKING_HREF}" data-perch-book="float_cta">Book a Free Consultation</a>`
  + '</div>';

/** The body class that hides the widget. Mirrored in js/dl-book-float.js. */
export const SUPPRESS_CLASS = 'dl-bf-suppress';

/** Paths where the widget must not be VISIBLE: the protocol it points at.
 *  Mirrored in js/dl-book-float.js — keep the two lists identical. */
const SUPPRESS = new Set(['/book', '/book.html', '/engagement', '/engagement.html']);

export function wantsFloat(pathname) {
  return !SUPPRESS.has(pathname);
}

/** PREPENDS the widget markup right after the <body> start tag on every page,
 *  and stamps the suppress class on the protocol pages. One handler doing
 *  both, so the markup and the class can never disagree.
 *
 *  ── WHY PREPEND AND NOT APPEND ──────────────────────────────────────────────
 *  The first cut used `el.append()`, which emits just before `</body>`. On the
 *  `wrap-body` plan with no trailing non-content child (perch-main.js:
 *  `closeBeforeBodyKid === null`) the swap container's `</main>` is ALSO
 *  emitted at the body end tag — and lol-html writes the appended content
 *  first — so the widget landed INSIDE `main#perch-main`. Swup then replaced
 *  the container on the first navigation and the widget went with it; the
 *  incoming page's copy sat outside its own container (a page with a real
 *  <main>) and was never adopted. Hence "video and button disappear after one
 *  click". Prepended content lands before the first body child, which is
 *  before the container can open on every plan (`stamp`, `wrap-div`, and
 *  `wrap-body`'s `el.before(OPEN_TAG)` on body child 0), so it is outside the
 *  swap region on every page shape — the same reason the utility bar prepends.
 *  The widget is position:fixed, so its place in the DOM is invisible. */
class FloatAppender {
  constructor(visible) { this.visible = visible; }
  element(el) {
    if (!this.visible) {
      const existing = el.getAttribute('class');
      el.setAttribute('class', existing ? `${existing} ${SUPPRESS_CLASS}` : SUPPRESS_CLASS);
    }
    el.prepend(FLOAT_HTML, { html: true });
  }
}

/** Every content page carries the stylesheet + module — see the header. */
export function floatStylesheetTag(/* pathname */) {
  return FLOAT_STYLESHEET_TAG;
}

export function floatHandlers(pathname) {
  return [['body', new FloatAppender(wantsFloat(pathname))]];
}
