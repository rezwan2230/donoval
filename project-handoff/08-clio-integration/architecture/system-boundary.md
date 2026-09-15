# System Boundary — Canonical Build

Component ownership and data flow for the Clio / ATHENA / DocuSign / GCP email-agent build. This is the architecture-level view; the authoritative decision list is [`../SOURCE-OF-TRUTH.md`](../SOURCE-OF-TRUTH.md).

```
                 ┌──────────────────────┐
   Leads/Ads ───▶│      GHL/ARGUS       │  (intake + marketing — owns prospects)
                 └──────────────────────┘
                            │ (engagement confirmed)
                            ▼
  Caller ─────▶ ┌─────────┐                 ┌──────────────────────────────┐
                │ ATHENA  │───────────────▶ │                              │
                │ (voice) │   API writes    │   Clio Manage Advanced       │
                └─────────┘                 │   (legal system of record)   │
  Email ──────▶ ┌────────────────────┐────▶ │                              │
                │ Custom GCP email   │      │  contacts · matters ·        │
                │ products (agent)   │◀──── │  communications · custom     │
                └────────────────────┘ web  │  fields · webhooks           │
                            │         hooks  └──────────────────────────────┘
                            │                          │
                            ▼                          ▼
                   ┌───────────────┐          ┌────────────────┐
                   │  DocuSign API │          │ Clio Payments  │
                   │  (execution)  │          │ (IOLTA-safe)   │
                   └───────────────┘          └────────────────┘
```

## Ownership

| Component | Owner | Boundary |
|---|---|---|
| GHL/ARGUS | Intake/marketing | All prospect-stage activity; **Clio Grow not used** |
| ATHENA | Voice | Call handling; logs to Clio Manage `communications` |
| Custom GCP email products | Email agent | Email triage/draft/respond; logs to Clio Manage |
| Clio Manage Advanced | System of record | Active clients, matters, billing, trust, docs |
| DocuSign API | Execution | Engagement letters and signatures |
| Clio Payments | Payments | Retainer/invoice collection into IOLTA trust |

## GCP services in scope (email agent)

Gmail API/PubSub · Cloud Run · Vertex/Gemini · Secret Manager · Cloud Logging · Cloud Tasks · Firestore/Cloud SQL (as appropriate). GCP project/billing details: [`../../HANDOFF.md`](../../HANDOFF.md).

## Key constraints (from research — do not re-derive)

- **Manage-only integration.** Clio Grow has no webhooks and a materially thinner API; excluded. See [`../../03-research/clio-integration-research.md`](../../03-research/clio-integration-research.md) §1, §5.
- **50 rpm peak per Manage access token.** Cache contact/matter lookups; do not round-trip Clio per call/email. See [integration-research §3.1, §11.4](../../03-research/clio-integration-research.md).
- **Lead → matter conversion is API-driven via dual-write** (no native API trigger). See [integration-research §8.3 Option A](../../03-research/clio-integration-research.md).

Detailed architecture decisions belong in dated files here, e.g. `2026-06-11-token-storage-decision.md`.
