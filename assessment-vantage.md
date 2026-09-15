# Vantage Backend — Production-Readiness & Scalability Assessment (2026-06-29)

> David Pierce's production system (built by Zane), live at vantage.ticoai.net (Cloud Run `connexus-mcp`, project `tico-ai-prod`). Per §22, every fix is a PROPOSAL to PR to David — not changed unilaterally. CI requires PR + 1 review into main.

## Summary verdict
Competent, deliberately-built single-instance system, production-functional for current scale (one real tenant + a couple seeded) but NOT yet safe for true multi-tenant production. Three load-bearing assumptions break under real multi-tenant load: (1) write/PII endpoints effectively OPEN (requireWriteSecret no-op unless WRITE_SECRET set; live env doesn't set it); (2) single-active-call correlation window silently refuses/misattributes under ANY concurrency (two simultaneous callers across all tenants collapse correlation); (3) pinned to one Cloud Run instance (min/max=1) because rate-limit, SSE hub, call-correlation are in process memory. The 2026-06-11 "Ritesh" cross-visitor PII leak is architecturally fixed (lastVisitor off by default) but its replacement re-introduces a milder version under concurrency. **Biggest risks: open PII read/write endpoints, single-instance ceiling, cross-tenant correlation bleed.**

## Architecture & multi-tenancy
- Tenancy model good: Org→Deployment registry `deployments/{id}` (server.js:224, seeded :275-281). Writes tagged {deployment,org} via tagOf() (:239-242); reads scope via scopeFilter() (:266-271). Donovan (donovan-intake, donovan-main, platform:retell) + ConnexUS seeded.
- Data model (:213-224): visitors/{uuid}=browser recognition; contacts/{auto-id}=per-person CRM; visits/{auto-id}=page-view log (90-day TTL); bookings/{auto-id}=callbacks; analytics_daily/{dep}__{date}=rollups. visitors-vs-contacts split is the correct fix.
- **Isolation is logical not enforced** — tenancy is a field, applied at write + filtered at read in app code. No Firestore security-rule/row-level boundary. Several reads scan ALL tenants then filter in memory (/visits, /analytics, /crm, /bookings all .limit(5000).get() then inScope()).

## Prioritized issues

### Security
- **S1 P0/S — Write/PII endpoints open by default.** requireWriteSecret returns next() unless WRITE_SECRET set (:135-142). Gates /caller-context(:1008), /upsert-lead(:1057), /save-summary(:1108), /publish(:513). Live env sets ADMIN_SECRET/PLATFORM_API_KEY/PRECALL_SECRET but NOT WRITE_SECRET (HANDOFF:62-66) → unauthenticated. FIX: set WRITE_SECRET now + fail-closed (503 if no secret).
- **S2 P0/S — /pre-call and /ingest/retell open unless optional secrets set.** /pre-call returns full PII, checks PRECALL_SECRET only if present (:1136-1141). /ingest/retell checks RETELL_WEBHOOK_SECRET only if present (:1198-1202). FIX: fail-closed; verify Retell signature.
- **S3 P1/S — CORS allowlist hardcoded** (:446-447), not derived from deployment site_url; donovan.law not in list. Origin-pin derives from site_url (:251-262) but only writes, defaults report-only. FIX: derive CORS from registry site_url; ORIGIN_PIN=enforce.
- **S4 P1/M — Cross-tenant leak via global SSE hub + correlation state.** channels/lastBroadcast/lastContext/lastVisitor/activeWebCalls global not tenant-scoped (:413,529,535,567). Channel-less /publish broadcasts to ALL browsers across tenants (:440). FIX: scope hubs by {deployment}; forbid channel-less broadcast.
- **S5 P1/S — No per-tenant rate-limit isolation;** per-IP-per-instance in memory (:90-104), resets on deploy, bypassed across instances; clientIp trusts first XFF hop (:86-89). FIX: shared store keyed {deployment,ip}.
- **S6 P2/S — /purge-data deletes ALL tenants' data** (:783-809). FIX: scope by deployment.
- **S7 P2/S — Shared admin secret valid fallback** unless REQUIRE_SSO=1 (:183-201). FIX: REQUIRE_SSO=1, retire shared secret.

### Robustness / Concurrency
- **R1 P0/M — Single-active-call window globally singular not per-tenant.** activeCallVid() returns "" when activeWebCalls.size!==1 (:573-577), shared across ALL deployments → any 2 concurrent callers anywhere refuse anonymous writes (no_stable_visitor_id) → leads lost. FIX: key by {deployment}; real fix R2.
- **R2 P1/M — Retell web calls can't pass visitor_id via metadata.** vid not threaded into Retell call-create metadata; /ingest/retell derives identity from phone/call_id (:1222-1224). FIX: pass Perch visitor_id into Retell call.metadata at create + read in /ingest + agent tools → eliminates window dependency.
- **R3 P1/M — resolveContactId is read-modify-write, no transaction** (:312-329). Concurrent writes race active_contact_id → duplicate/split contacts. FIX: db.runTransaction.
- **R4 P2/S — /run-callbacks double-dial guard best-effort** (:1645-1655), status flip not transactional. FIX: transactional compare-and-set.
- **R5 P2/S — newest-record selection by string compare + .limit(10) truncation** (:1155,1169). FIX: orderBy().limit(1).

### Scalability
- **SC1 P0/L — Hard-pinned to one instance** (min/max=1, HANDOFF:85) because SSE hub(:62)+rate limiter(:80-85)+call-window(:567) in process memory. SPOF + fixed throughput ceiling + restart drops live SSE. FIX: externalize the 3 (Redis Pub/Sub for SSE, shared store for rate-limit + call-window), then lift pin. **The gating work for multi-tenant scale.**
- **SC2 P1/M — List/analytics scan up to 5000 docs across all tenants** then filter (/visits:834, /analytics:864-867, /crm:1375, /bookings:1603). Indexes + rollups built but reads don't use them. FIX: deployment-scoped where()+cursor pagination; point /analytics at analytics_daily.
- **SC3 P1/S — Rollup + TTL need manual one-time activation** (TTL via CLI :692-693; /rollup needs Cloud Scheduler). FIX: verify live + add to IaC.
- **SC4 P2/S — In-memory maps capped by count not tenant fairness** (MAX_CHANNELS=500, MAX_CTX=2000 :426). One noisy tenant starves others. FIX: per-tenant caps or Redis.

### Feature gaps (Retell product)
- **F1 P0/M — No Retell outbound/callback path.** outbound.js Visium/ATHENA-only, hardcoded portal.theconnexus.ai/api/v1/calls + assistant_id/X-API-Key (:15-17,68-72). dialBooking→placeCall always uses this (:1647). **Retell tenants (Donovan) can't have callbacks auto-dialed.** FIX: add Retell outbound provider (create-phone-call) selected by deployment.platform; provider-pluggable placeCall with per-deployment BYO creds (Secret Manager). **Single biggest product gap for Donovan.**
- **F2 P1/M — Visitor-id beacon key fragmentation.** connexus_uuid_<agent> if data-agent set else vantage_uuid_<deployment> (perch.js:10). If data-agent ≠ voice SDK agent id → page beacon + voice call mint different ids → CRM never joins. (We just hit + fixed this on Donovan's side.) FIX: document/validate agent-id contract; "ids match ✓" check.
- **F3 P2/S — /ingest/retell trusts shared secret not Retell signature** (:1210-1221); consent (TCPA) fields NOT extracted from Retell → can't drive consent-gated callbacks. FIX: verify signature; map consent fields.

### Code quality
- **Q1 P1/L — server.js 1,807 lines/104KB** — routing+auth+Firestore+MCP+SSE+booking+analytics+HTML in one module. FIX: split modules.
- **Q2 P1/M — Thin tests** (only booking-logic + origin-pin; CI = node --check + node --test pure logic). Risky concurrency logic untested. FIX: unit tests for scopeFilter/differentPerson/resolveContactId + emulator integration tests.
- **Q3 P2/S — ~20 scattered env vars, no startup validation** — missing/typo'd secret silently opens endpoint. FIX: startup config-validation; refuse to boot in prod with PII endpoints open.
- **Q4 P2/S — package name/version drift** (connexus-mcp v0.1.0 vs MCP v0.2.0). FIX: rename vantage, align.

## Top PR-to-David priorities
1. S1+S2 (P0, hours) — set WRITE_SECRET + fail-closed on /pre-call + /ingest/retell. Closes open PII today.
2. F1 (P0, days) — per-deployment Retell outbound dialer so Donovan callbacks fire (product doesn't work end-to-end without it).
3. SC1+R1+S4 (P1, real productization) — externalize the 3 in-memory subsystems (Redis), tenant-scope them, lift single-instance pin.
