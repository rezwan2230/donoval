# Marketing Tracking — delivery plan ("the health loop")

**To:** David Pierce Sr. + the DonovanLegal build team
**From:** Elroy Geerdink (built by Jay, Atrium CoS)
**Date:** 2026-08-10
**Status:** Agreed to build. This document is **what Jay will build, in what order, and where it does not touch your work.**

> **v2 change:** the first version of this document was a spec for your team to
> implement. David asked whether Jay could build it instead. He can — so this is now
> a delivery plan with a PR sequence, collision analysis, and explicit dependencies.
> Everything still merges through your review. Nothing goes to `main` directly.

---

## Phase 1 — AS BUILT (2026-08-10)

Everything below is written and tested. **Nothing is merged, nothing is deployed,
and nothing is switched on.** Four PRs, stacked, in review order.

### The PRs

- **[#234](https://github.com/TicoAI/DonovanLegal/pull/234)** — the instrumentation module. New files only, edits nothing.
- **[#236](https://github.com/TicoAI/DonovanLegal/pull/236)** — CSP hosts, edge injection, the qualifier signal. Behind a flag.
- **[#237](https://github.com/TicoAI/DonovanLegal/pull/237)** — consent banner, Consent Mode v2, the `/disclaimer` disclosure and the opt-out control.
- **[#235](https://github.com/TicoAI/DonovanLegal/pull/235)** — this document.
- ~~#232~~ — the plan. Merged.

**Test suite: 2501 pass, 0 fail, 3 skipped.** 90 tests added across the four.

### What it does, once switched on

- Reports **GA4 page views** correctly across Swup navigation — the router announces every swap and the tracker listens, so a three-page visit reports three page views rather than one
- Fires the **four Google Ads conversions** already configured in the account: `booking_confirmed` (primary), `qualifier_submitted`, `call_started`, `message_taken` (all secondary)
- Fires the equivalent **Meta events** — `Schedule`, `Lead`, `Contact`, `SubmitApplication`
- Carries `gclid`, `fbclid` and all five `utm_*` on every event, and an `event_id` so the server-side copy in Phase C deduplicates rather than double-counts
- Asks for consent first, and does not track until answered

### What it deliberately does NOT do

- **Nothing runs until `ANALYTICS=on`.** With the flag unset the emitted CSP is byte-identical to today's and no tag is injected — merging and deploying are both no-ops. Asserted by test.
- **Meta's pixel is not loaded before an accept.** Google loads under Consent Mode v2 with everything denied — no cookies, no identifiers, only cookieless pings it can model from. Meta has no such mode, so it is simply not fetched.
- **No HTML page was touched except `disclaimer.html`**, and that one carries a reviewed structural waiver with measured evidence.

### Design decisions a reviewer should know

- **Three of the four conversions needed no edit to any existing module.** `vantage:call-start`, the `__perchBooking` postMessage and the router's swap events already announce themselves. Only the qualifier had no signal, and got one dispatch.
- **The tag is injected at the edge**, following `nav-inject.js`. Every page gets it — including any page Paul adds later, with no upkeep and nobody to remember.
- **It composes into `headTags`, not its own `['head', …]` handler** — lol-html keeps only the last `onEndTag` per element, so a second head handler would have silently deleted the layer's tags. The end-to-end test drives the real lol-html engine and asserts every pre-existing head tag survives.
- **Page views are fired manually** (`send_page_view: false` on both streams). gtag's automatic page view fires once per document and never again under client-side routing; Meta's pixel has no routing awareness at all. Both failures are silent.
- **The consent default is published before `js`, before `config`, before the loader.** gtag applies the FIRST default it sees — published later it is silently too late and the first hit of every session goes out with storage granted.
- **No `frame-src` host was added.** Conversion pings go over fetch and image, already covered. Only remarketing needs `td.doubleclick.net` framed, and this site does not run it.

### Two guards that caught real defects during the build

- A test caught that the **initial page view bypassed the error wrapper** — an ad blocker leaving a throwing stub would have propagated into the booking page. Every vendor call is now wrapped.
- **`chrome-diff` refused the `disclaimer.html` edit**, correctly. Rather than routing around it, `scripts/content/consent-waiver-evidence.mjs` measures the claim against the real `planFromHtml` and the real injector: six elements added, **no `<div>` among them**, plan identical integer for integer (wrap-div, open 31, close 39), nav and footer subtrees byte-identical.

### To switch on, in order

1. Merge #234 → #236 → #237 (and #235)
2. **Deploy with the flag unset — verify nothing changed.** This is the step that proves the inert claim on the real site, and it is the one worth not skipping
3. Paul approves the `/disclaimer` wording
4. Elroy adds Cloudflare Pages **Secret** `ANALYTICS` = `on` *(it must be a Secret — `wrangler.jsonc` governs this project so the dashboard offers nothing else)*
5. Redeploy — Pages requires it for an environment change to take effect
6. Verify: `curl -s https://www.donovan.law/ | grep analytics.js`, then Tag Assistant, then navigate `/` → `/real-estate` → `/book` expecting **3** page views
7. The four Google Ads conversion actions flip **Inactive → Recording** within 24h of real traffic

Rollback at any point: delete the variable, redeploy.

### Still owed by others

- **Paul** — approve the `/disclaimer` wording
- **Meta BM admin** — Events Manager access, domain verification, AEM priority, and reducing the system user from Admin to Employee
- **Elroy** — four Import-source conversion actions, and the tier value bands with Paul

---

## 0. TL;DR

Nothing on donovan.law reports to Google or Meta today. Four Google Ads conversion
actions exist and all four read **Inactive** — there is no tag to fire them, and the
CSP would block one if there were.

You can have a thousand-page website and it is worth nothing if nobody arrives, and
worth almost as little if you cannot tell whether anyone did. This is how we find out.

**Four PRs, in dependency order:**

| PR | What | Depends on | Effort |
|---|---|---|---|
| **A** | Instrumentation module — new files only | nothing | ~1 day |
| **B** | CSP hosts + edge tag injection | **#231 merged** | ~½ day |
| **C-Google** | Offline conversion import — Clio booking + tier value → Google Ads | **nothing** | ~3 days |
| **C-Meta** | Conversions API → Meta | Events Manager access | ~3 days |
| **D** | Upkeep guardrails — *half already exist in CI* | B / campaigns | ~½ day |

**A can start and merge immediately.** It touches no file any open PR touches.

---

## 1. Why — the loop in one picture

```
   Ad click ────────> donovan.law ───> Paula ───> qualifier ───> Clio booking
      │                                                              │
      │  Google attaches a "gclid" to the click                      │
      │  Meta attaches an "fbclid"                                   │
      │  Vantage perch.js ALREADY captures both  ✅                  │
      │                                                              │
      └──────────── we tell Google / Meta ───────────────────────────┘
                    "that click became a booking"
                                  │
                                  ▼
                 their algorithms go find more people like that
```

Without the return arrow there is no feedback. The ad platforms optimise toward
**clicks**, because clicks are all they can see — and clicks are not the business.

**The hard half already exists.** `perch.js` captures `gclid`, `fbclid` and all five
`utm_*` parameters today (verified live). Most firms can only measure "a form was
submitted." Donovan can measure *conversation → qualified → tier derived →
consultation booked in Clio*. The wire just isn't connected at either end.

---

## 2. Current state — verified 2026-08-10

### Site

| Check | Result |
|---|---|
| `www.donovan.law` serving the Cloudflare build | ✅ |
| `robots.txt` / `sitemap.xml` on www | ✅ 200 / 200, 98 URLs |
| `donovan.law` → `www` | ✅ 301 on `/` — ⚠️ subpaths don't redirect (`donovan.law/robots.txt` 404s) |
| Swup client-side router | ✅ live |
| GA4 / Google Ads tag / Meta Pixel | ❌ **none, on any page checked** |
| Consent banner | ❌ none |
| CSP permits Google or Meta hosts | ❌ **actively blocked** |

Scanned `/`, `/book`, `/contact`, `/real-estate`, `/tax-controversy`.

### Google Ads (`975-339-9396`) — already configured by Elroy, no action needed

| Action | Source | Tracking | Optimization | Count | Window |
|---|---|---|---|---|---|
| `booking_confirmed` | Website | Inactive | **Primary** | One | 90 days |
| `qualifier_submitted` | Website | Inactive | Secondary | One | 90 days |
| `call_started` | Website | Inactive | Secondary | One | 90 days |
| `message_taken` | Website | Inactive | Secondary | One | 90 days |

Only `booking_confirmed` drives bidding, deliberately — so the algorithm chases booked
consultations rather than cheap, abundant call-starts.

**"Inactive" is your progress bar.** These flip to "Recording conversions" within 24h
of PR B reaching production, without anyone having to ask.

### Meta

| Check | Result |
|---|---|
| Dataset `Donovan Legal - Leads` | ✅ `1769060274465061` |
| `META_CAPI_TOKEN` vaulted | ✅ Cloudflare Pages secret, **Production only** (deliberate — keeps test traffic out of the live dataset) |
| System user `Donovan API` | ⚠️ Admin + full access to all pixels/datasets — over-privileged for CAPI |
| `donovan.law` verified with Meta | ❌ no `facebook-domain-verification` TXT record |
| Events Manager access | ❌ **Elroy has none** — blocks Phase C QA |

---

## 3. Collision analysis — what we checked before agreeing to build

Two open PRs at time of writing:

| PR | Branch | Files | Overlap |
|---|---|---|---|
| **#233** Jordan — mobile tax-controversy arc | `jordan/mobile-golive` | 16 content HTML pages + 1 SVG | ✅ **none** |
| **#231** Sheldon — one site nav from the edge | `sheldon/paul-nav-227` | `functions/_middleware.js`, `_lib/nav-inject.js`, nav CSS, tests | 🔴 **direct** |

**#231 touches `functions/_middleware.js`, which is where `buildCsp()` lives.** That is
exactly the file PR B needs. We will not go near it while Sheldon is in there.

**But #231 is also the right delivery mechanism, not merely an obstacle.** Its
`nav-inject.js` uses HTMLRewriter handlers in the edge middleware to inject markup
into every page. That is precisely how the analytics tag should be delivered:
injected once at the edge instead of pasted into ~98 static HTML files.

So #231 makes this job **smaller**. Worth landing first on the merits.

We will watch #231's state directly rather than asking anyone to notify us.

---

## 4. The delivery sequence

### PR A — instrumentation module · *no dependencies, can merge any time*

New files only. Zero shared surface with #231 or #233.

- `donovan-legal-site/js/analytics.js` — GA4 + Google Ads configuration, `send_page_view: false` on both (page views are fired manually so the SPA reports correctly)
- Swup route-change bridge — subscribes to the router's **existing** announce events rather than adding a competing listener:
  - `perch:content-swapped` — `js/perch/placement.js:29`
  - `dl:content-swapped` — `js/perch/swap-policy.js:44`

  `announce()` dispatches one or the other depending on phase, so we subscribe to both and guard against double-fire by comparing the last reported URL. The router's own comments document a deliberate one-time double run on first arrival of a page type; the guard covers that too.
- Meta Pixel base for dataset `1769060274465061`, `PageView` suppressed from the snippet (the bridge owns it)
- **Every event carries an `event_id`** (UUID) from day one, so PR C's CAPI deduplication works without re-touching every call site
- Event wiring for the four conversions (§6)
- Unit tests

**Three of the four conversions cost no edit to any existing module** — they
already announce themselves (`vantage:call-start`, the `__perchBooking`
postMessage, the router's swap events). Only the qualifier has no signal, and
its one-line dispatch is deliberately held for PR B rather than smuggled into A,
so "new files only" stays literally true.

**Shipped as [#234](https://github.com/TicoAI/DonovanLegal/pull/234)** — 43 new
tests, full suite green (2404 pass, 0 fail).

**Why the route-change bridge is not optional:** Meta's pixel has no SPA awareness at
all — without it, one PageView per session, forever. GA4 can partially infer
`pushState` but fires before the new title settles, corrupting landing-page reports.
Both failures are silent.

**Nothing in PR A executes until PR B lands** (the CSP still blocks it). That is
intentional — it means A is safe to merge early and carries no risk to production.

---

### PR B — CSP hosts + edge tag injection · *depends on #231 merged*

Small: six hosts and one injection handler.

`buildCsp()` in `functions/_middleware.js`:

| Directive | Add |
|---|---|
| `script-src` | `https://www.googletagmanager.com` `https://connect.facebook.net` |
| `connect-src` | `https://*.google-analytics.com` `https://*.analytics.google.com` `https://www.googletagmanager.com` `https://googleads.g.doubleclick.net` `https://www.google.com` `https://*.facebook.com` |
| `frame-src` | `https://td.doubleclick.net` `https://www.googletagmanager.com` *(only if remarketing is used)* |
| `img-src` | no change — already `https:` |

Plus an HTMLRewriter handler following #231's `nav-inject.js` pattern, so the tag
reaches every page including any Paul adds later.

Also in PR B, because each one needs a `js/` or `test/` change that only makes
sense once the tag is actually loading:

- the one-line `dl:qualifier-submitted` dispatch in `js/perch/qualifier.js`, matching the shape of the `vantage:call-start` dispatch two modules already use
- **`test/chrome-diff.test.mjs`**, which asserts the exact head tags on every page. CLAUDE.md §3.8 warns that a new `<script src>` breaks the router's allow-list completeness check — so the injected tag has to be declared there or CI reds. **That file is also in #231's change set**, which is the second independent reason B waits.

**We will not add a second CSP to `_headers`** — that file says so explicitly and it
is right. One owner, in the middleware.

**We will update the existing CSP invariant test** in `ci.yml` rather than work around
it. Extending it to assert the analytics hosts means a future edit cannot silently
drop tracking.

**Nonce:** not an obstacle. The middleware's HTMLRewriter already stamps the
per-request nonce onto inline scripts, and `gtag.js` propagates its nonce to scripts
it injects.

> ⚠️ **Known risk:** Meta's `fbevents.js` handles nonce propagation less reliably than
> Google's tag. If the pixel fights the CSP, **we will not weaken the CSP to
> accommodate it** — we will drop the browser pixel and rely on PR C's server-side
> CAPI, which is the better architecture anyway. Decision will be recorded here.

**Acceptance**
- [ ] Tag Assistant shows GA4 + Ads firing on `/`
- [ ] `/` → `/real-estate` → `/book` produces **3** GA4 `page_view` and **3** Meta `PageView` — not 1
- [ ] No CSP violations in console on any page
- [ ] Turnstile, Perch widget, Paula voice and booking flow all still work
- [ ] All four Ads conversion actions flip Inactive → Recording within 24h of real traffic

---

### The switch — where it lives and when to throw it

**Shipped as [#236](https://github.com/TicoAI/DonovanLegal/pull/236).** Merging it
and deploying it change nothing observable: with the flag unset the emitted CSP is
byte-identical to today's and no tag is injected.

**Where:** Cloudflare dashboard → **Workers & Pages** → `donovan-site` →
**Settings** → **Variables and secrets** → **Add**, on the **Production**
environment. Name `ANALYTICS`, value `on`.

Three operational notes:

- **It must be a Secret, not a plain text variable** — the dashboard greys the type out. `donovan-legal-site/wrangler.jsonc` governs this project and declares no `vars` block, so Cloudflare will only accept dashboard-managed *Secrets*. That is exactly why `PERCH_ROUTER` is a Secret too, and `env.ANALYTICS` reads identically either way. The alternative — a `vars` block in `wrangler.jsonc` — would make the value visible in the repo but turn every flip into a PR, which is the wrong trade for a switch meant to be thrown independently of releases.
- **Because a Secret's value is hidden after saving, the dashboard cannot answer "is tracking on?"** Ask the live site instead, which is the better question anyway — it reports what is deployed rather than what is configured:
  `curl -s https://www.donovan.law/ | grep analytics.js` — a hit means on.
- **Cloudflare Pages requires a redeploy for an environment change to take effect.** Retrying the latest deployment is enough — no commit, no PR. Cheap, but not instant.

Rollback is the same path in reverse: delete the variable, redeploy.

> ⚠️ **Do not set this before #236 is deployed and the consent decision is made.**
> The variable is read at request time, so setting it early arms the switch: the
> moment #236 reaches production, tracking is live — with no banner and nobody
> having decided it should be. Set it as a deliberate, separate step, after.

#### Switch on BEFORE any ad spend — deliberately

The instinct is to wait until campaigns are ready. That is backwards, for three
reasons:

1. **Audiences need time to accumulate.** Meta and Google build remarketing audiences out of visitors they have already seen. A Google search remarketing list does not function below ~100 users. Switch on now and there is something to target on day one; switch on with the campaigns and there is not.
2. **You get a baseline.** Knowing what organic traffic does gives paid something to be compared against. Without it, the first month of ads has no reference point and every number is unfalsifiable.
3. **Bugs surface on free traffic.** Far better to find a mis-wired event across 200 organic visitors than across €3,000 of clicks — and tracking bugs are silent by nature, so they are found by looking, not by breaking.

**One precondition, and it is not technical:** the consent decision (§ PR B 1.6).
Tracking on a law firm's site with no banner is the pixel-litigation exposure
noted there. That is Paul's call, and it should be settled before the switch, not
after.

Cost is not a reason to wait — GA4, Google Ads conversion tracking, the Meta
pixel and CAPI are all free. Nothing here bills until a click is bought.

---

### PR C — server-side conversions · *depends on Meta Events Manager access*

> **Corrected:** v2 said C depended on B. It does not. CAPI is server-side, so it
> never touches the CSP, and its emitters live in `functions/booking/create.js`,
> `functions/fn/qualifier_submit.js` and `functions/fn/save_lead.js` — none of
> which #231 touches. Dedup against the browser event simply starts working when
> B lands. **The one real blocker on C is P1, Events Manager access**, because a
> CAPI integration nobody can verify is a CAPI integration shipped blind.

Phase A/B measures behaviour on the website. This measures **business**.

Three reasons this is the primary path, not a nice-to-have:

1. **It counts real outcomes** — a booking that landed in Clio, not a form submit. That is what Smart Bidding should chase.
2. **Ad blockers and iOS kill 30–50% of browser events.** Server-side doesn't care.
3. **No prospect PII in the browser.** For a law firm, that is the defensible posture — website-pixel wiretapping claims are an active plaintiff theory against US firms.

**Meta Conversions API** — emitted from functions that already exist:

| Source | Event |
|---|---|
| `functions/booking/create.js` | `Schedule` |
| `functions/fn/qualifier_submit.js` | `Lead` |
| `functions/fn/save_lead.js` | `Contact` |
| Retell webhook (phone) | `Contact` |

Same `event_id` as the browser event for dedup; `fbclid` / `_fbp` from the Vantage
record for matching; all user data SHA-256 hashed per Meta's spec, never raw. Graph
API version pinned and recorded at build time — not copied from this document.

**Google Ads offline import.** The four existing actions are *Website* source and
cannot receive gclid uploads. Elroy creates four parallel **Import** actions and
supplies the labels. Both sets stay: website for fast browser signal, import for truth.

- **C1 — manual CSV upload.** Weekly `gclid, conversion, time, value` into Goals → Uploads. No developer token, ships immediately. **Recommended first.**
- **C2 — Google Ads API `ClickConversion`.** Automated, but needs a developer token with its own approval lead time.

The 90-day conversion window already set gives runway for a booking weeks after the
click — someone reads a FIRPTA article in March and books in May.

**Conversion values — the differentiator.** The qualifier already derives tier and
strategy path server-side. Sending that as conversion value lets bidding distinguish a
Reserve-tier real estate principal from a general inquiry. For a practice with a 10x
spread in matter value this is worth more than everything else here combined, and
almost nobody in legal does it because almost nobody has the data. Value bands: Elroy
+ Paul.

> **C cannot be signed off without Events Manager access.** Meta's *Test Events* tool
> is the only way to confirm CAPI events arrive with the right shape and deduplicate.
> Without it we ship blind and the failure surfaces weeks later as "performance got
> worse." See §5 P1.

---

### PR D — upkeep guardrails · *depends on B*

Paul will keep requesting pages and changes. That is the environment, not a problem to
be solved by asking him to stop. So the system has to not care.

**⚠️ CORRECTION to v2 of this document.** It claimed the sitemap would drift as
Paul adds pages, and that a link/404 guard was missing. Both were wrong, and the
correction is in your favour: `test/seo-crawlability.test.mjs` **already** asserts
that no internal link points at a URL that does not resolve, and that every
linked indexable page is declared in `sitemap.xml`. A new page that is linked and
missing from the sitemap reds the build today. Two of the four guardrails below
were already built by whoever wrote that suite.

This repo already believes in mechanical guardrails — `ci.yml` runs a **CSP
invariant test** and the crawlability suite runs on every PR. We extend an
established pattern rather than argue for a new one.

| Guardrail | Catches | Status |
|---|---|---|
| Internal links resolve | A rename breaking navigation | ✅ **already exists** — `seo-crawlability.test.mjs` |
| New linked page must be in `sitemap.xml` | A page invisible to Google | ✅ **already exists** — same suite |
| Extend CSP invariant test to assert analytics hosts | Someone silently removing tracking | ships with **PR B** |
| Ad-landing-page check | A rename killing a *paid* landing page | needs the ad URL list — no campaigns exist yet |
| Alert: zero conversions while spend is non-zero | Dead token, removed tag, broken event, expired OAuth | needs **PR B/C** + a destination decision (§7 Q4) |

So there is nothing to build in PR D today: two items are done, and the other
three each wait on something real.

**The URL-change risk is the one nobody is thinking about, and CI does NOT cover
it.** The crawlability suite checks *internal* links. A Google Ads final URL is
an **external** reference CI cannot see — so if `/tax-controversy` is renamed,
internal links get updated, the build stays green, and the ad quietly points at a
dead page while it spends. `_redirects` already has 113 entries so the discipline
exists; it needs to extend to *"tell whoever runs the ads."* Until campaigns exist
there is no URL list to check against, which is why this is deferred rather than
solved.

**What edge injection buys, restated:** with the tag injected at the edge (PR B), any
new page Paul adds is tracked automatically, forever, with zero upkeep. Conversion
events are tied to *actions* — booking, qualifier, call, message — not to pages, so
Paul can add fifty articles and the event model does not change.

---

## 5. Prerequisites we cannot do ourselves

| # | Task | Owner | Blocks |
|---|---|---|---|
| **P1** | Events Manager access to the dataset | Meta BM admin | **PR C sign-off** |
| P2 | Verify `donovan.law` in Meta (DNS TXT → Cloudflare) | Meta BM admin + Elroy | AEM |
| P3 | Configure AEM priority (§6) | Meta BM admin | Meta optimisation |
| P4 | Reduce system user Admin → Employee, one dataset | Meta BM admin | Security |
| P5 | Create four **Import**-source conversion actions | Elroy | PR C |
| P6 | Vault `META_CAPI_TOKEN` | Elroy | ✅ **done** |
| P7 | Decide US default consent state | Paul / compliance | consent banner |
| P8 | Conversion value bands by tier | Elroy + Paul | PR C |
| P9 | Ads billing under the firm's own name and card | Paul / firm | campaign launch |
| P10 | Google Ads passkey | Elroy | linking accounts, adding users |

**P1 is the only one that can stall delivery.** Everything else has a workaround or a
later deadline.

---

## 6. Event dictionary

| Business event | Fires when | GA4 | Google Ads label | Meta | PR |
|---|---|---|---|---|---|
| `booking_confirmed` | Clio booking created — `functions/booking/create.js` succeeds | `booking_confirmed` | `AW-18269868294/hG-rCJWFnNkcEIai4IdE` | `Schedule` | A + C |
| `qualifier_submitted` | Qualifier modal submitted — `/fn/qualifier_submit` | `qualifier_submitted` | `AW-18269868294/5l53CJ3rhtkcEIai4IdE` | `Lead` | A + C |
| `call_started` | Paula web call connects | `call_started` | `AW-18269868294/Qj83CJ_qhtkcEIai4IdE` | `Contact` | A + C |
| `message_taken` | After-hours message via `/fn/save_lead` | `message_taken` | `AW-18269868294/BMoiCJrrhtkcEIai4IdE` | `SubmitApplication` | A + C |

Every event carries `event_id` (UUID), Vantage `visitor_id`, and `gclid` / `fbclid` /
`utm_*` where present.

**Meta AEM priority** (BM admin configures once the domain is verified, highest first):
`Schedule` → `Lead` → `Contact` → `SubmitApplication` → `ViewContent` → `PageView`

### Identifiers — public, safe in code and git

| What | Value |
|---|---|
| GA4 Measurement ID | `G-187CYLV2YX` |
| Google Ads conversion ID | `AW-18269868294` |
| Google Ads customer ID | `975-339-9396` |
| Meta dataset ID | `1769060274465061` |
| Meta system user ID | `61590841440779` |

### Secrets — names only, values vaulted

| Name | Home | Status |
|---|---|---|
| `META_CAPI_TOKEN` | Cloudflare Pages secret, Production | ✅ set |
| `GOOGLE_ADS_DEVELOPER_TOKEN` | GCP Secret Manager | only if C2 |
| `GOOGLE_ADS_OAUTH_REFRESH_TOKEN` | GCP Secret Manager | only if C2 |

The Meta **App Secret is not needed** — CAPI authenticates with the system user token
alone. If the Facebook app exists only because a wizard created it, delete it.

---

## 7. Open questions for David

1. **Who administers the Meta Business Manager?** P1–P4 block on that person. Elroy holds a CAPI token but no dashboard access — backwards, since the token is the dangerous half.
2. **PR C route: C1 manual upload first, or straight to C2 API?** Recommend C1 — closes the loop in days instead of waiting on a developer-token approval.
3. **If Meta's pixel fights the CSP, is dropping the browser pixel for CAPI-only acceptable?** Recommend yes.
4. **Where should the "conversions went to zero" alert land** — Slack, email, Roam, a GitHub issue? PR D needs a destination.
5. **Any unpushed work touching `functions/_middleware.js`, `js/perch/*` or `ci.yml`?** We checked open PRs, but cannot see local branches.

---

## 8. Out of scope — flagged, not planned

- **TikTok and LinkedIn are not covered by any credential we hold.** Each needs its own pixel and conversions API. Specify before build if either becomes a real channel.
- **Phone calls that don't originate from a click** are invisible. Needs call tracking numbers or stitching Retell records to a visitor.
- **Referrals — CPAs, realtors, word of mouth** — invisible to any pixel, and likely the firm's best matters. The only fix is to ask. Paula's spoken "how did you hear about us" was removed 2026-07-23 at Paul's request; recommend re-adding it as **one tap in the qualifier modal** instead — silent, no conversational cost, fills the largest hole in the picture. Needs Paul.
- **Google Search Console** not set up (no `google-site-verification` record). Free, five minutes.
- **Apex subpath redirect** — `donovan.law/<path>` doesn't redirect to `www`. Minor SEO hygiene.

---

*Prepared by Jay (Atrium chief-of-staff) for Elroy Geerdink. All "verified" claims in
§2 and §3 were checked live against www.donovan.law, the Google Ads account, and the
repository on 2026-08-10. Meta account state was inferred from DNS records and page
source because Business Manager access was unavailable — flagged as inference, not
asserted as fact.*
