# Legal Concierge — Strategy & Architecture Document

**Author:** ConnexUS AI / Scale Agile Solutions  
**Client (First Deployment):** Donovan Legal PLLC  
**Document Version:** 1.0  
**Date:** April 7, 2026  
**Classification:** Internal Engineering — Confidential

---

## Table of Contents

1. [Current State Assessment](#1-current-state-assessment)
2. [Target Architecture](#2-target-architecture)
3. [Integration Architecture](#3-integration-architecture)
4. [Donovan Law Implementation Plan](#4-donovan-law-implementation-plan)
5. [Development Phases](#5-development-phases)
6. [Technical Decisions & Trade-offs](#6-technical-decisions--trade-offs)
7. [What Advances Past AdvisoryConnect](#7-what-advances-past-advisoryconnect)

---

## 1. Current State Assessment

### 1.1 What AdvisoryConnect Has Today

AdvisoryConnect is a working personal injury intake funnel. The codebase is a single-repo React + Vite frontend with a co-located Node.js/Express backend. It deploys a branded AI concierge named "Leah" that handles voice and text intake for car accident victims.

**Stack:**

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Vite 6 |
| Styling | Tailwind CSS (CDN, not purged), Montserrat/Inter via Google Fonts |
| Backend | Node.js, Express 4, port 6020 |
| Real-time | WebSocket (ws v8) — same port as HTTP |
| AI voice/chat | Retell AI (retell-client-js-sdk v2.0.7) |
| Session ID | uuid v9 |
| Media assets | Google Cloud Storage (connexusai-assets bucket, public) |

**Voice agent:** `agent_9cbf63b46e6ece83b38de5fc2d` (AdvisoryConnect-Leah_Voice_DP, GPT-5.2 model)  
**Chat agent:** `agent_e7054f80d67782a58593f31b1d`

**What Leah actually does in a session:**
1. User clicks any CTA on the landing page → `LeahIntakeModal` opens
2. Frontend POSTs to `/api/create-web-call` → backend calls `retellai.com/v2/create-web-call` → returns `{access_token, call_id}`
3. Frontend loads `retell-client-js-sdk` dynamically, calls `startCall({accessToken})`
4. WebRTC session to Retell cloud; Leah runs the PI qualification script
5. Retell Custom Functions (webhooks) fire milestone checkpoints back to `/api/log-milestone` → WebSocket broadcasts to the browser
6. 16 milestones across 4 segments (accident → damage → legal → connect) drive a progress bar
7. When the lead qualifies: `TransferChoiceOverlay` gives three options — call my phone (working), stay in browser (permanently disabled — Retell limitation), call me later (stubbed/console.log only)
8. "Call My Phone" is the only functional end-path: backend calls `retellai.com/v2/create-phone-call`, Retell dials user's number, PSTN call resumes qualification with full context

**17 Retell Custom Functions configured:**
`log_milestone`, `ClaimantPhone`, `ClaimantEmail`, `ClaimantName`, `SmsConsent`, `IncidentState`, `IncidentDate`, `AtFault`, `Cited`, `Settlement`, `Attorney`, `PoliceReportFiled`, `submit_lead`, `transfer_call`, `end_call` (and two insurance fields)

---

### 1.2 What Works vs. What Is Stubbed/Broken

#### Fully Functional

| Capability | Notes |
|---|---|
| Voice intake (Retell WebRTC) | Browser-based voice call with Leah working end-to-end |
| Text chat intake | Retell chat API, typing indicators, full message cycle |
| Bidirectional mode switching | Voice ↔ chat with transcript context carried across |
| 16-milestone tracking | Dual path: SDK `update` event (fast) + WebSocket (server-side webhook) |
| 4-segment progress bar | Milestone-driven segment completion (accident → damage → legal → connect) |
| StatusHUD notifications | Toast popups + persistent checkpoint badge |
| Disqualification / Resource Mode | Reason display, email capture UI (capture only, no delivery) |
| TransferChoiceOverlay UI | Three options rendered correctly with loading states |
| Outbound phone call | Retell phone-call API fires; caller's phone rings; context passed as dynamic variables |
| Web Audio waveform | Real-time mic analysis, agent-talking detection, animated visualizer |
| State SOL lookup | All 50 states + DC statute of limitations hard-coded in `App.tsx` |
| Auto-reconnect WebSocket | 3-second retry |
| Fallback rule-based chat | Keyword-matching fallback when Retell API fails |

#### Stubbed, Broken, or Missing

| Feature | Current State | Impact |
|---|---|---|
| CRM lead submission (`submit_lead` tool) | No `/api/submit-lead` endpoint. Agent fires the function, nothing happens. | **Critical** — every qualified lead is silently discarded |
| Callback scheduling (`/api/schedule-callback`) | `console.log()` only, returns `{success:true}` | Users who select "Call Me Later" are dropped with no record |
| Disqualified lead email delivery | `setTimeout(1000)` fake delay, email logged to console only | No disqualified lead is ever contacted |
| SMS confirmation post-consent | Consent captured in `qualificationData.smsConsent`, no SMS sent | Consent collected but never used |
| Email confirmation | Email captured, no email service configured | Same |
| Database persistence | `chatSessions` Map is in-memory. Server restart = all data gone | Not production-safe |
| Multi-user WebSocket isolation | All users subscribe to `"global"` channel — everyone gets everyone's milestone events | Security and correctness bug in any concurrent-user scenario |
| Web call transfer ("Stay in Browser") | `browserTransferDisabled={true}` hardcoded — Retell web calls cannot transfer | Structural Retell limitation |
| Gemini case analysis | `geminiService.ts` returns `""` — removed per prior request | No secondary AI analysis |
| `RETELL_OUTBOUND_NUMBER` env var | Undocumented in `.env.example`. Missing = 500 error on phone transfer | Deployment risk |
| Tailwind CSS | Loaded from CDN at runtime, not purged or bundled | Performance issue in production |
| WebSocket URL | `ws://${window.location.hostname}:6020` hardcoded — breaks behind any reverse proxy or different domain | Deployment issue |
| Media assets | Hosted on external GCS bucket not owned by this codebase | Single point of failure |

---

### 1.3 Architecture Gaps — Current vs. Target

| Dimension | Current (AdvisoryConnect) | Target (Legal Concierge) |
|---|---|---|
| **Practice areas** | Personal injury only (car accidents, specifically) | Any practice area: PI, family law, criminal defense, immigration, corporate, real estate, business law, taxation |
| **AI backbone** | Retell AI | Athena (ConnexUS AI Platform) — with Retell migration path |
| **CRM** | None — data ephemeral in memory | GoHighLevel — contacts, pipeline, conversations, workflows |
| **Calendar booking** | None | GHL Calendar API → book with specific attorney; Gmail fallback |
| **Retainer generation** | None | Template-based auto-population → e-signature (DocuSign/HelloSign/PandaDoc) |
| **Lead persistence** | None (in-memory Map, clears on restart) | PostgreSQL + GHL CRM |
| **Multi-tenancy** | Hard-coded single firm | Tenant-per-firm: each law firm has its own agent config, KB, pipeline, calendar |
| **Outbound calling** | Retell phone-call API (manual trigger from UI) | Athena Campaigns API (programmatic campaign management) |
| **Analytics** | None | GHL pipeline reporting + custom dashboard |
| **Mobile app** | None | React Native app embedding Athena widget SDK |
| **E-signature** | None | DocuSign/HelloSign/PandaDoc via API, SMS+email delivery |
| **Verification pipeline** | None | Gated verification: ID → insurance → police report → medical records |
| **Compliance database** | None | Immutable conflict + consent + retainer record store |
| **Session isolation** | Global WebSocket channel — all users share events | Per-session isolation, JWT auth, no cross-tenant data leakage |

---

## 2. Target Architecture

### 2.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT LAYER                                        │
│                                                                                  │
│  ┌──────────────────────────────┐    ┌──────────────────────────────────────┐   │
│  │   Law Firm Website (embed)    │    │   Mobile App (React Native)          │   │
│  │   e.g. donovan-law-site       │    │   iOS + Android                      │   │
│  │   ┌────────────────────────┐  │    │   ┌──────────────────────────────┐   │   │
│  │   │  Athena Widget SDK     │  │    │   │  Athena Widget SDK (mobile)  │   │   │
│  │   │  (voice + chat embed)  │  │    │   │  WebView or native bridge    │   │   │
│  │   └────────────────────────┘  │    │   └──────────────────────────────┘   │   │
│  └──────────────────────────────┘    └──────────────────────────────────────┘   │
└──────────────────────────────────┬──────────────────────────────────────────────┘
                                   │ HTTPS + WSS
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         LEGAL CONCIERGE BACKEND                                  │
│                    (Node.js / Express — Google Cloud Run)                        │
│                                                                                  │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────────────────┐  │
│  │  Session Router  │  │  Webhook Router  │  │  Tenant Config Service        │  │
│  │  /api/v1/*       │  │  /webhooks/*     │  │  firm config, KB, templates  │  │
│  └────────┬─────────┘  └────────┬─────────┘  └──────────────────────────────┘  │
│           │                     │                                                │
│  ┌────────▼─────────────────────▼──────────────────────────────────────────┐   │
│  │                      ORCHESTRATION LAYER                                  │   │
│  │                                                                           │   │
│  │  IntakeOrchestrator     RetainerOrchestrator     BookingOrchestrator     │   │
│  │  - session lifecycle    - template selection     - slot lookup           │   │
│  │  - milestone tracking   - field population       - appointment create    │   │
│  │  - qualification logic  - esign API dispatch     - confirmation send     │   │
│  │  - GHL contact create   - webhook handler        - GHL update            │   │
│  └───────────────────────────────────┬──────────────────────────────────────┘   │
│                                      │                                           │
│  ┌───────────────────────────────────▼──────────────────────────────────────┐   │
│  │                         DATA LAYER                                        │   │
│  │  PostgreSQL (Cloud SQL)            Redis (session cache / pub-sub)        │   │
│  │  - firms (tenants)                 - active sessions                      │   │
│  │  - leads                           - milestone events                     │   │
│  │  - intake_sessions                 - rate limit counters                  │   │
│  │  - retainers (signed PDFs)                                                │   │
│  │  - appointments                                                           │   │
│  │  - conflict_checks                                                        │   │
│  │  - audit_log (immutable)                                                  │   │
│  └───────────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────────────────────┘
                          │                  │                  │
           ┌──────────────┘        ┌─────────┘        ┌────────┘
           ▼                       ▼                   ▼
┌─────────────────┐    ┌──────────────────────┐   ┌──────────────────────────┐
│  ATHENA PLATFORM │    │  GOHIGHLEVEL (GHL)   │   │  E-SIGNATURE             │
│  (ConnexUS AI)   │    │                      │   │  (DocuSign / HelloSign / │
│                  │    │  Contacts API         │   │   PandaDoc)              │
│  Assistants API  │    │  Calendar API         │   │                          │
│  Knowledge Base  │    │  Opportunities API    │   │  Template management     │
│  Campaigns API   │    │  Conversations API    │   │  Envelope creation       │
│  Phone Numbers   │    │  Workflows API        │   │  SMS + email delivery    │
│  Call History    │    │  Voice AI Agents API  │   │  Signature webhooks      │
│  Webhooks        │    │  Locations API        │   │  Audit certificate       │
│  Widget SDK      │    │  Webhooks             │   └──────────────────────────┘
└─────────────────┘    └──────────────────────┘
```

---

### 2.2 Component Breakdown

#### Frontend

| Component | Technology | Responsibility |
|---|---|---|
| Law firm website embed | Athena Widget SDK (JS snippet) | Voice/chat widget embedded on any firm site via `<script>` tag |
| Legal Concierge Web App | React 19 + TypeScript + Vite | Admin UI for firm configuration, analytics dashboard, lead pipeline view |
| Mobile App | React Native (Expo) | Native iOS/Android app embedding Athena widget; push notifications for lead alerts |
| Intake Modal | React component | Full-screen modal triggered by widget button click |
| Progress HUD | React component (migrated from AdvisoryConnect `StatusHUD`) | Real-time milestone tracking UI |

#### Backend Services

| Service | Language/Runtime | Responsibility |
|---|---|---|
| API Gateway | Node.js / Express | Request routing, auth middleware, rate limiting, tenant resolution |
| Session Service | Node.js | Create/manage intake sessions; map `session_id` → `firm_id`, `agent_id`, `lead_id` |
| Intake Orchestrator | Node.js | Milestone processing, qualification scoring, GHL contact/opportunity creation |
| Retainer Orchestrator | Node.js | Template selection, field population, e-sign API dispatch, post-signature handling |
| Booking Orchestrator | Node.js | GHL free-slot fetch, appointment creation, confirmation delivery |
| Webhook Receiver | Node.js | Receives events from Athena, GHL, and e-sign platforms; dispatches to handlers |
| Tenant Config Service | Node.js | Loads firm-specific config (practice areas, qualification questions, attorney roster, calendar IDs) |
| Notification Service | Node.js | SMS/email via GHL Conversations API |

#### Infrastructure

| Component | Technology | Notes |
|---|---|---|
| Compute | Google Cloud Run | Containerized, auto-scaling |
| Database | PostgreSQL (Cloud SQL) | Primary persistent store |
| Cache / PubSub | Redis (Cloud Memorystore) | Session state, real-time event bus (replaces in-memory WebSocket global channel) |
| Storage | Google Cloud Storage | Retainer PDFs, media assets, KB documents |
| Secrets | Google Secret Manager | API keys, OAuth tokens |

---

### 2.3 Data Flow — Full Lifecycle

```
Visitor lands on law firm website
        │
        ▼
[1] Widget loads via Athena Widget SDK script tag
        │  Widget reads: firm_id from embed config
        │
        ▼
[2] Visitor clicks "Talk to [Concierge Name]"
        │
        ▼
[3] Frontend → POST /api/v1/sessions/create
        │  body: { firm_id, channel: 'voice'|'chat' }
        │  backend resolves firm config → picks correct Athena assistant_id
        │
        ▼
[4] Backend → POST /api/v1/assistants/:assistant_id/calls (Athena)
        │  Returns: { access_token, call_id }
        │
        ▼
[5] Frontend starts Athena SDK call  [WebSocket session subscribed → Redis channel]
        │
        ▼
[6] AI Conversation — Athena agent conducts intake
        │  Practice-area-specific questions loaded from firm's Knowledge Base
        │  As data points collected → Athena fires webhook tool calls
        │
        ▼
[7] Webhook: POST /webhooks/athena/tool-call
        │  milestone_id, field_name, field_value, call_id, firm_id
        │  → Redis pub: session:${call_id}:milestone
        │  → Frontend receives via SSE/WebSocket → updates progress bar
        │  → qualificationData populated incrementally
        │
        ▼
[8] Qualification complete — lead scored
        │
        │── DISQUALIFIED ──► GHL: create contact (tag: disqualified) 
        │                    GHL: enroll in "unqualified nurture" workflow
        │                    GHL: send SMS/email with information resources
        │                    Audit log entry written
        │
        │── QUALIFIED ──────►
        │
        ▼
[9] POST /api/v1/leads  (backend creates lead record)
        │
        ▼
[10] GHL: POST /contacts/  — create contact
        │  firstName, lastName, phone, email, tags: ['qualified', practice_area, firm_id]
        │  custom fields: incidentDate, jurisdiction, qualScore, practiceArea
        │
        ▼
[11] GHL: POST /opportunities  — create deal in pipeline
        │  pipelineId: firm's intake pipeline
        │  stageId: "Intake Qualified"
        │  monetaryValue: estimated case value (if configured)
        │
        ▼
[12] BOOKING  (concurrent with retainer — both dispatched in parallel)
        │
        ├── GET /calendars/:calendarId/free-slots  (GHL)
        │     startDate: now, endDate: +7 days, timezone: lead's local TZ
        │
        ├── Return 3 slot options to UI
        │
        └── Lead selects slot → POST /calendars/events/appointments (GHL)
              calendarId, contactId, startTime, locationId
              → Confirmation SMS via GHL Conversations API
        │
        ▼
[13] RETAINER GENERATION  (concurrent with booking)
        │
        ├── Select template: practice_area × state × attorney_id
        │
        ├── Populate fields from qualificationData
        │
        ├── POST to e-sign platform API (DocuSign/HelloSign/PandaDoc)
        │     template_id, signer: { name, email, phone }
        │
        └── E-sign platform → sends email + SMS to lead with signing link
              60-second delivery target from qualification completion
        │
        ▼
[14] Lead receives retainer link via SMS + email
        │
        ▼
[15] Lead signs retainer
        │
        ▼
[16] E-sign webhook: POST /webhooks/esign/completed
        │  document_id, signer_ip, timestamp, document_hash
        │
        ▼
[17] Backend:
        ├── GHL: PUT /opportunities/:id  → stage: "Retainer Signed"
        ├── GHL: POST /contacts/:id/workflow/:retainer_signed_workflow  — triggers attorney notification
        ├── Audit log: sign event, IP, hash (immutable write)
        ├── Lead record: status = 'signed', retainer_url = GCS path
        └── If verification pipeline enabled: Gate 3 checks trigger (police report, etc.)
```

---

### 2.4 API Integration Map

| Function | API Used | Endpoint |
|---|---|---|
| Create intake session | Athena | `POST /api/v1/assistants/:id/calls` |
| Receive call events/milestones | Athena Webhooks | `POST /webhooks/athena/tool-call` |
| Knowledge base — load firm context | Athena | `GET /api/v1/knowledge-base/:id` |
| Outbound follow-up call | Athena Campaigns | `POST /api/v1/campaigns` |
| Create CRM contact | GHL | `POST /contacts/` |
| Create pipeline opportunity | GHL | `POST /opportunities` |
| Advance pipeline stage | GHL | `PUT /opportunities/:id` |
| Get available calendar slots | GHL | `GET /calendars/:id/free-slots` |
| Book appointment | GHL | `POST /calendars/events/appointments` |
| Send SMS | GHL | `POST /conversations/messages` (type: SMS) |
| Send email | GHL | `POST /conversations/messages` (type: email) |
| Enroll in workflow | GHL | `POST /contacts/:id/workflow/:workflowId` |
| Create e-sign envelope | DocuSign/HelloSign | Platform-specific envelope create API |
| Receive signature event | E-sign Webhook | `POST /webhooks/esign/completed` |
| Embed widget on site | Athena Widget SDK | `<script>` tag with `assistant_id` + `firm_id` |

---

### 2.5 Multi-Tenancy Architecture

Each law firm is a **tenant**. Tenant isolation is enforced at every layer.

**Tenant data model:**
```sql
CREATE TABLE firms (
  id            UUID PRIMARY KEY,
  name          VARCHAR(255) NOT NULL,
  slug          VARCHAR(100) UNIQUE NOT NULL,   -- used in widget embed
  ghl_location_id   VARCHAR(100) UNIQUE,        -- GHL sub-account ID
  athena_org_id     VARCHAR(100),               -- Athena org/account ID
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  active        BOOLEAN DEFAULT TRUE
);

CREATE TABLE firm_config (
  firm_id           UUID REFERENCES firms(id),
  practice_areas    TEXT[] NOT NULL,            -- ['real_estate','business_law','taxation']
  active_states     TEXT[],                     -- state codes
  concierge_name    VARCHAR(100) DEFAULT 'Your Legal Concierge',
  concierge_persona VARCHAR(50)  DEFAULT 'professional',
  calendar_ids      JSONB,                      -- { "paul_donovan": "cal_xxx" }
  pipeline_id       VARCHAR(100),               -- GHL pipeline ID
  esign_provider    VARCHAR(50)  DEFAULT 'hellosign',
  esign_api_key_ref VARCHAR(255),               -- Secret Manager path
  PRIMARY KEY (firm_id)
);

CREATE TABLE attorneys (
  id          UUID PRIMARY KEY,
  firm_id     UUID REFERENCES firms(id),
  name        VARCHAR(255),
  ghl_user_id VARCHAR(100),
  calendar_id VARCHAR(100),
  practice_areas TEXT[],
  active      BOOLEAN DEFAULT TRUE
);

CREATE TABLE retainer_templates (
  id              UUID PRIMARY KEY,
  firm_id         UUID REFERENCES firms(id),
  practice_area   VARCHAR(100),
  state_code      CHAR(2),
  attorney_id     UUID REFERENCES attorneys(id),
  esign_template_id VARCHAR(255),               -- ID in e-sign platform
  version         INTEGER DEFAULT 1,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

**Athena — one assistant per firm (or per practice area for complex firms):**
```
POST /api/v1/assistants
{
  "name": "Donovan-Legal-Concierge",
  "knowledge_base_id": "kb_donovan_xxx",
  "voice_config": { "provider": "...", "voice_id": "..." },
  "webhook_url": "https://api.legalconcierge.ai/webhooks/athena/tool-call?firm_id=donovan"
}
```

**GHL — one Location (sub-account) per firm:**
Each firm maps to a GHL Location. The Legal Concierge backend authenticates via OAuth 2.0 at the Agency level, then calls Location-scoped endpoints using `locationId` from `firm_config.ghl_location_id`.

**Request context:**  
Every inbound request resolves to a tenant. Widget embeds include `data-firm-id="..."` attribute. Webhooks include `firm_id` in query string. API calls include tenant JWT claim. No cross-tenant data is ever returned in a single response.

---

## 3. Integration Architecture

### 3.1 Athena Platform (Voice AI Engine)

**Base URL:** `https://[your-connexus-domain]/api/v1`  
**Auth:** `X-API-Key: sk_live_...`

#### 3.1.1 Assistant Configuration

On firm onboarding, create a dedicated assistant per firm:

```bash
POST /api/v1/assistants
X-API-Key: $ATHENA_API_KEY

{
  "name": "Donovan-Legal-Concierge-v1",
  "description": "Legal intake concierge for Donovan Legal PLLC — Real Estate, Business Law, Taxation",
  "llm_config": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.3,
    "system_prompt": "You are [ConciergeNameFromConfig], a professional legal intake concierge for [FirmName]. ..."
  },
  "voice_config": {
    "transcriber_provider": "deepgram",
    "synthesizer_provider": "elevenlabs",
    "voice_id": "professional-male-v2"
  },
  "knowledge_base_id": "kb_donovan_xxx",
  "webhook_url": "https://api.legalconcierge.ai/webhooks/athena/tool-call?firm_id=donovan_pllc",
  "tools": [
    "log_milestone",
    "capture_contact_info",
    "capture_practice_area",
    "capture_qualification_data",
    "submit_qualified_lead",
    "request_booking_slot",
    "confirm_booking",
    "end_call"
  ]
}
```

**Response:** `{ "id": "asst_xxx", "name": "...", "status": "active" }`

Store `asst_xxx` in `firm_config` (or `attorneys` table if per-attorney). Reference it when creating web call sessions.

#### 3.1.2 Knowledge Base — Upload Firm Context

Each firm gets a dedicated Knowledge Base. Documents uploaded at onboarding and updated whenever the firm's information changes.

```bash
POST /api/v1/knowledge-base
{
  "name": "Donovan Legal PLLC — Knowledge Base",
  "description": "Practice areas, qualification criteria, FAQs, attorney info"
}
# Returns: { "id": "kb_xxx" }

# Upload practice area document
POST /api/v1/knowledge-base/kb_xxx/upload
Content-Type: multipart/form-data
file: donovan-practice-areas.pdf

# Upload qualification criteria
POST /api/v1/knowledge-base/kb_xxx/upload
Content-Type: multipart/form-data
file: donovan-qualification-criteria.md

# Assign KB to assistant
PUT /api/v1/assistants/asst_xxx
{ "knowledge_base_id": "kb_xxx" }
```

**What goes in the KB:**
- Firm's practice areas and sub-specialties
- Qualification questions per practice area (what to ask, what disqualifies)
- Attorney bios and specializations
- Common FAQs
- Geographic restrictions (states/jurisdictions)
- Retainer fee structure (for disclosure only — never specific advice)
- Disqualification rules ("if the lease is over 5 years ago, escalate to attorney review")

#### 3.1.3 Widget SDK Deployment

On the firm's website, embed the widget with one script tag:

```html
<!-- Legal Concierge Widget — Donovan Legal PLLC -->
<script
  src="https://api.legalconcierge.ai/widget/v1/sdk.js"
  data-firm-id="donovan_pllc"
  data-assistant-id="asst_xxx"
  data-position="bottom-right"
  data-primary-color="#1a3a5c"
  data-concierge-name="Your Legal Concierge"
  defer
></script>
```

The SDK script:
1. Creates a floating button at the configured position
2. On click, opens an iframe or in-page modal
3. Calls the Legal Concierge backend (`/api/v1/sessions/create`) to initialize a call
4. Starts Athena WebRTC session
5. Emits events to parent window via `postMessage` for deep integration

For mobile app, the Widget SDK provides a React Native component or WebView wrapper. The `data-*` attributes are passed as props.

#### 3.1.4 Campaigns API — Outbound Follow-up Calls

When a lead does not sign their retainer within a configured window (default: 4 hours), or when a prospect requests a callback, trigger an outbound campaign:

```bash
POST /api/v1/campaigns
{
  "name": "Donovan-Unsigned-Retainer-Followup-2026-04-07",
  "assistant_id": "asst_xxx",
  "schedule": {
    "start_at": "2026-04-07T16:00:00Z",
    "timezone": "America/New_York"
  },
  "leads": [
    {
      "phone_number": "+15551234567",
      "dynamic_variables": {
        "lead_first_name": "Jane",
        "practice_area": "real_estate",
        "retainer_link": "https://sign.hellosign.com/...",
        "attorney_name": "Paul Donovan"
      }
    }
  ]
}
```

The campaign-mode agent script differs from the inbound script: it references the lead's prior conversation, reminds them of the next steps, and can re-send the retainer link via SMS from within the call.

#### 3.1.5 Webhooks — Call Completion and Tool Events

Register a webhook to receive all call events:

```bash
POST /api/v1/webhooks
{
  "url": "https://api.legalconcierge.ai/webhooks/athena/events",
  "events": ["call.completed", "call.tool_called", "call.transcript_ready"],
  "secret": "whsec_xxx"    // for HMAC verification
}
```

**Inbound webhook payload (tool_called):**
```json
{
  "event": "call.tool_called",
  "call_id": "call_xxx",
  "assistant_id": "asst_xxx",
  "tool_name": "capture_qualification_data",
  "arguments": {
    "field": "incident_date",
    "value": "2026-03-15",
    "milestone_id": 5
  },
  "timestamp": "2026-04-07T15:30:00Z"
}
```

**Inbound webhook payload (call.completed):**
```json
{
  "event": "call.completed",
  "call_id": "call_xxx",
  "duration_seconds": 347,
  "transcript_url": "https://...",
  "qualification_outcome": "qualified",
  "summary": "Lead Jane Doe, real estate dispute, TX, seeks representation for..."
}
```

The webhook receiver dispatches these to the appropriate handlers in the Intake Orchestrator.

---

### 3.2 GoHighLevel (CRM & Processing)

**Base URL:** `https://services.leadconnectorhq.com/`  
**Auth:** `Authorization: Bearer {oauth_access_token}` + `Version: 2021-07-28`

**Note on X-WH-Signature:** The legacy RSA-SHA256 header is deprecated July 1, 2026. Implement `X-GHL-Signature` (Ed25519) verification now.

#### 3.2.1 Contact Creation — Qualified Lead

Fires immediately when lead passes qualification (concurrent with retainer generation):

```bash
POST /contacts/
Authorization: Bearer {token}
Version: 2021-07-28

{
  "locationId": "{ghl_location_id_for_firm}",
  "firstName": "Jane",
  "lastName": "Doe",
  "phone": "+15551234567",
  "email": "jane.doe@email.com",
  "source": "Legal Concierge Widget",
  "tags": ["qualified", "real_estate", "intake_2026_04_07"],
  "customFields": [
    { "id": "cf_practice_area",   "value": "real_estate" },
    { "id": "cf_incident_date",   "value": "2026-03-15" },
    { "id": "cf_jurisdiction",    "value": "TX" },
    { "id": "cf_qual_score",      "value": "8" },
    { "id": "cf_session_id",      "value": "call_xxx" },
    { "id": "cf_attorney_id",     "value": "paul_donovan" }
  ]
}
```

**Response:** `{ "contact": { "id": "contact_xxx", ... } }`

Store `contact_xxx` in the `leads` table for cross-reference.

#### 3.2.2 Pipeline Opportunity Creation

```bash
POST /opportunities
{
  "pipelineId": "{intake_pipeline_id}",
  "pipelineStageId": "{stage_intake_qualified}",
  "locationId": "{ghl_location_id}",
  "contactId": "contact_xxx",
  "name": "Jane Doe — Real Estate — 2026-04-07",
  "monetaryValue": 0,     // updated when case value estimated
  "assignedTo": "{ghl_user_id_for_paul_donovan}",
  "status": "open",
  "customFields": [
    { "id": "cf_practice_area", "value": "real_estate" },
    { "id": "cf_retainer_status", "value": "pending" }
  ]
}
```

#### 3.2.3 Pipeline Stage Advancement

Use `PUT /opportunities/:id` to update stage as lead progresses:

```
Stage Map (configure in GHL):
  "Intake Qualified"     → lead passed AI qualification
  "Retainer Sent"        → e-sign envelope dispatched
  "Retainer Signed"      → webhook confirmed signature
  "Appointment Booked"   → calendar slot confirmed
  "Active Client"        → attorney has accepted
  "Closed Won"           → case engaged
  "Closed Lost"          → lead dropped/unresponsive
```

```bash
PUT /opportunities/{opportunity_id}/status
{
  "status": "open"    // or "won", "lost", "abandoned"
}

PUT /opportunities/{opportunity_id}
{
  "pipelineStageId": "{stage_retainer_signed}"
}
```

#### 3.2.4 Calendar Booking

**Step 1: Fetch available slots**
```bash
GET /calendars/{calendarId}/free-slots
  ?startDate=1712484000000   (Unix ms — now)
  &endDate=1713088800000     (Unix ms — +7 days)
  &timezone=America/New_York
Authorization: Bearer {token}
Version: 2021-07-28
```

**Response:**
```json
{
  "slots": {
    "2026-04-08": [
      { "startTime": "2026-04-08T09:00:00-05:00", "endTime": "2026-04-08T09:30:00-05:00" },
      { "startTime": "2026-04-08T10:00:00-05:00", "endTime": "2026-04-08T10:30:00-05:00" }
    ],
    "2026-04-09": [ ... ]
  }
}
```

Present 3 options in the intake UI. Lead selects one.

**Step 2: Book the appointment**
```bash
POST /calendars/events/appointments
{
  "calendarId": "{paul_donovan_calendar_id}",
  "locationId": "{ghl_location_id}",
  "contactId": "contact_xxx",
  "startTime": "2026-04-08T09:00:00-05:00",
  "appointmentStatus": "confirmed",
  "title": "Initial Consultation — Jane Doe — Real Estate",
  "notes": "Practice area: Real Estate. Case summary: [AI-generated summary from transcript]",
  "assignedUserId": "{ghl_user_id_paul_donovan}"
}
```

**Step 3: Send confirmation SMS**
```bash
POST /conversations/messages
{
  "type": "SMS",
  "contactId": "contact_xxx",
  "locationId": "{ghl_location_id}",
  "message": "Your consultation with Paul Donovan is confirmed for April 8 at 9:00 AM ET. Reply STOP to opt out."
}
```

#### 3.2.5 Conversations API — SMS Retainer Delivery

When the retainer envelope is created, send a parallel SMS:

```bash
POST /conversations/messages
{
  "type": "SMS",
  "contactId": "contact_xxx",
  "locationId": "{ghl_location_id}",
  "message": "Your retainer agreement from Donovan Legal is ready. Review and sign here: {esign_url}  — This link expires in 72 hours."
}
```

GHL handles TCPA compliance at the platform level. Ensure the contact's `smsConsent` field is set before sending.

#### 3.2.6 Workflow Enrollment

GHL Workflows automate follow-up sequences. Pre-build these workflows in GHL UI, then enroll leads via API:

```bash
# Enroll in "Retainer Follow-Up" workflow
POST /contacts/{contactId}/workflow/{retainer_followup_workflow_id}

# Enroll in "Appointment Reminder" workflow
POST /contacts/{contactId}/workflow/{appointment_reminder_workflow_id}

# Remove from follow-up after retainer signed
DELETE /contacts/{contactId}/workflow/{retainer_followup_workflow_id}
```

**Pre-build these workflows in GHL:**
- `retainer-followup`: SMS at 2h, 24h, 48h if unsigned. Email at 24h. Athena outbound call at 72h.
- `appointment-reminder`: SMS 24h before, SMS 1h before. Email 24h before.
- `unqualified-nurture`: Email with legal resource content, 3-touch over 7 days.
- `new-intake-alert`: Slack/email notification to attorney on new qualified lead.

#### 3.2.7 GHL Webhook Events — Inbound to Legal Concierge

Register GHL webhooks in the OAuth app settings to receive events:

```
Events to subscribe:
  ContactCreate      → log new contact in LC database
  AppointmentCreate  → update LC appointment record
  OpportunityStageUpdate → update LC lead status
  VoiceAiCallEnd     → if using GHL Voice AI (alternative path)
  InboundMessage     → log incoming replies for audit trail
```

**Webhook endpoint:** `POST /webhooks/ghl/events?firm_id={firm_id}`  
**Signature:** Verify `X-GHL-Signature` (Ed25519) before processing.

#### 3.2.8 Multi-Location (Multi-Firm) Pattern

The Legal Concierge backend authenticates at the **Agency** level via OAuth 2.0:
- Agency-level access token allows `POST /locations/` to create new sub-accounts programmatically during firm onboarding
- Location-scoped tokens are obtained per-firm for day-to-day operations
- Store token + refresh_token in Secret Manager per `firm_id`
- Auto-refresh before expiry (implement token refresh middleware)

Required OAuth scopes for the Legal Concierge GHL app:
```
contacts.readonly contacts.write
calendars.readonly calendars.write
calendars/events.readonly calendars/events.write
opportunities.readonly opportunities.write
conversations.readonly conversations.write
conversations/message.readonly conversations/message.write
workflows.readonly
locations.readonly locations.write
voice-ai-agents.readonly
users.readonly
businesses.readonly
```

---

### 3.3 E-Signature Integration

#### 3.3.1 Platform Selection and Configuration

**Recommended default:** HelloSign (Dropbox Sign) — solid API, $15/month for typical legal intake volumes, good consumer recognition.

**DocuSign** if the firm already has an account or requires maximum court defensibility.

**PandaDoc** if the firm wants to manage templates inside one tool with a document editor.

Store the firm's chosen provider and API credentials in Secret Manager:
```
secret: legal-concierge/firms/{firm_id}/esign_api_key
```

#### 3.3.2 Retainer Template Selection Logic

```javascript
function selectRetainerTemplate(db, firmId, practiceArea, stateCode, attorneyId) {
  // 1. Most specific: practice_area + state + attorney
  let template = await db.query(`
    SELECT * FROM retainer_templates
    WHERE firm_id = $1
      AND practice_area = $2
      AND state_code = $3
      AND attorney_id = $4
      AND active = true
    ORDER BY version DESC LIMIT 1
  `, [firmId, practiceArea, stateCode, attorneyId]);
  
  if (template) return template;
  
  // 2. Fallback: practice_area + state (any attorney)
  template = await db.query(`...WHERE practice_area = $2 AND state_code = $3 AND active = true...`);
  if (template) return template;
  
  // 3. Fallback: practice_area only (firm-wide)
  template = await db.query(`...WHERE practice_area = $2 AND active = true...`);
  if (template) return template;
  
  throw new Error(`No retainer template for ${practiceArea}/${stateCode}/${firmId}`);
}
```

#### 3.3.3 Envelope Creation (HelloSign example)

```javascript
const hellosign = new HelloSign({ apiKey: process.env.HELLOSIGN_API_KEY });

const envelope = await hellosign.signatureRequest.createWithTemplate({
  template_ids: [template.esign_template_id],
  subject: `Retainer Agreement — ${practiceArea} — ${firmName}`,
  message: `Please review and sign your retainer agreement with ${firmName}.`,
  signers: [{
    role: 'Client',
    name: `${lead.firstName} ${lead.lastName}`,
    email_address: lead.email
  }],
  custom_fields: [
    { name: 'ClientName',      value: `${lead.firstName} ${lead.lastName}` },
    { name: 'IncidentDate',    value: lead.incidentDate },
    { name: 'Jurisdiction',    value: lead.jurisdiction },
    { name: 'PracticeArea',    value: practiceArea },
    { name: 'AttorneyName',    value: attorney.name },
    { name: 'FirmName',        value: firm.name },
    { name: 'DateSigned',      value: new Date().toLocaleDateString() }
  ],
  signing_options: {
    draw: true,
    type: true,
    upload: true,
    phone: false,
    default_type: 'draw'
  },
  test_mode: process.env.NODE_ENV !== 'production' ? 1 : 0
});

// envelope.signature_request.signature_request_id → store in leads table
// envelope.signature_request.signing_url → send to lead via SMS
```

Target: envelope created and SMS sent within **60 seconds** of qualification completion.

#### 3.3.4 Signature Webhook — Post-Signature Handling

```bash
# Register webhook with HelloSign
POST https://api.hellosign.com/v3/webapp
{
  "event_type": "signature_request_signed",
  "callback_url": "https://api.legalconcierge.ai/webhooks/esign/completed"
}
```

**Inbound webhook payload:**
```json
{
  "event": {
    "event_type": "signature_request_signed",
    "event_time": "1712484000",
    "event_hash": "...",
    "event_metadata": {
      "related_signature_id": "sig_xxx",
      "signature_request_id": "sr_xxx"
    }
  },
  "signature_request": {
    "signature_request_id": "sr_xxx",
    "title": "Retainer Agreement — Real Estate",
    "is_complete": true,
    "signed_at": 1712484000,
    "signatures": [{
      "signer_email_address": "jane.doe@email.com",
      "signer_name": "Jane Doe",
      "status_code": "signed",
      "signed_at": 1712484000,
      "last_viewed_at": 1712483500
    }]
  }
}
```

**Handler logic:**
```javascript
async function handleEsignCompleted(payload) {
  const lead = await db.leads.findByEsignId(payload.signature_request.signature_request_id);
  
  // 1. Update lead record
  await db.leads.update(lead.id, {
    status: 'retainer_signed',
    retainer_signed_at: new Date(payload.signature_request.signed_at * 1000),
    retainer_document_url: await downloadAndStoreRetainer(payload)
  });
  
  // 2. Write immutable audit log
  await db.audit_log.insert({
    event_type: 'retainer_signed',
    lead_id: lead.id,
    firm_id: lead.firm_id,
    signer_email: payload.signature_request.signatures[0].signer_email_address,
    signed_at: payload.signature_request.signed_at,
    document_hash: computeHash(payload),
    raw_payload: payload  // store original for audit
  });
  
  // 3. Advance GHL pipeline
  await ghl.opportunities.update(lead.ghl_opportunity_id, {
    pipelineStageId: STAGE_RETAINER_SIGNED
  });
  
  // 4. Remove from retainer follow-up workflow
  await ghl.contacts.removeFromWorkflow(lead.ghl_contact_id, WORKFLOW_RETAINER_FOLLOWUP);
  
  // 5. Enroll in attorney notification workflow
  await ghl.contacts.addToWorkflow(lead.ghl_contact_id, WORKFLOW_ATTORNEY_NOTIFICATION);
  
  // 6. If verification pipeline enabled: trigger Gate 3 checks
  if (lead.verificationConfig.autoTriggerGate3) {
    await verificationService.triggerGate3(lead);
  }
}
```

---

## 4. Donovan Law Implementation Plan

### 4.1 Firm Profile

| Attribute | Value |
|---|---|
| Firm name | Donovan Legal PLLC |
| Primary attorney | Paul Donovan |
| Practice areas | Real Estate, Business Law, Taxation |
| Jurisdiction | (Confirm with Paul — likely TX primary; federal for tax) |
| Website | donovan-law-site (deployed on Cloud Run) |
| CRM | GoHighLevel (set up new Location for Donovan) |
| Calendar | Paul Donovan's GHL calendar |
| Concierge name | To be determined with Paul — suggest "Alex" or "Jordan" (gender-neutral) |
| Retainer templates | Need Paul to provide approved templates per practice area |

---

### 4.2 What the Concierge Needs to Know (Knowledge Base Content)

**KB Document 1 — Firm Overview:**
```
Donovan Legal PLLC is a law firm serving clients in [states].
Attorney: Paul Donovan, licensed in [states].
Practice areas: Real Estate, Business Law, Taxation.
Contact: [phone], [email].
Consultations: By appointment, [hours].
Fees: [Paul to provide — contingency vs. hourly vs. flat fee per area].
```

**KB Document 2 — Real Estate Practice Area:**
```
Real estate matters handled:
- Residential and commercial purchase/sale transactions
- Contract disputes and breach of contract
- Title issues and title insurance claims
- Landlord-tenant disputes
- Boundary disputes and easements
- HOA disputes
- Real estate fraud
- Foreclosure defense

Disqualifiers:
- Matters outside [active states]
- Cases where the incident occurred more than [SOL period] ago (varies by claim type)
- Matters where the client is currently represented by another attorney

Questions to ask:
1. What is the nature of the real estate matter?
2. Is this residential or commercial property?
3. What state is the property located in?
4. When did the issue arise (date)?
5. Are you currently working with another attorney on this matter?
6. Have you signed any contracts related to this dispute? (obtain copies)
7. What outcome are you seeking?
```

**KB Document 3 — Business Law Practice Area:**
```
Business law matters handled:
- Business formation (LLC, corporation, partnership)
- Contract drafting and review
- Business disputes and litigation
- Partnership agreements and dissolution
- Employment matters (from employer side)
- Non-disclosure agreements
- Business acquisition and sale (M&A for small-mid businesses)
- Regulatory compliance

Questions to ask:
1. What type of business entity is involved (or do you need to form one)?
2. Describe the business matter — what is the core issue?
3. How long has the business been operating?
4. Is there an existing contract or agreement at issue?
5. Are there other parties (partners, employees, other businesses) involved?
6. Is there pending litigation or a legal deadline you're aware of?
7. What is the approximate dollar value involved?
```

**KB Document 4 — Taxation Practice Area:**
```
Tax law matters handled:
- IRS audit representation
- Tax debt resolution (Offer in Compromise, installment agreements)
- Tax liens and levies
- Business tax compliance
- Estate and gift tax planning
- State tax disputes

Questions to ask:
1. Is this a personal or business tax matter?
2. Which tax authority is involved — IRS, state, or both?
3. What is the nature of the issue — audit, debt, dispute, or planning?
4. What tax year(s) are involved?
5. Has the IRS or state tax authority sent any correspondence? What does it say?
6. Is there a deadline or response required by a specific date?
7. Approximate amount of tax liability or disputed amount?
```

---

### 4.3 Qualification Flows by Practice Area

#### Real Estate

```
STEP 1: Practice area routing
  "Are you calling about a real estate matter, a business law matter, or a tax matter?"
  → Real Estate: proceed to real estate flow
  → Business Law: proceed to business flow
  → Taxation: proceed to tax flow
  → Multiple / Unsure: "Let me ask you a few general questions to understand how Paul can help you best."

STEP 2: Contact collection
  First name, last name, phone, email, SMS consent

STEP 3: Matter details
  - Property type (residential / commercial)
  - Property state / jurisdiction
  - Nature of dispute or need
  - Approximate date issue arose

STEP 4: Disqualification checks
  - Currently represented? → DISQUALIFY (politely redirect)
  - Outside service states? → ESCALATE to Paul (do not auto-disqualify — Paul may accept)
  - SOL expired? → Flag for Paul's review

STEP 5: Qualification scoring (1-10)
  +3: Commercial property (higher value)
  +2: Active contract dispute
  +2: Clear legal question (not advisory)
  +1: Client is decision-maker / property owner
  +1: Deadline in next 30 days
  -2: Already in active litigation with other counsel
  Score ≥ 5: Qualified → proceed to booking + retainer
  Score 3-4: Qualified with flag → book consult, note for Paul
  Score < 3: Resource mode → send general info, offer to have Paul's team follow up

STEP 6: Calendar booking
  Offer 3 time slots from Paul's GHL calendar (next 7 days)
  Lead selects → appointment created → confirmation SMS

STEP 7: Retainer dispatch
  Template: real_estate × [state] × paul_donovan
  Auto-populate: client name, matter description, jurisdiction, date
  Send via HelloSign: email + SMS within 60 seconds of qualification
```

#### Business Law

```
[Mirror structure of Real Estate]

Additional disqualifiers:
  - Active federal litigation without attorney? → Refer to Paul for assessment
  - Criminal/regulatory enforcement? → Flag as high priority

Qualification scoring:
  +3: Revenue-generating business (not hobby/startup idea)
  +3: Contract dispute with defined dollar amount
  +2: Business formation (clear engagement, lower liability)
  +1: Multiple parties / partners involved
  +1: Deadline or filing deadline in next 60 days
```

#### Taxation

```
[Mirror structure]

Additional required data:
  - IRS/state case number if available (optional — note if provided)
  - Deadline date on any correspondence

Qualification scoring:
  +4: Active IRS audit or collection action (urgent, high value)
  +3: Tax debt > $10,000
  +2: Business tax matter
  +2: Correspondence deadline within 30 days
  +1: Prior contact with IRS/state
```

---

### 4.4 Attorney Routing

For the first deployment, Paul Donovan is the sole attorney. Routing is trivial — all qualified leads go to Paul's calendar.

**GHL setup:**
- Create one GHL Location for Donovan Legal PLLC
- Create one GHL User for Paul Donovan
- Create one calendar per practice area (or one unified calendar with practice-area notes):
  - `cal_donovan_real_estate`
  - `cal_donovan_business_law`
  - `cal_donovan_taxation`
  - (Alternatively: one calendar `cal_donovan_consultations` with practice area in the appointment title)

Store in `firm_config.calendar_ids`:
```json
{
  "paul_donovan": {
    "real_estate": "cal_xxx",
    "business_law": "cal_yyy",
    "taxation": "cal_zzz",
    "default": "cal_donovan_consultations"
  }
}
```

**Future:** When additional attorneys join the firm, add routing logic by practice area specialization, caseload, and geographic coverage.

---

### 4.5 Retainer Template Requirements

Paul Donovan must provide approved retainer templates. At minimum, one per practice area. Ideal: one per practice area × state combination.

**Template fields to auto-populate (minimum):**
```
{{ClientFullName}}
{{ClientPhone}}
{{ClientEmail}}
{{MatterDescription}}    — AI-generated 2-sentence summary from transcript
{{PracticeArea}}
{{Jurisdiction}}          — state where matter arises
{{DateOfAgreement}}
{{AttorneyName}}          — "Paul Donovan"
{{FirmName}}              — "Donovan Legal PLLC"
{{FeeStructure}}          — e.g., "Hourly rate of $X/hr" or "Flat fee of $X"
{{EngagementScope}}       — brief description of what is and isn't covered
{{ConfidentialityClause}} — standard (pre-populated by template)
{{SignatureBlock_Client}}
{{SignatureBlock_Attorney}}
```

**Compliance notes for Paul's review:**
- Texas Bar advertising rules apply to any intake-related communications
- Texas Disciplinary Rules of Professional Conduct Rule 1.04 governs fee agreements
- Engagement letters for tax matters should include Circular 230 disclosures
- Retainer templates must be vetted by Paul before loading into production

---

### 4.6 Website Integration

The donovan-law-site is deployed on Cloud Run. Add the widget embed to the site:

1. Add the widget script tag to the site's HTML head or just before `</body>`:
```html
<script
  src="https://api.legalconcierge.ai/widget/v1/sdk.js"
  data-firm-id="donovan_pllc"
  data-assistant-id="asst_donovan_xxx"
  data-position="bottom-right"
  data-primary-color="#[PaulsBrandColor]"
  data-concierge-name="Your Legal Concierge"
  defer
></script>
```

2. Optionally add an explicit CTA button on key pages:
```html
<button data-legal-concierge-trigger class="cta-button">
  Get a Free Consultation
</button>
```

3. Update the Cloud Run deployment with the new build. No server-side changes needed — the widget is entirely client-side JavaScript.

4. Configure GHL Location and Athena assistant IDs in the Legal Concierge admin before deploying the widget to production.

---

## 5. Development Phases

### Phase 1 — Core Concierge Engine (MVP)

**Goal:** A multi-practice-area concierge that qualifies leads, persists data, and sends them to a GHL contact — zero stubs.

**Duration estimate:** 3–4 weeks

**Deliverables:**

- [ ] Backend scaffold: Express → Cloud Run, PostgreSQL (Cloud SQL), Redis (Memorystore)
- [ ] Tenant data models: `firms`, `firm_config`, `attorneys`, `intake_sessions`, `leads`, `audit_log`
- [ ] Athena integration service: `createAssistant()`, `createWebCallSession()`, `createKnowledgeBase()`, `uploadKBDocument()`
- [ ] Webhook receiver: `/webhooks/athena/tool-call` — milestone processing, qualification data extraction, Redis pub-sub, per-session isolation
- [ ] Athena tool definitions: `log_milestone`, `capture_contact_info`, `capture_practice_area`, `capture_qualification_data`, `submit_qualified_lead`, `end_call`
- [ ] Multi-practice-area qualification logic (configurable per firm)
- [ ] Qualification scoring engine (configurable weights per practice area)
- [ ] Frontend: intake modal (migrate from AdvisoryConnect `LeahIntakeModal.tsx` — strip Retell SDK, replace with Athena SDK)
- [ ] Frontend: practice area detection and routing in modal flow
- [ ] Per-session WebSocket isolation (Redis pub-sub replaces global channel)
- [ ] Widget SDK: `sdk.js` embed script (positions button, opens modal, passes `firm_id` and `assistant_id`)
- [ ] Environment: Secret Manager integration, proper `.env` documentation
- [ ] Donovan Legal PLLC: tenant creation, Athena assistant, GHL Location, KB documents loaded

**Non-goals for Phase 1:** Retainer generation, calendar booking, e-signature, mobile app.

**Dependencies:** Athena Platform API key, GHL Agency account, Cloud SQL + Redis provisioned.

**Definition of done:** A visitor to the donovan-law-site clicks the widget, has a full intake conversation with the concierge, the lead is created in GHL with all qualification data, the `audit_log` has an immutable record, and the qualifying lead appears in the GHL pipeline as "Intake Qualified."

---

### Phase 2 — CRM Integration (GHL)

**Goal:** Full GHL integration — contact lifecycle, pipeline, SMS/email, workflows.

**Duration estimate:** 2 weeks (builds directly on Phase 1 backend)

**Deliverables:**

- [ ] GHL OAuth 2.0 flow: agency-level auth, per-firm Location token management, auto-refresh
- [ ] `ghl.contacts.create()` — called from `submit_qualified_lead` webhook handler
- [ ] `ghl.contacts.update()` — update with qualification data as conversation progresses
- [ ] `ghl.opportunities.create()` — create deal on qualification
- [ ] `ghl.opportunities.updateStage()` — advance pipeline stages throughout lifecycle
- [ ] `ghl.conversations.sendSMS()` — send qualified lead confirmation SMS
- [ ] `ghl.conversations.sendEmail()` — send qualification summary email
- [ ] Workflow enrollment: `ghl.contacts.addToWorkflow()`
- [ ] Workflow removal: `ghl.contacts.removeFromWorkflow()`
- [ ] GHL webhook receiver: `/webhooks/ghl/events` — signature verification (Ed25519), contact/opportunity/appointment event handling
- [ ] Pre-built GHL workflows for Donovan PLLC: `retainer-followup`, `appointment-reminder`, `unqualified-nurture`, `new-intake-alert`
- [ ] Custom fields schema for Donovan PLLC GHL Location: `cf_practice_area`, `cf_incident_date`, `cf_jurisdiction`, `cf_qual_score`, `cf_session_id`, `cf_retainer_status`

**Non-goals for Phase 2:** Calendar booking, retainer/e-signature.

**Definition of done:** Every qualified lead is in GHL with full custom field data; disqualified leads are in GHL with appropriate tag; all leads are enrolled in appropriate workflows; attorney receives SMS/email notification on new qualified lead; pipeline shows correct stage.

---

### Phase 3 — Calendar Booking

**Goal:** Concierge offers and books time with Paul Donovan's calendar at the end of a qualified intake conversation.

**Duration estimate:** 1–2 weeks

**Deliverables:**

- [ ] `ghl.calendar.getFreeSlots(calendarId, startDate, endDate, timezone)` — returns available times
- [ ] Athena tool: `request_booking_slot` — triggers slot fetch during conversation; returns 3 options to concierge
- [ ] Athena tool: `confirm_booking` — receives lead's slot selection, fires booking
- [ ] `ghl.calendar.bookAppointment(calendarId, contactId, startTime, locationId)` — creates appointment
- [ ] Appointment confirmation SMS via `ghl.conversations.sendSMS()`
- [ ] Appointment record in `appointments` table
- [ ] GHL pipeline stage update: "Appointment Booked"
- [ ] Frontend: slot selection UI (3 buttons with date/time; accessible, mobile-friendly)
- [ ] Timezone detection: use browser `Intl.DateTimeFormat` to detect lead's TZ; pass to slot fetch
- [ ] Gmail fallback path (Phase 3b): if GHL calendar is unavailable or firm is not yet on GHL, use Google Calendar API to check Paul's availability and create events. Requires Gmail/GCal OAuth for Paul.

**Definition of done:** Qualified lead selects a time slot during (or immediately after) the intake conversation; appointment appears in Paul's GHL calendar; lead receives SMS confirmation; GHL pipeline shows "Appointment Booked."

---

### Phase 4 — Retainer & E-Signature

**Goal:** Qualified lead receives a pre-populated retainer agreement for e-signature within 60 seconds of qualification completion.

**Duration estimate:** 2–3 weeks

**Deliverables:**

- [ ] Retainer template management: `retainer_templates` table, admin UI for upload/version management
- [ ] Template selection logic: `selectRetainerTemplate(firmId, practiceArea, stateCode, attorneyId)`
- [ ] Field population engine: map `qualificationData` → template field values
- [ ] HelloSign API client: `createEnvelope()`, `getEnvelopeStatus()`, `downloadSignedDocument()`
- [ ] DocuSign API client: same interface, different implementation (pluggable)
- [ ] Envelope creation on qualification: fires in parallel with calendar booking
- [ ] Retainer delivery SMS (within 60 seconds of qualification)
- [ ] E-sign webhook receiver: `/webhooks/esign/completed` — signature confirmation handler
- [ ] Post-signature: GHL stage → "Retainer Signed", audit log entry, retainer PDF stored in GCS
- [ ] GHL: remove from retainer follow-up workflow, enroll in attorney notification workflow
- [ ] Unsigned retainer follow-up: detect unsigned after 4h → trigger Athena outbound campaign
- [ ] Retainer templates loaded for Donovan PLLC (Paul must provide templates first)
- [ ] Admin UI: template upload, field mapping validator, template version history

**Definition of done:** After qualification, lead receives SMS + email with HelloSign link within 60 seconds; upon signing, GHL pipeline advances to "Retainer Signed," audit log records the event immutably, and Paul receives a notification with the signed document attached.

---

### Phase 5 — Multi-Firm Platform

**Goal:** Onboard a second law firm without any code changes — only configuration.

**Duration estimate:** 3–4 weeks

**Deliverables:**

- [ ] Admin portal (web app): firm onboarding wizard
  - Firm details (name, slug, states, practice areas)
  - Athena assistant creation (automated via API on form submit)
  - Knowledge base creation + document upload
  - GHL Location creation (or link to existing)
  - Attorney roster configuration
  - Calendar ID linking
  - Retainer template upload and mapping
  - E-sign provider selection and API key entry
  - Widget embed code generation
- [ ] Firm isolation audit: confirm no cross-tenant data leakage at DB, API, and webhook layers
- [ ] Per-firm customization: concierge name, voice, persona, color scheme, greeting
- [ ] Per-firm qualification question library (configurable, not hard-coded)
- [ ] Per-firm disqualification rules
- [ ] Per-firm SOL database (which states active, which SOL periods apply)
- [ ] Billing integration foundation (per-lead pricing or monthly SaaS — Phase 5b)

**Definition of done:** Second law firm is onboarded via the admin portal with no engineering involvement; their widget works end-to-end; their data is completely isolated from Donovan Legal's data.

---

### Phase 6 — Mobile App

**Goal:** iOS and Android app that surfaces the Legal Concierge for 24/7 mobile access.

**Duration estimate:** 4–6 weeks

**Deliverables:**

- [ ] React Native (Expo) scaffold
- [ ] Athena Widget SDK integration (React Native component or WebView bridge)
- [ ] Push notification service: Firebase Cloud Messaging (FCM) for lead alerts to attorneys
- [ ] Push notification service: lead receives push when retainer is unsigned (alternative to SMS)
- [ ] App branding per firm (white-label build system or branded theme)
- [ ] Deep link: retainer link in SMS opens app if installed
- [ ] Biometric auth for admin/attorney view
- [ ] Offline state handling: queue calls for when connectivity restores
- [ ] App Store + Google Play submission process
- [ ] Mobile-specific QA: audio permissions, background state, keyboard handling

**Definition of done:** A potential client can download the app, have a full intake conversation with the concierge, select a booking slot, and receive their retainer link — all without touching a desktop browser.

---

### Phase 7 — Advanced Features

**Goal:** Verification pipeline, compliance database, analytics dashboard, outbound campaigns.

**Duration estimate:** 6–8 weeks

**Deliverables:**

**Verification Pipeline:**
- [ ] Connector framework: pluggable provider adapters per verification type
- [ ] Gate 1 (free): duplicate check (internal DB), conflict check, SOL calculation
- [ ] Gate 2 (low cost): ID verification (Persona or Jumio), insurance verification (Verisk)
- [ ] Gate 3 (medium cost): police report pull (LexisNexis / CrashDocs)
- [ ] Gate 4 (post-retainer): medical records request (Ciox/Datavant)
- [ ] Cost cap enforcement per lead and per month
- [ ] Quality score threshold configuration per gate per practice area
- [ ] Verification result attachment to lead package

**Compliance Database:**
- [ ] Immutable audit log enforcement (append-only; no UPDATE/DELETE on `audit_log` table)
- [ ] Conflict check database (all matters processed, deduplicated by name + matter type)
- [ ] Bar rule version tracking per state
- [ ] Compliance certificate generation for each signed retainer
- [ ] GDPR/CCPA data deletion flow (delete lead PII while preserving anonymized audit record)

**Analytics Dashboard:**
- [ ] Lead volume by practice area, state, time period
- [ ] Qualification rate (widget conversations → qualified leads)
- [ ] Retainer conversion rate (qualified → signed)
- [ ] Booking rate (qualified → appointment booked)
- [ ] Average time: widget click → signed retainer
- [ ] Attorney utilization (bookings per attorney, by practice area)
- [ ] Verification cost breakdown (Gate 2/3/4 spend per month)
- [ ] GHL pipeline funnel visualization (linked from GHL Opportunities API)

**Outbound Campaigns:**
- [ ] Athena Campaigns API integration: programmatic campaign creation
- [ ] Campaign triggers: unsigned retainer at 4h, 24h, 72h; missed appointment; re-engagement at 30 days
- [ ] Campaign deduplication: do not call if already signed, already booked, already DND
- [ ] TCPA compliance: only call within configured hours, respect opt-outs

---

## 6. Technical Decisions & Trade-offs

### 6.1 Retell AI (Current) vs. Athena (Target) — Migration Path

| Dimension | Retell AI | Athena (ConnexUS) |
|---|---|---|
| Ownership | Third-party SaaS | Owned by ConnexUS AI — David's own platform |
| Revenue | Pay per minute to a vendor | Keep all revenue, control roadmap |
| Agent API | `POST /v2/create-web-call` | `POST /api/v1/assistants/:id/calls` |
| Knowledge Base | Configured in Retell dashboard (manual) | Programmatic via `/api/v1/knowledge-base` — enables multi-tenant automation |
| Custom tools / webhooks | Configured in Retell dashboard per agent | Configurable via API + webhook URL per assistant |
| Multi-tenancy | One account, multiple agents (manageable) | Built-in org/role management |
| Campaigns / outbound | Retell phone call API (used in AdvisoryConnect) | Athena Campaigns API — structured lead management |
| Widget SDK | Retell client JS SDK (WebRTC) | Athena Widget SDK (same WebRTC foundation) |
| Call transfers | Web calls cannot transfer (hard limitation) | Confirm with Athena: phone-based calls should support transfer |
| Existing code dependency | All of AdvisoryConnect is Retell-specific | Migrate to Athena API — interface swap |

**Migration path:**
1. Build Athena integration service with the same interface that AdvisoryConnect's `server.js` exposes: `createWebCallSession()`, `createPhoneCallSession()`, `createChatSession()`, `sendChatMessage()`, `endSession()`
2. Swap the implementation behind each method from Retell API calls to Athena API calls
3. Replace `retell-client-js-sdk` in `LeahIntakeModal.tsx` with Athena Widget SDK
4. Keep the 16-milestone system and WebSocket broadcast logic — it's sound; just update the webhook event format from Retell's to Athena's
5. Test against a non-production Athena assistant before cutting over

**Decision:** Build entirely on Athena for Legal Concierge. Do not import Retell dependency. AdvisoryConnect retains Retell for its existing deployment; Legal Concierge is Athena-native from day one.

---

### 6.2 GHL Native Voice AI vs. Athena — When to Use Which

GHL has its own Voice AI Agents (`/voice-ai/agents`). It is less configurable than Athena but is tightly integrated with GHL CRM, workflows, and calendar.

| Scenario | Use Athena | Use GHL Voice AI |
|---|---|---|
| Complex multi-practice-area intake requiring KB and custom qualification logic | ✅ | ❌ Too limited |
| Simple appointment booking bot (no deep qualification) | Either | ✅ Lower engineering cost |
| Firm already 100% in GHL ecosystem with no Athena dependency | ✅ Still preferred | Consider |
| Outbound campaign follow-up after qualification | ✅ Athena Campaigns | Consider GHL workflow voice |
| White-label / custom branding requirement | ✅ Athena widget is customizable | ❌ GHL branding not removable |

**Decision:** Use Athena as the primary voice AI for all Legal Concierge deployments. GHL Voice AI can be a fallback or a simpler upsell product for firms that only need appointment booking.

---

### 6.3 Self-Hosted vs. Managed E-Signature

**Self-hosted PDF signing (the AdvisoryConnect "build it yourself" option):**
- Zero per-envelope cost
- Legal standing is challengeable in court — not advisable for legally binding retainers
- You own the audit trail — but must prove chain of custody
- No consumer brand recognition → lower completion rates
- Maintenance burden: browser updates, mobile signing, reminders

**Managed platforms (DocuSign, HelloSign, PandaDoc, SignNow):**
- ESIGN Act + UETA compliant out of the box
- Established case law — courts routinely accept
- Consumer trust → higher completion rates (documented 80-90% industry average)
- Platform handles audit trail, tamper-evidence, reminders
- Monthly cost is trivial vs. a single lost retainer

**Decision:** HelloSign (Dropbox Sign) as default — $15/month, solid API, legally recognized, sufficient consumer trust. DocuSign for firms that require maximum legal defensibility or have existing DocuSign contracts. No self-built PDF signing for production retainers.

---

### 6.4 React + Vite (Current) vs. Next.js — Should We Migrate?

| Consideration | React + Vite | Next.js |
|---|---|---|
| Current codebase | AdvisoryConnect is React + Vite | Would require migration |
| SEO (landing pages) | Client-side only — poor SEO without SSR | Built-in SSR/SSG — better for law firm marketing pages |
| Bundle size | Vite produces smaller bundles than CRA; Tailwind CDN is the real problem | Next.js adds some overhead but manageable |
| API routes | Separate Express server | Next.js API routes can unify frontend + some backend |
| Widget SDK embed | Not framework-dependent | Not framework-dependent |
| Complexity | Simpler for pure SPAs | Better for multi-page apps with marketing + dashboard |
| Deployment | Cloud Run (Docker) | Vercel (managed) or Cloud Run |

**Decision:** Do not migrate AdvisoryConnect to Next.js. For Legal Concierge, use **Next.js 15** for the admin portal and law firm marketing pages (SEO benefit, server actions, built-in API routes). Keep the intake modal as a standalone React component that can be embedded in any framework. The widget SDK does not depend on the framework.

**The actual Tailwind fix:** Stop loading Tailwind from CDN. Add `tailwindcss` as a dev dependency and configure PostCSS. This is a one-hour fix that eliminates the runtime bundle penalty regardless of framework.

---

### 6.5 WebSocket (Current) vs. Server-Sent Events vs. Polling

| Transport | Current Use (AdvisoryConnect) | Pros | Cons |
|---|---|---|---|
| WebSocket (ws) | Milestone broadcast from server.js | Bidirectional, low latency | Requires sticky sessions in multi-instance; `ws://` not TLS by default; breaks behind many proxies |
| Server-Sent Events (SSE) | Not used | Simple unidirectional server→client; works through HTTP/2; proxy-friendly; automatic reconnect | Browser-to-server events still need HTTP POST |
| Long polling | Not used | Works everywhere | Inefficient, higher latency, harder to scale |
| Redis pub-sub + SSE | Target | Decouples broadcast from specific server instance; Cloud Run can auto-scale; SSE is proxy-friendly | More infrastructure (Redis required) |

**Decision:** Replace WebSocket milestone broadcast with **Redis pub-sub + SSE**.
- Each call session has a Redis channel: `milestone:${call_id}`
- Athena webhook fires → writes to Redis channel
- Frontend subscribes to `GET /api/v1/sessions/:call_id/events` (SSE endpoint)
- Server holds SSE connection, reads from Redis channel, streams events
- Per-session isolation is clean: each SSE connection subscribes to its own Redis channel
- Scales horizontally: any Cloud Run instance can serve any SSE connection

The existing `useMilestoneSync.ts` hook is kept but rewritten to use `EventSource` instead of `WebSocket`.

---

### 6.6 Single Repo vs. Monorepo vs. Microservices

**Current AdvisoryConnect:** Single repo, frontend + backend in one `package.json` — works for a simple single-firm product.

**Legal Concierge scope:** Multi-firm platform with a web admin portal, widget SDK, mobile app, multiple backend services, and infrastructure.

**Options:**

| Structure | Pros | Cons | Fit |
|---|---|---|---|
| Single repo | Simple, low overhead | Difficult to deploy parts independently; dependency conflicts | Too small for this product |
| Monorepo (Turborepo/Nx) | Shared types, unified CI, independent deployability, code sharing | Some tooling complexity | ✅ Right fit |
| Full microservices | Maximum independent scalability | Operational complexity at this team size | Premature for current scale |

**Decision:** **Monorepo with Turborepo.**

```
legal-concierge/
├── apps/
│   ├── api/                   # Express backend — Cloud Run
│   ├── web/                   # Next.js admin portal + law firm pages
│   ├── mobile/                # React Native (Expo)
│   └── widget-sdk/            # Standalone <script> SDK
├── packages/
│   ├── shared-types/          # TypeScript interfaces shared across apps
│   ├── ghl-client/            # GHL API client (typed)
│   ├── athena-client/         # Athena API client (typed)
│   ├── esign-client/          # E-sign platform client (pluggable)
│   └── db/                    # Drizzle ORM schema + migrations
├── infrastructure/
│   ├── terraform/             # Cloud Run, Cloud SQL, Redis, Secret Manager
│   └── docker/                # Dockerfiles per app
├── turbo.json
└── package.json
```

Services inside `apps/api` start as a single Express app. They can be split to separate Cloud Run services if a specific service needs independent scaling (e.g., the webhook receiver under heavy load).

---

## 7. What Advances Past AdvisoryConnect

The table below is explicit about what Legal Concierge builds that does not exist in the current codebase.

### 7.1 Multi-Practice-Area Support

**AdvisoryConnect:** Hard-coded for personal injury, specifically car accidents. The entire question flow, milestone system, disqualification rules, and qualification scoring are PI-specific. There is no practice area detection, no routing logic, no way to serve family law, criminal defense, or corporate matters without rewriting the agent from scratch.

**Legal Concierge:** Practice area is a first-class data model. Each firm configures its active practice areas. The concierge detects the matter type in the opening turns and loads the appropriate question set from the firm's Knowledge Base. Qualification scoring, disqualification rules, retainer templates, and attorney routing are all practice-area-specific and configurable without code changes.

**What's built:** `firm_config.practice_areas[]`, KB documents per practice area, practice area detection in the Athena system prompt, `selectRetainerTemplate(firmId, practiceArea, ...)`, qualification scoring engine with per-area weights.

---

### 7.2 Full Retainer Generation and E-Signature

**AdvisoryConnect:** Zero retainer functionality. The `submit_lead` custom function is configured in Retell but there is no `/api/submit-lead` endpoint. No document generation, no e-sign platform, no delivery mechanism.

**Legal Concierge:**
- Firm uploads approved retainer templates to HelloSign/DocuSign/PandaDoc
- On qualification, template is selected (practice area × state × attorney)
- All fields auto-populated from `qualificationData` collected during the intake conversation
- Envelope created via e-sign platform API
- SMS + email sent to lead within 60 seconds of qualification
- Signature webhook updates GHL pipeline, writes immutable audit record, stores signed PDF in GCS
- Unsigned leads automatically enrolled in follow-up campaign (Athena outbound or GHL workflow)

---

### 7.3 Calendar Booking with Specific Attorneys

**AdvisoryConnect:** Zero booking functionality. The `TransferChoiceOverlay` offers "Call Me Later" which is a `console.log()` stub. No calendar integration exists.

**Legal Concierge:**
- GHL Calendar API: `GET /calendars/:id/free-slots` → 3 options presented to lead in modal
- Lead selects → `POST /calendars/events/appointments` → appointment created
- Confirmation SMS sent immediately
- GHL pipeline advances to "Appointment Booked"
- Appointment reminders via GHL workflow (SMS 24h + 1h before)
- Per-attorney calendar IDs stored in `firm_config` — routes to correct attorney
- Gmail/Google Calendar fallback if firm is not on GHL

---

### 7.4 Multi-Firm Tenancy

**AdvisoryConnect:** Single firm, hard-coded identifiers, single Retell agent pair, single GCS bucket path, single phone number, no admin portal, no configuration layer.

**Legal Concierge:**
- Tenant model: `firms`, `firm_config`, `attorneys`, `retainer_templates`
- Each firm has its own Athena assistant, Knowledge Base, GHL Location, pipeline, calendar IDs, e-sign templates
- Per-firm isolation at every layer: DB (firm_id FK on every table), API (tenant JWT), webhooks (firm_id query param), GHL (locationId per request), Redis (namespaced channels)
- Admin portal: onboard a new firm in under 4 hours without engineering involvement (Phase 5)
- Widget SDK: `data-firm-id` attribute selects the correct tenant configuration

---

### 7.5 GHL CRM Integration — Real, Not Mocked

**AdvisoryConnect:** The only "CRM integration" is a Retell Custom Function called `submit_lead` that fires a webhook. There is no webhook endpoint registered for it. The data goes nowhere. A qualified lead's data exists only in the browser's `qualificationData` state and in Retell's call logs. No database, no CRM, no email, no follow-up — the lead simply disappears.

**Legal Concierge:**
- `POST /contacts/` creates a GHL contact with full qualification data and custom fields immediately on qualification
- `POST /opportunities` creates a pipeline deal in the firm's intake pipeline
- SMS confirmation sent within 60 seconds
- Workflows enrolled: retainer follow-up, appointment reminders, attorney notification
- Every pipeline stage change (qualified → retainer sent → retainer signed → appointment booked) is driven by GHL API calls with immutable audit log entries
- GHL webhooks inbound to Legal Concierge keep the LC database in sync

---

### 7.6 Outbound Call Capability — Programmatic Campaigns

**AdvisoryConnect:** The outbound phone call capability (`/api/initiate-outbound-call` → Retell `v2/create-phone-call`) is manually triggered by the user clicking "Call My Phone" in the `TransferChoiceOverlay`. It is a single call to a single number. There is no campaign management, no scheduling, no retry logic, no lead list management.

**Legal Concierge:**
- Athena Campaigns API: `POST /api/v1/campaigns` with a list of leads and dynamic variables
- Campaigns are triggered programmatically on conditions: unsigned retainer at 4h/24h/72h, missed appointment, re-engagement at 30 days
- Lead deduplication: a lead already signed, DND, or in active conversation is excluded
- Campaign results (call connected, not answered, voicemail left) feed back via Athena webhooks and update the GHL pipeline and LC database
- TCPA-safe: campaigns respect configured calling hours and honor opt-outs

---

### 7.7 Mobile App

**AdvisoryConnect:** Web-only. No mobile app, no push notifications, no mobile-specific UI.

**Legal Concierge Phase 6:**
- React Native (Expo) app
- Embeds Athena widget for the full intake experience
- Push notifications: attorney is notified instantly when a new qualified lead arrives
- Lead receives push notification to sign unsigned retainer (alternative to SMS)
- Deep links: retainer SMS link opens app if installed
- Biometric auth for attorney/admin views
- White-label per firm (branded app name, colors, icon)

---

### 7.8 Verification Pipeline

**AdvisoryConnect:** No verification of any kind. Lead provides data; Leah accepts it at face value.

**Legal Concierge Phase 7:**
- Gated verification pipeline: 4 gates, each requiring minimum qualification threshold before API call fires
- Gate 1 (free, immediate): duplicate check, conflict check, SOL calculation
- Gate 2 (low cost): ID verification (Persona/Jumio), insurance verification (Verisk)
- Gate 3 (medium cost, post-qualification): police report pull (LexisNexis/CrashDocs) for applicable practice areas
- Gate 4 (post-retainer): medical records request (Ciox/Datavant)
- Connector marketplace: firm picks their preferred provider per verification type; pluggable architecture, no lock-in
- Per-lead cost cap: configurable maximum verification spend
- Quality score threshold per gate: e.g., "only pull police report on leads scoring ≥ 7"

---

### 7.9 Compliance Database

**AdvisoryConnect:** No compliance infrastructure. No conflict checks, no bar rule tracking, no audit log, no immutable records.

**Legal Concierge Phase 7:**
- Append-only `audit_log` table: every milestone event, qualification decision, pipeline change, retainer event, verification result — immutable write, no UPDATE/DELETE
- Conflict check database: all leads processed by the platform, deduplicated by client name + matter type
- Bar rule version tracking per state: which version of advertising rules was active when each intake ran
- Compliance certificate: generated per signed retainer, includes: conflict check result, bar rules version, disclosure timestamps, signer IP + device, document hash
- GDPR/CCPA flow: delete PII from lead record on request; audit log entry anonymized but not deleted (legal obligation survives PII deletion)

---

## Appendix A: Environment Variables Reference

```bash
# Athena Platform
ATHENA_BASE_URL=https://your-connexus-domain/api/v1
ATHENA_API_KEY=sk_live_...

# GoHighLevel
GHL_CLIENT_ID=...
GHL_CLIENT_SECRET=...
GHL_AGENCY_TOKEN=...         # Agency-level private token (for Location creation)

# Database
DATABASE_URL=postgresql://user:pass@host:5432/legal_concierge
REDIS_URL=redis://host:6379

# E-Signature (default: HelloSign)
HELLOSIGN_API_KEY=...
DOCUSIGN_ACCOUNT_ID=...      # if DocuSign used
DOCUSIGN_INTEGRATION_KEY=...

# Storage
GCS_BUCKET=legal-concierge-docs
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Webhook secrets (for signature verification)
ATHENA_WEBHOOK_SECRET=...
GHL_WEBHOOK_SECRET=...       # Ed25519 public key for X-GHL-Signature
HELLOSIGN_API_KEY=...        # used for webhook hash verification

# Application
NODE_ENV=production
PORT=8080
ALLOWED_ORIGINS=https://donovanlegalpllc.com,https://admin.legalconcierge.ai

# Secret Manager prefix (production)
SECRET_MANAGER_PROJECT=your-gcp-project-id
```

---

## Appendix B: Data Models — Core Tables

```sql
-- Tenants
CREATE TABLE firms (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  slug            VARCHAR(100) UNIQUE NOT NULL,
  ghl_location_id VARCHAR(100) UNIQUE,
  athena_org_id   VARCHAR(100),
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE firm_config (
  firm_id             UUID PRIMARY KEY REFERENCES firms(id) ON DELETE CASCADE,
  practice_areas      TEXT[] NOT NULL,
  active_states       TEXT[],
  concierge_name      VARCHAR(100) DEFAULT 'Your Legal Concierge',
  concierge_persona   VARCHAR(50)  DEFAULT 'professional',
  athena_assistant_id VARCHAR(100),
  athena_kb_id        VARCHAR(100),
  ghl_pipeline_id     VARCHAR(100),
  calendar_ids        JSONB DEFAULT '{}',
  esign_provider      VARCHAR(50)  DEFAULT 'hellosign',
  verification_config JSONB DEFAULT '{}',
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attorneys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID REFERENCES firms(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  ghl_user_id     VARCHAR(100),
  calendar_id     VARCHAR(100),
  practice_areas  TEXT[] NOT NULL DEFAULT '{}',
  active_states   TEXT[],
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Leads
CREATE TABLE intake_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID REFERENCES firms(id),
  athena_call_id  VARCHAR(255) UNIQUE,
  channel         VARCHAR(20) NOT NULL,   -- 'voice', 'chat', 'mobile'
  status          VARCHAR(50) DEFAULT 'active',
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ
);

CREATE TABLE leads (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id             UUID REFERENCES firms(id),
  session_id          UUID REFERENCES intake_sessions(id),
  attorney_id         UUID REFERENCES attorneys(id),
  -- Contact
  first_name          VARCHAR(255),
  last_name           VARCHAR(255),
  phone               VARCHAR(30),
  email               VARCHAR(255),
  sms_consent         BOOLEAN DEFAULT FALSE,
  -- Qualification
  practice_area       VARCHAR(100),
  qualification_data  JSONB DEFAULT '{}',  -- all extracted fields
  qualification_score SMALLINT,
  qualification_status VARCHAR(50) DEFAULT 'in_progress',  -- qualified, disqualified, escalated
  disqualify_reason   TEXT,
  -- GHL
  ghl_contact_id      VARCHAR(100),
  ghl_opportunity_id  VARCHAR(100),
  -- E-sign
  esign_envelope_id   VARCHAR(255),
  esign_status        VARCHAR(50) DEFAULT 'not_sent',  -- not_sent, sent, signed, expired
  retainer_signed_at  TIMESTAMPTZ,
  retainer_url        TEXT,
  -- Appointment
  appointment_id      VARCHAR(100),  -- GHL event ID
  appointment_time    TIMESTAMPTZ,
  -- Timestamps
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE retainer_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           UUID REFERENCES firms(id),
  practice_area     VARCHAR(100) NOT NULL,
  state_code        CHAR(2),
  attorney_id       UUID REFERENCES attorneys(id),
  esign_provider    VARCHAR(50) NOT NULL,
  esign_template_id VARCHAR(255) NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1,
  active            BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Audit (append-only — enforce via DB trigger or application constraint)
CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  event_type      VARCHAR(100) NOT NULL,
  lead_id         UUID,
  firm_id         UUID NOT NULL,
  session_id      UUID,
  actor           VARCHAR(255),         -- 'system', 'attorney_xxx', 'lead_xxx'
  event_data      JSONB NOT NULL,
  ip_address      INET,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
-- Enforce immutability: no UPDATE or DELETE permitted on this table
-- Implement as a DB rule or application-layer constraint + monitored alert
```

---

## Appendix C: API Quick Reference

| Integration | Base URL | Auth Header | Version Header |
|---|---|---|---|
| Athena | `https://[connexus-domain]/api/v1` | `X-API-Key: sk_live_...` | — |
| GoHighLevel | `https://services.leadconnectorhq.com/` | `Authorization: Bearer {token}` | `Version: 2021-07-28` |
| HelloSign | `https://api.hellosign.com/v3` | `Authorization: Basic {base64(key:)}` | — |
| DocuSign | `https://[account].docusign.net/restapi/v2.1` | `Authorization: Bearer {token}` | — |

---

*Document compiled April 7, 2026. All API endpoints and behavior derived from source files: RAGbrain_Legal_Intake_Module_Plan.md, advisoryconnect-analysis.md, and external-research.md.*
