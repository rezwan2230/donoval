# [Members] Clio-gated tier access — TRACKER

**Supersedes #102. Closes #130.**

> **Amended 2026-08-06.** Full build spec: `docs/MEMBERS-CLIO-GATED-ACCESS-R1.md`,
> written in the repo's order-doc format alongside JORDAN / SHELDON / ADAM.
>
> **The un-gate is off — settled by David, not by us.** JORDAN-MEMBERS-MARKETING §3
> sequences *"move the marketing pages into the tier roots"* then *"remove the gate
> last."* Both existed because Clio for Clients was going to host the member
> content; #130 proved it cannot. On the 2026-08-05 call David specified the
> replacement himself:
>
> > *"it's **planned to be gated using Clio** because right now I have it
> > generically as a stop gap… I have this as a **temporary gate**… somebody would
> > have to then manage the website to manage the list as to who's approved or not
> > approved. And if you're gonna have that, you should put that in the hands of the
> > **paralegals and the clerks who run the Clio system**… So **everything is Clio
> > bound** to the members, not us."*
>
> The gate stays and becomes Clio-driven. The tier roots stay gated, the marketing
> pages stay at `/membership-<level>`. **That is the current live layout — this work
> moves no files.**

## Why #102 is superseded

#102 proposed moving the private member area into **Clio for Clients**. That was tested live on the firm's own Clio — a real matter, a client portal, an invite, and a real client login. Findings:

| | |
|---|---|
| The portal renders | **Messages · Documents · Bills · Events.** Nothing else |
| Files shared into it | **download.** Clio does not host or render them |
| An interactive tool shared as a file | downloads, then runs locally with broken assets |
| Contact record / custom fields / notes | **not visible to the client** |
| Portal access via the Manage API | **invisible** — an actively logged-in portal user is indistinguishable from one who never accepted |

Clio for Clients therefore cannot host 31 interactive tools and cannot gate `donovan.law`. **#102, #104, #105 and #106 all rest on that premise.**

This also closes **#130**. Its open half was *"absence of an API surface is not evidence about what the portal renders."* It has now been rendered and observed: the income and net-worth bands are **not** exposed to a portal user, so the attorney-side assumption behind #111 holds.

## What replaces it

The tools stay exactly where they are. **Clio becomes the record of who is a member and at what tier**; the website reads it at sign-in and opens that member's folder. Administration is a dropdown a paralegal sets — no website edits, no shared passwords, no engineering.

```
member clicks any tier link
  → enters their email address
  → Clio: what is "Membership Tier" on this contact?

      matches the folder requested → open it
      a different tier             → offer their own tier as a link
      no tier / no contact         → tier description + Request member access
```

## Already done

- **`Membership Tier`** picklist created on Clio contacts — Gold · Platinum · Diamond · Reserve. Displayed, not required.
- **Lookup proven end to end**: correct tier allows, other tiers deny, non-member denies.

⚠️ Implementation note: **a Clio picklist returns the option ID, not the label** — `11238563`, not `"Gold"`. See ticket 02.

## Design principles — these are the point of the ticket

1. **No tier list anywhere in server code.** The gate compares the value Clio returned against the folder name. A new tier is a Clio picklist option plus a folder — no deploy, no ticket.
2. **The server returns the Clio value verbatim.** It knows nothing about tier names, room names, or how many exist.
3. **Presentation lives in the client**, which already holds the room names in `js/members-gate.js`, with a plain fallback for an unrecognised tier.
4. **Never a dead end.** Every outcome routes somewhere.
5. **We build the gate. What is behind it is the firm's.**

## Out of scope — the firm's, not ours

- Which tools live in which folder, and how many
- Feature unlocking inside a tool (the `__DONOVAN_TIER` rank ladder — already built and working)
- Whether Diamond and Reserve differ *(they hold the same 10 tools; the difference is 24/7 access for the hand-selected 100)*
- Pricing, invoicing, payment — membership is by application, billed directly by the firm
- Deduplicating the tool copies

## Accepted risk — recorded deliberately

> This build uses a **verified-by-assertion email address as the sole credential**. It is a deliberate trade for delivery speed. It means (a) anyone who knows a member's email address can access that member's tier, and (b) the sign-in form discloses whether a given address is a member and at what tier.
>
> **Plan A — a one-time emailed sign-in link — is the named fix and is out of scope for this build.** Turnstile and per-IP rate limiting reduce bulk enumeration; neither changes the underlying property.

Paul should be aware of this before the first Reserve member is admitted at $25,000/year.

## Children

- **02** — Server: membership lookup + session
- **03** — Site: replace the temporary gate, and never dead-end
- **04** — Firm runbook: admit, change tier, revoke

## Delivery

Feature branch → Cloudflare preview → David reviews and tests → merge → production deploy.

⚠️ **Preview has its own `CLIO_*` bindings pointing at a different Clio account** (verified: preview returns different calendar availability from production). A preview build would look for `Membership Tier` in that account and deny everyone.

Recommended: give the gate **its own binding** (`CLIO_MEMBERS_*`) pointing at the firm's Clio in both environments. Safe, because **the gate is read-only** — it only ever issues `GET /contacts`.
