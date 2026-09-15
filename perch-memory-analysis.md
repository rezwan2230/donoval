# Vantage Returning-Caller Memory — Analysis (2026-06-25)

## Summary verdict
**Vantage HAS a fully built returning-caller memory backend — but the Donovan Pages perch is not wired to use ANY of it.** Vantage persists durable per-person profiles (name/phone/email/summaries) in Firestore, keyed by a first-party `visitor_id`, and exposes read-back endpoints (`/caller-context` for web, `/pre-call` for phone) that return "welcome back" data. The gap is entirely consumer-side: Donovan's `web-call.js` mints the Retell token with **no `visitor_id` and no `retell_llm_dynamic_variables`**, and the perch never calls Vantage's capture/lookup endpoints.

## How identity + memory work (Vantage)
- **Identity (`server/perch.js:10-15`):** mints a v4 uuid client-side, persisted in **localStorage** key `connexus_uuid_<agentId>` (Donovan uses `agent_7d044bab...`). Survives sessions+pages. Exposed as `window.__vantage.vid`. Beacons `GET /visit`.
- **Storage (Firestore, `server.js:203-224`):**
  - `visitors/{uuid}` — recognition: visit_count, first/last_seen, active_contact_id, last_name, first_touch (UTM).
  - `contacts/{id}` (carries visitor_id) — the CRM per PERSON: name, email, phone, company, interest, area, timeline, consent, summaries[].
  - `visits/{id}` — per page-view log (path, referrer, UTM, device).
- **Read-back:**
  - `GET /caller-context?visitor_id=<uuid>` (`server.js:1008-1054`) → `{returning, name, visit_count, email, phone, interest, recent_summaries[], summary, ...}` — the literal "Welcome back, Bob" payload. Auth: `requireWriteSecret` (no-op unless WRITE_SECRET set).
  - `GET /pre-call?from=<E164>` (`server.js:1136-1184`) → top-level string vars for inbound phone. Auth: optional PRECALL_SECRET.
- **Write paths:** `/upsert-lead` (`server.js:1057`), `/save-summary`, post-call `/ingest/retell` (`server.js:1196`, keys by `tel-<phone>`).
- **call↔visitor:** no direct call_id link; uses call-window correlation (`/call-start?visitor_id`, single active call). Donovan perch already fires `callStart()` (`perch.html:112`) — helps WRITE path only, not greeting.

## Exact wiring for "welcome back, Elroy" (all consumer-side; Vantage needs no change)
1. **perch.html** — send the id: `fetch('/web-call',{method:'POST',body:JSON.stringify({visitor_id: window.__vantage?.vid})})` (currently empty POST at `perch.html:107`).
2. **functions/web-call.js** — before minting, server-side `GET https://vantage.ticoai.net/caller-context?visitor_id=<vid>` with `x-write-secret` header, then add to the create-web-call body:
   ```js
   retell_llm_dynamic_variables: {
     returning: String(p.returning), first_name: (p.name||'').split(' ')[0],
     caller_name: p.name||'', email: p.email||'', phone: p.phone||'',
     last_summary: p.summary||'', interest: p.interest||''
   }
   ```
3. **Paola prompt** — conditional opener: if `{{returning}}` true → "Welcome back, `{{first_name}}` — last time we talked about `{{last_summary}}`. Still about `{{interest}}`?" Confirm `{{phone}}`/`{{email}}` rather than re-ask.
4. **Write path** — add a `save_intake` Retell custom-function (Pages Function) POSTing captured fields to Vantage `/upsert-lead` with visitor_id + write-secret, and/or point Paola's post-call Retell webhook at `/ingest/retell`.
5. **CORS** — run all Vantage calls **server-side from Pages Functions** (no Origin header → allowed; keeps WRITE_SECRET off client). donovan.law is NOT in Vantage's CORS allowlist (`server.js:446`).

## Gaps & risks
- MISSING (our side): web-call.js sends `{agent_id}` only; perch.html sends empty POST; no capture endpoint on the Pages perch (only page-control fns). Original donovan-live used an in-memory `leads` Map keyed by call_id (per-call only).
- **PII/SECURITY:** `/caller-context` + `/upsert-lead` are gated by `requireWriteSecret`, **a NO-OP unless WRITE_SECRET is set** (`server.js:135-142`). If unset in prod, `/caller-context?visitor_id=` returns name/phone/email **unauthenticated**. **VERIFY WRITE_SECRET is configured on the Vantage Cloud Run service before wiring.** Same for PRECALL_SECRET on `/pre-call`.
- Do NOT re-enable `MEMORY_FALLBACK_LASTVISITOR` (caused the historical cross-visitor "Ritesh" leak; must stay 0).

**Bottom line:** backend done; "welcome back" data is one server-side fetch away. Build = ~3 small consumer changes + a write path + confirm WRITE_SECRET.
