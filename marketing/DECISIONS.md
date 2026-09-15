# Decisions

Dated, with the reasoning. **The reasoning is the point** — a decision without its
why cannot be revisited intelligently six months later, only re-argued.

Newest first. Add a row when something is settled; move it to *Reversed* rather
than deleting it when it changes, because knowing a thing was tried matters.

---

## 2026-08-10

### Client approvals

**Paul approved the analytics disclosure wording for `/disclaimer` — AS WRITTEN,
no edits.** So the text shipping in `disclaimer.html` is character-for-character
the text counsel approved. No follow-up commit needed, and none should be made to
that section without going back to him.
*What he was shown:* the exact two-paragraph section, a sketch of the banner
visitors see, and three plain statements — nothing is tracked before an accept,
Decline is as prominent as Accept, and the choice is reversible. Recorded so it
is clear the approval was informed, not a rubber stamp on text he never read.
*Package:* `PAUL-APPROVAL-disclaimer.md`. *Shipped in:* PR #237, unchanged. — *Paul*

### Measurement

**Only `booking_confirmed` drives bidding.** `qualifier_submitted`, `call_started`
and `message_taken` are Secondary, observation-only.
*Why:* if bidding can chase `call_started` it will, because calls are the cheapest
and most abundant of the four. The cost-per-conversion chart looks excellent and
Paul gets no more clients. This one setting decides whether the account buys
clients or noise. — *Elroy*

**Conversion window 90 days, count One.** Already set correctly in the account.
*Why:* someone reads a FIRPTA article in March and books in May. A 30-day window
simply does not see that conversion, and the click that produced it looks wasted.

**Consent: Accept / Decline, shown to every visitor — not geo-gated to the EEA.**
*Why:* one compliant behaviour everywhere is easier to defend than two behaviours
plus a country lookup, and it covers the US pixel-litigation exposure that a
Europe-only banner would leave open on a law firm's site. — *Elroy*

**Google loads under Consent Mode denied; Meta does not load at all until accept.**
*Why:* Google has a cookieless mode it can still model conversions from, so
"waits for the answer" is affordable rather than a blackout. Meta has no
equivalent — its pixel either runs or it does not.

**Tracking goes on BEFORE any ad spend.**
*Why:* remarketing audiences accumulate from visitors already seen (a Google
search list does not function below ~100 users); organic traffic is the only
baseline paid can be judged against; and a silent tracking bug is far cheaper to
find across 200 organic visitors than across €3,000 of clicks. — *Elroy*

**Tracking ships behind an `ANALYTICS` flag, default off.**
*Why:* separates *shipping the code* from *switching on tracking* — two decisions,
two moments, and a rollback that is deleting a variable rather than reverting a
deploy of a live law firm's site.

**Conversion value is attached to bookings, ordered by the firm's own tier ladder.**
Reserve > Diamond > Platinum > Gold > matter > baseline. Numbers are placeholders.
*Why:* without a value Google optimises for the *most* bookings, and a Reserve-tier
principal and a general inquiry are both "one booking". Bidding cares about the
ratio far more than the absolute figures, so the **order** is what matters and the
order is the one the firm already asserts. Real bands owed by Elroy + Paul.

**Unclassified bookings get a low baseline value, never zero.**
*Why:* a zero-valued conversion is worse than no value — value-based bidding reads
it as "worthless" and learns to avoid whatever produced it.

**Attribution is captured on first sight and carried for the visit; first-touch
wins unless a genuine second ad click arrives.**
*Why:* conversions here happen pages away from the landing URL. And a
`utm_source=newsletter` link clicked mid-visit must not erase the `gclid` that
paid for the visit — that credits the booking to the wrong channel and looks
entirely normal in the report.

### Operations

**A "spend with zero conversions" alert goes to TWO channels: an auto-opened
GitHub issue (labelled urgent, assigned to Elroy) AND an email to David + Elroy.**
Not Roam — not a real-time channel. Not Slack unless an ops channel exists that
the team genuinely watches.
*Why:* that alert means money is burning while tracking is dead. It has to be
un-missable AND leave a trail, and the person who fixes it is the build team — so
the issue puts it in-band with where the work happens, and the email makes sure
somebody actually sees it the same day. — *David*

### Advertising

**Start on Manual CPC or Maximise Clicks, not Smart Bidding.**
*Why:* automated bidding needs roughly 15–30 conversions a month to learn. A
high-value low-volume tax practice will not hit that for months, and pointing
Target CPA at three conversions a month makes costs spike and results not follow.
Switch when volume supports it, not before. — *Jay, recommended*

**Ad account and billing in the firm's own name and card.**
*Why:* the asset must belong to the client, not the agency. — *David*

---

## Still placeholders, deliberately

| | Owner |
|---|---|
| Conversion value bands (order is right, numbers are not) | Elroy + Paul |
| Geographic targeting — Florida vs nationwide | Paul |
| Budget | Paul, once Keyword Planner gives real numbers |

## Reversed

*(nothing yet)*
