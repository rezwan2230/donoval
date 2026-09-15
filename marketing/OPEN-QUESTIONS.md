# Open questions

Everything blocked, and on whom. A question sitting in someone's head is a
question nobody is answering.

---

## 🔴 Paul

### 1. Does the firm PRACTICE harassment and immigration? *(oldest, and the biggest)*

Asked 2026-08-10, unanswered. Nothing on the site or in any of the four bios
suggests either. Three possible answers and they lead somewhere completely
different:

| Answer | Consequence |
|---|---|
| We practice them | Build the funnels |
| We'd hire for them | Timeline and cost change; marketing waits for capacity |
| We'd refer them out | This stops being marketing and becomes lead-gen-for-referral — Florida has rules on dividing fees and on holding out a practice area you do not practice |

**Nothing in `keywords/02` should be built until this is answered.** There is a
real risk it becomes "we're running harassment campaigns" by momentum rather than
by decision.

**Recommendation:** if only one proceeds, make it **investor immigration** — EB-5,
E-2, L-1 and pre-immigration tax planning. It extends the FIRPTA and
international-inbound work the firm already does, uses Paula's Spanish, and
strengthens the tax-first brand instead of diluting it.

### 2. Geographic targeting — Florida, or nationwide?

The site says clients are served nationwide. Nationwide multiplies both reach and
cost, and changes which keywords are affordable. Blocks the budget conversation.

### 3. Budget

Should follow the Keyword Planner numbers, not precede them.

### 4. Bidding on competitor names — yes or no?

Some firms do it. It works. Florida Bar advertising rules have views. Not on any
list until he says.

### 5. Conversion value bands *(with Elroy)*

The order is set — Reserve > Diamond > Platinum > Gold. The numbers are
placeholders. Rough is fine; even 10× versus 1× beats treating them as equal.

---

## 🟠 Meta Business Manager admin — identity still unknown

Elroy holds a CAPI token but has no dashboard access, which is backwards: the
token is the dangerous half.

| | Blocks |
|---|---|
| Events Manager access to dataset `1769060274465061` | Verifying the Conversions API — 30 minutes of screen-share would do, standing access is not required |
| Verify `donovan.law` (DNS TXT) | Aggregated Event Measurement |
| Configure AEM priority | Meta optimisation |
| Reduce the `Donovan API` system user from Admin to Employee | Security only |

⚠️ **The account has a restriction history** — previously blocked, reportedly over
a location mismatch. Before any spend: confirm it is in good standing, confirm
business verification is complete, confirm the ad account's country and payment
method both say Florida, and **ramp spend gradually.** Adding users, changing
payment methods and a sudden spend increase are the three things that re-trigger
review, and a campaign launch is all three at once.

**None of this blocks Google.** It only blocks the Meta half of the server-side work.

---

## 🟡 David

| | |
|---|---|
| Review and merge #234 → #236 → #237 → #238, plus #235 | Everything downstream |
| Deploy with `ANALYTICS` unset and confirm nothing changed | The step that proves the inert claim on the real site |
| Where should a "conversions went to zero while spending" alert land — Slack, email, Roam, a GitHub issue? | The last upkeep guardrail |
| Update `CLAUDE.md` §6 if merge rights have genuinely moved | The file still says "never merge" |

---

## 🔵 Elroy

| | |
|---|---|
| Run both keyword lists through Keyword Planner | Free, needs nobody, turns the budget question into arithmetic |
| Set the `ANALYTICS` Secret once David has deployed | Must be a **Secret** — `wrangler.jsonc` governs this project so the dashboard offers nothing else |
| Create four **Import**-source conversion actions | The server-side Google import. The existing four are Website-source and cannot receive gclid uploads |
| Create the Google Ads passkey | Will soon be required for linking accounts and adding users |
| Google Business Profile | Does not exist. Highest-return free asset for local legal intent |
| Google Search Console | Not set up — no `google-site-verification` record. Free, five minutes |

---

## Answered

**Approve the `/disclaimer` analytics wording** — ✅ **Paul approved AS WRITTEN, 2026-08-10.**
The last client gate before tracking can be switched on. See `DECISIONS.md`.


**Which page is the privacy policy?** — `/disclaimer`. It is the only one;
`/privacy`, `/privacy-policy`, `/cookies` and `/terms` all 404. *(2026-08-10)*

**Consent: geo-gated or everyone?** — Everyone. *(Elroy, 2026-08-10)*

**Does Meta access block all of Phase 2?** — No. Only the Conversions API half.
The Google offline import needs nothing from Meta. *(2026-08-10)*
