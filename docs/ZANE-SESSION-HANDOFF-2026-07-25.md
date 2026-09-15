# ZANE SESSION HANDOFF — Donovan Legal / Perch Retrofit

**Date:** 2026-07-25 · **Author:** Zane (Lead Orchestrator) · **Principal:** David Pierce
**Repo:** `TicoAI/DonovanLegal` · **Epic:** #15 (Option B / F8) · **Live site:** https://www.donovan.law

This document is the canonical state snapshot for session continuity. If you are a
fresh Zane session, read this top to bottom before acting.

---

## 0. DOCTRINE — non-negotiable

1. **David holds ALL secrets.** Zane may set variable *names* + `Type=Secret`; Zane
   NEVER enters or reads a secret *value*. Card/payment details: never entered — routed to David.
2. **`.github/workflows/*` are Human-Only.** Zane gates; David merges and promotes.
   **Agents never merge.** Every agent order closes with: *"Agents do not merge - Zane gates, David merges."*
3. **Verify EVERY agent report** against git / grep / live probe — never trust the report.
   (Precedent this session: A4.1 NO-GO proved #57/#58 were real gaps after Zane had folded them
   in as "near-satisfied." They were not. Verify.)
4. **Brand spelling — exact:** RAGböx (ö, never RAGbox) · ConnexŪS (Ū, never ConnexUS).
5. **Agent dispatch format:** single-line `claude --dangerously-skip-permissions '<body>'`,
   NO inner apostrophes, pure ASCII, ≤6 tasks, explicit VERIFICATION + STOP.
   Bash-verify every order before handing over: `bash -n` clean, `tr -cd "'" | wc -c` = 2,
   non-ASCII (`grep -oP "[^\x00-\x7F]"`) = 0.

---

## 1. AGENT ROSTER (Claude CLI)

| Agent | Role | Focus |
|---|---|---|
| **Zane** | Orchestrator | Sprint coordination, board, architecture, gating |
| **Sheldon** | Backend | APIs, DB, backend logic, Functions |
| **Jordan** | Frontend | UI, components, UX |
| **Sarah** | QA | Production verification, regression, sign-off |
| **Dr. Insane** | Security | Compliance, hardening, risk |
| **ADAM** | DevOps | Deploys, infra, CI/CD, GCP/Cloudflare |
| **Evan** | Reviewer | Code review, PR validation, arch alignment |

---

## 2. PRODUCT FRAMING — what Perch actually is

Perch is a **productized, one-line-deployable, multi-tenant voice-concierge widget** in the
**Vantage** product line (Vantage = the deployable lawyer CRM). **Donovan Legal is beta install #1** —
"ground zero" — not a bespoke build. Requirements David set:

1. **Single-line deploy on ANY site**; audio survives multi-page navigation.
2. **Audio + tool-calls drive** modals / intake / image ingestion.
3. The **"blank white screen" voice-summons-content moat** — content appears on voice command.
4. **No third party (Retell / Clio) ever touches the client site.** They touch Vantage;
   Vantage serves the Perch widget. The client site only ever talks to Vantage.

**Verbal anchors (RAGböx family):** "Study it. Cited. Sovereign. Yours." / "Don't guess it — RAGböx it."

---

## 3. ARCHITECTURE — the Perch layer on Donovan

Retiring the iframe shell → **persistent overlay + Swup client-side router** with real indexable URLs.
This fixes the **F8 SEO contradiction** (today `/` serves a `noindex` shell).

- **Kill-switch — `PERCH_ROUTER`.** `routerEnabled(env,url)` in
  `functions/_lib/perch-router-inject.js` returns true only if `PERCH_ROUTER=on`, or host matches
  `/\.pages\.dev$/i` / localhost. **False (dormant) on `www.donovan.law`.** This is why the entire
  Perch layer is safe to ship to prod dormant. `perch-router-inject.js:85` enables it for any
  `*.pages.dev` host — so every Preview runs the router ON *by construction*.
- **Per-request nonce CSP** — `functions/_middleware.js` `buildCsp(nonce)`; HTMLRewriter stamps the
  nonce on inline scripts. **No `unsafe-inline` / `strict-dynamic`** for `script-src`. `buildCsp`
  unchanged across all Perch PRs — do not touch it.
- **Swup 4.9.2** — self-hosted, sha256-pinned; swaps `main#perch-main`. Document-level script sync (C1)
  adopts ONLY `script[src]` from a fixed **12-entry allow-list** (`js/perch/swap-policy.js`
  `ADOPT_SCRIPTS`), deny-by-default, never inline/eval. `loadScript()` creates a fresh `<script src>`
  (no nonce, no eval).
- **Persistent overlay `#perch-persistent`** — sibling of `#perch-main`; holds the orb + the Retell call
  so swaps don't tear down the live call.
- **`#perch-main` injection** — `functions/_lib/perch-main.js` (A0.1) injects `<main id="perch-main">`
  via HTMLRewriter, ordinal two-pass, no page edits.
- **Tier gating** — `functions/_lib/tier-auth.js`, per-tier HTTP Basic, fail-closed 503, 401 challenge.
  Username trimmed; **password NOT trimmed** (trailing whitespace in the secret caused the
  "flashes / won't go in" symptom). Tier routes (`/^\/(gold|platinum|diamond|reserve)(\/|$)/i`) are
  **excluded from Swup interception** (`EXCLUDED_ROUTES`). `js/members-gate.js` is a Layer-0 modal
  intercept; `startAuth()` is a STUB (no real auth yet) — this is why a user cannot reach `/reserve/`
  without typing the exact URL.
- **PERCH_BRIDGE Durable Object** — per-tenant, keyed via `perchBridge(env)` / `resolveTenantId`.
  Qualifier records keyed by `call_id`. This is the server-side record #57 must validate against.

---

## 4. INFRA / DEPLOY PIPELINE

- **Cloudflare Pages** — Direct-Upload project `donovan-site`, account `aad3aed11a2118a035263e9469e2da1d`.
  Deploy via `wrangler pages deploy` inside GitHub Actions.
- **`deploy-pages.yml`:** push feature branch → auto **Preview** (`<branch>.donovan-site.pages.dev`);
  push `main` → **tests only, NO auto-deploy**; production = **manual `workflow_dispatch`** requiring
  typed `deploy-production`.
- **Rollback** = re-promote the prior production deployment.
- **Secrets caveat (carried into #61 runbook):** secrets do NOT roll back with a deployment.
- **Direct-Upload note:** pushing a branch builds nothing on its own; a Preview needs
  `wrangler pages deploy` + a Cloudflare token — an **ADAM action and David's call**. Agents run their
  live checks on `localhost`, which `routerEnabled` admits by the same rule as `*.pages.dev`.
- **`TIER_*` secrets + `VANTAGE_WRITE_SECRET`** verified present on Prod + Preview (names only,
  values never read).
- Prod was promoted earlier this session with the Perch layer **dormant** and verified live-healthy.

---

## 5. PHASE A STATUS

| Piece | What | Status |
|---|---|---|
| A0.1–A0.4 | `#perch-main` inject, layer host, overlay, container wiring | **Merged** |
| A1.1 | SEO crawlability CI gate (`test/seo-crawlability.test.mjs`); `/` is the only expected-fail pin | **Merged** |
| A2.1 | `window.Perch` publish (router probe correct; **layer over-exposed → #58**) | **Merged** |
| A2.2 | Swup router + 12-entry script allow-list (`perch-swup-router.js`, `swap-policy.js`) | **Merged** |
| A2.3 | Turnstile re-render on swap (#53, PR #79) — drives `DLBooking.remountTurnstile()` seam | **Merged 07-25** |
| A3.1 | Booking-control direct-DOM (`js/perch/booking-control.js`; `FORBIDDEN_METHODS` submit/confirm/book/create) | **Merged** |
| #67 / #72 | XSS fixes on material-participation tracker (read-path coerce + sink coerce) | **Merged** |
| **A3.2 (#57)** | **Server-bind `call_id`** — Sheldon order **A32 RUNNING** | **In flight** |
| **A3.3 (#58)** | **De-expose control surface** — Dr. Insane order **A33 RUNNING** | **In flight** |
| A3.4 (#59) | `frame-ancestors 'self'` + `X-Frame-Options` — lands **with** the promote | Pending |
| A4.1 (#60) | Broadened cutover QA (PR #80) — **NO-GO**, gates the promote | **Held** |
| A4.2 (#61) | Post-promote synthetic smoke + state reconciliation | Pending (after promote) |
| A5.1 (#62) | **David promotes:** flip `PERCH_ROUTER=on`, retire `home.html`/shell-at-`/`, F8 dies | Pending (blocked by A4.1 GO) |
| #78 | Repo-wide XSS sweep (6 remaining alerts, low) — post-launch follow-up | Backlog |

---

## 6. THE TWO OPEN BLOCKERS (why the promote is held)

Both surfaced by Sarah's A4.1 NO-GO (PR #80), verified against code — **neither is a regression
this rewire introduced; both shipped with A2.1.**

- **#58 (A3.3) — control surface exposed on `window`.** `perch-layer.js:276` publishes
  `window.Perch.layer` *whole*, so `setRouter` (installs the nav callback every agent-driven `go()`
  runs through) is reachable and **replaceable** by any script on the page — plus
  `mountShellConcierge` / `attachLiveResource` / `detachLiveResource` and
  `window.__perch.openQualifier` / `closeQualifier`. `Perch.router` is already correct (closure-only,
  read-only probe). Bring the rest to that bar. **→ Order A33 (Dr. Insane) running.**
- **#57 (A3.2) — `call_id` client-trusted.** `functions/booking/create.js:113` reads `call_id` from
  the request body and trusts it; a client can forge or drop it and the qualifier join is only as
  trustworthy as the browser. Must validate server-side against the PERCH_BRIDGE DO qualifier record.
  **→ Order A32 (Sheldon) running.** This is the ONE order authorized to touch `create.js`, call_id
  handling only.

---

## 7. BOARD STATE (clean as of this handoff)

**Open PRs:** #80 (Sarah A4.1 — **HELD**, do not merge/promote; it is the gate doc, stays open
until #57/#58 land and Sarah re-runs to GO) + this handoff PR.

**Open issues** — exactly the Phase 3→5 chain plus follow-ups, nothing stray:
#57 (A32 running), #58 (A33 running), #59 (frame headers, lands with promote), #60 (A4.1 gate = PR #80),
#61 (A4.2 post-promote smoke), #62 (A5.1 David's promote), #78 (XSS sweep, low), #15 (epic).

**Recently closed:** #53 (Turnstile, delivered via merged #79).

---

## 8. PATH TO LIVE

1. **A32 (#57) + A33 (#58)** open PRs → **Zane gates** (verify against code, not the report).
2. David merges both.
3. **Sarah re-runs A4.1** (#60) on Preview → **GO**.
4. **David promotes** (#62): types `deploy-production`, flips `PERCH_ROUTER=on`, retires
   `home.html` + the `/ → /perch.html 200` shell rewrite so `/` serves real indexable content
   (F8 dies); **A3.4 (#59)** frame headers land in the *same* step.
5. **Sarah / ADAM run A4.2 (#61)** post-promote synthetic smoke (call, nav, booking) + state
   reconciliation; add the secret-rollback caveat to the runbook.
6. Backlog: **#78** repo-wide XSS sweep.

That is the finish line for Donovan as Perch beta install #1.

---

## 9. WATCH-OUTS

- **CodeQL `js/xss-through-dom`:** read-path sanitizing ALONE does not clear alerts (heapStep
  re-taints the whole restored object). Need BOTH read-path guard AND sink-side coercion. A green
  PR-level CodeQL check is diff-scoped and misleading — verify against a `main` control.
- **Turnstile refuses automation** — end-to-end token solve is always a MANUAL check.
- **`issue_write` cannot close a PR** (PRs aren't Issues in GraphQL) — use
  `update_pull_request` with `state:closed`.
- **Merging a PR does not auto-close its ticket** unless the PR body carries a literal `Closes #NN`
  keyword — close the ticket by hand (as done for #53).
- Local `git`/clone in the container fails auth (`GITHUB_TOKEN` invalid for git) — use the GitHub
  MCP tools throughout.
- **`main` is branch-protected** — direct commits are rejected (`build-and-test` required check).
  Everything, including docs, goes through a branch + PR that David merges.
