# [Members] Site — replace the temporary gate, and never dead-end

Part of the Clio-gated tier access tracker (01). **Supersedes #105 and #104.**

> **Amended 2026-08-06** — build spec is now `docs/MEMBERS-CLIO-GATED-ACCESS-R1.md`.
> Three corrections land here:
>
> 1. **The "not a member" page already exists.** `membership-{gold,platinum,diamond,reserve}.html`
>    are live, indexed, in the firm's voice, and already carry the level description
>    plus the consultation CTA — shipped by JORDAN-MEMBERS-MARKETING. Redirect
>    there. Do not build a landing page.
> 2. **Vocabulary.** Anything a member reads says **"engagement level"** — the
>    site's own term ("The Other Engagement Levels", "Each level is individually
>    scoped"). `tier` is code vocabulary and must never reach a rendered string,
>    an error message, or the sign-in card.
> 3. **`test/members-marketing.test.mjs` already runs all four middlewares.**
>    Swapping `tierGuard` → `memberGuard` breaks 8 assertions. They are the
>    acceptance criteria — **translate them, do not delete them.** The 401/Basic
>    arms become 302-to-`membership-<level>.html`; the 503 and
>    `private, no-store` arms survive unchanged. Mapping table in the order doc §7.1.
>
> Also: `js/members-gate.js` is loaded through `js/main.js` on **74 pages**
> carrying the MEMBERS dropdown, not on the two tool pages that name it directly.

## Why #104 and #105 are superseded

**#104** specified a "Client Login" link handing members off to the Clio for Clients portal, with *"do NOT build any auth on the site."* There is nothing to hand off to — the portal cannot host the tier content (see 01). The sign-in belongs on the site.

**#105** specified retiring `tier-auth.js` *after members are live in Clio*. Its caution — *"no window where private content is exposed"* — is moot: **nobody is a member yet.** The rooms read "Launching soon", zero contacts have any tier, and the current Basic Auth gate is scaffolding David put in during the build so unfinished private content wasn't publicly reachable. This is a first build, not a cutover.

## Replace the gate

```
now       functions/{gold,platinum,diamond,reserve}/_middleware.js
            import { tierGuard } from "../_lib/tier-auth.js";
            export const onRequest = tierGuard("gold");        ← HTTP Basic vs 8 CF secrets

becomes     export const onRequest = memberGuard("gold");      ← session cookie → tier compare
```

**Runs on every page inside a tier, not just the entrance.** A shared or bookmarked deep link meets the same check.

## Wire the existing sign-in UI

`js/members-gate.js` is **617 lines and already built** — modal, tier chrome, provider buttons, and one documented stub:

```
TODO(IdP): when the members portal is real, this is the only function that changes.
Constraints: same-origin, server-owned, no client secret, navigate the TOP browsing
context (an auth screen cannot render inside the /perch iframe).
```

Replace the Google/Microsoft buttons with an **email field and a submit**, and wire that stub. **Keep all the branding** — *The Strategy Room*, *The Partners Room*, *The Operators Room*, *The Reserve Room*, the tier colour treatment, the personas. Nothing here should look like a bolt-on.

## Four outcomes. No dead ends.

| Situation | What happens |
|---|---|
| Member, own tier | opens |
| Member, another tier | **offer their own tier as a link** — *"You're a Platinum member. [ Enter The Partners Room ]"* |
| Not a member | tier description + **Request member access** |
| Tier cleared | *"Your membership isn't currently active — please contact the firm."* |

**Offer, do not auto-redirect.** An automatic redirect assumes the target folder exists; a renamed or missing folder becomes a 404 loop. A link the member clicks cannot fail that way.

**Room names come from the client's own config, with a plain fallback.** If Clio returns a tier the site doesn't recognise — because Paul added one — it degrades to *"You're a Sapphire member. [ Go to Sapphire ]"*. That fallback is what makes a new tier a Clio edit rather than a deploy.

## Request member access → the firm's real intake

**Amended 2026-08-07.** This ticket originally specified an email capture posting a
lead to Vantage. That is replaced by handing the visitor to the **existing
consultation flow** — `book.html` → qualifier → slot → contact in Clio → calendar
invite → the firm runs the consultation.

An address in a dashboard gives the firm nothing to act on: no matter type, no
urgency, no appointment, and nobody committed to watching for it. The booking flow
is the firm's actual intake, it is already proven, and it ends in a scheduled call
rather than a row somebody has to notice. Every membership page's own CTA already
points there, and the firm's copy says engagement terms are set in a consultation.

**The tier context is not lost.** Vantage's visitor log already records that this
`visitor_id` viewed `/membership-<level>`, and the booking flow sends the same
`visitor_id` with its lead — so the hub links "looked at Reserve" to "booked a
consultation" without a second write from us.

**We navigate; we do not call in.** `openQualifier` was deliberately removed from
`window.__perch` (DR-INSANE-A33, #58) because a writable global could be swapped to
intercept a caller's answers, and PR #185 is rewriting `qualifier.js`,
`perch-layer.js`, `booking-modal.js` and `journey.js`. A URL is a stable contract;
an internal function is not one at all.

`functions/members/request-access.js` is deleted rather than left unused.
**Still no Clio write from the members module** — the contact is created by the
booking flow, through the firm's own proven path.

## Then retire the scaffolding — last

Only once the above is proven working:

- Delete `functions/_lib/tier-auth.js` and its four callers
- Delete the eight `TIER_{GOLD,PLATINUM,DIAMOND,RESERVE}_{USER,PASS}` secrets from **Production and Preview**

## Security and presentation must match the rest of the site

Same Turnstile posture, same cookie and session conventions, same visual language as everything outside the members module. This should be indistinguishable from the rest of the build.

## Acceptance

- No Basic Auth prompt on any tier path
- Every page inside a tier is checked, not only the index
- All four outcomes reachable; none is a wall
- An unrecognised tier degrades to the plain fallback rather than erroring
- Request access produces a Vantage lead carrying the requested tier
- `tier-auth.js` gone with no dead references; the eight secrets removed from both environments
- CI green

## Do not

- Do not touch booking, the qualifier, or `.github/workflows`
- Do not change what is inside any tier folder — that is the firm's
- Do not auto-redirect between tiers
