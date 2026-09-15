# Donovan Legal × ConnexŪS AI — Project Handoff

**Last updated:** May 15, 2026 (revised 10:17 AM EDT)
**Author of record:** Walter White, Liaison to David Pierce (AI persona for ConnexŪS AI docs)
**Project Lead:** David Pierce (david@ticoai.net)
**Purpose of this document:** Complete state capture so any new Perplexity session, team member, or AI agent can pick up this engagement without loss of context.

> **Brand spelling is non-negotiable:** **ConnexŪS** (capital U-with-macron) and **RAGböx** (lowercase o-with-umlaut). Technical strings — `connexus-ai-doc` skill name, `theconnexus.ai` domain, file paths — remain un-accented because they are identifiers.

---

## 1. Project Identity

| Field | Value |
|---|---|
| Client | **Donovan Legal PLLC** |
| Principal | **Paul K. Donovan, CPA, Esq.** |
| Address | 55 SE 2nd Avenue, Delray Beach, FL 33444 |
| Phone | 561-666-6022 |
| Website (live, Paul-built) | https://www.donovan.law |
| Tagline (Paul's, shipped) | "A tax-first practice focused on real estate." |
| Four pillars | Tax Planning · Tax Compliance · Tax Controversy · Real Estate |
| Credentials | JD Suffolk *cum laude* · CPA (MA) · CCM · Licensed RE Broker (MA) · Bars: FL, MA, SCOTUS, 1st Cir., D. Mass. |

### Entity structure (Florida Bar Rule 4-7 compliance)
- **Tico AI** = ad agency of record (NOT Paul's name on ads)
- **ConnexŪS AI** = tech platform (voice agent, RAG, SDK)
- **Donovan Legal PLLC** = law firm

### Repos & Infra

| Resource | Value |
|---|---|
| GitHub repo (CANONICAL) | https://github.com/TicoAI/donovanLAW (private — Cloud Run site lives here; topics: `client-site`, `cloud-run`, `gcp`) |
| GitHub repo (DUPLICATE, do not use) | https://github.com/TicoAI/donovan-law-site (private — description literally reads "[DUPLICATE — see donovanLAW]"; topics: `archive`, `duplicate`) |
| GitHub alias (legacy redirect) | https://github.com/TicoDavid/donovan-law-site → redirects to TicoAI/donovan-law-site (the duplicate). Do **not** push here. |
| GitHub orgs in play | **TicoAI** (org, holds both repos) · **TicoDavid** (personal, legacy redirect alias only) |
| Cloud Run URL | https://donovan-law-site-290683654730.us-east1.run.app |
| GCP project | `donovan-law-site` (290683654730) |
| GCP billing | 018A80-117F09-F20035 |
| Region | us-east1 |
| Cloud Build trigger | `donovan-law-deploy` (push to main → cloudbuild.yaml) |
| GitHub connection | `github-connexus` (2nd-gen Developer Connect) |
| GCP identity | theconnexusai@gmail.com |
| Local dev OS | Windows / PowerShell (C:\Users\d0527) |

> **Note (May 15, 2026):** A previous handoff attempt pushed commits `1d35184`, `ed63566`, `da6ea29` into the **duplicate** `TicoAI/donovan-law-site` repo because the GitHub agent proxy followed the redirect from `TicoDavid/donovan-law-site`. That repo is tagged `archive`/`duplicate`. This corrected handoff lives in `TicoAI/donovanLAW`, which is canonical.

---

## 2. Meeting Roster (May 13, 2026 Kickoff)

| Name | Role | Org |
|---|---|---|
| Paul Donovan | Principal Attorney/CPA | Donovan Legal PLLC |
| David Pierce | Project Lead | Tico AI / ConnexŪS AI |
| Elroy Geerdink | Head Engineer | ConnexŪS AI |
| Veronica Pierce | Marketing / Google Ads | Tico AI |
| Wendy Cardenas | Calendar / Operations | Donovan Legal |
| Leidy Meza | Support | Donovan Legal |

> **Action:** Full email roster still owed by Paul/Wendy.

---

## 3. Key Decisions Locked (Kickoff)

### Platform stack
- **CRM:** GoHighLevel (GHL) — natively integrated with ConnexŪS AI. Paul to receive logins.
- **Voice agent:** ConnexŪS SDK (`portal.theconnexus.ai/ai-agent-sdk.js`). Proven on advisoryconnect.net.
- **Calendar:** Embedded in GHL.
- **Phone:** New business line + SMS provisioned by Elroy. Paul keeps RingCentral for fax (IRS still requires fax).
- **E-sign:** Paul's DocuSign + Adobe Sign via API.
- **Practice management:** Currently **Lawbility**. David evaluating Clio API.
- **Compliance:** SOC 2 + PII isolated. Encryption keys to Paul. Call recording ON during POC, OFF after.

### Funnels (two)
1. **Tax Planning funnel** — HNW prospects: $1M+ income, $10M+ NW, real estate focus.
2. **Tax Controversy funnel** — Prospects owing $250K+.

**Disqualifiers:** H-1B holders, undocumented individuals.
**NOT disqualifiers:** International / FIRPTA, multi-passport, green card holders, tourist-visa real estate buyers.

### Tier routing (the "v-rep architecture")
- **Reserve clients** — 100 max, numbered 001–100 (black-card). Phrase "I am a reserve client" → routes straight to Paul's mobile 24/7. ("There'll be a 007. There'll be an Agent 69. There'll be an Agent 99.")
- **Gold / Platinum** — routed to Wendy / calendar.
- **Retainer signature** flows **AFTER** calendar booking, not before.

### KPIs (baseline)
- 20 bookings / month
- 30-min slots
- 20% close rate
- **48 clients Year 1** baseline · **100** stretch

### Marketing
- Google Ads only at launch (Veronica). No other channels in baseline.

### Scope
- **Phase 1 = ENHANCE donovan.law**, not rebuild. Paul shipped the site himself; we layer voice agent + CRM + calendar + intake widget on top.

### Paul's quote of the meeting
> "We gotta move out of the foxhole."

---

## 4. Timeline

| Milestone | Target |
|---|---|
| POC demo | ~May 27, 2026 |
| Production deploy | ~June 3, 2026 |
| Standing cadence post-launch | Biweekly |

---

## 5. Document Set (this repo, `project-handoff/`)

### `01-strategy/`
- `legal-concierge-strategy-v2.md` — **master strategy v2.1** (markdown source, ~124KB)
- `legal-concierge-strategy-v2.1.docx` / `.pdf` — pandoc rendering
- `connexus-legal-concierge-strategy-v2.1.docx` / `.pdf` — **77pp ConnexŪS letterhead version** (client-facing)
- `donovan-redesign-plan.md` — site **enhancement** plan (rebranded from redesign after Paul shipped v1)
- `v1-archive-legal-concierge-strategy.md` — historical v1, do not use

### `02-meeting/`
- `donovan-meeting-minutes-2026-05-13.docx` / `.pdf` — ConnexŪS letterhead
- `donovan-meeting-brief.docx` / `.pdf` — pre-meeting brief (May 13 AM)
- `transcript-2026-05-13-webvtt.txt` — full WEBVTT transcript (1083 lines)

### `03-research/`
- `law-firm-intake-research.md` (88KB) + `.docx` report
- `legal-tech-widget-research.md` (61KB)
- `external-research.md` — early competitive scan
- `RAGbrain_Legal_Intake_Module_Plan.md`

### `04-site-analysis/`
- `donovan_law_website_analysis.md` (35KB) — Paul's new donovan.law audit
- `advisoryconnect_analysis.md` (25KB) — David's PI lead-gen site, retoolable as parallel landing
- `donovan_experience_analysis.md`, `donovan_law_extraction_report.md`, `donovan_law_all_pages_text.md` — raw site data
- `neiljesani-analysis.md`, `njplegal-analysis.md` — competitor visual references
- `donovan-law-site-reference.md` — original site reference

### `05-session-thread/`
- `turns/turn_0001.md` through `turn_0008.md` — verbatim conversation turns from this Perplexity session
- `turns-index.md` — index of turns

### `06-skills-and-scripts/`
- `connexus-ai-doc/` — full source of the user skill (SKILL.md, scripts, references, branding assets)
- `connexus-ai-doc.tar.gz` — portable tarball (1.8MB) for re-installing the skill on the new account
- `md_to_connexus.py` — helper to convert long markdown → connexus-ai-doc JSON schema
- `example-connexus-content.json` — sample input the script produced for the 77pp strategy doc

### `07-assets/`
- `PKD-Headshot.jpg` — Paul Donovan headshot
- `donovan_logo.png`, `donovan_favicon.png`, `donovan_firm_img.png` — Donovan Legal brand assets
- `donovan_0X_*.jpg` — 9 page screenshots of the live site
- `donovan_experience_top/bottom.jpg`, `donovan_law_screenshot.jpg` — additional captures

---

## 6. Active Work (status as of May 15, 2026 10:17 AM EDT)

### Drafted but NOT SENT
**Email** from David Pierce → Paul Donovan, cc Wendy/Leidy/Elroy/Veronica.
Subject: *"Donovan Legal × ConnexŪS AI — Kickoff Meeting Minutes, Action Items, and Document Set"*
Attachments: `donovan-meeting-minutes-2026-05-13.docx` + `connexus-legal-concierge-strategy-v2.1.docx` (letterhead version).
Format: structured business memo, 9 numbered sections. Full draft is recoverable from `05-session-thread/turns/turn_0006.md`.

### Open action items
- [ ] Paul/Wendy: provide full email roster
- [ ] Elroy: provision new business line + SMS
- [ ] David: send the drafted email (or have new Perplexity account regenerate + send) — **only after handoff package is verified clean**
- [ ] David: evaluate Clio API vs Lawbility
- [ ] Veronica: stand up Google Ads accounts under Tico AI
- [ ] Engineering: layer ConnexŪS voice agent SDK onto donovan.law (Phase 1 enhancement)
- [ ] Engineering: build two-funnel intake widget (iframe-wrappable, 100% mobile, shows text as user/agent talk)
- [ ] Engineering: implement v-rep tier routing (Reserve 001–100 → Paul mobile; Gold/Platinum → Wendy)
- [ ] Repo hygiene: confirm `TicoAI/donovan-law-site` should be deleted or kept as redirect-only; current state is `archive`/`duplicate` topics

---

## 7. Architectural Guardrails

From the user's standing instructions (do not violate):

1. **Build a Legal Concierge platform deployable to thousands of lawyers, not one.** Donovan is tenant #1; abstract everything reusable.
2. **Web widget MUST be iframe-style wrapper** deployable to ANY website.
3. **100% mobile-friendly.**
4. **Show text as user and agent talk** (transcript on-screen during voice).
5. **Guide the victim/prospect along the intake path** — explicit intake state machine, not free-form chat.
6. **Study law firms and design around how their intake already works** — do not invent novel workflows.
7. **Use all available skills and tools on this build.**
8. **All client-facing docs on ConnexŪS approved letterhead, authored by Walter White.**

---

## 8. Reference: ConnexŪS Document Generation

To regenerate any branded doc:

```bash
# 1. Build a connexus-content.json from your markdown source
python3 /home/user/workspace/donovanLAW/project-handoff/06-skills-and-scripts/md_to_connexus.py \
  --input source.md \
  --output connexus-content.json

# 2. Run the connexus-ai-doc skill
node skills/user/connexus-ai-doc/scripts/create-doc.js \
  --title "Your Title" \
  --type report \
  --content connexus-content.json \
  --output output.docx
```

### Letterhead spec
- Header: ConnexŪS AI + RAGböx.co logos
- Address: 3301 N University Drive, Coral Springs, FL 33065
- Footer: 1.888.888.3371 | info@theconnexus.ai
- Typography: Helvetica, navy/gray palette
- Author: Walter White, Liaison to David Pierce

> **Identifier exception:** the skill folder is `connexus-ai-doc` (lowercase, no accent) because it's a technical filename. The brand displayed in rendered output is **ConnexŪS**.

---

## 9. Reference: advisoryconnect.net (proven pattern)

- React/Vite SPA
- ConnexŪS voice agent "Leah" (PI/auto accident lead-gen)
- 4-step modal: **ACCIDENT → DAMAGE → LEGAL → CONNECT**
- Retell AI legacy agent ID: `agent_9cbf63b46e6ece83b38de5fc2d`
- Same iframe wrapper pattern → reuse for both Donovan funnels (Tax Planning + Tax Controversy)
- Could also be retooled as a parallel ad-traffic landing platform for Donovan (deferred decision)

---

## 10. Connectors

This handoff was prepared from a Perplexity session whose visible connector block included: `gcal`, `outlook`, `github_mcp_direct`, `jira_mcp_merge`, `confluence_mcp_merge`, `telegram_bot_api__pipedream`. The new account is reported to also have `slack_direct`, `onedrive`, `google_drive`, `youtube_analytics_api__pipedream` available — but visibility of connector status varies per session.

> **Do not assume parity.** On the new account, run `list_external_tools` first and re-authorize anything that comes back DISCONNECTED. See `MIGRATION-CHECKLIST.md` §B for the full target set.

> **`jira_mcp_merge`:** anecdotal reports of intermittent auth issues from prior sessions. No verified ticket ID is on file in this handoff. Re-test on the new account before relying on it; file a fresh `system_diagnostic` if it fails.

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **v-rep architecture** | Voice-Routed Engagement Pattern — tiered phone routing where the voice agent uses spoken keywords ("I am a reserve client") to switch routing tree |
| **Reserve client** | Top tier (001–100), black-card numbered, direct line to Paul |
| **Two-funnel** | Tax Planning (HNW $1M+/$10M+) vs Tax Controversy ($250K+ owed) — separate intake state machines |
| **GHL** | GoHighLevel CRM |
| **CCM** | Certified Cash Manager (one of Paul's credentials) |
| **FIRPTA** | Foreign Investment in Real Property Tax Act — relevant for international clients |
| **POC** | Proof of Concept (May 27 demo) |
| **ConnexŪS** | Brand name — capital U-with-macron is required in all prose |
| **RAGböx** | Brand name — lowercase o-with-umlaut is required in all prose |

---

*End of HANDOFF.md*
