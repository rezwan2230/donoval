# Perch + Vantage — Combined Roadmap to a Scalable "Perch" (2026-06-29)

Synthesis of two assessments: `assessment-vantage.md` (David's backend) + `assessment-perch.md` (our layer).

## Combined verdict
- **Vantage (David's):** solid, production-functional for ONE busy tenant; not yet multi-tenant-safe. Gates: open PII endpoints, single-instance pin, single-active-call correlation.
- **Perch (ours):** working single-tenant prototype, ~60% to a reusable product. Architecture already right (shell + DO bridge + Functions + beacon contract = generic); implementation hardcodes Donovan in ~7 places, **no config object**.
- **Two gates to "scalable Perch":** (A) Vantage must externalize its in-memory subsystems to scale past one Cloud Run instance [David — big lift]. (B) Perch must extract a per-tenant config to become a stampable template [ours — medium lift, fully in our control].

## P0 — Start here (small/med effort, high impact)
| # | Track | Item | Whose | Effort | Why now |
|---|---|---|---|---|---|
| 1 | 🔴 Security | Set `WRITE_SECRET` + make `/caller-context`,`/pre-call`,`/ingest` FAIL-CLOSED | David (PR) | S | Live PII exposure on prod — anyone with a visitor_id reads name/email/phone |
| 2 | 🔴 Security | Make `VANTAGE_READ_SECRET` REQUIRED on our side + **DELETE `dbg.js` + the dbg KV write** | Ours | S | Pairs with #1; dbg is an unauthenticated live-call info leak |
| 3 | ⭐ Perch | Extract ONE `perch.config.json` + single-source `agent_id`/`deployment` | Ours | M | THE unblock for multi-tenant; kills beacon↔token drift bug; Donovan one-off → stampable template |
| 4 | 🔴 Product gap | Per-deployment **Retell outbound dialer** (provider-pluggable) | David (PR) | M | Donovan's callbacks DON'T fire today (outbound.js is ATHENA-only) — product isn't end-to-end |

## P1 — The scale + productization build
**Vantage (David, PR):** externalize SSE+rate-limit+call-window → Redis + tenant-scope + lift single-instance pin (SC1/R1/S4, **L — the scale gate**) · pass `visitor_id` via Retell call.metadata (R2, M — concurrency-safe link) · CORS derived from deployment site_url (S3, S) · transactions on contact writes (R3, M) · scoped reads + activate rollups/TTL (SC2/SC3).
**Perch (ours):** auto-generate ACTION_MAP from sitemap/crawl (M — kills the worst manual step) · `deploy.sh <tenant>` stamping config→KV/DO/env/`--branch main` (M) · config-drive branding/persona/disclosure + externalize shell JS/CSS → drop `'unsafe-inline'` (M) · key DO by tenant not `'global'` (S) · derive get_page_actions from ACTION_MAP (S) · unify the 2 launcher implementations (M) · remove vestigial PERCH_ACTIONS KV (S).

## P2 — Later / polish
**Vantage:** split server.js (1,807 lines) · tests for tenancy/concurrency · startup config validation (refuse boot with PII endpoints open) · scope `/purge-data` · double-dial CAS · per-tenant caps.
**Perch:** one-project-many-configs by Host (L) · KB ownership decision (Perch artifact vs Retell-side) · parameterize tour · fix Paula/Paola.

## Recommended sequence
1. **This week — security + product-completeness:** #1+#2 (close the PII exposure — urgent, hours) and #4 (Retell dialer — so callbacks actually fire). #1/#4 are David's (PR); #2 is ours.
2. **Our highest-leverage parallel move:** #3 (Perch config extraction) — entirely in our control, ~M, makes "scalable Perch" real. Land it in the `Perch-AI-Concierge-Template` repo (start the SDK).
3. **Then the scale gate:** Vantage SC1 (Redis externalization) — David's big lift; the gate to true multi-tenant; coordinate.

## Whose code (§22)
- **David's (PR, never touch prod unilaterally):** #1, #4, all Vantage P1/P2.
- **Ours (build freely):** #2, #3, all Perch P1/P2 — the Perch SDK is our lane.
