# MEMBERS — Clio-gated engagement-level access

**Order:** MEMBERS-CLIO-GATED-ACCESS-R1 · **Tracker:** [#186](https://github.com/TicoAI/DonovanLegal/issues/186)
**Tickets:** [#187](https://github.com/TicoAI/DonovanLegal/issues/187) server · [#188](https://github.com/TicoAI/DonovanLegal/issues/188) site · [#189](https://github.com/TicoAI/DonovanLegal/issues/189) firm runbook
**Supersedes:** #102 · #104 · #105 · #106 (all closed) · **Closes:** #130
**Branch:** `members/clio-gated-tier-access` · **Lane:** Elroy + team, parallel to Perch v2
**Depends:** JORDAN-MEMBERS-MARKETING (merged — the four public pages this order redirects to)

---

## 1. What this order delivers

The temporary HTTP Basic gate on the four engagement-level folders is replaced by
a gate that reads **Clio**. Membership becomes a single picklist field on a
contact, set by a paralegal in the system the firm already runs. The website
never holds a member list.

```
visitor opens /gold/
  → no session? → membership-gold.html  (public page, already live)
  → enters their email address on the sign-in card
  → Clio: what is "Membership Tier" on this contact?

      matches the folder requested → open it
      a different level            → offer THEIR level as a link
      no level / no contact        → the level description + Request member access
      Clio unreachable / misconfig → refuse (see §4.1)
```

### This is David's spec, not a new one

Recorded here because the order doc it partially contradicts (JORDAN-MEMBERS-MARKETING §3)
predates it. From the 2026-08-05 call, verbatim:

> **[6]** "…it's **planned to be gated using Clio** because right now I have it
> generically as a stop gap."
>
> **[8]** "I have this as a **temporary gate**… this is not how we wanna do this
> format. Because if I did it this way, somebody would have to then manage the
> website to manage the list as to who's approved or not approved. And if you're
> gonna have that, you should put that in the hands of the **paralegals and the
> clerks who run the Clio system**."
>
> **[10][12]** "So **everything is Clio bound** to the members, not us."

**Consequence — the un-gate is off.** JORDAN-MEMBERS-MARKETING §3 step 3 sequences
*"move the marketing pages into the tier roots"* and step 4 *"remove the gate last."*
Both existed because Clio for Clients was going to host the member content. It
cannot (#130, proven live: the portal renders Messages · Documents · Bills · Events
and nothing else). With no destination for the private content, the tier roots stay
gated and the marketing pages stay at `/membership-<level>`. **That is the current
live layout, so this order moves no files.**

---

## 2. What this order does NOT do

- **Does not change what is inside any level folder.** The tools, the copy, the
  document samples — the firm's, untouched.
- **Does not write to Clio, ever.** The gate issues `GET` only. No contact is
  created, no field is set, no note is filed.
- **Does not touch booking, the qualifier, Perch, or `.github/workflows`.**
  Verified no overlap with the four PRs open at the time of writing (#180, #183,
  #184, #185 — 22 files, none of them ours).
- **Does not import from `booking/_lib/provider-clio.js`.** #183 is actively
  rewriting that file, and the members lookup may point at a different Clio
  binding than booking (§6). The gate carries its own read-only token path.
- **Does not publish a fee, price, rate, or currency symbol** anywhere, in code,
  copy, or error text. `test/members-marketing.test.mjs` asserts this and the
  firm's own instruction is *"the firm does not publish or quote pricing."*

---

## 3. Vocabulary — this is a correctness rule, not a style note

| Context | Word |
|---|---|
| Anything a member or visitor reads | **engagement level** — "The Other Engagement Levels", "Each level is individually scoped" |
| Code, folders, tickets, logs | `tier` — the existing slug, unchanged |

The site says *level*. The code says *tier*. Do not let the code vocabulary reach a
rendered string, an error message, or the sign-in card.

---

## 4. House conventions this order adopts

Taken from `functions/_lib/tier-auth.js`, `functions/_lib/callmap-key.js`
(DRINSANE-CALLMAP-JOINKEY-HARDENING-R1) and `test/members-marketing.test.mjs`. The
gate should be indistinguishable in style from the code it replaces.

### 4.1 Fail closed, and say so out loud

`tier-auth.js` returns **503 with a `console.error` naming the missing variable**
when a level is unconfigured, on the stated grounds that *"an 'unconfigured means
open' default is the same shape of bug that left Vantage's `/caller-context`
publicly readable when `WRITE_SECRET` was unset."*

The members gate inherits this exactly:

| Condition | Response |
|---|---|
| `MEMBERS_SESSION_SECRET` unset | **503** + `console.error("[member-auth] MISCONFIGURED …")` |
| Clio credentials unset | **503** + `console.error` |
| Clio unreachable / non-200 | **deny** |
| Option ID not in the cached map | **deny** |
| One email on several contacts with different levels | **deny** — never guess |

> ⚠️ A misconfigured environment must **not** silently redirect to sign-in. That
> looks like "everyone got logged out" and logs nothing. It is the silent-miss
> class `callmap-key.js` was written to eliminate.

### 4.2 Constant-time comparison — use the house function

`tier-auth.js` hashes **both sides to SHA-256 before comparing**, so neither the
length nor the matching-prefix length of the real value leaks through timing. A
naive character compare that returns early on a length mismatch is weaker. Reuse
the existing shape.

### 4.3 Logging

`[module] outcome key=value`, matching `[tier-auth] denied tier=gold`.
**Never log the submitted email, the cookie, or the token** — not even on failure.

### 4.4 Response headers on an authenticated hit

`Cache-Control: private, no-store` and an appropriate `Vary`. Pinned by existing
tests; these pages must never be reused across identities by a shared cache.

### 4.5 Comment style

Prose header under a `── rule ──`, ALL-CAPS paragraph lead-ins, the order ID on
line 3, a `CONFIGURATION` block naming every variable, and JSDoc on exports.
Explain **why not** the alternative, not only what the code does.

---

## 5. The build

| # | File | Action |
|---|---|---|
| 1 | `functions/_lib/member-auth.js` | **new** — Clio lookup · picklist option-map cache · signed cookie · `memberGuard` |
| 2 | `functions/members/auth/signin.js` | **new** — Turnstile + per-IP rate limit + lookup + set cookie |
| 3 | `functions/members/auth/signout.js` | **new** — clear the cookie |
| 4 | `functions/{gold,platinum,diamond,reserve}/_middleware.js` | **edit** — `tierGuard("x")` → `memberGuard("x")`, one line each |
| 5 | `js/members-gate.js` | **edit** — wire the `TODO(IdP)` stub; email field replaces the Google/Microsoft buttons; keep all branding |
| 6 | `functions/members/request-access.js` | **new** — → Vantage lead via existing `sendVantageUpsert`, no Clio write |
| 7 | `test/members-gate-clio.test.mjs` | **new** — behavioural suite (§7) |
| 8 | `test/members-marketing.test.mjs` | **edit** — translate the 8 gate assertions (§7.1) |
| 9 | `functions/_lib/tier-auth.js` | **delete — LAST**, only once 1–8 are proven |

### 5.1 The comparison rule

```
folder requested: /diamond/
cookie level:     "Diamond"
compare:          diamond === diamond   (case-insensitive)   → allow
```

**No level list in code. No mapping table. No room names.** The server never learns
what levels exist or what they are called. A fifth level is a Clio picklist option
plus a folder — no deploy, no ticket, no engineer.

Levels are **independent, not ranked.** `tier-auth.js` states it for the Basic gate
— *"gold credentials never opened diamond; there is no hierarchy and no shared
master credential"* — and it holds here. A member paid for their level; a wrong
link opens **their** room, not a lesser one.

### 5.2 The session cookie

```
Name      dl_member                       one cookie
Path      /                               not path-scoped — see below
Flags     HttpOnly · Secure · SameSite=Lax
Lifetime  session (no Max-Age) + absolute expiry inside the signed payload
Payload   { t: "<Clio label verbatim>", e: <expiry> }  — HMAC-SHA256
```

**Level only. No email, no name, no contact ID, no PII.** Nothing in the cookie
that would matter if it leaked.

**`Path=/`, not `/gold`.** Path-scoping looks tighter and is worse: a Platinum
member landing on `/gold/` would present no cookie at all, the gate would see an
anonymous visitor, and they would be asked to sign in again — the dead end this
order exists to remove.

**Sliding 12h.** Every page inside a level renews it, so it expires after 12 hours
of *inactivity*. A member working an afternoon is never interrupted; a laptop left
open still locks. Paul's tools run entirely in the browser and transmit nothing, so
an expiry mid-tool cannot lose work — the loaded page keeps working and the gate is
met on the next navigation.

**Rotating `MEMBERS_SESSION_SECRET` invalidates every session at once** — the
emergency revoke-all.

### 5.3 Never a dead end

| Situation | What happens |
|---|---|
| Member, own level | opens |
| Member, another level | **offer their level as a link** — *"You're a Platinum member. [ Enter The Partners Room ]"* |
| Not a member | → `membership-<level>.html` — **already live**, already carries the description and the consultation CTA |
| Level cleared | *"Your membership isn't currently active — please contact the firm."* |
| Unrecognised level from Clio | plain fallback — *"You're a Sapphire member. [ Go to Sapphire ]"* |

**Offer, never auto-redirect between levels.** An automatic redirect assumes the
target folder exists; a renamed or missing folder becomes a 404 loop. A link the
member clicks cannot fail that way.

The unrecognised-level fallback is what makes a new level a Clio edit rather than a
deploy. It is load-bearing, not defensive padding.

---

## 6. Configuration — Cloudflare Pages → Settings → Variables & Secrets

Set for **both Production and Preview**. A Preview deployment missing these 503s
the level rather than leaking it.

| Variable | Purpose |
|---|---|
| `MEMBERS_SESSION_SECRET` | HMAC key for the session cookie. Rotating it ends all sessions. |
| `MEMBERS_HASH_SALT` | Salt for the telemetry email hash. **Salted** — an unsalted hash of an email is trivially reversible against a candidate list. |
| `CLIO_MEMBERS_CLIENT_ID` / `_CLIENT_SECRET` / `_REFRESH_TOKEN` | Optional. Falls back to `CLIO_*`. See below. |
| `TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY` | Already present. Reused. |

> ⚠️ **Preview has its own `CLIO_*` bindings pointing at a different Clio account**
> — verified: the two environments return different calendar availability. A
> Preview build reading Preview's Clio would look for `Membership Tier` in an
> account that has never had it and **deny every member**, which reads as a broken
> build rather than a misconfiguration. `CLIO_MEMBERS_*` lets the gate point at the
> firm's Clio in both environments. Safe here and nowhere else in this codebase,
> because the gate is read-only.

**To remove after cutover (§5 step 9):** the eight `TIER_{GOLD,PLATINUM,DIAMOND,RESERVE}_{USER,PASS}`
secrets, from **both** environments.

---

## 7. Verification

The existing suite **runs** each middleware rather than reading it. That is not
incidental — JORDAN-MEMBERS-MARKETING documents a control in which a middleware was
rewritten to keep the `tierGuard` import and call but export `context.next()`:

> `ok - functions/gold/_middleware.js still delegates to tierGuard` ← **source-shape test PASSED on a fully disabled gate**
> `not ok - /gold/ still fails CLOSED (503) when credentials are unset`

**Only the behavioural arm caught it.** Every assertion below runs the middleware.

### 7.1 The eight existing assertions, translated

`test/members-marketing.test.mjs` currently pins the Basic gate. Swapping to
`memberGuard` breaks all eight. They are the acceptance criteria — **translate, do
not delete**:

| Existing (Basic) | Becomes (Clio) |
|---|---|
| source: imports `tier-auth`, calls `tierGuard("x")` | source: imports `member-auth`, calls `memberGuard("x")` |
| unset credentials → 503, `next()` never called | `MEMBERS_SESSION_SECRET` unset → **503**, `next()` never called |
| no `Authorization` → 401 + `Basic realm=` | no cookie → **302 → `membership-<level>.html`**, `next()` never called |
| wrong credentials → 401 | forged / tampered / expired cookie → **302**, `next()` never called |
| correct credentials → 200 + `private, no-store` | valid cookie, matching level → **200 + `private, no-store`** |
| one tier's credentials do not open another | a Gold cookie does **not** open `/platinum/` |
| `/<tier>/index.html` still `noindex` | unchanged |
| sitemap lists the four marketing URLs, none of the gated roots | unchanged |

### 7.2 New behavioural coverage

- Clio returns a level → correct folder opens, the other three do not
- **A blank level and a missing contact are indistinguishable in the response**
- Clio unreachable / 500 / malformed body → deny
- Option ID absent from the map → deny (never default to a level)
- One email on two contacts with different levels → deny
- Cookie carries no PII; cannot be forged without the secret
- Rotating the secret invalidates an existing cookie
- Sliding expiry renews on a page load inside the level
- Sign-in without a Turnstile token → refused
- Per-IP rate limit trips
- **No fee value, price, or currency symbol** in any rendered or logged string

### 7.3 Non-vacuous proof

Per the standard already set on this repo: inject one deliberate defect per control,
show **one failing test per defect**, restore the tree, re-run clean. A suite that
has never failed has not been shown to work.

### 7.4 Telemetry

Sign-in outcome → Vantage via the existing `sendVantageUpsert`:
`timestamp · outcome · level · salted hash of the email`.

**Do not log which tools a member opened.** *That* someone signed in is
operational; *what a client is working on* is not ours to record.

---

## 8. Firm deliverables — not code

### 8.1 Runbook (#189)

One page, written for a paralegal, no technical language. Admit = set the dropdown.
Change = change the dropdown. Revoke = clear the dropdown, effective next sign-in,
**no other member affected**. Plus the three troubleshooting checks: is the field
set, are they using the address on that Clio contact, is that address on more than
one contact.

### 8.2 Welcome email template — **SHELVED, out of scope**

Not a blocker and not part of this build. Recorded so the reasoning survives.

David's mental model on the call, turn [6]:

> "…you could turn him into a diamond member by clicking diamond, and then **all of
> a sudden he would get an email confirmation that he's a diamond member**, and what
> website he would go to and what email he would use to get in there."

**Clio does not do that.** Setting a custom-field value fires no notification —
no email, no portal message, nothing. There is no automation behind that dropdown.

Left unsaid, the first member is admitted and then waits for an email that never
arrives. A **saved email template for Wendy** is the eventual answer, covering:

- confirmation of the engagement level
- the URL of that level
- **the email address to use — the one on their Clio contact.** This is the whole
  credential; if they try a different address they are not recognised.
- who to contact if it does not work

Sending stays manual and human for now. An automated send is a later decision, not
a gap this order leaves open.

> ⚠️ Confirm with Wendy that no Clio notification fires on a custom-field change
> before this is stated to David as settled fact.

---

## 9. Accepted risk — recorded deliberately

> This build uses a **verified-by-assertion email address as the sole credential**.
> It is a deliberate trade for delivery speed. It means (a) anyone who knows a
> member's email address can reach that member's level, and (b) the sign-in form
> discloses whether a given address is a member and at what level.
>
> **Plan A — a one-time emailed sign-in link — is the named fix and is out of scope
> for this order.** Turnstile and per-IP rate limiting reduce bulk enumeration;
> neither changes the underlying property.

Paul should be told before the first Reserve member is admitted.

---

## 10. Rollback

Restore `functions/_lib/tier-auth.js` and revert the four `_middleware.js` files
to `tierGuard(...)`. The eight `TIER_*` secrets must still exist in both
environments — which is why §5 step 9 (delete `tier-auth.js`, remove the secrets)
runs **last and separately**, only once the Clio gate is proven in Preview.

Nothing in Clio is written, so there is no Clio-side rollback. Clearing
`Membership Tier` on a contact is the firm's own revoke and is unrelated.

---

## 11. Delivery

Feature branch → Cloudflare Preview → David reviews and tests → merge → production
deploy. **We never merge and never deploy** (CLAUDE.md §6).

`functions/` is outside the content lane, so this order carries David's explicit
green light for the members lane, given on the 2026-08-05 call (§1) and confirmed
2026-08-06.
