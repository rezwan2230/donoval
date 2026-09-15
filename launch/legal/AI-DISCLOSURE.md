<!--
  DRAFT FOR ATTORNEY REVIEW — NOT LEGAL ADVICE
  Prepared by: Atrium Compliance & Legal Agent (AI-generated research draft)
  Date: 2026-06-30
  Status: DRAFT — For review and approval by Paul Donovan, Esq. and FL Bar-admitted counsel BEFORE deployment.
  Do NOT use in production without attorney sign-off.
-->

# AI Disclosure Script — Paola Voice Agent

**Maps to memo:** §5 (AI disclosure requirement: use "AI/artificial intelligence" explicitly; state cannot give legal advice; nothing creates attorney-client relationship; fires at start of EVERY session including returning callers) and §6 Go/No-Go checklist item "AI disclosure."

**Regulatory grounding:**
- FL Bar Rule 4-7.13 (no false/misleading communications about the lawyer or lawyer's services)
- FL Bar Rule 4-5.3 (nonlawyer/AI supervision — Paul must approve this script before deploy)
- FL Bar Rule 4-1.4 (communication — client must understand nature of representation or lack thereof)
- FL Bar Rule 4-5.5 (UPL — disclosure that no legal advice is being given)
- FL Bar AI guidance (2024; verify current opinion — the floridabar.org rules URL returned 403, CITATION REQUIRES ATTORNEY VERIFICATION against current FL Bar published guidance)
- FL SB 482 "Artificial Intelligence Bill of Rights" (CS/SB 482, 2026) — **STATUS: UNCONFIRMED ENACTED. Verified via flsenate.gov (2026-06-30): bill passed FL Senate 35-2 on 3/4/2026, then DIED IN MESSAGES (House) on 3/13/2026. No companion bill (H 1395, H 659) advanced. No special session revival found.** Stated effective date was 7/1/2026. Paul and FL Bar-admitted counsel must confirm whether the bill was subsequently enacted by any mechanism. The hourly re-disclosure requirement below is drafted to the SB 482 standard as a build-to-the-stricter-standard posture regardless of enacted status.

---

## PRIMARY VERSION (recommended)

> "Hello, and thank you for calling Donovan Legal. My name is Paola, and I'm an artificial intelligence assistant — not an attorney and not a member of the firm's legal staff. I can help you learn about the firm's services and connect you with our team, but I cannot give legal advice, and nothing in our conversation creates an attorney-client relationship. Before we go further, I also need to let you know that this call may be recorded for quality and training purposes. I'll ask for your consent to that recording in just a moment. Now, how can I help you today?"

**Word count (spoken):** approximately 90 words. Estimated spoken time at natural cadence: 30–35 seconds.

**What this version covers:**
- States "artificial intelligence" explicitly (not just "automated assistant")
- States not an attorney / not legal staff
- Expressly disclaims legal advice
- Expressly disclaims attorney-client relationship formation
- Flags that recording consent will follow (bridges to RECORDING-CONSENT-GATE)

---

## HOURLY RE-DISCLOSURE (SB 482 — unconfirmed enacted status; build-to-standard posture)

**Context:** FL SB 482, had it been enacted, would have required bot operators to notify users at the start of an interaction AND periodically (reported as at least every ~60 minutes) that they are interacting with AI, not a person. The bill's enacted status is unconfirmed (see regulatory grounding above). However, for a law-firm intake context, building to this standard costs almost nothing and eliminates exposure if the bill was revived or if future regulation adopts a similar standard. Paul must decide whether to implement it; the conservative position is to implement it now.

**Practical note on law-firm intake calls:** Most Paola sessions will be well under 60 minutes. This re-disclosure is a tail-risk safeguard for extended calls (e.g., a caller who stays on the line through multiple routing attempts or a warm-transfer sequence that runs long).

**Trigger:** Paola detects the session has been active for approximately 55–60 minutes without a prior re-disclosure having fired in the current session.

> "Just a quick reminder: you're speaking with Paola, Donovan Legal's AI assistant — not an attorney and not a human staff member. I still can't give legal advice and nothing in this conversation creates an attorney-client relationship. How can I help you?"

**What this re-disclosure covers:**
- Reaffirms AI identity (SB 482 periodic notification requirement, enacted status unconfirmed)
- Reaffirms no legal advice / no attorney-client relationship (FL Bar Rules 4-7.13, 4-1.4)
- Short enough not to interrupt a substantive intake conversation materially (~20 seconds)

**Implementation note:** The 55-minute trigger must be session-elapsed-time, not call-connected-time, to handle calls where the caller was placed on hold. Confirm with Retell whether session duration tracking is available in the agent's context.

---

## TIGHTER VARIANT (for callers who have already heard the full version this session — repeat short-form)

> "Hi, I'm Paola, Donovan Legal's AI assistant. Just a quick reminder: I'm not an attorney, I can't give legal advice, and this conversation doesn't create an attorney-client relationship. How can I help you today?"

**When to use this variant:** Use the PRIMARY VERSION at the absolute start of every new call session. The tighter variant may be appropriate only when Retell's session logic confirms the full disclosure already fired earlier in the same uninterrupted call session. It must NOT substitute for the primary version at the start of a fresh call. Paul must decide whether the short form satisfies FL Bar requirements; conservative position is to always use the primary.

---

## What Paul must decide / finalize

1. **"May be recorded" vs. "is recorded":** The primary version says "may be recorded." If all calls are always recorded, this should say "is recorded." Using "may" when recording is always on could itself be misleading (FL Bar Rule 4-7.13). Paul must confirm the technical reality and align the language.

2. **Name "Paola" — advertising implications:** Paola is a named persona on a firm website. FL Bar advertising rules 4-7.11 through 4-7.22 apply. The responsible attorney (Paul Donovan) must be identified somewhere accessible to the caller (this disclosure does not name him; the firm name is present). Confirm whether the responsible-attorney identification satisfies 4-7.12 via firm name alone or whether Paul's name must appear in the verbal disclosure or the website page where the widget is embedded.

3. **"Quality and training purposes":** If Retell uses call data for training its own models, this language may be insufficient — it implies the firm's quality/training, not a third-party AI vendor's model training. Verify Retell's DPA and data use terms; this language must match actual use. If Retell trains on data, additional disclosure is required.

4. **Short-form variant threshold:** Confirm with FL Bar-admitted counsel whether the short-form variant is legally sufficient for returning callers or whether the full primary disclosure is required at every call start regardless of prior exposure.

5. **"Not a member of the firm's legal staff":** This language is intended to prevent any impression that Paola is a paralegal or supervised nonlawyer employee. Confirm it does not inadvertently suggest Paola is contracted separately in a way that creates different expectations. Alternative phrasing: "not a person, not an attorney, and not an employee of the firm."

6. **Timing relative to recording:** This script must fire BEFORE audio is captured by Retell. Confirm with the Retell integration that the TTS playback of this disclosure runs before any recording or transcription begins. If Retell captures audio from the first millisecond, the recording consent gate (RECORDING-CONSENT-GATE.md) must technically precede even this disclosure — coordinate with the Retell implementation team.

7. **SB 482 enacted status — Paul must confirm:** The hourly re-disclosure is built to the SB 482 standard as a precaution. Paul and FL Bar-admitted counsel must determine by 7/1/2026 (the bill's stated effective date) whether SB 482 or any equivalent provision is now binding. If enacted, the hourly re-disclosure is mandatory. If not enacted, it remains best practice but is not currently required by statute. The $50,000-per-violation civil penalty cited in SB 482 (FL Dept of Legal Affairs enforcement) creates a strong build-to-standard case regardless of enacted status.

8. **SB 482 companion bills:** H 1395 and H 659 were companion measures that also died in the 2026 session. A re-filed or amended version of any of these bills in a 2027 session or a special session would impose disclosure obligations. Paul should monitor FL legislative developments and flag to the implementation team if any such bill advances.

---

*DRAFT — NOT LEGAL ADVICE. Requires approval by Paul Donovan, Esq. and FL Bar-admitted counsel before any production use.*
