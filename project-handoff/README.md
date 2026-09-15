# `project-handoff/` — Donovan × ConnexŪS AI State Snapshot

This folder is the **single source of truth** for the Donovan Legal × ConnexŪS AI engagement. It exists so any new Perplexity session, team member, or AI agent can resume work without losing context.

> **Repo of record:** `TicoAI/donovanLAW` (this repo). Do not push to or pull from `TicoAI/donovan-law-site` or `TicoDavid/donovan-law-site` — both are tagged `archive`/`duplicate`.

## Read in this order

1. **[HANDOFF.md](HANDOFF.md)** — complete project state, decisions, KPIs, contacts
2. **[STARTER-PROMPT.md](STARTER-PROMPT.md)** — paste-into-new-Perplexity-account first message
3. **[MIGRATION-CHECKLIST.md](MIGRATION-CHECKLIST.md)** — connectors, skills, GCP access

> **Building the Clio / ATHENA / DocuSign / GCP email agent?** [`08-clio-integration/`](08-clio-integration/) is the **single source of truth** for that build. Start at [`08-clio-integration/SOURCE-OF-TRUTH.md`](08-clio-integration/SOURCE-OF-TRUTH.md). Do not start a competing scattered area; this folder is canonical for all pre-build Clio/ATHENA/DocuSign/GCP email materials.

> **Reviewing the live Donovan Legal website?** The current public-site scrape and browser-rendered QA baseline is in [`04-site-analysis/current-site-capture-2026-06-10/`](04-site-analysis/current-site-capture-2026-06-10/). Start with its `README.md`, then `content-inventory.md`, `site-review.md`, and `visual-qa/visual-qa-notes.md`.

## Folder map

| Folder | Contents |
|---|---|
| `01-strategy/` | Master strategy (v2.1), redesign/enhancement plan, ConnexŪS letterhead renderings |
| `02-meeting/` | May 13, 2026 kickoff: minutes, brief, WEBVTT transcript |
| `03-research/` | Law firm intake research, legal tech widget research, external scans, **Clio integration brief (May 27)**, **Clio package recommendation (Jun 4)** |
| `04-site-analysis/` | donovan.law audit, advisoryconnect.net analysis, competitor refs, and current public-site capture in `current-site-capture-2026-06-10/` |
| `05-session-thread/` | Verbatim turns from this Perplexity session (turn_0001–turn_0008) |
| `06-skills-and-scripts/` | `connexus-ai-doc` user skill + tarball, `md_to_connexus.py`, example JSON |
| `07-assets/` | Brand assets, headshots, site screenshots |
| `08-clio-integration/` | **Single source of truth for the Clio / ATHENA / DocuSign / GCP email-agent build.** Pre-build command center: locked decisions, system boundary, OAuth setup, schemas, webhooks, open decisions. See [08-clio-integration/README.md](08-clio-integration/README.md) and [08-clio-integration/SOURCE-OF-TRUTH.md](08-clio-integration/SOURCE-OF-TRUTH.md) |

## Project at a glance

- **Client:** Donovan Legal PLLC — Paul K. Donovan, CPA, Esq.
- **Tagline:** "A tax-first practice focused on real estate."
- **Live site:** https://www.donovan.law (rebuilt by Paul; we ENHANCE, not rebuild)
- **POC demo:** ~May 27, 2026 · **Production:** ~June 3, 2026
- **Clio decision (Jun 4, 2026):** Clio Manage Advanced only — $119/user/mo annual. No Grow. Clio Payments built-in. See [`03-research/clio-package-recommendation.md`](03-research/clio-package-recommendation.md).
- **Y1 target:** 48 clients baseline · 100 stretch
- **Stack:** ConnexŪS voice SDK + GoHighLevel CRM + GHL calendar + DocuSign/Adobe Sign + new business line

## Brand spelling (non-negotiable)

- **ConnexŪS** — capital U-with-macron, always
- **RAGböx** — lowercase o-with-umlaut, always
- Technical identifiers (skill name, domain, paths) stay un-accented

## Author of record

All client-facing documents are authored by **Walter White, Liaison to David Pierce** on ConnexŪS approved letterhead.
