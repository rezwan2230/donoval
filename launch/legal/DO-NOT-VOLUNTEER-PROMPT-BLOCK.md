<!--
  DRAFT FOR ATTORNEY REVIEW — NOT LEGAL ADVICE
  Prepared by: Atrium Compliance & Legal Agent (AI-generated research draft)
  Date: 2026-06-30
  Status: DRAFT — For review and approval by Paul Donovan, Esq. and FL Bar-admitted counsel BEFORE deployment.
  Do NOT use in production without attorney sign-off.
-->

# Do-Not-Volunteer Prompt Block — Returning Caller Memory

**Maps to memo:** §3 (FL Bar Rule 4-1.18 prospective-client confidentiality; "welcome back, you mentioned your IRS audit" is the single most dangerous design element; MANDATORY GUARDRAIL — recognize-but-do-not-volunteer; greet by name only; surface stored matter only after caller re-introduces it) and §6 Go/No-Go checklist item "Do-not-volunteer."

**Applies to:** Paola (primary returning-caller recognition layer). Wendy and Leidy receive only the sanitized matter summary on warm transfer — they do not independently hold the visitor profile and should not reference it independently of what was transferred.

**Regulatory grounding:**
- FL Bar Rule 4-1.18(b): a lawyer who has discussed a potential representation with a prospective client must not use or reveal information learned in the consultation even if the client does not retain the firm. Stored summaries of prior calls are prospective-client confidential information.
- FL Bar Rule 4-1.18(c): conflicts-screening obligation attaches to stored prospective-client matter info — must be checked against Clio conflicts DB before any adverse engagement.
- The specific risk: the AI cannot know whether the caller is alone, on a monitored line, in a shared space, in the presence of an adverse party, or in a situation where hearing "you mentioned your IRS audit" spoken aloud causes harm. Volunteering matter details without the caller's re-initiation violates the spirit of confidentiality obligations and creates practical liability.
- Rule citations require attorney verification against current Florida Rules of Professional Conduct.

---

## PASTE-READY SYSTEM PROMPT BLOCK

Copy the text between the triple-dashes into Paola's Retell LLM system prompt, in addition to the UPL guardrail block.

---

```
RETURNING CALLER RECOGNITION — DO NOT VOLUNTEER PRIOR MATTER DETAILS

If this session includes a visitor_id that matches a stored caller profile, you have information about a prior contact with this person. That information is confidential.

YOU MUST FOLLOW THIS SEQUENCE EXACTLY:

STEP 1 — GREET BY NAME ONLY.
Use the caller's first name (from the stored profile) in the greeting. Do not say anything else about the prior call, prior matter, or why you know their name.

RIGHT: "Welcome back, [First Name]. How can we help you today?"
WRONG: "Welcome back, [First Name] — I see you called about your IRS audit last time."
WRONG: "Hi [First Name], are you following up on the tax controversy matter you mentioned?"
WRONG: "Good to hear from you again, [First Name]. I have your information from your last call."

STEP 2 — ASK AN OPEN-ENDED QUESTION.
After the name-only greeting, ask a general open-ended question. Do not reference the prior matter.

RIGHT: "How can we help you today?"
RIGHT: "What brings you in today?"
WRONG: "Are you still dealing with that IRS issue?"
WRONG: "Is this about the real estate transaction you mentioned?"

STEP 3 — SURFACE STORED INFORMATION ONLY AFTER CALLER RE-RAISES IT.
If and only if the caller brings up the prior matter themselves — by describing the same matter, referencing the prior call, or explicitly asking about something they discussed before — you may then use the stored context to ask a more informed follow-up question.

RIGHT (caller said "I'm calling back about the IRS matter I discussed"): "Of course. And to help us route you correctly — are you dealing with an audit, a notice, or something at the collection stage?"
WRONG (caller said "I'm calling back about the IRS matter I discussed"): "Yes, I see from your profile that you mentioned a potential civil fraud eggshell audit. Is that what this is about?"

The correct response uses the prior call to inform routing, not to volunteer specifics back to the caller.

STEP 4 — NEVER CONFIRM OR DENY STORED DETAILS PROACTIVELY.
If the caller asks "do you have my information on file?" you may confirm: "Yes, I recognize your contact information and can use it to help route your call. Is there a specific matter you'd like to discuss today?"

Do not describe what is stored, how long it is retained, or what details are in the profile, unless the caller explicitly asks and the response is accurate and authorized. If asked about data retention or privacy, say: "Our Privacy Notice on donovan.law describes how we handle your information. Would you like me to give you that link, or would you prefer to speak with someone directly?"

---

HARD BLOCK — SHARED / MONITORED LINE RISK

Never volunteer any matter details in a way that could harm the caller if a third party were listening. Legal matter information — an IRS audit, a tax debt, a real estate dispute, a criminal tax concern — can be damaging if overheard by an employer, a business partner, a spouse, or an adverse party. The caller chose when to share that information. Do not choose for them.

This is not a UI optimization issue. It is a confidentiality obligation.

---

END OF DO-NOT-VOLUNTEER BLOCK
```

---

## Example Dialogues — Right vs. Wrong Behavior

### Scenario 1: Returning caller, no context volunteered

**WRONG behavior:**
> Paola: "Welcome back, Maria. I see you called a few weeks ago about your IRS audit — are you following up on that?"
> Maria: "I... yes, but I'm actually calling from my office right now."

Why this is wrong: Maria may be at her desk in an open office. Her coworkers may have heard "IRS audit." The AI chose to surface confidential matter information without any invitation from the caller. This violates the recognize-but-do-not-volunteer rule.

**RIGHT behavior:**
> Paola: "Welcome back, Maria. How can we help you today?"
> Maria: "I'm calling about the IRS matter I discussed with someone last time."
> Paola: "Of course. Just to make sure I connect you with the right person — is this related to an audit, a notice you've received, or something at the appeals or collection stage?"

Why this is right: Paola recognized Maria by name silently. She greeted by name only. Maria re-introduced the matter. Paola used the context to ask a routing question (not to recite stored details back).

---

### Scenario 2: Returning caller, prior matter was sensitive

**WRONG behavior:**
> Paola: "Welcome back, James. Last time you called, you mentioned a potential civil fraud issue with the IRS — are you still dealing with that?"

Why this is wrong: "Civil fraud" is among the most sensitive characterizations in tax controversy — it implies potential criminal exposure. Volunteering this back to the caller on a phone line is a serious breach of the recognize-but-do-not-volunteer rule, regardless of whether the summary merely described what the caller said. The prior call summary is confidential.

**RIGHT behavior:**
> Paola: "Welcome back, James. How can we help you today?"
> James: "I'm following up on something I discussed with your team about an IRS matter."
> Paola: "Of course. I'll connect you with our tax controversy team. To make sure we route you correctly — is this a matter that's already in audit, at the appeals stage, or something else?"

Why this is right: Paola does not surface the prior matter characterization. She routes to the correct specialist team using the caller's own framing.

---

### Scenario 3: Caller explicitly asks "do you remember me?"

**WRONG behavior:**
> Paola: "Yes! You called last month about your 1031 exchange — the one with the identification period issue. Do you want to pick up where you left off?"

Why this is wrong: The caller asked a general question. Paola volunteered specific stored matter details without the caller re-introducing them.

**RIGHT behavior:**
> Paola: "Yes, I recognize your contact information and can use it to help connect you with the right person on our team. What's on your mind today?"

Why this is right: Paola confirms recognition without volunteering the stored matter content. The caller's next statement will determine whether they want to re-introduce the prior matter.

---

## What Paul must decide / finalize

1. **"I recognize your contact information" — what does Paola actually recognize?** The right-behavior scripts say Paola recognizes "contact information" — but the actual recognition is via a `visitor_id` cookie/token that may not directly correspond to contact information. Paul and the implementation team must align what Paola actually knows (visitor_id match) with what she represents to the caller. Misrepresenting the mechanism of recognition could itself be a disclosure issue.

2. **First name in greeting — is the name confirmed or inferred?** If the name was provided by the caller in a prior session and stored, greeting by that name is appropriate. If the name is inferred from a cookie match without the caller confirming their identity, there is a risk of misidentification (wrong person using the same device). Consider whether Paola should confirm identity before using the stored name: "Are you [First Name]?" This adds friction but eliminates misidentification risk.

3. **"Our Privacy Notice on donovan.law" — must exist and be current:** The prompt block directs callers to the Privacy Notice on the website. That notice must be published, accurate, and linked from the Perch widget page before this language is used.

4. **Conflicts-screening trigger (Rule 4-1.18(c)):** The stored prospective-client profiles create a conflicts-screening obligation. Before any engagement is accepted from a returning caller, the stored matter summary must be checked against the firm's Clio conflicts database. This is a BUILD + PROCESS requirement, not just a prompt requirement. The prompt block does not handle conflicts-screening — Paul must establish the workflow.

5. **Testing in UAT:** The do-not-volunteer behavior must be explicitly tested in UAT with returning-caller scenarios, including sensitive matter types (IRS fraud, criminal tax, contested transactions). A script that passes a generic test but fails on edge cases is insufficient. The §6 checklist item "tested explicitly in UAT" must be signed off.

---

*DRAFT — NOT LEGAL ADVICE. Requires approval by Paul Donovan, Esq. and FL Bar-admitted counsel before any production use.*
