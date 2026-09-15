# Compliance Note — Tax-Controversy Intake Divergence (Paula / Perch)

**Status: BUILT, staged live behind Paula's prompt — REQUIRES Paul + Florida Bar sign-off before it is treated as approved.**
Date: 2026-07-16 · Owner of decision: Elroy (CHARTER §16 reserved — compliance) · Built by: CoS

---

## What this documents

Paul's own intake script — `PAUL-Donovan-Legal-Tax-Controversy-Intake-Script.txt`
(Version 2.0) — closes with a **Compliance Note** locking four elements that
"**are not optional and must not be cut or softened**," and requiring Florida
Bar advertising / professional-conduct review before use:

1. The non-engagement language
2. The confidentiality / limit-detail note
3. **The criminal-indicator hard stop**
4. **The human-only requirement** ("This intake is human only — never automated.")

The tax gatekeeping modal we shipped for Paula (the "#7" build) **diverges from
elements 3 and 4** (and softens the $250K amount gate). This file records the
divergence so it is not buried in code, per the rule that a load-bearing
compliance gate is documented on the record, not left implicit.

## The divergence, precisely

| Paul's locked script | What we built (per Elroy) | Divergence |
|---|---|---|
| Element 4 — tax intake is **human-only, never automated** | Tax triage runs through Paula (an automated voice agent) + an on-screen tap card | **Direct** — automates what the script forbids automating |
| Element 3 — criminal indicator is a **hard stop**: do NOT book, refer out to criminal-tax counsel, flag urgent | Criminal question is asked (tap or volunteered), **flagged for Paul, and the caller is still booked** into an orientation; Paul assesses fit at the orientation | **Direct** — converts a refuse-to-book gate into a book-and-flag |
| $250K amount-in-controversy gate → under $250K = **warm referral**, not the firm's matter | Everyone books regardless of amount (Paul filters at the orientation) | **Soft** — Paul can still warm-refer at orientation |
| Element 1 — non-engagement language | Paula speaks it at call open (CORE-035) | **Preserved** |
| Element 2 — confidentiality / limit-detail note | Paula speaks it near-verbatim before opening the tax card | **Preserved** |

## Why we built it this way

Elroy made this call deliberately, after the conflict with elements 3 and 4 was
laid out explicitly. The product rationale: a single unified flow where **every
caller books** (no dead-ends), the sensitive triage facts are answered by **tap
rather than out loud** (gentler for a stressed caller and better for privacy
than speaking dollar amounts / criminal exposure aloud), and **Paul makes the
fit decision at the orientation** — including whether the firm is the right
place for a matter with a criminal dimension. The criminal question is still
**asked and flagged** on every tax caller; it simply routes to Paul's judgment
instead of an automated refer-out.

## What is preserved as a safety floor

- **Distress hard stop (Paula Hard Rule 9)** is unchanged — a caller in evident
  crisis is still routed to an urgent human callback, and it takes precedence.
- **Criminal exposure is always recorded** — `flag_criminal: "yes"` on the
  stored record and "criminal-exposure flag — Paul to assess fit at orientation"
  in the lead note. Nothing about a criminal indicator is dropped; it is
  surfaced to Paul, not hidden.
- **Urgent deadlines are flagged** — `flag_urgent: "yes"` for a 90-day notice or
  a sub-30-day deadline; Paula opens the earliest date and notes "time-sensitive
  — deadline running."
- Paula never tells a caller the firm can or cannot take a criminal matter, never
  advises, never predicts — consistent with the script's screening-not-advice line.

## Required before this is "approved" (not just built)

1. **Paul's explicit written sign-off** to override elements 3 and 4 of his own
   locked script — specifically: (a) automating tax-controversy intake, and
   (b) booking criminal-flagged callers rather than refer-out.
2. **Florida Bar advertising / professional-conduct re-review** of the automated
   tax-intake flow and Paula's spoken tax language, per the script's own
   compliance note.
3. Confirm the **confidentiality / retention posture** of storing tax-dispute
   triage answers (matter, amount, posture, criminal flag) in the Perch bridge
   Durable Object + Vantage — the script cites confidentiality/discoverability
   as reason #1 for keeping this human. Confirm retention + access are
   defensible, or gate the criminal field's storage.

Until 1–3 are satisfied, treat the automated tax path as **pending approval**.
Reverting is a one-line prompt change (route tax callers back to a human
orientation) plus leaving the modal dormant — the code is additive and gated
behind Paula's prompt.

---

*Recorded per CHARTER §16 (compliance = Elroy reserved) and the mechanical-
enforcement / on-the-record discipline for load-bearing safety gates.*
