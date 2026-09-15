# SARAH — Perch A4.1 cutover QA sign-off (RE-RUN)

**Order** SARAH-PERCH-A41-RERUN · **Ticket** [#60](https://github.com/TicoAI/DonovanLegal/issues/60) · **Parent** #15
**Phase** A / Phase 4 · **Owner** Sarah (QA) · **This suite gates the PROMOTE, not the build.**

> **This document supersedes the A4.1 sign-off on [PR #80](https://github.com/TicoAI/DonovanLegal/pull/80).**
> That verdict was NO-GO. Both blockers it named have shipped, and this re-run measures
> them closed on a fresh Preview built from current `main`.

---

## VERDICT: **GO** for the production promote

Both blockers from PR #80 are **confirmed closed on the deployed Preview** — read off the
live window and the real handler, not from source:

| Blocker | Ticket | Merged as | PR #80 measured | This re-run measures |
|---|---|---|---|---|
| **B1** | [#58](https://github.com/TicoAI/DonovanLegal/issues/58) A3.3 — "no control function exposed on `window`" | `645e37e` ([#83](https://github.com/TicoAI/DonovanLegal/pull/83)) | **6 control functions on `window`** (4 on `Perch.layer`, 2 on `__perch`) | **0.** `setRouter` gone from the tree; `Perch.layer` = 4 read-only keys; `__perch` = `{probe}` |
| **B2** | [#57](https://github.com/TicoAI/DonovanLegal/issues/57) A3.2 — "bind `call_id` **server-side**" | `dffcd5c` ([#82](https://github.com/TicoAI/DonovanLegal/pull/82)) | **Client-supplied** — `create.js` read it from the body and trusted it | **Server-confirmed.** A forged id attaches nothing and opens a fresh lead |

Everything the rewire itself had to prove is green, as it was on PR #80: the live call
survives every navigation shape tested, a swap during an in-flight booking POST does not
double-book, `call_id` threads end to end, and the 07-15→07-17 booking guards all hold
through the rewired DOM.

**One non-blocking finding stands, unchanged and re-confirmed:** head metadata beyond
`title`/`canonical` does not follow a swap (§T2.5b). Crawler impact is nil. It was not a
blocker on PR #80 and is not one now — detail in [§ Known findings](#known-findings-non-blocking).

**Nothing was booked.** 1 write requested, 1 intercepted, **0 escaped** — see [§ Nothing was booked](#nothing-was-booked).

---

## What was tested, and where

| | |
|---|---|
| Preview deployment (immutable, pinned) | **`https://20bf407f.donovan-site.pages.dev`** |
| Branch alias | `https://sarah-perch-a41-rerun.donovan-site.pages.dev` |
| Commit | `84712c3` on `sarah/perch-a41-rerun`, branched from `main` @ `645e37e` |
| Deploy run | [30170629511](https://github.com/TicoAI/DonovanLegal/actions/runs/30170629511) — success (Tree-integrity ✔, Test ✔, Deploy Preview ✔, Deploy PRODUCTION skipped) |
| Run taken | 2026-07-25 · Chromium · 35 steps |
| Raw evidence | `test/preview/a41-evidence.json` |

> The verifier and the deployment it measured are the **same commit**. An earlier run
> produced the identical 34/35 against Preview `be6c361a` (`a19e4bd`) before the harness fixes
> in F3 landed; it was re-measured rather than reconciled across two SHAs. The five product
> modules hash identically on both deployments, which is what "test-only change" means here.

**The product code on this Preview is `main`'s, byte for byte.** The branch adds test files
only; no file under `donovan-legal-site/` is touched. Verified by fetching each router-path
module off the deployment and hashing it against the repo (CRLF-normalised):

| Module served by the Preview | vs `main` |
|---|---|
| `/js/perch/surface.js` | **identical** (`209c085f…`) |
| `/js/perch-layer.js` | **identical** (`e42a2af4…`) |
| `/js/perch/qualifier.js` | **identical** (`539c4232…`) |
| `/js/perch-swup-router.js` | **identical** (`9a18c0da…`) |
| `/js/perch/booking-control.js` | **identical** (`17078f50…`) |

> Compare with `tr -d '\r'` on both sides. A raw byte-count or `diff` comparison reports a
> false difference here — the repo checkout is CRLF and the deployment serves LF, which on
> `perch-layer.js` alone is a 484-byte gap that looks exactly like a real drift.
> ([[feedback_windows_gcloud_curl_gotchas]])

**The router is ON here by construction, not by a flag this suite set.**
`functions/_lib/perch-router-inject.js:85` enables the router for any `*.pages.dev` hostname,
and a Preview deployment is that hostname. Step T0.2 does not assume it — it reads
`routerActive` out of the live layer, which *is* the gate.

### How the two fixes are verified — and the one honest asymmetry

**#58 (client) is verified ON THE DEPLOYMENT.** The window surface is enumerated and then
*attacked* in the live page: eight writes, in both JavaScript modes, plus a second router
registration through a real same-origin dynamic import. This is direct evidence.

**#57 (server) is verified against the real handler, NOT black-box on the deployment.**
`functions/booking/_lib/qualifier-bind.js` runs in a Pages Function; there is no way to
observe its decision from outside without **actually booking**, and #57 deliberately keeps
the 201 response shape identical whether or not the id verified, precisely so the endpoint is
not a guessing oracle. So the server half is proved by executing `create.js` directly against
stubbed stores (15 assertions), and the deployment is tied to it by the build provenance
above — the Preview is built from a commit whose tree contains `dffcd5c`. Stated plainly
rather than implied, because "we ran a Preview" must not be read as "we probed the server
fix live". ([[feedback_assessment_doc_is_not_code]])

---

## Results

### Preview suite — `test/preview/verify-a41.mjs` · **34 / 35 pass**

#### Task 1 — the live call survives

| Step | Check | Result |
|---|---|---|
| T0.1 | Router injected, ready, registered with the layer | **PASS** |
| T0.2 | Direct-DOM booking path ARMED (`routerActive` read from the live layer) | **PASS** |
| T0.3 | One document — no iframe, no `perch-inject.js` | **PASS** |
| T0.4 | Persistent layer holds exactly one concierge | **PASS** |
| T1.0 | PRECONDITION — live audio resource running, clock advancing | **PASS** |
| T1.1 | Call survives **plain navigation** | **PASS** |
| T1.2 | Call survives **opening the booking modal mid-call**, and the form really opened | **PASS** |
| T1.3a | Qualifier opens on the router path and lives **outside** the swap container | **PASS** |
| T1.3b | **Cross-page qualifier** keeps its place, its DOM node and the live call across a swap | **PASS** |

#### Task 4 — the cutover suite

| Step | Check | Result |
|---|---|---|
| T2.0 | PRECONDITION — adapter walked a real slot to the FORM step | **PASS** |
| T2.1a | PRECONDITION — exactly one POST in flight, held open | **PASS** |
| T2.1b | **A swap during an in-flight booking POST does not double-book** | **PASS** |
| T2.2 | **Back and forward** both soft-navigate; right page, container intact, no iframe | **PASS** |
| T2.2b | Live call survives **both** history moves | **PASS** |
| T2.3 | **Mobile** (390×844): router swaps, layer persists, orb is hit-testable | **PASS** |
| T2.4 | **First-load parity**: `/book` by swap matches `/book` loaded cold | **PASS** |
| T2.5a | §5.1 contract: **title and canonical follow the swap** | **PASS** |
| T2.5b | Every *other* head row keeps the previous page's value | **FAIL — MINOR, not a blocker** |
| T5.1 | **One GA4 `page_view` per swap** | **PASS** |
| T5.2 | GA4 is a *reported* stub — every row says `pending` and names the blocker | **PASS** |
| T5.3 | No swap reported a broken re-init row | **PASS** |

#### Task 3 — `call_id` through the rewired path

| Step | Check | Result |
|---|---|---|
| T3.1 | The id set through the **shipped adapter** is in the POST body the widget composed | **PASS** |
| T3.2 | It survived every content swap without being re-sent | **PASS** |

#### Task 2 — the security invariants, read off the LIVE window

| Step | Check | Result |
|---|---|---|
| T4.1a | `Perch.router` publishes a probe and nothing else | **PASS** |
| T4.1b | `Perch.layer` carries **only** the four reviewed keys | **PASS** |
| T4.1c | **#58 CLOSED** — `setRouter` and every other control handle gone from `window` | **PASS** |
| T4.2 | The call id on `window` is a **data** value, not a control surface | **PASS** |
| T4.3 | **#58 CLOSED** — `__perch` is `{probe}`; `openQualifier`/`closeQualifier` gone | **PASS** |
| T4.3b | `Perch`/`__perch` cannot be **reassigned**, slots cannot be **swapped** | **PASS** |
| T4.3c | A **second router registration is refused**, original still running | **PASS** |
| T4.4 | No swap re-executed, re-nonced or eval'd a fetched script · **0 CSP violations** | **PASS** |
| T4.5 | **0 uncaught page errors** across the run | **PASS** |

#### Task 5 — booking guards through the rewired DOM

| Step | Check | Result |
|---|---|---|
| T5.4 | The #34 prefill guards hold through the rewired DOM **on Preview** | **PASS** |

#### Nothing was booked

| Step | Check | Result |
|---|---|---|
| T6.1 | **Every** booking write was answered inside the browser — none reached Clio | **PASS** |
| T6.2 | The only write attempted was the one deliberate submit in T2.1 | **PASS** |

### Local suite — `npm test` · **663 pass / 0 fail / 1 skip**

664 tests, 130 suites. The single skip is the pre-existing env-gated deploy guard
(`CHECK_DEPLOY_CONFIG=1` with the real `CLIO_CALENDAR_ID`), unchanged from PR #80.

| File | Count | Covers |
|---|---|---|
| `test/perch-cutover-security.test.mjs` | **50** | §T4 window surface, incl. **§T4.3b — `surface.js` driven at runtime** |
| `test/perch-cutover-callid.test.mjs` | **15** | §T3 the `call_id` thread and the #57 contract |
| `test/perch-cutover-booking-guards.test.mjs` | **18** | §T5 prefill guards, in-flight submit, GA4 |

---

## The two blockers, in detail

### B1 — #58, the window control surface · **CLOSED**

`Perch.layer` used to be the layer **instance, published whole**, so `setRouter` — the
function that installs the navigation callback every agent-driven `go()` runs through — was
reachable and replaceable by any script in the document.

Measured on the deployment (`T4.1c`, `T4.3`):

- `Perch.layer` = `probe`, `bookingProbe`, `attachLiveResource`, `detachLiveResource` — and nothing else.
  Checked against all eleven withdrawn handles (`setRouter`, `mountShellConcierge`, `root`,
  `container`, `concierge`, `call`, `qualifier`, `inspect`, `isPersistent`, `instanceId`,
  `hostFallback`): **`stillExposed: []`**.
- `window.__perch` = `{probe}`. `openQualifier`/`closeQualifier` gone.
- `setRouter` appears nowhere in the executable text of any router-path module — withdrawn
  from the tree, not merely unpublished, so it is not one dynamic `import()` away.

> `attachLiveResource`/`detachLiveResource` remain public **by design**. `verify-a22.mjs`
> parks a live `AudioContext` clock through them and that is the A22 acceptance proof; they
> mutate a diagnostics `Map` nothing but `probe()` reads. Classified, not overlooked.

**Not exposed and not replaceable are different claims**, and only the second needs property
descriptors. `T4.3b` therefore attacks the live page rather than enumerating it:

| Attack | Strict (a hostile module) | Sloppy (a hostile classic `<script>`) |
|---|---|---|
| `window.Perch = {…}` | TypeError | silent no-op |
| `delete window.Perch` | TypeError | silent no-op |
| `defineProperty(window,'Perch',…)` | TypeError | TypeError |
| `window.Perch.layer = {…}` | TypeError | silent no-op |
| `defineProperty(Perch,'layer',…)` | TypeError | TypeError |
| `window.Perch.evil = …` | TypeError | silent no-op |
| `window.Perch.layer.probe = …` | TypeError | silent no-op |
| `window.__perch = {…}` | TypeError | silent no-op |
| **Result** | **all eight rejected** | **`nothingChanged: true`, `probeStillReal: true`** |

Descriptor on the deployment: `{writable: false, configurable: false}`. `layerFrozen: true`,
`identityHeld: true`.

> **Why both modes are run.** The first formulation of this step asserted only "every write
> throws TypeError" and **failed on a deployment where the invariant actually holds** —
> `page.evaluate` runs sloppy, where a write to a non-writable property is a silent no-op,
> while the unit half threw because ESM is always strict. Throwing is the *symptom*; the
> invariant is that the write does not take effect, and that holds in both. Asserting the
> symptom alone would have produced a **false NO-GO**.

`T4.3c` closes the navigation channel, which is what `setRouter` guarded:

```
setRouterExport:      "undefined"          ← not re-exported by another name
secondRegistrationOk: false                ← "a router is already registered"
hostileRouterEverRan: false                ← the attacker's callback never ran
routerActive:         before true → after true
routerRefused:        before 0    → after 1  ← the attempt is COUNTED and visible
```

The refusal is proved by **navigating**, not by reading a return value: the original router
handled the navigation and the hostile one was never called.

**Residual, stated not hidden.** `js/perch/surface.js` is importable same-origin — this run
imported it. What closes the hole is that A2.2 registers at boot, so the slot is taken before
any page script runs; `T4.3c` is the measurement of exactly that. #58's own module header
documents this. Under `script-src 'self'` an attacker who can run a same-origin module has
already won by other means.

### B2 — #57, the `call_id` server bind · **CLOSED**

The finding was narrower than "`create.js` trusts `call_id`". The Clio description already
required a `qualbk:` KV hit incidentally; **the Vantage merge key was the actual hole** —
`upsertVantageLead({callId})` forwarded the raw body value to `/upsert-lead`, where Vantage
*merges*.

Proved against the real handler (`test/perch-cutover-callid.test.mjs`, 15/15):

| Case | Evidence the server has | Clio description | Vantage merge key | Booking |
|---|---|---|---|---|
| **Forged id**, no record anywhere | none | no summary | **none — fresh lead** | **201** |
| KV copy `qualbk:<id>` present | KV | summary attached | **merges** | 201 |
| DO slot `qual:<id>` present, KV empty | bridge `/has` | no summary | **merges** | 201 |
| No `call_id` at all | n/a | no summary | none — fresh lead | 201 |
| Id present, **KV down / throwing** | none | no summary | **none — withheld** | 201 |
| Over-long id (clamped to 128) | none | no summary | none — fresh lead | 201 |

- **A forged id opens a fresh lead with nothing dropped**: the lead still carries name, email,
  phone and the typed notes; only the *merge* is withheld. The genuine caller's record is
  untouched — a forger cannot burn someone else's summary.
- **Fail closed on attachment, never on the booking.** A KV outage yields **201 with no merge
  key**: "could not refute" is not "confirmed". An appointment Clio accepted is never lost to
  a failed enrichment lookup.
- **The DO slot is never consumed** — `/has` does not delete, so Paula's read-once
  `get_qualifier_result` keeps its slot.
- **Auditable, not inferred**: all four `qualifier_join` outcomes (`none`, `unverified`,
  `verified_no_summary`, `attached`) are driven and asserted on the `booking:<id>` record,
  and the raw `call_id` is asserted **absent** from it — it is a bearer capability.

**Residual, asserted rather than merely written down.** A confirmed `call_id` proves *a
session by that id submitted a qualifier*; it does **not** prove the booker is that caller. A
**leaked** id still joins. Out of scope for #57 by design; pinned as a live assertion so the
boundary of the fix is a fact in the suite.

---

## Known findings (non-blocking)

### F1 · §T2.5b — head metadata beyond title/canonical does not follow a swap · **MINOR**

Carried forward from PR #80, re-confirmed unchanged. After a swap into `/book`,
`description`, `og:title`, `og:url`, `robots` and JSON-LD still hold `/contact`'s values;
`title` and `canonical` correctly follow. RE-INIT-INVENTORY §5.1 syncs those two only.

**Crawler impact is nil** — a crawler fetches each URL cold and never soft-navigates, so
`/book`'s `noindex` is still served and honoured. The exposure is in-session: a share sheet
or an extension reading `<head>` on a swap-arrived page gets the previous page's card.

### F2 · A second booking inside one call no longer merges · **NEW, minor, a consequence of #57**

Before #57 the merge key rode through on the raw body value, so a second booking on the same
call merged. Now the KV copy is burned on first use, and the DO slot is normally already
consumed by Paula mid-call, so a **second** booking in the same call is unverified and opens
a **fresh Vantage lead**.

Assessed acceptable: two bookings inside one call is rare, the appointment is still confirmed
and **nothing typed is dropped** — it lands as a separate lead rather than a merge. Recorded
so Wendy is not surprised by a second lead row rather than left to discover it.

### F3 · #58 is a breaking change for anything reading the old `Perch.layer` API · **informational**

The A4.1 Preview harness itself broke on it — the first re-run attempt **crashed** with
`l.mountShellConcierge is not a function`. That is the fix working, not a regression. The
harness was rewired onto the seams #58 deliberately left open: the `mountShellConcierge()`
**module export** of `js/perch-layer.js` (its header keeps it importable expressly so this
path stays testable) and the real DOM (`#perch-persistent`, `#perch-main`) instead of the
withdrawn `layer.root`.

**Sheldon's harnesses were checked and are unaffected** — `verify-a22.mjs`, `verify-a23.mjs`
and `verify-a31.mjs` use only `attachLiveResource` and `bookingProbe`, both of which #58 kept
public on purpose. No other in-tree consumer of the withdrawn handles exists.

---

## Nothing was booked

`POST /booking/create` writes a real entry to Paul Donovan's **live** Clio calendar and a real
lead into Vantage. There is no sandbox behind Preview, and this repo has already booked a real
appointment once from a probe that believed it was on an error path
([[feedback_negative_path_probe_can_write]]).

§T2 presses Confirm because that is the only way to observe a double-book. It is protected by
a **context-level** `ctx.route` registered *before the first page exists*; `route.fulfill()`
answers inside the browser and never opens a socket to the origin.

The final step does not assert intent — it reconciles two independently collected counters:

| | |
|---|---|
| Booking write requests the page made | **1** |
| Requests this run intercepted | **1** |
| **Escaped to Clio** | **0** |
| CSP violations | **0** |
| Uncaught page errors | **0** |

---

## How to re-run

Playwright is deliberately **not** in `package.json` (matching `verify-a22`/`verify-a31`):

```bash
npm ci
npm i --no-save playwright && npx playwright install chromium

npm test                                                             # 663 pass / 0 fail / 1 skip
node test/preview/verify-a41.mjs https://20bf407f.donovan-site.pages.dev
```

`verify-a41.mjs` is named so `npm test` never picks it up — it needs a live deployment and a
real browser, neither of which CI has. It **exits 0 whether it passes or fails**: a FAIL is a
result, not a crash. Read the JSON verdict it prints, and `test/preview/a41-evidence.json`.

> Redirect to a file rather than piping to `tail` — `tail` buffers the whole stream and the
> run looks hung for its full duration.

---

## Verdict

**GO for the production promote.**

Both PR #80 blockers are closed and confirmed on the deployed Preview; the full cutover suite
passes; `call_id` reaches Clio and Vantage only when the server confirms the record; and the
security invariants hold under attack in both JavaScript modes. The one failing step (F1) is
the pre-existing MINOR head-metadata finding with nil crawler impact, and F2/F3 are recorded
consequences of the two fixes rather than defects.

**Sarah does not merge and does not promote.** Zane gates; David merges.
