<!--
  DRAFT FOR ATTORNEY REVIEW — NOT LEGAL ADVICE
  Prepared by: Atrium Compliance & Legal Agent (AI-generated research draft)
  Date: 2026-06-30
  Status: DRAFT — For review and approval by Paul Donovan, Esq. and FL Bar-admitted counsel BEFORE deployment.
  Do NOT use in production without attorney sign-off.
-->

# Minor Handling Protocol — Paola Voice Agent

**Maps to:** FL SB 482 "Artificial Intelligence Bill of Rights" (CS/SB 482, 2026) minor/companion-chatbot provisions; COPPA (Children's Online Privacy Protection Act, 15 U.S.C. §§6501-6506) if applicable; FL Bar Rule 4-1.18 (prospective-client confidentiality for any information gathered); general intake best practices for a law firm.

**SB 482 STATUS: UNCONFIRMED ENACTED.** Verified via flsenate.gov (2026-06-30): CS/SB 482 passed FL Senate 35-2 on 3/4/2026, then died in Messages (House) on 3/13/2026. No companion bill advanced. No special session revival found. Stated effective date was 7/1/2026. Paul and FL Bar-admitted counsel must confirm whether the bill was subsequently enacted. The protocol below is drafted to the SB 482 standard as a build-to-the-stricter-standard posture. This protocol is appropriate regardless of SB 482 enacted status given the law-firm intake context.

**Law-firm context note:** SB 482's companion-chatbot minor protections are targeted primarily at social/relationship AI platforms (companion bots, social AI apps). Paola is a law-firm front-door reception agent — it is not designed to, and must not function as, a companion or relationship chatbot. However, the minor-handling protocol is appropriate because: (1) if SB 482 is enacted it applies broadly to "bot operators"; (2) COPPA imposes data collection limits for children under 13 regardless of SB 482; (3) minors cannot generally enter binding legal engagement agreements; and (4) collecting sensitive legal matter information from a minor without parental awareness raises independent ethical concerns.

---

## PASTE-READY SYSTEM PROMPT BLOCK — MINOR HANDLING

Add this block to Paola's Retell LLM system prompt, after the UPL guardrail block and the do-not-volunteer block.

---

```
MINOR CALLER DETECTION AND HANDLING

If at any point during the conversation you have reason to believe the caller may be a minor — for example, they state their age as under 18, they describe themselves as a student in a context inconsistent with adult legal matters, or they explicitly state they are calling on behalf of a parent or guardian — follow this protocol immediately:

STEP 1 — STOP collecting information.
Do not ask for any personal information (name, phone, email, matter details). Do not record or summarize any information the caller has already shared into a new profile. If the caller has already provided information before you detected they may be a minor, do not use that information to create a stored profile.

STEP 2 — SAY THIS (verbatim or close variant):
"Thank you for calling Donovan Legal. Our AI assistant isn't set up to help callers under 18 directly, but a member of our team would be happy to speak with you or your parent or guardian. Would you like me to connect you with our front desk, or can I provide a phone number for you to call back with a parent or guardian?"

STEP 3 — ROUTE TO HUMAN OR PROVIDE DIRECT NUMBER.
Do not attempt to conduct an intake, collect qualifying information, or transfer to a specialist agent. Connect to human reception or provide the firm's direct phone number only.

STEP 4 — DO NOT store a profile for this session.
If the caller is identified as a minor, no visitor_id profile should be created or updated from this session. Log only: session timestamp, that the call was flagged as a potential minor caller, and that the call was routed to human reception. Do not log the substance of what was said.

---

WHAT COUNTS AS "REASON TO BELIEVE":
- Caller states age under 18
- Caller says "I'm in high school," "I'm 16," "my parents are..." in a context that implies the caller is the minor, not the adult
- Caller says they are calling for a parent or guardian (they may be a minor acting as an intermediary — in this case still route to human; do not conduct intake through a minor intermediary)

WHAT DOES NOT COUNT:
- Caller sounds young (do not profile callers by perceived voice characteristics)
- Caller asks simple questions about what the firm does (this is not a minor-detection trigger; answer generally and watch for other indicators)

---

END OF MINOR HANDLING BLOCK
```

---

## Regulatory Notes

### SB 482 Minor Provisions (unconfirmed enacted)
CS/SB 482 would have required companion chatbot platforms to prohibit a minor from becoming or being an account holder unless the minor's parent or guardian consents. The protocol above exceeds this requirement in the law-firm context: rather than permitting account creation with parental consent, Paola declines intake entirely and routes to a human. This is appropriate because (a) Paola is intake infrastructure, not a companion platform, and (b) a human attorney is the appropriate point of contact for any minor-adjacent legal matter.

### COPPA (15 U.S.C. §§6501-6506)
COPPA prohibits collecting personal information from children under 13 without verifiable parental consent. Donovan Legal's Perch/Paola system is not directed at children and should not knowingly collect information from a child under 13. The "stop collecting information" instruction in Step 1 is the COPPA-compliant response when a caller is identified as potentially under 13. Paul must confirm whether Donovan Legal's website and Perch widget include a COPPA notice / age-gate statement. A statement such as "This service is not directed at children under 13 and we do not knowingly collect information from children under 13" on the widget page is standard practice.

### Legal Capacity Note (for Paul's awareness)
Minors generally cannot enter binding contracts, including legal engagement agreements, without parental or guardian co-signature. Any inquiry that could lead to a legal engagement involving a minor as the client requires direct human attorney involvement. Paola must not conduct intake that functionally begins an engagement with a caller who cannot legally enter that engagement.

---

## What Paul must decide / finalize

1. **SB 482 enacted status:** See AI-DISCLOSURE.md item #7 and #8. Paul must confirm by 7/1/2026 whether SB 482 is binding. The minor-handling protocol is appropriate regardless, but if enacted the parental-consent requirement becomes a statutory obligation, not merely a best practice.

2. **"Under 18" threshold vs. "under 13" threshold:** This protocol uses under-18 as the threshold (aligned with SB 482's general minor definition and legal capacity concerns). COPPA's threshold is under-13. Paul should decide whether the firm wants a single under-18 protocol (conservative, simpler) or a tiered approach (under-13 COPPA-strict; 13-17 routing-to-human). The under-18 single-threshold is recommended for simplicity.

3. **COPPA notice on the widget page:** Paul should confirm whether the Perch widget page includes a COPPA age-directed statement. If not, add one before launch.

4. **Minor-as-intermediary scenario:** The protocol flags that a minor calling on behalf of a parent should be routed to human reception. Paul should confirm this is the right handling — the alternative (allow the minor to provide the parent's contact info and then route) creates data collection exposure. Routing to human is cleaner.

5. **Existing minor profiles:** If any stored visitor profiles from prior testing or soft-launch sessions were created from a caller who was or may have been a minor, those profiles must be deleted before launch.

---

*DRAFT — NOT LEGAL ADVICE. Requires approval by Paul Donovan, Esq. and FL Bar-admitted counsel before any production use.*
