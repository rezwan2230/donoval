# Option B — port spec (iframe → persistent overlay)

Companion to `SEO-ROADMAP.md` §3. Written after reading every seam in
`perch.html` (465 lines) and `perch-inject.js` (85 lines), 2026-07-18.

**The product constraint, restated:** the Perch concierge — the orb and the live
Retell call — **must survive navigation**. Option B does not remove it. It changes
Perch from a frame that *wraps* the site into a layer that *sits above* it.

---

## 1. What the audit changed about the plan

### Finding A — the "hardest part" is mostly deletion
`SEO-ROADMAP.md` flagged step 5 (rewiring Wendy's screen control from `postMessage`
to direct DOM) as the dangerous part. Reading `perch-inject.js` shows why it isn't:

**every booking command's final hop is already a same-window message.**

```js
window.postMessage({ type:'dl-booking', action:'prefill', payload }, location.origin)
```

The booking widget listens on `window`. So with no iframe, the layer fires the
**identical** call and the widget's contract is untouched. What disappears is only
the parent → iframe hop.

### Finding B — do NOT hand-edit 100 pages
The roadmap assumed adding a swap container + layer script to ~100 pages: 100
chances to break a page and to leave the site half-migrated. Instead inject at the
edge with **`functions/_middleware.js`** + Cloudflare `HTMLRewriter`. One file,
applies everywhere, reversible by deleting it.

---

## 2. Command transformation table

| cmd | today (via iframe) | after Option B |
|---|---|---|
| `booking_prefill` | parent → iframe → `window.postMessage('dl-booking')` | **identical** `window.postMessage` — direct |
| `booking_select_slot` | ” | **identical** |
| `booking_select_type` | ” | **identical** |
| `booking_show_date` | ” | **identical** |
| `set_call_id` | ” | **identical** |
| `scroll` | proxied into iframe doc | direct DOM (`scrollIntoView`) |
| `highlight` | proxied | direct DOM |
| `scrollby` | iframe window | real window |
| `navigate` | `site.contentWindow.location.assign()` | `swup.navigate()` |
| `open_qualifier` | already shell-level | unchanged |
| `isHomeHref()` guard | stops shell nesting inside itself | **deleted — obsolete** |
| `registry()` / `perch:ready` | iframe → parent postMessage | layer reads its own DOM after each swap |

---

## 3. Build order (each step provable before the next)

- **B.1 `perch-layer.js`** — standalone module: injects its own CSS + DOM (orb,
  caption, qualifier modal), owns the Retell call, the page-poll loop, prefill
  redelivery, and executes commands locally. Port of `perch.html`'s module script
  **merged with** `perch-inject.js`'s command handlers, minus the iframe hop.
- **B.2 `functions/_middleware.js`** — HTMLRewriter injects the swap container +
  `perch-layer.js` into every HTML response. Live shell untouched.
- **B.3** — prove the call survives navigation across real pages.
- **B.4** — full booking re-test (below).
- **B.5 cutover** — `/` serves real home content; retire the iframe path.

**The live shell stays serving until B.5.** No half-state.

---

## 4. State that must survive a swap

The layer lives outside the swapped container, so this is preserved by construction —
but it is the checklist that proves the port:

- `retell` client + `onCall` / `connecting` flags
- `curCall` (call id) and the `pollTimer` loop
- `_prefillPayload` / `_prefillTimer` (prefill redelivery)
- orb position (`donovan_orb_pos`) and drag state
- `donovan_booking_unlock`, `donovan_vid`
- qualifier answers mid-flow (`qualAns`, `qualLang`, `qualSource`)

### Re-init required on **each** swap
Bootstrap nav/dropdowns · booking widget · tool calculators · Vantage page beacon ·
**GA4 `page_view`** (client-side nav does not fire it automatically — this is why the
analytics wiring is built SPA-aware from day one).

---

## 5. Retirement list (deleted in the B.5 cutover commit, not before)

| Item | Why dead |
|---|---|
| `perch.html` | the shell; its orb/call/qualifier now live in `perch-layer.js` |
| `perch-inject.js` | pure iframe bridge |
| `home.html` | existed only because `/` was the shell; becomes a duplicate of `/` |
| `/ → /perch.html 200` in `_redirects` | the rewrite that made `/` the shell |
| `isHomeHref()` + nesting guards | only existed to stop the shell loading itself |

`grep` for inbound references before deleting each. Dead code is removed at the
port, not commented out.

---

## 6. Acceptance test (B.4) — must pass before cutover

1. Start a call from the orb on `/`.
2. Navigate to 3+ pages — **call stays connected**, orb keeps position.
3. Wendy asks language + source; `open_qualifier` renders the card.
4. Tap through matter + profile; `get_qualifier_result` returns the answers.
5. Wendy navigates to `/book`; **prefill lands** (the redelivery race is the
   historical failure mode — verify explicitly).
6. `booking_show_date` → `booking_select_slot` drive the widget.
7. Confirm the booking; verify the Clio calendar entry **and** the Grow lead carry
   the qualifier summary (the #8 join).
8. Verify `set_call_id` survived the navigation (that join depends on it).
9. Re-run on mobile.

A smoke test is not sufficient — items 5 and 7 are the ones that historically broke.
