# Legal Concierge Platform — Strategy & Architecture Document v2.1

**Author:** ConnexUS AI / Tico AI / Scale Agile Solutions  
**CEO:** David Pierce (Scale Agile Solutions)  
**First Client:** Donovan Legal PLLC  
**Document Version:** 2.1 (revised post-kickoff meeting)  
**Date:** April 7, 2026 · *Revised May 13, 2026*  
**Classification:** Internal Engineering — Confidential  

---

## v2.1 REVISION ADDENDUM — May 13, 2026 (Donovan Kickoff Meeting Outcomes)

This addendum supersedes any conflicting content in the body of the document below. The body is preserved for architectural reference; the decisions captured here represent the **as-of-May-13-2026 ground truth** for the Donovan Legal PLLC implementation.

### A. Project Entity Structure (Compliance-Driven)

To comply with Florida Bar Rule 4-7 attorney advertising rules and referral-agency registration requirements, the engagement is structured with deliberate entity separation:

| Function | Entity | Reason |
|---|---|---|
| Tech platform & agent | ConnexUS AI | Platform of record for SDK and infrastructure |
| Lead generation / project ownership | **Tico AI** | Ad agency of record — NOT in Paul's name |
| Law firm | Donovan Legal PLLC | Owner of donovan.law and all client relationships |

Google Ads account: registered to Tico AI. All paid traffic lands on **donovan.law** (Paul's owned URL, his owned funnel) — Tico AI drives traffic TO the site, not directly to v-reps. Paul will forward the FL Bar advertising rules and referral-agency registration requirements; we register Tico AI as a referral agency if required.

### B. Donovan Site Status: Enhance, Don't Rebuild

Paul shipped his own rebuild of donovan.law before the kickoff meeting. The four-pillar practice structure (**Tax Planning / Tax Compliance / Tax Controversy / Real Estate**), the **Gold/Platinum/Reserve** engagement tiers, the **Donovan-Structured. Donovan-Defended.** callout, the lifecycle SVG wheel, the full bio, and seven tax tools are all live. **Our scope is now enhancement, not redesign.**

Gaps we are filling:

1. AI voice concierge + intake funnel (ConnexUS SDK from advisoryconnect.net, adapted)
2. Calendar booking via GoHighLevel
3. GHL CRM behind the intake
4. Florida Bar advertising compliance layer (disclaimers, TCPA consent, attorney-advertisement language)
5. Build out `/gold/`, `/platinum/`, `/reserve/` (currently blank)
6. Footer rebuild + analytics + conversion tracking
7. Fix three future-dated blog posts

### C. Two-Funnel Intake Model (Confirmed)

Two distinct intake funnels share one site. Visitor self-selects on entry.

**Funnel 1 — Tax Planning (HNW Real Estate)**
- Profile: $1M+ income (ideal $2–5M), $10M+ net worth
- Hooks: short-term rental (Airbnb) strategy, W-2 earners in NY/CA/MA seeking real estate tax shelter, cross-border FIRPTA inbound capital
- Decision points (4-step modal, adapted from advisoryconnect.net's ACCIDENT→DAMAGE→LEGAL→CONNECT pattern):
  1. **PROFILE** — income range, net worth range, real estate status
  2. **GOAL** — short-term rental? developer? passive investor? international?
  3. **TIMING** — current tax year vs next vs immediate transaction
  4. **CONNECT** — book a 30-minute consultation

**Funnel 2 — Tax Controversy (IRS / State Tax Problems)**
- Profile: $250K+ owed in income, sales, or employment tax
- Hook is stronger — problem-aware buyers convert faster
- Lifecycle phase: pre-controversy / controversy / post-controversy
- Decision points:
  1. **ISSUE** — audit / levy / lien / unfiled / criminal exposure
  2. **AMOUNT** — $0–50K / $50K–250K / $250K–1M / $1M+
  3. **URGENCY** — notice received? collection started? court date scheduled?
  4. **CONNECT** — book a 30-minute consultation

**Cross-funnel insight (Paul's observation):** Controversy clients frequently become Planning clients post-resolution. Planning clients regularly disclose unfiled returns mid-engagement and become Controversy clients. The two funnels feed each other — the unified GHL CRM must support transitioning a contact between funnels.

### D. Disqualifiers (Confirmed in Meeting)

| Disqualifier | Treatment |
|---|---|
| H-1B visa holder | Hard decline — too unstable, unpredictable U.S. tenure |
| Undocumented status | Hard decline |
| Below thresholds with no controversy matter | Polite handoff with self-serve resources |
| Behavioral red flags (grandiose claims, instability) | Soft screen — escalate to human review |

**NOT disqualifiers** (Paul flagged these as actually attractive):
- International / foreign nationals → FIRPTA & cross-border = high-value engagements
- Multiple-passport holders, green card holders
- Tourist-visa investors parking capital in U.S. real estate

Paul to deliver a complete disqualifier list to Veronica before the next meeting.

### E. Tier Routing Logic (V-Rep Behavior)

The agent acts as 24/7 receptionist + intake + screener. Routing decisions:

```
INBOUND CALL or VISITOR
        │
        ▼
 Concierge greets, asks: existing client or new?
        │
        ├── EXISTING CLIENT
        │      │
        │      ├── Self-identifies as RESERVE (members 001–100)
        │      │      → Direct transfer to Paul's mobile, 24/7
        │      │
        │      └── Gold / Platinum
        │             → Route to Wendy for calendar coordination
        │
        └── NEW PROSPECT
               │
               ├── Tax Planning funnel ────┐
               │                            ├── Qualify → 30-min book on Paul's calendar (GHL)
               └── Tax Controversy funnel ─┘
                                            │
                                            └── Unqualified → polite decline + automated follow-up resource
```

Reserve = 100 members hand-selected, numbered 001–100, physical black card, monthly meetings, on-site visits, etc. (Per Paul: "There'll be a 007. There'll be an Agent 69. There'll be an Agent 99.")

### F. Technology Stack (Confirmed)

| Layer | Decision | Status |
|---|---|---|
| CRM | **GoHighLevel (GHL)** — natively integrated with ConnexUS AI | Decided |
| Voice agent SDK | **ConnexUS AI** (`portal.theconnexus.ai/ai-agent-sdk.js`) | Proven on advisoryconnect.net |
| Calendar | **Embedded in GHL** | Replaces missing scheduling widget |
| Business phone | **New line with SMS** (provisioned by Elroy) | To replace RingCentral for voice/SMS |
| Fax | Paul keeps **RingCentral fax** | IRS / state authorities still require fax |
| E-signature | Paul's existing **DocuSign + Adobe Sign** via API | For engagement letter automation |
| Practice management | **Currently Lawbility** — David evaluating Clio API quality | TBD |
| Compliance | **SOC 2 + PII isolated environment**, encryption keys held by client | Required |
| Call recording | **On during POC, off post-validation** | To protect attorney-client privilege |

### G. KPIs & Targets (Confirmed)

| Metric | Phase 1 Target | Note |
|---|---|---|
| Bookings / month | 20 | 30-min slots; solo-attorney calendar capacity |
| Close rate | 20% | Yields ~48 new clients/year at the booking target |
| Year-1 new clients | 100 | Paul's stretch goal |
| Launch channel | Google Ads only | Establish baseline before adding channels |
| Veronica's role | Define Google campaign structure for each funnel; develop social creative for HNW big-fish hooks (post-baseline) | |

### H. Timeline (Confirmed)

| Milestone | Target | Owner |
|---|---|---|
| Documents distributed | May 13, 2026 | David |
| Document feedback returned | Within 1 week | Whole team |
| Next full team meeting | May 20, 2026 | David schedules |
| Proof-of-concept agent demo | ~May 27, 2026 | Elroy |
| Production deployment to donovan.law | ~June 3, 2026 | Elroy |
| Cadence beyond launch | Every 2 weeks | Standing |

### I. Deferred Decisions (Tabled to Next Meeting)

- Public vs gated pricing on the engagement tier pages (Paul thinking)
- Whether to fund `/gold/`, `/platinum/`, `/reserve/` build-out in Phase 1 or Phase 2
- Whether to retool advisoryconnect.net as a parallel landing platform for Donovan
- Final practice-management decision (Clio vs Lawbility vs alternative)
- Whether call recording defaults OFF immediately or stays ON through POC only

### J. Phase-2 Automation Roadmap (Paul's Vision)

Paul's eventual end-state: visitor lands on donovan.law, picks services from a menu (a-la-carte fixed fees + bundled tiers), system auto-generates the engagement letter, DocuSign/Adobe Sign sends it for signature, retainer collected post-signature. "Just like ordering off a menu in a restaurant. Boom. Boom. Boom." — Paul Donovan.

This is **Phase 2** scope. Phase 1 stays focused on: book a qualified 30-minute consultation. Retainer is collected *after* the consultation, not before.

---


---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Market Opportunity](#2-market-opportunity)
3. [Platform Architecture](#3-platform-architecture)
4. [Intake Flows by Practice Area](#4-intake-flows-by-practice-area)
5. [CON-989 as Universal Framework](#5-con-989-as-universal-framework)
6. [Donovan Law Implementation](#6-donovan-law-implementation)
7. [Competitive Advantage](#7-competitive-advantage)
8. [Development Phases](#8-development-phases)
9. [Technical Architecture](#9-technical-architecture)
10. [Data Model](#10-data-model)
11. [Pricing Strategy](#11-pricing-strategy)

---

## 1. Executive Summary

### The Product

Legal Concierge is a multi-tenant AI intake platform that deploys to thousands of law firms via a single embeddable script tag. When a potential client lands on any law firm website, they encounter a floating widget — mobile bottom sheet on phones, expanding panel on desktop — that connects them to a voice AI concierge, conducts a structured intake conversation, qualifies their case against the firm's real criteria, books a consultation with the right attorney, and dispatches a pre-populated retainer for e-signature — all without any human involvement and regardless of what time it is. The platform serves any law firm in any practice area from a single codebase: each firm is a tenant, each practice area is a configurable JSON template, and each deployment requires only one script tag added to an existing website.

### Why It Wins

**The after-hours problem:** 40–42% of legal inquiries arrive outside business hours (PILMMA cites 67% for PI). During business hours, 40% of law firms still do not answer their phones (Clio 2024 Legal Trends Report). 80% of callers who reach voicemail hang up without leaving a message. Every one of those is a lost lead that cost $649 to generate (LEX Reception data). Legal Concierge answers every single one, 24/7, with a consistent, intelligent intake experience.

**Speed-to-lead:** Responding within 5 minutes makes a firm 21x more likely to qualify a lead vs. a 30-minute response (InsideSales.com/MIT Study). 78% of legal clients hire the first firm to respond. Current average law firm response time is 8+ hours by phone, 24+ hours by web form (AgentZap 2026). Legal Concierge responds in under 5 seconds.

**Cost:** A full-time intake receptionist costs ~$52,000/year with benefits. Legal answering services run $330–$1,950/month with per-minute/per-call billing that spikes unpredictably. Legal Concierge delivers unlimited, 24/7, intelligent intake for a flat monthly rate — 87–93% savings over equivalent human coverage.

**Full lifecycle:** Competitors stop at lead capture. Legal Concierge goes: questions → qualification → retainer e-signature → calendar booking with the specific attorney. A signed retainer within 60 seconds of qualification completion is the product's defining capability.

### Total Addressable Market

| Segment | Market Size | CAGR |
|---------|-------------|------|
| Legal Practice Management Software (global) | $3.0B (2026) → $4.66B by 2030 | 11.6–11.9% |
| Legal AI Software (global) | ~$1.4B (2025), +$2.92B by 2029 | **32.4%** |
| U.S. law firms (total) | ~450,000 licensed attorneys across ~175,000 firms | — |
| Firms spending on answering services | $300M–$2B estimated annual spend | — |
| Average firm monthly intake tech spend | $500–$2,000 (small firm); $2,000–$6,000 (mid) | — |

Sources: The Business Research Company, Technavio, Clio 2024 Legal Trends Report.

At a $299/month average SaaS price, capturing 1% of U.S. small-to-mid law firms (1,750 firms) = **$6.3M ARR**. The legal AI software segment is growing at 32.4% CAGR — nearly 3x the overall legal software market rate.

### Competitive Positioning Summary

| Competitor | What They Do | What They Don't Do |
|-----------|--------------|-------------------|
| Smith.ai | Hybrid AI+human answering | No embeddable widget; no retainer; no booking inside intake; $292–$2,025/mo |
| Clio Grow | Forms + booking + CRM | No voice; no AI conversation; no retainer dispatch; per-user pricing |
| Lawmatics | CRM + automation | No voice; no AI intake conversation; $149–$1,149/mo |
| Intaker | Legal chatbot | Text only; no voice; no retainer; limited depth |
| LawDroid | Document automation | Not intake-focused; no voice |
| Ruby/LEX/Answering Legal | Human answering services | Human-dependent; per-minute billing; no retainer; no booking |

**Legal Concierge** is the only platform that combines: embeddable anywhere + voice AI + real-time transcript + practice-area-specific intake intelligence + retainer e-signature + calendar booking + full CRM integration in a single product.

---

## 2. Market Opportunity

### 2.1 The After-Hours Problem

The data is unambiguous. Law firms are structurally losing a significant fraction of the leads they pay for:

| Source | Finding |
|--------|---------|
| Above the Bar Marketing (2026) | 42% of legal service searches occur outside traditional business hours |
| Ferdinand Agent (2025) | 40% of legal leads happen after hours |
| PILMMA (2026) | 67% of legal leads call outside business hours (PI-heavy sample) |
| Market My Market (2022) | From 30,000 calls: 14.97% are after-hours weekday calls; 2.57% weekend |
| LegalNavigator (2025) | 35% of calls to law firms go unanswered during business hours |
| Clio 2024 | 40% of firms answer calls during business hours (down from 56% in 2019) |

After-hours distribution by practice area is significant: personal injury spikes evenings and weekends (accidents happen anytime); criminal defense clusters late nights following arrests (DUI arrests are predominantly Thursday–Sunday, 10pm–3am); family law peaks Sunday evenings (weekend reflection). These are the highest-urgency, highest-value intake moments — and the moments when nearly every firm is dark.

The cascade effect: an accident happens at 9pm on Saturday. The victim Googles "car accident lawyer." They click three or four results. The first firm to respond gets the client. 78% of legal clients hire the first firm to respond to their inquiry (Legal Navigator, multiple sources). Voicemail and 8-hour callback times are fatal.

### 2.2 Speed-to-Lead — The Conversion Math

| Response Window | Conversion Multiplier | Source |
|-----------------|----------------------|--------|
| < 1 minute | 391% higher conversion vs. 2-minute response | Velocify |
| < 5 minutes | 21x more likely to qualify vs. 30-minute response | InsideSales.com/MIT Study |
| < 5 minutes | 400% higher conversion vs. 1+ hour response | ALM Global |
| 1 hour | 7x more likely to qualify vs. waiting longer | Dripify |
| Immediate | 78% of legal clients hire the first firm to respond | Legal Navigator |
| Next day callback | 80% of prospects have moved on after 48 hours | Andava Digital (2025) |

Only **28% of firms** achieve a sub-5-minute response (AffiniPay 2025). Legal Concierge responds in under 5 seconds, 24/7.

The nationwide average intake → retained client conversion rate is only **7%** (range 3–30%) for firms without optimized intake systems. AI intake systems deliver 35–50% better conversion (Above the Bar Marketing). That gap represents the platform's core value proposition.

### 2.3 Current Solutions and Their Limitations

**Human answering services** — the dominant current solution — have two fundamental problems: (1) per-minute/per-call billing that punishes engagement depth; and (2) humans who can only answer questions, not qualify leads, dispatch retainers, or book calendars.

| Service | Model | Entry Price | Top Tier | Key Limitation |
|---------|-------|-------------|----------|---------------|
| Ruby Receptionists | Per-minute, human | $245/50 min | $1,695/500 min | Most expensive/minute; no AI; no retainer or booking |
| LEX Reception | Per-minute, human | $425/150 min | $775/500 min | Legal-specialized but still message-taking |
| Smith.ai (human) | Per-call | $292.50/30 calls | $2,025/300 calls | Hybrid AI+human; no retainer; no booking inside intake |
| Answering Legal | Per-minute | $330/100 min | $737/250 min | High customization but still per-minute billing |
| Smith.ai AI Voice | Per-call | $97.50/30 calls | $825/300 calls | 60–80% cheaper but lower intelligence for complex intake |

At scale, these services are deeply unpredictable. A firm with 150 monthly after-hours contacts at 8–12 minutes average call length hits $1,800–$3,000/month in overages on mid-tier plans. Legal Concierge runs flat-rate unlimited.

**CRM/intake platforms** (Clio Grow, Lawmatics, Filevine) solve the data organization problem but not the response problem. They wait for a human to pick up the phone or a visitor to fill out a form. They do not initiate, conduct, or complete an intake conversation.

**Chatbots** (Intaker, LawDroid) engage website visitors via text but lack voice capability, real-time transcript display, and the intelligence to handle nuanced legal qualification conversations. 72% of legal consumers are comfortable with AI for initial intake — but only when it "feels like a conversation, not a disguised form" (Clio 2024 survey).

### 2.4 What Firms Already Pay

Total monthly intake technology spend by firm size:

| Firm Type | Typical Monthly Intake Spend |
|-----------|------------------------------|
| Solo practitioner | $100–$500/mo |
| Small firm (2–5 attorneys) | $500–$2,000/mo |
| Mid-size firm (6–20 attorneys) | $2,000–$6,000/mo |
| Large / PI firm | $5,000–$20,000+/mo |

Components: answering service ($250–$2,000+), CRM/intake software ($150–$1,200), chatbot ($80–$500), marketing ($1,000–$10,000+).

A solo or small firm currently spending $600–$1,200/month on a human answering service plus $89–$149/month on a basic CRM represents a direct addressable budget of $700–$1,400/month — well above Legal Concierge's target pricing at every tier.

---

## 3. Platform Architecture

### 3.1 Design Principles

The platform is built around five non-negotiable principles:

1. **Multi-tenant from day one.** Every data model, API call, webhook, Redis key, and log entry carries a `firm_id`. There is no single-tenant code path. Firm data never leaks to other firms.

2. **Template-driven, not code-driven.** Adding a new practice area or a new firm requires zero code changes. Every intake flow is a configurable template (JSON/YAML). Every qualification rule is a data record. Firm admins change their configuration; engineers do not.

3. **Embeddable anywhere, zero dependencies.** The widget is a 2KB loader script that creates an iframe. It drops into any website — WordPress, Squarespace, Wix, custom HTML, whatever the firm uses. No framework. No server-side requirement on the host site. One script tag.

4. **Mobile-first.** More than 60% of legal searches happen on mobile devices. The widget renders as a full-screen bottom sheet on mobile and as a floating panel on desktop. Every touch target is minimum 48×48px. The entire intake experience — voice conversation, transcript, progress tracker, booking, retainer link — is designed for a 375px screen first.

5. **Full lifecycle, not lead capture.** The platform's job is not done when a visitor's name is captured. It is done when the retainer is signed and the calendar appointment is confirmed. Every integration (Athena, GHL, HelloSign) exists to close that loop.

### 3.2 Tenant Configuration Model

Each law firm is a tenant. Tenant configuration is the master record that governs everything the platform does for that firm.

```
Tenant
├── Firm Profile
│   ├── name, slug, logo_url, primary_color
│   ├── active_states: ['TX', 'FL', 'CA']
│   ├── practice_areas: ['personal_injury', 'real_estate', 'business_law']
│   ├── concierge_name: 'Alex'
│   ├── concierge_persona: 'professional' | 'empathetic' | 'direct'
│   └── athena_assistant_id, ghl_location_id, athena_kb_id
│
├── Attorneys[]
│   ├── name, photo_url, bio
│   ├── practice_areas: ['real_estate', 'business_law']
│   ├── active_states: ['TX']
│   ├── ghl_user_id
│   └── calendar_ids: { real_estate: 'cal_xxx', business_law: 'cal_yyy', default: 'cal_zzz' }
│
├── Practice Area Templates[]   ← one per practice area
│   ├── template_id: 'personal_injury_v1'
│   ├── display_name: 'Personal Injury'
│   ├── question_stages[]        ← ordered intake stages
│   ├── qualification_rules[]    ← scoring weights
│   ├── disqualification_triggers[]
│   ├── urgency_flags[]          ← SOL thresholds, arrest timing
│   ├── required_documents[]     ← what to ask caller to gather
│   ├── fee_structure_disclosure: 'Contingency fee — no upfront cost'
│   └── retainer_template_id
│
├── Retainer Templates[]
│   ├── practice_area, state_code, attorney_id
│   ├── esign_provider: 'hellosign'
│   └── esign_template_id
│
└── Widget Configuration
    ├── position: 'bottom-right' | 'bottom-left'
    ├── launcher_style: 'bubble' | 'bar'
    ├── mobile_style: 'bottom_sheet' | 'fullscreen'
    ├── greeting: 'Hello! I\'m Alex, your legal concierge...'
    ├── cta_text: 'Get a Free Consultation'
    └── allowed_domains: ['donovanlegalpllc.com']
```

### 3.3 Intake Template Engine

The intake template engine is the heart of the platform. Every practice area is a JSON template describing the complete intake flow. The engine executes templates — it does not hard-code any practice-area logic.

**Template structure:**

```json
{
  "template_id": "personal_injury_mva_v1",
  "practice_area": "personal_injury",
  "display_name": "Personal Injury / Motor Vehicle Accident",
  "version": 1,
  "stages": [
    {
      "stage_id": "contact",
      "label": "Contact Information",
      "milestone_index": 1,
      "questions": [
        {
          "variable": "ClaimantFirstName",
          "type": "string",
          "required": true,
          "agent_prompt": "May I get your first name?",
          "validation": { "min_length": 1, "max_length": 100 }
        },
        {
          "variable": "ClaimantPhone",
          "type": "phone",
          "required": true,
          "agent_prompt": "What is the best phone number to reach you?"
        },
        {
          "variable": "ClaimantEmail",
          "type": "email",
          "required": false,
          "agent_prompt": "And your email address, if you have one?"
        },
        {
          "variable": "SmsConsent",
          "type": "boolean",
          "required": true,
          "agent_prompt": "Do I have your permission to send you text message updates about your case? Standard message rates apply.",
          "tcpa_disclosure": true
        }
      ]
    },
    {
      "stage_id": "incident_basics",
      "label": "Incident Details",
      "milestone_index": 2,
      "questions": [
        {
          "variable": "IncidentDate",
          "type": "date",
          "required": true,
          "agent_prompt": "When did the accident occur?",
          "triggers": [
            {
              "action": "calculate_sol",
              "depends_on": ["IncidentDate", "IncidentState"],
              "on_expired": "disqualify",
              "disqualify_reason": "statute_of_limitations_expired"
            }
          ]
        },
        {
          "variable": "IncidentState",
          "type": "us_state",
          "required": true,
          "agent_prompt": "What state did the accident occur in?"
        },
        {
          "variable": "IncidentLocation",
          "type": "string",
          "required": true,
          "agent_prompt": "What city and county did it happen in?"
        },
        {
          "variable": "AccidentType",
          "type": "enum",
          "options": ["car_accident", "truck_accident", "motorcycle", "slip_fall", "other"],
          "required": true,
          "agent_prompt": "Was this a car accident, truck accident, motorcycle accident, slip and fall, or something else?"
        }
      ]
    },
    {
      "stage_id": "injury_details",
      "label": "Injuries & Treatment",
      "milestone_index": 3,
      "questions": [
        {
          "variable": "InjuryDescription",
          "type": "text",
          "required": true,
          "agent_prompt": "Can you describe the injuries you sustained?"
        },
        {
          "variable": "ERVisit",
          "type": "boolean",
          "required": true,
          "agent_prompt": "Did you visit the emergency room or urgent care?"
        },
        {
          "variable": "TreatingFacility",
          "type": "string",
          "required": false,
          "condition": { "if": "ERVisit == true" },
          "agent_prompt": "What hospital or facility did you go to?"
        },
        {
          "variable": "OngoingTreatment",
          "type": "boolean",
          "required": true,
          "agent_prompt": "Are you currently receiving any ongoing medical treatment?"
        },
        {
          "variable": "TreatingDoctor",
          "type": "string",
          "required": false,
          "condition": { "if": "OngoingTreatment == true" },
          "agent_prompt": "Who is your treating physician or physical therapist?"
        },
        {
          "variable": "WageLoss",
          "type": "boolean",
          "required": true,
          "agent_prompt": "Have you missed any work or lost income because of your injuries?"
        }
      ]
    },
    {
      "stage_id": "accident_scene",
      "label": "Accident Scene",
      "milestone_index": 4,
      "questions": [
        {
          "variable": "AtFaultParty",
          "type": "string",
          "required": true,
          "agent_prompt": "Who do you believe was at fault for the accident?"
        },
        {
          "variable": "AtFaultInsurance",
          "type": "string",
          "required": false,
          "agent_prompt": "Do you know the name of the at-fault party's insurance company?"
        },
        {
          "variable": "PoliceReportFiled",
          "type": "boolean",
          "required": true,
          "agent_prompt": "Was a police report filed at the scene?"
        },
        {
          "variable": "PoliceReportNumber",
          "type": "string",
          "required": false,
          "condition": { "if": "PoliceReportFiled == true" },
          "agent_prompt": "Do you have the report number?"
        },
        {
          "variable": "Witnesses",
          "type": "boolean",
          "required": true,
          "agent_prompt": "Were there any witnesses to the accident?"
        },
        {
          "variable": "WitnessInfo",
          "type": "text",
          "required": false,
          "condition": { "if": "Witnesses == true" },
          "agent_prompt": "Do you have contact information for any witnesses?"
        }
      ]
    },
    {
      "stage_id": "eligibility",
      "label": "Eligibility",
      "milestone_index": 5,
      "questions": [
        {
          "variable": "CurrentlyRepresented",
          "type": "boolean",
          "required": true,
          "agent_prompt": "Do you currently have an attorney representing you for this accident?",
          "triggers": [
            {
              "action": "disqualify",
              "condition": { "if": "CurrentlyRepresented == true" },
              "reason": "already_represented",
              "message": "Since you are already working with an attorney, I am not able to assist further, but I wish you well with your case."
            }
          ]
        },
        {
          "variable": "PriorSettlement",
          "type": "boolean",
          "required": true,
          "agent_prompt": "Have you previously settled a claim or lawsuit for this accident?"
        }
      ]
    }
  ],
  "qualification_score": {
    "max_score": 10,
    "rules": [
      { "condition": "InjuryDescription is not empty", "points": 2 },
      { "condition": "ERVisit == true", "points": 2 },
      { "condition": "OngoingTreatment == true", "points": 1 },
      { "condition": "WageLoss == true", "points": 2 },
      { "condition": "PoliceReportFiled == true", "points": 1 },
      { "condition": "AtFaultInsurance is not empty", "points": 1 },
      { "condition": "Witnesses == true", "points": 1 },
      { "condition": "PriorSettlement == true", "points": -3 }
    ],
    "thresholds": {
      "qualified": 5,
      "qualified_with_flag": 3,
      "disqualified": 0
    }
  },
  "disqualification_triggers": [
    { "variable": "CurrentlyRepresented", "value": true, "reason": "already_represented" },
    { "action": "sol_expired", "reason": "statute_of_limitations_expired" }
  ],
  "urgency_flags": [
    { "condition": "days_until_sol <= 90", "flag": "sol_urgent", "message": "This case is approaching its filing deadline. Connecting you immediately." },
    { "condition": "IncidentDate is within 7 days", "flag": "fresh_accident", "message": "Your accident is recent — acting now preserves your strongest evidence." }
  ],
  "documents_to_request": [
    "Police accident report",
    "Medical bills and treatment records",
    "Photos of vehicle damage and injuries",
    "Insurance information for both parties",
    "Photos of the accident scene if available"
  ],
  "handoff_type": "retainer_then_booking",
  "milestones": [
    { "index": 1, "label": "Contact Info", "stage_id": "contact" },
    { "index": 2, "label": "Incident Details", "stage_id": "incident_basics" },
    { "index": 3, "label": "Injuries", "stage_id": "injury_details" },
    { "index": 4, "label": "Accident Scene", "stage_id": "accident_scene" },
    { "index": 5, "label": "Qualification", "stage_id": "eligibility" }
  ]
}
```

This same structure applies to every practice area. The agent is instructed to follow the template. The qualification engine scores the collected variables. The disqualification engine watches for triggers. The milestone tracker advances as stages complete. **No practice-area-specific code exists in the application layer** — only template data.

### 3.4 The Widget

#### Architecture

The widget follows the canonical embeddable architecture used by Intercom, Drift, and Calendly: a small loader script creates an isolated iframe.

```
Host Website
├── <script src="https://widget.legalconcierge.ai/v1.js" data-firm="donovan-law"></script>
│     ↓ (2KB async loader)
│     ├── Reads data-* config attributes
│     ├── Creates command queue (window.LCWidget = fn)
│     ├── Injects <iframe src="https://widget.legalconcierge.ai/app?firm=donovan-law">
│     │     allow="microphone; autoplay"
│     │     sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
│     └── Sets up postMessage bridge for resize/events
│
└── iframe contents (100–150KB gzip, loads after page)
      ├── Launcher: floating bubble (desktop) / full-width bar (mobile)
      ├── Panel: expanding chat/voice interface
      ├── Transcript panel: real-time STT display
      ├── Milestone tracker: progress bar with stage labels
      ├── Booking UI: 3 calendar slots
      └── Retainer confirmation: link delivery acknowledgment
```

#### Embed Code

```html
<!-- Legal Concierge Widget — add before </body> -->
<script
  src="https://widget.legalconcierge.ai/v1.js"
  data-firm="donovan-law"
  data-position="bottom-right"
  data-primary-color="#1a3a5c"
  data-cta-text="Get a Free Consultation"
  async
></script>
```

Optional explicit CTA trigger on any page element:

```html
<button data-lc-trigger class="your-existing-cta-class">
  Talk to Our Legal Concierge
</button>
```

#### Mobile: Bottom Sheet Pattern

On screens ≤768px, the launcher renders as a full-width fixed bar at the bottom of the viewport. On tap, a bottom sheet slides up to 90vh with a drag handle. The sheet is the complete intake UI: voice waveform, real-time transcript, milestone progress bar, and input controls.

```css
/* Desktop: floating bubble */
.lc-launcher {
  position: fixed;
  bottom: 20px;
  right: 20px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  z-index: 9998;
}

/* Mobile: full-width CTA bar */
@media (max-width: 768px) {
  .lc-launcher {
    bottom: 0; right: 0; left: 0;
    width: 100%;
    border-radius: 0;
    height: 56px;
    z-index: 9998;
  }
  .lc-panel {
    position: fixed;
    bottom: 0; left: 0; right: 0;
    height: 90vh;
    border-radius: 16px 16px 0 0;
    transform: translateY(100%);
    transition: transform 0.3s ease;
  }
  .lc-panel.open { transform: translateY(0); }
}
```

#### Real-Time Transcript Panel

As the voice AI speaks and the caller responds, text appears in real-time in a scrolling transcript panel. This serves two purposes: (1) it shows the caller that they're being understood; (2) it gives them a text record of the conversation. The transcript is driven by Athena's real-time STT stream → WebSocket → Redis pub-sub → SSE to the widget iframe.

```
┌─────────────────────────────────────┐
│  ● CONNECTING...                     │  ← Status badge
├─────────────────────────────────────┤
│                                      │
│  Alex: Hello, I'm Alex, your legal  │  ← AI transcript
│  concierge at Donovan Legal...       │
│                                      │
│  You: I was in a car accident        │  ← User transcript
│  on Monday                           │
│                                      │
│  Alex: I'm sorry to hear that.       │
│  Can you tell me what state this     │
│  happened in?                        │
│                                      │
├─────────────────────────────────────┤
│  [Contact] ──●── [Incident] [Injury] │  ← Milestone progress bar
│  [Scene] [Qualification]             │
└─────────────────────────────────────┘
```

#### Visual Milestone Tracker

The progress bar shows labeled milestones corresponding to template stages. Each milestone lights up when the corresponding stage is complete. The backend fires a webhook when each stage completes → Redis → SSE → widget updates visually.

#### Performance Target

< 100ms load impact on host page. The loader script is async (non-blocking). The iframe and its contents load after page content. No host-page render blocking.

#### Accessibility

WCAG 2.2 AA compliance required:
- `role="dialog"`, `aria-modal="true"`, `aria-label="Legal consultation"` on the panel
- `aria-live="polite"` on transcript output region (screen readers announce new messages)
- Focus trapped within open panel; returns to launcher on close
- `Escape` key closes panel
- All touch targets minimum 48×48px
- Color contrast ratios ≥ 4.5:1 on all text
- Voice input always has a typed text fallback; microphone permission consent screen before browser prompt
- TCPA consent checkbox: explicit opt-in before any SMS/outbound trigger

### 3.5 Voice + Text Engine (via Athena)

Athena (ConnexUS AI Platform) provides the voice AI backbone. One assistant is created per firm during onboarding (or per practice area for complex firms).

```bash
POST /api/v1/assistants
{
  "name": "Donovan-Legal-Alex-v1",
  "llm_config": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.3,
    "system_prompt": "You are Alex, a professional legal intake concierge for Donovan Legal PLLC. Your role is to conduct a structured intake conversation, collect required information, qualify the caller's case, and guide them toward scheduling a consultation. You never provide legal advice. You always disclose you are an AI assistant. Follow the intake template loaded in your knowledge base precisely."
  },
  "voice_config": {
    "transcriber_provider": "deepgram",
    "synthesizer_provider": "elevenlabs",
    "voice_id": "professional-neutral-v2"
  },
  "knowledge_base_id": "kb_donovan_xxx",
  "webhook_url": "https://api.legalconcierge.ai/webhooks/athena/tool-call?firm_id=donovan_pllc",
  "tools": [
    "log_milestone", "capture_contact_info", "capture_practice_area",
    "capture_qualification_data", "submit_qualified_lead",
    "flag_disqualification", "request_booking_slot", "confirm_booking", "end_call"
  ]
}
```

**Text-only fallback:** If the caller is in a quiet environment or declines microphone access, the widget switches to text chat seamlessly. The Athena agent handles both modalities. Transcript is identical in both modes.

**Multi-language:** Spanish is the priority second language. The `system_prompt` can be language-configured per tenant. The concierge detects the caller's language within the first exchange and switches automatically.

**Agent personality:** Configurable per tenant. Options: `professional` (default), `empathetic` (for DV, family law, criminal defense contexts), `direct` (business law, tax). The Knowledge Base contains the firm's specific context: practice areas, qualification criteria, attorney bios, FAQs, geographic restrictions, fee structure disclosures.

### 3.6 CRM Integration (via GoHighLevel)

**Base URL:** `https://services.leadconnectorhq.com/`  
**Auth:** `Authorization: Bearer {oauth_access_token}` + `Version: 2021-07-28`  
**Note:** GHL's legacy RSA-SHA256 webhook signature (`X-WH-Signature`) is deprecated July 1, 2026. Implement Ed25519 (`X-GHL-Signature`) verification now.

Each law firm maps to a GHL **Location** (sub-account). Legal Concierge authenticates at the Agency level via OAuth 2.0, then uses Location-scoped tokens for all firm operations.

**Pipeline stages per firm (configured at GHL setup):**

```
New Lead → Qualified → Retainer Sent → Retainer Signed → Appointment Booked → Active Client → Closed Won / Closed Lost
```

**Contact creation (fires immediately on qualification):**

```json
POST /contacts/
{
  "locationId": "{ghl_location_id}",
  "firstName": "Jane", "lastName": "Doe",
  "phone": "+15551234567", "email": "jane@example.com",
  "source": "Legal Concierge Widget",
  "tags": ["qualified", "personal_injury", "intake_2026_04_07"],
  "customFields": [
    { "id": "cf_practice_area", "value": "personal_injury" },
    { "id": "cf_incident_date", "value": "2026-03-15" },
    { "id": "cf_jurisdiction", "value": "TX" },
    { "id": "cf_qual_score", "value": "8" },
    { "id": "cf_session_id", "value": "call_xxx" },
    { "id": "cf_injury_description", "value": "Whiplash, back pain, ER visit at Houston Methodist" },
    { "id": "cf_attorney_id", "value": "paul_donovan" }
  ]
}
```

**Pre-built GHL Workflows (configured at firm onboarding):**

- `retainer-followup`: SMS at 2h, 24h, 48h if unsigned. Email at 24h. Athena outbound call at 72h.
- `appointment-reminder`: SMS 24h before and 1h before. Email 24h before.
- `unqualified-nurture`: Email with legal resource content, 3-touch over 7 days.
- `new-intake-alert`: Immediate Slack/email notification to attorney on new qualified lead.

**Required OAuth scopes:**

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
users.readonly businesses.readonly
```

### 3.7 E-Signature Integration

**Recommended default:** HelloSign (Dropbox Sign) — $15/month for typical volumes, solid API, ESIGN Act + UETA compliant, consumer-recognized brand. DocuSign for firms requiring maximum court defensibility. PandaDoc for firms that want to manage templates inside a document editor.

**Template selection logic (waterfall):**

```javascript
async function selectRetainerTemplate(db, firmId, practiceArea, stateCode, attorneyId) {
  // Most specific: practice_area + state + attorney
  const t1 = await db.query(`SELECT * FROM retainer_templates 
    WHERE firm_id=$1 AND practice_area=$2 AND state_code=$3 AND attorney_id=$4 AND active=true
    ORDER BY version DESC LIMIT 1`, [firmId, practiceArea, stateCode, attorneyId]);
  if (t1.rows[0]) return t1.rows[0];

  // Fallback: practice_area + state (any attorney)
  const t2 = await db.query(`SELECT * FROM retainer_templates
    WHERE firm_id=$1 AND practice_area=$2 AND state_code=$3 AND active=true
    ORDER BY version DESC LIMIT 1`, [firmId, practiceArea, stateCode]);
  if (t2.rows[0]) return t2.rows[0];

  // Fallback: practice_area only (firm-wide default)
  const t3 = await db.query(`SELECT * FROM retainer_templates
    WHERE firm_id=$1 AND practice_area=$2 AND active=true
    ORDER BY version DESC LIMIT 1`, [firmId, practiceArea]);
  if (t3.rows[0]) return t3.rows[0];

  throw new Error(`No retainer template for ${practiceArea}/${stateCode}/${firmId}`);
}
```

**Target: retainer SMS delivered within 60 seconds of qualification completion.**

The HelloSign envelope is created concurrently with calendar booking (parallel dispatch). SMS contains the signing link. Email contains the full document preview. The `signature_request_signed` webhook fires to `/webhooks/esign/completed` → advance GHL pipeline to "Retainer Signed" → write audit log → remove from follow-up workflow → enroll in attorney notification workflow.

### 3.8 Calendar Booking

Calendar booking is offered to the caller during (or immediately after) the qualification conversation. The concierge agent fires the `request_booking_slot` tool → backend fetches 3 available slots from GHL Calendar API → returns them to the agent → agent presents 3 options verbally → caller chooses → `confirm_booking` tool fires.

```bash
# Step 1: Fetch available slots
GET /calendars/{calendarId}/free-slots
  ?startDate=1712484000000   # Unix ms — now
  &endDate=1713088800000     # Unix ms — +7 days
  &timezone=America/Chicago   # Detected from caller's browser
Authorization: Bearer {token}
Version: 2021-07-28

# Step 2: Book appointment
POST /calendars/events/appointments
{
  "calendarId": "cal_donovan_real_estate",
  "locationId": "{ghl_location_id}",
  "contactId": "contact_xxx",
  "startTime": "2026-04-08T10:00:00-05:00",
  "appointmentStatus": "confirmed",
  "title": "Initial Consultation — Jane Doe — Real Estate",
  "notes": "AI case summary: {generated_from_transcript}",
  "assignedUserId": "{ghl_user_id_paul_donovan}"
}

# Step 3: SMS confirmation
POST /conversations/messages
{
  "type": "SMS",
  "contactId": "contact_xxx",
  "locationId": "{ghl_location_id}",
  "message": "Your consultation with Paul Donovan is confirmed for April 8 at 10:00 AM CT. Reply STOP to opt out."
}
```

**Timezone awareness:** The widget reads `Intl.DateTimeFormat().resolvedOptions().timeZone` from the browser and passes it with the booking request. Slots are presented to the caller in their local timezone.

**Gmail/Google Calendar fallback:** For firms not yet on GHL, or if GHL calendar is temporarily unavailable, the platform falls back to Google Calendar API using an attorney's connected Google account.

### 3.9 Multi-Tenancy Architecture

Every data entity carries `firm_id`. Isolation is enforced at five layers:

| Layer | Isolation Mechanism |
|-------|---------------------|
| Database | `firm_id` FK on every table; Row-level Security policies in PostgreSQL |
| API | JWT includes `firm_id` claim; middleware rejects mismatched access |
| Webhooks | `firm_id` in query string; validated against call's registered firm |
| Redis | Namespaced keys: `session:{firm_id}:{call_id}:milestone` |
| GHL | Each firm uses its own `locationId` on every API call |

**Onboarding a new firm** (Phase 6 Admin Portal):
1. Firm creates account → new `firms` record
2. Select practice areas → load templates into their KB
3. Connect GHL → OAuth flow creates Location mapping
4. Connect Athena → create assistant, upload KB documents
5. Configure attorneys + calendars
6. Upload retainer templates
7. Generate embed code → one script tag to add to their website

---

## 4. Intake Flows by Practice Area

### 4.1 Personal Injury / MVA

**The most common case type.** Contingency fee (33–40%) creates high urgency for firms to qualify quickly — a good PI case is worth $3,000–$50,000+ in fees.

**AI-guided flow:**

| Stage | Variables Captured | Key Agent Actions |
|-------|--------------------|-------------------|
| Contact | FirstName, LastName, Phone, Email, SmsConsent | "May I get your name and the best number to reach you?" |
| Incident Basics | IncidentDate, IncidentState, IncidentLocation, AccidentType | SOL auto-calculated; urgency flag if < 90 days to deadline |
| Injury & Treatment | InjuryDescription, ERVisit, TreatingFacility, OngoingTreatment, TreatingDoctor, WageLoss | Empathetic tone; probe for severity and continuity of treatment |
| Accident Scene | AtFaultParty, AtFaultInsurance, PoliceReportFiled, PoliceReportNumber, Witnesses, WitnessInfo | Capture documentation inventory |
| Eligibility | CurrentlyRepresented, PriorSettlement, PriorClaims | Hard stop on CurrentlyRepresented = true |
| Employment & Damages | Employer, WeeklyIncome, InsuranceCarrier, UIMCoverage | Adds case value context |

**Qualification scoring (max 10):**

| Condition | Points |
|-----------|--------|
| ERVisit = true | +2 |
| OngoingTreatment = true | +1 |
| WageLoss = true | +2 |
| InjuryDescription present (non-trivial) | +2 |
| PoliceReportFiled = true | +1 |
| Witnesses = true | +1 |
| AtFaultInsurance confirmed | +1 |
| PriorSettlement = true | −3 |
| PriorClaims in same body part | −2 |

Threshold: ≥5 = Qualified → retainer + booking. 3–4 = Qualified with flag (book consult, attorney decides). <3 = Resource mode.

**Disqualification triggers:**
- `CurrentlyRepresented = true` → hard stop, polite exit
- SOL expired → graceful exit with non-engagement explanation
- `PriorSettlement = true` on same accident → flag for attorney review (not auto-disqualify)
- Minor impact, no injury, no treatment → resource mode (not retained)

**Urgency flags:**
- Any government entity involved (45–180 day notice requirement in most states) → immediate escalation
- IncidentDate within 90 days of SOL expiry → "We need to act quickly"
- Fresh accident (within 7 days) → "Evidence preservation is critical right now"

**Documents to request:**
- Police/accident report
- Medical bills and records
- Photos of vehicle damage, scene, injuries
- Insurance information (both parties)
- Pay stubs (for lost wages claim)

**Fee structure disclosure:** "Our attorneys work on a contingency fee — you pay nothing upfront and no attorney fee unless you win. Costs and expenses are discussed in the retainer agreement."

**Handoff:** Qualified → retainer (HelloSign, within 60 seconds) + booking (first available attorney slot). High-urgency cases (SOL < 90 days) → warm transfer attempt first.

---

### 4.2 Real Estate (Donovan Law Primary)

**Transaction-driven intake.** Strong deadline urgency (30–60 day closing windows). Flat fee or hourly.

**AI-guided flow:**

| Stage | Variables Captured | Key Agent Actions |
|-------|--------------------|-------------------|
| Contact | Standard contact fields | Establish name, phone, email |
| Matter Type | TransactionType (purchase/sale/lease/dispute/zoning), PropertyType (residential/commercial/land) | Route to appropriate sub-flow |
| Property Details | PropertyAddress, PropertyState, TransactionValue, PropertyRole (buyer/seller/landlord/tenant) | Jurisdiction check; confirms firm is licensed |
| Transaction Details | PurchaseAgreementSigned, ClosingDateScheduled, FinancingInvolved, Lender, TitleCompany, Contingencies | For commercial: EntityStructure, ExistingTenants, Is1031Exchange |
| Dispute Details | DisputeNature (non-payment/habitability/eviction/title/fraud), ExistingCourtFilings, EvictionTimeline | For dispute sub-flow |
| Eligibility | CurrentlyRepresented, PropertyState matches active_states |  |

**Qualification scoring (max 10):**

| Condition | Points |
|-----------|--------|
| Commercial property | +3 |
| Active transaction (purchase/sale) with contract signed | +2 |
| Contract dispute with defined dollar amount | +2 |
| Client is decision-maker / owner | +1 |
| Closing deadline within 30 days | +2 |
| EvictionTimeline imminent | +2 |
| Outside active states (firm not licensed) | −5 |

**Disqualification triggers:**
- Property in state where firm is not licensed → graceful exit with referral guidance
- Currently represented by another attorney on same matter → exit
- Both buyer and seller seeking firm representation in same transaction → conflict, exit

**Urgency flags:**
- ClosingDateScheduled within 14 days → "With closing coming up, we should connect with you today"
- EvictionTimeline < 7 days → immediate escalation

**Documents to request:**
- Signed purchase agreement or LOI
- Existing title report or prior title insurance policy
- HOA documents (if applicable)
- Mortgage commitment letter
- Seller disclosures / inspection report

**Fee structure disclosure:** "Real estate transaction matters are typically handled on a flat fee basis. Dispute representation is hourly. Paul Donovan will review the specific fee structure with you in your consultation."

**Handoff:** Qualified → booking (Paul Donovan's calendar, real estate slot) + retainer dispatch. Flat fee or hourly engagement letter.

---

### 4.3 Business Law (Donovan Law)

**Entity- and contract-driven intake.** High variability in matter type. Hourly or flat fee.

**AI-guided flow:**

| Stage | Variables Captured | Key Agent Actions |
|-------|--------------------|-------------------|
| Contact | Standard | Establish identity and role (owner, officer, authorized agent) |
| Matter Type | BusinessMatterType (formation/contract/dispute/MA/compliance) | Branch to appropriate sub-flow |
| Entity Details | EntityType (LLC/Corp/Partnership/Sole Prop), BusinessName, StateOfOrganization, YearsOperating, NumberOfOwners | |
| Matter Details | ContractInDispute, PartiesInvolved, ApproxDollarValue, IsLitigationPending, FilingDeadline | |
| Financial Context | IsRevenueGenerating, AnnualRevenue (approximate range) | Ensures case value justifies fees |
| Eligibility | CurrentlyRepresented, ConflictCheck fields |  |

**Qualification scoring (max 10):**

| Condition | Points |
|-----------|--------|
| Revenue-generating business (not idea stage) | +3 |
| Active contract dispute with defined dollar amount | +3 |
| Business formation (clear, low-risk engagement) | +2 |
| Multiple partners involved | +1 |
| Deadline or filing deadline within 60 days | +1 |
| Criminal/regulatory enforcement action | +2 (escalate priority) |
| No assets/revenue, startup idea only | −2 |

**Disqualification triggers:**
- Securities law or complex federal regulatory matter beyond firm's scope → graceful referral
- Representing both parties in same transaction (conflict) → exit

**Documents to request (varies by matter type):**
- Entity formation: prior articles, operating agreement, business licenses
- Contracts: term sheet, LOI, existing drafts
- M&A: entity financials, target company info, LOI
- Dispute: existing contract, correspondence, evidence of breach

**Fee structure disclosure:** "Business law matters are handled on an hourly basis or flat fee depending on the type of matter. Paul Donovan will discuss the specific arrangement during your consultation."

---

### 4.4 Tax Law (Donovan Law)

**IRS-deadline-driven intake.** Missing a 90-day Tax Court deadline is permanent and catastrophic. Urgency is the primary qualifier.

**AI-guided flow:**

| Stage | Variables Captured | Key Agent Actions |
|-------|--------------------|-------------------|
| Contact | Standard | |
| Issue Type | TaxIssueType (audit/debt/lien/levy/OfferInCompromise/TaxCourt/planning/criminal) | "Which of these best describes your situation?" |
| Scope | IsPersOrBusiness, TaxAuthority (IRS/state/both), TaxYearsAtIssue | |
| Urgency | NoticeType (CP2000/CP3219A/NoticeOfDeficiency/IntentToLevy/LienNotice), NoticeDeadline, DeadlineDate | **CRITICAL** — 90-day letter triggers immediate escalation |
| Amount | ApproxTaxLiability (range: <$10K/$10K-$50K/$50K-$200K/>$200K) | Qualifies for attorney fees vs. CPA referral |
| Current Status | HasSpokenToIRS, MadeAdmissions, HasFiled4Years |  |

**Qualification scoring (max 10):**

| Condition | Points |
|-----------|--------|
| Active IRS audit or collection action | +4 |
| Tax debt > $10,000 | +3 |
| 90-day Notice of Deficiency received | +4 (auto-escalate) |
| Business tax matter | +2 |
| Correspondence deadline within 30 days | +3 |
| Criminal tax investigation | +5 (immediate attorney call) |
| Tax balance < $10,000 (CPA-level) | −3 |
| State-only matter, state where firm not licensed | −4 |

**Critical urgency flags:**
- `NoticeType = "NoticeOfDeficiency"` → "The 90-day deadline to petition Tax Court is one of the most critical in all of law. Missing it permanently eliminates your right to contest in Tax Court without paying first. We need to connect you with Paul immediately."
- `NoticeType = "IntentToLevy"` → "A Notice of Intent to Levy means the IRS can seize your assets within 30 days. This is urgent — let's get you connected today."
- `DeadlineDate < 14 days away` → immediate warm transfer attempt

**Documents to request:**
- All IRS notices and correspondence (chronological order)
- Last 2–3 years of filed tax returns
- Bank statements (3–6 months)
- Business P&L (if business matter)
- Prior collection correspondence

**Fee structure disclosure:** "Tax law matters are handled on a flat fee by type of matter, or hourly for complex cases. Paul will review the specific fee with you in your consultation."

---

### 4.5 Family Law

**Safety-first intake.** Domestic violence requires immediate escalation. High emotional sensitivity required. Contingency fees prohibited in most states — retainer required upfront.

**AI-guided flow:**

| Stage | Variables Captured | Key Agent Actions |
|-------|--------------------|-------------------|
| Safety Check | ImmediateSafetyRisk, NeedsEmergencyProtectiveOrder | **FIRST** — if yes, immediate escalation and hotline referral |
| Contact | Standard | |
| Matter Type | FamilyMatterType (divorce/custody/support/adoption/prenup/DV) | |
| Marriage Details | DateOfMarriage, CurrentlyLivingTogether, SeparationDate, SpouseHasAttorney | |
| Children | HasMinorChildren, ChildrenNames, CurrentCustodyArrangement, CustodyGoals, SpecialNeeds | |
| Assets | MaritalResidenceValue, EstimatedTotalAssets, SharedDebts, RetirementAccounts, BusinessInterests | |
| Eligibility | MeetsResidencyRequirement, CurrentlyRepresented, ClientCanAffordRetainer |  |

**Qualification scoring (max 10):**

| Condition | Points |
|-----------|--------|
| Active children custody dispute | +3 |
| Significant assets to divide (>$100K) | +3 |
| Domestic violence / emergency order needed | +3 (escalate immediately) |
| Contested divorce (not agreed) | +2 |
| Meets residency requirements | +1 |
| No assets, no children, fully agreed | −4 (refer to doc prep service) |

**Disqualification triggers:**
- No assets, no children, fully uncontested → resource mode (refer to self-help court programs or legal document prep)
- Jurisdiction where firm not licensed

**Urgency flags:**
- `ImmediateSafetyRisk = true` → pause intake, provide National DV Hotline (1-800-799-7233), offer immediate attorney call
- Child removal threat → emergency filing capability flagged
- Pending court date within 14 days → immediate escalation

**Documents to request:**
- Marriage certificate
- Birth certificates for all children
- Last 2 years tax returns, 3 months pay stubs
- Bank statements, property deeds, retirement account statements
- Any existing court orders (custody, support, restraining orders)
- Prenuptial agreement (if any)

**Fee structure disclosure:** "Family law matters require an upfront retainer. Paul will discuss the specific retainer amount and hourly rate during your consultation based on the complexity of your case."

---

### 4.6 Criminal Defense

**Time-critical intake.** Arrests happen at night. DUI hearings and arraignments have 48-hour deadlines. The platform must have the firmest urgency detection of any practice area.

**AI-guided flow:**

| Stage | Variables Captured | Key Agent Actions |
|-------|--------------------|-------------------|
| Contact | Standard + ImmigrationStatus | Immigration status is critical — convictions can trigger deportation |
| Charge Details | ChargesField, ArrestDate, ArrestAgency, BondAmount, CourtDate | **FIRST** for current matter |
| Incident Description | ClientDescriptionOfEvents, MirandaGiven, StatementMade, RequestedAttorney | |
| Prior Record | PriorConvictions, OnProbation, ProbationOfficer | |
| DUI-Specific | BACReading, ChemicalTestRefused, DMVHearingRequested, PriorDUIs | 10-day DMV hearing deadline |
| Financial | CanAffordRetainer, EmploymentStatus | |

**Qualification scoring (max 10):**

| Condition | Points |
|-----------|--------|
| Felony charges | +4 |
| Arraignment within 48–72 hours | +4 (immediate escalation) |
| DUI: DMV hearing deadline < 10 days | +5 (immediate) |
| Client made no statement to police | +1 |
| Currently detained (in jail) | +5 (emergency) |
| Federal charges (if firm handles federal) | +3 |
| Cannot afford retainer, qualifies for public defender | −5 |

**Critical urgency flags:**
- `CurrentlyDetained = true` → "If someone is currently in custody, it is important that they speak to an attorney immediately. Let me connect you right now."
- DUI arrest: "In most states, you have only 10 days from your arrest date to request a DMV hearing to protect your driver's license. This deadline is separate from your criminal case."
- `CourtDate within 48 hours` → immediate warm transfer attempt

**Disqualification triggers:**
- Federal charges at firms that only handle state matters
- Client cannot afford retainer and doesn't qualify for public defender → referral with information
- Immigration detainer: coordinate with immigration attorney referral

**Documents to request:**
- Arrest/booking paperwork
- Bond paperwork and conditions of release
- Any citations or charging documents
- Prior conviction records (if client has them)
- Character reference contacts

**Fee structure disclosure:** "Criminal defense is typically handled on a flat fee for defined case stages. The attorney will discuss the retainer amount during your consultation."

---

### 4.7 Immigration

**Document-intensive. Language-critical.** Spanish, Portuguese, and other language support essential. Filing deadlines are jurisdictional and unforgiving.

**AI-guided flow:**

| Stage | Variables Captured | Key Agent Actions |
|-------|--------------------|-------------------|
| Language | PreferredLanguage | Switch to Spanish/etc. immediately if needed |
| Contact | Standard | |
| Matter Type | ImmigrationMatterType (family/employment/asylum/removal/DACA/naturalization/UVisa) | |
| Current Status | CurrentImmigrationStatus, EntryDate, VisaType, ALienRegistrationNumber | |
| Family Ties | HasUSCSpouse, HasUSCParent, HasLPRSponsor | Critical for family-based pathways |
| Deadline Check | HasNoticeToAppear, CourtDate, AsylumFilingDeadline, RFEDeadline | |
| Criminal History | AnyCriminalHistory | Critical — affects nearly all relief categories |

**Critical urgency flags:**
- Asylum: `DaysSinceEntry > 300` → "The 1-year asylum filing deadline is very strict. If you entered more than a year ago without filing, we need to discuss potential exceptions immediately."
- `HasNoticeToAppear = true` and court date present → "You have active removal proceedings. Missing your court date results in an automatic order of removal."
- `RFEDeadline within 30 days` → immediate priority

---

### 4.8 Estate Planning / Probate

**Trust-based intake.** Clients are often elderly or recently bereaved. High emotional sensitivity. No SOL urgency unless terminal illness or probate deadlines.

**AI-guided flow:**

| Stage | Variables Captured | Key Agent Actions |
|-------|--------------------|-------------------|
| Contact | Standard | |
| Matter Type | EstateMatterType (will/trust/POA/healthcare_directive/probate/guardianship) | |
| Life Circumstances | MarriedOrPartnered, HasMinorChildren, HasSpecialNeedsChild, PriorWillExists | |
| Urgency | TerminalIllnessPresent, ImmediateCapacityConcerns, ProbateDeadline | |
| Asset Overview | RealEstateOwned, RetirementAccounts, LifeInsurance, BusinessInterests, EstimatedEstatValue | |
| Family Situation | BlendedFamily, Divorced, ChildrenFromMultipleRelationships | |

**Critical urgency flags:**
- `TerminalIllnessPresent = true` → "We can accommodate expedited appointments and can come to your home or facility if needed."
- Probate deadlines (creditor periods, estate tax returns due 9 months from date of death) → immediate flag

---

### 4.9 Bankruptcy

**Document-intensive.** Automatic stay is an extremely powerful urgency trigger. Foreclosure sale dates, wage garnishments, and bank levies can be stopped immediately upon filing.

**AI-guided flow:**

| Stage | Variables Captured | Key Agent Actions |
|-------|--------------------|-------------------|
| Contact | Standard | |
| Urgency | ForeclosureSaleDate, WageGarnishmentActive, BankLevied | **Critical** — bankruptcy stops these immediately |
| Debt Overview | PrimaryDebtType (mortgage/credit/medical/student/tax), TotalDebtEstimate | |
| Income | GrossMonthlyIncome, HouseholdSize | For Means Test (Chapter 7 eligibility) |
| Assets | RealEstateOwned, VehiclesOwned, RetirementAccountBalance | |
| Prior Filings | PriorBankruptcyFiled, PriorChapter, YearOfPriorDischarge | Determines re-filing eligibility |
| Credit Counseling | CreditCounselingCompleted | Mandatory within 180 days before filing |

**Critical urgency flags:**
- `ForeclosureSaleDate within 14 days` → "Filing bankruptcy immediately triggers an automatic stay, which stops the foreclosure sale. We should move quickly."
- `WageGarnishmentActive = true` → "Bankruptcy filing stops wage garnishment immediately."

---

### 4.10 Employment Law

**EEOC-deadline-driven.** Firms accept fewer than 5% of cases presented. The most stringent qualification criteria of any practice area.

**AI-guided flow:**

| Stage | Variables Captured | Key Agent Actions |
|-------|--------------------|-------------------|
| Contact | Standard | |
| Claim Type | EmploymentClaimType (discrimination/harassment/wrongful_termination/wage_hour/FMLA/retaliation) | |
| Employer | EmployerName, EmployerSize (employees), YourJobTitle, TerminationDate | Size matters — Title VII requires 15+ employees |
| Protected Class | ProtectedBasis (race/sex/age/disability/religion/national_origin/pregnancy/other) | |
| EEOC Status | EEOCChargeFiled, EEOCChargeDate, RightToSueReceived, RightToSueDate | **MOST CRITICAL** — 90-day filing deadline |
| Damages | LostWages, CurrentlyEmployed, NewSalary, EmotionalDistress |  |
| Arbitration | SignedArbitrationAgreement | Changes available forum |

**Critical urgency flags:**
- `RightToSueDate present` and `DaysRemaining <= 30` → "You have {X} days remaining to file suit after receiving your right-to-sue letter. This deadline cannot be extended. We need to act immediately."
- `TerminationDate present` and approaching 180/300-day EEOC filing window → flag

**Disqualification triggers:**
- At-will termination with no protected class nexus
- EEOC deadline passed without charge filed
- Right-to-sue expired (90 days)
- Employer under 15 employees (Title VII inapplicable)
- No recoverable damages
- Client signed arbitration agreement (changes analysis — not disqualify, but flag)

---

## 5. CON-989 as Universal Framework

CON-989 refers to the MVA intake expansion variables that transform the AdvisoryConnect base (accident → damage → legal → connect) into the deep clinical-quality intake pattern needed for serious cases. The insight is that **these variables are not MVA-specific — they are the pattern for all practice areas.**

### 5.1 The Pattern

Every intake flow collects the same structural categories of information. Only the domain-specific labels change:

| Universal Category | PI/MVA Variables | Family Law Variables | Criminal Defense Variables | Tax Law Variables |
|-------------------|-----------------|---------------------|---------------------------|-------------------|
| **What happened** | AccidentType, AccidentDate, AccidentLocation | MarriageDate, SeparationDate, FamilyMatterType | ChargesField, ArrestDate, AllegedOffense | TaxIssueType, TaxYearsAtIssue |
| **Impact/injury** | InjuryDescription, ERVisit, TreatingFacility, WageLoss | ChildCustodyGoals, AssetDivisionImpact | BondAmount, ImpactOnEmployment | TaxLiabilityAmount, ImpactOnBusiness |
| **Scene/context** | AtFaultParty, PoliceReportFiled, Witnesses, WitnessInfo | SpouseHasAttorney, CourtOrders, PrenuptialAgreement | ArrestingAgency, MirandaGiven, StatementMade | IRSNoticeType, IRSDeadlineDate |
| **Eligibility gates** | CurrentlyRepresented, SOLStatus | MeetsResidency, ClientCanAfford | CanAffordRetainer, OnProbation | DebtOverThreshold, CanAffordFees |
| **Document inventory** | PoliceReport, MedicalRecords, Photos, InsuranceInfo | MarriageCert, TaxReturns, BankStatements | ArrestDocs, BondPapers | IRSNotices, FiledReturns, BankStatements |

### 5.2 The Conditional Logic Pattern

The conditional `if (ERVisit == true) → ask TreatingFacility` pattern from CON-989 is universal:

```
PI:        if (ERVisit == true)        → ask TreatingFacility
Family:    if (HasMinorChildren == true) → ask CustodyGoals, ChildInfo
Criminal:  if (MirandaGiven == true)   → ask StatementMade
Tax:       if (NoticeType == "NoticeOfDeficiency") → ask NoticeDeadline, escalate urgency
Immigration: if (HasNoticeToAppear == true) → ask CourtDate, RemovalProceedingsDetails
Estate:    if (TerminalIllnessPresent == true) → set urgency_flag, offer expedited_appointment
Bankruptcy: if (ForeclosureSaleDate present) → calculate days_until_sale, trigger urgency_flow
Employment: if (RightToSueReceived == true)  → calculate days_remaining, trigger deadline_flag
```

**Implementation:** The template engine processes `condition` objects on question nodes. When `condition.if` evaluates true, the question becomes required and is added to the next exchange. When false, it is skipped. This is a single generic evaluation function — not practice-area-specific code.

### 5.3 The submit_lead Payload — Universal Structure

The `submit_lead` tool fires when qualification is complete. Its payload structure accommodates any practice area:

```json
{
  "firm_id": "donovan_pllc",
  "session_id": "call_xxx",
  "practice_area": "personal_injury",
  "contact": {
    "first_name": "Jane",
    "last_name": "Doe",
    "phone": "+15551234567",
    "email": "jane@example.com",
    "sms_consent": true,
    "timezone": "America/Chicago"
  },
  "qualification": {
    "score": 8,
    "max_score": 10,
    "status": "qualified",
    "thresholds_met": ["qualified"],
    "disqualify_reason": null
  },
  "intake_data": {
    "IncidentDate": "2026-03-15",
    "IncidentState": "TX",
    "AccidentType": "car_accident",
    "InjuryDescription": "Whiplash, lower back pain, ER visit",
    "ERVisit": true,
    "TreatingFacility": "Houston Methodist",
    "OngoingTreatment": true,
    "WageLoss": true,
    "AtFaultParty": "Other driver ran red light",
    "AtFaultInsurance": "State Farm",
    "PoliceReportFiled": true,
    "Witnesses": true
  },
  "urgency_flags": ["fresh_accident"],
  "milestones_completed": [1, 2, 3, 4, 5],
  "documents_requested": ["police_report", "medical_records", "photos", "insurance_info"],
  "transcript_url": "https://storage.googleapis.com/lc-docs/call_xxx_transcript.txt",
  "call_duration_seconds": 312
}
```

The `intake_data` object is a generic key-value map. The template defines which keys exist. The application layer does not need to know what keys are present — it stores the full JSONB in the `leads.qualification_data` column and passes it to GHL as custom fields (mapped from template field definitions).

### 5.4 Milestones — Configurable Per Template

The 16-milestone system from AdvisoryConnect is generalized. Templates define their own milestone list (typically 4–7 stages). The milestone tracker in the widget renders whatever milestones the template defines. The backend fires `log_milestone` tool calls for each stage completion. The widget subscribes via SSE and advances the progress bar.

```json
"milestones": [
  { "index": 1, "label": "Contact Info",     "stage_id": "contact",        "icon": "user" },
  { "index": 2, "label": "Incident Details", "stage_id": "incident_basics","icon": "calendar" },
  { "index": 3, "label": "Your Injuries",    "stage_id": "injury_details", "icon": "heart" },
  { "index": 4, "label": "Accident Scene",   "stage_id": "accident_scene", "icon": "map-pin" },
  { "index": 5, "label": "Eligibility",      "stage_id": "eligibility",    "icon": "check" }
]
```

The widget renders exactly these labels in the progress bar. Family law might show: Contact → Your Marriage → Children → Assets → Goals. Tax might show: Contact → Your Issue → IRS Notices → Financial Overview. The code is identical — only the data changes.

---

## 6. Donovan Law Implementation

### 6.1 Firm Profile

| Attribute | Value |
|-----------|-------|
| Firm name | Donovan Legal PLLC |
| Primary attorney | Paul Donovan |
| Practice areas | Real Estate, Business Law, Taxation |
| Jurisdiction | Texas (primary); federal for tax matters |
| Website | donovan-law-site (deployed on GCP Cloud Run) |
| CRM | GoHighLevel — new Location to be created |
| Calendar | Paul Donovan's GHL calendar (per practice area) |
| Concierge name | Alex (gender-neutral; confirm with Paul) |
| E-signature | HelloSign (default; Paul may have preference) |
| Retainer templates | Paul Donovan to provide — one per practice area minimum |

### 6.2 Knowledge Base Documents

**KB Document 1 — Firm Overview:**
```
Donovan Legal PLLC serves clients in Texas and federal matters.
Attorney: Paul Donovan, licensed in Texas.
Practice areas: Real Estate, Business Law, Taxation.
Consultations by appointment. Available hours: [Paul to provide].
Fee structure: [Paul to provide — hourly/flat fee per area].
After-hours: AI intake available 24/7; Paul responds to qualified leads within one business day.
```

**KB Document 2 — Real Estate Intake Criteria:**
(Full qualification questions, disqualification rules, active states, SOL reference, document checklist — as defined in Section 4.2)

**KB Document 3 — Business Law Intake Criteria:**
(Full qualification questions, entity formation specifics, contract/dispute/M&A sub-flows — as defined in Section 4.3)

**KB Document 4 — Tax Law Intake Criteria:**
(Full qualification questions, IRS notice types, 90-day petition warning, urgency triggers — as defined in Section 4.4)

**KB Document 5 — Paul Donovan Attorney Profile:**
```
Paul Donovan is a Texas-licensed attorney with experience in real estate transactions and disputes, 
business formation and contracts, and federal and state tax law including IRS representation.
He accepts appointments Monday–Friday, 9am–5pm CT, with occasional evening slots.
Consultations are offered via phone, video, or in-person.
```

### 6.3 GHL Setup for Donovan Legal

**Location:** Create one GHL Location — "Donovan Legal PLLC"  
**User:** Paul Donovan (one GHL user)  
**Calendars:**
```json
{
  "paul_donovan": {
    "real_estate":  "cal_donovan_re",
    "business_law": "cal_donovan_biz",
    "taxation":     "cal_donovan_tax",
    "default":      "cal_donovan_consultations"
  }
}
```

**Custom fields to create in GHL Location:**
- `cf_practice_area` (text)
- `cf_incident_date` (date)
- `cf_jurisdiction` (text)
- `cf_qual_score` (number)
- `cf_session_id` (text)
- `cf_retainer_status` (text: not_sent / sent / signed / expired)
- `cf_matter_description` (textarea — AI-generated summary)

**Pipeline stages:**
```
New Lead → Qualified → Retainer Sent → Retainer Signed → Appointment Booked → Active Client → Closed Won / Closed Lost
```

**Workflows to configure:**
- `donovan-retainer-followup` (SMS 2h/24h/48h; email 24h)
- `donovan-appointment-reminder` (SMS 24h/1h before; email 24h before)
- `donovan-unqualified-nurture` (3-touch email over 7 days with legal info resources)
- `donovan-new-lead-alert` (immediate SMS/email to Paul on new qualified lead)

### 6.4 Retainer Template Requirements

Paul Donovan must provide approved retainer templates. At minimum one per practice area. Preferred: one per practice area × active state.

**Auto-populated fields (minimum):**
```
{{ClientFullName}}       — from FirstName + LastName
{{ClientPhone}}          — from ClaimantPhone
{{ClientEmail}}          — from ClaimantEmail
{{MatterDescription}}    — AI-generated 2-sentence summary from transcript
{{PracticeArea}}         — from template.display_name
{{Jurisdiction}}         — state where matter arises
{{DateOfAgreement}}      — today's date
{{AttorneyName}}         — "Paul Donovan"
{{FirmName}}             — "Donovan Legal PLLC"
{{FeeStructure}}         — e.g., "Hourly rate of $X/hr, billed in 0.1-hour increments"
{{EngagementScope}}      — brief description of matter
{{SignatureBlock_Client}}
{{SignatureBlock_Attorney}}
```

**Texas Bar compliance notes for Paul's review:**
- Texas Disciplinary Rules of Professional Conduct Rule 1.04 governs fee agreements
- Texas advertising rules apply to any intake-related AI communications
- Tax matter retainers should include Circular 230 disclosures
- All templates must be reviewed and approved by Paul before production deployment

### 6.5 Athena Assistant Configuration

```bash
POST /api/v1/assistants
{
  "name": "Donovan-Legal-Alex-v1",
  "description": "Legal intake concierge for Donovan Legal PLLC — Real Estate, Business Law, Taxation",
  "llm_config": {
    "provider": "openai",
    "model": "gpt-4o",
    "temperature": 0.3,
    "system_prompt": "You are Alex, a professional legal intake concierge for Donovan Legal PLLC. You conduct structured intake conversations for real estate, business law, and tax matters. You follow the intake template in your knowledge base precisely. You do not provide legal advice. You always disclose you are an AI assistant. You route callers to the correct practice area within the first two exchanges. Paul Donovan is the sole attorney and will be available for consultations by appointment."
  },
  "voice_config": {
    "transcriber_provider": "deepgram",
    "synthesizer_provider": "elevenlabs",
    "voice_id": "professional-neutral-v2"
  },
  "knowledge_base_id": "kb_donovan_xxx",
  "webhook_url": "https://api.legalconcierge.ai/webhooks/athena/tool-call?firm_id=donovan_pllc"
}
```

### 6.6 Website Embed Code

Add to donovan-law-site before `</body>` (Cloud Run deployment — add to HTML template):

```html
<!-- Legal Concierge Widget — Donovan Legal PLLC -->
<script
  src="https://widget.legalconcierge.ai/v1.js"
  data-firm="donovan-law"
  data-position="bottom-right"
  data-primary-color="#[PaulsBrandColor]"
  data-cta-text="Get a Free Consultation"
  async
></script>
```

Optional explicit CTAs on service pages:

```html
<!-- On Real Estate page -->
<button data-lc-trigger data-practice-area="real_estate" class="cta-button">
  Talk to Our Legal Concierge
</button>

<!-- On Tax law page -->
<button data-lc-trigger data-practice-area="taxation" class="cta-button">
  Get a Free Consultation
</button>
```

The `data-practice-area` attribute pre-routes the intake to the correct practice area, skipping the routing question for visitors who arrive from a practice-area-specific page.

### 6.7 Donovan Law First-Lead Definition of Done

A visitor to the Donovan Law website:
1. Clicks the widget CTA (or calls the 24/7 number via Athena phone)
2. Has a full intake conversation with Alex covering their practice area
3. A qualified lead record is created in the Legal Concierge PostgreSQL database
4. A GHL contact is created with all qualification data and custom fields
5. A GHL opportunity is created in the correct pipeline stage
6. Paul receives an immediate SMS/email notification of the new qualified lead
7. The lead receives a HelloSign retainer link via SMS and email within 60 seconds
8. The lead books a consultation slot with Paul via the in-conversation booking UI
9. Paul's GHL calendar shows the appointment with a case summary note
10. The `audit_log` table has an immutable record of every event

---

## 7. Competitive Advantage

### 7.1 Smith.ai ($292–$2,025/month)

Smith.ai is the most direct competitor for AI-enhanced legal intake. Their core weakness: they are fundamentally a **receptionist service** with AI layering, not an intake platform with legal intelligence.

| Dimension | Smith.ai | Legal Concierge |
|-----------|----------|-----------------|
| Pricing model | Per-call; overages spike unpredictably | Flat monthly; unlimited calls |
| Intelligence | Hybrid AI+human; AI is a call router | AI conducts full qualification conversation with practice-area-specific knowledge |
| Depth | Message-taking and appointment booking | Full qualification → retainer → booking in single session |
| Embeddability | Web chat widget embeds | Voice + text widget embeds; mobile-optimized bottom sheet |
| Retainer | No | Yes — auto-populated, dispatched within 60 seconds |
| Real-time transcript | No | Yes — live STT display in widget |
| Practice areas | Generic intake scripting | Per-practice-area templates with qualification scoring, SOL logic, urgency flags |
| Multi-firm platform | Single-firm per subscription | Multi-tenant; one codebase deploys to thousands of firms |
| Integrations | 9,000+ via Zapier | Direct GHL, Athena, HelloSign API (not webhook relay) |

**The decisive advantage:** Smith.ai at $1,950/month (300 calls) caps at 300 interactions. Legal Concierge at $299–$599/month handles unlimited calls with more intelligence per call.

### 7.2 Clio Grow (~$59/user/month)

Clio Grow is the dominant legal CRM. Its weakness: it is a **forms and pipeline tool**, not a conversational intake agent.

| Dimension | Clio Grow | Legal Concierge |
|-----------|-----------|-----------------|
| Intake method | Static web forms (no voice, no AI conversation) | Voice AI + text with real-time transcript |
| 24/7 response | No (forms are passive) | Yes — active AI conversation any time |
| Practice area intelligence | Generic intake forms | Practice-area-specific qualification templates |
| Speed to lead | Form submitted; staff follows up | Immediate conversation; retainer in 60 seconds |
| Retainer | E-signature for documents | Auto-populated retainer dispatched within 60 seconds |
| Case management | Deep Clio Manage integration | GHL integration; Clio integration planned (Phase 6+) |
| Target | Clio Manage users | Any firm, any website stack |

**The decisive advantage:** Clio Grow waits for a visitor to fill out a form and a human to follow up. Legal Concierge closes the loop in minutes. Legal Concierge is a complement to Clio Grow, not a full replacement — they solve different problems. A Clio firm using Legal Concierge for 24/7 voice intake + Legal Concierge retainer dispatch, then feeding leads into Clio Manage for case management, is an excellent pairing.

### 7.3 Lawmatics ($149–$1,149/month)

Lawmatics is the most powerful legal CRM for intake automation. Weakness: **no voice, no AI conversation**.

Lawmatics' QualifyAI add-on uses AI to score leads from form data. Legal Concierge generates the lead data in the first place through a live AI conversation — a fundamentally earlier and richer intervention. The depth difference: Lawmatics processes what a visitor manually typed into a form vs. Legal Concierge extracting structured data from a full spoken intake conversation.

Lawmatics also requires per-user pricing that scales steeply ($649–$1,149/month for growing firms). Legal Concierge flat-rate pricing is predictable at any call volume.

### 7.4 Intaker (~$80/month starting)

Intaker is the closest competitor in the "legal chatbot on website" category. Key limitations:
- Text-only (no voice)
- No real-time transcript
- No retainer dispatch
- No deep qualification intelligence (template-based chatbot, not LLM-native)
- No multi-practice-area routing intelligence

Intaker's strength is its legal-specific chatbot templates and video introduction feature. Legal Concierge surpasses on intelligence depth (LLM-native), voice capability, and the full lifecycle (retainer + booking).

### 7.5 LawDroid ($25–$99/month)

LawDroid focuses on **document automation**, not intake. It is not a real competitor for intake — it is a complementary tool that helps firms generate legal documents. The intake market is not LawDroid's primary focus.

### 7.6 Ruby / LEX Reception / Answering Legal

Human answering services have three structural problems:
1. **Per-minute billing** creates misaligned incentives and unpredictable costs
2. **Humans can only work so many calls at once** — overflow still goes to voicemail
3. **Humans cannot dispatch retainers, run qualification scoring, or book calendars** — they take messages

The most expensive human answering service plan (Ruby at $1,695/month for 500 minutes) handles roughly 50–100 calls per month at typical legal intake durations. Legal Concierge handles unlimited calls for less money, with more intelligence per call, and closes the loop further down the funnel.

Human services remain valuable for warm transfers where attorney availability is required. Legal Concierge handles the intake; humans handle the attorney-caller interaction when needed. The two are complementary, not exclusive.

---

## 8. Development Phases

### Phase 1: Widget + Voice MVP (Weeks 1–4)

**Goal:** A multi-practice-area concierge that qualifies leads, persists data, and creates GHL contacts — zero stubs.

**Deliverables:**

- [ ] Backend scaffold: Node.js/Fastify → Cloud Run, PostgreSQL (Cloud SQL), Redis (Memorystore)
- [ ] Tenant data models: `firms`, `firm_config`, `attorneys`, `intake_sessions`, `leads`, `audit_log`
- [ ] Athena integration service: `createAssistant()`, `createWebCallSession()`, `createKnowledgeBase()`, `uploadKBDocument()`
- [ ] Webhook receiver: `/webhooks/athena/tool-call` — milestone processing, qualification data extraction, Redis pub-sub, per-session isolation
- [ ] Athena tool definitions: `log_milestone`, `capture_contact_info`, `capture_practice_area`, `capture_qualification_data`, `submit_qualified_lead`, `flag_disqualification`, `end_call`
- [ ] Template engine: load JSON template → execute question stages → score qualification → fire disqualification triggers
- [ ] 3 practice area templates: `real_estate_v1`, `business_law_v1`, `taxation_v1` (for Donovan)
- [ ] Frontend: Widget loader script (2KB, vanilla TS, iframe-based)
- [ ] Frontend: Intake panel (Preact/vanilla TS inside iframe): voice mode + text mode + mode switching
- [ ] Frontend: Real-time transcript panel (SSE → Redis → widget)
- [ ] Frontend: Milestone progress bar (template-driven, configurable labels)
- [ ] Per-session SSE isolation (Redis pub-sub, namespaced per session)
- [ ] Mobile: bottom sheet + desktop: floating panel (CSS, no JS framework dependencies)
- [ ] Widget API: `data-firm`, `data-position`, `data-primary-color`, `data-cta-text`, `data-practice-area` attributes
- [ ] WCAG 2.2 AA baseline: dialog roles, focus management, aria-live transcript
- [ ] Donovan Legal tenant: Athena assistant, GHL Location, KB documents, 3 practice area templates
- [ ] Environment: Secret Manager integration, documented `.env.example`
- [ ] CI/CD: Cloud Build pipeline (existing pattern from Donovan Law site)

**Non-goals for Phase 1:** Retainer generation, calendar booking, e-signature, mobile app.

**Definition of done:** A visitor to donovan-law-site clicks the widget, has a full intake conversation with Alex, the lead is created in GHL with all qualification data and custom fields, the `audit_log` has an immutable record, and the qualifying lead appears in the GHL pipeline as "Qualified."

---

### Phase 2: Practice Area Templates × 10 (Weeks 5–7)

**Goal:** Full template library covering all 10 practice areas. Any firm in any area can be served.

**Deliverables:**

- [ ] Template engine hardening: full conditional logic, all variable types (string/enum/boolean/date/us_state/phone/email/text)
- [ ] Template validator: catches missing required fields, undefined variable references, circular conditions
- [ ] `personal_injury_mva_v1` — full CON-989 expansion (all Section 4.1 variables)
- [ ] `family_law_v1` — safety-first flow with DV detection
- [ ] `criminal_defense_v1` — urgency-first flow with DUI and detention handling
- [ ] `immigration_v1` — multilingual support, asylum deadline detection
- [ ] `estate_planning_v1` — expedited path for terminal illness
- [ ] `bankruptcy_v1` — automatic stay urgency triggers
- [ ] `employment_law_v1` — EEOC deadline tracking
- [ ] Urgency flag system: configurable per template; SOL auto-calculation; deadline proximity alerts
- [ ] Disqualification graceful exit: reason-specific messaging, resource mode content per practice area
- [ ] Multi-language: Spanish toggle; Athena system prompt switches language; transcript renders in caller's language

**Definition of done:** An attorney in any of the 10 practice areas can be onboarded with an existing template in under 2 hours.

---

### Phase 3: CRM Integration — GoHighLevel (Weeks 5–7, parallel with Phase 2)

**Goal:** Full GHL integration — contact lifecycle, pipeline, SMS/email, workflows.

**Deliverables:**

- [ ] GHL OAuth 2.0: agency-level auth, per-firm Location token management, auto-refresh
- [ ] `ghl.contacts.create()` — on `submit_qualified_lead`
- [ ] `ghl.contacts.update()` — qualification data as conversation progresses
- [ ] `ghl.opportunities.create()` — pipeline deal on qualification
- [ ] `ghl.opportunities.updateStage()` — advance stages throughout lifecycle
- [ ] `ghl.conversations.sendSMS()` — qualified lead confirmation
- [ ] `ghl.conversations.sendEmail()` — qualification summary
- [ ] Workflow enrollment: `addToWorkflow()`, `removeFromWorkflow()`
- [ ] GHL webhook receiver: `/webhooks/ghl/events` — Ed25519 signature verification, event dispatch
- [ ] Pre-built workflows for Donovan: `retainer-followup`, `appointment-reminder`, `unqualified-nurture`, `new-intake-alert`
- [ ] Custom fields schema for Donovan GHL Location

**Definition of done:** Every qualified lead in GHL with full data; every disqualified lead tagged and in nurture workflow; attorney receives immediate notification; pipeline shows correct stage.

---

### Phase 4: Calendar Booking (Weeks 8–9)

**Goal:** Concierge offers and books time with the attorney during the intake conversation.

**Deliverables:**

- [ ] `ghl.calendar.getFreeSlots(calendarId, startDate, endDate, timezone)` — returns available times
- [ ] Athena tool: `request_booking_slot` — triggers during conversation; returns 3 options
- [ ] Athena tool: `confirm_booking` — receives selection, fires booking
- [ ] `ghl.calendar.bookAppointment()` — creates appointment
- [ ] Appointment confirmation SMS
- [ ] Appointment record in `appointments` table
- [ ] Pipeline stage → "Appointment Booked"
- [ ] Frontend: slot selection UI (3 date/time buttons in widget; accessible; mobile-friendly)
- [ ] Timezone detection: `Intl.DateTimeFormat` in widget → passed to slot fetch
- [ ] Gmail/Google Calendar fallback (Phase 4b)
- [ ] Attorney-specific calendar routing: match practice area → attorney → calendar_id from `firm_config.calendar_ids`

**Definition of done:** Qualified lead selects a time slot during intake; appointment in attorney's calendar; lead receives SMS confirmation; pipeline shows "Appointment Booked."

---

### Phase 5: Retainer & E-Signature (Weeks 9–11)

**Goal:** Qualified lead receives pre-populated retainer for e-signature within 60 seconds of qualification.

**Deliverables:**

- [ ] `retainer_templates` table + admin upload UI
- [ ] Template selection logic: `selectRetainerTemplate(firmId, practiceArea, stateCode, attorneyId)`
- [ ] Field population engine: map `qualificationData` → template field values
- [ ] AI matter summary generation: 2-sentence summary from transcript for `MatterDescription` field
- [ ] HelloSign API client: `createEnvelope()`, `getEnvelopeStatus()`, `downloadSignedDocument()`
- [ ] DocuSign API client: same interface (pluggable adapter)
- [ ] Envelope creation: fires in parallel with booking on qualification
- [ ] Retainer SMS delivery (within 60 seconds of qualification)
- [ ] E-sign webhook receiver: `/webhooks/esign/completed` — signature confirmation handler
- [ ] Post-signature: GHL → "Retainer Signed"; audit log; retainer PDF → GCS; remove from follow-up; enroll in attorney notification
- [ ] Unsigned retainer follow-up: detect unsigned at 4h → trigger Athena outbound campaign
- [ ] Retainer templates loaded for Donovan PLLC (Paul to provide)

**Definition of done:** Lead receives retainer link via SMS within 60 seconds; upon signing, pipeline advances to "Retainer Signed"; audit log records event; Paul receives notification with signed document.

---

### Phase 6: Admin Portal — Firm Self-Service (Weeks 12–16)

**Goal:** Onboard a second law firm with zero engineering involvement.

**Deliverables:**

- [ ] Admin portal: Next.js 15 app (`apps/web`)
- [ ] Firm onboarding wizard:
  - Firm details (name, slug, states, practice areas)
  - Athena assistant auto-creation on form submit
  - Knowledge base creation + document upload UI
  - GHL Location creation (or link to existing)
  - Attorney roster configuration
  - Calendar ID linking
  - Retainer template upload and field mapping
  - E-sign provider selection + API key entry
  - Widget embed code generation (copy-paste ready)
- [ ] Firm isolation audit: confirm no cross-tenant data leakage at all layers
- [ ] Per-firm widget customization: concierge name, voice, persona, color scheme, greeting
- [ ] Per-firm qualification question library (configurable overrides on base templates)
- [ ] Per-firm disqualification rules
- [ ] Billing integration foundation (Stripe per-firm subscription)
- [ ] Analytics page: lead volume, qualification rate, retainer conversion, booking rate

**Definition of done:** Second firm onboards via admin portal; their widget works end-to-end; their data is completely isolated; no engineering involvement beyond initial portal deployment.

---

### Phase 7: Mobile App (Weeks 16–22)

**Goal:** iOS and Android app for 24/7 mobile access and attorney push notifications.

**Deliverables:**

- [ ] React Native (Expo) scaffold
- [ ] Athena Widget SDK: React Native component or WebView bridge
- [ ] Push notifications: Firebase Cloud Messaging (FCM) — lead alerts to attorneys
- [ ] Lead receives push if retainer unsigned (alternative to SMS)
- [ ] White-label build system: firm-branded app name, colors, icon
- [ ] Deep links: retainer SMS link opens app if installed
- [ ] Biometric auth for attorney/admin view
- [ ] Offline state handling: queue calls for connectivity restore
- [ ] App Store + Google Play submission

---

### Phase 8: Analytics Dashboard + Verification Pipeline (Weeks 20–28)

**Goal:** Full pipeline visibility for firms + verification intelligence for high-value cases.

**Analytics Dashboard Deliverables:**
- [ ] Lead volume by practice area, state, time period
- [ ] Qualification rate (widget conversations → qualified leads)
- [ ] Retainer conversion rate (qualified → signed)
- [ ] Booking rate (qualified → appointment booked)
- [ ] Average time: widget click → signed retainer (target: < 5 minutes for ideal flow)
- [ ] Attorney utilization by practice area
- [ ] GHL pipeline funnel visualization

**Verification Pipeline Deliverables:**
- [ ] Gate 1 (free, immediate): duplicate check, conflict check, SOL calculation
- [ ] Gate 2 (low cost): ID verification (Persona/Jumio); insurance verification (Verisk)
- [ ] Gate 3 (medium cost, post-qualification): police report (LexisNexis/CrashDocs) — PI only
- [ ] Gate 4 (post-retainer): medical records request (Ciox/Datavant) — PI only
- [ ] Connector framework: pluggable provider adapters (user picks provider per category)
- [ ] Per-lead cost cap enforcement; monthly budget alerts
- [ ] Quality score threshold per gate (configurable)
- [ ] Outbound campaigns: Athena Campaigns API, unsigned retainer follow-up, missed appointment re-engage

---

## 9. Technical Architecture

### 9.1 Monorepo Structure

```
legal-concierge/
├── apps/
│   ├── api/                    # Node.js/Fastify — Google Cloud Run
│   │   ├── src/
│   │   │   ├── routes/         # Express/Fastify route handlers
│   │   │   ├── services/       # Business logic services
│   │   │   │   ├── intake/     # IntakeOrchestrator, TemplateEngine, QualificationEngine
│   │   │   │   ├── ghl/        # GHL integration service
│   │   │   │   ├── athena/     # Athena integration service
│   │   │   │   ├── esign/      # E-sign service (pluggable: HelloSign, DocuSign)
│   │   │   │   ├── booking/    # BookingOrchestrator
│   │   │   │   └── retainer/   # RetainerOrchestrator
│   │   │   ├── webhooks/       # Webhook receivers: /webhooks/athena/*, /webhooks/ghl/*, /webhooks/esign/*
│   │   │   ├── middleware/     # Auth, tenant resolution, rate limiting
│   │   │   └── db/             # Query layer (Drizzle ORM)
│   │   └── Dockerfile
│   │
│   ├── web/                    # Next.js 15 — admin portal (Cloud Run or Vercel)
│   │   ├── app/                # App Router
│   │   │   ├── (admin)/        # Admin portal: firm management, analytics
│   │   │   └── (onboarding)/   # Firm onboarding wizard
│   │   └── Dockerfile
│   │
│   ├── widget-sdk/             # Standalone <script> loader (vanilla TypeScript, ~2KB)
│   │   ├── src/
│   │   │   ├── loader.ts       # The 2KB loader: reads data-*, creates iframe, postMessage bridge
│   │   │   └── widget/         # Widget app inside iframe (Preact, ~100-150KB gzip)
│   │   │       ├── components/
│   │   │       │   ├── Launcher.tsx        # Bubble (desktop) / bar (mobile)
│   │   │       │   ├── Panel.tsx           # Expanding panel with voice/text
│   │   │       │   ├── TranscriptView.tsx  # Real-time transcript display
│   │   │       │   ├── MilestoneBar.tsx    # Progress bar (template-driven)
│   │   │       │   ├── VoiceControls.tsx   # Mic button, waveform, speaking indicator
│   │   │       │   ├── SlotPicker.tsx      # 3 calendar slots
│   │   │       │   └── RetainerStatus.tsx  # Retainer dispatched / signed confirmation
│   │   │       └── hooks/
│   │   │           ├── useAthenaSession.ts # WebRTC voice session via Athena SDK
│   │   │           ├── useMilestones.ts    # SSE subscription for milestone events
│   │   │           └── useTranscript.ts    # SSE subscription for real-time transcript
│   │   └── vite.config.ts
│   │
│   └── mobile/                 # React Native (Expo)
│
├── packages/
│   ├── shared-types/           # TypeScript interfaces: Firm, Lead, Template, Milestone, etc.
│   ├── ghl-client/             # Typed GHL API client
│   ├── athena-client/          # Typed Athena API client
│   ├── esign-client/           # Pluggable e-sign interface (HelloSign, DocuSign adapters)
│   ├── template-engine/        # Template loader, validator, executor
│   └── db/                     # Drizzle ORM schema + migrations (PostgreSQL)
│
├── infrastructure/
│   ├── terraform/              # Cloud Run, Cloud SQL, Redis, Secret Manager, GCS
│   └── docker/                 # Dockerfiles per app
│
├── turbo.json
└── package.json
```

### 9.2 Technology Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Widget loader | Vanilla TypeScript (IIFE) | No framework = 2KB loader; iframe isolates widget from host page |
| Widget UI | Preact (~3KB) + TypeScript | Preact core is 3KB vs React's 40–50KB; React-compatible API |
| Admin portal | Next.js 15 (App Router) | SSR for law firm marketing pages (SEO); Server Actions for admin forms |
| API | Node.js + Fastify | Fast, lightweight, TypeScript-native |
| ORM | Drizzle ORM | TypeScript-first, excellent PostgreSQL support, no runtime overhead |
| Database | PostgreSQL (Cloud SQL) | Relational integrity for multi-tenant data; Row-level Security |
| Cache / PubSub | Redis (Cloud Memorystore) | Session state, milestone event bus (namespaced per session) |
| Real-time (server→client) | Server-Sent Events (SSE) + Redis pub-sub | Replaces WebSocket; proxy-friendly; auto-reconnect; scales horizontally |
| Voice AI | Athena (ConnexUS AI Platform) | Owned platform; WebRTC; configurable voice/LLM; Campaigns API for outbound |
| CRM | GoHighLevel API v2 | Multi-location; full lifecycle (contacts, pipeline, calendar, SMS, workflows) |
| E-signature | HelloSign (default) / DocuSign | ESIGN Act compliant; established audit trail; consumer trust |
| Storage | Google Cloud Storage | Retainer PDFs, media assets, KB documents |
| Secrets | Google Secret Manager | API keys, OAuth tokens per firm |
| Compute | Google Cloud Run | Already proven for Donovan Law; auto-scaling; containerized |
| CI/CD | Cloud Build | Already configured for Donovan Law deployment |
| Monorepo | Turborepo | Shared types, unified CI, independent deployability |

### 9.3 Real-Time Architecture

**Why SSE over WebSocket:**

AdvisoryConnect's current WebSocket implementation has known issues: `ws://` URL hardcoded (breaks behind HTTPS reverse proxy); global channel (all users share events — security bug); sticky session requirement for horizontal scaling.

The replacement pattern:

```
Athena webhook fires call.tool_called
     ↓
/webhooks/athena/tool-call handler
     ↓
Redis PUBLISH milestone:{firm_id}:{call_id} {payload}
     ↓
GET /api/v1/sessions/{call_id}/events (SSE endpoint — one per active session)
     ↓  (server holds connection; reads from Redis channel)
Widget iframe receives event → updates TranscriptView and MilestoneBar
```

SSE advantages over WebSocket for this use case:
- Works through all HTTP/2 proxies and CDNs
- Automatic reconnect built into `EventSource` API
- Unidirectional (server → client) — milestone and transcript events are server-originated
- Browser-to-server communication (user selections) uses standard HTTP POST — clean separation
- Scales horizontally: any Cloud Run instance serves any SSE connection via shared Redis

### 9.4 Widget Security

The widget iframe loads from `https://widget.legalconcierge.ai`. The host page (the law firm's website) cannot access the iframe's internal state — no XSS attack surface against conversation data.

**iframe attributes:**
```html
<iframe
  src="https://widget.legalconcierge.ai/app?firm={firm_id}&session={session_id}"
  allow="microphone; autoplay; clipboard-write"
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms allow-popups-to-escape-sandbox"
  referrerpolicy="no-referrer-when-downgrade"
></iframe>
```

**postMessage security:** Origin validation on both sides. Widget only accepts messages from `https://widget.legalconcierge.ai`. Host page only accepts messages from `https://widget.legalconcierge.ai`.

**CSP headers (served from widget origin):**
```
Content-Security-Policy:
  default-src 'self' https://api.legalconcierge.ai;
  script-src 'self' 'nonce-{RANDOM}';
  connect-src https://api.legalconcierge.ai wss://realtime.legalconcierge.ai;
  media-src blob:;
  microphone 'self';
```

### 9.5 API Reference Quick Guide

| Integration | Base URL | Auth | Version |
|------------|---------|------|---------|
| Athena | `https://[connexus-domain]/api/v1` | `X-API-Key: sk_live_...` | — |
| GoHighLevel | `https://services.leadconnectorhq.com/` | `Authorization: Bearer {token}` | `Version: 2021-07-28` |
| HelloSign | `https://api.hellosign.com/v3` | `Authorization: Basic {base64(key:)}` | — |
| DocuSign | `https://[account].docusign.net/restapi/v2.1` | `Authorization: Bearer {token}` | — |

### 9.6 Environment Variables Reference

```bash
# Athena Platform
ATHENA_BASE_URL=https://your-connexus-domain/api/v1
ATHENA_API_KEY=sk_live_...
ATHENA_WEBHOOK_SECRET=whsec_...

# GoHighLevel
GHL_CLIENT_ID=...
GHL_CLIENT_SECRET=...
GHL_AGENCY_TOKEN=...         # Agency-level private token (for Location creation)

# Database
DATABASE_URL=postgresql://user:pass@host:5432/legal_concierge
REDIS_URL=redis://host:6379

# E-Signature
HELLOSIGN_API_KEY=...
DOCUSIGN_ACCOUNT_ID=...      # if DocuSign used
DOCUSIGN_INTEGRATION_KEY=...

# Storage
GCS_BUCKET=legal-concierge-docs
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json

# Webhook secrets
GHL_WEBHOOK_SECRET=...       # Ed25519 public key for X-GHL-Signature

# Application
NODE_ENV=production
PORT=8080
WIDGET_ORIGIN=https://widget.legalconcierge.ai
ALLOWED_ORIGINS=https://donovanlegalpllc.com,https://admin.legalconcierge.ai

# Secret Manager (production — values stored in GCP)
SECRET_MANAGER_PROJECT=your-gcp-project-id
```

---

## 10. Data Model

### 10.1 Core Tables

```sql
-- =====================
-- TENANT LAYER
-- =====================

CREATE TABLE firms (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              VARCHAR(255) NOT NULL,
  slug              VARCHAR(100) UNIQUE NOT NULL,  -- used in widget embed
  ghl_location_id   VARCHAR(100) UNIQUE,
  athena_org_id     VARCHAR(100),
  stripe_customer_id VARCHAR(100),
  active            BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE firm_config (
  firm_id               UUID PRIMARY KEY REFERENCES firms(id) ON DELETE CASCADE,
  practice_areas        TEXT[] NOT NULL,              -- ['real_estate','business_law','taxation']
  active_states         TEXT[],                       -- ['TX','FL'] or null = all states
  concierge_name        VARCHAR(100) DEFAULT 'Your Legal Concierge',
  concierge_persona     VARCHAR(50) DEFAULT 'professional',
  concierge_language    VARCHAR(10) DEFAULT 'en',
  athena_assistant_id   VARCHAR(100),
  athena_kb_id          VARCHAR(100),
  ghl_pipeline_id       VARCHAR(100),
  calendar_ids          JSONB DEFAULT '{}',           -- { "attorney_id": { "practice_area": "cal_id" } }
  esign_provider        VARCHAR(50) DEFAULT 'hellosign',
  esign_api_key_ref     VARCHAR(255),                 -- Secret Manager path
  widget_config         JSONB DEFAULT '{}',           -- position, colors, cta_text, allowed_domains
  verification_config   JSONB DEFAULT '{}',           -- gate thresholds, cost caps
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE attorneys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID REFERENCES firms(id) ON DELETE CASCADE,
  name            VARCHAR(255) NOT NULL,
  photo_url       TEXT,
  bio             TEXT,
  ghl_user_id     VARCHAR(100),
  calendar_id     VARCHAR(100),
  practice_areas  TEXT[] NOT NULL DEFAULT '{}',
  active_states   TEXT[],
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- TEMPLATE LAYER
-- =====================

CREATE TABLE intake_templates (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID REFERENCES firms(id),          -- NULL = global template (shared library)
  practice_area   VARCHAR(100) NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  display_name    VARCHAR(255) NOT NULL,
  template_data   JSONB NOT NULL,                     -- full template JSON (stages, milestones, scoring, etc.)
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE retainer_templates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id           UUID REFERENCES firms(id),
  practice_area     VARCHAR(100) NOT NULL,
  state_code        CHAR(2),                          -- NULL = any state
  attorney_id       UUID REFERENCES attorneys(id),    -- NULL = any attorney
  esign_provider    VARCHAR(50) NOT NULL,
  esign_template_id VARCHAR(255) NOT NULL,
  version           INTEGER NOT NULL DEFAULT 1,
  active            BOOLEAN DEFAULT TRUE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- SESSION + LEAD LAYER
-- =====================

CREATE TABLE intake_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id         UUID REFERENCES firms(id),
  athena_call_id  VARCHAR(255) UNIQUE,
  channel         VARCHAR(20) NOT NULL CHECK (channel IN ('voice','chat','mobile','phone')),
  status          VARCHAR(50) DEFAULT 'active'
                    CHECK (status IN ('active','completed','abandoned','error')),
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  ended_at        TIMESTAMPTZ,
  source_url      TEXT,                               -- URL of page where widget was opened
  source_page     VARCHAR(255)                        -- slug of page (e.g., 'real-estate')
);

CREATE TABLE leads (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firm_id               UUID REFERENCES firms(id),
  session_id            UUID REFERENCES intake_sessions(id),
  attorney_id           UUID REFERENCES attorneys(id),
  -- Contact
  first_name            VARCHAR(255),
  last_name             VARCHAR(255),
  phone                 VARCHAR(30),
  email                 VARCHAR(255),
  sms_consent           BOOLEAN DEFAULT FALSE,
  sms_consent_timestamp TIMESTAMPTZ,
  timezone              VARCHAR(100),
  -- Qualification
  practice_area         VARCHAR(100),
  template_id           UUID REFERENCES intake_templates(id),
  qualification_data    JSONB DEFAULT '{}',           -- all captured variables
  qualification_score   SMALLINT,
  qualification_status  VARCHAR(50) DEFAULT 'in_progress'
                          CHECK (qualification_status IN ('in_progress','qualified','disqualified','escalated','resource_mode')),
  disqualify_reason     TEXT,
  urgency_flags         TEXT[],
  -- GHL
  ghl_contact_id        VARCHAR(100),
  ghl_opportunity_id    VARCHAR(100),
  -- E-sign
  esign_envelope_id     VARCHAR(255),
  esign_status          VARCHAR(50) DEFAULT 'not_sent'
                          CHECK (esign_status IN ('not_sent','sent','signed','expired','declined')),
  retainer_sent_at      TIMESTAMPTZ,
  retainer_signed_at    TIMESTAMPTZ,
  retainer_url          TEXT,                         -- GCS path to signed PDF
  -- Appointment
  appointment_id        VARCHAR(100),                 -- GHL event ID
  appointment_time      TIMESTAMPTZ,
  -- Timestamps
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE milestones (
  id            BIGSERIAL PRIMARY KEY,
  session_id    UUID REFERENCES intake_sessions(id),
  firm_id       UUID REFERENCES firms(id),
  milestone_idx SMALLINT NOT NULL,
  milestone_label VARCHAR(100),
  stage_id      VARCHAR(100),
  completed_at  TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- BOOKING LAYER
-- =====================

CREATE TABLE calendar_bookings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id           UUID REFERENCES leads(id),
  firm_id           UUID REFERENCES firms(id),
  attorney_id       UUID REFERENCES attorneys(id),
  ghl_event_id      VARCHAR(100),
  ghl_calendar_id   VARCHAR(100),
  start_time        TIMESTAMPTZ NOT NULL,
  end_time          TIMESTAMPTZ NOT NULL,
  status            VARCHAR(50) DEFAULT 'confirmed',
  confirmation_sent BOOLEAN DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- =====================
-- AUDIT LAYER (append-only — no UPDATE or DELETE)
-- =====================

CREATE TABLE audit_log (
  id              BIGSERIAL PRIMARY KEY,
  event_type      VARCHAR(100) NOT NULL,
  -- e.g.: 'session_created', 'milestone_completed', 'lead_qualified', 'lead_disqualified',
  --       'ghl_contact_created', 'retainer_sent', 'retainer_signed', 'booking_created',
  --       'conflict_check_passed', 'sol_calculated'
  lead_id         UUID,
  firm_id         UUID NOT NULL,
  session_id      UUID,
  actor           VARCHAR(255),                       -- 'system', 'athena', 'attorney:{id}', 'lead:{id}'
  event_data      JSONB NOT NULL,                     -- full context
  ip_address      INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW()
  -- NO UPDATE or DELETE ever issued against this table
  -- Enforced via: DB trigger + application constraint + monitored alert
);

-- Enforcement trigger
CREATE OR REPLACE FUNCTION audit_log_immutable()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is immutable — updates and deletes are not permitted';
END;
$$;

CREATE TRIGGER enforce_audit_immutability
  BEFORE UPDATE OR DELETE ON audit_log
  FOR EACH ROW EXECUTE FUNCTION audit_log_immutable();

-- =====================
-- INDEXES
-- =====================

CREATE INDEX idx_leads_firm_id ON leads(firm_id);
CREATE INDEX idx_leads_ghl_contact ON leads(ghl_contact_id);
CREATE INDEX idx_leads_esign_envelope ON leads(esign_envelope_id);
CREATE INDEX idx_leads_created_at ON leads(created_at DESC);
CREATE INDEX idx_sessions_firm_id ON intake_sessions(firm_id);
CREATE INDEX idx_sessions_athena_call ON intake_sessions(athena_call_id);
CREATE INDEX idx_milestones_session ON milestones(session_id);
CREATE INDEX idx_audit_log_firm_lead ON audit_log(firm_id, lead_id);
CREATE INDEX idx_audit_log_created ON audit_log(created_at DESC);
```

### 10.2 Entity Relationships

```
firms
  └── firm_config (1:1)
  └── attorneys[] (1:many)
  └── intake_templates[] (1:many — overrides global templates)
  └── retainer_templates[] (1:many)
  └── intake_sessions[] (1:many)
      └── leads[] (1:many — typically 1:1 per session)
          └── milestones[] (1:many)
          └── calendar_bookings[] (1:many — typically 1:1)
  └── audit_log[] (1:many)
```

### 10.3 Key Design Decisions

1. **`qualification_data JSONB`** — stores all practice-area-specific variables. The schema is open — any template can add any variables. The application stores whatever the template extracts. Avoids rigid per-practice-area columns.

2. **`intake_templates.template_data JSONB`** — the full template JSON lives in the database. Firms can override global templates. New templates can be loaded without code deploys.

3. **Audit log trigger** — enforces immutability at the database level, not just the application level. A compromised application layer cannot delete audit records.

4. **`sms_consent_timestamp`** — TCPA compliance requires logging exactly when consent was given. The field stores the timestamp of the agent's TCPA disclosure question.

5. **`retainer_templates.attorney_id` nullable** — allows firm-wide templates (no attorney specified) as fallbacks, while supporting attorney-specific templates where applicable.

---

## 11. Pricing Strategy

### 11.1 Pricing Philosophy

The goal is to replace what firms already pay — not add a new line item. A solo firm currently spending $245–$425/month on a human answering service plus $89–$149/month on a basic CRM is spending $334–$574/month for less capability. Legal Concierge should slot in at or below that range for the Starter tier while delivering dramatically more value.

Pricing comparison framework:

| What firms pay today | Monthly cost | What they get |
|---------------------|-------------|---------------|
| Ruby Receptionists (Starter) | $245 | 50 minutes of human answering |
| Answering Legal (100 min) | $330 | 100 minutes of human legal intake |
| Smith.ai (AI, 30 calls) | $97.50 | 30 AI-handled calls |
| Clio Grow (1 user) | $59 | CRM + forms (no voice) |
| **Ruby + Clio Grow combined** | **$304** | Human answering + basic CRM |
| **Legal Concierge Starter** | **$199** | Unlimited AI intake + retainer + booking + CRM |

### 11.2 Pricing Tiers

#### Starter — $199/month
**Target:** Solo practitioners, 1–2 practice areas, low-to-medium volume

Includes:
- 1 law firm (1 tenant)
- Up to 2 practice areas configured
- Unlimited intake conversations
- Real-time transcript + milestone tracker
- GHL CRM integration (contact + pipeline creation)
- Calendar booking (via GHL or Gmail)
- E-signature retainer dispatch (HelloSign, up to 30 envelopes/month — typically sufficient for 10–20 qualified leads/month)
- Standard practice area templates (from library)
- Email + SMS confirmation sequences
- Basic analytics dashboard
- Email support

Not included: Admin self-service portal (concierge-assisted onboarding), verification pipeline, mobile app, custom branding beyond basic colors/name.

---

#### Professional — $399/month
**Target:** Small-to-mid firms, 2–5 attorneys, multiple practice areas, steady volume

Includes everything in Starter, plus:
- Up to 5 attorneys configured
- Unlimited practice areas
- HelloSign envelopes up to 100/month
- Multi-language support (Spanish + English)
- Custom qualification question overrides per practice area
- Attorney-specific calendar routing
- Full analytics: qualification rate, retainer conversion, booking rate, attorney utilization
- GHL workflow automation (pre-built workflows included)
- Priority email + chat support
- Admin portal access (self-service configuration)
- Outbound follow-up campaigns (unsigned retainer at 4h/24h/72h via Athena)

---

#### Enterprise — $799/month (or custom)
**Target:** Multi-location firms, high-volume PI/personal injury practices, legal marketing agencies

Includes everything in Professional, plus:
- Unlimited attorneys and locations
- Unlimited HelloSign envelopes (or DocuSign integration)
- Custom intake template development (Engineering-assisted)
- Verification pipeline (Gate 1–3): ID verification, insurance verification, police reports (API costs passed through at cost)
- White-label widget (firm's branding on widget, no "Legal Concierge" branding)
- Dedicated Slack channel support
- SLA: 99.9% uptime; < 2-hour response for critical issues
- API access for custom integrations
- Multi-GHL agency account support
- Custom analytics and reporting exports
- GDPR/CCPA data deletion flow

---

#### Comparison to Current Spend

| Firm Profile | Current Monthly Spend | Legal Concierge Tier | Savings |
|-------------|----------------------|---------------------|---------|
| Solo, 1 practice area | $330–$600 (answering service + CRM) | Starter: $199 | $131–$401/mo |
| Small firm (2–5 atty) | $800–$2,000 (answering + CRM + chatbot) | Professional: $399 | $401–$1,601/mo |
| Mid-size / PI firm | $2,000–$6,000 | Enterprise: $799 | $1,201–$5,201/mo |

### 11.3 Implementation Cost Notes

**Add-on costs passed through at cost (not marked up):**
- HelloSign platform fee (~$15/month) included in Starter/Professional
- Verification API costs (Gate 2–4): charged to firm at provider cost with 0% markup — competitive differentiator vs. verification platforms that mark up 100–300%
- Athena usage (per-minute voice AI) is absorbed in platform pricing at target volumes; excess usage for very high-volume firms billed separately

**First client discount for Donovan Legal PLLC:**
Paul Donovan is the first production deployment. He receives the Professional tier at $0 for the first 60 days (while the platform is in active development and testing). After 60 days, $199/month (Starter rate) until the platform reaches general availability.

### 11.4 Revenue Model

**SaaS subscription (primary):** Flat monthly per-firm. Predictable ARR. Scales with firm acquisition, not call volume.

**Usage overage (secondary):** E-signature envelopes above plan limit ($2/envelope for HelloSign, $3/envelope if DocuSign). Very high-volume voice usage (>1,000 calls/month) triggers a usage tier.

**Implementation fee (optional):** $500 white-glove onboarding for firms that want engineering assistance with custom templates, complex GHL setup, or retainer template review. Not required — most firms self-serve after Phase 6.

**Revenue projection:**

| Scenario | Firms | Avg MRR/Firm | Monthly Revenue | ARR |
|----------|-------|-------------|-----------------|-----|
| MVP (1–2 clients) | 2 | $250 | $500 | $6,000 |
| Early traction (6 mo) | 25 | $300 | $7,500 | $90,000 |
| Growth (12 mo) | 100 | $350 | $35,000 | $420,000 |
| Scale (24 mo) | 500 | $400 | $200,000 | $2,400,000 |
| Target (36 mo) | 1,750 | $399 | $698,250 | $8,379,000 |

At 1,750 firms (1% of U.S. small-to-mid law firms), ARR exceeds $8.3M. The legal AI software segment is growing at 32.4% CAGR. A 1% market capture by month 36 is conservative given the structural advantages.

---

## Appendix A: Full Data Flow — Lifecycle of a Qualified Lead

```
Visitor lands on law firm website (e.g., donovanlegalpllc.com/real-estate)
  │
  ▼
[1] Widget loader.js (2KB) loads asynchronously
    │ Reads: data-firm="donovan-law", data-practice-area="real_estate"
    │
    ▼
[2] Visitor clicks widget CTA
    │
    ▼
[3] POST /api/v1/sessions/create
    │ body: { firm_id: "donovan-law", channel: "voice", source_url, practice_area_hint: "real_estate" }
    │ Response: { session_id, access_token, assistant_id }
    │
    ▼
[4] Widget opens iframe panel; initializes Athena WebRTC session
    │ SSE subscription: GET /api/v1/sessions/{session_id}/events
    │
    ▼
[5] AI conversation begins — Alex conducts intake
    │ Template: real_estate_v1 loaded from firm KB
    │ Each stage completion → Athena fires log_milestone webhook
    │
    ▼
[6] Webhook: POST /webhooks/athena/tool-call
    │ → Redis PUBLISH session:{firm_id}:{call_id}:milestone
    │ → SSE delivers to widget → MilestoneBar advances
    │ → qualification_data updated incrementally
    │
    ▼
[7] Qualification complete (score ≥ threshold)
    │
    ▼
[8] POST /api/v1/leads (lead record created in PostgreSQL)
    │
    ▼
[9] PARALLEL DISPATCH (concurrent):
    │
    ├── [9a] GHL: POST /contacts/ → contact_xxx created
    │         GHL: POST /opportunities → opportunity in "Qualified" stage
    │         GHL: POST /contacts/{id}/workflow/{new_lead_alert} → Paul gets SMS/email
    │
    ├── [9b] RetainerOrchestrator:
    │         selectRetainerTemplate(firm_id, "real_estate", "TX", paul_donovan_id)
    │         HelloSign: createEnvelope(template_id, lead_data)
    │         GHL: POST /conversations/messages (SMS with signing link)
    │         Target: <60 seconds from qualification to SMS delivery
    │
    └── [9c] BookingOrchestrator:
              GHL: GET /calendars/cal_donovan_re/free-slots (next 7 days, caller's TZ)
              Returns 3 options to Athena agent (via tool response)
              Agent presents options verbally
              Caller: "I'll take Wednesday at 10am"
              Athena fires confirm_booking tool
              GHL: POST /calendars/events/appointments
              GHL: POST /conversations/messages (confirmation SMS)
              Pipeline stage → "Appointment Booked"
    │
    ▼
[10] audit_log entry written (immutable):
     event_type: 'lead_qualified', all qualification data, session_id, timestamps
    │
    ▼
[11] Lead receives:
     - In-widget: "Your retainer agreement has been sent to your phone and email."
     - SMS: "Your retainer from Donovan Legal is ready. Sign here: [link]"
     - SMS: "Your consultation with Paul Donovan is confirmed for April 8 at 10:00 AM CT."
    │
    ▼
[12] Lead signs retainer (HelloSign UI)
    │
    ▼
[13] Webhook: POST /webhooks/esign/completed
     │ → lead.esign_status = 'signed'
     │ → retainer PDF → GCS
     │ → GHL pipeline → "Retainer Signed"
     │ → GHL: removeFromWorkflow(retainer_followup)
     │ → GHL: addToWorkflow(attorney_notification)
     │ → audit_log: 'retainer_signed' (signer IP, timestamp, document hash)
     │
     ▼
[14] Paul receives notification with signed retainer attached
     Case is ready to work.
```

---

## Appendix B: Statute of Limitations Quick Reference

| Practice Area | Key Deadlines |
|--------------|---------------|
| Personal Injury | 2–3 years (state-dependent); 45–180 days for government entities |
| Family Law | No strict SOL for divorce; separation date matters |
| Criminal Defense | Arraignment within 48–72 hours; DMV hearing: 10 days (CA); speedy trial: ~70 days federal |
| Immigration | Asylum: 1 year from entry; motion to reopen: 90 days; bond: 5 days from detention |
| Real Estate | Contract to closing: typically 30–60 days; eviction notice: 3–30 days |
| Business Law | Contract disputes: 4–6 years (state-dependent) |
| Estate Planning | No SOL for creation; probate creditor period: 3–6 months from death notice |
| Bankruptcy | Prior Chapter 7: wait 8 years; Chapter 13: wait 4 years before Chapter 7 |
| Employment (EEOC) | 180/300 days to file EEOC charge; 90 days from right-to-sue to file |
| Tax (IRS) | CDP hearing: 30 days; Tax Court petition: 90 days; IRS audit window: 3–6 years |

---

*Document Version 2.0 — April 7, 2026*  
*Source files: legal-concierge-strategy.md (v1), law-firm-intake-research.md, legal-tech-widget-research.md, advisoryconnect-analysis.md, external-research.md, RAGbrain_Legal_Intake_Module_Plan.md*  
*All statistics, API endpoints, and pricing data sourced from primary research compiled April 7, 2026.*
