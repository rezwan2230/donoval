# SARAH — A4.2 post-promote synthetic smoke + state reconciliation

**Order** SARAH-A42-POST-PROMOTE-SMOKE · **Ticket** [#61](https://github.com/TicoAI/DonovanLegal/issues/61) ·
**Phase A / Phase 4** · **Run** 2026-07-25

**Target — LIVE PRODUCTION: `https://www.donovan.law`**
Reconciled against `main` @ `11d4b67` (the A5.1 promote, PR #86).

---

## VERDICT: ✅ HEALTHY

**46 / 46 checks PASS · 0 FAIL · 2 MANUAL (declared, not deferred failures)**

**0 write-path requests reached production.** Nothing was booked, no qualifier was submitted, no
Retell session was minted, no lead was written, no secret was read or entered.

| | |
|---|---|
| Steps passed | **46 / 46** |
| Write requests on the wire | **0** |
| Writes composed and trapped in-browser | 1 (the booking POST — captured, never sent) |
| Layer-2 abort backstop firings | 0 (Layer 1 held) |
| Uncaught page errors | 0 |
| CSP violations on production pages | 0 |
| Router-path modules byte-identical to `main` | **11 / 11** |

Reproduce: `node test/preview/verify-a42.mjs https://www.donovan.law`
Evidence: `test/preview/a42-evidence.json`

---

## How "no junk data" was enforced

Not by intent — by three independent layers plus an accounting step that reconciles two
separately collected counters.

| Layer | Mechanism | Result |
|---|---|---|
| 1 | `addInitScript` wraps `fetch` / `XMLHttpRequest` / `sendBeacon` in **every document, before any product script**. A write-path URL is recorded and **dropped** — never passed to the real fetch | 1 booking POST composed and captured |
| 2 | Context-level `route()` on the same patterns that **aborts** (not `fulfill`) | never fired |
| 3 | `page.on('request')` counts write-path requests the browser actually issued; §S5 fails unless **zero** | **0** |

Severed paths: `/booking/create`, `/web-call`, `/consent-notice`, `/fn/qualifier_submit`,
`/fn/save_lead`, `/fn/take_message`, `/fn/booking_confirmed`, `upsert-lead`.

A fourth, independent guarantee fell out of the run: the composed POST carries
`turnstile_token: ""`, and `/booking/create` refuses a tokenless body with `403 TURNSTILE_REQUIRED`
**before it touches Clio**. Even a request that had defeated all three layers could not have booked.

---

## Task 1 — `/` is the real indexable homepage, router on, frame headers live

| # | Check | Result |
|---|---|---|
| S1.1 | `/` answers **200**, 0 redirects, URL stays `/` (a 200-rewrite preserves it) | ✅ |
| S1.2 | **No noindex** — no `meta[robots]`, no `X-Robots-Tag` | ✅ |
| S1.3 | Real homepage — `h1` present, **45,181 bytes**, crawlable prose, >20 internal links | ✅ |
| S1.4 | Self-canonical `https://www.donovan.law/` | ✅ |
| S1.5 | **One document** — 0 iframes, no `perch-inject`, top-level | ✅ |
| S1.6 | Router container **`#perch-main`** present | ✅ |
| S1.7 | Router injected, `ready`, registered with the layer | ✅ |
| S1.8 | Persistent layer **`#perch-persistent`** mounted | ✅ |
| S1.9 | CSP **`frame-ancestors 'self'`** — narrowed, not permissive | ✅ |
| S1.10 | **`X-Frame-Options: SAMEORIGIN`** | ✅ |
| S1.11 | A **foreign origin is actually refused** when it tries to frame `/` (behavioural, not header-reading) | ✅ |

`PERCH_ROUTER=on` is **proven by behaviour, not assumed**. On `www.donovan.law` the hostname rule
in `routerEnabled` is false, so all three gates — homepage substitution, router injection, frame
narrowing — can only be on if the variable is explicitly `on`. All three are on.

Title served at `/`:
`Donovan Legal PLLC | Tax-First Practice Focused on Real Estate | Delray Beach, Florida`

**F8 is dead.** `sitemap.xml` declares `/` indexable, `robots.txt` is `Allow: /`, and `/` now
serves indexable content. The sitemap contains **0** `perch`/`home` entries.

---

## Task 2 — concierge launcher, Paula wiring, navigation persistence

| # | Check | Result |
|---|---|---|
| S2.1 | Launcher **`#dvn-perch-launcher`** present on a content page (`/contact`) | ✅ |
| S2.2 | Visible, in viewport, and **hit-tests to itself** (presence ≠ clickability) | ✅ |
| S2.3 | Launcher lives **inside `#perch-persistent`** — a swap cannot take it | ✅ |
| S2.4 | `/web-call` answers exactly like every other POST-only Function | ✅ (see caveat) |
| S2.5 | CSP + Permissions-Policy admit the voice transport (`wss://*.retellai.com`, `*.livekit.cloud`, `microphone=(self …)`) | ✅ |
| S2.6 | Paula wired — Vantage `perch.js` tag with `data-agent`, plus `donovan-widget.js` | ✅ |
| S2.7 | **Precondition** — live audio resource attached via the layer's own seam and `running` | ✅ |
| S2.8 | `/contact → /blog` keeps the **same layer `instanceId`** | ✅ |
| S2.9 | **Live session not torn down** — its own audio clock kept advancing across the swap | ✅ |
| S2.10 | **Back** preserves layer + live session | ✅ |
| S2.11 | **Forward** preserves layer + live session | ✅ |
| S2.12 | Launcher still mounted after nav + back + forward | ✅ |

**The live-session proxy.** A real Retell call cannot be driven from automation, so an
`AudioContext` is registered through `Perch.layer.attachLiveResource()` — the layer's own
published seam for "a live resource that must survive a swap". It is a WebRTC-grade proxy: same
audio pipeline, same realm, its own monotonic clock. A document teardown takes it with it exactly
as it would take a call. Across nav, back and forward the clock kept advancing and `instanceId`
never changed.

**MANUAL — a full voice call.** Clicking the launcher mints a real, metered Retell session and a
real Vantage lead. Retell refuses automation by design. One human pressing the orb, talking to
Paula, and navigating mid-call is the remaining inch.

**⚠️ Caveat on S2.4, stated because the obvious reading of it is wrong.** `/web-call` cannot be
liveness-probed from outside. Measured:

| Path | GET | | Path | GET |
|---|---|---|---|---|
| `/web-call` | 404 | | `/booking/types` | 200 |
| `/booking/create` | 404 | | `/consent-notice` | 200 |
| `/fn/qualifier_result` | 404 | | **`/no-such-function-a42`** | **404** |

`OPTIONS` returns 405 for both `/web-call` and a nonexistent path. **A deployed POST-only Function
and a path that does not exist are indistinguishable on both verbs.** So S2.4 asserts only the
consistency differential; `/web-call`'s deployment rests on build provenance below. Proving it
positively would mean minting a real Retell session.

---

## Task 3 — booking exercised up to, but not including, a write

| # | Check | Result |
|---|---|---|
| S3.1 | Booking widget **opens** on the live site (`#dl-booking[data-api-init]`, gate revealed) | ✅ |
| S3.2 | Read side live — `/booking/types` returns real appointment types | ✅ |
| S3.3 | Advances day → slot → next, reaches the details form | ✅ |
| S3.4 | **Turnstile renders** into the live form — mount populated, `cf-turnstile-response` minted | ✅ |
| S3.5a | Booking gate re-opens on the **swapped-in** `/book` | ✅ |
| S3.5b | Swapped-in form is drivable to details as well as a first load | ✅ |
| S3.5 | **Turnstile re-renders fresh** into the swapped-in form — new mount node, populated | ✅ |
| S3.6b | Details form accepts the synthetic values; honeypot left empty | ✅ |
| S3.6 | Widget **composed** a POST to `/booking/create` | ✅ |
| S3.7 | Composed body is **correct** — every required field, slot as an ISO instant | ✅ |
| S3.8 | **`call_id` threaded through the shipped `setCallId` bridge** into the body (A32 client half LIVE) | ✅ |
| S3.9 | Composed POST **could not have booked** — empty Turnstile token | ✅ |
| S3.10 | **STOPPED BEFORE SUBMITTING** — zero write-path requests reached the network | ✅ |

The exact body the live widget composed, captured at the `fetch` boundary and dropped:

```json
{
  "deployment": "donovan-main",
  "type": "consult",
  "slot": "2026-07-27T13:30:00.000Z",
  "name": "A42 Smoke Probe",
  "email": "a42-smoke@donovan-law-smoke.invalid",
  "phone": "5615550142",
  "notes": "SARAH-A42 post-promote smoke — composed, never submitted.",
  "call_id": "a42-smoke-not-a-real-call",
  "turnstile_token": ""
}
```

Synthetic by construction: `.invalid` is the RFC 2606 reserved TLD, so a confirmation mail could
not reach a real inbox even if one had been sent; the phone is in the 555 reserved range; the
`call_id` names no real Perch session, so the server would resolve it `unverified` and withhold
the join.

### Turnstile — investigated, and production is clear

The first run reported Turnstile broken on production. **It is not.** That finding was
harness-side and is recorded here because the false version of it would have read as "nobody can
book".

| Environment | Origin | Outcome |
|---|---|---|
| Playwright bundled Chromium, **headless** | `www.donovan.law` | `TurnstileError 600010`, no token |
| Playwright bundled Chromium, **headed** | `www.donovan.law` | `TurnstileError 600010`, no token |
| Headed + stealth (`--disable-blink-features=AutomationControlled`, `navigator.webdriver` masked) | `www.donovan.law` | `TurnstileError 600010`, no token |
| **Real Chrome** | `www.donovan.law` | ✅ `ok: true`, **773-character token**, 0 errors |
| **Real Edge** | `www.donovan.law` | ✅ `ok: true`, **773-character token**, 0 errors |

Same sitekey (`0x4AAAAAAD3X3AEk_IbefC4I`, byte-identical to `main`), same production origin,
isolated from the booking flow by `test/preview/probe-turnstile-isolated-a42.mjs`. `600010` is
Cloudflare's browser-integrity refusal of the driver, not a site defect — and note it is **not**
`110200` (unknown domain), which is what a real sitekey/domain misconfiguration produces and what
this sitekey returns on localhost.

**Two assertion traps this exposed, both now fixed in the verifier:**

1. **Do not assert on a challenge iframe.** A *solved* managed challenge paints **no iframe** —
   the successful real-Chrome run reports `iframe: false`. An iframe is an artefact of the
   interactive path, not evidence of a working widget. The A23 work had already settled this
   (assert widget identity and `mount.children.length`); ignoring it produced a false red aimed
   at production.
2. **The token is unobtainable by any driver.** S3.9 turns that into a safety property rather
   than pretending otherwise.

**MANUAL — one completed booking.** The last inch is a human filling the form and pressing
Confirm, which is also the only way to observe the server half of the call_id bind (below).

---

## Task 4 — state reconciliation

| # | Check | Result |
|---|---|---|
| S4.1 | **`/perch` still serves the shell 200** for Paula — `noindex`, iframes `/home.html` | ✅ |
| S4.2 | The shell's **same-origin iframe still loads** — `frame-ancestors 'self'` did not break Paula | ✅ |
| S4.3 | **No stale cache** at `/` — 4 cache-busted fetches, every one the real homepage, 0 iframes, no noindex | ✅ |
| S4.4 | `/` served **`Cache-Control: no-store`** — no intermediary can pin the pre-promote bytes | ✅ |
| S4.5 | **No orphaned shell state** — no `perch-inject`, no `__perchInjected`, no nested frame, no second orb | ✅ |

**`/` and `/home` are the same document** (identical hash with nonces stripped) — A51 promoted
`home.html` to back both, rather than duplicating it, so the two cannot drift.

**No orphaned rewrite, and this is deliberate.** `_redirects` still carries `/ → /perch.html 200`.
It is unreachable while the router is on — the Function substitutes `/home` upstream of the asset
handler — and it is **the rollback lever**: `PERCH_ROUTER=off` restores the shell at `/` with no
redeploy and no revert. Removing it would remove the kill switch.

**Build provenance — 11 / 11 modules byte-identical to `main` @ `11d4b67`** (CRLF-normalised;
the repo checkout is CRLF and Pages serves LF, which fakes a diff):

`perch-layer.js` · `perch-swup-router.js` · `perch/surface.js` · `perch/placement.js` ·
`perch/booking-control.js` · `perch/reinit.js` · `perch/swap-policy.js` · `perch/call.js` ·
`booking-widget.js` · `donovan-widget.js` · `page/booking-gate.js`

This doubles as a stale-bundle check: production is serving the promoted build, not a cached
pre-promote one.

### Residual — the server half of the call_id bind is NOT measured here

Stated rather than claimed. A Durable Object **has no public HTTP path**, so `perch-do`'s
non-destructive `/has` probe cannot be reached from outside. `fn/qualifier_result` — the one
Function that would reach the DO — is auth-gated *and* read-once, so probing it would **consume a
live caller's slot**. Reading a secret to authenticate was out of scope by order.

What *is* established: S3.8 proves the client half threads the id into the POST body on
production; the server half (`qualifier-bind.js`, the `qualbk:<callId>` KV witness, the `/has`
probe) is tied to this deployment by build provenance and by `test/booking-callid-bind.test.mjs`
(17/17). **Whether `perch-do` itself has been redeployed with `/has` is an ADAM/David fact, not
an observable one** — and it is not a blocker either way: un-redeployed, the old DO answers `{}`
for unknown paths, which `probeBridge` reads as "unknown" and degrades to KV-only verification.
The documented path.

---

## Task 5 — secret-rollback caveat added to the runbook

Added as [`docs/PERCH-CUTOVER-RUNBOOK.md`](./PERCH-CUTOVER-RUNBOOK.md) §3.

> **Secrets do not roll back with a deployment. Rolling back the deployment does not restore a
> rotated secret.**

A Pages deployment snapshots **code and assets**; environment variables and secrets are
**project-level configuration**, versioned separately and resolved at request time. Rolling back
runs old code against **today's** secret values, and a rotation has no deployment to revert.
"Roll it back" is a complete remedy for a bad build and **no remedy at all** for a bad rotation.

The runbook carries the blast radius per secret (`TIER_*`, `VANTAGE_WRITE_SECRET`, Clio, Retell,
Turnstile, tool-auth), both rollback levers, and five operating rules — including *never roll back
as the first response to an auth-shaped failure*, and *never rotate in the same window as a
promote*.

---

## Harness defects found and fixed (none were product defects)

Recorded because each one, left in, would have produced a wrong verdict about production.

| # | Symptom | Cause | Fix |
|---|---|---|---|
| 1 | "Launcher ABSENT" on a page where it was present and working | Guessed id `dl-launcher`; the real id is **`dvn-perch-launcher`** (`donovan-widget.js:26`) | Correct selector; the step reports the candidates it *did* find, which is how it was caught |
| 2 | "`/web-call` unreachable" | The liveness probe used the **page's** `fetch` — **Layer 1 severed the harness's own probe** | Issue it from Node; and then discovered it proves nothing anyway (see S2.4 caveat) |
| 3 | "Widget never reached the details form" | Stopped at slot selection. `#dl-bk-next` is what sets `step = 'FORM'` (`booking-widget.js:1117`) | Click it |
| 4 | "No appointment type selected" | **Correct behaviour** — one type exists (`consult`) and `booking-widget.js:1466` auto-selects when `types.length === 1` | Wait for the day strip, not a type list |
| 5 | "Turnstile broken on production" | Asserted on a challenge **iframe**; a solved managed challenge paints none, and the driver is refused `600010` regardless | Assert widget identity + mount population; prove the driver is at fault in real Chrome/Edge |
| 6 | "Turnstile did not re-render after a swap" | Soft nav drops `?unlock=dev`; the booking gate re-closed, so there was no form to render into | Write the `donovan_booking_unlock` localStorage half, exactly as `js/perch/call.js:151` does |

---

## What this sign-off does **not** claim

1. That a **real Retell voice call** survives navigation. The audio proxy is a live audio clock
   registered through the layer's real seam — not a call.
2. That a **booking completes end-to-end** on production. The Turnstile token is unobtainable by
   any driver; the composition is proven to the byte and stops there.
3. That **`perch-do` has been redeployed** with `/has`. Not observable black-box; not a blocker.
4. That **Clio's UI renders** what Paul reads. `test/perch-cutover-callid.test.mjs` proves every
   server hop; the last inch is one human-executed booked call.

---

## Recommendation

**Production is healthy post-promote.** All six ordered tasks are complete, every automated check
passes, and nothing was written to a live system. The three MANUAL items above are inherent to
Retell and Turnstile refusing automation, not gaps in coverage — they should be run once by a
human as launch acceptance.

*Agents do not merge. Zane gates, David merges.*
