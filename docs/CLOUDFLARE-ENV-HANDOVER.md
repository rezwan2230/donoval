# Donovan Legal — Cloudflare Environment Handover Reference

**Project:** `donovan-site` (Cloudflare Pages) · Account `aad3aed11a2118a035263e9469e2da1d` (`david-aad`)
**As of:** post-#255 / #257, production deploy #607 (`bcdab71`) live at `www.donovan.law`
**Verification method:** catalog cross-checked against **merged `main` (`bcdab71`)** with `git grep <NAME> -- donovan-legal-site/functions`, tracing indirection through `_lib/` — not a name-vs-endpoint search. (An earlier draft wrongly listed `PERCH_ROUTER` and `WEB_CALL_ALLOWED_ORIGINS` for deletion; both are live and are corrected below.)
**Note on values:** secrets are write-only — the dashboard cannot read a value back, so this catalogs **names and purpose only**.

---

## 1. Live variables — KEEP (do not delete)

| Variable | Env | Purpose | Notes |
|---|---|---|---|
| `CLIO_CLIENT_ID` / `CLIO_CLIENT_SECRET` / `CLIO_REFRESH_TOKEN` | prod + preview | **Clio Manage OAuth** — writes bookings, calendar events, contacts to Clio. | **Most critical.** Without these the site cannot write to Clio. |
| `CLIO_MEMBERS_CLIENT_ID` / `CLIO_MEMBERS_CLIENT_SECRET` / `CLIO_MEMBERS_REFRESH_TOKEN` | prod + preview | Clio OAuth for the **members area** (separate app). | |
| `CLIO_CALENDAR_ID` | prod + preview | Which Clio calendar bookings are written to. | |
| `CLIO_CREATE_CONTACT` | **prod only** | Flag — create a Clio contact on submission. | Preview does not exercise contact creation. |
| `CONSENT_TICKET_SECRET` | prod + preview | Signs the consent ticket on the contact/consent flow. | |
| `GROW_LEAD_TOKEN` | prod + preview | Clio **Grow** lead push. | |
| `MEMBERS_HASH_SALT` / `MEMBERS_SESSION_SECRET` | prod + preview | Members-area auth (password hashing / session signing). | |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | prod + preview | **Cloudflare Turnstile** — bot check on booking + contact forms (`_lib/abuse.js` `verifyTurnstile`). | Booking/contact submission depends on these. Site key is public by design. |
| `PERCH_ROUTER` | **prod** | **Soft-navigation (Swup) feature gate** — `routerEnabled()` in `_lib/perch-router-inject.js` reads it: `on` = soft-nav everywhere incl. prod, `off` = kill switch, unset = `*.pages.dev`/localhost only. Also read by `_middleware.js` for the frame-lock (`X-Frame-Options`) header. | **LIVE — do not delete.** Deleting on prod when set to `on` turns off soft nav and drops a clickjacking header. |
| `WEB_CALL_ALLOWED_ORIGINS` | prod + preview | **Optional origin allow-list override** — `allowedOrigins()` in `_lib/abuse.js`, consumed by `checkOrigin`, which gates the **contact form, consent, and members sign-in**. Falls back to built-in default `["https://www.donovan.law","https://donovan.law"]`. | **LIVE — do not delete.** Prod deletion is harmless only because the default equals the prod origins; **preview deletion breaks contact + members sign-in** (`*.pages.dev` is not in the default). |
| `ANALYTICS` | **prod only** | Analytics on/off flag. | |
| `GOOGLE_SITE_VERIFICATION` | **prod only** | SEO site verification. | |
| `META_CAPI_TOKEN` / `META_DATASET_ID` | **prod only** | Meta Conversions API credentials. | **See §3B — currently inert but keep.** |

**Binding — KEEP:** `PERCH_ACTIONS` (KV namespace `fff1865cad734214acdebf8b3b944289`). Despite the "PERCH" name this is the **live booking + rate-limit KV** (key spaces `booking:`, `booking-idemp:`, `qualbk:`, `rl:`), read by the qualifier→booking join and `_lib/abuse.js` rate limiter. **Do not delete.**

---

## 2. Dead variables — DELETED at handover

Confirmed **zero readers in `donovan-legal-site/functions/` on merged `main`**. These are credentials for the two cancelled services (Retell voice + Vantage) — Paul should not inherit them. All four were removed on 2026-08-22.

| Variable | Env | Was |
|---|---|---|
| `RETELL_API_KEY` | prod + preview | Retell voice API key |
| `RETELL_LAB_AGENT_ID` | preview | Retell lab agent id |
| `PERCH_TOOL_SECRET` | prod + preview | Concierge tool-auth secret |
| `VANTAGE_WRITE_SECRET` | prod + preview | Vantage beacon write secret |

That is the **entire** delete list — four credentials. If a variable is not on this table, keep it.

**Worker `perch-do` — DELETED (decommissioned 2026-08-22).** The `PerchBridge` Durable Object bridge Worker has been permanently removed. It was safe to remove because: the Pages project has **no Durable Object binding** (verified in the project's Bindings), the calling endpoints were deleted in #255, and — decisively — the account contained only **two** apps (`donovan-site` + `perch-do` itself), so no other script in the account could bind the DO (bindings are account-scoped). The DO held only consumed, read-once `qual:<callId>` records; nothing of value was lost. After deletion the account shows a single app, `donovan-site`. *(The `perch-do/` folder and a few tests still import its local source in the repo — separate, harmless repo cleanup, unrelated to the deleted deployed Worker.)*

---

## 3. Findings worth attention (not handover blockers)

**A. Preview does not test the real Clio path.** `BOOKING_PROVIDER` is set in **Preview only**; the only code branch reading it is `env?.BOOKING_PROVIDER === "mock"`, and setting it to `clio` would be redundant with the default — so Preview books against the **mock provider**. (Value is an encrypted secret, not directly readable.) **Consequence:** a preview walkthrough proves the modal/form/request path — **not** the Clio calendar write. Every deploy sign-off needs a **real booking on production with a Clio calendar entry confirmed** (done for this release).

**B. Meta server-side conversions are off.** `META_CAPI_TOKEN` + `META_DATASET_ID` are set in production, but the enabling flag `META_CAPI` is **absent** (guard: `flag === "on" && !!env.META_CAPI_TOKEN && !!env.META_DATASET_ID`). #244's server-side booking conversions have never fired. To enable: add `META_CAPI = on` in production.

**C. Clio refresh tokens are the quiet-failure risk.** `CLIO_REFRESH_TOKEN` and `CLIO_MEMBERS_REFRESH_TOKEN` are most likely to expire silently after handover — if they lapse the site stops writing to Clio with no obvious page-level error. Paul should know they exist, what they do, and how to re-issue them.

**D. Set anywhere, not needed (leave as-is):** `CLIO_INTAKE_FIELD_IDS` (resolved live from the Clio API) and `GROW_BASE` (has a code default).

**E. `workers.dev` subdomain is still `david-aad`.** The account is named *Donovan Legal PLLC*, but its `workers.dev` subdomain is `david-aad.workers.dev` — a leftover from when the account belonged to David. Cosmetic and renameable (Workers & Pages → Account details → Subdomain → pencil). Nothing uses it now that `perch-do` is deleted, but if Paul ever deploys another Worker it would land on `*.david-aad.workers.dev` unless renamed first.
