# JORDAN-PERCH-A23 — Turnstile re-render on the swapped-in booking form

Order **JORDAN-PERCH-A23-TURNSTILE** · ticket **#53** · Phase A / Phase 2.
Review refs: frontend **M1**, QA **B1**. Branch `jordan/perch-a23-turnstile`.

---

## 1. The defect

`#dl-bk-turnstile` is not page markup. It is minted by the booking widget's
**FORM step** (`js/booking-widget.js:1189`), so after a content swap it is always
a DOM node the previous generation's Turnstile registry has never seen.

The widget's own mount (`js/booking-widget.js:1228-1237`) retries **only while
`window.turnstile` is ABSENT**:

```js
if (window.turnstile && typeof window.turnstile.render === 'function') {
  try { _tsWidgetId = window.turnstile.render(mount, { sitekey: TURNSTILE_SITEKEY }); }
  catch (e) { /* already rendered / transient — ignore */ }   // ← terminal
} else if (tries < 40) { setTimeout(…, 150); }
```

If `render()` **throws**, the catch swallows it, `_tsWidgetId` stays `null`, and
there is no retry — the `else if` is not reached. The write path then sends

```js
turnstile_token: (window.turnstile && _tsWidgetId != null) ? … : ''   // :1321
```

an **empty token**. `/booking/create` answers **403 TURNSTILE_REQUIRED**, the
caller sees the generic error, and nothing appears in the console. A booking
opened after one or more swaps silently fails.

### Reproduced, not reasoned about

`test/perch-swup-router.test.mjs` boots the **real** `js/booking-widget.js` and
stages the failure. The CONTROL asserts all three halves of it:

| after a swap whose `render()` throws | observed |
|---|---|
| mount point present | `true` |
| challenge rendered on it | **`false`** |
| still false 0.6 s later, with the API healthy again | **`false`** — nothing ever retries |

---

## 2. The fix — §5 row 12

A new row in the post-swap re-init recipe (`js/perch/reinit.js`). It runs on
every swap, after row 5 boots the widget.

```
 1 head sync                      ok
 …
 5 booking widget boot()          ok
 …
12 turnstile re-render            ← this ticket
```

### Why it calls in rather than rendering

The token is read as `getResponse(_tsWidgetId)` and **`_tsWidgetId` lives in the
widget's closure**. A widget rendered from the router would paint a perfectly
good challenge whose id nobody holds — the token would still go out empty and the
booking would **still** 403. So row 12 drives `DLBooking.remountTurnstile()`, a
seam published on the widget's existing control surface, which captures the id.

A CI test refuses a literal `turnstile.render(` in **either** router file, so
this cannot be "simplified" back into the defect.

### The four branches

| condition | action | row status |
|---|---|---|
| no booking host and no mount in the container | nothing — `window.turnstile` is never read | `absent` |
| widget booted, still at TYPE\_PICK (no mount yet) | nothing; the widget renders for itself when the form paints | `deferred` |
| mount present, **no live widget** (the defect) | `remove()` any orphan → `render()` → capture id | `ok` / `render` |
| mount present, **live widget** | `reset()` — a fresh token, **never a second render** | `ok` / `reset` |

---

## 3. Verification

### CI — `npm test`, root suite

**533 pass · 0 fail · 1 skipped** (the skip is pre-existing).

Eight new assertions, all against the real widget:

| assertion | result |
|---|---|
| CONTROL — the defect is real and never self-repairs | PASS |
| row 12 repairs the fresh node, and the captured id resolves through the same `getResponse` the write path uses | PASS |
| after 5 consecutive swaps the challenge is freshly rendered every time | PASS |
| DOUBLE-RENDER GUARD — 4 re-init passes over a live widget issue **0** renders, leaving exactly 1 challenge | PASS |
| NO-OP — a formless page leaves the container **byte-identical** and never reaches `window.turnstile` | PASS |
| TYPE\_PICK defers rather than reporting broken | PASS |
| row 12 is wired into `reinit()`, ordered after row 5 | PASS |
| neither router file calls `turnstile.render(` directly | PASS |

The §5 row-count guard was updated 11 → 12 deliberately, with the reason in the
test: growing the checklist is a decision made there; shrinking it is the drift
#48 was opened to stop, and an exact `deepEqual` refuses both silently.

### Live router — `test/preview/verify-a23.mjs`

Real Chromium, real Cloudflare Turnstile `api.js`, real Functions runtime, router
**ON**, 8 real anchor clicks.

```
node test/preview/verify-a23.mjs <baseUrl> --swaps=8 --fixture-booking
```

**12 PASS · 0 FAIL · 1 MANUAL · 8 swaps · 0 reloads**

| assertion | result |
|---|---|
| the router is injected and ready | PASS |
| 8 navigations were SWAPS, not reloads (`loadEvents: 0`) | PASS |
| every formless swap reports row 12 `absent` | PASS |
| every formless swap issues **0** Turnstile calls | PASS |
| every `/book` swap adopts `api.js` and finds the seam published | PASS |
| no swap left a broken recipe row | PASS |
| after N swaps the swapped-in mount carries a freshly rendered Turnstile widget | PASS |
| each `/book` arrival carries a **DISTINCT** widget id | PASS |
| DOUBLE-RENDER GUARD — 3 extra passes render nothing, 1 widget remains | PASS |
| the challenge is served and can mint a token | **MANUAL — blocked, see below** |
| no CSP violation | PASS |
| no uncaught page error (Turnstile refusals counted separately) | PASS |

The freshness evidence is the widget identity, not its presence — Cloudflare
mints a new `cf-chl-widget-…` id per render, so a repeat visit that reused the
previous DOM's widget would repeat its id:

```
n=2  cf-chl-widget-2be2g
n=4  cf-chl-widget-0jirc
n=6  cf-chl-widget-0if9n
n=8  cf-chl-widget-q5mm1
```

Full evidence: `test/preview/a23-evidence.json`.

---

## 4. What is NOT proved here — read this before gating

**a. No Preview URL was created.** The `donovan-site` Pages project is
**Direct Upload**, so pushing a branch builds nothing; a Preview needs
`wrangler pages deploy`, which needs a Cloudflare API token. This order forbids
reading or entering any secret, and a Direct-Upload project has no dashboard
`production_branch` control — a mis-targeted "preview" deploy can publish to
production. **Deploying is an ADAM action and David's call.** The run above was
therefore made against the same Functions runtime on `localhost`, where
`routerEnabled` returns `true` by the same rule that admits `*.pages.dev`.

**b. Turnstile answered `110200` (unknown domain) on `localhost`.** The sitekey
`0x4AAAAAAD3X3AEk_IbefC4I` does not allow-list that host, so Cloudflare served no
challenge iframe. This is a property of *where the run happened*, not of the swap
path — `render()` still took the node and the widget's closure still holds the
id, which is the defect this ticket is about. Re-running against a
`*.donovan-site.pages.dev` Preview closes it.

**c. A real end-to-end token solve is MANUAL in every environment.** Turnstile
refuses automation by design. To confirm by hand: open the deployment,
soft-navigate several times, reach `/book`, solve the challenge, submit — the
booking must be **created**, not 403 TURNSTILE_REQUIRED.

**d. `--fixture-booking`** serves `/booking/types` and `/booking/availability`
from fixtures, because a deployment without Clio credentials errors on both and
the form never paints. It substitutes the **Clio calendar read only**. Turnstile
is untouched by it: `api.js` is still fetched from `challenges.cloudflare.com` and
`turnstile.render()` is still Cloudflare's. The write path is never reached. Every
run records `fixtureBooking` in the evidence.

---

## 5. Blast radius

**Unchanged, by inspection and by the diff:**

- the booking **write path** — `turnstile_token` at `booking-widget.js:1321`,
  `/booking/create`, `functions/_lib/abuse.js`
- **tier-auth** and the **CSP** — no directive, no nonce, no host touched
- the **script-adoption allow-list** — `ADOPT_SCRIPTS` / `DENY_SCRIPTS`
  unmodified; `api.js` was already on it
- **`.github/workflows/`** — untouched

**Production is unchanged by construction.** `remountTurnstile` is dormant: its
only caller is `js/perch/reinit.js`, which is imported only by
`js/perch-swup-router.js`, which is injected only when `routerEnabled()` is true —
`*.pages.dev` and `localhost`. Asserted in the verifier as step 0:

```
routerEnabled({}, 'https://www.donovan.law/book')  →  false
routerEnabled({}, '<preview>/book')                →  true
```

On production the widget behaves exactly as it does today.

## 6. Files

| file | change |
|---|---|
| `donovan-legal-site/js/perch/reinit.js` | §5 row 12 — `renderTurnstile()`, wired into `reinit()` |
| `donovan-legal-site/js/booking-widget.js` | the `remountTurnstile` seam + its `DLBooking` passthrough. No change to the write path. |
| `test/perch-swup-router.test.mjs` | 8 new assertions; row-count guard 11 → 12 |
| `test/preview/verify-a23.mjs` | the live-router verifier (new) |
| `test/preview/a23-evidence.json` | the run above (new) |
| `docs/JORDAN-PERCH-A23-TURNSTILE.md` | this report (new) |

---

**STOP.** Not merged, not promoted. Zane gates, David merges.
