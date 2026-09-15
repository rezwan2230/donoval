// ── JORDAN-PERCH-A21: where the persistent layer is allowed to live ──────────
//
// The placement rules live in their own module, with no imports and no top-level
// side effects, for one reason: they are the ticket's actual contract, and CI has
// to be able to exercise THEM rather than a re-implementation of them.
// `js/perch-layer.js` pulls in the Retell SDK, the consent gate and the orb DOM,
// none of which a Node test can or should load — so a test that imported it
// would end up asserting against a copied `insertBefore`, which is exactly the
// class of test that passes while the shipped code is wrong.
//
// See [[feedback_assert_behavior_not_source_spelling]].

/** The one container the router (A2.2) is allowed to swap.
 *  Mirrors CONTAINER_ID in functions/_lib/perch-main.js, which runs in the
 *  Workers runtime and cannot be imported here. test/perch-layer.test.mjs
 *  asserts the two never drift. */
export const CONTAINER_ID = 'perch-main';

/** The one element the router must never touch. */
export const LAYER_ID = 'perch-persistent';

export const CONTAINER_SELECTOR = '#' + CONTAINER_ID;
export const LAYER_SELECTOR = '#' + LAYER_ID;

/** Dispatched on the layer root once the layer has mounted. */
export const EVENT_MOUNTED = 'perch:layer-mounted';

/** Dispatched on `document` by the router (A2.2) once new content is in place. */
export const EVENT_SWAPPED = 'perch:content-swapped';

/**
 * Is this node part of the persistent layer?
 *
 * The router's teardown/re-init pass must ask this before touching anything.
 * Pure, so A2.2 can call it with or without a mounted layer.
 */
export function isPersistent(node) {
  if (!node || !node.closest) return false;
  return !!node.closest(LAYER_SELECTOR);
}

/**
 * Diagnose the current placement.
 *
 * Returns the reasons, not just a verdict, because all four callers — the mount,
 * the post-swap guard, the CI test and the Preview verifier — need to report
 * WHICH property failed.
 */
export function inspect(doc) {
  const container = doc.getElementById(CONTAINER_ID);
  const layer = doc.getElementById(LAYER_ID);
  const orb = doc.getElementById('concierge');

  const layerInsideContainer = !!(container && layer && container.contains(layer));
  const orbInsideContainer = !!(container && orb && container.contains(orb));

  const describe = (el) => (el && el.parentNode && el.parentNode.nodeName
    ? el.parentNode.nodeName.toLowerCase() + (el.parentNode.id ? '#' + el.parentNode.id : '')
    : null);

  return {
    hasContainer: !!container,
    hasLayer: !!layer,
    hasOrb: !!orb,
    /** THE invariant. Both must be false on every page, always. */
    layerInsideContainer,
    orbInsideContainer,
    /** The ticket's stated placement: the layer shares the container's parent. */
    isDirectSibling: !!(container && layer && layer.parentNode === container.parentNode),
    orbInsideLayer: !!(layer && orb && layer.contains(orb)),
    layerParent: describe(layer),
    containerParent: describe(container),
    ok: !!container && !!layer && !layerInsideContainer && !orbInsideContainer,
  };
}

/**
 * Is the layer genuinely viewport-anchored, or has an ancestor containing block
 * captured it?
 *
 * A `position:fixed` element with `inset:0` and no containing-block ancestor
 * measures exactly the viewport. Any ancestor carrying `transform`, `filter`,
 * `perspective`, `backdrop-filter`, `contain` or a `will-change` naming one of
 * those turns itself into the containing block instead — and the orb would be
 * positioned against a card somewhere mid-page, possibly clipped out of view.
 *
 * This is measured rather than inferred from the stylesheet, so a rule added to
 * site chrome three months from now is caught by the same check.
 */
export function isViewportAnchored(layer) {
  const win = layer.ownerDocument.defaultView;
  if (!win || !win.getComputedStyle) return true; // no layout engine (jsdom) → nothing to measure

  // Not `fixed` yet means css/perch-layer.css has not applied. That is a loading
  // state, NOT a trapped layer; concluding otherwise would demote every page to
  // the fallback placement whenever the stylesheet is slow.
  if (win.getComputedStyle(layer).position !== 'fixed') return true;

  const r = layer.getBoundingClientRect();
  const tol = 1; // sub-pixel rounding
  return Math.abs(r.top) <= tol
    && Math.abs(r.left) <= tol
    && Math.abs(r.width - win.innerWidth) <= tol + 20 // scrollbar gutter
    && Math.abs(r.height - win.innerHeight) <= tol;
}

/**
 * Put the layer in the DOM, outside the swap container.
 *
 * Placement 1 is the ticket's contract — immediately after the container, in the
 * container's own parent, making it a DIRECT SIBLING on all 30 body shapes A0.1
 * produces. `insertBefore(layer, container.nextSibling)` is the insert-after
 * idiom; when the container is the last child, `nextSibling` is null and this
 * degrades to an append, still within the same parent.
 *
 * Placement 2 is the fallback for a trapped layer: `document.body`. A body child
 * cannot be a descendant of a `<main>` that is itself a body descendant, so the
 * load-bearing invariant holds either way — the weaker placement is reported
 * through `hostFallback` rather than silently accepted.
 *
 * @returns {{ok: boolean, hostFallback: boolean, reason?: string}}
 */
export function placeLayer(doc, layer) {
  const container = doc.getElementById(CONTAINER_ID);
  if (!container || !container.parentNode) {
    return { ok: false, hostFallback: false, reason: 'no swap container' };
  }

  container.parentNode.insertBefore(layer, container.nextSibling);

  let hostFallback = false;
  if (!isViewportAnchored(layer)) {
    doc.body.appendChild(layer);
    hostFallback = true;
  }

  if (container.contains(layer)) {
    // Unreachable by construction — neither placement is inside the container —
    // but this is the invariant the whole ticket exists to hold, so it is
    // asserted rather than assumed.
    layer.remove();
    return { ok: false, hostFallback, reason: 'refusing to mount inside ' + CONTAINER_SELECTOR };
  }

  return { ok: true, hostFallback };
}
