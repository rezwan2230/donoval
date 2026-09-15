# Handoff to David — Donovan Legal × Vantage / Perch / Cloudflare (2026-06-25)

**From:** Elroy (CoS/Jay)  **Re:** Everything we touched that intersects your Vantage build, so you can resume cleanly.

## TL;DR
- We built a **Retell voice concierge ("Perch" / Paola)** for Donovan Legal on **Cloudflare Pages**, *consuming* your Vantage beacon + endpoints. **We did NOT modify Vantage code** — Vantage analysis was read-only.
- ⚠️ **We deployed Donovan's Cloudflare resources INTO YOUR Cloudflare account** (`David@ticoai.net's Account`, `aad3aed11a2118a035263e9469e2da1d`). Decision needed: keep there or move to Elroy's account (`ecf4069e5d336b82060f3cbe4fd8d322`).
- A few **findings/errors in Vantage** for you to action are in §4 (one is a live PII exposure).

---

## 1. Repos & folders
| What | Repo / location | State |
|---|---|---|
| Donovan site + Perch widget | **`TicoAI/DonovanLegal`** — local `C:\tmp\DonovanLegal\donovan-legal-site` | On branch **`feat/perch-voice-concierge`** (PR #1) off `main`; deployed to Cloudflare via Wrangler. |
| `perch-do` worker (Durable Object) | in the repo at `perch-do/` | Deployed to your CF account. |
| Original owl/perch UAT | local `C:\tmp\donovan-live`, `C:\tmp\donovan-owl-demo` | Local-only, not repos (reference). |
| **Vantage** | `TicoAI/vantage` — clone `C:\Users\elroy\TicoAI\vantage` | **UNCHANGED by us.** Read-only analysis only. |

**No new TicoAI repos were created.** The Donovan build lives inside the existing `DonovanLegal` repo.

## 1a. Site improvements (what we did to the site *before* Cloudflare)
Starting point was the legacy GoDaddy / cPanel site. We rebuilt it before dropping it into Cloudflare Pages:
- **Platform migration:** GoDaddy/cPanel → **Cloudflare Pages** (static CDN + Pages Functions). **PHP → static HTML** conversion — `index.php` and the member-tier `gold/platinum/diamond/reserve/index.php` were cPanel-auth PHP, now static.
- **Security headers** (`_headers`): Content-Security-Policy (locked to the concierge/Vantage/Retell origins), HSTS (preload), `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy` (microphone scoped to the concierge origins), CSP `frame-ancestors` replacing a blanket `X-Frame-Options` so the Perch shell can iframe the site. Security review by **Creighton** (`donovan-security-findings.md`, 2026-06-22) — findings tracked; production blockers (client-side tier-gating bypass, unpinned esm.sh SDK, UAT-open endpoints) to close before go-live.
- **SEO:** `sitemap.xml` (~80 URLs), `robots.txt`, and **19 × 301 redirects** (`_redirects`) consolidating duplicate/legacy URLs to canonical — kills duplicate content, preserves link equity.
- **Accessibility:** WCAG fixes across pages.
- **Content cleanup:** removed orphan/duplicate pages (`equitable.html`, `equitable2.html`, dup `realestate.html`, `the-cmm2.html`, `.backup.html` files) and dead PHP.
- **Performance / Core Web Vitals:** long-cache `immutable` headers for css/img/webfonts; custom `404.html`, `site.webmanifest`, favicon.
- **Member tiers:** gold / platinum / diamond / reserve tier pages + tools (tier-gating is currently client-side — flagged for Cloudflare Access before production).

## 2. Cloudflare — deployed into YOUR account (`aad3aed…`)
| Resource | Name / ID | Link |
|---|---|---|
| Pages project | `donovan-site` | https://donovan-site.pages.dev (Perch at `/perch.html`) |
| Worker (page-control relay) | `perch-do` | https://perch-do.david-aad.workers.dev |
| Durable Object | `PerchBridge` (sqlite class, in `perch-do`) | — |
| KV namespace | `PERCH_ACTIONS` (`fff1865cad734214acdebf8b3b944289`) | debug-only now |
| Pages env vars | `RETELL_API_KEY` (set), `VANTAGE_READ_SECRET` (pending — for when you set WRITE_SECRET) | CF → donovan-site → Settings → Variables |

- **Wrangler:** deploys done with Elroy's OAuth (`elroy@ticoai.net`) against **your** account id. Deploy cmd: `cd donovan-legal-site && CLOUDFLARE_ACCOUNT_ID=aad3aed11a2118a035263e9469e2da1d npx wrangler pages deploy` (run from INSIDE the assets dir so `functions/` compiles).
- Dashboard drag-drop does NOT compile `functions/` — must use Wrangler.

## 3. How Donovan consumes Vantage (your side unchanged)
- **Beacon:** `perch.html` loads `https://vantage.ticoai.net/perch.js` with `data-deployment="donovan-intake"`, `data-agent="agent_7d044bab7d2d0e5d648de5f198"`. Visitor metadata is flowing (visible in Visitors).
- **Post-call ingest:** all 3 Donovan Retell agents' `webhook_url` = `https://vantage.ticoai.net/ingest/retell?deployment=donovan-intake`.
- **Memory read:** `functions/web-call.js` fetches `GET https://vantage.ticoai.net/caller-context?visitor_id=<vid>` **server-side**, injects the profile as Retell dynamic variables ("welcome back").
- **Call-window:** perch fires `window.__vantage.callStart()/callEnd()`.

## 4. Findings / errors in Vantage (your action items)
1. **🔴 `/caller-context` PII endpoint is OPEN.** `requireWriteSecret` (`server.js:~135-142`) is a **no-op unless `WRITE_SECRET` is set**, and it's currently UNSET in prod → `GET /caller-context?visitor_id=<uuid>` returns **name/phone/email with no auth** (confirmed live, HTTP 200, no secret). Same for `PRECALL_SECRET` on `/pre-call`. **Recommend: set `WRITE_SECRET` (and `PRECALL_SECRET`) on the Cloud Run service**; consumers send it. We've built `web-call.js` to send it (`x-write-secret` header — confirm the header name vs your impl).
2. **CORS allowlist** (`server.js:~446`): allows `*.pages.dev`, `theconnexus.ai`, `localhost`, the CF test host — but **NOT `www.donovan.law`** (prod domain). Browser calls from donovan.law will be CORS-blocked. We work around it by calling Vantage **server-side** from Pages Functions (no Origin header → allowed). Recommend deriving allowlist from `site_url` / adding donovan.law before prod.
3. **SITE-URL field** is deployment metadata + write-pinning, **NOT** the CORS control (we misread it twice). Worth clarifying in the UI.
4. **Web-call ↔ visitor link (open question).** For WEB calls (no phone number), does `/ingest/retell` link the new contact to the `visitor_id` (via the call-window correlation opened by `callStart`)? This is the one thing gating the "welcome back" demo — a returning caller is only recognized if their prior call banked a profile under their `visitor_id`. Please confirm the web-call linkage.
5. **Retell-outbound gap:** `outbound.js` is ATHENA/Visium-only; no Retell outbound path (relevant if Donovan does outbound callbacks via Retell later).
6. **Callbacks:** your Callbacks feature works; Donovan just hasn't added a "request a callback" tool to Paola yet (planned — would write to your callback endpoint).

## 5. Retell (Donovan agents — our changes, not yours)
- Paola (`agent_7d044bab7d2d0e5d648de5f198` / `llm_46c9246d2921b0a43513973b1283`), Wendy (`agent_fd4c20458057775b401f1e43e1` / `llm_464eb7c19347153bff1bc20d17ef`), Leidy (`agent_318f532f82b912e9fa037b8445` / `llm_c92ba5f20808b8ad3305b1d7e184`).
- Changes: warm-handoff mesh (Paola↔Wendy↔Leidy transfers via `agent_swap`), page-control tools (do_page_action/get_page_actions → Pages Functions), memory greeting (recognize-but-don't-volunteer), unified post-call webhook. Prompts are DRAFT pending Paul Donovan + FL Bar review.

## 6. What we discussed / decided
- Memory feature built in **test-posture**, gated on a compliance memo (`C:\tmp\DonovanLegal\perch-legal-compliance-memo.md`): FL §934.03 two-party recording consent, `WRITE_SECRET`, Rule 4-1.18 confidentiality, Paul Donovan + FL Bar sign-off before real clients.
- Full Vantage memory analysis: `C:\tmp\DonovanLegal\perch-memory-analysis.md`.
- Site is in **DEV mode** (`donovan-site.pages.dev`, noindex, behind the curtain); `donovan.law` DNS flip later.

## Direct links
- Site/Perch: https://donovan-site.pages.dev (`/perch.html`)
- Worker: https://perch-do.david-aad.workers.dev
- Repo: https://github.com/TicoAI/DonovanLegal (branch `main`, uncommitted local changes)
- Vantage: https://github.com/TicoAI/vantage · live https://vantage.ticoai.net
- Analysis: `C:\tmp\DonovanLegal\perch-memory-analysis.md` · `perch-legal-compliance-memo.md`
