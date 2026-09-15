# [Members] Server — membership lookup + session

Part of the Clio-gated tier access tracker (01). **New ticket — no predecessor.**

> **Amended 2026-08-06** — build spec is now `docs/MEMBERS-CLIO-GATED-ACCESS-R1.md`.
> Two corrections land here:
>
> 1. **A misconfigured environment must return 503, not redirect.** An unset
>    `MEMBERS_SESSION_SECRET` or unset Clio credentials → **503 + `console.error`
>    naming the variable**, matching `tier-auth.js`. Silently bouncing to sign-in
>    looks like "everyone got logged out" and logs nothing — the silent-miss class
>    `callmap-key.js` exists to eliminate. Pinned by an existing behavioural test.
> 2. **Use the house `timingSafeEqual`** from `tier-auth.js` — it hashes both sides
>    to SHA-256 before comparing, so length does not leak through timing. A
>    character compare that returns early on a length mismatch is weaker.

## What

Two responsibilities, both under `donovan-legal-site/functions/members/`:

1. **Sign-in** — receive an **email address submitted by the visitor** (nothing is emailed; no message is sent anywhere), resolve that contact's `Membership Tier` from Clio, and set a signed session cookie.
2. **Guard** — a shared `memberGuard(tier)` used by the four tier middlewares in ticket 03.

## The Clio lookup

```
GET /contacts?type=Person&query=<email>
    &fields=custom_field_values{value,field_name}
→ read the value of "Membership Tier"
```

Reuse the existing OAuth/token machinery in `booking/_lib/provider-clio.js`. **Read-only — this feature never writes to Clio.**

### ⚠️ A picklist returns the option ID, not the label

Verified against the live account:

```
elroy@ticoai.net  →  Membership Tier value = 11238563     ← NOT "Gold"

GET /custom_fields?parent_type=contact
    &fields=id,name,field_type,picklist_options{id,option}
→ Membership Tier (id 20243453, picklist)
     Gold 11238563 · Platinum 11238578 · Diamond 11238593 · Reserve 11238608
```

This differs from the twelve Intake fields, which are `text_line` and return their label directly.

**Resolve the option map once and cache it per isolate**, exactly as `booking/_lib/clio-custom-fields.js` caches the Intake field IDs. The *membership* read stays live on each sign-in so revocation is immediate.

**Fail closed on an unmapped ID.** If a fifth tier is added in Clio and the cached map is stale, an unknown ID must deny — never default to a tier.

## The session cookie

```
Name      one cookie
Path      /                    ← not path-scoped; see below
Flags     HttpOnly · Secure · SameSite=Lax
Lifetime  session (no Max-Age) + absolute expiry inside the signed payload
Payload   { tier: "<verbatim label from Clio>", exp } — signed (HMAC, Cloudflare secret)
```

**Tier only. No email, no name, no PII.** Nothing in the cookie that would matter if it leaked.

**Path=/ rather than /gold** — path-scoping sounds tidier, but then a Platinum member landing on `/gold/` would present no cookie, the gate would see nobody, and they'd be asked to sign in again. That is the dead-end behaviour this work exists to remove. One cookie at `/` lets any tier page read the tier and offer the right room.

**Sliding 12-hour expiry.** Each page load inside a tier renews it, so it expires after 12 hours of *inactivity*, not 12 hours from sign-in — a member working all afternoon is never interrupted, a laptop left open still locks itself. Session-scoped as well, so closing the browser ends it regardless.

*Note: Paul's tools run entirely in the browser and transmit nothing, so an expiry mid-tool cannot lose work — the loaded page keeps working and the gate is met on the next navigation.*

**Rotating the signing secret invalidates every session at once** — the emergency revoke-all.

## The comparison rule

```
folder requested: /diamond/
cookie tier:      "Diamond"
compare:          diamond === diamond  (case-insensitive)  → allow
```

**No tier list in code. No mapping table. No room names.** The server never learns what tiers exist or what they're called.

## Security requirements

- **Turnstile** on the sign-in form — `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` already exist in the environment
- **Per-IP rate limit** on sign-in attempts
- **Sign-in telemetry → Vantage** via the existing `sendVantageUpsert` path: `timestamp · outcome · tier · salted hash of the email`. **Salted** — an unsalted hash of an email is trivially reversible against a candidate list. Salt held as a Cloudflare secret.
- **Do not log which tools a member opened.** *That* someone signed in is operational; *what a client is working on* is not ours to record.
- **Never fail open.** Clio unreachable, malformed response, unmapped ID, missing field → deny.

## Edge cases

| | |
|---|---|
| One email matching several Clio contacts | deny, refer to the firm — do not guess |
| Contact exists, `Membership Tier` blank | not a member |
| Contact does not exist | not a member — same response as above |
| Clio unreachable | deny |
| Value present but not in the option map | deny |

## Acceptance

- Correct tier opens its folder; other tiers do not
- A blank tier and a missing contact are indistinguishable in the response
- Cookie carries no PII and cannot be forged without the signing secret
- Rotating the signing secret ends all sessions
- Clearing the field in Clio denies on the next sign-in
- All failure modes deny; none fail open
