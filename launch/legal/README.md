<!--
  DRAFT FOR ATTORNEY REVIEW — NOT LEGAL ADVICE
  Prepared by: Atrium Compliance & Legal Agent (AI-generated research draft)
  Date: 2026-06-30
  Status: Index document — see individual artifact files for substantive content.
-->

# Legal Compliance Artifacts — Index
## Donovan Legal PLLC / Paola AI Voice Concierge

**Parent memo:** `C:\tmp\DonovanLegal\perch-legal-compliance-memo.md` (read this first for the legal analysis; these artifacts implement its §6 checklist)

**Prepared by:** Atrium Compliance & Legal Agent (AI-generated research draft, 2026-06-30)

**NOT legal advice. All artifacts require review and written approval by Paul Donovan, Esq. and FL Bar-admitted counsel before any production use.**

---

## Recent FL Developments — Read Before Go/No-Go Sign-Off

### FL SB 482 "Artificial Intelligence Bill of Rights" (CS/SB 482, 2026) — STATUS: UNCONFIRMED ENACTED

**Verified via flsenate.gov (2026-06-30):** Passed FL Senate 35-2 on 3/4/2026. Died in Messages (House) on 3/13/2026. Companion bills H 1395 and H 659 also died. No special session revival found as of research date. Stated effective date: 7/1/2026.

**Paul must verify** whether the bill was enacted by any subsequent mechanism (late-session action, special session, gubernatorial executive action) before or on 7/1/2026. A legislative tracking service or FL Dept of Legal Affairs inquiry is the right channel — do not rely solely on this memo's research date.

**Relevant provisions (if enacted):** Right to know you are communicating with AI; bot operators must notify users at the start of an interaction AND periodically (reported as at least every ~60 minutes) that they are interacting with AI, not a person; companion chatbot platforms must prohibit minors from holding accounts without parent/guardian consent; no selling/disclosing user personal info unless deidentified; civil penalties up to $50,000 per violation enforced by FL Dept of Legal Affairs.

**Artifacts updated:** AI-DISCLOSURE.md (hourly re-disclosure section added), MINOR-HANDLING.md (new artifact), FL-BAR-ADVERTISING-CHECKLIST.md (new Part C checklist). All are built to the SB 482 standard regardless of enacted status.

### FL Supreme Court Rule 2.515(d)(2) — Effective 6/15/2026

**Does NOT apply to Paola or the intake system.** Rule 2.515(d)(2), effective 6/15/2026, requires attorneys signing court filings to certify the accuracy of any AI-generated citations or legal research included in those filings. This is a court-filing rule, not a client-intake or AI-agent rule.

**However, flag to Paul for the firm's litigation practice:** Any brief, motion, or filing prepared with AI assistance (including research tools, drafting assistants, or citation generators) must comply with Rule 2.515(d)(2). Paul should confirm the firm's litigation workflow accounts for this certification requirement. This is not a Paola/Perch item — it is a separate firm-wide practice management obligation effective now.

---

## Artifact Index

| File | Purpose | Memo Section | Go/No-Go Gate |
|------|---------|--------------|---------------|
| AI-DISCLOSURE.md | Verbatim spoken disclosure Paola delivers at the start of EVERY session + hourly re-disclosure for extended sessions; covers AI identity, no legal advice, no attorney-client relationship | §5 (AI disclosure), §6 checklist item "AI disclosure"; SB 482 periodic notification (unconfirmed enacted) | LAUNCH BLOCKER — Paul approves final wording |
| RECORDING-CONSENT-GATE.md | Pre-recording affirmative consent script; FL §934.03 all-party consent; decline branch; §934.10 civil remedy context | §1 (FL recording consent), §6 checklist item "Recording consent" | LAUNCH BLOCKER — felony exposure without this gate |
| UPL-GUARDRAIL-PROMPT-BLOCK.md | Paste-ready system prompt block for Paola, Wendy, Leidy; MUST-NOT and MAY lists with examples; hard-stop trigger phrases | §5 (UPL, 4-5.5, 4-5.3), §6 checklist item "Supervision/UPL" | LAUNCH BLOCKER — Paul must personally approve all prompts per Rule 4-5.3 |
| DO-NOT-VOLUNTEER-PROMPT-BLOCK.md | Returning-caller memory guardrail; recognize-but-do-not-volunteer; right vs. wrong example dialogues | §3 (Rule 4-1.18, confidentiality), §6 checklist item "Do-not-volunteer" | LAUNCH BLOCKER — returning-caller feature must not go live without this |
| MINOR-HANDLING.md | Minor caller detection and routing protocol; data-collection stop; human routing; SB 482 minor provisions; COPPA note | SB 482 minor/parental-consent provision (unconfirmed enacted); COPPA; legal capacity | LAUNCH BLOCKER — minor data collection exposure if not implemented |
| FL-BAR-ADVERTISING-CHECKLIST.md | Launch-blocking checklist for FL Bar advertising rules; SAMPLE deal material securities flag; SB 482 compliance checklist (Part C) | §5 (advertising rules 4-7.11–4-7.22), §6 checklist items "Supervision/UPL" and "4-7.22 filing"; SB 482 | LAUNCH BLOCKER — 5 items require counsel determination (was 4, +1 for SB 482 enacted status) |

---

## Memo §6 Go/No-Go Checklist Mapping

| §6 Checklist Item | Artifact(s) That Address It | Remaining BUILD Work | Remaining ATTORNEY Work |
|------------------|-----------------------------|----------------------|-------------------------|
| Recording consent: pre-recording affirmative consent gate before any audio | RECORDING-CONSENT-GATE.md | Gate must fire before Retell audio capture begins; consent logged with timestamp + session ID; decline path routes to human callback | Paul finalizes wording; counsel confirms compliance with §934.03 |
| Privacy notice: published + linked on widget page, visible before call | None (not yet drafted — BUILD + LEGAL item) | Engineering places link on widget page before widget activates | Paul drafts/approves Privacy Notice; counsel reviews |
| Data/retention: written retention policy; tested deletion path; WRITE_SECRET set in prod; visitor_id cryptographically random | None (BUILD item from memo §2) | Retention policy BUILD; Firestore deletion path; WRITE_SECRET in prod; UUID generation | Paul approves retention periods in written policy |
| Do-not-volunteer: prompt updated; matter surfaced only after caller re-raises; UAT tested | DO-NOT-VOLUNTEER-PROMPT-BLOCK.md | Embed prompt block; UAT test with returning-caller scenarios including sensitive matter types | Paul approves prompt; counsel confirms Rule 4-1.18 compliance |
| Warm-transfer sanitization: specialist gets structured matter-summary, not verbatim | Addressed in UPL-GUARDRAIL-PROMPT-BLOCK.md (context carry block) | Build sanitized summary template; confirm Retell supports summary-only transfer (not verbatim transcript) | Paul approves summary template format |
| Supervision/UPL: all prompts approved by Paul; UPL prohibitions embedded with examples; 4-7.22 filing determination; FL Bar counsel reviews | UPL-GUARDRAIL-PROMPT-BLOCK.md, FL-BAR-ADVERTISING-CHECKLIST.md | Embed prompt block in all 3 agents; specialist-specific prompts for Wendy + Leidy | Paul personally reviews and signs off on each prompt; FL Bar counsel determines 4-7.22 filing requirement |
| Conflicts: workflow to check profiles vs conflicts DB before adverse engagement | Not drafted (process item) | Build conflicts-check integration with Clio before any returning-caller engagement is accepted | Paul establishes the workflow and sign-off protocol |
| Retell DPA: confirm no training use; storage locations; deletion-on-request; SOC2 | Referenced in RECORDING-CONSENT-GATE.md and UPL-GUARDRAIL-PROMPT-BLOCK.md | Obtain and review Retell DPA | Paul / counsel review Retell DPA; confirm Rule 4-1.6 compliance |
| AI disclosure: updated wording; every session | AI-DISCLOSURE.md | Confirm Retell fires disclosure before recording starts; no session path that bypasses it | Paul approves final wording; counsel confirms Rule 4-7.13 compliance |

---

## Items NOT in These Artifacts (Additional BUILD + LEGAL Work Required)

The following were flagged in the memo but are not addressed by the five artifacts above:

1. **Privacy Notice draft** — Must be published and linked on the Perch widget page before launch. Not yet drafted. Requires Paul's approval and counsel review. (Memo §2)

2. **Retell DPA review** — Must confirm no training use of call data, storage location (US/EU), deletion-on-request path, SOC2 or equivalent. (Memo §2, §3, §6)

3. **Warm-transfer sanitized summary template** — The structured format Paola passes to Wendy/Leidy. Not yet a formal template. Must be attorney-reviewed before specialist agents go live. (Memo §4)

4. **Conflicts-check workflow with Clio** — Process for checking stored prospective-client profiles against conflicts DB before any adverse engagement. Not built. (Memo §3, Rule 4-1.18(c))

5. **Data deletion path** — Tested path to delete Firestore visitor profile + summaries + recordings within 30 days on caller request. Must be operational before launch. (Memo §2)

6. **TCPA analysis for outbound workflows** — Recording consent under FL §934.03 is NOT TCPA consent. Any automated follow-up (SMS, callback scheduling, email) needs separate analysis. (Memo §1)

7. **Securities review of SAMPLE deal documents** — `diamond/SAMPLE_Small_JV_No_Reg_D.html` and related files require review by securities-competent counsel independent of the FL Bar advertising analysis. (FL-BAR-ADVERTISING-CHECKLIST.md §B1)

8. **SB 482 enacted status verification** — Paul must confirm by 7/1/2026 (the bill's stated effective date) whether CS/SB 482 or any equivalent is binding. If enacted: hourly re-disclosure (AI-DISCLOSURE.md), minor handling (MINOR-HANDLING.md), and deidentified-data handling (Retell DPA) all become statutory obligations rather than best-practice postures. $50,000/violation civil penalty. See "Recent FL Developments" section above.

9. **FL Supreme Court Rule 2.515(d)(2) (effective 6/15/2026)** — Does not affect Paola/intake, but the firm's litigation practice must certify citation accuracy for any AI-assisted court filings. See "Recent FL Developments" section above. Paul should confirm the litigation workflow accounts for this now-in-effect requirement.

---

## Who Signs Off on What

| Item | Paul Donovan, Esq. | FL Bar-Admitted Counsel | Engineering |
|------|--------------------|------------------------|-------------|
| All Retell agent prompts (Rule 4-5.3) | SIGNS OFF | Reviews for compliance | Implements |
| AI disclosure wording | SIGNS OFF | Reviews | Implements |
| Recording consent gate wording | SIGNS OFF | Confirms §934.03 compliance | Implements gate logic |
| FL Bar advertising rule determinations (4-7.12, 4-7.18, 4-7.22) | Reviews | SIGNS OFF | N/A |
| SAMPLE deal document securities review | Reviews | SIGNS OFF (or refers to securities counsel) | N/A |
| Privacy Notice | SIGNS OFF | Reviews | Publishes / links |
| Retell DPA | SIGNS OFF | Reviews Rule 4-1.6 compliance | N/A |
| Deletion path | Approves scope | N/A | BUILDS |

---

*All artifacts in this directory are DRAFT — NOT LEGAL ADVICE. No artifact in this directory may be deployed, published, or used in any production environment without written approval by Paul Donovan, Esq. and FL Bar-admitted counsel.*
