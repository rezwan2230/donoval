# Clio Package Recommendation: Donovan Legal PLLC
**Prepared for:** Paul Donovan, Solo Tax Attorney, Florida Bar  
**Practice Areas:** Tax Controversy (IRS audits, collections, disputes) / Tax Planning  
**Current Stack:** Lawbillity (time/billing), Microsoft 365, DocuSign, Adobe Acrobat Sign  
**Intake & Marketing:** GHL/ARGUS (handles lead capture, scheduling, marketing automation — NOT Clio)  
**Date:** May 2026  
**Reference:** See also `/home/user/workspace/clio-integration-research.md` for ATHENA API integration specs (not duplicated here).

---

## 1. What a Solo Tax Attorney Actually Needs From an LPM

The following checklist drives the tier and product selection. Every item is either a Florida Bar ethical requirement, an IRS practice operational necessity, or a business-critical workflow element for a solo.

| Need | Why It Matters for Donovan Legal | Required? |
|---|---|---|
| **Matter management** (case file, parties, status, notes) | Core system of record for each client engagement — IRS exam, Collection Due Process, Tax Court — must link all activity to a matter | MUST HAVE |
| **Time tracking** (billable hours, timers, rate cards) | Replaces Lawbillity; hourly and flat-fee billing for controversy vs. planning | MUST HAVE |
| **Billing & invoicing** (LEDES, retainer invoicing, statements) | LEDES formatting for corporate clients; retainer invoicing with trust draw | MUST HAVE |
| **Trust accounting / IOLTA** | **Florida Bar Rule 5-1.1 — MANDATORY.** See below. | MUST HAVE |
| **Document management** (matter-bound docs, version control) | IRS POA forms (2848), closing agreements, audit IDRs, engagement letters — must be matter-linked | MUST HAVE |
| **Calendar & deadlines** (SOL, IRS deadlines, court rules) | IRS assessment SOL (3 yr default, 6 yr for 25%+ understatement, unlimited fraud); Tax Court petition deadlines (90 days from NOD); CDP hearing deadlines — missing a deadline is malpractice | MUST HAVE |
| **Conflict checking** | Florida Bar Rule 1.7/1.9 duty of loyalty; required before accepting new matters | MUST HAVE |
| **Contact management** (clients, IRS contacts, co-counsel) | Centralized contact record for Revenue Agents, Revenue Officers, Taxpayer Advocate contacts, opposing counsel | MUST HAVE |
| **Mobile time-keeping** | Tax controversy involves on-site visits; need iOS/Android time capture | MUST HAVE |
| **Secure client portal / communication** | Client confidentiality; encrypted document exchange replaces insecure email for financial docs | MUST HAVE |
| **E-signature** | Paul has DocuSign + Adobe Acrobat Sign. Built-in Clio e-sig is not required if he keeps existing tools. EasyStart limit (3/month) is a dealbreaker; Essentials (15/month) may be tight | SITUATIONAL |
| **Reporting** (revenue, AR aging, productivity) | Tracking realization rate, aged receivables, trust balance | MUST HAVE |
| **Tax-specific: IRS POA tracking** | Form 2848 must be on file before IRS contact; tracking expiration and coverage per matter | IMPORTANT |
| **Tax-specific: IRS deadlines / audit response tracking** | IDR response deadlines, 30-day letters, 90-day letters, SOL waiver expiration | IMPORTANT |
| **API access for ATHENA integration** | ATHENA (ConnexŪS AI) requires the Clio API for contact lookup, matter creation, communication logging, trust requests | **TIER-DETERMINING** |
| **Custom fields** | ATHENA needs custom fields for client tier (Gold/Platinum/Reserve), matter type (controversy/planning), reserve client number | MUST HAVE (for ATHENA) |
| **Webhooks** | ATHENA uses Manage webhooks for real-time matter/communication event sync | MUST HAVE (for ATHENA) |

### Florida Bar Rule 5-1.1 — IOLTA Summary

[Florida Bar Rule 5-1.1(g)](https://fundingfla.org/iota/iota-rule/) requires that **all nominal or short-term client funds** held by any Florida Bar member practicing in Florida be deposited into an **IOLTA (Interest on Trust Accounts) account** — an interest-bearing trust account at an approved institution where interest remits to the Florida Bar Foundation. Key obligations:

- **Mandatory segregation:** Client funds may never commingle with operating funds. This is not optional.
- **Annual certification:** Every Florida attorney must certify annually to the Bar whether they are in compliance or exempt. Paul will certify compliance. [Florida Bar Trust Account Compliance Instructions](https://www.floridabar.org/ethics/trust-instructions/)
- **Retainer funds:** Any unearned retainer is client property and must sit in IOLTA until earned. The billing software must support trust deposits, ledger tracking per client, and disbursements to operating only upon earning.
- **Processing fee compliance:** Payment processing fees on trust transactions must **never** be deducted from the trust account — they must charge to the operating account. This is a key payment processor selection criterion.
- **Three-way reconciliation:** Monthly reconciliation of (1) trust ledger per client, (2) bank statement, and (3) aggregate client balance is required. Clio Manage trust accounting supports this; a bookkeeper still performs the actual reconciliation.

**Bottom line:** Any LPM Paul uses must have IOLTA trust accounting built in. All Clio Manage tiers include this.

---

## 2. Clio Manage Tier Comparison

### 2.1 Current 2026 Pricing

Clio's [pricing page](https://www.clio.com/pricing/) currently lists four active Clio Manage tiers (EasyStart, Essentials, Advanced, Expand). The old "Complete" tier name has been retired; **Expand** is the current highest tier (Manage + Grow bundled). "EliteSuite" is not a current offering.

| Tier | Annual Billing (per user/mo) | Monthly Billing (per user/mo) | Notes |
|---|---:|---:|---|
| **EasyStart** | $39 | $49 | Entry level; self-serve migration |
| **Essentials** | $79 | $89 | Most popular; guided migration |
| **Advanced** | $119 | $129 | Full feature set; API access; priority support |
| **Expand** | $149 | $159 | Advanced + Clio Grow included |

Sources: [Clio pricing page](https://www.clio.com/pricing/), [Capterra pricing guide](https://www.capterra.com/p/105428/Clio/pricing/) [3RD-PARTY — verify current rates directly with Clio]. Annual billing saves approximately 16–22% vs. monthly.

### 2.2 Feature Matrix by Tier

| Feature | EasyStart | Essentials | Advanced | Expand |
|---|:---:|:---:|:---:|:---:|
| Matter management | ✅ | ✅ | ✅ | ✅ |
| Time & expense tracking | ✅ | ✅ | ✅ | ✅ |
| Invoicing (LEDES, flat fee, contingency) | ✅ | ✅ | ✅ | ✅ |
| **Trust account management / IOLTA** | ✅ | ✅ | ✅ | ✅ |
| Document storage | Unlimited | Unlimited | Unlimited | Unlimited |
| Document & matter templates | ❌ | ✅ | ✅ | ✅ |
| E-signatures | 3/mo | 15/mo | Unlimited | Unlimited |
| Secure client portal (Clio for Clients) | ✅ | ✅ | ✅ | ✅ |
| Mobile app | ✅ | ✅ | ✅ | ✅ |
| Custom fields | ✅ | ✅ | ✅ | ✅ |
| **Court calendaring rules** | ❌ | 3/firm | 10/firm | 10/firm |
| Accounting integrations (QuickBooks, Xero) | ❌ | ✅ | ✅ | ✅ |
| Automated workflows | ❌ | ❌ | ✅ | ✅ |
| Advanced tasks | ❌ | ❌ | ✅ | ✅ |
| Full-text document search | ❌ | ❌ | ✅ | ✅ |
| Custom reporting (unlimited saved views) | ❌ | 5 views | Unlimited | Unlimited |
| Custom roles & granular permissions | ❌ | 2 roles | Unlimited | Unlimited |
| **API access** | ❌ | ❌ | ✅ | ✅ |
| Webhooks | ❌ | ❌ | ✅ | ✅ |
| Live onboarding training | ❌ | ❌ | ✅ | ✅ |
| Priority support | ❌ | ❌ | ✅ | ✅ |
| Data migration | Self-serve | Guided | Guided | Guided |
| Clio Grow (intake CRM) | ❌ | Add-on | Add-on | ✅ Included |

Sources: [Clio pricing page](https://www.clio.com/pricing/), [Capterra Clio pricing breakdown](https://www.capterra.com/p/105428/Clio/pricing/) [3RD-PARTY — verify], [The Legal Practice Clio review](https://thelegalpractice.com/tools/clio-pricing/) [3RD-PARTY — verify].

**API access caveat:** Clio does not publish API tier requirements on the pricing page. Multiple independent reviewer sources ([The Legal Practice](https://thelegalpractice.com/tools/clio-pricing/), [Capterra](https://www.capterra.com/p/105428/Clio/pricing/)) consistently state that API access and webhooks are **Advanced plan and above** only. EasyStart and Essentials do not include API or webhook access. **Confirm directly with Clio before purchasing** if you need explicit contractual confirmation. This tier requirement is the single most important driver of Paul's minimum plan.

### 2.3 Tier Assessment Against Donovan Legal Checklist

| Tier | ATHENA API/Webhooks | Trust Accounting | Court Rules | Unlimited E-sig | QuickBooks Sync | Verdict |
|---|:---:|:---:|:---:|:---:|:---:|---|
| EasyStart | ❌ FAIL | ✅ | ❌ | ❌ | ❌ | **Eliminated** — no API |
| Essentials | ❌ FAIL | ✅ | 3/firm | ❌ | ✅ | **Eliminated** — no API |
| **Advanced** | ✅ PASS | ✅ | 10/firm | ✅ | ✅ | **Minimum viable tier** |
| Expand | ✅ PASS | ✅ | 10/firm | ✅ | ✅ | Viable but adds Grow cost |

**Lowest qualifying tier for ATHENA integration + Paul's practice needs: Advanced ($119/user/month annual).**

The Advanced tier is not just the API tier — it is also the right tier for operational reasons: unlimited e-signatures (Paul will stop needing to rely solely on DocuSign once per-matter volume grows), full-text document search (critical for large IRS audit files), and automated workflows (task templates for controversy matter open/close workflows). The $40/month premium over Essentials is justified by both API requirement and practice efficiency gains.

---

## 3. Clio Grow — Is It Needed When GHL Owns Marketing/Intake?

### 3.1 What GHL/ARGUS Already Handles

GHL will own and operate:
- Website intake widget and lead capture forms
- Lead scoring and pipeline management
- Marketing automation (email/SMS sequences)
- Calendar booking for prospect consultations
- Engagement letter trigger (DocuSign/Adobe API)
- CRM pipeline for prospects from lead to hire

### 3.2 What Clio Grow Does

[Clio Grow](https://www.clio.com/pricing/) is Clio's intake and CRM module. Its features:

| Clio Grow Feature | GHL Equivalent | GHL Gap? |
|---|---|---|
| Online client intake forms | ✅ GHL forms | None |
| Online appointment booking | ✅ GHL calendar | None |
| Automated client emails | ✅ GHL workflows | None |
| Automated intake workflows | ✅ GHL automations | None |
| Referral source reporting | Partial — GHL tracks UTM/sources | Minor |
| Google Local Services Ads integration | ✅ GHL | None |
| Email marketing | ✅ GHL | None |
| Website builder | ✅ GHL | None |
| **Native Grow → Manage matter conversion** | ❌ GHL cannot do this natively | Partial gap — see below |
| **Conflict check integration at intake** | ❌ GHL cannot trigger Clio conflict check | Minor gap — see below |

### 3.3 The Honest Assessment

**Clio Grow adds no meaningful unique value for Donovan Legal when GHL is the intake system.**

The specific gaps worth noting:

**Native matter conversion:** Clio Grow has a "Quick Intake" button that simultaneously creates a Clio contact + matter from an accepted lead. GHL cannot trigger this natively. However, as documented in the ATHENA integration research, this conversion is **UI-driven and not API-accessible** even with Grow. ATHENA's dual-write workaround (creating the Manage contact and matter directly via API when engagement is confirmed) achieves the same outcome without Grow. Paul clicking a "convert" button in Grow is no better than ATHENA writing the matter directly to Manage. This gap is neutralized.

**Conflict checks at intake:** Clio Grow does not actually run automatic conflict checks — it simply feeds contact data into Manage where the attorney can run a manual conflict check. GHL feeding a new lead to ATHENA, which then checks Manage contacts/matters via the API, achieves the same outcome. There is no native automated conflict-check engine in Grow that GHL cannot replicate.

**Verdict: Grow excluded.** Paul should not pay for Clio Grow when GHL already handles every Grow function upstream. Buying Grow would mean paying $59–$79/user/month for duplicated functionality. The only workflow that changes slightly is the Quick Intake button in the Grow UI, which ATHENA's dual-write pattern renders unnecessary.

**Clio Grow standalone pricing:** Approximately $59/user/month when purchased standalone, per [Capterra](https://www.capterra.com/p/105428/Clio/pricing/) and [CozyCal analysis](https://www.cozycal.com/blog/clio-grow-alternatives-comparing-cozycal-and-clio-grow-scheduler-for-law-firm-appointment-booking) [3RD-PARTY — verify]. As an add-on to Essentials or Advanced it is approximately $69/user/month. It is included in the Expand bundle ($149/user/month annual). [3RD-PARTY pricing — verify directly with Clio sales.]

---

## 4. Clio Payments — Required for IOLTA Retainer Collection?

### 4.1 What Clio Payments Does

[Clio Payments](https://www.clio.com/pricing/) is Clio's built-in payment processing, powered by its own payment infrastructure. It is included as a feature within the Clio Manage subscription (no separate monthly base fee on top of Manage) and is activated on all plan tiers. Key capabilities:

- Accept credit/debit cards, ACH, eCheck, and text-to-pay
- Payments automatically recorded against the correct matter in Manage
- Separate trust and operating account routing — processing fees are always deducted from the operating account per IOLTA rules, never the trust account
- Trust payments deposited in full; fees deducted from operating account monthly or daily
- Full refund flexibility for both trust and operating payments, managed within Clio Manage
- Syncs to QuickBooks/Xero via Clio's accounting integration

**Current rate schedule** ([Clio pricing page](https://www.clio.com/pricing/)):
- eCheck / ACH: **1% per transaction**
- Credit & debit card: **2.95%** (standard); **3.75% AMEX**
- Pay Later (Affirm): 4.95%
- No per-transaction flat fee beyond the percentage (though one third-party source notes $0.20/transaction — verify current terms directly with Clio)

Source: [Clio pricing page](https://www.clio.com/pricing/), [Clio vs LawPay comparison](https://www.clio.com/compare/clio-vs-lawpay-integration/), [Clio Help Center — Fee Schedules](https://help.clio.com/hc/en-us/articles/9285813698075-Clio-Payments-Fee-Schedules).

### 4.2 Is Clio Payments the ONLY Way to Route Payments to the Clio Trust Ledger?

No. But it is the only **automatic, fully integrated** path. The alternatives require manual reconciliation steps:

- **LawPay integration:** LawPay connects to Clio Manage and is available as an integration. However, [Clio's own comparison](https://www.clio.com/compare/clio-vs-lawpay-integration/) notes that using LawPay requires managing payments in two systems — payments processed in LawPay must be manually reconciled back to Clio trust ledger entries. You cannot issue trust refunds from within Clio; chargebacks must be managed in the LawPay portal. Payment info cannot be stored at intake in advance of a bill.

- **Stripe direct:** Can collect payments, but has no native Clio trust ledger integration. Any Stripe payment would require a manual trust ledger entry in Clio. High risk for IOLTA compliance without a disciplined manual workflow. Not recommended.

### 4.3 Competitive Alternatives

| Processor | Monthly Fee | Credit Card Rate | ACH/eCheck | Trust Compliance | Clio Integration |
|---|---:|---|---|---|---|
| **Clio Payments** | $0 (included) | 2.95% (no per-tx flat fee) | 1% | ✅ Automatic, built-in | Native — automatic ledger |
| **LawPay** | $19/firm/mo | Variable + network fees | $2 flat/tx (up to $5k) | ✅ IOLTA-compliant | Integration available, manual reconciliation to Clio |
| **Headnote** | $0 | 2.9% | 1.9% | ✅ IOLTA-compliant | No native Clio integration — manual |
| **Gravity Legal** | $0 | 2.95% | 0.35% | ✅ IOLTA-compliant | No native Clio integration — manual |

Sources: [LawPay pricing page](https://www.lawpay.com/pricing/), [Headnote FAQ](https://headnote.com/faq), [Rosen Institute payment processor guide](https://roseninstitute.com/the-complete-guide-to-credit-card-processors-for-law-firms/) [3RD-PARTY — verify], [Clio vs LawPay](https://www.clio.com/compare/clio-vs-lawpay-integration/).

### 4.4 Recommendation for Paul

**Use Clio Payments.** Reasons:

1. **IOLTA compliance is automatic.** Processing fees are deducted from operating, never trust. Trust payments deposit in full. This is the IOLTA-safe default without manual intervention.
2. **No separate monthly base fee.** LawPay charges $19/month per firm; Clio Payments is included with the Manage subscription.
3. **Unified ledger.** Every payment is automatically posted to the correct matter and synced to QuickBooks without manual entry. This reduces bookkeeping friction significantly.
4. **Trust refunds in Clio.** LawPay cannot refund trust transactions from within Clio. Clio Payments can.
5. **Menu-driven retainer collection workflow.** Paul wants payment collection linked to calendar booking. Clio Payments supports storing payment methods at intake and sending payment requests via secure link — the booking-to-payment workflow ATHENA will drive.

The only scenario where LawPay beats Clio Payments is high ACH volume (LawPay's $2 flat fee beats 1% on transactions above $200; below that Clio wins). For retainer-based tax work where retainers are typically $2,500–$15,000, Clio Payments' 1% ACH rate is more expensive than LawPay's $2 flat. For a $5,000 retainer ACH, that's $50 vs. $2. **If Paul processes most retainers via ACH and not credit card, this warrants a cost comparison.** However, the operational friction of managing two systems (LawPay + Clio manual reconciliation) likely costs more in bookkeeper time than the ACH fee differential. Start with Clio Payments; switch to LawPay only if high-volume ACH economics prove it.

---

## 5. The Bottom-Line Package Recommendation

### One Clear Answer

> **Buy: Clio Manage Advanced tier only.**
> **Do not buy: Clio Grow, Clio Expand.**
> **Use: Clio Payments (built-in — no separate purchase).**

### Cost for Paul (1 User)

| Billing Option | Monthly Cost | Annual Total |
|---|---:|---:|
| **Annual billing (recommended)** | $119/user/month | $1,428/year |
| Monthly billing | $129/user/month | $1,548/year |
| Annual savings | $10/month | $120/year |

### What Each Product Does in Paul's Workflow

**Clio Manage Advanced ($119/month, annual billing)**
The system of record for every active client matter. Runs time tracking (replacing Lawbillity), invoicing, IOLTA trust accounting, document management, calendaring with court rules, conflict checking, contact management, and all client communications. Provides ATHENA with API + webhooks + custom fields for the full ConnexŪS integration. This is the core LPM Paul needs and the tier ATHENA requires.

**Clio Payments (built-in, no separate cost)**
Handles retainer collection after GHL calendar booking. Routes ACH/card payments directly to IOLTA trust account, automatically posts to the correct matter ledger, syncs to QuickBooks. Ensures Florida Bar IOLTA compliance without manual trust entry. Zero additional monthly fee.

### What Is Intentionally Excluded and Why

**Clio Grow — excluded.** GHL/ARGUS owns every intake and marketing workflow Grow would otherwise provide: lead capture, pipeline, appointment booking, automation sequences, and engagement letter triggers. Buying Grow would duplicate GHL at $59–$69/user/month for no net new capability.

**Clio Expand — excluded.** Expand bundles Grow with Advanced. Since Grow is excluded, there is no reason to pay the Expand premium. Advanced standalone costs $119/month annual vs. Expand's $149/month — a $30/month / $360/year difference for functionality Paul doesn't need.

**Clio Draft (document automation add-on) — deferred.** Not needed at launch. Paul has DocuSign for e-signatures and can build Clio document templates manually within Advanced. Consider Clio Draft (Clio's AI-assisted drafting add-on) if Paul wants template automation for engagement letters and IRS response letters — sales-quoted add-on price.

**Manage AI add-on — deferred.** Clio's AI features (scheduling automation, smart billing, document analysis) are add-ons priced by sales quote. ATHENA handles the AI receptionist function externally; Manage AI would be complementary for internal workflows but not required at launch.

---

## 6. Add-Ons & Integrations to Know About

Paul does not need these at signup, but should be aware they exist:

**Clio Court Rules** — Available within Advanced plan (10 court rules per firm). For Florida Tax Court practice, Paul should activate the US Tax Court rules calendar and Florida circuit/district court rules through Clio's court rules catalog. This is included in Advanced, not a separate purchase.

**Clio Draft (formerly Clio Drafts)** — A standalone add-on for intelligent document automation — fill-in templates using matter and contact data. Available on all tiers or standalone. Relevant when Paul wants to templatize IRS response letters, engagement letters, or POA forms. Sales-quoted pricing.

**Clio for Clients (secure client portal)** — Included in all Manage tiers. Paul's clients download the app or access via browser to send/receive documents securely, view bills, and pay. No additional cost.

**Microsoft 365 integration** — Clio natively integrates Outlook calendar and email with Manage. Paul can sync his existing M365 calendar, log emails to matters, and work within Outlook while Clio captures the activity. This integration is available at Essentials and above (included in Advanced).

**Migration from Lawbillity** — Clio's [guided migration](https://www.clio.com/pricing/) is included at the Advanced tier. Clio support can assist with data export from Lawbillity (contacts, matters, time entries, bills) into Clio. Paul should request a migration scoping call before signup to understand what is automatable vs. manual.

**Clio Accounting** — A separate add-on providing a full general ledger, bank account sync, and financial reporting inside Clio. Paul will likely use QuickBooks Online for bookkeeping (Clio Advanced includes the QBO integration). Clio Accounting is only worthwhile if Paul wants to eliminate QBO entirely — sales-quoted pricing, US only.

---

## 7. Sign-Up Mechanics

**Where to sign up:** [clio.com](https://www.clio.com) → "Try for free" or direct to [clio.com/signup](https://www.clio.com/signup/). Self-serve checkout is available — no sales call required before purchasing. A demo can be requested if desired but is not mandatory.

**Free trial:** 7-day free trial. No credit card required. Source: [Clio pricing page](https://www.clio.com/pricing/). The trial account defaults to a feature-complete environment. After trial, the account converts to a paid subscription at the selected tier.

**Developer trial note:** If ATHENA needs to test the integration before Paul's production account is live, a separate [7-day developer trial](https://docs.developers.clio.com/handbook/getting-started/get-a-developer-account/) can be created. After expiry, Clio offers a free perpetual developer account for approved integrators.

**Annual vs. monthly billing:**
- Annual billing: ~16–22% discount depending on tier. EasyStart saves $10/mo; Advanced saves $10/mo ($120/year for a solo). Annual billing is prepaid; no refunds for the current term.
- Monthly billing: Higher rate with no contract lock-in. Appropriate if Paul is uncertain about the platform, though given the ATHENA integration investment, annual billing makes sense once he confirms the platform works.
- **Recommendation for Paul:** Start on monthly billing during the trial/onboarding period. Switch to annual after the first 30–60 days once the Clio–ATHENA integration is confirmed operational.

**Data residency:** At account signup, Paul should select **United States** as his data region. The US region uses `app.clio.com` and `api.clio.com/grow/`. This selection is permanent — migrating between regions requires support intervention. All ATHENA integration endpoints in the engineering brief use the US region URLs. Source: [ATHENA integration research](https://docs.developers.clio.com/api-docs/clio-manage/authorization/).

**Implementation fee:** None. Clio does not charge a setup or implementation fee. Guided migration is included at Advanced tier.

**Clio for Clients (client portal app):** Free for Paul's clients — they download the iOS/Android app or use the web portal at no charge.

---

## 8. Open Risks

**Risk 1 — Pricing change.** Clio has raised prices multiple times. The current $119/month Advanced annual rate is not contractually locked unless Paul is on an annual plan. On an annual plan, the rate holds for the committed year; Clio can raise rates at renewal. The EasyStart to Essentials to Advanced pricing ladder has historically increased at each restructuring. **Mitigate:** Buy annual billing and review pricing 60 days before renewal each year.

**Risk 2 — API access tier requirement may shift.** Currently API access is tied to Advanced. Clio has restructured tiers before. If Clio moves API access down to Essentials in a future restructuring, Paul could save $40/month. Conversely, if Clio creates a new API-specific surcharge above Advanced, that raises costs. **Mitigate:** Confirm current tier requirement with Clio sales before purchase; monitor Clio product announcements.

**Risk 3 — Tier downgrade constraint.** Once on Advanced (annual), downgrading mid-term is generally not permitted. If Paul finds Advanced over-built, he would need to wait for renewal. **Mitigate:** This risk is minimal given ATHENA's API dependency — Advanced is the correct tier and that won't change unless Clio restructures API access.

**Risk 4 — Clio Payments rate changes.** Clio Payments transaction fees are set by Clio and can change. Processing fees are not contractually locked at the percentage shown today. **Mitigate:** Monitor fee schedule annually. LawPay remains as a fallback payment processor at any time (it integrates with Clio Manage with manual reconciliation).

**Risk 5 — Court rules catalog gaps.** Clio provides 10 court rules per firm at Advanced tier. US Tax Court calendaring rules may need to be set up manually or verified in Clio's catalog. If Tax Court rules are not pre-built in Clio, Paul will need to configure deadline calculation rules manually. This is a setup-time operational issue, not a blocker, but should be scoped during onboarding.

**Risk 6 — E-signature limits at Essentials (if ever downgraded).** Advanced provides unlimited e-signatures via Clio's built-in tool. If Paul ever dropped to Essentials (15/month) and moved away from DocuSign, he could hit a limit in a busy month. Not relevant at Advanced tier.

**Risk 7 — Grow pricing volatility on Expand bundle.** If GHL ever fails as an intake platform, Paul would need to add Clio Grow quickly. The Grow add-on pricing to Essentials/Advanced is approximately $69/user/month — a meaningful cost. **Mitigate:** GHL is the system of record for intake; maintain GHL as the platform and treat Clio Grow as the backup option.

---

## Summary Decision Table

| Product | Buy? | Tier/Version | Monthly Cost (Annual) | Justification |
|---|:---:|---|---:|---|
| **Clio Manage** | ✅ YES | Advanced | $119/user | Core LPM; API + webhooks for ATHENA; trust accounting; court rules; unlimited e-sig |
| **Clio Payments** | ✅ YES | Built-in | $0 (% fees only) | Automatic IOLTA routing; unified trust ledger; no monthly base fee |
| **Clio Grow** | ❌ NO | — | $0 | GHL owns all intake and marketing; Grow adds no unique value |
| **Clio Expand** | ❌ NO | — | $0 | Grow-inclusive bundle; not needed when Grow is excluded |
| **Clio Draft** | Defer | Add-on | TBD | Consider after launch for template automation |
| **Manage AI** | Defer | Add-on | TBD | ATHENA handles AI receptionist; Manage AI is internal workflow AI — evaluate post-launch |

**Paul's all-in monthly cost at launch: $119/month (annual billing) + Clio Payments transaction fees at 2.95% card / 1% ACH.**

---

*Sources: [clio.com/pricing](https://www.clio.com/pricing/), [Clio vs LawPay](https://www.clio.com/compare/clio-vs-lawpay-integration/), [Clio Help Center — Fee Schedules](https://help.clio.com/hc/en-us/articles/9285813698075-Clio-Payments-Fee-Schedules), [Florida Bar Rule 5-1.1 / IOLTA](https://fundingfla.org/iota/iota-rule/), [Florida Bar Trust Account Instructions](https://www.floridabar.org/ethics/trust-instructions/), [Clio developer account guide](https://docs.developers.clio.com/handbook/getting-started/get-a-developer-account/). Third-party pricing data: [Capterra Clio pricing](https://www.capterra.com/p/105428/Clio/pricing/) [3RD-PARTY — verify], [Accounting Atelier Clio pricing 2026](https://www.accountingatelier.com/blog/clio-pricing) [3RD-PARTY — verify], [The Legal Practice Clio review](https://thelegalpractice.com/tools/clio-pricing/) [3RD-PARTY — verify], [LawPay pricing](https://www.lawpay.com/pricing/), [Headnote FAQ](https://headnote.com/faq), [Rosen Institute payment guide](https://roseninstitute.com/the-complete-guide-to-credit-card-processors-for-law-firms/) [3RD-PARTY — verify].*

*API integration details, OAuth flows, webhook semantics, endpoint catalog, and rate limits are documented in `/home/user/workspace/clio-integration-research.md`. This brief does not repeat that material.*
