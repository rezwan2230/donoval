# RAGbrain Legal Intake Module
### Complete Product Blueprint — From Concept to Delivery

---

## The Problem Today

The legal lead industry is broken by too many hands in the chain:

```
Marketing Agency → Landing Page → Form Fill → Lead Aggregator →
Outbound Call Center → Qualifier → Manual Data Entry → Buyer →
Their Staff Re-Verifies → Back-and-forth Calls → Maybe Signs →
Attorney Finally Starts Working the Case
```

Every handoff loses time, loses data quality, and loses profit. Outbound calling is increasingly restricted by TCPA and state regulations. Leads go cold because callbacks fail. Attorneys receive incomplete packages and spend staff hours chasing paperwork.

## The Solution

RAGbrain Legal Intake collapses the entire chain into a single, governed system:

```
RAGbrain Landing Page → Widget Qualifies Live (Inbound) →
Auto-Verifies Records → E-Signature Retainer → Attorney Gets Complete Package
```

No outbound calls. No middlemen. No manual data entry. Full compliance audit trail.

---

## Module Structure — Building Blocks

### Block 1: Landing Page & Marketing Engine

**What it does:** Gives the user a ready-to-launch, compliant marketing presence for any tort category.

**How it works:**
- User selects a tort template from a library (MVA, Slip & Fall, Workers Comp, Roundup, AFFF, Talcum, Rideshare, Hair Relaxer, Ozempic, NEC, etc.)
- Each template is pre-built with SEO-optimized structure, compliant copy, and proper legal disclaimers for the selected states
- User customizes by filling in fields — firm name, phone number, active states, practice areas — no design work, no coding
- The widget (vRep) is automatically embedded on the page
- Multiple landing pages can run simultaneously for different tort categories
- Pages are hosted and managed within the module (or embeddable on the user's existing site)

**State compliance layer:** Each template carries built-in advertising disclosures and disclaimer language required by the active states selected. When the user toggles a state on, the correct legal language is automatically applied.

---

### Block 2: vRep Configuration (The Widget)

**What it does:** Lets the user configure their virtual representative without any prompt engineering or technical knowledge.

**How it works:**
- User sets basic business info: company name, hours of operation, active states, active tort categories
- User selects qualification questions from a pre-built question library (organized by tort type)
- User toggles which documents are required vs. optional (police report, medical records, photos, insurance info)
- User sets disqualification rules ("if already represented → end conversation," "if statute expired → end conversation")
- User chooses vRep name, personality tone (professional, empathetic, direct), and language preferences
- All configuration is dropdown/toggle/text input — no prompt writing

**What the user does NOT do:** Write prompts, design conversation flows, code anything, or configure AI behavior. The module handles all of that behind the scenes based on their selections.

**Voice & AI engine:** The module leverages RAGbox's existing dual-LLM and agent infrastructure. The vRep's conversational intelligence runs on the same engine that powers RAGbox/RAGbrain — no separate AI stack required. If a user's deployment requires extended voice capabilities (custom voice profiles, multilingual support, advanced telephony), the module can optionally connect to Athena via API. But the default path is RAGbox-native — everything runs within the platform the user already has.

**Guardrails (hard-coded, not configurable):**
- Never guarantees outcomes or case results
- Never provides legal advice
- Never engages with currently represented callers beyond a polite redirect
- Always discloses that this is an AI-assisted intake system
- Complies with bar advertising rules for all active states
- All conversations are recorded and stored with immutable audit trail

---

### Block 3: Live Qualification Engine

**What it does:** When a visitor engages the widget, the RAGbrain conducts a structured qualification conversation in real time.

**The qualification flow:**

**Step 1 — Incident Basics**
- What happened? (accident type, circumstances)
- When did it happen? (date — triggers statute of limitations check)
- Where did it happen? (jurisdiction — determines which state rules apply)

**Step 2 — Injury & Impact**
- What injuries were sustained?
- Was medical treatment received? Where? Ongoing?
- Impact on daily life / work?

**Step 3 — Eligibility Screening**
- Do you currently have an attorney for this matter? (hard stop if yes)
- Have you previously filed a claim? (flag for review)
- Statute of limitations check (auto-calculated from incident date + jurisdiction)

**Step 4 — Evidence & Documentation Gathering**
- Do you have a police report? (if applicable)
- Do you have medical records or bills?
- Do you have photos of the accident/injuries?
- Insurance information (yours and/or other party's)

**Step 5 — Quality Scoring**
- Based on all answers, the brain scores the lead against the buyer's specific criteria
- Score determines routing: Tier 1 (premium), Tier 2 (standard), Tier 3 (marginal), or Disqualified

**During the call (parallel processing):** While the conversation continues, the system begins background verification on information already provided (see Block 4). This eliminates the callback problem — verification starts immediately, not after the call ends.

---

### Block 4: Verification Pipeline

**What it does:** Automatically verifies the caller's information through third-party services — but only when the right data has been collected and only after the lead has passed enough qualification gates to justify the cost.

**The core problem:** Every API call to a verification provider costs money. Pulling a police report on someone who disqualifies two questions later is money burned. The module must be intelligent about *when* it fires each verification — not the moment it has a name and a phone number, but at the right point in the qualification flow.

---

#### 4A: Verification Trigger Logic — When Does Each Check Fire?

The verification pipeline is organized into **trigger gates**. Each verification type has a minimum data requirement and a qualification threshold that must be met before the API call fires. The user configures these thresholds during setup.

**Gate 1 — Free / Built-In Checks (fire immediately, zero cost)**

| Check | Minimum Data Needed | When It Fires | Cost |
|---|---|---|---|
| Duplicate Check | Name + phone or email | As soon as the caller provides contact info (first 30 seconds) | $0 — internal database |
| Conflict Check | Name + incident details | As soon as incident is described (first 1-2 minutes) | $0 — internal database |
| Statute of Limitations | Incident date + state | As soon as jurisdiction is established | $0 — built-in calculation |

**Purpose:** Kill bad leads early before any money is spent. If the caller is a duplicate, has a conflict, or is time-barred — the conversation ends gracefully before a single paid API call fires.

**Gate 2 — Low-Cost Checks (fire after basic qualification passes)**

| Check | Minimum Data Needed | When It Fires | Typical Cost Per Call | What You Get |
|---|---|---|---|---|
| Identity Verification (basic) | Full name + DOB or last 4 SSN | After Gate 1 passes AND caller answers injury/impact questions | $0.50 – $2.00 | Name/DOB match confirmation, fraud flag |
| Insurance Verification | Caller's insurance info or other party's | After Gate 1 passes AND caller provides insurance details | $1.00 – $5.00 | Policy active/inactive, coverage type, carrier |

**Purpose:** Confirm the person is real and there's insurance to go after. These are cheap enough to run on most qualified leads. If ID fails, stop — no point pulling expensive reports on a fake identity.

**Gate 3 — Medium-Cost Checks (fire only after lead is fully qualified)**

| Check | Minimum Data Needed | When It Fires | Typical Cost Per Call | What You Get |
|---|---|---|---|---|
| Police Report Pull | Incident date + location + parties involved | After full qualification is complete AND quality score meets threshold | $10 – $35 per report | Official accident report, fault determination, citations, witness info |
| DMV / Driving Record | Full name + DOB + state | After full qualification (MVA cases only) | $5 – $15 | Driving history, prior accidents, license status |

**Purpose:** These cost real money. Only fire them when the lead has passed all qualification questions, scored above the user's quality threshold, and is genuinely heading toward a retainer. The user sets the quality score threshold that triggers these — e.g., "only pull police reports on leads scoring 7/10 or higher."

**Gate 4 — High-Cost / Slow Checks (fire after retainer is signed, or on-demand)**

| Check | Minimum Data Needed | When It Fires | Typical Cost Per Call | What You Get |
|---|---|---|---|---|
| Medical Records Request | Provider name + patient info + signed authorization | After retainer is signed (authorization is in the retainer) | $25 – $75+ per request | Treatment records, bills, diagnosis, prognosis |
| Comprehensive Background | Full name + DOB + SSN | On-demand only (user manually triggers) | $15 – $50 | Full background, prior claims history, litigation history |

**Purpose:** These are expensive and slow. Medical records require signed authorization (which comes from the retainer), so they physically cannot run before the retainer is signed. Background checks are optional and typically only needed for high-value cases. These should never auto-fire — the user or the system triggers them only when justified.

---

#### 4B: Cost Control — User Configuration

The module gives users full control over verification spending:

**Per-lead cost cap:** User sets a maximum verification spend per lead (e.g., "$20 max per lead"). If Gate 2 checks cost $3 and a police report would push the total to $38, the system pauses and asks: "Police report pull would exceed your $20 cap. Proceed or skip?"

**Quality score threshold per gate:** User defines which quality score unlocks each gate. Example:
- Gate 2 (ID + insurance): fires on any lead scoring 4/10 or higher
- Gate 3 (police report): fires only on leads scoring 7/10 or higher
- Gate 4 (medical records): manual trigger only, regardless of score

**Tort-type overrides:** Different case types justify different verification spend. An MVA case worth $5,000–$50,000+ in fees justifies a $35 police report pull. A minor slip-and-fall might not. Users can set different thresholds per tort category.

**Monthly spend alerts:** Dashboard shows total verification API costs month-to-date, broken down by check type and by provider. Alert when approaching a user-defined monthly budget.

---

#### 4C: Verification Timing — What Happens During vs. After the Call

| Phase | What Runs | Why |
|---|---|---|
| **During the call (first 2 min)** | Duplicate + Conflict + Statute check | Free, instant, kills bad leads before any cost |
| **During the call (after qualification)** | ID verification + Insurance check | Cheap, fast, confirms the lead is real while they're still on the line |
| **Immediately after call ends** | Police report pull (if threshold met) | Costs money but caller doesn't need to wait — results arrive in minutes |
| **After retainer is signed** | Medical records request | Requires signed authorization, expensive, slow — but the deal is already locked |
| **On-demand (manual)** | Background check, additional searches | Only when the user decides the case justifies the spend |

**The principle remains:** Never hold up the retainer waiting for slow/expensive checks. The retainer can go out with ID verified + insurance confirmed. Police report and medical records attach to the lead package as they arrive. The attorney gets a package that builds itself — starting complete enough to act on, growing more comprehensive over time.

---

#### 4D: Verification Connector Framework

The module does NOT lock users into specific verification vendors. Every office, firm, and brokerage already has systems they use and trust. The module provides a **connector marketplace** — the user picks their preferred provider for each verification type, enters their API credentials, and the module handles the rest.

**How connectors work for the user:**
- During setup, the user sees a list of verification categories
- For each category, they either select from known providers (dropdown) or enter a custom API endpoint
- They paste in their API key / credentials for that provider
- The module tests the connection and confirms it's live
- If a user doesn't have a provider for a certain category, they skip it — that verification simply doesn't run, and the lead package notes "not verified" for that category
- Users can switch providers at any time without disrupting active leads
- New providers can be added over time without changing the module's core architecture

**Provider examples (not endorsements — user chooses):**

| Category | Known Providers in the Space |
|---|---|
| Identity Verification | Persona, Jumio, Plaid Identity, Socure, Berbix |
| Police Reports | LexisNexis, CrashDocs, BuyCrash, state DOT portals |
| Medical Records | Ciox/Datavant, ChartSwap, ShareCare, MRO |
| Insurance Verification | Verisk, ISO ClaimSearch, provider-direct portals |
| E-Signature | DocuSign, HelloSign, PandaDoc, SignNow |
| Background Checks | TransUnion TLO, Accurint/LexisNexis, Tracers |

---

#### 4E: Pro / Con Analysis — Verification Depth vs. Cost vs. Speed

| Approach | Pros | Cons | Best For |
|---|---|---|---|
| **Minimal verification** (ID + conflict only) | Lowest cost per lead ($0–$2). Fastest processing. Maximum lead volume. | Leads are less complete. Attorney still has to verify. Lower per-lead sale price. | High-volume brokerages selling raw-qualified leads at lower price points |
| **Standard verification** (ID + insurance + police report) | Strong package. Attorney gets actionable intel. Justifies premium pricing ($3,000–$5,500/lead). | $15–$40 cost per qualified lead. Police report delays (minutes, not instant). | Mid-market brokerages and firms wanting a turnkey package |
| **Full verification** (all checks including medical records) | Maximum completeness. Attorney has everything. Highest per-lead value. Commands top-tier pricing. | $50–$100+ cost per lead. Medical records can take days. Requires signed retainer before some checks can run. | Premium brokerages, high-value tort cases (catastrophic injury, wrongful death), or firms using Mode B (internal intake) |

**Recommendation:** Start users on Standard. Let them upgrade or downgrade per tort category based on their margins and their buyers' expectations. The module should make it easy to experiment — "try Full on your MVA cases for one month, compare close rates and revenue per lead against Standard."

---

### Block 5: Retainer Generation & E-Signature

**What it does:** Automatically generates a state-compliant retainer agreement and sends it for electronic signature. This is where the lead becomes a signed client — the most critical conversion point in the entire pipeline.

---

#### 5A: Document Generation — How the Retainer Gets Built

**The flow:**
1. Lead passes qualification (Block 3) + instant verifications (Block 4, Gates 1 & 2)
2. RAGbrain selects the correct retainer template based on: tort type + state + attorney/firm assignment
3. All fields are auto-populated from the qualification data — client name, incident details, date, jurisdiction, injuries described, fee structure
4. State-specific legal language is injected automatically — required disclosures, cooling-off period notices, fee-sharing language, bar-mandated clauses
5. The completed document is reviewed by the RAGbrain's compliance layer — checks that all required fields are populated, all mandatory disclosures are present, no prohibited language exists
6. Document is pushed to the e-signature platform via API
7. Caller receives the signature request via email and/or SMS immediately

**Template management:**
- User uploads their own approved retainer templates during setup
- Templates are organized by: tort type × state × attorney (if different firms use different agreements)
- The module provides a template validator — flags missing required clauses or outdated statutory references
- Templates can be versioned — when a state changes its disclosure requirements, the user uploads the updated template and the old version is archived (not deleted — audit trail)

**What the module does NOT do:** Write retainer agreements from scratch. It populates and assembles from user-approved templates. The legal content is always the user's responsibility — the module ensures it's correctly applied and consistently delivered.

---

#### 5B: E-Signature Platform Options — Comparison

Same connector philosophy as Block 4 — user picks their preferred platform.

| Platform | Cost Per Envelope | Strengths | Weaknesses | Best For |
|---|---|---|---|---|
| **DocuSign** | $1.50–$2.50 (Business plan, ~$25/mo per user for 100 sends) | Industry standard. Highest court acceptance. Brand recognition = caller trust. Strongest API. Mobile-friendly signing. | Most expensive. Overkill for low-volume users. Complex pricing tiers. | High-volume brokerages, premium positioning, maximum legal defensibility |
| **HelloSign (Dropbox Sign)** | $0.75–$1.50 (Essentials ~$15/mo per user) | Clean UX. Good API. Lower cost than DocuSign. Legally compliant. | Less brand recognition with consumers. Fewer advanced features. | Mid-volume operations wanting solid e-sign at lower cost |
| **PandaDoc** | $0.50–$1.00 (Business plan ~$35/mo but includes document builder) | Built-in document editor. Templates + e-sign in one tool. Analytics on document engagement. | Heavier platform — more than just signing. Learning curve for setup. | Users who also want to build/edit templates inside the same tool |
| **SignNow** | $0.30–$0.80 (Business plan ~$8/mo per user) | Cheapest option. Decent API. Legally compliant (ESIGN + UETA). Bulk sending. | Least brand recognition. Simpler feature set. Consumer trust is lower. | Cost-conscious operations, high volume where per-envelope cost matters most |
| **Self-built PDF signing** | $0 per envelope | No per-send cost. Full control. | Legal risk — courts may challenge validity. No established case law. Liability stays with you. No brand trust. Maintenance burden. | **Not recommended for production use.** Acceptable only as a temporary/internal-only fallback |

**Cost math example (100 leads/month that reach signature stage):**

| Platform | Monthly Platform Fee | Per-Envelope Cost (100 sends) | Total Monthly Cost |
|---|---|---|---|
| DocuSign Business | $25 | ~$0 (included in plan) | ~$25 |
| HelloSign Essentials | $15 | ~$0 (included in plan) | ~$15 |
| PandaDoc Business | $35 | ~$0 (included in plan) | ~$35 |
| SignNow Business | $8 | ~$0 (included in plan) | ~$8 |
| Self-built | $0 | $0 | $0 — but carries legal liability |

**Note:** Most platforms include a set number of envelopes in their monthly subscription. At typical lead volumes (50–500/month), the per-envelope cost is effectively $0 — you're paying the monthly platform fee. Cost only becomes per-envelope at very high volumes or on pay-as-you-go plans.

---

#### 5C: Why External E-Signature Platforms Over Self-Built

This deserves emphasis because some users will ask "why can't I just use the PDF signing I already built?"

| Factor | Established Platform (DocuSign, etc.) | Self-Built PDF Signing |
|---|---|---|
| **Legal standing** | ESIGN Act + UETA compliant out of the box. Extensive case law supporting validity. Courts routinely accept. | Must prove compliance independently. No case law backing your specific implementation. Challengeable in court. |
| **Liability** | If the signature is challenged, the platform's compliance team and legal infrastructure backs it. Their problem. | If challenged, your implementation is under scrutiny. Your problem. Your lawyers. Your cost. |
| **Caller trust** | Caller sees "DocuSign" or "HelloSign" in their email — they recognize it, they trust it, they sign it. Higher completion rates. | Caller sees an unknown sender with a PDF attachment. Spam filters may block it. Lower trust. Lower completion rates. |
| **Audit trail** | Platform provides its own tamper-evident audit trail (timestamps, IP addresses, device info, geolocation). Accepted as evidence. | You must build and maintain your own audit trail. Must prove it hasn't been tampered with. |
| **Maintenance** | Platform handles updates, security patches, compliance changes, mobile compatibility. | You maintain everything. Every OS update, every browser change, every new compliance requirement is on you. |
| **Signature completion rate** | Industry average: 80–90% of sent envelopes get signed (familiar UX, mobile-optimized, reminders built in) | Significantly lower — unfamiliar process, potential technical friction, no built-in reminders |

**Bottom line:** The monthly cost of an e-signature platform ($8–$35) is trivial compared to the value of a single signed retainer. One lost signature due to caller distrust of an unknown PDF costs more than a year of DocuSign. The module should strongly default to an established platform and only fall back to self-built as a manual override with clear warnings.

---

#### 5D: Signature Delivery — How It Reaches the Caller

The retainer needs to reach the caller fast, while the conversation is still warm. Multiple delivery channels improve completion rates:

| Delivery Method | Pros | Cons | Completion Rate Impact |
|---|---|---|---|
| **Email** | Standard, expected, includes full document preview. Audit trail. | Spam filters. Caller may not check email immediately. Delayed. | Baseline — 70–80% open rate if sent immediately |
| **SMS with signing link** | Instant delivery. Caller has phone in hand (just finished widget conversation). Highest urgency. | Character limits. Some platforms charge extra for SMS delivery. Less formal. | +15–25% improvement over email alone |
| **Email + SMS combo** | Covers both channels. SMS creates urgency, email provides the formal record. | Slightly higher cost (SMS fees). Could feel pushy if not timed well. | Highest completion rate — 85–95% when sent within 60 seconds of call end |
| **In-widget signing** | Caller signs before the conversation even ends. Zero delay. Maximum conversion. | Not all e-sign platforms support embedded signing. More complex integration. Caller may feel rushed. | Highest possible — but only works if the caller is comfortable |

**Recommended default:** Email + SMS combo, sent within 60 seconds of qualification completion. SMS says "Your retainer agreement is ready for review — check your email or sign here: [link]." Email contains the full document via the e-signature platform.

**Follow-up reminders:** If unsigned after a configurable period (e.g., 2 hours, 24 hours), the e-signature platform sends automated reminders. The module should track reminder count and alert the user if a qualified lead hasn't signed within the threshold — that lead is going cold.

---

#### 5E: Post-Signature — What Happens After the Retainer Is Signed

1. **Signed document returns** to the module via webhook from the e-signature platform
2. **Lead status updates** automatically — moves from "pending signature" to "signed" in the dashboard
3. **Gate 4 verifications trigger** — medical records request and any other post-signature checks can now fire (they require signed authorization from the retainer)
4. **Attorney notification fires** — the assigned attorney or firm receives the complete lead package (see Block 6)
5. **Governance Trace seals** — the retainer execution event is logged immutably with timestamp, signer IP, device info, and document hash
6. **Archival** — the signed retainer is stored in the compliance database (Block 7) and cannot be modified

**If the caller doesn't sign:** After a user-defined expiration period (e.g., 72 hours), the lead is flagged as "expired — unsigned." The user can choose to re-send, manually follow up, or archive. No verification money is spent on Gate 3/4 checks for unsigned leads — cost protection.

---

### Block 6: Attorney Routing & Delivery

**What it does:** Matches the qualified, verified, signed lead to the right attorney or firm and delivers a complete case package.

**Routing logic (configurable by the user):**
- Practice area match (tort type)
- Geographic coverage (state, county, metro area)
- Capacity (how many active cases the attorney can handle)
- Specialization preferences (e.g., "only MVA cases over $50K estimated value")
- Historical performance (conversion rate, client satisfaction — builds over time)
- Round-robin or priority-based distribution within a cluster

**The delivered package contains:**
1. **Qualified Lead Profile** — Structured data: caller info, incident details, injuries, quality score
2. **Conversation Record** — Full transcript of the widget qualification (searchable, cited)
3. **Verification Results** — ID confirmed, police report (attached if available), insurance status
4. **Signed Retainer Agreement** — Executed via e-signature platform
5. **Compliance Certificate** — Conflict check cleared, bar rules followed, all disclosures made
6. **Governance Trace** — Immutable audit trail of every decision, every source, every handoff

**Delivery format:** API push to the attorney's case management system, email notification with secure link, or dashboard access within the module.

**The result:** The attorney receives a case that is qualified, verified, documented, and signed — ready to work. No callbacks. No chasing paperwork. No staff hours spent on intake.

---

### Block 7: Conflict & Compliance Database

**What it does:** Maintains a persistent, growing database that protects against conflicts of interest, duplicates, and compliance violations.

**What it tracks:**
- Every lead processed (name, incident, date, attorney assigned)
- Every conflict check performed and its result
- Every attorney in the cluster (active matters, jurisdictions, capacity)
- Every retainer executed (prevents double-representation)
- Bar rule versions applied per state (for audit purposes)

**How it grows:** Every lead that passes through the system adds to the database. Over time, conflict detection becomes more comprehensive. This is a compounding asset — the more leads processed, the more valuable the compliance layer becomes.

**Immutability:** All records are write-once via ConnexUS. A conflict check result from six months ago cannot be altered retroactively. This is critical for bar complaint defense and litigation.

---

### Block 8: Dashboard & Analytics

**What it does:** Gives the user full visibility into their lead pipeline and business performance.

**Views:**

**Pipeline View**
- Leads in progress (currently in qualification)
- Leads pending verification (waiting on background checks)
- Leads pending signature (retainer sent, not yet signed)
- Leads delivered (complete packages sent to attorneys)
- Leads rejected (disqualified, with reasons)

**Performance Metrics**
- Total leads by tort category, by state, by time period
- Qualification rate (% of widget conversations that result in a qualified lead)
- Verification pass rate
- Signature completion rate (% of sent retainers that get signed)
- Average time: click to signed retainer
- Attorney conversion rate (which attorneys close the most cases from delivered leads)

**Compliance View**
- Conflict checks performed
- Leads flagged for review
- Governance Trace access (searchable audit log)
- State compliance status (are all active state rules up to date?)

---

## Setup Flow — What the User Does on Day 1

The module must be operational with minimal effort. The setup wizard walks the user through:

1. **Select tort categories** — Which case types will you handle? (checkboxes)
2. **Select active states** — Where are you licensed / operating? (map or list)
3. **Upload retainer templates** — Your approved agreements (per state, per tort type)
4. **Configure attorney cluster** — Who receives leads? Practice areas, capacity, geography
5. **Set qualification criteria** — Which questions, which disqualifiers, what quality threshold
6. **Connect e-signature platform** — Pick your provider (DocuSign, HelloSign, PandaDoc, etc.), paste API key, test connection
7. **Connect verification services** — For each verification type, pick your existing provider or skip. Paste credentials, test connection. Only activate what you have — you can add more later.
8. **Launch landing page** — Select template, customize branding, go live

**Target: Setup complete in under one business day. First lead processed on Day 1.**

---

## Two Operating Modes

### Mode A: Lead Generation for Sale
The user operates as a lead brokerage. They generate, qualify, verify, and package leads — then sell them to attorneys at premium prices. The module handles everything from marketing to delivery. The complete package (qualified + verified + signed retainer) commands significantly higher prices than a raw lead because the attorney has zero intake work remaining.

### Mode B: Internal Intake for Law Firms
An attorney or firm uses the module for their own practice. No lead selling — the widget sits on their website, qualifies their own potential clients, verifies information, and delivers signed retainers directly into their workflow. Eliminates the need for intake staff and ensures consistent, compliant qualification.

The module architecture is identical for both modes. The only difference is whether the "attorney cluster" is external buyers or internal attorneys.

---

## What Makes This Different From Existing Solutions

| Existing Approach | RAGbrain Legal Intake |
|---|---|
| Outbound calls (TCPA risk, low answer rates) | Inbound widget (caller initiates, no TCPA exposure) |
| Manual qualification by call center staff | AI-powered qualification with consistent quality |
| Callbacks for missing documents | Parallel verification starts during the first conversation |
| Self-built PDFs for retainers (legal risk) | Established e-signature platforms (DocuSign, HelloSign) |
| Spreadsheets and email for lead tracking | Integrated dashboard with full pipeline visibility |
| No audit trail | Immutable Governance Trace on every decision |
| Lead sold as raw data (name + phone) | Lead sold as complete package (qualified + verified + signed) |
| Multiple vendors and middlemen | Single integrated system |

---

## Build Sequence — Recommended Order

| Phase | What Gets Built | Why This Order |
|---|---|---|
| **Phase 1** | vRep widget + qualification engine | Core value — this is the product's heartbeat |
| **Phase 2** | Conflict/compliance database + audit trail | Must exist before any leads are processed |
| **Phase 3** | Verification pipeline (API integrations) | Elevates lead quality from "qualified" to "verified" |
| **Phase 4** | Retainer generation + e-signature integration | Completes the package — now it's qualified + verified + signed |
| **Phase 5** | Attorney routing + delivery system | Gets the package to the buyer |
| **Phase 6** | Landing page builder + marketing templates | Gives users their own lead generation — completes the loop |
| **Phase 7** | Dashboard + analytics | Visibility and optimization |
| **Phase 8** | Tort template library expansion | Scale across case types |

---

## Summary

RAGbrain Legal Intake is a purchasable module that transforms the legal lead lifecycle from a fragmented, multi-vendor, manual process into a single governed system. It handles marketing, qualification, verification, retainer execution, and attorney delivery — all within one platform, with full compliance audit trails and zero outbound calling.

The module operates entirely on the user's private knowledge base (their templates, their attorney roster, their qualification criteria) and produces immutable, auditable outputs at every step. It can function as a lead generation business (selling premium packages to attorneys) or as an internal intake system for law firms.

Every building block uses existing RAGbrain/RAGbox capabilities. The module is a purpose-built configuration and workflow layer — not a new platform.
