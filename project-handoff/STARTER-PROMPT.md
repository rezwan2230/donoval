# Starter Prompt — Paste Into New Perplexity Account

> Copy everything below the line into your first message to Perplexity Computer on the new account.

---

I am continuing a project that was previously running in another Perplexity account. All state, decisions, documents, and source files are stored in the GitHub repo **`TicoAI/donovanLAW`** (private — this is the canonical Cloud Run site repo), in the `project-handoff/` folder.

> Do not confuse this with `TicoAI/donovan-law-site` or `TicoDavid/donovan-law-site` — both are tagged `archive`/`duplicate` and must be ignored. Canonical is **`TicoAI/donovanLAW`** only.

**Please start by doing the following, in order:**

1. **Read `project-handoff/HANDOFF.md`** at https://github.com/TicoAI/donovanLAW — that file is the complete state snapshot.
2. **Read `project-handoff/MIGRATION-CHECKLIST.md`** to verify which credentials and connectors I still need to wire up on this account.
3. **Install the `connexus-ai-doc` user skill** from `project-handoff/06-skills-and-scripts/connexus-ai-doc.tar.gz`. This is required for all client-facing documents (they must be on ConnexŪS letterhead, authored by Walter White).
4. **Read `project-handoff/05-session-thread/turns/turn_0008.md`** — that is the most recent thing we worked on (creating the ConnexŪS-branded 77pp strategy v2.1 doc on letterhead).
5. **Confirm to me** when you've absorbed everything, list any gaps (missing connectors, skills, or files), and propose the next action.

## Quick context for you (the agent)

- I am **David Pierce**, project lead for **ConnexŪS AI** / **Tico AI**.
- Email (canonical): **david@ticoai.net**
- Email (legacy/session header): david@scaleagilesolutions.com — do not use as default.
- Location: Boca Raton, FL · Timezone: America/New_York
- GitHub orgs: **TicoAI** (canonical) / **TicoDavid** (personal, redirect alias only)
- GCP identity: **theconnexusai@gmail.com**
- Local: Windows / PowerShell, `C:\Users\d0527`
- AI persona for docs: **Walter White, Liaison to David Pierce**

## Brand spelling (non-negotiable)

- **ConnexŪS** — capital U-with-macron, always
- **RAGböx** — lowercase o-with-umlaut, always
- Technical strings (skill name `connexus-ai-doc`, domain `theconnexus.ai`, file paths) stay un-accented because they are identifiers.

## Active deliverable

I am about to send an email to Paul Donovan (CPA/Esq., Donovan Legal PLLC) and his team with the kickoff meeting minutes and the v2.1 strategy doc attached. The email draft is captured in `project-handoff/05-session-thread/turns/turn_0006.md`. **Do NOT send it without my explicit go-ahead** — the handoff package itself had inconsistencies that required fixing first.

## Standing instructions (preserve verbatim across all work)

1. *"I want to build a Legal Concierge platform: I want something that can deploy to thousands of lawyers...not 1"*
2. *"The web widget should be an IFrame style wrapper that would allow us to deploy onto ANY website anywhere. It should be designed to be 100% mobile friendly. It should SHOW text as you and the agent talk. It should help guide the victim along the intake path."*
3. *"I think you study LAW FIRMS and design around them and COPY how their intake processes already work."*
4. *"I want to use all of our skills and tools on this build"*
5. *"I want this created on ConnexŪS approved letterhead Walter."* (all client-facing docs)

---

*End of starter prompt.*
