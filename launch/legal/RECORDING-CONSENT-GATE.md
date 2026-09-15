<!--
  DRAFT FOR ATTORNEY REVIEW — NOT LEGAL ADVICE
  Prepared by: Atrium Compliance & Legal Agent (AI-generated research draft)
  Date: 2026-06-30
  Status: DRAFT — For review and approval by Paul Donovan, Esq. and FL Bar-admitted counsel BEFORE deployment.
  Do NOT use in production without attorney sign-off.
-->

# Recording Consent Gate — Paola Voice Agent

**Maps to memo:** §1 (FL Stat. §934.03 all-party consent; §934.06 penalties; §934.10 civil remedy; pre-recording affirmative consent gate; decline branch) and §6 Go/No-Go checklist item "Recording consent."

**Regulatory grounding — WHY THIS GATE IS NON-OPTIONAL:**

Florida Statute §934.03 (last amended by Chapter 2024-131) makes it a **third-degree felony** to intentionally intercept, or procure another person to intercept, any wire, oral, or electronic communication without the consent of all parties. The "procure" prong directly reaches Donovan Legal as the entity directing Retell to record. Unlike federal law (one-party consent), Florida requires **all parties** to consent **prior** to interception.

Florida Statute §934.10 provides the civil remedy: actual damages (not less than $100/day or $1,000, whichever is greater), punitive damages, and attorney's fees, with a two-year discovery-triggered limitations period.

Florida Statute §934.06 renders any unlawfully intercepted communication inadmissible in any proceeding — meaning an unauthorized recording cannot even be used defensively.

Implied consent is read narrowly in Florida. The current "I'm an automated assistant" line does not state the call is being recorded, does not identify who is recording, and does not obtain affirmative consent before capture begins. It does not satisfy §934.03.

**Citation verification note:** FL Stat. §934.03 text confirmed via flsenate.gov (accessed 2026-06-30, Ch. 2024-131 amendment confirmed). §934.06 confirmed via flsenate.gov (exclusionary rule confirmed; full penalty text: counsel should read the full Chapter 934 compilation to confirm no subsequent amendments). §934.10 civil remedy confirmed via flsenate.gov (accessed 2026-06-30). FL Bar rules cited below: floridabar.org returned 403; ALL FL BAR RULE CITATIONS REQUIRE ATTORNEY VERIFICATION against the current Florida Rules of Professional Conduct.

---

## RECORDING CONSENT GATE SCRIPT

### Step 1 — Consent Ask (fires immediately after AI Disclosure, before any recording)

> "Before we continue, I want to let you know that Donovan Legal records calls to improve our service and for internal quality purposes. Florida law requires that I let you know about this and get your permission before recording begins.

> To give your consent to be recorded, please say 'I agree' or 'yes.'

> If you prefer not to be recorded, just say 'no' or 'decline,' and I'll arrange for a member of our team to call you back without recording."

---

### Step 2 — Affirmative Acknowledgement Path (caller says "I agree" / "yes" / affirmative)

> "Thank you. I have noted your consent. This call may now be recorded. Let's get started — how can I help you today?"

**System behavior on affirmative:** Retell begins audio capture / transcription. Log consent event with timestamp and session ID to durable storage. Proceed to normal intake flow.

---

### Step 3 — Decline Path (caller says "no" / "decline" / no response / unclear)

> "No problem at all. I'll make a note that you'd prefer not to be recorded. One of our team members will reach out to you by phone — without recording — at your convenience.

> May I get your name and the best phone number to reach you?"

**System behavior on decline:**
- Do NOT initiate recording or transcription.
- Offer non-recorded human callback only.
- Collect name + callback number in a non-recorded text-capture session only (if Retell supports text/form capture without audio recording; confirm with implementation team).
- If Retell cannot operate at all without recording, the system must end the call after providing the firm's direct phone number: "You can also reach us directly at [FIRM PHONE NUMBER]. Thank you for calling Donovan Legal."
- Do NOT store a summary of the conversation if it was not consented to be recorded.

**Critical implementation note:** The decline path must be a real, functional path — not a dead end. If no human callback mechanism exists at launch, the only compliant option is to end the call and provide the direct number. A non-functional decline path (where recording starts anyway, or the call just terminates with no recourse) is a violation of §934.03.

---

### Step 4 — No Response / Ambiguous Response

> "I didn't catch that clearly. Just to confirm — do you consent to this call being recorded? Please say 'yes' to agree, or 'no' to decline."

**System behavior:** Wait for a clear affirmative or negative. After two failed attempts, default to the DECLINE path (non-recorded callback) rather than proceeding with recording on an ambiguous response.

---

### Step 5 — Returning Caller (already in database — consent must be re-obtained each session)

Prior recording consent does NOT carry over to a new call session. Consent obtained in a prior call does not authorize recording of a new call. The gate must fire at the start of every new session, including returning callers. Stored visitor profiles must NOT be accessed or surfaced before this gate clears.

---

## Implementation Checklist (BUILD requirements)

| Item | Owner | Status |
|------|-------|--------|
| Gate fires before Retell begins audio capture/transcription | Engineering | Required pre-launch |
| Consent event logged with: session_id, timestamp, caller_id (if available), affirmative/decline | Engineering | Required pre-launch |
| Decline path routes to human callback without recording | Engineering | Required pre-launch |
| Ambiguous/no-response defaults to decline, not affirmative | Engineering | Required pre-launch |
| Gate is not skippable (no URL param, no session flag that bypasses it) | Engineering | Required pre-launch |
| Retell DPA confirms no training use of call data | Paul / Legal | Required pre-launch |
| Attorney approves final wording of this gate script | Paul Donovan, Esq. | Required pre-launch |

---

## What Paul must decide / finalize

1. **Human callback infrastructure:** Does the firm have a staffed callback line at launch? If not, the decline path must terminate with the direct number. Paul must confirm what the decline path connects to.

2. **"Improve our service and for internal quality purposes":** Confirm this accurately describes ALL uses of the recording. If Retell or any downstream vendor uses recordings for AI model training, this disclosure is insufficient. The DPA review (see subprocessors list) must resolve this before finalizing this language.

3. **Retell's technical recording start point:** Confirm with Retell whether audio capture begins at the start of the call or only after an explicit trigger. If Retell captures audio from call connect (even while playing TTS), the AI disclosure in AI-DISCLOSURE.md and this consent gate are both playing into a live recording — which defeats the consent gate entirely. This is an architecture question the implementation team must answer before launch.

4. **Conflict between Retell session flow and consent gate position:** Retell may play an initial greeting before any Retell-side logic can fire. Confirm the gate can be placed as the very first user-interactive event after the initial TTS greeting.

5. **Documentation retention:** Consent logs must be retained for at least as long as the recording they authorized — minimum the recording retention period (24 months per the memo's draft retention policy, or longer if the matter becomes an active engagement). Confirm logging and retention are implemented.

6. **TCPA note (separate from §934.03):** Recording consent under §934.03 does NOT constitute consent to receive autodialed or prerecorded outbound calls under TCPA. Any follow-up outreach workflow (e.g., automated callback scheduling, SMS confirmations) requires its own TCPA consent analysis. Do NOT reuse this recording consent as TCPA consent.

---

*DRAFT — NOT LEGAL ADVICE. Requires approval by Paul Donovan, Esq. and FL Bar-admitted counsel before any production use.*
