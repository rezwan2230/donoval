# David-Flag Report — Donovan Go-Live (Vantage items)

Items the Donovan launch needs from the Vantage side. Posture note: per Elroy 2026-06-30,
the 6/29 "report-only" stance is relaxed back to "ours to fix via PR" (David's 6/24 handoff;
"he trusts me"). TICO branch protection still applies — we PR + get review, never self-merge.

---

## 1. `donovan.law` → beacon CORS allowlist — ✅ DONE (PR open, staged)
- **PR:** TicoAI/vantage #57 — adds `/(^|\.)donovan\.law$/` to `server/server.js` `ALLOWED_ORIGIN` (line ~452).
- **Why:** at DNS cutover the Perch beacon (`perch.js` → `/visit`, `/events` SSE) is cross-origin from the `donovan.law` apex; today only `*.pages.dev` + `theconnexus.ai` match, so the apex would be `cors_denied`. `donovan-site.pages.dev` already works.
- **Action:** review + merge **at the DNS flip** (safe to merge earlier — it just pre-authorizes a not-yet-live origin). Additive only; no existing origin affected.

## 2. `WRITE_SECRET` set in Vantage prod — ⛔ DAVID (cannot verify from here)
- **Why it matters:** the compliance memo (§2) flags `WRITE_SECRET MUST be set in prod` — without it, write endpoints (lead capture / `/ingest/retell`) are unauthenticated → **real PII exposure**.
- **Action (David):** confirm `WRITE_SECRET` is set to a real value in the Donovan deployment env (GCP Secret Manager / Cloud Run) **before** any live lead traffic. This is a runtime secret in his deploy env — not something we can set or check via the repo.

## 3. Retell OUTBOUND callback dialer — ⛔ DAVID / coordinate (only if launch feature)
- **State:** `server/outbound.js` dials via `portal.theconnexus.ai/api/v1/calls` — **ATHENA/Visium only**; no Retell branch. Inbound (`/ingest/retell`) is platform-agnostic and works.
- **Action:** only needed **if outbound callbacks are a launch feature** for Donovan. If yes, a Retell branch (`createPhoneCall`) in `outbound.js` is a concrete contribution we could PR; also needs an active SIP trunk per org or it 404s. Defer unless callbacks are in scope for launch.

---

## Improvement findings (NOT launch-blockers — for David when free)
Already compiled in `HANDOFF-TO-DAVID.md`; summary:
- **CORS allowlist is hardcoded** (server.js:452) — PR #57 point-fixes Donovan; the general fix = derive allowed origins from each deployment's `site_url` for zero-code onboarding.
- **"SITE URL — optional" field is misleading** — users expect it to control CORS; it only feeds write-pinning.
- **Visitors page defaults to all-orgs/all-deployments** → cross-client bleed; filter `deployment=donovan-intake` to isolate Donovan.
- **Deployment-tag isolation** — an unknown Safari/iPhone visit was tagged `donovan-intake`; verify tag isolation.
