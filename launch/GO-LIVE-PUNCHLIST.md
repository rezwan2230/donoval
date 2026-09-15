# Donovan Legal — Go-Live Punch-List (Public: donovan.law)

**Target (Elroy, 2026-06-30):** PUBLIC cutover to `donovan.law`. Full scope.
**Live preview today:** https://donovan-site.pages.dev (Cloudflare Pages project `donovan-site`).
**Deployed assets:** `donovan-legal-site/` only. Deploy = `cd donovan-legal-site && CLOUDFLARE_ACCOUNT_ID=aad3aed11a2118a035263e9469e2da1d npx wrangler pages deploy . --project-name=donovan-site --commit-dirty=true` (MUST run from inside the assets dir so `functions/` compile).

Status legend: ✅ done · 🔨 doing · ⏳ ready · ⛔ blocked (owner)

---

## OURS — engineering (we drive)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 1 | Strip debug | ✅ | Deleted `functions/fn/dbg.js`; removed `dbg` KV write in `do_page_action.js`. `plugins.js` console-shim is boilerplate (kept). |
| 2 | Member-tier auth | 🔨 | **HARD GATE.** `.htaccess` Basic Auth is DEAD on CF Pages → `/gold /platinum /diamond /reserve` are currently fully public, incl. securities-sensitive SAMPLE deal packages (Reg D / NY publication). Fix = **CF Access (email-PIN)** per `CF-ACCESS-RUNBOOK.md`. Needs Elroy's Zero Trust config + member email list from Paul. |
| 3 | Redirects + orphan cleanup | 🔨 | `_redirects`: 7 safe orphan→canonical 301s added (CF Pages serves redirects BEFORE static files, so orphan FILE deletion not required for these to fire). REMAINING (→Jason/Paul): tax-cluster canonical conflict (`/tax.html` vs `/tax-planning.html`, also breaks Paola `goto_tax`), `business-law.html` canonical, orphan-file deletion after internal-link audit. |
| 4 | Pin esm.sh versions | ✅ | Pinned `retell-client-js-sdk@2`→`@2.0.8` (latest 2.x) in `js/donovan-widget.js` AND `perch.html`. FLAG: `engagement-scoping/index.html` uses `cdn.tailwindcss.com` (not-for-prod) + unpkg React + `@babel/standalone` in-browser → dev-grade page, route to #5. |
| 5 | SEO + missing tool page | ⏳ | Jason — SEO pass, the missing tool page, orphan cleanup (overlaps #3). |
| 6 | Booking link in Paola | ⏳ | Paola SHARES Paul's native calendar link (Google Workspace likely). NO auto-book — firm confirms after conflicts check + engagement letter. Needs the actual link. |

## DAVID-FLAG — report only, he resolves (§22, no Vantage code edits)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 7 | `WRITE_SECRET` real value | ⛔ David | Real-PII exposure today until set. |
| 8 | `donovan.law` → Vantage CORS allowlist | ⛔ David | `server/server.js:452` regex array; one coordinated edit + Vantage redeploy AT the DNS flip. (`.pages.dev` already matches; the apex domain does not.) |
| 9 | Retell outbound callback dialer | ⛔ David | Only if outbound callbacks are a launch feature. `outbound.js` is ATHENA/Visium-only today; Retell branch not built. |

## PAUL / LEGAL — we DRAFT, counsel approves (cannot ship without)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 10 | FL §934.03 recording consent | ⏳ draft | Two-party-consent state — Paola must disclose + capture consent at call start. |
| 11 | AI disclosure copy | ⏳ draft | Paola identifies as AI (already speaks it live; needs counsel-approved wording). |
| 12 | FL Bar advertising review | ⏳ draft | Site copy + Paola scripts reviewed against FL Bar advertising rules (Rule 4-7). Tier "SAMPLE" securities material especially. |

## ELROY — reserved (§16: brand / compliance / irreversible-at-scale)

| # | Item | Status | Notes |
|---|------|--------|-------|
| 13 | DNS flip to donovan.law | ⛔ Elroy | FINAL step. Gated on #2 live + #10–12 legal sign-off + #8 David CORS. CSP/CORS cutover. |
| 14 | Member email list (from Paul) | ⛔ Elroy/Paul | Feeds CF Access allow-list (#2). |
| 15 | Paul's calendar booking link | ⛔ Elroy/Paul | Feeds #6. |

---

## Critical path (ordered)
1. ✅ Strip debug
2. Engineering, parallel & unblocked: `_redirects` (#3), esm.sh pin (#4), SEO/missing-page (#5)
3. CF Access configured + verified on all 4 tier paths (#2) ← needs Elroy + member list
4. Legal drafts authored (#10–12) → to Paul/counsel
5. Booking link wired (#6) ← needs link
6. David coordinated: WRITE_SECRET (#7) + CORS apex add (#8) staged for flip
7. **DNS flip (#13)** — only when 2–6 are green and legal has signed off.
