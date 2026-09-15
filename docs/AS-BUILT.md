# AS-BUILT — the deployed Donovan Legal system

**What this is.** The authoritative description of what is actually running in
production at https://www.donovan.law, derived by reading the code on `main` rather
than from any prior summary. One section per subsystem, each citing the files it is
built from. Every path below exists on `main` and was opened while writing this.

**What this is not.** Not a plan, not a roadmap, and not a description of anything
that was proposed and not shipped. Where a plausible-sounding claim could not be
confirmed in the code, it is stated as *not shipped* rather than left ambiguous — see
[Claims deliberately not made](#claims-deliberately-not-made).

**Platform.** Cloudflare Pages project `donovan-site`, Direct-Upload, assets and
Functions both served from `donovan-legal-site/`
([`donovan-legal-site/wrangler.jsonc`](../donovan-legal-site/wrangler.jsonc),
`compatibility_date` `2026-06-01`). Two bindings:

| Binding | Kind | Detail |
|---|---|---|
| `PERCH_ACTIONS` | KV namespace | `fff1865cad734214acdebf8b3b944289`. Key spaces: `booking:`, `booking-idemp:`, `callmap:`, `qualbk:`, `rl:`. |
| `PERCH_BRIDGE` | Durable Object | class `PerchBridge` in the **separately deployed** Worker `perch-do` ([`perch-do/src/index.js`](../perch-do/src/index.js)). |

**Environment configuration.** `wrangler.jsonc` declares **no `vars` block**, and because
the file is authoritative for the project the Cloudflare dashboard is restricted to
Secrets only — *"Environment variables for this project are being managed through
wrangler.toml. Only Secrets (encrypted variables) can be managed via the Dashboard."*

The practical consequence is that **all 22 environment values are stored as encrypted
Secrets, including the ones that are not secret**, because no other option is offered.
Recorded here because it is a live constraint, not a preference:

| | Values |
|---|---|
| **Genuinely secret** (13) | `CLIO_CLIENT_SECRET` · `CLIO_MEMBERS_CLIENT_SECRET` · `CLIO_REFRESH_TOKEN` · `CLIO_MEMBERS_REFRESH_TOKEN` · `CONSENT_TICKET_SECRET` · `GROW_LEAD_TOKEN` · `MEMBERS_HASH_SALT` · `MEMBERS_SESSION_SECRET` · `META_CAPI_TOKEN` · `PERCH_TOOL_SECRET` · `RETELL_API_KEY` · `TURNSTILE_SECRET_KEY` · `VANTAGE_WRITE_SECRET` |
| **Not secret, encrypted anyway** (9) | `TURNSTILE_SITE_KEY` and `META_DATASET_ID` are **public by definition** — both ship in the page. `ANALYTICS`, `PERCH_ROUTER`, `CLIO_CREATE_CONTACT` are flags. `CLIO_CALENDAR_ID`, `WEB_CALL_ALLOWED_ORIGINS` are identifiers. `CLIO_CLIENT_ID`, `CLIO_MEMBERS_CLIENT_ID` are defensible either way. |

Secrets are **write-only**: the dashboard cannot read a value back. So no one can
currently answer *"is `PERCH_ROUTER` on?"* or *"which Clio calendar are we writing to?"*
without deleting and re-typing the value. That is why the three flags are the
operationally painful ones — every toggle is an act of faith.

Moving the nine to a `vars` block in `wrangler.jsonc` would make them readable,
diffable and reviewable, and is the natural home for per-tenant configuration. It is
**not** done, and deliberately so: there is no atomic swap, and a value without a code
fallback (`TURNSTILE_SITE_KEY`) going missing between the delete and the deploy breaks
the booking form. The migration wants a window, not a spare five minutes.

**Flags currently set in production** (verified 2026-08-11): `ANALYTICS`,
`PERCH_ROUTER`. **Not set:** `META_CAPI`, `META_TEST_EVENT_CODE`.

---

## 1. The edge middleware — CSP, caching, and injection

**Files:** [`donovan-legal-site/functions/_middleware.js`](../donovan-legal-site/functions/_middleware.js) ·
[`donovan-legal-site/_headers`](../donovan-legal-site/_headers)

The root middleware runs on every request and does four things.

**Per-request CSP nonce.** `buildCsp(nonce, { lockFrameAncestors })` (`_middleware.js:126`)
is the **only** place a Content-Security-Policy is set; it was deliberately removed
from `_headers`, which is static and cannot carry a per-request value. 16 bytes of
CSPRNG become 32 hex chars, and `NonceStamper` (`:211`) stamps that nonce onto every
inline `<script>` — and only inline ones, since a `<script src>` is authorised by the
host allow-list instead. `'unsafe-inline'` is absent from `script-src`.
`'strict-dynamic'` is deliberately **not** used, because the site loads classic
scripts from listed CDNs that `strict-dynamic` would ignore. `style-src` still carries
`'unsafe-inline'` — a known, commented debt covering 1706 `style="…"` attributes, not
an oversight (`:32-37`).

**Frame headers.** `frame-ancestors` has two states, both hanging off one flag read
once (`framesLocked`, `:266`): with the router off it stays permissive for the Perch
shell's cross-origin embed and **no** `X-Frame-Options` is emitted; with the router on
it narrows to `'self'` and `X-Frame-Options: SAMEORIGIN` is added (`:274`).
`_headers` must never set `X-Frame-Options`, and says so.

**Stale-nonce defence.** A cached HTML body carrying nonce-A under a freshly issued
nonce-B policy blocks every inline script on the page. Both halves are closed:
responses get `Cache-Control: no-store` with `ETag`/`Last-Modified` deleted (`:289-293`),
and *document* requests have `If-None-Match`/`If-Modified-Since` stripped on the way in
(`:234-238`) so the asset handler must answer a full 200. Scoped to HTML by response
content-type and request `sec-fetch-dest` (`isDocumentRequest`, `:204`), so `/css`
`/js` `/img` keep the caching `_headers` configures for them.

**Injection.** The HTML body is buffered once, `planFromHtml` computes the plan, and a
second HTMLRewriter pass applies the nonce plus four injections in one parse
(`:303-323`).

Static headers that remain in `_headers`: `X-Content-Type-Options: nosniff`,
`Referrer-Policy: strict-origin-when-cross-origin`, HSTS with `includeSubDomains; preload`,
a `Permissions-Policy` granting `microphone` to self plus `vantage.ticoai.net` and
`portal.theconnexus.ai`, and per-directory cache rules (`/css` `/js` `no-cache`;
`/img` `/webfonts` immutable for a year).

---

## 2. The Perch concierge — swap container, layer, router, utility bar

### 2.1 The swap container

**File:** [`donovan-legal-site/functions/_lib/perch-main.js`](../donovan-legal-site/functions/_lib/perch-main.js)

The site is ~143 hand-authored documents sharing no common region — a survey found
**30 distinct body shapes**: 92 pages bury the site nav four levels deep, 3 use a
body-level `<header>`, 47 have no site nav at all, 15 already ship a `<main>`. So one
canonical region, `<main id="perch-main">` (`CONTAINER_ID`, `:54`), is injected as the
HTML streams out and no page file is edited.

Because lol-html is a streaming rewriter with no lookahead, and the correct nesting
depth for the opening tag is not knowable when that tag must be written, the work is
split into two passes over a buffered copy:

* **Pass 1** — `newScan()` / `scanHandlers()` (`:93`, `:119`) accumulate the `</div>`
  ordinal count, the live div stack, a snapshot of that stack at the site nav, the body
  children, existing `<main>` elements, persistent-layer positions, and whether the
  Perch orb is present.
* **`decidePlan(scan)`** (`:194`) resolves five ordered cases: `skip` for the shell (the
  orb is present), `stamp` for a page with exactly one un-`id`'d `<main>`, `wrap-div`
  when the nav's div has a parent that holds content, `wrap-body` otherwise, and `skip`
  again when there is nothing to wrap.
* **Pass 2** — `injectHandlers(plan)` (`:250`) applies it.

**The plan is expressed in ordinals, not selectors** — "open after the 31st `</div>`,
close before the 50th" — because both passes parse the same bytes with the same parser.
A checked-in path→shape map was considered and rejected: it goes stale silently.

Things that must stay outside the container: `nav.menubar` (`SITE_NAV_SELECTOR`, `:83`,
deliberately *not* `nav`, because the tool pages carry their own swappable in-content
sidebars), `.dl-callbar`, `#dvn-perch-root`, and trailing `script`/`noscript`/`template`
(`:68-70`). `div#concierge` marks the shell and makes the page skip entirely.

### 2.2 The persistent layer and the router tag

**Files:** [`_lib/perch-layer-inject.js`](../donovan-legal-site/functions/_lib/perch-layer-inject.js) ·
[`_lib/perch-router-inject.js`](../donovan-legal-site/functions/_lib/perch-router-inject.js)

Both derive from the same `plan`, so a page gets a container, a layer and a router
together or none of them (`wantsLayer` / `wantsRouter` are both `plan.kind !== 'skip'`).
The layer injects `<link rel="stylesheet" href="/css/perch-layer.css">` plus
`<script type="module" src="/js/perch-layer.js">`; the router injects
`<script type="module" src="/js/perch-swup-router.js">`.

**They are emitted from one `<head>` callback, and that is load-bearing.** lol-html keeps
only the **last** `onEndTag` callback registered per element, so a second independent
`['head', …]` handler would silently delete the first one's tags. The router tag and the
utility bar's stylesheet are therefore composed into `layerHandlers(plan, extraTags)`
(`_middleware.js:314-317`) rather than registered separately.

**The router gate** — `routerEnabled(env, url)` (`perch-router-inject.js:74`):

| `PERCH_ROUTER` | Behaviour |
|---|---|
| `on` | soft navigation everywhere, including production |
| `off` | kill switch — full navigation everywhere, no redeploy |
| unset (default) | `*.pages.dev`, `localhost` and `127.0.0.1` only |

Keyed on the request hostname, not on `CF_PAGES_BRANCH` — the branch variables are
documented for the Pages *build* environment, and a gate reading `undefined` in the
Functions runtime would default production to whatever the comparison happened to
yield. An unparseable URL returns `false`, i.e. behaves like production.

### 2.3 The header utility bar

**File:** [`_lib/utility-bar-inject.js`](../donovan-legal-site/functions/_lib/utility-bar-inject.js)

Two halves in two places, for the `<head>` contention reason above: `barStylesheetTag(plan)`
rides in the layer's head callback, while `barHandlers(plan)` is its own handler that
*prepends* to `<body>` — so the markup lands above the site nav and **outside**
`main#perch-main` even on pages whose container opens at body child 0
(`_middleware.js:318-323`). The bar carries a "Book a Consultation" CTA to
`BOOKING_HREF` `/book` tagged `data-perch-book="utility_bar"`, plus the firm's contact
and social links. Injected content is not re-fed through the handlers, so the ordinals
the plan is written in are unaffected.

### 2.4 The Swup router and its swap policy

**Files:** [`js/perch-swup-router.js`](../donovan-legal-site/js/perch-swup-router.js) ·
[`js/perch/swap-policy.js`](../donovan-legal-site/js/perch/swap-policy.js) ·
[`js/perch/reinit.js`](../donovan-legal-site/js/perch/reinit.js)

The router swaps `#perch-main` and nothing else (`containers: [CONTAINER_SELECTOR]`,
`perch-swup-router.js:228`).

**`swap-policy.js` is the security contract, and it lives in its own module** with no
imports beyond `./placement.js` and no top-level side effects, so CI exercises *these*
functions rather than a re-implementation. The census the module records in its own
header — 143 documents → 2 with no container → 41 excluded → **96 interceptable pages**
referencing 22 distinct scripts — is a **snapshot taken when it was written**, and the
tree has grown since: walking `donovan-legal-site/` today gives **160** HTML documents, of
which **48** match `EXCLUDED_ROUTES` and **112** do not. The counts quoted throughout this
subsection are the module's own and should be read against that. The suite does not pin
an exact figure (`test/perch-swup-router.test.mjs:135` asserts only `> 80`), so the drift
is in the prose, not in the gate.

* **`EXCLUDED_ROUTES`** (`:54`) — two families, each carrying its reason.
  `tier-basic-auth` (`/gold|/platinum|/diamond|/reserve`) is a security boundary: a
  401 + `WWW-Authenticate` only produces the browser credential prompt on a real
  document navigation, and Swup uses `fetch()`. `no-container-shell`, `-fragment` and
  `-index` cover the three URL spellings that reach a document with no container —
  including both `/index` and `/index.html`, because Pages serves `index.html` at both
  and only one of them 301s. Six further entries exclude pages whose calculators bind
  at load time and cannot be re-established by a swap.
* **`ADOPT_SCRIPTS`** (`:178`) — a deny-by-default allow-list of 12 external files,
  keyed origin-relative for same-origin scripts so the same list works on Preview,
  localhost and production. Head **and** end-of-body: `/js/booking-widget.js` is an
  end-of-body tag that `perch-main` leaves outside the container, and adopting it is
  what makes the booking widget boot after a swap into `/book`.
  `challenges.cloudflare.com/turnstile/v0/api.js` is adopted because denying it would
  leave `turnstile_token` empty and `/booking/create` would reject every booking — and
  since PR #217 `/contact` carries the same tag, in its **head** rather than at the end
  of the body, so `where` on that entry records the `/book` placement rather than a rule.
  The list still holds **12** entries after two PRs changed its membership:
  `/js/page/contact-form.js` was added by #217 (without it a soft navigation into
  `/contact` arrives with no submit handler, the button falls through to a native POST,
  and `form-action` kills the inquiry exactly the way Formspree did), and
  `/js/page/login-coming-soon.js` was **removed** by #218 with the page that was its only
  referrer — otherwise it would have become one of the dead rows the "these list entries
  are referenced by no interceptable page" test exists to catch.
* **`DENY_SCRIPTS`** (`:216`) — **12** named refusals with reasons (the previous revision
  of this document said 13; the Map has 12 keys): the Vantage beacon
  (re-notify, never re-load), `donovan-widget.js` (would mint a second launcher and a
  second call), `main.js` (all its targets are outside the container on all 96 pages —
  0 inside), the shared vendor bundles, and the two tags the *edge* injects.
* **`planAdoption`** (`:311`) only ever selects `script[src]`. An inline block does not
  match that selector at all, which is how "never adopt an inline block" is enforced —
  by never selecting one rather than by filtering one out. Every adopted tag is a fresh
  element carrying `src` and nothing else; no nonce is read, copied or forged.
* **`sharedChrome`** (`:365`) — 83 of the 96 interceptable pages carry the shared nav +
  jQuery chrome; 13 do not. Evaluated against the *live* document, so it forces a full
  navigation only when loading a chrome-less page directly.

### 2.5 `reinit.js` and `syncHead` — the post-swap recipe

**File:** [`js/perch/reinit.js`](../donovan-legal-site/js/perch/reinit.js)

The executed form of the `RE-INIT-INVENTORY.md` §5 checklist, one exported function per
row, every row independently `try`/`catch`ed so a dead row cannot take the page down.
`reinit(doc, win, incomingDoc)` (`:730`) runs them and returns the checklist as executed.

**`syncHead(doc, incomingDoc)`** (`:376`) is the load-bearing one. The swap is scoped to
`main#perch-main`, so the head is not swapped at all — and until PR #203 only
`document.title` and `link[rel=canonical]` were reconciled out of it. Everything else was
discarded, so after a soft navigation the visitor saw page B's body under page A's head.
Measured over 99 interceptable pages: 96 author a head `<style>` block and **9 have no
stylesheet link at all** (they were painting with the previous page's CSS); 90 author
`link[rel=stylesheet]`; 98 author `meta[name=description]`; 95 author `og:`; 10 author
`meta[name=robots]`, 9 of them `noindex`.

`reconcileHead` (`:250`) now manages five classes — `<style>`, `link[rel=stylesheet]`,
`meta[name=description]`, `meta[property^=og:]`, `meta[name=robots]` — as **one ordered
group** in the incoming document's own order, so the result is byte-for-byte the cascade
of a direct load of B. Four properties, each asserted in CI:

* **Idempotent** — reuse is by signature (`headSig`, `:178`) and placement only moves a
  node that is out of position. This matters because the router already calls
  `syncHead()` twice per swap (`perch-swup-router.js:248` and again inside `reinit()` at `:252`).
* **Order-faithful** — the group is placed against a marker inserted *after* the last
  surviving member and walked backwards, so a settled head is not rebuilt.
* **Shell-safe** — `SHELL_STYLESHEETS` (`:141`) is `['/css/perch-layer.css', '/css/dl-utility-bar.css']`,
  the only two head rows the edge contributes. A live shell sheet is never removed even
  if the incoming document somehow does not declare it. The array is spelled as literals
  rather than imported (importing `functions/_lib/*` from a browser module would be a
  broken import in production) and CI pins it equal to the real edge constants.
* **Granular** — every DOM operation is attributed to its class, so one dead element
  cannot cost the other four.

**Nothing here touches a `<script>`**, by construction: `headClass()` (`:155`) returns
`null` for every tag that is not one of the five, so a script is not read, not cloned
and not moved.

The other rows: `checkNav` (`:440`) is a **guard, not a re-bind** — 0 of the nav's
targets are inside the container across 96 pages, so re-running `main.js` would be a
double-bind, and this reports `broken` only if a future page shape moves the nav inside.
`bootBookingWidget` (`:473`) calls the widget's published `DLBooking.boot()`, idempotent
by construction. `renderTurnstile` (`:523`) is §5.12 — see [§4](#4-turnstile).
`reattachInputFormatter` (`:599`) re-calls `DonovanInputFormatter.attachAll(root)`,
guarded per element. `checkBeacon` (`:630`) verifies rather than acts. `gaPageView`
(`:675`) is a **documented stub** — there is no GA4 tag on this site.

---

## 3. The booking and contact write paths

**Entry point:** [`donovan-legal-site/functions/booking/create.js`](../donovan-legal-site/functions/booking/create.js)
(`POST /booking/create`) · companions `availability.js`, `types.js`

Every check below the parse step runs **before** the write to the firm's real Clio
calendar, and every one of them fails closed.

### 3.1 Order of operations

| # | Step | Failure |
|---|---|---|
| 1 | Per-isolate rate limit, 10/min/IP on `CF-Connecting-IP` (`:90`) | 429 `RATE_LIMITED` |
| 2 | Input validation — type, slot, name, email, phone; slot must parse, be in the future and within a year (`:134-168`) | 400 `VALIDATION_ERROR` |
| 3 | `resolveConfig(env)` — **fails closed**, throws `MISSING_CALENDAR_CONFIG` rather than falling back to a sandbox default calendar (`:178`) | 503 |
| 4 | Appointment type must be on the adapter's own `listAppointmentTypes` allow-list — the same list `GET /booking/types` serves (`:204-218`) | 400 / 502 |
| 5 | Turnstile verify (`:227`) | 503 / 403 |
| 6 | Idempotency key — in-memory cache then KV `booking-idemp:<key>` (`:240-263`) | replays the cached 201 |
| 7 | Qualifier binding (`:333-354`) | never fails the booking |
| 8 | Availability **re-check** for the exact slot (`:458-482`) | 409 `SLOT_TAKEN` / 502 |
| 9 | `adapter.createBooking()` (`:504`) | 502 `PROVIDER_ERROR` |
| 10 | Spend the qualifier record (`:541`), push to Grow and Vantage (best-effort), mirror to KV, write the callmap index | 207 `PARTIAL_FAILURE` if only the KV mirror failed |

**The availability re-check is honest about what it does not close.** It narrows the
race; it does not lock, because Clio exposes no conditional-create. The comment at
`:430-452` states the real width: `createBooking` makes **four sequential Clio round
trips** on the new-contact path (contact search, custom-field id resolution, contact
create, enrichment PATCH) and three on the returning path, each of which can retry once
after sleeping up to 10s — so the window is seconds, not milliseconds, and is widest
exactly when Clio is rate-limiting the firm and two callers are most likely to race.

**The qualifier record is spent after the provider confirms, not at resolve time**
(`:520-541`). It used to be cleared inside `resolveQualifierBinding`, ahead of the
availability re-check — so a 409 `SLOT_TAKEN`, the most common non-success on this
endpoint, destroyed the qualifier before the caller had booked anything, and their
retry carried no intake at all. `cookieHeader(spend)` (`:826`) attaches the clearing
`Set-Cookie` only on the two terminal success paths; every refusal returns through
`jsonError` and deliberately does not.

### 3.2 The qualifier gate and the join key

**Files:** [`booking/_lib/qualifier-bind.js`](../donovan-legal-site/functions/booking/_lib/qualifier-bind.js) ·
[`_lib/qualifier-cookie.js`](../donovan-legal-site/functions/_lib/qualifier-cookie.js) ·
[`booking/_lib/intake-policy.js`](../donovan-legal-site/functions/booking/_lib/intake-policy.js)

A submitted `call_id` is worth nothing until the server matches it to a record the
server itself wrote. `resolveQualifierBinding(env, callId)` accepts **either** witness:
the `PERCH_BRIDGE` DO slot `qual:<callId>` probed through the **non-destructive** `/has`
endpoint (`/get` is read-once and would consume Paula's slot), or the durable KV copy
`qualbk:<callId>` with a 6h TTL. Either confirms, deliberately: Paula's
`get_qualifier_result` consumes the DO slot mid-call, so requiring both would
de-verify nearly every genuine booking.

`CALL_ID_RE` (`:85`) constrains the id to a conservative charset before it is echoed
into any subrequest, and `default` is refused as a reserved shared-bucket sentinel.
The four outcomes recorded on the booking are `QUALIFIER_JOIN` (`:69`): `none`,
`unverified`, `verified_no_summary`, `attached`.

**Two carriers, in a fixed order** (`create.js:333-354`). The **body** `call_id` is the
live-call path and wins when it verifies. The **`dl_qual` cookie** is the path for a
booking completed *after* the call ended — the widget reads the body value only from
`window.__perchCallId`, a JS global that dies with the document, while the unlock flag
it travels with is persisted in `localStorage`, so a caller can reach a fully unlocked
`/book` page carrying no idea which call unlocked it. Both go through the *same*
resolver against server-written records, so a fabricated value in either resolves
`unverified` and attaches nothing.

**And one composition the cookie must not serve.** A visitor who opened the qualifier
card, **abandoned** it and then booked arrives looking identical to the post-call case:
empty `call_id`, live cookie. On a shared browser inside the 6h window that cookie is
the *previous* visitor's key — their income band, net worth band, matter, language and
state onto this client's Clio contact, with the join recorded as `attached` so nothing
signalled it. Only the browser can tell the two apart, so it says so:
`qualifier_claim` / `claimsNothing(qualClaim)` (`create.js:333`) **withholds and nothing
else**. There is no value of it that attaches anything to anyone, so forging it costs
the forger their own enrichment; its absence means exactly what it always meant.

**The write policy** (`intake-policy.js`) derives `SELF_REPORTED_KEYS` from
`INTAKE_CUSTOM_FIELDS` alone (`:74`) and reports what it dropped by **field name only**
— `omitted` (routine), `placeholders` and `rejected` (not). `create.js:414` additionally
distinguishes *total* loss: `omitted.length === SELF_REPORTED_KEYS.length` means the
record was found, read, and carried no usable answer, so zero custom fields will be
written — a state that previously logged nothing.

**No call_id is ever logged**, on any path. It is a bearer capability; the logs carry
presence, carrier and outcome only (`create.js:367-379`).

### 3.3 The Clio adapter

**Files:** [`booking/_lib/provider-clio.js`](../donovan-legal-site/functions/booking/_lib/provider-clio.js) (3141 lines) ·
[`booking/_lib/clio-custom-fields.js`](../donovan-legal-site/functions/booking/_lib/clio-custom-fields.js) ·
[`booking/_lib/clio-paging.js`](../donovan-legal-site/functions/booking/_lib/clio-paging.js)

Clio Manage API v4, OAuth refresh-token flow against `https://app.clio.com/oauth/token`,
token cached per isolate and refreshed 10 minutes before a typical 60-minute expiry
(`:303-320`). All traffic goes through one `clioFetch` (`:505`), which retries a 429 or
5xx once after sleeping `min(Retry-After, 10s)` and is the single door that carries the
firm's bearer token.

#### Contact resolution and the email-or-phone dedup

`findOrCreateContact` (`:2127`) resolves the Person in a fixed order:

1. **`searchContactByEmail`** (`:1054`). It answers in **three states, not two** — and
   that is the whole fix. It used to return `null` both for "Clio says no such contact"
   and for "Clio did not answer", so a 429 or 5xx on the search *minted a duplicate
   Person* for a client Clio already held — a duplicate that looks like success from
   every angle, because it still carries the attendee and still sends the confirmation
   email while the intake note and the custom-field values file onto an empty second
   record. `!search.conclusive` now **fails closed**: no contact linked, no duplicate
   created (`:2145-2157`).
2. **`searchContactByPhone`** (`:1153`), on the create branch only. The email is not the
   person: a client who booked once from a personal address and once from work was being
   told "new" — three duplicate records were the observed cost (`:2174-2185`).
3. **Ambiguity is refused, not guessed.** More than one phone match — a household line,
   an office switchboard, a shared mobile — discards the phone as a key and creates,
   because filing one client's intake onto another client's record at a law firm is
   worse than the duplicate (`:2200-2210`). Exactly one match reuses that contact and
   logs that it matched on phone rather than email.

Both legs run a three-rung **field-selection ladder** (`CONTACT_SEARCH_ATTEMPTS`, `:965`;
`CONTACT_PHONE_SEARCH_ATTEMPTS`, `:994`): the enriched selection first, then a minimal
floor twice. Each floor is sub-selected on **exactly the property its own matcher reads**
— the phone leg has its own floor (`:986`) because running it down onto the email floor
would compare `undefined` on every row and report a confident not-found, which is the
same defect wearing a different field name.

#### Custom fields

Clio addresses a `CustomFieldValue` **by id**, never by name, and ids are per-firm and
unknowable at build time. `clio-custom-fields.js` is the one place stable names become
ids. **It reads; it does not create** — there is no code path to `POST /custom_fields`,
deliberately and permanently, because a `field_type` cannot be changed after creation
and the API cannot distinguish "created the field" from "created a second field with the
same name". David creates them by hand in Clio settings; this module finds them.

Three lists, one union (`:233`):

| List | Fields | Written by |
|---|---|---|
| `INTAKE_CUSTOM_FIELDS` (7) | Intake Matter Category · Matter Sub-Type · For Whom · Income Band · Net Worth Band · Language · Source | the booking path, from the client's own answers |
| `BOOKING_CUSTOM_FIELDS` (1) | Intake Consult Type | the booking path, from the request's own `typeId` |
| `POSTCALL_CUSTOM_FIELDS` (4) | Intake Urgency · Interest · Call Sentiment · Call Summary | **only** the post-call webhook |

**The split is load-bearing, not tidy.** `intake-policy.js` does
`SELF_REPORTED_KEYS = INTAKE_CUSTOM_FIELDS.map(f => f.key)`, so appending to that first
list would make a key *admissible off a stored qualifier record* — which is precisely
the machine characterisation the policy exists to refuse, arriving one `.map()` away in
a different file. A consult type is not something a client self-reports; it can only
arrive from the booking's own `typeId`.

Resolution has two sources: `CLIO_INTAKE_FIELD_IDS` (a JSON object of ids handed over by
the firm; authoritative, and also the operator's override on the type check) and the name
lookup. Every row is admitted on its `field_type` before it is bound, a truncated
pagination walk is treated as a **failed** walk (`:473`), and the page loop only follows
cursors that stay on Clio (`nextPageUrl`, `:463`) — because `api.get` passes anything
starting with `http` through to `clioFetch`, which attaches the firm's live bearer token.
Cached per isolate. **Nothing here may fail a booking**: every failure resolves to "fewer
ids", the contact PATCH carries fewer values, and the same answers stay legible on the
intake Note.

**The merge policy** (`FIELD_SCOPE`, `:98`) answers one question — when a returning client
supplies *fewer* answers than last time, which unrepeated fields may keep standing?
`MATTER`-scoped fields are a set that is only true together and are cleared as a set when
a new matter context arrives; `PERSON`-scoped fields (bands, language, source) are
standing facts about the client and are kept. An unclassified field lands in neither set
and is treated as person-scoped, which is the safe side: forgetting to classify can only
fail to clear, never clear something it should not.

#### The calendar entry and the Zoom meeting

`createBooking` (`:2858`) posts one `POST /calendar_entries`. The body carries `summary`,
`start_at`/`end_at`, `calendar_owner: { id }` (verified: **not** `calendar_id`), a
description, and — when a contact was resolved — `attendees: [{ id, type }]` plus
`send_email_notification: true`. That attendee pair is what makes Clio email the client
their confirmation and calendar invite; `contact_id` used to sit on the body, is not a
field there, was silently discarded, and no confirmation was ever sent.

**Exactly one meeting source ships per body, never both** (`:2928-2938`):

* **dynamic (the default, `BOOKING_MEETING_LINK` empty)** — `conference_meeting: { type: "zoom" }`.
  `"zoom"` is the only value the enum accepts (`:66-79`). Clio mints a **unique Zoom
  meeting per booking** and fills `location` itself. Pre-filling a static `location`
  would overwrite the field Clio needs.
* **static (`BOOKING_MEETING_LINK` set)** — `location` only. An explicit choice of one
  permanent room, and the escape hatch for an ineligible Clio pricing tier or an account
  with no Zoom connected, both of which return `conference_meeting: null`.

**The read-back is deliberately narrow and deliberately best-effort.** Only the entry id
is read. Everything above the POST fails closed; this runs *after* one, so Clio has
already answered 2xx, the appointment exists and the invite is already going out. An
unreadable body used to throw, `create.js` answered 502, and the client was told their
booking failed — for an appointment that had been made, so they rebooked, producing the
double booking the endpoint exists to prevent. The worst outcome now is
`provider_ref: "unknown"`, which is a record-keeping loss.

**The client/attorney split.** `buildClientDescription` (`:2642`) composes the calendar
description from firm-configured constants only — it has **no parameter** through which
the caller's notes, the qualifier bands or the post-call analysis could arrive, and that
description is emailed verbatim to the client. The typed notes and the qualifier summary
go to `writeIntakeNote` (`:2688`) on the attorney-side Clio contact instead. In dynamic
mode nothing below the POST may log the response body: a Zoom join URL is a bearer
capability.

`createBooking` returns `contact_id` (`:3045`) — the id that used to be resolved, used
for the attendee and the note, then dropped on the floor, leaving post-call enrichment
with nothing to arrive at. `""` (not null, not absent) when the contact path is off or
the lookup failed.

### 3.4 The contact inquiry write path — `POST /fn/contact`

**Files:** [`functions/fn/contact.js`](../donovan-legal-site/functions/fn/contact.js) ·
[`js/page/contact-form.js`](../donovan-legal-site/js/page/contact-form.js) ·
[`contact.html`](../donovan-legal-site/contact.html) ·
`booking/_lib/config.js` · `booking/_lib/provider-clio.js` · `booking/_lib/grow-lead.js`

Shipped in **PR #217** (`SHELDON-CONTACT-ROUTE-R1`, issue #214). The "Send an Initial
Inquiry" form on `/contact` used to be a plain
`action="https://formspree.io/f/xnjwgzkj"` POST. It delivered nothing, and it could not
have: the edge CSP carries `form-action 'self' https://vantage.ticoai.net`, so the
browser refused the submission outright, and a blocked `form-action` is a console line,
not an error the page can catch.

`js/page/contact-form.js` now `preventDefault()`s the submit and posts the seven fields
as JSON to the site's own `/fn/contact`, reporting the outcome on the page in
`#dl-contact-status` (`role="status"`, `aria-live="polite"`). It registers through
`DL.ready`, so it re-binds after a soft navigation into `/contact`, and it renders
Turnstile **explicitly** into `#dl-contact-turnstile` — the implicit `cf-turnstile` class
renders once at api.js load, and after a swap the mount would be empty.

#### Order of operations — every check runs before either write

| # | Step | Refusal |
|---|---|---|
| 1 | `checkOrigin(request, env, { allowSameOrigin: true })` | 403 `ORIGIN_REFUSED` |
| 2 | `checkRateLimit` — **its own KV bucket**, `bucket: "contact"`, 5 per 600s | 429 `RATE_LIMITED` + `Retry-After` |
| 3 | Field validation — `name`, a parseable `email`, `matter_type`, `description` | 400 `VALIDATION_ERROR` |
| 4 | **Turnstile**, the shared `verifyTurnstile` | 403 / 503 (see below) |
| 5 | **Clio Grow lead — the DELIVERY leg, required** | 502 `LEAD_NOT_DELIVERED` · 503 `LEAD_NOT_CONFIGURED` |
| 6 | **Clio Manage contact + note — the RECORD leg, non-fatal** | reported in the 200 body |

**Turnstile runs before any write** (`contact.js:183`), and it is the same
`verifyTurnstile` and the same single secret name `TURNSTILE_SECRET_KEY` that
`/booking/create` uses — see [§4](#4-turnstile). It **fails closed on an unset secret**:
503 `TURNSTILE_NOT_CONFIGURED`, never a degradation to anonymous. A missing token is 403
`TURNSTILE_REQUIRED`, a failed siteverify 403 `TURNSTILE_FAILED`, and a verify that could
not complete 503 `TURNSTILE_UNAVAILABLE`.

**The two legs fail differently, and the asymmetry is the design.**

* **Grow first, and fatal.** `createGrowLead` (`:204`) — the *same* sender
  `fn/take_message` and `booking/create` already push to, source label
  `"Donovan Website — Contact Form"`. A non-2xx is a **502**; an unset
  `GROW_LEAD_TOKEN` returns `{skipped:"no_token"}` and is answered **503** with a
  `console.error`, not dropped. That `{skipped}` branch carries no `status`, so a caller
  guarded on `status !== undefined` would report success — the DRINSANE-LEAD-FAILCLOSED
  (#151) shape, refused here. Grow runs first so a failed attempt leaves **no Manage
  residue** for the writer's retry to duplicate.
* **Manage second, surfaced but not fatal.** `recordInManage` (`:255`) never throws.
  Once Grow has accepted the lead the firm *has* the inquiry, and answering 502 would
  tell the writer to send it again and deliver it twice. A failed Manage leg answers
  **200 `{ ok: true, clio_contact: "unavailable" }`** plus a `console.warn`; success is
  `clio_contact: "recorded"`.

**`resolveContactConfig` is separate from `resolveConfig`, and the separation is
load-bearing** (`config.js:156`). `resolveConfig` fails closed on a missing
`CLIO_CALENDAR_ID`, which is right for a booking. A contact inquiry reads **no calendar**
— it creates a contact and files a note — so reusing that resolver would have 503'd every
inquiry whenever the only broken thing was a calendar nobody was booking into.
`resolveContactConfig` needs the OAuth secrets and nothing else. `BOOKING_PROVIDER=mock`
is still honoured, and the route treats `"mock"` as *record nothing in Manage* with a
warn, so a demo deployment cannot write into the firm's real Clio.

**The Manage leg reuses the #154 dedup rather than minting a third create.**
`createContactInquiry` (`provider-clio.js:3084`) calls `findOrCreateContact` with
`intake=null, typeId=null`, so it inherits the email-then-phone dedup and both of its
fail-closed refusals ([§3.3](#contact-resolution-and-the-email-or-phone-dedup)), and
`NO_CLEARS` means nothing an existing client answered on a previous booking is cleared by
writing in through the form. The note goes through `postContactNote` (`:2725`), extracted
unchanged out of `writeIntakeNote` so the booking path and the inquiry path cannot drift
into two ideas of how a note is posted; `label` is what tells a lost booking intake from
a lost website inquiry in the warn. **The note is the record here**, so its failure is
the leg's failure — unlike the booking path, where a lost note still leaves an
appointment on the calendar.

**No third-party email service exists on this path, or anywhere in the shipped tree.**
There is no Formspree, no SendGrid, Mailgun, Postmark, Resend, SES or SMTP sender under
`donovan-legal-site/` — `formspree.io` is named only in prose (the comments explaining
its removal) and in the pre-rebuild capture under `project-handoff/`, and
`test/contact-route.test.mjs:720` pins that the shipped tree references it nowhere. The
firm is notified because **a lead landing in Grow's "For review" queue raises Grow's own
new-lead notification to `info@donovan.law`**; the site sends no mail itself.

**Nothing on this route logs a secret or the inquiry.** The writer's name, email, phone
and their description of their matter never reach a log line on any branch. The one
caller-derived value that is logged is the missing-**field-name** list on a validation
failure, which is a subset of our own keys.

---

## 4. Turnstile

**File:** [`donovan-legal-site/functions/_lib/abuse.js`](../donovan-legal-site/functions/_lib/abuse.js)

`verifyTurnstile(token, request, env, tag)` (`:184`) is the **only** Turnstile
implementation in the tree and `TURNSTILE_SECRET_KEY` is the **only** secret name.
`/booking/create` previously carried a second copy that read a differently-named secret
(`TURNSTILE_SECRET`) behind an `if (secret)` guard, so the endpoint that writes to the
firm's real calendar was unprotected whenever the secret was absent or misspelled.
New callers pass a `tag` rather than copying the function.

**Two callers, both public writes.** `/booking/create`, and — since PR #217 —
`/fn/contact` (`contact.js:183`, tag `fn/contact`), which verifies **before** either of
its two Clio writes ([§3.4](#34-the-contact-inquiry-write-path--post-fncontact)). Both
mount the same public site key `0x4AAAAAAD3X3AEk_IbefC4I` and both render **explicitly**
into their own node, so a soft navigation cannot strand the challenge.

**Fails closed on an unset secret** — 503 `turnstile_not_configured`, never a silent
degradation to anonymous. Missing token → 403; siteverify failure → 403; a verify that
could not complete (5s `AbortController` timeout, or any throw) → 503. Cloudflare's
error codes are logged, never relayed.

`abuse.js` also carries the other two `/web-call` layers: `checkOrigin` (`:79`), which
refuses a request carrying neither `Origin` nor `Referer` because every real browser
sends one, and offers `allowSameOrigin` for the members endpoints so a preview build
remains reviewable; and `checkRateLimit` (`:128`), a KV-backed per-IP fixed window with
per-route buckets that **fails open** on a KV error, honestly documented as a
cost-control layer rather than a hard concurrency bound.

**On the swapped-in booking form** (`reinit.js:523`, `renderTurnstile`): `#dl-bk-turnstile`
is minted by the widget's form step, so after a swap it is always a node the previous
Turnstile registry has never seen. The widget's own `mountTurnstile` retries only while
`window.turnstile` is *absent* — if `render()` throws, the catch swallows it,
`_tsWidgetId` stays null and nothing tries again; the form still submits,
`turnstile_token` goes out empty, `/booking/create` answers 403 `TURNSTILE_REQUIRED` and
the caller sees a generic error, invisible to a clean console. The repair **calls into**
`DLBooking.remountTurnstile()` rather than rendering, because the write path reads
`getResponse(_tsWidgetId)` and that id lives in the widget's closure — a widget rendered
from outside would paint a real challenge whose id nobody holds.

---

## 5. The callmap join key and the post-call enrichment webhook

### 5.1 The key

**File:** [`donovan-legal-site/functions/_lib/callmap-key.js`](../donovan-legal-site/functions/_lib/callmap-key.js)

The index has two halves in different directories — `booking/create.js` writes it at
booking time, `_lib/retell-postcall.js` reads it minutes to hours later out of a webhook
envelope. Each used to spell `callmap:` + the id for itself, and the failure mode of
editing one side is not an error but a **silent miss**: the read returns `absent`, the
endpoint 200s as a clean no-op, the four fields are never written, nothing goes red. So
`callmapKey(joinKey)` (`:61`) is built once and imported by both.

It returns `""` — never a partial key — for an empty id and for `"default"` in any
casing, because `callmap:` alone would be one global slot every such booking overwrote.
The id is placed in the key **verbatim**: `CALL_ID_RE` already constrains anything that
can become a join key, and escaping on one side only would reintroduce the drift the
module removes.

### 5.2 The producer

**File:** `booking/create.js:664-774`

Written **only** when both halves are present, and it is a **separate key** from
`booking:<id>`:

* **No `joinKey`** — an ordinary web booking (skipped silently) or a call whose id the
  server could not vouch for (skipped and **logged**, because that is the coverage this
  design trades away and it has to be countable in production).
* **No `contact_id`** — nothing to point the call at. Skipped and logged.

The key is `callmap:<joinKey>`, the value is `{ contact_id, booking_id, created }`, TTL
**7 days** (`CALLMAP_TTL_S`, `:82`) — deliberately not the 90 days the `booking:` record
keeps, because that record is a back-office audit trail carrying no call id and this one
is keyed *by* a call id.

**The hardening.** The key used to be the `call_id` as the browser typed it, unchecked.
A browser could therefore book under someone else's `call_id` and point that call at its
own Clio contact — cost: one Turnstile pass and one real appointment. With a consumer in
the tree that is a stranger's post-call analysis written onto the forger's contact, or
the reverse. Keying on `joinKey` closes the hijack of an *established* entry, because
`qual.consume()` spends `qualbk:<id>` when the genuine booking confirms, so a later
forgery of the same id resolves `unverified` and writes nothing. **What it does not
close, stated plainly in the code:** a forger holding a leaked `call_id` whose qualifier
record is still live can still verify and still index. Binding the join to caller
identity remains out of scope.

The write is best-effort and deliberately does **not** feed `kvWriteOk`: 207
`PARTIAL_FAILURE` means "we did not record your booking", which would be a false
statement about this failure. The key is never logged — it contains the call id.

### 5.3 The consumer

**Files:** [`functions/webhooks/retell-postcall.js`](../donovan-legal-site/functions/webhooks/retell-postcall.js) ·
[`_lib/retell-postcall.js`](../donovan-legal-site/functions/_lib/retell-postcall.js) ·
[`_lib/retell-auth.js`](../donovan-legal-site/functions/_lib/retell-auth.js) ·
[`booking/_lib/postcall-policy.js`](../donovan-legal-site/functions/booking/_lib/postcall-policy.js)

`POST /webhooks/retell-postcall`. **Not** under `functions/fn/`, and that is not an
accident: `fn/*` is principally the Retell custom-function **tool** surface, closed over
by a completeness invariant in `repo-invariants.test.mjs` and authenticated with the
shared `x-perch-tool-secret` header because a tool call carries no webhook HMAC. This is
a webhook delivery, which does carry one.

That invariant carries a named `BROWSER_CALLED` exemption for the routes the caller's own
browser hits, which are bearer-capability by construction and out of scope for the tool
secret: `page-poll.js`, `qualifier_submit.js`, `booking_confirmed.js`, and — added by
PR #217 — `contact.js`. `contact.js` is the one member of that list that is **not** a
bearer capability: it holds no call id, and there is no secret a public contact form
could carry. Its gate is the three fail-closed `_lib/abuse.js` layers instead —
same-origin, per-IP rate limit, and Turnstile whose unset secret 503s the route rather
than opening it — which is the posture `/booking/create` takes for the other
unauthenticated public write on this site. See [§3.4](#34-the-contact-inquiry-write-path--post-fncontact).

The body is read **exactly once, as text** — the HMAC is over the raw bytes, so a
re-serialised parse could not reproduce the signature. Four gates, in order:

| Gate | Check | Outcome |
|---|---|---|
| 1 | `verifyRetellSignature` — is this Retell? | 401 / 503 |
| 2 | `checkPostCallAgent` — is this **our** agent? Fail closed, no lab bypass | 403 |
| 3 | `event === "call_analyzed"` (`POSTCALL_EVENT`) | 200 no-op — the analysis is empty on `call_ended`, and acting on it would write four blanks |
| 4 | `readCallmap(env, callId)` | 200 no-op — the call never booked, or booked under an unverified id (indistinguishable on purpose) |

Gates 1 and 2 refuse; 3 and 4 answer 2xx and do nothing, because both are ordinary states
of a correct integration — Retell delivers several event types to one URL and most calls
do not end in a booking, and a 4xx there would train the vendor's retry logic on events
that can never succeed.

**Every failure past gate 2 is still a 2xx**, because the write is idempotent by
construction: `buildCustomFieldValues` resolves the value ids the contact already holds
and updates them in place, so a replayed delivery re-sends the same four values to the
same four rows.

**The four fields**, selected by `selectPostCallFields(body.call)` and written by
`writePostCallFields` (`provider-clio.js:2545`):

| Key | Clio CustomField | Type |
|---|---|---|
| `urgency` | Intake Urgency | `text_line` |
| `interest` | Intake Interest | `text_line` |
| `user_sentiment` | Intake Call Sentiment | `text_line` |
| `call_summary` | Intake Call Summary | `text_area` — prose measured in sentences |

**No value reaches a log line anywhere on this path.** These are a summary of the
caller's legal matter and a machine's judgement about them as a person, and a rejection
body additionally echoes back whatever was sent — which for this integration has
included the client's income and net-worth bands. Diagnostics emit key **names** and
counts only; the one place a vendor body is read goes through `describeClioFailure`
(`provider-clio.js:1899`), which names fields from a closed vocabulary and counts
everything it cannot name. **Nothing here is client-facing** — the only surface written
is `custom_field_values` on the attorney-side contact.

---

## 6. Vantage and Grow lead egress

**Files:** [`booking/_lib/vantage-upsert.js`](../donovan-legal-site/functions/booking/_lib/vantage-upsert.js) ·
[`booking/_lib/vantage-lead.js`](../donovan-legal-site/functions/booking/_lib/vantage-lead.js) ·
[`booking/_lib/grow-lead.js`](../donovan-legal-site/functions/booking/_lib/grow-lead.js) ·
[`booking/_lib/redirect-refusal.js`](../donovan-legal-site/functions/booking/_lib/redirect-refusal.js)

Two senders reach Vantage `/upsert-lead` at `https://vantage.ticoai.net` (not
overridable — an env-settable origin would be a second way to choose where a
credentialed lead goes), plus one to Clio Grow.

| Sender | Call sites | Deployment scope |
|---|---|---|
| `upsertVantageLead` (`vantage-lead.js:45`) | `booking/create.js:572` | `donovan-intake` |
| `sendVantageUpsert` (`vantage-upsert.js:167`) | `fn/save_lead.js:61`, `fn/take_message.js:116`, `fn/qualifier_submit.js:313` | caller-set |
| `createGrowLead` (`grow-lead.js`) | `booking/create.js:551`, `fn/take_message.js:92`, `fn/contact.js:204` | — |

**Why one shared door.** A guard at a call site is only as good as the next caller
remembering it. `redirect: "manual"` was added at two call sites first; three more
hand-rolled their own `fetch` at the platform default, which **follows**.
`vantage-upsert.js` owns the origin, the path, the query concatenation, the write header
and the redirect mode, so a fourth writer cannot get the mode wrong without deleting an
import — a change a reviewer sees, rather than an option nobody can see missing. The
caller still owns *which fields* it forwards; `params` is passed through unmodified and
stringified once, so the query on the wire is byte-identical to the one the caller built.

**What rides on the call, and why a hop hands it away.** The fetch specification strips
exactly three headers across origins — `Authorization`, `Cookie`, `Proxy-Authorization`
— and nothing else. `x-write-secret` is a **custom** header, so no runtime strips it; and
the caller's name, email, phone and (from `qualifier_submit`) income and net-worth bands
travel in the **query string**, which is part of the URL and goes wherever the request
does. So on this endpoint both the credential and the PII survive a hop a bearer token
would not have survived.

**Fail-closed, in two arms** (`vantage-upsert.js`):

* **Arm 1 — no credential, no egress** (`:185`). An unset `VANTAGE_WRITE_SECRET` used to
  send the lead anyway, unauthenticated, putting the client's PII on the wire against a
  gate we hold no key for. It now returns `{ok:false, skipped:"no_secret"}` **and warns
  from here**, because the callers' own warn is guarded on `status !== undefined` and a
  skip carries no status — so a misconfigured deploy would otherwise drop every lead in
  total silence.
* **Arm 2 — a 200 is not an acknowledgement** (`:239`). Probed live 2026-08-07,
  `GET /upsert-lead` answers **HTTP 200** with `{"ok":false,"error":"no_stable_visitor_id"}`
  — and answers the *same* 200 whether the write secret is absent, wrong or right. The
  status line therefore cannot tell a persisted lead from a dropped one, and
  `{ok: res.ok}` reported every drop as a success. `upsertNack` (`:103`) reads the
  refusal out of the body. Its error string is allow-listed to `SAFE_ERROR_CODE`
  (`/^[a-z][a-z0-9_]{0,39}$/`, `:90`) before being repeated, because a failure body is
  exactly where a client's own email comes back; anything off that shape is reported as
  `"unspecified"`.

**Fail-open on the caller, deliberately and in the same breath.** Every refusal is
*returned* in the same `{ok:false, status}` shape a 502 from Vantage produces, never
thrown, so `create.js` takes its ordinary non-fatal branch and a confirmed appointment
still answers 201. The lead is lost from the dashboard, which is the identical cost of
Vantage being down; a booking a client already completed must not fail behind it. The
`fn/*` routes ack their caller before the write completes (`waitUntil`).

**`/fn/contact` is the one caller that treats a Grow refusal as fatal**, and that is not
an inconsistency — it is the absence of a second sink. A booking that loses its lead
still leaves an appointment on the firm's calendar; a website inquiry that loses its lead
has reached nobody. So `fn/contact.js` awaits `createGrowLead`, answers **502** on a
non-2xx and **503** on `{skipped:"no_token"}`, and only then attempts the Clio Manage
record ([§3.4](#34-the-contact-inquiry-write-path--post-fncontact)). It reaches Vantage
not at all.

**The URL is never logged** — it carries name, email, phone and bands. `redirectRefusal`
is passed the bare **origin**, not the request URL, so the PII never enters that function
at all; it returns a host and nothing else, and that host is named in exactly one place.

---

## 7. The members area — tier gating on Clio

**Files:** [`functions/_lib/member-auth.js`](../donovan-legal-site/functions/_lib/member-auth.js) ·
`functions/{gold,platinum,diamond,reserve}/_middleware.js` ·
[`functions/members/auth/`](../donovan-legal-site/functions/members/auth/) ·
[`functions/_lib/tier-auth.js`](../donovan-legal-site/functions/_lib/tier-auth.js)

Each of the four levels is one line — `export const onRequest = memberGuard("<level>")`.

**Clio is the roster; this file is the door.** The firm admits a member by setting one
picklist field, **`Membership Tier`**, on that person's Clio contact. Nothing about
membership is stored on the website: no member list, no passwords, no roster file. A
paralegal changes a dropdown in the system they already live in, and the door reflects
it on the member's next sign-in.

**The one rule this file exists to protect: no tier names live in the code.** Not a list,
not an enum, not a mapping table. The gate compares the string Clio returned against the
name of the folder being requested — that is the whole decision. It means the firm can
add "Sapphire" by creating a picklist option and a `/sapphire/` folder with no deploy and
no engineer. The moment a tier list appears in that file, administration has leaked back
onto the website and the property is gone.

**Why there is a second Clio read.** A picklist custom field answers with the option
**id**, not the label (`Membership Tier value = "11238563"`, not `"Gold"`) — unlike the
twelve Intake fields, which are `text_line` and answer with their label. `tierOptionMap`
(`:158`) resolves ids from `/custom_fields` and is cached per isolate; the **membership
read itself is never cached**, so revocation bites on the next sign-in.

**Fail closed, every path** (`:30-33`): Clio unreachable, a malformed body, an option id
the map has never seen, a contact matching more than one record — all deny. An
unconfigured environment serves **503**, never public.

**Levels are independent, not ranked.** A gold session opens `/gold/` and nothing else.
The session is a signed, **level-only** cookie (`dl_member`, `:66`) — HMAC over
`MEMBERS_SESSION_SECRET`, so rotating that secret ends every session at once, which is
the emergency revoke-all. It is both session-scoped (no `Max-Age`, so closing the browser
ends it) and held to a **sliding** 12-hour idle window (`:76`), whichever comes first:
someone working through an afternoon is never interrupted, a laptop left open in a lobby
still locks. Sign-in telemetry hashes the email with `MEMBERS_HASH_SALT`, because an
unsalted hash of an email is trivially reversible against a candidate list.

`CLIO_MEMBERS_*` credentials are offered with a fallback to the booking `CLIO_*` set
(`creds`, `:97`) because Preview and Production point at different Clio accounts — a
preview build reading Preview's Clio would look for `Membership Tier` in an account that
never had it and deny every member, which reads as a broken build rather than a
misconfiguration. That is safe **here and nowhere else in this codebase**, because this
file only ever issues GET requests.

**Sign-out, and the retired login orphan** (PR **#218**, `JORDAN-196-LOGIN-SIGNOUT-R1`,
issue #196 — now closed). Two things landed together:

* **`login.html` is deleted.** It was a "Coming Soon" splash carrying the *previous*
  site's nav and no login of any kind, on a site whose member authentication has been
  live since `MEMBERS-CLIO-GATED-ACCESS-R1`. **Both** URL spellings now 301 to
  `/engagement` (`_redirects`: `/login.html` and `/login`) — both, because Pages serves
  the file at the extensionless path too and an `.html`-only rule would leave the deleted
  page's canonical URL answering 404. `/engagement` is the canonical MEMBERS page (#43)
  and carries the four tier links `js/members-gate.js` intercepts to open the sign-in
  card, so the redirect lands on the gate rather than near it. The **18** legacy pages
  that still spell `href="login.html"` were deliberately **not** edited: that means
  editing `nav.menubar`, which `test/chrome-diff.test.mjs` compares byte-for-byte and
  does not waive. One redirect carries all 18. `js/page/login-coming-soon.js` went with
  the page, and with it that page's `ADOPT_SCRIPTS` row ([§2.4](#24-the-swup-router-and-its-swap-policy)).
* **`/members/auth/signout` finally has a caller.** The endpoint had shipped with **no
  caller at all** since `MEMBERS-CLIO-GATED-ACCESS-R1`: a member who signed in could not
  sign out, and because `dl_member` is session-scoped the session survived until the
  whole browser closed — on a shared machine, for the next person. `js/members-signout.js`
  is the missing control, on all **39** pages under the four tier roots.

**The endpoint is untouched and so is every access decision.** `signout.js` clears the
cookie and answers `{ok:true}`; it requires no auth and does no origin check, because
being able to clear your own cookie is not a privilege worth gating. The control reads no
cookie (`dl_member` is `HttpOnly`, so it could not), holds no credential, and branches on
nothing but whether the POST succeeded.

**Two design points worth keeping.** It recognises the member area **by pathname**
(`/^\/(gold|platinum|diamond|reserve)(\/|$)/i`) rather than by "is the visitor signed
in", because the HttpOnly cookie makes the latter unavailable — and the path is exact,
not approximate, since `memberGuard` 302s a signed-out visitor away before any document
inside those folders is served. And **a refused sign-out does not navigate**: if the POST
is not 2xx the cookie was not cleared, and showing the public homepage anyway reads
exactly like success while the session is still live. The button re-enables and says so.
On success it uses `location.replace`, so Back does not walk into the portal page.

**It is loaded by `js/perch-layer.js`, not by a `<script>` tag.** A tag would have to be
added to 39 hand-authored files, and chrome-diff fails on any change to a page's
script/stylesheet manifest — the one rule the reviewed-structural allowlist does not
waive. The layer module is already injected into `<head>` of all 39 by
`perch-layer-inject.js`, so one side-effect import reaches all of them and **no page file
was edited**. `test/members-signout.test.mjs:112` drives the real injector over the
member tree to prove that, and `:126` proves the import is a live statement rather than
the prose about it.

**`tier-auth.js` is the superseded HTTP Basic gate.** It is no longer imported by any
tier middleware — it was replaced by `memberGuard` in PR #191 — but the file remains on
`main`, still fails closed, and is **still required by the deploy tree-integrity guard**
(see §8). `test/members-gate.test.mjs:792` pins that it keeps its fail-closed contract,
and `test/members-marketing.test.mjs:247` pins that the Basic gate does not linger
alongside the new one in the tier middlewares.

---

## 8. CI and the deploy gates

**Files:** [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) ·
[`.github/workflows/deploy-pages.yml`](../.github/workflows/deploy-pages.yml) ·
[`.github/workflows/deploy-drift.yml`](../.github/workflows/deploy-drift.yml) ·
[`.github/workflows/claude.yml`](../.github/workflows/claude.yml) ·
[`.github/workflows/agent-verdict.yml`](../.github/workflows/agent-verdict.yml)

**Verified on `main` while writing this document:** `npm test` → **2266 tests, 2265
pass, 1 skipped, 0 fail**, 425 suites. `npm run test:hygiene` → 10 tests, 10 pass.

### Where each gate actually runs

| Gate | Workflow | Job |
|---|---|---|
| Root test suite (2266) | both | `ci.yml` → `build-and-test`; `deploy-pages.yml` → `test` |
| **chrome-diff** | both, inside `npm test` | `test/chrome-diff.test.mjs` |
| **Tree-integrity** | **`deploy-pages.yml` only** | `guard` — a separate job, *not* part of `build-and-test` |
| Hygiene / doc records | **`ci.yml` only** | `build-and-test`, last step |

The hygiene split is enforced, not conventional: `hygiene/deploy-drift-record.test.mjs`
asserts both halves and **reds if the step ever lands in the deploy workflow**, because
`deploy-pages.yml`'s `production` job declares `needs: [test, guard]` — so anything in
that workflow's test job becomes a precondition for deploying the live site, and a
documentation mismatch is not a reason to hold a deploy.

### `fetch-depth: 0` is load-bearing

`test/chrome-diff.test.mjs` reconstructs each changed page as it was *before* the change
with `git show` at the merge base. A depth-1 checkout has no merge base and no
`origin/main` to find, and the gate is written to **FAIL** in that situation rather than
report a clean result it never checked — so without `fetch-depth: 0` every pull request
goes red. Both `ci.yml:45` and `deploy-pages.yml:52` set it.

### What chrome-diff checks

For each changed page under `donovan-legal-site/`, against its pre-change bytes:

1. the same `<script src>` / `<link href>` tags, same values, same order;
2. a byte-identical `nav.menubar` and `.copy-inside` subtree;
3. an identical element tree — every tag, every attribute, same nesting — so **text is
   the only thing a content edit may change**;
4. no `<main>`, no `<div id="concierge">` and no `on…=` handler introduced.

Each rule maps to a real, silent production failure: adding a `<main>` flips
`decidePlan` from `wrap` to `stamp`; adding `div#concierge` makes the page skip entirely
(no container, no layer, no router, no booking bar — and the page still looks perfect);
moving markup across `div.container` still resolves the ordinals but wraps the copyright
line instead of the article; dropping a `<script src>` removes a feature; an `onclick=`
is dead under the nonce CSP.

**Two scoping corrections** (`SARAH-CHROMEDIFF-SCOPE-R3`, PR #211), both narrowing rule 3
only. `CONTENT_LANE_METADATA` masks the *value* of four text carriers — `<title>`,
`meta[name=description]`, `og:title`, `og:description` — because a description is text to
a reader and an attribute to a parser. `og:url`, `og:image`, `og:type`, `robots`,
`viewport` and `canonical` are still compared in full; adding or removing any meta still
fails, and the masking is keyed on the identity attribute so a tag cannot rename its way
into the exemption. `REVIEWED_STRUCTURAL` is a closed, named per-file waiver with a
written reason, active only while five guards that `decidePlan` actually reads hold.

**A second, narrower waiver register** landed with PR #217: `REVIEWED_ASSETS`, which can
suppress rule 1 (`scripts-and-stylesheets`) and nothing else. It is deliberately not a
column on the structural list — the two answer different questions, and a reader has to
be able to see at a glance the complete set of pages whose asset manifest somebody
changed on purpose. It is **additive-only**, enforced structurally rather than by three
separate checks: `assetWaiver` requires the before-manifest to survive as a **subsequence**
of the after-manifest, so a dropped tag, a re-pointed `src` and a reordered pair are each
refused even for a listed file. The rule's own failure message names four failures and a
review can only ever speak to the first. One entry today — `contact.html`, for the three
head tags PR #217 added (`/js/dl-init.js`, `/js/page/contact-form.js`, and the Turnstile
`api.js` already loaded by `book.html` and already on the CSP `script-src` allow-list).
Five traps drive the refusals rather than describing them, and one proves the waiver
suppresses one rule while nav, footer, `<main>`, orb and `on*=` still fail on their own
account.

**It is not a vacuous pass on a PR that changes no pages.** The per-page suite is empty
there, so two others carry the weight: a plumbing suite proving the "before" bytes are
really reconstructed (non-empty and containing the nav — a `git show` that quietly
returned nothing would read as a clean page), and a trap suite running the comparison
over seven deliberately broken pages and requiring each to fail with its own message.

### The tree-integrity guard

`deploy-pages.yml:63-86`. Refuses to deploy a ref that is not the rebuilt site — the
pre-rebuild GoDaddy import has no `functions/` and no `_headers`, and deploying it would
strip tier auth, the consent gate and the CSP off the live project. Six required files:
`_headers`, `functions/_middleware.js`, `functions/web-call.js`,
`functions/_lib/tier-auth.js`, `functions/_lib/consent-ticket.js`,
`functions/_lib/abuse.js`.

### The deploy gates themselves

**Preview** runs on a push to a non-default branch, needs `[test, guard]`, re-confirms
the Cloudflare production branch through the API and **fails closed** on a non-2xx, on
`success != true`, or on an empty `production_branch` — so a 403, an expired token, an
error document or a network blip aborts rather than letting an empty value slip a push
through to prod. A branch-name allow-list adds defence in depth, and the preview job is
skipped on the default branch outright.

**Production** is `workflow_dispatch` only and requires all three of `ref_name == 'main'`,
the typed input **`confirm == 'deploy-production'`**, and the protected `production`
environment.

**No GitHub context is interpolated into any `run:` body.** `github.ref_name` and the
resolved branch travel via `env:` as `"$REF"` / `"$PB"`, so a crafted branch name cannot
inject shell with the Cloudflare token in scope.

Both deploy steps use `working-directory: donovan-legal-site`, which is what makes
wrangler read `./wrangler.jsonc` (`pages_build_output_dir: "."`) **and** compile
`./functions` into Pages Functions.

**`deploy-drift.yml`** is scheduled and read-only. It exists because production ships
only via that manual dispatch, while every *other* run of `deploy-pages.yml` still goes
green with the `production` job recorded as *skipped* — so "newest green run on main" is
not the same thing as "newest deploy", and reading it by eye is how a handoff came to
assert run 258 when 276 was live. `bin/check-deploy-drift.mjs` exits 0 (match), 1
(site-affecting drift) or 2 (could not complete — fails closed, never reports "no drift").

---

## 9. Accessibility — the measured state

**Files:** [`docs/A11Y-PROD-SWEEP-FINDINGS.md`](A11Y-PROD-SWEEP-FINDINGS.md) (PR #216) ·
[`docs/A11Y-SWEEP-FINDINGS.md`](A11Y-SWEEP-FINDINGS.md) (PR #202, the baseline) ·
[`scripts/a11y/a11y-sweep.mjs`](../scripts/a11y/a11y-sweep.mjs) ·
[`css/main.css`](../donovan-legal-site/css/main.css)

Three orders in sequence: #202 measured, **#213** fixed the palette, **#216** re-measured
**the live production site**. The numbers below are #216's, and they are the current
as-built accessibility state.

**What #213 changed.** It re-valued the brand colours in the shared stylesheets — green
`#169b62` → `#107a4d`, hover `#0a5a37` — and painted a real focus ring on the contact
form (`outline: 3px solid #0a5a37; outline-offset: 2px`, an outline rather than a border
because the page transitions `border-color` and a transitioned property paints nothing at
the instant focus lands). Its deployment was **confirmed, not assumed**, before #216
scanned: the live `/css/main.css?v=20260721a` byte-matches the post-#213 file on `main`.

**Method, and why it is trustworthy.** axe-core pinned to **4.13.0** — the same version
as the baseline, so a new rule cannot be a tool-upgrade artefact — via Playwright/Chromium
against the WCAG 2 AA tag set. Serial (concurrency 1), because parallel axe runs were
previously proven to manufacture phantom contrast nodes; full-page reveal scroll, because
scroll-gated card grids otherwise hide them; **two passes 1200 ms apart with only nodes
reproducing in both reported** (0 quarantined as unstable); axe injected via
`page.evaluate`, **not** `bypassCSP`, so the measured DOM is the real one. **98 / 98**
sitemap URLs measured, 0 unmeasured — the sitemap has grown 84 → 98 since the baseline.

| Rule | Impact | Live nodes (98 pp) | Pre-fix (84 pp) | On the 84 common pages |
|---|---|---|---|---|
| `color-contrast` | serious | **1033** on 71 pages | 1537 | **1537 → 806 (−731)** |
| `aria-valid-attr-value` | critical | 24 on 8 pages | 24 | ±0 |
| `button-name` | critical | 24 on 8 pages | 24 | ±0 |
| `svg-img-alt` | serious | 28 on 26 pages | 28 | ±0 |
| `html-has-lang` | serious | 9 on 9 pages | 9 | ±0 |
| `link-in-text-block` | serious | 8 on 8 pages | 0 | **new since baseline** |
| `aria-required-children` | critical | 1 | 1 | ±0 |
| `select-name` | critical | 1 | 1 | ±0 |
| `nested-interactive` | serious | 2 on 2 pages | 0 | **new since baseline** |

**Total failing nodes across the live site: 1130.** Read the like-for-like column, not
the headline: the all-pages figure covers 14 URLs that did not exist at baseline.

**Neither new rule is a #213 regression, and both were checked against it before being
reported.** `link-in-text-block`'s 8 nodes are all on `/blog-controversy-roadmap-*`, pages
added by **#197**, whose link colour comes from their own inline `--emer` token that #213
never touched. `nested-interactive`'s 2 nodes are 0 on the 84 baseline pages — both sit
on pages that did not exist then. Cause in each case is new content.

**Why 1033 contrast failures survived a fix that re-valued the palette — and the finding
that matters for any follow-up.** 803 of the 1033 residual nodes (78%) are painted in the
exact colours #213 re-valued: 622 in the old green `#169b62`, 181 in the old gold
`#c9a961`. The fix is correct and simply **cannot reach them** — the old hex is written
into the delivered HTML, which outranks or bypasses any stylesheet re-value. Eight pages
(`/blog-controversy-roadmap-0` … `-7`) load no site stylesheet at all, only
`perch-layer.css` and `dl-utility-bar.css`, and define their own palette inline: no edit
to `main.css` can ever affect them. A stylesheet-only follow-up therefore has a hard
ceiling well above zero.

**Image alt coverage is complete**: 308 `<img>` across 98 pages, **308 with an `alt`
attribute, 0 missing** (210 informative, 98 declared decorative). The 98 decorative
declarations are flagged as human judgement calls, not defects.

**#216 changed no site source.** Its diff is `docs/A11Y-PROD-SWEEP-FINDINGS.md` alone —
nothing under `donovan-legal-site/` was touched. The findings are reported as measured,
not triaged; assigning owners and fixes is a separate order, and **issue #195 remains
open** on the strength of the residual above.

---

## 10. Analytics, consent and conversion reporting

Shipped across PRs #234, #236, #237, #238, #241, #244, #245. **Live in production** —
`ANALYTICS` is set, and `<script type="module" src="/js/analytics.js">` is present in
the head of every served page (verified against production 2026-08-11).

### 10.1 How it reaches the page

There is no templating in this repo and the chrome is copy-pasted across ~130 files, so
nothing is pasted into pages. One module tag is injected at the edge by
[`_lib/analytics-inject.js`](../donovan-legal-site/functions/_lib/analytics-inject.js),
composed into the same `headTags` string as the layer, router, bar, footer and nav tags
(§1). It **cannot** be its own `['head', …]` handler — lol-html keeps only the last
`onEndTag` per element, so a second head handler would silently delete the layer's tags.

`analyticsEnabled(env)` requires `ANALYTICS` to equal exactly `on`. It deliberately
diverges from `routerEnabled`, which defaults on for `*.pages.dev`: a preview running the
real tags would send test traffic to the real GA4 property, the real Ads conversions and
the real Meta dataset. Fake conversions are not merely untidy — Smart Bidding learns from
them.

### 10.2 Consent

[`consent.js`](../donovan-legal-site/js/analytics/consent.js) ·
[`consent-banner.js`](../donovan-legal-site/js/analytics/consent-banner.js) · storage key
`dl.consent.v1`.

Google Consent Mode v2 defaults are published **before** `js`, `config` and the loader —
gtag applies the first default it sees, so a default published after `config` is too late
and the session's first hit goes out with storage granted. All four signals
(`ad_storage`, `ad_user_data`, `ad_personalization`, `analytics_storage`) start denied.

The two vendors are treated differently, and the asymmetry is deliberate:

* **Google loads either way.** Under Consent Mode with everything denied it sets no
  cookies and sends no identifiers, only cookieless pings Google can model from.
* **Meta does not load at all** until someone accepts. The pixel has no cookieless mode,
  so "declined" and "not answered yet" are the same instruction.

A stored acceptance is replayed as a `consent update` on the next visit, so a returning
visitor is not treated as denied for the first hit of every session.

### 10.3 The event catalogue

[`events.js`](../donovan-legal-site/js/analytics/events.js) is pure — no imports, no DOM,
no top-level side effects — because the catalogue *is* the contract with two ad platforms
and CI has to exercise that rather than a re-implementation of it.

| Event | GA4 | Google Ads | Meta | Producer |
|---|---|---|---|---|
| `booking_confirmed` | yes | label | `Schedule` | `__perchBooking:'confirmed'` postMessage |
| `qualifier_submitted` | yes | label | `Lead` | `dl:qualifier-submitted` |
| `call_started` | yes | label | `Contact` | `vantage:call-start` |
| `message_taken` | yes | label | `SubmitApplication` | `fn/take_message.js` (server) |
| `tel_click` | yes | — | — | delegated `a[href^="tel:"]` click |
| `page_view` | yes | — | `PageView` | initial load + every router swap |

`tel_click` is deliberately outside the catalogue: no Ads action exists for it, and
Meta's `Contact` would collide with `call_started`. It is delegated from the document
rather than bound per element, because the call bar re-renders on every soft navigation
and per-element listeners would be lost on the first swap — silently, and only for
visitors who navigated. It is never `preventDefault`ed.

`page_view` is fired by the tracker, not by gtag — both streams are configured
`send_page_view: false`. The site navigates client-side, so gtag's automatic page view
fires once per document and never again; leaving it on would double-count the entry page
of every session and under-count everything else.

### 10.4 Per-deployment tag configuration

The GA4 property, Ads conversion account and Meta dataset are per-**firm**, not
per-product. `DEFAULT_TAG_CONFIG` in `events.js` holds Donovan's values as defaults;
[`config.js`](../donovan-legal-site/js/analytics/config.js) overrides them from
`<meta name="dl:ga4">`-style tags that `analytics-inject.js` emits from the environment.
Each is shape-validated on read, and a malformed value falls back to the default rather
than sending every conversion for the life of the deployment to an account that does not
exist.

Meta tags rather than an inline script: injected content is never re-fed through
`NonceStamper`, so an injected `<script>` could not carry the request nonce. A `<meta>`
has no CSP interaction at all.

`META_DATASET_ID` is set in the environment, so the server-side client and the browser
pixel read one value rather than two. Verified in production: the environment variable,
the injected `dl:meta-dataset` tag and the code default all read `1769060274465061`.

### 10.5 Conversion value

[`_lib/conversion-value.js`](../donovan-legal-site/functions/_lib/conversion-value.js)
(authoritative) and [`value.js`](../donovan-legal-site/js/analytics/value.js) (browser
copy, pinned equal by test).

`fn/qualifier_submit.js` derives a tier from the caller's tapped answers. Until #244 that
tier was dropped on the floor: the `qualbk:<callId>` record did not carry it, so
`booking/create.js` — the only place that reports the conversion — could not see it, and
**every booking was worth the same to Google**. It now travels `qualifier_submit` →
`qualbk:` KV → `qualifier-bind` → `booking/create`.

The vocabulary the qualifier actually produces is **Gold**, **Platinum**, **Reserve** and
`escape_hatch` — capitalised for the first three, lower-case for the last, which is why
the value map normalises before lookup. **There is no qualifier path that produces
Diamond**, despite the firm marketing four tiers.

Tier is allow-listed on read and routed **around** the #153 intake write policy: it is a
reporting band and must never become a Clio contact field. Tested explicitly.

Values are relative weights, not currency, and are **placeholders**. The ordering is the
firm's own tier ladder and is defensible; the magnitudes are not. Never zero — a
zero-valued conversion teaches value-based bidding that the conversion was worthless,
which for an unclassified booking is exactly backwards.

### 10.6 Server-side reporting (Meta Conversions API) — built, switched off

[`_lib/meta-capi.js`](../donovan-legal-site/functions/_lib/meta-capi.js). Requires
`META_CAPI=on` **and** `META_CAPI_TOKEN` **and** `META_DATASET_ID`. **`META_CAPI` is not
set in production, so none of this runs.** The other two are set.

When enabled it fires from `booking/create.js` on a genuine confirmation only — not on
the idempotent 201 replays — and covers the 207, because a 207 booking is a real booking.
It is handed to `waitUntil` and never awaited, so a slow or unavailable Meta cannot delay
or fail a booking. It never throws. Email, phone and name are SHA-256 hashed after
normalisation, and rejection bodies are never logged, because Meta echoes submitted
fields back in its errors.

**The deduplication contract.** Meta merges the browser and server copies into one
conversion only when `event_name` and `event_id` both match. Neither side can see the
other's random id, so both derive `dlbk_<call_id>` — in two files that cannot import each
other (`_lib/meta-capi.js` and `js/analytics/tracker.js`). A divergence throws nothing; it
silently counts every booking twice and inflates the bids that follow. A test pins the two
byte-identical. **Do not delete it.**

No `call_id` means no shared key, so the server stays silent and the pixel reports alone.
That undercounts direct `/book` visits, deliberately: undercounting is recoverable,
double-counting spends money.

### 10.7 Social preview tags

[`_lib/social-meta-inject.js`](../donovan-legal-site/functions/_lib/social-meta-inject.js)
(#246) derives `twitter:*` and the missing `og:*` fields from the tags each page already
declares, composed into the same `headTags` string. It reads the document because
`_middleware.js` already buffers it for the div-ordinal plan, so this costs no extra pass.

Additive and idempotent — a tag the page already declares is never emitted twice. Two
`og:title`s is not cosmetic: scrapers take the first, or the last, or neither.

`summary`, not `summary_large_image`: the only image these pages declare is a portrait
headshot, which a large card crops through the face. **No image dimensions are declared**,
because the file has not been measured and a platform trusts the declared numbers over the
image — a wrong number makes the crop worse, not better.

**There is no `BreadcrumbList`.** One was written and removed: this repo forbids the edge
from injecting an inline `<script>`, including `application/ld+json`, and five suites
enforce it. Injected content is never re-fed through `NonceStamper`, so an injected script
cannot be brought inside the nonce CSP by the normal path. Static JSON-LD in a page's own
source is fine and already used (40 posts carry `Article` schema). A test now pins "this
module injects no `<script>`" so it is not reintroduced by someone who did not hit those
suites.

### 10.8 Crawl and redirect policy

`robots.txt` names the AI crawlers explicitly. Nothing is newly blocked — the wildcard
already allowed everything — but `Google-Extended` and `Applebot-Extended` are opt-**out**
controls for AI training and answer surfaces, so naming them replaces a vendor-changeable
default with an explicit permission.

Every 301 in `_redirects` now points at an **extensionless** target. Cloudflare Pages
already 308s `/foo.html` to `/foo`, so a `.html` target produced a two-hop chain
(`/family-law.html` → 301 → `/experience.html` → 308 → `/experience`). Chains dilute and
waste crawl budget, and external audit tooling reads the first hop's destination as the
source page's content — which is how an outside audit came to report `/family-law.html`
as "a page about REIT IPOs". Verified in production: one hop, target 200.

### 10.9 What is instrumented but unproven

Recorded because the absence of evidence is a finding, not an omission.

* **`message_taken` has never fired.** The server path exists in `fn/take_message.js`, but
  there is no machine-readable Retell tool manifest in this repo — the tool configs live
  in the Retell dashboard — so nothing here confirms the phone agent calls that endpoint
  at all. Until that is confirmed, out-of-hours phone leads are not measured.
* **The tier value path is unproven end to end.** It needs a real booking against the live
  Clio calendar.
* **A phone conversion cannot be attributed.** A call carries no browser, no `gclid`, no
  `_fbc`. `message_taken` is countable volume, not optimisation signal, until Google Ads
  call reporting (a dynamic number swap) exists. `tel_click` is the attributable proxy:
  the tap happens in the page with the click id attached; the call does not.
* **No Google Enhanced Conversions.** The same normalise-then-SHA-256 code exists for Meta
  and has no Google equivalent, which also limits how well an offline import would match.
* **No offline conversion import**, no GA4 Measurement Protocol, and **no Search Console
  property** for the domain.
* **The `/disclaimer` consent opt-out control has never been verified in a browser.** The
  deployed code reveals `#dl-consent-reopen` via `wireConsentReopen`; nobody has confirmed
  it renders.

---

## Claims deliberately not made

Recorded here because their absence is a finding, not an omission.

* **No Clio Matters.** Nothing in `functions/` calls the Clio Matters API — a
  repo-wide search for `matters` across `donovan-legal-site/functions/` returns only
  prose. The word *matter* appears as a custom-field **scope**
  (`FIELD_SCOPE.MATTER`, `clio-custom-fields.js:98`) and in field **names**
  (`Intake Matter Category`, `Intake Matter Sub-Type`). The shipped Clio surface is
  **contacts** (with custom fields, addresses and web_sites), **calendar_entries**, and
  the **Zoom** `conference_meeting` on the entry. If a matters write is wanted, it is
  new work.
* **Tree-integrity is not part of `build-and-test`.** It is its own job in
  `deploy-pages.yml`. `ci.yml` has exactly one job and does not contain it.
* ~~**No GA4.**~~ **SUPERSEDED 2026-08-11.** GA4, Google Ads and the Meta pixel are all
  shipped and live behind `ANALYTICS=on` — see §10. `gaPageView` (`reinit.js:675`)
  remains a stub, but it is no longer the whole story: the tracker owns page views and
  `reinit.js` is not in that path. The measurement id is no longer an external blocker.
* ~~**The soft router is off in production by default.**~~ **STALE 2026-08-11.** The
  *default* is unchanged — `PERCH_ROUTER` unset still means `*.pages.dev` and localhost
  only (`perch-router-inject.js:74`). But the flag **is now set in production**, so the
  router, the frame-header lock and the shell retirement at `/` are all live. Verified
  against production: `X-Frame-Options: SAMEORIGIN` is present, `frame-ancestors` is
  `'self'` rather than permissive, and `/` serves 1,423 words with no `noindex` instead
  of the nine-word shell. Any statement elsewhere in this document that assumes the
  switch-off deployment should be read against that.
* **Meta Conversions API is built and switched off.** `META_CAPI` is absent from the
  environment; `META_CAPI_TOKEN` and `META_DATASET_ID` are present. It cannot fire.
  See §10.6.
* **`message_taken` has a server producer that has never been observed to fire.** There
  is no Retell tool manifest in this repo to confirm the phone agent calls it. See §10.9.
* **`style-src` still carries `'unsafe-inline'`.** Commented as a tracked follow-up, not
  an oversight (`_middleware.js:32-37`).

---

## Shipped changes

135 pull requests, from PR #1 (the Perch concierge and site rebuild) through PR #246,
grouped by subsystem (the count is the number of rows below; the previous revision said
113 against #218). Outcomes are one line each, taken from the merged commit on `main`.

The 22 merged since the previous revision are listed together in
[Since the previous revision](#since-the-previous-revision-219246) rather than
distributed into the groups below — the grouping is by subsystem and several of them
span two, so a single dated block is easier to audit against `git log` than a scatter.

### Perch — container, layer, router, re-init

| PR | Outcome |
|---|---|
| #63 | Derived the re-init inventory from the code rather than from prose. |
| #64 | Isolated the `PERCH_BRIDGE` Durable Object per tenant. |
| #65 | Externalised every inline script inside the swap container, ahead of the nonce CSP. |
| #66 | Injected one canonical `<main id="perch-main">` via HTMLRewriter — the two-pass, div-ordinal plan. |
| #74 | Persistent overlay layer holding the orb and the live call outside the swap region. |
| #75 | Swup router with a deny-by-default script-adoption allow-list. |
| #77 | Direct-DOM booking control for the router path, replacing an unobserved postMessage. |
| #79 | Re-render Turnstile on the swapped-in booking form through the widget's own seam. |
| #83 | De-exposed the layer control surface from `window`. |
| #85 | Refuse foreign framing once the shell is retired — `frame-ancestors` + `X-Frame-Options` on one flag. |
| #86 | Retired the noindex Perch shell from `/` behind the router switch. |
| #87 | Pinned the A34 differential baseline to the F-10 SHA. |
| #89 | Brought the injected-layer launcher to concierge parity with `/perch`. |
| #92 | Booted the command-consumer stack inside the injected layer. |
| #94 | Coalesced bridge commands so the qualifier and the booking calendar actually reach the caller. |
| #97 | Made the bridge DO an append queue so a second writer cannot destroy a first. |
| #98 | Replaced the launcher's UA focus ring with a keyboard-only brand ring. |
| #99 | Dropped the rollback cache trap at `/` (permanent 308 → no-store 307) and wired the keys Paula could not reach. |
| #101 | Hand a member tier off in speech instead of hard-navigating the call to death. |
| #107 | New Paula photo; the qualifier card wears her face. |
| #108 | Injected a top utility bar sitewide from one middleware handler. |
| #109 | A completed qualifier opens the booking calendar itself. |
| #177 | `/fn/page-poll` holds the connection instead of polling 50 times a minute. |
| #190 | Mobile menu overlay now closes after a soft-router navigation. |
| #203 | `syncHead` reconciles the whole incoming head — five classes, one ordered group — not just title and canonical. |

### Booking, Clio and the intake write

| PR | Outcome |
|---|---|
| #20 | `resolveConfig` fails closed on missing calendar config. |
| #21 | Fail-closed read handlers on `MISSING_CALENDAR_CONFIG`. |
| #22 | `CLIO_CALENDAR_ID` config + deploy guard, fail-closed. |
| #34 | Proved prefill maps name + email + phone, not phone-only. |
| #42 | Fed booking-form data to the Vantage dashboard so it stops arriving as a name-only half-lead. |
| #82 | Bound `call_id` to a server-side qualifier record before anything joins to it. |
| #111 | Attached the Clio attendee (so the client is emailed) and split the description off the client-facing email. |
| #119 | Vendored the Clio Manage OpenAPI v4 as the canonical contract. |
| #124 | Mapped the whole intake onto the Clio contact, corrected against that vendored contract. |
| #129 | An empty calendar and an unreadable one are no longer the same answer. |
| #138 | Closed the credentialed sink and the redirect hop in `clioFetch`. |
| #140 | Read-only Clio paging probe, hardened before touching credentials. |
| #150 | Refused redirects on the two booking lead pushes, which carried the credential and the PII across the hop. |
| #155 | Read-only write-path verifier for the seven Intake fields, the attendee and the leak guard. |
| #160 | An abandoned qualifier card must not inherit the previous visitor's answers. |
| #163 | Write-path verifier could not attribute a row and asserted the wrong meeting signal — fixed. |
| #166 | One shared lead-egress sender, so `/upsert-lead` cannot be redirected off-origin. |
| #167 | The contact read cannot name a custom field, so every intake value was going out in create form. |
| #169 | The contact search asked for `email_addresses` plainly, so it matched nobody and forked the CRM on every booking. |
| #170 | The create path never read the contact it made, so every intake row went out in create form and Clio answered 422. |
| #171 | Durable write-path regression against a Clio as stingy as the live grant. |
| #172 | The booking knew which consultation it was for and the contact did not — `Intake Consult Type` and the source website now written. |
| #175 | Nothing mapped a call to the contact it booked; the callmap index and the call id on the confirmation. |
| #176 | A valid slot selection renders the details step on the first click. |
| #183 | A returning contact's second booking left the first booking's matter answers standing — the matter/person merge policy. |
| #212 | The contact search only ever asked about the email, so a client's second address forked the CRM again — the phone leg. |

### Post-call analysis and the Retell surface

| PR | Outcome |
|---|---|
| #3 | Authenticated the Retell function-tool endpoints with a shared secret. |
| #31 | Single-sourced the Retell agent id. |
| #174 | The four post-call fields had no signed door to arrive through — the webhook, and `verifyRetellSignature` finally has a call site. |
| #178 | Pinned the Retell signature contract on the helper itself. |
| #179 | The producer write and the consumer read were each proved against a mock, so the seam between them had never been run once. |
| #180 | The callmap was keyed on a `call_id` anyone could type, so a booking under a stranger's call could claim their post-call analysis. |
| #181 | The post-call path logs names-only, so the two numbers the next decisions need were computable but unreadable. |
| #182 | The Retell verifier signed the wrong string and parsed the wrong header, so every genuine delivery 401'd. |
| #204 | Documented that #180's coverage cost cannot be removed without reopening the forgery it closed. |

### Security, CSP and lead egress

| PR | Outcome |
|---|---|
| #16 | Dropped `calendar.google.com` from `frame-src`. |
| #71 | Validate how-held on read; escape the hold fallback in the MP tracker. |
| #76 | Coerce ids and prior-year counts to numbers on every read path. |
| #100 | Coerce or escape restored state on every tool read path and sink. |
| #128 | Closed the four High CodeQL alerts in the client-facing calculators. |
| #148 | Documented the apex origin, Cloud Run enumeration, and the impersonated credential that hid a project. |
| #193 | `/upsert-lead` now has to acknowledge the write, and the last hand-rolled lead caller is routed. |
| #205 | gcloud service-account identity audit; the 1-of-7 project blindness resolved. |

### Members, marketing and the four levels

| PR | Outcome |
|---|---|
| #9 | Intercept MEMBERS tier links with a portal gate modal. |
| #10 | Restyled the MEMBERS gate to the approved light Donovan card. |
| #32 | Added the missing Diamond tier to the MEMBERS dropdown. |
| #35 | Crypto Position Memo tool for Diamond and Reserve. |
| #36 | Member tool tree hygiene. |
| #37 | Re-skinned the MEMBERS gate to the paper/green brand. |
| #43 | `engagement.html` becomes the canonical membership page. |
| #45 | Retired the root `about-membership.html`. |
| #135 | Published four public tier marketing pages; the gate untouched. |
| #191 | The four engagement levels now gate on **Clio**, not on a shared password. |
| #192 | The header logo was a fifth of its size on the member portals; the intake modal could be closed straight onto the booking calendar. |
| #218 | Retired the "Coming Soon" `login.html` orphan (both URL spellings 301 to `/engagement`) and gave a member a way to sign out, on all 39 tier pages. |

### Site, SEO and content

| PR | Outcome |
|---|---|
| #1 | The build: Perch voice concierge, returning-caller memory, and the site rebuild. |
| #4 | Bolded key phrases in the FL §934.03 consent modal — presentation only, wording unchanged. |
| #6 | Escaped `tel:`/`mailto:` clicks to the top browsing context. |
| #7 | Removed all voice prompting from the code and guarded the tree. |
| #8 | Repointed Deal-Economics tiles off the gated `/reserve/` path. |
| #11 | Removed the citizenship step from the `/perch` qualifier funnel. |
| #17 | Rebuilt `sitemap.xml` with full indexable coverage and git-derived `lastmod`. |
| #18 | Added LegalService local signals. |
| #19 | Canonicalised the disclaimer to the correctly spelled URL. |
| #40 | Regenerated the sitemap on current main. |
| #69 | JS-off crawlability gate in the root test suite. |
| #73 | 301'd the 8 extensionless twins and de-listed the 9 dead sitemap entries. |
| #121 | Corrected the stale phone number in the tax-tool print footer. |
| #197 | Tax controversy section — 15 pages, 12 diagrams, book and roadmap copy edits, sitemap. |
| #199 | Trimmed every over-length page title and meta description across the 84 sitemap pages. |
| #202 | Measured WCAG 2 AA across all 84 sitemap pages. |
| #213 | Re-valued the theme colours so brand text clears AA, and painted a real focus ring on the contact form. |
| #216 | Live production WCAG 2 AA sweep of all 98 sitemap URLs post-#213 — measurement only, no site source touched. |
| #217 | The contact form stops posting to a dead Formspree endpoint and routes the inquiry into Clio Grow and Clio Manage. |

### CI, tooling and process

| PR | Outcome |
|---|---|
| #5 | Agent-verdict bot-review machinery — ends the self-approval deadlock. |
| #84 | A4.1 cutover QA re-run; promote verdict GO. |
| #90 | A4.2 post-promote production smoke; verdict HEALTHY. |
| #96 | Paula action-key reconciliation: tail command, live-call runbook, gap table. |
| #126 | Pull-request branch filter widened to `**`. |
| #136 | Paul's content lane: `@claude` → PR → preview → David merges. |
| #141 | Adjudicated all 17 branches, with verdicts and a bounded delete list. |
| #149 | A documentation mismatch is not a reason to hold a deploy — hygiene moved to `ci.yml` only. |
| #161 | The chrome-diff gate for Paul's content lane. |
| #164 | Read the F-10 baseline from a committed fixture, not the network. |
| #210 | `fetch-depth: 0` on the deploy workflow's checkout. |
| #211 | Scoped chrome-diff page-structure to metadata text and reviewed structural pages. |
| #215 | README and this AS-BUILT written from the code on `main`; documentation-only. |
| #81 | Zane session handoff — Perch retrofit state, doctrine, board, path to live. |

---

### Since the previous revision (#219–#246)

Merged between the previous revision of this document and 2026-08-11.

| PR | Outcome |
|---|---|
| #219 | Documented the contact route (#217), the login retirement (#218) and the final a11y state (#216). |
| #220 | Cleared the reachable WCAG AA contrast debt across 134 pages; structural waiver requested for the rest (#195). |
| #221 | Applied the Level A/AA attribute and inline-colour fixes under the reviewed structural waiver (#195). |
| #228 | "Free" in the booking CTA, and the Florida Bar office-city line in the footer (SHELDON-PAUL-CHROME). |
| #229 | Paul's content batch — homepage testimonial and disclaimers, conversion blocks on 21 pages, library cross-links on the tax pages. |
| #230 | Mobile portrait diagrams for the 15 tax-controversy pages (#226 part A). |
| #231 | One site navigation served from the edge, retiring the three forked copies (closes #227). |
| #232 | Marketing-tracking delivery plan — four PRs in sequence (the health loop). |
| #233 | The tax-controversy arc on phones, and the corrected collection art. |
| #234 | The analytics instrumentation module, dormant until the CSP change — catalogue, tracker, no vendor tag loaded. |
| #235 | Corrected two claims in the tracking plan (PR D was half-built; PR C was less blocked than stated). |
| #236 | Turned tracking on behind `ANALYTICS` — CSP hosts, edge injection, and the one-line qualifier signal. |
| #237 | The consent banner and Consent Mode v2 — nothing tracks before the answer. |
| #238 | Attribution carried across the visit, and a value on a booking. |
| #239 | The fifteen controversy pages nested under a CONTROVERSY flyout in the TAX menu (SHELDON-NAV-R2). |
| #240 | Added `marketing/` — decisions, open questions, and the keyword lists. |
| #241 | Froze the analytics-OFF CSP as a literal snapshot, so the flag cannot widen the policy unnoticed (gate note on #236). |
| #242 | Removed the duplicate call-to-action block from six tool pages (JORDAN-TOOL-DEDUPE). |
| #243 | Local SEO — canonical NAP, the citations contradicting it, and profile ownership. |
| #244 | Server-side conversion reporting to Meta, and the real tier value on a booking. Fixed the tier being derived and never delivered. |
| #245 | Tag IDs became per-deployment configuration; `message_taken` and `tel_click` started counting. |
| #246 | SEO batch 1 — social preview tags at the edge, one-hop redirects, AI crawl policy. |

---

## Residuals

### Open and tracked (GitHub issues on `TicoAI/DonovanLegal`)

| # | Item |
|---|---|
| 112 | **[Perch v2] Phase 2 — the 2-lane aware journey (REBUILD)** — tracker. |
| 116 | [Perch v2] Two front doors + tap-to-yield lane control. |
| 117 | [Perch v2] Clone Paula → v2 agent + cursor-aware prompt. |
| 118 | [Perch v2] Parallel run + verification — gates the cutover. |
| 122 | [Perch v2] Fail closed on the production Retell agent in lab builds (webhook bypass). |
| 142 | [OPS] The work lifecycle — Issue → Order → PR → Gate → Merge → Deploy — tracker. |
| 145 | [SECURITY] gcloud on the workstation silently impersonates a service account that sees 1 project of 7. |
| 146 | The apex `donovan.law` serves dead indexed links, and a public-but-dead Cloud Run service still holds an `allUsers` binding. |
| 147 | [SECURITY] `main` can be self-merged: required reviews is 0, and PRs are authored by the account that would approve them. |
| 151 | Lead call sites / `/upsert-lead` fail-closed — the code arms landed in #166 and #193; the issue remains open. |
| 195 | Accessibility: homepage AA contrast + unmeasured pages — measured in #202, re-valued in #213, **re-measured live in #216**; issue remains **open** on 1130 residual failing nodes across 98 pages, of which 1033 are `color-contrast` and 803 of those are old brand hex written into the delivered HTML where no stylesheet can reach it ([§9](#9-accessibility--the-measured-state)). |
| 201 | **Callmap coverage fast-follow** — restore post-call enrichment for legitimate qualifier-skip voice callers, *only* if it does not reopen #180's closes. See #204. |
| 206 | [SECURITY] Remove dead `allUsers`→`run.invoker` bindings on retired Cloud Run services. |
| 207 | [SECURITY] Triage the 14 LIVE + 1 DEGRADED public Cloud Run bindings. |
| 208 | [SECURITY] Obtain audit/read access to `ad-retriever` and `platinum-bivouac`. |
| 209 | [OPS] Extend the GCP audit to Pub/Sub, Secret Manager, Artifact Registry, BigQuery, Compute. |

**Closed since the previous revision of this document.** #196 (the "Coming Soon" login
orphan and the missing sign-out control) closed with PR **#218** —
[§7](#7-the-members-area--tier-gating-on-clio). #214 (the contact form posting to an
unverified third-party endpoint that did not deliver) closed with PR **#217** —
[§3.4](#34-the-contact-inquiry-write-path--post-fncontact). Both are recorded here rather
than deleted, because a residual list that quietly loses entries cannot be diffed.

### Parked in the code, with the reason on the rule

| Item | Where | State |
|---|---|---|
| **Soft router off in production** | `perch-router-inject.js:74` | Default is Preview + localhost. Turning production on is a deliberate decision by whoever owns the shell retirement; the frame-header lock and the `/` shell retirement ride the same flag. |
| **`style-src 'unsafe-inline'`** | `_middleware.js:32-37`, `134` | Tracked follow-up. 1706 `style="…"` attributes across 145 files would each need a hash or a class refactor; the exposure is CSS injection, not script execution. |
| **GA4 `page_view`** | `reinit.js:644-688` | Documented stub. Blocked on an external `G-` measurement id created under a firm Google account. The wiring steps are written down in the function so they are not re-derived. |
| **Booking availability race** | `create.js:421-452` | Narrowed, not closed — Clio exposes no conditional-create. A hard guarantee needs provider-side support. |
| **KV rate limiter is eventually consistent** | `abuse.js:100-121` | Cost-control and casual-abuse layer, not a hard concurrency bound. A strongly-consistent limiter needs a Durable Object, which is an ops change on the separately-deployed `perch-do`. |
| **Six routes excluded from soft navigation** | `swap-policy.js:104-144` | The 1031, rental, STR, entity-formation, FIRPTA and engagement-scoping pages bind at load time. Removing an entry is a real work item — give the module a `DL.ready` init first — not a cleanup. |
| **13 chrome-less pages hard-navigate** | `swap-policy.js:345-369` | 404, the eight controversy-roadmap posts, blog-bramblett and three tool teasers render with no site nav today, so this is zero regression. |
| **`consent-gate.css` on the pre-re-value green** | `css/consent-gate.css`, pinned by `test/dom.test.mjs:543` | `#169b62` retained deliberately; updating a test was out of scope for a CSS-only change. |
| **`tier-auth.js` retained but unused** | `functions/_lib/tier-auth.js` | Superseded by `memberGuard` (#191). Still required by the deploy tree-integrity guard and still pinned fail-closed by the suite. |
| **`nav-block.html`** | `donovan-legal-site/nav-block.html` | Referenced by zero pages and stale. Excluded from the router. Never paste it into anything. |
| **`src/`, `infra/`, `Dockerfile`, `cloudbuild.yaml`** | repo root | Abandoned nginx-on-Cloud-Run artifacts. Nothing deploys to GCP. Deleting them is a separate call. |
| **The forked nav** | 96 files | The nav markup is copy-pasted and has already diverged — `contracts.html` shows an older menu than `tax-controversy.html`, and both pass CI. Nav changes are a single coordinated pass, never a one-page edit. |
| **`_redirects` conflicts left disabled** | `donovan-legal-site/_redirects` | Several rules are commented out pending a canonical-structure decision (the tax cluster, `business-law.html`, `equitable2.html`, `businesslaw.html`). The `login.html` rule is **no longer one of them** — PR #218 deleted the page and enabled both spellings to `/engagement`. |
| **Asset cache versioning** | `_headers` | `/css` and `/js` are `no-cache` during active development. Before go-live, version the filenames (`main.[hash].css`) and restore immutable caching. |
