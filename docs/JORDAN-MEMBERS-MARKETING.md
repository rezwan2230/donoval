# JORDAN-MEMBERS-MARKETING — public tier marketing pages (Ticket B)

**Persona:** Jordan (frontend)
**Order:** JORDAN-MEMBERS-MARKETING
**Tracker:** 102 — Clio for Clients migration
**Sequenced before:** Ticket C / 105 (un-gate the tier roots)
**Branch:** `jordan/members-marketing`

---

## 1. What this ticket delivers

Four public, indexable marketing pages — one per membership level — written in the
firm's voice from the framing in `Donovan_Legal_KB.md`, section
`` `[ALL]` Membership levels (Gold / Platinum / Diamond / Reserve) ``.

| Tier | New public page | KB tagline (verbatim) |
|---|---|---|
| Gold | `/membership-gold` | The Playbook for Your First Move Into Real Estate |
| Platinum | `/membership-platinum` | Your Portfolio Deserves More Than a Generalist |
| Diamond | `/membership-diamond` | Built for the Real Estate Professional |
| Reserve | `/membership-reserve` | Counsel That Operates at Your Level |

Each page carries the standard site chrome (desktop nav, mobile overlay nav,
connect strip, copyright, disclaimer link, script tags), is indexable
(no `meta robots`, self-canonical, listed in `sitemap.xml`), and ends in a
call to action — Gold / Platinum / Diamond → `book.html` ("Book a Consultation");
Reserve → `contact.html` ("Contact the Firm"), because Reserve is by application.

The chrome is lifted byte-for-byte out of `engagement.html`, so the nav and
footer regions of all four pages hash identically to the canonical membership
page. Only `<title>` / description / og / canonical and the content region differ.

## 2. What this ticket does NOT do — the exposure constraint

**The gate is untouched.** `functions/_lib/tier-auth.js` and the four
`functions/<tier>/_middleware.js` files are not modified, and no secret is
touched. `/gold/`, `/platinum/`, `/diamond/`, and `/reserve/` continue to serve
HTTP Basic auth exactly as they do on `main`, and continue to fail closed
(503) when a tier's credentials are unset.

The new marketing content lives at **new public paths** (`/membership-<tier>`),
not at the gated tier roots. That is the whole point of the path choice: there is
no moment at which the private member-portal content under `/<tier>/*` becomes
publicly reachable, because nothing about how `/<tier>/*` is served changes in
this PR. Publishing the marketing pages and un-gating the portals are two
independent events, and only the first one happens here.

The MEMBERS nav dropdown still points at the gated tier roots. That is
deliberate — repointing it is a member-facing change that belongs with the
member cutover, not with a marketing publish. Members keep their existing route
into the portal throughout.

No fee value, price, or rate appears on any of the four pages. Where the subject
is unavoidable the pages say only that engagement terms are set in a confidential
consultation and documented in an engagement letter, consistent with the KB
instruction *"fees are discussed during a confidential consultation — do not
quote prices."* No client-specific, privileged, or matter-specific material
appears on any page; the member workspace is described in general terms only.

## 3. How the un-gate coordinates with Ticket C / 105

105 owns the un-gate. It must not start until the member cutover under tracker
102 has completed — i.e. until members are working out of Clio for Clients and no
longer depend on `/<tier>/*`. The ordering constraint inside 105 is that **the
private files leave the tier prefix before the gate does.** Concretely:

1. **(102) Member cutover completes.** Members are on Clio for Clients. Confirm
   no remaining traffic to `/<tier>/*` from member identities before proceeding.
2. **(105) Remove the private content from under the tier prefix** — the member
   portal `index.html`, the tier tools, and the `SAMPLE_*` documents under
   `gold/`, `platinum/`, `diamond/`, `reserve/`. While this step runs the gate is
   still in place, so nothing is exposed mid-flight.
3. **(105) Move the marketing pages into the tier roots.** `membership-<tier>.html`
   → `<tier>/index.html`, fixing the relative asset paths (`css/` → `../css/`)
   and the canonical to `https://www.donovan.law/<tier>/`.
4. **(105) Remove the gate last** — delete the four
   `functions/<tier>/_middleware.js` files. `functions/_lib/tier-auth.js` may
   stay in tree as the reusable guard, or be removed once nothing imports it;
   either way it is 105's call, not this ticket's.
5. **(105) SEO cleanup.** Add `/membership-<tier> → /<tier>/ 301` to `_redirects`,
   repoint the four `sitemap.xml` entries and the four `.tier-learn` links on
   `engagement.html`, and repoint the MEMBERS nav dropdown (which by then leads to
   public pages rather than a login prompt).

If 105 is ever run in the other order — gate off before the private files move —
the tier roots serve the member portal publicly for the length of that window.
Steps 2 and 4 are not interchangeable.

**Rollback for this PR** is a file delete: removing the four
`membership-*.html` pages, the four `sitemap.xml` lines, the four `.tier-learn`
links, and the `.tier-learn` CSS block returns the site to its current state. No
gate, auth, or secret state has to be restored, because none was changed.

## 4. Verification

`test/members-marketing.test.mjs` ships with this PR and runs in the standard
suite:

```
npm test                                       # 1194 pass / 0 fail / 1 skipped
node --test test/members-marketing.test.mjs    #   72 pass / 0 fail
```

It asserts on the **parsed DOM**, not on source spelling, for each of the four
pages:

- exactly one `<h1>`
- the 8-item desktop nav renders in order, and the mobile overlay is present
- footer connect strip, copyright, and disclaimer link are present
- no `meta robots` (indexable), and the canonical matches the published URL
- the KB tagline renders verbatim in `.tier-tagline`
- exactly one CTA-band link, to `book.html` or `contact.html`
- **no currency symbol and no fee value** in the rendered text
- **no privileged / member-portal strings** in the rendered text
- no link into `/<tier>/*` outside the shared nav chrome
- the page loads `js/main.js`, so the MEMBERS dropdown's tier anchors are
  intercepted by `js/members-gate.js` rather than answering a bare 503
  (the tree rule pinned by `members-gate.test.mjs`)

On the gate itself the tests **run** each middleware rather than reading it —
a middleware can spell the right import and still let the request through. For
all four tiers:

- unset credentials → **503**, and `next()` is never called (fails closed)
- no `Authorization` → **401** with a `Basic realm=` challenge, `next()` never called
- wrong credentials → **401**, `next()` never called
- **correct credentials → 200**, `next()` called, `Cache-Control: private, no-store`
  — the positive arm, without which "refuses everyone" would also pass
- one tier's credentials do **not** open another tier

Plus: each `/<tier>/index.html` is still `noindex`, and the sitemap lists the
four marketing URLs and none of the gated roots.

### The suite was proved non-vacuous against deliberately broken controls

**Control 1 — content defects.** With `$12,500 per year` injected into Gold,
"Privileged & Confidential — For the Named Member" injected into Platinum,
Diamond made `noindex`, Reserve's KB tagline reworded and given a `reserve/`
link outside the nav, `functions/gold/_middleware.js` rewritten to `c.next()`,
and the Diamond sitemap entry swapped for `/diamond/`, the run failed 8 tests —
one per injected defect:

```
not ok - publishes no fee value                                    [gold]
not ok - publishes no privileged or member-portal content          [platinum]
not ok - is indexable and self-canonical                           [diamond]
not ok - renders the KB tagline verbatim                           [reserve]
not ok - adds no link into the gated tier roots outside the nav    [reserve]
not ok - functions/gold/_middleware.js still delegates to tierGuard
not ok - sitemap.xml lists all four marketing pages, extensionless
not ok - sitemap.xml lists none of the gated tier roots
```

**Control 2 — a gate disabled while still spelling `tierGuard`.** This is the
control that matters most, because it is the shape a careless Ticket C edit
would take. `functions/gold/_middleware.js` was rewritten to keep the
`tier-auth.js` import and a `tierGuard("gold")` call, but export
`async (context) => context.next()`:

```
ok     - functions/gold/_middleware.js still delegates to tierGuard   <-- source-shape test PASSES
not ok - /gold/ still fails CLOSED (503) when credentials are unset
not ok - /gold/ still challenges (401) an unauthenticated request
not ok - /gold/ still rejects (401) wrong credentials
not ok - /gold/ still serves the member content to correct credentials
not ok - /platinum/ credentials do not open a different tier
not ok - /diamond/ credentials do not open a different tier
not ok - /reserve/ credentials do not open a different tier
```

The source-shape assertion passed on a fully disabled gate. Only the
behavioural arm caught it.

The tree was restored after each control and the full suite re-run clean.

### Fee sweep over the diff

Scanned character-accurately (a byte-oriented `grep '[$£€¥]'` matches em-dash
bytes and reports false hits — the four pages are full of em dashes):

| Scan, over the four pages | Result |
|---|---|
| currency characters (`$ £ € ¥ ₹ ¢`) in page source | **0** |
| currency characters in the 1,780 added diff lines | **0** |
| money-shaped numbers (`1,250` · `12.5k` · `N dollars/USD/per year`) | **0** |
| words `fee` / `fees` / `price` / `prices` / `retainer` / `rate` | **0** |

The only fee-family words that appear at all are `cost` — exclusively in the
technical term "cost segregation" — and `pricing`, in one sentence per page:

> Each level is individually scoped. Engagement terms are set in a confidential
> consultation and documented in a written engagement letter; the firm does not
> publish or quote pricing.

That is the KB's own instruction rendered as page copy, not a fee value.

### Files touched

```
docs/JORDAN-MEMBERS-MARKETING.md
donovan-legal-site/css/main.css               (+ .tier-learn, 18 lines)
donovan-legal-site/engagement.html            (+ 4 card links)
donovan-legal-site/membership-diamond.html    (new)
donovan-legal-site/membership-gold.html       (new)
donovan-legal-site/membership-platinum.html   (new)
donovan-legal-site/membership-reserve.html    (new)
donovan-legal-site/sitemap.xml                (+ 4 URLs)
test/members-marketing.test.mjs               (new)
```

`git diff --name-only origin/main` shows **0** changes to
`functions/_lib/tier-auth.js`, **0** to any `functions/<tier>/_middleware.js`,
**0** to any secret or credential, and **0** files under `.github/`.
