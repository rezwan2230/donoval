# SHELDON — PERCH A2.2: the Swup router

**Order:** SHELDON-PERCH-A22-SWUP · **Ticket:** [#52](https://github.com/TicoAI/DonovanLegal/issues/52) · **Parent:** #15
**Phase:** A / Phase 2 · **Depends:** A0.1 (#66) · A0.2 (#65) · A0.3 (#63) · A2.1 (#74) · A2.5 spike (#55)

**Preview:** https://sheldon-perch-a22-swup.donovan-site.pages.dev
**Evidence:** `test/preview/a22-evidence.json` (machine-generated) · **Reproduce:** `node test/preview/verify-a22.mjs`

---

## Result

**16 of 16 Preview checks PASS.** 94 pages swapped in a single document, **zero full
reloads**, zero CSP violations, zero uncaught page errors. The booking-gate reveal
fires after a `/contact` → `/book` swap with the widget booted. The persistent
layer's AudioContext clock advanced 0 → 48.39 s unbroken across all 94 swaps.

| Acceptance (#52) | Result |
|---|---|
| Internal nav swaps without a full reload | **PASS** — 94 swaps, 0 document loads |
| Every inventory item re-bound | **PASS** — all 11 §5 rows executed or reported; see the table below |
| GA4 `page_view` fires per swap | **STUB, as ordered** — reported `pending` on every swap; no `G-` id exists (external blocker) |
| The call persists across swaps | **PASS** — one `instanceId`, monotonic audio clock, 496 layer ticks |

Root suite: **477 tests, 476 pass, 0 fail, 1 skipped** (55 of them new).

---

## What shipped

| Path | Note |
|---|---|
| `js/perch-swup-router.js` | The router. Boots top-level-only, on pages that have a container |
| `js/perch/swap-policy.js` | The allow-list, the deny-list, the exclusions, the shared-chrome gate — pure, no side effects, exercised directly by CI |
| `js/perch/reinit.js` | RE-INIT-INVENTORY §5, one function per row |
| `js/vendor/swup.umd.js` | Swup 4.9.2, self-hosted, sha256-pinned in CI |
| `functions/_lib/perch-router-inject.js` | The injector + the `PERCH_ROUTER` environment gate |
| `functions/_lib/perch-layer-inject.js` | +1 parameter (`extraTags`) — see finding **F5** |
| `functions/_middleware.js` | Wires the router tag into the existing rewrite pass |
| `js/booking-widget.js` | Publishes `DLBooking.boot` — the §5 row 5 seam. No write-path change |
| `test/perch-swup-router.test.mjs` | 55 assertions |
| `test/preview/verify-a22.mjs` | The Preview verifier |
| `.gitattributes` | Pins the vendored router's line endings so the hash check survives a Windows checkout |

**No CSP change. No page file edited. No `.github/workflows` change.**

---

## Task 1 — interception, the container, and the exclusions

Swup 4.9.2, vendored to `js/vendor/swup.umd.js` and served from `'self'`, wired to
`containers: ['#perch-main']`. Every script the router inserts is an external
`src` script, admitted by the CSP host allow-list rather than by nonce, so nothing
here needs, reads or forges one.

The vendored bytes are `npm pack swup@4.9.2` → `package/dist/Swup.umd.js` minus the
single trailing `sourceMappingURL` line, and are **byte-identical to the copy the
A2.5 spike ran on Preview to earn the GO**. `test/perch-swup-router.test.mjs` pins
the sha256, so "what was proven" and "what ships" stay the same statement.

**Exclusions**, each carrying its reason in `swap-policy.js`:

| Rule | Why |
|---|---|
| `/gold /platinum /diamond /reserve` | Basic auth at the edge. A 401 + `WWW-Authenticate` only prompts on a real document navigation; an intercepted tier link would hand the router an opaque 401 and the member would never be asked for a password |
| `/`, `/perch`, `/perch.html`, `/index`, `/index.html`, `/nav-block` | No swap container (A0.1 `skip`), or a redirect into one |
| `/tool-1031-exchange` | `js/tool-1031-exchange.js:2594` boots on a bare `DOMContentLoaded`, which has already fired by adoption time — it would never boot at all |
| `/tool-rental-…`, `/tool-str-…`, `/tool-entity-formation`, `/tool-firpta-withholding`, `/engagement-scoping` | Load-time element bindings with no re-init seam: correct on first arrival, silently dead on a return visit |

The last six are the honest cost of not re-executing scripts. Excluding them buys
today's behaviour — a full navigation that always works — instead of a calculator
that looks fine and does nothing the second time. Each is a Phase-3 work item:
wrap the module's init in `DL.ready` and delete the entry.

**Verified against a DEEP tier URL, never a root** (spike C5/F3). `/diamond/tool-economics`
on Preview: `401 WWW-Authenticate: Basic realm="Donovan Legal - Diamond Members"`,
real navigation, router torn down with the old document.

---

## Task 2 — the script adoption step

This is the piece A0.1 and A0.2 do not cover, and the reason the spike's GO was
conditional. `DL.ready` re-runs what is **registered** in the live document, and
across this tree almost nothing is: `js/dl-init.js` is referenced by 2 of 143
pages, `js/page/booking-gate.js` by one, `js/booking-widget.js` by one **from the
end of body**, which A0.1 leaves outside the container. A swap from `/contact` into
`/book` therefore dispatched the re-init event into a document where the gate code
had never been loaded, and `#book-live` stayed hidden behind a gate no code was
present to open.

The spike closed it by syncing every `<script src>` the response carried. **This
ships the allow-listed form instead**: the shell decides, in `swap-policy.js`,
which files a swap may execute. Twelve entries, head **and** end-of-body, deny by
default.

| Property | How it holds |
|---|---|
| Only `script[src]` is considered | The selector cannot match an inline block — re-nonce / re-execute / eval are unreachable, not merely unused |
| Fresh element, `src` only | One `createElement('script')` in the file; CI enumerates every property it assigns (`src`, `async`, `onload`, `onerror`) |
| Order preserved | `async = false` **and** a sequential await — `dl-init.js` must be executing before `booking-gate.js` runs |
| Nothing runs twice | Deduplicated by resolved absolute URL against the live document |
| Refusals are visible | Every decision is logged with its reason, including the denials |

On Preview, across 94 swaps: **all 12 allow-list entries exercised, zero unlisted
refusals, zero CSP violations.**

The one cross-origin entry is Turnstile's `api.js`. It is adopted deliberately:
`js/booking-widget.js:1228-1236` renders Turnstile **explicitly** into
`#dl-bk-turnstile`, so without `window.turnstile` the token would be empty and
`/booking/create` would reject every booking. Denying it would have broken the
booking write path by omission. It is already on the CSP `script-src` host list.

---

## Task 3 — RE-INIT-INVENTORY §5, as executed

Measured live on Preview, from `Perch.router.probe()`:

```
1:ok  2:replaced  3:ok  4:survives  5:absent  6:covered  7:deferred  8:deferred  9:ok  10:ok  11:pending
```

| § | Row | What happens |
|---|---|---|
| 1 | title + canonical | Set from the incoming document, **before** everything downstream reads them |
| 2 | re-execute page scripts | **Replaced** by the allow-list adoption — an allow-list of files, never a re-execution of markup |
| 3 | site nav | **Guard, not a re-bind** — see finding **F3** |
| 4 | delegated handlers | Survives — all bound on `document` |
| 5 | booking widget `boot()` | Called through `DLBooking.boot()`; idempotent via `[data-api-init]` |
| 6 | `/book` unlock gate | Covered by `booking-gate.js` re-running on `dl:content-swapped` |
| 7 | re-hand the call id | **Deferred to Phase 3** — the postMessage control channel, out of scope for this order |
| 8 | re-deliver prefill | **Deferred to Phase 3** — same channel |
| 9 | Vantage beacon | Notified by Swup's `pushState`; the tag is on the deny list and is structurally un-re-loadable |
| 10 | tool calculators | Delegated dispatch survives; `DonovanInputFormatter.attachAll(container)` re-runs per swap |
| 11 | GA4 `page_view` | **Documented stub** — see Task 6 |

Rows 7 and 8 are *reported*, not dropped. A checklist that omits the row it did not
do is how the A0.3 prose drifted from the code in the first place.

**Spike F2 is closed for the formatter**, measured on the return visit that used to
lose it: `#ord_income._dlFmtAttached` is `true` on the second arrival, and the
calculator computes `$500,000` total with `$300,000` in the 15% bracket — the same
numbers the spike measured on a first arrival.

Two events are dispatched, because two contracts are in play: `dl:content-swapped`
(A0.2's bus, first) and `perch:content-swapped` (A2.1's invariant guard, last, so
it observes the finished DOM).

---

## Task 4 — Preview proof, across the full page set

`node test/preview/verify-a22.mjs`. The page set is **derived by calling the
shipped `excludeReason`**, so the verifier and the router cannot disagree about
what is in scope. Navigation is by clicking a real anchor written in the `.html`
form — all 5719 internal anchors in this tree are `.html` links — so the
interception path is exercised, not the programmatic entry point behind it.

| Check | Result |
|---|---|
| 94 interceptable pages swapped in one document | **PASS** — 0 failures |
| No full document reload during the sweep | **PASS** — 0 |
| Persistent layer + live resource survived | **PASS** — one `instanceId`, audio clock 0 → 48.39 s, 496 ticks |
| Booking-gate reveal after `/contact` → `/book` | **PASS** — gate hidden, `#book-live` visible, `widgetBooted: true`, via the production `localStorage` unlock, not `?unlock=dev` |
| …because the end-of-body widget was adopted | **PASS** — `/js/booking-widget.js` in the adoption log |
| Deep tier URL not intercepted | **PASS** — 401 Basic challenge |
| Every `.html` link resolved to its clean URL | **PASS** — 0 dirty URLs, including 11 legacy redirects |
| Chrome-less origin hard-navigates | **PASS** |
| Spike F2 — formatter re-attached on return | **PASS** |
| GA4 row reported `pending`, rows 7/8 `deferred` | **PASS** |
| CSP violations / page errors | **0 / 0** |

`instanceId` is minted once per layer mount, so an unchanged id across 94 swaps is
element **identity**, not presence; an AudioContext clock only advances while the
context lives, so its monotonic increase is positive proof the audio graph was
never torn down and the document never reloaded.

---

## Task 5 — the CI assertions

`test/perch-swup-router.test.mjs`, 55 assertions, in `npm test` (so `build-and-test`
gates every PR). The load-bearing ones:

- **Only allow-listed external scripts are adopted** — the real `planAdoption` is
  driven over all 95 interceptable pages; anything it would queue must be on the
  list. Mutation bites cover an unlisted script, a cache-busted `?v=` src (fails
  **closed**), a `javascript:` src, and an inline block — which never appears in
  the decision log at all.
- **The router never re-executes, re-nonces or evals** — no `eval`, `new Function`,
  `.innerHTML =`, `document.write` or `insertAdjacentHTML` anywhere in the file;
  the word `nonce` appears in no line of code; exactly one `createElement('script')`
  and an enumeration of every property it sets.
- **The reveal fires after a cross-page swap into `/book`** — executed for real in
  jsdom: a `/contact` document that has never loaded `DL.ready`, the real A0.1
  container markup swapped in, the real adoption queue executed, the real event
  dispatched, and `#book-live` asserted visible. **With a control** that removes
  the adoption step and asserts the reveal does *not* fire — if that control ever
  passes, the test above has stopped proving anything.
- **Completeness in both directions** — every script an interceptable page
  references is classified, and no list entry is dead.
- **The CSP is unchanged** — asserted against the real `buildCsp()` output, and
  every adoptable script must already be admitted by it.

---

## Task 6 — GA4 `page_view`: a documented stub

There is no GA4 tag on this site. A0.3 §3.8 established that from the code (zero
hits for `gtag(`, `googletagmanager`, `dataLayer`, `G-…`, `AW-` in any shipped page
or script) and `HANDOFF.md:120` lists the `G-` measurement id as an outstanding
**external** blocker.

`gaPageView()` in `js/perch/reinit.js` runs on every swap and reports `pending`
with that reason. It looks up `window.gtag`, so **it starts working the moment the
tag lands, with no further edit**. The four requirements for whoever wires it —
automatic page-view measurement disabled, fire after the title/canonical sync, the
exact event shape, and *do not* put the tag on the adoption list — are written into
the function's doc comment rather than left to be re-derived.

---

## Findings

### F1 — an exclusion that names one spelling of a URL is not an exclusion

The first full Preview sweep produced exactly one reload in 95 swaps. Cause:
`/index.html` was excluded and `/index` was not. Cloudflare Pages serves `foo.html`
at `/foo` **and** answers `/foo.html`, so every page has two live URLs and only one
of them redirects. `/index` resolved to the shell, Swup found no container, and
fell back to a full document load.

Two CI checks now cover the class rather than the instance: every page's two
spellings must agree on exclusion, and any `_redirects` source whose target is
excluded must be excluded in both spellings too. Both are derived from the tree.

**Swup failed safe here** — a missing container produced a full navigation, not a
broken page. That is worth recording as a property of the router, not luck.

### F2 — the shared-chrome gate

A0.1 puts the site nav **outside** the container, which is what makes it survive a
swap. The consequence nobody had stated: the chrome a visitor keeps is the chrome
of the document they **loaded**. Soft-navigating away from a page that has none
would hand the destination a document with no nav to inherit, and the destination
would render stripped of its navigation.

Measured: 83 of the 96 interceptable pages carry the shared chrome; 13 do not
(`404.html`, the 8 controversy-roadmap posts, `blog-bramblett…`, and three tool
teasers). All 13 render with no site nav **today**, so the router hard-navigates
away from them — exactly their current behaviour, zero regression. The gate is
evaluated against the live document, so it bites only on a full load of a
chrome-less page: once a visitor has soft-navigated *into* one from a chrome-bearing
page the chrome is still there and navigation continues to swap.

### F3 — §5 row 3 is SURVIVES, not RE-INIT, under the A0.1 container

A0.3 was written against the body-swap model. Re-measured by running the real A0.1
pipeline over all 143 documents and asking jsdom which side of the container each
binding target landed on: `nav.menubar`, `.hamburger`, `.btn-close.menu`,
`.dropdown`, `#theFirm`, `#thePractice`, `#btn-tf`, `#btn-tp`, `.nav-mobile-overlay`
— **0 inside the container, 1094 outside**, across 96 pages.

So re-running `js/main.js` would not be a re-init; it would be a second binding of
a document-level click listener and a second `members-gate.js` loader. Row 3 is
therefore a **guard**: it reds if a future page shape ever moves the nav inside the
container, turning a silent regression into a visible one.

Related correction: `.img-hover`, `.mobile-hover`, `.cmm-logo-hover`, `a.marker` and
`.pin-popup` — five RE-INIT rows in A0.3 §3.1 — match **zero elements** in the
shipped tree. `js/main.js` still binds them; nothing carries those classes.

### F4 — spike condition C3 is resolved by Swup itself

The spike recorded that Swup "pushes the URL it was asked for while rendering what
the fetch resolved to", and made linking clean URLs a **Must**. That is not what
4.9.2 does: at `content:replace` it compares the current URL against the fetched
`response.url` and `replaceState`s to the resolved one.

Measured on Preview: 94 swaps driven entirely through `.html` links produced **zero
dirty URLs**, including 11 legacy `_redirects` hops (`/the-cmm` → `/practice`,
`/about-membership` → `/engagement`, `/taxation` → `/tax`, …), each of which landed
on the correct canonical URL. This matters because rewriting 5719 internal anchors
was never a real option.

### F5 — two `onEndTag` handlers on the same element do not compose

lol-html keeps only the **last** `onEndTag` callback registered for an element.
Registering the router as its own `['head', …]` handler silently **deleted** the
persistent layer's tags — no error, no console message, just a site with no orb.
Found by driving the real rewriter, not by reading the docs.

So `layerHandlers(plan, extraTags)` now emits both from one callback, and a CI test
asserts both tags survive a real rewrite in the order the router depends on.

---

## Open items, carried not closed

| | Item | Owner |
|---|---|---|
| **O1** | The `stamp` shape (15 pages) is still unproven — all 15 are behind tier auth, which task 5 requires be excluded. Unchanged from spike F4; the tension is structural |
| **O2** | §5 rows 7 and 8 — call-id re-handoff and prefill re-delivery — are Phase 3 |
| **O3** | Six pages are excluded for want of a re-init seam. Wrapping their init in `DL.ready` removes each entry |
| **O4** | GA4 needs a `G-` measurement id created under a firm Google account |
| **O5** | Production is unchanged: the router injects on `*.pages.dev` only until `PERCH_ROUTER=on` is set. `PERCH_ROUTER=off` is a kill switch that needs no redeploy |
| **O6** | `js/perch-router.js`, the superseded body-swap reference implementation, is loaded by zero pages (CI asserts it stays that way). Retiring it is a follow-up |

---

## Out of scope and untouched, as ordered

The booking write path · `postMessage` / the booking control channel · tier-auth ·
the CSP (no directive changed, no `unsafe-inline`, no `strict-dynamic`) · secrets ·
`.github/workflows`. No inline script is adopted, re-created, re-nonced or eval'd.

---

*Agents do not merge. Zane gates, David merges.*
