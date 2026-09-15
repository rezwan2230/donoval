// ── JORDAN-PERCH-A21: referencing the persistent layer from every content page ─
//
// The layer has to load on ~143 hand-authored pages. Editing 143 files to add
// two tags is the thing A0.1 spent a whole ticket avoiding, and it would go
// stale the moment a 144th page is authored. So the reference is injected as the
// HTML streams out, from the SAME pass that injects the swap container.
//
// ── THE PAIRING RULE ─────────────────────────────────────────────────────────
// The layer is injected if and only if A0.1 gave the page a container. That is
// not a convenience — it is what keeps the two halves of the architecture from
// drifting apart:
//
//   • A page with a container but no layer has a swap region and nothing to
//     protect from it — the call would die on the first navigation.
//   • A page with a layer but no container has an orb with no swap region, and
//     on `perch.html` specifically it would be the SECOND orb on screen, because
//     the reason A0.1 skips that page is that it already hosts one.
//
// Deriving both from the same `plan` object means the rule cannot be violated by
// editing one file and forgetting the other.
//
// ── WHY THIS DOES NOT TOUCH THE CSP ──────────────────────────────────────────
// Both injected tags are external references to same-origin assets. `script-src
// 'self'` and `style-src 'self'` already admit them, so no directive changes and
// no nonce is required. (An inline tag WOULD need the per-request nonce, which
// is exactly why the layer is a file and not a bootstrap snippet.)

/** Kept in one place so the CI test can assert what gets injected. */
export const LAYER_STYLESHEET = '/css/perch-layer.css';
export const LAYER_MODULE = '/js/perch-layer.js';

const TAGS = `<link rel="stylesheet" href="${LAYER_STYLESHEET}">`
  + `<script type="module" src="${LAYER_MODULE}"></script>`;

/**
 * Should this page reference the persistent layer?
 *
 * `plan` is the output of `decidePlan` in ./perch-main.js. A 'skip' plan means
 * the page has no swap container — the shell, or a fragment with no swappable
 * content.
 */
export function wantsLayer(plan) {
  return !!plan && plan.kind !== 'skip';
}

/**
 * HTMLRewriter handlers that append the layer's tags to `<head>`.
 *
 * `extraTags` (SHELDON-PERCH-A22, #52) is emitted immediately after the layer's
 * own tags, from this same callback, and it exists because of a sharp edge in
 * lol-html: only the LAST `onEndTag` callback registered for an element survives,
 * so a second independent `['head', …]` handler calling `el.onEndTag()` silently
 * DELETES this one's insertion — the layer would simply stop loading, with no
 * error anywhere. Anything else that needs a tag in `<head>` therefore composes
 * here rather than registering its own handler. The order is deliberate too: both
 * modules register a DOMContentLoaded handler at evaluation time, and the layer's
 * must run first — the router's swap dispatches the event the layer listens for,
 * and a swap that fires before the layer exists is a swap with nothing protecting
 * the call. (Until DR-INSANE-A33 (#58) the router also READ `window.Perch.layer`
 * to register itself. It no longer does — that handshake is a module import now —
 * but the mount-before-boot ordering this tag order produces is still required.)
 *
 * Appended at the END of head rather than the start, for two reasons: the
 * stylesheet then follows the site's own stylesheets, so equal-specificity
 * rules resolve in the layer's favour; and a render-blocking `<link>` placed
 * before the `type="module"` script guarantees the CSSOM is in place when the
 * module runs, which is what `isViewportAnchored()` in js/perch-layer.js needs
 * in order to distinguish "trapped by a containing block" from "stylesheet has
 * not applied yet".
 *
 * `onEndTag` rather than `el.append()` because a page whose `</head>` is
 * implicit still gets an end-tag callback from lol-html, whereas append on a
 * self-closed/absent head has nothing to attach to.
 */
export function layerHandlers(plan, extraTags = '') {
  if (!wantsLayer(plan)) return [];
  let done = false;
  return [['head', {
    element(el) {
      el.onEndTag((tag) => {
        if (done) return; // one head per document; a malformed second one is ignored
        done = true;
        tag.before(TAGS + (extraTags || ''), { html: true });
      });
    },
  }]];
}
