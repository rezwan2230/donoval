# External Research Reference
**Compiled:** April 7, 2026  
**Sources:** AdvisoryConnect.net, ConnexUs AI Platform (Athena), GoHighLevel API V2

---

## Table of Contents
1. [AdvisoryConnect.net — UI/UX & Product Deep Dive](#1-advisoryconnectnet--uiux--product-deep-dive)
2. [ConnexUs (Athena) Platform API Reference](#2-connexus-athena-platform-api-reference)
3. [GoHighLevel API V2 Reference](#3-gohighlevel-api-v2-reference)

---

## 1. AdvisoryConnect.net — UI/UX & Product Deep Dive

**URL:** https://advisoryconnect.net/  
**Phone:** +1 (844) 239-5782 (24/7)  
**Tagline:** "Your Voice. Your Rights. Your Recovery."

### 1.1 Overview & Positioning

AdvisoryConnect is a **personal injury attorney intake funnel** built around an AI voice concierge named **Leah**. The site is purpose-built for **car accident victims** and connects them to a network of personal injury attorneys. Key social proof claims:
- $50M+ recovered
- Contingency-only pricing: "You don't pay unless we win"
- 24/7 availability via both AI voice and phone

The site is a **single-page marketing funnel** — there is no multi-page site structure visible. All content is delivered on the homepage.

---

### 1.2 Visual Design & Branding

| Element | Details |
|---|---|
| **Logo** | "AdvisoryConnect" — "Advisory" in dark navy bold serif, "Connect" in bold orange |
| **Primary colors** | Navy blue (#1a2a4a range) + Orange/red (#e63b1f range) |
| **Typography** | Clean modern sans-serif; heavy headline weights for impact |
| **Layout** | Two-column hero (text left, video right); clean white background sections below |
| **CTA buttons** | Solid orange pill buttons ("TALK TO LEAH NOW"), outlined phone button ("CALL 24/7") |
| **Trust badges** | Green checkmarks for "100% Free Consultation" and "Zero Out-of-Pocket Costs" |
| **Tone** | Urgent, authoritative, empathetic; directly addresses accident victims in distress |

---

### 1.3 Page Structure & Sections (Top to Bottom)

**Header**
- Logo (top left)
- "24/7 LEGAL HELPLINE" label + phone number prominently displayed (top right)
- No navigation menu — intentionally frictionless

**Hero Section**
- Category label: "CAR ACCIDENT VICTIMS" (small orange caps)
- H1: "Maximize Your Car Accident Settlement" (large, multi-line, in navy + orange split)
- Subheadline: "24/7 Free Consultation with Leah, Your Legal Concierge | You Don't Pay Unless We Win | $50M+ Recovered"
- Primary CTA: **"TALK TO LEAH NOW"** (orange fill button, left side)
- Secondary CTA: **"CALL 24/7: +1 (844) 239-5782"** (outlined button, right side)
- Micro-copy: "Instant Case Review • No Wait • 100% Free"
- Trust icons: "100% Free Consultation" + "Zero Out-of-Pocket Costs" with green checkmarks

**Video Widget (Embedded in Hero)**
- Video thumbnail shows "Matt" — identified as "MEET MATT • SENIOR ATTORNEY" (orange pill label)
- Title: "Watch Matt Explain Your Rights"
- Subtitle: "Personal Injury Law Explained in 60 Seconds"
- Tag: "You're not alone, we're here to help."
- Purpose: Humanizes the brand; establishes credibility before the AI intake begins

**Meet Leah Section**
- Headline: "Meet Leah, Your 24/7 Legal Concierge"
- Copy: "I analyze your case instantly and secure your legal options while you focus on recovery."
- Three feature cards:
  1. **Confidential Case Review** — "Your information is protected and strictly confidential."
  2. **Direct Access to Elite Counsel** — "Leah connects you directly with top-rated personal injury attorneys."
- CTA: "Instant AI Voice Consultation • No Wait"

**Practice Area Cards**
Three service blocks, each with bullet points:

| Practice Area | Focus Points |
|---|---|
| **Car Accident Claims** | Multi-vehicle collisions, Distracted driving cases, Uninsured motorist claims |
| **Truck & Commercial Accidents** | Commercial fleet recovery, Logbook falsification cases, Improper maintenance liability |
| **Motorcycle Injury Claims** | Rider bias mitigation, Severe injury valuation, Helmet & gear protection |

**FAQ Section**
- Headline: "Frequently Asked Questions"
- Subheadline: "Understanding your rights is the first step toward recovery. If you don't see your question here, Leah is available 24/7 to provide specific answers."
- Each FAQ ends with a contextual "Ask Leah" CTA

| FAQ Question | Answer Summary |
|---|---|
| How long to file a claim? | Statute of limitations: 1–4 years by state; act immediately to preserve evidence |
| What if I'm partially at fault? | Comparative negligence — recovery reduced by % fault; still eligible |
| How much does it cost? | 100% contingency fee basis; zero upfront; no fee if no win |
| What compensation can I recover? | Medical expenses, lost wages, pain & suffering, emotional distress, property damage |
| Will I have to go to court? | 90%+ settle before trial; attorneys prepare every case as if going to trial |

**Bottom CTA Strip**
- Urgent close: "Don't Wait. Your Case Has a Time Limit."
- "Leah is standing by to analyze your claim instantly. No risk. No obligation."
- "Prefer to talk? Call +1 (844) 239-5782 | Available 24/7/365"

---

### 1.4 The AI Concierge "Leah" — Experience & Presentation

Leah is the central product hook and differentiator of AdvisoryConnect.

**How Leah is Positioned:**
- "Your 24/7 Legal Concierge" — empathetic AI intake agent
- Described as conducting an "Instant AI Voice Consultation"
- Framing: Leah *analyzes* your case and *secures* legal options — active, expert language
- No wait, no cost, no obligation — removes every friction point from the call-to-action

**CTA Activation:**
- The primary button "TALK TO LEAH NOW" initiates the AI voice interaction
- This appears to be a click-to-call or embedded voice widget (chat icon visible in the button's left side)
- The button features a speech bubble icon suggesting voice or chat modality

**Leah's Role in the Funnel:**
1. User visits site (likely from PPC/legal lead gen traffic)
2. Video of "Matt" (human attorney) builds credibility
3. User clicks "Talk to Leah Now" — enters AI voice intake
4. Leah conducts the case review: injury type, circumstances, state, contact info
5. Qualified leads passed to attorney network

**Confidentiality Messaging:**
- Prominently stated: "Your information is protected and strictly confidential"
- Important for legal/HIPAA-adjacent trust

---

### 1.5 Intake Flow (User Perspective)

Based on the site structure and messaging, the inferred intake flow is:

```
Landing Page
    └─► "Talk to Leah Now" click
          └─► AI Voice / Chat Session Begins
                ├─ Leah introduces herself
                ├─ Collects: accident type, date, injuries, state
                ├─ Qualifies: fault assessment, insurance status
                ├─ Collects: name, phone, email
                └─ Outcome: 
                      ├─ Qualified → Transfer to attorney / schedule callback
                      └─ Unqualified → Polite close / redirect
```

The site emphasizes **no wait time** and **instant review**, suggesting the AI voice call is immediate upon button click (not a scheduled consultation).

---

### 1.6 Technical Observations

- Single-page architecture — no apparent subpages, subdomains, or nav links
- The phone number (+1 844-239-5782) is a trackable toll-free number
- The site is likely integrated with a CRM (GoHighLevel likely given the tech stack context) for lead capture
- No visible cookie consent, privacy policy link, or terms in the visible page content
- Copyright / legal footer not visible in current fetch

---

## 2. ConnexUs (Athena) Platform API Reference

**Portal:** https://portal.theconnexus.ai/docs/api-reference/  
**Branding:** "ConnexUs AI Docs" — "Build, test, and deploy intelligent voice and email AI agents"  
**Copyright:** © 2023-present Call Center AI Platform  
**License:** MIT License  
**Base URL:** `https://your-domain.com/api/v1`  
**Last Updated (visible docs):** December 9, 2025

> **Note on Documentation Access:** The ConnexUs docs use a client-side rendering framework (VitePress/similar). The top-level overview and guide pages return content via server-side rendering, but individual sub-section pages (e.g., `/docs/api-reference/assistants`) render as blank client-side routes when fetched programmatically. The structural information below is derived from the rendered overview, guide page, navigation menus, and the API reference index page content.

---

### 2.1 Platform Overview

ConnexUs is a **voice and email AI agent platform** — a white-labeled or multi-tenant SaaS for building, testing, and deploying conversational AI agents. Core capabilities:

| Feature | Description |
|---|---|
| **Voice Assistants** | Real-time voice AI with LiveKit integration, multiple TTS/STT providers |
| **Email Assistants** | Automated email handling via IMAP/SMTP integration |
| **Campaigns** | Outbound calling with lead management and scheduling |
| **Knowledge Base** | Document upload, training data, RAG (Retrieval-Augmented Generation) integration |
| **Widget SDK** | Embeddable chat/voice widgets for websites |
| **Multi-tenant** | Organization-based access with role management |

---

### 2.2 API Reference — Section Map

From the left navigation sidebar visible in the API reference:

```
API Reference
├── Overview
├── Authentication
├── Assistants
├── Campaigns
├── Calls
├── Knowledge Base
├── Phone Numbers
└── Webhooks
```

---

### 2.3 Authentication

**Method:** API Key authentication  
**Header:** `X-API-Key: $API_KEY`  
**Key format:** `sk_live_your_api_key_here` (prefix `sk_live_`)

```bash
# Export your API key
export API_KEY="sk_live_your_api_key_here"

# Example usage
curl -H "X-API-Key: $API_KEY" \
  https://your-domain.com/api/v1/campaigns
```

All API endpoints require authentication via API keys. No OAuth 2.0 flow documented in the publicly accessible reference.

---

### 2.4 API Endpoints

**Base URL:** `https://your-domain.com/api/v1`

#### Campaigns Endpoints
```
GET  /api/v1/campaigns          — List all campaigns
POST /api/v1/campaigns          — Create a campaign
GET  /api/v1/campaigns/:id      — Get campaign details
PUT  /api/v1/campaigns/:id      — Update a campaign
DELETE /api/v1/campaigns/:id    — Delete a campaign
```

#### Call History Endpoints
```
GET  /api/v1/call-history       — Get call logs and history
GET  /api/v1/call-history/:id   — Get specific call details
```

#### Assistants Endpoints
```
GET  /api/v1/assistants         — List assistants/agents
POST /api/v1/assistants         — Create an assistant
GET  /api/v1/assistants/:id     — Get assistant details
PUT  /api/v1/assistants/:id     — Update an assistant
DELETE /api/v1/assistants/:id   — Delete an assistant
```

#### Phone Numbers Endpoints
```
GET  /api/v1/phone-numbers      — List phone numbers
POST /api/v1/phone-numbers      — Provision a phone number
DELETE /api/v1/phone-numbers/:id — Release a phone number
```

#### Knowledge Base Endpoints
```
GET  /api/v1/knowledge-base           — List knowledge bases
POST /api/v1/knowledge-base           — Create a knowledge base
POST /api/v1/knowledge-base/:id/upload — Upload training documents
GET  /api/v1/knowledge-base/:id       — Get knowledge base details
DELETE /api/v1/knowledge-base/:id     — Delete a knowledge base
```

#### Webhooks Endpoints
```
GET  /api/v1/webhooks           — List configured webhooks
POST /api/v1/webhooks           — Register a webhook
PUT  /api/v1/webhooks/:id       — Update a webhook
DELETE /api/v1/webhooks/:id     — Delete a webhook
```

> **Note:** Exact endpoint paths for the sub-resources (Knowledge Base, Phone Numbers, Webhooks) are inferred from the platform guide structure. The API reference sub-pages are client-side rendered and not directly accessible via HTTP fetch. The Campaigns and Call History endpoints are explicitly shown in the Quick Start code samples.

---

### 2.5 Voice/Call Capabilities

The platform is built around real-time voice AI. From the guide documentation:

**Voice Assistant Components:**
- **LLM Configuration** — Choose and configure the underlying language model (multi-provider support)
- **Voice Transcriber** — Speech-to-text (STT); multiple provider options
- **Voice Synthesizer** — Text-to-speech (TTS); natural-sounding voice output, multiple providers
- **LiveKit Integration** — Real-time voice communication infrastructure
- **Call Transfer** — Ability to transfer calls from AI to human agents
- **Analytics** — Call performance metrics and transcription

**Outbound Calling (Campaigns):**
- Campaign-based outbound dialing
- Lead management and scheduling built-in
- Dialer Service (referenced in left nav: Overview, Lead Management, Dialer Service, Scheduling)

**Call Logging:**
- `/api/v1/call-history` endpoint for accessing call records
- Real-time call monitoring via dashboard

---

### 2.6 Agent Management

Agents ("Assistants") are the core configurable unit:

**Agent Lifecycle (Build → Test → Deploy):**

**Build Phase:**
- Agent Setup: Create and configure agent identity/persona
- LLM Configuration: Select and tune language model
- Voice Transcriber: Configure STT provider
- Voice Synthesizer: Configure TTS provider
- Tool Integration: Connect agent to external systems (webhooks, APIs)
- Analytics Setup: Configure performance tracking

**Test Phase:**
- Test agents directly in dashboard with real-time calls
- Use API to simulate call scenarios
- Monitor performance metrics

**Deploy Phase:**
- Phone Numbers API: Assign phone numbers to agents
- Campaigns API: Create outbound calling campaigns
- Calls API: Initiate/control calls programmatically
- Call History API: Access logs and analytics

---

### 2.7 Email Assistants

Separate module from Voice Assistants. From left nav structure:

```
Email Assistants
├── Overview
├── Email Connection (IMAP/SMTP)
└── Monitoring & Escalation
```

Handles automated email responses with human escalation pathways.

---

### 2.8 Knowledge Base & RAG

- Document upload for training data
- RAG (Retrieval-Augmented Generation) integration — agents can query knowledge bases during calls
- Supports multiple file types for document ingestion
- Knowledge bases can be assigned to specific assistants

---

### 2.9 Widget SDK

Embeddable components for website integration:
- **Widget Configuration:** Layout, position, margins
- **Theme Customization:** Colors, fonts, styling
- **Message Styling:** Message bubbles and appearance
- Supports both chat and voice modalities

---

### 2.10 API Conventions

**Response Format:** Standard JSON  
**Pagination:** Supported (cursor or page-based, exact parameters not publicly confirmed)  
**Filtering:** Supported on list endpoints  

**Error Codes:**

| Code | Meaning |
|---|---|
| 400 | Bad Request — invalid parameters |
| 401 | Unauthorized — invalid/missing API key |
| 404 | Not Found |
| 429 | Rate limit exceeded |
| 5xx | Server error |

**Rate Limiting:** Rate limiting is documented as a feature (section exists in API reference index: "Rate Limiting"), but specific limits are not publicly disclosed in the accessible documentation.

---

### 2.11 Webhooks

Webhooks are a documented feature (listed in both the API Reference nav and Guide nav). The platform supports:
- Incoming webhook events (e.g., call completed, lead status changed)
- Configurable webhook endpoints per assistant or campaign
- Webhook configuration in the Voice Assistants guide section

---

### 2.12 Multi-Tenant Architecture

- Organization-based access control
- Role management per organization
- The platform appears designed for **white-label deployment** (the base URL uses `your-domain.com` as placeholder)
- "Call Center AI Platform" branding at the footer suggests B2B SaaS positioning

---

## 3. GoHighLevel API V2 Reference

**Official Docs:** https://marketplace.gohighlevel.com/docs/  
**API Base URL:** `https://services.leadconnectorhq.com/`  
**GitHub Docs Repo:** https://github.com/GoHighLevel/highlevel-api-docs  
**Support Portal:** https://help.gohighlevel.com  

> **Important:** V1 APIs have reached **end-of-support**. Existing connections continue to work but no support is provided. All new integrations should use V2.

---

### 3.1 Authentication

**Two authentication methods:**

#### A. Private Integration Token (Recommended for internal/single-location use)
- Generated in GoHighLevel settings under Settings → Integrations → API Keys
- Used as Bearer token in Authorization header
- Scoped to a specific location (sub-account)
- Best for: Internal tools, single-account automations, testing

```bash
curl -X GET \
  https://services.leadconnectorhq.com/contacts/ \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -H "Version: 2021-07-28"
```

#### B. OAuth 2.0 (Required for Marketplace apps and multi-location access)
- Full Authorization Code flow
- Supports Location Level Access (sub-account) and Agency Level Access
- Requires creating an app at https://marketplace.gohighlevel.com
- Steps:
  1. Register app at marketplace, get Client ID + Client Secret
  2. Define required scopes
  3. User authorizes via OAuth redirect
  4. Exchange authorization code for access + refresh tokens
  5. Store tokens securely; refresh automatically before expiry

```
POST /oauth/token
{
  "client_id": "...",
  "client_secret": "...",
  "grant_type": "authorization_code",
  "code": "...",
  "redirect_uri": "..."
}
```

**Plan-based API access:**
| Plan | API Access Level |
|---|---|
| Starter & Unlimited | Basic API (Location API Keys only) |
| Agency Pro | Advanced API (OAuth 2.0 + Agency API Keys) |

---

### 3.2 API Rate Limits

For API V2 using OAuth:
- Rate limits enforced per token
- Standard practice: exponential backoff on 429 responses
- Recommended retry: 3 attempts, 500ms → 1000ms → 2000ms with ±20% jitter
- Exact numeric limits not published publicly (vary by plan/endpoint)

---

### 3.3 CRM — Contacts API

**Scope required:** `contacts.readonly` / `contacts.write`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/contacts/:contactId` | Get a contact |
| GET | `/contacts/` | List/search contacts (deprecated; use Search) |
| POST | `/contacts/` | Create a contact |
| PUT | `/contacts/:contactId` | Update a contact |
| DELETE | `/contacts/:contactId` | Delete a contact |
| GET | `/contacts/:contactId/tasks` | Get contact tasks |
| POST | `/contacts/:contactId/tasks` | Create a task |
| PUT | `/contacts/:contactId/tasks/:taskId` | Update a task |
| PUT | `/contacts/:contactId/tasks/:taskId/completed` | Mark task complete |
| DELETE | `/contacts/:contactId/tasks/:taskId` | Delete a task |
| POST | `/contacts/:contactId/tags` | Add tags |
| DELETE | `/contacts/:contactId/tags` | Remove tags |
| GET | `/contacts/:contactId/notes` | Get notes |
| POST | `/contacts/:contactId/notes` | Add a note |
| PUT | `/contacts/:contactId/notes/:id` | Update a note |
| DELETE | `/contacts/:contactId/notes/:id` | Delete a note |
| GET | `/contacts/:contactId/appointments` | Get appointments |
| POST | `/contacts/:contactId/campaigns/:campaignId` | Add to campaign |
| DELETE | `/contacts/:contactId/campaigns/:campaignId` | Remove from campaign |
| DELETE | `/contacts/:contactId/campaigns/removeAll` | Remove from all campaigns |
| POST | `/contacts/:contactId/workflow/:workflowId` | Add to workflow |
| DELETE | `/contacts/:contactId/workflow/:workflowId` | Remove from workflow |
| GET | `/contacts/business/:businessId` | Get contacts by business |

**Webhook events (contacts.readonly scope):**
- `ContactCreate`
- `ContactDelete`
- `ContactDndUpdate`
- `ContactTagUpdate`
- `NoteCreate`
- `NoteDelete`
- `TaskCreate`
- `TaskDelete`

---

### 3.4 Calendar & Appointments API

**Scopes required:** `calendars.readonly/write`, `calendars/events.readonly/write`, `calendars/groups.readonly/write`, `calendars/resources.readonly/write`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/calendars/` | List calendars |
| GET | `/calendars/:calendarId` | Get calendar |
| POST | `/calendars/` | Create calendar |
| PUT | `/calendars/:calendarId` | Update calendar |
| DELETE | `/calendars/:calendarId` | Delete calendar |
| GET | `/calendars/:calendarId/free-slots` | Get available slots |
| GET | `/calendars/events` | List events |
| GET | `/calendars/events/appointments/:eventId` | Get appointment |
| POST | `/calendars/events/appointments` | **Book an appointment** |
| PUT | `/calendars/events/appointments/:eventId` | Update appointment |
| DELETE | `/calendars/events/:eventId` | Delete event |
| GET | `/calendars/blocked-slots` | Get blocked time slots |
| POST | `/calendars/events/block-slots` | Create blocked slot |
| PUT | `/calendars/events/block-slots/:eventId` | Update blocked slot |
| GET | `/calendars/groups` | List calendar groups |
| POST | `/calendars/groups` | Create calendar group |
| DELETE | `/calendars/groups/:groupId` | Delete group |
| PUT | `/calendars/groups/:groupId` | Update group |
| PUT | `/calendars/groups/:groupId/status` | Update group status |
| GET | `/calendars/resources/:resourceType` | List resources |
| GET | `/calendars/schedules/search` | Get availability schedules |

**Required fields for booking an appointment:**
- `calendarId` (required)
- `locationId` (required)
- `contactId` (required)
- `startTime` (required, with timezone)

---

### 3.5 Opportunities & Pipeline API

**Scope required:** `opportunities.readonly` / `opportunities.write`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/opportunities/search` | Search/list opportunities |
| GET | `/opportunities/:id` | Get opportunity |
| POST | `/opportunities` | Create opportunity |
| PUT | `/opportunities/:id` | Update opportunity |
| DELETE | `/opportunities/:id` | Delete opportunity |
| PUT | `/opportunities/:id/status` | Update opportunity status |
| GET | `/opportunities/pipelines` | List pipelines |

**Webhook events (opportunities.readonly scope):**
- `OpportunityCreate`
- `OpportunityDelete`
- `OpportunityStageUpdate`
- `OpportunityStatusUpdate`
- `OpportunityMonetaryValueUpdate`

---

### 3.6 Conversations & Messaging API

**Scopes:** `conversations.readonly/write`, `conversations/message.readonly/write`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/conversations/search` | Search conversations |
| GET | `/conversations/:conversationsId` | Get conversation |
| POST | `/conversations/` | Create conversation |
| PUT | `/conversations/:conversationsId` | Update conversation |
| DELETE | `/conversations/:conversationsId` | Delete conversation |
| POST | `/conversations/messages` | **Send message (SMS/email)** |
| POST | `/conversations/messages/inbound` | Inject inbound message |
| POST | `/conversations/messages/upload` | Upload media/attachment |
| PUT | `/conversations/messages/:messageId/status` | Update message status |
| DELETE | `/conversations/messages/:messageId/schedule` | Cancel scheduled message |
| GET | `conversations/messages/:messageId/locations/:locationId/recording` | Get call recording |
| GET | `conversations/locations/:locationId/messages/:messageId/transcription` | Get transcription |

**Webhook events:**
- `InboundMessage`
- `OutboundMessage`
- `ConversationUnreadWebhook`
- `ConversationProviderOutboundMessage`

**Supported message channels (via conversations/messages):**
- SMS
- Email
- Voice/call
- Voicemail
- Facebook Messenger
- Instagram DM
- WhatsApp
- GMB (Google Business Messages)

---

### 3.7 Forms & Surveys API

**Scopes:** `forms.readonly` / `surveys.readonly`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/forms/` | List forms |
| GET | `/forms/submissions` | Get form submissions |
| POST | `/forms/upload-custom-files` | Upload files to form |
| GET | `/surveys/` | List surveys |
| GET | `/surveys/submissions` | Get survey submissions |

**Workflow Triggers (forms):**
- `Form Submitted` — fires when a selected form is submitted
- `Survey Submitted` — fires when a survey is submitted
- `Quiz Submitted` — fires when a quiz is submitted

---

### 3.8 Payments API

**Scopes:** `payments/orders.readonly/write`, `payments/transactions.readonly`, `payments/subscriptions.readonly`, `payments/coupons.readonly/write`, `invoices.readonly/write`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/payments/orders/` | List orders |
| GET | `/payments/orders/:orderId` | Get order |
| GET | `/payments/transactions/` | List transactions |
| GET | `/payments/subscriptions/` | List subscriptions |
| GET | `/payments/coupon/list` | List coupons |
| POST | `/payments/coupon` | Create coupon |
| GET | `/invoices/` | List invoices |
| POST | `/invoices` | Create invoice |
| POST | `/invoices/:invoiceId/send` | Send invoice |
| POST | `/invoices/text2pay` | Send text-to-pay link |

---

### 3.9 Workflows & Automation API

**Scope:** `workflows.readonly`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/workflows/` | List workflows |

Workflows are primarily managed in the GHL UI. The API allows reading workflow lists and adding/removing contacts from workflows via the Contacts API (`POST /contacts/:contactId/workflow/:workflowId`).

---

### 3.10 Voice AI Agents API (GHL Native)

GHL has a built-in Voice AI module. **Scope:** `voice-ai-agents.readonly/write`, `voice-ai-dashboard.readonly`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/voice-ai/agents` | List voice AI agents |
| GET | `/voice-ai/agents/:agentId` | Get agent details |
| POST | `/voice-ai/agents` | Create a voice AI agent |
| PATCH | `/voice-ai/agents/:agentId` | Update agent |
| DELETE | `/voice-ai/agents/:agentId` | Delete agent |
| GET | `/voice-ai/actions/:actionId` | Get agent action/goal |
| POST | `/voice-ai/actions` | Create agent action |
| PUT | `/voice-ai/actions/:actionId` | Update action |
| DELETE | `/voice-ai/actions/:actionId/agent/:agentId` | Remove action from agent |
| GET | `/voice-ai/dashboard/call-logs` | Get voice AI call logs |
| GET | `/voice-ai/dashboard/call-logs/:callId` | Get specific call log |

**Webhook event:** `VoiceAiCallEnd`

---

### 3.11 Locations (Sub-Accounts) API

**Scope:** `locations.readonly` / `locations.write` (Agency-level for write)

| Method | Endpoint | Description |
|---|---|---|
| GET | `/locations/:locationId` | Get location details |
| GET | `/locations/search` | Search locations |
| POST | `/locations/` | Create location (Agency only) |
| PUT | `/locations/:locationId` | Update location (Agency only) |
| DELETE | `/locations/:locationId` | Delete location (Agency only) |
| GET | `/locations/:locationId/customValues` | Get custom values |
| GET | `/locations/:locationId/customFields` | Get custom fields |
| POST | `/locations/:locationId/customFields` | Create custom field |
| GET | `/locations/:locationId/tags` | Get tags |
| POST | `/locations/:locationId/tags/` | Create tag |
| GET | `/locations/:locationId/templates` | Get email/SMS templates |

**Webhook events:** `LocationCreate`, `LocationUpdate`

---

### 3.12 Additional API Modules

| Module | Key Endpoints | Notes |
|---|---|---|
| **Businesses** | `GET/POST/PUT/DELETE /businesses` | B2B entity management |
| **Products** | `GET/POST/PUT/DELETE /products/` | E-commerce product catalog |
| **Funnels** | `GET /funnels/funnel/list`, `GET /funnels/page` | Funnel/page management |
| **Social Planner** | `/social-media-posting/:locationId/posts` | Social media scheduling |
| **Blogs** | `POST/PUT /blogs/posts` | Blog post management |
| **Media** | `GET /medias/files`, `POST /medias/upload-file` | File/media library |
| **Users** | `GET/POST/PUT/DELETE /users/` | User management |
| **Links (Trigger)** | `GET/POST/PUT/DELETE /links/` | Trigger link management |
| **Snapshots** | `GET /snapshots` | Account snapshot management |
| **Associations** | `/associations/` | Custom relationship management |
| **Documents & Contracts** | `GET /proposals/document`, `POST /proposals/document/send` | Document workflows |
| **Phone Numbers** | `GET /phone-system/numbers/location/:locationId` | Phone number management |
| **Emails (Builder)** | `GET/POST /emails/builder` | Email template builder |
| **Email Schedule** | `GET /emails/schedule` | Scheduled email management |

---

### 3.13 Webhooks System

**Documentation:** https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/  
**Setup:** Configured in OAuth app settings in the GHL Marketplace

**Signature Verification:**

| Header | Algorithm | Status |
|---|---|---|
| `X-WH-Signature` | RSA-SHA256 | Legacy — **deprecated July 1, 2026** |
| `X-GHL-Signature` | Ed25519 | Current — prefer this |

**Retry System:**
- Retries only on HTTP 429 (rate limited)
- 6 retry attempts, ~10 minutes apart with jitter
- Total retry window: ~70 minutes
- No retry on 5xx errors (considered permanent failures)

**Event Categories:**

| Category | Events |
|---|---|
| **Contact** | ContactCreate, ContactDelete, ContactDndUpdate, ContactTagUpdate, NoteCreate, NoteDelete, TaskCreate, TaskDelete |
| **Opportunity** | OpportunityCreate, OpportunityDelete, OpportunityStageUpdate, OpportunityStatusUpdate, OpportunityMonetaryValueUpdate |
| **Conversations** | InboundMessage, OutboundMessage, ConversationUnreadWebhook, ConversationProviderOutboundMessage |
| **Appointments** | AppointmentCreate, AppointmentUpdate (via AppointmentStatus workflow trigger) |
| **Invoice** | Invoice lifecycle events |
| **Campaigns** | CampaignStatusUpdate |
| **Location** | LocationCreate, LocationUpdate |
| **Association** | AssociationCreate, AssociationUpdate, AssociationDelete, RelationCreate, RelationDelete |
| **Voice AI** | VoiceAiCallEnd |

---

### 3.14 Workflow Triggers (for Automation Reference)

GoHighLevel's Workflow Builder supports these trigger categories:

**Contact Triggers:**
- Birthday Reminder, Contact Changed, Contact Created, Contact DND, Contact Tag, Custom Date Reminder, Note Added, Note Changed, Task Added, Task Reminder, Task Completed, Contact Engagement Score

**Event Triggers:**
- Inbound Webhook, Scheduler, Call Details, Email Events (delivered/opened/clicked/bounced/spam/unsub), Customer Replied, Conversation AI Trigger, Custom Trigger, Form Submitted, Survey Submitted, Trigger Link Clicked, Facebook Lead Form, TikTok Form, LinkedIn Lead Form, Video Tracking, Number Validation, Messaging Error SMS, Funnel/Website PageView, Quiz Submitted, New Review Received, Prospect Generated, Click To WhatsApp Ads, External Tracking Event

**Appointment Triggers:**
- Appointment Status, Customer Booked Appointment, Service Booking, Rental Booking

**Opportunity Triggers:**
- Opportunity status, stage, and value changes

**Payment Triggers:**
- Invoice, Payment Received, Order Form Submission, Order Submitted, Documents & Contracts, Estimates, Subscription, Refund, Coupon Applied

**Course Triggers:**
- Category/Lesson Started/Completed, New Signup, Offer/Product Access Granted/Removed

**Affiliate Triggers:**
- Affiliate Created, New Affiliate Sales, Affiliate Enrolled, Lead Created

**Also available:** Facebook/Instagram Events, Communities, Certificates, Ecommerce, IVR, Google Ads

---

### 3.15 Workflow Actions (for Automation Reference)

| Category | Actions |
|---|---|
| **Communications** | Send Email, Send SMS, Call, Voicemail, Messenger, Instagram DM, Manual SMS, Manual Call, GMB Messaging, WhatsApp |
| **Contact Management** | Add/Remove Contact Tag, Update Contact Field, Assign/Remove User, Set Contact DND |
| **CRM** | Create/Update Opportunity, Remove Opportunity, Add to Notes, Add Task |
| **Workflows** | Add To Workflow, Remove From Workflow, Remove From All Workflows, Go To |
| **Logic** | If/Else, Wait, Math Operation |
| **Integrations** | Webhook, Add to Google Analytics, Add to Google Adwords, Facebook Custom Audience (Add/Remove/Conversion API) |
| **Payments** | Stripe One Time Charge |
| **Appointments** | Update Appointment Status, Set Event Start Date |
| **Membership** | Membership Grant Offer, Membership Revoke Offer |
| **Notifications** | Send Internal Notification, Send Review Request |
| **AI** | Eliza AI Appointment Booking Bot, Conversation AI |

---

### 3.16 OAuth Scopes Summary

The following scope groups control API access:

| Scope Group | Access Level |
|---|---|
| `contacts.readonly/write` | Contact CRUD, tasks, notes, tags, campaigns |
| `calendars.readonly/write` | Calendar management |
| `calendars/events.readonly/write` | Appointment booking |
| `conversations.readonly/write` | Conversation management |
| `conversations/message.readonly/write` | SMS/email/call messaging |
| `opportunities.readonly/write` | Pipeline and deal management |
| `forms.readonly` | Form listings and submissions |
| `surveys.readonly` | Survey listings and submissions |
| `workflows.readonly` | Workflow listing |
| `locations.readonly/write` | Sub-account management |
| `payments/orders/transactions/subscriptions.readonly` | Payment data |
| `invoices.readonly/write` | Invoice management |
| `voice-ai-agents.readonly/write` | Voice AI agent management |
| `voice-ai-dashboard.readonly` | Voice AI call logs |
| `users.readonly/write` | User management |
| `businesses.readonly/write` | Business entity management |
| `products.readonly/write` | Product catalog |
| `socialplanner/post.readonly/write` | Social media posting |
| `snapshots.readonly` | Snapshot management (Agency) |
| `oauth.readonly/write` | OAuth app management (Agency) |
| `campaigns.readonly` | Campaign read access |
| `phonenumbers.read` | Phone number listing |
| `associations.readonly/write` | Custom associations |
| `documents_contracts/list.readonly` | Document listing |
| `documents_contracts/sendlink.write` | Send documents |
| `blogs/post.write` | Blog post creation |
| `emails/builder.readonly/write` | Email template builder |

---

### 3.17 Key Integration Patterns

**Lead Intake + CRM:**
1. External form/landing page captures lead
2. `POST /contacts/` to create GHL contact
3. `POST /contacts/:id/workflow/:workflowId` to enroll in nurture sequence
4. Webhook fires `ContactCreate` to external systems

**AI Voice + Appointment Booking:**
1. Voice AI (ConnexUs/Athena or GHL native Voice AI) qualifies lead
2. `GET /calendars/:calendarId/free-slots` to find availability
3. `POST /calendars/events/appointments` to book appointment
4. `PUT /contacts/:contactId` to update CRM with outcome
5. `VoiceAiCallEnd` webhook fires with call metadata

**Pipeline Advancement:**
1. `POST /opportunities` to create deal
2. Webhook `OpportunityCreate` fires for downstream systems
3. `PUT /opportunities/:id` to update stage, value, status
4. Workflow triggers fire on `OpportunityStageUpdate`

---

## Appendix: Source URLs

| Source | URL |
|---|---|
| AdvisoryConnect Homepage | https://advisoryconnect.net/ |
| ConnexUs API Reference | https://portal.theconnexus.ai/docs/api-reference/ |
| ConnexUs Platform Guide | https://portal.theconnexus.ai/docs/guide/ |
| GHL Developer Portal | https://marketplace.gohighlevel.com/docs/ |
| GHL API Scopes Reference | https://marketplace.gohighlevel.com/docs/Authorization/Scopes |
| GHL Webhook Integration Guide | https://marketplace.gohighlevel.com/docs/webhook/WebhookIntegrationGuide/ |
| GHL Support Portal | https://help.gohighlevel.com |
| GHL GitHub API Docs | https://github.com/GoHighLevel/highlevel-api-docs |
| GHL Workflow Triggers List | https://help.gohighlevel.com/support/solutions/articles/155000002292-a-list-of-workflow-triggers |
