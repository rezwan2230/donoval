# ADAM — POST-CALL OBSERVABILITY (R1)

**Order:** ADAM-POSTCALL-OBSERVABILITY-R1
**Scope:** read-only tooling. No shipped Function changed, no log line added to
production code, no workflow touched, no secret read, no request sent to
production from the tool.

The post-call enrichment path and the callmap producer already log everything
needed to answer two questions, and neither question could be *asked* before this:

1. **What is the qualifier-skip rate?** — the number the **#180 joinKey trade**
   turns on.
2. **Is the live post-call webhook healthy?** — once Retell is repointed at
   `/webhooks/retell-postcall`.

Both are derived here from lines that already exist. Capture a window, run the
tally, read the table.

---

## 1. The capture

### 1.1 Prerequisites

```bash
npx wrangler whoami
```

An account printed is the only auth check needed. **Do not paste an API token
into the shell** — `wrangler login` stores it out of band.

### 1.2 The command

Pages project name is `donovan-site` (`donovan-legal-site/wrangler.jsonc:2`).
Run from `donovan-legal-site/`, in its own terminal, **before** the window you
want to measure.

Git Bash:

```bash
cd donovan-legal-site
npx wrangler pages deployment tail \
  --project-name donovan-site \
  --environment production \
  --format json \
  --method POST \
  | tee ~/postcall-tail-$(date +%Y%m%d-%H%M).jsonl
```

PowerShell:

```powershell
cd donovan-legal-site
npx wrangler pages deployment tail --project-name donovan-site --environment production --format json --method POST |
  Tee-Object -FilePath "$HOME\postcall-tail-$(Get-Date -Format yyyyMMdd-HHmm).jsonl"
```

| Flag | Why |
|---|---|
| `--project-name donovan-site` | the Pages project. Not the branch, not the hostname. |
| `--environment production` | the latest production deployment, without needing its id. Tailing a Preview instead? Pass the deployment id as the positional argument: `npx wrangler pages deployment tail <deployment-id> --project-name donovan-site …` |
| `--format json` | one JSON object per line, messages under `logs[].message[]`. `pretty` emits ANSI colour that survives a pipe. The tally reads **both**, but `json` is what keeps the file greppable. |
| `--method POST` | the noise filter. `js/perch/command-channel.js` polls `GET /fn/page-poll` every 1.2 s — roughly 50 events a minute per live call, which buries everything else. Both routes we care about are POST, so nothing is lost. |
| `tee` | the tail is a stream. Without a file you cannot re-run the tally, and you get one chance per window. **The file is the evidence.** |

Deliberately **not** used: `--search`. Filtering on the wire makes "the category
was zero" and "the tail was never attached" look identical, and throws away the
`qualifier_join=` lines that carry the whole #180 answer. Filter after the fact.

### 1.3 Liveness check — do this first

Within the first seconds, the tail must show **something**. A completely empty
screen after a booking or a call means the tail is not attached to the deployment
serving traffic. A silent tail and a clean integration are the same picture —
stop and fix the attachment before you trust a zero.

### 1.4 Window length

The skip rate is a ratio over voice bookings, and voice bookings are not
frequent. A window with fewer than ~20 `call_id_present=yes` lines gives a rate
whose confidence interval is wider than the decision it is meant to settle. The
tally prints the denominator on the same row for exactly this reason.

If a live window cannot reach that many, the same three facts are also **durable**:
`booking/create.js:608-615` stores `qualifier_join`, `qualifier_source` and
`qualifier_key_source` on every `booking:` KV record, with the same
"present only when verified" rule for `qualifier_key_source`. An operator can
therefore reconstruct a much longer window from KV instead of a tail. That is an
operator action against the account, **not** something this script does — the
script reads a file and nothing else.

---

## 2. The tally

```bash
node scripts/postcall-tally.mjs ~/postcall-tail-20260805-1400.jsonl

# or from a pipe
cat ~/postcall-tail-*.jsonl | node scripts/postcall-tally.mjs

# machine-readable, for pasting into an issue
node scripts/postcall-tally.mjs ~/postcall-tail-*.jsonl --json
```

The script reads a file and nothing else. It opens no socket and touches no
binding.

### 2.1 What it counts, and where each line comes from

Every category is a literal substring of a string that exists in the deployed
source today. The `source` column is the file and line it was quoted from, and
`test/postcall-tally.test.mjs` asserts each category cites one.

**Post-call webhook — terminal delivery outcomes** (at most one per POST):

| Category | Log literal | Source |
|---|---|---|
| agent refused (no `call.agent_id`) | `[postcall] AGENT_MISSING` | `_lib/retell-postcall.js:76` |
| agent refused (another agent) | `[postcall] AGENT_MISMATCH` | `_lib/retell-postcall.js:80` |
| ignored: not `call_analyzed` | `[postcall] ignored event=` | `webhooks/retell-postcall.js:106` |
| ignored: `no_contact` | `[postcall] no contact resolved:` | `webhooks/retell-postcall.js:119` |
| refused: signed but unparseable | `[postcall] signed delivery had an unparseable body` | `webhooks/retell-postcall.js:94` |
| ignored: config unavailable | `[postcall] booking config unavailable` | `webhooks/retell-postcall.js:145` |
| **APPLIED** | `[postcall] fields applied count=` | `booking/_lib/provider-clio.js:2247` |
| write failed | `[postcall] fields not applied:` | `booking/_lib/provider-clio.js:2241, :2250` |
| contact not read back | `[postcall] contact not read` | `booking/_lib/provider-clio.js:1128` |
| field id resolve errored | `[postcall] field ids not resolved:` | `booking/_lib/provider-clio.js:2209` |
| fields absent from the account | `[postcall] no post-call field ids on the account` | `booking/_lib/provider-clio.js:2216` |
| `no_change` | `[postcall] nothing to apply: no_change` | `booking/_lib/provider-clio.js:2225` |
| analysis produced no fields | `[postcall] no fields to write` | `booking/_lib/provider-clio.js:2200` |

**Signature refusals** (counted apart — see §2.2):

| Category | Log literal | Source |
|---|---|---|
| invalid HMAC | `[retell-auth] SIGNATURE_INVALID` | `_lib/retell-auth.js:100` |
| `RETELL_API_KEY` unset | `[retell-auth] MISCONFIGURED` | `_lib/retell-auth.js:83` |

**Detail, not a delivery** — fires *alongside* one of the outcomes above, so it
is excluded from the delivery sum:

| Category | Log literal | Source |
|---|---|---|
| analysis selected | `[postcall] analysis selected count=` | `webhooks/retell-postcall.js:128` |

**Booking producer:**

| Category | Log literal | Source |
|---|---|---|
| qualifier join record | `[booking/create] qualifier_join=` | `booking/create.js:365` |
| body call_id unverified, recovered from cookie | `[booking/create] body call_id unverified` | `booking/create.js:346` |
| callmap not written (no Clio contact) | `[booking/create] callmap not written` | `booking/create.js:718` |
| callmap write failed (KV) | `[booking/create] callmap write failed:` | `booking/create.js:731` |

Anything else — request lines, exceptions, other routes, a half-written JSON
object at the truncation point — is counted as **other** and never crashes the
run. The counts reconcile: every category plus `other` sums to the message total,
and the suite asserts it.

### 2.2 Three blind spots, stated rather than papered over

These are properties of the shipped code, not of the tally. **Closing any of them
means adding a log line to a Function, which this order forbids** — they are
recorded here so a zero in the table is not misread as a clean bill of health.

1. **`signature_missing` logs nothing at all.** `retell-auth.js:92` returns
   `{reason:"signature_missing", status:401}` *before* any `console` call. A
   flood of unsigned POSTs is invisible in the tail. Only `SIGNATURE_INVALID`
   (a wrong HMAC) and `MISCONFIGURED` (no key set) leave a trace. Treat the
   signature row as a **lower bound**.

2. **`[retell-auth]` lines cannot be attributed to this route.** The verifier is
   shared with the page-action surface, and its message literally reads
   `page action refused`. A `SIGNATURE_INVALID` in the capture may be a post-call
   delivery or a page action. This is why signature refusals are reported in
   their own block and are **not** summed into `deliveries` — doing so would be
   a claim the prefix cannot support. Cross-check against the request URL in the
   surrounding JSON line if you need attribution.

3. **The route's `no_fields` early return is silent.**
   `webhooks/retell-postcall.js:134-136` returns `{ignored:"no_fields"}` with no
   log of its own. The preceding `analysis selected count=0` line is the only
   evidence. If `analysis selected` exceeds the delivery sum's post-gate outcomes,
   the difference is this path — a `count=0` selection is the signature.

---

## 3. Reading the output for the #180 go / no-go

### 3.1 What #180 actually proposes

`booking/create.js:690` writes `callmap:<call_id>` keyed on the call_id **as
submitted**, and flags the trade in its own comment:

> It does mean a browser that submits a booking under someone else's call_id can
> point that call at its own contact… when the enrichment consumer lands, the
> tightening available is to key on `joinKey` instead, which is unforgeable and
> narrower. Flagged for Zane.

The enrichment consumer has landed — `readCallmap` in
`_lib/retell-postcall.js:102` is it. So the trade is live:

- **Keying on `callId` (today):** every voice booking gets a callmap, and a
  browser that guesses another caller's call_id can redirect that call's
  enrichment to its own contact — at the cost of passing Turnstile and making a
  real appointment on the firm's calendar.
- **Keying on `joinKey` (#180):** unforgeable, but `joinKey` is `""` whenever the
  qualifier binding did not verify (`create.js:335-336`), and the write is gated
  on a non-empty key. **Those bookings get no callmap at all**, so their post-call
  analysis is silently dropped at gate 4.

The qualifier-skip rate is the size of that second population.

### 3.2 Where the number comes from

Not from a warn line. `callmap not written` (`create.js:718`) fires when Clio
resolved no contact — a *different* fact, and reading it as the skip rate would
answer the wrong question with a real number.

The skip is derived from the `qualifier_join=` record, which emits `key_source=`
**only** when the binding verified:

```js
let joinKey  = qual.verified ? callId : "";      // create.js:335
let keySource = qual.verified ? "body" : "";     // create.js:336
…
(keySource ? ` key_source=${keySource}` : "")    // create.js:368
```

So, per line:

| Line shape | Meaning |
|---|---|
| `call_id_present=yes` + `key_source=…` | verified — **#180 keeps** the callmap |
| `call_id_present=yes` + **no** `key_source` | **SKIP** — #180 **drops** the callmap |
| `call_id_present=no` + `key_source=cookie` | #180 **gains** a callmap it does not have today |
| `call_id_present=no` + no `key_source` | ordinary web booking — no callmap either way |

```
qualifier-skip rate = skips ÷ voice bookings (call_id_present=yes)
```

### 3.3 The verdict

Read `qualifier-skip rate` together with its denominator on the same row.

| Reading | What it means | Call |
|---|---|---|
| **`n/a`** — zero voice bookings | The window measured nothing. | **No decision.** Widen the window and re-capture. |
| Denominator **< 20** | The ratio is real but the sample is not. | **No decision.** Keep capturing. |
| **≈ 0 %** | Effectively every voice booking already carries a verified qualifier key. #180 costs nothing and removes the forgery path. | **GO.** |
| **Low, single digits** | A small number of callers book without a verified qualifier and would lose enrichment. Weigh against the forgery risk — the attack needs Turnstile *and* a real appointment, so this is a narrow threat and a real cost. | **GO with the loss stated** in the PR, or gate #180 behind a fallback. |
| **Double digits or higher** | A material share of voice bookings never verify. #180 as written would drop their post-call analysis on the floor, and the failure is silent — it lands in gate 4 as `no_contact`, indistinguishable from a call that never booked. | **NO-GO as written.** #180 needs a fallback (try `joinKey`, then `callId`) or a fix upstream so more bookings verify. |

Two rows to check before trusting any verdict:

- **`of which claims_nothing=yes`** — an explicit opt-out
  (`create.js:331`), not a failure to verify. If these dominate the skips, the
  skip rate is measuring a deliberate client choice and #180's cost is smaller
  than the headline number.
- **`cookie-only key — #180 GAINS a callmap`** — bookings with no body call_id
  but a verified cookie key. #180 would *add* enrichment coverage here. Net
  coverage change is `gains − skips`, not `−skips`.

### 3.4 Reading the same capture for webhook health

Once Retell is repointed, the delivery block answers "is it working":

- **`deliveries` is 0** — Retell is not reaching this route at all, *or* every
  delivery is dying at gate 1. Check the signature block, and remember blind
  spot §2.2.1: an unsigned flood shows as nothing anywhere. Verify the Retell
  webhook URL before concluding the route is broken.
- **`agent refused` > 0** — deliveries are arriving from an agent id this
  deployment does not mint. Compare `resolveAgentId(env)` against the Retell
  dashboard. This is the #122 failure mode and it is meant to be loud.
- **`ignored: not call_analyzed` is the bulk** — **normal.** Retell sends
  several event types to one URL and only `call_analyzed` carries the analysis.
- **`ignored: no_contact` is the bulk** — also normal in isolation: most calls
  do not end in a booking. It becomes a symptom when it stays high while
  `[booking/create] callmap …` lines show bookings *were* happening in the same
  window. That combination is the callmap seam failing, not calls declining.
- **`fields absent from the Clio account` > 0** — the four custom fields do not
  exist in Clio settings under the names in `POSTCALL_CUSTOM_FIELDS`. Nothing
  will ever be written until they do. This is a configuration task, not a bug.
- **`write failed` > 0** — the PATCH is being refused. The captured line carries
  the HTTP status and a named-field summary; no value is ever logged.
- **`APPLIED` > 0** — the path is end-to-end live.

---

## 4. Tests

`test/postcall-tally.test.mjs` runs the parser against a fixture of the shipped
log strings with hand-tallied known counts, and asserts:

- every delivery outcome counted exactly once, `deliveries = 11`;
- `fields not applied` is never counted as `fields applied`;
- `analysis selected` never inflates the delivery total;
- signature refusals are not folded into deliveries;
- `voiceBookings = 5`, `skips = 2`, **rate = 40.0 %** on the fixture;
- no voice bookings ⇒ rate is `null` and prints `n/a`, never `0 %`;
- unrecognised, malformed, hostile and non-string input lands in `other` and
  never throws;
- every category cites a source line, and no category literal is a substring of
  another.

```bash
npm test
```
