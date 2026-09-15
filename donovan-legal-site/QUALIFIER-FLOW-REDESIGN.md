# Qualifier Flow — Snapshot + Redesign (per Wendy's notes)

**Status:** design draft, 2026-07-16. Snapshot of what's LIVE, then the proposed
adjusted flow. Nothing built from this yet — pending Elroy sign-off + the open
decisions at the bottom (esp. Paul's tax gatekeeping).

---

## SNAPSHOT — what's live right now

Two **separate** tap-card modals, chosen by matter. English only.

### Real-estate modal (`QDEFS_RE`)
1. Residency — US citizen/green-card · Foreign national/visa
2. Your situation — First investment · Portfolio alongside career · RE is the business · Exploring/unsure
3. Household income — <$500K · $500K–1.5M · $1.5M–3M · >$3M · Prefer not to say
4. Household net worth — <$2M · $2–5M · $5–15M · >$15M · Prefer not to say
5. *(first-timers only)* Income character — W-2 · Business · Mixed
6. *(first-timers only)* Availability — Spouse available · Both career-committed

### Tax-controversy modal (`QDEFS_TAX`)
1. Matter — audit/exam · notice/letter · lien/levy/collection · owe/unfiled · other
2. Amount in dispute — <$250K · $250K–1M · $1–5M · >$5M · undetermined
3. Posture — 90-day notice · deadline <30d · deadline 30–90d · exam no-date · not sure
4. **Criminal screen** — no · yes/unsure   *(Paul asked for this in the meeting)*

### Flow: Paula routes by matter → RE caller gets RE modal; tax caller gets the
confidentiality note + tax modal. Bookings → Paul's calendar. Answers → Clio
calendar description + Grow lead + Vantage.

---

## PROPOSED — verbal gate → matter-routed modal (per Elroy 2026-07-16)

Principles: **no heavy questions up front — make it flow.** Three light questions
are asked **by voice, before the modal, no clicks.** Two of them are gates: language
picks the modal's language; matter picks which modal opens. Then the tap-card handles
the structured/sensitive answers, **money last.**

### 🗣️ Voice — asked by Paula BEFORE the modal (no clickable actions)
1. Greeting + AI / recording disclosure
2. "Would you like to book a **free consultation**?"
3. **"What language do you prefer — English or Español?"**  → **sets modal language**
4. **"How did you hear about us?"** — Referral · Google · Social · Other  *(captured → invite)*
5. **"Are you looking for **tax** help or **real estate**?"**  → **picks which modal opens**
6. Transition: *"I have a few more questions — I'll put a card on your screen; just tap the
   answers and let me know when you're finished."*

### 📱 Modal — routed by the matter answer, in the chosen language

**Everyone gets Wendy's PROFILE block** (light → heavy, money last):
- Citizenship — US citizen · Green-card · Visa · Investing/residing abroad
- State of residence
- For whom — Yourself · Business · Family member · Other
- Household **income**
- Household **net worth**

**TAX callers ALSO get Paul's gatekeeping (asked FIRST, before the profile block):**
- Matter — audit/exam · notice/letter · lien/levy/collection · owe/unfiled · other
- Amount in dispute — <$250K · $250K–1M · $1–5M · >$5M · undetermined
- Posture — 90-day notice · deadline <30d · deadline 30–90d · exam no-date · not sure
- **Criminal screen** — no · yes/unsure

So: **RE modal = 5 taps** (profile). **Tax modal = 9 taps** (Paul's 4 + profile 5).
The RE "situation"/tier question is **dropped** (Wendy's simpler set).

### 🗣️ Voice — after the modal
7. Book → **Wendy's calendar** (30-min)

**Why this order:** language up front (drives the modal), then the easy/structured
taps, with the two money questions at the very end so nothing heavy leads. The two
lightest questions (language, source) are spoken — language because it has to gate
the modal, source because it's a natural closing question, not a form field.

**IMPORTANT — the two verbal answers still reach the calendar invite.** Even though
"preferred language" and "how did you hear" are asked out loud (not tapped), Paula
captures both and they are written into the SAME booking record that feeds the Clio
calendar description + Grow lead (the #8 join, keyed by `call_id`). So Paul/Wendy see
language + source in the invite next to the tapped answers. Small build addition:
record `language` (known at open_qualifier) and `source` (captured at close) into the
`qualbk:<callId>` record so `/booking/create` folds them into the description.

---

## What changed vs. the snapshot
- **Two modals → one** unified set (Wendy's), matter is just the first question.
- **English-only → bilingual**, chosen by the spoken language question, which opens
  the modal in English or Spanish. (`open_qualifier` gains a `lang` param.)
- **Added:** state of residence, for-whom, language, "how did you hear."
- **Citizenship** goes 2 options → 4.
- **Dropped from RE:** "your situation" (tier) + the first-timer follow-ups.
- **Dropped from tax:** amount, posture, **criminal screen** — see open decision.
- **Booking calendar:** Paul → **Wendy** (once she connects hers).

---

## RESOLVED
- **Matter routing.** A verbal "tax or real estate?" question decides which modal opens.
- **Paul's tax gatekeeping stays** (matter + amount + posture + criminal screen) — kept
  as the tax modal, unchanged. (Resolves the earlier Paul-vs-Wendy conflict: tax callers
  get Paul's questions; Wendy's profile set applies to the RE path.)
- **Language + source verbal** and both still land in the calendar invite.

## OPEN DECISIONS (need answers before building)
1. **Real-estate modal question set.** Adopt Wendy's profile questions (Citizenship →
   State → For whom → Income → Net worth), or keep the current RE set (Residency →
   Situation/tier → Income → Net worth), or a blend?
2. **Does the TAX caller also get the profile questions** (citizenship, state, income,
   net worth) after Paul's tax gatekeeping, or ONLY Paul's tax questions?
3. **Tier logic.** The RE "situation" question set the membership tier (Gold/Platinum/…).
   Keep it (for tiering) or drop it per Wendy's simpler set?
