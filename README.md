# Donovan Legal PLLC — donovan.law

**Client:** Donovan Legal PLLC
**Live:** https://www.donovan.law
**Status:** Deployed and serving clients

This is a **Cloudflare Pages application**. The deployed site is
[`donovan-legal-site/`](donovan-legal-site/) — every file under that directory ships
— and its backend is a set of **Cloudflare Pages Functions** under
[`donovan-legal-site/functions/`](donovan-legal-site/functions/).

The authoritative description of the deployed system, subsystem by subsystem, is
[`docs/AS-BUILT.md`](docs/AS-BUILT.md). The editing contract for content changes is
[`CLAUDE.md`](CLAUDE.md). This file is the orientation and the operational entry point.

---

## Architecture

Static HTML assets plus Pages Functions, on the Cloudflare Pages project
**`donovan-site`**. There is no server, no container and no origin: the Functions run
at the edge in front of the asset handler.

The pages themselves are ~120 hand-authored HTML files at the root of
`donovan-legal-site/` with no templating — the nav, header and footer are copy-pasted
per file. That is why the shared behaviour (the swap container, the persistent layer,
the router, the header utility bar, the CSP nonce) is **injected as the HTML streams
out** by [`donovan-legal-site/functions/_middleware.js`](donovan-legal-site/functions/_middleware.js)
rather than added to each page.

```
donovan-legal-site/          ← THE DEPLOYED SITE. wrangler's asset root.
├── wrangler.jsonc             project donovan-site; pages_build_output_dir "."
│                              KV PERCH_ACTIONS · DO PERCH_BRIDGE → script perch-do
├── *.html                     ~120 pages, chrome copy-pasted per file
├── _headers                   static security headers (NOT the CSP — see below)
├── _redirects                 301 dedup rules + the `/` → perch.html 200 rewrite
├── sitemap.xml robots.txt site.webmanifest
├── css/  js/  img/  webfonts/
├── members/ gold/ platinum/ diamond/ reserve/   member areas
├── scripts/generate-sitemap.mjs
└── functions/               ← THE BACKEND (Cloudflare Pages Functions)
    ├── _middleware.js         per-request CSP nonce, no-store, edge injection
    ├── _lib/                  perch-main, layer/router/bar injectors, tier + member
    │                          auth, consent tickets, Turnstile/abuse, callmap key,
    │                          Retell auth + post-call reader
    ├── booking/               create.js · availability.js · types.js
    │   └── _lib/              provider-clio.js, clio-custom-fields.js,
    │                          intake-policy.js, qualifier-bind.js, vantage-*.js,
    │                          grow-lead.js, redirect-refusal.js
    ├── fn/                    mostly the Retell custom-function tool surface, plus
    │                          four browser-called routes — including contact.js,
    │                          the /contact inquiry sink (Turnstile, then Clio)
    ├── webhooks/              retell-postcall.js (signed webhook delivery)
    ├── members/auth/          signin · signout · config
    └── gold|platinum|diamond|reserve/_middleware.js   the four gated levels

perch-do/                    separate Worker: the PerchBridge Durable Object
test/                        the root test suite (2338 tests). Gates every deploy.
hygiene/                     repo/doc-consistency assertions. PR-only, never deploy.
package.json                 test harness lives at the REPO ROOT, not in the site dir
docs/                        AS-BUILT.md and the per-ticket engineering records
```

`src/`, `infra/`, `Dockerfile` and `cloudbuild.yaml` are **abandoned artifacts of an
earlier nginx-on-Cloud-Run plan that was never shipped**. Nothing deploys to GCP.
They are retained only because deleting them is a separate call; ignore them.

### The edge injection, in one paragraph

`functions/_middleware.js` buffers each HTML response, runs a first HTMLRewriter pass
to compute an injection *plan* in div-ordinal space
([`_lib/perch-main.js`](donovan-legal-site/functions/_lib/perch-main.js)), then a
second pass that stamps a per-request nonce onto every inline `<script>` and injects
`<main id="perch-main">`, the persistent layer, the Swup router tag (behind a flag)
and the header utility bar. The Content-Security-Policy is issued **only** here — it
was deliberately removed from `_headers`, which cannot carry a per-request nonce.

---

## Brand

Values as shipped in the stylesheets after the WCAG 2 AA re-value
(`JORDAN-195A-A11Y-CSS-R1`, PR #213). All of these are literal hex in
[`css/main.css`](donovan-legal-site/css/main.css) and its companions — there are no
CSS custom properties in this tree.

| Token | Value | Where |
|---|---|---|
| Brand green | `#107a4d` | `css/main.css`, `css/dl-utility-bar.css`, `css/perch-layer.css` |
| Brand green — hover / active | `#0a5a37` | same |
| RESERVE "RE" mark on dark surfaces | `#8fd3b6` | `css/main.css` (six enumerated dark containers) |
| Cream | `#F5F5F0` | `css/main.css:102` and the utility bar |
| GOLD wordmark / CTA fill | `#7d6218` | `css/main.css` `.brand-gold`, `.tier-cta-gold` |
| PLATINUM wordmark / CTA fill | `#6a6a6c` | `css/main.css` `.brand-platinum`, `.tier-cta-platinum` |
| DIAMOND wordmark / CTA fill | `#4c7080` | `css/main.css` `.brand-diamond`, `.tier-cta-diamond` |
| Tier card border accents (decorative) | `#C9A961` `#8a8b8d` `#5E8B9E` | `css/main.css:1938-1941` |
| Prose link blue | `#1668c9` | `css/main.css:2371` — pinned between two opposing thresholds; read the comment above it before changing it |
| Muted breadcrumb | `#5f666c` | `css/main.css:2377` |
| Inline `code` | `#bf2469` | `css/main.css:2382` |
| Body text | `#222` | `css/main.css:7` |

**Contact-form focus ring:** `outline: 3px solid #0a5a37; outline-offset: 2px`, on the
`form.contact-form input:focus` / `select:focus` / `textarea:focus` group
([`css/main.css:2421-2427`](donovan-legal-site/css/main.css)). It wins on specificity over
the page's own `outline: none`, and it is an outline rather than a border because the
page transitions `border-color` and a transitioned property paints nothing at the
instant focus lands.

**The one deliberate exception:** `css/consent-gate.css` still carries the pre-re-value
green `#169b62`. `test/dom.test.mjs:543` pins that value as a brand contract, and
changing a test was out of scope for a CSS-only change.

**Fonts:** Trajan Pro (display), Gotham Light/Medium/Bold (headings/nav), Open Sans
(body). The webfont files **are** committed, in
[`donovan-legal-site/webfonts/`](donovan-legal-site/webfonts/) (`.ttf`/`.woff`/`.woff2`).

---

## Local development

Requires **Node 22 or newer** (`package.json` `engines`). The `npm test` script is
`node --test "test/**/*.test.mjs"`, and node only expands that glob on v21+.

```bash
npm ci

# The whole deploy-gating suite — 2338 tests.
npm test

# Repo/doc-consistency assertions. Runs in CI on pull requests only, never on deploy.
npm run test:hygiene
```

Serve the real site, with the Functions compiled, using wrangler:

```bash
# From the repo root. The asset directory is the argument.
npx wrangler pages dev donovan-legal-site

# The soft router is Preview/localhost-on by default; force it off to reproduce
# production behaviour exactly (docs/SHELDON-PERCH-CLEANUP-ROUTING-KEYS.md).
npx wrangler pages dev donovan-legal-site --binding PERCH_ROUTER=off --port 8791
```

Two things to know when running locally:

* **KV and the Durable Object are not bound by default.** `--local` gives you neither,
  so `/booking/create` logs `PERCH_ACTIONS binding not available` and skips the KV
  mirror, and `PERCH_BRIDGE` probes resolve to "not verified". That is the designed
  degradation, not a fault.
* **Every server-side gate fails closed on a missing secret.** With
  `TURNSTILE_SECRET_KEY` unset, `/booking/create` **and** `/fn/contact` answer 503 for
  every write; with `GROW_LEAD_TOKEN` unset, `/fn/contact` answers 503 rather than
  dropping the inquiry; with the Clio calendar unconfigured, `resolveConfig` throws
  `MISSING_CALENDAR_CONFIG` and the booking endpoint answers 503. `/fn/contact` reads no
  calendar and uses `resolveContactConfig` instead, so an unset `CLIO_CALENDAR_ID` does
  **not** refuse an inquiry. All deliberate — see `docs/AS-BUILT.md` §3.4.

The engagement-scoping React island is the only built asset:

```bash
npm run build:es     # esbuild → js/engagement-scoping.js, tailwind → css/engagement-scoping.css
```

---

## CI and deployment

Two workflows carry the work, and the split is deliberate.

### `.github/workflows/ci.yml` — the pull-request gate

One job, **`build-and-test`**. That job id is the required status-check name in branch
protection for `main`; renaming it strands the check as "Expected" and blocks every PR.

| Step | What it does |
|---|---|
| `actions/checkout@v4` with **`fetch-depth: 0`** | Full history. `test/chrome-diff.test.mjs` reconstructs each changed page as it was at the merge base with `git show`; a depth-1 checkout has no merge base, and that gate is written to **fail** rather than report a clean result it never checked. |
| `actions/setup-node@v4`, `node-version: '22'` | The `test/**/*.test.mjs` glob needs v21+. |
| `npm ci` → `npm test` | The full 2338-test suite, including the **chrome-diff gate** and the CSP/`_middleware.js` invariants in `repo-invariants.test.mjs`. |
| `npm run test:hygiene` | Repo-hygiene and doc/workflow-record assertions. **Run here and only here** — `hygiene/deploy-drift-record.test.mjs` reds if this step ever lands in the deploy workflow, because a documentation mismatch is not a reason to hold a deploy. |

**The chrome-diff gate** (`test/chrome-diff.test.mjs`) is the content lane's guard
rail: for every changed page under `donovan-legal-site/` it requires the same
`<script src>`/`<link href>` tags in the same order, a byte-identical `nav.menubar` and
`.copy-inside`, an identical element tree, and no newly introduced `<main>`,
`<div id="concierge">` or `on*=` handler. Text — including `<title>` and
`<meta name="description">` values — is the only thing a content edit may change.

Two closed per-file waiver registers narrow it, each suppressing exactly one rule and
each carrying a written reason per entry: `REVIEWED_STRUCTURAL` for page structure
(PR #211) and `REVIEWED_ASSETS` for the script/stylesheet manifest (PR #217). The asset
one is **additive-only** — the before-manifest must survive as a subsequence of the
after-manifest — so a dropped tag, a re-pointed `src` or a reordered pair is refused even
for a listed file. `nav.menubar` and the footer are waivable by neither.

### `.github/workflows/deploy-pages.yml` — the deploy

Four jobs. `donovan-site` is a **Direct-Upload** Pages project, so it cannot use
Cloudflare's native Git integration; this runs `wrangler pages deploy` from CI.

| Job | Trigger | What it does |
|---|---|---|
| **`test`** — *Test (root suite, Node 22)* | every run | `fetch-depth: 0`, Node 22, `npm ci`, `npm test`. |
| **`guard`** — *Tree-integrity* | every run | Refuses to deploy a ref that is not the rebuilt site. Asserts six files are present: `_headers`, `functions/_middleware.js`, `functions/web-call.js`, `functions/_lib/tier-auth.js`, `functions/_lib/consent-ticket.js`, `functions/_lib/abuse.js`. |
| **`preview`** | `push` on a **non-default** branch | Needs `[test, guard]`. Re-confirms the Cloudflare production branch via the API and **fails closed** on any non-2xx, `success != true` or empty `production_branch`; refuses unsafe branch names. Then `wrangler pages deploy --branch="$REF"`. |
| **`production`** | `workflow_dispatch` **only** | Needs `[test, guard]`. Requires all three of: `github.ref_name == 'main'`, and the dispatch input **`confirm == 'deploy-production'`** typed by hand, and the protected `production` environment. Resolves the production branch fail-closed, then `wrangler pages deploy --branch="$PB"`. |

Both deploy steps run with `working-directory: donovan-legal-site`, which is what makes
wrangler read `./wrangler.jsonc` (`pages_build_output_dir: "."`) **and** compile
`./functions` into Pages Functions.

No GitHub context is interpolated into any `run:` body — `github.ref_name` and the
resolved branch travel via `env:` as `"$REF"` / `"$PB"`, so a crafted branch name
cannot inject shell with the Cloudflare token in scope.

**Repo secrets required** (Settings → Secrets and variables → Actions):
`CLOUDFLARE_API_TOKEN` (Account · Cloudflare Pages · Edit) and `CLOUDFLARE_ACCOUNT_ID`.

### The other three workflows

* **`deploy-drift.yml`** — scheduled, read-only. Answers "is the site visitors are
  loading built from the same commit as `main`?" via `bin/check-deploy-drift.mjs`.
  Exit 1 = site-affecting drift, exit 2 = could not complete (fails closed).
* **`claude.yml`** — Paul's content lane. `@claude` on an issue or comment, gated on
  `author_association`, opens a PR. No `actions: write`, so it cannot dispatch the
  production deploy.
* **`agent-verdict.yml`** — manual dispatch; emits a bot-authored PR review as the
  countable gate verdict.

### Deploying by hand

```bash
cd donovan-legal-site
CLOUDFLARE_ACCOUNT_ID=aad3aed11a2118a035263e9469e2da1d npx wrangler pages deploy
```

Run it from **inside** the assets directory so `functions/` compiles. In practice
production is deployed by dispatching `deploy-pages.yml`, not from a laptop.

> **`main` is branch-protected and production requires a human to dispatch
> `deploy-production` by hand.** Agents open PRs; they do not merge and they do not
> deploy.

---

## Reference

| Document | What it is |
|---|---|
| [`docs/AS-BUILT.md`](docs/AS-BUILT.md) | **The as-built of the deployed system.** One section per subsystem, each citing its files. Start here. |
| [`CLAUDE.md`](CLAUDE.md) | The editing contract: what may change without escalating, the rules that fail CI, and the silent traps no test catches. |
| [`reference/SITE-REFERENCE.md`](reference/SITE-REFERENCE.md) | The original-site design audit (colors, fonts, layout, page-by-page content) that the rebuild was measured against. |
| `docs/*.md` | Per-ticket engineering records — runbooks, probe results, cutover QA, audit findings. |

Several older markdown files in this repo are **stale and will mislead you**:
`donovan-legal-site/README.md` describes that folder as a read-only GoDaddy baseline
(it is not — it is the deployed site), and `HANDOFF.md` says `donovan.law/fn/*` 404s
and that the site sits behind a curtain on `donovan-site.pages.dev` (it does not —
donovan.law is live and serving Functions). **Trust the code over the docs.**
