# DR. INSANE — the #180 coverage cost cannot be removed at this seam

**Order:** DRINSANE-201-CALLMAP-COVERAGE-R1 · issue #201
**Verdict:** **STOP AT THE MEMO.** No safe fallback exists. **No behaviour changed.**
**Prior art:** #180 (joinKey hardening), #174 (post-call webhook), #57 (call_id binding)

---

## 1. The coverage gap, exactly

`donovan-legal-site/functions/booking/create.js`:

```js
let joinKey = qual.verified ? callId : "";   // ~line 337
...
const callmapK = callmapKey(joinKey);        // ~line 749  → "" when joinKey is ""
if (env?.PERCH_ACTIONS && callmapK) { ...write the row... }
```

`qual.verified` is true only when `resolveQualifierBinding` found a **server-written**
record — `qualbk:<id>` in `PERCH_ACTIONS`, or the `qual:<id>` PERCH_BRIDGE slot. Both are
written by `fn/qualifier_submit`, i.e. **only when the caller completes the qualifier card.**

So: a genuine voice caller who books but never completed the card has no record → `verified:false`
→ `joinKey: ""` → `callmapKey("") === ""` → **no index row.** Minutes-to-hours later the signed
`call_analyzed` arrives, `readCallmap` returns `absent`, and the endpoint answers its clean
`200 {ignored:"no_contact"}`. The four analysis fields are never written.

Metered by the line #180 added (`create.js` ~754):

> `[booking/create] callmap not written — a call booked under a call_id the server could not verify`

## 2. The trust ledger on each side of the seam

The seam is one row: **`call_id` → `contact_id`**. The two halves are written and read hours apart,
by different principals, and — this is the whole finding — **each side can attest a different half.**

### Producer — `booking/create.js`, at booking time (T0)

| Signal | Provenance | Trustable? |
|---|---|---|
| `body.call_id` | the browser | ❌ **forgeable**; a bearer capability by design (`qualifier-bind.js`, `fn/qualifier_result.js`) |
| `body.qualifier_claim` | the browser | ⚠️ withholds only — no value of it ever *attaches* anything |
| `dl_qual` cookie | **server**, set by `fn/qualifier_submit` | ✅ but **absent in the skip case by definition** |
| Turnstile token | Cloudflare | ⚠️ proves "a browser", never identity — the forger passes it (#180 priced this: "one Turnstile pass and one real appointment") |
| `qualbk:<id>` / `qual:<id>` | **server** | ✅ **the only real anchor — and absent in the skip case by definition** |
| `providerResult.contact_id` | Clio, from the booker's **own typed** name/email/phone | ❌ **attacker-chosen** |
| any signed Retell artefact | — | ❌ **none exists yet.** The webhook has not arrived, and cannot be waited for: the booking may happen mid-call |

### Consumer — `webhooks/retell-postcall.js`, at T1

| Signal | Provenance | Trustable? |
|---|---|---|
| `x-retell-signature` — HMAC-SHA256(raw body ‖ ts, `RETELL_API_KEY`), 5-min anti-replay | Retell | ✅ strong |
| `call.agent_id === resolveAgentId(env)` | the envelope | ✅ fail-closed, no lab bypass |
| `call.call_id` | the envelope | ✅ **a real call id, on our agent** |
| `call.call_analysis.*` | the envelope | ✅ the four fields |
| `from_number`, `to_number`, dynamic `name`/`email`/`phone` | the envelope | ❌ **all arrive BLANK** — PII-scrubbed for this account |
| a contact id, a booking ref, anything naming the booker | — | ❌ **not present at all** |

**The asymmetry, stated plainly:** the producer holds the **value** (a contact) and cannot attest it.
The consumer can attest the **key** (a call id) and holds no value. Neither side ever holds both.

## 3. Task 2 finding — no trustable signal distinguishes the two

### 3a. At the producer they are byte-identical

Both shipped handlers driven for real (same call id, no `qualbk:` record in either run):

```
A legitimate skip caller — trusted-signal lines:
    [booking/create] qualifier_join=unverified call_id_present=yes cookie_present=no claims_nothing=no
    [booking/create] callmap not written — a call booked under a call_id the server could not verify
B forger, same call id  — trusted-signal lines:
    [booking/create] qualifier_join=unverified call_id_present=yes cookie_present=no claims_nothing=no
    [booking/create] callmap not written — a call booked under a call_id the server could not verify

  identical trusted signals?  true
  A callmap rows written:     0
  B callmap rows written:     0
  A booking status: 201   B booking status: 201
```

Every signal the server can trust is **the same in both runs**. The only field that differs is the
Clio contact — which is precisely the half the attacker chooses.

### 3b. A real signed `call_analyzed` does **not** repair it

This is the specific signal the order asked about, and the answer is no — for a structural reason.

**The signature authenticates the key, never the value.** The row is `call_id → contact_id`. The HMAC
covers the Retell envelope, which contains the call id and the analysis. The `contact_id` never enters
the signed material, and there is nothing in the envelope to check it against: `from_number`,
`to_number` and the dynamic `name`/`email`/`phone` all arrive blank for this account. That is already
a standing invariant — `test/retell-postcall-webhook.test.mjs:574`, *"there is no email or phone
fallback — the envelope is scrubbed and must stay unused."*

And the forger's premise is that **the call is genuine** — they hold a *leaked id of a real call*.
So every "is this call real?" oracle, including a perfect signature check, answers **YES for the forger.**

**Demonstrated, not argued.** The Task-3 fallback was built as a mutant (both mutations asserted
applied first) and forgery case A run end-to-end through it:

```
  forger booking status: 201
  rows now in KV: [ 'callmap:cid:call_cm77a10ef2be40199c3d7a5b21' ]
  signed call_analyzed → 200 {"ok":true,"applied":true,"written":4}
  contacts PATCHed by the signed delivery: [ 9990002 ]
  victim contact id: 5550001   forger contact id: 9990002

  >>> victim's analysis landed on the FORGER's contact: true
  >>> and it carried the victim's call summary text: true
```

A **fully genuine, signature-valid, agent-valid** delivery wrote all four analysis fields — including
the victim's call summary — onto the **attacker's** Clio contact. That is #180 forgery case A, verbatim.

Case B was checked on the same mutant and does **not** reopen (the `joinKey` row still wins, and
`qual.consume()` still spends `qualbk:` at the genuine booking):

```
  after genuine booking, rows: [ 'callmap:call_cm77…' ]
  after forger booking,  rows: [ 'callmap:call_cm77…', 'callmap:cid:call_cm77…' ]
  >>> established row repointed to forger: false
  >>> analysis still landed on the genuine contact: true
```

So the fallback trades **exactly** the case #180 exists to close.

## 4. Coverage versus forgery

| Scenario | #180 today | With a lower-trust callId fallback |
|---|---|---|
| Genuine voice booking, qualifier **completed** | ✅ enriched (`joinKey` row) | ✅ enriched (`joinKey` row) |
| Genuine voice booking, qualifier **skipped** | ❌ **no row, no enrichment — the gap** | ✅ enriched |
| Ordinary web booking, no call | ✅ no row (correct) | ✅ no row (no `call_id`) |
| **Forgery A** — book under a stranger's call id, **no** qualifier record | ✅ **no row; attacker gets nothing** | ❌ **REOPENED** — stranger's signed analysis lands on the attacker's contact (**proven**: 200, 4 fields, summary included) |
| **Forgery B** — hijack an **established** `joinKey` row | ✅ closed (`qual.consume()` spends `qualbk:`) | ✅ still closed (`joinKey` row wins) |

**Net: the fallback buys row 2 and pays with row 4.** Row 4 is the reason #180 was written.

## 5. Alternatives considered, and why each fails

| Design | Why it fails |
|---|---|
| Fallback row, consumer uses it only when no `joinKey` row exists | Case A reopened — demonstrated above |
| Fallback row + require a valid signed delivery | The delivery **is** valid. It attests the call, not the booker |
| Match booking phone/email against `from_number` | Blank on this account; and unavailable at T0 anyway |
| Producer writes a *pending* row, consumer promotes it on a signed delivery | The signature still cannot say **which** pending row is legitimate |
| New server-written call-existence witness (e.g. Paula's navigate writing `callwit:<id>`) | Reopens case A **and widens it**: every live call id becomes indexable, not just those with an unspent qualifier. Also needs `perch-do`/`do_page_action` changes |
| Auto-write a minimal `qualbk:` at call start | Same as above — every call gains a witness, so case A reopens for **every** call |

Common mode: **any witness keyed solely by call id is defeated by a leaked call id**, because the
call id is a bearer capability. `qualifier-bind.js` says so in its own header ("NOT A PROOF OF
OWNERSHIP… a leaked id still joins"), and #57 left that residual explicitly out of scope.

## 6. The one theoretically safe direction — a separate order, not this one

Break the bearer property: mint a **per-call secret** server-side, deliver it only into the live
caller's browser session, have the booking echo it, and verify it against a server-written record.
A leaked call id alone would not produce the secret, so it is *strictly stronger* than today's
`joinKey` and would cover the skip case.

It is **not** what this order authorises, and should not be smuggled in under it:

- it is not "a lower-trust callId fallback" — it is a **new, stronger** witness and a new mint point;
- it needs new code in the call path (`perch-do` or a new `fn/` endpoint) and changes to `js/perch/*`
  — the order's STOP condition names page edits;
- it changes what the browser sends, so it needs its own rollout and its own failure analysis.

Recommend it be scoped as its own order **if** the metered gap justifies the work.

## 7. Recommendation

1. **Keep #180 exactly as it is.** The trade it made is the correct one.
2. **Use the warn line as the meter.** It already makes the gap countable in production; size the
   problem before paying for it.
3. **Treat qualifier-card completion as the product lever** — a caller who completes the card is
   enriched today, with no security change required.
4. **Open a separate order for the per-call-secret design** if the numbers justify it.

## 8. Reproduction

Throwaway probe, run against `origin/main` @ `b33c127`, both mutations asserted applied before use,
mutants materialised in a temp dir outside the repo (nothing under `donovan-legal-site/` written):

- **producer mutation** — in `booking/create.js`, replace the `callmap not written` warn with a
  `PERCH_ACTIONS.put("callmap:cid:" + callId, {contact_id, booking_id, created, trust:"call_id_only"})`
  at `CALLMAP_TTL_S`;
- **consumer mutation** — in `_lib/retell-postcall.js` `readCallmap`, on a miss retry
  `kv.get("callmap:cid:" + callId)` before returning `absent`.

Harness: the shipped `onRequestPost` from both halves, one shared KV double, `test/helpers/stubs.mjs`,
a Clio stub minting a distinct contact id per booker, and `buildRetellSignatureHeader` for a genuinely
signed delivery — the same technique as `test/callmap-seam-integration.test.mjs` §4.

**Regression status:** no production file modified. `callmap-seam-integration`,
`callmap-and-callid` and `retell-postcall-webhook` — **120/120 pass**, unchanged.
