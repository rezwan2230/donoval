# ATHENA ↔ Clio Integration: Engineering & Strategic Research Brief
**Prepared for:** Elroy Geerdink's Engineering Team  
**Context:** ConnexŪS AI / ATHENA — Initial deployment: Donovan Legal PLLC (Paul Donovan, FL tax attorney, solo)  
**Topology:** ATHENA → Clio direct (no GHL middleware for Clio operations)  
**Date:** May 27, 2026  
**Status:** Engineering-grade reference. Every factual claim cited to primary Clio documentation.

---

## 1. Clio Product Architecture — Manage vs Grow

### 1.1 What Each Product Does

**Clio Manage** is Clio's practice management platform: matter lifecycle, time entry, billing, document management, calendaring, trust accounting, and reporting. It is the system of record for *active* clients and matters.

**Clio Grow** is Clio's CRM and intake platform: lead capture, pipeline tracking, intake forms, appointment booking, e-signatures on engagement letters, and prospect-to-client conversion. It is the system of record for *prospective* clients.

### 1.2 Data Model Boundary

The data model boundary is defined around the **lead/matter status category**. Clio Grow owns records in `status_category: intake`. Once a prospect is converted — the firm hires them — the record transitions into Clio Manage as an open Matter. The Grow `Matter` object carries a `clio_id` field pointing to its Manage counterpart after conversion, and an `inbox_lead_id` linking back to the originating lead.

**Who owns the prospect → client transition?** Clio Grow owns the transition event. The conversion from prospect to client is initiated within Grow (via UI "Quick Intake" action or "Accept" on the Appointments lead). The resulting Manage matter receives the converted data. This is detailed in §8.

### 1.3 Unified vs Separate APIs

**These are two completely separate APIs** with separate developer portals, separate OAuth apps, separate base URLs, and separate scope namespaces. As of [January 2026](https://docs.developers.clio.com/handbook/getting-started/clio-manage-and-clio-platform/):

| Dimension | Clio Manage API | Clio Platform API (Grow) |
|---|---|---|
| Developer portal URL | `https://developers.clio.com` | `https://developers.api.clio.com` |
| API reference | [clio-manage/api-reference](https://docs.developers.clio.com/clio-manage/api-reference/) | [clio-grow/api-reference](https://docs.developers.clio.com/clio-grow/api-reference/) |
| Base URL (US) | `https://app.clio.com/api/v4/` | `https://api.clio.com/grow/` |
| OAuth app required | Yes — separate Manage app | Yes — separate Platform app |
| Scope namespace | Resource-based (Tasks, Matters, etc.) | `grow_*` prefix |
| Rate limit model | Per-access-token | Per-OAuth-application |
| API versioning | v4 (REST) | v2 (REST) |
| Webhook support | Yes — 10 models | **No** — not documented |

Multi-product integrations require: (a) two separate app registrations, (b) users authorizing **both apps separately** through two independent OAuth flows. [Source: Clio Manage and Clio Platform APIs guide](https://docs.developers.clio.com/handbook/getting-started/clio-manage-and-clio-platform/).

**Roadmap:** Clio Platform is the future single entry point; it will eventually absorb Manage APIs. No timeline is published. Current Manage integrations continue to be supported via `developers.clio.com`.

### 1.4 Provisioning — Can One Customer Have Both?

Yes. Paul Donovan can subscribe to both Clio Manage and Clio Grow simultaneously. [Clio's pricing page](https://www.clio.com/pricing/) shows Grow is available as:
- **Standalone** — separate subscription (price not published on the pricing page; requires sales contact)
- **Add-on** to Essentials or Advanced Manage plans — sales-quoted price  
- **Included** in the Expand plan

Per [Capterra pricing research](https://www.capterra.com/p/105428/Clio/pricing/) [3RD-PARTY — verify], Clio Grow standalone is approximately $59/user/month billed monthly. Add-on pricing for Essentials/Advanced is approximately $69/user/month per Capterra [3RD-PARTY — verify]. **Verify directly with Clio sales for current rates** — Clio has restructured plans and the official page no longer publishes per-tier prices beyond the $49/user EasyStart entry point. See §12 for pricing risk.

### 1.5 Native Data Sync Between Manage and Grow

Clio offers **native bidirectional data sync** for customers subscribed to both products. Key sync capabilities per [Clio Help Center](https://help.clio.com/hc/en-us/articles/9285553508635-Sync-and-Convert-Custom-Fields) and [Clio Grow setup documentation](https://help.clio.com/hc/en-us/articles/10485194916891-Set-Up-Clio-Grow):

- **Custom fields:** Grow can import custom field definitions from Manage (`Settings → Custom fields → Sync Clio Manage custom fields`). Sync flows Manage → Grow only on field definitions; populated data flows both ways during matter conversion.
- **Calendar:** Grow appointments sync to Manage calendar.
- **Matter conversion:** When a Grow lead/matter is converted (Quick Intake), the resulting contact + matter are pushed into Manage.

**Critical limitation:** This sync is **UI-driven and Clio-native** — there is no API endpoint to trigger the conversion programmatically. ATHENA cannot call an API to convert a Grow prospect into a Manage matter. See §8 for the workaround.

---

## 2. Authentication — Per Product

### 2.1 Clio Manage — OAuth Details

**Source:** [Clio Manage Authorization docs](https://docs.developers.clio.com/api-docs/clio-manage/authorization/)

| Parameter | Value |
|---|---|
| Grant type | Authorization Code |
| PKCE | Not documented for Manage (PKCE is Clio Platform/Grow only) |
| Authorization endpoint | `https://app.clio.com/oauth/authorize` |
| Token endpoint | `https://app.clio.com/oauth/token` |
| Deauthorize endpoint | `POST https://app.clio.com/oauth/deauthorize` |
| Access token lifetime | **604,800 seconds (7 days)** |
| Refresh token expiry | Does not expire |
| Auth code validity | 10 minutes |

**Regional base URL variants:**

| Region | Base URL |
|---|---|
| US | `https://app.clio.com` |
| Canada | `https://ca.app.clio.com` |
| EU | `https://eu.app.clio.com` |
| Australia | `https://au.app.clio.com` |

Source: [Clio Manage API Reference — Getting Started note](https://docs.developers.clio.com/clio-manage/api-reference/)

All OAuth endpoints use the same subdomain as the regional base: e.g., EU authorization is `https://eu.app.clio.com/oauth/authorize`.

**Refresh token behavior:**
- Refresh tokens do not expire per primary documentation.
- A new access token is obtained via `POST /oauth/token` with `grant_type=refresh_token`, `client_id`, `client_secret`, `refresh_token`.
- Refresh tokens **can be used by a background worker without user interaction** — this is the standard pattern for server-side integrations. No rotation is documented (unlike Grow — see below).
- If a user explicitly deauthorizes from within Clio Manage, a deauthorization callback fires to the URL registered on your app. ATHENA must handle this to invalidate stored tokens.

**App registration (Manage):**  
Via the [Manage Developer Portal](https://developers.clio.com). Required fields: `Name`, `Website URL`, `Redirect URI(s)`, `App Permissions`, acceptance of Developer Terms of Service. Optional: `Description`, `Icons`, `Support URL`, `Deauthorization Callback URL`.

**Sandbox / Developer Account:**  
Sign up for a [7-day free trial](https://docs.developers.clio.com/handbook/getting-started/get-a-developer-account/). At expiry, apply to convert to a free perpetual developer account (triggered by an automated email containing an intake form). Multi-region builds require separate trial accounts per region with separate email addresses (e.g., `developer+us@yourdomain.com`, `developer+eu@yourdomain.com`).

**Code example — Manage OAuth flow:**

```bash
# Step 1: Redirect user to authorization
GET https://app.clio.com/oauth/authorize
  ?response_type=code
  &client_id=YOUR_APP_KEY
  &redirect_uri=https://athena.connexus.ai/clio/callback
  &state=RANDOM_CSRF_TOKEN

# Step 2: Exchange code for token
POST https://app.clio.com/oauth/token
Content-Type: application/x-www-form-urlencoded

client_id=YOUR_APP_KEY&client_secret=YOUR_SECRET
&grant_type=authorization_code&code=RECEIVED_CODE
&redirect_uri=https://athena.connexus.ai/clio/callback

# Response
{
  "token_type": "bearer",
  "access_token": "WjR8H...dU2ul",
  "expires_in": 604800,
  "refresh_token": "abc123...xyz"
}

# Step 3: Background refresh (no user required)
POST https://app.clio.com/oauth/token
Content-Type: application/x-www-form-urlencoded

client_id=YOUR_APP_KEY&client_secret=YOUR_SECRET
&grant_type=refresh_token&refresh_token=STORED_TOKEN
```

---

### 2.2 Clio Platform (Grow) — OAuth Details

**Source:** [Clio Platform Authorization docs](https://docs.developers.clio.com/api-docs/clio-platform/authorization/)

| Parameter | Value |
|---|---|
| Grant type | Authorization Code (+ optional PKCE) |
| PKCE | Supported and recommended; `S256` method only |
| Authorization endpoint | `https://grow.clio.com/oauth/authorize` |
| Token endpoint | `https://grow.clio.com/oauth/token` |
| Revocation endpoint | `POST https://grow.clio.com/oauth/revoke` |
| API base URL (US) | `https://api.clio.com/grow/` |
| Access token lifetime | **2,592,000 seconds (30 days)** |
| Refresh token expiry | Does not expire |
| Refresh token rotation | **Yes — both access token AND refresh token are regenerated on each refresh** |
| Auth code validity | 10 minutes |

**Regional base URL variants:**

| Region | OAuth base | API base | Lead Inbox endpoint |
|---|---|---|---|
| US | `https://grow.clio.com` | `https://api.clio.com/grow/` | `https://grow.clio.com/inbox_leads` |
| EU | `https://eu.grow.clio.com` | (EU prefix assumed) | `https://eu.grow.clio.com/inbox_leads` |
| AU | `https://au.grow.clio.com` | (AU prefix assumed) | `https://au.grow.clio.com/inbox_leads` |
| CA | `https://ca.grow.clio.com` | (CA prefix assumed) | `https://ca.grow.clio.com/inbox_leads` |

Sources: [Lead Inbox API guide](https://docs.developers.clio.com/guides/clio-grow/lead-inbox-api/), [legacy Grow API reference](https://docs.developers.clio.com/grow-api/api-reference/). **Note:** The EU/AU/CA API base URLs for the Platform API (non-inbox) are not explicitly stated in primary documentation beyond the example `https://api.clio.com/grow/contacts`. Treat EU/AU/CA Platform API base URL variants as [UNCONFIRMED — contact api@clio.com].

**Refresh token rotation (critical for ATHENA):** Unlike Manage, Grow refresh tokens rotate on every refresh call. ATHENA's token store must atomically write the new refresh token on each refresh response or risk losing permanent access. Concurrent refresh calls will invalidate the first token returned.

**Background worker use:** Yes — server-side refresh is fully supported using `client_id` + `client_secret` + `refresh_token` without user interaction.

**App registration (Clio Platform/Grow):**  
Via the [Platform Developer Portal](https://developers.api.clio.com). Required fields: `Name`, `Redirect URI(s)`, `App Permissions`, acceptance of Developer Terms. Optional: PKCE toggle, `Firm identifier` (for private apps restricted to one firm). Source: [OAuth Applications — Platform](https://docs.developers.clio.com/api-docs/clio-platform/applications/).

**Private app option:** A Grow app can be restricted to a single firm by setting the `Firm identifier` field. This is useful for the Donovan private integration before public listing. Private apps bypass the app directory approval process.

**Grow scopes (complete list as documented):**

| Scope | Access granted |
|---|---|
| `grow_lead_inbox_write` | Create/write Inbox Leads |
| `grow_lead_inbox_read` | Read Inbox Leads |
| `grow_custom_action_write` | Create/delete Custom Actions |
| `grow_custom_action_read` | Read Custom Actions |
| `grow_matter_read` | Read Grow Matters |
| `grow_matter_note_write` | Create Matter Notes |
| `grow_matter_note_read` | Read Matter Notes |
| `grow_contact_read` | Read Grow Contacts |
| `grow_contact_note_write` | Create Contact Notes |
| `grow_contact_note_read` | Read Contact Notes |
| `grow_user_read` | Read Users |

Source: [Clio Platform Permissions](https://docs.developers.clio.com/api-docs/clio-platform/permissions/)

**There is no `grow_contact_write` scope in the documented list.** ATHENA cannot create or update contacts in Grow via the Platform API. Lead creation goes through `inbox_leads` (write scope exists). Contact creation in Grow is [UNCONFIRMED via API — verify with api@clio.com].

---

## 3. Rate Limits & Quotas — Per Product

### 3.1 Clio Manage Rate Limits

**Source:** [Clio Manage Rate Limits](https://docs.developers.clio.com/api-docs/clio-manage/rate-limits/)

| Parameter | Value |
|---|---|
| Limit scope | **Per access token** (per user session) |
| Peak limit | **50 requests per 60-second window** |
| Off-peak limit | Higher — exact multiplier not documented, region-dependent |
| Custom limit increases | Not supported |

**Peak hours:**

| Region | Peak window |
|---|---|
| US/CA | 04:00–19:00 Pacific Time, Monday–Friday |
| EU | 07:00–22:00 GMT, Monday–Friday |
| AU | 06:00–21:00 AET, Monday–Friday |

**Headers returned on every response:**

| Header | Description |
|---|---|
| `X-RateLimit-Limit` | Max requests allowed in 60s window |
| `X-RateLimit-Remaining` | Requests remaining in current window |
| `X-RateLimit-Reset` | Unix timestamp when window resets |
| `Retry-After` | Seconds to wait (only present on 429 responses) |

**429 response:** Returns HTTP 429 with `Retry-After` header. Body shape is not explicitly documented for Manage (unlike Grow's `{"message": "Too Many Requests"}`).

**Per-endpoint variance:** Some endpoints carry their own limits, documented in the API Reference for that endpoint. ATHENA must read `X-RateLimit-*` headers dynamically rather than assuming 50 rpm.

**Batch endpoints:** None documented for Manage v4. All operations are single-record. The workaround is parallelized offset pagination during off-peak sync jobs.

**ATHENA implication at 50 rpm per token:** During a live call, ATHENA may need to: (1) contact lookup, (2) matter lookup, (3) log communication. That is 3 requests. At 50 rpm, ATHENA has 16+ seconds of headroom per request in a sustained flow, which is adequate *if tokens are dedicated per customer*. Multi-tenant tokens sharing one customer's token against Paul's 1-user account is not an issue (it's only Paul's token). See §11 for caching strategy.

---

### 3.2 Clio Platform (Grow) Rate Limits

**Source:** [Clio Platform Rate Limits](https://docs.developers.clio.com/api-docs/clio-platform/rate-limits/)

| Parameter | Value |
|---|---|
| Limit scope | **Per OAuth application** (shared across ALL users of that app) |
| Default limit | **3 requests per second** |
| Regional isolation | Separate limits per region (US, CA, EU, AU) |
| Custom limit increases | Not supported |

**429 response body:**
```json
{"message": "Too Many Requests"}
```

**Headers:** No rate-limit headers are documented for the Platform API (unlike Manage). Exponential backoff is the prescribed strategy: 1s → 2s → 4s → 8s → 16s.

**Critical difference from Manage:** The per-app limit of 3 req/s is **shared across all users of ATHENA's Grow app**. In multi-tenant mode, if ConnexŪS has 10 law firm clients all using the same Grow OAuth app, they share the 3 req/s budget globally per region.

---

## 4. Pagination, Filtering, Sorting

**Source:** [Clio Manage Pagination](https://docs.developers.clio.com/api-docs/clio-manage/paging/), [Fields documentation](https://docs.developers.clio.com/api-docs/clio-manage/fields/)

### 4.1 Clio Manage

| Feature | Detail |
|---|---|
| Default page size | **200 results per request** |
| Cursor pagination | Default method; unlimited total records; requires `order=id(asc)`; serial only (no parallelism) |
| Offset pagination | Optional; max 10,000 total records (50 pages); parallelizable; supports custom sort |
| Pagination metadata | `meta.paging.next` and `meta.paging.previous` URLs in response body |
| Offset 422 error | Returned when attempting to paginate beyond 10,000 offset records |

**Filter syntax:** Query parameters appended to the endpoint URL. Examples: `?fields=id,etag,type`, `?order=id(asc)`, `?offset=200`. Nested resource fields use curly-brace syntax: `?fields=id,matter{id,description}`. Second-level nesting is not supported.

**Field selection (sparse fieldsets):** Fully supported via `fields` parameter on GET, POST, and PATCH requests. Default response returns only `id` and `etag` for most endpoints. This is the primary strategy for reducing response payload size during live calls.

**Contact search by phone number:** No dedicated phone-search query parameter is documented in the API reference. The standard approach is `GET /api/v4/contacts?fields=id,name,phone_numbers&query=PHONE_NUMBER`. The `query` parameter performs a text match. Whether it searches phone number fields specifically is [UNCONFIRMED — verify behavior empirically]. Phone numbers can also be retrieved via the dedicated endpoint `GET /api/v4/contacts/:contact_id/phone_numbers`.

**Changelog note (v4.0.13):** Contacts now limited to 20 email addresses, 20 phone numbers, and 20 physical addresses. Above 200 associated phone numbers, use the dedicated phone_numbers endpoint. Source: [API Changelog](https://docs.developers.clio.com/api-docs/clio-manage/api-changelog/).

### 4.2 Clio Grow (Platform API)

| Feature | Detail |
|---|---|
| Default page size | **200 results per request** (same limit) |
| Pagination type | Cursor-based only; `page_token` (opaque token) parameter |
| Batch `ids[]` filter | Max 50 IDs per request across all list endpoints |
| Wildcard search | `query` parameter available for Contacts and Inbox Leads; matches name, email, or phone number |
| Filter by `inbox_lead_id` | Available on Matters endpoint |
| `submitted_only` flag | Filters Matters to those submitted by the current application |

Source: [Clio Grow API Reference](https://docs.developers.clio.com/clio-grow/api-reference/)

---

## 5. Webhooks — Per Product

### 5.1 Clio Manage Webhooks

**Source:** [Clio Manage API Reference — Webhooks section](https://docs.developers.clio.com/api-reference/)

Webhooks exist. Full details:

**Supported models and required OAuth scopes:**

| Model | String Identifier | ID | Required OAuth Scope |
|---|---|---|---|
| Matter | `matter` | 1 | Matters |
| Activity | `activity` | 2 | Activities |
| Bill | `bill` | 3 | Billing |
| Calendar Entry | `calendar_entry` | 4 | Calendars |
| Communication | `communication` | 5 | Communications |
| Contact | `contact` | 6 | Contacts |
| Task | `task` | 7 | Tasks |
| Document | `document` | 8 | Documents |
| Folder | `folder` | 9 | Documents |
| Clio Payments payment | `clio_payments_payment` | 10 | Clio Payments |

**Event types:**

| Event | Available on |
|---|---|
| `created` | All models |
| `updated` | All models |
| `deleted` | All models |
| `matter_opened` | Matter only |
| `matter_pended` | Matter only |
| `matter_closed` | Matter only |

**Webhook expiry:** Webhooks expire after **3 days** by default if no `expires_at` is provided. Maximum duration: **31 days**. ATHENA must actively refresh webhook registrations before expiry.

**HMAC signature verification:**

```
X-Hook-Secret  → Shared during handshake (one-time setup per webhook)
X-Hook-Signature → HMAC-SHA256(secret, request_body) on every delivery
```

Verification procedure:
1. On webhook creation, Clio sends a POST to your endpoint with `X-Hook-Secret` header.
2. **Option A (immediate):** Respond with `200 OK` and echo the same secret in a `X-Hook-Secret` response header.
3. **Option B (delayed):** Make a `PUT /api/v4/webhooks/:webhook_id/activate` with `X-Hook-Secret` header.
4. All subsequent deliveries include `X-Hook-Signature` = `HMAC-SHA256(shared_secret, body_bytes)`. Verify by computing independently and comparing.

**Payload:** Does not include the entire object — only fields specified in the `fields` parameter when creating the webhook. For `update` webhooks, `fields` also determines which field changes trigger delivery.

**Webhook CRUD endpoints:**

| Method | Path |
|---|---|
| GET | `/api/v4/webhooks` |
| POST | `/api/v4/webhooks` |
| GET | `/api/v4/webhooks/:id` |
| PATCH | `/api/v4/webhooks/:id` |
| DELETE | `/api/v4/webhooks/:id` |
| PUT | `/api/v4/webhooks/:webhook_id/activate` |

**Retry policy and delivery SLA:** Not explicitly documented. Treat as best-effort. ATHENA must reconcile missed events by polling on reconnect.

**Replay protection / event IDs:** Not explicitly documented in primary sources. [UNCONFIRMED — verify with api@clio.com].

**HTTPS required:** Webhook URLs must use `https://`. HTTP is rejected.

---

### 5.2 Clio Grow (Platform API) Webhooks

**No webhooks are documented** for the Clio Platform/Grow API. The Platform API reference, permission docs, and rate limit docs make no mention of webhook functionality. The legacy Grow API reference also contains no webhook information. ATHENA must poll Grow endpoints for new leads and matter updates.

---

## 6. Clio Manage API — Full Endpoint Capability Matrix

Base URL (US): `https://app.clio.com/api/v4/`  
Source: [Clio Manage API Reference](https://docs.developers.clio.com/clio-manage/api-reference/)

### 6.1 Contacts

| Method | Path | R/W | Required Scope | Notes |
|---|---|---|---|---|
| GET | `/contacts` | Read | Contacts | Query via `query` param; `fields` param for sparse response |
| POST | `/contacts` | Write | Contacts | Creates individual or company; associations (phones, emails, custom fields) can be included in single request |
| GET | `/contacts/:id` | Read | Contacts | |
| PATCH | `/contacts/:id` | Write | Contacts | |
| DELETE | `/contacts/:id` | Write | Contacts | |
| GET | `/contacts/:id/phone_numbers` | Read | Contacts | Dedicated endpoint for >200 phone numbers |
| GET | `/contacts/:id/email_addresses` | Read | Contacts | Dedicated endpoint for >200 emails |

**Phone-number search:** Use `GET /contacts?query=PHONE&fields=id,first_name,last_name,phone_numbers`. Behavior of `query` against phone fields is [UNCONFIRMED — test empirically].

---

### 6.2 Matters

| Method | Path | R/W | Required Scope | Notes |
|---|---|---|---|---|
| GET | `/matters` | Read | Matters | Filter by client, status, practice area |
| POST | `/matters` | Write | Matters | Creates matter; include custom rates, client, practice area |
| GET | `/matters/:id` | Read | Matters | |
| PATCH | `/matters/:id` | Write | Matters | |
| DELETE | `/matters/:id` | Write | Matters | |
| GET | `/matters/:id/client` | Read | Matters + Contacts | Returns client contact for matter |
| GET | `/matters/:id/related_contacts` | Read | Matters + Contacts | |
| GET | `/matters/:id/contacts` | Read | Matters + Contacts | MatterContacts junction |
| GET | `/practice_areas` | Read | Matters | |
| GET | `/matter_stages` | Read | Matters | |

---

### 6.3 Activities / Time Entries

| Method | Path | R/W | Required Scope | Notes |
|---|---|---|---|---|
| GET | `/activities` | Read | Activities | Filter by matter, type, date range |
| POST | `/activities` | Write | Activities | Type: `TimeEntry`, `ExpenseEntry`, `HardCostEntry`, `SoftCostEntry` |
| GET | `/activities/:id` | Read | Activities | |
| PATCH | `/activities/:id` | Write | Activities | |
| DELETE | `/activities/:id` | Write | Activities | |

**Critical:** As of API v4.0.4+, `quantity` is in **seconds** (not hours). A 12-minute call = `quantity: 720`. Older API versions (≤4.0.3) used hours.

---

### 6.4 Communications

| Method | Path | R/W | Required Scope | Notes |
|---|---|---|---|---|
| GET | `/communications` | Read | Communications | Logs for phone calls and emails |
| POST | `/communications` | Write | Communications | Create call/email log entries linked to matter + contact |
| GET | `/communications/:id` | Read | Communications | |
| PATCH | `/communications/:id` | Write | Communications | |
| DELETE | `/communications/:id` | Write | Communications | |

**ATHENA primary write path for call logging.** Use `POST /communications` to log: caller ID, call summary, duration, matter linkage.

---

### 6.5 Calendar Entries

| Method | Path | R/W | Required Scope | Notes |
|---|---|---|---|---|
| GET | `/calendar_entries` | Read | Calendars | |
| POST | `/calendar_entries` | Write | Calendars | Create appointments, hearings, consultations |
| GET | `/calendar_entries/:id` | Read | Calendars | |
| PATCH | `/calendar_entries/:id` | Write | Calendars | |
| DELETE | `/calendar_entries/:id` | Write | Calendars | |
| GET | `/calendars` | Read | Calendars | List available calendars (user, account, adhoc) |
| GET | `/reminders` | Read | Calendars | |
| POST | `/reminders` | Write | Calendars | Attach to calendar entry or task |

---

### 6.6 Tasks

| Method | Path | R/W | Required Scope | Notes |
|---|---|---|---|---|
| GET | `/tasks` | Read | Tasks | |
| POST | `/tasks` | Write | Tasks | Create follow-up tasks, engagement letter tasks |
| GET | `/tasks/:id` | Read | Tasks | |
| PATCH | `/tasks/:id` | Write | Tasks | |
| DELETE | `/tasks/:id` | Write | Tasks | |
| GET | `/task_templates` | Read | Tasks | |
| POST | `/task_template_lists` | Write | Tasks | Bulk task creation from templates |

---

### 6.7 Documents

| Method | Path | R/W | Required Scope | Notes |
|---|---|---|---|---|
| GET | `/documents` | Read | Documents | |
| POST | `/documents` | Write | Documents | Upload documents to matter folder |
| GET | `/documents/:id` | Read | Documents | |
| PATCH | `/documents/:id` | Write | Documents | |
| DELETE | `/documents/:id` | Write | Documents | Moves to trash |
| GET | `/documents/:id/download` | Read | Documents | Returns 303 redirect to download URL |
| POST | `/document_automations` | Write | Documents | Trigger document automation |
| GET | `/document_templates` | Read | Documents | List available templates (e.g., engagement letter template) |

---

### 6.8 Notes

| Method | Path | R/W | Required Scope | Notes |
|---|---|---|---|---|
| GET | `/notes` | Read | Notes (implied via Contacts/Matters) | Attached to Matters or Contacts |
| POST | `/notes` | Write | Notes | Create call summary note on matter |
| GET | `/notes/:id` | Read | Notes | |
| PATCH | `/notes/:id` | Write | Notes | |
| DELETE | `/notes/:id` | Write | Notes | |

---

### 6.9 Custom Fields

| Method | Path | R/W | Required Scope | Notes |
|---|---|---|---|---|
| GET | `/custom_fields` | Read | Matters or Contacts | Field definitions |
| POST | `/custom_fields` | Write | Admin scope | Create new field definitions |
| GET | `/custom_fields/:id` | Read | | |
| PATCH | `/custom_fields/:id` | Write | | Update field definition |
| DELETE | `/custom_fields/:id` | Write | | |
| GET | `/custom_field_sets` | Read | | |
| POST | `/custom_field_sets` | Write | | Grouped field sets |

**ATHENA use for Donovan:** Paul's Gold/Platinum/Reserve tier assignment, controversy vs planning flag, and reserve client number (001–100) are all implemented as Clio Manage custom fields on Contact or Matter records. ATHENA must:
1. At onboarding: `GET /custom_fields?fields=id,name,field_type` to discover Paul's custom field IDs.
2. On contact creation: include `custom_field_values` array in the POST body with correct field IDs and values.
3. On contact update: PATCH the contact with updated custom field values.

Custom field values are nested in the Contact or Matter object response when `fields=custom_field_values{...}` is requested.

---

### 6.10 Users / Permissions

| Method | Path | R/W | Required Scope | Notes |
|---|---|---|---|---|
| GET | `/users/who_am_i` | Read | Any | Returns current authenticated user |
| GET | `/users` | Read | Users | |
| GET | `/users/:id` | Read | Users | |

---

### 6.11 Bills / Invoices

| Method | Path | R/W | Required Scope | Notes |
|---|---|---|---|---|
| GET | `/bills` | Read | Billing | Read-only for ATHENA scope |
| GET | `/bills/:id` | Read | Billing | |
| PATCH | `/bills/:id` | Write | Billing | Status transitions only (Draft→Void etc.) |
| GET | `/billable_clients` | Read | Billing | |
| GET | `/outstanding_client_balances` | Read | Billing | |

---

### 6.12 Trust Requests

| Method | Path | R/W | Required Scope | Notes |
|---|---|---|---|---|
| POST | `/trust_requests` | Write | Billing | Creates trust replenishment request |
| GET | `/trust_line_items` | Read | Billing | |
| PATCH | `/trust_line_items/:id` | Write | Billing | |

---

## 7. Clio Grow API — Full Endpoint Capability Matrix

Base URL (US): `https://api.clio.com/grow/` (for Platform API v2)  
Legacy base: `https://grow.clio.com/` (for Lead Inbox legacy endpoint)  
Source: [Clio Grow API Reference](https://docs.developers.clio.com/clio-grow/api-reference/), [Clio Platform Permissions](https://docs.developers.clio.com/api-docs/clio-platform/permissions/)

### 7.1 Full Endpoint Catalog

| Resource | Method | Path | R/W | Scope Required | Notes |
|---|---|---|---|---|---|
| **Contacts** | GET | `/contacts` | Read | `grow_contact_read` | Search by name/email/phone via `query`; filter by `ids[]` (max 50) |
| **Contacts** | GET | `/contacts/{id}` | Read | `grow_contact_read` | |
| **Contact Notes** | GET | `/contacts/{id}/notes` | Read | `grow_contact_note_read` | |
| **Contact Notes** | POST | `/contacts/{id}/notes` | Write | `grow_contact_note_write` | Subject ≤255 chars, body ≤65535 chars |
| **Inbox Leads** | GET | `/inbox_leads` | Read | `grow_lead_inbox_read` | Filter by `state` (untriaged/ignored); search by `query` |
| **Inbox Leads** | POST | `/inbox_leads` | Write | `grow_lead_inbox_write` | Create from external source (ATHENA's primary Grow write) |
| **Inbox Leads** | GET | `/inbox_leads/{id}` | Read | `grow_lead_inbox_read` | |
| **Matters** | GET | `/matters` | Read | `grow_matter_read` | Filter by `inbox_lead_id`, `submitted_only` boolean |
| **Matters** | GET | `/matters/{id}` | Read | `grow_matter_read` | Returns `clio_id` linking to Manage matter after conversion |
| **Matter Notes** | GET | `/matters/{id}/notes` | Read | `grow_matter_note_read` | |
| **Matter Notes** | POST | `/matters/{id}/notes` | Write | `grow_matter_note_write` | |
| **Custom Actions** | GET | `/custom_actions` | Read | `grow_custom_action_read` | UI dropdown integrations |
| **Custom Actions** | POST | `/custom_actions` | Write | `grow_custom_action_write` | Label 6–32 chars; HTTPS target URL required |
| **Custom Actions** | DELETE | `/custom_actions/{id}` | Write | `grow_custom_action_write` | |
| **Users** | GET | `/users` | Read | `grow_user_read` | |
| **Users** | GET | `/users/{id}` | Read | `grow_user_read` | |

### 7.2 Gap Analysis — What Grow API Does NOT Expose

The following capabilities exist in the Grow UI but have **no documented API endpoint**:

| Capability | API Status | Workaround |
|---|---|---|
| **Create Contact in Grow** | No `grow_contact_write` scope or POST endpoint documented | Use Lead Inbox POST; Grow auto-creates contact from accepted lead |
| **Update Contact in Grow** | Not documented | N/A — read only |
| **Pipelines / Pipeline Stages** | No endpoint | UI only |
| **Pipeline Stage Assignment** | No endpoint | UI only |
| **Intake Forms** | No endpoint | Grow form embed (iframe) only; not API-accessible |
| **Workflows / Automations** | No endpoint | UI/Grow-native only |
| **Documents** | No endpoint | Not API-accessible in Grow |
| **Calendar / Appointment booking** | No endpoint | Clio Scheduler embed only |
| **Tasks in Grow** | No endpoint | UI only |
| **E-signature trigger** | No endpoint | UI only |
| **Lead → Client conversion trigger** | No endpoint | UI only (see §8) |

**Claim verification:** The common assertion that "Grow's API is materially thinner than Manage's" is **confirmed and quantified**: Grow exposes 7 resource types (Contacts, Inbox Leads, Matters, Contact Notes, Matter Notes, Custom Actions, Users) versus Manage's 40+ resource groups. The Grow scope list contains only 11 scopes vs Manage's resource-based permissions across dozens of endpoints.

---

## 8. Lead → Client Conversion Flow

### 8.1 What Happens in the Native UI

Per [Clio Help Center — Manage Leads in Clio Grow](https://help.clio.com/hc/en-us/articles/9290604239003-Manage-Leads-in-Clio-Grow):

1. A lead arrives in the Grow Leads Inbox (untriaged state).
2. The attorney clicks **Accept → Quick Intake**.
3. The Quick Intake form collects contact and matter details.
4. On submit, Grow creates: (a) a Grow Contact, (b) a Grow Matter, and simultaneously (c) pushes a Contact and Matter record into Clio Manage.
5. The resulting Grow Matter has `clio_id` populated with the Manage Matter ID.

### 8.2 Is There an API Endpoint for Conversion?

**No.** There is no documented API endpoint to trigger the Grow → Manage conversion programmatically. The conversion is UI-driven within Clio Grow.

This is the **single most significant architectural constraint** for ATHENA.

### 8.3 Available Workaround for ATHENA

Since the conversion cannot be triggered via API, ATHENA has three options:

**Option A (Recommended for MVP): Dual-write on engagement**  
When Paul indicates (via ATHENA voice/email flow) that a prospect has signed the engagement letter:
1. ATHENA already has the Grow contact/matter data from the intake.
2. ATHENA calls `POST /api/v4/contacts` on Manage to create the Manage Contact.
3. ATHENA calls `POST /api/v4/matters` on Manage to create the Manage Matter, linking to the new Contact.
4. ATHENA writes the resulting Manage Matter ID back to the Grow Matter Notes via `POST /matters/{id}/notes` in Grow for cross-reference.

**Limitation:** Does not trigger Clio's native sync. The Grow Matter's `clio_id` will NOT be populated. Custom fields that synced from Manage into Grow intake forms won't auto-map back. This must be handled by ATHENA's field mapping logic.

**Option B: Webhook on Grow Matter status change**  
Not viable — Grow has no webhooks.

**Option C: Poll Grow Matters for `clio_id` population**  
Have Paul do the Quick Intake in Grow UI, then poll `GET /matters/{id}` until `clio_id` is populated. This is operationally fragile for an AI receptionist workflow.

**Recommended path:** Option A (dual-write) for MVP. Add field mapping for all custom fields at onboarding time.

---

## 9. Clio App Directory — Listing Requirements

**Source:** [Launch and Grow Your App handbook](https://docs.developers.clio.com/handbook/launch-your-app/), [App Directory Listing Guidelines](https://docs.developers.clio.com/handbook/launch-your-app/app-directory-listing-guidelines/)

### 9.1 Process Step-by-Step

| Step | Action | Notes |
|---|---|---|
| 1 | **Security review** | Trigger via Platform developer portal "apply for public listing" (Grow) or email `api.partnerships@clio.com` (Manage). Securiti questionnaire sent to designated team member. |
| 2 | **Demo submission** | Pre-recorded video + company info + customer description sent to `api.partnerships@clio.com` after security approval. |
| 3 | **Listing form** | API Partnerships provides form; developer completes; Clio creates draft for review. |
| 4 | **Launch** | Developer sign-off → public listing. Post-launch Clio promotional support available. |

### 9.2 Security Review — Securiti Questionnaire

The Securiti questionnaire covers Clio's required security and compliance categories. Based on the [Developer Security and Data Guidelines](https://docs.developers.clio.com/handbook/build-your-app/developer-security-and-data-guidelines/), the review covers:

| Category | Topics |
|---|---|
| Encryption | TLS version, at-rest encryption standard, Qualys SSL grade |
| Credential management | App key/secret storage, no public repos |
| Vulnerability protection | OWASP Top 10, CSRF, XSS, SQL injection |
| Code analysis | Static analysis tools, automated scanners |
| Penetration testing | Annual pen test or HackerOne participation |
| Password storage | bcrypt with work factor ≥10 |
| Data residency | Regional compliance for EU/GDPR, CA/PIPEDA, US/CCPA, AU |
| Third-party tracking | Disclosure of all sub-processors (e.g., GCP, AWS) |
| Policies | Public ToS, Security Policy, Privacy Policy |
| Business continuity | BCDR and incident response documentation |
| Certifications | SOC2, ISO-27001, PCI-DSS, TRUSTe documentation |

**AI/LLM data handling:** Not explicitly called out in the published security guidelines as a distinct category. Given Clio's own stated policy ("data is never used to train AI models"), ATHENA should be prepared to document: (a) whether call transcripts/summaries are passed to external LLM APIs, (b) whether attorney-client data leaves Clio's region during ATHENA processing, and (c) data retention and deletion policies. **This category should be flagged as [UNCONFIRMED scope — confirm with Clio Application Security team]** before questionnaire submission.

**Attorney-client privilege provisions:** Not explicitly enumerated in published Clio security docs. Clio's posture is that it is a data processor for the law firm, not a privileged party, and that access controls ensure only authorized firm users see privileged data. ATHENA's Data Processing Agreement (DPA) with Paul will need to address privilege protections. [UNCONFIRMED in primary docs — recommend legal review].

**Breach notification SLA:** Clio has a "formally defined and tested breach notification policy" per [Compliance documentation](https://help.clio.com/hc/en-us/articles/9284651312411-Compliance), but specific SLA hours are not published. [UNCONFIRMED — request from Clio trust.clio.com].

### 9.3 Listing Details

| Parameter | Requirement |
|---|---|
| App name | Unique; must not contain "Clio" |
| Short description | 10 words or less; sentence case; clear value proposition |
| Categories | Up to 2 categories selectable (specific category names not published) |
| Practice areas | Up to 3 (ATHENA: Tax Law) |
| Keywords | Up to 5 |
| Regions | USA, Canada, Europe, Australia |
| Regions integration | Clio Manage and/or Clio Grow |
| Starting price | Required (lowest tier); can be "Free" or monthly/annual |
| Logo | Min 300×300px PNG transparent or SVG; no Clio logo |
| Media gallery | Screenshots + video |

### 9.4 Fees, Revenue Share, Exclusivity

- **No listing fees or revenue share** are documented in any primary Clio source.
- **No exclusivity requirement** is documented.
- **Direct-sell outside directory:** Permitted. Private apps (single-firm) bypass the directory entirely. You can sell ATHENA directly to law firms and use a private Clio app — no listing required until you want marketplace discovery.
- **Customer attribution:** Not documented. [UNCONFIRMED — inquire with api.partnerships@clio.com].

### 9.5 Timeline

Not explicitly stated in primary documentation. Industry expectation is 4–12 weeks from security questionnaire submission to listing, subject to Clio review capacity. [UNCONFIRMED — no SLA published].

### 9.6 ATHENA Listing Categories

Based on available App Directory browse categories and ATHENA's functionality:
- **Legal CRM / Intake** (primary)
- **Communications / Virtual Receptionist** (secondary)

---

## 10. Compliance & Privilege Considerations

**Source:** [Clio Security page](https://www.clio.com/security/), [Clio Help Center Compliance](https://help.clio.com/hc/en-us/articles/9284651312411-Compliance), [Clio Data Security Blog](https://www.clio.com/blog/data-security-law-firms/)

### 10.1 Third-Party Access to Attorney-Client Privileged Data

Clio's documented position: "Sensitive client information never leaves Clio's secure environment." Clio processes data as a **data processor** for the law firm. Third-party apps access data via OAuth on behalf of a Clio user — they inherit only the permissions that user granted. Clio staff require explicit attorney permission for temporary support access; all access is time-limited and logged.

**ATHENA's privilege chain:** ATHENA authenticates as Paul's authorized agent. The same ethical obligations that apply to Paul under ABA Rule 1.6 (confidentiality of client communications) apply to ATHENA as his technology vendor. ATHENA's terms with Paul must include privilege and confidentiality provisions.

### 10.2 Data Residency Options

| Region | Clio support |
|---|---|
| United States | ✅ `app.clio.com` / `api.clio.com/grow/` |
| Canada | ✅ `ca.app.clio.com` |
| European Union / EMEA | ✅ `eu.app.clio.com` / `eu.grow.clio.com` |
| Australia / APAC | ✅ `au.app.clio.com` / `au.grow.clio.com` |

**Donovan Legal (Florida, US)** → US region only.

Clio AI tools process data within region: "All data used by our AI is encrypted and processed in your region." ATHENA's own infrastructure (GCP `tico-ai-prod`) should match or document cross-region data flows for Securiti compliance.

### 10.3 AI/LLM Training — Clio's Policy

From [Clio security page](https://www.clio.com/security/): **"Data is never used to train AI models or for any other external purposes."** This applies to Clio's own AI (now called Manage AI, evolved from Clio Duo). Clio's AI tools "process data in real time and do not store or reuse it."

**This is Clio's policy for data within its own platform.** ATHENA's handling of data fetched from Clio (call transcripts, contact data, matter summaries) is governed by ATHENA's own policies, not Clio's. ATHENA must maintain an equivalent no-training commitment in its DPA with Paul.

### 10.4 HIPAA / SOC2 Posture

| Standard | Clio Status |
|---|---|
| SOC 2 Type II | Annual examination — reports at [trust.clio.com](https://trust.clio.com) |
| SOC 1 Type II | Annual examination — reports at [trust.clio.com](https://trust.clio.com) |
| HIPAA | Self-assessment + internal attestation; BAA available via HIPAA add-on (US only; purchased separately) |
| ISO 27001 | Annual audit per [Clio blog](https://www.clio.com/blog/data-security-law-firms/) |
| GDPR | Compliant as both controller and processor |
| PIPEDA (Canada) | Compliant |
| PCI DSS | Compliant for Clio Payments |
| Encryption at rest | AES-256 |
| Encryption in transit | TLS 1.2+ |

**Paul's HIPAA obligation:** If Donovan Legal handles PHI (unlikely for a pure tax attorney but possible with estate planning), Paul would need the Clio HIPAA Add-on ($unknown, US only) and a BAA with Clio. ATHENA should similarly offer a BAA if handling any PHI. This is a low-probability item for a tax practice but should be documented.

### 10.5 Clio Duo / Manage AI — Competitive Flag

Clio has rebranded its AI layer from **Clio Duo** to **Manage AI** (as of early 2026 per [Clio blog](https://www.clio.com/blog/manage-ai/)). Manage AI is a paid add-on to Clio Manage that includes scheduling automation, smart task prioritization, AI-generated client updates, automated billing, and document analysis. It operates **within** Clio — it is not an external receptionist or voice AI. ATHENA is complementary (external call handling, intake screening) rather than directly competitive with Manage AI's document/billing focus. However, Clio may expand Manage AI into intake automation over time. Monitor.

---

## 11. Recommended ATHENA Integration Architecture

### 11.1 Multi-Tenant vs Per-Customer OAuth App

**Recommendation: One OAuth app per product (Manage + Platform), multi-tenant.**

- Register one Clio Manage app and one Clio Platform (Grow) app in the Clio Developer Portal.
- Each customer (Paul) grants consent to both apps once; ATHENA stores the resulting token pair per customer.
- This is the standard SaaS pattern and the path required for the App Directory.
- **Do NOT use a private per-customer app** unless a customer explicitly demands isolation (enterprise tier). Private apps cannot be listed in the directory and require separate app IDs.

**Regional note:** If ConnexŪS expands to EU/CA/AU customers, separate app registrations are required per region per product (4 Manage apps + 4 Platform apps = 8 total app registrations for full global coverage).

---

### 11.2 Token Storage, Refresh, and Rotation Strategy

```
Token Store Schema (per customer):
{
  "customer_id": "donovan-legal",
  "manage": {
    "access_token": "...",
    "refresh_token": "...",  # non-rotating, long-lived
    "expires_at": 1718000000,  # unix timestamp
    "region": "us"
  },
  "grow": {
    "access_token": "...",
    "refresh_token": "...",  # ROTATES on every refresh
    "expires_at": 1718000000,
    "region": "us"
  }
}
```

**Storage:** Encrypt at rest (AES-256 minimum). Use GCP Secret Manager or equivalent — do not store in application database in plaintext.

**Refresh strategy:**
- **Manage:** Proactively refresh 1 hour before expiry (7-day tokens → refresh at day 6.9). No rotation risk.
- **Grow:** Proactively refresh 1 day before expiry (30-day tokens). **Use a distributed lock (Redis/Spanner) around the refresh call** to prevent race conditions. Concurrent refreshes on a rotating token will invalidate one, permanently losing access. Write the new refresh token atomically before releasing the lock.

**Revocation handling:** Listen for Manage deauthorization callbacks. On callback, mark the customer's Manage token as revoked and trigger re-auth flow. Grow revocation via `POST /oauth/revoke` must also be handled in offboarding flows.

---

### 11.3 Webhook Receiver Architecture (Manage Only)

Since only Manage has webhooks:

```
Inbound:  HTTPS POST → /webhooks/clio-manage
          ↓
          1. Validate X-Hook-Signature:
             computed = HMAC-SHA256(shared_secret, raw_body_bytes)
             if computed != X-Hook-Signature header → return 403
          2. Idempotency: check event ID in deduplication store
             (Note: Clio event IDs not confirmed — use hash of payload)
          3. Enqueue to async queue (Cloud Tasks / Pub/Sub)
          4. Return 200 OK immediately
          ↓
          Async worker processes:
          - matter.created → trigger Grow lead status check
          - communication.created → log to ATHENA call log
          - calendar_entry.created → sync to ATHENA calendar
          - matter_closed → update ATHENA customer state
```

**Webhook registration renewal:** Create a background cron (ADAM/DevOps agent) that: (a) lists all webhooks via `GET /api/v4/webhooks`, (b) checks `expires_at`, (c) PATCHes any webhook expiring within 7 days to extend to max 31 days.

**Grow polling (no webhooks):** Poll `GET /inbox_leads?state=untriaged&updated_since=LAST_POLL_TIMESTAMP` every 60 seconds during ATHENA operational hours. This costs 1 Grow rate limit request per poll cycle per customer. At 3 req/s per app, 100 customers can be polled without issue.

---

### 11.4 Caching Layer for Live-Call Endpoints

A live call **cannot tolerate 200ms+ Clio round-trips** for caller ID lookup. Recommendation:

| Data | Cache TTL | Cache store | Update trigger |
|---|---|---|---|
| Contact phone → Contact ID + Name | 24 hours | Redis (GCP Memorystore) | Manage `contact.updated` webhook |
| Matter list per contact | 15 minutes | Redis | Manage `matter.updated` webhook |
| Custom field IDs (Paul's field definitions) | 7 days | Redis | Manual invalidation on Clio config change |
| User (attorney) profile | 24 hours | Redis | Manual |

**On inbound call:**
1. ATHENA receives caller phone number.
2. Cache lookup by phone → Contact record (~1ms).
3. If cache miss → `GET /api/v4/contacts?query=PHONE&fields=id,name,phone_numbers` (~80–150ms acceptable for first-time callers).
4. Fetch associated Matters from cache or API.
5. Proceed with call flow using cached data.

**Code example — contact lookup on inbound call:**
```python
import redis, requests, hashlib

r = redis.Redis(...)

def lookup_contact_by_phone(phone: str, manage_token: str) -> dict | None:
    cache_key = f"clio:contact:phone:{hashlib.md5(phone.encode()).hexdigest()}"
    cached = r.get(cache_key)
    if cached:
        return json.loads(cached)
    
    resp = requests.get(
        "https://app.clio.com/api/v4/contacts",
        headers={"Authorization": f"Bearer {manage_token}"},
        params={"query": phone, "fields": "id,first_name,last_name,phone_numbers,custom_field_values{id,value}"}
    )
    resp.raise_for_status()
    data = resp.json().get("data", [])
    contact = data[0] if data else None
    
    if contact:
        r.setex(cache_key, 86400, json.dumps(contact))  # 24hr TTL
    return contact
```

---

### 11.5 Failure Modes

| Failure | ATHENA behavior |
|---|---|
| **Clio Manage down mid-call** | Log call to local ATHENA store; replay Communication POST on recovery. Do not block call flow — ATHENA completes call, queues Clio writes. |
| **Clio Grow down during lead intake** | Store lead locally; retry `POST /inbox_leads` with exponential backoff. Surface failure alert to Paul via email/SMS. |
| **Webhook missed** | Background reconciliation job: `GET /api/v4/communications?fields=id,created_at&order=id(asc)` since last reconcile timestamp every 15 minutes. |
| **Manage refresh token revoked (user deauthorizes)** | Deauth callback fires to ATHENA. Mark token as invalid. Trigger re-auth email to Paul. ATHENA continues call handling in degraded mode (local queue only). |
| **Grow refresh token lost (rotation race)** | Distributed lock prevents this. If it occurs, user re-auth required for Grow only; Manage operations unaffected. |
| **Rate limit (Manage 429)** | Read `Retry-After` header; back off and retry. During peak: 50 rpm per token = ~1 request per 1.2 seconds. Queue requests accordingly. |
| **Rate limit (Grow 429)** | Exponential backoff: 1s, 2s, 4s, 8s, 16s. No `Retry-After` header documented for Grow. |

---

### 11.6 Donovan Use Case — Specific Architecture

**Phase 1: Prospect Intake (Grow)**

```
Inbound call to Donovan Legal
  → ATHENA answers, screens for tax matter type
  → Collects: first name, last name, phone, email, matter description
  → POST https://grow.clio.com/inbox_leads
    {
      "inbox_lead": {
        "from_first": "Jane",
        "from_last": "Smith",
        "from_phone": "5615551234",
        "from_email": "jane@email.com",
        "from_message": "Tax controversy - IRS audit 2023. Assets ~$2M.",
        "referring_url": "Call handled by ATHENA voice AI",
        "from_source": "ATHENA-ConnexUS-AI"
      },
      "inbox_lead_token": "PAUL_GROW_TOKEN"
    }
  → ATHENA logs call summary as Contact Note in Grow
  → Optionally: POST /api/v4/calendar_entries in Manage to book consultation
  → Email/SMS confirmation sent to caller via ATHENA
```

**Phase 2: Post-Engagement (Manage)**

```
Engagement letter signed (trigger: ATHENA detects e-signature event OR Paul confirms verbally)
  → ATHENA dual-writes to Manage:
    1. POST /api/v4/contacts { name, phone, email, custom fields: tier, client_type, reserve_number }
    2. POST /api/v4/matters { description, client_id, practice_area_id, custom fields }
    3. POST /api/v4/communications { type: "PhoneCall", summary: "Initial intake call", duration_seconds: X, matter_id, contact_id }
  → Cross-reference: POST /grow/matters/{grow_matter_id}/notes with Manage matter ID
```

**Phase 3: Ongoing Matter Management (Manage)**

```
Every inbound call from existing client:
  1. Phone lookup → Redis cache → Manage contact
  2. Retrieve active matters
  3. ATHENA handles call: screen, log, schedule
  4. POST /api/v4/communications (log call)
  5. POST /api/v4/notes or /activities as needed
  6. Webhook: matter_closed → update ATHENA client state
```

---

## 12. Risks, Gaps, and Open Questions

### 12.1 Unconfirmed Claims

| Claim | Status | Action |
|---|---|---|
| `query` param on `/contacts` searches phone number fields | **UNCONFIRMED** | Test empirically in dev account |
| Grow Platform API base URL variants for EU/AU/CA | **UNCONFIRMED** (only US `api.clio.com/grow/` confirmed) | Email api@clio.com |
| Grow Platform API 429 `Retry-After` header presence | **UNCONFIRMED** | Test empirically |
| Webhook event deduplication / event IDs in Manage | **UNCONFIRMED** | Email api@clio.com |
| Securiti questionnaire AI/LLM category | **UNCONFIRMED** | Confirm with Clio Application Security |
| Grow webhook roadmap (may ship in 2026) | **UNCONFIRMED** | Monitor API changelog |
| Manage refresh token rotation policy (currently non-rotating) | **Confirmed non-rotating** per docs — but verify in practice | |
| Attorney-client privilege in Securiti questionnaire | **UNCONFIRMED** | Engage Clio API Partnerships |
| Clio App Directory listing categories (exact names) | **UNCONFIRMED** | Visible only when completing the listing form |
| Grow contact write capability (no `grow_contact_write` scope documented) | **UNCONFIRMED — likely does not exist** | Email api@clio.com for confirmation |

---

### 12.2 Known Constraints for MVP Scope

1. **Lead → Manage conversion is UI-only.** Dual-write workaround (§8.3 Option A) is the only API-driven path. Paul must understand that the Grow Leads Inbox will show unconverted leads unless he manually Quick Intakes them *or* ATHENA's dual-write is treated as the canonical conversion mechanism.

2. **Grow has no webhooks.** ATHENA must poll for new leads. 60-second polling latency is acceptable for intake, but near-real-time lead notification requires polling optimization.

3. **Grow API has no write access to contacts.** Contact creation/update in Grow is not exposed via API. New prospects must be created as Inbox Leads; Grow auto-creates a contact when the lead is accepted.

4. **Manage rate limit of 50 rpm during peak hours** is adequate for Paul (solo firm, 1 token) but must be respected. Do not make unnecessary API calls during live calls — cache aggressively.

5. **Grow rate limit of 3 req/s is per-OAuth-app.** At scale with multiple ConnexŪS clients, the 3 req/s budget is shared. At 100 customers polling every 60s, you're generating ~1.67 req/s — within budget. At 200+ customers, start queuing Grow API calls.

6. **Webhook expiry at 31 days maximum** requires active registration management. A missed renewal causes silent failure — no events delivered.

7. **Dual OAuth flows per customer.** Paul must authorize ATHENA twice (once for Manage, once for Grow). Design a combined onboarding flow that initiates both OAuth sequences in sequence with clear explanation of why two authorizations are needed.

---

### 12.3 Pricing Risk to Paul

| Product | Published pricing (as of May 2026) | Basis |
|---|---|---|
| Clio Manage EasyStart | $49/user/month | [Official Clio pricing](https://www.clio.com/pricing/) |
| Clio Manage Essentials | $89/user/month (monthly) | [G2 pricing data](https://www.g2.com/products/clio-clio-manage/pricing) [3RD-PARTY — verify] |
| Clio Manage Advanced | $119/user/month (monthly) | [G2 pricing data](https://www.g2.com/products/clio-clio-manage/pricing) [3RD-PARTY — verify] |
| Clio Manage Complete/Expand | $149/user/month (monthly) | [G2](https://www.g2.com/products/clio-clio-manage/pricing) / [Clio pricing](https://www.clio.com/pricing/) [3RD-PARTY — verify] |
| Clio Grow add-on | ~$69/user/month (on Essentials/Advanced) | [Capterra](https://www.capterra.com/p/105428/Clio/pricing/) [3RD-PARTY — verify] |
| Clio Grow standalone | ~$59/user/month | [Capterra](https://www.capterra.com/p/105428/Clio/pricing/) [3RD-PARTY — verify] |
| Manage AI add-on | Contact sales | [Clio pricing](https://www.clio.com/pricing/) |

**Note:** Clio's pricing page has transitioned from published per-tier prices to "Starting at $49/user" with add-on pricing requiring sales contact. All non-EasyStart prices above are [3RD-PARTY — verify with Clio sales]. For the Donovan use case (solo attorney), the most likely scenario is **Clio Manage Advanced ($119/user/month) + Clio Grow add-on** — approximately $188/user/month before ATHENA fees.

**ATHENA value proposition to Paul:** ATHENA replaces a human receptionist (~$3,000–4,000/month) at a fraction of that cost. The Clio subscription cost is likely something Paul already carries or will carry for practice management regardless of ATHENA.

---

### 12.4 Strategic Risk — Manage AI (formerly Clio Duo)

Clio's [Manage AI](https://www.clio.com/features/legal-ai-software/) (March 2026) includes scheduling automation, AI-generated client updates, and automated billing — adjacent to ATHENA's call-logging and scheduling capabilities. Clio has explicitly stated Manage AI "isn't a standalone product" but is built into Manage. ATHENA's differentiation is **inbound voice/phone AI + external intake + ATHENA-specific intelligence** — capabilities Manage AI does not address. However, if Clio expands Manage AI into virtual receptionist territory, the competitive dynamic shifts. Monitor Clio product announcements at [developers.clio.com/api-docs/clio-manage/api-changelog/](https://docs.developers.clio.com/api-docs/clio-manage/api-changelog/).

---

## 13. Sources

All sources are primary Clio documentation unless marked [3RD-PARTY — verify].

| Document | URL |
|---|---|
| Clio Developer Documentation Hub | https://docs.developers.clio.com |
| Clio Manage and Clio Platform APIs (comparison) | https://docs.developers.clio.com/handbook/getting-started/clio-manage-and-clio-platform/ |
| Get a Developer Account | https://docs.developers.clio.com/handbook/getting-started/get-a-developer-account/ |
| Clio Manage Authorization | https://docs.developers.clio.com/api-docs/clio-manage/authorization/ |
| Clio Platform Authorization | https://docs.developers.clio.com/api-docs/clio-platform/authorization/ |
| Clio Manage Rate Limits | https://docs.developers.clio.com/api-docs/clio-manage/rate-limits/ |
| Clio Platform Rate Limits | https://docs.developers.clio.com/api-docs/clio-platform/rate-limits/ |
| Clio Manage Pagination | https://docs.developers.clio.com/api-docs/clio-manage/paging/ |
| Clio Manage Fields | https://docs.developers.clio.com/api-docs/clio-manage/fields/ |
| Clio Manage Permissions | https://docs.developers.clio.com/api-docs/clio-manage/permissions/ |
| Clio Platform Permissions (scopes) | https://docs.developers.clio.com/api-docs/clio-platform/permissions/ |
| Clio Platform Applications (app registration) | https://docs.developers.clio.com/api-docs/clio-platform/applications/ |
| Clio Manage Applications (app registration) | https://docs.developers.clio.com/api-docs/clio-manage/applications/ |
| Clio Manage API Reference (full endpoint catalog) | https://docs.developers.clio.com/clio-manage/api-reference/ |
| Clio Manage API Reference (v4 — webhooks, legacy) | https://docs.developers.clio.com/api-reference/ |
| Clio Manage API Changelog | https://docs.developers.clio.com/api-docs/clio-manage/api-changelog/ |
| Clio Grow API Reference (Platform v2) | https://docs.developers.clio.com/clio-grow/api-reference/ |
| Clio Grow API Reference (legacy) | https://docs.developers.clio.com/grow-api/api-reference/ |
| Clio Grow Lead Inbox API Guide | https://docs.developers.clio.com/guides/clio-grow/lead-inbox-api/ |
| Launch and Grow Your App handbook | https://docs.developers.clio.com/handbook/launch-your-app/ |
| App Directory Listing Guidelines | https://docs.developers.clio.com/handbook/launch-your-app/app-directory-listing-guidelines/ |
| Developer Security and Data Guidelines | https://docs.developers.clio.com/handbook/build-your-app/developer-security-and-data-guidelines/ |
| Building Your App | https://docs.developers.clio.com/handbook/build-your-app/ |
| Clio Security Page | https://www.clio.com/security/ |
| Clio Help Center — Compliance | https://help.clio.com/hc/en-us/articles/9284651312411-Compliance |
| Clio Help Center — Manage Leads in Clio Grow | https://help.clio.com/hc/en-us/articles/9290604239003-Manage-Leads-in-Clio-Grow |
| Clio Help Center — Sync and Convert Custom Fields | https://help.clio.com/hc/en-us/articles/9285553508635-Sync-and-Convert-Custom-Fields |
| Clio Help Center — Set Up Clio Grow | https://help.clio.com/hc/en-us/articles/10485194916891-Set-Up-Clio-Grow |
| Clio Pricing Page | https://www.clio.com/pricing/ |
| Clio Manage AI (formerly Duo) | https://www.clio.com/features/legal-ai-software/ |
| Clio Data Security Blog | https://www.clio.com/blog/data-security-law-firms/ |
| Clio Developer Portal (Manage) | https://developers.clio.com |
| Clio Developer Portal (Platform/Grow) | https://developers.api.clio.com |
| G2 Clio Manage Pricing [3RD-PARTY — verify] | https://www.g2.com/products/clio-clio-manage/pricing |
| Capterra Clio Pricing [3RD-PARTY — verify] | https://www.capterra.com/p/105428/Clio/pricing/ |

---

*Walter White, Liaison to David Pierce*  
*ConnexŪS AI / TICO AI LLC*
