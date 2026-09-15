# Relocation plan — Donovan Law

**Prepared 2026-08-18 · revised 2026-08-20 · for Paul Donovan**

*This revision corrects a factual error in section 2 about where the concierge's
call notes were being written, records your decision to retire the concierge, and
adds section 4 item 5, which the first version omitted.*

Two things are changing behind your website. This document says plainly what keeps
working, what stops working, what we need from the firm, and what it will cost.

Everything below was checked against the live system rather than from memory. Where
something could not be confirmed, it says so.

---

## 1. What is changing

**The hosting account has moved to you — this part is essentially done.** Your website
and the booking system run on Cloudflare. As of 2026-08-18 that account is named
Donovan Legal PLLC, billing is in the firm's name, and you are Super Admin. Nothing
about how the site works changed; the ownership and the bill did.

Two items from that transfer are still open, and both are in section 4.

**A second system, Vantage, is being switched off.** Vantage is the piece that
collected visitor statistics and kept a lead board. It is being retired and is not
being replaced.

**The voice concierge is being removed, at your request.** This was decided after the
first version of this plan was written, and it is why several rows in section 2 have
changed. It goes on both channels — the one on the website and the one that answered
the phone — and the published number returns to the firm's own line, (561) 666-6022.

These are three separate changes, and it is worth keeping them apart. The first is a
transfer. The second is a loss, and it is permanent. The third is a removal you asked
for.

---

## 2. What keeps working — verified, not assumed

| | |
|---|---|
| The website itself | ✅ unaffected |
| Online booking, and appointments landing on your Clio calendar | ✅ unaffected |
| The contact form, and inquiries arriving in Clio Grow | ✅ unaffected |
| New client records created in Clio | ✅ unaffected |
| **The voice concierge, on the website and on the phone** | ⚠️ **being removed — see below** |
| **Messages taken by the concierge reaching Clio** | ⚠️ **goes with it** |
| **The written notes from each concierge call** | ⚠️ **goes with it — see below** |
| Google Analytics, Google Ads, Search Console | ✅ unaffected |
| The members area and its tier gating | ✅ unaffected |

### A correction to the previous version of this document

**The version of this plan dated 2026-08-18 told you the concierge's call notes were
unaffected and would keep arriving in Clio. That was wrong, and this section replaces
it.** We re-checked it directly against the telephony service rather than against our
own notes, and found two things.

**First, the concierge itself is being retired — on the website and on the phone.**
That is your decision, made after this plan was written, and it is the right one if you
do not want an automated voice answering for the firm. It does mean the rows above have
moved from "unaffected" to "going away", and it is a deliberate removal rather than a
casualty of the Vantage shutdown.

**Second, and this is the part the earlier version got wrong.** After each call, four
things were being written about the conversation — how urgent it sounded, what the
caller was interested in, the category of matter, and a short written summary. The
earlier version said those were written onto the client's record in your Clio account.
**For calls that came in on the telephone, they were not.**

The two concierges were wired to different places, and that is the detail that was
missed:

| Where the call came from | Where the four after-call notes went |
|---|---|
| The concierge **on your website** | Your Clio account ✅ |
| The concierge **on the telephone** | Vantage only ❌ |

Your website has always had its own receiver for these notes, and it does write them
onto the Clio contact. The telephone concierge was simply pointed at Vantage instead of
at it. So this was a wiring mistake, not a missing capability — which is precisely why
it was easy to state confidently and wrongly.

The row in the table above said "the intake notes from each **phone** call", and that is
the case that was wrong. Switching Vantage off would have ended those notes whether or
not you retired the concierge. **Since you have decided to retire it, this changes
nothing about the outcome — but you were told something inaccurate about your phone
intake, and you should know that rather than discover it later.**

**What you keep.** Everything that ever reached Clio stays in Clio — contacts, matters,
calendar entries, Grow leads, and any message the concierge filed during a call. Those
are your records in your system and nothing here touches them, including the ones
already recorded.

**Bookings were deliberately built so that this kind of failure cannot cost you a
client.** If the retired system is unreachable, a booking still completes and the
appointment still appears on your calendar. That was a design decision made in advance,
not a lucky escape.

---

## 3. What you lose, permanently

Three things go away with Vantage and are not coming back in the current plan.

**1. The visitor analytics dashboard.** The page-by-page view of who visited the site
and what they looked at. *Partial substitute:* Google Analytics stays and already
covers most of this. What it will not do is tie a visit to a named person.

**2. The lead board.** The running list of leads gathered from the website and phone,
viewable in one place. *Partial substitute:* the leads themselves still arrive in Clio
Grow and Clio Manage. You lose the separate board, not the leads. In practice this
means working from Clio rather than from a second screen.

**3. ~~"Welcome back" recognition for returning callers.~~ Now moot.** The concierge
could recognise a returning visitor's browser and greet them accordingly, and that
memory lived in Vantage. It was the one genuinely irreplaceable item on this list — but
it was a feature OF the concierge, and the concierge is being retired, so it goes either
way. Listed here rather than deleted because the earlier version of this plan asked you
to weigh it, and it should be clear that the question has closed.

**Historic data.** Anything currently held only in Vantage — past visit logs, the lead
board's history, the visitor records — goes when it goes. If you want any of it kept,
it has to be exported **before** the shutdown, and that is a decision with a deadline
rather than something that can be revisited afterwards.

> **Decision needed from you:** do you want a copy of the Vantage data exported before
> it is switched off? It is easier to take a copy nobody ends up using than to discover
> later that something was wanted.

---

## 4. What we need from Donovan Law

Most of the transfer is complete. Four things remain, and the first two are the ones
that matter.

**1. A payment card on the Cloudflare account.** The account is in the firm's name but
has no payment method on it. Nothing is broken today — the site runs within the free
allowances. The exposure is that there is no headroom: if traffic exceeds those
allowances, the site and the booking form stop, and there is no card on file to absorb
it. For a firm whose new clients arrive through that form, that is the wrong way round.
This is a five-minute task and it removes the only live risk in this document.

**2. Confirmation of who controls the domain.** `donovan.law` is **not** managed at
Cloudflare — it sits at GoDaddy, and the website is reached through a pointer configured
there. So control of the website ultimately rests on control of that GoDaddy account,
not the Cloudflare one. We need to know who can sign into it. **If the firm does not
hold that access, this is the most important item in this document** — everything else
is recoverable; a domain you cannot administer is not.

**3. ~~A decision on who holds the phone service account.~~ Answered — no longer
needed.** This asked whose account should hold the telephony service the voice
concierge used. With the concierge retired the question goes away, and so does the
account.

One consequence is worth stating plainly, because it is permanent. The number the
concierge answered on — (561) 529-5873 — was bought inside that telephony service, not
through a carrier. **It cannot be transferred out.** When the service is closed the
number is released. It is not a number the firm advertised before July 2026 and the
website has already been returned to (561) 666-6022, so nothing the firm relies on
depends on it — but if it appears on anything printed, that is worth catching now.

**4. A decision about ongoing support — see section 6.** Owning the account and being
able to operate it are different things, and that difference is worth a conversation
rather than an assumption.

**5. A decision about where the website's source code lives. This was missing from the
previous version of this plan entirely.** Your website is not edited directly on
Cloudflare. Its source — every page, every change ever made to it, and the record of
who made it — lives in a code repository on GitHub, and Cloudflare publishes from
there. That repository is currently held in our organisation's account, not the firm's.

**Nothing about the live site depends on this.** The site would keep serving if the
repository vanished tomorrow. What depends on it is the ability to *change* the site,
and the history of how it got to where it is.

Three options, in the order we would recommend them:

1. **Transfer the repository to an account the firm controls.** Cleanest, and it means
   the firm holds the site and its history outright. GitHub supports this directly and
   the published site is unaffected by the move. It does require the firm to hold a
   GitHub account, which is free.
2. **Leave it where it is, with the firm added as an administrator.** Faster, and gives
   the firm access and visibility without setting up anything new — but the repository
   still sits in someone else's organisation.
3. **Take a copy and archive it.** A snapshot the firm keeps, with no ongoing access.
   Better than nothing, and materially worse than the first two, because a copy taken
   today stops being current the day after.

Our recommendation is (1), for the same reason as the domain: control of the thing the
website is *made from* should not rest on someone else's account.

**No longer required.** Earlier drafts of this plan asked for a Cloudflare account, a
maintenance window and a named contact for the day. The account exists, and the move was
completed without needing the window.

---

## 5. What it will cost

| | |
|---|---|
| Cloudflare hosting | **No charge at your current usage.** The site runs within Cloudflare's free allowances. A paid plan (in the region of **$5/month**) buys headroom rather than features, and we recommend it for that reason alone — see section 4, item 1. *Pricing to be confirmed — published prices change.* |
| Bot protection | No charge on the plan above. |
| Telephony | **Ends.** The concierge is retired, so the telephony service is closed and its charge stops. |
| Clio | Unchanged — already yours. |
| Google Analytics / Search Console | No charge. |
| Vantage | **Removed.** Whatever was being spent here stops. |

**The honest summary on cost:** this move makes your monthly bill smaller, not larger.
You drop what Vantage cost and pick up either nothing or about $5/month, depending on
whether you take the headroom. The real cost of this change is not money — it is the
three capabilities in section 3.

---

## 6. What could go wrong, and how we prevent it

We would rather show you this list than discover it on the day.

**A worked example of why we test rather than assume.** An earlier draft of this
document warned that the voice concierge's internal pointers would break when the
account moved. On checking, that warning came from an internal note that is now out of
date, and the risk did not apply: the site kept its existing technical address through
the move. **We are leaving the correction visible rather than quietly deleting it** —
the general point stands, and this revision is a second instance of it: section 2 told
you the concierge's call notes were reaching Clio, and checking the telephony service
directly showed they were not. We confirm end to end before calling something finished,
instead of reasoning about it.

**Nobody can read the stored passwords and keys back out.** Cloudflare deliberately
allows a secret to be written and replaced, but never viewed. There are 22 of them
behind your site. This is a security feature and not a problem in itself — but it means
that if one ever needs replacing, it has to be obtained again from wherever it
originally came from, rather than copied from anywhere. Worth knowing before the day
you need it. It is also the main reason section 6's last point matters.

**Two side effects worth knowing about, both minor.** Members of the members area will
be signed out once and will need to sign in again. And the historical record of *who*
signed in and when will no longer line up across the move — the sign-in history before
and after cannot be matched together. Neither affects access.

**The booking audit trail does not travel.** Alongside Clio, the site keeps its own
90-day record of bookings as a backup. That record is tied to the hosting account and
does not move with it. Your appointments are unaffected — those are in Clio. What is
lost is a secondary copy. *Prevention:* export it beforehand if you want it; otherwise
this is an accepted, documented loss.

**Owning the account and being able to run it are different things.** The firm now owns
the hosting account, which is the right outcome. But day-to-day operation of what sits
inside it — reconnecting Clio when an authorisation expires, replacing a key, reading a
deployment failure — is specialist work, and it is not work the firm currently does. The
question this raises is not technical: **who does the firm call when something behind the
website stops working?** That deserves an explicit answer, whether that is a support
arrangement with us, a handover to another provider, or a deliberate decision to accept
the risk. An account with nobody assigned to operate it is the one failure mode that
gets worse quietly rather than loudly.

**The retired system could slow bookings down if it is left half-connected.** While the
old system is being wound down, the website may still be trying to talk to it. There is
a clean way to switch that off in a single step, and it is on the checklist. Left
undone, bookings would still work but could feel sluggish.

---

## 7. What happens, in order

Most of this is done. What remains is short, and the last step is deliberately last.

1. ~~Create the Cloudflare account in the firm's name.~~ **Done** — account is
   Donovan Legal PLLC, billing in the firm's name, Paul is Super Admin.
2. ~~Move the website into it.~~ **Done** — it is in your account.
3. **Add a payment card.** *(Firm — five minutes, section 4 item 1)*
4. **Confirm who controls the GoDaddy account holding `donovan.law`.** *(Firm — section
   4 item 2)*
5. **Export anything wanted out of Vantage, then switch it off.** *(Us — needs your
   decision in section 3)*
6. **Confirm a real booking and a real contact form submission still work end to end,
   and that the published number rings the firm.** *(Us)* — the phone test is now that
   (561) 666-6022 reaches you directly, rather than that the concierge answers it.
7. **Answer the support question in section 6.** *(Firm and us together)*
8. **Remove our remaining administrator access.** *(Us, on your say-so — last)*

**Step 8 is irreversible and is deliberately last.** Once our access is removed we
cannot diagnose or fix anything inside the account, so it should happen after steps 3–7
and not before. There is no advantage to doing it early and one obvious disadvantage.

---

## 8. The three things to decide

1. **Do you want the Vantage data exported before it is switched off?** Deadline-bound.
2. **Where should the website's source code live?** See section 4 item 5. Our
   recommendation: transferred to an account the firm controls.
3. **When is the maintenance window?** Outside business hours, about two hours.

~~Who owns the telephony account?~~ **Answered** — the concierge is being retired, so
there is no telephony account to assign. See section 4 item 3 for the one consequence
that is permanent.

---

**A note on what this document does not claim.** It does not promise a replacement for
the three lost capabilities, because none is planned. If the returning-caller
recognition matters to the firm, say so now — rebuilding it later on a different
foundation is possible, but it is new work rather than a restoration, and it should be
priced as such.
