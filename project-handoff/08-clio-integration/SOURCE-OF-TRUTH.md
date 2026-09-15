# SOURCE OF TRUTH — Donovan Legal Pre-Build (Clio / ATHENA / DocuSign / GCP Email Agent)

**Status:** Pre-build. No implementation code exists yet.
**Owner of record:** Walter White, Liaison to David Pierce — ConnexŪS AI / Tico AI LLC.
**Last updated:** 2026-06-11.

This is the canonical pre-build reference. The locked decisions, system boundary, ownership, and entry criteria below govern the build. Deep API research is **referenced, not restated** — see [Research references](#research-references). Where a fact originates in the research docs, this file links to them rather than re-asserting API details.

---

## 1. System boundary

| System | Role | Owns |
|---|---|---|
| **Clio Manage Advanced** | Legal system of record | Active matters, contacts, time/billing, IOLTA trust accounting, documents, calendar, communications log, custom fields, webhooks |
| **GHL/ARGUS** | Intake & marketing | Lead capture, intake forms, pipeline, marketing automation, prospect scheduling |
| **ATHENA** | Voice agent | Inbound/outbound voice handling, call screening, call logging into Clio Manage |
| **Custom GCP email products** | Email agent | Email intake, triage, drafting, and response on GCP (the email agent built in this engagement) |
| **DocuSign API** | Document execution | Engagement letters and signature execution |
| **Clio Payments** | Payments | Retainer/invoice collection routed to IOLTA trust per Florida Bar Rule 5-1.1 |

Boundary rule: **Clio Grow is excluded.** GHL/ARGUS owns intake and marketing; Clio Manage Advanced is the system of record for active clients. See the Grow-exclusion analysis in [`../03-research/clio-package-recommendation.md`](../03-research/clio-package-recommendation.md) §3 and the Manage-only architecture rationale in [`../03-research/clio-integration-research.md`](../03-research/clio-integration-research.md) §1.

## 2. Locked decisions

| # | Decision | Reference |
|---|---|---|
| 1 | **Clio Manage Advanced** is the legal system of record. | [package-recommendation §2, §5](../03-research/clio-package-recommendation.md) |
| 2 | **Do not use Clio Grow.** GHL/ARGUS owns intake and marketing. | [package-recommendation §3](../03-research/clio-package-recommendation.md) |
| 3 | **Use Clio Payments** unless ACH economics later justify **LawPay**. | [package-recommendation §4](../03-research/clio-package-recommendation.md) |
| 4 | **Use DocuSign API** for execution. | This engagement; supersedes built-in Clio e-sign for execution flows |
| 5 | **Build voice on ATHENA.** | [HANDOFF.md](../HANDOFF.md), [01-strategy](../01-strategy/) |
| 6 | **Build the email agent as custom GCP products.** | This engagement |
| 7 | **Full GCP shop** for the email agent: Gmail API/PubSub, Cloud Run, Vertex/Gemini, Secret Manager, Cloud Logging, Cloud Tasks, Firestore/Cloud SQL as appropriate. | This engagement |

These are locked for the current phase. Changing one requires updating this file and [`notes/open-decisions.md`](notes/open-decisions.md).

## 3. Non-goals / exclusions

- **No Clio Grow.** No Grow OAuth app, no Grow polling, no Grow Lead Inbox writes. (Grow API research remains in the brief for reference only; it is out of scope for this build.)
- **No Clio Expand** bundle (would only add Grow).
- **No LawPay at launch** — Clio Payments is the default. LawPay is a documented fallback only if high-volume ACH economics prove it ([package-recommendation §4.4](../03-research/clio-package-recommendation.md)).
- **No Clio App Directory listing required** for launch — Paul's deployment runs as a private OAuth app. Directory listing is a separate go-to-market decision ([integration-research §9](../03-research/clio-integration-research.md)).
- **No rebuild of the live donovan.law site** — that work is enhancement-only and tracked elsewhere ([HANDOFF.md](../HANDOFF.md)).

## 4. Integration ownership map

| Flow | Source | Destination | Owner | Notes |
|---|---|---|---|---|
| Prospect lead capture | Website / ads | GHL/ARGUS | GHL/ARGUS | Clio not involved at intake |
| Inbound/outbound voice | Caller | ATHENA → Clio Manage | ATHENA | Call logged via Clio `communications` ([integration-research §6.4](../03-research/clio-integration-research.md)) |
| Inbound/outbound email | Email | Custom GCP email products → Clio Manage | Email agent (GCP) | Triage/draft/respond; log to matter as appropriate |
| Contact / matter lookup | ATHENA / email agent | Clio Manage API | This build | Cache aggressively; respect 50 rpm peak limit ([integration-research §3.1, §11.4](../03-research/clio-integration-research.md)) |
| Matter creation on engagement | ATHENA / email agent | Clio Manage API | This build | Dual-write pattern ([integration-research §8.3 Option A](../03-research/clio-integration-research.md)) |
| Document execution | This build | DocuSign API | This build | Engagement letters, signatures |
| Payment collection | This build | Clio Payments | Clio Payments | IOLTA-safe routing ([package-recommendation §4](../03-research/clio-package-recommendation.md)) |
| Real-time Clio events | Clio Manage | GCP webhook receiver | This build | Manage webhooks only; Grow has none ([integration-research §5](../03-research/clio-integration-research.md)) |

## 5. Security / approval posture

- **Private OAuth app.** Run as a private Clio Manage app for Donovan Legal; no Clio App Directory security review required for private use ([integration-research §9.4](../03-research/clio-integration-research.md)).
- **Token storage.** Encrypt at rest; use **GCP Secret Manager** for Clio tokens (per [`oauth-setup/README.md`](oauth-setup/README.md)). Manage refresh tokens do not rotate ([integration-research §2.1](../03-research/clio-integration-research.md)).
- **Webhook verification.** Verify `X-Hook-Signature` (HMAC-SHA256) on every Clio Manage delivery; HTTPS only ([integration-research §5.1](../03-research/clio-integration-research.md), [`webhooks/README.md`](webhooks/README.md)).
- **Confidentiality / privilege.** ATHENA and the email agent act as Paul's authorized technology vendor; the same ABA Rule 1.6 / Florida Bar confidentiality obligations flow through. A DPA with Paul must address privilege and a no-training commitment for any data leaving Clio ([integration-research §10](../03-research/clio-integration-research.md)).
- **IOLTA.** All client funds route to IOLTA trust per Florida Bar Rule 5-1.1; processing fees never deducted from trust ([package-recommendation §1, §4](../03-research/clio-package-recommendation.md)).
- **Approval gate.** Engineering does not begin until the [build entry criteria](README.md#build-entry-criteria) are met and David/Walter accept this document.

## 6. First build milestone

**Milestone 0 — Clio Manage read path on GCP, behind a private OAuth app.**

Done when:

1. Private Clio Manage Advanced OAuth app is registered and Paul has authorized it ([`oauth-setup/README.md`](oauth-setup/README.md)).
2. Tokens are stored in GCP Secret Manager with a working background refresh.
3. A Cloud Run service can perform an authenticated contact lookup against Clio Manage (`GET /api/v4/contacts`) and read it back, respecting rate-limit headers.
4. A Clio Manage webhook receiver validates `X-Hook-Signature` and acknowledges the handshake ([`webhooks/README.md`](webhooks/README.md)).

This proves auth, storage, read, and event intake before any write-path (matter creation, communications logging, DocuSign, payments) work begins.

## Research references

- **[`../03-research/clio-integration-research.md`](../03-research/clio-integration-research.md)** — engineering & strategic research brief (May 27, 2026). Authoritative for auth, rate limits, webhooks, endpoint catalog, and recommended architecture.
- **[`../03-research/clio-package-recommendation.md`](../03-research/clio-package-recommendation.md)** — package recommendation (May 2026). Authoritative for tier, Grow exclusion, payments, and IOLTA.

No API specifics are invented in this file. Any claim not traceable to the two research docs or [`../HANDOFF.md`](../HANDOFF.md) is flagged as open in [`notes/open-decisions.md`](notes/open-decisions.md).

---

*Walter White, Liaison to David Pierce — ConnexŪS AI / Tico AI LLC.*
