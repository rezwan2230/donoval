# The Perch persistent layer — the boundary A2.2 must not cross

**JORDAN-PERCH-A21 · ticket #51 · Phase A / Phase 2 · depends on A0.1 (#66)**

This document is the contract between the persistent layer (this ticket) and the
Swup router (A2.2, ticket #52). It exists so the router can re-initialise page
content on every swap without ever needing to know what the concierge is.

> Kept at the repo root, not under `donovan-legal-site/`. The Pages deploy root
> IS `donovan-legal-site` and `wrangler pages deploy` has no `--exclude`, so
> anything dropped in there is published. Six internal `.md` files were found
> served `200` that way once already.

---

## 1. The two regions

Every content page the site serves now has exactly two structural regions the
router cares about:

| Region | Selector | Owner | Lifetime |
|---|---|---|---|
| Swap container | `main#perch-main` | A0.1 (`functions/_lib/perch-main.js`) | replaced on every navigation |
| Persistent layer | `div#perch-persistent` | A2.1 (`js/perch-layer.js`) | one per document, never replaced |

The layer is inserted as a **direct sibling of the container**, immediately
after it, in the container's own parent. That placement is asserted for all
**141** container pages in `test/perch-layer.test.mjs` and measured on Preview by
`verify/verify-a21.mjs`.

Both are injected as the HTML streams out, from the same buffered
`HTMLRewriter` pass. A page gets **both or neither** — the layer reference is
derived from the same `plan` object that decides the container
(`functions/_lib/perch-layer-inject.js`), so the two cannot drift apart by
someone editing one file.

### What lives in the layer

On a content page the concierge is **`js/donovan-widget.js`** — loaded by 139 of
143 pages. It renders `#dvn-perch-launcher` (plus its caption pill), mints from
`/web-call`, and owns a `RetellWebClient`. It appends itself into the layer:

```js
const host = document.getElementById('perch-persistent') || document.body;
```

The **shell orb** (`#concierge` + `#caption` + `#qual`, with its own Retell call,
consent gate, page-control poll and prefill loop) is the *other* implementation,
shared through `js/perch/{chrome,call,qualifier}.js`. The shell drives it today
through an iframe host adapter; the layer can take it over with
`mountShellConcierge()` — a module export of `js/perch-layer.js` since A33 (#58),
never a window property — when `/` stops iframing the site.

**The layer never mounts both.** The first revision of this ticket did, and the
Preview check caught it: the shell orb and the widget launcher landed in the same
bottom-right corner at the same `z-index: 2147483000`, and `elementFromPoint` at
the orb's own centre returned the *launcher* — the orb was visible and
unclickable. Every presence assertion passed on that; only the hit test found it.
Choosing which concierge a page should show is a product call this ticket does
not own.

Whichever it is, none of it is a descendant of `main#perch-main` on any page.
That is the whole ticket.

---

## 2. The rule

> **The router must never read, write, move, clone or remove any node for which
> `isPersistent(node)` returns true.**

```js
import { isPersistent, LAYER_SELECTOR, CONTAINER_SELECTOR } from '/js/perch/placement.js';
```

`js/perch/placement.js` has no imports and no side effects, so the router can
import it without pulling in the Retell SDK or the consent gate.

Concretely, for A2.2:

- **Swup `containers`** must be `['#perch-main']` and nothing else. Adding
  `body` or a wrapper that encloses the layer re-introduces exactly the bug this
  ticket removed.
- **Teardown passes** (removing listeners, clearing timers, destroying widget
  instances before a swap) must filter with `isPersistent()` first.
- **`document.body.innerHTML = …` is forbidden.** The pre-A0.1 router
  (`js/perch-router.js`) does this and hand-detaches `#dvn-perch-root` around it.
  That approach does not generalise and must not be carried forward.
- **Do not re-run `js/perch-layer.js`** after a swap. `mount()` is idempotent and
  returns the existing instance, so a stray call is survivable — but it means the
  router is treating the layer as page content, which is the mindset the bug
  comes from.

---

## 3. What the router must call

### 3.1 Announce the swap

After new content is in place, dispatch on `document`:

```js
import { EVENT_SWAPPED } from '/js/perch/placement.js'; // 'perch:content-swapped'
document.dispatchEvent(new CustomEvent(EVENT_SWAPPED, { detail: { url } }));
```

This is the only signal the layer needs. It drives three things:

1. the layer re-asserts its own invariant and `console.error`s if a swap ever
   re-parented it (a silent regression becomes loud on the first swap);
2. `host.afterNavigate()` fires, which is how a booking prefill queued during
   navigation gets re-delivered once `/book` is in place;
3. `host.onContentReady()` fires, which re-hands the live `call_id` to the
   booking widget on the new page.

**Dispatch it after the content is in the DOM, not before.** Handlers query the
new content synchronously.

### 3.2 Register the navigation function

```js
import { registerRouter } from '/js/perch/surface.js';

registerRouter((href) => swup.navigate(href));
```

**Changed by DR-INSANE-A33 (#58).** This used to be
`window.Perch.layer.setRouter((href) => …)`, and that was the A4.1 QA finding:
`setRouter` installs the callback every agent-driven `go()` passes through, so a
writable window property holding it meant any script in the document could own
where Paula sends a caller mid-call. The channel is now a module-private slot in
`js/perch/surface.js` §2 — no window property, **one registration for the life of
the document** (later attempts are refused and counted in
`Perch.layer.bookingProbe().routerRefused`), and the registered function is never
handed back out, so it cannot be read or wrapped either.

Without this, an agent-driven `navigate` from Paula falls back to
`location.assign()` — correct, but it is a hard load, which ends the call. The
layer logs a `console.warn` every time that happens so the gap is visible rather
than mysterious.

**This is the sequencing dependency**: A2.1 alone puts the concierge somewhere a
swap cannot reach, but nothing performs a swap yet, so a click is still a full
page load and still ends the call. A2.1 + A2.2 is the feature. See §6.

---

## 4. The public API

**Narrowed by DR-INSANE-A33 (#58).** `window.Perch.layer` is now four read-only
members, and it is the return value of `mount()` as well — `mount()` is a module
export any same-origin script can reach with a dynamic `import()`, so returning
the instance would have moved the control surface rather than removed it.

| Member | Purpose |
|---|---|
| `probe()` | everything a continuity check needs, in one call |
| `bookingProbe()` | the A31 booking channel's state, incl. `routerActive` and `routerRefused` |
| `attachLiveResource(name, handle)` | register a live non-DOM resource (§5.2) |
| `detachLiveResource(name)` | drop one |

`window.Perch` itself is defined `writable: false, configurable: false`; each slot
is a getter with no setter; each surface is frozen; the namespace is
non-extensible. So none of `window.Perch`, `Perch.layer` or `Perch.layer.probe`
can be reassigned, redefined or deleted. If `window.Perch` already exists and is
not ours, the layer **publishes nothing** rather than assigning into a namespace
someone else authored.

### 4.1 What is no longer public, and where it went

| Was on `Perch.layer` | Now | Why it had to go |
|---|---|---|
| `setRouter(fn)` | `registerRouter()`, module-private (§3.2) | installs the navigation callback for every agent-driven `go()` |
| `root` | module-internal | a live node handle; re-parent the layer into `main#perch-main` and the next navigation destroys the call |
| `container()` | module-internal | same |
| `concierge` / `call` / `qualifier` | module-internal | whole control objects — `call.stop()`, `qualifier.openQualifier()` |
| `mountShellConcierge()` | module export of `js/perch-layer.js` | builds a second orb on top of the widget's |
| `instanceId` / `hostFallback` / `inspect()` / `isPersistent` | read them from `probe()` | already readable; publishing them twice only widened the surface |

`window.__perch` was `{openQualifier, closeQualifier}` and is now `{probe()}`,
locked the same way. Nothing in the repo ever read the control functions — the
real wiring is the closure `mountQualifier()` returns — so the exposure bought a
debug affordance and cost a hijack path on the card a caller taps their income
and net worth into during a recorded call.

`inspect()` returns the **reasons**, not a boolean, because every caller needs to
report which property failed:

```js
{ hasContainer, hasLayer, hasOrb,
  layerInsideContainer,   // THE invariant — must always be false
  orbInsideContainer,     // ditto
  isDirectSibling,        // the ticket's stated placement
  orbInsideLayer, layerParent, containerParent, ok }
```

`probe()` adds `instanceId`, `ticks` (a 100 ms monotonic counter, reset to 0 by a
document reload), `uptimeMs`, `callLive`, `callUptimeMs`, any registered live resource, and
`concierge` — `{ kind, count, allInLayer, insideContainer }`. **`count` must
always be 1 and `allInLayer` must always be true**; anything else is a duplicate,
or a node a swap can destroy. Comparing all of them across a swap distinguishes the three outcomes
that look identical in a screenshot:

| Outcome | `instanceId` | `ticks` |
|---|---|---|
| soft swap, layer survived | unchanged | advanced |
| layer torn down and rebuilt | **changed** | reset |
| swap silently fell back to a hard load | **changed** | **reset to ~0** |

---

## 5. Two things that are easy to get wrong

### 5.1 The layer is `position: fixed`, so an ancestor can capture it

A fixed element is positioned against the nearest ancestor that establishes a
containing block — any ancestor carrying `transform`, `filter`, `perspective`,
`backdrop-filter`, `contain`, or a `will-change` naming one of those. On a
`wrap-div` page the layer's ancestors are site chrome this ticket does not own,
and a stylesheet change later could silently trap the orb inside a card.

So `placeLayer()` **measures instead of assuming**: it inserts the layer, reads
the rect back, and if the layer is not viewport-anchored it re-homes to
`document.body` and sets `hostFallback: true`. A body child cannot be a
descendant of a `<main>` that is itself a body descendant, so the load-bearing
invariant holds either way — the weaker placement is *reported*, never silently
accepted.

If you add site chrome with a `transform` above the container, `hostFallback`
starts coming back `true` on Preview. That is the check working, not a bug.

### 5.2 A live call is not a DOM node

Proving the orb is still on screen after a swap proves almost nothing — a
rebuilt orb looks identical to a surviving one. The thing that must survive is
the **WebRTC session and the closure holding it**.

`attachLiveResource(name, { clock, state })` is how a live non-DOM resource
registers itself so `probe()` can report it. A clock that keeps advancing across
a swap is the only evidence that distinguishes continuity from re-creation.

---

## 6. Sequencing

A2.1 does **not** add a concierge to any page — it re-homes the one already
there. Until A2.2 registers a router, an internal link click is still a full page
load, so:

- the layer is rebuilt (new `instanceId`, `ticks` back to 0), and
- a call in progress ends.

That is exactly what happens today, so landing A2.1 alone is safe and changes
nothing a visitor can see — but **the user-visible win only arrives with A2.2**.
This PR just puts the pieces where the router needs them.

The shell at `/` is unaffected either way: A0.1 skips `perch.html`, so it gets no
container and no layer, and it keeps its own orb and its own iframe.

---

## 7. Not in this ticket

- **The router itself** — A2.2.
- **The page-control executor in the top-level document.** `host.drive()` emits
  the exact `{type:'perch', cmd, target, payload}` envelope the shell posts into
  its iframe, self-addressed. `perch-inject.js` is the consumer today and is only
  loaded inside the shell's iframe; wiring it (or its successor) into the
  top-level document, and the booking `postMessage` channel behind it, is
  **Phase 3**. Until then those messages are emitted and unobserved, which is why
  `navigate` deliberately does not depend on them.
- **Retiring the shell.** `perch.html` and `js/page/perch-shell.js` stay exactly
  as they are. When `/` stops iframing the site, `perch-shell.js` is *deleted*,
  not ported — the layer is already the other implementation, and both now share
  `js/perch/{chrome,call,qualifier}.js`.
