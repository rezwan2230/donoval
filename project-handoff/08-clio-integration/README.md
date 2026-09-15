# 08 — Clio Integration / Pre-Build Command Center

**Canonical pre-build workspace for the Donovan Legal PLLC Clio / ATHENA / DocuSign / GCP email-agent build.**

This folder is the single obvious place to look before any code is written. If a fact about scope, stack, ownership, or sequencing is not captured here (or linked from here), it is not yet decided.

---

## Purpose

Consolidate everything needed **before implementation starts** for:

- **Clio Manage Advanced** integration (legal system of record)
- **ATHENA** voice agent
- The **custom GCP email products** (the email agent)
- **DocuSign API** execution
- **Clio Payments** collection

so that engineering can start from one canonical brief rather than scattered research.

## Source-of-truth rule

- This folder (`project-handoff/08-clio-integration/`) is the **single source of truth** for the pre-build phase of the Clio/ATHENA/DocuSign/GCP email build.
- The locked decisions, system boundary, ownership map, and entry criteria live in **[`SOURCE-OF-TRUTH.md`](SOURCE-OF-TRUTH.md)**.
- Deep technical research is **referenced, not duplicated** — see [Research references](#research-references).
- If a new decision is made, update `SOURCE-OF-TRUTH.md` and `notes/open-decisions.md`. Do not start a competing doc elsewhere in the repo.

## Stack boundary (locked)

| Layer | Decision |
|---|---|
| Legal system of record | **Clio Manage Advanced** |
| Intake & marketing | **GHL/ARGUS** (owns intake; **Clio Grow is NOT used**) |
| Payments | **Clio Payments** (default; revisit **LawPay** only if ACH economics justify it) |
| Document execution | **DocuSign API** |
| Voice agent | **ATHENA** |
| Email agent | **Custom GCP email products** (Gmail API/PubSub, Cloud Run, Vertex/Gemini, Secret Manager, Cloud Logging, Cloud Tasks, Firestore/Cloud SQL as appropriate) |

Full detail, rationale, and exclusions are in [`SOURCE-OF-TRUTH.md`](SOURCE-OF-TRUTH.md).

## What lives here

| Path | What it holds |
|---|---|
| [`SOURCE-OF-TRUTH.md`](SOURCE-OF-TRUTH.md) | Locked decisions, system boundary table, non-goals, ownership map, security/approval posture, first build milestone |
| [`architecture/system-boundary.md`](architecture/system-boundary.md) | System boundary diagram and component ownership for the canonical build |
| [`oauth-setup/README.md`](oauth-setup/README.md) | Clio Manage OAuth registration, scopes, token storage on GCP |
| [`webhooks/README.md`](webhooks/README.md) | Clio Manage webhook receiver design, signature verification, renewal |
| [`schemas/README.md`](schemas/README.md) | Custom field definitions and ATHENA ↔ Clio mapping tables |
| [`notes/open-decisions.md`](notes/open-decisions.md) | Open decisions log and working notes |

## Research references

These two documents are the authoritative research base. **Do not duplicate their content here** — link to them.

- **[`../03-research/clio-integration-research.md`](../03-research/clio-integration-research.md)** — ATHENA ↔ Clio engineering & strategic research brief (May 27, 2026): auth, rate limits, webhooks, endpoint catalog, recommended architecture. Every factual API claim is cited to primary Clio docs there.
- **[`../03-research/clio-package-recommendation.md`](../03-research/clio-package-recommendation.md)** — Clio package recommendation (May 2026): tier selection, Grow exclusion, Clio Payments vs LawPay, IOLTA compliance.

Supporting context:

- **[`../HANDOFF.md`](../HANDOFF.md)** — full project state, roster, infra, GCP project/billing
- **[`../01-strategy/`](../01-strategy/)** — master strategy v2.1, ATHENA scope
- **[`../02-meeting/`](../02-meeting/)** — May 13, 2026 kickoff (David + Paul + team)
- **External:** [developers.clio.com](https://docs.developers.clio.com/) — primary Clio docs · [trust.clio.com](https://trust.clio.com/) — SOC 2 / ISO 27001 reports for Paul's compliance file

## Open decisions

Tracked in [`notes/open-decisions.md`](notes/open-decisions.md). Headline items still open:

- Token storage backend on GCP (Secret Manager vs other) — leaning Secret Manager (see [`oauth-setup/README.md`](oauth-setup/README.md))
- Webhook receiver service location (standalone Cloud Run service)
- Custom field schema sign-off with Paul (tier values, matter type taxonomy)
- Email-agent build scope: which inbound/outbound flows ship in MVP

## Build entry criteria

The build must **not** start until all of the following are true:

1. This folder is the one canonical source of truth (done — this consolidation).
2. `SOURCE-OF-TRUTH.md` is reviewed and accepted by David/Walter.
3. Paul has purchased **Clio Manage Advanced** and completed the OAuth handoff (see [`oauth-setup/README.md`](oauth-setup/README.md)).
4. Custom field schema is signed off with Paul (see [`schemas/README.md`](schemas/README.md)).
5. GCP project, billing, and Secret Manager access confirmed for the email-agent products (see [`../HANDOFF.md`](../HANDOFF.md)).

## Next artifacts

To be produced in this folder as the pre-build phase closes out:

- `oauth-setup/` — concrete redirect URIs and registered Clio Manage app details once Paul authorizes
- `schemas/` — finalized custom field IDs after Paul's sign-off
- `architecture/` — dated decision docs (e.g. `architecture/2026-06-DD-token-storage-decision.md`) and sequence diagrams for the email-agent flows

## Conventions

- Architecture decisions go in `architecture/` as dated markdown files (e.g. `2026-06-11-token-storage-decision.md`).
- API mappings (ATHENA/GHL field → Clio field) go in `schemas/` as markdown tables.
- Any scope or decision change here must be reflected in [`SOURCE-OF-TRUTH.md`](SOURCE-OF-TRUTH.md) and the status section of [`../HANDOFF.md`](../HANDOFF.md).
- Preserve brand spelling exactly: **ConnexŪS**, **RAGböx**. Technical identifiers stay un-accented.

---

*Command center established 2026-06-11 by Walter White, Liaison to David Pierce. Folder originally stood up 2026-06-10.*
