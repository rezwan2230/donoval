// ── SHELDON-PERCH-A22: referencing the Swup router from every content page ────
//
// Ticket #52. Same argument as _lib/perch-layer-inject.js: the router has to load
// on ~96 hand-authored pages, editing 96 files is what A0.1 spent a ticket
// avoiding, and a 97th page authored next month would miss it. So the reference
// is injected as the HTML streams out, from the same pass and the same `plan`
// that injects the container and the layer.
//
// ── THE PAIRING RULE, EXTENDED ───────────────────────────────────────────────
// A0.1 gives a page a container; A2.1 gives that page a layer; this gives it a
// router. All three derive from one `plan`, so the arrangement cannot be broken
// by editing one file and forgetting another:
//   • a container with no router is the site as it is today — correct, just not
//     soft-navigating;
//   • a router with no container has nothing to swap and Swup throws looking for
//     one, which is why `wantsRouter` is `plan.kind !== 'skip'` and not a path list.
//
// ── WHY THIS DOES NOT TOUCH THE CSP ──────────────────────────────────────────
// The injected tag is an external reference to a same-origin module. `script-src
// 'self'` already admits it, so no directive changes and no nonce is required —
// and the router itself only ever inserts external `src` scripts, for the same
// reason. (An inline bootstrap WOULD need the per-request nonce, which is exactly
// why this is a file.)
//
// ── WHY THE TAGS ARE A STRING AND NOT A SECOND HANDLER ───────────────────────
// lol-html keeps only the LAST `onEndTag` callback registered for an element, so
// two independent `['head', …]` handlers that each call `el.onEndTag()` do not
// compose — the first one's insertion is silently dropped. Registering the router
// as its own head handler would therefore have deleted the persistent layer's
// tags and left no trace anywhere. So the router's tag is handed to
// `layerHandlers(plan, extraTags)` and both are emitted from ONE callback.
// test/perch-swup-router.test.mjs asserts both survive a real rewrite.

/** Kept in one place so the CI test can assert what gets injected. */
export const ROUTER_MODULE = '/js/perch-swup-router.js';

export const ROUTER_TAGS = `<script type="module" src="${ROUTER_MODULE}"></script>`;

/**
 * Should this page reference the router at all?
 *
 * `plan` is the output of `decidePlan` in ./perch-main.js. A 'skip' plan means the
 * page has no swap container — the shell, or a fragment with no swappable content.
 */
export function wantsRouter(plan) {
  return !!plan && plan.kind !== 'skip';
}

/**
 * Is soft navigation enabled for this deployment?
 *
 * PREVIEW-FIRST, and fail-safe in the direction of "the site behaves exactly as it
 * does today". #52 was Preview-first because Phase 3 had not yet wired the booking
 * control channel into the top-level document (RE-INIT-INVENTORY §5 rows 7 and 8).
 * A31 (#56) has now wired it — js/perch/booking-control.js — so that particular
 * blocker is cleared, and the DEFAULT BELOW IS DELIBERATELY UNCHANGED anyway:
 * turning production on is a decision for whoever owns the shell retirement (A5),
 * made deliberately, with a variable:
 *
 *   PERCH_ROUTER=on    soft navigation everywhere, including production
 *   PERCH_ROUTER=off   kill switch — full navigation everywhere, no redeploy
 *   unset (default)    *.pages.dev and localhost only
 *
 * Keyed on the request hostname rather than on CF_PAGES_BRANCH: the branch
 * variables are documented for the Pages BUILD environment, and a gate that
 * silently reads `undefined` in the Functions runtime would default production to
 * whatever the `!==` happened to yield. The hostname is a fact the Worker always
 * has. This is a feature gate, not a security control — nothing behind it is
 * privileged, and the router changes navigation only.
 *
 * @param {Record<string, unknown> | undefined} env
 * @param {string} url the request URL
 */
export function routerEnabled(env, url) {
  const flag = env && typeof env.PERCH_ROUTER === 'string' ? env.PERCH_ROUTER.trim().toLowerCase() : '';
  if (flag === 'on') return true;
  if (flag === 'off') return false;

  let host;
  try {
    host = new URL(url).hostname;
  } catch (e) {
    return false; // cannot tell where we are → behave like production
  }
  return /\.pages\.dev$/i.test(host) || host === 'localhost' || host === '127.0.0.1';
}

/**
 * The tag to hand to `layerHandlers(plan, extraTags)`, or '' when this page or
 * this deployment does not get a router.
 */
export function routerTags(plan, env, url) {
  return wantsRouter(plan) && routerEnabled(env, url) ? ROUTER_TAGS : '';
}
