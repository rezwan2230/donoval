// ── DR-INSANE-PERCH-A33: the exposure boundary ───────────────────────────────
//
// Ticket #58 · Phase A / Phase 3 · Order DR-INSANE-A33-DEEXPOSE.
// Follows A2.1 (#74) the layer, A2.2 (#75) the router, A31 (#77) the booking
// control channel, and the A4.1 QA gate that failed them on one acceptance line:
// "no control function exposed on window".
//
// ── WHAT WAS ACTUALLY WRONG ──────────────────────────────────────────────────
// `js/perch-layer.js` published its whole instance:
//
//     window.Perch = Object.assign(window.Perch || {}, { layer: instance });
//
// `instance` carried `setRouter`. `setRouter` installs the function that EVERY
// agent-driven `go(href)` is routed through — so any script in the document
// could hand the layer its own navigation callback and own where Paula sends a
// caller mid-call. It also carried `root` (the live layer node), the `concierge`
// / `call` / `qualifier` getters and `mountShellConcierge`. Each of those is a
// control handle, not a diagnostic. `window.__perch.openQualifier` /
// `closeQualifier` were the same defect one module over.
//
// `window.Perch.router` was already right: one key, `probe()`, read-only, with
// the control functions kept in the router's closure. This module is what makes
// that shape the RULE rather than one file's good manners.
//
// ── §1 · THE NAMESPACE: WHY `Object.assign` COULD NEVER BE ENOUGH ────────────
// Both publishers wrote `window.Perch = Object.assign(window.Perch || {}, …)`.
// That has three separate holes, and hardening the VALUE alone closes none of
// them:
//
//   1. The base object has no author. `window.Perch || {}` adopts whatever is
//      already there. A script that runs first can seed `window.Perch` as an
//      object carrying a `layer` SETTER and capture the instance the moment we
//      publish it — the assignment hands our surface straight to the attacker.
//      See [[feedback_published_instance_is_not_a_probe_namespace]].
//   2. `window.Perch = …` is a plain data property. Anything can reassign the
//      whole namespace afterwards and every later reader sees the replacement.
//   3. Even a frozen surface sitting in a writable slot is swappable — freezing
//      the object is not the same as owning the property that holds it.
//
// So `claim()` takes the property itself with `defineProperty(…, writable:
// false, configurable: false)`, and refuses — fail-closed — if someone else
// already owns it. The namespace object exposes each slot as a GETTER with no
// setter over a module-private `Map`, and is `preventExtensions`'d, so:
//
//   • `window.Perch = x`               → TypeError (non-writable)
//   • `delete window.Perch`            → TypeError (non-configurable)
//   • `window.Perch.layer = x`         → TypeError (accessor, no setter)
//   • `Object.defineProperty(Perch, 'layer', …)` → TypeError (non-configurable)
//   • `window.Perch.anything = x`      → TypeError (non-extensible)
//
// (Every one of those is a TypeError rather than a silent no-op because the
// files that touch this are ES modules, and module code is always strict.)
//
// ── §2 · THE NAVIGATION CHANNEL ──────────────────────────────────────────────
// Removing `setRouter` from the window is necessary and not sufficient: the
// router still has to register, and a `window`-shaped handshake is exactly what
// we are deleting. §2 is that handshake as a module-private slot. A2.2 imports
// `registerRouter`; the layer's host asks `hasRouter()` and calls
// `navigateVia()`. The registered function is never handed back out, so an
// importer cannot read it, wrap it or re-register over it — the first caller
// wins for the life of the document and every later attempt is counted and
// surfaced in `Perch.layer.bookingProbe()`.
//
// ── THE RESIDUAL RISK, STATED PLAINLY ────────────────────────────────────────
// A module export is not a window property, but it is not a secret either: any
// same-origin script can `import('/js/perch/surface.js')` and call
// `registerRouter`. What stops it is that A2.2 registers at boot, so by the time
// any page-level script runs the slot is already taken. On a page where the
// router is NOT enabled (production today — `PERCH_ROUTER` unset, no router
// injected) an attacker who can execute a same-origin module could register
// first. That is not a regression — `setRouter` was a plain window property
// before this ticket, which is strictly easier — and under `script-src 'self'`
// with no inline execution, an attacker who can run a same-origin module has
// already won. It is recorded here rather than left for a reviewer to discover.

// ─────────────────────────────────────────────────────────────────────────────
// §1 · The window namespace
// ─────────────────────────────────────────────────────────────────────────────

/** The one global this architecture is allowed to own. */
export const NAMESPACE = 'Perch';

/**
 * The complete set of slot names. Deny by default: `publish()` refuses anything
 * not on this list, and the namespace is non-extensible, so a new surface has to
 * be added HERE — in a diff a reviewer reads — rather than appearing at runtime.
 */
export const SLOTS = Object.freeze(['layer', 'router']);

/**
 * win → { slots, ns }. A WeakMap rather than a flag on the window: the record
 * that WE own this namespace must not itself be forgeable from the page.
 */
const owned = new WeakMap();

/**
 * Make a surface read-only.
 *
 * Callers pass a fresh object literal, so `freeze` is enough to make every own
 * property non-writable and non-configurable. Kept as a named function anyway
 * because "this object is the published surface" is the thing a reviewer needs
 * to see at the call site.
 */
export function readOnly(surface) {
  return Object.freeze(surface);
}

/**
 * Take ownership of `window.Perch`, or report why we could not.
 *
 * Idempotent for us (the layer claims at mount, the router claims at boot, and
 * either may be the first) and fail-closed against everyone else: if the
 * property already exists and is not ours, we do NOT adopt it and we publish
 * nothing into it. A namespace we do not own is a namespace whose reads and
 * writes someone else can observe.
 *
 * @returns {{ok: boolean, ns?: object, reason?: string}}
 */
export function claim(win) {
  if (!win) return { ok: false, reason: 'no window' };

  const mine = owned.get(win);
  if (mine) return { ok: true, ns: mine.ns, reason: 'already claimed' };

  if (Object.getOwnPropertyDescriptor(win, NAMESPACE)) {
    return { ok: false, reason: 'window.' + NAMESPACE + ' already exists and is not ours' };
  }

  const slots = new Map();
  const ns = {};
  for (const name of SLOTS) {
    Object.defineProperty(ns, name, {
      get: () => slots.get(name),
      // No setter, and non-configurable: the slot cannot be assigned to and
      // cannot be redefined into a data property later.
      enumerable: true,
      configurable: false,
    });
  }
  Object.preventExtensions(ns);

  try {
    Object.defineProperty(win, NAMESPACE, {
      value: ns, writable: false, enumerable: true, configurable: false,
    });
  } catch (e) {
    return { ok: false, reason: 'defineProperty failed: ' + String(e) };
  }

  owned.set(win, { slots, ns });
  return { ok: true, ns };
}

/**
 * Publish a read-only surface into a claimed slot. One writer, once.
 *
 * A second `publish()` for the same slot is REFUSED rather than allowed to
 * overwrite — re-publication is how a replacement would get in, and there is no
 * legitimate caller for it: `mount()` is idempotent and the router boots once.
 *
 * @returns {{ok: boolean, reason?: string}}
 */
export function publish(win, name, surface) {
  const reg = owned.get(win);
  if (!reg) return { ok: false, reason: 'namespace not claimed' };
  if (!SLOTS.includes(name)) return { ok: false, reason: 'unknown slot: ' + name };
  if (reg.slots.has(name)) return { ok: false, reason: 'slot already published: ' + name };
  reg.slots.set(name, readOnly(surface));
  return { ok: true };
}

/**
 * Lock a plain read-only object onto a window property of its own.
 *
 * For `window.__perch`, which predates `Perch` and is documented in
 * RE-INIT-INVENTORY §4. Same posture: define it, never assign it, never adopt
 * an existing one.
 *
 * @returns {{ok: boolean, reason?: string}}
 */
export function lockGlobal(win, name, surface) {
  if (!win) return { ok: false, reason: 'no window' };
  if (Object.getOwnPropertyDescriptor(win, name)) {
    return { ok: false, reason: 'window.' + name + ' already exists' };
  }
  try {
    Object.defineProperty(win, name, {
      value: readOnly(surface), writable: false, enumerable: true, configurable: false,
    });
  } catch (e) {
    return { ok: false, reason: 'defineProperty failed: ' + String(e) };
  }
  return { ok: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// §2 · The private navigation channel
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Module-private, and therefore per-document: a module instance is created once
 * per page load and dies with it. This is the replacement for the layer host's
 * `let router = null` + `host.setRouter`, and it is deliberately NOT a closure
 * variable inside `mount()` any more — the router registers before/independently
 * of the layer's public surface existing, and routing it through a published
 * object is precisely the defect A33 removes.
 */
let router = null;
let refusedRegistrations = 0;
/** Callbacks waiting for a router. Drained once, on the winning registration. */
let routerWaiters = [];

/**
 * Register the soft-navigation function. A2.2 is the intended and only caller.
 *
 * First caller wins for the life of the document. The function is never returned
 * to anyone, so it cannot be read, wrapped or replaced once it is in.
 *
 * @param {(href: string) => void} fn
 * @returns {{ok: boolean, reason?: string}}
 */
export function registerRouter(fn) {
  if (typeof fn !== 'function') {
    refusedRegistrations++;
    return { ok: false, reason: 'router must be a function' };
  }
  if (router) {
    refusedRegistrations++;
    return { ok: false, reason: 'a router is already registered' };
  }
  router = fn;
  const waiters = routerWaiters;
  routerWaiters = [];
  for (const cb of waiters) {
    // One bad listener must not stop the others, and must not fail the
    // registration that has already succeeded.
    try { cb(); } catch (e) { /* a waiter's problem, not the router's */ }
  }
  return { ok: true };
}

/**
 * Run `cb` once, as soon as a router is registered — immediately if one already is.
 *
 * ── WHY THIS EXISTS (SHELDON-PERCH-COMMAND-CHANNEL) ──────────────────────────
 * The layer's command consumer is gated on the router, because with
 * `PERCH_ROUTER` unset in production there is no router, no swap and no consumer,
 * and the deployment stays byte-identical to what ships today. But the layer
 * cannot read that gate at its own mount: both modules are `type="module"` in
 * `<head>`, so they run deferred in tag order — the layer's `DOMContentLoaded`
 * handler is registered first and therefore fires first, and the router's
 * `registerRouter()` happens later still, after it has awaited `swup.umd.js`.
 * `hasRouter()` at layer mount is ALWAYS false, router or no router.
 *
 * The alternatives were a timer polling `hasRouter()` — which has to pick a
 * timeout, and picks it wrong on a slow connection — or having the router import
 * the layer, which inverts the dependency the injector's tag order encodes. A
 * one-shot callback on the existing module-private slot is neither.
 *
 * It hands out nothing: the callback receives no arguments and the registered
 * router is still never returned to any caller. Registering a waiter cannot
 * install, read, wrap or displace a navigation function.
 *
 * @param {() => void} cb
 * @returns {{ok: boolean, immediate?: boolean, reason?: string}}
 */
export function onRouterRegistered(cb) {
  if (typeof cb !== 'function') return { ok: false, reason: 'callback must be a function' };
  if (router) { cb(); return { ok: true, immediate: true }; }
  routerWaiters.push(cb);
  return { ok: true, immediate: false };
}

/** Is a soft navigation available? The A31 booking gate reads exactly this. */
export function hasRouter() {
  return router !== null;
}

/**
 * Navigate through the registered router, if there is one.
 * @returns {boolean} true if a router handled it; false if the caller must fall
 *   back to a hard navigation.
 */
export function navigateVia(href) {
  if (!router) return false;
  router(href);
  return true;
}

/**
 * Read-only state of the channel, for `bookingProbe()`.
 *
 * `refused` is not decoration: a non-zero count on a live page is a script that
 * tried to install a second navigation callback, and it is the only way that
 * attempt is ever visible.
 */
export function routerLock() {
  return { registered: router !== null, refused: refusedRegistrations, waiting: routerWaiters.length };
}
