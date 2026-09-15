# Perch Layer — Multi-Tenant Productization Assessment (2026-06-29)

## Verdict
A clever, working single-tenant prototype, ~60% of the way to a reusable product. The ARCHITECTURE is already right (shell + PerchBridge Durable Object + Pages Functions + Vantage beacon contract = genuinely generic, well-conceived). The IMPLEMENTATION hardcodes Donovan values in ~7 places and assumes one tenant per Cloudflare Pages project. Biggest blocker: **no config object at all** — tenant identity is scattered across an inline <script> data-attr, a Pages env default, a 32-entry hand-written ACTION_MAP, and CSS vars baked into perch.html. Top 3 refactors: (1) extract one per-tenant config; (2) auto-generate ACTION_MAP from the site; (3) decide the multi-tenant deploy model (today: one Pages project/tenant + a SINGLE GLOBAL Durable Object instance).

## Hardcoded → config inventory
1. agent_7d044bab… — perch.html:11 (data-agent) + web-call.js:20 (default) → `retell.agent_id` (appears 2× = drift risk)
2. donovan-intake — perch.html:11 + save_lead.js:14 → `vantage.deployment` (2× = drift risk)
3. The 32-entry ACTION_MAP — do_page_action.js:3-20, mirrored in get_page_actions.js:2-9 → `action_map` (most tenant-specific artifact, DUPLICATED across 2 files)
4. Emblem/colors/fonts — perch.html:13,24,41 + donovan-widget.js:14-22 → `branding{}`
5. Persona/disclaimer — perch.html:8,29,44 + web-call.js:72 (verbatim "I'm Paula…") → `persona{}`,`disclosure{}`
6. vantage.ticoai.net — web-call.js:14, save_lead.js:6, perch.html:11 → `vantage.base_url`
7. localStorage keys (donovan_emblem_pos, dvn_widget_pos) → derive from tenant_id
8. CSP origins — _headers:12-13 → `allowed_origins`
9. Tour — perch.html:66-74 → `tour[]`
10. Env vars (RETELL_API_KEY, RETELL_AGENT_ID, VANTAGE_READ_SECRET) → stay env vars (correct)

## Generic (ship into SDK as-is): shell pattern, PerchBridge DO, page-poll.js, perch-inject.js (already harvests every link — seed for auto ACTION_MAP), the beacon contract, web-call.js mechanism. Tenant-specific (parameterize): ACTION_MAP, branding/persona/disclaimer, ids/origins/CSP, tour.

## Onboarding TODAY = ~9 manual error-prone steps (create Retell agent, get deployment id, build KB, HAND-WRITE the 32-entry ACTION_MAP + keep get_page_actions in sync, wire webhooks, set env vars, edit perch.html branding/ids, edit _headers CSP, KV+DO+deploy --branch main). Automate: auto-gen ACTION_MAP from sitemap; perch.config.json single source; deploy.sh <tenant>; Retell agent via API.

## Deploy model rec: near-term one Pages project/tenant + shared perch-do worker. **DO needs per-tenant isolation: do_page_action.js:33 + page-poll.js:8 both call idFromName('global') — single global instance across ALL tenants. Fix: idFromName(tenant_id). Cheap, big isolation win.** Longer term: one-project-many-configs by Host header + per-request CSP (defer).

## Hardening/cleanup (P0): DELETE dbg.js + the 'dbg' KV write (do_page_action.js:30) = unauthenticated live-call info leak. PERCH_ACTIONS KV vestigial (DO replaced it). Make VANTAGE_READ_SECRET REQUIRED (web-call.js:31 — /caller-context open exposes name/email/phone/summary). CSP still has 'unsafe-inline' (perch.html all-inline → can't drop until shell JS/CSS externalized). Fix Paula/Paola (web-call.js:72) via config single-source.

## Per-tenant config schema (perch.config.json): tenant_id, display_name, retell{agent_id,sdk_url}, vantage{base_url,deployment,beacon_url}, persona{name,brand_label,cta_label}, disclosure{short,begin_message_template}, branding{emblem,colors,fonts,emblem_size}, site{index,iframe_src}, action_map{} + action_map_source, tour[], security{allowed_origins,shell_origin}. Secrets (RETELL_API_KEY, VANTAGE_READ_SECRET) stay env vars per tenant.

## Roadmap: P0 = config extraction (M) + single-source ids (S) + delete dbg (S) + require VANTAGE_READ_SECRET (S). P1 = auto-gen ACTION_MAP (M) + deploy.sh (M) + config-drive branding/persona + externalize shell→drop unsafe-inline (M) + DO key by tenant (S) + derive get_page_actions from ACTION_MAP (S) + unify 2 launchers (M) + remove KV (S). P2 = one-project-many-configs (L) + KB ownership + parameterize tour.
