# [Members] Firm runbook — admit, change tier, revoke

Part of the Clio-gated tier access tracker (01). **Supersedes #106.**

## Why #106 is superseded

#106 described managing members through **Clio for Clients** — create a matter, create a portal, add a participant, share documents, and noted *"the custom field is for the firm's organization/reporting; it does not control access."*

That is now inverted. **The custom field is the access control.** There is no portal, no matter, and no document sharing involved in membership.

## What to produce

A **one-page runbook** for Paul's team. Written for a paralegal, no technical language, no engineering involvement. Delivered as a clean document suitable to hand over.

## Contents

### Admit a member

1. Open the person's contact in Clio
2. Set **Membership Tier** to Gold, Platinum, Diamond or Reserve
3. Save

That is the entire job. Tell the member however you like — email, phone, text. They go to the website, choose their tier, enter the email address on their Clio contact, and they're in.

### Change a tier

Change the dropdown. Effective on their next sign-in.

### Revoke

Clear the dropdown. Effective on their next sign-in. **No other member is affected** — nothing is shared, no password changes.

### What the member sees

| | |
|---|---|
| Their own tier | it opens |
| A tier they don't hold | *"You're a Platinum member — enter The Partners Room"* |
| No tier set | the tier description and a request-access form |
| Tier cleared | *"Your membership isn't currently active — please contact the firm"* |

### Troubleshooting — "it isn't working for them"

1. Is **Membership Tier** set on their contact?
2. Are they using **the email address on that Clio contact**? A different address won't be recognised.
3. Does that email appear on **more than one contact**? If so the system refuses on purpose — merge or correct the duplicate.

## Welcome email template — SHELVED, out of scope

**Shelved 2026-08-06.** Not a blocker and not part of this build. Recorded here so
the reasoning is not lost, and so nobody rediscovers it as a surprise later.

Setting a Clio custom field **sends nothing**. No email, no
portal message, no notification. There is no automation behind the dropdown.

David's mental model on the 2026-08-05 call was that clicking Diamond means the
member *"would get an email confirmation that he's a diamond member, and what
website he would go to and what email he would use to get in there."* That does not
happen. Unsaid, the first member is admitted and then waits for an email that never
arrives.

So this ticket also delivers a **saved email template for Wendy**:

- confirmation of the engagement level
- the URL for that level
- **the email address to use — the one on their Clio contact.** This is the whole
  credential. A different address is not recognised.
- who to contact if it does not work

Sending stays manual and human. Automating it is a later decision, not a gap left
open here.

⚠️ Confirm with Wendy that no Clio notification fires on a custom-field change
before this is stated to David as settled fact.

## Two things worth saying to the firm

**Membership is a single field.** There is no separate "active" or "paid" flag. Blank means not a member; a tier means an active member. One field, one state, nothing to get out of step.

**Access can end.** Clearing the field ends that member's access on their next sign-in without touching anyone else. That is the difference between selling access and giving away a copy — and the reason it is worth doing this way.

## Acceptance

- A paralegal can follow it start to finish with no help
- Fits on one page
- Contains no engineering terminology

**Owner:** TICO. Not code.
