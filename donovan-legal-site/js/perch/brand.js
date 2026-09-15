// ── JORDAN-PERCH-PHOTO-PAULA: the concierge's face, spelled once ─────────────
//
// Paula's photograph is shown in three places, and until this ticket each one
// spelled the path itself:
//
//   • the shell orb          — `#concierge .disc .face` in perch.html
//   • the content-page orb   — the dressed `#dvn-perch-launcher` (donovan-widget.js)
//   • the qualifier header   — `#qual .hd .mk`, which showed the FIRM LOGO instead
//
// The qualifier was the odd one out: a caller mid-call tapped their income into a
// card badged with a logo mark, not the face of the person who had just asked for
// it. Fixing that by pasting a fourth copy of the path would have made the drift
// worse, so the path moved here first.
//
// ── THE RULE THIS FILE EXISTS TO ENFORCE ────────────────────────────────────
// Changing the concierge's photograph must be ONE FILE — replace the bytes at
// `donovan-legal-site/img/Paula.jpg` and ship. No code edit, no second crop, no
// hunt for the copy someone forgot. `test/perch-paula-canonical.test.mjs` fails
// if a `Paula.jpg` literal appears anywhere outside the three places that
// structurally cannot import this module (see that file for which, and why).
//
// ── WHY THE PATH AND NOT THE ALT TEXT ───────────────────────────────────────
// One asset, but NOT one alt string — the two sites have different roles and
// therefore different accessible names:
//
//   the orb        is a control. Its name says what activating it does
//                  ("Talk to Donovan Legal — click to chat"), and on the widget's
//                  launcher the <button> already carries that name, so the <img>
//                  inside it is correctly `alt=""`.
//   the qualifier  header is not actionable. Its face IDENTIFIES who is asking
//                  for the figures being tapped in, which is information a
//                  screen-reader caller has no other way to get.
//
// Collapsing those into one exported string would have to pick one role and be
// wrong in the other, so alt text stays at each call site, next to the element
// whose role decides it. Only the asset is shared.

/**
 * The concierge portrait. Same-origin, so `img-src 'self'` already admits it —
 * this ticket changes no CSP directive.
 *
 * Consumed by js/perch/chrome.js (the orb) and js/perch/qualifier.js (the
 * modal header). Root-relative on purpose: both modules are loaded from
 * `/js/perch/` on the shell and from the injected layer on 139 content pages at
 * every directory depth, so a relative specifier would resolve differently per
 * page.
 */
// The concierge is retired. The card the visitor sees is the firm's intake, so
// the face on it is the attorney they are booking with: the same square headshot
// the floating booking widget uses as its poster (versioned there, reused here —
// one asset, one crop, already cached by every visitor who has seen the widget).
export const INTAKE_FACE = '/img/paul-book-float-poster-v2.jpg';
