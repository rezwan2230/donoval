# COMPLIANCE MEMO — DRAFT FOR ATTORNEY REVIEW ONLY
**Project:** Donovan Legal PLLC — Perch AI Voice Concierge ("Paola") with Returning-Caller Memory
**Prepared by:** Atrium Compliance & Legal Agent (AI-generated research draft)
**Date:** 2026-06-25
**Status:** DRAFT — For review by Paul Donovan, Esq. and Florida Bar-admitted counsel before any feature goes live. NOT legal advice.

---

## Verdict
Returning-caller memory is legally workable for a Florida law firm under the right conditions, but it requires more than a standard tech privacy notice — explicit two-party recording consent before recording begins, a firm-specific privacy notice at the point of capture, and mandatory guardrails preventing the AI from volunteering prior matter details aloud without caller-initiated confirmation. None are satisfied by the current "I'm an automated assistant" disclosure alone. Build should not go to production until the Section 6 checklist is cleared by Paul Donovan + FL Bar-admitted counsel.

## 1. Florida recording consent (Fla. Stat. §934.03 — all-party consent; §934.06 penalties)
- Recording without all-party consent is a 3rd-degree felony; "procure" prong reaches Retell.
- Current AI disclosure does NOT cover recording — doesn't state call is recorded, who records, or obtain affirmative consent BEFORE recording starts. Implied consent read narrowly in FL.
- Storage compounds exposure; sensitive matter summaries raise damages.
- TCPA: capturing a phone number is NOT consent for later autodialed/prerecorded outbound — any follow-up workflow needs its own consent analysis.
- Need a pre-recording disclosure the caller affirmatively acknowledges ("press 1 / say I agree") BEFORE audio is captured. Draft language in memo; attorney finalizes.
- Uncertainty: conflicts-of-law if Retell server is out-of-state — assume FL applies whenever a party is in FL.

## 2. PII & data protection
- Data: name, email, phone, matter interest ("IRS audit"), conversation summaries = sensitive.
- FL Digital Bill of Rights (SB 262) applies only to >$1B-revenue controllers → not Donovan. No FL omnibus DSR framework applies.
- Still bound by: Rule 4-1.6 confidentiality, TCPA (phone), CAN-SPAM (email), common-law negligence on breach. GDPR/CCPA only if serving those residents at volume.
- Storage is a distinct processing op — inform caller (what/how long/why) before storage. Publish a Privacy Notice linked on the Perch widget page, visible before the call.
- Retention policy needed (drafts: prospective profiles 12mo; recordings 24mo unless matter; client matters per Rule 5-1.1 ≥6yr). Deletion path MUST exist (Firestore doc + recordings + summaries) completable in 30 days — a BUILD requirement.
- Security: visitor_id MUST be cryptographically random UUID; server-side validation that session matches stored visitor_id (not pure client-side lookup); role-controlled + logged staff access; WRITE_SECRET MUST be set in prod.

## 3. Confidentiality & privilege (Fla. Bar Rule 4-1.18)
- Pre-engagement intake is NOT privileged but IS confidential under 4-1.18(b) — even if the caller never retains the firm. Stored summaries are prospective-client confidential info.
- Must not be accessible to marketing vendors, third-party analytics, or Retell's training pipeline (verify Retell DPA).
- **"Welcome back, you mentioned your IRS audit" is the single most dangerous design element** — AI can't know if caller is alone / on a shared/monitored line / would be harmed by the matter spoken aloud.
- **MANDATORY GUARDRAIL — recognize-but-do-not-volunteer:** recognize visitor_id silently → greet by NAME only ("Welcome back, Elroy") → ask open-ended ("How can we help today?") → only surface/use the stored matter AFTER the caller re-introduces it.
- Conflicts (4-1.18(c)): stored prospective-client matter info creates a conflicts-screening obligation — must be checked against the firm's conflicts DB (Clio) before any adverse engagement.

## 4. Agent-to-agent context carry on warm transfer
- Verbatim transcript carry is RISKY: may include distress/anger statements, third-party references, incidental personal disclosures, inconsistencies, 4-1.18(c) disqualification material.
- **Recommendation: pass a sanitized, attorney-reviewed MATTER-SUMMARY to Wendy/Leidy — NOT the verbatim transcript.** Store the transcript separately (attorney-accessible, not injected into the specialist's active context).
- Specific risk: specialist echoing/acting on inflammatory or off-topic prior content. Specialist should work from facts, not the rhetorical texture of a prior call.
- If Retell only supports one context blob, pre-process the transcript into a sanitized summary before passing — a BUILD requirement.

## 5. FL Bar advertising, ethics, AI supervision, UPL
- Rules: 4-7.11–4-7.22 (advertising), 4-5.3 (nonlawyer/AI supervision), 4-5.5 (UPL), 4-1.4 (communication); confirm current FL Bar AI opinion (2024 guidance) by human attorney.
- Advertising: Paola on a firm site is almost certainly lawyer advertising — name Paul Donovan as responsible attorney (4-7.12); "welcome back" re-engagement has a solicitation dimension (4-7.18); no false/misleading (4-7.13); determine 4-7.22 filing requirement.
- 4-5.3 supervision: Paul must review/approve ALL prompts before deploy (current DRAFT notation is correct), be able to update them, keep interaction logs.
- **UPL hard guardrails (embed in each prompt as explicit prohibitions + examples):** AI must NOT analyze the caller's situation, predict outcomes, quote fees beyond published, interpret statutes/cases to facts, advise pre-attorney, or characterize exposure. AI MAY describe practice areas/process, ask qualifying questions, confirm published fees/availability, transfer to human. Hard stop-and-transfer for anything needing legal analysis.
- AI disclosure: use the word "AI/artificial intelligence" explicitly; state it cannot give legal advice + nothing creates attorney-client relationship; fire at the start of EVERY session incl. returning callers.

## 6. Go/No-Go checklist (preconditions, not suggestions)
**Recording consent:** pre-recording affirmative consent gate before any audio; decline → non-recorded human callback/end; disclosure fires before capture; Paul finalizes language.
**Privacy notice:** published + linked on the widget page, visible before call.
**Data/retention:** written retention policy (Paul approves periods); tested deletion path ≤30 days; WRITE_SECRET set in prod; visitor_id cryptographically random.
**Do-not-volunteer:** prompt updated to greet-by-name-only; matter surfaced only after caller re-raises; tested explicitly in UAT.
**Warm-transfer sanitization:** specialist gets structured matter-summary, not verbatim; template attorney-approved.
**Supervision/UPL:** all prompts approved by Paul; UPL prohibitions embedded with examples; 4-7.22 filing determination; FL Bar-admitted counsel reviews memo + prompts.
**Conflicts:** workflow to check profiles vs conflicts DB before adverse engagement.
**Retell DPA:** confirm no training use, storage locations, deletion-on-request, SOC2.
**AI disclosure:** updated wording; every session.

*Draft by an AI compliance research agent. NOT legal advice. Requires review/approval by Paul Donovan, Esq. and FL Bar-admitted counsel. Verify all citations against current sources.*
