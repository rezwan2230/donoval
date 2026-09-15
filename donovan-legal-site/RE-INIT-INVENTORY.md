# SHELDON — RE-INIT INVENTORY

**Order:** SHELDON-PERCH-A03-REINIT-INVENTORY · **Ticket:** #48 · **Parent:** #15
**Phase:** A / Phase 0 · **Review ref:** arch **B2** / frontend **M3**
**Status:** audit + documentation only. No runtime behaviour, page logic, or function
logic is changed by the commit that adds this file.

---

## 0. Why this document exists

`OPTION-B-PORT-SPEC.md` §2 and `SEO-ROADMAP.md` §3 describe the re-init surface in
prose. Both were written from a reading of the two Perch files, and both drift from
the code in ways that would make a checklist built from them **wrong** — see §6.

This document is derived **from the source**, not from the prose. Every row carries a
`file:line` that `grep` can reproduce. §7 is the mechanical cross-check in both
directions: doc → code, and code → doc.

### The two swap models

| | "Swap" means | Re-init mechanism |
|---|---|---|
| **Today (Option A, live)** | `<iframe id="site">` navigates → a **full document load** | The browser runs every `<script>`; `DOMContentLoaded` fires; the shell re-injects `perch-inject.js` on the iframe's `load` event (`perch.html:120-124`) |
| **Option B (planned)** | `document.body.innerHTML` is replaced under a persistent layer | **Scripts inserted via `innerHTML` do not execute.** `DOMContentLoaded` never fires again. Everything in §3 marked `RE-INIT` must be re-run explicitly |

The reference implementation of the Option B swap already exists in-tree —
`js/perch-router.js` — and is loaded by **zero** pages (§6, correction C2).

---

## 1. Legend

- **SURVIVES** — binding is on `document`/`window`, or state lives outside the swapped
  subtree. No action required on swap.
- **RE-INIT** — binding is attached to an element inside the swapped subtree, or is a
  one-shot at load. It is destroyed by the swap and must be re-run.
- **RE-DELIVER** — not a binding; a message the shell must resend because the receiver
  is newly constructed.

---

## 2. Command surface — the four protocol layers

A command from Paula crosses four hops. A content swap can break any of them, so all
four are inventoried.

```
Paula (Retell) ──POST──▶ /fn/*            (layer 2.1, tool endpoints)
                            │
                            ▼ Durable Object queue
shell poll ◀──GET── /fn/page-poll         (layer 2.2, bridge queue)
    │
    ▼ {type:'perch', cmd, target, payload}
perch-inject.js in the page                (layer 2.3, shell → page)
    │
    ▼ {type:'dl-booking', action, payload}
js/booking-widget.js                       (layer 2.4, page → widget)
    │
    ▲ {perch:ready} / {__perchBookingAck} / {__perchBooking:'confirmed'}
    └──────────────────────────────────────(layer 2.5, upward)
```

### 2.1 Retell tool endpoints (Paula → edge)

All are `onRequestPost` only; no `onRequestGet` is exported, so Pages answers `GET`
with 405. Auth column: `tool-secret` = `x-perch-tool-secret` via
`functions/_lib/tool-auth.js` (401 missing/wrong · 503 unset-or-short, fail-closed).

| Endpoint | Source | Auth | Survives a swap? |
|---|---|---|---|
| `/fn/do_page_action` | `functions/fn/do_page_action.js:126` | tool-secret (`:138`) | SURVIVES — server-side |
| `/fn/get_page_actions` | `functions/fn/get_page_actions.js:26` | tool-secret (`:30`) | SURVIVES |
| `/fn/get_availability` | `functions/fn/get_availability.js:37` | tool-secret (`:41`) | SURVIVES |
| `/fn/qualifier_result` | `functions/fn/qualifier_result.js:20` | tool-secret | SURVIVES |
| `/fn/booking_result` | `functions/fn/booking_result.js:12` | tool-secret | SURVIVES |
| `/fn/save_lead` | `functions/fn/save_lead.js:16` | tool-secret (`:25`) | SURVIVES |
| `/fn/take_message` | `functions/fn/take_message.js:43` | tool-secret (`:53`) | SURVIVES |
| `/fn/page-poll` | `functions/fn/page-poll.js:29` | bearer: `x-perch-call-id` **header** | SURVIVES — the poll loop lives in the shell, outside the swap |
| `/fn/qualifier_submit` | `functions/fn/qualifier_submit.js:171` | none (browser-called) | SURVIVES — posted by the shell modal |
| `/fn/booking_confirmed` | `functions/fn/booking_confirmed.js:7` | none (browser-called) | SURVIVES — posted by the shell |

**Invariant across all of them (B2):** an absent `call_id` means **no relay**, never a
shared `default` bucket. Both the write side (`do_page_action.js:158-162`) and the read
side (`page-poll.js:32-35`) enforce it; fixing one alone would leave the bucket
drainable.

### 2.2 Bridge-queue action keys (what `do_page_action` accepts)

**34 static keys** in `ACTION_MAP` (`functions/fn/do_page_action.js:96-115`), each
resolving to `{cmd:'navigate'|'scrollby', target}`:

`goto_home` `goto_about` `goto_paul` `goto_tefera` `goto_wendy` `goto_leidy`
`goto_practice` `goto_tax` `goto_tax_planning` `goto_tax_compliance`
`goto_tax_controversy` `goto_real_estate` `goto_re_acquisition` `goto_re_ownership`
`goto_re_disposition` `goto_special_counsel` `goto_experience` `goto_testimonials`
`goto_resources` `goto_blog` `goto_tools` `goto_membership` `goto_gold` `goto_platinum`
`goto_diamond` `goto_reserve` `goto_contact` `open_intake` `goto_booking`
`book_consult` `scroll_down` `scroll_up` `scroll_to_top` `scroll_to_bottom`

**5 parameterized keys**, handled in their own branches ahead of `ACTION_MAP`:

| Key | Branch | Sanitizer | Emitted action |
|---|---|---|---|
| `booking_prefill` | `do_page_action.js:170` | `sanitizeBookingArgs:28` — name/email/phone ≤100/100/30, notes ≤500, control chars stripped, all-empty rejected | `{cmd:'booking_prefill', payload:{name,email,phone,notes}}` |
| `booking_select_slot` | `:170` | `:38` — ISO-8601 instant **or** `{day≤40, time≤20}`; `time` required | `{cmd:'booking_select_slot', payload: ISO \| {day,time}}` |
| `booking_select_type` | `:170` | `:77` — `type_id`/`typeId` must match `/^[a-z0-9_-]{1,64}$/i` | `{cmd:'booking_select_type', payload: typeId}` |
| `booking_show_date` | `:170` | `:65` — `day` ≤40, required | `{cmd:'booking_show_date', payload:{day}}` |
| `open_qualifier` | `:208` | inline — `matter` ∈ {tax, real_estate} (default real_estate), `lang` ∈ {en,es}, `source` ≤60 | `{cmd:'open_qualifier', payload:{matter,lang,source}}` |

> **Discovery gap, reported not fixed:** `get_page_actions.js:14-22` advertises the 34
> static keys **plus `open_qualifier`** — 35 total. The four `booking_*` keys are
> accepted by `do_page_action` but are **absent from the discovery list**. An agent that
> enumerates capabilities from `get_page_actions` cannot learn the booking commands
> exist. Out of scope for #48 (audit only); raise as its own ticket.

### 2.3 Shell → page commands — `{type:'perch', cmd, target, payload}`

Sent by `drive()` (`perch.html:127`) into `site.contentWindow`; received and executed by
`perch-inject.js:37`. Origin-gated both ways (`perch-inject.js:38`, `:34`).

| `cmd` | Handler | Effect | After a swap |
|---|---|---|---|
| `navigate` | `perch-inject.js:42` | `location.assign(t)` — only relative same-origin paths; `:` and leading `//` rejected | **Becomes the swap trigger** under Option B. The spec's replacement mechanism does not exist in-tree — see §6 C1 |
| `scroll` | `:51` | `scrollIntoView` on `#id` or selector | RE-INIT: resolves against the **new** DOM; no rebind needed, but must run after the swap settles |
| `highlight` | `:54` | 2.6 s gold box-shadow on `#id`/selector | same as `scroll` |
| `scrollby` | `:57` | `top` / `bottom` / `up` / `down` (0.85 × viewport) | SURVIVES — window-level |
| `booking_prefill` | `:62` | → `dl-booking` `prefill` | RE-DELIVER (see §3.7) |
| `booking_select_slot` | `:66` | → `dl-booking` `selectSlot` | widget-queued (§3.6) |
| `booking_select_type` | `:69` | → `dl-booking` `selectType` | widget-queued (§3.6) |
| `booking_show_date` | `:72` | → `dl-booking` `showDate` | widget-queued (§3.6) |
| `set_call_id` | `:75` | → `dl-booking` `setCallId` | **RE-DELIVER — the single most swap-fragile item.** See §3.5 |

`open_qualifier` is deliberately **not** in this table: `perch.html:263-264` handles it
at shell level and never forwards it to the page. It is therefore swap-immune, and a
port that forwards it would regress that.

### 2.4 Page → widget commands — `{type:'dl-booking', action, payload}`

Receiver: `js/booking-widget.js:1923`. Origin-checked at `:1924`.

| `action` | Dispatch | Public API | Notes |
|---|---|---|---|
| `prefill` | `:1929` | `DLBooking.prefill` | Acks upward (§2.5) |
| `selectType` | `:1930` | `DLBooking.selectType` | No-op unless `state.step === 'TYPE_PICK'` (`:1649`) |
| `selectSlot` | `:1931` | `DLBooking.selectSlot` | ISO **or** `{day,time}`; defers to `_pendingSlot`/`_pendingDayTime` if availability not loaded |
| `showDate` | `:1932` | `DLBooking.showDate` | Opens a date, never advances to `FORM` (`:1616`) |
| `setCallId` | `:1933` | — sets `window.__perchCallId` | Read at submit time (`:1319`) |

`getState` is intentionally **not** postMessage-dispatchable (`:1934`) — there is no
return channel in that direction.

**Trust boundary (must survive the port):** the agent prefills and selects; the
**caller** always presses "Confirm Appointment". Nothing in this layer auto-submits.

### 2.5 Upward messages — page → shell

| Message | Emitted at | Consumed at | Purpose |
|---|---|---|---|
| `{type:'perch:ready', url, links, ids}` | `perch-inject.js:34` (from `report()`, `:84`) | `perch.html:221` | Page announces itself; **shell re-hands `set_call_id`** |
| `{__perchBookingAck:true, action:'prefill'}` | `js/booking-widget.js:1939` | `perch.html:212` | Stops prefill re-delivery |
| `{__perchBooking:'confirmed', slotISO}` | `js/booking-widget.js:1346` | `perch.html:215` | Caption + `POST /fn/booking_confirmed` (`perch.html:219`) |

---

## 3. On-load bindings that must survive a content swap

### 3.1 Bootstrap nav + dropdowns

Two **different** mechanisms are in play on the same navbar. They behave differently
under a swap, and the prose treats them as one item.

| Binding | Source | Bound to | Verdict |
|---|---|---|---|
| `data-toggle="collapse"` / `"dropdown"` / `"alert"` (mobile accordion, `#menu1`–`#menu4`, `#m2-tax`/`#m2-re`/`#m2-sc`) | `js/vendor/bootstrap.min.js` (v4.3.1) via `$(document).on(CLICK_DATA_API, selector, handler)` | `document`, delegated | **SURVIVES** |
| `$('.dropdown').hover(...)` — the desktop fade-in/fade-out dropdown | `js/main.js:110` | `.dropdown` elements | **RE-INIT** |
| `$(".hamburger").click` / `$(".btn-close.menu").click` — mobile overlay open/close | `js/main.js:100`, `:104` | elements | **RE-INIT** |
| `$("#btn-tf").click`, `$("#btn-tp").click` — ± icon toggles | `js/main.js:133`, `:139` | elements | **RE-INIT** |
| `$('#theFirm').click`, `$('#thePractice').click` — delayed nav | `js/main.js:116`, `:124` | elements | **RE-INIT** |
| `$(".img-hover" / ".mobile-hover" / ".cmm-logo-hover").click` | `js/main.js:65`, `:69`, `:73` | elements | **RE-INIT** |
| `$('a.marker').click` + `.pin-popup` edge measurement | `js/main.js:83`, `:92` | elements + one-shot layout pass | **RE-INIT** |
| `$(document).click` → close popups | `js/main.js:88` | `document` | SURVIVES |
| tel:/mailto: `_top` escape — capture-phase click listener | `js/main.js:36` | `document`, capture | **SURVIVES by design** — the file's own comment names "soft-nav body swap" as the case it covers. The one-shot `sweep()` (`:29-33`) does not survive, but the delegated net makes that immaterial |
| MEMBERS gate loader | `js/main.js:60` appends `/js/members-gate.js`; that file guards on `window.__dvnMembersGate` (`js/members-gate.js:44`) and binds `document` click/keydown (`:587`, `:604`) | `document` | SURVIVES; loader is idempotent |

`js/main.js` is in `perch-router.js`'s `SKIP` regex (`js/perch-router.js:11`), so under
that router it is **not** re-executed — every RE-INIT row above stays dead. Any port
must either drop `main.js` from `SKIP` (and make it idempotent) or re-bind explicitly.

> **Pre-existing gap, reported not fixed:** `book.html` renders `#btn-tr` (RESOURCES)
> and `#btn-tm` (MEMBERS) ± toggles (`book.html:223`, `:235`), but `js/main.js` wires
> only `#btn-tf` and `#btn-tp`. Those two icons are inert today, before any swap.

### 3.2 Booking widget

| Item | Source | Verdict |
|---|---|---|
| `boot()` on `DOMContentLoaded` / immediate if already parsed | `js/booking-widget.js:1765-1770` | **RE-INIT** — `DOMContentLoaded` fires once per document |
| Container discovery: `document.querySelectorAll('[data-api]')`, skipping `[data-api-init]` | `:1740-1751` | **Idempotent by construction** — re-calling `boot()` after a swap is safe; already-initialised containers are skipped, and a freshly-swapped-in `#dl-booking` is picked up |
| `injectStyles()` — guards on `#dl-booking-styles` | `:239-243` | SURVIVES; safe to re-run |
| `window.addEventListener('message', …)` bridge | `:1923` | **SURVIVES** — window-level, registered once |
| `window.DLBooking` + `_pending` replay queue | `:1806`, `:1836` | SURVIVES — `window`-scoped |
| Per-element handlers (type buttons `:972`, date `:1085`, slot `:1103`, next `:1119`, form submit `:1250`, back `:1426`, restart `:1404`, retry `:1486`, dirty-tracking `:1215`) | as listed | RE-INIT — but re-created by `render()`, so covered by re-running `boot()` |

**Re-init recipe under a body swap:** re-run `boot()`. Nothing else. The
`[data-api-init]` sentinel and the `#dl-booking-styles` guard make it safe to call on
every swap, including swaps that contain no widget.

### 3.3 The `donovan_booking_unlock` handshake

The soft gate that keeps un-qualified visitors off Paul's calendar.

| Half | Source | Behaviour |
|---|---|---|
| **Write** | `perch.html:243-246` | On a polled `navigate` whose `target` starts with `/book`, the shell writes `localStorage['donovan_booking_unlock'] = String(Date.now())` **before** `go(d.target)` |
| **Read** | `book.html:326-328` | Inline IIFE: unlocked iff `Date.now() - parseInt(raw,10) < 30*60*1000` (30 min) |
| **Reveal** | `book.html:330-336` | `#book-gate` → `display:none`; `#book-live` → `display:block`; `scrollIntoView` after 300 ms |
| **Dev bypass** | `book.html:319-322` | `?unlock=dev`. Deliberate and documented; grants no authenticated access |

**Swap verdict: RE-INIT — and this one does not self-heal.** The read is an *inline*
`<script>` inside `book.html`'s body. Under a body swap it arrives via `innerHTML` and
**does not execute**, so `#book-live` stays `display:none` and the widget is invisible
even though `boot()` initialised it. The write half survives (shell-side), so the flag
will be set and simply never read.

Ordering that must be preserved: **write before navigate** (`perch.html:245` precedes
`:247`). Under Option B the swap is synchronous — the gate logic must run *after* the
new body is in place, not before.

CSP note: `functions/_middleware.js` issues `script-src 'self' 'nonce-…'` with **no**
`strict-dynamic` (`:50`). An inline block re-created during a swap carries the *old*
nonce or none, so re-running this gate means calling a function, not re-injecting the
inline tag.

### 3.4 `perch:ready` → `set_call_id` re-handoff

The mechanism that keeps the live call id attached to the booking widget across
navigation.

```
page loads  →  perch-inject.js report()            :84
            →  parent.postMessage({type:'perch:ready', …})   :34
shell       →  if (curCall) drive('set_call_id', null, {call_id: curCall})
                                                    perch.html:221-225
inject      →  window.postMessage({type:'dl-booking', action:'setCallId', …})
                                                    perch-inject.js:75-79
widget      →  window.__perchCallId = payload.call_id
                                                    js/booking-widget.js:1933
submit      →  call_id: (window.__perchCallId || undefined)
                                                    js/booking-widget.js:1319
```

There is a **second, independent** entry point: `startPoll()` fires `set_call_id`
immediately at `perch.html:235`, covering the case where the caller is already on
`/book` when the call connects. The `perch:ready` handler covers every subsequent
navigation. Both are required; neither subsumes the other.

**Swap verdict: RE-DELIVER.** `window.__perchCallId` is a `window` global, so under an
Option B body swap it is *not* cleared and the handoff is technically redundant.
Under today's iframe model it is load-bearing: each iframe navigation is a new
document with a fresh `window`. **A port must not delete the re-handoff on the
reasoning that the global survives** — the `/booking/create` → Clio-description →
Grow-lead join depends on it (`OPTION-B-PORT-SPEC.md` §6 item 8 names it as a
historical failure).

### 3.5 Prefill re-delivery

Paula typically fires `booking_prefill` while `/book` is still loading, before the
widget's message listener exists. A single `postMessage` would be lost.

| Element | Source | Behaviour |
|---|---|---|
| `_prefillPayload` / `_prefillTimer` | `perch.html:190-191` | Shell-held state |
| `deliverPrefill()` | `perch.html:193-206` | Immediate send, then `setInterval` 700 ms, **capped at 6 tries** (~4.2 s) |
| Ack → stop | `perch.html:209-214` | On `{__perchBookingAck, action:'prefill'}`: null the payload, `clearInterval` |
| Widget ack | `js/booking-widget.js:1938-1940` | Posted to `window.parent` after every `prefill` |
| Post-nav retry | `perch.html:250-252` | After a `navigate` to `/book`, a `{once:true}` `site` `load` listener re-fires `deliverPrefill(_prefillPayload)` |
| Idempotence | `js/booking-widget.js:1207-1210`, `:1640-1643` | Never overwrites a field the caller has typed into (`_userDirty`, set at `:1215`) |

**Swap verdict: RE-DELIVER.** The ack is `window.parent.postMessage` — under Option B
(no iframe) `window.parent === window`, so the ack still lands on the same listener and
the loop still terminates. The `{once:true}` `site.load` hook at `:251` has **no
equivalent** in a body-swap model and must be re-expressed as a post-swap hook, or
prefill after an agent-driven `/book` navigation regresses. This is failure mode #5 in
`OPTION-B-PORT-SPEC.md` §6 — the one flagged as historically broken.

### 3.6 Vantage beacon

| Item | Source | Verdict |
|---|---|---|
| `<script src="https://vantage.ticoai.net/perch.js" async data-deployment="donovan-intake" data-agent="agent_7d044bab7d2d0e5d648de5f198">` | `perch.html:11` + **141** content pages | **RE-INIT — must NOT re-execute.** Re-running the beacon per swap would double-count visits and can re-roll the visitor id |
| `pushState` hook → `/visit` | beacon-internal (external host) | SURVIVES — hooks `history.pushState`; `js/perch-router.js:60` pushes state precisely so the beacon fires. `js/perch-router.js:11` `SKIP` lists `vantage.ticoai.net` so the tag is never re-executed |
| `window.__vantage.callStart()` / `.callEnd()` | `perch.html:290`, `:296`; `js/donovan-widget.js:80`, `:86` | SURVIVES — called from the shell/layer, outside the swap |
| `vantage:call-start` / `vantage:call-end` CustomEvents | `perch.html:291`, `:297`; `js/donovan-widget.js:81`, `:87` | SURVIVES — dispatched on `window` |
| `getVid()` resilience — `window.__vantage.vid` with a `localStorage['donovan_vid']` fallback | `perch.html:175-181` | SURVIVES — the fallback exists because the beacon host has 503'd; a swap does not affect it |

**The swap contract for the beacon is: re-notify, never re-load.** `pushState` is the
notification. A port that re-injects the `<script>` tag on each swap is a regression,
not a re-init.

### 3.7 Tool calculators

Three distinct mechanisms; a checklist that names only one is incomplete.

| Mechanism | Files | Pages | Verdict |
|---|---|---|---|
| External module, boots on `DOMContentLoaded` | `js/tool-1031-exchange.js:2594`, `js/tool-economics.js:3246`, `js/tool-entity-formation-multi.js:1188`, `js/tool-entity-formation-reserve.js:15`, `js/tool-operating-agreement.js:20,35,61,184,289`, `js/tool-deal-builder-reserve.js:280,2087,2959,3122,4267`, `js/tool-structuring.js:6874` | root `tool-*.html` + `gold/` `platinum/` `diamond/` `reserve/` | **RE-INIT** |
| External module, `readyState` guard (already-parsed-safe) | `js/tool-rental-real-estate-tax-strategy-analyzer.js:4533,4758`; `js/tool-str-strategy-analyzer.js:3108,3314` | as above | **RE-INIT** — the guard handles late load, not a second swap |
| Direct element binding at parse time (no ready gate) | `js/tool-entity-formation.js:17,18,57,68` — `#access_submit`, `#access_code`, `#management_structure`, `#jurisdiction` | `tool-entity-formation.html` + tiers | **RE-INIT** — throws if the element is absent at execution time |
| Inline `<script>` in the page body | `tool-capital-gains.html`, `tool-cost-segregation.html`, `tool-firpta-withholding.html`, `tool-irs-notice-guide.html`, `tool-oic-rcp-estimator.html`, `tool-deal-builder.html`, and the inline blocks on `tool-1031-exchange.html` / `tool-rental-…` / `tool-str-…` | 9 pages | **RE-INIT — does not self-heal.** Same `innerHTML`-does-not-execute problem as `book.html`'s gate (§3.3), plus the nonce constraint |
| Delegated `data-dvn-on` / `data-dvn-do` dispatcher | `js/inline-actions.js:167-170` — `click`/`change`/`input`/`submit` on `document` | **22** pages | **SURVIVES** — this is why the CSP `unsafe-inline` drop was done with delegation. It also covers rows injected later via `innerHTML` |

`js/tool-input-formatter.js` exposes `DonovanInputFormatter.attachAll(root)` (`:145`)
and binds nothing at load; it is referenced by **0** HTML pages today. If a port wires
it up, `attachAll(newRoot)` is the correct post-swap call.

### 3.8 Manual GA4 `page_view`

**This binding does not exist in code.** It is a forward obligation, not an inventory
row, and the distinction is the whole point of ticket #48.

- Repo-wide grep for `gtag(`, `googletagmanager`, `dataLayer`, `G-XXXXXXXXX`, `AW-`
  across `.html`/`.js`/`.mjs`: **0 hits** in any shipped page or script.
- The only occurrence of `gtag|googletag` in executable code is a *negative* one — the
  `SKIP` regex in `js/perch-router.js:11`, which pre-emptively excludes an analytics
  tag from soft-nav re-execution. The router was written to accommodate a tag that was
  never added.
- Independently corroborated by `SEO-ROADMAP.md:30` (finding **G1**): "No analytics or
  ad tracking at all · 0 hits for `gtag(` / `googletagmanager` / `AW-` across 103
  pages."
- `HANDOFF.md:120` lists the GA4 `G-` measurement ID as an outstanding **external
  blocker** (must be created under a firm Google account).

**Requirement when it lands.** Client-side navigation does not fire `page_view`
automatically. GA4 must be installed with automatic page-view measurement **disabled**
and a manual `gtag('event','page_view', {page_location, page_title})` fired after each
swap — SPA-aware from day one, per `SEO-ROADMAP.md:84`. Ordering: after
`document.title` and `link[rel=canonical]` are updated (`js/perch-router.js:47-49`),
so the event carries the new page's identity rather than the previous one's.

**A re-init checklist must carry this row as `NOT YET IN CODE`.** Listing it as an
existing binding is precisely the error #48 was opened to stop.

---

## 4. State that must NOT be re-initialised

Preserved by construction if the layer sits outside the swapped container. Listed so a
port can assert it, and so nothing here is "helpfully" reset.

| State | Source |
|---|---|
| `retell` client, `onCall`, `connecting` | `perch.html:171` |
| `curCall` (live call id) + `pollTimer` (1.2 s loop) | `perch.html:171`, `:236` |
| `_prefillPayload` / `_prefillTimer` | `perch.html:190-191` |
| `window.__perchCallId` | `js/booking-widget.js:1933` |
| Orb position `localStorage['donovan_orb_pos']` + drag state | `perch.html:156`, `:167` |
| `localStorage['donovan_booking_unlock']` | `perch.html:245` |
| `localStorage['donovan_vid']` | `perch.html:178` |
| Widget launcher position `localStorage['dvn_widget_pos']` | `js/donovan-widget.js:110` |
| Qualifier mid-flow: `qualAns`, `qualLang`, `qualSource`, `qIdx` | `perch.html:317`, `:320`, `:378` |
| ~~`window.__perch = {openQualifier, closeQualifier}`~~ → `window.__perch = {probe()}`, read-only (DR-INSANE-A33, #58) | `js/perch/qualifier.js` |
| `window.DLBooking` + `_pending` queue | `js/booking-widget.js:1806` |
| Single-session guards: `window.__perchInjected`, `__donovanWidget`, `__perchRouter`, `__dvnMembersGate` | `perch-inject.js:5`, `js/donovan-widget.js:8`, `js/perch-router.js:8`, `js/members-gate.js:44` |

---

## 5. Consolidated re-init checklist

The ordered sequence a swap handler must execute. This is the artifact A2.2 builds from.

| # | Step | Call | Source of truth |
|---|---|---|---|
| 1 | Update `document.title` + `link[rel=canonical]` | — | `js/perch-router.js:47-49` |
| 2 | Re-execute page-specific `<script>` (inline + non-vendor `src`), honouring the `SKIP` list | — | `js/perch-router.js:52-59` |
| 3 | Re-bind site nav: desktop dropdown hover, hamburger, `#btn-tf`/`#btn-tp`, `#theFirm`/`#thePractice`, `.img-hover`/`.mobile-hover`/`.cmm-logo-hover`, `a.marker`, `.pin-popup` edge pass | re-run `js/main.js`'s jQuery block (idempotently) | §3.1 |
| 4 | *(no action)* Bootstrap `data-api` toggles, `inline-actions` dispatcher, members-gate, tel/mailto escape | — | §3.1, §3.7 — delegated |
| 5 | Re-run booking widget boot | `boot()` — `js/booking-widget.js:1739` | §3.2 |
| 6 | Re-run the `/book` unlock gate | port `book.html:310-338` to a callable function | §3.3 |
| 7 | Re-hand the call id | `set_call_id` with `curCall` | §3.4 |
| 8 | Re-deliver prefill if still un-acked | `deliverPrefill(_prefillPayload)` | §3.5 |
| 9 | Notify the beacon — **`pushState` only, never re-load the tag** | `history.pushState` | §3.6 |
| 10 | Re-run tool calculators for the swapped-in page | per-tool `DOMContentLoaded` bodies + inline blocks | §3.7 |
| 11 | Fire a manual GA4 `page_view` — **NOT YET IN CODE** | `gtag('event','page_view', …)` | §3.8 |

---

## 6. Corrections to the prior spec prose (blockers B2 / M3)

| # | Prose claim | Code says |
|---|---|---|
| **C1** | `OPTION-B-PORT-SPEC.md:48` — `navigate` becomes **`swup.navigate()`** | **`swup` does not exist anywhere in this repo.** Not in `package.json` (no runtime deps at all), not vendored under `js/vendor/`, not referenced by any HTML. The single occurrence of the string `swup` in the tree is that spec line. This is the "command that does not exist" from the review |
| **C2** | (omitted entirely) | **`js/perch-router.js` already implements the swap** — fetch + `DOMParser`, detach/re-attach a persistent root, body swap, head essentials, gated script re-execution, `pushState`, `popstate`, and `window.__perchNav`. It is loaded by **0** pages. The port's starting point is in-tree and unmentioned |
| **C3** | `OPTION-B-PORT-SPEC.md:51` — `registry()` / `perch:ready` is only "iframe → parent postMessage", to be replaced by "layer reads its own DOM after each swap" | `perch:ready` also **drives the `set_call_id` re-handoff** (`perch.html:221-225`). Treating it as a pure DOM-registry message drops the call-id join. §3.4 |
| **C4** | `OPTION-B-PORT-SPEC.md:44` — `set_call_id` is "**identical**" after the port | The *message* is identical; the *trigger* is not. Today it is driven by `perch:ready` on every iframe load plus `startPoll()` at connect. Both entry points must be re-expressed. §3.4 |
| **C5** | (omitted) | The **`__perchBookingAck` → stop-redelivery** loop (`js/booking-widget.js:1939` → `perch.html:212`) and the **`{once:true}` `site.load` prefill retry** (`perch.html:251`). The `site.load` hook has no body-swap equivalent — this is exactly failure mode #5 in the spec's own acceptance list |
| **C6** | (omitted) | The **`__perchBooking:'confirmed'` → `POST /fn/booking_confirmed`** path (`js/booking-widget.js:1346` → `perch.html:215-219`), which is what lets `get_booking_result` close the call |
| **C7** | `SEO-ROADMAP.md:59` / `OPTION-B-PORT-SPEC.md:84` — "Bootstrap nav/dropdowns" as one item | Two mechanisms with opposite verdicts: Bootstrap's own `data-api` handlers are **document-delegated and survive**; the site's `$('.dropdown').hover()` and hamburger bindings in `js/main.js` are **element-bound and die**. §3.1 |
| **C8** | Both docs — "**GA4 `page_view`**" listed alongside real bindings | **0 hits in code.** It is a forward obligation blocked on an external `G-` id (`HANDOFF.md:120`), corroborated by `SEO-ROADMAP.md:30` finding G1. Must be labelled `NOT YET IN CODE`. §3.8 |
| **C9** | (omitted) | `js/main.js` is inside `perch-router.js`'s `SKIP` regex (`:11`), so under the in-tree router **none** of the §3.1 RE-INIT rows re-run. The router as written would ship a site with a dead desktop dropdown and a dead hamburger |
| **C10** | (omitted) | `book.html`'s unlock gate is an **inline** `<script>`; `innerHTML` does not execute it, and the CSP (`functions/_middleware.js:50`, no `strict-dynamic`) means it cannot be re-injected as an inline tag. Same class applies to the 9 inline-script tool pages. §3.3, §3.7 |

Reported, not fixed (each needs its own ticket):

- **`get_page_actions` discovery gap** — the four `booking_*` keys are executable but
  unadvertised (§2.2).
- **`#btn-tr` / `#btn-tm` inert** — rendered on `book.html`, never wired in `js/main.js`
  (§3.1). Pre-existing, unrelated to swapping.

---

## 7. Grep cross-check

Reproduce with `scripts/verify-reinit-inventory.sh` from `donovan-legal-site/`.

### 7.1 Doc → code: every command named here exists in source

| Symbol | Expected home | grep |
|---|---|---|
| `booking_select_type` | inject + sanitizer + poll | `grep -rn "booking_select_type" perch-inject.js perch.html functions/fn/do_page_action.js` |
| `booking_select_slot` | ” | same pattern |
| `booking_show_date` | ” | same pattern |
| `booking_prefill` | ” | same pattern |
| `set_call_id` | inject + shell (×2 sites) | `grep -rn "set_call_id" perch-inject.js perch.html` |
| `open_qualifier` | shell + endpoint + discovery | `grep -rn "open_qualifier" perch.html functions/fn/` |
| `perch:ready` | inject emit + shell consume | `grep -rn "perch:ready" perch-inject.js perch.html` |
| `__perchBookingAck` | widget emit + shell consume | `grep -rn "__perchBookingAck" js/booking-widget.js perch.html` |
| `__perchBooking` | widget emit + shell consume | `grep -rn "__perchBooking" js/booking-widget.js perch.html` |
| `donovan_booking_unlock` | shell write + book read | `grep -rn "donovan_booking_unlock" perch.html book.html` |
| `navigate` `scroll` `highlight` `scrollby` | inject handlers | `grep -n "d.cmd === '" perch-inject.js` |
| `prefill` `selectType` `selectSlot` `showDate` `setCallId` | widget bridge | `grep -n "action === '" js/booking-widget.js` |
| `__vantage` / `vantage:call-*` | shell + widget | `grep -rn "__vantage\|vantage:call" perch.html js/donovan-widget.js` |

**Result: all pass.** The one row that does **not** resolve is §3.8's GA4 `page_view`,
which this document labels `NOT YET IN CODE` rather than asserting.

### 7.2 Code → doc: every binding in source appears here

Enumerations run against the tree and reconciled row-by-row:

| Enumeration | Command | Count | Documented in |
|---|---|---|---|
| perch-protocol commands | `grep -c "d.cmd === '" perch-inject.js` | **9** | §2.3 (9 rows) |
| dl-booking actions | `grep -c "action === '" js/booking-widget.js` | **5** dispatch + 1 ack branch | §2.4 (5 rows) + §2.5 |
| upward message types | `grep -n "perch:ready\|__perchBookingAck\|__perchBooking" perch.html` | **3** | §2.5 (3 rows) |
| `ACTION_MAP` static keys | `do_page_action.js:96-115` | **34** | §2.2 (34 listed) |
| parameterized keys | `do_page_action.js:170`, `:208` | **5** | §2.2 (5 rows) |
| `get_page_actions` advertised | `get_page_actions.js:14-22` | **35** | §2.2 + gap noted |
| `/fn/` endpoints | `ls functions/fn/*.js` | **10** | §2.1 (10 rows) |
| `DOMContentLoaded` / `readyState` boot sites | `grep -rn "DOMContentLoaded\|document.readyState" js/*.js` | **20** across 11 files | §3.1, §3.2, §3.7 |
| `document.addEventListener` (delegated, survive) | `js/main.js:36`, `js/inline-actions.js:168`, `js/members-gate.js:587,604`, `js/consent-gate.js:354`, `perch-inject.js:16` | **6** | §3.1, §3.7 |
| `window.addEventListener('message')` | `js/booking-widget.js:1923`, `perch.html:209`, `perch-inject.js:37` | **3** | §2.3–2.5 |
| `localStorage` keys | `grep -rho "localStorage.[gs]etItem('[a-z_]*'" perch.html js/*.js book.html` | **4** — `donovan_orb_pos`, `donovan_vid`, `donovan_booking_unlock`, `dvn_widget_pos` | §4 |
| single-session guards | `window.__perchInjected`, `__donovanWidget`, `__perchRouter`, `__dvnMembersGate` | **4** | §4 |
| beacon script tags | `grep -rlc "vantage.ticoai.net/perch.js" --include=*.html` | **141** pages | §3.6 |
| `inline-actions.js` pages | `grep -rl "inline-actions.js" --include=*.html` | **22** pages | §3.7 |
| analytics tags | `grep -rn "gtag(\|googletagmanager\|dataLayer" --include=*.html --include=*.js` | **0** | §3.8 — labelled NOT YET IN CODE |

**Result: no on-load binding found in code is absent from this document.**

---

*SHELDON · backend · DonovanLegal · audit and documentation only.*
